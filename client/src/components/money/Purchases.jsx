/**
 * Purchases.jsx
 * ----------------------------------------------------------------------------
 * Ingredient purchases list.
 * ----------------------------------------------------------------------------
 */
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { Btn, iSt, Inp, Card, SHead, TH, TR2, Spinner } from "../common/ui.jsx"
import { fmt, uid, DEFAULT_CATEGORIES, mapCategory } from "../../lib/helpers.js"
import { saveInventory, saveExpenses, loadLocal, saveLocal } from "../../lib/data.js"

// ═══════════════════════════════════════════════════════════
export function Purchases({inventory,setInventory,expenses,setExpenses,setView,isOwner}){
  const [showForm,setShowForm]=useState(false)
  const [purchases,setPurchases]=useState(()=>loadLocal("ll_purchases",[]))
  const [f,setF]=useState({item:"",category:"",unit:"",unitSize:"",qty:"",price:"",date:new Date().toISOString().slice(0,10)})
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [deletingAll, setDeletingAll] = useState(false)

  const customCats = loadLocal("ll_custom_categories", [])
  const categoriesList = useMemo(() => {
    const invCats = inventory.map(i => mapCategory(i.cat, i.name)).filter(Boolean)
    return Array.from(new Set([...DEFAULT_CATEGORIES, ...customCats, ...invCats]))
  }, [customCats, inventory])

  useEffect(() => {
    if (f.item) {
      const it = inventory.find(i => i.id === f.item)
      if (it) {
        setF(prev => ({ ...prev, category: it.cat || mapCategory(it.cat, it.name) }))
      }
    }
  }, [f.item, inventory])


  const savePurchases=async(p)=>{setPurchases(p);await saveLocal("ll_purchases",p)}

  const cpu=f.price&&f.unitSize?parseFloat((+f.price/(+f.unitSize||1)).toFixed(2)):0
  const total=f.price&&f.qty?Math.round(+f.price*(+f.qty)):0
  const stockAdded=f.unitSize&&f.qty?parseFloat(((+f.unitSize)*(+f.qty)).toFixed(3)):0

  const selItem=inventory.find(i=>i.id===f.item)

  const log=async()=>{
    if(!f.item||!f.unitSize||!f.qty||!f.price)return alert("All fields are required")
    // 1. Update cost/unit in inventory using weighted average cost
    const updInv = inventory.map(i => {
      if (i.id === f.item) {
        const currentStock = Number(i.stock || 0);
        const currentCost = Number(i.cost || 0);
        const currentValue = currentStock * currentCost;
        const newStock = parseFloat((currentStock + stockAdded).toFixed(3));
        const newValue = currentValue + total;
        const newAvgCost = newStock > 0 ? parseFloat((newValue / newStock).toFixed(2)) : currentCost;
        return {
          ...i,
          cost: newAvgCost,
          stock: newStock,
          cat: f.category || i.cat
        };
      }
      return i;
    });
    setInventory(updInv);await saveInventory(updInv)
    // 2. Log as expense with category mapping
    let expCat = "Ingredients / Supplies"
    if (f.category === "Board and Packaging" || f.category === "Packaging") {
      expCat = "Packaging"
    } else if (f.category === "Decoration Extras" || f.category === "Decorations") {
      expCat = "Decorations"
    }
    const exp={id:uid(),date:f.date,description:`Purchase: ${selItem?.name||f.item}`,amount:total,category:expCat,paymentMethod:"transfer",source:"purchase",notes:`${f.qty}×${f.unitSize}${selItem?.unit||""} @ ₦${(+f.price).toLocaleString()} — cost/unit updated to ${fmt(cpu)}`}
    const updExp=[exp,...expenses];setExpenses(updExp);await saveExpenses(updExp)
    // 3. Log purchase record
    const rec={id:uid(),date:f.date,itemId:f.item,item:selItem?.name||"",category:f.category,unit:selItem?.unit||"",unitSize:+f.unitSize,qty:+f.qty,price:+f.price,total,cpu,stockAdded}
    await savePurchases([rec,...purchases])
    setF({item:"",category:"",unit:"",unitSize:"",qty:"",price:"",date:new Date().toISOString().slice(0,10)})
    setShowForm(false)
  }

  const filteredPurchases = useMemo(() => {
    return purchases.filter(p => p.date?.startsWith(selectedMonth))
  }, [purchases, selectedMonth])

  const monthTotal = useMemo(() => {
    return filteredPurchases.reduce((s, p) => s + (p.total || 0), 0)
  }, [filteredPurchases])

  const itemsUpdatedCount = useMemo(() => {
    return new Set(filteredPurchases.map(p => p.itemId)).size
  }, [filteredPurchases])

  const handleDeleteAll = async () => {
    if (!window.confirm("Are you sure you want to delete ALL logged purchase records? This will clear the purchase history log and remove corresponding entries in Expenses. (Inventory stock/cost levels will remain). This cannot be undone.")) return
    setDeletingAll(true)
    try {
      await savePurchases([])
      const updatedExpenses = expenses.filter(e => e.source !== "purchase")
      setExpenses(updatedExpenses)
      await saveExpenses(updatedExpenses)
    } catch (err) {
      alert("Failed to delete purchases: " + err.message)
    } finally {
      setDeletingAll(false)
    }
  }

  return <div>
    <SHead title="Purchases" sub="Log every ingredient purchase — cost per unit updates inventory automatically."/>
    <div style={{background:"#E8EFFC",border:"1px solid #B5D4F4",borderRadius:8,padding:"10px 14px",fontSize:12.5,color:"#185FA5",marginBottom:14,lineHeight:1.7}}>
      🔗 When you log a purchase here, the <strong>Cost/Unit</strong> in your Inventory and Starting Inventory updates automatically. No manual changes needed anywhere.
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:14}}>
      <Card style={{padding:"12px 14px"}}><div style={{fontSize:10,color:"var(--muted)",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Month Total</div><div style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700,color:"var(--text)"}}>{fmt(monthTotal)}</div></Card>
      <Card style={{padding:"12px 14px"}}><div style={{fontSize:10,color:"var(--muted)",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Purchases logged</div><div style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700,color:"var(--text)"}}>{filteredPurchases.length}</div></Card>
      <Card style={{padding:"12px 14px"}}><div style={{fontSize:10,color:"var(--muted)",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Items updated</div><div style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700,color:"#357A52"}}>{itemsUpdatedCount}</div></Card>
    </div>

    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,flexWrap:"wrap",gap:8}}>
      <div style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
        {setView && (
          <Btn variant="ghost" onClick={() => setView("receipts")}>
            🧾 Go to Receipt Scanner →
          </Btn>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <label style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8 }}>Month:</label>
          <input
            type="month"
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            style={{ ...iSt, width: 140, padding: "5px 8px", fontSize: 12.5, marginTop: 0 }}
          />
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {isOwner && (
          deletingAll ? (
            <Spinner />
          ) : (
            <Btn
              small
              variant="ghost"
              disabled={deletingAll}
              style={{ color: "#B03A2E", borderColor: "#F2DEDE", fontSize: "11.5px", fontWeight: "normal", padding: "4px 8px" }}
              onClick={handleDeleteAll}
            >
              🗑 Clear All Purchases
            </Btn>
          )
        )}
        <Btn onClick={()=>setShowForm(s=>!s)}>+ Log Purchase</Btn>
      </div>
    </div>

    {showForm&&<Card style={{marginBottom:14,background:"#FFF9EE",borderColor:"var(--gold)"}}>
      <div style={{fontFamily:"'Playfair Display',serif",fontSize:14,fontWeight:600,marginBottom:12}}>Log New Purchase</div>
      <div style={{display:"grid",gridTemplateColumns:"2fr 2fr 1fr 1fr 1fr 1.2fr",gap:10,marginBottom:12}}>
        <div>
          <label style={{fontSize:10,color:"var(--muted)",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:.8,fontWeight:500}}>Item *</label>
          <select value={f.item} onChange={e=>setF(p=>({...p,item:e.target.value}))} style={{...iSt}}>
            <option value="">— Select item —</option>
            {inventory.map(i=><option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
          </select>
        </div>
        <div>
          <label style={{fontSize:10,color:"var(--muted)",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:.8,fontWeight:500}}>Category *</label>
          <select value={f.category} onChange={e=>setF(p=>({...p,category:e.target.value}))} style={{...iSt}}>
            <option value="">— Select category —</option>
            {categoriesList.map(c=><option key={c} value={c}>{c}</option>)}
          </select>

        </div>
        <Inp label="Pack size *" type="number" value={f.unitSize} onChange={v=>setF(p=>({...p,unitSize:v}))} placeholder={`e.g. 50`}/>
        <Inp label="Qty bought *" type="number" value={f.qty} onChange={v=>setF(p=>({...p,qty:v}))} placeholder="e.g. 3"/>
        <Inp label="Price / pack (₦) *" type="number" value={f.price} onChange={v=>setF(p=>({...p,price:v}))} placeholder="e.g. 57000"/>
        <Inp label="Date" type="date" value={f.date} onChange={v=>setF(p=>({...p,date:v}))}/>
      </div>
      {cpu>0&&<div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:12}}>
        {[{l:"Total spent",v:fmt(total),c:"var(--text)"},{l:"Stock to add",v:`+${stockAdded} ${selItem?.unit||""}`,c:"#357A52"},{l:"New cost/unit → Inventory",v:`${fmt(cpu)}/${selItem?.unit||"unit"}`,c:"var(--gold)"}].map(s=><div key={s.l} style={{background:"var(--panel)",border:"1px solid var(--border)",borderRadius:8,padding:"10px 12px",textAlign:"center"}}><div style={{fontSize:10,color:"var(--muted)",textTransform:"uppercase",letterSpacing:.8,marginBottom:4}}>{s.l}</div><div style={{fontSize:15,fontWeight:600,color:s.c}}>{s.v}</div></div>)}
      </div>}
      <div style={{display:"flex",gap:8}}>
        <Btn variant="success" onClick={log} disabled={!f.item||!f.category||!f.unitSize||!f.qty||!f.price}>✓ Log Purchase & Update Inventory</Btn>
        <Btn variant="ghost" onClick={()=>setShowForm(false)}>Cancel</Btn>
      </div>
    </Card>}

    <Card style={{padding:0,overflowX:"auto"}}>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
        <TH cols={["Date","Item","Category","Unit","Pack size","Qty","Price/pack","Total","Cost/unit ✦","Status"]}/>
        <tbody>{filteredPurchases.length===0?<tr><td colSpan={10} style={{padding:32,textAlign:"center",color:"var(--muted)"}}>No purchases logged in this month. Click + Log Purchase to start.</td></tr>:
          filteredPurchases.map((p,i)=><TR2 key={p.id} i={i} row={[
            <span style={{color:"var(--muted)",fontSize:12}}>{p.date}</span>,
            <span style={{fontWeight:500}}>{p.item}</span>,
            <span style={{color:"var(--muted)"}}>{p.category || "—"}</span>,
            <span style={{color:"var(--muted)"}}>{p.unit}</span>,
            <span>{p.unitSize} {p.unit}</span>,
            <span>{p.qty}</span>,
            fmt(p.price),
            <span style={{fontWeight:500}}>{fmt(p.total)}</span>,
            <span style={{color:"var(--gold)",fontWeight:500}}>{fmt(p.cpu)}/{p.unit}</span>,
            <span style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:11,background:"#E8EFFC",color:"#2355A0",padding:"2px 8px",borderRadius:20,fontWeight:500}}>🔗 Updated</span>,
          ]}/>)
        }</tbody>
      </table>
    </Card>
    <div style={{marginTop:8,fontSize:11.5,color:"var(--muted)"}}>✦ Cost/unit = Price per pack ÷ Pack size. Updates inventory and starting inventory immediately.</div>
  </div>
}


// ═══════════════════════════════════════════════════════════
//  CREDIT PURCHASES / ACCOUNTS PAYABLE
