/**
 * Onboarding.jsx
 * ----------------------------------------------------------------------------
 * First-run onboarding checklist.
 * ----------------------------------------------------------------------------
 */
import React, { useState } from "react"

// ═══════════════════════════════════════════════════════════
export function Onboarding({gold,onComplete,onSkip,setView}){
  const [done,setDone]=useState(new Set())
  const pct=Math.round((done.size/4)*100)
  const [open,setOpen]=useState(1)

  const steps=[
    {id:1,title:"Add your inventory",sub:"Add all your ingredients with unit and cost per unit. Paste from Excel or add one by one.",time:"Required first",view:"masterlist",hint:"Master List → Inventory"},
    {id:2,title:"Set up your recipes",sub:"Add one recipe per flavour — Vanilla, Red Velvet, Chocolate etc. Quantities are per single layer.",time:"~5 mins",view:"masterlist",hint:"Master List → Base Recipes"},
    {id:3,title:"Set opening stock",sub:"Enter how much of each ingredient you have right now. This locks as your starting point.",time:"~2 mins",view:"settings",hint:"Settings → Opening Stock"},
    {id:4,title:"Log your first production order",sub:"Upload a cake photo, fill in the details and confirm. Watch the app calculate costs automatically.",time:"~3 mins",view:"production",hint:"New Production"},
  ]

  const markDone=(id,e)=>{
    e?.stopPropagation()
    const nd=new Set(done);nd.add(id);setDone(nd)
    if(id<4)setTimeout(()=>setOpen(id+1),300)
    else setTimeout(onComplete,500)
  }

  return <div style={{minHeight:"100vh",background:"#F4EEE4",display:"flex",alignItems:"center",justifyContent:"center",padding:16,fontFamily:"'DM Sans',sans-serif"}}>
    <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=DM+Sans:opsz,wght@9..40,400;9..40,500&display=swap');*{box-sizing:border-box}body{margin:0}:root{--gold:${gold};--bg:#F4EEE4;--panel:#FDFAF4;--text:#291608;--muted:#8C6E52;--border:#E0D3BB}`}</style>
    <div style={{width:"100%",maxWidth:500}}>
      <div style={{textAlign:"center",marginBottom:24}}>
        <div style={{fontSize:32,marginBottom:8}}>🎂</div>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:22,fontWeight:600,color:"var(--text)",marginBottom:6}}>Welcome to LayerLedger</div>
        <div style={{fontSize:13,color:"var(--muted)",lineHeight:1.7}}>Complete these 4 steps to get set up — takes about 10 minutes and you only do it once.</div>
      </div>

      <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"var(--muted)",marginBottom:5}}>
        <span>{done.size} of 4 steps complete</span><span>{pct}%</span>
      </div>
      <div style={{height:6,background:"var(--border)",borderRadius:3,overflow:"hidden",marginBottom:20}}>
        <div style={{height:"100%",width:pct+"%",background:gold,borderRadius:3,transition:"width 0.4s"}}/>
      </div>

      {steps.map(s=>{
        const isDone=done.has(s.id)
        const isOpen=open===s.id&&!isDone
        return <div key={s.id} onClick={()=>!isDone&&setOpen(s.id)} style={{background:isDone?"#F8F3EA":isOpen?"#FFF9EE":"var(--panel)",border:`1px solid ${isOpen?gold:"var(--border)"}`,borderRadius:12,padding:"14px 18px",marginBottom:10,cursor:isDone?"default":"pointer",transition:"all 0.15s"}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:32,height:32,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:600,background:isDone?"#357A52":isOpen?gold:"var(--border)",color:isDone||isOpen?"#fff":"var(--muted)",flexShrink:0}}>{isDone?"✓":s.id}</div>
            <div style={{flex:1}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{fontSize:14,fontWeight:500,color:"var(--text)",textDecoration:isDone?"line-through":""}}>{s.title}</div>
                <span style={{fontSize:10.5,color:isOpen?gold:"var(--muted)",background:isOpen?"#FDF2DC":"var(--border)",padding:"2px 8px",borderRadius:20,marginLeft:8,whiteSpace:"nowrap"}}>{s.time}</span>
              </div>
              {isOpen&&<div style={{fontSize:12.5,color:"var(--muted)",marginTop:4,lineHeight:1.6}}>{s.sub}</div>}
            </div>
          </div>
          {isOpen&&<div style={{marginTop:12,paddingTop:10,borderTop:"1px solid var(--border)",display:"flex",gap:8,flexWrap:"wrap"}}>
            <button onClick={e=>{e.stopPropagation();setView(s.view)}} style={{fontSize:12,padding:"6px 16px",borderRadius:8,border:"none",background:gold,cursor:"pointer",color:"#fff"}}>Go to {s.hint} →</button>
            <button onClick={e=>markDone(s.id,e)} style={{fontSize:12,padding:"6px 14px",borderRadius:8,border:"1px solid var(--border)",background:"transparent",cursor:"pointer",color:"var(--muted)"}}>Mark as done ✓</button>
          </div>}
        </div>
      })}

      {done.size===4&&<div style={{background:"#E8F5EE",border:"1px solid #C2E0CF",borderRadius:12,padding:20,textAlign:"center",marginTop:4}}>
        <div style={{fontSize:14,fontWeight:500,color:"#357A52",marginBottom:6}}>✓ All set! LayerLedger is ready.</div>
        <button onClick={onComplete} style={{fontSize:13,padding:"7px 22px",borderRadius:8,border:"none",background:"#357A52",cursor:"pointer",color:"#fff"}}>Go to Dashboard →</button>
      </div>}

      <div style={{textAlign:"center",marginTop:14}}>
        <span onClick={onSkip} style={{fontSize:12,color:"var(--muted)",cursor:"pointer",textDecoration:"underline"}}>Skip — I'll set up later</span>
      </div>
    </div>
  </div>
}

// ═══════════════════════════════════════════════════════════
//  PURCHASES (links cost/unit to inventory)
