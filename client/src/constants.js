/**
 * constants.js
 * ----------------------------------------------------------------------------
 * Seed/reference data and fixed configuration values for LayerLedger.
 *
 * These are the DEFAULT values the app ships with. Once the user edits their
 * inventory, recipes, etc. in the app, their changes are saved to the browser
 * (see lib/storage.js) and these defaults are only used on very first run.
 *
 * NOTE ON THE DATABASE:
 *   LayerLedger currently has NO server-side database. All live data is stored
 *   in the browser's localStorage (a small key/value store built into every
 *   web browser, unique to each device + browser). The constants below are the
 *   initial seed values used to populate that store the first time the app runs
 *   on a new device. Moving to a real database (e.g. Cloudflare D1 or Supabase)
 *   is planned as a separate "Stage 2" backend project.
 * ----------------------------------------------------------------------------
 */

// ─── Default ingredient inventory ──────────────────────────────────────────
// Each item: id, name, cat(egory), unit, cost (₦ per unit), stock (on hand),
// minStock (low-stock alert threshold). Real Fayvouree data.
export const DEFAULT_INV = [
  { id: "i1",  name: "Flour",                     cat: "Dry Goods",   unit: "kg",     cost: 1140,  stock: 50,   minStock: 10 },
  { id: "i2",  name: "Sugar",                     cat: "Dry Goods",   unit: "kg",     cost: 1500,  stock: 50,   minStock: 10 },
  { id: "i3",  name: "Oil",                       cat: "Fats & Oils", unit: "L",      cost: 3000,  stock: 25,   minStock: 5 },
  { id: "i4",  name: "Butter (Butler)",           cat: "Fats & Oils", unit: "kg",     cost: 17500, stock: 8,    minStock: 2 },
  { id: "i5",  name: "Margarine (Valido)",        cat: "Fats & Oils", unit: "kg",     cost: 5400,  stock: 10,   minStock: 2 },
  { id: "i6",  name: "Margarine (Romi)",          cat: "Fats & Oils", unit: "kg",     cost: 6000,  stock: 10,   minStock: 2 },
  { id: "i7",  name: "Eggs",                      cat: "Dairy",       unit: "pcs",    cost: 700,   stock: 120,  minStock: 24 },
  { id: "i8",  name: "Milk (Hollandia)",          cat: "Dairy",       unit: "L",      cost: 3700,  stock: 5,    minStock: 2 },
  { id: "i9",  name: "Milk Lactose",              cat: "Dairy",       unit: "kg",     cost: 6800,  stock: 5,    minStock: 1 },
  { id: "i10", name: "Dry Whipping Cream",        cat: "Dairy",       unit: "kg",     cost: 12000, stock: 2,    minStock: 0.5 },
  { id: "i11", name: "Liquid Whipping Cream",     cat: "Dairy",       unit: "kg",     cost: 9500,  stock: 2,    minStock: 0.5 },
  { id: "i12", name: "Cream Cheese",              cat: "Dairy",       unit: "kg",     cost: 19000, stock: 1,    minStock: 0.5 },
  { id: "i13", name: "Icing Sugar",               cat: "Dry Goods",   unit: "kg",     cost: 2250,  stock: 10,   minStock: 2 },
  { id: "i14", name: "Majesty Icing Sugar",       cat: "Dry Goods",   unit: "kg",     cost: 5400,  stock: 5,    minStock: 1 },
  { id: "i15", name: "Baking Powder",             cat: "Dry Goods",   unit: "kg",     cost: 12222, stock: 0.45, minStock: 0.1 },
  { id: "i16", name: "Baking Soda",               cat: "Dry Goods",   unit: "kg",     cost: 5000,  stock: 0.6,  minStock: 0.1 },
  { id: "i17", name: "CMC",                       cat: "Dry Goods",   unit: "kg",     cost: 15000, stock: 0.4,  minStock: 0.1 },
  { id: "i18", name: "Glucose",                   cat: "Dry Goods",   unit: "kg",     cost: 3000,  stock: 2,    minStock: 0.5 },
  { id: "i19", name: "Salt",                      cat: "Dry Goods",   unit: "kg",     cost: 600,   stock: 2,    minStock: 0.5 },
  { id: "i20", name: "Cocoa Powder",              cat: "Dry Goods",   unit: "kg",     cost: 25000, stock: 1,    minStock: 0.2 },
  { id: "i21", name: "Dark Chocolate (Colatta)",  cat: "Chocolate",   unit: "kg",     cost: 12000, stock: 2,    minStock: 0.5 },
  { id: "i22", name: "White Chocolate (Colatta)", cat: "Chocolate",   unit: "kg",     cost: 12000, stock: 1,    minStock: 0.5 },
  { id: "i23", name: "Red Velvet Powder Color",   cat: "Colorings",   unit: "kg",     cost: 10000, stock: 0.4,  minStock: 0.1 },
  { id: "i24", name: "Red Food Color (Foster)",   cat: "Colorings",   unit: "ml",     cost: 25,    stock: 28,   minStock: 5 },
  { id: "i25", name: "Gel Colors",                cat: "Colorings",   unit: "set",    cost: 5000,  stock: 2,    minStock: 1 },
  { id: "i26", name: "Flavour",                   cat: "Flavoring",   unit: "bottle", cost: 3000,  stock: 5,    minStock: 2 },
  { id: "i27", name: "Mixed Fruit",               cat: "Fruits",      unit: "kg",     cost: 4500,  stock: 5,    minStock: 1 },
  { id: "i28", name: "Carrot",                    cat: "Fruits",      unit: "kg",     cost: 2000,  stock: 2,    minStock: 0.5 },
  { id: "i29", name: "Red Cherry",                cat: "Fruits",      unit: "kg",     cost: 18000, stock: 1,    minStock: 0.2 },
  { id: "i30", name: "Oreo Cookies",              cat: "Decoration",  unit: "pack",   cost: 18000, stock: 2,    minStock: 1 },
  { id: "i31", name: "Flowers",                   cat: "Decoration",  unit: "pcs",    cost: 2000,  stock: 20,   minStock: 5 },
  { id: "i32", name: "Toppers",                   cat: "Decoration",  unit: "pcs",    cost: 2000,  stock: 15,   minStock: 5 },
  { id: "i33", name: "Ribbons",                   cat: "Decoration",  unit: "pack",   cost: 1500,  stock: 10,   minStock: 3 },
  { id: "i34", name: "Wafer Paper",               cat: "Decoration",  unit: "pack",   cost: 3000,  stock: 5,    minStock: 2 },
  { id: "i35", name: "Sprinkles / Shimmer",       cat: "Decoration",  unit: "pack",   cost: 2500,  stock: 5,    minStock: 2 },
  { id: "i36", name: 'Cake Board 8"',             cat: "Packaging",   unit: "pcs",    cost: 450,   stock: 20,   minStock: 5 },
  { id: "i37", name: 'Cake Board 10"',            cat: "Packaging",   unit: "pcs",    cost: 550,   stock: 15,   minStock: 5 },
  { id: "i38", name: 'Cake Board 12"',            cat: "Packaging",   unit: "pcs",    cost: 650,   stock: 10,   minStock: 3 },
  { id: "i39", name: 'Tall Box 8"',               cat: "Packaging",   unit: "pcs",    cost: 480,   stock: 20,   minStock: 5 },
  { id: "i40", name: 'Tall Box 10"',              cat: "Packaging",   unit: "pcs",    cost: 550,   stock: 15,   minStock: 5 },
  { id: "i41", name: 'Tall Box 12"',              cat: "Packaging",   unit: "pcs",    cost: 600,   stock: 10,   minStock: 3 },
  { id: "i42", name: "Cupcake Box x12",           cat: "Packaging",   unit: "pcs",    cost: 450,   stock: 20,   minStock: 5 },
  { id: "i43", name: "Baking Paper",              cat: "Packaging",   unit: "roll",   cost: 8500,  stock: 3,    minStock: 1 },
  { id: "i44", name: "Cling Film",                cat: "Packaging",   unit: "roll",   cost: 2000,  stock: 3,    minStock: 1 },
  { id: "i45", name: "Wrapping Sheet",            cat: "Packaging",   unit: "pack",   cost: 8000,  stock: 2,    minStock: 1 },
]

// ─── Default recipes ────────────────────────────────────────────────────────
// IMPORTANT: quantities are PER SINGLE LAYER. The order calculator multiplies
// by the number of layers and by the size/shape multiplier (see PricingSetup).
// `ing` = list of { iid: inventory item id, qty: amount in that item's unit }.
export const DEFAULT_RECIPES = [
  { id: "r1", name: "Vanilla Cake", notes: "Classic vanilla sponge — quantities for 1 layer",
    ing: [{ iid: "i1", qty: 0.3 }, { iid: "i2", qty: 0.25 }, { iid: "i5", qty: 0.2 }, { iid: "i7", qty: 3 }, { iid: "i8", qty: 0.15 }, { iid: "i11", qty: 0.3 }, { iid: "i15", qty: 0.005 }, { iid: "i26", qty: 0.1 }] },
  { id: "r2", name: "Red Velvet Cake", notes: "Red velvet sponge — quantities for 1 layer",
    ing: [{ iid: "i1", qty: 0.3 }, { iid: "i2", qty: 0.25 }, { iid: "i5", qty: 0.2 }, { iid: "i7", qty: 3 }, { iid: "i3", qty: 0.12 }, { iid: "i16", qty: 0.01 }, { iid: "i23", qty: 0.03 }, { iid: "i24", qty: 3 }, { iid: "i15", qty: 0.005 }] },
  { id: "r3", name: "Chocolate Cake", notes: "Rich chocolate sponge — quantities for 1 layer",
    ing: [{ iid: "i1", qty: 0.28 }, { iid: "i2", qty: 0.25 }, { iid: "i5", qty: 0.2 }, { iid: "i7", qty: 3 }, { iid: "i8", qty: 0.1 }, { iid: "i20", qty: 0.06 }, { iid: "i21", qty: 0.05 }, { iid: "i15", qty: 0.005 }] },
  { id: "r4", name: "Carrot Cake", notes: "Moist carrot cake — quantities for 1 layer",
    ing: [{ iid: "i1", qty: 0.25 }, { iid: "i2", qty: 0.2 }, { iid: "i3", qty: 0.15 }, { iid: "i7", qty: 3 }, { iid: "i28", qty: 0.2 }, { iid: "i15", qty: 0.005 }] },
  { id: "r5", name: "Lemon Cake", notes: "Light lemon sponge — quantities for 1 layer",
    ing: [{ iid: "i1", qty: 0.3 }, { iid: "i2", qty: 0.25 }, { iid: "i4", qty: 0.15 }, { iid: "i7", qty: 3 }, { iid: "i8", qty: 0.1 }, { iid: "i15", qty: 0.005 }] },
  { id: "r6", name: "Fruit Cake", notes: "Rich fruit cake — quantities for 1 layer",
    ing: [{ iid: "i1", qty: 0.25 }, { iid: "i2", qty: 0.2 }, { iid: "i5", qty: 0.18 }, { iid: "i7", qty: 3 }, { iid: "i27", qty: 0.2 }, { iid: "i15", qty: 0.004 }] },
  { id: "r7", name: "Cupcakes (x12)", notes: "Yields 12 cupcakes — do not multiply by layers",
    ing: [{ iid: "i1", qty: 0.2 }, { iid: "i2", qty: 0.15 }, { iid: "i5", qty: 0.15 }, { iid: "i7", qty: 2 }, { iid: "i8", qty: 0.1 }, { iid: "i11", qty: 0.2 }, { iid: "i15", qty: 0.003 }, { iid: "i42", qty: 1 }] },
  { id: "r8", name: "Cake Loaf", notes: "Standard loaf — do not multiply by layers",
    ing: [{ iid: "i1", qty: 0.25 }, { iid: "i2", qty: 0.2 }, { iid: "i5", qty: 0.18 }, { iid: "i7", qty: 3 }, { iid: "i8", qty: 0.15 }, { iid: "i15", qty: 0.004 }] },
]

// ─── Decoration extras ──────────────────────────────────────────────────────
// Optional add-ons selectable per order. Each maps to an inventory item (iid)
// and a quantity consumed (qty) when chosen.
export const DECORATION_ITEMS = [
  { id: "d1",  name: "Chocolate Drip",      iid: "i21", qty: 0.15, label: "Chocolate drip / drizzle" },
  { id: "d2",  name: "White Choc Drip",     iid: "i22", qty: 0.15, label: "White chocolate drip" },
  { id: "d3",  name: "Fresh Flowers",       iid: "i31", qty: 3,    label: "Fresh flowers (3 pcs)" },
  { id: "d4",  name: "Cake Topper",         iid: "i32", qty: 1,    label: "Cake topper (1 pc)" },
  { id: "d5",  name: "Oreo Decoration",     iid: "i30", qty: 0.5,  label: "Oreo cookies decoration" },
  { id: "d6",  name: "Ribbon",              iid: "i33", qty: 1,    label: "Ribbon" },
  { id: "d7",  name: "Wafer Paper Decor",   iid: "i34", qty: 0.5,  label: "Wafer paper decoration" },
  { id: "d8",  name: "Sprinkles / Shimmer", iid: "i35", qty: 1,    label: "Sprinkles / shimmer dust" },
  { id: "d9",  name: "Cherry Topping",      iid: "i29", qty: 0.1,  label: "Cherry topping" },
  { id: "d10", name: "Gel Color Work",      iid: "i25", qty: 0.2,  label: "Gel color painting" },
  { id: "d11", name: "Fondant Figurines",   iid: "i14", qty: 0.3,  label: "Fondant figurines" },
  { id: "d12", name: "Gold/Silver Shimmer", iid: "i35", qty: 0.5,  label: "Gold/silver shimmer" },
]

// Extra ingredients consumed by each covering type (per cake), keyed by name.
export const COVERING_EXTRAS = {
  buttercream: [{ iid: "i11", qty: 0.4 }],
  fondant:     [{ iid: "i14", qty: 0.8 }, { iid: "i17", qty: 0.1 }],
  ganache:     [{ iid: "i21", qty: 0.4 }],
  naked:       [],
}

// Extra ingredients that certain flavours require on top of the base recipe.
export const FLAVOR_EXTRAS = {
  "red velvet": [{ iid: "i23", qty: 0.05 }, { iid: "i24", qty: 5 }],
  chocolate:    [{ iid: "i20", qty: 0.08 }],
  carrot:       [{ iid: "i28", qty: 0.15 }],
  "fruit cake": [{ iid: "i27", qty: 0.2 }],
  lemon:        [],
  vanilla:      [],
  strawberry:   [],
  banana:       [],
  orange:       [],
}

// ─── Fixed option lists ──────────────────────────────────────────────────────
// Expense categories. The ones after "Gifts & Samples" are deliberately kept
// OUT of the Profit & Loss overhead (they are balance-sheet / pass-through
// items) — see components/reports/PandL.jsx for how they are excluded.
export const EXP_CATS = [
  "Ingredients / Supplies", "Packaging", "Delivery", "Decorations", "Equipment",
  "Utilities", "Marketing", "Salary", "Rent", "Maintenance & Repairs",
  "Gifts & Samples", "Client Reimbursable (paid out)", "Pass-through Payment",
  "Loan Repayment", "Bank charges", "Miscellaneous",
]

// How an order was paid / its purpose. "gift" and "sample" produce no revenue.
export const PAYMENT_TYPES = [
  { v: "full",    l: "Full Price" },
  { v: "deposit", l: "Deposit Received" },
  { v: "discount", l: "Discounted" },
  { v: "gift",    l: "Gift" },
  { v: "sample",  l: "Sample/Tasting" },
]

// User roles and what each is allowed to see (enforced in App.jsx navigation).
export const ROLES = {
  owner: "Owner (Full Access)",
  production: "Production (Baker)",
  customer_service: "Customer Service",
}
