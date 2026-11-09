global.IS_REACT_ACT_ENVIRONMENT = true

import React, { act } from "react"
import { createRoot } from "react-dom/client"
import { Onboarding } from "./Onboarding.jsx"
import { Purchases } from "../money/Purchases.jsx"
import { RecipeCard } from "../inventory/MasterList.jsx"
import { OpeningStock } from "../inventory/OpeningStock.jsx"
import { convertToGrams, parseExcelOrSpreadsheet } from "../../lib/helpers.js"
import * as dataLib from "../../lib/data.js"

// Lightweight event helper mimicking fireEvent.change without requiring external @testing-library/react dependency
const fireEvent = {
  change: (element, { target: { value } }) => {
    const proto = element instanceof window.HTMLSelectElement
      ? window.HTMLSelectElement.prototype
      : (element instanceof window.HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype)
    const nativeSetter = Object.getOwnPropertyDescriptor(proto, "value")?.set
    const lastValue = element.value
    if (nativeSetter) {
      nativeSetter.call(element, value)
    } else {
      element.value = value
    }
    const tracker = element._valueTracker
    if (tracker) {
      tracker.setValue(lastValue)
    }
    element.dispatchEvent(new Event("input", { bubbles: true }))
    element.dispatchEvent(new Event("change", { bubbles: true }))
  }
}

// Mock external data functions
jest.mock("../../lib/data.js", () => {
  const actual = jest.requireActual("../../lib/data.js")
  return {
    ...actual,
    saveCompany: jest.fn().mockResolvedValue(true),
    saveSetting: jest.fn().mockResolvedValue(true),
    saveInventory: jest.fn().mockResolvedValue(true),
    saveRecipes: jest.fn().mockResolvedValue(true),
    saveOpeningStock: jest.fn().mockResolvedValue(true),
    loadOpeningStock: jest.fn(() => [
      { id: "os_i1", itemId: "i1", name: "Flour", unit: "kg", cost: 1000, openingQty: 10, locked: false }
    ]),
    fetchOpeningStockFromServer: jest.fn(() => Promise.resolve([
      { id: "os_i1", itemId: "i1", name: "Flour", unit: "kg", cost: 1000, openingQty: 10, locked: false }
    ])),
    isOpeningStockLocked: jest.fn(() => false),
    savePurchases: jest.fn().mockResolvedValue(true),
    saveExpenses: jest.fn().mockResolvedValue(true),
    saveLocal: jest.fn().mockResolvedValue(true),
    loadLocal: jest.fn().mockReturnValue([]),
    fetchPaginatedPurchases: jest.fn().mockResolvedValue({
      data: [],
      pagination: { total: 0, page: 1, limit: 25 },
      stats: { totalSpent: 0, totalPurchases: 0, availableMonths: [] }
    }),
    updateOpeningStockItemOnServer: jest.fn().mockResolvedValue(true)
  }
})

describe("Step-by-step requested features", () => {
  let container, root

  const mockCompany = { name: "Sweet Treats", phone: "123456", currency: "NGN", logo: "" }
  const mockSettings = { profitPct: 40, overheadPct: 27, accessoryPct: 10, miscPct: 5 }
  const mockInventory = [
    { id: "i1", name: "Flour", unit: "kg", cost: 1000, stock: 10, cat: "Dry Goods" },
    { id: "i2", name: "Sugar", unit: "kg", cost: 800, stock: 5, cat: "Dry Goods" }
  ]
  const mockRecipes = [
    {
      id: "r1",
      name: "Vanilla Cake",
      type: "layer",
      notes: "Base sponge",
      yieldLayers: 1,
      ing: [
        { iid: "i1", qty: 2 },
        { iid: "i2", qty: 1 }
      ]
    }
  ]

  beforeEach(() => {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    jest.clearAllMocks()
  })

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root.unmount()
      })
    }
    if (container) {
      container.remove()
      container = null
    }
  })

  test("1 & 2. Onboarding step 3 button says 'Set Margin' and Step 4 renders all margins", async () => {
    const setCompany = jest.fn()
    const setSettings = jest.fn()
    const setInventory = jest.fn()
    const setRecipes = jest.fn()

    await act(async () => {
      root.render(
        <Onboarding
          gold="#C89D46"
          company={mockCompany}
          setCompany={setCompany}
          inventory={mockInventory}
          setInventory={setInventory}
          recipes={mockRecipes}
          setRecipes={setRecipes}
          settings={mockSettings}
          setSettings={setSettings}
        />
      )
    })

    // Advance to Step 2
    const btn1 = Array.from(container.querySelectorAll("button")).find(b => b.textContent.includes("Next: Set Up Opening Stock"))
    await act(async () => { btn1.click() })

    // Step 2 Opening Stock: Test editing unit
    const unitInputOnboarding = container.querySelector("input[value='kg']")
    expect(unitInputOnboarding).toBeDefined()
    await act(async () => {
      fireEvent.change(unitInputOnboarding, { target: { value: "bags" } })
    })
    expect(dataLib.saveInventory).toHaveBeenCalled()

    // Advance to Step 3
    const btn2 = Array.from(container.querySelectorAll("button")).find(b => b.textContent.includes("Next Step"))
    await act(async () => { btn2.click() })

    // Step 3 button should say "Set Margin →"
    const setMarginBtn = Array.from(container.querySelectorAll("button")).find(b => b.textContent.includes("Set Margin"))
    expect(setMarginBtn).toBeDefined()
    expect(setMarginBtn.textContent).toContain("Set Margin")

    // Advance to Step 4
    await act(async () => { setMarginBtn.click() })

    // Verify all margins are visible in Step 4
    expect(container.textContent).toContain("Step 4 — Set Margins")
    expect(container.textContent).toContain("Default Profit Margin")
    expect(container.textContent).toContain("Overhead Allowance")
    expect(container.textContent).toContain("Accessories Allowance")
    expect(container.textContent).toContain("Miscellaneous Allowance")
    expect(container.textContent).toContain("Pricing Example")
  })

  test("3. Purchases allows adding a new item not currently in inventory", async () => {
    let currentInv = [...mockInventory]
    const setInventory = jest.fn(updater => {
      currentInv = typeof updater === "function" ? updater(currentInv) : updater
    })
    const setExpenses = jest.fn()

    await act(async () => {
      root.render(
        <Purchases
          inventory={mockInventory}
          setInventory={setInventory}
          expenses={[]}
          setExpenses={setExpenses}
        />
      )
    })

    // Open Log Purchase form
    const logBtn = Array.from(container.querySelectorAll("button")).find(b => b.textContent.includes("+ Log Purchase"))
    await act(async () => { logBtn.click() })

    // Select '+ Add new item' option
    const itemSelect = container.querySelector("select")
    await act(async () => {
      fireEvent.change(itemSelect, { target: { value: "__new__" } })
    })

    // Input new item name and unit
    const nameInp = container.querySelector("input[placeholder='e.g. Cocoa Powder']")
    await act(async () => {
      fireEvent.change(nameInp, { target: { value: "Cocoa Powder" } })
    })

    const unitInp = container.querySelector("input[placeholder='g, kg, ml, pcs']")
    await act(async () => {
      fireEvent.change(unitInp, { target: { value: "kg" } })
    })

    // Select category (find category select)
    const catSelect = Array.from(container.querySelectorAll("select")).find(s =>
      Array.from(s.options).some(o => o.text.includes("Dry Goods"))
    )
    await act(async () => {
      fireEvent.change(catSelect, { target: { value: "Dry Goods" } })
    })

    // Fill in pack size, qty, price
    const packInp = container.querySelector("input[placeholder='e.g. 50']")
    await act(async () => {
      fireEvent.change(packInp, { target: { value: "1" } })
    })

    const qtyInp = container.querySelector("input[placeholder='e.g. 3']")
    await act(async () => {
      fireEvent.change(qtyInp, { target: { value: "2" } })
    })

    const priceInp = container.querySelector("input[placeholder='e.g. 57000']")
    await act(async () => {
      fireEvent.change(priceInp, { target: { value: "3500" } })
    })

    // Submit form
    const submitBtn = Array.from(container.querySelectorAll("button")).find(b => b.textContent.includes("Log 1 Purchase"))
    await act(async () => {
      submitBtn.click()
    })

    // Verify inventory was saved with the new item
    expect(dataLib.saveInventory).toHaveBeenCalled()
    const lastSavedInv = dataLib.saveInventory.mock.calls[0][0]
    expect(lastSavedInv.some(i => i.name === "Cocoa Powder" && i.unit === "kg")).toBe(true)

    // Verify purchases was saved
    expect(dataLib.savePurchases).toHaveBeenCalled()
    const lastSavedPur = dataLib.savePurchases.mock.calls[0][0]
    expect(lastSavedPur.some(p => p.item === "Cocoa Powder" && p.total === 7000)).toBe(true)
  })

  test("4. Base recipe shows Total batch and Cost per layer for cake layers", async () => {
    await act(async () => {
      root.render(
        <RecipeCard
          r={mockRecipes[0]}
          inventory={mockInventory}
          isOwner={true}
        />
      )
    })

    // Total batch cost: 2*1000 + 1*800 = 2800
    // Check card summary tag
    expect(container.textContent).toContain("Total Batch: ₦2,800")
    expect(container.textContent).toContain("₦2,800/layer")

    // Expand recipe card
    const header = container.querySelector("[style*='cursor: pointer']")
    await act(async () => { header.click() })

    // Check expanded calculator shows total batch and cost per layer
    expect(container.textContent).toContain("Total batch (all ingredients)")
    expect(container.textContent).toContain("Cost per layer")
    expect(container.textContent).toContain("Base batch total")
  })

  test("5. Opening stock unit update updates inventory", async () => {
    let currentInv = [...mockInventory]
    const setInventory = jest.fn(updater => {
      currentInv = typeof updater === "function" ? updater(currentInv) : updater
    })

    await act(async () => {
      root.render(
        <OpeningStock
          inventory={mockInventory}
          setInventory={setInventory}
          user={{ role: "owner" }}
        />
      )
    })

    // Click edit item button
    const editBtn = container.querySelector("button[title='Edit item']")
    expect(editBtn).toBeDefined()
    await act(async () => { editBtn.click() })

    // Find the unit input in the table
    const unitInput = container.querySelector("input[value='kg']")
    expect(unitInput).toBeDefined()

    // Change unit to 'bags'
    await act(async () => {
      fireEvent.change(unitInput, { target: { value: "bags" } })
    })

    // Verify saveInventory was called with updated unit
    expect(dataLib.saveInventory).toHaveBeenCalled()
    const savedInv = dataLib.saveInventory.mock.calls[0][0]
    const updatedFlour = savedInv.find(i => i.name === "Flour")
    expect(updatedFlour.unit).toBe("bags")
  })

  test("6. Total baseline in opening stock only reflects opening stock items and does not increase when mid-month items are bought", async () => {
    let currentInv = [...mockInventory]
    const setInventory = jest.fn(updater => {
      currentInv = typeof updater === "function" ? updater(currentInv) : updater
    })

    await act(async () => {
      root.render(
        <OpeningStock
          inventory={currentInv}
          setInventory={setInventory}
          user={{ role: "owner" }}
        />
      )
    })

    // Initial total baseline valuation: Flour 10 * 1000 = 10,000
    expect(container.textContent).toContain("Total Baseline Valuation")
    expect(container.textContent).toContain("₦10,000")

    // Now simulate an item bought in purchases being added to inventory mid-month with positive stock
    const purchasedItem = { id: "inv-midmonth", name: "Purchased Mid-Month Cocoa", unit: "g", cost: 50, stock: 500, minStock: 5 }
    await act(async () => {
      root.render(
        <OpeningStock
          inventory={[...currentInv, purchasedItem]}
          setInventory={setInventory}
          user={{ role: "owner" }}
        />
      )
    })

    // Baseline valuation must STILL be ₦10,000 (openingQty for the newly purchased item is 0, not 500!)
    expect(container.textContent).toContain("₦10,000")
  })

  test("7. convertToGrams automatically converts weight units (kg, lb, oz) to grams and adjusts unit cost", () => {
    const fromKg = convertToGrams(50, "kg", 1140)
    expect(fromKg.qty).toBe(50000)
    expect(fromKg.unit).toBe("g")
    expect(fromKg.cost).toBeCloseTo(1.14, 2)

    const fromLb = convertToGrams(2, "lbs", 4000)
    expect(fromLb.qty).toBe(907)
    expect(fromLb.unit).toBe("g")
    expect(fromLb.cost).toBeCloseTo(8.82, 2)

    const fromPcs = convertToGrams(10, "pcs", 500)
    expect(fromPcs.qty).toBe(10)
    expect(fromPcs.unit).toBe("pcs")
    expect(fromPcs.cost).toBe(500)
  })

  test("8. parseExcelOrSpreadsheet extracts sheets and CSV content for AI extraction", async () => {
    const csvContent = "Name,Unit,Quantity,Cost\nFlour,kg,50,57000\nSugar,kg,25,30000"
    const csvBlob = new Blob([csvContent], { type: "text/csv" })
    csvBlob.name = "inventory.csv"

    const text = await parseExcelOrSpreadsheet(csvBlob)
    expect(text).toContain("Flour")
    expect(text).toContain("57000")
  })

  test("Scan icon is removed from item rows in Onboarding Step 2 opening stock", async () => {
    await act(async () => {
      root.render(
        <Onboarding
          gold="#C89D46"
          company={mockCompany}
          setCompany={jest.fn()}
          inventory={mockInventory}
          setInventory={jest.fn()}
          recipes={mockRecipes}
          setRecipes={jest.fn()}
          settings={mockSettings}
          setSettings={jest.fn()}
        />
      )
    })

    // Advance to Step 2
    const btn1 = Array.from(container.querySelectorAll("button")).find(b => b.textContent.includes("Next: Set Up Opening Stock"))
    await act(async () => { btn1.click() })

    // Check table rows: none should have a per-item Scan button
    const tableButtons = Array.from(container.querySelectorAll("tbody tr button"))
    const scanRowButtons = tableButtons.filter(b => b.textContent.includes("Scan"))
    expect(scanRowButtons.length).toBe(0)
  })
})
