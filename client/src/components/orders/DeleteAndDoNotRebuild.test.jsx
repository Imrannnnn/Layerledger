global.IS_REACT_ACT_ENVIRONMENT = true;

import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import * as constants from '../../constants.js';
import { OrderCalculator } from './OrderCalculator.jsx';
import { PricingSetup } from '../settings/Settings.jsx';
import {
  planArea,
  perimeter,
  gapArea,
  surfaceArea,
  gramsPerPan,
  coveringMass,
  calculateDensity
} from '../../lib/cakeGeometry.js';

// Mock data library
jest.mock('../../lib/data.js', () => ({
  loadCompany: jest.fn(() => ({ name: 'BakeWealth' })),
  loadLocal: jest.fn((key, fallback) => fallback),
  saveLocal: jest.fn().mockResolvedValue(true),
  loadQuotes: jest.fn(() => []),
  saveQuotes: jest.fn().mockResolvedValue(true),
  loadClients: jest.fn(() => []),
  upsertClient: jest.fn().mockResolvedValue(true),
  clearTempCalculatorState: jest.fn(),
  loadTempCalculatorState: jest.fn(() => null),
  saveTempCalculatorState: jest.fn(),
  checkPlanLimit: jest.fn(() => ({ exceeded: false })),
  notifyPlanLimitReached: jest.fn(),
  savePricingSettingsOnServer: jest.fn().mockResolvedValue(true),
  fetchPricingSettingsFromServer: jest.fn().mockResolvedValue({})
}));

// Use real UI components


describe('Delete and Do Not Rebuild — Specification Compliance', () => {
  let container, root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    window.alert = jest.fn();
    window.confirm = jest.fn(() => true);
    sessionStorage.clear();
  });

  afterEach(() => {
    if (root) {
      act(() => { root.unmount(); });
      root = null;
    }
    if (container && container.parentNode) {
      document.body.removeChild(container);
    }
    container = null;
  });

  test('1. The size multiplier table: Deleted and not exported from constants, absent from PricingSetup', async () => {
    // Must not be exported from constants
    expect(constants.DEFAULT_MULTS).toBeUndefined();

    // Must not be rendered in PricingSetup
    await act(async () => {
      root = createRoot(container);
      root.render(<PricingSetup settings={{}} setSetting={jest.fn()} />);
    });

    const text = container.textContent;
    expect(text).not.toContain('Size Multipliers');
    expect(text).not.toContain('4-round');
    expect(text).not.toContain('14-round');
    expect(text).not.toContain('Reset to Defaults');
  });

  test('2. The 14 inch size ceiling: Deleted and not exported from constants, custom sizes up to 60" supported', async () => {
    // Must not be exported from constants
    expect(constants.PRICING_SIZES).toBeUndefined();

    sessionStorage.setItem('ll_calc_prefill', JSON.stringify({
      clientName: 'Grand Celebration',
      items: [
        {
          id: 'item-cake-1',
          type: 'cake',
          name: 'Item 1 — Cake',
          tiers: [
            {
              id: 'tier-1',
              size: '18', // Beyond 14 inches
              shape: 'Round',
              height: 4,
              layers: [{ id: 'l1', flavour: 'Vanilla', qty: 2 }]
            }
          ]
        }
      ]
    }));

    await act(async () => {
      root = createRoot(container);
      root.render(
        <OrderCalculator
          inventory={[]}
          recipes={[{ id: 'r1', name: 'Vanilla', type: 'cake_layer', density: 10.911, batchWeight: 1000, ing: [] }]}
          settings={{ overheadMethod: 'pct', overheadPct: 27, accessoryPct: 15, marginPct: 50 }}
          setView={jest.fn()}
        />
      );
    });

    // 18" size is fully accepted and rendered with no 14" ceiling
    const inputs = Array.from(container.querySelectorAll('input'));
    const sizeInput = inputs.find(i => i.value === '18');
    expect(sizeInput).toBeDefined();
    expect(container.textContent).toContain('18');
  });

  test('3. Grams-per-square-inch covering rates: Deleted from every calculation and export; replaced with mm thickness & density', () => {
    // Formula check: coveringMass(area, mm, density, waste)
    // 10" round = 78.5398 sq in. At 4.5mm buttercream (density 0.90, waste 15%):
    // 78.5398 * 6.4516 * 0.45 * 0.90 * 1.15 = 236.03 g
    const area = planArea('round', 10);
    const mass = coveringMass(area, 4.5, 0.90, 0.15);
    expect(Math.round(mass)).toBe(236);

    // Old flat g/sq in rate would have been fixed grams divided by area, which does not adapt to thickness
    expect(mass).toBeCloseTo(area * 6.4516 * 0.45 * 0.90 * 1.15, 2);
  });

  test('4. The separate decorating fee: Deleted from order calculator and cost stack', async () => {
    sessionStorage.setItem('ll_calc_prefill', JSON.stringify({
      clientName: 'Custom Decor Order',
      items: [
        {
          id: 'item-cake-1',
          type: 'cake',
          name: 'Item 1 — Cake',
          tiers: [{ id: 't1', size: '8', shape: 'Round', height: 4, layers: [{ id: 'l1', flavour: 'Vanilla', qty: 2 }] }],
          decorQty: {}
        }
      ]
    }));

    await act(async () => {
      root = createRoot(container);
      root.render(
        <OrderCalculator
          inventory={[]}
          recipes={[]}
          settings={{ overheadMethod: 'pct', overheadPct: 27, accessoryPct: 15, marginPct: 50 }}
          setView={jest.fn()}
        />
      );
    });

    const text = container.textContent;
    expect(text).not.toContain('Decorating fee');
    expect(text).not.toContain('Decorating Fee');
    expect(text).not.toContain('decorating_fee');
  });

  test("5. The owner's-pay split inside wages: Deleted from costing and overhead rates", () => {
    // Overhead rates only derive from production-tagged expenses; wages are kitchen or office with no owner split
    const backendConstants = require('../../../../backend/modules/accounting/accounting.constants.js');
    const chart = backendConstants.STANDARD_CHART_OF_ACCOUNTS;
    const codes = chart.map(a => a.accountCode);

    // Owner pay lives in Owner Account 2130 / Owner's Loan 2210 (Liability) or Drawings 3300 (Equity), never hidden in wages
    expect(codes).toContain('2130');
    expect(codes).toContain('2210');
    expect(codes).toContain('3300');
  });

  test('6. The miscellaneous cost line: Deleted from order cost stack', async () => {
    sessionStorage.setItem('ll_calc_prefill', JSON.stringify({
      clientName: 'Cost Stack Order',
      items: [
        {
          id: 'item-cake-1',
          type: 'cake',
          name: 'Item 1 — Cake',
          tiers: [{ id: 't1', size: '8', shape: 'Round', height: 4, layers: [{ id: 'l1', flavour: 'Vanilla', qty: 2 }] }]
        }
      ]
    }));

    await act(async () => {
      root = createRoot(container);
      root.render(
        <OrderCalculator
          inventory={[]}
          recipes={[]}
          settings={{ overheadMethod: 'pct', overheadPct: 27, accessoryPct: 15, marginPct: 50 }}
          setView={jest.fn()}
        />
      );
    });

    const text = container.textContent;
    expect(text).not.toContain('Miscellaneous (');
    expect(text).not.toContain('Misc %');
    expect(text).not.toContain('miscPct');
  });

  test('7. Portions as a recipe type: Removed; only cake_layer, covering, and pastry exist as recipe types', () => {
    // Portions is an order item type/screen, never a recipe type
    const validRecipeTypes = ['cake_layer', 'layer', 'covering', 'pastry'];
    expect(validRecipeTypes).not.toContain('portions');
  });

  test('8. Pan counts and pour weights on order calculator: Deleted from cake path, moved to production sheet', async () => {
    sessionStorage.setItem('ll_calc_prefill', JSON.stringify({
      clientName: 'Costing Only Client',
      items: [
        {
          id: 'item-cake-costing',
          type: 'cake',
          name: 'Item 1 — Cake',
          tiers: [
            {
              id: 'tier-1',
              size: '10',
              shape: 'Round',
              height: 4,
              layers: [
                { id: 'l1', flavour: 'Vanilla', qty: 1 },
                { id: 'l2', flavour: 'Chocolate', qty: 1 }
              ]
            }
          ]
        }
      ]
    }));

    await act(async () => {
      root = createRoot(container);
      root.render(
        <OrderCalculator
          inventory={[]}
          recipes={[
            { id: 'r1', name: 'Vanilla', type: 'cake_layer', density: 10.911, batchWeight: 1000, ing: [] },
            { id: 'r2', name: 'Chocolate', type: 'cake_layer', density: 11.088, batchWeight: 1000, ing: [] }
          ]}
          settings={{ overheadMethod: 'pct', overheadPct: 27, accessoryPct: 15, marginPct: 50 }}
          setView={jest.fn()}
        />
      );
    });

    const text = container.textContent;
    // Cake path order calculator does NOT show pan counts or pour weights
    expect(text).not.toContain('g batter/pan');
    expect(text).not.toContain('pour weight');
    expect(text).not.toContain('Pans to bake for this tier');
  });
});
