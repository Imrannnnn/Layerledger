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
import { saveCompany, saveSetting, saveInventory, saveRecipes, saveLocal, loadLocal, saveOpeningStock, refundScanCredits } from "../../lib/data.js"
import { uid, fmt, fmtCost, parseCSV, formatApiError, callClaude, compressImage, extractAndRepairJson } from "../../lib/helpers.js"
import { AlertTriangle, Check, FileSpreadsheet, PenLine, Lock, Calculator, BookOpen, Receipt, Search, X, Camera, Sparkles, UploadCloud, FileText, RefreshCw, Upload, Image as ImageIcon } from "lucide-react"

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

  // Excel / PDF / Photo Import Modal State (Step 2)
  const [showImport, setShowImport] = useState(false)
  const [importStep, setImportStep] = useState(1) // 1 = paste columns or scan, 2 = preview, 3 = done
  const [pasteN, setPasteN] = useState("")
  const [pasteU, setPasteU] = useState("")
  const [pasteQ, setPasteQ] = useState("")
  const [pasteC, setPasteC] = useState("")
  const [prevItems, setPrevItems] = useState([])
  const [warnMsg, setWarnMsg] = useState("")
  const [importMsg, setImportMsg] = useState("")

  // AI Scan State for Step 2 Import (PDF or Photo)
  const [aiFile, setAiFile] = useState(null) // { name, size, type: 'pdf'|'image', rawBase64 }
  const [aiScanning, setAiScanning] = useState(false)
  const [aiScanError, setAiScanError] = useState("")
  const [aiScanRefund, setAiScanRefund] = useState("")
  const aiFileInputRef = useRef(null)
  const aiCameraInputRef = useRef(null)

  // Per-Item Photo Scan State (Step 2 individual item scanning)
  const [scanningItem, setScanningItem] = useState(null)
  const [itemScanFile, setItemScanFile] = useState(null)
  const [itemScanning, setItemScanning] = useState(false)
  const [itemScanError, setItemScanError] = useState("")
  const [itemScanResult, setItemScanResult] = useState(null)
  const itemScanFileRef = useRef(null)
  const itemScanCameraRef = useRef(null)

  // Recipe Import Modal State (Step 3)
  const [showRecipeImport, setShowRecipeImport] = useState(false)
  const [recipeImportStep, setRecipeImportStep] = useState(1)
  const [recipeImportName, setRecipeImportName] = useState("")
  const [targetRecipeId, setTargetRecipeId] = useState(null)
  const [pasteRecipeIngN, setPasteRecipeIngN] = useState("")
  const [pasteRecipeIngQ, setPasteRecipeIngQ] = useState("")
  const [pasteRecipeIngU, setPasteRecipeIngU] = useState("")
  const [recipeImportIngs, setRecipeImportIngs] = useState([])
  const [recipeImportMsg, setRecipeImportMsg] = useState("")
  const [recipeImportTab, setRecipeImportTab] = useState("import")
  const [pickSearch, setPickSearch] = useState("")
  const [pickedQty, setPickedQty] = useState({})

  // Recipe AI Scan State (Step 3)
  const [recipeAiFile, setRecipeAiFile] = useState(null)
  const [recipeAiScanning, setRecipeAiScanning] = useState(false)
  const [recipeAiScanError, setRecipeAiScanError] = useState("")
  const [recipeAiScanRefund, setRecipeAiScanRefund] = useState("")
  const recipeAiFileInputRef = useRef(null)
  const recipeAiCameraInputRef = useRef(null)

  // Feedback & Error States
  const [onboardingError, setOnboardingError] = useState(null)
  const [recipeModalError, setRecipeModalError] = useState(null)
  const [manualAddError, setManualAddError] = useState(null)
  const [completing, setCompleting] = useState(false)

  // Step 2: Manual Add State
  const [showManualAdd, setShowManualAdd] = useState(false)
  const [calcMode, setCalcMode] = useState("auto") // "auto" or "manual"
  const [manualItem, setManualItem] = useState({ name: "", unit: "g", cost: "", openingQty: "", totalPaid: "", qtyBought: "" })
  const [manualScanning, setManualScanning] = useState(false)
  const [manualScanError, setManualScanError] = useState("")
  const manualScanFileRef = useRef(null)

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

  const openRecipeImport = (existingRecipe = null, defaultTab = "import") => {
    setRecipeImportStep(1)
    setRecipeImportMsg("")
    setRecipeAiFile(null)
    setRecipeAiScanError("")
    setRecipeAiScanRefund("")
    setPickSearch("")
    setRecipeImportTab(defaultTab)
    if (existingRecipe) {
      setTargetRecipeId(existingRecipe.id || null)
      setRecipeImportName(existingRecipe.name || "")
      setPasteRecipeIngN("")
      setPasteRecipeIngQ("")
      setPasteRecipeIngU("")
      setRecipeImportIngs([])
      const initialPicked = {}
      if (Array.isArray(existingRecipe.ing)) {
        existingRecipe.ing.forEach(item => {
          if (item && item.iid) initialPicked[item.iid] = item.qty
        })
      }
      setPickedQty(initialPicked)
    } else {
      setTargetRecipeId(null)
      setRecipeImportName("")
      setPasteRecipeIngN("")
      setPasteRecipeIngQ("")
      setPasteRecipeIngU("")
      setRecipeImportIngs([])
      setPickedQty({})
    }
    setShowRecipeImport(true)
  }

  const savePickedFromInventory = async () => {
    if (!recipeImportName || !recipeImportName.trim()) {
      setRecipeImportMsg("Please enter a Recipe Name (e.g. Vanilla Cake, Chocolate Sponge)")
      return
    }

    const activeIngs = Object.entries(pickedQty)
      .map(([iid, val]) => ({
        iid,
        qty: parseFloat(val) || 0
      }))
      .filter(item => item.qty > 0 && inventory.some(it => it.id === item.iid))

    if (!activeIngs.length) {
      setRecipeImportMsg("Please select at least one ingredient and enter its quantity.")
      return
    }

    const cleanName = recipeImportName.trim()
    const existingIdx = recipes.findIndex(r =>
      (targetRecipeId && r.id === targetRecipeId) ||
      r.name.trim().toLowerCase() === cleanName.toLowerCase()
    )

    const cleanRecipe = {
      id: existingIdx >= 0 ? recipes[existingIdx].id : uid(),
      name: cleanName,
      type: "layer",
      notes: existingIdx >= 0 ? (recipes[existingIdx].notes || "Cake layer recipe") : "Cake layer recipe",
      ing: activeIngs
    }

    let updatedRecipes
    if (existingIdx >= 0) {
      updatedRecipes = recipes.map((r, i) => i === existingIdx ? cleanRecipe : r)
    } else {
      updatedRecipes = [...recipes, cleanRecipe]
    }

    setRecipes(updatedRecipes)
    await saveRecipes(updatedRecipes)

    if (recipeModal && (recipeModal.id === cleanRecipe.id || targetRecipeId === recipeModal.id || !recipeModal.name)) {
      setRecipeModal(prev => ({
        ...prev,
        id: cleanRecipe.id,
        name: cleanRecipe.name,
        ing: cleanRecipe.ing
      }))
    }

    setRecipeImportIngs(activeIngs.map(ing => {
      const invItem = inventory.find(x => x.id === ing.iid)
      return {
        id: uid(),
        name: invItem ? invItem.name : "Ingredient",
        qty: ing.qty,
        unit: invItem ? invItem.unit : "g",
        iid: ing.iid,
        on: true
      }
    }))

    setRecipeImportStep(3)
  }

  const doRecipePreview = () => {
    setRecipeImportMsg("")
    if (!recipeImportName || !recipeImportName.trim()) {
      return setRecipeImportMsg("Please enter a Recipe Name (e.g. Vanilla Cake, Chocolate Sponge)")
    }

    const ns = L(pasteRecipeIngN)
    const qs = L(pasteRecipeIngQ)
    const us = L(pasteRecipeIngU)

    if (!ns.length) {
      return setRecipeImportMsg("Ingredient names are required")
    }
    if (qs.length > 0 && qs.length !== ns.length) {
      return setRecipeImportMsg(`Ingredient names (${ns.length}) and quantities (${qs.length}) must have the same number of rows`)
    }

    const parsedIngs = ns.map((name, i) => {
      const rawQty = qs[i] || "1"
      const cleanQty = (rawQty.includes(",") && !rawQty.includes("."))
        ? rawQty.replace(/,/g, ".")
        : rawQty.replace(/,/g, "")
      const qty = parseFloat(cleanQty.replace(/[^0-9.]/g, "")) || 1

      const cleanName = name.trim()
      let match = inventory.find(inv => inv.name.trim().toLowerCase() === cleanName.toLowerCase())
      if (!match) {
        match = inventory.find(inv =>
          inv.name.trim().toLowerCase().includes(cleanName.toLowerCase()) ||
          cleanName.toLowerCase().includes(inv.name.trim().toLowerCase())
        )
      }

      const unit = us[i] || (match ? (match.unit || "g") : "g")

      return {
        id: uid(),
        name: cleanName,
        qty,
        unit,
        iid: match ? match.id : "new",
        matchItem: match,
        on: true
      }
    }).filter(p => p.name)

    if (!parsedIngs.length) {
      return setRecipeImportMsg("No valid ingredients found")
    }

    setRecipeImportIngs(parsedIngs)
    setRecipeImportStep(2)
  }

  const confirmRecipeImport = async () => {
    if (!recipeImportName || !recipeImportName.trim()) {
      setRecipeImportMsg("Recipe name is required.")
      return
    }

    const approved = recipeImportIngs.filter(i => i.on)
    if (!approved.length) {
      setRecipeImportMsg("At least one ingredient is required.")
      return
    }

    let updatedInventory = [...inventory]
    const recipeIngredients = []

    for (const ing of approved) {
      let targetInvId = ing.iid

      // If marked as new item or not found in inventory, add to inventory
      if (targetInvId === "new" || !updatedInventory.some(x => x.id === targetInvId)) {
        const newInvId = uid()
        const newInvItem = {
          id: newInvId,
          name: ing.name.trim(),
          unit: ing.unit || "g",
          cat: "Dry Goods",
          cost: 0,
          stock: 0,
          minStock: 5
        }
        updatedInventory.push(newInvItem)
        targetInvId = newInvId
      }

      recipeIngredients.push({
        iid: targetInvId,
        qty: parseFloat(ing.qty) || 0
      })
    }

    if (updatedInventory.length !== inventory.length) {
      setInventory(updatedInventory)
      await saveInventory(updatedInventory)
    }

    const cleanName = recipeImportName.trim()
    const existingIdx = recipes.findIndex(r =>
      (targetRecipeId && r.id === targetRecipeId) ||
      r.name.trim().toLowerCase() === cleanName.toLowerCase()
    )

    let updatedRecipes
    const cleanRecipe = {
      id: existingIdx >= 0 ? recipes[existingIdx].id : uid(),
      name: cleanName,
      type: "layer",
      notes: existingIdx >= 0 ? (recipes[existingIdx].notes || "Cake layer recipe") : "Cake layer recipe",
      ing: recipeIngredients
    }

    if (existingIdx >= 0) {
      updatedRecipes = recipes.map((r, i) => i === existingIdx ? cleanRecipe : r)
    } else {
      updatedRecipes = [...recipes, cleanRecipe]
    }

    setRecipes(updatedRecipes)
    await saveRecipes(updatedRecipes)

    if (recipeModal && (recipeModal.id === cleanRecipe.id || targetRecipeId === recipeModal.id || !recipeModal.name)) {
      setRecipeModal(prev => ({
        ...prev,
        id: cleanRecipe.id,
        name: cleanRecipe.name,
        ing: cleanRecipe.ing
      }))
    }

    setRecipeImportStep(3)
  }

  // AI Scan Handlers for Inventory (Step 2)
  const handleAiFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAiScanError("")
    setAiScanRefund("")

    const isPdf = file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf"
    const isImg = file.type.startsWith("image/") || /\.(jpe?g|png|webp|gif|bmp)$/i.test(file.name)

    if (!isPdf && !isImg) {
      setAiScanError("Please select a PDF document (.pdf) or an image photo (.jpg, .png, .webp).")
      return
    }

    const reader = new FileReader()
    reader.onload = (ev) => {
      setAiFile({
        name: file.name,
        size: (file.size / 1024).toFixed(1) + " KB",
        type: isPdf ? "pdf" : "image",
        rawBase64: ev.target.result
      })
    }
    reader.readAsDataURL(file)
  }

  const scanAiInventory = async () => {
    if (!aiFile) return
    setAiScanning(true)
    setAiScanError("")
    setAiScanRefund("")

    try {
      const content = []
      if (aiFile.type === "pdf") {
        const base64Data = aiFile.rawBase64.includes(",") ? aiFile.rawBase64.split(",")[1] : aiFile.rawBase64
        content.push({
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: base64Data
          }
        })
      } else {
        const compressed = await compressImage(aiFile.rawBase64, 1920, 0.88, { enhanceContrast: true })
        content.push({
          type: "image",
          source: {
            type: "base64",
            media_type: "image/jpeg",
            data: compressed
          }
        })
      }

      const promptText = `You are an expert AI inventory and stock-audit specialist for a bakery and cake business.
Analyze this document or photo carefully. The input could be:
1. An inventory list, stock-take sheet, or spreadsheet (printed or PDF).
2. A supplier invoice, receipt, purchase order, or waybill (e.g. from flour mills, supermarket, packaging store).
3. A handwritten inventory sheet, notebook page, or paper stock count.
4. A photo of physical bakery stock, pantry shelves, ingredients (flour sacks, sugar bags, butter, eggs, flavour bottles, boxes, cake boards).
5. A price list or quotation for bakery supplies.

YOUR GOAL: Extract EVERY single distinct ingredient, material, packaging item, or supply item visible in this file.

For each item, extract:
- "name": Clean, standard ingredient/item name (e.g. "Flour", "Granulated Sugar", "Unsalted Butter", "Eggs", "Vanilla Flavour", "10-inch Cake Board", "Cocoa Powder", "Baking Powder").
- "unit": Standard measurement unit. Use "g", "kg", "ml", "l", "pcs", "crate", "carton", "pack", or "bag". Never leave empty. Default dry goods to "g" or "kg", liquids to "ml" or "l", packaging/eggs to "pcs" or "crate".
- "openingQty": Stock quantity or count visible. If it's a photo of physical items, count how many are visible (e.g. 2 sacks -> 2). If not specified or unknown, default to 1.
- "cost": Cost or price per unit (in Nigerian Naira ₦ or number). If an invoice has a total price and quantity, calculate unit price = total / quantity. If cost is not visible or unknown, set cost to 0 so the user can enter it.
- "category": Choose one of: "Dry Goods", "Dairy", "Flavours & Colours", "Packaging", "Decorations", "Other".

Return ONLY valid JSON in this exact structure, with no markdown code fences or conversational text:
{
  "items": [
    {
      "name": "Flour",
      "unit": "kg",
      "openingQty": 50,
      "cost": 1140,
      "category": "Dry Goods"
    }
  ]
}`

      content.push({
        type: "text",
        text: promptText
      })

      const raw = await callClaude([
        {
          role: "user",
          content: content
        }
      ], "You are an expert AI vision assistant for a bakery business. Extract inventory and opening stock items from documents or photos into JSON. Return valid JSON only.", 4000, { creditCost: 2, feature: "inventory_scanner" })

      let result = null
      try {
        const cleanJson = raw.replace(/```json|```/g, "").trim()
        result = JSON.parse(cleanJson)
      } catch {
        result = extractAndRepairJson(raw)
      }

      const items = result && (
        Array.isArray(result.items) ? result.items :
        Array.isArray(result.inventory) ? result.inventory :
        Array.isArray(result.data) ? result.data :
        Array.isArray(result) ? result : null
      )

      if (!items || items.length === 0) {
        if (typeof refundScanCredits === "function") {
          try {
            await refundScanCredits(2, "Failed inventory scan: no readable items detected")
            setAiScanRefund("Scan could not read any items. 2 credits refunded automatically.")
          } catch (_) {}
        }
        setAiScanError("No inventory items could be detected in this file. Please make sure the photo or document is clear and readable.")
        return
      }

      const parsedItems = items.map(it => {
        const rawCost = it.cost !== undefined ? it.cost : (it.unit_price || it.price || 0)
        const costNum = parseFloat(String(rawCost).replace(/[^0-9.]/g, "")) || 0
        const rawQty = it.openingQty !== undefined ? it.openingQty : (it.stock !== undefined ? it.stock : (it.qty || 1))
        const qtyNum = parseFloat(String(rawQty).replace(/[^0-9.]/g, "")) || 1

        return {
          id: uid(),
          name: (it.name || it.item || "Unnamed Item").trim(),
          unit: it.unit || "g",
          cost: costNum,
          stock: qtyNum,
          openingQty: qtyNum,
          minStock: 5,
          on: true,
          cat: it.category || "Dry Goods"
        }
      }).filter(p => p.name)

      if (parsedItems.length === 0) {
        setAiScanError("No valid items could be parsed from the file.")
        return
      }

      setPrevItems(parsedItems)
      setPasteN(parsedItems.map(p => p.name).join("\n"))
      setPasteU(parsedItems.map(p => p.unit).join("\n"))
      setPasteQ(parsedItems.map(p => p.openingQty).join("\n"))
      setPasteC(parsedItems.map(p => p.cost).join("\n"))
      setImportStep(2)
    } catch (err) {
      console.error("AI inventory scan failed:", err)
      if (!err.message?.includes("DAILY_AI_CEILING_REACHED") && !err.message?.includes("Insufficient")) {
        if (typeof refundScanCredits === "function") {
          try {
            await refundScanCredits(2, `Failed inventory scan: ${err.message}`)
            setAiScanRefund("Scan failed. 2 credits refunded automatically.")
          } catch (_) {}
        }
      }
      setAiScanError(`Scan failed: ${err.message}`)
    } finally {
      setAiScanning(false)
    }
  }

  // Single Item Photo Scan Handlers (Step 2 per-item)
  const handleItemScanFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setItemScanError("")
    setItemScanResult(null)

    const isPdf = file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf"
    const isImg = file.type.startsWith("image/") || /\.(jpe?g|png|webp|gif|bmp)$/i.test(file.name)

    if (!isPdf && !isImg) {
      setItemScanError("Please select an image photo (.jpg, .png, .webp) or PDF.")
      return
    }

    const reader = new FileReader()
    reader.onload = (ev) => {
      setItemScanFile({
        name: file.name,
        size: (file.size / 1024).toFixed(1) + " KB",
        type: isPdf ? "pdf" : "image",
        rawBase64: ev.target.result
      })
    }
    reader.readAsDataURL(file)
  }

  const scanSingleItemPhoto = async () => {
    if (!itemScanFile || !scanningItem) return
    setItemScanning(true)
    setItemScanError("")
    setItemScanResult(null)

    try {
      const content = []
      if (itemScanFile.type === "pdf") {
        const base64Data = itemScanFile.rawBase64.includes(",") ? itemScanFile.rawBase64.split(",")[1] : itemScanFile.rawBase64
        content.push({
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: base64Data }
        })
      } else {
        const compressed = await compressImage(itemScanFile.rawBase64, 1920, 0.88, { enhanceContrast: true })
        content.push({
          type: "image",
          source: { type: "base64", media_type: "image/jpeg", data: compressed }
        })
      }

      content.push({
        type: "text",
        text: `You are an expert AI vision assistant for a bakery business.
Analyze this photo of a bakery ingredient, packaging supply, or purchase receipt/label for the target inventory item: "${scanningItem.name}".
Extract:
- "name": Detected brand or item name.
- "unit": Measurement unit ("kg", "g", "ml", "l", "pcs", "crate", "pack", "carton", "bag").
- "cost": Unit price or amount paid per unit (in Naira ₦ or number). If total amount and quantity are shown, calculate cost per unit. If not visible, return 0.
- "openingQty": Quantity visible or stated (default 1).

Return ONLY valid JSON:
{
  "name": "${scanningItem.name}",
  "unit": "${scanningItem.unit || 'g'}",
  "cost": 0,
  "openingQty": 1
}`
      })

      const raw = await callClaude([
        { role: "user", content }
      ], "Extract inventory item cost and quantity from image into JSON. Return valid JSON only.", 2000, { creditCost: 2, feature: "inventory_scanner" })

      let result = null
      try {
        const cleanJson = raw.replace(/```json|```/g, "").trim()
        result = JSON.parse(cleanJson)
      } catch {
        result = extractAndRepairJson(raw)
      }

      const itemData = (result?.items && result.items[0]) || result || {}
      const extractedCost = parseFloat(String(itemData.cost || itemData.unit_price || 0).replace(/[^0-9.]/g, "")) || 0
      const extractedQty = parseFloat(String(itemData.openingQty || itemData.qty || itemData.stock || 1).replace(/[^0-9.]/g, "")) || 1
      const extractedUnit = itemData.unit || scanningItem.unit || "g"

      setItemScanResult({
        cost: extractedCost,
        openingQty: extractedQty,
        unit: extractedUnit,
        name: itemData.name || scanningItem.name
      })
    } catch (err) {
      console.error("Item photo scan failed:", err)
      if (!err.message?.includes("DAILY_AI_CEILING_REACHED") && !err.message?.includes("Insufficient")) {
        if (typeof refundScanCredits === "function") {
          try {
            await refundScanCredits(2, `Failed item photo scan: ${err.message}`)
          } catch (_) {}
        }
      }
      setItemScanError(`Scan failed: ${err.message}`)
    } finally {
      setItemScanning(false)
    }
  }

  const applyItemScanResult = async () => {
    if (!scanningItem || !itemScanResult) return
    if (itemScanResult.cost !== undefined) {
      await updateCost(scanningItem.id, itemScanResult.cost)
    }
    if (itemScanResult.openingQty !== undefined) {
      await updateOS(scanningItem.id, itemScanResult.openingQty)
    }
    setScanningItem(null)
    setItemScanFile(null)
    setItemScanResult(null)
  }

  // Manual Add Item Photo Scan Handler
  const handleManualPhotoScan = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setManualScanError("")
    setManualScanning(true)

    try {
      const isPdf = file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf"
      const reader = new FileReader()
      const rawBase64 = await new Promise((resolve, reject) => {
        reader.onload = ev => resolve(ev.target.result)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      const content = []
      if (isPdf) {
        const base64Data = rawBase64.includes(",") ? rawBase64.split(",")[1] : rawBase64
        content.push({
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: base64Data }
        })
      } else {
        const compressed = await compressImage(rawBase64, 1920, 0.88, { enhanceContrast: true })
        content.push({
          type: "image",
          source: { type: "base64", media_type: "image/jpeg", data: compressed }
        })
      }

      content.push({
        type: "text",
        text: `You are an expert AI vision assistant for a bakery business.
Analyze this photo of a bakery ingredient, packaging supply, or purchase receipt/label.
Extract:
- "name": Clean item or brand name (e.g. "Dangote Sugar", "Simas Margarine", "Golden Penny Flour", "Egg Crate").
- "unit": Measurement unit ("kg", "g", "ml", "l", "pcs", "crate", "pack", "carton", "bag").
- "cost": Unit price or cost (in Naira ₦ or number). If total paid and quantity are shown, calculate unit price.
- "openingQty": Starting stock quantity visible or stated (default 1).
- "category": One of "Dry Goods", "Dairy", "Flavours & Colours", "Packaging", "Decorations", "Other".

Return ONLY valid JSON:
{
  "name": "Item name",
  "unit": "kg",
  "cost": 1500,
  "openingQty": 1,
  "category": "Dry Goods"
}`
      })

      const raw = await callClaude([
        { role: "user", content }
      ], "Extract inventory item details from photo into JSON. Return valid JSON only.", 2000, { creditCost: 2, feature: "inventory_scanner" })

      let result = null
      try {
        const cleanJson = raw.replace(/```json|```/g, "").trim()
        result = JSON.parse(cleanJson)
      } catch {
        result = extractAndRepairJson(raw)
      }

      const itemData = (result?.items && result.items[0]) || result || {}
      const extractedCost = parseFloat(String(itemData.cost || itemData.unit_price || 0).replace(/[^0-9.]/g, "")) || ""
      const extractedQty = parseFloat(String(itemData.openingQty || itemData.qty || itemData.stock || 1).replace(/[^0-9.]/g, "")) || ""

      setCalcMode("manual")
      setManualItem(m => ({
        ...m,
        name: itemData.name || m.name,
        unit: itemData.unit || m.unit,
        cost: extractedCost !== "" ? extractedCost : m.cost,
        openingQty: extractedQty !== "" ? extractedQty : m.openingQty
      }))
    } catch (err) {
      console.error("Manual add scan failed:", err)
      if (!err.message?.includes("DAILY_AI_CEILING_REACHED") && !err.message?.includes("Insufficient")) {
        if (typeof refundScanCredits === "function") {
          try {
            await refundScanCredits(2, `Failed manual item photo scan: ${err.message}`)
          } catch (_) {}
        }
      }
      setManualScanError(`Scan failed: ${err.message}`)
    } finally {
      setManualScanning(false)
      if (manualScanFileRef.current) manualScanFileRef.current.value = ""
    }
  }

  // Recipe AI Scan Handlers (Step 3)
  const handleRecipeAiFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setRecipeAiScanError("")
    setRecipeAiScanRefund("")
    const isPdf = file.name?.toLowerCase().endsWith(".pdf") || file.type === "application/pdf"
    const reader = new FileReader()
    reader.onload = ev => {
      setRecipeAiFile({
        name: file.name || "recipe-upload",
        size: (file.size / 1024).toFixed(1) + " KB",
        type: isPdf ? "pdf" : "image",
        rawBase64: ev.target.result
      })
    }
    reader.readAsDataURL(file)
  }

  const scanAiRecipes = async () => {
    if (!recipeAiFile) return
    setRecipeAiScanning(true)
    setRecipeAiScanError("")
    setRecipeAiScanRefund("")

    try {
      const content = []
      if (recipeAiFile.type === "pdf") {
        const base64Data = recipeAiFile.rawBase64.includes(",") ? recipeAiFile.rawBase64.split(",")[1] : recipeAiFile.rawBase64
        content.push({
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: base64Data }
        })
      } else {
        const compressed = await compressImage(recipeAiFile.rawBase64, 1920, 0.88, { enhanceContrast: true })
        content.push({
          type: "image",
          source: { type: "base64", media_type: "image/jpeg", data: compressed }
        })
      }

      content.push({
        type: "text",
        text: `You are an expert culinary/baking recipe parser for a professional bakery.
Analyze this document or photo of a recipe sheet, recipe card, cookbook page, handwritten recipe, spec sheet, or bakery formula.

YOUR GOAL:
1. Extract the Recipe Name (e.g. "Chocolate Sponge", "Vanilla Cake", "Red Velvet Layer", "Buttercream Frosting").
2. Extract EVERY ingredient along with its numeric quantity and standard measurement unit.

Standard measurement units: kg, g, l, ml, piece, pcs, pack, bunch, tsp, tbsp, cup.
If a quantity is a fraction like 1/2, convert to 0.5.
If unit is not stated, default to "g" for dry ingredients, "ml" for liquids, and "piece" for count items like eggs.

Return ONLY valid JSON in this exact structure with no markdown code fences or conversational text:
{
  "recipeName": "Chocolate Sponge",
  "ingredients": [
    { "name": "Flour", "quantity": 500, "unit": "g" },
    { "name": "Sugar", "quantity": 250, "unit": "g" },
    { "name": "Cocoa Powder", "quantity": 50, "unit": "g" },
    { "name": "Eggs", "quantity": 4, "unit": "piece" }
  ]
}`
      })

      const raw = await callClaude([
        { role: "user", content }
      ], "Extract recipe name and ingredients with quantities from photo or document into JSON. Return valid JSON only.", 2500, { creditCost: 2, feature: "recipe_scanner" })

      let result = null
      try {
        const cleanJson = raw.replace(/```json|```/g, "").trim()
        result = JSON.parse(cleanJson)
      } catch {
        result = extractAndRepairJson(raw)
      }

      let parsedName = result?.recipeName || result?.name || result?.title || ""
      let rawIngs = result?.ingredients || result?.items || []

      if ((!rawIngs || rawIngs.length === 0) && Array.isArray(result?.recipes) && result.recipes.length > 0) {
        const first = result.recipes[0]
        parsedName = parsedName || first.name || first.title || ""
        rawIngs = first.ingredients || first.items || []
      } else if (Array.isArray(result) && result.length > 0) {
        if (result[0]?.name && (result[0]?.quantity !== undefined || result[0]?.qty !== undefined)) {
          rawIngs = result
        } else if (result[0]?.ingredients) {
          parsedName = parsedName || result[0].name || ""
          rawIngs = result[0].ingredients
        }
      }

      if (!rawIngs || rawIngs.length === 0) {
        if (typeof refundScanCredits === "function") {
          try {
            await refundScanCredits(2, "Failed recipe scan: no readable ingredients detected")
            setRecipeAiScanRefund("Scan could not read any ingredients. 2 credits refunded automatically.")
          } catch (_) {}
        }
        setRecipeAiScanError("No ingredients or quantities could be detected in this file. Please make sure the photo or document is clear.")
        return
      }

      if (parsedName && !recipeImportName.trim()) {
        setRecipeImportName(parsedName.trim())
      }

      const items = rawIngs.map(ing => {
        const rawName = String(ing.name || ing.item || "Ingredient").trim()
        const norm = rawName.toLowerCase()
        let match = inventory.find(it => it.name.trim().toLowerCase() === norm)
        if (!match) {
          match = inventory.find(it => it.name.toLowerCase().includes(norm) || norm.includes(it.name.toLowerCase()))
        }

        const rawQty = ing.quantity !== undefined ? ing.quantity : (ing.qty !== undefined ? ing.qty : 1)
        const cleanQty = typeof rawQty === "string" ? rawQty.replace(/,/g, ".") : rawQty
        const qtyNum = parseFloat(String(cleanQty).replace(/[^0-9.]/g, "")) || 1

        return {
          id: uid(),
          name: rawName,
          qty: qtyNum > 0 ? qtyNum : 1,
          unit: match ? (match.unit || (ing.unit || "g")) : (ing.unit || "g"),
          iid: match ? match.id : "new",
          matchItem: match,
          on: true
        }
      }).filter(p => p.name)

      if (items.length === 0) {
        if (typeof refundScanCredits === "function") {
          try {
            await refundScanCredits(2, "Failed recipe scan: no valid ingredients parsed")
            setRecipeAiScanRefund("Scan could not read any ingredients. 2 credits refunded automatically.")
          } catch (_) {}
        }
        setRecipeAiScanError("No valid ingredients could be parsed from this file.")
        return
      }

      setRecipeImportIngs(items)
      setPasteRecipeIngN(items.map(x => x.name).join("\n"))
      setPasteRecipeIngQ(items.map(x => x.qty).join("\n"))
      setPasteRecipeIngU(items.map(x => x.unit).join("\n"))
      setRecipeImportStep(2)
    } catch (err) {
      console.error("Recipe scan failed:", err)
      if (typeof refundScanCredits === "function") {
        try {
          await refundScanCredits(2, `Failed recipe scan: ${err.message}`)
          setRecipeAiScanRefund("Scan failed. 2 credits refunded automatically.")
        } catch (_) {}
      }
      setRecipeAiScanError(`Scan failed: ${err.message}`)
    } finally {
      setRecipeAiScanning(false)
      if (recipeAiFileInputRef.current) recipeAiFileInputRef.current.value = ""
      if (recipeAiCameraInputRef.current) recipeAiCameraInputRef.current.value = ""
    }
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
                          <td style={{ padding: "8px 10px", fontWeight: 500 }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                              <span>{item.name}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setScanningItem(item)
                                  setItemScanFile(null)
                                  setItemScanResult(null)
                                  setItemScanError("")
                                }}
                                title={`Scan photo or receipt for ${item.name}`}
                                style={{
                                  background: "none",
                                  border: "1px solid var(--border)",
                                  borderRadius: 6,
                                  padding: "2px 6px",
                                  cursor: "pointer",
                                  color: "var(--muted)",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 3,
                                  fontSize: 10.5,
                                  flexShrink: 0
                                }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = gold; e.currentTarget.style.color = gold }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--muted)" }}
                              >
                                <Camera size={11} /> Scan
                              </button>
                            </div>
                          </td>
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
              <Modal title="Add Item Manually" onClose={() => { setShowManualAdd(false); setManualAddError(null); setManualScanError(""); }}>
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

                {manualScanError && (
                  <div style={{ padding: "8px 12px", background: "#FDEBE9", borderRadius: 8, fontSize: 12, color: "#B03A2E", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                    <AlertTriangle size={14} /> {manualScanError}
                  </div>
                )}

                {/* AI Photo Auto-Fill */}
                <div style={{ marginBottom: 14 }}>
                  <Btn
                    type="button"
                    small
                    variant="outline"
                    onClick={() => manualScanFileRef.current?.click()}
                    disabled={manualScanning}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      borderColor: "var(--gold)",
                      color: "var(--gold)",
                      background: "#FAF7F0",
                      padding: "8px 12px",
                      borderRadius: 8
                    }}
                  >
                    {manualScanning ? (
                      <>
                        <RefreshCw size={13} style={{ animation: "spin 1s linear infinite" }} /> Scanning photo with AI...
                      </>
                    ) : (
                      <>
                        <Sparkles size={13} /> Scan Photo or Receipt to Auto-Fill (AI)
                      </>
                    )}
                  </Btn>
                  <input
                    ref={manualScanFileRef}
                    type="file"
                    accept="image/*,.pdf"
                    onChange={handleManualPhotoScan}
                    style={{ display: "none" }}
                  />
                </div>

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

            {/* PER-ITEM PHOTO SCAN MODAL */}
            {scanningItem && (
              <Modal title={`Scan Photo for ${scanningItem.name}`} onClose={() => { setScanningItem(null); setItemScanFile(null); setItemScanResult(null); setItemScanError(""); }}>
                <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 12, lineHeight: 1.6 }}>
                  Upload or snap a photo of your <strong>{scanningItem.name}</strong> bag, packaging, price label, or purchase receipt. AI will extract the unit cost and stock count.
                </div>

                {itemScanError && (
                  <div style={{ padding: "8px 12px", background: "#FDEBE9", borderRadius: 8, fontSize: 12, color: "#B03A2E", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                    <AlertTriangle size={14} /> {itemScanError}
                  </div>
                )}

                {!itemScanFile ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                    <div
                      onClick={() => itemScanFileRef.current?.click()}
                      style={{
                        border: "2px dashed var(--border)",
                        borderRadius: 12,
                        padding: "22px 16px",
                        textAlign: "center",
                        cursor: "pointer",
                        background: "#FAF7F0",
                        transition: "all 0.2s"
                      }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = gold}
                      onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}
                    >
                      <Camera size={26} color="var(--gold)" style={{ margin: "0 auto 8px" }} />
                      <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text)", marginBottom: 4 }}>
                        Click to upload photo or document
                      </div>
                      <div style={{ fontSize: 11.5, color: "var(--muted)" }}>
                        Supports JPG, PNG, WEBP or PDF receipt
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                      <Btn small variant="outline" onClick={() => itemScanFileRef.current?.click()} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                        <UploadCloud size={13} /> Select Photo or PDF
                      </Btn>
                      <Btn small variant="outline" onClick={() => itemScanCameraRef.current?.click()} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                        <Camera size={13} /> Take photo
                      </Btn>
                    </div>

                    <input ref={itemScanFileRef} type="file" accept="image/*,.pdf" onChange={handleItemScanFileSelect} style={{ display: "none" }} />
                    <input ref={itemScanCameraRef} type="file" accept="image/*" capture="environment" onChange={handleItemScanFileSelect} style={{ display: "none" }} />
                  </div>
                ) : (
                  <div style={{ marginBottom: 16, padding: 12, background: "#FAF7F0", borderRadius: 10, border: "1px solid var(--border)" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {itemScanFile.type === "image" ? (
                          <img src={itemScanFile.rawBase64} alt="Preview" style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 6 }} />
                        ) : (
                          <FileText size={30} color="var(--gold)" />
                        )}
                        <div>
                          <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)" }}>{itemScanFile.name}</div>
                          <div style={{ fontSize: 11, color: "var(--muted)" }}>{itemScanFile.size} • {itemScanFile.type.toUpperCase()}</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setItemScanFile(null); setItemScanResult(null); }}
                        style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", padding: 4 }}
                      >
                        <X size={16} />
                      </button>
                    </div>

                    {!itemScanResult && (
                      <Btn
                        onClick={scanSingleItemPhoto}
                        disabled={itemScanning}
                        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                      >
                        {itemScanning ? (
                          <>
                            <RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} /> Scanning photo with AI...
                          </>
                        ) : (
                          <>
                            <Sparkles size={14} /> Scan Photo with AI (2 Credits)
                          </>
                        )}
                      </Btn>
                    )}
                  </div>
                )}

                {itemScanResult && (
                  <div style={{ padding: 14, background: "#F5FBF6", border: "1.5px solid #C3E6CB", borderRadius: 10, marginBottom: 16 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "#155724", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                      <Check size={16} color="#28A745" /> AI Scan Detected Details
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 12 }}>
                      <div>
                        <span style={{ color: "var(--muted)", display: "block", marginBottom: 3 }}>Cost per Unit:</span>
                        <input
                          type="number"
                          value={itemScanResult.cost}
                          onChange={e => setItemScanResult(r => ({ ...r, cost: parseFloat(e.target.value) || 0 }))}
                          style={{ ...iSt, width: "100%", padding: "5px 8px", fontSize: 13, fontWeight: 600, color: "var(--gold)" }}
                        />
                      </div>
                      <div>
                        <span style={{ color: "var(--muted)", display: "block", marginBottom: 3 }}>Opening Quantity:</span>
                        <input
                          type="number"
                          value={itemScanResult.openingQty}
                          onChange={e => setItemScanResult(r => ({ ...r, openingQty: parseFloat(e.target.value) || 0 }))}
                          style={{ ...iSt, width: "100%", padding: "5px 8px", fontSize: 13, fontWeight: 600 }}
                        />
                      </div>
                    </div>

                    <div style={{ marginTop: 12, display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      <Btn variant="success" onClick={applyItemScanResult} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                        <Check size={13} /> Apply to {scanningItem.name}
                      </Btn>
                    </div>
                  </div>
                )}

                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <Btn variant="ghost" onClick={() => { setScanningItem(null); setItemScanFile(null); setItemScanResult(null); }}>
                    Cancel
                  </Btn>
                </div>
              </Modal>
            )}

            {/* IMPORT MODAL */}
            {showImport && (
              <Modal title="Import — Excel, PDF or a photo" onClose={() => { setShowImport(false); setAiFile(null); setAiScanError(""); setAiScanRefund(""); }}>
                {importStep === 1 && (
                  <div>
                    {/* OPTION A: AI SCAN (PDF OR PHOTO) */}
                    <div style={{ marginBottom: 18, padding: "14px 16px", background: "#FAF7F0", border: "1.5px dashed var(--gold)", borderRadius: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <Sparkles size={16} color="var(--gold)" />
                          <span style={{ fontWeight: 600, fontSize: 13.5, color: "var(--text)" }}>Option A: Scan PDF or Photo with AI</span>
                        </div>
                        <span style={{ fontSize: 10.5, background: "#FFF3D6", color: "#8A6318", padding: "2px 7px", borderRadius: 4, fontWeight: 600 }}>2 Credits</span>
                      </div>
                      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12, lineHeight: 1.5 }}>
                        Upload a stock sheet PDF, supplier invoice, paper receipt, handwritten inventory list, or snap a photo of physical ingredients/supplies. AI will read all item names, units, stock quantities, and costs.
                      </div>

                      {aiScanError && (
                        <div style={{ padding: "8px 12px", background: "#FDEBE9", borderRadius: 8, fontSize: 12, color: "#B03A2E", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                          <AlertTriangle size={14} /> {aiScanError}
                        </div>
                      )}

                      {aiScanRefund && (
                        <div style={{ padding: "8px 12px", background: "#E8F4FD", borderRadius: 8, fontSize: 12, color: "#0B5394", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                          <Check size={14} /> {aiScanRefund}
                        </div>
                      )}

                      {!aiFile ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          <div
                            onClick={() => aiFileInputRef.current?.click()}
                            style={{
                              border: "1.5px dashed #D5C29D",
                              borderRadius: 10,
                              padding: "18px 16px",
                              textAlign: "center",
                              cursor: "pointer",
                              background: "#FFFFFF",
                              transition: "all 0.2s"
                            }}
                            onMouseEnter={e => e.currentTarget.style.borderColor = gold}
                            onMouseLeave={e => e.currentTarget.style.borderColor = "#D5C29D"}
                          >
                            <UploadCloud size={26} color="var(--gold)" style={{ margin: "0 auto 6px" }} />
                            <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)" }}>
                              Click or drop PDF document or photo here
                            </div>
                            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                              Supports .pdf, .jpg, .png, .webp (invoices, stock sheets, photos)
                            </div>
                          </div>

                          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                            <Btn small variant="outline" onClick={() => aiFileInputRef.current?.click()} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                              <UploadCloud size={13} /> Select PDF or Photo
                            </Btn>
                            <Btn small variant="outline" onClick={() => aiCameraInputRef.current?.click()} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                              <Camera size={13} /> Take photo
                            </Btn>
                          </div>

                          <input ref={aiFileInputRef} type="file" accept=".pdf,image/*,application/pdf" onChange={handleAiFileSelect} style={{ display: "none" }} />
                          <input ref={aiCameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleAiFileSelect} style={{ display: "none" }} />
                        </div>
                      ) : (
                        <div style={{ padding: 12, background: "#FFFFFF", borderRadius: 8, border: "1px solid var(--border)" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              {aiFile.type === "image" ? (
                                <img src={aiFile.rawBase64} alt="Preview" style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 6 }} />
                              ) : (
                                <FileText size={30} color="var(--gold)" />
                              )}
                              <div>
                                <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)" }}>{aiFile.name}</div>
                                <div style={{ fontSize: 11, color: "var(--muted)" }}>{aiFile.size} • {aiFile.type.toUpperCase()}</div>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => { setAiFile(null); setAiScanError(""); setAiScanRefund(""); }}
                              style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", padding: 4 }}
                              title="Remove file"
                            >
                              <X size={16} />
                            </button>
                          </div>

                          <Btn
                            onClick={scanAiInventory}
                            disabled={aiScanning}
                            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                          >
                            {aiScanning ? (
                              <>
                                <RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} /> Scanning & Extracting with AI...
                              </>
                            ) : (
                              <>
                                <Sparkles size={14} /> Scan & Extract Inventory with AI (2 Credits)
                              </>
                            )}
                          </Btn>
                        </div>
                      )}
                    </div>

                    {/* OPTION B: EXCEL COPY-PASTE */}
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                        <FileSpreadsheet size={15} color="var(--muted)" />
                        <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text)" }}>Option B: Paste Columns from Excel</span>
                      </div>
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
                        <Btn variant="ghost" onClick={() => { setShowImport(false); setAiFile(null); setAiScanError(""); setAiScanRefund(""); }}>Cancel</Btn>
                      </div>
                    </div>
                  </div>
                )}

                {importStep === 2 && (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <div style={{ fontSize: 12.5, color: "var(--muted)" }}>
                        {aiFile ? `✨ Extracted ${prevItems.length} items from ${aiFile.name}. Toggle off anything you don't want to import.` : "Toggle off anything you don't want to import."}
                      </div>
                      <Badge color="gold">{prevItems.filter(p => p.on).length} of {prevItems.length} active</Badge>
                    </div>
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
                <Btn small variant="outline" onClick={() => openRecipeImport(null)} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
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
              <Modal title="Import Recipe & Ingredients" onClose={() => { setShowRecipeImport(false); setRecipeAiFile(null); setRecipeAiScanError(""); setRecipeAiScanRefund(""); }}>
                {recipeImportStep === 1 && (() => {
                  const filteredPickInventory = inventory.filter(item =>
                    !pickSearch || item.name.toLowerCase().includes(pickSearch.toLowerCase())
                  )
                  const selectedCount = Object.entries(pickedQty).filter(([iid, val]) => {
                    const q = parseFloat(val)
                    return q > 0 && inventory.some(it => it.id === iid)
                  }).length
                  const layerCost = Object.entries(pickedQty).reduce((sum, [iid, val]) => {
                    const q = parseFloat(val) || 0
                    const item = inventory.find(it => it.id === iid)
                    return sum + (item ? item.cost * q : 0)
                  }, 0)

                  return (
                    <div>
                      {/* RECIPE NAME INPUT */}
                      <div style={{ marginBottom: 14 }}>
                        <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text)", display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.5 }}>
                          Recipe Name *
                        </label>
                        <input
                          type="text"
                          value={recipeImportName}
                          onChange={e => { setRecipeImportName(e.target.value); setRecipeImportMsg(""); }}
                          placeholder="e.g. Chocolate Sponge, Red Velvet Cake, Vanilla Buttercream"
                          style={{ ...iSt, width: "100%", fontSize: 13, padding: "8px 12px" }}
                        />
                        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
                          Enter the recipe name. If you scan a recipe photo or PDF, the AI can also detect the name automatically.
                        </div>
                      </div>

                      {/* TABS: IMPORT VS PICK FROM INVENTORY */}
                      <div style={{ display: "flex", gap: 8, marginBottom: 16, borderBottom: "1px solid var(--border)", paddingBottom: 10 }}>
                        <button
                          type="button"
                          onClick={() => { setRecipeImportTab("import"); setRecipeImportMsg(""); }}
                          style={{
                            padding: "8px 14px",
                            borderRadius: 7,
                            border: recipeImportTab === "import" ? "1.5px solid var(--gold)" : "1px solid var(--border)",
                            background: recipeImportTab === "import" ? "#FFF8E7" : "transparent",
                            color: recipeImportTab === "import" ? "var(--text)" : "var(--muted)",
                            fontWeight: recipeImportTab === "import" ? 600 : 500,
                            fontSize: 12.5,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 6
                          }}
                        >
                          <UploadCloud size={14} color={recipeImportTab === "import" ? "var(--gold)" : "var(--muted)"} />
                          Import — Photo, PDF or Excel
                        </button>
                        <button
                          type="button"
                          onClick={() => { setRecipeImportTab("pick"); setRecipeImportMsg(""); }}
                          style={{
                            padding: "8px 14px",
                            borderRadius: 7,
                            border: recipeImportTab === "pick" ? "1.5px solid var(--gold)" : "1px solid var(--border)",
                            background: recipeImportTab === "pick" ? "#FFF8E7" : "transparent",
                            color: recipeImportTab === "pick" ? "var(--text)" : "var(--muted)",
                            fontWeight: recipeImportTab === "pick" ? 600 : 500,
                            fontSize: 12.5,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 6
                          }}
                        >
                          <Check size={14} color={recipeImportTab === "pick" ? "var(--gold)" : "var(--muted)"} />
                          Pick from Inventory List ({inventory.length})
                        </button>
                      </div>

                      {/* TAB 1: PICK FROM INVENTORY LIST */}
                      {recipeImportTab === "pick" && (
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
                            <div style={{ fontSize: 12.5, color: "var(--muted)" }}>
                              Select ingredients from your inventory list and enter the quantity for each.
                            </div>
                            <Badge color="gold">{selectedCount} selected • Cost: {fmt(layerCost)} / layer</Badge>
                          </div>

                          <div style={{ position: "relative", marginBottom: 10 }}>
                            <Search size={14} style={{ position: "absolute", left: 10, top: 10, color: "var(--muted)" }} />
                            <input
                              type="text"
                              placeholder="Search inventory items..."
                              value={pickSearch}
                              onChange={e => setPickSearch(e.target.value)}
                              style={{ ...iSt, width: "100%", paddingLeft: 30, fontSize: 12.5, padding: "7px 10px 7px 30px" }}
                            />
                          </div>

                          {recipeImportMsg && (
                            <div style={{ padding: "7px 12px", background: "#FDEBE9", borderRadius: 7, fontSize: 12, color: "#B03A2E", marginBottom: 10, display: "flex", alignItems: "center", gap: 5 }}>
                              <AlertTriangle size={12} /> {recipeImportMsg}
                            </div>
                          )}

                          <div style={{ overflowY: "auto", maxHeight: 220, border: "1px solid var(--border)", borderRadius: 8, background: "#FFF", marginBottom: 14 }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                              <thead>
                                <tr style={{ background: "#EDE5D6", position: "sticky", top: 0, zIndex: 1 }}>
                                  <th style={{ padding: "7px 10px", width: 36, textAlign: "center" }}></th>
                                  <th style={{ padding: "7px 10px", textAlign: "left", fontSize: 10, textTransform: "uppercase", letterSpacing: .8, color: "var(--muted)", fontWeight: 500 }}>Ingredient</th>
                                  <th style={{ padding: "7px 10px", textAlign: "right", fontSize: 10, textTransform: "uppercase", letterSpacing: .8, color: "var(--muted)", fontWeight: 500 }}>Unit Cost</th>
                                  <th style={{ padding: "7px 10px", textAlign: "right", width: 110, fontSize: 10, textTransform: "uppercase", letterSpacing: .8, color: "var(--gold)", fontWeight: 600 }}>Quantity</th>
                                  <th style={{ padding: "7px 10px", textAlign: "right", fontSize: 10, textTransform: "uppercase", letterSpacing: .8, color: "var(--muted)", fontWeight: 500 }}>Cost</th>
                                </tr>
                              </thead>
                              <tbody>
                                {filteredPickInventory.length === 0 ? (
                                  <tr>
                                    <td colSpan={5} style={{ padding: 18, textAlign: "center", color: "var(--muted)", fontSize: 12 }}>
                                      {inventory.length === 0 ? "No inventory items found. Add ingredients in Step 1 or import them." : "No matching inventory items."}
                                    </td>
                                  </tr>
                                ) : (
                                  filteredPickInventory.map((item, idx) => {
                                    const currentVal = pickedQty[item.id] !== undefined ? pickedQty[item.id] : ""
                                    const hasQty = currentVal !== "" && parseFloat(currentVal) > 0
                                    const itemCost = hasQty ? (parseFloat(currentVal) * item.cost) : 0

                                    return (
                                      <tr key={item.id} style={{ background: idx % 2 === 0 ? "#FFF" : "#FAF7F0", borderBottom: "1px solid #F0E8D8" }}>
                                        <td style={{ padding: "6px 10px", textAlign: "center" }}>
                                          <input
                                            type="checkbox"
                                            checked={hasQty}
                                            onChange={e => {
                                              if (e.target.checked) {
                                                setPickedQty(prev => ({ ...prev, [item.id]: prev[item.id] || "1" }))
                                              } else {
                                                setPickedQty(prev => {
                                                  const updated = { ...prev }
                                                  delete updated[item.id]
                                                  return updated
                                                })
                                              }
                                              setRecipeImportMsg("")
                                            }}
                                            style={{ cursor: "pointer", accentColor: "var(--gold)" }}
                                          />
                                        </td>
                                        <td style={{ padding: "6px 10px", fontWeight: 500 }}>
                                          {item.name} <span style={{ fontSize: 11, color: "var(--muted)" }}>({item.unit})</span>
                                        </td>
                                        <td style={{ padding: "6px 10px", textAlign: "right", color: "var(--muted)", fontSize: 11.5 }}>
                                          {fmt(item.cost)}/{item.unit}
                                        </td>
                                        <td style={{ padding: "6px 10px", textAlign: "right" }}>
                                          <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
                                            <input
                                              type="number"
                                              placeholder="0"
                                              value={currentVal}
                                              onChange={e => {
                                                const val = e.target.value
                                                setPickedQty(prev => ({ ...prev, [item.id]: val }))
                                                setRecipeImportMsg("")
                                              }}
                                              style={{ ...iSt, width: 70, padding: "3px 6px", fontSize: 12, textAlign: "right" }}
                                            />
                                            <span style={{ fontSize: 11, color: "var(--muted)", width: 22 }}>{item.unit}</span>
                                          </div>
                                        </td>
                                        <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: 500, color: itemCost > 0 ? "var(--gold)" : "var(--muted)", fontSize: 11.5 }}>
                                          {itemCost > 0 ? fmt(itemCost) : "—"}
                                        </td>
                                      </tr>
                                    )
                                  })
                                )}
                              </tbody>
                            </table>
                          </div>

                          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                            <Btn
                              variant="success"
                              onClick={savePickedFromInventory}
                              disabled={!recipeImportName.trim() || selectedCount === 0}
                              style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
                            >
                              <Check size={13} /> Save Recipe ({selectedCount} Ingredients)
                            </Btn>
                            <Btn variant="ghost" onClick={() => { setShowRecipeImport(false); setRecipeAiFile(null); setRecipeAiScanError(""); setRecipeAiScanRefund(""); }}>
                              Cancel
                            </Btn>
                          </div>
                        </div>
                      )}

                      {/* TAB 2: IMPORT — PHOTO, PDF OR EXCEL */}
                      {recipeImportTab === "import" && (
                        <div>
                          {/* OPTION A: AI SCAN RECIPES & INGREDIENTS */}
                          <div style={{ marginBottom: 16, padding: "12px 14px", background: "#FAF7F0", border: "1.5px dashed var(--gold)", borderRadius: 10 }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <Sparkles size={15} color="var(--gold)" />
                                <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text)" }}>Option A: Scan Recipe Sheet or Card (PDF / Photo)</span>
                              </div>
                              <span style={{ fontSize: 10, background: "#FFF3D6", color: "#8A6318", padding: "2px 6px", borderRadius: 4, fontWeight: 600 }}>2 Credits</span>
                            </div>
                            <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 10 }}>
                              Upload a photo of your recipe notebook, spec sheet, card, or PDF formula. AI will extract the recipe name and all ingredients with quantities.
                            </div>

                            {recipeAiScanRefund && (
                              <div style={{ padding: "7px 10px", background: "#E8F5E9", borderRadius: 7, fontSize: 11.5, color: "#2E7D32", marginBottom: 8, display: "flex", alignItems: "center", gap: 5 }}>
                                <Check size={12} /> {recipeAiScanRefund}
                              </div>
                            )}

                            {recipeAiScanError && (
                              <div style={{ padding: "7px 10px", background: "#FDEBE9", borderRadius: 7, fontSize: 11.5, color: "#B03A2E", marginBottom: 8, display: "flex", alignItems: "center", gap: 5 }}>
                                <AlertTriangle size={12} /> {recipeAiScanError}
                              </div>
                            )}

                            {!recipeAiFile ? (
                              <div>
                                <div
                                  onDragOver={e => e.preventDefault()}
                                  onDrop={e => {
                                    e.preventDefault()
                                    const file = e.dataTransfer.files?.[0]
                                    if (file) handleRecipeAiFileSelect({ target: { files: [file] } })
                                  }}
                                  onClick={() => recipeAiFileInputRef.current?.click()}
                                  style={{
                                    border: "1.5px dashed #D5C29D",
                                    borderRadius: 8,
                                    padding: "16px 12px",
                                    textAlign: "center",
                                    cursor: "pointer",
                                    background: "#FFFDF9",
                                    marginBottom: 10,
                                    transition: "border-color 0.2s"
                                  }}
                                >
                                  <UploadCloud size={24} color="var(--gold)" style={{ margin: "0 auto 4px" }} />
                                  <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)" }}>
                                    Click or drop recipe PDF or photo here
                                  </div>
                                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                                    Supports .pdf, .jpg, .png, .webp (recipe sheets, notebooks, spec cards)
                                  </div>
                                </div>

                                <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                                  <Btn small variant="outline" onClick={() => recipeAiFileInputRef.current?.click()} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                                    <UploadCloud size={13} /> Select PDF or Photo
                                  </Btn>
                                  <Btn small variant="outline" onClick={() => recipeAiCameraInputRef.current?.click()} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                                    <Camera size={13} /> Take photo
                                  </Btn>
                                </div>

                                <input ref={recipeAiFileInputRef} type="file" accept=".pdf,image/*,application/pdf" onChange={handleRecipeAiFileSelect} style={{ display: "none" }} />
                                <input ref={recipeAiCameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleRecipeAiFileSelect} style={{ display: "none" }} />
                              </div>
                            ) : (
                              <div style={{ padding: 12, background: "#FFFFFF", borderRadius: 8, border: "1px solid var(--border)" }}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    {recipeAiFile.type === "image" ? (
                                      <img src={recipeAiFile.rawBase64} alt="Recipe Preview" style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 6 }} />
                                    ) : (
                                      <FileText size={30} color="var(--gold)" />
                                    )}
                                    <div>
                                      <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)" }}>{recipeAiFile.name}</div>
                                      <div style={{ fontSize: 11, color: "var(--muted)" }}>{recipeAiFile.size} • {recipeAiFile.type.toUpperCase()}</div>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => { setRecipeAiFile(null); setRecipeAiScanError(""); setRecipeAiScanRefund(""); }}
                                    style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", padding: 4 }}
                                    title="Remove file"
                                  >
                                    <X size={16} />
                                  </button>
                                </div>

                                <Btn
                                  onClick={scanAiRecipes}
                                  disabled={recipeAiScanning}
                                  style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                                >
                                  {recipeAiScanning ? (
                                    <>
                                      <RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} /> Scanning & Extracting Recipe...
                                    </>
                                  ) : (
                                    <>
                                      <Sparkles size={14} /> Scan & Extract Recipe & Ingredients (2 Credits)
                                    </>
                                  )}
                                </Btn>
                              </div>
                            )}
                          </div>

                          {/* OPTION B: PASTE COLUMNS FROM EXCEL (ONLY INGREDIENT & QUANTITY) */}
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                              <FileSpreadsheet size={15} color="var(--muted)" />
                              <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text)" }}>Option B: Paste Ingredient Columns from Excel</span>
                            </div>
                            <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 10, lineHeight: 1.7 }}>
                              Paste the ingredient names and quantities from your recipe sheet.
                            </div>

                            {recipeImportMsg && (
                              <div style={{ padding: "7px 12px", background: "#FDEBE9", borderRadius: 7, fontSize: 12, color: "#B03A2E", marginBottom: 10, display: "flex", alignItems: "center", gap: 5 }}>
                                <AlertTriangle size={12} /> {recipeImportMsg}
                              </div>
                            )}

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                              <div>
                                <label style={{ fontSize: 10, color: "var(--muted)", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: .8, fontWeight: 500 }}>
                                  Ingredient Names *
                                </label>
                                <textarea
                                  value={pasteRecipeIngN}
                                  onChange={e => { setPasteRecipeIngN(e.target.value); setRecipeImportMsg(""); }}
                                  placeholder={"Flour\nSugar\nEggs\nButter\nCocoa Powder"}
                                  style={{ width: "100%", minHeight: 120, padding: "8px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--panel)", fontSize: 12, fontFamily: "monospace", color: "var(--text)", boxSizing: "border-box", resize: "vertical", outline: "none" }}
                                />
                              </div>
                              <div>
                                <label style={{ fontSize: 10, color: "var(--gold)", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: .8, fontWeight: 500 }}>
                                  Quantity *
                                </label>
                                <textarea
                                  value={pasteRecipeIngQ}
                                  onChange={e => { setPasteRecipeIngQ(e.target.value); setRecipeImportMsg(""); }}
                                  placeholder={"500\n250\n4\n200\n50"}
                                  style={{ width: "100%", minHeight: 120, padding: "8px", borderRadius: 8, border: "1px solid #E8D5A3", background: "#FFF9EE", fontSize: 12, fontFamily: "monospace", color: "var(--text)", boxSizing: "border-box", resize: "vertical", outline: "none" }}
                                />
                                <div style={{ fontSize: 9.5, color: "var(--muted)", marginTop: 3 }}>Numbers (e.g. 500, 2.5)</div>
                              </div>
                            </div>

                            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
                              <Btn onClick={doRecipePreview} disabled={!recipeImportName.trim() || !pasteRecipeIngN.trim() || !pasteRecipeIngQ.trim()}>
                                Preview import →
                              </Btn>
                              <Btn variant="ghost" onClick={() => { setShowRecipeImport(false); setRecipeAiFile(null); setRecipeAiScanError(""); setRecipeAiScanRefund(""); }}>
                                Cancel
                              </Btn>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })()}

                {recipeImportStep === 2 && (() => {
                  const activeIngs = recipeImportIngs.filter(p => p.on)
                  const estimatedCost = activeIngs.reduce((sum, ing) => {
                    let costPerUnit = 0
                    if (ing.iid !== "new") {
                      const it = inventory.find(x => x.id === ing.iid)
                      if (it) costPerUnit = it.cost || 0
                    }
                    return sum + (costPerUnit * (parseFloat(ing.qty) || 0))
                  }, 0)

                  return (
                    <div>
                      {/* Recipe Name Header */}
                      <div style={{ background: "#FAF7F0", padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border)", marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8, color: "var(--muted)", fontWeight: 500 }}>Importing Into Recipe</div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>{recipeImportName}</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 11, color: "var(--muted)" }}>Estimated Layer Cost</div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--gold)" }}>{fmt(estimatedCost)} / layer</div>
                        </div>
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <div style={{ fontSize: 12.5, color: "var(--muted)" }}>
                          Review ingredients & quantities. Match with your inventory or auto-create new items.
                        </div>
                        <Badge color="gold">{activeIngs.length} of {recipeImportIngs.length} active</Badge>
                      </div>

                      {recipeImportMsg && (
                        <div style={{ padding: "7px 12px", background: "#FDEBE9", borderRadius: 7, fontSize: 12, color: "#B03A2E", marginBottom: 10, display: "flex", alignItems: "center", gap: 5 }}>
                          <AlertTriangle size={12} /> {recipeImportMsg}
                        </div>
                      )}

                      <div style={{ overflowY: "auto", maxHeight: 220, marginBottom: 10 }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                          <thead>
                            <tr style={{ background: "#EDE5D6" }}>
                              {["", "Ingredient", "Quantity", "Unit", "Link to Inventory", "Est. Cost"].map(h => (
                                <th key={h} style={{ padding: "7px 10px", textAlign: h === "Est. Cost" || h === "Quantity" ? "right" : "left", fontSize: 10, textTransform: "uppercase", letterSpacing: .8, color: "var(--muted)", fontWeight: 500 }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {recipeImportIngs.map((p, i) => {
                              const matchedItem = p.iid !== "new" ? inventory.find(x => x.id === p.iid) : null
                              const rowCost = matchedItem ? (matchedItem.cost * (parseFloat(p.qty) || 0)) : 0
                              return (
                                <tr key={p.id} style={{ background: i % 2 === 0 ? "var(--panel)" : "#F8F3EA", opacity: p.on ? 1 : 0.35 }}>
                                  <td style={{ padding: "6px 8px", width: 40 }}>
                                    <div onClick={() => setRecipeImportIngs(prev => prev.map((x, j) => j === i ? { ...x, on: !x.on } : x))} style={{ width: 28, height: 16, borderRadius: 8, background: p.on ? "#357A52" : "var(--border)", cursor: "pointer", position: "relative" }}>
                                      <div style={{ width: 12, height: 12, borderRadius: "50%", background: "white", position: "absolute", top: 2, left: p.on ? 14 : 2, transition: "left 0.2s" }} />
                                    </div>
                                  </td>
                                  <td style={{ padding: "6px 8px", fontWeight: 500 }}>{p.name}</td>
                                  <td style={{ padding: "6px 8px", width: 80, textAlign: "right" }}>
                                    <input
                                      type="number"
                                      value={p.qty}
                                      onChange={e => {
                                        const val = e.target.value
                                        setRecipeImportIngs(prev => prev.map((x, j) => j === i ? { ...x, qty: val } : x))
                                      }}
                                      style={{ ...iSt, width: "100%", padding: "3px 6px", fontSize: 12, textAlign: "right" }}
                                    />
                                  </td>
                                  <td style={{ padding: "6px 8px", color: "var(--muted)", width: 50 }}>{p.unit}</td>
                                  <td style={{ padding: "6px 8px" }}>
                                    <select
                                      value={p.iid}
                                      onChange={e => {
                                        const selectedVal = e.target.value
                                        const match = inventory.find(it => it.id === selectedVal)
                                        setRecipeImportIngs(prev => prev.map((x, j) => j === i ? {
                                          ...x,
                                          iid: selectedVal,
                                          unit: match ? match.unit : x.unit
                                        } : x))
                                      }}
                                      style={{ ...iSt, width: "100%", fontSize: 11.5, padding: "4px 6px" }}
                                    >
                                      <option value="new">+ Add as New Inventory Item ("{p.name}")</option>
                                      {inventory.map(inv => (
                                        <option key={inv.id} value={inv.id}>
                                          {inv.name} ({inv.unit}) — {fmt(inv.cost)}/{inv.unit}
                                        </option>
                                      ))}
                                    </select>
                                  </td>
                                  <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 500, color: rowCost > 0 ? "var(--gold)" : "var(--muted)" }}>
                                    {rowCost > 0 ? fmt(rowCost) : "—"}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* QUICK ADD FROM INVENTORY ROW */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                        <select
                          onChange={e => {
                            const selectedId = e.target.value
                            if (!selectedId) return
                            const item = inventory.find(it => it.id === selectedId)
                            if (item) {
                              setRecipeImportIngs(prev => [
                                ...prev,
                                {
                                  id: uid(),
                                  name: item.name,
                                  qty: 1,
                                  unit: item.unit,
                                  iid: item.id,
                                  on: true
                                }
                              ])
                            }
                            e.target.value = ""
                          }}
                          style={{ ...iSt, fontSize: 11.5, padding: "5px 8px" }}
                          defaultValue=""
                        >
                          <option value="" disabled>+ Add an ingredient from inventory...</option>
                          {inventory.map(inv => (
                            <option key={inv.id} value={inv.id}>
                              {inv.name} ({inv.unit}) — {fmt(inv.cost)}/{inv.unit}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                        <Btn variant="success" onClick={confirmRecipeImport} disabled={!activeIngs.length} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                          <Check size={13} /> Import Recipe ({activeIngs.length} Ingredients)
                        </Btn>
                        <Btn variant="ghost" onClick={() => setRecipeImportStep(1)}>← Edit</Btn>
                      </div>
                    </div>
                  )
                })()}

                {recipeImportStep === 3 && (
                  <div style={{ textAlign: "center", padding: "16px 0" }}>
                    <div style={{ fontSize: 16, color: "#357A52", fontWeight: 600, marginBottom: 6, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                      <Check size={18} /> Recipe imported successfully!
                    </div>
                    <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 6 }}>
                      <strong>"{recipeImportName}"</strong> was saved with {recipeImportIngs.filter(i => i.on).length} ingredients.
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 16 }}>
                      Any new ingredients were automatically registered in your inventory list.
                    </div>
                    <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                      <Btn onClick={() => { setRecipeImportStep(1); setShowRecipeImport(false); }}>Done</Btn>
                      <Btn variant="outline" onClick={() => openRecipeImport(null)}>Import Another Recipe</Btn>
                    </div>
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

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, marginTop: 12 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>Ingredients</div>
                  <Btn small variant="outline" onClick={() => openRecipeImport(recipeModal)} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11 }}>
                    <UploadCloud size={12} /> Import Ingredients (Excel/PDF/Photo)
                  </Btn>
                </div>
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
