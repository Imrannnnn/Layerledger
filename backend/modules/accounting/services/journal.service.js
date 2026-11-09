/**
 * LayerLedger Journal Service
 * Queries, filters, and inspects posted journal entries and general ledger history.
 * Read-only operations for journal auditing and report reconciliation.
 */

const prisma = require('../../../prisma');
const chartOfAccountsService = require('./chartOfAccounts.service');

class JournalService {
    /**
     * Retrieve journal entries for a tenant with filtering and pagination.
     */
    async getJournalEntries(tenantId, options = {}) {
        const {
            page = 1,
            limit = 50,
            startDate,
            endDate,
            sourceType,
            status,
            accountCode
        } = options;

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
        const skip = (pageNum - 1) * limitNum;

        const where = { tenantId };

        if (status) {
            where.status = status;
        }

        if (sourceType) {
            where.sourceType = sourceType;
        }

        if (startDate || endDate) {
            where.entryDate = {};
            if (startDate) where.entryDate.gte = new Date(startDate);
            if (endDate) where.entryDate.lte = new Date(endDate);
        }

        if (accountCode) {
            where.lines = {
                some: {
                    account: { accountCode: String(accountCode) }
                }
            };
        }

        const [entries, total] = await Promise.all([
            prisma.journalEntry.findMany({
                where,
                skip,
                take: limitNum,
                orderBy: [
                    { entryDate: 'desc' },
                    { createdAt: 'desc' }
                ],
                include: {
                    lines: {
                        include: {
                            account: {
                                select: {
                                    id: true,
                                    accountCode: true,
                                    accountName: true,
                                    classification: true,
                                    accountType: true
                                }
                            }
                        }
                    },
                    reversalOf: {
                        select: { id: true, entryNumber: true }
                    },
                    reversedBy: {
                        select: { id: true, entryNumber: true }
                    }
                }
            }),
            prisma.journalEntry.count({ where })
        ]);

        const enrichedEntries = entries.map(entry => {
            let totalDebit = 0;
            let totalCredit = 0;
            const lines = entry.lines.map(line => {
                const d = parseFloat(line.debit.toString());
                const c = parseFloat(line.credit.toString());
                totalDebit += d;
                totalCredit += c;
                return {
                    id: line.id,
                    accountId: line.accountId,
                    accountCode: line.account.accountCode,
                    accountName: line.account.accountName,
                    classification: line.account.classification,
                    debit: d,
                    credit: c,
                    description: line.description
                };
            });

            return {
                id: entry.id,
                entryNumber: entry.entryNumber,
                entryDate: entry.entryDate,
                memo: entry.memo,
                sourceType: entry.sourceType,
                sourceId: entry.sourceId,
                status: entry.status,
                reversalOfId: entry.reversalOfId,
                reversalOfNumber: entry.reversalOf?.entryNumber || null,
                reversedByNumber: entry.reversedBy?.entryNumber || null,
                createdBy: entry.createdBy,
                createdAt: entry.createdAt,
                totalAmount: totalDebit,
                isBalanced: Math.abs(totalDebit - totalCredit) < 0.001,
                lines
            };
        });

        return {
            data: enrichedEntries,
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                totalPages: Math.ceil(total / limitNum)
            }
        };
    }

    /**
     * Retrieve a single journal entry by ID.
     */
    async getJournalEntryById(tenantId, entryId) {
        const entry = await prisma.journalEntry.findFirst({
            where: { id: entryId, tenantId },
            include: {
                lines: {
                    include: {
                        account: true
                    }
                },
                reversalOf: {
                    select: { id: true, entryNumber: true }
                },
                reversedBy: {
                    select: { id: true, entryNumber: true }
                }
            }
        });

        if (!entry) return null;

        let totalDebit = 0;
        let totalCredit = 0;
        const lines = entry.lines.map(l => {
            const d = parseFloat(l.debit.toString());
            const c = parseFloat(l.credit.toString());
            totalDebit += d;
            totalCredit += c;
            return {
                id: l.id,
                accountId: l.accountId,
                accountCode: l.account.accountCode,
                accountName: l.account.accountName,
                classification: l.account.classification,
                debit: d,
                credit: c,
                description: l.description
            };
        });

        return {
            ...entry,
            totalDebit,
            totalCredit,
            lines
        };
    }

    /**
     * General Ledger account inquiry: all debit/credit lines and running balance for one account.
     */
    async getAccountLedger(tenantId, accountCodeOrId, _options = {}) {
        let account = await chartOfAccountsService.getAccountByCode(tenantId, accountCodeOrId);
        if (!account) {
            account = await chartOfAccountsService.getAccountById(tenantId, accountCodeOrId);
        }
        if (!account) {
            throw new Error(`Account not found: ${accountCodeOrId}`);
        }

        const lines = await prisma.journalLine.findMany({
            where: {
                tenantId,
                accountId: account.id,
                journalEntry: {
                    status: { in: ['POSTED', 'REVERSED'] }
                }
            },
            include: {
                journalEntry: {
                    select: {
                        entryNumber: true,
                        entryDate: true,
                        memo: true,
                        sourceType: true,
                        sourceId: true
                    }
                }
            },
            orderBy: [
                { journalEntry: { entryDate: 'asc' } },
                { id: 'asc' }
            ]
        });

        // Determine normal balance side:
        // Assets & Expenses: normal balance = Debit (Debit - Credit)
        // Contra Assets (1290, 1295), Liabilities, Equity, Revenue: normal balance = Credit (Credit - Debit)
        const isContraAsset = account.accountType === 'FIXED_ASSET_CONTRA';
        const isDebitNormal =
            !isContraAsset && (
                account.classification === 'ASSET' ||
                account.classification === 'COGS' ||
                account.classification === 'ADMIN_EXPENSE' ||
                account.classification === 'OTHER_EXPENSE'
            );

        let runningBalance = 0;
        const ledgerRows = lines.map(line => {
            const debit = parseFloat(line.debit.toString());
            const credit = parseFloat(line.credit.toString());

            if (isDebitNormal) {
                runningBalance += (debit - credit);
            } else {
                runningBalance += (credit - debit);
            }

            return {
                id: line.id,
                entryNumber: line.journalEntry.entryNumber,
                entryDate: line.journalEntry.entryDate,
                memo: line.description || line.journalEntry.memo,
                sourceType: line.journalEntry.sourceType,
                sourceId: line.journalEntry.sourceId,
                debit,
                credit,
                runningBalance
            };
        });

        return {
            account: {
                id: account.id,
                code: account.accountCode,
                name: account.accountName,
                classification: account.classification,
                normalSide: isDebitNormal ? 'DEBIT' : 'CREDIT',
                closingBalance: runningBalance.toFixed(2)
            },
            totalEntries: lines.length,
            endingBalance: runningBalance,
            closingBalance: runningBalance.toFixed(2),
            transactions: ledgerRows
        };
    }
}

module.exports = new JournalService();
