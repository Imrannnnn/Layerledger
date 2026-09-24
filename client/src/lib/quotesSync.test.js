import { mapServerOrderToLocal } from "./data.js"

describe("mapServerOrderToLocal - Quote & Production status resolution", () => {
  test("maps confirmed quote with status: 'quote' on server to local status 'confirmed' with confirmedAt", () => {
    const serverOrder = {
      id: "ord-1",
      status: "quote",
      totalPrice: 45000,
      totalCost: 18000,
      notes: "Wedding cake",
      orderDate: "2026-09-18T10:00:00.000Z",
      dueDate: "2026-09-25T00:00:00.000Z",
      items: [],
      metadata: {
        clientName: "Bisi Ade",
        status: "confirmed",
        confirmedAt: "2026-09-18T11:30:00.000Z",
        isProd: false,
        tiers: [{ size: "10", shape: "round", covering: "Fondant" }]
      }
    }

    const local = mapServerOrderToLocal(serverOrder)
    expect(local.id).toBe("ord-1")
    expect(local.clientName).toBe("Bisi Ade")
    expect(local.status).toBe("confirmed")
    expect(local.confirmedAt).toBe("2026-09-18T11:30:00.000Z")
    expect(local.salePrice).toBe(45000)
    expect(local.cost).toBe(18000)
  })

  test("maps unconfirmed quote with status: 'quote' on server to local status 'pending'", () => {
    const serverOrder = {
      id: "ord-2",
      status: "quote",
      totalPrice: 20000,
      totalCost: 8000,
      metadata: {
        clientName: "Kemi Adeleke",
        status: "pending",
        isProd: false
      }
    }

    const local = mapServerOrderToLocal(serverOrder)
    expect(local.status).toBe("pending")
    expect(local.confirmedAt).toBeNull()
  })

  test("maps quote that only has confirmedAt timestamp in metadata as confirmed", () => {
    const serverOrder = {
      id: "ord-3",
      status: "quote",
      totalPrice: 30000,
      totalCost: 12000,
      metadata: {
        clientName: "Funke Daniels",
        confirmedAt: "2026-09-19T08:00:00.000Z",
        isProd: false
      }
    }

    const local = mapServerOrderToLocal(serverOrder)
    expect(local.status).toBe("confirmed")
    expect(local.confirmedAt).toBe("2026-09-19T08:00:00.000Z")
  })

  test("maps production order properly preserving production status", () => {
    const serverOrder = {
      id: "prod-1",
      status: "in progress",
      totalPrice: 50000,
      totalCost: 22000,
      orderDate: "2026-09-15T00:00:00.000Z",
      metadata: {
        client: "Emeka Okafor",
        fromQuote: true,
        quoteId: "quote-99",
        isProd: true,
        status: "in progress"
      }
    }

    const local = mapServerOrderToLocal(serverOrder)
    expect(local.status).toBe("in progress")
  })

  test("saveQuotes persists quotes to localStorage and loadLocal retrieves them", async () => {
    const { saveQuotes, loadQuotes, loadLocal } = await import("./data.js")
    const testQuotes = [{ id: "q-101", clientName: "Florence", salePrice: 65000, status: "pending" }]
    await saveQuotes(testQuotes)

    // Verify in localStorage
    const fromStorage = JSON.parse(window.localStorage.getItem("ll_quotes"))
    expect(fromStorage).toHaveLength(1)
    expect(fromStorage[0].clientName).toBe("Florence")

    // Verify loadQuotes
    expect(loadQuotes()).toEqual(testQuotes)
    // Verify loadLocal
    expect(loadLocal("ll_quotes", [])).toEqual(testQuotes)
  })

  test("loadLocal falls back to localStorage when cache item is absent", async () => {
    const { loadLocal } = await import("./data.js")
    window.localStorage.setItem("ll_onboarded", "1")
    expect(Boolean(loadLocal("ll_onboarded", false))).toBe(true)
  })
})
