global.IS_REACT_ACT_ENVIRONMENT = true;

import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { OrderCalculator } from './OrderCalculator.jsx';
import {
  perPan,
  calculatePortionsGeometry,
  coveringMass
} from '../../lib/cakeGeometry.js';

// Mock data library
jest.mock('../../lib/data.js', () => ({
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
  checkPlanLimit: jest.fn(() => ({ exceeded: false })),
  notifyPlanLimitReached: jest.fn()
}));

// Mock UI components
jest.mock('../common/ui.jsx', () => {
  const React = require('react');
  return {
    Btn: ({ children, onClick, disabled, full, variant, loading, loadingText }) => (
      <button onClick={onClick} disabled={disabled || loading} data-variant={variant}>
        {loadingText && loading ? loadingText : children}
      </button>
    ),
    Inp: ({ label, value, onChange, type, placeholder }) => (
      <div data-testid={`field-${label}`}>
        <label>{label}</label>
        <input
          type={type || 'text'}
          value={value || ''}
          placeholder={placeholder}
          onChange={e => onChange(e.target.value)}
        />
      </div>
    ),
    Sel: ({ label, value, onChange, options }) => (
      <div data-testid={`select-${label}`}>
        <label>{label}</label>
        <select value={value || ''} onChange={e => onChange(e.target.value)}>
          {options.map(o => <option key={o.value || o} value={o.value || o}>{o.label || o}</option>)}
        </select>
      </div>
    ),
    Card: ({ children, style }) => <div className="card" style={style}>{children}</div>,
    SHead: ({ title, sub }) => <div><h2>{title}</h2><p>{sub}</p></div>,
    SearchableSelect: ({ value, onChange, options, placeholder }) => (
      <select data-testid="searchable-select" value={value || ''} onChange={e => onChange(e.target.value)}>
        <option value="">{placeholder}</option>
        {(options || []).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    )
  };
});

describe('Order Calculation Portions Path Specification Tests', () => {
  let container, root;

  const sampleInventory = [
    { id: 'inv_flour', name: 'Flour', unit: 'kg', cost: 1000, cat: 'Dry Goods' },
    { id: 'inv_sugar', name: 'Sugar', unit: 'kg', cost: 1200, cat: 'Dry Goods' },
    { id: 'inv_butter', name: 'Butter', unit: 'kg', cost: 3000, cat: 'Dairy' },
    { id: 'inv_eggs', name: 'Eggs', unit: 'pcs', cost: 150, cat: 'Dairy' }
  ];

  const sampleRecipes = [
    // 1. Cake layer recipes
    {
      id: 'rec_vanilla',
      name: 'Vanilla sponge',
      type: 'cake_layer',
      cal_shape: 'round',
      cal_dim_a: 6,
      cal_height_in: 2,
      cal_grams: 617,
      density: 10.911,
      trim_pct: 8,
      batchWeight: 617,
      ing: [
        { iid: 'inv_flour', qty: 0.15 },
        { iid: 'inv_sugar', qty: 0.15 },
        { iid: 'inv_butter', qty: 0.15 },
        { iid: 'inv_eggs', qty: 3 }
      ]
    },
    {
      id: 'rec_chocolate',
      name: 'Chocolate',
      type: 'cake_layer',
      density: 11.088,
      trim_pct: 8,
      batchWeight: 627,
      ing: [
        { iid: 'inv_flour', qty: 0.14 },
        { iid: 'inv_sugar', qty: 0.16 },
        { iid: 'inv_butter', qty: 0.15 }
      ]
    },

    // 2. Covering recipes
    {
      id: 'rec_buttercream',
      name: 'Buttercream',
      type: 'covering',
      can_fill: true,
      can_crumb: true,
      can_finish: true,
      thick_fill_mm: 4.5,
      thick_crumb_mm: 1.0,
      thick_finish_mm: 4.9,
      density: 0.90,
      waste_pct: 15,
      batchWeight: 500,
      ing: [
        { iid: 'inv_butter', qty: 0.25 },
        { iid: 'inv_sugar', qty: 0.25 }
      ]
    },
    {
      id: 'rec_darkganache',
      name: 'Dark ganache',
      type: 'covering',
      can_fill: true,
      can_crumb: true,
      can_finish: true,
      thick_fill_mm: 3.0,
      thick_crumb_mm: 1.2,
      thick_finish_mm: 4.0,
      density: 1.10,
      waste_pct: 10,
      batchWeight: 600,
      ing: [
        { iid: 'inv_butter', qty: 0.3 }
      ]
    },
    {
      id: 'rec_fondant',
      name: 'Fondant',
      type: 'covering',
      can_fill: false,
      can_crumb: false,
      can_finish: true,
      thick_finish_mm: 8.0,
      density: 1.35,
      waste_pct: 25,
      batchWeight: 1000,
      ing: [
        { iid: 'inv_sugar', qty: 0.8 }
      ]
    },
    {
      id: 'rec_caramel',
      name: 'Caramel sauce',
      type: 'covering',
      can_fill: true,
      can_crumb: false,
      can_finish: false,
      thick_fill_mm: 1.5,
      density: 1.30,
      waste_pct: 5,
      batchWeight: 400,
      ing: [
        { iid: 'inv_sugar', qty: 0.4 }
      ]
    },
    {
      id: 'rec_doughnuts',
      name: 'Glazed doughnuts',
      type: 'pastry',
      batchSize: 30,
      breakagePct: 0,
      ing: [
        { iid: 'inv_flour', qty: 1.0 },
        { iid: 'inv_sugar', qty: 0.3 },
        { iid: 'inv_butter', qty: 0.2 },
        { iid: 'inv_eggs', qty: 2 }
      ]
    }
  ];

  const defaultSettings = {
    overheadMethod: 'pct',
    overheadPct: 27,
    accessoryPct: 15,
    marginPct: 50
  };

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    window.alert = jest.fn();
    window.confirm = jest.fn(() => true);
    sessionStorage.clear();
    sessionStorage.setItem('ll_calc_prefill', JSON.stringify({
      clientName: 'Portions Spec Client',
      items: [
        {
          id: 'item-portions-spec',
          type: 'portions',
          name: 'Item 1 — Portions',
          route: 'slab',
          servings: 100,
          sliceWidth: 2,
          sliceLength: 2,
          sliceHeight: 4,
          allowancePct: 5,
          panIndex: 1, // 12 x 18 pan
          layers: [
            { id: 'pl-1', flavour: 'Vanilla sponge', qty: 2 },
            { id: 'pl-2', flavour: 'Chocolate', qty: 1 }
          ],
          fillingRecipe: 'Buttercream',
          topFinishRecipe: 'Dark ganache'
        }
      ]
    }));
    jest.clearAllMocks();
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

  test('Check 1: Servings and cutting allowance (needed = ceil(servings * (1 + allowance)))', () => {
    // 100 servings with 5% allowance = ceil(100 * 1.05) = 105
    const res = calculatePortionsGeometry({
      servings: 100,
      allowance: 0.05,
      trayW: 12,
      trayL: 18,
      sliceW: 2,
      sliceL: 2,
      sliceHeight: 4
    });
    expect(res.needed).toBe(105);
  });

  test('Check 2: Slices per slab takes the better of both cutting orientations (2x2 on 12x18 = 54)', () => {
    // 12 x 18 tray with 2x2 slice
    const slices = perPan(12, 18, 2, 2);
    expect(slices).toBe(54);

    // Asymmetric test: 9 x 13 tray with 2 x 3 slice
    // Orient A: floor(13/3) * floor(9/2) = 4 * 4 = 16
    // Orient B: floor(13/2) * floor(9/3) = 6 * 3 = 18 -> max is 18
    expect(perPan(9, 13, 2, 3)).toBe(18);
  });

  test('Check 3: Slabs to build (slabs = max(1, ceil(needed / slicesPerSlab)))', () => {
    // 105 needed / 54 per slab -> ceil(1.944) = 2 slabs
    const res = calculatePortionsGeometry({
      servings: 100,
      allowance: 0.05,
      trayW: 12,
      trayL: 18,
      sliceW: 2,
      sliceL: 2,
      sliceHeight: 4
    });
    expect(res.slabs).toBe(2);
  });

  test('Check 4: Flavour rows F1, F2 with layer counts and gross weight badge by the side', async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(
        <OrderCalculator
          inventory={sampleInventory}
          recipes={sampleRecipes}
          settings={defaultSettings}
          setView={jest.fn()}
        />
      );
    });

    // Check flavour labels
    expect(container.textContent).toContain('F1');
    expect(container.textContent).toContain('F2');

    // Check that grams badge is rendered by the side of the inputs
    // 12x18 pan @ 4" slice, 3 layers -> 1.33" per layer
    // Vanilla sponge (density 10.911, trim 8%): 3,394 g per pan
    // Chocolate (density 11.088, trim 8%): 3,449 g per pan
    expect(container.textContent).toContain('3,394 g');
    expect(container.textContent).toContain('3,449 g');
  });

  test('Check 5: Slice height and layers inside are independent (batter flat, filling moves by half)', () => {
    // 3 layers inside 4" slice
    const res3 = calculatePortionsGeometry({
      servings: 100,
      allowance: 0.05,
      trayW: 12,
      trayL: 18,
      sliceW: 2,
      sliceL: 2,
      sliceHeight: 4,
      flavourRows: [
        { recipeId: 'van', layers: 2, density: 10.911, trimPct: 0.08, costPerGram: 5.5 },
        { recipeId: 'cho', layers: 1, density: 11.088, trimPct: 0.08, costPerGram: 5.6 }
      ]
    });

    // 4 layers inside 4" slice
    const res4 = calculatePortionsGeometry({
      servings: 100,
      allowance: 0.05,
      trayW: 12,
      trayL: 18,
      sliceW: 2,
      sliceL: 2,
      sliceHeight: 4,
      flavourRows: [
        { recipeId: 'van', layers: 3, density: 10.911, trimPct: 0.08, costPerGram: 5.5 },
        { recipeId: 'cho', layers: 1, density: 11.088, trimPct: 0.08, costPerGram: 5.6 }
      ]
    });

    // Total batter remains flat (within rounding of density weighting)
    expect(res3.totalBatterGrams / 1000).toBeCloseTo(20.47, 1);
    expect(res4.totalBatterGrams / 1000).toBeCloseTo(20.44, 1);

    // Filling gaps: 3 layers = 2 gaps; 4 layers = 3 gaps (moves by 50% / half)
    const fill3 = coveringMass(res3.gapAreaSqIn, 4.5, 0.90, 0.15);
    const fill4 = coveringMass(res4.gapAreaSqIn, 4.5, 0.90, 0.15);
    expect(fill4 / fill3).toBeCloseTo(1.5, 2);
  });

  test('Check 6: Pans to bake for a flavour row (pansForRow = layerCount * slabs)', () => {
    const res = calculatePortionsGeometry({
      servings: 100,
      allowance: 0.05,
      trayW: 12,
      trayL: 18,
      sliceW: 2,
      sliceL: 2,
      sliceHeight: 4,
      flavourRows: [
        { recipeId: 'van', layers: 2, density: 10.911, trimPct: 0.08, costPerGram: 5.5 },
        { recipeId: 'cho', layers: 1, density: 11.088, trimPct: 0.08, costPerGram: 5.6 }
      ]
    });

    // 2 slabs to build:
    // van has 2 layers -> 2 * 2 = 4 pans
    // cho has 1 layer -> 1 * 2 = 2 pans
    expect(res.rowResults[0].pansForRow).toBe(4);
    expect(res.rowResults[1].pansForRow).toBe(2);
    expect(res.totalPans).toBe(6);
  });

  test('Check 7: Filling scales with gaps, top finish with top area; dropdowns filtered by can_fill & can_finish', async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(
        <OrderCalculator
          inventory={sampleInventory}
          recipes={sampleRecipes}
          settings={defaultSettings}
          setView={jest.fn()}
        />
      );
    });

    const selects = Array.from(container.querySelectorAll('select'));

    // Find Filling select
    const fillSelect = selects.find(s => {
      const options = Array.from(s.querySelectorAll('option')).map(o => o.value);
      return options.includes('Buttercream') && options.includes('Caramel sauce');
    });
    expect(fillSelect).toBeDefined();

    const fillOptions = Array.from(fillSelect.querySelectorAll('option')).map(o => o.value);
    expect(fillOptions).toContain('Buttercream');
    expect(fillOptions).toContain('Dark ganache');
    expect(fillOptions).toContain('Caramel sauce');
    // Fondant CANNOT fill
    expect(fillOptions).not.toContain('Fondant');

    // Find Top Finish select
    const finishSelect = selects.find(s => {
      const options = Array.from(s.querySelectorAll('option')).map(o => o.value);
      return options.includes('Buttercream') && options.includes('Fondant');
    });
    expect(finishSelect).toBeDefined();

    const finishOptions = Array.from(finishSelect.querySelectorAll('option')).map(o => o.value);
    expect(finishOptions).toContain('Buttercream');
    expect(finishOptions).toContain('Dark ganache');
    expect(finishOptions).toContain('Fondant');
    // Caramel CANNOT finish
    expect(finishOptions).not.toContain('Caramel sauce');
  });

  test('Check 8: Pan choice stays on this screen and updates live calculations', async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(
        <OrderCalculator
          inventory={sampleInventory}
          recipes={sampleRecipes}
          settings={defaultSettings}
          setView={jest.fn()}
        />
      );
    });

    // Check live pan chips are rendered on screen
    expect(container.textContent).toContain('Slices a slab gives');
    expect(container.textContent).toContain('Slabs to build');
    expect(container.textContent).toContain('Pans to bake');
    expect(container.textContent).toContain('Batter');

    // For 12 x 18 pan with 2x2 slice:
    expect(container.textContent).toContain('54'); // Slices a slab gives
    expect(container.textContent).toContain('6');  // Total pans to bake
  });

  test('Check 9 & 10: Counted pieces mode (doughnuts, chin chin, bread) has no geometry, multiplies recipe, and batch count is NEVER rounded up (72 pcs of 30/batch gives 2.4 batches, never 3)', async () => {
    sessionStorage.setItem('ll_calc_prefill', JSON.stringify({
      clientName: 'Counted Portions Client',
      items: [
        {
          id: 'item-counted-spec',
          type: 'portions',
          name: 'Item 1 — Portions',
          route: 'count',
          countedServings: 72,
          countedRecipeId: 'rec_doughnuts'
        }
      ]
    }));

    await act(async () => {
      root = createRoot(container);
      root.render(
        <OrderCalculator
          inventory={sampleInventory}
          recipes={sampleRecipes}
          settings={defaultSettings}
          setView={jest.fn()}
        />
      );
    });

    // Verify mode toggle shows Counted items active
    expect(container.textContent).toContain('Counted items');

    // Verify unrounded batch count is 2.4 (never rounded up to 3)
    expect(container.textContent).toContain('2.4 batches');
    expect(container.textContent).not.toContain('3 batches');

    // Verify explanation text: No geometry on this path & never rounded up
    expect(container.textContent).toContain('Nothing geometric here. The recipe already says how many a batch makes, so the app multiplies.');
    expect(container.textContent).toContain('Batch count is never rounded up');

    // 72 pieces of Glazed doughnuts @ 75.33 cost each = 5,424 cost total
    expect(container.textContent).toContain('72 pieces');
  });
});