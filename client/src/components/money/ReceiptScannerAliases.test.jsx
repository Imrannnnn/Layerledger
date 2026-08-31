global.IS_REACT_ACT_ENVIRONMENT = true

import React from "react"
import { createRoot } from "react-dom/client"
import { act } from "react"
import { ReceiptScanner } from "./ReceiptScanner"
import * as dataLib from "../../lib/data"

// Mock the data library
jest.mock("../../lib/data", () => ({
  saveInventory: jest.fn().mockResolvedValue(true),
  saveExpenses: jest.fn().mockResolvedValue(true),
  saveLocal: jest.fn().mockResolvedValue(true),
  loadLocal: jest.fn().mockImplementation((key, fallback) => fallback),
  loadAliases: jest.fn(() => ({})),
  saveAliases: jest.fn().mockResolvedValue(true)
}))

// Mock UI components
jest.mock("../common/ui.jsx", () => {
  const React = require("react")
  return {
    Btn: ({ children, onClick, disabled, loading, loadingText }) => (
      <button data-testid="btn" onClick={onClick} disabled={disabled || loading}>
        {loading ? (loadingText || children) : children}
      </button>
    ),
    Inp: ({ label, value, onChange }) => (
      <div>
        <label>{label}</label>
        <input data-testid={`inp-${label}`} value={value || ""} onChange={e => onChange(e.target.value)} />
      </div>
    ),
    Sel: ({ label, value, onChange, options }) => (
      <div>
        <label>{label}</label>
        <select data-testid={`sel-${label}`} value={value || ""} onChange={e => onChange(e.target.value)}>
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
    ),
    Card: ({ children }) => <div className="card">{children}</div>,
    Badge: ({ children }) => <span className="badge">{children}</span>,
    SHead: ({ title, sub }) => <div className="shead"><h2>{title}</h2><p>{sub}</p></div>,
    Modal: ({ children, title, onClose }) => (
      <div className="modal">
        <h3>{title}</h3>
        <button onClick={onClose}>Close</button>
        {children}
      </div>
    ),
    Pagination: ({ currentPage, totalItems }) => <div data-testid="pagination">Page {currentPage} of {totalItems}</div>,
    useToast: () => jest.fn(),
    useAsyncAction: (asyncFn, options = {}) => {
      const [status, setStatus] = React.useState("idle")
      const [error, setError] = React.useState(null)
      const execute = React.useCallback(async (...args) => {
        try {
          setStatus("loading")
          setError(null)
          const res = await asyncFn(...args)
          setStatus("success")
          if (options.onSuccess) options.onSuccess(res)
          return res
        } catch (err) {
          setStatus("error")
          setError(err.message)
          if (options.onError) options.onError(err)
          throw err
        }
      }, [asyncFn, options])
      return {
        execute,
        status,
        loading: status === "loading",
        success: status === "success",
        error: status === "error",
        errorMsg: error,
        setStatus
      }
    }
  }
})

// Mock helpers
jest.mock("../../lib/helpers.js", () => ({
  fmt: val => val,
  uid: () => "test-uid",
  today: () => "2026-08-17",
  callClaude: jest.fn(),
  compressImage: jest.fn(img => Promise.resolve(img))
}))

// Helper to simulate input change in React 16+ / React 18
const typeIntoInput = (input, value) => {
  const lastValue = input.value
  input.value = value
  const tracker = input._valueTracker
  if (tracker) {
    tracker.setValue(lastValue)
  }
  input.dispatchEvent(new Event("change", { bubbles: true }))
}

// Helper to simulate select dropdown change in React 16+ / React 18
const selectOption = (select, value) => {
  const lastValue = select.value
  select.value = value
  const tracker = select._valueTracker
  if (tracker) {
    tracker.setValue(lastValue)
  }
  select.dispatchEvent(new Event("change", { bubbles: true }))
}

describe("ReceiptScanner Alias System", () => {
  let container = null
  let root = null

  const mockInventory = [
    { id: "ing-1", name: "Vegetable Oil", cat: "Dry Goods", unit: "L", cost: 1000, stock: 10, minStock: 2 }
  ]
  const mockSetInventory = jest.fn()
  const mockExpenses = []
  const mockSetExpenses = jest.fn()

  beforeEach(() => {
    container = document.createElement("div")
    document.body.appendChild(container)
    jest.clearAllMocks()
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

  it("should load aliases on mount", async () => {
    const mockAliases = { "mamador": "ing-1" }
    dataLib.loadAliases.mockReturnValue(mockAliases)

    await act(async () => {
      root = createRoot(container)
      root.render(
        <ReceiptScanner
          inventory={mockInventory}
          setInventory={mockSetInventory}
          expenses={mockExpenses}
          setExpenses={mockSetExpenses}
        />
      )
    })

    expect(dataLib.loadAliases).toHaveBeenCalled()
  })

  it("should auto-link ingredient when manually entering an item name that matches a saved alias", async () => {
    const mockAliases = { "mamador": "ing-1" }
    dataLib.loadAliases.mockReturnValue(mockAliases)

    await act(async () => {
      root = createRoot(container)
      root.render(
        <ReceiptScanner
          inventory={mockInventory}
          setInventory={mockSetInventory}
          expenses={mockExpenses}
          setExpenses={mockSetExpenses}
        />
      )
    })

    // Click manual entry button
    const manualBtn = Array.from(container.querySelectorAll("button")).find(
      el => el.textContent.includes("Enter Manually")
    )
    expect(manualBtn).toBeDefined()

    await act(async () => {
      manualBtn.click()
    })

    // Type "Mamador" in item text field
    const nameInput = container.querySelector('input[placeholder="Item name..."]')
    expect(nameInput).toBeDefined()

    await act(async () => {
      typeIntoInput(nameInput, "Mamador")
    })

    // Wait for the dropdown match
    const selects = container.querySelectorAll("select")
    const dropdown = selects[1]
    expect(dropdown.value).toBe("ing-1")
  })

  it("should save a new alias when manual mapping is saved", async () => {
    dataLib.loadAliases.mockReturnValue({})

    await act(async () => {
      root = createRoot(container)
      root.render(
        <ReceiptScanner
          inventory={mockInventory}
          setInventory={mockSetInventory}
          expenses={mockExpenses}
          setExpenses={mockSetExpenses}
        />
      )
    })

    // Start manual entry
    const manualBtn = Array.from(container.querySelectorAll("button")).find(
      el => el.textContent.includes("Enter Manually")
    )
    await act(async () => {
      manualBtn.click()
    })

    // Set name
    const nameInput = container.querySelector('input[placeholder="Item name..."]')
    await act(async () => {
      typeIntoInput(nameInput, "Mamador")
    })

    // Select match
    const selects = container.querySelectorAll("select")
    const dropdown = selects[1]
    await act(async () => {
      selectOption(dropdown, "ing-1")
    })

    // Click Save & Restock
    const saveBtn = Array.from(container.querySelectorAll("button")).find(
      el => el.textContent.includes("Save & Restock")
    )
    expect(saveBtn).toBeDefined()

    await act(async () => {
      saveBtn.click()
    })

    // Verify alias was saved
    expect(dataLib.saveAliases).toHaveBeenCalledWith({ "mamador": "ing-1" })
  })

  it("should ignore alias mapping if matched inventory item has been deleted", async () => {
    // Alias points to "ing-deleted", which is NOT in mockInventory
    const mockAliases = { "deleted-item": "ing-deleted" }
    dataLib.loadAliases.mockReturnValue(mockAliases)

    await act(async () => {
      root = createRoot(container)
      root.render(
        <ReceiptScanner
          inventory={mockInventory}
          setInventory={mockSetInventory}
          expenses={mockExpenses}
          setExpenses={mockSetExpenses}
        />
      )
    })

    // Start manual entry
    const manualBtn = Array.from(container.querySelectorAll("button")).find(
      el => el.textContent.includes("Enter Manually")
    )
    await act(async () => {
      manualBtn.click()
    })

    // Set name to "deleted-item"
    const nameInput = container.querySelector('input[placeholder="Item name..."]')
    await act(async () => {
      typeIntoInput(nameInput, "deleted-item")
    })

    // Should stay empty because "ing-deleted" is not in inventory list
    const selects = container.querySelectorAll("select")
    const dropdown = selects[1]
    expect(dropdown.value).toBe("")
  })

  it("should allow linking item as an expense and logging to the correct expense category", async () => {
    dataLib.loadAliases.mockReturnValue({})

    await act(async () => {
      root = createRoot(container)
      root.render(
        <ReceiptScanner
          inventory={mockInventory}
          setInventory={mockSetInventory}
          expenses={mockExpenses}
          setExpenses={mockSetExpenses}
        />
      )
    })

    // Start manual entry
    const manualBtn = Array.from(container.querySelectorAll("button")).find(
      el => el.textContent.includes("Enter Manually")
    )
    await act(async () => {
      manualBtn.click()
    })

    // Set item name
    const nameInput = container.querySelector('input[placeholder="Item name..."]')
    await act(async () => {
      typeIntoInput(nameInput, "Delivery Fee")
    })

    // Change type dropdown from "purchase" to "expense"
    const selects = container.querySelectorAll("select")
    const typeSelect = selects[0]
    await act(async () => {
      selectOption(typeSelect, "expense")
    })

    // Expect the second select to show expense categories. Set it to "Delivery"
    const updatedSelects = container.querySelectorAll("select")
    const categorySelect = updatedSelects[1]
    await act(async () => {
      selectOption(categorySelect, "Delivery")
    })

    // Fill in cost
    const numberInputs = container.querySelectorAll('input[type="number"]')
    await act(async () => {
      typeIntoInput(numberInputs[2], "2500") // unit_price input
    })

    // Click Save & Restock
    const saveBtn = Array.from(container.querySelectorAll("button")).find(
      el => el.textContent.includes("Save & Restock")
    )
    await act(async () => {
      saveBtn.click()
    })

    // Verify expense was saved with "Delivery" category and amount 2500
    expect(mockSetExpenses).toHaveBeenCalledWith([
      expect.objectContaining({
        description: "Receipt — Delivery",
        amount: 2500,
        category: "Delivery",
        source: "receipt"
      })
    ])

    // Verify inventory set was NOT called
    expect(mockSetInventory).not.toHaveBeenCalled()
  })
})
