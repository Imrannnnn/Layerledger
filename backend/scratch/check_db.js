const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const expenses = await prisma.expense.findMany({
    orderBy: { createdAt: 'desc' }
  });
  console.log("All Expenses in DB:", JSON.stringify(expenses, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
