// ═══════════════════════════════════════════════════════════
//  DATA LAYER — PostgreSQL database with active session cache
// ═══════════════════════════════════════════════════════════

const cache = {}
const lastSyncedValues = {}

const fetchWithTimeout = async (url, options = {}, timeoutMs = 8000) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

// Normalizes dates (DD/MM/YYYY, ISO, timestamps) for resilient API sync and month matching
const normalizeDateToIso = (inputDate) => {
  if (!inputDate) return new Date().toISOString().slice(0, 10)
  if (inputDate instanceof Date && !isNaN(inputDate.getTime())) {
    const y = inputDate.getFullYear()
    const m = String(inputDate.getMonth() + 1).padStart(2, "0")
    const d = String(inputDate.getDate()).padStart(2, "0")
    return `${y}-${m}-${d}`
  }
  if (typeof inputDate !== "string") return new Date().toISOString().slice(0, 10)
  const trimmed = inputDate.trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10)

  const dmyMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/)
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`
  }

  const ymdMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
  if (ymdMatch) {
    const [, y, m, d] = ymdMatch
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`
  }

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
  return new Date().toISOString().slice(0, 10)
}

const isDateMatchingMonth = (dateStr, monthStr) => {
  if (!dateStr || !monthStr) return false
  return normalizeDateToIso(dateStr).startsWith(monthStr.trim())
}

// Mapping functions to transform server DB structures to application data models
const mapServerInventoryToLocal = (item) => ({
  id: item.id,
  name: item.name,
  cat: item.category,
  unit: item.unit,
  cost: item.cost,
  stock: item.stock,
  minStock: item.minStock
})

const mapServerRecipeToLocal = (rec) => ({
  id: rec.id,
  name: rec.name,
  notes: rec.notes || "",
  type: rec.type || "layer",
  batchWeight: rec.batchWeight || null,
  batchSize: rec.batchSize || null,
  ing: (rec.ingredients || []).map(ri => ({
    iid: ri.inventoryItemId,
    qty: ri.quantity
  }))
})

const mapServerExpenseToLocal = (exp) => ({
  id: exp.id,
  date: exp.date ? exp.date.split("T")[0] : new Date().toISOString().split("T")[0],
  amount: exp.amount,
  category: exp.category,
  description: exp.description || "",
  receiptUrl: exp.receiptUrl || ""
})

const mapServerPurchaseToLocal = (pur) => ({
  id: pur.id,
  date: pur.date ? pur.date.split("T")[0] : new Date().toISOString().split("T")[0],
  supplier: pur.supplier || "Market Run",
  total: pur.total != null ? Number(pur.total) : Number(pur.amount || 0),
  item: pur.item || pur.inventoryItem?.name || (pur.notes ? pur.notes.split(" — Qty:")[0] : "Ingredient"),
  category: pur.category || pur.inventoryItem?.cat || "Ingredients / Supplies",
  unit: pur.unit || pur.inventoryItem?.unit || "",
  qty: pur.qty != null ? Number(pur.qty) : 1,
  stockAdded: pur.stockAdded != null ? Number(pur.stockAdded) : 0,
  itemId: pur.itemId || null,
  unitSize: pur.unitSize != null ? Number(pur.unitSize) : 0,
  price: pur.price != null ? Number(pur.price) : 0,
  cpu: pur.cpu != null ? Number(pur.cpu) : 0
})

const mapServerInvoiceToLocal = (inv) => ({
  id: inv.id,
  quoteId: inv.orderId || inv.id,
  invoiceNumber: inv.invoiceNumber || inv.id,
  date: inv.issueDate ? inv.issueDate.split("T")[0] : new Date().toISOString().split("T")[0],
  deliveryDate: inv.dueDate ? inv.dueDate.split("T")[0] : null,
  status: inv.status || "unpaid",
  notes: inv.notes || ""
})

const mapServerOrderToLocal = (o) => {
  const base = o.metadata && typeof o.metadata === "object" ? o.metadata : {}
  const parsedOrderDate = o.orderDate ? o.orderDate.split("T")[0] : (o.createdAt ? o.createdAt.split("T")[0] : null)
  return {
    ...base,
    id: o.id,
    notes: o.notes || "",
    salePrice: o.totalPrice,
    cost: o.totalCost,
    status: o.status,
    orderDate: parsedOrderDate || base.orderDate || null,
    dueDate: o.dueDate ? o.dueDate.split("T")[0] : null,
    deliveryDate: o.dueDate ? o.dueDate.split("T")[0] : base.deliveryDate || parsedOrderDate || null,
    tiers: base.tiers || (o.items || []).map(item => ({
      covering: item.name,
      size: item.size || "6",
      shape: item.shape || "round",
      layers: Array.from({ length: item.layers || 1 }, () => ({}))
    }))
  }
}

const load = (key, fallback) => {
  if (cache[key] !== undefined && cache[key] !== null) {
    try {
      const val = cache[key]
      return typeof val === "string" ? JSON.parse(val) : val
    } catch {
      return cache[key]
    }
  }
  return fallback
}

export const loadLocal = (key, fallback) => {
  const val = load(key, fallback)
  if (key === "ll_anthropic_key" && val) {
    window.__anthropic_key = val
  }
  return val
}

const save = async (key, val) => {
  try {
    cache[key] = val

    const headers = getAuthHeaders()
    if (!headers) return

    if (key === "ll_inv") {
      await syncInventoryItems(headers, val)
    } else if (key === "ll_recipes") {
      await syncRecipesList(headers, val)
    } else if (key === "ll_prods") {
      await syncOrdersList(headers, val, load("ll_quotes", []), load("ll_inv", []), load("ll_recipes", []))
    } else if (key === "ll_quotes") {
      await syncOrdersList(headers, load("ll_prods", []), val, load("ll_inv", []), load("ll_recipes", []))
    } else if (key === "ll_quote_invoices" || key === "ll_invoices") {
      await syncInvoicesList(headers, val)
    } else if (key === "ll_exp") {
      await syncExpensesList(headers, val)
    } else if (key === "ll_purchases") {
      await syncPurchasesList(headers, val)
    } else if (key === "ll_txns") {
      await syncTransactionsList(headers, val)
    } else if (key === "ll_clients") {
      await syncClientsList(headers, val)
    } else if (key === "ll_opening_stock" || key.startsWith("ll_os_")) {
      await syncOpeningStockList(headers, val, key)
    } else {
      await debouncedSyncTenantSettingsOnly(headers)
    }
  } catch (e) {
    console.error(`Save to backend error for key ${key}:`, e)
  }
}

let syncTenantTimeout = null
const debouncedSyncTenantSettingsOnly = (headers) => {
  if (syncTenantTimeout) clearTimeout(syncTenantTimeout)
  return new Promise((resolve) => {
    syncTenantTimeout = setTimeout(async () => {
      try {
        await syncTenantSettingsOnly(headers)
      } finally {
        resolve()
      }
    }, 350)
  })
}

const syncTenantSettingsOnly = async (headers) => {
  const apiUrl = import.meta.env.VITE_API_URL
  if (!apiUrl) return
  try {
    const res = await fetch(`${apiUrl}/api/tenant`, { headers })
    if (res.ok) {
      const tenant = await res.json()
      const data = {
        ...(tenant.settings?.appConfig || {})
      }
      Object.entries(cache).forEach(([k, v]) => {
        const keysToStoreInAppConfig = [
          "ll_co", "ll_multipliers", "ll_coverings", "ll_decorations", "ll_packaging", 
          "ll_onboarded", "ll_anthropic_key", "ll_users", "ll_clients", "ll_aliases"
        ]
        if (
          keysToStoreInAppConfig.includes(k) || 
          k.startsWith("ll_setting_") || 
          k.startsWith("ll_lock_") || 
          k.startsWith("ll_dismiss_")
        ) {
          data[k] = typeof v === "string" ? v : JSON.stringify(v)
        }
      })
      const updatedSettings = {
        ...(tenant.settings || {}),
        appConfig: data
      }
      const putRes = await fetch(`${apiUrl}/api/tenant`, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          name: tenant.name,
          contactEmail: tenant.contactEmail || "",
          contactPhone: tenant.contactPhone || "",
          settings: updatedSettings
        })
      })
      if (putRes.ok) {
        const serverTenant = await putRes.json()
        const cfg = serverTenant.settings?.appConfig
        if (cfg) {
          Object.entries(cfg).forEach(([k, v]) => {
            try {
              cache[k] = typeof v === "string" ? JSON.parse(v) : v
            } catch {
              cache[k] = v
            }
          })
        }
      }
    }
  } catch (e) {
    console.error("Failed to sync tenant settings:", e)
  }
}

export const saveLocal = async (key, val) => {
  if (key === "ll_anthropic_key") {
    window.__anthropic_key = val
  }
  if (key === "ll_multipliers") {
    return await savePricingSettingsOnServer({ multipliers: val })
  }
  await save(key, val)
}

export const getAuthHeaders = () => {
  try {
    const u = sessionStorage.getItem("ll_current_user")
    if (!u) return null
    const user = JSON.parse(u)
    return user && user.token ? { "Authorization": `Bearer ${user.token}`, "Content-Type": "application/json" } : null
  } catch {
    return null
  }
}

export const syncToBackend = async () => {
  const headers = getAuthHeaders()
  if (headers) {
    await syncTenantSettingsOnly(headers)
  }
}

const syncInventoryItems = async (headers, localInv) => {
  const apiUrl = import.meta.env.VITE_API_URL
  const res = await fetch(`${apiUrl}/api/inventory`, { headers })
  if (!res.ok) return
  const serverItems = await res.json()

  let localChanged = false
  const updatedLocalInv = [...localInv]

  // Delete missing items in parallel
  const itemsToDelete = serverItems.filter(sItem => !localInv.find(i => i.id === sItem.id))
  if (itemsToDelete.length > 0) {
    await Promise.all(itemsToDelete.map(sItem =>
      fetch(`${apiUrl}/api/inventory/${sItem.id}`, { method: "DELETE", headers }).catch(e => console.error(`Error deleting item ${sItem.id}:`, e))
    ))
  }

  // Create/Update
  for (let i = 0; i < updatedLocalInv.length; i++) {
    const item = updatedLocalInv[i]
    const sItem = serverItems.find(x => x.id === item.id)
    if (sItem) {
      const body = {
        id: item.id,
        name: item.name || "Item",
        category: item.cat || "Other",
        unit: item.unit || "unit",
        minStock: Number(item.minStock || 0)
      }
      const stockChanged = item.stock !== sItem.stock;
      const costChanged = item.cost !== sItem.cost;

      if (sItem.name !== body.name || sItem.category !== body.category || sItem.unit !== body.unit || sItem.minStock !== body.minStock || stockChanged || costChanged) {
        const updateRes = await fetch(`${apiUrl}/api/inventory/${item.id}`, {
          method: "PUT",
          headers,
          body: JSON.stringify({
            ...body,
            cost: Number(item.cost),
            stock: Number(item.stock)
          })
        });
        if (updateRes.ok) {
          const updatedServerItem = await updateRes.json();
          sItem.cost = updatedServerItem.cost;
          sItem.stock = updatedServerItem.stock;
        }
      }

      if (item.cost !== sItem.cost || item.stock !== sItem.stock) {
        updatedLocalInv[i] = {
          ...item,
          cost: sItem.cost,
          stock: sItem.stock
        }
        localChanged = true;
      }
    } else {
      await fetch(`${apiUrl}/api/inventory`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          id: item.id,
          name: item.name || "Item",
          category: item.cat || "Other",
          unit: item.unit || "unit",
          cost: Number(item.cost) || 0,
          stock: Number(item.stock || 0),
          minStock: Number(item.minStock || 0)
        })
      })
    }
  }

  if (localChanged) {
    cache["ll_inv"] = updatedLocalInv
  }
}

const syncRecipesList = async (headers, localRecipes) => {
  const apiUrl = import.meta.env.VITE_API_URL
  const res = await fetch(`${apiUrl}/api/recipes`, { headers })
  if (!res.ok) return
  const serverRecs = await res.json()

  // Delete
  for (const sRec of serverRecs) {
    if (!localRecipes.find(r => r.id === sRec.id)) {
      await fetch(`${apiUrl}/api/recipes/${sRec.id}`, { method: "DELETE", headers })
    }
  }

  // Create/Update
  for (const rec of localRecipes) {
    const sRec = serverRecs.find(r => r.id === rec.id)
    const body = {
      id: rec.id,
      name: rec.name || "Recipe",
      notes: rec.notes || "",
      type: rec.type || "layer",
      batchWeight: rec.batchWeight !== undefined && rec.batchWeight !== null ? Number(rec.batchWeight) : null,
      batchSize: rec.batchSize !== undefined && rec.batchSize !== null ? Number(rec.batchSize) : null,
      ingredients: (rec.ing || []).map(i => ({
        item: i.iid || "item",
        quantity: Number(i.qty) || 0
      }))
    }
    if (sRec) {
      await fetch(`${apiUrl}/api/recipes/${rec.id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify(body)
      })
    } else {
      await fetch(`${apiUrl}/api/recipes`, {
        method: "POST",
        headers,
        body: JSON.stringify(body)
      })
    }
  }
}

const syncExpensesList = async (headers, localExpenses) => {
  try {
    const apiUrl = import.meta.env.VITE_API_URL
    if (!apiUrl) return
    const res = await fetchWithTimeout(`${apiUrl}/api/expenses`, { headers })
    if (!res.ok) return
    const serverExps = await res.json()

    // Delete removed expenses in parallel
    const expsToDelete = serverExps.filter(sExp => !localExpenses.find(e => e.id === sExp.id))
    if (expsToDelete.length > 0) {
      await Promise.allSettled(
        expsToDelete.map(sExp =>
          fetchWithTimeout(`${apiUrl}/api/expenses/${sExp.id}`, { method: "DELETE", headers }).catch(() => {})
        )
      )
    }

    // Create/Update
    for (const exp of localExpenses) {
      const sExp = serverExps.find(e => e.id === exp.id)
      let parsedDate = new Date().toISOString()
      try { if (exp.date) parsedDate = new Date(normalizeDateToIso(exp.date)).toISOString() } catch (e) { /* ignore invalid date */ }

      const body = {
        id: exp.id,
        date: parsedDate,
        amount: Number(exp.amount) || 0,
        category: exp.category || "Miscellaneous",
        description: exp.description || "",
        receiptUrl: exp.receiptUrl || ""
      }
      if (sExp) {
        const sExpDate = new Date(sExp.date).toISOString()
        if (sExp.amount !== body.amount || sExp.category !== body.category || (sExp.description || "") !== body.description || sExpDate !== body.date) {
          await fetchWithTimeout(`${apiUrl}/api/expenses/${exp.id}`, {
            method: "PUT",
            headers,
            body: JSON.stringify(body)
          }).catch(() => {})
        }
      } else {
        await fetchWithTimeout(`${apiUrl}/api/expenses`, {
          method: "POST",
          headers,
          body: JSON.stringify(body)
        }).catch(() => {})
      }
    }
  } catch (err) {
    console.warn("syncExpensesList error:", err)
  }
}

export const calculateOrderUsages = (o, inventory = [], recipes = []) => {
  if (!o) return [];
  const usages = [];
  const mults = loadLocal("ll_multipliers", {
    "4-round":1,"6-round":1,"8-round":1.5,"10-round":2.2,"12-round":3.2,"14-round":4.5,
    "4-square":1.2,"6-square":1.3,"8-square":2,"10-square":3,"12-square":4.2,"14-square":6,
    "4-sheet":1.5,"6-sheet":2,"8-sheet":3,"10-sheet":4.5,"12-sheet":6.5,"14-sheet":9
  });

  const addUsage = (itemId, qty) => {
    if (!itemId || !qty || qty <= 0 || isNaN(qty)) return;
    const existing = usages.find(u => u.itemId === itemId);
    if (existing) {
      existing.qty = parseFloat((existing.qty + qty).toFixed(4));
    } else {
      usages.push({ itemId, qty: parseFloat(qty.toFixed(4)) });
    }
  };

  const findRecipe = (name, type) => {
    if (!name || typeof name !== "string") return null;
    const clean = name.trim().toLowerCase();
    if (!clean) return null;
    let list = recipes || [];
    if (type) {
      list = list.filter(r => !r.type || r.type === type);
    }
    // Exact match first
    let found = list.find(r => r.name && r.name.trim().toLowerCase() === clean);
    if (found) return found;
    // Substring match
    found = list.find(r => r.name && r.name.toLowerCase().includes(clean));
    if (found) return found;
    // Reverse substring match
    found = list.find(r => r.name && clean.includes(r.name.trim().toLowerCase()));
    return found || null;
  };

  const getBatchGrams = (rec) => {
    if (!rec) return 1000;
    if (Number(rec.batchWeight) > 0) return Number(rec.batchWeight);
    const sum = (rec.ing || []).reduce((s, ing) => {
      const it = (inventory || []).find(x => x.id === ing.iid);
      const u = (it?.unit || ing.unit || "").toLowerCase();
      const q = Number(ing.qty) || 0;
      if (u === "kg" || u === "l") return s + q * 1000;
      return s + q;
    }, 0);
    return sum > 0 ? sum : 1000;
  };

  const storedDecor = loadLocal("ll_decorations", []);

  const processTier = (tier) => {
    if (!tier) return;
    const size = String(tier.size || "8").replace(/"/g, "").trim();
    const shape = (tier.shape || "round").toLowerCase();
    const key = `${size}-${shape}`;
    const mult = mults[key] || 1;

    tier.layers?.forEach(layer => {
      if (!layer || !layer.flavour) return;
      const recipe = findRecipe(layer.flavour, "layer") || findRecipe(layer.flavour);
      if (!recipe || !recipe.ing) return;
      const layerMultiplier = Number(layer.qty) || 1;
      recipe.ing.forEach(ing => {
        const needed = (Number(ing.qty) || 0) * mult * layerMultiplier;
        addUsage(ing.iid, needed);
      });
    });

    tier.coverings?.forEach(cov => {
      if (!cov || !cov.type || !cov.grams) return;
      const grams = Number(cov.grams) || 0;
      if (grams <= 0) return;
      const recipe = findRecipe(cov.type, "covering") || findRecipe(cov.type);
      if (!recipe || !recipe.ing) return;
      const batchGrams = getBatchGrams(recipe);
      const ratio = grams / batchGrams;
      recipe.ing.forEach(ing => {
        const needed = (Number(ing.qty) || 0) * ratio;
        addUsage(ing.iid, needed);
      });
    });

    tier.fillings?.forEach(fil => {
      if (!fil || !fil.type || !fil.grams) return;
      const grams = Number(fil.grams) || 0;
      if (grams <= 0) return;
      const recipe = findRecipe(fil.type, "covering") || findRecipe(fil.type);
      if (!recipe || !recipe.ing) return;
      const batchGrams = getBatchGrams(recipe);
      const ratio = grams / batchGrams;
      recipe.ing.forEach(ing => {
        const needed = (Number(ing.qty) || 0) * ratio;
        addUsage(ing.iid, needed);
      });
    });
  };

  const processPastryItem = (p) => {
    if (!p || !p.flavour || !p.qty) return;
    const qty = Number(p.qty) || 0;
    if (qty <= 0) return;
    const recipe = findRecipe(p.flavour, "pastry") || findRecipe(p.flavour);
    if (recipe && recipe.ing) {
      const batchSize = Number(recipe.batchSize) || 12;
      const ratio = qty / batchSize;
      recipe.ing.forEach(ing => {
        const needed = (Number(ing.qty) || 0) * ratio;
        addUsage(ing.iid, needed);
      });
    }

    if (p.filling && Number(p.fillingGrams) > 0) {
      const fillRecipe = findRecipe(p.filling, "covering") || findRecipe(p.filling);
      if (fillRecipe && fillRecipe.ing) {
        const batchGrams = getBatchGrams(fillRecipe);
        const ratio = Number(p.fillingGrams) / batchGrams;
        fillRecipe.ing.forEach(ing => {
          const needed = (Number(ing.qty) || 0) * ratio;
          addUsage(ing.iid, needed);
        });
      }
    }
  };

  const processDecorations = (decQtyOrString) => {
    if (!decQtyOrString) return;
    if (typeof decQtyOrString === "object" && !Array.isArray(decQtyOrString)) {
      Object.entries(decQtyOrString).forEach(([did, count]) => {
        const c = Number(count) || 0;
        if (c <= 0) return;
        const decor = storedDecor.find(d => d.id === did);
        if (decor && decor.iid) {
          addUsage(decor.iid, (Number(decor.qty) || 1) * c);
        }
      });
    } else if (typeof decQtyOrString === "string") {
      const ids = decQtyOrString.split(",").map(s => s.trim()).filter(Boolean);
      ids.forEach(did => {
        const decor = storedDecor.find(d => d.id === did);
        if (decor && decor.iid) {
          addUsage(decor.iid, Number(decor.qty) || 1);
        }
      });
    }
  };

  const processAccessories = (accRows) => {
    if (!Array.isArray(accRows)) return;
    accRows.forEach(r => {
      if (!r || !r.itemId) return;
      const invMatch = (inventory || []).find(i => i.id === r.itemId);
      if (invMatch) {
        addUsage(invMatch.id, Number(r.qty) || 1);
      }
    });
  };

  // 1. Multi-Item Order (OrderCalculator structure)
  if (Array.isArray(o.items) && o.items.length > 0) {
    o.items.forEach(it => {
      if (it.type === "cake") {
        if (Array.isArray(it.tiers)) {
          it.tiers.forEach(processTier);
        }
        processDecorations(it.decQty);
        processAccessories(it.accRows);
      } else if (it.type === "pastry") {
        if (Array.isArray(it.pastryItems)) {
          it.pastryItems.forEach(processPastryItem);
        }
        processAccessories(it.accRows);
      }
    });
  } else {
    // 2. Legacy / single order flat structure
    if (Array.isArray(o.tiers) && o.tiers.length > 0) {
      o.tiers.forEach(processTier);
    }
    if (Array.isArray(o.pastryItems) && o.pastryItems.length > 0) {
      o.pastryItems.forEach(processPastryItem);
    }
    if (Array.isArray(o.donutGroups) && o.donutGroups.length > 0) {
      o.donutGroups.forEach(processPastryItem);
    }
    if (Array.isArray(o.loaves) && o.loaves.length > 0) {
      o.loaves.forEach(l => {
        if (!l || !l.flavour) return;
        const recipe = findRecipe(l.flavour);
        if (recipe && recipe.ing) {
          recipe.ing.forEach(ing => {
            addUsage(ing.iid, Number(ing.qty) || 0);
          });
        }
      });
    }
    if (o.tartQty > 0) {
      const recipe = findRecipe("tart") || findRecipe("pastry");
      if (recipe && recipe.ing) {
        const batchSize = Number(recipe.batchSize) || 12;
        const ratio = Number(o.tartQty) / batchSize;
        recipe.ing.forEach(ing => {
          addUsage(ing.iid, (Number(ing.qty) || 0) * ratio);
        });
      }
    }
    processDecorations(o.decQty || o.decorations);
    processAccessories(o.accRows);
  }

  // 3. Manual production record with matchedRecipe or recipeId
  if (o.matchedRecipe || o.recipeId) {
    const r = o.matchedRecipe || (recipes || []).find(x => x.id === o.recipeId);
    if (r && r.ing) {
      const count = Number(o.layers) || 1;
      r.ing.forEach(ing => {
        addUsage(ing.iid, (Number(ing.qty) || 0) * count);
      });
    }
  }

  return usages;
};

const syncOrdersList = async (headers, localProds, localQuotes, localInv, localRecipes) => {
  try {
    const apiUrl = import.meta.env.VITE_API_URL
    if (!apiUrl) return
    const res = await fetchWithTimeout(`${apiUrl}/api/orders`, { headers })
    if (!res.ok) return
    const serverOrders = await res.json()

    const combinedLocal = [
      ...localProds.map(p => ({ ...p, isProd: true })),
      ...localQuotes.map(q => ({ ...q, isProd: false }))
    ]

    // Delete removed orders in parallel
    const ordersToDelete = serverOrders.filter(sOrder => !combinedLocal.find(o => o.id === sOrder.id))
    if (ordersToDelete.length > 0) {
      await Promise.allSettled(
        ordersToDelete.map(sOrder =>
          fetchWithTimeout(`${apiUrl}/api/orders/${sOrder.id}`, { method: "DELETE", headers }).catch(() => {})
        )
      )
    }

    // Create/Update only if changed
    for (const o of combinedLocal) {
      const sOrder = serverOrders.find(so => so.id === o.id)
      
      const items = (o.tiers || []).map(t => ({
        name: t.covering || "Cake tier",
        size: t.size ? String(t.size) : "6",
        shape: t.shape || "round",
        layers: t.layers?.length || 1,
        price: o.salePrice ? Number(o.salePrice / (o.tiers?.length || 1)) : 0,
        cost: o.cost ? Number(o.cost / (o.tiers?.length || 1)) : 0
      }))

      const usages = calculateOrderUsages(o, localInv, localRecipes)

      let parsedDue = null
      try {
        const d = o.deliveryDate || o.dueDate
        if (d) parsedDue = new Date(d).toISOString()
      } catch (e) { /* ignore */ }

      const body = {
        id: o.id,
        status: o.isProd ? (o.status || "pending") : "quote",
        dueDate: parsedDue,
        totalPrice: Number(o.salePrice || 0),
        totalCost: Number(o.cost || 0),
        notes: o.notes || "",
        items,
        usages,
        metadata: o
      }

      if (sOrder) {
        const sDueDate = sOrder.dueDate ? new Date(sOrder.dueDate).toISOString() : null
        const isDiff =
          sOrder.status !== body.status ||
          Math.abs(Number(sOrder.totalPrice || 0) - body.totalPrice) > 0.01 ||
          Math.abs(Number(sOrder.totalCost || 0) - body.totalCost) > 0.01 ||
          (sOrder.notes || "") !== body.notes ||
          sDueDate !== body.dueDate

        if (isDiff) {
          await fetchWithTimeout(`${apiUrl}/api/orders/${o.id}`, {
            method: "PUT",
            headers,
            body: JSON.stringify(body)
          }).catch(() => {})
        }
      } else {
        await fetchWithTimeout(`${apiUrl}/api/orders`, {
          method: "POST",
          headers,
          body: JSON.stringify(body)
        }).catch(() => {})
      }
    }
  } catch (err) {
    console.warn("syncOrdersList error:", err)
  }
}

const syncInvoicesList = async (headers, localInvs) => {
  const apiUrl = import.meta.env.VITE_API_URL
  const res = await fetch(`${apiUrl}/api/invoices`, { headers })
  if (!res.ok) return
  const serverInvs = await res.json()

  // Delete
  for (const sInv of serverInvs) {
    if (!localInvs.find(i => i.id === sInv.id)) {
      await fetch(`${apiUrl}/api/invoices/${sInv.id}`, { method: "DELETE", headers })
    }
  }

  // Create/Update
  for (const inv of localInvs) {
    const sInv = serverInvs.find(si => si.id === inv.id)
    let parsedIssue = new Date().toISOString()
    let parsedDue = null
    try { if (inv.date) parsedIssue = new Date(inv.date).toISOString() } catch (e) { /* ignore invalid date */ }
    try { if (inv.deliveryDate) parsedDue = new Date(inv.deliveryDate).toISOString() } catch (e) { /* ignore invalid date */ }

    const body = {
      id: inv.id,
      orderId: inv.quoteId || inv.id,
      invoiceNumber: inv.id,
      issueDate: parsedIssue,
      dueDate: parsedDue,
      status: inv.status || "unpaid",
      notes: inv.notes || ""
    }
    if (sInv) {
      if (sInv.status !== body.status || sInv.invoiceNumber !== body.invoiceNumber || (sInv.notes || "") !== body.notes) {
        await fetch(`${apiUrl}/api/invoices/${inv.id}`, {
          method: "PUT",
          headers,
          body: JSON.stringify(body)
        })
      }
    } else {
      await fetch(`${apiUrl}/api/invoices`, {
        method: "POST",
        headers,
        body: JSON.stringify(body)
      })
    }
  }
}

const syncPurchasesList = async (headers, localPurchases) => {
  try {
    const apiUrl = import.meta.env.VITE_API_URL
    if (!apiUrl) return
    const res = await fetchWithTimeout(`${apiUrl}/api/purchases`, { headers })
    if (!res.ok) return
    const serverPurchases = await res.json()

    // Merge server purchases not present locally into local cache (prevents accidental data loss)
    // Only merge if localPurchases is not explicitly empty (e.g. user cleared history)
    if (localPurchases.length > 0) {
      const missingInLocal = (Array.isArray(serverPurchases) ? serverPurchases : (serverPurchases.data || []))
        .map(mapServerPurchaseToLocal)
        .filter(sp => !localPurchases.some(lp => lp.id === sp.id))
      if (missingInLocal.length > 0) {
        const merged = [...localPurchases, ...missingInLocal]
        saveLocal("ll_purchases", merged)
        cache["ll_purchases"] = merged
      }
    }

    // Create/Update local purchases to server
    for (const pur of localPurchases) {
      const sPur = Array.isArray(serverPurchases) ? serverPurchases.find(sp => sp.id === pur.id) : null
      let parsedDate = new Date().toISOString()
      try { if (pur.date) parsedDate = new Date(normalizeDateToIso(pur.date)).toISOString() } catch (e) { /* ignore invalid date */ }

      const body = {
        id: pur.id,
        date: parsedDate,
        supplier: pur.supplier || "Market Run",
        amount: Number(pur.total || 0),
        notes: `${pur.item || "Ingredient"} — Qty: ${pur.qty || 1} (added: ${pur.stockAdded || 0})`,
        itemId: pur.itemId || null,
        unitSize: Number(pur.unitSize || 0),
        qty: Number(pur.qty || 0),
        price: Number(pur.price || 0),
        total: Number(pur.total || 0),
        cpu: Number(pur.cpu || 0),
        stockAdded: Number(pur.stockAdded || 0)
      }
      if (sPur) {
        if (sPur.amount !== body.amount || sPur.supplier !== body.supplier || (sPur.notes || "") !== body.notes || sPur.itemId !== body.itemId || sPur.stockAdded !== body.stockAdded) {
          await fetchWithTimeout(`${apiUrl}/api/purchases/${pur.id}`, {
            method: "PUT",
            headers,
            body: JSON.stringify(body)
          }).catch(() => {})
        }
      } else {
        await fetchWithTimeout(`${apiUrl}/api/purchases`, {
          method: "POST",
          headers,
          body: JSON.stringify(body)
        }).catch(() => {})
      }
    }
  } catch (err) {
    console.warn("syncPurchasesList error:", err)
  }
}

const mapServerTransactionToLocal = (txn) => ({
  id: txn.id,
  date: txn.date ? txn.date.split("T")[0] : new Date().toISOString().split("T")[0],
  description: txn.description || "",
  amount: txn.amount,
  type: txn.type,
  category: txn.category || "",
  reference: txn.reference || ""
})

const syncTransactionsList = async (headers, localTxns) => {
  try {
    const apiUrl = import.meta.env.VITE_API_URL
    if (!apiUrl) return
    const res = await fetchWithTimeout(`${apiUrl}/api/transactions`, { headers })
    if (!res.ok) return
    const serverTxns = await res.json()

    // Delete removed transactions in parallel
    const txnsToDelete = serverTxns.filter(sTxn => !localTxns.find(t => t.id === sTxn.id))
    if (txnsToDelete.length > 0) {
      await Promise.allSettled(
        txnsToDelete.map(sTxn =>
          fetchWithTimeout(`${apiUrl}/api/transactions/${sTxn.id}`, { method: "DELETE", headers }).catch(() => {})
        )
      )
    }

    // Create/Update
    for (const txn of localTxns) {
      const sTxn = serverTxns.find(st => st.id === txn.id)
      let parsedDate = new Date().toISOString()
      try { if (txn.date) parsedDate = new Date(txn.date).toISOString() } catch (e) { /* ignore invalid date format */ }

      const body = {
        id: txn.id,
        date: parsedDate,
        description: txn.description || "Transaction",
        amount: Number(txn.amount) || 0,
        type: txn.type || "expense",
        category: txn.category || null,
        reference: txn.reference || null
      }

      if (sTxn) {
        if (sTxn.amount !== body.amount || (sTxn.description || "") !== body.description || (sTxn.category || "") !== (body.category || "")) {
          await fetchWithTimeout(`${apiUrl}/api/transactions/${txn.id}`, {
            method: "PUT",
            headers,
            body: JSON.stringify(body)
          }).catch(() => {})
        }
      } else {
        await fetchWithTimeout(`${apiUrl}/api/transactions`, {
          method: "POST",
          headers,
          body: JSON.stringify(body)
        }).catch(() => {})
      }
    }
  } catch (err) {
    console.warn("syncTransactionsList error:", err)
  }
}

const syncClientsList = async (headers, localClients) => {
  const apiUrl = import.meta.env.VITE_API_URL
  if (!apiUrl) return
  const res = await fetch(`${apiUrl}/api/clients`, { headers })
  if (!res.ok) return
  const serverClientsRaw = await res.json()
  const serverClients = Array.isArray(serverClientsRaw) ? serverClientsRaw : (serverClientsRaw.data || [])

  // Delete
  for (const sClient of serverClients) {
    if (!localClients.find(c => c.id === sClient.id)) {
      await fetch(`${apiUrl}/api/clients/${sClient.id}`, { method: "DELETE", headers })
    }
  }

  // Create / Update
  for (let i = 0; i < localClients.length; i++) {
    const c = localClients[i]
    const sClient = serverClients.find(sc => sc.id === c.id)
    const body = {
      name: c.name,
      phone: c.phone || "",
      email: c.email || "",
      address: c.address || "",
      notes: c.notes || "",
      birthday: c.birthday || ""
    }
    if (sClient) {
      if (
        sClient.name !== body.name ||
        (sClient.phone || "") !== body.phone ||
        (sClient.email || "") !== body.email ||
        (sClient.address || "") !== body.address ||
        (sClient.notes || "") !== body.notes ||
        (sClient.birthday || "") !== body.birthday
      ) {
        await fetch(`${apiUrl}/api/clients/${c.id}`, {
          method: "PUT",
          headers,
          body: JSON.stringify(body)
        })
      }
    } else {
      const createRes = await fetch(`${apiUrl}/api/clients`, {
        method: "POST",
        headers,
        body: JSON.stringify(body)
      })
      if (createRes.ok) {
        const created = await createRes.json()
        if (created && created.id) {
          c.id = created.id
        }
      }
    }
  }
}

const syncOpeningStockList = async (headers, val, key) => {
  const apiUrl = import.meta.env.VITE_API_URL
  if (!apiUrl) return
  try {
    let month = new Date().toISOString().slice(0, 7)
    let items = []
    let locked = false

    if (key && key.startsWith("ll_os_")) {
      month = key.replace("ll_os_", "")
      if (val && typeof val === "object") {
        items = Array.isArray(val.items) ? val.items : []
        locked = !!val.locked
      }
    } else if (val && typeof val === "object") {
      month = val.month || month
      items = Array.isArray(val.items) ? val.items : (Array.isArray(val) ? val : [])
      locked = !!val.locked
    } else if (Array.isArray(val)) {
      items = val
    }

    await fetch(`${apiUrl}/api/opening-stock/bulk`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        month,
        items,
        locked
      })
    })
  } catch (err) {
    console.warn("syncOpeningStockList error:", err)
  }
}

export const loadDashboardFromLogin = (dashboardData, tenant) => {
  if (tenant) {
    const tenantInfo = {
      id: tenant.id,
      name: tenant.name,
      createdAt: tenant.createdAt,
      tokenBalance: tenant.tokenBalance,
      settings: {
        plan: tenant.settings?.plan || "Free",
        status: tenant.settings?.status || "Active"
      }
    }
    cache["ll_tenant_info"] = tenantInfo
    const config = tenant.settings?.appConfig || null
    if (config) {
      Object.entries(config).forEach(([k, v]) => {
        if (v !== null) {
          let parsed;
          try { parsed = typeof v === "string" ? JSON.parse(v) : v } catch { parsed = v }
          cache[k] = parsed
        }
      })
    }
    cache["ll_onboarded"] = "1"
  }

  let localInv = []
  if (dashboardData?.inventory) {
    localInv = dashboardData.inventory.map(mapServerInventoryToLocal)
    cache["ll_inv"] = localInv
    lastSyncedValues["ll_inv"] = JSON.stringify(localInv)
  }

  const localProds = []
  const localQuotes = []
  if (dashboardData?.orders) {
    dashboardData.orders.forEach(o => {
      const localOrder = mapServerOrderToLocal(o)
      if (o.status === "quote") {
        localQuotes.push(localOrder)
      } else {
        localProds.push(localOrder)
      }
    })
    cache["ll_prods"] = localProds
    lastSyncedValues["ll_prods"] = JSON.stringify(localProds)
    cache["ll_quotes"] = localQuotes
    lastSyncedValues["ll_quotes"] = JSON.stringify(localQuotes)
  }

  let localExpenses = []
  if (dashboardData?.expenses) {
    localExpenses = dashboardData.expenses.map(mapServerExpenseToLocal)
    cache["ll_exp"] = localExpenses
    lastSyncedValues["ll_exp"] = JSON.stringify(localExpenses)
  }

  return {
    inv: localInv,
    prods: localProds,
    quotes: localQuotes,
    exps: localExpenses,
    tenantInfo: loadTenantInfo(),
    company: loadCompany(),
    settings: { accessoryPct: loadSetting("accessoryPct", 10), profitPct: loadSetting("profitPct", 40) }
  }
}

export const fetchPageDataOnDemand = async (pageId) => {
  const headers = getAuthHeaders()
  if (!headers) return
  const apiUrl = import.meta.env.VITE_API_URL
  if (!apiUrl) return

  try {
    if (pageId === "clients" && !cache["ll_clients"]) {
      const res = await fetch(`${apiUrl}/api/clients`, { headers })
      if (res.ok) {
        const data = await res.json()
        const list = Array.isArray(data) ? data : (data.data || [])
        cache["ll_clients"] = list.map(c => ({
          id: c.id,
          name: c.name,
          phone: c.phone || "",
          email: c.email || "",
          address: c.address || "",
          notes: c.notes || "",
          lastOrder: c.lastOrderDate ? c.lastOrderDate.split("T")[0] : (c.updatedAt ? c.updatedAt.split("T")[0] : ""),
          ordersCount: c._count?.orders || 0,
          createdAt: c.createdAt
        }))
      }
    } else if (pageId === "invoices" && !cache["ll_quote_invoices"]) {
      const res = await fetch(`${apiUrl}/api/invoices`, { headers })
      if (res.ok) {
        const data = await res.json()
        cache["ll_quote_invoices"] = data.map(mapServerInvoiceToLocal)
      }
    } else if ((pageId === "purchases" || pageId === "monthly") && !cache["ll_purchases"]) {
      const res = await fetch(`${apiUrl}/api/purchases`, { headers })
      if (res.ok) {
        const data = await res.json()
        const items = Array.isArray(data) ? data : (Array.isArray(data.data) ? data.data : [])
        cache["ll_purchases"] = items.map(mapServerPurchaseToLocal)
      }
    } else if (pageId === "bank" && !cache["ll_txns"]) {
      const res = await fetch(`${apiUrl}/api/transactions`, { headers })
      if (res.ok) {
        const data = await res.json()
        cache["ll_txns"] = data.map(mapServerTransactionToLocal)
      }
    } else if (pageId === "masterlist" && !cache["ll_recipes"]) {
      const res = await fetch(`${apiUrl}/api/recipes`, { headers })
      if (res.ok) {
        const data = await res.json()
        cache["ll_recipes"] = data.map(mapServerRecipeToLocal)
      }
    }
  } catch (err) {
    console.error("On-demand fetch error for " + pageId, err)
  }
}

export const syncFromBackend = async () => {
  const headers = getAuthHeaders()
  if (!headers) return false
  const apiUrl = import.meta.env.VITE_API_URL
  if (!apiUrl) return false

  try {
    // 1. Try single fast bootstrap endpoint
    const bootstrapRes = await fetch(`${apiUrl}/api/tenant/bootstrap`, { headers })
    if (bootstrapRes.ok) {
      const data = await bootstrapRes.json()
      const tenant = data.tenant

      const tenantInfo = {
        id: tenant.id,
        name: tenant.name,
        createdAt: tenant.createdAt,
        tokenBalance: tenant.tokenBalance,
        settings: {
          plan: tenant.settings?.plan || "Free",
          status: tenant.settings?.status || "Active"
        }
      }
      cache["ll_tenant_info"] = tenantInfo

      const keysToIgnoreOnLogin = ["ll_calc_state", "ll_calc_edit", "ll_calc_prefill", "ll_quote_prefill"]
      keysToIgnoreOnLogin.forEach(k => {
        delete cache[k]
      })

      let isAlreadyOnboarded = false
      const config = tenant.settings?.appConfig || null
      if (config) {
        if (config.ll_onboarded === "1" || config.ll_onboarded === 1 || config.ll_co || config.ll_multipliers) {
          isAlreadyOnboarded = true
        }
        Object.entries(config).forEach(([k, v]) => {
          if (v !== null && !keysToIgnoreOnLogin.includes(k)) {
            let parsed;
            try {
              parsed = typeof v === "string" ? JSON.parse(v) : v
            } catch {
              parsed = v
            }
            cache[k] = parsed
            if (k === "ll_anthropic_key") {
              window.__anthropic_key = parsed
            }
          }
        })
      }

      if (tenant.settings?.pricing) {
        const p = tenant.settings.pricing
        if (p.multipliers) cache["ll_multipliers"] = p.multipliers
        if (p.profitPct !== undefined) cache["ll_setting_profitPct"] = p.profitPct
        if (p.overheadPct !== undefined) cache["ll_setting_overheadPct"] = p.overheadPct
        if (p.accessoryPct !== undefined) cache["ll_setting_accessoryPct"] = p.accessoryPct
        if (p.miscPct !== undefined) cache["ll_setting_miscPct"] = p.miscPct
      }
      migrateLocalStoragePricingToDatabase().catch(() => {})

      if (data.inventory) {
        if (data.inventory.length > 0) isAlreadyOnboarded = true
        const localInv = data.inventory.map(mapServerInventoryToLocal)
        cache["ll_inv"] = localInv
        lastSyncedValues["ll_inv"] = JSON.stringify(localInv)
      }

      if (data.recipes) {
        if (data.recipes.length > 0) isAlreadyOnboarded = true
        const localRecipes = data.recipes.map(mapServerRecipeToLocal)
        cache["ll_recipes"] = localRecipes
        lastSyncedValues["ll_recipes"] = JSON.stringify(localRecipes)
      }

      if (data.orders) {
        if (data.orders.length > 0) isAlreadyOnboarded = true
        const localProds = []
        const localQuotes = []
        data.orders.forEach(o => {
          const localOrder = mapServerOrderToLocal(o)
          if (o.status === "quote") {
            localQuotes.push(localOrder)
          } else {
            localProds.push(localOrder)
          }
        })
        cache["ll_prods"] = localProds
        lastSyncedValues["ll_prods"] = JSON.stringify(localProds)

        cache["ll_quotes"] = localQuotes
        lastSyncedValues["ll_quotes"] = JSON.stringify(localQuotes)
      }

      if (data.expenses) {
        const localExpenses = data.expenses.map(mapServerExpenseToLocal)
        cache["ll_exp"] = localExpenses
        lastSyncedValues["ll_exp"] = JSON.stringify(localExpenses)
      }

      if (data.purchases) {
        const localPurchases = data.purchases.map(mapServerPurchaseToLocal)
        cache["ll_purchases"] = localPurchases
        lastSyncedValues["ll_purchases"] = JSON.stringify(localPurchases)
      }

      if (data.invoices) {
        const localInvoices = data.invoices.map(mapServerInvoiceToLocal)
        cache["ll_quote_invoices"] = localInvoices
        lastSyncedValues["ll_quote_invoices"] = JSON.stringify(localInvoices)
      }

      if (data.transactions) {
        const localTxns = data.transactions.map(mapServerTransactionToLocal)
        cache["ll_txns"] = localTxns
        lastSyncedValues["ll_txns"] = JSON.stringify(localTxns)
      }

      if (data.clients) {
        const list = Array.isArray(data.clients) ? data.clients : (data.clients.data || [])
        const localClients = list.map(c => ({
          id: c.id,
          name: c.name,
          phone: c.phone || "",
          email: c.email || "",
          address: c.address || "",
          notes: c.notes || "",
          lastOrder: c.lastOrderDate ? c.lastOrderDate.split("T")[0] : (c.updatedAt ? c.updatedAt.split("T")[0] : ""),
          ordersCount: c._count?.orders || 0,
          createdAt: c.createdAt
        }))
        cache["ll_clients"] = localClients
        lastSyncedValues["ll_clients"] = JSON.stringify(localClients)
      }

      if (Array.isArray(data.openingStock)) {
        const byMonth = {}
        data.openingStock.forEach(os => {
          const m = os.month || new Date().toISOString().slice(0, 7)
          if (!byMonth[m]) byMonth[m] = { month: m, items: [], locked: false }
          byMonth[m].items.push({
            id: os.id,
            itemId: os.itemId,
            name: os.name,
            unit: os.unit || "kg",
            cost: Number(os.cost) || 0,
            openingQty: Number(os.openingQty) || 0,
            locked: !!os.locked
          })
          if (os.locked) byMonth[m].locked = true
        })
        const curMonth = new Date().toISOString().slice(0, 7)
        Object.entries(byMonth).forEach(([m, payload]) => {
          cache["ll_os_" + m] = payload
          if (m === curMonth) {
            cache["ll_opening_stock"] = payload
          }
        })
      }

      if (isAlreadyOnboarded) {
        cache["ll_onboarded"] = "1"
      }

      return true
    }

    // 2. Fallback to individual endpoints if bootstrap endpoint is unavailable
    const tenantRes = await fetch(`${apiUrl}/api/tenant`, { headers })
    if (!tenantRes.ok) return false
    const tenant = await tenantRes.json()

    const tenantInfo = {
      id: tenant.id,
      name: tenant.name,
      createdAt: tenant.createdAt,
      tokenBalance: tenant.tokenBalance,
      settings: {
        plan: tenant.settings?.plan || "Free",
        status: tenant.settings?.status || "Active"
      }
    }
    cache["ll_tenant_info"] = tenantInfo

    const keysToIgnoreOnLogin = ["ll_calc_state", "ll_calc_edit", "ll_calc_prefill", "ll_quote_prefill"]
    keysToIgnoreOnLogin.forEach(k => {
      delete cache[k]
    })

    let isAlreadyOnboarded = false
    const config = tenant.settings?.appConfig || null
    if (config) {
      if (config.ll_onboarded === "1" || config.ll_onboarded === 1 || config.ll_co || config.ll_multipliers) {
        isAlreadyOnboarded = true
      }
      Object.entries(config).forEach(([k, v]) => {
        if (v !== null && !keysToIgnoreOnLogin.includes(k)) {
          let parsed;
          try {
            parsed = typeof v === "string" ? JSON.parse(v) : v
          } catch {
            parsed = v
          }
          cache[k] = parsed
          if (k === "ll_anthropic_key") {
            window.__anthropic_key = parsed
          }
        }
      })
    }

    const [invRes, recipesRes, ordersRes, expensesRes, purchasesRes, invoicesRes, txnsRes, clientsRes] = await Promise.all([
      fetch(`${apiUrl}/api/inventory`, { headers }),
      fetch(`${apiUrl}/api/recipes`, { headers }),
      fetch(`${apiUrl}/api/orders`, { headers }),
      fetch(`${apiUrl}/api/expenses`, { headers }),
      fetch(`${apiUrl}/api/purchases`, { headers }),
      fetch(`${apiUrl}/api/invoices`, { headers }),
      fetch(`${apiUrl}/api/transactions`, { headers }),
      fetch(`${apiUrl}/api/clients`, { headers })
    ])

    if (invRes.ok) {
      const serverInv = await invRes.json()
      if (serverInv.length > 0) isAlreadyOnboarded = true
      const localInv = serverInv.map(mapServerInventoryToLocal)
      cache["ll_inv"] = localInv
      lastSyncedValues["ll_inv"] = JSON.stringify(localInv)
    }

    if (recipesRes.ok) {
      const serverRecipes = await recipesRes.json()
      if (serverRecipes.length > 0) isAlreadyOnboarded = true
      const localRecipes = serverRecipes.map(mapServerRecipeToLocal)
      cache["ll_recipes"] = localRecipes
      lastSyncedValues["ll_recipes"] = JSON.stringify(localRecipes)
    }

    if (ordersRes.ok) {
      const serverOrders = await ordersRes.json()
      if (serverOrders.length > 0) isAlreadyOnboarded = true
      const localProds = []
      const localQuotes = []
      serverOrders.forEach(o => {
        const localOrder = mapServerOrderToLocal(o)
        if (o.status === "quote") {
          localQuotes.push(localOrder)
        } else {
          localProds.push(localOrder)
        }
      })
      cache["ll_prods"] = localProds
      lastSyncedValues["ll_prods"] = JSON.stringify(localProds)

      cache["ll_quotes"] = localQuotes
      lastSyncedValues["ll_quotes"] = JSON.stringify(localQuotes)
    }

    if (expensesRes.ok) {
      const serverExpenses = await expensesRes.json()
      const localExpenses = serverExpenses.map(mapServerExpenseToLocal)
      cache["ll_exp"] = localExpenses
      lastSyncedValues["ll_exp"] = JSON.stringify(localExpenses)
    }

    if (purchasesRes.ok) {
      const serverPurchases = await purchasesRes.json()
      const localPurchases = serverPurchases.map(mapServerPurchaseToLocal)
      cache["ll_purchases"] = localPurchases
      lastSyncedValues["ll_purchases"] = JSON.stringify(localPurchases)
    }

    if (invoicesRes.ok) {
      const serverInvoices = await invoicesRes.json()
      const localInvoices = serverInvoices.map(mapServerInvoiceToLocal)
      cache["ll_quote_invoices"] = localInvoices
      lastSyncedValues["ll_quote_invoices"] = JSON.stringify(localInvoices)
    }

    if (txnsRes && txnsRes.ok) {
      const serverTxns = await txnsRes.json()
      const localTxns = serverTxns.map(mapServerTransactionToLocal)
      cache["ll_txns"] = localTxns
      lastSyncedValues["ll_txns"] = JSON.stringify(localTxns)
    }

    if (clientsRes && clientsRes.ok) {
      const serverClients = await clientsRes.json()
      const list = Array.isArray(serverClients) ? serverClients : (serverClients.data || [])
      const localClients = list.map(c => ({
        id: c.id,
        name: c.name,
        phone: c.phone || "",
        email: c.email || "",
        address: c.address || "",
        notes: c.notes || "",
        lastOrder: c.lastOrderDate ? c.lastOrderDate.split("T")[0] : (c.updatedAt ? c.updatedAt.split("T")[0] : ""),
        ordersCount: c._count?.orders || 0,
        createdAt: c.createdAt
      }))
      cache["ll_clients"] = localClients
      lastSyncedValues["ll_clients"] = JSON.stringify(localClients)
    }

    if (isAlreadyOnboarded) {
      cache["ll_onboarded"] = "1"
    }

    return true
  } catch (error) {
    console.error("Sync from backend error:", error)
  }
  return false
}

export const clearTempCalculatorState = () => {
  const keys = ["ll_calc_state", "ll_calc_edit", "ll_calc_prefill", "ll_quote_prefill"]
  keys.forEach(k => {
    delete cache[k]
    try {
      sessionStorage.removeItem(k)
    } catch (e) {
      /* ignore error */
    }
  })
}

export const logout = () => {
  clearTempCalculatorState()
  Object.keys(cache).forEach(k => {
    delete cache[k]
  })
  Object.keys(lastSyncedValues).forEach(k => {
    delete lastSyncedValues[k]
  })
  try {
    sessionStorage.removeItem("ll_current_user")
    sessionStorage.removeItem("ll_tenant_info")
    // Remove all cache-related keys from sessionStorage
    const keysToRemove = []
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i)
      if (key && key.startsWith("ll_")) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach(k => sessionStorage.removeItem(k))
  } catch (e) {
    // Ignore
  }
  try {
    localStorage.removeItem("ll_current_user")
    localStorage.removeItem("ll_token")
  } catch (e) {
    // Ignore
  }
}

export const clearAllDataOnServer = async () => {
  const headers = getAuthHeaders()
  if (!headers) return false
  const apiUrl = import.meta.env.VITE_API_URL
  if (!apiUrl) return false

  try {
    // 1. Direct database wipe via backend transaction
    const res = await fetch(`${apiUrl}/api/tenant/data`, {
      method: "DELETE",
      headers
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.error("Failed to clear tenant data on server:", err.message)
    }

    // 2. Clear in-memory caches
    Object.keys(cache).forEach(k => {
      delete cache[k]
    })
    Object.keys(lastSyncedValues).forEach(k => {
      delete lastSyncedValues[k]
    })

    // 3. Clear all browser storage
    try {
      localStorage.clear()
      sessionStorage.clear()
    } catch {
      // Ignore storage access errors
    }

    return true
  } catch (e) {
    console.error("Failed to clear server data:", e)
    return false
  }
}

export const deleteAllInventoryOnServer = async () => {
  const headers = getAuthHeaders()
  if (!headers) return false
  const apiUrl = import.meta.env.VITE_API_URL
  if (!apiUrl) return false

  try {
    const res = await fetch(`${apiUrl}/api/inventory/all`, {
      method: "DELETE",
      headers
    })
    if (res.ok) {
      cache["ll_inv"] = []
      lastSyncedValues["ll_inv"] = JSON.stringify([])
      return true
    } else {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || "Failed to delete all inventory from server")
    }
  } catch (e) {
    console.error("deleteAllInventoryOnServer error:", e)
    throw e
  }
}

export const batchDeleteInventoryOnServer = async (ids) => {
  if (!ids || !ids.length) return false
  const headers = getAuthHeaders()
  if (!headers) return false
  const apiUrl = import.meta.env.VITE_API_URL
  if (!apiUrl) return false

  try {
    const res = await fetch(`${apiUrl}/api/inventory/batch-delete`, {
      method: "POST",
      headers,
      body: JSON.stringify({ ids })
    })
    if (res.ok) {
      const idSet = new Set(ids)
      const curInv = Array.isArray(cache["ll_inv"]) ? cache["ll_inv"] : []
      const remaining = curInv.filter(i => !idSet.has(i.id))
      cache["ll_inv"] = remaining
      lastSyncedValues["ll_inv"] = JSON.stringify(remaining)
      return true
    } else {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || "Failed to batch delete inventory items from server")
    }
  } catch (e) {
    console.error("batchDeleteInventoryOnServer error:", e)
    throw e
  }
}

export const deleteOpeningStockOnServer = async (month) => {
  const headers = getAuthHeaders()
  if (!headers) return false
  const apiUrl = import.meta.env.VITE_API_URL
  if (!apiUrl) return false

  try {
    const url = month ? `${apiUrl}/api/opening-stock?month=${encodeURIComponent(month)}` : `${apiUrl}/api/opening-stock`
    let res = await fetch(url, {
      method: "DELETE",
      headers
    })
    if (!res.ok && !month) {
      res = await fetch(`${apiUrl}/api/inventory/opening-stock`, {
        method: "DELETE",
        headers
      })
    }
    if (res.ok) {
      const curMonthStr = new Date().toISOString().slice(0, 7)
      if (month) {
        delete cache["ll_os_" + month]
        if (month === curMonthStr) {
          delete cache["ll_opening_stock"]
        }
        try {
          localStorage.removeItem("ll_os_" + month)
          if (month === curMonthStr) localStorage.removeItem("ll_opening_stock")
          sessionStorage.removeItem("ll_os_" + month)
          if (month === curMonthStr) sessionStorage.removeItem("ll_opening_stock")
        } catch {
          // Ignore local storage errors
        }
      } else {
        delete cache["ll_opening_stock"]
        Object.keys(cache).forEach(k => {
          if (k.startsWith("ll_os_")) delete cache[k]
        })
        try {
          localStorage.removeItem("ll_opening_stock")
          Object.keys(localStorage).forEach(k => {
            if (k.startsWith("ll_os_") && k !== "ll_os_migrated") localStorage.removeItem(k)
          })
          sessionStorage.removeItem("ll_opening_stock")
          Object.keys(sessionStorage).forEach(k => {
            if (k.startsWith("ll_os_") && k !== "ll_os_migrated") sessionStorage.removeItem(k)
          })
        } catch {
          // Ignore local storage errors
        }
      }
      return true
    } else {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || "Failed to delete opening stock from server")
    }
  } catch (e) {
    console.error("deleteOpeningStockOnServer error:", e)
    throw e
  }
}

export const deleteOpeningStockItemOnServer = async (id) => {
  const headers = getAuthHeaders()
  if (!headers) return false
  const apiUrl = import.meta.env.VITE_API_URL
  if (!apiUrl) return false

  try {
    const res = await fetch(`${apiUrl}/api/opening-stock/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || "Failed to delete opening stock item from server")
    }

    // Also update in-memory cache
    Object.keys(cache).forEach(k => {
      if ((k === "ll_opening_stock" || k.startsWith("ll_os_")) && cache[k]) {
        if (Array.isArray(cache[k].items)) {
          cache[k].items = cache[k].items.filter(it => it.id !== id)
        } else if (Array.isArray(cache[k])) {
          cache[k] = cache[k].filter(it => it.id !== id)
        }
      }
    })
    return true
  } catch (e) {
    console.error("deleteOpeningStockItemOnServer error:", e)
    throw e
  }
}

export const createOpeningStockOnServer = async (itemData) => {
  const headers = getAuthHeaders()
  if (!headers) return null
  const apiUrl = import.meta.env.VITE_API_URL
  if (!apiUrl) return null

  try {
    const res = await fetch(`${apiUrl}/api/opening-stock`, {
      method: "POST",
      headers,
      body: JSON.stringify(itemData)
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || "Failed to create opening stock item on server")
    }
    const created = await res.json()
    return created
  } catch (e) {
    console.error("createOpeningStockOnServer error:", e)
    throw e
  }
}

export const updateOpeningStockItemOnServer = async (id, itemData) => {
  const headers = getAuthHeaders()
  if (!headers) return null
  const apiUrl = import.meta.env.VITE_API_URL
  if (!apiUrl) return null

  try {
    const res = await fetch(`${apiUrl}/api/opening-stock/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers,
      body: JSON.stringify(itemData)
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || "Failed to update opening stock item on server")
    }
    const updated = await res.json()
    return updated
  } catch (e) {
    console.error("updateOpeningStockItemOnServer error:", e)
    throw e
  }
}

export const lockOpeningStockMonthOnServer = async (month, locked = true) => {
  const headers = getAuthHeaders()
  if (!headers) return false
  const apiUrl = import.meta.env.VITE_API_URL
  if (!apiUrl) return false

  try {
    const res = await fetch(`${apiUrl}/api/opening-stock/lock`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ month, locked: !!locked })
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || "Failed to update lock status on server")
    }
    const result = await res.json()
    const targetMonth = month || new Date().toISOString().slice(0, 7)
    if (cache["ll_os_" + targetMonth]) {
      cache["ll_os_" + targetMonth].locked = !!locked
    }
    return result
  } catch (e) {
    console.error("lockOpeningStockMonthOnServer error:", e)
    throw e
  }
}




// Inventory
export const loadInventory = (def = []) => {
  const t = load("ll_inv", null)
  return t && t.length > 0 ? t : (def || [])
}

export const fetchFreshInventoryFromServer = async () => {
  const headers = getAuthHeaders()
  if (!headers) throw new Error("You are not logged in. Please log in to load database records.")
  const apiUrl = import.meta.env.VITE_API_URL
  if (!apiUrl) throw new Error("API URL is not configured.")

  const res = await fetch(`${apiUrl}/api/inventory`, { headers })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || `Failed to fetch inventory from server (${res.status})`)
  }
  const items = await res.json()
  const localInv = Array.isArray(items) ? items.map(mapServerInventoryToLocal) : []
  cache["ll_inv"] = localInv
  lastSyncedValues["ll_inv"] = JSON.stringify(localInv)
  return localInv
}

export const createInventoryItemOnServer = async (item) => {
  const headers = getAuthHeaders()
  if (!headers) throw new Error("You are not logged in. Please log in to save items directly to the database.")
  const apiUrl = import.meta.env.VITE_API_URL
  if (!apiUrl) throw new Error("API URL is not configured.")

  const payload = {
    id: item.id || undefined,
    name: item.name,
    category: item.cat || item.category || "Other",
    unit: item.unit || "unit",
    cost: Number(item.cost) || 0,
    stock: Number(item.stock) || 0,
    minStock: Number(item.minStock) || 0
  }

  const res = await fetch(`${apiUrl}/api/inventory`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload)
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || `Database error creating inventory item (${res.status})`)
  }

  const serverItem = await res.json()
  const localItem = mapServerInventoryToLocal(serverItem)
  
  const curInv = Array.isArray(cache["ll_inv"]) ? cache["ll_inv"] : []
  const updated = [...curInv.filter(i => i.id !== localItem.id), localItem]
  cache["ll_inv"] = updated
  lastSyncedValues["ll_inv"] = JSON.stringify(updated)
  return localItem
}

export const updateInventoryItemOnServer = async (id, item) => {
  const headers = getAuthHeaders()
  if (!headers) throw new Error("You are not logged in. Please log in to update items in the database.")
  const apiUrl = import.meta.env.VITE_API_URL
  if (!apiUrl) throw new Error("API URL is not configured.")

  const payload = {
    name: item.name,
    category: item.cat || item.category,
    unit: item.unit,
    cost: Number(item.cost),
    stock: Number(item.stock),
    minStock: Number(item.minStock)
  }

  const res = await fetch(`${apiUrl}/api/inventory/${id}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(payload)
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || `Database error updating inventory item (${res.status})`)
  }

  const serverItem = await res.json()
  const localItem = mapServerInventoryToLocal(serverItem)

  const curInv = Array.isArray(cache["ll_inv"]) ? cache["ll_inv"] : []
  const updated = curInv.map(i => i.id === id ? localItem : i)
  cache["ll_inv"] = updated
  lastSyncedValues["ll_inv"] = JSON.stringify(updated)
  return localItem
}

export const deleteInventoryItemOnServer = async (id) => {
  const headers = getAuthHeaders()
  if (!headers) throw new Error("You are not logged in. Please log in to delete items from the database.")
  const apiUrl = import.meta.env.VITE_API_URL
  if (!apiUrl) throw new Error("API URL is not configured.")

  const res = await fetch(`${apiUrl}/api/inventory/${id}`, {
    method: "DELETE",
    headers
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || `Database error deleting inventory item (${res.status})`)
  }

  const curInv = Array.isArray(cache["ll_inv"]) ? cache["ll_inv"] : []
  const updated = curInv.filter(i => i.id !== id)
  cache["ll_inv"] = updated
  lastSyncedValues["ll_inv"] = JSON.stringify(updated)
  return true
}

export const saveInventory = async (data) => {
  cache["ll_inv"] = data
  const headers = getAuthHeaders()
  if (!headers) return
  await syncInventoryItems(headers, data)
}

// Productions
export const loadProductions = (def = []) => load("ll_prods", def)
export const saveProductionsList = async (data) => {
  cache["ll_prods"] = data
  const headers = getAuthHeaders()
  if (!headers) return
  await syncOrdersList(headers, data, load("ll_quotes", []), load("ll_inv", []), load("ll_recipes", []))
}
export const saveProduction = async (prod) => {
  const all = load("ll_prods", [])
  const exists = all.find(p => p.id === prod.id)
  const updated = exists ? all.map(p => p.id === prod.id ? prod : p) : [...all, prod]
  await saveProductionsList(updated)
}
export const updateProdStatus = async (id, status) => {
  const all = load("ll_prods", [])
  const updated = all.map(p => p.id === id ? { ...p, status } : p)
  await saveProductionsList(updated)
}

// Transactions
export const loadTransactions = (def = []) => load("ll_txns", def)
export const saveTxns = async (data) => await save("ll_txns", data)

// Expenses
export const loadExpenses = (def = []) => load("ll_exp", def)
export const saveExpenses = async (data) => {
  cache["ll_exp"] = data
  const headers = getAuthHeaders()
  if (!headers) return
  await syncExpensesList(headers, data)
}

// Settings
export const loadSetting = (key, def) => load("ll_setting_" + key, def)
export const saveSetting = async (key, val) => await save("ll_setting_" + key, val)

// Company
export const loadCompany = () => load("ll_co", {
  name: "My Bakery",
  address: "Abuja, Nigeria",
  phone: "",
  email: "",
  pin: "1234",
  primaryColor: "#f6ae13",
  sidebarColor: "#0a0a0a",
})
export const saveCompany = async (data) => await save("ll_co", data)

// Quotes
export const loadQuotes = (def = []) => load("ll_quotes", def)
export const saveQuotes = async (data) => {
  cache["ll_quotes"] = data
  const headers = getAuthHeaders()
  if (!headers) return
  await syncOrdersList(headers, load("ll_prods", []), data, load("ll_inv", []), load("ll_recipes", []))
}

// Invoices
export const loadInvoices = () => load("ll_invoices", [])
export const saveInvoice = async (data) => await save("ll_invoices", data)

// Users
export const loadUsers = () => load("ll_users", [{ id: "u1", name: "Owner", pin: "1234", role: "owner" }])
export const saveUsers = async (data) => await save("ll_users", data)

// Recipes
export const loadRecipes = () => load("ll_recipes", null)

export const createRecipeOnServer = async (rec) => {
  const headers = getAuthHeaders()
  if (!headers) throw new Error("You are not logged in. Please log in to save recipes directly to the database.")
  const apiUrl = import.meta.env.VITE_API_URL
  if (!apiUrl) throw new Error("API URL is not configured.")

  const body = {
    id: rec.id || undefined,
    name: rec.name || "Recipe",
    notes: rec.notes || "",
    type: rec.type || "layer",
    batchWeight: rec.batchWeight !== undefined && rec.batchWeight !== null && rec.batchWeight !== "" ? Number(rec.batchWeight) : null,
    batchSize: rec.batchSize !== undefined && rec.batchSize !== null && rec.batchSize !== "" ? Number(rec.batchSize) : null,
    ingredients: (rec.ing || []).filter(i => i.iid && Number(i.qty) > 0).map(i => ({
      item: i.iid,
      quantity: Number(i.qty)
    }))
  }

  const res = await fetch(`${apiUrl}/api/recipes`, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || `Database error creating recipe (${res.status})`)
  }

  const serverRec = await res.json()
  const localRec = mapServerRecipeToLocal(serverRec)
  const curRecs = Array.isArray(cache["ll_recipes"]) ? cache["ll_recipes"] : []
  const updated = [...curRecs.filter(r => r.id !== localRec.id), localRec]
  cache["ll_recipes"] = updated
  lastSyncedValues["ll_recipes"] = JSON.stringify(updated)
  return localRec
}

export const updateRecipeOnServer = async (id, rec) => {
  const headers = getAuthHeaders()
  if (!headers) throw new Error("You are not logged in. Please log in to update recipes in the database.")
  const apiUrl = import.meta.env.VITE_API_URL
  if (!apiUrl) throw new Error("API URL is not configured.")

  const body = {
    name: rec.name,
    notes: rec.notes || "",
    type: rec.type || "layer",
    batchWeight: rec.batchWeight !== undefined && rec.batchWeight !== null && rec.batchWeight !== "" ? Number(rec.batchWeight) : null,
    batchSize: rec.batchSize !== undefined && rec.batchSize !== null && rec.batchSize !== "" ? Number(rec.batchSize) : null,
    ingredients: (rec.ing || []).filter(i => i.iid && Number(i.qty) > 0).map(i => ({
      item: i.iid,
      quantity: Number(i.qty)
    }))
  }

  const res = await fetch(`${apiUrl}/api/recipes/${id}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(body)
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || `Database error updating recipe (${res.status})`)
  }

  const serverRec = await res.json()
  const localRec = mapServerRecipeToLocal(serverRec)
  const curRecs = Array.isArray(cache["ll_recipes"]) ? cache["ll_recipes"] : []
  const updated = curRecs.map(r => r.id === id ? localRec : r)
  cache["ll_recipes"] = updated
  lastSyncedValues["ll_recipes"] = JSON.stringify(updated)
  return localRec
}

export const deleteRecipeOnServer = async (id) => {
  const headers = getAuthHeaders()
  if (!headers) throw new Error("You are not logged in. Please log in to delete recipes from the database.")
  const apiUrl = import.meta.env.VITE_API_URL
  if (!apiUrl) throw new Error("API URL is not configured.")

  const res = await fetch(`${apiUrl}/api/recipes/${id}`, {
    method: "DELETE",
    headers
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || `Database error deleting recipe (${res.status})`)
  }

  const curRecs = Array.isArray(cache["ll_recipes"]) ? cache["ll_recipes"] : []
  const updated = curRecs.filter(r => r.id !== id)
  cache["ll_recipes"] = updated
  lastSyncedValues["ll_recipes"] = JSON.stringify(updated)
  return true
}

export const saveRecipes = async (data) => {
  cache["ll_recipes"] = data
  const headers = getAuthHeaders()
  if (!headers) return
  await syncRecipesList(headers, data)
}

// Clients
export const loadClients = () => load("ll_clients", [])
export const saveClients = async (data) => await save("ll_clients", data)
export const upsertClient = async (name, phone = "", email = "", address = "", notes = "", birthday = "") => {
  if (!name || !name.trim()) return null
  const cleanName = name.trim()
  const lowerName = cleanName.toLowerCase()
  if (["walk-in", "gift", "sample/tasting", "unknown client"].includes(lowerName)) return null

  const all = loadClients()
  const existing = all.find(c => (c.name || "").toLowerCase() === lowerName)
  const todayStr = new Date().toISOString().slice(0, 10)

  let updatedList
  let targetClient
  if (existing) {
    targetClient = {
      ...existing,
      phone: phone || existing.phone,
      email: email || existing.email,
      address: address || existing.address,
      notes: notes || existing.notes,
      birthday: birthday || existing.birthday || "",
      lastOrder: todayStr,
      ordersCount: (existing.ordersCount || 0) + 1
    }
    updatedList = all.map(c => c.id === existing.id ? targetClient : c)
  } else {
    targetClient = {
      id: "cl_" + Date.now(),
      name: cleanName,
      phone: phone || "",
      email: email || "",
      address: address || "",
      notes: notes || "",
      birthday: birthday || "",
      lastOrder: todayStr,
      ordersCount: 1,
      createdAt: new Date().toISOString()
    }
    updatedList = [targetClient, ...all]
  }
  await save("ll_clients", updatedList)
  return targetClient
}
export const deleteClient = async (id) => {
  const all = loadClients()
  const updated = all.filter(c => c.id !== id)
  await save("ll_clients", updated)
  await deleteClientOnServer(id)
  return updated
}

export const fetchPaginatedClients = async ({ page = 1, limit = 25, search = "" } = {}) => {
  const apiUrl = import.meta.env.VITE_API_URL
  const headers = getAuthHeaders()
  if (!apiUrl || !headers) {
    const all = loadClients()
    let filtered = all
    if (search.trim()) {
      const q = search.toLowerCase()
      filtered = all.filter(c =>
        (c.name || "").toLowerCase().includes(q) ||
        (c.phone || "").toLowerCase().includes(q) ||
        (c.email || "").toLowerCase().includes(q) ||
        (c.address || "").toLowerCase().includes(q) ||
        (c.birthday || "").toLowerCase().includes(q) ||
        (c.notes || "").toLowerCase().includes(q)
      )
    }
    const sz = limit === "all" ? filtered.length : Number(limit) || 25
    const start = (page - 1) * sz
    const slice = filtered.slice(start, start + sz)
    const currentMonthName = new Date().toLocaleString("en-US", { month: "long" })
    return {
      data: slice,
      pagination: {
        page: Number(page),
        limit: sz,
        total: filtered.length,
        totalPages: Math.ceil(filtered.length / (sz || 1)) || 1
      },
      stats: {
        totalClients: all.length,
        totalWithPhone: all.filter(c => !!c.phone).length,
        birthdaysThisMonth: all.filter(c => c.birthday && c.birthday.toLowerCase().includes(currentMonthName.toLowerCase())).length
      }
    }
  }

  try {
    const params = new URLSearchParams()
    if (page) params.set("page", page)
    if (limit) params.set("limit", limit)
    if (search && search.trim()) params.set("search", search.trim())

    const res = await fetch(`${apiUrl}/api/clients?${params.toString()}`, { headers })
    if (res.ok) {
      const json = await res.json()
      if (json && json.data) {
        return json
      }
      if (Array.isArray(json)) {
        return {
          data: json,
          pagination: { page: 1, limit: json.length, total: json.length, totalPages: 1 },
          stats: { totalClients: json.length, totalWithPhone: json.filter(c => !!c.phone).length, birthdaysThisMonth: 0 }
        }
      }
    }
  } catch (err) {
    console.warn("fetchPaginatedClients server error:", err)
  }

  const all = loadClients()
  return {
    data: all.slice(0, 25),
    pagination: { page: 1, limit: 25, total: all.length, totalPages: Math.ceil(all.length / 25) || 1 },
    stats: { totalClients: all.length, totalWithPhone: all.filter(c => !!c.phone).length, birthdaysThisMonth: 0 }
  }
}

export const createClientOnServer = async (clientData) => {
  const apiUrl = import.meta.env.VITE_API_URL
  const headers = getAuthHeaders()
  if (apiUrl && headers) {
    try {
      const res = await fetch(`${apiUrl}/api/clients`, {
        method: "POST",
        headers,
        body: JSON.stringify(clientData)
      })
      if (res.ok) {
        return await res.json()
      }
    } catch (e) {
      console.warn("createClientOnServer error:", e)
    }
  }
  return null
}

export const updateClientOnServer = async (id, clientData) => {
  const apiUrl = import.meta.env.VITE_API_URL
  const headers = getAuthHeaders()
  if (apiUrl && headers) {
    try {
      const res = await fetch(`${apiUrl}/api/clients/${id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify(clientData)
      })
      if (res.ok) {
        return await res.json()
      }
    } catch (e) {
      console.warn("updateClientOnServer error:", e)
    }
  }
  return null
}

export const deleteClientOnServer = async (id) => {
  const apiUrl = import.meta.env.VITE_API_URL
  const headers = getAuthHeaders()
  if (apiUrl && headers) {
    try {
      const res = await fetch(`${apiUrl}/api/clients/${id}`, {
        method: "DELETE",
        headers
      })
      return res.ok
    } catch (e) {
      console.warn("deleteClientOnServer error:", e)
    }
  }
  return false
}

// Tenant Metadata
export const loadTenantInfo = () => load("ll_tenant_info", null)

// Aliases for receipt scanner ingredient mapping
export const loadAliases = (def = {}) => load("ll_aliases", def)
export const saveAliases = async (data) => await save("ll_aliases", data)

// Opening Stock (PostgreSQL / Neon is Single Source of Truth)
export const loadOpeningStock = (month) => {
  const currentMonthStr = month || new Date().toISOString().slice(0, 7)
  const cached = cache["ll_os_" + currentMonthStr]
  if (cached && Array.isArray(cached.items) && cached.items.length > 0) {
    return cached.items
  }
  if (Array.isArray(cached) && cached.length > 0) return cached

  // Fall back to baseline opening stock
  const curCached = cache["ll_opening_stock"]
  if (curCached) {
    if (Array.isArray(curCached.items) && curCached.items.length > 0) {
      return curCached.items
    }
    if (Array.isArray(curCached) && curCached.length > 0) return curCached
  }
  return []
}

export const fetchOpeningStockFromServer = async (month) => {
  const headers = getAuthHeaders()
  if (!headers) return null
  const apiUrl = import.meta.env.VITE_API_URL
  if (!apiUrl) return null
  const targetMonth = month || new Date().toISOString().slice(0, 7)
  try {
    const res = await fetch(`${apiUrl}/api/opening-stock?month=${encodeURIComponent(targetMonth)}`, { headers })
    if (!res.ok) return null
    const data = await res.json()
    if (Array.isArray(data)) {
      const items = data.map(os => ({
        id: os.id,
        itemId: os.itemId,
        name: os.name,
        unit: os.unit || "kg",
        cost: Number(os.cost) || 0,
        openingQty: Number(os.openingQty) || 0,
        locked: !!os.locked
      }))
      const isLocked = data.some(d => d.locked)
      const payload = { month: targetMonth, items, locked: isLocked }
      cache["ll_os_" + targetMonth] = payload
      if (targetMonth === new Date().toISOString().slice(0, 7) || !cache["ll_opening_stock"]) {
        cache["ll_opening_stock"] = payload
      }
      return items
    }
  } catch (e) {
    console.warn("fetchOpeningStockFromServer error:", e)
  }
  return null
}

export const saveOpeningStock = async (items, month, locked = false) => {
  const currentMonthStr = month || new Date().toISOString().slice(0, 7)
  const payload = { month: currentMonthStr, items, locked: !!locked }
  cache["ll_os_" + currentMonthStr] = payload
  cache["ll_opening_stock"] = payload

  // Persist directly to PostgreSQL backend
  const headers = getAuthHeaders()
  const apiUrl = import.meta.env.VITE_API_URL
  if (headers && apiUrl) {
    try {
      await fetch(`${apiUrl}/api/opening-stock/bulk`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          month: currentMonthStr,
          items,
          locked: !!locked
        })
      })
    } catch (err) {
      console.warn("saveOpeningStock server sync error:", err)
    }
  }

  return payload
}

/**
 * Safe one-time migration:
 * 1. Checks if already migrated (flag: ll_os_migrated).
 * 2. Scans localStorage/sessionStorage for any existing opening stock data.
 * 3. For each month found, queries the backend to ensure no duplicate rows are created.
 * 4. Uploads legacy data to PostgreSQL if the backend doesn't already have records for that month.
 * 5. Cleans up local storage keys ONLY after successful verification.
 */
export const migrateLocalStorageOpeningStockToDatabase = async () => {
  if (typeof window === "undefined" || !window.localStorage) return true
  const isMigrated = localStorage.getItem("ll_os_migrated")
  if (isMigrated === "true") return true

  const headers = getAuthHeaders()
  const apiUrl = import.meta.env.VITE_API_URL
  if (!headers || !apiUrl) return false

  try {
    const currentMonthStr = new Date().toISOString().slice(0, 7)
    const osEntries = new Map() // month -> { items: [], locked: boolean }

    const parseOS = (raw) => {
      if (!raw) return null
      try {
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw
        if (parsed && Array.isArray(parsed.items) && parsed.items.length > 0) {
          return { items: parsed.items, locked: !!parsed.locked, month: parsed.month }
        }
        if (Array.isArray(parsed) && parsed.length > 0) {
          return { items: parsed, locked: false, month: currentMonthStr }
        }
      } catch {
        // Ignore invalid JSON / corrupted cache
      }
      return null
    }

    // Inspect localStorage
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key) continue
      if (key === "ll_opening_stock" || (key.startsWith("ll_os_") && key !== "ll_os_migrated")) {
        const parsed = parseOS(localStorage.getItem(key))
        if (parsed) {
          const m = (key.startsWith("ll_os_") ? key.replace("ll_os_", "") : parsed.month) || currentMonthStr
          if (!osEntries.has(m)) {
            osEntries.set(m, parsed)
          }
        }
      }
    }

    // Inspect sessionStorage
    if (window.sessionStorage) {
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i)
        if (!key) continue
        if (key === "ll_opening_stock" || (key.startsWith("ll_os_") && key !== "ll_os_migrated")) {
          const parsed = parseOS(sessionStorage.getItem(key))
          if (parsed) {
            const m = (key.startsWith("ll_os_") ? key.replace("ll_os_", "") : parsed.month) || currentMonthStr
            if (!osEntries.has(m)) {
              osEntries.set(m, parsed)
            }
          }
        }
      }
    }

    // If nothing to migrate, mark flag and finish
    if (osEntries.size === 0) {
      localStorage.setItem("ll_os_migrated", "true")
      return true
    }

    // Process each month: check DB first to avoid duplicate records
    for (const [month, data] of osEntries.entries()) {
      let alreadyInDb = false
      try {
        const checkRes = await fetch(`${apiUrl}/api/opening-stock?month=${encodeURIComponent(month)}`, { headers })
        if (checkRes.ok) {
          const existing = await checkRes.json()
          if (Array.isArray(existing) && existing.length > 0) {
            alreadyInDb = true
          }
        }
      } catch (err) {
        console.warn("Migration DB check error for month", month, err)
      }

      if (!alreadyInDb && data.items.length > 0) {
        const uploadRes = await fetch(`${apiUrl}/api/opening-stock/bulk`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            month,
            items: data.items,
            locked: !!data.locked
          })
        })
        if (!uploadRes.ok) {
          console.warn("Migration upload failed for month", month)
          return false
        }
      }
    }

    // Once successfully verified, purge local storage
    localStorage.removeItem("ll_opening_stock")
    Object.keys(localStorage).forEach(k => {
      if (k.startsWith("ll_os_") && k !== "ll_os_migrated") {
        localStorage.removeItem(k)
      }
    })
    if (window.sessionStorage) {
      sessionStorage.removeItem("ll_opening_stock")
      Object.keys(sessionStorage).forEach(k => {
        if (k.startsWith("ll_os_") && k !== "ll_os_migrated") {
          sessionStorage.removeItem(k)
        }
      })
    }
    localStorage.setItem("ll_os_migrated", "true")
    return true
  } catch (e) {
    console.warn("migrateLocalStorageOpeningStockToDatabase notice:", e)
    return false
  }
}

// Pricing & Multipliers (PostgreSQL / Neon is Single Source of Truth)
export const fetchPricingSettingsFromServer = async () => {
  const headers = getAuthHeaders()
  if (!headers) return null
  const apiUrl = import.meta.env.VITE_API_URL
  if (!apiUrl) return null

  try {
    const res = await fetch(`${apiUrl}/api/tenant/pricing`, { headers })
    if (!res.ok) return null
    const data = await res.json()

    if (data && data.multipliers) {
      cache["ll_multipliers"] = data.multipliers
      if (data.profitPct !== undefined) cache["ll_setting_profitPct"] = data.profitPct
      if (data.overheadPct !== undefined) cache["ll_setting_overheadPct"] = data.overheadPct
      if (data.accessoryPct !== undefined) cache["ll_setting_accessoryPct"] = data.accessoryPct
      if (data.miscPct !== undefined) cache["ll_setting_miscPct"] = data.miscPct
      return data
    }
  } catch (e) {
    console.warn("fetchPricingSettingsFromServer error:", e)
  }
  return null
}

export const savePricingSettingsOnServer = async (pricingData) => {
  if (pricingData.multipliers) {
    cache["ll_multipliers"] = pricingData.multipliers
  }
  if (pricingData.profitPct !== undefined) cache["ll_setting_profitPct"] = pricingData.profitPct
  if (pricingData.overheadPct !== undefined) cache["ll_setting_overheadPct"] = pricingData.overheadPct
  if (pricingData.accessoryPct !== undefined) cache["ll_setting_accessoryPct"] = pricingData.accessoryPct
  if (pricingData.miscPct !== undefined) cache["ll_setting_miscPct"] = pricingData.miscPct

  const headers = getAuthHeaders()
  const apiUrl = import.meta.env.VITE_API_URL
  if (!headers || !apiUrl) return pricingData

  try {
    const res = await fetch(`${apiUrl}/api/tenant/pricing`, {
      method: "PUT",
      headers,
      body: JSON.stringify(pricingData)
    })
    if (res.ok) {
      const updated = await res.json()
      if (updated.multipliers) cache["ll_multipliers"] = updated.multipliers
      return updated
    }
  } catch (e) {
    console.warn("savePricingSettingsOnServer error:", e)
  }
  return pricingData
}

export const resetPricingSettingsOnServer = async () => {
  const headers = getAuthHeaders()
  const apiUrl = import.meta.env.VITE_API_URL
  if (!headers || !apiUrl) return null

  try {
    const res = await fetch(`${apiUrl}/api/tenant/pricing/reset`, {
      method: "POST",
      headers
    })
    if (res.ok) {
      const defaults = await res.json()
      if (defaults.multipliers) cache["ll_multipliers"] = defaults.multipliers
      if (defaults.profitPct !== undefined) cache["ll_setting_profitPct"] = defaults.profitPct
      if (defaults.overheadPct !== undefined) cache["ll_setting_overheadPct"] = defaults.overheadPct
      if (defaults.accessoryPct !== undefined) cache["ll_setting_accessoryPct"] = defaults.accessoryPct
      if (defaults.miscPct !== undefined) cache["ll_setting_miscPct"] = defaults.miscPct
      return defaults
    }
  } catch (e) {
    console.warn("resetPricingSettingsOnServer error:", e)
  }
  return null
}

/**
 * Safe one-time migration for Pricing Setup:
 * 1. Checks guard flag: ll_pricing_migrated.
 * 2. Scans localStorage for legacy 'll_multipliers' or pricing settings.
 * 3. Checks backend to avoid overwriting existing database configurations.
 * 4. Uploads legacy data to PostgreSQL.
 * 5. Purges migrated localStorage keys only after verified save.
 */
export const migrateLocalStoragePricingToDatabase = async () => {
  if (typeof window === "undefined" || !window.localStorage) return true
  const isMigrated = localStorage.getItem("ll_pricing_migrated")
  if (isMigrated === "true") return true

  const headers = getAuthHeaders()
  const apiUrl = import.meta.env.VITE_API_URL
  if (!headers || !apiUrl) return false

  try {
    const rawMults = localStorage.getItem("ll_multipliers")
    let localMults = null
    if (rawMults) {
      try {
        localMults = JSON.parse(rawMults)
      } catch {
        // Ignore JSON parse errors
      }
    }

    const rawProfit = localStorage.getItem("profitPct") || localStorage.getItem("ll_setting_profitPct")
    const rawOverhead = localStorage.getItem("overheadPct") || localStorage.getItem("ll_setting_overheadPct")
    const rawAccessory = localStorage.getItem("accessoryPct") || localStorage.getItem("ll_setting_accessoryPct")
    const rawMisc = localStorage.getItem("miscPct") || localStorage.getItem("ll_setting_miscPct")

    const hasLocalPricing = localMults || rawProfit || rawOverhead || rawAccessory || rawMisc

    if (!hasLocalPricing) {
      localStorage.setItem("ll_pricing_migrated", "true")
      return true
    }

    const payload = {}
    if (localMults && typeof localMults === "object") {
      payload.multipliers = localMults
    }
    if (rawProfit) payload.profitPct = Number(rawProfit)
    if (rawOverhead) payload.overheadPct = Number(rawOverhead)
    if (rawAccessory) payload.accessoryPct = Number(rawAccessory)
    if (rawMisc) payload.miscPct = Number(rawMisc)

    if (Object.keys(payload).length > 0) {
      const putRes = await fetch(`${apiUrl}/api/tenant/pricing`, {
        method: "PUT",
        headers,
        body: JSON.stringify(payload)
      })
      if (!putRes.ok) {
        console.warn("Pricing migration upload failed")
        return false
      }
    }

    // Success: remove legacy keys and set guard flag
    localStorage.removeItem("ll_multipliers")
    localStorage.removeItem("profitPct")
    localStorage.removeItem("overheadPct")
    localStorage.removeItem("accessoryPct")
    localStorage.removeItem("miscPct")
    localStorage.setItem("ll_pricing_migrated", "true")
    return true
  } catch (e) {
    console.warn("migrateLocalStoragePricingToDatabase error:", e)
    return false
  }
}



// Purchases (True Server-Side Pagination)
export const savePurchases = async (data) => {
  cache["ll_purchases"] = data
  saveLocal("ll_purchases", data)
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("layerledger:purchases-updated", { detail: { purchases: data } }))
  }
  const headers = getAuthHeaders()
  if (!headers) return
  if (Array.isArray(data) && data.length === 0) {
    await clearAllPurchasesFromServer()
  } else {
    await syncPurchasesList(headers, data)
  }
}

export const fetchPaginatedPurchases = async ({ page = 1, limit = 25, month = "" } = {}) => {
  const apiUrl = import.meta.env.VITE_API_URL
  const headers = getAuthHeaders()
  const isMonthFilter = month && month.trim() && month.trim() !== "all"

  if (!apiUrl || !headers) {
    const all = loadLocal("ll_purchases", [])
    const filtered = isMonthFilter ? all.filter(p => isDateMatchingMonth(p.date, month.trim())) : all
    const sz = limit === "all" ? filtered.length : Number(limit) || 25
    const start = (page - 1) * sz
    const slice = filtered.slice(start, start + sz)
    const monthTotal = filtered.reduce((s, p) => s + (p.total || 0), 0)
    const availableMonths = [...new Set(all.map(p => (p.date ? normalizeDateToIso(p.date).slice(0, 7) : null)).filter(Boolean))].sort().reverse()
    return {
      data: slice,
      pagination: {
        page: Number(page),
        limit: sz,
        total: filtered.length,
        totalPages: Math.ceil(filtered.length / (sz || 1)) || 1
      },
      stats: {
        totalSpent: monthTotal,
        totalPurchases: filtered.length,
        availableMonths
      }
    }
  }

  try {
    const params = new URLSearchParams()
    if (page) params.set("page", page)
    if (limit) params.set("limit", limit)
    if (isMonthFilter) params.set("month", month.trim())

    const res = await fetch(`${apiUrl}/api/purchases?${params.toString()}`, { headers })
    if (res.ok) {
      const json = await res.json()
      if (json && json.data) {
        const mapped = json.data.map(mapServerPurchaseToLocal)
        // If server confirms 0 purchases (or all purchases cleared), clear local cache
        if ((!isMonthFilter && (json.pagination?.total === 0 || json.total === 0)) || (mapped.length === 0 && (!json.pagination?.total && !json.total))) {
          saveLocal("ll_purchases", [])
          cache["ll_purchases"] = []
          return {
            ...json,
            data: [],
            stats: {
              ...json.stats,
              totalSpent: 0,
              totalPurchases: 0,
              availableMonths: []
            }
          }
        }

        // Keep local cache in sync
        const local = loadLocal("ll_purchases", [])
        const merged = [...local]
        mapped.forEach(m => {
          const idx = merged.findIndex(p => p.id === m.id)
          if (idx >= 0) merged[idx] = m
          else merged.push(m)
        })
        saveLocal("ll_purchases", merged)
        cache["ll_purchases"] = merged

        const allDates = merged.map(p => (p.date ? normalizeDateToIso(p.date).slice(0, 7) : null)).filter(Boolean)
        const computedMonths = [...new Set(allDates)].sort().reverse()

        return {
          ...json,
          data: mapped,
          stats: {
            ...json.stats,
            availableMonths: json.stats?.availableMonths || computedMonths
          }
        }
      }
      if (Array.isArray(json)) {
        const mapped = json.map(mapServerPurchaseToLocal)
        const computedMonths = [...new Set(mapped.map(p => (p.date ? normalizeDateToIso(p.date).slice(0, 7) : null)).filter(Boolean))].sort().reverse()
        return {
          data: mapped,
          pagination: { page: 1, limit: mapped.length, total: mapped.length, totalPages: 1 },
          stats: { totalSpent: mapped.reduce((s, p) => s + (p.total || 0), 0), totalPurchases: mapped.length, availableMonths: computedMonths }
        }
      }
    }
  } catch (err) {
    console.warn("fetchPaginatedPurchases server error:", err)
  }

  const all = loadLocal("ll_purchases", [])
  const filtered = isMonthFilter ? all.filter(p => isDateMatchingMonth(p.date, month.trim())) : all
  const availableMonths = [...new Set(all.map(p => (p.date ? normalizeDateToIso(p.date).slice(0, 7) : null)).filter(Boolean))].sort().reverse()
  return {
    data: filtered.slice(0, 25),
    pagination: { page: 1, limit: 25, total: filtered.length, totalPages: Math.ceil(filtered.length / 25) || 1 },
    stats: { totalSpent: filtered.reduce((s, p) => s + (p.total || 0), 0), totalPurchases: filtered.length, availableMonths }
  }
}

export const deletePurchaseFromServer = async (id) => {
  if (!id) return
  const all = (typeof loadLocal === "function" ? loadLocal("ll_purchases", []) : []) || []
  const updated = all.filter(p => p.id !== id)
  saveLocal("ll_purchases", updated)
  cache["ll_purchases"] = updated
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("layerledger:purchases-updated", { detail: { purchases: updated } }))
  }
  const apiUrl = import.meta.env.VITE_API_URL
  const headers = getAuthHeaders()
  if (apiUrl && headers) {
    try {
      await fetchWithTimeout(`${apiUrl}/api/purchases/${id}`, { method: "DELETE", headers })
    } catch (e) {
      console.warn("deletePurchaseFromServer error:", e)
    }
  }
}

export const deletePurchasesFromServer = async (ids) => {
  if (!ids || ids.length === 0) return
  const idSet = new Set(ids)
  const all = (typeof loadLocal === "function" ? loadLocal("ll_purchases", []) : []) || []
  const updated = all.filter(p => !idSet.has(p.id))
  saveLocal("ll_purchases", updated)
  cache["ll_purchases"] = updated
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("layerledger:purchases-updated", { detail: { purchases: updated } }))
  }
  const apiUrl = import.meta.env.VITE_API_URL
  const headers = getAuthHeaders()
  if (apiUrl && headers) {
    await Promise.allSettled(
      ids.map(id => fetchWithTimeout(`${apiUrl}/api/purchases/${id}`, { method: "DELETE", headers }).catch(() => {}))
    )
  }
}

export const clearAllPurchasesFromServer = async () => {
  saveLocal("ll_purchases", [])
  cache["ll_purchases"] = []
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("layerledger:purchases-updated", { detail: { purchases: [] } }))
  }
  const apiUrl = import.meta.env.VITE_API_URL
  const headers = getAuthHeaders()
  if (apiUrl && headers) {
    try {
      const res = await fetchWithTimeout(`${apiUrl}/api/purchases/all`, {
        method: "DELETE",
        headers
      })
      if (!res.ok) {
        // Fallback: If /all is not available or errors, fetch and delete remaining by ID
        const allRes = await fetchWithTimeout(`${apiUrl}/api/purchases?limit=1000`, { headers }).catch(() => null)
        if (allRes && allRes.ok) {
          const json = await allRes.json()
          const items = Array.isArray(json) ? json : (json.data || [])
          if (items.length > 0) {
            await Promise.allSettled(
              items.map(item => fetchWithTimeout(`${apiUrl}/api/purchases/${item.id}`, { method: "DELETE", headers }).catch(() => {}))
            )
          }
        }
      }
    } catch (e) {
      console.warn("clearAllPurchasesFromServer error:", e)
    }
  }
}

// ─── Token Management APIs ──────────────────────────────────────────────────
export const fetchTokenBalance = async () => {
  const apiUrl = import.meta.env.VITE_API_URL
  const headers = getAuthHeaders()
  if (!apiUrl || !headers) {
    const tenant = loadLocal("ll_tenant_info", null)
    return { tokenBalance: tenant?.tokenBalance || 0 }
  }

  try {
    const res = await fetch(`${apiUrl}/api/tokens/balance`, { headers })
    if (res.ok) {
      const data = await res.json()
      const tenant = loadLocal("ll_tenant_info", null) || {}
      tenant.tokenBalance = data.tokenBalance
      saveLocal("ll_tenant_info", tenant)
      return data
    }
  } catch (err) {
    console.warn("fetchTokenBalance error:", err)
  }

  const tenant = loadLocal("ll_tenant_info", null)
  return { tokenBalance: tenant?.tokenBalance || 0 }
}

export const fetchTokenHistory = async () => {
  const apiUrl = import.meta.env.VITE_API_URL
  const headers = getAuthHeaders()
  if (!apiUrl || !headers) return []

  try {
    const res = await fetch(`${apiUrl}/api/tokens/history`, { headers })
    if (res.ok) {
      const data = await res.json()
      return Array.isArray(data) ? data : []
    }
  } catch (err) {
    console.warn("fetchTokenHistory error:", err)
  }
  return []
}

export const purchaseTokens = async (amount, description = "Token purchase") => {
  const apiUrl = import.meta.env.VITE_API_URL
  const headers = getAuthHeaders()
  if (!apiUrl || !headers) {
    throw new Error("Cannot process payment in offline mode.")
  }

  const res = await fetch(`${apiUrl}/api/tokens/transaction`, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      amount: parseFloat(amount),
      type: "purchase",
      description
    })
  })

  if (!res.ok) {
    const text = await res.text()
    let msg = text
    try {
      const json = JSON.parse(text)
      msg = json.error || json.message || text
    } catch {
      // Fallback if response is not JSON
    }
    throw new Error(msg || "Failed to complete token transaction.")
  }

  const data = await res.json()
  const newBal = data.newBalance
  if (typeof newBal === "number") {
    const tenant = loadLocal("ll_tenant_info", null) || {}
    tenant.tokenBalance = newBal
    saveLocal("ll_tenant_info", tenant)
    if (typeof window !== "undefined") {
      const detail = { tokenBalance: newBal }
      window.dispatchEvent(new CustomEvent("bakewealth:token-updated", { detail }))
      window.dispatchEvent(new CustomEvent("layerledger:token-updated", { detail }))
    }
  }
  return data
}

