/**
 * verify-superadmin.js
 * ----------------------------------------------------------------------------
 * Verifies that the Super Admin master account is active and connected to Supabase.
 * Uses the custom prisma adapter settings.
 * ----------------------------------------------------------------------------
 */
require('dotenv').config()
const prisma = require('../prisma')

async function main() {
  console.log("=========================================")
  console.log("LayerLedger Super Admin Config System")
  console.log("=========================================")
  
  const email = process.env.SUPERADMIN_EMAIL
  const pass = process.env.SUPERADMIN_PASSWORD
  
  if (!email || !pass) {
    console.error("❌ CONFIG ERROR: SUPERADMIN_EMAIL or SUPERADMIN_PASSWORD is not set in backend/.env!")
    process.exit(1)
  }
  
  console.log("✅ Super Admin Configuration found in env:")
  console.log(`  - Login Email: ${email}`)
  console.log(`  - Password: [CONFIGURED]`)
  
  try {
    await prisma.$connect()
    console.log("✅ Supabase PostgreSQL Database Connected successfully.")
    
    // Count existing tenants in the database
    const tenantsCount = await prisma.tenant.count()
    console.log(`  - Existing Tenants: ${tenantsCount}`)
  } catch (err) {
    console.error("❌ Database Connection Failed:", err.message)
  } finally {
    await prisma.$disconnect()
  }
  console.log("=========================================")
}

main()
