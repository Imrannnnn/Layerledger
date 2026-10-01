require('dotenv').config();
const prisma = require('./prisma');
async function main() {
  const email = 'goldencrumb_' + Date.now() + '@example.com';
  const res = await fetch('http://localhost:4000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      companyName: 'Golden Crumb Confectionery',
      name: 'Amara Crumb',
      email,
      password: 'Password123!'
    })
  });
  const data = await res.json();
  const user = await prisma.user.findFirst({ where: { email } });
  console.log('ACCOUNT_C_EMAIL=' + email);
  console.log('ACCOUNT_C_TOKEN=' + user.activationToken);
  await prisma.$disconnect();
}
main();
