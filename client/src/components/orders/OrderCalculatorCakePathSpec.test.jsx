global.IS_REACT_ACT_ENVIRONMENT = true;

import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { OrderCalculator } from './OrderCalculator.jsx';
import {
  planArea,
  perimeter,
  gapArea,
  surfaceArea,
  gramsPerPan,
  coveringMass,
  DEFAULT_COVERINGS_SEED
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

describe('Order Calculation Cake Path Specification Tests', () => {
  let container, root;

  const sampleInventory = [
    { id: 'inv_flour', name: 'Flour', unit: 'kg', cost: 1000, cat: 'Dry Goods' },
    { id: 'inv_sugar', name: 'Sugar', unit: 'kg', cost: 1200, cat: 'Dry Goods' },
    { id: 'inv_butter', name: 'Butter', unit: 'kg', cost: 3000, cat: 'Dairy' },
    { id: 'inv_eggs', name: 'Eggs', unit: 'pcs', cost: 150, cat: 'Dairy' },
    { id: 'inv_pearls', name: 'Sugar pearls', unit: 'g', cost: 18, cat: 'Decoration Extras' },
    { id: 'inv_gold', name: 'Edible gold leaf', unit: 'g', cost: 450, cat: 'Decoration Extras' },
    { id: 'inv_topper', name: 'Acrylic cake topper', unit: 'pcs', cost: 2500, cat: 'Decoration Extras' },
    { id: 'inv_gumpaste', name: 'Gum paste', unit: 'kg', cost: 4000, cat: 'Decoration Extras' }
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
    {
      id: 'rec_redvelvet',
      name: 'Red velvet',
      type: 'cake_layer',
      density: 13.104,
      trim_pct: 8,
      batchWeight: 741,
      ing: [
        { iid: 'inv_flour', qty: 0.18 },
        { iid: 'inv_sugar', qty: 0.18 },
        { iid: 'inv_butter', qty: 0.15 }
      ]
    },

    // 2. Covering recipes with specific job flags
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
      id: 'rec_whipped',
      name: 'Whipped cream',
      type: 'covering',
      can_fill: true,
      can_crumb: false,
      can_finish: true,
      thick_fill_mm: 4.0,
      thick_finish_mm: 4.9,
      density: 0.452,
      waste_pct: 15,
      batchWeight: 500,
      ing: [
        { iid: 'inv_butter', qty: 0.25 }
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

    // 3. Made here by the piece (third recipe type, formerly pastry)
    {
      id: 'rec_sugar_roses',
      name: 'Sugar roses',
      type: 'pastry',
      batchSize: 24,
      breakagePct: 5,
      ing: [
        { iid: 'inv_gumpaste', qty: 0.5 } // 0.5 kg of gum paste @ 4000 = 2000 cost. 2000 / 24 * 1.05 = 87.5 / rose
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
      clientName: 'Spec Test Client',
      items: [
        {
          id: 'item-cake-spec',
          type: 'cake',
          name: 'Item 1 — Cake',
          tiers: [
            {
              id: 'tier-1',
              size: '10',
              shape: 'Round',
              height: 6,
              layerHeight: 2,
              layers: [
                { id: 'l-1', flavour: 'Chocolate', qty: 1 },
                { id: 'l-2', flavour: 'Chocolate', qty: 1 },
                { id: 'l-3', flavour: 'Red velvet', qty: 1 }
              ],
              fillings: [{ id: 'f-1', type: 'Buttercream' }]
            }
          ],
          crumbCoat: { type: 'Dark ganache' },
          outsideFinish: { type: 'Fondant' },
          decQty: {
            'inv_pearls': 45,
            'r_rec_sugar_roses': 6
          }
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

  test('Check 1: Flavour rows and density weighing at exact thickness (10" round, 7" height, 3 layers)', () => {
    // 10" round, 7" height, 3 layers -> 2.333" each
    const pa = planArea('round', 10);
    const layerThickness = 7.0 / 3;
    const trim = 0.08;

    const vanGrams = gramsPerPan(10.911, pa, layerThickness, trim);
    const choGrams = gramsPerPan(11.088, pa, layerThickness, trim);
    const rvGrams = gramsPerPan(13.104, pa, layerThickness, trim);

    expect(Math.round(vanGrams)).toBe(2160);
    expect(Math.round(choGrams)).toBe(2195);
    expect(Math.round(rvGrams)).toBe(2594);
    expect(Number(layerThickness.toFixed(2))).toBe(2.33);
  });

  test('Check 2: Filling dropdown lists only can_fill, Crumb only can_crumb, Finish only can_finish', async () => {
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
    
    // Find filling select (contains "— Select filling —" option text)
    const fillSelect = selects.find(s => {
      const texts = Array.from(s.querySelectorAll('option')).map(o => o.textContent);
      return texts.some(t => t.includes('Select filling'));
    });
    expect(fillSelect).toBeDefined();

    const fillOptions = Array.from(fillSelect.querySelectorAll('option')).map(o => o.value);
    expect(fillOptions).toContain('Buttercream');
    expect(fillOptions).toContain('Dark ganache');
    expect(fillOptions).toContain('Caramel sauce');
    expect(fillOptions).toContain('Whipped cream');
    // Fondant CANNOT fill
    expect(fillOptions).not.toContain('Fondant');

    // Find crumb coat select (has "None" option, does not have "Fondant")
    const crumbSelect = selects.find(s => {
      const texts = Array.from(s.querySelectorAll('option')).map(o => o.textContent);
      const values = Array.from(s.querySelectorAll('option')).map(o => o.value);
      return texts.includes('None') && !values.includes('Fondant');
    });
    expect(crumbSelect).toBeDefined();

    const crumbOptions = Array.from(crumbSelect.querySelectorAll('option')).map(o => o.value);
    expect(crumbOptions).toContain('Buttercream');
    expect(crumbOptions).toContain('Dark ganache');
    // Fondant, Whipped cream, Caramel CANNOT crumb coat
    expect(crumbOptions).not.toContain('Fondant');
    expect(crumbOptions).not.toContain('Whipped cream');
    expect(crumbOptions).not.toContain('Caramel sauce');

    // Find outside finish select (has "None" option, and has "Fondant")
    const finishSelect = selects.find(s => {
      const texts = Array.from(s.querySelectorAll('option')).map(o => o.textContent);
      const values = Array.from(s.querySelectorAll('option')).map(o => o.value);
      return texts.includes('None') && values.includes('Fondant');
    });
    expect(finishSelect).toBeDefined();

    const finishOptions = Array.from(finishSelect.querySelectorAll('option')).map(o => o.value);
    expect(finishOptions).toContain('Buttercream');
    expect(finishOptions).toContain('Dark ganache');
    expect(finishOptions).toContain('Fondant');
    expect(finishOptions).toContain('Whipped cream');
    // Caramel CANNOT finish
    expect(finishOptions).not.toContain('Caramel sauce');
  });

  test('Check 3: Unified decorations grouped by kind with dynamic unit badge (weighed, bought piece, made piece)', async () => {
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

    // Check that Add Decoration dropdown contains optgroups
    const decorSelect = Array.from(container.querySelectorAll('select')).find(s => {
      return s.querySelector('optgroup[label*="Weighed"]') !== null;
    });
    expect(decorSelect).toBeDefined();

    const optgroups = Array.from(decorSelect.querySelectorAll('optgroup')).map(g => g.label);
    expect(optgroups.some(l => l.includes('Weighed'))).toBe(true);
    expect(optgroups.some(l => l.includes('Bought by the piece'))).toBe(true);
    expect(optgroups.some(l => l.includes('Made here by the piece'))).toBe(true);
  });

  test('Check 4: Multiple fillings split the gaps evenly', () => {
    const pa = planArea('round', 10);
    const gaps = gapArea(pa, 3); // 2 gaps
    expect(gaps).toBeCloseTo(pa * 2, 3);

    // If 2 fillings are selected, each gets half the gap area
    const gapShare = gaps / 2;
    const bcGrams = coveringMass(gapShare, 4.5, 0.90, 0.15);
    const caramelGrams = coveringMass(gapShare, 1.5, 1.30, 0.05);

    expect(bcGrams).toBeGreaterThan(0);
    expect(caramelGrams).toBeGreaterThan(0);
  });
});
