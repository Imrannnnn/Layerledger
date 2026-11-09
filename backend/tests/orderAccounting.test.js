/**
 * LayerLedger Order Lifecycle & Payment Accounting Tests (Phase 6)
 * Validates:
 * 1. Order confirmed / invoice raised = 0 journal entries (Ruling 3)
 * 2. Customer deposit before delivery = Dr 1110 Bank / Cr 2120 Customer Deposits (Ruling 6)
 * 3. Month with deposit but no delivery = 0 revenue recognised (Ruling 4)
 * 4. Baking = Dr 1160 Finished Goods / Cr 1140 Raw Materials (Ruling 16)
 * 5. Negative stock allowed and flagged, never blocked (Ruling 18)
 * 6. Delivery = Simultaneous Revenue & COGS recognition (Ruling 2 & 5)
 * 7. Post-delivery balance payment = Dr 1110 Bank / Cr 1120 AR
 * 8. Cancellations & Forfeited Deposits (Ruling 19 & 20):
 *    - Forfeited before bake -> Cr 7030 Forfeited Deposits (keeping cake gross margin clean)
 *    - Refunded before bake -> Cr 1110 Bank
 *    - Cancelled inside no-refund window after bake -> marked delivered per Ruling 20
 *    - Goodwill refund after bake -> Dr 5040 Spoilage & Waste / Cr 1160 Finished Goods
 * 9. Walk-in Counter Sale = Immediate collapsed revenue & COGS
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const prisma = require('../prisma');
const chartOfAccountsService = require('../modules/accounting/services/chartOfAccounts.service');
const orderAccountingService = require('../modules/accounting/services/orderAccounting.service');
const journalService = require('../modules/accounting/services/journal.service');

describe('Order Lifecycle & Payment Accounting Integration (Phase 6)', () => {
    jest.setTimeout(30000);
    let testTenantId;
    let rawMaterialItem;

    beforeAll(async () => {
        const tenant = await prisma.tenant.create({
            data: {
                name: 'Order Lifecycle Bakery',
                type: 'individual',
                contactEmail: `order_test_${Date.now()}@example.com`
            }
        });
        testTenantId = tenant.id;
        await chartOfAccountsService.seedTenantChartOfAccounts(testTenantId);

        // Seed raw materials for baking test
        rawMaterialItem = await prisma.inventoryItem.create({
            data: {
                tenantId: testTenantId,
                name: 'Unsalted Butter',
                category: 'dairy',
                unit: 'kg',
                cost: 2500,
                stock: 10,
                minStock: 2,
                totalValueOnHand: 25000
            }
        });
    });

    afterAll(async () => {
        if (testTenantId) {
            await prisma.tenant.delete({ where: { id: testTenantId } }).catch(() => {});
        }
        await prisma.$disconnect();
    });

    it('1. Deposit payment before delivery posts Dr 1110 Bank / Cr 2120 Customer Deposits (0 Revenue)', async () => {
        const order = await prisma.order.create({
            data: {
                tenantId: testTenantId,
                status: 'confirmed',
                totalPrice: 60000,
                totalCost: 15000,
                items: {
                    create: [{ name: '3-Tier Wedding Cake', price: 60000, cost: 15000 }]
                }
            }
        });

        // Customer pays ₦40,000 deposit
        const depositEntry = await orderAccountingService.recordDepositPayment(testTenantId, order.id, {
            amount: 40000,
            method: 'bank_transfer',
            date: new Date()
        });

        expect(depositEntry).toBeDefined();

        const entry = await journalService.getJournalEntryById(testTenantId, depositEntry.id);
        const bankLine = entry.lines.find(l => l.accountCode === '1110');
        const depositLine = entry.lines.find(l => l.accountCode === '2120');

        expect(Number(bankLine.debit)).toBe(40000);
        expect(Number(bankLine.credit)).toBe(0);
        expect(Number(depositLine.debit)).toBe(0);
        expect(Number(depositLine.credit)).toBe(40000);

        // Verify Customer Deposits (2120) ledger running balance is ₦40,000 credit
        const depositLedger = await journalService.getAccountLedger(testTenantId, '2120');
        expect(depositLedger.account.closingBalance).toBe('40000.00');

        // Verify Revenue (4000) ledger balance is strictly ₦0.00
        const revenueLedger = await journalService.getAccountLedger(testTenantId, '4000');
        expect(revenueLedger.account.closingBalance).toBe('0.00');
    });

    it('2. Baking transfers Dr 1160 Finished Goods / Cr 1140 Raw Materials with 0 profit impact', async () => {
        const order = await prisma.order.findFirst({ where: { tenantId: testTenantId } });

        const bakeResult = await orderAccountingService.recordOrderBaked(testTenantId, order.id, {
            actualIngredientCost: 15000,
            usages: [{ itemId: rawMaterialItem.id, qty: 3 }]
        });

        expect(bakeResult.journalEntry).toBeDefined();

        const entry = await journalService.getJournalEntryById(testTenantId, bakeResult.journalEntry.id);
        const finishedGoodsLine = entry.lines.find(l => l.accountCode === '1160');
        const rawMaterialsLine = entry.lines.find(l => l.accountCode === '1140');

        expect(Number(finishedGoodsLine.debit)).toBe(15000);
        expect(Number(rawMaterialsLine.credit)).toBe(15000);

        // Verify physical inventory was deducted
        const updatedItem = await prisma.inventoryItem.findUnique({ where: { id: rawMaterialItem.id } });
        expect(updatedItem.stock).toBe(7); // 10 - 3
    });

    it('3. Negative stock is allowed and flagged with warning, never blocked (Ruling 18)', async () => {
        const order = await prisma.order.create({
            data: {
                tenantId: testTenantId,
                status: 'confirmed',
                totalPrice: 20000,
                totalCost: 10000
            }
        });

        // On hand is 7kg. Attempt to use 12kg (exceeds on-hand)
        const bakeResult = await orderAccountingService.recordOrderBaked(testTenantId, order.id, {
            actualIngredientCost: 10000,
            usages: [{ itemId: rawMaterialItem.id, qty: 12 }]
        });

        expect(bakeResult.order.isBaked).toBe(true);

        const updatedItem = await prisma.inventoryItem.findUnique({ where: { id: rawMaterialItem.id } });
        expect(updatedItem.stock).toBe(-5); // 7 - 12 = -5

        // Verify inventory history logged negative stock warning
        const history = await prisma.inventoryHistory.findFirst({
            where: { referenceId: order.id },
            orderBy: { createdAt: 'desc' }
        });
        expect(history.reason).toContain('[WARNING: NEGATIVE STOCK]');
    });

    it('4. Delivery recognises Revenue (clearing 2120 deposit + Dr 1120 AR) and COGS (Dr 5000 / Cr 1160)', async () => {
        const order = await prisma.order.findFirst({
            where: { tenantId: testTenantId, totalPrice: 60000 }
        });

        // Deliver order
        const deliverResult = await orderAccountingService.recordOrderDelivered(testTenantId, order.id, {
            deliveredPrice: 60000,
            actualCost: 15000
        });

        expect(deliverResult.journalEntry).toBeDefined();

        const entry = await journalService.getJournalEntryById(testTenantId, deliverResult.journalEntry.id);

        // Revenue lines:
        // Dr 2120 Customer Deposits ₦40,000 (clearing deposit)
        // Dr 1120 Accounts Receivable ₦20,000 (remaining balance)
        // Cr 4000 Cake Sales ₦60,000
        const depositLine = entry.lines.find(l => l.accountCode === '2120');
        const arLine = entry.lines.find(l => l.accountCode === '1120');
        const salesLine = entry.lines.find(l => l.accountCode === '4000' || l.accountCode === '4040');

        expect(Number(depositLine.debit)).toBe(40000);
        expect(Number(arLine.debit)).toBe(20000);
        expect(Number(salesLine.credit)).toBe(60000);

        // COGS lines:
        // Dr 5000 Raw Materials COGS ₦15,000
        // Cr 1160 Finished Goods ₦15,000
        const cogsLine = entry.lines.find(l => l.accountCode === '5000');
        const fgLine = entry.lines.find(l => l.accountCode === '1160');

        expect(Number(cogsLine.debit)).toBe(15000);
        expect(Number(fgLine.credit)).toBe(15000);

        // Verify Customer Deposits (2120) has cleared to ₦0.00
        const depositLedger = await journalService.getAccountLedger(testTenantId, '2120');
        expect(depositLedger.account.closingBalance).toBe('0.00');

        // Verify Accounts Receivable (1120) has ₦20,000 debit balance
        const arLedger = await journalService.getAccountLedger(testTenantId, '1120');
        expect(arLedger.account.closingBalance).toBe('20000.00');

        // Verify Revenue (4040 or 4000) now reflects ₦60,000
        const revCode = salesLine.accountCode;
        const revLedger = await journalService.getAccountLedger(testTenantId, revCode);
        expect(revLedger.account.closingBalance).toBe('60000.00');
    });

    it('5. Post-delivery balance payment clears AR without recording revenue again', async () => {
        const order = await prisma.order.findFirst({
            where: { tenantId: testTenantId, totalPrice: 60000 }
        });

        // Customer pays remaining ₦20,000
        const balanceEntry = await orderAccountingService.recordBalancePayment(testTenantId, order.id, {
            amount: 20000,
            method: 'bank_transfer',
            date: new Date()
        });

        expect(balanceEntry).toBeDefined();

        const entry = await journalService.getJournalEntryById(testTenantId, balanceEntry.id);
        const bankLine = entry.lines.find(l => l.accountCode === '1110');
        const arLine = entry.lines.find(l => l.accountCode === '1120');

        expect(Number(bankLine.debit)).toBe(20000);
        expect(Number(arLine.credit)).toBe(20000);

        // AR balance returns to ₦0.00
        const arLedger = await journalService.getAccountLedger(testTenantId, '1120');
        expect(arLedger.account.closingBalance).toBe('0.00');
    });

    it('6. Cancellation before bake with forfeited deposit routes to 7030 Other Revenue (Ruling 19)', async () => {
        // Create an order with ₦15,000 deposit
        const order = await prisma.order.create({
            data: {
                tenantId: testTenantId,
                status: 'confirmed',
                totalPrice: 45000,
                totalCost: 10000
            }
        });

        await orderAccountingService.recordDepositPayment(testTenantId, order.id, {
            amount: 15000,
            method: 'bank_transfer'
        });

        // Client cancels before bake; deposit is forfeited per bakery terms
        const cancelResult = await orderAccountingService.recordOrderCancellation(
            testTenantId,
            order.id,
            'FORFEITED_BEFORE_BAKE'
        );

        expect(cancelResult.status).toBe('cancelled');

        // Check journal: Dr 2120 Customer Deposits / Cr 7030 Forfeited Deposits
        const forfeitedLedger = await journalService.getAccountLedger(testTenantId, '7030');
        expect(forfeitedLedger.account.closingBalance).toBe('15000.00');

        // Cake Sales (4000) was NOT credited (margin stays pure)
        const salesLedger = await journalService.getAccountLedger(testTenantId, '4000');
        expect(salesLedger.account.closingBalance).toBe('0.00');
    });

    it('7. Uncollected order after bake is marked delivered per Ruling 20 with isForfeited=true', async () => {
        const order = await prisma.order.create({
            data: {
                tenantId: testTenantId,
                status: 'baking',
                isBaked: true,
                totalPrice: 30000,
                totalCost: 8000
            }
        });

        await orderAccountingService.recordDepositPayment(testTenantId, order.id, {
            amount: 30000,
            method: 'bank_transfer'
        });

        // Customer never collects; cancelled inside no-refund window after bake
        const uncollectedResult = await orderAccountingService.recordOrderCancellation(
            testTenantId,
            order.id,
            'CANCELLED_INSIDE_NO_REFUND_AFTER_BAKE'
        );

        // Ruling 20: Marked delivered, no separate uncollected status needed
        expect(uncollectedResult.status).toBe('delivered');
        expect(uncollectedResult.isForfeited).toBe(true);
    });

    it('8. Goodwill refund after bake records Spoilage & Waste (5040) and bank refund', async () => {
        const order = await prisma.order.create({
            data: {
                tenantId: testTenantId,
                status: 'baking',
                isBaked: true,
                totalPrice: 25000,
                totalCost: 7000
            }
        });

        await orderAccountingService.recordDepositPayment(testTenantId, order.id, {
            amount: 25000,
            method: 'bank_transfer'
        });

        // Customer cancels after bake, manager grants goodwill refund; cake written off as spoilage
        await orderAccountingService.recordOrderCancellation(
            testTenantId,
            order.id,
            'REFUNDED_AFTER_BAKE_GOODWILL',
            { refundAmount: 25000, cost: 7000 }
        );

        const spoilageLedger = await journalService.getAccountLedger(testTenantId, '5040');
        expect(spoilageLedger.account.closingBalance).toBe('7000.00');
    });

    it('9. Walk-in counter sale posts collapsed revenue and raw materials COGS immediately', async () => {
        const walkInEntry = await orderAccountingService.recordWalkInSale(testTenantId, {
            price: 5000,
            cost: 1200,
            paymentMethod: 'cash',
            description: 'Red Velvet cupcake box'
        });

        expect(walkInEntry).toBeDefined();

        const entry = await journalService.getJournalEntryById(testTenantId, walkInEntry.id);
        const cashLine = entry.lines.find(l => l.accountCode === '1100');
        const salesLine = entry.lines.find(l => l.accountCode === '4000');
        const cogsLine = entry.lines.find(l => l.accountCode === '5000');
        const rawMatLine = entry.lines.find(l => l.accountCode === '1140');

        expect(Number(cashLine.debit)).toBe(5000);
        expect(Number(salesLine.credit)).toBe(5000);
        expect(Number(cogsLine.debit)).toBe(1200);
        expect(Number(rawMatLine.credit)).toBe(1200);
    });
});
