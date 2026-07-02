/**
 * Expenses.jsx
 * ----------------------------------------------------------------------------
 * Expenses ledger with month filter + inline edit.
 * ----------------------------------------------------------------------------
 */
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { Btn, Inp, Sel, Card, Badge, SHead, Tabs, TH, TR2 } from "../common/ui.jsx"
import { fmt, uid, today } from "../../lib/helpers.js"
import { EXP_CATS } from "../../constants.js"
import { saveExpenses } from "../../lib/data.js"

// ═══════════════════════════════════════════════════════════
export function Expenses({expenses,setExpenses}){
  const [tab,setTab]=useState("all");const [adding,setAdding]=useState(false)
  const [editId,setEditId]=useState(null);const [editData,setEditData]=useState({})
  const [ne,setNe]=useState({date:today(),description:"",amount:"",category:"Ingredients / Supplies",paymentMethod:"cash",notes:""})
  const [selMonth,setSelMonth]=useState(new Date().toISOString().slice(0,7))

  const saveExp=()=>{
    if(!ne.description||!ne.amount)return
    const updated=[{...ne,id:uid(),amount:+ne.amount,source:"manual"},...expenses]
    setExpenses(updated);saveExpenses(updated)
    setNe({date:today(),description:"",amount:"",category:"Ingredients / Supplies",paymentMethod:"cash",notes:""});setAdding(false)
  }
  const startEdit=(e)=>{setEditId(e.id);setEditData({...e})}
  const saveEdit=()=>{const updated=expenses.map(e=>e.id===editId?{...editData,amount:+editData.amount}:e);setExpenses(updated);saveExpenses(updated);setEditId(null)}

  const m=new Date().toISOString().slice(0,7)
  const filtered=tab==="all"?expenses:tab==="month"?expenses.filter(e=>e.date?.startsWith(selMonth)):expenses.filter(e=>e.source===tab)
  const total=filtered.reduce((s,e)=>s+(e.amount||0),0)
  const byCat={};filtered.forEach(e=>{byCat[e.category]=(byCat[e.category]||0)+(e.amount||0)})

  return <div>
    <SHead title="Expenses" sub="All business expenses — receipts, bank imports, and manual cash entries."/>
    <div style={{marginBottom:12,padding:"8px 12px",background:"#FFF9EE",borderRadius:8,fontSize:12,color:"var(--gold)",border:"1px solid #F0DFA0"}}>
      💡 <strong>How expenses flow to P&L:</strong> Ingredient costs from your recipes are already counted in COGS automatically. Use this page for overhead expenses — decorations bought, packaging, electricity, salary, delivery costs etc. These will appear in your P&L under Overhead Expenses.
    </div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:8}}>
      <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
        <Tabs tabs={[{v:"all",l:"All"},{v:"month",l:"By Month"},{v:"manual",l:"Cash"},{v:"receipt",l:"Receipts"},{v:"bank",l:"Bank"}]} active={tab} onChange={setTab}/>
        {tab==="month"&&<input type="month" value={selMonth} onChange={e=>setSelMonth(e.target.value)} style={{padding:"5px 8px",border:"1px solid var(--border)",borderRadius:7,fontSize:12,fontFamily:"inherit",background:"var(--panel)",color:"var(--text)"}}/>}
      </div>
      <Btn onClick={()=>setAdding(!adding)}>+ Add Cash Expense</Btn>
    </div>
    {adding&&<Card style={{marginBottom:14,background:"#FFF9EE",borderColor:"var(--gold)"}}>
      <div style={{fontFamily:"'Playfair Display',serif",fontSize:14,fontWeight:600,marginBottom:12}}>New Manual Expense (Cash / No Receipt)</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10}}>
        <Inp label="Date *" type="date" value={ne.date} onChange={v=>setNe(p=>({...p,date:v}))}/>
        <Inp label="Description *" value={ne.description} onChange={v=>setNe(p=>({...p,description:v}))} placeholder="e.g. Fresh fruits from market"/>
        <Inp label="Amount (₦) *" type="number" value={ne.amount} onChange={v=>setNe(p=>({...p,amount:v}))}/>
        <Sel label="Category" value={ne.category} onChange={v=>setNe(p=>({...p,category:v}))} options={EXP_CATS.map(c=>({value:c,label:c}))}/>
        <Sel label="Payment Method" value={ne.paymentMethod} onChange={v=>setNe(p=>({...p,paymentMethod:v}))} options={[{value:"cash",label:"Cash"},{value:"transfer",label:"Bank Transfer"},{value:"pos",label:"POS/Card"}]}/>
        <Inp label="Notes" value={ne.notes} onChange={v=>setNe(p=>({...p,notes:v}))} placeholder="Optional note"/>
      </div>
      <div style={{display:"flex",gap:8}}><Btn onClick={saveExp}>Save</Btn><Btn variant="ghost" onClick={()=>setAdding(false)}>Cancel</Btn></div>
    </Card>}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
      <Card style={{borderTop:"3px solid #B03A2E"}}><div style={{fontSize:10,color:"var(--muted)",textTransform:"uppercase",letterSpacing:1,marginBottom:5}}>Total Expenses</div><div style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700,color:"#B03A2E"}}>{fmt(total)}</div><div style={{fontSize:11,color:"var(--muted)",marginTop:2}}>{filtered.length} entries</div></Card>
      <Card><div style={{fontSize:10,color:"var(--muted)",textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>By Category</div>{Object.entries(byCat).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([cat,amt])=><div key={cat} style={{display:"flex",justifyContent:"space-between",marginBottom:4,fontSize:12.5}}><span>{cat}</span><span style={{fontWeight:500}}>{fmt(amt)}</span></div>)}</Card>
    </div>
    <Card style={{padding:0,overflowX:"auto"}}>
      <table style={{width:"100%",borderCollapse:"collapse"}}>
        <TH cols={["Date","Description","Category","Amount","Source",""]}/>
        <tbody>{filtered.length===0?<tr><td colSpan={6} style={{padding:32,textAlign:"center",color:"var(--muted)"}}>No expenses found.</td></tr>:
          filtered.map((e,i)=>editId===e.id
            ?<tr key={e.id} style={{background:"#FEF9EE"}}>
              <td style={{padding:"6px 8px",borderBottom:"1px solid var(--border)"}}><input type="date" value={editData.date||""} onChange={ev=>setEditData(p=>({...p,date:ev.target.value}))} style={{padding:"4px 6px",border:"1px solid var(--border)",borderRadius:5,fontSize:12,fontFamily:"inherit",width:130}}/></td>
              <td style={{padding:"6px 8px",borderBottom:"1px solid var(--border)"}}><input value={editData.description||""} onChange={ev=>setEditData(p=>({...p,description:ev.target.value}))} style={{padding:"4px 6px",border:"1px solid var(--border)",borderRadius:5,fontSize:12,fontFamily:"inherit",width:"100%",minWidth:140}}/></td>
              <td style={{padding:"6px 8px",borderBottom:"1px solid var(--border)"}}><select value={editData.category||""} onChange={ev=>setEditData(p=>({...p,category:ev.target.value}))} style={{padding:"4px 6px",border:"1px solid var(--border)",borderRadius:5,fontSize:11,fontFamily:"inherit"}}>{EXP_CATS.map(c=><option key={c}>{c}</option>)}</select></td>
              <td style={{padding:"6px 8px",borderBottom:"1px solid var(--border)"}}><input type="number" value={editData.amount||""} onChange={ev=>setEditData(p=>({...p,amount:ev.target.value}))} style={{padding:"4px 6px",border:"1px solid var(--border)",borderRadius:5,fontSize:12,fontFamily:"inherit",width:90}}/></td>
              <td style={{padding:"6px 8px",borderBottom:"1px solid var(--border)"}}><Badge color="gold">editing</Badge></td>
              <td style={{padding:"6px 8px",borderBottom:"1px solid var(--border)"}}><div style={{display:"flex",gap:4}}><Btn small variant="success" onClick={saveEdit}>✓</Btn><Btn small variant="ghost" onClick={()=>setEditId(null)}>✕</Btn></div></td>
            </tr>
            :<TR2 key={e.id} i={i} row={[
              <span style={{color:"var(--muted)",fontSize:12}}>{e.date}</span>,
              <span style={{fontWeight:500}}>{e.description}</span>,
              <Badge>{e.category}</Badge>,
              <span style={{color:"#B03A2E",fontWeight:600}}>{fmt(e.amount)}</span>,
              <Badge color={e.source==="receipt"?"blue":e.source==="bank"?"green":"gray"}>{e.source||"manual"}</Badge>,
              <div style={{display:"flex",gap:4}}><Btn small variant="ghost" onClick={()=>startEdit(e)}>Edit</Btn><Btn small variant="ghost" onClick={()=>{const u=expenses.filter(x=>x.id!==e.id);setExpenses(u);saveExpenses(u)}}>×</Btn></div>,
            ]}/>)}
        </tbody>
      </table>
    </Card>
  </div>
}

// ═══════════════════════════════════════════════════════════
//  RECORDS
