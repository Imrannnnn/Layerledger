global.IS_REACT_ACT_ENVIRONMENT = true;

import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { ProductionSheet } from "./ProductionSheet.jsx";
import * as accountingApi from "../../lib/accountingApi.js";

// Mock accountingApi.bakeOrder
jest.mock("../../lib/accountingApi.js", () => ({
  bakeOrder: jest.fn(() => Promise.resolve({ ok: true, journalEntryId: "je-prod-bake" }))
}));

describe("Production Sheet Specification Tests (11 Requirements)", () => {
  let container, root;

  // Inventory items
  const mockInventory = [
    { id: "i-butter", name: "Unsalted Butter", cat: "Dairy", unit: "kg", cost: 8000, stock: 0.5 }, // 500g in stock (will be short)
    { id: "i-flour", name: "Plain Flour", cat: "Dry Goods", unit: "kg", cost: 1200, stock: 10.0 }, // 10,000g (sufficient)
    { id: "i-sugar", name: "Granulated Sugar", cat: "Dry Goods", unit: "kg", cost: 1500, stock: 5.0 },
    { id: "i-eggs", name: "Fresh Eggs", cat: "Poultry", unit: "pcs", cost: 150, stock: 50 },
    { id: "i-milk", name: "Whole Milk", cat: "Dairy", unit: "L", cost: 2500, stock: 5.0 },
    { id: "i-cocoa", name: "Cocoa Powder", cat: "Dry Goods", unit: "g", cost: 5, stock: 2000 },
    { id: "i-gumpaste", name: "Gum Paste", cat: "Decoration Extra", unit: "g", cost: 15, stock: 1000 },
    { id: "i-wire", name: "Floral Wire", cat: "Decoration Extra", unit: "pcs", cost: 50, stock: 200 },
    { id: "i-colour", name: "Gel Colour (Rose Pink)", cat: "Decoration Extra", unit: "g", cost: 30, stock: 100 }
  ];

  // Recipes covering cake layers, covering, and made decoration
  const mockRecipes = [
    {
      id: "r-vanilla",
      name: "Vanilla Sponge",
      type: "cake_layer",
      recipe_type: "cake_layer",
      cal_shape: "round",
      cal_dim_a: 9,
      cal_dim_b: 9,
      cal_height_in: 2,
      cal_grams: 617, // density = 617 / (pi * 4.5^2) / 2 = ~4.849
      density: 4.849,
      trim_pct: 0.08,
      yield_grams: 2400,
      batch_yield_g: 2400,
      ing: [
        { iid: "i-butter", name: "Unsalted Butter", qty: 350, unit: "g" },
        { iid: "i-sugar", name: "Granulated Sugar", qty: 400, unit: "g" },
        { iid: "i-eggs", name: "Fresh Eggs", qty: 350, unit: "g" },
        { iid: "i-flour", name: "Plain Flour", qty: 500, unit: "g" },
        { iid: "i-milk", name: "Whole Milk", qty: 800, unit: "g" } // 800g milk to test litre conversion >= 400g
      ]
    },
    {
      id: "r-chocolate",
      name: "Chocolate Sponge",
      type: "cake_layer",
      recipe_type: "cake_layer",
      cal_shape: "round",
      cal_dim_a: 9,
      cal_dim_b: 9,
      cal_height_in: 2,
      cal_grams: 750, // higher density = 750 / (pi * 4.5^2) / 2 = ~5.894
      density: 5.894,
      trim_pct: 0.08,
      yield_grams: 2500,
      batch_yield_g: 2500,
      ing: [
        { iid: "i-butter", name: "Unsalted Butter", qty: 350, unit: "g" },
        { iid: "i-sugar", name: "Granulated Sugar", qty: 450, unit: "g" },
        { iid: "i-eggs", name: "Fresh Eggs", qty: 350, unit: "g" },
        { iid: "i-flour", name: "Plain Flour", qty: 450, unit: "g" },
        { iid: "i-cocoa", name: "Cocoa Powder", qty: 100, unit: "g" },
        { iid: "i-milk", name: "Whole Milk", qty: 800, unit: "g" }
      ]
    },
    {
      id: "r-buttercream",
      name: "Swiss Buttercream",
      type: "covering",
      recipe_type: "covering",
      can_fill: true,
      can_crumb: true,
      can_finish: true,
      thickness_fill: 4.5,
      thickness_crumb: 1.0,
      thickness_finish: 4.9,
      density: 0.90,
      waste_pct: 0.15,
      yield_grams: 1000,
      batch_yield_g: 1000,
      ing: [
        { iid: "i-butter", name: "Unsalted Butter", qty: 600, unit: "g" },
        { iid: "i-sugar", name: "Granulated Sugar", qty: 400, unit: "g" }
      ]
    },
    {
      id: "r-sugar-roses",
      name: "Sugar Roses",
      type: "pastry",
      recipe_type: "pastry", // Made-by-the-piece decoration
      per_batch: 24, // 24 pieces per batch
      batchSize: 24,
      breakage_pct: 10, // 10% breakage allowance -> 18 pieces needed requires 20 pieces to make
      breakagePct: 10,
      ingredients: [
        { iid: "i-gumpaste", name: "Gum Paste", qty: 300, unit: "g" },
        { iid: "i-wire", name: "Floral Wire", qty: 24, unit: "pcs" },
        { iid: "i-colour", name: "Gel Colour (Rose Pink)", qty: 10, unit: "g" }
      ]
    }
  ];

  // Confirmed Order
  const mockOrder = {
    id: "ord-wedding-2026",
    status: "confirmed",
    confirmedAt: "2026-11-16T10:00:00Z",
    clientName: "Folashade Tinubu",
    deliveryDate: "2026-11-20",
    totalCost: 45000,
    items: [
      {
        id: "item-cake-1",
        name: "2-Tier Celebration Cake",
        type: "cake",
        tiers: [
          {
            id: "tier-1",
            shape: "round",
            size: 10,
            height: 4, // 4" total height with 2 layers -> 2.0" layer thickness
            flavourRows: [
              { recipeId: "r-vanilla", flavour: "Vanilla Sponge", layers: 1 },
              { recipeId: "r-chocolate", flavour: "Chocolate Sponge", layers: 1 }
            ]
          }
        ],
        fillings: [{ recipeId: "r-buttercream", type: "Swiss Buttercream" }],
        crumb: "None",
        finish: "Swiss Buttercream",
        // 18 Made Sugar Roses
        decQty: {
          "r-sugar-roses": 18
        }
      }
    ]
  };

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    jest.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  test("Requirement 1: Generated when order is confirmed, not before; promises no stock moves at confirmation", () => {
    act(() => {
      root.render(
        <ProductionSheet
          order={mockOrder}
          recipes={mockRecipes}
          inventory={mockInventory}
        />
      );
    });

    // Verify confirmation badge
    expect(container.textContent).toContain("Confirmed Order");

    // Verify the explicit confirmation promise
    expect(container.textContent).toContain("Generated when the order is confirmed");
    expect(container.textContent).toContain(
      "A confirmed order is a promise. Nothing in stock or in the accounts moves at confirmation; inventory moves to Finished Goods when you click Mark as Baked."
    );

    // Verify bakeOrder was NOT called merely by opening/generating the sheet
    expect(accountingApi.bakeOrder).not.toHaveBeenCalled();
  });

  test("Requirement 2: Shopping list aggregated once across every recipe on the order (Butter appears on one line)", () => {
    act(() => {
      root.render(
        <ProductionSheet
          order={mockOrder}
          recipes={mockRecipes}
          inventory={mockInventory}
        />
      );
    });

    // Tab 1 (Shopping List) is active by default
    // Butter runs through Vanilla Sponge, Chocolate Sponge, and Swiss Buttercream
    // It must appear as ONE entry in the shopping list, not three separate entries
    const shoppingListCard = container.querySelector(".sheet-card");
    expect(shoppingListCard).toBeTruthy();

    const butterEntries = Array.from(container.querySelectorAll(".sheet-card div")).filter(
      el => el.textContent === "Unsalted Butter"
    );
    // Should only have 1 single primary title for Unsalted Butter
    expect(butterEntries.length).toBe(1);

    // The sources listed for Unsalted Butter should include all contributing recipes
    expect(container.textContent).toContain("Sources: Vanilla Sponge, Chocolate Sponge, Swiss Buttercream");
  });

  test("Requirement 3: Stock check on every shopping line (Needed, In Stock, Short) with top shortfall warning", () => {
    act(() => {
      root.render(
        <ProductionSheet
          order={mockOrder}
          recipes={mockRecipes}
          inventory={mockInventory}
        />
      );
    });

    // Check headers
    expect(container.textContent).toContain("Needed · In Stock · Short");

    // Butter has only 0.5 kg (500g) on hand, but total needed is > 800g, so it must trigger a shortfall warning
    expect(container.textContent).toContain("Shortfall Alert");
    expect(container.textContent).toContain("Unsalted Butter");
    expect(container.textContent).toContain("Short by");

    // Plain Flour has 10 kg in stock, which is sufficient
    expect(container.textContent).toContain("Sufficient ✓");
  });

  test("Requirement 4: Sub-units where a baker thinks in them (Eggs as pieces @ 50g, Liquids in litres once >= 400g)", () => {
    act(() => {
      root.render(
        <ProductionSheet
          order={mockOrder}
          recipes={mockRecipes}
          inventory={mockInventory}
        />
      );
    });

    // Fresh Eggs: Vanilla (350g base) + Chocolate (350g base) scaled to pans
    // Egg sub-unit should show "pcs @ 50g"
    expect(container.textContent).toMatch(/\d+\s+pcs @ 50g/);

    // Whole Milk: Vanilla + Chocolate milk needed is >= 400g (500g each in base -> ~460g needed)
    // Liquid sub-unit should show "L"
    expect(container.textContent).toMatch(/[\d.]+\s+L/);
  });

  test("Requirement 5: Batch counts shown unrounded in Batches to Mix table", () => {
    act(() => {
      root.render(
        <ProductionSheet
          order={mockOrder}
          recipes={mockRecipes}
          inventory={mockInventory}
        />
      );
    });

    // Check Batches to Mix table exists
    expect(container.textContent).toContain("Batches to Mix (Batch Counts Shown Unrounded)");
    expect(container.textContent).toContain("Batch counts are shown unrounded (e.g. 12.89 batches means scale ingredients by 12.89)");

    // Batch counts must not be forced whole numbers like "1 batches" or "2 batches"
    // They must have decimal precision (e.g. "0.49 batches", "0.58 batches", "0.83 batches")
    expect(container.textContent).toMatch(/\d+\.\d{2}\s+batches/);
  });

  test("Requirement 6: Weigh-out list: every pan listed individually with calibrated pour weights", () => {
    act(() => {
      root.render(
        <ProductionSheet
          order={mockOrder}
          recipes={mockRecipes}
          inventory={mockInventory}
        />
      );
    });

    // Switch to Tab 2: Bake Sheet
    const bakeTabBtn = Array.from(container.querySelectorAll("button")).find(
      btn => btn.textContent.includes("2. Bake Sheet")
    );
    expect(bakeTabBtn).toBeTruthy();

    act(() => {
      bakeTabBtn.click();
    });

    // Check header
    expect(container.textContent).toContain("Weigh-Out List: Every Pan Listed Individually");

    // Both Pan 1 and Pan 2 are 10" round with 2.00" layer thickness,
    // but Pan 1 (Vanilla) and Pan 2 (Chocolate) have different densities (4.849 vs 5.894),
    // so they MUST carry different calibrated gram pour weights!
    expect(container.textContent).toContain("Pan 1");
    expect(container.textContent).toContain("Pan 2");
    expect(container.textContent).toContain("Vanilla Sponge");
    expect(container.textContent).toContain("Chocolate Sponge");
    expect(container.textContent).toContain("10″ round · 2.00″ layer thickness");

    // Vanilla grams vs Chocolate grams:
    // Vanilla: density 4.849 * (pi * 5^2) * 2 * (1 + 0.08) = ~823 g
    // Chocolate: density 5.894 * (pi * 5^2) * 2 * (1 + 0.08) = ~1,000 g
    expect(container.textContent).toMatch(/823\s*g/);
    expect(container.textContent).toMatch(/1,000\s*g/);
  });

  test("Requirement 7: Scaled recipe card for each pan-size-and-flavour group (actual flour, butter, eggs, milk)", () => {
    act(() => {
      root.render(
        <ProductionSheet
          order={mockOrder}
          recipes={mockRecipes}
          inventory={mockInventory}
        />
      );
    });

    // Switch to Tab 2: Bake Sheet
    const bakeTabBtn = Array.from(container.querySelectorAll("button")).find(
      btn => btn.textContent.includes("2. Bake Sheet")
    );
    act(() => {
      bakeTabBtn.click();
    });

    expect(container.textContent).toContain("Scaled Kitchen Cards (Scaled Recipe Cards by Pan & Flavour Group)");

    // Vanilla Sponge card must show actual scaled ingredients
    expect(container.textContent).toContain("Vanilla Sponge");
    expect(container.textContent).toContain("Into each pan");
    expect(container.textContent).toContain("Plain Flour");
    expect(container.textContent).toContain("Unsalted Butter");
    expect(container.textContent).toContain("Fresh Eggs");
    expect(container.textContent).toContain("Whole Milk");
    expect(container.textContent).toContain("Total Batter");
  });

  test("Requirement 10: Made decoration carries its ingredients onto this sheet with breakage allowance (18 roses -> 20 to make)", () => {
    act(() => {
      root.render(
        <ProductionSheet
          order={mockOrder}
          recipes={mockRecipes}
          inventory={mockInventory}
        />
      );
    });

    // A. Check Shopping List (Tab 1) has Sugar Roses ingredients: Gum paste, Floral wire, Gel colour
    expect(container.textContent).toContain("Gum Paste");
    expect(container.textContent).toContain("Floral Wire");
    expect(container.textContent).toContain("Gel Colour (Rose Pink)");

    // B. Switch to Tab 2 (Bake Sheet)
    const bakeTabBtn = Array.from(container.querySelectorAll("button")).find(
      btn => btn.textContent.includes("2. Bake Sheet")
    );
    act(() => {
      bakeTabBtn.click();
    });

    // Check Made Decoration Recipe Cards section
    expect(container.textContent).toContain("Made Decoration Recipe Cards (Scaled with Breakage Allowance)");
    expect(container.textContent).toContain("Sugar Roses");

    // 18 pieces needed + 10% breakage = 20 pieces to make!
    expect(container.textContent).toContain("18 pcs needed + 10% breakage = 20 pcs to make");

    // Base yield is 24, so scale factor is 20 / 24 = 0.833 batches
    expect(container.textContent).toContain("0.833 batches (20 ÷ 24 base yield)");

    // Shows per piece and total scaled ingredients
    expect(container.textContent).toContain("Per piece");
    expect(container.textContent).toContain("Across all 20 pieces");
  });

  test("Requirement 11: Made decoration gets its own step at the front of the build order (drying time)", () => {
    act(() => {
      root.render(
        <ProductionSheet
          order={mockOrder}
          recipes={mockRecipes}
          inventory={mockInventory}
        />
      );
    });

    // Switch to Tab 3: Build Order
    const timelineTabBtn = Array.from(container.querySelectorAll("button")).find(
      btn => btn.textContent.includes("3. Build Order")
    );
    expect(timelineTabBtn).toBeTruthy();

    act(() => {
      timelineTabBtn.click();
    });

    // Check Build Order sequence
    expect(container.textContent).toContain("Build Order & Rest Timeline");

    // Sugar roses must be Step 1 (at the FRONT of the build order)
    expect(container.textContent).toContain("Make & dry Sugar Roses");
    expect(container.textContent).toContain("2 days ahead (Before bake)");
    expect(container.textContent).toContain("Sugar Roses require 2 days drying time to set. Make 20 pieces (18 needed + 2 breakage allowance)");

    // Sponge bake is subsequent to the decoration step
    expect(container.textContent).toContain("Bake all sponge layers & slabs");
    expect(container.textContent).toContain("Fill & crumb coat · Chill");
    expect(container.textContent).toContain("Outside finish & mount decorations");

    // Verify ordering in DOM: Made decor step comes BEFORE the bake step
    const decorIndex = container.textContent.indexOf("Make & dry Sugar Roses");
    const bakeIndex = container.textContent.indexOf("Bake all sponge layers & slabs");
    expect(decorIndex).toBeGreaterThan(-1);
    expect(bakeIndex).toBeGreaterThan(-1);
    expect(decorIndex).toBeLessThan(bakeIndex);
  });

  test("Requirement 8: Generated build order is editable and the baker's custom version is kept", () => {
    const handleSaveOrder = jest.fn();

    act(() => {
      root.render(
        <ProductionSheet
          order={mockOrder}
          recipes={mockRecipes}
          inventory={mockInventory}
          onSaveOrder={handleSaveOrder}
        />
      );
    });

    // Switch to Tab 3: Build Order
    const timelineTabBtn = Array.from(container.querySelectorAll("button")).find(
      btn => btn.textContent.includes("3. Build Order")
    );
    act(() => {
      timelineTabBtn.click();
    });

    // Find and click the "Edit" button on the first step
    const editBtns = Array.from(container.querySelectorAll("button")).filter(
      btn => btn.textContent.includes("Edit")
    );
    expect(editBtns.length).toBeGreaterThan(0);

    act(() => {
      editBtns[0].click();
    });

    // Verify textarea appears
    const textarea = container.querySelector("textarea");
    expect(textarea).toBeTruthy();

    // Type custom note using HTML prototype setter for React input event dispatch
    act(() => {
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
      nativeSetter.call(textarea, "Custom Baker Instruction: Start petal drying in dehydrator at 35°C.");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      textarea.dispatchEvent(new Event("change", { bubbles: true }));
    });

    // Save step
    const saveBtn = Array.from(container.querySelectorAll("button")).find(
      btn => btn.textContent.includes("Save Step")
    );
    expect(saveBtn).toBeTruthy();

    act(() => {
      saveBtn.click();
    });

    // Verify text updated in the DOM
    expect(container.textContent).toContain("Custom Baker Instruction: Start petal drying in dehydrator at 35°C.");

    // Verify onSaveOrder called with metadata preserving custom timeline
    expect(handleSaveOrder).toHaveBeenCalled();
    const savedOrderArg = handleSaveOrder.mock.calls[0][0];
    expect(savedOrderArg.metadata.productionSheet.timeline[0].desc).toBe(
      "Custom Baker Instruction: Start petal drying in dehydrator at 35°C."
    );
  });

  test("Requirement 9: 'Mark as Baked' action triggers raw-materials-to-finished-goods Section 8 move", async () => {
    const handleSaveOrder = jest.fn();
    const handleMarkBaked = jest.fn();

    act(() => {
      root.render(
        <ProductionSheet
          order={mockOrder}
          recipes={mockRecipes}
          inventory={mockInventory}
          onSaveOrder={handleSaveOrder}
          onMarkBaked={handleMarkBaked}
        />
      );
    });

    // "Mark as Baked" button exists in the header
    const markBakedBtn = Array.from(container.querySelectorAll("button")).find(
      btn => btn.textContent.includes("Mark as Baked")
    );
    expect(markBakedBtn).toBeTruthy();

    // Click "Mark as Baked"
    await act(async () => {
      markBakedBtn.click();
    });

    // 1. bakeOrder API is called with the order ID to post Dr 1160 Finished Goods / Cr 1140 Raw Materials
    expect(accountingApi.bakeOrder).toHaveBeenCalledWith(
      "ord-wedding-2026",
      expect.objectContaining({ actualIngredientCost: 45000 })
    );

    // 2. Status message displayed to baker
    expect(container.textContent).toContain("Order marked as baked! Raw materials moved to finished goods inventory (Section 8)");

    // 3. Status changes to "Baked" badge with checkmark
    expect(container.textContent).toContain("Baked");

    // 4. Callbacks invoked
    expect(handleSaveOrder).toHaveBeenCalledWith(
      expect.objectContaining({ isBaked: true, status: "ready" })
    );
    expect(handleMarkBaked).toHaveBeenCalledWith(
      expect.objectContaining({ isBaked: true, status: "ready" })
    );
  });
});
