global.IS_REACT_ACT_ENVIRONMENT = true

import React from "react"
import { createRoot } from "react-dom/client"
import { act } from "react"
import { MonthlyOverview } from "./MonthlyOverview"
import { normalizeToIsoDate } from "../money/ReceiptScanner"
import * as dataLib from "../../lib/data"

// Mock data library
jest.mock("../../lib/data", () => ({
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
  calculateOrderUsages: jest.fn().mockReturnValue([]),
  loadOpeningStock: jest.fn().mockReturnValue([]),
  getAuthHeaders: jest.fn().mockReturnValue({ Authorization: "Bearer test" })
}))

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
    today: () => "2026-09-06"
  }
})

describe("Receipt Scanner Date Normalization & Monthly Overview Purchases Sync", () => {
  describe("normalizeToIsoDate", () => {
    test("returns ISO date as-is", () => {
      expect(normalizeToIsoDate("2026-09-06")).toBe("2026-09-06")
    })

    test("converts DD/MM/YYYY to YYYY-MM-DD", () => {
      expect(normalizeToIsoDate("06/09/2026")).toBe("2026-09-06")
      expect(normalizeToIsoDate("6/9/2026")).toBe("2026-09-06")
    })

    test("converts DD-MM-YYYY to YYYY-MM-DD", () => {
      expect(normalizeToIsoDate("06-09-2026")).toBe("2026-09-06")
    })

    test("converts YYYY/MM/DD to YYYY-MM-DD", () => {
      expect(normalizeToIsoDate("2026/09/06")).toBe("2026-09-06")
    })

    test("falls back gracefully on empty or invalid input", () => {
      expect(normalizeToIsoDate("")).toBe("2026-09-06")
      expect(normalizeToIsoDate(null)).toBe("2026-09-06")
    })
  })

  describe("MonthlyOverview Purchases & Stock Movement Integration", () => {
    let container
    let root

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

    test("renders + Bought and Closing stock from purchasesList for the selected month", async () => {
      const mockInventory = [
        { id: "inv-1", name: "Flour", unit: "kg", cost: 1000, stock: 15, minStock: 5 }
      ]
      const mockOpeningStock = [
        { id: "os-1", itemId: "inv-1", name: "Flour", unit: "kg", cost: 1000, openingQty: 10 }
      ]
      const mockPurchases = [
        { id: "pur-1", date: "2026-09-06", itemId: "inv-1", item: "Flour", unit: "kg", stockAdded: 5, total: 5000 }
      ]

      dataLib.loadLocal.mockImplementation((key, fallback) => {
        if (key === "ll_purchases") return mockPurchases
        if (key === "ll_quotes") return []
        return fallback
      })
      dataLib.loadOpeningStock.mockReturnValue(mockOpeningStock)
      dataLib.fetchPaginatedPurchases.mockResolvedValue({
        data: mockPurchases,
        pagination: { total: 1 },
        stats: { totalSpent: 5000, totalPurchases: 1 }
      })

      await act(async () => {
        root.render(
          <MonthlyOverview
            inventory={mockInventory}
            recipes={[]}
            productions={[]}
            expenses={[]}
            company={{ name: "Test Bakery" }}
            isOwner={true}
          />
        )
      })

      // Check that + Bought displays +5 and Closing displays 15 (Opening 10 + Bought 5 - Used 0)
      expect(container.textContent).toContain("Flour")
      expect(container.textContent).toContain("+5 kg")
      expect(container.textContent).toContain("15 kg")
      expect(container.textContent).toContain("Purchases this month")
      expect(container.textContent).toContain("Total spent on ingredients")
    })

    test("updates purchasesList in real time upon receiving layerledger:purchases-updated event", async () => {
      const mockInventory = [
        { id: "inv-1", name: "Sugar", unit: "kg", cost: 800, stock: 0, minStock: 5 }
      ]

      let currentPurchases = []
      dataLib.loadLocal.mockImplementation((key, fallback) => {
        if (key === "ll_purchases") return currentPurchases
        return fallback
      })

      await act(async () => {
        root.render(
          <MonthlyOverview
            inventory={mockInventory}
            recipes={[]}
            productions={[]}
            expenses={[]}
            company={{ name: "Test Bakery" }}
            isOwner={true}
          />
        )
      })

      expect(container.textContent).toContain("No purchases logged")

      // Simulate receipt scan saving purchases and dispatching event
      currentPurchases = [
        { id: "pur-2", date: "2026-09-06", itemId: "inv-1", item: "Sugar", unit: "kg", stockAdded: 25, total: 20000 }
      ]

      await act(async () => {
        window.dispatchEvent(new CustomEvent("layerledger:purchases-updated", { detail: { purchases: currentPurchases } }))
      })

      expect(container.textContent).toContain("+25 kg")
      expect(container.textContent).toContain("Sugar")
      expect(container.textContent).toContain("₦20000")
    })
  })
})
