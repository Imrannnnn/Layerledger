/**
 * LayerLedger Profit & Loss Report Service
 * Implements Rulings 1, 2, 4, 19:
 * - Ruling 1: Accrual basis profit and loss.
 * - Ruling 2 & 4: Revenue recognised ONLY on delivery. Money received with nothing delivered = 0 income.
 * - Ruling 19: Forfeited deposits land in 7030 Other Revenue, keeping cake gross margin clean.
 * - Computed purely from posted journal entries (Rule 3).
 */

const prisma = require('../../../prisma');
const chartOfAccountsService = require('./chartOfAccounts.service');

class ProfitLossService {
    /**
     * Compute Profit & Loss report for a date range
     */
    async getProfitLoss(tenantId, options = {}) {
        let { startDate, endDate, year, month } = options;

        if (year && month) {
            startDate = new Date(year, month - 1, 1);
            endDate = new Date(year, month, 0, 23, 59, 59, 999);
        } else if (year) {
            startDate = new Date(year, 0, 1);
            endDate = new Date(year, 11, 31, 23, 59, 59, 999);
        } else {
            if (!startDate) {
                // Default to first day of current month
                const now = new Date();
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            } else {
                startDate = new Date(startDate);
            }

            if (!endDate) {
                // Default to end of current month
                const now = new Date();
                endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
            } else {
                endDate = new Date(endDate);
                endDate.setHours(23, 59, 59, 999);
            }
        }

        // Fetch all posted journal lines within period
        const lines = await prisma.journalLine.findMany({
            where: {
                tenantId,
                journalEntry: {
                    status: 'POSTED',
                    entryDate: { gte: startDate, lte: endDate }
                }
            },
            include: {
                account: true
            }
        });

        // Group amounts by account code
        // For Revenues: Credit - Debit (normal balance is Credit)
        // For Expenses/COGS: Debit - Credit (normal balance is Debit)
        const accountTotals = new Map();

        for (const line of lines) {
            const code = line.account.accountCode;
            const debit = parseFloat(line.debit.toString());
            const credit = parseFloat(line.credit.toString());

            if (!accountTotals.has(code)) {
                accountTotals.set(code, {
                    code,
                    name: line.account.accountName,
                    classification: line.account.classification,
                    accountType: line.account.accountType,
                    totalDebit: 0,
                    totalCredit: 0
                });
            }

            const item = accountTotals.get(code);
            item.totalDebit += debit;
            item.totalCredit += credit;
        }

        // Fetch all chart of accounts items to ensure accounts with 0 activity can be displayed if needed
        const accounts = await chartOfAccountsService.getAccounts(tenantId, { isActive: true });
        const accountsMap = new Map(accounts.map(a => [a.accountCode, a]));

        // 1. REVENUE (4000 - 4070)
        const revenueItems = [];
        let totalRevenue = 0;

        for (const a of accounts.filter(acc => acc.classification === 'REVENUE')) {
            const data = accountTotals.get(a.accountCode);
            const netAmount = data ? parseFloat((data.totalCredit - data.totalDebit).toFixed(2)) : 0;
            if (netAmount !== 0 || options.includeZero) {
                revenueItems.push({
                    accountCode: a.accountCode,
                    accountName: a.accountName,
                    amount: netAmount
                });
            }
            totalRevenue += netAmount;
        }

        // 2. COST OF GOODS SOLD (5000 - 5070)
        const cogsItems = [];
        let totalCOGS = 0;

        for (const a of accounts.filter(acc => acc.classification === 'COGS')) {
            const data = accountTotals.get(a.accountCode);
            const netAmount = data ? parseFloat((data.totalDebit - data.totalCredit).toFixed(2)) : 0;
            if (netAmount !== 0 || options.includeZero) {
                cogsItems.push({
                    accountCode: a.accountCode,
                    accountName: a.accountName,
                    amount: netAmount
                });
            }
            totalCOGS += netAmount;
        }

        totalRevenue = parseFloat(totalRevenue.toFixed(2));
        totalCOGS = parseFloat(totalCOGS.toFixed(2));
        const grossProfit = parseFloat((totalRevenue - totalCOGS).toFixed(2));
        const grossMarginPercent = totalRevenue > 0
            ? parseFloat(((grossProfit / totalRevenue) * 100).toFixed(2))
            : 0;

        // 3. OPERATING & ADMINISTRATIVE EXPENSES (6000 - 6410)
        const operatingExpenseItems = [];
        let totalOperatingExpenses = 0;

        for (const a of accounts.filter(acc => acc.classification === 'ADMIN_EXPENSE')) {
            const data = accountTotals.get(a.accountCode);
            const netAmount = data ? parseFloat((data.totalDebit - data.totalCredit).toFixed(2)) : 0;
            if (netAmount !== 0 || options.includeZero) {
                operatingExpenseItems.push({
                    accountCode: a.accountCode,
                    accountName: a.accountName,
                    amount: netAmount
                });
            }
            totalOperatingExpenses += netAmount;
        }

        totalOperatingExpenses = parseFloat(totalOperatingExpenses.toFixed(2));
        const operatingProfit = parseFloat((grossProfit - totalOperatingExpenses).toFixed(2));

        // 4. OTHER INCOME / REVENUE (7000 - 7030, including 7030 Forfeited Deposits)
        const otherIncomeItems = [];
        let totalOtherIncome = 0;

        for (const a of accounts.filter(acc => acc.classification === 'OTHER_INCOME')) {
            const data = accountTotals.get(a.accountCode);
            const netAmount = data ? parseFloat((data.totalCredit - data.totalDebit).toFixed(2)) : 0;
            if (netAmount !== 0 || options.includeZero) {
                otherIncomeItems.push({
                    accountCode: a.accountCode,
                    accountName: a.accountName,
                    amount: netAmount
                });
            }
            totalOtherIncome += netAmount;
        }

        // 5. OTHER EXPENSES (8000 - 8030, including 8000 Bank Charges, 8030 Loss on Disposal)
        const otherExpenseItems = [];
        let totalOtherExpenses = 0;

        for (const a of accounts.filter(acc => acc.classification === 'OTHER_EXPENSE')) {
            const data = accountTotals.get(a.accountCode);
            const netAmount = data ? parseFloat((data.totalDebit - data.totalCredit).toFixed(2)) : 0;
            if (netAmount !== 0 || options.includeZero) {
                otherExpenseItems.push({
                    accountCode: a.accountCode,
                    accountName: a.accountName,
                    amount: netAmount
                });
            }
            totalOtherExpenses += netAmount;
        }

        totalOtherIncome = parseFloat(totalOtherIncome.toFixed(2));
        totalOtherExpenses = parseFloat(totalOtherExpenses.toFixed(2));

        const netProfit = parseFloat(
            (operatingProfit + totalOtherIncome - totalOtherExpenses).toFixed(2)
        );

        return {
            period: {
                startDate,
                endDate,
                description: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`
            },
            revenue: {
                items: revenueItems,
                total: totalRevenue
            },
            costOfGoodsSold: {
                items: cogsItems,
                total: totalCOGS
            },
            grossProfit,
            grossMarginPercent,
            operatingExpenses: {
                items: operatingExpenseItems,
                total: totalOperatingExpenses
            },
            operatingProfit,
            otherIncome: {
                items: otherIncomeItems,
                total: totalOtherIncome
            },
            otherExpenses: {
                items: otherExpenseItems,
                total: totalOtherExpenses
            },
            netProfit
        };
    }
}

module.exports = new ProfitLossService();
