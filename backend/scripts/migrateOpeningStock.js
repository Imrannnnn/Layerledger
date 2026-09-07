require('dotenv').config();
const prisma = require('../prisma');

async function migrate() {
    console.log('Connecting to database...');
    try {
        await prisma.$connect();
        console.log('Connected! Executing OpeningStock table migration DDL...');

        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "OpeningStock" (
                "id" TEXT NOT NULL,
                "tenantId" TEXT NOT NULL,
                "itemId" TEXT,
                "name" TEXT NOT NULL,
                "unit" TEXT NOT NULL DEFAULT 'kg',
                "cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
                "openingQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
                "totalValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
                "month" TEXT,
                "locked" BOOLEAN NOT NULL DEFAULT false,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

                CONSTRAINT "OpeningStock_pkey" PRIMARY KEY ("id")
            );
        `);
        console.log('Created OpeningStock table');

        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "OpeningStock_tenantId_idx" ON "OpeningStock"("tenantId");`);
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "OpeningStock_itemId_idx" ON "OpeningStock"("itemId");`);
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "OpeningStock_month_idx" ON "OpeningStock"("month");`);
        console.log('Created OpeningStock indexes');

        await prisma.$executeRawUnsafe(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'OpeningStock_tenantId_fkey'
                ) THEN
                    ALTER TABLE "OpeningStock" ADD CONSTRAINT "OpeningStock_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
                END IF;

                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'OpeningStock_itemId_fkey'
                ) THEN
                    ALTER TABLE "OpeningStock" ADD CONSTRAINT "OpeningStock_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
                END IF;
            END $$;
        `);
        console.log('Created foreign key constraints');

        console.log('OpeningStock table migration completed successfully!');
    } catch (err) {
        console.error('Migration error:', err);
    } finally {
        await prisma.$disconnect();
    }
}

migrate();
