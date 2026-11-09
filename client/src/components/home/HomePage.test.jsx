global.IS_REACT_ACT_ENVIRONMENT = true

import React, { act } from "react"
import { createRoot } from "react-dom/client"
import { HomePage, CREDIT_PACKS } from "./HomePage.jsx"

describe("HomePage Component Tests", () => {
  let container, root

  beforeEach(() => {
    window.HTMLElement.prototype.scrollIntoView = jest.fn()
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

  test("renders all 5 toolkit tabs including 'What a cake costs' and 'The Psychology of a Baker'", async () => {
    await act(async () => {
      root.render(<HomePage />)
    })

    const tabs = Array.from(container.querySelectorAll(".tabs .tab"))
    expect(tabs).toHaveLength(5)
    expect(tabs.map(t => t.textContent.trim())).toEqual([
      "Weight ↔ volume",
      "Recipe scaler",
      "Pan size",
      "What a cake costs",
      "The Psychology of a Baker"
    ])
  })

  test("What a cake costs tool calculates default cost, surface, margin price, and handles charge gap", async () => {
    await act(async () => {
      root.render(<HomePage />)
    })

    const costTab = Array.from(container.querySelectorAll(".tab")).find(b =>
      b.textContent.includes("What a cake costs")
    )
    expect(costTab).toBeTruthy()

    await act(async () => {
      costTab.click()
    })

    // Cost panel is visible
    const costPanel = container.querySelector("#t-cost")
    expect(costPanel).toBeTruthy()

    // Default calculations: 8" round, 3 layers, 2", choc, bc, 4h @ ₦2,500
    // Expected: ₦30,408 cost, 201 square inches, sell for at least ₦61,000
    const kOut = container.querySelector("#kOut")
    const kNote = container.querySelector("#kNote")
    const kPrice = container.querySelector("#kPrice")

    expect(kOut.textContent).toBe("₦30,408")
    expect(kNote.textContent).toContain("201 square inches to cover")
    expect(kPrice.textContent).toContain("Sell it for at least ₦61,000 to keep a 50% margin")

    // Type 35,000 into the charge input
    const chargeInput = container.querySelector("#kCharge")
    await act(async () => {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value"
      ).set
      nativeInputValueSetter.call(chargeInput, "35000")
      chargeInput.dispatchEvent(new Event("input", { bubbles: true }))
    })

    // Expected verdict: ₦25,817 short, ₦103,268 a month
    const verdict = container.querySelector("#kVerdict")
    expect(verdict.textContent).toContain("₦25,817 short")
    expect(verdict.textContent).toContain("₦103,268 a month")
  })

  test("The Psychology of a Baker quiz progresses, allows back, and calculates scores", async () => {
    await act(async () => {
      root.render(<HomePage />)
    })

    const testTab = Array.from(container.querySelectorAll(".tab")).find(b =>
      b.textContent.includes("The Psychology of a Baker")
    )
    expect(testTab).toBeTruthy()

    await act(async () => {
      testTab.click()
    })

    const testPanel = container.querySelector("#t-test")
    expect(testPanel).toBeTruthy()
    expect(container.querySelector("#pb-count").textContent).toBe("Question 1 of 10")
    expect(container.querySelector("#pb-back")).toBeNull() // Back hidden on question 1

    // Answer worst option (option 2) for all 10 questions to score 0
    for (let q = 0; q < 10; q++) {
      const options = container.querySelectorAll("#pb-opts button")
      expect(options.length).toBe(3)
      await act(async () => {
        options[2].click() // worst option = 0 points
      })
    }

    // Should now show score screen
    expect(container.querySelector("#pb-result")).toBeTruthy()
    expect(container.querySelector("#pb-num").textContent).toBe("0")
    expect(container.querySelector("#pb-band").textContent).toBe("You cannot tell whether you are making money")

    // All 10 rows should carry "What to do" hints
    const rows = container.querySelectorAll(".pb-row")
    expect(rows).toHaveLength(10)
    rows.forEach(row => {
      expect(row.textContent).toContain("What to do")
    })

    // Take it again
    const againBtn = container.querySelector("#pb-again")
    await act(async () => {
      againBtn.click()
    })

    expect(container.querySelector("#pb-count").textContent).toBe("Question 1 of 10")

    // Answer best option (option 0) for all 10 questions to score 10
    for (let q = 0; q < 10; q++) {
      const options = container.querySelectorAll("#pb-opts button")
      await act(async () => {
        options[0].click() // best option = 1 point
      })
    }

    expect(container.querySelector("#pb-num").textContent).toBe("10")
    expect(container.querySelector("#pb-band").textContent).toBe("You are in the small minority")
    // When score is 10, no "What to do" hints
    const perfectRows = container.querySelectorAll(".pb-row")
    expect(perfectRows).toHaveLength(10)
    perfectRows.forEach(row => {
      expect(row.textContent).not.toContain("What to do")
    })
  })
})
