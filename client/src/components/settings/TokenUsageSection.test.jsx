global.IS_REACT_ACT_ENVIRONMENT = true

import React, { act } from "react"
import { createRoot } from "react-dom/client"
import { TokenUsageSection } from "./TokenUsageSection.jsx"
import * as dataLib from "../../lib/data.js"

// Mock dependencies
jest.mock("../../lib/data.js", () => ({
  fetchTokenBalance: jest.fn(),
  fetchTokenHistory: jest.fn(),
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
    dataLib.fetchTokenHistory.mockResolvedValue([
      {
        id: "tx-1",
        amount: -0.7,
        type: "ai_usage",
        description: "AI feature usage (0.7 tokens deducted)",
        createdAt: "2026-09-03T10:00:00.000Z"
      },
      {
        id: "tx-2",
        amount: 50,
        type: "purchase",
        description: "Token Purchase: Baker Pro Pack (+50 tokens)",
        createdAt: "2026-09-02T15:30:00.000Z"
      }
    ])
    dataLib.purchaseTokens.mockResolvedValue({
      transaction: { id: "tx-new", amount: 50 },
      newBalance: 62.5
    })
  })

  afterEach(() => {
    act(() => {
      if (root) root.unmount()
    })
    if (container) container.remove()
    container = null
  })

  test("renders token balance, estimated scans, and packages", async () => {
    await act(async () => {
      root.render(<TokenUsageSection company={{ name: "Sweet Bakery", phone: "08012345678" }} />)
    })

    expect(container.textContent).toContain("Current Token Balance")
    expect(container.textContent).toContain("12.5")
    expect(container.textContent).toContain("Tokens")
    expect(container.textContent).toContain("17") // 12.5 / 0.7 = 17 scans
    expect(container.textContent).toContain("Scans Available")
    expect(container.textContent).toContain("Make Payment for AI Tokens")
    expect(container.textContent).toContain("Starter Pack")
    expect(container.textContent).toContain("Baker Pro Pack")
    expect(container.textContent).toContain("Commercial Pack")
  })

  test("renders token usage history rows with amounts and type badges", async () => {
    await act(async () => {
      root.render(<TokenUsageSection company={{ name: "Sweet Bakery" }} />)
    })

    expect(container.textContent).toContain("Token Usage & Transaction History")
    expect(container.textContent).toContain("AI feature usage (0.7 tokens deducted)")
    expect(container.textContent).toContain("-0.7")
    expect(container.textContent).toContain("Token Purchase: Baker Pro Pack (+50 tokens)")
    expect(container.textContent).toContain("+50.0")
  })

  test("opens dummy payment gateway and tops up tokens", async () => {
    jest.useFakeTimers()
    await act(async () => {
      root.render(<TokenUsageSection company={{ name: "Sweet Bakery" }} />)
    })

    const payBtn = Array.from(container.querySelectorAll("button")).find(b =>
      b.textContent.includes("Pay & Top-Up")
    )
    expect(payBtn).toBeTruthy()

    await act(async () => {
      payBtn.click()
    })

    // Expect gateway modal to open
    expect(document.body.textContent).toContain("Payment Checkout (Paystack Sandbox)")
    expect(document.body.textContent).toContain("Pay ₦4,500")

    const gatewayPayBtn = Array.from(document.body.querySelectorAll("button")).find(b =>
      b.textContent.includes("Pay ₦4,500")
    )
    expect(gatewayPayBtn).toBeTruthy()

    await act(async () => {
      gatewayPayBtn.click()
      jest.advanceTimersByTime(1500)
    })

    expect(dataLib.purchaseTokens).toHaveBeenCalledWith(
      50,
      expect.stringContaining("Baker Pro Pack")
    )
    jest.useRealTimers()
  })
})
