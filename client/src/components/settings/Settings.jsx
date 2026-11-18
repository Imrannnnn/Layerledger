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
import { ROLES } from "../../constants.js"
import { saveSetting, saveCompany, saveUsers, saveLocal, syncToBackend, syncFromBackend, clearAllDataOnServer, deleteTenantAccountOnServer, logout, loadLocal, saveInventory, deleteOpeningStockOnServer, fetchPricingSettingsFromServer, savePricingSettingsOnServer, checkPlanLimit, notifyPlanLimitReached } from "../../lib/data.js"
import { PLRow } from "../../lib/costing.jsx"
import { Check, AlertTriangle, Calculator, Lock, Unlock, Save, Trash2, Pencil, FileSpreadsheet, Lightbulb, Key, Download, Upload, Coins, Sparkles } from "lucide-react"
import { OpeningStock } from "../inventory/OpeningStock.jsx"
import { TokenUsageSection } from "./TokenUsageSection.jsx"
import { getPanLibrary, savePanLibrary, DEFAULT_PAN_LIBRARY, deriveOverheadRates, DEFAULT_RECURRING_COSTS, calculateProductionOverhead } from "../../lib/cakeGeometry.js"

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

export function PricingSetup({ settings, setSetting }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const setSettingRef = useRef(setSetting)
  setSettingRef.current = setSetting

  const loadPricing = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const serverPricing = await fetchPricingSettingsFromServer()
      const fn = setSettingRef.current
      if (fn && serverPricing) {
        if (serverPricing.profitPct !== undefined) fn("profitPct", serverPricing.profitPct)
        if (serverPricing.overheadPct !== undefined) fn("overheadPct", serverPricing.overheadPct)
        if (serverPricing.accessoryPct !== undefined) fn("accessoryPct", serverPricing.accessoryPct)
        if (serverPricing.monthlyOverhead !== undefined) fn("monthlyOverhead", serverPricing.monthlyOverhead)
        if (serverPricing.annualProductionHours !== undefined) fn("annualProductionHours", serverPricing.annualProductionHours)
        if (serverPricing.ordersPerMonth !== undefined) fn("ordersPerMonth", serverPricing.ordersPerMonth)
        if (serverPricing.hourlyRate !== undefined) fn("hourlyRate", serverPricing.hourlyRate)
        if (serverPricing.perOrderRate !== undefined) fn("perOrderRate", serverPricing.perOrderRate)
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

  return <div>
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
      <div style={{ maxWidth: 480 }}>
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
              2. Accessories ({settings.accessoryPct || 15}%): ₦{Math.round(10000 * ((settings.accessoryPct || 15) / 100)).toLocaleString()}
              <br />
              3. Total Cost: ₦{Math.round(10000 * (1 + (settings.overheadPct || 27) / 100 + (settings.accessoryPct || 15) / 100)).toLocaleString()}
              <br />
              4. Applying {settings.profitPct || 50}% profit margin → suggested price <strong style={{ color: "var(--gold)" }}>{fmt(Math.round((10000 * (1 + (settings.overheadPct || 27) / 100 + (settings.accessoryPct || 15) / 100)) / Math.max(0.05, 1 - (settings.profitPct || 50) / 100)))}</strong>
            </div>
          </div>
        </Card>

        {/* SHOP OVERHEAD RATES & RECURRING COST TAGGING */}
        <Card style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
            <div>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
                Shop Overhead Rates &amp; Cost-Tagging
              </div>
              <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "0 0 10px 0", lineHeight: 1.6, maxWidth: 640 }}>
                Hourly overhead is derived strictly from <strong>production-tagged costs</strong>. Each recurring shop expense is tagged production or admin with an editable percentage split. Floor area provides the defensible basis for premises. 5000 Raw Materials and 5010 Packaging never enter it to prevent double counting.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                const defaults = DEFAULT_RECURRING_COSTS
                setSetting("recurringCosts", defaults)
                const prodMo = calculateProductionOverhead(defaults)
                setSetting("monthlyOverhead", prodMo)
                const annHrs = settings.annualProductionHours !== undefined ? Number(settings.annualProductionHours) : 1800
                const ordCount = settings.ordersPerMonth !== undefined ? Number(settings.ordersPerMonth) : 20
                const rates = deriveOverheadRates(prodMo, annHrs, ordCount)
                setSetting("hourlyRate", rates.hourlyRate)
                setSetting("perOrderRate", rates.perOrderRate)
              }}
              style={{
                fontSize: 11.5,
                padding: "5px 10px",
                borderRadius: 6,
                border: "1px solid var(--border)",
                background: "var(--panel)",
                color: "var(--muted)",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 5
              }}
            >
              Restore Standard Costs
            </button>
          </div>

          {/* Cost Tagging Table */}
          <div style={{ overflowX: "auto", margin: "8px 0 14px 0", border: "1px solid var(--border)", borderRadius: 8 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#EDE5D6", color: "var(--text)", textAlign: "left", fontSize: 11 }}>
                  <th style={{ padding: "8px 10px" }}>Recurring Cost</th>
                  <th style={{ padding: "8px 10px" }}>Monthly (₦)</th>
                  <th style={{ padding: "8px 10px" }}>Allocation Basis</th>
                  <th style={{ padding: "8px 10px", width: 130 }}>Production %</th>
                  <th style={{ padding: "8px 10px", textAlign: "right" }}>Production (₦)</th>
                  <th style={{ padding: "8px 10px", textAlign: "right" }}>Admin (₦)</th>
                  <th style={{ padding: "8px 10px", width: 40, textAlign: "center" }}></th>
                </tr>
              </thead>
              <tbody>
                {(Array.isArray(settings.recurringCosts) ? settings.recurringCosts : DEFAULT_RECURRING_COSTS).map((cost, idx) => {
                  const amt = Math.max(0, Number(cost.amount) || 0)
                  const prodPct = Math.max(0, Math.min(100, Number(cost.productionPct ?? 100)))
                  const prodAmt = Math.round(amt * (prodPct / 100))
                  const adminAmt = amt - prodAmt

                  const updateCostField = (field, val) => {
                    const currentList = Array.isArray(settings.recurringCosts) ? [...settings.recurringCosts] : [...DEFAULT_RECURRING_COSTS]
                    currentList[idx] = { ...currentList[idx], [field]: val }
                    setSetting("recurringCosts", currentList)

                    const prodMo = calculateProductionOverhead(currentList)
                    setSetting("monthlyOverhead", prodMo)
                    const annHrs = settings.annualProductionHours !== undefined ? Number(settings.annualProductionHours) : 1800
                    const ordCount = settings.ordersPerMonth !== undefined ? Number(settings.ordersPerMonth) : 20
                    const rates = deriveOverheadRates(prodMo, annHrs, ordCount)
                    setSetting("hourlyRate", rates.hourlyRate)
                    setSetting("perOrderRate", rates.perOrderRate)
                  }

                  const removeCost = () => {
                    const currentList = (Array.isArray(settings.recurringCosts) ? settings.recurringCosts : DEFAULT_RECURRING_COSTS).filter((_, i) => i !== idx)
                    setSetting("recurringCosts", currentList)
                    const prodMo = calculateProductionOverhead(currentList)
                    setSetting("monthlyOverhead", prodMo)
                    const annHrs = settings.annualProductionHours !== undefined ? Number(settings.annualProductionHours) : 1800
                    const ordCount = settings.ordersPerMonth !== undefined ? Number(settings.ordersPerMonth) : 20
                    const rates = deriveOverheadRates(prodMo, annHrs, ordCount)
                    setSetting("hourlyRate", rates.hourlyRate)
                    setSetting("perOrderRate", rates.perOrderRate)
                  }

                  return (
                    <tr key={cost.id || idx} style={{ borderBottom: "1px solid var(--border)", background: idx % 2 === 0 ? "white" : "#FAF7F0" }}>
                      <td style={{ padding: "6px 10px" }}>
                        <input
                          value={cost.name || ""}
                          onChange={e => updateCostField("name", e.target.value)}
                          placeholder="Cost name..."
                          style={{ ...iSt, fontSize: 12, padding: "4px 8px", width: "100%", fontWeight: 500 }}
                        />
                      </td>
                      <td style={{ padding: "6px 10px" }}>
                        <input
                          type="number"
                          min="0"
                          step="1000"
                          value={cost.amount !== undefined ? cost.amount : ""}
                          onChange={e => updateCostField("amount", Math.max(0, parseFloat(e.target.value) || 0))}
                          style={{ ...iSt, fontSize: 12, padding: "4px 8px", width: 100 }}
                        />
                      </td>
                      <td style={{ padding: "6px 10px" }}>
                        <input
                          value={cost.basis || ""}
                          onChange={e => updateCostField("basis", e.target.value)}
                          placeholder="e.g. Floor area 70/30"
                          style={{ ...iSt, fontSize: 11, padding: "4px 8px", width: "100%", color: "var(--muted)" }}
                        />
                      </td>
                      <td style={{ padding: "6px 10px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            step="5"
                            value={prodPct}
                            onChange={e => updateCostField("productionPct", Number(e.target.value))}
                            style={{ flex: 1, accentColor: "var(--gold)" }}
                          />
                          <span style={{ fontSize: 11, fontWeight: 700, minWidth: 34, color: prodPct > 0 ? "var(--gold)" : "var(--muted)" }}>
                            {prodPct}%
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: 600, color: prodAmt > 0 ? "#166534" : "var(--muted)" }}>
                        ₦{prodAmt.toLocaleString()}
                      </td>
                      <td style={{ padding: "6px 10px", textAlign: "right", color: "var(--muted)" }}>
                        ₦{adminAmt.toLocaleString()}
                      </td>
                      <td style={{ padding: "6px 10px", textAlign: "center" }}>
                        <button
                          type="button"
                          onClick={removeCost}
                          style={{ border: "none", background: "transparent", color: "#B03A2E", cursor: "pointer", fontSize: 14 }}
                          title="Remove cost"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                {(() => {
                  const currentList = Array.isArray(settings.recurringCosts) ? settings.recurringCosts : DEFAULT_RECURRING_COSTS
                  const totalAll = currentList.reduce((s, c) => s + (Math.max(0, Number(c.amount) || 0)), 0)
                  const totalProd = calculateProductionOverhead(currentList)
                  const totalAdmin = Math.max(0, totalAll - totalProd)
                  return (
                    <tr style={{ background: "#F5F0E4", fontWeight: 700 }}>
                      <td style={{ padding: "8px 10px" }}>Total Outgoings</td>
                      <td style={{ padding: "8px 10px" }}>₦{Math.round(totalAll).toLocaleString()}</td>
                      <td colSpan={2} style={{ padding: "8px 10px", textAlign: "right", color: "var(--muted)", fontWeight: 500 }}>
                        Production vs Admin Split →
                      </td>
                      <td style={{ padding: "8px 10px", textAlign: "right", color: "var(--gold)", fontSize: 13 }}>
                        ₦{Math.round(totalProd).toLocaleString()}
                      </td>
                      <td style={{ padding: "8px 10px", textAlign: "right", color: "var(--muted)" }}>
                        ₦{Math.round(totalAdmin).toLocaleString()}
                      </td>
                      <td></td>
                    </tr>
                  )
                })()}
              </tfoot>
            </table>
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <button
              type="button"
              onClick={() => {
                const currentList = Array.isArray(settings.recurringCosts) ? [...settings.recurringCosts] : [...DEFAULT_RECURRING_COSTS]
                currentList.push({
                  id: `cost-${Date.now()}`,
                  name: "New Recurring Cost",
                  amount: 50000,
                  productionPct: 100,
                  basis: "Production use"
                })
                setSetting("recurringCosts", currentList)
                const prodMo = calculateProductionOverhead(currentList)
                setSetting("monthlyOverhead", prodMo)
                const annHrs = settings.annualProductionHours !== undefined ? Number(settings.annualProductionHours) : 1800
                const ordCount = settings.ordersPerMonth !== undefined ? Number(settings.ordersPerMonth) : 20
                const rates = deriveOverheadRates(prodMo, annHrs, ordCount)
                setSetting("hourlyRate", rates.hourlyRate)
                setSetting("perOrderRate", rates.perOrderRate)
              }}
              style={{
                fontSize: 12,
                padding: "5px 12px",
                borderRadius: 6,
                border: "1px dashed var(--gold)",
                background: "#FAF7F0",
                color: "var(--gold)",
                cursor: "pointer",
                fontWeight: 600
              }}
            >
              + Add Recurring Cost
            </button>
          </div>

          {/* Operational Hours, Monthly Orders, and Monthly Overhead */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 6 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 4 }}>
                Monthly Overhead (₦)
              </label>
              <input
                type="number"
                min="0"
                step="5000"
                placeholder="0"
                value={settings.monthlyOverhead !== undefined ? settings.monthlyOverhead : calculateProductionOverhead(settings.recurringCosts || DEFAULT_RECURRING_COSTS)}
                onChange={e => {
                  const val = Math.max(0, parseFloat(e.target.value) || 0)
                  setSetting("monthlyOverhead", val)
                  const annHrs = settings.annualProductionHours !== undefined ? Number(settings.annualProductionHours) : 1800
                  const ordCount = settings.ordersPerMonth !== undefined ? Number(settings.ordersPerMonth) : 20
                  const rates = deriveOverheadRates(val, annHrs, ordCount)
                  setSetting("hourlyRate", rates.hourlyRate)
                  setSetting("perOrderRate", rates.perOrderRate)
                }}
                style={{ ...iSt, fontSize: 13, padding: "7px 10px", width: "100%" }}
              />
              <span style={{ fontSize: 11, color: "var(--muted)", marginTop: 2, display: "block" }}>
                Derived from production-tagged costs above, or set directly.
              </span>
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 4 }}>
                Annual Production Hours
              </label>
              <input
                type="number"
                min="1"
                step="50"
                placeholder="1800"
                value={settings.annualProductionHours !== undefined ? settings.annualProductionHours : 1800}
                onChange={e => {
                  const val = Math.max(1, parseFloat(e.target.value) || 1)
                  setSetting("annualProductionHours", val)
                  const mo = settings.monthlyOverhead !== undefined ? Number(settings.monthlyOverhead) : calculateProductionOverhead(settings.recurringCosts || DEFAULT_RECURRING_COSTS)
                  const ordCount = settings.ordersPerMonth !== undefined ? Number(settings.ordersPerMonth) : 20
                  const rates = deriveOverheadRates(mo, val, ordCount)
                  setSetting("hourlyRate", rates.hourlyRate)
                  setSetting("perOrderRate", rates.perOrderRate)
                }}
                style={{ ...iSt, fontSize: 13, padding: "7px 10px", width: "100%" }}
              />
              <span style={{ fontSize: 11, color: "var(--muted)", marginTop: 2, display: "block" }}>
                Standard is 1,800 hrs/yr (approx 37.5 hrs/week).
              </span>
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 4 }}>
                Orders Per Month
              </label>
              <input
                type="number"
                min="1"
                step="1"
                placeholder="20"
                value={settings.ordersPerMonth !== undefined ? settings.ordersPerMonth : 20}
                onChange={e => {
                  const val = Math.max(1, parseFloat(e.target.value) || 1)
                  setSetting("ordersPerMonth", val)
                  const mo = settings.monthlyOverhead !== undefined ? Number(settings.monthlyOverhead) : calculateProductionOverhead(settings.recurringCosts || DEFAULT_RECURRING_COSTS)
                  const annHrs = settings.annualProductionHours !== undefined ? Number(settings.annualProductionHours) : 1800
                  const rates = deriveOverheadRates(mo, annHrs, val)
                  setSetting("hourlyRate", rates.hourlyRate)
                  setSetting("perOrderRate", rates.perOrderRate)
                }}
                style={{ ...iSt, fontSize: 13, padding: "7px 10px", width: "100%" }}
              />
              <span style={{ fontSize: 11, color: "var(--muted)", marginTop: 2, display: "block" }}>
                Average cake/pastry orders completed per month.
              </span>
            </div>
          </div>

          {/* Derived Rates Summary */}
          {(() => {
            const currentList = Array.isArray(settings.recurringCosts) ? settings.recurringCosts : DEFAULT_RECURRING_COSTS
            const prodMo = settings.monthlyOverhead !== undefined && settings.monthlyOverhead > 0
              ? Number(settings.monthlyOverhead)
              : calculateProductionOverhead(currentList)
            const annHrs = settings.annualProductionHours || 1800
            const ordCount = settings.ordersPerMonth || 20
            const rates = deriveOverheadRates(prodMo, annHrs, ordCount)

            return (
              <div style={{ marginTop: 14, padding: "12px 14px", background: "#F5F0E4", borderRadius: 8, border: "1px solid var(--border)" }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, color: "var(--muted)", marginBottom: 6 }}>
                  Derived Overhead Rates (Derived Production Overhead Rates)
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div style={{ background: "white", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border)" }}>
                    <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 500 }}>Hourly Rate</div>
                    <div style={{ fontSize: 17, fontWeight: 700, color: "var(--gold)", marginTop: 2 }}>
                      ₦{rates.hourlyRate.toLocaleString()} / hr
                    </div>
                    <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>
                      (₦{Math.round(prodMo).toLocaleString()} production overhead × 12) ÷ {annHrs} hrs
                    </div>
                  </div>
                  <div style={{ background: "white", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--border)" }}>
                    <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 500 }}>Per-Order Rate</div>
                    <div style={{ fontSize: 17, fontWeight: 700, color: "var(--gold)", marginTop: 2 }}>
                      ₦{rates.perOrderRate.toLocaleString()} / order
                    </div>
                    <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>
                      ₦{Math.round(prodMo).toLocaleString()} production overhead ÷ {ordCount} orders
                    </div>
                  </div>
                </div>
              </div>
            )
          })()}
        </Card>

        <Card style={{ marginBottom: 14 }}>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Accessories Allowance</div>
          <p style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 0, lineHeight: 1.7 }}>Small items like cling film, greaseproof paper and gas are too fiddly to measure for every single cake. This adds a small percentage on top of your ingredients to cover them, so nothing gets forgotten.</p>
          <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "12px 0" }}>
            <input type="range" min={0} max={30} value={settings.accessoryPct || 15} onChange={e => setSetting("accessoryPct", +e.target.value)} style={{ flex: 1, accentColor: "var(--gold)" }} />
            <div style={{ fontSize: 22, fontWeight: 700, color: "var(--gold)", minWidth: 46 }}>{settings.accessoryPct || 15}%</div>
          </div>
        </Card>
      </div>
    )}
  </div>
}

export function PanLibraryCard() {
  const [pans, setPans] = useState(() => getPanLibrary())
  const [newName, setNewName] = useState("")
  const [newWidth, setNewWidth] = useState("")
  const [newLength, setNewLength] = useState("")
  const [msg, setMsg] = useState("")

  const handleAdd = () => {
    const w = parseFloat(newWidth)
    const l = parseFloat(newLength)
    if (!w || w <= 0 || !l || l <= 0) {
      setMsg("Please enter valid width and length in inches.")
      return
    }
    const label = newName.trim() || `${w} × ${l} tray`
    const newPan = {
      id: `pan_${w}_${l}_${Date.now()}`,
      name: label,
      label,
      width: w,
      length: l
    }
    const updated = [...pans, newPan]
    savePanLibrary(updated)
    setPans(updated)
    setNewName("")
    setNewWidth("")
    setNewLength("")
    setMsg("Pan added to library.")
    setTimeout(() => setMsg(""), 3000)
  }

  const handleDelete = (idx) => {
    if (pans.length <= 1) {
      setMsg("You must keep at least one pan in your library.")
      return
    }
    const updated = pans.filter((_, i) => i !== idx)
    savePanLibrary(updated)
    setPans(updated)
    setMsg("Pan removed from library.")
    setTimeout(() => setMsg(""), 3000)
  }

  const handleReset = () => {
    savePanLibrary(DEFAULT_PAN_LIBRARY)
    setPans(getPanLibrary())
    setMsg("Restored standard pan library (9×13, 12×18, 16×24, 10×10).")
    setTimeout(() => setMsg(""), 3000)
  }

  return (
    <Card style={{ marginTop: 14, maxWidth: 480 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 14, fontWeight: 600 }}>Pan & Tray Library</div>
        <button
          type="button"
          onClick={handleReset}
          style={{ background: "transparent", border: "none", color: "var(--gold)", fontSize: 11, cursor: "pointer", textDecoration: "underline" }}
        >
          Restore standard trays
        </button>
      </div>
      <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 12px", lineHeight: 1.5 }}>
        Ships with standard commercial trays (9×13, 12×18, 16×24 and 10×10 square). Add your own custom trays, sheet pans, and brownie tins here.
      </p>

      {msg && <div style={{ fontSize: 11.5, color: "var(--gold)", background: "#FFF9EE", padding: "6px 10px", borderRadius: 6, marginBottom: 10 }}>{msg}</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
        {pans.map((p, idx) => {
          const w = p.width !== undefined ? p.width : p[1]
          const l = p.length !== undefined ? p.length : (p[2] !== undefined ? p[2] : w)
          const name = p.name || p.label || p[0] || `${w} × ${l} tray`
          const area = (Number(w) * Number(l)).toFixed(1)
          return (
            <div key={p.id || idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 10px", background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 7 }}>
              <div>
                <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>{name}</span>
                <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: 8 }}>({w}″ × {l}″ · {area} in²)</span>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(idx)}
                style={{ background: "transparent", border: "none", color: "#B03A2E", cursor: "pointer", padding: "2px 6px", fontSize: 13 }}
                title="Remove pan"
              >
                ✕
              </button>
            </div>
          )
        })}
      </div>

      <div style={{ borderTop: "1px dashed var(--border)", paddingTop: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>Add Custom Pan or Tray</div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 6, alignItems: "flex-end" }}>
          <div>
            <label style={{ fontSize: 10, color: "var(--muted)", display: "block", marginBottom: 2 }}>Pan Name</label>
            <input
              type="text"
              placeholder="e.g. 14 × 20 sheet"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              style={{ ...iSt, fontSize: 12, padding: "5px 8px" }}
            />
          </div>
          <div>
            <label style={{ fontSize: 10, color: "var(--muted)", display: "block", marginBottom: 2 }}>Width (in)</label>
            <input
              type="number"
              step="0.5"
              min="1"
              placeholder="14"
              value={newWidth}
              onChange={e => setNewWidth(e.target.value)}
              style={{ ...iSt, fontSize: 12, padding: "5px 8px" }}
            />
          </div>
          <div>
            <label style={{ fontSize: 10, color: "var(--muted)", display: "block", marginBottom: 2 }}>Length (in)</label>
            <input
              type="number"
              step="0.5"
              min="1"
              placeholder="20"
              value={newLength}
              onChange={e => setNewLength(e.target.value)}
              style={{ ...iSt, fontSize: 12, padding: "5px 8px" }}
            />
          </div>
          <button
            type="button"
            onClick={handleAdd}
            style={{ background: "var(--gold)", color: "#fff", border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", height: 32 }}
          >
            Add
          </button>
        </div>
      </div>
    </Card>
  )
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
    { v: "tokens", l: "AI Credits & Usage" },
    { v: "pricing", l: "Pricing & Margins" },
    { v: "stock", l: "Opening Stock" },
    { v: "notifications", l: "Notifications" }
  ]
  if (user?.role === "owner") tabList.push({ v: "users", l: "Users & Access" })
  tabList.push({ v: "backup", l: "Database & Data" })
  if (user?.role === "owner") tabList.push({ v: "danger", l: "Danger Zone" })
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
    if (["profitPct", "overheadPct", "accessoryPct", "miscPct", "monthlyOverhead", "annualProductionHours", "ordersPerMonth", "hourlyRate", "perOrderRate", "recurringCosts"].includes(field)) {
      savePricingSettingsOnServer({ [field]: val }).catch(() => {})
    }
  }, [setSettings])

  const handleLogo = e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = ev => co("logo", ev.target.result); r.readAsDataURL(f) }

  const addUser = async () => {
    if (!newUser.name || !newUser.pin) return setUserMsg("Name and PIN required")
    if (newUser.pin.length < 4) return setUserMsg("PIN must be at least 4 digits")

    const limitCheck = typeof checkPlanLimit === "function" ? checkPlanLimit("staffLogins") : { exceeded: false }
    if (limitCheck.exceeded) {
      if (typeof notifyPlanLimitReached === "function") {
        notifyPlanLimitReached(limitCheck)
      }
      setUserMsg(limitCheck.message)
      return
    }

    const updated = [...users, { ...newUser, id: uid(), active: true }]
    try {
      await saveUsers(updated)
      setUsers(updated)
      setNewUser({ name: "", role: "production", pin: "" })
      setUserMsg("User added")
    } catch (err) {
      setUserMsg(err.message || "Failed to add user")
    }
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

  // Dangerous Section: Account Deletion (Owner Only)
  const [deleteConfirm, setDeleteConfirm] = useState("")
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState("")
  const [accountDeleted, setAccountDeleted] = useState(false)

  const handleDeleteAccount = async () => {
    setDeleting(true)
    setDeleteError("")
    try {
      await deleteTenantAccountOnServer()
      setDeleting(false)
      setShowDeleteModal(false)
      setAccountDeleted(true)
      setTimeout(() => {
        window.location.href = "/"
      }, 1500)
    } catch (e) {
      setDeleteError(e.message || "Failed to delete account. Please try again.")
      setDeleting(false)
    }
  }

  return <div>
    <SHead title="Settings" sub="Company profile, pricing, users, and access control." />
    <Tabs tabs={tabList} active={tab} onChange={setTab} />

    {tab === "company" && <div style={{ maxWidth: 540 }}>
      {/* Onboarding Setup Wizard Launcher */}
      <Card style={{ marginBottom: 14, background: "linear-gradient(135deg, #FFFDF9, #FAF4E8)", border: "1px solid #E8D5A3" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(200,145,42,0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--gold)", flexShrink: 0 }}>
              <Sparkles size={20} />
            </div>
            <div>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 15, fontWeight: 600, color: "var(--text)" }}>
                Onboarding & Setup Wizard
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                Guided step-by-step setup for brand identity, starting inventory, recipes, and margins.
              </div>
            </div>
          </div>
          <Btn onClick={() => setView("onboarding")} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            Launch Setup Wizard →
          </Btn>
        </div>
      </Card>

      <Card>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 15, fontWeight: 600, marginBottom: 14 }}>Company Profile</div>
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 14 }}>
          <div onClick={() => logoRef.current?.click()} style={{ width: 80, height: 80, borderRadius: 10, border: "2px dashed var(--border)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", background: "#FAF7F0", flexShrink: 0, overflow: "hidden" }}>
            {company.logo ? (
              <img src={company.logo} alt="logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <div style={{ textAlign: "center", width: "100%", height: "100%", position: "relative" }}>
                <img src="/Bakewealthlogo.jpeg" alt="Default logo" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.65 }} />
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(253,250,244,0.7)", fontSize: 10.5, color: "var(--muted)", fontWeight: 600 }}>Change<br />Logo</div>
              </div>
            )}
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
            <span>Manage Credits & Usage</span>
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

    {tab === "pricing" && (
      <div>
        <PricingSetup settings={settings} setSetting={st} />
        <PanLibraryCard />
      </div>
    )}

    {tab === "stock" && <OpeningStock inventory={inventory} setInventory={setInventory} user={user} company={company} />}
    {tab === "notifications" && <NotificationSettings />}

    {tab === "users" && <div>
      <div style={{ marginBottom: 14, padding: "10px 14px", background: "#EEF8F3", borderRadius: 8, fontSize: 13, color: "#2D7A50", border: "1px solid #C2E0CF" }}>
        <strong>Access Levels:</strong> Owner = full access. Production = can log cakes & scan receipts only (no prices visible, no delete). Customer Service = can view orders & create invoices only.
      </div>
      {userMsg && <Alert msg={userMsg} color="green" onClose={() => setUserMsg("")} />}
      {typeof checkPlanLimit === "function" && checkPlanLimit("staffLogins")?.exceeded && (
        <div style={{ marginBottom: 14, padding: "10px 14px", background: "#FFF4E5", borderRadius: 8, fontSize: 13, color: "#8A4E00", border: "1px solid #FFE2B8", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <AlertTriangle size={16} color="#D97706" style={{ flexShrink: 0 }} />
            <span>Staff logins require a Standard plan (up to 2 staff) or Premium plan (up to 4 staff). Upgrade to invite your team.</span>
          </div>
          <Btn small onClick={() => typeof notifyPlanLimitReached === "function" && notifyPlanLimitReached(checkPlanLimit("staffLogins"))}>Upgrade</Btn>
        </div>
      )}
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

      {user?.role === "owner" && (
        <Card style={{ border: "2px solid #E53E3E", background: "#FFF5F5", marginTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 15, fontWeight: 700, color: "#9B2C2C", display: "flex", alignItems: "center", gap: 6 }}>
                <Trash2 size={16} /> Danger Zone: Delete Account
              </div>
              <div style={{ fontSize: 12.5, color: "#742A2A", marginTop: 4 }}>
                Want to permanently delete this bakery account and purge all data from the database?
              </div>
            </div>
            <Btn variant="danger" onClick={() => setTab("danger")}>
              Open Dangerous Section
            </Btn>
          </div>
        </Card>
      )}
    </div>}

    {tab === "danger" && user?.role === "owner" && <div style={{ maxWidth: 600 }}>
      {accountDeleted && (
        <div style={{ padding: "14px 18px", background: "#E5F4EC", border: "1px solid #357A52", borderRadius: 10, color: "#2D7A50", fontWeight: 600, marginBottom: 16 }}>
          Your account and all associated database records have been permanently deleted. Redirecting to login...
        </div>
      )}

      {deleteError && (
        <Alert msg={deleteError} color="red" onClose={() => setDeleteError("")} />
      )}

      {/* Warning Overview Banner */}
      <Card style={{ border: "2px solid #E53E3E", background: "#FFF5F5", marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: "#FED7D7",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0
          }}>
            <AlertTriangle size={20} color="#C53030" />
          </div>
          <div>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, fontWeight: 700, color: "#9B2C2C", marginBottom: 4 }}>
              Dangerous Section: Irreversible Actions
            </div>
            <div style={{ fontSize: 13, color: "#742A2A", lineHeight: 1.6 }}>
              The actions in this section are highly destructive and <strong>cannot be undone</strong>. They permanently wipe records directly from your PostgreSQL cloud database. Only bakery owners have permission to perform these actions.
            </div>
          </div>
        </div>
      </Card>

      {/* Section 1: Clear Business Data */}
      <Card style={{ border: "1px solid #FEB2B2", marginBottom: 16 }}>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 15, fontWeight: 600, marginBottom: 6, color: "#9B2C2C", display: "flex", alignItems: "center", gap: 6 }}>
          <AlertTriangle size={15} /> Reset Business Data (Keep Account)
        </div>
        <div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.7, marginBottom: 14 }}>
          Clears all operational records directly from the database (all inventory items, opening stock, orders, quotes, recipes, purchases, expenses, and clients). <strong>Your tenant account, owner profile, and employee logins will remain active.</strong>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}>
            <Inp
              id="clear-data-confirm-input"
              label={`Type "${company.name || 'BakeWealth'}" to confirm reset`}
              value={clearConfirm}
              onChange={setClearConfirm}
              placeholder={company.name || 'BakeWealth'}
            />
          </div>
          <Btn
            variant="danger"
            disabled={clearing || clearConfirm !== (company.name || 'BakeWealth')}
            onClick={clearAllData}
          >
            {clearing ? "Clearing Database..." : "Clear Business Data"}
          </Btn>
        </div>
      </Card>

      {/* Section 2: Delete Entire Account Permanently */}
      <Card style={{ border: "2px solid #9B2C2C", background: "#FFF5F5" }}>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, fontWeight: 700, marginBottom: 6, color: "#742A2A", display: "flex", alignItems: "center", gap: 8 }}>
          <Trash2 size={18} color="#9B2C2C" /> Delete Account Permanently (Purge Database)
        </div>
        <div style={{ fontSize: 13, color: "#742A2A", lineHeight: 1.7, marginBottom: 14 }}>
          Permanently delete <strong>{company.name || 'this bakery'}</strong> from the database. This will completely erase:
          <ul style={{ margin: "8px 0 10px 18px", padding: 0, fontSize: 12.5, color: "#9B2C2C", lineHeight: 1.6 }}>
            <li>Your bakery company profile & subscription/token balances</li>
            <li>All owner and employee user accounts & login credentials</li>
            <li>All orders, order items, payments, and client profiles</li>
            <li>All invoices, payment attempts, and transaction records</li>
            <li>All recipes, recipe ingredients, and costing formulas</li>
            <li>All inventory items, purchases, and opening stock history</li>
            <li>All expenses, decorations, packaging, and company backups</li>
          </ul>
          <strong style={{ color: "#742A2A" }}>Everything will be permanently purged from the cloud database. There is no recovery or rollback possible.</strong>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}>
            <Inp
              id="delete-account-confirm-input"
              label={`Type "${company.name || 'BakeWealth'}" to permanently delete account`}
              value={deleteConfirm}
              onChange={setDeleteConfirm}
              placeholder={company.name || 'BakeWealth'}
            />
          </div>
          <Btn
            id="trigger-delete-account-btn"
            variant="danger"
            disabled={deleting || deleteConfirm !== (company.name || 'BakeWealth')}
            onClick={() => setShowDeleteModal(true)}
            style={{ fontWeight: 600, padding: "8px 18px" }}
          >
            {deleting ? "Deleting Account..." : "Delete Account"}
          </Btn>
        </div>
      </Card>

      {/* Confirmation Modal */}
      {showDeleteModal && (
        <Modal title="Confirm Permanent Account Deletion" onClose={() => !deleting && setShowDeleteModal(false)}>
          <div style={{ padding: "4px 0" }}>
            <div style={{
              background: "#FED7D7",
              border: "1px solid #E53E3E",
              borderRadius: 8,
              padding: "12px 14px",
              display: "flex",
              alignItems: "center",
              gap: 10,
              color: "#9B2C2C",
              marginBottom: 16
            }}>
              <AlertTriangle size={24} style={{ flexShrink: 0 }} />
              <div style={{ fontSize: 13, lineHeight: 1.5, fontWeight: 500 }}>
                This is the final confirmation. Once confirmed, all records for <strong>{company.name || 'your bakery'}</strong> will be wiped from the PostgreSQL database immediately.
              </div>
            </div>

            <p style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.6, marginBottom: 16 }}>
              Are you completely sure you want to proceed? You and your staff will be logged out instantly and all access will be terminated forever.
            </p>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
              <Btn
                variant="ghost"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
              >
                Cancel
              </Btn>
              <Btn
                id="confirm-permanent-delete-btn"
                variant="danger"
                onClick={handleDeleteAccount}
                disabled={deleting}
              >
                {deleting ? "Deleting Everything..." : "Yes, Permanently Delete Everything"}
              </Btn>
            </div>
          </div>
        </Modal>
      )}
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
