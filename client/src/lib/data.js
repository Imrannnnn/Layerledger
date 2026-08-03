// ═══════════════════════════════════════════════════════════
//  DATA LAYER — strictly database with in-memory cache
// ═══════════════════════════════════════════════════════════

const cache = {}
const lastSyncedValues = {}

const load = (key, fallback) => {
  if (cache[key] !== undefined && cache[key] !== null) {
    try {
      const val = cache[key]
      return typeof val === "string" ? JSON.parse(val) : val
    } catch {
      return cache[key]
    }
  }
  try {
    const localVal = localStorage.getItem(key)
    if (localVal !== null && localVal !== undefined) {
      try {
        const parsed = JSON.parse(localVal)
        cache[key] = parsed
        return parsed
      } catch {
        cache[key] = localVal
        return localVal
      }
    }
  } catch (e) {
    // Ignored
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

let isSyncing = false
let syncQueue = false
let hasLoadedFromBackend = false

const save = async (key, val) => {
  try {
    cache[key] = val
    try {
      localStorage.setItem(key, typeof val === "string" ? val : JSON.stringify(val))
    } catch (e) {
      // Ignored
    }
    await syncToBackend()
  } catch (e) {
    // Ignored
  }
}

export const saveLocal = async (key, val) => {
  if (key === "ll_anthropic_key") {
    window.__anthropic_key = val
  }
  await save(key, val)
}

export const getAuthHeaders = () => {
  try {
    const u = localStorage.getItem("ll_current_user")
    if (!u) return null
    const user = JSON.parse(u)
    return user && user.token ? { "Authorization": `Bearer ${user.token}`, "Content-Type": "application/json" } : null
  } catch {
    return null
  }
}

export const syncToBackend = async (forceAll = false) => {
  if (!hasLoadedFromBackend) return

  if (isSyncing) {
    syncQueue = true
    return
  }
  isSyncing = true

  const headers = getAuthHeaders()
  if (!headers) {
    isSyncing = false
    return
  }
  const apiUrl = import.meta.env.VITE_API_URL
  if (!apiUrl) {
    isSyncing = false
    return
  }

  try {
    const data = {}
    Object.entries(cache).forEach(([k, v]) => {
      data[k] = typeof v === "string" ? v : JSON.stringify(v)
    })

    const res = await fetch(`${apiUrl}/api/tenant`, { headers })
    if (res.status === 401 || res.status === 403) {
      console.warn("Backend sync paused: User session token is invalid or expired. Please log out and log in again.")
      return
    }
    if (res.ok) {
      const tenant = await res.json()
      const updatedSettings = {
        ...(tenant.settings || {}),
        localState: data
      }

      const updateRes = await fetch(`${apiUrl}/api/tenant`, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          name: tenant.name,
          contactEmail: tenant.contactEmail || "",
          contactPhone: tenant.contactPhone || "",
          settings: updatedSettings
        })
      })

      if (updateRes.ok) {
        const updatedTenant = await updateRes.json()
        const tenantInfo = {
          id: updatedTenant.id,
          name: updatedTenant.name,
          createdAt: updatedTenant.createdAt,
          tokenBalance: updatedTenant.tokenBalance,
          settings: {
            plan: updatedTenant.settings?.plan || "Free",
            status: updatedTenant.settings?.status || "Active"
          }
        }
        localStorage.setItem("ll_tenant_info", JSON.stringify(tenantInfo))
      } else {
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
        localStorage.setItem("ll_tenant_info", JSON.stringify(tenantInfo))
      }
    }

    // Sync to individual tables and await completions ONLY if data has changed or forced
    // Phase 1: Sync recipes, purchases, expenses, orders, and invoices
    const phase1Promises = []

    if (forceAll || data["ll_recipes"] !== lastSyncedValues["ll_recipes"]) {
      phase1Promises.push(syncRecipesList(headers, JSON.parse(data["ll_recipes"] || "[]"))
        .then(() => { lastSyncedValues["ll_recipes"] = data["ll_recipes"] })
        .catch(console.error))
    }

    if (forceAll || data["ll_exp"] !== lastSyncedValues["ll_exp"]) {
      phase1Promises.push(syncExpensesList(headers, JSON.parse(data["ll_exp"] || "[]"))
        .then(() => { lastSyncedValues["ll_exp"] = data["ll_exp"] })
        .catch(console.error))
    }

    if (forceAll || data["ll_purchases"] !== lastSyncedValues["ll_purchases"]) {
      phase1Promises.push(syncPurchasesList(headers, JSON.parse(data["ll_purchases"] || "[]"))
        .then(() => { lastSyncedValues["ll_purchases"] = data["ll_purchases"] })
        .catch(console.error))
    }

    if (forceAll || data["ll_prods"] !== lastSyncedValues["ll_prods"] || data["ll_quotes"] !== lastSyncedValues["ll_quotes"]) {
      phase1Promises.push(syncOrdersList(
        headers, 
        JSON.parse(data["ll_prods"] || "[]"), 
        JSON.parse(data["ll_quotes"] || "[]"),
        JSON.parse(data["ll_inv"] || "[]"),
        JSON.parse(data["ll_recipes"] || "[]")
      )
        .then(() => { 
          lastSyncedValues["ll_prods"] = data["ll_prods"]
          lastSyncedValues["ll_quotes"] = data["ll_quotes"]
        })
        .catch(console.error))
    }

    if (forceAll || data["ll_quote_invoices"] !== lastSyncedValues["ll_quote_invoices"]) {
      phase1Promises.push(syncInvoicesList(headers, JSON.parse(data["ll_quote_invoices"] || "[]"))
        .then(() => { lastSyncedValues["ll_quote_invoices"] = data["ll_quote_invoices"] })
        .catch(console.error))
    }

    await Promise.all(phase1Promises)

    // Phase 2: Sync inventory items (fetching server-computed stock and moving average costs)
    if (forceAll || data["ll_inv"] !== lastSyncedValues["ll_inv"]) {
      await syncInventoryItems(headers, JSON.parse(data["ll_inv"] || "[]"))
        .then(() => { lastSyncedValues["ll_inv"] = localStorage.getItem("ll_inv") || data["ll_inv"] })
        .catch(console.error)
    }

  } catch (error) {
    console.error("Sync to backend error:", error)
  } finally {
    isSyncing = false
    if (syncQueue) {
      syncQueue = false
      await syncToBackend()
    }
  }
}

const syncInventoryItems = async (headers, localInv) => {
  const apiUrl = import.meta.env.VITE_API_URL
  const res = await fetch(`${apiUrl}/api/inventory`, { headers })
  if (!res.ok) return
  const serverItems = await res.json()

  let localChanged = false
  const updatedLocalInv = [...localInv]

  // Delete
  for (const sItem of serverItems) {
    if (!localInv.find(i => i.id === sItem.id)) {
      await fetch(`${apiUrl}/api/inventory/${sItem.id}`, { method: "DELETE", headers })
    }
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
    localStorage.setItem("ll_inv", JSON.stringify(updatedLocalInv))
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
  const apiUrl = import.meta.env.VITE_API_URL
  const res = await fetch(`${apiUrl}/api/expenses`, { headers })
  if (!res.ok) return
  const serverExps = await res.json()

  // Delete
  for (const sExp of serverExps) {
    if (!localExpenses.find(e => e.id === sExp.id)) {
      await fetch(`${apiUrl}/api/expenses/${sExp.id}`, { method: "DELETE", headers })
    }
  }

  // Create/Update
  for (const exp of localExpenses) {
    const sExp = serverExps.find(e => e.id === exp.id)
    let parsedDate = new Date().toISOString()
    try { if (exp.date) parsedDate = new Date(exp.date).toISOString() } catch (e) { /* ignore invalid date */ }

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
        await fetch(`${apiUrl}/api/expenses/${exp.id}`, {
          method: "PUT",
          headers,
          body: JSON.stringify(body)
        })
      }
    } else {
      await fetch(`${apiUrl}/api/expenses`, {
        method: "POST",
        headers,
        body: JSON.stringify(body)
      })
    }
  }
}

const calculateOrderUsages = (o, inventory, recipes) => {
  const usages = [];
  const mults = loadLocal("ll_multipliers", {
    "4-round":1,"6-round":1,"8-round":1.5,"10-round":2.2,"12-round":3.2,"14-round":4.5,
    "4-square":1.2,"6-square":1.3,"8-square":2,"10-square":3,"12-square":4.2,"14-square":6,
    "4-sheet":1.5,"6-sheet":2,"8-sheet":3,"10-sheet":4.5,"12-sheet":6.5,"14-sheet":9
  });

  if (o.tiers && o.tiers.length > 0) {
    o.tiers.forEach(tier => {
      const size = String(tier.size).replace(/"/g, "").trim();
      const shape = (tier.shape || "round").toLowerCase();
      const key = `${size}-${shape}`;
      const mult = mults[key] || 1;

      tier.layers?.forEach(layer => {
        if (!layer.flavour) return;
        const recipe = recipes.find(r => r.name.toLowerCase().includes(layer.flavour.toLowerCase()));
        if (!recipe) return;
        recipe.ing?.forEach(ing => {
          const needed = ing.qty * mult;
          const existing = usages.find(u => u.itemId === ing.iid);
          if (existing) {
            existing.qty += needed;
          } else {
            usages.push({ itemId: ing.iid, qty: needed });
          }
        });
      });

      tier.coverings?.forEach(cov => {
        if (!cov.type || !cov.grams) return;
        const recipe = recipes.find(r => r.name.toLowerCase().includes(cov.type.toLowerCase()));
        if (!recipe) return;
        const batchGrams = Number(recipe.batchWeight) || recipe.ing?.reduce((s, ing) => {
          if (ing.unit === "kg") return s + ing.qty * 1000;
          if (ing.unit === "g" || ing.unit === "L" || ing.unit === "l") return s + ing.qty;
          return s;
        }, 0) || 1000;

        const ratio = cov.grams / batchGrams;
        recipe.ing?.forEach(ing => {
          const needed = ing.qty * ratio;
          const existing = usages.find(u => u.itemId === ing.iid);
          if (existing) {
            existing.qty += needed;
          } else {
            usages.push({ itemId: ing.iid, qty: needed });
          }
        });
      });

      tier.fillings?.forEach(fil => {
        if (!fil.type || !fil.grams) return;
        const recipe = recipes.find(r => r.name.toLowerCase().includes(fil.type.toLowerCase()));
        if (!recipe) return;
        const batchGrams = Number(recipe.batchWeight) || recipe.ing?.reduce((s, ing) => {
          if (ing.unit === "kg") return s + ing.qty * 1000;
          if (ing.unit === "g" || ing.unit === "L" || ing.unit === "l") return s + ing.qty;
          return s;
        }, 0) || 1000;

        const ratio = fil.grams / batchGrams;
        recipe.ing?.forEach(ing => {
          const needed = ing.qty * ratio;
          const existing = usages.find(u => u.itemId === ing.iid);
          if (existing) {
            existing.qty += needed;
          } else {
            usages.push({ itemId: ing.iid, qty: needed });
          }
        });
      });
    });
  }

  if (o.donutGroups && o.donutGroups.length > 0) {
    o.donutGroups.forEach(g => {
      if (!g.flavour || !g.qty) return;
      const recipe = recipes.find(r => r.name.toLowerCase().includes(g.flavour.toLowerCase()));
      if (!recipe) return;
      const batchSize = recipe.batchSize || 12;
      const ratio = g.qty / batchSize;
      recipe.ing?.forEach(ing => {
        const needed = ing.qty * ratio;
        const existing = usages.find(u => u.itemId === ing.iid);
        if (existing) {
          existing.qty += needed;
        } else {
          usages.push({ itemId: ing.iid, qty: needed });
        }
      });
    });
  }

  if (o.loaves && o.loaves.length > 0) {
    o.loaves.forEach(l => {
      if (!l.flavour) return;
      const recipe = recipes.find(r => r.name.toLowerCase().includes(l.flavour.toLowerCase()));
      if (!recipe) return;
      recipe.ing?.forEach(ing => {
        const needed = ing.qty;
        const existing = usages.find(u => u.itemId === ing.iid);
        if (existing) {
          existing.qty += needed;
        } else {
          usages.push({ itemId: ing.iid, qty: needed });
        }
      });
    });
  }

  if (o.tartQty > 0) {
    const recipe = recipes.find(r => r.name.toLowerCase().includes("tart")) || recipes.find(r => r.name.toLowerCase().includes("pastry"));
    if (recipe) {
      const batchSize = recipe.batchSize || 12;
      const ratio = o.tartQty / batchSize;
      recipe.ing?.forEach(ing => {
        const needed = ing.qty * ratio;
        const existing = usages.find(u => u.itemId === ing.iid);
        if (existing) {
          existing.qty += needed;
        } else {
          usages.push({ itemId: ing.iid, qty: needed });
        }
      });
    }
  }

  return usages;
};

const syncOrdersList = async (headers, localProds, localQuotes, localInv, localRecipes) => {
  const apiUrl = import.meta.env.VITE_API_URL
  const res = await fetch(`${apiUrl}/api/orders`, { headers })
  if (!res.ok) return
  const serverOrders = await res.json()

  const combinedLocal = [
    ...localProds.map(p => ({ ...p, isProd: true })),
    ...localQuotes.map(q => ({ ...q, isProd: false }))
  ]

  // Delete
  for (const sOrder of serverOrders) {
    if (!combinedLocal.find(o => o.id === sOrder.id)) {
      await fetch(`${apiUrl}/api/orders/${sOrder.id}`, { method: "DELETE", headers })
    }
  }

  // Create/Update
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
      usages
    }

    if (sOrder) {
      await fetch(`${apiUrl}/api/orders/${o.id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify(body)
      })
    } else {
      await fetch(`${apiUrl}/api/orders`, {
        method: "POST",
        headers,
        body: JSON.stringify(body)
      })
    }
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
  const apiUrl = import.meta.env.VITE_API_URL
  const res = await fetch(`${apiUrl}/api/purchases`, { headers })
  if (!res.ok) return
  const serverPurchases = await res.json()

  // Delete
  for (const sPur of serverPurchases) {
    if (!localPurchases.find(p => p.id === sPur.id)) {
      await fetch(`${apiUrl}/api/purchases/${sPur.id}`, { method: "DELETE", headers })
    }
  }

  // Create/Update
  for (const pur of localPurchases) {
    const sPur = serverPurchases.find(sp => sp.id === pur.id)
    let parsedDate = new Date().toISOString()
    try { if (pur.date) parsedDate = new Date(pur.date).toISOString() } catch (e) { /* ignore invalid date */ }

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
        await fetch(`${apiUrl}/api/purchases/${pur.id}`, {
          method: "PUT",
          headers,
          body: JSON.stringify(body)
        })
      }
    } else {
      await fetch(`${apiUrl}/api/purchases`, {
        method: "POST",
        headers,
        body: JSON.stringify(body)
      })
    }
  }
}

export const syncFromBackend = async () => {
  const headers = getAuthHeaders()
  if (!headers) return false
  const apiUrl = import.meta.env.VITE_API_URL
  if (!apiUrl) return false

  try {
    const res = await fetch(`${apiUrl}/api/tenant`, { headers })
    if (res.ok) {
      const tenant = await res.json()
      hasLoadedFromBackend = true
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
      localStorage.setItem("ll_tenant_info", JSON.stringify(tenantInfo))

      if (tenant.settings && tenant.settings.localState) {
        const state = tenant.settings.localState
        Object.keys(cache).forEach(k => {
          delete cache[k]
        })
        Object.keys(lastSyncedValues).forEach(k => {
          delete lastSyncedValues[k]
        })

        // Explicitly clear temporary calculator states on login so they don't persist across sessions
        const keysToIgnoreOnLogin = ["ll_calc_state", "ll_calc_edit", "ll_calc_prefill", "ll_quote_prefill"]
        keysToIgnoreOnLogin.forEach(k => {
          try {
            localStorage.removeItem(k)
          } catch (e) {}
        })

        Object.entries(state).forEach(([k, v]) => {
          if (v !== null && !keysToIgnoreOnLogin.includes(k)) {
            try {
              cache[k] = typeof v === "string" ? JSON.parse(v) : v
            } catch {
              cache[k] = v
            }
            lastSyncedValues[k] = typeof v === "string" ? v : JSON.stringify(v)
            try {
              localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v))
            } catch (e) {
              // Ignore
            }
            if (k === "ll_anthropic_key") {
              window.__anthropic_key = cache[k]
            }
          }
        })
        // Trigger background self-healing sync to populate relational tables in Supabase if needed
        setTimeout(() => syncToBackend(true), 100)
        return true
      }
    }
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
      localStorage.removeItem(k)
    } catch (e) {}
  })
}

export const logout = () => {
  hasLoadedFromBackend = false
  clearTempCalculatorState()
  Object.keys(cache).forEach(k => {
    delete cache[k]
  })
  Object.keys(lastSyncedValues).forEach(k => {
    delete lastSyncedValues[k]
  })
  try {
    localStorage.removeItem("ll_current_user")
    localStorage.removeItem("ll_tenant_info")
    // Remove all cache-related keys from localStorage
    const keysToRemove = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith("ll_")) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k))
  } catch (e) {
    // Ignore
  }
}

export const clearAllDataOnServer = async () => {
  const headers = getAuthHeaders()
  if (!headers) return
  const apiUrl = import.meta.env.VITE_API_URL
  if (!apiUrl) return

  try {
    hasLoadedFromBackend = false
    Object.keys(cache).forEach(k => {
      delete cache[k]
    })
    Object.keys(lastSyncedValues).forEach(k => {
      delete lastSyncedValues[k]
    })

    // 1. Reset tenant settings localState
    const res = await fetch(`${apiUrl}/api/tenant`, { headers })
    if (res.ok) {
      const tenant = await res.json()
      const updatedSettings = {
        ...(tenant.settings || {}),
        localState: {}
      }
      await fetch(`${apiUrl}/api/tenant`, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          name: tenant.name,
          contactEmail: tenant.contactEmail || "",
          contactPhone: tenant.contactPhone || "",
          settings: updatedSettings
        })
      })
    }

    // 2. Clear individual tables
    await Promise.all([
      syncInventoryItems(headers, []),
      syncRecipesList(headers, []),
      syncExpensesList(headers, []),
      syncOrdersList(headers, [], []),
      syncInvoicesList(headers, []),
      syncPurchasesList(headers, [])
    ])
  } catch (e) {
    console.error("Failed to clear server data:", e)
  }
}


// Inventory
export const loadInventory = async (def = []) => {
  const t = load("ll_inv", null)
  return t && t.length > 0 ? t : (def || [])
}
export const saveInventory = async (data) => await save("ll_inv", data)

// Productions
export const loadProductions = async (def = []) => load("ll_prods", def)
export const saveProductionsList = async (data) => await save("ll_prods", data)
export const saveProduction = async (prod) => {
  const all = load("ll_prods", [])
  const exists = all.find(p => p.id === prod.id)
  await save("ll_prods", exists ? all.map(p => p.id === prod.id ? prod : p) : [...all, prod])
}
export const updateProdStatus = async (id, status) => {
  await save("ll_prods", load("ll_prods", []).map(p => p.id === id ? { ...p, status } : p))
}

// Transactions
export const loadTransactions = async (def = []) => load("ll_txns", def)
export const saveTxns = async (data) => await save("ll_txns", data)

// Expenses
export const loadExpenses = () => load("ll_exp", [])
export const saveExpenses = async (data) => await save("ll_exp", data)

// Settings
export const loadSetting = (key, def) => load("ll_setting_" + key, def)
export const saveSetting = async (key, val) => await save("ll_setting_" + key, val)

// Company
export const loadCompany = () => load("ll_co", {
  name: "Fayvouree Luxe Cakes Studio",
  address: "Abuja, Nigeria",
  phone: "",
  email: "",
  pin: "1234",
  primaryColor: "#f6ae13",
  sidebarColor: "#0a0a0a",
})
export const saveCompany = async (data) => await save("ll_co", data)

// Quotes
export const loadQuotes = () => load("ll_quotes", [])
export const saveQuotes = async (data) => await save("ll_quotes", data)

// Invoices
export const loadInvoices = () => load("ll_invoices", [])
export const saveInvoice = async (data) => await save("ll_invoices", data)

// Users
export const loadUsers = () => load("ll_users", [{ id: "u1", name: "Owner", pin: "1234", role: "owner" }])
export const saveUsers = async (data) => await save("ll_users", data)

// Recipes
export const loadRecipes = () => load("ll_recipes", null)
export const saveRecipes = async (data) => await save("ll_recipes", data)

// Clients
export const loadClients = () => load("ll_clients", [])
export const upsertClient = async (name, phone, email) => {
  if (!name || !name.trim()) return
  const all = loadClients()
  if (all.find(c => c.name.toLowerCase() === name.toLowerCase())) {
    await save("ll_clients", all.map(c =>
      c.name.toLowerCase() === name.toLowerCase()
        ? { ...c, phone: phone || c.phone, email: email || c.email, lastOrder: new Date().toISOString().slice(0, 10) }
        : c
    ))
  } else {
    await save("ll_clients", [...all, {
      id: "cl_" + Date.now(),
      name: name.trim(),
      phone: phone || "",
      email: email || "",
      lastOrder: new Date().toISOString().slice(0, 10),
    }])
  }
}

// Tenant Metadata
export const loadTenantInfo = () => load("ll_tenant_info", null)
