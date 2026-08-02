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
import { saveInventory, saveExpenses, saveLocal, loadLocal } from "../../lib/data.js"

// Helper to extract and repair common LLM JSON syntax flaws (trailing commas, unquoted keys, comments)
function extractAndRepairJson(rawText) {
  if (!rawText) return null
  let str = rawText.trim()
  str = str.replace(/```json|```/g, "").trim()

  const jsonMatch = str.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    str = jsonMatch[0]
  }

  // Attempt 1: Direct JSON parse
  try {
    return JSON.parse(str)
  } catch {
    // Attempt 2: Strip comments and trailing commas
    try {
      let cleaned = str
        .replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "")
        .replace(/,\s*([\]\}])/g, "$1")
      return JSON.parse(cleaned)
    } catch {
      // Attempt 3: Quote unquoted keys
      try {
        let cleaned = str
          .replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "")
          .replace(/,\s*([\]\}])/g, "$1")
          .replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":')
        return JSON.parse(cleaned)
      } catch {
        return null
      }
    }
  }
}

function normalizeItem(r) {
  if (!r) return { item_on_receipt: "", qty: 1, unit: "kg", unit_size: 1, unit_price: 0, line_total: 0, type: "purchase", overrideId: "", approved: true, confidence: "high" }
  if (typeof r === "string") {
    return { item_on_receipt: r, qty: 1, unit: "kg", unit_size: 1, unit_price: 0, line_total: 0, type: "purchase", overrideId: "", approved: true, confidence: "high" }
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
    type: (r.type === "expense" || r.type === "Expense") ? "expense" : "purchase",
    overrideId: String(r.matched_id || r.overrideId || ""),
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
  const [parsed, setParsed] = useState(null) // { supplier, receipt_date, items: [...] }
  const [totalAmount, setTotalAmount] = useState("")
  const [saving, setSaving] = useState(false)
  const [rawParseError, setRawParseError] = useState("")
  const fileRef = useRef()

  // State for creating a new inventory item directly from the review step
  const [addingNewItemForIdx, setAddingNewItemForIdx] = useState(null)
  const [newFields, setNewFields] = useState({ name: "", cat: "Dry Goods", unit: "kg", cost: "", stock: "", minStock: "5" })

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

  // Scan receipt with Claude
  const scan = async () => {
    if (!photoB64) return
    setLoading(true)
    setError("")
    try {
      const compressed = await compressImage(photoB64, 1200)
      const invList = inventory.map(i => `${i.id}:${i.name}(${i.unit})`).join(", ")
      const raw = await callClaude([
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: "image/jpeg", data: compressed } },
            {
              type: "text",
              text: `This is a Nigerian bakery receipt. Read every item carefully.

Inventory list to match against:
${invList}

For each item, classify as:
- "purchase" if it is a baking ingredient or supply (flour, sugar, butter, eggs, oil, cocoa, milk, cream, food colour, packaging materials, cake boards, boxes, ribbons, decorations, etc.)
- "expense" if it is an overhead cost (delivery fee, transport, utility, salary, cleaning, equipment repair, marketing, rent, etc.)

For purchase items, also extract:
- unit_size: the size of one pack/bag/crate (e.g. 50 for a 50kg bag, 30 for a 30-egg crate)
- If unit_size is not clear from the receipt, use the qty as the unit_size and set qty to 1.

Return ONLY this exact JSON, no other text:
{
  "items": [
    {"item_on_receipt":"flour","qty":3,"unit":"kg","unit_size":50,"unit_price":57000,"line_total":171000,"type":"purchase","matched_id":"i1","matched_name":"Flour","confidence":"high"},
    {"item_on_receipt":"delivery fee","qty":1,"unit":"","unit_size":1,"unit_price":2000,"line_total":2000,"type":"expense","matched_id":"","matched_name":"Delivery","confidence":"high"}
  ],
  "receipt_total":173000,
  "receipt_date":"2026-04-01",
  "supplier":"market name if visible"
}
confidence: "high", "medium", or "low". For unclear handwriting, make best guess.`
            }
          ]
        }
      ], "Parse Nigerian bakery receipts. Classify each item as purchase or expense. Return valid JSON only.")

      const result = extractAndRepairJson(raw)
      const rawItems = result && (
        Array.isArray(result.items) ? result.items :
          Array.isArray(result.purchases) ? result.purchases :
            Array.isArray(result.data) ? result.data :
              Array.isArray(result.receipt_items) ? result.receipt_items : null
      )

      const displayRawText = (raw && raw.trim()) ? raw : "(No raw text response returned by AI API)"

      if (!result || !rawItems || rawItems.length === 0) {
        setParsed({
          supplier: result?.supplier || "",
          receipt_date: result?.receipt_date || today(),
          items: [
            { item_on_receipt: "", qty: 1, unit: "kg", unit_size: 1, unit_price: 0, line_total: 0, type: "purchase", overrideId: "", approved: true, confidence: "high" }
          ],
          rawText: displayRawText,
          isEditingRaw: true
        })
        setTotalAmount("")
      } else {
        setParsed({
          supplier: result.supplier || "",
          receipt_date: result.receipt_date || today(),
          ...result,
          items: rawItems.map(normalizeItem),
          rawText: displayRawText,
          isEditingRaw: true
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
      ],
      rawText: "",
      isEditingRaw: false
    })
    setTotalAmount("")
    setSaved(false)
    setPhoto(null)
    setPhotoB64(null)
    setError("")
    setRawParseError("")
  }

  // Reparse raw text manually edited by user
  const handleReparseRaw = () => {
    setRawParseError("")
    if (!parsed || !parsed.rawText) return

    const result = extractAndRepairJson(parsed.rawText)
    const rawItems = result && (
      Array.isArray(result.items) ? result.items :
        Array.isArray(result.purchases) ? result.purchases :
          Array.isArray(result.data) ? result.data :
            Array.isArray(result.receipt_items) ? result.receipt_items : null
    )

    if (!result || !rawItems || rawItems.length === 0) {
      setRawParseError("Could not parse JSON or no items list found. Please check syntax (quotes, brackets).")
      return
    }

    setParsed(prev => ({
      ...prev,
      ...result,
      items: rawItems.map(normalizeItem),
      isEditingRaw: true
    }))
    if (result.receipt_total) {
      setTotalAmount(String(result.receipt_total))
    }
  }

  // Edit list helper
  const updateRow = (idx, field, val) => {
    setParsed(p => ({
      ...p,
      items: p.items.map((r, i) => {
        if (i !== idx) return r
        const updatedRow = { ...r, [field]: val }

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
  const toggleType = idx => setParsed(p => ({ ...p, items: p.items.map((r, i) => i === idx ? { ...r, type: r.type === "purchase" ? "expense" : "purchase" } : r) }))
  const setMatch = (idx, id) => setParsed(p => ({ ...p, items: p.items.map((r, i) => i === idx ? { ...r, overrideId: id, approved: true } : r) }))

  // Save the receipt to stock + expenses
  const applyUpdates = async () => {
    setSaving(true)
    try {
      const approved = parsed.items.filter(r => r.approved)
      const purchases = approved.filter(r => r.type === "purchase" && r.overrideId)
      const expItems = approved.filter(r => r.type === "expense" || !r.overrideId)

      // Update inventory: stock + cost/unit for purchases
      let updInv = [...inventory]
      const purchaseLog = []

      purchases.forEach(r => {
        const invItem = updInv.find(i => i.id === r.overrideId)
        if (!invItem) return
        const unitSize = +r.unit_size || +r.qty || 1
        const cpu = parseFloat((+r.unit_price / unitSize).toFixed(2))
        const stockAdded = parseFloat((unitSize * (+r.qty || 1)).toFixed(3))
        updInv = updInv.map(i => i.id === r.overrideId ? { ...i, cost: cpu, stock: parseFloat((i.stock + stockAdded).toFixed(3)) } : i)
        purchaseLog.push({
          id: uid(),
          date: parsed.receipt_date || today(),
          itemId: r.overrideId,
          item: invItem.name,
          unit: invItem.unit,
          unitSize,
          qty: +r.qty || 1,
          price: +r.unit_price,
          total: +r.line_total || 0,
          cpu,
          stockAdded
        })
      })

      if (purchases.length > 0) {
        setInventory(updInv)
        await saveInventory(updInv)
      }

      // Save purchase logs to database (via saveLocal which triggers sync)
      if (purchaseLog.length > 0) {
        const existing = loadLocal("ll_purchases", [])
        await saveLocal("ll_purchases", [...purchaseLog, ...existing])
      }

      // Log expense record
      const totalCalc = parsed.items.reduce((s, r) => s + (r.approved ? (+r.line_total || 0) : 0), 0)
      const amt = +totalAmount || totalCalc
      if (amt > 0) {
        const purchaseNames = purchases.map(r => r.matched_name || r.item_on_receipt)
        const expNames = expItems.map(r => r.item_on_receipt)

        const purchaseCalc = purchases.reduce((s, r) => s + (+r.line_total || 0), 0)
        const expCalc = expItems.reduce((s, r) => s + (+r.line_total || 0), 0)

        const purchaseAmt = totalCalc > 0 ? (purchaseCalc / totalCalc) * amt : (purchases.length > 0 && expItems.length === 0 ? amt : 0)
        const expAmt = totalCalc > 0 ? (expCalc / totalCalc) * amt : (expItems.length > 0 && purchases.length === 0 ? amt : 0)

        let newExps = []

        if (purchaseAmt > 0) {
          newExps.push({
            id: uid(),
            date: parsed.receipt_date || today(),
            description: `${parsed.supplier || "Receipt"} — Ingredients/Supplies`,
            amount: Math.round(purchaseAmt),
            category: "Ingredients",
            paymentMethod: "cash",
            source: "purchase",
            notes: `Purchases: ${purchaseNames.join(", ")}`
          })
        }

        if (expAmt > 0) {
          newExps.push({
            id: uid(),
            date: parsed.receipt_date || today(),
            description: `${parsed.supplier || "Receipt"} — Operations`,
            amount: Math.round(expAmt),
            category: "Operations",
            paymentMethod: "cash",
            source: "receipt",
            notes: `Expenses: ${expNames.join(", ")}`
          })
        }

        if (newExps.length > 0) {
          const updExp = [...newExps, ...expenses]
          setExpenses(updExp)
          await saveExpenses(updExp)
        }
      }

      setParsed(null)
      setPhoto(null)
      setPhotoB64(null)
      setSaved(true)
    } catch (e) {
      console.error(e)
      alert("❌ Save failed: " + e.message)
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
      minStock: "5"
    })
    setAddingNewItemForIdx(idx)
  }

  // Save new item directly to inventory and auto-select in row
  const saveNewItemFromReceipt = async () => {
    if (!newFields.name.trim() || !newFields.cost) {
      alert("Name and cost per unit are required")
      return
    }

    const itemId = uid()
    const newItemObj = {
      id: itemId,
      name: newFields.name.trim(),
      cat: newFields.cat,
      unit: newFields.unit || "kg",
      cost: Number(newFields.cost),
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
    setAddingNewItemForIdx(null)
  }

  return (
    <div>
      <SHead title="Receipt Scanner & Purchases" sub="Scan paper receipts using AI or type items manually to update stock levels." />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 16, alignItems: "start" }}>

        {/* Left Side: Upload or Choose Method */}
        <Card>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 15, fontWeight: 600, marginBottom: 12 }}>📷 Stock Purchase Input</div>

          {!photo && !parsed && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <button
                  onClick={async () => {
                    try {
                      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
                      const video = document.createElement("video")
                      video.srcObject = stream
                      video.autoplay = true
                      const overlay = document.createElement("div")
                      overlay.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:#000;z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px"
                      video.style.cssText = "max-width:100%;max-height:70vh;border-radius:10px"
                      const btn = document.createElement("button")
                      btn.textContent = "📷 Capture"
                      btn.style.cssText = "padding:14px 32px;border-radius:10px;border:none;background:var(--gold);color:#fff;font-size:16px;cursor:pointer"
                      const close = document.createElement("button")
                      close.textContent = "✕ Cancel"
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
                        const dataUrl = canvas.toDataURL("image/jpeg", 0.8)
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
                  <div style={{ fontSize: 28, marginBottom: 4 }}>📷</div>
                  <div style={{ fontSize: 12.5, color: "var(--muted)", fontWeight: 500 }}>Open camera</div>
                </button>
                <button
                  onClick={() => fileRef.current?.click()}
                  style={{ padding: "14px 8px", borderRadius: 10, border: "2px dashed var(--border)", background: "#FAF7F0", cursor: "pointer", textAlign: "center" }}
                >
                  <div style={{ fontSize: 28, marginBottom: 4 }}>🖼️</div>
                  <div style={{ fontSize: 12.5, color: "var(--muted)", fontWeight: 500 }}>Upload photo</div>
                </button>
              </div>

              <button
                onClick={startManualEntry}
                style={{ padding: "12px 14px", borderRadius: 10, border: "2px dashed var(--gold)", background: "#FDFAF4", cursor: "pointer", textAlign: "center", color: "var(--gold)", fontWeight: 600, fontSize: 13 }}
              >
                ✍️ Enter Manually (Type Purchases)
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
              <Btn full onClick={scan} disabled={loading}>{loading ? "🔍 AI is reading the receipt…" : "✦ Scan & Extract Items"}</Btn>
              {loading && <div style={{ fontSize: 12, color: "var(--muted)", textAlign: "center", marginTop: 8 }}>This may take 15-30 seconds…</div>}
              {error && <div style={{ marginTop: 10, padding: "8px 12px", background: "#FDEBE9", borderRadius: 8, fontSize: 12.5, color: "#B03A2E", lineHeight: 1.5 }}>⚠ {error}</div>}
            </>
          )}

          {saved && (
            <div style={{ background: "#EEF8F3", borderRadius: 8, padding: 12, border: "1px solid #C2E0CF" }}>
              <div style={{ fontWeight: 600, color: "#357A52", marginBottom: 4 }}>✓ Done! Purchases updated inventory · expenses logged · cost/unit recalculated.</div>
              <Btn small variant="outline" onClick={() => setSaved(false)}>Log Another</Btn>
            </div>
          )}

          {!photo && !parsed && (
            <div style={{ marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 13.5, fontWeight: 600, marginBottom: 8 }}>How It Works</div>
              {[
                ["📸", "Supermarket receipts or market logs work. Lay flat in bright light."],
                ["✍️", "Or tap manual entry to type list rows directly."],
                ["✅", "Review extracted lines, link to ingredients, and check cost levels."]
              ].map(([icon, text]) => (
                <div key={icon} style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                  <span style={{ fontSize: 16 }}>{icon}</span>
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
                {!parsed.isEditingRaw ? (
                  <Btn small variant="outline" onClick={() => setParsed({ ...parsed, isEditingRaw: true })}>✍️ Show Raw AI Response</Btn>
                ) : (
                  <Btn small variant="outline" onClick={() => setParsed({ ...parsed, isEditingRaw: false })}>🙈 Hide Raw Box</Btn>
                )}
                <Btn small variant="ghost" onClick={addBlankRow}>+ Add Row</Btn>
              </div>
            </div>

            {parsed.isEditingRaw && (
              <div style={{ marginBottom: 14, padding: 12, background: "#FFF9EE", border: "1px solid #FEF0D0", borderRadius: 8 }}>
                <div style={{ fontWeight: 600, fontSize: 12, color: "#7A5500", marginBottom: 6 }}>
                  🤖 Raw AI Response JSON (Inspect or edit text below, then click Parse):
                </div>
                <textarea
                  value={parsed.rawText || ""}
                  onChange={e => setParsed({ ...parsed, rawText: e.target.value })}
                  placeholder="Raw AI response will appear here..."
                  style={{
                    width: "100%",
                    height: 150,
                    fontFamily: "monospace",
                    fontSize: 11,
                    padding: 8,
                    background: "white",
                    border: "1px solid var(--border)",
                    borderRadius: 4,
                    resize: "vertical",
                    lineHeight: 1.4
                  }}
                />
                {rawParseError && (
                  <div style={{ color: "#B03A2E", fontSize: 11, marginTop: 6, fontWeight: 600 }}>
                    ❌ Parsing Error: {rawParseError}
                  </div>
                )}
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <Btn small variant="success" onClick={handleReparseRaw}>✓ Parse & Load JSON</Btn>
                  <Btn small variant="outline" onClick={() => setParsed({ ...parsed, isEditingRaw: false })}>Hide Box</Btn>
                </div>
              </div>
            )}

            {/* Receipt Metadata */}
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
                      <span
                        onClick={() => toggleType(idx)}
                        style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, cursor: "pointer", fontWeight: 600, background: r.type === "purchase" ? "#E8EFFC" : "#FEF0D0", color: r.type === "purchase" ? "#2355A0" : "#7A5500" }}
                      >
                        {r.type === "purchase" ? "🛍 Buy" : "💸 Exp"}
                      </span>
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
                  {r.approved && r.type === "purchase" && (
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <select
                        value={r.overrideId || ""}
                        onChange={e => setMatch(idx, e.target.value)}
                        style={{ ...iSt, fontSize: 12, padding: "5px 8px", flex: 1 }}
                      >
                        <option value="">— Link to inventory ingredient —</option>
                        {inventory.map(i => (
                          <option key={i.id} value={i.id}>{i.name} ({i.unit}) | stock: {i.stock}</option>
                        ))}
                      </select>
                      {!r.overrideId && (
                        <Btn small variant="outline" onClick={() => openNewItemModal(idx)}>+ Add As New</Btn>
                      )}
                    </div>
                  )}

                  {r.approved && r.type === "expense" && (
                    <div style={{ fontSize: 11, color: "var(--muted)", background: "#FFF9EE", padding: "4px 8px", borderRadius: 4 }}>
                      → Logs directly to Expenses
                    </div>
                  )}
                </div>
              ))}
            </div>

            <Inp label="Total Invoice Cost (₦)" type="number" value={totalAmount} onChange={setTotalAmount} placeholder="Total amount paid" />

            <div style={{ display: "flex", gap: 8, marginTop: 14, justifyContent: "flex-end" }}>
              <Btn variant="success" onClick={applyUpdates} disabled={saving || !parsed.items.some(r => r.approved)}>{saving ? "⌛ Saving..." : "✓ Save & Restock"}</Btn>
              <Btn variant="ghost" onClick={() => setParsed(null)}>Cancel</Btn>
            </div>
          </Card>
        )}
      </div>

      {/* Add New Item Modal */}
      {addingNewItemForIdx !== null && (
        <Modal title="Add New Ingredient to Inventory" onClose={() => setAddingNewItemForIdx(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Inp label="Ingredient Name *" value={newFields.name} onChange={v => setNewFields({ ...newFields, name: v })} />
            <Sel
              label="Category *"
              value={newFields.cat}
              onChange={v => setNewFields({ ...newFields, cat: v })}
              options={["Dry Goods", "Dairy and Fats", "Flavours and Extracts", "Decoration Extras", "Board and Packaging", "Other"].map(c => ({ value: c, label: c }))}
            />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Inp label="Unit (e.g. kg, L, pcs) *" value={newFields.unit} onChange={v => setNewFields({ ...newFields, unit: v })} />
              <Inp label="Cost per Unit (₦) *" type="number" value={newFields.cost} onChange={v => setNewFields({ ...newFields, cost: v })} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Inp label="Starting Inventory Qty" type="number" value={newFields.stock} onChange={v => setNewFields({ ...newFields, stock: v })} />
              <Inp label="Min Stock Level Alert" type="number" value={newFields.minStock} onChange={v => setNewFields({ ...newFields, minStock: v })} />
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
              <Btn variant="success" onClick={saveNewItemFromReceipt}>✓ Add Ingredient</Btn>
              <Btn variant="ghost" onClick={() => setAddingNewItemForIdx(null)}>Cancel</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
