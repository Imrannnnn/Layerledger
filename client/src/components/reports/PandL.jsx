/**
 * PandL.jsx
 * ----------------------------------------------------------------------------
 * Profit & Loss statement with drill-down.
 * Revenue from confirmed orders, COGS, overhead; gift/sample excluded.
 * ----------------------------------------------------------------------------
 */
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { Btn, Card, SHead } from "../common/ui.jsx"
import { fmt } from "../../lib/helpers.js"
import { mergeRevenueSources, PLSection, PLRow } from "../../lib/costing.jsx"


export function PandL({productions,expenses,company}){
  // Use confirmed quotes as primary revenue source
  const allRevenue=mergeRevenueSources(productions)

  const last12=Array.from({length:12},(_,i)=>{const d=new Date();d.setDate(1);d.setMonth(d.getMonth()-i);return d.toISOString().slice(0,7)})
  const allMonths=[...new Set([
    ...last12,
    ...allRevenue.map(p=>p.deliveryDate?.slice(0,7)),
    ...expenses.map(e=>e.date?.slice(0,7)),
  ].filter(Boolean))].sort().reverse()
  const cur=new Date().toISOString().slice(0,7)
  // Default to current month — always show current month even if no data yet
  const [sel,setSel]=useState(cur)
  const [drill,setDrill]=useState(null)
  const monthLabel=new Date(sel+"-02").toLocaleDateString("en-NG",{month:"long",year:"numeric"})
  const gold=company?.primaryColor||"var(--gold)"

  // P&L calculations — all from confirmed quotes
  const mRevenue=allRevenue.filter(p=>p.deliveryDate?.startsWith(sel))
  const paid=mRevenue.filter(p=>p.paymentType!=="gift"&&p.paymentType!=="sample")
  const revenue=paid.reduce((s,p)=>s+(p.salePrice||0),0)
  // COGS only counts SOLD items — gift/sample costs are recorded separately as a Gifts & Samples expense
  const cogsProd=paid.reduce((s,p)=>s+(p.cost||0),0)
  const delivery=paid.reduce((s,p)=>s+(p.deliveryCost||0),0)
  const cogs=cogsProd+delivery
  const grossProfit=revenue-cogs
  const grossMargin=revenue>0?Math.round((grossProfit/revenue)*100):0

  // Revenue by product type
  const byType=mRevenue.reduce((acc,p)=>{
    const t=p.productType||"Cake"
    if(!acc[t])acc[t]={qty:0,rev:0,cost:0}
    acc[t].qty++;acc[t].rev+=(p.salePrice||0);acc[t].cost+=(p.cost||0)
    return acc
  },{})

  // Overhead expenses — everything EXCEPT pure ingredient purchase costs
  // Ingredients bought for stock go to COGS via recipe costing, not overhead
  // But decoration items, utilities, packaging, salary etc. are overhead
  const COGS_CATS=["Ingredient costs"] // only this specific category excluded from overhead
  const mExp=expenses.filter(e=>
    e.date?.startsWith(sel)&&
    !COGS_CATS.includes(e.category)&&
    e.source!=="purchase"
  )
  const overhead=mExp.reduce((s,e)=>s+(e.amount||0),0)

  // Group overheads by category
  const overheadBycat=mExp.reduce((acc,e)=>{
    const cat=e.category||"General"
    acc[cat]=(acc[cat]||0)+(e.amount||0)
    return acc
  },{})

  const netProfit=grossProfit-overhead
  const netMargin=revenue>0?Math.round((netProfit/revenue)*100):0

  const dl=()=>{
    const w=window.open("","_blank")
    w.document.write(`<!DOCTYPE html><html><head><title>P&L Statement ${monthLabel}</title>
    <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;color:#291608;padding:36px;max-width:680px;margin:0 auto}
    h1{font-size:22px;font-weight:700;color:${gold}}
    h2{font-size:12px;color:#888;font-weight:400;margin:3px 0 24px}
    .section{margin-bottom:20px}
    .section-title{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#888;font-weight:600;padding:8px 0;border-bottom:2px solid ${gold};margin-bottom:10px}
    .row{display:flex;justify-content:space-between;padding:7px 0;font-size:13px;border-bottom:1px solid #F0EBE3}
    .row.indent{padding-left:16px;color:#555}
    .row.subtotal{font-weight:600;background:#F5F0E4;padding:8px 10px;border-radius:4px;margin:4px 0}
    .row.total{font-weight:700;font-size:15px;padding:12px 14px;background:${netProfit>=0?"#E8F5EE":"#FDEBE9"};border-radius:8px;color:${netProfit>=0?"#1D6B40":"#B03A2E"};margin-top:8px}
    .positive{color:#1D6B40}.negative{color:#B03A2E}
    .summary{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:20px 0}
    .scard{border:1px solid #E0D3BB;border-radius:8px;padding:12px;text-align:center}
    .slabel{font-size:10px;text-transform:uppercase;letter-spacing:.8px;color:#888;margin-bottom:4px}
    .sval{font-size:18px;font-weight:700;color:${gold}}
    @media print{button{display:none}}</style></head><body>
    ${company?.logo?`<img src="${company.logo}" style="height:44px;margin-bottom:12px;display:block"/>`:""}
    <h1>${company?.name||"Bakery"} — Profit & Loss Statement</h1>
    <h2>${monthLabel}</h2>
    <div class="summary">
      <div class="scard"><div class="slabel">Revenue</div><div class="sval">₦${Math.round(revenue).toLocaleString()}</div></div>
      <div class="scard"><div class="slabel">Gross margin</div><div class="sval">${grossMargin}%</div></div>
      <div class="scard"><div class="slabel">Net margin</div><div class="sval ${netMargin>=0?"positive":"negative"}">${netMargin}%</div></div>
    </div>
    <div class="section">
      <div class="section-title">Revenue</div>
      ${Object.entries(byType).map(([type,data])=>`<div class="row indent"><span>${type} — ${data.qty} order${data.qty!==1?"s":""}</span><span>₦${Math.round(data.rev).toLocaleString()}</span></div>`).join("")}
      ${Object.keys(byType).length===0?'<div class="row indent"><span>No confirmed orders this month</span><span>₦0</span></div>':""}
      <div class="row subtotal"><span>Total Revenue (${paid.length} confirmed orders)</span><span>₦${Math.round(revenue).toLocaleString()}</span></div>
    </div>
    <div class="section">
      <div class="section-title">Sales Detail</div>
      ${mRevenue.map(p=>`<div class="row"><span>${p.client} — ${p.productType||"Cake"}${p.size?" ("+p.size+")":""}</span><span>₦${Math.round(p.salePrice||0).toLocaleString()}</span></div>`).join("")}
    </div>
    <div class="section">
      <div class="section-title">Cost of Goods Sold</div>
      <div class="row indent"><span>Ingredient costs</span><span>₦${Math.round(cogsProd).toLocaleString()}</span></div>
      <div class="row indent"><span>Delivery costs</span><span>₦${Math.round(delivery).toLocaleString()}</span></div>
      <div class="row subtotal"><span>Total COGS</span><span>₦${Math.round(cogs).toLocaleString()}</span></div>
    </div>
    <div class="row subtotal" style="font-size:14px;margin-bottom:20px"><span>Gross Profit</span><span class="${grossProfit>=0?"positive":"negative"}">₦${Math.round(grossProfit).toLocaleString()} (${grossMargin}%)</span></div>
    <div class="section">
      <div class="section-title">Overhead Expenses</div>
      ${Object.entries(overheadBycat).map(([cat,amt])=>`<div class="row indent"><span>${cat}</span><span>₦${Math.round(amt).toLocaleString()}</span></div>`).join("")}
      ${Object.keys(overheadBycat).length===0?'<div class="row indent"><span>No overhead expenses</span><span>₦0</span></div>':""}
      <div class="row subtotal"><span>Total Overheads</span><span>₦${Math.round(overhead).toLocaleString()}</span></div>
    </div>
    <div class="row total"><span>Net Profit / (Loss)</span><span>₦${Math.round(netProfit).toLocaleString()} (${netMargin}%)</span></div>
    <p style="margin-top:28px;font-size:10px;color:#aaa">Generated by LayerLedger · ${new Date().toLocaleDateString()} · This is a management account and not a certified financial statement.</p>
    <script>window.print()<\/script></body></html>`)
    w.document.close()
  }

  const DrillDown=({title,rows,onClose})=>(<div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.5)",zIndex:1000,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={onClose}>
    <div style={{background:"var(--panel)",borderRadius:"16px 16px 0 0",width:"100%",maxWidth:600,maxHeight:"75vh",overflow:"auto",padding:20}} onClick={e=>e.stopPropagation()}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:16,fontWeight:700}}>{title}</div>
        <button onClick={onClose} style={{background:"none",border:"none",fontSize:22,cursor:"pointer",color:"var(--muted)",lineHeight:1}}>×</button>
      </div>
      {rows.length===0?<div style={{fontSize:13,color:"var(--muted)",textAlign:"center",padding:20}}>No records found for this period.</div>:
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
        <thead><tr>{["Date","Description","Amount"].map(h=><th key={h} style={{textAlign:h==="Amount"?"right":"left",padding:"6px 8px",borderBottom:"1px solid var(--border)",fontSize:10,color:"var(--muted)",textTransform:"uppercase",letterSpacing:.7,fontWeight:600}}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r,i)=><tr key={i} style={{borderBottom:"1px solid var(--border)",background:i%2===0?"transparent":"var(--bg)"}}>
          <td style={{padding:"8px",fontSize:12,color:"var(--muted)",whiteSpace:"nowrap"}}>{r.date}</td>
          <td style={{padding:"8px"}}>{r.label}</td>
          <td style={{padding:"8px",textAlign:"right",fontWeight:600,color:r.amount<0?"#B03A2E":"var(--text)"}}>{fmt(Math.abs(r.amount))}</td>
        </tr>)}
        <tr style={{borderTop:"2px solid var(--border)"}}><td colSpan={2} style={{padding:"10px 8px",fontWeight:700}}>Total</td><td style={{padding:"10px 8px",textAlign:"right",fontWeight:700,color:"var(--gold)"}}>{fmt(rows.reduce((s,r)=>s+Math.abs(r.amount),0))}</td></tr>
        </tbody>
      </table>}
    </div>
  </div>)

  const showRevenue=()=>setDrill({title:"Revenue — "+monthLabel,rows:paid.map(p=>({date:p.deliveryDate||p.orderDate||"",label:(p.client||"Client")+" — "+(p.productType||"Cake")+(p.size?" ("+p.size+")":""),amount:p.salePrice||0}))})
  const showCOGS=()=>setDrill({title:"Cost of Goods Sold — "+monthLabel,rows:paid.map(p=>({date:p.deliveryDate||p.orderDate||"",label:(p.client||"Client")+" — ingredient cost",amount:p.cost||0}))})
  const showOverhead=(cat)=>{
    const rows=cat
      ?mExp.filter(e=>e.category===cat).map(e=>({date:e.date||"",label:e.description||e.category,amount:e.amount||0}))
      :mExp.map(e=>({date:e.date||"",label:e.description||e.category,amount:e.amount||0}))
    setDrill({title:cat?cat+" — "+monthLabel:"All Overhead Expenses — "+monthLabel,rows})
  }

  return <div>
    {drill&&<DrillDown title={drill.title} rows={drill.rows} onClose={()=>setDrill(null)}/>}
    <SHead title="P&L Statement" sub="Profit & Loss — tap any figure to see the detail behind it"/>
    <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:18,flexWrap:"wrap"}}>
      <select value={sel} onChange={e=>setSel(e.target.value)} style={{padding:"7px 12px",borderRadius:8,border:"1px solid var(--border)",background:"var(--panel)",fontSize:13,color:"var(--text)"}}>
        {([...new Set([cur,...allMonths])]).map(m=><option key={m} value={m}>{new Date(m+"-02").toLocaleDateString("en-NG",{month:"long",year:"numeric"})}</option>)}
      </select>
      <Btn onClick={dl}>📥 Download PDF</Btn>
    </div>

    {/* SUMMARY CARDS */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:20}}>
      {[
        {l:"Revenue",v:fmt(revenue),c:gold},
        {l:"Gross margin",v:grossMargin+"%",c:grossMargin>=50?"#357A52":"#B03A2E"},
        {l:"Net margin",v:netMargin+"%",c:netMargin>=30?"#357A52":"#B03A2E"},
      ].map(s=><Card key={s.l} style={{textAlign:"center",padding:"14px"}}>
        <div style={{fontSize:10,color:"var(--muted)",textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>{s.l}</div>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:22,fontWeight:700,color:s.c}}>{s.v}</div>
      </Card>)}
    </div>

    <Card style={{maxWidth:560}}>
      <PLSection gold={gold} title="Revenue">
        {Object.entries(byType).length>0
          ?Object.entries(byType).map(([type,data])=><div key={type} onClick={showRevenue} style={{cursor:"pointer"}}><PLRow label={`${type} (${data.qty} order${data.qty!==1?"s":""})`} value={fmt(data.rev)} indent/></div>)
          :<PLRow label="No confirmed orders this month" value={fmt(0)} indent/>}
        <div onClick={showRevenue} style={{cursor:"pointer"}}><PLRow label={`Total Revenue (${paid.length} confirmed order${paid.length!==1?"s":""})`} value={fmt(revenue)} bold/></div>
        <div style={{fontSize:11,color:"var(--muted)",marginTop:2,marginLeft:2}}>Tap any row to see detail</div>
      </PLSection>

      <PLSection gold={gold} title="Cost of Goods Sold (COGS)">
        <div onClick={showCOGS} style={{cursor:"pointer"}}>
          <PLRow label="Ingredient costs" value={fmt(cogsProd)} indent/>
          <PLRow label="Delivery costs" value={fmt(delivery)} indent/>
          <PLRow label="Total COGS" value={fmt(cogs)} bold/>
        </div>
        <div style={{fontSize:11,color:"var(--muted)",marginTop:2,marginLeft:2}}>Tap to see order breakdown</div>
      </PLSection>

      <PLRow label={`Gross Profit (${grossMargin}% margin)`} value={fmt(grossProfit)} bold color={grossProfit>=0?"#357A52":"#B03A2E"}/>

      <div style={{height:16}}/>

      <PLSection gold={gold} title="Overhead Expenses">
        {Object.entries(overheadBycat).map(([cat,amt])=><div key={cat} onClick={()=>showOverhead(cat)} style={{cursor:"pointer"}}><PLRow label={cat} value={fmt(amt)} indent/></div>)}
        {Object.keys(overheadBycat).length===0&&<PLRow label="No overhead expenses logged" value="₦0" indent/>}
        <div onClick={()=>showOverhead(null)} style={{cursor:"pointer"}}><PLRow label="Total Overheads" value={fmt(overhead)} bold/></div>
        <div style={{fontSize:11,color:"var(--muted)",marginTop:2,marginLeft:2}}>Tap a category row to see detail</div>
      </PLSection>

      <div style={{padding:"14px 16px",background:netProfit>=0?"#E8F5EE":"#FDEBE9",border:(netProfit>=0?"1px solid #C2E0CF":"1px solid #F09595"),borderRadius:10,display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8}}>
        <div>
          <div style={{fontSize:11,color:netProfit>=0?"#085041":"#501313",textTransform:"uppercase",letterSpacing:.8,marginBottom:3}}>Net Profit / (Loss)</div>
          <div style={{fontSize:11,color:netProfit>=0?"#0F6E56":"#791F1F"}}>{monthLabel}</div>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:24,fontWeight:700,color:netProfit>=0?"#357A52":"#B03A2E"}}>{fmt(netProfit)}</div>
          <div style={{fontSize:12,color:netProfit>=0?"#357A52":"#B03A2E"}}>{netMargin}% net margin</div>
        </div>
      </div>

      <div style={{marginTop:12,fontSize:11,color:"var(--muted)",lineHeight:1.6}}>
        This is a management account generated by LayerLedger. It is not a certified financial statement.
      </div>
    </Card>
  </div>
}

// ═══════════════════════════════════════════════════════════
//  USER ROW (standalone to allow useState per row)
