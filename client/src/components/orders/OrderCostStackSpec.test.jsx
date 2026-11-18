global.IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { calculateCostStack, deriveOverheadRates } from "../../lib/cakeGeometry.js";
import { PricingSetup } from "../settings/Settings.jsx";
import { OrderCalculator } from "./OrderCalculator.jsx";
import * as dataLib from "../../lib/data.js";

// Mock dataLib
jest.mock("../../lib/data.js", () => ({
  fetchPricingSettingsFromServer: jest.fn(),
  savePricingSettingsOnServer: jest.fn(),
  resetPricingSettingsOnServer: jest.fn(),
  migrateLocalStoragePricingToDatabase: jest.fn(),
  loadCompany: jest.fn(() => ({ name: 'BakeWealth', bankName: 'GTBank', bankAccount: '0123456789' })),
  loadLocal: jest.fn((key, fallback) => fallback),
  saveLocal: jest.fn().mockResolvedValue(true),
  loadQuotes: jest.fn(() => []),
  saveQuotes: jest.fn().mockResolvedValue(true),
  loadClients: jest.fn(() => []),
  upsertClient: jest.fn().mockResolvedValue(true),
  clearTempCalculatorState: jest.fn(),
  loadTempCalculatorState: jest.fn(() => null),
  saveTempCalculatorState: jest.fn(),
  saveSetting: jest.fn(),
  saveCompany: jest.fn(),
  saveUsers: jest.fn(),
  syncToBackend: jest.fn(),
  syncFromBackend: jest.fn(),
  clearAllDataOnServer: jest.fn(),
  deleteTenantAccountOnServer: jest.fn(),
  logout: jest.fn(),
  saveInventory: jest.fn(),
  deleteOpeningStockOnServer: jest.fn(),
  checkPlanLimit: jest.fn(() => ({ exceeded: false })),
  notifyPlanLimitReached: jest.fn()
}));

describe("Specification: Cost Stack Moved to Order Level", () => {
  let container, root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    jest.clearAllMocks();

    dataLib.fetchPricingSettingsFromServer.mockResolvedValue({
      profitPct: 50,
      overheadPct: 27,
      accessoryPct: 15,
      monthlyOverhead: 900000,
      annualProductionHours: 1800,
      ordersPerMonth: 20,
      hourlyRate: 6000,
      perOrderRate: 45000
    });
  });

  afterEach(() => {
    act(() => {
      if (root) root.unmount();
    });
    if (container) container.remove();
    container = null;
  });

  test("Requirement 1: Move whole stack off cake item and onto order (all items feed order-level cost stack)", () => {
    // A pastry-only or portions order picks up overhead & margin at order level
    const pastryOnlyStack = calculateCostStack({
      directCost: 20000, // direct cost of 40 doughnuts
      packaging: 2000,
      toppers: 0,
      accessoriesPct: 0.15,
      overheadMethod: "pct",
      overheadPct: 0.27,
      marginPct: 0.40
    });

    // direct: 20,000 + 2,000 = 22,000
    expect(pastryOnlyStack.direct).toBe(22000);
    // accessories: 22,000 * 0.15 = 3,300
    expect(pastryOnlyStack.accessories).toBe(3300);
    // overhead: (22,000 + 3,300) * 0.27 = 6,831
    expect(pastryOnlyStack.overhead).toBe(6831);
    // totalCost: 22,000 + 3,300 + 6,831 = 32,131
    expect(pastryOnlyStack.totalCost).toBe(32131);
    // Price with 40% margin: 32,131 / (1 - 0.40) = 53,552
    expect(pastryOnlyStack.price).toBe(53552);
    // Never priced below cost
    expect(pastryOnlyStack.price).toBeGreaterThan(pastryOnlyStack.totalCost);
  });

  test("Requirement 2: Direct cost = sum(item direct costs) + packaging + toppers", () => {
    const stack = calculateCostStack({
      directCost: 75000,
      packaging: 5000,
      toppers: 3000
    });

    expect(stack.direct).toBe(83000);
    expect(stack.packaging).toBe(5000);
    expect(stack.toppers).toBe(3000);
  });

  test("Requirement 3: Accessories = direct × accessories_pct (default 15%)", () => {
    const stack = calculateCostStack({
      directCost: 100000,
      accessoriesPct: 0.15
    });

    // 100,000 * 0.15 = 15,000
    expect(stack.accessories).toBe(15000);
  });

  test("Requirement 4: Total cost = direct + accessories + overhead", () => {
    const stack = calculateCostStack({
      directCost: 100000,
      accessoriesPct: 0.15,
      overheadMethod: "pct",
      overheadPct: 0.27
    });

    const expectedTotal = stack.direct + stack.accessories + stack.overhead;
    expect(stack.totalCost).toBe(expectedTotal);
    expect(stack.totalCost).toBe(146050);
  });

  test("Requirement 5: Price from margin by division price = total ÷ (1 − margin_pct)", () => {
    const stack = calculateCostStack({
      directCost: 100000,
      accessoriesPct: 0.15,
      overheadMethod: "pct",
      overheadPct: 0.27,
      marginPct: 0.50
    });

    // totalCost is 146,050
    // By division: 146,050 / (1 - 0.50) = 292,100
    expect(stack.price).toBe(292100);

    // If it were incorrectly done by multiplication: 146,050 * (1 + 0.50) = 219,075 (undercharges by ~25%!)
    const incorrectMultiplication = Math.round(stack.totalCost * 1.50);
    expect(stack.price).not.toBe(incorrectMultiplication);
    expect(stack.price - incorrectMultiplication).toBe(73025);
  });

  test("Requirement 6: Rush and season applied after margin, never inside it", () => {
    const stackNoSurcharges = calculateCostStack({
      directCost: 100000,
      accessoriesPct: 0.15,
      overheadMethod: "pct",
      overheadPct: 0.27,
      marginPct: 0.50,
      rushPct: 0,
      seasonPct: 0
    });

    const stackWithSurcharges = calculateCostStack({
      directCost: 100000,
      accessoriesPct: 0.15,
      overheadMethod: "pct",
      overheadPct: 0.27,
      marginPct: 0.50,
      rushPct: 0.10,   // 10% rush
      seasonPct: 0.05  // 5% season
    });

    // Base price remains unchanged before surcharges
    expect(stackWithSurcharges.price).toBe(stackNoSurcharges.price);
    // Surcharges are 15% of the post-margin price
    const expectedSurcharge = Math.round(stackNoSurcharges.price * 0.15);
    expect(stackWithSurcharges.surcharges).toBe(expectedSurcharge);
  });

  test("Requirement 7: Final charge rounded up to nearest ₦500", () => {
    const stack = calculateCostStack({
      directCost: 100000,
      accessoriesPct: 0.15,
      overheadMethod: "pct",
      overheadPct: 0.27,
      marginPct: 0.50
    });

    // Price is 292,100 -> rounded up to nearest 500 = 292,500
    expect(stack.price).toBe(292100);
    expect(stack.charge).toBe(292500);
    expect(stack.charge % 500).toBe(0);
    expect(stack.charge).toBeGreaterThanOrEqual(stack.price);
  });

  test("Requirement 8: Three overhead methods switchable per order (pct, hr, ord)", () => {
    // 1. Percentage method (27%)
    const pctStack = calculateCostStack({
      directCost: 100000,
      accessoriesPct: 0.15,
      overheadMethod: "pct",
      overheadPct: 0.27
    });
    expect(pctStack.overheadMethod).toBe("pct");
    expect(pctStack.overhead).toBe(31050);

    // 2. Per hour method (6 hours at ₦6,000/hr)
    const hrStack = calculateCostStack({
      directCost: 100000,
      accessoriesPct: 0.15,
      overheadMethod: "hr",
      orderHours: 6,
      hourlyRate: 6000
    });
    expect(hrStack.overheadMethod).toBe("hr");
    expect(hrStack.overhead).toBe(36000); // 6 * 6,000

    // 3. Per order method (₦45,000 fixed per order)
    const ordStack = calculateCostStack({
      directCost: 100000,
      accessoriesPct: 0.15,
      overheadMethod: "ord",
      perOrderRate: 45000
    });
    expect(ordStack.overheadMethod).toBe("ord");
    expect(ordStack.overhead).toBe(45000);
  });

  test("Requirement 9: Overhead rate inputs live in shop settings and derive hourly and per-order rates", async () => {
    // Mathematical derivation
    const rates = deriveOverheadRates(900000, 1800, 20);
    expect(rates.hourlyRate).toBe(6000);   // (900,000 * 12) / 1,800
    expect(rates.perOrderRate).toBe(45000); // 900,000 / 20

    // UI Verification in PricingSetup
    const mockSetSetting = jest.fn();
    const mockSettings = {
      profitPct: 50,
      overheadPct: 27,
      accessoryPct: 15,
      monthlyOverhead: 900000,
      annualProductionHours: 1800,
      ordersPerMonth: 20
    };

    await act(async () => {
      root.render(<PricingSetup settings={mockSettings} setSetting={mockSetSetting} />);
    });

    // Check UI contains overhead inputs and derived rates
    expect(container.textContent).toContain("Shop Overhead Rates");
    expect(container.textContent).toContain("Monthly Overhead (₦)");
    expect(container.textContent).toContain("Annual Production Hours");
    expect(container.textContent).toContain("Orders Per Month");
    expect(container.textContent).toContain("Derived Overhead Rates");
    expect(container.textContent).toContain("₦6,000 / hr");
    expect(container.textContent).toContain("₦45,000 / order");
  });

  test("Requirement 10: Remove separate decorating fee, owner's-pay split, and misc line from order pricing", async () => {
    const mockInventory = [
      { id: "i1", name: "Flour", cost: 1.5, unit: "g" },
      { id: "i2", name: "Sugar", cost: 2.0, unit: "g" },
      { id: "i3", name: "Butter", cost: 4.0, unit: "g" }
    ];

    const mockRecipes = [
      {
        id: "r1",
        name: "Vanilla Sponge",
        recipe_type: "cake",
        type: "cake",
        density: 0.8,
        costPerGram: 2.5,
        cal_grams: 600,
        cal_shape: "round",
        cal_dim_a: 8,
        cal_height_in: 2,
        trim_pct: 8,
        ing: [{ iid: "i1", qty: 200 }]
      }
    ];

    const mockSettings = {
      profitPct: 50,
      overheadPct: 27,
      accessoryPct: 15,
      monthlyOverhead: 900000,
      annualProductionHours: 1800,
      ordersPerMonth: 20,
      hourlyRate: 6000,
      perOrderRate: 45000
    };

    await act(async () => {
      root.render(
        <OrderCalculator
          inventory={mockInventory}
          recipes={mockRecipes}
          settings={mockSettings}
          setView={() => {}}
        />
      );
    });

    // Order calculator UI must not have separate decorating fee, owner's split, or misc percentage lines
    const text = container.textContent;
    expect(text).not.toContain("Decorating fee");
    expect(text).not.toContain("Owner's pay");
    expect(text).not.toContain("Owners pay");
    expect(text).not.toContain("Miscellaneous %");
    expect(text).not.toContain("Misc %");

    // Must have unified Direct cost, Accessories 15%, Overhead, Total cost, Suggested price
    expect(text).toContain("Direct cost");
    expect(text).toContain("Accessories 15%");
    expect(text).toContain("Overhead");
    expect(text).toContain("Total cost");
    expect(text).toContain("Suggested price");
  });
});
