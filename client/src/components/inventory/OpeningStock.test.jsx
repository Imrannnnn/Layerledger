global.IS_REACT_ACT_ENVIRONMENT = true

import React from "react"
import { createRoot } from "react-dom/client"
import { act } from "react"
import { OpeningStock, sessionSyncedMonths } from "./OpeningStock.jsx"
import * as dataLib from "../../lib/data.js"

// Mock dependencies
jest.mock("../../lib/data.js", () => ({
  loadOpeningStock: jest.fn(() => [
    { id: "item-1", name: "Premium Flour", unit: "kg", cost: 1500, openingQty: 50 },
    { id: "item-2", name: "Granulated Sugar", unit: "kg", cost: 2000, openingQty: 30 }
  ]),
  saveOpeningStock: jest.fn(),
  isOpeningStockLocked: jest.fn(() => false),
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
    sessionSyncedMonths.clear()
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    dataLib.isOpeningStockLocked.mockReturnValue(false)
    dataLib.loadOpeningStock.mockReturnValue([
      { id: "item-1", name: "Premium Flour", unit: "kg", cost: 1500, openingQty: 50, locked: false },
      { id: "item-2", name: "Granulated Sugar", unit: "kg", cost: 2000, openingQty: 30, locked: false }
    ])
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

  test("locking stock persists across navigation away and returning", async () => {
    const currentMonthStr = new Date().toISOString().slice(0, 7)
    dataLib.lockOpeningStockMonthOnServer.mockResolvedValue({ locked: true })

    // Step 1: Render OpeningStock initially
    await act(async () => {
      root.render(
        <OpeningStock
          inventory={[]}
          setInventory={jest.fn()}
          user={{ role: "owner" }}
        />
      )
    })

    const lockBtn = Array.from(container.querySelectorAll("button")).find(b => b.textContent.includes("Lock Month"))
    expect(lockBtn).toBeTruthy()

    // Step 2: Lock the month
    await act(async () => {
      lockBtn.click()
    })

    // Once locked, button displays "Unlock"
    expect(container.textContent).toContain("Unlock")

    // Step 3: Navigate away (unmount component)
    await act(async () => {
      root.unmount()
    })
    expect(container.textContent).toBe("")

    // Configure mock to reflect that the data layer persisted locked: true
    dataLib.isOpeningStockLocked.mockReturnValue(true)
    dataLib.loadOpeningStock.mockReturnValue([
      { id: "item-1", name: "Premium Flour", unit: "kg", cost: 1500, openingQty: 50, locked: true },
      { id: "item-2", name: "Granulated Sugar", unit: "kg", cost: 2000, openingQty: 30, locked: true }
    ])

    // Step 4: Return to Opening Stock page (remount component)
    root = createRoot(container)
    await act(async () => {
      root.render(
        <OpeningStock
          inventory={[]}
          setInventory={jest.fn()}
          user={{ role: "owner" }}
        />
      )
    })

    // Returning to Opening Stock MUST preserve the locked state
    expect(container.textContent).toContain("Unlock")
    expect(container.textContent).not.toContain("Lock Month")
    // In locked mode, editable quantity inputs are replaced with read-only static text
    const qtyInputs = container.querySelectorAll('tbody input[type="number"]')
    expect(qtyInputs.length).toBe(0)
    expect(container.textContent).toContain("50 kg")
    expect(container.textContent).toContain("30 kg")
  })

  test("page load / refresh with locked items from server initializes UI as locked", async () => {
    const currentMonthStr = new Date().toISOString().slice(0, 7)
    dataLib.isOpeningStockLocked.mockReturnValue(true)
    dataLib.loadOpeningStock.mockReturnValue([
      { id: "item-1", name: "Premium Flour", unit: "kg", cost: 1500, openingQty: 50, locked: true },
      { id: "item-2", name: "Granulated Sugar", unit: "kg", cost: 2000, openingQty: 30, locked: true }
    ])
    dataLib.fetchOpeningStockFromServer.mockResolvedValue([
      { id: "item-1", name: "Premium Flour", unit: "kg", cost: 1500, openingQty: 50, locked: true },
      { id: "item-2", name: "Granulated Sugar", unit: "kg", cost: 2000, openingQty: 30, locked: true }
    ])

    await act(async () => {
      root.render(
        <OpeningStock
          inventory={[]}
          setInventory={jest.fn()}
          user={{ role: "owner" }}
        />
      )
    })

    // Sourced from database as locked: UI shows "Unlock" and renders read-only text for quantities
    expect(container.textContent).toContain("Unlock")
    const qtyInputs = container.querySelectorAll('tbody input[type="number"]')
    expect(qtyInputs.length).toBe(0)
    expect(container.textContent).toContain("50 kg")
    expect(container.textContent).toContain("30 kg")

    // Clicking Unlock unlocks it
    dataLib.lockOpeningStockMonthOnServer.mockResolvedValue({ locked: false })
    const unlockBtn = Array.from(container.querySelectorAll("button")).find(b => b.textContent.includes("Unlock"))
    expect(unlockBtn).toBeTruthy()

    await act(async () => {
      unlockBtn.click()
    })

    expect(dataLib.lockOpeningStockMonthOnServer).toHaveBeenCalledWith(currentMonthStr, false)
    expect(container.textContent).toContain("Lock Month")
  })

  test("does not show loading spinner again on remount when data is already loaded in session", async () => {
    const inventory = []

    // First mount: fetches and caches
    await act(async () => {
      root.render(
        <OpeningStock
          inventory={inventory}
          setInventory={jest.fn()}
          user={{ role: "owner" }}
        />
      )
    })
    expect(container.textContent).toContain("Premium Flour")
    expect(dataLib.fetchOpeningStockFromServer).toHaveBeenCalledTimes(1)

    // Simulate leaving to another section (unmount)
    await act(async () => {
      root.unmount()
    })
    expect(container.textContent).toBe("")

    // Simulate returning to opening stock (remount)
    dataLib.fetchOpeningStockFromServer.mockClear()
    root = createRoot(container)
    await act(async () => {
      root.render(
        <OpeningStock
          inventory={inventory}
          setInventory={jest.fn()}
          user={{ role: "owner" }}
        />
      )
    })

    // Expect items to render immediately without loading spinner and without extra server fetch
    expect(container.textContent).toContain("Premium Flour")
    expect(container.textContent).not.toContain("Loading opening stock from database...")
    expect(dataLib.fetchOpeningStockFromServer).not.toHaveBeenCalled()
  })

  test("allows clearing out zero in opening stock quantity in table and entering a new number", async () => {
    const changeInput = (input, value) => {
      const lastValue = input.value
      input.value = value
      const tracker = input._valueTracker
      if (tracker) {
        tracker.setValue(lastValue)
      }
      input.dispatchEvent(new Event("change", { bubbles: true }))
    }

    dataLib.loadLocal.mockReturnValue(null)
    dataLib.loadOpeningStock.mockReturnValue([
      { id: "item-zero", name: "Baking Powder", unit: "kg", cost: 1000, openingQty: 0, locked: false }
    ])
    dataLib.fetchOpeningStockFromServer.mockResolvedValue([
      { id: "item-zero", name: "Baking Powder", unit: "kg", cost: 1000, openingQty: 0, locked: false }
    ])

    await act(async () => {
      root.render(
        <OpeningStock
          inventory={[]}
          setInventory={jest.fn()}
          user={{ role: "owner" }}
        />
      )
    })

    const qtyInputs = container.querySelectorAll('tbody input[type="number"]')
    // There are cost and qty inputs; qty input width is 110px
    const qtyInput = Array.from(qtyInputs).find(inp => inp.style.width === "110px")
    expect(qtyInput).toBeTruthy()
    expect(qtyInput.value).toBe("0")

    // User clears out the zero
    await act(async () => {
      qtyInput.focus()
      changeInput(qtyInput, "")
    })

    // Value should be empty string, NOT stuck on zero
    expect(qtyInput.value).toBe("")

    // User types in their desired starting quantity (e.g. 25)
    await act(async () => {
      changeInput(qtyInput, "25")
    })

    expect(qtyInput.value).toBe("25")
    expect(dataLib.saveOpeningStock).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: "item-zero", openingQty: 25 })]),
      expect.any(String),
      expect.any(Boolean)
    )
  })

  test("Add Item modal opening quantity starts empty without a constant zero", async () => {
    const changeInput = (input, value) => {
      const lastValue = input.value
      input.value = value
      const tracker = input._valueTracker
      if (tracker) {
        tracker.setValue(lastValue)
      }
      input.dispatchEvent(new Event("change", { bubbles: true }))
    }

    await act(async () => {
      root.render(
        <OpeningStock
          inventory={[]}
          setInventory={jest.fn()}
          user={{ role: "owner" }}
        />
      )
    })

    const addBtn = Array.from(container.querySelectorAll("button")).find(b => b.textContent.includes("Add Item"))
    await act(async () => {
      addBtn.click()
    })

    const modalQtyInput = container.querySelector('input[placeholder="e.g. 25"]')
    expect(modalQtyInput).toBeTruthy()
    // Should be empty string, not "0"
    expect(modalQtyInput.value).toBe("")

    // Typing a number should not have a leading zero
    await act(async () => {
      changeInput(modalQtyInput, "45")
    })
    expect(modalQtyInput.value).toBe("45")
  })

  test("entering decimal unit quantity (2.5) in opening stock remains 2.5 without approximating", async () => {
    const changeInput = (input, value) => {
      const lastValue = input.value
      input.value = value
      const tracker = input._valueTracker
      if (tracker) {
        tracker.setValue(lastValue)
      }
      input.dispatchEvent(new Event("change", { bubbles: true }))
    }

    dataLib.loadOpeningStock.mockReturnValue([
      { id: "item-dec", name: "Vanilla Extract", unit: "L", cost: 4000, openingQty: 1, locked: false }
    ])
    dataLib.fetchOpeningStockFromServer.mockResolvedValue([
      { id: "item-dec", name: "Vanilla Extract", unit: "L", cost: 4000, openingQty: 1, locked: false }
    ])

    const mockSetInv = jest.fn()
    await act(async () => {
      root.render(
        <OpeningStock
          inventory={[{ id: "item-dec", name: "Vanilla Extract", unit: "L", cost: 4000, stock: 1 }]}
          setInventory={mockSetInv}
          user={{ role: "owner" }}
        />
      )
    })

    const qtyInput = container.querySelector('input[type="number"][value="1"]')
    expect(qtyInput).toBeTruthy()

    // Enter 2.5
    await act(async () => {
      changeInput(qtyInput, "2.5")
    })

    expect(qtyInput.value).toBe("2.5")
    expect(dataLib.saveOpeningStock).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: "item-dec", openingQty: 2.5 })]),
      expect.any(String),
      expect.any(Boolean)
    )

    // Verify inventory feed receives exact 2.5 without approximation
    expect(mockSetInv).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: "item-dec", stock: 2.5 })])
    )

    // Baseline valuation for 2.5 L * 4000 = 10,000
    const valCells = Array.from(container.querySelectorAll("td"))
    const totalValCell = valCells.find(td => td.textContent.includes("₦10,000"))
    expect(totalValCell).toBeTruthy()
  })
})


