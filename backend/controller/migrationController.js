const prisma = require('../prisma');
const { asyncHandler } = require('../middleware/custommiddleware');

/**
 * @desc    Migrate legacy browser storage data into PostgreSQL
 * @route   POST /api/migrate-legacy
 * @access  Private
 */
const migrateLegacyData = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const {
        inventory = [],
        recipes = [],
        orders = [],
        invoices = [],
        expenses = [],
        purchases = [],
        transactions = [],
        settings = {}
    } = req.body;

    let migratedCounts = {
        inventory: 0,
        recipes: 0,
        orders: 0,
        invoices: 0,
        expenses: 0,
        purchases: 0,
        transactions: 0
    };

    // 1. Inventory Items
    for (const item of inventory) {
        if (!item.id && !item.name) continue;
        const itemId = item.id || `inv_${Math.random().toString(36).slice(2, 9)}`;
        const existing = await prisma.inventoryItem.findFirst({
            where: { tenantId, id: itemId }
        });
        if (!existing) {
            await prisma.inventoryItem.create({
                data: {
                    id: itemId,
                    tenantId,
                    name: item.name || item.cat || 'Item',
                    category: item.cat || 'Other',
                    unit: item.unit || 'unit',
                    cost: Number(item.cost) || 0,
                    stock: Number(item.stock) || 0,
                    minStock: Number(item.minStock) || 0
                }
            });
            migratedCounts.inventory++;
        }
    }

    // 2. Recipes
    for (const rec of recipes) {
        if (!rec.id && !rec.name) continue;
        const recId = rec.id || `rec_${Math.random().toString(36).slice(2, 9)}`;
        const existing = await prisma.recipe.findFirst({
            where: { tenantId, id: recId }
        });
        if (!existing) {
            await prisma.recipe.create({
                data: {
                    id: recId,
                    tenantId,
                    name: rec.name || 'Recipe',
                    notes: rec.notes || '',
                    type: rec.type || 'layer',
                    batchWeight: rec.batchWeight ? Number(rec.batchWeight) : null,
                    batchSize: rec.batchSize ? Number(rec.batchSize) : null
                }
            });
            migratedCounts.recipes++;
        }
    }

    // 3. Orders / Quotes
    for (const o of orders) {
        if (!o.id) continue;
        const oId = o.id;
        const existing = await prisma.order.findFirst({
            where: { tenantId, id: oId }
        });
        if (!existing) {
            await prisma.order.create({
                data: {
                    id: oId,
                    tenantId,
                    status: o.status || 'quote',
                    totalPrice: Number(o.salePrice || 0),
                    totalCost: Number(o.cost || 0),
                    notes: o.notes || '',
                    metadata: o
                }
            });
            migratedCounts.orders++;
        }
    }

    // 4. Invoices
    for (const inv of invoices) {
        if (!inv.id) continue;
        const invId = inv.id;
        const existing = await prisma.invoice.findFirst({
            where: { tenantId, id: invId }
        });
        if (!existing) {
            await prisma.invoice.create({
                data: {
                    id: invId,
                    tenantId,
                    orderId: inv.quoteId || invId,
                    invoiceNumber: inv.invoiceNumber || invId,
                    status: inv.status || 'unpaid',
                    notes: inv.notes || ''
                }
            });
            migratedCounts.invoices++;
        }
    }

    // 5. Expenses
    for (const exp of expenses) {
        if (!exp.id && !exp.amount) continue;
        const expId = exp.id || `exp_${Math.random().toString(36).slice(2, 9)}`;
        const existing = await prisma.expense.findFirst({
            where: { tenantId, id: expId }
        });
        if (!existing) {
            await prisma.expense.create({
                data: {
                    id: expId,
                    tenantId,
                    date: exp.date ? new Date(exp.date) : new Date(),
                    amount: Number(exp.amount) || 0,
                    category: exp.category || 'Miscellaneous',
                    description: exp.description || '',
                    receiptUrl: exp.receiptUrl || ''
                }
            });
            migratedCounts.expenses++;
        }
    }

    // 4. Purchases
    for (const pur of purchases) {
        if (!pur.id && !pur.total && !pur.amount) continue;
        const purId = pur.id || `pur_${Math.random().toString(36).slice(2, 9)}`;
        const existing = await prisma.purchase.findFirst({
            where: { tenantId, id: purId }
        });
        if (!existing) {
            await prisma.purchase.create({
                data: {
                    id: purId,
                    tenantId,
                    date: pur.date ? new Date(pur.date) : new Date(),
                    supplier: pur.supplier || 'Market Run',
                    amount: Number(pur.total || pur.amount) || 0,
                    receiptUrl: pur.receiptUrl || '',
                    notes: pur.item || pur.notes || '',
                    unitSize: pur.unitSize ? Number(pur.unitSize) : null,
                    qty: pur.qty ? Number(pur.qty) : null,
                    price: pur.price ? Number(pur.price) : null,
                    total: pur.total ? Number(pur.total) : null,
                    cpu: pur.cpu ? Number(pur.cpu) : null,
                    stockAdded: pur.stockAdded ? Number(pur.stockAdded) : null
                }
            });
            migratedCounts.purchases++;
        }
    }

    // 5. Transactions
    for (const txn of transactions) {
        if (!txn.id && !txn.amount) continue;
        const txnId = txn.id || `txn_${Math.random().toString(36).slice(2, 9)}`;
        const existing = await prisma.transaction.findFirst({
            where: { tenantId, id: txnId }
        });
        if (!existing) {
            await prisma.transaction.create({
                data: {
                    id: txnId,
                    tenantId,
                    date: txn.date ? new Date(txn.date) : new Date(),
                    description: txn.description || 'Transaction',
                    amount: Number(txn.amount) || 0,
                    type: txn.type || 'expense',
                    category: txn.category || null,
                    reference: txn.reference || null
                }
            });
            migratedCounts.transactions++;
        }
    }

    // 6. Tenant settings & Business Profile
    if (Object.keys(settings).length > 0) {
        const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
        if (tenant) {
            const currentSettings = tenant.settings || {};
            await prisma.tenant.update({
                where: { id: tenantId },
                data: {
                    settings: {
                        ...currentSettings,
                        ...settings
                    }
                }
            });
        }
    }

    res.json({
        message: 'Legacy migration complete',
        migratedCounts
    });
});

module.exports = {
    migrateLegacyData
};
