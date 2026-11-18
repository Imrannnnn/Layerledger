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
 * Ships with 9×13, 12×18, 16×24 and 10×10 square.
 * Editable by the baker via getPanLibrary() & savePanLibrary().
 */
export function formatPan(pan) {
  const width = Number(pan.width !== undefined ? pan.width : pan[1]) || 0;
  const length = Number(pan.length !== undefined ? pan.length : (pan[2] !== undefined ? pan[2] : width)) || 0;
  const name = pan.name || pan.label || pan[0] || `${width} × ${length} pan`;
  const id = pan.id || `pan_${width}_${length}_${String(name).replace(/\s+/g, '_').toLowerCase()}`;
  const arr = [name, width, length];
  return Object.assign(arr, { id, name, label: name, width, length });
}

export const DEFAULT_PAN_LIBRARY = [
  Object.assign(['9 × 13 tray', 9, 13], { id: 'tray_9_13', name: '9 × 13 tray', label: '9 × 13 tray', width: 9, length: 13 }),
  Object.assign(['12 × 18 tray', 12, 18], { id: 'tray_12_18', name: '12 × 18 tray', label: '12 × 18 tray', width: 12, length: 18 }),
  Object.assign(['16 × 24 tray', 16, 24], { id: 'tray_16_24', name: '16 × 24 tray', label: '16 × 24 tray', width: 16, length: 24 }),
  Object.assign(['10 × 10 square', 10, 10], { id: 'square_10_10', name: '10 × 10 square', label: '10 × 10 square', width: 10, length: 10 })
];

export function getPanLibrary() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = localStorage.getItem('ll_pan_library');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map(formatPan);
        }
      }
    }
  } catch (e) {
    console.warn("Failed to load pan library from storage:", e);
  }
  return DEFAULT_PAN_LIBRARY.map(formatPan);
}

export function savePanLibrary(pans) {
  try {
    const formatted = (pans && Array.isArray(pans) && pans.length > 0 ? pans : DEFAULT_PAN_LIBRARY).map(formatPan);
    const plain = formatted.map(p => ({
      id: p.id,
      name: p.name,
      label: p.label,
      width: p.width,
      length: p.length
    }));
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('ll_pan_library', JSON.stringify(plain));
      window.dispatchEvent(new CustomEvent('pan_library_updated', { detail: plain }));
    }
    STANDARD_PANS.length = 0;
    formatted.forEach(p => STANDARD_PANS.push(p));
    return formatted;
  } catch (e) {
    console.warn("Failed to save pan library to storage:", e);
    return DEFAULT_PAN_LIBRARY.map(formatPan);
  }
}

export const STANDARD_PANS = getPanLibrary();

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
  if (normShape === 'rect' || normShape === 'sheet') {
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
  if (normShape === 'rect' || normShape === 'sheet') {
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
  const rawTr = Number(trimPct);
  const tr = (rawTr > 1) ? rawTr / 100 : Math.max(0, rawTr || 0);
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
    trimPct: (() => {
      const raw = r.trimPct !== undefined ? Number(r.trimPct) : (r.trim_pct !== undefined ? Number(r.trim_pct) : 0.08);
      return (raw > 1) ? raw / 100 : Math.max(0, raw || 0);
    })(),
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
  orderHours,
  hourlyRate = 6000,
  perOrderRate = 45000,
  marginPct = 0.50,
  rushPct = 0,
  seasonPct = 0
}) {
  const direct = Math.max(0, Number(directCost) || 0) + Math.max(0, Number(packaging) || 0) + Math.max(0, Number(toppers) || 0);
  const accPct = (Number(accessoriesPct) > 1) ? Number(accessoriesPct) / 100 : Math.max(0, Number(accessoriesPct) || 0);
  const accessories = direct * accPct;

  const effHours = Number(orderHours !== undefined ? orderHours : hours) || 0;
  const effHourlyRate = Math.max(0, Number(hourlyRate) || 0);
  const effPerOrderRate = Math.max(0, Number(perOrderRate) || 0);

  let overhead = 0;
  if (overheadMethod === 'hr') {
    overhead = effHours * effHourlyRate;
  } else if (overheadMethod === 'ord') {
    overhead = effPerOrderRate;
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
    hours: effHours,
    orderHours: effHours,
    hourlyRate: Math.round(effHourlyRate),
    perOrderRate: Math.round(effPerOrderRate),
    totalCost: Math.round(totalCost),
    price: Math.round(price),
    surcharges: Math.round(priceWithSurcharges - price),
    charge
  };
}

/**
/**
 * Sensible default recurring costs with production/admin percentage splits.
 * Floor area is the defensible basis for premises (e.g. 70% kitchen / 30% front).
 * 5000 Raw Materials and 5010 Packaging are strictly excluded to avoid double counting.
 */
export const DEFAULT_RECURRING_COSTS = [
  { id: 'cost-rent', name: 'Rent and occupancy', amount: 350000, productionPct: 70, basis: 'Floor area (70% kitchen / 30% front)' },
  { id: 'cost-power', name: 'Electricity and gas', amount: 150000, productionPct: 80, basis: 'Ovens, chillers & provers load' },
  { id: 'cost-water', name: 'Water', amount: 25000, productionPct: 100, basis: 'Baking & kitchen sanitization' },
  { id: 'cost-kitchen-wages', name: 'Baker and kitchen wages', amount: 250000, productionPct: 100, basis: 'Direct kitchen baking labor' },
  { id: 'cost-office-wages', name: 'Office and sales wages', amount: 100000, productionPct: 0, basis: 'Admin & sales compensation' },
  { id: 'cost-equip-deprec', name: 'Equipment depreciation', amount: 50000, productionPct: 100, basis: 'Production machines & ovens (5060)' },
  { id: 'cost-office-deprec', name: 'Office and computer depreciation', amount: 15000, productionPct: 0, basis: 'Admin PC & POS tablets (6400)' },
  { id: 'cost-transport', name: 'Transport and logistics', amount: 40000, productionPct: 0, basis: 'Administrative errands & travel' }
];

/**
 * Calculates monthly production overhead from tagged recurring costs.
 * sum(cost.amount * (cost.productionPct / 100)).
 * 5000 Raw Materials and 5010 Packaging never enter it: the order calculator already costs those per order.
 * @param {Array<object>} [recurringCosts=DEFAULT_RECURRING_COSTS]
 * @returns {number}
 */
export function calculateProductionOverhead(recurringCosts = DEFAULT_RECURRING_COSTS) {
  if (!Array.isArray(recurringCosts) || recurringCosts.length === 0) {
    return 690000;
  }
  return recurringCosts.reduce((total, cost) => {
    // Strictly exclude raw materials and packaging to prevent double counting
    const name = String(cost.name || '').toLowerCase();
    if (name.includes('raw material') || name.includes('packaging') || cost.accountCode === '5000' || cost.accountCode === '5010') {
      return total;
    }
    const amt = Math.max(0, Number(cost.amount) || 0);
    const pct = Math.max(0, Math.min(100, Number(cost.productionPct ?? 100)));
    return total + (amt * (pct / 100));
  }, 0);
}

/**
 * Derive hourly rate and per-order rate from shop overhead settings.
 * Accepts either (monthlyOverhead, annualProductionHours, ordersPerMonth)
 * or a single settings object { monthlyOverhead, annualProductionHours, ordersPerMonth, recurringCosts }.
 * 
 * Formula:
 *   hourlyRate = (productionTaggedMonthlyCosts × 12) ÷ annualProductionHours
 *   perOrderRate = productionTaggedMonthlyCosts ÷ ordersPerMonth
 * 
 * @param {number|object|Array} monthlyOverhead - Total monthly overhead (₦), settings object, or recurringCosts array
 * @param {number} [annualProductionHours=1800] - Annual production hours
 * @param {number} [ordersPerMonth=20] - Expected orders per month
 * @returns {{monthlyProductionOverhead: number, hourlyRate: number, perOrderRate: number}}
 */
export function deriveOverheadRates(monthlyOverhead, annualProductionHours = 1800, ordersPerMonth = 20) {
  let mo = 0;
  let annHrs = 1800;
  let ordCount = 20;

  if (typeof monthlyOverhead === 'object' && monthlyOverhead !== null) {
    if (Array.isArray(monthlyOverhead.recurringCosts)) {
      mo = calculateProductionOverhead(monthlyOverhead.recurringCosts);
    } else if (monthlyOverhead.monthlyOverhead !== undefined || monthlyOverhead.monthly_overhead !== undefined) {
      mo = Number(monthlyOverhead.monthlyOverhead ?? monthlyOverhead.monthly_overhead);
    } else {
      mo = calculateProductionOverhead(DEFAULT_RECURRING_COSTS);
    }
    annHrs = Math.max(1, Number(monthlyOverhead.annualProductionHours ?? monthlyOverhead.annual_production_hours) || 1800);
    ordCount = Math.max(1, Number(monthlyOverhead.ordersPerMonth ?? monthlyOverhead.orders_per_month) || 20);
  } else if (Array.isArray(monthlyOverhead)) {
    mo = calculateProductionOverhead(monthlyOverhead);
    annHrs = Math.max(1, Number(annualProductionHours) || 1800);
    ordCount = Math.max(1, Number(ordersPerMonth) || 20);
  } else {
    mo = Number(monthlyOverhead);
    annHrs = Math.max(1, Number(annualProductionHours) || 1800);
    ordCount = Math.max(1, Number(ordersPerMonth) || 20);
  }

  if (isNaN(mo) || mo <= 0) {
    mo = 690000;
  }

  const hourlyRate = (mo * 12) / annHrs;
  const perOrderRate = mo / ordCount;
  return {
    monthlyProductionOverhead: Math.round(mo),
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

/**
 * Resolve all decorations on an order (weighed, bought piece, made piece).
 * Centralized for reuse across ProductionSheet and Inventory Committed calculations.
 */
export function resolveOrderDecorations(order, recipes = [], inventory = []) {
  if (!order) return [];
  const result = [];
  const seen = new Set();

  const processDecItem = (key, count) => {
    const qty = Number(count) || 0;
    if (qty <= 0) return;

    let recipeMatch = (recipes || []).find(r => 
      r.id === key || 
      `r_${r.id}` === key || 
      r.name?.toLowerCase() === String(key).toLowerCase() ||
      String(key).toLowerCase().includes(r.name?.toLowerCase())
    );

    let decorObj = null;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = JSON.parse(localStorage.getItem('ll_decorations') || '[]');
        decorObj = stored.find(d => d.id === key || d.label === key || d.name === key);
        if (!recipeMatch && decorObj?.recipeId) {
          recipeMatch = (recipes || []).find(r => r.id === decorObj.recipeId);
        }
      }
    } catch {
      // Ignore localStorage read errors in non-browser/restricted environments
    }

    const isMadePiece = recipeMatch && (
      recipeMatch.type === 'pastry' || 
      recipeMatch.recipe_type === 'pastry' || 
      recipeMatch.type === 'made_piece' || 
      recipeMatch.recipe_type === 'made_piece' ||
      recipeMatch.batchSize || 
      recipeMatch.perBatch || 
      recipeMatch.per_batch ||
      recipeMatch.breakagePct || 
      recipeMatch.breakage_pct
    );

    if (isMadePiece) {
      const name = recipeMatch.name;
      const dedupeKey = `made_${recipeMatch.id || name}`;
      const breakagePct = Number(recipeMatch.breakagePct ?? recipeMatch.breakage_pct ?? 10) || 10;
      const piecesToMake = Math.ceil(qty * (1 + (breakagePct / 100)));
      const baseYieldPieces = Number(recipeMatch.batchSize || recipeMatch.perBatch || recipeMatch.per_batch || 12) || 12;
      const batchScale = piecesToMake / baseYieldPieces;

      if (seen.has(dedupeKey)) {
        const existing = result.find(r => r.dedupeKey === dedupeKey);
        if (existing) {
          existing.qtyNeeded += qty;
          existing.piecesToMake = Math.ceil(existing.qtyNeeded * (1 + (breakagePct / 100)));
          existing.batchScale = existing.piecesToMake / baseYieldPieces;
        }
      } else {
        seen.add(dedupeKey);
        result.push({
          dedupeKey,
          kind: 'made_piece',
          name,
          recipeId: recipeMatch.id,
          recipe: recipeMatch,
          qtyNeeded: qty,
          breakagePct,
          piecesToMake,
          baseYieldPieces,
          batchScale,
          isWaferPaper: name.toLowerCase().includes('wafer')
        });
      }
      return;
    }

    // Weighed or bought_piece
    let invItem = (inventory || []).find(i => i.id === key || `d_${i.id}` === key || i.name?.toLowerCase() === String(key).toLowerCase());
    if (!invItem && decorObj?.iid) {
      invItem = (inventory || []).find(i => i.id === decorObj.iid);
    }
    const name = decorObj?.label || decorObj?.name || invItem?.name || key;
    const unit = (invItem?.unit || decorObj?.unit || 'pcs').toLowerCase();
    const isWeighed = unit === 'g' || unit === 'kg';

    result.push({
      dedupeKey: `item_${name}`,
      kind: isWeighed ? 'weighed' : 'bought_piece',
      name,
      invItem,
      unit,
      qtyNeeded: qty
    });
  };

  (order.items || []).forEach(it => {
    if (it.decQty && typeof it.decQty === 'object') {
      Object.entries(it.decQty).forEach(([k, v]) => processDecItem(k, v));
    }
    if (Array.isArray(it.decorations)) {
      it.decorations.forEach(d => {
        if (typeof d === 'object') {
          processDecItem(d.id || d.recipeId || d.name, d.qty || d.count || d.grams || 1);
        } else if (typeof d === 'string') {
          processDecItem(d, 1);
        }
      });
    }
  });

  if (order.decQty && typeof order.decQty === 'object') {
    Object.entries(order.decQty).forEach(([k, v]) => processDecItem(k, v));
  }
  if (Array.isArray(order.decorations)) {
    order.decorations.forEach(d => {
      if (typeof d === 'object') {
        processDecItem(d.id || d.recipeId || d.name, d.qty || d.count || d.grams || 1);
      } else if (typeof d === 'string') {
        processDecItem(d, 1);
      }
    });
  }

  return result;
}

/**
 * Calculate the exact ingredient requirements of an order as read from its production sheet.
 * Returns a Map of inventoryItemId -> committedQuantity (expressed in the inventory item's unit).
 */
export function calculateOrderCommitments(order, inventory = [], recipes = []) {
  const itemMap = new Map();
  if (!order) return itemMap;

  const addCommitment = (itemIdOrName, qtyNeeded, defaultUnit = 'g') => {
    if (!qtyNeeded || isNaN(qtyNeeded) || qtyNeeded <= 0) return;
    let invItem = (inventory || []).find(i => i.id === itemIdOrName || i.name?.toLowerCase() === String(itemIdOrName).toLowerCase());
    if (!invItem) return;
    const itemUnit = (invItem.unit || defaultUnit || 'g').toLowerCase().trim();
    const sourceUnit = String(defaultUnit || 'g').toLowerCase().trim();

    let convertedQty = Number(qtyNeeded);
    if ((itemUnit === 'kg' || itemUnit === 'l') && (sourceUnit === 'g' || sourceUnit === 'ml')) {
      convertedQty = convertedQty / 1000;
    } else if ((itemUnit === 'g' || itemUnit === 'ml') && (sourceUnit === 'kg' || sourceUnit === 'l')) {
      convertedQty = convertedQty * 1000;
    }

    const current = itemMap.get(invItem.id) || 0;
    itemMap.set(invItem.id, current + convertedQty);
  };

  // 1. Made and Bought Decorations
  const resolvedDecorations = resolveOrderDecorations(order, recipes, inventory);
  resolvedDecorations.forEach(dec => {
    if (dec.kind === 'made_piece') {
      const rec = dec.recipe;
      const rawIngs = rec.ingredients || rec.ing || [];
      const batchScale = dec.batchScale;
      rawIngs.forEach(ing => {
        const perBatchQty = Number(ing.quantity !== undefined ? ing.quantity : ing.qty) || 0;
        const scaledQty = perBatchQty * batchScale;
        addCommitment(ing.inventoryItemId || ing.iid || ing.id || ing.name, scaledQty, ing.unit || 'g');
      });
    } else {
      addCommitment(dec.name, dec.qtyNeeded, dec.unit || 'pcs');
    }
  });

  // 2. Cake Tiers & Portions Items
  const items = order.items || (order.tiers ? [order] : []);
  items.forEach(item => {
    // Cake Tiers
    if (item.tiers && Array.isArray(item.tiers)) {
      item.tiers.forEach(tier => {
        const shape = (tier.shape || 'round').toLowerCase();
        const a = Number(tier.dimensionA || tier.size || tier.dimA) || 8;
        const b = Number(tier.dimensionB || tier.width || tier.dimB) || (shape === 'rect' ? 8 : a);
        const H = Number(tier.height || tier.cakeHeight) || 4;
        const pa = planArea(shape, a, b);
        const pe = perimeter(shape, a, b);

        const flavourRows = tier.flavourRows || (Array.isArray(tier.layers) ? tier.layers.map(l => ({
          recipeId: l.recipeId || (recipes || []).find(r => r.name.toLowerCase() === (l.flavour || '').trim().toLowerCase())?.id,
          flavour: l.flavour,
          layers: Number(l.qty) || Number(l.layers) || 1
        })) : (tier.recipeId ? [{ recipeId: tier.recipeId, layers: tier.layers || 2 }] : []));

        const totalLayers = flavourRows.reduce((s, f) => s + (Number(f.layers) || 0), 0) || 1;
        const layerThickness = H / totalLayers;

        // Sponge layers
        flavourRows.forEach(row => {
          const recipe = (recipes || []).find(r => r.id === row.recipeId) ||
                         (recipes || []).find(r => r.name.toLowerCase() === (row.flavour || '').trim().toLowerCase());
          if (!recipe) return;
          const density = Number(recipe.density || recipe.cal_density) || (recipe.cal_grams ? calculateDensity(recipe.cal_grams, recipe.cal_shape || shape, recipe.cal_dim_a || a, recipe.cal_dim_b || b, recipe.cal_height_in || 2) : 10.911);
          const trimPct = recipe.trimPct !== undefined ? Number(recipe.trimPct) : (recipe.trim_pct !== undefined ? Number(recipe.trim_pct) : 0.08);
          const gPerPan = gramsPerPan(density, pa, layerThickness, trimPct);
          const count = Number(row.layers) || 1;
          const totalGrams = gPerPan * count;

          const rawIngs = recipe.ingredients || recipe.ing || [];
          const baseYield = Number(recipe.batch_yield_g) || Number(recipe.yield_grams) || Number(recipe.batchWeight) || (rawIngs.reduce((s, it) => s + (Number(it.qty !== undefined ? it.qty : it.quantity) || 0), 0)) || Number(recipe.cal_grams) || 1000;
          const scaled = scaleRecipeIngredients(rawIngs, totalGrams, baseYield);
          scaled.forEach(ing => {
            addCommitment(ing.inventoryItemId || ing.iid || ing.id || ing.name, ing.quantity, ing.unit || 'g');
          });
        });

        // Fillings
        const tierGap = gapArea(pa, totalLayers);
        const fillingsList = item.fillings && item.fillings.length > 0 ? item.fillings : (tier.fillings || []);
        if (fillingsList && Array.isArray(fillingsList) && tierGap > 0) {
          const gapShare = tierGap / fillingsList.length;
          fillingsList.forEach(f => {
            const fType = f.type || f.recipeId;
            const covRecipe = (recipes || []).find(r => r.id === f.recipeId || r.name.toLowerCase() === (fType || '').trim().toLowerCase());
            if (covRecipe) {
              const mm = Number(f.thicknessMm || covRecipe.thickFillMm || covRecipe.thickness_fill) || 4.5;
              const den = Number(covRecipe.densityGPerCm3 || covRecipe.density) || 0.90;
              const was = Number(covRecipe.wastePct || covRecipe.waste_pct) || 0.15;
              const mass = coveringMass(gapShare, mm, den, was);
              const rawIngs = covRecipe.ingredients || covRecipe.ing || [];
              const baseYield = Number(covRecipe.batch_yield_g) || Number(covRecipe.yield_grams) || (rawIngs.reduce((s, it) => s + (Number(it.qty !== undefined ? it.qty : it.quantity) || 0), 0)) || 1000;
              const scaled = scaleRecipeIngredients(rawIngs, mass, baseYield);
              scaled.forEach(ing => {
                addCommitment(ing.inventoryItemId || ing.iid || ing.id || ing.name, ing.quantity, ing.unit || 'g');
              });
            }
          });
        }

        // Crumb coat
        const crumbType = item.crumb !== undefined ? item.crumb : (item.crumbCoatId || tier.crumb || "");
        if (crumbType && crumbType !== "None") {
          const crumbRecipe = (recipes || []).find(r => r.id === crumbType || r.name.toLowerCase() === (crumbType || '').trim().toLowerCase());
          if (crumbRecipe) {
            const tierSurf = surfaceArea(pa, pe, H);
            const mm = Number(crumbRecipe.thickCrumbMm || crumbRecipe.thickness_crumb) || 1.0;
            const den = Number(crumbRecipe.densityGPerCm3 || crumbRecipe.density) || 0.90;
            const was = Number(crumbRecipe.wastePct || crumbRecipe.waste_pct) || 0.10;
            const mass = coveringMass(tierSurf, mm, den, was);
            const rawIngs = crumbRecipe.ingredients || crumbRecipe.ing || [];
            const baseYield = Number(crumbRecipe.batch_yield_g) || Number(crumbRecipe.yield_grams) || (rawIngs.reduce((s, it) => s + (Number(it.qty !== undefined ? it.qty : it.quantity) || 0), 0)) || 1000;
            const scaled = scaleRecipeIngredients(rawIngs, mass, baseYield);
            scaled.forEach(ing => {
              addCommitment(ing.inventoryItemId || ing.iid || ing.id || ing.name, ing.quantity, ing.unit || 'g');
            });
          }
        }

        // Outside finish
        const finType = item.finish !== undefined ? item.finish : (item.finishId || tier.finish || (tier.coverings?.[0]?.type) || "");
        if (finType && finType !== "None") {
          const finRecipe = (recipes || []).find(r => r.id === finType || r.name.toLowerCase() === (finType || '').trim().toLowerCase());
          if (finRecipe) {
            const tierSurf = surfaceArea(pa, pe, H);
            const mm = Number(finRecipe.thickFinishMm || finRecipe.thickness_finish) || 4.9;
            const den = Number(finRecipe.densityGPerCm3 || finRecipe.density) || 1.10;
            const was = Number(finRecipe.wastePct || finRecipe.waste_pct) || 0.15;
            const mass = coveringMass(tierSurf, mm, den, was);
            const rawIngs = finRecipe.ingredients || finRecipe.ing || [];
            const baseYield = Number(finRecipe.batch_yield_g) || Number(finRecipe.yield_grams) || (rawIngs.reduce((s, it) => s + (Number(it.qty !== undefined ? it.qty : it.quantity) || 0), 0)) || 1000;
            const scaled = scaleRecipeIngredients(rawIngs, mass, baseYield);
            scaled.forEach(ing => {
              addCommitment(ing.inventoryItemId || ing.iid || ing.id || ing.name, ing.quantity, ing.unit || 'g');
            });
          }
        }
      });
    }

    // Portions items (Slabs or Counted pieces)
    if (item.type === 'portions' || item.portions) {
      const p = item.portions || item;
      if (p.route === 'slab' || (!p.route && (p.layers || p.flavourRows))) {
        const pan = DEFAULT_PAN_LIBRARY[p.panIndex || 0] || DEFAULT_PAN_LIBRARY[1];
        const trayW = p.trayW || pan.width;
        const trayL = p.trayL || pan.length;
        const sliceW = Number(p.sliceWidth || p.w) || 2;
        const sliceL = Number(p.sliceLength || p.l) || 2;
        const sliceH = Number(p.sliceHeight || p.h) || 4;
        const allowance = Number(p.allowancePct) || 5;
        const servings = Number(p.servings || p.needed) || 100;
        const geom = calculatePortionsGeometry({
          servings,
          sliceWidth: sliceW,
          sliceLength: sliceL,
          sliceHeight: sliceH,
          allowancePct: allowance,
          trayW,
          trayL,
          pan,
          layers: p.layers,
          flavourRows: p.flavourRows
        });

        const pRows = p.flavourRows || (p.layers || []).map(l => ({
          recipeId: l.recipeId || (recipes || []).find(r => r.name.toLowerCase() === (l.flavour || '').trim().toLowerCase())?.id,
          flavour: l.flavour,
          layers: Number(l.qty) || 1
        }));

        pRows.forEach(row => {
          const recipe = (recipes || []).find(r => r.id === row.recipeId) ||
                         (recipes || []).find(r => r.name.toLowerCase() === (row.flavour || '').trim().toLowerCase());
          if (!recipe) return;
          const density = Number(recipe.density || recipe.cal_density) || 10.911;
          const trimPct = recipe.trimPct !== undefined ? Number(recipe.trimPct) : 0.08;
          const gPerPan = gramsPerPan(density, geom.panArea, geom.layerThickness, trimPct);
          const totalGrams = gPerPan * (Number(row.layers) || 1) * geom.slabs;
          const rawIngs = recipe.ingredients || recipe.ing || [];
          const baseYield = Number(recipe.batch_yield_g) || Number(recipe.yield_grams) || 1000;
          const scaled = scaleRecipeIngredients(rawIngs, totalGrams, baseYield);
          scaled.forEach(ing => {
            addCommitment(ing.inventoryItemId || ing.iid || ing.id || ing.name, ing.quantity, ing.unit || 'g');
          });
        });

        if (p.fillingRecipe && geom.gapArea > 0) {
          const fRecipe = (recipes || []).find(r => r.name.toLowerCase() === p.fillingRecipe.toLowerCase() || r.id === p.fillingRecipe);
          if (fRecipe) {
            const mm = Number(fRecipe.thickness_fill || fRecipe.thickFillMm) || 4.5;
            const den = Number(fRecipe.density || fRecipe.densityGPerCm3) || 0.90;
            const was = Number(fRecipe.waste_pct || fRecipe.wastePct) || 0.15;
            const mass = coveringMass(geom.gapArea, mm, den, was);
            const rawIngs = fRecipe.ingredients || fRecipe.ing || [];
            const baseYield = Number(fRecipe.batch_yield_g) || Number(fRecipe.yield_grams) || 1000;
            const scaled = scaleRecipeIngredients(rawIngs, mass, baseYield);
            scaled.forEach(ing => {
              addCommitment(ing.inventoryItemId || ing.iid || ing.id || ing.name, ing.quantity, ing.unit || 'g');
            });
          }
        }
      } else if (p.route === 'count') {
        const rec = (recipes || []).find(r => r.id === p.countedRecipeId || r.name?.toLowerCase() === (p.countedRecipeId || '').toLowerCase());
        if (rec) {
          const servings = Number(p.countedServings || p.servings) || 40;
          const batchSize = Number(rec.batchSize || rec.perBatch || rec.per_batch) || 12;
          const breakage = (Number(rec.breakagePct ?? rec.breakage_pct) || 0) / 100;
          const batches = (servings / Math.max(1, batchSize)) * (1 + breakage);
          const rawIngs = rec.ingredients || rec.ing || [];
          rawIngs.forEach(ing => {
            const perBatchQty = Number(ing.qty !== undefined ? ing.qty : ing.quantity) || 0;
            addCommitment(ing.iid || ing.id || ing.inventoryId || ing.name, perBatchQty * batches, ing.unit || 'g');
          });
        }
      }
    }
  });

  return itemMap;
}

/**
 * Calculates total committed stock across all confirmed, undelivered orders.
 * Returns a Map of inventoryItemId -> totalCommittedQty in inventory item's unit.
 */
export function calculateCommittedStock(orders = [], inventory = [], recipes = []) {
  const committedMap = new Map();
  const safeOrders = Array.isArray(orders) ? orders : [];

  const confirmedUndeliveredOrders = safeOrders.filter(o => {
    if (!o) return false;
    const status = String(o.status || '').toLowerCase().trim();
    if (status === 'delivered' || status === 'cancelled') return false;
    return status === 'confirmed' || status === 'ready' || status === 'pending' || Boolean(o.isProd) || Boolean(o.confirmedAt);
  });

  confirmedUndeliveredOrders.forEach(order => {
    const orderCommitments = calculateOrderCommitments(order, inventory, recipes);
    orderCommitments.forEach((qty, itemId) => {
      const current = committedMap.get(itemId) || 0;
      committedMap.set(itemId, parseFloat((current + qty).toFixed(3)));
    });
  });

  return committedMap;
}

