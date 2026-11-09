/**
 * LayerLedger Financial Dashboard Metrics Service
 * Implements Rule 3 & the 3 Foundation Metrics from the BakeWealth spec:
 * 1. Cash received this month (all naira in)
 * 2. Revenue this month (delivered orders only)
 * 3. Paid for and not delivered (balance on 2120 Customer Deposits)
 */

const prisma = require('../../../prisma');
const chartOfAccountsService = require('./chartOfAccounts.service');
const journalService = require('./journal.service');

class FinancialDashboardService {
    /**
     * Compute dashboard financial figures for a given month or current month
     */
    async getDashboardMetrics(tenantId, options = {}) {
        const now = new Date();
        const year = options.year ? parseInt(options.year, 10) : now.getFullYear();
        const month = options.month ? parseInt(options.month, 10) : now.getMonth() + 1; // 1-12

        const startOfMonth = new Date(year, month - 1, 1, 0, 0, 0, 0);
        const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

        // Fetch all posted journal lines for the month
        const monthlyLines = await prisma.journalLine.findMany({
            where: {
                tenantId,
                journalEntry: {
                    status: 'POSTED',
                    entryDate: { gte: startOfMonth, lte: endOfMonth }
                }
            },
            include: {
                account: true,
                journalEntry: true
            }
        });

        // ══════════════════════════════════════════════════════════════════════════
        // METRIC 1: Cash received this month (all naira in)
        // Debits to Bank (1110) and Cash (1100), excluding internal own-account transfers
        // ══════════════════════════════════════════════════════════════════════════
        let cashReceivedThisMonth = 0;
        let cashSpentThisMonth = 0;

        for (const line of monthlyLines) {
            const code = line.account.accountCode;
            const isCashOrBank = code === '1100' || code === '1110';
            const isInternalTransfer = line.journalEntry.sourceType === 'bank_transfer';

            if (isCashOrBank && !isInternalTransfer) {
                const debit = parseFloat(line.debit.toString());
                const credit = parseFloat(line.credit.toString());

                cashReceivedThisMonth += debit;
                cashSpentThisMonth += credit;
            }
        }
        cashReceivedThisMonth = parseFloat(cashReceivedThisMonth.toFixed(2));
        cashSpentThisMonth = parseFloat(cashSpentThisMonth.toFixed(2));

        // ══════════════════════════════════════════════════════════════════════════
        // METRIC 2: Revenue this month (delivered orders only)
        // Credits to 4000, 4040, 4060, 4070 (Revenue classification)
        // ══════════════════════════════════════════════════════════════════════════
        let revenueThisMonth = 0;
        let cogsThisMonth = 0;
        let operatingExpensesThisMonth = 0;

        for (const line of monthlyLines) {
            const code = line.account.accountCode;
            const cls = line.account.classification;
            const debit = parseFloat(line.debit.toString());
            const credit = parseFloat(line.credit.toString());

            if (cls === 'REVENUE') {
                revenueThisMonth += (credit - debit);
            } else if (cls === 'COGS') {
                cogsThisMonth += (debit - credit);
            } else if (cls === 'ADMIN_EXPENSE') {
                operatingExpensesThisMonth += (debit - credit);
            }
        }

        revenueThisMonth = parseFloat(revenueThisMonth.toFixed(2));
        cogsThisMonth = parseFloat(cogsThisMonth.toFixed(2));
        operatingExpensesThisMonth = parseFloat(operatingExpensesThisMonth.toFixed(2));

        const grossProfitThisMonth = parseFloat((revenueThisMonth - cogsThisMonth).toFixed(2));
        const netProfitThisMonth = parseFloat((grossProfitThisMonth - operatingExpensesThisMonth).toFixed(2));

        // ══════════════════════════════════════════════════════════════════════════
        // METRIC 3: Paid for and not delivered (balance on Customer Deposits 2120)
        // ══════════════════════════════════════════════════════════════════════════
        let paidForAndNotDelivered = 0;
        try {
            const depositLedger = await journalService.getAccountLedger(tenantId, '2120');
            paidForAndNotDelivered = depositLedger.endingBalance;
        } catch (e) {
            paidForAndNotDelivered = 0;
        }

        // Live Balances on key operational accounts:
        // Accounts Receivable (1120) - delivered cakes not yet paid for
        let accountsReceivableBalance = 0;
        try {
            const arLedger = await journalService.getAccountLedger(tenantId, '1120');
            accountsReceivableBalance = arLedger.endingBalance;
        } catch (e) {
            accountsReceivableBalance = 0;
        }

        // Cash on Hand (1100) + Bank (1110)
        let totalCashAndBank = 0;
        let cashOnHandBalance = 0;
        let bankBalance = 0;
        try {
            const cashLedger = await journalService.getAccountLedger(tenantId, '1100');
            cashOnHandBalance = cashLedger.endingBalance;
            const bankLedger = await journalService.getAccountLedger(tenantId, '1110');
            bankBalance = bankLedger.endingBalance;
            totalCashAndBank = parseFloat((cashOnHandBalance + bankBalance).toFixed(2));
        } catch (e) {
            totalCashAndBank = 0;
        }

        return {
            period: {
                year,
                month,
                startDate: startOfMonth,
                endDate: endOfMonth
            },
            foundationMetrics: {
                cashReceivedThisMonth,
                revenueThisMonth,
                paidForAndNotDelivered
            },
            operationalMetrics: {
                cashSpentThisMonth,
                cogsThisMonth,
                operatingExpensesThisMonth,
                grossProfitThisMonth,
                netProfitThisMonth,
                accountsReceivableBalance,
                cashOnHandBalance,
                bankBalance,
                totalCashAndBank
            }
        };
    }
}

module.exports = new FinancialDashboardService();
