global.IS_REACT_ACT_ENVIRONMENT = true

import React from "react"
import { createRoot } from "react-dom/client"
import { act } from "react"
import { StockAdjustment } from "./StockAdjustment.jsx"

describe("StockAdjustment Component Tests", () => {
  let container, root

  const mockInventory = [
    { id: "inv-1", name: "Unsalted Butter", unit: "kg", stock: 10, cost: 7000 },
    { id: "inv-2", name: "Granulated Sugar", unit: "kg", stock: 25, cost: 1500 },
    { id: "inv-3", name: "Cake Flour", unit: "kg", stock: 50, cost: 1200 }
  ]

  const mockSetInventory = jest.fn()
  const mockSetView = jest.fn()

  beforeEach(() => {
    container = document.createElement("div")
    document.body.appendChild(container)
    window.alert = jest.fn()
    window.confirm = jest.fn(() => true)
    mockSetInventory.mockClear()
    mockSetView.mockClear()
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, count: 1 })
    })
  })

  afterEach(() => {
    if (root) {
      act(() => { root.unmount() })
      root = null
    }
    document.body.removeChild(container)
    container = null
    delete global.fetch
  })

  test("renders 6 reason codes per specification", async () => {
    await act(async () => {
      root = createRoot(container)
      root.render(
        <StockAdjustment
          inventory={mockInventory}
          setInventory={mockSetInventory}
          setView={mockSetView}
        />
      )
    })

    expect(container.textContent).toContain("Stock Adjustment")
    expect(container.textContent).toContain("Spoilt or expired")
    expect(container.textContent).toContain("Damaged")
    expect(container.textContent).toContain("Used for testing or samples")
    expect(container.textContent).toContain("Theft or loss")
    expect(container.textContent).toContain("Counted wrong")
    expect(container.textContent).toContain("Other")
  })

  test("adds discrepancy line, calculates delta, and updates inventory on save", async () => {
    await act(async () => {
      root = createRoot(container)
      root.render(
        <StockAdjustment
          inventory={mockInventory}
          setInventory={mockSetInventory}
          setView={mockSetView}
        />
      )
    })

    // Select first ingredient
    const selects = Array.from(container.querySelectorAll("select"))
    const itemSelect = selects.find(s => s.innerHTML.includes("Unsalted Butter"))
    expect(itemSelect).toBeTruthy()

    await act(async () => {
      itemSelect.value = "inv-1"
      itemSelect.dispatchEvent(new Event("change", { bubbles: true }))
    })

    // System stock shows 10 kg
    expect(container.textContent).toContain("10 kg")

    // Enter counted stock: 8 kg (so delta is -2 kg)
    const inputs = Array.from(container.querySelectorAll("input[type='number']"))
    const countInput = inputs[0]
    expect(countInput).toBeTruthy()

    await act(async () => {
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
      nativeSetter.call(countInput, "8")
      countInput.dispatchEvent(new Event("input", { bubbles: true }))
      countInput.dispatchEvent(new Event("change", { bubbles: true }))
    })

    // Shows -2 delta
    expect(container.textContent).toContain("-2")

    // Click Record Adjustment button
    const submitBtn = Array.from(container.querySelectorAll("button")).find(
      b => b.textContent.includes("Record Stock Adjustment")
    )
    expect(submitBtn).toBeTruthy()

    await act(async () => {
      submitBtn.click()
    })

    // Verifies local inventory updated
    expect(mockSetInventory).toHaveBeenCalled()
    const updatedInv = mockSetInventory.mock.calls[0][0](mockInventory)
    const butter = updatedInv.find(x => x.id === "inv-1")
    expect(butter.stock).toBe(8)
  })
})
