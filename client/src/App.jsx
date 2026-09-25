/**
 * App.jsx — BakeWealth root component
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
 *   lib/data.js               PostgreSQL database client & data layer
 *   components/common/ui.jsx  shared UI building blocks
 *   components/<domain>/...   one screen (or group) per file
 *
 * DATA STORAGE: All data is stored and persisted in Neon PostgreSQL.
 * ============================================================================
 */
import React, { useState, useRef, useEffect, useCallback, Suspense, lazy } from "react"

// ─── Data access layer (PostgreSQL database API) ────────────────────────────
import {
  loadInventory, saveInventory, loadProductions, saveProduction, updateProdStatus,
  loadTransactions, saveTxns, loadExpenses, saveExpenses, loadSetting, saveSetting,
  loadCompany, saveCompany, loadInvoices, saveInvoice, loadUsers, saveUsers,
  loadRecipes, saveRecipes, syncToBackend, syncFromBackend, loadTenantInfo, logout, loadLocal, saveLocal, clearTempCalculatorState,
  loadDashboardFromLogin, fetchPageDataOnDemand
} from "./lib/data.js"

// ─── Seed data & helpers ────────────────────────────────────────────────────
import { DEFAULT_INV, DEFAULT_RECIPES } from "./constants.js"
import { Spinner, FullPageLoader } from "./components/common/ui.jsx"
import {
  LayoutDashboard,
  Layers,
  Calculator,
  Users,
  Receipt,
  ShoppingCart,
  MessageSquare,
  History,
  Calendar,
  FileText,
  ShoppingBag,
  CreditCard,
  Banknote,
  FileSpreadsheet,
  BarChart3,
  TrendingUp,
  Scale,
  Settings as SettingsIcon,
  PackageCheck,
  Menu,
  LogOut,
  Coins,
  Home as HomeIcon
} from "lucide-react"
import { TokenPurchaseModal } from "./components/common/TokenPurchaseModal.jsx"
import { PlanLimitModal } from "./components/common/PlanLimitModal.jsx"

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
const HomePage = lazyRetry(() => import("./components/home/HomePage.jsx").then(m => ({ default: m.HomePage })))
const Login = lazyRetry(() => import("./components/auth/Login.jsx").then(m => ({ default: m.Login })))
const Dashboard = lazyRetry(() => import("./components/dashboard/Dashboard.jsx").then(m => ({ default: m.Dashboard })))
const MasterList = lazyRetry(() => import("./components/inventory/MasterList.jsx").then(m => ({ default: m.MasterList })))
const ProductionEntry = lazyRetry(() => import("./components/orders/ProductionEntry.jsx").then(m => ({ default: m.ProductionEntry })))
const Records = lazyRetry(() => import("./components/orders/Records.jsx").then(m => ({ default: m.Records })))
const OrderCalculator = lazyRetry(() => import("./components/orders/OrderCalculator.jsx").then(m => ({ default: m.OrderCalculator })))
const QuotesPage = lazyRetry(() => import("./components/orders/QuotesPage.jsx").then(m => ({ default: m.QuotesPage })))
const Clients = lazyRetry(() => import("./components/clients/Clients.jsx").then(m => ({ default: m.Clients })))
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
const OpeningStock = lazyRetry(() => import("./components/inventory/OpeningStock.jsx").then(m => ({ default: m.OpeningStock })))
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
  const [hasOnboardingParam, setHasOnboardingParam] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).get("onboarding") === "1";
    } catch {
      return false;
    }
  });

  const [activationToken, setActivationToken] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).get("activate") || null;
    } catch {
      return null;
    }
  });
  const [activating, setActivating] = useState(false);
  const [activationError, setActivationError] = useState("");

  const [authMode, setAuthMode] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("login") === "1" || params.get("auth") === "1" || window.location.pathname === "/login") return "login";
      if (params.get("register") === "1" || window.location.pathname === "/register") return "register";
    } catch {
      return null;
    }
    return null;
  });

  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = sessionStorage.getItem("ll_current_user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  })
  const [view, setView] = useState(() => {
    try {
      const saved = sessionStorage.getItem("ll_active_view")
      if (saved && saved !== "login") return saved
    } catch {}
    return "dashboard"
  })
  const [viewHistory, setViewHistory] = useState(() => {
    try {
      const saved = sessionStorage.getItem("ll_active_view")
      if (saved && saved !== "login") return ["dashboard", saved]
    } catch {}
    return ["dashboard"]
  })
  const goTo = (v) => {
    try { sessionStorage.setItem("ll_active_view", v) } catch {}
    setViewHistory(h => { if (h[h.length - 1] === v) return h; return [...h.slice(-9), v] }); setView(v)
  }
  const goBack = () => {
    setViewHistory(h => {
      if (h.length <= 1) return h;
      const prev = h[h.length - 2];
      try { sessionStorage.setItem("ll_active_view", prev) } catch {}
      setView(prev);
      return h.slice(0, -1)
    });
  }
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
  const [loading, setLoading] = useState(false)
  const [initialSyncing, setInitialSyncing] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [tenantInfo, setTenantInfo] = useState(loadTenantInfo())
  const [tokenModalOpen, setTokenModalOpen] = useState(false)
  const [tokenModalData, setTokenModalData] = useState({ isInsufficient: false, requiredTokens: 2, requiredCredits: 2, currentBalance: 0 })
  const [planLimitModalOpen, setPlanLimitModalOpen] = useState(false)
  const [planLimitData, setPlanLimitData] = useState({})
  const [settingsTab, setSettingsTab] = useState("company")

  useEffect(() => {
    const onInsufficient = (e) => {
      const detail = e.detail || {}
      const req = detail.requiredCredits !== undefined ? detail.requiredCredits : (detail.requiredTokens || 2)
      setTokenModalData({
        isInsufficient: true,
        requiredTokens: req,
        requiredCredits: req,
        currentBalance: detail.currentBalance ?? (tenantInfo?.tokenBalance || 0)
      })
      setTokenModalOpen(true)
    }

    const onTokenUpdated = (e) => {
      const newBal = e.detail?.creditsDeducted !== undefined
        ? (e.detail?.newBalance ?? e.detail?.tokenBalance)
        : (e.detail?.creditBalance ?? e.detail?.tokenBalance)
      if (typeof newBal === "number") {
        setTenantInfo(prev => prev ? { ...prev, tokenBalance: newBal } : { tokenBalance: newBal })
      }
    }

    const onPlanLimit = (e) => {
      const detail = e.detail || {}
      setPlanLimitData(detail)
      setPlanLimitModalOpen(true)
    }

    window.addEventListener("bakewealth:insufficient-tokens", onInsufficient)
    window.addEventListener("layerledger:insufficient-tokens", onInsufficient)
    window.addEventListener("layerledger:insufficient-credits", onInsufficient)
    window.addEventListener("bakewealth:token-updated", onTokenUpdated)
    window.addEventListener("layerledger:token-updated", onTokenUpdated)
    window.addEventListener("layerledger:credit-updated", onTokenUpdated)
    window.addEventListener("layerledger:plan-limit-reached", onPlanLimit)
    window.addEventListener("bakewealth:plan-limit-reached", onPlanLimit)
    return () => {
      window.removeEventListener("bakewealth:insufficient-tokens", onInsufficient)
      window.removeEventListener("layerledger:insufficient-tokens", onInsufficient)
      window.removeEventListener("layerledger:insufficient-credits", onInsufficient)
      window.removeEventListener("bakewealth:token-updated", onTokenUpdated)
      window.removeEventListener("layerledger:token-updated", onTokenUpdated)
      window.removeEventListener("layerledger:credit-updated", onTokenUpdated)
      window.removeEventListener("layerledger:plan-limit-reached", onPlanLimit)
      window.removeEventListener("bakewealth:plan-limit-reached", onPlanLimit)
    }
  }, [tenantInfo])

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener("resize", handler); return () => window.removeEventListener("resize", handler)
  }, [])

  useEffect(() => {
    let isMounted = true
    async function init() {
      if (!currentUser) return
      // Hydrate immediate local state for instant rendering
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

      // Silently pull fresh database records on startup in background without blocking UI
      syncFromBackend().then(() => {
        if (!isMounted) return
        setTenantInfo(loadTenantInfo())
        setInventory(loadInventory(DEFAULT_INV))
        setProductions(loadProductions([]))
        setTransactions(loadTransactions([]))
        setExpenses(loadExpenses([]))
        const freshRecs = loadRecipes()
        if (freshRecs) setRecipes(freshRecs)
        setUsers(loadUsers())
        setCompany(loadCompany())
        setSettings({ accessoryPct: loadSetting("accessoryPct", 10), profitPct: loadSetting("profitPct", 40) })
        setOnboarded(!!loadLocal("ll_onboarded", false))
      }).catch(err => {
        console.warn("Silent background startup sync notice:", err)
      })
    }
    init()
    return () => { isMounted = false }
  }, [currentUser])

  // Handle Paystack redirect after hosted checkout
  useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    const ref = params.get("reference") || params.get("trxref")
    if (ref) {
      import("./lib/data.js").then(({ verifyGatewayPayment, syncFromBackend, loadTenantInfo }) => {
        verifyGatewayPayment(ref)
          .then(async (res) => {
            const cleanUrl = window.location.origin + window.location.pathname
            window.history.replaceState({}, document.title, cleanUrl)
            await syncFromBackend()
            setTenantInfo(loadTenantInfo())
            alert("Payment verified successfully with Paystack! Your plan or credits have been updated.")
          })
          .catch(err => {
            console.warn("Paystack redirect verify notice:", err)
          })
      })
    }
  }, [])

  // Handle email activation link (?activate=<token>)
  useEffect(() => {
    if (!activationToken) return
    let isMounted = true

    async function handleActivation() {
      setActivating(true)
      setActivationError("")
      const apiUrl = import.meta.env.VITE_API_URL || ""
      try {
        const res = await fetch(`${apiUrl}/api/auth/activate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: activationToken })
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.message || "Failed to activate account")

        // Clean up URL parameter cleanly
        try {
          if (window.history.replaceState) {
            const url = new URL(window.location.href)
            url.searchParams.delete("activate")
            url.searchParams.delete("token")
            window.history.replaceState({}, document.title, url.pathname + (url.search || ""))
          }
        } catch {
          // Safe fallback
        }

        // Store user and lead directly into interactive onboarding
        const activatedUser = { ...data, isNewRegistration: true }
        sessionStorage.setItem("ll_current_user", JSON.stringify(activatedUser))
        saveLocal("ll_onboarded", "0")
        setOnboarded(false)

        try {
          await syncFromBackend()
          setTenantInfo(loadTenantInfo())
          setInventory(loadInventory(DEFAULT_INV))
          setProductions(loadProductions([]))
          setTransactions(loadTransactions([]))
          setExpenses(loadExpenses([]))
          const freshRecs = loadRecipes()
          if (freshRecs) setRecipes(freshRecs)
          setUsers(loadUsers())
          setCompany(loadCompany())
          setSettings({ accessoryPct: loadSetting("accessoryPct", 10), profitPct: loadSetting("profitPct", 40) })
        } catch (syncErr) {
          console.error("Activation sync notice:", syncErr)
        }

        if (isMounted) {
          setCurrentUser(activatedUser)
          setActivationToken(null)
        }
      } catch (err) {
        if (isMounted) {
          setActivationError(err.message)
          setActivationToken(null)
        }
      } finally {
        if (isMounted) setActivating(false)
      }
    }

    handleActivation()
    return () => { isMounted = false }
  }, [activationToken])

  const setViewWithSync = (v) => {
    goTo(v)
    if (v === "monthly" || v === "pandl" || v === "balance" || v === "expenses" || v === "records") {
      setExpenses(loadExpenses([]))
      setProductions(loadProductions([]))
    }

    // Fetch data on-demand specifically for the requested screen quietly in background
    fetchPageDataOnDemand(v).then(() => {
      if (v === "bank") setTransactions(loadTransactions([]))
      if (v === "expenses" || v === "monthly" || v === "pandl" || v === "balance") setExpenses(loadExpenses([]))
      if (v === "masterlist") {
        const recs = loadRecipes()
        if (recs) setRecipes(recs)
      }
    }).catch(err => {
      console.warn("Page data fetch notice:", err)
    })
  }

  const handleLogout = useCallback(() => {
    try {
      clearTempCalculatorState()
      // Non-blocking background sync attempt - will never stall logout
      syncToBackend().catch(err => console.warn("Background sync on logout notice:", err))
    } catch (e) {
      console.warn("Logout cleanup warning:", e)
    } finally {
      logout()
      try { sessionStorage.removeItem("ll_active_view") } catch {}
      setCurrentUser(null)
      setAuthMode(null)
      setSidebarOpen(false)
      setView("dashboard")
      setViewHistory(["dashboard"])
    }
  }, [])

  const gold = company.primaryColor || "var(--gold)"
  const sidebar = company.sidebarColor || "var(--sidebar)"

  // Apply brand colour globally — must be before any conditional returns
  useEffect(() => {
    document.documentElement.style.setProperty("--gold", gold)
    document.documentElement.style.setProperty("--sidebar", sidebar)
  }, [gold, sidebar])

  const role = currentUser?.role || "owner"
  const nav = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["owner", "production", "customer_service"] },
    { id: "home", label: "BakeWealth Home", icon: HomeIcon, roles: ["owner", "production", "customer_service"] },
    { id: "_ops", label: "Operations", icon: null, roles: ["owner", "production", "customer_service"], divider: true },
    { id: "masterlist", label: "Master List", icon: Layers, roles: ["owner", "production"] },
    { id: "calculator", label: "Order Calculator", icon: Calculator, roles: ["owner", "production"] },
    { id: "clients", label: "Clients", icon: Users, roles: ["owner", "customer_service", "production"] },

    { id: "receipts", label: "Receipt Scanner", icon: Receipt, roles: ["owner", "production"] },
    { id: "shopping", label: "Shopping List", icon: ShoppingCart, roles: ["owner", "production"] },
    { id: "quotes", label: "Quotes", icon: MessageSquare, roles: ["owner", "customer_service"] },
    { id: "records", label: "Order History", icon: History, roles: ["owner", "customer_service"] },
    { id: "prodlist", label: "Production List", icon: Calendar, roles: ["owner", "production"] },
    { id: "invoices", label: "Invoices", icon: FileText, roles: ["owner", "customer_service"] },
    { id: "_accounts", label: "Accounts", icon: null, roles: ["owner"], divider: true },
    { id: "purchases", label: "Purchases", icon: ShoppingBag, roles: ["owner"] },
    { id: "payables", label: "Credit Purchases", icon: CreditCard, roles: ["owner"] },
    { id: "expenses", label: "Expenses", icon: Banknote, roles: ["owner"] },
    { id: "bank", label: "Bank Statement", icon: FileSpreadsheet, roles: ["owner"] },
    { id: "_reports", label: "Reports", icon: null, roles: ["owner"], divider: true },
    { id: "monthly", label: "Monthly Overview", icon: BarChart3, roles: ["owner"] },
    { id: "pandl", label: "P&L Statement", icon: TrendingUp, roles: ["owner"] },
    { id: "balance", label: "Balance Sheet", icon: Scale, roles: ["owner"] },
    { id: "_system", label: "System", icon: null, roles: ["owner", "production", "customer_service"], divider: true },
    { id: "settings", label: "Settings", icon: SettingsIcon, roles: ["owner"] },
  ].filter(n => n.roles.includes(role))

  const goTo2 = (id) => { goTo(id); setSidebarOpen(false) }

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

  if (activating) {
    return <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=DM+Sans:opsz,wght@9..40,400;9..40,500&display=swap');*{box-sizing:border-box}body{margin:0}:root{--gold:${gold};--sidebar:${sidebar};--bg:#F4EEE4;--panel:#FDFAF4;--text:#291608;--muted:#8C6E52;--border:#E0D3BB;--accent:${gold}}`}</style>
      <FullPageLoader message="Activating your Bakewealth account and launching your onboarding session..." />
    </>
  }

  if (initialSyncing) {
    return <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=DM+Sans:opsz,wght@9..40,400;9..40,500&display=swap');*{box-sizing:border-box}body{margin:0}:root{--gold:${gold};--sidebar:${sidebar};--bg:#F4EEE4;--panel:#FDFAF4;--text:#291608;--muted:#8C6E52;--border:#E0D3BB;--accent:${gold}}`}</style>
      <FullPageLoader message="Loading your bakery records from the database..." />
    </>
  }

  if (!currentUser) {
    if (authMode) {
      return <>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=DM+Sans:opsz,wght@9..40,400;9..40,500&display=swap');*{box-sizing:border-box}body{margin:0}:root{--gold:${gold};--sidebar:${sidebar};--bg:#F4EEE4;--panel:#FDFAF4;--text:#291608;--muted:#8C6E52;--border:#E0D3BB;--accent:${gold}}
.main-content{color:var(--text)}
.main-content h1,.main-content h2,.main-content h3{color:var(--text)}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <Suspense fallback={<FullPageLoader message="Loading application..." />}>
          <Login
            initialTab={authMode}
            initialError={activationError}
            onBackToHome={() => setAuthMode(null)}
            onLogin={async (u) => {
              setInitialSyncing(true);
              sessionStorage.setItem("ll_current_user", JSON.stringify(u));
              if (u?.isNewRegistration) {
                saveLocal("ll_onboarded", "0");
                setOnboarded(false);
              } else {
                saveLocal("ll_onboarded", "1");
                setOnboarded(true);
              }

              try {
                await syncFromBackend();
                setTenantInfo(loadTenantInfo());
                setInventory(loadInventory(DEFAULT_INV));
                setProductions(loadProductions([]));
                setTransactions(loadTransactions([]));
                setExpenses(loadExpenses([]));
                const freshRecs = loadRecipes();
                if (freshRecs) setRecipes(freshRecs);
                setUsers(loadUsers());
                setCompany(loadCompany());
                setSettings({ accessoryPct: loadSetting("accessoryPct", 10), profitPct: loadSetting("profitPct", 40) });
              } catch (err) {
                console.error("Login sync notice:", err);
              } finally {
                setCurrentUser(u);
                setAuthMode(null);
                setInitialSyncing(false);
              }
            }}
          />
        </Suspense>
      </>
    }

    return (
      <Suspense fallback={<FullPageLoader message="Loading BakeWealth..." />}>
        <HomePage
          onLoginClick={() => setAuthMode("login")}
          onRegisterClick={() => setAuthMode("register")}
          currentUser={null}
        />
      </Suspense>
    )
  }

  if (currentUser && view === "home") {
    return (
      <Suspense fallback={<FullPageLoader message="Loading BakeWealth Home..." />}>
        <HomePage
          onGoToDashboard={() => goTo("dashboard")}
          currentUser={currentUser}
          onLogout={handleLogout}
        />
      </Suspense>
    )
  }

  // Show onboarding strictly for first-time user registrations or when directly launched via welcome email link (?onboarding=1)
  const shouldShowOnboarding = Boolean(
    currentUser && (currentUser.isNewRegistration || hasOnboardingParam) && !onboarded
  )

  if (shouldShowOnboarding) {
    const handleExitOnboarding = async (targetView) => {
      await saveLocal("ll_onboarded", "1");
      setOnboarded(true);
      if (currentUser?.isNewRegistration) {
        const normalizedUser = { ...currentUser, isNewRegistration: false };
        sessionStorage.setItem("ll_current_user", JSON.stringify(normalizedUser));
        setCurrentUser(normalizedUser);
      }
      setHasOnboardingParam(false);
      try {
        if (window.history.replaceState) {
          const url = new URL(window.location.href);
          url.searchParams.delete("onboarding");
          window.history.replaceState({}, document.title, url.pathname + (url.search || ""));
        }
      } catch {
        // Safe URL history fallback
      }
      if (targetView) setViewWithSync(targetView);
    };

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
      onComplete={() => handleExitOnboarding()}
      onSkip={() => handleExitOnboarding()}
      setView={v => handleExitOnboarding(v)}
    /></Suspense>
  }

  const sidebarContent = <>
    <div style={{ padding: "18px 16px 14px", borderBottom: "1px solid rgba(200,145,42,0.2)", display: "flex", alignItems: "center", gap: 10 }}>
      <img src={company.logo || "/Bakewealthlogo.jpeg"} alt="logo" style={{ width: 32, height: 32, borderRadius: 6, objectFit: "cover", flexShrink: 0, border: "1px solid rgba(200,145,42,0.3)", background: "#fff" }} />
      <div><div style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, color: gold, fontWeight: 700, lineHeight: 1.2 }}>{company.name || "BakeWealth"}</div><div style={{ fontSize: 9, color: "#7B5A3A", textTransform: "uppercase", letterSpacing: 2, marginTop: 1 }}>Bakery Books</div></div>
    </div>
    <div style={{ flex: 1, paddingTop: 8, overflowY: "auto" }}>
      {nav.map(n => n.divider
        ? <div key={n.id} style={{ padding: "10px 16px 4px", fontSize: 9.5, color: "#5A3D20", textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 600, marginTop: 4 }}>{n.label}</div>
        : <div key={n.id} onClick={() => goTo2(n.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 16px", cursor: "pointer", fontSize: 13, fontWeight: view === n.id ? 500 : 400, color: view === n.id ? gold : "#8B6B4A", background: view === n.id ? "rgba(200,145,42,0.1)" : "transparent", borderLeft: `2px solid ${view === n.id ? gold : "transparent"}`, transition: "all 0.15s" }}>
            {n.icon && <n.icon size={16} style={{ flexShrink: 0, color: view === n.id ? gold : "#8B6B4A" }} />}
            <span>{n.label}</span>
          </div>
      )}
    </div>
    <div style={{ padding: "12px 16px", borderTop: "1px solid rgba(200,145,42,0.15)", flexShrink: 0 }}>
      <div style={{ fontSize: 11.5, color: "#8B6B4A", fontWeight: 500, marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {currentUser?.name || "User"}
      </div>
      <button
        onClick={handleLogout}
        style={{
          width: "100%",
          padding: "7px 10px",
          background: "rgba(200,145,42,0.1)",
          border: "1px solid rgba(200,145,42,0.25)",
          borderRadius: 6,
          color: gold,
          fontSize: 12,
          fontWeight: 500,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          transition: "all 0.15s"
        }}
        onMouseEnter={e => e.currentTarget.style.background = "rgba(200,145,42,0.2)"}
        onMouseLeave={e => e.currentTarget.style.background = "rgba(200,145,42,0.1)"}
      >
        <LogOut size={13} />
        <span>Log Out</span>
      </button>
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
              <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: gold, display: "flex", alignItems: "center" }}>
                <Menu size={22} />
              </button>
            )}
            <img src={company.logo || "/Bakewealthlogo.jpeg"} alt="logo" style={{ width: 28, height: 28, borderRadius: 6, objectFit: "cover", border: "1px solid rgba(200,145,42,0.3)", background: "#fff" }} />
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, color: gold, fontWeight: 700 }}>{company.name || "BakeWealth"}</div>
            {!isMobile && <div style={{ fontSize: 12, color: "#8B6B4A", marginLeft: 10, background: "rgba(200,145,42,0.1)", padding: "2px 8px", borderRadius: 4 }}>{nav.find(n => n.id === view)?.label}</div>}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
            <button
              onClick={handleLogout}
              title="Log Out"
              style={{
                background: "rgba(200,145,42,0.08)",
                border: "1px solid rgba(200,145,42,0.25)",
                borderRadius: 6,
                padding: "6px 12px",
                color: gold,
                fontSize: 12,
                fontWeight: 500,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                transition: "all 0.15s"
              }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(200,145,42,0.18)"}
              onMouseLeave={e => e.currentTarget.style.background = "rgba(200,145,42,0.08)"}
            >
              <LogOut size={13} />
              {!isMobile && <span>Log Out</span>}
            </button>
          </div>
        </div>

        <div className="main-content" style={{ padding: isMobile ? "14px" : "24px 26px", flex: 1, overflowY: "auto", color: "var(--text)" }}>
          {loading ? <Spinner /> :
            <Suspense fallback={<Spinner />}>
              {view === "dashboard" && <Dashboard productions={productions} inventory={inventory} expenses={expenses} setView={setViewWithSync} user={currentUser} tenantInfo={tenantInfo} />}
              {view === "masterlist" && <MasterList inventory={inventory} setInventory={setInventory} recipes={recipes} setRecipes={setRecipes} user={currentUser} setView={setViewWithSync} company={company} />}
              {(view === "openingstock" || view === "stock") && <Settings company={company} setCompany={setCompany} settings={settings} setSettings={setSettings} users={users} setUsers={setUsers} inventory={inventory} setInventory={setInventory} user={currentUser} setView={setViewWithSync} initialTab="stock" />}
              {view === "calculator" && <OrderCalculator inventory={inventory} recipes={recipes} settings={settings} setView={setViewWithSync} company={company} />}
              {view === "clients" && <Clients setView={setViewWithSync} company={company} />}
              {view === "production" && <ProductionEntry inventory={inventory} setInventory={setInventory} recipes={recipes} productions={productions} setProductions={setProductions} settings={settings} setView={setViewWithSync} user={currentUser} />}
              {view === "receipts" && <ReceiptScanner inventory={inventory} setInventory={setInventory} expenses={expenses} setExpenses={setExpenses} setView={setViewWithSync} />}
              {view === "purchases" && <Purchases inventory={inventory} setInventory={setInventory} expenses={expenses} setExpenses={setExpenses} setView={setViewWithSync} isOwner={!currentUser || currentUser?.role === "owner"} company={company} />}
              {view === "expenses" && <Expenses expenses={expenses} setExpenses={setExpenses} isOwner={!currentUser || currentUser?.role === "owner"} company={company} />}
              {view === "quotes" && <QuotesPage inventory={inventory} setInventory={setInventory} recipes={recipes} setView={setViewWithSync} productions={productions} setProductions={setProductions} />}
              {view === "records" && <Records productions={productions} setProductions={setProductions} setView={setViewWithSync} setPrefillProd={setPrefillProd} user={currentUser} company={company} />}
              {view === "prodlist" && <ProductionList productions={productions} setProductions={setProductions} company={company} setView={setViewWithSync} />}
              {view === "bank" && <BankImport transactions={transactions} setTransactions={setTransactions} productions={productions} setProductions={setProductions} expenses={expenses} setExpenses={setExpenses} />}
              {view === "monthly" && <MonthlyOverview inventory={inventory} recipes={recipes} productions={productions} setProductions={setProductions} expenses={expenses} setExpenses={setExpenses} company={company} isOwner={!currentUser || currentUser?.role === "owner"} />}
              {view === "pandl" && <PandL productions={productions} expenses={expenses} company={company} />}
              {view === "payables" && <Payables inventory={inventory} setInventory={setInventory} />}
              {view === "balance" && <BalanceSheet productions={productions} expenses={expenses} inventory={inventory} transactions={transactions} company={company} />}
              {view === "shopping" && <ShoppingList inventory={inventory} setInventory={setInventory} company={company} />}
              {view === "invoices" && <Invoices productions={productions} company={company} prefillProd={prefillProd} setPrefillProd={setPrefillProd} isOwner={!currentUser || currentUser?.role === "owner"} />}
              {view === "settings" && <Settings company={company} setCompany={setCompany} settings={settings} setSettings={setSettings} users={users} setUsers={setUsers} inventory={inventory} setInventory={setInventory} user={currentUser} setView={setViewWithSync} initialTab={settingsTab} />}
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

    <TokenPurchaseModal
      isOpen={tokenModalOpen}
      onClose={() => setTokenModalOpen(false)}
      currentBalance={tenantInfo?.tokenBalance || 0}
      isInsufficient={tokenModalData.isInsufficient}
      requiredTokens={tokenModalData.requiredTokens || 2}
      requiredCredits={tokenModalData.requiredCredits || 2}
      company={company}
      onOpenSettings={() => {
        setSettingsTab("tokens")
        setViewWithSync("settings")
      }}
    />

    <PlanLimitModal
      isOpen={planLimitModalOpen}
      onClose={() => setPlanLimitModalOpen(false)}
      limitData={planLimitData}
      onUpgradePlan={() => {
        setSettingsTab("tokens")
        setViewWithSync("settings")
      }}
      onOpenSettings={() => {
        setSettingsTab("tokens")
        setViewWithSync("settings")
      }}
    />
  </>
}
