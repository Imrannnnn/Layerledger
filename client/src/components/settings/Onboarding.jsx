/**
 * Onboarding.jsx
 * ----------------------------------------------------------------------------
 * Step-by-step wizard shown to new users on their very first login.
 * Handles Business Details (with Excel Import), Opening Stock (with Lock button),
 * Base Recipes (only Vanilla Cake seeded initially), Profit Margin slider,
 * and Completion (redirecting to Order Calculator).
 * ----------------------------------------------------------------------------
 */
import React, { useState, useRef } from "react"
import { Btn, iSt, Inp, Sel, Card, Badge, Modal, Alert } from "../common/ui.jsx"
import { saveCompany, saveSetting, saveInventory, saveRecipes, saveLocal, loadLocal } from "../../lib/data.js"
import { uid, fmt, parseCSV } from "../../lib/helpers.js"

export function Onboarding({ gold, company, setCompany, inventory, setInventory, recipes, setRecipes, settings, setSettings, onComplete, onSkip, setView }) {
  const [step, setStep] = useState(1)
  const logoRef = useRef()

  // Step 2: Opening Stock State
  const [os, setOs] = useState(() => loadLocal("ll_opening_stock", {}))
  const [savedOS, setSavedOS] = useState(false)
  const curMonth = new Date().toLocaleDateString("en-NG", { month: "long", year: "numeric" })

  // Step 3: Base Recipes State
  const [recipeModal, setRecipeModal] = useState(null)

  // Step 4: Margin State
  const [profitPct, setProfitPct] = useState(settings.profitPct || 40)

  // Excel Import Modal State (Step 1)
  const [showImport, setShowImport] = useState(false)
  const [importStep, setImportStep] = useState(1) // 1 = paste columns, 2 = preview, 3 = done
  const [pasteN, setPasteN] = useState("")
  const [pasteU, setPasteU] = useState("")
  const [pasteC, setPasteC] = useState("")
  const [prevItems, setPrevItems] = useState([])
  const [warnMsg, setWarnMsg] = useState("")
  const [importMsg, setImportMsg] = useState("")

  // Recipe Import Modal State (Step 3)
  const [showRecipeImport, setShowRecipeImport] = useState(false)
  const [recipeImportStep, setRecipeImportStep] = useState(1)
  const [pasteRecipeNames, setPasteRecipeNames] = useState("")
  const [prevRecipes, setPrevRecipes] = useState([])
  const [recipeImportMsg, setRecipeImportMsg] = useState("")

  // Step 2: Manual Add State
  const [showManualAdd, setShowManualAdd] = useState(false)
  const [calcMode, setCalcMode] = useState("auto") // "auto" or "manual"
  const [manualItem, setManualItem] = useState({ name: "", unit: "kg", cost: "", openingQty: "", totalPaid: "", qtyBought: "" })

  const co = (field, val) => {
    const u = { ...company, [field]: val }
    setCompany(u)
    saveCompany(u)
  }

  const st = (field, val) => {
    const u = { ...settings, [field]: val }
    setSettings(u)
    saveSetting(field, val)
  }

  const handleLogo = e => {
    const f = e.target.files[0]
    if (!f) return
    const r = new FileReader()
    r.onload = ev => co("logo", ev.target.result)
    r.readAsDataURL(f)
  }

  // Excel Importer Helpers
  const L = v => v.trim().split(String.fromCharCode(10)).map(s => s.replace(/,/g, "").trim()).filter(Boolean)

  const checkMatch = () => {
    const ns = L(pasteN), cs = L(pasteC)
    if (ns.length > 0 && cs.length > 0 && ns.length !== cs.length) {
      setWarnMsg(`Names: ${ns.length} rows — Costs: ${cs.length} rows. Must match.`)
    } else {
      setWarnMsg("")
    }
  }

  const doPreview = () => {
    setImportMsg("")
    const ns = L(pasteN), us = L(pasteU), cs = L(pasteC)
    if (!ns.length || !cs.length) {
      return setImportMsg("Item names and cost per unit are required")
    }
    if (ns.length !== cs.length) {
      return setImportMsg(`Names (${ns.length}) and costs (${cs.length}) must have same number of rows`)
    }
    const items = ns.map((name, i) => {
      const rawCost = cs[i] || ""
      const cleanedCostStr = rawCost.replace(/[^0-9.]/g, "")
      const parsedCost = parseFloat(cleanedCostStr) || 0
      return {
        id: uid(),
        name,
        unit: us[i] || "kg",
        cost: parsedCost,
        stock: 0,
        minStock: 5,
        on: true,
        cat: "Dry Goods"
      }
    }).filter(p => p.name && p.cost)
    if (!items.length) {
      return setImportMsg("No valid items found")
    }
    setPrevItems(items)
    setImportStep(2)
  }

  const confirmImport = async () => {
    const approved = prevItems.filter(p => p.on)
    const updated = [...inventory, ...approved.filter(ni => !inventory.find(i => i.name.toLowerCase() === ni.name.toLowerCase()))]
    setInventory(updated)
    await saveInventory(updated)
    setPasteN("")
    setPasteU("")
    setPasteC("")
    setImportStep(3)
  }

  const doRecipePreview = () => {
    setRecipeImportMsg("")
    const names = pasteRecipeNames.trim().split(String.fromCharCode(10)).map(s => s.trim()).filter(Boolean)
    if (!names.length) {
      return setRecipeImportMsg("Recipe names are required")
    }
    const newRecs = names.map(name => ({
      id: uid(),
      name,
      notes: "Cake layer recipe",
      ing: [{ iid: "", qty: "" }],
      on: true
    }))
    setPrevRecipes(newRecs)
    setRecipeImportStep(2)
  }

  const confirmRecipeImport = async () => {
    const approved = prevRecipes.filter(r => r.on)
    const updated = [...recipes, ...approved.filter(nr => !recipes.find(r => r.name.toLowerCase() === nr.name.toLowerCase()))]
    setRecipes(updated)
    await saveRecipes(updated)
    setPasteRecipeNames("")
    setRecipeImportStep(3)
  }

  // Opening Stock Helpers (Step 2)
  const updateOS = async (id, val) => {
    const updated = { ...os, [id]: parseFloat(val) || 0 }
    setOs(updated)
    await saveLocal("ll_opening_stock", updated)
    setSavedOS(false)
  }

  const updateCost = async (id, val) => {
    const updatedInv = inventory.map(item => item.id === id ? { ...item, cost: parseFloat(val) || 0 } : item)
    setInventory(updatedInv)
    await saveInventory(updatedInv)
  }

  const lockOpeningStock = async () => {
    const monthKey = "ll_os_" + new Date().toISOString().slice(0, 7)
    const snapshot = {
      date: new Date().toISOString(),
      items: inventory.map(i => ({
        id: i.id,
        name: i.name,
        unit: i.unit,
        openingQty: os[i.id] || 0,
        cost: i.cost
      }))
    }
    await saveLocal(monthKey, snapshot)
    await saveLocal("ll_opening_stock", os)

    // Set live inventory levels to match these opening stocks
    const updatedInventory = inventory.map(item => ({
      ...item,
      stock: os[item.id] || 0
    }))
    setInventory(updatedInventory)
    await saveInventory(updatedInventory)

    setSavedOS(true)
    setTimeout(() => {
      setStep(3)
    }, 800)
  }

  const handleManualAdd = async () => {
    let costNum = 0
    if (calcMode === "auto") {
      const paid = parseFloat(manualItem.totalPaid) || 0
      const qty = parseFloat(manualItem.qtyBought) || 0
      if (!manualItem.name.trim() || !manualItem.totalPaid || !manualItem.qtyBought) {
        alert("Item name, total amount paid, and quantity bought are required")
        return
      }
      if (qty <= 0) {
        alert("Quantity bought must be greater than zero")
        return
      }
      costNum = paid / qty
    } else {
      if (!manualItem.name.trim() || !manualItem.cost) {
        alert("Item name and cost per unit are required")
        return
      }
      costNum = parseFloat(manualItem.cost) || 0
    }

    const qtyNum = parseFloat(manualItem.openingQty) || 0
    const newItem = {
      id: uid(),
      name: manualItem.name.trim(),
      unit: manualItem.unit || "kg",
      cost: costNum,
      stock: qtyNum,
      minStock: 5,
      on: true,
      cat: "Dry Goods"
    }

    const updated = [...inventory, newItem]
    setInventory(updated)
    await saveInventory(updated)

    const updatedOS = { ...os, [newItem.id]: qtyNum }
    setOs(updatedOS)
    await saveLocal("ll_opening_stock", updatedOS)

    setManualItem({ name: "", unit: "kg", cost: "", openingQty: "", totalPaid: "", qtyBought: "" })
    setCalcMode("auto")
    setShowManualAdd(false)
  }

  // Recipe Helpers (Step 3)
  const openRecipe = (r) => {
    setRecipeModal(r ? { ...r } : { id: uid(), name: "", type: "layer", notes: "", ing: [{ iid: "", qty: "" }] })
  }

  const saveRecipe = async () => {
    if (!recipeModal.name.trim()) return alert("Recipe name is required")
    const updated = recipes.find(r => r.id === recipeModal.id)
      ? recipes.map(r => r.id === recipeModal.id ? recipeModal : r)
      : [...recipes, recipeModal]
    setRecipes(updated)
    await saveRecipes(updated)
    setRecipeModal(null)
  }

  const deleteRecipe = async (id) => {
    if (!confirm("Delete this recipe?")) return
    const updated = recipes.filter(r => r.id !== id)
    setRecipes(updated)
    await saveRecipes(updated)
  }

  const addIngToRecipe = () => setRecipeModal(r => ({ ...r, ing: [...r.ing, { iid: "", qty: "" }] }))
  const updateIng = (idx, field, val) => setRecipeModal(r => ({ ...r, ing: r.ing.map((ing, i) => i === idx ? { ...ing, [field]: val } : ing) }))
  const removeIng = (idx) => setRecipeModal(r => ({ ...r, ing: r.ing.filter((_, i) => i !== idx) }))

  const getMarginLabel = (val) => {
    if (val <= 25) return "Low profit margin (For bulk wholesale or basic budget cakes)"
    if (val <= 45) return "Healthy profit margin (Recommended standard for bakeries)"
    if (val <= 65) return "High profit margin (For highly custom premium cake designs)"
    return "Very high profit margin (Luxury/High-end custom cake studio)"
  }

  const pct = Math.round(((step - 1) / 5) * 100)

  return (
    <div style={{ minHeight: "100vh", background: "#F4EEE4", display: "flex", alignItems: "center", justifyItems: "center", justifyContent: "center", padding: 24, fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&display=swap');
        * { box-sizing: border-box }
        :root {
          --gold: ${gold};
          --bg: #F4EEE4;
          --panel: #FDFAF4;
          --text: #291608;
          --muted: #8C6E52;
          --border: #E0D3BB;
        }
      `}</style>

      <div style={{ width: "100%", maxWidth: 540, background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 16, padding: "30px 28px", boxShadow: "0 8px 30px rgba(41,22,8,0.06)" }}>
        
        {/* Progress bar */}
        {step < 5 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--muted)", fontWeight: 500, marginBottom: 6 }}>
              <span>Setup progress: Step {step} of 5</span>
              <span>{pct}%</span>
            </div>
            <div style={{ height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: gold, borderRadius: 3, transition: "width 0.4s ease" }} />
            </div>
          </div>
        )}

        {/* STEP 1: BUSINESS DETAILS */}
        {step === 1 && (
          <div>
            <div style={{ textAlign: "center", marginBottom: 22 }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>Step 1 — Business Details</div>
              <div style={{ fontSize: 13, color: "var(--muted)" }}>Let's set up your bakery's brand identity.</div>
            </div>

            <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 20 }}>
              <div onClick={() => logoRef.current?.click()} style={{ width: 80, height: 80, borderRadius: 10, border: "2px dashed var(--border)", display: "flex", alignItems: "center", justifyItems: "center", justifyContent: "center", cursor: "pointer", background: "#FAF7F0", flexShrink: 0, overflow: "hidden", transition: "border-color 0.2s" }} onMouseEnter={e => e.currentTarget.style.borderColor = gold} onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}>
                {company.logo ? (
                  <img src={company.logo} alt="logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <div style={{ textAlign: "center", fontSize: 10.5, color: "var(--muted)", fontWeight: 500 }}>Upload<br />Logo</div>
                )}
              </div>
              <input ref={logoRef} type="file" accept="image/*" onChange={handleLogo} style={{ display: "none" }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>Bakery Logo</div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>Upload a JPG or PNG. This logo will appear on all customer invoices and quotes.</div>
              </div>
            </div>

            <Inp label="Business Name *" value={company.name} onChange={v => co("name", v)} placeholder="e.g. Fayvouree Luxe Cakes Studio" />
            <Inp label="Address" value={company.address} onChange={v => co("address", v)} placeholder="e.g. Abuja, Nigeria" />
            <Inp label="Phone Number" value={company.phone} onChange={v => co("phone", v)} placeholder="e.g. +234 80 1234 5678" />
            <Inp label="Email Address" value={company.email} onChange={v => co("email", v)} placeholder="e.g. contact@fayvoureecakes.com" />

            <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end", alignItems: "center" }}>
              <Btn disabled={!company.name?.trim()} onClick={() => setStep(2)}>Next: Set Up Opening Stock →</Btn>
            </div>

            {/* IMPORT MODAL */}
            {showImport && (
              <Modal title="Import — Excel, PDF or a photo" onClose={() => setShowImport(false)}>
                {importStep === 1 && (
                  <div>
                    <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 10, lineHeight: 1.7 }}>
                      Open your Excel. Copy each column and paste into its own box. Only item names and cost per unit are required.
                    </div>
                    {importMsg && <div style={{ padding: "7px 12px", background: "#FDEBE9", borderRadius: 7, fontSize: 12, color: "#B03A2E", marginBottom: 10 }}>⚠ {importMsg}</div>}
                    
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 10 }}>
                      <div>
                        <label style={{ fontSize: 10, color: "var(--muted)", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: .8, fontWeight: 500 }}>Item Names *</label>
                        <textarea value={pasteN} onChange={e => { setPasteN(e.target.value); checkMatch() }} placeholder={"Flour\nSugar\nOil\nEggs"} style={{ width: "100%", minHeight: 120, padding: "8px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--panel)", fontSize: 12, fontFamily: "monospace", color: "var(--text)", boxSizing: "border-box", resize: "vertical", outline: "none" }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 10, color: "var(--muted)", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: .8, fontWeight: 500 }}>Unit (optional)</label>
                        <textarea value={pasteU} onChange={e => setPasteU(e.target.value)} placeholder={"kg\nkg\nL\npcs"} style={{ width: "100%", minHeight: 120, padding: "8px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--panel)", fontSize: 12, fontFamily: "monospace", color: "var(--text)", boxSizing: "border-box", resize: "vertical", outline: "none" }} />
                        <div style={{ fontSize: 9.5, color: "var(--muted)", marginTop: 3 }}>Defaults to kg</div>
                      </div>
                      <div>
                        <label style={{ fontSize: 10, color: "var(--gold)", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: .8, fontWeight: 500 }}>Cost / Unit *</label>
                        <textarea value={pasteC} onChange={e => { setPasteC(e.target.value); checkMatch() }} placeholder={"1140\n1500\n3000\n700"} style={{ width: "100%", minHeight: 120, padding: "8px", borderRadius: 8, border: "1px solid #E8D5A3", background: "#FFF9EE", fontSize: 12, fontFamily: "monospace", color: "var(--text)", boxSizing: "border-box", resize: "vertical", outline: "none" }} />
                      </div>
                    </div>
                    {warnMsg && <div style={{ padding: "7px 12px", background: "#FDEBE9", borderRadius: 7, fontSize: 12, color: "#B03A2E", marginBottom: 10 }}>⚠ {warnMsg}</div>}
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
                      <Btn onClick={doPreview} disabled={!pasteN.trim() || !pasteC.trim() || !!warnMsg}>Preview import →</Btn>
                      <Btn variant="ghost" onClick={() => setShowImport(false)}>Cancel</Btn>
                    </div>
                  </div>
                )}

                {importStep === 2 && (
                  <div>
                    <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 10 }}>Toggle off anything you don't want to import.</div>
                    <div style={{ overflowY: "auto", maxHeight: 220, marginBottom: 12 }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                        <thead>
                          <tr style={{ background: "#EDE5D6" }}>
                            {["", "Item", "Unit", "Cost/Unit"].map(h => <th key={h} style={{ padding: "7px 10px", textAlign: h === "Cost/Unit" ? "right" : "left", fontSize: 10, textTransform: "uppercase", letterSpacing: .8, color: "var(--muted)", fontWeight: 500 }}>{h}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {prevItems.map((p, i) => (
                            <tr key={p.id} style={{ background: i % 2 === 0 ? "var(--panel)" : "#F8F3EA", opacity: p.on ? 1 : 0.35 }}>
                              <td style={{ padding: "6px 10px" }}>
                                <div onClick={() => setPrevItems(prev => prev.map((x, j) => j === i ? { ...x, on: !x.on } : x))} style={{ width: 30, height: 16, borderRadius: 8, background: p.on ? "#357A52" : "var(--border)", cursor: "pointer", position: "relative" }}>
                                  <div style={{ width: 12, height: 12, borderRadius: "50%", background: "white", position: "absolute", top: 2, left: p.on ? 16 : 2, transition: "left 0.2s" }} />
                                </div>
                              </td>
                              <td style={{ padding: "6px 10px", fontWeight: 500 }}>{p.name}</td>
                              <td style={{ padding: "6px 10px", color: "var(--muted)" }}>{p.unit}</td>
                              <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: 500, color: "var(--gold)" }}>{fmt(p.cost)}/{p.unit}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      <Btn variant="success" onClick={confirmImport} disabled={!prevItems.some(p => p.on)}>✓ Import {prevItems.filter(p => p.on).length} Items</Btn>
                      <Btn variant="ghost" onClick={() => setImportStep(1)}>← Edit</Btn>
                    </div>
                  </div>
                )}

                {importStep === 3 && (
                  <div style={{ textAlign: "center", padding: "16px 0" }}>
                    <div style={{ fontSize: 16, color: "#357A52", fontWeight: 600, marginBottom: 6 }}>✓ Import complete!</div>
                    <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 14 }}>Ingredients added to your inventory list. You can configure their stock next.</div>
                    <Btn onClick={() => { setImportStep(1); setShowImport(false) }}>Done</Btn>
                  </div>
                )}
              </Modal>
            )}
          </div>
        )}

        {/* STEP 2: SET UP OPENING STOCK */}
        {step === 2 && (
          <div>
            <div style={{ textAlign: "center", marginBottom: 22 }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>Step 2 — Opening Stock</div>
              <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>Set your starting quantities for {curMonth}. These levels establish your initial record for the month.</div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)" }}>Inventory Items</div>
              <div style={{ display: "flex", gap: 8 }}>
                <Btn small variant="outline" onClick={() => { setImportStep(1); setShowImport(true) }}>📥 Import — Excel, PDF or a photo</Btn>
                <Btn small variant="outline" onClick={() => setShowManualAdd(true)}>✍️ Add manually</Btn>
              </div>
            </div>

            <div style={{ overflowY: "auto", maxHeight: 260, border: "1px solid var(--border)", borderRadius: 10, marginBottom: 16 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#EDE5D6", position: "sticky", top: 0, zIndex: 10 }}>
                    {["Item", "Unit", "Opening Stock Qty", "Cost/Unit", "Opening Value"].map(h => (
                      <th key={h} style={{ padding: "8px 10px", textAlign: (h === "Item" || h === "Unit") ? "left" : "right", fontSize: 10, textTransform: "uppercase", letterSpacing: .8, color: "var(--muted)", fontWeight: 500 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {inventory.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: "20px", textAlign: "center", color: "var(--muted)", fontSize: 12.5 }}>
                        No items added yet. Click "Import from Excel" or "Add Item" above to get started.
                      </td>
                    </tr>
                  ) : (
                    inventory.map((item, i) => {
                      const qty = os[item.id] || 0
                      const value = qty * item.cost
                      return (
                        <tr key={item.id} style={{ background: i % 2 === 0 ? "var(--panel)" : "#F8F3EA" }}>
                          <td style={{ padding: "8px 10px", fontWeight: 500 }}>{item.name}</td>
                          <td style={{ padding: "8px 10px", color: "var(--muted)" }}>{item.unit}</td>
                          <td style={{ padding: "8px 10px", textAlign: "right" }}>
                            <input
                              type="number"
                              value={qty || ""}
                              onChange={e => updateOS(item.id, e.target.value)}
                              placeholder="0"
                              style={{ ...iSt, width: 70, padding: "4px 8px", fontSize: 13, textAlign: "right" }}
                            />
                          </td>
                          <td style={{ padding: "8px 10px", textAlign: "right" }}>
                            <input
                              type="number"
                              value={item.cost || ""}
                              onChange={e => updateCost(item.id, e.target.value)}
                              placeholder="0"
                              style={{ ...iSt, width: 85, padding: "4px 8px", fontSize: 13, textAlign: "right" }}
                            />
                          </td>
                          <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 500 }}>{fmt(value)}</td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Btn variant="ghost" onClick={() => setStep(1)}>← Back</Btn>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {savedOS && <span style={{ fontSize: 12.5, color: "#357A52", fontWeight: 500 }}>✓ Locked permanently</span>}
                <Btn variant="success" onClick={lockOpeningStock}>🔒 Lock Open Stock for {curMonth}</Btn>
              </div>
            </div>

            {/* MANUAL ADD MODAL */}
            {showManualAdd && (
              <Modal title="Add Item Manually" onClose={() => setShowManualAdd(false)}>
                <Inp label="Item Name *" value={manualItem.name} onChange={v => setManualItem(m => ({ ...m, name: v }))} placeholder="e.g. Flour, Butter, Eggs" />
                <Sel 
                  label="Unit *" 
                  value={manualItem.unit} 
                  onChange={v => setManualItem(m => ({ ...m, unit: v }))} 
                  options={["kg", "g", "L", "ml", "pcs", "pack"]} 
                  placeholder="Select unit"
                />
                
                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                  <button
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
                      fontSize: "12.5px"
                    }}
                  >
                    I don't know the cost/unit
                  </button>
                  <button
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
                      fontSize: "12.5px"
                    }}
                  >
                    I know the cost/unit
                  </button>
                </div>

                {calcMode === "auto" ? (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                    <div style={{ gridColumn: "span 2" }}>
                      <Inp label="Total Amount Paid (₦) *" type="number" value={manualItem.totalPaid} onChange={v => setManualItem(m => ({ ...m, totalPaid: v }))} placeholder="e.g. 5000" />
                    </div>
                    <div style={{ gridColumn: "span 2" }}>
                      <Inp label="Quantity Bought *" type="number" value={manualItem.qtyBought} onChange={v => setManualItem(m => ({ ...m, qtyBought: v }))} placeholder="e.g. 2.5" />
                    </div>
                    {manualItem.totalPaid && manualItem.qtyBought && parseFloat(manualItem.qtyBought) > 0 && (
                      <div style={{ gridColumn: "span 2", padding: "8px 12px", background: "var(--bg)", borderRadius: 8, fontSize: 13, fontWeight: 500, color: "var(--gold)" }}>
                        Calculated Cost per Unit: {fmt(parseFloat(manualItem.totalPaid) / parseFloat(manualItem.qtyBought))}/{manualItem.unit}
                      </div>
                    )}
                  </div>
                ) : (
                  <Inp label="Cost per Unit (₦) *" type="number" value={manualItem.cost} onChange={v => setManualItem(m => ({ ...m, cost: v }))} placeholder="e.g. 1500" />
                )}

                <Inp label="Opening Qty (optional)" type="number" value={manualItem.openingQty} onChange={v => setManualItem(m => ({ ...m, openingQty: v }))} placeholder="e.g. 5" />
                
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
                  <Btn variant="success" onClick={handleManualAdd} disabled={!manualItem.name.trim() || (calcMode === "auto" ? (!manualItem.totalPaid || !manualItem.qtyBought) : !manualItem.cost)}>✓ Add Item</Btn>
                  <Btn variant="ghost" onClick={() => setShowManualAdd(false)}>Cancel</Btn>
                </div>
              </Modal>
            )}
          </div>
        )}

        {/* STEP 3: BASE RECIPES */}
        {step === 3 && (
          <div>
            <div style={{ textAlign: "center", marginBottom: 22 }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>Step 3 — Base Recipes</div>
              <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>We've set up Vanilla Cake as your initial base recipe. You can edit it or add your own custom recipes.</div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 280, overflowY: "auto", marginBottom: 16 }}>
              {recipes.map(r => {
                const totalCost = r.ing.reduce((s, ing) => {
                  const it = inventory.find(x => x.id === ing.iid)
                  return s + (it ? it.cost * ing.qty : 0)
                }, 0)
                return (
                  <div key={r.id} style={{ background: "#FAF7F0", padding: "12px 14px", borderRadius: 8, border: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{r.name}</div>
                      <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>{r.notes || "Cake layer recipe"}</div>
                      <div style={{ fontSize: 11, color: gold, fontWeight: 600, marginTop: 4 }}>Cost: {fmt(totalCost)} / layer</div>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <Btn small variant="ghost" onClick={() => openRecipe(r)}>Edit</Btn>
                      {r.id !== "r1" && <Btn small variant="danger" onClick={() => deleteRecipe(r.id)}>×</Btn>}
                    </div>
                  </div>
                )
              })}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <Btn small variant="outline" onClick={() => { setRecipeImportStep(1); setShowRecipeImport(true) }}>📥 Import — Excel, PDF or a photo</Btn>
                <Btn small variant="outline" onClick={() => openRecipe(null)}>✍️ Add manually</Btn>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Btn variant="ghost" onClick={() => setStep(2)}>← Back</Btn>
                <Btn onClick={() => setStep(4)}>Next: Profit Margin →</Btn>
              </div>
            </div>

            {/* RECIPE IMPORT MODAL */}
            {showRecipeImport && (
              <Modal title="Import — Excel, PDF or a photo" onClose={() => setShowRecipeImport(false)}>
                {recipeImportStep === 1 && (
                  <div>
                    <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 10, lineHeight: 1.7 }}>
                      Paste your recipe names (one per line) from Excel, PDF, or type them out.
                    </div>
                    {recipeImportMsg && <div style={{ padding: "7px 12px", background: "#FDEBE9", borderRadius: 7, fontSize: 12, color: "#B03A2E", marginBottom: 10 }}>⚠ {recipeImportMsg}</div>}
                    
                    <textarea 
                      value={pasteRecipeNames} 
                      onChange={e => setPasteRecipeNames(e.target.value)} 
                      placeholder={"Chocolate Sponge\nRed Velvet Layer\nVanilla Cupcake"} 
                      style={{ width: "100%", minHeight: 150, padding: "8px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--panel)", fontSize: 13, fontFamily: "monospace", color: "var(--text)", boxSizing: "border-box", resize: "vertical", outline: "none", marginBottom: 12 }} 
                    />
                    
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      <Btn onClick={doRecipePreview} disabled={!pasteRecipeNames.trim()}>Preview import →</Btn>
                      <Btn variant="ghost" onClick={() => setShowRecipeImport(false)}>Cancel</Btn>
                    </div>
                  </div>
                )}

                {recipeImportStep === 2 && (
                  <div>
                    <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 10 }}>Toggle off anything you don't want to import.</div>
                    <div style={{ overflowY: "auto", maxHeight: 220, marginBottom: 12 }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                        <thead>
                          <tr style={{ background: "#EDE5D6" }}>
                            {["", "Recipe Name"].map(h => <th key={h} style={{ padding: "7px 10px", textAlign: "left", fontSize: 10, textTransform: "uppercase", letterSpacing: .8, color: "var(--muted)", fontWeight: 500 }}>{h}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {prevRecipes.map((r, i) => (
                            <tr key={r.id} style={{ background: i % 2 === 0 ? "var(--panel)" : "#F8F3EA", opacity: r.on ? 1 : 0.35 }}>
                              <td style={{ padding: "6px 10px", width: 50 }}>
                                <div onClick={() => setPrevRecipes(prev => prev.map((x, j) => j === i ? { ...x, on: !x.on } : x))} style={{ width: 30, height: 16, borderRadius: 8, background: r.on ? "#357A52" : "var(--border)", cursor: "pointer", position: "relative" }}>
                                  <div style={{ width: 12, height: 12, borderRadius: "50%", background: "white", position: "absolute", top: 2, left: r.on ? 16 : 2, transition: "left 0.2s" }} />
                                </div>
                              </td>
                              <td style={{ padding: "6px 10px", fontWeight: 500 }}>{r.name}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      <Btn variant="success" onClick={confirmRecipeImport} disabled={!prevRecipes.some(r => r.on)}>✓ Import {prevRecipes.filter(r => r.on).length} Recipes</Btn>
                      <Btn variant="ghost" onClick={() => setRecipeImportStep(1)}>← Edit</Btn>
                    </div>
                  </div>
                )}

                {recipeImportStep === 3 && (
                  <div style={{ textAlign: "center", padding: "16px 0" }}>
                    <div style={{ fontSize: 16, color: "#357A52", fontWeight: 600, marginBottom: 6 }}>✓ Import complete!</div>
                    <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 14 }}>Recipes added to your list. You can edit their ingredients manually from the main list.</div>
                    <Btn onClick={() => { setRecipeImportStep(1); setShowRecipeImport(false) }}>Done</Btn>
                  </div>
                )}
              </Modal>
            )}

            {/* RECIPE MODAL */}
            {recipeModal && (
              <Modal title={recipeModal.name ? "Edit Recipe" : "Add Custom Recipe"} onClose={() => setRecipeModal(null)}>
                <Inp label="Recipe Name *" value={recipeModal.name} onChange={v => setRecipeModal({ ...recipeModal, name: v })} placeholder="e.g. Chocolate Sponge" />
                <Inp label="Notes" value={recipeModal.notes} onChange={v => setRecipeModal({ ...recipeModal, notes: v })} placeholder="e.g. Rich chocolate base" />
                
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, marginTop: 12 }}>Ingredients</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 180, overflowY: "auto", marginBottom: 12 }}>
                  {recipeModal.ing.map((ing, idx) => (
                    <div key={idx} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <select value={ing.iid} onChange={e => updateIng(idx, "iid", e.target.value)} style={{ ...iSt, flex: 2, fontSize: 12, padding: "5px" }}>
                        <option value="">— Select ingredient —</option>
                        {inventory.map(i => (
                          <option key={i.id} value={i.id}>{i.name} ({i.unit}) — {fmt(i.cost)}/{i.unit}</option>
                        ))}
                      </select>
                      <input type="number" placeholder="Qty" value={ing.qty} onChange={e => updateIng(idx, "qty", e.target.value)} style={{ ...iSt, width: 70, fontSize: 12, padding: "5px" }} />
                      <Btn small variant="danger" onClick={() => removeIng(idx)}>×</Btn>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Btn small variant="ghost" onClick={addIngToRecipe}>+ Add Ingredient</Btn>
                  <div style={{ display: "flex", gap: 8 }}>
                    <Btn variant="success" onClick={saveRecipe}>Save Recipe</Btn>
                    <Btn variant="ghost" onClick={() => setRecipeModal(null)}>Cancel</Btn>
                  </div>
                </div>
              </Modal>
            )}
          </div>
        )}

        {/* STEP 4: SET PROFIT MARGIN */}
        {step === 4 && (
          <div>
            <div style={{ textAlign: "center", marginBottom: 22 }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>Step 4 — Set Profit Margin</div>
              <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>Choose your default net profit margin. The calculator will automatically suggest prices to protect this margin. You can change this anytime.</div>
            </div>

            <div style={{ background: "#FAF7F0", padding: "16px 20px", borderRadius: 12, border: "1px solid var(--border)", marginBottom: 20, textAlign: "center" }}>
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "var(--muted)", marginBottom: 6 }}>Target Margin</div>
              <div style={{ fontSize: 36, fontWeight: 700, color: gold }}>{profitPct}%</div>
              <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--text)", marginTop: 4 }}>{getMarginLabel(profitPct)}</div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <input type="range" min={10} max={80} step={5} value={profitPct} onChange={e => { setProfitPct(+e.target.value); st("profitPct", +e.target.value) }} style={{ width: "100%", accentColor: gold, cursor: "pointer", height: 6 }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--muted)", marginTop: 6 }}>
                <span>10% (Low Profit)</span>
                <span>80% (High Profit)</span>
              </div>
            </div>

            <div style={{ marginTop: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Btn variant="ghost" onClick={() => setStep(3)}>← Back</Btn>
              <Btn onClick={() => setStep(5)}>Save & Finish →</Btn>
            </div>
          </div>
        )}

        {/* STEP 5: DONE */}
        {step === 5 && (
          <div style={{ textAlign: "center" }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#E5F4EC", border: "2px solid #357A52", display: "flex", alignItems: "center", justifyItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <span style={{ fontSize: 28, color: "#2D7A50" }}>✓</span>
            </div>

            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 600, color: "var(--text)", marginBottom: 8 }}>You're all set!</div>
            <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.7, marginBottom: 24 }}>
              Your profile, opening stock, base recipes, and margins are set up. Let's get started on pricing and orders!
            </div>

            <div style={{ textAlign: "left", background: "#FAF7F0", padding: 18, borderRadius: 12, border: "1px solid var(--border)", marginBottom: 24 }}>
              <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                <span style={{ fontSize: 16 }}>🧮</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>Calculate Tiered Orders</div>
                  <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>Head straight to the **Order Calculator** to build pricing quotes for multi-tiered cakes.</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                <span style={{ fontSize: 16 }}>📖</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>Add more recipes</div>
                  <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>Visit the **Master List** → **Base Recipes** tab to add custom batch recipes.</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <span style={{ fontSize: 16 }}>🧾</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>Scan purchase receipts</div>
                  <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>Scan or log purchases to automatically restock inventory items.</div>
                </div>
              </div>
            </div>

            <Btn full onClick={() => setView("calculator")}>Take Your First Order</Btn>
          </div>
        )}


      </div>
    </div>
  )
}
