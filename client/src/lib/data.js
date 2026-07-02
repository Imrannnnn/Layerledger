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
  } catch {}
}

// Inventory
export const loadInventory = async (def = []) => {
  const t = load("ll_inv", null)
  return t && t.length > 0 ? t : (def || [])
}
export const saveInventory = async (data) => save("ll_inv", data)

// Productions
export const loadProductions = async (def = []) => load("ll_prods", def)
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
