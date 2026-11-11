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
