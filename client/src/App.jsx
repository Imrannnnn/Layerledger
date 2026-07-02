/**
 * App.jsx — LayerLedger root component
 * ============================================================================
 * Bakery management + accounting app for Fayvouree Luxe Cakes Studio.
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
 *   lib/data.js               localStorage read/write ("the database")
 *   components/common/ui.jsx  shared UI building blocks
 *   components/<domain>/...   one screen (or group) per file
 *
 * DATA STORAGE: no server database yet — all data is in the browser's
 * localStorage via lib/data.js. A backend + real database (Cloudflare D1 or
 * Supabase) with login and cross-device sync is the planned "Stage 2".
 * ============================================================================
 */
import React, { useState, useRef, useEffect, useCallback } from "react"

// ─── Data access layer (localStorage today; a backend API in Stage 2) ───────
import { loadInventory, saveInventory, loadProductions, saveProduction, updateProdStatus,
  loadTransactions, saveTxns, loadExpenses, saveExpenses, loadSetting, saveSetting,
  loadCompany, saveCompany, loadInvoices, saveInvoice, loadUsers, saveUsers,
  loadRecipes, saveRecipes } from "./lib/data.js"

// ─── Seed data & helpers ────────────────────────────────────────────────────
import { DEFAULT_INV, DEFAULT_RECIPES } from "./constants.js"

// ─── Screen components (one import per screen) ──────────────────────────────
import { Login } from "./components/auth/Login.jsx"
import { Dashboard } from "./components/dashboard/Dashboard.jsx"
import { MasterList } from "./components/inventory/MasterList.jsx"
import { ProductionEntry } from "./components/orders/ProductionEntry.jsx"
import { Records } from "./components/orders/Records.jsx"
import { OrderCalculator } from "./components/orders/OrderCalculator.jsx"
import { QuotesPage } from "./components/orders/QuotesPage.jsx"
import { ProductionList } from "./components/orders/ProductionList.jsx"
import { Invoices } from "./components/orders/Invoices.jsx"
import { ReceiptScanner } from "./components/money/ReceiptScanner.jsx"
import { Expenses } from "./components/money/Expenses.jsx"
import { BankImport } from "./components/money/BankImport.jsx"
import { Purchases } from "./components/money/Purchases.jsx"
import { Payables } from "./components/money/Payables.jsx"
import { Reports } from "./components/reports/Reports.jsx"
import { PandL } from "./components/reports/PandL.jsx"
import { BalanceSheet } from "./components/reports/BalanceSheet.jsx"
import { CashFlow } from "./components/reports/CashFlow.jsx"
import { MonthlyOverview } from "./components/reports/MonthlyOverview.jsx"
import { ShoppingList } from "./components/reports/ShoppingList.jsx"
import { StockStatement } from "./components/reports/StockStatement.jsx"
import { Settings } from "./components/settings/Settings.jsx"
import { Onboarding } from "./components/settings/Onboarding.jsx"

// ═══════════════════════════════════════════════════════════
export class ErrorBoundary extends React.Component{
  constructor(props){super(props);this.state={error:null,stack:null}}
  static getDerivedStateFromError(error){return{error:error?.toString(),stack:error?.stack||""}}
  render(){
    if(this.state.error)return React.createElement("div",{style:{padding:40,fontFamily:"monospace",background:"#fff",color:"#333"}},
      React.createElement("h2",{style:{color:"red"}},"App crashed — share this error with Claude:"),
      React.createElement("pre",{style:{background:"#f5f5f5",padding:16,borderRadius:8,overflow:"auto",fontSize:12,whiteSpace:"pre-wrap"}},this.state.error+" "+this.state.stack)
    )
    return this.props.children
  }
}


export default function App(){
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem("ll_current_user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  })
  const [view,setView]=useState("dashboard")
  const [viewHistory,setViewHistory]=useState(["dashboard"])
  const goTo=(v)=>{setViewHistory(h=>[...h.slice(-9),v]);setView(v)}
  const goBack=()=>{setViewHistory(h=>{if(h.length<=1)return h;const prev=h[h.length-2];setView(prev);return h.slice(0,-1)});}
  const [onboarded,setOnboarded]=useState(()=>!!localStorage.getItem("ll_onboarded"))
  const [inventory,setInventory]=useState(DEFAULT_INV)
  const [recipes,setRecipes]=useState(()=>{const saved=loadRecipes();return saved&&saved.length>0?saved:DEFAULT_RECIPES})
  const [productions,setProductions]=useState([])
  const [transactions,setTransactions]=useState([])
  const [expenses,setExpenses]=useState([])
  const [company,setCompany]=useState(loadCompany())
  const [settings,setSettings]=useState({accessoryPct:loadSetting("accessoryPct",10),profitPct:loadSetting("profitPct",40)})
  const [users,setUsers]=useState(loadUsers())
  const [prefillProd,setPrefillProd]=useState(null)
  const [loading,setLoading]=useState(true)
  const [sidebarOpen,setSidebarOpen]=useState(false)
  const [isMobile,setIsMobile]=useState(window.innerWidth<768)

  useEffect(()=>{
    const handler=()=>setIsMobile(window.innerWidth<768)
    window.addEventListener("resize",handler);return()=>window.removeEventListener("resize",handler)
  },[])

  useEffect(()=>{
    async function init(){
      setLoading(true)
      const [inv,prods,txns]=await Promise.all([loadInventory(DEFAULT_INV),loadProductions([]),loadTransactions([])])
      setInventory(inv);setProductions(prods);setTransactions(txns)
      setExpenses(loadExpenses());setUsers(loadUsers());setCompany(loadCompany())
      const saved=loadRecipes();if(saved)setRecipes(saved)
      setSettings({accessoryPct:loadSetting("accessoryPct",10),profitPct:loadSetting("profitPct",40)})
      setLoading(false)
    }
    init()
  },[])

  const gold=company.primaryColor||"var(--gold)"
  const sidebar=company.sidebarColor||"var(--sidebar)"

  // Apply brand colour globally — must be before any conditional returns
  useEffect(()=>{
    document.documentElement.style.setProperty("--gold",gold)
    document.documentElement.style.setProperty("--sidebar",sidebar)
  },[gold,sidebar])

  const role=currentUser?.role||"owner"
  const nav=[
    {id:"dashboard",label:"Dashboard",icon:"◈",roles:["owner","production","customer_service"]},
    {id:"_ops",label:"Operations",icon:"",roles:["owner","production","customer_service"],divider:true},
    {id:"masterlist",label:"Master List",icon:"⚙",roles:["owner","production"]},
    {id:"calculator",label:"Order Calculator",icon:"🧮",roles:["owner","production"]},

    {id:"receipts",label:"Receipt Scanner",icon:"🧾",roles:["owner","production"]},
    {id:"shopping",label:"Shopping List",icon:"🛒",roles:["owner","production"]},
    {id:"quotes",label:"Quotes",icon:"💬",roles:["owner","customer_service"]},
    {id:"records",label:"Records",icon:"≡",roles:["owner","customer_service"]},
    {id:"prodlist",label:"Production List",icon:"📅",roles:["owner","production"]},
    {id:"invoices",label:"Invoices",icon:"📄",roles:["owner","customer_service"]},
    {id:"_accounts",label:"Accounts",icon:"",roles:["owner"],divider:true},
    {id:"purchases",label:"Purchases",icon:"🛍",roles:["owner"]},
    {id:"payables",label:"Credit Purchases",icon:"📋",roles:["owner"]},
    {id:"expenses",label:"Expenses",icon:"💸",roles:["owner"]},
    {id:"bank",label:"Bank Import",icon:"⊞",roles:["owner"]},
    {id:"_reports",label:"Reports",icon:"",roles:["owner"],divider:true},
    {id:"monthly",label:"Monthly Overview",icon:"📊",roles:["owner"]},
    {id:"pandl",label:"P&L Statement",icon:"📑",roles:["owner"]},
    {id:"balance",label:"Balance Sheet",icon:"⚖",roles:["owner"]},
    {id:"cashflow",label:"Cash Flow",icon:"💧",roles:["owner"]},
    {id:"_system",label:"System",icon:"",roles:["owner","production","customer_service"],divider:true},
    {id:"settings",label:"Settings",icon:"⚙",roles:["owner"]},
  ].filter(n=>n.roles.includes(role))

  const goTo2=(id)=>{goTo(id);setSidebarOpen(false)}

  if(!currentUser){
    return <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=DM+Sans:opsz,wght@9..40,400;9..40,500&display=swap');*{box-sizing:border-box}body{margin:0}:root{--gold:${gold};--sidebar:${sidebar};--bg:#F4EEE4;--panel:#FDFAF4;--text:#291608;--muted:#8C6E52;--border:#E0D3BB;--accent:${gold}}
.main-content{color:var(--text)}
.main-content h1,.main-content h2,.main-content h3{color:var(--text)}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <Login onLogin={(u)=>{
        setCurrentUser(u);
        localStorage.setItem("ll_current_user", JSON.stringify(u));
        saveSetting("lastUser",u.id);
        if(!localStorage.getItem("ll_onboarded"))setOnboarded(false);
      }}/>
    </>
  }

  // Show onboarding for first-time users
  if(currentUser&&!onboarded){
    return <Onboarding
      gold={gold}
      onComplete={()=>{localStorage.setItem("ll_onboarded","1");setOnboarded(true)}}
      onSkip={()=>{localStorage.setItem("ll_onboarded","1");setOnboarded(true)}}
      setView={v=>{localStorage.setItem("ll_onboarded","1");setOnboarded(true);setView(v)}}
    />
  }

  const sidebarContent = <>
    <div style={{padding:"18px 16px 14px",borderBottom:"1px solid rgba(200,145,42,0.2)",display:"flex",alignItems:"center",gap:10}}>
      {company.logo&&<img src={company.logo} alt="logo" style={{width:30,height:30,borderRadius:6,objectFit:"cover",flexShrink:0}}/>}
      <div><div style={{fontFamily:"'Playfair Display',serif",fontSize:16,color:gold,fontWeight:700,lineHeight:1.2}}>{company.name||"LayerLedger"}</div><div style={{fontSize:9,color:"#7B5A3A",textTransform:"uppercase",letterSpacing:2,marginTop:1}}>Bakery Books</div></div>
    </div>
    <div style={{flex:1,paddingTop:8,overflowY:"auto"}}>
      {nav.map(n=>n.divider
        ?<div key={n.id} style={{padding:"10px 16px 4px",fontSize:9.5,color:"#5A3D20",textTransform:"uppercase",letterSpacing:1.5,fontWeight:600,marginTop:4}}>{n.label}</div>
        :<div key={n.id} onClick={()=>goTo2(n.id)} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 16px",cursor:"pointer",fontSize:13,fontWeight:view===n.id?500:400,color:view===n.id?gold:"#8B6B4A",background:view===n.id?"rgba(200,145,42,0.1)":"transparent",borderLeft:`2px solid ${view===n.id?gold:"transparent"}`,transition:"all 0.15s"}}><span style={{fontSize:14}}>{n.icon}</span>{n.label}</div>
      )}
    </div>
    <div style={{padding:"10px 16px",borderTop:"1px solid rgba(200,145,42,0.1)"}}>
      {viewHistory.length>1&&<div onClick={goBack} style={{cursor:"pointer",color:gold,marginBottom:6,display:"flex",alignItems:"center",gap:4,fontSize:12,fontWeight:500}}>← Back</div>}
      <div style={{fontSize:11.5,color:"#6B4A2A",fontWeight:500}}>{currentUser?.name}</div>
      <div style={{fontSize:10.5,color:"#3D2010",marginTop:1,display:"flex",justifyContent:"space-between"}}>
        <span style={{cursor:"pointer",color:gold}} onClick={()=>{
          setCurrentUser(null);
          localStorage.removeItem("ll_current_user");
        }}>Logout</span>
      </div>
    </div>
  </>

  return <>
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=DM+Sans:opsz,wght@9..40,400;9..40,500&display=swap');
      *{box-sizing:border-box}body{margin:0;padding:0}
      :root{--gold:${gold};--sidebar:${sidebar};--bg:#F4EEE4;--panel:#FDFAF4;--text:#291608;--muted:#8C6E52;--border:#E0D3BB;--accent:${gold}}
      @keyframes spin{to{transform:rotate(360deg)}}
    `}</style>
    <div style={{display:"flex",height:"100vh",fontFamily:"'DM Sans',sans-serif",background:"var(--bg)",overflow:"hidden"}}>

      {/* Desktop sidebar */}
      {!isMobile&&<div style={{width:200,background:"var(--sidebar)",display:"flex",flexDirection:"column",flexShrink:0,height:"100vh"}}>{sidebarContent}</div>}

      {/* Mobile sidebar overlay */}
      {isMobile&&sidebarOpen&&<div style={{position:"fixed",inset:0,zIndex:200,display:"flex"}}>
        <div style={{width:220,background:"var(--sidebar)",display:"flex",flexDirection:"column",height:"100%"}}>{sidebarContent}</div>
        <div style={{flex:1,background:"rgba(0,0,0,0.5)"}} onClick={()=>setSidebarOpen(false)}/>
      </div>}

      {/* Main */}
      <div style={{flex:1,overflow:"auto",display:"flex",flexDirection:"column",minWidth:0}}>
        {/* Mobile header */}
        {isMobile&&<div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",background:"var(--sidebar)",position:"sticky",top:0,zIndex:50,flexShrink:0}}>
          <button onClick={()=>setSidebarOpen(!sidebarOpen)} style={{background:"none",border:"none",cursor:"pointer",padding:4,color:gold,fontSize:22,lineHeight:1}}>☰</button>
          {company.logo&&<img src={company.logo} alt="logo" style={{width:26,height:26,borderRadius:5,objectFit:"cover"}}/>}
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:15,color:gold,fontWeight:700,flex:1}}>{company.name||"LayerLedger"}</div>
          <div style={{fontSize:11,color:"#6B4A2A"}}>{nav.find(n=>n.id===view)?.label}</div>
        </div>}

        <div className="main-content" style={{padding:isMobile?"14px":"24px 26px",flex:1,overflowY:"auto",color:"var(--text)"}}>
          {loading?<Spinner/>:<>
            {view==="dashboard"  &&<Dashboard productions={productions} inventory={inventory} expenses={expenses} setView={setView} user={currentUser}/>}
            {view==="masterlist" &&<MasterList inventory={inventory} setInventory={setInventory} recipes={recipes} setRecipes={setRecipes} user={currentUser} setView={setView}/>}
            {view==="calculator"  &&<OrderCalculator inventory={inventory} recipes={recipes} settings={settings} setView={setView} company={company}/>}
            {view==="production" &&<ProductionEntry inventory={inventory} setInventory={setInventory} recipes={recipes} productions={productions} setProductions={setProductions} settings={settings} setView={setView} user={currentUser}/>}
            {view==="receipts"   &&<ReceiptScanner inventory={inventory} setInventory={setInventory} expenses={expenses} setExpenses={setExpenses}/>}
            {view==="purchases"  &&<Purchases inventory={inventory} setInventory={setInventory} expenses={expenses} setExpenses={setExpenses}/>}
            {view==="expenses"   &&<Expenses expenses={expenses} setExpenses={setExpenses}/>}
            {view==="quotes"     &&<QuotesPage inventory={inventory} setInventory={setInventory} recipes={recipes} setView={setView} productions={productions} setProductions={setProductions}/>}
            {view==="records"    &&<Records productions={productions} setProductions={setProductions} setView={setView} setPrefillProd={setPrefillProd} user={currentUser}/>}
            {view==="prodlist"   &&<ProductionList productions={productions} company={company} setView={setView}/>}
            {view==="bank"       &&<BankImport transactions={transactions} setTransactions={setTransactions} productions={productions} expenses={expenses} setExpenses={setExpenses}/>}
            {view==="monthly"    &&<MonthlyOverview inventory={inventory} productions={productions} expenses={expenses} company={company}/>}
            {view==="pandl"      &&<PandL productions={productions} expenses={expenses} company={company}/>}
            {view==="payables"   &&<Payables inventory={inventory} setInventory={setInventory}/>}
            {view==="balance"    &&<BalanceSheet productions={productions} expenses={expenses} inventory={inventory} transactions={transactions} company={company}/>}
            {view==="cashflow"   &&<CashFlow productions={productions} expenses={expenses} transactions={transactions} company={company}/>}
            {view==="shopping"   &&<ShoppingList inventory={inventory} company={company}/>}
            {view==="invoices"   &&<Invoices productions={productions} company={company} prefillProd={prefillProd} setPrefillProd={setPrefillProd}/>}
            {view==="settings"   &&<Settings company={company} setCompany={setCompany} settings={settings} setSettings={setSettings} users={users} setUsers={setUsers} inventory={inventory}/>}
          </>}
        </div>
      </div>
    </div>
  </>
}
