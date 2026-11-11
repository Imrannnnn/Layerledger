const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

let prisma;

function createPrismaClient() {
  const url = process.env.DATABASE_URL || '';

  if (!url) {
    throw new Error('DATABASE_URL is not defined');
  }

  const isTest = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;
  const isSslNeeded = url.includes('sslmode=') || url.includes('supabase') || url.includes('neon.tech') || url.includes('ssl=true');

  const poolConfig = {
    connectionString: url,
    max: isTest ? 3 : (process.env.PG_POOL_MAX ? parseInt(process.env.PG_POOL_MAX, 10) : 10),
    idleTimeoutMillis: isTest ? 1000 : 15000,
    connectionTimeoutMillis: 20000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000
  };

  if (isSslNeeded) {
    poolConfig.ssl = { rejectUnauthorized: false };
  }

  const pool = new Pool(poolConfig);

  const origPoolEnd = pool.end.bind(pool);
  let poolEnded = false;
  pool.end = async function safePoolEnd(...args) {
    if (poolEnded || pool.ending || pool.ended) return;
    poolEnded = true;
    try {
      return await origPoolEnd(...args);
    } catch (err) {
      if (err?.message?.includes('Called end on pool more than once')) {
        return;
      }
      throw err;
    }
  };

  pool.on('error', (err) => {
    // Gracefully handle idle connection terminations from Neon/pgBouncer
    console.warn('PostgreSQL idle client disconnected:', err.message);
  });

  function isTransientDbError(err) {
    if (!err) return false;
    const msg = err.message || '';
    const code = err.code || '';
    return (
      code === 'P1001' ||
      code === 'P1002' ||
      code === 'P1008' ||
      code === 'P1017' ||
      code === 'P2034' ||
      msg.includes('EMAXCONNSESSION') ||
      msg.includes('max clients reached') ||
      msg.includes("Can't reach database server") ||
      msg.includes('Connection terminated') ||
      msg.includes('Connection closed') ||
      msg.includes('ECONNRESET') ||
      msg.includes('ETIMEDOUT') ||
      msg.includes('ENOTFOUND') ||
      msg.includes('ECONNREFUSED') ||
      msg.includes('socket has been ended') ||
      msg.includes('terminating connection') ||
      msg.includes('57P01') ||
      msg.includes('Client has encountered a connection error') ||
      msg.includes('Transaction already closed')
    );
  }

  function getBackoffMs(err, attempt) {
    const msg = err?.message || '';
    const code = err?.code || '';
    const isHighSeverity =
      code === 'P1001' ||
      msg.includes('EMAXCONNSESSION') ||
      msg.includes('max clients reached') ||
      msg.includes("Can't reach database server");
    return isHighSeverity ? 1000 * attempt : 300 * attempt;
  }

  const adapter = new PrismaPg(pool);
  const baseClient = new PrismaClient({
    adapter,
    transactionOptions: {
      maxWait: 15000,
      timeout: 30000
    }
  });

  // Auto-retry transient connection drops (e.g. compute wake-up, network drops, pgBouncer disconnects, session pool limit spikes)
  const client = baseClient.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          let attempts = 0;
          const maxAttempts = 4;
          while (attempts < maxAttempts) {
            try {
              return await query(args);
            } catch (err) {
              attempts++;
              const isTransient = isTransientDbError(err);

              if (isTransient && attempts < maxAttempts) {
                const backoffMs = getBackoffMs(err, attempts);
                console.warn(`[Prisma Retry] Retrying ${model}.${operation} (attempt ${attempts}/${maxAttempts}) after: ${(err?.message || '').slice(0, 100)} (waiting ${backoffMs}ms)`);
                await new Promise((r) => setTimeout(r, backoffMs));
                continue;
              }
              throw err;
            }
          }
        }
      }
    }
  });

  // Resilient interactive transactions with auto-retry on transient disconnects/pool spikes
  const origTransaction = client.$transaction ? client.$transaction.bind(client) : baseClient.$transaction.bind(baseClient);
  client.$transaction = async (arg, options) => {
    if (typeof arg === 'function') {
      let attempts = 0;
      const maxTxAttempts = 3;
      while (attempts < maxTxAttempts) {
        try {
          return await origTransaction(arg, options);
        } catch (err) {
          attempts++;
          const isTransient = isTransientDbError(err);
          if (isTransient && attempts < maxTxAttempts) {
            const backoffMs = getBackoffMs(err, attempts);
            console.warn(`[Prisma Retry] Retrying $transaction (attempt ${attempts}/${maxTxAttempts}) after: ${(err?.message || '').slice(0, 100)} (waiting ${backoffMs}ms)`);
            await new Promise((r) => setTimeout(r, backoffMs));
            continue;
          }
          throw err;
        }
      }
    }
    return origTransaction(arg, options);
  };

  client.$pool = pool;

  const origDisconnect = client.$disconnect ? client.$disconnect.bind(client) : async () => {};
  client.$disconnect = async () => {
    try {
      await origDisconnect();
    } catch (_) {
      // Ignore disconnect errors during shutdown
    }
    try {
      await pool.end();
    } catch (_) {
      // Ignore pool termination errors during shutdown
    }
  };

  if (!isTest) {
    // Warm up connection immediately on startup
    pool.query('SELECT 1').catch(() => {});

    // Keep connection warm in background every 14s to prevent serverless sleep during active sessions
    const pingInterval = setInterval(() => {
      pool.query('SELECT 1').catch(() => {});
    }, 14000);
    if (pingInterval.unref) pingInterval.unref();
  }

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