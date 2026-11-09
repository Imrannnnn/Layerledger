/**
 * PandL.jsx
 * ----------------------------------------------------------------------------
 * Profit & Loss Statement.
 * Detailed financial statement including Revenue, COGS (recipes), Gross Profit,
 * Overhead Expenses (categorized), and Net Profit.
 * ----------------------------------------------------------------------------
 */
import React, { useState, useMemo, useEffect } from "react"
import { Btn, Card, SHead, Badge } from "../common/ui.jsx"
import { fmt, isDateInMonth } from "../../lib/helpers.js"
import { mergeRevenueSources, PLSection, PLRow } from "../../lib/costing.jsx"
import { fetchProfitLoss } from "../../lib/accountingApi.js"
import { Download, Sparkles, CheckCircle2 } from "lucide-react"

export function PandL({ productions, expenses, company }) {
  const allRevenue = useMemo(() => mergeRevenueSources(productions), [productions])

  const cur = useMemo(() => new Date().toISOString().slice(0, 7), [])
  const allMonths = useMemo(() => [...new Set([
    cur,
    ...allRevenue.map(p => p.confirmedAt ? p.confirmedAt.slice(0, 7) : (p.deliveryDate || p.orderDate || "").slice(0, 7)),
    ...expenses.map(e => e.date?.slice(0, 7))
  ].filter(Boolean))].sort().reverse(), [allRevenue, expenses, cur])

  const [sel, setSel] = useState(cur)
  const [drill, setDrill] = useState(null)
  const [glReport, setGlReport] = useState(null)
  const [loadingGl, setLoadingGl] = useState(false)
  const monthLabel = useMemo(() => new Date(sel + "-02").toLocaleDateString("en-NG", { month: "long", year: "numeric" }), [sel])
  const gold = company?.primaryColor || "var(--gold)"

  // Fetch live General Ledger Profit & Loss Statement (Rule 3)
  useEffect(() => {
    let isMounted = true
    const [y, m] = sel.split("-").map(Number)
    const lastDay = new Date(y, m, 0).getDate()
    const startDate = `${sel}-01`
    const endDate = `${sel}-${String(lastDay).padStart(2, "0")}`

    setLoadingGl(true)
    fetchProfitLoss({ startDate, endDate })
      .then(report => {
        if (isMounted) setGlReport(report)
      })
      .catch(err => {
        console.warn("Unable to fetch GL Profit & Loss statement:", err)
      })
      .finally(() => {
        if (isMounted) setLoadingGl(false)
      })

    return () => { isMounted = false }
  }, [sel])

  // Revenue comes from confirmed quotes/orders confirmed in the selected month
  const mRevenue = useMemo(() => allRevenue.filter(p => {
    if (p.fromQuote && p.confirmedAt) {
      return p.confirmedAt.startsWith(sel)
    }
    return (p.deliveryDate || p.orderDate || "").startsWith(sel)
  }), [allRevenue, sel])

  // Exclude gifts and samples from sales revenue
  const paid = useMemo(() => mRevenue.filter(p => p.paymentType !== "gift" && p.paymentType !== "sample"), [mRevenue])
  const legacyRevenue = useMemo(() => paid.reduce((s, p) => s + (p.salePrice || 0), 0), [paid])
  const legacyCogs = useMemo(() => paid.reduce((s, p) => s + (p.cost || 0), 0), [paid])
  const legacyGrossProfit = legacyRevenue - legacyCogs
  const legacyGrossMargin = legacyRevenue > 0 ? Math.round((legacyGrossProfit / legacyRevenue) * 100) : 0

  // Revenue by product type (for drill-down breakdown)
  const byType = useMemo(() => mRevenue.reduce((acc, p) => {
    const t = p.productType || "Cake"
    if (!acc[t]) acc[t] = { qty: 0, rev: 0, cost: 0 }
    acc[t].qty++
    acc[t].rev += (p.salePrice || 0)
    acc[t].cost += (p.cost || 0)
    return acc
  }, {}), [mRevenue])

  // Overhead expenses: non-ingredient purchases starting in selected month
  const mExp = useMemo(() => expenses.filter(e => {
    if (!isDateInMonth(e.date, sel)) return false
    const desc = String(e.description || "").trim().toLowerCase()
    const isPurchase = e.source === "purchase" || e.purchaseId || e.category === "Purchases" || desc.startsWith("purchase:") || desc.startsWith("purchase :")
    return !isPurchase
  }), [expenses, sel])
  const legacyOverhead = useMemo(() => mExp.reduce((s, e) => s + (e.amount || 0), 0), [mExp])
  const legacyNetProfit = legacyGrossProfit - legacyOverhead
  const legacyNetMargin = legacyRevenue > 0 ? Math.round((legacyNetProfit / legacyRevenue) * 100) : 0

  // General Ledger Effective Metrics (Rule 3)
  const revenue = glReport ? glReport.revenue.total : legacyRevenue
  const cogs = glReport ? glReport.costOfGoodsSold.total : legacyCogs
  const grossProfit = glReport ? glReport.grossProfit : legacyGrossProfit
  const grossMargin = glReport ? glReport.grossMarginPercent : legacyGrossMargin
  const overhead = glReport ? glReport.operatingExpenses.total : legacyOverhead
  const operatingProfit = glReport ? glReport.operatingProfit : (legacyGrossProfit - legacyOverhead)
  const otherIncome = glReport ? glReport.otherIncome.total : 0
  const otherExpenses = glReport ? glReport.otherExpenses.total : 0
  const netProfit = glReport ? glReport.netProfit : legacyNetProfit
  const netMargin = glReport ? glReport.netMarginPercent : legacyNetMargin

  // Group overheads by category
  const overheadBycat = useMemo(() => mExp.reduce((acc, e) => {
    const cat = e.category || "Miscellaneous"
    acc[cat] = (acc[cat] || 0) + (e.amount || 0)
    return acc
  }, {}), [mExp])

  const dl = () => {
    const w = window.open("", "_blank")
    const revAccounts = glReport?.revenue?.accounts || []
    const cogsAccounts = glReport?.costOfGoodsSold?.accounts || []
    const opexAccounts = glReport?.operatingExpenses?.accounts || []
    const otherIncAccounts = glReport?.otherIncome?.accounts || []
    const otherExpAccounts = glReport?.otherExpenses?.accounts || []

    w.document.write(`<!DOCTYPE html><html><head><title>P&L Statement ${monthLabel}</title>
    <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;color:#291608;padding:36px;max-width:700px;margin:0 auto}
    h1{font-size:22px;font-weight:700;color:${gold}}
    h2{font-size:12px;color:#888;font-weight:400;margin:3px 0 24px}
    .badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700;background:#E8F5EE;color:#1D6B40;margin-bottom:12px;text-transform:uppercase}
    .section{margin-bottom:18px}
    .section-title{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#888;font-weight:700;padding:8px 0;border-bottom:2px solid ${gold};margin-bottom:8px}
    .row{display:flex;justify-content:space-between;padding:6px 0;font-size:12.5px;border-bottom:1px solid #F0EBE3}
    .row.indent{padding-left:16px;color:#444}
    .row.subtotal{font-weight:700;background:#F5F0E4;padding:8px 10px;border-radius:4px;margin:4px 0}
    .row.total{font-weight:700;font-size:15px;padding:12px 14px;background:${netProfit >= 0 ? "#E8F5EE" : "#FDEBE9"};border-radius:8px;color:${netProfit >= 0 ? "#1D6B40" : "#B03A2E"};margin-top:10px}
    .positive{color:#1D6B40}.negative{color:#B03A2E}
    .summary{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:18px 0}
    .scard{border:1px solid #E0D3BB;border-radius:8px;padding:12px;text-align:center}
    .slabel{font-size:10px;text-transform:uppercase;letter-spacing:.8px;color:#888;margin-bottom:4px}
    .sval{font-size:18px;font-weight:700;color:${gold}}
    @media print{button{display:none}}</style></head><body>
    ${(company?.logo || "/Bakewealthlogo.jpeg") ? `<img src="${company?.logo || "/Bakewealthlogo.jpeg"}" style="height:44px;margin-bottom:12px;display:block;object-fit:contain"/>` : ""}
    <h1>${company?.name || "Bakery"} — Profit & Loss Statement</h1>
    <h2>${monthLabel}</h2>
    <div class="badge">General Ledger Double-Entry (Accrual Basis)</div>
    <div class="summary">
      <div class="scard"><div class="slabel">Revenue (Delivered)</div><div class="sval">₦${Math.round(revenue).toLocaleString()}</div></div>
      <div class="scard"><div class="slabel">Gross margin</div><div class="sval">${grossMargin}%</div></div>
      <div class="scard"><div class="slabel">Net margin</div><div class="sval ${netMargin >= 0 ? "positive" : "negative"}">${netMargin}%</div></div>
    </div>
    
    <div class="section">
      <div class="section-title">Revenue</div>
      ${revAccounts.length > 0 ? revAccounts.map(a => `<div class="row indent"><span>${a.accountName}</span><span>₦${Math.round(a.balance).toLocaleString()}</span></div>`).join("") : `<div class="row indent"><span>Delivered Sales</span><span>₦${Math.round(revenue).toLocaleString()}</span></div>`}
      <div class="row subtotal"><span>Total Revenue</span><span>₦${Math.round(revenue).toLocaleString()}</span></div>
    </div>

    <div class="section">
      <div class="section-title">Cost of Goods Sold (COGS)</div>
      ${cogsAccounts.length > 0 ? cogsAccounts.map(a => `<div class="row indent"><span>${a.accountName}</span><span>₦${Math.round(a.balance).toLocaleString()}</span></div>`).join("") : `<div class="row indent"><span>Ingredient & Packaging Costs</span><span>₦${Math.round(cogs).toLocaleString()}</span></div>`}
      <div class="row subtotal"><span>Total Cost of Goods Sold</span><span>₦${Math.round(cogs).toLocaleString()}</span></div>
    </div>

    <div class="row subtotal" style="font-size:13.5px;margin-bottom:16px"><span>Gross Profit</span><span class="${grossProfit >= 0 ? "positive" : "negative"}">₦${Math.round(grossProfit).toLocaleString()} (${grossMargin}%)</span></div>

    <div class="section">
      <div class="section-title">Operating Expenses</div>
      ${opexAccounts.length > 0 ? opexAccounts.map(a => `<div class="row indent"><span>${a.accountName}</span><span>₦${Math.round(a.balance).toLocaleString()}</span></div>`).join("") : Object.entries(overheadBycat).map(([cat, amt]) => `<div class="row indent"><span>${cat}</span><span>₦${Math.round(amt).toLocaleString()}</span></div>`).join("")}
      <div class="row subtotal"><span>Total Operating Expenses</span><span>₦${Math.round(overhead).toLocaleString()}</span></div>
    </div>

    <div class="row subtotal" style="font-size:13.5px;margin-bottom:16px"><span>Operating Profit</span><span class="${operatingProfit >= 0 ? "positive" : "negative"}">₦${Math.round(operatingProfit).toLocaleString()}</span></div>

    ${(otherIncAccounts.length > 0 || otherExpAccounts.length > 0) ? `
      <div class="section">
        <div class="section-title">Other Income & Expenses</div>
        ${otherIncAccounts.map(a => `<div class="row indent"><span>${a.accountName}</span><span>+₦${Math.round(a.balance).toLocaleString()}</span></div>`).join("")}
        ${otherExpAccounts.map(a => `<div class="row indent"><span>${a.accountName}</span><span>-₦${Math.round(a.balance).toLocaleString()}</span></div>`).join("")}
      </div>
    ` : ""}

    <div class="row total"><span>Net Profit / (Loss)</span><span>₦${Math.round(netProfit).toLocaleString()} (${netMargin}%)</span></div>
    <p style="margin-top:28px;font-size:10px;color:#aaa">Generated by BakeWealth · ${new Date().toLocaleDateString()} · Double-entry General Ledger single source of truth (Ruling 1, 2, 3).</p>
    <script>window.print()<\/script></body></html>`)
    w.document.close()
  }

  const DrillDown = ({ title, rows, onClose }) => (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: "var(--panel)", borderRadius: "16px 16px 0 0", width: "100%", maxWidth: 600, maxHeight: "75vh", overflow: "auto", padding: 20 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, fontWeight: 700 }}>{title}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "var(--muted)", lineHeight: 1 }}>×</button>
        </div>
        {rows.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--muted)", textAlign: "center", padding: 20 }}>No records found for this period.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                {["Date", "Description", "Amount"].map(h => (
                  <th key={h} style={{ textAlign: h === "Amount" ? "right" : "left", padding: "6px 8px", borderBottom: "1px solid var(--border)", fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.7, fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "transparent" : "var(--bg)" }}>
                  <td style={{ padding: "8px", fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}>{r.date}</td>
                  <td style={{ padding: "8px" }}>{r.label}</td>
                  <td style={{ padding: "8px", textAlign: "right", fontWeight: 600, color: r.amount < 0 ? "#B03A2E" : "var(--text)" }}>{fmt(Math.abs(r.amount))}</td>
                </tr>
              ))}
              <tr style={{ borderTop: "2px solid var(--border)" }}>
                <td colSpan={2} style={{ padding: "10px 8px", fontWeight: 700 }}>Total</td>
                <td style={{ padding: "10px 8px", textAlign: "right", fontWeight: 700, color: "var(--gold)" }}>{fmt(rows.reduce((s, r) => s + Math.abs(r.amount), 0))}</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </div>
  )

  const showRevenue = () => setDrill({ title: "Revenue — " + monthLabel, rows: paid.map(p => ({ date: p.deliveryDate || p.orderDate || "", label: (p.client || "Client") + " — " + (p.productType || "Cake") + (p.size ? " (" + p.size + ")" : ""), amount: p.salePrice || 0 })) })
  const showCOGS = () => setDrill({ title: "Cost of Goods Sold — " + monthLabel, rows: paid.map(p => ({ date: p.deliveryDate || p.orderDate || "", label: (p.client || "Client") + " — ingredient cost", amount: p.cost || 0 })) })
  const showOverhead = (cat) => {
    const rows = cat
      ? mExp.filter(e => e.category === cat).map(e => ({ date: e.date || "", label: e.description || e.category, amount: e.amount || 0 }))
      : mExp.map(e => ({ date: e.date || "", label: e.description || e.category, amount: e.amount || 0 }))
    setDrill({ title: cat ? cat + " — " + monthLabel : "All Overhead Expenses — " + monthLabel, rows })
  }

  return (
    <div>
      {drill && <DrillDown title={drill.title} rows={drill.rows} onClose={() => setDrill(null)} />}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <div>
          <SHead title="P&L Statement" sub="Profit & Loss — Double-entry General Ledger single source of truth" />
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
            <span style={{ fontSize: 11, background: "#E8F5EE", color: "#1D6B40", padding: "2px 8px", borderRadius: 4, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}>
              <CheckCircle2 size={11} /> General Ledger Accrual
            </span>
            <span style={{ fontSize: 11, color: "var(--muted)" }}>
              Revenue recognized on delivery (Ruling 2)
            </span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <select value={sel} onChange={e => setSel(e.target.value)} style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--panel)", fontSize: 13, color: "var(--text)" }}>
            {allMonths.map(m => (
              <option key={m} value={m}>
                {new Date(m + "-02").toLocaleDateString("en-NG", { month: "long", year: "numeric" })}
              </option>
            ))}
          </select>
          <Btn onClick={dl} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <Download size={13} /> Download PDF
          </Btn>
        </div>
      </div>

      {/* SUMMARY CARDS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 20 }}>
        {[
          { l: "Revenue (Delivered)", v: fmt(revenue), c: gold },
          { l: "Gross Margin", v: grossMargin + "%", c: grossMargin >= 50 ? "#357A52" : "#B03A2E" },
          { l: "Net Margin", v: netMargin + "%", c: netMargin >= 30 ? "#357A52" : "#B03A2E" }
        ].map(s => (
          <Card key={s.l} style={{ textAlign: "center", padding: "14px" }}>
            <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>{s.l}</div>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, fontWeight: 700, color: s.c }}>{s.v}</div>
          </Card>
        ))}
      </div>

      <Card style={{ maxWidth: 640 }}>
        {/* REVENUE SECTION */}
        <PLSection gold={gold} title="Revenue (Accrual)">
          {glReport?.revenue?.accounts?.length > 0 ? (
            glReport.revenue.accounts.map(acc => (
              <PLRow key={acc.accountCode} label={acc.accountName} value={fmt(acc.balance)} indent />
            ))
          ) : Object.entries(byType).length > 0 ? (
            Object.entries(byType).map(([type, data]) => (
              <div key={type} onClick={showRevenue} style={{ cursor: "pointer" }}>
                <PLRow label={`${type} (${data.qty} order${data.qty !== 1 ? "s" : ""})`} value={fmt(data.rev)} indent />
              </div>
            ))
          ) : (
            <PLRow label="No delivered sales in this period" value={fmt(0)} indent />
          )}
          <PLRow label="Total Revenue" value={fmt(revenue)} bold />
        </PLSection>

        {/* COGS SECTION */}
        <PLSection gold={gold} title="Cost of Goods Sold (COGS)">
          {glReport?.costOfGoodsSold?.accounts?.length > 0 ? (
            glReport.costOfGoodsSold.accounts.map(acc => (
              <PLRow key={acc.accountCode} label={acc.accountName} value={fmt(acc.balance)} indent />
            ))
          ) : (
            <div onClick={showCOGS} style={{ cursor: "pointer" }}>
              <PLRow label="Ingredient costs (recipes)" value={fmt(cogs)} indent />
            </div>
          )}
          <PLRow label="Total Cost of Goods Sold" value={fmt(cogs)} bold />
        </PLSection>

        <PLRow label={`Gross Profit (${grossMargin}% margin)`} value={fmt(grossProfit)} bold color={grossProfit >= 0 ? "#357A52" : "#B03A2E"} />

        <div style={{ height: 16 }} />

        {/* OPERATING EXPENSES SECTION */}
        <PLSection gold={gold} title="Operating Expenses">
          {glReport?.operatingExpenses?.accounts?.length > 0 ? (
            glReport.operatingExpenses.accounts.map(acc => (
              <PLRow key={acc.accountCode} label={acc.accountName} value={fmt(acc.balance)} indent />
            ))
          ) : (
            Object.entries(overheadBycat).map(([cat, amt]) => (
              <div key={cat} onClick={() => showOverhead(cat)} style={{ cursor: "pointer" }}>
                <PLRow label={cat} value={fmt(amt)} indent />
              </div>
            ))
          )}
          {(!glReport?.operatingExpenses?.accounts?.length && Object.keys(overheadBycat).length === 0) && (
            <PLRow label="No operating expenses recorded" value="₦0" indent />
          )}
          <PLRow label="Total Operating Expenses" value={fmt(overhead)} bold />
        </PLSection>

        <PLRow label="Operating Profit" value={fmt(operatingProfit)} bold color={operatingProfit >= 0 ? "#357A52" : "#B03A2E"} />

        {/* OTHER INCOME & EXPENSES (Rulings 13, 20) */}
        {(glReport?.otherIncome?.accounts?.length > 0 || glReport?.otherExpenses?.accounts?.length > 0) && (
          <div style={{ marginTop: 16 }}>
            <PLSection gold={gold} title="Other Income & Expenses">
              {glReport.otherIncome.accounts.map(acc => (
                <PLRow key={acc.accountCode} label={acc.accountName} value={fmt(acc.balance)} indent />
              ))}
              {glReport.otherExpenses.map ? null : glReport.otherExpenses.accounts.map(acc => (
                <PLRow key={acc.accountCode} label={acc.accountName} value={`(${fmt(acc.balance)})`} indent color="#B03A2E" />
              ))}
            </PLSection>
          </div>
        )}

        <div style={{ padding: "14px 16px", background: netProfit >= 0 ? "#E8F5EE" : "#FDEBE9", border: (netProfit >= 0 ? "1px solid #C2E0CF" : "1px solid #F09595"), borderRadius: 10, display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14 }}>
          <div>
            <div style={{ fontSize: 11, color: netProfit >= 0 ? "#085041" : "#501313", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 3 }}>Net Profit / (Loss)</div>
            <div style={{ fontSize: 11, color: netProfit >= 0 ? "#0F6E56" : "#791F1F" }}>{monthLabel}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, fontWeight: 700, color: netProfit >= 0 ? "#357A52" : "#B03A2E" }}>{fmt(netProfit)}</div>
            <div style={{ fontSize: 12, color: netProfit >= 0 ? "#357A52" : "#B03A2E" }}>{netMargin}% net margin</div>
          </div>
        </div>

        <div style={{ marginTop: 14, fontSize: 11, color: "var(--muted)", lineHeight: 1.6 }}>
          Directly computed from the double-entry General Ledger (Rule 3). Delivered revenue is recognized according to Ruling 2.
        </div>
      </Card>
    </div>
  )
}
