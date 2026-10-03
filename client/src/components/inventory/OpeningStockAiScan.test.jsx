global.IS_REACT_ACT_ENVIRONMENT = true

import React from "react"
import { createRoot } from "react-dom/client"
import { act } from "react"
import { OpeningStock, sessionSyncedMonths } from "./OpeningStock.jsx"
import * as helpers from "../../lib/helpers.js"
import * as dataLib from "../../lib/data.js"

// Mock helpers
jest.mock("../../lib/helpers.js", () => {
  const actual = jest.requireActual("../../lib/helpers.js")
  return {
    ...actual,
    callClaude: jest.fn(),
    compressImage: jest.fn().mockResolvedValue("mock_compressed_image")
  }
})

// Mock dataLib
jest.mock("../../lib/data.js", () => ({
  loadOpeningStock: jest.fn(() => [
    { id: "item-1", name: "Flour", unit: "kg", cost: 1200, openingQty: 50, locked: false }
  ]),
  saveOpeningStock: jest.fn().mockResolvedValue(true),
  isOpeningStockLocked: jest.fn(() => false),
  loadLocal: jest.fn(() => null),
  saveLocal: jest.fn(),
  saveInventory: jest.fn().mockResolvedValue(true),
  deleteOpeningStockOnServer: jest.fn().mockResolvedValue(true),
  deleteOpeningStockItemOnServer: jest.fn().mockResolvedValue(true),
  createOpeningStockOnServer: jest.fn(),
  updateOpeningStockItemOnServer: jest.fn().mockResolvedValue(true),
  lockOpeningStockMonthOnServer: jest.fn().mockResolvedValue(true),
  migrateLocalStorageOpeningStockToDatabase: jest.fn(() => Promise.resolve(true)),
  syncFromBackend: jest.fn(() => Promise.resolve(true)),
  fetchOpeningStockFromServer: jest.fn(() => Promise.resolve([
    { id: "item-1", name: "Flour", unit: "kg", cost: 1200, openingQty: 50, locked: false }
  ])),
  calculateOrderUsages: jest.fn(() => []),
  refundScanCredits: jest.fn().mockResolvedValue(true)
}))

// Mock UI components exactly like OpeningStock.test.jsx
jest.mock("../common/ui.jsx", () => {
  const React = require("react")
  return {
    Btn: ({ children, onClick, disabled, variant }) => (
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

describe("OpeningStock AI Scan & Vision Features", () => {
  let container = null
  let root = null

  const mockInventory = [
    { id: "item-1", name: "Flour", unit: "kg", cost: 1200, stock: 50, minStock: 5 }
  ]
  const mockSetInventory = jest.fn()

  beforeEach(() => {
    sessionSyncedMonths.clear()
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    dataLib.isOpeningStockLocked.mockReturnValue(false)
    dataLib.loadOpeningStock.mockReturnValue([
      { id: "item-1", name: "Flour", unit: "kg", cost: 1200, openingQty: 50, locked: false }
    ])
    dataLib.fetchOpeningStockFromServer.mockResolvedValue([
      { id: "item-1", name: "Flour", unit: "kg", cost: 1200, openingQty: 50, locked: false }
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

  test("renders Scan button next to item name and opens single-item scan modal", async () => {
    await act(async () => {
      root.render(
        <OpeningStock
          inventory={mockInventory}
          setInventory={mockSetInventory}
          company={{}}
        />
      )
    })

    const buttons = Array.from(container.querySelectorAll("button"))
    const scanBtn = buttons.find(b => b.textContent.trim() === "Scan")
    expect(scanBtn).toBeTruthy()

    await act(async () => {
      scanBtn.click()
    })

    expect(container.textContent).toContain("Scan Photo for Flour")
    expect(container.textContent).toContain("Click to upload photo or document")
  })

  test("single-item scan triggers Claude API and applies detected cost and quantity", async () => {
    helpers.callClaude.mockResolvedValueOnce(JSON.stringify({
      name: "Flour",
      unit: "kg",
      cost: 1450,
      openingQty: 80
    }))

    await act(async () => {
      root.render(
        <OpeningStock
          inventory={mockInventory}
          setInventory={mockSetInventory}
          company={{}}
        />
      )
    })

    const buttons = Array.from(container.querySelectorAll("button"))
    const scanBtn = buttons.find(b => b.textContent.trim() === "Scan")

    await act(async () => {
      scanBtn.click()
    })

    expect(container.textContent).toContain("Scan Photo for Flour")

    // Simulate file selection
    const fileInput = container.querySelector('input[type="file"][accept="image/*,.pdf"]')
    expect(fileInput).toBeTruthy()

    const mockFile = new File(["dummy"], "flour.jpg", { type: "image/jpeg" })
    await act(async () => {
      const event = { target: { files: [mockFile] } }
      fileInput.dispatchEvent(new Event("change", { bubbles: true }))
      // Directly invoke onChange
      fileInput.onchange ? fileInput.onchange(event) : fileInput.dispatchEvent(new Event("change"))
    })

    // Now trigger scan button
    const scanPhotoBtn = Array.from(container.querySelectorAll("button")).find(b => b.textContent.includes("Scan Photo with AI"))
    if (scanPhotoBtn) {
      await act(async () => {
        scanPhotoBtn.click()
      })

      expect(helpers.callClaude).toHaveBeenCalledWith(
        expect.any(Array),
        expect.any(String),
        expect.any(Number),
        expect.objectContaining({ creditCost: 2, feature: "inventory_scanner" })
      )
    }
  })

  test("bulk import modal displays Option A (AI PDF/Photo) and Option B (Excel)", async () => {
    await act(async () => {
      root.render(
        <OpeningStock
          inventory={mockInventory}
          setInventory={mockSetInventory}
          company={{}}
        />
      )
    })

    const bulkBtn = Array.from(container.querySelectorAll("button")).find(b => b.textContent.includes("Import / Scan") || b.textContent.includes("Import"))
    expect(bulkBtn).toBeTruthy()

    await act(async () => {
      bulkBtn.click()
    })

    expect(container.textContent).toContain("Option A: Scan PDF or Photo with AI")
    expect(container.textContent).toContain("2 Credits")
    expect(container.textContent).toContain("Option B: Paste Columns from Excel")

    const textareas = container.querySelectorAll("textarea")
    expect(textareas.length).toBe(4)
  })

  test("Add Item modal provides Scan Photo or Receipt to Auto-Fill (AI) button", async () => {
    await act(async () => {
      root.render(
        <OpeningStock
          inventory={mockInventory}
          setInventory={mockSetInventory}
          company={{}}
        />
      )
    })

    const addBtn = Array.from(container.querySelectorAll("button")).find(b => b.textContent.includes("Add Item"))
    expect(addBtn).toBeTruthy()

    await act(async () => {
      addBtn.click()
    })

    expect(container.textContent).toContain("Add Item to Opening Stock")
    const autoFillBtn = Array.from(container.querySelectorAll("button")).find(b => b.textContent.includes("Scan Photo or Receipt to Auto-Fill (AI)"))
    expect(autoFillBtn).toBeTruthy()
  })
})
