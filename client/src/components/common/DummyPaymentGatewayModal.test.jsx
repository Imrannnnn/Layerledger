global.IS_REACT_ACT_ENVIRONMENT = true

import React, { act } from "react"
import { createRoot } from "react-dom/client"
import { DummyPaymentGatewayModal, calculatePaystackFee } from "./DummyPaymentGatewayModal.jsx"

// Mock data lib
jest.mock("../../lib/data.js", () => ({
  purchaseTokens: jest.fn(),
  initializeGatewayPayment: jest.fn(),
  verifyGatewayPayment: jest.fn()
}))

describe("DummyPaymentGatewayModal and Paystack Charge Calculation Tests", () => {
  let container, root

  beforeEach(() => {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => {
      if (root) root.unmount()
    })
    if (container) container.remove()
    container = null
  })

  test("calculatePaystackFee computes exact 1.5% + ₦100 charges for Nigerian transactions", () => {
    // ₦3,000 Small Pack: 1.5% + 100 on gross -> ₦147.21 fee -> ₦3,147.21 total
    const feeSmall = calculatePaystackFee(3000)
    expect(feeSmall).toBe(147.21)

    // ₦5,000 Standard Plan: -> ₦177.66 fee -> ₦5,177.66 total
    const feeStd = calculatePaystackFee(5000)
    expect(feeStd).toBe(177.66)

    // ₦6,500 Medium Pack: -> ₦200.51 fee -> ₦6,700.51 total
    const feeMed = calculatePaystackFee(6500)
    expect(feeMed).toBe(200.51)

    // ₦10,000 Premium Plan: -> ₦253.81 fee -> ₦10,253.81 total
    const feePrm = calculatePaystackFee(10000)
    expect(feePrm).toBe(253.81)

    // ₦14,000 Large Pack: -> ₦314.72 fee -> ₦14,314.72 total
    const feeLarge = calculatePaystackFee(14000)
    expect(feeLarge).toBe(314.72)

    // Cap at ₦2,000 for large transactions
    const feeCapped = calculatePaystackFee(150000)
    expect(feeCapped).toBe(2000)
  })

  test("renders checkout modal showing item price, Paystack fee, and total payable", async () => {
    await act(async () => {
      root.render(
        <DummyPaymentGatewayModal
          isOpen={true}
          onClose={jest.fn()}
          amount={5000}
          packageName="Standard Plan (1 Month)"
          tokens={40}
        />
      )
    })

    const text = document.body.textContent

    // Base price
    expect(text).toContain("Standard Plan (1 Month)")
    expect(text).toContain("₦5,000")

    // Fee line
    expect(text).toContain("Paystack Gateway Fee (1.5% + ₦100)")
    expect(text).toContain("177.66")

    // Total payable line
    expect(text).toContain("Total Amount to Pay")
    expect(text).toContain("5,177.66")

    // Explanatory note
    expect(text).toContain("Paystack transaction charges are covered by customer so your bakery account is credited with the full ₦5,000 value")

    // Pay button
    const payBtn = Array.from(document.body.querySelectorAll("button")).find(b =>
      b.textContent.includes("Pay ₦5,000")
    )
    expect(payBtn).toBeTruthy()
    expect(payBtn.textContent).toContain("5,177.66")
    expect(payBtn.textContent).toContain("charge")
  })

  test("renders Small Pack checkout with ₦147.21 Paystack charge and ₦3,147.21 total", async () => {
    await act(async () => {
      root.render(
        <DummyPaymentGatewayModal
          isOpen={true}
          onClose={jest.fn()}
          amount={3000}
          packageName="Small Pack (20 Credits)"
          tokens={20}
        />
      )
    })

    const text = document.body.textContent
    expect(text).toContain("₦3,000")
    expect(text).toContain("147.21")
    expect(text).toContain("3,147.21")
  })
})
