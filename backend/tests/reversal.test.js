/**
 * LayerLedger Reversal & Audit Immutability Tests (Phase 4)
 * Validates Rule 2 of the accounting specification:
 * "Entries are never edited or deleted. A correction is a new reversing entry."
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const prisma = require('../prisma');
const chartOfAccountsService = require('../modules/accounting/services/chartOfAccounts.service');
const postingService = require('../modules/accounting/services/posting.service');
const journalService = require('../modules/accounting/services/journal.service');
const reversalService = require('../modules/accounting/services/reversal.service');

describe('Journal Reversal & Immutability Engine (Phase 4)', () => {
    jest.setTimeout(30000);
    let testTenantId;

    beforeAll(async () => {
        const tenant = await prisma.tenant.create({
            data: {
                name: 'Reversal Test Bakery',
                type: 'individual',
                contactEmail: `reversal_test_${Date.now()}@example.com`
            }
        });
        testTenantId = tenant.id;
        await chartOfAccountsService.seedTenantChartOfAccounts(testTenantId);
    });

    afterAll(async () => {
        if (testTenantId) {
            await prisma.tenant.delete({ where: { id: testTenantId } }).catch(() => {});
        }
    });

    it('1. Should reverse a posted journal entry with an exact mirror entry', async () => {
        // Step 1: Post initial transaction (Dr Bank 150,000, Cr Share Capital 150,000)
        const initialPost = await postingService.postJournalEntry({
            tenantId: testTenantId,
            entryDate: new Date('2026-02-10'),
            sourceType: 'owner_capital',
            memo: 'Original owner capital injection',
            lines: [
                { accountCode: '1110', debit: 150000, credit: 0, description: 'Bank deposit' },
                { accountCode: '3000', debit: 0, credit: 150000, description: 'Initial Capital' }
            ]
        });

        const originalEntry = initialPost.entry;
        expect(originalEntry.status).toBe('POSTED');

        // Verify initial bank balance is 150,000
        const ledgerBefore = await journalService.getAccountLedger(testTenantId, '1110');
        expect(ledgerBefore.endingBalance).toBe(150000);

        // Step 2: Reverse the entry
        const reversalResult = await reversalService.reverseJournalEntry(
            testTenantId,
            originalEntry.id,
            'Incorrect account used - correcting error'
        );

        expect(reversalResult.original.status).toBe('REVERSED');
        expect(reversalResult.reversal).toBeDefined();
        expect(reversalResult.reversal.status).toBe('POSTED');
        expect(reversalResult.reversal.sourceType).toBe('reversal');
        expect(reversalResult.reversal.reversalOfId).toBe(originalEntry.id);

        // Step 3: Verify the lines are exactly mirrored:
        // Bank (1110) should now be Credited 150,000
        // Capital (3000) should now be Debited 150,000
        const revLines = reversalResult.reversal.lines;
        const bankLine = revLines.find(l => l.account.accountCode === '1110');
        const capLine = revLines.find(l => l.account.accountCode === '3000');

        expect(parseFloat(bankLine.credit.toString())).toBe(150000);
        expect(parseFloat(bankLine.debit.toString())).toBe(0);

        expect(parseFloat(capLine.debit.toString())).toBe(150000);
        expect(parseFloat(capLine.credit.toString())).toBe(0);

        // Step 4: Verify bank ending balance returns to exactly zero
        const ledgerAfter = await journalService.getAccountLedger(testTenantId, '1110');
        expect(ledgerAfter.endingBalance).toBe(0);
    });

    it('2. Should reject attempting to reverse an already reversed journal entry', async () => {
        // Create an entry
        const post = await postingService.postJournalEntry({
            tenantId: testTenantId,
            memo: 'Entry to be reversed twice',
            lines: [
                { accountCode: '1140', debit: 20000, credit: 0 },
                { accountCode: '1110', debit: 0, credit: 20000 }
            ]
        });

        // First reversal must succeed
        await reversalService.reverseJournalEntry(testTenantId, post.entry.id, 'First reversal');

        // Second reversal must be rejected
        await expect(
            reversalService.reverseJournalEntry(testTenantId, post.entry.id, 'Attempting duplicate reversal')
        ).rejects.toThrow(/already been reversed/i);
    });

    it('3. Should reverse by source document ID (reverseBySource)', async () => {
        const sourceId = 'test_expense_uuid_999';

        await postingService.postJournalEntry({
            tenantId: testTenantId,
            sourceType: 'expense',
            sourceId,
            memo: 'Office Supplies Expense',
            lines: [
                { accountCode: '6030', debit: 12000, credit: 0 },
                { accountCode: '1100', debit: 0, credit: 12000 }
            ]
        });

        const rev = await reversalService.reverseBySource(
            testTenantId,
            'expense',
            sourceId,
            'Expense receipt voided'
        );

        expect(rev).not.toBeNull();
        expect(rev.original.status).toBe('REVERSED');
        expect(rev.reversal.status).toBe('POSTED');

        // Subsequent reverseBySource should return null since no active posted entry remains
        const secondRev = await reversalService.reverseBySource(
            testTenantId,
            'expense',
            sourceId,
            'Second attempt'
        );
        expect(secondRev).toBeNull();
    });

    it('4. Should maintain audit link on journal inquiry (reversalOf and reversedBy)', async () => {
        const entries = await journalService.getJournalEntries(testTenantId, { limit: 10 });
        expect(entries.data.length).toBeGreaterThan(0);

        const reversedEntry = entries.data.find(e => e.status === 'REVERSED');
        expect(reversedEntry).toBeDefined();
        expect(reversedEntry.reversedByNumber).toBeDefined();

        const reversingEntry = entries.data.find(e => e.sourceType === 'reversal');
        expect(reversingEntry).toBeDefined();
        expect(reversingEntry.reversalOfNumber).toBeDefined();
    });
});
