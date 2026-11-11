global.IS_REACT_ACT_ENVIRONMENT = true

import React from "react"
import { createRoot } from "react-dom/client"
import { act } from "react"
import { ProductionSheet } from "./ProductionSheet.jsx"

describe("ProductionSheet Kitchen Operations Tests", () => {
  let container, root

  const mockInventory = [
    { id: "i-butter", name: "Unsalted Butter", cat: "Dairy", unit: "kg", cost: 8000, stock: 1.5 }, // short
    { id: "i-flour", name: "Plain Flour", cat: "Dry Goods", unit: "kg", cost: 1200, stock: 10.0 },
    { id: "i-sugar", name: "Granulated Sugar", cat: "Dry Goods", unit: "kg", cost: 1500, stock: 5.0 },
    { id: "i-eggs", name: "Fresh Eggs", cat: "Poultry", unit: "pcs", cost: 150, stock: 30 },
    { id: "i-milk", name: "Whole Milk", cat: "Dairy", unit: "L", cost: 2500, stock: 2.0 }
  ]

  const mockRecipes = [
    {
      id: "r-vanilla",
      name: "Vanilla Sponge",
      type: "cake_layer",
      cal_shape: "round",
      cal_dim_a: 9,
      cal_grams: 617,
      cal_height_in: 2,
      trim_pct: 0.08,
      yield_grams: 1800,
      batch_yield_g: 1800,
      ing: [
        { iid: "i-butter", name: "Unsalted Butter", qty: 250, unit: "g" },
        { iid: "i-sugar", name: "Granulated Sugar", qty: 250, unit: "g" },
        { iid: "i-eggs", name: "Fresh Eggs", qty: 250, unit: "g" },
        { iid: "i-flour", name: "Plain Flour", qty: 300, unit: "g" },
        { iid: "i-milk", name: "Whole Milk", qty: 150, unit: "g" }
      ]
    },
    {
      id: "r-bc",
      name: "Buttercream",
      type: "covering",
      can_fill: true,
      can_crumb: true,
      can_finish: true,
      thick_fill_mm: 4.5,
      thick_crumb_mm: 1.0,
      thick_finish_mm: 4.9,
      density_g_cm3: 0.90,
      waste_pct: 0.15,
      yield_grams: 1000,
      batch_yield_g: 1000,
      ing: [
        { iid: "i-butter", name: "Unsalted Butter", qty: 500, unit: "g" },
        { iid: "i-sugar", name: "Granulated Sugar", qty: 500, unit: "g" }
      ]
    }
  ]

  const mockOrder = {
    id: "ord-test-101",
    clientName: "Chief Mrs Alabi",
    clientPhone: "08098765432",
    deliveryDate: "2026-11-20",
    collectionTime: "14:00",
    items: [
      {
        id: "item-1",
        name: "Item 1 — 3-Tier Wedding Cake",
        type: "cake",
        tiers: [
          {
            id: "t-1",
            size: "10",
            shape: "Round",
            height: 4,
            layers: [{ flavour: "Vanilla Sponge", qty: 2 }]
          }
        ],
        coverings: [{ type: "Buttercream", grams: 460 }],
        fillings: [{ type: "Buttercream", grams: 230 }]
      },
      {
        id: "item-2",
        name: "Item 2 — Slices for Guests",
        type: "portions",
        route: "slab",
        servings: 50,
        sliceWidth: 2,
        sliceLength: 2,
        sliceHeight: 4,
        allowancePct: 5,
        panIndex: 0, // 9x13
        layers: [{ flavour: "Vanilla Sponge", qty: 2 }],
        fillingRecipe: "Buttercream",
        topFinishRecipe: "Buttercream"
      }
    ]
  }

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

  test("renders 3 kitchen tabs and defaults to Shopping List with shortfall alert", async () => {
    await act(async () => {
      root = createRoot(container)
      root.render(
        <ProductionSheet
          order={mockOrder}
          inventory={mockInventory}
          recipes={mockRecipes}
        />
      )
    })

    // Header & Order Details
    expect(container.textContent).toContain("Production Sheet")
    expect(container.textContent).toContain("Chief Mrs Alabi")
    expect(container.textContent).toContain("2026-11-20")

    // The 3 tabs must be present
    expect(container.textContent).toContain("Shopping List")
    expect(container.textContent).toContain("Bake Sheet")
    expect(container.textContent).toContain("Build Order")

    // Tab 1: Shopping list
    expect(container.textContent).toContain("Aggregated Shopping List")
    // Aggregation: Butter runs across sponge + buttercream and is short
    expect(container.textContent).toContain("Shortfall Alert")
    expect(container.textContent).toContain("Unsalted Butter")

    // Conventions: Eggs in pieces and liquids in litres
    expect(container.textContent).toContain("Fresh Eggs")
    expect(container.textContent).toContain("pcs")
    expect(container.textContent).toContain("Whole Milk")

    // Unrounded batches table
    expect(container.textContent).toContain("Batches to Mix")
    expect(container.textContent).toContain("Vanilla Sponge")
    expect(container.textContent).toContain("Buttercream")
  })

  test("switches to Bake Sheet tab and renders numbered weigh-outs and scaled recipe cards", async () => {
    await act(async () => {
      root = createRoot(container)
      root.render(
        <ProductionSheet
          order={mockOrder}
          inventory={mockInventory}
          recipes={mockRecipes}
        />
      )
    })

    // Click Bake Sheet tab
    const tabs = Array.from(container.querySelectorAll("button"))
    const bakeTab = tabs.find(b => b.textContent.includes("Bake Sheet"))
    expect(bakeTab).toBeTruthy()

    await act(async () => {
      bakeTab.click()
    })

    // Tab 2 content
    expect(container.textContent).toContain("Numbered Pan Weigh-Outs")
    expect(container.textContent).toContain("Vanilla Sponge")

    // Numbered pan lines (Pan 1, Pan 2...)
    expect(container.textContent).toContain("Pan 1")
    expect(container.textContent).toContain("Pan 2")

    // Scaled Recipe Cards (with per pan and total columns)
    expect(container.textContent).toContain("Scaled Recipe Cards")
    expect(container.textContent).toContain("Into each pan")
    expect(container.textContent).toContain("Across all pans")
  })

  test("switches to Build Order tab and displays scheduled assembly timeline", async () => {
    await act(async () => {
      root = createRoot(container)
      root.render(
        <ProductionSheet
          order={mockOrder}
          inventory={mockInventory}
          recipes={mockRecipes}
        />
      )
    })

    // Click Build Order tab
    const tabs = Array.from(container.querySelectorAll("button"))
    const buildTab = tabs.find(b => b.textContent.includes("Build Order"))
    expect(buildTab).toBeTruthy()

    await act(async () => {
      buildTab.click()
    })

    // Tab 3 content
    expect(container.textContent).toContain("Build Order & Rest Timeline")
    expect(container.textContent).toContain("Bake")
    expect(container.textContent).toContain("Chill")
  })
})
