/**
 * LayerLedger General Ledger Financial Reports Test Suite (Phase 9)
 * Validates Rule 3 & Rulings 1, 2, 4, 6, 10, 19:
 * 1. Accrual Profit & Loss (delivered revenue only, 0 revenue on unfulfilled deposits)
 * 2. Clean Cake Gross Margin (7030 Forfeited Deposits in Other Revenue)
 * 3. Balance Sheet Invariance (Total Assets === Total Liabilities + Total Equity)
 * 4. Trial Balance Invariance (Sum of Debits === Sum of Credits)
 * 5. Indirect Cash Flow Statement (reconciles net profit + depreciation + working capital to cash)
 * 6. Dashboard Foundation Metrics:
 *    - Metric 1: Cash received this month (all naira in)
 *    - Metric 2: Revenue this month (delivered orders only)
 *    - Metric 3: Paid for and not delivered (Account 2120 Customer Deposits)
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const prisma = require('../prisma');
const chartOfAccountsService = require('../modules/accounting/services/chartOfAccounts.service');
const postingService = require('../modules/accounting/services/posting.service');
const orderAccountingService = require('../modules/accounting/services/orderAccounting.service');
const fixedAssetService = require('../modules/accounting/services/fixedAsset.service');
const profitLossService = require('../modules/accounting/services/profitLoss.service');
const balanceSheetService = require('../modules/accounting/services/balanceSheet.service');
const cashFlowService = require('../modules/accounting/services/cashFlow.service');
const trialBalanceService = require('../modules/accounting/services/trialBalance.service');
const financialDashboardService = require('../modules/accounting/services/financialDashboard.service');

describe('General Ledger Financial Reports Integration (Phase 9)', () => {
    jest.setTimeout(120000);
    let testTenantId;

    beforeAll(async () => {
        const tenant = await prisma.tenant.create({
            data: {
                name: 'Financial Reporting Bakery',
                type: 'individual',
                contactEmail: `fin_reports_test_${Date.now()}@example.com`
            }
        });
        testTenantId = tenant.id;
        await chartOfAccountsService.seedTenantChartOfAccounts(testTenantId);

        // 1. Owner contributes ₦1,000,000 opening capital to Bank (1110)
        await postingService.postJournalEntry({
            tenantId: testTenantId,
            entryDate: new Date('2026-07-01'),
            sourceType: 'manual',
            memo: 'Startup Capital Injection',
            lines: [
                { accountCode: '1110', debit: 1000000, credit: 0, description: 'Bank funding' },
                { accountCode: '3000', debit: 0, credit: 1000000, description: 'Share capital' }
            ]
        });

        // 2. Buy raw materials for ₦200,000 (Dr 1140 Raw Materials / Cr 1110 Bank)
        await postingService.postJournalEntry({
            tenantId: testTenantId,
            entryDate: new Date('2026-07-02'),
            sourceType: 'purchase',
            memo: 'Flour & butter bulk inventory purchase',
            lines: [
                { accountCode: '1140', debit: 200000, credit: 0, description: 'Flour & butter' },
                { accountCode: '1110', debit: 0, credit: 200000, description: 'Paid from bank' }
            ]
        });

        // 3. Buy fixed asset: Mixer ₦300,000 (Dr 1200 / Cr 1110)
        const assetResult = await fixedAssetService.registerFixedAsset(testTenantId, {
            name: 'Spiral Mixer 30kg',
            assetCategory: 'bakery_equipment',
            cost: 300000,
            usefulLifeMonths: 60,
            useType: 'production',
            acquisitionDate: new Date('2026-07-03'),
            postInitialEntry: true,
            paymentMethod: 'bank'
        });

        // Depreciate mixer for July: ₦300,000 / 60 = ₦5,000 (Dr 5060 COGS / Cr 1290)
        await fixedAssetService.depreciateAssetForMonth(testTenantId, assetResult.fixedAsset.id, new Date('2026-07-31'));

        // 4. Order A: ₦50,000 deposit received, BUT NOT DELIVERED (Ruling 4: 0 revenue)
        const orderA = await prisma.order.create({
            data: {
                tenantId: testTenantId,
                status: 'confirmed',
                totalPrice: 100000,
                totalCost: 25000
            }
        });
        await orderAccountingService.recordDepositPayment(testTenantId, orderA.id, {
            amount: 50000,
            method: 'bank_transfer',
            date: new Date('2026-07-05')
        });

        // 5. Order B: ₦120,000 total price, ₦80,000 deposit paid, and DELIVERED in July (Ruling 2)
        const orderB = await prisma.order.create({
            data: {
                tenantId: testTenantId,
                status: 'confirmed',
                totalPrice: 120000,
                totalCost: 30000,
                items: {
                    create: [{ name: 'Custom Wedding Cake', price: 120000, cost: 30000 }]
                }
            }
        });
        await orderAccountingService.recordDepositPayment(testTenantId, orderB.id, {
            amount: 80000,
            method: 'bank_transfer',
            date: new Date('2026-07-06')
        });
        // Bake Order B
        await orderAccountingService.recordOrderBaked(testTenantId, orderB.id, {
            actualIngredientCost: 30000,
            date: new Date('2026-07-06')
        });
        // Deliver Order B (Revenue ₦120,000, COGS ₦30,000, AR ₦40,000)
        await orderAccountingService.recordOrderDelivered(testTenantId, orderB.id, {
            deliveredPrice: 120000,
            actualCost: 30000,
            date: new Date('2026-07-07')
        });

        // 6. Order C: Cancelled before bake, ₦15,000 deposit forfeited (Ruling 19 -> 7030 Other Revenue)
        const orderC = await prisma.order.create({
            data: {
                tenantId: testTenantId,
                status: 'confirmed',
                totalPrice: 40000,
                totalCost: 10000
            }
        });
        await orderAccountingService.recordDepositPayment(testTenantId, orderC.id, {
            amount: 15000,
            method: 'bank_transfer',
            date: new Date('2026-07-07')
        });
        await orderAccountingService.recordOrderCancellation(testTenantId, orderC.id, 'FORFEITED_BEFORE_BAKE', {
            date: new Date('2026-07-08')
        });

        // 7. Operating Admin Expenses: ₦20,000 Internet + ₦10,000 Office Supplies
        await postingService.postJournalEntry({
            tenantId: testTenantId,
            entryDate: new Date('2026-07-10'),
            sourceType: 'expense',
            memo: 'July internet and office supplies',
            lines: [
                { accountCode: '6050', debit: 20000, credit: 0, description: 'Internet' },
                { accountCode: '6030', debit: 10000, credit: 0, description: 'Paper & invoices' },
                { accountCode: '1110', debit: 0, credit: 30000, description: 'Paid via bank' }
            ]
        });

        // 8. Bank charges: ₦2,500 (Dr 8000 Other Expense / Cr 1110 Bank)
        await postingService.postJournalEntry({
            tenantId: testTenantId,
            entryDate: new Date('2026-07-15'),
            sourceType: 'bank_line',
            memo: 'Bank maintenance charges',
            lines: [
                { accountCode: '8000', debit: 2500, credit: 0, description: 'Bank charges' },
                { accountCode: '1110', debit: 0, credit: 2500, description: 'Bank charge' }
            ]
        });
    }, 120000);

    afterAll(async () => {
        if (testTenantId) {
            await prisma.tenant.delete({ where: { id: testTenantId } }).catch(() => {});
        }
        await prisma.$disconnect();
    });

    it('1. Profit & Loss: Revenue reflects delivered orders only (Ruling 2 & 4) and forfeited deposits land in 7030 (Ruling 19)', async () => {
        const pnl = await profitLossService.getProfitLoss(testTenantId, {
            startDate: new Date('2026-07-01'),
            endDate: new Date('2026-07-31')
        });

        // Ruling 2: Revenue is strictly ₦120,000 (Order B delivered).
        // Order A deposit (₦50,000) is NOT counted as revenue (Ruling 4).
        expect(pnl.revenue.total).toBe(120000);

        // COGS includes Order B ingredients (₦30,000) + mixer depreciation (₦5,000 on 5060) = ₦35,000
        expect(pnl.costOfGoodsSold.total).toBe(35000);

        // Gross Profit = 120,000 - 35,000 = ₦85,000
        expect(pnl.grossProfit).toBe(85000);
        expect(pnl.grossMarginPercent).toBe(70.83);

        // Operating Admin Expenses: 20k (6050) + 10k (6030) = ₦30,000
        expect(pnl.operatingExpenses.total).toBe(30000);

        // Operating Profit = 85,000 - 30,000 = ₦55,000
        expect(pnl.operatingProfit).toBe(55000);

        // Ruling 19: Forfeited deposit (₦15,000) lands in Other Income (7030), NOT in cake revenue
        expect(pnl.otherIncome.total).toBe(15000);
        const forfeitedItem = pnl.otherIncome.items.find(i => i.accountCode === '7030');
        expect(forfeitedItem).toBeDefined();
        expect(forfeitedItem.amount).toBe(15000);

        // Other Expenses: ₦2,500 (8000 Bank Charges)
        expect(pnl.otherExpenses.total).toBe(2500);

        // Net Profit = Operating Profit (55k) + Other Income (15k) - Other Expenses (2.5k) = ₦67,500
        expect(pnl.netProfit).toBe(67500);
    });

    it('2. Balance Sheet: Total Assets === Total Liabilities + Total Equity (isBalanced = true)', async () => {
        const bs = await balanceSheetService.getBalanceSheet(testTenantId, {
            asOfDate: new Date('2026-07-31')
        });

        // Equation: Assets - Liabilities === Equity
        expect(bs.isBalanced).toBe(true);
        expect(Math.abs(bs.difference)).toBeLessThan(0.01);

        // Current Liabilities must include Customer Deposits (2120) = ₦50,000 (Order A undelivered)
        const depositLiab = bs.currentLiabilities.items.find(i => i.accountCode === '2120');
        expect(depositLiab).toBeDefined();
        expect(depositLiab.amount).toBe(50000);

        // Accounts Receivable (1120) = ₦40,000 (unpaid balance on delivered Order B)
        const arAsset = bs.currentAssets.items.find(i => i.accountCode === '1120');
        expect(arAsset).toBeDefined();
        expect(arAsset.amount).toBe(40000);

        // Net Fixed Assets = Cost ₦300,000 - Contra ₦5,000 = ₦295,000
        expect(bs.fixedAssets.totalCost).toBe(300000);
        expect(bs.fixedAssets.totalContra).toBe(5000);
        expect(bs.fixedAssets.netFixedAssets).toBe(295000);

        // Equity incorporates Net Profit (₦67,500) into Retained Earnings
        const netIncomeEquity = bs.equity.items.find(i => i.accountCode === 'NET_INCOME');
        expect(netIncomeEquity).toBeDefined();
        expect(netIncomeEquity.amount).toBe(67500);
    });

    it('3. Trial Balance: Sum of Debits === Sum of Credits across all accounts', async () => {
        const tb = await trialBalanceService.getTrialBalance(testTenantId, {
            asOfDate: new Date('2026-07-31')
        });

        expect(tb.isBalanced).toBe(true);
        expect(tb.difference).toBe(0);
        expect(tb.totalDebitBalance).toBe(tb.totalCreditBalance);
        expect(tb.totalDebitBalance).toBeGreaterThan(0);
    });

    it('4. Cash Flow Statement: Indirect method reconciles Net Profit and working capital to Cash & Bank', async () => {
        const cf = await cashFlowService.getCashFlow(testTenantId, {
            startDate: new Date('2026-07-01'),
            endDate: new Date('2026-07-31')
        });

        expect(cf.operatingActivities.netProfit).toBe(67500);

        // Non-cash depreciation is added back (+₦5,000)
        expect(cf.operatingActivities.depreciationAddback).toBe(5000);

        // Working capital changes:
        // Customer Deposits increased by +₦50,000 (cash inflow from Order A)
        expect(cf.operatingActivities.workingCapitalChanges.customerDeposits).toBe(50000);
        // AR increased by -₦40,000 (cash outflow / uncollected revenue)
        expect(cf.operatingActivities.workingCapitalChanges.accountsReceivable).toBe(-40000);

        // Investing: Mixer purchase (-₦300,000)
        expect(cf.investingActivities.ppeAcquisitions).toBe(-300000);

        // Financing: Capital introduced (+₦1,000,000)
        expect(cf.financingActivities.capitalIntroduced).toBe(1000000);

        // Beginning cash was 0; Ending cash equals Beginning + Net Change
        expect(cf.endingCash).toBe(parseFloat((cf.beginningCash + cf.netCashChange).toFixed(2)));
    });

    it('5. Dashboard Foundation Metrics: Cash received, delivered revenue, and paid-for-not-delivered', async () => {
        const metrics = await financialDashboardService.getDashboardMetrics(testTenantId, {
            year: 2026,
            month: 7
        });

        // Metric 1: Cash received this month
        // 1m (capital) + 50k (Order A) + 80k (Order B) + 15k (Order C) = ₦1,145,000
        expect(metrics.foundationMetrics.cashReceivedThisMonth).toBe(1145000);

        // Metric 2: Revenue this month (delivered orders only: Order B = ₦120,000)
        expect(metrics.foundationMetrics.revenueThisMonth).toBe(120000);

        // Metric 3: Paid for and not delivered (balance on 2120 Customer Deposits = ₦50,000)
        expect(metrics.foundationMetrics.paidForAndNotDelivered).toBe(50000);

        // Operational metrics check
        expect(metrics.operationalMetrics.accountsReceivableBalance).toBe(40000);
        expect(metrics.operationalMetrics.grossProfitThisMonth).toBe(85000);
    });
});
