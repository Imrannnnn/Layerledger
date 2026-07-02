/**
 * Dashboard.jsx
 * ----------------------------------------------------------------------------
 * Home dashboard.
 * Shows the weekly revenue/cost/profit chart, pending orders, low-stock
 * alerts and quick actions.
 * ----------------------------------------------------------------------------
 */
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { Btn, Card, Badge } from "../common/ui.jsx"
import { fmt, today } from "../../lib/helpers.js"

// ═══════════════════════════════════════════════════════════
export function Dashboard({productions,inventory,expenses,setView,user}){
  const today=new Date()
  const m=today.toISOString().slice(0,7)
  const mp=productions.filter(p=>p.deliveryDate?.startsWith(m))
  const paid=mp.filter(p=>["full","discount","deposit"].includes(p.paymentType))
  const rev=paid.reduce((s,p)=>s+(p.salePrice||0),0)
  const cost=mp.reduce((s,p)=>s+(p.cost||0)+(p.deliveryCost||0),0)
  const expTotal=expenses.filter(e=>e.date?.startsWith(m)&&e.category!=="Ingredients"&&e.source!=="purchase"&&e.source!=="receipt").reduce((s,e)=>s+(e.amount||0),0)
  const profit=rev-cost-expTotal
  const margin=rev>0?Math.round((profit/rev)*100):0
  const low=inventory.filter(i=>i.stock<=(i.minStock||5))
  const monthLabel=today.toLocaleDateString("en-NG",{month:"long",year:"numeric"})

  // Month-end notification
  const daysInMonth=new Date(today.getFullYear(),today.getMonth()+1,0).getDate()
  const dayOfMonth=today.getDate()
  const daysLeft=daysInMonth-dayOfMonth
  const isFirstOfMonth=dayOfMonth===1
  const notifDays=parseInt(localStorage.getItem("ll_notif_days")||"2")
  const notifEnabled=localStorage.getItem("ll_notif_enabled")!=="false"
  const [bannerDismissed,setBannerDismissed]=useState(false)
  const [activeWeek,setActiveWeek]=useState(null)

  // Auto-set opening stock on 1st
  const autoStockEnabled=localStorage.getItem("ll_auto_stock")!=="false"
  if(isFirstOfMonth&&autoStockEnabled&&user?.role==="owner"){
    const monthKey="ll_os_"+today.toISOString().slice(0,7)
    if(!localStorage.getItem(monthKey)){
      const snapshot={date:today.toISOString(),items:inventory.map(i=>({id:i.id,name:i.name,unit:i.unit,openingQty:i.stock,cost:i.cost}))}
      localStorage.setItem(monthKey,JSON.stringify(snapshot))
    }
  }

  const showBanner=notifEnabled&&user?.role==="owner"&&!bannerDismissed&&(daysLeft<=(+notifDays)||isFirstOfMonth)
  const dismissBanner=()=>{localStorage.setItem("ll_banner_dismissed",today.toISOString().slice(0,10));setBannerDismissed(true)}
  const prevMonth=new Date(today.getFullYear(),today.getMonth()-1,1).toLocaleDateString("en-NG",{month:"long",year:"numeric"})

  // Time-based greeting
  const hr=today.getHours()
  const greetWord=hr<12?"Good morning":hr<17?"Good afternoon":"Good evening"
  const firstName=user?.name?.split(" ")[0]||"Business"
  const quotes=["A great cake starts with great numbers.","Every slice tells a story — make yours profitable.","The secret ingredient is knowing your costs.","Beautiful cakes, beautiful books.","Bake with love, price with confidence.","Success is baked in, one order at a time.","Know your numbers, grow your bakery."]
  const quote=quotes[today.getDay()%quotes.length]

  // Weekly chart data — split productions into 4 weeks
  const weeks=["Wk 1","Wk 2","Wk 3","Wk 4"].map((label,wi)=>{
    const wProds=mp.filter(p=>{
      const d=new Date(p.deliveryDate||today)
      const wk=Math.floor((d.getDate()-1)/7)
      return wk===wi
    })
    const wPaid=wProds.filter(p=>["full","discount","deposit"].includes(p.paymentType))
    const wRev=wPaid.reduce((s,p)=>s+(p.salePrice||0),0)
    const wCost=wProds.reduce((s,p)=>s+(p.cost||0)+(p.deliveryCost||0),0)
    return {label,rev:wRev,cost:wCost,profit:Math.max(0,wRev-wCost),orders:wProds.length}
  })
  const maxVal=Math.max(...weeks.map(w=>w.rev),1)
  const chartH=120

  const quickActions=[
    {icon:"🧮",bg:"#FDF2DC",label:"Order Calculator",sub:"Build a new client quote",view:"calculator",roles:["owner","production","customer_service"]},
    {icon:"🧾",bg:"#E8EFFC",label:"Scan purchase receipt",sub:"Update stock and costs",view:"receipts",roles:["owner","production"]},
    {icon:"💸",bg:"#E1F5EE",label:"Log cash expense",sub:"Delivery, gas, salary etc.",view:"expenses",roles:["owner"]},
    {icon:"📅",bg:"#FAEEDA",label:"Production list",sub:"Orders due this week",view:"prodlist",roles:["owner","production"]},
    {icon:"📋",bg:"#F0EAFC",label:"View quotes",sub:"Manage client quotes",view:"quotes",roles:["owner","customer_service"]},
  ].filter(a=>a.roles.includes(user?.role))

  return <div>
    {/* GREETING */}
    <div style={{marginBottom:16}}>
      <div style={{fontFamily:"'Playfair Display',serif",fontSize:22,fontWeight:600,color:"var(--text)"}}>{greetWord}, {firstName}! 🎂</div>
      <div style={{fontSize:12.5,color:"var(--muted)",marginTop:3,fontStyle:"italic"}}>{quote}</div>
      <div style={{fontSize:12,color:"var(--muted)",marginTop:2}}>{monthLabel} overview</div>
    </div>

    {/* MONTH-END BANNER */}
    {showBanner&&<div style={{marginBottom:14,borderRadius:10,overflow:"hidden",border:`1px solid ${isFirstOfMonth?"#5DCAA5":daysLeft===0?"#F09595":"#FAC775"}`}}>
      <div style={{background:isFirstOfMonth?"#E1F5EE":daysLeft===0?"#FCEBEB":"#FFF9EE",padding:"11px 16px",display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,flexWrap:"wrap"}}>
        <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
          <div style={{width:14,height:14,borderRadius:"50%",background:isFirstOfMonth?"#0F6E56":daysLeft===0?"#A32D2D":"#BA7517",flexShrink:0,marginTop:3}}/>
          <div>
            <div style={{fontSize:13,fontWeight:500,color:isFirstOfMonth?"#085041":daysLeft===0?"#501313":"#633806"}}>
              {isFirstOfMonth?`New month started — ${monthLabel}`:daysLeft===0?"Today is the last day of the month":`Month closing in ${daysLeft} day${daysLeft!==1?"s":""}`}
            </div>
            <div style={{fontSize:12,color:isFirstOfMonth?"#0F6E56":daysLeft===0?"#791F1F":"#854F0B",marginTop:3,lineHeight:1.6}}>
              {isFirstOfMonth?"Opening stock set automatically from last month. Your "+prevMonth+" overview is ready to download.":daysLeft===0?"Lock your closing stock today — midnight auto-sets next month's opening stock.":"Review your monthly overview and lock closing stock before the 1st."}
            </div>
          </div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center",flexShrink:0,flexWrap:"wrap"}}>
          {isFirstOfMonth
            ?<Btn small onClick={()=>setView("monthly")}>Download {prevMonth} overview</Btn>
            :<><Btn small onClick={()=>setView("monthly")}>View monthly overview</Btn><Btn small variant="ghost" onClick={()=>setView("settings")}>Lock closing stock</Btn></>}
          <span onClick={dismissBanner} style={{fontSize:11,color:"var(--muted)",cursor:"pointer",textDecoration:"underline"}}>Dismiss</span>
        </div>
      </div>
    </div>}

    {/* SUMMARY CARDS */}
    {user?.role==="owner"&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10,marginBottom:14}}>
      {[
        {label:"Revenue",val:fmt(rev),sub:`${paid.length} paid orders`,c:"var(--gold)"},
        {label:"Prod. cost",val:fmt(cost),sub:"incl. delivery",c:"#378ADD"},
        {label:"Overheads",val:fmt(expTotal),sub:"other costs",c:"#888780"},
        {label:"Net profit",val:fmt(profit),sub:`${margin}% margin`,c:profit>=0?"#357A52":"#B03A2E"},
      ].map(s=><Card key={s.label} style={{borderTop:`3px solid ${s.c}`,borderRadius:"0 0 12px 12px",padding:"12px 14px"}}>
        <div style={{fontSize:10,color:"var(--muted)",textTransform:"uppercase",letterSpacing:1,marginBottom:5}}>{s.label}</div>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700,color:s.label==="Net profit"?s.c:"var(--text)"}}>{s.val}</div>
        <div style={{fontSize:11,color:"var(--muted)",marginTop:2}}>{s.sub}</div>
      </Card>)}
    </div>}

    {/* CHART */}
    {user?.role==="owner"&&<Card style={{marginBottom:14,padding:"14px 18px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,flexWrap:"wrap",gap:8}}>
        <div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:14,fontWeight:600}}>Monthly performance</div>
          <div style={{fontSize:11,color:"var(--muted)",marginTop:2}}>Weekly breakdown — tap a bar for details</div>
        </div>
        <div style={{display:"flex",gap:12}}>
          {[["var(--gold)","Revenue"],["#378ADD","Cost"],["#1D9E75","Profit"]].map(([c,l])=><div key={l} style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:10,height:10,borderRadius:2,background:c}}/><span style={{fontSize:11,color:"var(--muted)"}}>{l}</span></div>)}
        </div>
      </div>
      <div style={{position:"relative",height:chartH+"px",marginBottom:4}}>
        {[1,0.75,0.5,0.25].map(r=><div key={r} style={{position:"absolute",top:(1-r)*chartH,left:0,right:0,borderTop:"0.5px solid var(--border)",pointerEvents:"none"}}>
          <span style={{position:"absolute",right:0,top:-9,fontSize:10,color:"var(--muted)"}}>{fmt(maxVal*r)}</span>
        </div>)}
        <div style={{display:"flex",gap:6,height:"100%",alignItems:"flex-end",paddingRight:36}}>
          {weeks.map((w,wi)=><div key={wi} onClick={()=>setActiveWeek(activeWeek===wi?null:wi)} style={{flex:1,display:"flex",gap:2,alignItems:"flex-end",height:"100%",cursor:"pointer"}}>
            {[[w.rev,"var(--gold)"],[w.cost,"#378ADD"],[w.profit,"#1D9E75"]].map(([val,col],bi)=><div key={bi} style={{flex:1,height:Math.round((val/maxVal)*chartH)+"px",background:col,borderRadius:"3px 3px 0 0",opacity:activeWeek===wi?1:0.85,transition:"opacity 0.15s"}}/>)}
          </div>)}
        </div>
      </div>
      <div style={{display:"flex",gap:6,paddingRight:36,marginBottom:8}}>
        {weeks.map((w,wi)=><div key={wi} style={{flex:1,textAlign:"center",fontSize:10,color:"var(--muted)",cursor:"pointer",fontWeight:activeWeek===wi?600:400}} onClick={()=>setActiveWeek(activeWeek===wi?null:wi)}>{w.label}</div>)}
      </div>
      {activeWeek!==null&&<div style={{background:"#F5F0E4",borderRadius:8,padding:"8px 12px",fontSize:12.5,color:"var(--text)",marginBottom:10}}>
        <strong>{weeks[activeWeek].label}</strong> — Revenue: {fmt(weeks[activeWeek].rev)} · Cost: {fmt(weeks[activeWeek].cost)} · Profit: {fmt(weeks[activeWeek].profit)} · {weeks[activeWeek].orders} order{weeks[activeWeek].orders!==1?"s":""}
      </div>}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,paddingTop:10,borderTop:"1px solid var(--border)"}}>
        {[
          {l:"Best week",v:weeks.reduce((a,b)=>a.rev>b.rev?a:b).label},
          {l:"Avg margin",v:margin+"%",c:margin>=40?"#357A52":"#B03A2E"},
          {l:"Orders",v:mp.length+" cakes"},
          {l:"Profit trend",v:profit>=0?"↑ Positive":"↓ Negative",c:profit>=0?"#357A52":"#B03A2E"},
        ].map(s=><div key={s.l} style={{textAlign:"center"}}>
          <div style={{fontSize:10,color:"var(--muted)",textTransform:"uppercase",letterSpacing:.8,marginBottom:3}}>{s.l}</div>
          <div style={{fontSize:13,fontWeight:500,color:s.c||"var(--text)"}}>{s.v}</div>
        </div>)}
      </div>
    </Card>}

    {/* BOTTOM ROW */}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <Card>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:14,fontWeight:600,marginBottom:8}}>Pending orders</div>
          {(()=>{
            const cutoff=new Date();cutoff.setDate(cutoff.getDate()-3)
            const cutoffStr=cutoff.toISOString().slice(0,10)
            const pending=productions.filter(p=>{
              const s=(p.status||"").toLowerCase()
              if(["delivered","completed","done","full","paid"].includes(s))return false
              if(p.deliveryDate&&p.deliveryDate<cutoffStr)return false
              return true
            })
            return pending.length===0
              ?<div style={{fontSize:13,color:"var(--muted)"}}>No pending orders right now.</div>
              :pending.slice(0,6).map(p=><div key={p.id} onClick={()=>setView("prodlist")} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid var(--border)",cursor:"pointer"}}>
                <div>
                  <div style={{fontSize:13,fontWeight:500,color:"var(--gold)"}}>{p.client||"Client"}</div>
                  <div style={{fontSize:11.5,color:"var(--muted)"}}>Due {p.deliveryDate||"—"}</div>
                </div>
                <Badge color={{pending:"gold","in progress":"blue",ready:"green"}[(p.status||"pending").toLowerCase()]||"gray"}>{p.status||"pending"}</Badge>
              </div>)
          })()}
          <div style={{marginTop:10}}><Btn small variant="outline" onClick={()=>setView("prodlist")}>View production list →</Btn></div>
        </Card>

        {low.length>0&&<Card style={{background:"#FFF9EE",borderColor:"var(--gold)"}}>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:14,fontWeight:600,marginBottom:8}}>⚠ {low.length} item{low.length!==1?"s":""} low on stock</div>
          {low.slice(0,4).map(i=><div key={i.id} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid var(--border)"}}>
            <span style={{fontSize:12.5}}>{i.name}</span>
            <Badge color={i.stock===0?"red":"gold"}>{i.stock} {i.unit}</Badge>
          </div>)}
          <div style={{marginTop:8}}><Btn small variant="outline" onClick={()=>setView("shopping")}>Generate shopping list →</Btn></div>
        </Card>}
      </div>

      <Card>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:14,fontWeight:600,marginBottom:12}}>Quick actions</div>
        {quickActions.map(a=><div key={a.view} onClick={()=>setView(a.view)} style={{display:"flex",alignItems:"center",gap:12,padding:"9px 8px",borderRadius:8,cursor:"pointer",marginBottom:2}} onMouseEnter={e=>e.currentTarget.style.background="#F0E9DB"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
          <div style={{width:34,height:34,borderRadius:8,background:a.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>{a.icon}</div>
          <div><div style={{fontSize:13,color:"var(--text)"}}>{a.label}</div><div style={{fontSize:11,color:"var(--muted)",marginTop:1}}>{a.sub}</div></div>
        </div>)}
      </Card>
    </div>
  </div>
}

// ═══════════════════════════════════════════════════════════
//  INVENTORY TAB — bulk price model with AI smart import
