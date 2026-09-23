global.IS_REACT_ACT_ENVIRONMENT = true

import React, { act } from "react"
import { createRoot } from "react-dom/client"
import { Settings } from "./Settings.jsx"
import * as dataLib from "../../lib/data.js"

// Mock dataLib
jest.mock("../../lib/data.js", () => ({
  fetchPricingSettingsFromServer: jest.fn().mockResolvedValue({}),
  savePricingSettingsOnServer: jest.fn().mockResolvedValue({}),
  resetPricingSettingsOnServer: jest.fn().mockResolvedValue({}),
  migrateLocalStoragePricingToDatabase: jest.fn().mockResolvedValue(true),
  loadLocal: jest.fn(),
  saveLocal: jest.fn(),
  saveSetting: jest.fn(),
  saveCompany: jest.fn(),
  saveUsers: jest.fn(),
  syncToBackend: jest.fn(),
  syncFromBackend: jest.fn(),
  clearAllDataOnServer: jest.fn().mockResolvedValue(true),
  deleteTenantAccountOnServer: jest.fn().mockResolvedValue(true),
  logout: jest.fn(),
  saveInventory: jest.fn(),
  deleteOpeningStockOnServer: jest.fn(),
}))

describe("Settings Danger Zone (Account Deletion) Tests", () => {
  let container, root

  const mockCompany = {
    name: "Sweet Dreams Bakery",
    tagline: "Finest cakes in town",
    phone: "08012345678",
    email: "sweet@bakery.com"
  }
  const mockSetCompany = jest.fn()
  const mockSettings = { profitPct: 50, overheadPct: 25 }
  const mockSetSettings = jest.fn()
  const mockUsers = [
    { id: "owner", name: "Chef Ngozi", role: "owner", active: true, pin: "1234" }
  ]
  const mockSetUsers = jest.fn()
  const mockInventory = []
  const mockSetInventory = jest.fn()

  beforeEach(() => {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    jest.clearAllMocks()
    dataLib.deleteTenantAccountOnServer.mockResolvedValue(true)
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
    })
    container.remove()
    container = null
  })

  test("Danger Zone tab is NOT rendered for non-owner staff (production / customer service)", async () => {
    const nonOwnerUser = { id: "staff1", name: "Staff Member", role: "production" }

    await act(async () => {
      root.render(
        <Settings
          company={mockCompany}
          setCompany={mockSetCompany}
          settings={mockSettings}
          setSettings={mockSetSettings}
          users={mockUsers}
          setUsers={mockSetUsers}
          inventory={mockInventory}
          setInventory={mockSetInventory}
          user={nonOwnerUser}
          initialTab="company"
        />
      )
    })

    const textContent = container.textContent
    expect(textContent).not.toContain("Danger Zone")
    expect(textContent).not.toContain("Delete Account Permanently")
  })

  test("Danger Zone tab IS rendered for owner users", async () => {
    const ownerUser = { id: "owner", name: "Chef Ngozi", role: "owner" }

    await act(async () => {
      root.render(
        <Settings
          company={mockCompany}
          setCompany={mockSetCompany}
          settings={mockSettings}
          setSettings={mockSetSettings}
          users={mockUsers}
          setUsers={mockSetUsers}
          inventory={mockInventory}
          setInventory={mockSetInventory}
          user={ownerUser}
          initialTab="company"
        />
      )
    })

    const textContent = container.textContent
    expect(textContent).toContain("Danger Zone")
  })

  test("Opening Danger Zone renders both Reset Data and Delete Account Permanently cards", async () => {
    const ownerUser = { id: "owner", name: "Chef Ngozi", role: "owner" }

    await act(async () => {
      root.render(
        <Settings
          company={mockCompany}
          setCompany={mockSetCompany}
          settings={mockSettings}
          setSettings={mockSetSettings}
          users={mockUsers}
          setUsers={mockSetUsers}
          inventory={mockInventory}
          setInventory={mockSetInventory}
          user={ownerUser}
          initialTab="danger"
        />
      )
    })

    const textContent = container.textContent
    expect(textContent).toContain("Dangerous Section: Irreversible Actions")
    expect(textContent).toContain("Reset Business Data (Keep Account)")
    expect(textContent).toContain("Delete Account Permanently (Purge Database)")
    expect(textContent).toContain("Sweet Dreams Bakery")

    // Find the Delete Account button
    const buttons = Array.from(container.querySelectorAll("button"))
    const deleteBtn = buttons.find(b => b.textContent.includes("Delete Account"))
    expect(deleteBtn).toBeDefined()
    expect(deleteBtn.disabled).toBe(true) // Disabled until confirmation text is typed
  })

  test("Typing exact company name enables Delete Account button and opens confirmation modal", async () => {
    const ownerUser = { id: "owner", name: "Chef Ngozi", role: "owner" }

    await act(async () => {
      root.render(
        <Settings
          company={mockCompany}
          setCompany={mockSetCompany}
          settings={mockSettings}
          setSettings={mockSetSettings}
          users={mockUsers}
          setUsers={mockSetUsers}
          inventory={mockInventory}
          setInventory={mockSetInventory}
          user={ownerUser}
          initialTab="danger"
        />
      )
    })

    // Find the input for account deletion
    const deleteInput = container.querySelector("#delete-account-confirm-input")
    expect(deleteInput).toBeDefined()
    expect(deleteInput).not.toBeNull()

    // Type partial or wrong text -> still disabled
    await act(async () => {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
      nativeInputValueSetter.call(deleteInput, "Wrong Bakery")
      deleteInput.dispatchEvent(new Event("change", { bubbles: true }))
    })

    const buttons = Array.from(container.querySelectorAll("button"))
    const deleteBtn = buttons.find(b => b.textContent.includes("Delete Account"))
    expect(deleteBtn.disabled).toBe(true)

    // Type exact company name -> becomes enabled!
    await act(async () => {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
      nativeInputValueSetter.call(deleteInput, "Sweet Dreams Bakery")
      deleteInput.dispatchEvent(new Event("change", { bubbles: true }))
    })

    expect(deleteBtn.disabled).toBe(false)

    // Click the button to trigger confirmation modal
    await act(async () => {
      deleteBtn.click()
    })

    // Verify modal is displayed
    const modalTitle = document.body.querySelector(".modal, [style*='fixed']")
    expect(document.body.textContent).toContain("Confirm Permanent Account Deletion")
    expect(document.body.textContent).toContain("Yes, Permanently Delete Everything")

    // Click "Yes, Permanently Delete Everything"
    const confirmModalBtn = Array.from(document.body.querySelectorAll("button")).find(b =>
      b.textContent.includes("Yes, Permanently Delete Everything")
    )
    expect(confirmModalBtn).toBeDefined()

    await act(async () => {
      confirmModalBtn.click()
    })

    // Verify deleteTenantAccountOnServer was called
    expect(dataLib.deleteTenantAccountOnServer).toHaveBeenCalledTimes(1)
  })
})
