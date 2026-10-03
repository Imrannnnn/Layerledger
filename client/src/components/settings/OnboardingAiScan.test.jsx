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
    compressImage: jest.fn().mockResolvedValue("mock_compressed_base64_data")
  }
})

describe("Onboarding AI PDF & Photo Scanning", () => {
  let container, root

  const mockCompany = {
    name: "Golden Crust Bakery",
    currency: "NGN",
    btype: "Cake Bakery"
  }
  const mockSetCompany = jest.fn()
  const mockSettings = { profitPct: 40 }
  const mockSetSettings = jest.fn()
  const mockInventory = [
    { id: "ing_flour", name: "Flour", unit: "kg", cost: 1000, stock: 10 }
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

  test("Step 2 import modal displays Option A for AI PDF/Photo scan and Option B for Excel paste", async () => {
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
    const nextBtn = Array.from(container.querySelectorAll("button")).find(b =>
      b.textContent.includes("Next: Set Up Opening Stock")
    )
    await act(async () => {
      nextBtn.click()
    })

    // Open import modal
    const importBtn = Array.from(container.querySelectorAll("button")).find(b =>
      b.textContent.includes("Import — Excel, PDF or a photo")
    )
    await act(async () => {
      importBtn.click()
    })

    // Verify Option A (AI Scan) and Option B (Excel) are both present
    expect(container.textContent).toContain("Option A: Scan PDF or Photo with AI")
    expect(container.textContent).toContain("Option B: Paste Columns from Excel")
    expect(container.textContent).toContain("Click or drop PDF document or photo here")
    expect(container.textContent).toContain("Select PDF or Photo")
    expect(container.textContent).toContain("Take photo")
    expect(container.textContent).toContain("Open your Excel. Copy each column and paste into its own box")
  })

  test("Uploading a PDF document scans with AI and populates preview items", async () => {
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
    const nextBtn = Array.from(container.querySelectorAll("button")).find(b =>
      b.textContent.includes("Next: Set Up Opening Stock")
    )
    await act(async () => {
      nextBtn.click()
    })

    // Open import modal
    const importBtn = Array.from(container.querySelectorAll("button")).find(b =>
      b.textContent.includes("Import — Excel, PDF or a photo")
    )
    await act(async () => {
      importBtn.click()
    })

    // Mock FileReader behavior for PDF upload
    const mockFile = new File(["dummy pdf content"], "stock_take_sheet.pdf", { type: "application/pdf" })
    const fileInput = container.querySelector("input[accept*='.pdf']")
    expect(fileInput).toBeTruthy()

    // Mock readAsDataURL on FileReader prototype
    const origReadAsDataURL = window.FileReader.prototype.readAsDataURL
    window.FileReader.prototype.readAsDataURL = function () {
      setTimeout(() => {
        this.onload({ target: { result: "data:application/pdf;base64,mockPdfBase64String" } })
      }, 10)
    }

    await act(async () => {
      Object.defineProperty(fileInput, "files", {
        value: [mockFile],
        writable: true
      })
      fileInput.dispatchEvent(new Event("change", { bubbles: true }))
    })

    // Wait for FileReader
    await act(async () => {
      await new Promise(r => setTimeout(r, 50))
    })

    // Selected file should be visible
    expect(container.textContent).toContain("stock_take_sheet.pdf")
    expect(container.textContent).toContain("Scan & Extract Inventory with AI")

    // Mock Claude API response
    helpersLib.callClaude.mockResolvedValueOnce(JSON.stringify({
      items: [
        { name: "Dangote Sugar", unit: "kg", openingQty: 25, cost: 1800, category: "Dry Goods" },
        { name: "Simas Margarine", unit: "kg", openingQty: 10, cost: 2400, category: "Dairy" }
      ]
    }))

    // Click Scan with AI
    const scanBtn = Array.from(container.querySelectorAll("button")).find(b =>
      b.textContent.includes("Scan & Extract Inventory with AI")
    )
    expect(scanBtn).toBeTruthy()

    await act(async () => {
      scanBtn.click()
    })

    // Verify Claude was called with document type PDF
    expect(helpersLib.callClaude).toHaveBeenCalledTimes(1)
    const callArgs = helpersLib.callClaude.mock.calls[0]
    const sentMessages = callArgs[0]
    expect(sentMessages[0].content[0].type).toBe("document")
    expect(sentMessages[0].content[0].source.data).toBe("mockPdfBase64String")

    // Verify Preview Step (Step 2 of modal) is displayed
    expect(container.textContent).toContain("Extracted 2 items from stock_take_sheet.pdf")
    expect(container.textContent).toContain("Dangote Sugar")
    expect(container.textContent).toContain("Simas Margarine")
    expect(container.textContent).toContain("25 kg")
    expect(container.textContent).toContain("10 kg")

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
    expect(container.textContent).toContain("Import complete!")

    window.FileReader.prototype.readAsDataURL = origReadAsDataURL
  })

  test("Step 2 inventory table has Scan button for each item to scan packaging/receipt photo", async () => {
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
    const nextBtn = Array.from(container.querySelectorAll("button")).find(b =>
      b.textContent.includes("Next: Set Up Opening Stock")
    )
    await act(async () => {
      nextBtn.click()
    })

    // Find the Scan button in the Flour row
    const scanBtn = Array.from(container.querySelectorAll("button")).find(b =>
      b.textContent.includes("Scan") && b.title?.includes("Flour")
    )
    expect(scanBtn).toBeTruthy()

    // Click Scan button on Flour
    await act(async () => {
      scanBtn.click()
    })

    // Modal should open for Flour
    expect(container.textContent).toContain("Scan Photo for Flour")
    expect(container.textContent).toContain("Upload or snap a photo of your Flour bag")

    // Mock FileReader
    const mockPhoto = new File(["dummy photo data"], "flour_sack.jpg", { type: "image/jpeg" })
    const origReadAsDataURL = window.FileReader.prototype.readAsDataURL
    window.FileReader.prototype.readAsDataURL = function () {
      setTimeout(() => {
        this.onload({ target: { result: "data:image/jpeg;base64,mockImageData" } })
      }, 10)
    }

    const itemFileInput = container.querySelector("input[accept='image/*,.pdf']")
    expect(itemFileInput).toBeTruthy()

    await act(async () => {
      Object.defineProperty(itemFileInput, "files", {
        value: [mockPhoto],
        writable: true
      })
      itemFileInput.dispatchEvent(new Event("change", { bubbles: true }))
    })

    await act(async () => {
      await new Promise(r => setTimeout(r, 50))
    })

    expect(container.textContent).toContain("flour_sack.jpg")

    // Mock AI scan response for single item
    helpersLib.callClaude.mockResolvedValueOnce(JSON.stringify({
      name: "Golden Penny Flour",
      unit: "kg",
      cost: 1140,
      openingQty: 50
    }))

    // Click Scan Photo with AI
    const runScanBtn = Array.from(container.querySelectorAll("button")).find(b =>
      b.textContent.includes("Scan Photo with AI")
    )
    expect(runScanBtn).toBeTruthy()

    await act(async () => {
      runScanBtn.click()
    })

    // Verify detected details are shown
    expect(container.textContent).toContain("AI Scan Detected Details")
    expect(container.textContent).toContain("Apply to Flour")

    // Apply to Flour
    const applyBtn = Array.from(container.querySelectorAll("button")).find(b =>
      b.textContent.includes("Apply to Flour")
    )
    await act(async () => {
      applyBtn.click()
    })

    // Verify inventory cost and opening stock were updated
    expect(dataLib.saveInventory).toHaveBeenCalled()
    expect(dataLib.saveOpeningStock).toHaveBeenCalled()

    window.FileReader.prototype.readAsDataURL = origReadAsDataURL
  })

  test("Manual Add modal provides Auto-Fill from Photo button", async () => {
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
    const nextBtn = Array.from(container.querySelectorAll("button")).find(b =>
      b.textContent.includes("Next: Set Up Opening Stock")
    )
    await act(async () => {
      nextBtn.click()
    })

    // Open Manual Add modal
    const manualBtn = Array.from(container.querySelectorAll("button")).find(b =>
      b.textContent.includes("Add manually")
    )
    await act(async () => {
      manualBtn.click()
    })

    // Verify Auto-Fill button is present in modal
    expect(container.textContent).toContain("Scan Photo or Receipt to Auto-Fill (AI)")
  })
})
