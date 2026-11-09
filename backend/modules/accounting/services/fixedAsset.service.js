/**
 * LayerLedger Fixed Asset & Depreciation Engine
 * Implements Rulings 10, 11, 12, 13, 14:
 * - Ruling 10: PPE goes to balance sheet, creates fixed asset register record, depreciates into P&L monthly.
 * - Ruling 11: Straight line only. Do not build reducing balance.
 * - Ruling 12: A full month's charge in the month of purchase. No pro-rating.
 * - Ruling 13: Capitalisation threshold is owner-selectable, recommended default 50,000.
 * - Ruling 14: Useful lives: standard period of 4 or 5 years (48 or 60 months).
 * - Never reduce original cost; accumulate in contra 1290 (or 1295 for intangibles).
 * - Split: Production (5060 / 1290) vs Office (6400 / 1290) vs Intangible (6410 / 1295).
 * - Asset Disposal: Relieve 12xx cost, clear 1290 contra, record proceeds, recognize Gain (7020) or Loss (8030).
 */

const prisma = require('../../../prisma');
const postingService = require('./posting.service');
const chartOfAccountsService = require('./chartOfAccounts.service');
const { toDecimal, isPositive } = require('../utils/decimal');

class FixedAssetService {
    /**
     * Map category to asset account code and default useType
     */
    resolveAssetAccountCode(category) {
        const cat = String(category || '').toLowerCase();
        if (cat.includes('vehicle') || cat.includes('car') || cat.includes('van') || cat.includes('truck')) {
            return { code: '1210', useType: 'office', name: 'Motor Vehicles' };
        }
        if (cat.includes('furniture') || cat.includes('fixture') || cat.includes('desk') || cat.includes('chair')) {
            return { code: '1220', useType: 'office', name: 'Furniture & Fixtures' };
        }
        if (cat.includes('computer') || cat.includes('laptop') || cat.includes('printer') || cat.includes('tablet')) {
            return { code: '1230', useType: 'office', name: 'Computer Equipment' };
        }
        if (cat.includes('leasehold') || cat.includes('renovation') || cat.includes('improvement')) {
            return { code: '1240', useType: 'office', name: 'Leasehold Improvements' };
        }
        if (cat.includes('software') || cat.includes('patent') || cat.includes('trademark') || cat.includes('intangible')) {
            return { code: '1280', useType: 'intangible', name: 'Intangible Asset' };
        }
        // Default to Bakery Equipment
        return { code: '1200', useType: 'production', name: 'Bakery Equipment' };
    }

    /**
     * Register a new fixed asset
     */
    async registerFixedAsset(tenantId, assetData, externalTx = null) {
        const runWithTx = async (tx) => {
            const cost = parseFloat(assetData.cost || 0);
            if (cost <= 0) {
                throw new Error('Fixed asset cost must be greater than zero');
            }

            const residualValue = parseFloat(assetData.residualValue || 0);
            const usefulLifeMonths = parseInt(assetData.usefulLifeMonths || 60, 10); // Standard 5 years default (Ruling 14)

            // Resolve asset account
            let accountCode = assetData.accountCode;
            let useType = assetData.useType;
            if (!accountCode) {
                const resolved = this.resolveAssetAccountCode(assetData.assetCategory);
                accountCode = resolved.code;
                if (!useType) useType = resolved.useType;
            }
            if (!useType) {
                useType = accountCode === '1200' ? 'production' : (accountCode === '1280' ? 'intangible' : 'office');
            }

            const assetAccount = await chartOfAccountsService.getAccountByCode(tenantId, accountCode);
            if (!assetAccount) {
                throw new Error(`Asset account code ${accountCode} not found in chart of accounts`);
            }

            const acquisitionDate = assetData.acquisitionDate ? new Date(assetData.acquisitionDate) : new Date();

            let journalEntry = null;

            // If requested, post initial balance sheet acquisition entry (Dr 12xx / Cr Bank or AP or Share Capital)
            if (assetData.postInitialEntry) {
                const isCash = String(assetData.paymentMethod || '').toLowerCase() === 'cash';
                const isStartupContribution = String(assetData.paymentMethod || '').toLowerCase() === 'equity';
                const isPayable = String(assetData.paymentMethod || '').toLowerCase() === 'credit';

                let creditAccount = '1110'; // default bank
                if (isCash) creditAccount = '1100';
                else if (isStartupContribution) creditAccount = '3000'; // Share Capital (Opening) / Startup equipment
                else if (isPayable) creditAccount = '2100'; // Accounts Payable

                const postResult = await postingService.postJournalEntry({
                    tenantId,
                    entryDate: acquisitionDate,
                    sourceType: 'fixed_asset_acquisition',
                    memo: `Fixed asset acquired: ${assetData.name}`,
                    lines: [
                        {
                            accountCode,
                            debit: cost,
                            credit: 0,
                            description: `Acquisition of ${assetData.name}`
                        },
                        {
                            accountCode: creditAccount,
                            debit: 0,
                            credit: cost,
                            description: `Payment / funding for ${assetData.name}`
                        }
                    ]
                }, tx);
                journalEntry = postResult.entry;
            }

            const fixedAsset = await tx.fixedAsset.create({
                data: {
                    tenantId,
                    assetAccountId: assetAccount.id,
                    name: assetData.name,
                    assetCategory: assetData.assetCategory || 'bakery_equipment',
                    acquisitionDate,
                    cost,
                    residualValue,
                    usefulLifeMonths,
                    depreciationMethod: 'STRAIGHT_LINE', // Ruling 11: straight line only
                    useType,
                    accumulatedDepreciation: 0,
                    netBookValue: cost,
                    status: 'ACTIVE',
                    purchaseId: assetData.purchaseId || null,
                    journalEntryId: journalEntry?.id || assetData.journalEntryId || null
                },
                include: {
                    assetAccount: true
                }
            });

            return {
                fixedAsset,
                journalEntry,
                monthlyDepreciation: parseFloat(((cost - residualValue) / usefulLifeMonths).toFixed(2))
            };
        };

        if (externalTx) return await runWithTx(externalTx);
        return await prisma.$transaction(async (tx) => runWithTx(tx), { maxWait: 10000, timeout: 30000 });
    }

    /**
     * Compute monthly straight-line depreciation charge
     * Ruling 11: Straight line only.
     * Ruling 12: A full month's charge in the month of purchase. No pro-rating.
     */
    calculateMonthlyDepreciation(cost, residualValue, usefulLifeMonths, currentAccumulated = 0) {
        const c = parseFloat(cost || 0);
        const r = parseFloat(residualValue || 0);
        const life = parseInt(usefulLifeMonths || 60, 10);
        const accumulated = parseFloat(currentAccumulated || 0);

        const depreciableBase = Math.max(0, c - r);
        if (depreciableBase <= 0 || life <= 0) return 0;

        const standardMonthly = parseFloat((depreciableBase / life).toFixed(2));
        const remainingToDepreciate = parseFloat((depreciableBase - accumulated).toFixed(2));

        if (remainingToDepreciate <= 0) return 0;

        // Never depreciate more than remaining depreciable base
        return Math.min(standardMonthly, remainingToDepreciate);
    }

    /**
     * Depreciate a single asset for a specific month
     * - Ruling 10 & 12: Posts full monthly charge to P&L from fixed asset record.
     * - Production: Dr 5060 / Cr 1290
     * - Office: Dr 6400 / Cr 1290
     * - Intangibles: Dr 6410 / Cr 1295
     */
    async depreciateAssetForMonth(tenantId, assetId, periodDate, externalTx = null) {
        const runWithTx = async (tx) => {
            const asset = await tx.fixedAsset.findFirst({
                where: { id: assetId, tenantId },
                include: { assetAccount: true }
            });

            if (!asset) {
                throw new Error(`Fixed asset ${assetId} not found`);
            }

            if (asset.status !== 'ACTIVE') {
                throw new Error(`Fixed asset ${asset.name} is ${asset.status} and cannot be depreciated`);
            }

            // Standardize period date to end of the month
            const pDate = new Date(periodDate);
            const endOfMonth = new Date(pDate.getFullYear(), pDate.getMonth() + 1, 0, 23, 59, 59, 999);

            // Check if already depreciated for this month (idempotency check)
            const existingDep = await tx.assetDepreciation.findFirst({
                where: {
                    fixedAssetId: assetId,
                    periodDate: {
                        gte: new Date(pDate.getFullYear(), pDate.getMonth(), 1),
                        lte: endOfMonth
                    }
                }
            });

            if (existingDep) {
                return {
                    message: `Asset ${asset.name} already depreciated for ${pDate.getFullYear()}-${String(pDate.getMonth() + 1).padStart(2, '0')}`,
                    alreadyDepreciated: true,
                    depreciation: existingDep
                };
            }

            const cost = parseFloat(asset.cost.toString());
            const residualValue = parseFloat(asset.residualValue.toString());
            const accumulated = parseFloat(asset.accumulatedDepreciation.toString());

            const monthlyCharge = this.calculateMonthlyDepreciation(cost, residualValue, asset.usefulLifeMonths, accumulated);

            if (monthlyCharge <= 0) {
                return {
                    message: `Asset ${asset.name} is already fully depreciated`,
                    monthlyCharge: 0,
                    fullyDepreciated: true
                };
            }

            // Determine P&L expense and contra accounts based on useType & account code
            let expenseAccountCode = '5060'; // Default production: 5060 Depreciation, Production Equipment
            let contraAccountCode = '1290';  // Accumulated Depreciation, PPE

            if (asset.useType === 'office') {
                expenseAccountCode = '6400'; // 6400 Depreciation, Office PPE
                contraAccountCode = '1290';
            } else if (asset.useType === 'intangible' || asset.assetAccount.accountCode === '1280') {
                expenseAccountCode = '6410'; // 6410 Amortisation, Intangible Assets
                contraAccountCode = '1295';  // 1295 Accumulated Amortisation, Intangibles
            }

            const monthStr = `${pDate.getFullYear()}-${String(pDate.getMonth() + 1).padStart(2, '0')}`;
            const memo = `Monthly depreciation for ${asset.name} (${monthStr})`;

            // Post double entry: Dr Expense (5060/6400/6410) / Cr Contra (1290/1295)
            // Note: Asset cost (1200-1280) is NEVER touched during depreciation
            const postResult = await postingService.postJournalEntry({
                tenantId,
                entryDate: endOfMonth,
                sourceType: 'depreciation',
                sourceId: assetId,
                memo,
                lines: [
                    {
                        accountCode: expenseAccountCode,
                        debit: monthlyCharge,
                        credit: 0,
                        description: `Depreciation charge - ${asset.name}`
                    },
                    {
                        accountCode: contraAccountCode,
                        debit: 0,
                        credit: monthlyCharge,
                        description: `Accumulated depreciation - ${asset.name}`
                    }
                ]
            }, tx);

            // Create AssetDepreciation record
            const depreciationRecord = await tx.assetDepreciation.create({
                data: {
                    tenantId,
                    fixedAssetId: assetId,
                    periodDate: endOfMonth,
                    amount: monthlyCharge,
                    journalEntryId: postResult.entry.id
                }
            });

            // Update asset accumulated depreciation and net book value
            const newAccumulated = parseFloat((accumulated + monthlyCharge).toFixed(2));
            const newNetBookValue = parseFloat(Math.max(0, cost - newAccumulated).toFixed(2));

            const updatedAsset = await tx.fixedAsset.update({
                where: { id: assetId },
                data: {
                    accumulatedDepreciation: newAccumulated,
                    netBookValue: newNetBookValue
                }
            });

            return {
                depreciation: depreciationRecord,
                journalEntry: postResult.entry,
                asset: updatedAsset,
                monthlyCharge,
                accumulatedDepreciation: newAccumulated,
                netBookValue: newNetBookValue
            };
        };

        if (externalTx) return await runWithTx(externalTx);
        return await prisma.$transaction(async (tx) => runWithTx(tx), { maxWait: 10000, timeout: 30000 });
    }

    /**
     * Batch process monthly depreciation for all active fixed assets
     */
    async runMonthlyDepreciationBatch(tenantId, periodDate = new Date(), externalTx = null) {
        const runWithTx = async (tx) => {
            const pDate = new Date(periodDate);
            const activeAssets = await tx.fixedAsset.findMany({
                where: {
                    tenantId,
                    status: 'ACTIVE',
                    acquisitionDate: { lte: pDate }
                }
            });

            const results = [];
            for (const asset of activeAssets) {
                const res = await this.depreciateAssetForMonth(tenantId, asset.id, pDate, tx);
                results.push({
                    assetId: asset.id,
                    name: asset.name,
                    ...res
                });
            }

            return {
                period: `${pDate.getFullYear()}-${String(pDate.getMonth() + 1).padStart(2, '0')}`,
                totalProcessed: results.length,
                totalDepreciation: results.reduce((sum, r) => sum + (r.monthlyCharge || 0), 0),
                results
            };
        };

        if (externalTx) return await runWithTx(externalTx);
        return await prisma.$transaction(async (tx) => runWithTx(tx), { maxWait: 10000, timeout: 30000 });
    }

    /**
     * Dispose of a fixed asset (Sale, Scrappage, Write-off)
     * - Clear original cost from 12xx (Cr 12xx)
     * - Clear accumulated depreciation from 1290 (Dr 1290)
     * - Record proceeds in 1110 Bank / 1100 Cash (Dr 1110)
     * - Record Gain (Cr 7020 Gain on Disposal) or Loss (Dr 8030 Loss on Disposal)
     */
    async disposeFixedAsset(tenantId, assetId, disposalData = {}, externalTx = null) {
        const runWithTx = async (tx) => {
            const asset = await tx.fixedAsset.findFirst({
                where: { id: assetId, tenantId },
                include: { assetAccount: true }
            });

            if (!asset) {
                throw new Error(`Fixed asset ${assetId} not found`);
            }

            if (asset.status === 'DISPOSED') {
                throw new Error(`Fixed asset ${asset.name} is already disposed`);
            }

            const cost = parseFloat(asset.cost.toString());
            const accumulated = parseFloat(asset.accumulatedDepreciation.toString());
            const netBookValue = parseFloat(Math.max(0, cost - accumulated).toFixed(2));

            const proceeds = parseFloat(disposalData.proceeds || 0);
            const disposalDate = disposalData.disposalDate ? new Date(disposalData.disposalDate) : new Date();
            const isCash = String(disposalData.paymentMethod || '').toLowerCase() === 'cash';
            const proceedsAccount = isCash ? '1100' : '1110';

            const contraCode = asset.useType === 'intangible' || asset.assetAccount.accountCode === '1280' ? '1295' : '1290';
            const assetAccountCode = asset.assetAccount.accountCode;

            const lines = [];

            // 1. Relieve asset original cost (Cr 12xx)
            lines.push({
                accountCode: assetAccountCode,
                debit: 0,
                credit: cost,
                description: `Relieve original cost upon disposal of ${asset.name}`
            });

            // 2. Clear accumulated depreciation (Dr 1290/1295)
            if (accumulated > 0) {
                lines.push({
                    accountCode: contraCode,
                    debit: accumulated,
                    credit: 0,
                    description: `Clear accumulated depreciation for ${asset.name}`
                });
            }

            // 3. Record proceeds received (Dr 1110/1100)
            if (proceeds > 0) {
                lines.push({
                    accountCode: proceedsAccount,
                    debit: proceeds,
                    credit: 0,
                    description: `Proceeds received from disposal of ${asset.name}`
                });
            }

            // 4. Calculate Gain or Loss
            // Gain = Proceeds - NetBookValue (if Proceeds > NBV) -> Cr 7020
            // Loss = NetBookValue - Proceeds (if Proceeds < NBV) -> Dr 8030
            const diff = parseFloat((proceeds - netBookValue).toFixed(2));

            if (diff > 0) {
                // Gain on Disposal (Other Revenue)
                lines.push({
                    accountCode: '7020',
                    debit: 0,
                    credit: diff,
                    description: `Gain on disposal of ${asset.name}`
                });
            } else if (diff < 0) {
                // Loss on Disposal (Other Expense)
                const lossAmount = Math.abs(diff);
                lines.push({
                    accountCode: '8030',
                    debit: lossAmount,
                    credit: 0,
                    description: `Loss on disposal of ${asset.name}`
                });
            }

            const postResult = await postingService.postJournalEntry({
                tenantId,
                entryDate: disposalDate,
                sourceType: 'fixed_asset_disposal',
                sourceId: assetId,
                memo: `Disposal of ${asset.name}: Cost ₦${cost}, AccumDep ₦${accumulated}, Proceeds ₦${proceeds}`,
                lines
            }, tx);

            // Update asset status to DISPOSED
            const updatedAsset = await tx.fixedAsset.update({
                where: { id: assetId },
                data: {
                    status: 'DISPOSED',
                    netBookValue: 0
                }
            });

            return {
                asset: updatedAsset,
                journalEntry: postResult.entry,
                cost,
                accumulatedDepreciation: accumulated,
                netBookValue,
                proceeds,
                gainOrLoss: diff,
                disposalType: diff >= 0 ? 'GAIN' : 'LOSS'
            };
        };

        if (externalTx) return await runWithTx(externalTx);
        return await prisma.$transaction(async (tx) => runWithTx(tx), { maxWait: 10000, timeout: 30000 });
    }

    /**
     * Get fixed asset register listing
     */
    async getFixedAssets(tenantId, options = {}) {
        const where = { tenantId };
        if (options.status) where.status = options.status;
        if (options.useType) where.useType = options.useType;
        if (options.category) where.assetCategory = options.category;

        const assets = await prisma.fixedAsset.findMany({
            where,
            include: {
                assetAccount: {
                    select: { accountCode: true, accountName: true }
                },
                depreciations: {
                    orderBy: { periodDate: 'desc' },
                    take: 5
                }
            },
            orderBy: { acquisitionDate: 'desc' }
        });

        return assets.map(a => ({
            id: a.id,
            name: a.name,
            category: a.assetCategory,
            accountCode: a.assetAccount.accountCode,
            accountName: a.assetAccount.accountName,
            acquisitionDate: a.acquisitionDate,
            cost: parseFloat(a.cost.toString()),
            residualValue: parseFloat(a.residualValue.toString()),
            usefulLifeMonths: a.usefulLifeMonths,
            useType: a.useType,
            accumulatedDepreciation: parseFloat(a.accumulatedDepreciation.toString()),
            netBookValue: parseFloat(a.netBookValue.toString()),
            status: a.status,
            monthlyDepreciation: parseFloat(((parseFloat(a.cost.toString()) - parseFloat(a.residualValue.toString())) / a.usefulLifeMonths).toFixed(2))
        }));
    }

    /**
     * Get single fixed asset details
     */
    async getFixedAssetById(tenantId, assetId) {
        const asset = await prisma.fixedAsset.findFirst({
            where: { id: assetId, tenantId },
            include: {
                assetAccount: true,
                depreciations: {
                    orderBy: { periodDate: 'desc' }
                }
            }
        });

        if (!asset) return null;

        return {
            id: asset.id,
            name: asset.name,
            category: asset.assetCategory,
            accountCode: asset.assetAccount.accountCode,
            accountName: asset.assetAccount.accountName,
            acquisitionDate: asset.acquisitionDate,
            cost: parseFloat(asset.cost.toString()),
            residualValue: parseFloat(asset.residualValue.toString()),
            usefulLifeMonths: asset.usefulLifeMonths,
            useType: asset.useType,
            accumulatedDepreciation: parseFloat(asset.accumulatedDepreciation.toString()),
            netBookValue: parseFloat(asset.netBookValue.toString()),
            status: asset.status,
            depreciations: asset.depreciations.map(d => ({
                id: d.id,
                periodDate: d.periodDate,
                amount: parseFloat(d.amount.toString()),
                journalEntryId: d.journalEntryId,
                createdAt: d.createdAt
            }))
        };
    }
}

module.exports = new FixedAssetService();
