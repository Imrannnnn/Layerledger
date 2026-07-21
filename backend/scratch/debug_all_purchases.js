require('dotenv').config();
const prisma = require('../prisma');

async function debugAllPurchases() {
    try {
        console.log('=== ALL PURCHASES IN DATABASE ===');
        const purchases = await prisma.purchase.findMany({
            orderBy: { date: 'desc' }
        });
        
        if (purchases.length === 0) {
            console.log('No purchases found in the database.');
            return;
        }

        purchases.forEach(p => {
            console.log(`ID: ${p.id}`);
            console.log(`- Date: ${p.date.toISOString().split('T')[0]}`);
            console.log(`- Supplier: ${p.supplier}`);
            console.log(`- Amount: ₦${p.amount}`);
            console.log(`- Item ID: ${p.itemId}`);
            console.log(`- Qty: ${p.qty}`);
            console.log(`- Price: ₦${p.price}`);
            console.log(`- Total: ₦${p.total}`);
            console.log(`- Stock Added: ${p.stockAdded}`);
            console.log(`- Tenant ID: ${p.tenantId}`);
            console.log('---');
        });
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await prisma.$disconnect();
    }
}

debugAllPurchases();
