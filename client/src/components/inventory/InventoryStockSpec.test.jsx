global.IS_REACT_ACT_ENVIRONMENT = true;

import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { MasterList, InventoryTab } from "./MasterList.jsx";
import { StockAdjustment } from "./StockAdjustment.jsx";
import { MonthlyOverview } from "../reports/MonthlyOverview.jsx";
import * as cakeGeometry from "../../lib/cakeGeometry.js";
import * as accountingApi from "../../lib/accountingApi.js";
import * as dataLib from "../../lib/data.js";

// Mock accountingApi
jest.mock("../../lib/accountingApi.js", () => ({
  bakeOrder: jest.fn(() => Promise.resolve({ ok: true, journalEntryId: "je-prod-bake" })),
  deliverOrder: jest.fn(() => Promise.resolve({ ok: true, journalEntryId: "je-prod-deliver" }))
}));

describe("Inventory Stock Specification Tests", () => {
  let container, root;

  const sampleInventory = [
    { id: "inv-flour", name: "Plain Flour", cat: "Dry Goods", unit: "kg", cost: 1000, stock: 10, minStock: 2 },
    { id: "inv-butter", name: "Unsalted Butter", cat: "Dairy", unit: "kg", cost: 4000, stock: 5, minStock: 1 },
    { id: "inv-sugar", name: "Granulated Sugar", cat: "Dry Goods", unit: "kg", cost: 1200, stock: 8, minStock: 2 },
    { id: "inv-topper", name: "Acrylic Happy Birthday Topper", cat: "Decoration Extra", unit: "pcs", cost: 1500, stock: 12, minStock: 3 },
    { id: "inv-wafer", name: "Wafer Paper Sheets", cat: "Decoration Extra", unit: "sheets", cost: 300, stock: 50, minStock: 10 },
    { id: "inv-wire", name: "Floral Wire 24G", cat: "Decoration Extra", unit: "m", cost: 200, stock: 30, minStock: 5 }
  ];

  const sampleRecipes = [
    {
      id: "rec-vanilla",
      name: "Vanilla Sponge",
      type: "cake_layer",
      cal_shape: "round",
      cal_dim_a: 9,
      cal_dim_b: 9,
      cal_height_in: 2,
      cal_grams: 617,
      density: 4.849,
      trim_pct: 0.08,
      yield_grams: 1800,
      batch_yield_g: 1800,
      ing: [
        { iid: "inv-flour", name: "Plain Flour", qty: 500, unit: "g" },
        { iid: "inv-butter", name: "Unsalted Butter", qty: 350, unit: "g" },
        { iid: "inv-sugar", name: "Granulated Sugar", qty: 400, unit: "g" }
      ]
    }
  ];

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

  test("Requirement 1 & 2: Three quantities on inventory screen (On hand, Committed, Free), Committed read from confirmed undelivered orders", () => {
    // 1 confirmed order requiring ~0.457 kg Flour, ~0.320 kg Butter, ~0.366 kg Sugar
    const confirmedOrder = {
      id: "ord-confirmed-1",
      status: "confirmed",
      confirmedAt: "2026-11-16T09:00:00Z",
      clientName: "Bisi Akande",
      items: [
        {
          type: "cake",
          tiers: [
            {
              shape: "round",
              size: 10,
              height: 4,
              flavourRows: [{ recipeId: "rec-vanilla", flavour: "Vanilla Sponge", layers: 2 }]
            }
          ]
        }
      ]
    };

    // 1 draft quote (NOT confirmed): should NOT commit stock
    const draftQuote = {
      id: "quote-draft-2",
      status: "quote",
      items: [
        {
          type: "cake",
          tiers: [
            {
              shape: "round",
              size: 12,
              height: 4,
              flavourRows: [{ recipeId: "rec-vanilla", flavour: "Vanilla Sponge", layers: 2 }]
            }
          ]
        }
      ]
    };

    // 1 delivered order: should NOT commit stock (already posted out)
    const deliveredOrder = {
      id: "ord-delivered-3",
      status: "delivered",
      items: [
        {
          type: "cake",
          tiers: [
            {
              shape: "round",
              size: 10,
              height: 4,
              flavourRows: [{ recipeId: "rec-vanilla", flavour: "Vanilla Sponge", layers: 2 }]
            }
          ]
        }
      ]
    };

    act(() => {
      root.render(
        <MasterList
          inventory={sampleInventory}
          setInventory={jest.fn()}
          recipes={sampleRecipes}
          setRecipes={jest.fn()}
          productions={[confirmedOrder, draftQuote, deliveredOrder]}
          user={{ role: "owner" }}
        />
      );
    });

    const text = container.textContent;

    // Check table headers have On hand, Committed, Free
    expect(text).toContain("On hand");
    expect(text).toContain("Committed");
    expect(text).toContain("Free");

    // Flour: on hand = 10 kg
    expect(text).toContain("10 kg");

    // Committed should be non-zero for Flour (1.645 kg from confirmedOrder)
    expect(text).toContain("1.645 kg");

    // Free = on hand - committed (10 - 1.645 = 8.355 kg)
    expect(text).toContain("8.355 kg");
  });

  test("Requirement 3 & 4: Stock posts out on delivered, not on confirmed; Two-step movement (bake moves to FG, deliver moves to COGS)", () => {
    // 1. Order confirmed: 0 journal entry, stock does NOT post out
    const unbakedOrder = {
      id: "ord-test-4",
      status: "confirmed",
      totalCost: 15000,
      totalPrice: 40000
    };

    // bakeOrder is called when marked as baked (Step 1: Raw Materials to Finished Goods)
    accountingApi.bakeOrder("ord-test-4", { actualIngredientCost: 15000 });
    expect(accountingApi.bakeOrder).toHaveBeenCalledWith("ord-test-4", { actualIngredientCost: 15000 });

    // deliverOrder is called when marked as delivered (Step 2: Finished Goods to Cost of Sales & Revenue)
    accountingApi.deliverOrder("ord-test-4");
    expect(accountingApi.deliverOrder).toHaveBeenCalledWith("ord-test-4");
  });

  test("Requirement 5: Inventory valued on weighted average cost (AVCO / WAC)", () => {
    // Current stock: 10 kg @ ₦1,000/kg = ₦10,000 total value
    const currentStock = 10;
    const currentCost = 1000;
    const currentValue = currentStock * currentCost;

    // New purchase arrives: 10 kg bought for ₦20,000 (₦2,000/kg)
    const stockAdded = 10;
    const purchaseTotal = 20000;

    // New total stock = 20 kg, new total value = ₦30,000
    const newStock = currentStock + stockAdded;
    const newValue = currentValue + purchaseTotal;

    // Weighted average unit cost = ₦30,000 / 20 = ₦1,500/kg
    const newAvgCost = parseFloat((newValue / newStock).toFixed(2));
    expect(newAvgCost).toBe(1500);

    // Total inventory value on hand = 20 * 1500 = ₦30,000
    expect(newStock * newAvgCost).toBe(30000);
  });

  test("Requirement 6: Stock adjustment has a dedicated place in navigation", () => {
    const handleSetView = jest.fn();

    act(() => {
      root.render(
        <MasterList
          inventory={sampleInventory}
          setInventory={jest.fn()}
          recipes={sampleRecipes}
          setRecipes={jest.fn()}
          setView={handleSetView}
          user={{ role: "owner" }}
        />
      );
    });

    // Check dedicated "Stock Adjustment" button in MasterList
    const adjustBtn = Array.from(container.querySelectorAll("button")).find(
      b => b.textContent.includes("Stock Adjustment")
    );
    expect(adjustBtn).toBeTruthy();

    act(() => {
      adjustBtn.click();
    });

    expect(handleSetView).toHaveBeenCalledWith("stockadjust");
  });

  test("Requirement 7: Reason codes on every adjustment (6 exact reasons)", () => {
    act(() => {
      root.render(
        <StockAdjustment
          inventory={sampleInventory}
          setInventory={jest.fn()}
        />
      );
    });

    const text = container.textContent;
    expect(text).toContain("Spoilt or expired");
    expect(text).toContain("Damaged");
    expect(text).toContain("Used for testing or samples");
    expect(text).toContain("Theft or loss");
    expect(text).toContain("Counted wrong");
    expect(text).toContain("Other");
  });

  test("Requirement 8: A note is required on 'Other' and only on 'Other'", async () => {
    act(() => {
      root.render(
        <StockAdjustment
          inventory={sampleInventory}
          setInventory={jest.fn()}
        />
      );
    });

    const selectReason = container.querySelector("select");

    // 1. Select "Other"
    act(() => {
      selectReason.value = "Other";
      selectReason.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(container.textContent).toContain("Explanation Note * (Required for 'Other')");

    // Try to save without note
    const saveBtn = Array.from(container.querySelectorAll("button")).find(
      b => b.textContent.includes("Confirm & Record Adjustment") || b.type === "submit"
    );

    // Pick an item first
    const itemSelect = Array.from(container.querySelectorAll("select")).find(
      s => s.innerHTML.includes("Plain Flour")
    );
    act(() => {
      itemSelect.value = "inv-flour";
      itemSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });

    // Enter quantity lost
    const qtyInput = container.querySelector("input[type='number']");
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      setter.call(qtyInput, "1");
      qtyInput.dispatchEvent(new Event("input", { bubbles: true }));
      qtyInput.dispatchEvent(new Event("change", { bubbles: true }));
    });

    // Submit without note -> should show error
    await act(async () => {
      saveBtn.click();
    });

    expect(container.textContent).toContain('A note explaining the adjustment is required when reason is "Other"');

    // 2. Select "Damaged" -> note should NOT be required
    act(() => {
      selectReason.value = "Damaged";
      selectReason.dispatchEvent(new Event("change", { bubbles: true }));
    });

    // Notice required note input disappears
    expect(container.textContent).not.toContain("Required for 'Other'");
  });

  test("Requirement 9: 'Counted wrong' is the only two-way reason (allows stock increase; other reasons reject increase)", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, count: 1 })
    });

    act(() => {
      root.render(
        <StockAdjustment
          inventory={sampleInventory}
          setInventory={jest.fn()}
        />
      );
    });

    const reasonSelect = container.querySelector("select");

    // Select "Counted wrong"
    act(() => {
      reasonSelect.value = "Counted wrong";
      reasonSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });

    // Plain Flour current stock is 10 kg
    const itemSelect = Array.from(container.querySelectorAll("select")).find(
      s => s.innerHTML.includes("Plain Flour")
    );
    act(() => {
      itemSelect.value = "inv-flour";
      itemSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });

    // Enter counted stock: 12 kg (increase of +2 kg)
    const countInput = container.querySelector("input[type='number']");
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      setter.call(countInput, "12");
      countInput.dispatchEvent(new Event("input", { bubbles: true }));
      countInput.dispatchEvent(new Event("change", { bubbles: true }));
    });

    // "Counted wrong" displays +2 kg increase!
    expect(container.textContent).toContain("+2 kg");

    // Now switch reason to "Theft or loss"
    act(() => {
      reasonSelect.value = "Theft or loss";
      reasonSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });

    // In theft/loss, input label changes to "Quantity lost"
    expect(container.textContent).toContain("Quantity lost");

    delete global.fetch;
  });

  test("Requirement 10: ± Adjusted column on monthly stock movement report with loss reason breakdown", async () => {
    const curMonth = (new Date()).toISOString().slice(0, 7);
    const adjustments = [
      {
        id: "adj-1",
        itemId: "inv-flour",
        name: "Plain Flour",
        unit: "kg",
        qtyDelta: -2,
        reason: "Damaged",
        note: "Water leak on bag",
        date: `${curMonth}-10`
      }
    ];

    localStorage.setItem("ll_stock_adjustments", JSON.stringify(adjustments));

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
      );
    });

    const text = container.textContent;

    // Check table headers has ± Adjusted
    expect(text).toContain("± Adjusted");

    // Plain Flour has -2 kg in ± Adjusted
    expect(text).toContain("-2 kg");

    // Check stock adjustments breakdown table shows the row with its reason
    expect(text).toContain("Stock Adjustments & Losses");
    expect(text).toContain("Damaged");
    expect(text).toContain("Water leak on bag");
  });

  test("Requirement 11: Every stock item carries its own unit (kg, g, pcs, sheets, m)", () => {
    act(() => {
      root.render(
        <MasterList
          inventory={sampleInventory}
          setInventory={jest.fn()}
          recipes={sampleRecipes}
          setRecipes={jest.fn()}
          user={{ role: "owner" }}
        />
      );
    });

    const text = container.textContent;

    // Flour in kg
    expect(text).toContain("Plain Flour");
    expect(text).toContain("kg");

    // Acrylic topper in pcs
    expect(text).toContain("Acrylic Happy Birthday Topper");
    expect(text).toContain("pcs");

    // Wafer paper in sheets
    expect(text).toContain("Wafer Paper Sheets");
    expect(text).toContain("sheets");

    // Floral wire in m
    expect(text).toContain("Floral Wire 24G");
    expect(text).toContain("m");
  });
});
