global.IS_REACT_ACT_ENVIRONMENT = true

import React, { act } from "react"
import { createRoot } from "react-dom/client"
import { TokenUsageSection } from "./TokenUsageSection.jsx"
import * as dataLib from "../../lib/data.js"

// Mock dependencies
jest.mock("../../lib/data.js", () => ({
  fetchTokenBalance: jest.fn(),
  fetchTokenHistory: jest.fn(),
  fetchPlanInfo: jest.fn(),
  purchasePlan: jest.fn(),
  claimFreeScans: jest.fn(),
  purchaseCreditPack: jest.fn(),
  purchaseTokens: jest.fn(),
  loadLocal: jest.fn()
}))

describe("TokenUsageSection Unit Tests", () => {
  let container, root

  beforeEach(() => {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    jest.clearAllMocks()

    dataLib.loadLocal.mockReturnValue({ tokenBalance: 12.5 })
    dataLib.fetchTokenBalance.mockResolvedValue({ tokenBalance: 12.5 })
    dataLib.fetchPlanInfo.mockResolvedValue({
      plan: "free",
      planExpiresAt: null,
      isExpired: false,
      daysRemaining: 0,
      freeScansGranted: true,
      limits: {
        ordersPerMonth: 8,
        recipes: 10,
        inventoryItems: 50,
        clients: 20,
        staffLogins: 1,
        scansPerMonth: "10 free once",
        invoiceBranding: "BakeWealth mark",
        accountingReports: "Full"
      },
      usage: {
        ordersThisMonth: 2,
        recipesCount: 3,
        inventoryCount: 15,
        clientsCount: 5,
        staffCount: 1
      },
      tokenBalance: 12.5
    })
    dataLib.fetchTokenHistory.mockResolvedValue([
      {
        id: "tx-1",
        amount: -2,
        type: "ai_usage",
        description: "AI feature usage (2 credits deducted)",
        createdAt: "2026-09-03T10:00:00.000Z"
      },
      {
        id: "tx-2",
        amount: 20,
        type: "plan_grant",
        description: "Prepaid Plan Scan Allowance: standard (+40 credits)",
        createdAt: "2026-09-02T15:30:00.000Z"
      }
    ])
    dataLib.purchasePlan.mockResolvedValue({
      message: "Plan upgraded to standard",
      plan: "standard",
      months: 1,
      creditsGranted: 40,
      newBalance: 52.5
    })
    dataLib.purchaseCreditPack.mockResolvedValue({
      message: "Credit pack small purchased successfully",
      pack: { id: "small", credits: 20 },
      newBalance: 32.5
    })
  })

  afterEach(() => {
    act(() => {
      if (root) root.unmount()
    })
    if (container) container.remove()
    container = null
  })

  test("renders token balance, estimated scans, and prepaid plans", async () => {
    await act(async () => {
      root.render(<TokenUsageSection company={{ name: "Sweet Bakery", phone: "08012345678" }} />)
    })

    expect(container.textContent).toContain("Current Credit Balance")
    expect(container.textContent).toContain("12.5")
    expect(container.textContent).toContain("Credits")
    expect(container.textContent).toContain("6") // 12.5 / 2 = 6 scans
    expect(container.textContent).toContain("Scans Available")
    expect(container.textContent).toContain("Prepaid Stackable Plans")
    expect(container.textContent).toContain("Standard Plan")
    expect(container.textContent).toContain("Premium Plan")
    expect(container.textContent).toContain("Unlimited")
    expect(container.textContent).toContain("Full accounting reports")
  })

  test("renders credit packs when clicking Scan & Import Credit Packs tab", async () => {
    await act(async () => {
      root.render(<TokenUsageSection company={{ name: "Sweet Bakery" }} />)
    })

    const creditTab = Array.from(container.querySelectorAll("button")).find(b =>
      b.textContent.includes("Scan & Import Credit Packs")
    )
    expect(creditTab).toBeTruthy()

    await act(async () => {
      creditTab.click()
    })

    expect(container.textContent).toContain("Small Pack")
    expect(container.textContent).toContain("Medium Pack")
    expect(container.textContent).toContain("Large Pack")
    expect(container.textContent).toContain("₦3,000")
    expect(container.textContent).toContain("₦6,500")
    expect(container.textContent).toContain("₦14,000")
    expect(container.textContent).toContain("Roughly 10 receipt scans")
  })

  test("renders token usage history rows with amounts and type badges", async () => {
    await act(async () => {
      root.render(<TokenUsageSection company={{ name: "Sweet Bakery" }} />)
    })

    expect(container.textContent).toContain("Credit Usage & Transaction History")
    expect(container.textContent).toContain("AI feature usage (2 credits deducted)")
    expect(container.textContent).toContain("-2.0")
    expect(container.textContent).toContain("Prepaid Plan Scan Allowance")
    expect(container.textContent).toContain("+20.0")
  })

  test("opens dummy payment gateway and purchases a prepaid plan", async () => {
    jest.useFakeTimers()
    await act(async () => {
      root.render(<TokenUsageSection company={{ name: "Sweet Bakery" }} />)
    })

    const upgradeBtn = Array.from(container.querySelectorAll("button")).find(b =>
      b.textContent.includes("Upgrade to Standard Plan")
    )
    expect(upgradeBtn).toBeTruthy()

    await act(async () => {
      upgradeBtn.click()
    })

    // Expect gateway modal to open
    expect(document.body.textContent).toContain("Payment Checkout (Paystack Sandbox)")
    expect(document.body.textContent).toContain("Pay ₦5,000")

    const gatewayPayBtn = Array.from(document.body.querySelectorAll("button")).find(b =>
      b.textContent.includes("Pay ₦5,000")
    )
    expect(gatewayPayBtn).toBeTruthy()

    await act(async () => {
      gatewayPayBtn.click()
      jest.advanceTimersByTime(1500)
    })

    expect(dataLib.purchasePlan).toHaveBeenCalledWith(
      "standard",
      1,
      expect.stringContaining("PAY-BW-")
    )
    jest.useRealTimers()
  })

  test("paginates transaction history and displays correct ranges", async () => {
    // Generate 15 sample transactions
    const mockTxns = Array.from({ length: 15 }, (_, i) => ({
      id: `tx-page-${i + 1}`,
      amount: i % 2 === 0 ? -2 : 10,
      type: i % 2 === 0 ? "ai_usage" : "purchase",
      description: `Transaction Item #${i + 1}`,
      createdAt: new Date(2026, 8, 1, 10, i).toISOString()
    }))
    dataLib.fetchTokenHistory.mockResolvedValue(mockTxns)

    await act(async () => {
      root.render(<TokenUsageSection company={{ name: "Sweet Bakery" }} />)
    })

    // Should show range 1–10 of 15
    expect(container.textContent).toContain("Showing 1–10 of 15 transactions")
    expect(container.textContent).toContain("Transaction Item #1")
    expect(container.textContent).toContain("Transaction Item #10")
    // Page 2 items should not be visible on page 1
    expect(container.textContent).not.toContain("Transaction Item #11")

    // Click Next or page 2 button
    const nextBtn = Array.from(container.querySelectorAll("button")).find(b =>
      b.textContent.includes("Next ›")
    )
    expect(nextBtn).toBeTruthy()

    await act(async () => {
      nextBtn.click()
    })

    // Now page 2 is active (items 11–15)
    expect(container.textContent).toContain("Showing 11–15 of 15 transactions")
    expect(container.textContent).toContain("Transaction Item #11")
    expect(container.textContent).toContain("Transaction Item #15")
    expect(container.textContent).not.toContain("Transaction Item #2")
  })

  test("filters transaction history by type (Top-Ups and AI Usage)", async () => {
    dataLib.fetchTokenHistory.mockResolvedValue([
      {
        id: "tx-topup",
        amount: 25,
        type: "purchase",
        description: "Credit Pack purchase",
        createdAt: "2026-09-01T10:00:00.000Z"
      },
      {
        id: "tx-deduct",
        amount: -5,
        type: "ai_usage",
        description: "Bank statement reconciliation scan",
        createdAt: "2026-09-02T11:00:00.000Z"
      }
    ])

    await act(async () => {
      root.render(<TokenUsageSection company={{ name: "Sweet Bakery" }} />)
    })

    // Filter by Top-Ups
    const topUpsPill = Array.from(container.querySelectorAll("button")).find(b =>
      b.textContent.includes("Top-Ups")
    )
    expect(topUpsPill).toBeTruthy()

    await act(async () => {
      topUpsPill.click()
    })

    expect(container.textContent).toContain("Credit Pack purchase")
    expect(container.textContent).not.toContain("Bank statement reconciliation scan")

    // Filter by AI Usage
    const aiUsagePill = Array.from(container.querySelectorAll("button")).find(b =>
      b.textContent.includes("AI Usage")
    )
    expect(aiUsagePill).toBeTruthy()

    await act(async () => {
      aiUsagePill.click()
    })

    expect(container.textContent).toContain("Bank statement reconciliation scan")
    expect(container.textContent).not.toContain("Credit Pack purchase")
  })

  test("searches transaction history by text query", async () => {
    dataLib.fetchTokenHistory.mockResolvedValue([
      {
        id: "tx-receipt",
        amount: -2,
        type: "ai_usage",
        description: "Receipt Scan Dangote Sugar",
        createdAt: "2026-09-01T10:00:00.000Z"
      },
      {
        id: "tx-bank",
        amount: -5,
        type: "ai_usage",
        description: "Monthly Bank PDF Import",
        createdAt: "2026-09-02T11:00:00.000Z"
      }
    ])

    await act(async () => {
      root.render(<TokenUsageSection company={{ name: "Sweet Bakery" }} />)
    })

    const searchInput = container.querySelector('input[placeholder="Search description or type..."]')
    expect(searchInput).toBeTruthy()

    await act(async () => {
      const lastValue = searchInput.value
      searchInput.value = "Dangote"
      const tracker = searchInput._valueTracker
      if (tracker) tracker.setValue(lastValue)
      searchInput.dispatchEvent(new Event("change", { bubbles: true }))
    })

    expect(container.textContent).toContain("Receipt Scan Dangote Sugar")
    expect(container.textContent).not.toContain("Monthly Bank PDF Import")
  })
})
