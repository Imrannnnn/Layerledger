/**
 * LayerLedger Double-Entry Accounting Engine Tests (Phase 3)
 * Validates Chart of Accounts seeding, double-entry invariants,
 * zero-sum balancing, decimal accuracy, and tenant isolation.
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const prisma = require('../prisma');
const chartOfAccountsService = require('../modules/accounting/services/chartOfAccounts.service');
const postingService = require('../modules/accounting/services/posting.service');
const journalService = require('../modules/accounting/services/journal.service');
const { STANDARD_CHART_OF_ACCOUNTS } = require('../modules/accounting/accounting.constants');

describe('Double-Entry Accounting Engine (Phase 3)', () => {
    jest.setTimeout(30000);
    let testTenantId;
    let otherTenantId;

    beforeAll(async () => {
        // Create an isolated test tenant
        const tenant = await prisma.tenant.create({
            data: {
                name: 'Accounting Engine Test Bakery',
                type: 'individual',
                contactEmail: `acc_test_${Date.now()}@example.com`
            }
        });
        testTenantId = tenant.id;

        const other = await prisma.tenant.create({
            data: {
                name: 'Other Tenant Bakery',
                type: 'individual',
                contactEmail: `other_${Date.now()}@example.com`
            }
        });
        otherTenantId = other.id;
    });

    afterAll(async () => {
        // Clean up test tenants and cascade their records
        if (testTenantId) {
            await prisma.tenant.delete({ where: { id: testTenantId } }).catch(() => {});
        }
        if (otherTenantId) {
            await prisma.tenant.delete({ where: { id: otherTenantId } }).catch(() => {});
        }
    });

    describe('Chart of Accounts Seeding & Invariants', () => {
        it('1. Should seed the complete standard chart of accounts for a tenant', async () => {
            const seedResult = await chartOfAccountsService.seedTenantChartOfAccounts(testTenantId);
            expect(seedResult.totalCreated).toBe(STANDARD_CHART_OF_ACCOUNTS.length);

            const accounts = await chartOfAccountsService.getAccounts(testTenantId);
            expect(accounts.length).toBe(STANDARD_CHART_OF_ACCOUNTS.length);
        });

        it('2. Should be strictly idempotent and not duplicate accounts on repeated seed', async () => {
            const secondSeed = await chartOfAccountsService.seedTenantChartOfAccounts(testTenantId);
            expect(secondSeed.totalCreated).toBe(0);

            const accounts = await chartOfAccountsService.getAccounts(testTenantId);
            expect(accounts.length).toBe(STANDARD_CHART_OF_ACCOUNTS.length);
        });

        it('3. Should verify the 1240/1290 conflict resolution and crucial additions', async () => {
            const acc1240 = await chartOfAccountsService.getAccountByCode(testTenantId, '1240');
            expect(acc1240).toBeDefined();
            expect(acc1240.accountName).toBe('Leasehold Improvements');

            const acc1290 = await chartOfAccountsService.getAccountByCode(testTenantId, '1290');
            expect(acc1290).toBeDefined();
            expect(acc1290.accountName).toBe('Accumulated Depreciation, PPE');
            expect(acc1290.accountType).toBe('FIXED_ASSET_CONTRA');

            const acc1295 = await chartOfAccountsService.getAccountByCode(testTenantId, '1295');
            expect(acc1295).toBeDefined();
            expect(acc1295.accountName).toBe('Accumulated Amortisation, Intangibles');

            // Key ruling additions
            const acc2120 = await chartOfAccountsService.getAccountByCode(testTenantId, '2120');
            expect(acc2120).toBeDefined();
            expect(acc2120.accountName).toBe('Customer Deposits');

            const acc2210 = await chartOfAccountsService.getAccountByCode(testTenantId, '2210');
            expect(acc2210).toBeDefined();
            expect(acc2210.accountName).toBe("Owner's Loan");

            const acc5070 = await chartOfAccountsService.getAccountByCode(testTenantId, '5070');
            expect(acc5070).toBeDefined();
            expect(acc5070.accountName).toBe('Rent & Occupancy, Production');

            const acc7030 = await chartOfAccountsService.getAccountByCode(testTenantId, '7030');
            expect(acc7030).toBeDefined();
            expect(acc7030.accountName).toBe('Forfeited Deposits');
        });

        it('4. Should allow custom accounts within existing classifications but reject invalid classifications', async () => {
            const custom = await chartOfAccountsService.createCustomAccount(testTenantId, {
                accountCode: '1111',
                accountName: 'Access Bank Checking',
                classification: 'ASSET',
                accountType: 'CURRENT_ASSET',
                description: 'Secondary bank account'
            });
            expect(custom.accountCode).toBe('1111');
            expect(custom.isSystemAccount).toBe(false);

            await expect(chartOfAccountsService.createCustomAccount(testTenantId, {
                accountCode: '9999',
                accountName: 'Invalid Account',
                classification: 'NON_EXISTENT_CLASS',
                description: 'Invalid'
            })).rejects.toThrow(/Invalid classification/i);
        });
    });

    describe('Double-Entry Journal Posting Engine Invariants', () => {
        it('5. Should reject an unbalanced journal entry where sum(debit) != sum(credit)', async () => {
            await expect(postingService.postJournalEntry({
                tenantId: testTenantId,
                memo: 'Unbalanced entry test',
                lines: [
                    { accountCode: '1110', debit: 50000, credit: 0 },
                    { accountCode: '4000', debit: 0, credit: 40000 } // Out of balance by 10,000
                ]
            })).rejects.toThrow(/Unbalanced Journal Entry/i);
        });

        it('6. Should reject a journal entry with fewer than two lines', async () => {
            await expect(postingService.postJournalEntry({
                tenantId: testTenantId,
                memo: 'Single line entry',
                lines: [
                    { accountCode: '1110', debit: 50000, credit: 0 }
                ]
            })).rejects.toThrow(/at least two lines/i);
        });

        it('7. Should reject lines with both debit and credit or negative values', async () => {
            await expect(postingService.postJournalEntry({
                tenantId: testTenantId,
                memo: 'Both sides populated',
                lines: [
                    { accountCode: '1110', debit: 50000, credit: 50000 },
                    { accountCode: '4000', debit: 0, credit: 0 }
                ]
            })).rejects.toThrow(/cannot have both a debit and a credit/i);

            await expect(postingService.postJournalEntry({
                tenantId: testTenantId,
                memo: 'Negative amount',
                lines: [
                    { accountCode: '1110', debit: -50000, credit: 0 },
                    { accountCode: '4000', debit: 0, credit: -50000 }
                ]
            })).rejects.toThrow(/Negative amounts are prohibited/i);
        });

        it('8. Should enforce tenant isolation and reject accounts belonging to another tenant', async () => {
            // Seed other tenant
            await chartOfAccountsService.seedTenantChartOfAccounts(otherTenantId);
            const otherAccount = await chartOfAccountsService.getAccountByCode(otherTenantId, '1110');

            await expect(postingService.postJournalEntry({
                tenantId: testTenantId,
                memo: 'Cross-tenant breach attempt',
                lines: [
                    { accountId: otherAccount.id, debit: 10000, credit: 0 },
                    { accountCode: '4000', debit: 0, credit: 10000 }
                ]
            })).rejects.toThrow(/Account not found for business|Security Violation/i);
        });

        it('9. Should atomically post a balanced double-entry transaction and assign sequential entryNumber', async () => {
            const result = await postingService.postJournalEntry({
                tenantId: testTenantId,
                entryDate: new Date('2026-02-01'),
                sourceType: 'manual',
                memo: 'Opening test capital deposit',
                lines: [
                    { accountCode: '1110', debit: 250000, credit: 0, description: 'Bank deposit' },
                    { accountCode: '3000', debit: 0, credit: 250000, description: 'Initial Share Capital' }
                ]
            });

            expect(result.alreadyPosted).toBe(false);
            expect(result.entry).toBeDefined();
            expect(result.entry.entryNumber).toMatch(/^JE-2026-\d{5}$/);
            expect(result.entry.status).toBe('POSTED');
            expect(result.entry.lines.length).toBe(2);

            // Post second entry and verify sequence increment
            const result2 = await postingService.postJournalEntry({
                tenantId: testTenantId,
                entryDate: new Date('2026-02-02'),
                sourceType: 'manual',
                memo: 'Ingredient purchase',
                lines: [
                    { accountCode: '1140', debit: 80000, credit: 0, description: 'Flour and butter' },
                    { accountCode: '1110', debit: 0, credit: 80000, description: 'Bank payment' }
                ]
            });

            expect(result2.entry.entryNumber).toMatch(/^JE-2026-\d{5}$/);
            const num1 = parseInt(result.entry.entryNumber.split('-')[2], 10);
            const num2 = parseInt(result2.entry.entryNumber.split('-')[2], 10);
            expect(num2).toBe(num1 + 1);
        });

        it('10. Should provide idempotent posting protection for documented transactions', async () => {
            const payload = {
                tenantId: testTenantId,
                entryDate: new Date('2026-02-05'),
                sourceType: 'purchase',
                sourceId: 'test_purchase_uuid_123',
                memo: 'Purchase #123',
                lines: [
                    { accountCode: '1140', debit: 45000, credit: 0 },
                    { accountCode: '1110', debit: 0, credit: 45000 }
                ]
            };

            const post1 = await postingService.postJournalEntry(payload);
            expect(post1.alreadyPosted).toBe(false);

            const post2 = await postingService.postJournalEntry(payload);
            expect(post2.alreadyPosted).toBe(true);
            expect(post2.entry.id).toBe(post1.entry.id);
        });

        it('11. Should query General Ledger and compute accurate running balance', async () => {
            const bankLedger = await journalService.getAccountLedger(testTenantId, '1110');
            expect(bankLedger.account.code).toBe('1110');
            expect(bankLedger.account.normalSide).toBe('DEBIT');
            // From earlier tests: +250,000 (Dr) - 80,000 (Cr) - 45,000 (Cr) = 125,000 ending balance
            expect(bankLedger.endingBalance).toBe(125000);
            expect(bankLedger.transactions.length).toBe(3);
        });
    });
});
