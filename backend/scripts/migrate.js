const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

async function migrate() {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
        console.error('❌ DATABASE_URL is not set.');
        process.exit(1);
    }

    console.log('Connecting to database...');
    const pool = new Pool({ connectionString: dbUrl });

    const sql = `
        -- 1. Alter InventoryItem table
        ALTER TABLE "InventoryItem" ADD COLUMN IF NOT EXISTS "totalValueOnHand" DOUBLE PRECISION DEFAULT 0 NOT NULL;

        -- 2. Alter Order table
        ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "ingredientsDeducted" BOOLEAN DEFAULT false NOT NULL;

        -- 3. Alter Purchase table
        ALTER TABLE "Purchase" ADD COLUMN IF NOT EXISTS "itemId" TEXT;
        ALTER TABLE "Purchase" ADD COLUMN IF NOT EXISTS "unitSize" DOUBLE PRECISION;
        ALTER TABLE "Purchase" ADD COLUMN IF NOT EXISTS "qty" DOUBLE PRECISION;
        ALTER TABLE "Purchase" ADD COLUMN IF NOT EXISTS "price" DOUBLE PRECISION;
        ALTER TABLE "Purchase" ADD COLUMN IF NOT EXISTS "total" DOUBLE PRECISION;
        ALTER TABLE "Purchase" ADD COLUMN IF NOT EXISTS "cpu" DOUBLE PRECISION;
        ALTER TABLE "Purchase" ADD COLUMN IF NOT EXISTS "stockAdded" DOUBLE PRECISION;

        -- Add foreign key constraint to Purchase
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Purchase_itemId_fkey') THEN
                ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
            END IF;
        END $$;

        -- 4. Create InventoryHistory table
        CREATE TABLE IF NOT EXISTS "InventoryHistory" (
            "id" TEXT NOT NULL,
            "tenantId" TEXT NOT NULL,
            "inventoryItemId" TEXT NOT NULL,
            "type" TEXT NOT NULL,
            "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "qtyDelta" DOUBLE PRECISION NOT NULL,
            "valueDelta" DOUBLE PRECISION NOT NULL,
            "pricePerUnit" DOUBLE PRECISION NOT NULL,
            "qtyAfter" DOUBLE PRECISION NOT NULL,
            "valueAfter" DOUBLE PRECISION NOT NULL,
            "avgCostAfter" DOUBLE PRECISION NOT NULL,
            "reason" TEXT,
            "referenceId" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

            CONSTRAINT "InventoryHistory_pkey" PRIMARY KEY ("id"),
            CONSTRAINT "InventoryHistory_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE,
            CONSTRAINT "InventoryHistory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
        );

        -- Create indexes
        CREATE INDEX IF NOT EXISTS "InventoryHistory_tenantId_idx" ON "InventoryHistory"("tenantId");
        CREATE INDEX IF NOT EXISTS "InventoryHistory_inventoryItemId_idx" ON "InventoryHistory"("inventoryItemId");
    `;

    try {
        console.log('Running migration SQL...');
        await pool.query(sql);
        console.log('✅ Database migration completed successfully.');
    } catch (err) {
        console.error('❌ Migration failed:', err.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

migrate();
