process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const express = require("express")
const cors = require('./config/configCors')
const helmet = require("helmet")
const rateLimit = require("express-rate-limit")
require('dotenv').config()
const { logger, addTimeStamp } = require('./middleware/custommiddleware')
const prisma = require("./prisma")

const app = express()

// Global rate limiter
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Limit each IP to 1000 requests per 15 minutes
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

app.use(helmet())
app.use(cors())

// Apply rate limiting
app.use('/api/', apiLimiter)
app.use('/api/auth/', authLimiter)

//middleware 
app.use(express.json({ limit: '5mb' }));
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
app.use('/api/superadmin', require('./routes/superadminRoutes'));
app.use('/api/claude', require('./routes/claudeRoutes'));

// Global error handler
app.use((err, req, res, _next) => {
    const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
    console.error("Unhandled error:", err);
    res.status(statusCode).json({
        message: err.message || 'Internal Server Error'
    });
});

const PORT = process.env.PORT || 4000;

async function startServer() {
    try {
        await prisma.$connect();

        const dbUrl = process.env.DATABASE_URL || '';
        const dbType = dbUrl.startsWith('file:') || dbUrl.startsWith('sqlite:') ? 'SQLite' : 'PostgreSQL';
        console.log(`${dbType} Database Connected`);

        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    } catch (error) {
        console.error("Database Connection Failed");
        console.error(error.message);
    }
}

startServer();




