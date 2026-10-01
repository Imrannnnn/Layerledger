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
  loadLocal: jest.fn().mockReturnValue({})
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

    expect(container.textContent).toContain("Paste your recipe names (one per line)")

    // Fill textarea
    const textarea = container.querySelector("textarea")
    expect(textarea).toBeTruthy()
    const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value"
    ).set
    await act(async () => {
      nativeTextAreaValueSetter.call(textarea, "Chocolate Sponge\nRed Velvet Layer")
      textarea.dispatchEvent(new Event("input", { bubbles: true }))
      textarea.dispatchEvent(new Event("change", { bubbles: true }))
    })

    // Click "Preview import →"
    const previewBtn = Array.from(container.querySelectorAll("button")).find(b =>
      b.textContent.includes("Preview import")
    )
    expect(previewBtn).toBeTruthy()
    await act(async () => {
      previewBtn.click()
    })

    // Confirm import
    const confirmBtn = Array.from(container.querySelectorAll("button")).find(b =>
      b.textContent.includes("Import 2 Recipes")
    )
    expect(confirmBtn).toBeTruthy()
    await act(async () => {
      confirmBtn.click()
    })

    // Verify saveRecipes was called with clean ing: []
    expect(dataLib.saveRecipes).toHaveBeenCalled()
    const savedRecs = dataLib.saveRecipes.mock.calls[0][0]
    expect(savedRecs.length).toBe(2)
    expect(savedRecs[0].name).toBe("Chocolate Sponge")
    expect(savedRecs[0].ing).toEqual([])
    expect(savedRecs[1].name).toBe("Red Velvet Layer")
    expect(savedRecs[1].ing).toEqual([])
  })
})
