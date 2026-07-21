require('dotenv').config();
const prisma = require('../prisma');

async function fixYam() {
    try {
        console.log('=== FIXING YAM PURCHASES AND AVERAGE COST ===');
        const yamItem = await prisma.inventoryItem.findFirst({
            where: { name: { contains: 'yam', mode: 'insensitive' } }
        });

        if (!yamItem) {
            console.log('Yam ingredient not found in database.');
            return;
        }
        console.log(`Found Yam item in database: ID = ${yamItem.id}, Current Cost = ₦${yamItem.cost}, Stock = ${yamItem.stock}`);

        // Update the ₦2500 purchase (_kng87as)
        console.log('Linking purchase _kng87as (₦2,500)...');
        await prisma.purchase.update({
            where: { id: '_kng87as' },
            data: {
                itemId: yamItem.id,
                unitSize: 1,
                qty: 1,
                price: 2500,
                total: 2500,
                cpu: 2500,
                stockAdded: 1
            }
        });

        // Update the ₦2000 purchase (_kkn2gg6)
        console.log('Linking purchase _kkn2gg6 (₦2,000)...');
        await prisma.purchase.update({
            where: { id: '_kkn2gg6' },
            data: {
                itemId: yamItem.id,
                unitSize: 1,
                qty: 1,
                price: 2000,
                total: 2000,
                cpu: 2000,
                stockAdded: 1
            }
        });

        // Now, recalculate the average cost for Yam
        // Starting stock was 0, starting value was ₦0.
        // Purchase 1 added 1 kg @ ₦2,500 -> stock = 1, value = 2500, cost = 2500
        // Purchase 2 added 1 kg @ ₦2,000 -> stock = 2, value = 4500, cost = 2250
        console.log('Recalculating average cost for Yam...');
        const updatedYam = await prisma.inventoryItem.update({
            where: { id: yamItem.id },
            data: {
                stock: 2,
                totalValueOnHand: 4500,
                cost: 2250 // Average: 4500 / 2 = 2250
            }
        });

        // Create inventory history entries for these two purchases
        console.log('Creating audit history entries...');
        await prisma.inventoryHistory.createMany({
            data: [
                {
                    id: 'hist_p1',
                    tenantId: yamItem.tenantId,
                    inventoryItemId: yamItem.id,
                    type: 'PURCHASE',
                    date: new Date('2026-07-18'),
                    qtyDelta: 1,
                    valueDelta: 2500,
                    pricePerUnit: 2500,
                    qtyAfter: 1,
                    valueAfter: 2500,
                    avgCostAfter: 2500,
                    reason: 'Linked historical purchase',
                    referenceId: '_kng87as'
                },
                {
                    id: 'hist_p2',
                    tenantId: yamItem.tenantId,
                    inventoryItemId: yamItem.id,
                    type: 'PURCHASE',
                    date: new Date('2026-07-18'),
                    qtyDelta: 1,
                    valueDelta: 2000,
                    pricePerUnit: 2000,
                    qtyAfter: 2,
                    valueAfter: 4500,
                    avgCostAfter: 2250,
                    reason: 'Linked historical purchase',
                    referenceId: '_kkn2gg6'
                }
            ]
        });

        console.log('Yam details updated in database:');
        console.log(`- Stock: ${updatedYam.stock} kg`);
        console.log(`- Total Value: ₦${updatedYam.totalValueOnHand}`);
        console.log(`- Recalculated Average Cost: ₦${updatedYam.cost}/kg`);
        console.log('✅ Done! Refresh the app page or wait for sync to see the update.');
    } catch (err) {
        console.error('Error fixing:', err);
    } finally {
        await prisma.$disconnect();
    }
}

fixYam();
