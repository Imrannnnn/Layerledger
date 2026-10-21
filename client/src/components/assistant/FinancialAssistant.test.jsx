import React from "react"
import { createRoot } from "react-dom/client"
import { act } from "react"
import { FinancialAssistant } from "./FinancialAssistant.jsx"
import * as dataModule from "../../lib/data.js"

// Mock data module
jest.mock("../../lib/data.js", () => {
  const original = jest.requireActual("../../lib/data.js")
  return {
    ...original,
    fetchAssistantStatus: jest.fn(),
    fetchFinancialOverview: jest.fn(),
    sendAssistantChat: jest.fn()
  }
})

global.IS_REACT_ACT_ENVIRONMENT = true

describe("FinancialAssistant Component", () => {
  let container = null
  let root = null

  beforeEach(() => {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    jest.clearAllMocks()
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

  describe("1. Subscription Access & Premium Paywall Gatekeeping", () => {
    test("renders Premium Upgrade Paywall when tenant is not on Premium", async () => {
      dataModule.fetchAssistantStatus.mockResolvedValue({
        hasAccess: false,
        plan: "free",
        upgradePlan: "premium",
        upgradePrice: 10000,
        message: "Upgrade to Premium for conversational financial analysis"
      })

      await act(async () => {
        root.render(
          <FinancialAssistant
            setView={jest.fn()}
            user={{ role: "owner", name: "Baker" }}
            tenantInfo={{ id: "tenant-1" }}
            company={{ name: "Sweet Treats" }}
          />
        )
      })

      expect(container.textContent).toContain("AI Financial Intelligence")
      expect(container.textContent).toContain("A Complete Estimate of Your Earnings & Profit Margin — Without Navigating Every Dashboard")
      expect(container.textContent).toContain("BakeWealth Premium Exclusive")
      expect(container.textContent).toContain("Upgrade to Premium (₦10,000 / month)")

      // Check Upgrade CTA button exists
      const upgradeBtn = container.querySelector("#upgrade-to-premium-btn")
      expect(upgradeBtn).not.toBeNull()
    })

    test("clicking Upgrade to Premium triggers onUpgradePlan or setView", async () => {
      dataModule.fetchAssistantStatus.mockResolvedValue({
        hasAccess: false,
        plan: "standard",
        upgradePlan: "premium"
      })

      const onUpgradeMock = jest.fn()

      await act(async () => {
        root.render(
          <FinancialAssistant
            setView={jest.fn()}
            user={{ role: "owner", name: "Baker" }}
            tenantInfo={{ id: "tenant-1" }}
            company={{ name: "Sweet Treats" }}
            onUpgradePlan={onUpgradeMock}
          />
        )
      })

      const upgradeBtn = container.querySelector("#upgrade-to-premium-btn")
      expect(upgradeBtn).not.toBeNull()

      await act(async () => {
        upgradeBtn.click()
      })

      expect(onUpgradeMock).toHaveBeenCalledWith("premium")
    })
  })

  describe("2. Active Premium Conversational Financial Intelligence", () => {
    const mockOverview = {
      tenant: { name: "Luxury Bakery", currency: "NGN (₦)" },
      currentMonthKey: "2026-10",
      currentMonth: {
        periodLabel: "October 2026",
        revenue: 1250000,
        cogs: 450000,
        grossProfit: 800000,
        grossMarginPct: 64.0,
        totalOverhead: 280000,
        netProfit: 520000,
        netMarginPct: 41.6,
        paidOrderCount: 25,
        giftSampleOrderCount: 2,
        giftSampleCostTotal: 18000,
        expenseCount: 12,
        topExpenseDrains: [
          { category: "Logistics", amount: 120000 }
        ],
        productBreakdown: [
          { type: "Tier Cake", revenue: 800000, grossProfit: 550000, grossMarginPct: 68.8, orderCount: 15 }
        ]
      },
      momComparison: {
        revenue: { difference: 150000, percentageChange: 13.6 }
      }
    }

    beforeEach(() => {
      dataModule.fetchAssistantStatus.mockResolvedValue({
        hasAccess: true,
        plan: "premium"
      })
      dataModule.fetchFinancialOverview.mockResolvedValue({
        success: true,
        data: mockOverview
      })
    })

    test("renders Top Executive Snapshot KPI Cards for complete estimate without visiting other dashboards", async () => {
      await act(async () => {
        root.render(
          <FinancialAssistant
            setView={jest.fn()}
            user={{ role: "owner", name: "Chef Amina" }}
            tenantInfo={{ id: "tenant-premium" }}
            company={{ name: "Luxury Bakery" }}
          />
        )
      })

      // Revenue KPI
      expect(container.textContent).toContain("Total Earned (Revenue)")
      expect(container.textContent).toContain("₦1,250,000")
      expect(container.textContent).toContain("25 confirmed orders")

      // Gross Profit & Margin
      expect(container.textContent).toContain("Gross Profit & Margin")
      expect(container.textContent).toContain("64% Margin")
      expect(container.textContent).toContain("₦800,000")

      // Net Profit & Margin
      expect(container.textContent).toContain("Net Profit (Take-Home)")
      expect(container.textContent).toContain("41.6% Net")
      expect(container.textContent).toContain("₦520,000")
    })

    test("allows user to type financial query and renders AI response", async () => {
      dataModule.sendAssistantChat.mockResolvedValue({
        success: true,
        answer: "### 💰 Revenue & Earnings Analysis\n- **Total Revenue:** **₦1,250,000**\n- **Net Profit Margin:** **41.6%**",
        intent: "COMPLETE_MARGIN_ANALYSIS",
        metrics: {
          revenue: 1250000,
          netMarginPct: 41.6
        },
        auditTrace: {
          tenantId: "tenant-premium",
          reportingPeriod: "October 2026",
          ordersAnalyzed: 27,
          expensesAnalyzed: 12
        },
        suggestedQuestions: [
          "What is my current profit margin?",
          "What areas are reducing my profitability?"
        ]
      })

      await act(async () => {
        root.render(
          <FinancialAssistant
            setView={jest.fn()}
            user={{ role: "owner", name: "Chef Amina" }}
            tenantInfo={{ id: "tenant-premium" }}
            company={{ name: "Luxury Bakery" }}
          />
        )
      })

      const input = container.querySelector("#financial-assistant-input")
      const sendBtn = container.querySelector("#financial-assistant-send-btn")
      expect(input).not.toBeNull()
      expect(sendBtn).not.toBeNull()

      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value"
      ).set

      await act(async () => {
        nativeInputValueSetter.call(input, "Give me a complete estimate of how much I have earned and my profit margin")
        input.dispatchEvent(new Event("input", { bubbles: true }))
        input.dispatchEvent(new Event("change", { bubbles: true }))
      })

      await act(async () => {
        sendBtn.click()
      })

      expect(dataModule.sendAssistantChat).toHaveBeenCalledWith(
        expect.objectContaining({
          question: "Give me a complete estimate of how much I have earned and my profit margin"
        })
      )

      expect(container.textContent).toContain("Revenue & Earnings Analysis")
      expect(container.textContent).toContain("Total Revenue:")
      expect(container.textContent).toContain("41.6%")
    })

    test("clicking a quick prompt sends query directly to assistant", async () => {
      dataModule.sendAssistantChat.mockResolvedValue({
        success: true,
        answer: "### 📊 Profit Margin Breakdown\n1. Gross Profit Margin: **64.0%**\n2. Net Profit Margin: **41.6%**",
        intent: "PROFIT_MARGIN",
        suggestedQuestions: []
      })

      await act(async () => {
        root.render(
          <FinancialAssistant
            setView={jest.fn()}
            user={{ role: "owner", name: "Chef Amina" }}
            tenantInfo={{ id: "tenant-premium" }}
            company={{ name: "Luxury Bakery" }}
          />
        )
      })

      // Find quick prompt button
      const quickBtns = Array.from(container.querySelectorAll("button")).filter(b =>
        b.textContent.includes("Complete Estimate & Margin Analysis")
      )
      expect(quickBtns.length).toBeGreaterThan(0)

      await act(async () => {
        quickBtns[0].click()
      })

      expect(dataModule.sendAssistantChat).toHaveBeenCalledWith(
        expect.objectContaining({
          question: "Give me a complete estimate of how much I have earned and my profit margin"
        })
      )
    })
  })
})
