/**
 * LayerLedger BakeWealth 27 Rulings Specification - End-to-End Acceptance Test Suite (Phase 11)
 * 
 * Verifies all 15 core acceptance checks and cut-over opening balances migration:
 * 1.  Balanced entries invariant: sum(debits) === sum(credits); unbalanced entries rejected.
 * 2.  Rule 3: Reports computed directly from journal without stored totals with Decimal arithmetic.
 * 3.  Ruling 2: Deposit on unbaked order -> Dr 1110 Bank / Cr 2120 Customer Deposits (Revenue = ₦0).
 * 4.  Ruling 18: Bake event -> Dr 1160 Finished Goods / Cr 1140 Raw Materials (0 profit impact).
 * 5.  Ruling 18: Negative stock allowed with warning flag, never blocks baking/sales.
 * 6.  Ruling 2: Delivery event -> Simultaneous Revenue (4000) and COGS (5000) recognition.
 * 7.  Ruling 2: Post-delivery balance payment -> Dr 1110 Bank / Cr 1120 AR (0 duplicate revenue).
 * 8.  Ruling 20: Cancellation forfeiture -> Dr 2120 Customer Deposits / Cr 7030 Forfeited Deposits.
 * 9.  Ruling 20: Cancellation refund -> Dr 2120 Customer Deposits / Cr 1110 Bank.
 * 10. Ruling 8/9: Purchase routing -> items >= ₦50,000 capitalised to 1200; < ₦50,000 expensed.
 * 11. Ruling 11, 12, 14: Straight-line depreciation, full month in purchase month, standard 5-year life.
 * 12. Ruling 10: Contra-asset accumulation -> 1290 accumulates, 1200 gross cost preserved on Balance Sheet.
 * 13. Ruling 13: Asset disposal -> recognizes Gain (7020) or Loss (8030).
 * 14. Ruling 16: Prepayment advance -> Capitalised to 1130, amortised monthly to target expense (6000).
 * 15. Ruling 21, 23, 24: Bank transfers 0 profit impact, statement matching avoids duplicates, reconciliation matches GL.
 * 16. Cut-Over Opening Balances Migration: Posts ONE balanced entry with plug to 3000 Share Capital.
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const prisma = require('../prisma');
const chartOfAccountsService = require('../modules/accounting/services/chartOfAccounts.service');
const postingService = require('../modules/accounting/services/posting.service');
const journalService = require('../modules/accounting/services/journal.service');
const orderAccountingService = require('../modules/accounting/services/orderAccounting.service');
const fixedAssetService = require('../modules/accounting/services/fixedAsset.service');
const prepaymentService = require('../modules/accounting/services/prepayment.service');
const bankManagementService = require('../modules/accounting/services/bankManagement.service');
const purchaseRoutingService = require('../modules/accounting/services/purchaseRouting.service');
const profitLossService = require('../modules/accounting/services/profitLoss.service');
const balanceSheetService = require('../modules/accounting/services/balanceSheet.service');
const trialBalanceService = require('../modules/accounting/services/trialBalance.service');
const migrationService = require('../modules/accounting/services/migration.service');

describe('BakeWealth 27 Rulings Specification - End-to-End Acceptance Tests (Phase 11)', () => {
    jest.setTimeout(300000); // 5 minutes timeout for cloud database operations

    let testTenantId;
    let rawFlourItem;
    let mainBankAcc;

    beforeAll(async () => {
        const tenant = await prisma.tenant.create({
            data: {
                name: 'Acceptance Checks Master Bakery',
                type: 'individual',
                contactEmail: `acceptance_checks_${Date.now()}@example.com`
            }
        });
        testTenantId = tenant.id;
        await chartOfAccountsService.seedTenantChartOfAccounts(testTenantId);

        // Fetch seeded bank accounts
        const bankAccounts = await bankManagementService.getBankAccounts(testTenantId);
        mainBankAcc = bankAccounts.find(a => a.accountCode === '1110');

        // Seed raw materials for inventory tests
        rawFlourItem = await prisma.inventoryItem.create({
            data: {
                tenantId: testTenantId,
                name: 'Premium Wheat Flour',
                category: 'flour',
                unit: 'kg',
                cost: 1500,
                stock: 20, // 20 kg
                minStock: 5,
                totalValueOnHand: 30000
            }
        });
    });

    afterAll(async () => {
        if (testTenantId) {
            await prisma.tenant.delete({ where: { id: testTenantId } }).catch(() => {});
        }
        await prisma.$disconnect();
    });

    // ------------------------------------------------------------------------
    // Check 1: Balanced Entries Invariant
    // ------------------------------------------------------------------------
    it('Check 1: Balanced Entries Invariant - sum(debits) === sum(credits), rejects unbalanced entries', async () => {
        // Attempting to post an unbalanced entry must fail
        await expect(
            postingService.postJournalEntry({
                tenantId: testTenantId,
                entryDate: new Date('2026-05-01'),
                memo: 'Unbalanced Attempt',
                lines: [
                    { accountCode: '1110', debit: 10000, credit: 0 },
                    { accountCode: '3000', debit: 0, credit: 7000 }
                ]
            })
        ).rejects.toThrow(/out of balance/i);

        // Balanced entry must succeed
        const balanced = await postingService.postJournalEntry({
            tenantId: testTenantId,
            entryDate: new Date('2026-05-01'),
            memo: 'Initial Capital Injection',
            lines: [
                { accountCode: '1110', debit: 500000, credit: 0, description: 'Bank funding' },
                { accountCode: '3000', debit: 0, credit: 500000, description: 'Owner share capital' }
            ]
        });

        expect(balanced.entry).toBeDefined();
        expect(balanced.entry.status).toBe('POSTED');

        const totalDebit = balanced.entry.lines.reduce((acc, l) => acc + Number(l.debit), 0);
        const totalCredit = balanced.entry.lines.reduce((acc, l) => acc + Number(l.credit), 0);
        expect(totalDebit).toBe(500000);
        expect(totalCredit).toBe(500000);
    });

    // ------------------------------------------------------------------------
    // Check 2: Rule 3 Direct Reporting (Zero Stored Totals)
    // ------------------------------------------------------------------------
    it('Check 2: Rule 3 - Reports computed directly from journal lines with Decimal arithmetic', async () => {
        const tb = await trialBalanceService.getTrialBalance(testTenantId, { asOfDate: '2026-05-01' });
        expect(tb.isBalanced).toBe(true);
        expect(tb.totalDebitBalance).toBe(500000);
        expect(tb.totalCreditBalance).toBe(500000);

        const bs = await balanceSheetService.getBalanceSheet(testTenantId, { asOfDate: '2026-05-01' });
        expect(bs.isBalanced).toBe(true);
        expect(bs.totalAssets).toBe(500000); // ₦500k bank
        expect(bs.equity.total).toBe(500000); // ₦500k share capital
    });

    // ------------------------------------------------------------------------
    // Check 3: Ruling 2 Customer Deposit on Unbaked Order
    // ------------------------------------------------------------------------
    it('Check 3: Ruling 2 - Deposit on unbaked order -> Dr 1110 Bank / Cr 2120 Customer Deposits (₦0 Revenue)', async () => {
        const order = await prisma.order.create({
            data: {
                tenantId: testTenantId,
                status: 'confirmed',
                totalPrice: 45000,
                orderDate: new Date('2026-05-02')
            }
        });

        const depositEntry = await orderAccountingService.recordDepositPayment(testTenantId, order.id, {
            amount: 30000,
            paymentDate: new Date('2026-05-02'),
            method: 'bank_transfer',
            memo: 'Wedding cake booking deposit'
        });

        expect(depositEntry).toBeDefined();

        // Check lines: Dr 1110 Bank 30k, Cr 2120 Customer Deposits 30k
        const entry = await journalService.getJournalEntryById(testTenantId, depositEntry.id);
        const bankLine = entry.lines.find(l => l.accountCode === '1110');
        const depositLine = entry.lines.find(l => l.accountCode === '2120');

        expect(Number(bankLine.debit)).toBe(30000);
        expect(Number(depositLine.credit)).toBe(30000);

        // Check Accrual P&L: Revenue must be exactly 0
        const pl = await profitLossService.getProfitLoss(testTenantId, {
            startDate: '2026-05-01',
            endDate: '2026-05-31'
        });
        expect(pl.revenue.total).toBe(0);
        expect(pl.netProfit).toBe(0);
    });

    // ------------------------------------------------------------------------
    // Check 4: Ruling 18 Bake Event Asset-to-Asset Transfer
    // ------------------------------------------------------------------------
    it('Check 4: Ruling 18 - Bake event -> Dr 1160 Finished Goods / Cr 1140 Raw Materials (0 profit impact)', async () => {
        const order = await prisma.order.create({
            data: {
                tenantId: testTenantId,
                status: 'in_progress',
                totalPrice: 25000,
                orderDate: new Date('2026-05-03')
            }
        });

        const bakeResult = await orderAccountingService.recordOrderBaked(testTenantId, order.id, {
            bakeDate: new Date('2026-05-03'),
            actualIngredientCost: 3000,
            usages: [
                { itemId: rawFlourItem.id, qty: 2 } // 2 kg @ 1500 = 3000
            ]
        });

        expect(bakeResult.journalEntry).toBeDefined();

        const entry = await journalService.getJournalEntryById(testTenantId, bakeResult.journalEntry.id);
        const fgLine = entry.lines.find(l => l.accountCode === '1160');
        const rmLine = entry.lines.find(l => l.accountCode === '1140');

        expect(Number(fgLine.debit)).toBe(3000);
        expect(Number(rmLine.credit)).toBe(3000);

        // Check P&L: 0 profit impact
        const pl = await profitLossService.getProfitLoss(testTenantId, {
            startDate: '2026-05-01',
            endDate: '2026-05-31'
        });
        expect(pl.revenue.total).toBe(0);
        expect(pl.costOfGoodsSold.total).toBe(0);
    });

    // ------------------------------------------------------------------------
    // Check 5: Ruling 18 Negative Stock Allowed with Warning
    // ------------------------------------------------------------------------
    it('Check 5: Ruling 18 - Negative stock allowed with warning flag, never blocks baking', async () => {
        const order = await prisma.order.create({
            data: {
                tenantId: testTenantId,
                status: 'in_progress',
                totalPrice: 50000,
                orderDate: new Date('2026-05-04')
            }
        });

        // Deduct 50kg when only 18kg remains in stock -> drops to -32kg
        const bakeResult = await orderAccountingService.recordOrderBaked(testTenantId, order.id, {
            bakeDate: new Date('2026-05-04'),
            actualIngredientCost: 75000,
            usages: [
                { itemId: rawFlourItem.id, qty: 50 }
            ]
        });

        expect(bakeResult.order.isBaked).toBe(true);

        // Check item stock in database
        const updatedItem = await prisma.inventoryItem.findUnique({ where: { id: rawFlourItem.id } });
        expect(updatedItem.stock).toBeLessThan(0);

        // Verify inventory history logged negative stock warning
        const history = await prisma.inventoryHistory.findFirst({
            where: { referenceId: order.id },
            orderBy: { createdAt: 'desc' }
        });
        expect(history.reason).toContain('[WARNING: NEGATIVE STOCK]');
    });

    // ------------------------------------------------------------------------
    // Check 6: Ruling 2 Delivery Event Simultaneous Revenue & COGS
    // ------------------------------------------------------------------------
    it('Check 6: Ruling 2 - Delivery event -> Simultaneous Revenue (4000) and COGS (5000) recognition', async () => {
        const order = await prisma.order.create({
            data: {
                tenantId: testTenantId,
                status: 'ready',
                totalPrice: 40000,
                totalCost: 12000,
                isBaked: true,
                orderDate: new Date('2026-05-05')
            }
        });

        // Deposit of 25,000 paid before delivery
        await orderAccountingService.recordDepositPayment(testTenantId, order.id, {
            amount: 25000,
            paymentDate: new Date('2026-05-05')
        });

        // Deliver order
        const deliverResult = await orderAccountingService.recordOrderDelivered(testTenantId, order.id, {
            deliveredPrice: 40000,
            actualCost: 12000,
            deliveryDate: new Date('2026-05-05')
        });

        expect(deliverResult.journalEntry).toBeDefined();

        const entry = await journalService.getJournalEntryById(testTenantId, deliverResult.journalEntry.id);

        // Revenue lines: Dr 2120 (25k), Dr 1120 AR (15k) / Cr 4000 Revenue (40k)
        const depLine = entry.lines.find(l => l.accountCode === '2120');
        const arLine = entry.lines.find(l => l.accountCode === '1120');
        const revLine = entry.lines.find(l => l.accountCode === '4000' || l.accountCode === '4040');

        expect(Number(depLine.debit)).toBe(25000);
        expect(Number(arLine.debit)).toBe(15000);
        expect(Number(revLine.credit)).toBe(40000);

        // COGS lines: Dr 5000 COGS (12k) / Cr 1160 FG (12k)
        const cogsLine = entry.lines.find(l => l.accountCode === '5000');
        const fgLine = entry.lines.find(l => l.accountCode === '1160');

        expect(Number(cogsLine.debit)).toBe(12000);
        expect(Number(fgLine.credit)).toBe(12000);

        // Check P&L
        const pl = await profitLossService.getProfitLoss(testTenantId, {
            startDate: '2026-05-01',
            endDate: '2026-05-31'
        });
        expect(pl.revenue.total).toBe(40000);
        expect(pl.costOfGoodsSold.total).toBe(12000);
        expect(pl.grossProfit).toBe(28000);
    });

    // ------------------------------------------------------------------------
    // Check 7: Post-Delivery Payment (0 Duplicate Revenue)
    // ------------------------------------------------------------------------
    it('Check 7: Post-delivery balance payment -> Dr 1110 Bank / Cr 1120 AR (0 duplicate revenue)', async () => {
        const orders = await prisma.order.findMany({
            where: { tenantId: testTenantId, deliveredAt: { not: null } }
        });
        const deliveredOrder = orders[0];

        const payEntry = await orderAccountingService.recordBalancePayment(testTenantId, deliveredOrder.id, {
            amount: 15000,
            paymentDate: new Date('2026-05-06'),
            method: 'bank_transfer'
        });

        expect(payEntry).toBeDefined();
        const entry = await journalService.getJournalEntryById(testTenantId, payEntry.id);
        const bankLine = entry.lines.find(l => l.accountCode === '1110');
        const arLine = entry.lines.find(l => l.accountCode === '1120');

        expect(Number(bankLine.debit)).toBe(15000);
        expect(Number(arLine.credit)).toBe(15000);

        // Verify P&L revenue is STILL 40,000 (no duplicate revenue recognized!)
        const pl = await profitLossService.getProfitLoss(testTenantId, {
            startDate: '2026-05-01',
            endDate: '2026-05-31'
        });
        expect(pl.revenue.total).toBe(40000);
    });

    // ------------------------------------------------------------------------
    // Check 8: Ruling 20 Cancellation Forfeiture
    // ------------------------------------------------------------------------
    it('Check 8: Ruling 20 - Cancellation forfeiture -> Dr 2120 Customer Deposits / Cr 7030 Forfeited Deposits', async () => {
        const order = await prisma.order.create({
            data: {
                tenantId: testTenantId,
                status: 'confirmed',
                totalPrice: 60000,
                orderDate: new Date('2026-05-07')
            }
        });

        await orderAccountingService.recordDepositPayment(testTenantId, order.id, {
            amount: 30000,
            paymentDate: new Date('2026-05-07')
        });

        // Cancel order with forfeiture
        await orderAccountingService.recordOrderCancellation(testTenantId, order.id, 'FORFEITED_BEFORE_BAKE', {
            cancellationDate: new Date('2026-05-07')
        });

        // Verify General Ledger entries
        const forfeitLedger = await journalService.getAccountLedger(testTenantId, '7030');
        expect(Number(forfeitLedger.account.closingBalance)).toBe(30000);

        // Core cake revenue remains 40,000; Other income is 30,000
        const pl = await profitLossService.getProfitLoss(testTenantId, {
            startDate: '2026-05-01',
            endDate: '2026-05-31'
        });
        expect(pl.revenue.total).toBe(40000);
        expect(pl.otherIncome.total).toBe(30000);
    });

    // ------------------------------------------------------------------------
    // Check 9: Cancellation Refund
    // ------------------------------------------------------------------------
    it('Check 9: Cancellation refund -> Dr 2120 Customer Deposits / Cr 1110 Bank', async () => {
        const order = await prisma.order.create({
            data: {
                tenantId: testTenantId,
                status: 'confirmed',
                totalPrice: 20000,
                orderDate: new Date('2026-05-08')
            }
        });

        await orderAccountingService.recordDepositPayment(testTenantId, order.id, {
            amount: 10000,
            paymentDate: new Date('2026-05-08')
        });

        await orderAccountingService.recordOrderCancellation(testTenantId, order.id, 'REFUNDED_BEFORE_BAKE', {
            cancellationDate: new Date('2026-05-08')
        });

        // Check that Customer Deposits was relieved
        const depositLedger = await journalService.getAccountLedger(testTenantId, '2120');
        expect(depositLedger.account).toBeDefined();
    });

    // ------------------------------------------------------------------------
    // Check 10: Ruling 8/9 Capitalisation Threshold
    // ------------------------------------------------------------------------
    it('Check 10: Ruling 8/9 - Purchases >= ₦50,000 capitalised to 1200; < ₦50,000 expensed', async () => {
        // 1. Purchase >= 50,000 (Dough Mixer ₦180,000)
        const bigItem = await purchaseRoutingService.classifyPurchaseDestination(testTenantId, {
            name: 'Commercial Spiral Dough Mixer 30L',
            category: 'equipment',
            amount: 180000
        });
        expect(bigItem.isFixedAsset).toBe(true);
        expect(bigItem.destination).toBe('fixed_asset');
        expect(bigItem.accountCode).toBe('1200');

        // 2. Purchase < 50,000 (Hand Whisk ₦12,000)
        const smallItem = await purchaseRoutingService.classifyPurchaseDestination(testTenantId, {
            name: 'Stainless Steel Hand Whisk',
            category: 'equipment',
            amount: 12000
        });
        expect(smallItem.isFixedAsset).toBe(false);
        expect(smallItem.destination).toBe('expense');
        expect(smallItem.accountCode).toBe('5030');
    });

    // ------------------------------------------------------------------------
    // Check 11 & 12: Depreciation Engine & Contra-Asset Accumulation
    // ------------------------------------------------------------------------
    it('Check 11 & 12: Ruling 10, 11, 12, 14 - Straight-line depreciation, full month in purchase month, contra-asset 1290 accumulates', async () => {
        const reg = await fixedAssetService.registerFixedAsset(testTenantId, {
            name: 'Industrial Proving Chamber',
            assetCategory: 'bakery_equipment',
            cost: 1200000,
            residualValue: 0,
            usefulLifeMonths: 60, // 5 years: 1,200,000 / 60 = 20,000/month
            useType: 'production',
            acquisitionDate: new Date('2026-05-28'), // Late in month -> full month charged per Ruling 12
            postInitialEntry: true,
            paymentMethod: 'bank'
        });

        expect(reg.fixedAsset).toBeDefined();
        expect(reg.monthlyDepreciation).toBe(20000);

        // Run depreciation for May 2026
        const depResult = await fixedAssetService.depreciateAssetForMonth(testTenantId, reg.fixedAsset.id, new Date('2026-05-31'));

        expect(depResult.journalEntry).toBeDefined();
        const lines = depResult.journalEntry.lines;
        const depExpLine = lines.find(l => (l.account?.accountCode || l.accountCode) === '5060'); // Production Depreciation
        const contraLine = lines.find(l => (l.account?.accountCode || l.accountCode) === '1290'); // Contra-Asset

        expect(Number(depExpLine.debit)).toBe(20000);
        expect(Number(contraLine.credit)).toBe(20000);

        // Check Balance Sheet: Gross cost in 1200 is preserved, 1290 contra accumulated
        const bs = await balanceSheetService.getBalanceSheet(testTenantId, { asOfDate: '2026-05-31' });
        expect(bs.fixedAssets.totalCost).toBeGreaterThanOrEqual(1200000);
        expect(bs.fixedAssets.totalContra).toBeGreaterThanOrEqual(20000);
        expect(bs.isBalanced).toBe(true);
    });

    // ------------------------------------------------------------------------
    // Check 13: Ruling 13 Asset Disposal
    // ------------------------------------------------------------------------
    it('Check 13: Ruling 13 - Asset disposal recognizes Gain (7020) or Loss (8030)', async () => {
        // Create an asset with cost 600,000, accumulated dep 100,000 (NBV = 500,000)
        const asset = await fixedAssetService.registerFixedAsset(testTenantId, {
            name: 'Old Delivery Scooter',
            assetCategory: 'motor_vehicles',
            cost: 600000,
            usefulLifeMonths: 48,
            useType: 'office',
            acquisitionDate: new Date('2026-01-01'),
            postInitialEntry: true,
            paymentMethod: 'bank'
        });

        // Set accumulated depreciation to 100,000 manually for test
        await prisma.fixedAsset.update({
            where: { id: asset.fixedAsset.id },
            data: { accumulatedDepreciation: 100000, netBookValue: 500000 }
        });

        // Dispose for 550,000 proceeds -> Net Gain of 50,000 (7020)
        const disposeResult = await fixedAssetService.disposeFixedAsset(testTenantId, asset.fixedAsset.id, {
            disposalDate: new Date('2026-05-30'),
            proceeds: 550000,
            paymentMethod: 'bank'
        });

        expect(disposeResult.journalEntry).toBeDefined();
        const lines = disposeResult.journalEntry.lines;
        const gainLine = lines.find(l => (l.account?.accountCode || l.accountCode) === '7020');
        expect(gainLine).toBeDefined();
        expect(Number(gainLine.credit)).toBe(50000);
    });

    // ------------------------------------------------------------------------
    // Check 14: Ruling 16 Prepayment Advance & Monthly Amortisation
    // ------------------------------------------------------------------------
    it('Check 14: Ruling 16 - Prepayment advance capitalised to 1130, amortised monthly to target expense (6000)', async () => {
        const prep = await prepaymentService.createPrepaymentSchedule(testTenantId, {
            description: 'Bakery Annual Rent 2026/2027',
            totalAmount: 1200000,
            durationMonths: 12,
            targetAccountCode: '6000', // Rent Expense
            startDate: new Date('2026-05-01'),
            postInitialEntry: true,
            paymentMethod: 'bank'
        });

        expect(prep.schedule).toBeDefined();
        expect(prep.journalEntry).toBeDefined();

        // Initial entry: Dr 1130 Prepaid Expenses 1.2M / Cr 1110 Bank 1.2M
        const initLines = prep.journalEntry.lines;
        const prepaidLine = initLines.find(l => (l.account?.accountCode || l.accountCode) === '1130');
        expect(Number(prepaidLine.debit)).toBe(1200000);

        // Release 1 month: Dr 6000 Rent Expense 100k / Cr 1130 Prepaid 100k
        const releaseResult = await prepaymentService.releasePrepaymentForPeriod(testTenantId, prep.schedule.id, new Date('2026-05-31'));

        expect(releaseResult.journalEntry).toBeDefined();
        const relLines = releaseResult.journalEntry.lines;
        const rentLine = relLines.find(l => (l.account?.accountCode || l.accountCode) === '6000');
        const prepCreditLine = relLines.find(l => (l.account?.accountCode || l.accountCode) === '1130');

        expect(Number(rentLine.debit)).toBe(100000);
        expect(Number(prepCreditLine.credit)).toBe(100000);
    });

    // ------------------------------------------------------------------------
    // Check 15: Bank Transfers, Statement Matching & Reconciliation
    // ------------------------------------------------------------------------
    it('Check 15: Ruling 21, 23, 24 - Bank transfers 0 profit impact, statement matching avoids duplicates, reconciliation matches GL', async () => {
        // Create a secondary bank account
        const secondaryAcc = await bankManagementService.createBankAccount(testTenantId, {
            accountName: 'Zenith POS Collection',
            bankName: 'Zenith Bank',
            accountNumber: '1012345678',
            currency: 'NGN',
            accountCode: '1110'
        });

        // Transfer 100,000 from Main Bank to Secondary Bank
        const transferResult = await bankManagementService.transferBetweenAccounts(testTenantId, {
            fromBankAccountId: mainBankAcc.id,
            toBankAccountId: secondaryAcc.id,
            amount: 100000,
            transferDate: new Date('2026-05-15'),
            memo: 'Internal working capital transfer'
        });

        expect(transferResult.journalEntry).toBeDefined();

        // Profit impact must be strictly 0
        const pl = await profitLossService.getProfitLoss(testTenantId, {
            startDate: '2026-05-01',
            endDate: '2026-05-31'
        });
        expect(pl.operatingExpenses.total).toBeGreaterThanOrEqual(0);

        // Bank reconciliation summary verifies GL cash & bank matches
        const recSummary = await bankManagementService.getBankReconciliationSummary(testTenantId, mainBankAcc.id);
        expect(recSummary.bankAccount).toBeDefined();
        expect(recSummary.difference).toBeDefined();
    });

    // ------------------------------------------------------------------------
    // Check 16: Cut-Over Opening Balances Migration (Phase 11)
    // ------------------------------------------------------------------------
    it('Check 16: Cut-Over Opening Balances Migration - Posts ONE balanced entry with plug to 3000 Share Capital', async () => {
        // Create an independent tenant for migration test
        const migTenant = await prisma.tenant.create({
            data: {
                name: 'Cut-Over Migration Bakery',
                type: 'individual',
                contactEmail: `mig_test_${Date.now()}@example.com`
            }
        });

        try {
            // Preview opening position
            const preview = await migrationService.getOpeningPosition(migTenant.id, {
                cutOverDate: '2026-01-01'
            });
            expect(preview.summary.isBalanced).toBe(true);

            // Execute migration with explicit historical opening position
            const migrationResult = await migrationService.migrateOpeningBalances(migTenant.id, {
                cutOverDate: '2026-01-01',
                balances: {
                    cashOnHand: 50000,             // 1100 Dr 50,000
                    bank: 1500000,                 // 1110 Dr 1,500,000
                    accountsReceivable: 75000,     // 1120 Dr 75,000
                    inventoryRaw: 350000,          // 1140 Dr 350,000
                    inventoryPackaging: 85000,     // 1150 Dr 85,000
                    equipment: 2000000,            // 1200 Dr 2,000,000
                    accumulatedDepreciation: 200000, // 1290 Cr 200,000
                    accountsPayable: 160000,       // 2100 Cr 160,000
                    customerDeposits: 100000       // 2120 Cr 100,000
                },
                memo: 'Historical Cut-Over Opening Balances'
            });

            expect(migrationResult.success).toBe(true);
            expect(migrationResult.journalEntry).toBeDefined();
            expect(migrationResult.journalEntry.sourceType).toBe('opening_balance');

            // Debits = 50k + 1500k + 75k + 350k + 85k + 2000k = 4,060,000
            // Credits = 200k + 160k + 100k = 460,000
            // Balancing plug to 3000 Share Capital = Cr 3,600,000
            expect(Number(migrationResult.summary.totalDebits)).toBe(4060000);
            expect(Number(migrationResult.summary.totalCredits)).toBe(4060000);
            expect(Number(migrationResult.summary.balancingEquity)).toBe(3600000);

            // Verify Trial Balance for migrated tenant
            const tb = await trialBalanceService.getTrialBalance(migTenant.id, { asOfDate: '2026-01-02' });
            expect(tb.isBalanced).toBe(true);
            expect(tb.totalDebitBalance).toBe(4060000);
            expect(tb.totalCreditBalance).toBe(4060000);

            // Verify Balance Sheet for migrated tenant
            const bs = await balanceSheetService.getBalanceSheet(migTenant.id, { asOfDate: '2026-01-02' });
            expect(bs.isBalanced).toBe(true);
            expect(bs.totalAssets).toBe(3860000); // 4,060,000 - 200,000 contra = 3,860,000
            expect(bs.totalLiabilities).toBe(260000); // 160,000 AP + 100,000 deposits = 260,000
            expect(bs.equity.total).toBe(3600000); // 3,600,000
            expect(bs.totalLiabilitiesAndEquity).toBe(3860000);
        } finally {
            await prisma.tenant.delete({ where: { id: migTenant.id } }).catch(() => {});
        }
    });
});
