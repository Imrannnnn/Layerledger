global.IS_REACT_ACT_ENVIRONMENT = true

import React from "react"
import { createRoot } from "react-dom/client"
import { act } from "react"
import { InventoryTab, PackagingTab } from "./MasterList"
import { Invoices } from "../orders/Invoices"
import * as dataLib from "../../lib/data"

// Mock data library
jest.mock("../../lib/data", () => ({
  saveInventory: jest.fn().mockResolvedValue(true),
  saveRecipes: jest.fn().mockResolvedValue(true),
  saveLocal: jest.fn().mockResolvedValue(true),
  loadLocal: jest.fn().mockImplementation((key, fallback) => fallback),
  batchDeleteInventoryOnServer: jest.fn().mockResolvedValue(true),
  deleteAllInventoryOnServer: jest.fn().mockResolvedValue(true)
}))

// Mock UI components
jest.mock("../common/ui.jsx", () => {
  const React = require("react")
  return {
    Btn: ({ children, onClick, disabled, variant }) => (
      <button onClick={onClick} disabled={disabled} data-variant={variant}>{children}</button>
    ),
    Inp: ({ label, value, onChange, type, placeholder, step, min, max }) => (
      <div>
        <label>{label}</label>
        <input type={type} value={value || ""} onChange={e => onChange(e.target.value)} placeholder={placeholder} step={step} min={min} max={max} />
      </div>
    ),
    Sel: ({ label, value, onChange, options }) => (
      <div>
        <label>{label}</label>
        <select value={value || ""} onChange={e => onChange(e.target.value)}>
          {options.map(o => <option key={o.value || o} value={o.value || o}>{o.label || o}</option>)}
        </select>
      </div>
    ),
    Card: ({ children, style }) => <div className="card" style={style}>{children}</div>,
    Badge: ({ children }) => <span className="badge">{children}</span>,
    SHead: ({ title, sub }) => <div><h2>{title}</h2><p>{sub}</p></div>,
    Tabs: ({ tabs, active, onChange }) => (
      <div>{tabs.map(t => <button key={t.v || t} onClick={() => onChange(t.v || t)}>{t.l || t}</button>)}</div>
    ),
    TH: ({ cols }) => <thead><tr>{cols.map((c, idx) => <th key={idx}>{c}</th>)}</tr></thead>,
    TR2: ({ row }) => <tr>{row.map((c, idx) => <td key={idx}>{c}</td>)}</tr>,
    Spinner: () => <div>Loading...</div>,
    Pagination: ({ currentPage, totalItems }) => <div>Page {currentPage} of {totalItems}</div>
  }
})

describe("Multi-Item Select and Delete Tests", () => {
  let container, root

  beforeEach(() => {
    container = document.createElement("div")
    document.body.appendChild(container)
    window.confirm = jest.fn(() => true)
    window.alert = jest.fn()
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

  it("should select multiple inventory items and bulk delete them", async () => {
    const mockInventory = [
      { id: "i-1", name: "Flour", cat: "Dry Goods", unit: "kg", cost: 1000, stock: 10 },
      { id: "i-2", name: "Sugar", cat: "Dry Goods", unit: "kg", cost: 800, stock: 15 },
      { id: "i-3", name: "Milk", cat: "Dairy and Fats", unit: "L", cost: 1200, stock: 5 }
    ]
    const mockSetInventory = jest.fn()

    await act(async () => {
      root = createRoot(container)
      root.render(
        <InventoryTab
          inventory={mockInventory}
          setInventory={mockSetInventory}
          isOwner={true}
          searchQuery=""
        />
      )
    })

    // Find checkboxes in table
    const checkboxes = container.querySelectorAll("input[type='checkbox']")
    expect(checkboxes.length).toBeGreaterThan(0)

    // Select the category select-all checkbox for Dry Goods (checkboxes[0])
    await act(async () => {
      checkboxes[0].click()
    })

    // Verify bulk action bar appeared with 2 items selected
    expect(container.textContent).toContain("2 items selected")

    // Find Delete Selected button
    const deleteBtn = Array.from(container.querySelectorAll("button")).find(
      el => el.textContent.includes("Delete Selected")
    )
    expect(deleteBtn).toBeDefined()
    expect(deleteBtn.textContent).toContain("(2)")

    // Click Delete Selected
    await act(async () => {
      deleteBtn.click()
    })

    expect(window.confirm).toHaveBeenCalled()
    // Remaining item should only be Milk (i-3)
    expect(mockSetInventory).toHaveBeenCalledWith([
      { id: "i-3", name: "Milk", cat: "Dairy and Fats", unit: "L", cost: 1200, stock: 5 }
    ])
    expect(dataLib.saveInventory).toHaveBeenCalled()
  })

  it("should select packaging items and bulk delete them", async () => {
    const mockInventory = [
      { id: "p-1", name: "Cake Board 8\"", cat: "Board and Packaging", unit: "pcs", cost: 500, stock: 10 },
      { id: "p-2", name: "Box 8\"", cat: "Board and Packaging", unit: "pcs", cost: 700, stock: 12 }
    ]
    const mockSetInventory = jest.fn()

    await act(async () => {
      root = createRoot(container)
      root.render(
        <PackagingTab
          inventory={mockInventory}
          setInventory={mockSetInventory}
          isOwner={true}
          searchQuery=""
        />
      )
    })

    // Check header select all
    const checkboxes = container.querySelectorAll("input[type='checkbox']")
    expect(checkboxes.length).toBe(3) // 1 in header + 2 rows

    await act(async () => {
      checkboxes[0].click() // select all
    })

    expect(container.textContent).toContain("2 packaging items selected")

    const deleteBtn = Array.from(container.querySelectorAll("button")).find(
      el => el.textContent.includes("Delete Selected")
    )
    expect(deleteBtn).toBeDefined()

    await act(async () => {
      deleteBtn.click()
    })

    expect(window.confirm).toHaveBeenCalled()
    expect(mockSetInventory).toHaveBeenCalledWith([])
    expect(dataLib.saveInventory).toHaveBeenCalledWith([])
  })

  it("should select invoices and bulk delete them", async () => {
    const mockInvoices = [
      { id: "INV-001", clientName: "Alice", amount: 25000, status: "paid", date: "2026-09-01" },
      { id: "INV-002", clientName: "Bob", amount: 40000, status: "unpaid", date: "2026-09-02" }
    ]
    dataLib.loadLocal.mockImplementation((key, fallback) => {
      if (key === "ll_quote_invoices") return mockInvoices
      return fallback
    })

    await act(async () => {
      root = createRoot(container)
      root.render(
        <Invoices
          company={{ name: "Bakery" }}
          isOwner={true}
        />
      )
    })

    // Click "Select All" button in toolbar
    const selectAllBtn = Array.from(container.querySelectorAll("button")).find(
      el => el.textContent === "Select All"
    )
    expect(selectAllBtn).toBeDefined()

    await act(async () => {
      selectAllBtn.click()
    })

    expect(container.textContent).toContain("2 invoices selected")

    const deleteBtn = Array.from(container.querySelectorAll("button")).find(
      el => el.textContent.includes("Delete Selected")
    )
    expect(deleteBtn).toBeDefined()

    await act(async () => {
      deleteBtn.click()
    })

    expect(window.confirm).toHaveBeenCalled()
    expect(dataLib.saveLocal).toHaveBeenCalledWith("ll_quote_invoices", [])
  })

  it("should render category filter pills and filter inventory when clicked", async () => {
    const mockInventory = [
      { id: "i-1", name: "Flour", cat: "Dry Goods", unit: "kg", cost: 1000, stock: 10 },
      { id: "i-2", name: "Sugar", cat: "Dry Goods", unit: "kg", cost: 800, stock: 15 },
      { id: "i-3", name: "Milk", cat: "Dairy and Fats", unit: "L", cost: 1200, stock: 5 },
      { id: "i-4", name: "Vanilla Extract", cat: "Flavours and Extracts", unit: "btl", cost: 2500, stock: 3 }
    ]
    const mockSetInventory = jest.fn()

    await act(async () => {
      root = createRoot(container)
      root.render(
        <InventoryTab
          inventory={mockInventory}
          setInventory={mockSetInventory}
          isOwner={true}
          searchQuery=""
        />
      )
    })

    // Category pills should be present
    expect(container.textContent).toContain("All Categories")
    expect(container.textContent).toContain("Dry Goods")
    expect(container.textContent).toContain("Dairy and Fats")
    expect(container.textContent).toContain("Flavours and Extracts")
    // Empty categories such as "Board and Packaging" should not be rendered in the category accordions
    expect(container.textContent).not.toContain("Board and Packaging (0 items)")

    // Initially displays Flour, Sugar, Milk, Vanilla
    expect(container.textContent).toContain("Flour")
    expect(container.textContent).toContain("Milk")

    // Find the "Dairy and Fats" pill button
    const dairyPill = Array.from(container.querySelectorAll("button")).find(
      btn => btn.textContent.includes("Dairy and Fats")
    )
    expect(dairyPill).toBeDefined()

    // Click "Dairy and Fats"
    await act(async () => {
      dairyPill.click()
    })

    // Now only Milk should be displayed in table; Flour and Vanilla should be hidden
    const tableText = container.querySelector("table").textContent
    expect(tableText).toContain("Milk")
    expect(tableText).not.toContain("Flour")
    expect(tableText).not.toContain("Vanilla Extract")

    // Reset button should be visible
    const resetBtn = Array.from(container.querySelectorAll("button")).find(
      btn => btn.textContent.includes("Reset to All Categories")
    )
    expect(resetBtn).toBeDefined()

    // Click Reset
    await act(async () => {
      resetBtn.click()
    })

    // All items should be back
    expect(container.textContent).toContain("Flour")
    expect(container.textContent).toContain("Milk")
    expect(container.textContent).toContain("Vanilla Extract")
  })

  it("should support decimal min alert (minStock) values such as 0.5", async () => {
    const mockInventory = [
      { id: "i-dec-1", name: "Saffron", cat: "Flavours and Extracts", unit: "g", cost: 15000, stock: 0.2, minStock: 0.5 },
      { id: "i-dec-2", name: "Vanilla Extract", cat: "Flavours and Extracts", unit: "L", cost: 25000, stock: 1.2, minStock: 0.5 }
    ]
    const mockSetInventory = jest.fn()

    await act(async () => {
      root = createRoot(container)
      root.render(
        <InventoryTab
          inventory={mockInventory}
          setInventory={mockSetInventory}
          isOwner={true}
          searchQuery=""
        />
      )
    })

    // Both items should show 0.5 as their min alert level
    expect(container.textContent).toContain("0.5 g")
    expect(container.textContent).toContain("0.5 L")

    // Saffron has 0.2 stock with 0.5 minStock -> should trigger Low stock
    expect(container.textContent).toContain("Low stock")

    // Click "+ Add Item"
    const addBtn = Array.from(container.querySelectorAll("button")).find(
      btn => btn.textContent.includes("+ Add Item")
    )
    expect(addBtn).toBeDefined()

    await act(async () => {
      addBtn.click()
    })

    // Verify Min Alert input is available and accepts decimal values
    const minAlertInp = Array.from(container.querySelectorAll("input")).find(
      inp => inp.getAttribute("placeholder") === "e.g. 0.5"
    )
    expect(minAlertInp).toBeDefined()
    expect(minAlertInp.getAttribute("step")).toBe("any")
  })
})


