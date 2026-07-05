/**
 * superadminController.js
 * ----------------------------------------------------------------------------
 * Handles super-admin dashboard operations: stats, tenant moderation, and tokens.
 * ----------------------------------------------------------------------------
 */
const jwt = require("jsonwebtoken")
const prisma = require("../prisma")
const { asyncHandler } = require('../middleware/custommiddleware')

/**
 * @desc    Super admin login
 * @route   POST /api/superadmin/login
 * @access  Public
 */
const superadminLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body
  const superEmail = process.env.SUPERADMIN_EMAIL
  const superPass = process.env.SUPERADMIN_PASSWORD

  if (!superEmail || !superPass) {
    res.status(500);
    throw new Error("Super Admin credentials not configured");
  }

  if (email === superEmail && password === superPass) {
    const token = jwt.sign(
      { role: "superadmin" },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    )
    res.json({ token, email })
  } else {
    res.status(401);
    throw new Error("Invalid Admin Credentials");
  }
})

/**
 * @desc    Get Super Admin Dashboard stats & tenant list
 * @route   GET /api/superadmin/dashboard
 * @access  Private (Super Admin Only)
 */
const getDashboardStats = asyncHandler(async (req, res) => {
  // 1. Total Tenants
  const totalTenants = await prisma.tenant.count()

  const now = new Date()
  const firstOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  // Tenants registered this month
  const tenantsThisMonth = await prisma.tenant.count({
    where: { createdAt: { gte: firstOfCurrentMonth } }
  })

  // Active tenants in the last 30 days (updated within 30 days)
  const activeTenants30Days = await prisma.tenant.count({
    where: { updatedAt: { gte: thirtyDaysAgo } }
  })

  // 2. Fetch all tenants with users to calculate breakdowns
  const tenants = await prisma.tenant.findMany({
    include: {
      users: { select: { email: true } },
      _count: {
        select: {
          recipes: true,
          orders: true,
          inventory: true,
          expenses: true
        }
      }
    },
    orderBy: { createdAt: "desc" }
  })

  // Subscription breakdowns
  let freeCount = 0
  let proCount = 0
  let tokenBalanceCount = 0

  tenants.forEach(t => {
    const plan = t.settings?.plan || "free"
    if (plan === "pro") {
      proCount++
    } else if (t.tokenBalance > 0) {
      tokenBalanceCount++
    } else {
      freeCount++
    }
  })

  // Monthly Token sales & Revenue
  // Find positive token transactions created this month (type "purchase")
  const tokenTransactionsThisMonth = await prisma.tokenTransaction.findMany({
    where: {
      createdAt: { gte: firstOfCurrentMonth },
      amount: { gt: 0 }
    }
  })

  const tokensSoldThisMonth = tokenTransactionsThisMonth.reduce((sum, tx) => sum + tx.amount, 0)
  // Assuming a standard token rate (e.g. ₦100 per token)
  const tokenRevenueThisMonth = tokensSoldThisMonth * 100

  // Subscription revenue estimate (e.g. Pro is ₦15,000/mo)
  const subscriptionRevenueThisMonth = proCount * 15000
  const totalRevenueThisMonth = tokenRevenueThisMonth + subscriptionRevenueThisMonth

  // Usage statistics (Totals across the whole system)
  const totalRecipes = tenants.reduce((s, t) => s + t._count.recipes, 0)
  const totalOrders = tenants.reduce((s, t) => s + t._count.orders, 0)
  const totalInventory = tenants.reduce((s, t) => s + t._count.inventory, 0)
  const totalExpenses = tenants.reduce((s, t) => s + t._count.expenses, 0)

  // Format tenant records
  const formattedTenants = tenants.map(t => {
    const plan = t.settings?.plan || "Free"
    const status = t.settings?.status || "Active"
    return {
      id: t.id,
      name: t.name,
      ownerEmail: t.users[0]?.email || "No Owner",
      registrationDate: t.createdAt,
      currentPlan: plan,
      tokenBalance: t.tokenBalance,
      lastActiveDate: t.updatedAt,
      status: status
    }
  })

  res.json({
    stats: {
      totalTenants,
      tenantsThisMonth,
      activeTenants30Days,
      subscriptionBreakdown: {
        free: freeCount,
        pro: proCount,
        token: tokenBalanceCount
      },
      monthlyRevenue: {
        subscriptions: subscriptionRevenueThisMonth,
        tokenSales: tokenRevenueThisMonth,
        total: totalRevenueThisMonth
      },
      tokenSales: {
        units: tokensSoldThisMonth,
        revenue: tokenRevenueThisMonth
      },
      usage: {
        recipes: totalRecipes,
        orders: totalOrders,
        inventory: totalInventory,
        expenses: totalExpenses
      }
    },
    tenants: formattedTenants
  })
})

/**
 * @desc    Change tenant status (activate or suspend)
 * @route   PUT /api/superadmin/tenants/:id/status
 * @access  Private (Super Admin Only)
 */
const updateTenantStatus = asyncHandler(async (req, res) => {
  const { id } = req.params
  const { status } = req.body // "Active" or "Suspended"

  const tenant = await prisma.tenant.findUnique({ where: { id } })
  if (!tenant) {
    res.status(404);
    throw new Error("Tenant not found");
  }

  const currentSettings = tenant.settings || {}
  const updatedSettings = { ...currentSettings, status }

  const updated = await prisma.tenant.update({
    where: { id },
    data: { settings: updatedSettings }
  })

  res.json({ message: `Tenant status updated to ${status}`, tenant: updated })
})

/**
 * @desc    Manually add/adjust tokens for a tenant
 * @route   POST /api/superadmin/tenants/:id/tokens
 * @access  Private (Super Admin Only)
 */
const adjustTenantTokens = asyncHandler(async (req, res) => {
  const { id } = req.params
  const { amount, description } = req.body // amount can be positive or negative

  const parsedAmount = parseFloat(amount)

  const tenant = await prisma.tenant.findUnique({ where: { id } })
  if (!tenant) {
    res.status(404);
    throw new Error("Tenant not found");
  }

  // Update balance and log transaction
  await prisma.$transaction([
    prisma.tenant.update({
      where: { id },
      data: { tokenBalance: { increment: parsedAmount } }
    }),
    prisma.tokenTransaction.create({
      data: {
        tenantId: id,
        amount: parsedAmount,
        type: parsedAmount >= 0 ? "topup" : "deduction",
        description: description || "Super Admin Adjustment"
      }
    })
  ])

  res.json({ message: "Tokens adjusted successfully", newBalance: tenant.tokenBalance + parsedAmount })
})

/**
 * @desc    Permanently delete a tenant account
 * @route   DELETE /api/superadmin/tenants/:id
 * @access  Private (Super Admin Only)
 */
const deleteTenantAccount = asyncHandler(async (req, res) => {
  const { id } = req.params

  const tenant = await prisma.tenant.findUnique({ where: { id } })
  if (!tenant) {
    res.status(404);
    throw new Error("Tenant not found");
  }

  // Cascade delete is handled by database foreign key constraints
  await prisma.tenant.delete({ where: { id } })

  res.json({ message: "Tenant account permanently deleted" })
})

module.exports = {
  superadminLogin,
  getDashboardStats,
  updateTenantStatus,
  adjustTenantTokens,
  deleteTenantAccount
}
