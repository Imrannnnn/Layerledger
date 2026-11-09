/**
 * LayerLedger Balance Sheet Report Service
 * Implements Rule 3 & Rulings 6, 10:
 * - Computed purely from posted journal entries up to `asOfDate`.
 * - Assets = Liabilities + Equity.
 * - Customer Deposits (2120) presented as Current Liability (deferred revenue).
 * - PPE presented at Historical Cost less Contra (1290 / 1295).
 * - Net Profit retained into Equity.
 */

const prisma = require('../../../prisma');
const chartOfAccountsService = require('./chartOfAccounts.service');

class BalanceSheetService {
    /**
     * Compute Balance Sheet as of a specific date
     */
    async getBalanceSheet(tenantId, options = {}) {
        let asOfDate = options.asOfDate ? new Date(options.asOfDate) : new Date();
        asOfDate.setHours(23, 59, 59, 999);

        // Fetch all posted journal lines up to asOfDate
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

        // Sum debits and credits per account code
        const accountBalances = new Map();
        for (const line of lines) {
            const code = line.account.accountCode;
            const debit = parseFloat(line.debit.toString());
            const credit = parseFloat(line.credit.toString());

            if (!accountBalances.has(code)) {
                accountBalances.set(code, {
                    code,
                    name: line.account.accountName,
                    classification: line.account.classification,
                    accountType: line.account.accountType,
                    totalDebit: 0,
                    totalCredit: 0
                });
            }

            const item = accountBalances.get(code);
            item.totalDebit += debit;
            item.totalCredit += credit;
        }

        const accounts = await chartOfAccountsService.getAccounts(tenantId, { isActive: true });

        // Helper to get net balance for an account code
        const getDebitBalance = (code) => {
            const data = accountBalances.get(code);
            if (!data) return 0;
            return parseFloat((data.totalDebit - data.totalCredit).toFixed(2));
        };

        const getCreditBalance = (code) => {
            const data = accountBalances.get(code);
            if (!data) return 0;
            return parseFloat((data.totalCredit - data.totalDebit).toFixed(2));
        };

        // ══════════════════════════════════════════════════════════════════════════
        // 1. CURRENT ASSETS (1100 - 1160)
        // ══════════════════════════════════════════════════════════════════════════
        const currentAssetCodes = ['1100', '1110', '1120', '1130', '1140', '1150', '1160'];
        const currentAssetsItems = [];
        let totalCurrentAssets = 0;

        for (const code of currentAssetCodes) {
            const acc = accounts.find(a => a.accountCode === code);
            const balance = getDebitBalance(code);
            if (balance !== 0 || options.includeZero) {
                currentAssetsItems.push({
                    accountCode: code,
                    accountName: acc ? acc.accountName : `Account ${code}`,
                    amount: balance
                });
            }
            totalCurrentAssets += balance;
        }

        // ══════════════════════════════════════════════════════════════════════════
        // 2. FIXED ASSETS (1200 - 1280 Cost, 1290 & 1295 Contra)
        // ══════════════════════════════════════════════════════════════════════════
        const fixedAssetCostCodes = ['1200', '1210', '1220', '1230', '1240', '1280'];
        const fixedAssetsCostItems = [];
        let totalFixedAssetsCost = 0;

        for (const code of fixedAssetCostCodes) {
            const acc = accounts.find(a => a.accountCode === code);
            const balance = getDebitBalance(code);
            if (balance !== 0 || options.includeZero) {
                fixedAssetsCostItems.push({
                    accountCode: code,
                    accountName: acc ? acc.accountName : `Account ${code}`,
                    amount: balance
                });
            }
            totalFixedAssetsCost += balance;
        }

        // Contra Accounts (1290 Accumulated Depreciation, 1295 Accumulated Amortisation)
        const contraCodes = ['1290', '1295'];
        const contraItems = [];
        let totalContra = 0;

        for (const code of contraCodes) {
            const acc = accounts.find(a => a.accountCode === code);
            // Contra normal balance is Credit
            const balance = getCreditBalance(code);
            if (balance !== 0 || options.includeZero) {
                contraItems.push({
                    accountCode: code,
                    accountName: acc ? acc.accountName : `Account ${code}`,
                    amount: balance
                });
            }
            totalContra += balance;
        }

        totalCurrentAssets = parseFloat(totalCurrentAssets.toFixed(2));
        totalFixedAssetsCost = parseFloat(totalFixedAssetsCost.toFixed(2));
        totalContra = parseFloat(totalContra.toFixed(2));
        const netFixedAssets = parseFloat((totalFixedAssetsCost - totalContra).toFixed(2));
        const totalAssets = parseFloat((totalCurrentAssets + netFixedAssets).toFixed(2));

        // ══════════════════════════════════════════════════════════════════════════
        // 3. CURRENT LIABILITIES (2100 - 2130, 2400)
        // ══════════════════════════════════════════════════════════════════════════
        const currentLiabilityCodes = ['2100', '2110', '2120', '2130', '2400'];
        const currentLiabilitiesItems = [];
        let totalCurrentLiabilities = 0;

        for (const code of currentLiabilityCodes) {
            const acc = accounts.find(a => a.accountCode === code);
            const balance = getCreditBalance(code);
            if (balance !== 0 || options.includeZero) {
                currentLiabilitiesItems.push({
                    accountCode: code,
                    accountName: acc ? acc.accountName : `Account ${code}`,
                    amount: balance
                });
            }
            totalCurrentLiabilities += balance;
        }

        // ══════════════════════════════════════════════════════════════════════════
        // 4. LONG-TERM LIABILITIES (2200, 2210)
        // ══════════════════════════════════════════════════════════════════════════
        const longTermLiabilityCodes = ['2200', '2210'];
        const longTermLiabilitiesItems = [];
        let totalLongTermLiabilities = 0;

        for (const code of longTermLiabilityCodes) {
            const acc = accounts.find(a => a.accountCode === code);
            const balance = getCreditBalance(code);
            if (balance !== 0 || options.includeZero) {
                longTermLiabilitiesItems.push({
                    accountCode: code,
                    accountName: acc ? acc.accountName : `Account ${code}`,
                    amount: balance
                });
            }
            totalLongTermLiabilities += balance;
        }

        totalCurrentLiabilities = parseFloat(totalCurrentLiabilities.toFixed(2));
        totalLongTermLiabilities = parseFloat(totalLongTermLiabilities.toFixed(2));
        const totalLiabilities = parseFloat((totalCurrentLiabilities + totalLongTermLiabilities).toFixed(2));
        const netAssets = parseFloat((totalAssets - totalLiabilities).toFixed(2));

        // ══════════════════════════════════════════════════════════════════════════
        // 5. EQUITY (3000, 3100, 3200, 3300 + Current Retained Earnings)
        // ══════════════════════════════════════════════════════════════════════════
        const equityItems = [];
        let totalEquityBase = 0;

        // Share Capital (Opening 3000)
        const capOpening = getCreditBalance('3000');
        if (capOpening !== 0 || options.includeZero) {
            equityItems.push({ accountCode: '3000', accountName: 'Share Capital (Opening)', amount: capOpening });
        }
        totalEquityBase += capOpening;

        // Additional Capital (3100)
        const capAdd = getCreditBalance('3100');
        if (capAdd !== 0 || options.includeZero) {
            equityItems.push({ accountCode: '3100', accountName: 'Additional Capital', amount: capAdd });
        }
        totalEquityBase += capAdd;

        // Historical Retained Earnings (3200)
        const retHist = getCreditBalance('3200');
        if (retHist !== 0 || options.includeZero) {
            equityItems.push({ accountCode: '3200', accountName: 'Retained Earnings (Opening)', amount: retHist });
        }
        totalEquityBase += retHist;

        // Cumulative Net Income up to asOfDate
        // Sum of all Revenues (Credit - Debit) minus all Expenses (Debit - Credit)
        let cumulativeRevenue = 0;
        let cumulativeCOGS = 0;
        let cumulativeAdminExp = 0;
        let cumulativeOtherIncome = 0;
        let cumulativeOtherExp = 0;

        for (const data of accountBalances.values()) {
            if (data.classification === 'REVENUE') cumulativeRevenue += (data.totalCredit - data.totalDebit);
            else if (data.classification === 'COGS') cumulativeCOGS += (data.totalDebit - data.totalCredit);
            else if (data.classification === 'ADMIN_EXPENSE') cumulativeAdminExp += (data.totalDebit - data.totalCredit);
            else if (data.classification === 'OTHER_INCOME') cumulativeOtherIncome += (data.totalCredit - data.totalDebit);
            else if (data.classification === 'OTHER_EXPENSE') cumulativeOtherExp += (data.totalDebit - data.totalCredit);
        }

        const currentPeriodNetProfit = parseFloat(
            (cumulativeRevenue - cumulativeCOGS - cumulativeAdminExp + cumulativeOtherIncome - cumulativeOtherExp).toFixed(2)
        );

        equityItems.push({
            accountCode: 'NET_INCOME',
            accountName: 'Current Earnings (Net Profit)',
            amount: currentPeriodNetProfit
        });

        // Drawings (3300) - normal balance is Debit, reduces Equity
        const drawings = getDebitBalance('3300');
        if (drawings !== 0 || options.includeZero) {
            equityItems.push({
                accountCode: '3300',
                accountName: "Shareholders' Drawings",
                amount: -drawings
            });
        }

        const totalEquity = parseFloat(
            (totalEquityBase + currentPeriodNetProfit - drawings).toFixed(2)
        );

        // Verification: Assets - Liabilities === Equity
        const difference = parseFloat((totalAssets - (totalLiabilities + totalEquity)).toFixed(2));
        const isBalanced = Math.abs(difference) < 0.01;

        return {
            asOfDate,
            currentAssets: {
                items: currentAssetsItems,
                total: totalCurrentAssets
            },
            fixedAssets: {
                costItems: fixedAssetsCostItems,
                totalCost: totalFixedAssetsCost,
                contraItems: contraItems,
                totalContra: totalContra,
                netFixedAssets
            },
            totalAssets,
            currentLiabilities: {
                items: currentLiabilitiesItems,
                total: totalCurrentLiabilities
            },
            longTermLiabilities: {
                items: longTermLiabilitiesItems,
                total: totalLongTermLiabilities
            },
            totalLiabilities,
            netAssets,
            equity: {
                items: equityItems,
                total: totalEquity
            },
            totalLiabilitiesAndEquity: parseFloat((totalLiabilities + totalEquity).toFixed(2)),
            isBalanced,
            difference
        };
    }
}

module.exports = new BalanceSheetService();
