/**
 * MasterList.jsx
 * ----------------------------------------------------------------------------
 * Master List screen: inventory, recipes, decorations, packaging.
 * MasterList is the container with tabs; the others are its tab panels.
 * RecipeCard also exposes the Duplicate-recipe action.
 * ----------------------------------------------------------------------------
 */
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { Btn, iSt, Inp, Sel, Card, SHead, Tabs, TH, Modal, Alert } from "../common/ui.jsx"
import { fmt, uid, recipeCost, parseCSV, callClaude, compressImage } from "../../lib/helpers.js"
import { DECORATION_ITEMS, DEFAULT_MULTS } from "../../constants.js"
import { saveInventory, saveRecipes, saveLocal, loadLocal } from "../../lib/data.js"


export function RestockCell({id,unit,onRestock}){
  const [qty,setQty]=useState("")
  return <div style={{display:"flex",gap:4,alignItems:"center"}}>
    <input type="number" placeholder="qty" value={qty} onChange={e=>setQty(e.target.value)} style={{...iSt,width:55,padding:"4px 6px",fontSize:12}}/>
    <Btn small variant="outline" onClick={()=>{onRestock(id,qty);setQty("")}}>+</Btn>
  </div>
}

// ═══════════════════════════════════════════════════════════
//  NEW PRODUCTION (AI reads photo → fills details)

// ═══════════════════════════════════════════════════════════
export function RecipeCard({r, inventory, isOwner, onEdit, onDelete, onDuplicate}){
  const [open,setOpen]=useState(false)
  const [size,setSize]=useState("6")
  const [shape,setShape]=useState("round")
  const [layers,setLayers]=useState("1")
  const [batchCount,setBatchCount]=useState("1")

  const isPastry=r.type==="pastry"
  const isCovering=r.type==="covering" || r.type==="filling"

  // Load multipliers from localStorage (set in Settings → Pricing setup)
  const getMult=()=>{
    try{
      const all=JSON.parse(localStorage.getItem("ll_multipliers")||"null")||DEFAULT_MULTS
      const key=size.replace(" inch","").replace('"','').trim()+"-"+shape.toLowerCase()
      return all[key]||null
    }catch{return null}
  }
  const mult=getMult()
  const factor=(mult||1)*(+layers||1)
  const cleanNote=(r.notes||"").replace(/\s*—\s*quantities for 1 layer/gi,"").replace(/\s*-\s*quantities for 1 layer/gi,"").trim()

  const batchCostTotal=r.ing.reduce((s,ing)=>{const it=inventory.find(x=>x.id===ing.iid);return s+(it?it.cost*ing.qty:0)},0)
  const costPerPiece=r.batchSize>0?batchCostTotal/r.batchSize:0

  return <Card style={{marginBottom:10}} >
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer"}} onClick={()=>setOpen(o=>!o)}>
      <div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{fontWeight:600,fontSize:15}}>{r.name}</div>
          {isCovering&&<span style={{fontSize:10,background:"#E8EFFC",color:"#2355A0",padding:"2px 7px",borderRadius:20,fontWeight:500}}>Covering/Filling</span>}
          {isPastry&&<span style={{fontSize:10,background:"#FAEEDA",color:"#8C5E00",padding:"2px 7px",borderRadius:20,fontWeight:500}}>Pastry · {r.batchSize||"?"} pcs/batch</span>}
        </div>
        {cleanNote&&<div style={{fontSize:11.5,color:"var(--muted)",marginTop:2}}>{cleanNote}</div>}
      </div>
      <div style={{display:"flex",gap:6,alignItems:"center"}}>
        {isOwner&&<div style={{display:"flex",gap:4}} onClick={e=>e.stopPropagation()}>
          <Btn small variant="ghost" onClick={onEdit}>✎ Edit</Btn>
          {onDuplicate&&<Btn small variant="ghost" onClick={onDuplicate}>⧉ Duplicate</Btn>}
          <Btn small variant="danger" onClick={onDelete}>×</Btn>
        </div>}
        <span style={{color:"var(--muted)",fontSize:16,marginLeft:4}}>{open?"▴":"▾"}</span>
      </div>
    </div>

    {open&&<div style={{marginTop:14,borderTop:"1px solid var(--border)",paddingTop:14}} onClick={e=>e.stopPropagation()}>
      <div style={{display:"grid",gridTemplateColumns:"1.2fr 0.8fr",gap:20}}>

        {/* LEFT — ingredient table */}
        <div>
          <div style={{fontSize:10.5,color:"var(--muted)",textTransform:"uppercase",letterSpacing:0.8,marginBottom:10}}>
            {isPastry
              ?`Ingredients — ${batchCount} batch${+batchCount>1?"es":""} (${(+batchCount*(r.batchSize||0))} pieces)`
              :isCovering
              ?`Ingredients — 1 full batch`
              :`Ingredients — ${size}" · ${shape} · ${layers} layer${+layers>1?"s":""}`}
            {!isPastry&&!isCovering&&mult===null&&<span style={{color:"#B03A2E",marginLeft:6}}>(set multiplier to see scaled qty)</span>}
          </div>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr>
              {["Ingredient","Qty needed","Unit cost","Line cost"].map(h=><th key={h} style={{textAlign:h==="Ingredient"?"left":"right",fontSize:10,color:"var(--muted)",textTransform:"uppercase",letterSpacing:0.8,paddingBottom:6,fontWeight:500}}>{h}</th>)}
            </tr></thead>
            <tbody>
              {r.ing.map(ing=>{
                const it=inventory.find(x=>x.id===ing.iid)
                if(!it)return null
                const scaleFactor=isPastry?+batchCount:isCovering?1:mult!==null?factor:1
                const rawQty=ing.qty*scaleFactor
                const scaledQty=parseFloat(rawQty.toFixed(3))
                const lineCost=it.cost*rawQty
                return <tr key={ing.iid} style={{borderBottom:"1px solid var(--border)"}}>
                  <td style={{padding:"5px 0",fontSize:13}}>{it.name}</td>
                  <td style={{textAlign:"right",fontSize:12,color:"var(--text)",fontWeight:500}}>{scaledQty} {it.unit}</td>
                  <td style={{textAlign:"right",fontSize:12,color:"var(--muted)"}}>{fmt(it.cost)}/{it.unit}</td>
                  <td style={{textAlign:"right",fontSize:13,fontWeight:500}}>{fmt(lineCost)}</td>
                </tr>
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} style={{textAlign:"right",fontSize:12,color:"var(--muted)",paddingTop:8,borderTop:"1px solid var(--border)"}}>Total ingredient cost</td>
                <td style={{textAlign:"right",fontWeight:700,color:"var(--gold)",fontSize:16,paddingTop:8,borderTop:"1px solid var(--border)"}}>{fmt(batchCostTotal*(isPastry?+batchCount:isCovering?1:mult!==null?factor:1))}</td>
              </tr>
              {isPastry&&r.batchSize>0&&<tr>
                <td colSpan={3} style={{textAlign:"right",fontSize:12,color:"var(--muted)",paddingTop:4}}>Cost per piece</td>
                <td style={{textAlign:"right",fontWeight:600,color:"var(--gold)",fontSize:14,paddingTop:4}}>{fmt(costPerPiece)}</td>
              </tr>}
            </tfoot>
          </table>
          <div style={{marginTop:10,fontSize:11.5,color:"var(--muted)",background:"#F5F0E4",borderRadius:7,padding:"7px 10px"}}>
            Boxes, boards and delivery are added at production entry — not here.
          </div>
        </div>

        {/* RIGHT — calculator */}
        <div>
          <div style={{fontSize:10.5,color:"var(--muted)",textTransform:"uppercase",letterSpacing:0.8,marginBottom:10}}>Recipe calculator</div>
          <div style={{background:"#F5F0E4",borderRadius:10,padding:14,display:"flex",flexDirection:"column",gap:10}}>

            {isPastry?<>
              <div>
                <label style={{fontSize:10.5,color:"var(--muted)",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:0.8,fontWeight:500}}>Number of batches</label>
                <select value={batchCount} onChange={e=>setBatchCount(e.target.value)} style={{width:"100%",padding:"7px 10px",borderRadius:8,border:"1px solid var(--border)",background:"var(--panel)",color:"var(--text)",fontSize:13}}>
                  {["1","2","3","4","5","6","7","8","9","10"].map(n=><option key={n} value={n}>{n} batch{+n>1?"es":""} ({+n*(r.batchSize||0)} pcs)</option>)}
                </select>
              </div>
              <div style={{background:"var(--panel)",border:"1px solid var(--border)",borderRadius:8,padding:"10px 12px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:4}}>
                  <span style={{fontSize:12,color:"var(--muted)"}}>Batch cost</span>
                  <span style={{fontSize:18,fontWeight:700,color:"var(--gold)"}}>{fmt(batchCostTotal*+batchCount)}</span>
                </div>
                {r.batchSize>0&&<div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
                  <span style={{fontSize:12,color:"var(--muted)"}}>Per piece</span>
                  <span style={{fontSize:14,fontWeight:600,color:"var(--gold)"}}>{fmt(costPerPiece)}</span>
                </div>}
              </div>
            </>:isCovering?<>
              <div style={{background:"var(--panel)",border:"1px solid var(--border)",borderRadius:8,padding:"12px 14px"}}>
                <div style={{fontSize:11,color:"var(--muted)",marginBottom:8,textTransform:"uppercase",letterSpacing:0.8,fontWeight:500}}>Batch summary</div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:6}}>
                  <span style={{fontSize:12,color:"var(--muted)"}}>Total batch cost</span>
                  <span style={{fontSize:20,fontWeight:700,color:"var(--gold)"}}>{fmt(batchCostTotal)}</span>
                </div>
                {r.batchWeight>0&&<>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:4}}>
                    <span style={{fontSize:12,color:"var(--muted)"}}>Batch weight</span>
                    <span style={{fontSize:13,fontWeight:500}}>{r.batchWeight}g</span>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",paddingTop:6,borderTop:"1px solid var(--border)"}}>
                    <span style={{fontSize:12,color:"var(--muted)"}}>Cost per gram</span>
                    <span style={{fontSize:14,fontWeight:700,color:"var(--gold)"}}>{fmt(batchCostTotal/r.batchWeight)}/g</span>
                  </div>
                </>}
                {!r.batchWeight&&<div style={{fontSize:11.5,color:"#B03A2E",marginTop:4}}>Add batch weight in Edit to see cost per gram</div>}
              </div>
            </>:<>
              <div>
                <label style={{fontSize:10.5,color:"var(--muted)",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:0.8,fontWeight:500}}>Size</label>
                <select value={size} onChange={e=>setSize(e.target.value)} style={{width:"100%",padding:"7px 10px",borderRadius:8,border:"1px solid var(--border)",background:"var(--panel)",color:"var(--text)",fontSize:13}}>
                  {["6","7","8","9","10","12","14"].map(s=><option key={s} value={s}>{s} inch</option>)}
                </select>
              </div>
              <div>
                <label style={{fontSize:10.5,color:"var(--muted)",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:0.8,fontWeight:500}}>Shape</label>
                <select value={shape} onChange={e=>setShape(e.target.value)} style={{width:"100%",padding:"7px 10px",borderRadius:8,border:"1px solid var(--border)",background:"var(--panel)",color:"var(--text)",fontSize:13}}>
                  {["round","square","heart","number","sheet"].map(s=><option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label style={{fontSize:10.5,color:"var(--muted)",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:0.8,fontWeight:500}}>Layers</label>
                <select value={layers} onChange={e=>setLayers(e.target.value)} style={{width:"100%",padding:"7px 10px",borderRadius:8,border:"1px solid var(--border)",background:"var(--panel)",color:"var(--text)",fontSize:13}}>
                  {["1","2","3","4","5","6"].map(n=><option key={n} value={n}>{n} layer{+n>1?"s":""}</option>)}
                </select>
              </div>
              <div style={{borderTop:"1px solid var(--border)",paddingTop:10}}>
                <label style={{fontSize:10.5,color:"var(--muted)",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:0.8,fontWeight:500}}>Multiplier</label>
                {mult!==null
                  ?<div style={{display:"flex",alignItems:"center",gap:8}}>
                      <div style={{flex:1,padding:"7px 12px",borderRadius:8,border:"1px solid var(--border)",background:"var(--panel)",fontSize:14,fontWeight:600,color:"var(--gold)"}}>× {mult.toFixed(1)}</div>
                      <span style={{fontSize:11,color:"#357A52",whiteSpace:"nowrap"}}>✓ Set</span>
                    </div>
                  :<div style={{padding:"7px 12px",borderRadius:8,border:"1px solid #F0C0BB",background:"#FDEBE9",fontSize:13,color:"#B03A2E"}}>
                      Not set — go to <strong>Settings → Pricing setup</strong> to add this size/shape multiplier.
                    </div>
                }
              </div>
              {mult!==null&&<div style={{background:"var(--panel)",border:"1px solid var(--border)",borderRadius:8,padding:"10px 12px"}}>
                <div style={{fontSize:11,color:"var(--muted)",marginBottom:3}}>{size}" · {shape} · {layers} layer{+layers>1?"s":""}</div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
                  <span style={{fontSize:12,color:"var(--muted)"}}>Total ingredient cost</span>
                  <span style={{fontSize:20,fontWeight:700,color:"var(--gold)"}}>{fmt(r.ing.reduce((s,ing)=>{const it=inventory.find(x=>x.id===ing.iid);return s+(it?it.cost*ing.qty*factor:0)},0))}</span>
                </div>
              </div>}
            </>}

          </div>
        </div>

      </div>
    </div>}
  </Card>
}

// ═══════════════════════════════════════════════════════════
//  DECORATIONS TAB (standalone — own state, saved to localStorage)

// ═══════════════════════════════════════════════════════════
export function InventoryTab({inventory,setInventory,isOwner,showMsg,setView,setTab}){
  const [showImport,setShowImport]=useState(false)
  const [showAdd,setShowAdd]=useState(false)
  const [marketRun,setMarketRun]=useState(false)
  const [marketQuantities,setMarketQuantities]=useState({})
  const [importStep,setImportStep]=useState(1) // 1=paste 2=preview 3=done
  const [prevItems,setPrevItems]=useState([])
  const [pasteN,setPasteN]=useState("")
  const [pasteU,setPasteU]=useState("")
  const [pasteC,setPasteC]=useState("")
  const [newItem,setNewItem]=useState({name:"",unit:"kg",cost:"",minStock:"",cat:"Dry Goods"})
  const [editId,setEditId]=useState(null)
  const [editRow,setEditRow]=useState({})
  const [warnMsg,setWarnMsg]=useState("")

  const [collapsedCats, setCollapsedCats] = useState({
    "Dry Goods": false,
    "Dairy and Fats": false,
    "Flavours and Extracts": false,
    "Decoration Extras": false,
    "Board and Packaging": false,
    "Other": false
  })

  const toggleCat = (cat) => setCollapsedCats(prev => ({ ...prev, [cat]: !prev[cat] }))

  const mapCategory = (cat) => {
    const c = (cat || "").toLowerCase()
    if (c.includes("dry") || c.includes("chocolate") || c.includes("flour") || c.includes("sugar")) return "Dry Goods"
    if (c.includes("dairy") || c.includes("fat") || c.includes("oil") || c.includes("butter") || c.includes("margarine") || c.includes("egg")) return "Dairy and Fats"
    if (c.includes("flavor") || c.includes("extract") || c.includes("color") || c.includes("essence")) return "Flavours and Extracts"
    if (c.includes("decor") || c.includes("finish") || c.includes("fruit") || c.includes("flower") || c.includes("topper") || c.includes("ribbon")) return "Decoration Extras"
    if (c.includes("packaging") || c.includes("board") || c.includes("box") || c.includes("dowel") || c.includes("drum")) return "Board and Packaging"
    return "Other"
  }

  const L=v=>v.trim().split(String.fromCharCode(10)).map(s=>s.replace(/,/g,"").trim()).filter(Boolean)

  const lowStock=inventory.filter(i=>i.stock<=(i.minStock||5))
  const okCount=inventory.filter(i=>i.stock>(i.minStock||5)).length

  // Check row counts match as user types
  const checkMatch=()=>{
    const ns=L(pasteN),cs=L(pasteC)
    if(ns.length>0&&cs.length>0&&ns.length!==cs.length)
      setWarnMsg(`Names: ${ns.length} rows — Costs: ${cs.length} rows. Must match.`)
    else setWarnMsg("")
  }

  const doPreview=()=>{
    const ns=L(pasteN),us=L(pasteU),cs=L(pasteC)
    if(!ns.length||!cs.length)return showMsg("Item names and cost per unit are required","red")
    if(ns.length!==cs.length)return showMsg(`Names (${ns.length}) and costs (${cs.length}) must have same number of rows`,"red")
    const items=ns.map((name,i)=>{
      const rawCost = cs[i] || ""
      const cleanedCostStr = rawCost.replace(/[^0-9.]/g, "")
      const parsedCost = parseFloat(cleanedCostStr) || 0
      return {
        id:uid(),name,
        unit:us[i]||"kg",
        cost:parsedCost,
        stock:0,minStock:5,on:true,cat:"Dry Goods"
      }
    }).filter(p=>p.name&&p.cost)
    if(!items.length)return showMsg("No valid items found","red")
    setPrevItems(items);setImportStep(2)
  }

  const confirmImport=async()=>{
    const approved=prevItems.filter(p=>p.on)
    const updated=[...inventory,...approved.filter(ni=>!inventory.find(i=>i.name.toLowerCase()===ni.name.toLowerCase()))]
    setInventory(updated);await saveInventory(updated)
    setPasteN("");setPasteU("");setPasteC("");setImportStep(3)
    showMsg(`✓ ${approved.length} items imported. Set opening stock in Settings → Opening Stock.`,"green")
  }

  const addSingle=async()=>{
    if(!newItem.name||!newItem.cost)return showMsg("Name and cost per unit are required","red")
    const item={id:uid(),name:newItem.name,unit:newItem.unit||"kg",cost:+newItem.cost,stock:0,minStock:+newItem.minStock||5,cat:newItem.cat||"Dry Goods"}
    const updated=[...inventory,item]
    setInventory(updated);await saveInventory(updated)
    setNewItem({name:"",unit:"kg",cost:"",minStock:"",cat:"Dry Goods"});setShowAdd(false)
    showMsg("✓ Item added. Set opening stock in Settings → Opening Stock.","green")
  }

  const startEdit=(item)=>{setEditId(item.id);setEditRow({...item})}
  const cancelEdit=()=>setEditId(null)
  const doSaveEdit=async()=>{
    const updated=inventory.map(i=>i.id===editId?{...editRow,cost:+editRow.cost,minStock:+editRow.minStock||5,stock:+editRow.stock||0}:i)
    setInventory(updated);await saveInventory(updated);setEditId(null);showMsg("✓ Updated","green")
  }
  const doDelete=async(id)=>{
    if(!confirm("Remove this item?"))return
    const updated=inventory.filter(i=>i.id!==id);setInventory(updated);await saveInventory(updated)
  }

  const handleSaveMarketRun = async () => {
    const updated = inventory.map(item => {
      const added = parseFloat(marketQuantities[item.id]) || 0
      if (added > 0) {
        return { ...item, stock: parseFloat((item.stock + added).toFixed(3)) }
      }
      return item
    })
    setInventory(updated)
    await saveInventory(updated)
    setMarketQuantities({})
    setMarketRun(false)
    showMsg("✓ Stock updated from market run!", "green")
  }

  const badge=(item)=>{
    if(item.stock===0)return<span style={{background:"#FDEBE9",color:"#912622",borderRadius:20,padding:"2px 9px",fontSize:11,fontWeight:600}}>Out of Stock</span>
    if(item.stock<=(item.minStock||5))return<span style={{background:"#FDF2DC",color:"var(--gold)",borderRadius:20,padding:"2px 9px",fontSize:11,fontWeight:600}}>Low stock ⚠</span>
    return<span style={{background:"#E5F4EC",color:"#2D7A50",borderRadius:20,padding:"2px 9px",fontSize:11,fontWeight:600}}>In Stock</span>
  }

  // Group inventory by mapped category
  const categories = {
    "Dry Goods": [],
    "Dairy and Fats": [],
    "Flavours and Extracts": [],
    "Decoration Extras": [],
    "Board and Packaging": [],
    "Other": []
  }
  inventory.forEach(item => {
    const mapped = mapCategory(item.cat)
    if (categories[mapped]) {
      categories[mapped].push(item)
    } else {
      categories["Other"].push(item)
    }
  })

  return <div>
    {/* HEADER */}
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,flexWrap:"wrap",gap:8}}>
      <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
        <span style={{fontSize:13,color:"var(--muted)",fontWeight:500}}>{inventory.length} items total</span>
        {lowStock.length>0&&<span onClick={()=>setView("shopping")} style={{fontSize:12.5,color:"#B03A2E",fontWeight:600,cursor:"pointer",background:"#FDEBE9",padding:"3px 10px",borderRadius:20}}>⚠ {lowStock.length} low stock → Shopping List</span>}
      </div>
      {isOwner&&<div style={{display:"flex",gap:8,alignItems:"center"}}>
        <Btn small variant="ghost" onClick={() => setMarketRun(true)}>🛒 Update stock after market run</Btn>
        <Btn small variant="ghost" onClick={()=>{setShowImport(s=>!s);setShowAdd(false);setImportStep(1)}}>📋 Import from Excel</Btn>
        <Btn small onClick={()=>{setShowAdd(s=>!s);setShowImport(false)}}>+ Add Item</Btn>
      </div>}
    </div>

    {/* MARKET RUN MODAL */}
    {marketRun && (
      <Modal title="Market Run Stock Update" onClose={() => setMarketRun(false)}>
        <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 14 }}>
          Enter the quantities purchased for low-stock and out-of-stock ingredients. Click **Save All** to update inventory levels simultaneously.
        </div>
        {lowStock.length === 0 ? (
          <div style={{ textAlign: "center", padding: "20px 0", fontSize: 14, color: "green", fontWeight: 600 }}>
            ✓ All items are fully stocked! No low-stock items to update.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 350, overflowY: "auto", paddingRight: 6, marginBottom: 14 }}>
            {lowStock.map(item => (
              <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#FAF7F0", padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border)" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{item.name}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>Current stock: {item.stock} {item.unit} | Min: {item.minStock} {item.unit}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="number"
                    placeholder="+ Qty"
                    value={marketQuantities[item.id] || ""}
                    onChange={e => setMarketQuantities({ ...marketQuantities, [item.id]: e.target.value })}
                    style={{ ...iSt, width: 90, padding: "8px 10px", fontSize: 13, fontWeight: 600, textAlign: "right" }}
                  />
                  <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--muted)", width: 26 }}>{item.unit}</span>
                </div>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", borderTop: "1px solid var(--border)", paddingTop: 12 }}>
          <Btn variant="success" onClick={handleSaveMarketRun} disabled={Object.keys(marketQuantities).length === 0}>Save All Updates</Btn>
          <Btn variant="ghost" onClick={() => setMarketRun(false)}>Cancel</Btn>
        </div>
      </Modal>
    )}

    {/* SUMMARY CARDS */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:12}}>
      <Card style={{padding:"12px 14px"}}><div style={{fontSize:10,color:"var(--muted)",textTransform:"uppercase",letterSpacing:.8,marginBottom:4}}>Total items</div><div style={{fontSize:22,fontWeight:500,color:"var(--text)"}}>{inventory.length}</div></Card>
      <Card style={{padding:"12px 14px"}}><div style={{fontSize:10,color:"var(--muted)",textTransform:"uppercase",letterSpacing:.8,marginBottom:4}}>Items OK</div><div style={{fontSize:22,fontWeight:500,color:"#357A52"}}>{okCount}</div></Card>
      <Card style={{padding:"12px 14px",background:"#FFF9EE",borderColor:"var(--gold)"}}><div style={{fontSize:10,color:"var(--gold)",textTransform:"uppercase",letterSpacing:.8,marginBottom:4}}>Low / Out</div><div style={{fontSize:22,fontWeight:500,color:"var(--gold)"}}>{lowStock.length}</div></Card>
    </div>

    {/* LOW STOCK BANNER */}
    {lowStock.length>0&&<div style={{background:"#FFF9EE",border:"1px solid var(--gold)",borderRadius:8,padding:"9px 14px",fontSize:12.5,color:"var(--gold)",marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
      <span>⚠ {lowStock.map(i=>i.name).join(", ")} — below minimum</span>
      <Btn small variant="outline" onClick={()=>setView("shopping")}>🛒 Shopping List →</Btn>
    </div>}

    {/* IMPORT PANEL */}
    {showImport&&isOwner&&<Card style={{marginBottom:14,borderColor:"var(--gold)",background:"#FDFAF4"}}>

      {/* Step indicators */}
      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:14,flexWrap:"wrap"}}>
        {[["1","Paste columns"],["2","Preview"],["✓","Imported"]].map(([num,lbl],i)=>{
          const idx=i+1
          const done=importStep>idx,active=importStep===idx
          return <div key={num} style={{display:"flex",alignItems:"center",gap:5}}>
            <div style={{width:22,height:22,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,background:done?"#357A52":active?"var(--gold)":"var(--border)",color:done||active?"#fff":"var(--muted)"}}>{done?"✓":num}</div>
            <span style={{fontSize:12,color:active?"var(--text)":"var(--muted)",fontWeight:active?500:400}}>{lbl}</span>
            {i<2&&<div style={{width:20,height:1,background:"var(--border)",margin:"0 2px"}}/>}
          </div>
        })}
      </div>

      {/* STEP 1 — paste */}
      {importStep===1&&<div>
        <div style={{fontSize:12.5,color:"var(--muted)",marginBottom:10,lineHeight:1.7}}>Open your Excel. Copy each column and paste into its own box. Only item names and cost per unit are required.</div>
        <div style={{background:"#FFF9EE",border:"1px solid #E8D5A3",borderRadius:7,padding:"8px 12px",fontSize:12,color:"var(--gold)",marginBottom:12}}>💡 Just copy from Excel as-is. No reformatting needed.</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:10}}>
          <div>
            <label style={{fontSize:10,color:"var(--muted)",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:.8,fontWeight:500}}>Item Names *</label>
            <textarea value={pasteN} onChange={e=>{setPasteN(e.target.value);checkMatch()}} placeholder={"FlourSugarOilEggsButter"} style={{width:"100%",minHeight:120,padding:"8px",borderRadius:8,border:"1px solid var(--border)",background:"var(--panel)",fontSize:12,fontFamily:"monospace",color:"var(--text)",boxSizing:"border-box",resize:"vertical",outline:"none"}}/>
          </div>
          <div>
            <label style={{fontSize:10,color:"var(--muted)",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:.8,fontWeight:500}}>Unit <span style={{color:"var(--muted)",fontSize:9}}>(optional)</span></label>
            <textarea value={pasteU} onChange={e=>setPasteU(e.target.value)} placeholder={"kgkgLpcskg"} style={{width:"100%",minHeight:120,padding:"8px",borderRadius:8,border:"1px solid var(--border)",background:"var(--panel)",fontSize:12,fontFamily:"monospace",color:"var(--text)",boxSizing:"border-box",resize:"vertical",outline:"none"}}/>
            <div style={{fontSize:10.5,color:"var(--muted)",marginTop:3}}>Leave blank to default all to kg</div>
          </div>
          <div>
            <label style={{fontSize:10,color:"var(--gold)",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:.8,fontWeight:500}}>Cost / Unit (₦) *</label>
            <textarea value={pasteC} onChange={e=>{setPasteC(e.target.value);checkMatch()}} placeholder={"11401500300020717500"} style={{width:"100%",minHeight:120,padding:"8px",borderRadius:8,border:"1px solid #E8D5A3",background:"#FFF9EE",fontSize:12,fontFamily:"monospace",color:"var(--text)",boxSizing:"border-box",resize:"vertical",outline:"none"}}/>
            <div style={{fontSize:10.5,color:"var(--gold)",marginTop:3}}>Bulk price ÷ qty bought = cost/unit</div>
          </div>
        </div>
        {warnMsg&&<div style={{padding:"7px 12px",background:"#FDEBE9",borderRadius:7,fontSize:12,color:"#B03A2E",marginBottom:10}}>⚠ {warnMsg}</div>}
        <div style={{display:"flex",gap:8}}>
          <Btn onClick={doPreview} disabled={!pasteN.trim()||!pasteC.trim()||!!warnMsg}>Preview import →</Btn>
          <Btn variant="ghost" onClick={()=>setShowImport(false)}>Cancel</Btn>
        </div>
      </div>}

      {/* STEP 2 — preview */}
      {importStep===2&&<div>
        <div style={{fontSize:12.5,color:"var(--muted)",marginBottom:10}}>Check every row. Toggle off anything you don't want. Opening stock is set in Settings after import.</div>
        <div style={{overflowX:"auto",marginBottom:10}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12.5}}>
            <thead><tr style={{background:"#EDE5D6"}}>
              {["","Item","Unit","Cost/Unit"].map(h=><th key={h} style={{padding:"7px 10px",textAlign:h==="Cost/Unit"?"right":"left",fontSize:10,textTransform:"uppercase",letterSpacing:.8,color:"var(--muted)",fontWeight:500}}>{h}</th>)}
            </tr></thead>
            <tbody>{prevItems.map((p,i)=><tr key={p.id} style={{background:i%2===0?"var(--panel)":"#F8F3EA",opacity:p.on?1:0.35}}>
              <td style={{padding:"6px 10px"}}><div onClick={()=>setPrevItems(prev=>prev.map((x,j)=>j===i?{...x,on:!x.on}:x))} style={{width:30,height:16,borderRadius:8,background:p.on?"#357A52":"var(--border)",cursor:"pointer",position:"relative"}}><div style={{width:12,height:12,borderRadius:"50%",background:"white",position:"absolute",top:2,left:p.on?16:2,transition:"left 0.2s"}}/></div></td>
              <td style={{padding:"6px 10px",fontWeight:500}}>{p.name}</td>
              <td style={{padding:"6px 10px",color:"var(--muted)"}}>{p.unit}</td>
              <td style={{padding:"6px 10px",textAlign:"right",fontWeight:500,color:"var(--gold)"}}>{fmt(p.cost)}/{p.unit}</td>
            </tr>)}</tbody>
          </table>
        </div>
        <div style={{background:"#EEF8F3",border:"1px solid #C2E0CF",borderRadius:7,padding:"8px 12px",fontSize:12,color:"#357A52",marginBottom:10}}>
          After import, go to <strong>Settings → Opening Stock</strong> to set your opening quantities. Stock will then track automatically from there.
        </div>
        <div style={{display:"flex",gap:8}}>
          <Btn variant="success" onClick={confirmImport} disabled={!prevItems.some(p=>p.on)}>✓ Confirm & Import {prevItems.filter(p=>p.on).length} Items</Btn>
          <Btn variant="ghost" onClick={()=>setImportStep(1)}>← Edit</Btn>
        </div>
      </div>}

      {/* STEP 3 — done */}
      {importStep===3&&<div style={{textAlign:"center",padding:"16px 0"}}>
        <div style={{fontSize:16,color:"#357A52",fontWeight:600,marginBottom:6}}>✓ Import complete</div>
        <div style={{fontSize:13,color:"var(--muted)",marginBottom:14}}>Go to <strong>Settings → Opening Stock</strong> to set opening quantities.</div>
        <Btn variant="ghost" onClick={()=>{setImportStep(1);setShowImport(false)}}>Done</Btn>
      </div>}
    </Card>}

    {/* ADD SINGLE ITEM */}
    {showAdd&&isOwner&&<Card style={{marginBottom:14,background:"#FFF9EE",borderColor:"var(--gold)"}}>
      <div style={{fontFamily:"'Playfair Display',serif",fontSize:14,fontWeight:600,marginBottom:12}}>Add New Item</div>
      <div style={{display:"grid",gridTemplateColumns:"1.5fr 1fr 1fr 1fr 1fr",gap:10,marginBottom:10}}>
        <Inp label="Item Name *" value={newItem.name} onChange={v=>setNewItem(p=>({...p,name:v}))} placeholder="e.g. Flour"/>
        <Sel label="Category" value={newItem.cat} onChange={v=>setNewItem(p=>({...p,cat:v}))} options={["Dry Goods", "Dairy and Fats", "Flavours and Extracts", "Decoration Extras", "Board and Packaging", "Other"].map(c=>({value:c,label:c}))}/>
        <Sel label="Unit *" value={newItem.unit} onChange={v=>setNewItem(p=>({...p,unit:v}))} options={["kg","g","L","ml","pcs","pack","bottle","roll","set"].map(u=>({value:u,label:u}))}/>
        <Inp label="Cost/Unit (₦) *" type="number" value={newItem.cost} onChange={v=>setNewItem(p=>({...p,cost:v}))} placeholder="e.g. 1140"/>
        <Inp label="Min Alert" type="number" value={newItem.minStock} onChange={v=>setNewItem(p=>({...p,minStock:v}))} placeholder="e.g. 10"/>
      </div>
      <div style={{display:"flex",gap:8}}><Btn onClick={addSingle}>Save</Btn><Btn variant="ghost" onClick={()=>setShowAdd(false)}>Cancel</Btn></div>
    </Card>}

    {/* COLLAPSIBLE CATEGORIES */}
    <div>
      {Object.entries(categories).map(([catName, items]) => {
        const isCollapsed = collapsedCats[catName]
        return (
          <div key={catName} style={{ marginBottom: 14 }}>
            {/* Section Header */}
            <div 
              onClick={() => toggleCat(catName)}
              style={{ 
                background: "#FAF7F0", 
                border: "1px solid var(--border)", 
                borderRadius: 8, 
                padding: "10px 14px", 
                display: "flex", 
                justifyContent: "space-between", 
                alignItems: "center", 
                cursor: "pointer",
                fontWeight: 600,
                fontSize: 13.5,
                color: "var(--text)",
                userSelect: "none"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span>📁 {catName} ({items.length} item{items.length !== 1 ? "s" : ""})</span>
                {catName === "Decoration Extras" && (
                  <span 
                    onClick={(e) => {
                      e.stopPropagation();
                      if (setTab) setTab("decorations");
                    }}
                    style={{
                      marginLeft: 12,
                      fontSize: 11.5,
                      color: "var(--gold)",
                      textDecoration: "underline",
                      cursor: "pointer",
                      fontWeight: 500
                    }}
                  >
                    Manage Decoration Extras ↗
                  </span>
                )}
                {catName === "Board and Packaging" && (
                  <span 
                    onClick={(e) => {
                      e.stopPropagation();
                      if (setTab) setTab("packaging");
                    }}
                    style={{
                      marginLeft: 12,
                      fontSize: 11.5,
                      color: "var(--gold)",
                      textDecoration: "underline",
                      cursor: "pointer",
                      fontWeight: 500
                    }}
                  >
                    Manage Boards & Packaging ↗
                  </span>
                )}
              </div>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>{isCollapsed ? "▼ Click to expand" : "▲ Click to collapse"}</span>
            </div>

            {/* Section Content */}
            {!isCollapsed && (
              <div style={{ marginTop: 8, overflowX: "auto" }}>
                <table style={{width:"100%",borderCollapse:"collapse",background:"var(--panel)",borderRadius:10,overflow:"hidden",border:"1px solid var(--border)"}}>
                  <TH cols={["Item", "Unit", "Stock qty", "Cost/Unit", "Min Alert", "Status", ...(isOwner ? ["Actions"] : [])]}/>
                  <tbody>
                    {items.length === 0 ? (
                      <tr><td colSpan={7} style={{padding:20,textAlign:"center",color:"var(--muted)",fontSize:12.5}}>No items in this category yet.</td></tr>
                    ) : (
                      items.map((item, idx) => {
                        const isLow = item.stock <= (item.minStock || 5)
                        const editing = editId === item.id
                        return (
                          <tr key={item.id} style={{background:isLow?"#FFF9EE":idx%2===0?"var(--panel)":"#F8F3EA"}}>
                            {editing ? (
                              <>
                                <td style={{padding:"6px 8px"}}><input value={editRow.name||""} onChange={e=>setEditRow(r=>({...r,name:e.target.value}))} style={{...iSt,padding:"4px 6px",fontSize:12}}/></td>
                                <td style={{padding:"6px 8px"}}><select value={editRow.unit||"kg"} onChange={e=>setEditRow(r=>({...r,unit:e.target.value}))} style={{...iSt,padding:"4px 6px",fontSize:12,width:60}}>{["kg","g","L","ml","pcs","pack","bottle"].map(u=><option key={u}>{u}</option>)}</select></td>
                                <td style={{padding:"6px 8px"}}><input type="number" value={editRow.stock||""} onChange={e=>setEditRow(r=>({...r,stock:e.target.value}))} style={{...iSt,padding:"4px 6px",fontSize:12,width:70}}/></td>
                                <td style={{padding:"6px 8px"}}><input type="number" value={editRow.cost||""} onChange={e=>setEditRow(r=>({...r,cost:e.target.value}))} style={{...iSt,padding:"4px 6px",fontSize:12,width:80}}/></td>
                                <td style={{padding:"6px 8px"}}><input type="number" value={editRow.minStock||""} onChange={e=>setEditRow(r=>({...r,minStock:e.target.value}))} style={{...iSt,padding:"4px 6px",fontSize:12,width:60}}/></td>
                                <td style={{padding:"6px 8px"}}></td>
                                <td style={{padding:"6px 8px"}}><div style={{display:"flex",gap:4}}><Btn small variant="success" onClick={doSaveEdit}>✓</Btn><Btn small variant="ghost" onClick={cancelEdit}>✗</Btn></div></td>
                              </>
                            ) : (
                              <>
                                <td style={{padding:"9px 10px",fontWeight:500,fontSize:13}}>{item.name}</td>
                                <td style={{padding:"9px 10px",color:"var(--muted)",fontSize:13}}>{item.unit}</td>
                                <td style={{padding:"9px 10px",fontSize:13,fontWeight:600,color:isLow?"#B03A2E":"#357A52"}}>{item.stock||0} {item.unit}</td>
                                <td style={{padding:"9px 10px",fontSize:13,fontWeight:500,color:"var(--gold)"}}>{fmt(item.cost)}/{item.unit}</td>
                                <td style={{padding:"9px 10px",fontSize:13,color:"var(--muted)"}}>{item.minStock||5} {item.unit}</td>
                                <td style={{padding:"9px 10px"}}>{badge(item)}</td>
                                {isOwner && (
                                  <td style={{padding:"9px 10px"}}>
                                    <div style={{display:"flex",gap:4}}>
                                      <Btn small variant="ghost" onClick={()=>startEdit(item)}>✎ Edit</Btn>
                                      <Btn small variant="danger" onClick={()=>doDelete(item.id)}>×</Btn>
                                    </div>
                                  </td>
                                )}
                              </>
                            )}
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      })}
    </div>
    <div style={{marginTop:8,fontSize:11.5,color:"var(--muted)",lineHeight:1.7}}>Stock reduces automatically as production orders are saved. Set opening stock in <strong>Settings → Opening Stock</strong>. Restock by scanning a purchase receipt.</div>
  </div>
}


// ═══════════════════════════════════════════════════════════
//  RECIPE CARD (standalone component — avoids hook-in-map bug)

// ═══════════════════════════════════════════════════════════
export function DecorationsTab({inventory, setInventory, isOwner}){
  const LS_KEY = "ll_decorations"
  const load = useCallback(() => {
    const stored = loadLocal(LS_KEY, DECORATION_ITEMS)
    const decorInventoryItems = inventory.filter(item => item.cat === "Decoration Extras" || item.category === "Decoration Extras")
    
    return decorInventoryItems.map(invItem => {
      const existing = stored.find(d => d.iid === invItem.id)
      return {
        id: existing ? existing.id : "d_" + invItem.id,
        name: invItem.name,
        label: invItem.name,
        iid: invItem.id,
        qty: existing ? existing.qty : 1
      }
    })
  }, [inventory])

  const [items, setItems] = useState(load)
  const [editId, setEditId] = useState(null)
  const [editRow, setEditRow] = useState({})
  const [adding, setAdding] = useState(false)
  const [newItem, setNewItem] = useState({name:"", label:"", iid:"", qty:"", id:""})
  const [msg, setMsg] = useState("")

  useEffect(() => {
    setItems(load())
  }, [inventory, load])

  const showMsg = (m) => { setMsg(m); setTimeout(()=>setMsg(""), 3000) }

  const save = (updatedItems) => { saveLocal(LS_KEY, updatedItems) }

  const startEdit = (d) => { setEditId(d.id); setEditRow({...d}) }

  const saveEdit = () => {
    const stored = loadLocal(LS_KEY, DECORATION_ITEMS)
    let updated = stored.map(d => d.id===editId ? {...d, ...editRow, qty:+editRow.qty} : d)
    if (!stored.some(d => d.id === editId)) {
      updated.push({ ...editRow, qty: +editRow.qty })
    }
    save(updated)
    setItems(load())
    setEditId(null)
    showMsg("✓ Decoration updated")
  }

  const deleteItem = async (id) => {
    if(!confirm("Delete this decoration?")) return
    const toDelete = items.find(d => d.id === id)
    if (toDelete) {
      const updatedInv = inventory.map(i => {
        if (i.id === toDelete.iid) {
          return { ...i, cat: "Other" }
        }
        return i
      })
      setInventory(updatedInv)
      await saveInventory(updatedInv)
    }
    const stored = loadLocal(LS_KEY, DECORATION_ITEMS)
    const updated = stored.filter(d => d.id!==id && d.iid !== toDelete?.iid)
    save(updated)
    setItems(load())
    showMsg("Decoration deleted")
  }

  const addItem = async () => {
    if(!newItem.name || !newItem.iid || !newItem.qty) return showMsg("Name, inventory item and qty are required")
    
    const updatedInv = inventory.map(i => {
      if (i.id === newItem.iid) {
        return { ...i, cat: "Decoration Extras" }
      }
      return i
    })
    setInventory(updatedInv)
    await saveInventory(updatedInv)

    const stored = loadLocal(LS_KEY, DECORATION_ITEMS)
    const item = { id: "d_" + newItem.iid, name: newItem.name, label: newItem.name, iid: newItem.iid, qty: +newItem.qty }
    const updated = [...stored.filter(x => x.iid !== newItem.iid), item]
    save(updated)
    setItems(load())
    setNewItem({name:"", label:"", iid:"", qty:"", id:""}); setAdding(false); showMsg("✓ Decoration added")
  }

  return <div>
    <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12}}>
      <div style={{fontSize:13, color:"var(--muted)"}}>Selectable per production order. Costs update automatically when inventory prices change.</div>
      {isOwner&&<Btn small onClick={()=>setAdding(!adding)}>+ Add Decoration</Btn>}
    </div>

    {msg&&<Alert msg={msg} color={msg.startsWith("✓")?"green":"gold"} onClose={()=>setMsg("")}/>}

    {adding&&isOwner&&<Card style={{marginBottom:14, background:"#FFF9EE", borderColor:"var(--gold)"}}>
      <div style={{fontFamily:"'Playfair Display',serif", fontSize:14, fontWeight:600, marginBottom:12}}>New Decoration Extra</div>
      <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:10}}>
        <Inp label="Decoration Name *" value={newItem.name} onChange={v=>setNewItem(p=>({...p,name:v}))} placeholder="e.g. Edible glitter"/>
        <div style={{marginBottom:11, display:"flex", flexDirection:"column", minWidth: 200}}>
          <label style={{fontSize:10.5,color:"var(--muted)",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:0.8,fontWeight:500}}>Linked Inventory Item *</label>
          <SearchableSelect
            value={newItem.iid}
            onChange={val=>setNewItem(p=>({...p,iid:val}))}
            options={inventory.filter(i => i.cat !== "Board and Packaging" && i.category !== "Board and Packaging").map(i=>({
              value: i.id,
              label: `${i.name} (${i.unit}) — ${fmt(i.cost)}/${i.unit}`
            }))}
            placeholder="Type to search item..."
          />
        </div>
        <Inp label="Standard Qty Used *" type="number" value={newItem.qty} onChange={v=>setNewItem(p=>({...p,qty:v}))} placeholder="e.g. 0.15"/>
      </div>
      <div style={{display:"flex", gap:8}}><Btn onClick={addItem}>Save</Btn><Btn variant="ghost" onClick={()=>setAdding(false)}>Cancel</Btn></div>
    </Card>}

    <div style={{overflowX:"auto"}}>
      <table style={{width:"100%", borderCollapse:"collapse", background:"var(--panel)", borderRadius:10, overflow:"hidden", border:"1px solid var(--border)"}}>
        <TH cols={["Decoration", "Linked Inventory Item", "Std Qty", "Cost", ...(isOwner?["Actions"]:[])]}/>
        <tbody>{items.map((d,i)=>{
          const it = inventory.find(x=>x.id===d.iid)
          const editing = editId===d.id
          return <tr key={d.id} style={{background:i%2===0?"var(--panel)":"#F8F3EA"}}>
            {editing ? <>
              <td style={{padding:"6px 8px"}}><input value={editRow.name||editRow.label||""} onChange={e=>setEditRow(r=>({...r,name:e.target.value,label:e.target.value}))} style={{...iSt,padding:"4px 6px",fontSize:12}}/></td>
              <td style={{padding:"6px 8px", minWidth: 200}}>
                <SearchableSelect
                  value={editRow.iid||""}
                  onChange={val=>setEditRow(r=>({...r,iid:val}))}
                  options={inventory.filter(i => i.cat !== "Board and Packaging" && i.category !== "Board and Packaging").map(i=>({
                    value: i.id,
                    label: `${i.name} (${i.unit}) — ${fmt(i.cost)}/${i.unit}`
                  }))}
                  placeholder="Type to search item..."
                />
              </td>
              <td style={{padding:"6px 8px"}}><input type="number" value={editRow.qty||""} onChange={e=>setEditRow(r=>({...r,qty:e.target.value}))} style={{...iSt,width:70,padding:"4px 6px",fontSize:12}}/></td>
              <td style={{padding:"6px 8px",fontSize:13}}>{editRow.iid&&inventory.find(x=>x.id===editRow.iid)?fmt(inventory.find(x=>x.id===editRow.iid).cost*(+editRow.qty||0)):"—"}</td>
              <td style={{padding:"6px 8px"}}><div style={{display:"flex",gap:4}}><Btn small variant="success" onClick={saveEdit}>✓</Btn><Btn small variant="ghost" onClick={()=>setEditId(null)}>✗</Btn></div></td>
            </> : <>
              <td style={{padding:"9px 10px",fontWeight:500,fontSize:13}}>{d.name||d.label}</td>
              <td style={{padding:"9px 10px",color:"var(--muted)",fontSize:12.5}}>{it?.name||<span style={{color:"#B03A2E"}}>⚠ Not found</span>}</td>
              <td style={{padding:"9px 10px",fontSize:13}}>{d.qty} {it?.unit||""}</td>
              <td style={{padding:"9px 10px",color:"var(--gold)",fontWeight:500,fontSize:13}}>{it?fmt(it.cost*d.qty):"—"}</td>
              {isOwner&&<td style={{padding:"9px 10px"}}><div style={{display:"flex",gap:4}}><Btn small variant="ghost" onClick={()=>startEdit(d)}>✎ Edit</Btn><Btn small variant="danger" onClick={()=>deleteItem(d.id)}>×</Btn></div></td>}
            </>}
          </tr>
        })}</tbody>
      </table>
    </div>
  </div>
}

// ═══════════════════════════════════════════════════════════
//  MASTER LIST (editable inventory + editable recipes)
// ═══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════
//  PACKAGING TAB — boards, boxes, drums linked to Order Calculator

// ═══════════════════════════════════════════════════════════
export function PackagingTab({inventory,setInventory,isOwner}){
  const items = useMemo(() => {
    return inventory.filter(item => item.cat === "Board and Packaging" || item.category === "Board and Packaging")
  }, [inventory])

  const [adding,setAdding]=useState(false)
  const [newItem,setNewItem]=useState({name:"",price:"",unit:"pcs"})
  const [editId,setEditId]=useState(null)
  const [editRow,setEditRow]=useState({})

  const addItem=async()=>{
    if(!newItem.name.trim()||!newItem.price)return
    const item={
      id:"i_"+Date.now(),
      name:newItem.name.trim(),
      cat:"Board and Packaging",
      unit:newItem.unit||"pcs",
      cost:+newItem.price,
      stock:0,
      minStock:5
    }
    const updated=[...inventory,item]
    setInventory(updated);await saveInventory(updated)
    setAdding(false);setNewItem({name:"",price:"",unit:"pcs"})
  }
  const saveEdit=async(id)=>{
    const updated=inventory.map(i=>i.id===id?{...i,name:editRow.name.trim(),cost:+editRow.price,unit:editRow.unit||"pcs"}:i)
    setInventory(updated);await saveInventory(updated)
    setEditId(null)
  }
  const deleteItem=async(id)=>{
    if(!confirm("Remove this packaging item?"))return
    const updated=inventory.filter(i=>i.id!==id)
    setInventory(updated);await saveInventory(updated)
  }

  return <div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
      <div style={{fontSize:13,color:"var(--muted)"}}>Boards, boxes and packaging items used in the Order Calculator. Prices update automatically when you edit them here.</div>
      {isOwner&&<Btn small onClick={()=>setAdding(true)}>+ Add item</Btn>}
    </div>
    {adding&&<Card style={{marginBottom:12,borderLeft:"4px solid var(--gold)"}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr auto",gap:8,alignItems:"end"}}>
        <Inp label="Item name" value={newItem.name} onChange={v=>setNewItem(n=>({...n,name:v}))} placeholder="e.g. Cake Board 8&quot;"/>
        <Inp label="Price (₦)" type="number" value={newItem.price} onChange={v=>setNewItem(n=>({...n,price:v}))} placeholder="e.g. 450"/>
        <div>
          <label style={{fontSize:10,color:"var(--muted)",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:.8,fontWeight:500}}>Unit</label>
          <select value={newItem.unit} onChange={e=>setNewItem(n=>({...n,unit:e.target.value}))} style={{...iSt}}>
            {["pcs","pack","roll","set","kg","g","L","ml","bottle"].map(u=><option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div style={{display:"flex",gap:6}}>
          <Btn small variant="success" onClick={addItem}>✓ Save</Btn>
          <Btn small variant="ghost" onClick={()=>setAdding(false)}>Cancel</Btn>
        </div>
      </div>
    </Card>}
    <table style={{width:"100%",borderCollapse:"collapse"}}>
      <thead><tr style={{background:"var(--bg)"}}>
        {["Item","Price","Unit",""].map(h=><th key={h} style={{padding:"8px 10px",textAlign:h==="Price"?"right":"left",fontSize:10,color:"var(--muted)",textTransform:"uppercase",letterSpacing:.8,fontWeight:500,borderBottom:"1px solid var(--border)"}}>{h}</th>)}
      </tr></thead>
      <tbody>
        {items.map((item,i)=><tr key={item.id} style={{background:i%2===0?"transparent":"var(--bg)"}}>
          {editId===item.id
            ?<>
              <td style={{padding:"6px 8px"}}><input value={editRow.name||""} onChange={e=>setEditRow(r=>({...r,name:e.target.value}))} style={{...iSt,fontSize:12}}/></td>
              <td style={{padding:"6px 8px"}}><input type="number" value={editRow.price||""} onChange={e=>setEditRow(r=>({...r,price:e.target.value}))} style={{...iSt,fontSize:12}}/></td>
              <td style={{padding:"6px 8px"}}><select value={editRow.unit||"pcs"} onChange={e=>setEditRow(r=>({...r,unit:e.target.value}))} style={{...iSt,fontSize:12}}>{["pcs","pack","roll","set","kg","g","L","ml","bottle"].map(u=><option key={u} value={u}>{u}</option>)}</select></td>
              <td style={{padding:"6px 8px"}}><div style={{display:"flex",gap:4}}><Btn small variant="success" onClick={()=>saveEdit(item.id)}>✓</Btn><Btn small variant="ghost" onClick={()=>setEditId(null)}>✗</Btn></div></td>
            </>
            :<>
              <td style={{padding:"8px 10px",fontSize:13,fontWeight:500}}>{item.name}</td>
              <td style={{padding:"8px 10px",fontSize:13,textAlign:"right",color:"var(--gold)",fontWeight:600}}>{fmt(item.cost)}</td>
              <td style={{padding:"8px 10px",fontSize:12,color:"var(--muted)"}}>{item.unit}</td>
              <td style={{padding:"6px 8px"}}>{isOwner&&<div style={{display:"flex",gap:4,justifyContent:"flex-end"}}><Btn small variant="ghost" onClick={()=>{setEditId(item.id);setEditRow({name:item.name,price:item.cost,unit:item.unit})}}>Edit</Btn><Btn small variant="danger" onClick={()=>deleteItem(item.id)}>×</Btn></div>}</td>
            </>}
        </tr>)}
      </tbody>
    </table>
  </div>
}

export function SearchableSelect({ value, onChange, options, placeholder }) {
  const [search, setSearch] = useState("")
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef()

  const selectedOption = useMemo(() => options.find(o => o.value === value), [options, value])

  useEffect(() => {
    setSearch(selectedOption ? selectedOption.label : "")
  }, [value, selectedOption])

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setIsOpen(false)
        setSearch(selectedOption ? selectedOption.label : "")
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [selectedOption])

  const filtered = useMemo(() => {
    return options.filter(o => 
      o.label.toLowerCase().includes((search || "").toLowerCase())
    )
  }, [options, search])

  return (
    <div ref={ref} style={{ position: "relative", flex: 2 }}>
      <input
        type="text"
        value={search}
        placeholder={placeholder}
        onFocus={() => setIsOpen(true)}
        onChange={(e) => {
          setSearch(e.target.value)
          setIsOpen(true)
        }}
        style={{
          ...iSt,
          width: "100%",
          padding: "7px 10px",
          fontSize: "12.5px"
        }}
      />
      {isOpen && (
        <div style={{
          position: "absolute",
          top: "100%",
          left: 0,
          right: 0,
          background: "var(--panel)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          maxHeight: 180,
          overflowY: "auto",
          zIndex: 1000,
          marginTop: 4,
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
        }}>
          {filtered.length === 0 ? (
            <div style={{ padding: "8px 12px", fontSize: 12, color: "var(--muted)" }}>No matches found</div>
          ) : (
            filtered.map(o => (
              <div
                key={o.value}
                onClick={() => {
                  onChange(o.value)
                  setSearch(o.label)
                  setIsOpen(false)
                }}
                style={{
                  padding: "8px 12px",
                  fontSize: 12.5,
                  cursor: "pointer",
                  background: o.value === value ? "rgba(200,145,42,0.1)" : "transparent",
                  color: o.value === value ? "var(--gold)" : "var(--text)",
                  borderBottom: "1px solid var(--border)"
                }}
                onMouseEnter={(e) => e.target.style.background = "rgba(200,145,42,0.05)"}
                onMouseLeave={(e) => e.target.style.background = o.value === value ? "rgba(200,145,42,0.1)" : "transparent"}
              >
                {o.label}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export function MasterList({inventory,setInventory,recipes,setRecipes,user,setView}){
  const [tab,setTab]=useState("inventory")
  const [editId,setEditId]=useState(null)
  const [editRow,setEditRow]=useState({})
  const [addMode,setAddMode]=useState(false)
  const [newItem,setNewItem]=useState({name:"",cat:"",unit:"kg",unitSize:"",qtyBought:"",bulkPrice:"",minStock:"",stock:0,cost:0})
  const [msg,setMsg]=useState("")
  const [msgColor,setMsgColor]=useState("gold")
  const [recipeModal,setRecipeModal]=useState(null)
  const [pasteMode,setPasteMode]=useState(false)
  const [pasteText,setPasteText]=useState("")
  const csvRef=useRef()
  const isOwner = user?.role==="owner"
  const [showRecipeExcelImport, setShowRecipeExcelImport] = useState(false)
  const [showRecipeScan, setShowRecipeScan] = useState(false)

  const showMsg = (m,c="gold") => { setMsg(m); setMsgColor(c); setTimeout(()=>setMsg(""),4000) }

  // ── Inventory ──
  const startEdit = (item) => { setEditId(item.id); setEditRow({...item}) }
  const saveEdit = async () => {
    const updated = inventory.map(i=>i.id===editId?{...editRow,cost:+editRow.cost,stock:+editRow.stock,minStock:+editRow.minStock||2}:i)
    setInventory(updated); await saveInventory(updated); setEditId(null); showMsg("✓ Item updated","green")
  }
  const deleteItem = async (id) => {
    if(!confirm("Delete this item?"))return
    const updated=inventory.filter(i=>i.id!==id); setInventory(updated); await saveInventory(updated); showMsg("Item deleted")
  }
  const addItem = async () => {
    if(!newItem.name||!newItem.bulkPrice||!newItem.unitSize||!newItem.qtyBought)return showMsg("Name, bulk price, unit size and qty bought are required")
    const cost=parseFloat((+newItem.bulkPrice/(+newItem.unitSize||1)).toFixed(2))
    const stock=parseFloat(((+newItem.unitSize)*(+newItem.qtyBought)).toFixed(3))
    const item={id:uid(),name:newItem.name,cat:newItem.cat||"General",unit:newItem.unit||"kg",unitSize:+newItem.unitSize,qtyBought:+newItem.qtyBought,bulkPrice:+newItem.bulkPrice,minStock:+newItem.minStock||5,stock,cost}
    const updated=[...inventory,item]
    setInventory(updated);await saveInventory(updated)
    setNewItem({name:"",cat:"",unit:"kg",unitSize:"",qtyBought:"",bulkPrice:"",minStock:"",stock:0,cost:0})
    setAddMode(false);showMsg("✓ Item added — cost/unit: "+fmt(cost),"green")
  }

  const handleCSV = e => {
    const file=e.target.files[0]; if(!file)return; e.target.value=""
    const reader=new FileReader()
    reader.onload=async ev=>{
      try{
        const items=parseCSV(ev.target.result)
        if(items.length===0){ showMsg("⚠ No items found. Check column headers: name, category, unit, cost, stock","red"); return }
        const updated=[...inventory,...items.filter(ni=>!inventory.find(i=>i.name.toLowerCase()===ni.name.toLowerCase()))]
        setInventory(updated); await saveInventory(updated)
        showMsg(`✓ ${items.length} items imported successfully (${updated.length-inventory.length} new, duplicates skipped)`,"green")
      }catch(err){ showMsg(`⚠ Import failed: ${err.message}`,"red") }
    }
    reader.readAsText(file)
  }

  const restock = async (id, qty) => {
    if(!qty||+qty<=0)return
    const updated=inventory.map(i=>i.id===id?{...i,stock:parseFloat((i.stock+(+qty)).toFixed(3))}:i)
    setInventory(updated); await saveInventory(updated)
  }

  // ── Recipes ──
  const openRecipe = (r) => setRecipeModal(r ? {...r} : {id:uid(),name:"",size:"6",tiers:1,covering:"buttercream",ing:[]})
  const saveRecipe = async () => {
    if(!recipeModal.name)return showMsg("Recipe name is required")
    const updated = recipes.find(r=>r.id===recipeModal.id) ? recipes.map(r=>r.id===recipeModal.id?recipeModal:r) : [...recipes, recipeModal]
    setRecipes(updated); saveRecipes(updated); setRecipeModal(null); showMsg("✓ Recipe saved","green")
  }
  const deleteRecipe = async (id) => {
    if(!confirm("Delete this recipe?"))return
    const updated=recipes.filter(r=>r.id!==id); setRecipes(updated); saveRecipes(updated); showMsg("Recipe deleted")
  }
  const duplicateRecipe = (r) => {
    const copy={...r,id:uid(),name:r.name+" (copy)",ing:r.ing?r.ing.map(i=>({...i})):[]}
    const updated=[...recipes,copy]
    setRecipes(updated);saveRecipes(updated)
    setRecipeModal(copy)
    showMsg("✓ Recipe duplicated — rename it and adjust quantities","green")
  }
  const addIngToRecipe = () => setRecipeModal(r=>({...r,ing:[...r.ing,{iid:"",qty:""}]}))
  const updateIng = (idx,field,val) => setRecipeModal(r=>({...r,ing:r.ing.map((ing,i)=>i===idx?{...ing,[field]:val}:ing)}))
  const removeIng = (idx) => setRecipeModal(r=>({...r,ing:r.ing.filter((_,i)=>i!==idx)}))

  const cats=[...new Set(inventory.map(i=>i.cat))].sort()

  return <div>
    <SHead title="Master List" sub="All your ingredients, recipes, and decorations — changes here update all calculations."/>
    <Alert msg={msg} color={msgColor} onClose={()=>setMsg("")}/>
    <Tabs tabs={[{v:"inventory",l:"Inventory"},{v:"recipes",l:"Base Recipes"},{v:"decorations",l:"Decoration Extras"},{v:"packaging",l:"Boards & Packaging"}]} active={tab} onChange={setTab}/>

    {/* ── INVENTORY ── */}
    {tab==="inventory"&&<InventoryTab inventory={inventory} setInventory={setInventory} isOwner={isOwner} showMsg={showMsg} setView={setView} setTab={setTab}/>}

    {/* ── RECIPES ── */}
    {tab==="recipes"&&<div>
      <div style={{marginBottom:12,padding:"10px 14px",background:"#FFF9EE",borderRadius:8,border:"1px solid var(--gold)",fontSize:13,lineHeight:1.7}}>
        Each recipe is for <strong>1 layer</strong> of that flavour. When you log a production, select the recipe and enter the number of layers — the app multiplies automatically.
      </div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <span style={{fontSize:13,color:"var(--muted)"}}>{recipes.length} recipes · click any card to expand</span>
        {isOwner&&<Btn small onClick={()=>openRecipe(null)}>+ New Recipe</Btn>}
      </div>
      {recipes.map(r=><RecipeCard key={r.id} r={r} inventory={inventory} isOwner={isOwner} onEdit={()=>openRecipe(r)} onDelete={()=>deleteRecipe(r.id)} onDuplicate={()=>duplicateRecipe(r)}/>)}
      {recipeModal&&<Modal title={recipeModal.name?"Edit Recipe":"New Recipe"} onClose={()=>setRecipeModal(null)}>
        <Inp label="Recipe Name * (e.g. Vanilla Cake, Buttercream)" value={recipeModal.name} onChange={v=>setRecipeModal(r=>({...r,name:v}))}/>
        <div style={{marginBottom:11}}>
          <label style={{fontSize:10.5,color:"var(--muted)",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:.8,fontWeight:500}}>Recipe type *</label>
          <div style={{display:"flex",gap:8}}>
            {[{v:"layer",l:"🎂 Cake layer",sub:"Vanilla, Red Velvet, Chocolate etc."},{v:"covering",l:"🍦 Covering / Filling",sub:"Buttercream, Fondant, Ganache etc."},{v:"pastry",l:"🍩 Pastry / Batch",sub:"Donuts, tarts, brownies, loaves etc."}].map(t=><div key={t.v} onClick={()=>setRecipeModal(r=>({...r,type:t.v}))} style={{flex:1,padding:"10px 12px",borderRadius:8,border:`1.5px solid ${(recipeModal.type||"layer")===t.v?"var(--gold)":"var(--border)"}`,background:(recipeModal.type||"layer")===t.v?"#FFF9EE":"var(--panel)",cursor:"pointer"}}>
              <div style={{fontSize:13,fontWeight:500,color:(recipeModal.type||"layer")===t.v?"var(--gold)":"var(--text)"}}>{t.l}</div>
              <div style={{fontSize:11,color:"var(--muted)",marginTop:2}}>{t.sub}</div>
            </div>)}
          </div>
        </div>
        <Inp label="Notes (optional)" value={recipeModal.notes||""} onChange={v=>setRecipeModal(r=>({...r,notes:v}))} placeholder="e.g. Classic vanilla sponge"/>
        <div style={{padding:"8px 12px",background:"#FFF9EE",borderRadius:7,fontSize:12.5,color:"var(--gold)",marginBottom:12}}>
          {(recipeModal.type||"layer")==="layer"
            ?<span>Enter quantities for <strong>one single layer</strong>. The app multiplies by number of layers automatically.</span>
            :(recipeModal.type||"layer")==="covering"
            ?<span>Enter quantities for <strong>one full batch</strong>. Enter the total weight your batch makes below so cost per gram can be calculated.</span>
            :<span>Enter quantities for <strong>one full batch</strong>. Enter how many pieces your batch makes so cost per piece can be calculated.</span>}
        </div>
        {(recipeModal.type||"layer")==="covering"&&<div style={{marginBottom:11,display:"flex",gap:8,alignItems:"center"}}>
          <Inp label="Total batch weight (g)" type="number" value={recipeModal.batchWeight||""} onChange={v=>setRecipeModal(r=>({...r,batchWeight:v}))} placeholder="e.g. 1200"/>
          <div style={{fontSize:12,color:"var(--muted)",marginTop:18,whiteSpace:"nowrap"}}>grams per batch</div>
        </div>}
        {recipeModal.type==="pastry"&&<div style={{marginBottom:11,display:"flex",gap:8,alignItems:"center"}}>
          <Inp label="Pieces per batch" type="number" value={recipeModal.batchSize||""} onChange={v=>setRecipeModal(r=>({...r,batchSize:+v||0}))} placeholder="e.g. 12"/>
          <div style={{fontSize:12,color:"var(--muted)",marginTop:18,whiteSpace:"nowrap"}}>pieces per batch</div>
        </div>}
        <div style={{fontWeight:600,fontSize:13,marginBottom:8}}>
          {recipeModal.type==="pastry"?"Ingredients (per batch)":recipeModal.type==="covering"?"Ingredients (per batch)":"Ingredients (per 1 layer)"}
        </div>
        {recipeModal.ing.map((ing,idx)=>{
          const options = inventory
            .filter(i => i.cat !== "Board and Packaging" && i.category !== "Board and Packaging")
            .map(i => ({
              value: i.id,
              label: `${i.name} (${i.unit}) — ${fmt(i.cost)}/${i.unit}`
            }))
          return <div key={idx} style={{display:"flex",gap:8,marginBottom:6,alignItems:"center"}}>
            <SearchableSelect
              value={ing.iid}
              onChange={val => updateIng(idx,"iid",val)}
              options={options}
              placeholder="Type to search ingredient..."
            />
            <input type="number" placeholder="Qty" value={ing.qty} onChange={e=>updateIng(idx,"qty",e.target.value)} style={{...iSt,width:70,fontSize:12}}/>
            <Btn small variant="danger" onClick={()=>removeIng(idx)}>×</Btn>
          </div>
        })}
        <Btn small variant="ghost" onClick={addIngToRecipe}>+ Add Ingredient</Btn>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <Btn small variant="outline" onClick={() => setShowRecipeExcelImport(true)}>📋 Import from Excel</Btn>
          <Btn small variant="outline" onClick={() => setShowRecipeScan(true)}>📸 Scan Recipe (AI)</Btn>
        </div>
        {recipeModal.ing.length>0&&<div style={{marginTop:10,padding:"8px 12px",background:"#F5F0E4",borderRadius:7,fontSize:13}}>
          {recipeModal.type==="pastry"
            ?<>Batch cost: <strong style={{color:"var(--gold)"}}>{fmt(recipeCost(recipeModal,inventory))}</strong>
              {recipeModal.batchSize>0&&<span style={{marginLeft:8,color:"var(--muted)"}}>· Cost per piece: <strong style={{color:"var(--gold)"}}>{fmt(recipeCost(recipeModal,inventory)/(recipeModal.batchSize))}</strong></span>}</>
            :<>Cost per {recipeModal.type==="covering"?"batch":"layer"}: <strong style={{color:"var(--gold)"}}>{fmt(recipeCost(recipeModal,inventory))}</strong></>}
        </div>}
        <div style={{marginTop:12,display:"flex",gap:8}}><Btn variant="success" onClick={saveRecipe}>✓ Save Recipe</Btn><Btn variant="ghost" onClick={()=>setRecipeModal(null)}>Cancel</Btn></div>
      </Modal>}

      {showRecipeExcelImport && (
        <Modal title="Import Recipe Ingredients from Excel" onClose={() => setShowRecipeExcelImport(false)}>
          <RecipeExcelImportModal 
            inventory={inventory} 
            onClose={() => setShowRecipeExcelImport(false)}
            onImport={(importedIngs) => {
              setRecipeModal(r => ({
                ...r,
                ing: [...(r.ing || []), ...importedIngs]
              }))
              setShowRecipeExcelImport(false)
            }}
          />
        </Modal>
      )}

      {showRecipeScan && (
        <Modal title="Scan Recipe (AI)" onClose={() => setShowRecipeScan(false)}>
          <RecipeScanModal 
            inventory={inventory} 
            onClose={() => setShowRecipeScan(false)}
            onImport={(scannedIngs) => {
              setRecipeModal(r => ({
                ...r,
                ing: [...(r.ing || []), ...scannedIngs]
              }))
              setShowRecipeScan(false)
            }}
          />
        </Modal>
      )}
    </div>}

    {/* ── DECORATIONS ── */}
    {tab==="decorations"&&<DecorationsTab inventory={inventory} setInventory={setInventory} isOwner={isOwner}/>}
    {/* ── PACKAGING ── */}
    {tab==="packaging"&&<PackagingTab inventory={inventory} setInventory={setInventory} isOwner={isOwner}/>}
  </div>
}

export function RecipeExcelImportModal({ inventory, onClose, onImport }) {
  const [pasteN, setPasteN] = useState("")
  const [pasteQ, setPasteQ] = useState("")
  const [importStep, setImportStep] = useState(1) // 1 = paste, 2 = preview
  const [prevItems, setPrevItems] = useState([])
  const [warnMsg, setWarnMsg] = useState("")

  const L = v => v.trim().split(String.fromCharCode(10)).map(s => s.trim()).filter(Boolean)

  const checkMatch = () => {
    const ns = L(pasteN), qs = L(pasteQ)
    if (ns.length > 0 && qs.length > 0 && ns.length !== qs.length) {
      setWarnMsg(`Names: ${ns.length} rows — Quantities: ${qs.length} rows. Must match.`)
    } else {
      setWarnMsg("")
    }
  }

  const doPreview = () => {
    const ns = L(pasteN), qs = L(pasteQ)
    if (!ns.length) return alert("Ingredient names are required")
    if (ns.length !== qs.length && qs.length > 0) {
      return alert(`Names (${ns.length}) and quantities (${qs.length}) must have the same number of rows`)
    }
    
    const parsed = ns.map((name, i) => {
      const qtyStr = qs[i] || "1"
      const qty = parseFloat(qtyStr.replace(/[^0-9.]/g, "")) || 1
      
      // Match against inventory
      const match = inventory.find(item => item.name.toLowerCase() === name.toLowerCase()) 
        || inventory.find(item => item.name.toLowerCase().includes(name.toLowerCase()))
        || inventory.find(item => name.toLowerCase().includes(item.name.toLowerCase()))
      
      return {
        id: uid(),
        pastedName: name,
        iid: match ? match.id : "",
        qty,
        on: true
      }
    })
    setPrevItems(parsed)
    setImportStep(2)
  }

  const confirmImport = () => {
    const approved = prevItems.filter(p => p.on && p.iid)
    const formatted = approved.map(p => ({
      iid: p.iid,
      qty: parseFloat(p.qty) || 1
    }))
    onImport(formatted)
  }

  return (
    <div>
      {importStep === 1 && (
        <div>
          <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 10, lineHeight: 1.7 }}>
            Copy column of Ingredient Names and another of Quantities from Excel and paste here.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 10.5, color: "var(--muted)", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: .8 }}>Ingredient Names *</label>
              <textarea
                value={pasteN}
                onChange={e => { setPasteN(e.target.value); checkMatch() }}
                placeholder="e.g. Flour&#10;Sugar&#10;Butter"
                style={{ width: "100%", minHeight: 150, padding: 8, borderRadius: 8, border: "1px solid var(--border)", background: "var(--panel)", fontSize: 12.5, fontFamily: "monospace", color: "var(--text)" }}
              />
            </div>
            <div>
              <label style={{ fontSize: 10.5, color: "var(--muted)", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: .8 }}>Quantities *</label>
              <textarea
                value={pasteQ}
                onChange={e => { setPasteQ(e.target.value); checkMatch() }}
                placeholder="e.g. 0.5&#10;0.25&#10;0.3"
                style={{ width: "100%", minHeight: 150, padding: 8, borderRadius: 8, border: "1px solid var(--border)", background: "var(--panel)", fontSize: 12.5, fontFamily: "monospace", color: "var(--text)" }}
              />
            </div>
          </div>
          {warnMsg && <div style={{ padding: "7px 12px", background: "#FDEBE9", borderRadius: 7, fontSize: 12, color: "#B03A2E", marginBottom: 10 }}>⚠ {warnMsg}</div>}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Btn onClick={doPreview} disabled={!pasteN.trim() || !!warnMsg}>Preview & Match →</Btn>
            <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          </div>
        </div>
      )}

      {importStep === 2 && (
        <div>
          <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 10 }}>
            Verify matched ingredients. Select unmatched items from the dropdown if needed.
          </div>
          <div style={{ overflowY: "auto", maxHeight: 300, marginBottom: 12 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: "#EDE5D6" }}>
                  <th style={{ padding: "7px 10px" }}></th>
                  <th style={{ padding: "7px 10px", textAlign: "left" }}>Pasted Name</th>
                  <th style={{ padding: "7px 10px", textAlign: "left" }}>Linked Ingredient</th>
                  <th style={{ padding: "7px 10px", textAlign: "right" }}>Qty</th>
                </tr>
              </thead>
              <tbody>
                {prevItems.map((p, i) => {
                  const matched = inventory.find(item => item.id === p.iid)
                  return (
                    <tr key={p.id} style={{ background: i % 2 === 0 ? "var(--panel)" : "#F8F3EA", opacity: p.on ? 1 : 0.45 }}>
                      <td style={{ padding: "6px 10px" }}>
                        <input
                          type="checkbox"
                          checked={p.on}
                          onChange={() => setPrevItems(prev => prev.map(x => x.id === p.id ? { ...x, on: !x.on } : x))}
                        />
                      </td>
                      <td style={{ padding: "6px 10px", fontWeight: 500 }}>{p.pastedName}</td>
                      <td style={{ padding: "6px 10px" }}>
                        <select
                          value={p.iid}
                          onChange={e => setPrevItems(prev => prev.map(x => x.id === p.id ? { ...x, iid: e.target.value } : x))}
                          style={{ width: "100%", padding: "4px", borderRadius: 4, border: "1px solid var(--border)" }}
                        >
                          <option value="">— Unmatched (select to link) —</option>
                          {inventory.filter(item => item.cat !== "Board and Packaging" && item.category !== "Board and Packaging").map(item => (
                            <option key={item.id} value={item.id}>{item.name} ({item.unit})</option>
                          ))}
                        </select>
                      </td>
                      <td style={{ padding: "6px 10px", textAlign: "right" }}>
                        <input
                          type="number"
                          value={p.qty}
                          onChange={e => setPrevItems(prev => prev.map(x => x.id === p.id ? { ...x, qty: e.target.value } : x))}
                          style={{ width: 60, padding: 4, textAlign: "right" }}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Btn variant="success" onClick={confirmImport} disabled={!prevItems.some(p => p.on && p.iid)}>
              ✓ Import Selected ({prevItems.filter(p => p.on && p.iid).length})
            </Btn>
            <Btn variant="ghost" onClick={() => setImportStep(1)}>← Edit</Btn>
          </div>
        </div>
      )}
    </div>
  )
}

export function RecipeScanModal({ inventory, onClose, onImport }) {
  const [photo, setPhoto] = useState(null)
  const [photoB64, setPhotoB64] = useState(null)
  const [pasteText, setPasteText] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [parsedItems, setParsedItems] = useState(null) // [{ name, qty, iid, on: true }]
  const fileRef = useRef()

  const handleFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setPhoto(URL.createObjectURL(file))
    const r = new FileReader()
    r.onload = (ev) => setPhotoB64(ev.target.result.split(",")[1])
    r.readAsDataURL(file)
    setParsedItems(null)
    setError("")
  }

  const scan = async () => {
    setLoading(true)
    setError("")
    try {
      let content = []
      
      if (photoB64) {
        const compressed = await compressImage(photoB64, 1200)
        content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: compressed } })
      }
      
      const invList = inventory.map(i => `${i.id}:${i.name}`).join(", ")
      const promptText = `This is a baking recipe. Extract all ingredients and their quantities (scale to standard base units if possible).
      
      Inventory list to match against:
      ${invList}
      
      For each ingredient, extract the quantity as a float number (if units are cups, spoons, etc., make best estimate or default to standard float).
      
      Return ONLY this exact JSON format, no other text:
      {
        "ingredients": [
          {"name": "ingredient name", "qty": 0.5, "matched_id": "matched inventory item id if found"}
        ]
      }`

      if (pasteText.trim()) {
        content.push({ type: "text", text: `Here is the recipe text:\n${pasteText}\n\n${promptText}` })
      } else {
        content.push({ type: "text", text: promptText })
      }

      const raw = await callClaude([
        {
          role: "user",
          content: content
        }
      ], "Parse recipe sheets and extract ingredients with quantities matching inventory list. Return valid JSON only.")

      const cleanJson = raw.replace(/```json|```/g, "").trim()
      const result = JSON.parse(cleanJson)
      if (!result.ingredients || result.ingredients.length === 0) throw new Error("No ingredients detected.")
      
      setParsedItems(result.ingredients.map(r => {
        // Double check matching
        let iid = r.matched_id || ""
        if (!iid) {
          const match = inventory.find(item => item.name.toLowerCase() === r.name.toLowerCase()) 
            || inventory.find(item => item.name.toLowerCase().includes(r.name.toLowerCase()))
          if (match) iid = match.id
        }
        return {
          id: uid(),
          pastedName: r.name,
          iid,
          qty: parseFloat(r.qty) || 1,
          on: true
        }
      }))
    } catch (err) {
      setError(`Scanner failed: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const confirmImport = () => {
    const approved = parsedItems.filter(p => p.on && p.iid)
    const formatted = approved.map(p => ({
      iid: p.iid,
      qty: parseFloat(p.qty) || 1
    }))
    onImport(formatted)
  }

  return (
    <div>
      {!parsedItems ? (
        <div>
          <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>
            Provide recipe details using any method below:
          </div>

          {/* Paste Recipe Text */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 10.5, color: "var(--muted)", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: .8 }}>Option A: Paste Recipe Text</label>
            <textarea
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
              placeholder="e.g. 2 cups flour, 1/2 cup sugar, 250g butter..."
              style={{ width: "100%", minHeight: 90, padding: 8, borderRadius: 8, border: "1px solid var(--border)", background: "var(--panel)", fontSize: 12.5, color: "var(--text)" }}
            />
          </div>

          {/* Upload Recipe Photo */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 10.5, color: "var(--muted)", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: .8 }}>Option B: Scan Recipe Photo</label>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <button
                onClick={() => {
                  const inp = document.createElement("input")
                  inp.type = "file"
                  inp.accept = "image/*"
                  inp.onchange = handleFile
                  inp.click()
                }}
                style={{ padding: "10px 14px", borderRadius: 8, border: "2px dashed var(--border)", background: "#FAF7F0", cursor: "pointer", fontSize: 12.5, fontWeight: 500 }}
              >
                📸 Choose image / Open camera
              </button>
              {photo && (
                <div style={{ border: "1px solid var(--border)", borderRadius: 6, padding: 2, background: "#fff" }}>
                  <img src={photo} alt="recipe preview" style={{ maxHeight: 60, borderRadius: 4 }} />
                </div>
              )}
            </div>
          </div>

          {error && <div style={{ padding: "8px 12px", background: "#FDEBE9", borderRadius: 8, fontSize: 12.5, color: "#B03A2E", marginBottom: 12 }}>⚠ {error}</div>}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", borderTop: "1px solid var(--border)", paddingTop: 12 }}>
            <Btn onClick={scan} disabled={loading || (!pasteText.trim() && !photoB64)}>
              {loading ? "🔍 AI is reading recipe..." : "✦ AI Scan & Extract"}
            </Btn>
            <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          </div>
        </div>
      ) : (
        <div>
          <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 10 }}>
            Check extracted ingredients. Select unmatched items from the dropdown if needed.
          </div>
          <div style={{ overflowY: "auto", maxHeight: 300, marginBottom: 12 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: "#EDE5D6" }}>
                  <th style={{ padding: "7px 10px" }}></th>
                  <th style={{ padding: "7px 10px", textAlign: "left" }}>Extracted Name</th>
                  <th style={{ padding: "7px 10px", textAlign: "left" }}>Linked Ingredient</th>
                  <th style={{ padding: "7px 10px", textAlign: "right" }}>Qty</th>
                </tr>
              </thead>
              <tbody>
                {parsedItems.map((p, i) => (
                  <tr key={p.id} style={{ background: i % 2 === 0 ? "var(--panel)" : "#F8F3EA", opacity: p.on ? 1 : 0.45 }}>
                    <td style={{ padding: "6px 10px" }}>
                      <input
                        type="checkbox"
                        checked={p.on}
                        onChange={() => setParsedItems(prev => prev.map(x => x.id === p.id ? { ...x, on: !x.on } : x))}
                      />
                    </td>
                    <td style={{ padding: "6px 10px", fontWeight: 500 }}>{p.pastedName}</td>
                    <td style={{ padding: "6px 10px" }}>
                      <select
                        value={p.iid}
                        onChange={e => setParsedItems(prev => prev.map(x => x.id === p.id ? { ...x, iid: e.target.value } : x))}
                        style={{ width: "100%", padding: "4px", borderRadius: 4, border: "1px solid var(--border)" }}
                      >
                        <option value="">— Unmatched (select to link) —</option>
                        {inventory.filter(item => item.cat !== "Board and Packaging" && item.category !== "Board and Packaging").map(item => (
                          <option key={item.id} value={item.id}>{item.name} ({item.unit})</option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: "6px 10px", textAlign: "right" }}>
                      <input
                        type="number"
                        value={p.qty}
                        onChange={e => setParsedItems(prev => prev.map(x => x.id === p.id ? { ...x, qty: e.target.value } : x))}
                        style={{ width: 60, padding: 4, textAlign: "right" }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Btn variant="success" onClick={confirmImport} disabled={!parsedItems.some(p => p.on && p.iid)}>
              ✓ Add to Recipe ({parsedItems.filter(p => p.on && p.iid).length})
            </Btn>
            <Btn variant="ghost" onClick={() => setParsedItems(null)}>← Scan again</Btn>
          </div>
        </div>
      )}
    </div>
  )
}
