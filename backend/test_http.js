require('dotenv').config({ path: './.env' });
const jwt = require('jsonwebtoken');
const prisma = require('./prisma');

async function run() {
  try {
    const user = await prisma.user.findFirst();
    console.log('Testing with user:', user.email, 'tenantId:', user.tenantId);

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, tenantId: user.tenantId },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Test bootstrap
    const bootRes = await fetch('http://localhost:4000/api/tenant/bootstrap', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Bootstrap status:', bootRes.status);
    const bootData = await bootRes.json();
    console.log('Bootstrap response keys:', Object.keys(bootData));

    // Test clients (paginated)
    const clientRes = await fetch('http://localhost:4000/api/clients?page=1&limit=25', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Clients (paginated) status:', clientRes.status);
    const clientData = await clientRes.json();
    console.log('Clients response data:', {
      dataCount: clientData.data?.length,
      total: clientData.total,
      stats: clientData.stats
    });

    // Test clients (unpaginated)
    const clientUnpaginatedRes = await fetch('http://localhost:4000/api/clients', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Clients (unpaginated) status:', clientUnpaginatedRes.status);
  } catch (err) {
    console.error('HTTP Test Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}
run();
