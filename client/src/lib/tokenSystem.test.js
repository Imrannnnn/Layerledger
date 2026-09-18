global.IS_REACT_ACT_ENVIRONMENT = true

import React, { act } from "react"
import { createRoot } from "react-dom/client"
import { callClaude } from "./helpers.js"
import { TokenPurchaseModal } from "../components/common/TokenPurchaseModal.jsx"
import * as dataLib from "./data.js"

// Mock fetch
global.fetch = jest.fn()

describe("AI Token System Unit Tests", () => {
  let container, root

  beforeEach(() => {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    jest.clearAllMocks()
    localStorage.clear()
    sessionStorage.clear()
  })

  afterEach(() => {
    act(() => {
      if (root) root.unmount()
    })
    if (container) container.remove()
    container = null
  })

  test("callClaude throws error and emits layerledger:insufficient-credits if local credit balance < 2", async () => {
    dataLib.saveLocal("ll_tenant_info", { tokenBalance: 0.4 })

    const eventListener = jest.fn()
    window.addEventListener("layerledger:insufficient-credits", eventListener)

    await expect(callClaude([{ role: "user", content: "Hi" }])).rejects.toThrow(
      /Insufficient credits|Insufficient tokens/i
    )

    expect(eventListener).toHaveBeenCalled()
    expect(global.fetch).not.toHaveBeenCalled()
    window.removeEventListener("layerledger:insufficient-credits", eventListener)
  })

  test("callClaude emits layerledger:insufficient-credits when server responds with 402 INSUFFICIENT_CREDITS", async () => {
    dataLib.saveLocal("ll_tenant_info", { tokenBalance: 5.0 })

    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 402,
      text: async () => JSON.stringify({
        code: "INSUFFICIENT_CREDITS",
        message: "You need at least 2 credits to use this AI feature.",
        currentBalance: 0.2,
        requiredCredits: 2
      })
    })

    const eventListener = jest.fn()
    window.addEventListener("layerledger:insufficient-credits", eventListener)

    await expect(callClaude([{ role: "user", content: "Hi" }])).rejects.toThrow(
      /at least 2 credits|Insufficient/i
    )

    expect(eventListener).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.objectContaining({
          currentBalance: 0.2,
          requiredCredits: 2
        })
      })
    )

    window.removeEventListener("layerledger:insufficient-credits", eventListener)
  })

  test("callClaude emits layerledger:credit-updated with newBalance when AI call succeeds", async () => {
    dataLib.saveLocal("ll_tenant_info", { tokenBalance: 10.0 })

    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        content: [{ type: "text", text: "AI answer" }],
        tokenUsage: {
          creditsDeducted: 2,
          tokensDeducted: 2,
          newBalance: 8.0
        }
      })
    })

    const creditUpdatedListener = jest.fn()
    window.addEventListener("layerledger:credit-updated", creditUpdatedListener)

    const result = await callClaude([{ role: "user", content: "Hi" }])
    expect(result).toBe("AI answer")

    expect(creditUpdatedListener).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.objectContaining({
          tokenBalance: 8.0,
          creditsDeducted: 2
        })
      })
    )

    const updatedTenant = dataLib.loadLocal("ll_tenant_info", null)
    expect(updatedTenant.tokenBalance).toBe(8.0)

    window.removeEventListener("layerledger:credit-updated", creditUpdatedListener)
  })

  test("TokenPurchaseModal displays insufficient warning and packages when open", () => {
    act(() => {
      root.render(
        <TokenPurchaseModal
          isOpen={true}
          onClose={jest.fn()}
          currentBalance={0.3}
          isInsufficient={true}
          requiredCredits={2}
          company={{ name: "Sweet Treats Bakery", phone: "08012345678" }}
        />
      )
    })

    expect(container.textContent).toContain("AI Feature Credits")
    expect(container.textContent).toContain("Insufficient Credit Balance:")
    expect(container.textContent).toContain("0.3 credits")
    expect(container.textContent).toContain("Small Pack")
    expect(container.textContent).toContain("Medium Pack")
    expect(container.textContent).toContain("Large Pack")
    expect(container.textContent).toContain("2 credits")
  })
})
