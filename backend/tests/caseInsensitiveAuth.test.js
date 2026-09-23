require('dotenv').config();
if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('sslmode=require')) {
    process.env.DATABASE_URL = process.env.DATABASE_URL.replace('sslmode=require', 'sslmode=no-verify');
}
const prisma = require('../prisma');
const bcrypt = require('bcrypt');
const { registerUserSchema, loginUserSchema } = require('../validators/authValidator');
const { createUserSchema, updateUserSchema } = require('../validators/userValidator');
const { updateTenantSchema } = require('../validators/tenantValidator');
const { createClientSchema, updateClientSchema } = require('../validators/clientValidator');
const { superadminLoginSchema } = require('../validators/superadminValidator');

describe('Case-Insensitive Email Handling Tests', () => {
    afterAll(async () => {
        await prisma.$disconnect();
    });

    test('1. authValidator should normalize uppercase email to lowercase in register and login', () => {
        const registerData = registerUserSchema.parse({
            body: {
                name: 'Baker Test',
                email: '  BAKER.TEST@Example.COM  ',
                password: 'password123',
                companyName: 'Sweet Bakery',
                tenantType: 'individual'
            }
        });

        expect(registerData.body.email).toBe('baker.test@example.com');

        const loginData = loginUserSchema.parse({
            body: {
                email: '  bAkEr.TeSt@EXAMPLE.com  ',
                password: 'password123'
            }
        });

        expect(loginData.body.email).toBe('baker.test@example.com');
    });

    test('2. userValidator should normalize uppercase staff email to lowercase in create and update', () => {
        const staffData = createUserSchema.parse({
            body: {
                name: 'Staff Member',
                email: '  STAFF.USER@Bakery.ORG  ',
                password: 'staffPassword1!',
                role: 'production',
                pin: '1234'
            }
        });

        expect(staffData.body.email).toBe('staff.user@bakery.org');

        const updateData = updateUserSchema.parse({
            body: {
                name: 'Staff Member Updated',
                email: '  UPDATED.STAFF@BAKERY.ORG  '
            }
        });

        expect(updateData.body.email).toBe('updated.staff@bakery.org');
    });

    test('3. superadmin, tenant, and client validators should normalize email to lowercase', () => {
        const adminData = superadminLoginSchema.parse({
            body: {
                email: '  Admin.Owner@BakeWealth.COM  ',
                password: 'pass'
            }
        });
        expect(adminData.body.email).toBe('admin.owner@bakewealth.com');

        const tenantData = updateTenantSchema.parse({
            body: {
                contactEmail: '  CONTACT@SweetBakery.COM  '
            }
        });
        expect(tenantData.body.contactEmail).toBe('contact@sweetbakery.com');

        const clientData = createClientSchema.parse({
            body: {
                name: 'VIP Client',
                email: '  VIP.Client@Domain.NG  '
            }
        });
        expect(clientData.body.email).toBe('vip.client@domain.ng');

        const clientUpdateData = updateClientSchema.parse({
            body: {
                email: '  Updated.VIP@Domain.NG  '
            }
        });
        expect(clientUpdateData.body.email).toBe('updated.vip@domain.ng');
    });

    test('4. DB case-insensitive findFirst should match user regardless of email case', async () => {
        const uniqueEmail = `test_case_${Date.now()}@example.com`;
        const upperEmail = uniqueEmail.toUpperCase();

        const tenant = await prisma.tenant.create({
            data: {
                name: 'Case Test Bakery',
                type: 'individual'
            }
        });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('password123', salt);

        const createdUser = await prisma.user.create({
            data: {
                tenantId: tenant.id,
                name: 'Case Baker',
                email: uniqueEmail.toLowerCase(),
                passwordHash: hashedPassword,
                role: 'owner'
            }
        });

        // Query with all uppercase email using mode: 'insensitive'
        const foundUser = await prisma.user.findFirst({
            where: {
                email: {
                    equals: upperEmail,
                    mode: 'insensitive'
                }
            }
        });

        expect(foundUser).not.toBeNull();
        expect(foundUser.id).toBe(createdUser.id);
        expect(foundUser.email).toBe(uniqueEmail.toLowerCase());

        // Cleanup
        await prisma.tenant.delete({ where: { id: tenant.id } });
    });
});
