/**
 * QuotesPage.jsx
 * ----------------------------------------------------------------------------
 * Saved quotes; confirm to production.
 * Confirming deducts inventory and creates a production record.
 * Gift/sample orders are logged as a write-off with no revenue.
 * ----------------------------------------------------------------------------
 */
import React, { useState } from "react"
import { Btn, Card, SHead, iSt } from "../common/ui.jsx"
import { fmt, uid } from "../../lib/helpers.js"
import { saveInventory, saveProduction, loadExpenses, saveExpenses, loadCompany, loadQuotes, saveQuotes } from "../../lib/data.js"
import { DEFAULT_MULTS } from "../../constants.js"
import { Invoices } from "./Invoices.jsx"

const QUOTE_STATUSES = [
  { v: "pending", l: "Pending", c: "#BA7517", bg: "#FAEEDA" },
  { v: "approved", l: "Approved", c: "#085041", bg: "#E1F5EE" },
  { v: "confirmed", l: "Confirmed", c: "#2D7A50", bg: "#E5F4EC" },
  { v: "cancelled", l: "Cancelled", c: "#B03A2E", bg: "#FDEBE9" }
]

export function QuotesPage({ inventory, setInventory, recipes, setView, productions, setProductions }) {
  const [quotes, setQuotes] = useState(loadQuotes)
  const [filter, setFilter] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [expanded, setExpanded] = useState(null)

  const updateStatus = (id, status) => {
    const updated = quotes.map(q => q.id === id ? { ...q, status } : q)
    setQuotes(updated)
    saveQuotes(updated)
  }

  const deleteQuote = (id) => {
    if (!confirm("Are you absolutely sure you want to delete this quote? This cannot be undone.")) return
    const updated = quotes.filter(q => q.id !== id)
    setQuotes(updated)
    saveQuotes(updated)
  }

  const getDaysPending = (q) => {
    if (!q.date) return 0
    const created = new Date(q.date)
    const diffTime = Date.now() - created.getTime()
    return Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)))
  }

  const confirmOrder = (q) => {
    // Block if already confirmed
    if (q.status === "confirmed" || q.confirmedAt) {
      alert("This quote is already confirmed and locked.")
      return
    }

    const outOfStock = []
    const lowStock = []
    try {
      const mults = JSON.parse(localStorage.getItem("ll_multipliers") || "null") || DEFAULT_MULTS
      const checkInv = [...inventory]
      if (q.tiers?.length > 0) {
        q.tiers.forEach(tier => {
          const size = String(tier.size).replace(/"/g, "").trim()
          const shape = (tier.shape || "round").toLowerCase()
          const mult = mults[size + "-" + shape] || 1
          tier.layers?.forEach(layer => {
            if (!layer.flavour) return
            const recipe = recipes.find(r => r.name.toLowerCase().includes(layer.flavour.toLowerCase()))
            if (!recipe) return
            recipe.ing?.forEach(ing => {
              const item = checkInv.find(i => i.id === ing.iid)
              if (!item) return
              const needed = ing.qty * mult
              if (item.stock <= 0) {
                if (!outOfStock.find(x => x.name === item.name)) outOfStock.push({ name: item.name, stock: item.stock, unit: item.unit })
              } else if (item.stock < needed) {
                if (!lowStock.find(x => x.name === item.name)) lowStock.push({ name: item.name, stock: item.stock, needed: needed.toFixed(2), unit: item.unit })
              }
            })
          })
        })
      }
    } catch (e) {
      console.error("Stock check error", e)
    }

    // Block if anything is completely out of stock
    if (outOfStock.length > 0) {
      alert("❌ Cannot confirm order — the following ingredients are completely out of stock:\n\n" + outOfStock.map(i => "• " + i.name + " (0 " + i.unit + " remaining)").join("\n") + "\n\nPlease restock before confirming.")
      return
    }

    // Warn if anything is below minimum or needed quantity but allow proceeding
    if (lowStock.length > 0) {
      const proceed = window.confirm("⚠️ Warning — the following ingredients are insufficient for this order:\n\n" + lowStock.map(i => "• " + i.name + " (needed: " + i.needed + " " + i.unit + ", in stock: " + i.stock + " " + i.unit + ")").join("\n") + "\n\nYou can still confirm but please restock soon.\n\nClick OK to confirm anyway, or Cancel to go back.")
      if (!proceed) return
    }

    // Deduct ingredients from inventory
    try {
      const mults = JSON.parse(localStorage.getItem("ll_multipliers") || "null") || DEFAULT_MULTS
      let updInv = [...inventory]
      if (updInv.length > 0 && q.tiers?.length > 0) {
        q.tiers.forEach(tier => {
          const size = String(tier.size).replace(/"/g, "").trim()
          const shape = (tier.shape || "round").toLowerCase()
          const mult = mults[size + "-" + shape] || 1
          tier.layers?.forEach(layer => {
            if (!layer.flavour) return
            const recipe = recipes.find(r => r.name.toLowerCase().includes(layer.flavour.toLowerCase()))
            if (!recipe) return
            recipe.ing?.forEach(ing => {
              const idx = updInv.findIndex(i => i.id === ing.iid)
              if (idx >= 0) {
                updInv[idx] = { ...updInv[idx], stock: Math.max(0, parseFloat((updInv[idx].stock - (ing.qty * mult)).toFixed(3))) }
              }
            })
          })
        })
        setInventory(updInv)
        saveInventory(updInv)
      }
    } catch (e) {
      console.error("Ingredient deduction error", e)
    }

    // Create production record with full details
    const prod = {
      id: uid(),
      quoteId: q.id,
      fromQuote: true,
      client: q.clientName,
      clientPhone: q.clientPhone || "",
      clientEmail: "",
      orderDate: q.date,
      confirmedAt: new Date().toISOString(),
      deliveryDate: q.deliveryDate || "",
      cost: q.totalCost || 0,
      deliveryCost: 0,
      salePrice: q.salePrice || q.quotePrice || 0,
      deliveryCharge: q.deliveryCharge || 0,
      vatAmount: q.vatAmount || 0,
      grandTotal: q.grandTotal || 0,
      status: "pending",
      productType: q.productType || "Cake",
      size: q.tiers?.map(t => t.size + '" ' + t.shape).join(" + ") || "",
      covering: q.tiers?.[0]?.coverings?.[0]?.type || "",
      flavors: q.flavourSummary || "",
      cakeSummary: q.cakeSummary || "",
      tiers: q.tiers || [],
      cakePhoto: q.cakePhoto || null,
      topper: q.topper || null,
      donutGroups: q.donutGroups || [],
      loaves: q.loaves || [],
      tartQty: q.tartQty || 0,
      tartFillings: q.tartFillings || [],
      tartGarnish: q.tartGarnish || "",
      decorations: q.decQty ? Object.keys(q.decQty).join(", ") : "",
      layers: q.tiers?.length || 1,
      accessoryPct: 10,
      profitPct: q.margin || 40,
      paymentType: (q.orderPurpose === "gift" || q.orderPurpose === "sample") ? q.orderPurpose : "full",
      orderPurpose: q.orderPurpose || "sale",
      discountPct: 0,
      notes: q.notes || "",
      recipeId: ""
    }
    setProductions(prev => [prod, ...prev])
    saveProduction(prod)

    // Gift/sample — log the ingredient cost as a write-off expense
    if (q.orderPurpose === "gift" || q.orderPurpose === "sample") {
      const writeOffCost = q.totalCost || 0
      if (writeOffCost > 0) {
        const exp = {
          id: uid(),
          date: q.deliveryDate || new Date().toISOString().slice(0, 10),
          description: (q.orderPurpose === "gift" ? "Gift: " : "Sample/Tasting: ") + (q.cakeSummary || "cake"),
          amount: writeOffCost,
          category: "Gifts & Samples",
          paymentMethod: "none",
          source: "writeoff",
          notes: "Ingredients consumed for " + q.orderPurpose + " — no revenue"
        }
        const updExp = [exp, ...loadExpenses()]
        saveExpenses(updExp)
      }
    }

    // Update quote status to confirmed and mark as confirmed
    const updated = quotes.map(x => x.id === q.id ? { ...x, status: "confirmed", confirmedAt: new Date().toISOString() } : x)
    setQuotes(updated)
    saveQuotes(updated)

    const msg = (q.orderPurpose === "gift" || q.orderPurpose === "sample")
      ? "✓ " + (q.orderPurpose === "gift" ? "Gift" : "Sample") + " logged! Ingredients deducted from inventory and cost recorded as a " + q.orderPurpose + " expense (no revenue)."
      : "✓ Order confirmed for " + q.clientName + "! Ingredients deducted and order added to Production List."
    alert(msg)
  }

  // 1. Search filter
  const searchedQuotes = quotes.filter(q => {
    const name = (q.clientName || "").toLowerCase()
    const invoiceNum = ("INV-" + q.id.slice(-6).toUpperCase()).toLowerCase()
    const query = searchQuery.toLowerCase()
    return name.includes(query) || invoiceNum.includes(query)
  })

  // 2. Tab filter
  const filtered = filter === "all" ? searchedQuotes : searchedQuotes.filter(q => {
    if (filter === "confirmed") return q.status === "confirmed" || !!q.confirmedAt
    return q.status === filter
  })

  // 3. Sort by deliveryDate/date (most recent first)
  const sorted = [...filtered].sort((a, b) => {
    const dateA = a.deliveryDate || a.date || ""
    const dateB = b.deliveryDate || b.date || ""
    return dateB.localeCompare(dateA)
  })

  const pendingCount = quotes.filter(q => q.status === "pending").length

  return (
    <div>
      <SHead title="Quotes" sub="All client quotes — track status and convert approved quotes to production orders" />

      {/* Search Input */}
      <div style={{ marginBottom: 16 }}>
        <input
          type="text"
          placeholder="Search by client name or invoice number..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{ ...iSt, width: "100%", padding: "10px 14px", borderRadius: 8, fontSize: 13.5 }}
        />
      </div>

      {/* Filter Tabs & New Quote button */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[
            { v: "all", l: "All quotes" },
            { v: "pending", l: `Pending (${pendingCount})` },
            { v: "approved", l: "Approved" },
            { v: "confirmed", l: "Confirmed" },
            { v: "cancelled", l: "Cancelled" }
          ].map(f => (
              <button
                key={f.v}
                onClick={() => setFilter(f.v)}
                style={{
                  padding: "6px 10px",
                  border: "none",
                  borderBottom: `2px solid ${filter === f.v ? "var(--gold)" : "transparent"}`,
                  background: "transparent",
                  color: filter === f.v ? "var(--gold)" : "var(--muted)",
                  fontSize: 13,
                  cursor: "pointer",
                  fontWeight: filter === f.v ? 600 : 500,
                  transition: "all 0.2s"
                }}
              >
                {f.l}
              </button>
          ))}
        </div>
        <Btn onClick={() => setView("calculator")}>+ New quote</Btn>
      </div>

      {sorted.length === 0 ? (
        <Card style={{ textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 24, marginBottom: 10 }}>💬</div>
          <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 6 }}>
            {filter === "all" ? "No quotes yet" : "No " + filter + " quotes match your search"}
          </div>
          <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16 }}>Use the Order Calculator to generate a quote for a client.</div>
          <Btn onClick={() => setView("calculator")}>Open Order Calculator</Btn>
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {sorted.map(q => {
            const isConfirmed = q.status === "confirmed" || !!q.confirmedAt
            const currentStatus = isConfirmed ? "confirmed" : (q.status || "pending")
            const st = QUOTE_STATUSES.find(s => s.v === currentStatus) || QUOTE_STATUSES[0]
            const isExp = expanded === q.id
            const daysPending = getDaysPending(q)

            return (
              <Card key={q.id} style={{ padding: 0, overflow: "hidden" }}>
                {/* Header */}
                <div
                  style={{ padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", cursor: "pointer" }}
                  onClick={() => setExpanded(isExp ? null : q.id)}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 15.5, fontWeight: 600 }}>{q.clientName || "Unknown client"}</div>
                      <span style={{ fontSize: 11, padding: "2px 9px", borderRadius: 20, background: st.bg, color: st.c, fontWeight: 600, textTransform: "capitalize" }}>{st.l}</span>
                    </div>
                    <div style={{ fontSize: 12.5, color: "var(--muted)" }}>
                      {q.cakeSummary || "Cake order"} • Due {q.deliveryDate || q.date}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0, marginRight: 8 }}>
                    <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, color: "var(--gold)" }}>{fmt(q.salePrice || q.quotePrice || 0)}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>Cost: {fmt(q.totalCost || 0)}</div>
                  </div>
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>{isExp ? "▲" : "▼"}</span>
                </div>

                {/* Expanded Details */}
                {isExp && (
                  <div style={{ borderTop: "1px solid var(--border)", padding: "16px 18px", background: "#FAF9F5" }}>
                    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
                      <Btn small variant="danger" onClick={() => deleteQuote(q.id)}>Delete Quote</Btn>
                    </div>
                    {/* Days pending alert prompt */}
                    {currentStatus === "pending" && daysPending > 3 && (
                      <div style={{ background: "#FFEBE5", color: "#D12400", border: "1px solid #F0A89E", borderRadius: 8, padding: "8px 12px", fontSize: 12.5, marginBottom: 14, fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
                        ⏳ Pending for {daysPending} days. Follow up with {q.clientName} via WhatsApp or call to finalize!
                      </div>
                    )}

                    {/* Order details block */}
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: .8, fontWeight: 600, marginBottom: 6 }}>Order Details</div>
                      <div style={{ fontSize: 13, lineHeight: 1.8, color: "var(--text)" }}>
                        <div><span style={{ color: "var(--muted)" }}>Phone: </span>{q.clientPhone || "—"}</div>
                        <div><span style={{ color: "var(--muted)" }}>Email: </span>{q.clientEmail || "—"}</div>
                        <div><span style={{ color: "var(--muted)" }}>Delivery date: </span>{q.deliveryDate || "—"}</div>
                        <div><span style={{ color: "var(--muted)" }}>Product: </span>{q.productType || "Cake"}</div>
                        {q.tiers?.map((t, i) => (
                          <div key={i}>
                            <span style={{ color: "var(--muted)" }}>Tier {i + 1}: </span>
                            {t.size}" {t.shape} • {t.layers?.map(l => l.flavour).filter(Boolean).join(", ") || "—"}
                            {t.coverings?.length ? " • " + t.coverings.map(c => c.type).join("+") : ""}
                          </div>
                        ))}
                        {q.accRows?.length > 0 && <div><span style={{ color: "var(--muted)" }}>Boards & Packaging: </span>{q.accRows.map(a => a.name || a.type).join(", ")}</div>}
                        <div><span style={{ color: "var(--muted)" }}>Notes: </span>{q.notes || "—"}</div>
                      </div>
                    </div>

                    {/* Lock message or status update buttons */}
                    {isConfirmed ? (
                      <div style={{ background: "#E5F4EC", border: "1px solid #C2E2D0", borderRadius: 8, padding: "10px 14px", display: "flex", flexDirection: "column", gap: 4, marginBottom: 14 }}>
                        <div style={{ color: "#2D7A50", fontWeight: 700, fontSize: 13 }}>✓ Confirmed on {new Date(q.confirmedAt || q.date).toLocaleString("en-NG")}</div>
                        <div style={{ fontSize: 11.5, color: "var(--muted)" }}>The Edit and Confirm buttons are permanently locked. This protects inventory count accuracy.</div>
                      </div>
                    ) : (
                      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
                        <span style={{ fontSize: 12.5, color: "var(--muted)", fontWeight: 500 }}>Update status:</span>
                        {QUOTE_STATUSES.filter(s => s.v !== "confirmed").map(s => (
                          <button
                            key={s.v}
                            onClick={() => updateStatus(q.id, s.v)}
                            style={{
                              padding: "6px 12px",
                              borderRadius: 6,
                              border: q.status === s.v ? `2px solid ${s.c}` : "1px solid var(--border)",
                              background: q.status === s.v ? s.bg : "#fff",
                              color: s.c,
                              fontSize: 12,
                              cursor: "pointer",
                              fontWeight: q.status === s.v ? 600 : 400,
                              fontFamily: "inherit",
                              transition: "all 0.15s ease"
                            }}
                          >
                            {s.l}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Action buttons with Delete separated */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", flexWrap: "wrap", gap: 12, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                        {isConfirmed ? null : (
                          <>
                            {q.status === "approved" && <Btn small variant="success" onClick={() => confirmOrder(q)}>✓ Confirm order</Btn>}
                            <Btn small variant="ghost" onClick={() => { localStorage.setItem("ll_calc_edit", JSON.stringify(q)); setView("calculator") }}>✏ Edit quote</Btn>
                          </>
                        )}
                        <button
                          onClick={() => {
                            // Build and show invoice
                            const co = loadCompany()
                            const trs = q.tiers || []
                            const invoiceNum = "INV-" + q.id.slice(-6).toUpperCase()
                            const tmpl = co.invoiceTemplate || "classic"
                            const gold = co.primaryColor || "#C8912A"
                            // Template-specific styles
                            const tmplStyles = {
                              classic: `body{font-family:Arial,sans-serif}.header{border-bottom:3px solid ${gold};padding-bottom:16px;margin-bottom:24px}.inv-badge{background:#F5F0E4;padding:8px 14px;border-radius:6px;display:inline-block}`,
                              modern: `body{font-family:'Helvetica Neue',Arial,sans-serif}.header{background:${gold};color:#fff;padding:24px;margin:-36px -36px 24px;border-radius:0}.header .cn{color:#fff!important}.header .sub{color:rgba(255,255,255,0.8)}.inv-badge{background:rgba(255,255,255,0.2);padding:8px 14px;border-radius:6px;display:inline-block;color:#fff}`,
                              minimal: `body{font-family:'Helvetica Neue',Arial,sans-serif;color:#333}.header{margin-bottom:32px;border-bottom:1px solid #eee;padding-bottom:16px}.tier{border-left:2px solid ${gold}!important}.inv-badge{font-size:11px;color:#888;letter-spacing:2px;text-transform:uppercase}`,
                              elegant: `body{font-family:Georgia,serif;color:#2a1a0a}.header{text-align:center;border-bottom:1px solid ${gold};padding-bottom:20px;margin-bottom:28px}.cn{font-family:'Playfair Display',Georgia,serif!important;font-size:26px!important}.inv-badge{border:1px solid ${gold};padding:6px 16px;border-radius:0;display:inline-block;font-style:italic;color:${gold};font-size:12px}`,
                              bold: `body{font-family:Arial,sans-serif}.header{background:#1a1a1a;color:#fff;padding:24px 28px;margin:-36px -36px 24px}.header .cn{color:${gold}!important;font-size:26px!important}.header .sub{color:#aaa}.inv-badge{background:${gold};color:#fff;padding:8px 16px;border-radius:4px;display:inline-block;font-weight:bold}`,
                            }[tmpl] || ""
                            const html = "<!DOCTYPE html><html><head><title>" + invoiceNum + "</title>"
                              + "<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;color:#291608;padding:36px;max-width:680px;margin:0 auto}"
                              + "h1{font-size:24px;font-weight:700;color:" + gold + "}.sub{font-size:12px;color:#888;margin-bottom:20px}"
                              + ".row{display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #F0EBE3;font-size:13px}"
                              + ".tier{background:#FFF9EE;border-left:3px solid " + gold + ";padding:10px 12px;margin-bottom:8px;border-radius:0 6px 6px 0}"
                              + ".price-box{background:#F5F0E4;border-radius:8px;padding:16px;text-align:center;margin:20px 0}"
                              + ".bank{background:#E8EFFC;border-radius:8px;padding:14px;margin:16px 0}"
                              + ".terms{font-size:11px;color:#888;margin-top:16px;line-height:1.8;border-top:1px solid #E0D3BB;padding-top:12px}"
                              + "@media print{.no-print{display:none}}"
                              + tmplStyles
                              + "</style></head><body>"
                              + "<div id='invoice-body' style='background:#fff;padding:8px'>"
                              + "<div style='display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px'>"
                              + "<div><h1>" + (co.name || "Fayvouree Cakes") + "</h1>"
                              + "<div class='sub'>" + (co.address || "") + (co.phone ? " · " + co.phone : "") + (co.email ? " · " + co.email : "") + "</div></div>"
                              + "<div style='text-align:right'><div style='font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px'>Invoice</div>"
                              + "<div style='font-size:20px;font-weight:700;color:" + gold + "'>" + invoiceNum + "</div>"
                              + "<div style='font-size:12px;color:#888'>Date: " + q.date + "</div></div></div>"
                              + "<div style='margin-bottom:18px;padding:12px 14px;background:#F5F0E4;border-radius:8px'>"
                              + "<div style='font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px'>Bill to</div>"
                              + "<div style='font-size:15px;font-weight:700'>" + q.clientName + "</div>"
                              + (q.clientPhone ? "<div style='font-size:13px;color:#555;margin-top:2px'>" + q.clientPhone + "</div>" : "")
                              + (q.deliveryDate ? "<div style='font-size:13px;color:#555;margin-top:2px'>Delivery / Collection: " + q.deliveryDate + "</div>" : "")
                              + "</div>"
                              + "<div style='margin-bottom:18px'>"
                              + "<div style='font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid " + gold + ";padding-bottom:4px;margin-bottom:10px'>Order details</div>"
                              // Cake/Cupcake tiers
                              + ((!q.productType || q.productType === "Cake" || q.productType === "Cupcakes")
                                ? trs.map((t, i) => "<div class='tier'><strong>Tier " + (i + 1) + " — " + t.size + "\" " + (t.shape || "") + "</strong>"
                                  + "<div style='font-size:12px;color:#555;margin-top:4px;line-height:1.8'>"
                                  + "Flavours: " + (t.layers?.map(l => l.flavour).filter(Boolean).join(", ") || "—") + "<br>"
                                  + (t.fillings?.length ? "Filling: " + t.fillings.map(f => f.type + (f.grams ? " (" + f.grams + "g)" : "")).join(", ") + "<br>" : "")
                                  + "Covering: " + (t.coverings?.map(c => c.type).join(" + ") || t.covering || "—")
                                  + "</div></div>").join("")
                                : "")
                              // Donuts
                              + (q.productType === "Donuts"
                                ? (q.donutGroups || []).map((g, i) => "<div class='tier'><strong>Group " + (i + 1) + ": " + g.qty + donuts + "</strong>"
                                  + "<div style='font-size:12px;color:#555;margin-top:4px;line-height:1.8'>"
                                  + "Base: " + (g.flavour || "—") + (g.filling ? "<br>Filling: " + g.filling + (g.fillingGrams ? " (" + g.fillingGrams + "g)" : "") : "")
                                  + "</div></div>").join("")
                                : "")
                              // Cake Loaf
                              + (q.productType === "Cake Loaf"
                                ? "<div class='tier'><strong>" + (q.loaves?.length || 0) + " Cake Loaves</strong>"
                                  + "<div style='font-size:12px;color:#555;margin-top:4px;line-height:1.8'>"
                                  + (q.loaves || []).map((l, i) => "Loaf " + (i + 1) + ": " + (l.flavour || "?")).join("<br>")
                                  + "</div></div>"
                                : "")
                              // Tarts/Pastry
                              + (q.productType === "Tarts / Pastry"
                                ? "<div class='tier'><strong>" + (q.tartQty || 0) + " Tart Shells</strong>"
                                  + "<div style='font-size:12px;color:#555;margin-top:4px;line-height:1.8'>"
                                  + (q.tartFillings || []).filter(f => f.type).map(f => f.type + (f.grams ? " (" + f.grams + "g)" : "")).join("<br>")
                                  + (q.tartGarnish ? "<br>Garnish: " + q.tartGarnish : "")
                                  + "</div></div>"
                                : "")
                              + (q.accRows?.length ? "<div class='row'><span>Boards & accessories</span><span>" + q.accRows.map(a => a.name || a.type).join(", ") + "</span></div>" : "")
                              + (q.topper?.enabled ? "<div class='row'><span>Custom topper</span><span>" + (q.topper.description || "Yes") + "</span></div>" : "")
                              + (q.notes ? "<div class='row'><span>Special requests</span><span>" + q.notes + "</span></div>" : "")
                              + "</div>"
                              + ((q.deliveryCharge > 0 || q.vatAmount > 0) ? "<div style='margin:16px 0;padding:14px 16px;background:#FAF7F0;border-radius:10px'>"
                                + "<div class='row'><span>Cake price</span><span>&#8358;" + ((q.salePrice || q.quotePrice || 0).toLocaleString()) + "</span></div>"
                                + (q.deliveryCharge > 0 ? "<div class='row'><span>Delivery</span><span>&#8358;" + (q.deliveryCharge.toLocaleString()) + "</span></div>" : "")
                                + (q.vatAmount > 0 ? "<div class='row'><span>VAT (" + (q.vatRate || 7.5) + "%)</span><span>&#8358;" + (q.vatAmount.toLocaleString()) + "</span></div>" : "")
                                + "</div>" : "")
                              + "<div class='price-box'>"
                              + "<div style='font-size:12px;color:#888;margin-bottom:4px;text-transform:uppercase;letter-spacing:1px'>Total amount</div>"
                              + "<div style='font-size:32px;font-weight:700;color:" + gold + "'>&#8358;" + ((q.grandTotal || ((q.salePrice || q.quotePrice || 0) + (q.deliveryCharge || 0) + (q.vatAmount || 0))).toLocaleString()) + "</div>"
                              + "</div>"
                              + (co.bankName ? "<div class='bank'><div style='font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;font-weight:600;margin-bottom:8px'>Payment details</div>"
                                + "<div class='row'><span>Bank</span><span><strong>" + co.bankName + "</strong></span></div>"
                                + "<div class='row'><span>Account number</span><span><strong>" + co.bankAccount + "</strong></span></div>"
                                + "<div class='row'><span>Account name</span><span>" + co.bankAccountName + "</span></div></div>" : "")
                              + "<div class='terms'><strong>Terms & Conditions:</strong><br>"
                              + "&bull; A 50% non-refundable deposit is required to confirm your order.<br>"
                              + "&bull; Balance to be paid on or before collection/delivery.<br>"
                              + "&bull; Cake design may slightly differ from inspiration photos.<br>"
                              + (co.termsAndConditions ? "&bull; " + co.termsAndConditions + "<br>" : "")
                              + "</div>"
                              + "</div>"
                              + "<div class='no-print' style='margin-top:24px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap'>"
                              + "<button id='shareBtn' style='padding:11px 22px;background:#25D366;color:#fff;border:none;border-radius:8px;font-size:14px;cursor:pointer;font-weight:600'>📤 Share Invoice</button>"
                              + "<button onclick='window.print()' style='padding:11px 22px;background:" + gold + ";color:#fff;border:none;border-radius:8px;font-size:14px;cursor:pointer;font-weight:600'>💾 Save as PDF</button>"
                              + "</div>"
                              + "<div class='no-print' id='shareHelp' style='margin-top:12px;font-size:12px;color:#666;text-align:center;line-height:1.7;max-width:440px;margin-left:auto;margin-right:auto'>Tap <b>Share Invoice</b> to send the PDF to WhatsApp, email or anywhere.</div>"
                              + "<div style='margin-top:16px;font-size:11px;color:#aaa;text-align:center'>" + (co.name || "Fayvouree Cakes") + " &nbsp;·&nbsp; Generated by LayerLedger</div>"
                              + "<scr" + "ipt src='https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'></scr" + "ipt>"
                              + "<scr" + "ipt src='https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'></scr" + "ipt>"
                              + "<scr" + "ipt>"
                              + "var INV_NUM='" + invoiceNum + "';"
                              + "var CLIENT='" + (q.clientName || '').replace(/'/g, '') + "';"
                              + "var PHONE='" + ((q.clientPhone || '').replace(/[^0-9]/g, '').replace(/^0/, '234')) + "';"
                              + "var AMT='" + ((q.grandTotal || ((q.salePrice || q.quotePrice || 0) + (q.deliveryCharge || 0) + (q.vatAmount || 0))).toLocaleString()) + "';"
                              + "var BIZ='" + (co.name || 'Fayvouree Cakes').replace(/'/g, '') + "';"
                              + "async function makePDF(){var el=document.getElementById('invoice-body');var canvas=await html2canvas(el,{scale:2,backgroundColor:'#ffffff',useCORS:true});var img=canvas.toDataURL('image/jpeg',0.92);var pdf=new jspdf.jsPDF('p','mm','a4');var pw=pdf.internal.pageSize.getWidth();var ph=pdf.internal.pageSize.getHeight();var imgH=canvas.height*pw/canvas.width;pdf.addImage(img,'JPEG',0,0,pw,imgH);var left=imgH-ph;while(left>0){pdf.addPage();pdf.addImage(img,'JPEG',0,left-imgH,pw,imgH);left-=ph;}return pdf;}"
                              + "document.getElementById('shareBtn').onclick=async function(){var btn=this;btn.textContent='Preparing...';btn.disabled=true;try{var pdf=await makePDF();var blob=pdf.output('blob');var file=new File([blob],INV_NUM+'.pdf',{type:'application/pdf'});var msg='Hello '+CLIENT+'! Your invoice '+INV_NUM+' for ₦'+AMT+' is attached. Thank you for choosing '+BIZ+'!';if(navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({files:[file],title:INV_NUM,text:msg});btn.textContent='✓ Shared';}else{pdf.save(INV_NUM+'.pdf');var wa=PHONE?('https://wa.me/'+PHONE+'?text='+encodeURIComponent(msg)):('https://wa.me/?text='+encodeURIComponent(msg));window.open(wa,'_blank');document.getElementById('shareHelp').innerHTML='PDF downloaded and WhatsApp opened. Attach the downloaded PDF in the chat.';btn.textContent='📤 Share Invoice';btn.disabled=false;}}catch(e){if(e.name!=='AbortError'){document.getElementById('shareHelp').innerHTML='Could not auto-share. Tap Save as PDF then attach it in WhatsApp.';}btn.textContent='📤 Share Invoice';btn.disabled=false;}};"
                              + "setTimeout(function(){window.print()},700);"
                              + "</scr" + "ipt>"
                              + "</body></html>"
                            const w = window.open("", "_blank")
                            w.document.write(html)
                            w.document.close()
                            // Auto-save invoice to Invoices page
                            const savedInv = { id: invoiceNum, quoteId: q.id, clientName: q.clientName, clientPhone: q.clientPhone || "", date: q.date, deliveryDate: q.deliveryDate || "", amount: q.grandTotal || ((q.salePrice || q.quotePrice || 0) + (q.deliveryCharge || 0) + (q.vatAmount || 0)), cakeAmount: q.salePrice || q.quotePrice || 0, deliveryCharge: q.deliveryCharge || 0, vatAmount: q.vatAmount || 0, vatRate: q.vatRate || 0, productType: q.productType || "Cake", cakeSummary: q.cakeSummary || "", notes: q.notes || "", status: "unpaid", bankName: co.bankName || "", bankAccount: co.bankAccount || "", bankAccountName: co.bankAccountName || "", businessName: co.name || "Fayvouree Cakes" }
                            const existing = JSON.parse(localStorage.getItem("ll_quote_invoices") || "[]")
                            if (!existing.find(i => i.id === invoiceNum)) { localStorage.setItem("ll_quote_invoices", JSON.stringify([savedInv, ...existing])) }
                          }}
                          style={{ padding: "5px 14px", borderRadius: 8, border: "none", background: "#1D9E75", color: "#fff", fontSize: 12, cursor: "pointer", fontFamily: "inherit", fontWeight: 500 }}
                        >
                          🧾 Convert to invoice
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
