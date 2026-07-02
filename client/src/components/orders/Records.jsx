/**
 * Records.jsx
 * ----------------------------------------------------------------------------
 * Order records list with status updates.
 * ----------------------------------------------------------------------------
 */
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { Btn, Card, Badge, SHead, Tabs, TH, TR2 } from "../common/ui.jsx"
import { fmt } from "../../lib/helpers.js"
import { updateProdStatus } from "../../lib/data.js"

// ═══════════════════════════════════════════════════════════
export function Records({productions,setProductions,setView,setPrefillProd,user}){
  const [filter,setFilter]=useState("all")
  const filtered=filter==="all"?productions:filter==="pending"||filter==="delivered"?productions.filter(p=>p.status===filter):productions.filter(p=>p.paymentType===filter)
  const isOwner=user?.role==="owner"

  return <div>
    <SHead title="Production Records" sub={`${productions.length} total entries`}/>
    <Tabs tabs={[{v:"all",l:"All"},{v:"pending",l:"Pending"},{v:"delivered",l:"Delivered"},{v:"gift",l:"Gifts"},{v:"sample",l:"Samples"}]} active={filter} onChange={setFilter}/>
    <Card style={{padding:0,overflowX:"auto"}}>
      <table style={{width:"100%",borderCollapse:"collapse"}}>
        <TH cols={["Date","Cake","Flavours","Client",isOwner?"Cost":"","Delivery",isOwner?"Sale":"","Type","Status",""]}/>
        <tbody>{filtered.length===0?<tr><td colSpan={10} style={{padding:32,textAlign:"center",color:"var(--muted)"}}>No records found.</td></tr>:
          filtered.map((p,i)=><TR2 key={p.id} i={i} row={[
            <span style={{color:"var(--muted)",fontSize:12}}>{p.deliveryDate}</span>,
            <span style={{fontWeight:500,fontSize:12.5}}>{p.size} · {p.covering}</span>,
            <span style={{color:"var(--muted)",fontSize:12}}>{p.flavors}</span>,
            <span style={{fontSize:12.5}}>{p.client}</span>,
            isOwner?fmt(p.cost):"",
            <span style={{fontSize:12}}>{p.deliveryCost?fmt(p.deliveryCost):"—"}</span>,
            isOwner?<span style={{color:"var(--gold)",fontWeight:600}}>{fmt(p.salePrice)}</span>:"",
            <Badge color={{full:"green",gift:"purple",sample:"blue",discount:"gold",deposit:"blue"}[p.paymentType]||"gray"}>{p.paymentType}</Badge>,
            <Badge color={p.status==="delivered"?"green":"gold"}>{p.status}</Badge>,
            <div style={{display:"flex",gap:4}}>
              {p.status==="pending"&&<Btn small variant="outline" onClick={async()=>{setProductions(pr=>pr.map(x=>x.id===p.id?{...x,status:"delivered"}:x));await updateProdStatus(p.id,"delivered")}}>✓ Done</Btn>}
            </div>,
          ]}/>)}
        </tbody>
      </table>
    </Card>
    {isOwner&&filtered.length>0&&<div style={{marginTop:12,padding:"10px 12px",background:"var(--panel)",borderRadius:8,border:"1px solid var(--border)",display:"flex",gap:20,flexWrap:"wrap"}}>
      <span style={{fontSize:13,color:"var(--muted)"}}>Revenue: <strong style={{color:"var(--gold)"}}>{fmt(filtered.filter(p=>p.paymentType!=="gift"&&p.paymentType!=="sample").reduce((s,p)=>s+(p.salePrice||0),0))}</strong></span>
      <span style={{fontSize:13,color:"var(--muted)"}}>Cost: <strong>{fmt(filtered.reduce((s,p)=>s+(p.cost||0)+(p.deliveryCost||0),0))}</strong></span>
      <span style={{fontSize:13,color:"var(--muted)"}}>Profit: <strong style={{color:"#357A52"}}>{fmt(filtered.filter(p=>p.paymentType!=="gift"&&p.paymentType!=="sample").reduce((s,p)=>s+(p.salePrice||0)-(p.cost||0)-(p.deliveryCost||0),0))}</strong></span>
    </div>}
  </div>
}

// ═══════════════════════════════════════════════════════════
//  BANK IMPORT — supports PDF upload
