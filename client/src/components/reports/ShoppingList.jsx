/**
 * ShoppingList.jsx
 * ----------------------------------------------------------------------------
 * Low-stock shopping list.
 * ----------------------------------------------------------------------------
 */
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { Btn, Sel, Card, Badge, SHead } from "../common/ui.jsx"

// ═══════════════════════════════════════════════════════════
export function ShoppingList({inventory,company}){
  const [freq,setFreq]=useState("weekly");const [done,setDone]=useState(false)
  const low=inventory.filter(i=>i.stock<=(i.minStock||3))
  const zero=inventory.filter(i=>i.stock===0)

  const dl=()=>{
    const w=window.open("","_blank")
    w.document.write(`<!DOCTYPE html><html><head><title>Shopping List</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;padding:40px;max-width:650px;margin:0 auto;color:#291608}h1{color:${company.primaryColor||"var(--gold)"};font-size:20px}h2{font-size:13px;color:#888;font-weight:normal;margin:4px 0 20px}table{width:100%;border-collapse:collapse;margin:16px 0}th{background:#EDE5D6;padding:10px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.8px;color:#888}td{padding:10px;border-bottom:1px solid #E0D3BB;font-size:13px}.cb{width:18px;height:18px;border:2px solid ${company.primaryColor||"var(--gold)"};border-radius:3px;display:inline-block}.sos{color:#B03A2E;font-weight:bold}@media print{button{display:none}}</style></head><body>
      ${company.logo?`<img src="${company.logo}" style="height:50px;margin-bottom:10px;display:block" alt="logo"/>`:""}
      <h1>${company.name} — ${freq==="weekly"?"Weekly":freq==="biweekly"?"Bi-Weekly":"Monthly"} Shopping List</h1>
      <h2>${new Date().toLocaleDateString("en-NG",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}</h2>
      ${zero.length>0?`<div style="background:#FDEBE9;padding:12px;border-radius:8px;margin-bottom:16px;font-size:13px;color:#B03A2E"><strong>🚨 OUT OF STOCK — BUY NOW:</strong> ${zero.map(i=>i.name).join(", ")}</div>`:""}
      <table><tr><th>✓</th><th>Item</th><th>Category</th><th>Current</th><th>Min</th><th>Buy Qty</th><th>Est. Cost</th></tr>
        ${low.map(i=>{const need=Math.max(0,(i.minStock||3)*4-i.stock);return`<tr><td><div class="cb"></div></td><td class="${i.stock===0?"sos":""}">${i.name}${i.stock===0?" 🚨":""}</td><td>${i.cat}</td><td>${i.stock} ${i.unit}</td><td>${i.minStock||3}</td><td>${need} ${i.unit}</td><td>₦${Math.round(i.cost*need).toLocaleString()}</td></tr>`}).join("")}
        <tr style="font-weight:bold;background:#F5F0E4"><td colspan="6">ESTIMATED TOTAL</td><td>₦${Math.round(low.reduce((s,i)=>{const n=Math.max(0,(i.minStock||3)*4-i.stock);return s+i.cost*n},0)).toLocaleString()}</td></tr>
      </table>
      <p style="font-size:11px;color:#aaa;margin-top:30px">LayerLedger · ${new Date().toLocaleDateString()}</p>
      <script>window.print()</script></body></html>`)
    w.document.close();setDone(true)
  }

  return <div>
    <SHead title="Shopping List" sub="Generate a restock list based on current inventory levels."/>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
      <Card>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:15,fontWeight:600,marginBottom:14}}>Generate Shopping List</div>
        <Sel label="Frequency" value={freq} onChange={setFreq} options={[{value:"weekly",label:"Weekly"},{value:"biweekly",label:"Bi-Weekly (every 2 weeks)"},{value:"monthly",label:"Monthly"}]}/>
        <div style={{padding:"10px 12px",background:"#FFF9EE",borderRadius:8,border:"1px solid var(--gold)",fontSize:13,marginBottom:14}}>
          <strong style={{color:"var(--text)"}}>{low.length} items</strong> <span style={{color:"var(--muted)"}}>need restocking</span>
          {zero.length>0&&<div style={{color:"#B03A2E",marginTop:4,fontWeight:500}}>🚨 {zero.length} completely out of stock</div>}
        </div>
        <Btn full onClick={dl}>📥 Download & Print Shopping List</Btn>
        {done&&<div style={{marginTop:8,fontSize:12.5,color:"#357A52"}}>✓ List opened — print or save as PDF from the new tab.</div>}
        <div style={{marginTop:16}}>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:13,fontWeight:600,marginBottom:8}}>Items Needing Restock</div>
          {low.length===0?<div style={{fontSize:13,color:"#357A52"}}>✓ All items are well-stocked!</div>:
          low.map(i=><div key={i.id} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid var(--border)"}}>
            <div><div style={{fontSize:13,fontWeight:500}}>{i.name}</div><div style={{fontSize:11.5,color:"var(--muted)"}}>Min: {i.minStock||3} {i.unit}</div></div>
            <Badge color={i.stock===0?"red":"gold"}>{i.stock===0?"OUT":i.stock+" "+i.unit}</Badge>
          </div>)}
        </div>
      </Card>
      <Card>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:14,fontWeight:600,marginBottom:12}}>Full Inventory Status</div>
        <div style={{overflowY:"auto",maxHeight:450}}>
          {inventory.map((i)=>{
            const max=(i.minStock||3)*4;const pct=Math.min(100,(i.stock/max)*100)
            return <div key={i.id} style={{marginBottom:8}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                <span style={{fontSize:12.5,fontWeight:500}}>{i.name}</span>
                <span style={{fontSize:11.5,color:i.stock<=(i.minStock||3)?"#B03A2E":"var(--muted)"}}>{i.stock} {i.unit}</span>
              </div>
              <div style={{height:4,background:"var(--border)",borderRadius:2}}><div style={{height:"100%",width:`${pct}%`,background:pct<25?"#B03A2E":pct<60?"var(--gold)":"#357A52",borderRadius:2,transition:"width 0.3s"}}/></div>
            </div>
          })}
        </div>
      </Card>
    </div>
  </div>
}

// ═══════════════════════════════════════════════════════════
//  INVOICES — list of all invoices generated from quotes
