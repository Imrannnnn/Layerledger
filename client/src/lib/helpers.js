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
import { getAuthHeaders, loadLocal } from "./data.js"

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



export const fmt  = n => `₦${Math.round(n||0).toLocaleString("en")}`
export const uid  = () => "_"+Math.random().toString(36).slice(2,9)
export const today= () => new Date().toISOString().slice(0,10)

export const recipeCost = (r, inv) => !r ? 0 : r.ing.reduce((s,i)=>{ const it=inv.find(x=>x.id===i.iid); return s+(it?it.cost*i.qty:0) },0)

export const calcFullCost = (recipe, inv, flavors, decorationIds, accessoryPct, miscPct = 0) => {
  if (!recipe) return 0
  let cost = recipeCost(recipe, inv)
  // flavor extras
  const fl = (flavors||"").toLowerCase().split(/[,+&]/).map(f=>f.trim()).filter(Boolean)
  fl.forEach(f => (FLAVOR_EXTRAS[f]||[]).forEach(e=>{ const it=inv.find(x=>x.id===e.iid); if(it) cost+=it.cost*e.qty }))
  // decoration extras
  const localDecors = loadLocal("ll_decorations", null)
  const storedDecorations = (Array.isArray(localDecors) && localDecors.length > 0) ? localDecors : DECORATION_ITEMS
  ;(decorationIds||[]).forEach(did => {
    const decor = storedDecorations.find(d=>d.id===did) || DECORATION_ITEMS.find(d=>d.id===did)
    if (decor) { const it=inv.find(x=>x.id===decor.iid); if(it) cost+=it.cost*decor.qty }
  })

  return cost * (1 + (accessoryPct||10)/100 + (miscPct||0)/100)
}



export async function callClaude(messages, system="") {
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
        max_tokens: 1500,
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
    try {
      if (text && text.trim()) {
        const errJson = JSON.parse(text)
        errMsg = errJson.error?.message || errJson.message || ""
        if (errJson.error?.type === "not_found_error") {
          errMsg = `Anthropic API error: Model not found (${errMsg}). This usually means your Anthropic account has no credits/funds left or billing is inactive. Please fund your account in the Anthropic Console.`
        }
      }
    } catch (e) {
      // Ignore JSON parse errors and fallback to status checks
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
  
  if (Array.isArray(data.content)) {
    const textBlock = data.content.find(c => c.type === "text" && c.text)
    if (textBlock && textBlock.text) {
      return textBlock.text
    }
  }

  return data.content?.[0]?.text || data.text || ""
}

// Compress image before sending to API
export async function compressImage(base64, maxWidth=800, quality=0.8) {
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const scale = Math.min(1, maxWidth / img.width)
      canvas.width = img.width * scale
      canvas.height = img.height * scale
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', quality).split(',')[1])
    }
    img.src = `data:image/jpeg;base64,${base64}`
  })
}

// CSV parser — flexible column matching, handles BOM, semicolons, tabs
export function parseCSV(text) {
  const clean = text.replace(/^\uFEFF/, '').trim()
  const lines = clean.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return []
  const firstLine = lines[0]
  const delim = firstLine.includes(';') ? ';' : firstLine.includes('\t') ? '\t' : ','
  const headers = firstLine.split(delim).map(h => h.trim().toLowerCase().replace(/['"]/g,'').replace(/[^a-z0-9]/g,' ').trim())

  const findCol = (row, ...keys) => {
    for (const k of keys) {
      const idx = headers.findIndex(h => h.includes(k))
      if (idx >= 0 && row[idx] !== undefined) return row[idx].trim().replace(/['"]/g,'')
    }
    return ''
  }

  return lines.slice(1).map(line => {
    const row = line.split(delim)
    const name = findCol(row,'name','item','ingredient','product','description')
    if (!name) return null
    return {
      id: uid(),
      name,
      cat:      findCol(row,'cat','category','type','group','class') || 'General',
      unit:     findCol(row,'unit','measure','uom','per') || 'kg',
      cost:   +(findCol(row,'cost','price','rate','unit cost','price unit','price/unit','per unit') || '0').replace(/[,₦]/g,'') || 0,
      stock:  +(findCol(row,'stock','quantity','qty','current stock','on hand','balance') || '0').replace(/[,]/g,'') || 0,
      minStock:+(findCol(row,'min','minimum','minstock','reorder','alert') || '2').replace(/[,]/g,'') || 2,
    }
  }).filter(Boolean).filter(i => i.name)
}
