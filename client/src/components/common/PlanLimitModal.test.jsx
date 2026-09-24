global.IS_REACT_ACT_ENVIRONMENT = true

import React, { act } from "react"
import { createRoot } from "react-dom/client"
import { PlanLimitModal } from "./PlanLimitModal.jsx"

describe("PlanLimitModal Component", () => {
  let container = null
  let root = null

  beforeEach(() => {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
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

  test("renders nothing when isOpen is false", async () => {
    await act(async () => {
      root.render(<PlanLimitModal isOpen={false} onClose={() => {}} />)
    })
    expect(container.textContent).toBe("")
  })

  test("renders order limit message and triggers upgrade callbacks", async () => {
    const onUpgradeMock = jest.fn()
    const onCloseMock = jest.fn()
    const onOpenSettingsMock = jest.fn()

    await act(async () => {
      root.render(
        <PlanLimitModal
          isOpen={true}
          onClose={onCloseMock}
          onUpgradePlan={onUpgradeMock}
          onOpenSettings={onOpenSettingsMock}
          limitData={{
            limitType: "ordersPerMonth",
            limit: 8,
            currentCount: 8,
            plan: "free",
            upgradePlan: "standard",
            message: "Free plan order limit reached (8 orders per month)."
          }}
        />
      )
    })

    expect(container.textContent).toContain("Monthly Order Limit Reached")
    expect(container.textContent).toContain("Free plan order limit reached (8 orders per month).")
    expect(container.textContent).toContain("Recommended: Standard Plan")

    // Find and click Upgrade button
    const buttons = Array.from(container.querySelectorAll("button"))
    const upgradeBtn = buttons.find(b => b.textContent.includes("Upgrade to Standard"))
    expect(upgradeBtn).toBeTruthy()

    await act(async () => {
      upgradeBtn.click()
    })
    expect(onUpgradeMock).toHaveBeenCalledWith("standard")
    expect(onCloseMock).toHaveBeenCalled()
  })

  test("renders settings navigation when clicking view all plans", async () => {
    const onCloseMock = jest.fn()
    const onOpenSettingsMock = jest.fn()

    await act(async () => {
      root.render(
        <PlanLimitModal
          isOpen={true}
          onClose={onCloseMock}
          onOpenSettings={onOpenSettingsMock}
          limitData={{
            limitType: "recipes",
            limit: 10,
            plan: "free"
          }}
        />
      )
    })

    expect(container.textContent).toContain("Recipe Capacity Reached")
    const buttons = Array.from(container.querySelectorAll("button"))
    const settingsBtn = buttons.find(b => b.textContent.includes("View All Plans & Billing"))
    expect(settingsBtn).toBeTruthy()

    await act(async () => {
      settingsBtn.click()
    })
    expect(onOpenSettingsMock).toHaveBeenCalled()
    expect(onCloseMock).toHaveBeenCalled()
  })
})
