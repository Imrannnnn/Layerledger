/**
 * CashFlow.jsx
 * ----------------------------------------------------------------------------
 * Statement of Cash Flows (Ruling 1 & Rule 3).
 * Reconciles Accrual Net Profit to actual Cash movements across Operating,
 * Investing, and Financing activities directly from posted journal entries.
 * ----------------------------------------------------------------------------
 */
import React, { useState, useEffect } from "react"
import { Btn, Card, SHead, Badge } from "../common/ui.jsx"
import { fmt, today } from "../../lib/helpers.js"
import { fetchCashFlow } from "../../lib/accountingApi.js"
import { Lightbulb, Check, AlertTriangle, Download, RefreshCw, CheckCircle2 } from "lucide-react"

export function CashFlow({ productions = [], expenses = [], transactions = [], company }) {
  const curMonth = new Date().toISOString().slice(0, 7)
  const last12 = Array.from({ length: 12 }, (_, i) => {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() - i)
    return d.toISOString().slice(0, 7)
  })

  const [sel, setSel] = useState(curMonth)
  const [cfReport, setCfReport] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const monthLabel = new Date(sel + "-02").toLocaleDateString("en-NG", { month: "long", year: "numeric" })

  const loadCashFlow = async (monthStr) => {
    try {
      setLoading(true)
      setError(null)
      const [y, m] = monthStr.split("-").map(Number)
      const lastDay = new Date(y, m, 0).getDate()
      const startDate = `${monthStr}-01`
      const endDate = `${monthStr}-${String(lastDay).padStart(2, "0")}`

      const data = await fetchCashFlow({ startDate, endDate })
      setCfReport(data)
    } catch (err) {
      console.warn("Unable to fetch GL Cash Flow:", err)
      setError(err.message || "Failed to load cash flow statement")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCashFlow(sel)
  }, [sel])

  const Row = ({ label, value, indent, bold, pos, neg }) => (
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      padding: bold ? "10px 0" : "7px 0",
      borderBottom: bold ? "2px solid var(--border)" : "1px solid var(--border)",
      fontWeight: bold ? 700 : 400,
      fontSize: bold ? 13.5 : 12.5
    }}>
      <span style={{ paddingLeft: indent ? 16 : 0, color: indent ? "var(--muted)" : "var(--text)" }}>{label}</span>
      <span style={{
        color: value < 0 || neg ? "#B03A2E" : pos || value > 0 ? (bold ? "#1D6B40" : "var(--text)") : "var(--text)",
        fontWeight: bold || pos || value < 0 ? 600 : 400
      }}>
        {value < 0 ? `(${fmt(Math.abs(value))})` : fmt(value)}
      </span>
    </div>
  )

  const op = cfReport?.operatingActivities
  const inv = cfReport?.investingActivities
  const fin = cfReport?.financingActivities
  const sum = cfReport?.summary

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <div>
          <SHead title="Cash Flow Statement" sub="Real cash movement — Reconciles Net Profit to Cash and Bank (Ruling 1)" />
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
            <span style={{ fontSize: 11, background: "#E8F5EE", color: "#1D6B40", padding: "2px 8px", borderRadius: 4, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}>
              <CheckCircle2 size={11} /> General Ledger Indirect Method
            </span>
            <span style={{ fontSize: 11, color: "var(--muted)" }}>
              Includes Customer Deposits & Prepayments
            </span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <select value={sel} onChange={e => setSel(e.target.value)} style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--panel)", fontSize: 13, color: "var(--text)" }}>
            {last12.map(m => (
              <option key={m} value={m}>
                {new Date(m + "-02").toLocaleDateString("en-NG", { month: "long", year: "numeric" })}
              </option>
            ))}
          </select>
          <Btn small variant="ghost" onClick={() => loadCashFlow(sel)} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <RefreshCw size={13} className={loading ? "spin" : ""} /> Refresh
          </Btn>
        </div>
      </div>

      <div style={{ background: "#FEF9EE", border: "1px solid var(--gold)", borderRadius: 8, padding: "11px 14px", fontSize: 12.5, color: "#7A5500", lineHeight: 1.7, marginBottom: 16, display: "flex", alignItems: "flex-start", gap: 8 }}>
        <Lightbulb size={15} style={{ flexShrink: 0, marginTop: 2 }} />
        <span>This statement tracks actual cash entering and leaving the bakery. Profit is not cash: a bakery can make profit on cake orders while cash is tied up in raw materials, equipment, or advance deposits.</span>
      </div>

      <Card style={{ maxWidth: 640 }}>
        {/* OPERATING ACTIVITIES */}
        <div style={{ fontSize: 11.5, textTransform: "uppercase", letterSpacing: 1, color: "var(--gold)", fontWeight: 700, marginBottom: 6, paddingBottom: 4, borderBottom: "1px solid var(--border)" }}>
          Cash Flow from Operating Activities
        </div>
        <Row label="Net Profit / (Loss) for the Period (Accrual)" value={op?.netProfit || 0} indent />
        <Row label="Add: Non-Cash Depreciation & Amortisation" value={op?.depreciation || 0} indent pos />

        <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", margin: "8px 0 2px 16px", fontWeight: 600 }}>
          Working Capital Adjustments:
        </div>
        <Row label="Change in Accounts Receivable" value={op?.workingCapitalChanges?.accountsReceivableChange || 0} indent />
        <Row label="Change in Prepayments & Other Receivables" value={op?.workingCapitalChanges?.prepaymentsChange || 0} indent />
        <Row label="Change in Raw Materials Inventory" value={op?.workingCapitalChanges?.rawMaterialsChange || 0} indent />
        <Row label="Change in Packaging Inventory" value={op?.workingCapitalChanges?.packagingChange || 0} indent />
        <Row label="Change in Accounts Payable" value={op?.workingCapitalChanges?.accountsPayableChange || 0} indent />
        <Row label="Change in Customer Deposits" value={op?.workingCapitalChanges?.customerDepositsChange || 0} indent />
        <Row label="Net Cash from Operating Activities" value={op?.netCashFromOperatingActivities || 0} bold />

        {/* INVESTING ACTIVITIES */}
        <div style={{ fontSize: 11.5, textTransform: "uppercase", letterSpacing: 1, color: "var(--gold)", fontWeight: 700, margin: "16px 0 6px", paddingBottom: 4, borderBottom: "1px solid var(--border)" }}>
          Cash Flow from Investing Activities
        </div>
        <Row label="Capital Expenditure: Purchase of PPE (Fixed Assets)" value={-(inv?.purchasesOfPPE || 0)} indent />
        <Row label="Proceeds from Sale/Disposal of Fixed Assets" value={inv?.proceedsFromDisposal || 0} indent />
        <Row label="Net Cash from Investing Activities" value={inv?.netCashFromInvestingActivities || 0} bold />

        {/* FINANCING ACTIVITIES */}
        <div style={{ fontSize: 11.5, textTransform: "uppercase", letterSpacing: 1, color: "var(--gold)", fontWeight: 700, margin: "16px 0 6px", paddingBottom: 4, borderBottom: "1px solid var(--border)" }}>
          Cash Flow from Financing Activities
        </div>
        <Row label="Owner Capital Introduced" value={fin?.capitalContributions || 0} indent />
        <Row label="Owner Drawings / Dividends" value={-(fin?.ownerDrawings || 0)} indent />
        <Row label="Proceeds from Bank & Director Loans" value={fin?.loanReceipts || 0} indent />
        <Row label="Repayment of Loan Principal" value={-(fin?.loanRepayments || 0)} indent />
        <Row label="Net Cash from Financing Activities" value={fin?.netCashFromFinancingActivities || 0} bold />

        {/* RECONCILIATION SUMMARY */}
        <div style={{ marginTop: 18, padding: "14px 16px", background: "#FEF9EE", border: "1px solid var(--gold)", borderRadius: 10 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8, color: "var(--gold)", fontWeight: 700, marginBottom: 8 }}>
            Cash & Bank Reconciliation Summary
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 13 }}>
            <span>Beginning Cash & Bank Balance:</span>
            <span style={{ fontWeight: 600 }}>{fmt(sum?.beginningCash || 0)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 13 }}>
            <span>Net Change in Cash (Operating + Investing + Financing):</span>
            <span style={{ fontWeight: 600, color: (sum?.netChangeInCash || 0) >= 0 ? "#1D6B40" : "#B03A2E" }}>
              {(sum?.netChangeInCash || 0) >= 0 ? `+${fmt(sum?.netChangeInCash || 0)}` : `(${fmt(Math.abs(sum?.netChangeInCash || 0))})`}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0 0", fontSize: 14.5, fontWeight: 700, borderTop: "1px solid var(--gold)", marginTop: 6 }}>
            <span>Ending Cash & Bank Balance:</span>
            <span style={{ color: "#1D6B40" }}>{fmt(sum?.endingCash || 0)}</span>
          </div>
        </div>

        <div style={{ marginTop: 12, fontSize: 11, color: "var(--muted)", lineHeight: 1.6 }}>
          Directly computed from General Ledger journal lines. Beginning and ending cash balances tie to Cash on Hand and Bank Accounts.
        </div>
      </Card>
    </div>
  )
}
