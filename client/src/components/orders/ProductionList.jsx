/**
 * ProductionList.jsx
 * ----------------------------------------------------------------------------
 * Weekly production schedule.
 * Lists orders due, grouped by week, with delivered status.
 * Also shows unscheduled orders.
 * ----------------------------------------------------------------------------
 */
import React, { useState } from "react"
import { Btn, Card, SHead, Tabs } from "../common/ui.jsx"
import { updateProdStatus } from "../../lib/data.js"
import { Printer, Cake, Calendar, PenLine, FileText } from "lucide-react"

export function ProductionList({ productions, setProductions, company, setView }) {
  const [activeTab, setActiveTab] = useState("schedule") // "schedule" or "unscheduled"
  const [weekOffset, setWeekOffset] = useState(0)

  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)

  // Calculate start (Monday) and end (Sunday) of current offset week
  const startOfWeek = new Date(today)
  startOfWeek.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1)) // Adjust for Monday start
  startOfWeek.setHours(0, 0, 0, 0)
  
  const ws = new Date(startOfWeek)
  ws.setDate(startOfWeek.getDate() + weekOffset * 7)
  const wsStr = ws.toISOString().slice(0, 10)

  const we = new Date(ws)
  we.setDate(ws.getDate() + 6)
  we.setHours(23, 59, 59, 999)
  const weStr = we.toISOString().slice(0, 10)

  const fmt2 = d => new Date(d).toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short" })
  const weekLabel = `${fmt2(ws)} — ${fmt2(we)}`

  // Resolve all delivery dates for an order
  const getOrderDates = (p) => {
    if (p.items && p.items.length > 0) {
      const dates = p.items.map((it, idx) => {
        if (idx === 0 || !it.sameDeliveryAsFirst) return it.deliveryDate || p.deliveryDate
        return p.items[0]?.deliveryDate || p.deliveryDate
      }).filter(Boolean)
      if (dates.length > 0) return dates
    }
    return p.deliveryDate ? [p.deliveryDate] : []
  }

  // Filter weekly orders (surfaces if ANY item is due this week)
  const weekProds = productions.filter(p => {
    const dates = getOrderDates(p)
    if (dates.length === 0) return false
    return dates.some(d => d >= wsStr && d <= weStr) && (p.status || "").toLowerCase() !== "cancelled"
  }).sort((a, b) => {
    const minA = getOrderDates(a)[0] || a.deliveryDate || ""
    const minB = getOrderDates(b)[0] || b.deliveryDate || ""
    return minA.localeCompare(minB)
  })

  // Filter unscheduled orders (confirmed but no delivery date set on any item)
  const unscheduledProds = productions.filter(p => {
    const dates = getOrderDates(p)
    return dates.length === 0 && (p.status || "").toLowerCase() !== "cancelled"
  })

  // Status mappings
  const statusColor = { pending: "#FAEEDA", "in progress": "#E8EFFC", ready: "#E5F4EC", delivered: "#F5F5F5" }
  const statusTextColors = { pending: "#BA7517", "in progress": "#378ADD", ready: "#2D7A50", delivered: "#666" }

  const handleStatusChange = async (id, s) => {
    await updateProdStatus(id, s)
    setProductions(prev => prev.map(p => p.id === id ? { ...p, status: s } : p))
  }

  // Calculate weekly summary metrics
  const totalOrdersThisWeek = weekProds.length
  const pendingOrders = weekProds.filter(p => (p.status || "pending") === "pending" || (p.status || "").toLowerCase() === "in progress").length
  const readyOrders = weekProds.filter(p => (p.status || "").toLowerCase() === "ready").length
  const nextDeliveryDate = weekProds.find(p => p.deliveryDate >= todayStr && (p.status || "").toLowerCase() !== "delivered")?.deliveryDate || "No more deliveries due"

  // Ink-saving printer layout handler
  const print = () => {
    const listToPrint = activeTab === "schedule" ? weekProds : unscheduledProds
    const titleLabel = activeTab === "schedule" ? `Baking Production List: ${weekLabel}` : "Unscheduled Baking Production List"
    
    const w = window.open("", "_blank")
    w.document.write(`<!DOCTYPE html><html><head><title>${titleLabel}</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: "Courier New", Arial, sans-serif; color: #000; padding: 30px; font-size: 13px; line-height: 1.5; }
      .header { border-bottom: 2px double #000; padding-bottom: 12px; margin-bottom: 24px; text-align: center; }
      .company-name { font-size: 22px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; }
      .week-dates { font-size: 14px; margin-top: 4px; font-style: italic; }
      .card { border: 1px solid #000; padding: 16px; margin-bottom: 20px; page-break-inside: avoid; }
      .card-header { display: flex; justify-content: space-between; border-bottom: 1px solid #000; padding-bottom: 8px; margin-bottom: 10px; font-weight: bold; font-size: 14px; }
      .tier-box { border-left: 3px solid #000; padding-left: 10px; margin-bottom: 8px; margin-top: 6px; }
      .highlight-box { border: 1px dashed #000; padding: 8px 10px; margin-top: 8px; }
      .highlight-title { font-weight: bold; text-decoration: underline; margin-bottom: 2px; }
      @media print {
        button { display: none; }
        body { padding: 0; }
      }
    </style></head><body>
      <div class="header">
        <div class="company-name">${company?.name || "BakeWealth"}</div>
        <div class="week-dates">${titleLabel}</div>
      </div>
      
      ${listToPrint.map((p, i) => {
        const isCake = !p.productType || p.productType === "Cake" || p.productType === "Cupcakes"
        const isDonuts = p.productType === "Donuts"
        const isLoaf = p.productType === "Cake Loaf"
        const isTart = p.productType === "Tarts / Pastry"
        
        return `
        <div class="card">
          <div class="card-header">
            <span>#${i + 1} - ${p.client || "Client name"} (${p.productType || "Cake"})</span>
            <span>Date: ${p.deliveryDate || "Unscheduled"}${p.collectionTime ? ` @ ${p.collectionTime}` : ""} | Status: ${(p.status || "Pending").toUpperCase()}</span>
          </div>

          ${p.items && p.items.length > 0 ? p.items.map((it, idx) => {
            const delivText = it.deliveryDetailsText || (it.sameDeliveryAsFirst ? `Same as above (${p.items[0]?.deliveryDate || p.deliveryDate || ""})` : (it.deliveryDate ? `${it.deliveryDate}${it.collectionTime ? " @ " + it.collectionTime : ""}` : (p.deliveryDate || "Date not set")))
            return `
              <div style="border-left: 3px solid #000; padding-left: 10px; margin-bottom: 10px; margin-top: 8px;">
                <div style="display: flex; justify-content: space-between; font-weight: bold;">
                  <span>${it.type === "cake" ? "🎂 " : "🍩 "}${it.name || `Item ${idx + 1}`}</span>
                  <span>Delivery: ${delivText}</span>
                </div>
                ${it.type === "cake" ? (it.tiers || []).map((t, ti) => `
                  <div style="margin-top: 3px;">
                    Cake ${ti + 1}: ${t.size}" ${t.shape || "Round"} | Layers: ${t.layers?.map(l => (l.qty > 1 ? l.qty + "× " : "") + l.flavour).filter(Boolean).join(", ") || "—"}
                    ${t.fillings?.length ? `| Fillings: ${t.fillings.map(f => `${f.type} (${f.grams || 0}g)`).join(", ")}` : ""}
                    ${t.coverings?.length ? `| Covering: ${t.coverings.map(c => `${c.type} (${c.grams || 0}g)`).join(", ")}` : ""}
                  </div>
                `).join("") : (it.pastryItems || []).map(pItem => `
                  <div>${pItem.qty}× ${pItem.flavour || "Pastry"}${pItem.filling ? ` (${pItem.filling})` : ""}</div>
                `).join("")}
                ${it.itemNote ? `<div style="font-size: 11px; font-style: italic; margin-top: 2px;">Note: ${it.itemNote}</div>` : ""}
              </div>
            `
          }).join("") : `
          <!-- Cake details -->
          ${isCake && p.tiers?.length > 0 ? p.tiers.map((t, ti) => `
            <div class="tier-box">
              <strong>Cake ${ti + 1}: ${t.size}" ${t.shape || "round"}</strong><br/>
              Layers: ${t.layers?.map(l => (l.qty > 1 ? l.qty + "× " : "") + l.flavour).filter(Boolean).join(", ") || "—"}<br/>
              ${t.fillings?.length ? `Fillings: ${t.fillings.map(f => `${f.type} (${f.grams || 0}g)`).join(", ")}<br/>` : ""}
              ${t.coverings?.length ? `Covering: ${t.coverings.map(c => `${c.type} (${c.grams || 0}g)`).join(", ")}` : ""}
            </div>
          `).join("") : ""}
          `}
          
          <!-- Donuts details -->
          ${isDonuts && p.donutGroups?.length > 0 ? p.donutGroups.map(g => `
            <div style="margin-bottom: 6px;">
              <strong>${g.qty} × ${g.flavour || "Plain"} Donuts</strong>
              ${g.filling ? `| Filling: ${g.filling} (${g.fillingGrams || 0}g)` : ""}
            </div>
          `).join("") : ""}

          <!-- Loaf details -->
          ${isLoaf && p.loaves?.length > 0 ? p.loaves.map((l, li) => `
            <div><strong>Loaf ${li + 1}:</strong> ${l.flavour || "Classic"}</div>
          `).join("") : ""}

          <!-- Tarts details -->
          ${isTart ? `
            <div>
              <strong>${p.tartQty || 0} Tart Shells</strong><br/>
              ${p.tartFillings?.filter(f => f.type).map(f => `Filling: ${f.type} (${f.grams || 0}g)`).join(", ") || ""}<br/>
              ${p.tartGarnish ? `Garnish: ${p.tartGarnish}` : ""}
            </div>
          ` : ""}
          
          <!-- Topper / Inscription -->
          ${p.topper?.enabled && p.topper?.description ? `
            <div class="highlight-box">
              <div class="highlight-title">Topper & Inscription:</div>
              <div>${p.topper.description}</div>
            </div>
          ` : ""}
          
          <!-- Design Notes -->
          ${p.notes ? `
            <div class="highlight-box">
              <div class="highlight-title">Design Notes:</div>
              <div>${p.notes}</div>
            </div>
          ` : ""}
        </div>
        `
      }).join("")}
      
      ${listToPrint.length === 0 ? "<p style='text-align:center;font-size:14px;margin-top:40px;'>No orders to display.</p>" : ""}
      
      <script>window.print()<\/script>
    </body></html>`)
    w.document.close()
  }

  return (
    <div>
      <SHead title="Production List" sub="Weekly work order — what needs to be baked and when in the kitchen" />

      {/* Tabs */}
      <div style={{ marginBottom: 16 }}>
        <Tabs
          tabs={[
            { v: "schedule", l: "Weekly Schedule" },
            { v: "unscheduled", l: `Unscheduled Orders (${unscheduledProds.length})` }
          ]}
          active={activeTab}
          onChange={setActiveTab}
        />
      </div>

      {/* Summary line at the top (only for Weekly Schedule tab) */}
      {activeTab === "schedule" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12, marginBottom: 16 }}>
          {[
            { label: "Baking orders", val: totalOrdersThisWeek, sub: "Total due this week" },
            { label: "Pending", val: pendingOrders, sub: "Waiting or baking" },
            { label: "Ready", val: readyOrders, sub: "Baked & boxed" },
            { label: "Next delivery", val: nextDeliveryDate, sub: "Upcoming delivery" }
          ].map(m => (
            <Card key={m.label} style={{ padding: "10px 14px" }}>
              <div style={{ fontSize: 9, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 600, marginBottom: 3 }}>{m.label}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>{m.val}</div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{m.sub}</div>
            </Card>
          ))}
        </div>
      )}

      {/* Navigation for Schedule */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        {activeTab === "schedule" ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Btn small variant="ghost" onClick={() => setWeekOffset(w => w - 1)}>← Prev week</Btn>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", minWidth: 200, textAlign: "center" }}>{weekLabel}</div>
            <Btn small variant="ghost" onClick={() => setWeekOffset(w => w + 1)}>Next week →</Btn>
            {weekOffset !== 0 && <Btn small variant="outline" onClick={() => setWeekOffset(0)}>This week</Btn>}
          </div>
        ) : (
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>Orders with no scheduled delivery date</div>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <Btn small onClick={print} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <Printer size={13} /> Print list (ink saver)
          </Btn>
        </div>
      </div>

      {/* List content */}
      {((activeTab === "schedule" ? weekProds : unscheduledProds).length === 0) ? (
        <Card style={{ textAlign: "center", padding: 40 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 10, color: "var(--muted)" }}>
            <Cake size={32} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 500, color: "var(--text)", marginBottom: 6 }}>
            {activeTab === "schedule" ? "No scheduled orders this week" : "No unscheduled orders"}
          </div>
          <div style={{ fontSize: 13, color: "var(--muted)" }}>
            {activeTab === "schedule" ? `Nothing due between ${fmt2(ws)} and ${fmt2(we)}.` : "All confirmed orders have delivery dates."}
          </div>
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {(activeTab === "schedule" ? weekProds : unscheduledProds).map((p, i) => {
            const st = p.status || "pending"
            const isCake = !p.productType || p.productType === "Cake" || p.productType === "Cupcakes" || p.productType === "Cake & Pastry"
            const isDonuts = p.productType === "Donuts"
            const isLoaf = p.productType === "Cake Loaf"
            const isTart = p.productType === "Tarts / Pastry"

            return (
              <Card key={p.id} style={{ borderLeft: `5px solid ${statusTextColors[st.toLowerCase()] || "var(--gold)"}`, padding: "16px 18px", background: "var(--panel)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
                      <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 600, color: "var(--text)" }}>{p.client || "Unknown client"}</span>
                      <span style={{ fontSize: 11, background: "#FAF7F0", border: "1px solid var(--border)", color: "var(--muted)", padding: "2px 8px", borderRadius: 4, fontWeight: 500 }}>{p.productType || "Cake"}</span>
                      <span style={{ fontSize: 11, background: "#FAF7F0", border: "1px solid var(--border)", color: "var(--muted)", padding: "2px 8px", borderRadius: 4, fontWeight: 500 }}>Order {i + 1} of {(activeTab === "schedule" ? weekProds : unscheduledProds).length}</span>
                    </div>

                    {/* Multi-Item Display in Production */}
                    {p.items && p.items.length > 0 ? (
                      <div style={{ marginBottom: 12 }}>
                        {p.items.map((it, idx) => {
                          const itPhotos = (it.photos && it.photos.length > 0) ? it.photos : (it.photo ? [it.photo] : [])
                          const delivText = it.deliveryDetailsText || (it.sameDeliveryAsFirst ? `Same as above (${p.items[0]?.deliveryDate || p.deliveryDate || ""})` : (it.deliveryDate ? `${it.deliveryDate}${it.collectionTime ? " @ " + it.collectionTime : ""}` : (p.deliveryDate || "Date not set")))

                          return (
                            <div key={it.id || idx} style={{ background: "#FDFBF7", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px", marginBottom: 10 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
                                <span style={{ fontWeight: 700, fontSize: 13.5, color: "var(--gold)" }}>
                                  {it.type === "cake" ? "🎂 " : "🍩 "}{it.name || `Item ${idx + 1}`}
                                </span>
                                <span style={{ fontSize: 11, background: it.sameDeliveryAsFirst ? "#F5F0E4" : (it.deliveryDate ? "#EBF7F0" : "#FAF6EC"), color: it.sameDeliveryAsFirst ? "var(--charcoal-soft, #6B6151)" : (it.deliveryDate ? "#1E6B37" : "var(--muted)"), border: "1px solid " + (it.deliveryDate ? "#C2E0CF" : "var(--border)"), borderRadius: 12, padding: "2px 8px", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 3 }}>
                                  <Calendar size={10} /> {delivText}
                                </span>
                              </div>

                              {/* Inspiration Photos for this Item */}
                              {itPhotos.length > 0 && (
                                <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 6, marginBottom: 8 }}>
                                  {itPhotos.map((ph, phi) => (
                                    <div key={phi} style={{ width: 85, height: 85, flexShrink: 0, borderRadius: 6, overflow: "hidden", border: "1px solid var(--border)", position: "relative" }}>
                                      <img src={ph} alt={`Inspiration ${phi + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Cake Specs */}
                              {it.type === "cake" ? (
                                (it.tiers || []).map((tier, ti) => {
                                  const tierPhotos = (tier.photos && tier.photos.length > 0) ? tier.photos : (tier.photo ? [tier.photo] : [])
                                  return (
                                    <div key={ti} style={{ fontSize: 12.5, lineHeight: 1.6, marginTop: 6, paddingTop: ti > 0 ? 6 : 0, borderTop: ti > 0 ? "1px dashed #EDE5D6" : "none" }}>
                                      <div style={{ fontWeight: 600, color: "var(--text)" }}>Cake {ti + 1} — {tier.size}" {tier.shape}</div>
                                      {tierPhotos.length > 0 && (
                                        <div style={{ display: "flex", gap: 6, margin: "4px 0 6px", flexWrap: "wrap" }}>
                                          {tierPhotos.map((tph, tphi) => (
                                            <div key={tphi} style={{ width: 70, height: 70, flexShrink: 0, borderRadius: 6, overflow: "hidden", border: "1px solid var(--border)" }}>
                                              <img src={tph} alt={`Cake ${ti + 1} design`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                      <div style={{ display: "flex", gap: 6 }}>
                                        <span style={{ color: "var(--muted)", minWidth: 50, fontSize: 11.5 }}>Layers:</span>
                                        <span>{tier.layers?.map(l => (l.qty > 1 ? l.qty + "× " : "") + (l.flavour || "—")).join(", ")}</span>
                                      </div>
                                      {tier.fillings?.length > 0 && (
                                        <div style={{ display: "flex", gap: 6 }}>
                                          <span style={{ color: "var(--muted)", minWidth: 50, fontSize: 11.5 }}>Fillings:</span>
                                          <span>{tier.fillings.map(f => `${f.type} (${f.grams}g)`).join(", ")}</span>
                                        </div>
                                      )}
                                      {tier.coverings?.length > 0 && (
                                        <div style={{ display: "flex", gap: 6 }}>
                                          <span style={{ color: "var(--muted)", minWidth: 50, fontSize: 11.5 }}>Coverings:</span>
                                          <span>{tier.coverings.map(c => `${c.type} (${c.grams}g)`).join(", ")}</span>
                                        </div>
                                      )}
                                    </div>
                                  )
                                })
                              ) : (
                                (it.pastryItems || []).map((pItem, pi) => (
                                  <div key={pi} style={{ fontSize: 12.5 }}>
                                    {pItem.qty}× {pItem.flavour || "Pastry"}{pItem.filling ? ` (${pItem.filling})` : ""}
                                  </div>
                                ))
                              )}
                              {it.itemNote && (
                                <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 4 }}>
                                  Note: {it.itemNote}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <>
                        {/* Design photo gallery */}
                        {p.cakePhotos && p.cakePhotos.length > 0 ? (
                          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 6, marginBottom: 12 }}>
                            {p.cakePhotos.map((ph, phi) => (
                              <div key={phi} style={{ width: 140, height: 140, flexShrink: 0, borderRadius: 8, overflow: "hidden", border: "1px solid var(--border)", position: "relative" }}>
                                <img src={ph} alt={`Design ${phi + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                                <span style={{ position: "absolute", bottom: 4, left: 4, background: "rgba(0,0,0,0.65)", color: "#fff", fontSize: 9.5, padding: "1px 5px", borderRadius: 4 }}>
                                  #{phi + 1}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : p.cakePhoto ? (
                          <div style={{ marginBottom: 12, borderRadius: 8, overflow: "hidden", border: "1px solid var(--border)" }}>
                            <img src={p.cakePhoto} alt="Design" style={{ width: "100%", maxHeight: 320, objectFit: "cover", display: "block" }} />
                          </div>
                        ) : null}

                        {/* Cake details */}
                        {isCake && p.tiers?.length > 0 && (
                          <div style={{ marginBottom: 8 }}>
                            {p.tiers.map((tier, ti) => (
                              <div key={ti} style={{ background: "#FDFBF7", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px", marginBottom: 6, fontSize: 13 }}>
                                <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 6, color: "var(--text)" }}>Cake {ti + 1} — {tier.size} {tier.shape}</div>
                                {tier.layers?.map((l, li) => (
                                  <div key={li} style={{ display: "flex", gap: 8, marginBottom: 3 }}>
                                    <span style={{ color: "var(--muted)", minWidth: 60, fontSize: 12 }}>Layer {li + 1}:</span>
                                    <span style={{ fontWeight: 500 }}>{(l.qty > 1 ? l.qty + "× " : "") + (l.flavour || "—")}</span>
                                  </div>
                                ))}
                                {tier.fillings?.length > 0 && (
                                  <div style={{ marginTop: 4, paddingTop: 4, borderTop: "1px solid var(--border)" }}>
                                    {tier.fillings.map((f, fi) => (
                                      <div key={fi} style={{ display: "flex", gap: 8, marginBottom: 3 }}>
                                        <span style={{ color: "var(--muted)", minWidth: 60, fontSize: 12 }}>Filling {fi + 1}:</span>
                                        <span style={{ fontWeight: 500 }}>{f.type} — {f.grams}g</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {tier.coverings?.length > 0 && (
                                  <div style={{ marginTop: 4, paddingTop: 4, borderTop: "1px solid var(--border)" }}>
                                    {tier.coverings.map((c, ci) => (
                                      <div key={ci} style={{ display: "flex", gap: 8, marginBottom: 3 }}>
                                        <span style={{ color: "var(--muted)", minWidth: 60, fontSize: 12 }}>Covering:</span>
                                        <span style={{ fontWeight: 500 }}>{c.type} — {c.grams}g</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}

                    {/* Donuts details */}
                    {isDonuts && p.donutGroups?.length > 0 && (
                      <div style={{ marginBottom: 8 }}>
                        {p.donutGroups.map((g, gi) => (
                          <div key={gi} style={{ background: "#FDFBF7", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", marginBottom: 6, fontSize: 13 }}>
                            <div style={{ fontWeight: 600 }}>{g.qty} × {g.flavour || "?"} donuts</div>
                            {g.filling && <div style={{ color: "var(--muted)", marginTop: 2 }}>Filling: {g.filling} {g.fillingGrams ? `(${g.fillingGrams}g)` : ""}</div>}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Cake Loaf details */}
                    {isLoaf && p.loaves?.length > 0 && (
                      <div style={{ marginBottom: 8 }}>
                        {p.loaves.map((l, li) => (
                          <div key={li} style={{ background: "#FDFBF7", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", marginBottom: 6, fontSize: 13 }}>
                            <div style={{ fontWeight: 600 }}>Loaf {li + 1}: {l.flavour || "?"}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Tarts details */}
                    {isTart && (
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ background: "#FDFBF7", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", marginBottom: 6, fontSize: 13 }}>
                          <div style={{ fontWeight: 600 }}>{p.tartQty || "?"} tart shells</div>
                          {p.tartFillings?.filter(f => f.type).map((f, fi) => (
                            <div key={fi} style={{ color: "var(--muted)", marginTop: 2 }}>Filling: {f.type} {f.grams ? `(${f.grams}g)` : ""}</div>
                          ))}
                          {p.tartGarnish && <div style={{ color: "var(--muted)", marginTop: 2 }}>Garnish: {p.tartGarnish}</div>}
                        </div>
                      </div>
                    )}

                    {/* Pastry details */}
                    {p.pastryItems?.length > 0 && (
                      <div style={{ marginBottom: 8 }}>
                        {p.pastryItems.map((g, gi) => (
                          <div key={gi} style={{ background: "#FDFBF7", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", marginBottom: 6, fontSize: 13 }}>
                            <div style={{ fontWeight: 600 }}>{g.qty} × {g.flavour || "?"}</div>
                            {g.filling && <div style={{ color: "var(--muted)", marginTop: 2 }}>Filling: {g.filling} {g.fillingGrams ? `(${g.fillingGrams}g)` : ""}</div>}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Fallback for old records */}
                    {!p.tiers && !p.donutGroups && !p.loaves && !p.pastryItems && !isTart && (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(100px,1fr))", gap: 8, fontSize: 13, marginBottom: 8 }}>
                        {[{ l: "Size", v: p.size || "—" }, { l: "Flavour", v: p.flavor || p.flavors || "—" }, { l: "Covering", v: p.covering || "—" }, { l: "Layers", v: p.layers || "—" }].map(f => (
                          <div key={f.l}>
                            <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: .8, marginBottom: 2 }}>{f.l}</div>
                            <div style={{ fontWeight: 500, color: "var(--text)" }}>{f.v}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Delivery Date */}
                    <div style={{ display: "flex", gap: 12, fontSize: 12, color: "var(--muted)", marginTop: 10 }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <Calendar size={12} /> Delivery / Collection: <strong>{p.deliveryDate || "Unscheduled"}{p.collectionTime ? ` at ${p.collectionTime}` : ""}</strong>
                      </span>
                    </div>

                    {/* Topper/Inscription highlighted in a blue box */}
                    {p.topper?.enabled && p.topper?.description && (
                      <div style={{ marginTop: 8, fontSize: 12.5, background: "#EDF4FF", padding: "10px 12px", borderRadius: 6, border: "1px solid #C5D8F5" }}>
                        <div style={{ fontWeight: 600, color: "#1A5276", marginBottom: 3, display: "flex", alignItems: "center", gap: 5 }}>
                          <PenLine size={13} /> Inscription & Topper Details
                        </div>
                        <div style={{ color: "#2E4053" }}>{p.topper.description}</div>
                      </div>
                    )}

                    {/* Design notes highlighted in a yellow box */}
                    {p.notes && (
                      <div style={{ marginTop: 8, fontSize: 12.5, background: "#FFF9EE", padding: "10px 12px", borderRadius: 6, border: "1px solid #F0E0BB" }}>
                        <div style={{ fontWeight: 600, color: "#7B5A3A", marginBottom: 3, display: "flex", alignItems: "center", gap: 5 }}>
                          <FileText size={13} /> Design Notes & Special Requests
                        </div>
                        <div style={{ color: "#5D4037" }}>{p.notes}</div>
                      </div>
                    )}
                  </div>

                  {/* Status Dropdown */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, flexShrink: 0 }}>
                    <select
                      value={st.toLowerCase()}
                      onChange={e => handleStatusChange(p.id, e.target.value)}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 8,
                        border: "1px solid var(--border)",
                        background: statusColor[st.toLowerCase()] || "var(--panel)",
                        fontSize: 12.5,
                        color: statusTextColors[st.toLowerCase()] || "var(--text)",
                        cursor: "pointer",
                        fontWeight: 600,
                        fontFamily: "inherit"
                      }}
                    >
                      <option value="pending">Pending</option>
                      <option value="in progress">In Progress</option>
                      <option value="ready">Ready</option>
                      <option value="delivered">Delivered</option>
                    </select>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>Due {p.deliveryDate || "Unscheduled"}{p.collectionTime ? ` at ${p.collectionTime}` : ""}</div>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
