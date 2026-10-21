# PRIVACY POLICY FOR BAKEWEALTH

**Effective Date:** October 12, 2026  
**Last Updated:** October 12, 2026  
**Platform Domain:** [bakewealthinternational.com](https://bakewealthinternational.com)  
**Operator:** BakeWealth ("we", "us", "our", operated by Iye Ibe Achem)  
**Primary Contact:** info@bakewealthinternational.com / hello@bakewealthinternational.com  

---

## 1. Introduction

Welcome to **BakeWealth** (accessible at [bakewealthinternational.com](https://bakewealthinternational.com)). BakeWealth is a dedicated bakery management, recipe costing, and bookkeeping software-as-a-service application designed specifically for cake designers, home bakers, and growing commercial baking enterprises.

We created BakeWealth to help bakers track cake orders, calculate exact recipe costs, manage ingredient inventory, scan receipts, and maintain clear financial records. Because you trust us with sensitive information about your craft, your recipes, and your business finances, protecting your privacy and being transparent about our data practices is one of our highest commitments.

This Privacy Policy explains what information we collect when you use BakeWealth, why we collect it, how it is stored and protected, who can access it, and your legal rights over your information. 

We process personal data in compliance with applicable data protection laws, including the **Nigeria Data Protection Act 2023 (NDPA 2023)** and regulations of the **Nigeria Data Protection Commission (NDPC)**, as well as the **General Data Protection Regulation (GDPR)** where applicable to international users and our European hosting infrastructure.

---

## 2. Information We Collect

We only collect information that is strictly necessary to provide, secure, and improve the BakeWealth service. We do not sell your personal information or your business data to anyone.

### 2.1 Account and User Identification Information
When you register for an account or add staff members, we collect:
* **Account Owner Details:** Your full name, email address, password (stored solely as a cryptographically salted bcrypt hash), and account type (individual baker or organization).
* **Staff Member Details:** Names, email addresses, assigned operational roles (*owner*, *manager*, *baker/production*, or *customer_service*), and optional 4-digit PIN codes used for fast terminal switching within your bakery workspace.
* **Account Activation Tokens:** Cryptographically generated single-use activation tokens and associated 24-hour expiration timestamps used to verify email ownership.

### 2.2 Bakery Business Profile Information
To customize your invoices, quotes, and reports, you may provide:
* Bakery or organization name.
* Tagline or business description.
* Business telephone number and public contact email address.
* Physical bakery or delivery studio address.
* Bakery logo image (stored via image URL or compressed asset).
* Custom brand colors (primary accent and sidebar color preferences).
* Custom pricing preferences, including profit margins, overhead percentages, and pan size/shape cost multipliers.

### 2.3 Customer (Client) Directory Information
When you manage customer orders through BakeWealth, you choose to store information about your clients, including:
* Client name.
* Phone number.
* Email address.
* Delivery or residential address.
* Birthday (used for customer celebration reminders).
* Order history, last order dates, and customer preference notes.

### 2.4 Recipe, Production, and Inventory Information
To operate your bakery costing and kitchen workflow, the app stores:
* **Inventory Data:** Ingredient names, categories, units of measure (e.g., kg, grams, liters, pieces), cost per unit, stock quantities on hand, reorder thresholds (minimum stock), and inventory transaction history.
* **Recipes:** Recipe names, ingredient compositions, batch sizes, batch weights, and specialized application rates (spread, fill, crumb coat, cover rates, and calibration flags).
* **Cake Orders & Quotes:** Customer order dates, delivery due dates, order status (quote, confirmed, in production, completed, delivered, cancelled), cake tier specifications, cake shapes, sizes, flavors, filling details, custom decorative elements, quoted prices, and ingredient deduction logs.
* **Invoices:** Auto-generated invoice numbers, issue dates, payment due dates, invoice notes, and payment status (draft, sent, paid).

### 2.5 Financial and Expense Information
To provide accounting, profit-and-loss statements, and balance sheets, we store:
* Operational expense records (category, date, amount, description, and attached receipt URLs).
* Ingredient purchase history (supplier name, purchase date, quantities, unit prices, and attached receipt URLs).
* Accounts payable and credit purchases (supplier balances, due dates, and settlement payment logs).
* Bank transaction logs imported manually or via statement text snippet.
* Balance sheet opening equity balances and monthly locked opening stock totals.

### 2.6 Payment and Subscription Information
When you subscribe to a paid plan or purchase AI scan credit packs:
* **What we store:** Paystack transaction reference, idempotency keys, purchase amount in Nigerian Naira (NGN), selected plan or credit pack identifier, payment status (e.g., pending, success, failed, refunded), customer email, timestamp, and audit trail records.
* **What we DO NOT store:** **We never collect, process, or store credit or debit card numbers, expiration dates, CVVs, or card PINs.** All payment card data is processed directly by Paystack through their PCI-DSS Level 1 certified secure payment gateway.

### 2.7 AI Feature Inputs (Receipt and Statement Scans)
When you use our optional AI tools:
* **Receipt Scanner:** Images of purchase receipts or supplier invoices uploaded for automated optical character recognition (OCR) and line-item extraction.
* **Bank Statement Importer:** Text extracts or statement snippets uploaded for automated transaction categorization.

### 2.8 Technical and Device Information
When you connect to BakeWealth, our web server logs standard technical data required for security and rate limiting:
* IP address.
* Browser user agent and device operating system.
* Timestamps of requests and API endpoints accessed.

---

## 3. How We Collect Information

We collect information through three primary channels:

1. **Information You Provide Directly:** You enter data when creating an account, filling out your bakery profile, saving client records, entering recipes, generating invoices, uploading receipts, and logging expenses.
2. **Information Generated Automatically Through Use:** As you use BakeWealth, the system automatically creates records to keep your accounts accurate—such as calculating inventory deductions when a cake order is completed, updating weighted average costs when new ingredients are purchased, or tracking remaining AI scan credits.
3. **Information Received from Secure Integrations:** When you make a payment, our payment gateway (Paystack) sends an encrypted server-to-server webhook notification confirming the transaction status, amount paid, and reference ID.

---

## 4. How We Use Information

We process your information strictly for legitimate business and operational purposes:

| Category of Data | Purpose and How It Is Used | Legal Basis (NDPA 2023 / GDPR) |
| :--- | :--- | :--- |
| **Account & Login Data** | Creating your account, authenticating logins via JWT, enforcing role-based permissions, and resetting credentials. | Performance of Contract (providing service) |
| **Business & Pricing Profile** | Rendering customized invoices, branding your client documents, and applying your desired profit margins to cake quotes. | Performance of Contract |
| **Inventory & Recipes** | Calculating real ingredient costs per cake tier, tracking stock on hand, warning when stock is low, and auto-generating shopping lists. | Performance of Contract |
| **Client Directory** | Associating orders with customer records, tracking order history, and facilitating invoice delivery. | Performance of Contract & Legitimate Interests of your bakery |
| **Financial & Bookkeeping** | Generating Profit & Loss statements, Balance Sheets, Cash Flow summaries, and tax-ready expense reports. | Performance of Contract & Compliance with financial reporting obligations |
| **Payment Transactions** | Fulfilling subscription upgrades, allocating prepaid AI scan credits, generating receipts, and processing authorized refunds. | Performance of Contract & Legal/Accounting compliance |
| **Receipt Images & Statements** | Providing AI-assisted OCR scanning to extract ingredient prices and categorize expenses without manual typing. | Your explicit instruction / Consent |
| **Transactional Emails** | Delivering account activation links, sending staff login invitations, warning when subscriptions or credits are low, and sending receipts. | Performance of Contract & Legitimate Interests |
| **Server Logs & Security** | Enforcing rate limits (preventing brute-force attacks), detecting unauthorized access, and maintaining server stability. | Legitimate Interests & Legal compliance |

---

## 5. How We Store and Protect Information

We take the security of your bakery data very seriously and implement industry-standard technical and organizational security controls:

* **Cryptographic Password Protection:** All user passwords are encrypted using `bcrypt` with a high computational cost factor (salt rounds: 12) before being saved. No BakeWealth administrator or employee can view your plaintext password.
* **Encryption in Transit:** All traffic between your browser, our API servers, our database, and external service providers is transmitted over secure, encrypted HTTPS/TLS 1.2+ connections.
* **Multi-Tenant Data Isolation:** BakeWealth employs a strict multi-tenant architecture. Every business record is tied to a distinct, unique Tenant ID (`tenantId`). Our database access layer and authentication middleware verify that users can only access records belonging to their own bakery workspace.
* **Rate Limiting and Abuse Prevention:** We enforce strict IP-based rate limiting on sensitive API endpoints (such as authentication, payment initialization, and refunds) to protect against credential stuffing, brute-force attacks, and distributed denial-of-service (DDoS) incidents.
* **Database Infrastructure:** Our production database runs on enterprise-grade managed cloud infrastructure (PostgreSQL hosted via Supabase on AWS Frankfurt, Germany), providing automated backups, continuous monitoring, and physical data center security.
* **Staff Access Restrictions:** Access to production infrastructure and server keys is strictly restricted to authorized engineering personnel using multi-factor authentication.

*Please note:* While we maintain rigorous safeguards, no web application or electronic transmission over the Internet can be guaranteed 100% immune from security threats. We encourage you to use a strong, unique password and safeguard your login credentials.

---

## 6. Who Can Access Information

Within BakeWealth, access to data is partitioned according to verified user roles:

1. **Bakery Owner:** Has unrestricted access to all data within their tenant workspace, including pricing formulas, recipes, financial reports (P&L and Balance Sheet), staff user management, danger zone data resets, and account deletion.
2. **Bakery Manager / Baker (Production):** Can view and manage inventory, recipes, production schedules, shopping lists, and the order calculator. Cannot view company bank imports, expenses, balance sheets, P&L statements, or Danger Zone settings.
3. **Customer Service Staff:** Can view customer records, enter quotes, create orders, and issue invoices. Cannot access proprietary recipe formulations, overall bakery financial statements, or banking records.
4. **Platform Super-Administrator:** Has access strictly to high-level platform health metrics (e.g., total tenant count, active bakeries in last 30 days, aggregated recipe and order counts across the platform, and aggregate subscription revenue). **The platform super-administrator cannot browse or inspect your private client names, customer phone numbers, recipe formulas, or individual transaction ledgers.**

---

## 7. When We Share Information with Third Parties

We never sell, rent, or trade your personal or business information to third-party data brokers, marketers, or advertisers. 

We only share data with carefully vetted technical service providers who assist us in operating our platform, subject to strict confidentiality and data protection agreements:

| Service Provider | Role / Function | Data Shared | Location / Safeguard |
| :--- | :--- | :--- | :--- |
| **Paystack Payments Limited** | Payment Gateway | Customer email, transaction amount in kobo (NGN), order reference | Nigeria (Licensed by CBN, PCI-DSS Level 1 compliant) |
| **Brevo (Sendinblue SAS)** | Transactional Email Service | Recipient email, user name, bakery name, activation links, staff invitations | France / European Union (GDPR compliant) |
| **Anthropic PBC** | AI Processing (Claude API) | Receipt images/text and bank statement snippets submitted for scanning | United States (Commercial API terms: inputs are NOT used to train foundation models) |
| **Supabase / AWS** | Cloud Database Hosting | Encrypted application data, user accounts, and business records | Frankfurt, Germany / EU (ISO 27001, SOC 2, GDPR compliant) |
| **Cloudflare Inc.** | CDN & Web Security | Web traffic, IP addresses, security threat telemetry | Global edge network |

We may also disclose information if required to do so by applicable law, a valid court order, or an official request by a competent law enforcement or regulatory authority.

---

## 8. Cookies and Local Storage

BakeWealth does **not** use intrusive third-party advertising cookies, cross-site trackers, or commercial marketing pixels.

We utilize standard browser storage mechanisms solely for essential operational functionality:
* **Browser `sessionStorage`:** Temporarily holds your active authentication session token (`ll_token`), current user profile, and active workspace view so you stay logged in while navigating the app during your browsing session.
* **Browser `localStorage`:** Used as an operational cache for selected user interface preferences (such as dismissing the onboarding wizard or caching dark mode preferences).

You can clear browser local storage and session storage at any time through your browser's settings; however, doing so will require you to log back into your account.

---

## 9. AI and Automated Processing

BakeWealth provides optional AI features powered by the Anthropic Claude API (`claude-sonnet-5`):

* **What is processed:** When you use the **Receipt Scanner**, the app sends the uploaded receipt image or text to Claude to identify the supplier, date, total amount, and line items. When you use the **Bank Statement Importer**, statement snippets are parsed to identify transaction descriptions and monetary amounts.
* **Why it is processed:** The sole purpose is to convert unstructured documents into structured bakery bookkeeping entries, saving you manual data entry time.
* **Daily Protective Ceiling:** To protect your account balance against unintended loops or runaway consumption, our servers enforce a strict daily ceiling of 100 AI scans per account.
* **Privacy & Model Training:** Under Anthropic's commercial API terms, data submitted through our API proxy is **not** used to train or improve Anthropic's public artificial intelligence models.
* **Your Control:** Using AI features is entirely optional. You can enter all receipts, purchases, expenses, and bank transactions manually without ever sending any information to the AI engine.

---

## 10. Payments and Financial Information

All financial transactions for BakeWealth subscriptions and credit packs are processed in Nigerian Naira (NGN):

* **Payment Gateway:** Payments are routed through **Paystack**, a Central Bank of Nigeria (CBN)-licensed payment solution provider owned by Stripe.
* **Prepaid Billing Model:** Subscriptions are prepaid for defined terms (1, 3, 6, or 12 months) with stackable expiration dates. **We do not automatically auto-debit your credit or debit card without your knowledge.** When your prepaid period ends, your account simply transitions to the Free plan unless you choose to renew.
* **Security Standards:** Paystack is certified to PCI-DSS Level 1 standards. BakeWealth servers never handle or retain credit card primary account numbers, card expiry dates, or CVV security codes.

---

## 11. Data Retention

We retain your information according to transparent business rules:

* **Active Accounts:** We retain your account data, inventory, recipes, client records, and financial entries for as long as your account remains open and active.
* **Prepaid Plan Expiry:** If your paid Standard or Premium subscription term expires, your account is transitioned to the Free plan. **We do not delete your historical recipes, inventory records, or past orders simply because a subscription expired.** Your historical data remains accessible to you.
* **Account Deletion:** If you choose to permanently delete your account using the **Danger Zone** in Settings, or request account termination, all tenant records—including users, inventory items, recipe formulas, client contacts, orders, invoices, expenses, transactions, and attached files—are **permanently and irreversibly purged from our database in an atomic cascade transaction.**
* **Financial Compliance Retention:** Certain immutable payment audit event logs (such as payment reference numbers, amounts paid, and Paystack settlement IDs) may be retained for statutory periods required under Nigerian accounting and tax legislation.

---

## 12. Account Deletion and User Rights

Under the **Nigeria Data Protection Act 2023 (NDPA 2023)** and international privacy frameworks such as the **GDPR**, you have substantial rights regarding your personal information:

1. **Right of Access:** You can review all personal and business data stored in your workspace directly through the BakeWealth user interface at any time.
2. **Right to Rectification:** You can edit and update your name, business details, client records, inventory, and settings at any time directly through the app.
3. **Right to Data Portability (Export):** You can download a complete backup export of your bakery workspace data as a JSON file at any time via **Settings → Backup & Data**.
4. **Right to Erasure (Account Deletion):** You can permanently delete your entire account and all associated records directly inside the application via **Settings → Danger Zone → Delete Workspace & All Data**. You may also submit a deletion request by emailing `info@bakewealthinternational.com`.
5. **Right to Object or Restrict Processing:** You may opt out of non-essential communications or withdraw consent for optional AI scanning features at any time.
6. **Right to Lodge a Complaint:** If you believe your data has been handled improperly, you have the right to lodge a complaint with the **Nigeria Data Protection Commission (NDPC)** at [ndpc.gov.ng](https://ndpc.gov.ng).

To exercise any of these rights or if you require assistance, email our dedicated privacy team at `info@bakewealthinternational.com`. We will respond to your verified request within 30 days without charge.

---

## 13. International Data Transfers

BakeWealth operates internationally. While our primary market and executive leadership are based in Nigeria, our technical infrastructure involves international data transfers:

* **Database Storage:** Stored in Frankfurt, Germany (European Union) via Supabase/AWS.
* **Email Transmission:** Routed through Brevo servers in France (European Union).
* **AI Processing:** Processed through Anthropic servers in the United States.

Under Sections 41–43 of the NDPA 2023, cross-border transfers are conducted lawfully based on:
* Transfer to jurisdictions with recognized data protection legal frameworks (such as the EU GDPR).
* Explicit contractual safeguards and standard data protection clauses with our cloud providers.
* Necessity for the performance of the contract between you and BakeWealth.

---

## 14. Children's Privacy

BakeWealth is a professional business software application intended exclusively for adult business owners, commercial bakers, and enterprise staff. We do not knowingly collect, solicit, or process personal data from children under the age of 18. If you become aware that a minor has registered an account without parental or guardian consent, please contact us immediately, and we will promptly delete the account and associated records.

---

## 15. Changes to This Privacy Policy

We may update this Privacy Policy from time to time to reflect changes in our software features, legal requirements, or operational practices. 

When material changes are made, we will notify you by:
* Posting an announcement banner within the application dashboard.
* Sending an informational email to your registered account email address.
* Updating the "Last Updated" date at the top of this document.

Continued use of BakeWealth after the effective date of an updated Privacy Policy constitutes your acknowledgment and acceptance of the revised terms.

---

## 16. Contact Information

If you have questions, concerns, feedback, or requests regarding this Privacy Policy or how BakeWealth handles your information, please reach out to us:

* **Application Name:** BakeWealth  
* **Founder / Data Protection Lead:** Iye Ibe Achem  
* **Official Privacy Email:** [info@bakewealthinternational.com](mailto:info@bakewealthinternational.com)  
* **General Inquiries:** [hello@bakewealthinternational.com](mailto:hello@bakewealthinternational.com)  
* **Website:** [bakewealthinternational.com](https://bakewealthinternational.com)  
* **Regulatory Authority:** Nigeria Data Protection Commission (NDPC) — [ndpc.gov.ng](https://ndpc.gov.ng)  
