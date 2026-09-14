global.IS_REACT_ACT_ENVIRONMENT = true

import React from "react"
import { createRoot } from "react-dom/client"
import { act } from "react"
import { QuotesPage } from "./QuotesPage"
import * as dataLib from "../../lib/data"

// Mock data library
jest.mock("../../lib/data", () => ({
  loadCompany: jest.fn(() => ({ name: "BakeWealth", primaryColor: "#B58A2A" })),
  loadQuotes: jest.fn(() => [
    {
      id: "q-1",
      clientName: "Amaka Obi",
      clientPhone: "08012345678",
      clientEmail: "amaka@example.com",
      status: "pending",
      date: "2026-09-14",
      productType: "Cake",
      totalCost: 15000,
      quotePrice: 28000,
      salePrice: 28000,
      hasMultiDeliveryDates: true,
      deliveryDate: "2026-09-20",
      items: [
        {
          id: "item-1",
          type: "cake",
          name: "Item 1 — Wedding Cake",
          deliveryDate: "2026-09-20",
          collectionTime: "14:00",
          sameDeliveryAsFirst: false,
          tiers: [
            {
              id: "t-1",
              size: "10",
              shape: "Round",
              layers: [{ id: "l-1", flavour: "Vanilla", qty: 2 }],
              coverings: [{ id: "c-1", type: "Buttercream" }]
            }
          ]
        },
        {
          id: "item-2",
          type: "cake",
          name: "Item 2 — Cutting Cake",
          deliveryDate: "2026-09-21",
          collectionTime: "10:00",
          sameDeliveryAsFirst: false,
          tiers: [
            {
              id: "t-2",
              size: "8",
              shape: "Round",
              layers: [{ id: "l-2", flavour: "Chocolate", qty: 1 }],
              coverings: [{ id: "c-2", type: "Fondant" }]
            }
          ]
        }
      ]
    }
  ]),
  saveQuotes: jest.fn().mockResolvedValue(true),
  saveInventory: jest.fn().mockResolvedValue(true),
  saveProduction: jest.fn().mockResolvedValue(true),
  loadExpenses: jest.fn(() => []),
  saveExpenses: jest.fn().mockResolvedValue(true),
  saveLocal: jest.fn().mockResolvedValue(true),
  loadLocal: jest.fn((key, fallback) => fallback),
  calculateOrderUsages: jest.fn(() => ({ usages: [], warnings: [] })),
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

describe("QuotesPage Calendar reference test", () => {
  let container, root

  beforeEach(() => {
    container = document.createElement("div")
    document.body.appendChild(container)
  })

  afterEach(() => {
    if (root) {
      act(() => { root.unmount() })
      root = null
    }
    document.body.removeChild(container)
    container = null
  })

  it("should render quotes with multi-delivery schedule and items without Calendar ReferenceError", async () => {
    await act(async () => {
      root = createRoot(container)
      root.render(
        <QuotesPage
          inventory={[]}
          setInventory={jest.fn()}
          recipes={[]}
          setView={jest.fn()}
          productions={[]}
          setProductions={jest.fn()}
        />
      )
    })

    // Click on the quote card header with cursor: pointer to expand it
    const quoteHeader = Array.from(container.querySelectorAll("div")).find(
      d => d.style.cursor === "pointer" && d.textContent.includes("Amaka Obi")
    )
    expect(quoteHeader).toBeDefined()

    await act(async () => {
      quoteHeader.click()
    })

    // Verify it expanded and rendered Multi-Date Delivery Schedule with Calendar icon
    expect(container.textContent).toContain("Multi-Date Delivery Schedule (2 cakes)")
    expect(container.textContent).toContain("Item 1 — Wedding Cake")
    expect(container.textContent).toContain("Item 2 — Cutting Cake")
  })
})
