/**
 * LayerLedger Order Lifecycle Accounting Service
 * Implements Rulings 1 to 6, 16, 18, 19, 20:
 * 1. Order confirmed: 0 journal entry
 * 2. Invoice raised: 0 journal entry (Ruling 3)
 * 3. Deposit/Payment before delivery: Dr 1110 Bank / Cr 2120 Customer Deposits (Ruling 6)
 * 4. Baked: Dr 1160 Finished Goods / Cr 1140 Raw Materials (Ruling 16, weighted avg cost)
 * 5. Delivered: Simultaneous Revenue (Dr 2120/1120, Cr 4000/4040/4060) and COGS (Dr 5000 Cr 1160, Dr 5010 Cr 1150)
 * 6. Balance paid after delivery: Dr 1110 Bank / Cr 1120 Accounts Receivable
 * 7. Cancellations and Forfeited Deposits (Ruling 19, 20): Forfeits land in 7030, keeping cake gross margin clean
 */

const prisma = require('../../../prisma');
const postingService = require('./posting.service');
const reversalService = require('./reversal.service');
const { toDecimal, isPositive } = require('../utils/decimal');

class OrderAccountingService {
    /**
     * 1. Customer Payment / Deposit received before delivery (Ruling 6)
     * Dr 1110 Bank (or 1100 Cash on Hand)
     * Cr 2120 Customer Deposits
     * Profit impact: NIL
     */
    async recordDepositPayment(tenantId, orderId, paymentData, externalTx = null) {
        const runWithTx = async (tx) => {
            const amount = parseFloat(paymentData.amount || 0);
            if (amount <= 0) return null;

            let paymentId = paymentData.id;
            if (!paymentId && orderId) {
                const orderExists = await tx.order.findFirst({
                    where: { id: orderId, tenantId },
                    select: { id: true }
                });
                if (orderExists) {
                    const createdPayment = await tx.orderPayment.create({
                        data: {
                            orderId,
                            amount,
                            method: paymentData.method || 'bank_transfer',
                            date: paymentData.date ? new Date(paymentData.date) : new Date(),
                            type: paymentData.type || 'deposit'
                        }
                    });
                    paymentId = createdPayment.id;
                }
            }

            const isCash = String(paymentData.method || '').toLowerCase() === 'cash';
            const debitAccount = isCash ? '1100' : '1110';

            const memo = `Customer deposit for Order ${orderId}${paymentData.method ? ` via ${paymentData.method}` : ''}`;

            const postResult = await postingService.postJournalEntry({
                tenantId,
                entryDate: paymentData.date || new Date(),
                sourceType: 'order_deposit',
                sourceId: paymentId ? String(paymentId) : String(orderId),
                memo,
                lines: [
                    {
                        accountCode: debitAccount,
                        debit: amount,
                        credit: 0,
                        description: `Deposit received for Order ${orderId}`
                    },
                    {
                        accountCode: '2120',
                        debit: 0,
                        credit: amount,
                        description: `Customer Deposit (deferred revenue) - Order ${orderId}`
                    }
                ]
            }, tx);

            return postResult.entry;
        };

        if (externalTx) return await runWithTx(externalTx);
        return await prisma.$transaction(async (tx) => runWithTx(tx), { maxWait: 10000, timeout: 30000 });
    }

    /**
     * 2. Mark as Baked (Ruling 16)
     * Asset-to-Asset transfer:
     * Dr 1160 Inventory, Finished Goods
     * Cr 1140 Inventory, Raw Materials
     * Profit impact: NIL. Valued at weighted average ingredient cost.
     */
    async recordOrderBaked(tenantId, orderId, options = {}, externalTx = null) {
        const runWithTx = async (tx) => {
            const order = await tx.order.findFirst({
                where: { id: orderId, tenantId },
                include: { items: true }
            });

            if (!order) {
                throw new Error(`Order ${orderId} not found`);
            }

            // Determine actual ingredient cost from production sheet or recipe cost
            let ingredientCost = parseFloat(options.actualIngredientCost || order.totalCost || 0);

            // If not specified on order, sum from items
            if (ingredientCost <= 0 && order.items?.length > 0) {
                ingredientCost = order.items.reduce((sum, item) => sum + (item.cost || 0), 0);
            }

            // Fallback default: if cost is still zero, use standard 25% of price
            if (ingredientCost <= 0 && order.totalPrice > 0) {
                ingredientCost = parseFloat((order.totalPrice * 0.25).toFixed(2));
            }

            // Deduct from physical raw material inventory (if usages provided)
            // Ruling 18: Negative stock allowed and flagged, never blocked
            if (options.usages && Array.isArray(options.usages)) {
                for (const use of options.usages) {
                    if (!use.itemId || !use.qty) continue;
                    const invItem = await tx.inventoryItem.findFirst({
                        where: { id: use.itemId, tenantId }
                    });

                    if (invItem) {
                        const newStock = parseFloat((invItem.stock - use.qty).toFixed(3));
                        const consumedValue = use.qty * invItem.cost;
                        const newValue = Math.max(0, parseFloat((invItem.totalValueOnHand - consumedValue).toFixed(2)));

                        await tx.inventoryItem.update({
                            where: { id: use.itemId },
                            data: {
                                stock: newStock,
                                totalValueOnHand: newValue
                            }
                        });

                        await tx.inventoryHistory.create({
                            data: {
                                tenantId,
                                inventoryItemId: use.itemId,
                                type: 'USAGE',
                                qtyDelta: -use.qty,
                                valueDelta: -consumedValue,
                                pricePerUnit: invItem.cost,
                                qtyAfter: newStock,
                                valueAfter: newValue,
                                avgCostAfter: invItem.cost,
                                referenceId: orderId,
                                reason: `Baking for Order ${orderId}${newStock < 0 ? ' [WARNING: NEGATIVE STOCK]' : ''}`
                            }
                        });
                    }
                }
            }

            // Only post journal if ingredient cost > 0
            let journalEntry = null;
            if (ingredientCost > 0) {
                const entryDate = options.bakeDate || options.entryDate || options.date || new Date();
                const postResult = await postingService.postJournalEntry({
                    tenantId,
                    entryDate,
                    sourceType: 'order_bake',
                    sourceId: orderId,
                    memo: `Order ${orderId} baked - transferred to finished goods`,
                    lines: [
                        {
                            accountCode: '1160',
                            debit: ingredientCost,
                            credit: 0,
                            description: `Finished goods inventory for Order ${orderId}`
                        },
                        {
                            accountCode: '1140',
                            debit: 0,
                            credit: ingredientCost,
                            description: `Raw materials consumed for Order ${orderId}`
                        }
                    ]
                }, tx);
                journalEntry = postResult.entry;
            }

            // Update order status flags
            const updatedOrder = await tx.order.update({
                where: { id: orderId },
                data: {
                    isBaked: true,
                    bakedAt: new Date(),
                    ingredientsDeducted: true
                }
            });

            return {
                order: updatedOrder,
                journalEntry,
                ingredientCost
            };
        };

        if (externalTx) return await runWithTx(externalTx);
        return await prisma.$transaction(async (tx) => runWithTx(tx), { maxWait: 10000, timeout: 30000 });
    }

    /**
     * 3. Order Delivered (Ruling 2 & 5)
     * Revenue & COGS recognized together atomically.
     * Revenue:
     *   Dr 2120 Customer Deposits (amount paid)
     *   Dr 1120 Accounts Receivable (unpaid balance)
     *   Cr 4000 Cake Sales / 4040 Custom Orders / 4060 Delivery Income
     * Cost of Sales:
     *   Dr 5000 Raw Materials COGS
     *   Cr 1160 Finished Goods (or 1140 if not baked prior)
     *   Dr 5010 Packaging Items
     *   Cr 1150 Packaging Inventory
     */
    async recordOrderDelivered(tenantId, orderId, options = {}, externalTx = null) {
        const runWithTx = async (tx) => {
            const order = await tx.order.findFirst({
                where: { id: orderId, tenantId },
                include: {
                    items: true,
                    payments: true,
                    client: true
                }
            });

            if (!order) {
                throw new Error(`Order ${orderId} not found`);
            }

            // Total revenue for this delivery
            let salePrice = parseFloat(options.deliveredPrice || order.totalPrice || 0);

            // Separate delivery fee if specified
            const rawDeliveryFee = parseFloat(options.deliveryFee || order.metadata?.deliveryFee || 0);
            const deliveryFee = Math.min(salePrice, Math.max(0, rawDeliveryFee));
            const cakePrice = Math.max(0, parseFloat((salePrice - deliveryFee).toFixed(2)));

            // Total deposits / payments received on this order
            const totalPaid = order.payments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
            const depositPortion = Math.min(totalPaid, salePrice);
            const receivablePortion = Math.max(0, salePrice - depositPortion);

            // Ingredient cost: from options, or order total cost, or item cost
            let ingredientCost = parseFloat(options.actualCost || order.totalCost || 0);
            if (ingredientCost <= 0 && order.items?.length > 0) {
                ingredientCost = order.items.reduce((sum, item) => sum + (item.cost || 0), 0);
            }
            if (ingredientCost <= 0 && cakePrice > 0) {
                ingredientCost = parseFloat((cakePrice * 0.25).toFixed(2));
            }

            // Packaging cost: from options or ~2-3% of order price
            const packagingCost = parseFloat(options.packagingCost || order.metadata?.packagingCost || 0);

            // Finished Goods credit account: 1160 if baked, else 1140 Raw Materials directly
            const finishedGoodsCreditAccount = order.isBaked ? '1160' : '1140';

            // Revenue account: 4040 if custom order, else 4000
            const isCustom = order.items?.some(i => i.recipeId === null || (i.name && /custom|wedding|tiered/i.test(i.name)));
            const revenueAccount = isCustom ? '4040' : '4000';

            // Build journal lines
            const journalLines = [];

            // 1. Revenue entries
            if (depositPortion > 0) {
                journalLines.push({
                    accountCode: '2120',
                    debit: depositPortion,
                    credit: 0,
                    description: `Clear Customer Deposit upon delivery - Order ${orderId}`
                });
            }

            if (receivablePortion > 0) {
                journalLines.push({
                    accountCode: '1120',
                    debit: receivablePortion,
                    credit: 0,
                    description: `Accounts Receivable (outstanding balance) - Order ${orderId}`
                });
            }

            if (cakePrice > 0) {
                journalLines.push({
                    accountCode: revenueAccount,
                    debit: 0,
                    credit: cakePrice,
                    description: `Revenue on delivery - Order ${orderId}`
                });
            }

            if (deliveryFee > 0) {
                journalLines.push({
                    accountCode: '4060',
                    debit: 0,
                    credit: deliveryFee,
                    description: `Delivery Income - Order ${orderId}`
                });
            }

            // 2. Cost of Sales entries
            if (ingredientCost > 0) {
                journalLines.push({
                    accountCode: '5000',
                    debit: ingredientCost,
                    credit: 0,
                    description: `Raw Materials COGS for Order ${orderId}`
                });
                journalLines.push({
                    accountCode: finishedGoodsCreditAccount,
                    debit: 0,
                    credit: ingredientCost,
                    description: `Relieve Finished Goods for Order ${orderId}`
                });
            }

            // 3. Packaging items entries
            if (packagingCost > 0) {
                journalLines.push({
                    accountCode: '5010',
                    debit: packagingCost,
                    credit: 0,
                    description: `Packaging COGS for Order ${orderId}`
                });
                journalLines.push({
                    accountCode: '1150',
                    debit: 0,
                    credit: packagingCost,
                    description: `Relieve Packaging Inventory for Order ${orderId}`
                });
            }

            // Post atomic balanced journal entry
            const isForfeited = Boolean(options.isForfeited);
            const memo = isForfeited
                ? `Order ${orderId} forfeited by client (marked delivered per Ruling 20)`
                : `Order ${orderId} delivered - revenue & cost recognised`;

            const deliveryDate = options.deliveryDate || options.entryDate || options.date || new Date();

            let postResult = null;
            if (journalLines.length >= 2) {
                postResult = await postingService.postJournalEntry({
                    tenantId,
                    entryDate: deliveryDate,
                    sourceType: 'order_delivery',
                    sourceId: orderId,
                    memo,
                    lines: journalLines
                }, tx);
            }

            // Update order status
            const updatedOrder = await tx.order.update({
                where: { id: orderId },
                data: {
                    status: 'delivered',
                    deliveredAt: deliveryDate,
                    isForfeited,
                    forfeitedAt: isForfeited ? deliveryDate : null
                }
            });

            // If itemIds specified for partial delivery, mark individual OrderItems as delivered
            if (options.itemIds && Array.isArray(options.itemIds)) {
                await tx.orderItem.updateMany({
                    where: { id: { in: options.itemIds }, orderId },
                    data: { delivered: true, deliveredAt: new Date() }
                });
            }

            return {
                order: updatedOrder,
                journalEntry: postResult?.entry || null,
                salePrice,
                ingredientCost,
                isForfeited
            };
        };

        if (externalTx) return await runWithTx(externalTx);
        return await prisma.$transaction(async (tx) => runWithTx(tx), { maxWait: 10000, timeout: 30000 });
    }

    /**
     * 4. Post-Delivery Balance Payment
     * Dr 1110 Bank / Cr 1120 Accounts Receivable
     * Revenue is NOT recognized again (already recognized at delivery).
     */
    async recordBalancePayment(tenantId, orderId, paymentData, externalTx = null) {
        const runWithTx = async (tx) => {
            const amount = parseFloat(paymentData.amount || 0);
            if (amount <= 0) return null;

            let paymentId = paymentData.id;
            if (!paymentId && orderId) {
                const orderExists = await tx.order.findFirst({
                    where: { id: orderId, tenantId },
                    select: { id: true }
                });
                if (orderExists) {
                    const createdPayment = await tx.orderPayment.create({
                        data: {
                            orderId,
                            amount,
                            method: paymentData.method || 'bank_transfer',
                            date: paymentData.date ? new Date(paymentData.date) : new Date(),
                            type: paymentData.type || 'balance'
                        }
                    });
                    paymentId = createdPayment.id;
                }
            }

            const isCash = String(paymentData.method || '').toLowerCase() === 'cash';
            const debitAccount = isCash ? '1100' : '1110';

            const memo = `Balance payment received for delivered Order ${orderId}`;

            const postResult = await postingService.postJournalEntry({
                tenantId,
                entryDate: paymentData.date || new Date(),
                sourceType: 'order_payment',
                sourceId: paymentId ? String(paymentId) : String(orderId),
                memo,
                lines: [
                    {
                        accountCode: debitAccount,
                        debit: amount,
                        credit: 0,
                        description: `Balance payment collected for Order ${orderId}`
                    },
                    {
                        accountCode: '1120',
                        debit: 0,
                        credit: amount,
                        description: `Clear Accounts Receivable - Order ${orderId}`
                    }
                ]
            }, tx);

            return postResult.entry;
        };

        if (externalTx) return await runWithTx(externalTx);
        return await prisma.$transaction(async (tx) => runWithTx(tx), { maxWait: 10000, timeout: 30000 });
    }

    /**
     * 5. Cancellations & Forfeited Deposits (Ruling 19 & 20)
     */
    async recordOrderCancellation(tenantId, orderId, cancellationType, details = {}, externalTx = null) {
        const runWithTx = async (tx) => {
            const order = await tx.order.findFirst({
                where: { id: orderId, tenantId },
                include: { payments: true }
            });

            if (!order) throw new Error(`Order ${orderId} not found`);

            const depositAmount = order.payments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
            const cancelDate = details.cancellationDate || details.entryDate || details.date || new Date();

            switch (cancellationType) {
                // Case 1: Cancelled before baking, deposit forfeited (Ruling 19)
                // Money kept, cake never made.
                // Dr 2120 Customer Deposits / Cr 7030 Forfeited Deposits
                case 'FORFEITED_BEFORE_BAKE': {
                    if (depositAmount <= 0) break;
                    await postingService.postJournalEntry({
                        tenantId,
                        entryDate: cancelDate,
                        sourceType: 'order_cancellation',
                        sourceId: orderId,
                        memo: `Order ${orderId} cancelled before bake - deposit forfeited to 7030`,
                        lines: [
                            {
                                accountCode: '2120',
                                debit: depositAmount,
                                credit: 0,
                                description: `Clear deposit for cancelled Order ${orderId}`
                            },
                            {
                                accountCode: '7030',
                                debit: 0,
                                credit: depositAmount,
                                description: `Forfeited customer deposit (Other Revenue) - Order ${orderId}`
                            }
                        ]
                    }, tx);
                    break;
                }

                // Case 2: Cancelled before baking, deposit refunded
                // Dr 2120 Customer Deposits / Cr 1110 Bank
                case 'REFUNDED_BEFORE_BAKE': {
                    const refundAmount = parseFloat(details.refundAmount || depositAmount);
                    if (refundAmount <= 0) break;
                    await postingService.postJournalEntry({
                        tenantId,
                        entryDate: cancelDate,
                        sourceType: 'order_cancellation',
                        sourceId: orderId,
                        memo: `Order ${orderId} cancelled before bake - deposit refunded`,
                        lines: [
                            {
                                accountCode: '2120',
                                debit: refundAmount,
                                credit: 0,
                                description: `Reverse customer deposit for cancelled Order ${orderId}`
                            },
                            {
                                accountCode: '1110',
                                debit: 0,
                                credit: refundAmount,
                                description: `Bank refund for cancelled Order ${orderId}`
                            }
                        ]
                    }, tx);
                    break;
                }

                // Case 3: Cancelled inside no-refund window, already baked (Ruling 19, 20)
                // Customer retains ownership of cake -> full delivery entry (remains delivered, isForfeited: true)
                case 'CANCELLED_INSIDE_NO_REFUND_AFTER_BAKE': {
                    const deliveredResult = await this.recordOrderDelivered(tenantId, orderId, {
                        isForfeited: true,
                        deliveryDate: cancelDate
                    }, tx);
                    return deliveredResult.order;
                }

                // Case 4: Cancelled after baking, refunded as goodwill
                // Dr 2120 Customer Deposits, Cr 1110 Bank (refund)
                // Dr 5040 Spoilage & Waste, Cr 1160 Finished Goods (write-off)
                case 'REFUNDED_AFTER_BAKE_GOODWILL': {
                    const refundAmount = parseFloat(details.refundAmount || depositAmount);
                    const spoiledCost = parseFloat(details.cost || order.totalCost || 0);

                    const lines = [];
                    if (refundAmount > 0) {
                        lines.push(
                            { accountCode: '2120', debit: refundAmount, credit: 0, description: `Goodwill refund - Order ${orderId}` },
                            { accountCode: '1110', debit: 0, credit: refundAmount, description: `Bank refund to customer - Order ${orderId}` }
                        );
                    }
                    if (spoiledCost > 0) {
                        lines.push(
                            { accountCode: '5040', debit: spoiledCost, credit: 0, description: `Spoilage & waste write-off - Order ${orderId}` },
                            { accountCode: '1160', debit: 0, credit: spoiledCost, description: `Write-off unsold finished goods - Order ${orderId}` }
                        );
                    }

                    if (lines.length >= 2) {
                        await postingService.postJournalEntry({
                            tenantId,
                            entryDate: cancelDate,
                            sourceType: 'order_cancellation',
                            sourceId: orderId,
                            memo: `Order ${orderId} cancelled after bake with goodwill refund and spoilage write-off`,
                            lines
                        }, tx);
                    }
                    break;
                }

                // Case 5: Spoilage / collapse write-off
                case 'PRODUCTION_FAILURE': {
                    const cost = parseFloat(details.cost || order.totalCost || 0);
                    if (cost > 0) {
                        await postingService.postJournalEntry({
                            tenantId,
                            entryDate: cancelDate,
                            sourceType: 'order_cancellation',
                            sourceId: orderId,
                            memo: `Production failure for Order ${orderId} - collapsed cake written off`,
                            lines: [
                                { accountCode: '5040', debit: cost, credit: 0, description: `Collapsed cake written off` },
                                { accountCode: '1160', debit: 0, credit: cost, description: `Relieve finished goods` }
                            ]
                        }, tx);
                    }
                    break;
                }

                default:
                    break;
            }

            // Update order status to cancelled
            return await tx.order.update({
                where: { id: orderId },
                data: { status: 'cancelled' }
            });
        };

        if (externalTx) return await runWithTx(externalTx);
        return await prisma.$transaction(async (tx) => runWithTx(tx), { maxWait: 10000, timeout: 30000 });
    }

    /**
     * 6. Walk-in Sale
     * Immediate counter sale: collapsed into single transaction
     */
    async recordWalkInSale(tenantId, saleData, externalTx = null) {
        const runWithTx = async (tx) => {
            const price = parseFloat(saleData.price || 0);
            const cost = parseFloat(saleData.cost || 0);
            const isCash = String(saleData.paymentMethod || '').toLowerCase() === 'cash';
            const bankOrCash = isCash ? '1100' : '1110';

            const lines = [
                {
                    accountCode: bankOrCash,
                    debit: price,
                    credit: 0,
                    description: `Cash/bank received for walk-in sale`
                },
                {
                    accountCode: '4000',
                    debit: 0,
                    credit: price,
                    description: `Walk-in bakery counter sale`
                }
            ];

            if (cost > 0) {
                lines.push(
                    {
                        accountCode: '5000',
                        debit: cost,
                        credit: 0,
                        description: `Raw materials cost for walk-in sale`
                    },
                    {
                        accountCode: '1140',
                        debit: 0,
                        credit: cost,
                        description: `Raw materials inventory deduction for walk-in sale`
                    }
                );
            }

            const postResult = await postingService.postJournalEntry({
                tenantId,
                entryDate: saleData.date || new Date(),
                sourceType: 'order_delivery',
                sourceId: saleData.id ? String(saleData.id) : null,
                memo: `Walk-in counter sale: ${saleData.description || 'Bakery products'}`,
                lines
            }, tx);

            return postResult.entry;
        };

        if (externalTx) return await runWithTx(externalTx);
        return await prisma.$transaction(async (tx) => runWithTx(tx), { maxWait: 10000, timeout: 30000 });
    }
}

module.exports = new OrderAccountingService();
