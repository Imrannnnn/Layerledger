import React from "react"
import { createRoot } from "react-dom/client"
import { act } from "react"
import { SuperAdminDashboard } from "./SuperAdminDashboard.jsx"

global.IS_REACT_ACT_ENVIRONMENT = true

describe("SuperAdminDashboard Component Tests", () => {
  let container = null
  let root = null

  const mockStats = {
    totalTenants: 12,
    tenantsThisMonth: 4,
    activeTenants30Days: 9,
    totalPayingTenants: 3,
    subscriptionBreakdown: {
      free: 7,
      standard: 3,
      premium: 2,
      pro: 2,
      token: 1,
      activeTrials: 1
    },
    subscriptionAnalytics: {
      totalPayingTenants: 3,
      activeSubscriptions: 2,
      expiringSoon: 1,
      expiredSubscriptions: 1,
      activeTrials: 1,
      revenue: {
        totalAllTime: 45000,
        subscriptionsAllTime: 35000,
        tokenSalesAllTime: 10000,
        thisMonthTotal: 25000,
        thisMonthSubscriptions: 20000,
        thisMonthTokenSales: 5000
      }
    },
    monthlyRevenue: {
      subscriptions: 20000,
      tokenSales: 5000,
      total: 25000
    },
    tokenSales: {
      units: 35,
      revenue: 5000
    },
    usage: {
      recipes: 54,
      orders: 28,
      inventory: 110,
      expenses: 19
    }
  }

  const mockTenants = [
    {
      id: "tenant-1",
      name: "Flour & Butter Bakery",
      ownerEmail: "owner@flourbutter.com",
      registrationDate: "2026-01-10T00:00:00.000Z",
      currentPlan: "premium",
      configuredPlan: "premium",
      isExpired: false,
      planExpiresAt: "2026-10-25T00:00:00.000Z",
      daysRemaining: 11,
      tokenBalance: 40,
      lastActiveDate: "2026-10-14T00:00:00.000Z",
      status: "Active",
      hasActiveTrial: true,
      grantedTrial: { days: 2, plan: "premium" },
      latestPaymentAmount: 10000,
      latestPaymentDate: "2026-10-10T00:00:00.000Z"
    },
    {
      id: "tenant-2",
      name: "Rustic Loaf Studio",
      ownerEmail: "baker@rusticloaf.com",
      registrationDate: "2026-02-15T00:00:00.000Z",
      currentPlan: "free",
      configuredPlan: "standard",
      isExpired: true,
      planExpiresAt: "2026-10-01T00:00:00.000Z",
      daysRemaining: 0,
      tokenBalance: 5,
      lastActiveDate: "2026-10-12T00:00:00.000Z",
      status: "Active",
      hasActiveTrial: false,
      grantedTrial: null,
      latestPaymentAmount: 5000,
      latestPaymentDate: "2026-09-01T00:00:00.000Z"
    }
  ]

  const mockPayments = [
    {
      id: "pay-101",
      reference: "LL-PAY-PREM-101",
      tenantId: "tenant-1",
      tenantName: "Flour & Butter Bakery",
      customerEmail: "owner@flourbutter.com",
      customerName: "Alice Baker",
      resourceType: "subscription_plan",
      resourceId: "premium",
      plan: "premium",
      months: 1,
      amount: 10000,
      currency: "NGN",
      provider: "paystack",
      status: "SUCCESS",
      paidAt: "2026-10-10T12:00:00.000Z",
      planExpiresAt: "2026-10-25T00:00:00.000Z",
      isExpired: false,
      daysRemaining: 11
    }
  ]

  beforeEach(() => {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    sessionStorage.clear()
    jest.clearAllMocks()

    // Default fetch mock
    global.fetch = jest.fn((url, options) => {
      const urlStr = String(url)
      if (urlStr.includes("/api/superadmin/login")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ token: "mock-superadmin-token-123", email: "admin@bakewealth.com" })
        })
      }
      if (urlStr.includes("/api/superadmin/dashboard")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            stats: mockStats,
            tenants: mockTenants,
            payments: mockPayments
          })
        })
      }
      if (urlStr.includes("/grant-premium")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            message: "Successfully granted 2 day(s) Premium plan access to Flour & Butter Bakery",
            emailSent: true
          })
        })
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
    })
  })

  afterEach(() => {
    if (root) {
      act(() => {
        root.unmount()
      })
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container)
    }
    container = null
    root = null
  })

  test("1. Renders login form when no admin token exists in session", async () => {
    await act(async () => {
      root.render(<SuperAdminDashboard />)
    })

    expect(container.textContent).toContain("Platform Super Admin Dashboard")
    expect(container.textContent).toContain("Secure Login")
    expect(container.querySelector("input[type='email']")).not.toBeNull()
    expect(container.querySelector("input[type='password']")).not.toBeNull()
  })

  test("2. Renders main workspace with KPI cards and tenant directory when authenticated", async () => {
    sessionStorage.setItem("ll_superadmin_token", "valid-admin-jwt")
    sessionStorage.setItem("ll_superadmin_email", "admin@bakewealth.com")

    await act(async () => {
      root.render(<SuperAdminDashboard />)
    })

    expect(container.textContent).toContain("Super Admin Workspace")
    expect(container.textContent).toContain("Platform Owner: Iye Ibe Achem")

    // Check KPI cards
    expect(container.textContent).toContain("Total Accounts")
    expect(container.textContent).toContain("Paying Customers")
    expect(container.textContent).toContain("Active Subscriptions")
    expect(container.textContent).toContain("Expiring Soon (≤7d)")
    expect(container.textContent).toContain("Granted Trials Active")

    // Check tenants list
    expect(container.textContent).toContain("Flour & Butter Bakery")
    expect(container.textContent).toContain("owner@flourbutter.com")
    expect(container.textContent).toContain("Premium Trial")
    expect(container.textContent).toContain("Rustic Loaf Studio")
  })

  test("3. Switches to Subscriptions & Payment History tab to view payments, dates paid, and expiry", async () => {
    sessionStorage.setItem("ll_superadmin_token", "valid-admin-jwt")

    await act(async () => {
      root.render(<SuperAdminDashboard />)
    })

    // Click on Subscriptions tab button
    const buttons = Array.from(container.querySelectorAll("button"))
    const subTabBtn = buttons.find(b => b.textContent.includes("Subscriptions & Payment History"))
    expect(subTabBtn).toBeDefined()

    await act(async () => {
      subTabBtn.click()
    })

    // Verify payment records rendered
    expect(container.textContent).toContain("LL-PAY-PREM-101")
    expect(container.textContent).toContain("⭐ Premium Plan (1 mo)")
    expect(container.textContent).toContain("₦10,000")
    expect(container.textContent).toContain("Subscription Expiration")
    expect(container.textContent).toContain("All-Time Revenue Collected")
  })

  test("4. Opens Grant Premium modal, selects 2 days, and submits successfully", async () => {
    sessionStorage.setItem("ll_superadmin_token", "valid-admin-jwt")

    await act(async () => {
      root.render(<SuperAdminDashboard />)
    })

    // Find "Grant Premium" button for Flour & Butter Bakery
    const grantButtons = Array.from(container.querySelectorAll("button")).filter(b => b.textContent.includes("Grant Premium"))
    expect(grantButtons.length).toBeGreaterThan(0)

    await act(async () => {
      grantButtons[0].click()
    })

    // Verify modal is open
    expect(container.textContent).toContain("Grant Complimentary Premium Plan Access")
    expect(container.textContent).toContain("Select Premium Access Duration:")
    expect(container.textContent).toContain("2 Days (Recommended)")
    expect(container.textContent).toContain("Access will be valid until:")

    // Submit the form
    const submitBtn = Array.from(container.querySelectorAll("button")).find(b => b.textContent.includes("Confirm & Grant Premium Plan"))
    expect(submitBtn).toBeDefined()

    await act(async () => {
      submitBtn.click()
    })

    // Verify fetch called with grant-premium endpoint
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/superadmin/tenants/tenant-1/grant-premium"),
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"days":2')
      })
    )

    // Check success toast appears
    expect(container.textContent).toContain("Successfully granted 2 day(s) Premium plan access")
  })

  test("5. Tenant Dashboard displays complimentary Premium trial banner with days left and expiry", async () => {
    const { Dashboard } = require("../dashboard/Dashboard.jsx")

    const futureExpiry = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString()
    const mockTenantWithTrial = {
      id: "tenant-trial-1",
      name: "Sugar Blossom Bakery",
      settings: {
        plan: "premium",
        planExpiresAt: futureExpiry,
        grantedTrial: {
          days: 2,
          grantedAt: new Date().toISOString(),
          expiresAt: futureExpiry,
          grantedBy: "superadmin"
        }
      }
    }

    await act(async () => {
      root.render(
        <Dashboard
          productions={[]}
          inventory={[]}
          expenses={[]}
          setView={jest.fn()}
          user={{ name: "Betty Baker", role: "owner", isOnboarded: true }}
          tenantInfo={mockTenantWithTrial}
          onboarded={true}
        />
      )
    })

    expect(container.textContent).toContain("Complimentary Premium Plan Active!")
    expect(container.textContent).toContain("AI Financial Assistant & Complete Margin Analysis")
    expect(container.textContent).toContain("Ask AI Financial Assistant")
  })
})
