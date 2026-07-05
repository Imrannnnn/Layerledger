/**
 * CashFlow.jsx
 * ----------------------------------------------------------------------------
 * Cash Flow statement.
 * Operating / investing / financing cash movements by month.
 * ----------------------------------------------------------------------------
 */
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { Card, SHead } from "../common/ui.jsx"
import { fmt } from "../../lib/helpers.js"
import { loadLocal } from "../../lib/data.js"

// ═══════════════════════════════════════════════════════════
export function CashFlow({productions,expenses,transactions,company}){
  const last12=Array.from({length:12},(_,i)=>{const d=new Date();d.setDate(1);d.setMonth(d.getMonth()-i);return d.toISOString().slice(0,7)})
  const allMonths=[...new Set([...last12,...transactions.map(t=>t.date?.slice(0,7)).filter(Boolean)])].sort().reverse()
  const [sel,setSel]=useState(new Date().toISOString().slice(0,7))

  const mt=transactions.filter(t=>t.date?.startsWith(sel))

  const clientIn=mt.filter(t=>t.type==="credit"&&/sales|payment from client|deposit/i.test(t.category||"")).reduce((s,t)=>s+t.amount,0)
  const supplierOut=mt.filter(t=>t.type==="debit"&&/ingredient|supplies|already logged/i.test(t.category||"")).reduce((s,t)=>s+t.amount,0)
  let apPayments=0
  try{const pays=loadLocal("ll_ap_payments",[]);apPayments=pays.filter(p=>p.date?.startsWith(sel)).reduce((s,p)=>s+p.amount,0)}catch(e){}
  const overheadOut=mt.filter(t=>t.type==="debit"&&/rent|salary|utilit|fuel|delivery|marketing|maintenance|other expense/i.test(t.category||"")).reduce((s,t)=>s+t.amount,0)
  const netOperating=clientIn-supplierOut-apPayments-overheadOut

  const equipmentOut=mt.filter(t=>t.type==="debit"&&/equipment/i.test(t.category||"")).reduce((s,t)=>s+t.amount,0)
  const netInvesting=-equipmentOut

  const loanIn=mt.filter(t=>t.type==="credit"&&/loan received/i.test(t.category||"")).reduce((s,t)=>s+t.amount,0)
  const loanOut=mt.filter(t=>t.type==="debit"&&/loan repay/i.test(t.category||"")).reduce((s,t)=>s+t.amount,0)
  const netFinancing=loanIn-loanOut

  const netChange=netOperating+netInvesting+netFinancing

  const Row=({label,value,indent,bold,pos})=>(<div style={{display:"flex",justifyContent:"space-between",padding:bold?"10px 0":"7px 0",borderBottom:bold?"2px solid var(--border)":"1px solid var(--border)",fontWeight:bold?700:400,fontSize:bold?14:13.5}}>
    <span style={{paddingLeft:indent?16:0,color:indent?"var(--muted)":"var(--text)"}}>{label}</span>
    <span style={{color:value<0?"#B03A2E":pos?"#2D7A50":"var(--text)",fontWeight:bold||pos||value<0?600:400}}>{value<0?"−"+fmt(Math.abs(value)):pos?"+"+fmt(value):fmt(value)}</span>
  </div>)

  return <div>
    <SHead title="Cash Flow Statement" sub="Real cash movement — not profit"/>
    <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:18}}>
      <select value={sel} onChange={e=>setSel(e.target.value)} style={{padding:"7px 12px",borderRadius:8,border:"1px solid var(--border)",background:"var(--panel)",fontSize:13,color:"var(--text)",fontFamily:"inherit"}}>
        {allMonths.map(m=><option key={m} value={m}>{new Date(m+"-02").toLocaleDateString("en-NG",{month:"long",year:"numeric"})}</option>)}
      </select>
    </div>

    <div style={{background:"#FEF9EE",border:"1px solid var(--gold)",borderRadius:8,padding:"11px 14px",fontSize:12.5,color:"#7A5500",lineHeight:1.7,marginBottom:14}}>
      💡 This shows actual cash in and out, grouped into Operating (trade), Investing (assets) and Financing (loans). A business can be profitable but still short of cash — this reveals the real picture.
    </div>

    <Card style={{maxWidth:560}}>
      <div style={{fontSize:11,textTransform:"uppercase",letterSpacing:1,color:"var(--gold)",fontWeight:700,marginBottom:6,paddingBottom:4,borderBottom:"1px solid var(--border)"}}>Operating activities</div>
      <Row label="Cash from clients" value={clientIn} pos indent/>
      <Row label="Paid to suppliers (ingredients)" value={-supplierOut-apPayments} indent/>
      <Row label="Rent, salary, utilities" value={-overheadOut} indent/>
      <Row label="Net cash from operations" value={netOperating} bold/>

      <div style={{fontSize:11,textTransform:"uppercase",letterSpacing:1,color:"var(--gold)",fontWeight:700,margin:"16px 0 6px",paddingBottom:4,borderBottom:"1px solid var(--border)"}}>Investing activities</div>
      <Row label="Equipment purchases" value={-equipmentOut} indent/>
      <Row label="Net cash from investing" value={netInvesting} bold/>

      <div style={{fontSize:11,textTransform:"uppercase",letterSpacing:1,color:"var(--gold)",fontWeight:700,margin:"16px 0 6px",paddingBottom:4,borderBottom:"1px solid var(--border)"}}>Financing activities</div>
      <Row label="Loan received" value={loanIn} pos indent/>
      <Row label="Loan repayment" value={-loanOut} indent/>
      <Row label="Net cash from financing" value={netFinancing} bold/>

      <div style={{display:"flex",justifyContent:"space-between",fontWeight:700,fontSize:15,padding:"12px 14px",background:netChange>=0?"#E8F5EE":"#FDEBE9",borderRadius:8,marginTop:14,color:netChange>=0?"#1D6B40":"#B03A2E"}}>
        <span>Net change in cash</span><span>{netChange<0?"−"+fmt(Math.abs(netChange)):"+"+fmt(netChange)}</span>
      </div>
    </Card>
  </div>
}

// ═══════════════════════════════════════════════════════════
//  ROOT APP
