/**
 * Settings.jsx
 * ----------------------------------------------------------------------------
 * Settings screen and all its tab panels.
 * Company profile, pricing & margins (incl. overhead), starting inventory,
 * notifications, users & access, and backup/restore.
 * ----------------------------------------------------------------------------
 */
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { Btn, iSt, Inp, Sel, Card, Badge, SHead, Tabs, TH, TR2, Alert, Modal, Pagination } from "../common/ui.jsx"
import { fmt, uid, callClaude } from "../../lib/helpers.js"
import { ROLES, DEFAULT_MULTS, DEFAULT_COVERINGS, PRICING_SIZES } from "../../constants.js"
import { saveSetting, saveCompany, saveUsers, saveLocal, syncToBackend, syncFromBackend, clearAllDataOnServer, logout, loadLocal, saveInventory, deleteOpeningStockOnServer, fetchPricingSettingsFromServer, savePricingSettingsOnServer, resetPricingSettingsOnServer } from "../../lib/data.js"
import { PLRow } from "../../lib/costing.jsx"
import { Check, AlertTriangle, Calculator, Lock, Unlock, Save, Trash2, Pencil, FileSpreadsheet, Lightbulb, Key, Download, Upload, Coins } from "lucide-react"
import { OpeningStock } from "../inventory/OpeningStock.jsx"
import { TokenUsageSection } from "./TokenUsageSection.jsx"

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
        {saved && <span style={{ fontSize: 12.5, color: "#357A52", display: "inline-flex", alignItems: "center", gap: 4 }}><Check size={13} /> Saved</span>}
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
export const OpeningStockTab = OpeningStock

export const SHAPES = ["round", "square", "sheet"]

export function PricingSetup({ settings, setSetting }) {
  const [ptab, setPtab] = useState("mults")
  const [mults, setMults] = useState({})
  const [saved, setSaved] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [error, setError] = useState(null)

  const setSettingRef = useRef(setSetting)
  setSettingRef.current = setSetting

  const loadPricing = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const serverPricing = await fetchPricingSettingsFromServer()
      if (serverPricing && serverPricing.multipliers) {
        setMults(serverPricing.multipliers)
      } else {
        setMults(DEFAULT_MULTS)
      }
      const fn = setSettingRef.current
      if (fn && serverPricing) {
        if (serverPricing.profitPct !== undefined) fn("profitPct", serverPricing.profitPct)
        if (serverPricing.overheadPct !== undefined) fn("overheadPct", serverPricing.overheadPct)
        if (serverPricing.accessoryPct !== undefined) fn("accessoryPct", serverPricing.accessoryPct)
        if (serverPricing.miscPct !== undefined) fn("miscPct", serverPricing.miscPct)
      }
    } catch (err) {
      console.warn("PricingSetup loadPricing error:", err)
      setError("Failed to load pricing settings from database.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPricing()
  }, [loadPricing])

  const saveMults = async () => {
    setSaving(true)
    try {
      await savePricingSettingsOnServer({ multipliers: mults })
      setSaved("mults")
      setTimeout(() => setSaved(""), 3000)
    } catch (err) {
      console.error("Failed to save multipliers to server:", err)
    } finally {
      setSaving(false)
    }
  }

  const handleResetDefaults = async () => {
    if (!window.confirm("Reset all size and shape multipliers to system defaults in database?")) return
    setResetting(true)
    try {
      const defaults = await resetPricingSettingsOnServer()
      if (defaults && defaults.multipliers) {
        setMults(defaults.multipliers)
        setSaved("reset")
        setTimeout(() => setSaved(""), 3000)
      }
    } catch (err) {
      console.error("Failed to reset multipliers in database:", err)
    } finally {
      setResetting(false)
    }
  }

  const tabs = [
    { v: "mults", l: "Size multipliers" },
    { v: "margins", l: "Profit margins" }
  ]

  return <div>
    <div style={{ display: "flex", gap: 6, marginBottom: 18, flexWrap: "wrap" }}>
      {tabs.map(t => <button key={t.v} onClick={() => setPtab(t.v)} style={{ padding: "6px 14px", borderRadius: 8, fontSize: 12.5, cursor: "pointer", border: ptab === t.v ? "none" : "1px solid var(--border)", background: ptab === t.v ? "var(--gold)" : "transparent", color: ptab === t.v ? "#fff" : "var(--muted)", fontFamily: "inherit" }}>{t.l}</button>)}
    </div>

    {loading ? (
      <div style={{ padding: "32px 16px", textAlign: "center", background: "var(--panel)", borderRadius: 10, border: "1px solid var(--border)", color: "var(--muted)", fontSize: 13, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        <div style={{ width: 22, height: 22, border: "2px solid var(--gold)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
        <span>Loading pricing configuration from database...</span>
      </div>
    ) : error ? (
      <div style={{ padding: "16px 20px", background: "#FDEBE9", border: "1px solid #F0A89E", borderRadius: 8, color: "#B03A2E", fontSize: 13, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>{error}</span>
        <Btn variant="ghost" onClick={loadPricing}>Retry</Btn>
      </div>
    ) : (
      <>
        {/* SIZE MULTIPLIERS */}
        {ptab === "mults" && <div>
          <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 14, lineHeight: 1.7 }}>Each recipe is written for a 6" round (= 1.0 base). Set multipliers for every size and shape so the recipe calculator scales ingredients and costs correctly. All changes are saved directly to your cloud database.</div>
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
                    <input type="number" step="0.1" min="0.1" value={mults[key] !== undefined ? mults[key] : ""} disabled={isBase}
                      onChange={e => setMults(m => ({ ...m, [key]: parseFloat(e.target.value) || 0 }))}
                      style={{ ...iSt, width: 64, textAlign: "center", padding: "4px 6px", fontSize: 12, background: isBase ? "#EDE5D6" : "var(--panel)", color: isBase ? "var(--muted)" : "var(--text)" }} />
                  </td>
                })}
              </tr>)}</tbody>
            </table>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12 }}>
            <Btn onClick={saveMults} disabled={saving}>
              {saving ? "Saving to Database..." : "Save multipliers"}
            </Btn>
            <Btn variant="ghost" onClick={handleResetDefaults} disabled={resetting}>
              {resetting ? "Resetting..." : "Reset to Defaults"}
            </Btn>
            {saved === "mults" && <span style={{ fontSize: 12.5, color: "#357A52", display: "inline-flex", alignItems: "center", gap: 4 }}><Check size={13} /> Multipliers saved to database</span>}
            {saved === "reset" && <span style={{ fontSize: 12.5, color: "#357A52", display: "inline-flex", alignItems: "center", gap: 4 }}><Check size={13} /> Multipliers reset to defaults</span>}
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
        {((settings.profitPct || 50)) >= 90 && <div style={{ padding: "8px 12px", background: "#FDEBE9", borderRadius: 8, fontSize: 12, color: "#B03A2E", lineHeight: 1.6, display: "flex", alignItems: "center", gap: 5 }}><AlertTriangle size={13} /> Desired profit margin is very high ({settings.profitPct || 50}%). Please keep it below 90% to leave room for costs.</div>}
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
      </>
    )}
  </div>
}

// ═══════════════════════════════════════════════════════════
//  ONBOARDING (first-time setup checklist)

// ═══════════════════════════════════════════════════════════
export function Settings({ company, setCompany, settings, setSettings, users, setUsers, inventory, setInventory, user, setView, initialTab = "company" }) {
  const [tab, setTab] = useState(initialTab)
  const [clearConfirm, setClearConfirm] = useState("")

  useEffect(() => {
    if (initialTab) setTab(initialTab)
  }, [initialTab])

  const tabList = [
    { v: "company", l: "Company" },
    { v: "tokens", l: "AI Tokens & Usage" },
    { v: "pricing", l: "Pricing & Margins" },
    { v: "stock", l: "Opening Stock" },
    { v: "notifications", l: "Notifications" }
  ]
  if (user?.role === "owner") tabList.push({ v: "users", l: "Users & Access" })
  tabList.push({ v: "backup", l: "Database & Data" })
  const logoRef = useRef()
  const [newUser, setNewUser] = useState({ name: "", role: "production", pin: "" })
  const [userMsg, setUserMsg] = useState("")

  const co = (field, val) => { const u = { ...company, [field]: val }; setCompany(u); saveCompany(u) }
  const st = useCallback((field, val, saveToServer = true) => {
    setSettings(prev => {
      if (prev && prev[field] === val) return prev
      return { ...prev, [field]: val }
    })
    if (!saveToServer) return
    saveSetting(field, val)
    if (["profitPct", "overheadPct", "accessoryPct", "miscPct"].includes(field)) {
      savePricingSettingsOnServer({ [field]: val }).catch(() => {})
    }
  }, [setSettings])

  const handleLogo = e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = ev => co("logo", ev.target.result); r.readAsDataURL(f) }

  const addUser = () => {
    if (!newUser.name || !newUser.pin) return setUserMsg("Name and PIN required")
    if (newUser.pin.length < 4) return setUserMsg("PIN must be at least 4 digits")
    const updated = [...users, { ...newUser, id: uid(), active: true }]
    setUsers(updated); saveUsers(updated); setNewUser({ name: "", role: "production", pin: "" }); setUserMsg("User added")
  }
  const toggleUser = (id) => { const u = users.map(x => x.id === id ? { ...x, active: !x.active } : x); setUsers(u); saveUsers(u) }
  const deleteUser = (id) => { if (id === "owner") return; const u = users.filter(x => x.id !== id); setUsers(u); saveUsers(u) }
  const updatePin = (id, pin) => { const u = users.map(x => x.id === id ? { ...x, pin } : x); setUsers(u); saveUsers(u) }

  // Backup / restore
  const ALL_KEYS = ["ll_inv", "ll_prods", "ll_txns", "ll_exp", "ll_co", "ll_quotes", "ll_recipes", "ll_purchases", "ll_clients", "ll_users", "ll_coverings", "ll_decorations", "ll_packaging", "ll_multipliers", "ll_opening_stock", "ll_quote_invoices", "ll_accessories", "ll_payables", "ll_ap_payments", "ll_opening_balance", "ll_quote_revenue", "accessoryPct", "profitPct"]
  const exportData = () => {
    const data = {}
    ALL_KEYS.forEach(k => { const v = loadLocal(k, null); if (v !== null) data[k] = typeof v === "string" ? v : JSON.stringify(v) })
    data._exportedAt = new Date().toISOString(); data._version = "BakeWealth-v56"
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url; a.download = "bakewealth-backup-" + new Date().toISOString().slice(0, 10) + ".json"
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
  }
  const importRef = useRef()
  const [importMsg, setImportMsg] = useState("")
  const handleImport = (e) => {
    const f = e.target.files[0]
    if (!f) { setImportMsg("No file selected."); return }
    setImportMsg("Reading file...")
    const r = new FileReader()
    r.onerror = () => { setImportMsg("Could not read the file. Try downloading it again.") }
    r.onload = ev => {
      try {
        let text = ev.target.result; if (typeof text !== "string") text = String(text); text = text.trim()
        const data = JSON.parse(text)
        if (!data._version && !data.ll_inv && !data.ll_quotes && !data.ll_prods && !data.bw_inv) { setImportMsg("This doesn't look like a BakeWealth backup file."); return }
        let count = 0
        const importPromises = Object.keys(data).map(async k => {
          if (k.startsWith("_")) return
          let parsedVal = data[k]
          try { parsedVal = JSON.parse(data[k]) } catch { }
          await saveLocal(k, parsedVal)
          count++
        })
        Promise.all(importPromises).then(() => {
          setImportMsg("Imported " + count + " data sets. Reloading app...")
          setTimeout(() => window.location.reload(), 1500)
        })
      } catch (err) { setImportMsg("Could not read file: " + err.message + ". Make sure it's the exported backup file (.json), not the app zip.") }
    }
    r.readAsText(f)
  }

  const [clearing, setClearing] = useState(false)
  const clearAllData = async () => {
    if (clearConfirm !== (company.name || "BakeWealth")) return
    setClearing(true)
    try {
      await clearAllDataOnServer()
      logout()
      window.location.reload()
    } catch (e) {
      alert("Failed to clear data from database: " + e.message)
      setClearing(false)
    }
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
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 15, fontWeight: 600, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
          <Key size={15} /> AI Features
        </div>
        <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 12, lineHeight: 1.7 }}>
          BakeWealth uses AI to scan receipts, read bank statements, and generate smart reports. AI features are enabled and utilize the company's secure global API key.
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <Btn onClick={async () => {
            try {
              const text = await callClaude([{ role: "user", content: "respond with exactly OK" }], "Respond with exactly OK")
              if (text.trim() === "OK") {
                alert("AI Features are working correctly!")
              } else {
                alert("Received response, but unexpected output: " + text)
              }
            } catch (e) {
              alert("AI Features connection error: " + e.message)
            }
          }}>Test Connection</Btn>
          <Btn variant="outline" onClick={() => setTab("tokens")} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <Coins size={13} color="var(--gold)" />
            <span>Manage Tokens & Usage</span>
          </Btn>
        </div>
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

    {tab === "tokens" && <TokenUsageSection company={company} />}

    {tab === "pricing" && <PricingSetup settings={settings} setSetting={st} />}

    {tab === "stock" && <OpeningStock inventory={inventory} setInventory={setInventory} user={user} />}
    {tab === "notifications" && <NotificationSettings />}

    {tab === "users" && <div>
      <div style={{ marginBottom: 14, padding: "10px 14px", background: "#EEF8F3", borderRadius: 8, fontSize: 13, color: "#2D7A50", border: "1px solid #C2E0CF" }}>
        <strong>Access Levels:</strong> Owner = full access. Production = can log cakes & scan receipts only (no prices visible, no delete). Customer Service = can view orders & create invoices only.
      </div>
      {userMsg && <Alert msg={userMsg} color="green" onClose={() => setUserMsg("")} />}
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
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Export Database Snapshot</div>
        <div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.7, marginBottom: 14 }}>
          All your bakery data (inventory, recipes, orders, quotes, expenses, clients, purchases, and settings) is stored securely in your cloud PostgreSQL database in real time. You can export a snapshot backup file of your database records at any time for offline archiving or to hand to your accountant.
        </div>
        <Btn onClick={exportData} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Download size={13} /> Export Database Snapshot</Btn>
        <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 8 }}>Downloads a JSON file containing all your live database records.</div>
      </Card>
      <Card>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Restore Database Records</div>
        <div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.7, marginBottom: 14 }}>
          Import a BakeWealth JSON backup file directly into your cloud database. This will restore and persist your dataset in the database.
        </div>
        <div style={{ background: "#FDEBE9", border: "1px solid #F0A89E", borderRadius: 8, padding: "10px 12px", fontSize: 12, color: "#B03A2E", lineHeight: 1.6, marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
          <AlertTriangle size={14} style={{ flexShrink: 0 }} /> Importing writes records directly to the database. If your database already contains live data you want to keep, export a snapshot first.
        </div>
        <input ref={importRef} type="file" onChange={handleImport} style={{ display: "none" }} />
        <Btn variant="ghost" onClick={() => importRef.current?.click()} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <Upload size={13} /> Import Data to Database
        </Btn>
        {importMsg && <div style={{ marginTop: 10, fontSize: 13, fontWeight: 500, color: importMsg.includes("Imported") ? "#357A52" : "#B03A2E" }}>{importMsg}</div>}
      </Card>

      <Card style={{ border: "1px solid #F0A89E", marginTop: 16 }}>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 15, fontWeight: 600, marginBottom: 6, color: "#B03A2E" }}>Danger Zone: Clear Database</div>
        <div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.7, marginBottom: 14 }}>
          Clear all records directly from the database. This will permanently delete all inventory, orders, quotes, recipes, expenses, and settings for this account from the database. <strong>This cannot be undone.</strong>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}>
            <Inp label={`Type "${company.name || 'BakeWealth'}" to confirm`} value={clearConfirm} onChange={setClearConfirm} />
          </div>
          <Btn variant="danger" disabled={clearing || clearConfirm !== (company.name || 'BakeWealth')} onClick={clearAllData}>
            {clearing ? "Clearing Database..." : "Clear All Data from Database"}
          </Btn>
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
