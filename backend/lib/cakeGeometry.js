/**
 * cakeGeometry.js (Backend CommonJS Mirror)
 * BakeWealth Shared Mathematics & Calibration Engine
 */

const CM2 = 6.4516;

const DEFAULT_PAN_LIBRARY = [
  { id: 'tray_9_13', name: '9 × 13 tray', width: 9, length: 13 },
  { id: 'tray_12_18', name: '12 × 18 tray', width: 12, length: 18 },
  { id: 'tray_16_24', name: '16 × 24 tray', width: 16, length: 24 },
  { id: 'square_10_10', name: '10 × 10 square', width: 10, length: 10 }
];

const DEFAULT_COVERINGS_SEED = {
  bc: {
    key: 'bc',
    name: 'Buttercream',
    jobs: { fill: true, crumb: true, finish: true },
    thickness: { fill: 4.5, crumb: 1.0, finish: 4.9 },
    density: 0.90,
    wastePct: 0.15
  },
  gn: {
    key: 'gn',
    name: 'Dark ganache',
    jobs: { fill: true, crumb: true, finish: true },
    thickness: { fill: 3.0, crumb: 1.2, finish: 4.0 },
    density: 1.10,
    wastePct: 0.10
  },
  fd: {
    key: 'fd',
    name: 'Fondant',
    jobs: { fill: false, crumb: false, finish: true },
    thickness: { fill: 0, crumb: 0, finish: 8.0 },
    density: 1.35,
    wastePct: 0.25
  },
  wc: {
    key: 'wc',
    name: 'Whipped cream',
    jobs: { fill: true, crumb: false, finish: true },
    thickness: { fill: 4.0, crumb: 0, finish: 4.9 },
    density: 0.452,
    wastePct: 0.15
  },
  cm: {
    key: 'cm',
    name: 'Caramel sauce',
    jobs: { fill: true, crumb: false, finish: false },
    thickness: { fill: 1.5, crumb: 0, finish: 0 },
    density: 1.30,
    wastePct: 0.05
  }
};

function planArea(shape, a, b = 0) {
  const normShape = String(shape || 'round').toLowerCase();
  const numA = Math.max(0, Number(a) || 0);
  const numB = Math.max(0, Number(b) || 0);

  if (normShape === 'round') {
    return (Math.PI * numA * numA) / 4;
  }
  if (normShape === 'square') {
    return numA * numA;
  }
  if (normShape === 'rect') {
    return numA * (numB || numA);
  }
  return 0;
}

function perimeter(shape, a, b = 0) {
  const normShape = String(shape || 'round').toLowerCase();
  const numA = Math.max(0, Number(a) || 0);
  const numB = Math.max(0, Number(b) || 0);

  if (normShape === 'round') {
    return Math.PI * numA;
  }
  if (normShape === 'square') {
    return 4 * numA;
  }
  if (normShape === 'rect') {
    return 2 * (numA + (numB || numA));
  }
  return 0;
}

function gapArea(plan, totalLayers, slabs = 1) {
  const layers = Math.max(0, Number(totalLayers) || 0);
  const slabCount = Math.max(1, Number(slabs) || 1);
  return plan * Math.max(layers - 1, 0) * slabCount;
}

function surfaceArea(plan, peri, height) {
  const H = Math.max(0, Number(height) || 0);
  return plan + (peri * H);
}

function calculateDensity(calGrams, calShape, calDimA, calDimB, calHeightIn) {
  // Support both standard (calGrams, calShape, calDimA, calDimB, calHeightIn)
  // and inverted (calShape, calDimA, calDimB, calHeightIn, calGrams)
  if (typeof calGrams === 'string' && (['round', 'square', 'rect', 'heart', 'hexagon', 'oval'].includes(calGrams.toLowerCase()) || isNaN(Number(calGrams)))) {
    const shape = calGrams;
    const a = calShape;
    const b = calDimA;
    const h = calDimB;
    const g = calHeightIn;
    calGrams = g;
    calShape = shape;
    calDimA = a;
    calDimB = b;
    calHeightIn = h;
  }
  if (Array.isArray(calDimA)) {
    calHeightIn = calDimB;
    calDimB = calDimA[1];
    calDimA = calDimA[0];
  }
  const g = Math.max(0, Number(calGrams) || 0);
  const h = Math.max(0, Number(calHeightIn) || 0);
  const pa = planArea(calShape, calDimA, calDimB);
  if (pa <= 0 || h <= 0) return 0;
  return g / (pa * h);
}

function gramsPerPan(density, plan, layerThicknessIn, trimPct = 0.08) {
  const d = Math.max(0, Number(density) || 0);
  const pa = Math.max(0, Number(plan) || 0);
  const th = Math.max(0, Number(layerThicknessIn) || 0);
  const tr = Math.max(0, Number(trimPct) || 0);
  return d * pa * th * (1 + tr);
}

function coveringMass(areaIn2, thicknessMm, densityGPerCm3, wastePct = 0) {
  const a = Math.max(0, Number(areaIn2) || 0);
  const mm = Math.max(0, Number(thicknessMm) || 0);
  const den = Math.max(0, Number(densityGPerCm3) || 0);
  const was = Math.max(0, Number(wastePct) || 0);
  return a * CM2 * (mm / 10) * den * (1 + was);
}

function reverseThicknessMm(grams, areaIn2, densityGPerCm3, wastePct = 0) {
  const g = Math.max(0, Number(grams) || 0);
  const a = Math.max(0, Number(areaIn2) || 0);
  const den = Math.max(0, Number(densityGPerCm3) || 0);
  const was = Math.max(0, Number(wastePct) || 0);
  const denom = a * CM2 * den * (1 + was);
  if (denom <= 0) return 0;
  return (g / denom) * 10;
}

function perPan(trayW, trayL, sliceW, sliceL) {
  const W = Math.max(0, Number(trayW) || 0);
  const L = Math.max(0, Number(trayL) || 0);
  const w = Math.max(0, Number(sliceW) || 0);
  const l = Math.max(0, Number(sliceL) || 0);
  if (w <= 0 || l <= 0) return 0;
  const orientA = Math.floor(L / l) * Math.floor(W / w);
  const orientB = Math.floor(L / w) * Math.floor(W / l);
  return Math.max(orientA, orientB);
}

function calculateCostStack({
  directCost = 0,
  packaging = 0,
  toppers = 0,
  accessoriesPct = 0.15,
  overheadMethod = 'pct',
  overheadPct = 0.27,
  hours = 0,
  hourlyRate = 5997,
  perOrderRate = 44979,
  marginPct = 0.50,
  rushPct = 0,
  seasonPct = 0
}) {
  const direct = Math.max(0, Number(directCost) || 0) + Math.max(0, Number(packaging) || 0) + Math.max(0, Number(toppers) || 0);
  const accPct = (Number(accessoriesPct) > 1) ? Number(accessoriesPct) / 100 : Math.max(0, Number(accessoriesPct) || 0);
  const accessories = direct * accPct;

  let overhead = 0;
  if (overheadMethod === 'hr') {
    overhead = Math.max(0, Number(hours) || 0) * Math.max(0, Number(hourlyRate) || 0);
  } else if (overheadMethod === 'ord') {
    overhead = Math.max(0, Number(perOrderRate) || 0);
  } else {
    const ohPct = (Number(overheadPct) > 1) ? Number(overheadPct) / 100 : Math.max(0, Number(overheadPct) || 0);
    overhead = (direct + accessories) * ohPct;
  }

  const totalCost = direct + accessories + overhead;
  const safeMargin = (Number(marginPct) > 1) ? Math.min(0.99, Number(marginPct) / 100) : Math.min(0.99, Math.max(0, Number(marginPct) || 0));
  const price = safeMargin >= 1 ? totalCost : (totalCost / (1 - safeMargin));

  const safeRush = (Number(rushPct) > 1) ? Number(rushPct) / 100 : Math.max(0, Number(rushPct) || 0);
  const safeSeason = (Number(seasonPct) > 1) ? Number(seasonPct) / 100 : Math.max(0, Number(seasonPct) || 0);
  const priceWithSurcharges = price * (1 + safeRush + safeSeason);
  const charge = Math.ceil(priceWithSurcharges / 500) * 500;

  return {
    direct: Math.round(direct),
    packaging: Math.round(packaging),
    toppers: Math.round(toppers),
    accessories: Math.round(accessories),
    overhead: Math.round(overhead),
    overheadMethod,
    totalCost: Math.round(totalCost),
    price: Math.round(price),
    surcharges: Math.round(priceWithSurcharges - price),
    charge
  };
}

function deriveOverheadRates(monthlyOverhead, annualProductionHours = 1800, ordersPerMonth = 20) {
  const mo = Math.max(0, Number(monthlyOverhead) || 0);
  const annHrs = Math.max(1, Number(annualProductionHours) || 1800);
  const ordCount = Math.max(1, Number(ordersPerMonth) || 20);

  const hourlyRate = (mo * 12) / annHrs;
  const perOrderRate = mo / ordCount;
  return {
    hourlyRate: Math.round(hourlyRate),
    perOrderRate: Math.round(perOrderRate)
  };
}

function scaleRecipeIngredients(ingredients, targetGrams, baseYield) {
  const target = Math.max(0, Number(targetGrams) || 0);
  const base = Math.max(0.001, Number(baseYield) || 0);
  const scaleFactor = target / base;

  if (!Array.isArray(ingredients) || ingredients.length === 0) return [];

  const scaled = ingredients.map((ing) => {
    const rawQty = (Number(ing.quantity) || 0) * scaleFactor;
    return {
      name: ing.name,
      unit: ing.unit || 'g',
      rawQty,
      quantity: Math.round(rawQty)
    };
  });

  const currentSum = scaled.reduce((s, it) => s + it.quantity, 0);
  const diff = Math.round(target) - currentSum;
  if (diff !== 0 && scaled.length > 0) {
    let maxIdx = 0;
    let maxQty = -1;
    scaled.forEach((it, idx) => {
      if (it.quantity > maxQty) {
        maxQty = it.quantity;
        maxIdx = idx;
      }
    });
    scaled[maxIdx].quantity += diff;
  }

  return scaled;
}

module.exports = {
  CM2,
  DEFAULT_PAN_LIBRARY,
  DEFAULT_COVERINGS_SEED,
  planArea,
  perimeter,
  gapArea,
  surfaceArea,
  calculateDensity,
  gramsPerPan,
  coveringMass,
  reverseThicknessMm,
  perPan,
  calculateCostStack,
  deriveOverheadRates,
  scaleRecipeIngredients
};
