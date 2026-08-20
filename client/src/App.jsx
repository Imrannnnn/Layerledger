/**
 * App.jsx — LayerLedger root component
 * ============================================================================
 * Bakery management + accounting app.

 *
 * This file now contains only the application ROOT:
 *   - ErrorBoundary : catches render errors and shows a friendly message.
 *   - App           : holds global state (inventory, productions, expenses,
 *                     transactions, company, users, recipes), loads it from
 *                     the browser on startup, handles login, renders the
 *                     sidebar navigation, and routes between screens via the
 *                     `view` state.
 *
 * Everything else lives in dedicated modules:
 *   constants.js              seed data & fixed option lists
 *   lib/helpers.js            money formatting, ids, costing, AI, CSV
 *   lib/costing.jsx            revenue/report helpers + P&L row components
 *   lib/data.js               sessionStorage read/write ("the database")
 *   components/common/ui.jsx  shared UI building blocks
 *   components/<domain>/...   one screen (or group) per file
 *
 * DATA STORAGE: no server database yet — all data is in the browser's
 * sessionStorage via lib/data.js. A backend + real database (Cloudflare D1 or
 * Supabase) with login and cross-device sync is the planned "Stage 2".
 * ============================================================================
 */
import React, { useState, useRef, useEffect, useCallback, Suspense, lazy } from "react"

// ─── Data access layer (sessionStorage today; a backend API in Stage 2) ───────
import {
  loadInventory, saveInventory, loadProductions, saveProduction, updateProdStatus,
  loadTransactions, saveTxns, loadExpenses, saveExpenses, loadSetting, saveSetting,
  loadCompany, saveCompany, loadInvoices, saveInvoice, loadUsers, saveUsers,
  loadRecipes, saveRecipes, syncToBackend, syncFromBackend, loadTenantInfo, logout, loadLocal, saveLocal, clearTempCalculatorState
} from "./lib/data.js"

// ─── Seed data & helpers ────────────────────────────────────────────────────
import { DEFAULT_INV, DEFAULT_RECIPES } from "./constants.js"
import { Spinner } from "./components/common/ui.jsx"

// Helper to automatically retry dynamic imports on network/chunk load failures (common during new deployments)
const lazyRetry = (importFn) => {
  return lazy(() =>
    importFn().catch(err => {
      console.error("Failed to fetch module, reloading page...", err)
      window.location.reload()
      return new Promise(() => { }) // keep in pending state
    })
  )
}

// ─── Screen components (one import per screen) ──────────────────────────────
const Login = lazyRetry(() => import("./components/auth/Login.jsx").then(m => ({ default: m.Login })))
const Dashboard = lazyRetry(() => import("./components/dashboard/Dashboard.jsx").then(m => ({ default: m.Dashboard })))
const MasterList = lazyRetry(() => import("./components/inventory/MasterList.jsx").then(m => ({ default: m.MasterList })))
const ProductionEntry = lazyRetry(() => import("./components/orders/ProductionEntry.jsx").then(m => ({ default: m.ProductionEntry })))
const Records = lazyRetry(() => import("./components/orders/Records.jsx").then(m => ({ default: m.Records })))
const OrderCalculator = lazyRetry(() => import("./components/orders/OrderCalculator.jsx").then(m => ({ default: m.OrderCalculator })))
const QuotesPage = lazyRetry(() => import("./components/orders/QuotesPage.jsx").then(m => ({ default: m.QuotesPage })))
const ProductionList = lazyRetry(() => import("./components/orders/ProductionList.jsx").then(m => ({ default: m.ProductionList })))
const Invoices = lazyRetry(() => import("./components/orders/Invoices.jsx").then(m => ({ default: m.Invoices })))
const ReceiptScanner = lazyRetry(() => import("./components/money/ReceiptScanner.jsx").then(m => ({ default: m.ReceiptScanner })))
const Expenses = lazyRetry(() => import("./components/money/Expenses.jsx").then(m => ({ default: m.Expenses })))
const BankImport = lazyRetry(() => import("./components/money/BankImport.jsx").then(m => ({ default: m.BankImport })))
const Purchases = lazyRetry(() => import("./components/money/Purchases.jsx").then(m => ({ default: m.Purchases })))
const Payables = lazyRetry(() => import("./components/money/Payables.jsx").then(m => ({ default: m.Payables })))
const Reports = lazyRetry(() => import("./components/reports/Reports.jsx").then(m => ({ default: m.Reports })))
const PandL = lazyRetry(() => import("./components/reports/PandL.jsx").then(m => ({ default: m.PandL })))
const BalanceSheet = lazyRetry(() => import("./components/reports/BalanceSheet.jsx").then(m => ({ default: m.BalanceSheet })))
const MonthlyOverview = lazyRetry(() => import("./components/reports/MonthlyOverview.jsx").then(m => ({ default: m.MonthlyOverview })))
const ShoppingList = lazyRetry(() => import("./components/reports/ShoppingList.jsx").then(m => ({ default: m.ShoppingList })))
const StockStatement = lazyRetry(() => import("./components/reports/StockStatement.jsx").then(m => ({ default: m.StockStatement })))
const Settings = lazyRetry(() => import("./components/settings/Settings.jsx").then(m => ({ default: m.Settings })))
const Onboarding = lazyRetry(() => import("./components/settings/Onboarding.jsx").then(m => ({ default: m.Onboarding })))
const SuperAdminDashboard = lazyRetry(() => import("./components/superadmin/SuperAdminDashboard.jsx").then(m => ({ default: m.SuperAdminDashboard })))

// ═══════════════════════════════════════════════════════════
export class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null, stack: null } }
  static getDerivedStateFromError(error) { return { error: error?.toString(), stack: error?.stack || "" } }
  render() {
    if (this.state.error) return React.createElement("div", { style: { padding: 40, fontFamily: "monospace", background: "#fff", color: "#333" } },
      React.createElement("h2", { style: { color: "red" } }, "App crashed — share this error with Claude:"),
      React.createElement("pre", { style: { background: "#f5f5f5", padding: 16, borderRadius: 8, overflow: "auto", fontSize: 12, whiteSpace: "pre-wrap" } }, this.state.error + " " + this.state.stack)
    )
    return this.props.children
  }
}


export default function App() {
  const isSuperAdminRoute = window.location.pathname.startsWith("/superadmin") || window.location.search.includes("superadmin")
  if (isSuperAdminRoute) {
    return (
      <>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=DM+Sans:opsz,wght@9..40,400;9..40,500&display=swap');*{box-sizing:border-box}body{margin:0;font-family:'DM Sans',sans-serif}:root{--gold:#C8912A;--bg:#F4EEE4;--panel:#FDFAF4;--text:#291608;--muted:#8C6E52;--border:#E0D3BB;--accent:#C8912A}`}</style>
        <Suspense fallback={<Spinner />}>
          <SuperAdminDashboard />
        </Suspense>
      </>
    )
  }

  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = sessionStorage.getItem("ll_current_user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  })
  const [view, setView] = useState("dashboard")
  const [viewHistory, setViewHistory] = useState(["dashboard"])
  const goTo = (v) => { setViewHistory(h => { if (h[h.length - 1] === v) return h; return [...h.slice(-9), v] }); setView(v) }
  const goBack = () => { setViewHistory(h => { if (h.length <= 1) return h; const prev = h[h.length - 2]; setView(prev); return h.slice(0, -1) }); }
  const [onboarded, setOnboarded] = useState(() => !!loadLocal("ll_onboarded", false))
  const [inventory, setInventory] = useState(DEFAULT_INV)
  const [recipes, setRecipes] = useState(() => { const saved = loadRecipes(); return saved && saved.length > 0 ? saved : DEFAULT_RECIPES })
  const [productions, setProductions] = useState([])
  const [transactions, setTransactions] = useState([])
  const [expenses, setExpenses] = useState([])
  const [company, setCompany] = useState(loadCompany())
  const [settings, setSettings] = useState({ accessoryPct: loadSetting("accessoryPct", 10), profitPct: loadSetting("profitPct", 40) })
  const [users, setUsers] = useState(loadUsers())
  const [prefillProd, setPrefillProd] = useState(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [tenantInfo, setTenantInfo] = useState(loadTenantInfo())

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener("resize", handler); return () => window.removeEventListener("resize", handler)
  }, [])

  useEffect(() => {
    async function init() {
      setLoading(true)
      try {
        if (currentUser) {
          await syncFromBackend()
          setTenantInfo(loadTenantInfo())
        }
        const inv = loadInventory(DEFAULT_INV)
        const prods = loadProductions([])
        const txns = loadTransactions([])
        const exps = loadExpenses([])
        const recs = loadRecipes()

        setInventory(inv); setProductions(prods); setTransactions(txns); setExpenses(exps)
        if (recs) setRecipes(recs)
        setUsers(loadUsers()); setCompany(loadCompany())
        setSettings({ accessoryPct: loadSetting("accessoryPct", 10), profitPct: loadSetting("profitPct", 40) })
        setOnboarded(!!loadLocal("ll_onboarded", false))
      } catch (err) {
        console.error("Initialization error:", err)
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [currentUser])

  // Periodic background pull paused to throttle/stop automatic sync
  /*
  useEffect(() => {
    if (currentUser) {
      const interval = setInterval(async () => {
        setSyncing(true)
        try {
          const success = await syncFromBackend()
          if (success) {
            setTenantInfo(loadTenantInfo())
            setInventory(loadInventory(DEFAULT_INV))
            setProductions(loadProductions([]))
            setTransactions(loadTransactions([]))
            setExpenses(loadExpenses([]))
            const recs = loadRecipes()
            if (recs) setRecipes(recs)
          }
        } finally {
          setSyncing(false)
        }
      }, 10000)
      return () => clearInterval(interval)
    }
  }, [currentUser])
  */

  const setViewWithSync = async (v) => {
    goTo(v)
    setSyncing(true)
    try {
      const success = await syncFromBackend()
      if (success) {
        setTenantInfo(loadTenantInfo())
        setInventory(loadInventory(DEFAULT_INV))
        setProductions(loadProductions([]))
        setTransactions(loadTransactions([]))
        setExpenses(loadExpenses([]))
        const recs = loadRecipes()
        if (recs) setRecipes(recs)
      }
    } finally {
      setSyncing(false)
    }
  }

  const gold = company.primaryColor || "var(--gold)"
  const sidebar = company.sidebarColor || "var(--sidebar)"

  // Apply brand colour globally — must be before any conditional returns
  useEffect(() => {
    document.documentElement.style.setProperty("--gold", gold)
    document.documentElement.style.setProperty("--sidebar", sidebar)
  }, [gold, sidebar])

  const role = currentUser?.role || "owner"
  const nav = [
    { id: "dashboard", label: "Dashboard", icon: "◈", roles: ["owner", "production", "customer_service"] },
    { id: "_ops", label: "Operations", icon: "", roles: ["owner", "production", "customer_service"], divider: true },
    { id: "masterlist", label: "Master List", icon: "⚙", roles: ["owner", "production"] },
    { id: "calculator", label: "Order Calculator", icon: "🧮", roles: ["owner", "production"] },

    { id: "receipts", label: "Receipt Scanner", icon: "🧾", roles: ["owner", "production"] },
    { id: "shopping", label: "Shopping List", icon: "🛒", roles: ["owner", "production"] },
    { id: "quotes", label: "Quotes", icon: "💬", roles: ["owner", "customer_service"] },
    { id: "records", label: "Order History", icon: "≡", roles: ["owner", "customer_service"] },
    { id: "prodlist", label: "Production List", icon: "📅", roles: ["owner", "production"] },
    { id: "invoices", label: "Invoices", icon: "📄", roles: ["owner", "customer_service"] },
    { id: "_accounts", label: "Accounts", icon: "", roles: ["owner"], divider: true },
    { id: "purchases", label: "Purchases", icon: "🛍", roles: ["owner"] },
    { id: "payables", label: "Credit Purchases", icon: "📋", roles: ["owner"] },
    { id: "expenses", label: "Expenses", icon: "💸", roles: ["owner"] },
    { id: "bank", label: "Bank Statement", icon: "⊞", roles: ["owner"] },
    { id: "_reports", label: "Reports", icon: "", roles: ["owner"], divider: true },
    { id: "monthly", label: "Monthly Overview", icon: "📊", roles: ["owner"] },
    { id: "pandl", label: "P&L Statement", icon: "📑", roles: ["owner"] },
    { id: "balance", label: "Balance Sheet", icon: "⚖", roles: ["owner"] },
    { id: "_system", label: "System", icon: "", roles: ["owner", "production", "customer_service"], divider: true },
    { id: "settings", label: "Settings", icon: "⚙", roles: ["owner"] },
  ].filter(n => n.roles.includes(role))

  const goTo2 = (id) => { goTo(id); setSidebarOpen(false) }

  if (!currentUser) {
    return <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=DM+Sans:opsz,wght@9..40,400;9..40,500&display=swap');*{box-sizing:border-box}body{margin:0}:root{--gold:${gold};--sidebar:${sidebar};--bg:#F4EEE4;--panel:#FDFAF4;--text:#291608;--muted:#8C6E52;--border:#E0D3BB;--accent:${gold}}
.main-content{color:var(--text)}
.main-content h1,.main-content h2,.main-content h3{color:var(--text)}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <Suspense fallback={<Spinner />}>
        <Login onLogin={(u) => {
          setCurrentUser(u);
          sessionStorage.setItem("ll_current_user", JSON.stringify(u));
          saveSetting("lastUser", u.id);
          if (!loadLocal("ll_onboarded", false)) setOnboarded(false);
        }} />
      </Suspense>
    </>
  }

  // Show onboarding for first-time users
  if (currentUser && !onboarded) {
    if (loading) return <Spinner />
    return <Suspense fallback={<Spinner />}><Onboarding
      gold={gold}
      company={company}
      setCompany={setCompany}
      inventory={inventory}
      setInventory={setInventory}
      recipes={recipes}
      setRecipes={setRecipes}
      settings={settings}
      setSettings={setSettings}
      onComplete={async () => { await saveLocal("ll_onboarded", "1"); setOnboarded(true) }}
      onSkip={async () => { await saveLocal("ll_onboarded", "1"); setOnboarded(true) }}
      setView={async v => { await saveLocal("ll_onboarded", "1"); setOnboarded(true); setViewWithSync(v) }}
    /></Suspense>
  }

  const sidebarContent = <>
    <div style={{ padding: "18px 16px 14px", borderBottom: "1px solid rgba(200,145,42,0.2)", display: "flex", alignItems: "center", gap: 10 }}>
      {company.logo && <img src={company.logo} alt="logo" style={{ width: 30, height: 30, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />}
      <div><div style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, color: gold, fontWeight: 700, lineHeight: 1.2 }}>{company.name || "BakeWealth"}</div><div style={{ fontSize: 9, color: "#7B5A3A", textTransform: "uppercase", letterSpacing: 2, marginTop: 1 }}>Bakery Books</div></div>
    </div>
    <div style={{ flex: 1, paddingTop: 8, overflowY: "auto" }}>
      {nav.map(n => n.divider
        ? <div key={n.id} style={{ padding: "10px 16px 4px", fontSize: 9.5, color: "#5A3D20", textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 600, marginTop: 4 }}>{n.label}</div>
        : <div key={n.id} onClick={() => goTo2(n.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 16px", cursor: "pointer", fontSize: 13, fontWeight: view === n.id ? 500 : 400, color: view === n.id ? gold : "#8B6B4A", background: view === n.id ? "rgba(200,145,42,0.1)" : "transparent", borderLeft: `2px solid ${view === n.id ? gold : "transparent"}`, transition: "all 0.15s" }}><span style={{ fontSize: 14 }}>{n.icon}</span>{n.label}</div>
      )}
    </div>
    <div style={{ padding: "10px 16px", borderTop: "1px solid rgba(200,145,42,0.1)" }}>
      <div style={{ fontSize: 11.5, color: "#6B4A2A", fontWeight: 500 }}>{currentUser?.name}</div>
      <div style={{ fontSize: 10.5, color: "#3D2010", marginTop: 1, display: "flex", justifyContent: "space-between" }}>
        <span style={{ cursor: "pointer", color: gold }} onClick={async () => {
          clearTempCalculatorState();
          await syncToBackend();
          logout();
          setCurrentUser(null);
        }}>Logout</span>
      </div>
    </div>
  </>

  let trialExpiryText = null
  if (tenantInfo && tenantInfo.createdAt && tenantInfo.settings?.plan !== "pro") {
    const trialLengthMs = 30 * 24 * 60 * 60 * 1000
    const expires = new Date(tenantInfo.createdAt).getTime() + trialLengthMs
    const diffDays = Math.ceil((expires - new Date().getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays <= 3 && diffDays >= 0) {
      trialExpiryText = `Trial ends in ${diffDays} day${diffDays !== 1 ? 's' : ''}`
    }
  }

  return <>
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=DM+Sans:opsz,wght@9..40,400;9..40,500&display=swap');
      *{box-sizing:border-box}body{margin:0;padding:0}
      :root{--gold:${gold};--sidebar:${sidebar};--bg:#F4EEE4;--panel:#FDFAF4;--text:#291608;--muted:#8C6E52;--border:#E0D3BB;--accent:${gold}}
      @keyframes spin{to{transform:rotate(360deg)}}
    `}</style>
    <div style={{ display: "flex", height: "100vh", fontFamily: "'DM Sans',sans-serif", background: "var(--bg)", overflow: "hidden" }}>

      {/* Desktop sidebar */}
      {!isMobile && <div style={{ width: 200, background: "var(--sidebar)", display: "flex", flexDirection: "column", flexShrink: 0, height: "100vh" }}>{sidebarContent}</div>}

      {/* Mobile sidebar overlay */}
      {isMobile && sidebarOpen && <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex" }}>
        <div style={{ width: 220, background: "var(--sidebar)", display: "flex", flexDirection: "column", height: "100%" }}>{sidebarContent}</div>
        <div style={{ flex: 1, background: "rgba(0,0,0,0.5)" }} onClick={() => setSidebarOpen(false)} />
      </div>}

      {/* Main */}
      <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Top Header Bar */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 24px",
          background: "var(--sidebar)",
          borderBottom: "1px solid rgba(200,145,42,0.15)",
          position: "sticky",
          top: 0,
          zIndex: 50,
          flexShrink: 0
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {isMobile && (
              <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: gold, fontSize: 22, lineHeight: 1 }}>☰</button>
            )}
            {company.logo && <img src={company.logo} alt="logo" style={{ width: 28, height: 28, borderRadius: 6, objectFit: "cover" }} />}
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, color: gold, fontWeight: 700 }}>{company.name || "BakeWealth"}</div>
            {!isMobile && <div style={{ fontSize: 12, color: "#8B6B4A", marginLeft: 10, background: "rgba(200,145,42,0.1)", padding: "2px 8px", borderRadius: 4 }}>{nav.find(n => n.id === view)?.label}</div>}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {syncing && (
              <span style={{ fontSize: 11, color: "#8B6B4A", background: "rgba(200,145,42,0.1)", padding: "4px 10px", borderRadius: 20, display: "flex", alignItems: "center", gap: 6, fontWeight: 500 }}>
                <span style={{ display: "inline-block", width: 8, height: 8, border: "2px solid var(--gold)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                -
              </span>
            )}
            {trialExpiryText && (
              <div style={{
                background: "#FFF1F1",
                border: "1px solid #FFCDCD",
                color: "#B03A2E",
                fontSize: 12,
                fontWeight: 600,
                padding: "4px 12px",
                borderRadius: 20,
                display: "flex",
                alignItems: "center",
                gap: 6,
                boxShadow: "0 2px 4px rgba(176,58,46,0.05)"
              }}>
                <span>⏳</span>
                <span>{trialExpiryText}</span>
              </div>
            )}
          </div>
        </div>

        <div className="main-content" style={{ padding: isMobile ? "14px" : "24px 26px", flex: 1, overflowY: "auto", color: "var(--text)" }}>
          {loading ? <Spinner /> :
            <Suspense fallback={<Spinner />}>
              {view === "dashboard" && <Dashboard productions={productions} inventory={inventory} expenses={expenses} setView={setViewWithSync} user={currentUser} tenantInfo={tenantInfo} />}
              {view === "masterlist" && <MasterList inventory={inventory} setInventory={setInventory} recipes={recipes} setRecipes={setRecipes} user={currentUser} setView={setViewWithSync} />}
              {view === "calculator" && <OrderCalculator inventory={inventory} recipes={recipes} settings={settings} setView={setViewWithSync} company={company} />}
              {view === "production" && <ProductionEntry inventory={inventory} setInventory={setInventory} recipes={recipes} productions={productions} setProductions={setProductions} settings={settings} setView={setViewWithSync} user={currentUser} />}
              {view === "receipts" && <ReceiptScanner inventory={inventory} setInventory={setInventory} expenses={expenses} setExpenses={setExpenses} />}
              {view === "purchases" && <Purchases inventory={inventory} setInventory={setInventory} expenses={expenses} setExpenses={setExpenses} setView={setViewWithSync} isOwner={!currentUser || currentUser?.role === "owner"} />}
              {view === "expenses" && <Expenses expenses={expenses} setExpenses={setExpenses} isOwner={!currentUser || currentUser?.role === "owner"} />}
              {view === "quotes" && <QuotesPage inventory={inventory} setInventory={setInventory} recipes={recipes} setView={setViewWithSync} productions={productions} setProductions={setProductions} />}
              {view === "records" && <Records productions={productions} setProductions={setProductions} setView={setViewWithSync} setPrefillProd={setPrefillProd} user={currentUser} />}
              {view === "prodlist" && <ProductionList productions={productions} setProductions={setProductions} company={company} setView={setViewWithSync} />}
              {view === "bank" && <BankImport transactions={transactions} setTransactions={setTransactions} productions={productions} setProductions={setProductions} expenses={expenses} setExpenses={setExpenses} />}
              {view === "monthly" && <MonthlyOverview inventory={inventory} productions={productions} setProductions={setProductions} expenses={expenses} setExpenses={setExpenses} company={company} isOwner={!currentUser || currentUser?.role === "owner"} />}
              {view === "pandl" && <PandL productions={productions} expenses={expenses} company={company} />}
              {view === "payables" && <Payables inventory={inventory} setInventory={setInventory} />}
              {view === "balance" && <BalanceSheet productions={productions} expenses={expenses} inventory={inventory} transactions={transactions} company={company} />}
              {view === "shopping" && <ShoppingList inventory={inventory} setInventory={setInventory} company={company} />}
              {view === "invoices" && <Invoices productions={productions} company={company} prefillProd={prefillProd} setPrefillProd={setPrefillProd} isOwner={!currentUser || currentUser?.role === "owner"} />}
              {view === "settings" && <Settings company={company} setCompany={setCompany} settings={settings} setSettings={setSettings} users={users} setUsers={setUsers} inventory={inventory} setInventory={setInventory} user={currentUser} />}
            </Suspense>
          }
        </div>
        {viewHistory.length > 1 && (
          <button
            onClick={goBack}
            style={{
              position: "fixed",
              bottom: 24,
              right: 24,
              zIndex: 9999,
              background: "var(--gold)",
              color: "#fff",
              border: "none",
              borderRadius: "50px",
              padding: "12px 22px",
              fontSize: "14px",
              fontWeight: "600",
              cursor: "pointer",
              boxShadow: "0 4px 16px rgba(200, 145, 42, 0.45)",
              display: "flex",
              alignItems: "center",
              gap: 6,
              transition: "transform 0.15s ease, background 0.15s ease",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = "scale(1.05)";
              e.currentTarget.style.background = "#b8832a";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = "scale(1)";
              e.currentTarget.style.background = "var(--gold)";
            }}
          >
            ← Back
          </button>
        )}
      </div>
    </div>
  </>
}
