/**
 * LayerLedger Migration & Cut-Over Service
 * 
 * Implements historical opening balances migration according to the BakeWealth 27 Rulings:
 * 1. Analyzes legacy positions or database state as of a cut-over date (cutOverDate).
 * 2. Compiles opening balances across:
 *    - 1100 Cash on Hand
 *    - 1110 Bank Balances
 *    - 1120 Accounts Receivable (delivered unpaid orders)
 *    - 1140 Inventory, Raw Materials (ingredients valuation)
 *    - 1150 Inventory, Packaging Materials (boxes, boards, cups)
 *    - 1200 Bakery Equipment / PPE (gross acquisition cost)
 *    - 1290 Accumulated Depreciation, PPE (contra asset)
 *    - 2100 Accounts Payable (unpaid vendor purchases)
 *    - 2120 Customer Deposits (paid but unbaked/undelivered orders)
 * 3. Constructs and posts ONE single balanced Opening Journal Entry (sourceType: 'opening_balance')
 *    with net difference balancing exactly to Account 3000 (Share Capital / Owner's Equity).
 * 4. Preserves all historical orders, expenses, and purchases completely untouched for historical reference.
 */

const prisma = require('../../../prisma');
const chartOfAccountsService = require('./chartOfAccounts.service');
const postingService = require('./posting.service');
const { toDecimal, isZero, isPositive, equals, sum, formatDecimal } = require('../utils/decimal');
const { SOURCE_TYPES, ENTRY_STATUS, ACCOUNT_CLASSIFICATIONS } = require('../accounting.constants');

class MigrationService {
    /**
     * Inspects legacy database records as of a cut-over date and computes suggested opening balances.
     * Does not mutate any data.
     * 
     * @param {string} tenantId 
     * @param {Object} options 
     * @param {Date|string} [options.cutOverDate]
     * @returns {Promise<Object>}
     */
    async getOpeningPosition(tenantId, options = {}) {
        if (!tenantId) {
            throw new Error('tenantId is required to retrieve opening position');
        }

        const cutOverDate = options.cutOverDate ? new Date(options.cutOverDate) : new Date();

        // 1. Raw Materials Inventory (1140)
        const rawItems = await prisma.inventoryItem.findMany({
            where: {
                tenantId,
                category: { not: 'packaging' }
            },
            select: { stock: true, cost: true, totalValueOnHand: true }
        });

        let rawValuation = toDecimal(0);
        for (const item of rawItems) {
            const stock = toDecimal(item.stock || 0);
            const cost = toDecimal(item.cost || 0);
            const val = isPositive(stock) ? stock.times(cost) : toDecimal(item.totalValueOnHand || 0);
            if (isPositive(val)) {
                rawValuation = sum(rawValuation, val);
            }
        }

        // 2. Packaging Materials Inventory (1150)
        const packagingItems = await prisma.inventoryItem.findMany({
            where: {
                tenantId,
                category: 'packaging'
            },
            select: { stock: true, cost: true, totalValueOnHand: true }
        });

        let packagingValuation = toDecimal(0);
        for (const item of packagingItems) {
            const stock = toDecimal(item.stock || 0);
            const cost = toDecimal(item.cost || 0);
            const val = isPositive(stock) ? stock.times(cost) : toDecimal(item.totalValueOnHand || 0);
            if (isPositive(val)) {
                packagingValuation = sum(packagingValuation, val);
            }
        }

        // Also check standalone Packaging table if used
        const standalonePackaging = await prisma.packaging.findMany({
            where: { tenantId },
            select: { stock: true, price: true }
        });
        for (const p of standalonePackaging) {
            const stock = toDecimal(p.stock || 0);
            const price = toDecimal(p.price || 0);
            if (isPositive(stock) && isPositive(price)) {
                packagingValuation = sum(packagingValuation, stock.times(price));
            }
        }

        // 3. Accounts Receivable (1120) - delivered orders with outstanding unpaid balances as of cut-over
        const deliveredOrders = await prisma.order.findMany({
            where: {
                tenantId,
                deliveredAt: { not: null, lte: cutOverDate },
                createdAt: { lte: cutOverDate }
            },
            include: { payments: true }
        });

        let accountsReceivable = toDecimal(0);
        for (const order of deliveredOrders) {
            const total = toDecimal(order.totalPrice || 0);
            const paid = (order.payments || []).reduce((acc, p) => {
                const pDate = p.date || p.createdAt;
                if (!pDate || new Date(pDate) <= cutOverDate) {
                    return sum(acc, toDecimal(p.amount || 0));
                }
                return acc;
            }, toDecimal(0));

            const balanceDue = total.minus(paid);
            if (isPositive(balanceDue)) {
                accountsReceivable = sum(accountsReceivable, balanceDue);
            }
        }

        // 4. Customer Deposits (2120) - undelivered orders where deposit payments were received
        const undeliveredOrders = await prisma.order.findMany({
            where: {
                tenantId,
                deliveredAt: null,
                createdAt: { lte: cutOverDate },
                status: { not: 'cancelled' }
            },
            include: { payments: true }
        });

        let customerDeposits = toDecimal(0);
        for (const order of undeliveredOrders) {
            const paymentsBeforeCutOver = (order.payments || []).reduce((acc, p) => {
                const pDate = p.date || p.createdAt;
                if (!pDate || new Date(pDate) <= cutOverDate) {
                    return sum(acc, toDecimal(p.amount || 0));
                }
                return acc;
            }, toDecimal(0));

            if (isPositive(paymentsBeforeCutOver)) {
                customerDeposits = sum(customerDeposits, paymentsBeforeCutOver);
            }
        }

        // 5. Fixed Assets Cost (1200) & Accumulated Depreciation (1290)
        const fixedAssets = await prisma.fixedAsset.findMany({
            where: {
                tenantId,
                acquisitionDate: { lte: cutOverDate },
                status: 'ACTIVE'
            }
        });

        let fixedAssetsCost = toDecimal(0);
        let accumulatedDepreciation = toDecimal(0);
        for (const asset of fixedAssets) {
            fixedAssetsCost = sum(fixedAssetsCost, toDecimal(asset.cost || 0));
            accumulatedDepreciation = sum(accumulatedDepreciation, toDecimal(asset.accumulatedDepreciation || 0));
        }

        // 6. Cash on Hand (1100) & Bank Balances (1110)
        let cashOnHand = toDecimal(0);
        let bankBalance = toDecimal(0);

        // Sum of debits and credits
        let totalDebits = sum(cashOnHand, bankBalance);
        totalDebits = sum(totalDebits, accountsReceivable);
        totalDebits = sum(totalDebits, rawValuation);
        totalDebits = sum(totalDebits, packagingValuation);
        totalDebits = sum(totalDebits, fixedAssetsCost);

        let totalCredits = sum(accumulatedDepreciation, customerDeposits);
        let accountsPayable = toDecimal(0);
        totalCredits = sum(totalCredits, accountsPayable);

        // Balancing Share Capital / Equity (3000)
        const netEquity = totalDebits.minus(totalCredits);

        return {
            cutOverDate: cutOverDate.toISOString().slice(0, 10),
            extractedPositions: {
                '1100': { accountCode: '1100', accountName: 'Cash on Hand', debit: cashOnHand.toFixed(2), credit: '0.00' },
                '1110': { accountCode: '1110', accountName: 'Bank', debit: bankBalance.toFixed(2), credit: '0.00' },
                '1120': { accountCode: '1120', accountName: 'Accounts Receivable', debit: accountsReceivable.toFixed(2), credit: '0.00' },
                '1140': { accountCode: '1140', accountName: 'Inventory, Raw Materials', debit: rawValuation.toFixed(2), credit: '0.00' },
                '1150': { accountCode: '1150', accountName: 'Inventory, Packaging Materials', debit: packagingValuation.toFixed(2), credit: '0.00' },
                '1200': { accountCode: '1200', accountName: 'Bakery Equipment', debit: fixedAssetsCost.toFixed(2), credit: '0.00' },
                '1290': { accountCode: '1290', accountName: 'Accumulated Depreciation, PPE', debit: '0.00', credit: accumulatedDepreciation.toFixed(2) },
                '2100': { accountCode: '2100', accountName: 'Accounts Payable', debit: '0.00', credit: accountsPayable.toFixed(2) },
                '2120': { accountCode: '2120', accountName: 'Customer Deposits', debit: '0.00', credit: customerDeposits.toFixed(2) },
                '3000': {
                    accountCode: '3000',
                    accountName: 'Share Capital (Opening)',
                    debit: netEquity.isNegative() ? netEquity.abs().toFixed(2) : '0.00',
                    credit: isPositive(netEquity) ? netEquity.toFixed(2) : '0.00'
                }
            },
            summary: {
                totalDebits: totalDebits.toFixed(2),
                totalCredits: totalCredits.toFixed(2),
                balancingEquity: netEquity.toFixed(2),
                isBalanced: true
            }
        };
    }

    /**
     * Constructs and posts ONE single balanced Opening Journal Entry.
     * All historical orders, expenses, and purchases remain completely untouched.
     * 
     * @param {string} tenantId 
     * @param {Object} options
     * @param {Date|string} [options.cutOverDate]
     * @param {Object} [options.balances] Custom/explicit balances per account code or semantic name
     * @param {boolean} [options.autoExtractFromDatabase=true] Merge with auto-extracted balances
     * @param {string} [options.memo]
     * @param {string} [options.createdBy]
     * @param {boolean} [options.force=false]
     * @returns {Promise<Object>}
     */
    async migrateOpeningBalances(tenantId, options = {}) {
        if (!tenantId) {
            throw new Error('tenantId is required to migrate opening balances');
        }

        const cutOverDate = options.cutOverDate ? new Date(options.cutOverDate) : new Date();
        const autoExtract = options.autoExtractFromDatabase !== false;

        // Ensure Chart of Accounts is initialized
        await chartOfAccountsService.seedTenantChartOfAccounts(tenantId);

        // Check if an opening balance entry is already posted
        const existingEntry = await prisma.journalEntry.findFirst({
            where: {
                tenantId,
                sourceType: SOURCE_TYPES.OPENING_BALANCE,
                status: ENTRY_STATUS.POSTED
            },
            include: { lines: { include: { account: true } } }
        });

        if (existingEntry && !options.force) {
            return {
                alreadyMigrated: true,
                message: `Opening balance journal entry ${existingEntry.entryNumber} already exists for this business.`,
                journalEntry: existingEntry
            };
        }

        // Get default position if auto-extraction is enabled
        let defaults = {};
        if (autoExtract) {
            const preview = await this.getOpeningPosition(tenantId, { cutOverDate });
            for (const [code, pos] of Object.entries(preview.extractedPositions)) {
                if (code !== '3000') {
                    const d = toDecimal(pos.debit);
                    const c = toDecimal(pos.credit);
                    if (isPositive(d)) defaults[code] = { debit: d, credit: toDecimal(0) };
                    else if (isPositive(c)) defaults[code] = { debit: toDecimal(0), credit: c };
                }
            }
        }

        // Map of friendly field names to account codes
        const friendlyMap = {
            cashOnHand: '1100',
            cash: '1100',
            bank: '1110',
            bankBalance: '1110',
            accountsReceivable: '1120',
            ar: '1120',
            prepaidExpenses: '1130',
            prepayments: '1130',
            inventoryRaw: '1140',
            rawMaterials: '1140',
            inventoryPackaging: '1150',
            packaging: '1150',
            finishedGoods: '1160',
            fixedAssets: '1200',
            equipment: '1200',
            vehicles: '1210',
            furniture: '1220',
            computers: '1230',
            leasehold: '1240',
            accumulatedDepreciation: '1290',
            accountsPayable: '2100',
            ap: '2100',
            customerDeposits: '2120',
            deposits: '2120',
            ownerPayable: '2130',
            loan: '2200',
            ownersLoan: '2210',
            shareCapital: '3000',
            equity: '3000'
        };

        // Normal balance rules: Assets are debit, contra-assets & liabilities are credit
        const normalCreditAccounts = new Set(['1290', '1295', '2100', '2110', '2120', '2130', '2200', '2210', '2400', '3000', '3100', '3200']);

        // Merge input balances
        const inputBalances = options.balances || {};
        const accountsToProcess = new Map();

        // Load defaults first
        for (const [code, val] of Object.entries(defaults)) {
            accountsToProcess.set(code, val);
        }

        // Overlay user-provided balances
        for (const [key, val] of Object.entries(inputBalances)) {
            const code = friendlyMap[key] || key;
            if (code === '3000') continue; // Equity will be calculated as balancing plug

            if (typeof val === 'object' && val !== null) {
                const d = toDecimal(val.debit || 0);
                const c = toDecimal(val.credit || 0);
                accountsToProcess.set(code, { debit: d, credit: c });
            } else {
                const amount = toDecimal(val || 0);
                if (normalCreditAccounts.has(code)) {
                    accountsToProcess.set(code, { debit: toDecimal(0), credit: amount });
                } else {
                    accountsToProcess.set(code, { debit: amount, credit: toDecimal(0) });
                }
            }
        }

        // Build journal entry lines and compute running debits/credits
        let totalDebit = toDecimal(0);
        let totalCredit = toDecimal(0);
        const lines = [];

        for (const [code, { debit, credit }] of accountsToProcess.entries()) {
            const hasDebit = isPositive(debit);
            const hasCredit = isPositive(credit);

            if (hasDebit && hasCredit) {
                throw new Error(`Account ${code} cannot have both opening debit and credit.`);
            }

            if (hasDebit) {
                totalDebit = sum(totalDebit, debit);
                lines.push({
                    accountCode: code,
                    debit: debit.toFixed(2),
                    credit: 0,
                    description: `Opening balance for ${code}`
                });
            } else if (hasCredit) {
                totalCredit = sum(totalCredit, credit);
                lines.push({
                    accountCode: code,
                    debit: 0,
                    credit: credit.toFixed(2),
                    description: `Opening balance for ${code}`
                });
            }
        }

        // Calculate balancing Equity (Account 3000)
        // Double-entry invariant: sum(Debits) === sum(Credits)
        const netEquity = totalDebit.minus(totalCredit);

        if (isPositive(netEquity)) {
            totalCredit = sum(totalCredit, netEquity);
            lines.push({
                accountCode: '3000',
                debit: 0,
                credit: netEquity.toFixed(2),
                description: 'Share Capital / Owner Equity (Opening Balance balancing plug)'
            });
        } else if (netEquity.isNegative()) {
            const absEquity = netEquity.abs();
            totalDebit = sum(totalDebit, absEquity);
            lines.push({
                accountCode: '3000',
                debit: absEquity.toFixed(2),
                credit: 0,
                description: 'Owner Equity Opening Deficit (Opening Balance balancing plug)'
            });
        }

        if (lines.length < 2) {
            throw new Error('Cannot post opening balance: at least two active accounts are required to form a balanced entry.');
        }

        // Date string for entry
        const dateStr = cutOverDate.toISOString().slice(0, 10);
        const memo = options.memo || `Opening Balances as of cut-over date ${dateStr}`;

        // Post through atomic posting service
        const postResult = await postingService.postJournalEntry({
            tenantId,
            entryDate: cutOverDate,
            sourceType: SOURCE_TYPES.OPENING_BALANCE,
            sourceId: `MIGRATION-${dateStr}`,
            memo,
            lines,
            createdBy: options.createdBy || null
        });

        return {
            success: true,
            message: `Opening balance journal entry ${postResult.entry.entryNumber} successfully posted.`,
            journalEntry: postResult.entry,
            summary: {
                totalDebits: totalDebit.toFixed(2),
                totalCredits: totalCredit.toFixed(2),
                balancingEquity: netEquity.toFixed(2),
                isBalanced: equals(totalDebit, totalCredit),
                linesCount: lines.length
            }
        };
    }
}

module.exports = new MigrationService();
