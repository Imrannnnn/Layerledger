/**
 * constants.js
 * ----------------------------------------------------------------------------
 * Seed/reference data and fixed configuration values for BakeWealth.
 *
 * All live tenant data (inventory, recipes, orders, quotes, expenses, clients,
 * and settings) is stored and synchronized directly with the Neon PostgreSQL database.
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

export const DEFAULT_COVERINGS = [
  { name: "Naked", cost: 0, scales: false },
  { name: "Buttercream", cost: 2500, scales: true },
  { name: "Fondant", cost: 4500, scales: true },
  { name: "Drip", cost: 3000, scales: true },
  { name: "Whipped Cream", cost: 2000, scales: true },
  { name: "Mirror Glaze", cost: 5500, scales: true }
]

