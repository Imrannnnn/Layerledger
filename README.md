# LayerLedger

Bakery management and accounting web app for **Fayvouree Luxe Cakes Studio** (Abuja, Nigeria).

It handles the full flow of running a custom-cake business: recipe and ingredient
costing, an order/quote calculator, production tracking, invoicing (with PDF
sharing), receipt scanning, bank-statement import, and a complete accounting
suite (Profit & Loss, Balance Sheet, Cash Flow, Credit Purchases).

---

## Tech stack

- **Frontend:** React 18 (single-page app), built with **Vite**.
- **Hosting:** **Cloudflare Pages** (static frontend) + a small **Cloudflare
  Function / Worker** that proxies AI requests so the API key stays server-side.
- **Data storage:** **browser `localStorage`** — there is currently **no
  server database**. All data lives in the user's browser on each device.
  Accessed through the helpers in [`src/lib/data.js`](src/lib/data.js).
  > A real backend + database (Cloudflare D1 or Supabase) with login and
  > cross-device sync is the planned **Stage 2**. See `ARCHITECTURE.md`.

---

## Project structure

```
.
├── index.html              # HTML shell; React mounts into <div id="root">
├── package.json            # dependencies + scripts (dev / build / preview)
├── vite.config.js          # build config (outputs to /dist)
├── src/
│   ├── main.jsx            # entry point — renders <App/> into the page
│   ├── App.jsx             # the entire app (see header comment inside)
│   ├── constants.js        # seed data & fixed option lists (commented)
│   └── lib/
│       └── data.js         # localStorage read/write helpers ("the database")
└── functions/
    ├── claude.js           # Cloudflare AI proxy (keeps API key server-side)
    ├── api/claude.js       # same, alternate path
    └── _routes.json        # which paths the functions handle
```

> **Note:** `App.jsx` is currently one large file organised into clearly
> labelled sections. Splitting it into per-component files under `src/components/`
> is the next planned refactor — see `ARCHITECTURE.md`.

---

## Running locally

```bash
npm install      # install dependencies
npm run dev      # start the local dev server (hot reload)
npm run build    # produce a production build in /dist
npm run preview  # preview the production build locally
```

## Deployment

Pushing to the `main` branch on GitHub triggers an automatic build and deploy
on Cloudflare Pages.

- **Build command:** `npm run build`
- **Build output directory:** `dist`

The AI features require an `ANTHROPIC_API_KEY` configured as a secret in the
Cloudflare project settings.
