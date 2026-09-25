const express = require("express")
const compression = require("compression")
const cors = require('./config/configCors')
const helmet = require("helmet")
const rateLimit = require("express-rate-limit")
require('dotenv').config()
const { logger, addTimeStamp } = require('./middleware/custommiddleware')
const prisma = require("./prisma")

const app = express()

// Response compression (reduces JSON payload size by 70-90%)
app.use(compression())

// Global rate limiter
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'production' ? 1000 : 10000, // Limit each IP to 1000 requests per 15 min in prod, 10000 in dev
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many requests from this IP, please try again after 15 minutes' }
});

// Stricter rate limiter for auth routes
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // Limit each IP to 20 auth requests per 15 minutes
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many login or registration attempts, please try again after 15 minutes' }
});

const path = require('path')
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }))
app.use(cors())

// Serve static assets (Bakewealth logo for email links and web requests)
app.use(express.static(path.join(__dirname, 'public')))
const clientPublicPath = path.join(__dirname, '../client/public')
if (require('fs').existsSync(clientPublicPath)) {
    app.use(express.static(clientPublicPath))
}

// Apply rate limiting
app.use('/api/', apiLimiter)
app.use('/api/auth/', authLimiter)

//middleware 
app.use(express.json({
    limit: '5mb',
    verify: (req, _res, buf) => {
        req.rawBody = buf;
    }
}));
app.use(logger)
app.use(addTimeStamp)

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/tenant', require('./routes/tenantRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/clients', require('./routes/clientRoutes'));
app.use('/api/inventory', require('./routes/inventoryRoutes'));
app.use('/api/recipes', require('./routes/recipeRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));
app.use('/api/transactions', require('./routes/transactionRoutes'));
app.use('/api/expenses', require('./routes/expenseRoutes'));
app.use('/api/invoices', require('./routes/invoiceRoutes'));
app.use('/api/packaging', require('./routes/packagingRoutes'));
app.use('/api/decorations', require('./routes/decorationRoutes'));
app.use('/api/purchases', require('./routes/purchaseRoutes'));
app.use('/api/tokens', require('./routes/tokenRoutes'));
app.use('/api/plans', require('./routes/planRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/superadmin', require('./routes/superadminRoutes'));
app.use('/api/claude', require('./routes/claudeRoutes'));
app.use('/api/opening-stock', require('./routes/openingStockRoutes'));
app.use('/api/migrate-legacy', require('./routes/migrationRoutes'));

// Health check endpoint displaying active database target
app.get('/api/health', (_req, res) => {
    const dbUrl = process.env.DATABASE_URL || '';
    let isLocal = false;
    let dbHost = 'unknown';
    let dbName = 'unknown';
    try {
        const parsed = new URL(dbUrl);
        isLocal = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
        dbHost = parsed.hostname;
        dbName = parsed.pathname ? parsed.pathname.replace('/', '') : '';
    } catch {
        isLocal = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1');
    }
    res.json({
        status: 'online',
        database: isLocal ? 'local' : 'neon_cloud',
        host: dbHost,
        databaseName: dbName,
        bandwidthUsage: isLocal ? '0 MB (Localhost)' : 'Active Cloud Egress'
    });
});

// Global error handler
app.use((err, req, res, _next) => {
    const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
    console.error("Unhandled error:", err);
    res.status(statusCode).json({
        message: err.message || 'Internal Server Error',
        code: err.code || undefined,
        limitType: err.limitType || undefined,
        currentCount: err.currentCount !== undefined ? err.currentCount : undefined,
        limit: err.limit !== undefined ? err.limit : undefined,
        plan: err.plan || undefined,
        upgradePlan: err.upgradePlan || undefined,
        upgradePrice: err.upgradePrice || undefined,
        notActivated: err.notActivated || undefined,
        email: err.email || undefined
    });
});

// Process crash prevention for transient network / database drops
process.on('unhandledRejection', (reason, _promise) => {
    console.warn('Unhandled Rejection caught (preventing crash):', reason?.message || reason);
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception caught (preventing crash):', err?.message || err);
});

const PORT = process.env.PORT || 4000;

async function startServer() {
    try {
        await prisma.$connect();

        const dbUrl = process.env.DATABASE_URL || '';
        let dbLabel = 'PostgreSQL';
        try {
            const parsed = new URL(dbUrl);
            const isLocal = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
            const dbName = parsed.pathname ? parsed.pathname.replace('/', '') : '';
            dbLabel = isLocal
                ? `🟢 LOCAL PostgreSQL Database (${parsed.hostname}:${parsed.port || 5432}/${dbName}) [ZERO Neon Bandwidth]`
                : `REMOTE SUPERBASE CLOUD Database (${parsed.hostname}/${dbName})`;
        } catch {
            dbLabel = dbUrl.includes('localhost') ? '🟢 LOCAL PostgreSQL' : 'REMOTE SUPERBASE CLOUD';
        }

        console.log(`================================================================`);
        console.log(`Database Connected: ${dbLabel}`);
        console.log(`================================================================`);

        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);

            // Initialize Brevo API check and Background Workers
            const paymentJobRunner = require('./jobs/paymentJobs');
            const subscriptionWatcher = require('./services/subscriptionWatcher');
            const emailService = require('./services/emailService');

            if (emailService.isConfigured()) {
                emailService.verifyApi().then(res => {
                    if (res.connected) {
                        console.log(`✉️  Brevo API: Connected & Ready for Bakewealth emails (${res.email || 'Verified'})`);
                    } else {
                        console.warn('⚠️  Brevo API Notice:', res.message);
                    }
                }).catch(e => console.warn('⚠️  Brevo API check error:', e.message));
            } else {
                console.log('✉️  Brevo API: In mock/dev mode (BREVO_API_KEY not set in .env)');
            }


            // Periodic payment background worker (receipt delivery, ledger sync)
            setInterval(async () => {
                try {
                    await paymentJobRunner.processPendingJobs();
                } catch (err) {
                    console.error('[Worker] Payment jobs worker error:', err.message);
                }
            }, 15000);

            // Periodic subscription expiry check (alerts owners 3 days prior)
            setInterval(async () => {
                try {
                    await subscriptionWatcher.checkExpiringSubscriptions(3);
                } catch (err) {
                    console.error('[Worker] Subscription watcher error:', err.message);
                }
            }, 6 * 60 * 60 * 1000);

            // Initial non-blocking check 30 seconds after boot
            setTimeout(() => {
                subscriptionWatcher.checkExpiringSubscriptions(3).catch(() => {});
            }, 30000);
        });
    } catch (error) {
        console.error("Database Connection Failed");
        console.error(error.message);
    }
}

startServer();
// LayerLedger Server initialized with Paystack Live Gateway support

