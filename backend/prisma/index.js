const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

let prisma;

if (process.env.NODE_ENV === 'test' || !process.env.NODE_TLS_REJECT_UNAUTHORIZED) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

function createPrismaClient() {
  const url = process.env.DATABASE_URL || '';
  const isSslNeeded = url.includes('sslmode=') || url.includes('supabase') || url.includes('ssl=true');
  const poolConfig = { connectionString: url };
  if (isSslNeeded) {
    poolConfig.ssl = { rejectUnauthorized: false };
  }
  const pool = new Pool(poolConfig);
  const adapter = new PrismaPg(pool);
  const client = new PrismaClient({ adapter });
  client.$pool = pool;
  return client;
}

if (process.env.NODE_ENV === 'production') {
  prisma = createPrismaClient();
} else {
  if (!global.prisma) {
    global.prisma = createPrismaClient();
  }
  prisma = global.prisma;
}

module.exports = prisma;
