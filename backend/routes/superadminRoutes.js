/**
 * superadminRoutes.js
 * ----------------------------------------------------------------------------
 * Registers routing for super-admin operations.
 * Protects administrative actions using a role-based JWT validator.
 * ----------------------------------------------------------------------------
 */
const express = require('express')
const router = express.Router()
const jwt = require('jsonwebtoken')
const {
  superadminLogin,
  getDashboardStats,
  updateTenantStatus,
  adjustTenantTokens,
  deleteTenantAccount
} = require('../controller/superadminController')
const { validate } = require('../middleware/validationMiddleware');
const { superadminLoginSchema, updateTenantStatusSchema, adjustTenantTokensSchema } = require('../validators/superadminValidator');

// Protect admin actions by verifying token role claim
const superadminAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" })
    }
    const token = authHeader.split(" ")[1]
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    
    if (decoded.role !== "superadmin") {
      return res.status(403).json({ message: "Access denied: Not a Super Admin" })
    }
    
    req.user = decoded
    next()
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired admin token" })
  }
}

router.post('/login', validate(superadminLoginSchema), superadminLogin)
router.get('/dashboard', superadminAuth, getDashboardStats)
router.put('/tenants/:id/status', superadminAuth, validate(updateTenantStatusSchema), updateTenantStatus)
router.post('/tenants/:id/tokens', superadminAuth, validate(adjustTenantTokensSchema), adjustTenantTokens)
router.delete('/tenants/:id', superadminAuth, deleteTenantAccount)

module.exports = router
