/**
 * BalanceSheet.jsx
 * ----------------------------------------------------------------------------
 * Double-Entry General Ledger Balance Sheet (Rule 3 & Rulings 6, 10).
 * Assets = Liabilities + Equity, computed directly from posted journal entries.
 * ----------------------------------------------------------------------------
 */
import React, { useState, useEffect, useMemo } from "react"
import { Btn, Card, SHead, Badge } from "../common/ui.jsx"
import { fmt, today } from "../../lib/helpers.js"
import { loadOpeningBalance, PLRow } from "../../lib/costing.jsx"
import { fetchBalanceSheet } from "../../lib/accountingApi.js"
import { exportBalanceSheetPDF } from "../../lib/pdfReportGenerator.js"
import { Lightbulb, Check, AlertTriangle, Download, RefreshCw, CheckCircle2 } from "lucide-react"

export function BalanceSheet({ productions = [], expenses = [], inventory = [], transactions = [], company }) {
  const [asOfDate, setAsOfDate] = useState(today())
  const [glReport, setGlReport] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Fetch live Balance Sheet from General Ledger
  const loadBalanceSheet = async (date) => {
    try {
      setLoading(true)
      setError(null)
      const data = await fetchBalanceSheet({ asOfDate: date || asOfDate })
      setGlReport(data)
    } catch (err) {
      console.warn("Unable to fetch GL balance sheet:", err)
      setError(err.message || "Failed to load balance sheet from ledger")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadBalanceSheet(asOfDate)
  }, [asOfDate])

  // Fallback to legacy client-side calculations if API fails or empty
  const ob = loadOpeningBalance()
  const inventoryValue = inventory.reduce((s, i) => s + ((i.stock || 0) * (i.cost || 0)), 0)
  const cashIn = transactions.filter(t => t.type === "credit").reduce((s, t) => s + (t.amount || 0), 0)
  const cashOut = transactions.filter(t => t.type === "debit").reduce((s, t) => s + (t.amount || 0), 0)
  const fallbackCash = (ob?.cash || 0) + cashIn - cashOut
  const fallbackAssets = fallbackCash + inventoryValue + (ob?.equipment || 0)
  const fallbackLiabilities = ob?.loanBalance || 0
  const fallbackEquity = (ob?.capital || 0)

  // Active numbers (prefer General Ledger)
  const currentAssets = glReport ? glReport.currentAssets.total : (fallbackCash + inventoryValue)
  const grossPPE = glReport ? glReport.fixedAssets.grossPPETotal : (ob?.equipment || 0)
  const contraPPE = glReport ? glReport.fixedAssets.contraPPETotal : 0
  const netPPE = glReport ? glReport.fixedAssets.netPPE : (ob?.equipment || 0)
  const totalAssets = glReport ? glReport.totalAssets : fallbackAssets

  const currentLiabilities = glReport ? glReport.currentLiabilities.total : 0
  const longTermLiabilities = glReport ? glReport.longTermLiabilities.total : fallbackLiabilities
  const totalLiabilities = glReport ? glReport.totalLiabilities : fallbackLiabilities

  const totalEquity = glReport ? glReport.equity.total : fallbackEquity
  const totalLiabilitiesAndEquity = glReport ? glReport.totalLiabilitiesAndEquity : (fallbackLiabilities + fallbackEquity)
  const isBalanced = glReport ? glReport.isBalanced : (Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 1)
  const imbalanceAmount = glReport ? glReport.imbalanceAmount : Math.abs(totalAssets - (totalLiabilities + totalEquity))

  const handleDownloadPDF = () => {
    exportBalanceSheetPDF({
      asOf: asOfDate,
      cash: glReport?.currentAssets?.accounts?.find(a => a.accountCode === "1100" || a.accountCode === "1110")?.balance || fallbackCash,
      inventoryValue: glReport?.currentAssets?.accounts?.filter(a => ["1140", "1150", "1160"].includes(a.accountCode)).reduce((s, a) => s + a.balance, 0) || inventoryValue,
      receivables: glReport?.currentAssets?.accounts?.find(a => a.accountCode === "1120")?.balance || 0,
      obEquip: netPPE,
      totalAssets,
      payables: glReport?.currentLiabilities?.accounts?.find(a => a.accountCode === "2100")?.balance || 0,
      obLoan: longTermLiabilities,
      totalLiabilities,
      obCapital: glReport?.equity?.accounts?.find(a => a.accountCode === "3000")?.balance || (ob?.capital || 0),
      retainedEarnings: (glReport?.equity?.accounts?.find(a => a.accountCode === "3100")?.balance || 0) + (glReport?.equity?.currentYearNetProfit || 0),
      totalEquity,
      balanced: isBalanced
    }, company)
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <div>
          <SHead title="Balance Sheet" sub="Statement of Financial Position — Double-entry General Ledger single source of truth" />
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
            <span style={{ fontSize: 11, background: "#E8F5EE", color: "#1D6B40", padding: "2px 8px", borderRadius: 4, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}>
              <CheckCircle2 size={11} /> General Ledger Accrual
            </span>
            <span style={{ fontSize: 11, color: "var(--muted)" }}>
              Contra-Asset Depreciation (Ruling 10) & Customer Deposits (Ruling 2)
            </span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input
            type="date"
            value={asOfDate}
            onChange={e => setAsOfDate(e.target.value)}
            style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--panel)", fontSize: 13, color: "var(--text)" }}
          />
          <Btn small variant="outline" onClick={handleDownloadPDF} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <Download size={13} /> Download PDF
          </Btn>
          <Btn small variant="ghost" onClick={() => loadBalanceSheet(asOfDate)} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <RefreshCw size={13} className={loading ? "spin" : ""} /> Refresh
          </Btn>
        </div>
      </div>

      {/* Equality Verification Banner */}
      <div style={{
        marginBottom: 16,
        padding: "12px 16px",
        borderRadius: 10,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        background: isBalanced ? "#EAF6EF" : "#FDECEB",
        border: `1px solid ${isBalanced ? "#BCE3CD" : "#F6B3AF"}`,
        color: isBalanced ? "#176337" : "#A32D2D"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, fontSize: 13.5 }}>
          {isBalanced ? <Check size={18} /> : <AlertTriangle size={18} />}
          <span>
            {isBalanced
              ? "General Ledger is Perfectly Balanced (Assets = Liabilities + Equity)"
              : `Out of Balance by ${fmt(imbalanceAmount)} (Assets ≠ Liabilities + Equity)`}
          </span>
        </div>
        <div style={{ fontSize: 12, fontWeight: 700 }}>
          Assets: {fmt(totalAssets)} | Liab + Eq: {fmt(totalLiabilitiesAndEquity)}
        </div>
      </div>

      <Card style={{ maxWidth: 640 }}>
        {/* ASSETS SECTION */}
        <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 1, color: "var(--gold)", fontWeight: 700, marginBottom: 8, paddingBottom: 4, borderBottom: "1px solid var(--border)" }}>
          Assets — What The Business Owns
        </div>

        {/* Current Assets */}
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", margin: "10px 0 4px" }}>
          Current Assets
        </div>
        {glReport?.currentAssets?.accounts?.length > 0 ? (
          glReport.currentAssets.accounts.map(acc => (
            <PLRow key={acc.accountCode} label={acc.accountName} value={fmt(acc.balance)} indent />
          ))
        ) : (
          <>
            <PLRow label="Cash & Bank Balances" value={fmt(fallbackCash)} indent />
            <PLRow label="Inventory on Hand" value={fmt(inventoryValue)} indent />
          </>
        )}
        <PLRow label="Total Current Assets" value={fmt(currentAssets)} bold />

        {/* Fixed Assets (PPE) */}
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", margin: "14px 0 4px" }}>
          Property, Plant & Equipment (Fixed Assets)
        </div>
        {glReport?.fixedAssets?.grossPPE?.length > 0 ? (
          glReport.fixedAssets.grossPPE.map(acc => (
            <PLRow key={acc.accountCode} label={`${acc.accountName} (Cost)`} value={fmt(acc.balance)} indent />
          ))
        ) : (
          <PLRow label="Production Equipment (Gross Cost)" value={fmt(grossPPE)} indent />
        )}
        {contraPPE > 0 && (
          <PLRow label="Less: Accumulated Depreciation" value={`(${fmt(contraPPE)})`} indent color="#B03A2E" />
        )}
        <PLRow label="Net Fixed Assets (PPE)" value={fmt(netPPE)} bold />

        <div style={{ margin: "6px 0 16px" }}>
          <PLRow label="TOTAL ASSETS" value={fmt(totalAssets)} bold color="#1D6B40" />
        </div>

        {/* LIABILITIES SECTION */}
        <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 1, color: "var(--gold)", fontWeight: 700, margin: "20px 0 8px", paddingBottom: 4, borderBottom: "1px solid var(--border)" }}>
          Liabilities — What The Business Owes
        </div>

        {/* Current Liabilities */}
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", margin: "10px 0 4px" }}>
          Current Liabilities
        </div>
        {glReport?.currentLiabilities?.accounts?.length > 0 ? (
          glReport.currentLiabilities.accounts.map(acc => (
            <PLRow key={acc.accountCode} label={acc.accountName} value={fmt(acc.balance)} indent />
          ))
        ) : (
          <PLRow label="Customer Deposits & Payables" value={fmt(currentLiabilities)} indent />
        )}
        <PLRow label="Total Current Liabilities" value={fmt(currentLiabilities)} bold />

        {/* Long-Term Liabilities */}
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", margin: "14px 0 4px" }}>
          Long-Term Liabilities
        </div>
        {glReport?.longTermLiabilities?.accounts?.length > 0 ? (
          glReport.longTermLiabilities.accounts.map(acc => (
            <PLRow key={acc.accountCode} label={acc.accountName} value={fmt(acc.balance)} indent />
          ))
        ) : (
          <PLRow label="Long-Term Loans" value={fmt(longTermLiabilities)} indent />
        )}
        <PLRow label="Total Long-Term Liabilities" value={fmt(longTermLiabilities)} bold />

        <div style={{ margin: "6px 0 16px" }}>
          <PLRow label="TOTAL LIABILITIES" value={fmt(totalLiabilities)} bold />
        </div>

        {/* EQUITY SECTION */}
        <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 1, color: "var(--gold)", fontWeight: 700, margin: "20px 0 8px", paddingBottom: 4, borderBottom: "1px solid var(--border)" }}>
          Equity — Owner's Stake & Retained Profit
        </div>
        {glReport?.equity?.accounts?.length > 0 ? (
          glReport.equity.accounts.map(acc => (
            <PLRow key={acc.accountCode} label={acc.accountName} value={fmt(acc.balance)} indent />
          ))
        ) : (
          <PLRow label="Share Capital / Owner Investment" value={fmt(fallbackEquity)} indent />
        )}
        {glReport?.equity?.currentYearNetProfit !== undefined && (
          <PLRow
            label="Current Year Earnings (P&L Net Profit)"
            value={fmt(glReport.equity.currentYearNetProfit)}
            indent
            color={glReport.equity.currentYearNetProfit >= 0 ? "#1D6B40" : "#B03A2E"}
          />
        )}
        <PLRow label="TOTAL EQUITY" value={fmt(totalEquity)} bold />

        {/* TOTAL LIABILITIES & EQUITY */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          fontWeight: 700,
          fontSize: 15,
          padding: "14px 16px",
          background: "#FEF9EE",
          border: "1px solid var(--gold)",
          borderRadius: 8,
          marginTop: 20
        }}>
          <span>TOTAL LIABILITIES & EQUITY</span>
          <span>{fmt(totalLiabilitiesAndEquity)}</span>
        </div>

        <div style={{ marginTop: 14, fontSize: 11, color: "var(--muted)", lineHeight: 1.6 }}>
          Computed directly from the double-entry General Ledger (Rule 3). Fixed assets reflect cost preservation with separate contra-asset depreciation (Ruling 10).
        </div>
      </Card>
    </div>
  )
}
