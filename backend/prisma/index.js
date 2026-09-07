const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

let prisma;

function createPrismaClient() {
  const url = process.env.DATABASE_URL || '';

  if (!url) {
    throw new Error('DATABASE_URL is not defined');
  }

  const isSslNeeded = url.includes('sslmode=') || url.includes('supabase') || url.includes('neon.tech') || url.includes('ssl=true');

  const poolConfig = {
    connectionString: url,
    max: 10,
    idleTimeoutMillis: 15000,
    connectionTimeoutMillis: 20000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000
  };

  if (isSslNeeded) {
    poolConfig.ssl = { rejectUnauthorized: false };
  }

  const pool = new Pool(poolConfig);

  pool.on('error', (err) => {
    // Gracefully handle idle connection terminations from Neon/pgBouncer
    console.warn('PostgreSQL idle client disconnected:', err.message);
  });

  const adapter = new PrismaPg(pool);
  const baseClient = new PrismaClient({
    adapter,
    transactionOptions: {
      maxWait: 10000,
      timeout: 20000
    }
  });

  // Auto-retry transient connection drops (e.g. Neon compute wake-up, network drops, pgBouncer disconnects)
  const client = baseClient.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          let attempts = 0;
          const maxAttempts = 2;
          while (attempts < maxAttempts) {
            try {
              return await query(args);
            } catch (err) {
              attempts++;
              const msg = err?.message || '';
              const isTransient =
                msg.includes('Connection terminated unexpectedly') ||
                msg.includes('Connection closed') ||
                msg.includes('ECONNRESET') ||
                msg.includes('socket has been ended') ||
                msg.includes('terminating connection') ||
                msg.includes('57P01');

              if (isTransient && attempts < maxAttempts) {
                console.warn(`[Prisma Retry] Retrying ${model}.${operation} after connection drop: ${msg}`);
                await new Promise((r) => setTimeout(r, 200));
                continue;
              }
              throw err;
            }
          }
        }
      }
    }
  });

  client.$pool = pool;

  // Warm up connection immediately on startup
  pool.query('SELECT 1').catch(() => {});

  // Keep connection warm in background every 14s to prevent Neon serverless sleep during active sessions
  const pingInterval = setInterval(() => {
    pool.query('SELECT 1').catch(() => {});
  }, 14000);
  if (pingInterval.unref) pingInterval.unref();

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