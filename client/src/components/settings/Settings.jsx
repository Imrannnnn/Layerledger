/**
 * Settings.jsx
 * ----------------------------------------------------------------------------
 * Settings screen and all its tab panels.
 * Company profile, pricing & margins (incl. overhead), starting inventory,
 * notifications, users & access, and backup/restore.
 * ----------------------------------------------------------------------------
 */
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { Btn, iSt, Inp, Sel, Card, Badge, SHead, Tabs, TH, TR2, Alert, Modal } from "../common/ui.jsx"
import { fmt, uid, callClaude } from "../../lib/helpers.js"
import { ROLES, DEFAULT_MULTS, DEFAULT_COVERINGS, PRICING_SIZES } from "../../constants.js"
import { saveSetting, saveCompany, saveUsers, saveLocal, syncToBackend, clearAllDataOnServer, logout, loadLocal, saveInventory } from "../../lib/data.js"
import { PLRow } from "../../lib/costing.jsx"

// ═══════════════════════════════════════════════════════════
export function UserRow({ u, i, updatePin, toggleUser, deleteUser }) {
  const [editPin, setEditPin] = useState(u.pin)
  const [showPin, setShowPin] = useState(false)
  return <TR2 i={i} row={[
    <div>
      <div style={{ fontWeight: 500 }}>{u.name}</div>
      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 1 }}>{u.id === "owner" ? "Main account" : ""}</div>
    </div>,
    <Badge color={u.role === "owner" ? "gold" : u.role === "production" ? "blue" : "green"}>{ROLES[u.role]?.split(" ")[0] || u.role}</Badge>,
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <input type={showPin ? "text" : "password"} value={editPin} onChange={e => setEditPin(e.target.value)} style={{ ...iSt, width: 80, padding: "4px 6px", fontSize: 12 }} />
      <span onClick={() => setShowPin(s => !s)} style={{ fontSize: 11, color: "var(--muted)", cursor: "pointer" }}>{showPin ? "Hide" : "Show"}</span>
      {editPin !== u.pin && <Btn small variant="success" onClick={() => updatePin(u.id, editPin)}>Save</Btn>}
    </div>,
    <Badge color={u.active ? "green" : "gray"}>{u.active ? "Active" : "Inactive"}</Badge>,
    <div style={{ display: "flex", gap: 4 }}>
      <Btn small variant="ghost" onClick={() => toggleUser(u.id)}>{u.active ? "Deactivate" : "Activate"}</Btn>
      {u.id !== "owner" && <Btn small variant="danger" onClick={() => deleteUser(u.id)}>×</Btn>}
    </div>,
  ]} />
}

// ═══════════════════════════════════════════════════════════
//  PRODUCTION LIST (weekly work order — printable)

// ═══════════════════════════════════════════════════════════
export function NToggle({ on, onToggle }) {
  return <div onClick={onToggle} style={{ width: 38, height: 21, borderRadius: 11, background: on ? "#357A52" : "var(--border)", cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
    <div style={{ width: 17, height: 17, borderRadius: "50%", background: "white", position: "absolute", top: 2, left: on ? 19 : 2, transition: "left 0.2s" }} />
  </div>
}

export function NRow({ title, sub, on, onToggle }) {
  return <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 0", borderBottom: "1px solid var(--border)" }}>
    <div style={{ flex: 1, paddingRight: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>{title}</div>
      <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2, lineHeight: 1.5 }}>{sub}</div>
    </div>
    <NToggle on={on} onToggle={onToggle} />
  </div>
}

// ═══════════════════════════════════════════════════════════
//  NOTIFICATION SETTINGS

// ═══════════════════════════════════════════════════════════
export function NotificationSettings() {
  const load = (key, def) => { const v = loadLocal(key, def); return v === null ? def : v === true || v === "true" ? true : v === false || v === "false" ? false : v }
  const [notifEnabled, setNotifEnabled] = useState(() => load("ll_notif_enabled", true))
  const [autoStock, setAutoStock] = useState(() => load("ll_auto_stock", true))
  const [lowStockAlert, setLowStockAlert] = useState(() => load("ll_lowstock_alert", true))
  const [notifDays, setNotifDays] = useState(() => load("ll_notif_days", "2"))
  const [saved, setSaved] = useState(false)

  const save = async () => {
    await saveLocal("ll_notif_enabled", notifEnabled)
    await saveLocal("ll_auto_stock", autoStock)
    await saveLocal("ll_lowstock_alert", lowStockAlert)
    await saveLocal("ll_notif_days", notifDays)
    setSaved(true); setTimeout(() => setSaved(false), 2500)
  }

  return <div style={{ maxWidth: 540 }}>
    <Card style={{ marginBottom: 14 }}>
      <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 15, fontWeight: 600, marginBottom: 14 }}>Notification Preferences</div>

      <PLRow title="Month-end reminder banner" sub="Shows on the dashboard in the last days of each month reminding you to lock closing stock." on={notifEnabled} onToggle={() => setNotifEnabled(v => !v)} />
      <PLRow title="Auto-set starting inventory on the 1st" sub="Automatically locks current stock as the new month's starting inventory at midnight on the 1st. After first-time setup you never have to do this manually again." on={autoStock} onToggle={() => setAutoStock(v => !v)} />
      <PLRow title="Low stock alerts on dashboard" sub="Shows a warning card on the dashboard whenever any ingredient falls below its minimum stock level." on={lowStockAlert} onToggle={() => setLowStockAlert(v => !v)} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 0" }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>Start reminding me how many days before month end</div>
          <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>How early the reminder banner starts appearing</div>
        </div>
        <select value={notifDays} onChange={e => setNotifDays(e.target.value)} style={{ ...iSt, width: 100, flexShrink: 0 }}>
          {["1", "2", "3", "5", "7"].map(d => <option key={d} value={d}>{d} day{d !== "1" ? "s" : ""}</option>)}
        </select>
      </div>

      <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)", display: "flex", gap: 10, alignItems: "center" }}>
        <Btn onClick={save}>Save preferences</Btn>
        {saved && <span style={{ fontSize: 12.5, color: "#357A52" }}>✓ Saved</span>}
      </div>
    </Card>

    <Card style={{ background: "#FFF9EE", borderColor: "var(--gold)" }}>
      <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 14, fontWeight: 600, marginBottom: 8 }}>How the month-end flow works</div>
      <div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.8 }}>
        {[
          "On the 29th/30th — amber reminder banner appears on your dashboard",
          "On the last day — banner turns red and more urgent",
          "At midnight on the 1st — app automatically locks closing stock as next month's starting inventory",
          "On the 1st when you open the app — green confirmation banner, previous month's statement ready to download",
          "You never have to set starting inventory manually again after the first time"
        ].map((s, i) => <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
          <span style={{ color: "var(--gold)", fontWeight: 700, flexShrink: 0 }}>{i + 1}.</span>
          <span>{s}</span>
        </div>)}
      </div>
    </Card>
  </div>
}

// ═══════════════════════════════════════════════════════════
//  STARTING INVENTORY TAB (in Settings)

// ═══════════════════════════════════════════════════════════
export function OpeningStockTab({ inventory, setInventory, user }) {
  const LS_KEY = "ll_opening_stock"
  const currentMonthStr = new Date().toISOString().slice(0, 7)
  const curMonth = new Date().toLocaleDateString("en-NG", { month: "long", year: "numeric" })

  const loadOS = () => {
    const saved = loadLocal(LS_KEY, null)
    if (saved && saved.month === currentMonthStr && Array.isArray(saved.items)) {
      return saved.items
    }
    // Automatically convert current master list to opening stock
    const initializedItems = inventory.map(i => ({
      id: i.id,
      name: i.name,
      unit: i.unit,
      cost: i.cost,
      openingQty: i.stock || 0
    }))
    saveLocal(LS_KEY, { month: currentMonthStr, items: initializedItems })
    return initializedItems
  }

  const [items, setItems] = useState(loadOS)
  const [saved, setSaved] = useState(() => {
    const os = loadLocal("ll_os_" + currentMonthStr, null)
    return !!(os && os.items)
  })
  const [addingItem, setAddingItem] = useState(false)
  const [calcMode, setCalcMode] = useState("manual") // "manual" or "auto"
  const [newItem, setNewItem] = useState({ name: "", unit: "kg", cost: "", openingQty: 0, totalPaid: "", qtyBought: "" })
  const [editCosts, setEditCosts] = useState(false)
  const [calcItem, setCalcItem] = useState(null)

  const [showImport, setShowImport] = useState(false)
  const [importStep, setImportStep] = useState(1) // 1 = paste columns, 2 = preview, 3 = done
  const [pasteN, setPasteN] = useState("")
  const [pasteU, setPasteU] = useState("")
  const [pasteQ, setPasteQ] = useState("")
  const [pasteC, setPasteC] = useState("")
  const [importItems, setImportItems] = useState([])
  const [warnMsg, setWarnMsg] = useState("")

  const L = v => v.trim().split(String.fromCharCode(10)).map(s => s.replace(/,/g, "").trim()).filter(Boolean)

  const checkMatch = () => {
    const ns = L(pasteN)
    const qs = L(pasteQ)
    const cs = L(pasteC)
    const warnings = []
    if (ns.length > 0) {
      if (qs.length > 0 && qs.length !== ns.length) {
        warnings.push(`Names: ${ns.length} rows — Quantities: ${qs.length} rows. Must match.`)
      }
      if (cs.length > 0 && cs.length !== ns.length) {
        warnings.push(`Names: ${ns.length} rows — Costs: ${cs.length} rows. Must match.`)
      }
    }
    setWarnMsg(warnings.join(" | "))
  }

  const doPreview = () => {
    const ns = L(pasteN)
    const us = L(pasteU)
    const qs = L(pasteQ)
    const cs = L(pasteC)

    if (!ns.length) {
      alert("Item names are required.")
      return
    }
    if (qs.length > 0 && qs.length !== ns.length) {
      alert(`Names (${ns.length}) and quantities (${qs.length}) must have the same number of rows.`)
      return
    }
    if (cs.length > 0 && cs.length !== ns.length) {
      alert(`Names (${ns.length}) and costs (${cs.length}) must have the same number of rows.`)
      return
    }

    const parsed = ns.map((name, i) => {
      const qtyStr = qs[i] || "0"
      const qty = parseFloat(qtyStr.replace(/[^0-9.]/g, "")) || 0
      const costStr = cs[i] || ""
      const cost = parseFloat(costStr.replace(/[^0-9.]/g, "")) || 0

      const match = items.find(it => it.name.trim().toLowerCase() === name.toLowerCase())

      return {
        id: match ? match.id : uid(),
        name: match ? match.name : name,
        unit: us[i] || (match ? match.unit : "kg"),
        cost: cs.length > 0 ? cost : (match ? match.cost : 0),
        openingQty: qs.length > 0 ? qty : (match ? match.openingQty : 0),
        isNew: !match,
        oldQty: match ? (match.openingQty || 0) : 0,
        oldCost: match ? (match.cost || 0) : 0,
        on: true
      }
    })

    setImportItems(parsed)
    setImportStep(2)
  }

  const confirmImport = async () => {
    const approved = importItems.filter(x => x.on)
    let updatedItems = [...items]
    const newMasterItems = []

    for (const app of approved) {
      const idx = updatedItems.findIndex(it => it.id === app.id)
      if (idx >= 0) {
        updatedItems[idx] = {
          ...updatedItems[idx],
          unit: app.unit,
          cost: app.cost,
          openingQty: app.openingQty
        }
      } else {
        const osItem = {
          id: app.id,
          name: app.name,
          unit: app.unit,
          cost: app.cost,
          openingQty: app.openingQty
        }
        updatedItems.push(osItem)

        newMasterItems.push({
          id: app.id,
          name: app.name,
          cat: "Dry Goods",
          unit: app.unit,
          cost: app.cost,
          stock: app.openingQty,
          minStock: 5
        })
      }
    }

    setItems(updatedItems)
    await saveLocal(LS_KEY, { month: currentMonthStr, items: updatedItems })

    if (newMasterItems.length > 0) {
      const updatedInventory = [...inventory, ...newMasterItems]
      if (setInventory) {
        setInventory(updatedInventory)
      }
      await saveInventory(updatedInventory)
    }

    setPasteN("")
    setPasteU("")
    setPasteQ("")
    setPasteC("")
    setImportStep(3)
    setSaved(false)
  }

  // Check if today is the last day of the month
  const isLastDayOfMonth = () => {
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(today.getDate() + 1)
    return tomorrow.getDate() === 1
  }

  const isLocked = saved
  const isEditable = !isLocked && (isLastDayOfMonth() || editCosts)

  const updateOSQty = async (id, val) => {
    const updated = items.map(item => item.id === id ? { ...item, openingQty: parseFloat(val) || 0 } : item)
    setItems(updated)
    await saveLocal(LS_KEY, { month: currentMonthStr, items: updated })
    setSaved(false)
  }

  const updateOSCost = async (id, val) => {
    const updated = items.map(item => item.id === id ? { ...item, cost: parseFloat(val) || 0 } : item)
    setItems(updated)
    await saveLocal(LS_KEY, { month: currentMonthStr, items: updated })
    setSaved(false)
  }

  const updateOSUnit = async (id, val) => {
    const updated = items.map(item => item.id === id ? { ...item, unit: val } : item)
    setItems(updated)
    await saveLocal(LS_KEY, { month: currentMonthStr, items: updated })
    setSaved(false)
  }

  const deleteOSItem = async (id) => {
    if (!confirm("Are you sure you want to remove this item from opening stock?")) return
    const updated = items.filter(item => item.id !== id)
    setItems(updated)
    await saveLocal(LS_KEY, { month: currentMonthStr, items: updated })
    setSaved(false)
  }

  const lockStock = async () => {
    // Save with month key so it's permanent for this month
    const monthKey = "ll_os_" + currentMonthStr
    const snapshot = {
      date: new Date().toISOString(),
      items: items.map(item => ({
        id: item.id,
        name: item.name,
        unit: item.unit,
        openingQty: item.openingQty,
        cost: item.cost
      }))
    }
    await saveLocal(monthKey, snapshot)
    setSaved(true)
  }

  const unlockStock = async () => {
    if (!confirm("Are you sure you want to unlock the opening stock for this month?")) return
    const monthKey = "ll_os_" + currentMonthStr
    await saveLocal(monthKey, {})
    setSaved(false)
  }

  const addNewItemToOS = async () => {
    let cost = newItem.cost
    if (calcMode === "auto") {
      const price = parseFloat(newItem.totalPaid)
      const qty = parseFloat(newItem.qtyBought)
      if (!newItem.totalPaid || !newItem.qtyBought || isNaN(price) || isNaN(qty) || qty <= 0) {
        alert("Total amount paid and quantity bought must be valid positive numbers.")
        return
      }
      cost = price / qty
    } else {
      cost = parseFloat(cost) || 0
    }
    if (!newItem.name.trim() || !cost) {
      alert("Name and cost are required.")
      return
    }
    const id = "_" + Math.random().toString(36).slice(2, 9)
    const openingQty = parseFloat(newItem.openingQty) || 0

    const osItem = {
      id,
      name: newItem.name.trim(),
      unit: newItem.unit,
      cost,
      openingQty
    }

    const updatedOSItems = [...items, osItem]
    setItems(updatedOSItems)
    await saveLocal(LS_KEY, { month: currentMonthStr, items: updatedOSItems })

    const masterItem = {
      id,
      name: newItem.name.trim(),
      cat: "Dry Goods", // Default category
      unit: newItem.unit,
      cost,
      stock: openingQty,
      minStock: 5
    }

    const updatedInventory = [...inventory, masterItem]
    if (setInventory) {
      setInventory(updatedInventory)
    }
    await saveInventory(updatedInventory)
    setNewItem({ name: "", unit: "kg", cost: "", openingQty: 0, totalPaid: "", qtyBought: "" })
    setCalcMode("manual")
    setAddingItem(false)
  }

  return <div style={{ maxWidth: 640 }}>
    <Card style={{ marginBottom: 14, background: "#FFF9EE", borderColor: "var(--gold)" }}>
      <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Opening Stock — {curMonth}</div>
      <p style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 0, lineHeight: 1.7, marginBottom: 12 }}>Set this once at the start of each month — or when you first set up the app. Once locked, this record never changes. It is used to generate your monthly stock statement automatically.</p>
      <div style={{ padding: "8px 12px", background: "#FFF3CD", borderRadius: 7, fontSize: 12, color: "#856404", marginBottom: 14 }}>⚠ Set opening stock at the beginning of each month before production starts. Once you lock it, it becomes a permanent record for that month.</div>
      {editCosts && (
        <div style={{ padding: "8px 12px", background: "#FDF3E5", borderRadius: 7, fontSize: 12, color: "#C8912A", marginBottom: 14, border: "1px solid rgba(200,145,42,0.2)", fontWeight: 500 }}>
          ⚠️ You have unsaved edits. Please ensure you click the <strong>"✓ Save"</strong> button at the bottom to apply your changes.
        </div>
      )}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead><tr style={{ background: "#EDE5D6" }}>
            {["Item", "Unit", "Opening Stock Qty", "Cost/Unit", "Opening Value", !isLocked ? "" : null].filter(h => h !== null).map(h => <th key={h} style={{ padding: "8px 10px", textAlign: h === "Item" || h === "Unit" ? "left" : h === "" ? "center" : "right", fontSize: 10, textTransform: "uppercase", letterSpacing: .8, color: "var(--muted)", fontWeight: 500 }}>{h}</th>)}
          </tr></thead>
          <tbody>{items.map((item, i) => {
            const qty = item.openingQty || 0
            return <tr key={item.id} style={{ background: i % 2 === 0 ? "var(--panel)" : "#F8F3EA" }}>
              <td style={{ padding: "8px 10px", fontWeight: 500 }}>{item.name}</td>
              <td style={{ padding: "8px 10px", color: "var(--muted)" }}>
                {isEditable ? (
                  <select value={item.unit || "kg"} onChange={e => updateOSUnit(item.id, e.target.value)} style={{ ...iSt, width: 70, padding: "2px 4px", fontSize: 12 }}>
                    {["kg", "g", "L", "ml", "pcs", "pack", "bottle", "roll", "set", "cm"].map(u => <option key={u}>{u}</option>)}
                  </select>
                ) : (
                  item.unit
                )}
              </td>
              <td style={{ padding: "8px 10px", textAlign: "right" }}>
                <input
                  type="number"
                  value={qty || ""}
                  onChange={e => updateOSQty(item.id, e.target.value)}
                  placeholder="0"
                  disabled={isLocked}
                  style={{
                    ...iSt,
                    width: 90,
                    padding: "4px 8px",
                    fontSize: 13,
                    textAlign: "right",
                    ...(isLocked ? { background: "#F5F5F5", color: "var(--muted)", cursor: "not-allowed" } : {})
                  }}
                />
              </td>
              <td style={{ padding: "8px 10px", textAlign: "right", color: "var(--gold)", fontWeight: 500 }}>
                {isEditable ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
                    <button
                      onClick={() => setCalcItem({ id: item.id, name: item.name, unit: item.unit, totalPaid: "", qtyBought: "" })}
                      title="Calculate cost per unit"
                      style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, padding: 0, marginRight: 4 }}
                    >
                      🧮
                    </button>
                    <span>₦</span>
                    <input type="number" value={item.cost || ""} onChange={e => updateOSCost(item.id, e.target.value)} placeholder="0" style={{ ...iSt, width: 75, padding: "4px 8px", fontSize: 13, textAlign: "right" }} />
                  </div>
                ) : (
                  `${fmt(item.cost)}/${item.unit}`
                )}
              </td>
              <td style={{ padding: "8px 10px", textAlign: "right", color: "var(--muted)", fontSize: 12 }}>{fmt(qty * item.cost)}</td>
              {!isLocked && (
                <td style={{ padding: "8px 10px", textAlign: "center" }}>
                  <Btn
                    small
                    variant="danger"
                    onClick={() => deleteOSItem(item.id)}
                    title="Remove item from opening stock"
                    style={{ padding: "2px 8px", minWidth: 24, fontSize: 14 }}
                  >
                    ×
                  </Btn>
                </td>
              )}
            </tr>
          })}</tbody>
          <tfoot><tr>
            <td colSpan={4} style={{ padding: "10px", textAlign: "right", fontWeight: 600, fontSize: 13 }}>Total opening stock value</td>
            <td style={{ padding: "10px", textAlign: "right", fontWeight: 700, color: "var(--gold)", fontSize: 15 }}>{fmt(items.reduce((s, i) => s + (i.openingQty || 0) * i.cost, 0))}</td>
            {!isLocked && <td />}
          </tr></tfoot>
        </table>
      </div>
      <div style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {!isLocked ? (
            <Btn variant="success" onClick={lockStock}>🔒 Lock Open Stock for {curMonth}</Btn>
          ) : (
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <span style={{ fontSize: 13, color: "#357A52", fontWeight: 600, background: "#EEF8F3", padding: "6px 12px", borderRadius: 8, border: "1px solid #C2E0CF" }}>🔒 Opening Stock is locked for {curMonth}</span>
              {user?.role === "owner" && (
                <Btn variant="outline" onClick={unlockStock} style={{ padding: "4px 10px", fontSize: 12 }}>🔓 Unlock</Btn>
              )}
            </div>
          )}
        </div>
        {!isLocked && (
          <div style={{ display: "flex", gap: 10 }}>
            <Btn variant={editCosts ? "outline" : "outline"} onClick={() => setEditCosts(!editCosts)} style={editCosts ? { borderColor: "var(--gold)", background: "rgba(200,145,42,0.1)", color: "var(--gold)", fontWeight: "600" } : {}}>
              {editCosts ? "✓ Save" : "✏ Edit"}
            </Btn>
            <Btn variant="outline" onClick={() => { setShowImport(true); setImportStep(1); }}>📁 Import from Excel</Btn>
            <Btn onClick={() => setAddingItem(true)}>+ Add Item</Btn>
          </div>
        )}
      </div>
    </Card>
    <Card>
      <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 14, fontWeight: 600, marginBottom: 8 }}>How this works</div>
      <div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.8 }}>
        <div style={{ marginBottom: 6 }}>1. On the first day of each month, enter your stock quantities above</div>
        <div style={{ marginBottom: 6 }}>2. Click Lock — this saves a permanent snapshot for that month</div>
        <div style={{ marginBottom: 6 }}>3. As you bake, stock reduces automatically from production orders</div>
        <div style={{ marginBottom: 6 }}>4. Purchases from receipts add back to stock automatically</div>
        <div>5. At month end, go to Reports → Stock Statement to see your full monthly movement</div>
      </div>
    </Card>

    {addingItem && <Modal title="Add Item directly to Opening Stock" onClose={() => { setAddingItem(false); setCalcMode("manual"); setNewItem({ name: "", unit: "kg", cost: "", openingQty: 0, totalPaid: "", qtyBought: "" }) }}>
      <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 12 }}>Adding a new item here will also register it in your Master List.</div>
      <Inp label="Item Name *" value={newItem.name} onChange={v => setNewItem(p => ({ ...p, name: v }))} placeholder="e.g. Yeast" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
        <Sel label="Unit *" value={newItem.unit} onChange={v => setNewItem(p => ({ ...p, unit: v }))} options={["kg", "g", "L", "ml", "pcs", "pack", "bottle", "roll", "set", "cm"].map(u => ({ value: u, label: u }))} />
        <Inp label="Opening Stock Qty" type="number" value={newItem.openingQty} onChange={v => setNewItem(p => ({ ...p, openingQty: v }))} placeholder="e.g. 5" />
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 10.5, color: "var(--muted)", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 500 }}>Cost Per Unit Setting</label>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={() => setCalcMode("manual")}
            style={{
              flex: 1,
              padding: "8px 10px",
              borderRadius: 8,
              border: calcMode === "manual" ? "2px solid var(--gold)" : "1px solid var(--border)",
              background: calcMode === "manual" ? "rgba(200,145,42,0.08)" : "transparent",
              color: calcMode === "manual" ? "var(--gold)" : "var(--text)",
              fontWeight: calcMode === "manual" ? "600" : "500",
              cursor: "pointer",
              fontSize: "12px"
            }}
          >
            I know cost per unit
          </button>
          <button
            type="button"
            onClick={() => setCalcMode("auto")}
            style={{
              flex: 1,
              padding: "8px 10px",
              borderRadius: 8,
              border: calcMode === "auto" ? "2px solid var(--gold)" : "1px solid var(--border)",
              background: calcMode === "auto" ? "rgba(200,145,42,0.08)" : "transparent",
              color: calcMode === "auto" ? "var(--gold)" : "var(--text)",
              fontWeight: calcMode === "auto" ? "600" : "500",
              cursor: "pointer",
              fontSize: "12px"
            }}
          >
            I don't know cost per unit
          </button>
        </div>
      </div>

      {calcMode === "auto" ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
          <Inp label="Total Amount Paid (₦) *" type="number" value={newItem.totalPaid || ""} onChange={v => setNewItem(p => ({ ...p, totalPaid: v }))} placeholder="e.g. 5000" />
          <Inp label="Quantity Bought *" type="number" value={newItem.qtyBought || ""} onChange={v => setNewItem(p => ({ ...p, qtyBought: v }))} placeholder="e.g. 2.5" />
          {newItem.totalPaid && newItem.qtyBought && parseFloat(newItem.qtyBought) > 0 && (
            <div style={{ gridColumn: "span 2", padding: "8px 12px", background: "var(--panel)", borderRadius: 8, fontSize: 13, fontWeight: 500, color: "var(--gold)", border: "1px solid var(--border)" }}>
              Calculated Cost per Unit: {fmt(parseFloat(newItem.totalPaid) / parseFloat(newItem.qtyBought))}/{newItem.unit}
            </div>
          )}
        </div>
      ) : (
        <div style={{ marginBottom: 12 }}>
          <Inp label="Cost/Unit (₦) *" type="number" value={newItem.cost} onChange={v => setNewItem(p => ({ ...p, cost: v }))} placeholder="e.g. 500" />
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <Btn variant="success" onClick={addNewItemToOS}>✓ Add Item</Btn>
        <Btn variant="ghost" onClick={() => { setAddingItem(false); setCalcMode("manual"); setNewItem({ name: "", unit: "kg", cost: "", openingQty: 0, totalPaid: "", qtyBought: "" }) }}>Cancel</Btn>
      </div>
    </Modal>}

    {showImport && (
      <Modal title="Import Starting Inventory" onClose={() => setShowImport(false)}>
        {/* Step indicators */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
          {[["1", "Paste columns"], ["2", "Preview"], ["✓", "Imported"]].map(([num, lbl], i) => {
            const idx = i + 1
            const done = importStep > idx, active = importStep === idx
            return <div key={num} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, background: done ? "#357A52" : active ? "var(--gold)" : "var(--border)", color: done || active ? "#fff" : "var(--muted)" }}>{done ? "✓" : num}</div>
              <span style={{ fontSize: 12, color: active ? "var(--text)" : "var(--muted)", fontWeight: active ? 500 : 400 }}>{lbl}</span>
              {i < 2 && <div style={{ width: 20, height: 1, background: "var(--border)", margin: "0 2px" }} />}
            </div>
          })}
        </div>

        {/* STEP 1 — paste */}
        {importStep === 1 && <div>
          <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 10, lineHeight: 1.7 }}>Open your Excel. Copy each column and paste into its own box. Only item names and cost per unit are required.</div>
          <div style={{ background: "#FFF9EE", border: "1px solid #E8D5A3", borderRadius: 7, padding: "8px 12px", fontSize: 12, color: "var(--gold)", marginBottom: 12 }}>💡 Just copy from Excel as-is. No reformatting needed.</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 10 }}>
            <div>
              <label style={{ fontSize: 10, color: "var(--muted)", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: .8, fontWeight: 500 }}>Item Names *</label>
              <textarea value={pasteN} onChange={e => { setPasteN(e.target.value); checkMatch() }} placeholder={"Flour\nSugar\nOil\nEggs\nButter"} style={{ width: "100%", minHeight: 150, padding: "8px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--panel)", fontSize: 11.5, fontFamily: "monospace", color: "var(--text)", boxSizing: "border-box", resize: "vertical", outline: "none" }} />
            </div>
            <div>
              <label style={{ fontSize: 10, color: "var(--muted)", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: .8, fontWeight: 500 }}>Unit <span style={{ color: "var(--muted)", fontSize: 8 }}>(opt)</span></label>
              <textarea value={pasteU} onChange={e => setPasteU(e.target.value)} placeholder={"kg\nkg\nL\npcs\nkg"} style={{ width: "100%", minHeight: 150, padding: "8px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--panel)", fontSize: 11.5, fontFamily: "monospace", color: "var(--text)", boxSizing: "border-box", resize: "vertical", outline: "none" }} />
              <div style={{ fontSize: 9, color: "var(--muted)", marginTop: 3 }}>Default all to kg</div>
            </div>
            <div>
              <label style={{ fontSize: 10, color: "var(--muted)", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: .8, fontWeight: 500 }}>Opening Qty</label>
              <textarea value={pasteQ} onChange={e => { setPasteQ(e.target.value); checkMatch() }} placeholder={"10\n5\n2\n30\n8"} style={{ width: "100%", minHeight: 150, padding: "8px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--panel)", fontSize: 11.5, fontFamily: "monospace", color: "var(--text)", boxSizing: "border-box", resize: "vertical", outline: "none" }} />
              <div style={{ fontSize: 9, color: "var(--muted)", marginTop: 3 }}>Default to 0</div>
            </div>
            <div>
              <label style={{ fontSize: 10, color: "var(--gold)", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: .8, fontWeight: 500 }}>Cost/Unit (₦) *</label>
              <textarea value={pasteC} onChange={e => { setPasteC(e.target.value); checkMatch() }} placeholder={"1140\n1500\n3000\n20\n17500"} style={{ width: "100%", minHeight: 150, padding: "8px", borderRadius: 8, border: "1px solid #E8D5A3", background: "#FFF9EE", fontSize: 11.5, fontFamily: "monospace", color: "var(--text)", boxSizing: "border-box", resize: "vertical", outline: "none" }} />
              <div style={{ fontSize: 9, color: "var(--gold)", marginTop: 3 }}>Bulk price ÷ qty</div>
            </div>
          </div>
          {warnMsg && <div style={{ padding: "7px 12px", background: "#FDEBE9", borderRadius: 7, fontSize: 12, color: "#B03A2E", marginBottom: 10 }}>⚠ {warnMsg}</div>}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Btn variant="ghost" onClick={() => setShowImport(false)}>Cancel</Btn>
            <Btn onClick={doPreview} disabled={!pasteN.trim() || !pasteC.trim() || !!warnMsg}>Preview import →</Btn>
          </div>
        </div>}

        {/* STEP 2 — preview */}
        {importStep === 2 && <div>
          <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 10 }}>Check every row. Toggle off anything you don't want. Updates will edit existing item quantities/costs/units.</div>
          <div style={{ overflowX: "auto", marginBottom: 10, maxHeight: 300 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead><tr style={{ background: "#EDE5D6", position: "sticky", top: 0, zIndex: 10 }}>
                {["", "Item", "Type", "Unit", "Qty", "Cost/Unit"].map(h => <th key={h} style={{ padding: "7px 10px", textAlign: h === "Cost/Unit" || h === "Qty" ? "right" : "left", fontSize: 10, textTransform: "uppercase", letterSpacing: .8, color: "var(--muted)", fontWeight: 500 }}>{h}</th>)}
              </tr></thead>
              <tbody>{importItems.map((p, i) => <tr key={i} style={{ background: i % 2 === 0 ? "var(--panel)" : "#F8F3EA", opacity: p.on ? 1 : 0.35 }}>
                <td style={{ padding: "6px 10px" }}><div onClick={() => setImportItems(prev => prev.map((x, j) => j === i ? { ...x, on: !x.on } : x))} style={{ width: 30, height: 16, borderRadius: 8, background: p.on ? "#357A52" : "var(--border)", cursor: "pointer", position: "relative" }}><div style={{ width: 12, height: 12, borderRadius: "50%", background: "white", position: "absolute", top: 2, left: p.on ? 16 : 2, transition: "left 0.2s" }} /></div></td>
                <td style={{ padding: "6px 10px", fontWeight: 500 }}>{p.name}</td>
                <td style={{ padding: "6px 10px" }}><Badge color={p.isNew ? "green" : "gold"}>{p.isNew ? "New" : "Update"}</Badge></td>
                <td style={{ padding: "6px 10px", color: "var(--muted)" }}>{p.unit}</td>
                <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: 600 }}>{p.openingQty}</td>
                <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: 500, color: "var(--gold)" }}>{fmt(p.cost)}/{p.unit}</td>
              </tr>)}</tbody>
            </table>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Btn variant="ghost" onClick={() => setImportStep(1)}>← Edit</Btn>
            <Btn variant="success" onClick={confirmImport} disabled={!importItems.some(p => p.on)}>✓ Confirm & Import {importItems.filter(p => p.on).length} Items</Btn>
          </div>
        </div>}

        {/* STEP 3 — done */}
        {importStep === 3 && <div style={{ textAlign: "center", padding: "16px 0" }}>
          <div style={{ fontSize: 16, color: "#357A52", fontWeight: 600, marginBottom: 6 }}>✓ Import complete</div>
          <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 14 }}>Starting quantities and costs have been loaded and matched.</div>
          <Btn variant="ghost" onClick={() => { setImportStep(1); setShowImport(false) }}>Done</Btn>
        </div>}
      </Modal>
    )}

    {calcItem && (
      <Modal title={`Calculate Cost/Unit — ${calcItem.name}`} onClose={() => setCalcItem(null)}>
        <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>
          Input the total purchase price and quantity to calculate the unit cost automatically.
        </div>
        <Inp
          label="Total Amount Paid (₦) *"
          type="number"
          value={calcItem.totalPaid}
          onChange={v => setCalcItem(prev => ({ ...prev, totalPaid: v }))}
          placeholder="e.g. 5000"
        />
        <Inp
          label={`Quantity Bought (${calcItem.unit}) *`}
          type="number"
          value={calcItem.qtyBought}
          onChange={v => setCalcItem(prev => ({ ...prev, qtyBought: v }))}
          placeholder="e.g. 2.5"
        />
        {calcItem.totalPaid && calcItem.qtyBought && parseFloat(calcItem.qtyBought) > 0 && (
          <div style={{ padding: "10px 14px", background: "#FFF9EE", border: "1px solid var(--gold)", borderRadius: 8, fontSize: 13, fontWeight: 500, color: "var(--gold)", marginBottom: 14 }}>
            Calculated Cost: {fmt(parseFloat(calcItem.totalPaid) / parseFloat(calcItem.qtyBought))}/{calcItem.unit}
          </div>
        )}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Btn variant="ghost" onClick={() => setCalcItem(null)}>Cancel</Btn>
          <Btn
            variant="success"
            disabled={!calcItem.totalPaid || !calcItem.qtyBought || parseFloat(calcItem.qtyBought) <= 0}
            onClick={() => {
              const cost = Math.round(parseFloat(calcItem.totalPaid) / parseFloat(calcItem.qtyBought))
              updateOSCost(calcItem.id, cost)
              setCalcItem(null)
            }}
          >
            ✓ Apply Cost
          </Btn>
        </div>
      </Modal>
    )}
  </div>
}

// ═══════════════════════════════════════════════════════════
//  STOCK STATEMENT (monthly — added to Reports)

export const SHAPES = ["round", "square", "sheet"]

export function PricingSetup({ settings, setSetting }) {
  const [ptab, setPtab] = useState("mults")
  const [mults, setMults] = useState(() => loadLocal("ll_multipliers", DEFAULT_MULTS))
  const [saved, setSaved] = useState("")

  const saveMults = async () => { await saveLocal("ll_multipliers", mults); setSaved("mults"); setTimeout(() => setSaved(""), 2000) }

  const tabs = [
    { v: "mults", l: "Size multipliers" },
    { v: "margins", l: "Profit margins" }
  ]

  return <div>
    <div style={{ display: "flex", gap: 6, marginBottom: 18, flexWrap: "wrap" }}>
      {tabs.map(t => <button key={t.v} onClick={() => setPtab(t.v)} style={{ padding: "6px 14px", borderRadius: 8, fontSize: 12.5, cursor: "pointer", border: ptab === t.v ? "none" : "1px solid var(--border)", background: ptab === t.v ? "var(--gold)" : "transparent", color: ptab === t.v ? "#fff" : "var(--muted)", fontFamily: "inherit" }}>{t.l}</button>)}
    </div>

    {/* SIZE MULTIPLIERS */}
    {ptab === "mults" && <div>
      <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 14, lineHeight: 1.7 }}>Each recipe is written for a 6" round (= 1.0 base). Set multipliers for every size and shape so the recipe calculator scales ingredients and costs correctly.</div>
      <div style={{ overflowX: "auto", marginBottom: 12 }}>
        <table style={{ borderCollapse: "collapse", fontSize: 12.5, minWidth: 480 }}>
          <thead><tr style={{ background: "#EDE5D6" }}>
            <th style={{ padding: "8px 10px", textAlign: "left", fontSize: 10, textTransform: "uppercase", letterSpacing: .8, color: "var(--muted)", fontWeight: 500, width: 60 }}>Size</th>
            {SHAPES.map(s => <th key={s} style={{ padding: "8px 10px", textAlign: "center", fontSize: 10, textTransform: "uppercase", letterSpacing: .8, color: "var(--muted)", fontWeight: 500, width: 80 }}>{s}</th>)}
          </tr></thead>
          <tbody>{PRICING_SIZES.map((size, si) => <tr key={size} style={{ background: si % 2 === 0 ? "var(--panel)" : "#F8F3EA" }}>
            <td style={{ padding: "6px 10px", fontWeight: 500 }}>{size}"</td>
            {SHAPES.map(shape => {
              const key = `${size}-${shape}`
              const isBase = size === "6" && shape === "round"
              return <td key={shape} style={{ padding: "4px 6px", textAlign: "center" }}>
                <input type="number" step="0.1" min="0.1" value={mults[key] || ""} disabled={isBase}
                  onChange={e => setMults(m => ({ ...m, [key]: parseFloat(e.target.value) || 0 }))}
                  style={{ ...iSt, width: 64, textAlign: "center", padding: "4px 6px", fontSize: 12, background: isBase ? "#EDE5D6" : "var(--panel)", color: isBase ? "var(--muted)" : "var(--text)" }} />
              </td>
            })}
          </tr>)}</tbody>
        </table>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <Btn onClick={saveMults}>Save multipliers</Btn>
        {saved === "mults" && <span style={{ fontSize: 12.5, color: "#357A52" }}>✓ Saved</span>}
      </div>
    </div>}

    {/* PROFIT MARGINS */}

    {ptab === "margins" && <div style={{ maxWidth: 480 }}>
      <Card style={{ marginBottom: 14 }}>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Default Profit Margin</div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "12px 0" }}>
          <input type="range" min={10} max={80} value={settings.profitPct || 50} onChange={e => setSetting("profitPct", +e.target.value)} style={{ flex: 1, accentColor: "var(--gold)" }} />
          <div style={{ fontSize: 22, fontWeight: 700, color: "var(--gold)", minWidth: 46 }}>{settings.profitPct || 50}%</div>
        </div>
        <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.6 }}>This is the share of the final price that you keep as profit, after every cost is covered. Set it to 40% and ₦40 out of every ₦100 a customer pays is yours; the rest pays for ingredients, overhead and accessories. Raise it and you earn more per cake, but your prices go up too.</div>
      </Card>
      <Card style={{ marginBottom: 14 }}>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Overhead Allowance</div>
        <p style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 0, lineHeight: 1.7 }}>Your rent, fuel, electricity, salaries and your own time have to be paid whether you bake or not, so every cake should carry a share of them. This adds that share on top of your ingredient cost, so those costs come out of the cake's price instead of quietly eating your profit.</p>
        <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "12px 0" }}>
          <input type="range" min={0} max={45} value={settings.overheadPct || 27} onChange={e => setSetting("overheadPct", +e.target.value)} style={{ flex: 1, accentColor: "var(--gold)" }} />
          <div style={{ fontSize: 22, fontWeight: 700, color: "var(--gold)", minWidth: 46 }}>{settings.overheadPct || 27}%</div>
        </div>
        {((settings.profitPct || 50)) >= 90 && <div style={{ padding: "8px 12px", background: "#FDEBE9", borderRadius: 8, fontSize: 12, color: "#B03A2E", lineHeight: 1.6 }}>⚠ Desired profit margin is very high ({settings.profitPct || 50}%). Please keep it below 90% to leave room for costs.</div>}
        <div style={{ padding: "10px 12px", background: "#F5F0E4", borderRadius: 8, fontSize: 12.5, color: "var(--muted)", marginTop: 6, lineHeight: 1.7 }}>
          Example: if a cake costs <strong style={{ color: "var(--text)" }}>₦10,000</strong> in ingredients:
          <div style={{ marginLeft: 12, marginTop: 4, fontSize: 12 }}>
            1. Overhead ({settings.overheadPct || 27}%): ₦{Math.round(10000 * ((settings.overheadPct || 27) / 100)).toLocaleString()}
            <br />
            2. Accessories ({settings.accessoryPct || 10}%): ₦{Math.round(10000 * ((settings.accessoryPct || 10) / 100)).toLocaleString()}
            <br />
            3. Miscellaneous ({settings.miscPct !== undefined ? settings.miscPct : 5}%): ₦{Math.round(10000 * ((settings.miscPct !== undefined ? settings.miscPct : 5) / 100)).toLocaleString()}
            <br />
            4. Total Cost: ₦{Math.round(10000 * (1 + (settings.overheadPct || 27) / 100 + (settings.accessoryPct || 10) / 100 + (settings.miscPct !== undefined ? settings.miscPct : 5) / 100)).toLocaleString()}
            <br />
            5. Applying {settings.profitPct || 50}% profit margin → suggested price <strong style={{ color: "var(--gold)" }}>{fmt(Math.round((10000 * (1 + (settings.overheadPct || 27) / 100 + (settings.accessoryPct || 10) / 100 + (settings.miscPct !== undefined ? settings.miscPct : 5) / 100)) / Math.max(0.05, 1 - (settings.profitPct || 50) / 100)))}</strong>
          </div>
        </div>
      </Card>
      <Card style={{ marginBottom: 14 }}>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Accessories Allowance</div>
        <p style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 0, lineHeight: 1.7 }}>Small items like cling film, greaseproof paper and gas are too fiddly to measure for every single cake. This adds a small percentage on top of your ingredients to cover them, so nothing gets forgotten.</p>
        <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "12px 0" }}>
          <input type="range" min={0} max={30} value={settings.accessoryPct || 10} onChange={e => setSetting("accessoryPct", +e.target.value)} style={{ flex: 1, accentColor: "var(--gold)" }} />
          <div style={{ fontSize: 22, fontWeight: 700, color: "var(--gold)", minWidth: 46 }}>{settings.accessoryPct || 10}%</div>
        </div>
      </Card>
      <Card>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Miscellaneous Allowance</div>
        <p style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 0, lineHeight: 1.7 }}>Covers unforeseen minor expenses, wastage, or small incidentals during production. Defaults to 5%.</p>
        <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "12px 0" }}>
          <input type="range" min={0} max={30} value={settings.miscPct !== undefined ? settings.miscPct : 5} onChange={e => setSetting("miscPct", +e.target.value)} style={{ flex: 1, accentColor: "var(--gold)" }} />
          <div style={{ fontSize: 22, fontWeight: 700, color: "var(--gold)", minWidth: 46 }}>{settings.miscPct !== undefined ? settings.miscPct : 5}%</div>
        </div>
      </Card>
    </div>}

  </div>
}

// ═══════════════════════════════════════════════════════════
//  ONBOARDING (first-time setup checklist)

// ═══════════════════════════════════════════════════════════
export function Settings({ company, setCompany, settings, setSettings, users, setUsers, inventory, setInventory, user }) {
  const [tab, setTab] = useState("company")
  const [clearConfirm, setClearConfirm] = useState("")

  const tabList = [
    { v: "company", l: "Company" },
    { v: "pricing", l: "Pricing & Margins" },
    { v: "stock", l: "Opening Stock" },
    { v: "notifications", l: "Notifications" }
  ]
  if (user?.role === "owner") tabList.push({ v: "users", l: "Users & Access" })
  tabList.push({ v: "backup", l: "Backup & Data" })
  const logoRef = useRef()
  const [newUser, setNewUser] = useState({ name: "", role: "production", pin: "" })
  const [userMsg, setUserMsg] = useState("")

  const co = (field, val) => { const u = { ...company, [field]: val }; setCompany(u); saveCompany(u) }
  const st = (field, val) => { const u = { ...settings, [field]: val }; setSettings(u); saveSetting(field, val) }

  const handleLogo = e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = ev => co("logo", ev.target.result); r.readAsDataURL(f) }

  const addUser = () => {
    if (!newUser.name || !newUser.pin) return setUserMsg("Name and PIN required")
    if (newUser.pin.length < 4) return setUserMsg("PIN must be at least 4 digits")
    const updated = [...users, { ...newUser, id: uid(), active: true }]
    setUsers(updated); saveUsers(updated); setNewUser({ name: "", role: "production", pin: "" }); setUserMsg("✓ User added")
  }
  const toggleUser = (id) => { const u = users.map(x => x.id === id ? { ...x, active: !x.active } : x); setUsers(u); saveUsers(u) }
  const deleteUser = (id) => { if (id === "owner") return; const u = users.filter(x => x.id !== id); setUsers(u); saveUsers(u) }
  const updatePin = (id, pin) => { const u = users.map(x => x.id === id ? { ...x, pin } : x); setUsers(u); saveUsers(u) }

  // Backup / restore
  const ALL_KEYS = ["ll_inv", "ll_prods", "ll_txns", "ll_exp", "ll_co", "ll_quotes", "ll_recipes", "ll_purchases", "ll_clients", "ll_users", "ll_coverings", "ll_decorations", "ll_packaging", "ll_multipliers", "ll_opening_stock", "ll_quote_invoices", "ll_accessories", "ll_payables", "ll_ap_payments", "ll_opening_balance", "ll_quote_revenue", "accessoryPct", "profitPct"]
  const exportData = () => {
    const data = {}
    ALL_KEYS.forEach(k => { const v = loadLocal(k, null); if (v !== null) data[k] = typeof v === "string" ? v : JSON.stringify(v) })
    data._exportedAt = new Date().toISOString(); data._version = "LayerLedger-v56"
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url; a.download = "layerledger-backup-" + new Date().toISOString().slice(0, 10) + ".json"
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
  }
  const importRef = useRef()
  const [importMsg, setImportMsg] = useState("")
  const handleImport = (e) => {
    const f = e.target.files[0]
    if (!f) { setImportMsg("⚠ No file selected."); return }
    setImportMsg("Reading file...")
    const r = new FileReader()
    r.onerror = () => { setImportMsg("⚠ Could not read the file. Try downloading it again.") }
    r.onload = ev => {
      try {
        let text = ev.target.result; if (typeof text !== "string") text = String(text); text = text.trim()
        const data = JSON.parse(text)
        if (!data._version && !data.ll_inv && !data.ll_quotes && !data.ll_prods) { setImportMsg("⚠ This doesn't look like a LayerLedger backup file."); return }
        let count = 0
        const importPromises = Object.keys(data).map(async k => {
          if (k.startsWith("_")) return
          let parsedVal = data[k]
          try { parsedVal = JSON.parse(data[k]) } catch { }
          await saveLocal(k, parsedVal)
          count++
        })
        Promise.all(importPromises).then(() => {
          setImportMsg("✓ Imported " + count + " data sets. Reloading app...")
          setTimeout(() => window.location.reload(), 1500)
        })
      } catch (err) { setImportMsg("⚠ Could not read file: " + err.message + ". Make sure it's the exported backup file (.json), not the app zip.") }
    }
    r.readAsText(f)
  }

  const clearAllData = async () => {
    if (clearConfirm !== (company.name || "BakeWealth")) return
    await clearAllDataOnServer()
    logout()
    window.location.reload()
  }

  return <div>
    <SHead title="Settings" sub="Company profile, pricing, users, and access control." />
    <Tabs tabs={tabList} active={tab} onChange={setTab} />

    {tab === "company" && <div style={{ maxWidth: 540 }}>
      <Card>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 15, fontWeight: 600, marginBottom: 14 }}>Company Profile</div>
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 14 }}>
          <div onClick={() => logoRef.current?.click()} style={{ width: 80, height: 80, borderRadius: 10, border: "2px dashed var(--border)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", background: "#FAF7F0", flexShrink: 0, overflow: "hidden" }}>
            {company.logo ? <img src={company.logo} alt="logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ textAlign: "center", fontSize: 11, color: "var(--muted)" }}>Upload<br />Logo</div>}
          </div>
          <input ref={logoRef} type="file" accept="image/*" onChange={handleLogo} style={{ display: "none" }} />
          <div style={{ flex: 1 }}>
            <Inp label="Business Name" value={company.name} onChange={v => co("name", v)} />
            <Inp label="Tagline" value={company.tagline || ""} onChange={v => co("tagline", v)} />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Inp label="Phone" value={company.phone || ""} onChange={v => co("phone", v)} />
          <Inp label="Email" value={company.email || ""} onChange={v => co("email", v)} />
        </div>
        <Inp label="Address" value={company.address || ""} onChange={v => co("address", v)} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 4 }}>
          <div><label style={{ fontSize: 10.5, color: "var(--muted)", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.8 }}>Primary Color</label><div style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="color" value={company.primaryColor || "var(--gold)"} onChange={e => co("primaryColor", e.target.value)} style={{ width: 38, height: 34, borderRadius: 6, border: "1px solid var(--border)", cursor: "pointer", padding: 2 }} /><span style={{ fontSize: 12, color: "var(--muted)" }}>{company.primaryColor}</span></div></div>
          <div><label style={{ fontSize: 10.5, color: "var(--muted)", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.8 }}>Sidebar Color</label><div style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="color" value={company.sidebarColor || "var(--sidebar)"} onChange={e => co("sidebarColor", e.target.value)} style={{ width: 38, height: 34, borderRadius: 6, border: "1px solid var(--border)", cursor: "pointer", padding: 2 }} /><span style={{ fontSize: 12, color: "var(--muted)" }}>{company.sidebarColor}</span></div></div>
        </div>
      </Card>
      <Card style={{ marginTop: 14 }}>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 15, fontWeight: 600, marginBottom: 6 }}>🔑 AI Features</div>
        <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 12, lineHeight: 1.7 }}>
          BakeWealth uses AI to scan receipts, read bank statements, and generate smart reports. AI features are enabled and utilize the company's secure global API key.
        </div>
        <Btn onClick={async () => {
          try {
            const text = await callClaude([{ role: "user", content: "respond with exactly OK" }], "Respond with exactly OK")
            if (text.trim() === "OK") {
              alert("✅ AI Features are working correctly!")
            } else {
              alert("⚠️ Received response, but unexpected output: " + text)
            }
          } catch (e) {
            alert("❌ AI Features connection error: " + e.message)
          }
        }}>Test Connection</Btn>
      </Card>
      <Card style={{ marginTop: 14 }}>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Invoice Template</div>
        <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 12 }}>Choose a layout for your client invoices and quotes. All templates use your brand colour and logo.</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8 }}>
          {[
            { id: "classic", label: "Classic", desc: "Traditional letterhead style" },
            { id: "modern", label: "Modern", desc: "Clean with bold header" },
            { id: "minimal", label: "Minimal", desc: "Simple and uncluttered" },
            { id: "elegant", label: "Elegant", desc: "Serif fonts, refined layout" },
            { id: "bold", label: "Bold", desc: "Strong colours, high impact" },
          ].map(t => <div key={t.id} onClick={() => co("invoiceTemplate", t.id)} style={{ padding: "10px 8px", borderRadius: 8, border: `2px solid ${(company.invoiceTemplate || "classic") === t.id ? "var(--gold)" : "var(--border)"}`, background: (company.invoiceTemplate || "classic") === t.id ? "#FFF9EE" : "var(--panel)", cursor: "pointer", textAlign: "center" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: (company.invoiceTemplate || "classic") === t.id ? "var(--gold)" : "var(--text)", marginBottom: 3 }}>{t.label}</div>
            <div style={{ fontSize: 10, color: "var(--muted)" }}>{t.desc}</div>
          </div>)}
        </div>
      </Card>
      <Card style={{ marginTop: 14 }}>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Invoice Footer Note</div>
        <textarea value={company.invoiceFooter || ""} onChange={e => co("invoiceFooter", e.target.value)} placeholder="e.g. Thank you for choosing our bakery!" style={{ ...iSt, minHeight: 70, resize: "vertical" }} />
      </Card>
      <Card style={{ marginTop: 14 }}>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Bank / Payment Details</div>
        <p style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 0, marginBottom: 12 }}>Appears on all invoices. Set once here.</p>
        <Inp label="Bank name" value={company.bankName || ''} onChange={v => co("bankName", v)} placeholder="e.g. GTBank" />
        <Inp label="Account number" value={company.bankAccount || ''} onChange={v => co("bankAccount", v)} placeholder="0123456789" />
        <Inp label="Account name" value={company.bankAccountName || ''} onChange={v => co("bankAccountName", v)} placeholder="e.g. Sweet Treats Bakery" />
      </Card>

    </div>}

    {tab === "pricing" && <PricingSetup settings={settings} setSetting={st} />}

    {tab === "stock" && <OpeningStockTab inventory={inventory} setInventory={setInventory} user={user} />}
    {tab === "notifications" && <NotificationSettings />}

    {tab === "users" && <div>
      <div style={{ marginBottom: 14, padding: "10px 14px", background: "#EEF8F3", borderRadius: 8, fontSize: 13, color: "#2D7A50", border: "1px solid #C2E0CF" }}>
        <strong>Access Levels:</strong> Owner = full access. Production = can log cakes & scan receipts only (no prices visible, no delete). Customer Service = can view orders & create invoices only.
      </div>
      {userMsg && <Alert msg={userMsg} color={userMsg.startsWith("✓") ? "green" : "red"} onClose={() => setUserMsg("")} />}
      <Card style={{ marginBottom: 14, background: "#FFF9EE", borderColor: "var(--gold)" }}>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Add New User</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <Inp label="Full Name *" value={newUser.name} onChange={v => setNewUser(p => ({ ...p, name: v }))} placeholder="e.g. Ngozi Baker" />
          <Sel label="Role *" value={newUser.role} onChange={v => setNewUser(p => ({ ...p, role: v }))} options={Object.entries(ROLES).map(([k, v]) => ({ value: k, label: v }))} />
          <Inp label="PIN * (min 4 digits)" value={newUser.pin} onChange={v => setNewUser(p => ({ ...p, pin: v }))} placeholder="e.g. 5678" type="number" />
        </div>
        <Btn onClick={addUser}>Add User</Btn>
      </Card>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", background: "var(--panel)", borderRadius: 10, overflow: "hidden", border: "1px solid var(--border)" }}>
          <TH cols={["User", "Role", "PIN", "Status", "Actions"]} />
          <tbody>{users.map((u, i) => <UserRow key={u.id} u={u} i={i} updatePin={updatePin} toggleUser={toggleUser} deleteUser={deleteUser} />)}</tbody>
        </table>
      </div>
    </div>}

    {tab === "backup" && <div style={{ maxWidth: 540 }}>
      <Card style={{ marginBottom: 14 }}>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Backup Your Data</div>
        <div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.7, marginBottom: 14 }}>
          Your data is stored on this device only. Export a backup file to keep it safe, move it to another device (your phone, a business centre computer), or hand it to your accountant. Do this regularly — it's your safety net.
        </div>
        <Btn onClick={exportData}>📥 Export All Data</Btn>
        <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 8 }}>Downloads a single file containing inventory, recipes, orders, quotes, transactions, purchases, payables, and all settings.</div>
      </Card>
      <Card>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Restore From Backup</div>
        <div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.7, marginBottom: 14 }}>
          Import a backup file to load all that data into this browser. Use this to set up the app on a new device, or to give your accountant a working copy.
        </div>
        <div style={{ background: "#FDEBE9", border: "1px solid #F0A89E", borderRadius: 8, padding: "10px 12px", fontSize: 12, color: "#B03A2E", lineHeight: 1.6, marginBottom: 14 }}>
          ⚠ Importing replaces the data currently in this browser with the data from the file. If this browser already has data you want to keep, export it first.
        </div>
        <input ref={importRef} type="file" onChange={handleImport} style={{ display: "none" }} />
        <Btn variant="ghost" onClick={() => importRef.current?.click()}>📤 Import Data From File</Btn>
        {importMsg && <div style={{ marginTop: 10, fontSize: 13, fontWeight: 500, color: importMsg.startsWith("✓") ? "#357A52" : "#B03A2E" }}>{importMsg}</div>}
      </Card>
      <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 12, lineHeight: 1.6, fontStyle: "italic", marginBottom: 24 }}>
        Note: this is a manual backup for now. A cloud version with automatic sync across all your devices is planned as the next major step.
      </div>

      <Card style={{ border: "1px solid #F0A89E" }}>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 15, fontWeight: 600, marginBottom: 6, color: "#B03A2E" }}>Danger Zone</div>
        <div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.7, marginBottom: 14 }}>
          Clear all data from this device. This will delete all inventory, orders, quotes, recipes, and settings. <strong>This cannot be undone.</strong>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}>
            <Inp label={`Type "${company.name || 'BakeWealth'}" to confirm`} value={clearConfirm} onChange={setClearConfirm} />
          </div>
          <Btn variant="danger" disabled={clearConfirm !== (company.name || 'BakeWealth')} onClick={clearAllData}>Clear All Data</Btn>
        </div>
      </Card>
    </div>}
  </div>
}

// ═══════════════════════════════════════════════════════════
//  ORDER CALCULATOR
// ═══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════
//  QUOTES PAGE
// ═══════════════════════════════════════════════════════════
const QUOTE_STATUSES = [
  { v: "pending", l: "Pending", c: "#BA7517", bg: "#FAEEDA" },
  { v: "approved", l: "Approved", c: "#085041", bg: "#E1F5EE" },
]
