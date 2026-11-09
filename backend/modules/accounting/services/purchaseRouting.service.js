/**
 * LayerLedger Purchase & Expense Routing Service
 * Implements 3-Way Destination Routing (Ruling on Purchases, Prepayments & Fixed Assets):
 * 1. Inventory: 1140 Raw Materials or 1150 Packaging
 * 2. Expenses: 5xxx Production or 6xxx Admin Expense
 * 3. Fixed Assets: 12xx PPE (qualifies if >= capitalisation threshold, default ₦50,000)
 */

const prisma = require('../../../prisma');
const postingService = require('./posting.service');
const reversalService = require('./reversal.service');
const chartOfAccountsService = require('./chartOfAccounts.service');
const { DEFAULT_CAPITALISATION_THRESHOLD, DEFAULT_USEFUL_LIFE_MONTHS } = require('../accounting.constants');

class PurchaseRoutingService {
    /**
     * Resolve the tenant's configured capitalisation threshold (default ₦50,000)
     */
    async getCapitalisationThreshold(tenantId, tx = null) {
        const client = tx || prisma;
        const tenant = await client.tenant.findUnique({
            where: { id: tenantId },
            select: { settings: true }
        });
        const settings = tenant?.settings || {};
        const customThreshold = settings.capitalisationThreshold || settings.accounting?.capitalisationThreshold;
        return typeof customThreshold === 'number' && customThreshold > 0
            ? customThreshold
            : DEFAULT_CAPITALISATION_THRESHOLD;
    }

    /**
     * Intelligent 3-way destination classification
     */
    async classifyPurchaseDestination(tenantId, itemData, tx = null) {
        const {
            itemId = null,
            name = '',
            category = '',
            amount = 0,
            explicitDestination = null,
            explicitAccountCode = null
        } = itemData;

        // If explicitly linked to an inventory ingredient item
        if (itemId) {
            return {
                destination: 'inventory',
                accountCode: '1140',
                isFixedAsset: false
            };
        }

        // If explicit destination specified by user/caller
        if (explicitDestination && explicitDestination !== 'auto') {
            let code = explicitAccountCode;
            if (!code) {
                if (explicitDestination === 'fixed_asset') code = '1200';
                else if (explicitDestination === 'packaging') code = '1150';
                else if (explicitDestination === 'inventory') code = '1140';
                else code = '5030';
            }
            return {
                destination: explicitDestination === 'packaging' ? 'inventory' : explicitDestination,
                accountCode: code,
                isFixedAsset: explicitDestination === 'fixed_asset'
            };
        }

        const threshold = await this.getCapitalisationThreshold(tenantId, tx);
        const itemName = String(name || '').toLowerCase();
        const itemCategory = String(category || '').toLowerCase();

        // 1. Check for Equipment Keyword
        const isEquipmentKeyword =
            itemName.includes('mixer') ||
            itemName.includes('oven') ||
            itemName.includes('fridge') ||
            itemName.includes('refrigerator') ||
            itemName.includes('chiller') ||
            itemName.includes('freezer') ||
            itemName.includes('prover') ||
            itemName.includes('generator') ||
            itemName.includes('van') ||
            itemName.includes('vehicle') ||
            itemName.includes('bike') ||
            itemName.includes('laptop') ||
            itemName.includes('tablet') ||
            itemName.includes('printer') ||
            itemCategory.includes('equipment') ||
            itemCategory.includes('machinery');

        if (isEquipmentKeyword) {
            if (amount >= threshold) {
                let assetCode = '1200'; // Bakery Equipment
                let assetCategory = 'bakery_equipment';

                if (itemName.includes('van') || itemName.includes('vehicle') || itemName.includes('bike')) {
                    assetCode = '1210';
                    assetCategory = 'motor_vehicles';
                } else if (itemName.includes('table') || itemName.includes('shelf') || itemName.includes('furniture')) {
                    assetCode = '1220';
                    assetCategory = 'furniture';
                } else if (itemName.includes('laptop') || itemName.includes('computer') || itemName.includes('pos')) {
                    assetCode = '1230';
                    assetCategory = 'computers';
                }

                return {
                    destination: 'fixed_asset',
                    accountCode: assetCode,
                    assetCategory,
                    isFixedAsset: true
                };
            } else {
                // Below threshold: Ruling 13: Below it, straight to expense.
                return {
                    destination: 'expense',
                    accountCode: '5030', // Bakery Consumables
                    isFixedAsset: false
                };
            }
        }

        // 2. Raw Materials / Ingredients (1140)
        const isIngredient =
            itemCategory.includes('ingredient') ||
            itemCategory.includes('flour') ||
            itemCategory.includes('dairy') ||
            itemCategory.includes('sugar') ||
            itemName.includes('flour') ||
            itemName.includes('butter') ||
            itemName.includes('sugar') ||
            itemName.includes('egg') ||
            itemName.includes('milk') ||
            itemName.includes('oil') ||
            itemName.includes('yeast') ||
            itemName.includes('cocoa') ||
            itemName.includes('flavor');

        if (isIngredient) {
            return {
                destination: 'inventory',
                accountCode: '1140',
                isFixedAsset: false
            };
        }

        // 3. Packaging Materials (1150)
        const isPackaging =
            itemCategory.includes('packaging') ||
            itemName.includes('cake box') ||
            itemName.includes('box') ||
            itemName.includes('board') ||
            itemName.includes('cup') ||
            itemName.includes('carrier') ||
            itemName.includes('ribbon');

        if (isPackaging) {
            return {
                destination: 'inventory',
                accountCode: '1150',
                isFixedAsset: false
            };
        }

        // 4. Fallback to operating expense (5030 Bakery Consumables)
        return {
            destination: 'expense',
            accountCode: '5030',
            isFixedAsset: false
        };
    }

    /**
     * Map expense categories to appropriate chart of accounts codes
     */
    mapExpenseCategoryToAccount(category = '') {
        const cat = String(category).toLowerCase().trim();
        if (cat.includes('fuel') || cat.includes('diesel') || cat.includes('petrol') || cat.includes('vehicle')) return '6080';
        if (cat.includes('salary') || cat.includes('wage')) return '6000';
        if (cat.includes('production rent') || cat.includes('bakery rent')) return '5070';
        if (cat.includes('rent')) return '6010'; // default admin rent; production rent is 5070
        if (cat.includes('consumable') || cat.includes('baking paper')) return '5030';
        if (cat.includes('spoil') || cat.includes('waste')) return '5040';
        if (cat.includes('production gas') || cat.includes('oven gas')) return '5050';
        if (cat.includes('utilit') || cat.includes('power') || cat.includes('electric')) return '6020';
        if (cat.includes('office') || cat.includes('stationery')) return '6030';
        if (cat.includes('repair') || cat.includes('maintenance')) return '6040';
        if (cat.includes('internet') || cat.includes('data') || cat.includes('phone') || cat.includes('communication')) return '6050';
        if (cat.includes('insurance')) return '6060';
        if (cat.includes('transport') || cat.includes('dispatch') || cat.includes('logistics')) return '6070';
        if (cat.includes('ad') || cat.includes('market') || cat.includes('promot')) return '6100';
        if (cat.includes('commission')) return '6120';
        if (cat.includes('welfare') || cat.includes('medical') || cat.includes('staff meal')) return '6200';
        if (cat.includes('training')) return '6210';
        if (cat.includes('benefit')) return '6220';
        if (cat.includes('legal') || cat.includes('accountant') || cat.includes('audit')) return '6300';
        if (cat.includes('nafdac') || cat.includes('cac') || cat.includes('tax') || cat.includes('levy')) return '6320';
        if (cat.includes('bank charge') || cat.includes('sms')) return '8000';
        if (cat.includes('interest')) return '8010';
        if (cat.includes('fine') || cat.includes('penalty')) return '8020';
        return '6030'; // General Office Supplies / Admin Expense
    }

    /**
     * Record accounting entry for a commercial purchase
     */
    async recordPurchaseAccounting(tenantId, purchase, options = {}, externalTx = null) {
        const runWithTx = async (tx) => {
            const amount = parseFloat(purchase.amount || purchase.total || 0);
            if (amount <= 0) return null;

            const classification = await this.classifyPurchaseDestination(tenantId, {
                itemId: purchase.itemId,
                name: purchase.notes || purchase.supplier || '',
                category: options.category || '',
                amount,
                explicitDestination: options.destination || (purchase.destination && purchase.destination !== 'inventory' ? purchase.destination : null),
                explicitAccountCode: options.accountCode
            }, tx);

            // Determine credit account (payment method)
            // Default 1110 Bank, or 1100 Cash on Hand if cash payment, or 2100 Accounts Payable if unpaid
            let creditAccountCode = '1110';
            if (options.paymentMethod === 'cash') {
                creditAccountCode = '1100';
            } else if (options.isCreditPurchase || options.paymentStatus === 'unpaid') {
                creditAccountCode = '2100';
            }

            let fixedAssetRecord = null;
            if (classification.destination === 'fixed_asset') {
                const assetAccount = await chartOfAccountsService.getAccountByCode(tenantId, classification.accountCode, tx);
                fixedAssetRecord = await tx.fixedAsset.create({
                    data: {
                        tenantId,
                        assetAccountId: assetAccount.id,
                        name: purchase.notes || `${purchase.supplier || 'Vendor'} Equipment`,
                        assetCategory: classification.assetCategory || 'bakery_equipment',
                        acquisitionDate: purchase.date || new Date(),
                        cost: amount,
                        residualValue: 0,
                        usefulLifeMonths: options.usefulLifeMonths || DEFAULT_USEFUL_LIFE_MONTHS,
                        depreciationMethod: 'STRAIGHT_LINE',
                        useType: options.useType || 'production',
                        accumulatedDepreciation: 0,
                        netBookValue: amount,
                        status: 'ACTIVE',
                        purchaseId: purchase.id
                    }
                });
            }

            const postResult = await postingService.postJournalEntry({
                tenantId,
                entryDate: purchase.date || new Date(),
                sourceType: 'purchase',
                sourceId: purchase.id,
                memo: `Purchase: ${purchase.supplier || 'Vendor'} - ${purchase.notes || 'Goods/Services'}`,
                lines: [
                    {
                        accountCode: classification.accountCode,
                        debit: amount,
                        credit: 0,
                        description: `Purchase of ${purchase.notes || 'Supplies'}`
                    },
                    {
                        accountCode: creditAccountCode,
                        debit: 0,
                        credit: amount,
                        description: `Payment for purchase ${purchase.id}`
                    }
                ]
            }, tx);

            // Update purchase record with accounting metadata
            await tx.purchase.update({
                where: { id: purchase.id },
                data: {
                    destination: classification.destination,
                    journalEntryId: postResult.entry.id,
                    fixedAssetId: fixedAssetRecord ? fixedAssetRecord.id : undefined
                }
            });

            return {
                journalEntry: postResult.entry,
                fixedAsset: fixedAssetRecord,
                destination: classification.destination
            };
        };

        if (externalTx) {
            return await runWithTx(externalTx);
        }

        return await prisma.$transaction(async (tx) => {
            return await runWithTx(tx);
        }, { maxWait: 10000, timeout: 30000 });
    }

    /**
     * Record accounting entry for an operating expense
     */
    async recordExpenseAccounting(tenantId, expense, options = {}, externalTx = null) {
        const runWithTx = async (tx) => {
            const amount = parseFloat(expense.amount || 0);
            if (amount <= 0) return null;

            const debitAccountCode = expense.accountCode || options.accountCode || this.mapExpenseCategoryToAccount(expense.category);

            let creditAccountCode = '1110';
            if (options.paymentMethod === 'cash') {
                creditAccountCode = '1100';
            } else if (options.isPayable) {
                creditAccountCode = '2100';
            }

            const postResult = await postingService.postJournalEntry({
                tenantId,
                entryDate: expense.date || new Date(),
                sourceType: 'expense',
                sourceId: expense.id,
                memo: `Expense: ${expense.category} - ${expense.description || ''}`.trim(),
                lines: [
                    {
                        accountCode: debitAccountCode,
                        debit: amount,
                        credit: 0,
                        description: expense.description || expense.category
                    },
                    {
                        accountCode: creditAccountCode,
                        debit: 0,
                        credit: amount,
                        description: `Payment for ${expense.category}`
                    }
                ]
            }, tx);

            await tx.expense.update({
                where: { id: expense.id },
                data: {
                    accountCode: debitAccountCode,
                    journalEntryId: postResult.entry.id
                }
            });

            return {
                journalEntry: postResult.entry,
                accountCode: debitAccountCode
            };
        };

        if (externalTx) {
            return await runWithTx(externalTx);
        }

        return await prisma.$transaction(async (tx) => {
            return await runWithTx(tx);
        }, { maxWait: 10000, timeout: 30000 });
    }

    /**
     * Reverse and clean up when a purchase is updated or deleted
     */
    async handlePurchaseCleanup(tenantId, purchaseId, reason = 'Purchase voided', userId = null, externalTx = null) {
        const runWithTx = async (tx) => {
            await reversalService.reverseBySource(tenantId, 'purchase', purchaseId, reason, userId, tx);
            // If fixed asset was created, mark it disposed
            await tx.fixedAsset.updateMany({
                where: { tenantId, purchaseId },
                data: { status: 'DISPOSED' }
            });
        };

        if (externalTx) {
            return await runWithTx(externalTx);
        }

        return await prisma.$transaction(async (tx) => {
            return await runWithTx(tx);
        });
    }

    /**
     * Reverse and clean up when an expense is updated or deleted
     */
    async handleExpenseCleanup(tenantId, expenseId, reason = 'Expense voided', userId = null, externalTx = null) {
        return await reversalService.reverseBySource(tenantId, 'expense', expenseId, reason, userId, externalTx);
    }
}

module.exports = new PurchaseRoutingService();
