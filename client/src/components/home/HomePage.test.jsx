global.IS_REACT_ACT_ENVIRONMENT = true

import React, { act } from "react"
import { createRoot } from "react-dom/client"
import { HomePage, CREDIT_PACKS } from "./HomePage.jsx"

describe("HomePage Component Tests", () => {
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

  test("exports accurate CREDIT_PACKS matching the application specifications", () => {
    expect(CREDIT_PACKS).toHaveLength(3)

    const small = CREDIT_PACKS.find(p => p.id === "small")
    expect(small).toBeDefined()
    expect(small.price).toBe(3000)
    expect(small.credits).toBe(20)
    expect(small.scans).toBe(10)
    expect(small.statements).toBe(4)

    const medium = CREDIT_PACKS.find(p => p.id === "medium")
    expect(medium).toBeDefined()
    expect(medium.price).toBe(6500)
    expect(medium.credits).toBe(50)
    expect(medium.scans).toBe(25)
    expect(medium.statements).toBe(10)
    expect(medium.popular).toBe(true)

    const large = CREDIT_PACKS.find(p => p.id === "large")
    expect(large).toBeDefined()
    expect(large.price).toBe(14000)
    expect(large.credits).toBe(120)
    expect(large.scans).toBe(60)
    expect(large.statements).toBe(24)
  })

  test("renders all three credit packages on the home page with prices and credits", async () => {
    await act(async () => {
      root.render(<HomePage />)
    })

    const text = container.textContent

    // Credit pack names & prices
    expect(text).toContain("Small Pack")
    expect(text).toContain("₦3,000")
    expect(text).toContain("20 Credits")
    expect(text).toContain("~10 receipt scans or 4 bank statements")

    expect(text).toContain("Medium Pack")
    expect(text).toContain("₦6,500")
    expect(text).toContain("50 Credits")
    expect(text).toContain("~25 receipt scans or 10 bank statements")
    expect(text).toContain("Best Value")

    expect(text).toContain("Large Pack")
    expect(text).toContain("₦14,000")
    expect(text).toContain("120 Credits")
    expect(text).toContain("~60 receipt scans or 24 bank statements")

    // Rate reference
    expect(text).toContain("1 Receipt = 2 Credits • 1 Statement = 5 Credits")
    expect(text).toContain("Credits never expire")

    // Arithmetic comparison callout
    expect(text).toContain("The Premium Arithmetic:")
    expect(text).toContain("₦11,500")
    expect(text).toContain("Premium is only ₦10,000 for 80 scans")
  })

  test("renders Free, Standard, and Premium subscription plans with correct quotas", async () => {
    await act(async () => {
      root.render(<HomePage />)
    })

    const text = container.textContent

    // Free Plan & AI Usage Highlights
    expect(text).toContain("Start free")
    expect(text).toContain("10 FREE AI SCANS INCLUDED")
    expect(text).toContain("What the Free Plan Entails:")
    expect(text).toContain("Free Forever with 10 Bonus AI Scans")
    expect(text).toContain("AI & Scan Usage on Free:")
    expect(text).toContain("8 / month")
    expect(text).toContain("10 recipes")
    expect(text).toContain("50 items")
    expect(text).toContain("20 clients")
    expect(text).toContain("10 free starter scans")

    // Standard Plan
    expect(text).toContain("Standard")
    expect(text).toContain("Choose Standard")
    expect(text).toContain("60")
    expect(text).toContain("250")
    expect(text).toContain("150")
    expect(text).toContain("20 a month")

    // Premium Plan
    expect(text).toContain("Premium")
    expect(text).toContain("Choose Premium")
    expect(text).toContain("80 a month")
    expect(text).toContain("your own logo only")
  })

  test("multi-month duration discounts update plan prices accurately", async () => {
    await act(async () => {
      root.render(<HomePage />)
    })

    // Initially 1 Month (5,000 and 10,000)
    expect(container.textContent).toContain("5,000")
    expect(container.textContent).toContain("10,000")

    // Click 3 Months (5% off: Std 14,250, Prm 28,500)
    const threeMoBtn = Array.from(container.querySelectorAll("button")).find(b =>
      b.textContent.includes("3 Months")
    )
    expect(threeMoBtn).toBeTruthy()

    await act(async () => {
      threeMoBtn.click()
    })

    expect(container.textContent).toContain("14,250")
    expect(container.textContent).toContain("28,500")

    // Click 12 Months (15% off: Std 51,000, Prm 102,000)
    const twelveMoBtn = Array.from(container.querySelectorAll("button")).find(b =>
      b.textContent.includes("12 Months")
    )
    expect(twelveMoBtn).toBeTruthy()

    await act(async () => {
      twelveMoBtn.click()
    })

    expect(container.textContent).toContain("51,000")
    expect(container.textContent).toContain("102,000")
  })

  test("calls onGoToDashboard with 'credits' when logged in user clicks Buy credits", async () => {
    const mockGoToDashboard = jest.fn()
    await act(async () => {
      root.render(
        <HomePage
          currentUser={{ id: "u-1", name: "Baker Jane" }}
          onGoToDashboard={mockGoToDashboard}
        />
      )
    })

    const buyButtons = Array.from(container.querySelectorAll("button")).filter(b =>
      b.textContent.includes("Buy credits")
    )
    expect(buyButtons.length).toBeGreaterThan(0)

    await act(async () => {
      buyButtons[0].click()
    })

    expect(mockGoToDashboard).toHaveBeenCalledWith("credits")
  })

  test("calls onRegisterClick when unauthenticated visitor clicks Get started on pack", async () => {
    const mockRegister = jest.fn()
    await act(async () => {
      root.render(
        <HomePage
          currentUser={null}
          onRegisterClick={mockRegister}
        />
      )
    })

    const getStartedButtons = Array.from(container.querySelectorAll("button")).filter(b =>
      b.textContent.includes("Get started")
    )
    expect(getStartedButtons.length).toBeGreaterThan(0)

    await act(async () => {
      getStartedButtons[0].click()
    })

    expect(mockRegister).toHaveBeenCalled()
  })
})
