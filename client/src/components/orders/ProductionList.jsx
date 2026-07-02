/**
 * ProductionList.jsx
 * ----------------------------------------------------------------------------
 * Weekly production schedule.
 * Lists orders due, grouped by week, with delivered status.
 * ----------------------------------------------------------------------------
 */
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { Btn, Card, SHead } from "../common/ui.jsx"
import { today } from "../../lib/helpers.js"

// ═══════════════════════════════════════════════════════════
export function ProductionList({productions,company,setView}){
  const today=new Date()
  const startOfWeek=new Date(today)
  startOfWeek.setDate(today.getDate()-today.getDay()+1) // Monday
  const endOfWeek=new Date(startOfWeek)
  endOfWeek.setDate(startOfWeek.getDate()+6) // Sunday

  const [weekOffset,setWeekOffset]=useState(0)
  const ws=new Date(startOfWeek);ws.setDate(ws.getDate()+weekOffset*7)
  const we=new Date(ws);we.setDate(ws.getDate()+6)

  const fmt2=d=>new Date(d).toLocaleDateString("en-NG",{weekday:"short",day:"numeric",month:"short"})
  const weekLabel=`${fmt2(ws)} — ${fmt2(we)}`

  const weekProds=productions.filter(p=>{
    if(!p.deliveryDate)return false
    const d=new Date(p.deliveryDate)
    return d>=ws&&d<=we
  }).sort((a,b)=>new Date(a.deliveryDate)-new Date(b.deliveryDate))

  const statusColor={pending:"#FAEEDA",inprogress:"#E8EFFC",ready:"#E1F5EE",delivered:"#F0EBE3"}
  const statusText={pending:"Pending",inprogress:"In progress",ready:"Ready",delivered:"Delivered"}
  const [statuses,setStatuses]=useState({})
  const setStatus=(id,s)=>setStatuses(p=>({...p,[id]:s}))

  const print=()=>{
    const w=window.open("","_blank")
    w.document.write(`<!DOCTYPE html><html><head><title>Production List ${weekLabel}</title>
    <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;color:#291608;padding:28px;max-width:720px;margin:0 auto}
    h1{font-size:20px;font-weight:700;color:${company?.primaryColor||"var(--gold)"}}
    h2{font-size:12px;color:#888;font-weight:400;margin:3px 0 18px}
    table{width:100%;border-collapse:collapse;font-size:13px}
    th{background:#EDE5D6;padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.8px;color:#888;font-weight:500}
    td{padding:9px 10px;border-bottom:1px solid #E0D3BB}
    tr:nth-child(even) td{background:#F8F3EA}
    .status{display:inline-block;padding:2px 9px;border-radius:20px;font-size:11px}
    @media print{button{display:none}}</style></head><body>
    ${company?.logo?`<img src="${company.logo}" style="height:44px;margin-bottom:10px;display:block"/>`:""}
    <h1>${company?.name||"Bakery"} — Production List</h1>
    <h2>${weekLabel} · ${weekProds.length} order${weekProds.length!==1?"s":""}</h2>
    <table><tr><th>#</th><th>Client</th><th>Cake</th><th>Flavour</th><th>Covering</th><th>Size</th><th>Layers</th><th>Collection</th><th>Notes</th><th>Status</th></tr>
    ${weekProds.map((p,i)=>`<tr><td>${i+1}</td><td><strong>${p.client||"—"}</strong></td><td>${p.size||"—"}</td><td>${p.flavor||p.flavour||"—"}</td><td>${p.covering||"—"}</td><td>${p.size||"—"}</td><td>${p.layers||"—"}</td><td>${p.deliveryDate||"—"}</td><td>${p.notes||""}</td><td class="status">${statuses[p.id]||"Pending"}</td></tr>`).join("")}
    </table>
    ${weekProds.length===0?"<p style='margin-top:20px;color:#888'>No orders due this week.</p>":""}
    <p style='margin-top:20px;font-size:10px;color:#aaa'>Printed from LayerLedger · ${new Date().toLocaleDateString()}</p>
    <script>window.print()<\/script></body></html>`)
    w.document.close()
  }

  return <div>
    <SHead title="Production List" sub="Weekly work order — what needs to be baked and when"/>

    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:8}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <Btn small variant="ghost" onClick={()=>setWeekOffset(w=>w-1)}>← Prev week</Btn>
        <div style={{fontSize:13,fontWeight:500,color:"var(--text)",minWidth:200,textAlign:"center"}}>{weekLabel}</div>
        <Btn small variant="ghost" onClick={()=>setWeekOffset(w=>w+1)}>Next week →</Btn>
        {weekOffset!==0&&<Btn small variant="outline" onClick={()=>setWeekOffset(0)}>This week</Btn>}
      </div>
      <div style={{display:"flex",gap:8}}>
        <Btn small onClick={print}>📥 Print / Download</Btn>
      </div>
    </div>

    {weekProds.length===0
      ?<Card style={{textAlign:"center",padding:40}}>
          <div style={{fontSize:24,marginBottom:10}}>🎂</div>
          <div style={{fontSize:15,fontWeight:500,color:"var(--text)",marginBottom:6}}>No orders this week</div>
          <div style={{fontSize:13,color:"var(--muted)"}}>Nothing due between {fmt2(ws)} and {fmt2(we)}.</div>
        </Card>
      :<div style={{display:"flex",flexDirection:"column",gap:10}}>
        {weekProds.map((p,i)=>{
          const st=statuses[p.id]||p.status||"pending"
          const isCake=!p.productType||p.productType==="Cake"||p.productType==="Cupcakes"
          const isDonuts=p.productType==="Donuts"
          const isLoaf=p.productType==="Cake Loaf"
          const isTart=p.productType==="Tarts / Pastry"
          return <Card key={p.id} style={{borderLeft:`4px solid ${st==="ready"?"#357A52":st==="inprogress"?"#378ADD":st==="delivered"?"#888780":"var(--gold)"}`,padding:"14px 16px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,flexWrap:"wrap"}}>
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                  <span style={{fontFamily:"'Playfair Display',serif",fontSize:15,fontWeight:600,color:"var(--text)"}}>{p.client||"Unknown client"}</span>
                  <span style={{fontSize:11,background:"#F5F0E4",color:"var(--muted)",padding:"2px 8px",borderRadius:20}}>{p.productType||"Cake"}</span>
                  <span style={{fontSize:11,background:"#F5F0E4",color:"var(--muted)",padding:"2px 8px",borderRadius:20}}>Order {i+1} of {weekProds.length}</span>
                </div>

                {/* Design photo */}
                {p.cakePhoto&&<div style={{marginBottom:10}}>
                  <img src={p.cakePhoto} alt="Design" style={{maxWidth:"100%",maxHeight:180,borderRadius:8,display:"block",border:"1px solid var(--border)"}}/>
                </div>}

                {/* Cake/Cupcake details */}
                {isCake&&p.tiers?.length>0&&<div style={{marginBottom:8}}>
                  {p.tiers.map((tier,ti)=><div key={ti} style={{background:"#F5F0E4",borderRadius:8,padding:"10px 12px",marginBottom:6,fontSize:12.5}}>
                    <div style={{fontWeight:700,fontSize:13,marginBottom:6,color:"var(--text)"}}>Tier {ti+1} — {tier.size} {tier.shape}</div>
                    {tier.layers?.map((l,li)=><div key={li} style={{display:"flex",gap:8,marginBottom:3}}>
                      <span style={{color:"var(--muted)",minWidth:60,fontSize:12}}>Layer {li+1}:</span>
                      <span style={{fontWeight:500}}>{l.flavour||"—"}</span>
                    </div>)}
                    {tier.fillings?.length>0&&<div style={{marginTop:4,paddingTop:4,borderTop:"1px solid var(--border)"}}>
                      {tier.fillings.map((f,fi)=><div key={fi} style={{display:"flex",gap:8,marginBottom:3}}>
                        <span style={{color:"var(--muted)",minWidth:60,fontSize:12}}>Filling {fi+1}:</span>
                        <span style={{fontWeight:500}}>{f.type} — {f.grams}g</span>
                      </div>)}
                    </div>}
                    {tier.coverings?.length>0&&<div style={{marginTop:4,paddingTop:4,borderTop:"1px solid var(--border)"}}>
                      {tier.coverings.map((c,ci)=><div key={ci} style={{display:"flex",gap:8,marginBottom:3}}>
                        <span style={{color:"var(--muted)",minWidth:60,fontSize:12}}>Covering:</span>
                        <span style={{fontWeight:500}}>{c.type} — {c.grams}g</span>
                      </div>)}
                    </div>}
                  </div>)}
                </div>}

                {/* Donut details */}
                {isDonuts&&p.donutGroups?.length>0&&<div style={{marginBottom:8}}>
                  {p.donutGroups.map((g,gi)=><div key={gi} style={{background:"#F5F0E4",borderRadius:8,padding:"8px 10px",marginBottom:6,fontSize:12.5}}>
                    <div style={{fontWeight:600}}>{g.qty} × {g.flavour||"?"} donuts</div>
                    {g.filling&&<div style={{color:"var(--muted)"}}>Filling: {g.filling}{g.fillingGrams?" ("+g.fillingGrams+"g)":""}</div>}
                  </div>)}
                </div>}

                {/* Cake Loaf details */}
                {isLoaf&&p.loaves?.length>0&&<div style={{marginBottom:8}}>
                  {p.loaves.map((l,li)=><div key={li} style={{background:"#F5F0E4",borderRadius:8,padding:"8px 10px",marginBottom:6,fontSize:12.5}}>
                    <div style={{fontWeight:600}}>Loaf {li+1}: {l.flavour||"?"}</div>
                  </div>)}
                </div>}

                {/* Tart details */}
                {isTart&&<div style={{marginBottom:8}}>
                  <div style={{background:"#F5F0E4",borderRadius:8,padding:"8px 10px",marginBottom:6,fontSize:12.5}}>
                    <div style={{fontWeight:600}}>{p.tartQty||"?"} tart shells</div>
                    {p.tartFillings?.filter(f=>f.type).map((f,fi)=><div key={fi} style={{color:"var(--muted)"}}>Filling: {f.type}{f.grams?" ("+f.grams+"g)":""}</div>)}
                    {p.tartGarnish&&<div style={{color:"var(--muted)"}}>Garnish: {p.tartGarnish}</div>}
                  </div>
                </div>}

                {/* Fallback for old records */}
                {!p.tiers&&!p.donutGroups&&!p.loaves&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(100px,1fr))",gap:8,fontSize:12.5,marginBottom:8}}>
                  {[{l:"Size",v:p.size||"—"},{l:"Flavour",v:p.flavor||p.flavors||"—"},{l:"Covering",v:p.covering||"—"},{l:"Layers",v:p.layers||"—"}].map(f=><div key={f.l}>
                    <div style={{fontSize:10,color:"var(--muted)",textTransform:"uppercase",letterSpacing:.8,marginBottom:2}}>{f.l}</div>
                    <div style={{fontWeight:500,color:"var(--text)"}}>{f.v}</div>
                  </div>)}
                </div>}

                <div style={{display:"flex",gap:12,fontSize:12,color:"var(--muted)",flexWrap:"wrap"}}>
                  <span>📅 Delivery: <strong>{p.deliveryDate||"—"}</strong></span>
                </div>
                {p.topper?.enabled&&<div style={{marginTop:8,fontSize:12.5,background:"#EDF4FF",padding:"8px 10px",borderRadius:6,border:"1px solid #C5D8F5"}}>
                  <div style={{fontWeight:600,marginBottom:3}}>✏️ Inscription / Topper</div>
                  {p.topper.description&&<div style={{color:"var(--text)"}}>{p.topper.description}</div>}
                </div>}
                {p.notes&&<div style={{marginTop:8,fontSize:12.5,background:"#FFF9EE",padding:"8px 10px",borderRadius:6,border:"1px solid #F0E0BB"}}>
                  <div style={{fontWeight:600,marginBottom:3}}>📝 Design & special requests</div>
                  <div style={{color:"var(--text)"}}>{p.notes}</div>
                </div>}
              </div>
              <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:8,flexShrink:0}}>
                <select value={st} onChange={e=>setStatus(p.id,e.target.value)} style={{padding:"5px 10px",borderRadius:8,border:"1px solid var(--border)",background:statusColor[st]||"var(--panel)",fontSize:12,color:"var(--text)",cursor:"pointer"}}>
                  <option value="pending">Pending</option>
                  <option value="inprogress">In progress</option>
                  <option value="ready">Ready</option>
                  <option value="delivered">Delivered</option>
                </select>
                <div style={{fontSize:11,color:"var(--muted)"}}>Due {p.deliveryDate}</div>
              </div>
            </div>
          </Card>
        })}
        <div style={{padding:"10px 14px",background:"#F5F0E4",borderRadius:8,fontSize:12.5,color:"var(--muted)",display:"flex",justifyContent:"space-between"}}>
          <span>{weekProds.length} order{weekProds.length!==1?"s":""} this week</span>
          <span>Pending: {weekProds.filter(p=>!statuses[p.id]||statuses[p.id]==="pending").length} · Ready: {weekProds.filter(p=>statuses[p.id]==="ready").length}</span>
        </div>
      </div>
    }
  </div>
}

// ═══════════════════════════════════════════════════════════
//  MONTHLY OVERVIEW (replaces Reports + Stock Statement)
