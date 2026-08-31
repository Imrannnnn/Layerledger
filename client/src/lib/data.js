// ═══════════════════════════════════════════════════════════
//  DATA LAYER — strictly database with in-memory cache
// ═══════════════════════════════════════════════════════════

const cache = {}
const lastSyncedValues = {}

// Mapping functions to transform server DB structures to client/sessionStorage structures
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
  total: pur.total || pur.amount,
  item: pur.notes ? pur.notes.split(" — Qty:")[0] : "Ingredient",
  qty: pur.qty || 1,
  stockAdded: pur.stockAdded || 0,
  itemId: pur.itemId,
  unitSize: pur.unitSize || 0,
  price: pur.price || 0,
  cpu: pur.cpu || 0
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
  return {
    ...base,
    id: o.id,
    notes: o.notes || "",
    salePrice: o.totalPrice,
    cost: o.totalCost,
    status: o.status,
    dueDate: o.dueDate ? o.dueDate.split("T")[0] : null,
    deliveryDate: o.dueDate ? o.dueDate.split("T")[0] : base.deliveryDate || null,
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
    } else {
      await syncTenantSettingsOnly(headers)
    }
  } catch (e) {
    console.error(`Save to backend error for key ${key}:`, e)
  }
}

const syncTenantSettingsOnly = async (headers) => {
  const apiUrl = import.meta.env.VITE_API_URL
  if (!apiUrl) return
  try {
    const res = await fetch(`${apiUrl}/api/tenant`, { headers })
    if (res.ok) {
      const tenant = await res.json()
      const data = {
        ...(tenant.settings?.appConfig || tenant.settings?.localState || {})
      }
      Object.entries(cache).forEach(([k, v]) => {
        const keysToStoreInAppConfig = [
          "ll_co", "ll_multipliers", "ll_coverings", "ll_decorations", "ll_packaging", "ll_opening_stock", 
          "ll_onboarded", "ll_anthropic_key", "ll_users", "ll_clients", "ll_aliases"
        ]
        if (keysToStoreInAppConfig.includes(k) || k.startsWith("ll_setting_") || k.startsWith("ll_os_")) {
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
        const cfg = serverTenant.settings?.appConfig || serverTenant.settings?.localState
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

  if (o.pastryItems && o.pastryItems.length > 0) {
    o.pastryItems.forEach(p => {
      if (!p.flavour || !p.qty) return;
      const recipe = recipes.find(r => r.name.toLowerCase().includes(p.flavour.toLowerCase()));
      if (!recipe) return;
      const batchSize = recipe.batchSize || 12;
      const ratio = p.qty / batchSize;
      recipe.ing?.forEach(ing => {
        const needed = ing.qty * ratio;
        const existing = usages.find(u => u.itemId === ing.iid);
        if (existing) {
          existing.qty += needed;
        } else {
          usages.push({ itemId: ing.iid, qty: needed });
        }
      });

      if (p.filling && p.fillingGrams > 0) {
        const fillRecipe = recipes.find(r => (r.type === "covering" || !r.type) && r.name.toLowerCase().includes(p.filling.toLowerCase()));
        if (fillRecipe) {
          const batchGrams = Number(fillRecipe.batchWeight) || fillRecipe.ing?.reduce((s, ing) => {
            if (ing.unit === "kg") return s + ing.qty * 1000;
            if (ing.unit === "g" || ing.unit === "L" || ing.unit === "l") return s + ing.qty;
            return s;
          }, 0) || 1000;
          const ratio = p.fillingGrams / batchGrams;
          fillRecipe.ing?.forEach(ing => {
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
      usages,
      metadata: o
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
  const apiUrl = import.meta.env.VITE_API_URL
  if (!apiUrl) return
  const res = await fetch(`${apiUrl}/api/transactions`, { headers })
  if (!res.ok) return
  const serverTxns = await res.json()

  // Delete
  for (const sTxn of serverTxns) {
    if (!localTxns.find(t => t.id === sTxn.id)) {
      await fetch(`${apiUrl}/api/transactions/${sTxn.id}`, { method: "DELETE", headers })
    }
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
      await fetch(`${apiUrl}/api/transactions/${txn.id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify(body)
      })
    } else {
      await fetch(`${apiUrl}/api/transactions`, {
        method: "POST",
        headers,
        body: JSON.stringify(body)
      })
    }
  }
}

export const migrateLegacyLocalStorage = async () => {
  const headers = getAuthHeaders()
  if (!headers) return
  const apiUrl = import.meta.env.VITE_API_URL
  if (!apiUrl) return

  try {
    let hasLocalData = false
    const payload = {
      inventory: [],
      recipes: [],
      orders: [],
      expenses: [],
      purchases: [],
      transactions: [],
      settings: {}
    }

    const keysToRemove = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith("ll_")) {
        hasLocalData = true
        keysToRemove.push(k)
        const valStr = localStorage.getItem(k)
        try {
          const val = JSON.parse(valStr)
          if (k === "ll_inv" && Array.isArray(val)) payload.inventory = val
          else if (k === "ll_recipes" && Array.isArray(val)) payload.recipes = val
          else if ((k === "ll_prods" || k === "ll_quotes") && Array.isArray(val)) payload.orders.push(...val)
          else if (k === "ll_exp" && Array.isArray(val)) payload.expenses = val
          else if (k === "ll_purchases" && Array.isArray(val)) payload.purchases = val
          else if (k === "ll_txns" && Array.isArray(val)) payload.transactions = val
          else payload.settings[k] = valStr
        } catch (e) {
          payload.settings[k] = valStr
        }
      }
    }

    if (hasLocalData) {
      const res = await fetch(`${apiUrl}/api/migrate-legacy`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload)
      })
      if (res.ok) {
        keysToRemove.forEach(k => localStorage.removeItem(k))
      }
    }
  } catch (e) {
    console.error("Migration error:", e)
  }
}

export const syncFromBackend = async () => {
  const headers = getAuthHeaders()
  if (!headers) return false
  const apiUrl = import.meta.env.VITE_API_URL
  if (!apiUrl) return false

  try {
    await migrateLegacyLocalStorage()

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
    const config = tenant.settings ? (tenant.settings.appConfig || tenant.settings.localState) : null
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

    const [invRes, recipesRes, ordersRes, expensesRes, purchasesRes, invoicesRes, txnsRes] = await Promise.all([
      fetch(`${apiUrl}/api/inventory`, { headers }),
      fetch(`${apiUrl}/api/recipes`, { headers }),
      fetch(`${apiUrl}/api/orders`, { headers }),
      fetch(`${apiUrl}/api/expenses`, { headers }),
      fetch(`${apiUrl}/api/purchases`, { headers }),
      fetch(`${apiUrl}/api/invoices`, { headers }),
      fetch(`${apiUrl}/api/transactions`, { headers })
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

    if (isAlreadyOnboarded) {
      cache["ll_onboarded"] = "1"
      if (!tenant.settings?.appConfig?.ll_onboarded && !tenant.settings?.localState?.ll_onboarded) {
        setTimeout(() => syncTenantSettingsOnly(headers), 100)
      }
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
}

export const clearAllDataOnServer = async () => {
  const headers = getAuthHeaders()
  if (!headers) return
  const apiUrl = import.meta.env.VITE_API_URL
  if (!apiUrl) return

  try {
    Object.keys(cache).forEach(k => {
      delete cache[k]
    })
    Object.keys(lastSyncedValues).forEach(k => {
      delete lastSyncedValues[k]
    })

    // 1. Reset tenant settings appConfig
    const res = await fetch(`${apiUrl}/api/tenant`, { headers })
    if (res.ok) {
      const tenant = await res.json()
      const updatedSettings = {
        ...(tenant.settings || {}),
        appConfig: {}
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
      try {
        sessionStorage.removeItem("ll_inv")
      } catch {}
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

export const deleteOpeningStockOnServer = async () => {
  const headers = getAuthHeaders()
  if (!headers) return false
  const apiUrl = import.meta.env.VITE_API_URL
  if (!apiUrl) return false

  try {
    const res = await fetch(`${apiUrl}/api/inventory/opening-stock`, {
      method: "DELETE",
      headers
    })
    if (res.ok) {
      delete cache["ll_opening_stock"]
      Object.keys(cache).forEach(k => {
        if (k.startsWith("ll_os_")) delete cache[k]
      })
      try {
        sessionStorage.removeItem("ll_opening_stock")
        Object.keys(sessionStorage).forEach(k => {
          if (k.startsWith("ll_os_")) sessionStorage.removeItem(k)
        })
      } catch {}
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



// Inventory
export const loadInventory = (def = []) => {
  const t = load("ll_inv", null)
  return t && t.length > 0 ? t : (def || [])
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
export const saveRecipes = async (data) => {
  cache["ll_recipes"] = data
  const headers = getAuthHeaders()
  if (!headers) return
  await syncRecipesList(headers, data)
}

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

// Aliases for receipt scanner ingredient mapping
export const loadAliases = (def = {}) => load("ll_aliases", def)
export const saveAliases = async (data) => await save("ll_aliases", data)
