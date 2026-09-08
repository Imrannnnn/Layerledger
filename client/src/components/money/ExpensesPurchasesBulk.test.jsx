global.IS_REACT_ACT_ENVIRONMENT = true

import React from "react"
import { createRoot } from "react-dom/client"
import { act } from "react"
import { Expenses } from "./Expenses"
import { Purchases } from "./Purchases"
import * as dataLib from "../../lib/data"

// Mock the data library
jest.mock("../../lib/data", () => ({
  saveInventory: jest.fn().mockResolvedValue(true),
  saveExpenses: jest.fn().mockResolvedValue(true),
  savePurchases: jest.fn().mockResolvedValue(true),
  fetchPaginatedPurchases: jest.fn(),
  saveLocal: jest.fn().mockResolvedValue(true),
  loadLocal: jest.fn().mockImplementation((key, fallback) => fallback)
}))

// Mock UI components
jest.mock("../common/ui.jsx", () => {
  const React = require("react")
  return {
    Btn: ({ children, onClick, disabled, loading, loadingText }) => (
      <button onClick={onClick} disabled={disabled || loading}>
        {loadingText && loading ? loadingText : children}
      </button>
    ),
    Inp: ({ label, value, onChange, type }) => (
      <div>
        <label>{label}</label>
        <input
          data-testid={`inp-${label}`}
          type={type}
          value={value || ""}
          onChange={e => onChange(e.target.value)}
        />
      </div>
    ),
    Sel: ({ label, value, onChange, options }) => (
      <div>
        <label>{label}</label>
        <select
          data-testid={`sel-${label}`}
          value={value || ""}
          onChange={e => onChange(e.target.value)}
        >
          <option value="">Select</option>
          {options.map(o => (
            <option key={o.value || o} value={o.value || o}>
              {o.label || o}
            </option>
          ))}
        </select>
      </div>
    ),
    Card: ({ children, style }) => <div className="card" style={style}>{children}</div>,
    Badge: ({ children }) => <span className="badge">{children}</span>,
    SHead: ({ title, sub }) => <div className="shead"><h2>{title}</h2><p>{sub}</p></div>,
    Tabs: ({ tabs, active, onChange }) => (
      <div>
        {tabs.map(t => (
          <button key={t.v || t} onClick={() => onChange(t.v || t)}>{t.l || t}</button>
        ))}
      </div>
    ),
    TH: ({ cols }) => <thead><tr>{cols.map((c, idx) => <th key={idx}>{c}</th>)}</tr></thead>,
    TR2: ({ row, i }) => <tr>{row.map((c, idx) => <td key={idx}>{c}</td>)}</tr>,
    Spinner: () => <div>Loading...</div>,
    Pagination: ({ currentPage, totalItems, onPageChange }) => (
      <div data-testid="pagination">
        Page {currentPage} of {totalItems}
        <button data-testid="purchases-page-2" onClick={() => onPageChange && onPageChange(2)}>Page 2</button>
      </div>
    )
  }
})

// Mock helpers
jest.mock("../../lib/helpers.js", () => {
  const actual = jest.requireActual("../../lib/helpers.js")
  return {
    ...actual,
    fmt: val => `₦${val}`,
    uid: () => "test-uid",
    today: () => "2026-08-26",
    DEFAULT_CATEGORIES: [
      "Dry Goods",
      "Dairy and Fats",
      "Flavours and Extracts",
      "Edible Items",
      "Decoration Extras",
      "Board and Packaging",
      "Other"
    ],
    mapCategory: (cat, name = "") => cat || "Other"
  }
})

// Helper to simulate text input in React 18
const typeIntoInput = (input, value) => {
  const lastValue = input.value
  input.value = value
  const tracker = input._valueTracker
  if (tracker) {
    tracker.setValue(lastValue)
  }
  input.dispatchEvent(new Event("change", { bubbles: true }))
}

// Helper to simulate select dropdown change in React 18
const selectOption = (select, value) => {
  const lastValue = select.value
  select.value = value
  const tracker = select._valueTracker
  if (tracker) {
    tracker.setValue(lastValue)
  }
  select.dispatchEvent(new Event("change", { bubbles: true }))
}

describe("Expenses and Purchases Bulk / Batch Operations", () => {
  let container = null
  let root = null

  beforeEach(() => {
    container = document.createElement("div")
    document.body.appendChild(container)
    jest.clearAllMocks()
    window.confirm = () => true // stub window.confirm
    window.alert = jest.fn()    // stub window.alert
  })

  afterEach(() => {
    if (root) {
      act(() => {
        root.unmount()
      })
      root = null
    }
    if (container) {
      container.remove()
      container = null
    }
  })

  it("should log multiple manual expenses at once", async () => {
    const mockExpenses = []
    const mockSetExpenses = jest.fn()

    await act(async () => {
      root = createRoot(container)
      root.render(
        <Expenses
          expenses={mockExpenses}
          setExpenses={mockSetExpenses}
          isOwner={true}
        />
      )
    })

    // Click "+ Add Cash Expense" to open the form
    const addBtn = Array.from(container.querySelectorAll("button")).find(
      el => el.textContent.includes("Add Cash Expense")
    )
    await act(async () => {
      addBtn.click()
    })

    // Add another draft row
    const addAnotherBtn = Array.from(container.querySelectorAll("button")).find(
      el => el.textContent.includes("Add Another Entry")
    )
    await act(async () => {
      addAnotherBtn.click()
    })

    // Fill in values for both rows
    const descInputs = container.querySelectorAll("input[data-testid='inp-Description *']")
    const amountInputs = container.querySelectorAll("input[data-testid='inp-Amount (₦) *']")

    expect(descInputs.length).toBe(2)
    expect(amountInputs.length).toBe(2)

    await act(async () => {
      typeIntoInput(descInputs[0], "Electricity")
      typeIntoInput(amountInputs[0], "10000")
      typeIntoInput(descInputs[1], "Water bill")
      typeIntoInput(amountInputs[1], "5000")
    })

    // Click save
    const saveBtn = Array.from(container.querySelectorAll("button")).find(
      el => el.textContent.includes("Save 2 Expenses")
    )
    await act(async () => {
      saveBtn.click()
    })

    expect(mockSetExpenses).toHaveBeenCalledWith([
      {
        date: "2026-08-26",
        description: "Electricity",
        amount: 10000,
        category: "Utilities",
        paymentMethod: "cash",
        notes: "",
        id: "test-uid",
        source: "manual"
      },
      {
        date: "2026-08-26",
        description: "Water bill",
        amount: 5000,
        category: "Utilities",
        paymentMethod: "cash",
        notes: "",
        id: "test-uid",
        source: "manual"
      }
    ])
    expect(dataLib.saveExpenses).toHaveBeenCalled()
  })

  it("should bulk update categories and bulk delete overhead expenses", async () => {
    const curMonth = new Date().toISOString().slice(0, 7)
    const mockExpenses = [
      { id: "e-1", date: `${curMonth}-10`, description: "Rent", amount: 50000, category: "Utilities", paymentMethod: "cash", source: "manual" },
      { id: "e-2", date: `${curMonth}-11`, description: "Internet", amount: 15000, category: "Utilities", paymentMethod: "cash", source: "manual" }
    ]
    const mockSetExpenses = jest.fn()

    await act(async () => {
      root = createRoot(container)
      root.render(
        <Expenses
          expenses={mockExpenses}
          setExpenses={mockSetExpenses}
          isOwner={true}
        />
      )
    })

    // Check both checkboxes in the table
    const checkboxes = container.querySelectorAll("input[type='checkbox']")
    // checkboxes[0] is select-all in header. Let's click select-all!
    await act(async () => {
      checkboxes[0].click()
    })

    // Verify bulk actions bar has appeared showing "2 expenses selected"
    const textContent = container.textContent
    expect(textContent).toContain("2 expenses selected")

    // Find the category bulk select update dropdown
    const bulkCategorySelect = Array.from(container.querySelectorAll("select")).find(
      s => s.parentElement.textContent.includes("Category:")
    )
    expect(bulkCategorySelect).toBeDefined()

    // Select "Rent"
    await act(async () => {
      selectOption(bulkCategorySelect, "Rent")
    })

    // Verify setExpenses was called with updated categories
    expect(mockSetExpenses).toHaveBeenCalledWith([
      { id: "e-1", date: `${curMonth}-10`, description: "Rent", amount: 50000, category: "Rent", paymentMethod: "cash", source: "manual" },
      { id: "e-2", date: `${curMonth}-11`, description: "Internet", amount: 15000, category: "Rent", paymentMethod: "cash", source: "manual" }
    ])

    // Clean up states and mock bulk delete
    jest.clearAllMocks()
    await act(async () => {
      checkboxes[0].click() // select both again
    })
    const deleteBtn = Array.from(container.querySelectorAll("button")).find(
      el => el.textContent.includes("Delete Selected")
    )
    await act(async () => {
      deleteBtn.click()
    })

    expect(mockSetExpenses).toHaveBeenCalledWith([])
    expect(dataLib.saveExpenses).toHaveBeenCalledWith([])
  })

  it("should batch log ingredient purchases and update stock/cost in inventory", async () => {
    const mockInventory = [
      { id: "i-1", name: "Flour", cat: "Dry Goods", unit: "kg", cost: 1000, stock: 10 },
      { id: "i-2", name: "Butter", cat: "Dairy and Fats", unit: "kg", cost: 2000, stock: 5 }
    ]
    const mockSetInventory = jest.fn()
    const mockExpenses = []
    const mockSetExpenses = jest.fn()

    await act(async () => {
      root = createRoot(container)
      root.render(
        <Purchases
          inventory={mockInventory}
          setInventory={mockSetInventory}
          expenses={mockExpenses}
          setExpenses={mockSetExpenses}
          isOwner={true}
        />
      )
    })

    // Click "+ Log Purchase"
    const logBtn = Array.from(container.querySelectorAll("button")).find(
      el => el.textContent.includes("Log Purchase")
    )
    await act(async () => {
      logBtn.click()
    })

    // Add another draft row
    const addAnotherBtn = Array.from(container.querySelectorAll("button")).find(
      el => el.textContent.includes("Add Another Item")
    )
    await act(async () => {
      addAnotherBtn.click()
    })

    // Select items in dropdowns by index (since they are raw HTML selects)
    const selects = container.querySelectorAll("select")

    expect(selects.length).toBe(4) // 2 rows, each has Item and Category selects

    await act(async () => {
      selectOption(selects[0], "i-1") // Row 1 Item
      selectOption(selects[1], "Dry Goods") // Row 1 Category

      selectOption(selects[2], "i-2") // Row 2 Item
      selectOption(selects[3], "Dairy and Fats") // Row 2 Category
    })

    // Fill in size, qty, and price
    const packInputs = container.querySelectorAll("input[data-testid='inp-Pack size *']")
    const qtyInputs = container.querySelectorAll("input[data-testid='inp-Qty bought *']")
    const priceInputs = container.querySelectorAll("input[data-testid='inp-Price / pack (₦) *']")

    await act(async () => {
      typeIntoInput(packInputs[0], "10")
      typeIntoInput(qtyInputs[0], "2")
      typeIntoInput(priceInputs[0], "12000")

      typeIntoInput(packInputs[1], "5")
      typeIntoInput(qtyInputs[1], "4")
      typeIntoInput(priceInputs[1], "15000")
    })

    // Click Save
    const saveBtn = Array.from(container.querySelectorAll("button")).find(
      el => el.textContent.includes("Update Inventory")
    )
    await act(async () => {
      saveBtn.click()
    })

    // Verify inventory cost and stock was updated
    // Flour: added stock = 10 * 2 = 20. New stock = 30.
    // Cost updating: old total cost = 10 * 1000 = 10000. New cost added = 2 * 12000 = 24000. New cost = 34000 / 30 = 1133.33 average.
    expect(mockSetInventory).toHaveBeenCalledWith([
      { id: "i-1", name: "Flour", cat: "Dry Goods", unit: "kg", cost: 1133.33, stock: 30 },
      { id: "i-2", name: "Butter", cat: "Dairy and Fats", unit: "kg", cost: 2800, stock: 25 }
    ])

    expect(dataLib.saveInventory).toHaveBeenCalled()
    expect(mockSetExpenses).toHaveBeenCalled()
    expect(dataLib.saveExpenses).toHaveBeenCalled()
  })

  it("should select purchases and delete selected items", async () => {
    const curMonth = new Date().toISOString().slice(0, 7)
    const mockInventory = [
      { id: "i-1", name: "Flour", cat: "Dry Goods", unit: "kg", cost: 1000, stock: 10 }
    ]
    const initialPurchases = [
      { id: "p-1", date: `${curMonth}-05`, item: "Flour", itemId: "i-1", category: "Dry Goods", unit: "kg", unitSize: 10, qty: 2, price: 12000, total: 24000, cpu: 1200 },
      { id: "p-2", date: `${curMonth}-06`, item: "Flour", itemId: "i-1", category: "Dry Goods", unit: "kg", unitSize: 10, qty: 1, price: 12000, total: 12000, cpu: 1200 }
    ]
    dataLib.loadLocal.mockImplementation((key, fallback) => {
      if (key === "ll_purchases") return initialPurchases
      return fallback
    })

    await act(async () => {
      root = createRoot(container)
      root.render(
        <Purchases
          inventory={mockInventory}
          setInventory={jest.fn()}
          expenses={[]}
          setExpenses={jest.fn()}
          isOwner={true}
        />
      )
    })

    // Check all purchases using header checkbox
    const checkboxes = container.querySelectorAll("input[type='checkbox']")
    expect(checkboxes.length).toBe(3) // 1 in header, 2 in rows

    await act(async () => {
      checkboxes[0].click() // select all
    })

    // Verify bulk action bar appeared
    expect(container.textContent).toContain("2 purchases selected")

    // Click "Delete Selected"
    const deleteBtn = Array.from(container.querySelectorAll("button")).find(
      el => el.textContent.includes("Delete Selected")
    )
    expect(deleteBtn).toBeDefined()

    await act(async () => {
      deleteBtn.click()
    })

    // Verify saveLocal was called with empty array
    expect(dataLib.saveLocal).toHaveBeenCalledWith("ll_purchases", [])
  })

  it("should show loading indicator and prevent duplicate submissions when Log Purchase is clicked", async () => {
    let resolveSave;
    const pendingPromise = new Promise(resolve => { resolveSave = resolve });
    dataLib.saveInventory.mockReturnValueOnce(pendingPromise);

    const mockInventory = [
      { id: "i-1", name: "Flour", cat: "Dry Goods", unit: "kg", cost: 1000, stock: 10 }
    ]

    await act(async () => {
      root = createRoot(container)
      root.render(
        <Purchases
          inventory={mockInventory}
          setInventory={jest.fn()}
          expenses={[]}
          setExpenses={jest.fn()}
          isOwner={true}
        />
      )
    })

    // Open Add Purchase Form
    const addBtn = Array.from(container.querySelectorAll("button")).find(
      el => el.textContent.includes("+ Log Purchase")
    )
    await act(async () => {
      addBtn.click()
    })

    // Fill form
    const selects = container.querySelectorAll("select")
    const packInput = container.querySelector("input[data-testid='inp-Pack size *']")
    const qtyInput = container.querySelector("input[data-testid='inp-Qty bought *']")
    const priceInput = container.querySelector("input[data-testid='inp-Price / pack (₦) *']")

    await act(async () => {
      selectOption(selects[0], "i-1")
      selectOption(selects[1], "Dry Goods")
      typeIntoInput(packInput, "10")
      typeIntoInput(qtyInput, "2")
      typeIntoInput(priceInput, "12000")
    })

    const saveBtn = Array.from(container.querySelectorAll("button")).find(
      el => el.textContent.includes("Update Inventory")
    )
    expect(saveBtn).toBeDefined()

    // First click triggers loading
    act(() => {
      saveBtn.click()
    })

    // Verify button shows loading state and is disabled
    expect(saveBtn.disabled).toBe(true)
    expect(saveBtn.textContent).toContain("Saving & Updating Inventory...")

    // Second click while loading should be ignored
    act(() => {
      saveBtn.click()
    })

    // Only 1 saveInventory call should have occurred
    expect(dataLib.saveInventory).toHaveBeenCalledTimes(1)

    // Complete the async operation
    await act(async () => {
      resolveSave()
    })
  })

  test("Purchases: true server-side pagination requests page 2 from server", async () => {
    dataLib.fetchPaginatedPurchases.mockResolvedValue({
      data: [
        { id: "pur-page-2", date: "2026-08-20", item: "Flour 50kg", total: 45000, qty: 1 }
      ],
      pagination: { page: 2, limit: 25, total: 30, totalPages: 2 },
      stats: { totalSpent: 45000, totalPurchases: 30 }
    })

    await act(async () => {
      root = createRoot(container)
      root.render(
        <Purchases
          inventory={[]}
          setInventory={jest.fn()}
          expenses={[]}
          setExpenses={jest.fn()}
          isOwner={true}
        />
      )
    })

    const p2Btn = container.querySelector('[data-testid="purchases-page-2"]')
    expect(p2Btn).toBeDefined()

    await act(async () => {
      p2Btn.click()
    })

    expect(dataLib.fetchPaginatedPurchases).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 2,
        limit: 25
      })
    )
  })
})
