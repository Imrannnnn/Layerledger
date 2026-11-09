/**
 * superadminController.js
 * ----------------------------------------------------------------------------
 * Handles super-admin dashboard operations: stats, tenant moderation, and tokens.
 * ----------------------------------------------------------------------------
 */
const jwt = require("jsonwebtoken")
const prisma = require("../prisma")
const { asyncHandler } = require('../middleware/custommiddleware')
const { getEffectivePlan } = require('./planController')
const emailService = require('../services/emailService')

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

  const inputEmail = (email || '').trim().toLowerCase();
  const targetEmail = (superEmail || '').trim().toLowerCase();

  if (inputEmail === targetEmail && password === superPass) {
    const token = jwt.sign(
      { role: "superadmin" },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    )
    res.json({ token, email: inputEmail })
  } else {
    res.status(401);
    throw new Error("Invalid Admin Credentials");
  }
})

/**
 * @desc    Get Super Admin Dashboard stats, subscription analytics & tenant list
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

  // 2. Fetch all tenants with users
  const tenants = await prisma.tenant.findMany({
    include: {
      users: { select: { email: true, name: true, role: true } },
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

  // 3. Fetch all successful payments across the entire platform
  const successfulPayments = await prisma.payment.findMany({
    where: { status: "SUCCESS" },
    orderBy: { createdAt: "desc" }
  })

  // Create an in-memory index of tenants for fast relation lookup
  const tenantMap = new Map(tenants.map(t => [t.id, t]))

  // Subscription breakdowns and expiry counts
  let freeCount = 0
  let standardCount = 0
  let premiumCount = 0
  let tokenBalanceCount = 0
  let activeSubscriptionsCount = 0
  let expiringSoonCount = 0
  let expiredSubscriptionsCount = 0
  let activeTrialsCount = 0

  tenants.forEach(t => {
    const effective = getEffectivePlan(t)
    const rawPlan = (t.settings?.plan || "free").toLowerCase()
    const hasTrial = Boolean(
      t.settings?.grantedTrial &&
      !effective.isExpired &&
      (effective.plan === "premium" || rawPlan === "premium" || rawPlan === "studio")
    )

    if (hasTrial) {
      activeTrialsCount++
    }

    if (effective.plan === "standard") {
      standardCount++
      activeSubscriptionsCount++
      if (effective.daysRemaining !== null && effective.daysRemaining <= 7) {
        expiringSoonCount++
      }
    } else if (effective.plan === "premium" || effective.plan === "studio" || effective.plan === "pro") {
      premiumCount++
      activeSubscriptionsCount++
      if (effective.daysRemaining !== null && effective.daysRemaining <= 7) {
        expiringSoonCount++
      }
    } else if (t.tokenBalance > 0) {
      tokenBalanceCount++
    } else {
      freeCount++
    }

    // Check if previously paid plan is currently expired
    if ((rawPlan === "standard" || rawPlan === "premium" || rawPlan === "studio") && effective.isExpired) {
      expiredSubscriptionsCount++
    }
  })

  // Revenue analytics from actual payments
  const totalRevenueAllTime = successfulPayments.reduce((sum, p) => sum + (Number(p.amount) / 100), 0)
  const subscriptionPayments = successfulPayments.filter(p => p.resourceType === "subscription_plan")
  const tokenPayments = successfulPayments.filter(p => p.resourceType === "credit_pack")

  const subscriptionRevenueAllTime = subscriptionPayments.reduce((sum, p) => sum + (Number(p.amount) / 100), 0)
  const tokenRevenueAllTime = tokenPayments.reduce((sum, p) => sum + (Number(p.amount) / 100), 0)

  // Payments this month
  const paymentsThisMonth = successfulPayments.filter(p => new Date(p.createdAt) >= firstOfCurrentMonth)
  const subscriptionRevenueThisMonth = paymentsThisMonth
    .filter(p => p.resourceType === "subscription_plan")
    .reduce((sum, p) => sum + (Number(p.amount) / 100), 0)
  const tokenRevenueThisMonth = paymentsThisMonth
    .filter(p => p.resourceType === "credit_pack")
    .reduce((sum, p) => sum + (Number(p.amount) / 100), 0)

  // Token units sold this month
  const tokenTransactionsThisMonth = await prisma.tokenTransaction.findMany({
    where: {
      createdAt: { gte: firstOfCurrentMonth },
      amount: { gt: 0 }
    }
  })
  const tokensSoldThisMonth = tokenTransactionsThisMonth.reduce((sum, tx) => sum + tx.amount, 0)

  // Fallbacks if token transactions were manual or payments table had records
  const calculatedTokenRevenue = tokenRevenueThisMonth > 0 ? tokenRevenueThisMonth : (tokensSoldThisMonth * 130)
  const calculatedSubRevenue = subscriptionRevenueThisMonth > 0
    ? subscriptionRevenueThisMonth
    : ((standardCount * 5000) + (premiumCount * 10000))
  const totalRevenueThisMonth = calculatedTokenRevenue + calculatedSubRevenue

  // Distinct paying tenants
  const payingTenantIds = new Set(successfulPayments.map(p => p.tenantId).filter(Boolean))
  const totalPayingTenants = payingTenantIds.size

  // Format all payments with date paid and expiration dates
  const formattedPayments = successfulPayments.map(p => {
    const tenant = p.tenantId ? tenantMap.get(p.tenantId) : null
    const tSettings = tenant?.settings || {}
    const planExpiresAt = tSettings.planExpiresAt || null
    const months = p.metadata?.months || 1
    const majorAmount = Number(p.amount) / 100

    let isPlanExpired = null
    let daysRemaining = null

    if (planExpiresAt) {
      const expTime = new Date(planExpiresAt).getTime()
      isPlanExpired = expTime < now.getTime()
      daysRemaining = Math.max(0, Math.ceil((expTime - now.getTime()) / (1000 * 60 * 60 * 24)))
    }

    const planName = p.metadata?.plan || (p.resourceType === "subscription_plan" ? (p.resourceId || "standard") : null)

    return {
      id: p.id,
      reference: p.paymentReference,
      tenantId: p.tenantId,
      tenantName: tenant?.name || p.customerName || "Workspace",
      customerEmail: p.customerEmail || tenant?.users?.[0]?.email || "N/A",
      customerName: p.customerName || tenant?.users?.[0]?.name || "Customer",
      resourceType: p.resourceType,
      resourceId: p.resourceId,
      plan: planName,
      months,
      amount: majorAmount,
      currency: p.currency,
      provider: p.provider,
      status: p.status,
      paidAt: p.createdAt,
      planExpiresAt: planExpiresAt,
      isExpired: isPlanExpired,
      daysRemaining: daysRemaining
    }
  })

  // Format tenant records with comprehensive subscription & expiry analytics
  const formattedTenants = tenants.map(t => {
    const effective = getEffectivePlan(t)
    const rawPlan = t.settings?.plan || "Free"
    const status = t.settings?.status || "Active"
    const planExpiresAt = t.settings?.planExpiresAt || null
    const grantedTrial = t.settings?.grantedTrial || null

    // Determine tenant payment summary from successful payments
    const tenantPayments = successfulPayments.filter(p => p.tenantId === t.id)
    const latestPayment = tenantPayments[0] || null
    const latestPaymentAmount = latestPayment ? (Number(latestPayment.amount) / 100) : null
    const totalPaidAmount = tenantPayments.reduce((s, p) => s + (Number(p.amount) / 100), 0)
    const latestRenewal = tenantPayments.find(p => p.resourceType === "subscription_plan") || null

    return {
      id: t.id,
      name: t.name,
      ownerEmail: t.users[0]?.email || "No Owner",
      ownerName: t.users[0]?.name || t.name,
      registrationDate: t.createdAt,
      currentPlan: effective.plan,
      configuredPlan: rawPlan,
      isExpired: effective.isExpired,
      planExpiresAt: planExpiresAt,
      daysRemaining: effective.daysRemaining,
      tokenBalance: t.tokenBalance,
      lastActiveDate: t.updatedAt,
      status: status,
      grantedTrial: grantedTrial,
      hasActiveTrial: Boolean(grantedTrial && !effective.isExpired && (effective.plan === "premium" || rawPlan.toLowerCase() === "premium")),
      totalPaidAmount: totalPaidAmount,
      hasPaid: totalPaidAmount > 0 || tenantPayments.length > 0,
      latestPaymentDate: latestPayment ? latestPayment.createdAt : null,
      latestPaymentAmount: latestPaymentAmount,
      latestPaymentReference: latestPayment ? latestPayment.paymentReference : null,
      latestRenewalDate: latestRenewal ? latestRenewal.createdAt : null,
      latestRenewalAmount: latestRenewal ? (Number(latestRenewal.amount) / 100) : null
    }
  })

  // Usage statistics
  const totalRecipes = tenants.reduce((s, t) => s + t._count.recipes, 0)
  const totalOrders = tenants.reduce((s, t) => s + t._count.orders, 0)
  const totalInventory = tenants.reduce((s, t) => s + t._count.inventory, 0)
  const totalExpenses = tenants.reduce((s, t) => s + t._count.expenses, 0)

  res.json({
    stats: {
      totalTenants,
      tenantsThisMonth,
      activeTenants30Days,
      totalPayingTenants,
      subscriptionBreakdown: {
        free: freeCount,
        standard: standardCount,
        premium: premiumCount,
        pro: premiumCount,
        token: tokenBalanceCount,
        activeTrials: activeTrialsCount
      },
      subscriptionAnalytics: {
        totalPayingTenants,
        activeSubscriptions: activeSubscriptionsCount,
        expiringSoon: expiringSoonCount,
        expiredSubscriptions: expiredSubscriptionsCount,
        activeTrials: activeTrialsCount,
        revenue: {
          totalAllTime: totalRevenueAllTime,
          subscriptionsAllTime: subscriptionRevenueAllTime,
          tokenSalesAllTime: tokenRevenueAllTime,
          thisMonthTotal: totalRevenueThisMonth,
          thisMonthSubscriptions: calculatedSubRevenue,
          thisMonthTokenSales: calculatedTokenRevenue
        }
      },
      monthlyRevenue: {
        subscriptions: calculatedSubRevenue,
        tokenSales: calculatedTokenRevenue,
        total: totalRevenueThisMonth
      },
      tokenSales: {
        units: tokensSoldThisMonth,
        revenue: calculatedTokenRevenue
      },
      usage: {
        recipes: totalRecipes,
        orders: totalOrders,
        inventory: totalInventory,
        expenses: totalExpenses
      }
    },
    tenants: formattedTenants,
    payments: formattedPayments
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
 * @desc    Grant complimentary Premium plan access to a tenant account
 * @route   POST /api/superadmin/tenants/:id/grant-premium
 * @access  Private (Super Admin Only)
 */
const grantTenantPremium = asyncHandler(async (req, res) => {
  const { id } = req.params
  const { days, bonusCredits = 0, notifyEmail = true, note } = req.body

  const parsedDays = parseInt(days, 10)
  if (isNaN(parsedDays) || parsedDays < 1) {
    res.status(400)
    throw new Error("Duration must be at least 1 day")
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id },
    include: {
      users: {
        select: { id: true, email: true, name: true, role: true }
      }
    }
  })

  if (!tenant) {
    res.status(404)
    throw new Error("Tenant not found")
  }

  const now = new Date()
  const currentSettings = tenant.settings || {}
  const currentExpires = currentSettings.planExpiresAt ? new Date(currentSettings.planExpiresAt) : null

  // If already active in the future, extend from current expiry date, otherwise start from now
  const baseTime = (currentExpires && currentExpires.getTime() > now.getTime())
    ? currentExpires.getTime()
    : now.getTime()

  const newExpires = new Date(baseTime + parsedDays * 24 * 60 * 60 * 1000)

  const trialInfo = {
    plan: "premium",
    days: parsedDays,
    grantedAt: now.toISOString(),
    expiresAt: newExpires.toISOString(),
    grantedBy: "superadmin",
    note: note || "Complimentary Premium access granted by Super Admin"
  }

  const updatedSettings = {
    ...currentSettings,
    plan: "premium",
    planExpiresAt: newExpires.toISOString(),
    trialGranted: true,
    trialBannerDismissed: false,
    grantedTrial: trialInfo
  }

  const parsedCredits = parseInt(bonusCredits, 10) || 0

  await prisma.$transaction(async (tx) => {
    await tx.tenant.update({
      where: { id },
      data: {
        settings: updatedSettings,
        ...(parsedCredits > 0 ? { tokenBalance: { increment: parsedCredits } } : {})
      }
    })

    if (parsedCredits > 0) {
      await tx.tokenTransaction.create({
        data: {
          tenantId: id,
          amount: parsedCredits,
          type: "gift",
          description: `Super Admin: +${parsedCredits} bonus scan credits for ${parsedDays}-day Premium access`
        }
      })
    }
  })

  // Send email notification to owner or first user
  let emailSent = false
  let emailError = null

  if (notifyEmail !== false) {
    const recipientUser = tenant.users.find(u => u.role === "owner") || tenant.users[0]
    const recipientEmail = recipientUser?.email || tenant.contactEmail
    const recipientName = recipientUser?.name || tenant.name

    if (recipientEmail) {
      try {
        const mailResult = await emailService.sendPremiumAccessGrantedEmail({
          to: recipientEmail,
          name: recipientName,
          companyName: tenant.name,
          daysGranted: parsedDays,
          expiresAt: newExpires.toISOString(),
          bonusCredits: parsedCredits
        })
        emailSent = Boolean(mailResult?.success)
      } catch (err) {
        console.error("[SuperAdmin:GrantPremium] Email failed:", err.message)
        emailError = err.message
      }
    }
  }

  res.json({
    message: `Successfully granted ${parsedDays} day(s) Premium plan access to ${tenant.name}`,
    tenant: {
      id: tenant.id,
      name: tenant.name,
      currentPlan: "premium",
      planExpiresAt: newExpires.toISOString(),
      daysRemaining: parsedDays,
      tokenBalance: tenant.tokenBalance + parsedCredits,
      grantedTrial: trialInfo
    },
    emailSent,
    emailError
  })
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
  grantTenantPremium,
  deleteTenantAccount
}
