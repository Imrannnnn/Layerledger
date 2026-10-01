require('dotenv').config()
const prisma = require('./prisma')
const jwt = require('jsonwebtoken')
const API_URL = "http://localhost:4000"

async function run() {
  console.log("=== Multi-Tenant Account Isolation & Onboarding Test ===")

  // 1. Check Account A
  console.log("\n--- Checking Account A ---")
  const userA = await prisma.user.findFirst({
    where: { email: "fayvoureeluxecakes@gmail.com" },
    include: { tenant: true }
  })

  if (!userA) {
    console.error("Account A user not found!")
    return
  }

  console.log("Account A Tenant ID:", userA.tenantId)
  console.log("Account A Tenant Name:", userA.tenant.name)

  const tokenA = jwt.sign(
    { id: userA.id, tenantId: userA.tenantId, role: userA.role },
    process.env.JWT_SECRET || "layerledger_super_secret_jwt_key_2026",
    { expiresIn: "7d" }
  )

  const resA = await fetch(`${API_URL}/api/tenant/bootstrap`, {
    headers: { Authorization: `Bearer ${tokenA}` }
  })
  const bootstrapA = await resA.json()
  console.log("Account A bootstrap isOnboarded:", bootstrapA.isOnboarded)
  console.log("Account A tenant name:", bootstrapA.tenant.name)

  // 2. Create Account B
  console.log("\n--- Creating Account B ---")
  const testEmailB = `test_biz_${Date.now()}@example.com`
  const testBizB = "Rosemary Sweet Treats"

  const regRes = await fetch(`${API_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      companyName: testBizB,
      name: "Rosemary Baker",
      email: testEmailB,
      password: "Password123!"
    })
  })
  const regData = await regRes.json()
  console.log("Register Account B response status:", regRes.status, regData.message)

  // Find user B activation token
  const userB = await prisma.user.findFirst({
    where: { email: testEmailB },
    include: { tenant: true }
  })
  console.log("Account B created in DB. Tenant ID:", userB.tenantId, "Name:", userB.tenant.name)
  console.log("Account B activationToken:", userB.activationToken)

  // 3. Activate Account B
  console.log("\n--- Activating Account B ---")
  const actRes = await fetch(`${API_URL}/api/auth/activate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: userB.activationToken })
  })
  const actData = await actRes.json()
  console.log("Activation status:", actRes.status)
  console.log("Activation response isOnboarded:", actData.isOnboarded)
  console.log("Activation response tenant isOnboarded:", actData.tenant?.isOnboarded)

  if (actData.isOnboarded !== false) {
    throw new Error(`FAILURE: Expected isOnboarded to be false, got ${actData.isOnboarded}`)
  }

  const tokenB = actData.token

  // 4. Check Account B Bootstrap
  console.log("\n--- Checking Account B Bootstrap ---")
  const resB = await fetch(`${API_URL}/api/tenant/bootstrap`, {
    headers: { Authorization: `Bearer ${tokenB}` }
  })
  const bootstrapB = await resB.json()
  console.log("Account B bootstrap isOnboarded:", bootstrapB.isOnboarded)
  const coB = typeof bootstrapB.tenant.settings?.appConfig?.ll_co === "string"
    ? JSON.parse(bootstrapB.tenant.settings.appConfig.ll_co)
    : bootstrapB.tenant.settings?.appConfig?.ll_co

  console.log("Account B Company Profile:", coB)

  // Assertions for Account B
  if (bootstrapB.isOnboarded !== false) {
    throw new Error(`FAILURE: Bootstrap isOnboarded should be false, got ${bootstrapB.isOnboarded}`)
  }
  if (coB.name !== testBizB) {
    throw new Error(`FAILURE: Company name should be "${testBizB}", got "${coB?.name}"`)
  }
  if (coB.name.includes("Fayvouree")) {
    throw new Error(`CRITICAL FAILURE: Account B leaked Account A's business name!`)
  }
  if (coB.email.includes("fayvoureeluxe")) {
    throw new Error(`CRITICAL FAILURE: Account B leaked Account A's email!`)
  }
  console.log("SUCCESS: Account B has completely isolated company profile!")

  // 5. Check Onboarding Status endpoint
  console.log("\n--- Checking /api/tenant/onboarding-status for Account B ---")
  const statusRes = await fetch(`${API_URL}/api/tenant/onboarding-status`, {
    headers: { Authorization: `Bearer ${tokenB}` }
  })
  const statusData = await statusRes.json()
  console.log("Account B onboarding status:", statusData)
  if (statusData.isOnboarded !== false) {
    throw new Error(`FAILURE: Onboarding status should be false, got ${statusData.isOnboarded}`)
  }

  // 6. Complete Onboarding for Account B
  console.log("\n--- Completing Onboarding for Account B ---")
  const compRes = await fetch(`${API_URL}/api/tenant/complete-onboarding`, {
    method: "POST",
    headers: { Authorization: `Bearer ${tokenB}` }
  })
  const compData = await compRes.json()
  console.log("Complete onboarding response:", compData)
  if (compData.isOnboarded !== true) {
    throw new Error(`FAILURE: Expected isOnboarded true after completion, got ${compData.isOnboarded}`)
  }

  // Verify status is now true
  const statusResAfter = await fetch(`${API_URL}/api/tenant/onboarding-status`, {
    headers: { Authorization: `Bearer ${tokenB}` }
  })
  const statusDataAfter = await statusResAfter.json()
  console.log("Account B onboarding status after completion:", statusDataAfter)
  if (statusDataAfter.isOnboarded !== true) {
    throw new Error(`FAILURE: Onboarding status after completion should be true`)
  }

  // 7. Verify Account A is still intact
  console.log("\n--- Verifying Account A is still intact ---")
  const resAAfter = await fetch(`${API_URL}/api/tenant/bootstrap`, {
    headers: { Authorization: `Bearer ${tokenA}` }
  })
  const bootstrapAAfter = await resAAfter.json()
  console.log("Account A Tenant Name after Account B creation:", bootstrapAAfter.tenant.name)
  if (bootstrapAAfter.tenant.name !== userA.tenant.name) {
    throw new Error("FAILURE: Account A tenant name changed unexpectedly!")
  }

  console.log("\nALL BACKEND MULTI-TENANT CHECKS PASSED PERFECTLY!\n")
  await prisma.$disconnect()
}

run().catch(err => {
  console.error("Test error:", err)
  process.exit(1)
})
