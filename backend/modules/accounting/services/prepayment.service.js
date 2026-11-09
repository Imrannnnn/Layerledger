/**
 * LayerLedger Prepayment & Amortisation Engine
 * Implements the prepayment accounting rule:
 * "Internet paid three to six months in advance is a prepayment, not an expense,
 * which generalises: any service paid for a future period."
 *
 * Lifecycle:
 * 1. Initial advance payment:
 *    Dr 1130 Other Receivable & Prepaid Expenses
 *    Cr 1110 Bank (or 2100 Accounts Payable)
 * 2. Monthly amortisation release:
 *    Dr 5070 / 6010 / 6050 / 6060 (Destination Expense Account)
 *    Cr 1130 Other Receivable & Prepaid Expenses
 * 3. Batch release for periodic closing.
 */

const prisma = require('../../../prisma');
const postingService = require('./posting.service');
const chartOfAccountsService = require('./chartOfAccounts.service');

class PrepaymentService {
    /**
     * Create a new prepayment schedule
     */
    async createPrepaymentSchedule(tenantId, data, externalTx = null) {
        const runWithTx = async (tx) => {
            const totalAmount = parseFloat(data.totalAmount || 0);
            if (totalAmount <= 0) {
                throw new Error('Prepayment total amount must be greater than zero');
            }

            const totalMonths = parseInt(data.totalMonths || data.durationMonths || 1, 10);
            if (totalMonths <= 0) {
                throw new Error('Prepayment duration must be at least 1 month');
            }

            const startDate = data.startDate ? new Date(data.startDate) : new Date();
            const endDate = data.endDate
                ? new Date(data.endDate)
                : new Date(startDate.getFullYear(), startDate.getMonth() + totalMonths, 0);

            const monthlyAmount = parseFloat((totalAmount / totalMonths).toFixed(2));

            // Asset Account: 1130 Other Receivable & Prepaid Expenses
            const assetAccount = await chartOfAccountsService.getAccountByCode(tenantId, '1130');
            if (!assetAccount) {
                throw new Error('Account 1130 Other Receivable & Prepaid Expenses not found');
            }

            // Destination Expense Account (e.g. 6050 Internet, 5070 Production Rent, 6010 Rent, 6060 Insurance, 6000 Operating Rent)
            const expenseAccountCode = data.expenseAccountCode || data.targetAccountCode || '6050';
            const expenseAccount = await chartOfAccountsService.getAccountByCode(tenantId, expenseAccountCode);
            if (!expenseAccount) {
                throw new Error(`Expense account code ${expenseAccountCode} not found in chart of accounts`);
            }

            let journalEntry = null;

            // If requested, post initial payment entry (Dr 1130 / Cr 1110 Bank or 2100 AP)
            if (data.postInitialEntry) {
                const isPayable = String(data.paymentMethod || '').toLowerCase() === 'credit';
                const creditAccount = isPayable ? '2100' : '1110';

                const postResult = await postingService.postJournalEntry({
                    tenantId,
                    entryDate: startDate,
                    sourceType: 'prepayment_init',
                    memo: `Advance payment for: ${data.description}`,
                    lines: [
                        {
                            accountCode: '1130',
                            debit: totalAmount,
                            credit: 0,
                            description: `Prepaid advance - ${data.description}`
                        },
                        {
                            accountCode: creditAccount,
                            debit: 0,
                            credit: totalAmount,
                            description: `Payment for prepaid service - ${data.description}`
                        }
                    ]
                }, tx);
                journalEntry = postResult.entry;
            }

            const schedule = await tx.prepaymentSchedule.create({
                data: {
                    tenantId,
                    description: data.description,
                    totalAmount,
                    assetAccountId: assetAccount.id,
                    expenseAccountId: expenseAccount.id,
                    startDate,
                    endDate,
                    totalMonths,
                    monthlyAmount,
                    releasedAmount: 0,
                    status: 'ACTIVE',
                    sourcePurchaseId: data.sourcePurchaseId || null
                },
                include: {
                    releases: true
                }
            });

            return {
                schedule,
                journalEntry,
                monthlyAmount
            };
        };

        if (externalTx) return await runWithTx(externalTx);
        return await prisma.$transaction(async (tx) => runWithTx(tx), { maxWait: 10000, timeout: 30000 });
    }

    /**
     * Release monthly portion of a prepayment into P&L expenses
     * Dr Destination Expense Account (e.g. 6050)
     * Cr 1130 Other Receivable & Prepaid Expenses
     */
    async releasePrepaymentForPeriod(tenantId, scheduleId, periodDate, externalTx = null) {
        const runWithTx = async (tx) => {
            const schedule = await tx.prepaymentSchedule.findFirst({
                where: { id: scheduleId, tenantId }
            });

            if (!schedule) {
                throw new Error(`Prepayment schedule ${scheduleId} not found`);
            }

            if (schedule.status === 'FULLY_AMORTIZED') {
                return {
                    message: `Prepayment schedule "${schedule.description}" is already fully amortized`,
                    fullyAmortized: true,
                    releasedAmount: parseFloat(schedule.releasedAmount.toString())
                };
            }

            const pDate = new Date(periodDate);
            const endOfMonth = new Date(pDate.getFullYear(), pDate.getMonth() + 1, 0, 23, 59, 59, 999);

            // Prevent duplicate release for the same month
            const existingRelease = await tx.prepaymentRelease.findFirst({
                where: {
                    scheduleId,
                    periodDate: {
                        gte: new Date(pDate.getFullYear(), pDate.getMonth(), 1),
                        lte: endOfMonth
                    }
                }
            });

            if (existingRelease) {
                return {
                    message: `Prepayment schedule "${schedule.description}" already released for ${pDate.getFullYear()}-${String(pDate.getMonth() + 1).padStart(2, '0')}`,
                    alreadyReleased: true,
                    release: existingRelease
                };
            }

            const total = parseFloat(schedule.totalAmount.toString());
            const alreadyReleased = parseFloat(schedule.releasedAmount.toString());
            const standardMonthly = parseFloat(schedule.monthlyAmount.toString());

            const remaining = parseFloat((total - alreadyReleased).toFixed(2));
            const releaseAmount = Math.min(standardMonthly, remaining);

            if (releaseAmount <= 0) {
                await tx.prepaymentSchedule.update({
                    where: { id: scheduleId },
                    data: { status: 'FULLY_AMORTIZED' }
                });
                return {
                    message: `Schedule fully amortized`,
                    fullyAmortized: true
                };
            }

            // Fetch destination expense account
            const expenseAccount = await tx.account.findUnique({
                where: { id: schedule.expenseAccountId }
            });
            if (!expenseAccount) {
                throw new Error('Destination expense account not found');
            }

            const monthStr = `${pDate.getFullYear()}-${String(pDate.getMonth() + 1).padStart(2, '0')}`;
            const memo = `Prepayment amortisation: ${schedule.description} (${monthStr})`;

            // Post double-entry: Dr Expense Account / Cr 1130 Prepayments
            const postResult = await postingService.postJournalEntry({
                tenantId,
                entryDate: endOfMonth,
                sourceType: 'prepayment_release',
                sourceId: scheduleId,
                memo,
                lines: [
                    {
                        accountCode: expenseAccount.accountCode,
                        debit: releaseAmount,
                        credit: 0,
                        description: `Amortised expense - ${schedule.description}`
                    },
                    {
                        accountCode: '1130',
                        debit: 0,
                        credit: releaseAmount,
                        description: `Relieve prepaid expense - ${schedule.description}`
                    }
                ]
            }, tx);

            // Record release
            const releaseRecord = await tx.prepaymentRelease.create({
                data: {
                    scheduleId,
                    periodDate: endOfMonth,
                    amount: releaseAmount,
                    journalEntryId: postResult.entry.id
                }
            });

            // Update schedule released amount and status
            const newReleased = parseFloat((alreadyReleased + releaseAmount).toFixed(2));
            const isFullyAmortized = newReleased >= total;

            const updatedSchedule = await tx.prepaymentSchedule.update({
                where: { id: scheduleId },
                data: {
                    releasedAmount: newReleased,
                    status: isFullyAmortized ? 'FULLY_AMORTIZED' : 'ACTIVE'
                }
            });

            return {
                release: releaseRecord,
                journalEntry: postResult.entry,
                schedule: updatedSchedule,
                releaseAmount,
                newReleasedAmount: newReleased,
                isFullyAmortized
            };
        };

        if (externalTx) return await runWithTx(externalTx);
        return await prisma.$transaction(async (tx) => runWithTx(tx), { maxWait: 10000, timeout: 30000 });
    }

    /**
     * Batch release all active prepayment schedules for a period
     */
    async runMonthlyPrepaymentReleases(tenantId, periodDate = new Date(), externalTx = null) {
        const runWithTx = async (tx) => {
            const pDate = new Date(periodDate);
            const activeSchedules = await tx.prepaymentSchedule.findMany({
                where: {
                    tenantId,
                    status: 'ACTIVE',
                    startDate: { lte: pDate }
                }
            });

            const results = [];
            for (const schedule of activeSchedules) {
                const res = await this.releasePrepaymentForPeriod(tenantId, schedule.id, pDate, tx);
                results.push({
                    scheduleId: schedule.id,
                    description: schedule.description,
                    ...res
                });
            }

            return {
                period: `${pDate.getFullYear()}-${String(pDate.getMonth() + 1).padStart(2, '0')}`,
                totalProcessed: results.length,
                totalReleased: results.reduce((sum, r) => sum + (r.releaseAmount || 0), 0),
                results
            };
        };

        if (externalTx) return await runWithTx(externalTx);
        return await prisma.$transaction(async (tx) => runWithTx(tx), { maxWait: 10000, timeout: 30000 });
    }

    /**
     * Get prepayment schedules list
     */
    async getPrepaymentSchedules(tenantId, options = {}) {
        const where = { tenantId };
        if (options.status) where.status = options.status;

        const schedules = await prisma.prepaymentSchedule.findMany({
            where,
            include: {
                releases: {
                    orderBy: { periodDate: 'desc' },
                    take: 5
                }
            },
            orderBy: { startDate: 'desc' }
        });

        // Resolve expense account codes for readable display
        const accountIds = schedules.map(s => s.expenseAccountId);
        const accounts = await prisma.account.findMany({
            where: { id: { in: accountIds } }
        });
        const accountMap = new Map(accounts.map(a => [a.id, a]));

        return schedules.map(s => {
            const expAcc = accountMap.get(s.expenseAccountId);
            const total = parseFloat(s.totalAmount.toString());
            const released = parseFloat(s.releasedAmount.toString());
            return {
                id: s.id,
                description: s.description,
                totalAmount: total,
                monthlyAmount: parseFloat(s.monthlyAmount.toString()),
                releasedAmount: released,
                remainingAmount: parseFloat(Math.max(0, total - released).toFixed(2)),
                startDate: s.startDate,
                endDate: s.endDate,
                totalMonths: s.totalMonths,
                expenseAccountCode: expAcc?.accountCode || '',
                expenseAccountName: expAcc?.accountName || '',
                status: s.status,
                recentReleases: s.releases.map(r => ({
                    id: r.id,
                    periodDate: r.periodDate,
                    amount: parseFloat(r.amount.toString()),
                    createdAt: r.createdAt
                }))
            };
        });
    }

    /**
     * Get single prepayment schedule details
     */
    async getPrepaymentScheduleById(tenantId, scheduleId) {
        const schedule = await prisma.prepaymentSchedule.findFirst({
            where: { id: scheduleId, tenantId },
            include: {
                releases: {
                    orderBy: { periodDate: 'desc' }
                }
            }
        });

        if (!schedule) return null;

        const expenseAccount = await prisma.account.findUnique({
            where: { id: schedule.expenseAccountId }
        });

        const total = parseFloat(schedule.totalAmount.toString());
        const released = parseFloat(schedule.releasedAmount.toString());

        return {
            id: schedule.id,
            description: schedule.description,
            totalAmount: total,
            monthlyAmount: parseFloat(schedule.monthlyAmount.toString()),
            releasedAmount: released,
            remainingAmount: parseFloat(Math.max(0, total - released).toFixed(2)),
            startDate: schedule.startDate,
            endDate: schedule.endDate,
            totalMonths: schedule.totalMonths,
            expenseAccountCode: expenseAccount?.accountCode || '',
            expenseAccountName: expenseAccount?.accountName || '',
            status: schedule.status,
            releases: schedule.releases.map(r => ({
                id: r.id,
                periodDate: r.periodDate,
                amount: parseFloat(r.amount.toString()),
                journalEntryId: r.journalEntryId,
                createdAt: r.createdAt
            }))
        };
    }
}

module.exports = new PrepaymentService();
