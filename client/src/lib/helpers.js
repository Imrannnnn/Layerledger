/**
 * lib/helpers.js
 * ----------------------------------------------------------------------------
 * Small reusable utility functions used across the whole app:
 *   - fmt()          format a number as Naira currency, e.g. ₦12,500
 *   - uid()          generate a short unique id for new records
 *   - today()        today's date as YYYY-MM-DD
 *   - recipeCost()   total ingredient cost of a recipe
 *   - calcFullCost() recipe cost + flavour/decoration extras + accessory %
 *   - callClaude()   send a request to the AI proxy (receipt scanning, etc.)
 *   - compressImage() shrink a photo before sending it to the AI
 *   - parseCSV()     flexible CSV parser for bulk inventory import
 *   - mapCategory()   categorizes inventory item by category/name
 * ----------------------------------------------------------------------------
 */
import * as XLSX from "xlsx"
import { FLAVOR_EXTRAS, DECORATION_ITEMS } from "../constants.js"
import { getAuthHeaders, loadLocal, saveLocal } from "./data.js"

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
]

export const SPECIAL_DATE_TYPES = [
  { value: "Birthday", label: "Birthday", iconName: "Cake" },
  { value: "Anniversary", label: "Anniversary", iconName: "Heart" }
]

export const parseSpecialDate = (rawStr = "") => {
  if (!rawStr || typeof rawStr !== "string") {
    return { type: "Birthday", month: "", day: "", formatted: "", fullText: "", iconName: "Cake" }
  }
  const str = rawStr.trim()
  const isAnniv = str.toLowerCase().includes("anniversary")
  const type = isAnniv ? "Anniversary" : "Birthday"
  const iconName = isAnniv ? "Heart" : "Cake"
  const month = MONTHS.find(m => str.toLowerCase().includes(m.toLowerCase())) || ""
  const dayMatch = str.match(/\b([1-9]|[12][0-9]|3[01])\b/)
  const day = dayMatch ? dayMatch[1] : ""
  const formatted = day && month ? `${day} ${month}` : (month || day || "")
  const fullText = formatted ? `${type}: ${formatted}` : ""
  return { type, month, day, formatted, fullText, iconName }
}

export const formatSpecialDate = (type = "Birthday", day = "", month = "") => {
  const d = String(day || "").trim()
  const m = String(month || "").trim()
  const safeType = type === "Anniversary" ? "Anniversary" : "Birthday"
  if (!d && !m) return `${safeType}:`
  const datePart = d && m ? `${d} ${m}` : (d || m)
  return `${safeType}: ${datePart}`
}

export const DEFAULT_CATEGORIES = [
  "Dry Goods",
  "Dairy and Fats",
  "Flavours and Extracts",
  "Edible Items",
  "Decoration Extras",
  "Board and Packaging",
  "Other"
]

export const mapCategory = (cat, name = "") => {
  const rawCat = (cat || "").trim()
  if (rawCat === "Decoration Extras" || rawCat === "Decoration" || rawCat === "Decorations") return "Decoration Extras"
  if (rawCat === "Board and Packaging" || rawCat === "Packaging") return "Board and Packaging"
  if (rawCat === "Dry Goods") return "Dry Goods"
  if (rawCat === "Dairy and Fats" || rawCat === "Dairy" || rawCat === "Fats & Oils") return "Dairy and Fats"
  if (rawCat === "Flavours and Extracts" || rawCat === "Flavoring") return "Flavours and Extracts"
  if (rawCat === "Edible Items" || rawCat === "Edible") return "Edible Items"
  if (rawCat === "Other") return "Other"
  if (rawCat.length > 0) return rawCat

  const c = (name || "").toLowerCase()
  if (c.includes("decor") || c.includes("finish") || c.includes("flower") || c.includes("topper") || c.includes("ribbon")) return "Decoration Extras"
  if (c.includes("packaging") || c.includes("board") || c.includes("box") || c.includes("dowel") || c.includes("drum")) return "Board and Packaging"
  if (c.includes("dry") || c.includes("chocolate") || c.includes("flour") || c.includes("sugar")) return "Dry Goods"
  if (c.includes("dairy") || c.includes("fat") || c.includes("oil") || c.includes("butter") || c.includes("margarine") || c.includes("egg")) return "Dairy and Fats"
  if (c.includes("flavor") || c.includes("extract") || c.includes("color") || c.includes("essence")) return "Flavours and Extracts"
  if (c.includes("edible") || c.includes("sprinkle") || c.includes("candy") || c.includes("wafer") || c.includes("fondant")) return "Edible Items"
  return "Other"
}



export const fmt = n => `₦${Math.round(n || 0).toLocaleString("en")}`
export const fmtCost = n => {
  if (typeof n === "string") {
    n = n.replace(",", ".")
  }
  const num = Number(n) || 0
  if (num % 1 !== 0) {
    return `₦${num.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`
  }
  return fmt(num)
}
export const fmtQty = n => {
  if (n === "" || n === undefined || n === null) return 0
  const num = typeof n === "string" ? parseFloat(n.replace(",", ".")) : Number(n)
  if (isNaN(num)) return 0
  if (num % 1 !== 0) {
    return parseFloat(num.toFixed(4))
  }
  return num
}
export const uid = () => "_" + Math.random().toString(36).slice(2, 9)
export const today = () => new Date().toISOString().slice(0, 10)

// Normalizes various date formats (DD/MM/YYYY, YYYY/MM/DD, natural text) to ISO YYYY-MM-DD
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
    // Already DD/MM/YYYY or DD-MM-YYYY
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
    // YYYY/MM/DD
    const ymdMatch = trimmed.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/)
    if (ymdMatch) {
      const [, y, m, d] = ymdMatch
      return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`
    }
    // Try Date parsing
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

export function isDateInMonth(dateStr, monthStr) {
  if (!dateStr || !monthStr) return false
  const iso = normalizeToIsoDate(dateStr)
  return iso.startsWith(monthStr.trim())
}

export function getMonthKeyFromDate(dateStr) {
  if (!dateStr) return ""
  const iso = normalizeToIsoDate(dateStr)
  return iso.slice(0, 7)
}

export const recipeCost = (r, inv) => !r ? 0 : r.ing.reduce((s, i) => { const it = inv.find(x => x.id === i.iid); return s + (it ? it.cost * i.qty : 0) }, 0)

export const calcFullCost = (recipe, inv, flavors, decorationIds, accessoryPct, miscPct = 0) => {
  if (!recipe) return 0
  let cost = recipeCost(recipe, inv)
  // flavor extras
  const fl = (flavors || "").toLowerCase().split(/[,+&]/).map(f => f.trim()).filter(Boolean)
  fl.forEach(f => (FLAVOR_EXTRAS[f] || []).forEach(e => { const it = inv.find(x => x.id === e.iid); if (it) cost += it.cost * e.qty }))
  // decoration extras
  const localDecors = loadLocal("ll_decorations", null)
  const storedDecorations = (Array.isArray(localDecors) && localDecors.length > 0) ? localDecors : DECORATION_ITEMS
    ; (decorationIds || []).forEach(did => {
      const decor = storedDecorations.find(d => d.id === did) || DECORATION_ITEMS.find(d => d.id === did)
      if (decor) { const it = inv.find(x => x.id === decor.iid); if (it) cost += it.cost * decor.qty }
    })

  return cost * (1 + (accessoryPct || 10) / 100 + (miscPct || 0) / 100)
}



export async function callClaude(messages, system = "", maxTokens = 4000, options = {}) {
  const creditCost = typeof options === "number" ? options : (Number(options?.creditCost) || (options?.feature === "bank_statement" ? 5 : 2))
  const feature = typeof options === "object" ? options?.feature : undefined

  const tenantInfo = typeof loadLocal === "function" ? loadLocal("ll_tenant_info", null) : null
  if (tenantInfo && typeof tenantInfo.tokenBalance === "number" && tenantInfo.tokenBalance < creditCost) {
    if (typeof window !== "undefined") {
      const detail = {
        currentBalance: tenantInfo.tokenBalance,
        requiredTokens: creditCost,
        requiredCredits: creditCost,
        message: `You need at least ${creditCost} credits to use this AI feature. You currently have ${tenantInfo.tokenBalance.toFixed(1)} credits. Please buy credits to continue.`
      }
      window.dispatchEvent(new CustomEvent("bakewealth:insufficient-tokens", { detail }))
      window.dispatchEvent(new CustomEvent("layerledger:insufficient-tokens", { detail }))
      window.dispatchEvent(new CustomEvent("layerledger:insufficient-credits", { detail }))
    }
    throw new Error(`Insufficient credits: You have ${tenantInfo.tokenBalance.toFixed(1)} credits remaining. Each AI feature requires ${creditCost} credits. Please buy credits to continue.`)
  }

  const headers = getAuthHeaders() || {}
  const apiUrl = import.meta.env.VITE_API_URL || ""
  const endpoint = `${apiUrl}/api/claude`

  let res;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: maxTokens || 4000,
        system,
        messages,
        creditCost,
        feature
      })
    })
  } catch (netErr) {
    throw new Error(`Network connection to AI proxy failed. (Error: ${netErr.message}). Please verify the backend is running and accessible at: ${endpoint}`)
  }

  const text = await res.text()
  if (!res.ok) {
    let errMsg = ""
    let errJson = null
    try {
      if (text && text.trim()) {
        errJson = JSON.parse(text)
        errMsg = errJson.error?.message || errJson.message || errJson.error || ""
        if (errJson.error?.type === "not_found_error") {
          errMsg = `Anthropic API error: Model not found (${errMsg}). This usually means your Anthropic account has no credits/funds left or billing is inactive. Please fund your account in the Anthropic Console.`
        }
      }
    } catch {
      // Ignore JSON parse errors and fallback to status checks
    }

    if (res.status === 402 || errJson?.code === "INSUFFICIENT_CREDITS" || errJson?.code === "INSUFFICIENT_TOKENS" || (errMsg && (errMsg.toLowerCase().includes("insufficient token") || errMsg.toLowerCase().includes("insufficient credit")))) {
      const balance = errJson?.currentBalance ?? tenantInfo?.tokenBalance ?? 0
      const required = errJson?.requiredCredits ?? errJson?.requiredTokens ?? creditCost
      if (tenantInfo && typeof saveLocal === "function") {
        saveLocal("ll_tenant_info", { ...tenantInfo, tokenBalance: balance })
      }
      if (typeof window !== "undefined") {
        const detail = {
          currentBalance: balance,
          requiredTokens: required,
          requiredCredits: required,
          message: errMsg || `You need at least ${required} credits to use this AI feature. Please buy credits to continue.`
        }
        window.dispatchEvent(new CustomEvent("bakewealth:insufficient-tokens", { detail }))
        window.dispatchEvent(new CustomEvent("layerledger:insufficient-tokens", { detail }))
        window.dispatchEvent(new CustomEvent("layerledger:insufficient-credits", { detail }))
      }
      throw new Error(errMsg || "Insufficient credits. Please buy credits to continue.")
    }

    if (errMsg) {
      throw new Error(errMsg)
    }

    if (res.status === 401 || res.status === 403) {
      throw new Error(`Authentication failed (${res.status}). Your session token may be invalid or expired. Please log out and log back in.`)
    }
    if (res.status === 404) {
      throw new Error(`AI proxy endpoint not found (404). Endpoint URL: ${endpoint}. Make sure the backend server is running and VITE_API_URL in the frontend environment is set correctly.`)
    }
    throw new Error(`API error (Status ${res.status}): ${text || "Unknown error"}`)
  }
  if (!text || !text.trim()) {
    throw new Error("No response from API.")
  }
  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error("Invalid API response: " + text.slice(0, 200))
  }
  if (data.error) {
    throw new Error("API error: " + (data.error.message || JSON.stringify(data.error)))
  }

  // Real-time credit balance update on successful deduction
  if (data.tokenUsage && typeof data.tokenUsage.newBalance === "number") {
    const curTenant = (typeof loadLocal === "function" ? loadLocal("ll_tenant_info", null) : null) || {}
    curTenant.tokenBalance = data.tokenUsage.newBalance
    if (typeof saveLocal === "function") {
      saveLocal("ll_tenant_info", curTenant)
    }
    if (typeof window !== "undefined") {
      const deducted = data.tokenUsage.creditsDeducted ?? data.tokenUsage.tokensDeducted ?? creditCost
      const detail = {
        tokenBalance: data.tokenUsage.newBalance,
        creditsDeducted: deducted,
        tokensDeducted: deducted
      }
      window.dispatchEvent(new CustomEvent("bakewealth:token-updated", { detail }))
      window.dispatchEvent(new CustomEvent("layerledger:token-updated", { detail }))
      window.dispatchEvent(new CustomEvent("layerledger:credit-updated", { detail }))
    }
  }

  if (Array.isArray(data.content)) {
    const textBlock = data.content.find(c => c.type === "text" && c.text)
    if (textBlock && textBlock.text) {
      return textBlock.text
    }
  }

  return data.content?.[0]?.text || data.text || ""
}

// Compress image before sending to API
export async function compressImage(base64, maxWidth = 1920, quality = 0.85, options = {}) {
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        const maxDim = Math.max(img.width, img.height)
        const scale = maxDim > maxWidth ? maxWidth / maxDim : 1
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        const ctx = canvas.getContext('2d')
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

        if (options.enhanceContrast) {
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const d = imgData.data
          const factor = 1.15
          for (let i = 0; i < d.length; i += 4) {
            d[i] = Math.min(255, Math.max(0, factor * (d[i] - 128) + 128 + 4))
            d[i + 1] = Math.min(255, Math.max(0, factor * (d[i + 1] - 128) + 128 + 4))
            d[i + 2] = Math.min(255, Math.max(0, factor * (d[i + 2] - 128) + 128 + 4))
          }
          ctx.putImageData(imgData, 0, 0)
        }

        resolve(canvas.toDataURL('image/jpeg', quality).split(',')[1])
      } catch {
        resolve(base64.replace(/^data:image\/[a-z]+;base64,/, ''))
      }
    }
    img.onerror = () => {
      resolve(base64.replace(/^data:image\/[a-z]+;base64,/, ''))
    }
    const cleanB64 = base64.replace(/^data:image\/[a-z]+;base64,/, '')
    img.src = base64.startsWith('data:') ? base64 : `data:image/jpeg;base64,${cleanB64}`
  })
}

// CSV parser — flexible column matching, handles BOM, semicolons, tabs
export function parseCSV(text) {
  const clean = text.replace(/^\uFEFF/, '').trim()
  const lines = clean.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return []
  const firstLine = lines[0]
  const delim = firstLine.includes(';') ? ';' : firstLine.includes('\t') ? '\t' : ','
  const headers = firstLine.split(delim).map(h => h.trim().toLowerCase().replace(/['"]/g, '').replace(/[^a-z0-9]/g, ' ').trim())

  const findCol = (row, ...keys) => {
    for (const k of keys) {
      const idx = headers.findIndex(h => h.includes(k))
      if (idx >= 0 && row[idx] !== undefined) return row[idx].trim().replace(/['"]/g, '')
    }
    return ''
  }

  const parseNum = (str, def = 0) => {
    if (!str) return def
    const trimmed = String(str).trim().replace(/[₦$]/g, '')
    if (trimmed.includes(',') && !trimmed.includes('.') && /^\d+,\d{1,4}$/.test(trimmed)) {
      return parseFloat(trimmed.replace(',', '.')) || def
    }
    return parseFloat(trimmed.replace(/,/g, '')) || def
  }

  const splitRow = (l, d) => {
    if (d === ';' || d === '\t') return l.split(d)
    const res = []
    let cur = ''
    let inQuotes = false
    for (let i = 0; i < l.length; i++) {
      const char = l[i]
      if (char === '"' || char === "'") {
        inQuotes = !inQuotes
      } else if (char === d && !inQuotes) {
        res.push(cur)
        cur = ''
      } else {
        cur += char
      }
    }
    res.push(cur)
    return res
  }

  return lines.slice(1).map(line => {
    const row = splitRow(line, delim)
    const name = findCol(row, 'name', 'item', 'ingredient', 'product', 'description')
    if (!name) return null
    return {
      id: uid(),
      name,
      cat: findCol(row, 'cat', 'category', 'type', 'group', 'class') || 'General',
      unit: findCol(row, 'unit', 'measure', 'uom', 'per') || 'kg',
      cost: parseNum(findCol(row, 'cost', 'price', 'rate', 'unit cost', 'price unit', 'price/unit', 'per unit'), 0),
      stock: parseNum(findCol(row, 'stock', 'quantity', 'qty', 'current stock', 'on hand', 'balance'), 0),
      minStock: parseNum(findCol(row, 'min', 'minimum', 'minstock', 'reorder', 'alert'), 2),
    }
  }).filter(Boolean).filter(i => i.name)
}

// Robust JSON extraction and repair for AI responses (receipts, stock sheets, invoices)
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
        .replace(/,\s*([\]}])/g, "$1")
      const res = JSON.parse(cleaned)
      return Array.isArray(res) ? { items: res } : res
    } catch {
      // Attempt 3: Quote unquoted keys
      try {
        let cleaned = str
          .replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "")
          .replace(/,\s*([\]}])/g, "$1")
          .replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":')
        const res = JSON.parse(cleaned)
        return Array.isArray(res) ? { items: res } : res
      } catch {
        // Attempt 4: Partial / Truncated JSON recovery
        try {
          if ((str.includes('"items"') || str.includes('"inventory"')) && !str.endsWith('}')) {
            const lastObjIdx = str.lastIndexOf('}')
            if (lastObjIdx !== -1) {
              let rescued = str.slice(0, lastObjIdx + 1)
              if (!rescued.includes(']')) rescued += ']'
              if (!rescued.endsWith('}')) rescued += '}'
              let cleaned = rescued
                .replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "")
                .replace(/,\s*([\]}])/g, "$1")
              const res = JSON.parse(cleaned)
              return Array.isArray(res) ? { items: res } : res
            }
          }
        } catch {
          // ignore
        }

        // Attempt 5: Fallback regex extraction of individual item objects
        try {
          const itemRegex = /\{[^{}]*?(?:"item_on_receipt"|"name")[^{}]*?\}/g
          const matches = str.match(itemRegex)
          if (matches && matches.length > 0) {
            const rescuedItems = []
            for (const m of matches) {
              try {
                const item = JSON.parse(m.replace(/,\s*([\]}])/g, "$1"))
                if (item) rescuedItems.push(item)
              } catch {
                // ignore
              }
            }
            if (rescuedItems.length > 0) {
              return { items: rescuedItems }
            }
          }
        } catch {
          // ignore
        }

        return null
      }
    }
  }
}

export { formatApiError, parseValidationMessage } from "./errorHandler.js"

/**
 * Automatically normalizes ingredient/stock quantities and costs to grams ('g').
 * For items measured in kg, lb, oz, mg, converts quantity to grams and adjusts unit cost to per-gram.
 * Non-mass units (pcs, ml, crate, etc.) retain their appropriate unit, or default to 'g' if empty.
 */
export function convertToGrams(qty, unit, cost) {
  const rawUnit = String(unit || "").toLowerCase().trim()
  const numericQty = parseFloat(qty) || 0
  const numericCost = parseFloat(cost) || 0

  if (rawUnit === "kg" || rawUnit === "kilogram" || rawUnit === "kilograms" || rawUnit === "kilo" || rawUnit === "kilos") {
    return {
      qty: Math.round(numericQty * 1000),
      unit: "g",
      cost: Number((numericCost / 1000).toFixed(4))
    }
  }

  if (rawUnit === "lb" || rawUnit === "lbs" || rawUnit === "pound" || rawUnit === "pounds") {
    return {
      qty: Math.round(numericQty * 453.592),
      unit: "g",
      cost: Number((numericCost / 453.592).toFixed(4))
    }
  }

  if (rawUnit === "oz" || rawUnit === "ounce" || rawUnit === "ounces") {
    return {
      qty: Math.round(numericQty * 28.3495),
      unit: "g",
      cost: Number((numericCost / 28.3495).toFixed(4))
    }
  }

  if (rawUnit === "mg" || rawUnit === "milligram" || rawUnit === "milligrams") {
    return {
      qty: numericQty / 1000,
      unit: "g",
      cost: Number((numericCost * 1000).toFixed(4))
    }
  }

  if (rawUnit === "g" || rawUnit === "gram" || rawUnit === "grams") {
    return {
      qty: numericQty,
      unit: "g",
      cost: numericCost
    }
  }

  // If unit is missing or undefined, default to 'g'
  if (!rawUnit) {
    return {
      qty: numericQty,
      unit: "g",
      cost: numericCost
    }
  }

  return {
    qty: numericQty,
    unit: unit,
    cost: numericCost
  }
}

/**
 * Parses an Excel (.xlsx, .xls) or CSV spreadsheet file into clean text format
 * suitable for feeding directly to Claude/LLM extraction.
 */
export async function parseExcelOrSpreadsheet(file) {
  if (!file) return ""
  const isCsv = file.name.toLowerCase().endsWith(".csv") || file.type === "text/csv"
  if (isCsv) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = ev => resolve(ev.target.result || "")
      reader.onerror = reject
      reader.readAsText(file)
    })
  }

  const arrayBuffer = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = ev => resolve(ev.target.result)
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })

  const workbook = XLSX.read(arrayBuffer, { type: "array" })
  let combinedCsv = ""
  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName]
    const csv = XLSX.utils.sheet_to_csv(worksheet)
    if (csv && csv.trim()) {
      combinedCsv += `\n--- SHEET: ${sheetName} ---\n` + csv
    }
  }
  return combinedCsv.trim()
}

/**
 * ─── COVERING & FILLING COVERAGE CALCULATION ENGINE ───
 * Technical Spec (BakeWealth 6 October 2026):
 * D = cake size in inches
 * L = layer count
 * H = height in inches = 2L
 *
 * Round:
 * gap_area      = (π · D² / 4) · (L − 1)
 * surface_area  = (π · D² / 4) + (π · D · H)
 * sheet_area    = (π / 4) · (D + 2H + overhang)²
 *
 * Square:
 * gap_area      = D² · (L − 1)
 * surface_area  = D² + (4 · D · H)
 * sheet_area    = (D + 2H + overhang)²
 */
export const COVERAGE_PRESETS = [
  {
    id: "buttercream",
    label: "Like buttercream",
    subtext: "Thick, holds its shape, spread with a knife",
    application: "spread",
    fill_rate: 3.00,
    crumb_rate: 1.64,
    cover_rate: 3.263,
    sheet_overhang_in: null
  },
  {
    id: "whipped_cream",
    label: "Light and airy",
    subtext: "Whipped cream, mousse. Weighs very little",
    application: "spread",
    fill_rate: 1.68,
    crumb_rate: 0,
    cover_rate: 1.344,
    sheet_overhang_in: null
  },
  {
    id: "dense_ganache",
    label: "Rich and dense",
    subtext: "Ganache, fudge. Heavier than buttercream",
    application: "spread",
    fill_rate: 2.90,
    crumb_rate: 1.50,
    cover_rate: 2.90,
    sheet_overhang_in: null
  },
  {
    id: "fondant",
    label: "Rolled out flat",
    subtext: "Fondant, marzipan. Draped over the cake",
    application: "rolled",
    fill_rate: null,
    crumb_rate: 0,
    cover_rate: 4.435,
    sheet_overhang_in: 2.4
  }
]

export function getRecipeCoverageValues(recipe) {
  if (!recipe) return {
    application: "spread",
    fill_rate: 3.00,
    crumb_rate: 1.64,
    cover_rate: 3.263,
    sheet_overhang_in: null,
    is_calibrated: false
  }

  const name = (recipe.name || "").toLowerCase()
  let defaultPreset = COVERAGE_PRESETS[0] // buttercream
  if (name.includes("fondant") || name.includes("marzipan") || recipe.application === "rolled") {
    defaultPreset = COVERAGE_PRESETS[3] // fondant
  } else if (name.includes("whipped") || name.includes("mousse")) {
    defaultPreset = COVERAGE_PRESETS[1] // whipped cream
  } else if (name.includes("ganache") || name.includes("fudge")) {
    defaultPreset = COVERAGE_PRESETS[2] // rich and dense
  }

  const application = recipe.application || defaultPreset.application || "spread"
  const fill_rate = recipe.fill_rate !== undefined && recipe.fill_rate !== null ? recipe.fill_rate : (recipe.fillRate !== undefined && recipe.fillRate !== null ? recipe.fillRate : (recipe.fill_rate === null || recipe.fillRate === null ? null : defaultPreset.fill_rate))
  const crumb_rate = recipe.crumb_rate !== undefined ? recipe.crumb_rate : (recipe.crumbRate !== undefined ? recipe.crumbRate : defaultPreset.crumb_rate)
  const cover_rate = recipe.cover_rate !== undefined && recipe.cover_rate !== null ? recipe.cover_rate : (recipe.coverRate !== undefined && recipe.coverRate !== null ? recipe.coverRate : (recipe.cover_rate === null || recipe.coverRate === null ? null : defaultPreset.cover_rate))
  const sheet_overhang_in = recipe.sheet_overhang_in !== undefined ? recipe.sheet_overhang_in : (recipe.sheetOverhangIn !== undefined ? recipe.sheetOverhangIn : defaultPreset.sheet_overhang_in)
  const is_calibrated = recipe.is_calibrated !== undefined ? !!recipe.is_calibrated : (recipe.isCalibrated !== undefined ? !!recipe.isCalibrated : false)

  return {
    application,
    fill_rate,
    crumb_rate,
    cover_rate,
    sheet_overhang_in,
    is_calibrated
  }
}

export function calculateCakeGeometry(sizeInches, layerCount = 1, shape = "Round", overhangInches = 0) {
  const D = Math.max(0, parseFloat(sizeInches) || 0)
  const L = Math.max(1, parseInt(layerCount, 10) || 1)
  const H = 2 * L
  const overhang = parseFloat(overhangInches) || 0
  const isSquare = String(shape || "").toLowerCase() === "square"

  let gap_area = 0
  let surface_area = 0
  let sheet_area = 0

  if (isSquare) {
    gap_area = (D * D) * (L - 1)
    surface_area = (D * D) + (4 * D * H)
    sheet_area = Math.pow(D + 2 * H + overhang, 2)
  } else {
    gap_area = ((Math.PI * D * D) / 4) * (L - 1)
    surface_area = ((Math.PI * D * D) / 4) + (Math.PI * D * H)
    sheet_area = (Math.PI / 4) * Math.pow(D + 2 * H + overhang, 2)
  }

  return { D, L, H, shape: isSquare ? "Square" : "Round", gap_area, surface_area, sheet_area }
}

export function calculateFillingGrams(recipe, geometry) {
  if (!recipe) return 0
  const cov = getRecipeCoverageValues(recipe)
  if (cov.fill_rate === null || cov.fill_rate === undefined) return 0
  const fill_rate = Number(cov.fill_rate) || 0
  const crumb_rate = Number(cov.crumb_rate) || 0
  return (fill_rate * geometry.gap_area) + (crumb_rate * geometry.surface_area)
}

export function calculateCoveringGrams(recipe, geometry) {
  if (!recipe) return 0
  const cov = getRecipeCoverageValues(recipe)
  if (cov.cover_rate === null || cov.cover_rate === undefined) return 0
  const cover_rate = Number(cov.cover_rate) || 0
  const targetArea = cov.application === "rolled" ? geometry.sheet_area : geometry.surface_area
  return cover_rate * targetArea
}

export function calibrateCoverageRates(recipe, { sizeInches = 10, layerCount = 2, shape = "Round", enteredGrams = 0 }) {
  const cov = getRecipeCoverageValues(recipe)
  const overhang = cov.application === "rolled" ? (Number(cov.sheet_overhang_in) || 2.4) : 0
  const geometry = calculateCakeGeometry(sizeInches, layerCount, shape, overhang)

  const fill_rate = cov.fill_rate !== null ? (Number(cov.fill_rate) || 0) : 0
  const crumb_rate = Number(cov.crumb_rate) || 0
  const cover_rate = cov.cover_rate !== null ? (Number(cov.cover_rate) || 0) : 0
  const cover_area = cov.application === "rolled" ? geometry.sheet_area : geometry.surface_area

  const baseline = (fill_rate * geometry.gap_area) + (crumb_rate * geometry.surface_area) + (cover_rate * cover_area)
  const g = Number(enteredGrams) || 0
  const scale = baseline > 0 && g > 0 ? (g / baseline) : 1

  return {
    baseline,
    scale,
    fill_rate: cov.fill_rate !== null ? fill_rate * scale : null,
    crumb_rate: crumb_rate * scale,
    cover_rate: cov.cover_rate !== null ? cover_rate * scale : null,
    is_calibrated: true
  }
}



