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

  test("callClaude throws error and emits layerledger:insufficient-tokens if local token balance < 0.7", async () => {
    dataLib.saveLocal("ll_tenant_info", { tokenBalance: 0.4 })

    const eventListener = jest.fn()
    window.addEventListener("layerledger:insufficient-tokens", eventListener)

    await expect(callClaude([{ role: "user", content: "Hi" }])).rejects.toThrow(
      /Insufficient tokens/i
    )

    expect(eventListener).toHaveBeenCalled()
    expect(global.fetch).not.toHaveBeenCalled()
    window.removeEventListener("layerledger:insufficient-tokens", eventListener)
  })

  test("callClaude emits layerledger:insufficient-tokens when server responds with 402 INSUFFICIENT_TOKENS", async () => {
    dataLib.saveLocal("ll_tenant_info", { tokenBalance: 5.0 })

    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 402,
      text: async () => JSON.stringify({
        code: "INSUFFICIENT_TOKENS",
        message: "You need at least 0.7 tokens to use this AI feature.",
        currentBalance: 0.2
      })
    })

    const eventListener = jest.fn()
    window.addEventListener("layerledger:insufficient-tokens", eventListener)

    await expect(callClaude([{ role: "user", content: "Hi" }])).rejects.toThrow(
      /at least 0.7 tokens|Insufficient tokens/i
    )

    expect(eventListener).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.objectContaining({
          currentBalance: 0.2,
          requiredTokens: 0.7
        })
      })
    )

    window.removeEventListener("layerledger:insufficient-tokens", eventListener)
  })

  test("callClaude emits layerledger:token-updated with newBalance when AI call succeeds", async () => {
    dataLib.saveLocal("ll_tenant_info", { tokenBalance: 10.0 })

    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        content: [{ type: "text", text: "AI answer" }],
        tokenUsage: {
          tokensDeducted: 0.7,
          newBalance: 9.3
        }
      })
    })

    const tokenUpdatedListener = jest.fn()
    window.addEventListener("layerledger:token-updated", tokenUpdatedListener)

    const result = await callClaude([{ role: "user", content: "Hi" }])
    expect(result).toBe("AI answer")

    expect(tokenUpdatedListener).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.objectContaining({
          tokenBalance: 9.3,
          tokensDeducted: 0.7
        })
      })
    )

    const updatedTenant = dataLib.loadLocal("ll_tenant_info", null)
    expect(updatedTenant.tokenBalance).toBe(9.3)

    window.removeEventListener("layerledger:token-updated", tokenUpdatedListener)
  })

  test("TokenPurchaseModal displays insufficient warning and packages when open", () => {
    act(() => {
      root.render(
        <TokenPurchaseModal
          isOpen={true}
          onClose={jest.fn()}
          currentBalance={0.3}
          isInsufficient={true}
          requiredTokens={0.7}
          company={{ name: "Sweet Treats Bakery", phone: "08012345678" }}
        />
      )
    })

    expect(container.textContent).toContain("AI Feature Tokens")
    expect(container.textContent).toContain("Insufficient Token Balance:")
    expect(container.textContent).toContain("0.3 tokens")
    expect(container.textContent).toContain("Starter Pack")
    expect(container.textContent).toContain("Baker Pro Pack")
    expect(container.textContent).toContain("Commercial Bakery Pack")
    expect(container.textContent).toContain("0.7 tokens")
  })
})
