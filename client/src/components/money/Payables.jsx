/**
 * Payables.jsx
 * ----------------------------------------------------------------------------
 * Credit purchases / accounts payable.
 * Track money owed to suppliers and record payments.
 * ----------------------------------------------------------------------------
 */
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { Btn, iSt, Card, Badge, SHead, TH, TR2 } from "../common/ui.jsx"
import { fmt, uid, today } from "../../lib/helpers.js"
import { saveInventory, saveLocal } from "../../lib/data.js"

// ═══════════════════════════════════════════════════════════
export function Payables({inventory,setInventory}){
  const [bills,setBills]=useState(()=>{try{return JSON.parse(localStorage.getItem("ll_payables")||"[]")}catch{return[]}})
  const [showForm,setShowForm]=useState(false)
  const [f,setF]=useState({supplier:"",description:"",amount:"",date:today(),dueDate:"",addToInventory:false,invId:"",qty:"",unitSize:""})

  const save=async (b)=>{setBills(b);await saveLocal("ll_payables",b)}

  const totalOwed=bills.reduce((s,b)=>s+(b.amount-(b.paid||0)),0)
  const openBills=bills.filter(b=>(b.amount-(b.paid||0))>0).length
  const today_=new Date().toISOString().slice(0,10)
  const overdue=bills.filter(b=>b.dueDate&&b.dueDate<today_&&(b.amount-(b.paid||0))>0).reduce((s,b)=>s+(b.amount-(b.paid||0)),0)

  const addBill=()=>{
    if(!f.supplier||!f.amount){alert("Supplier and amount are required");return}
    const bill={id:uid(),supplier:f.supplier,description:f.description,amount:+f.amount,paid:0,date:f.date,dueDate:f.dueDate,addedToInventory:f.addToInventory,invId:f.invId}
    save([bill,...bills])
    if(f.addToInventory&&f.invId&&f.qty&&f.unitSize){
      const stockAdd=(+f.qty)*(+f.unitSize)
      const cpu=+f.amount/Math.max(1,stockAdd)
      const updInv=inventory.map(i=>i.id===f.invId?{...i,stock:parseFloat((i.stock+stockAdd).toFixed(3)),cost:parseFloat(cpu.toFixed(2))}:i)
      setInventory(updInv);saveInventory(updInv)
    }
    setF({supplier:"",description:"",amount:"",date:today(),dueDate:"",addToInventory:false,invId:"",qty:"",unitSize:""})
    setShowForm(false)
  }

  const payBill=(id)=>{
    const bill=bills.find(b=>b.id===id)
    const owing=bill.amount-(bill.paid||0)
    const pay=prompt("How much are you paying "+bill.supplier+"?\nOwing: "+fmt(owing),owing)
    if(pay===null)return
    const amt=Math.min(+pay,owing)
    if(amt<=0)return
    save(bills.map(b=>b.id===id?{...b,paid:(b.paid||0)+amt,lastPaid:today()}:b))
    try{
      const pays=JSON.parse(localStorage.getItem("ll_ap_payments")||"[]")
      pays.push({id:uid(),billId:id,supplier:bill.supplier,amount:amt,date:today()})
      saveLocal("ll_ap_payments",pays)
    }catch(e){}
  }

  const delBill=(id)=>{if(confirm("Delete this bill?"))save(bills.filter(b=>b.id!==id))}

  const iSt={width:"100%",padding:"9px 11px",border:"1px solid var(--border)",borderRadius:7,fontSize:13,fontFamily:"inherit",background:"var(--panel)",color:"var(--text)",marginTop:4,outline:"none"}

  return <div>
    <SHead title="Credit Purchases" sub="Track what you owe suppliers — buy now, pay later"/>
    <div style={{background:"#FEF9EE",border:"1px solid var(--gold)",borderRadius:8,padding:"11px 14px",fontSize:12.5,color:"#7A5500",lineHeight:1.7,marginBottom:14}}>
      💡 A credit purchase records goods you've taken now but will pay for later. It adds to what you owe (Accounts Payable). When you pay, the debt and your cash both go down — the cost only hits your P&L through COGS when you sell the cake.
    </div>

    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:16}}>
      <Card style={{textAlign:"center",padding:"13px 15px"}}><div style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700,color:"#B03A2E"}}>{fmt(totalOwed)}</div><div style={{fontSize:10,color:"var(--muted)",textTransform:"uppercase",letterSpacing:.7,marginTop:3}}>Total Owed</div></Card>
      <Card style={{textAlign:"center",padding:"13px 15px"}}><div style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700}}>{openBills}</div><div style={{fontSize:10,color:"var(--muted)",textTransform:"uppercase",letterSpacing:.7,marginTop:3}}>Open Bills</div></Card>
      <Card style={{textAlign:"center",padding:"13px 15px"}}><div style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700,color:overdue>0?"#B03A2E":"var(--text)"}}>{fmt(overdue)}</div><div style={{fontSize:10,color:"var(--muted)",textTransform:"uppercase",letterSpacing:.7,marginTop:3}}>Overdue</div></Card>
    </div>

    <div style={{display:"flex",justifyContent:"flex-end",marginBottom:12}}>
      <Btn onClick={()=>setShowForm(!showForm)}>+ Record Credit Purchase</Btn>
    </div>

    {showForm&&<Card style={{marginBottom:14,background:"#FFF9EE",borderColor:"var(--gold)"}}>
      <div style={{fontFamily:"'Playfair Display',serif",fontSize:14,fontWeight:600,marginBottom:12}}>New Credit Purchase</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
        <div><label style={{fontSize:10,color:"var(--muted)",textTransform:"uppercase",letterSpacing:.7,fontWeight:600}}>Supplier *</label><input value={f.supplier} onChange={e=>setF(p=>({...p,supplier:e.target.value}))} placeholder="e.g. Delyon Cakes" style={iSt}/></div>
        <div><label style={{fontSize:10,color:"var(--muted)",textTransform:"uppercase",letterSpacing:.7,fontWeight:600}}>Date</label><input type="date" value={f.date} onChange={e=>setF(p=>({...p,date:e.target.value}))} style={iSt}/></div>
      </div>
      <div style={{marginBottom:10}}><label style={{fontSize:10,color:"var(--muted)",textTransform:"uppercase",letterSpacing:.7,fontWeight:600}}>What you bought</label><input value={f.description} onChange={e=>setF(p=>({...p,description:e.target.value}))} placeholder="e.g. Flour, sugar, cocoa" style={iSt}/></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
        <div><label style={{fontSize:10,color:"var(--muted)",textTransform:"uppercase",letterSpacing:.7,fontWeight:600}}>Total amount (₦) *</label><input type="number" value={f.amount} onChange={e=>setF(p=>({...p,amount:e.target.value}))} placeholder="106800" style={iSt}/></div>
        <div><label style={{fontSize:10,color:"var(--muted)",textTransform:"uppercase",letterSpacing:.7,fontWeight:600}}>Due date</label><input type="date" value={f.dueDate} onChange={e=>setF(p=>({...p,dueDate:e.target.value}))} style={iSt}/></div>
      </div>
      <label style={{display:"flex",alignItems:"center",gap:8,fontSize:13,cursor:"pointer",padding:"8px 0"}}>
        <input type="checkbox" checked={f.addToInventory} onChange={e=>setF(p=>({...p,addToInventory:e.target.checked}))}/>
        Add these goods to inventory now
      </label>
      {f.addToInventory&&<div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr",gap:8,marginBottom:10,padding:10,background:"var(--bg)",borderRadius:8}}>
        <div><label style={{fontSize:10,color:"var(--muted)"}}>Item</label><select value={f.invId} onChange={e=>setF(p=>({...p,invId:e.target.value}))} style={iSt}><option value="">— Select —</option>{inventory.map(i=><option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}</select></div>
        <div><label style={{fontSize:10,color:"var(--muted)"}}>Packs</label><input type="number" value={f.qty} onChange={e=>setF(p=>({...p,qty:e.target.value}))} style={iSt}/></div>
        <div><label style={{fontSize:10,color:"var(--muted)"}}>Pack size</label><input type="number" value={f.unitSize} onChange={e=>setF(p=>({...p,unitSize:e.target.value}))} style={iSt}/></div>
      </div>}
      <div style={{display:"flex",gap:8}}>
        <Btn variant="success" onClick={addBill}>✓ Record Bill</Btn>
        <Btn variant="ghost" onClick={()=>setShowForm(false)}>Cancel</Btn>
      </div>
    </Card>}

    <Card style={{padding:0,overflowX:"auto"}}>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
        <TH cols={["Date","Supplier","For","Amount","Owing","Status",""]}/>
        <tbody>{bills.length===0?<tr><td colSpan={7} style={{padding:32,textAlign:"center",color:"var(--muted)"}}>No credit purchases yet. Record one above when you take goods on credit.</td></tr>:
          bills.map((b,i)=>{
            const owing=b.amount-(b.paid||0)
            const isOverdue=b.dueDate&&b.dueDate<today_&&owing>0
            const status=owing<=0?"paid":b.paid>0?"part":isOverdue?"overdue":"unpaid"
            const statusLabel={paid:"Paid ✓",part:"Part-paid",overdue:"Overdue",unpaid:"Unpaid"}[status]
            const statusColor={paid:"green",part:"gold",overdue:"red",unpaid:"red"}[status]
            return <TR2 key={b.id} i={i} row={[
              <span style={{color:"var(--muted)",fontSize:12}}>{b.date}</span>,
              <span style={{fontWeight:600}}>{b.supplier}</span>,
              <span style={{fontSize:12.5}}>{b.description||"—"}</span>,
              <span>{fmt(b.amount)}</span>,
              <span style={{fontWeight:600,color:owing>0?"#B03A2E":"var(--muted)"}}>{fmt(owing)}</span>,
              owing>0?<span onClick={()=>payBill(b.id)} style={{cursor:"pointer"}}><Badge color={statusColor}>{statusLabel}</Badge></span>:<Badge color="green">{statusLabel}</Badge>,
              <Btn small variant="ghost" onClick={()=>delBill(b.id)}>×</Btn>,
            ]}/>
          })
        }</tbody>
      </table>
    </Card>
    <div style={{fontSize:11.5,color:"var(--muted)",marginTop:8}}>Tap a status pill to record a payment. Payments reduce both the debt and your cash balance.</div>
  </div>
}

// ═══════════════════════════════════════════════════════════
//  BALANCE SHEET
