/**
 * ReceiptScanner.jsx
 * ----------------------------------------------------------------------------
 * AI receipt scanner + manual purchase entry.
 * Photograph a receipt or enter details manually, review/edit items,
 * and save to update stock levels, costs, and expenses.
 * ----------------------------------------------------------------------------
 */
import React, { useState, useEffect, useRef } from "react"
import { Btn, iSt, Inp, Sel, Card, Badge, SHead, Modal } from "../common/ui.jsx"
import { fmt, uid, today, callClaude, compressImage } from "../../lib/helpers.js"
import { saveInventory, saveExpenses, savePurchases, saveLocal, loadLocal, loadAliases, saveAliases } from "../../lib/data.js"
import { EXP_CATS } from "../../constants.js"
import { Camera, Upload, PenLine, Sparkles, AlertTriangle, Check } from "lucide-react"

// Normalizes various date string formats (DD/MM/YYYY, YYYY/MM/DD, natural text) to ISO YYYY-MM-DD
export function normalizeToIsoDate(inputDate) {
  if (!inputDate || typeof inputDate !== "string") return today()
  const trimmed = inputDate.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed

  // DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`
  }

  // YYYY/MM/DD
  const ymdMatch = trimmed.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/)
  if (ymdMatch) {
    const [, y, m, d] = ymdMatch
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`
  }

  // General Date parsing fallback
  try {
    const d = new Date(trimmed)
    if (!isNaN(d.getTime())) {
      return d.toISOString().slice(0, 10)
    }
  } catch {}

  return today()
}

// Helper to extract and repair common LLM JSON syntax flaws (trailing commas, unquoted keys, comments, truncated outputs)
export function extractAndRepairJson(rawText) {
  if (!rawText) return null
  let str = rawText.trim()
  str = str.replace(/```json|```/g, "").trim()

  const jsonMatch = str.match(/\{[\s\S]*\}/) || str.match(/\[[\s\S]*\]/)
  if (jsonMatch) {
    str = jsonMatch[0]
  }

  // Attempt 1: Direct JSON parse
  try {
    const res = JSON.parse(str)
    return Array.isArray(res) ? { items: res } : res
  } catch {
    // Attempt 2: Strip comments and trailing commas
    try {
      let cleaned = str
        .replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "")
        .replace(/,\s*([\]\}])/g, "$1")
      const res = JSON.parse(cleaned)
      return Array.isArray(res) ? { items: res } : res
    } catch {
      // Attempt 3: Quote unquoted keys
      try {
        let cleaned = str
          .replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "")
          .replace(/,\s*([\]\}])/g, "$1")
          .replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":')
        const res = JSON.parse(cleaned)
        return Array.isArray(res) ? { items: res } : res
      } catch {
        // Attempt 4: Partial / Truncated JSON recovery
        try {
          if (str.includes('"items"') && !str.endsWith('}')) {
            const lastObjIdx = str.lastIndexOf('}')
            if (lastObjIdx !== -1) {
              let rescued = str.slice(0, lastObjIdx + 1)
              if (!rescued.includes(']')) rescued += ']'
              if (!rescued.endsWith('}')) rescued += '}'
              let cleaned = rescued
                .replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "")
                .replace(/,\s*([\]\}])/g, "$1")
              const res = JSON.parse(cleaned)
              return Array.isArray(res) ? { items: res } : res
            }
          }
        } catch {}

        // Attempt 5: Fallback regex extraction of individual item objects
        try {
          const itemRegex = /\{[^{}]*?"item_on_receipt"[^{}]*?\}/g
          const matches = str.match(itemRegex)
          if (matches && matches.length > 0) {
            const rescuedItems = []
            for (const m of matches) {
              try {
                const item = JSON.parse(m.replace(/,\s*([\]\}])/g, "$1"))
                if (item) rescuedItems.push(item)
              } catch {}
            }
            if (rescuedItems.length > 0) {
              return { items: rescuedItems }
            }
          }
        } catch {}

        return null
      }
    }
  }
}

function normalizeItem(r) {
  if (!r) return { item_on_receipt: "", qty: 1, unit: "kg", unit_size: 1, unit_price: 0, line_total: 0, type: "purchase", overrideId: "", category: "Miscellaneous", approved: true, confidence: "high" }
  if (typeof r === "string") {
    return { item_on_receipt: r, qty: 1, unit: "kg", unit_size: 1, unit_price: 0, line_total: 0, type: "purchase", overrideId: "", category: "Miscellaneous", approved: true, confidence: "high" }
  }
  const qty = Number(r.qty || r.quantity || 1) || 1
  const price = Number(r.unit_price || r.price || r.cost || 0) || 0
  const total = Number(r.line_total || r.total || (qty * price) || 0) || 0

  return {
    item_on_receipt: String(r.item_on_receipt || r.name || r.item || r.description || ""),
    qty,
    unit: String(r.unit || "kg"),
    unit_size: Number(r.unit_size || r.size || 1) || 1,
    unit_price: price,
    line_total: total,
    type: r.type === "expense" ? "expense" : "purchase",
    overrideId: String(r.matched_id || r.overrideId || ""),
    category: String(r.category || r.matched_name || "Miscellaneous"),
    approved: r.approved !== undefined ? Boolean(r.approved) : r.confidence !== "low",
    confidence: String(r.confidence || "high")
  }
}

export function ReceiptScanner({ inventory, setInventory, expenses, setExpenses }) {
  const [photo, setPhoto] = useState(null)
  const [photoB64, setPhotoB64] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [saved, setSaved] = useState(false)
  const [savedMonth, setSavedMonth] = useState("")
  const [parsed, setParsed] = useState(null) // { supplier, receipt_date, items: [...] }
  const [totalAmount, setTotalAmount] = useState("")
  const [saving, setSaving] = useState(false)
  const fileRef = useRef()

  const [aliases, setAliases] = useState({})

  useEffect(() => {
    const loaded = loadAliases({})
    if (loaded) setAliases(loaded)
  }, [])

  // State for creating a new inventory item directly from the review step
  const [addingNewItemForIdx, setAddingNewItemForIdx] = useState(null)
  const [calcMode, setCalcMode] = useState("manual") // "manual" or "auto"
  const [newFields, setNewFields] = useState({ name: "", cat: "Dry Goods", unit: "kg", cost: "", stock: "", minStock: "5", totalPaid: "", qtyBought: "" })

  const handleFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setPhoto(URL.createObjectURL(file))
    const r = new FileReader()
    r.onload = (ev) => setPhotoB64(ev.target.result.split(",")[1])
    r.readAsDataURL(file)
    setParsed(null)
    setSaved(false)
    setError("")
  }

  // Scan receipt or photo with Claude
  const scan = async () => {
    if (!photoB64) return
    setLoading(true)
    setError("")
    try {
      const compressed = await compressImage(photoB64, 1920, 0.88, { enhanceContrast: true })
      const invList = inventory.map(i => `${i.id}:${i.name}(${i.unit})`).join(", ")
      const promptText = `You are an expert AI scanner for a Nigerian bakery and cake business.
Analyze the provided image carefully. The image could be:
1. A printed paper receipt or invoice (supermarket receipt, wholesale distributor invoice, waybill).
2. A handwritten market slip, biro note, or vendor calculation on paper.
3. A bank transfer confirmation, POS receipt, or mobile banking screenshot (OPay, PalmPay, Moniepoint, etc.).
4. A photo of PHYSICAL INGREDIENTS or BAKERY SUPPLIES (e.g. bags/sacks of flour, sugar, butter blocks, egg crates, boxes, flavour bottles, cake boards, toppers).

YOUR GOAL: Extract EVERY single purchase item or overhead expense visible in this image.
CRITICAL: NEVER return an empty items list if any bakery supplies, ingredients, items, text, or products are visible in the image!

Inventory items already in the system to match against:
${invList}

Extraction Instructions:
1. RECEIPTS, INVOICES, & HANDWRITTEN SLIPS:
   - Extract every line item, quantity, unit, and price.
   - For unclear handwriting or local Nigerian brands (Dangote, Golden Penny, Simas, Presco, Dano, etc.), make your best informed estimate.
   - If unit_size is not clear, use qty as unit_size and set qty to 1.
   - If price is missing or unclear, set unit_price: 0 and line_total: 0.

2. BANK TRANSFER / POS SCREENSHOTS:
   - If it is a payment receipt or debit alert without individual line items, create one entry representing the payment:
     - item_on_receipt: "Payment to [Beneficiary or Merchant name if visible, else 'Supplier Payment']"
     - qty: 1, unit: "tx", unit_size: 1, unit_price: [amount paid], line_total: [amount paid]
     - type: "expense", category: "Miscellaneous"

3. PHOTOS OF PHYSICAL PRODUCTS / SUPPLIES:
   - Identify each distinct bakery item visible (e.g. "Flour", "Margarine", "Eggs", "Cake Box").
   - Count or estimate the quantity visible (e.g. number of bags/boxes visible, or default to 1).
   - Set unit_price: 0 and line_total: 0 so the baker can confirm the cost paid.
   - Match against the inventory list if possible.

Classification:
- "purchase": Baking ingredients, packaging materials, or supplies (flour, sugar, butter, eggs, oil, cocoa, milk, food colour, cake boards, boxes, ribbons, decorations, etc.).
- "expense": Overhead costs (delivery/transport fee, electricity, diesel/fuel, salary, cleaning, maintenance, market levy, etc.).

Return ONLY valid JSON with this exact structure, no preamble:
{
  "items": [
    {
      "item_on_receipt": "Flour",
      "qty": 2,
      "unit": "kg",
      "unit_size": 50,
      "unit_price": 57000,
      "line_total": 114000,
      "type": "purchase",
      "matched_id": "matched inventory id or empty string",
      "matched_name": "Matched inventory name or empty string",
      "confidence": "high"
    }
  ],
  "receipt_total": 114000,
  "receipt_date": "YYYY-MM-DD",
  "supplier": "Vendor or shop name if visible, else empty",
  "scan_notes": "One short sentence summarizing what was detected"
}`

      const raw = await callClaude([
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: "image/jpeg", data: compressed } },
            { type: "text", text: promptText }
          ]
        }
      ], "You are an expert vision AI for Nigerian bakery operations. Extract all purchased items, ingredients, supplies, or expenses from any receipt, handwritten slip, payment screenshot, or photo of physical stock. Always return valid JSON only.", 4000)

      const result = extractAndRepairJson(raw)
      const rawItems = result && (
        Array.isArray(result.items) ? result.items :
          Array.isArray(result.purchases) ? result.purchases :
            Array.isArray(result.data) ? result.data :
              Array.isArray(result.receipt_items) ? result.receipt_items : null
      )

      if (!result || !rawItems || rawItems.length === 0) {
        const notes = result?.scan_notes || "Could not clearly detect any items, ingredients, or text in this image. Please ensure the receipt or items are well lit and in focus."
        setError(notes)
        setParsed({
          supplier: result?.supplier || "",
          receipt_date: normalizeToIsoDate(result?.receipt_date),
          scan_notes: notes,
          items: [
            { item_on_receipt: "", qty: 1, unit: "kg", unit_size: 1, unit_price: 0, line_total: 0, type: "purchase", overrideId: "", approved: true, confidence: "high" }
          ]
        })
        setTotalAmount("")
      } else {
        const normalizedItems = rawItems.map(normalizeItem)
        // Auto-match items against aliases and inventory if matched_id is empty
        const matchedItems = normalizedItems.map(item => {
          if (!item.overrideId && item.type === "purchase") {
            const key = (item.item_on_receipt || "").trim().toLowerCase()
            if (aliases[key] && inventory.some(i => i.id === aliases[key])) {
              return { ...item, overrideId: aliases[key] }
            }
            const directMatch = inventory.find(i => i.name.toLowerCase() === key) ||
              inventory.find(i => key.includes(i.name.toLowerCase()) || i.name.toLowerCase().includes(key))
            if (directMatch) {
              return { ...item, overrideId: directMatch.id }
            }
          }
          return item
        })

        setParsed({
          supplier: result.supplier || "",
          receipt_date: normalizeToIsoDate(result.receipt_date),
          ...result,
          items: matchedItems
        })
        if (result.receipt_total) setTotalAmount(String(result.receipt_total))
      }
    } catch (err) {
      setError(`Could not read receipt: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  // Trigger Manual Entry mode
  const startManualEntry = () => {
    setParsed({
      supplier: "",
      receipt_date: today(),
      items: [
        { item_on_receipt: "", qty: 1, unit: "kg", unit_size: 1, unit_price: 0, line_total: 0, type: "purchase", overrideId: "", approved: true, confidence: "high" }
      ]
    })
    setTotalAmount("")
    setSaved(false)
    setPhoto(null)
    setPhotoB64(null)
    setError("")
  }

  // Reparse raw text manually edited by user

  // Edit list helper
  const updateRow = (idx, field, val) => {
    setParsed(p => ({
      ...p,
      items: p.items.map((r, i) => {
        if (i !== idx) return r
        const updatedRow = { ...r, [field]: val }

        if (field === "type") {
          if (val === "expense") {
            updatedRow.overrideId = ""
            updatedRow.category = "Miscellaneous"
          } else {
            updatedRow.category = ""
          }
        }

        if (field === "item_on_receipt") {
          const key = (val || "").trim().toLowerCase()
          const matchedId = aliases[key]
          const isValidIng = matchedId && inventory.some(item => item.id === matchedId)
          if (isValidIng) {
            updatedRow.overrideId = matchedId
          }
        }

        // Auto-calculate line total if qty or price changes
        if (field === "qty" || field === "unit_price") {
          const qty = Number(field === "qty" ? val : r.qty) || 0
          const price = Number(field === "unit_price" ? val : r.unit_price) || 0
          updatedRow.line_total = parseFloat((qty * price).toFixed(2))
        }
        return updatedRow
      })
    }))
  }

  const addBlankRow = () => {
    setParsed(p => ({
      ...p,
      items: [
        ...p.items,
        { item_on_receipt: "", qty: 1, unit: "kg", unit_size: 1, unit_price: 0, line_total: 0, type: "purchase", overrideId: "", approved: true, confidence: "high" }
      ]
    }))
  }

  const deleteRow = (idx) => {
    setParsed(p => ({
      ...p,
      items: p.items.filter((_, i) => i !== idx)
    }))
  }

  const toggleApprove = idx => setParsed(p => ({ ...p, items: p.items.map((r, i) => i === idx ? { ...r, approved: !r.approved } : r) }))
  const setMatch = (idx, id) => {
    setParsed(p => ({
      ...p,
      items: p.items.map((r, i) => {
        if (i !== idx) return r
        const key = (r.item_on_receipt || "").trim().toLowerCase()
        if (key && id) {
          setAliases(prev => ({ ...prev, [key]: id }))
        }
        return { ...r, overrideId: id, approved: true }
      })
    }))
  }

  // Save the receipt to stock + expenses
  const applyUpdates = async () => {
    setSaving(true)
    try {
      const receiptDate = normalizeToIsoDate(parsed.receipt_date)
      const monthStr = receiptDate.slice(0, 7)
      const approved = parsed.items.filter(r => r.approved)
      const purchases = approved.filter(r => r.type === "purchase")

      // Update inventory: stock + cost/unit for purchases
      let updInv = [...inventory]
      const purchaseLog = []

      purchases.forEach(r => {
        let invItem = updInv.find(i => i.id === r.overrideId)
        const unitSize = +r.unit_size || +r.qty || 1
        const cpu = parseFloat((+r.unit_price / unitSize).toFixed(2))
        const stockAdded = parseFloat((unitSize * (+r.qty || 1)).toFixed(3))

        // If item not yet in inventory, auto-create it so it's not lost
        if (!invItem && (r.item_on_receipt || "").trim()) {
          const newId = uid()
          invItem = {
            id: newId,
            name: r.item_on_receipt.trim(),
            cat: "Dry Goods",
            unit: r.unit || "kg",
            cost: cpu || 0,
            stock: stockAdded,
            minStock: 5
          }
          updInv.push(invItem)
          r.overrideId = newId
        } else if (invItem) {
          updInv = updInv.map(i => i.id === r.overrideId ? { ...i, cost: cpu || i.cost, stock: parseFloat((i.stock + stockAdded).toFixed(3)) } : i)
        }

        if (invItem) {
          purchaseLog.push({
            id: uid(),
            date: receiptDate,
            itemId: invItem.id,
            item: invItem.name,
            unit: invItem.unit || r.unit || "kg",
            unitSize,
            qty: +r.qty || 1,
            price: +r.unit_price,
            total: +r.line_total || 0,
            cpu,
            stockAdded
          })
        }
      })

      if (purchases.length > 0) {
        setInventory(updInv)
        await saveInventory(updInv)
      }

      if (Object.keys(aliases).length > 0) {
        await saveAliases(aliases)
      }

      // Save purchase logs to database & local storage (via savePurchases which triggers sync & event)
      if (purchaseLog.length > 0) {
        const existing = loadLocal("ll_purchases", [])
        const allPurchases = [...purchaseLog, ...existing]
        if (typeof savePurchases === "function") {
          await savePurchases(allPurchases)
        } else {
          await saveLocal("ll_purchases", allPurchases)
        }
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("layerledger:purchases-updated", { detail: { purchases: allPurchases } }))
        }
      }

      // Log expense records grouped by category
      const totalCalc = parsed.items.reduce((s, r) => s + (r.approved ? (+r.line_total || 0) : 0), 0)
      const amt = +totalAmount || totalCalc
      if (amt > 0) {
        const categoriesMap = {}
        approved.forEach(r => {
          let cat = "Miscellaneous"
          let source = "receipt"
          if (r.type === "purchase") {
            cat = "Ingredients / Supplies"
            source = "purchase"
          } else {
            cat = r.category || "Miscellaneous"
            if (cat === "Ingredients" || cat === "Ingredients/Supplies") {
              cat = "Ingredients / Supplies"
            }
            source = "receipt"
          }
          const key = `${cat}::${source}`
          if (!categoriesMap[key]) {
            categoriesMap[key] = { cat, source, amount: 0, items: [] }
          }
          categoriesMap[key].amount += (+r.line_total || 0)
          categoriesMap[key].items.push(r.item_on_receipt || "Item")
        })

        const scaleFactor = totalCalc > 0 ? amt / totalCalc : 1
        const newExps = []

        Object.values(categoriesMap).forEach(data => {
          const scaledAmt = Math.round(data.amount * scaleFactor)
          if (scaledAmt > 0) {
            newExps.push({
              id: uid(),
              date: receiptDate,
              description: `${parsed.supplier || "Receipt"} — ${data.cat}`,
              amount: scaledAmt,
              category: data.cat,
              paymentMethod: "cash",
              source: data.source,
              notes: `Items: ${data.items.join(", ")}`
            })
          }
        })

        if (newExps.length > 0) {
          const updExp = [...newExps, ...expenses]
          setExpenses(updExp)
          await saveExpenses(updExp)
          alert(`Logged ${newExps.length} expense(s) to ${monthStr.slice(0, 7)}: ` + newExps.map(ne => `${ne.category} (source: ${ne.source}): ₦${ne.amount}`).join(', '));
        } else {
          alert("Info: No overhead expenses were logged from this receipt.");
        }
      }

      setSavedMonth(monthStr.slice(0, 7))
      setParsed(null)
      setPhoto(null)
      setPhotoB64(null)
      setSaved(true)
    } catch (e) {
      console.error(e)
      alert("Save failed: " + e.message)
    } finally {
      setSaving(false)
    }
  }

  // Prefill and open new item modal
  const openNewItemModal = (idx) => {
    const row = parsed.items[idx]
    const unitSize = Number(row.unit_size) || 1
    const costPerUnit = Number(row.unit_price) ? parseFloat((Number(row.unit_price) / unitSize).toFixed(2)) : ""
    const stockQty = parseFloat((unitSize * (Number(row.qty) || 1)).toFixed(3))

    setNewFields({
      name: row.item_on_receipt || "",
      cat: "Dry Goods",
      unit: row.unit || "kg",
      cost: String(costPerUnit),
      stock: String(stockQty),
      minStock: "5",
      totalPaid: String(row.line_total || ""),
      qtyBought: String(row.qty || "")
    })
    setCalcMode("manual")
    setAddingNewItemForIdx(idx)
  }

  // Save new item directly to inventory and auto-select in row
  const saveNewItemFromReceipt = async () => {
    let cost = newFields.cost
    if (calcMode === "auto") {
      const price = parseFloat(newFields.totalPaid)
      const qty = parseFloat(newFields.qtyBought)
      if (!newFields.totalPaid || !newFields.qtyBought || isNaN(price) || isNaN(qty) || qty <= 0) {
        alert("Total amount paid and quantity bought must be valid positive numbers.")
        return
      }
      cost = price / qty
    } else {
      cost = Number(cost)
    }
    if (!newFields.name.trim() || !cost) {
      alert("Name and cost per unit are required")
      return
    }

    const itemId = uid()
    const newItemObj = {
      id: itemId,
      name: newFields.name.trim(),
      cat: newFields.cat,
      unit: newFields.unit || "kg",
      cost: cost,
      stock: Number(newFields.stock || 0),
      minStock: Number(newFields.minStock || 5)
    }

    const updatedInv = [...inventory, newItemObj]
    setInventory(updatedInv)
    await saveInventory(updatedInv)

    // Set matched ID to newly created item
    setParsed(prev => ({
      ...prev,
      items: prev.items.map((r, i) => i === addingNewItemForIdx ? { ...r, overrideId: itemId, approved: true } : r)
    }))
    setCalcMode("manual")
    setAddingNewItemForIdx(null)
  }

  return (
    <div>
      <SHead title="Receipt Scanner & Purchases" sub="Scan paper receipts using AI or type items manually to update stock levels." />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 16, alignItems: "start" }}>

        {/* Left Side: Upload or Choose Method */}
        <Card>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 15, fontWeight: 600, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
            <Camera size={16} /> Stock Purchase Input
          </div>

          {!photo && !parsed && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <button
                  onClick={async () => {
                    try {
                      const stream = await navigator.mediaDevices.getUserMedia({
                        video: {
                          facingMode: "environment",
                          width: { ideal: 1920, max: 3840 },
                          height: { ideal: 1080, max: 2160 }
                        }
                      })
                      const video = document.createElement("video")
                      video.srcObject = stream
                      video.autoplay = true
                      const overlay = document.createElement("div")
                      overlay.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:#000;z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px"
                      video.style.cssText = "max-width:100%;max-height:70vh;border-radius:10px"
                      const btn = document.createElement("button")
                      btn.textContent = "Capture"
                      btn.style.cssText = "padding:14px 32px;border-radius:10px;border:none;background:var(--gold);color:#fff;font-size:16px;cursor:pointer"
                      const close = document.createElement("button")
                      close.textContent = "Cancel"
                      close.style.cssText = "padding:10px 24px;border-radius:10px;border:none;background:#555;color:#fff;font-size:14px;cursor:pointer"
                      overlay.appendChild(video)
                      overlay.appendChild(btn)
                      overlay.appendChild(close)
                      document.body.appendChild(overlay)
                      btn.onclick = () => {
                        const canvas = document.createElement("canvas")
                        canvas.width = video.videoWidth
                        canvas.height = video.videoHeight
                        canvas.getContext("2d").drawImage(video, 0, 0)
                        stream.getTracks().forEach(t => t.stop())
                        document.body.removeChild(overlay)
                        const dataUrl = canvas.toDataURL("image/jpeg", 0.9)
                        const b64 = dataUrl.split(",")[1]
                        handleFile({ target: { files: [new File([Uint8Array.from(atob(b64), c => c.charCodeAt(0))], "capture.jpg", { type: "image/jpeg" })] } })
                      }
                      close.onclick = () => { stream.getTracks().forEach(t => t.stop()); document.body.removeChild(overlay) }
                    } catch (e) {
                      const inp = document.createElement("input")
                      inp.type = "file"
                      inp.accept = "image/*"
                      inp.capture = "environment"
                      inp.onchange = e => handleFile({ target: inp })
                      inp.click()
                    }
                  }}
                  style={{ padding: "14px 8px", borderRadius: 10, border: "2px dashed var(--border)", background: "#FAF7F0", cursor: "pointer", textAlign: "center" }}
                >
                  <div style={{ display: "flex", justifyContent: "center", marginBottom: 4, color: "var(--gold)" }}>
                    <Camera size={26} />
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--muted)", fontWeight: 500 }}>Open camera</div>
                </button>
                <button
                  onClick={() => fileRef.current?.click()}
                  style={{ padding: "14px 8px", borderRadius: 10, border: "2px dashed var(--border)", background: "#FAF7F0", cursor: "pointer", textAlign: "center" }}
                >
                  <div style={{ display: "flex", justifyContent: "center", marginBottom: 4, color: "var(--gold)" }}>
                    <Upload size={26} />
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--muted)", fontWeight: 500 }}>Upload photo</div>
                </button>
              </div>

              <button
                onClick={startManualEntry}
                style={{ padding: "12px 14px", borderRadius: 10, border: "2px dashed var(--gold)", background: "#FDFAF4", cursor: "pointer", textAlign: "center", color: "var(--gold)", fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
              >
                <PenLine size={14} /> Enter Manually (Type Purchases)
              </button>
            </div>
          )}

          {photo && (
            <div onClick={() => fileRef.current?.click()} style={{ border: "2px dashed var(--border)", borderRadius: 10, padding: 4, textAlign: "center", cursor: "pointer", background: "#FAF7F0", marginBottom: 12, display: "flex", alignItems: "center", justifyItems: "center", justifyContent: "center" }}>
              <img src={photo} alt="receipt" style={{ maxHeight: 260, maxWidth: "100%", borderRadius: 8 }} />
            </div>
          )}

          <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} />

          {photo && !parsed && !saved && (
            <>
              <Btn full onClick={scan} disabled={loading} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                {loading ? "AI is reading the receipt…" : <><Sparkles size={14} /> Scan & Extract Items <span style={{ fontSize: 11, opacity: 0.85, fontWeight: 500 }}>(0.7 tokens)</span></>}
              </Btn>
              {loading && <div style={{ fontSize: 12, color: "var(--muted)", textAlign: "center", marginTop: 8 }}>This may take 15-30 seconds…</div>}
              {error && (
                <div style={{ marginTop: 10, padding: "8px 12px", background: error.toLowerCase().includes("token") ? "#FFF4E5" : "#FDEBE9", border: error.toLowerCase().includes("token") ? "1px solid #FFE0B2" : "1px solid #FCDAD7", borderRadius: 8, fontSize: 12.5, color: error.toLowerCase().includes("token") ? "#92400E" : "#B03A2E", lineHeight: 1.5, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <AlertTriangle size={14} color={error.toLowerCase().includes("token") ? "#D97706" : "#B03A2E"} style={{ flexShrink: 0 }} />
                    <span>{error}</span>
                  </div>
                  {error.toLowerCase().includes("token") && (
                    <button
                      type="button"
                      onClick={() => {
                        if (typeof window !== "undefined") {
                          window.dispatchEvent(new CustomEvent("bakewealth:insufficient-tokens", { detail: { requiredTokens: 0.7 } }))
                          window.dispatchEvent(new CustomEvent("layerledger:insufficient-tokens", { detail: { requiredTokens: 0.7 } }))
                        }
                      }}
                      style={{ background: "var(--gold)", color: "#fff", border: "none", borderRadius: 6, padding: "3px 8px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
                    >
                      Buy Tokens
                    </button>
                  )}
                </div>
              )}
            </>
          )}

          {saved && (
            <div style={{ background: "#EEF8F3", borderRadius: 8, padding: 12, border: "1px solid #C2E0CF", marginBottom: 12 }}>
              <div style={{ fontWeight: 600, color: "#357A52", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                <Check size={14} /> Done! Purchases updated inventory and expenses logged to the {savedMonth} ledger.
              </div>
              <Btn small variant="outline" onClick={() => setSaved(false)}>Log Another</Btn>
            </div>
          )}

          {!photo && !parsed && (
            <div style={{ marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 13.5, fontWeight: 600, marginBottom: 8 }}>How It Works</div>
              {[
                [<Camera size={14} color="var(--gold)" />, "Supermarket receipts or market logs work. Lay flat in bright light."],
                [<PenLine size={14} color="var(--gold)" />, "Or tap manual entry to type list rows directly."],
                [<Check size={14} color="#357A52" />, "Review extracted lines, link to ingredients, and check cost levels."]
              ].map(([icon, text], idx) => (
                <div key={idx} style={{ display: "flex", gap: 10, marginBottom: 10, alignItems: "flex-start" }}>
                  <span style={{ marginTop: 2, flexShrink: 0 }}>{icon}</span>
                  <span style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.5 }}>{text}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Right Side: Review & Match Extracted Items */}
        {parsed && (
          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, fontWeight: 600 }}>Review & Match Items</div>
              <div style={{ display: "flex", gap: 8 }}>
                <Btn small variant="ghost" onClick={addBlankRow}>+ Add Row</Btn>
              </div>
            </div>

            {/* Receipt Metadata */}
            {parsed.scan_notes && (
              <div style={{ background: "rgba(200,145,42,0.08)", border: "1px solid rgba(200,145,42,0.25)", borderRadius: 8, padding: "8px 12px", marginBottom: 12, fontSize: 12.5, color: "var(--text)", display: "flex", alignItems: "center", gap: 6 }}>
                <Sparkles size={14} color="var(--gold)" style={{ flexShrink: 0 }} />
                <span>{parsed.scan_notes}</span>
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
              <Inp label="Supplier / Shop" value={parsed.supplier || ""} onChange={v => setParsed({ ...parsed, supplier: v })} placeholder="e.g. Market vendor" />
              <Inp label="Purchase Date" type="date" value={parsed.receipt_date || ""} onChange={v => setParsed({ ...parsed, receipt_date: v })} />
            </div>

            {/* Items List */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
              {parsed.items.map((r, idx) => (
                <div key={idx} style={{ background: "#FAF7F0", border: "1px solid var(--border)", borderRadius: 8, padding: 12, opacity: r.approved ? 1 : 0.45 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <div style={{ flex: 1 }}>
                      <input
                        value={r.item_on_receipt || ""}
                        onChange={e => updateRow(idx, "item_on_receipt", e.target.value)}
                        placeholder="Item name..."
                        style={{ ...iSt, padding: "5px 8px", fontSize: 13, fontWeight: 600, width: "90%" }}
                      />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                      <div onClick={() => toggleApprove(idx)} style={{ width: 32, height: 18, borderRadius: 9, background: r.approved ? "#357A52" : "var(--border)", cursor: "pointer", position: "relative", flexShrink: 0 }}>
                        <div style={{ width: 14, height: 14, borderRadius: "50%", background: "white", position: "absolute", top: 2, left: r.approved ? 16 : 2, transition: "left 0.2s" }} />
                      </div>
                      <Btn small variant="danger" onClick={() => deleteRow(idx)}>×</Btn>
                    </div>
                  </div>

                  {/* Quantity & Cost input row */}
                  {r.approved && (
                    <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr 1fr 1fr", gap: 6, marginBottom: 6 }}>
                      <div>
                        <label style={{ fontSize: 9.5, color: "var(--muted)" }}>Qty bought</label>
                        <input type="number" value={r.qty || ""} onChange={e => updateRow(idx, "qty", e.target.value)} style={{ ...iSt, padding: "4px 6px", fontSize: 12 }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 9.5, color: "var(--muted)" }}>Unit</label>
                        <input value={r.unit || ""} onChange={e => updateRow(idx, "unit", e.target.value)} style={{ ...iSt, padding: "4px 6px", fontSize: 12 }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 9.5, color: "var(--muted)" }}>Pack/Unit size</label>
                        <input type="number" value={r.unit_size || ""} onChange={e => updateRow(idx, "unit_size", e.target.value)} style={{ ...iSt, padding: "4px 6px", fontSize: 12 }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 9.5, color: "var(--muted)" }}>Cost (₦)</label>
                        <input type="number" value={r.unit_price || ""} onChange={e => updateRow(idx, "unit_price", e.target.value)} style={{ ...iSt, padding: "4px 6px", fontSize: 12 }} />
                      </div>
                    </div>
                  )}

                  {/* Linking / Add New item dropdown */}
                  {r.approved && (
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6, flexWrap: "wrap" }}>
                      {/* Selection: Link to Inventory vs Link to Expense */}
                      <select
                        value={r.type || "purchase"}
                        onChange={e => updateRow(idx, "type", e.target.value)}
                        style={{ ...iSt, fontSize: 12, padding: "5px 8px", width: 150 }}
                      >
                        <option value="purchase"> Link to Inventory</option>
                        <option value="expense"> Link to Expense</option>
                      </select>

                      {/* Render based on selection */}
                      {r.type === "purchase" ? (
                        <div style={{ display: "flex", gap: 6, alignItems: "center", flex: 1 }}>
                          <select
                            value={r.overrideId || ""}
                            onChange={e => setMatch(idx, e.target.value)}
                            style={{ ...iSt, fontSize: 12, padding: "5px 8px", flex: 1 }}
                          >
                            <option value="">— Link to ingredient —</option>
                            {inventory.map(i => (
                              <option key={i.id} value={i.id}>{i.name} ({i.unit}) | stock: {i.stock}</option>
                            ))}
                          </select>
                          {!r.overrideId && (
                            <Btn small variant="outline" onClick={() => openNewItemModal(idx)}>+ Add As New</Btn>
                          )}
                        </div>
                      ) : (
                        <div style={{ display: "flex", gap: 6, alignItems: "center", flex: 1 }}>
                          <select
                            value={r.category || ""}
                            onChange={e => updateRow(idx, "category", e.target.value)}
                            style={{ ...iSt, fontSize: 12, padding: "5px 8px", flex: 1 }}
                          >
                            <option value="">— Select expense category —</option>
                            {EXP_CATS.map(c => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <Inp label="Total Invoice Cost (₦)" type="number" value={totalAmount} onChange={setTotalAmount} placeholder="Total amount paid" />

            <div style={{ display: "flex", gap: 8, marginTop: 14, justifyContent: "flex-end" }}>
              <Btn variant="success" onClick={applyUpdates} disabled={saving || !parsed.items.some(r => r.approved)} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                {saving ? "Saving..." : <><Check size={13} /> Save & Restock</>}
              </Btn>
              <Btn variant="ghost" onClick={() => setParsed(null)}>Cancel</Btn>
            </div>
          </Card>
        )}
      </div>

      {/* Add New Item Modal */}
      {addingNewItemForIdx !== null && (
        <Modal title="Add New Ingredient to Inventory" onClose={() => { setAddingNewItemForIdx(null); setCalcMode("manual"); }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Inp label="Ingredient Name *" value={newFields.name} onChange={v => setNewFields({ ...newFields, name: v })} />
            <Sel
              label="Category *"
              value={newFields.cat}
              onChange={v => setNewFields({ ...newFields, cat: v })}
              options={["Dry Goods", "Dairy and Fats", "Flavours and Extracts", "Decoration Extras", "Board and Packaging", "Other"].map(c => ({ value: c, label: c }))}
            />
            <Inp label="Unit (e.g. kg, L, pcs) *" value={newFields.unit} onChange={v => setNewFields({ ...newFields, unit: v })} />

            <div>
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
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Inp label="Total Amount Paid (₦) *" type="number" value={newFields.totalPaid || ""} onChange={v => setNewFields(p => ({ ...p, totalPaid: v }))} placeholder="e.g. 5000" />
                <Inp label="Quantity Bought *" type="number" value={newFields.qtyBought || ""} onChange={v => setNewFields(p => ({ ...p, qtyBought: v }))} placeholder="e.g. 2.5" />
                {newFields.totalPaid && newFields.qtyBought && parseFloat(newFields.qtyBought) > 0 && (
                  <div style={{ gridColumn: "span 2", padding: "8px 12px", background: "var(--panel)", borderRadius: 8, fontSize: 13, fontWeight: 500, color: "var(--gold)", border: "1px solid var(--border)" }}>
                    Calculated Cost per Unit: {fmt(parseFloat(newFields.totalPaid) / parseFloat(newFields.qtyBought))}/{newFields.unit}
                  </div>
                )}
              </div>
            ) : (
              <Inp label="Cost per Unit (₦) *" type="number" value={newFields.cost} onChange={v => setNewFields({ ...newFields, cost: v })} />
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Inp label="Starting Inventory Qty" type="number" value={newFields.stock} onChange={v => setNewFields({ ...newFields, stock: v })} />
              <Inp label="Min Stock Level Alert" type="number" value={newFields.minStock} onChange={v => setNewFields({ ...newFields, minStock: v })} />
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
              <Btn variant="success" onClick={saveNewItemFromReceipt} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <Check size={13} /> Add Ingredient
              </Btn>
              <Btn variant="ghost" onClick={() => { setAddingNewItemForIdx(null); setCalcMode("manual"); }}>Cancel</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
