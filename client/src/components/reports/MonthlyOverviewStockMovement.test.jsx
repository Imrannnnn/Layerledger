global.IS_REACT_ACT_ENVIRONMENT = true

import React from "react"
import { createRoot } from "react-dom/client"
import { act } from "react"
import { MonthlyOverview } from "./MonthlyOverview"
import * as dataLib from "../../lib/data"

// Mock data library partially
jest.mock("../../lib/data", () => {
  const actual = jest.requireActual("../../lib/data")
  return {
    ...actual,
    loadLocal: jest.fn(),
    saveLocal: jest.fn().mockResolvedValue(true),
    saveExpenses: jest.fn().mockResolvedValue(true),
    saveProductionsList: jest.fn().mockResolvedValue(true),
    saveQuotes: jest.fn().mockResolvedValue(true),
    saveTxns: jest.fn().mockResolvedValue(true),
    savePurchases: jest.fn().mockResolvedValue(true),
    fetchPaginatedPurchases: jest.fn().mockResolvedValue({ data: [], pagination: {}, stats: {} }),
    deleteOpeningStockOnServer: jest.fn().mockResolvedValue(true),
    fetchOpeningStockFromServer: jest.fn().mockResolvedValue([]),
    loadOpeningStock: jest.fn().mockReturnValue([]),
    getAuthHeaders: jest.fn().mockReturnValue({ Authorization: "Bearer test" })
  }
})

// Mock UI components
jest.mock("../common/ui.jsx", () => {
  const React = require("react")
  return {
    Btn: ({ children, onClick }) => <button onClick={onClick}>{children}</button>,
    Card: ({ children }) => <div className="card">{children}</div>,
    SHead: ({ title, sub }) => <div><h1>{title}</h1><p>{sub}</p></div>,
    TH: ({ cols }) => <thead><tr>{cols.map((c, i) => <th key={i}>{c}</th>)}</tr></thead>,
    TR2: ({ row }) => <tr>{row.map((cell, i) => <td key={i}>{cell}</td>)}</tr>,
    Spinner: () => <div>Loading...</div>
  }
})

// Mock helpers
jest.mock("../../lib/helpers.js", () => {
  const actual = jest.requireActual("../../lib/helpers.js")
  return {
    ...actual,
    fmt: val => `₦${val}`,
    uid: () => "test-id",
    today: () => "2026-09-19"
  }
})

describe("MonthlyOverview Stock Movement — Used Reflection", () => {
  let container
  let root

  const sampleInventory = [
    { id: "inv-flour", name: "Flour", unit: "kg", cost: 1000, stock: 50, minStock: 5 },
    { id: "inv-sugar", name: "Sugar", unit: "kg", cost: 1200, stock: 40, minStock: 5 },
    { id: "inv-butter", name: "Butter", unit: "kg", cost: 3000, stock: 20, minStock: 5 }
  ]

  const sampleRecipes = [
    {
      id: "rec-vanilla",
      name: "Vanilla Cake",
      type: "layer",
      batchWeight: 1000,
      ing: [
        { iid: "inv-flour", qty: 0.5 },
        { iid: "inv-sugar", qty: 0.3 }
      ]
    },
    {
      id: "rec-buttercream",
      name: "Buttercream",
      type: "covering",
      batchWeight: 500,
      ing: [
        { iid: "inv-butter", qty: 0.25 },
        { iid: "inv-sugar", qty: 0.25 }
      ]
    }
  ]

  beforeEach(() => {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    jest.clearAllMocks()
    dataLib.fetchPaginatedPurchases.mockResolvedValue({ data: [], pagination: {}, stats: {} })
    dataLib.loadLocal.mockImplementation((key, fallback) => fallback)
    dataLib.loadOpeningStock.mockReturnValue([])
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    container.remove()
  })

  test("calculates and reflects non-zero Used in production from confirmed quote with cake tiers", async () => {
    const openingStock = [
      { id: "os-1", itemId: "inv-flour", name: "Flour", unit: "kg", cost: 1000, openingQty: 10 },
      { id: "os-2", itemId: "inv-sugar", name: "Sugar", unit: "kg", cost: 1200, openingQty: 10 },
      { id: "os-3", itemId: "inv-butter", name: "Butter", unit: "kg", cost: 3000, openingQty: 5 }
    ]

    // 8" round cake (mult 1.5), 2 layers of Vanilla Cake:
    // Flour: 0.5 * 1.5 * 2 = 1.5 kg
    // Sugar: 0.3 * 1.5 * 2 = 0.9 kg
    // Covering: Buttercream 500g (ratio 1):
    // Butter: 0.25 kg
    // Sugar: 0.25 kg (Total Sugar = 0.9 + 0.25 = 1.15 kg)
    const confirmedQuotes = [
      {
        id: "q-101",
        status: "confirmed",
        confirmedAt: "2026-09-15T10:00:00.000Z",
        deliveryDate: "2026-09-20",
        clientName: "Amaka Eze",
        salePrice: 25000,
        totalCost: 8000,
        productType: "Cake",
        tiers: [
          {
            size: "8",
            shape: "Round",
            layers: [{ flavour: "Vanilla Cake", qty: 2 }],
            coverings: [{ type: "Buttercream", grams: 500 }]
          }
        ]
      }
    ]

    dataLib.loadLocal.mockImplementation((key, fallback) => {
      if (key === "ll_quotes") return confirmedQuotes
      if (key === "ll_purchases") return []
      return fallback
    })
    dataLib.loadOpeningStock.mockReturnValue(openingStock)

    await act(async () => {
      root.render(
        <MonthlyOverview
          inventory={sampleInventory}
          recipes={sampleRecipes}
          productions={[]}
          expenses={[]}
          company={{ name: "Test Bakery" }}
          isOwner={true}
        />
      )
    })

    const text = container.textContent
    // Confirm client and revenue appear
    expect(text).toContain("Amaka Eze")
    expect(text).toContain("₦25000")

    // Flour: Opening 10, Bought 0, Used 1.5, Closing 8.5
    expect(text).toContain("Flour")
    expect(text).toContain("−1.5 kg")
    expect(text).toContain("8.5 kg")

    // Sugar: Opening 10, Bought 0, Used 1.15, Closing 8.85
    expect(text).toContain("Sugar")
    expect(text).toContain("−1.15 kg")
    expect(text).toContain("8.85 kg")

    // Butter: Opening 5, Bought 0, Used 0.25, Closing 4.75
    expect(text).toContain("Butter")
    expect(text).toContain("−0.25 kg")
    expect(text).toContain("4.75 kg")
  })

  test("accurately rolls over closing stock by deducting previous month's usage", async () => {
    // Current month is 2026-09. August is 2026-08.
    // If September has no opening stock, it looks up August (2026-08).
    const augustOS = [
      { id: "os-aug-1", itemId: "inv-flour", name: "Flour", unit: "kg", cost: 1000, openingQty: 20 }
    ]

    // In August, an order used 3 kg of Flour (6" round, mult 1, 6 layers of Vanilla Cake: 0.5 * 6 = 3 kg)
    const augustQuotes = [
      {
        id: "q-aug-1",
        status: "confirmed",
        confirmedAt: "2026-08-10T12:00:00.000Z",
        deliveryDate: "2026-08-12",
        salePrice: 18000,
        totalCost: 5000,
        tiers: [
          {
            size: "6",
            shape: "Round",
            layers: [{ flavour: "Vanilla Cake", qty: 6 }]
          }
        ]
      }
    ]

    dataLib.loadOpeningStock.mockImplementation(monthStr => {
      if (monthStr === "2026-08") return augustOS
      return []
    })

    dataLib.loadLocal.mockImplementation((key, fallback) => {
      if (key === "ll_quotes") return augustQuotes
      if (key === "ll_purchases") return []
      return fallback
    })

    await act(async () => {
      root.render(
        <MonthlyOverview
          inventory={sampleInventory}
          recipes={sampleRecipes}
          productions={[]}
          expenses={[]}
          company={{ name: "Test Bakery" }}
          isOwner={true}
        />
      )
    })

    // Rolled over opening stock for September should be August Opening (20) - August Used (3) = 17 kg
    const text = container.textContent
    expect(text).toContain("17 kg")
  })

  test("does NOT deduct or reflect ingredient usage in 'Used' when a quote is only generated/pending", async () => {
    const openingStock = [
      { id: "os-1", itemId: "inv-flour", name: "Flour", unit: "kg", cost: 1000, openingQty: 10 },
      { id: "os-2", itemId: "inv-sugar", name: "Sugar", unit: "kg", cost: 1200, openingQty: 10 },
      { id: "os-3", itemId: "inv-butter", name: "Butter", unit: "kg", cost: 3000, openingQty: 5 }
    ]

    // Quote generated in OrderCalculator: status is "pending", no confirmedAt
    const pendingQuotes = [
      {
        id: "q-pending-1",
        status: "pending",
        isProd: false,
        fromQuote: false,
        date: "2026-09-10",
        deliveryDate: "2026-09-20",
        clientName: "John Pending",
        salePrice: 40000,
        totalCost: 12000,
        productType: "Cake",
        tiers: [
          {
            size: "8",
            shape: "Round",
            layers: [{ flavour: "Vanilla Cake", qty: 2 }],
            coverings: [{ type: "Buttercream", grams: 500 }]
          }
        ]
      }
    ]

    dataLib.loadLocal.mockImplementation((key, fallback) => {
      if (key === "ll_quotes") return pendingQuotes
      if (key === "ll_purchases") return []
      return fallback
    })
    dataLib.loadOpeningStock.mockReturnValue(openingStock)

    await act(async () => {
      root.render(
        <MonthlyOverview
          inventory={sampleInventory}
          recipes={sampleRecipes}
          productions={[]}
          expenses={[]}
          company={{ name: "Test Bakery" }}
          isOwner={true}
        />
      )
    })

    const text = container.textContent

    // Unconfirmed quote should NOT appear in confirmed orders
    expect(text).not.toContain("John Pending")
    expect(text).toContain("0 confirmed orders")

    // Used should be 0 kg for all items (NOT 1.5 kg or 1.15 kg)
    expect(text).toContain("−0 kg")
    expect(text).not.toContain("−1.5 kg")
    expect(text).not.toContain("−1.15 kg")

    // Closing stock should remain exactly equal to Opening stock (10 kg, 10 kg, 5 kg)
    expect(text).toContain("10 kg")
    expect(text).toContain("5 kg")
    expect(text).not.toContain("8.5 kg")
    expect(text).not.toContain("8.85 kg")
  })

  test("does NOT deduct or reflect ingredient usage when unconfirmed or pending quote is in productions prop", async () => {
    const openingStock = [
      { id: "os-1", itemId: "inv-flour", name: "Flour", unit: "kg", cost: 1000, openingQty: 10 }
    ]

    // Quote that leaked into productions with status "quote" or "pending" without confirmed status
    const unconfirmedProds = [
      {
        id: "prod-quote-leak",
        status: "quote",
        isProd: false,
        deliveryDate: "2026-09-18",
        date: "2026-09-18",
        salePrice: 20000,
        cost: 6000,
        tiers: [
          {
            size: "8",
            shape: "Round",
            layers: [{ flavour: "Vanilla Cake", qty: 2 }]
          }
        ]
      },
      {
        id: "prod-pending-leak",
        status: "pending",
        isProd: false,
        deliveryDate: "2026-09-19",
        date: "2026-09-19",
        salePrice: 20000,
        cost: 6000,
        tiers: [
          {
            size: "8",
            shape: "Round",
            layers: [{ flavour: "Vanilla Cake", qty: 2 }]
          }
        ]
      }
    ]

    dataLib.loadLocal.mockImplementation((key, fallback) => {
      if (key === "ll_quotes") return []
      if (key === "ll_purchases") return []
      return fallback
    })
    dataLib.loadOpeningStock.mockReturnValue(openingStock)

    await act(async () => {
      root.render(
        <MonthlyOverview
          inventory={sampleInventory}
          recipes={sampleRecipes}
          productions={unconfirmedProds}
          expenses={[]}
          company={{ name: "Test Bakery" }}
          isOwner={true}
        />
      )
    })

    const text = container.textContent

    // Unconfirmed production items should NOT deduct stock
    expect(text).toContain("0 confirmed orders")
    expect(text).toContain("−0 kg")
    expect(text).toContain("10 kg")
    expect(text).not.toContain("8.5 kg")
  })
})
