/**
 * LayerLedger Chart of Accounts Service
 * Handles seeding, querying, and managing accounts for each tenant.
 * Guarantees tenant isolation and idempotency.
 */

const prisma = require('../../../prisma');
const {
    STANDARD_CHART_OF_ACCOUNTS,
    ACCOUNT_CLASSIFICATIONS
} = require('../accounting.constants');

class ChartOfAccountsService {
    /**
     * Idempotently seeds the standard 58 chart of accounts for a tenant.
     * Preserves existing accounts and custom additions.
     */
    async seedTenantChartOfAccounts(tenantId, externalTx = null) {
        if (!tenantId) {
            throw new Error('tenantId is required to seed Chart of Accounts');
        }

        const runWithClient = async (tx) => {
            // Fetch existing accounts for this tenant
            const existingAccounts = await tx.account.findMany({
                where: { tenantId },
                select: { id: true, accountCode: true }
            });

            const existingCodeSet = new Set(existingAccounts.map(a => a.accountCode));
            const toCreate = [];

            for (const std of STANDARD_CHART_OF_ACCOUNTS) {
                if (!existingCodeSet.has(std.accountCode)) {
                    toCreate.push({
                        tenantId,
                        accountCode: std.accountCode,
                        accountName: std.accountName,
                        classification: std.classification,
                        accountType: std.accountType,
                        description: std.description,
                        isSystemAccount: true,
                        isActive: true
                    });
                }
            }

            if (toCreate.length > 0) {
                await tx.account.createMany({
                    data: toCreate,
                    skipDuplicates: true
                });
            }

            // Retrieve updated mapping for bank accounts
            const allAccounts = await tx.account.findMany({
                where: { tenantId },
                select: { id: true, accountCode: true }
            });
            const accountMap = new Map(allAccounts.map(a => [a.accountCode, a.id]));

            // Ensure default BankAccount for Cash on Hand (1100) and Bank (1110)
            const cashAccId = accountMap.get('1100');
            if (cashAccId) {
                const existingCashBank = await tx.bankAccount.findFirst({
                    where: { tenantId, accountId: cashAccId }
                });
                if (!existingCashBank) {
                    await tx.bankAccount.create({
                        data: {
                            tenantId,
                            accountId: cashAccId,
                            accountName: 'Cash on Hand (Drawer)',
                            bankName: 'Cash Drawer',
                            currency: 'NGN',
                            isDefault: false,
                            isActive: true
                        }
                    });
                }
            }

            const bankAccId = accountMap.get('1110');
            if (bankAccId) {
                const existingBank = await tx.bankAccount.findFirst({
                    where: { tenantId, accountId: bankAccId }
                });
                if (!existingBank) {
                    await tx.bankAccount.create({
                        data: {
                            tenantId,
                            accountId: bankAccId,
                            accountName: 'Primary Bank Account',
                            bankName: 'Business Bank',
                            currency: 'NGN',
                            isDefault: true,
                            isActive: true
                        }
                    });
                }
            }

            return {
                totalStandard: STANDARD_CHART_OF_ACCOUNTS.length,
                totalExisting: existingAccounts.length,
                totalCreated: toCreate.length
            };
        };

        if (externalTx) {
            return await runWithClient(externalTx);
        }

        return await prisma.$transaction(async (tx) => {
            return await runWithClient(tx);
        }, { maxWait: 10000, timeout: 30000 });
    }

    /**
     * Retrieve all accounts for a tenant, grouped or filtered.
     */
    async getAccounts(tenantId, options = {}) {
        const { classification, isActive } = options;
        const where = { tenantId };

        if (classification) {
            where.classification = classification;
        }
        if (typeof isActive === 'boolean') {
            where.isActive = isActive;
        }

        return await prisma.account.findMany({
            where,
            orderBy: { accountCode: 'asc' }
        });
    }

    /**
     * Retrieve a single account by tenant and code.
     * Auto-seeds if accounts are empty for tenant.
     */
    async getAccountByCode(tenantId, accountCode, externalTx = null) {
        const client = externalTx || prisma;
        let account = await client.account.findUnique({
            where: {
                tenantId_accountCode: {
                    tenantId,
                    accountCode: String(accountCode)
                }
            }
        });

        if (!account) {
            // Lazy seed standard accounts if missing
            await this.seedTenantChartOfAccounts(tenantId, externalTx);
            account = await client.account.findUnique({
                where: {
                    tenantId_accountCode: {
                        tenantId,
                        accountCode: String(accountCode)
                    }
                }
            });
        }

        return account;
    }

    /**
     * Retrieve a single account by tenant and ID.
     */
    async getAccountById(tenantId, accountId, externalTx = null) {
        const client = externalTx || prisma;
        return await client.account.findFirst({
            where: {
                id: accountId,
                tenantId
            }
        });
    }

    /**
     * Add a custom account under an existing classification.
     * Bakers cannot invent new classifications (per Ruling 26).
     */
    async createCustomAccount(tenantId, data) {
        const { accountCode, accountName, classification, accountType, description } = data;

        if (!tenantId) throw new Error('tenantId is required');
        if (!accountCode || !accountName || !classification) {
            throw new Error('accountCode, accountName, and classification are required');
        }

        if (!Object.values(ACCOUNT_CLASSIFICATIONS).includes(classification)) {
            throw new Error(
                `Invalid classification: "${classification}". Must be one of: ${Object.values(ACCOUNT_CLASSIFICATIONS).join(', ')}`
            );
        }

        // Check uniqueness for this tenant
        const existing = await prisma.account.findUnique({
            where: {
                tenantId_accountCode: {
                    tenantId,
                    accountCode: String(accountCode)
                }
            }
        });

        if (existing) {
            throw new Error(`Account with code ${accountCode} already exists for this business.`);
        }

        return await prisma.account.create({
            data: {
                tenantId,
                accountCode: String(accountCode),
                accountName: accountName.trim(),
                classification,
                accountType: accountType || classification,
                description: description || null,
                isSystemAccount: false,
                isActive: true
            }
        });
    }
}

module.exports = new ChartOfAccountsService();
