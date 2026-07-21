require('dotenv').config();
const prisma = require('../prisma');

async function debugYam() {
    try {
        console.log('=== DEBUGGING YAM INVENTORY ===');
        const items = await prisma.inventoryItem.findMany({
            where: {
                name: {
                    contains: 'yam',
                    mode: 'insensitive'
                }
            }
        });

        if (items.length === 0) {
            console.log('No inventory item with name "yam" found.');
            return;
        }

        for (const item of items) {
            console.log(`\nInventory Item: "${item.name}" (ID: ${item.id})`);
            console.log(`- Current Stock: ${item.stock} ${item.unit}`);
            console.log(`- Total Value: ₦${item.totalValueOnHand}`);
            console.log(`- Current Cost (Unit Price): ₦${item.cost}`);
            console.log(`- Tenant ID: ${item.tenantId}`);

            // Fetch purchases for this item
            const purchases = await prisma.purchase.findMany({
                where: { itemId: item.id },
                orderBy: { date: 'asc' }
            });
            console.log('\nRecorded Purchases:');
            if (purchases.length === 0) {
                console.log('  No purchases found.');
            } else {
                purchases.forEach(p => {
                    console.log(`  - Date: ${p.date.toISOString().split('T')[0]}, Qty: ${p.qty}, Price: ₦${p.price}, Total: ₦${p.total}, CPU: ₦${p.cpu}, Stock Added: ${p.stockAdded}`);
                });
            }

            // Fetch history for this item
            const history = await prisma.inventoryHistory.findMany({
                where: { inventoryItemId: item.id },
                orderBy: { date: 'asc' }
            });
            console.log('\nInventory History Logs:');
            if (history.length === 0) {
                console.log('  No history logs found.');
            } else {
                history.forEach(h => {
                    console.log(`  - Type: ${h.type}, Date: ${h.date.toISOString().split('T')[0]}, Qty Delta: ${h.qtyDelta}, Value Delta: ₦${h.valueDelta}, Avg Cost After: ₦${h.avgCostAfter}, Qty After: ${h.qtyAfter}, Value After: ₦${h.valueAfter}`);
                });
            }
        }
    } catch (err) {
        console.error('Error debugging:', err.message);
    } finally {
        await prisma.$disconnect();
    }
}

debugYam();
