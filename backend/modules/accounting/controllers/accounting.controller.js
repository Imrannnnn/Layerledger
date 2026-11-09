/**
 * LayerLedger Accounting Controller
 * HTTP endpoints for Chart of Accounts, Journal Inquiries, and Manual Journal Entries.
 */

const chartOfAccountsService = require('../services/chartOfAccounts.service');
const journalService = require('../services/journal.service');
const postingService = require('../services/posting.service');
const reversalService = require('../services/reversal.service');
const orderAccountingService = require('../services/orderAccounting.service');
const fixedAssetService = require('../services/fixedAsset.service');
const prepaymentService = require('../services/prepayment.service');
const bankManagementService = require('../services/bankManagement.service');
const profitLossService = require('../services/profitLoss.service');
const balanceSheetService = require('../services/balanceSheet.service');
const cashFlowService = require('../services/cashFlow.service');
const trialBalanceService = require('../services/trialBalance.service');
const financialDashboardService = require('../services/financialDashboard.service');
const migrationService = require('../services/migration.service');
const { asyncHandler } = require('../../../middleware/custommiddleware');

/**
 * @desc    Get chart of accounts for the current tenant
 * @route   GET /api/accounting/accounts
 * @access  Private
 */
const getAccounts = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const { classification, isActive } = req.query;

    const accounts = await chartOfAccountsService.getAccounts(tenantId, {
        classification,
        isActive: isActive !== undefined ? isActive === 'true' : undefined
    });

    // If tenant has no accounts yet, seed standard chart immediately
    if (accounts.length === 0) {
        await chartOfAccountsService.seedTenantChartOfAccounts(tenantId);
        const seeded = await chartOfAccountsService.getAccounts(tenantId);
        return res.json(seeded);
    }

    res.json(accounts);
});

/**
 * @desc    Explicitly trigger/verify Chart of Accounts seeding
 * @route   POST /api/accounting/accounts/seed
 * @access  Private (Owner only)
 */
const seedAccounts = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const result = await chartOfAccountsService.seedTenantChartOfAccounts(tenantId);
    res.json({
        message: 'Chart of accounts seeded successfully',
        ...result
    });
});

/**
 * @desc    Create a custom account under an existing classification
 * @route   POST /api/accounting/accounts
 * @access  Private (Owner only)
 */
const createAccount = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const { accountCode, accountName, classification, accountType, description } = req.body;

    const account = await chartOfAccountsService.createCustomAccount(tenantId, {
        accountCode,
        accountName,
        classification,
        accountType,
        description
    });

    res.status(201).json(account);
});

/**
 * @desc    Get journal entries with pagination and filters
 * @route   GET /api/accounting/journal
 * @access  Private
 */
const getJournalEntries = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const result = await journalService.getJournalEntries(tenantId, req.query);
    res.json(result);
});

/**
 * @desc    Get a single journal entry by ID
 * @route   GET /api/accounting/journal/:id
 * @access  Private
 */
const getJournalEntryById = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const entry = await journalService.getJournalEntryById(tenantId, req.params.id);
    if (!entry) {
        res.status(404);
        throw new Error('Journal entry not found');
    }
    res.json(entry);
});

/**
 * @desc    Post a manual journal entry
 * @route   POST /api/accounting/journal
 * @access  Private (Owner only)
 */
const postManualEntry = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const userId = req.user.id;
    const { entryDate, memo, lines } = req.body;

    const result = await postingService.postJournalEntry({
        tenantId,
        entryDate,
        sourceType: 'manual',
        memo,
        lines,
        createdBy: userId
    });

    res.status(201).json(result.entry);
});

/**
 * @desc    Get General Ledger for a specific account
 * @route   GET /api/accounting/ledger/:accountCode
 * @access  Private
 */
const getAccountLedger = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const result = await journalService.getAccountLedger(tenantId, req.params.accountCode, req.query);
    res.json(result);
});

/**
 * @desc    Reverse a posted journal entry
 * @route   POST /api/accounting/journal/:id/reverse
 * @access  Private (Owner only)
 */
const reverseEntry = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const userId = req.user.id;
    const { reason } = req.body;

    const result = await reversalService.reverseJournalEntry(
        tenantId,
        req.params.id,
        reason || 'User initiated reversal',
        userId
    );

    res.json(result);
});

/**
 * @desc    Mark order as baked (Dr 1160 Finished Goods / Cr 1140 Raw Materials)
 * @route   POST /api/accounting/orders/:id/bake
 * @access  Private
 */
const bakeOrder = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const result = await orderAccountingService.recordOrderBaked(tenantId, req.params.id, req.body);
    res.json(result);
});

/**
 * @desc    Mark order as delivered (Revenue + COGS simultaneous recognition)
 * @route   POST /api/accounting/orders/:id/deliver
 * @access  Private
 */
const deliverOrder = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const result = await orderAccountingService.recordOrderDelivered(tenantId, req.params.id, req.body);
    res.json(result);
});

/**
 * @desc    Cancel order with accounting resolution (forfeit to 7030, refund, or spoilage 5040)
 * @route   POST /api/accounting/orders/:id/cancel
 * @access  Private
 */
const cancelOrder = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const { cancellationType, refundAmount, cost } = req.body;
    const result = await orderAccountingService.recordOrderCancellation(
        tenantId,
        req.params.id,
        cancellationType,
        { refundAmount, cost }
    );
    res.json(result);
});

/**
 * @desc    Record customer deposit before delivery (Dr 1110 / Cr 2120)
 * @route   POST /api/accounting/orders/:id/deposit
 * @access  Private
 */
const recordOrderDeposit = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const result = await orderAccountingService.recordDepositPayment(tenantId, req.params.id, req.body);
    res.json(result);
});

/**
 * @desc    Record post-delivery balance payment (Dr 1110 / Cr 1120)
 * @route   POST /api/accounting/orders/:id/balance-payment
 * @access  Private
 */
const recordOrderBalancePayment = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const result = await orderAccountingService.recordBalancePayment(tenantId, req.params.id, req.body);
    res.json(result);
});

/**
 * @desc    Record walk-in counter sale
 * @route   POST /api/accounting/orders/walk-in
 * @access  Private
 */
const recordWalkInSale = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const result = await orderAccountingService.recordWalkInSale(tenantId, req.body);
    res.status(201).json(result);
});

// ══════════════════════════════════════════════════════════════════════════════
// FIXED ASSETS & DEPRECIATION (Rulings 10, 11, 12, 13, 14)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * @desc    Get fixed asset register
 * @route   GET /api/accounting/fixed-assets
 * @access  Private
 */
const getFixedAssets = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const assets = await fixedAssetService.getFixedAssets(tenantId, req.query);
    res.json(assets);
});

/**
 * @desc    Get single fixed asset details
 * @route   GET /api/accounting/fixed-assets/:id
 * @access  Private
 */
const getFixedAssetById = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const asset = await fixedAssetService.getFixedAssetById(tenantId, req.params.id);
    if (!asset) {
        res.status(404);
        throw new Error('Fixed asset not found');
    }
    res.json(asset);
});

/**
 * @desc    Register a new fixed asset
 * @route   POST /api/accounting/fixed-assets
 * @access  Private (Owner only)
 */
const registerFixedAsset = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const result = await fixedAssetService.registerFixedAsset(tenantId, req.body);
    res.status(201).json(result);
});

/**
 * @desc    Depreciate single fixed asset for month (Ruling 10, 11, 12)
 * @route   POST /api/accounting/fixed-assets/:id/depreciate
 * @access  Private (Owner only)
 */
const depreciateFixedAsset = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const { periodDate } = req.body;
    const result = await fixedAssetService.depreciateAssetForMonth(tenantId, req.params.id, periodDate || new Date());
    res.json(result);
});

/**
 * @desc    Batch depreciate all active fixed assets
 * @route   POST /api/accounting/fixed-assets/depreciate-all
 * @access  Private (Owner only)
 */
const depreciateAllFixedAssets = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const { periodDate } = req.body;
    const result = await fixedAssetService.runMonthlyDepreciationBatch(tenantId, periodDate || new Date());
    res.json(result);
});

/**
 * @desc    Dispose of a fixed asset
 * @route   POST /api/accounting/fixed-assets/:id/dispose
 * @access  Private (Owner only)
 */
const disposeFixedAsset = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const result = await fixedAssetService.disposeFixedAsset(tenantId, req.params.id, req.body);
    res.json(result);
});

// ══════════════════════════════════════════════════════════════════════════════
// PREPAYMENTS & AMORTISATION SCHEDULES
// ══════════════════════════════════════════════════════════════════════════════

/**
 * @desc    Get prepayment schedules
 * @route   GET /api/accounting/prepayments
 * @access  Private
 */
const getPrepaymentSchedules = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const schedules = await prepaymentService.getPrepaymentSchedules(tenantId, req.query);
    res.json(schedules);
});

/**
 * @desc    Get single prepayment schedule details
 * @route   GET /api/accounting/prepayments/:id
 * @access  Private
 */
const getPrepaymentScheduleById = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const schedule = await prepaymentService.getPrepaymentScheduleById(tenantId, req.params.id);
    if (!schedule) {
        res.status(404);
        throw new Error('Prepayment schedule not found');
    }
    res.json(schedule);
});

/**
 * @desc    Create a new prepayment schedule
 * @route   POST /api/accounting/prepayments
 * @access  Private (Owner only)
 */
const createPrepaymentSchedule = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const result = await prepaymentService.createPrepaymentSchedule(tenantId, req.body);
    res.status(201).json(result);
});

/**
 * @desc    Release monthly prepayment amortisation
 * @route   POST /api/accounting/prepayments/:id/release
 * @access  Private (Owner only)
 */
const releasePrepayment = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const { periodDate } = req.body;
    const result = await prepaymentService.releasePrepaymentForPeriod(tenantId, req.params.id, periodDate || new Date());
    res.json(result);
});

/**
 * @desc    Batch release all active prepayment schedules
 * @route   POST /api/accounting/prepayments/release-all
 * @access  Private (Owner only)
 */
const releaseAllPrepayments = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const { periodDate } = req.body;
    const result = await prepaymentService.runMonthlyPrepaymentReleases(tenantId, periodDate || new Date());
    res.json(result);
});

// ══════════════════════════════════════════════════════════════════════════════
// BANK ACCOUNTS & RECONCILIATION (Rulings 21, 22, 23, 24, 25)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * @desc    Get bank accounts with live GL balance (Ruling 23)
 * @route   GET /api/accounting/bank-accounts
 * @access  Private
 */
const getBankAccounts = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const accounts = await bankManagementService.getBankAccounts(tenantId);
    res.json(accounts);
});

/**
 * @desc    Create a new bank account
 * @route   POST /api/accounting/bank-accounts
 * @access  Private (Owner only)
 */
const createBankAccount = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const account = await bankManagementService.createBankAccount(tenantId, req.body);
    res.status(201).json(account);
});

/**
 * @desc    Transfer between baker's own accounts (Ruling 24)
 * @route   POST /api/accounting/bank-transfers
 * @access  Private (Owner only)
 */
const transferBetweenAccounts = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const result = await bankManagementService.transferBetweenAccounts(tenantId, req.body);
    res.status(201).json(result);
});

/**
 * @desc    Manual cash purchase with no invoice (Ruling 25)
 * @route   POST /api/accounting/cash-purchases
 * @access  Private
 */
const recordManualCashPurchase = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const result = await bankManagementService.recordManualCashPurchase(tenantId, req.body);
    res.status(201).json(result);
});

/**
 * @desc    2-tier account reassignment dropdown structure (Ruling 22)
 * @route   GET /api/accounting/reassignment-groups
 * @access  Private
 */
const get2TierAccountGroups = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const groups = await bankManagementService.get2TierAccountGroups(tenantId);
    res.json(groups);
});

/**
 * @desc    Import bank statement lines (Ruling 21)
 * @route   POST /api/accounting/bank-statements/:bankAccountId/import
 * @access  Private (Owner only)
 */
const importStatementLines = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const { lines } = req.body;
    const result = await bankManagementService.importStatementLines(tenantId, req.params.bankAccountId, lines);
    res.status(201).json(result);
});

/**
 * @desc    Get statement lines for bank account
 * @route   GET /api/accounting/bank-statements/:bankAccountId/lines
 * @access  Private
 */
const getStatementLines = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const lines = await bankManagementService.getStatementLines(tenantId, req.params.bankAccountId, req.query);
    res.json(lines);
});

/**
 * @desc    Match statement line to existing journal entry (avoids duplicate expense)
 * @route   POST /api/accounting/bank-statements/match
 * @access  Private (Owner only)
 */
const matchStatementLine = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const { lineId, journalEntryId } = req.body;
    const result = await bankManagementService.matchStatementLine(tenantId, lineId, journalEntryId);
    res.json(result);
});

/**
 * @desc    Categorize unmatched statement line and post new journal entry
 * @route   POST /api/accounting/bank-statements/categorize
 * @access  Private (Owner only)
 */
const categorizeAndPostUnmatchedLine = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const { lineId, targetAccountCode } = req.body;
    const result = await bankManagementService.categorizeAndPostUnmatchedLine(tenantId, lineId, { targetAccountCode });
    res.json(result);
});

/**
 * @desc    Get bank reconciliation summary report
 * @route   GET /api/accounting/bank-statements/:bankAccountId/reconciliation
 * @access  Private
 */
const getBankReconciliationSummary = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const summary = await bankManagementService.getBankReconciliationSummary(tenantId, req.params.bankAccountId);
    res.json(summary);
});

// ══════════════════════════════════════════════════════════════════════════════
// GENERAL LEDGER FINANCIAL REPORTS (Rule 3 & Rulings 1, 2, 4, 6, 10, 19)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * @desc    Get Accrual Profit & Loss Statement (Ruling 1, 2, 4)
 * @route   GET /api/accounting/reports/profit-loss
 * @access  Private
 */
const getProfitLossReport = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const report = await profitLossService.getProfitLoss(tenantId, req.query);
    res.json(report);
});

/**
 * @desc    Get Balance Sheet (Ruling 6, 10)
 * @route   GET /api/accounting/reports/balance-sheet
 * @access  Private
 */
const getBalanceSheetReport = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const report = await balanceSheetService.getBalanceSheet(tenantId, req.query);
    res.json(report);
});

/**
 * @desc    Get Cash Flow Statement (Ruling 1)
 * @route   GET /api/accounting/reports/cash-flow
 * @access  Private
 */
const getCashFlowReport = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const report = await cashFlowService.getCashFlow(tenantId, req.query);
    res.json(report);
});

/**
 * @desc    Get Trial Balance
 * @route   GET /api/accounting/reports/trial-balance
 * @access  Private
 */
const getTrialBalanceReport = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const report = await trialBalanceService.getTrialBalance(tenantId, req.query);
    res.json(report);
});

/**
 * @desc    Get Financial Dashboard Foundation Metrics
 * @route   GET /api/accounting/reports/dashboard
 * @access  Private
 */
const getDashboardMetrics = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const report = await financialDashboardService.getDashboardMetrics(tenantId, req.query);
    res.json(report);
});

/**
 * @desc    Preview calculated opening balances as of cut-over date
 * @route   GET /api/accounting/migration/preview
 * @access  Private (Owner only)
 */
const getOpeningBalancesPreview = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const preview = await migrationService.getOpeningPosition(tenantId, req.query);
    res.json(preview);
});

/**
 * @desc    Execute cut-over migration by posting a single balanced Opening Journal Entry
 * @route   POST /api/accounting/migration/opening-balances
 * @access  Private (Owner only)
 */
const migrateOpeningBalances = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const createdBy = req.user?.id || null;
    const result = await migrationService.migrateOpeningBalances(tenantId, {
        ...req.body,
        createdBy
    });
    res.status(201).json(result);
});

module.exports = {
    getAccounts,
    seedAccounts,
    createAccount,
    getJournalEntries,
    getJournalEntryById,
    postManualEntry,
    getAccountLedger,
    reverseEntry,
    bakeOrder,
    deliverOrder,
    cancelOrder,
    recordOrderDeposit,
    recordOrderBalancePayment,
    recordWalkInSale,
    getFixedAssets,
    getFixedAssetById,
    registerFixedAsset,
    depreciateFixedAsset,
    depreciateAllFixedAssets,
    disposeFixedAsset,
    getPrepaymentSchedules,
    getPrepaymentScheduleById,
    createPrepaymentSchedule,
    releasePrepayment,
    releaseAllPrepayments,
    getBankAccounts,
    createBankAccount,
    transferBetweenAccounts,
    recordManualCashPurchase,
    get2TierAccountGroups,
    importStatementLines,
    getStatementLines,
    matchStatementLine,
    categorizeAndPostUnmatchedLine,
    getBankReconciliationSummary,
    getProfitLossReport,
    getBalanceSheetReport,
    getCashFlowReport,
    getTrialBalanceReport,
    getDashboardMetrics,
    getOpeningBalancesPreview,
    migrateOpeningBalances
};
