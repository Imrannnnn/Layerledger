/**
 * LayerLedger Fixed Assets & Prepayments Test Suite (Phase 7)
 * Validates Rulings 10, 11, 12, 13, 14 & Advance Payments:
 * 1. Straight line depreciation only (Ruling 11)
 * 2. Full month's charge in month of purchase, no pro-rating (Ruling 12)
 * 3. Standard useful life of 4 or 5 years (Ruling 14)
 * 4. Production vs Office account split (COGS 5060 vs Admin Expense 6400 vs Contra 1290)
 * 5. Intangibles Amortisation (6410 / 1295)
 * 6. Asset cost preservation in 12xx (never reduced directly; contra accumulates)
 * 7. Asset Disposals with Gain (Cr 7020) and Loss (Dr 8030)
 * 8. Prepayments initial capitalisation to 1130 and monthly release to expenses
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const prisma = require('../prisma');
const chartOfAccountsService = require('../modules/accounting/services/chartOfAccounts.service');
const fixedAssetService = require('../modules/accounting/services/fixedAsset.service');
const prepaymentService = require('../modules/accounting/services/prepayment.service');
const journalService = require('../modules/accounting/services/journal.service');

describe('Fixed Assets & Prepayments Integration (Phase 7)', () => {
    jest.setTimeout(30000);
    let testTenantId;

    beforeAll(async () => {
        const tenant = await prisma.tenant.create({
            data: {
                name: 'Fixed Asset & Prepayment Bakery',
                type: 'individual',
                contactEmail: `fa_prep_test_${Date.now()}@example.com`
            }
        });
        testTenantId = tenant.id;
        await chartOfAccountsService.seedTenantChartOfAccounts(testTenantId);
    });

    afterAll(async () => {
        if (testTenantId) {
            await prisma.tenant.delete({ where: { id: testTenantId } }).catch(() => {});
        }
        await prisma.$disconnect();
    });

    it('1. Register fixed asset with initial acquisition entry (Dr 1200 / Cr 1110)', async () => {
        const result = await fixedAssetService.registerFixedAsset(testTenantId, {
            name: 'Industrial Double Deck Bakery Oven',
            assetCategory: 'bakery_equipment',
            cost: 2400000,
            residualValue: 0,
            usefulLifeMonths: 60, // Ruling 14: 5 years (60 months)
            useType: 'production',
            acquisitionDate: new Date('2026-03-25'), // Late in the month
            postInitialEntry: true,
            paymentMethod: 'bank'
        });

        expect(result.fixedAsset).toBeDefined();
        expect(result.journalEntry).toBeDefined();
        expect(result.monthlyDepreciation).toBe(40000); // 2,400,000 / 60 = 40,000

        // Check General Ledger for 1200 Bakery Equipment
        const assetLedger = await journalService.getAccountLedger(testTenantId, '1200');
        expect(assetLedger.endingBalance).toBe(2400000);
    });

    it('2. Full month charge in month of purchase, no pro-rating (Ruling 12)', async () => {
        const assets = await fixedAssetService.getFixedAssets(testTenantId, { category: 'bakery_equipment' });
        const oven = assets[0];

        // Depreciate for March 2026 (even though acquired on March 25th)
        const depResult = await fixedAssetService.depreciateAssetForMonth(
            testTenantId,
            oven.id,
            new Date('2026-03-31')
        );

        expect(depResult.monthlyCharge).toBe(40000); // FULL month charge (Ruling 12)
        expect(depResult.accumulatedDepreciation).toBe(40000);
        expect(depResult.netBookValue).toBe(2360000);

        // Production equipment charges 5060 COGS
        const entry = await journalService.getJournalEntryById(testTenantId, depResult.journalEntry.id);
        const depExpLine = entry.lines.find(l => l.accountCode === '5060');
        const contraLine = entry.lines.find(l => l.accountCode === '1290');

        expect(Number(depExpLine.debit)).toBe(40000);
        expect(Number(contraLine.credit)).toBe(40000);
    });

    it('3. Asset cost is preserved in 1200; depreciation accumulates in 1290 contra', async () => {
        // Original cost in 1200 must remain strictly ₦2,400,000
        const assetLedger = await journalService.getAccountLedger(testTenantId, '1200');
        expect(assetLedger.endingBalance).toBe(2400000);

        // Contra 1290 must have ₦40,000 credit balance
        const contraLedger = await journalService.getAccountLedger(testTenantId, '1290');
        expect(contraLedger.endingBalance).toBe(40000);
    });

    it('4. Office PPE routes depreciation to 6400 Depreciation, Office PPE (Admin Expense)', async () => {
        const result = await fixedAssetService.registerFixedAsset(testTenantId, {
            name: 'Toyota Delivery Van 2020',
            assetCategory: 'motor_vehicles',
            cost: 3600000,
            residualValue: 0,
            usefulLifeMonths: 48, // 4 years (Ruling 14)
            useType: 'office',
            acquisitionDate: new Date('2026-04-10'),
            postInitialEntry: true,
            paymentMethod: 'bank'
        });

        expect(result.monthlyDepreciation).toBe(75000); // 3,600,000 / 48 = 75,000

        const depResult = await fixedAssetService.depreciateAssetForMonth(
            testTenantId,
            result.fixedAsset.id,
            new Date('2026-04-30')
        );

        expect(depResult.monthlyCharge).toBe(75000);

        // Verify journal entry: Dr 6400 (Office PPE) / Cr 1290
        const entry = await journalService.getJournalEntryById(testTenantId, depResult.journalEntry.id);
        const adminDepLine = entry.lines.find(l => l.accountCode === '6400');
        const contraLine = entry.lines.find(l => l.accountCode === '1290');

        expect(Number(adminDepLine.debit)).toBe(75000);
        expect(Number(contraLine.credit)).toBe(75000);
    });

    it('5. Intangibles route amortisation to 6410 and contra 1295', async () => {
        const result = await fixedAssetService.registerFixedAsset(testTenantId, {
            name: 'Bakery Management Proprietary Recipe Software License',
            assetCategory: 'software',
            cost: 600000,
            residualValue: 0,
            usefulLifeMonths: 24,
            useType: 'intangible',
            acquisitionDate: new Date('2026-04-01'),
            postInitialEntry: true,
            paymentMethod: 'bank'
        });

        expect(result.monthlyDepreciation).toBe(25000); // 600,000 / 24 = 25,000

        const depResult = await fixedAssetService.depreciateAssetForMonth(
            testTenantId,
            result.fixedAsset.id,
            new Date('2026-04-30')
        );

        // Verify Dr 6410 Amortisation / Cr 1295 Accumulated Amortisation
        const entry = await journalService.getJournalEntryById(testTenantId, depResult.journalEntry.id);
        const amortLine = entry.lines.find(l => l.accountCode === '6410');
        const contraLine = entry.lines.find(l => l.accountCode === '1295');

        expect(Number(amortLine.debit)).toBe(25000);
        expect(Number(contraLine.credit)).toBe(25000);
    });

    it('6. Asset disposal with Gain on Disposal (Cr 7020 Other Revenue)', async () => {
        // Register equipment for ₦500,000
        const reg = await fixedAssetService.registerFixedAsset(testTenantId, {
            name: 'Pastry Dough Sheeter Machine',
            assetCategory: 'bakery_equipment',
            cost: 500000,
            usefulLifeMonths: 50,
            useType: 'production',
            acquisitionDate: new Date('2026-01-01'),
            postInitialEntry: true
        });

        // Depreciate 2 months: accumulated = ₦20,000; NBV = ₦480,000
        await fixedAssetService.depreciateAssetForMonth(testTenantId, reg.fixedAsset.id, new Date('2026-01-31'));
        await fixedAssetService.depreciateAssetForMonth(testTenantId, reg.fixedAsset.id, new Date('2026-02-28'));

        // Sell machine for ₦550,000 (Proceeds ₦550k > NBV ₦480k -> Gain ₦70,000)
        const disposal = await fixedAssetService.disposeFixedAsset(testTenantId, reg.fixedAsset.id, {
            proceeds: 550000,
            paymentMethod: 'bank',
            disposalDate: new Date('2026-03-15')
        });

        expect(disposal.disposalType).toBe('GAIN');
        expect(disposal.gainOrLoss).toBe(70000);

        const entry = await journalService.getJournalEntryById(testTenantId, disposal.journalEntry.id);
        const bankLine = entry.lines.find(l => l.accountCode === '1110');
        const costRelief = entry.lines.find(l => l.accountCode === '1200');
        const contraClear = entry.lines.find(l => l.accountCode === '1290');
        const gainLine = entry.lines.find(l => l.accountCode === '7020');

        expect(Number(bankLine.debit)).toBe(550000);
        expect(Number(costRelief.credit)).toBe(500000);
        expect(Number(contraClear.debit)).toBe(20000);
        expect(Number(gainLine.credit)).toBe(70000);

        // Gain posted to 7020
        const gainLedger = await journalService.getAccountLedger(testTenantId, '7020');
        expect(gainLedger.endingBalance).toBe(70000);
    });

    it('7. Asset disposal with Loss on Disposal (Dr 8030 Other Expense)', async () => {
        // Register computer for ₦200,000
        const reg = await fixedAssetService.registerFixedAsset(testTenantId, {
            name: 'Shop Laptop',
            assetCategory: 'computers',
            cost: 200000,
            usefulLifeMonths: 40,
            useType: 'office',
            acquisitionDate: new Date('2026-01-01'),
            postInitialEntry: true
        });

        // Depreciate 1 month: accumulated = ₦5,000; NBV = ₦195,000
        await fixedAssetService.depreciateAssetForMonth(testTenantId, reg.fixedAsset.id, new Date('2026-01-31'));

        // Sell for ₦120,000 (Proceeds ₦120k < NBV ₦195k -> Loss ₦75,000)
        const disposal = await fixedAssetService.disposeFixedAsset(testTenantId, reg.fixedAsset.id, {
            proceeds: 120000,
            paymentMethod: 'bank',
            disposalDate: new Date('2026-02-15')
        });

        expect(disposal.disposalType).toBe('LOSS');
        expect(disposal.gainOrLoss).toBe(-75000);

        const entry = await journalService.getJournalEntryById(testTenantId, disposal.journalEntry.id);
        const lossLine = entry.lines.find(l => l.accountCode === '8030');
        expect(Number(lossLine.debit)).toBe(75000);

        const lossLedger = await journalService.getAccountLedger(testTenantId, '8030');
        expect(lossLedger.endingBalance).toBe(75000);
    });

    it('8. Prepayment advance initial payment capitalises to 1130 Other Receivable & Prepaid Expenses', async () => {
        // 6 months fibre internet paid in advance: ₦120,000 (₦20,000 / month)
        const result = await prepaymentService.createPrepaymentSchedule(testTenantId, {
            description: 'Fiber Internet 6-Month Advance Subscription',
            totalAmount: 120000,
            totalMonths: 6,
            startDate: new Date('2026-05-01'),
            expenseAccountCode: '6050', // 6050 Internet & Communications
            postInitialEntry: true,
            paymentMethod: 'bank'
        });

        expect(result.schedule).toBeDefined();
        expect(result.monthlyAmount).toBe(20000);

        // Check initial entry: Dr 1130 / Cr 1110
        const entry = await journalService.getJournalEntryById(testTenantId, result.journalEntry.id);
        const prepLine = entry.lines.find(l => l.accountCode === '1130');
        const bankLine = entry.lines.find(l => l.accountCode === '1110');

        expect(Number(prepLine.debit)).toBe(120000);
        expect(Number(bankLine.credit)).toBe(120000);

        // Prepayment account 1130 has ₦120,000 debit balance
        const prepLedger = await journalService.getAccountLedger(testTenantId, '1130');
        expect(prepLedger.endingBalance).toBe(120000);

        // Internet expense (6050) is still ₦0.00
        const expLedger = await journalService.getAccountLedger(testTenantId, '6050');
        expect(expLedger.endingBalance).toBe(0);
    });

    it('9. Monthly prepayment release debits 6050 Internet Expense and credits 1130 Prepayments', async () => {
        const schedules = await prepaymentService.getPrepaymentSchedules(testTenantId);
        const internetSchedule = schedules[0];

        // Release Month 1 (May 2026)
        const release1 = await prepaymentService.releasePrepaymentForPeriod(
            testTenantId,
            internetSchedule.id,
            new Date('2026-05-31')
        );

        expect(release1.releaseAmount).toBe(20000);
        expect(release1.newReleasedAmount).toBe(20000);
        expect(release1.isFullyAmortized).toBe(false);

        // Verify Dr 6050 / Cr 1130
        const entry = await journalService.getJournalEntryById(testTenantId, release1.journalEntry.id);
        const expLine = entry.lines.find(l => l.accountCode === '6050');
        const prepLine = entry.lines.find(l => l.accountCode === '1130');

        expect(Number(expLine.debit)).toBe(20000);
        expect(Number(prepLine.credit)).toBe(20000);

        // 1130 balance reduces from ₦120,000 to ₦100,000
        const prepLedger = await journalService.getAccountLedger(testTenantId, '1130');
        expect(prepLedger.endingBalance).toBe(100000);

        // 6050 Internet Expense reflects ₦20,000
        const expLedger = await journalService.getAccountLedger(testTenantId, '6050');
        expect(expLedger.endingBalance).toBe(20000);
    });

    it('10. Batch monthly runners execute without duplication', async () => {
        // Run batch depreciation for May 2026
        const depBatch = await fixedAssetService.runMonthlyDepreciationBatch(
            testTenantId,
            new Date('2026-05-31')
        );
        expect(depBatch.totalProcessed).toBeGreaterThan(0);

        // Re-running for same period should be idempotent (already depreciated)
        const depBatchRepeat = await fixedAssetService.runMonthlyDepreciationBatch(
            testTenantId,
            new Date('2026-05-31')
        );
        expect(depBatchRepeat.totalDepreciation).toBe(0);

        // Run batch prepayment release for May 2026
        const prepBatch = await prepaymentService.runMonthlyPrepaymentReleases(
            testTenantId,
            new Date('2026-05-31')
        );
        expect(prepBatch.totalReleased).toBe(0); // Already released in test 9
    });
});
