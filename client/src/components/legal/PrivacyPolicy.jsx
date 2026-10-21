import React from "react"
import { ArrowLeft, Printer, Shield, CheckCircle, ExternalLink } from "lucide-react"

export function PrivacyPolicy({ onBack }) {
  return (
    <div style={{
      maxWidth: 880,
      margin: "0 auto",
      padding: "24px 16px 80px 16px",
      fontFamily: "'DM Sans', sans-serif",
      color: "var(--text, #291608)",
      lineHeight: 1.68
    }}>
      {/* Back and Action bar */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 24,
        paddingBottom: 16,
        borderBottom: "1px solid var(--border, #E0D3BB)"
      }}>
        <button
          type="button"
          onClick={onBack}
          style={{
            background: "none",
            border: "none",
            color: "var(--gold, #c8912a)",
            fontSize: 13.5,
            fontWeight: 600,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 0"
          }}
        >
          <ArrowLeft size={16} />
          <span>Back</span>
        </button>

        <button
          type="button"
          onClick={() => window.print()}
          style={{
            background: "var(--panel, #FDFAF4)",
            border: "1px solid var(--border, #E0D3BB)",
            borderRadius: 6,
            color: "var(--muted, #8C6E52)",
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 14px",
            transition: "all 0.15s"
          }}
        >
          <Printer size={15} />
          <span>Print / Save PDF</span>
        </button>
      </div>

      {/* Header Banner */}
      <div style={{
        background: "var(--panel, #FDFAF4)",
        border: "1px solid var(--border, #E0D3BB)",
        borderRadius: 12,
        padding: "28px 24px",
        marginBottom: 32
      }}>
        <div style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          background: "rgba(200,145,42,0.12)",
          color: "var(--gold, #c8912a)",
          fontSize: 11.5,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: 1.2,
          padding: "4px 10px",
          borderRadius: 20,
          marginBottom: 12
        }}>
          <Shield size={14} />
          <span>Compliance & Data Protection</span>
        </div>
        <h1 style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: 28,
          fontWeight: 700,
          color: "var(--text, #291608)",
          margin: "0 0 8px 0"
        }}>
          BakeWealth Privacy Policy
        </h1>
        <p style={{ fontSize: 13.5, color: "var(--muted, #8C6E52)", margin: 0 }}>
          <strong>Effective Date:</strong> October 12, 2026 &bull; <strong>Platform:</strong> bakewealthinternational.com &bull; <strong>Framework:</strong> NDPA 2023 & GDPR
        </p>
      </div>

      {/* Main Content */}
      <div style={{
        background: "#fff",
        border: "1px solid var(--border, #E0D3BB)",
        borderRadius: 12,
        padding: "36px 32px",
        boxShadow: "0 2px 12px rgba(0,0,0,0.02)"
      }}>

        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: "var(--text, #291608)", marginBottom: 12 }}>
            1. Introduction
          </h2>
          <p style={{ fontSize: 14 }}>
            Welcome to <strong>BakeWealth</strong> (accessible at <em>bakewealthinternational.com</em>). BakeWealth is a dedicated bakery management, recipe costing, and bookkeeping software-as-a-service application operated by Iye Ibe Achem ("we", "us", "our"). BakeWealth enables cake designers, home bakers, and commercial baking enterprises to calculate exact recipe costs, track orders, manage ingredient inventory, scan receipts, and maintain clear financial records.
          </p>
          <p style={{ fontSize: 14 }}>
            We process personal and business data in compliance with the <strong>Nigeria Data Protection Act 2023 (NDPA 2023)</strong>, requirements of the <strong>Nigeria Data Protection Commission (NDPC)</strong>, and the <strong>General Data Protection Regulation (GDPR)</strong> where applicable.
          </p>
        </section>

        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: "var(--text, #291608)", marginBottom: 12 }}>
            2. Information We Collect
          </h2>
          <ul style={{ paddingLeft: 20, fontSize: 14 }}>
            <li style={{ marginBottom: 8 }}><strong>User Account Data:</strong> Full name, email address, cryptographically hashed passwords (bcrypt cost 12), staff roles (owner, manager, baker, customer service), and staff 4-digit PINs.</li>
            <li style={{ marginBottom: 8 }}><strong>Bakery Profile:</strong> Bakery business name, contact phone, contact email, physical address, bakery logo URL, brand color preferences, and pricing margin percentages.</li>
            <li style={{ marginBottom: 8 }}><strong>Client Records:</strong> Client names, phone numbers, email addresses, delivery addresses, birthdays, and customer notes.</li>
            <li style={{ marginBottom: 8 }}><strong>Recipes & Inventory:</strong> Ingredient names, unit costs, stock quantities, minimum stock alerts, recipe formulations, batch sizes, and application rates.</li>
            <li style={{ marginBottom: 8 }}><strong>Orders & Invoices:</strong> Order dates, due dates, tier specifications, custom decorative elements, prices, payment logs, and invoice numbers.</li>
            <li style={{ marginBottom: 8 }}><strong>Financial Entries:</strong> Operational expenses, ingredient purchase logs, supplier payables, and bank transaction descriptions.</li>
            <li style={{ marginBottom: 8 }}><strong>Payment Records:</strong> Paystack transaction references, idempotency keys, amounts in kobo (NGN), and status logs. <em>We never collect or store card numbers, CVVs, or card PINs.</em></li>
            <li style={{ marginBottom: 8 }}><strong>AI Feature Inputs:</strong> Receipt images and bank statement excerpts uploaded for OCR parsing.</li>
            <li style={{ marginBottom: 8 }}><strong>Technical Data:</strong> IP addresses and browser user agents used for security rate limiting.</li>
          </ul>
        </section>

        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: "var(--text, #291608)", marginBottom: 12 }}>
            3. How We Store and Protect Your Data
          </h2>
          <p style={{ fontSize: 14 }}>
            We protect your data using industry-standard technical measures:
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14, margin: "16px 0" }}>
            <div style={{ background: "var(--panel, #FDFAF4)", padding: 14, borderRadius: 8, border: "1px solid var(--border, #E0D3BB)" }}>
              <div style={{ fontWeight: 600, fontSize: 13.5, color: "var(--gold, #c8912a)", marginBottom: 4 }}>Multi-Tenant Isolation</div>
              <div style={{ fontSize: 12.5, color: "var(--muted, #8C6E52)" }}>All business records enforce strict tenant UUID partitioning in PostgreSQL with cascade security.</div>
            </div>
            <div style={{ background: "var(--panel, #FDFAF4)", padding: 14, borderRadius: 8, border: "1px solid var(--border, #E0D3BB)" }}>
              <div style={{ fontWeight: 600, fontSize: 13.5, color: "var(--gold, #c8912a)", marginBottom: 4 }}>Bcrypt Passwords</div>
              <div style={{ fontSize: 12.5, color: "var(--muted, #8C6E52)" }}>Passwords are hashed using bcrypt with salt rounds of 12. Plaintext passwords are never accessible.</div>
            </div>
            <div style={{ background: "var(--panel, #FDFAF4)", padding: 14, borderRadius: 8, border: "1px solid var(--border, #E0D3BB)" }}>
              <div style={{ fontWeight: 600, fontSize: 13.5, color: "var(--gold, #c8912a)", marginBottom: 4 }}>HTTPS Encryption</div>
              <div style={{ fontSize: 12.5, color: "var(--muted, #8C6E52)" }}>All traffic between your browser, our servers, and external APIs is encrypted via TLS 1.2+.</div>
            </div>
            <div style={{ background: "var(--panel, #FDFAF4)", padding: 14, borderRadius: 8, border: "1px solid var(--border, #E0D3BB)" }}>
              <div style={{ fontWeight: 600, fontSize: 13.5, color: "var(--gold, #c8912a)", marginBottom: 4 }}>Rate Limiting</div>
              <div style={{ fontSize: 12.5, color: "var(--muted, #8C6E52)" }}>Strict request limits protect login, registration, and payment endpoints against brute-force attacks.</div>
            </div>
          </div>
        </section>

        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: "var(--text, #291608)", marginBottom: 12 }}>
            4. Third-Party Service Providers
          </h2>
          <p style={{ fontSize: 14 }}>
            We never sell your data. We share data only with verified technical infrastructure providers:
          </p>
          <ul style={{ paddingLeft: 20, fontSize: 14 }}>
            <li><strong>Paystack Payments Limited (Nigeria):</strong> Payment gateway for subscriptions and credit packs. Certified PCI-DSS Level 1.</li>
            <li><strong>Brevo / Sendinblue SAS (France / EU):</strong> Delivery of transactional emails, account activation tokens, and payment receipts.</li>
            <li><strong>Anthropic PBC (USA):</strong> Cloud AI processing for receipt OCR and statement parsing. Data is not used for model training under commercial API terms.</li>
            <li><strong>Supabase / AWS (Frankfurt, Germany):</strong> Managed cloud PostgreSQL database hosting and automated backups.</li>
          </ul>
        </section>

        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: "var(--text, #291608)", marginBottom: 12 }}>
            5. Data Retention and Account Deletion
          </h2>
          <p style={{ fontSize: 14 }}>
            Your records are retained for as long as your account remains active. When prepaid plans end, accounts transition to the Free tier; your historical data is not deleted.
          </p>
          <p style={{ fontSize: 14 }}>
            Bakery Owners can permanently purge their account and all associated records directly in the app at any time via <strong>Settings &rarr; Danger Zone &rarr; Delete Workspace & All Data</strong>. This executes an atomic cascade deletion across all database tables.
          </p>
        </section>

        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: "var(--text, #291608)", marginBottom: 12 }}>
            6. Your Legal Rights (NDPA 2023 & GDPR)
          </h2>
          <p style={{ fontSize: 14 }}>
            You have the right to access your data, rectify errors, export a complete JSON backup (via Settings &rarr; Backup & Data), request account deletion, and lodge complaints with the <strong>Nigeria Data Protection Commission (NDPC)</strong> at <em>ndpc.gov.ng</em>.
          </p>
        </section>

        <section>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: "var(--text, #291608)", marginBottom: 12 }}>
            7. Contact Us
          </h2>
          <p style={{ fontSize: 14 }}>
            For privacy inquiries or rights requests, contact our data protection team:
          </p>
          <div style={{ background: "var(--panel, #FDFAF4)", padding: 14, borderRadius: 8, fontSize: 13.5 }}>
            <div><strong>Email:</strong> <a href="mailto:info@bakewealthinternational.com" style={{ color: "var(--gold, #c8912a)" }}>info@bakewealthinternational.com</a> / <a href="mailto:hello@bakewealthinternational.com" style={{ color: "var(--gold, #c8912a)" }}>hello@bakewealthinternational.com</a></div>
            <div><strong>Website:</strong> <a href="https://bakewealthinternational.com" target="_blank" rel="noopener noreferrer" style={{ color: "var(--gold, #c8912a)" }}>bakewealthinternational.com</a></div>
            <div><strong>Lead Operator:</strong> Iye Ibe Achem</div>
          </div>
        </section>

      </div>
    </div>
  )
}
