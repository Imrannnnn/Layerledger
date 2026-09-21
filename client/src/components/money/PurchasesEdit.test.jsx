global.IS_REACT_ACT_ENVIRONMENT = true

import React from "react"
import { createRoot } from "react-dom/client"
import { act } from "react"
import { Purchases } from "./Purchases.jsx"
import * as dataLib from "../../lib/data.js"

// Mock the data library
jest.mock("../../lib/data.js", () => ({
  saveInventory: jest.fn().mockResolvedValue(true),
  saveExpenses: jest.fn().mockResolvedValue(true),
  savePurchases: jest.fn().mockResolvedValue(true),
  updatePurchaseOnServer: jest.fn().mockResolvedValue(true),
  fetchPaginatedPurchases: jest.fn(),
  saveLocal: jest.fn().mockResolvedValue(true),
  loadLocal: jest.fn().mockImplementation((key, fallback) => fallback),
  deletePurchaseFromServer: jest.fn().mockResolvedValue(true),
  deletePurchasesFromServer: jest.fn().mockResolvedValue(true),
  clearAllPurchasesFromServer: jest.fn().mockResolvedValue(true),
  loadAliases: jest.fn().mockImplementation((fallback) => fallback || {}),
  saveAliases: jest.fn().mockResolvedValue(true)
}))

// Mock UI components
jest.mock("../common/ui.jsx", () => {
  const React = require("react")
  return {
    Btn: ({ children, onClick, disabled, loading, loadingText, title }) => (
      <button onClick={onClick} disabled={disabled || loading} title={title}>
        {loadingText && loading ? loadingText : children}
      </button>
    ),
    Inp: ({ label, value, onChange, type, placeholder }) => (
      <div>
        <label>{label}</label>
        <input
          data-testid={`inp-${label}`}
          type={type}
          value={value || ""}
          placeholder={placeholder}
          onChange={e => onChange && onChange(e.target.value)}
        />
      </div>
    ),
    Sel: ({ label, value, onChange, options }) => (
      <div>
        <label>{label}</label>
        <select
          data-testid={`sel-${label}`}
          value={value || ""}
          onChange={e => onChange && onChange(e.target.value)}
        >
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
    TH: ({ cols }) => <thead><tr>{cols.map((c, idx) => <th key={idx}>{c}</th>)}</tr></thead>,
    TR2: ({ row, i }) => <tr>{row.map((c, idx) => <td key={idx}>{c}</td>)}</tr>,
    Spinner: () => <div>Loading...</div>,
    Pagination: ({ currentPage, totalItems, onPageChange }) => (
      <div data-testid="pagination">Page {currentPage} of {totalItems}</div>
    ),
    Modal: ({ children, title, onClose }) => (
      <div data-testid="modal">
        <h3>{title}</h3>
        <button data-testid="modal-close" onClick={onClose}>Close</button>
        {children}
      </div>
    )
  }
})

describe("Purchases Edit & Cross-System Synchronization", () => {
  let container = null
  let root = null

  const mockInventory = [
    { id: "i-1", name: "Flour", cat: "Dry Goods", unit: "kg", cost: 1000, stock: 10 },
    { id: "i-2", name: "Sugar", cat: "Dry Goods", unit: "kg", cost: 1500, stock: 5 }
  ]

  beforeEach(() => {
    container = document.createElement("div")
    document.body.appendChild(container)
    jest.clearAllMocks()
    sessionStorage.clear()
    localStorage.clear()
    window.confirm = () => true
    window.alert = jest.fn()
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

  it("should render Edit button for each purchase row when isOwner is true", async () => {
    const curMonth = new Date().toISOString().slice(0, 7)
    const initialPurchases = [
      { id: "p-1", date: `${curMonth}-05`, item: "Flour", itemId: "i-1", category: "Dry Goods", unit: "kg", unitSize: 10, qty: 2, price: 12000, total: 24000, cpu: 1200, stockAdded: 20 }
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

    const editBtn = container.querySelector("button[title='Edit purchase']")
    expect(editBtn).toBeDefined()
    expect(editBtn).not.toBeNull()
  })

  it("should open edit modal with prefilled data when edit button is clicked", async () => {
    const curMonth = new Date().toISOString().slice(0, 7)
    const initialPurchases = [
      { id: "p-1", date: `${curMonth}-05`, item: "Flour", itemId: "i-1", category: "Dry Goods", unit: "kg", unitSize: 10, qty: 2, price: 12000, total: 24000, cpu: 1200, stockAdded: 20, supplier: "Grain Mills" }
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

    const editBtn = container.querySelector("button[title='Edit purchase']")
    await act(async () => {
      editBtn.click()
    })

    // Check that modal opened
    expect(container.textContent).toContain("Edit Purchase Record")
    const itemSelect = container.querySelector("select[data-testid='edit-purchase-item-select']")
    expect(itemSelect.value).toBe("i-1")

    const packInput = container.querySelector("input[data-testid='inp-Pack size *']")
    expect(packInput.value).toBe("10")

    const qtyInput = container.querySelector("input[data-testid='inp-Qty bought *']")
    expect(qtyInput.value).toBe("2")

    const priceInput = container.querySelector("input[data-testid='inp-Price / pack (₦) *']")
    expect(priceInput.value).toBe("12000")
  })

  it("should adjust inventory and expenses when purchase quantity and price are edited", async () => {
    const curMonth = new Date().toISOString().slice(0, 7)
    // Initially: Flour stock was 10kg + 20kg = 30kg. Value = 10,000 + 24,000 = 34,000. Avg cost = 1133.33
    const inventoryWithPurchase = [
      { id: "i-1", name: "Flour", cat: "Dry Goods", unit: "kg", cost: 1133.33, stock: 30 },
      { id: "i-2", name: "Sugar", cat: "Dry Goods", unit: "kg", cost: 1500, stock: 5 }
    ]
    const initialPurchases = [
      { id: "p-1", date: `${curMonth}-05`, item: "Flour", itemId: "i-1", category: "Dry Goods", unit: "kg", unitSize: 10, qty: 2, price: 12000, total: 24000, cpu: 1200, stockAdded: 20 }
    ]
    const initialExpenses = [
      { id: "e-1", purchaseId: "p-1", date: `${curMonth}-05`, description: "Purchase: Flour", amount: 24000, category: "Ingredients / Supplies", source: "purchase" }
    ]

    dataLib.loadLocal.mockImplementation((key, fallback) => {
      if (key === "ll_purchases") return initialPurchases
      return fallback
    })

    const mockSetInventory = jest.fn()
    const mockSetExpenses = jest.fn()

    await act(async () => {
      root = createRoot(container)
      root.render(
        <Purchases
          inventory={inventoryWithPurchase}
          setInventory={mockSetInventory}
          expenses={initialExpenses}
          setExpenses={mockSetExpenses}
          isOwner={true}
        />
      )
    })

    // Open Edit Modal
    const editBtn = container.querySelector("button[title='Edit purchase']")
    await act(async () => {
      editBtn.click()
    })

    // Change qty bought from 2 to 3 (so 3 * 10kg = 30kg, net diff +10kg. Total 3 * 12000 = 36000, net diff +12000)
    const qtyInput = container.querySelector("input[data-testid='inp-Qty bought *']")
    await act(async () => {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
      nativeInputValueSetter.call(qtyInput, "3")
      qtyInput.dispatchEvent(new Event("change", { bubbles: true }))
    })

    // Click "Save Changes & Update Inventory"
    const saveBtn = Array.from(container.querySelectorAll("button")).find(
      el => el.textContent.includes("Save Changes")
    )
    expect(saveBtn).toBeDefined()

    await act(async () => {
      saveBtn.click()
    })

    // Verify inventory update:
    // Old stock = 30. Delta = 30 - 20 = +10 => New stock = 40.
    // Old value = 30 * 1133.33 = 33999.9 => 34000. Delta = 36000 - 24000 = +12000 => New value = 46000.
    // New avg cost = 46000 / 40 = 1150.
    expect(mockSetInventory).toHaveBeenCalledWith([
      { id: "i-1", name: "Flour", cat: "Dry Goods", unit: "kg", cost: 1150, stock: 40 },
      { id: "i-2", name: "Sugar", cat: "Dry Goods", unit: "kg", cost: 1500, stock: 5 }
    ])
    expect(dataLib.saveInventory).toHaveBeenCalled()

    // Verify expense update:
    expect(mockSetExpenses).toHaveBeenCalledWith([
      expect.objectContaining({
        id: "e-1",
        amount: 36000,
        description: "Purchase: Flour"
      })
    ])
    expect(dataLib.saveExpenses).toHaveBeenCalled()

    // Verify server and local purchases updated:
    expect(dataLib.updatePurchaseOnServer).toHaveBeenCalledWith(
      "p-1",
      expect.objectContaining({
        id: "p-1",
        qty: 3,
        total: 36000,
        stockAdded: 30
      })
    )
  })

  it("should adjust inventory correctly when editing purchase changes item from Flour to Sugar", async () => {
    const curMonth = new Date().toISOString().slice(0, 7)
    // Flour had 20kg added (total stock 30, cost 1133.33). Sugar has 5kg @ 1500 = 7500.
    const inventoryWithPurchase = [
      { id: "i-1", name: "Flour", cat: "Dry Goods", unit: "kg", cost: 1133.33, stock: 30 },
      { id: "i-2", name: "Sugar", cat: "Dry Goods", unit: "kg", cost: 1500, stock: 5 }
    ]
    const initialPurchases = [
      { id: "p-1", date: `${curMonth}-05`, item: "Flour", itemId: "i-1", category: "Dry Goods", unit: "kg", unitSize: 10, qty: 2, price: 12000, total: 24000, cpu: 1200, stockAdded: 20 }
    ]
    const initialExpenses = [
      { id: "e-1", purchaseId: "p-1", date: `${curMonth}-05`, description: "Purchase: Flour", amount: 24000, category: "Ingredients / Supplies", source: "purchase" }
    ]

    dataLib.loadLocal.mockImplementation((key, fallback) => {
      if (key === "ll_purchases") return initialPurchases
      return fallback
    })

    const mockSetInventory = jest.fn()
    const mockSetExpenses = jest.fn()

    await act(async () => {
      root = createRoot(container)
      root.render(
        <Purchases
          inventory={inventoryWithPurchase}
          setInventory={mockSetInventory}
          expenses={initialExpenses}
          setExpenses={mockSetExpenses}
          isOwner={true}
        />
      )
    })

    // Open Edit Modal
    const editBtn = container.querySelector("button[title='Edit purchase']")
    await act(async () => {
      editBtn.click()
    })

    // Change selected item from Flour (i-1) to Sugar (i-2)
    const itemSelect = container.querySelector("select[data-testid='edit-purchase-item-select']")
    await act(async () => {
      itemSelect.value = "i-2"
      itemSelect.dispatchEvent(new Event("change", { bubbles: true }))
    })

    // Change Pack size to 5, Qty to 2, Price to 7500 (so Sugar added = 10kg, total = 15,000)
    const packInput = container.querySelector("input[data-testid='inp-Pack size *']")
    const qtyInput = container.querySelector("input[data-testid='inp-Qty bought *']")
    const priceInput = container.querySelector("input[data-testid='inp-Price / pack (₦) *']")

    await act(async () => {
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
      nativeSetter.call(packInput, "5")
      packInput.dispatchEvent(new Event("change", { bubbles: true }))
      nativeSetter.call(qtyInput, "2")
      qtyInput.dispatchEvent(new Event("change", { bubbles: true }))
      nativeSetter.call(priceInput, "7500")
      priceInput.dispatchEvent(new Event("change", { bubbles: true }))
    })

    // Save
    const saveBtn = Array.from(container.querySelectorAll("button")).find(
      el => el.textContent.includes("Save Changes")
    )
    await act(async () => {
      saveBtn.click()
    })

    // Flour stock was reverted by 20kg: 30 - 20 = 10kg.
    // Sugar stock was increased by 10kg: 5 + 10 = 15kg.
    // Sugar value: 5 * 1500 (7500) + 15000 = 22500. Sugar avg cost = 22500 / 15 = 1500.
    expect(mockSetInventory).toHaveBeenCalledWith([
      expect.objectContaining({ id: "i-1", stock: 10 }),
      expect.objectContaining({ id: "i-2", stock: 15, cost: 1500 })
    ])

    // Expense description updated to "Purchase: Sugar", amount to 15000
    expect(mockSetExpenses).toHaveBeenCalledWith([
      expect.objectContaining({
        id: "e-1",
        amount: 15000,
        description: "Purchase: Sugar"
      })
    ])
  })
})
