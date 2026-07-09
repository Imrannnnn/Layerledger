/**
 * Reports.jsx
 * ----------------------------------------------------------------------------
 * Reports landing / summary.
 * ----------------------------------------------------------------------------
 */
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { Btn, Card, SHead } from "../common/ui.jsx"
import { fmt } from "../../lib/helpers.js"

// ═══════════════════════════════════════════════════════════
export function Reports({productions,transactions,expenses,company,inventory}){
  const allMonths=[...new Set([...productions.map(p=>p.deliveryDate?.slice(0,7)),...transactions.map(t=>t.date?.slice(0,7))].filter(Boolean))].sort().reverse()
  const cur=new Date().toISOString().slice(0,7)
  const [sel,setSel]=useState(allMonths[0]||cur)
  const mp=productions.filter(p=>p.deliveryDate?.startsWith(sel))
  const mt=transactions.filter(t=>t.date?.startsWith(sel))
  const me=expenses.filter(e=>e.date?.startsWith(sel))
  const paid=mp.filter(p=>p.paymentType!=="gift"&&p.paymentType!=="sample")
  const rev=paid.reduce((s,p)=>s+(p.salePrice||0),0)
  const prodCost=mp.reduce((s,p)=>s+(p.cost||0),0)
  const delivCosts=mp.reduce((s,p)=>s+(p.deliveryCost||0),0)
  const bankDebits=mt.filter(t=>t.type==="debit").reduce((s,t)=>s+t.amount,0)
  const bankCredits=mt.filter(t=>t.type==="credit").reduce((s,t)=>s+t.amount,0)
  const manualExp=me.filter(e=>e.source==="manual").reduce((s,e)=>s+(e.amount||0),0)
  const totalCost=prodCost+delivCosts+manualExp
  const gross=rev-totalCost;const net=gross-bankDebits
  const margin=rev>0?Math.round((gross/rev)*100):0
  const monthLabel=sel?new Date(sel+"-02").toLocaleDateString("en-NG",{month:"long",year:"numeric"}):""
  const bySize={};mp.forEach(p=>{const k=`${p.size}·${p.covering}`;if(!bySize[k])bySize[k]={qty:0,rev:0,cost:0};bySize[k].qty++;bySize[k].rev+=(p.salePrice||0);bySize[k].cost+=(p.cost||0)+(p.deliveryCost||0)})

  const dl=()=>{
    const w=window.open("","_blank")
    w.document.write(`<!DOCTYPE html><html><head><title>P&L ${monthLabel}</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;color:#291608;padding:40px;max-width:750px;margin:0 auto}.gold{color:${company.primaryColor||"var(--gold)"}}.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:36px}h1{font-size:22px;font-weight:700}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:20px 0}.stat{border:1px solid #E0D3BB;border-radius:8px;padding:12px}.sl{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:4px}.sv{font-size:18px;font-weight:bold;color:${company.primaryColor||"var(--gold)"}}table{width:100%;border-collapse:collapse;margin:14px 0}th{background:#EDE5D6;padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.8px;color:#888}td{padding:8px 10px;border-bottom:1px solid #E0D3BB;font-size:13px}.total{font-weight:bold;background:#F5F0E4}.pbox{padding:14px 16px;border-radius:8px;display:flex;justify-content:space-between;align-items:center;margin-top:14px;background:${net>=0?"#E8F5EE":"#FDEBE9"}}.plabel{font-size:15px;font-weight:bold}.pval{font-size:17px;font-weight:bold;color:${net>=0?"#357A52":"#B03A2E"}}@media print{button{display:none}}</style></head><body>
      <div class="header"><div>${company.logo?`<img src="${company.logo}" style="height:55px;display:block;margin-bottom:8px" alt="logo"/>`:""}
      <h1 class="gold">${company.name||"Bakery"}</h1><div style="font-size:13px;color:#888;margin-top:2px">${company.tagline||""}</div></div>
      <div><div style="font-size:22px;font-weight:700;color:#DDD">PROFIT & LOSS</div><div style="font-size:13px;color:#888;margin-top:4px">${monthLabel}</div></div></div>
      <div class="grid">
        <div class="stat"><div class="sl">Revenue</div><div class="sv">₦${Math.round(rev).toLocaleString()}</div><div style="font-size:11px;color:#888">${paid.length} orders</div></div>
        <div class="stat"><div class="sl">Prod. Cost</div><div class="sv">₦${Math.round(totalCost).toLocaleString()}</div></div>
        <div class="stat"><div class="sl">Gross Profit</div><div class="sv">₦${Math.round(gross).toLocaleString()}</div><div style="font-size:11px;color:#888">${margin}% margin</div></div>
        <div class="stat"><div class="sl">Net Profit</div><div class="sv" style="color:${net>=0?"#357A52":"#B03A2E"}">₦${Math.round(net).toLocaleString()}</div></div>
      </div>
      <h3 style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#888;margin:20px 0 8px">Income from Sales</h3>
      <table><tr><th>Date</th><th>Client</th><th>Product</th><th>Type</th><th>Amount</th></tr>
        ${mp.map(p=>`<tr><td>${p.deliveryDate||""}</td><td>${p.client||""}</td><td>${p.size} ${p.covering}</td><td>${p.paymentType}</td><td>₦${Math.round(p.salePrice||0).toLocaleString()}</td></tr>`).join("")}
        <tr class="total"><td colspan="4">TOTAL REVENUE</td><td>₦${Math.round(rev).toLocaleString()}</td></tr></table>
      <h3 style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#888;margin:20px 0 8px">Costs & Expenses</h3>
      <table><tr><th>Date</th><th>Description</th><th>Category</th><th>Source</th><th>Amount</th></tr>
        ${me.map(e=>`<tr><td>${e.date||""}</td><td>${e.description||""}</td><td>${e.category||""}</td><td>${e.source||"manual"}</td><td>₦${Math.round(e.amount||0).toLocaleString()}</td></tr>`).join("")}
        ${mt.filter(t=>t.type==="debit").map(t=>`<tr><td>${t.date||""}</td><td>${t.description||""}</td><td>${t.category||""}</td><td>bank</td><td>₦${Math.round(t.amount||0).toLocaleString()}</td></tr>`).join("")}
        <tr class="total"><td colspan="4">TOTAL COSTS</td><td>₦${Math.round(totalCost+bankDebits).toLocaleString()}</td></tr></table>
      <div class="pbox"><div class="plabel">NET PROFIT — ${monthLabel}</div><div class="pval">₦${Math.round(net).toLocaleString()}</div></div>
      <p style="font-size:11px;color:#aaa;margin-top:30px">Generated by LayerLedger · ${new Date().toLocaleDateString()}</p>
      <script>window.print()</script></body></html>`)
    w.document.close()
  }

  // Monthly stock statement data
  const mInv = inventory => {
    return inventory.map(item => {
      const opening = item.openingStock || item.stock || 0
      const used = productions.filter(p=>p.deliveryDate?.startsWith(sel)).reduce((s,p)=>{
        if(!p.recipeId) return s
        return s // deductions tracked per production — simplified here
      },0)
      return {...item, opening, used, closing: item.stock||0 }
    })
  }

  const dlStock=()=>{
    const w=window.open("","_blank")
    const monthLabel2=sel?new Date(sel+"-02").toLocaleDateString("en-NG",{month:"long",year:"numeric"}):""
    w.document.write(`<!DOCTYPE html><html><head><title>Stock Statement ${monthLabel2}</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;color:#291608;padding:40px;max-width:780px;margin:0 auto}h1{font-size:20px;font-weight:700;color:${company.primaryColor||"var(--gold)"}}h2{font-size:13px;color:#888;font-weight:normal;margin:4px 0 20px}table{width:100%;border-collapse:collapse;margin:14px 0}th{background:#EDE5D6;padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.8px;color:#888}td{padding:8px 10px;border-bottom:1px solid #E0D3BB;font-size:13px}.right{text-align:right}.total{font-weight:bold;background:#F5F0E4}@media print{button{display:none}}</style></head><body>
      ${company.logo?`<img src="${company.logo}" style="height:50px;display:block;margin-bottom:10px" alt="logo"/>`:""}
      <h1>${company.name||"Bakery"} — Monthly Stock Statement</h1>
      <h2>${monthLabel2}</h2>
      <table>
        <tr><th>Item</th><th>Unit</th><th class="right">Opening Stock</th><th class="right">+ Purchased</th><th class="right">− Used in Production</th><th class="right">Closing Stock</th><th class="right">Cost/Unit</th><th class="right">Closing Value</th></tr>
        ${inventory.map(item=>{
          const opening=item.openingStock||item.stock||0
          const purchased=expenses.filter(e=>e.date?.startsWith(sel)&&(e.description?.toLowerCase().includes(item.name.toLowerCase()))).reduce((s,e)=>s+(e.amount||0),0)
          const closing=item.stock||0
          const used=Math.max(0,opening-closing)
          return `<tr><td>${item.name}</td><td>${item.unit}</td><td class="right">${opening} ${item.unit}</td><td class="right" style="color:#357A52">+${Math.round(purchased/Math.max(item.cost,1))} ${item.unit}</td><td class="right" style="color:#B03A2E">−${used} ${item.unit}</td><td class="right"><strong>${closing} ${item.unit}</strong></td><td class="right" style="color:var(--gold)">₦${Math.round(item.cost).toLocaleString()}</td><td class="right">₦${Math.round(closing*item.cost).toLocaleString()}</td></tr>`
        }).join("")}
        <tr class="total"><td colspan="7" class="right">Total closing stock value</td><td class="right">₦${Math.round(inventory.reduce((s,i)=>s+(i.stock||0)*(i.cost||0),0)).toLocaleString()}</td></tr>
      </table>
      <div style="margin-top:14px;padding:12px 14px;background:#FFF9EE;border-radius:8px;font-size:12px;color:var(--gold);line-height:1.7">Opening stock is set on the first day of each month in Settings → Opening Stock. Used in Production is calculated from confirmed production orders.</div>
      <p style="font-size:11px;color:#aaa;margin-top:30px">Generated by LayerLedger · ${new Date().toLocaleDateString()}</p>
      <script>window.print()</script></body></html>`)
    w.document.close()
  }

  return <div>
    <SHead title="Financial Reports" sub="Monthly P&L compiled from productions, expenses, and bank data."/>
    <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16,flexWrap:"wrap"}}>
      <select value={sel} onChange={e=>setSel(e.target.value)} style={{padding:"7px 12px",borderRadius:8,border:"1px solid var(--border)",background:"var(--panel)",fontSize:13,color:"var(--text)"}}>
        {(allMonths.length?allMonths:[cur]).map(m=><option key={m} value={m}>{new Date(m+"-02").toLocaleDateString("en-NG",{month:"long",year:"numeric"})}</option>)}
      </select>
      <Btn onClick={dl} variant="outline">📥 Download P&L Report</Btn>
      <Btn onClick={dlStock} variant="ghost">📥 Download Stock Statement</Btn>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10,marginBottom:16}}>
      {[{l:"Revenue",v:fmt(rev),s:`${paid.length} paid`,c:"var(--gold)"},{l:"Prod. Cost",v:fmt(prodCost),s:"ingredients",c:"#2A5F9A"},{l:"Delivery",v:fmt(delivCosts),s:"all orders",c:"#8C6E52"},{l:"Other Exp.",v:fmt(manualExp+bankDebits),s:"cash+bank",c:"#8C6E52"},{l:"Gross Profit",v:fmt(gross),s:margin+"% margin",c:"#357A52"},{l:"Net Profit",v:fmt(net),s:"after all costs",c:net>=0?"#357A52":"#B03A2E"}].map(s=><Card key={s.l} style={{borderBottom:`3px solid ${s.c}`}}><div style={{fontSize:10,color:"var(--muted)",textTransform:"uppercase",letterSpacing:1,marginBottom:5}}>{s.l}</div><div style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:700,color:s.c}}>{s.v}</div><div style={{fontSize:11,color:"var(--muted)",marginTop:2}}>{s.s}</div></Card>)}
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1.5fr 1fr",gap:16}}>
      <Card>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:16,fontWeight:600,marginBottom:4}}>Profit & Loss — {monthLabel}</div>
        <div style={{fontSize:11,color:"var(--muted)",textTransform:"uppercase",letterSpacing:1,marginBottom:6,marginTop:14}}>Income</div>
        {mp.length===0?<div style={{fontSize:13,color:"var(--muted)",marginBottom:10}}>No productions this month.</div>:mp.map(p=><div key={p.id} style={{display:"flex",justifyContent:"space-between",padding:"3px 0",fontSize:12.5}}><span>{p.size} {p.covering} — {p.client} <span style={{opacity:0.6}}>({p.paymentType})</span></span><span style={{fontWeight:500}}>{fmt(p.salePrice)}</span></div>)}
        <div style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderTop:"1px solid var(--border)",fontWeight:700,marginTop:4}}><span>Total Revenue</span><span style={{color:"#357A52"}}>{fmt(rev)}</span></div>
        <div style={{fontSize:11,color:"var(--muted)",textTransform:"uppercase",letterSpacing:1,marginTop:14,marginBottom:6}}>Costs</div>
        {[["Production (ingredients)",fmt(prodCost)],["Delivery costs",fmt(delivCosts)],["Cash expenses",fmt(manualExp)],["Bank expenses",fmt(bankDebits)]].map(([k,v])=><div key={k} style={{display:"flex",justifyContent:"space-between",padding:"3px 0",fontSize:12.5}}><span>{k}</span><span style={{color:"#B03A2E"}}>({v})</span></div>)}
        <div style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderTop:"1px solid var(--border)",fontWeight:700,marginTop:4}}><span>Total Costs</span><span style={{color:"#B03A2E"}}>({fmt(totalCost+bankDebits)})</span></div>
        <div style={{display:"flex",justifyContent:"space-between",padding:"12px 14px",background:net>=0?"#E8F5EE":"#FDEBE9",borderRadius:8,marginTop:12}}><span style={{fontSize:14,fontWeight:700}}>NET PROFIT</span><span style={{fontSize:15,fontWeight:700,color:net>=0?"#357A52":"#B03A2E"}}>{fmt(net)}</span></div>
      </Card>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <Card>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:14,fontWeight:600,marginBottom:12}}>Revenue by Cake Type</div>
          {Object.keys(bySize).length===0?<div style={{fontSize:13,color:"var(--muted)"}}>No data for this period.</div>:Object.entries(bySize).map(([k,v])=><div key={k} style={{marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:12.5}}>{k.replace("·"," · ")} ×{v.qty}</span><span style={{fontSize:12.5,fontWeight:600,color:"var(--gold)"}}>{fmt(v.rev)}</span></div>
            <div style={{height:4,background:"var(--border)",borderRadius:2}}><div style={{height:"100%",width:`${rev>0?(v.rev/rev)*100:0}%`,background:"var(--gold)",borderRadius:2}}/></div>
            <div style={{fontSize:11,color:"#357A52",marginTop:2}}>Profit: {fmt(v.rev-v.cost)}</div>
          </div>)}
        </Card>
        {bankCredits>0&&<Card style={{background:"#FFF9EE",borderColor:"var(--gold)"}}>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:13,fontWeight:600,marginBottom:8}}>📅 Bank Reconciliation</div>
          {[["Production records",fmt(rev)],["Bank credits received",fmt(bankCredits)]].map(([k,v])=><div key={k} style={{display:"flex",justifyContent:"space-between",fontSize:12.5,marginBottom:4}}><span style={{color:"var(--muted)"}}>{k}</span><strong>{v}</strong></div>)}
          {Math.abs(rev-bankCredits)>1000?<div style={{background:"#FEF3DC",borderRadius:6,padding:"7px 10px",fontSize:12,color:"#8A5F10",marginTop:4}}>⚠ {fmt(Math.abs(rev-bankCredits))} difference — check Bank Import for unmatched payments.</div>:<div style={{color:"#357A52",fontSize:12,fontWeight:500,marginTop:4}}>✓ Reconciled</div>}
        </Card>}
      </div>
    </div>
  </div>
}

// ═══════════════════════════════════════════════════════════
//  SHOPPING LIST
