global.IS_REACT_ACT_ENVIRONMENT = true

import React, { act } from "react"
import { createRoot } from "react-dom/client"
import { Onboarding } from "./Onboarding.jsx"
import * as dataLib from "../../lib/data.js"
import * as helpersLib from "../../lib/helpers.js"

// Mock dataLib
jest.mock("../../lib/data.js", () => ({
  saveCompany: jest.fn().mockResolvedValue(true),
  saveSetting: jest.fn().mockResolvedValue(true),
  saveInventory: jest.fn().mockResolvedValue(true),
  saveRecipes: jest.fn().mockResolvedValue(true),
  saveLocal: jest.fn(),
  loadLocal: jest.fn().mockReturnValue({}),
  saveOpeningStock: jest.fn().mockResolvedValue(true),
  refundScanCredits: jest.fn().mockResolvedValue(true)
}))

// Mock callClaude and compressImage in helpers
jest.mock("../../lib/helpers.js", () => {
  const actual = jest.requireActual("../../lib/helpers.js")
  return {
    ...actual,
    callClaude: jest.fn(),
    compressImage: jest.fn().mockResolvedValue("mock_compressed_recipe_base64")
  }
})

describe("Onboarding Step 3 Recipe & Ingredient Import", () => {
  let container, root
  let origReadAsDataURL

  const mockCompany = {
    name: "Golden Crust Bakery",
    currency: "NGN",
    btype: "Cake Bakery"
  }
  const mockSetCompany = jest.fn()
  const mockSettings = { profitPct: 40 }
  const mockSetSettings = jest.fn()
  const mockInventory = [
    { id: "ing_flour", name: "Flour", unit: "kg", cost: 1000, stock: 10 },
    { id: "ing_sugar", name: "Sugar", unit: "kg", cost: 1500, stock: 5 }
  ]
  const mockSetInventory = jest.fn()
  const mockRecipes = [
    { id: "r1", name: "Vanilla Cake", type: "layer", notes: "Default", ing: [{ iid: "ing_flour", qty: 2 }] }
  ]
  const mockSetRecipes = jest.fn()
  const mockOnComplete = jest.fn()

  beforeEach(() => {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    jest.clearAllMocks()

    origReadAsDataURL = window.FileReader.prototype.readAsDataURL
    window.FileReader.prototype.readAsDataURL = function () {
      setTimeout(() => {
        if (this.onload) {
          this.onload({ target: { result: "data:image/jpeg;base64,mockRecipeBase64" } })
        }
      }, 10)
    }
  })

  afterEach(async () => {
    if (origReadAsDataURL) {
      window.FileReader.prototype.readAsDataURL = origReadAsDataURL
    }
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

  // Helper to advance to Step 3
  const navigateToStep3 = async () => {
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

    // Step 1 -> Step 2
    const nextBtnStep1 = Array.from(container.querySelectorAll("button")).find(b =>
      b.textContent.includes("Next: Set Up Opening Stock")
    )
    expect(nextBtnStep1).toBeTruthy()
    await act(async () => {
      nextBtnStep1.click()
    })
    await new Promise(r => setTimeout(r, 900))

    // Step 2 -> Step 3
    const nextBtnStep2 = Array.from(container.querySelectorAll("button")).find(b =>
      b.textContent.includes("Next Step")
    )
    expect(nextBtnStep2).toBeTruthy()
    await act(async () => {
      nextBtnStep2.click()
    })
    await new Promise(r => setTimeout(r, 900))

    expect(container.textContent).toContain("Step 3 — Base Recipes")
  }

  test("Allows user to enter Recipe Name and import ingredients & quantities via Excel copy-paste", async () => {
    await navigateToStep3()

    // Click Import button in Step 3
    const importBtn = Array.from(container.querySelectorAll("button")).find(b =>
      b.textContent.includes("Import — Excel, PDF or a photo")
    )
    expect(importBtn).toBeTruthy()
    await act(async () => {
      importBtn.click()
    })

    // Recipe modal should be open
    expect(container.textContent).toContain("Import Recipe & Ingredients")
    expect(container.textContent).toContain("Recipe Name *")
    expect(container.textContent).toContain("Option A: Scan Recipe Sheet or Card (PDF / Photo)")
    expect(container.textContent).toContain("Option B: Paste Ingredient Columns from Excel")

    // Insert Recipe Name using prototype setter
    const nameInput = container.querySelector("input[placeholder*='Chocolate Sponge']")
    expect(nameInput).toBeTruthy()
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value"
    ).set
    await act(async () => {
      nativeInputValueSetter.call(nameInput, "Red Velvet Sponge")
      nameInput.dispatchEvent(new Event("input", { bubbles: true }))
      nameInput.dispatchEvent(new Event("change", { bubbles: true }))
    })

    // Fill ingredients and quantities (2 textareas: names & quantities only)
    const textareas = container.querySelectorAll("textarea")
    expect(textareas.length).toBe(2)
    const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value"
    ).set
    await act(async () => {
      nativeTextAreaValueSetter.call(textareas[0], "Flour\nSugar\nCocoa Powder")
      textareas[0].dispatchEvent(new Event("input", { bubbles: true }))
      textareas[0].dispatchEvent(new Event("change", { bubbles: true }))

      nativeTextAreaValueSetter.call(textareas[1], "400\n200\n50")
      textareas[1].dispatchEvent(new Event("input", { bubbles: true }))
      textareas[1].dispatchEvent(new Event("change", { bubbles: true }))
    })

    // Click Preview import
    const previewBtn = Array.from(container.querySelectorAll("button")).find(b =>
      b.textContent.includes("Preview import")
    )
    expect(previewBtn).toBeTruthy()
    await act(async () => {
      previewBtn.click()
    })

    // Check preview table
    expect(container.textContent).toContain("Red Velvet Sponge")
    expect(container.textContent).toContain("Estimated Layer Cost")
    expect(container.textContent).toContain("Flour")
    expect(container.textContent).toContain("Sugar")
    expect(container.textContent).toContain("Cocoa Powder")

    // Confirm import
    const confirmBtn = Array.from(container.querySelectorAll("button")).find(b =>
      b.textContent.includes("Import Recipe (3 Ingredients)")
    )
    expect(confirmBtn).toBeTruthy()
    await act(async () => {
      confirmBtn.click()
    })

    // Check completion
    expect(container.textContent).toContain("Recipe imported successfully!")
    expect(container.textContent).toContain("Red Velvet Sponge")

    // Verify saveRecipes was called
    expect(dataLib.saveRecipes).toHaveBeenCalled()
    const saved = dataLib.saveRecipes.mock.calls[0][0]
    const redVelvet = saved.find(r => r.name === "Red Velvet Sponge")
    expect(redVelvet).toBeTruthy()
    expect(redVelvet.ing.length).toBe(3)
    expect(redVelvet.ing[0].qty).toBe(400)
    expect(redVelvet.ing[1].qty).toBe(200)
    expect(redVelvet.ing[2].qty).toBe(50)

    // Unmatched Cocoa Powder was added to inventory
    expect(dataLib.saveInventory).toHaveBeenCalled()
    const savedInv = dataLib.saveInventory.mock.calls[0][0]
    expect(savedInv.some(i => i.name === "Cocoa Powder")).toBe(true)
  })

  test("Allows user to switch to Pick from Inventory List tab, select items with quantities, and save recipe", async () => {
    await navigateToStep3()

    const importBtn = Array.from(container.querySelectorAll("button")).find(b =>
      b.textContent.includes("Import — Excel, PDF or a photo")
    )
    expect(importBtn).toBeTruthy()
    await act(async () => {
      importBtn.click()
    })

    // Set Recipe Name
    const nameInput = container.querySelector("input[placeholder*='Chocolate Sponge']")
    expect(nameInput).toBeTruthy()
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value"
    ).set
    await act(async () => {
      nativeInputValueSetter.call(nameInput, "Lemon Drizzle Cake")
      nameInput.dispatchEvent(new Event("input", { bubbles: true }))
      nameInput.dispatchEvent(new Event("change", { bubbles: true }))
    })

    // Switch to "Pick from Inventory List" tab
    const pickTabBtn = Array.from(container.querySelectorAll("button")).find(b =>
      b.textContent.includes("Pick from Inventory List")
    )
    expect(pickTabBtn).toBeTruthy()
    await act(async () => {
      pickTabBtn.click()
    })

    // Inventory items (Flour, Sugar from initial mock) should be in table
    expect(container.textContent).toContain("Flour")
    expect(container.textContent).toContain("Sugar")

    // Find quantity inputs in the inventory table
    const qtyInputs = container.querySelectorAll("table input[type='number']")
    expect(qtyInputs.length).toBeGreaterThanOrEqual(2)

    await act(async () => {
      nativeInputValueSetter.call(qtyInputs[0], "300")
      qtyInputs[0].dispatchEvent(new Event("input", { bubbles: true }))
      qtyInputs[0].dispatchEvent(new Event("change", { bubbles: true }))

      nativeInputValueSetter.call(qtyInputs[1], "150")
      qtyInputs[1].dispatchEvent(new Event("input", { bubbles: true }))
      qtyInputs[1].dispatchEvent(new Event("change", { bubbles: true }))
    })

    // Check estimated layer cost is displayed in the badge
    expect(container.textContent).toContain("2 selected")

    // Click "Save Recipe (2 Ingredients)"
    const saveRecipeBtn = Array.from(container.querySelectorAll("button")).find(b =>
      b.textContent.includes("Save Recipe (2 Ingredients)")
    )
    expect(saveRecipeBtn).toBeTruthy()
    await act(async () => {
      saveRecipeBtn.click()
    })

    // Verification
    expect(container.textContent).toContain("Recipe imported successfully!")
    expect(container.textContent).toContain("Lemon Drizzle Cake")
    expect(dataLib.saveRecipes).toHaveBeenCalled()
    const saved = dataLib.saveRecipes.mock.calls[dataLib.saveRecipes.mock.calls.length - 1][0]
    const lemonCake = saved.find(r => r.name === "Lemon Drizzle Cake")
    expect(lemonCake).toBeTruthy()
    expect(lemonCake.ing.length).toBe(2)
    expect(lemonCake.ing[0].qty).toBe(300)
    expect(lemonCake.ing[1].qty).toBe(150)
  })

  test("Allows user to upload/scan a recipe photo with Claude AI extracting recipe name and ingredients", async () => {
    await navigateToStep3()

    const importBtn = Array.from(container.querySelectorAll("button")).find(b =>
      b.textContent.includes("Import — Excel, PDF or a photo")
    )
    await act(async () => {
      importBtn.click()
    })

    // Mock AI return
    helpersLib.callClaude.mockResolvedValueOnce(JSON.stringify({
      recipeName: "Fudge Brownie",
      ingredients: [
        { name: "Flour", quantity: 250, unit: "g" },
        { name: "Dark Chocolate", quantity: 300, unit: "g" },
        { name: "Butter", quantity: 150, unit: "g" }
      ]
    }))

    // Select file for AI scan
    const fileInput = container.querySelector("input[accept*='.pdf,image/*']")
    expect(fileInput).toBeTruthy()

    const fakeFile = new File(["dummy recipe content"], "grandma_recipe.jpg", { type: "image/jpeg" })
    await act(async () => {
      Object.defineProperty(fileInput, "files", {
        value: [fakeFile],
        writable: true
      })
      fileInput.dispatchEvent(new Event("change", { bubbles: true }))
    })

    // Wait for FileReader
    await act(async () => {
      await new Promise(r => setTimeout(r, 50))
    })

    // AI file preview card should now be visible
    expect(container.textContent).toContain("grandma_recipe.jpg")

    // Click "Scan & Extract Recipe & Ingredients"
    const scanBtn = Array.from(container.querySelectorAll("button")).find(b =>
      b.textContent.includes("Scan & Extract Recipe & Ingredients")
    )
    expect(scanBtn).toBeTruthy()
    await act(async () => {
      scanBtn.click()
    })

    // Should have called callClaude
    expect(helpersLib.callClaude).toHaveBeenCalled()

    // Step 2 Preview should display extracted Recipe Name and ingredients
    expect(container.textContent).toContain("Fudge Brownie")
    expect(container.textContent).toContain("Flour")
    expect(container.textContent).toContain("Dark Chocolate")
    expect(container.textContent).toContain("Butter")

    // Confirm import
    const confirmBtn = Array.from(container.querySelectorAll("button")).find(b =>
      b.textContent.includes("Import Recipe (3 Ingredients)")
    )
    await act(async () => {
      confirmBtn.click()
    })

    // Verify recipe saved
    const saved = dataLib.saveRecipes.mock.calls[0][0]
    const fudge = saved.find(r => r.name === "Fudge Brownie")
    expect(fudge).toBeTruthy()
    expect(fudge.ing.length).toBe(3)
  })

  test("Refunds 2 credits automatically if AI recipe scan detects no readable ingredients", async () => {
    await navigateToStep3()

    const importBtn = Array.from(container.querySelectorAll("button")).find(b =>
      b.textContent.includes("Import — Excel, PDF or a photo")
    )
    await act(async () => {
      importBtn.click()
    })

    // Claude returns empty ingredients
    helpersLib.callClaude.mockResolvedValueOnce(JSON.stringify({
      recipeName: "Empty Menu",
      ingredients: []
    }))

    const fileInput = container.querySelector("input[accept*='.pdf,image/*']")
    const fakeFile = new File(["unreadable photo"], "blurry_card.jpg", { type: "image/jpeg" })
    await act(async () => {
      Object.defineProperty(fileInput, "files", { value: [fakeFile], writable: true })
      fileInput.dispatchEvent(new Event("change", { bubbles: true }))
    })

    await act(async () => {
      await new Promise(r => setTimeout(r, 50))
    })

    const scanBtn = Array.from(container.querySelectorAll("button")).find(b =>
      b.textContent.includes("Scan & Extract Recipe & Ingredients")
    )
    expect(scanBtn).toBeTruthy()
    await act(async () => {
      scanBtn.click()
    })

    // Should have refunded 2 credits
    expect(dataLib.refundScanCredits).toHaveBeenCalledWith(2, expect.stringContaining("Failed recipe scan"))
    expect(container.textContent).toContain("Scan could not read any ingredients. 2 credits refunded automatically.")
  })

  test("Allows importing ingredients from inside the Edit/Add Recipe modal", async () => {
    await navigateToStep3()

    // Click "Add manually" to open recipe modal
    const addManuallyBtn = Array.from(container.querySelectorAll("button")).find(b =>
      b.textContent.includes("Add manually")
    )
    expect(addManuallyBtn).toBeTruthy()
    await act(async () => {
      addManuallyBtn.click()
    })

    // In recipeModal, verify "Import Ingredients (Excel/PDF/Photo)" button exists
    const importIngBtn = Array.from(container.querySelectorAll("button")).find(b =>
      b.textContent.includes("Import Ingredients (Excel/PDF/Photo)")
    )
    expect(importIngBtn).toBeTruthy()
    await act(async () => {
      importIngBtn.click()
    })

    // Opens the recipe import modal
    expect(container.textContent).toContain("Import Recipe & Ingredients")
    expect(container.textContent).toContain("Option B: Paste Ingredient Columns from Excel")
  })
})
