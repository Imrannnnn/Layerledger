global.IS_REACT_ACT_ENVIRONMENT = true;

import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { OrderCalculator } from './OrderCalculator.jsx';
import { gramsPerPan, planArea } from '../../lib/cakeGeometry.js';
import { mapServerRecipeToLocal } from '../../lib/data.js';

// Mock data library
jest.mock('../../lib/data.js', () => {
  const actual = jest.requireActual('../../lib/data.js');
  return {
    ...actual,
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
  };
});

// Mock UI components
jest.mock('../common/ui.jsx', () => {
  const React = require('react');
  return {
    Btn: ({ children, onClick, disabled, variant }) => (
      <button onClick={onClick} disabled={disabled} data-variant={variant}>
        {children}
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

describe('OrderCalculator Calibration & Hours Pricing Tests', () => {
  let container, root;

  const sampleInventory = [
    { id: 'inv_flour', name: 'Flour', unit: 'kg', cost: 1000, cat: 'Dry Goods' },
    { id: 'inv_sugar', name: 'Sugar', unit: 'kg', cost: 1200, cat: 'Dry Goods' },
    { id: 'inv_butter', name: 'Butter', unit: 'kg', cost: 3000, cat: 'Dairy' },
    { id: 'inv_eggs', name: 'Eggs', unit: 'pcs', cost: 150, cat: 'Dairy' }
  ];

  const sampleRecipes = [
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
        { iid: 'inv_sugar', qty: 0.15 }
      ]
    }
  ];

  const defaultSettings = {
    monthlyOverhead: 120000,
    annualHours: 1800,
    ordersPerMonth: 20,
    hourlyRate: 1500,
    overheadPct: 27,
    accessoryPct: 15,
    profitPct: 40
  };

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
    document.body.removeChild(container);
    container = null;
  });

  test('1. Calibrated batter grams are displayed by the side of the flavour row', async () => {
    // Prefill with 1 tier, 10" round, 4" high (two 2" layers), Vanilla sponge with qty 2
    sessionStorage.setItem('ll_calc_prefill', JSON.stringify({
      clientName: 'Calibration Display Client',
      items: [
        {
          id: 'item-cake-cal',
          type: 'cake',
          name: 'Item 1 — Cake',
          tiers: [
            {
              id: 'tier-1',
              size: '10',
              shape: 'Round',
              height: 4,
              layerHeight: 2,
              layers: [
                { id: 'l-1', flavour: 'Vanilla sponge', qty: 2 }
              ],
              fillings: []
            }
          ]
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

    // 10" round pan area = ~78.54 sq in. Layer thickness = 2 in. Density = 10.911 g/in³. Trim = 8% (0.08).
    // gramsPerPan = 10.911 * 78.5398 * 2 * 1.08 = 1,850.8 g -> rounded to 1,851 g per layer.
    // 2 layers -> 1,851 * 2 = 3,702 g.
    expect(container.textContent).toContain('3,702 g');
    expect(container.textContent).toContain('F1');
    expect(container.textContent).toContain('Vanilla sponge');
  });

  test('2. Increasing Hours in Order Settings adjusts overhead cost and total price accordingly', async () => {
    sessionStorage.setItem('ll_calc_prefill', JSON.stringify({
      clientName: 'Hours Pricing Client',
      orderHours: 2,
      items: [
        {
          id: 'item-cake-hours',
          type: 'cake',
          name: 'Item 1 — Cake',
          tiers: [
            {
              id: 'tier-1',
              size: '10',
              shape: 'Round',
              height: 4,
              layerHeight: 2,
              layers: [
                { id: 'l-1', flavour: 'Vanilla sponge', qty: 2 }
              ],
              fillings: []
            }
          ]
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

    // Locate the Hours input
    const inputs = Array.from(container.querySelectorAll('input[type="number"]'));
    // The Hours input has step="0.5"
    const hoursInput = inputs.find(i => i.getAttribute('step') === '0.5');
    expect(hoursInput).toBeDefined();

    // Initial total cost or overhead text
    const initialText = container.textContent;

    // Change hours from 2 to 6 (+4 hours @ ₦1,500/hr = +₦6,000 overhead)
    await act(async () => {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      nativeInputValueSetter.call(hoursInput, '6');
      hoursInput.dispatchEvent(new Event('input', { bubbles: true }));
      hoursInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const updatedText = container.textContent;
    // The text should reflect the updated hours and overhead
    expect(updatedText).toContain('6 hours');
    expect(updatedText).not.toEqual(initialText);
  });

  test('3. Trim percentage normalization handles both 8 and 0.08 without reverting to 5,145 g default', () => {
    const pArea = planArea('Round', 10);
    const density = 10.911; // 617g in 6" round x 2"

    // When trimPct is passed as fraction 0.08
    const gFraction = gramsPerPan(density, pArea, 2, 0.08);
    // When trimPct is passed as percentage 8
    const gPercent = gramsPerPan(density, pArea, 2, 8);

    // Both should equal 1,851 g per 10" round layer (1,850.8 g), NOT 1,715 g (which x3 gave 5,145 g)
    expect(Math.round(gFraction)).toBe(1851);
    expect(Math.round(gPercent)).toBe(1851);

    // 3 layers:
    expect(Math.round(gFraction * 3)).toBe(5553);
    expect(Math.round(gPercent * 3)).toBe(5553);
    expect(Math.round(gFraction * 3)).not.toBe(5145);

    // Testing mapServerRecipeToLocal normalization
    const mappedFromFraction = mapServerRecipeToLocal({ trim_pct: 0.08 });
    expect(mappedFromFraction.trimPct).toBe(8);

    const mappedFromPercent = mapServerRecipeToLocal({ trim_pct: 8 });
    expect(mappedFromPercent.trimPct).toBe(8);
  });

  test('4. Number boxes can be cleared to empty string without snapping a static zero back', async () => {
    sessionStorage.setItem('ll_calc_prefill', JSON.stringify({
      clientName: 'Clear Zero Client',
      orderHours: 6,
      accessoriesPct: 15,
      rushPct: 10,
      seasonPct: 5,
      items: [
        {
          id: 'item-1',
          type: 'cake',
          name: 'Item 1',
          tiers: [{ id: 't-1', size: '8', shape: 'Round', height: 4, layerHeight: 2, layers: [{ id: 'l-1', flavour: 'Vanilla sponge', qty: 1 }] }]
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

    const inputs = Array.from(container.querySelectorAll('input[type="number"]'));
    const hoursInput = inputs.find(i => i.getAttribute('step') === '0.5');
    expect(hoursInput).toBeDefined();
    expect(hoursInput.value).toBe('6');

    // User clears the hours input to type a new number
    await act(async () => {
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      nativeSetter.call(hoursInput, '');
      hoursInput.dispatchEvent(new Event('input', { bubbles: true }));
      hoursInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // The input value must be empty string, NOT a static '0'
    expect(hoursInput.value).toBe('');

    // User types 8
    await act(async () => {
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      nativeSetter.call(hoursInput, '8');
      hoursInput.dispatchEvent(new Event('input', { bubbles: true }));
      hoursInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(hoursInput.value).toBe('8');
  });

  test('5. CakeLayerCalibrationCard with custom calibration computes unique batter total instead of 5,553 g default', async () => {
    const { CakeLayerCalibrationCard } = require('../inventory/MasterList.jsx');
    function CustomCalibrationTest() {
      const [modal, setModal] = React.useState({
        calShape: 'round',
        calDimA: 6,
        calGrams: 500, // custom calibration: 500 g in 6" round pan at 2" height
        calHeightIn: 2,
        trimPct: 8
      });
      return <CakeLayerCalibrationCard recipeModal={modal} setRecipeModal={setModal} />;
    }

    await act(async () => {
      root = createRoot(container);
      root.render(<CustomCalibrationTest />);
    });

    // 500g in 6" round (area = 28.27 sq in) at 2" height gives density = 8.84 g/in³.
    // For 10" round (78.54 sq in) at 2" height with 8% trim:
    // 8.8419 * 78.5398 * 2 * 1.08 = 1,499.99 -> 1,500 g per layer.
    // 3 layers = 4,500 g batter total.
    expect(container.textContent).toContain('4,500 g batter total');
    expect(container.textContent).not.toContain('5,553 g batter total');
    expect(container.textContent).toContain('Density: 8.84 g/in³');
  });
});
