global.IS_REACT_ACT_ENVIRONMENT = true

import React from "react"
import { createRoot } from "react-dom/client"
import { act } from "react"
import { QuotesPage } from "./QuotesPage"
import * as dataLib from "../../lib/data"

let mockQuotesList = []

const resetQuotes = () => {
  mockQuotesList = [
    {
      id: "quote-101",
      clientName: "Grace Eze",
      clientPhone: "08099887766",
      status: "pending",
      date: "2026-09-18",
      productType: "Cake",
      totalCost: 12000,
      salePrice: 25000,
      deliveryDate: "2026-09-25",
      tiers: [
        {
          id: "t-1",
          size: "8",
          shape: "Round",
          layers: [{ flavour: "Red Velvet", qty: 1 }],
          coverings: [{ type: "Buttercream" }]
        }
      ]
    }
  ]
}

// Mock data library
jest.mock("../../lib/data", () => ({
  loadCompany: jest.fn(() => ({ name: "BakeWealth", primaryColor: "#B58A2A" })),
  loadQuotes: jest.fn(() => mockQuotesList),
  saveQuotes: jest.fn(async (q) => {
    mockQuotesList = q
    return true
  }),
  saveInventory: jest.fn().mockResolvedValue(true),
  saveProduction: jest.fn().mockResolvedValue(true),
  loadExpenses: jest.fn(() => []),
  saveExpenses: jest.fn().mockResolvedValue(true),
  saveLocal: jest.fn().mockResolvedValue(true),
  loadLocal: jest.fn((key, fallback) => fallback),
  calculateOrderUsages: jest.fn(() => []),
  updateInventoryItemOnServer: jest.fn().mockResolvedValue(true)
}))

// Mock UI components
jest.mock("../common/ui.jsx", () => ({
  Btn: ({ children, onClick, disabled }) => <button onClick={onClick} disabled={disabled}>{children}</button>,
  Card: ({ children, style }) => <div className="card" style={style}>{children}</div>,
  SHead: ({ title, sub }) => <div><h2>{title}</h2><p>{sub}</p></div>,
  Pagination: () => <div data-testid="pagination" />,
  iSt: {}
}))

describe("Quotes Confirmation and Sync Resilience", () => {
  let container, root

  beforeEach(() => {
    resetQuotes()
    container = document.createElement("div")
    document.body.appendChild(container)
    jest.clearAllMocks()
    window.alert = jest.fn()
    window.confirm = jest.fn(() => true)
  })

  afterEach(() => {
    if (root) {
      act(() => { root.unmount() })
      root = null
    }
    if (container && container.parentNode) {
      document.body.removeChild(container)
    }
    container = null
  })

  test("confirming a quote saves confirmed status, timestamp, and creates production record", async () => {
    const mockInventory = [{ id: "inv-1", name: "Flour", stock: 50, unit: "kg" }]
    const mockRecipes = []
    const setInventory = jest.fn()
    const setProductions = jest.fn()

    await act(async () => {
      root = createRoot(container)
      root.render(
        <QuotesPage
          inventory={mockInventory}
          setInventory={setInventory}
          recipes={mockRecipes}
          setView={jest.fn()}
          productions={[]}
          setProductions={setProductions}
        />
      )
    })

    // Expand the quote card
    const cardHeader = container.querySelector(".card > div")
    expect(cardHeader).not.toBeNull()
    await act(async () => {
      cardHeader.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    })

    // Find the 'Confirm order' button
    const buttons = Array.from(container.querySelectorAll("button"))
    const confirmBtn = buttons.find(b => b.textContent.includes("Confirm order"))
    expect(confirmBtn).toBeDefined()

    // Click confirm order
    await act(async () => {
      confirmBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    })

    // saveQuotes should have been called with status: "confirmed" and a confirmedAt timestamp
    expect(dataLib.saveQuotes).toHaveBeenCalledTimes(1)
    const savedQuotesArg = dataLib.saveQuotes.mock.calls[0][0]
    expect(savedQuotesArg[0].status).toBe("confirmed")
    expect(savedQuotesArg[0].confirmedAt).toBeDefined()
    expect(typeof savedQuotesArg[0].confirmedAt).toBe("string")
    expect(savedQuotesArg[0].isProd).toBe(false)

    // saveProduction should have been called with quoteId and fromQuote: true
    expect(dataLib.saveProduction).toHaveBeenCalledTimes(1)
    const savedProdArg = dataLib.saveProduction.mock.calls[0][0]
    expect(savedProdArg.quoteId).toBe("quote-101")
    expect(savedProdArg.fromQuote).toBe(true)
    expect(savedProdArg.isProd).toBe(true)

    // UI should display 'Confirmed' badge and locked message
    expect(container.textContent).toContain("Confirmed")
    expect(container.textContent).toContain("permanently locked")
  })

  test("self-heals and locks quote when matching production order exists", async () => {
    const mockInventory = []
    const mockRecipes = []
    const existingProductions = [
      {
        id: "prod-999",
        quoteId: "quote-101",
        fromQuote: true,
        isProd: true,
        client: "Grace Eze",
        status: "pending",
        confirmedAt: "2026-09-18T12:00:00.000Z"
      }
    ]

    await act(async () => {
      root = createRoot(container)
      root.render(
        <QuotesPage
          inventory={mockInventory}
          setInventory={jest.fn()}
          recipes={mockRecipes}
          setView={jest.fn()}
          productions={existingProductions}
          setProductions={jest.fn()}
        />
      )
    })

    // Despite initial quote having status: "pending", matching production auto-heals and marks it Confirmed
    expect(container.textContent).toContain("Confirmed")

    // Expand quote card
    const cardHeader = container.querySelector(".card > div")
    await act(async () => {
      cardHeader.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    })

    // Confirm button and Edit button should not be rendered because it's locked
    const buttons = Array.from(container.querySelectorAll("button"))
    const confirmBtn = buttons.find(b => b.textContent.includes("Confirm order"))
    expect(confirmBtn).toBeUndefined()
    expect(container.textContent).toContain("The Edit and Confirm buttons are permanently locked")
  })
})
