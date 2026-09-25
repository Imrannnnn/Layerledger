global.IS_REACT_ACT_ENVIRONMENT = true

import {
  checkPlanLimit,
  saveQuotes,
  loadQuotes,
  saveProduction,
  loadProductions,
  loadClients,
  upsertClient,
  saveUsers,
  saveLocal
} from "./data.js"

describe("Plan Limits Enforcement Across All Features", () => {
  let eventDispatched = []

  beforeEach(() => {
    eventDispatched = []
    if (typeof window !== "undefined") {
      window.localStorage.clear()
    }
    const listener = (e) => {
      eventDispatched.push(e.detail)
    }
    window.addEventListener("layerledger:plan-limit-reached", listener)
    window.addEventListener("bakewealth:plan-limit-reached", listener)
  })

  afterEach(() => {
    if (typeof window !== "undefined") {
      window.localStorage.clear()
    }
  })

  test("checkPlanLimit accurately identifies free plan 8 orders/month limit", () => {
    saveLocal("ll_tenant_info", { settings: { plan: "free" } })
    const now = new Date()
    const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`

    // Populate 8 quotes in current month
    const eightQuotes = Array.from({ length: 8 }).map((_, i) => ({
      id: `q-${i}`,
      clientName: `Client ${i}`,
      date: `${curMonth}-05`,
      grandTotal: 10000
    }))
    saveLocal("ll_quotes", eightQuotes)

    const check = checkPlanLimit("ordersPerMonth")
    expect(check.exceeded).toBe(true)
    expect(check.limit).toBe(8)
    expect(check.currentCount).toBe(8)
    expect(check.plan).toBe("free")
    expect(check.message).toMatch(/Free plan limit/)
  })

  test("saveQuotes blocks new quote and triggers modal event when 8 orders/quotes reached", async () => {
    saveLocal("ll_tenant_info", { settings: { plan: "free" } })
    const now = new Date()
    const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`

    // 8 existing quotes
    const existingQuotes = Array.from({ length: 8 }).map((_, i) => ({
      id: `quote-slot-${i}`,
      clientName: `Existing Client ${i}`,
      date: `${curMonth}-10`,
      grandTotal: 15000
    }))
    saveLocal("ll_quotes", existingQuotes)

    // Attempt to add a 9th quote
    const ninthQuote = {
      id: "quote-slot-9",
      clientName: "New Client Blocked",
      date: `${curMonth}-11`,
      grandTotal: 25000
    }

    await expect(saveQuotes([ninthQuote, ...existingQuotes])).rejects.toThrow(/Free plan limit/)

    // Confirm that the 9th quote was NOT saved to storage
    const loaded = loadQuotes([])
    expect(loaded.some(q => q.id === "quote-slot-9")).toBe(false)
    expect(loaded.length).toBe(8)

    // Confirm notification event was dispatched
    expect(eventDispatched.length).toBeGreaterThan(0)
    expect(eventDispatched[0].limitType).toBe("ordersPerMonth")
  })

  test("saveProduction blocks new order and triggers modal event when monthly limit reached", async () => {
    saveLocal("ll_tenant_info", { settings: { plan: "free" } })
    const now = new Date()
    const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`

    const eightProds = Array.from({ length: 8 }).map((_, i) => ({
      id: `prod-${i}`,
      client: `Client ${i}`,
      orderDate: `${curMonth}-10`,
      cost: 5000
    }))
    saveLocal("ll_prods", eightProds)

    const ninthProd = {
      id: "prod-9",
      client: "Ninth Client",
      orderDate: `${curMonth}-15`,
      cost: 6000
    }

    await expect(saveProduction(ninthProd)).rejects.toThrow(/Free plan limit/)
    const loaded = loadProductions([])
    expect(loaded.some(p => p.id === "prod-9")).toBe(false)
    expect(loaded.length).toBe(8)
  })

  test("checkPlanLimit enforces 20 clients limit on Free plan", () => {
    saveLocal("ll_tenant_info", { settings: { plan: "free" } })
    const twentyClients = Array.from({ length: 20 }).map((_, i) => ({
      id: `c-${i}`,
      name: `Client ${i}`
    }))
    saveLocal("ll_clients", twentyClients)

    const check = checkPlanLimit("clients")
    expect(check.exceeded).toBe(true)
    expect(check.limit).toBe(20)
    expect(check.currentCount).toBe(20)
  })

  test("upsertClient blocks new client when 20 client limit is reached", async () => {
    saveLocal("ll_tenant_info", { settings: { plan: "free" } })
    const twentyClients = Array.from({ length: 20 }).map((_, i) => ({
      id: `c-${i}`,
      name: `Existing Client ${i}`
    }))
    saveLocal("ll_clients", twentyClients)

    await expect(upsertClient("Brand New 21st Client", "08012345678")).rejects.toThrow(/limit of 20 clients/)
    const loaded = loadClients()
    expect(loaded.length).toBe(20)
    expect(loaded.some(c => c.name === "Brand New 21st Client")).toBe(false)
  })

  test("saveUsers blocks staff accounts on Free plan (owner only)", async () => {
    saveLocal("ll_tenant_info", { settings: { plan: "free" } })
    saveLocal("ll_users", [{ id: "u1", name: "Owner", role: "owner", pin: "1234" }])

    const check = checkPlanLimit("staffLogins")
    expect(check.exceeded).toBe(true)
    expect(check.limit).toBe(0)

    const newStaff = { id: "u2", name: "Baker Assistant", role: "production", pin: "5678" }
    await expect(saveUsers([newStaff, { id: "u1", name: "Owner", role: "owner", pin: "1234" }])).rejects.toThrow(/Standard plan/)
  })

  test("Standard plan lifts monthly orders limit to unlimited and allows up to 2 staff", () => {
    saveLocal("ll_tenant_info", { settings: { plan: "standard" } })
    const now = new Date()
    const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`

    // 15 orders in month
    const fifteenQuotes = Array.from({ length: 15 }).map((_, i) => ({
      id: `sq-${i}`,
      date: `${curMonth}-05`
    }))
    saveLocal("ll_quotes", fifteenQuotes)

    const orderCheck = checkPlanLimit("ordersPerMonth")
    expect(orderCheck.exceeded).toBe(false)
    expect(orderCheck.limit).toBe(Infinity)

    // Staff check: allows 2 staff
    saveLocal("ll_users", [
      { id: "u1", name: "Owner", role: "owner" },
      { id: "u2", name: "Staff 1", role: "production" }
    ])
    const staffCheck = checkPlanLimit("staffLogins")
    expect(staffCheck.exceeded).toBe(false)
    expect(staffCheck.limit).toBe(2)
    expect(staffCheck.currentCount).toBe(1)
  })
})
