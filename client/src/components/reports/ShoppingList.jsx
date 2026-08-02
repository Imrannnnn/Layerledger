/**
 * ShoppingList.jsx
 * ----------------------------------------------------------------------------
 * Low-stock shopping list.
 * ----------------------------------------------------------------------------
 */
import React, { useState } from "react"
import { Btn, Card, Badge, SHead } from "../common/ui.jsx"
import { fmt } from "../../lib/helpers.js"
import { saveInventory } from "../../lib/data.js"

export function ShoppingList({ inventory, setInventory, company }) {
  const [done, setDone] = useState(false)

  // Map category helper (aligns with MasterList grouping)
  const mapCategory = (cat) => {
    const c = (cat || "").toLowerCase()
    if (c.includes("dry") || c.includes("chocolate") || c.includes("flour") || c.includes("sugar")) return "Dry Goods"
    if (c.includes("dairy") || c.includes("fat") || c.includes("oil") || c.includes("butter") || c.includes("margarine") || c.includes("egg")) return "Dairy and Fats"
    if (c.includes("flavor") || c.includes("extract") || c.includes("color") || c.includes("essence")) return "Flavours and Extracts"
    if (c.includes("decor") || c.includes("finish") || c.includes("fruit") || c.includes("flower") || c.includes("topper") || c.includes("ribbon")) return "Decoration Extras"
    if (c.includes("packaging") || c.includes("board") || c.includes("box") || c.includes("dowel") || c.includes("drum")) return "Board and Packaging"
    return "Other"
  }

  // An ingredient appears on this list when its current stock level falls below its minimum stock level.
  const low = inventory.filter(i => i.stock <= (i.minStock || 5))
  const zero = inventory.filter(i => i.stock === 0)

  // Calculate suggested restock quantity: minimum level minus current level
  const getRestockQty = (item) => {
    const min = item.minStock || 5
    return Math.max(0, parseFloat((min - item.stock).toFixed(3)))
  }

  // Calculate estimated restock cost based on the last recorded purchase price
  const getEstCost = (item) => {
    const need = getRestockQty(item)
    return parseFloat((item.cost * need).toFixed(2))
  }

  // Mark items as purchased which adds the restock quantity to stock (removing it from the list)
  const markAsPurchased = async (item) => {
    const need = getRestockQty(item)
    if (need <= 0) return
    const updated = inventory.map(i => 
      i.id === item.id 
        ? { ...i, stock: parseFloat((i.stock + need).toFixed(3)) } 
        : i
    )
    setInventory(updated)
    await saveInventory(updated)
  }

  const markAllPurchased = async () => {
    if (!confirm("Are you sure you want to mark all low-stock items as purchased?")) return
    const updated = inventory.map(i => {
      const need = getRestockQty(i)
      if (need > 0 && i.stock <= (i.minStock || 5)) {
        return { ...i, stock: parseFloat((i.stock + need).toFixed(3)) }
      }
      return i
    })
    setInventory(updated)
    await saveInventory(updated)
  }

  const print = () => {
    const w = window.open("", "_blank")
    w.document.write(`<!DOCTYPE html><html><head><title>Shopping List</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: "Courier New", Arial, sans-serif; color: #000; padding: 40px; max-width: 720px; margin: 0 auto; line-height: 1.5; font-size: 13px; }
      h1 { font-size: 20px; font-weight: bold; text-transform: uppercase; border-bottom: 2px double #000; padding-bottom: 8px; margin-bottom: 6px; }
      h2 { font-size: 13px; color: #555; font-weight: normal; margin-bottom: 20px; }
      table { width: 100%; border-collapse: collapse; margin: 16px 0; }
      th { border-bottom: 2px solid #000; padding: 8px; text-align: left; font-size: 11px; text-transform: uppercase; font-weight: bold; }
      td { padding: 8px; border-bottom: 1px solid #ddd; font-size: 12.5px; }
      .cb { width: 16px; height: 16px; border: 1px solid #000; display: inline-block; vertical-align: middle; }
      .out-badge { font-weight: bold; text-decoration: underline; }
      @media print {
        button { display: none; }
        body { padding: 0; }
      }
    </style></head><body>
      <h1>${company?.name || "Bakery"} — Shopping List</h1>
      <h2>Generated: ${new Date().toLocaleDateString("en-NG", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</h2>
      
      ${zero.length > 0 ? `<div style="border: 1px solid #000; padding: 10px; margin-bottom: 16px; font-weight: bold;">🚨 OUT OF STOCK: ${zero.map(i => i.name).join(", ")}</div>` : ""}
      
      <table>
        <thead>
          <tr>
            <th style="width: 40px;">[ ]</th>
            <th>Item</th>
            <th>Category</th>
            <th>Current Stock</th>
            <th>Min Level</th>
            <th>Suggested Buy</th>
            <th>Est. Cost</th>
          </tr>
        </thead>
        <tbody>
          ${low.map(i => {
            const need = getRestockQty(i)
            const estCost = getEstCost(i)
            return `
            <tr>
              <td><div class="cb"></div></td>
              <td><strong>${i.name}</strong> ${i.stock === 0 ? "*(OUT)*" : ""}</td>
              <td>${mapCategory(i.cat)}</td>
              <td>${i.stock} ${i.unit}</td>
              <td>${i.minStock || 5} ${i.unit}</td>
              <td><strong>${need} ${i.unit}</strong></td>
              <td>₦${Math.round(estCost).toLocaleString()}</td>
            </tr>
            `
          }).join("")}
          <tr style="font-weight: bold; border-top: 2px solid #000;">
            <td colspan="6" style="text-align: right; padding-top: 12px;">ESTIMATED TOTAL COST:</td>
            <td style="padding-top: 12px;">₦${Math.round(low.reduce((sum, i) => sum + getEstCost(i), 0)).toLocaleString()}</td>
          </tr>
        </tbody>
      </table>
      <p style="font-size: 10px; color: #888; margin-top: 40px;">Printed from BakeWealth · ${new Date().toLocaleDateString()}</p>
      <script>window.print()<\/script>
    </body></html>`)
    w.document.close()
    setDone(true)
  }

  const estimatedTotalCost = low.reduce((sum, i) => sum + getEstCost(i), 0)

  return (
    <div>
      <SHead title="Shopping List" sub="Auto-generated ingredients list needing restock based on minimum alert levels" />
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 16, alignItems: "start" }}>
        
        {/* Left Card: List of low-stock items with Suggested Qty, Est Cost & Mark as Purchased Action */}
        <Card>
          <div style={{ display: "flex", justifyItems: "center", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, fontWeight: 600 }}>Items Needing Restock ({low.length})</div>
            {low.length > 0 && (
              <div style={{ display: "flex", gap: 8 }}>
                <Btn small variant="success" onClick={markAllPurchased}>✓ Mark All Purchased</Btn>
                <Btn small onClick={print}>🖨️ Print (ink saver)</Btn>
              </div>
            )}
          </div>

          {low.length === 0 ? (
            <div style={{ textAlign: "center", padding: 30, color: "#357A52", fontWeight: 600, fontSize: 14 }}>
              ✓ All items are well-stocked! Nothing needs restocking.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {low.map(i => {
                const need = getRestockQty(i)
                const estCost = getEstCost(i)
                return (
                  <div key={i.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 8, padding: "12px 14px" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{i.name}</span>
                        <span style={{ fontSize: 10, background: "#FAF7F0", color: "var(--muted)", padding: "1px 6px", borderRadius: 4 }}>{mapCategory(i.cat)}</span>
                      </div>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>
                        Current: <strong>{i.stock} {i.unit}</strong> | Min level: <strong>{i.minStock || 5} {i.unit}</strong>
                      </div>
                      <div style={{ fontSize: 12.5, color: "var(--gold)", fontWeight: 600, marginTop: 4 }}>
                        Suggested to buy: {need} {i.unit} (Est. cost: {fmt(estCost)})
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Badge color={i.stock === 0 ? "red" : "gold"}>{i.stock === 0 ? "OUT" : "LOW"}</Badge>
                      <Btn small variant="outline" onClick={() => markAsPurchased(i)}>✓ Purchased</Btn>
                    </div>
                  </div>
                )
              })}
              
              <div style={{ padding: "14px 16px", background: "#FAF7F0", border: "1px solid var(--border)", borderRadius: 8, marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>Total Estimated Cost:</span>
                <span style={{ fontWeight: 700, fontSize: 17, color: "var(--gold)" }}>{fmt(estimatedTotalCost)}</span>
              </div>
            </div>
          )}
        </Card>

        {/* Right Card: Full Inventory Status Bars */}
        <Card>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 15, fontWeight: 600, marginBottom: 14 }}>Full Inventory Status</div>
          <div style={{ overflowY: "auto", maxHeight: 480, paddingRight: 6 }}>
            {inventory.map(i => {
              const min = i.minStock || 5
              const max = min * 3
              const pct = Math.min(100, (i.stock / max) * 100)
              const isLow = i.stock <= min
              return (
                <div key={i.id} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--text)" }}>{i.name}</span>
                    <span style={{ fontSize: 12, color: isLow ? "#B03A2E" : "var(--muted)", fontWeight: isLow ? 600 : 400 }}>
                      {i.stock} / {min} {i.unit}
                    </span>
                  </div>
                  <div style={{ height: 5, background: "var(--border)", borderRadius: 3 }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: pct < 34 ? "#B03A2E" : pct < 68 ? "var(--gold)" : "#357A52", borderRadius: 3, transition: "width 0.3s" }} />
                  </div>
                </div>
              )
            })}
          </div>
        </Card>

      </div>
    </div>
  )
}
