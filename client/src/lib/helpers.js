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
  const dmyMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`
  }

  // YYYY/MM/DD or YYYY-MM-DD
  const ymdMatch = trimmed.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/)
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
  } catch {}

  return today()
}

// Formats any date string (ISO, timestamp, or natural) into standard Nigerian DD/MM/YYYY format
export function formatDateDMY(inputDate) {
  if (!inputDate) return ""
  if (typeof inputDate === "string") {
    const trimmed = inputDate.trim()
    if (!trimmed) return ""
    // Already DD/MM/YYYY or DD-MM-YYYY
    const dmyMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
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
    } catch {}
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



export async function callClaude(messages, system = "", maxTokens = 4000) {
  const tenantInfo = typeof loadLocal === "function" ? loadLocal("ll_tenant_info", null) : null
  if (tenantInfo && typeof tenantInfo.tokenBalance === "number" && tenantInfo.tokenBalance < 0.7) {
    if (typeof window !== "undefined") {
      const detail = {
        currentBalance: tenantInfo.tokenBalance,
        requiredTokens: 0.7,
        message: `You need at least 0.7 tokens to use this AI feature. You currently have ${tenantInfo.tokenBalance.toFixed(1)} tokens. Please buy tokens to continue.`
      }
      window.dispatchEvent(new CustomEvent("bakewealth:insufficient-tokens", { detail }))
      window.dispatchEvent(new CustomEvent("layerledger:insufficient-tokens", { detail }))
    }
    throw new Error(`Insufficient tokens: You have ${tenantInfo.tokenBalance.toFixed(1)} tokens remaining. Each AI feature requires 0.7 tokens. Please buy tokens to continue.`)
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
        messages
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
    } catch (e) {
      // Ignore JSON parse errors and fallback to status checks
    }

    if (res.status === 402 || errJson?.code === "INSUFFICIENT_TOKENS" || (errMsg && errMsg.toLowerCase().includes("insufficient token"))) {
      const balance = errJson?.currentBalance ?? tenantInfo?.tokenBalance ?? 0
      if (tenantInfo && typeof saveLocal === "function") {
        saveLocal("ll_tenant_info", { ...tenantInfo, tokenBalance: balance })
      }
      if (typeof window !== "undefined") {
        const detail = {
          currentBalance: balance,
          requiredTokens: 0.7,
          message: errMsg || `You need at least 0.7 tokens to use this AI feature. Please buy tokens to continue.`
        }
        window.dispatchEvent(new CustomEvent("bakewealth:insufficient-tokens", { detail }))
        window.dispatchEvent(new CustomEvent("layerledger:insufficient-tokens", { detail }))
      }
      throw new Error(errMsg || "Insufficient tokens. Please buy tokens to continue.")
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
  } catch (e) {
    throw new Error("Invalid API response: " + text.slice(0, 200))
  }
  if (data.error) {
    throw new Error("API error: " + (data.error.message || JSON.stringify(data.error)))
  }

  // Real-time token balance update on successful deduction
  if (data.tokenUsage && typeof data.tokenUsage.newBalance === "number") {
    const curTenant = (typeof loadLocal === "function" ? loadLocal("ll_tenant_info", null) : null) || {}
    curTenant.tokenBalance = data.tokenUsage.newBalance
    if (typeof saveLocal === "function") {
      saveLocal("ll_tenant_info", curTenant)
    }
    if (typeof window !== "undefined") {
      const detail = {
        tokenBalance: data.tokenUsage.newBalance,
        tokensDeducted: data.tokenUsage.tokensDeducted || 0.7
      }
      window.dispatchEvent(new CustomEvent("bakewealth:token-updated", { detail }))
      window.dispatchEvent(new CustomEvent("layerledger:token-updated", { detail }))
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

  return lines.slice(1).map(line => {
    const row = line.split(delim)
    const name = findCol(row, 'name', 'item', 'ingredient', 'product', 'description')
    if (!name) return null
    return {
      id: uid(),
      name,
      cat: findCol(row, 'cat', 'category', 'type', 'group', 'class') || 'General',
      unit: findCol(row, 'unit', 'measure', 'uom', 'per') || 'kg',
      cost: +(findCol(row, 'cost', 'price', 'rate', 'unit cost', 'price unit', 'price/unit', 'per unit') || '0').replace(/[,₦]/g, '') || 0,
      stock: +(findCol(row, 'stock', 'quantity', 'qty', 'current stock', 'on hand', 'balance') || '0').replace(/[,]/g, '') || 0,
      minStock: +(findCol(row, 'min', 'minimum', 'minstock', 'reorder', 'alert') || '2').replace(/[,]/g, '') || 2,
    }
  }).filter(Boolean).filter(i => i.name)
}
