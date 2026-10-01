global.IS_REACT_ACT_ENVIRONMENT = true

import React, { act } from "react"
import { createRoot } from "react-dom/client"
import { Onboarding } from "./Onboarding.jsx"
import { formatApiError, parseValidationMessage } from "../../lib/errorHandler.js"
import * as dataLib from "../../lib/data.js"

// Mock dataLib
jest.mock("../../lib/data.js", () => ({
  saveCompany: jest.fn().mockResolvedValue(true),
  saveSetting: jest.fn().mockResolvedValue(true),
  saveInventory: jest.fn().mockResolvedValue(true),
  saveRecipes: jest.fn().mockResolvedValue(true),
  saveLocal: jest.fn(),
  loadLocal: jest.fn().mockReturnValue({})
}))

describe("Onboarding Error Handling & User Feedback", () => {
  let container, root

  const mockCompany = {
    name: "LayerLedger Bakery",
    currency: "NGN",
    btype: "Cake Bakery"
  }
  const mockSetCompany = jest.fn()
  const mockSettings = { profitPct: 40 }
  const mockSetSettings = jest.fn()
  const mockInventory = [
    { id: "ing_1", name: "Flour", unit: "kg", cost: 1000, stock: 10 },
    { id: "ing_2", name: "Sugar", unit: "kg", cost: 1200, stock: 5 }
  ]
  const mockSetInventory = jest.fn()
  const mockRecipes = [
    {
      id: "r1",
      name: "Vanilla Cake",
      notes: "Base sponge",
      ing: [
        { iid: "ing_1", qty: "2" }
      ]
    }
  ]
  const mockSetRecipes = jest.fn()
  const mockOnComplete = jest.fn()

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

  describe("errorHandler helper functions", () => {
    test("converts raw backend ingredient validation error into human-readable details", () => {
      const rawError = "Validation error: body.ingredients.0.quantity: Valid positive quantity is required for each ingredient"
      const parsed = parseValidationMessage(rawError)

      expect(parsed.field).toBe("ingredients.0.quantity")
      expect(parsed.fieldIndex).toBe(0)
      expect(parsed.step).toBe(3)
      expect(parsed.whatWentWrong).toContain("Ingredient 1")
      expect(parsed.whatWentWrong).toContain("Quantity is required and must be greater than 0")
      expect(parsed.action).toContain("Make sure every ingredient has a quantity greater than 0")

      // Ensure no raw technical zod schema string is exposed to user
      expect(parsed.whatWentWrong).not.toContain("body.ingredients.0.quantity")
    })

    test("formatApiError formats errors safely with action and step navigation", () => {
      const err = new Error("Validation error: body.ingredients.1.quantity: Valid positive quantity is required for each ingredient")
      const formatted = formatApiError(err, { title: "Unable to complete onboarding" })

      expect(formatted.title).toBe("Unable to complete onboarding")
      expect(formatted.whatWentWrong).toContain("Ingredient 2")
      expect(formatted.step).toBe(3)
      expect(formatted.action).toBeTruthy()
      expect(formatted.displayMessage).not.toContain("body.ingredients")
    })
  })

  describe("Onboarding UI validation & error display", () => {
    test("blocks saving recipe when an ingredient has 0 or empty quantity, showing clear message and row highlight", async () => {
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

      // Navigate to Step 3 (Base Recipes)
      const nextBtn1 = Array.from(container.querySelectorAll("button")).find(b => b.textContent.includes("Next: Set Up Opening Stock"))
      await act(async () => {
        nextBtn1.click()
      })

      const nextBtn2 = Array.from(container.querySelectorAll("button")).find(b => b.textContent.includes("Next Step"))
      await act(async () => {
        nextBtn2.click()
      })

      // Verify we are on Step 3
      expect(container.textContent).toContain("Step 3 — Base Recipes")

      // Click Edit on the recipe
      const editBtn = Array.from(container.querySelectorAll("button")).find(b => b.textContent === "Edit")
      await act(async () => {
        editBtn.click()
      })

      expect(container.textContent).toContain("Edit Recipe")

      // Set ingredient quantity to 0
      const qtyInput = container.querySelector("input[placeholder='Qty']")
      await act(async () => {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
        nativeInputValueSetter.call(qtyInput, "0")
        qtyInput.dispatchEvent(new Event("change", { bubbles: true }))
      })

      // Click Save Recipe
      const saveRecipeBtn = Array.from(container.querySelectorAll("button")).find(b => b.textContent === "Save Recipe")
      await act(async () => {
        saveRecipeBtn.click()
      })

      // Recipe modal should display validation error
      expect(container.textContent).toContain("Invalid Recipe Ingredient")
      expect(container.textContent).toContain("Quantity is required and must be greater than 0")
      // saveRecipes should NOT be called
      expect(dataLib.saveRecipes).not.toHaveBeenCalled()
    })

    test("displays clear onboarding error banner when onComplete rejects with backend validation error", async () => {
      const serverRejection = new Error("Validation error: body.ingredients.0.quantity: Valid positive quantity is required for each ingredient")
      mockOnComplete.mockRejectedValueOnce(serverRejection)

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

      // Advance through steps to Step 5
      const nextBtn1 = Array.from(container.querySelectorAll("button")).find(b => b.textContent.includes("Next: Set Up Opening Stock"))
      await act(async () => {
        nextBtn1.click()
      })

      const nextBtn2 = Array.from(container.querySelectorAll("button")).find(b => b.textContent.includes("Next Step"))
      await act(async () => {
        nextBtn2.click()
      })

      const nextBtn3 = Array.from(container.querySelectorAll("button")).find(b => b.textContent.includes("Next: Profit Margin"))
      await act(async () => {
        nextBtn3.click()
      })

      const nextBtn4 = Array.from(container.querySelectorAll("button")).find(b => b.textContent.includes("Save & Finish"))
      await act(async () => {
        nextBtn4.click()
      })

      // Verify on Step 5
      expect(container.textContent).toContain("You're all set!")

      // Click "Go to Dashboard"
      const finishBtn = Array.from(container.querySelectorAll("button")).find(b => b.textContent.includes("Go to Dashboard"))
      await act(async () => {
        finishBtn.click()
      })

      // mockOnComplete was called
      expect(mockOnComplete).toHaveBeenCalledWith("dashboard")

      // The application should have automatically navigated the user directly to the offending step (Step 3)
      expect(container.textContent).toContain("Step 3 — Base Recipes")

      // It should NOT succeed silently. An error alert banner must be displayed.
      const alertBanner = container.querySelector("[role='alert']")
      expect(alertBanner).not.toBeNull()
      expect(alertBanner.textContent).toContain("Unable to complete onboarding")
      expect(alertBanner.textContent).toContain("Ingredient 1")
      expect(alertBanner.textContent).toContain("Quantity is required and must be greater than 0")
      expect(alertBanner.textContent).not.toContain("body.ingredients.0.quantity")

      // Dismissing the error banner works cleanly
      const dismissBtn = alertBanner.querySelector("button[title='Dismiss error']")
      expect(dismissBtn).not.toBeNull()
      await act(async () => {
        dismissBtn.click()
      })
      expect(container.querySelector("[role='alert']")).toBeNull()
    })
  })
})
