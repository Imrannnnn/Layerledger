import {
  CM2,
  planArea,
  perimeter,
  gapArea,
  surfaceArea,
  calculateDensity,
  gramsPerPan,
  coveringMass,
  reverseThicknessMm,
  perPan,
  calculatePortionsGeometry,
  calculateCostStack,
  deriveOverheadRates,
  scaleRecipeIngredients
} from './cakeGeometry.js';

describe('Shared Geometry and Mass Engine Specification Tests', () => {
  test('Item 1: Plan area — round πA²/4, square A², rect A×B', () => {
    // Round: diameter 10" -> π * 10² / 4 = 78.5398...
    const roundArea = planArea('round', 10);
    expect(roundArea).toBeCloseTo((Math.PI * 100) / 4, 4);
    expect(roundArea).toBeCloseTo(78.5398, 3);

    // Square: side 8" -> 8² = 64
    const squareArea = planArea('square', 8);
    expect(squareArea).toBe(64);

    // Rect: 9 × 13 -> 117
    const rectArea = planArea('rect', 9, 13);
    expect(rectArea).toBe(117);

    // Sheet alias for rect
    const sheetArea = planArea('sheet', 12, 18);
    expect(sheetArea).toBe(216);
  });

  test('Item 2: Perimeter — round πA, square 4A, rect 2(A+B)', () => {
    // Round: diameter 10" -> π * 10 = 31.4159...
    const roundPeri = perimeter('round', 10);
    expect(roundPeri).toBeCloseTo(Math.PI * 10, 4);
    expect(roundPeri).toBeCloseTo(31.4159, 3);

    // Square: side 8" -> 4 * 8 = 32
    const squarePeri = perimeter('square', 8);
    expect(squarePeri).toBe(32);

    // Rect: 9 × 13 -> 2 * (9 + 13) = 44
    const rectPeri = perimeter('rect', 9, 13);
    expect(rectPeri).toBe(44);
  });

  test('Item 3: Gap area — gapArea = planArea × (totalLayers − 1) [number of gaps, not layers]', () => {
    const pa = planArea('round', 8); // 50.2655
    // 1 layer -> 0 gaps
    expect(gapArea(pa, 1)).toBe(0);
    // 2 layers -> 1 gap
    expect(gapArea(pa, 2)).toBeCloseTo(pa * 1, 4);
    // 3 layers -> 2 gaps
    expect(gapArea(pa, 3)).toBeCloseTo(pa * 2, 4);
    // 4 layers -> 3 gaps
    expect(gapArea(pa, 4)).toBeCloseTo(pa * 3, 4);
  });

  test('Item 4: Surface area, computed once and reused — surfaceArea = planArea + perimeter × height', () => {
    // 10" round, 6" height
    const pa = planArea('round', 10);
    const pe = perimeter('round', 10);
    const sa = surfaceArea(pa, pe, 6);
    expect(sa).toBeCloseTo(pa + pe * 6, 4);
    expect(sa).toBeCloseTo(78.5398 + 31.4159 * 6, 2);

    // Reused across crumb coat, outside finish, and decoration
    const crumbGrams = coveringMass(sa, 1.0, 0.90, 0.10);
    const finishGrams = coveringMass(sa, 4.9, 0.90, 0.15);
    expect(crumbGrams).toBeGreaterThan(0);
    expect(finishGrams).toBeGreaterThan(crumbGrams);
  });

  test('Item 5: Pan weight from calibration — gramsPerPan = density × planArea × layerThickness × (1 + trim)', () => {
    const density = 10.911; // g / (in² * in)
    const pa = planArea('round', 8); // 50.2655 in²
    const layerThickness = 2.0; // 2 inches
    const trim = 0.08; // 8% trim

    const gpp = gramsPerPan(density, pa, layerThickness, trim);
    const expected = density * pa * layerThickness * (1 + trim);
    expect(gpp).toBeCloseTo(expected, 4);
    expect(Math.round(gpp)).toBe(1185); // 1,185 g matches user screenshot for 8" tier at 2.00"
  });

  test('Item 6: Covering mass from thickness — grams = area × 6.4516 × (mm ÷ 10) × density × (1 + waste)', () => {
    const area = 100; // in²
    const mm = 4.5;
    const density = 0.90; // g/cm³
    const waste = 0.15; // 15%

    const g = coveringMass(area, mm, density, waste);
    const expected = area * 6.4516 * (mm / 10) * density * (1 + waste);
    expect(g).toBeCloseTo(expected, 4);
    expect(CM2).toBe(6.4516);
  });

  test('Item 7: Covering thickness from mass (reverse) — mm = grams ÷ (area × 6.4516 × density × (1 + waste)) × 10', () => {
    const area = 100;
    const density = 0.90;
    const waste = 0.15;
    const knownThicknessMm = 4.5;

    // Forward direction: compute grams with waste multiplied in
    const grams = coveringMass(area, knownThicknessMm, density, waste);

    // Reverse direction: waste is divided out
    const derivedMm = reverseThicknessMm(grams, area, density, waste);
    expect(derivedMm).toBeCloseTo(knownThicknessMm, 4);
  });

  test('Item 8: All quoted, costed and stock-deducted weights are gross (waste and trim stay inside)', () => {
    // Batter weight includes trim (1 + trim)
    const netBatter = 10.911 * 50.2655 * 2.0;
    const grossBatter = gramsPerPan(10.911, 50.2655, 2.0, 0.08);
    expect(grossBatter).toBeCloseTo(netBatter * 1.08, 3);
    expect(grossBatter).toBeGreaterThan(netBatter);

    // Covering mass includes waste (1 + waste)
    const netCovering = 100 * 6.4516 * (4.5 / 10) * 0.90;
    const grossCovering = coveringMass(100, 4.5, 0.90, 0.15);
    expect(grossCovering).toBeCloseTo(netCovering * 1.15, 3);
    expect(grossCovering).toBeGreaterThan(netCovering);
  });
});

describe('BakeWealth Shared Mathematics & Calibration Spec Acceptance Tests', () => {
  test('Check 1: Calibration (617 g poured into 6 inch round, levelled to 2 inches)', () => {
    const pa = planArea('round', 6);
    expect(pa).toBeCloseTo(28.274, 3);

    const density = calculateDensity(617, 'round', 6, 0, 2);
    expect(density).toBeCloseTo(10.911, 3);
  });

  test('Check 2: Height division across mixed flavours (10 inch round, 7 inches tall, 3 flavour rows)', () => {
    const pa = planArea('round', 10);
    const layers = [
      { name: 'vanilla', d: 10.911, n: 1, trim: 0.08 },
      { name: 'chocolate', d: 11.088, n: 1, trim: 0.08 },
      { name: 'red_velvet', d: 13.104, n: 1, trim: 0.08 }
    ];
    const totalLayers = layers.reduce((s, l) => s + l.n, 0);
    const layerThickness = 7.0 / totalLayers;
    expect(layerThickness).toBeCloseTo(2.33, 2);

    const vanGrams = gramsPerPan(layers[0].d, pa, layerThickness, layers[0].trim);
    const choGrams = gramsPerPan(layers[1].d, pa, layerThickness, layers[1].trim);
    const rvGrams = gramsPerPan(layers[2].d, pa, layerThickness, layers[2].trim);

    expect(Math.round(vanGrams)).toBe(2160);
    expect(Math.round(choGrams)).toBe(2195);
    expect(Math.round(rvGrams)).toBe(2594);

    const totalBatterKg = (vanGrams + choGrams + rvGrams) / 1000;
    expect(totalBatterKg).toBeCloseTo(6.95, 2);
  });

  test('Check 3: Covering mass (10 inch round, 7 inches tall, surf 298.45 in², gap 157.08 in²)', () => {
    const pa = planArea('round', 10);
    const pe = perimeter('round', 10);
    const surf = surfaceArea(pa, pe, 7.0);
    const gap = gapArea(pa, 3);

    expect(surf).toBeCloseTo(298.45, 2);
    expect(gap).toBeCloseTo(157.08, 2);

    // Fondant finish, 8 mm, density 1.35, waste 25%
    const fondant = coveringMass(surf, 8.0, 1.35, 0.25);
    expect(Math.round(fondant)).toBe(2599);

    // Buttercream filling, 4.5 mm, density 0.90, waste 15%
    const bcFilling = coveringMass(gap, 4.5, 0.90, 0.15);
    expect(Math.round(bcFilling)).toBe(472);
  });

  test('Check 4: Thickness round trip (reverse formula returns exact 8.00 mm)', () => {
    const surf = 298.45;
    const fondantGrams = 2599;
    const reverseMm = reverseThicknessMm(fondantGrams, surf, 1.35, 0.25);
    expect(Number(reverseMm.toFixed(2))).toBe(8.00);
  });

  test('Check 5: Portions geometry (100 servings, 2x2x4 slices, 5% allowance, 12x18 tray, 3 layers [2 van, 1 cho])', () => {
    const result = calculatePortionsGeometry({
      servings: 100,
      allowance: 0.05,
      trayW: 12,
      trayL: 18,
      sliceW: 2,
      sliceL: 2,
      sliceHeight: 4,
      flavourRows: [
        { recipeId: 'van', layers: 2, density: 10.911, trimPct: 0.08, costPerGram: 5.527 },
        { recipeId: 'cho', layers: 1, density: 11.088, trimPct: 0.08, costPerGram: 5.669 }
      ]
    });

    expect(result.needed).toBe(105);
    expect(result.slicesPerSlab).toBe(54);
    expect(result.slabs).toBe(2);
    expect(result.totalPans).toBe(6);
    expect(result.layerThickness).toBeCloseTo(1.33, 2);

    const vanRow = result.rowResults[0];
    const choRow = result.rowResults[1];

    expect(Math.round(vanRow.gramsPerPan)).toBe(3394);
    expect(vanRow.pansToBake).toBe(4);
    expect(Math.round(choRow.gramsPerPan)).toBe(3449);
    expect(choRow.pansToBake).toBe(2);

    expect(result.totalBatterGrams / 1000).toBeCloseTo(20.47, 2);

    const bcFilling = coveringMass(result.gapAreaSqIn, 4.5, 0.90, 0.15);
    expect(bcFilling / 1000).toBeCloseTo(2.60, 2);
  });

  test('Check 6: Portions layers sensitivity (3 layers vs 4 layers inside 4 inch slice)', () => {
    const result3 = calculatePortionsGeometry({
      servings: 100,
      allowance: 0.05,
      trayW: 12,
      trayL: 18,
      sliceW: 2,
      sliceL: 2,
      sliceHeight: 4,
      flavourRows: [
        { recipeId: 'van', layers: 2, density: 10.911, trimPct: 0.08, costPerGram: 5.527 },
        { recipeId: 'cho', layers: 1, density: 11.088, trimPct: 0.08, costPerGram: 5.669 }
      ]
    });

    const result4 = calculatePortionsGeometry({
      servings: 100,
      allowance: 0.05,
      trayW: 12,
      trayL: 18,
      sliceW: 2,
      sliceL: 2,
      sliceHeight: 4,
      flavourRows: [
        { recipeId: 'van', layers: 3, density: 10.911, trimPct: 0.08, costPerGram: 5.527 },
        { recipeId: 'cho', layers: 1, density: 11.088, trimPct: 0.08, costPerGram: 5.669 }
      ]
    });

    expect(result3.layerThickness).toBeCloseTo(1.33, 2);
    expect(result4.layerThickness).toBeCloseTo(1.00, 2);

    expect(result3.totalPans).toBe(6);
    expect(result4.totalPans).toBe(8);

    expect(result3.totalBatterGrams / 1000).toBeCloseTo(20.47, 1);
    expect(result4.totalBatterGrams / 1000).toBeCloseTo(20.44, 1);

    const fill3 = coveringMass(result3.gapAreaSqIn, 4.5, 0.90, 0.15);
    const fill4 = coveringMass(result4.gapAreaSqIn, 4.5, 0.90, 0.15);

    expect(fill3 / 1000).toBeCloseTo(2.60, 2);
    expect(fill4 / 1000).toBeCloseTo(3.89, 2);
  });

  test('Check 7: Scaled recipe per pan (Vanilla base recipe 1,221 g scaled to 1,851 g)', () => {
    const baseIngredients = [
      { name: 'butter', quantity: 250 },
      { name: 'sugar', quantity: 250 },
      { name: 'eggs', quantity: 250 },
      { name: 'flour', quantity: 300 },
      { name: 'milk', quantity: 150 },
      { name: 'baking powder', quantity: 10 },
      { name: 'salt', quantity: 3 },
      { name: 'vanilla', quantity: 8 }
    ];

    const scaled = scaleRecipeIngredients(baseIngredients, 1851, 1221);
    const map = {};
    scaled.forEach((it) => { map[it.name] = it.quantity; });

    expect(map.butter).toBe(379);
    expect(map.sugar).toBe(379);
    expect(map.eggs).toBe(379);
    expect(map.flour).toBe(455);
    expect(map.milk).toBe(227);
    expect(map['baking powder']).toBe(15);
    expect(map.salt).toBe(5);
    expect(map.vanilla).toBe(12);

    const totalSum = scaled.reduce((s, it) => s + it.quantity, 0);
    expect(totalSum).toBe(1851);
  });

  test('Check 8: Cost stack direction (Direct 100,000, Acc 15%, Overhead 27%, Margin 50%)', () => {
    const stack = calculateCostStack({
      directCost: 100000,
      packaging: 0,
      toppers: 0,
      accessoriesPct: 0.15,
      overheadMethod: 'pct',
      overheadPct: 0.27,
      marginPct: 0.50,
      rushPct: 0,
      seasonPct: 0
    });

    expect(stack.direct).toBe(100000);
    expect(stack.accessories).toBe(15000);
    expect(stack.overhead).toBe(31050);
    expect(stack.totalCost).toBe(146050);
    expect(stack.price).toBe(292100);
    expect(stack.charge).toBe(292500);
  });

  test('Check 9: Helper utilities (CM2, perPan, deriveOverheadRates)', () => {
    expect(CM2).toBeCloseTo(6.4516, 4);

    // 9x13 pan, 2x2 slice
    const slices = perPan(9, 13, 2, 2);
    expect(slices).toBe(24);

    // Monthly overhead 100,000, 1800 annual hours, 20 orders/month
    const rates = deriveOverheadRates(100000, 1800, 20);
    expect(rates.hourlyRate).toBe(Math.round((100000 * 12) / 1800));
    expect(rates.perOrderRate).toBe(5000);
  });
});
