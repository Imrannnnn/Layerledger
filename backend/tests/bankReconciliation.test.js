/**
 * LayerLedger Multi-Bank Accounts & Reconciliation Tests (Phase 8)
 * Validates Rulings 21, 22, 23, 24, 25 & Duplicate Expense Prevention:
 * 1. Multiple bank accounts & live General Ledger balances (Ruling 23)
 * 2. Own-account transfers: Dr dest / Cr source (Ruling 24, 0 revenue, 0 expense)
 * 3. Bank-to-Cash withdrawal: Dr 1100 Cash / Cr 1110 Bank
 * 4. Manual cash purchase with no invoice: Dr destination / Cr 1100 Cash (Ruling 25)
 * 5. 2-Tier account reassignment structure: Group first, then specific account (Ruling 22)
 * 6. Bank statement import & auto-suggested matches (Ruling 21)
 * 7. Duplicate expense prevention: matching statement line to existing entry creates NO duplicate journal entry
 * 8. Unmatched bank line categorization (e.g. 8000 Bank Charges)
 * 9. Bank reconciliation summary report
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const prisma = require('../prisma');
const chartOfAccountsService = require('../modules/accounting/services/chartOfAccounts.service');
const bankManagementService = require('../modules/accounting/services/bankManagement.service');
const postingService = require('../modules/accounting/services/posting.service');
const journalService = require('../modules/accounting/services/journal.service');

describe('Multi-Bank Accounts & Reconciliation Integration (Phase 8)', () => {
    jest.setTimeout(30000);
    let testTenantId;
    let mainBankAcc;
    let cashDrawerAcc;
    let secondaryBankAcc;

    beforeAll(async () => {
        const tenant = await prisma.tenant.create({
            data: {
                name: 'Bank Reconciliation Bakery',
                type: 'individual',
                contactEmail: `bank_rec_test_${Date.now()}@example.com`
            }
        });
        testTenantId = tenant.id;
        await chartOfAccountsService.seedTenantChartOfAccounts(testTenantId);

        // Fetch / seed initial default bank accounts
        const accounts = await bankManagementService.getBankAccounts(testTenantId);
        mainBankAcc = accounts.find(a => a.accountCode === '1110');
        cashDrawerAcc = accounts.find(a => a.accountCode === '1100');

        // Create a secondary bank account (e.g. Zenith Bank Operations)
        secondaryBankAcc = await bankManagementService.createBankAccount(testTenantId, {
            accountName: 'Zenith Bank Operations',
            bankName: 'Zenith Bank PLC',
            accountNumber: '2081234567',
            currency: 'NGN',
            accountCode: '1110'
        });

        // Fund the main bank account initially via owner opening capital
        await postingService.postJournalEntry({
            tenantId: testTenantId,
            entryDate: new Date('2026-06-01'),
            sourceType: 'manual',
            memo: 'Initial capital funding to Main Bank',
            lines: [
                { accountCode: '1110', debit: 500000, credit: 0, description: 'Capital deposited' },
                { accountCode: '3000', debit: 0, credit: 500000, description: 'Share capital' }
            ]
        });
    });

    afterAll(async () => {
        if (testTenantId) {
            await prisma.tenant.delete({ where: { id: testTenantId } }).catch(() => {});
        }
        await prisma.$disconnect();
    });

    it('1. Should list multiple bank accounts with live General Ledger balances (Ruling 23)', async () => {
        const accounts = await bankManagementService.getBankAccounts(testTenantId);
        expect(accounts.length).toBeGreaterThanOrEqual(2);

        const main = accounts.find(a => a.id === mainBankAcc.id);
        expect(main.glBalance).toBe(500000); // ₦500k funded
    });

    it('2. Own-account transfer between bank accounts posts Dr dest / Cr source with 0 profit impact (Ruling 24)', async () => {
        // Transfer ₦150,000 from Main Bank to Zenith Bank Operations
        const transferResult = await bankManagementService.transferBetweenAccounts(testTenantId, {
            fromBankAccountId: mainBankAcc.id,
            toBankAccountId: secondaryBankAcc.id,
            amount: 150000,
            date: new Date('2026-06-02'),
            memo: 'Transfer to operations account'
        });

        expect(transferResult.journalEntry).toBeDefined();

        const entry = await journalService.getJournalEntryById(testTenantId, transferResult.journalEntry.id);
        expect(entry.lines.length).toBe(2);

        // Verify Dr 1110 (150,000) / Cr 1110 (150,000)
        expect(Number(entry.lines[0].debit)).toBe(150000);
        expect(Number(entry.lines[1].credit)).toBe(150000);

        // Verify profit & loss impact is strictly 0:
        // Revenue (4000) remains 0
        const revLedger = await journalService.getAccountLedger(testTenantId, '4000');
        expect(revLedger.endingBalance).toBe(0);

        // Expenses remain 0
        const expLedger = await journalService.getAccountLedger(testTenantId, '6000');
        expect(expLedger.endingBalance).toBe(0);
    });

    it('3. Transfer from Bank to Cash Drawer (cash withdrawal) increases cash on hand', async () => {
        // Withdraw ₦60,000 cash from Main Bank to Cash Drawer
        const transfer = await bankManagementService.transferBetweenAccounts(testTenantId, {
            fromBankAccountId: mainBankAcc.id,
            toBankAccountId: cashDrawerAcc.id,
            amount: 60000,
            date: new Date('2026-06-03'),
            memo: 'Cash withdrawal for bakery register drawer'
        });

        expect(transfer.journalEntry).toBeDefined();

        // 1100 Cash on Hand has ₦60,000 debit balance
        const cashLedger = await journalService.getAccountLedger(testTenantId, '1100');
        expect(cashLedger.endingBalance).toBe(60000);
    });

    it('4. Manual cash purchase with no invoice debits destination and credits 1100 Cash on Hand (Ruling 25)', async () => {
        // Baker buys ₦18,000 diesel fuel in cash from driver with no invoice
        const cashPurchase = await bankManagementService.recordManualCashPurchase(testTenantId, {
            destinationAccountCode: '6080', // 6080 Fuel & Vehicle Maintenance
            amount: 18000,
            date: new Date('2026-06-04'),
            description: 'Generator diesel cash purchase at gate'
        });

        expect(cashPurchase.journalEntry).toBeDefined();

        const entry = await journalService.getJournalEntryById(testTenantId, cashPurchase.journalEntry.id);
        const fuelLine = entry.lines.find(l => l.accountCode === '6080');
        const cashLine = entry.lines.find(l => l.accountCode === '1100');

        expect(Number(fuelLine.debit)).toBe(18000);
        expect(Number(cashLine.credit)).toBe(18000);

        // Cash on Hand (1100) drops to ₦42,000 (60,000 - 18,000)
        const cashLedger = await journalService.getAccountLedger(testTenantId, '1100');
        expect(cashLedger.endingBalance).toBe(42000);

        // Fuel expense (6080) reflects ₦18,000
        const fuelLedger = await journalService.getAccountLedger(testTenantId, '6080');
        expect(fuelLedger.endingBalance).toBe(18000);
    });

    it('5. 2-Tier reassignment dropdown returns structured groups and specific accounts (Ruling 22)', async () => {
        const groups = await bankManagementService.get2TierAccountGroups(testTenantId);

        expect(Array.isArray(groups)).toBe(true);
        expect(groups.length).toBeGreaterThanOrEqual(5);

        const opExpensesGroup = groups.find(g => g.key === 'OPERATING_EXPENSES');
        expect(opExpensesGroup).toBeDefined();
        expect(opExpensesGroup.accounts.some(a => a.accountCode === '6050')).toBe(true);

        const cogsGroup = groups.find(g => g.key === 'COGS');
        expect(cogsGroup).toBeDefined();
        expect(cogsGroup.accounts.some(a => a.accountCode === '5000')).toBe(true);

        const assetsGroup = groups.find(g => g.key === 'INVENTORY_ASSETS');
        expect(assetsGroup).toBeDefined();
        expect(assetsGroup.accounts.some(a => a.accountCode === '1140')).toBe(true);
    });

    it('6. Bank statement import auto-detects existing journal entries as suggested matches (Ruling 21)', async () => {
        // Record a legitimate purchase entry in the system (e.g. ₦35,000 for packaging)
        const existingEntry = await postingService.postJournalEntry({
            tenantId: testTenantId,
            entryDate: new Date('2026-06-10'),
            sourceType: 'purchase',
            memo: 'Packaging boxes purchase',
            lines: [
                { accountCode: '1150', debit: 35000, credit: 0, description: 'Cake boxes' },
                { accountCode: '1110', debit: 0, credit: 35000, description: 'Paid via Main Bank' }
            ]
        });

        // Import bank statement lines
        const importResult = await bankManagementService.importStatementLines(testTenantId, mainBankAcc.id, [
            {
                lineDate: new Date('2026-06-11'), // within ±5 days
                description: 'POS/WEB TRF TO PACKAGING CO',
                amount: 35000,
                lineType: 'debit',
                reference: 'REF-BANK-99881'
            },
            {
                lineDate: new Date('2026-06-12'),
                description: 'MONTHLY SMS CHARGE',
                amount: 850,
                lineType: 'debit',
                reference: 'REF-BANK-SMS-01'
            }
        ]);

        expect(importResult.totalImported).toBe(2);

        // First line should be suggested matched to existing purchase entry
        const matchedLine = importResult.lines.find(l => l.amount == 35000);
        expect(matchedLine.status).toBe('MATCH_SUGGESTED');
        expect(matchedLine.matchedJournalEntryId).toBe(existingEntry.entry.id);

        // Second line (SMS charge) should have suggested account 8000
        const smsLine = importResult.lines.find(l => l.amount == 850);
        expect(smsLine.status).toBe('UNMATCHED');
        expect(smsLine.suggestedAccountId).toBeDefined();
    });

    it('7. Matching statement line to existing entry creates NO second journal entry (Fixes Duplicate Expense)', async () => {
        const lines = await bankManagementService.getStatementLines(testTenantId, mainBankAcc.id, {
            status: 'MATCH_SUGGESTED'
        });
        const line = lines[0];
        const existingEntryId = line.matchedJournalEntryId;

        // Count journal entries before matching
        const entriesBefore = await journalService.getJournalEntries(testTenantId);

        // Confirm match
        const matchResult = await bankManagementService.matchStatementLine(
            testTenantId,
            line.id,
            existingEntryId
        );

        expect(matchResult.line.status).toBe('MATCHED');

        // Count journal entries after matching: MUST BE IDENTICAL (0 duplicate entries created!)
        const entriesAfter = await journalService.getJournalEntries(testTenantId);
        expect(entriesAfter.total).toBe(entriesBefore.total);
    });

    it('8. Categorize unrecorded line posts new journal entry to 8000 Bank Charges', async () => {
        const lines = await bankManagementService.getStatementLines(testTenantId, mainBankAcc.id, {
            status: 'UNMATCHED'
        });
        const smsLine = lines[0];

        // User categorizes line as 8000 Bank Charges via 2-tier dropdown
        const catResult = await bankManagementService.categorizeAndPostUnmatchedLine(
            testTenantId,
            smsLine.id,
            { targetAccountCode: '8000' }
        );

        expect(catResult.line.status).toBe('JOURNAL_CREATED');
        expect(catResult.journalEntry).toBeDefined();

        const entry = await journalService.getJournalEntryById(testTenantId, catResult.journalEntry.id);
        const chargeLine = entry.lines.find(l => l.accountCode === '8000');
        const bankLine = entry.lines.find(l => l.accountCode === '1110');

        expect(Number(chargeLine.debit)).toBe(850);
        expect(Number(bankLine.credit)).toBe(850);

        // 8000 Bank Charges ledger has ₦850 debit balance
        const chargeLedger = await journalService.getAccountLedger(testTenantId, '8000');
        expect(chargeLedger.endingBalance).toBe(850);
    });

    it('9. Bank reconciliation summary calculates GL balance and matching breakdown', async () => {
        const summary = await bankManagementService.getBankReconciliationSummary(
            testTenantId,
            mainBankAcc.id
        );

        expect(summary.bankAccount.id).toBe(mainBankAcc.id);
        expect(summary.totalLines).toBeGreaterThanOrEqual(2);
        expect(summary.matchedCount).toBeGreaterThanOrEqual(2);
        expect(summary.unmatchedCount).toBe(0); // All 2 lines are reconciled
    });
});
