global.IS_REACT_ACT_ENVIRONMENT = true

import React, { act } from "react"
import { createRoot } from "react-dom/client"
import { PricingSetup } from "./Settings.jsx"
import * as dataLib from "../../lib/data.js"

// Mock dataLib
jest.mock("../../lib/data.js", () => ({
  fetchPricingSettingsFromServer: jest.fn(),
  savePricingSettingsOnServer: jest.fn(),
  resetPricingSettingsOnServer: jest.fn(),
  migrateLocalStoragePricingToDatabase: jest.fn(),
  loadLocal: jest.fn(),
  saveLocal: jest.fn(),
  saveSetting: jest.fn(),
  saveCompany: jest.fn(),
  saveUsers: jest.fn(),
  syncToBackend: jest.fn(),
  syncFromBackend: jest.fn(),
  clearAllDataOnServer: jest.fn(),
  deleteTenantAccountOnServer: jest.fn(),
  logout: jest.fn(),
  saveInventory: jest.fn(),
  deleteOpeningStockOnServer: jest.fn(),
}))

describe("PricingSetup Unit Tests", () => {
  let container, root
  const mockSetSetting = jest.fn()

  beforeEach(() => {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    jest.clearAllMocks()

    dataLib.fetchPricingSettingsFromServer.mockResolvedValue({
      profitPct: 45,
      overheadPct: 25,
      accessoryPct: 12
    })
  })

  afterEach(() => {
    act(() => {
      if (root) root.unmount()
    })
    if (container) container.remove()
    container = null
  })

  test("loads pricing settings directly from database and does not display size multipliers", async () => {
    await act(async () => {
      root.render(<PricingSetup settings={{ profitPct: 50, overheadPct: 27, accessoryPct: 10 }} setSetting={mockSetSetting} />)
    })

    // PricingSetup must NOT call migration continuously on mount
    expect(dataLib.migrateLocalStoragePricingToDatabase).not.toHaveBeenCalled()
    // PricingSetup must NOT read multipliers from local storage
    expect(dataLib.loadLocal).not.toHaveBeenCalledWith("ll_multipliers", expect.anything())
    // PricingSetup must fetch directly from database
    expect(dataLib.fetchPricingSettingsFromServer).toHaveBeenCalled()
    expect(mockSetSetting).toHaveBeenCalledWith("profitPct", 45)
    expect(mockSetSetting).toHaveBeenCalledWith("overheadPct", 25)
    expect(mockSetSetting).toHaveBeenCalledWith("accessoryPct", 12)

    // Verify Size Multipliers is completely removed
    expect(container.textContent).not.toContain("Size multipliers")
    expect(container.textContent).not.toContain("Save multipliers")
    expect(container.textContent).not.toContain("Reset to Defaults")

    // Verify Pricing & Margins allowances are rendered
    expect(container.textContent).toContain("Default Profit Margin")
    expect(container.textContent).toContain("Overhead Allowance")
    expect(container.textContent).toContain("Accessories Allowance")
    expect(container.textContent).toContain("Example: if a cake costs")
  })

  test("adjusting profit margin slider calls setSetting", async () => {
    await act(async () => {
      root.render(<PricingSetup settings={{ profitPct: 50, overheadPct: 27, accessoryPct: 10 }} setSetting={mockSetSetting} />)
    })

    const sliders = container.querySelectorAll("input[type='range']")
    expect(sliders.length).toBeGreaterThanOrEqual(3)

    const profitSlider = sliders[0]
    await act(async () => {
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set
      if (nativeSetter) {
        nativeSetter.call(profitSlider, "55")
      } else {
        profitSlider.value = "55"
      }
      profitSlider.dispatchEvent(new Event("change", { bubbles: true }))
    })

    expect(mockSetSetting).toHaveBeenCalledWith("profitPct", 55)
  })
})
