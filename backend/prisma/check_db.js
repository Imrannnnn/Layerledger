// Load environment variables from backend root .env
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const prisma = require('./index');

async function main() {
  const expenses = await prisma.expense.findMany({
    orderBy: { createdAt: 'desc' }
  });
  console.log("All Expenses in DB:", JSON.stringify(expenses, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
