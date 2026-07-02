# LayerLedger — Architecture & Roadmap

This document explains how the app is built today and the plan for the backend
migration. It is written for a software engineer picking up the project.

---

## 1. Current architecture (Stage 1 — "local-first")

```
   Browser (one device)
   ┌─────────────────────────────────────────────┐
   │  React app (App.jsx)                          │
   │    ├── screens (Dashboard, Calculator, ...)   │
   │    └── lib/data.js  ──►  localStorage         │  ← all data lives here
   └───────────────┬───────────────────────────────┘
                   │  (only for AI features)
                   ▼
   Cloudflare Function / Worker  ──►  Anthropic API
   (holds the API key; proxies requests)
```

- The entire UI is a React SPA served as static files by Cloudflare Pages.
- **There is no application server and no database.** Every piece of data
  (inventory, recipes, orders, quotes, expenses, transactions, company
  settings, users) is stored as JSON strings in the browser's `localStorage`.
- `src/lib/data.js` is the single layer that reads/writes those keys. Treat it
  as the "data access layer" — when we add a real backend, this is the file
  whose functions get reimplemented to call an API instead of localStorage.

### localStorage keys (the current "tables")

| Key                     | Holds                                  |
|-------------------------|----------------------------------------|
| `ll_inv`                | inventory items                        |
| `ll_recipes`            | recipes                                |
| `ll_prods`              | productions / confirmed orders         |
| `ll_quotes`             | quotes (orders before confirmation)    |
| `ll_txns`               | bank transactions                      |
| `ll_exp`                | expenses                               |
| `ll_purchases`          | ingredient purchases                   |
| `ll_payables`           | credit purchases / accounts payable    |
| `ll_ap_payments`        | payments made against payables         |
| `ll_opening_balance`    | balance-sheet opening figures          |
| `ll_co`                 | company profile & settings             |
| `ll_users`              | users + PINs                           |
| `ll_clients`            | client directory                       |
| `ll_quote_invoices`     | generated invoices                     |
| `ll_multipliers`        | size/shape cost multipliers            |
| `ll_setting_*`          | individual settings (profit %, etc.)   |

### Consequences of local-first
- **No cross-device access** — data is tied to one browser on one device.
- Backup/restore is manual (Settings → Backup & Data exports/imports a JSON
  file). This is the current stand-in for sync.
- Good enough for a single operator; **not** suitable for multiple testers or
  giving an accountant live access — which is what motivates Stage 2.

---

## 2. Planned architecture (Stage 2 — backend + database)

Goal: log in from any device and see the same data, with a real database.

```
   Browsers (any device)
        │   login (email + password)
        ▼
   Backend API  ◄──────────────►  Database
   (Node/Workers)                 (Cloudflare D1 or Supabase)
```

Recommended options:
- **Cloudflare D1** — SQLite-based DB that lives next to the app on Cloudflare;
  simplest given current hosting, lowest cost.
- **Supabase** — hosted Postgres that also ships with authentication and
  cross-device sync out of the box; better fit if login is the priority.

### Migration approach (low-risk, incremental)
1. Stand up the database with tables mirroring the localStorage keys above.
2. Add authentication (login / users).
3. Reimplement `src/lib/data.js` functions to call the backend API instead of
   localStorage — **the rest of the app barely changes**, because every screen
   already goes through `data.js`. This is the single biggest reason to keep
   that data-access layer clean.
4. Write a one-time importer that reads a user's exported backup JSON and loads
   it into the database, so existing data is preserved.

---

## 3. Refactor of `App.jsx` — DONE ✅

`App.jsx` has been split from one ~5,400-line file into the structure below.
App.jsx now contains only the root component (state, login, navigation, routing):

```
src/
  components/
    common/        # Btn, Inp, Sel, Card, Badge, Tabs, Modal, ...
    dashboard/
    inventory/     # MasterList, Inventory, Recipes, Decorations, Packaging
    orders/        # OrderCalculator, QuotesPage, ProductionList, Invoices
    money/         # ReceiptScanner, BankImport, Expenses, Purchases, Payables
    reports/       # Reports, PandL, BalanceSheet, CashFlow, MonthlyOverview
    settings/      # Settings, PricingSetup, NotificationSettings, Onboarding
  lib/
    storage.js     # (today: data.js) the data access layer
    costing.js     # recipe/cake costing helpers
    ai.js          # callClaude + image compression
  constants.js     # seed data & option lists (already extracted)
```

This refactor is purely organisational — no behaviour changes — and should be
done with the working version safely committed first, so it can be rolled back
if a wiring error slips in.
