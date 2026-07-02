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
 * ----------------------------------------------------------------------------
 */
import { FLAVOR_EXTRAS, DECORATION_ITEMS } from "../constants.js"

export const fmt  = n => `₦${Math.round(n||0).toLocaleString("en")}`
export const uid  = () => "_"+Math.random().toString(36).slice(2,9)
export const today= () => new Date().toISOString().slice(0,10)

export const recipeCost = (r, inv) => !r ? 0 : r.ing.reduce((s,i)=>{ const it=inv.find(x=>x.id===i.iid); return s+(it?it.cost*i.qty:0) },0)

export const calcFullCost = (recipe, inv, flavors, decorationIds, accessoryPct) => {
  if (!recipe) return 0
  let cost = recipeCost(recipe, inv)
  // flavor extras
  const fl = (flavors||"").toLowerCase().split(/[,+&]/).map(f=>f.trim()).filter(Boolean)
  fl.forEach(f => (FLAVOR_EXTRAS[f]||[]).forEach(e=>{ const it=inv.find(x=>x.id===e.iid); if(it) cost+=it.cost*e.qty }))
  // decoration extras
  ;(decorationIds||[]).forEach(did => {
    const decor = DECORATION_ITEMS.find(d=>d.id===did)
    if (decor) { const it=inv.find(x=>x.id===decor.iid); if(it) cost+=it.cost*decor.qty }
  })
  return cost * (1 + (accessoryPct||10)/100)
}

export async function callClaude(messages, system="") {
  const apiKey = localStorage.getItem("ll_anthropic_key") || ""
  if (!apiKey) {
    throw new Error("No API key set. Go to Settings → AI Features and enter your Anthropic API key.")
  }
  const apiUrl = import.meta.env.VITE_CLAUDE_API_URL;
  if (!apiUrl) {
    throw new Error("Claude API URL (VITE_CLAUDE_API_URL) is not defined in the environment.");
  }
  const res = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-ll-key": apiKey
    },
    body: JSON.stringify({
      model: "claude-opus-4-5",
      max_tokens: 4000,
      system,
      messages
    })
  })
  const text = await res.text()
  if (!text || !text.trim()) {
    throw new Error("No response from API. Check your deployment includes the functions folder.")
  }
  let data
  try { data = JSON.parse(text) }
  catch (e) { throw new Error("Invalid API response: " + text.slice(0, 200)) }
  if (data.error) {
    throw new Error("API error: " + (data.error.message || JSON.stringify(data.error)))
  }
  return data.content?.[0]?.text || ""
}

// Compress image before sending to API
export async function compressImage(base64, maxWidth=800) {
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const scale = Math.min(1, maxWidth / img.width)
      canvas.width = img.width * scale
      canvas.height = img.height * scale
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', 0.7).split(',')[1])
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
