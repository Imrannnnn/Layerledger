/**
 * Purchases.jsx
 * ----------------------------------------------------------------------------
 * Ingredient purchases list.
 * ----------------------------------------------------------------------------
 */
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { Btn, iSt, Inp, Card, SHead, TH, TR2, Spinner } from "../common/ui.jsx"
import { fmt, uid, DEFAULT_CATEGORIES, mapCategory } from "../../lib/helpers.js"
import { saveInventory, saveExpenses, loadLocal, saveLocal } from "../../lib/data.js"

// ═══════════════════════════════════════════════════════════
export function Purchases({ inventory, setInventory, expenses, setExpenses, setView, isOwner }) {
  const [showForm, setShowForm] = useState(false)
  const [purchases, setPurchases] = useState(() => loadLocal("ll_purchases", []))
  const [draftPurchases, setDraftPurchases] = useState([
    {
      item: "",
      category: "",
      unit: "",
      unitSize: "",
      qty: "",
      price: "",
      date: new Date().toISOString().slice(0, 10)
    }
  ])
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [deletingAll, setDeletingAll] = useState(false)

  const customCats = loadLocal("ll_custom_categories", [])
  const categoriesList = useMemo(() => {
    const invCats = inventory.map(i => mapCategory(i.cat, i.name)).filter(Boolean)
    return Array.from(new Set([...DEFAULT_CATEGORIES, ...customCats, ...invCats]))
  }, [customCats, inventory])

  const updateDraftPurchaseField = (idx, field, value) => {
    setDraftPurchases(prev => {
      const copy = [...prev]
      copy[idx] = { ...copy[idx], [field]: value }
      if (field === "item" && value) {
        const it = inventory.find(i => i.id === value)
        if (it) {
          copy[idx].category = it.cat || mapCategory(it.cat, it.name)
          copy[idx].unit = it.unit || ""
        }
      }
      return copy
    })
  }

  const addDraftPurchase = () => {
    const lastRow = draftPurchases[draftPurchases.length - 1]
    setDraftPurchases(p => [
      ...p,
      {
        item: "",
        category: "",
        unit: "",
        unitSize: "",
        qty: "",
        price: "",
        date: lastRow?.date || new Date().toISOString().slice(0, 10)
      }
    ])
  }

  const removeDraftPurchase = (idx) => {
    setDraftPurchases(prev => prev.filter((_, i) => i !== idx))
  }

  const savePurchases = async (p) => { setPurchases(p); await saveLocal("ll_purchases", p) }

  const log = async () => {
    const invalid = draftPurchases.some(dp => !dp.item || !dp.category || !dp.unitSize || !dp.qty || !dp.price)
    if (invalid) {
      alert("All fields are required for all items")
      return
    }

    let updInv = [...inventory]
    let updExp = [...expenses]
    let newPurchases = []

    for (const dp of draftPurchases) {
      const selItem = updInv.find(i => i.id === dp.item)
      const cpu = dp.price && dp.unitSize ? parseFloat((+dp.price / (+dp.unitSize || 1)).toFixed(2)) : 0
      const total = dp.price && dp.qty ? Math.round(+dp.price * (+dp.qty)) : 0
      const stockAdded = dp.unitSize && dp.qty ? parseFloat(((+dp.unitSize) * (+dp.qty)).toFixed(3)) : 0

      // 1. Update cost/unit in inventory using weighted average cost
      updInv = updInv.map(i => {
        if (i.id === dp.item) {
          const currentStock = Number(i.stock || 0);
          const currentCost = Number(i.cost || 0);
          const currentValue = currentStock * currentCost;
          const newStock = parseFloat((currentStock + stockAdded).toFixed(3));
          const newValue = currentValue + total;
          const newAvgCost = newStock > 0 ? parseFloat((newValue / newStock).toFixed(2)) : currentCost;
          return {
            ...i,
            cost: newAvgCost,
            stock: newStock,
            cat: dp.category || i.cat
          };
        }
        return i;
      });

      // 2. Log as expense with category mapping
      let expCat = "Ingredients / Supplies"
      if (dp.category === "Board and Packaging" || dp.category === "Packaging") {
        expCat = "Packaging"
      } else if (dp.category === "Decoration Extras" || dp.category === "Decorations") {
        expCat = "Decorations"
      }
      const exp = { 
        id: uid(), 
        date: dp.date, 
        description: `Purchase: ${selItem?.name || dp.item}`, 
        amount: total, 
        category: expCat, 
        paymentMethod: "transfer", 
        source: "purchase", 
        notes: `${dp.qty}×${dp.unitSize}${selItem?.unit || ""} @ ₦${(+dp.price).toLocaleString()} — cost/unit updated to ${fmt(cpu)}` 
      }
      updExp = [exp, ...updExp];

      // 3. Log purchase record
      const rec = { 
        id: uid(), 
        date: dp.date, 
        itemId: dp.item, 
        item: selItem?.name || "", 
        category: dp.category, 
        unit: selItem?.unit || "", 
        unitSize: +dp.unitSize, 
        qty: +dp.qty, 
        price: +dp.price, 
        total, 
        cpu, 
        stockAdded 
      }
      newPurchases = [rec, ...newPurchases]
    }

    setInventory(updInv); await saveInventory(updInv)
    setExpenses(updExp); await saveExpenses(updExp)
    await savePurchases([...newPurchases, ...purchases])

    setDraftPurchases([
      {
        item: "",
        category: "",
        unit: "",
        unitSize: "",
        qty: "",
        price: "",
        date: new Date().toISOString().slice(0, 10)
      }
    ])
    setShowForm(false)
  }

  const filteredPurchases = useMemo(() => {
    return purchases.filter(p => p.date?.startsWith(selectedMonth))
  }, [purchases, selectedMonth])

  const monthTotal = useMemo(() => {
    return filteredPurchases.reduce((s, p) => s + (p.total || 0), 0)
  }, [filteredPurchases])

  const itemsUpdatedCount = useMemo(() => {
    return new Set(filteredPurchases.map(p => p.itemId)).size
  }, [filteredPurchases])

  const handleDeleteAll = async () => {
    if (!window.confirm("Are you sure you want to delete ALL logged purchase records? This will clear the purchase history log and remove corresponding entries in Expenses. (Inventory stock/cost levels will remain). This cannot be undone.")) return
    setDeletingAll(true)
    try {
      await savePurchases([])
      const updatedExpenses = expenses.filter(e => e.source !== "purchase")
      setExpenses(updatedExpenses)
      await saveExpenses(updatedExpenses)
    } catch (err) {
      alert("Failed to delete purchases: " + err.message)
    } finally {
      setDeletingAll(false)
    }
  }

  return <div>
    <SHead title="Purchases" sub="Log every ingredient purchase — cost per unit updates inventory automatically." />
    <div style={{ background: "#E8EFFC", border: "1px solid #B5D4F4", borderRadius: 8, padding: "10px 14px", fontSize: 12.5, color: "#185FA5", marginBottom: 14, lineHeight: 1.7 }}>
      🔗 When you log a purchase here, the <strong>Cost/Unit</strong> in your Inventory updates automatically.
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 14 }}>
      <Card style={{ padding: "12px 14px" }}><div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Month Total</div><div style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, fontWeight: 700, color: "var(--text)" }}>{fmt(monthTotal)}</div></Card>
      <Card style={{ padding: "12px 14px" }}><div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Purchases logged</div><div style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, fontWeight: 700, color: "var(--text)" }}>{filteredPurchases.length}</div></Card>
      <Card style={{ padding: "12px 14px" }}><div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Items updated</div><div style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, fontWeight: 700, color: "#357A52" }}>{itemsUpdatedCount}</div></Card>
    </div>

    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        {setView && (
          <Btn variant="ghost" onClick={() => setView("receipts")}>
            🧾 Go to Receipt Scanner →
          </Btn>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <label style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8 }}>Month:</label>
          <input
            type="month"
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            style={{ ...iSt, width: 140, padding: "5px 8px", fontSize: 12.5, marginTop: 0 }}
          />
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {isOwner && (
          deletingAll ? (
            <Spinner />
          ) : (
            <Btn
              small
              variant="ghost"
              disabled={deletingAll}
              style={{ color: "#B03A2E", borderColor: "#F2DEDE", fontSize: "11.5px", fontWeight: "normal", padding: "4px 8px" }}
              onClick={handleDeleteAll}
            >
              🗑 Clear All Purchases
            </Btn>
          )
        )}
        <Btn onClick={() => setShowForm(s => !s)}>+ Log Purchase</Btn>
      </div>
    </div>

    {showForm && <Card style={{ marginBottom: 14, background: "#FFF9EE", borderColor: "var(--gold)" }}>
      <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Log New Purchases</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 12 }}>
        {draftPurchases.map((dp, idx) => {
          const selItem = inventory.find(i => i.id === dp.item)
          const cpu = dp.price && dp.unitSize ? parseFloat((+dp.price / (+dp.unitSize || 1)).toFixed(2)) : 0
          const total = dp.price && dp.qty ? Math.round(+dp.price * (+dp.qty)) : 0
          const stockAdded = dp.unitSize && dp.qty ? parseFloat(((+dp.unitSize) * (+dp.qty)).toFixed(3)) : 0

          return (
            <div key={idx} style={{ 
              display: "flex", 
              flexDirection: "column", 
              gap: 8, 
              border: "1px solid var(--border)", 
              borderRadius: 8, 
              padding: 12, 
              background: "var(--panel)", 
              position: "relative"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--gold)" }}>Purchase Item #{idx + 1}</span>
                {draftPurchases.length > 1 && (
                  <button 
                    onClick={() => removeDraftPurchase(idx)} 
                    style={{ background: "none", border: "none", color: "#B03A2E", cursor: "pointer", fontSize: 11, fontWeight: 600 }}
                  >
                    🗑 Remove Item
                  </button>
                )}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 8 }}>
                <div>
                  <label style={{ fontSize: 10.5, color: "var(--muted)", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: .8, fontWeight: 500 }}>Item *</label>
                  <select value={dp.item} onChange={e => updateDraftPurchaseField(idx, "item", e.target.value)} style={{ ...iSt }}>
                    <option value="">— Select item —</option>
                    {inventory.map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 10.5, color: "var(--muted)", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: .8, fontWeight: 500 }}>Category *</label>
                  <select value={dp.category} onChange={e => updateDraftPurchaseField(idx, "category", e.target.value)} style={{ ...iSt }}>
                    <option value="">— Select category —</option>
                    {categoriesList.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <Inp label="Pack size *" type="number" value={dp.unitSize} onChange={v => updateDraftPurchaseField(idx, "unitSize", v)} placeholder="e.g. 50" small />
                <Inp label="Qty bought *" type="number" value={dp.qty} onChange={v => updateDraftPurchaseField(idx, "qty", v)} placeholder="e.g. 3" small />
                <Inp label="Price / pack (₦) *" type="number" value={dp.price} onChange={v => updateDraftPurchaseField(idx, "price", v)} placeholder="e.g. 57000" small />
                <Inp label="Date" type="date" value={dp.date} onChange={v => updateDraftPurchaseField(idx, "date", v)} small />
              </div>

              {cpu > 0 && (
                <div style={{ display: "flex", gap: 14, background: "rgba(200, 145, 42, 0.05)", padding: "6px 12px", borderRadius: 6, fontSize: 11.5, flexWrap: "wrap" }}>
                  <div>Total spent: <strong>{fmt(total)}</strong></div>
                  <div>Stock to add: <strong style={{ color: "#357A52" }}>+{stockAdded} {selItem?.unit || ""}</strong></div>
                  <div>New Cost/unit: <strong style={{ color: "var(--gold)" }}>{fmt(cpu)}/{selItem?.unit || "unit"}</strong></div>
                </div>
              )}
            </div>
          )
        })}
      </div>
      
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14 }}>
        <Btn variant="outline" onClick={addDraftPurchase}>+ Add Another Item</Btn>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn variant="success" onClick={log}>✓ Log {draftPurchases.length} {draftPurchases.length === 1 ? "Purchase" : "Purchases"} & Update Inventory</Btn>
          <Btn variant="ghost" onClick={() => {
            setShowForm(false)
            setDraftPurchases([
              {
                item: "",
                category: "",
                unit: "",
                unitSize: "",
                qty: "",
                price: "",
                date: new Date().toISOString().slice(0, 10)
              }
            ])
          }}>Cancel</Btn>
        </div>
      </div>
    </Card>}

    <Card style={{ padding: 0, overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <TH cols={["Date", "Item", "Category", "Unit", "Pack size", "Qty", "Price/pack", "Total", "Cost/unit ✦", "Status"]} />
        <tbody>{filteredPurchases.length === 0 ? <tr><td colSpan={10} style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>No purchases logged in this month. Click + Log Purchase to start.</td></tr> :
          filteredPurchases.map((p, i) => {
            const invItem = inventory.find(item => item.id === p.itemId)
            const displayCat = invItem?.cat || p.category || "—"
            const displayUnit = invItem?.unit || p.unit || ""
            return <TR2 key={p.id} i={i} row={[
              <span style={{ color: "var(--muted)", fontSize: 12 }}>{p.date}</span>,
              <span style={{ fontWeight: 500 }}>{p.item}</span>,
              <span style={{ color: "var(--muted)" }}>{displayCat}</span>,
              <span style={{ color: "var(--muted)" }}>{displayUnit}</span>,
              <span>{p.unitSize} {displayUnit}</span>,
              <span>{p.qty}</span>,
              fmt(p.price),
              <span style={{ fontWeight: 500 }}>{fmt(p.total)}</span>,
              <span style={{ color: "var(--gold)", fontWeight: 500 }}>{fmt(p.cpu)}/{displayUnit}</span>,
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, background: "#E8EFFC", color: "#2355A0", padding: "2px 8px", borderRadius: 20, fontWeight: 500 }}>🔗 Updated</span>,
            ]} />
          })
        }</tbody>
      </table>
    </Card>
    <div style={{ marginTop: 8, fontSize: 11.5, color: "var(--muted)" }}>✦ Cost/unit = Price per pack ÷ Pack size. Updates inventory and starting inventory immediately.</div>
  </div>
}


// ═══════════════════════════════════════════════════════════
//  CREDIT PURCHASES / ACCOUNTS PAYABLE
