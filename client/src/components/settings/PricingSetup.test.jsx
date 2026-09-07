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
  logout: jest.fn(),
  saveInventory: jest.fn(),
  deleteOpeningStockOnServer: jest.fn(),
}))

describe("PricingSetup Unit Tests", () => {
  let container, root
  const mockSetSetting = jest.fn()

  const defaultTestMults = {
    "4-round": 0.5,
    "6-round": 1.0,
    "8-round": 1.8,
    "10-round": 2.8,
    "6-square": 1.3,
    "8-square": 2.3,
    "sheet": 4.0
  }

  beforeEach(() => {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    jest.clearAllMocks()

    dataLib.loadLocal.mockReturnValue(defaultTestMults)
    dataLib.migrateLocalStoragePricingToDatabase.mockResolvedValue(true)
    dataLib.fetchPricingSettingsFromServer.mockResolvedValue({
      multipliers: defaultTestMults,
      profitPct: 45,
      overheadPct: 25,
      accessoryPct: 12,
      miscPct: 5
    })
    dataLib.savePricingSettingsOnServer.mockResolvedValue({ success: true })
    dataLib.resetPricingSettingsOnServer.mockResolvedValue({
      success: true,
      multipliers: { ...defaultTestMults, "8-round": 1.8 }
    })
  })

  afterEach(() => {
    act(() => {
      if (root) root.unmount()
    })
    if (container) container.remove()
    container = null
  })

  test("loads pricing settings directly from database and does not use loadLocal or migration on mount", async () => {
    await act(async () => {
      root.render(<PricingSetup settings={{ profitPct: 50, overheadPct: 27 }} setSetting={mockSetSetting} />)
    })

    // PricingSetup must NOT call migration continuously on mount
    expect(dataLib.migrateLocalStoragePricingToDatabase).not.toHaveBeenCalled()
    // PricingSetup must NOT read multipliers from local storage
    expect(dataLib.loadLocal).not.toHaveBeenCalledWith("ll_multipliers", expect.anything())
    // PricingSetup must fetch directly from database
    expect(dataLib.fetchPricingSettingsFromServer).toHaveBeenCalled()
    expect(mockSetSetting).toHaveBeenCalledWith("profitPct", 45)
    expect(mockSetSetting).toHaveBeenCalledWith("overheadPct", 25)

    expect(container.textContent).toContain("Size multipliers")
    expect(container.textContent).toContain("Profit margins")
    expect(container.textContent).toContain("Save multipliers")
    expect(container.textContent).toContain("Reset to Defaults")
  })

  test("saving multipliers invokes savePricingSettingsOnServer with updated values", async () => {
    await act(async () => {
      root.render(<PricingSetup settings={{ profitPct: 50 }} setSetting={mockSetSetting} />)
    })

    const saveBtn = Array.from(container.querySelectorAll("button")).find(b =>
      b.textContent.includes("Save multipliers")
    )
    expect(saveBtn).toBeTruthy()

    await act(async () => {
      saveBtn.click()
    })

    expect(dataLib.savePricingSettingsOnServer).toHaveBeenCalledWith(
      expect.objectContaining({
        multipliers: expect.any(Object)
      })
    )
  })

  test("resetting defaults calls resetPricingSettingsOnServer after confirm", async () => {
    jest.spyOn(window, "confirm").mockImplementation(() => true)

    await act(async () => {
      root.render(<PricingSetup settings={{ profitPct: 50 }} setSetting={mockSetSetting} />)
    })

    const resetBtn = Array.from(container.querySelectorAll("button")).find(b =>
      b.textContent.includes("Reset to Defaults")
    )
    expect(resetBtn).toBeTruthy()

    await act(async () => {
      resetBtn.click()
    })

    expect(window.confirm).toHaveBeenCalled()
    expect(dataLib.resetPricingSettingsOnServer).toHaveBeenCalled()

    window.confirm.mockRestore()
  })
})
