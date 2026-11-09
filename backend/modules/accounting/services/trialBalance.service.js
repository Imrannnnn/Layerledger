/**
 * LayerLedger Trial Balance Service
 * Verifies the fundamental double-entry invariant: Sum(Debits) === Sum(Credits).
 * Computed directly from posted journal entries.
 */

const prisma = require('../../../prisma');
const chartOfAccountsService = require('./chartOfAccounts.service');

class TrialBalanceService {
    /**
     * Compute Trial Balance as of a specific date
     */
    async getTrialBalance(tenantId, options = {}) {
        let asOfDate = options.asOfDate ? new Date(options.asOfDate) : new Date();
        asOfDate.setHours(23, 59, 59, 999);

        const lines = await prisma.journalLine.findMany({
            where: {
                tenantId,
                journalEntry: {
                    status: 'POSTED',
                    entryDate: { lte: asOfDate }
                }
            },
            include: {
                account: true
            }
        });

        // Group by account code
        const map = new Map();
        for (const line of lines) {
            const code = line.account.accountCode;
            const debit = parseFloat(line.debit.toString());
            const credit = parseFloat(line.credit.toString());

            if (!map.has(code)) {
                map.set(code, {
                    code,
                    name: line.account.accountName,
                    classification: line.account.classification,
                    accountType: line.account.accountType,
                    totalDebit: 0,
                    totalCredit: 0
                });
            }

            const item = map.get(code);
            item.totalDebit += debit;
            item.totalCredit += credit;
        }

        const accounts = await chartOfAccountsService.getAccounts(tenantId, { isActive: true });

        const rows = [];
        let totalDebitBalance = 0;
        let totalCreditBalance = 0;

        for (const acc of accounts) {
            const data = map.get(acc.accountCode);
            if (!data && !options.includeZero) continue;

            const d = data ? parseFloat(data.totalDebit.toFixed(2)) : 0;
            const c = data ? parseFloat(data.totalCredit.toFixed(2)) : 0;
            const diff = parseFloat((d - c).toFixed(2));

            let debitBalance = 0;
            let creditBalance = 0;

            if (diff > 0) {
                debitBalance = diff;
            } else if (diff < 0) {
                creditBalance = Math.abs(diff);
            }

            rows.push({
                accountCode: acc.accountCode,
                accountName: acc.accountName,
                classification: acc.classification,
                accountType: acc.accountType,
                totalDebit: d,
                totalCredit: c,
                debitBalance,
                creditBalance
            });

            totalDebitBalance += debitBalance;
            totalCreditBalance += creditBalance;
        }

        totalDebitBalance = parseFloat(totalDebitBalance.toFixed(2));
        totalCreditBalance = parseFloat(totalCreditBalance.toFixed(2));
        const difference = parseFloat((totalDebitBalance - totalCreditBalance).toFixed(2));
        const isBalanced = Math.abs(difference) < 0.01;

        return {
            asOfDate,
            totalDebitBalance,
            totalCreditBalance,
            difference,
            isBalanced,
            accounts: rows
        };
    }
}

module.exports = new TrialBalanceService();
