global.IS_REACT_ACT_ENVIRONMENT = true

import React from "react"
import { createRoot } from "react-dom/client"
import { act } from "react"
import { Purchases } from "./Purchases.jsx"
import { ReceiptScanner } from "./ReceiptScanner.jsx"
import * as dataLib from "../../lib/data.js"

// Mock the data library
jest.mock("../../lib/data.js", () => ({
  saveInventory: jest.fn().mockResolvedValue(true),
  saveExpenses: jest.fn().mockResolvedValue(true),
  savePurchases: jest.fn().mockResolvedValue(true),
  fetchPaginatedPurchases: jest.fn(),
  saveLocal: jest.fn().mockResolvedValue(true),
  loadLocal: jest.fn().mockImplementation((key, fallback) => fallback),
  deletePurchaseFromServer: jest.fn().mockResolvedValue(true),
  deletePurchasesFromServer: jest.fn().mockResolvedValue(true),
  loadAliases: jest.fn().mockImplementation((fallback) => fallback || {}),
  saveAliases: jest.fn().mockResolvedValue(true)
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
    )
  }
})

describe("Purchases Month Reflection & Synchronization", () => {
  let container = null
  let root = null

  const mockInventory = [
    { id: "ing-1", name: "Granulated Sugar", cat: "Dry Goods", unit: "kg", cost: 1200, stock: 10 }
  ]
  const mockExpenses = []

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

  test("loads month from sessionStorage when available", async () => {
    sessionStorage.setItem("ll_active_purchases_month", "2024-05")

    dataLib.fetchPaginatedPurchases.mockResolvedValueOnce({
      data: [
        {
          id: "pur-1",
          date: "2024-05-18",
          item: "Granulated Sugar",
          category: "Dry Goods",
          unit: "kg",
          unitSize: 1,
          qty: 2,
          price: 1200,
          total: 2400,
          cpu: 1200,
          itemId: "ing-1"
        }
      ],
      pagination: { total: 1, page: 1, limit: 25, totalPages: 1 },
      stats: { totalSpent: 2400, totalPurchases: 1, availableMonths: ["2024-05"] }
    })

    root = createRoot(container)
    await act(async () => {
      root.render(
        <Purchases
          inventory={mockInventory}
          setInventory={jest.fn()}
          expenses={mockExpenses}
          setExpenses={jest.fn()}
          setView={jest.fn()}
          isOwner={true}
        />
      )
    })

    expect(dataLib.fetchPaginatedPurchases).toHaveBeenCalledWith(
      expect.objectContaining({ month: "2024-05" })
    )

    expect(container.textContent).toContain("Granulated Sugar")
    expect(container.textContent).toContain("18/05/2024")
  })

  test("displays cross-month guidance banner when current month has 0 purchases but other months have data", async () => {
    dataLib.fetchPaginatedPurchases.mockResolvedValueOnce({
      data: [],
      pagination: { total: 0, page: 1, limit: 25, totalPages: 1 },
      stats: { totalSpent: 0, totalPurchases: 0, availableMonths: ["2024-05"] }
    })

    root = createRoot(container)
    await act(async () => {
      root.render(
        <Purchases
          inventory={mockInventory}
          setInventory={jest.fn()}
          expenses={mockExpenses}
          setExpenses={jest.fn()}
          setView={jest.fn()}
          isOwner={true}
        />
      )
    })

    expect(container.textContent).toContain("Recorded purchases exist in:")
    expect(container.textContent).toContain("May 2024")

    // Find and click "View May 2024 →"
    const buttons = Array.from(container.querySelectorAll("button"))
    const jumpBtn = buttons.find(b => b.textContent.includes("View May 2024"))
    expect(jumpBtn).toBeTruthy()

    dataLib.fetchPaginatedPurchases.mockResolvedValueOnce({
      data: [
        {
          id: "pur-1",
          date: "2024-05-18",
          item: "Granulated Sugar",
          category: "Dry Goods",
          unit: "kg",
          unitSize: 1,
          qty: 1,
          price: 1200,
          total: 1200,
          cpu: 1200,
          itemId: "ing-1"
        }
      ],
      pagination: { total: 1, page: 1, limit: 25, totalPages: 1 },
      stats: { totalSpent: 1200, totalPurchases: 1, availableMonths: ["2024-05"] }
    })

    await act(async () => {
      jumpBtn.click()
    })

    expect(dataLib.fetchPaginatedPurchases).toHaveBeenCalledWith(
      expect.objectContaining({ month: "2024-05" })
    )
  })

  test("switches month and reloads when layerledger:purchases-updated event is dispatched", async () => {
    dataLib.fetchPaginatedPurchases.mockResolvedValueOnce({
      data: [],
      pagination: { total: 0, page: 1, limit: 25, totalPages: 1 },
      stats: { totalSpent: 0, totalPurchases: 0, availableMonths: [] }
    })

    root = createRoot(container)
    await act(async () => {
      root.render(
        <Purchases
          inventory={mockInventory}
          setInventory={jest.fn()}
          expenses={mockExpenses}
          setExpenses={jest.fn()}
          setView={jest.fn()}
          isOwner={true}
        />
      )
    })

    dataLib.fetchPaginatedPurchases.mockResolvedValueOnce({
      data: [
        {
          id: "pur-new",
          date: "2024-05-18",
          item: "Granulated Sugar",
          category: "Dry Goods",
          unit: "kg",
          unitSize: 1,
          qty: 1,
          price: 1200,
          total: 1200,
          cpu: 1200,
          itemId: "ing-1"
        }
      ],
      pagination: { total: 1, page: 1, limit: 25, totalPages: 1 },
      stats: { totalSpent: 1200, totalPurchases: 1, availableMonths: ["2024-05"] }
    })

    // Simulate event dispatched from ReceiptScanner
    await act(async () => {
      window.dispatchEvent(
        new CustomEvent("layerledger:purchases-updated", {
          detail: { month: "2024-05", purchases: [] }
        })
      )
    })

    expect(dataLib.fetchPaginatedPurchases).toHaveBeenCalledWith(
      expect.objectContaining({ month: "2024-05" })
    )
  })

  test("ReceiptScanner provides 1-click View in Purchases button and saves active month", async () => {
    const mockSetView = jest.fn()
    const mockSetInventory = jest.fn()
    const mockSetExpenses = jest.fn()

    root = createRoot(container)
    await act(async () => {
      root.render(
        <ReceiptScanner
          inventory={mockInventory}
          setInventory={mockSetInventory}
          expenses={mockExpenses}
          setExpenses={mockSetExpenses}
          setView={mockSetView}
        />
      )
    })

    // Enter manually
    const buttons = Array.from(container.querySelectorAll("button"))
    const manualBtn = buttons.find(b => b.textContent.includes("Enter Manually"))
    expect(manualBtn).toBeTruthy()

    await act(async () => {
      manualBtn.click()
    })

    // Set date to 2024-05-18
    const dateInput = container.querySelector('input[data-testid="inp-Purchase Date"]')
    expect(dateInput).toBeTruthy()
    await act(async () => {
      const lastValue = dateInput.value
      dateInput.value = "2024-05-18"
      const tracker = dateInput._valueTracker
      if (tracker) tracker.setValue(lastValue)
      dateInput.dispatchEvent(new Event("change", { bubbles: true }))
    })

    // Save & Restock
    const allBtns = Array.from(container.querySelectorAll("button"))
    const saveBtn = allBtns.find(b => b.textContent.includes("Save & Restock"))
    expect(saveBtn).toBeTruthy()

    await act(async () => {
      saveBtn.click()
    })

    expect(container.textContent).toContain("Saved! Purchases and stock levels updated for 2024-05")
    expect(sessionStorage.getItem("ll_active_purchases_month")).toBe("2024-05")

    // Click "View in Purchases (2024-05) →"
    const viewBtn = Array.from(container.querySelectorAll("button")).find(b =>
      b.textContent.includes("View in Purchases (2024-05)")
    )
    expect(viewBtn).toBeTruthy()

    await act(async () => {
      viewBtn.click()
    })

    expect(mockSetView).toHaveBeenCalledWith("purchases")
  })
})
