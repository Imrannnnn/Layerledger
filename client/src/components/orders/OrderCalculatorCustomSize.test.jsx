global.IS_REACT_ACT_ENVIRONMENT = true

import React from "react"
import { createRoot } from "react-dom/client"
import { act } from "react"
import { OrderCalculator } from "./OrderCalculator.jsx"

// Mock data library
jest.mock("../../lib/data.js", () => ({
  loadCompany: jest.fn(() => ({ name: "BakeWealth", bankName: "GTBank", bankAccount: "0123456789" })),
  loadLocal: jest.fn((key, fallback) => fallback),
  saveLocal: jest.fn().mockResolvedValue(true),
  loadQuotes: jest.fn(() => []),
  saveQuotes: jest.fn().mockResolvedValue(true),
  loadClients: jest.fn(() => []),
  upsertClient: jest.fn().mockResolvedValue(true),
  clearTempCalculatorState: jest.fn(),
  checkPlanLimit: jest.fn(() => ({ exceeded: false })),
  notifyPlanLimitReached: jest.fn()
}))

// Mock UI components
jest.mock("../common/ui.jsx", () => {
  const React = require("react")
  return {
    Btn: ({ children, onClick, disabled, full, variant }) => (
      <button onClick={onClick} disabled={disabled} data-variant={variant}>{children}</button>
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

const typeIntoInput = (input, value) => {
  const lastValue = input.value
  input.value = value
  const tracker = input._valueTracker
  if (tracker) {
    tracker.setValue(lastValue)
  }
  input.dispatchEvent(new Event("change", { bubbles: true }))
}

describe("OrderCalculator Custom Cake Size & Calibration Tests", () => {
  let container, root

  const mockInventory = [
    { id: "i-flour", name: "Flour", cat: "Dry Goods", unit: "kg", cost: 1000, stock: 50 },
    { id: "i-sugar", name: "Sugar", cat: "Dry Goods", unit: "kg", cost: 800, stock: 40 },
    { id: "i-butter", name: "Butter", cat: "Dairy", unit: "kg", cost: 2000, stock: 30 }
  ]

  const mockRecipes = [
    {
      id: "r-vanilla",
      name: "Vanilla Sponge",
      type: "cake_layer",
      cal_grams: 617,
      cal_shape: "round",
      cal_dim_a: 8,
      cal_dim_b: 0,
      cal_height_in: 2,
      trim_pct: 8,
      ing: [
        { iid: "i-flour", qty: 0.5, unit: "kg" },
        { iid: "i-sugar", qty: 0.4, unit: "kg" },
        { iid: "i-butter", qty: 0.3, unit: "kg" }
      ]
    },
    {
      id: "r-bc",
      name: "Buttercream",
      type: "covering",
      can_fill: true,
      can_finish: true,
      fill_rate: 3.0,
      cover_rate: 2.5,
      crumb_rate: 0.5,
      batchWeight: 1000,
      ing: [
        { iid: "i-sugar", qty: 0.8, unit: "kg" },
        { iid: "i-butter", qty: 0.5, unit: "kg" }
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
    sessionStorage.clear()
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

  it("renders cake size as a custom input field rather than a restricted dropdown", async () => {
    sessionStorage.setItem("ll_calc_prefill", JSON.stringify({
      clientName: "Custom Size Test Client",
      items: [
        {
          id: "item-cake-1",
          type: "cake",
          name: "Item 1 — Custom Cake",
          tiers: [
            {
              id: "tier-1",
              size: "8",
              shape: "Round",
              layers: [{ id: "l-1", flavour: "Vanilla Sponge", qty: 1 }],
              coverings: [{ id: "c-1", type: "Buttercream", grams: 400, isManual: false }],
              fillings: [{ id: "f-1", type: "Buttercream", grams: 200, isManual: false }]
            }
          ]
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

    // Cake size should be a custom number input with placeholder "e.g. 8"
    const sizeInput = container.querySelector("input[placeholder='e.g. 8']")
    expect(sizeInput).not.toBeNull()
    expect(sizeInput.value).toBe("8")

    // Preset buttons should also be available for quick 1-click selection
    expect(container.textContent).toContain("Custom size")
    expect(container.textContent).toContain("6″")
    expect(container.textContent).toContain("8″")
    expect(container.textContent).toContain("10″")
  })

  it("automatically recalculates batter, fillings, and coverings when user types a custom cake size", async () => {
    sessionStorage.setItem("ll_calc_prefill", JSON.stringify({
      clientName: "Custom Calibration Client",
      items: [
        {
          id: "item-cake-1",
          type: "cake",
          name: "Item 1 — Custom Cake",
          tiers: [
            {
              id: "tier-1",
              size: "8",
              shape: "Round",
              layers: [{ id: "l-1", flavour: "Vanilla Sponge", qty: 2 }],
              coverings: [{ id: "c-1", type: "Buttercream", grams: 400, isManual: false }],
              fillings: [{ id: "f-1", type: "Buttercream", grams: 200, isManual: false }]
            }
          ]
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

    const sizeInput = container.querySelector("input[placeholder='e.g. 8']")
    expect(sizeInput).not.toBeNull()

    // Notice calibrated indicator is present
    expect(container.textContent).toContain("Calibrated:")

    // Now change custom size to 7 (a size not in previous pricing list or standard preset)
    await act(async () => {
      typeIntoInput(sizeInput, "7")
    })

    expect(sizeInput.value).toBe("7")
    // Should display calculated provenance for 7"
    expect(container.textContent).toContain('Calculated from 7" 2-layer round:')

    // Change custom size to 11
    await act(async () => {
      typeIntoInput(sizeInput, "11")
    })

    expect(sizeInput.value).toBe("11")
    expect(container.textContent).toContain('Calculated from 11" 2-layer round:')
  })
})
