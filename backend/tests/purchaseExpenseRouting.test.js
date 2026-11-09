/**
 * LayerLedger Purchase, Expense & 3-Way Routing Tests (Phase 5)
 * Validates:
 * 1. 3-Way Destination Routing (Inventory 1140/1150, Expense 5xxx/6xxx, Fixed Assets 12xx)
 * 2. ₦50,000 Capitalisation Threshold rule (Ruling 13)
 * 3. Atomic posting of purchases and expenses to the General Ledger
 * 4. Reversal and cleanup on purchase/expense updates and deletions
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const prisma = require('../prisma');
const chartOfAccountsService = require('../modules/accounting/services/chartOfAccounts.service');
const purchaseRoutingService = require('../modules/accounting/services/purchaseRouting.service');
const journalService = require('../modules/accounting/services/journal.service');

describe('Purchase, Expense & 3-Way Routing Integration (Phase 5)', () => {
    jest.setTimeout(30000);
    let testTenantId;
    let rawMaterialItem;

    beforeAll(async () => {
        const tenant = await prisma.tenant.create({
            data: {
                name: 'Purchase Routing Bakery',
                type: 'individual',
                contactEmail: `purch_test_${Date.now()}@example.com`
            }
        });
        testTenantId = tenant.id;
        await chartOfAccountsService.seedTenantChartOfAccounts(testTenantId);

        // Create an inventory item for raw materials
        rawMaterialItem = await prisma.inventoryItem.create({
            data: {
                tenantId: testTenantId,
                name: 'Golden Penny All-Purpose Flour',
                category: 'flour',
                unit: 'kg',
                cost: 1400,
                stock: 50,
                minStock: 10,
                totalValueOnHand: 70000
            }
        });
    });

    afterAll(async () => {
        if (testTenantId) {
            await prisma.tenant.delete({ where: { id: testTenantId } }).catch(() => {});
        }
    });

    it('1. Should route ingredient purchase to 1140 Raw Materials (Asset-to-Asset, 0 profit impact)', async () => {
        const purchase = await prisma.purchase.create({
            data: {
                tenantId: testTenantId,
                date: new Date('2026-02-12'),
                supplier: 'Golden Penny Mills',
                amount: 35000,
                notes: '25kg Flour Bag',
                itemId: rawMaterialItem.id,
                qty: 1,
                unitSize: 25,
                stockAdded: 25,
                cpu: 1400
            }
        });

        const routingResult = await purchaseRoutingService.recordPurchaseAccounting(testTenantId, purchase, {
            category: 'flour'
        });

        expect(routingResult.destination).toBe('inventory');
        expect(routingResult.journalEntry).toBeDefined();

        const entry = await journalService.getJournalEntryById(testTenantId, routingResult.journalEntry.id);
        expect(entry.lines.length).toBe(2);

        const rawMatLine = entry.lines.find(l => l.accountCode === '1140');
        const bankLine = entry.lines.find(l => l.accountCode === '1110');

        expect(rawMatLine).toBeDefined();
        expect(rawMatLine.debit).toBe(35000);
        expect(bankLine).toBeDefined();
        expect(bankLine.credit).toBe(35000);

        // Verify General Ledger balance for 1140
        const ledger1140 = await journalService.getAccountLedger(testTenantId, '1140');
        expect(ledger1140.endingBalance).toBe(35000);
    });

    it('2. Should route packaging items purchase to 1150 Packaging Materials', async () => {
        const purchase = await prisma.purchase.create({
            data: {
                tenantId: testTenantId,
                date: new Date('2026-02-13'),
                supplier: 'PackPro Nigeria',
                amount: 28000,
                notes: '500 Cake Boxes & Boards',
                destination: 'packaging'
            }
        });

        const routingResult = await purchaseRoutingService.recordPurchaseAccounting(testTenantId, purchase, {
            category: 'packaging'
        });

        expect(routingResult.destination).toBe('inventory');

        const entry = await journalService.getJournalEntryById(testTenantId, routingResult.journalEntry.id);
        const packagingLine = entry.lines.find(l => l.accountCode === '1150');
        expect(packagingLine).toBeDefined();
        expect(packagingLine.debit).toBe(28000);

        const ledger1150 = await journalService.getAccountLedger(testTenantId, '1150');
        expect(ledger1150.endingBalance).toBe(28000);
    });

    it('3. Should enforce the ₦50,000 capitalisation threshold (Acceptance Check 10)', async () => {
        // Item below threshold: ₦18,000 hand mixer -> expensed directly to 5030, no fixed asset record
        const smallPurchase = await prisma.purchase.create({
            data: {
                tenantId: testTenantId,
                date: new Date('2026-02-14'),
                supplier: 'Kitchen Central',
                amount: 18000,
                notes: 'Small Hand Mixer 300W'
            }
        });

        const smallResult = await purchaseRoutingService.recordPurchaseAccounting(testTenantId, smallPurchase, {
            category: 'utensils'
        });

        expect(smallResult.destination).toBe('expense');
        expect(smallResult.fixedAsset).toBeNull();

        const smallEntry = await journalService.getJournalEntryById(testTenantId, smallResult.journalEntry.id);
        const expenseLine = smallEntry.lines.find(l => l.accountCode === '5030');
        expect(expenseLine).toBeDefined();
        expect(expenseLine.debit).toBe(18000);

        // Item above threshold: ₦85,000 commercial spiral mixer -> enters Fixed Asset Register (1200)
        const bigPurchase = await prisma.purchase.create({
            data: {
                tenantId: testTenantId,
                date: new Date('2026-02-15'),
                supplier: 'BakePro Industrial',
                amount: 85000,
                notes: 'Heavy Duty Spiral Dough Mixer 50kg'
            }
        });

        const bigResult = await purchaseRoutingService.recordPurchaseAccounting(testTenantId, bigPurchase, {
            category: 'equipment'
        });

        expect(bigResult.destination).toBe('fixed_asset');
        expect(bigResult.fixedAsset).not.toBeNull();
        expect(parseFloat(bigResult.fixedAsset.cost.toString())).toBe(85000);
        expect(bigResult.fixedAsset.usefulLifeMonths).toBe(60); // 5 years per Ruling 14
        expect(bigResult.fixedAsset.status).toBe('ACTIVE');

        const bigEntry = await journalService.getJournalEntryById(testTenantId, bigResult.journalEntry.id);
        const ppeLine = bigEntry.lines.find(l => l.accountCode === '1200');
        expect(ppeLine).toBeDefined();
        expect(ppeLine.debit).toBe(85000);

        // General Ledger for Bakery Equipment (1200) should now have 85,000
        const ledger1200 = await journalService.getAccountLedger(testTenantId, '1200');
        expect(ledger1200.endingBalance).toBe(85000);
    });

    it('4. Should record operating expenses and map category accurately', async () => {
        const expense = await prisma.expense.create({
            data: {
                tenantId: testTenantId,
                date: new Date('2026-02-16'),
                amount: 22000,
                category: 'Fuel & Vehicle Maintenance',
                description: 'Diesel for bakery generator'
            }
        });

        const result = await purchaseRoutingService.recordExpenseAccounting(testTenantId, expense);
        expect(result.accountCode).toBe('6080');

        const entry = await journalService.getJournalEntryById(testTenantId, result.journalEntry.id);
        const fuelLine = entry.lines.find(l => l.accountCode === '6080');
        expect(fuelLine).toBeDefined();
        expect(fuelLine.debit).toBe(22000);
    });

    it('5. Should reverse old journal entry and post new one when purchase is updated', async () => {
        const purchase = await prisma.purchase.create({
            data: {
                tenantId: testTenantId,
                date: new Date('2026-02-17'),
                supplier: 'Sugar Refinery',
                amount: 40000,
                notes: 'Dangote Sugar 50kg bag',
                destination: 'inventory'
            }
        });

        await purchaseRoutingService.recordPurchaseAccounting(testTenantId, purchase);

        // Before update: 1140 balance
        const ledgerBefore = await journalService.getAccountLedger(testTenantId, '1140');
        const balanceBefore = ledgerBefore.endingBalance;

        // Simulate update: amount changed to 46,000
        await purchaseRoutingService.handlePurchaseCleanup(testTenantId, purchase.id, 'Purchase updated');
        const updatedPurchase = await prisma.purchase.update({
            where: { id: purchase.id },
            data: { amount: 46000 }
        });
        await purchaseRoutingService.recordPurchaseAccounting(testTenantId, updatedPurchase);

        const ledgerAfter = await journalService.getAccountLedger(testTenantId, '1140');
        expect(ledgerAfter.endingBalance).toBe(balanceBefore + 6000);
    });

    it('6. Should reverse journal entry when an expense is deleted', async () => {
        const expense = await prisma.expense.create({
            data: {
                tenantId: testTenantId,
                amount: 15000,
                category: 'Maintenance & Repairs',
                description: 'Mixer motor belt replacement'
            }
        });

        const postRes = await purchaseRoutingService.recordExpenseAccounting(testTenantId, expense);
        const entryId = postRes.journalEntry.id;

        // Verify maintenance ledger has 15,000
        const ledgerBefore = await journalService.getAccountLedger(testTenantId, '6040');
        expect(ledgerBefore.endingBalance).toBe(15000);

        // Delete expense and clean up
        await purchaseRoutingService.handleExpenseCleanup(testTenantId, expense.id, 'Expense deleted');
        await prisma.expense.delete({ where: { id: expense.id } });

        const ledgerAfter = await journalService.getAccountLedger(testTenantId, '6040');
        expect(ledgerAfter.endingBalance).toBe(0);

        // Check entry status
        const reversedEntry = await journalService.getJournalEntryById(testTenantId, entryId);
        expect(reversedEntry.status).toBe('REVERSED');
    });
});
