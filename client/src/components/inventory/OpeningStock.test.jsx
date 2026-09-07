global.IS_REACT_ACT_ENVIRONMENT = true

import React from "react"
import { createRoot } from "react-dom/client"
import { act } from "react"
import { OpeningStock } from "./OpeningStock.jsx"
import * as dataLib from "../../lib/data.js"

// Mock dependencies
jest.mock("../../lib/data.js", () => ({
  loadOpeningStock: jest.fn(() => [
    { id: "item-1", name: "Premium Flour", unit: "kg", cost: 1500, openingQty: 50 },
    { id: "item-2", name: "Granulated Sugar", unit: "kg", cost: 2000, openingQty: 30 }
  ]),
  saveOpeningStock: jest.fn(),
  loadLocal: jest.fn(() => null),
  saveLocal: jest.fn(),
  saveInventory: jest.fn(),
  deleteOpeningStockOnServer: jest.fn(),
  deleteOpeningStockItemOnServer: jest.fn(),
  createOpeningStockOnServer: jest.fn(),
  updateOpeningStockItemOnServer: jest.fn(),
  lockOpeningStockMonthOnServer: jest.fn(),
  migrateLocalStorageOpeningStockToDatabase: jest.fn(() => Promise.resolve(true)),
  syncFromBackend: jest.fn(() => Promise.resolve(true)),
  fetchOpeningStockFromServer: jest.fn(() => Promise.resolve([
    { id: "item-1", name: "Premium Flour", unit: "kg", cost: 1500, openingQty: 50 },
    { id: "item-2", name: "Granulated Sugar", unit: "kg", cost: 2000, openingQty: 30 }
  ]))
}))

// Mock UI components
jest.mock("../common/ui.jsx", () => {
  const React = require("react")
  return {
    Btn: ({ children, onClick, disabled }) => (
      <button onClick={onClick} disabled={disabled}>{children}</button>
    ),
    Inp: ({ label, value, onChange, placeholder, type }) => (
      <div>
        <label>{label}</label>
        <input
          type={type}
          placeholder={placeholder}
          value={value || ""}
          onChange={e => onChange(e.target.value)}
        />
      </div>
    ),
    Sel: ({ label, value, onChange, options }) => (
      <div>
        <label>{label}</label>
        <select value={value || ""} onChange={e => onChange(e.target.value)}>
          {options.map((opt, i) => (
            <option key={i} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
    ),
    Card: ({ children, style }) => <div style={style}>{children}</div>,
    SHead: ({ title, sub }) => (
      <div>
        <h1>{title}</h1>
        <p>{sub}</p>
      </div>
    ),
    iSt: {},
    TH: ({ cols }) => (
      <thead>
        <tr>{cols.map((c, i) => <th key={i}>{c}</th>)}</tr>
      </thead>
    ),
    Modal: ({ title, onClose, children }) => (
      <div role="dialog">
        <h3>{title}</h3>
        <button onClick={onClose}>Close</button>
        {children}
      </div>
    ),
    Pagination: ({ totalItems }) => <div>Total items: {totalItems}</div>
  }
})

describe("OpeningStock Component Tests", () => {
  let container = null
  let root = null

  beforeEach(() => {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    dataLib.fetchOpeningStockFromServer.mockResolvedValue([
      { id: "item-1", name: "Premium Flour", unit: "kg", cost: 1500, openingQty: 50, locked: false },
      { id: "item-2", name: "Granulated Sugar", unit: "kg", cost: 2000, openingQty: 30, locked: false }
    ])
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    container.remove()
    container = null
    jest.clearAllMocks()
  })

  test("renders Opening Stock Table with header, KPIs, and table data", async () => {
    const inventory = [
      { id: "item-1", name: "Premium Flour", unit: "kg", cost: 1500, stock: 50 },
      { id: "item-2", name: "Granulated Sugar", unit: "kg", cost: 2000, stock: 30 }
    ]

    await act(async () => {
      root.render(
        <OpeningStock
          inventory={inventory}
          setInventory={jest.fn()}
          user={{ role: "owner" }}
        />
      )
    })

    expect(container.textContent).toContain("Opening Stock Table")
    expect(container.textContent).toContain("Total Baseline Valuation")
    expect(container.textContent).not.toContain("Total Line Items")
    expect(container.textContent).not.toContain("Total Baseline Units")
    expect(container.textContent).not.toContain("Period Status")
    expect(container.textContent).toContain("Premium Flour")
    expect(container.textContent).toContain("Granulated Sugar")
    expect(container.textContent).toContain("Add Item")
    expect(container.textContent).toContain("Import Excel")
  })

  test("calculates correct valuation KPI (50*1500 + 30*2000 = 135,000)", async () => {
    const inventory = [
      { id: "item-1", name: "Premium Flour", unit: "kg", cost: 1500, stock: 50 },
      { id: "item-2", name: "Granulated Sugar", unit: "kg", cost: 2000, stock: 30 }
    ]

    await act(async () => {
      root.render(
        <OpeningStock
          inventory={inventory}
          setInventory={jest.fn()}
          user={{ role: "owner" }}
        />
      )
    })

    expect(container.textContent).toContain("135,000")
  })

  test("search filter narrows displayed items", async () => {
    const inventory = [
      { id: "item-1", name: "Premium Flour", unit: "kg", cost: 1500, stock: 50 },
      { id: "item-2", name: "Granulated Sugar", unit: "kg", cost: 2000, stock: 30 }
    ]

    await act(async () => {
      root.render(
        <OpeningStock
          inventory={inventory}
          setInventory={jest.fn()}
          user={{ role: "owner" }}
        />
      )
    })

    const searchInput = container.querySelector('input[placeholder="Search opening stock items..."]')
    expect(searchInput).toBeTruthy()

    await act(async () => {
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
      nativeSetter.call(searchInput, "Flour")
      searchInput.dispatchEvent(new Event("input", { bubbles: true }))
      searchInput.dispatchEvent(new Event("change", { bubbles: true }))
    })

    expect(container.textContent).toContain("Premium Flour")
    expect(container.textContent).not.toContain("Granulated Sugar")
  })

  test("opening Add Item modal works", async () => {
    const inventory = []

    await act(async () => {
      root.render(
        <OpeningStock
          inventory={inventory}
          setInventory={jest.fn()}
          user={{ role: "owner" }}
        />
      )
    })

    const addBtn = Array.from(container.querySelectorAll("button")).find(b => b.textContent.includes("Add Item"))
    expect(addBtn).toBeTruthy()

    await act(async () => {
      addBtn.click()
    })

    expect(container.textContent).toContain("Add Item to Opening Stock")
    expect(container.textContent).toContain("Ingredient / Item Name")
  })

  test("inventory updates do not feed opening stock when opening stock is empty", async () => {
    dataLib.loadLocal.mockReturnValue(null)
    dataLib.loadOpeningStock.mockReturnValue([])
    dataLib.fetchOpeningStockFromServer.mockResolvedValue([])

    const inventory = [
      { id: "inv-99", name: "Cocoa Powder", stock: 85, cost: 3000, unit: "kg" }
    ]

    await act(async () => {
      root.render(
        <OpeningStock
          inventory={inventory}
          setInventory={jest.fn()}
          user={{ role: "owner" }}
        />
      )
    })

    // Opening stock should NOT automatically clone inv-99 stock (85) into opening stock
    expect(container.textContent).toContain("No opening stock items found")
    expect(dataLib.saveOpeningStock).not.toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ openingQty: 85 })]),
      expect.any(String),
      expect.any(Boolean)
    )
  })

  test("deleting an item invokes deleteOpeningStockItemOnServer with the item id", async () => {
    window.confirm = jest.fn(() => true)
    dataLib.deleteOpeningStockItemOnServer.mockResolvedValue(true)

    const inventory = []

    await act(async () => {
      root.render(
        <OpeningStock
          inventory={inventory}
          setInventory={jest.fn()}
          user={{ role: "owner" }}
        />
      )
    })

    const deleteBtn = container.querySelector('button[title="Remove item from opening stock"]')
    expect(deleteBtn).toBeTruthy()

    await act(async () => {
      deleteBtn.click()
    })

    expect(window.confirm).toHaveBeenCalled()
    expect(dataLib.deleteOpeningStockItemOnServer).toHaveBeenCalledWith("item-1")
  })

  test("clicking Lock Month invokes lockOpeningStockMonthOnServer with locked true", async () => {
    dataLib.lockOpeningStockMonthOnServer.mockResolvedValue({ locked: true })

    const inventory = []

    await act(async () => {
      root.render(
        <OpeningStock
          inventory={inventory}
          setInventory={jest.fn()}
          user={{ role: "owner" }}
        />
      )
    })

    const lockBtn = Array.from(container.querySelectorAll("button")).find(b => b.textContent.includes("Lock Month"))
    expect(lockBtn).toBeTruthy()

    await act(async () => {
      lockBtn.click()
    })

    const currentMonthStr = new Date().toISOString().slice(0, 7)
    expect(dataLib.lockOpeningStockMonthOnServer).toHaveBeenCalledWith(currentMonthStr, true)
  })
})

