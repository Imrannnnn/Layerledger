/**
 * LayerLedger Accounting Express Routes
 */

const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../../../middleware/authMiddleware');
const accountingController = require('../controllers/accounting.controller');

// All routes require authenticated user
router.use(protect);

// Chart of Accounts routes
router.get('/accounts', accountingController.getAccounts);
router.post('/accounts', restrictTo('owner'), accountingController.createAccount);
router.post('/accounts/seed', restrictTo('owner'), accountingController.seedAccounts);

// Journal Entries routes
router.get('/journal', accountingController.getJournalEntries);
router.get('/journal/:id', accountingController.getJournalEntryById);
router.post('/journal', restrictTo('owner'), accountingController.postManualEntry);
router.post('/journal/:id/reverse', restrictTo('owner'), accountingController.reverseEntry);

// General Ledger inquiry
router.get('/ledger/:accountCode', accountingController.getAccountLedger);

// Order Lifecycle Accounting routes
router.post('/orders/:id/bake', accountingController.bakeOrder);
router.post('/orders/:id/deliver', accountingController.deliverOrder);
router.post('/orders/:id/cancel', accountingController.cancelOrder);
router.post('/orders/:id/deposit', accountingController.recordOrderDeposit);
router.post('/orders/:id/balance-payment', accountingController.recordOrderBalancePayment);
router.post('/orders/walk-in', accountingController.recordWalkInSale);

// Fixed Assets & Depreciation routes (Rulings 10, 11, 12, 13, 14)
router.get('/fixed-assets', accountingController.getFixedAssets);
router.get('/fixed-assets/:id', accountingController.getFixedAssetById);
router.post('/fixed-assets', restrictTo('owner'), accountingController.registerFixedAsset);
router.post('/fixed-assets/:id/depreciate', restrictTo('owner'), accountingController.depreciateFixedAsset);
router.post('/fixed-assets/depreciate-all', restrictTo('owner'), accountingController.depreciateAllFixedAssets);
router.post('/fixed-assets/:id/dispose', restrictTo('owner'), accountingController.disposeFixedAsset);

// Prepayments & Amortisation routes
router.get('/prepayments', accountingController.getPrepaymentSchedules);
router.get('/prepayments/:id', accountingController.getPrepaymentScheduleById);
router.post('/prepayments', restrictTo('owner'), accountingController.createPrepaymentSchedule);
router.post('/prepayments/:id/release', restrictTo('owner'), accountingController.releasePrepayment);
router.post('/prepayments/release-all', restrictTo('owner'), accountingController.releaseAllPrepayments);

// Bank Accounts & Reconciliation routes (Rulings 21, 22, 23, 24, 25)
router.get('/bank-accounts', accountingController.getBankAccounts);
router.post('/bank-accounts', restrictTo('owner'), accountingController.createBankAccount);
router.post('/bank-transfers', restrictTo('owner'), accountingController.transferBetweenAccounts);
router.post('/cash-purchases', accountingController.recordManualCashPurchase);
router.get('/reassignment-groups', accountingController.get2TierAccountGroups);
router.post('/bank-statements/:bankAccountId/import', restrictTo('owner'), accountingController.importStatementLines);
router.get('/bank-statements/:bankAccountId/lines', accountingController.getStatementLines);
router.post('/bank-statements/match', restrictTo('owner'), accountingController.matchStatementLine);
router.post('/bank-statements/categorize', restrictTo('owner'), accountingController.categorizeAndPostUnmatchedLine);
router.get('/bank-statements/:bankAccountId/reconciliation', accountingController.getBankReconciliationSummary);

// General Ledger Financial Reports (Rule 3 & Rulings 1, 2, 4, 6, 10, 19)
router.get('/reports/profit-loss', accountingController.getProfitLossReport);
router.get('/reports/balance-sheet', accountingController.getBalanceSheetReport);
router.get('/reports/cash-flow', accountingController.getCashFlowReport);
router.get('/reports/trial-balance', accountingController.getTrialBalanceReport);
router.get('/reports/dashboard', accountingController.getDashboardMetrics);

// Migration & Cut-Over Opening Balances routes
router.get('/migration/preview', restrictTo('owner'), accountingController.getOpeningBalancesPreview);
router.post('/migration/opening-balances', restrictTo('owner'), accountingController.migrateOpeningBalances);

module.exports = router;
