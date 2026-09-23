require('dotenv').config();
if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('sslmode=require')) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace('sslmode=require', 'sslmode=no-verify');
}
jest.setTimeout(45000);
const prisma = require('../prisma');
const { deleteTenantAccount } = require('../controller/tenantController');
const { restrictTo } = require('../middleware/authMiddleware');

const callController = (controllerFn, req, res) => {
    return new Promise((resolve, reject) => {
        res.status = jest.fn().mockImplementation((code) => {
            res.statusCode = code;
            return res;
        });
        res.json = jest.fn().mockImplementation((data) => {
            resolve(data);
            return res;
        });
        controllerFn(req, res, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
};

describe('Tenant Account Deletion & Complete Database Wipe Integration Tests', () => {
    let tenantId;
    let ownerUserId;
    let staffUserId;

    beforeAll(async () => {
        // 1. Create Tenant
        const tenant = await prisma.tenant.create({
            data: {
                name: `Delete Account Test ${Date.now()}`,
                type: 'individual',
                settings: { appConfig: { ll_test: true } }
            }
        });
        tenantId = tenant.id;

        // 2. Create Owner User & Staff User
        const owner = await prisma.user.create({
            data: {
                tenantId,
                name: 'Test Owner',
                email: `owner_${Date.now()}@testdelete.com`,
                passwordHash: 'hashed_pw',
                role: 'owner'
            }
        });
        ownerUserId = owner.id;

        const staff = await prisma.user.create({
            data: {
                tenantId,
                name: 'Test Staff',
                email: `staff_${Date.now()}@testdelete.com`,
                passwordHash: 'hashed_pw',
                role: 'production'
            }
        });
        staffUserId = staff.id;

        // 3. Create Client
        const client = await prisma.client.create({
            data: {
                tenantId,
                name: 'Test Client',
                phone: '08012345678'
            }
        });

        // 4. Create InventoryItem
        const item = await prisma.inventoryItem.create({
            data: {
                tenantId,
                name: 'Test Sugar',
                category: 'Baking',
                unit: 'kg',
                cost: 500,
                stock: 10
            }
        });

        // 5. Create Recipe and RecipeIngredient
        const recipe = await prisma.recipe.create({
            data: {
                tenantId,
                name: 'Test Red Velvet Cake'
            }
        });
        await prisma.recipeIngredient.create({
            data: {
                recipeId: recipe.id,
                inventoryItemId: item.id,
                quantity: 2
            }
        });

        // 6. Create Order, OrderItem, OrderPayment
        const order = await prisma.order.create({
            data: {
                tenantId,
                clientId: client.id,
                status: 'confirmed',
                totalPrice: 15000,
                totalCost: 5000
            }
        });
        await prisma.orderItem.create({
            data: {
                orderId: order.id,
                recipeId: recipe.id,
                name: 'Red Velvet 8-inch',
                price: 15000,
                cost: 5000
            }
        });
        await prisma.orderPayment.create({
            data: {
                orderId: order.id,
                amount: 15000,
                type: 'full'
            }
        });

        // 7. Create Invoice
        await prisma.invoice.create({
            data: {
                tenantId,
                orderId: order.id,
                invoiceNumber: `INV-DEL-${Date.now()}`
            }
        });

        // 8. Create Purchase & InventoryHistory
        await prisma.purchase.create({
            data: {
                tenantId,
                itemId: item.id,
                amount: 5000,
                qty: 10
            }
        });
        await prisma.inventoryHistory.create({
            data: {
                tenantId,
                inventoryItemId: item.id,
                type: 'purchase',
                qtyDelta: 10,
                valueDelta: 5000,
                pricePerUnit: 500,
                qtyAfter: 10,
                valueAfter: 5000,
                avgCostAfter: 500
            }
        });

        // 9. Create OpeningStock
        await prisma.openingStock.create({
            data: {
                tenantId,
                itemId: item.id,
                name: 'Test Sugar',
                unit: 'kg',
                cost: 500,
                openingQty: 10,
                totalValue: 5000,
                month: '2026-09'
            }
        });

        // 10. Create Expense, Transaction, TokenTransaction, Packaging, Decoration
        await prisma.expense.create({
            data: {
                tenantId,
                amount: 1200,
                category: 'Utilities'
            }
        });
        await prisma.transaction.create({
            data: {
                tenantId,
                amount: 15000,
                type: 'income',
                description: 'Cake sale'
            }
        });
        await prisma.tokenTransaction.create({
            data: {
                tenantId,
                amount: 5,
                type: 'credit',
                description: 'Bonus tokens'
            }
        });
        await prisma.packaging.create({
            data: {
                tenantId,
                name: '10 inch Cake Box',
                price: 350
            }
        });
        await prisma.decoration.create({
            data: {
                tenantId,
                name: 'Gold Topper',
                price: 1500
            }
        });

        // 11. Create Payment & sub-records
        const payment = await prisma.payment.create({
            data: {
                tenantId,
                userId: ownerUserId,
                resourceType: 'credit_pack',
                idempotencyKey: `idemp-del-${Date.now()}`,
                paymentReference: `PAY-DEL-${Date.now()}`,
                amount: 500000,
                currency: 'NGN',
                totalAmount: 500000,
                status: 'SUCCESS',
                customerEmail: 'test@bakewealth.com'
            }
        });
        await prisma.paymentAttempt.create({
            data: {
                paymentId: payment.id,
                status: 'SUCCESS'
            }
        });
        await prisma.paymentAuditEvent.create({
            data: {
                paymentId: payment.id,
                event: 'PAYMENT_INITIALIZED'
            }
        });
    });

    afterAll(async () => {
        try {
            // Failsafe cleanup in case of test failure
            await prisma.tenant.deleteMany({ where: { id: tenantId } });
            await prisma.$disconnect();
        } catch (e) {
            // Ignore
        }
    });

    test('Non-owners are blocked from deleting tenant account via restrictTo middleware', () => {
        const middleware = restrictTo('owner');
        const req = {
            user: {
                id: staffUserId,
                tenantId,
                role: 'production'
            }
        };
        const res = {
            statusCode: null,
            status(code) {
                this.statusCode = code;
                return this;
            },
            json: jest.fn()
        };
        const next = jest.fn();

        middleware(req, res, next);

        expect(res.statusCode).toBe(403);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ message: expect.stringContaining('Access denied') })
        );
        expect(next).not.toHaveBeenCalled();
    });

    test('Owner successfully deletes tenant account and all associated database records', async () => {
        const req = {
            user: {
                id: ownerUserId,
                tenantId,
                role: 'owner'
            }
        };
        const res = {};

        const result = await callController(deleteTenantAccount, req, res);

        expect(result).toHaveProperty('success', true);
        expect(result.message).toMatch(/permanently deleted/i);

        // Verify that Tenant itself is deleted
        const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
        expect(tenant).toBeNull();

        // Verify that Users are deleted
        const users = await prisma.user.findMany({ where: { tenantId } });
        expect(users).toHaveLength(0);

        // Verify that Clients are deleted
        const clients = await prisma.client.findMany({ where: { tenantId } });
        expect(clients).toHaveLength(0);

        // Verify that Orders, OrderItems, OrderPayments, and Invoices are deleted
        const orders = await prisma.order.findMany({ where: { tenantId } });
        expect(orders).toHaveLength(0);
        const invoices = await prisma.invoice.findMany({ where: { tenantId } });
        expect(invoices).toHaveLength(0);

        // Verify that Recipes and RecipeIngredients are deleted
        const recipes = await prisma.recipe.findMany({ where: { tenantId } });
        expect(recipes).toHaveLength(0);

        // Verify that InventoryItems, OpeningStock, Purchases, InventoryHistory are deleted
        const inventory = await prisma.inventoryItem.findMany({ where: { tenantId } });
        expect(inventory).toHaveLength(0);
        const openingStock = await prisma.openingStock.findMany({ where: { tenantId } });
        expect(openingStock).toHaveLength(0);
        const purchases = await prisma.purchase.findMany({ where: { tenantId } });
        expect(purchases).toHaveLength(0);
        const history = await prisma.inventoryHistory.findMany({ where: { tenantId } });
        expect(history).toHaveLength(0);

        // Verify Expenses, Transactions, TokenTransactions, Packaging, Decorations
        const expenses = await prisma.expense.findMany({ where: { tenantId } });
        expect(expenses).toHaveLength(0);
        const txns = await prisma.transaction.findMany({ where: { tenantId } });
        expect(txns).toHaveLength(0);
        const tokenTxns = await prisma.tokenTransaction.findMany({ where: { tenantId } });
        expect(tokenTxns).toHaveLength(0);
        const packaging = await prisma.packaging.findMany({ where: { tenantId } });
        expect(packaging).toHaveLength(0);
        const decorations = await prisma.decoration.findMany({ where: { tenantId } });
        expect(decorations).toHaveLength(0);

        // Verify Payments
        const payments = await prisma.payment.findMany({ where: { tenantId } });
        expect(payments).toHaveLength(0);
    });
});
