/**
 * BalanceSheet.jsx
 * ----------------------------------------------------------------------------
 * Balance Sheet.
 * Assets, liabilities and equity from opening balances + live data.
 * ----------------------------------------------------------------------------
 */
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { Btn, iSt, Card, SHead } from "../common/ui.jsx"
import { fmt, today } from "../../lib/helpers.js"
import { mergeRevenueSources, loadOpeningBalance, PLRow } from "../../lib/costing.jsx"
import { saveLocal } from "../../lib/data.js"

export function BalanceSheet({productions,expenses,inventory,transactions,company}){
  const ob=loadOpeningBalance()
  const [editing,setEditing]=useState(!ob)
  const [ob2,setOb2]=useState(ob||{cash:"",equipment:"",capital:"",loanBalance:"",asOf:today()})

  const saveOB=async ()=>{
    const data={cash:+ob2.cash||0,equipment:+ob2.equipment||0,capital:+ob2.capital||0,loanBalance:+ob2.loanBalance||0,asOf:ob2.asOf}
    await saveLocal("ll_opening_balance",data)
    setEditing(false)
  }

  const inventoryValue=inventory.reduce((s,i)=>s+((i.stock||0)*(i.cost||0)),0)

  let payables=0
  try{const bills=JSON.parse(localStorage.getItem("ll_payables")||"[]");payables=bills.reduce((s,b)=>s+(b.amount-(b.paid||0)),0)}catch(e){}

  const allRevenue=mergeRevenueSources(productions)
  const receivables=allRevenue.filter(p=>{const s=(p.status||"").toLowerCase();return s!=="paid"&&s!=="delivered"&&s!=="completed"}).reduce((s,p)=>s+(p.salePrice||0),0)

  const totalRev=allRevenue.reduce((s,p)=>s+(p.salePrice||0),0)
  const totalCogs=allRevenue.reduce((s,p)=>s+(p.cost||0),0)
  const EXCL=["Ingredient costs","Ingredients / Supplies","Pass-through Payment","Loan Repayment","Client Reimbursable (paid out)","Already logged via receipt"]
  const totalOverhead=expenses.filter(e=>!EXCL.includes(e.category)&&e.source!=="purchase").reduce((s,e)=>s+(e.amount||0),0)
  const retainedEarnings=totalRev-totalCogs-totalOverhead

  const obCash=ob?.cash||0
  const obEquip=ob?.equipment||0
  const obCapital=ob?.capital||0
  const obLoan=ob?.loanBalance||0

  const cashIn=transactions.filter(t=>t.type==="credit").reduce((s,t)=>s+(t.amount||0),0)
  const cashOut=transactions.filter(t=>t.type==="debit").reduce((s,t)=>s+(t.amount||0),0)
  const cash=obCash+cashIn-cashOut

  const totalAssets=cash+inventoryValue+receivables+obEquip
  const totalLiabilities=payables+obLoan
  const totalEquity=obCapital+retainedEarnings
  const balanced=Math.abs(totalAssets-(totalLiabilities+totalEquity))<1

  const iSt={width:"100%",padding:"9px 11px",border:"1px solid var(--border)",borderRadius:7,fontSize:13,fontFamily:"inherit",background:"var(--panel)",color:"var(--text)",marginTop:4,outline:"none"}

  if(editing)return <div>
    <SHead title="Balance Sheet" sub="First, set your opening balances"/>
    <Card style={{maxWidth:520}}>
      <div style={{background:"#FEF9EE",border:"1px solid var(--gold)",borderRadius:8,padding:"11px 14px",fontSize:12.5,color:"#7A5500",lineHeight:1.7,marginBottom:16}}>
        💡 Enter your starting position once. These are the things the app can't work out on its own: how much cash you have, what your equipment is worth, money you put in, and any outstanding loan.
      </div>
      <div style={{marginBottom:12}}><label style={{fontSize:10,color:"var(--muted)",textTransform:"uppercase",letterSpacing:.7,fontWeight:600}}>As at date</label><input type="date" value={ob2.asOf} onChange={e=>setOb2(p=>({...p,asOf:e.target.value}))} style={iSt}/></div>
      <div style={{marginBottom:12}}><label style={{fontSize:10,color:"var(--muted)",textTransform:"uppercase",letterSpacing:.7,fontWeight:600}}>Cash & bank balance (₦)</label><input type="number" value={ob2.cash} onChange={e=>setOb2(p=>({...p,cash:e.target.value}))} placeholder="420000" style={iSt}/></div>
      <div style={{marginBottom:12}}><label style={{fontSize:10,color:"var(--muted)",textTransform:"uppercase",letterSpacing:.7,fontWeight:600}}>Equipment value — ovens, mixers (₦)</label><input type="number" value={ob2.equipment} onChange={e=>setOb2(p=>({...p,equipment:e.target.value}))} placeholder="650000" style={iSt}/></div>
      <div style={{marginBottom:12}}><label style={{fontSize:10,color:"var(--muted)",textTransform:"uppercase",letterSpacing:.7,fontWeight:600}}>Money you invested — owner's capital (₦)</label><input type="number" value={ob2.capital} onChange={e=>setOb2(p=>({...p,capital:e.target.value}))} placeholder="600000" style={iSt}/></div>
      <div style={{marginBottom:16}}><label style={{fontSize:10,color:"var(--muted)",textTransform:"uppercase",letterSpacing:.7,fontWeight:600}}>Outstanding loan balance (₦)</label><input type="number" value={ob2.loanBalance} onChange={e=>setOb2(p=>({...p,loanBalance:e.target.value}))} placeholder="300000" style={iSt}/></div>
      <Btn variant="success" onClick={saveOB}>✓ Save Opening Balances</Btn>
    </Card>
  </div>

  return <div>
    <SHead title="Balance Sheet" sub={"As at "+new Date().toLocaleDateString("en-NG",{day:"numeric",month:"long",year:"numeric"})}/>
    <div style={{display:"flex",justifyContent:"flex-end",marginBottom:12}}>
      <Btn small variant="ghost" onClick={()=>{setOb2(ob||{cash:"",equipment:"",capital:"",loanBalance:"",asOf:today()});setEditing(true)}}>Edit opening balances</Btn>
    </div>

    <Card style={{maxWidth:560}}>
      <div style={{fontSize:11,textTransform:"uppercase",letterSpacing:1,color:"var(--gold)",fontWeight:700,marginBottom:6,paddingBottom:4,borderBottom:"1px solid var(--border)"}}>Assets — what you own</div>
      <PLRow label="Cash & bank balance" value={fmt(cash)} indent/>
      <PLRow label="Inventory (ingredients in store)" value={fmt(inventoryValue)} indent/>
      <PLRow label="Accounts receivable (owed by clients)" value={fmt(receivables)} indent/>
      <PLRow label="Equipment" value={fmt(obEquip)} indent/>
      <PLRow label="Total Assets" value={fmt(totalAssets)} bold/>

      <div style={{fontSize:11,textTransform:"uppercase",letterSpacing:1,color:"var(--gold)",fontWeight:700,margin:"16px 0 6px",paddingBottom:4,borderBottom:"1px solid var(--border)"}}>Liabilities — what you owe</div>
      <PLRow label="Accounts payable (owed to suppliers)" value={fmt(payables)} indent/>
      <PLRow label="Business loan outstanding" value={fmt(obLoan)} indent/>
      <PLRow label="Total Liabilities" value={fmt(totalLiabilities)} bold/>

      <div style={{fontSize:11,textTransform:"uppercase",letterSpacing:1,color:"var(--gold)",fontWeight:700,margin:"16px 0 6px",paddingBottom:4,borderBottom:"1px solid var(--border)"}}>Equity — your stake</div>
      <PLRow label="Owner's capital" value={fmt(obCapital)} indent/>
      <PLRow label="Retained earnings (accumulated profit)" value={fmt(retainedEarnings)} indent/>
      <PLRow label="Total Equity" value={fmt(totalEquity)} bold/>

      <div style={{display:"flex",justifyContent:"space-between",fontWeight:700,fontSize:15,padding:"12px 14px",background:"#FEF9EE",borderRadius:8,marginTop:14}}>
        <span>Liabilities + Equity</span><span>{fmt(totalLiabilities+totalEquity)}</span>
      </div>
      <div style={{textAlign:"center",marginTop:10,padding:9,background:balanced?"#E4F4EC":"#FAE8E6",borderRadius:8,color:balanced?"#1D7A4A":"#B03A2E",fontSize:13,fontWeight:600}}>
        {balanced?"✓ Balanced":"⚠ Out of balance by "+fmt(Math.abs(totalAssets-(totalLiabilities+totalEquity)))}
      </div>
    </Card>
  </div>
}

// ═══════════════════════════════════════════════════════════
//  CASH FLOW STATEMENT
