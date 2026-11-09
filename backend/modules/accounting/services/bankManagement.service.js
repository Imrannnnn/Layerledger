/**
 * LayerLedger Multi-Bank Accounts & Reconciliation Service
 * Implements Rulings 21, 22, 23, 24, 25:
 * - Ruling 21: Bank statement import is kept, but not mandatory.
 * - Ruling 22: Reassignment dropdown asks for the group first, then the specific account (2-tier).
 * - Ruling 23: Business bank account management.
 * - Ruling 24: Multiple bank accounts supported. Own-account transfers post Dr 1110_dest / Cr 1110_source (0 revenue, 0 expense).
 * - Ruling 25: Manually enter cash purchase with no invoice: Dr Destination / Cr 1100 Cash on Hand.
 * - Duplicate Expense Prevention: Statement lines link to existing journal entries rather than creating duplicate entries.
 */

const prisma = require('../../../prisma');
const postingService = require('./posting.service');
const chartOfAccountsService = require('./chartOfAccounts.service');
const journalService = require('./journal.service');

class BankManagementService {
    /**
     * Get or seed default bank accounts for tenant
     */
    async getBankAccounts(tenantId) {
        let accounts = await prisma.bankAccount.findMany({
            where: { tenantId, isActive: true },
            include: { account: true }
        });

        // If no bank account exists yet, seed default primary bank account and cash drawer
        if (accounts.length === 0) {
            const bankAcc = await chartOfAccountsService.getAccountByCode(tenantId, '1110');
            const cashAcc = await chartOfAccountsService.getAccountByCode(tenantId, '1100');

            if (bankAcc) {
                await prisma.bankAccount.create({
                    data: {
                        tenantId,
                        accountId: bankAcc.id,
                        accountName: 'Main Business Bank Account',
                        bankName: 'Commercial Bank',
                        isDefault: true
                    }
                });
            }

            if (cashAcc) {
                await prisma.bankAccount.create({
                    data: {
                        tenantId,
                        accountId: cashAcc.id,
                        accountName: 'Main Cash Drawer',
                        bankName: 'Cash on Hand',
                        isDefault: false
                    }
                });
            }

            accounts = await prisma.bankAccount.findMany({
                where: { tenantId, isActive: true },
                include: { account: true }
            });
        }

        // Attach live General Ledger balances to each bank account
        const enriched = await Promise.all(accounts.map(async (ba) => {
            let glBalance = 0;
            try {
                const ledger = await journalService.getAccountLedger(tenantId, ba.account.accountCode);
                glBalance = ledger.endingBalance;
            } catch (err) {
                glBalance = 0;
            }

            return {
                id: ba.id,
                accountName: ba.accountName,
                bankName: ba.bankName,
                accountNumber: ba.accountNumber,
                currency: ba.currency,
                isDefault: ba.isDefault,
                accountCode: ba.account.accountCode,
                accountType: ba.account.accountCode === '1100' ? 'CASH' : 'BANK',
                glBalance,
                createdAt: ba.createdAt
            };
        }));

        return enriched;
    }

    /**
     * Create a new bank account
     */
    async createBankAccount(tenantId, data) {
        const accountCode = data.accountCode || '1110';
        let account = await chartOfAccountsService.getAccountByCode(tenantId, accountCode);
        if (!account) {
            account = await chartOfAccountsService.getAccountByCode(tenantId, '1110');
        }

        if (data.isDefault) {
            await prisma.bankAccount.updateMany({
                where: { tenantId },
                data: { isDefault: false }
            });
        }

        const bankAccount = await prisma.bankAccount.create({
            data: {
                tenantId,
                accountId: account.id,
                accountName: data.accountName,
                bankName: data.bankName,
                accountNumber: data.accountNumber || null,
                currency: data.currency || 'NGN',
                isDefault: Boolean(data.isDefault)
            },
            include: { account: true }
        });

        return bankAccount;
    }

    /**
     * Ruling 24: Transfer between the baker's own accounts
     * Dr Destination Account / Cr Source Account
     * Profit impact: NIL (0 revenue, 0 expense)
     */
    async transferBetweenAccounts(tenantId, transferData, externalTx = null) {
        const runWithTx = async (tx) => {
            const amount = parseFloat(transferData.amount || 0);
            if (amount <= 0) {
                throw new Error('Transfer amount must be greater than zero');
            }

            const fromAccount = await tx.bankAccount.findFirst({
                where: { id: transferData.fromBankAccountId, tenantId },
                include: { account: true }
            });
            if (!fromAccount) {
                throw new Error(`Source bank account ${transferData.fromBankAccountId} not found`);
            }

            const toAccount = await tx.bankAccount.findFirst({
                where: { id: transferData.toBankAccountId, tenantId },
                include: { account: true }
            });
            if (!toAccount) {
                throw new Error(`Destination bank account ${transferData.toBankAccountId} not found`);
            }

            if (fromAccount.id === toAccount.id) {
                throw new Error('Source and destination accounts cannot be the same');
            }

            const date = transferData.date ? new Date(transferData.date) : new Date();
            const memo = transferData.memo || `Own-account transfer from ${fromAccount.accountName} to ${toAccount.accountName}`;

            const sourceCode = fromAccount.account.accountCode;
            const destCode = toAccount.account.accountCode;

            // Post journal entry: Dr Destination / Cr Source
            const postResult = await postingService.postJournalEntry({
                tenantId,
                entryDate: date,
                sourceType: 'bank_transfer',
                memo,
                lines: [
                    {
                        accountCode: destCode,
                        debit: amount,
                        credit: 0,
                        description: `Transfer in to ${toAccount.accountName} from ${fromAccount.accountName}`
                    },
                    {
                        accountCode: sourceCode,
                        debit: 0,
                        credit: amount,
                        description: `Transfer out from ${fromAccount.accountName} to ${toAccount.accountName}`
                    }
                ]
            }, tx);

            return {
                journalEntry: postResult.entry,
                amount,
                from: fromAccount.accountName,
                to: toAccount.accountName
            };
        };

        if (externalTx) return await runWithTx(externalTx);
        return await prisma.$transaction(async (tx) => runWithTx(tx), { maxWait: 10000, timeout: 30000 });
    }

    /**
     * Ruling 25: Manually enter a cash purchase with no invoice
     * Dr Destination Account (Raw Materials, Consumables, Fuel, etc.)
     * Cr 1100 Cash on Hand
     */
    async recordManualCashPurchase(tenantId, purchaseData, externalTx = null) {
        const runWithTx = async (tx) => {
            const amount = parseFloat(purchaseData.amount || 0);
            if (amount <= 0) {
                throw new Error('Cash purchase amount must be greater than zero');
            }

            let destinationCode = purchaseData.destinationAccountCode;
            if (!destinationCode) {
                // Auto-map based on description or category
                const desc = String(purchaseData.description || purchaseData.category || '').toLowerCase();
                if (desc.includes('flour') || desc.includes('sugar') || desc.includes('butter') || desc.includes('egg') || desc.includes('ingredient')) {
                    destinationCode = '1140'; // Raw Materials
                } else if (desc.includes('box') || desc.includes('board') || desc.includes('bag') || desc.includes('packaging')) {
                    destinationCode = '1150'; // Packaging
                } else if (desc.includes('fuel') || desc.includes('petrol') || desc.includes('diesel')) {
                    destinationCode = '6080'; // Fuel & Vehicle Maintenance
                } else if (desc.includes('repair') || desc.includes('maintenance')) {
                    destinationCode = '6040'; // Maintenance & Repairs
                } else {
                    destinationCode = '5030'; // Bakery Consumables
                }
            }

            const targetAccount = await chartOfAccountsService.getAccountByCode(tenantId, destinationCode);
            if (!targetAccount) {
                throw new Error(`Target account code ${destinationCode} not found`);
            }

            const date = purchaseData.date ? new Date(purchaseData.date) : new Date();
            const description = purchaseData.description || `Manual cash purchase: ${targetAccount.accountName}`;

            // Dr Destination / Cr 1100 Cash on Hand
            const postResult = await postingService.postJournalEntry({
                tenantId,
                entryDate: date,
                sourceType: 'manual_cash_purchase',
                memo: `Manual cash purchase (no invoice): ${description}`,
                lines: [
                    {
                        accountCode: destinationCode,
                        debit: amount,
                        credit: 0,
                        description
                    },
                    {
                        accountCode: '1100',
                        debit: 0,
                        credit: amount,
                        description: `Cash paid for: ${description}`
                    }
                ]
            }, tx);

            return {
                journalEntry: postResult.entry,
                amount,
                destinationAccountCode: destinationCode,
                destinationAccountName: targetAccount.accountName
            };
        };

        if (externalTx) return await runWithTx(externalTx);
        return await prisma.$transaction(async (tx) => runWithTx(tx), { maxWait: 10000, timeout: 30000 });
    }

    /**
     * Ruling 22: 2-Tier Account Reassignment Structure
     * Returns accounts grouped by classification for UI dropdown
     */
    async get2TierAccountGroups(tenantId) {
        const allAccounts = await chartOfAccountsService.getAccounts(tenantId, { isActive: true });

        const groups = [
            {
                key: 'OPERATING_EXPENSES',
                label: 'Operating & Admin Expenses (6000-6410)',
                accounts: allAccounts.filter(a => a.classification === 'ADMIN_EXPENSE')
            },
            {
                key: 'COGS',
                label: 'Cost of Goods Sold (5000-5070)',
                accounts: allAccounts.filter(a => a.classification === 'COGS')
            },
            {
                key: 'INVENTORY_ASSETS',
                label: 'Inventory & Current Assets (1120-1160)',
                accounts: allAccounts.filter(a => a.classification === 'ASSET' && a.accountType !== 'FIXED_ASSET' && a.accountType !== 'FIXED_ASSET_CONTRA' && a.accountCode !== '1100' && a.accountCode !== '1110')
            },
            {
                key: 'FIXED_ASSETS',
                label: 'Property, Plant & Equipment (1200-1280)',
                accounts: allAccounts.filter(a => a.accountType === 'FIXED_ASSET')
            },
            {
                key: 'REVENUE',
                label: 'Revenue & Sales (4000-4070)',
                accounts: allAccounts.filter(a => a.classification === 'REVENUE')
            },
            {
                key: 'OTHER_INCOME_EXPENSE',
                label: 'Other Income & Expenses (7000-8030)',
                accounts: allAccounts.filter(a => a.classification === 'OTHER_INCOME' || a.classification === 'OTHER_EXPENSE')
            },
            {
                key: 'LIABILITIES_EQUITY',
                label: 'Liabilities & Equity (2000-3300)',
                accounts: allAccounts.filter(a => a.classification === 'LIABILITY' || a.classification === 'EQUITY')
            }
        ];

        return groups;
    }

    /**
     * Ruling 21: Import Bank Statement Lines
     * Auto-detects potential matches to existing journal entries within ±5 days.
     */
    async importStatementLines(tenantId, bankAccountId, lines = [], externalTx = null) {
        const runWithTx = async (tx) => {
            const bankAccount = await tx.bankAccount.findFirst({
                where: { id: bankAccountId, tenantId },
                include: { account: true }
            });
            if (!bankAccount) {
                throw new Error(`Bank account ${bankAccountId} not found`);
            }

            const bankAccountCode = bankAccount.account.accountCode;
            const importedRows = [];

            for (const item of lines) {
                const amount = parseFloat(item.amount || 0);
                if (amount <= 0) continue;

                const lineDate = item.lineDate ? new Date(item.lineDate) : new Date();
                const lineType = String(item.lineType || '').toLowerCase() === 'credit' ? 'credit' : 'debit';
                const description = item.description || 'Bank transaction';

                // Look for existing posted journal entry on bank account (1110)
                // If lineType === 'credit' (money in), find journal line with debit === amount
                // If lineType === 'debit' (money out), find journal line with credit === amount
                const dateStart = new Date(lineDate.getTime() - 5 * 24 * 60 * 60 * 1000);
                const dateEnd = new Date(lineDate.getTime() + 5 * 24 * 60 * 60 * 1000);

                const candidateLine = await tx.journalLine.findFirst({
                    where: {
                        tenantId,
                        account: { accountCode: bankAccountCode },
                        debit: lineType === 'credit' ? amount : 0,
                        credit: lineType === 'debit' ? amount : 0,
                        journalEntry: {
                            status: 'POSTED',
                            entryDate: { gte: dateStart, lte: dateEnd }
                        }
                    },
                    include: { journalEntry: true }
                });

                let status = 'UNMATCHED';
                let matchedJournalEntryId = null;
                let suggestedAccountId = null;

                if (candidateLine) {
                    status = 'MATCH_SUGGESTED';
                    matchedJournalEntryId = candidateLine.journalEntry.id;
                } else {
                    // Check auto-rule for suggested account
                    const descLower = description.toLowerCase();
                    if (descLower.includes('stamp duty') || descLower.includes('bank charge') || descLower.includes('sms alert') || descLower.includes('maint fee')) {
                        const chargeAcc = await tx.account.findFirst({ where: { tenantId, accountCode: '8000' } });
                        if (chargeAcc) suggestedAccountId = chargeAcc.id;
                    } else if (descLower.includes('interest')) {
                        const intAcc = await tx.account.findFirst({ where: { tenantId, accountCode: '7000' } });
                        if (intAcc) suggestedAccountId = intAcc.id;
                    }
                }

                const createdLine = await tx.bankStatementLine.create({
                    data: {
                        tenantId,
                        bankAccountId,
                        lineDate,
                        description,
                        amount,
                        lineType,
                        status,
                        matchedJournalEntryId,
                        suggestedAccountId,
                        reference: item.reference || null,
                        rawMetadata: item.metadata || {}
                    }
                });

                importedRows.push(createdLine);
            }

            return {
                totalImported: importedRows.length,
                suggestedMatches: importedRows.filter(r => r.status === 'MATCH_SUGGESTED').length,
                lines: importedRows
            };
        };

        if (externalTx) return await runWithTx(externalTx);
        return await prisma.$transaction(async (tx) => runWithTx(tx), { maxWait: 10000, timeout: 30000 });
    }

    /**
     * Link bank statement line to an existing journal entry
     * FIXES THE DUPLICATE EXPENSE PROBLEM:
     * Does NOT create a second entry. Simply links to the existing entry.
     */
    async matchStatementLine(tenantId, lineId, journalEntryId, externalTx = null) {
        const runWithTx = async (tx) => {
            const line = await tx.bankStatementLine.findFirst({
                where: { id: lineId, tenantId }
            });
            if (!line) {
                throw new Error(`Bank statement line ${lineId} not found`);
            }

            const entry = await tx.journalEntry.findFirst({
                where: { id: journalEntryId, tenantId }
            });
            if (!entry) {
                throw new Error(`Journal entry ${journalEntryId} not found`);
            }

            const updatedLine = await tx.bankStatementLine.update({
                where: { id: lineId },
                data: {
                    status: 'MATCHED',
                    matchedJournalEntryId: journalEntryId
                }
            });

            return {
                message: 'Bank statement line matched to existing journal entry without creating duplicates',
                line: updatedLine
            };
        };

        if (externalTx) return await runWithTx(externalTx);
        return await prisma.$transaction(async (tx) => runWithTx(tx), { maxWait: 10000, timeout: 30000 });
    }

    /**
     * Categorize an unrecorded statement line and post a new journal entry
     * (e.g. unrecorded bank charges, interest, or direct debits)
     */
    async categorizeAndPostUnmatchedLine(tenantId, lineId, options = {}, externalTx = null) {
        const runWithTx = async (tx) => {
            const line = await tx.bankStatementLine.findFirst({
                where: { id: lineId, tenantId },
                include: { bankAccount: { include: { account: true } } }
            });
            if (!line) {
                throw new Error(`Bank statement line ${lineId} not found`);
            }

            if (line.status === 'MATCHED' || line.status === 'JOURNAL_CREATED') {
                throw new Error(`Line ${lineId} is already reconciled (${line.status})`);
            }

            const targetAccountCode = options.targetAccountCode;
            if (!targetAccountCode) {
                throw new Error('targetAccountCode is required to categorize an unmatched line');
            }

            const targetAccount = await chartOfAccountsService.getAccountByCode(tenantId, targetAccountCode);
            if (!targetAccount) {
                throw new Error(`Target account code ${targetAccountCode} not found`);
            }

            const bankAccountCode = line.bankAccount.account.accountCode;
            const amount = parseFloat(line.amount.toString());

            let lines = [];
            if (line.lineType === 'debit') {
                // Bank Money Out: Dr Target Account / Cr 1110 Bank
                lines = [
                    {
                        accountCode: targetAccountCode,
                        debit: amount,
                        credit: 0,
                        description: line.description
                    },
                    {
                        accountCode: bankAccountCode,
                        debit: 0,
                        credit: amount,
                        description: `Bank withdrawal - ${line.description}`
                    }
                ];
            } else {
                // Bank Money In: Dr 1110 Bank / Cr Target Account
                lines = [
                    {
                        accountCode: bankAccountCode,
                        debit: amount,
                        credit: 0,
                        description: `Bank deposit - ${line.description}`
                    },
                    {
                        accountCode: targetAccountCode,
                        debit: 0,
                        credit: amount,
                        description: line.description
                    }
                ];
            }

            const postResult = await postingService.postJournalEntry({
                tenantId,
                entryDate: line.lineDate,
                sourceType: 'bank_line',
                sourceId: line.id,
                memo: `Bank statement line posting: ${line.description}`,
                lines
            }, tx);

            const updatedLine = await tx.bankStatementLine.update({
                where: { id: lineId },
                data: {
                    status: 'JOURNAL_CREATED',
                    matchedJournalEntryId: postResult.entry.id
                }
            });

            return {
                line: updatedLine,
                journalEntry: postResult.entry
            };
        };

        if (externalTx) return await runWithTx(externalTx);
        return await prisma.$transaction(async (tx) => runWithTx(tx), { maxWait: 10000, timeout: 30000 });
    }

    /**
     * Get statement lines for a bank account with filters
     */
    async getStatementLines(tenantId, bankAccountId, options = {}) {
        const where = { tenantId, bankAccountId };
        if (options.status) where.status = options.status;

        const lines = await prisma.bankStatementLine.findMany({
            where,
            orderBy: { lineDate: 'desc' }
        });

        return lines.map(l => ({
            id: l.id,
            lineDate: l.lineDate,
            description: l.description,
            amount: parseFloat(l.amount.toString()),
            lineType: l.lineType,
            status: l.status,
            matchedJournalEntryId: l.matchedJournalEntryId,
            reference: l.reference
        }));
    }

    /**
     * Bank Reconciliation Summary Report
     * Compares General Ledger balance against bank statement lines
     */
    async getBankReconciliationSummary(tenantId, bankAccountId) {
        const bankAccount = await prisma.bankAccount.findFirst({
            where: { id: bankAccountId, tenantId },
            include: { account: true }
        });

        if (!bankAccount) {
            throw new Error(`Bank account ${bankAccountId} not found`);
        }

        const ledger = await journalService.getAccountLedger(tenantId, bankAccount.account.accountCode);
        const glBalance = ledger.endingBalance;

        const allLines = await prisma.bankStatementLine.findMany({
            where: { tenantId, bankAccountId }
        });

        const matchedCount = allLines.filter(l => l.status === 'MATCHED' || l.status === 'JOURNAL_CREATED').length;
        const unmatchedCount = allLines.filter(l => l.status === 'UNMATCHED' || l.status === 'MATCH_SUGGESTED').length;

        // Sum debits and credits on statement
        let statementNet = 0;
        for (const line of allLines) {
            const amt = parseFloat(line.amount.toString());
            if (line.lineType === 'credit') statementNet += amt;
            else statementNet -= amt;
        }

        return {
            bankAccount: {
                id: bankAccount.id,
                name: bankAccount.accountName,
                code: bankAccount.account.accountCode,
                bankName: bankAccount.bankName
            },
            glBalance,
            statementCalculatedNet: parseFloat(statementNet.toFixed(2)),
            difference: parseFloat((glBalance - statementNet).toFixed(2)),
            totalLines: allLines.length,
            matchedCount,
            unmatchedCount,
            isBalanced: Math.abs(glBalance - statementNet) < 0.01
        };
    }
}

module.exports = new BankManagementService();
