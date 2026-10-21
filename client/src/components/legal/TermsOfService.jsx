import React from "react"
import { ArrowLeft, Printer, FileText, CheckCircle2 } from "lucide-react"

export function TermsOfService({ onBack }) {
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
          <FileText size={14} />
          <span>User Agreement</span>
        </div>
        <h1 style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: 28,
          fontWeight: 700,
          color: "var(--text, #291608)",
          margin: "0 0 8px 0"
        }}>
          BakeWealth Terms of Service
        </h1>
        <p style={{ fontSize: 13.5, color: "var(--muted, #8C6E52)", margin: 0 }}>
          <strong>Effective Date:</strong> October 12, 2026 &bull; <strong>Platform:</strong> bakewealthinternational.com &bull; <strong>Jurisdiction:</strong> Federal Republic of Nigeria
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
            1. Agreement and Eligibility
          </h2>
          <p style={{ fontSize: 14 }}>
            By registering, logging in, or using BakeWealth (operated by Iye Ibe Achem at <em>bakewealthinternational.com</em>), you agree to be bound by these Terms of Service. You must be at least 18 years old and authorized to act on behalf of your bakery or organization to use this service.
          </p>
        </section>

        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: "var(--text, #291608)", marginBottom: 12 }}>
            2. Your Ownership of Bakery Data
          </h2>
          <p style={{ fontSize: 14 }}>
            <strong>You own your recipes and customer data.</strong> You retain complete, exclusive ownership of your proprietary cake recipes, ingredient formulas, pricing numbers, customer directory, and financial transactions. You grant BakeWealth a limited license solely to host and display this information to operate your workspace.
          </p>
        </section>

        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: "var(--text, #291608)", marginBottom: 12 }}>
            3. Subscription Plans and Billing
          </h2>
          <p style={{ fontSize: 14 }}>
            All subscriptions and credit packs are charged in Nigerian Naira (NGN) via Paystack:
          </p>
          <ul style={{ paddingLeft: 20, fontSize: 14 }}>
            <li style={{ marginBottom: 6 }}><strong>Free Tier (₦0/mo):</strong> 8 orders/mo, 10 recipes, 50 inventory items, 20 clients, 10 free AI scans on signup, watermarked invoices.</li>
            <li style={{ marginBottom: 6 }}><strong>Standard Tier (₦5,000/mo):</strong> Unlimited orders, 60 recipes, 250 inventory items, 150 clients, 2 staff logins, 20 AI scans/mo, watermarked invoices.</li>
            <li style={{ marginBottom: 6 }}><strong>Premium Tier (₦10,000/mo):</strong> Unlimited orders, recipes, inventory, and clients; 4 staff logins; 80 AI scans/mo; unbranded invoices featuring your bakery logo only.</li>
            <li style={{ marginBottom: 6 }}><strong>Multi-Month Discounts:</strong> 3 months (5% off), 6 months (10% off), 12 months (15% off).</li>
            <li style={{ marginBottom: 6 }}><strong>Credit Packs:</strong> Small (20 credits / ₦3,000), Medium (50 credits / ₦6,500), Large (120 credits / ₦14,000). Credits never expire while your account remains open.</li>
            <li style={{ marginBottom: 6 }}><strong>Prepaid Model:</strong> We do not automatically auto-debit cards without your active knowledge. When prepaid terms finish, accounts revert to Free tier without data loss.</li>
          </ul>
        </section>

        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: "var(--text, #291608)", marginBottom: 12 }}>
            4. Refund Policy
          </h2>
          <p style={{ fontSize: 14 }}>
            Subscription refund requests may be submitted within <strong>seven (7) calendar days</strong> of initial payment by emailing <em>hello@bakewealthinternational.com</em>. AI credit packs are non-refundable once any credits from the pack have been used. Approved refunds settle via Paystack within 5–10 business days.
          </p>
        </section>

        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: "var(--text, #291608)", marginBottom: 12 }}>
            5. Acceptable Use
          </h2>
          <p style={{ fontSize: 14 }}>
            You agree not to probe, scan, or attack our systems; reverse engineer the software; manipulate requests to bypass plan quotas; upload viruses; or use automated scrapers. Violations will result in immediate termination of access.
          </p>
        </section>

        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: "var(--text, #291608)", marginBottom: 12 }}>
            6. Important Professional Disclaimers
          </h2>
          <div style={{ background: "var(--panel, #FDFAF4)", borderLeft: "4px solid var(--gold, #c8912a)", padding: 14, borderRadius: "0 8px 8px 0", marginBottom: 14 }}>
            <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 4 }}>Baking & Costing Disclaimer</div>
            <div style={{ fontSize: 13, color: "var(--muted, #8C6E52)" }}>
              Actual baking yields depend on oven calibration, ingredient shrinkage, waste percentages, and kitchen efficiency. Calculations are estimates to assist your planning; you remain responsible for verifying prices before quoting clients.
            </div>
          </div>
          <div style={{ background: "var(--panel, #FDFAF4)", borderLeft: "4px solid var(--gold, #c8912a)", padding: 14, borderRadius: "0 8px 8px 0" }}>
            <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 4 }}>Not Certified Accounting or Legal Advice</div>
            <div style={{ fontSize: 13, color: "var(--muted, #8C6E52)" }}>
              BakeWealth is bookkeeping software, not a chartered accounting firm or tax consultancy. Consult a qualified professional for official statutory filings (e.g. FIRS VAT and Company Income Tax).
            </div>
          </div>
        </section>

        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: "var(--text, #291608)", marginBottom: 12 }}>
            7. Limitation of Liability
          </h2>
          <p style={{ fontSize: 14 }}>
            To the maximum extent permitted by Nigerian law, BakeWealth's cumulative liability for any claim arising from your use of the platform shall not exceed the greater of the fees paid by you in the preceding 12 months or <strong>Twenty-Five Thousand Nigerian Naira (₦25,000 NGN)</strong>.
          </p>
        </section>

        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: "var(--text, #291608)", marginBottom: 12 }}>
            8. Governing Law
          </h2>
          <p style={{ fontSize: 14 }}>
            These Terms are governed by the <strong>laws of the Federal Republic of Nigeria</strong>. Disputes are subject to 30 days of informal, good-faith negotiation before being submitted to the courts of Nigeria.
          </p>
        </section>

        <section>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: "var(--text, #291608)", marginBottom: 12 }}>
            9. Contact Details
          </h2>
          <div style={{ background: "var(--panel, #FDFAF4)", padding: 14, borderRadius: 8, fontSize: 13.5 }}>
            <div><strong>Email:</strong> <a href="mailto:hello@bakewealthinternational.com" style={{ color: "var(--gold, #c8912a)" }}>hello@bakewealthinternational.com</a> / <a href="mailto:info@bakewealthinternational.com" style={{ color: "var(--gold, #c8912a)" }}>info@bakewealthinternational.com</a></div>
            <div><strong>Website:</strong> <a href="https://bakewealthinternational.com" target="_blank" rel="noopener noreferrer" style={{ color: "var(--gold, #c8912a)" }}>bakewealthinternational.com</a></div>
            <div><strong>Operator:</strong> Iye Ibe Achem</div>
          </div>
        </section>

      </div>
    </div>
  )
}
