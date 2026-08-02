/**
 * MonthlyOverview.jsx
 * ----------------------------------------------------------------------------
 * Monthly Overview Report.
 * Displays Revenue, Production Cost, Overhead Expenses, Net Profit, and Stock.
 * ----------------------------------------------------------------------------
 */
import React, { useState } from "react"
import { Btn, Card, SHead, TH, TR2 } from "../common/ui.jsx"
import { fmt } from "../../lib/helpers.js"
import { mergeRevenueSources } from "../../lib/costing.jsx"
import { loadLocal } from "../../lib/data.js"

export function MonthlyOverview({ inventory, productions, expenses, company }) {
  const allRevenue = mergeRevenueSources(productions)

  const cur = new Date().toISOString().slice(0, 7)
  const months = [...new Set([
    cur,
    ...allRevenue.map(p => p.confirmedAt ? p.confirmedAt.slice(0, 7) : (p.deliveryDate || p.orderDate || "").slice(0, 7)),
    ...expenses.map(e => e.date?.slice(0, 7))
  ].filter(Boolean))].sort().reverse()

  const [sel, setSel] = useState(cur)
  const monthLabel = new Date(sel + "-02").toLocaleDateString("en-NG", { month: "long", year: "numeric" })

  // Revenue comes from confirmed quotes/orders confirmed in the selected month
  const mRevenue = allRevenue.filter(p => {
    if (p.fromQuote && p.confirmedAt) {
      return p.confirmedAt.startsWith(sel)
    }
    return (p.deliveryDate || p.orderDate || "").startsWith(sel)
  })

  // Revenue excludes gifts and samples
  const paid = mRevenue.filter(p => p.paymentType !== "gift" && p.paymentType !== "sample")
  const rev = paid.reduce((s, p) => s + (p.salePrice || 0), 0)

  // Production Cost: total ingredient costs from those same confirmed orders
  const prodCost = mRevenue.reduce((s, p) => s + (p.cost || 0), 0)

  // Overhead Expenses: total from the Expenses tab, excluding ingredient purchases
  const mExp = expenses.filter(e => e.date?.startsWith(sel) && e.source !== "purchase")
  const overhead = mExp.reduce((s, e) => s + (e.amount || 0), 0)

  const profit = rev - prodCost - overhead
  const margin = rev > 0 ? Math.round((profit / rev) * 100) : 0

  // Revenue by product type
  const byType = mRevenue.reduce((acc, p) => {
    const t = p.productType || "Cake"
    if (!acc[t]) acc[t] = { qty: 0, rev: 0 }
    acc[t].qty++
    acc[t].rev += (p.salePrice || 0)
    return acc
  }, {})

  // Purchases this month (from ll_purchases)
  const getPurchases = () => loadLocal("ll_purchases", [])
  const mPurchases = getPurchases().filter(p => p.date?.startsWith(sel))

  // Starting inventory snapshot
  const getOS = () => {
    const d = loadLocal("ll_os_" + sel, {})
    return d.items || []
  }
  const osItems = getOS()
  const getOSQty = id => {
    const f = osItems.find(i => i.id === id)
    return f ? f.openingQty : 0
  }

  const getBought = id => mPurchases.filter(p => p.itemId === id).reduce((s, p) => s + (p.stockAdded || 0), 0)

  const dl = () => {
    const w = window.open("", "_blank")
    w.document.write(`<!DOCTYPE html><html><head><title>Monthly Overview ${monthLabel}</title>
    <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;color:#291608;padding:32px;max-width:800px;margin:0 auto}
    h1{font-size:22px;font-weight:700;color:${company?.primaryColor || "var(--gold)"}}
    h2{font-size:13px;color:#888;font-weight:400;margin:4px 0 20px}
    .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:16px 0}
    .card{border:1px solid #E0D3BB;border-radius:8px;padding:12px}
    .label{font-size:10px;text-transform:uppercase;letter-spacing:.8px;color:#888;margin-bottom:4px}
    .val{font-size:18px;font-weight:700;color:#291608}
    table{width:100%;border-collapse:collapse;margin:14px 0;font-size:13px}
    th{background:#EDE5D6;padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.8px;color:#888;font-weight:500}
    td{padding:8px 10px;border-bottom:1px solid #E0D3BB}
    .total{background:#F5F0E4;font-weight:700}
    .sec{margin-top:24px;font-size:14px;font-weight:700;color:#291608;border-bottom:2px solid ${company?.primaryColor || "var(--gold)"};padding-bottom:4px;margin-bottom:10px}
    </style></head><body>
    ${company?.logo ? `<img src="${company.logo}" style="height:50px;margin-bottom:10px;display:block"/>` : ""}
    <h1>${company?.name || "Bakery"} — Monthly Overview</h1>
    <h2>${monthLabel}</h2>
    <div class="grid">
      <div class="card"><div class="label">Revenue</div><div class="val">₦${Math.round(rev).toLocaleString()}</div><div style="font-size:11px;color:#888;margin-top:3px">${paid.length} confirmed orders</div></div>
      <div class="card"><div class="label">Production cost</div><div class="val">₦${Math.round(prodCost).toLocaleString()}</div></div>
      <div class="card"><div class="label">Overheads</div><div class="val">₦${Math.round(overhead).toLocaleString()}</div></div>
      <div class="card"><div class="label">Net profit</div><div class="val" style="color:${profit >= 0 ? "#357A52" : "#B03A2E"}">₦${Math.round(profit).toLocaleString()}</div><div style="font-size:11px;color:#888;margin-top:3px">${margin}% margin</div></div>
    </div>
    <div class="sec">Confirmed Orders — Revenue</div>
    <table><tr><th>Delivery date</th><th>Client</th><th>Product</th><th>Ingredient cost</th><th style="text-align:right">Sale price</th></tr>
    ${mRevenue.map(p => `<tr><td>${p.deliveryDate || p.orderDate || ""}</td><td>${p.client || ""}</td><td>${p.productType || "Cake"}${p.size ? " — " + p.size : ""}</td><td>₦${Math.round(p.cost || 0).toLocaleString()}</td><td style="text-align:right;font-weight:600;color:#C8912A">₦${Math.round(p.salePrice || 0).toLocaleString()}</td></tr>`).join("")}
    ${mRevenue.length === 0 ? `<tr><td colspan="5" style="color:#888;font-style:italic;padding:12px">No confirmed orders this month</td></tr>` : ""}
    <tr class="total"><td colspan="3" style="text-align:right">Total</td><td>₦${Math.round(prodCost).toLocaleString()}</td><td style="text-align:right">₦${Math.round(rev).toLocaleString()}</td></tr></table>
    <div class="sec">Stock Movement</div>
    <table><tr><th>Item</th><th>Unit</th><th>Opening</th><th>+ Bought</th><th>− Used</th><th>Closing</th><th>Value</th></tr>
    ${inventory.map(item => {
      const f = osItems.find(x => x.id === item.id)
      const opening = f ? f.openingQty : 0
      const cost = f ? f.cost : item.cost
      const unit = f ? f.unit : item.unit
      const bought = getBought(item.id)
      const closing = item.stock
      const used = Math.max(0, parseFloat((opening + bought - closing).toFixed(3)))
      return `<tr><td>${item.name}</td><td>${unit}</td><td>${opening}</td><td style="color:#357A52">+${bought}</td><td style="color:#B03A2E">−${used}</td><td><strong>${closing}</strong></td><td>₦${Math.round(closing * cost).toLocaleString()}</td></tr>`
    }).join("")}
    <tr class="total"><td colspan="6" style="text-align:right">Total closing stock value</td><td>₦${Math.round(inventory.reduce((s, i) => {
      const f = osItems.find(x => x.id === i.id)
      const cost = f ? f.cost : i.cost
      return s + i.stock * cost
    }, 0)).toLocaleString()}</td></tr></table>
    <div class="sec">Overhead Expenses</div>
    <table><tr><th>Date</th><th>Description</th><th>Category</th><th style="text-align:right">Amount</th></tr>
    ${mExp.map(e => `<tr><td>${e.date || ""}</td><td>${e.description || ""}</td><td>${e.category || ""}</td><td style="text-align:right">₦${Math.round(e.amount || 0).toLocaleString()}</td></tr>`).join("")}
    <tr class="total"><td colspan="3" style="text-align:right">Total</td><td style="text-align:right">₦${Math.round(overhead).toLocaleString()}</td></tr></table>
    <p style="font-size:10px;color:#aaa;margin-top:24px">Generated by BakeWealth · ${new Date().toLocaleDateString()}</p>
    <script>window.print()<\/script></body></html>`)
    w.document.close()
  }

  return (
    <div>
      <SHead title="Monthly Overview" sub="P&L · Stock movement · Purchases · Expenses — everything in one place" />

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
        <select value={sel} onChange={e => setSel(e.target.value)} style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--panel)", fontSize: 13, color: "var(--text)" }}>
          {months.map(m => (
            <option key={m} value={m}>
              {new Date(m + "-02").toLocaleDateString("en-NG", { month: "long", year: "numeric" })}
            </option>
          ))}
        </select>
        <Btn onClick={dl}>📥 Download PDF</Btn>
        {osItems.length === 0 && (
          <span style={{ fontSize: 12, color: "#B03A2E", background: "#FDEBE9", padding: "4px 10px", borderRadius: 20 }}>
            ⚠ No opening stock set for {monthLabel} — go to Settings → Opening Stock
          </span>
        )}
      </div>

      {/* P&L CARDS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px, 1fr))", gap: 10, marginBottom: 16 }}>
        {[
          { l: "Revenue", v: fmt(rev), s: `${paid.length} confirmed orders`, c: "var(--gold)" },
          { l: "Production Cost", v: fmt(prodCost), s: "ingredient cost", c: "#2A5F9A" },
          { l: "Overheads", v: fmt(overhead), s: "non-ingredient", c: "var(--muted)" },
          { l: "Net Profit", v: fmt(profit), s: `${margin}% margin`, c: profit >= 0 ? "#357A52" : "#B03A2E" }
        ].map(s => (
          <Card key={s.l} style={{ borderTop: `3px solid ${s.c}`, borderRadius: "0 0 12px 12px" }}>
            <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 5 }}>{s.l}</div>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 19, fontWeight: 700, color: s.l === "Net Profit" ? s.c : "var(--text)" }}>{s.v}</div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{s.s}</div>
          </Card>
        ))}
      </div>

      {/* CONFIRMED ORDERS — REVENUE */}
      <Card style={{ padding: 0, overflowX: "auto", marginBottom: 14 }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 14, fontWeight: 600 }}>Confirmed orders — {monthLabel}</div>
          <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{paid.length} order{paid.length !== 1 ? "s" : ""} · Revenue: {fmt(rev)}</div>
        </div>
        {mRevenue.length === 0 ? (
          <div style={{ padding: "20px 16px", fontSize: 13, color: "var(--muted)", textAlign: "center", fontStyle: "italic" }}>
            No confirmed orders for {monthLabel}. Confirm orders from the Quotes page to see revenue here.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <TH cols={["Delivery date", "Client", "Product", "Ingredient cost", "Sale price", "Profit"]} />
            <tbody>
              {mRevenue.map((p, i) => {
                const pProfit = (p.salePrice || 0) - (p.cost || 0)
                return (
                  <TR2
                    key={p.id}
                    i={i}
                    row={[
                      <span>{p.deliveryDate || p.orderDate || "—"}</span>,
                      <span style={{ fontWeight: 500 }}>{p.client}</span>,
                      <span style={{ color: "var(--muted)" }}>{p.productType || "Cake"}{p.size ? " — " + p.size : ""}</span>,
                      <span style={{ color: "#2A5F9A" }}>{fmt(p.cost || 0)}</span>,
                      <span style={{ fontWeight: 600, color: "var(--gold)" }}>{fmt(p.salePrice || 0)}</span>,
                      <span style={{ fontWeight: 600, color: pProfit >= 0 ? "#357A52" : "#B03A2E" }}>{fmt(pProfit)}</span>
                    ]}
                  />
                )
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: "#F5F0E4" }}>
                <td colSpan={3} style={{ padding: "10px", textAlign: "right", fontWeight: 600, fontSize: 13 }}>Totals</td>
                <td style={{ padding: "10px", fontWeight: 600, color: "#2A5F9A" }}>{fmt(prodCost)}</td>
                <td style={{ padding: "10px", fontWeight: 700, color: "var(--gold)", fontSize: 15 }}>{fmt(rev)}</td>
                <td style={{ padding: "10px", fontWeight: 700, color: profit >= 0 ? "#357A52" : "#B03A2E", fontSize: 15 }}>{fmt(rev - prodCost)}</td>
              </tr>
            </tfoot>
          </table>
        )}
        {Object.keys(byType).length > 1 && (
          <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border)", display: "flex", gap: 16, flexWrap: "wrap" }}>
            {Object.entries(byType).map(([type, data]) => (
              <span key={type} style={{ fontSize: 12, color: "var(--muted)" }}>
                {type}: <strong style={{color: "var(--gold)"}}>{fmt(data.rev)}</strong> ({data.qty} orders)
              </span>
            ))}
          </div>
        )}
      </Card>

      {/* STOCK MOVEMENT */}
      <Card style={{ padding: 0, overflowX: "auto", marginBottom: 14 }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 14, fontWeight: 600 }}>Stock movement — {monthLabel}</div>
          <div style={{ fontSize: 11.5, color: "var(--muted)" }}>Opening + Bought − Used = Closing</div>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <TH cols={["Item", "Unit", "Opening", "+ Bought", "− Used", "Closing", "Cost/unit", "Value"]} />
          <tbody>
            {inventory.map((item, i) => {
              const opening = getOSQty(item.id)
              const bought = getBought(item.id)
              const closing = item.stock
              const used = Math.max(0, parseFloat((opening + bought - closing).toFixed(3)))
              const isLow = closing <= (item.minStock || 5)
              return (
                <TR2
                  key={item.id}
                  i={i}
                  row={[
                    <span style={{ fontWeight: 500 }}>{item.name}</span>,
                    <span style={{ color: "var(--muted)" }}>{item.unit}</span>,
                    <span>{opening} {item.unit}</span>,
                    <span style={{ color: "#357A52", fontWeight: 500 }}>+{bought} {item.unit}</span>,
                    <span style={{ color: "#B03A2E" }}>−{used} {item.unit}</span>,
                    <span style={{ fontWeight: 600, color: isLow ? "#B03A2E" : "#357A52" }}>{closing} {item.unit}{isLow ? " ⚠" : ""}</span>,
                    <span style={{ color: "var(--gold)" }}>{fmt(item.cost)}/{item.unit}</span>,
                    <span style={{ fontWeight: 500 }}>{fmt(closing * item.cost)}</span>
                  ]}
                />
              )
            })}
          </tbody>
          <tfoot>
            <tr style={{ background: "#F5F0E4" }}>
              <td colSpan={7} style={{ padding: "10px", textAlign: "right", fontWeight: 600, fontSize: 13 }}>Total closing stock value</td>
              <td style={{ padding: "10px", textAlign: "left", fontWeight: 700, color: "var(--gold)", fontSize: 15 }}>{fmt(inventory.reduce((s, i) => s + i.stock * i.cost, 0))}</td>
            </tr>
          </tfoot>
        </table>
      </Card>

      {/* PURCHASES + EXPENSES SIDE BY SIDE */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Card>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Purchases this month</div>
          {mPurchases.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--muted)" }}>No purchases logged for {monthLabel}.</div>
          ) : (
            <>
              {Object.entries(mPurchases.reduce((acc, p) => {
                if (!acc[p.item]) acc[p.item] = { count: 0, total: 0, qty: 0, unit: p.unit }
                acc[p.item].count++
                acc[p.item].total += p.total || 0
                acc[p.item].qty += p.stockAdded || 0
                return acc
              }, {})).map(([name, d]) => (
                <div key={name} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border)", fontSize: 12.5 }}>
                  <span>{name} <span style={{ color: "var(--muted)", fontSize: 11 }}>×{d.count}</span></span>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ color: "#357A52", fontWeight: 500 }}>+{d.qty.toFixed(1)} {d.unit}</div>
                    <div style={{ color: "var(--muted)", fontSize: 11 }}>{fmt(d.total)}</div>
                  </div>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontWeight: 600, fontSize: 13 }}>
                <span>Total spent on ingredients</span>
                <span style={{ color: "var(--gold)" }}>{fmt(mPurchases.reduce((s, p) => s + (p.total || 0), 0))}</span>
              </div>
            </>
          )}
        </Card>
        
        <Card>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Overhead expenses</div>
          {mExp.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--muted)" }}>No overhead expenses for {monthLabel}.</div>
          ) : (
            <>
              {mExp.slice(0, 6).map(e => (
                <div key={e.id} style={{ display: "flex", justifyItems: "space-between", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border)", fontSize: 12.5 }}>
                  <span style={{ flex: 1, marginRight: 8 }}>{e.description || e.category}</span>
                  <span style={{ color: "var(--muted)", flexShrink: 0 }}>{fmt(e.amount || 0)}</span>
                </div>
              ))}
              {mExp.length > 6 && <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 4 }}>+{mExp.length - 6} more expenses</div>}
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontWeight: 600, fontSize: 13 }}>
                <span>Total overheads</span>
                <span style={{ color: "var(--gold)" }}>{fmt(overhead)}</span>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
