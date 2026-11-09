/**
 * LayerLedger Cash Flow Statement Service
 * Implements Ruling 1:
 * "Accrual basis, with a profit and loss on that basis and a separate cash flow statement."
 * Computed using the indirect method from posted journal entries (Rule 3).
 */

const prisma = require('../../../prisma');
const profitLossService = require('./profitLoss.service');

class CashFlowService {
    /**
     * Compute Cash Flow Statement for a date range
     */
    async getCashFlow(tenantId, options = {}) {
        let { startDate, endDate, year, month } = options;

        if (year && month) {
            startDate = new Date(year, month - 1, 1);
            endDate = new Date(year, month, 0, 23, 59, 59, 999);
        } else if (year) {
            startDate = new Date(year, 0, 1);
            endDate = new Date(year, 11, 31, 23, 59, 59, 999);
        } else {
            if (!startDate) {
                const now = new Date();
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            } else {
                startDate = new Date(startDate);
            }

            if (!endDate) {
                const now = new Date();
                endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
            } else {
                endDate = new Date(endDate);
                endDate.setHours(23, 59, 59, 999);
            }
        }

        // 1. Get Net Profit for the period from P&L
        const pnl = await profitLossService.getProfitLoss(tenantId, { startDate, endDate });
        const netProfit = pnl.netProfit;

        // Fetch journal lines for period
        const periodLines = await prisma.journalLine.findMany({
            where: {
                tenantId,
                journalEntry: {
                    status: 'POSTED',
                    entryDate: { gte: startDate, lte: endDate }
                }
            },
            include: { account: true, journalEntry: true }
        });

        // 2. Adjustments for non-cash and non-operating items
        // Depreciation (5060, 6400, 6410)
        let depreciationAddback = 0;
        let gainOnDisposal = 0;
        let lossOnDisposal = 0;

        for (const line of periodLines) {
            const code = line.account.accountCode;
            const d = parseFloat(line.debit.toString());
            const c = parseFloat(line.credit.toString());

            if (code === '5060' || code === '6400' || code === '6410') {
                depreciationAddback += (d - c);
            } else if (code === '7020') {
                gainOnDisposal += (c - d);
            } else if (code === '8030') {
                lossOnDisposal += (d - c);
            }
        }

        depreciationAddback = parseFloat(depreciationAddback.toFixed(2));
        gainOnDisposal = parseFloat(gainOnDisposal.toFixed(2));
        lossOnDisposal = parseFloat(lossOnDisposal.toFixed(2));

        // 3. Working Capital Changes (period changes)
        // Helper to get net debit movement (Debit - Credit) during period
        const getNetDebitMovement = (codes) => {
            let sum = 0;
            for (const line of periodLines) {
                if (codes.includes(line.account.accountCode)) {
                    sum += parseFloat(line.debit.toString()) - parseFloat(line.credit.toString());
                }
            }
            return parseFloat(sum.toFixed(2));
        };

        // Helper to get net credit movement (Credit - Debit) during period
        const getNetCreditMovement = (codes) => {
            let sum = 0;
            for (const line of periodLines) {
                if (codes.includes(line.account.accountCode)) {
                    sum += parseFloat(line.credit.toString()) - parseFloat(line.debit.toString());
                }
            }
            return parseFloat(sum.toFixed(2));
        };

        // Working Capital Movements:
        // Asset increase is cash OUTFLOW (-); Asset decrease is cash INFLOW (+)
        const arMovement = -getNetDebitMovement(['1120']);
        const prepaymentsMovement = -getNetDebitMovement(['1130']);
        const inventoryMovement = -getNetDebitMovement(['1140', '1150', '1160']);

        // Liability increase is cash INFLOW (+); Liability decrease is cash OUTFLOW (-)
        const apMovement = getNetCreditMovement(['2100']);
        const customerDepositsMovement = getNetCreditMovement(['2120']);
        const otherPayablesMovement = getNetCreditMovement(['2110', '2130', '2400']);

        const totalWorkingCapitalChange = parseFloat(
            (arMovement + prepaymentsMovement + inventoryMovement + apMovement + customerDepositsMovement + otherPayablesMovement).toFixed(2)
        );

        const netOperatingCashFlow = parseFloat(
            (netProfit + depreciationAddback - gainOnDisposal + lossOnDisposal + totalWorkingCapitalChange).toFixed(2)
        );

        // 4. Investing Activities
        // PPE purchases: cash spent on 1200-1280
        // PPE disposal proceeds: cash received on disposals
        let ppeAcquisitions = 0;
        let assetDisposalProceeds = 0;

        for (const line of periodLines) {
            const entryType = line.journalEntry.sourceType;
            const code = line.account.accountCode;
            const d = parseFloat(line.debit.toString());
            const c = parseFloat(line.credit.toString());

            if (entryType === 'fixed_asset_acquisition' && (code === '1110' || code === '1100')) {
                ppeAcquisitions += c; // cash paid
            }
            if (entryType === 'fixed_asset_disposal' && (code === '1110' || code === '1100')) {
                assetDisposalProceeds += d; // cash received
            }
        }

        ppeAcquisitions = parseFloat(ppeAcquisitions.toFixed(2));
        assetDisposalProceeds = parseFloat(assetDisposalProceeds.toFixed(2));
        const netInvestingCashFlow = parseFloat((assetDisposalProceeds - ppeAcquisitions).toFixed(2));

        // 5. Financing Activities
        // Capital introduced (3000, 3100)
        // Loans received / repaid (2200, 2210)
        // Drawings (3300)
        let capitalIntroduced = 0;
        let drawings = 0;
        let loansNet = 0;

        for (const line of periodLines) {
            const code = line.account.accountCode;
            const d = parseFloat(line.debit.toString());
            const c = parseFloat(line.credit.toString());

            if (code === '3000' || code === '3100') {
                capitalIntroduced += (c - d);
            } else if (code === '3300') {
                drawings += (d - c);
            } else if (code === '2200' || code === '2210') {
                loansNet += (c - d);
            }
        }

        capitalIntroduced = parseFloat(capitalIntroduced.toFixed(2));
        drawings = parseFloat(drawings.toFixed(2));
        loansNet = parseFloat(loansNet.toFixed(2));
        const netFinancingCashFlow = parseFloat((capitalIntroduced + loansNet - drawings).toFixed(2));

        // 6. Net Change in Cash & Cash Equivalents
        const netCashFlow = parseFloat(
            (netOperatingCashFlow + netInvestingCashFlow + netFinancingCashFlow).toFixed(2)
        );

        // 7. Cash at Beginning and End of Period (Accounts 1100 Cash + 1110 Bank)
        const beginningLines = await prisma.journalLine.findMany({
            where: {
                tenantId,
                account: { accountCode: { in: ['1100', '1110'] } },
                journalEntry: {
                    status: 'POSTED',
                    entryDate: { lt: startDate }
                }
            }
        });

        let beginningCash = 0;
        for (const line of beginningLines) {
            beginningCash += parseFloat(line.debit.toString()) - parseFloat(line.credit.toString());
        }
        beginningCash = parseFloat(beginningCash.toFixed(2));

        const endingCash = parseFloat((beginningCash + netCashFlow).toFixed(2));

        return {
            period: {
                startDate,
                endDate,
                description: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`
            },
            operatingActivities: {
                netProfit,
                depreciationAddback,
                gainOnDisposal: -gainOnDisposal,
                lossOnDisposal,
                workingCapitalChanges: {
                    accountsReceivable: arMovement,
                    prepayments: prepaymentsMovement,
                    inventories: inventoryMovement,
                    accountsPayable: apMovement,
                    customerDeposits: customerDepositsMovement,
                    otherPayables: otherPayablesMovement,
                    total: totalWorkingCapitalChange
                },
                netOperatingCashFlow
            },
            investingActivities: {
                ppeAcquisitions: -ppeAcquisitions,
                assetDisposalProceeds,
                netInvestingCashFlow
            },
            financingActivities: {
                capitalIntroduced,
                drawings: -drawings,
                loansNet,
                netFinancingCashFlow
            },
            netCashChange: netCashFlow,
            beginningCash,
            endingCash
        };
    }
}

module.exports = new CashFlowService();
