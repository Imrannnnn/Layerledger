global.IS_REACT_ACT_ENVIRONMENT = true

import React from "react"
import { createRoot } from "react-dom/client"
import { act } from "react"
import {
  ReceiptScanner,
  matchItemToInventory,
  cleanItemText,
  tokenizeItem,
  calculateLevenshteinSimilarity,
  detectUnitAndSize
} from "./ReceiptScanner"
import * as dataLib from "../../lib/data"

// Mock the data library
jest.mock("../../lib/data", () => ({
  saveInventory: jest.fn().mockResolvedValue(true),
  saveExpenses: jest.fn().mockResolvedValue(true),
  savePurchases: jest.fn().mockResolvedValue(true),
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
    )
  }
})

// Mock helpers
jest.mock("../../lib/helpers.js", () => {
  const actual = jest.requireActual("../../lib/helpers.js")
  return {
    ...actual,
    fmt: val => val,
    uid: () => "test-uid",
    today: () => "2026-09-11",
    callClaude: jest.fn(),
    compressImage: jest.fn(img => Promise.resolve(img))
  }
})

const typeIntoInput = (input, value) => {
  const lastValue = input.value
  input.value = value
  const tracker = input._valueTracker
  if (tracker) tracker.setValue(lastValue)
  input.dispatchEvent(new Event("change", { bubbles: true }))
}

const selectOption = (select, value) => {
  const lastValue = select.value
  select.value = value
  const tracker = select._valueTracker
  if (tracker) tracker.setValue(lastValue)
  select.dispatchEvent(new Event("change", { bubbles: true }))
}

describe("ReceiptScanner Intelligent Matching Engine", () => {
  const inventory = [
    { id: "inv-sugar", name: "White Sugar", unit: "kg", stock: 10, cost: 1500 },
    { id: "inv-flour", name: "All-Purpose Flour", unit: "kg", stock: 25, cost: 1200 },
    { id: "inv-cocoa", name: "Cocoa Powder", unit: "kg", stock: 5, cost: 3500 },
    { id: "inv-egg", name: "Egg", unit: "crate", stock: 8, cost: 4500 },
    { id: "inv-oil", name: "Vegetable Oil", unit: "L", stock: 15, cost: 2000 },
    { id: "inv-powder", name: "Baking Powder", unit: "tin", stock: 4, cost: 1800 }
  ]

  describe("matchItemToInventory unit tests", () => {
    test("Rule 1: Exact match (White Sugar -> White Sugar)", () => {
      expect(matchItemToInventory("White Sugar", inventory)).toBe("inv-sugar")
      expect(matchItemToInventory("white sugar", inventory)).toBe("inv-sugar")
      expect(matchItemToInventory("Cocoa Powder", inventory)).toBe("inv-cocoa")
      expect(matchItemToInventory("cocoa powder", inventory)).toBe("inv-cocoa")
    })

    test("Rule 2: Keyword match (Sugar -> White Sugar, Flour -> All-Purpose Flour)", () => {
      expect(matchItemToInventory("Sugar", inventory)).toBe("inv-sugar")
      expect(matchItemToInventory("sugar", inventory)).toBe("inv-sugar")
      expect(matchItemToInventory("Flour", inventory)).toBe("inv-flour")
      expect(matchItemToInventory("flour", inventory)).toBe("inv-flour")
    })

    test("Rule 3: Partial/name similarity and formatting variations", () => {
      // Variation in spacing/hyphenation
      expect(matchItemToInventory("All Purpose Flour", inventory)).toBe("inv-flour")
      // Plural to singular stemming
      expect(matchItemToInventory("Eggs", inventory)).toBe("inv-egg")
      // Minor spelling variation / typo tolerance
      expect(matchItemToInventory("Cocoa Powdr", inventory)).toBe("inv-cocoa")
      // With vendor brand and unit noise on receipt
      expect(matchItemToInventory("Dangote Sugar 50kg", inventory)).toBe("inv-sugar")
    })

    test("Rule 4: Avoid incorrect matches (returns empty string if no confident match)", () => {
      // Unrelated ingredient not in inventory
      expect(matchItemToInventory("Salt", inventory)).toBe("")
      // Overhead expense item
      expect(matchItemToInventory("Diesel", inventory)).toBe("")
      expect(matchItemToInventory("Generator Fuel", inventory)).toBe("")
      // Distinct baking ingredient: Baking Soda must NOT match Baking Powder
      expect(matchItemToInventory("Baking Soda", inventory)).toBe("")
      // Empty or invalid inputs
      expect(matchItemToInventory("", inventory)).toBe("")
      expect(matchItemToInventory(null, inventory)).toBe("")
      expect(matchItemToInventory("Sugar", [])).toBe("")
    })

    test("Alias priority: saved aliases take top priority", () => {
      const aliases = { "mamador": "inv-oil" }
      expect(matchItemToInventory("Mamador", inventory, aliases)).toBe("inv-oil")
    })

    test("Alias ignored if matched inventory item was removed", () => {
      const aliases = { "mamador": "inv-deleted" }
      expect(matchItemToInventory("Mamador", inventory, aliases)).toBe("")
    })
  })

  describe("ReceiptScanner Component Integration", () => {
    let container = null
    let root = null

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

    test("selecting 'Link to Inventory' on a row automatically matches the item to the best inventory item", async () => {
      await act(async () => {
        root = createRoot(container)
        root.render(
          <ReceiptScanner
            inventory={inventory}
            setInventory={jest.fn()}
            expenses={[]}
            setExpenses={jest.fn()}
          />
        )
      })

      // Click manual entry to create an editable parsed state
      const manualBtn = Array.from(container.querySelectorAll("button")).find(
        el => el.textContent.includes("Enter Manually")
      )
      await act(async () => {
        manualBtn.click()
      })

      // Type "Flour" in item text field
      const nameInput = container.querySelector('input[placeholder="Item name..."]')
      await act(async () => {
        typeIntoInput(nameInput, "Flour")
      })

      // First select is Type ("purchase" vs "expense"), second select is Ingredient
      let selects = container.querySelectorAll("select")
      let typeSelect = selects[0]
      let ingredientSelect = selects[1]

      // Change to expense first
      await act(async () => {
        selectOption(typeSelect, "expense")
      })

      // Re-query selects
      selects = container.querySelectorAll("select")
      typeSelect = selects[0]
      expect(typeSelect.value).toBe("expense")

      // Now select "Link to Inventory" (value: "purchase")
      await act(async () => {
        selectOption(typeSelect, "purchase")
      })

      // The moment "Link to Inventory" is selected, Flour should automatically link to All-Purpose Flour (inv-flour)
      selects = container.querySelectorAll("select")
      ingredientSelect = selects[1]
      expect(ingredientSelect.value).toBe("inv-flour")
    })

    test("typing item name automatically matches if type is Link to Inventory", async () => {
      await act(async () => {
        root = createRoot(container)
        root.render(
          <ReceiptScanner
            inventory={inventory}
            setInventory={jest.fn()}
            expenses={[]}
            setExpenses={jest.fn()}
          />
        )
      })

      const manualBtn = Array.from(container.querySelectorAll("button")).find(
        el => el.textContent.includes("Enter Manually")
      )
      await act(async () => {
        manualBtn.click()
      })

      const nameInput = container.querySelector('input[placeholder="Item name..."]')
      await act(async () => {
        typeIntoInput(nameInput, "Sugar")
      })

      const selects = container.querySelectorAll("select")
      const ingredientSelect = selects[1]
      // Automatically linked to White Sugar
      expect(ingredientSelect.value).toBe("inv-sugar")
    })

    test("leaves unmatched items without auto-linking to unrelated items (allows user to Add As New)", async () => {
      await act(async () => {
        root = createRoot(container)
        root.render(
          <ReceiptScanner
            inventory={inventory}
            setInventory={jest.fn()}
            expenses={[]}
            setExpenses={jest.fn()}
          />
        )
      })

      const manualBtn = Array.from(container.querySelectorAll("button")).find(
        el => el.textContent.includes("Enter Manually")
      )
      await act(async () => {
        manualBtn.click()
      })

      const nameInput = container.querySelector('input[placeholder="Item name..."]')
      await act(async () => {
        typeIntoInput(nameInput, "Salt")
      })

      const selects = container.querySelectorAll("select")
      const ingredientSelect = selects[1]
      expect(ingredientSelect.value).toBe("")

      // The "+ Add As New" button should be visible since it's unmatched
      const addAsNewBtn = Array.from(container.querySelectorAll("button")).find(
        el => el.textContent.includes("+ Add As New")
      )
      expect(addAsNewBtn).toBeDefined()
    })

    test("1-click 'Link to Inventory' header button matches all rows at once", async () => {
      await act(async () => {
        root = createRoot(container)
        root.render(
          <ReceiptScanner
            inventory={inventory}
            setInventory={jest.fn()}
            expenses={[]}
            setExpenses={jest.fn()}
          />
        )
      })

      const manualBtn = Array.from(container.querySelectorAll("button")).find(
        el => el.textContent.includes("Enter Manually")
      )
      await act(async () => {
        manualBtn.click()
      })

      // Add a second row
      const addRowBtn = Array.from(container.querySelectorAll("button")).find(
        el => el.textContent.includes("+ Add Row")
      )
      await act(async () => {
        addRowBtn.click()
      })

      const nameInputs = container.querySelectorAll('input[placeholder="Item name..."]')
      await act(async () => {
        typeIntoInput(nameInputs[0], "Sugar")
        typeIntoInput(nameInputs[1], "Cocoa Powder")
      })

      // Click the 1-click "Link to Inventory" button in the header
      const linkHeaderBtn = Array.from(container.querySelectorAll("button")).find(
        el => el.textContent.includes("Link to Inventory")
      )
      expect(linkHeaderBtn).toBeDefined()

      await act(async () => {
        linkHeaderBtn.click()
      })

      const selects = container.querySelectorAll("select")
      // Row 0 ingredient select is at index 1
      expect(selects[1].value).toBe("inv-sugar")
      // Row 1 ingredient select is at index 3
      expect(selects[3].value).toBe("inv-cocoa")
    })

    test("unmatched items display 'New Item (Category: Other)' and '+ Add As New' without prompting to link", async () => {
      await act(async () => {
        root = createRoot(container)
        root.render(
          <ReceiptScanner
            inventory={inventory}
            setInventory={jest.fn()}
            expenses={[]}
            setExpenses={jest.fn()}
          />
        )
      })

      const manualBtn = Array.from(container.querySelectorAll("button")).find(
        el => el.textContent.includes("Enter Manually")
      )
      await act(async () => {
        manualBtn.click()
      })

      const nameInput = container.querySelector('input[placeholder="Item name..."]')
      await act(async () => {
        typeIntoInput(nameInput, "Fondant Ribbon")
      })

      const selects = container.querySelectorAll("select")
      const itemSelect = selects[1]
      expect(itemSelect.value).toBe("")
      // Check the default option text
      const defaultOption = itemSelect.querySelector("option[value='']")
      expect(defaultOption.textContent).toContain("New Item (Category: Other)")

      // "+ Add As New" button is present
      const addAsNewBtn = Array.from(container.querySelectorAll("button")).find(
        el => el.textContent.includes("+ Add As New")
      )
      expect(addAsNewBtn).toBeDefined()
    })

    test("saving unmatched item auto-creates inventory item under 'Other' category and purchases under 'Other', never Miscellaneous", async () => {
      const mockSetInventory = jest.fn()
      const mockSetExpenses = jest.fn()

      await act(async () => {
        root = createRoot(container)
        root.render(
          <ReceiptScanner
            inventory={inventory}
            setInventory={mockSetInventory}
            expenses={[]}
            setExpenses={mockSetExpenses}
          />
        )
      })

      const manualBtn = Array.from(container.querySelectorAll("button")).find(
        el => el.textContent.includes("Enter Manually")
      )
      await act(async () => {
        manualBtn.click()
      })

      // Type an unmatched new item
      const nameInput = container.querySelector('input[placeholder="Item name..."]')
      await act(async () => {
        typeIntoInput(nameInput, "Gold Sparkles")
      })

      // Type price
      const numberInputs = container.querySelectorAll('input[type="number"]')
      await act(async () => {
        typeIntoInput(numberInputs[2], "3000") // unit_price
      })

      // Save & Restock without clicking "+ Add As New"
      const saveBtn = Array.from(container.querySelectorAll("button")).find(
        el => el.textContent.includes("Save & Restock")
      )
      await act(async () => {
        saveBtn.click()
      })

      // Check that inventory was updated with a new item in category "Other"
      expect(mockSetInventory).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            name: "Gold Sparkles",
            cat: "Other"
          })
        ])
      )

      // Check that purchases were saved with category "Other"
      expect(dataLib.savePurchases).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            item: "Gold Sparkles",
            category: "Other"
          })
        ])
      )

      // Check that expenses did NOT receive any item with category "Miscellaneous"
      if (mockSetExpenses.mock.calls.length > 0) {
        const savedExpenses = mockSetExpenses.mock.calls[0][0]
        expect(savedExpenses.some(e => e.category === "Miscellaneous")).toBe(false)
      }
    })
  })

  describe("Unit Detection & Measurement Prioritization", () => {
    let container = null
    let root = null

    beforeEach(() => {
      container = document.createElement("div")
      document.body.appendChild(container)
      jest.clearAllMocks()
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

    test("detects kg and pack size from item description", () => {
      expect(detectUnitAndSize("Sugar 50kg")).toEqual({ unit: "kg", unit_size: 50 })
      expect(detectUnitAndSize("Dangote Flour 25 kg")).toEqual({ unit: "kg", unit_size: 25 })
      expect(detectUnitAndSize("Icing Sugar 1kg")).toEqual({ unit: "kg", unit_size: 1 })
      expect(detectUnitAndSize("Golden Penny Flour 50 KGS")).toEqual({ unit: "kg", unit_size: 50 })
      expect(detectUnitAndSize("Sugar 2.5kg")).toEqual({ unit: "kg", unit_size: 2.5 })
    })

    test("detects g (grams) and pack size from item description", () => {
      expect(detectUnitAndSize("Simas Margarine 250g")).toEqual({ unit: "g", unit_size: 250 })
      expect(detectUnitAndSize("Instant Dry Yeast 500gm")).toEqual({ unit: "g", unit_size: 500 })
      expect(detectUnitAndSize("Cocoa Powder 100 grams")).toEqual({ unit: "g", unit_size: 100 })
      expect(detectUnitAndSize("Baking Powder 500 g")).toEqual({ unit: "g", unit_size: 500 })
    })

    test("detects liquid volume units (l, ml, cl)", () => {
      expect(detectUnitAndSize("Vegetable Oil 5L")).toEqual({ unit: "l", unit_size: 5 })
      expect(detectUnitAndSize("Presco Palm Oil 4 Litres")).toEqual({ unit: "l", unit_size: 4 })
      expect(detectUnitAndSize("Vanilla Flavor 500ml")).toEqual({ unit: "ml", unit_size: 500 })
      expect(detectUnitAndSize("Food Colouring 50cl")).toEqual({ unit: "cl", unit_size: 50 })
    })

    test("detects bakery packaging units (crate, pcs, carton, roll, bottle)", () => {
      expect(detectUnitAndSize("Fresh Eggs 1 crate")).toEqual({ unit: "crate", unit_size: 1 })
      expect(detectUnitAndSize("Cake Board 10 pcs")).toEqual({ unit: "pcs", unit_size: 10 })
      expect(detectUnitAndSize("Margarine 1 carton")).toEqual({ unit: "carton", unit_size: 1 })
      expect(detectUnitAndSize("Parchment Paper 2 rolls")).toEqual({ unit: "roll", unit_size: 1 })
      expect(detectUnitAndSize("Flavouring 1 bottle")).toEqual({ unit: "bottle", unit_size: 1 })
    })

    test("overrides generic packaging units ('bag', 'pack') when measurement unit ('kg', 'g') is detected", () => {
      // If AI scanned unit as 'bag' but text says '50kg', prioritize 'kg' as unit
      expect(detectUnitAndSize("Flour 50kg", "bag", 1)).toEqual({ unit: "kg", unit_size: 50 })
      // If AI scanned unit as 'pack' but text says '250g', prioritize 'g' as unit
      expect(detectUnitAndSize("Butter 250g", "pack", 1)).toEqual({ unit: "g", unit_size: 250 })
    })

    test("normalizes unit variations when text has no unit but existing unit is provided", () => {
      expect(detectUnitAndSize("Sugar", "kilograms", 5)).toEqual({ unit: "kg", unit_size: 5 })
      expect(detectUnitAndSize("Cocoa", "gms", 250)).toEqual({ unit: "g", unit_size: 250 })
      expect(detectUnitAndSize("Milk", "litres", 2)).toEqual({ unit: "l", unit_size: 2 })
      expect(detectUnitAndSize("Extract", "mls", 100)).toEqual({ unit: "ml", unit_size: 100 })
      expect(detectUnitAndSize("Candles", "pieces", 12)).toEqual({ unit: "pcs", unit_size: 12 })
    })

    test("automatically detects kg and updates row unit when user edits item name manually", async () => {
      const mockSetInventory = jest.fn()
      const mockSetExpenses = jest.fn()
      await act(async () => {
        root = createRoot(container)
        root.render(
          <ReceiptScanner
            inventory={inventory}
            setInventory={mockSetInventory}
            expenses={[]}
            setExpenses={mockSetExpenses}
            setView={jest.fn()}
          />
        )
      })

      const manualBtn = Array.from(container.querySelectorAll("button")).find(
        el => el.textContent.includes("Enter Manually")
      )
      await act(async () => {
        manualBtn.click()
      })

      // Type an item containing "50kg"
      const nameInput = container.querySelector('input[placeholder="Item name..."]')
      await act(async () => {
        typeIntoInput(nameInput, "Dangote Sugar 50kg")
      })

      // The row unit should automatically be "kg" and unit_size should be 50
      const unitInput = container.querySelector('input[placeholder="Unit (kg, g, L...)"]')
      expect(unitInput.value).toBe("kg")

      const packSizeInput = container.querySelector('input[placeholder="Pack size"]')
      expect(packSizeInput.value).toBe("50")
    })
  })
})

