// ═══════════════════════════════════════════════════════════
//  DATA LAYER — localStorage persistence
// ═══════════════════════════════════════════════════════════

const load = (key, fallback) => {
  try {
    const r = localStorage.getItem(key)
    return r ? JSON.parse(r) : fallback
  } catch {
    return fallback
  }
}

const save = (key, val) => {
  try {
    localStorage.setItem(key, JSON.stringify(val))
    syncToBackend()
  } catch {
    // Ignored
  }
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

export const syncToBackend = async () => {
  const headers = getAuthHeaders()
  if (!headers) return
  const apiUrl = import.meta.env.VITE_API_URL
  if (!apiUrl) return

  try {
    const keys = [
      "ll_inv", "ll_recipes", "ll_prods", "ll_quotes", "ll_txns", "ll_exp",
      "ll_purchases", "ll_payables", "ll_ap_payments", "ll_opening_balance",
      "ll_co", "ll_users", "ll_clients", "ll_quote_invoices", "ll_multipliers",
      "ll_onboarded", "ll_coverings", "ll_accessories", "ll_decorations", "ll_packaging"
    ]
    const data = {}
    keys.forEach(k => {
      data[k] = localStorage.getItem(k)
    })

    const res = await fetch(`${apiUrl}/api/tenant`, { headers })
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

    // Background sync to individual tables
    syncInventoryItems(headers, JSON.parse(data["ll_inv"] || "[]")).catch(console.error)
    syncRecipesList(headers, JSON.parse(data["ll_recipes"] || "[]")).catch(console.error)
    syncExpensesList(headers, JSON.parse(data["ll_exp"] || "[]")).catch(console.error)
    syncOrdersList(
      headers, 
      JSON.parse(data["ll_prods"] || "[]"), 
      JSON.parse(data["ll_quotes"] || "[]")
    ).catch(console.error)
    syncInvoicesList(headers, JSON.parse(data["ll_quote_invoices"] || "[]")).catch(console.error)
    syncPurchasesList(headers, JSON.parse(data["ll_purchases"] || "[]")).catch(console.error)

  } catch (error) {
    console.error("Sync to backend error:", error)
  }
}

const syncInventoryItems = async (headers, localInv) => {
  const apiUrl = import.meta.env.VITE_API_URL
  const res = await fetch(`${apiUrl}/api/inventory`, { headers })
  if (!res.ok) return
  const serverItems = await res.json()

  // Delete
  for (const sItem of serverItems) {
    if (!localInv.find(i => i.id === sItem.id)) {
      await fetch(`${apiUrl}/api/inventory/${sItem.id}`, { method: "DELETE", headers })
    }
  }

  // Create/Update
  for (const item of localInv) {
    const sItem = serverItems.find(i => i.id === item.id)
    const body = {
      id: item.id,
      name: item.name,
      category: item.cat,
      unit: item.unit,
      cost: Number(item.cost),
      stock: Number(item.stock || 0),
      minStock: Number(item.minStock || 0)
    }
    if (sItem) {
      if (sItem.name !== item.name || sItem.category !== item.cat || sItem.unit !== item.unit || sItem.cost !== item.cost || sItem.stock !== item.stock || sItem.minStock !== item.minStock) {
        await fetch(`${apiUrl}/api/inventory/${item.id}`, {
          method: "PUT",
          headers,
          body: JSON.stringify(body)
        })
      }
    } else {
      await fetch(`${apiUrl}/api/inventory`, {
        method: "POST",
        headers,
        body: JSON.stringify(body)
      })
    }
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
      name: rec.name,
      notes: rec.notes || "",
      ingredients: (rec.ing || []).map(i => ({
        item: i.iid,
        quantity: Number(i.qty)
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
    const body = {
      id: exp.id,
      date: exp.date,
      amount: Number(exp.amount),
      category: exp.category,
      description: exp.description || "",
      receiptUrl: exp.receiptUrl || ""
    }
    if (sExp) {
      if (sExp.amount !== exp.amount || sExp.category !== exp.category || sExp.description !== exp.description || sExp.date !== exp.date) {
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

const syncOrdersList = async (headers, localProds, localQuotes) => {
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
    
    // Map items from tiers
    const items = (o.tiers || []).map(t => ({
      name: t.covering || "Cake tier",
      size: t.size ? String(t.size) : "6",
      shape: t.shape || "round",
      layers: t.layers?.length || 1,
      price: o.salePrice ? Number(o.salePrice / (o.tiers?.length || 1)) : 0,
      cost: o.cost ? Number(o.cost / (o.tiers?.length || 1)) : 0
    }))

    const body = {
      id: o.id,
      status: o.isProd ? (o.status || "pending") : "quote",
      dueDate: o.deliveryDate || o.dueDate || null,
      totalPrice: Number(o.salePrice || 0),
      totalCost: Number(o.cost || 0),
      notes: o.notes || "",
      items
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
    const body = {
      id: inv.id,
      orderId: inv.quoteId || inv.id,
      invoiceNumber: inv.id,
      issueDate: inv.date || new Date().toISOString(),
      dueDate: inv.deliveryDate || null,
      status: inv.status || "unpaid",
      notes: inv.notes || ""
    }
    if (sInv) {
      if (sInv.status !== inv.status || sInv.invoiceNumber !== inv.id || sInv.notes !== inv.notes) {
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
    const body = {
      id: pur.id,
      date: pur.date || new Date().toISOString(),
      supplier: pur.supplier || "Market Run",
      amount: Number(pur.total || 0),
      notes: `${pur.item || "Ingredient"} — Qty: ${pur.qty || 1} (added: ${pur.stockAdded || 0})`
    }
    if (sPur) {
      if (sPur.amount !== body.amount || sPur.supplier !== body.supplier || sPur.notes !== body.notes) {
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
        Object.entries(state).forEach(([k, v]) => {
          if (v !== null) {
            localStorage.setItem(k, v)
          }
        })
        return true
      }
    }
  } catch (error) {
    console.error("Sync from backend error:", error)
  }
  return false
}


// Inventory
export const loadInventory = async (def = []) => {
  const t = load("ll_inv", null)
  return t && t.length > 0 ? t : (def || [])
}
export const saveInventory = async (data) => save("ll_inv", data)

// Productions
export const loadProductions = async (def = []) => load("ll_prods", def)
export const saveProductionsList = async (data) => save("ll_prods", data)
export const saveProduction = async (prod) => {
  const all = load("ll_prods", [])
  const exists = all.find(p => p.id === prod.id)
  save("ll_prods", exists ? all.map(p => p.id === prod.id ? prod : p) : [...all, prod])
}
export const updateProdStatus = async (id, status) => {
  save("ll_prods", load("ll_prods", []).map(p => p.id === id ? { ...p, status } : p))
}

// Transactions
export const loadTransactions = async (def = []) => load("ll_txns", def)
export const saveTxns = async (data) => save("ll_txns", data)

// Expenses
export const loadExpenses = () => load("ll_exp", [])
export const saveExpenses = (data) => save("ll_exp", data)

// Settings
export const loadSetting = (key, def) => load("ll_setting_" + key, def)
export const saveSetting = (key, val) => save("ll_setting_" + key, val)

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
export const saveCompany = (data) => save("ll_co", data)

// Quotes
export const loadQuotes = () => load("ll_quotes", [])
export const saveQuotes = (data) => save("ll_quotes", data)

// Invoices
export const loadInvoices = () => load("ll_invoices", [])
export const saveInvoice = (data) => save("ll_invoices", data)

// Users
export const loadUsers = () => load("ll_users", [{ id: "u1", name: "Owner", pin: "1234", role: "owner" }])
export const saveUsers = (data) => save("ll_users", data)

// Recipes
export const loadRecipes = () => load("ll_recipes", null)
export const saveRecipes = (data) => save("ll_recipes", data)

// Clients
export const loadClients = () => load("ll_clients", [])
export const upsertClient = (name, phone, email) => {
  if (!name || !name.trim()) return
  const all = loadClients()
  if (all.find(c => c.name.toLowerCase() === name.toLowerCase())) {
    save("ll_clients", all.map(c =>
      c.name.toLowerCase() === name.toLowerCase()
        ? { ...c, phone: phone || c.phone, email: email || c.email, lastOrder: new Date().toISOString().slice(0, 10) }
        : c
    ))
  } else {
    save("ll_clients", [...all, {
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
