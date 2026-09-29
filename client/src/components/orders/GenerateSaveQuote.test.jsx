global.IS_REACT_ACT_ENVIRONMENT = true

import React from "react"
import { createRoot } from "react-dom/client"
import { act } from "react"
import { OrderCalculator } from "./OrderCalculator.jsx"
import * as dataLib from "../../lib/data.js"

// Mock data module
jest.mock("../../lib/data.js", () => ({
  loadCompany: jest.fn(() => ({ name: "BakeWealth", bankName: "GTBank", bankAccount: "0123456789" })),
  loadLocal: jest.fn((key, fallback) => fallback),
  saveLocal: jest.fn().mockResolvedValue(true),
  loadQuotes: jest.fn(() => []),
  saveQuotes: jest.fn(),
  loadClients: jest.fn(() => []),
  upsertClient: jest.fn().mockResolvedValue(true),
  clearTempCalculatorState: jest.fn(),
  checkPlanLimit: jest.fn(() => ({ exceeded: false })),
  notifyPlanLimitReached: jest.fn()
}))

// Mock UI components with exact Btn behavior (loading, loadingText, disabled)
jest.mock("../common/ui.jsx", () => {
  const React = require("react")
  return {
    Btn: ({ children, onClick, disabled, full, variant, loading, loadingText }) => (
      <button
        onClick={onClick}
        disabled={disabled || loading}
        data-variant={variant}
        data-loading={loading ? "true" : "false"}
      >
        {loading && <span data-testid="spinner">Loading...</span>}
        {loadingText && loading ? loadingText : children}
      </button>
    ),
    Inp: ({ label, value, onChange, type, placeholder }) => (
      <div data-testid={`field-${label}`}>
        <label>{label}</label>
        <input
          type={type || "text"}
          value={value || ""}
          placeholder={placeholder}
          onChange={e => onChange(e.target.value)}
        />
      </div>
    ),
    Sel: ({ label, value, onChange, options }) => (
      <div data-testid={`select-${label}`}>
        <label>{label}</label>
        <select value={value || ""} onChange={e => onChange(e.target.value)}>
          {options.map(o => <option key={o.value || o} value={o.value || o}>{o.label || o}</option>)}
        </select>
      </div>
    ),
    Card: ({ children, style }) => <div className="card" style={style}>{children}</div>,
    SHead: ({ title, sub }) => <div><h2>{title}</h2><p>{sub}</p></div>,
    SearchableSelect: ({ value, onChange, options, placeholder }) => (
      <select data-testid="searchable-select" value={value || ""} onChange={e => onChange(e.target.value)}>
        <option value="">{placeholder}</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    )
  }
})

describe("Generate & Save Quote Flow & Feedback Tests", () => {
  let container, root

  const mockInventory = [
    { id: "i-flour", name: "Flour", cat: "Dry Goods", unit: "kg", cost: 1000, stock: 50 },
    { id: "i-sugar", name: "Sugar", cat: "Dry Goods", unit: "kg", cost: 800, stock: 40 }
  ]

  const mockRecipes = [
    {
      id: "r-rv",
      name: "Red Velvet",
      type: "layer",
      ing: [
        { iid: "i-flour", qty: 0.5, unit: "kg" },
        { iid: "i-sugar", qty: 0.4, unit: "kg" }
      ]
    }
  ]

  const mockSettings = {
    profitPct: 40,
    overheadPct: 25,
    accessoryPct: 10,
    miscPct: 5
  }

  beforeEach(() => {
    container = document.createElement("div")
    document.body.appendChild(container)
    window.alert = jest.fn()
    window.confirm = jest.fn(() => true)
    jest.clearAllMocks()
  })

  afterEach(() => {
    if (root) {
      act(() => { root.unmount() })
      root = null
    }
    document.body.removeChild(container)
    container = null
  })

  const setupCalculatorWithReadyQuote = async () => {
    sessionStorage.setItem("ll_calc_prefill", JSON.stringify({
      clientName: "Adeola Balogun",
      clientPhone: "08012345678",
      items: [
        {
          id: "cake-1",
          type: "cake",
          name: "Item 1 — Birthday Cake",
          tiers: [
            {
              id: 1,
              size: "8",
              shape: "Round",
              layers: [{ id: 101, flavour: "Red Velvet", qty: 1 }],
              coverings: [],
              fillings: []
            }
          ],
          decQty: {},
          accRows: []
        }
      ]
    }))

    await act(async () => {
      root = createRoot(container)
      root.render(
        <OrderCalculator
          inventory={mockInventory}
          recipes={mockRecipes}
          settings={mockSettings}
          setView={jest.fn()}
          company={{ name: "BakeWealth" }}
        />
      )
    })
  }

  test("clicking Generate & Save Quote once shows immediate loading feedback and disables the button", async () => {
    let resolveSave
    const savePromise = new Promise(resolve => { resolveSave = resolve })
    dataLib.saveQuotes.mockReturnValue(savePromise)

    await setupCalculatorWithReadyQuote()

    const saveBtn = Array.from(container.querySelectorAll("button")).find(
      b => b.textContent.includes("Generate & save quote") || b.textContent.includes("Saving quote...")
    )
    expect(saveBtn).toBeTruthy()
    expect(saveBtn.disabled).toBe(false)
    expect(saveBtn.getAttribute("data-loading")).toBe("false")

    // Click the button
    await act(async () => {
      saveBtn.click()
    })

    // Immediately shows loading state and is disabled
    expect(saveBtn.disabled).toBe(true)
    expect(saveBtn.getAttribute("data-loading")).toBe("true")
    expect(saveBtn.textContent).toContain("Saving quote...")
    expect(saveBtn.querySelector("[data-testid='spinner']")).toBeTruthy()

    // Resolve the promise
    await act(async () => {
      resolveSave(true)
      await savePromise
    })

    // Finished saving, quote is saved
    expect(container.textContent).toContain("Quote saved for Adeola Balogun!")
    expect(dataLib.saveQuotes).toHaveBeenCalledTimes(1)
  })

  test("rapidly clicking the button multiple times prevents duplicate submissions", async () => {
    let resolveSave
    const savePromise = new Promise(resolve => { resolveSave = resolve })
    dataLib.saveQuotes.mockReturnValue(savePromise)

    await setupCalculatorWithReadyQuote()

    const saveBtn = Array.from(container.querySelectorAll("button")).find(
      b => b.textContent.includes("Generate & save quote")
    )
    expect(saveBtn).toBeTruthy()

    // User clicks rapidly 5 times in quick succession
    await act(async () => {
      saveBtn.click()
      saveBtn.click()
      saveBtn.click()
      saveBtn.click()
      saveBtn.click()
    })

    // saveQuotes must ONLY be called once
    expect(dataLib.saveQuotes).toHaveBeenCalledTimes(1)

    // Complete the save
    await act(async () => {
      resolveSave(true)
      await savePromise
    })

    expect(dataLib.saveQuotes).toHaveBeenCalledTimes(1)
    expect(container.textContent).toContain("Quote saved for Adeola Balogun!")
  })

  test("if saveQuotes fails, an error message is displayed and user can retry without losing inputs", async () => {
    dataLib.saveQuotes.mockRejectedValueOnce(new Error("Plan limit reached. Upgrade to generate quotes."))

    await setupCalculatorWithReadyQuote()

    const saveBtn = Array.from(container.querySelectorAll("button")).find(
      b => b.textContent.includes("Generate & save quote")
    )
    expect(saveBtn).toBeTruthy()

    // Click save
    await act(async () => {
      saveBtn.click()
    })

    // Button re-enables and error message is displayed
    expect(container.textContent).toContain("Plan limit reached. Upgrade to generate quotes.")
    expect(saveBtn.disabled).toBe(false)
    expect(saveBtn.getAttribute("data-loading")).toBe("false")

    // The user's input was NOT cleared and is still intact
    const clientInput = container.querySelector("div[data-testid='field-Client Name *'] input")
    expect(clientInput.value).toBe("Adeola Balogun")

    // Now user fixes / retries, and this time save succeeds
    dataLib.saveQuotes.mockResolvedValueOnce(true)
    await act(async () => {
      saveBtn.click()
    })

    expect(dataLib.saveQuotes).toHaveBeenCalledTimes(2)
    expect(container.textContent).toContain("Quote saved for Adeola Balogun!")
  })
})
