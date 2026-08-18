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
 *   in the browser's sessionStorage (a small key/value store built into every
 *   web browser, unique to each device + browser). The constants below are the
 *   initial seed values used to populate that store the first time the app runs
 *   on a new device. Moving to a real database (e.g. Cloudflare D1 or Supabase)
 *   is planned as a separate "Stage 2" backend project.
 * ----------------------------------------------------------------------------
 */

// ─── Default ingredient inventory ──────────────────────────────────────────
// Each item: id, name, cat(egory), unit, cost (₦ per unit), stock (on hand),
// minStock (low-stock alert threshold).

export const DEFAULT_INV = []

export const DEFAULT_RECIPES = []

export const DECORATION_ITEMS = []

export const COVERING_EXTRAS = {
  buttercream: [],
  fondant:     [],
  ganache:     [],
  naked:       [],
}

export const FLAVOR_EXTRAS = {
  "red velvet": [],
  chocolate:    [],
  carrot:       [],
  "fruit cake": [],
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
  "Utilities", "Salary", "Delivery", "Transport", "Advertising", "Equipment", "Rent", "Miscellaneous",
  "Ingredients / Supplies", "Packaging", "Decorations", "Marketing", "Maintenance & Repairs",
  "Gifts & Samples", "Client Reimbursable (paid out)", "Pass-through Payment",
  "Loan Repayment", "Bank charges"
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

// ─── Default Sizing & Pricing Configurations ─────────────────────────────────
export const DEFAULT_MULTS = {
  "4-round": 0.5, "4-square": 0.6, "4-sheet": 0.8,
  "5-round": 0.7, "5-square": 0.85, "5-sheet": 0.9,
  "6-round": 1.0, "6-square": 1.2, "6-sheet": 1.3,
  "7-round": 1.4, "7-square": 1.65, "7-sheet": 1.7,
  "8-round": 1.8, "8-square": 2.15, "8-sheet": 2.2,
  "9-round": 2.3, "9-square": 2.75, "9-sheet": 2.8,
  "10-round": 2.8, "10-square": 3.35, "10-sheet": 3.4,
  "12-round": 4.0, "12-square": 4.8, "12-sheet": 4.9,
  "14-round": 5.5, "14-square": 6.6, "14-sheet": 6.7
}

export const DEFAULT_COVERINGS = [
  { name: "Naked", cost: 0, scales: false },
  { name: "Buttercream", cost: 2500, scales: true },
  { name: "Fondant", cost: 4500, scales: true },
  { name: "Drip", cost: 3000, scales: true },
  { name: "Whipped Cream", cost: 2000, scales: true },
  { name: "Mirror Glaze", cost: 5500, scales: true }
]

export const PRICING_SIZES = ["4", "5", "6", "7", "8", "9", "10", "12", "14"]

