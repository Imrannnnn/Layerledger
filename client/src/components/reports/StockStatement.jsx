/**
 * StockStatement.jsx
 * ----------------------------------------------------------------------------
 * Stock movement statement.
 * ----------------------------------------------------------------------------
 */
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { Btn, Card, SHead, TH, TR2, Alert } from "../common/ui.jsx"
import { fmt } from "../../lib/helpers.js"
import { loadLocal, calculateOrderUsages, loadOpeningStock } from "../../lib/data.js"
import { Download } from "lucide-react"

// ═══════════════════════════════════════════════════════════
export function StockStatement({inventory, productions = [], expenses = [], company, recipes = []}){
  const allMonths=[...new Set(productions.map(p=>p.deliveryDate?.slice(0,7)).filter(Boolean))].sort().reverse()
  const cur=new Date().toISOString().slice(0,7)
  const [sel,setSel]=useState(allMonths[0]||cur)

  const monthLabel=sel?new Date(sel+"-02").toLocaleDateString("en-NG",{month:"long",year:"numeric"}):""

  // Load starting inventory snapshot for this month
  const osItems = loadOpeningStock(sel)
  const getOSQty=(id)=>{const found=osItems.find(i=>i.id===id);return found?(Number(found.openingQty)||0):0}

  // Purchases this month
  const mPurchases = loadLocal("ll_purchases", []).filter(p => {
    if (!p.date) return false
    if (typeof p.date === "string" && p.date.startsWith(sel)) return true
    try {
      return new Date(p.date).toISOString().slice(0, 7) === sel
    } catch {
      return false
    }
  })
  const getBought = id => mPurchases.filter(p => p.itemId === id).reduce((s, p) => s + (Number(p.stockAdded ?? p.qty) || 0), 0)

  // Calculate purchased this month from expenses
  const monthExp=expenses.filter(e=>e.date?.startsWith(sel)&&(e.source==="receipt"||e.source==="purchase"))
  const totalPurchased=monthExp.reduce((s,e)=>s+(e.amount||0),0)

  // Calculate used in production this month per item via Order Calculator recipes
  const monthProds=productions.filter(p=>(p.deliveryDate?.startsWith(sel)||p.confirmedAt?.startsWith(sel)||p.orderDate?.startsWith(sel)))
  const totalUsedValue=monthProds.reduce((s,p)=>s+(p.cost||0),0)

  const monthUsages = useMemo(() => {
    const usageMap = {}
    monthProds.forEach(order => {
      const usages = calculateOrderUsages(order, inventory, recipes)
      usages.forEach(u => {
        usageMap[u.itemId] = (usageMap[u.itemId] || 0) + u.qty
      })
    })
    return usageMap
  }, [monthProds, inventory, recipes])

  const getUsed = id => parseFloat((monthUsages[id] || 0).toFixed(3))

  const dl=()=>{
    const w=window.open("","_blank")
    w.document.write(`<!DOCTYPE html><html><head><title>Stock Statement ${monthLabel}</title><style>
    *{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;color:#291608;padding:40px;max-width:780px;margin:0 auto}
    h1{font-size:20px;font-weight:700;color:${company.primaryColor||"var(--gold)"}}h2{font-size:13px;color:#888;font-weight:normal;margin:4px 0 20px}
    table{width:100%;border-collapse:collapse;margin:14px 0}th{background:#EDE5D6;padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.8px;color:#888;font-weight:500}
    td{padding:8px 10px;border-bottom:1px solid #E0D3BB;font-size:13px}.right{text-align:right}.total{font-weight:bold;background:#F5F0E4}
    .summary{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:16px 0}.scard{border:1px solid #E0D3BB;border-radius:8px;padding:12px}
    .slabel{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:4px}.sval{font-size:18px;font-weight:bold;color:${company.primaryColor||"var(--gold)"}}
    @media print{button{display:none}}</style></head><body>
    ${company.logo?`<img src="${company.logo}" style="height:50px;margin-bottom:10px;display:block"/>`:""}
    <h1>${company.name||"Bakery"} — Monthly Stock Statement</h1><h2>${monthLabel}</h2>
    <div class="summary">
      <div class="scard"><div class="slabel">Total purchased</div><div class="sval">₦${Math.round(totalPurchased).toLocaleString()}</div></div>
      <div class="scard"><div class="slabel">Used in production</div><div class="sval">₦${Math.round(totalUsedValue).toLocaleString()}</div></div>
      <div class="scard"><div class="slabel">Production orders</div><div class="sval">${monthProds.length}</div></div>
    </div>
    <table><tr><th>Item</th><th>Unit</th><th class="right">Starting inventory</th><th class="right" style="color:#1D9E75">+ Purchased</th><th class="right" style="color:#B03A2E">− Used</th><th class="right">Closing stock</th><th class="right">Cost/unit</th></tr>
    ${inventory.map(item=>{
      const f = osItems.find(x => x.id === item.id)
      const opening = getOSQty(item.id)
      const cost = f ? f.cost : item.cost
      const unit = f ? f.unit : item.unit
      const bought = getBought(item.id)
      const used = getUsed(item.id)
      const closing = Math.max(0, parseFloat((opening + bought - used).toFixed(3)))
      return`<tr><td>${item.name}</td><td>${unit}</td><td class="right">${opening} ${unit}</td><td class="right" style="color:#1D9E75">+${bought} ${unit}</td><td class="right" style="color:#B03A2E">−${used.toFixed(2)} ${unit}</td><td class="right"><strong>${closing} ${unit}</strong></td><td class="right">₦${Math.round(cost).toLocaleString()}</td></tr>`
    }).join("")}
    <tr class="total"><td colspan="5" class="right">Total closing stock value</td><td class="right" colspan="2" style="color:${company.primaryColor||"var(--gold)"};font-size:15px">₦${Math.round(inventory.reduce((s,i)=>{
      const f = osItems.find(x => x.id === i.id)
      const opening = getOSQty(i.id)
      const cost = f ? f.cost : i.cost
      const bought = getBought(i.id)
      const used = getUsed(i.id)
      const closing = Math.max(0, parseFloat((opening + bought - used).toFixed(3)))
      return s + closing * cost
    },0)).toLocaleString()}</td></tr></table>
    <p style="font-size:11px;color:#aaa;margin-top:24px">Generated by BakeWealth · ${new Date().toLocaleDateString()}</p>
    <script>window.print()<\/script></body></html>`)
    w.document.close()
  }

  return <div>
    <SHead title="Monthly Stock Statement" sub="Auto-generated from starting inventory, purchases, and production deductions."/>
    <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16,flexWrap:"wrap"}}>
      <select value={sel} onChange={e=>setSel(e.target.value)} style={{padding:"7px 12px",borderRadius:8,border:"1px solid var(--border)",background:"var(--panel)",fontSize:13,color:"var(--text)"}}>
        {(allMonths.length?allMonths:[cur]).map(m=><option key={m} value={m}>{new Date(m+"-02").toLocaleDateString("en-NG",{month:"long",year:"numeric"})}</option>)}
      </select>
      <Btn onClick={dl} variant="outline" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
        <Download size={13} /> Download PDF
      </Btn>
    </div>

    {osItems.length===0&&<Alert msg={`No opening stock locked for ${monthLabel}. Go to Settings → Opening Stock to set it.`} color="gold"/>}

    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:16}}>
      {[{l:"Total Purchased",v:fmt(totalPurchased),s:"from receipts this month",c:"#357A52"},
        {l:"Used in Production",v:fmt(totalUsedValue),s:`${monthProds.length} orders`,c:"#B03A2E"},
        {l:"Closing Stock Value",v:fmt(inventory.reduce((s,i)=>{
          const f = osItems.find(x => x.id === i.id)
          const opening = getOSQty(i.id)
          const cost = f ? f.cost : i.cost
          const bought = getBought(i.id)
          const used = getUsed(i.id)
          const closing = Math.max(0, parseFloat((opening + bought - used).toFixed(3)))
          return s + closing * cost
        },0)),s:"calculated month-end value",c:"var(--gold)"}
      ].map(s=><Card key={s.l}><div style={{fontSize:10,color:"var(--muted)",textTransform:"uppercase",letterSpacing:1,marginBottom:5}}>{s.l}</div><div style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700,color:s.c}}>{s.v}</div><div style={{fontSize:11,color:"var(--muted)",marginTop:2}}>{s.s}</div></Card>)}
    </div>

    <Card style={{padding:0,overflowX:"auto"}}>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
        <TH cols={["Item","Unit","Opening stock","+ Bought","− Used in prod.","Closing stock","Cost/unit","Closing value"]}/>
        <tbody>{inventory.map((item,i)=>{
          const f = osItems.find(x => x.id === item.id)
          const opening = getOSQty(item.id)
          const cost = f ? f.cost : item.cost
          const unit = f ? f.unit : item.unit
          const bought = getBought(item.id)
          const used = getUsed(item.id)
          const closing = Math.max(0, parseFloat((opening + bought - used).toFixed(3)))
          return <TR2 key={item.id} i={i} row={[
            <span style={{fontWeight:500}}>{item.name}</span>,
            <span style={{color:"var(--muted)"}}>{unit}</span>,
            <span>{opening} {unit}</span>,
            <span style={{color:"#357A52",fontWeight:500}}>+{bought} {unit}</span>,
            <span style={{color:"#B03A2E"}}>−{used} {unit}</span>,
            <span style={{fontWeight:600,color:closing<=(item.minStock||5)?"#B03A2E":"#357A52"}}>{closing} {unit}</span>,
            <span style={{color:"var(--gold)"}}>{fmt(cost)}/{unit}</span>,
            <span style={{fontWeight:500}}>{fmt(closing*cost)}</span>,
          ]}/>
        })}</tbody>
        <tfoot><tr style={{background:"#F5F0E4"}}>
          <td colSpan={7} style={{padding:"10px",textAlign:"right",fontWeight:700,fontSize:13}}>Total closing stock value</td>
          <td style={{padding:"10px",textAlign:"left",fontWeight:700,color:"var(--gold)",fontSize:15}}>{fmt(inventory.reduce((s,i)=>{
            const f = osItems.find(x => x.id === i.id)
            const opening = getOSQty(i.id)
            const cost = f ? f.cost : i.cost
            const bought = getBought(i.id)
            const used = getUsed(i.id)
            const closing = Math.max(0, parseFloat((opening + bought - used).toFixed(3)))
            return s + closing * cost
          },0))}</td>
        </tr></tfoot>
      </table>
    </Card>
    <div style={{marginTop:10,fontSize:11.5,color:"var(--muted)",lineHeight:1.7}}>Opening stock is locked in Settings → Opening Stock at the start of each month. Used in production is calculated from confirmed order recipes. Closing stock is calculated as Opening + Bought − Used.</div>
  </div>
}

// ═══════════════════════════════════════════════════════════
//  SETTINGS (separate page)
