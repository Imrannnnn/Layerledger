global.IS_REACT_ACT_ENVIRONMENT = true

import React from "react"
import { createRoot } from "react-dom/client"
import { act } from "react"
import { OrderCalculator } from "./OrderCalculator.jsx"
import * as dataLib from "../../lib/data.js"

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

jest.mock("../common/ui.jsx", () => {
  const React = require("react")
  return {
    Btn: ({ children, onClick, disabled, full, variant, loading, loadingText }) => (
      <button onClick={onClick} disabled={disabled || loading} data-variant={variant}>
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

const typeIntoInput = (input, value) => {
  const lastValue = input.value
  input.value = value
  const tracker = input._valueTracker
  if (tracker) {
    tracker.setValue(lastValue)
  }
  input.dispatchEvent(new Event("change", { bubbles: true }))
}

describe("OrderCalculator Portions Path Tests", () => {
  let container, root

  const mockInventory = [
    { id: "i-flour", name: "Flour", unit: "kg", cost: 1000, stock: 50 },
    { id: "i-sugar", name: "Sugar", unit: "kg", cost: 800, stock: 40 }
  ]

  const mockRecipes = [
    {
      id: "r-vanilla",
      name: "Vanilla Sponge",
      type: "cake_layer",
      cal_grams: 617,
      cal_shape: "round",
      cal_dim_a: 9,
      cal_height_in: 2,
      trim_pct: 0.08,
      ing: [{ iid: "i-flour", qty: 0.5, unit: "kg" }]
    },
    {
      id: "r-bc",
      name: "Buttercream",
      type: "covering",
      can_fill: true,
      can_finish: true,
      thick_fill_mm: 4.5,
      thick_finish_mm: 4.9,
      density_g_cm3: 0.90,
      waste_pct: 0.15,
      ing: [{ iid: "i-sugar", qty: 0.8, unit: "kg" }]
    },
    {
      id: "r-donut",
      name: "Glazed Donuts",
      type: "pastry",
      per_batch: 30,
      batchSize: 30,
      ing: [{ iid: "i-flour", qty: 1.0, unit: "kg" }]
    }
  ]

  const mockSettings = {
    profitPct: 40,
    overheadPct: 25,
    accessoryPct: 10
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

  test("can add a Portions item, calculate geometric slab portions, and save quote", async () => {
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

    // Click "+ Add Item"
    const addBtn = Array.from(container.querySelectorAll("button")).find(
      b => b.textContent.includes("Add Item")
    )
    await act(async () => {
      addBtn.click()
    })

    // Click "Portions"
    const portionsBtn = Array.from(container.querySelectorAll("button")).find(
      b => b.textContent.includes("Portions") && b.textContent.includes("Slices")
    )
    expect(portionsBtn).toBeTruthy()

    await act(async () => {
      portionsBtn.click()
    })

    // Portions item appears
    expect(container.textContent).toContain("Item 1 — Portions")
    expect(container.textContent).toContain("Cut from a cake")
    expect(container.textContent).toContain("Counted items")

    // Slab mode display: pan selection, slices a slab gives, slabs to build, pans to bake, batter
    expect(container.textContent).toContain("Slices a slab gives")
    expect(container.textContent).toContain("Slabs to build")
    expect(container.textContent).toContain("Pans to bake")
    expect(container.textContent).toContain("Batter")
    expect(container.textContent).toContain("What it costs you")

    // Fill Client Name and Save Quote
    const clientInput = container.querySelector("div[data-testid='field-Client Name *'] input")
    await act(async () => {
      typeIntoInput(clientInput, "Mr Babatunde")
    })

    const saveBtn = Array.from(container.querySelectorAll("button")).find(
      b => b.textContent.includes("Generate & save quote")
    )
    expect(saveBtn).toBeTruthy()

    await act(async () => {
      saveBtn.click()
    })

    expect(dataLib.saveQuotes).toHaveBeenCalled()
    const savedQuote = dataLib.saveQuotes.mock.calls[0][0][0]
    expect(savedQuote.clientName).toBe("Mr Babatunde")
    expect(savedQuote.productType).toBe("Portions")
    expect(savedQuote.items[0].type).toBe("portions")
    expect(savedQuote.items[0].route).toBe("slab")
  })
})
