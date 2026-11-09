/**
 * LayerLedger Journal Posting Engine
 * Enforces fundamental accounting invariants:
 * 1. Double-entry zero-sum: sum(debit) === sum(credit)
 * 2. Non-negative, one-sided lines (debit XOR credit)
 * 3. Strict tenant boundary isolation
 * 4. Atomic persistence in database transactions
 * 5. Idempotent posting protection against duplicate triggers
 * 6. Immutability: Posted records are append-only; corrections require reversals
 */

const prisma = require('../../../prisma');
const chartOfAccountsService = require('./chartOfAccounts.service');
const { toDecimal, isPositive, equals, sum, formatDecimal } = require('../utils/decimal');
const { ENTRY_STATUS } = require('../accounting.constants');

class PostingService {
    /**
     * Generate next sequential entry number for a tenant (e.g. JE-2026-00001)
     */
    async generateEntryNumber(tenantId, entryDate, tx) {
        const year = (entryDate instanceof Date ? entryDate : new Date(entryDate)).getFullYear();
        const prefix = `JE-${year}-`;

        const lastEntry = await tx.journalEntry.findFirst({
            where: {
                tenantId,
                entryNumber: { startsWith: prefix }
            },
            orderBy: { entryNumber: 'desc' },
            select: { entryNumber: true }
        });

        let nextSeq = 1;
        if (lastEntry && lastEntry.entryNumber) {
            const currentSeqStr = lastEntry.entryNumber.replace(prefix, '');
            const parsed = parseInt(currentSeqStr, 10);
            if (!isNaN(parsed)) {
                nextSeq = parsed + 1;
            }
        }

        return `${prefix}${String(nextSeq).padStart(5, '0')}`;
    }

    /**
     * Core Double-Entry Posting Method
     * Validates and posts an entry atomically.
     */
    async postJournalEntry(entryData, externalTx = null) {
        const {
            tenantId,
            entryDate = new Date(),
            sourceType = 'manual',
            sourceId = null,
            memo = null,
            lines,
            createdBy = null,
            reversalOfId = null
        } = entryData;

        if (!tenantId) {
            throw new Error('Tenant ID is required for journal entry');
        }

        if (!Array.isArray(lines) || lines.length < 2) {
            throw new Error('A journal entry must contain at least two lines');
        }

        const runWithTx = async (tx) => {
            // Idempotency check: if sourceType and sourceId provided (and not manual or reversal),
            // check if an active entry already exists
            if (sourceType !== 'manual' && sourceType !== 'reversal' && sourceId) {
                const existing = await tx.journalEntry.findFirst({
                    where: {
                        tenantId,
                        sourceType,
                        sourceId,
                        status: ENTRY_STATUS.POSTED
                    },
                    include: { lines: { include: { account: true } } }
                });

                if (existing) {
                    return {
                        entry: existing,
                        alreadyPosted: true
                    };
                }
            }

            // Batch prefetch accounts for lines to optimize transaction latency
            const prefetchCodes = lines.filter(l => l.accountCode).map(l => String(l.accountCode));
            const prefetchIds = lines.filter(l => l.accountId).map(l => String(l.accountId));
            const orConditions = [];
            if (prefetchCodes.length > 0) orConditions.push({ accountCode: { in: prefetchCodes } });
            if (prefetchIds.length > 0) orConditions.push({ id: { in: prefetchIds } });

            const prefetchedAccounts = orConditions.length > 0
                ? await tx.account.findMany({
                    where: {
                        tenantId,
                        OR: orConditions
                    }
                })
                : [];

            const accountMapByCode = new Map(prefetchedAccounts.map(a => [a.accountCode, a]));
            const accountMapById = new Map(prefetchedAccounts.map(a => [a.id, a]));

            // Resolve and validate all accounts and amounts
            let totalDebit = toDecimal('0.00');
            let totalCredit = toDecimal('0.00');
            const validatedLines = [];

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const lineIndex = i + 1;

                let account = null;
                if (line.accountId) {
                    account = accountMapById.get(String(line.accountId)) || await chartOfAccountsService.getAccountById(tenantId, line.accountId, tx);
                } else if (line.accountCode) {
                    account = accountMapByCode.get(String(line.accountCode)) || await chartOfAccountsService.getAccountByCode(tenantId, String(line.accountCode), tx);
                }

                if (!account) {
                    throw new Error(
                        `Line ${lineIndex}: Account not found for business (code: ${line.accountCode || 'N/A'}, id: ${line.accountId || 'N/A'})`
                    );
                }

                if (account.tenantId !== tenantId) {
                    throw new Error(`Security Violation: Line ${lineIndex} references an account from another tenant`);
                }

                const debit = toDecimal(line.debit || 0);
                const credit = toDecimal(line.credit || 0);

                if (debit.isNegative() || credit.isNegative()) {
                    throw new Error(`Line ${lineIndex}: Negative amounts are prohibited. Use debit or credit columns.`);
                }

                const hasDebit = isPositive(debit);
                const hasCredit = isPositive(credit);

                if (hasDebit && hasCredit) {
                    throw new Error(`Line ${lineIndex}: A line cannot have both a debit and a credit amount.`);
                }

                if (!hasDebit && !hasCredit) {
                    throw new Error(`Line ${lineIndex}: Line must contain a non-zero debit or credit.`);
                }

                totalDebit = sum(totalDebit, debit);
                totalCredit = sum(totalCredit, credit);

                validatedLines.push({
                    tenantId,
                    accountId: account.id,
                    debit,
                    credit,
                    description: line.description || memo || null
                });
            }

            // Invariant: Debits MUST equal Credits
            if (!equals(totalDebit, totalCredit)) {
                const diff = totalDebit.minus(totalCredit).abs();
                throw new Error(
                    `Unbalanced Journal Entry: Debits (₦${formatDecimal(totalDebit)}) do not equal Credits (₦${formatDecimal(totalCredit)}). Out of balance by ₦${formatDecimal(diff)}.`
                );
            }

            // Generate sequential entry number
            const effectiveDate = entryDate instanceof Date ? entryDate : new Date(entryDate);
            const entryNumber = await this.generateEntryNumber(tenantId, effectiveDate, tx);

            // Persist header and lines atomically
            const createdEntry = await tx.journalEntry.create({
                data: {
                    tenantId,
                    entryNumber,
                    entryDate: effectiveDate,
                    memo,
                    sourceType,
                    sourceId: sourceId ? String(sourceId) : null,
                    status: ENTRY_STATUS.POSTED,
                    reversalOfId,
                    createdBy,
                    lines: {
                        create: validatedLines.map(vl => ({
                            tenantId: vl.tenantId,
                            accountId: vl.accountId,
                            debit: vl.debit,
                            credit: vl.credit,
                            description: vl.description
                        }))
                    }
                },
                include: {
                    lines: {
                        include: { account: true }
                    }
                }
            });

            return {
                entry: createdEntry,
                alreadyPosted: false
            };
        };

        if (externalTx) {
            return await runWithTx(externalTx);
        }

        return await prisma.$transaction(async (tx) => {
            return await runWithTx(tx);
        }, { maxWait: 15000, timeout: 60000 });
    }
}

module.exports = new PostingService();
