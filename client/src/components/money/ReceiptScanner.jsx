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
import { fmt, uid, today, callClaude, compressImage, recipeCost } from "../../lib/helpers.js"
import { saveInventory, saveExpenses, savePurchases, saveLocal, loadLocal, loadAliases, saveAliases, refundScanCredits, fetchTokenBalance } from "../../lib/data.js"
import { EXP_CATS } from "../../constants.js"
import { Camera, Upload, PenLine, Sparkles, AlertTriangle, Check, Coins, TrendingUp, RefreshCw } from "lucide-react"

// Normalizes various date string formats (DD/MM/YYYY, YYYY/MM/DD, natural text) to ISO YYYY-MM-DD
export function normalizeToIsoDate(inputDate) {
  if (!inputDate) return today()
  if (inputDate instanceof Date && !isNaN(inputDate.getTime())) {
    const y = inputDate.getFullYear()
    const m = String(inputDate.getMonth() + 1).padStart(2, "0")
    const d = String(inputDate.getDate()).padStart(2, "0")
    return `${y}-${m}-${d}`
  }
  if (typeof inputDate !== "string") return today()
  const trimmed = inputDate.trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10)

  // DD/MM/YYYY or DD-MM-YYYY or D/M/YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/)
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`
  }

  // YYYY/MM/DD or YYYY-MM-DD
  const ymdMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
  if (ymdMatch) {
    const [, y, m, d] = ymdMatch
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`
  }

  // General Date parsing fallback
  try {
    const d = new Date(trimmed)
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, "0")
      const day = String(d.getDate()).padStart(2, "0")
      return `${y}-${m}-${day}`
    }
  } catch {
    // ignore parse errors
  }

  return today()
}

// Formats any date string (ISO, timestamp, or natural) into standard Nigerian DD/MM/YYYY format
export function formatDateDMY(inputDate) {
  if (!inputDate) return ""
  if (typeof inputDate === "string") {
    const trimmed = inputDate.trim()
    if (!trimmed) return ""
    const dmyMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/)
    if (dmyMatch) {
      const [, d, m, y] = dmyMatch
      return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`
    }
    // ISO YYYY-MM-DD or ISO timestamp
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      const [y, m, d] = trimmed.slice(0, 10).split("-")
      return `${d}/${m}/${y}`
    }
    const ymdMatch = trimmed.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/)
    if (ymdMatch) {
      const [, y, m, d] = ymdMatch
      return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`
    }
    try {
      const d = new Date(trimmed)
      if (!isNaN(d.getTime())) {
        const day = String(d.getDate()).padStart(2, "0")
        const month = String(d.getMonth() + 1).padStart(2, "0")
        const year = d.getFullYear()
        return `${day}/${month}/${year}`
      }
    } catch {
      // ignore parse errors
    }
    return trimmed
  }
  if (inputDate instanceof Date && !isNaN(inputDate.getTime())) {
    const day = String(inputDate.getDate()).padStart(2, "0")
    const month = String(inputDate.getMonth() + 1).padStart(2, "0")
    const year = inputDate.getFullYear()
    return `${day}/${month}/${year}`
  }
  return String(inputDate)
}

export const todayDMY = () => formatDateDMY(new Date())

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

// Automatically detects measurement units (kg, g, L, ml, pcs, crate, etc.) from item text and unit fields
export function detectUnitAndSize(text = "", existingUnit = "", existingSize = 1) {
  const combined = `${text} ${existingUnit}`.toLowerCase()

  // 1. Check for KG patterns first (e.g. "50kg", "25 kg", "1kg", "2.5kg", "kilogram")
  const kgMatch = combined.match(/\b(\d+(?:\.\d+)?)\s*(?:kg|kgs|kilo|kilos|kilogram|kilograms)\b/i)
  if (kgMatch) {
    return {
      unit: "kg",
      unit_size: parseFloat(kgMatch[1]) || 1
    }
  }
  if (/\b(?:kg|kgs|kilo|kilos|kilogram|kilograms)\b/i.test(combined)) {
    return {
      unit: "kg",
      unit_size: Number(existingSize) > 0 ? Number(existingSize) : 1
    }
  }

  // 2. Check for Grams patterns (e.g. "500g", "250 g", "100gm", "grams")
  const gMatch = combined.match(/(\d+(?:\.\d+)?)\s*(?:g|gm|gms|gram|grams)\b/i)
  if (gMatch) {
    return {
      unit: "g",
      unit_size: parseFloat(gMatch[1]) || 1
    }
  }
  if (/\b(?:gm|gms|gram|grams)\b/i.test(combined) || /\b(\d+)\s*g\b/i.test(combined)) {
    return {
      unit: "g",
      unit_size: Number(existingSize) > 0 ? Number(existingSize) : 1
    }
  }

  // 3. Check for Litres / L / Ltr (e.g. "5L", "1.5ltr", "1 litre")
  const lMatch = combined.match(/\b(\d+(?:\.\d+)?)\s*(?:l|ltr|ltrs|liter|liters|litre|litres)\b/i)
  if (lMatch) {
    return {
      unit: "l",
      unit_size: parseFloat(lMatch[1]) || 1
    }
  }
  if (/\b(?:ltr|ltrs|liter|liters|litre|litres)\b/i.test(combined)) {
    return {
      unit: "l",
      unit_size: Number(existingSize) > 0 ? Number(existingSize) : 1
    }
  }

  // 4. Check for ML / Millilitres (e.g. "500ml", "250 ml", "50ml")
  const mlMatch = combined.match(/(\d+(?:\.\d+)?)\s*(?:ml|mls|milliliter|milliliters|millilitre|millilitres)\b/i)
  if (mlMatch) {
    return {
      unit: "ml",
      unit_size: parseFloat(mlMatch[1]) || 1
    }
  }
  if (/\b(?:ml|mls)\b/i.test(combined)) {
    return {
      unit: "ml",
      unit_size: Number(existingSize) > 0 ? Number(existingSize) : 1
    }
  }

  // 5. Check for CL
  const clMatch = combined.match(/(\d+(?:\.\d+)?)\s*(?:cl)\b/i)
  if (clMatch) {
    return {
      unit: "cl",
      unit_size: parseFloat(clMatch[1]) || 1
    }
  }

  // 6. Check for Pcs / Pieces
  const pcsMatch = combined.match(/(\d+(?:\.\d+)?)\s*(?:pcs|pc|piece|pieces)\b/i)
  if (pcsMatch) {
    return {
      unit: "pcs",
      unit_size: parseFloat(pcsMatch[1]) || 1
    }
  }
  if (/\b(?:pcs|pc|piece|pieces)\b/i.test(combined)) {
    return {
      unit: "pcs",
      unit_size: Number(existingSize) > 0 ? Number(existingSize) : 1
    }
  }

  // 7. Check for Crate (e.g. Eggs 1 crate)
  if (/\b(?:crate|crates)\b/i.test(combined)) {
    return {
      unit: "crate",
      unit_size: Number(existingSize) > 0 ? Number(existingSize) : 1
    }
  }

  // 8. Check for Carton
  if (/\b(?:carton|cartons)\b/i.test(combined)) {
    return {
      unit: "carton",
      unit_size: Number(existingSize) > 0 ? Number(existingSize) : 1
    }
  }

  // 9. Check for Bottle
  if (/\b(?:bottle|bottles|btl)\b/i.test(combined)) {
    return {
      unit: "bottle",
      unit_size: Number(existingSize) > 0 ? Number(existingSize) : 1
    }
  }

  // 10. Check for Roll
  if (/\b(?:roll|rolls)\b/i.test(combined)) {
    return {
      unit: "roll",
      unit_size: Number(existingSize) > 0 ? Number(existingSize) : 1
    }
  }

  // 11. Check for Bag / Sack
  if (/\b(?:bag|bags|sack|sacks)\b/i.test(combined)) {
    return {
      unit: "bag",
      unit_size: Number(existingSize) > 0 ? Number(existingSize) : 1
    }
  }

  // 12. Check for Bucket / Tub
  if (/\b(?:bucket|buckets|tub|tubs)\b/i.test(combined)) {
    return {
      unit: "bucket",
      unit_size: Number(existingSize) > 0 ? Number(existingSize) : 1
    }
  }

  // 13. Check for Pack
  if (/\b(?:pack|packs|packet|packets|pk)\b/i.test(combined)) {
    return {
      unit: "pack",
      unit_size: Number(existingSize) > 0 ? Number(existingSize) : 1
    }
  }

  // Normalize existingUnit if provided
  const cleanExisting = String(existingUnit || "").trim().toLowerCase()
  if (cleanExisting) {
    if (["kg", "kgs", "kilogram", "kilograms"].includes(cleanExisting)) return { unit: "kg", unit_size: Number(existingSize) || 1 }
    if (["g", "gm", "gms", "gram", "grams"].includes(cleanExisting)) return { unit: "g", unit_size: Number(existingSize) || 1 }
    if (["l", "ltr", "ltrs", "liter", "litre"].includes(cleanExisting)) return { unit: "l", unit_size: Number(existingSize) || 1 }
    if (["ml", "mls"].includes(cleanExisting)) return { unit: "ml", unit_size: Number(existingSize) || 1 }
    if (["pcs", "pc", "pieces", "piece"].includes(cleanExisting)) return { unit: "pcs", unit_size: Number(existingSize) || 1 }
    return { unit: cleanExisting, unit_size: Number(existingSize) || 1 }
  }

  return {
    unit: "kg",
    unit_size: Number(existingSize) || 1
  }
}

function normalizeItem(r) {
  if (!r) return { item_on_receipt: "", qty: 1, unit: "kg", unit_size: 1, unit_price: 0, line_total: 0, type: "purchase", overrideId: "", category: "Other", approved: true, confidence: "high" }
  if (typeof r === "string") {
    const detected = detectUnitAndSize(r, "kg", 1)
    return { item_on_receipt: r, qty: 1, unit: detected.unit, unit_size: detected.unit_size, unit_price: 0, line_total: 0, type: "purchase", overrideId: "", category: "Other", approved: true, confidence: "high" }
  }
  const qty = Number(r.qty || r.quantity || 1) || 1
  const price = Number(r.unit_price || r.price || r.cost || 0) || 0
  const total = Number(r.line_total || r.total || (qty * price) || 0) || 0
  const itemName = String(r.item_on_receipt || r.name || r.item || r.description || "")

  // Detect unit and pack size from item description and Claude unit
  const detected = detectUnitAndSize(itemName, r.unit, r.unit_size || r.size || 1)

  return {
    item_on_receipt: itemName,
    qty,
    unit: detected.unit,
    unit_size: detected.unit_size,
    unit_price: price,
    line_total: total,
    type: "purchase", // All items default to Link to Inventory. Expense linking is only done manually by the user.
    overrideId: String(r.matched_id || r.overrideId || ""),
    category: (r.category && r.category !== "Miscellaneous") ? String(r.category) : "Other",
    approved: r.approved !== undefined ? Boolean(r.approved) : r.confidence !== "low",
    confidence: String(r.confidence || "high")
  }
}

// Clean text: lowercase, strip punctuation, strip common packaging/unit tokens, trim
export function cleanItemText(str) {
  if (!str || typeof str !== "string") return ""
  return str
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\b(\d+(?:\.\d+)?\s*(?:kg|g|l|ml|cl|ltr|pcs|pack|packs|bag|bags|sack|sacks|crate|crates|carton|cartons|bucket|buckets|btl|bottles|rolls|roll))\b/g, " ")
    .replace(/\b(kg|ltr|litres|pcs|pack|packs|bags|sacks|crate|crates|cartons)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

// Simple stemmer for common bakery item plurals
export function stemItemWord(w) {
  if (!w || typeof w !== "string" || w.length <= 3) return w
  const word = w.toLowerCase()
  if (word.endsWith("ies") && word.length > 4) return word.slice(0, -3) + "y"
  if (word.endsWith("es") && (word.endsWith("shes") || word.endsWith("ches") || word.endsWith("xes") || word.endsWith("sses") || word.endsWith("boxes"))) {
    return word.slice(0, -2)
  }
  if (word.endsWith("s") && !word.endsWith("ss")) {
    return word.slice(0, -1)
  }
  return word
}

const STOP_WORDS = new Set(["and", "or", "the", "a", "an", "of", "for", "with", "in", "to", "by", "&"])
const BRAND_WORDS = new Set([
  "dangote", "golden", "penny", "honeywell", "mama", "gold", "presco", "simas",
  "dano", "peak", "mamador", "gino", "louis", "st", "grand", "devon", "blue", "band"
])

// Tokenize and stem string
export function tokenizeItem(str, stripBrands = false) {
  const cleaned = cleanItemText(str)
  if (!cleaned) return []
  const tokens = cleaned
    .split(/\s+/)
    .filter(t => t.length > 0 && !/^\d+$/.test(t))
  
  const filtered = tokens.filter(t => !STOP_WORDS.has(t))
  let useTokens = filtered.length > 0 ? filtered : tokens

  if (stripBrands) {
    const withoutBrands = useTokens.filter(t => !BRAND_WORDS.has(t.toLowerCase()))
    if (withoutBrands.length > 0) {
      useTokens = withoutBrands
    }
  }

  return useTokens.map(stemItemWord)
}

// String similarity (Levenshtein distance based)
export function calculateLevenshteinSimilarity(s1, s2) {
  if (s1 === s2) return 1.0
  if (!s1 || !s2) return 0.0
  const l1 = s1.length
  const l2 = s2.length
  const maxLen = Math.max(l1, l2)
  if (maxLen === 0) return 1.0

  let prev = Array.from({ length: l2 + 1 }, (_, i) => i)
  let curr = new Array(l2 + 1)

  for (let i = 1; i <= l1; i++) {
    curr[0] = i
    for (let j = 1; j <= l2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1
      curr[j] = Math.min(
        curr[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + cost
      )
    }
    prev = [...curr]
  }

  return 1 - prev[l2] / maxLen
}

/**
 * Intelligently matches a scanned item name to the most relevant inventory item.
 * Supports:
 * - Saved aliases (highest priority)
 * - Exact matches (case/punctuation normalized)
 * - Stemmed matches (e.g. "Eggs" -> "Egg", "Boxes" -> "Box")
 * - Keyword matches (e.g. "Sugar" -> "White Sugar", "Flour" -> "All-Purpose Flour")
 * - Token inclusion matches (e.g. "Dangote White Sugar" -> "White Sugar")
 * - Partial similarity / typo tolerance
 * - Rejection of low-confidence / unrelated items (returns "")
 */
export function matchItemToInventory(itemName, inventory, aliases = {}) {
  if (!itemName || typeof itemName !== "string" || !Array.isArray(inventory) || inventory.length === 0) {
    return ""
  }

  const rawKey = itemName.trim().toLowerCase()
  if (!rawKey) return ""

  // 1. Check saved aliases first (highest priority)
  if (aliases[rawKey] && inventory.some(i => i.id === aliases[rawKey])) {
    return aliases[rawKey]
  }

  const cleanScan = cleanItemText(itemName)
  const scanTokens = tokenizeItem(itemName, false)
  const cleanScanTokens = tokenizeItem(itemName, true)
  const stemmedScan = scanTokens.join(" ")
  const stemmedCleanScan = cleanScanTokens.join(" ")

  let bestMatch = null
  let highestScore = 0

  for (const item of inventory) {
    if (!item || !item.name) continue
    const rawInv = item.name.trim().toLowerCase()
    const cleanInv = cleanItemText(item.name)
    const invTokens = tokenizeItem(item.name, false)
    const stemmedInv = invTokens.join(" ")

    let score = 0

    // Rule 1: Exact matches
    if (rawKey === rawInv) {
      score = 100
    } else if (cleanScan === cleanInv && cleanScan.length > 0) {
      score = 98
    } else if (stemmedScan === stemmedInv && stemmedScan.length > 0) {
      score = 95
    } else if (stemmedCleanScan === stemmedInv && stemmedCleanScan.length > 0) {
      score = 94
    } else if (scanTokens.length > 0 && invTokens.length > 0) {
      // Check token containment with both full and clean (brand-stripped) tokens
      const matchedScanTokens = scanTokens.filter(st => invTokens.includes(st))
      const matchedCleanScanTokens = cleanScanTokens.filter(st => invTokens.includes(st))
      const matchedInvTokens = invTokens.filter(it => scanTokens.includes(it) || cleanScanTokens.includes(it))

      const allScanTokensInInv = scanTokens.length > 0 && matchedScanTokens.length === scanTokens.length
      const allCleanScanTokensInInv = cleanScanTokens.length > 0 && matchedCleanScanTokens.length === cleanScanTokens.length
      const allInvTokensInScan = invTokens.length > 0 && matchedInvTokens.length === invTokens.length

      if (allScanTokensInInv || allCleanScanTokensInInv) {
        // Keyword match: Scanned (or its ingredient keywords) is fully contained in inventory
        // e.g. "Sugar" -> "White Sugar", "Flour" -> "All-Purpose Flour", "Dangote Sugar" -> "White Sugar"
        const activeTokens = allCleanScanTokensInInv ? cleanScanTokens : scanTokens
        score = 85 + (activeTokens.length / invTokens.length) * 5

        // Core noun bonus: if last token matches (e.g. "... Sugar", "... Flour")
        if (invTokens[invTokens.length - 1] === activeTokens[activeTokens.length - 1]) {
          score += 3
        }

        // Standard bakery staple preference bonus for generic queries
        if (activeTokens.length === 1) {
          const firstScan = activeTokens[0]
          if (firstScan === "sugar" && (cleanInv.includes("white sugar") || cleanInv.includes("granulated"))) {
            score += 2
          } else if (firstScan === "flour" && (cleanInv.includes("all purpose") || cleanInv.includes("plain"))) {
            score += 2
          }
        }
      } else if (allInvTokensInScan) {
        // Reverse keyword match: Inventory is fully contained in scanned
        // e.g. "Dangote White Sugar 50kg" -> "White Sugar"
        score = 82 + (invTokens.length / scanTokens.length) * 5
        if (invTokens[invTokens.length - 1] === scanTokens[scanTokens.length - 1]) {
          score += 2
        }
      } else {
        // Partial overlap: Jaccard-like overlap
        const sharedCount = Math.max(matchedScanTokens.length, matchedCleanScanTokens.length)
        const totalDistinct = new Set([...cleanScanTokens, ...invTokens]).size
        const overlapRatio = totalDistinct > 0 ? sharedCount / totalDistinct : 0

        // Only consider if at least 2 tokens match and overlapRatio is significant (> 0.6)
        if (sharedCount >= 2 && overlapRatio >= 0.6) {
          score = overlapRatio * 75
        } else {
          // Character similarity check for minor typos (e.g. "Cocoa Powdr" vs "Cocoa Powder")
          const charSim = calculateLevenshteinSimilarity(cleanScan, cleanInv)
          if (charSim >= 0.82) {
            score = charSim * 80
          }
        }
      }
    }

    if (score > highestScore) {
      highestScore = score
      bestMatch = item
    }
  }

  // Threshold: only return if confident (>= 70)
  if (highestScore >= 70 && bestMatch) {
    return bestMatch.id
  }

  return ""
}

export function ReceiptScanner({ inventory, setInventory, expenses, setExpenses, setView }) {
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
  const [balance, setBalance] = useState(() => {
    const t = loadLocal("ll_tenant_info", null)
    return typeof t?.tokenBalance === "number" ? t.tokenBalance : 0
  })
  const [refundNotice, setRefundNotice] = useState("")
  const [impactSummary, setImpactSummary] = useState(null)

  useEffect(() => {
    const loaded = loadAliases({})
    if (loaded) setAliases(loaded)

    if (typeof fetchTokenBalance === "function") {
      fetchTokenBalance().then(res => {
        if (typeof res?.tokenBalance === "number") setBalance(res.tokenBalance)
      }).catch(() => {})
    }

    const onTokenUpdated = (e) => {
      const newBal = e.detail?.creditsDeducted !== undefined
        ? (e.detail?.newBalance ?? e.detail?.tokenBalance)
        : (e.detail?.creditBalance ?? e.detail?.tokenBalance)
      if (typeof newBal === "number") setBalance(newBal)
    }

    window.addEventListener("bakewealth:token-updated", onTokenUpdated)
    window.addEventListener("layerledger:token-updated", onTokenUpdated)
    window.addEventListener("layerledger:credit-updated", onTokenUpdated)
    return () => {
      window.removeEventListener("bakewealth:token-updated", onTokenUpdated)
      window.removeEventListener("layerledger:token-updated", onTokenUpdated)
      window.removeEventListener("layerledger:credit-updated", onTokenUpdated)
    }
  }, [])

  // State for creating a new inventory item directly from the review step
  const [addingNewItemForIdx, setAddingNewItemForIdx] = useState(null)
  const [calcMode, setCalcMode] = useState("manual") // "manual" or "auto"
  const [newFields, setNewFields] = useState({ name: "", cat: "Other", unit: "kg", cost: "", stock: "", minStock: "5", totalPaid: "", qtyBought: "" })

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
    setRefundNotice("")
    setImpactSummary(null)
  }

  // Scan receipt or photo with Claude
  const scan = async () => {
    if (!photoB64) return
    if (balance < 2) {
      setError("Insufficient credits: 2 credits required to scan a receipt. Current balance: " + Number(balance).toFixed(1) + " credits. Please top up your balance.")
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("bakewealth:insufficient-tokens", { detail: { requiredTokens: 2, requiredCredits: 2 } }))
        window.dispatchEvent(new CustomEvent("layerledger:insufficient-tokens", { detail: { requiredTokens: 2, requiredCredits: 2 } }))
      }
      return
    }
    setLoading(true)
    setError("")
    setRefundNotice("")
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

2. UNIT OF MEASUREMENT INSTRUCTIONS:
   - If the receipt line, item name, or description contains or implies a measurement unit (especially "kg", "g", "l", "ltr", "ml", "cl", "pcs", "crate", "carton", "bag", "roll", etc.), ALWAYS extract and set that measurement as the "unit"!
   - Examples:
     - "Dangote Sugar 50kg" -> unit: "kg", unit_size: 50
     - "Butter 250g" or "Yeast 500g" -> unit: "g", unit_size: 250 (or 500)
     - "Milk 1L" or "Oil 5 Litres" -> unit: "l", unit_size: 1 (or 5)
     - "Vanilla 500ml" -> unit: "ml", unit_size: 500
     - "Eggs 1 crate" -> unit: "crate", unit_size: 1
     - "Cake board 10pcs" -> unit: "pcs", unit_size: 10
   - NEVER default to generic units like "pack" or "unit" if "kg", "g", or any related weight/volume unit is present on the item or receipt!

3. BANK TRANSFER / POS SCREENSHOTS:
   - Extract beneficiary, merchant, or line items.
   - Set item_on_receipt to the detected merchant or purchase description.
   - Set qty: 1, unit: "pack", unit_size: 1, unit_price: [amount paid], line_total: [amount paid].
   - Set type: "purchase", category: "Other".

4. PHOTOS OF PHYSICAL PRODUCTS / SUPPLIES:
   - Identify each distinct bakery item visible (e.g. "Flour", "Margarine", "Eggs", "Cake Box").
   - Count or estimate the quantity visible (e.g. number of bags/boxes visible, or default to 1).
   - Set unit_price: 0 and line_total: 0 so the baker can confirm the cost paid.
   - Match against the inventory list if possible.

Classification:
- ALWAYS extract every item with type: "purchase". All scanned lines default strictly to "Link to Inventory".
- NEVER classify items as "expense" or "Miscellaneous"; linking to expense is done manually by the user if needed.

Receipt Date Instruction:
- In Nigeria, dates are written as Day/Month/Year (DD/MM/YYYY).
- ALWAYS return "receipt_date" in "DD/MM/YYYY" format (e.g. 08/09/2026).
- If day or month is a single digit, pad with leading zero (e.g. 05/09/2026).
- If the date is missing, illegible, or unclear, use today's date in "DD/MM/YYYY" format.

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
  "receipt_date": "DD/MM/YYYY",
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
      ], "You are an expert vision AI for Nigerian bakery operations. Extract all purchased items, ingredients, supplies, or expenses from any receipt, handwritten slip, payment screenshot, or photo of physical stock. Always return valid JSON only.", 4000, { creditCost: 2, feature: "receipt_scanner" })

      const result = extractAndRepairJson(raw)
      const rawItems = result && (
        Array.isArray(result.items) ? result.items :
          Array.isArray(result.purchases) ? result.purchases :
            Array.isArray(result.data) ? result.data :
              Array.isArray(result.receipt_items) ? result.receipt_items : null
      )

      if (!result || !rawItems || rawItems.length === 0) {
        if (typeof refundScanCredits === "function") {
          try {
            await refundScanCredits(2, "Failed receipt scan: no readable items detected")
            setRefundNotice("Scan could not read items. 2 credits refunded automatically.")
          } catch (_) {}
        }

        const notes = result?.scan_notes || "Could not clearly detect any items, ingredients, or text in this image. Please ensure the receipt or items are well lit and in focus."
        setError(notes)
        setParsed({
          supplier: result?.supplier || "",
          receipt_date: formatDateDMY(result?.receipt_date) || todayDMY(),
          scan_notes: notes,
          items: [
            { item_on_receipt: "", qty: 1, unit: "kg", unit_size: 1, unit_price: 0, line_total: 0, type: "purchase", overrideId: "", category: "Other", approved: true, confidence: "high" }
          ]
        })
        setTotalAmount("")
      } else {
        const normalizedItems = rawItems.map(normalizeItem)
        // Auto-match items against inventory using intelligent matching
        const matchedItems = normalizedItems.map(item => {
          if (item.type === "purchase") {
            const hasValidOverride = item.overrideId && inventory.some(i => i.id === item.overrideId)
            if (!hasValidOverride) {
              const matchedId = matchItemToInventory(item.item_on_receipt, inventory, aliases)
              if (matchedId) {
                const invItem = inventory.find(i => i.id === matchedId)
                return {
                  ...item,
                  overrideId: matchedId,
                  approved: true,
                  unit: invItem?.unit ? invItem.unit : item.unit
                }
              } else {
                return { ...item, overrideId: "" }
              }
            } else if (hasValidOverride) {
              const invItem = inventory.find(i => i.id === item.overrideId)
              if (invItem?.unit) {
                return { ...item, unit: invItem.unit }
              }
            }
          }
          return item
        })

        setParsed({
          supplier: result.supplier || "",
          receipt_date: formatDateDMY(result.receipt_date) || todayDMY(),
          ...result,
          items: matchedItems
        })
        if (result.receipt_total) setTotalAmount(String(result.receipt_total))
      }
    } catch (err) {
      if (!err.message?.includes("DAILY_AI_CEILING_REACHED") && !err.message?.includes("Insufficient")) {
        if (typeof refundScanCredits === "function") {
          try {
            await refundScanCredits(2, `Failed receipt scan: ${err.message}`)
            setRefundNotice("Scan failed. 2 credits refunded automatically.")
          } catch (_) {}
        }
      }
      setError(`Could not read receipt: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  // Trigger Manual Entry mode
  const startManualEntry = () => {
    setParsed({
      supplier: "",
      receipt_date: todayDMY(),
      items: [
        { item_on_receipt: "", qty: 1, unit: "kg", unit_size: 1, unit_price: 0, line_total: 0, type: "purchase", overrideId: "", category: "Other", approved: true, confidence: "high" }
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
            updatedRow.category = updatedRow.category && updatedRow.category !== "Other" ? updatedRow.category : "Utilities"
          } else {
            updatedRow.category = "Other"
            // When selecting "Link to Inventory", automatically match item to inventory
            const matchedId = matchItemToInventory(updatedRow.item_on_receipt, inventory, aliases)
            if (matchedId) {
              updatedRow.overrideId = matchedId
              updatedRow.approved = true
              const invItem = inventory.find(item => item.id === matchedId)
              if (invItem?.unit) {
                updatedRow.unit = invItem.unit
              }
            } else {
              updatedRow.overrideId = ""
            }
          }
        }

        if (field === "item_on_receipt") {
          const detected = detectUnitAndSize(val, r.unit, r.unit_size)
          if (detected.unit && (!r.unit || r.unit === "Other" || r.unit === "unit" || r.unit === "pack" || ["kg", "g", "l", "ml", "cl", "pcs", "crate"].includes(detected.unit))) {
            updatedRow.unit = detected.unit
            if (detected.unit_size > 1 && (!r.unit_size || r.unit_size === 1)) {
              updatedRow.unit_size = detected.unit_size
            }
          }
          if (updatedRow.type === "purchase") {
            const matchedId = matchItemToInventory(val, inventory, aliases)
            updatedRow.overrideId = matchedId || ""
            if (matchedId) {
              const invItem = inventory.find(item => item.id === matchedId)
              if (invItem?.unit) {
                updatedRow.unit = invItem.unit
              }
            }
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

  // 1-click batch link all items to inventory
  const linkAllToInventory = () => {
    setParsed(p => {
      if (!p || !p.items) return p
      return {
        ...p,
        items: p.items.map(item => {
          const matchedId = matchItemToInventory(item.item_on_receipt, inventory, aliases)
          const targetId = matchedId || item.overrideId
          const invItem = inventory.find(i => i.id === targetId)
          return {
            ...item,
            type: "purchase",
            category: item.category && item.category !== "Miscellaneous" ? item.category : "Other",
            overrideId: targetId || "",
            unit: invItem?.unit ? invItem.unit : item.unit,
            approved: matchedId ? true : item.approved
          }
        })
      }
    })
  }

  const addBlankRow = () => {
    setParsed(p => ({
      ...p,
      items: [
        ...p.items,
        { item_on_receipt: "", qty: 1, unit: "kg", unit_size: 1, unit_price: 0, line_total: 0, type: "purchase", overrideId: "", category: "Other", approved: true, confidence: "high" }
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
        const invItem = inventory.find(item => item.id === id)
        return {
          ...r,
          overrideId: id,
          approved: true,
          unit: invItem?.unit ? invItem.unit : r.unit
        }
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
      // Only rows where the user explicitly selected "expense" are expenses; everything else belongs to Purchases
      const purchases = approved.filter(r => r.type !== "expense")

      // Update inventory: stock + cost/unit for purchases
      let updInv = [...inventory]
      const purchaseLog = []

      purchases.forEach(r => {
        let invItem = updInv.find(i => i.id === r.overrideId)
        const unitSize = +r.unit_size || +r.qty || 1
        const cpu = parseFloat(((+r.unit_price || +r.line_total || 0) / unitSize).toFixed(2))
        const stockAdded = parseFloat((unitSize * (+r.qty || 1)).toFixed(3))
        const itemName = (r.item_on_receipt || "").trim() || (invItem ? invItem.name : (parsed.supplier ? `${parsed.supplier} Item` : "Ingredient"))

        // If item not yet in inventory, auto-create it under "Other" category
        if (!invItem && itemName) {
          const detected = detectUnitAndSize(itemName, r.unit, unitSize)
          const effUnit = r.unit || detected.unit || "kg"
          const newId = uid()
          invItem = {
            id: newId,
            name: itemName,
            cat: r.category && r.category !== "Miscellaneous" ? r.category : "Other",
            unit: effUnit,
            cost: cpu || 0,
            stock: stockAdded,
            minStock: 5
          }
          updInv.push(invItem)
          r.overrideId = newId
        } else if (invItem) {
          updInv = updInv.map(i => i.id === r.overrideId ? { ...i, cost: cpu || i.cost, stock: parseFloat((i.stock + stockAdded).toFixed(3)) } : i)
        }

        const lineTotal = +r.line_total || (+r.unit_price ? +r.unit_price * (+r.qty || 1) : 0)
        purchaseLog.push({
          id: uid(),
          date: receiptDate,
          supplier: parsed.supplier || "Market Run",
          itemId: invItem ? invItem.id : null,
          item: invItem ? invItem.name : itemName,
          category: invItem?.cat || (r.category && r.category !== "Miscellaneous" ? r.category : "Other"),
          unit: invItem?.unit || r.unit || "kg",
          unitSize,
          qty: +r.qty || 1,
          price: +r.unit_price || lineTotal,
          total: lineTotal,
          cpu,
          stockAdded
        })
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
        const existing = (typeof loadLocal === "function" ? loadLocal("ll_purchases", []) : []) || []
        const allPurchases = [...purchaseLog, ...existing]
        if (typeof savePurchases === "function") {
          await savePurchases(allPurchases)
        } else {
          await saveLocal("ll_purchases", allPurchases)
        }
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("layerledger:purchases-updated", { detail: { purchases: allPurchases, month: monthStr } }))
        }
      }

      // Log expense records grouped by category
      const totalCalc = parsed.items.reduce((s, r) => s + (r.approved ? (+r.line_total || 0) : 0), 0)
      const amt = +totalAmount || totalCalc
      let newExps = []
      if (amt > 0) {
        const categoriesMap = {}
        approved.forEach(r => {
          let cat = "Other"
          let source = "receipt"
          if (r.type === "purchase") {
            cat = "Ingredients / Supplies"
            source = "purchase"
          } else {
            cat = r.category || "Miscellaneous"
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
        }
      }

      // Compute post-scan changes to inventory & recipe costs
      const allRecipes = (typeof loadLocal === "function" ? loadLocal("ll_recipes", []) : []) || []
      const affectedInv = []
      const affectedRec = []

      updInv.forEach(newItem => {
        const oldItem = inventory.find(i => i.id === newItem.id)
        if (!oldItem) {
          affectedInv.push({
            name: newItem.name,
            unit: newItem.unit,
            stockChange: `+${newItem.stock} ${newItem.unit} (New item)`,
            newStock: `${newItem.stock} ${newItem.unit}`,
            costChange: newItem.cost > 0 ? `₦${Number(newItem.cost).toLocaleString()} / ${newItem.unit}` : null
          })
        } else {
          const stockDelta = newItem.stock - oldItem.stock
          const costMoved = newItem.cost !== oldItem.cost
          if (stockDelta !== 0 || costMoved) {
            affectedInv.push({
              name: newItem.name,
              unit: newItem.unit,
              stockChange: stockDelta > 0 ? `+${stockDelta.toFixed(1)} ${newItem.unit}` : `${stockDelta.toFixed(1)} ${newItem.unit}`,
              newStock: `${newItem.stock} ${newItem.unit}`,
              costChange: costMoved ? `₦${Number(oldItem.cost).toLocaleString()} → ₦${Number(newItem.cost).toLocaleString()} / ${newItem.unit}` : null
            })
          }
        }
      })

      allRecipes.forEach(r => {
        const oldCost = recipeCost(r, inventory)
        const newCost = recipeCost(r, updInv)
        if (oldCost !== newCost) {
          const delta = newCost - oldCost
          affectedRec.push({
            id: r.id,
            name: r.name,
            oldCost,
            newCost,
            delta
          })
        }
      })

      setImpactSummary({
        inventoryUpdates: affectedInv,
        recipeUpdates: affectedRec
      })

      sessionStorage.setItem("ll_active_purchases_month", monthStr)
      setSavedMonth(monthStr)
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
    const detected = detectUnitAndSize(row.item_on_receipt, row.unit, row.unit_size)
    const effUnit = row.unit || detected.unit || "kg"
    const unitSize = Number(row.unit_size) || detected.unit_size || 1
    const costPerUnit = Number(row.unit_price) ? parseFloat((Number(row.unit_price) / unitSize).toFixed(2)) : ""
    const stockQty = parseFloat((unitSize * (Number(row.qty) || 1)).toFixed(3))

    setNewFields({
      name: row.item_on_receipt || "",
      cat: row.category && row.category !== "Miscellaneous" ? row.category : "Other",
      unit: effUnit,
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
      minStock: newFields.minStock !== "" && !isNaN(Number(newFields.minStock)) ? Number(newFields.minStock) : 5
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

          {/* Pre-Action Credit & Cost Transparency Notice (Section 6: Balance and cost shown before every action) */}
          <div style={{
            background: balance >= 2 ? "rgba(200,145,42,0.07)" : "#FFF4E5",
            border: balance >= 2 ? "1px solid rgba(200,145,42,0.2)" : "1px solid #FFE0B2",
            borderRadius: 8,
            padding: "10px 14px",
            marginBottom: 12
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", display: "flex", alignItems: "center", gap: 5 }}>
                <Coins size={14} color="var(--gold)" />
                <span>Scan Cost: <strong style={{ color: "var(--gold)" }}>2 Credits</strong> (1 receipt scan)</span>
              </span>
              <span style={{ fontSize: 11.5, color: balance >= 2 ? "#27AE60" : "#D97706", fontWeight: 700 }}>
                Balance: {Number(balance).toFixed(1)} Credits
              </span>
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>Balance after this scan: <strong>{balance >= 2 ? (balance - 2).toFixed(1) : 0} credits</strong></span>
              <span>Credits never expire</span>
            </div>
          </div>

          {/* Automatic Refund Notification if scan failed */}
          {refundNotice && (
            <div style={{ background: "#EEF8F3", border: "1px solid #C2E0CF", borderRadius: 8, padding: "8px 12px", marginBottom: 12, fontSize: 12.5, color: "#2D7A50", display: "flex", alignItems: "center", gap: 6 }}>
              <Check size={15} color="#2D7A50" />
              <span>{refundNotice}</span>
            </div>
          )}

          {photo && !parsed && !saved && (
            <>
              <Btn
                full
                onClick={scan}
                disabled={loading}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  background: balance >= 2 ? "var(--gold)" : "#9E9E9E",
                  color: "#fff"
                }}
              >
                {loading ? "AI is reading the receipt…" : (
                  balance >= 2 ? (
                    <><Sparkles size={14} /> Scan & Extract Items <span style={{ fontSize: 11, opacity: 0.9, fontWeight: 500 }}>(2 credits)</span></>
                  ) : (
                    <>Insufficient Credits (2 needed, {Number(balance).toFixed(1)} available)</>
                  )
                )}
              </Btn>
              {balance < 2 && (
                <div style={{ textAlign: "center", marginTop: 6 }}>
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof window !== "undefined") {
                        window.dispatchEvent(new CustomEvent("bakewealth:insufficient-tokens", { detail: { requiredTokens: 2, requiredCredits: 2 } }))
                        window.dispatchEvent(new CustomEvent("layerledger:insufficient-tokens", { detail: { requiredTokens: 2, requiredCredits: 2 } }))
                      }
                    }}
                    style={{ background: "none", border: "none", color: "var(--gold)", fontSize: 12, fontWeight: 600, cursor: "pointer", textDecoration: "underline" }}
                  >
                    Top up credit pack or renew plan →
                  </button>
                </div>
              )}
              {loading && <div style={{ fontSize: 12, color: "var(--muted)", textAlign: "center", marginTop: 8 }}>This may take 15-30 seconds…</div>}
              {error && (
                <div style={{ marginTop: 10, padding: "8px 12px", background: (error.toLowerCase().includes("token") || error.toLowerCase().includes("credit")) ? "#FFF4E5" : "#FDEBE9", border: (error.toLowerCase().includes("token") || error.toLowerCase().includes("credit")) ? "1px solid #FFE0B2" : "1px solid #FCDAD7", borderRadius: 8, fontSize: 12.5, color: (error.toLowerCase().includes("token") || error.toLowerCase().includes("credit")) ? "#92400E" : "#B03A2E", lineHeight: 1.5, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <AlertTriangle size={14} color={(error.toLowerCase().includes("token") || error.toLowerCase().includes("credit")) ? "#D97706" : "#B03A2E"} style={{ flexShrink: 0 }} />
                    <span>{error}</span>
                  </div>
                  {(error.toLowerCase().includes("token") || error.toLowerCase().includes("credit")) && (
                    <button
                      type="button"
                      onClick={() => {
                        if (typeof window !== "undefined") {
                          window.dispatchEvent(new CustomEvent("bakewealth:insufficient-tokens", { detail: { requiredTokens: 2, requiredCredits: 2 } }))
                          window.dispatchEvent(new CustomEvent("layerledger:insufficient-tokens", { detail: { requiredTokens: 2, requiredCredits: 2 } }))
                          window.dispatchEvent(new CustomEvent("layerledger:insufficient-credits", { detail: { requiredTokens: 2, requiredCredits: 2 } }))
                        }
                      }}
                      style={{ background: "var(--gold)", color: "#fff", border: "none", borderRadius: 6, padding: "3px 8px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
                    >
                      Buy Credits
                    </button>
                  )}
                </div>
              )}
            </>
          )}

          {saved && (
            <div style={{ background: "#EEF8F3", borderRadius: 10, padding: 16, border: "1px solid #C2E0CF", marginBottom: 14 }}>
              <div style={{ fontWeight: 700, color: "#357A52", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                <Check size={18} /> Saved! Purchases and stock levels updated for {savedMonth}.
              </div>
              <div style={{ fontSize: 12, color: "#2E6944", marginBottom: 10, lineHeight: 1.5 }}>
                Purchases have been logged to the {savedMonth} ledger and reflected in your inventory and recipe costs.
              </div>

              {/* Visibly show what changed after each scan: inventory items and recipe costs */}
              {impactSummary && (
                <div style={{ marginTop: 10, background: "#fff", borderRadius: 8, padding: 12, border: "1px solid #D2E7DA" }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: "#2D7A50", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
                    Post-Scan Impact Summary
                  </div>

                  {impactSummary.inventoryUpdates?.length > 0 && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", marginBottom: 4 }}>
                        Updated Inventory Items ({impactSummary.inventoryUpdates.length}):
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {impactSummary.inventoryUpdates.map((item, idx) => (
                          <div key={idx} style={{ fontSize: 12, color: "var(--text)", display: "flex", justifyContent: "space-between", background: "#FAF7F0", padding: "5px 8px", borderRadius: 5 }}>
                            <span style={{ fontWeight: 600 }}>{item.name}</span>
                            <span style={{ color: "#27AE60", fontWeight: 600 }}>
                              {item.stockChange} {item.costChange ? `• ${item.costChange}` : ""}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {impactSummary.recipeUpdates?.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", marginBottom: 4 }}>
                        Recipe Costs Moved ({impactSummary.recipeUpdates.length}):
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {impactSummary.recipeUpdates.map((rec) => (
                          <div key={rec.id} style={{ fontSize: 12, color: "var(--text)", display: "flex", justifyContent: "space-between", background: "#FAF7F0", padding: "5px 8px", borderRadius: 5 }}>
                            <span style={{ fontWeight: 600 }}>{rec.name}</span>
                            <span style={{ color: rec.delta > 0 ? "#D97706" : "#27AE60", fontWeight: 700 }}>
                              ₦{Math.round(rec.oldCost).toLocaleString()} → ₦{Math.round(rec.newCost).toLocaleString()} ({rec.delta > 0 ? `+₦${Math.round(rec.delta).toLocaleString()}` : `-₦${Math.round(Math.abs(rec.delta)).toLocaleString()}`})
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(!impactSummary.inventoryUpdates || impactSummary.inventoryUpdates.length === 0) &&
                    (!impactSummary.recipeUpdates || impactSummary.recipeUpdates.length === 0) && (
                    <div style={{ fontSize: 11.5, color: "var(--muted)" }}>
                      Purchases recorded to expense ledger without direct ingredient stock overrides.
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 12 }}>
                <Btn small variant="outline" onClick={() => setSaved(false)}>Log Another</Btn>
                {setView && (
                  <Btn
                    small
                    onClick={() => {
                      sessionStorage.setItem("ll_active_purchases_month", savedMonth)
                      setView("purchases")
                    }}
                    style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                  >
                    View in Purchases ({savedMonth}) →
                  </Btn>
                )}
              </div>
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
                <Btn small variant="outline" onClick={linkAllToInventory} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <Sparkles size={13} color="var(--gold)" /> Link to Inventory
                </Btn>
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
              <div style={{ marginBottom: 13 }}>
                <label style={{ display: "block", fontSize: 11.5, color: "var(--muted)", fontWeight: 500, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Purchase Date (DD/MM/YYYY)
                </label>
                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                  <input
                    data-testid="inp-Purchase Date"
                    type="text"
                    placeholder="DD/MM/YYYY"
                    value={parsed.receipt_date || ""}
                    onChange={e => setParsed({ ...parsed, receipt_date: e.target.value })}
                    style={{ ...iSt, paddingRight: 36 }}
                  />
                  <input
                    type="date"
                    tabIndex={-1}
                    value={normalizeToIsoDate(parsed.receipt_date)}
                    onChange={e => {
                      if (e.target.value) {
                        setParsed({ ...parsed, receipt_date: formatDateDMY(e.target.value) })
                      }
                    }}
                    style={{
                      position: "absolute",
                      right: 8,
                      width: 24,
                      height: 24,
                      opacity: 0,
                      cursor: "pointer",
                      zIndex: 2
                    }}
                    title="Pick date from calendar"
                  />
                  <span style={{ position: "absolute", right: 10, pointerEvents: "none", fontSize: 14 }}>
                    📅
                  </span>
                </div>
              </div>
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
                        <input placeholder="Unit (kg, g, L...)" value={r.unit || ""} onChange={e => updateRow(idx, "unit", e.target.value)} style={{ ...iSt, padding: "4px 6px", fontSize: 12 }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 9.5, color: "var(--muted)" }}>Pack/Unit size</label>
                        <input placeholder="Pack size" type="number" value={r.unit_size || ""} onChange={e => updateRow(idx, "unit_size", e.target.value)} style={{ ...iSt, padding: "4px 6px", fontSize: 12 }} />
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
                        <option value="purchase">Link to Inventory</option>
                        <option value="expense">Link to Expense</option>
                      </select>

                      {/* Render based on selection */}
                      {r.type === "purchase" ? (
                        <div style={{ display: "flex", gap: 6, alignItems: "center", flex: 1, minWidth: 200, flexWrap: "wrap" }}>
                          <select
                            value={r.overrideId || ""}
                            onChange={e => setMatch(idx, e.target.value)}
                            style={{
                              ...iSt,
                              fontSize: 12,
                              padding: "5px 8px",
                              flex: 1,
                              minWidth: 160,
                              borderColor: r.overrideId ? "#357A52" : "var(--border)",
                              background: r.overrideId ? "#F0FDF4" : "var(--bg)",
                              color: r.overrideId ? "#166534" : "var(--text)"
                            }}
                          >
                            <option value="">New Item (Category: Other)</option>
                            {inventory.map(i => (
                              <option key={i.id} value={i.id}>{i.name} ({i.unit}) | stock: {i.stock}</option>
                            ))}
                          </select>
                          {!r.overrideId ? (
                            <Btn small variant="outline" onClick={() => openNewItemModal(idx)}>+ Add As New</Btn>
                          ) : (
                            <span style={{ fontSize: 11, color: "#166534", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 3 }}>
                              <Check size={12} /> Linked
                            </span>
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
              <Inp label="Starting Inventory Qty" type="number" step="any" min="0" value={newFields.stock} onChange={v => setNewFields({ ...newFields, stock: v })} />
              <Inp label="Min Stock Level Alert" type="number" step="any" min="0" value={newFields.minStock} onChange={v => setNewFields({ ...newFields, minStock: v })} placeholder="e.g. 0.5" />
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
