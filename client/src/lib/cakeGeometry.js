/**
 * cakeGeometry.js
 * ----------------------------------------------------------------------------
 * BakeWealth Shared Mathematics & Calibration Engine
 * 
 * Implements exact kitchen calibration, geometric calculation of plan area,
 * perimeter, surface area, gap area, calibrated batter densities, pour weights,
 * covering masses (from mm thickness, cm² conversion, and material density),
 * portioning slabs and cutting geometries, order-level cost stacking, and
 * recipe ingredient scaling.
 * ----------------------------------------------------------------------------
 */

export const CM2 = 6.4516; // 1 square inch = 6.4516 cm²

/**
 * Common Pan Library for Slabs / Trays
 */
export const DEFAULT_PAN_LIBRARY = [
  Object.assign(['9 × 13 tray', 9, 13], { id: 'tray_9_13', name: '9 × 13 tray', label: '9 × 13 tray', width: 9, length: 13 }),
  Object.assign(['12 × 18 tray', 12, 18], { id: 'tray_12_18', name: '12 × 18 tray', label: '12 × 18 tray', width: 12, length: 18 }),
  Object.assign(['16 × 24 tray', 16, 24], { id: 'tray_16_24', name: '16 × 24 tray', label: '16 × 24 tray', width: 16, length: 24 }),
  Object.assign(['10 × 10 square', 10, 10], { id: 'square_10_10', name: '10 × 10 square', label: '10 × 10 square', width: 10, length: 10 })
];
export const STANDARD_PANS = DEFAULT_PAN_LIBRARY;

/**
 * Standard seed coverings data
 */
export const DEFAULT_COVERINGS_SEED = {
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

/**
 * Calculate the 2D plan area of a pan in square inches.
 * @param {'round'|'square'|'rect'} shape 
 * @param {number} a - Diameter (round), Side (square), or Width/Length (rect)
 * @param {number} [b] - Width/Length (rect)
 * @returns {number} Plan area in sq inches
 */
export function planArea(shape, a, b = 0) {
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

/**
 * Calculate the perimeter of a pan in inches.
 * @param {'round'|'square'|'rect'} shape 
 * @param {number} a 
 * @param {number} [b] 
 * @returns {number} Perimeter in inches
 */
export function perimeter(shape, a, b = 0) {
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

/**
 * Gap area between cake layers (plan * max(totalLayers - 1, 0)) in sq inches.
 * @param {number} plan - Plan area in sq inches
 * @param {number} totalLayers - Total number of cake layers in tier / slab
 * @param {number} [slabs=1] - Number of slabs (for portions)
 * @returns {number}
 */
export function gapArea(plan, totalLayers, slabs = 1) {
  const layers = Math.max(0, Number(totalLayers) || 0);
  const slabCount = Math.max(1, Number(slabs) || 1);
  return plan * Math.max(layers - 1, 0) * slabCount;
}

/**
 * Surface area of cake tier (plan + perimeter * height) in sq inches.
 * Reused across crumb coat, outside finish, and decoration.
 * @param {number} plan 
 * @param {number} peri 
 * @param {number} height 
 * @returns {number}
 */
export function surfaceArea(plan, peri, height) {
  const H = Math.max(0, Number(height) || 0);
  return plan + (peri * H);
}

/**
 * Calibrate batter density from a single measured bake.
 * Returns grams per square inch per inch of finished levelled height.
 * @param {number} calGrams - Weight poured into calibration pan before baking
 * @param {'round'|'square'|'rect'} calShape - Pan shape used
 * @param {number} calDimA - Dimension A (diameter, side, or length)
 * @param {number} calDimB - Dimension B (width if rect)
 * @param {number} calHeightIn - Finished layer height after levelling (inches)
 * @returns {number} Density in g / (in² * in)
 */
export function calculateDensity(calGrams, calShape, calDimA, calDimB, calHeightIn) {
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

/**
 * Batter pour weight per pan for any size, shape, and layer thickness.
 * Gross weight including trim.
 * @param {number} density - g/in²/in from calibration
 * @param {number} plan - Plan area of pan in sq inches
 * @param {number} layerThicknessIn - Thickness of layer in inches (height / layers)
 * @param {number} [trimPct=0.08] - Trim allowance fraction (e.g. 0.08 for 8%)
 * @returns {number} Grams per pan
 */
export function gramsPerPan(density, plan, layerThicknessIn, trimPct = 0.08) {
  const d = Math.max(0, Number(density) || 0);
  const pa = Math.max(0, Number(plan) || 0);
  const th = Math.max(0, Number(layerThicknessIn) || 0);
  const tr = Math.max(0, Number(trimPct) || 0);
  return d * pa * th * (1 + tr);
}

/**
 * Covering mass from area, applied thickness, material density, and waste.
 * Gross weight including waste.
 * @param {number} areaIn2 - Area in square inches (gapArea for filling, surfaceArea for crumb/finish)
 * @param {number} thicknessMm - Applied thickness in millimetres
 * @param {number} densityGPerCm3 - Material density in g/cm³
 * @param {number} [wastePct=0] - Waste allowance fraction (e.g. 0.15 for 15%)
 * @returns {number} Grams of covering
 */
export function coveringMass(areaIn2, thicknessMm, densityGPerCm3, wastePct = 0) {
  const a = Math.max(0, Number(areaIn2) || 0);
  const mm = Math.max(0, Number(thicknessMm) || 0);
  const den = Math.max(0, Number(densityGPerCm3) || 0);
  const was = Math.max(0, Number(wastePct) || 0);
  return a * CM2 * (mm / 10) * den * (1 + was);
}

/**
 * Reverse formula for covering calibration helper.
 * Derives applied thickness in mm from weighed grams used, area, material density, and waste.
 * @param {number} grams - Gross grams used
 * @param {number} areaIn2 - Area covered in square inches
 * @param {number} densityGPerCm3 - Material density in g/cm³
 * @param {number} [wastePct=0] - Waste allowance fraction
 * @returns {number} Derived thickness in mm
 */
export function reverseThicknessMm(grams, areaIn2, densityGPerCm3, wastePct = 0) {
  const g = Math.max(0, Number(grams) || 0);
  const a = Math.max(0, Number(areaIn2) || 0);
  const den = Math.max(0, Number(densityGPerCm3) || 0);
  const was = Math.max(0, Number(wastePct) || 0);
  const denom = a * CM2 * den * (1 + was);
  if (denom <= 0) return 0;
  return (g / denom) * 10;
}

/**
 * Calculate maximum slices a slab pan gives, testing both cut orientations.
 * @param {number} trayW - Tray width in inches
 * @param {number} trayL - Tray length in inches
 * @param {number} sliceW - Slice width in inches
 * @param {number} sliceL - Slice length in inches
 * @returns {number} Maximum slices
 */
export function perPan(trayW, trayL, sliceW, sliceL) {
  const W = Math.max(0, Number(trayW) || 0);
  const L = Math.max(0, Number(trayL) || 0);
  const w = Math.max(0, Number(sliceW) || 0);
  const l = Math.max(0, Number(sliceL) || 0);
  if (w <= 0 || l <= 0) return 0;
  const orientA = Math.floor(L / l) * Math.floor(W / w);
  const orientB = Math.floor(L / w) * Math.floor(W / l);
  return Math.max(orientA, orientB);
}

/**
 * Portions geometry calculation.
 * @param {object} params
 * @param {number} params.servings - Number of requested servings
 * @param {number} [params.allowance=0.05] - Cutting allowance fraction
 * @param {number} params.trayW - Tray width
 * @param {number} params.trayL - Tray length
 * @param {number} params.sliceW - Slice width
 * @param {number} params.sliceL - Slice length
 * @param {number} params.sliceHeight - Total finished slice height
 * @param {Array<{recipeId: string, layers: number, density: number, trimPct: number, costPerGram: number}>} params.flavourRows
 * @returns {object} Portions geometry results
 */
export function calculatePortionsGeometry({
  servings,
  allowance,
  allowancePct,
  trayW,
  trayL,
  sliceW,
  sliceL,
  sliceWidth,
  sliceLength,
  sliceHeight,
  pan,
  layers,
  flavourRows = [],
  cuttingAllowancePct,
  trayWidth,
  trayLength,
  _layerCount,
  _fillings,
  _fillingsList,
  fillRecipe = null,
  topRecipe = null
}) {
  const effectiveAllowance = allowancePct !== undefined ? allowancePct : (cuttingAllowancePct !== undefined ? cuttingAllowancePct : allowance);
  const al = effectiveAllowance !== undefined ? (Number(effectiveAllowance) > 1 ? Number(effectiveAllowance) / 100 : Number(effectiveAllowance)) : 0.05;
  const needed = Math.ceil((Number(servings) || 100) * (1 + al));
  const w = Number(sliceW || sliceWidth) || 2;
  const l = Number(sliceL || sliceLength) || 2;
  const Ht = Number(sliceHeight) || 4;

  const width = Number(trayW || trayWidth || pan?.width || pan?.[1]) || 12;
  const length = Number(trayL || trayLength || pan?.length || pan?.[2]) || 18;

  const slicesPerSlab = perPan(width, length, w, l);
  const slabs = Math.max(1, Math.ceil(needed / Math.max(1, slicesPerSlab)));

  const rows = (layers || flavourRows || []).map(r => ({
    recipeId: r.recipeId || r.flavour,
    layers: Number(r.layers || r.qty) || 1,
    density: Number(r.density) || 0.8,
    trimPct: r.trimPct !== undefined ? Number(r.trimPct) : (r.trim_pct !== undefined ? Number(r.trim_pct) : 0.08),
    costPerGram: Number(r.costPerGram) || 0,
    recipe: r.recipe
  }));

  const totalLayers = rows.reduce((sum, f) => sum + (Number(f.layers) || 0), 0) || 1;
  const layerThickness = Ht / totalLayers;
  const panAreaSqIn = width * length;

  let totalBatterGrams = 0;
  let totalBatterCost = 0;
  const rowResults = rows.map((f) => {
    const layersInRow = Number(f.layers) || 0;
    const gPerPan = f.density * panAreaSqIn * layerThickness * (1 + f.trimPct);
    const pansToBake = layersInRow * slabs;
    const rowGrams = gPerPan * pansToBake;
    const rowCost = rowGrams * f.costPerGram;

    totalBatterGrams += rowGrams;
    totalBatterCost += rowCost;

    return {
      recipeId: f.recipeId,
      recipe: f.recipe,
      layerCount: layersInRow,
      layers: layersInRow,
      gramsPerPan: gPerPan,
      pansForRow: pansToBake,
      pansToBake,
      totalGrams: rowGrams,
      cost: rowCost
    };
  });

  const gapAreaSqIn = panAreaSqIn * Math.max(totalLayers - 1, 0) * slabs;
  const topAreaSqIn = panAreaSqIn * slabs;
  const totalPans = totalLayers * slabs;

  let fillGrams = 0;
  let fillCost = 0;
  if (fillRecipe && gapAreaSqIn > 0) {
    fillGrams = coveringMass(gapAreaSqIn, fillRecipe.thickMm || 4.5, fillRecipe.density || 0.90, fillRecipe.wastePct || 0.15);
    fillCost = fillGrams * (Number(fillRecipe.costPerGram) || 0);
  }

  let topGrams = 0;
  let topCost = 0;
  if (topRecipe && topAreaSqIn > 0) {
    topGrams = coveringMass(topAreaSqIn, topRecipe.thickMm || 4.0, topRecipe.density || 1.10, topRecipe.wastePct || 0.10);
    topCost = topGrams * (Number(topRecipe.costPerGram) || 0);
  }

  const totalCost = totalBatterCost + fillCost + topCost;

  return {
    needed,
    neededServings: needed,
    slicesPerSlab,
    slabs,
    totalLayers,
    layerThickness,
    totalPans,
    panArea: panAreaSqIn,
    panAreaSqIn,
    gapArea: gapAreaSqIn,
    gapAreaSqIn,
    topArea: topAreaSqIn,
    topAreaSqIn,
    rowResults,
    flavourRows: rowResults,
    totalBatterGrams,
    totalBatterCost,
    fillGrams,
    fillCost,
    fillRecipe,
    topGrams,
    topCost,
    topRecipe,
    totalCost
  };
}

/**
 * Order-Level Unified Cost Stack
 * 
 * Order of operations:
 *   direct      = sum(item direct costs) + packaging + toppers
 *   accessories = direct * accessories_pct
 *   total       = direct + accessories + overhead
 *   price       = total / (1 - margin_pct)
 *   charge      = ceil( price * (1 + rush_pct + season_pct) / 500 ) * 500
 * 
 * Overhead methods:
 *   'pct': (direct + accessories) * pct
 *   'hr':  hours * hourlyRate
 *   'ord': perOrderRate
 * 
 * @param {object} params
 * @param {number} params.directCost - Sum of item direct costs
 * @param {number} [params.packaging=0] - Packaging costs
 * @param {number} [params.toppers=0] - Custom topper costs
 * @param {number} [params.accessoriesPct=0.15] - Accessories percentage fraction (e.g. 0.15)
 * @param {'pct'|'hr'|'ord'} [params.overheadMethod='pct'] - Method
 * @param {number} [params.overheadPct=0.27] - Overhead pct if method is 'pct'
 * @param {number} [params.hours=0] - Production hours if method is 'hr'
 * @param {number} [params.hourlyRate=5997] - Hourly rate derived from shop settings
 * @param {number} [params.perOrderRate=44979] - Per order rate derived from shop settings
 * @param {number} [params.marginPct=0.50] - Profit margin fraction (price = total / (1 - marginPct))
 * @param {number} [params.rushPct=0] - Rush surcharge fraction (e.g. 0.10)
 * @param {number} [params.seasonPct=0] - Peak season surcharge fraction (e.g. 0.05)
 * @returns {object} Calculated cost stack breakdown
 */
export function calculateCostStack({
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
    // default 'pct': (direct + accessories) * overheadPct
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

/**
 * Derive hourly rate and per-order rate from shop overhead settings.
 * @param {number} monthlyOverhead - Total monthly overhead
 * @param {number} [annualProductionHours=1800] - Annual production hours
 * @param {number} [ordersPerMonth=20] - Expected orders per month
 * @returns {{hourlyRate: number, perOrderRate: number}}
 */
export function deriveOverheadRates(monthlyOverhead, annualProductionHours = 1800, ordersPerMonth = 20) {
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

/**
 * Scales a recipe's ingredients to match a target weight in grams (e.g. for one pan).
 * Guarantees that rounded ingredient weights sum back to the target weight.
 * @param {Array<{name: string, quantity: number, unit?: string}>} ingredients 
 * @param {number} targetGrams - Required weight in grams
 * @param {number} baseYield - Base recipe yield in grams
 * @returns {Array<{name: string, quantity: number, unit: string}>} Scaled ingredients
 */
export function scaleRecipeIngredients(ingredients, targetGrams, baseYield) {
  const target = Math.max(0, Number(targetGrams) || 0);
  const base = Math.max(0.001, Number(baseYield) || 0);
  const scaleFactor = target / base;

  if (!Array.isArray(ingredients) || ingredients.length === 0) return [];

  const scaled = ingredients.map((ing) => {
    const rawQty = (Number(ing.quantity) || 0) * scaleFactor;
    return {
      ...ing,
      name: ing.name,
      unit: ing.unit || 'g',
      rawQty,
      quantity: Math.round(rawQty)
    };
  });

  // Reconcile rounding difference to match target exactly on the largest ingredient
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
