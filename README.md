# BakeWealth — Bakery Financial Operating System

**BakeWealth** (formerly LayerLedger) is an enterprise-grade, multi-tenant financial operating system and bakery management web platform engineered specifically for custom cake studios, artisan bakeries, and pastry businesses.

It integrates recipe costing, real-time ingredient pricing, custom cake quote calculations, production scheduling, multi-template invoicing, AI-assisted receipt OCR scanning, bank statement reconciliation, and complete accrual/cash accounting (Profit & Loss, Balance Sheet, Accounts Payable) into a single, cohesive workflow.

---

## Table of Contents

1. [Platform Overview & Core Philosophy](#platform-overview--core-philosophy)
2. [Technology Stack](#technology-stack)
3. [User Roles & Permissions Matrix](#user-roles--permissions-matrix)
4. [Comprehensive Section & Page Directory](#comprehensive-section--page-directory)
   - [Authentication & Onboarding](#1-authentication--onboarding)
   - [Dashboard & Real-Time KPIs](#2-dashboard--real-time-kpis)
   - [Operations Module](#3-operations-module)
     - [Master List & Recipe Engineering](#master-list--recipe-engineering)
     - [Order & Cake Calculator](#order--cake-calculator)
     - [Clients CRM & Birthday Celebrations](#clients-crm--birthday-celebrations)
     - [AI Receipt Scanner (OCR)](#ai-receipt-scanner-ocr)
     - [Shopping List Checklist](#shopping-list-checklist)
     - [Quotations Engine](#quotations-engine)
     - [Order History & Records](#order-history--records)
     - [Production List & Kitchen Schedule](#production-list--kitchen-schedule)
     - [Professional Invoices (PDF & WhatsApp)](#professional-invoices-pdf--whatsapp)
   - [Accounts Module](#4-accounts-module)
     - [Purchases Ledger](#purchases-ledger)
     - [Credit Purchases (Accounts Payable)](#credit-purchases-accounts-payable)
     - [Operational Expenses](#operational-expenses)
     - [Bank Statement Import & Reconciliation](#bank-statement-import--reconciliation)
   - [Financial Intelligence & Reports Module](#5-financial-intelligence--reports-module)
     - [Monthly Financial Overview](#monthly-financial-overview)
     - [Profit & Loss Statement (P&L)](#profit--loss-statement-pl)
     - [Balance Sheet](#balance-sheet)
   - [Settings & System Administration](#6-settings--system-administration)
     - [Company Profile & Custom Branding](#company-profile--custom-branding)
     - [AI Credits & Subscription Tiers](#ai-credits--subscription-tiers)
     - [Pricing Formulas & Margin Controls](#pricing-formulas--margin-controls)
     - [Opening Stock Setup](#opening-stock-setup)
     - [Notification Preferences](#notification-preferences)
     - [Staff Management & Access Control](#staff-management--access-control)
     - [Cloud Synchronization & Local Backup](#cloud-synchronization--local-backup)
     - [Danger Zone](#danger-zone)
   - [SuperAdmin Portal](#7-superadmin-portal)
5. [End-to-End Business Workflows](#end-to-end-business-workflows)
6. [Data Architecture & Database Schema](#data-architecture--database-schema)
7. [Environment Variables Reference](#environment-variables-reference)
8. [Local Development & Deployment Guide](#local-development--deployment-guide)

---

## Platform Overview & Core Philosophy

Most bakeries struggle with profitability because ingredient prices fluctuate constantly, recipe batch costs are calculated on static spreadsheets, and overheads (labor, electricity, packaging) are guestimated.

**BakeWealth bridges the operational kitchen and the financial ledger:**
1. **Dynamic Cost Updating:** When you scan an ingredient purchase receipt, the new price updates the ingredient in the Master List, which instantly recalculates the raw cost of every recipe containing that ingredient.
2. **True Cake Costing:** The Order Calculator factors in raw cake sponge/batter costs, frosting/covering costs (fondant, ganache, buttercream), dowels, boards, packaging boxes, overhead multipliers, and custom profit margins.
3. **Kitchen & Client Synchronicity:** Approved quotes immediately generate kitchen production work orders and formal PDF invoices for clients.
4. **Resilient Dual Storage:** Fast, responsive client-side UI backed by automated background cloud database persistence (Supabase PostgreSQL via Prisma).

---

## Technology Stack

### Frontend Client
* **Framework:** React 18 SPA (Single Page Application)
* **Build Tool:** Vite (with hot module replacement & production tree-shaking)
* **Design & Styling:** Tailored luxury bakery aesthetic (Playfair Display & DM Sans typography, warm amber/caramel palette `#C8912A`, glassmorphic cards, responsive mobile drawer navigation)
* **Icons:** Lucide React
* **State Management:** Reactive local state with optimistic UI updates and background delta sync
* **PDF & Printing:** Custom CSS print media stylesheets and client-side document generators
* **Checkout:** Paystack Inline Popup JS SDK (v2)

### Backend API
* **Runtime:** Node.js (v20+) with Express
* **Database & ORM:** PostgreSQL (hosted on Supabase) accessed through Prisma ORM
* **Authentication:** JSON Web Tokens (JWT) with HTTP-only tokens, bcrypt password hashing, and case-insensitive email normalization
* **Transactional Email:** Brevo (Sendinblue) REST API v3
* **AI Processing:** Claude Sonnet multimodal OCR vision model for parsing physical paper receipts and structured financial statements
* **Payment Gateway:** Paystack REST API for subscriptions, credit bundles, and automated webhook verification
* **Security & Performance:** Helmet HTTP headers, CORS origin whitelisting, Express Rate Limiter, and Gzip/Brotli compression

---

## User Roles & Permissions Matrix

BakeWealth implements strict Role-Based Access Control (RBAC) to ensure bakers, counter staff, and accountants access only relevant tools:

| Feature / Module | SuperAdmin | Owner | Production / Baker | Customer Service |
| :--- | :---: | :---: | :---: | :---: |
| **SuperAdmin Metrics & Tenants** | ✅ Full Access | ❌ Forbidden | ❌ Forbidden | ❌ Forbidden |
| **Bakery Dashboard** | ❌ (Own Portal) | ✅ Full KPIs | ✅ Operations Only | ✅ Orders Only |
| **Master List & Recipes** | ❌ | ✅ Edit & Cost | ✅ View / Edit Batches | ❌ View Only |
| **Order Calculator** | ❌ | ✅ Full Margins | ✅ Recipe Sizing | ❌ View Quotes Only |
| **Clients CRM** | ❌ | ✅ Full History | ✅ View Details | ✅ Create & Edit |
| **Receipt Scanner** | ❌ | ✅ Scan & Approve | ✅ Scan Receipts | ❌ Forbidden |
| **Quotes & Invoices** | ❌ | ✅ Full Access | ❌ Forbidden | ✅ Create & Share |
| **Kitchen Production List** | ❌ | ✅ Full Schedule | ✅ Update Status | ✅ View Status |
| **Accounts (Purchases, Payables, Expenses)** | ❌ | ✅ Full Access | ❌ Forbidden | ❌ Forbidden |
| **Bank Statement Reconciliation** | ❌ | ✅ Full Access | ❌ Forbidden | ❌ Forbidden |
| **Financial Reports (P&L, Balance Sheet)** | ❌ | ✅ Full Access | ❌ Forbidden | ❌ Forbidden |
| **Subscription & AI Credits** | ✅ Grant/Modify | ✅ Buy & Renew | ❌ Forbidden | ❌ Forbidden |
| **Staff & PIN Management** | ❌ | ✅ Add / Deactivate | ❌ Forbidden | ❌ Forbidden |

---

## Comprehensive Section & Page Directory

### 1. Authentication & Onboarding

#### Account Registration (`/register`)
* User registers with full name, bakery name, business email, and secure password.
* Automatically provisions a dedicated **Tenant Workspace** and seeds essential baseline units (`g`, `kg`, `ml`, `l`, `pcs`, `tbsp`, `tsp`).
* Grants a **Starter Welcome Allowance** of 10 Free AI Scans (20 credits).
* Sends a branded **Account Activation Email** via Brevo containing an unguessable 24-hour cryptographic verification token.

#### Account Activation Flow (`/?activate=<token>`)
* Validates token authenticity against the PostgreSQL database.
* Upon activation, automatically initializes user session and directs them into the Interactive Onboarding wizard.

#### Login & Multi-User Switcher (`/login`)
* Case-insensitive email credential verification.
* Quick **4-Digit Staff PIN Switcher**: In busy kitchen environments, employees can swiftly switch active profiles on shared kitchen tablets without retyping long passwords.

#### 3-Step Interactive Onboarding Wizard (`/onboarding`)
1. **Bakery Brand Setup:** Logo upload, contact information, currency selection (`NGN`, `USD`, `GBP`, `EUR`, `GHS`, `KES`), and invoice accent colors.
2. **Inventory Foundations:** Selects default bakery staples (Flour, Sugar, Butter, Eggs, Fondant, Vanilla Extract) with standard pack sizes and baseline market prices.
3. **Margin & Pricing Targets:** Sets default overhead margin (e.g. 10%) and net target profit percentage (e.g. 40%).

---

### 2. Dashboard & Real-Time KPIs

#### Executive Header
* Real-time network sync indicator (`Data up to date` or `Syncing data...`).
* Subscription trial countdown banner alerting owner before plan expiration.
* Quick Logout and Mobile Navigation Hamburger.

#### Financial Summary Cards
* **Today's Revenue:** Total cash and bank inflows recorded for today.
* **Month-to-Date Sales:** Gross booked orders and invoice settlements.
* **Estimated Gross Margin:** Sales minus raw ingredient costs across all fulfilled batches.
* **Open Accounts Payable:** Outstanding balances owed to ingredient suppliers.

#### Operational Widgets
* **Active Kitchen Orders:** Pending cake orders due today and tomorrow with delivery countdowns.
* **Low Stock Warning Drawer:** Ingredients currently below configured reorder threshold.
* **Quick Action Buttons:** Instant shortcuts to *New Cake Quote*, *Scan Receipt*, *Record Production*, or *Top-Up Scan Credits*.

---

### 3. Operations Module

#### Master List & Recipe Engineering (`/masterlist`)
The centralized core of all bakery ingredient formulas and unit economics.
* **Ingredients Tab:**
  * Defines ingredient name, category (Dry Goods, Dairy, Packaging, Decorating), purchase pack size (e.g., 25 kg bag, 500 ml bottle), and purchase cost.
  * Calculates real-time cost-per-gram or cost-per-milliliter.
  * Configurable minimum reorder levels with visual badge warnings when supplies run low.
  * Bulk delete, search filtering, and inline price edits.
* **Recipes Tab:**
  * Batch recipe creator: lists exact ingredient quantities in grams, milliliters, or units.
  * Shows exact raw material batch cost and calculated cost-per-serving or cost-per-tier.
  * Automatic scaling: scale batch yields up or down with automatic ingredient quantity recalculations.

#### Order & Cake Calculator (`/calculator`)
BakeWealth's signature costing and quoting engine for custom tiered cakes and baked goods.
* **Tier & Portion Sizing:** Selects shape (Round, Square, Hexagon), diameter, height, and tiers. Calculates exact serving portions according to event style (Party servings vs. Wedding portions).
* **Recipe Selection:** Assigns specific sponge/cake batters to each tier.
* **Filling & Covering Modifiers:** Selects frostings (Buttercream, Whipped Cream, White Chocolate Ganache, Rolled Fondant) and automatically calculates covering surface area cost.
* **Accessories & Packaging:** Accounts for cake drums, decorative dowels, structural rods, transparent gift boxes, ribbon trim, and cake toppers.
* **Overhead & Profit Markup:**
  * Applies accessory percentage (e.g., +10%).
  * Adds labor & utility overhead.
  * Applies target profit margin (e.g., 40%) to calculate final recommended retail price.
* **One-Click Export:** Immediately converts calculated figures into a Client Quote or sends directly to the kitchen Production List.

#### Clients CRM & Birthday Celebrations (`/clients`)
Comprehensive customer management tailored for bakery client retention.
* **Client Profiles:** Full name, phone number, email address, physical delivery address, and notes (allergies, flavor preferences).
* **Order History:** Cumulative lifetime spending, invoice history, and outstanding receivables.
* **Birthday & Anniversary Tracker:**
  * Automatically highlights clients with birthdays in the current week and month.
  * Enables proactive sales outreach for annual celebration cakes.

#### AI Receipt Scanner (OCR) (`/receipts`)
Eliminates tedious manual bookkeeping when restocking from supermarkets or local wholesale markets.
* **Camera Capture & File Upload:** Upload image (`JPG`, `PNG`, `HEIC`) or document (`PDF`).
* **Multimodal Vision OCR:** Powered by Claude Sonnet AI; extracts store name, receipt date, transaction total, and individual line items with quantities and prices.
* **Intelligent Item Matcher:** Matches scanned receipt text to existing Master List ingredients using fuzzy search and alias mapping (e.g., "Dangote Sug 50kg" &rarr; "Granulated Sugar").
* **One-Click Master Price Update:** When accepted, updates inventory purchase prices across the system and logs an expense entry in the Purchases ledger.

#### Shopping List Checklist (`/shopping`)
* Aggregates ingredient requirements for all upcoming scheduled production work orders.
* Cross-references needed amounts against current stock quantities on hand.
* Generates an itemized shopping checklist detailing exact deficits needed from the market.
* Print and mobile-friendly layout for market runs.

#### Quotations Engine (`/quotes`)
* Creates itemized quotations for prospective clients.
* Configures deposit requirements (e.g. 50% commitment deposit required before date confirmation).
* **Confirm Order Action:** When client pays, one click converts quote into a confirmed Production Order, deducts required inventory, and logs the invoice.

#### Order History & Records (`/records`)
* Chronological archive of all past orders and customer fulfillment history.
* Filter by date ranges, fulfillment status (Delivered, Picked Up, Cancelled), or customer name.
* Repeat order button: duplications allow instant re-quoting for recurring regular clients.

#### Production List & Kitchen Schedule (`/prodlist`)
* Visual kitchen calendar organizing orders by event date and delivery time.
* Tracks live status stages:
  * 🟡 `Baking`
  * 🔵 `Assembling / Chilling`
  * 🟣 `Decorating`
  * 🟢 `Ready for Pickup / Delivery`
  * ⚫ `Delivered`
* Printable weekly kitchen production sheets for staff.

#### Professional Invoices (PDF & WhatsApp) (`/invoices`)
* Generates clean, professional bakery invoices with custom branding.
* **Design Templates:** Choose between 5 bespoke layouts:
  1. *Classic* (Formal corporate letterhead)
  2. *Modern* (Bold header with contemporary card layout)
  3. *Minimal* (Clean, whitespace-focused layout)
  4. *Elegant* (Editorial serif aesthetic)
  5. *Bold* (High-contrast, vibrant visual impact)
* Embedded bank payment details, terms of service, and custom footer messages.
* Download as high-resolution PDF or send direct WhatsApp share link with pre-formatted message.

---

### 4. Accounts Module

#### Purchases Ledger (`/purchases`)
* Comprehensive record of all bakery ingredient, packaging, and supply purchases.
* Records vendor name, invoice reference, payment mode (Cash, Bank Transfer, Card, or Credit).
* Automatically integrates with Receipt Scanner output and updates inventory valuation.

#### Credit Purchases (Accounts Payable) (`/payables`)
* Tracks ingredient supplies bought on credit from wholesale vendors.
* Shows vendor balance, date incurred, due date, and payment history.
* Record partial and full debt settlements with automatic balance adjustments.

#### Operational Expenses (`/expenses`)
* Tracks non-ingredient operational bakery expenses across standard categories:
  * Rent & Bakery Lease
  * Utilities (Electricity, Water, Cooking Gas)
  * Staff Salaries & Baker Wages
  * Packaging & Delivery Logistics
  * Equipment Maintenance & Repairs
  * Advertising & Marketing
* Visual category spending breakdown and date filters.

#### Bank Statement Import & Reconciliation (`/bank`)
* Upload official bank statements (PDF or CSV).
* AI transaction categorization matches bank deposits against client invoices and bank withdrawals against recorded supplier expenses.
* Discrepancy detector flags unrecognized transactions or missed income.

---

### 5. Financial Intelligence & Reports Module

#### Monthly Financial Overview (`/monthly`)
* Month-by-month financial dashboard comparing:
  * Total Billed Orders vs. Actual Cash Collected
  * Ingredient Purchases & Material Consumption
  * Operating Expenses
  * Net Cash Flow
* Month-over-month growth comparisons with exportable summary tables.

#### Profit & Loss Statement (P&L) (`/pandl`)
* GAAP-aligned accrual and cash Profit & Loss statement:
  * **Gross Sales Revenue**
  * Less: **Cost of Goods Sold (COGS)** (Direct Ingredients + Direct Packaging)
  * Equals: **Gross Operating Profit**
  * Less: **Operating Expenses (OPEX)** (Overhead, Rent, Utilities, Wages)
  * Equals: **Net Profit Before Tax**
* Print and audit-ready format for tax consultants and investors.

#### Balance Sheet (`/balance`)
Complete balance sheet tracking bakery financial health:
* **Assets:**
  * Current Assets (Cash at Bank, Cash in Hand, Accounts Receivable from unpaid invoices, Inventory Valuation of ingredients on shelf)
  * Fixed Assets (Ovens, Mixers, Refrigeration, Studio Fixtures)
* **Liabilities:**
  * Accounts Payable (Vendor Credit Debts)
  * Customer Deposits (Unearned / Deferred Revenue for future cakes)
* **Equity:**
  * Retained Earnings and Owner Capital

---

### 6. Settings & System Administration

Accessible from the `/settings` navigation item:

#### Company Profile & Custom Branding (`tab=company`)
* Bakery business name, tagline, address, telephone, and official email.
* Upload high-resolution bakery logo.
* Custom palette picker: set brand primary color and sidebar background color.
* Set default invoice layout template and standard footer disclaimers.
* AI Connectivity Test button.

#### AI Credits & Subscription Tiers (`tab=tokens`)
* Shows real-time AI scan credit balance and estimated scans remaining.
* **Subscription Plans:**
  * *Starter:* Ideal for home bakers starting out.
  * *Standard:* For active boutique bakeries needing multi-user and frequent scans.
  * *Pro:* High-volume commercial bakeries with unlimited staff seats.
* **Paystack Integration:** Direct in-app purchase of additional Credit Packs (20 credits, 50 credits, 100 credits) or Subscription renewals with instant activation.
* Detailed billing transaction history.

#### Pricing Formulas & Margin Controls (`tab=pricing`)
* Configurable default profit percentages (e.g. 40%).
* Overhead and packaging multiplier percentages.
* Cake diameter-to-serving sizing tables.
* Default frosting & covering cost rates per square centimeter/inch.

#### Opening Stock Setup (`tab=stock`)
* Crucial for first-time bakery onboarding.
* Record existing shelf stock quantities, unit costs, and dates to establish the starting balance sheet inventory valuation without distorting monthly expense numbers.

#### Notification Preferences (`tab=notifications`)
* Enable/disable month-end closing stock reminder banners.
* Configure auto-lock of starting inventory on the 1st of each month.
* Low stock dashboard warning toggle.

#### Staff Management & Access Control (`tab=users`)
* Add bakery staff members with specific roles (`Owner`, `Production`, `Customer Service`).
* Set custom 4-digit quick kitchen PINs.
* Generates automatic Brevo invitation emails delivering temporary passwords and login links.
* One-click activate/deactivate toggles to instantly revoke access when staff depart.

#### Cloud Synchronization & Local Backup (`tab=backup`)
* Displays database connection health with Supabase.
* Full offline JSON backup: download entire bakery workspace database in one click.
* Restore workspace data from JSON backup file.

#### Danger Zone (`tab=danger`)
* **Reset Database:** Wipes orders and transactions while preserving company profile and ingredients.
* **Permanent Account Deletion:** Irrevocably purges the bakery tenant, all users, recipes, orders, and financial history from the cloud database.

---

### 7. SuperAdmin Portal (`/superadmin`)

A dedicated administrative terminal accessible only to platform root administrators:
* High-level platform health metrics: Total Tenants, Active Users, System Revenue.
* Tenant management directory: view all registered bakeries, inspect owner contacts, and review registration timestamps.
* Subscription override: upgrade, extend, or pause tenant subscriptions.
* Manual credit adjustments: credit complimentary AI scan tokens directly to specific bakeries for customer support.

---

## End-to-End Business Workflows

### Workflow 1: Restocking & Real-Time Price Sync
```mermaid
graph TD
    A[Buy Ingredients at Market] --> B[Upload Receipt Image in App]
    B --> C[Claude AI OCR Vision Extraction]
    C --> D[Review Scanned Line Items]
    D --> E[Approve & Match to Master List]
    E --> F[Master Ingredient Costs Auto-Updated]
    F --> G[All Connected Recipe Costs Recalculated]
    E --> H[Purchase Logged in Accounts Ledger]
```

### Workflow 2: Custom Cake Order to Cash Flow
```mermaid
graph TD
    A[Client Requests 3-Tier Custom Cake] --> B[Open Order Calculator]
    B --> C[Select Size, Sponge Batter & Frosting]
    C --> D[Add Accessories & Margin -> Final Price]
    D --> E[Generate & Send Quote PDF via WhatsApp]
    E --> F[Client Pays Deposit]
    F --> G[One-Click Convert to Confirmed Order]
    G --> H[Added to Kitchen Production Schedule]
    G --> I[Required Ingredients Deducted from Stock]
    H --> J[Baker Completes Cake -> Mark Delivered]
    J --> K[Final Invoice Marked Paid -> Revenue in P&L]
```

---

## Data Architecture & Database Schema

BakeWealth utilizes **Prisma ORM** with **PostgreSQL** featuring full multi-tenant isolation via `tenantId`:

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│     Tenant      │──────<│      User       │       │   Transaction   │
└─────────────────┘       └─────────────────┘       └─────────────────┘
         │                         │                         │
         │                         ▼                         │
         ├────────────────< Recipe / MasterList              │
         ├────────────────< InventoryItem                    ▼
         ├────────────────< Client ────────────────< Order / Invoice
         ├────────────────< Expense                          │
         └────────────────< Payment Record                   ▼
                                                      ProductionEntry
```

* **Tenant:** Workspace container isolating company data, subscription plan, token balances, and company branding settings.
* **User:** Multi-user staff records with hashed passwords, roles (`owner`, `production`, `customer_service`, `superadmin`), and quick PINs.
* **InventoryItem:** Ingredients and packaging materials with current price, stock on hand, and reorder levels.
* **Recipe:** Batches of ingredients with quantity multipliers and yield counts.
* **Client:** Customers with order histories, receivables balances, and birthdays.
* **Order & Invoice:** Customer commitments, itemized line items, delivery dates, and payment statuses.
* **Expense & Purchase:** Operational costs and supplier material acquisitions.
* **Payment:** Immutable transaction records with Paystack payment references.

---

## Environment Variables Reference

### Backend Configuration (`backend/.env`)

```ini
# Application Port & Node Environment
PORT=4000
NODE_ENV=production

# Supabase / PostgreSQL Database Connection
DATABASE_URL="postgresql://postgres.xxx:password@aws-0-region.pooler.supabase.com:5432/postgres"

# Authentication Secret
JWT_SECRET="your_long_unguessable_jwt_secret_key"

# Live Frontend URL (Used in activation & notification emails)
APP_URL="https://bakewealthinternational.com"

# CORS Allowed Origins (Comma-separated)
ALLOWED_ORIGINS="http://localhost:5173,https://bakewealthinternational.com,https://bakewealth.netlify.app"

# Brevo (Sendinblue) Transactional REST API v3
BREVO_API_KEY="xkeysib-your_brevo_api_key"
BREVO_FROM_EMAIL="info@bakewealthinternational.com"
BREVO_FROM_NAME="Bakewealth"

# Paystack Payment Gateway
PAYSTACK_SECRET_KEY="sk_live_your_paystack_secret_key"
PAYSTACK_BASE_URL="https://api.paystack.co"

# Claude Anthropic AI API (Direct Server Proxy)
CLAUDE_API="sk-ant-api03-your_anthropic_api_key"
CLAUDE_MODEL="claude-sonnet-5"

# SuperAdmin Default Credentials
SUPERADMIN_EMAIL="ad-"
SUPERADMIN_PASSWORD="Sesword"
```

### Frontend Configuration (`client/.env`)

```ini
# Target Backend API URL (Omit trailing slash)
VITE_API_URL="https://your-backend-api.onrender.com"

# Supabase Client Credentials
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="sb_publishable_your_key"

# Paystack Public Key
VITE_PAYSTACK_PUBLIC_KEY="pk_live_your_paystack_public_key"
```

---

## Local Development & Deployment Guide

### Prerequisites
* **Node.js:** v20.0.0 or higher
* **npm:** v10.0.0 or higher
* **PostgreSQL:** Local or cloud Supabase instance

### Quick Local Setup

1. **Clone the repository:**
   ```bash
   git clone git@github.com:Imrannnnn/Layerledger.git
   cd Layerledger
   ```

2. **Install all dependencies:**
   ```bash
   npm run install:all
   ```

3. **Configure Environment Variables:**
   * Copy `backend/.env.example` to `backend/.env` and supply your database connection string and API keys.
   * Copy `client/.env.example` (or configure `client/.env`) with `VITE_API_URL=http://localhost:4000`.

4. **Initialize Database Schema:**
   ```bash
   npm run db:push --prefix backend
   ```

5. **Start Dev Servers:**
   ```bash
   # Starts both Vite client (port 5173) and Express backend (port 4000)
   npm run dev
   ```

### Running Test Suites & Linter
```bash
# Run ESLint across entire codebase
npm run lint

# Run Backend Unit & Integration Tests (activation flow, Brevo email, payments, P&L)
npm run test --prefix backend

# Run Frontend React Component Tests
npm run test --prefix client
```

### Production Deployment

* **Backend (Render / Railway / Fly.io):**
  * Root directory: `backend`
  * Build command: `npm install && npx prisma generate`
  * Start command: `node server.js`
  * Add all variables listed in the Backend Environment Variables table.

* **Frontend (Cloudflare Pages / Netlify / Vercel):**
  * Root directory: `client`
  * Build command: `npm run build`
  * Output directory: `dist`
  * Environment variable: `VITE_API_URL` pointing to your deployed backend URL.

---

## License & Support

Copyright &copy; 2026 **BakeWealth International**. All rights reserved.

For technical assistance, feature requests, or custom bakery integrations:
* **Website:** [bakewealthinternational.com](https://bakewealthinternational.com)
* **Email Support:** [info@bakewealthinternational.com](mailto:info@bakewealthinternational.com)
