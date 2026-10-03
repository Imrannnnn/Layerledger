global.IS_REACT_ACT_ENVIRONMENT = true

import React, { act } from "react"
import { createRoot } from "react-dom/client"
import { Onboarding } from "./Onboarding.jsx"
import * as dataLib from "../../lib/data.js"

// Mock dataLib
jest.mock("../../lib/data.js", () => ({
  saveCompany: jest.fn(),
  saveSetting: jest.fn(),
  saveInventory: jest.fn(),
  saveRecipes: jest.fn(),
  saveLocal: jest.fn(),
  loadLocal: jest.fn().mockReturnValue({}),
  saveOpeningStock: jest.fn()
}))

describe("Onboarding Import Modal", () => {
  let container, root

  const mockCompany = {
    name: "Sweet Dreams Bakery",
    currency: "NGN",
    btype: "Cake Bakery"
  }
  const mockSetCompany = jest.fn()
  const mockSettings = { profitPct: 40 }
  const mockSetSettings = jest.fn()
  const mockInventory = [
    { id: "ing_1", name: "Flour", unit: "kg", cost: 1000, stock: 10 }
  ]
  const mockSetInventory = jest.fn()
  const mockRecipes = []
  const mockSetRecipes = jest.fn()
  const mockOnComplete = jest.fn()

  beforeEach(() => {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    jest.clearAllMocks()
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
    })
    container.remove()
    container = null
  })

  test("clicking import on Step 2 opens the import modal on Step 2 and does not show on Step 1", async () => {
    await act(async () => {
      root.render(
        <Onboarding
          gold="#C89D46"
          company={mockCompany}
          setCompany={mockSetCompany}
          inventory={mockInventory}
          setInventory={mockSetInventory}
          recipes={mockRecipes}
          setRecipes={mockSetRecipes}
          settings={mockSettings}
          setSettings={mockSetSettings}
          onComplete={mockOnComplete}
        />
      )
    })

    // Initially on Step 1
    expect(container.textContent).toContain("Step 1 — Business Details")
    expect(container.textContent).not.toContain("Import — Excel, PDF or a photo")

    // Click "Next: Set Up Opening Stock →"
    const nextBtn = Array.from(container.querySelectorAll("button")).find(b =>
      b.textContent.includes("Next: Set Up Opening Stock")
    )
    expect(nextBtn).toBeTruthy()

    await act(async () => {
      nextBtn.click()
    })

    // Now on Step 2
    expect(container.textContent).toContain("Step 2 — Opening Stock")

    // Find "Import — Excel, PDF or a photo" button
    const importBtn = Array.from(container.querySelectorAll("button")).find(b =>
      b.textContent.includes("Import — Excel, PDF or a photo")
    )
    expect(importBtn).toBeTruthy()

    // Modal should not be open yet
    expect(container.textContent).not.toContain("Open your Excel. Copy each column and paste into its own box")

    // Click Import button
    await act(async () => {
      importBtn.click()
    })

    // Modal is now open on Step 2!
    expect(container.textContent).toContain("Step 2 — Opening Stock")
    expect(container.textContent).toContain("Open your Excel. Copy each column and paste into its own box")
    expect(container.textContent).toContain("Item Names *")
    expect(container.textContent).toContain("Opening Stock Quantity")
    expect(container.textContent).toContain("Preview import →")

    // Click Cancel to close modal
    const cancelBtn = Array.from(container.querySelectorAll("button")).find(b =>
      b.textContent.trim() === "Cancel"
    )
    expect(cancelBtn).toBeTruthy()

    await act(async () => {
      cancelBtn.click()
    })

    // Modal is closed, still on Step 2
    expect(container.textContent).not.toContain("Open your Excel. Copy each column and paste into its own box")
    expect(container.textContent).toContain("Step 2 — Opening Stock")
  })

  test("Step 2 import parses Item Names, Units, Opening Stock Quantity, and Costs and confirms import", async () => {
    await act(async () => {
      root.render(
        <Onboarding
          gold="#C89D46"
          company={mockCompany}
          setCompany={mockSetCompany}
          inventory={mockInventory}
          setInventory={mockSetInventory}
          recipes={mockRecipes}
          setRecipes={mockSetRecipes}
          settings={mockSettings}
          setSettings={mockSetSettings}
          onComplete={mockOnComplete}
        />
      )
    })

    // Click "Next: Set Up Opening Stock →"
    const nextBtn = Array.from(container.querySelectorAll("button")).find(b =>
      b.textContent.includes("Next: Set Up Opening Stock")
    )
    await act(async () => {
      nextBtn.click()
    })

    // Click Import button
    const importBtn = Array.from(container.querySelectorAll("button")).find(b =>
      b.textContent.includes("Import — Excel, PDF or a photo")
    )
    await act(async () => {
      importBtn.click()
    })

    // There should be 4 textareas: names, units, quantities, costs
    const textareas = container.querySelectorAll("textarea")
    expect(textareas.length).toBe(4)

    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value"
    ).set

    await act(async () => {
      nativeSetter.call(textareas[0], "Sugar\nButter") // names
      textareas[0].dispatchEvent(new Event("input", { bubbles: true }))
      textareas[0].dispatchEvent(new Event("change", { bubbles: true }))

      nativeSetter.call(textareas[1], "kg\ng") // units
      textareas[1].dispatchEvent(new Event("input", { bubbles: true }))
      textareas[1].dispatchEvent(new Event("change", { bubbles: true }))

      nativeSetter.call(textareas[2], "20\n500") // opening stock quantities
      textareas[2].dispatchEvent(new Event("input", { bubbles: true }))
      textareas[2].dispatchEvent(new Event("change", { bubbles: true }))

      nativeSetter.call(textareas[3], "1500\n3000") // costs
      textareas[3].dispatchEvent(new Event("input", { bubbles: true }))
      textareas[3].dispatchEvent(new Event("change", { bubbles: true }))
    })

    // Preview import
    const previewBtn = Array.from(container.querySelectorAll("button")).find(b =>
      b.textContent.includes("Preview import")
    )
    expect(previewBtn.disabled).toBe(false)
    await act(async () => {
      previewBtn.click()
    })

    // Verify preview table has Opening Qty
    expect(container.textContent).toContain("Opening Qty")
    expect(container.textContent).toContain("20 kg")
    expect(container.textContent).toContain("500 g")

    // Confirm import
    const confirmBtn = Array.from(container.querySelectorAll("button")).find(b =>
      b.textContent.includes("Import 2 Items")
    )
    expect(confirmBtn).toBeTruthy()
    await act(async () => {
      confirmBtn.click()
    })

    // Verify saveInventory and saveOpeningStock were called
    expect(dataLib.saveInventory).toHaveBeenCalled()
    expect(dataLib.saveOpeningStock).toHaveBeenCalled()
    const savedOpeningStockList = dataLib.saveOpeningStock.mock.calls[0][0]
    const sugarOS = savedOpeningStockList.find(i => i.name === "Sugar")
    const butterOS = savedOpeningStockList.find(i => i.name === "Butter")
    expect(sugarOS).toBeTruthy()
    expect(sugarOS.openingQty).toBe(20)
    expect(butterOS).toBeTruthy()
    expect(butterOS.openingQty).toBe(500)
  })

  test("Step 3 recipe import saves recipes with clean empty ingredients array", async () => {
    await act(async () => {
      root.render(
        <Onboarding
          gold="#C89D46"
          company={mockCompany}
          setCompany={mockSetCompany}
          inventory={mockInventory}
          setInventory={mockSetInventory}
          recipes={mockRecipes}
          setRecipes={mockSetRecipes}
          settings={mockSettings}
          setSettings={mockSetSettings}
          onComplete={mockOnComplete}
        />
      )
    })

    // Advance to Step 2
    const nextBtnStep1 = Array.from(container.querySelectorAll("button")).find(b =>
      b.textContent.includes("Next: Set Up Opening Stock")
    )
    await act(async () => {
      nextBtnStep1.click()
    })

    // Next to Step 3
    const nextBtnStep2 = Array.from(container.querySelectorAll("button")).find(b =>
      b.textContent.includes("Next Step")
    )
    expect(nextBtnStep2).toBeTruthy()
    await act(async () => {
      nextBtnStep2.click()
    })

    // Wait for step transition
    await new Promise(r => setTimeout(r, 900))

    // Now on Step 3
    expect(container.textContent).toContain("Step 3 — Base Recipes")

    // Open Recipe Import modal
    const importBtn = Array.from(container.querySelectorAll("button")).find(b =>
      b.textContent.includes("Import — Excel, PDF or a photo")
    )
    expect(importBtn).toBeTruthy()
    await act(async () => {
      importBtn.click()
    })

    expect(container.textContent).toContain("Recipe Name *")
    expect(container.textContent).toContain("Option B: Paste Ingredient Columns from Excel")

    // Fill Recipe Name
    const nameInput = container.querySelector("input[placeholder*='Chocolate Sponge']")
    expect(nameInput).toBeTruthy()
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value"
    ).set
    await act(async () => {
      nativeInputValueSetter.call(nameInput, "Chocolate Sponge")
      nameInput.dispatchEvent(new Event("input", { bubbles: true }))
      nameInput.dispatchEvent(new Event("change", { bubbles: true }))
    })

    // Fill Ingredient Names & Quantities textareas
    const textareas = container.querySelectorAll("textarea")
    expect(textareas.length).toBeGreaterThanOrEqual(2)
    const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value"
    ).set
    await act(async () => {
      // Ingredient names textarea
      nativeTextAreaValueSetter.call(textareas[0], "Flour\nSugar")
      textareas[0].dispatchEvent(new Event("input", { bubbles: true }))
      textareas[0].dispatchEvent(new Event("change", { bubbles: true }))

      // Quantity textarea
      nativeTextAreaValueSetter.call(textareas[1], "500\n250")
      textareas[1].dispatchEvent(new Event("input", { bubbles: true }))
      textareas[1].dispatchEvent(new Event("change", { bubbles: true }))
    })

    // Click "Preview import →"
    const previewBtn = Array.from(container.querySelectorAll("button")).find(b =>
      b.textContent.includes("Preview import")
    )
    expect(previewBtn).toBeTruthy()
    await act(async () => {
      previewBtn.click()
    })

    // Verify preview step displays Recipe Name and ingredients
    expect(container.textContent).toContain("Chocolate Sponge")
    expect(container.textContent).toContain("Flour")
    expect(container.textContent).toContain("Sugar")

    // Confirm import
    const confirmBtn = Array.from(container.querySelectorAll("button")).find(b =>
      b.textContent.includes("Import Recipe (2 Ingredients)")
    )
    expect(confirmBtn).toBeTruthy()
    await act(async () => {
      confirmBtn.click()
    })

    // Verify saveRecipes was called with imported ingredients
    expect(dataLib.saveRecipes).toHaveBeenCalled()
    const savedRecs = dataLib.saveRecipes.mock.calls[0][0]
    expect(savedRecs.length).toBeGreaterThanOrEqual(1)
    const importedRecipe = savedRecs.find(r => r.name === "Chocolate Sponge")
    expect(importedRecipe).toBeTruthy()
    expect(importedRecipe.ing.length).toBe(2)
    expect(importedRecipe.ing[0].qty).toBe(500)
    expect(importedRecipe.ing[1].qty).toBe(250)
  })
})
