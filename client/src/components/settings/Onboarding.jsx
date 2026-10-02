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
import { saveCompany, saveSetting, saveInventory, saveRecipes, saveLocal, loadLocal, saveOpeningStock } from "../../lib/data.js"
import { uid, fmt, fmtCost, parseCSV, formatApiError } from "../../lib/helpers.js"
import { AlertTriangle, Check, FileSpreadsheet, PenLine, Lock, Calculator, BookOpen, Receipt, Search, X } from "lucide-react"

export function Onboarding({ gold, company, setCompany, inventory, setInventory, recipes, setRecipes, settings, setSettings, onComplete, onSkip, onBack, setView }) {
  const [step, setStep] = useState(1)
  const logoRef = useRef()

  // Step 2: Opening Stock State
  const [os, setOs] = useState(() => loadLocal("ll_opening_stock", {}))
  const [savedOS, setSavedOS] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  const filteredInventory = inventory.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  )
  const curMonth = new Date().toLocaleDateString("en-NG", { month: "long", year: "numeric" })

  // Step 3: Base Recipes State
  const [recipeModal, setRecipeModal] = useState(null)

  // Step 4: Margin State
  const [profitPct, setProfitPct] = useState(settings.profitPct || 40)

  // Excel Import Modal State (Step 2)
  const [showImport, setShowImport] = useState(false)
  const [importStep, setImportStep] = useState(1) // 1 = paste columns, 2 = preview, 3 = done
  const [pasteN, setPasteN] = useState("")
  const [pasteU, setPasteU] = useState("")
  const [pasteQ, setPasteQ] = useState("")
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

  // Feedback & Error States
  const [onboardingError, setOnboardingError] = useState(null)
  const [recipeModalError, setRecipeModalError] = useState(null)
  const [manualAddError, setManualAddError] = useState(null)
  const [completing, setCompleting] = useState(false)

  // Step 2: Manual Add State
  const [showManualAdd, setShowManualAdd] = useState(false)
  const [calcMode, setCalcMode] = useState("auto") // "auto" or "manual"
  const [manualItem, setManualItem] = useState({ name: "", unit: "g", cost: "", openingQty: "", totalPaid: "", qtyBought: "" })

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

  const checkMatch = (valN = pasteN, valC = pasteC, valQ = pasteQ) => {
    const ns = L(valN), cs = L(valC), qs = L(valQ)
    if (ns.length > 0 && cs.length > 0 && ns.length !== cs.length) {
      setWarnMsg(`Names: ${ns.length} rows — Costs: ${cs.length} rows. Must match.`)
    } else if (ns.length > 0 && qs.length > 0 && ns.length !== qs.length) {
      setWarnMsg(`Names: ${ns.length} rows — Quantities: ${qs.length} rows. Must match.`)
    } else {
      setWarnMsg("")
    }
  }

  const doPreview = () => {
    setImportMsg("")
    const ns = L(pasteN), us = L(pasteU), qs = L(pasteQ), cs = L(pasteC)
    if (!ns.length || !cs.length) {
      return setImportMsg("Item names and cost per unit are required")
    }
    if (ns.length !== cs.length) {
      return setImportMsg(`Names (${ns.length}) and costs (${cs.length}) must have same number of rows`)
    }
    if (qs.length > 0 && qs.length !== ns.length) {
      return setImportMsg(`Names (${ns.length}) and quantities (${qs.length}) must have same number of rows`)
    }
    const items = ns.map((name, i) => {
      const rawCost = cs[i] || ""
      const cleanCost = (rawCost.includes(",") && !rawCost.includes("."))
        ? rawCost.replace(/,/g, ".")
        : rawCost.replace(/,/g, "")
      const parsedCost = parseFloat(cleanCost.replace(/[^0-9.]/g, "")) || 0

      const rawQty = qs[i] || ""
      const cleanQty = (rawQty.includes(",") && !rawQty.includes("."))
        ? rawQty.replace(/,/g, ".")
        : rawQty.replace(/,/g, "")
      const parsedQty = rawQty ? (parseFloat(cleanQty.replace(/[^0-9.]/g, "")) || 0) : 0

      return {
        id: uid(),
        name,
        unit: us[i] || "g",
        cost: parsedCost,
        stock: parsedQty,
        openingQty: parsedQty,
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
    const updated = inventory.map(item => {
      const match = approved.find(p => p.name.toLowerCase() === item.name.toLowerCase())
      if (match) {
        return {
          ...item,
          unit: match.unit || item.unit,
          cost: match.cost || item.cost,
          stock: match.stock !== undefined ? match.stock : item.stock
        }
      }
      return item
    })
    approved.forEach(p => {
      if (!updated.some(item => item.name.toLowerCase() === p.name.toLowerCase())) {
        updated.push(p)
      }
    })
    setInventory(updated)
    await saveInventory(updated)

    const updatedOS = { ...os }
    approved.forEach(p => {
      const match = updated.find(i => i.name.toLowerCase() === p.name.toLowerCase())
      const targetId = match ? match.id : p.id
      updatedOS[targetId] = (p.stock !== undefined && p.stock !== "") ? p.stock : (updatedOS[targetId] || 0)
    })
    setOs(updatedOS)
    await saveLocal("ll_opening_stock", updatedOS)

    const currentMonthStr = new Date().toISOString().slice(0, 7)
    const osList = updated.map(item => ({
      id: "os_" + item.id,
      itemId: item.id,
      name: item.name,
      unit: item.unit || "g",
      cost: item.cost === "" || item.cost === undefined ? 0 : (parseFloat(item.cost) || 0),
      openingQty: updatedOS[item.id] !== undefined && updatedOS[item.id] !== ""
        ? (parseFloat(updatedOS[item.id]) || 0)
        : (parseFloat(item.stock) || 0),
      locked: false
    }))
    await saveOpeningStock(osList, currentMonthStr, false)

    setPasteN("")
    setPasteU("")
    setPasteQ("")
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
      ing: [],
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
    const isBlank = val === "" || val === undefined || val === null
    const updated = { ...os, [id]: isBlank ? "" : val }
    setOs(updated)
    const numericOS = Object.fromEntries(
      Object.entries(updated).map(([k, v]) => [k, v === "" ? 0 : (parseFloat(v) || 0)])
    )
    await saveLocal("ll_opening_stock", numericOS)
    setSavedOS(false)

    const currentMonthStr = new Date().toISOString().slice(0, 7)
    const osList = inventory.map(item => ({
      id: "os_" + item.id,
      itemId: item.id,
      name: item.name,
      unit: item.unit || "g",
      cost: item.cost === "" || item.cost === undefined ? 0 : (parseFloat(item.cost) || 0),
      openingQty: numericOS[item.id] !== undefined ? numericOS[item.id] : (parseFloat(item.stock) || 0),
      locked: false
    }))
    await saveOpeningStock(osList, currentMonthStr, false)
  }

  const updateCost = async (id, val) => {
    const isBlank = val === "" || val === undefined || val === null
    const updatedInv = inventory.map(item => item.id === id ? { ...item, cost: isBlank ? "" : val } : item)
    setInventory(updatedInv)
    const numericInv = updatedInv.map(item => ({ ...item, cost: item.cost === "" ? 0 : (parseFloat(item.cost) || 0) }))
    await saveInventory(numericInv)

    const currentMonthStr = new Date().toISOString().slice(0, 7)
    const numericOS = Object.fromEntries(
      Object.entries(os).map(([k, v]) => [k, v === "" ? 0 : (parseFloat(v) || 0)])
    )
    const osList = numericInv.map(item => ({
      id: "os_" + item.id,
      itemId: item.id,
      name: item.name,
      unit: item.unit || "g",
      cost: item.cost,
      openingQty: numericOS[item.id] !== undefined ? numericOS[item.id] : (parseFloat(item.stock) || 0),
      locked: false
    }))
    await saveOpeningStock(osList, currentMonthStr, false)
  }

  const lockOpeningStock = async () => {
    setOnboardingError(null)
    try {
      // Validate that all costs and quantities are numbers
      for (const item of inventory) {
        if (item.cost !== "" && item.cost !== undefined && item.cost !== null) {
          const c = parseFloat(item.cost)
          if (isNaN(c) || c < 0) {
            setOnboardingError({
              title: "Invalid Item Cost",
              whatWentWrong: `Item "${item.name}" has an invalid cost.`,
              action: "Please enter a valid cost (₦) greater than or equal to 0.",
              step: 2
            })
            return
          }
        }
      }

      const monthStr = new Date().toISOString().slice(0, 7)
      const numericOS = Object.fromEntries(
        Object.entries(os).map(([k, v]) => [k, v === "" ? 0 : (parseFloat(v) || 0)])
      )
      const itemsToLock = inventory.map(i => ({
        id: "os_" + i.id,
        itemId: i.id,
        name: i.name,
        unit: i.unit || "g",
        openingQty: numericOS[i.id] !== undefined ? numericOS[i.id] : (parseFloat(i.stock) || 0),
        cost: i.cost === "" || i.cost === undefined ? 0 : (parseFloat(i.cost) || 0),
        locked: true
      }))
      await saveOpeningStock(itemsToLock, monthStr, true)
      await saveLocal("ll_opening_stock", numericOS)

      // Set live inventory levels to match these opening stocks
      const updatedInventory = inventory.map(item => ({
        ...item,
        cost: item.cost === "" ? 0 : (parseFloat(item.cost) || 0),
        stock: numericOS[item.id] !== undefined ? numericOS[item.id] : (parseFloat(item.stock) || 0)
      }))
      setInventory(updatedInventory)
      await saveInventory(updatedInventory)

      setSavedOS(true)
      setTimeout(() => {
        setStep(3)
      }, 800)
    } catch (err) {
      const formatted = formatApiError(err, { title: "Unable to lock opening stock", step: 2 })
      setOnboardingError(formatted)
    }
  }

  const handleManualAdd = async () => {
    setManualAddError(null)
    let costNum = 0
    if (calcMode === "auto") {
      const paid = parseFloat(manualItem.totalPaid) || 0
      const qty = parseFloat(manualItem.qtyBought) || 0
      if (!manualItem.name.trim() || !manualItem.totalPaid || !manualItem.qtyBought) {
        setManualAddError({
          title: "Missing Information",
          whatWentWrong: "Item name, total amount paid, and quantity bought are all required.",
          action: "Please fill in all required fields."
        })
        return
      }
      if (qty <= 0) {
        setManualAddError({
          title: "Invalid Quantity",
          whatWentWrong: "Quantity bought must be greater than zero.",
          action: "Enter a valid quantity greater than 0."
        })
        return
      }
      costNum = paid / qty
    } else {
      if (!manualItem.name.trim() || !manualItem.cost) {
        setManualAddError({
          title: "Missing Information",
          whatWentWrong: "Item name and cost per unit are required.",
          action: "Please enter the item name and cost per unit."
        })
        return
      }
      costNum = parseFloat(manualItem.cost) || 0
      if (costNum < 0) {
        setManualAddError({
          title: "Invalid Cost",
          whatWentWrong: "Cost per unit cannot be negative.",
          action: "Enter a positive number or 0."
        })
        return
      }
    }

    const qtyNum = parseFloat(manualItem.openingQty) || 0
    const newItem = {
      id: uid(),
      name: manualItem.name.trim(),
      unit: manualItem.unit || "g",
      cost: costNum,
      stock: qtyNum,
      minStock: 5,
      on: true,
      cat: "Dry Goods"
    }

    try {
      const updated = [...inventory, newItem]
      setInventory(updated)
      await saveInventory(updated)

      const updatedOS = { ...os, [newItem.id]: qtyNum }
      setOs(updatedOS)
      await saveLocal("ll_opening_stock", updatedOS)

      const currentMonthStr = new Date().toISOString().slice(0, 7)
      const osList = updated.map(item => ({
        id: "os_" + item.id,
        itemId: item.id,
        name: item.name,
        unit: item.unit || "g",
        cost: item.cost === "" || item.cost === undefined ? 0 : (parseFloat(item.cost) || 0),
        openingQty: updatedOS[item.id] !== undefined && updatedOS[item.id] !== ""
          ? (parseFloat(updatedOS[item.id]) || 0)
          : (parseFloat(item.stock) || 0),
        locked: false
      }))
      await saveOpeningStock(osList, currentMonthStr, false)

      setManualItem({ name: "", unit: "g", cost: "", openingQty: "", totalPaid: "", qtyBought: "" })
      setCalcMode("auto")
      setShowManualAdd(false)
      setManualAddError(null)
    } catch (err) {
      const formatted = formatApiError(err, { title: "Unable to add inventory item", step: 2 })
      setManualAddError(formatted)
    }
  }

  // Recipe Helpers (Step 3)
  const openRecipe = (r) => {
    setRecipeModalError(null)
    setRecipeModal(r ? { ...r, ing: (r.ing && r.ing.length > 0) ? r.ing : [{ iid: "", qty: "" }] } : { id: uid(), name: "", type: "layer", notes: "", ing: [{ iid: "", qty: "" }] })
  }

  const saveRecipe = async () => {
    setRecipeModalError(null)
    if (!recipeModal.name || !recipeModal.name.trim()) {
      setRecipeModalError({
        title: "Recipe Name Required",
        whatWentWrong: "Recipe name cannot be empty.",
        action: "Please enter a name for your recipe (e.g. Vanilla Sponge)."
      })
      return
    }

    // Validate ingredient rows: check for selected items with invalid/missing quantities
    for (let idx = 0; idx < (recipeModal.ing || []).length; idx++) {
      const ing = recipeModal.ing[idx]
      if (ing.iid && (!ing.qty || parseFloat(ing.qty) <= 0)) {
        const it = inventory.find(x => x.id === ing.iid)
        const itName = it ? it.name : `Ingredient ${idx + 1}`
        setRecipeModalError({
          title: "Invalid Recipe Ingredient",
          whatWentWrong: `Ingredient ${idx + 1} (${itName}): Quantity is required and must be greater than 0.`,
          action: "Please enter how much of this ingredient is needed for the recipe, or remove the ingredient row.",
          fieldIndex: idx
        })
        return
      }
      if (!ing.iid && ing.qty && parseFloat(ing.qty) > 0) {
        setRecipeModalError({
          title: "Missing Ingredient Selection",
          whatWentWrong: `Ingredient ${idx + 1}: Please select an ingredient item from the dropdown.`,
          action: "Choose an item from your inventory or clear the quantity.",
          fieldIndex: idx
        })
        return
      }
    }

    const cleanRecipe = {
      ...recipeModal,
      name: recipeModal.name.trim(),
      ing: (recipeModal.ing || []).filter(i => i && i.iid && String(i.iid).trim() !== "" && parseFloat(i.qty) > 0)
    }

    const updated = recipes.find(r => r.id === cleanRecipe.id)
      ? recipes.map(r => r.id === cleanRecipe.id ? cleanRecipe : r)
      : [...recipes, cleanRecipe]

    try {
      setRecipes(updated)
      await saveRecipes(updated)
      setRecipeModal(null)
      setRecipeModalError(null)
      setOnboardingError(null)
    } catch (err) {
      const formatted = formatApiError(err, { title: "Unable to save recipe", step: 3 })
      setRecipeModalError(formatted)
      setOnboardingError(formatted)
    }
  }

  const validateAllRecipes = () => {
    for (let rIdx = 0; rIdx < recipes.length; rIdx++) {
      const r = recipes[rIdx]
      if (!r.name || !r.name.trim()) {
        return {
          title: "Incomplete Recipe",
          whatWentWrong: `Recipe #${rIdx + 1} is missing a name.`,
          action: "Please edit the recipe to give it a name, or delete it.",
          step: 3
        }
      }
      for (let iIdx = 0; iIdx < (r.ing || []).length; iIdx++) {
        const ing = r.ing[iIdx]
        if (ing.iid && (!ing.qty || parseFloat(ing.qty) <= 0)) {
          const it = inventory.find(x => x.id === ing.iid)
          const itName = it ? it.name : `Ingredient ${iIdx + 1}`
          return {
            title: "Invalid Recipe Ingredient",
            whatWentWrong: `Recipe "${r.name}" has an incomplete ingredient (${itName}). A valid positive quantity is required.`,
            action: "Make sure every ingredient has a quantity greater than 0, or edit the recipe to remove unused rows.",
            step: 3
          }
        }
      }
    }
    return null
  }

  const handleFinish = async (target) => {
    setOnboardingError(null)
    const err = validateAllRecipes()
    if (err) {
      setOnboardingError(err)
      setStep(3)
      return
    }
    setCompleting(true)
    try {
      if (onComplete) {
        await onComplete(target)
      }
      if (setView) {
        setView(target)
      }
    } catch (finishErr) {
      console.error("Finish onboarding error:", finishErr)
      const formatted = formatApiError(finishErr, { title: "Unable to complete onboarding" })
      setOnboardingError(formatted)
      if (formatted.step && (formatted.step === 2 || formatted.step === 3)) {
        setStep(formatted.step)
      }
    } finally {
      setCompleting(false)
    }
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

        {/* Top Header Bar for Back / Skip */}
        {(onBack || onSkip) && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 4, fontWeight: 500, padding: 0 }}
              >
                ← Return to Dashboard
              </button>
            ) : <div />}
            {onSkip && (
              <button
                type="button"
                onClick={onSkip}
                style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 12.5, textDecoration: "underline", padding: 0 }}
              >
                Skip setup for now →
              </button>
            )}
          </div>
        )}

        {/* BakeWealth Brand Logo */}
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <img src="/Bakewealthlogo.jpeg" alt="BakeWealth" style={{ height: 42, maxWidth: 140, objectFit: "contain", borderRadius: 6 }} />
        </div>

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

        {/* Onboarding Error Feedback Banner */}
        {onboardingError && (
          <div
            role="alert"
            style={{
              marginBottom: 20,
              padding: "14px 16px",
              background: "#FDEBE9",
              border: "1.5px solid #F5C6CB",
              borderRadius: 10,
              color: "#842029",
              boxShadow: "0 2px 8px rgba(176,58,46,0.08)"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <AlertTriangle size={20} color="#B03A2E" style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 4, color: "#842029" }}>
                    {onboardingError.title || "Unable to proceed"}
                  </div>
                  <div style={{ fontSize: 12.5, lineHeight: 1.5, marginBottom: onboardingError.action ? 6 : 0, color: "#491217" }}>
                    {onboardingError.whatWentWrong}
                  </div>
                  {onboardingError.action && (
                    <div style={{ fontSize: 12, fontWeight: 500, color: "#B03A2E" }}>
                      <strong>What you need to do:</strong> {onboardingError.action}
                    </div>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOnboardingError(null)}
                style={{ background: "none", border: "none", color: "#842029", cursor: "pointer", padding: 2 }}
                title="Dismiss error"
              >
                <X size={16} />
              </button>
            </div>
            {onboardingError.step && onboardingError.step !== step && (
              <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid rgba(176,58,46,0.2)", display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => {
                    setStep(onboardingError.step)
                    setOnboardingError(null)
                  }}
                  style={{
                    background: "#B03A2E",
                    color: "#fff",
                    border: "none",
                    padding: "5px 12px",
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer"
                  }}
                >
                  Go to Step {onboardingError.step} to fix this →
                </button>
              </div>
            )}
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
                  <div style={{ textAlign: "center", width: "100%", height: "100%", position: "relative" }}>
                    <img src="/Bakewealthlogo.jpeg" alt="Default logo" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.65 }} />
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(253,250,244,0.7)", fontSize: 10, color: "var(--muted)", fontWeight: 600 }}>Upload<br />Logo</div>
                  </div>
                )}
              </div>
              <input ref={logoRef} type="file" accept="image/*" onChange={handleLogo} style={{ display: "none" }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>Bakery Logo</div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>Upload a JPG or PNG. This logo will appear on all customer invoices and quotes.</div>
              </div>
            </div>

            <Inp label="Business Name *" value={company.name} onChange={v => co("name", v)} placeholder="e.g. Sweet Treats Bakery" />
            <Inp label="Address" value={company.address} onChange={v => co("address", v)} placeholder="e.g. Abuja, Nigeria" />
            <Inp label="Phone Number" value={company.phone} onChange={v => co("phone", v)} placeholder="e.g. +234 80 1234 5678" />
            <Inp label="Email Address" value={company.email} onChange={v => co("email", v)} placeholder="e.g. contact@mybakery.com" />


            <div style={{ marginTop: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              {onSkip ? (
                <button
                  type="button"
                  onClick={onSkip}
                  style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 12.5, textDecoration: "underline", padding: 0 }}
                >
                  Skip setup for now
                </button>
              ) : <div />}
              <Btn disabled={!company.name?.trim()} onClick={() => setStep(2)}>Next: Set Up Opening Stock →</Btn>
            </div>
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
                <Btn small variant="outline" onClick={() => { setImportStep(1); setShowImport(true) }} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <FileSpreadsheet size={13} /> Import — Excel, PDF or a photo
                </Btn>
                <Btn small variant="outline" onClick={() => setShowManualAdd(true)} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <PenLine size={13} /> Add manually
                </Btn>
              </div>
            </div>

            {/* Search Bar */}
            <div style={{ display: "flex", gap: 6, marginBottom: 12, alignItems: "center" }}>
              <div style={{ position: "relative", flex: 1, display: "flex", alignItems: "center" }}>
                <Search size={14} style={{ position: "absolute", left: 10, color: "var(--muted)", pointerEvents: "none" }} />
                <input
                  type="text"
                  placeholder="Search items by name..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{
                    ...iSt,
                    width: "100%",
                    padding: "8px 28px 8px 30px",
                    fontSize: 13,
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "var(--panel)"
                  }}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    style={{
                      position: "absolute",
                      right: 10,
                      background: "none",
                      border: "none",
                      color: "var(--muted)",
                      cursor: "pointer",
                      fontSize: 13,
                      display: "flex",
                      alignItems: "center"
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
              <Btn small variant="primary" style={{ display: "inline-flex", alignItems: "center", gap: 4, height: 35 }}>
                <Search size={13} /> Search
              </Btn>
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
                  {filteredInventory.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: "20px", textAlign: "center", color: "var(--muted)", fontSize: 12.5 }}>
                        {inventory.length === 0 ? "No items added yet. Click \"Import from Excel\" or \"Add Item\" above to get started." : "No matching items found."}
                      </td>
                    </tr>
                  ) : (
                    filteredInventory.map((item, i) => {
                      const rawQty = os[item.id] !== undefined ? os[item.id] : ""
                      const qty = rawQty === "" ? 0 : (parseFloat(rawQty) || 0)
                      const rawCost = item.cost !== undefined ? item.cost : ""
                      const cost = rawCost === "" ? 0 : (parseFloat(rawCost) || 0)
                      const value = qty * cost
                      return (
                        <tr key={item.id} style={{ background: i % 2 === 0 ? "var(--panel)" : "#F8F3EA" }}>
                          <td style={{ padding: "8px 10px", fontWeight: 500 }}>{item.name}</td>
                          <td style={{ padding: "8px 10px", color: "var(--muted)" }}>{item.unit}</td>
                          <td style={{ padding: "8px 10px", textAlign: "right" }}>
                            <input
                              type="number"
                              step="any"
                              value={rawQty}
                              onChange={e => updateOS(item.id, e.target.value)}
                              onFocus={e => {
                                if (e.target.value === "0") e.target.select()
                              }}
                              onBlur={() => {
                                if (os[item.id] === "" || os[item.id] === undefined) {
                                  updateOS(item.id, 0)
                                } else {
                                  const num = parseFloat(os[item.id])
                                  if (!isNaN(num) && String(os[item.id]).endsWith(".")) {
                                    updateOS(item.id, num)
                                  }
                                }
                              }}
                              placeholder="0"
                              style={{ ...iSt, width: 70, padding: "4px 8px", fontSize: 13, textAlign: "right" }}
                            />
                          </td>
                          <td style={{ padding: "8px 10px", textAlign: "right" }}>
                            <input
                              type="number"
                              step="any"
                              value={rawCost}
                              onChange={e => updateCost(item.id, e.target.value)}
                              onFocus={e => {
                                if (e.target.value === "0") e.target.select()
                              }}
                              onBlur={() => {
                                if (item.cost === "" || item.cost === undefined) {
                                  updateCost(item.id, 0)
                                } else {
                                  const num = parseFloat(item.cost)
                                  if (!isNaN(num) && String(item.cost).endsWith(".")) {
                                    updateCost(item.id, num)
                                  }
                                }
                              }}
                              placeholder="0"
                              style={{ ...iSt, width: 85, padding: "4px 8px", fontSize: 13, textAlign: "right" }}
                            />
                          </td>
                          <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 500 }}>
                            {value % 1 !== 0 && value < 100
                              ? `₦${value.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              : fmt(value)}
                          </td>
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
                {onSkip && (
                  <button
                    type="button"
                    onClick={onSkip}
                    style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 12.5, textDecoration: "underline", padding: 0, marginRight: 6 }}
                  >
                    Skip setup
                  </button>
                )}
                {savedOS && <span style={{ fontSize: 12.5, color: "#357A52", fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 4 }}><Check size={13} /> Locked permanently</span>}
                <Btn variant="ghost" onClick={() => setStep(3)}>Next Step →</Btn>
                <Btn variant="success" onClick={lockOpeningStock} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Lock size={13} /> Lock & Continue
                </Btn>
              </div>
            </div>

            {/* MANUAL ADD MODAL */}
            {showManualAdd && (
              <Modal title="Add Item Manually" onClose={() => { setShowManualAdd(false); setManualAddError(null) }}>
                {manualAddError && (
                  <div role="alert" style={{ padding: "9px 12px", background: "#FDEBE9", borderRadius: 8, border: "1px solid #F5C6CB", color: "#B03A2E", fontSize: 12, marginBottom: 12, display: "flex", alignItems: "flex-start", gap: 6 }}>
                    <AlertTriangle size={14} style={{ marginTop: 2, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontWeight: 600 }}>{manualAddError.title || "Unable to add item"}</div>
                      <div style={{ marginTop: 2 }}>{manualAddError.whatWentWrong || manualAddError.displayMessage}</div>
                      {manualAddError.action && <div style={{ marginTop: 2, fontWeight: 500 }}>{manualAddError.action}</div>}
                    </div>
                  </div>
                )}
                <Inp label="Item Name *" value={manualItem.name} onChange={v => { setManualItem(m => ({ ...m, name: v })); setManualAddError(null) }} placeholder="e.g. Flour, Butter, Eggs" />
                <Sel
                  label="Unit *"
                  value={manualItem.unit}
                  onChange={v => setManualItem(m => ({ ...m, unit: v }))}
                  options={[
                    { value: "g", label: "g (grams)" },
                    { value: "ml", label: "ml (milliliters)" },
                    { value: "m", label: "m (millimeter / meter)" },
                    { value: "kg", label: "kg (kilograms)" },
                    { value: "L", label: "L (litres)" },
                    { value: "pcs", label: "pcs (pieces)" },
                    { value: "pack", label: "pack (packs)" }
                  ]}
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
                    {manualItem.totalPaid && manualItem.qtyBought && parseFloat(String(manualItem.qtyBought).replace(",", ".")) > 0 && (
                      <div style={{ gridColumn: "span 2", padding: "8px 12px", background: "var(--bg)", borderRadius: 8, fontSize: 13, fontWeight: 500, color: "var(--gold)" }}>
                        Calculated Cost per Unit: {fmtCost(parseFloat(String(manualItem.totalPaid).replace(",", ".")) / parseFloat(String(manualItem.qtyBought).replace(",", ".")))}/{manualItem.unit}
                      </div>
                    )}
                  </div>
                ) : (
                  <Inp label="Cost per Unit (₦) *" type="number" value={manualItem.cost} onChange={v => setManualItem(m => ({ ...m, cost: v }))} placeholder="e.g. 1500" />
                )}

                <Inp label="Opening Qty (optional)" type="number" value={manualItem.openingQty} onChange={v => setManualItem(m => ({ ...m, openingQty: v }))} placeholder="e.g. 5" />

                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
                  <Btn variant="success" onClick={handleManualAdd} disabled={!manualItem.name.trim() || (calcMode === "auto" ? (!manualItem.totalPaid || !manualItem.qtyBought) : !manualItem.cost)} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                    <Check size={13} /> Add Item
                  </Btn>
                  <Btn variant="ghost" onClick={() => setShowManualAdd(false)}>Cancel</Btn>
                </div>
              </Modal>
            )}

            {/* IMPORT MODAL */}
            {showImport && (
              <Modal title="Import — Excel, PDF or a photo" onClose={() => setShowImport(false)}>
                {importStep === 1 && (
                  <div>
                    <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 10, lineHeight: 1.7 }}>
                      Open your Excel. Copy each column and paste into its own box. Only item names and cost per unit are required.
                    </div>
                    {importMsg && <div style={{ padding: "7px 12px", background: "#FDEBE9", borderRadius: 7, fontSize: 12, color: "#B03A2E", marginBottom: 10, display: "flex", alignItems: "center", gap: 5 }}><AlertTriangle size={12} /> {importMsg}</div>}

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 10, marginBottom: 10 }}>
                      <div>
                        <label style={{ fontSize: 10, color: "var(--muted)", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: .8, fontWeight: 500 }}>Item Names *</label>
                        <textarea value={pasteN} onChange={e => { setPasteN(e.target.value); checkMatch(e.target.value, pasteC, pasteQ) }} placeholder={"Flour\nSugar\nOil\nEggs"} style={{ width: "100%", minHeight: 120, padding: "8px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--panel)", fontSize: 12, fontFamily: "monospace", color: "var(--text)", boxSizing: "border-box", resize: "vertical", outline: "none" }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 10, color: "var(--muted)", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: .8, fontWeight: 500 }}>Unit (optional)</label>
                        <textarea value={pasteU} onChange={e => setPasteU(e.target.value)} placeholder={"g\nml\nm\nkg"} style={{ width: "100%", minHeight: 120, padding: "8px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--panel)", fontSize: 12, fontFamily: "monospace", color: "var(--text)", boxSizing: "border-box", resize: "vertical", outline: "none" }} />
                        <div style={{ fontSize: 9.5, color: "var(--muted)", marginTop: 3 }}>Default gram(g) millimeter (m)</div>
                      </div>
                      <div>
                        <label style={{ fontSize: 10, color: "var(--muted)", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: .8, fontWeight: 500 }}>Opening Stock Quantity</label>
                        <textarea value={pasteQ} onChange={e => { setPasteQ(e.target.value); checkMatch(pasteN, pasteC, e.target.value) }} placeholder={"50\n25\n10\n30"} style={{ width: "100%", minHeight: 120, padding: "8px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--panel)", fontSize: 12, fontFamily: "monospace", color: "var(--text)", boxSizing: "border-box", resize: "vertical", outline: "none" }} />
                        <div style={{ fontSize: 9.5, color: "var(--muted)", marginTop: 3 }}>Default 0</div>
                      </div>
                      <div>
                        <label style={{ fontSize: 10, color: "var(--gold)", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: .8, fontWeight: 500 }}>Cost / Unit *</label>
                        <textarea value={pasteC} onChange={e => { setPasteC(e.target.value); checkMatch(pasteN, e.target.value, pasteQ) }} placeholder={"1140\n1500\n3000\n700"} style={{ width: "100%", minHeight: 120, padding: "8px", borderRadius: 8, border: "1px solid #E8D5A3", background: "#FFF9EE", fontSize: 12, fontFamily: "monospace", color: "var(--text)", boxSizing: "border-box", resize: "vertical", outline: "none" }} />
                      </div>
                    </div>
                    {warnMsg && <div style={{ padding: "7px 12px", background: "#FDEBE9", borderRadius: 7, fontSize: 12, color: "#B03A2E", marginBottom: 10, display: "flex", alignItems: "center", gap: 5 }}><AlertTriangle size={12} /> {warnMsg}</div>}
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
                            {["", "Item", "Unit", "Opening Qty", "Cost/Unit"].map(h => <th key={h} style={{ padding: "7px 10px", textAlign: (h === "Cost/Unit" || h === "Opening Qty") ? "right" : "left", fontSize: 10, textTransform: "uppercase", letterSpacing: .8, color: "var(--muted)", fontWeight: 500 }}>{h}</th>)}
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
                              <td style={{ padding: "6px 10px", textAlign: "right", color: "var(--text)" }}>{(p.stock ?? 0)} {p.unit}</td>
                              <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: 500, color: "var(--gold)" }}>{fmtCost(p.cost)}/{p.unit}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      <Btn variant="success" onClick={confirmImport} disabled={!prevItems.some(p => p.on)} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                        <Check size={13} /> Import {prevItems.filter(p => p.on).length} Items
                      </Btn>
                      <Btn variant="ghost" onClick={() => setImportStep(1)}>← Edit</Btn>
                    </div>
                  </div>
                )}

                {importStep === 3 && (
                  <div style={{ textAlign: "center", padding: "16px 0" }}>
                    <div style={{ fontSize: 16, color: "#357A52", fontWeight: 600, marginBottom: 6, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                      <Check size={18} /> Import complete!
                    </div>
                    <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 14 }}>Ingredients added to your inventory list. You can configure their stock next.</div>
                    <Btn onClick={() => { setImportStep(1); setShowImport(false) }}>Done</Btn>
                  </div>
                )}
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
                <Btn small variant="outline" onClick={() => { setRecipeImportStep(1); setShowRecipeImport(true) }} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <FileSpreadsheet size={13} /> Import — Excel, PDF or a photo
                </Btn>
                <Btn small variant="outline" onClick={() => openRecipe(null)} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <PenLine size={13} /> Add manually
                </Btn>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Btn variant="ghost" onClick={() => setStep(2)}>← Back</Btn>
                {onSkip && (
                  <button
                    type="button"
                    onClick={onSkip}
                    style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 12.5, textDecoration: "underline", padding: 0, marginRight: 6 }}
                  >
                    Skip setup
                  </button>
                )}
                <Btn onClick={() => {
                  const err = validateAllRecipes()
                  if (err) {
                    setOnboardingError(err)
                    return
                  }
                  setOnboardingError(null)
                  setStep(4)
                }}>Next: Profit Margin →</Btn>
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
                    {recipeImportMsg && <div style={{ padding: "7px 12px", background: "#FDEBE9", borderRadius: 7, fontSize: 12, color: "#B03A2E", marginBottom: 10, display: "flex", alignItems: "center", gap: 5 }}><AlertTriangle size={12} /> {recipeImportMsg}</div>}

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
                      <Btn variant="success" onClick={confirmRecipeImport} disabled={!prevRecipes.some(r => r.on)} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                        <Check size={13} /> Import {prevRecipes.filter(r => r.on).length} Recipes
                      </Btn>
                      <Btn variant="ghost" onClick={() => setRecipeImportStep(1)}>← Edit</Btn>
                    </div>
                  </div>
                )}

                {recipeImportStep === 3 && (
                  <div style={{ textAlign: "center", padding: "16px 0" }}>
                    <div style={{ fontSize: 16, color: "#357A52", fontWeight: 600, marginBottom: 6, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                      <Check size={18} /> Import complete!
                    </div>
                    <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 14 }}>Recipes added to your list. You can edit their ingredients manually from the main list.</div>
                    <Btn onClick={() => { setRecipeImportStep(1); setShowRecipeImport(false) }}>Done</Btn>
                  </div>
                )}
              </Modal>
            )}

            {/* RECIPE MODAL */}
            {recipeModal && (
              <Modal title={recipeModal.name ? "Edit Recipe" : "Add Custom Recipe"} onClose={() => { setRecipeModal(null); setRecipeModalError(null) }}>
                {recipeModalError && (
                  <div role="alert" style={{ padding: "9px 12px", background: "#FDEBE9", borderRadius: 8, border: "1px solid #F5C6CB", color: "#B03A2E", fontSize: 12, marginBottom: 12, display: "flex", alignItems: "flex-start", gap: 6 }}>
                    <AlertTriangle size={14} style={{ marginTop: 2, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontWeight: 600 }}>{recipeModalError.title || "Unable to save recipe"}</div>
                      <div style={{ marginTop: 2 }}>{recipeModalError.whatWentWrong || recipeModalError.displayMessage}</div>
                      {recipeModalError.action && <div style={{ marginTop: 2, fontWeight: 500 }}>{recipeModalError.action}</div>}
                    </div>
                  </div>
                )}
                <Inp label="Recipe Name *" value={recipeModal.name} onChange={v => { setRecipeModal({ ...recipeModal, name: v }); setRecipeModalError(null) }} placeholder="e.g. Chocolate Sponge" />
                <Inp label="Notes" value={recipeModal.notes} onChange={v => setRecipeModal({ ...recipeModal, notes: v })} placeholder="e.g. Rich chocolate base" />

                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, marginTop: 12 }}>Ingredients</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 180, overflowY: "auto", marginBottom: 12 }}>
                  {recipeModal.ing.map((ing, idx) => {
                    const hasRowError = recipeModalError && (recipeModalError.fieldIndex === idx || (recipeModalError.field?.includes('ingredients') && (!ing.qty || parseFloat(ing.qty) <= 0)))
                    return (
                      <div key={idx} style={{ display: "flex", gap: 8, alignItems: "center", padding: hasRowError ? "4px" : "0", borderRadius: 6, background: hasRowError ? "rgba(176,58,46,0.06)" : "transparent", border: hasRowError ? "1px solid #F5C6CB" : "none" }}>
                        <select value={ing.iid} onChange={e => { updateIng(idx, "iid", e.target.value); setRecipeModalError(null) }} style={{ ...iSt, flex: 2, fontSize: 12, padding: "5px", borderColor: hasRowError && !ing.iid ? "#B03A2E" : undefined }}>
                          <option value="">— Select ingredient —</option>
                          {inventory.map(i => (
                            <option key={i.id} value={i.id}>{i.name} ({i.unit}) — {fmt(i.cost)}/{i.unit}</option>
                          ))}
                        </select>
                        <input type="number" placeholder="Qty" value={ing.qty} onChange={e => { updateIng(idx, "qty", e.target.value); setRecipeModalError(null) }} style={{ ...iSt, width: 70, fontSize: 12, padding: "5px", borderColor: hasRowError && (!ing.qty || parseFloat(ing.qty) <= 0) ? "#B03A2E" : undefined }} />
                        <Btn small variant="danger" onClick={() => removeIng(idx)}>×</Btn>
                      </div>
                    )
                  })}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Btn small variant="ghost" onClick={addIngToRecipe}>+ Add Ingredient</Btn>
                  <div style={{ display: "flex", gap: 8 }}>
                    <Btn variant="success" onClick={saveRecipe}>Save Recipe</Btn>
                    <Btn variant="ghost" onClick={() => { setRecipeModal(null); setRecipeModalError(null) }}>Cancel</Btn>
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
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {onSkip && (
                  <button
                    type="button"
                    onClick={onSkip}
                    style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 12.5, textDecoration: "underline", padding: 0, marginRight: 6 }}
                  >
                    Skip setup
                  </button>
                )}
                <Btn onClick={() => setStep(5)}>Save & Finish →</Btn>
              </div>
            </div>
          </div>
        )}

        {/* STEP 5: DONE */}
        {step === 5 && (
          <div style={{ textAlign: "center" }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#E5F4EC", border: "2px solid #357A52", display: "flex", alignItems: "center", justifyItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <Check size={32} color="#2D7A50" />
            </div>

            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 600, color: "var(--text)", marginBottom: 8 }}>You're all set!</div>
            <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.7, marginBottom: 24 }}>
              Your profile, opening stock, base recipes, and margins are set up. Let's get started on pricing and orders!
            </div>

            <div style={{ textAlign: "left", background: "#FAF7F0", padding: 18, borderRadius: 12, border: "1px solid var(--border)", marginBottom: 24 }}>
              <div style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "flex-start" }}>
                <span style={{ marginTop: 2 }}><Calculator size={18} color="var(--gold)" /></span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>Calculate Tiered Orders</div>
                  <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>Head straight to the **Order Calculator** to build pricing quotes for multi-tiered cakes.</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "flex-start" }}>
                <span style={{ marginTop: 2 }}><BookOpen size={18} color="var(--gold)" /></span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>Add more recipes</div>
                  <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>Visit the **Master List** → **Base Recipes** tab to add custom batch recipes.</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <span style={{ marginTop: 2 }}><Receipt size={18} color="var(--gold)" /></span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>Scan purchase receipts</div>
                  <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>Scan or log purchases to automatically restock inventory items.</div>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Btn full disabled={completing} onClick={() => handleFinish("calculator")}>
                {completing ? "Completing setup..." : "Take Your First Order"}
              </Btn>
              <Btn full variant="outline" disabled={completing} onClick={() => handleFinish("dashboard")}>
                {completing ? "Completing setup..." : "Go to Dashboard"}
              </Btn>
            </div>
          </div>
        )}


      </div>
    </div>
  )
}
