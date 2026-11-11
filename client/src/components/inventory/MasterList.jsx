/**
 * MasterList.jsx
 * ----------------------------------------------------------------------------
 * Master List screen: inventory, recipes, decorations, packaging.
 * MasterList is the container with tabs; the others are its tab panels.
 * RecipeCard also exposes the Duplicate-recipe action.
 * ----------------------------------------------------------------------------
 */
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { Btn, iSt, Inp, Sel, Card, SHead, Tabs, TH, Modal, Alert, SearchableSelect, Spinner, Pagination } from "../common/ui.jsx"
import { fmt, fmtCost, fmtQty, uid, recipeCost, parseCSV, callClaude, compressImage, mapCategory, DEFAULT_CATEGORIES, formatApiError, COVERAGE_PRESETS, getRecipeCoverageValues, calculateCakeGeometry, calculateFillingGrams, calculateCoveringGrams, calibrateCoverageRates } from "../../lib/helpers.js"
import { planArea, perimeter, gapArea, surfaceArea, calculateDensity, gramsPerPan, coveringMass, reverseThicknessMm, CM2 } from "../../lib/cakeGeometry.js"

import { DECORATION_ITEMS, DEFAULT_MULTS } from "../../constants.js"
import { 
  saveInventory, 
  saveRecipes, 
  saveLocal, 
  loadLocal, 
  deleteAllInventoryOnServer, 
  batchDeleteInventoryOnServer,
  createInventoryItemOnServer,
  updateInventoryItemOnServer,
  deleteInventoryItemOnServer,
  createRecipeOnServer,
  updateRecipeOnServer,
  deleteRecipeOnServer
} from "../../lib/data.js"
import { Pencil, Trash2, Check, X, AlertTriangle, ShoppingCart, Folder, FileSpreadsheet, Camera, Sparkles, Plus, ChevronUp, ChevronDown, Download, Search } from "lucide-react"
import { exportInventoryPDF } from "../../lib/pdfReportGenerator.js"



export function RestockCell({id,unit,onRestock}){
  const [qty,setQty]=useState("")
  return <div style={{display:"flex",gap:4,alignItems:"center"}}>
    <input type="number" step="any" placeholder="qty" value={qty} onChange={e=>setQty(e.target.value)} style={{...iSt,width:55,padding:"4px 6px",fontSize:12}}/>
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
  const cov = isCovering ? getRecipeCoverageValues(r) : null
  const [dismissPrompt, setDismissPrompt] = useState(false)

  // Load multipliers from database/cache (set in Settings → Pricing setup)
  const getMult=()=>{
    try{
      const all=loadLocal("ll_multipliers", DEFAULT_MULTS)
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
          {isCovering&&<span style={{fontSize:10,background:"#E8EFFC",color:"#2355A0",padding:"2px 7px",borderRadius:20,fontWeight:500}}>Covering · {[r.canFill !== false && r.canFill !== null ? "Fill" : null, r.canCrumb !== false && r.canCrumb !== null ? "Crumb" : null, r.canFinish !== false && r.canFinish !== null ? "Finish" : null].filter(Boolean).join(" | ") || "General"}</span>}
          {isPastry&&<span style={{fontSize:10,background:"#FAEEDA",color:"#8C5E00",padding:"2px 7px",borderRadius:20,fontWeight:500}}>Pastry · {r.perBatch || r.batchSize || "?"} {r.sellMode === "weight" ? "g" : "pcs"}/batch</span>}
          {!isCovering&&!isPastry&&(
            <>
              <span style={{fontSize:10,background:"#FFF9EE",color:"var(--gold)",border:"1px solid var(--border)",padding:"2px 7px",borderRadius:20,fontWeight:600}}>
                Total Batch: {fmt(batchCostTotal)} · {fmt(batchCostTotal / (parseFloat(r.yieldLayers) || 1))}/layer
              </span>
              <span style={{fontSize:10,background:(r.isCalibrated || r.density) ? "#E8F5EE" : "#FFF9EE",color:(r.isCalibrated || r.density) ? "#1E6B37" : "var(--gold)",border:"1px solid var(--border)",padding:"2px 7px",borderRadius:20,fontWeight:600}}>
                {(r.isCalibrated || r.density) ? `Calibrated · ${Number(r.density || 0).toFixed(2)} g/in³` : "Cake Layer · Uncalibrated"}
              </span>
            </>
          )}
        </div>
        {cleanNote&&<div style={{fontSize:11.5,color:"var(--muted)",marginTop:2}}>{cleanNote}</div>}
      </div>
      <div style={{display:"flex",gap:6,alignItems:"center"}}>
        {isOwner&&<div style={{display:"flex",gap:4}} onClick={e=>e.stopPropagation()}>
          <Btn small variant="ghost" onClick={onEdit} style={{display:"inline-flex",alignItems:"center",gap:4}}><Pencil size={11}/> Edit</Btn>
          {onDuplicate&&<Btn small variant="ghost" onClick={onDuplicate}>Duplicate</Btn>}
          <Btn small variant="danger" onClick={onDelete} style={{display:"inline-flex",alignItems:"center",gap:4}}><X size={11}/></Btn>
        </div>}
        <span style={{color:"var(--muted)",display:"flex",alignItems:"center",marginLeft:4}}>{open ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}</span>
      </div>
    </div>

    {isCovering && !cov?.is_calibrated && !dismissPrompt && (
      <div
        onClick={e => e.stopPropagation()}
        style={{
          marginTop: 8,
          padding: "8px 12px",
          background: "#F0F4FA",
          border: "1px solid #D2E0F5",
          borderRadius: 8,
          fontSize: 12,
          color: "#2355A0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, lineHeight: 1.4 }}>
          <span>💡</span>
          <span>Using starting amounts. These are a sensible guess. Open the recipe and tell it one cake you have already made, and it will match your own hand instead.</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <button
            onClick={onEdit}
            style={{
              background: "#2355A0",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              padding: "4px 10px",
              fontSize: 11.5,
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            Adjust
          </button>
          <button
            onClick={() => setDismissPrompt(true)}
            style={{
              background: "transparent",
              color: "#8AA0C4",
              border: "none",
              cursor: "pointer",
              padding: "2px 4px",
              fontSize: 14,
              lineHeight: 1
            }}
            title="Dismiss"
          >
            ×
          </button>
        </div>
      </div>
    )}

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
                  <td style={{textAlign:"right",fontSize:12,color:"var(--muted)"}}>{fmtCost(it.cost)}/{it.unit}</td>
                  <td style={{textAlign:"right",fontSize:13,fontWeight:500}}>{fmtCost(lineCost)}</td>
                </tr>
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} style={{textAlign:"right",fontSize:12,color:"var(--muted)",paddingTop:8,borderTop:"1px solid var(--border)"}}>Total ingredient cost</td>
                <td style={{textAlign:"right",fontWeight:700,color:"var(--gold)",fontSize:16,paddingTop:8,borderTop:"1px solid var(--border)"}}>{fmt(batchCostTotal*(isPastry?+batchCount:isCovering?1:mult!==null?factor:1))}</td>
              </tr>
              {!isPastry&&!isCovering&&(
                <>
                  <tr>
                    <td colSpan={3} style={{textAlign:"right",fontSize:12,color:"var(--muted)",paddingTop:6}}>Base batch total</td>
                    <td style={{textAlign:"right",fontWeight:600,color:"var(--text)",fontSize:13,paddingTop:6}}>{fmt(batchCostTotal)}</td>
                  </tr>
                  <tr>
                    <td colSpan={3} style={{textAlign:"right",fontSize:12,color:"var(--muted)",paddingTop:4}}>Cost per layer</td>
                    <td style={{textAlign:"right",fontWeight:600,color:"var(--gold)",fontSize:13,paddingTop:4}}>{fmt(batchCostTotal / (parseFloat(r.yieldLayers) || 1))}</td>
                  </tr>
                </>
              )}
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
                      <span style={{fontSize:11,color:"#357A52",whiteSpace:"nowrap",display:"inline-flex",alignItems:"center",gap:3}}><Check size={11}/> Set</span>
                    </div>
                  :<div style={{padding:"7px 12px",borderRadius:8,border:"1px solid #F0C0BB",background:"#FDEBE9",fontSize:13,color:"#B03A2E"}}>
                      Not set — go to <strong>Settings → Pricing setup</strong> to add this size/shape multiplier.
                    </div>
                }
              </div>
              <div style={{background:"var(--panel)",border:"1px solid var(--border)",borderRadius:8,padding:"10px 12px",display:"flex",flexDirection:"column",gap:6}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
                  <span style={{fontSize:11.5,color:"var(--muted)"}}>Total batch (all ingredients)</span>
                  <span style={{fontSize:14,fontWeight:600,color:"var(--text)"}}>{fmt(batchCostTotal)}</span>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
                  <span style={{fontSize:11.5,color:"var(--muted)"}}>Cost per layer</span>
                  <span style={{fontSize:14,fontWeight:600,color:"var(--gold)"}}>{fmt(batchCostTotal / (parseFloat(r.yieldLayers) || 1))}</span>
                </div>
                {mult!==null&&<div style={{borderTop:"1px dashed var(--border)",paddingTop:6,marginTop:2}}>
                  <div style={{fontSize:11,color:"var(--muted)",marginBottom:3}}>{size}" · {shape} · {layers} layer{+layers>1?"s":""} scaled</div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
                    <span style={{fontSize:12,color:"var(--muted)",fontWeight:500}}>Scaled order cost</span>
                    <span style={{fontSize:18,fontWeight:700,color:"var(--gold)"}}>{fmt(r.ing.reduce((s,ing)=>{const it=inventory.find(x=>x.id===ing.iid);return s+(it?it.cost*ing.qty*factor:0)},0))}</span>
                  </div>
                </div>}
              </div>
            </>}

          </div>
        </div>

      </div>
    </div>}
  </Card>
}

// ═══════════════════════════════════════════════════════════
//  DECORATIONS TAB (standalone — own state, saved to sessionStorage)

// ═══════════════════════════════════════════════════════════
export function InventoryTab({inventory,setInventory,isOwner,showMsg=()=>{},setView,setTab,searchQuery="",company={}}){
  const [showImport,setShowImport]=useState(false)
  const [showAdd,setShowAdd]=useState(false)
  const [saving,setSaving]=useState(false)
  const [deletingAll,setDeletingAll]=useState(false)
  const [currentPage,setCurrentPage]=useState(1)
  const [pageSize,setPageSize]=useState(25)
  const [selectedCategory,setSelectedCategory]=useState("all")

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, selectedCategory])

  const [importStep,setImportStep]=useState(1) // 1=paste 2=preview 3=done
  const [prevItems,setPrevItems]=useState([])
  const [pasteN,setPasteN]=useState("")
  const [pasteU,setPasteU]=useState("")
  const [pasteC,setPasteC]=useState("")
  const [calcMode,setCalcMode]=useState("manual") // "manual" or "auto"
  const [newItem,setNewItem]=useState({name:"",unit:"kg",cost:"",minStock:"",cat:"Dry Goods",totalPaid:"",qtyBought:""})
  const [editId,setEditId]=useState(null)
  const [editRow,setEditRow]=useState({})
  const [warnMsg,setWarnMsg]=useState("")

  const handleDeleteAllInventory = async () => {
    if (inventory.length === 0) {
      showMsg("Inventory is already empty", "gold")
      return
    }
    const confirmed = window.confirm(
      `ARE YOU SURE YOU WANT TO DELETE ALL ${inventory.length} INVENTORY ITEMS?\n\nThis will permanently delete all inventory items directly from the database and unlink associated purchases. This action cannot be undone.`
    )
    if (!confirmed) return
    const secondCheck = window.confirm(
      "Please confirm again: Do you really want to permanently delete all inventory items from the database?"
    )
    if (!secondCheck) return

    setDeletingAll(true)
    try {
      await deleteAllInventoryOnServer()
      setInventory([])
      setSelectedItemIds(new Set())
      setCurrentPage(1)
      showMsg("All inventory items successfully deleted from database", "green")
    } catch (e) {
      showMsg("Failed to delete inventory: " + e.message, "red")
    } finally {
      setDeletingAll(false)
    }
  }

  // Custom Categories state
  const [customCategories, setCustomCategories] = useState(() => loadLocal("ll_custom_categories", []))
  const [showAddCatModal, setShowAddCatModal] = useState(false)

  const [newCatName, setNewCatName] = useState("")
  const [customCatInput, setCustomCatInput] = useState("")

  const addCustomCategory = async (name) => {
    const trimmed = (name || "").trim()
    if (!trimmed) return ""
    if (!DEFAULT_CATEGORIES.includes(trimmed) && !customCategories.includes(trimmed)) {
      const updated = [...customCategories, trimmed]
      setCustomCategories(updated)
      await saveLocal("ll_custom_categories", updated)
    }
    return trimmed
  }

  const allCategoryOptions = useMemo(() => {
    const invCats = inventory.map(i => mapCategory(i.cat, i.name)).filter(Boolean)
    return Array.from(new Set([...DEFAULT_CATEGORIES, ...customCategories, ...invCats]))
  }, [customCategories, inventory])

  const [collapsedCats, setCollapsedCats] = useState({})

  const toggleCat = (cat) => setCollapsedCats(prev => ({ ...prev, [cat]: !prev[cat] }))

  const L=v=>v.trim().split(String.fromCharCode(10)).map(s=>{
    const str = s.trim()
    return (str.includes(',') && !str.includes('.') && /^\d+,\d{1,4}$/.test(str)) ? str.replace(',', '.') : str.replace(/,/g, "")
  }).filter(Boolean)

  const getMinStock = (item) => (item?.minStock !== undefined && item?.minStock !== null && item?.minStock !== "" && !isNaN(Number(item?.minStock)) ? Number(item.minStock) : 5)
  const lowStock=inventory.filter(i=>(Number(i.stock) || 0) <= getMinStock(i))
  const okCount=inventory.filter(i=>(Number(i.stock) || 0) > getMinStock(i)).length

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
      const cleanedCostStr = (rawCost.includes(',') && !rawCost.includes('.') && /^\d+,\d{1,4}$/.test(rawCost.trim())) ? rawCost.trim().replace(',', '.') : rawCost.replace(/[^0-9.]/g, "")
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
    setSaving(true)
    try {
      const approved=prevItems.filter(p=>p.on)
      let currentList = [...inventory]
      let addedCount = 0
      for (const ni of approved) {
        if (!currentList.find(i => i.name.toLowerCase() === ni.name.toLowerCase())) {
          const saved = await createInventoryItemOnServer({
            name: ni.name,
            unit: ni.unit || "kg",
            cost: +ni.cost,
            stock: 0,
            minStock: 5,
            cat: "Dry Goods"
          })
          currentList.push(saved)
          addedCount++
        }
      }
      setInventory(currentList)
      setPasteN("");setPasteU("");setPasteC("");setImportStep(3)
      showMsg(`${addedCount} items imported directly to database. Set opening stock in Settings → Opening Stock.`,"green")
    } catch (e) {
      showMsg("Failed to import: " + e.message, "red")
    } finally {
      setSaving(false)
    }
  }

  const addSingle=async()=>{
    let cost = newItem.cost
    if (calcMode === "auto") {
      const price = parseFloat(String(newItem.totalPaid || "").replace(",", "."))
      const qty = parseFloat(String(newItem.qtyBought || "").replace(",", "."))
      if (!newItem.totalPaid || !newItem.qtyBought || isNaN(price) || isNaN(qty) || qty <= 0) {
        return showMsg("Total amount paid and quantity bought must be valid positive numbers", "red")
      }
      cost = price / qty
    } else {
      cost = typeof cost === "string" ? parseFloat(cost.replace(",", ".")) : Number(cost)
    }
    if(!newItem.name||cost === undefined || isNaN(cost) || cost < 0)return showMsg("Name and cost per unit are required","red")

    let selectedCat = newItem.cat
    if (selectedCat === "__new__") {
      if (!customCatInput.trim()) return showMsg("Category name is required", "red")
      selectedCat = await addCustomCategory(customCatInput)
    }

    setSaving(true)
    try {
      const itemToSave = {
        name: newItem.name.trim(),
        unit: newItem.unit || "kg",
        cost: cost || 0,
        stock: 0,
        minStock: newItem.minStock !== "" && !isNaN(Number(newItem.minStock)) ? Number(newItem.minStock) : 5,
        cat: selectedCat || "Dry Goods"
      }
      const savedItem = await createInventoryItemOnServer(itemToSave)
      const updated = [...inventory.filter(i => i.id !== savedItem.id), savedItem]
      setInventory(updated)
      setNewItem({name:"",unit:"kg",cost:"",minStock:"",cat:"Dry Goods",totalPaid:"",qtyBought:""})
      setCustomCatInput("")
      setShowAdd(false)
      setCalcMode("manual")
      showMsg("Item added directly to database. Set opening stock in Settings → Opening Stock.","green")
    } catch (e) {
      showMsg("Failed to add item to database: " + e.message, "red")
    } finally {
      setSaving(false)
    }
  }

  const startEdit=(item)=>{
    setEditId(item.id)
    setEditRow({...item, cat: item.cat || mapCategory(item.cat, item.name)})
    setCustomCatInput("")
  }
  const cancelEdit=()=>{setEditId(null);setCustomCatInput("")}
  const doSaveEdit=async()=>{
    let finalCat = editRow.cat
    if (finalCat === "__new__") {
      if (!customCatInput.trim()) return showMsg("Category name is required", "red")
      finalCat = await addCustomCategory(customCatInput)
    }
    setSaving(true)
    try {
      const parsedCost = typeof editRow.cost === "string" ? parseFloat(editRow.cost.replace(",", ".")) : Number(editRow.cost)
      const parsedStock = typeof editRow.stock === "string" ? parseFloat(editRow.stock.replace(",", ".")) : Number(editRow.stock)
      const itemToUpdate = {
        name: editRow.name,
        cat: finalCat,
        unit: editRow.unit,
        cost: isNaN(parsedCost) ? 0 : parsedCost,
        stock: isNaN(parsedStock) ? 0 : parsedStock,
        minStock: editRow.minStock !== "" && !isNaN(Number(editRow.minStock)) ? Number(editRow.minStock) : 5
      }
      const updatedItem = await updateInventoryItemOnServer(editId, itemToUpdate)
      const updated = inventory.map(i => i.id === editId ? updatedItem : i)
      setInventory(updated)
      setEditId(null)
      setCustomCatInput("")
      showMsg("Item updated directly in database","green")
    } catch (e) {
      showMsg("Failed to save item: " + e.message, "red")
    } finally {
      setSaving(false)
    }
  }
  const doDelete=async(id)=>{
    if(!confirm("Delete this ingredient from database?"))return
    setSaving(true)
    try {
      await deleteInventoryItemOnServer(id)
      const updated=inventory.filter(i=>i.id!==id)
      setInventory(updated)
      showMsg("Item deleted from database","green")
    } catch (e) {
      showMsg("Failed to delete item from database: " + e.message, "red")
    } finally {
      setSaving(false)
    }
  }

  const [selectedItemIds, setSelectedItemIds] = useState(new Set())
  const [targetCatForBulk, setTargetCatForBulk] = useState("")

  const toggleSelectItem = (id) => {
    setSelectedItemIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectCategoryItems = (catItems) => {
    setSelectedItemIds(prev => {
      const next = new Set(prev)
      const catIds = catItems.map(i => i.id)
      const allSelected = catIds.length > 0 && catIds.every(id => next.has(id))
      if (allSelected) {
        catIds.forEach(id => next.delete(id))
      } else {
        catIds.forEach(id => next.add(id))
      }
      return next
    })
  }

  const clearSelection = () => {
    setSelectedItemIds(new Set())
    setTargetCatForBulk("")
    setCustomCatInput("")
  }

  const handleBulkMove = async () => {
    if (selectedItemIds.size === 0) return
    let catToApply = targetCatForBulk
    if (!catToApply) return showMsg("Please select a target category first", "red")
    if (catToApply === "__new__") {
      if (!customCatInput.trim()) return showMsg("Please enter a category name", "red")
      catToApply = await addCustomCategory(customCatInput)
    }

    setSaving(true)
    try {
      const updated = inventory.map(item => {
        if (selectedItemIds.has(item.id)) {
          return { ...item, cat: catToApply }
        }
        return item
      })
      setInventory(updated)
      await saveInventory(updated)
      showMsg(`Moved ${selectedItemIds.size} item(s) to "${catToApply}"`, "green")
      setSelectedItemIds(new Set())
      setTargetCatForBulk("")
      setCustomCatInput("")
    } catch (e) {
      showMsg("Failed to move items: " + e.message, "red")
    } finally {
      setSaving(false)
    }
  }

  const handleBulkDelete = async () => {
    if (selectedItemIds.size === 0) return
    const count = selectedItemIds.size
    const confirmed = window.confirm(
      `Are you sure you want to delete the ${count} selected item${count !== 1 ? "s" : ""}? This will permanently remove them from inventory and cannot be undone.`
    )
    if (!confirmed) return
    setSaving(true)
    try {
      const idsToDelete = Array.from(selectedItemIds)
      const updated = inventory.filter(item => !selectedItemIds.has(item.id))
      setInventory(updated)
      try {
        await batchDeleteInventoryOnServer(idsToDelete)
      } catch (err) {
        console.warn("Server batch delete error, fallback to sync:", err)
      }
      await saveInventory(updated)
      setSelectedItemIds(new Set())
      showMsg(`✓ Deleted ${count} item${count !== 1 ? "s" : ""}`, "green")
    } catch (e) {
      showMsg("Failed to delete items: " + e.message, "red")
    } finally {
      setSaving(false)
    }
  }

  const moveSingleItemCategory = async (itemId, newCat) => {
    let catToApply = newCat
    if (catToApply === "__new__") {
      const enteredName = prompt("Enter new category name:")
      if (!enteredName || !enteredName.trim()) return
      catToApply = await addCustomCategory(enteredName)
    }
    setSaving(true)
    try {
      const updated = inventory.map(item => item.id === itemId ? { ...item, cat: catToApply } : item)
      setInventory(updated)
      await saveInventory(updated)
      showMsg(`Item moved to "${catToApply}"`, "green")
    } catch (e) {
      showMsg("Failed to move item: " + e.message, "red")
    } finally {
      setSaving(false)
    }
  }

  const selectAllItems = () => {
    if (selectedItemIds.size === inventory.length && inventory.length > 0) {
      setSelectedItemIds(new Set())
    } else {
      setSelectedItemIds(new Set(inventory.map(i => i.id)))
    }
  }




  const badge=(item)=>{
    if((Number(item.stock) || 0) === 0)return<span style={{background:"#FDEBE9",color:"#912622",borderRadius:20,padding:"2px 9px",fontSize:11,fontWeight:600}}>Out of Stock</span>
    if((Number(item.stock) || 0) <= getMinStock(item))return<span style={{background:"#FDF2DC",color:"var(--gold)",borderRadius:20,padding:"2px 9px",fontSize:11,fontWeight:600,display:"inline-flex",alignItems:"center",gap:3}}>Low stock <AlertTriangle size={10}/></span>
    return<span style={{background:"#E5F4EC",color:"#2D7A50",borderRadius:20,padding:"2px 9px",fontSize:11,fontWeight:600}}>In Stock</span>
  }

  const storedDecorations = useMemo(() => loadLocal("ll_decorations", DECORATION_ITEMS), [])
  const decorIids = useMemo(() => new Set(storedDecorations.map(d => d.iid)), [storedDecorations])

  const getItemCategory = useCallback((item) => {
    if (decorIids.has(item.id)) return "Decoration Extras"
    return mapCategory(item.cat, item.name)
  }, [decorIids])

  const filteredInventory = useMemo(() => {
    if (!searchQuery.trim()) return inventory
    const q = searchQuery.toLowerCase()
    return inventory.filter(i => (i.name || "").toLowerCase().includes(q) || (i.cat || i.category || "").toLowerCase().includes(q))
  }, [inventory, searchQuery])

  // Count items per category across active search
  const categoryCounts = useMemo(() => {
    const counts = {}
    filteredInventory.forEach(item => {
      const c = getItemCategory(item)
      counts[c] = (counts[c] || 0) + 1
    })
    return counts
  }, [filteredInventory, getItemCategory])

  // Categories that have items in the search results, ordered by allCategoryOptions
  const activeCategoriesList = useMemo(() => {
    const list = allCategoryOptions.filter(c => (categoryCounts[c] || 0) > 0)
    Object.keys(categoryCounts).forEach(c => {
      if (!list.includes(c)) list.push(c)
    })
    return list
  }, [allCategoryOptions, categoryCounts])

  // Inventory filtered by selected category tab
  const categoryFilteredInventory = useMemo(() => {
    if (selectedCategory === "all") return filteredInventory
    return filteredInventory.filter(item => getItemCategory(item) === selectedCategory)
  }, [filteredInventory, selectedCategory, getItemCategory])

  // Paginated slice for current page
  const paginatedInventory = useMemo(() => {
    if (pageSize === "all") return categoryFilteredInventory
    const sz = Number(pageSize) || 25
    const start = (currentPage - 1) * sz
    return categoryFilteredInventory.slice(start, start + sz)
  }, [categoryFilteredInventory, currentPage, pageSize])

  // Group paginated items by mapped category
  const categories = {}
  allCategoryOptions.forEach(c => {
    if (selectedCategory === "all" || selectedCategory === c) {
      categories[c] = []
    }
  })

  paginatedInventory.forEach(item => {
    const mapped = getItemCategory(item)
    if (!categories[mapped]) {
      categories[mapped] = []
    }
    categories[mapped].push(item)
  })


  return <div>
    {/* HEADER */}
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,flexWrap:"wrap",gap:8}}>
      <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
        <span style={{fontSize:13,color:"var(--muted)",fontWeight:500}}>{inventory.length} items total</span>
        {lowStock.length>0&&<span onClick={()=>setView("shopping")} style={{fontSize:12.5,color:"#B03A2E",fontWeight:600,cursor:"pointer",background:"#FDEBE9",padding:"3px 10px",borderRadius:20,display:"inline-flex",alignItems:"center",gap:4}}><AlertTriangle size={12}/> {lowStock.length} low stock → Shopping List</span>}
      </div>
      <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
        <Btn small variant="outline" onClick={() => exportInventoryPDF(inventory, company)} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <Download size={13} /> Download PDF
        </Btn>
        {isOwner&&<>
          {inventory.length > 0 && (
            <Btn small variant="ghost" onClick={selectAllItems}>
              {selectedItemIds.size === inventory.length ? "Deselect All" : "Select All"}
            </Btn>
          )}
          <Btn small variant="outline" onClick={() => setShowAddCatModal(true)}>+ New Category</Btn>
          <Btn small variant="ghost" onClick={()=>{setShowImport(s=>!s);setShowAdd(false);setImportStep(1)}} style={{display:"inline-flex",alignItems:"center",gap:4}}><FileSpreadsheet size={13}/> Import from Excel</Btn>
          <Btn small onClick={()=>{setShowAdd(s=>!s);setShowImport(false)}}>+ Add Item</Btn>
        {inventory.length > 0 && (
          <Btn
            small
            variant="ghost"
            disabled={deletingAll || saving}
            style={{ color: "#B03A2E", borderColor: "#F2DEDE", fontSize: "11.5px", display: "inline-flex", alignItems: "center", gap: 4 }}
            onClick={handleDeleteAllInventory}
            title="Delete all inventory items directly from database"
          >
            <Trash2 size={12} /> {deletingAll ? "Deleting..." : "Delete All"}
          </Btn>
        )}
        </>}
      </div>
    </div>


    {/* ADD CUSTOM CATEGORY MODAL */}
    {showAddCatModal && (
      <Modal title="Add Custom Category" onClose={() => setShowAddCatModal(false)}>
        <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 14 }}>
          Create a new category for your inventory items. It will be saved permanently.
        </div>
        <Inp label="Category Name *" value={newCatName} onChange={setNewCatName} placeholder="e.g. Frozen Goods" />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
          {saving ? (
            <Spinner />
          ) : (
            <>
              <Btn onClick={async () => {
                if (!newCatName.trim()) return
                setSaving(true)
                try {
                  const added = await addCustomCategory(newCatName)
                  showMsg(`Category "${added}" created!`, "green")
                  setNewCatName("")
                  setShowAddCatModal(false)
                } catch (e) {
                  showMsg("Failed to add category: " + e.message, "red")
                } finally {
                  setSaving(false)
                }
              }} disabled={!newCatName.trim()}>Save Category</Btn>
              <Btn variant="ghost" onClick={() => setShowAddCatModal(false)}>Cancel</Btn>
            </>
          )}
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
      <span style={{display:"inline-flex",alignItems:"center",gap:5}}><AlertTriangle size={13}/> {lowStock.map(i=>i.name).join(", ")} — below minimum</span>
      <Btn small variant="outline" onClick={()=>setView("shopping")} style={{display:"inline-flex",alignItems:"center",gap:5}}><ShoppingCart size={13}/> Shopping List →</Btn>
    </div>}

    {/* IMPORT PANEL */}
    {showImport&&isOwner&&<Card style={{marginBottom:14,borderColor:"var(--gold)",background:"#FDFAF4"}}>

      {/* Step indicators */}
      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:14,flexWrap:"wrap"}}>
        {[["1","Paste columns"],["2","Preview"],["3","Imported"]].map(([num,lbl],i)=>{
          const idx=i+1
          const done=importStep>idx,active=importStep===idx
          return <div key={num} style={{display:"flex",alignItems:"center",gap:5}}>
            <div style={{width:22,height:22,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,background:done?"#357A52":active?"var(--gold)":"var(--border)",color:done||active?"#fff":"var(--muted)"}}>{done?<Check size={12}/>:num}</div>
            <span style={{fontSize:12,color:active?"var(--text)":"var(--muted)",fontWeight:active?500:400}}>{lbl}</span>
            {i<2&&<div style={{width:20,height:1,background:"var(--border)",margin:"0 2px"}}/>}
          </div>
        })}
      </div>

      {/* STEP 1 — paste */}
      {importStep===1&&<div>
        <div style={{fontSize:12.5,color:"var(--muted)",marginBottom:10,lineHeight:1.7}}>Open your Excel. Copy each column and paste into its own box. Only item names and cost per unit are required.</div>
        <div style={{background:"#FFF9EE",border:"1px solid #E8D5A3",borderRadius:7,padding:"8px 12px",fontSize:12,color:"var(--gold)",marginBottom:12}}>Just copy from Excel as-is. No reformatting needed.</div>
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
        {warnMsg&&<div style={{padding:"7px 12px",background:"#FDEBE9",borderRadius:7,fontSize:12,color:"#B03A2E",marginBottom:10,display:"flex",alignItems:"center",gap:5}}><AlertTriangle size={13}/> {warnMsg}</div>}
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
              <td style={{padding:"6px 10px",textAlign:"right",fontWeight:500,color:"var(--gold)"}}>{fmtCost(p.cost)}/{p.unit}</td>
            </tr>)}</tbody>
          </table>
        </div>
        <div style={{background:"#EEF8F3",border:"1px solid #C2E0CF",borderRadius:7,padding:"8px 12px",fontSize:12,color:"#357A52",marginBottom:10}}>
          After import, go to <strong>Settings → Opening Stock</strong> to set your opening quantities. Stock will then track automatically from there.
        </div>
        <div style={{display:"flex",gap:8}}>
          {saving ? (
            <Spinner />
          ) : (
            <>
              <Btn variant="success" onClick={confirmImport} disabled={!prevItems.some(p=>p.on)} style={{display:"inline-flex",alignItems:"center",gap:5}}><Check size={13}/> Confirm & Import {prevItems.filter(p=>p.on).length} Items</Btn>
              <Btn variant="ghost" onClick={()=>setImportStep(1)}>← Edit</Btn>
            </>
          )}
        </div>
      </div>}

      {/* STEP 3 — done */}
      {importStep===3&&<div style={{textAlign:"center",padding:"16px 0"}}>
        <div style={{fontSize:16,color:"#357A52",fontWeight:600,marginBottom:6,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><Check size={18}/> Import complete</div>
        <div style={{fontSize:13,color:"var(--muted)",marginBottom:14}}>Go to <strong>Settings → Opening Stock</strong> to set opening quantities.</div>
        <Btn variant="ghost" onClick={()=>{setImportStep(1);setShowImport(false)}}>Done</Btn>
      </div>}
    </Card>}

    {/* ADD SINGLE ITEM */}
    {showAdd&&isOwner&&<Card style={{marginBottom:14,background:"#FFF9EE",borderColor:"var(--gold)"}}>
      <div style={{fontFamily:"'Playfair Display',serif",fontSize:14,fontWeight:600,marginBottom:12}}>Add New Item</div>
      <div style={{display:"grid",gridTemplateColumns:"1.5fr 1.2fr 1fr 1.2fr",gap:10,marginBottom:10}}>
        <Inp label="Item Name *" value={newItem.name} onChange={v=>setNewItem(p=>({...p,name:v}))} placeholder="e.g. Flour"/>
        <div>
          <label style={{fontSize:10,color:"var(--muted)",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:.8,fontWeight:500}}>Category *</label>
          <select value={newItem.cat} onChange={e=>setNewItem(p=>({...p,cat:e.target.value}))} style={{...iSt}}>
            {allCategoryOptions.map(c=><option key={c} value={c}>{c}</option>)}
            <option value="__new__">+ Add New Category...</option>
          </select>
        </div>
        <Sel label="Unit *" value={newItem.unit} onChange={v=>setNewItem(p=>({...p,unit:v}))} options={["kg","g","L","ml","pcs","pack","bottle","roll","set"].map(u=>({value:u,label:u}))}/>
        <Inp label="Min Alert" type="number" step="any" min="0" value={newItem.minStock} onChange={v=>setNewItem(p=>({...p,minStock:v}))} placeholder="e.g. 0.5"/>
      </div>

      {newItem.cat === "__new__" && (
        <div style={{marginBottom:10,maxWidth:320}}>
          <Inp label="New Category Name *" value={customCatInput} onChange={setCustomCatInput} placeholder="e.g. Specialty Syrups" />
        </div>
      )}


      <div style={{marginBottom:12}}>
        <label style={{fontSize:10.5,color:"var(--muted)",display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:0.8,fontWeight:500}}>Cost Per Unit Setting</label>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={() => setCalcMode("manual")}
            style={{
              padding: "6px 12px",
              borderRadius: 6,
              border: calcMode === "manual" ? "2px solid var(--gold)" : "1px solid var(--border)",
              background: calcMode === "manual" ? "rgba(200,145,42,0.08)" : "transparent",
              color: calcMode === "manual" ? "var(--gold)" : "var(--text)",
              fontWeight: calcMode === "manual" ? "600" : "500",
              cursor: "pointer",
              fontSize: "12px"
            }}
          >
            I know cost per unit
          </button>
          <button
            type="button"
            onClick={() => setCalcMode("auto")}
            style={{
              padding: "6px 12px",
              borderRadius: 6,
              border: calcMode === "auto" ? "2px solid var(--gold)" : "1px solid var(--border)",
              background: calcMode === "auto" ? "rgba(200,145,42,0.08)" : "transparent",
              color: calcMode === "auto" ? "var(--gold)" : "var(--text)",
              fontWeight: calcMode === "auto" ? "600" : "500",
              cursor: "pointer",
              fontSize: "12px"
            }}
          >
            I don't know cost per unit
          </button>
        </div>
      </div>

      {calcMode === "auto" ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
          <Inp label="Total Amount Paid (₦) *" type="number" value={newItem.totalPaid || ""} onChange={v => setNewItem(p => ({ ...p, totalPaid: v }))} placeholder="e.g. 5000" />
          <Inp label="Quantity Bought *" type="number" value={newItem.qtyBought || ""} onChange={v => setNewItem(p => ({ ...p, qtyBought: v }))} placeholder="e.g. 2.5" />
          {newItem.totalPaid && newItem.qtyBought && parseFloat(String(newItem.qtyBought).replace(",", ".")) > 0 && (
            <div style={{ gridColumn: "span 2", padding: "8px 12px", background: "var(--panel)", borderRadius: 8, fontSize: 13, fontWeight: 500, color: "var(--gold)", border: "1px solid var(--border)" }}>
              Calculated Cost per Unit: {fmtCost(parseFloat(String(newItem.totalPaid).replace(",", ".")) / parseFloat(String(newItem.qtyBought).replace(",", ".")))}/{newItem.unit}
            </div>
          )}
        </div>
      ) : (
        <div style={{ maxWidth: 200, marginBottom: 12 }}>
          <Inp label="Cost/Unit (₦) *" type="number" value={newItem.cost} onChange={v => setNewItem(p => ({ ...p, cost: v }))} placeholder="e.g. 1140" />
        </div>
      )}

      <div style={{display:"flex",gap:8}}>
        {saving ? (
          <Spinner />
        ) : (
          <>
            <Btn onClick={addSingle}>Save</Btn>
            <Btn variant="ghost" onClick={()=>{setShowAdd(false); setCalcMode("manual"); setNewItem({name:"",unit:"kg",cost:"",minStock:"",cat:"Dry Goods",totalPaid:"",qtyBought:""})}}>Cancel</Btn>
          </>
        )}
      </div>
    </Card>}

    {/* BULK MOVE ACTION BAR */}
    {selectedItemIds.size > 0 && (
      <div style={{
        position: "sticky",
        top: 10,
        zIndex: 100,
        background: "#1E1E1E",
        color: "#fff",
        borderRadius: 10,
        padding: "12px 18px",
        marginBottom: 16,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 12,
        boxShadow: "0 6px 20px rgba(0,0,0,0.3)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ background: "var(--gold)", color: "#fff", borderRadius: 20, padding: "3px 12px", fontWeight: 700, fontSize: 13 }}>
            {selectedItemIds.size} item{selectedItemIds.size !== 1 ? "s" : ""} selected
          </span>
          <span style={{ fontSize: 12.5, color: "#DDD" }}>Select category to move items:</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <select
            value={targetCatForBulk}
            onChange={e => setTargetCatForBulk(e.target.value)}
            style={{
              padding: "7px 12px",
              borderRadius: 6,
              border: "1px solid #555",
              background: "#2A2A2A",
              color: "#fff",
              fontSize: 13,
              outline: "none",
              cursor: "pointer"
            }}
          >
            <option value="">— Select Target Category —</option>
            {allCategoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
            <option value="__new__">+ Add New Category...</option>
          </select>

          {targetCatForBulk === "__new__" && (
            <input
              type="text"
              value={customCatInput}
              onChange={e => setCustomCatInput(e.target.value)}
              placeholder="Category Name"
              style={{
                padding: "7px 12px",
                borderRadius: 6,
                border: "1px solid #555",
                background: "#2A2A2A",
                color: "#fff",
                fontSize: 13,
                outline: "none",
                width: 150
              }}
            />
          )}

          <Btn small variant="success" onClick={handleBulkMove} disabled={!targetCatForBulk || saving}>
            {saving ? "Moving..." : "Move Selected →"}
          </Btn>
          <Btn
            small
            variant="danger"
            onClick={handleBulkDelete}
            disabled={saving}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              background: "#B03A2E",
              color: "#fff",
              borderColor: "#B03A2E"
            }}
          >
            <Trash2 size={12} /> {saving ? "Deleting..." : `Delete Selected (${selectedItemIds.size})`}
          </Btn>
          <Btn small variant="ghost" style={{ color: "#aaa", borderColor: "#555" }} onClick={selectAllItems} disabled={saving}>
            {selectedItemIds.size === inventory.length ? "Deselect All" : "Select All"}
          </Btn>

        </div>
      </div>
    )}

    {/* CATEGORY FILTER TABS / PILLS */}
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 6,
      flexWrap: "wrap",
      marginBottom: 16,
      padding: "8px 10px",
      background: "#FAF7F0",
      border: "1px solid var(--border)",
      borderRadius: 10
    }}>
      <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--muted)", marginRight: 2, textTransform: "uppercase", letterSpacing: 0.5 }}>
        Category:
      </span>
      <button
        type="button"
        onClick={() => setSelectedCategory("all")}
        style={{
          background: selectedCategory === "all" ? "var(--gold)" : "var(--panel)",
          color: selectedCategory === "all" ? "#fff" : "var(--text)",
          border: selectedCategory === "all" ? "1px solid var(--gold)" : "1px solid var(--border)",
          borderRadius: 20,
          padding: "4px 12px",
          fontSize: 12,
          fontWeight: selectedCategory === "all" ? 600 : 500,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          transition: "all 0.15s"
        }}
      >
        All Categories
        <span style={{
          background: selectedCategory === "all" ? "rgba(255,255,255,0.28)" : "#EBE3D5",
          color: selectedCategory === "all" ? "#fff" : "var(--muted)",
          borderRadius: 10,
          padding: "1px 6px",
          fontSize: 11,
          fontWeight: 700
        }}>
          {filteredInventory.length}
        </span>
      </button>

      {activeCategoriesList.map(cat => {
        const count = categoryCounts[cat] || 0
        const isSelected = selectedCategory === cat
        return (
          <button
            key={cat}
            type="button"
            onClick={() => setSelectedCategory(isSelected ? "all" : cat)}
            style={{
              background: isSelected ? "var(--gold)" : "var(--panel)",
              color: isSelected ? "#fff" : "var(--text)",
              border: isSelected ? "1px solid var(--gold)" : "1px solid var(--border)",
              borderRadius: 20,
              padding: "4px 12px",
              fontSize: 12,
              fontWeight: isSelected ? 600 : 500,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              transition: "all 0.15s"
            }}
          >
            {cat}
            <span style={{
              background: isSelected ? "rgba(255,255,255,0.28)" : "#EBE3D5",
              color: isSelected ? "#fff" : "var(--muted)",
              borderRadius: 10,
              padding: "1px 6px",
              fontSize: 11,
              fontWeight: 700
            }}>
              {count}
            </span>
          </button>
        )
      })}

      {selectedCategory !== "all" && (
        <button
          type="button"
          onClick={() => setSelectedCategory("all")}
          style={{
            background: "none",
            border: "none",
            color: "var(--gold)",
            fontSize: 12,
            cursor: "pointer",
            textDecoration: "underline",
            marginLeft: "auto",
            fontWeight: 500,
            padding: "4px 6px"
          }}
        >
          Reset to All Categories
        </button>
      )}
    </div>

    {categoryFilteredInventory.length === 0 && (
      <Card style={{ textAlign: "center", padding: "36px 20px", marginBottom: 20 }}>
        <Folder size={36} color="var(--muted)" style={{ opacity: 0.5, marginBottom: 10 }} />
        <div style={{ fontWeight: 600, fontSize: 15, color: "var(--text)", marginBottom: 4 }}>
          {selectedCategory !== "all" ? `No items in "${selectedCategory}"` : "No inventory items found"}
        </div>
        <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 14 }}>
          {searchQuery ? `No items matched your search "${searchQuery}".` : `There are currently no items in this category.`}
        </div>
        {selectedCategory !== "all" && (
          <Btn small variant="outline" onClick={() => setSelectedCategory("all")}>
            View All Categories
          </Btn>
        )}
      </Card>
    )}

    {/* COLLAPSIBLE CATEGORIES */}
    <div>
      {Object.entries(categories).map(([catName, items]) => {
        const filteredItems = items.filter(i => (i.name || "").toLowerCase().includes(searchQuery.toLowerCase()))
        if (searchQuery.trim() && filteredItems.length === 0) return null
        const displayItems = searchQuery.trim() ? filteredItems : items
        if (displayItems.length === 0) return null
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
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Folder size={15} color="var(--gold)" style={{ flexShrink: 0 }} /> {catName} ({displayItems.length} item{displayItems.length !== 1 ? "s" : ""})
                </span>
 
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
                  <TH cols={[
                    ...(isOwner ? [
                      <input
                        key={`cat-sel-${catName}`}
                        type="checkbox"
                        checked={displayItems.length > 0 && displayItems.every(i => selectedItemIds.has(i.id))}
                        onChange={(e) => {
                          e.stopPropagation();
                          toggleSelectCategoryItems(displayItems);
                        }}
                        title="Select / Deselect all items in this category"
                        style={{ cursor: "pointer", width: 15, height: 15, accentColor: "var(--gold)", margin: 0 }}
                      />
                    ] : []),
                    "Item", "Unit", "On hand", "Committed", "Free", "Cost/Unit", "Min Alert", "Status",
                    ...(isOwner ? ["Category / Move", "Actions"] : [])
                  ]}/>
                  <tbody>
                    {displayItems.length === 0 ? (
                      <tr><td colSpan={isOwner ? 11 : 8} style={{padding:20,textAlign:"center",color:"var(--muted)",fontSize:12.5}}>No items in this category yet.</td></tr>
                    ) : (
                      displayItems.map((item, idx) => {
                        const isLow = (Number(item.stock) || 0) <= getMinStock(item)
                        const editing = editId === item.id
                        const isSelected = selectedItemIds.has(item.id)
                        const onHand = Number(item.onHand ?? item.stock ?? 0)
                        const committed = Number(item.committed ?? 0)
                        const free = Number(item.free ?? (onHand - committed))
                        return (
                          <tr key={item.id} style={{background: isSelected ? "#FFF3D6" : isLow ? "#FFF9EE" : idx % 2 === 0 ? "var(--panel)" : "#F8F3EA"}}>
                            {isOwner && (
                              <td style={{padding:"9px 10px"}} onClick={e=>e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={()=>toggleSelectItem(item.id)}
                                  style={{cursor:"pointer",width:16,height:16,accentColor:"var(--gold)"}}
                                />
                              </td>
                            )}
                            {editing ? (
                              <>
                                <td style={{padding:"6px 8px"}}><input value={editRow.name||""} onChange={e=>setEditRow(r=>({...r,name:e.target.value}))} style={{...iSt,padding:"4px 6px",fontSize:12}}/></td>
                                <td style={{padding:"6px 8px"}}><select value={editRow.unit||"kg"} onChange={e=>setEditRow(r=>({...r,unit:e.target.value}))} style={{...iSt,padding:"4px 6px",fontSize:12,width:60}}>{["kg","g","L","ml","pcs","pack","bottle"].map(u=><option key={u}>{u}</option>)}</select></td>
                                <td style={{padding:"6px 8px"}}><input type="number" step="any" min="0" value={editRow.stock !== undefined ? editRow.stock : ""} onChange={e=>setEditRow(r=>({...r,stock:e.target.value}))} style={{...iSt,padding:"4px 6px",fontSize:12,width:70}}/></td>
                                <td style={{padding:"6px 8px",color:"var(--muted)",fontSize:11.5}}>—</td>
                                <td style={{padding:"6px 8px",color:"var(--muted)",fontSize:11.5}}>—</td>
                                <td style={{padding:"6px 8px"}}><input type="number" step="any" min="0" value={editRow.cost !== undefined ? editRow.cost : ""} onChange={e=>setEditRow(r=>({...r,cost:e.target.value}))} style={{...iSt,padding:"4px 6px",fontSize:12,width:80}}/></td>
                                <td style={{padding:"6px 8px"}}><input type="number" step="any" min="0" value={editRow.minStock !== undefined ? editRow.minStock : ""} onChange={e=>setEditRow(r=>({...r,minStock:e.target.value}))} style={{...iSt,padding:"4px 6px",fontSize:12,width:60}}/></td>
                                <td style={{padding:"6px 8px"}}></td>
                                <td style={{padding:"6px 8px"}}>
                                  <select value={editRow.cat||catName} onChange={e=>setEditRow(r=>({...r,cat:e.target.value}))} style={{...iSt,padding:"4px 6px",fontSize:11}}>
                                    {allCategoryOptions.map(c=><option key={c} value={c}>{c}</option>)}
                                    <option value="__new__">+ New Category...</option>
                                  </select>
                                  {editRow.cat === "__new__" && (
                                    <input value={customCatInput} onChange={e=>setCustomCatInput(e.target.value)} placeholder="Category Name" style={{...iSt,padding:"4px 6px",fontSize:11,marginTop:4}} />
                                  )}
                                </td>
                                <td style={{padding:"6px 8px"}}><div style={{display:"flex",gap:4}}><Btn small variant="success" onClick={doSaveEdit} disabled={saving}><Check size={12}/></Btn><Btn small variant="ghost" onClick={cancelEdit} disabled={saving}><X size={12}/></Btn></div></td>
                              </>
                            ) : (
                              <>
                                <td style={{padding:"9px 10px",fontWeight:500,fontSize:13}}>{item.name}</td>
                                <td style={{padding:"9px 10px",color:"var(--muted)",fontSize:13}}>{item.unit}</td>
                                <td style={{padding:"9px 10px",fontSize:13,fontWeight:600}}>{fmtQty(onHand)} {item.unit}</td>
                                <td style={{padding:"9px 10px",fontSize:13,color:"var(--muted)"}}>{fmtQty(committed)} {item.unit}</td>
                                <td style={{padding:"9px 10px",fontSize:13,fontWeight:600,color:free<0?"#B03A2E":free===0?"var(--gold)":"#357A52"}}>
                                  {fmtQty(free)} {item.unit}
                                  {free < 0 && (
                                    <span style={{marginLeft:6,background:"#FDEBE9",color:"#912622",padding:"1px 6px",borderRadius:10,fontSize:10,fontWeight:700}}>
                                      Deficit
                                    </span>
                                  )}
                                  {free === 0 && committed > 0 && (
                                    <span style={{marginLeft:6,background:"#FFF9EE",color:"var(--gold)",padding:"1px 6px",borderRadius:10,fontSize:10,fontWeight:700}}>
                                      Full
                                    </span>
                                  )}
                                </td>
                                <td style={{padding:"9px 10px",fontSize:13,fontWeight:500,color:"var(--gold)"}}>{fmtCost(item.cost)}/{item.unit}</td>
                                <td style={{padding:"9px 10px",fontSize:13,color:"var(--muted)"}}>{fmtQty(getMinStock(item))} {item.unit}</td>
                                <td style={{padding:"9px 10px"}}>{badge(item)}</td>
                                {isOwner && (
                                  <td style={{padding:"9px 10px"}} onClick={e=>e.stopPropagation()}>
                                    <select
                                      value={item.cat || catName}
                                      onChange={(e) => moveSingleItemCategory(item.id, e.target.value)}
                                      disabled={saving}
                                      style={{
                                        padding: "4px 8px",
                                        borderRadius: 6,
                                        border: "1px solid var(--border)",
                                        background: "#FAF7F0",
                                        fontSize: 11.5,
                                        color: "var(--text)",
                                        cursor: "pointer",
                                        fontWeight: 500
                                      }}
                                      title="Move item to another category"
                                    >
                                      {allCategoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
                                      <option value="__new__">+ New Category...</option>
                                    </select>
                                  </td>
                                )}
                                {isOwner && (
                                  <td style={{padding:"9px 10px"}}>
                                    <div style={{display:"flex",gap:4}}>
                                      <Btn small variant="ghost" onClick={()=>startEdit(item)} disabled={saving} style={{display:"inline-flex",alignItems:"center",gap:4}}><Pencil size={11}/> Edit</Btn>
                                      <Btn small variant="danger" onClick={()=>doDelete(item.id)} disabled={saving} style={{display:"inline-flex",alignItems:"center",gap:4}}><X size={11}/></Btn>
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

    {/* PAGINATION */}
    <Pagination
      currentPage={currentPage}
      totalItems={categoryFilteredInventory.length}
      pageSize={pageSize}
      onPageChange={setCurrentPage}
      onPageSizeChange={(sz) => {
        setPageSize(sz)
        setCurrentPage(1)
      }}
      pageSizeOptions={[10, 25, 50, 100]}
      itemLabel={selectedCategory === "all" ? "inventory items" : `${selectedCategory} items`}
    />

    <div style={{marginTop:8,fontSize:11.5,color:"var(--muted)",lineHeight:1.7}}>Stock reduces automatically as production orders are saved. Set opening stock in <strong>Settings → Opening Stock</strong>. Restock by scanning a purchase receipt.</div>
  </div>
}


// ═══════════════════════════════════════════════════════════
//  RECIPE CARD (standalone component — avoids hook-in-map bug)

// ═══════════════════════════════════════════════════════════
export function DecorationsTab({inventory, setInventory, isOwner, searchQuery=""}){
  const LS_KEY = "ll_decorations"
  const [decorVersion, setDecorVersion] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [selectedIds, setSelectedIds] = useState(new Set())

  const toggleSelect = (id) => {
    setSelectedIds(p => {
      const copy = new Set(p)
      if (copy.has(id)) copy.delete(id)
      else copy.add(id)
      return copy
    })
  }

  const toggleSelectAll = () => {
    const allSelected = displayItems.length > 0 && displayItems.every(d => selectedIds.has(d.id))
    setSelectedIds(p => {
      const copy = new Set(p)
      if (allSelected) {
        displayItems.forEach(d => copy.delete(d.id))
      } else {
        displayItems.forEach(d => copy.add(d.id))
      }
      return copy
    })
  }

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return
    const count = selectedIds.size
    if (!window.confirm(`Are you sure you want to delete the ${count} selected decoration${count !== 1 ? "s" : ""}?`)) return
    setSaving(true)
    try {
      const toDeleteDecorations = items.filter(d => selectedIds.has(d.id))
      const toDeleteIids = new Set(toDeleteDecorations.map(d => d.iid).filter(Boolean))
      let currentInv = inventory.map(i => {
        if (toDeleteIids.has(i.id)) {
          return { ...i, cat: "Other" }
        }
        return i
      })
      const stored = loadLocal(LS_KEY, DECORATION_ITEMS)
      const updatedDecorations = stored.filter(d => !selectedIds.has(d.id) && !toDeleteIids.has(d.iid))
      saveLocal(LS_KEY, updatedDecorations)
      setInventory(currentInv)
      await saveInventory(currentInv)
      setDecorVersion(v => v + 1)
      setSelectedIds(new Set())
      showMsg(`✓ Deleted ${count} decoration(s)`, "green")
    } catch (e) {
      showMsg("Failed to delete decorations: " + e.message, "red")
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery])

  const items = useMemo(() => {
    const stored = loadLocal(LS_KEY, DECORATION_ITEMS)
    const itemsMap = new Map()

    stored.forEach(d => {
      const invItem = inventory.find(x => x.id === d.iid)
      itemsMap.set(d.id, {
        id: d.id,
        name: d.name || invItem?.name || "Decoration Extra",
        label: d.label || d.name || invItem?.name || "Decoration Extra",
        iid: d.iid,
        qty: d.qty !== undefined ? d.qty : 1
      })
    })

    inventory.forEach(invItem => {
      const isDecor = invItem.cat === "Decoration Extras" || 
                      invItem.category === "Decoration Extras" || 
                      mapCategory(invItem.cat, invItem.name) === "Decoration Extras"
      if (isDecor) {
        const id = "d_" + invItem.id
        if (!itemsMap.has(id) && ![...itemsMap.values()].some(x => x.iid === invItem.id)) {
          itemsMap.set(id, {
            id,
            name: invItem.name,
            label: invItem.name,
            iid: invItem.id,
            qty: 1
          })
        }
      }
    })

    return Array.from(itemsMap.values())
  }, [inventory, decorVersion])

  const displayItems = useMemo(() => {
    if (!searchQuery.trim()) return items
    const q = searchQuery.toLowerCase()
    return items.filter(d => (d.name || d.label || "").toLowerCase().includes(q))
  }, [items, searchQuery])

  const paginatedItems = useMemo(() => {
    if (pageSize === "all") return displayItems
    const sz = Number(pageSize) || 25
    const start = (currentPage - 1) * sz
    return displayItems.slice(start, start + sz)
  }, [displayItems, currentPage, pageSize])

  const decorOptions = useMemo(() => {
    const isDecor = (i) => {
      const cat = (i.cat || i.category || "").trim()
      return (
        cat === "Decoration Extras" ||
        cat === "Decoration" ||
        cat === "Decorations" ||
        cat.toLowerCase().includes("decor") ||
        mapCategory(cat, i.name) === "Decoration Extras"
      )
    }
    return inventory
      .filter(isDecor)
      .map(i => ({
        value: i.id,
        label: `${i.name} (${i.unit}) — ${fmtCost(i.cost)}/${i.unit}`
      }))
  }, [inventory])

  const [editId, setEditId] = useState(null)
  const [editRow, setEditRow] = useState({})
  const [adding, setAdding] = useState(false)
  const [newItem, setNewItem] = useState({name:"", label:"", iid:"", qty:"1", cost:"", unit:"pcs"})
  const [msg, setMsg] = useState("")
  const [saving, setSaving] = useState(false)

  const showMsg = (m) => { setMsg(m); setTimeout(()=>setMsg(""), 3000) }

  const startEdit = (d) => { setEditId(d.id); setEditRow({...d}) }

  const saveEdit = async () => {
    const stored = loadLocal(LS_KEY, DECORATION_ITEMS)
    const targetName = (editRow.name || editRow.label || "").trim()
    const targetQty = +editRow.qty || 1
    
    let currentInv = [...inventory]
    if (editRow.iid) {
      currentInv = currentInv.map(i => {
        if (i.id === editRow.iid) {
          return { ...i, name: targetName, cat: "Decoration Extras" }
        }
        return i
      })
    }

    let updatedDecorations = stored.map(d => d.id === editId ? { ...d, ...editRow, name: targetName, label: targetName, qty: targetQty } : d)
    if (!stored.some(d => d.id === editId)) {
      updatedDecorations.push({ ...editRow, id: editId, name: targetName, label: targetName, qty: targetQty })
    }

    setSaving(true)
    try {
      saveLocal(LS_KEY, updatedDecorations)
      setInventory(currentInv)
      await saveInventory(currentInv)
      setDecorVersion(v => v + 1)
      setEditId(null)
      showMsg("Decoration updated")
    } catch (e) {
      showMsg("Failed to save: " + e.message)
    } finally {
      setSaving(false)
    }
  }

  const deleteItem = async (id) => {
    if(!confirm("Delete this decoration?")) return
    const toDelete = items.find(d => d.id === id)
    let currentInv = [...inventory]
    if (toDelete) {
      currentInv = currentInv.map(i => {
        if (i.id === toDelete.iid) {
          return { ...i, cat: "Other" }
        }
        return i
      })
    }
    const stored = loadLocal(LS_KEY, DECORATION_ITEMS)
    const updatedDecorations = stored.filter(d => d.id!==id && d.iid !== toDelete?.iid)

    setSaving(true)
    try {
      saveLocal(LS_KEY, updatedDecorations)
      setInventory(currentInv)
      await saveInventory(currentInv)
      setDecorVersion(v => v + 1)
      showMsg("Decoration deleted")
    } catch (e) {
      showMsg("Failed to delete: " + e.message)
    } finally {
      setSaving(false)
    }
  }

  const addItem = async () => {
    if(!newItem.name.trim() || !newItem.qty) return showMsg("Decoration name and std qty are required")
    
    let targetIid = newItem.iid
    let currentInv = [...inventory]

    if (!targetIid) {
      const newInvItem = {
        name: newItem.name.trim(),
        cat: "Decoration Extras",
        unit: newItem.unit || "pcs",
        cost: Number(newItem.cost) || 0,
        stock: 0,
        minStock: 5
      }
      const savedInv = await createInventoryItemOnServer(newInvItem)
      currentInv = [...currentInv.filter(i => i.id !== savedInv.id), savedInv]
      targetIid = savedInv.id
    } else {
      const existing = currentInv.find(i => i.id === targetIid)
      if (existing) {
        const updatedItem = await updateInventoryItemOnServer(targetIid, {
          ...existing,
          name: newItem.name.trim(),
          cat: "Decoration Extras"
        })
        currentInv = currentInv.map(i => i.id === targetIid ? updatedItem : i)
      }
    }

    const stored = loadLocal(LS_KEY, DECORATION_ITEMS)
    const item = { id: "d_" + targetIid, name: newItem.name.trim(), label: newItem.name.trim(), iid: targetIid, qty: +newItem.qty }
    const updatedDecorations = [...stored.filter(x => x.iid !== targetIid && x.id !== item.id), item]

    setSaving(true)
    try {
      await saveLocal(LS_KEY, updatedDecorations)
      setInventory(currentInv)
      setDecorVersion(v => v + 1)
      setNewItem({name:"", label:"", iid:"", qty:"1", cost:"", unit:"pcs"})
      setAdding(false)
      showMsg("Decoration added directly to database","green")
    } catch (e) {
      showMsg("Failed to add decoration: " + e.message, "red")
    } finally {
      setSaving(false)
    }
  }

  return <div>
    <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12}}>
      <div style={{fontSize:13, color:"var(--muted)"}}>Selectable per production order. Costs update automatically when inventory prices change.</div>
      {isOwner&&<Btn small onClick={()=>setAdding(!adding)}>+ Add Decoration</Btn>}
    </div>

    {msg&&<Alert msg={msg} color="green" onClose={()=>setMsg("")}/>}

    {adding&&isOwner&&<Card style={{marginBottom:14, background:"#FFF9EE", borderColor:"var(--gold)"}}>
      <div style={{fontFamily:"'Playfair Display',serif", fontSize:14, fontWeight:600, marginBottom:12}}>New Decoration Extra</div>
      <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:10}}>
        <Inp label="Decoration Name *" value={newItem.name} onChange={v=>setNewItem(p=>({...p,name:v}))} placeholder="e.g. Edible glitter"/>
        <div style={{marginBottom:11, display:"flex", flexDirection:"column", minWidth: 220}}>
          <label style={{fontSize:10.5,color:"var(--muted)",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:0.8,fontWeight:500}}>Linked Inventory Item</label>
          <SearchableSelect
            value={newItem.iid}
            onChange={val=>setNewItem(p=>({...p,iid:val}))}
            options={decorOptions}
            placeholder="Type to search item..."
          />
        </div>
        {!newItem.iid && <>
          <Inp label="Cost / Unit (₦)" type="number" value={newItem.cost || ""} onChange={v=>setNewItem(p=>({...p,cost:v}))} placeholder="e.g. 2500"/>
          <Sel label="Unit" value={newItem.unit || "pcs"} onChange={v=>setNewItem(p=>({...p,unit:v}))} options={["pcs","pack","kg","g","L","ml","bottle","set"].map(u=>({value:u,label:u}))}/>
        </>}
        <Inp label="Standard Qty Used *" type="number" value={newItem.qty} onChange={v=>setNewItem(p=>({...p,qty:v}))} placeholder="e.g. 0.15"/>
      </div>
      <div style={{display:"flex", gap:8}}>
        <Btn onClick={addItem} loading={saving} loadingText="Saving..." disabled={saving}>Save</Btn>
        <Btn variant="ghost" onClick={()=>setAdding(false)} disabled={saving}>Cancel</Btn>
      </div>
    </Card>}

    {/* Bulk Actions Bar */}
    {selectedIds.size > 0 && (
      <div style={{
        background: "#FFF9EE",
        border: "1px solid var(--gold)",
        borderRadius: 8,
        padding: "10px 16px",
        marginBottom: 12,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap"
      }}>
        <span style={{ fontWeight: 600, fontSize: 13.5 }}>
          {selectedIds.size} decoration{selectedIds.size !== 1 ? "s" : ""} selected
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn small variant="danger" onClick={handleBulkDelete} disabled={saving} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <Trash2 size={12} /> {saving ? "Deleting..." : `Delete Selected (${selectedIds.size})`}
          </Btn>
          <Btn small variant="ghost" onClick={() => setSelectedIds(new Set())} disabled={saving}>
            Deselect All
          </Btn>
        </div>
      </div>
    )}

    <div style={{overflowX:"auto"}}>
      <table style={{width:"100%", borderCollapse:"collapse", background:"var(--panel)", borderRadius:10, overflow:"hidden", border:"1px solid var(--border)"}}>
        <TH cols={[
          ...(isOwner ? [
            <input
              key="decor-select-all"
              type="checkbox"
              checked={displayItems.length > 0 && displayItems.every(d => selectedIds.has(d.id))}
              onChange={toggleSelectAll}
              title="Select / Deselect all"
              style={{ cursor: "pointer", width: 16, height: 16, accentColor: "var(--gold)", margin: 0 }}
            />
          ] : []),
          "Decoration", "Linked Inventory Item", "Std Qty", "Cost", ...(isOwner?["Actions"]:[])
        ]}/>
        <tbody>{paginatedItems.map((d,i)=>{
          const it = inventory.find(x=>x.id===d.iid)
          const editing = editId===d.id
          const isSelected = selectedIds.has(d.id)
          return <tr key={d.id} style={{background: isSelected ? "#FFF3D6" : i%2===0?"var(--panel)":"#F8F3EA"}}>
            {isOwner && (
              <td style={{ padding: "9px 10px" }} onClick={e => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleSelect(d.id)}
                  style={{ cursor: "pointer", width: 16, height: 16, accentColor: "var(--gold)" }}
                />
              </td>
            )}
            {editing ? <>
              <td style={{padding:"6px 8px"}}><input value={editRow.name||editRow.label||""} onChange={e=>setEditRow(r=>({...r,name:e.target.value,label:e.target.value}))} style={{...iSt,padding:"4px 6px",fontSize:12}}/></td>
              <td style={{padding:"6px 8px", minWidth: 200}}>
                <SearchableSelect
                  value={editRow.iid||""}
                  onChange={val=>setEditRow(r=>({...r,iid:val}))}
                  options={inventory.filter(i => {
                    const cat = (i.cat || i.category || "").trim()
                    return (
                      cat === "Decoration Extras" ||
                      cat === "Decoration" ||
                      cat === "Decorations" ||
                      cat.toLowerCase().includes("decor") ||
                      mapCategory(cat, i.name) === "Decoration Extras" ||
                      i.id === editRow.iid
                    )
                  }).map(i => ({
                    value: i.id,
                    label: `${i.name} (${i.unit}) — ${fmtCost(i.cost)}/${i.unit}`
                  }))}
                  placeholder="Type to search item..."
                />
              </td>


              <td style={{padding:"6px 8px"}}><input type="number" step="any" value={editRow.qty||""} onChange={e=>setEditRow(r=>({...r,qty:e.target.value}))} style={{...iSt,width:70,padding:"4px 6px",fontSize:12}}/></td>
              <td style={{padding:"6px 8px",fontSize:13}}>{editRow.iid&&inventory.find(x=>x.id===editRow.iid)?fmtCost(inventory.find(x=>x.id===editRow.iid).cost*(+editRow.qty||0)):"—"}</td>
              <td style={{padding:"6px 8px"}}><div style={{display:"flex",gap:4}}><Btn small variant="success" onClick={saveEdit} disabled={saving}><Check size={12}/></Btn><Btn small variant="ghost" onClick={()=>setEditId(null)} disabled={saving}><X size={12}/></Btn></div></td>
            </> : <>
              <td style={{padding:"9px 10px",fontWeight:500,fontSize:13}}>{d.name||d.label}</td>
              <td style={{padding:"9px 10px",color:"var(--muted)",fontSize:12.5}}>{it?.name||<span style={{color:"#B03A2E",display:"inline-flex",alignItems:"center",gap:3}}><AlertTriangle size={11}/> Not found</span>}</td>
              <td style={{padding:"9px 10px",fontSize:13}}>{d.qty} {it?.unit||""}</td>
              <td style={{padding:"9px 10px",color:"var(--gold)",fontWeight:500,fontSize:13}}>{it?fmtCost(it.cost*d.qty):"—"}</td>
              {isOwner&&<td style={{padding:"9px 10px"}}><div style={{display:"flex",gap:4}}><Btn small variant="ghost" onClick={()=>startEdit(d)} disabled={saving} style={{display:"inline-flex",alignItems:"center",gap:4}}><Pencil size={11}/> Edit</Btn><Btn small variant="danger" onClick={()=>deleteItem(d.id)} disabled={saving} style={{display:"inline-flex",alignItems:"center",gap:4}}><X size={11}/></Btn></div></td>}
            </>}
          </tr>
        })}</tbody>
      </table>
    </div>

    <Pagination
      currentPage={currentPage}
      totalItems={displayItems.length}
      pageSize={pageSize}
      onPageChange={setCurrentPage}
      onPageSizeChange={(sz) => {
        setPageSize(sz)
        setCurrentPage(1)
      }}
      pageSizeOptions={[10, 25, 50, 100]}
      itemLabel="decorations"
    />
  </div>
}

// ═══════════════════════════════════════════════════════════
//  MASTER LIST (editable inventory + editable recipes)
// ═══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════
//  PACKAGING TAB — boards, boxes, drums linked to Order Calculator

// ═══════════════════════════════════════════════════════════
export function PackagingTab({inventory,setInventory,isOwner,searchQuery=""}){
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery])

  const items = useMemo(() => {
    return inventory.filter(item => 
      item.cat === "Board and Packaging" || 
      item.category === "Board and Packaging" || 
      mapCategory(item.cat, item.name) === "Board and Packaging"
    )
  }, [inventory])

  const displayItems = useMemo(() => {
    if (!searchQuery.trim()) return items
    const q = searchQuery.toLowerCase()
    return items.filter(p => (p.name || "").toLowerCase().includes(q) || (p.cat || p.category || "").toLowerCase().includes(q))
  }, [items, searchQuery])

  const paginatedItems = useMemo(() => {
    if (pageSize === "all") return displayItems
    const sz = Number(pageSize) || 25
    const start = (currentPage - 1) * sz
    return displayItems.slice(start, start + sz)
  }, [displayItems, currentPage, pageSize])


  const [adding,setAdding]=useState(false)
  const [newItem,setNewItem]=useState({name:"",price:"",unit:"pcs",minStock:"5"})
  const [editId,setEditId]=useState(null)
  const [editRow,setEditRow]=useState({})
  const [saving,setSaving]=useState(false)
  const [selectedItemIds, setSelectedItemIds] = useState(new Set())

  const toggleSelectItem = (id) => {
    setSelectedItemIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    const allSelected = displayItems.length > 0 && displayItems.every(i => selectedItemIds.has(i.id))
    setSelectedItemIds(prev => {
      const next = new Set(prev)
      if (allSelected) {
        displayItems.forEach(i => next.delete(i.id))
      } else {
        displayItems.forEach(i => next.add(i.id))
      }
      return next
    })
  }

  const handleBulkDelete = async () => {
    if (selectedItemIds.size === 0) return
    const count = selectedItemIds.size
    if (!window.confirm(`Are you sure you want to delete the ${count} selected packaging item${count !== 1 ? "s" : ""}? This cannot be undone.`)) return
    setSaving(true)
    try {
      const idsToDelete = Array.from(selectedItemIds)
      const updated = inventory.filter(i => !selectedItemIds.has(i.id))
      setInventory(updated)
      try {
        await batchDeleteInventoryOnServer(idsToDelete)
      } catch (err) {
        console.warn("Server batch delete failed, fallback to sync:", err)
      }
      await saveInventory(updated)
      setSelectedItemIds(new Set())
    } catch (e) {
      alert("Failed to delete packaging: " + e.message)
    } finally {
      setSaving(false)
    }
  }

  const addItem=async()=>{
    if(!newItem.name.trim()||!newItem.price)return
    setSaving(true)
    try {
      const itemToSave = {
        name: newItem.name.trim(),
        cat: "Board and Packaging",
        unit: newItem.unit || "pcs",
        cost: +newItem.price,
        stock: 0,
        minStock: +newItem.minStock || 5
      }
      const saved = await createInventoryItemOnServer(itemToSave)
      setInventory([...inventory.filter(i => i.id !== saved.id), saved])
      setAdding(false)
      setNewItem({name:"",price:"",unit:"pcs",minStock:"5"})
    } catch (e) {
      alert("Failed to add packaging to database: " + e.message)
    } finally {
      setSaving(false)
    }
  }
  const saveEdit=async(id)=>{
    setSaving(true)
    try {
      const existing = inventory.find(i => i.id === id) || {}
      const parsedPrice = typeof editRow.price === "string" ? parseFloat(editRow.price.replace(",", ".")) : Number(editRow.price)
      const parsedStock = typeof editRow.stock === "string" ? parseFloat(editRow.stock.replace(",", ".")) : Number(editRow.stock)
      const itemToUpdate = {
        name: editRow.name.trim(),
        cat: "Board and Packaging",
        unit: editRow.unit || "pcs",
        cost: isNaN(parsedPrice) ? 0 : parsedPrice,
        stock: isNaN(parsedStock) ? 0 : parsedStock,
        minStock: +editRow.minStock || 5
      }
      const updatedItem = await updateInventoryItemOnServer(id, itemToUpdate)
      setInventory(inventory.map(i => i.id === id ? updatedItem : i))
      setEditId(null)
    } catch (e) {
      alert("Failed to save packaging to database: " + e.message)
    } finally {
      setSaving(false)
    }
  }
  const deleteItem=async(id)=>{
    if(!confirm("Remove this packaging item from database?"))return
    setSaving(true)
    try {
      await deleteInventoryItemOnServer(id)
      setInventory(inventory.filter(i => i.id !== id))
    } catch (e) {
      alert("Failed to delete packaging from database: " + e.message)
    } finally {
      setSaving(false)
    }
  }

  const badge=(item)=>{
    if(item.stock===0)return<span style={{background:"#FDEBE9",color:"#912622",borderRadius:20,padding:"2px 9px",fontSize:11,fontWeight:600}}>Out of Stock</span>
    if(item.stock<=(item.minStock||5))return<span style={{background:"#FDF2DC",color:"var(--gold)",borderRadius:20,padding:"2px 9px",fontSize:11,fontWeight:600,display:"inline-flex",alignItems:"center",gap:3}}>Low stock <AlertTriangle size={10} /></span>
    return<span style={{background:"#E5F4EC",color:"#2D7A50",borderRadius:20,padding:"2px 9px",fontSize:11,fontWeight:600}}>In Stock</span>
  }

  return <div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
      <div style={{fontSize:13,color:"var(--muted)"}}>Boards, boxes and packaging items ({items.length} items). Prices update automatically in Order Calculator when edited here.</div>
      {isOwner&&<Btn small onClick={()=>setAdding(true)}>+ Add item</Btn>}
    </div>
    {adding&&<Card style={{marginBottom:12,borderLeft:"4px solid var(--gold)"}}>
      <div style={{display:"grid",gridTemplateColumns:"1.5fr 1fr 1fr 1fr auto",gap:8,alignItems:"end"}}>
        <Inp label="Item name" value={newItem.name} onChange={v=>setNewItem(n=>({...n,name:v}))} placeholder="e.g. Cake Board 8&quot;"/>
        <Inp label="Price (₦)" type="number" value={newItem.price} onChange={v=>setNewItem(n=>({...n,price:v}))} placeholder="e.g. 450"/>
        <div>
          <label style={{fontSize:10,color:"var(--muted)",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:.8,fontWeight:500}}>Unit</label>
          <select value={newItem.unit} onChange={e=>setNewItem(n=>({...n,unit:e.target.value}))} style={{...iSt}}>
            {["pcs","pack","roll","set","kg","g","L","ml","bottle"].map(u=><option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <Inp label="Min Alert" type="number" value={newItem.minStock} onChange={v=>setNewItem(n=>({...n,minStock:v}))} placeholder="5"/>
        <div style={{display:"flex",gap:6}}>
          {saving ? (
            <Spinner />
          ) : (
            <>
              <Btn small variant="success" onClick={addItem} style={{display:"inline-flex",alignItems:"center",gap:4}}><Check size={11}/> Save</Btn>
              <Btn small variant="ghost" onClick={()=>setAdding(false)}>Cancel</Btn>
            </>
          )}
        </div>
      </div>
    </Card>}

    {/* Bulk Actions Bar */}
    {selectedItemIds.size > 0 && (
      <div style={{
        background: "#FFF9EE",
        border: "1px solid var(--gold)",
        borderRadius: 8,
        padding: "10px 16px",
        marginBottom: 12,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap"
      }}>
        <span style={{ fontWeight: 600, fontSize: 13.5 }}>
          {selectedItemIds.size} packaging item{selectedItemIds.size !== 1 ? "s" : ""} selected
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn small variant="danger" onClick={handleBulkDelete} disabled={saving} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <Trash2 size={12} /> {saving ? "Deleting..." : `Delete Selected (${selectedItemIds.size})`}
          </Btn>
          <Btn small variant="ghost" onClick={() => setSelectedItemIds(new Set())} disabled={saving}>
            Deselect All
          </Btn>
        </div>
      </div>
    )}

    <table style={{width:"100%",borderCollapse:"collapse",background:"var(--panel)",borderRadius:10,overflow:"hidden",border:"1px solid var(--border)"}}>
      <TH cols={[
        ...(isOwner ? [
          <input
            key="pkg-select-all"
            type="checkbox"
            checked={displayItems.length > 0 && displayItems.every(i => selectedItemIds.has(i.id))}
            onChange={toggleSelectAll}
            title="Select / Deselect all"
            style={{ cursor: "pointer", width: 16, height: 16, accentColor: "var(--gold)", margin: 0 }}
          />
        ] : []),
        "Item","Price/Cost","Unit","Stock Qty","Status",...(isOwner?["Actions"]:[])
      ]}/>
      <tbody>
        {displayItems.length === 0 ? (
          <tr><td colSpan={isOwner ? 7 : 5} style={{padding:20,textAlign:"center",color:"var(--muted)",fontSize:12.5}}>No board and packaging items found. Click + Add item above to create one.</td></tr>
        ) : (
          paginatedItems.map((item,i)=>{
            const isLow = item.stock <= (item.minStock || 5)
            const isSelected = selectedItemIds.has(item.id)
            return <tr key={item.id} style={{background:isSelected ? "#FFF3D6" : isLow?"#FFF9EE":i%2===0?"var(--panel)":"#F8F3EA"}}>
              {isOwner && (
                <td style={{ padding: "9px 10px" }} onClick={e => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelectItem(item.id)}
                    style={{ cursor: "pointer", width: 16, height: 16, accentColor: "var(--gold)" }}
                  />
                </td>
              )}
              {editId===item.id
                ?<>
                  <td style={{padding:"6px 8px"}}><input value={editRow.name||""} onChange={e=>setEditRow(r=>({...r,name:e.target.value}))} style={{...iSt,fontSize:12}}/></td>
                  <td style={{padding:"6px 8px"}}><input type="number" step="any" value={editRow.price !== undefined ? editRow.price : ""} onChange={e=>setEditRow(r=>({...r,price:e.target.value}))} style={{...iSt,fontSize:12}}/></td>
                  <td style={{padding:"6px 8px"}}><select value={editRow.unit||"pcs"} onChange={e=>setEditRow(r=>({...r,unit:e.target.value}))} style={{...iSt,fontSize:12}}>{["pcs","pack","roll","set","kg","g","L","ml","bottle"].map(u=><option key={u} value={u}>{u}</option>)}</select></td>
                  <td style={{padding:"6px 8px"}}><input type="number" step="any" min="0" value={editRow.stock !== undefined ? editRow.stock : ""} onChange={e=>setEditRow(r=>({...r,stock:e.target.value}))} style={{...iSt,fontSize:12,width:70}}/></td>
                  <td style={{padding:"6px 8px"}}></td>
                  <td style={{padding:"6px 8px"}}><div style={{display:"flex",gap:4}}><Btn small variant="success" onClick={()=>saveEdit(item.id)} disabled={saving}><Check size={12}/></Btn><Btn small variant="ghost" onClick={()=>setEditId(null)} disabled={saving}><X size={12}/></Btn></div></td>
                </>
                :<>
                  <td style={{padding:"9px 10px",fontSize:13,fontWeight:500}}>{item.name}</td>
                  <td style={{padding:"9px 10px",fontSize:13,color:"var(--gold)",fontWeight:600}}>{fmtCost(item.cost)}</td>
                  <td style={{padding:"9px 10px",fontSize:12,color:"var(--muted)"}}>{item.unit}</td>
                  <td style={{padding:"9px 10px",fontSize:13,fontWeight:600,color:isLow?"#B03A2E":"#357A52"}}>{fmtQty(item.stock)} {item.unit}</td>
                  <td style={{padding:"9px 10px"}}>{badge(item)}</td>
                  {isOwner&&<td style={{padding:"9px 8px"}}><div style={{display:"flex",gap:4,justifyContent:"flex-end"}}><Btn small variant="ghost" onClick={()=>{setEditId(item.id);setEditRow({name:item.name,price:item.cost,unit:item.unit,stock:item.stock||0,minStock:item.minStock||5})}} disabled={saving}>Edit</Btn><Btn small variant="danger" onClick={()=>deleteItem(item.id)} disabled={saving} style={{display:"inline-flex",alignItems:"center",gap:4}}><X size={11}/></Btn></div></td>}
                </>}
            </tr>
          })
        )}
      </tbody>
    </table>

    <Pagination
      currentPage={currentPage}
      totalItems={displayItems.length}
      pageSize={pageSize}
      onPageChange={setCurrentPage}
      onPageSizeChange={(sz) => {
        setPageSize(sz)
        setCurrentPage(1)
      }}
      pageSizeOptions={[10, 25, 50, 100]}
      itemLabel="packaging items"
    />
  </div>
}



export function MasterList({inventory,setInventory,recipes,setRecipes,user,setView,company}){
  const [tab,setTab]=useState("inventory")
  const [msg,setMsg]=useState("")
  const [msgColor,setMsgColor]=useState("gold")
  const [recipeModal,setRecipeModal]=useState(null)
  const [recipeModalError, setRecipeModalError] = useState(null)
  const isOwner = user?.role==="owner"
  const [showRecipeExcelImport, setShowRecipeExcelImport] = useState(false)
  const [showRecipeScan, setShowRecipeScan] = useState(false)
  const [saving, setSaving] = useState(false)
  const [searchQueries, setSearchQueries] = useState({
    inventory: "",
    recipes: "",
    decorations: "",
    packaging: ""
  })

  const searchQuery = searchQueries[tab] || ""
  const setSearchQuery = (val) => setSearchQueries(prev => ({ ...prev, [tab]: val }))

  const showMsg = (m,c="gold") => { setMsg(m); setMsgColor(c); setTimeout(()=>setMsg(""),4000) }

  const [recipePage, setRecipePage] = useState(1)
  const [recipePageSize, setRecipePageSize] = useState(10)

  useEffect(() => {
    setRecipePage(1)
  }, [searchQuery])

  const filteredRecipes = useMemo(() => {
    if (!searchQuery.trim()) return recipes
    const q = searchQuery.toLowerCase()
    return recipes.filter(r => (r.name || "").toLowerCase().includes(q) || (r.notes || "").toLowerCase().includes(q))
  }, [recipes, searchQuery])

  const paginatedRecipes = useMemo(() => {
    if (recipePageSize === "all") return filteredRecipes
    const sz = Number(recipePageSize) || 10
    const start = (recipePage - 1) * sz
    return filteredRecipes.slice(start, start + sz)
  }, [filteredRecipes, recipePage, recipePageSize])


  // ── Recipes ──
  const isSavingRecipeRef = useRef(false)
  const [recipeFilter, setRecipeFilter] = useState("all") // "all" | "cake_layer" | "covering" | "pastry"

  const openRecipe = (r) => {
    setRecipeModalError(null)
    if (r) {
      const isCov = r.type === "covering" || r.type === "filling"
      const cov = isCov ? getRecipeCoverageValues(r) : {}
      setRecipeModal({
        ...r,
        calShape: r.calShape || r.cal_shape || "round",
        calDimA: r.calDimA !== undefined ? r.calDimA : (r.cal_dim_a !== undefined ? r.cal_dim_a : 6),
        calDimB: r.calDimB !== undefined ? r.calDimB : (r.cal_dim_b !== undefined ? r.cal_dim_b : 8),
        calGrams: r.calGrams !== undefined ? r.calGrams : (r.cal_grams !== undefined ? r.cal_grams : 617),
        calHeightIn: r.calHeightIn !== undefined ? r.calHeightIn : (r.cal_height_in !== undefined ? r.cal_height_in : 2),
        trimPct: r.trimPct !== undefined ? r.trimPct : (r.trim_pct !== undefined ? r.trim_pct : 8),
        density: r.density !== undefined ? r.density : (r.densityGPerCm3 ? r.densityGPerCm3 * 16.387 : null),
        canFill: r.canFill !== undefined ? r.canFill : (r.can_fill !== undefined ? r.can_fill : true),
        canCrumb: r.canCrumb !== undefined ? r.canCrumb : (r.can_crumb !== undefined ? r.can_crumb : true),
        canFinish: r.canFinish !== undefined ? r.canFinish : (r.can_finish !== undefined ? r.can_finish : true),
        thickFillMm: r.thickFillMm !== undefined ? r.thickFillMm : (r.thick_fill_mm !== undefined ? r.thick_fill_mm : 4.5),
        thickCrumbMm: r.thickCrumbMm !== undefined ? r.thickCrumbMm : (r.thick_crumb_mm !== undefined ? r.thick_crumb_mm : 1.0),
        thickFinishMm: r.thickFinishMm !== undefined ? r.thickFinishMm : (r.thick_finish_mm !== undefined ? r.thick_finish_mm : 4.9),
        densityGPerCm3: r.densityGPerCm3 !== undefined ? r.densityGPerCm3 : (r.density_g_per_cm3 !== undefined ? r.density_g_per_cm3 : (r.name?.toLowerCase().includes("ganache") ? 1.10 : r.name?.toLowerCase().includes("fondant") ? 1.35 : r.name?.toLowerCase().includes("whipped") ? 0.45 : 0.90)),
        wastePct: r.wastePct !== undefined ? r.wastePct : (r.waste_pct !== undefined ? r.waste_pct : 10),
        sellMode: r.sellMode || r.sell_mode || "piece",
        perBatch: r.perBatch !== undefined ? r.perBatch : (r.per_batch !== undefined ? r.per_batch : (r.batchSize || 30)),
        breakagePct: r.breakagePct !== undefined ? r.breakagePct : (r.breakage_pct !== undefined ? r.breakage_pct : 5),
        application: r.application || cov.application || "spread",
        fill_rate: r.fill_rate !== undefined ? r.fill_rate : (r.fillRate !== undefined ? r.fillRate : (cov.fill_rate ?? null)),
        crumb_rate: r.crumb_rate !== undefined ? r.crumb_rate : (r.crumbRate !== undefined ? r.crumbRate : (cov.crumb_rate ?? 0)),
        cover_rate: r.cover_rate !== undefined ? r.cover_rate : (r.coverRate !== undefined ? r.coverRate : (cov.cover_rate ?? null)),
        sheet_overhang_in: r.sheet_overhang_in !== undefined ? r.sheet_overhang_in : (r.sheetOverhangIn !== undefined ? r.sheetOverhangIn : (cov.sheet_overhang_in ?? null)),
        is_calibrated: r.is_calibrated !== undefined ? r.is_calibrated : (r.isCalibrated !== undefined ? r.isCalibrated : (cov.is_calibrated || false))
      })
    } else {
      setRecipeModal({
        id: uid(),
        name: "",
        size: "6",
        tiers: 1,
        type: "layer",
        covering: "buttercream",
        application: "spread",
        calShape: "round",
        calDimA: 6,
        calDimB: 8,
        calGrams: 617,
        calHeightIn: 2,
        trimPct: 8,
        density: null,
        canFill: true,
        canCrumb: true,
        canFinish: true,
        thickFillMm: 4.5,
        thickCrumbMm: 1.0,
        thickFinishMm: 4.9,
        densityGPerCm3: 0.90,
        wastePct: 10,
        sellMode: "piece",
        perBatch: 30,
        breakagePct: 5,
        fill_rate: 3.00,
        crumb_rate: 1.64,
        cover_rate: 3.263,
        sheet_overhang_in: null,
        is_calibrated: false,
        ing: []
      })
    }
  }
  const saveRecipe = async () => {
    if (isSavingRecipeRef.current || saving) return
    setRecipeModalError(null)
    if(!recipeModal.name || !recipeModal.name.trim()) {
      const errObj = {
        title: "Recipe Name Required",
        whatWentWrong: "Please provide a name for this recipe.",
        action: "Enter a descriptive name before saving."
      }
      setRecipeModalError(errObj)
      return showMsg("Recipe name is required", "red")
    }

    for (let idx = 0; idx < (recipeModal.ing || []).length; idx++) {
      const ing = recipeModal.ing[idx]
      if (ing.iid && (!ing.qty || parseFloat(ing.qty) <= 0)) {
        const itemObj = inventory.find(i => i.id === ing.iid)
        const name = itemObj ? itemObj.name : `Ingredient ${idx + 1}`
        const errObj = {
          title: "Invalid Ingredient Quantity",
          whatWentWrong: `${name} has an invalid or missing quantity.`,
          action: "A valid positive quantity is required for each ingredient.",
          fieldIndex: idx
        }
        setRecipeModalError(errObj)
        return showMsg(`Ingredient ${idx + 1} (${name}): valid quantity greater than 0 is required`, "red")
      }
    }

    // Auto-calculate density for cake layers if calibration values entered
    const payload = { ...recipeModal }
    if (payload.type === "cake_layer" || payload.type === "layer" || (!payload.type && payload.calGrams)) {
      const pa = planArea(payload.calShape || "round", Number(payload.calDimA) || 6, Number(payload.calDimB) || 8)
      const h = Number(payload.calHeightIn) || 2
      const w = Number(payload.calGrams) || 0
      if (pa > 0 && h > 0 && w > 0) {
        payload.density = w / (pa * h)
        payload.isCalibrated = true
      }
    }

    isSavingRecipeRef.current = true
    setSaving(true)
    try {
      const isExisting = recipes.some(r => r.id === payload.id)
      let savedRec
      if (isExisting) {
        savedRec = await updateRecipeOnServer(payload.id, payload)
      } else {
        savedRec = await createRecipeOnServer(payload)
      }
      const updated = recipes.find(r => r.id === savedRec.id)
        ? recipes.map(r => r.id === savedRec.id ? savedRec : r)
        : [...recipes, savedRec]
      setRecipes(updated)
      setRecipeModal(null)
      setRecipeModalError(null)
      showMsg("Recipe saved directly to database","green")
    } catch (e) {
      const formatted = e.details || formatApiError(e, { title: "Failed to save recipe" })
      setRecipeModalError(formatted)
      showMsg(formatted.displayMessage, "red")
    } finally {
      isSavingRecipeRef.current = false
      setSaving(false)
    }
  }
  const deleteRecipe = async (id) => {
    if(!confirm("Delete this recipe from database?"))return
    setSaving(true)
    try {
      await deleteRecipeOnServer(id)
      const updated=recipes.filter(r=>r.id!==id)
      setRecipes(updated)
      showMsg("Recipe deleted from database","green")
    } catch (e) {
      showMsg("Failed to delete recipe: " + e.message, "red")
    } finally {
      setSaving(false)
    }
  }
  const duplicateRecipe = async (r) => {
    setSaving(true)
    try {
      const copyPayload = {
        name: r.name + " (copy)",
        notes: r.notes || "",
        type: r.type || "layer",
        batchWeight: r.batchWeight,
        batchSize: r.batchSize,
        application: r.application,
        calShape: r.calShape || r.cal_shape || "round",
        calDimA: r.calDimA ?? r.cal_dim_a,
        calDimB: r.calDimB ?? r.cal_dim_b,
        calGrams: r.calGrams ?? r.cal_grams,
        calHeightIn: r.calHeightIn ?? r.cal_height_in,
        trimPct: r.trimPct ?? r.trim_pct,
        density: r.density,
        canFill: r.canFill ?? r.can_fill,
        canCrumb: r.canCrumb ?? r.can_crumb,
        canFinish: r.canFinish ?? r.can_finish,
        thickFillMm: r.thickFillMm ?? r.thick_fill_mm,
        thickCrumbMm: r.thickCrumbMm ?? r.thick_crumb_mm,
        thickFinishMm: r.thickFinishMm ?? r.thick_finish_mm,
        densityGPerCm3: r.densityGPerCm3 ?? r.density_g_per_cm3,
        wastePct: r.wastePct ?? r.waste_pct,
        sellMode: r.sellMode ?? r.sell_mode,
        perBatch: r.perBatch ?? r.per_batch,
        breakagePct: r.breakagePct ?? r.breakage_pct,
        fillRate: r.fillRate ?? r.fill_rate,
        crumbRate: r.crumbRate ?? r.crumb_rate,
        coverRate: r.coverRate ?? r.cover_rate,
        sheetOverhangIn: r.sheetOverhangIn ?? r.sheet_overhang_in,
        isCalibrated: r.isCalibrated ?? r.is_calibrated,
        ing: r.ing ? r.ing.map(i => ({ ...i })) : []
      }
      const savedCopy = await createRecipeOnServer(copyPayload)
      setRecipes([...recipes, savedCopy])
      setRecipeModal(savedCopy)
      showMsg("Recipe duplicated and saved to database — rename it and adjust quantities","green")
    } catch (e) {
      showMsg("Failed to duplicate recipe: " + e.message, "red")
    } finally {
      setSaving(false)
    }
  }
  const addIngToRecipe = () => setRecipeModal(r=>({...r,ing:[...r.ing,{iid:"",qty:""}]}))
  const updateIng = (idx,field,val) => setRecipeModal(r=>({...r,ing:r.ing.map((ing,i)=>i===idx?{...ing,[field]:val}:ing)}))
  const removeIng = (idx) => setRecipeModal(r=>({...r,ing:r.ing.filter((_,i)=>i!==idx)}))

  return <div>
    <SHead title="Master List" sub="All your ingredients, recipes, and decorations — changes here update all calculations."/>
    <Alert msg={msg} color={msgColor} onClose={()=>setMsg("")}/>
    
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
      <Tabs tabs={[{v:"inventory",l:"Inventory"},{v:"recipes",l:"Base Recipes"},{v:"decorations",l:"Decoration Extras"},{v:"packaging",l:"Boards & Packaging"}]} active={tab} onChange={setTab}/>
      <form
        onSubmit={e => e.preventDefault()}
        style={{ display: "flex", gap: 6, alignItems: "center", minWidth: 260, flex: "0 1 360px" }}
      >
        <div style={{ position: "relative", flex: 1, display: "flex", alignItems: "center" }}>
          <Search size={14} style={{ position: "absolute", left: 10, color: "var(--muted)", pointerEvents: "none" }} />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={`Search ${tab === "inventory" ? "inventory" : tab === "recipes" ? "base recipes" : tab === "decorations" ? "decorations" : "packaging"}...`}
            style={{ ...iSt, width: "100%", padding: "8px 28px 8px 30px", fontSize: 13, borderRadius: 8, border: "1.5px solid var(--gold)" }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              title="Clear search"
              style={{ position: "absolute", right: 8, background: "none", border: "none", cursor: "pointer", color: "var(--muted)", display: "flex", alignItems: "center" }}
            >
              <X size={14} />
            </button>
          )}
        </div>
        <Btn type="submit" small variant="primary" style={{ display: "inline-flex", alignItems: "center", gap: 4, height: 35 }}>
          <Search size={13} /> Search
        </Btn>
        {searchQuery && (
          <Btn type="button" small variant="ghost" onClick={() => setSearchQuery("")} style={{ height: 35 }}>
            Reset
          </Btn>
        )}
      </form>
    </div>

    {/* ── INVENTORY ── */}
    {tab==="inventory"&&<InventoryTab inventory={inventory} setInventory={setInventory} isOwner={isOwner} showMsg={showMsg} setView={setView} setTab={setTab} searchQuery={searchQuery} company={company}/>}

    {/* ── RECIPES ── */}
    {tab==="recipes"&&<div>
      <div style={{marginBottom:12,padding:"10px 14px",background:"#FFF9EE",borderRadius:8,border:"1px solid var(--gold)",fontSize:13,lineHeight:1.7}}>
        Each recipe is for <strong>1 layer</strong> of that flavour. When you log a production, select the recipe and enter the number of layers — the app multiplies automatically.
      </div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <span style={{fontSize:13,color:"var(--muted)"}}>{filteredRecipes.length} recipes {searchQuery ? "(filtered)" : "total"} · click any card to expand</span>
        {isOwner&&<Btn small onClick={()=>openRecipe(null)}>+ New Recipe</Btn>}
      </div>
      {filteredRecipes.length === 0 ? (
        <Card style={{ padding: 24, textAlign: "center", color: "var(--muted)", marginBottom: 12 }}>
          {recipes.length === 0 ? "No recipes created yet. Click + New Recipe to get started." : "No recipes matching search."}
        </Card>
      ) : (
        paginatedRecipes.map(r=><RecipeCard key={r.id} r={r} inventory={inventory} isOwner={isOwner} onEdit={()=>openRecipe(r)} onDelete={()=>deleteRecipe(r.id)} onDuplicate={()=>duplicateRecipe(r)}/>)
      )}
      <Pagination
        currentPage={recipePage}
        totalItems={filteredRecipes.length}
        pageSize={recipePageSize}
        onPageChange={setRecipePage}
        onPageSizeChange={(sz) => {
          setRecipePageSize(sz)
          setRecipePage(1)
        }}
        pageSizeOptions={[10, 25, 50, 100]}
        itemLabel="recipes"
      />

      {recipeModal&&<Modal title={recipeModal.name?"Edit Recipe":"New Recipe"} onClose={()=>{ setRecipeModal(null); setRecipeModalError(null); }}>
        {recipeModalError && (
          <div role="alert" style={{ padding: "9px 12px", background: "#FDEBE9", borderRadius: 8, border: "1px solid #F5C6CB", color: "#B03A2E", fontSize: 12, marginBottom: 12, display: "flex", alignItems: "flex-start", gap: 6 }}>
            <AlertTriangle size={14} style={{ marginTop: 2, flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 600 }}>{recipeModalError.title || "Unable to save recipe"}</div>
              <div style={{ marginTop: 2 }}>{recipeModalError.whatWentWrong || recipeModalError.displayMessage}</div>
              {recipeModalError.action && <div style={{ marginTop: 2, fontWeight: 500 }}>{recipeModalError.action}</div>}
            </div>
          </div>
        )}
        <Inp label="Recipe Name * (e.g. Vanilla Cake, Buttercream)" value={recipeModal.name} onChange={v=>{ setRecipeModal(r=>({...r,name:v})); setRecipeModalError(null); }}/>
        <div style={{marginBottom:11}}>
          <label style={{fontSize:10.5,color:"var(--muted)",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:.8,fontWeight:500}}>Recipe type *</label>
          <div style={{display:"flex",gap:8}}>
            {[{v:"layer",l:"Cake layer",sub:"Vanilla, Red Velvet, Chocolate etc."},{v:"covering",l:"Covering / Filling",sub:"Buttercream, Fondant, Ganache etc."},{v:"pastry",l:"Pastry / Batch",sub:"Donuts, tarts, brownies, loaves etc."}].map(t=><div key={t.v} onClick={()=>setRecipeModal(r=>({...r,type:t.v}))} style={{flex:1,padding:"10px 12px",borderRadius:8,border:`1.5px solid ${(recipeModal.type||"layer")===t.v?"var(--gold)":"var(--border)"}`,background:(recipeModal.type||"layer")===t.v?"#FFF9EE":"var(--panel)",cursor:"pointer"}}>
              <div style={{fontSize:13,fontWeight:500,color:(recipeModal.type||"layer")===t.v?"var(--gold)":"var(--text)"}}>{t.l}</div>
              <div style={{fontSize:11,color:"var(--muted)",marginTop:2}}>{t.sub}</div>
            </div>)}
          </div>
        </div>
        <Inp label="Notes (optional)" value={recipeModal.notes||""} onChange={v=>setRecipeModal(r=>({...r,notes:v}))} placeholder="e.g. Classic vanilla sponge"/>
        <div style={{padding:"8px 12px",background:"#FFF9EE",borderRadius:7,fontSize:12.5,color:"var(--gold)",marginBottom:12}}>
          {(recipeModal.type||"layer")==="layer" || recipeModal.type==="cake_layer"
            ?<span>Enter quantities for <strong>one single layer</strong>. The app uses the calibration card below to scale batter for any cake size.</span>
            :(recipeModal.type||"layer")==="covering"
            ?<span>Enter quantities for <strong>one full batch</strong>. Declare which jobs this recipe can perform on the cake.</span>
            :<span>Enter quantities for <strong>one full batch</strong>. Declare pieces or weight per batch.</span>}
        </div>
        {((recipeModal.type||"layer")==="layer" || recipeModal.type==="cake_layer") && (
          <CakeLayerCalibrationCard recipeModal={recipeModal} setRecipeModal={setRecipeModal} />
        )}
        {(recipeModal.type==="covering" || recipeModal.type==="filling") && (
          <CoveringCalibrationCard recipeModal={recipeModal} setRecipeModal={setRecipeModal} />
        )}
        {recipeModal.type==="pastry" && (
          <PastrySettingsCard recipeModal={recipeModal} setRecipeModal={setRecipeModal} />
        )}
        <div style={{fontWeight:600,fontSize:13,marginBottom:8}}>
          {recipeModal.type==="pastry"?"Ingredients (per batch)":recipeModal.type==="covering"?"Ingredients (per batch)":"Ingredients (per 1 layer)"}
        </div>
        {recipeModal.ing.map((ing,idx)=>{
          const hasRowError = recipeModalError && (recipeModalError.fieldIndex === idx || (recipeModalError.field?.includes('ingredients') && (!ing.qty || parseFloat(ing.qty) <= 0)))
          const options = inventory
            .filter(i => i.cat !== "Board and Packaging" && i.category !== "Board and Packaging")
            .map(i => ({
              value: i.id,
              label: `${i.name} (${i.unit}) — ${fmtCost(i.cost)}/${i.unit}`
            }))
          return <div key={idx} style={{display:"flex",gap:8,marginBottom:6,alignItems:"center",padding:hasRowError?"4px":"0",borderRadius:6,background:hasRowError?"rgba(176,58,46,0.06)":"transparent",border:hasRowError?"1px solid #F5C6CB":"none"}}>
            <SearchableSelect
              value={ing.iid}
              onChange={val => { updateIng(idx,"iid",val); setRecipeModalError(null); }}
              options={options}
              placeholder="Type to search ingredient..."
            />
            <input type="number" step="any" placeholder="Qty" value={ing.qty} onChange={e=>{ updateIng(idx,"qty",e.target.value); setRecipeModalError(null); }} style={{...iSt,width:70,fontSize:12,borderColor:hasRowError&&(!ing.qty||parseFloat(ing.qty)<=0)?"#B03A2E":undefined}}/>
            <Btn small variant="danger" onClick={()=>removeIng(idx)} style={{display:"inline-flex",alignItems:"center",gap:4}}><X size={11}/></Btn>
          </div>
        })}
        <Btn small variant="ghost" onClick={addIngToRecipe}>+ Add Ingredient</Btn>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <Btn small variant="outline" onClick={() => setShowRecipeExcelImport(true)} style={{display:"inline-flex",alignItems:"center",gap:5}}><FileSpreadsheet size={13}/> Import from Excel</Btn>
          <Btn small variant="outline" onClick={() => setShowRecipeScan(true)} style={{display:"inline-flex",alignItems:"center",gap:5}}><Camera size={13}/> Scan Recipe (AI)</Btn>
        </div>
        {recipeModal.ing.length>0&&<div style={{marginTop:10,padding:"8px 12px",background:"#F5F0E4",borderRadius:7,fontSize:13}}>
          {recipeModal.type==="pastry"
            ?<>Batch cost: <strong style={{color:"var(--gold)"}}>{fmt(recipeCost(recipeModal,inventory))}</strong>
              {recipeModal.batchSize>0&&<span style={{marginLeft:8,color:"var(--muted)"}}>· Cost per piece: <strong style={{color:"var(--gold)"}}>{fmt(recipeCost(recipeModal,inventory)/(recipeModal.batchSize))}</strong></span>}</>
            :recipeModal.type==="covering"
            ?<>Cost per batch: <strong style={{color:"var(--gold)"}}>{fmt(recipeCost(recipeModal,inventory))}</strong></>
            :<>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
                <span>Total batch: <strong style={{color:"var(--gold)"}}>{fmt(recipeCost(recipeModal,inventory))}</strong></span>
                <span>· Cost per layer: <strong style={{color:"var(--gold)"}}>{fmt(recipeCost(recipeModal,inventory)/(parseFloat(recipeModal.yieldLayers)||1))}</strong></span>
              </div>
            </>}
        </div>}
        <div style={{marginTop:12,display:"flex",gap:8}}>
          <Btn variant="success" onClick={saveRecipe} loading={saving} loadingText="Saving Recipe..." disabled={saving} style={{display:"inline-flex",alignItems:"center",gap:5}}>
            <Check size={13}/> Save Recipe
          </Btn>
          <Btn variant="ghost" onClick={()=>setRecipeModal(null)} disabled={saving}>Cancel</Btn>
        </div>
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
    {tab==="decorations"&&<DecorationsTab inventory={inventory} setInventory={setInventory} isOwner={isOwner} searchQuery={searchQueries.decorations}/>}
    {/* ── PACKAGING ── */}
    {tab==="packaging"&&<PackagingTab inventory={inventory} setInventory={setInventory} isOwner={isOwner} searchQuery={searchQueries.packaging}/>}
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
          {warnMsg && <div style={{ padding: "7px 12px", background: "#FDEBE9", borderRadius: 7, fontSize: 12, color: "#B03A2E", marginBottom: 10, display: "flex", alignItems: "center", gap: 5 }}><AlertTriangle size={12} /> {warnMsg}</div>}
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
            <Btn variant="success" onClick={confirmImport} disabled={!prevItems.some(p => p.on && p.iid)} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <Check size={13} /> Import Selected ({prevItems.filter(p => p.on && p.iid).length})
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
      ], "Parse recipe sheets and extract ingredients with quantities matching inventory list. Return valid JSON only.", 1000, { creditCost: 2, feature: "recipe_scanner" })

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
                style={{ padding: "10px 14px", borderRadius: 8, border: "2px dashed var(--border)", background: "#FAF7F0", cursor: "pointer", fontSize: 12.5, fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <Camera size={14} /> Choose image / Open camera
              </button>
              {photo && (
                <div style={{ border: "1px solid var(--border)", borderRadius: 6, padding: 2, background: "#fff" }}>
                  <img src={photo} alt="recipe preview" style={{ maxHeight: 60, borderRadius: 4 }} />
                </div>
              )}
            </div>
          </div>

          {error && (
            <div style={{ padding: "8px 12px", background: (error.toLowerCase().includes("credit") || error.toLowerCase().includes("token")) ? "#FFF4E5" : "#FDEBE9", border: (error.toLowerCase().includes("credit") || error.toLowerCase().includes("token")) ? "1px solid #FFE0B2" : "1px solid #FCDAD7", borderRadius: 8, fontSize: 12.5, color: (error.toLowerCase().includes("credit") || error.toLowerCase().includes("token")) ? "#92400E" : "#B03A2E", marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <AlertTriangle size={13} color={(error.toLowerCase().includes("credit") || error.toLowerCase().includes("token")) ? "#D97706" : "#B03A2E"} />
                <span>{error}</span>
              </div>
              {(error.toLowerCase().includes("credit") || error.toLowerCase().includes("token")) && (
                <button
                  type="button"
                  onClick={() => {
                    if (typeof window !== "undefined") {
                      window.dispatchEvent(new CustomEvent("bakewealth:insufficient-tokens", { detail: { requiredTokens: 2, requiredCredits: 2 } }))
                      window.dispatchEvent(new CustomEvent("layerledger:insufficient-tokens", { detail: { requiredTokens: 2, requiredCredits: 2 } }))
                      window.dispatchEvent(new CustomEvent("layerledger:insufficient-credits", { detail: { requiredTokens: 2, requiredCredits: 2 } }))
                    }
                  }}
                  style={{ background: "var(--gold)", color: "#fff", border: "none", borderRadius: 6, padding: "3px 8px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
                >
                  Buy Credits
                </button>
              )}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", borderTop: "1px solid var(--border)", paddingTop: 12 }}>
            <Btn onClick={scan} disabled={loading || (!pasteText.trim() && !photoB64)} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              {loading ? "AI is reading recipe..." : <><Sparkles size={13} /> AI Scan & Extract <span style={{ fontSize: 10.5, opacity: 0.85 }}>(2 credits)</span></>}
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
            <Btn variant="success" onClick={confirmImport} disabled={!parsedItems.some(p => p.on && p.iid)} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Check size={13} /> Add to Recipe ({parsedItems.filter(p => p.on && p.iid).length})
            </Btn>
            <Btn variant="ghost" onClick={() => setParsedItems(null)}>← Scan again</Btn>
          </div>
        </div>
      )}
    </div>
  )
}

export function CakeLayerCalibrationCard({ recipeModal, setRecipeModal }) {
  const shape = recipeModal.calShape || "round"
  const dimA = Number(recipeModal.calDimA) || 6
  const dimB = Number(recipeModal.calDimB) || 8
  const grams = Number(recipeModal.calGrams) || 617
  const heightIn = Number(recipeModal.calHeightIn) || 2
  const trimPct = recipeModal.trimPct !== undefined ? Number(recipeModal.trimPct) : 8

  // plan area in sq in
  const pArea = planArea(shape, dimA, dimB)
  const density = calculateDensity(shape, dimA, dimB, heightIn, grams)

  // Worked example for 10" round, 3 layers at 2"
  const exPArea = planArea("round", 10)
  const exPerPan = Math.round(gramsPerPan(density, exPArea, 2, trimPct / 100))
  const exTotal = exPerPan * 3

  return (
    <div style={{ marginTop: 12, marginBottom: 14, background: "#FDFAF4", border: "1.5px solid var(--gold)", borderRadius: 10, padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text)" }}>
          Calibration Bake · How this batter bakes
        </div>
        <span style={{ fontSize: 11, color: "#1E6B37", background: "#E8F5EE", padding: "2px 8px", borderRadius: 12, fontWeight: 600 }}>
          {density > 0 ? `Density: ${density.toFixed(2)} g/in³` : "Not calibrated"}
        </span>
      </div>
      <p style={{ fontSize: 11.5, color: "var(--muted)", margin: "0 0 12px", lineHeight: 1.5 }}>
        Pour one pan, weigh what you poured, bake it, level it, and measure the layer you are left with. The app scales batter for any cake size from this.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: shape === "rect" ? "repeat(6, 1fr)" : "repeat(5, 1fr)", gap: 8, marginBottom: 12 }}>
        <div>
          <label style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", display: "block", marginBottom: 4, fontWeight: 600 }}>Reference Pan</label>
          <div style={{ display: "flex", gap: 3 }}>
            {["round", "square", "rect"].map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setRecipeModal(r => ({ ...r, calShape: s, isCalibrated: true }))}
                style={{
                  flex: 1,
                  padding: "5px 2px",
                  fontSize: 11,
                  borderRadius: 6,
                  border: shape === s ? "1px solid var(--gold)" : "1px solid var(--border)",
                  background: shape === s ? "var(--gold)" : "var(--panel)",
                  color: shape === s ? "#fff" : "var(--text)",
                  fontWeight: shape === s ? 600 : 400,
                  cursor: "pointer",
                  textTransform: "capitalize"
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", display: "block", marginBottom: 4, fontWeight: 600 }}>
            {shape === "round" ? "Diameter (in)" : shape === "square" ? "Side (in)" : "Length (in)"}
          </label>
          <input
            type="number"
            step="0.5"
            min="1"
            value={recipeModal.calDimA ?? 6}
            onChange={e => setRecipeModal(r => ({ ...r, calDimA: parseFloat(e.target.value) || 0, isCalibrated: true }))}
            style={{ ...iSt, padding: "5px 8px", fontSize: 12 }}
          />
        </div>

        {shape === "rect" && (
          <div>
            <label style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", display: "block", marginBottom: 4, fontWeight: 600 }}>Width (in)</label>
            <input
              type="number"
              step="0.5"
              min="1"
              value={recipeModal.calDimB ?? 8}
              onChange={e => setRecipeModal(r => ({ ...r, calDimB: parseFloat(e.target.value) || 0, isCalibrated: true }))}
              style={{ ...iSt, padding: "5px 8px", fontSize: 12 }}
            />
          </div>
        )}

        <div>
          <label style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", display: "block", marginBottom: 4, fontWeight: 600 }}>Grams poured</label>
          <input
            type="number"
            step="5"
            min="1"
            value={recipeModal.calGrams ?? 617}
            onChange={e => setRecipeModal(r => ({ ...r, calGrams: parseFloat(e.target.value) || 0, isCalibrated: true }))}
            style={{ ...iSt, padding: "5px 8px", fontSize: 12 }}
          />
        </div>

        <div>
          <label style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", display: "block", marginBottom: 4, fontWeight: 600 }}>Height levelled (in)</label>
          <input
            type="number"
            step="0.25"
            min="0.25"
            value={recipeModal.calHeightIn ?? 2}
            onChange={e => setRecipeModal(r => ({ ...r, calHeightIn: parseFloat(e.target.value) || 0, isCalibrated: true }))}
            style={{ ...iSt, padding: "5px 8px", fontSize: 12 }}
          />
        </div>

        <div>
          <label style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", display: "block", marginBottom: 4, fontWeight: 600 }}>Trim & Level %</label>
          <input
            type="number"
            step="1"
            min="0"
            value={recipeModal.trimPct ?? 8}
            onChange={e => setRecipeModal(r => ({ ...r, trimPct: parseFloat(e.target.value) || 0 }))}
            style={{ ...iSt, padding: "5px 8px", fontSize: 12 }}
          />
        </div>
      </div>

      <div style={{ background: "#F5F0E4", borderRadius: 8, padding: "9px 12px", border: "1px solid var(--border)", fontSize: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>
          <span>Worked Example: 10″ round, 3 layers at 2″</span>
          <span style={{ color: "var(--gold)" }}>{exTotal.toLocaleString()} g batter total</span>
        </div>
        <div style={{ color: "var(--muted)", fontSize: 11.5 }}>
          Plan area: {pArea.toFixed(1)} in² · {exPerPan.toLocaleString()} g poured per pan (includes {trimPct}% trim allowance)
        </div>
      </div>
    </div>
  )
}

export function CoveringCalibrationCard({ recipeModal, setRecipeModal }) {
  const [calShape, setCalShape] = useState("round")
  const [calSize, setCalSize] = useState("8")
  const [calLayers, setCalLayers] = useState("3")
  const [calUsedGrams, setCalUsedGrams] = useState("")
  const [derivedThick, setDerivedThick] = useState(null)

  const canFill = recipeModal.canFill ?? true
  const canCrumb = recipeModal.canCrumb ?? true
  const canFinish = recipeModal.canFinish ?? true
  const thickFillMm = recipeModal.thickFillMm ?? 4.5
  const thickCrumbMm = recipeModal.thickCrumbMm ?? 1.0
  const thickFinishMm = recipeModal.thickFinishMm ?? 4.9
  const density = recipeModal.densityGPerCm3 ?? 0.90
  const wastePct = recipeModal.wastePct ?? 10

  // Worked example for 10" round, 3 layers at 2"
  const exFillArea = planArea("round", 10) * 2
  const exSurfArea = planArea("round", 10) + perimeter("round", 10) * 6
  const exFillG = canFill ? Math.round(coveringMass(exFillArea, thickFillMm, density, wastePct / 100)) : 0
  const exCrumbG = canCrumb ? Math.round(coveringMass(exSurfArea, thickCrumbMm, density, wastePct / 100)) : 0
  const exFinG = canFinish ? Math.round(coveringMass(exSurfArea, thickFinishMm, density, wastePct / 100)) : 0
  const exTotalG = exFillG + exCrumbG + exFinG

  const doReverseCal = (gVal) => {
    const g = parseFloat(gVal) || 0
    setCalUsedGrams(gVal)
    if (g > 0) {
      const sArea = planArea(calShape, parseFloat(calSize)) + perimeter(calShape, parseFloat(calSize)) * (parseFloat(calLayers) * 2)
      const t = reverseThicknessMm(g, sArea, density, wastePct / 100)
      setDerivedThick(t > 0 ? parseFloat(t.toFixed(1)) : null)
    } else {
      setDerivedThick(null)
    }
  }

  return (
    <div style={{ marginTop: 12, marginBottom: 14, background: "#FDFAF4", border: "1.5px solid var(--gold)", borderRadius: 10, padding: 14 }}>
      <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text)", marginBottom: 8 }}>
        Job Declaration · Where do you use this?
      </div>
      <p style={{ fontSize: 11.5, color: "var(--muted)", margin: "0 0 12px", lineHeight: 1.5 }}>
        Tick the roles this recipe can perform. When quoting a cake, the dropdowns will only show recipes that can do that job.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 12 }}>
        <div style={{ border: canFill ? "1.5px solid var(--gold)" : "1px solid var(--border)", background: canFill ? "#FFF9EE" : "var(--panel)", borderRadius: 8, padding: 10 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontWeight: 600, fontSize: 12.5, color: "var(--text)" }}>
            <input
              type="checkbox"
              checked={canFill}
              onChange={e => setRecipeModal(r => ({ ...r, canFill: e.target.checked }))}
              style={{ accentColor: "var(--gold)", width: 15, height: 15 }}
            />
            Between layers
          </label>
          <div style={{ fontSize: 11, color: "var(--muted)", margin: "3px 0 8px 21px" }}>Filling</div>
          {canFill && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 21 }}>
              <input
                type="number"
                step="0.1"
                min="0"
                value={thickFillMm}
                onChange={e => setRecipeModal(r => ({ ...r, thickFillMm: parseFloat(e.target.value) || 0 }))}
                style={{ ...iSt, width: 65, padding: "4px 6px", fontSize: 12 }}
              />
              <span style={{ fontSize: 11.5, color: "var(--muted)" }}>mm thick</span>
            </div>
          )}
        </div>

        <div style={{ border: canCrumb ? "1.5px solid var(--gold)" : "1px solid var(--border)", background: canCrumb ? "#FFF9EE" : "var(--panel)", borderRadius: 8, padding: 10 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontWeight: 600, fontSize: 12.5, color: "var(--text)" }}>
            <input
              type="checkbox"
              checked={canCrumb}
              onChange={e => setRecipeModal(r => ({ ...r, canCrumb: e.target.checked }))}
              style={{ accentColor: "var(--gold)", width: 15, height: 15 }}
            />
            Crumb coat
          </label>
          <div style={{ fontSize: 11, color: "var(--muted)", margin: "3px 0 8px 21px" }}>Seals crumbs</div>
          {canCrumb && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 21 }}>
              <input
                type="number"
                step="0.1"
                min="0"
                value={thickCrumbMm}
                onChange={e => setRecipeModal(r => ({ ...r, thickCrumbMm: parseFloat(e.target.value) || 0 }))}
                style={{ ...iSt, width: 65, padding: "4px 6px", fontSize: 12 }}
              />
              <span style={{ fontSize: 11.5, color: "var(--muted)" }}>mm thick</span>
            </div>
          )}
        </div>

        <div style={{ border: canFinish ? "1.5px solid var(--gold)" : "1px solid var(--border)", background: canFinish ? "#FFF9EE" : "var(--panel)", borderRadius: 8, padding: 10 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontWeight: 600, fontSize: 12.5, color: "var(--text)" }}>
            <input
              type="checkbox"
              checked={canFinish}
              onChange={e => setRecipeModal(r => ({ ...r, canFinish: e.target.checked }))}
              style={{ accentColor: "var(--gold)", width: 15, height: 15 }}
            />
            Outside finish
          </label>
          <div style={{ fontSize: 11, color: "var(--muted)", margin: "3px 0 8px 21px" }}>What client sees</div>
          {canFinish && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 21 }}>
              <input
                type="number"
                step="0.1"
                min="0"
                value={thickFinishMm}
                onChange={e => setRecipeModal(r => ({ ...r, thickFinishMm: parseFloat(e.target.value) || 0 }))}
                style={{ ...iSt, width: 65, padding: "4px 6px", fontSize: 12 }}
              />
              <span style={{ fontSize: 11.5, color: "var(--muted)" }}>mm thick</span>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12, borderTop: "1px solid var(--border)", paddingTop: 10 }}>
        <div>
          <label style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", display: "block", marginBottom: 4, fontWeight: 600 }}>Density (g/cm³)</label>
          <input
            type="number"
            step="0.01"
            min="0.1"
            value={density}
            onChange={e => setRecipeModal(r => ({ ...r, densityGPerCm3: parseFloat(e.target.value) || 0 }))}
            style={{ ...iSt, padding: "5px 8px", fontSize: 12 }}
          />
          <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 3 }}>
            Buttercream ~0.90 · Ganache ~1.10 · Fondant ~1.35 · Whipped ~0.45
          </div>
        </div>
        <div>
          <label style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", display: "block", marginBottom: 4, fontWeight: 600 }}>Waste %</label>
          <input
            type="number"
            step="1"
            min="0"
            value={wastePct}
            onChange={e => setRecipeModal(r => ({ ...r, wastePct: parseFloat(e.target.value) || 0 }))}
            style={{ ...iSt, padding: "5px 8px", fontSize: 12 }}
          />
          <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 3 }}>
            Bowl scrape, piping bag retention & smoothing allowance
          </div>
        </div>
      </div>

      <div style={{ background: "#F0F4FA", border: "1px solid #D2E0F5", borderRadius: 8, padding: "10px 12px", marginBottom: 10 }}>
        <div style={{ fontSize: 11.5, fontWeight: 600, color: "#2355A0", marginBottom: 6 }}>
          Or calibrate it · Cover one cake, weigh what left the bowl
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 6 }}>
          <select value={calShape} onChange={e => { setCalShape(e.target.value); doReverseCal(calUsedGrams) }} style={{ ...iSt, fontSize: 11, padding: "4px" }}>
            <option value="round">Round</option>
            <option value="square">Square</option>
            <option value="rect">Rectangle</option>
          </select>
          <input type="number" placeholder="Size" value={calSize} onChange={e => { setCalSize(e.target.value); doReverseCal(calUsedGrams) }} style={{ ...iSt, fontSize: 11, padding: "4px" }} />
          <input type="number" placeholder="Layers" value={calLayers} onChange={e => { setCalLayers(e.target.value); doReverseCal(calUsedGrams) }} style={{ ...iSt, fontSize: 11, padding: "4px" }} />
          <input type="number" placeholder="Grams used" value={calUsedGrams} onChange={e => doReverseCal(e.target.value)} style={{ ...iSt, fontSize: 11, padding: "4px" }} />
        </div>
        {derivedThick && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11.5, color: "#2355A0", marginTop: 4 }}>
            <span>Derived thickness: <strong>{derivedThick} mm</strong></span>
            <button
              type="button"
              onClick={() => {
                setRecipeModal(r => ({ ...r, thickFinishMm: derivedThick, isCalibrated: true }))
              }}
              style={{ background: "#2355A0", color: "#fff", border: "none", borderRadius: 5, padding: "3px 8px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}
            >
              Use as Outside finish thickness
            </button>
          </div>
        )}
      </div>

      <div style={{ background: "#F5F0E4", borderRadius: 8, padding: "9px 12px", border: "1px solid var(--border)", fontSize: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>
          <span>Worked Example: 10″ round, 3 layers at 2″</span>
          <span style={{ color: "var(--gold)" }}>{exTotalG.toLocaleString()} g total</span>
        </div>
        <div style={{ display: "flex", gap: 12, color: "var(--muted)", fontSize: 11.5 }}>
          <span>Fill: {exFillG} g</span>
          <span>Crumb: {exCrumbG} g</span>
          <span>Finish: {exFinG} g</span>
        </div>
      </div>
    </div>
  )
}

export function PastrySettingsCard({ recipeModal, setRecipeModal }) {
  const sellMode = recipeModal.sellMode || "piece"
  const perBatch = recipeModal.perBatch || recipeModal.batchSize || 30
  const breakagePct = recipeModal.breakagePct !== undefined ? recipeModal.breakagePct : 5

  return (
    <div style={{ marginTop: 12, marginBottom: 14, background: "#FDFAF4", border: "1.5px solid var(--gold)", borderRadius: 10, padding: 14 }}>
      <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text)", marginBottom: 8 }}>
        How this batch divides
      </div>
      <p style={{ fontSize: 11.5, color: "var(--muted)", margin: "0 0 12px", lineHeight: 1.5 }}>
        For everything that comes out of a batch in countable pieces or by weight (donuts, chin chin, loaves, cookies).
      </p>

      <div style={{ marginBottom: 10 }}>
        <label style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", display: "block", marginBottom: 4, fontWeight: 600 }}>How do you sell it?</label>
        <div style={{ display: "flex", gap: 6, maxWidth: 260 }}>
          <button
            type="button"
            onClick={() => setRecipeModal(r => ({ ...r, sellMode: "piece" }))}
            style={{
              flex: 1,
              padding: "7px 12px",
              borderRadius: 6,
              border: sellMode === "piece" ? "1.5px solid var(--gold)" : "1px solid var(--border)",
              background: sellMode === "piece" ? "var(--gold)" : "var(--panel)",
              color: sellMode === "piece" ? "#fff" : "var(--text)",
              fontWeight: sellMode === "piece" ? 600 : 400,
              cursor: "pointer"
            }}
          >
            By the piece
          </button>
          <button
            type="button"
            onClick={() => setRecipeModal(r => ({ ...r, sellMode: "weight" }))}
            style={{
              flex: 1,
              padding: "7px 12px",
              borderRadius: 6,
              border: sellMode === "weight" ? "1.5px solid var(--gold)" : "1px solid var(--border)",
              background: sellMode === "weight" ? "var(--gold)" : "var(--panel)",
              color: sellMode === "weight" ? "#fff" : "var(--text)",
              fontWeight: sellMode === "weight" ? 600 : 400,
              cursor: "pointer"
            }}
          >
            By weight
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 8 }}>
        <div>
          <label style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", display: "block", marginBottom: 4, fontWeight: 600 }}>
            {sellMode === "piece" ? "Pieces a batch makes" : "Pack size (g)"}
          </label>
          <input
            type="number"
            step="1"
            min="1"
            value={perBatch}
            onChange={e => setRecipeModal(r => ({ ...r, perBatch: parseFloat(e.target.value) || 0, batchSize: parseFloat(e.target.value) || 0 }))}
            style={{ ...iSt, padding: "5px 8px", fontSize: 12 }}
          />
        </div>
        <div>
          <label style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", display: "block", marginBottom: 4, fontWeight: 600 }}>Breakage & Waste %</label>
          <input
            type="number"
            step="1"
            min="0"
            value={breakagePct}
            onChange={e => setRecipeModal(r => ({ ...r, breakagePct: parseFloat(e.target.value) || 0 }))}
            style={{ ...iSt, padding: "5px 8px", fontSize: 12 }}
          />
        </div>
      </div>
    </div>
  )
}

export function CoverageWorkedExampleAndCalibration({ recipeModal, setRecipeModal }) {
  const [showDetail, setShowDetail] = useState(false)
  const [calSize, setCalSize] = useState("10")
  const [calLayers, setCalLayers] = useState("2")
  const [calShape, setCalShape] = useState("Round")
  const [calUnit, setCalUnit] = useState("grams") // "grams" or "batches"
  const [calUsed, setCalUsed] = useState("")
  const [calSuccess, setCalSuccess] = useState(false)

  const cov = getRecipeCoverageValues(recipeModal)
  const isRolled = recipeModal.application === "rolled" || cov.application === "rolled"

  // 1. Preset selection
  const handleSelectPreset = (preset) => {
    setRecipeModal(r => ({
      ...r,
      application: preset.application,
      fill_rate: preset.fill_rate,
      crumb_rate: preset.crumb_rate,
      cover_rate: preset.cover_rate,
      sheet_overhang_in: preset.sheet_overhang_in,
      is_calibrated: false
    }))
    setCalSuccess(false)
  }

  // Determine current active preset if matches
  const activePresetId = COVERAGE_PRESETS.find(p => 
    p.application === (recipeModal.application || cov.application) &&
    (p.fill_rate === null ? recipeModal.fill_rate === null : Number(p.fill_rate) === Number(recipeModal.fill_rate ?? cov.fill_rate)) &&
    Number(p.cover_rate) === Number(recipeModal.cover_rate ?? cov.cover_rate)
  )?.id

  // 2. Worked example against reference cake (10" 2 layers)
  const refOverhang = isRolled ? (Number(recipeModal.sheet_overhang_in ?? cov.sheet_overhang_in) || 2.4) : 0
  const refGeom = calculateCakeGeometry(10, 2, "Round", refOverhang)
  const betweenLayersG = (recipeModal.fill_rate !== null && recipeModal.fill_rate !== undefined && !isRolled)
    ? Math.round((Number(recipeModal.fill_rate ?? cov.fill_rate) || 0) * refGeom.gap_area)
    : 0
  const crumbCoatG = Math.round((Number(recipeModal.crumb_rate ?? cov.crumb_rate) || 0) * refGeom.surface_area)
  const outsideFinishG = Math.round((Number(recipeModal.cover_rate ?? cov.cover_rate) || 0) * (isRolled ? refGeom.sheet_area : refGeom.surface_area))
  const totalRefGrams = betweenLayersG + crumbCoatG + outsideFinishG

  const batchWeight = Number(recipeModal.batchWeight) || 0
  const batchesText = batchWeight > 0 ? (totalRefGrams / batchWeight).toFixed(2) : null

  // 3. Calibration calculations
  const calOverhang = isRolled ? (Number(recipeModal.sheet_overhang_in ?? cov.sheet_overhang_in) || 2.4) : 0
  const calGeom = calculateCakeGeometry(calSize, calLayers, calShape, calOverhang)
  const calBaseline = calculateFillingGrams(recipeModal, calGeom) + calculateCoveringGrams(recipeModal, calGeom)

  const rawEntered = parseFloat(calUsed) || 0
  const enteredGrams = calUnit === "batches" && batchWeight > 0 ? rawEntered * batchWeight : rawEntered
  const calScale = calBaseline > 0 && enteredGrams > 0 ? (enteredGrams / calBaseline) : 1
  const pctDiff = calBaseline > 0 && enteredGrams > 0 ? Math.round(((enteredGrams - calBaseline) / calBaseline) * 100) : 0

  const scaledFill = recipeModal.fill_rate !== null && recipeModal.fill_rate !== undefined
    ? Number(((Number(recipeModal.fill_rate ?? cov.fill_rate) || 0) * calScale).toFixed(3))
    : null
  const scaledCrumb = Number(((Number(recipeModal.crumb_rate ?? cov.crumb_rate) || 0) * calScale).toFixed(3))
  const scaledCover = Number(((Number(recipeModal.cover_rate ?? cov.cover_rate) || 0) * calScale).toFixed(3))

  const handleApplyCalibration = () => {
    if (!enteredGrams || enteredGrams <= 0) return
    setRecipeModal(r => ({
      ...r,
      fill_rate: scaledFill,
      crumb_rate: scaledCrumb,
      cover_rate: scaledCover,
      is_calibrated: true
    }))
    setCalSuccess(true)
    setTimeout(() => setCalSuccess(false), 5000)
  }

  return (
    <div style={{ marginBottom: 14, marginTop: 4 }}>
      {/* SECTION: How does it go on the cake? */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <label style={{ fontSize: 10.5, color: "var(--muted)", textTransform: "uppercase", letterSpacing: .8, fontWeight: 600 }}>
            How does it go on the cake? *
          </label>
          {(recipeModal.is_calibrated || cov.is_calibrated) && (
            <span style={{ fontSize: 11, color: "#1E6B37", background: "#E8F5EE", padding: "2px 8px", borderRadius: 12, fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 4 }}>
              <Check size={11} /> Calibrated to your hand
            </span>
          )}
        </div>
        
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {COVERAGE_PRESETS.map(preset => {
            const isSelected = activePresetId === preset.id
            return (
              <div
                key={preset.id}
                onClick={() => handleSelectPreset(preset)}
                style={{
                  padding: "9px 11px",
                  borderRadius: 8,
                  border: `1.5px solid ${isSelected ? "var(--gold)" : "var(--border)"}`,
                  background: isSelected ? "#FFF9EE" : "var(--panel)",
                  cursor: "pointer",
                  transition: "all 0.15s"
                }}
              >
                <div style={{ fontSize: 12.5, fontWeight: 600, color: isSelected ? "var(--gold)" : "var(--text)" }}>
                  {preset.label}
                </div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2, lineHeight: 1.3 }}>
                  {preset.subtext}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* SECTION: Worked Example against Reference Cake (10" 2 layers) */}
      <div style={{ background: "#F5F0E4", borderRadius: 8, padding: "10px 12px", marginBottom: 10, border: "1px solid var(--border)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: .6 }}>
            Worked Example — 10" 2-layer round
          </span>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--gold)" }}>
            Total: {totalRefGrams} g {batchesText ? `(${batchesText} batches)` : ""}
          </span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, fontSize: 11.5 }}>
          <div style={{ background: "var(--panel)", padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border)" }}>
            <div style={{ color: "var(--muted)", fontSize: 10 }}>Between layers</div>
            <div style={{ fontWeight: 600, marginTop: 1 }}>{betweenLayersG > 0 ? `${betweenLayersG} g` : "—"}</div>
          </div>
          <div style={{ background: "var(--panel)", padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border)" }}>
            <div style={{ color: "var(--muted)", fontSize: 10 }}>Crumb coat</div>
            <div style={{ fontWeight: 600, marginTop: 1 }}>{crumbCoatG > 0 ? `${crumbCoatG} g` : "0 g"}</div>
          </div>
          <div style={{ background: "var(--panel)", padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border)" }}>
            <div style={{ color: "var(--muted)", fontSize: 10 }}>Outside finish</div>
            <div style={{ fontWeight: 600, marginTop: 1 }}>{outsideFinishG} g</div>
          </div>
        </div>
        <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 6, fontStyle: "italic" }}>
          The app uses this to calculate exact grams needed for any cake size in the order calculator.
        </div>
      </div>

      {/* SECTION: Collapsible "See the detail" disclosure */}
      <div style={{ marginBottom: 12 }}>
        <button
          type="button"
          onClick={() => setShowDetail(d => !d)}
          style={{
            background: "none",
            border: "none",
            color: "var(--gold)",
            fontSize: 11.5,
            fontWeight: 600,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: 0,
            marginBottom: 6
          }}
        >
          {showDetail ? "Hide the detail" : "See the detail"} {showDetail ? <ChevronUp size={13}/> : <ChevronDown size={13}/>}
        </button>

        {showDetail && (
          <div style={{ padding: "10px 12px", background: "var(--panel)", borderRadius: 8, border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "grid", gridTemplateColumns: isRolled ? "1fr 1fr" : "1fr 1fr 1fr", gap: 8 }}>
              {!isRolled && (
                <div>
                  <label style={{ fontSize: 10, color: "var(--muted)", display: "block", marginBottom: 3, textTransform: "uppercase" }}>
                    Fill rate (g/in²)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={recipeModal.fill_rate ?? (cov.fill_rate || "")}
                    onChange={e => {
                      const v = e.target.value === "" ? null : parseFloat(e.target.value)
                      setRecipeModal(r => ({ ...r, fill_rate: v }))
                    }}
                    style={{ ...iSt, fontSize: 12, padding: "5px 8px" }}
                  />
                </div>
              )}
              <div>
                <label style={{ fontSize: 10, color: "var(--muted)", display: "block", marginBottom: 3, textTransform: "uppercase" }}>
                  Crumb coat (g/in²)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={recipeModal.crumb_rate ?? (cov.crumb_rate || 0)}
                  onChange={e => {
                    const v = parseFloat(e.target.value) || 0
                    setRecipeModal(r => ({ ...r, crumb_rate: v }))
                  }}
                  style={{ ...iSt, fontSize: 12, padding: "5px 8px" }}
                />
              </div>
              <div>
                <label style={{ fontSize: 10, color: "var(--muted)", display: "block", marginBottom: 3, textTransform: "uppercase" }}>
                  Outside finish (g/in²)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={recipeModal.cover_rate ?? (cov.cover_rate || "")}
                  onChange={e => {
                    const v = e.target.value === "" ? null : parseFloat(e.target.value)
                    setRecipeModal(r => ({ ...r, cover_rate: v }))
                  }}
                  style={{ ...iSt, fontSize: 12, padding: "5px 8px" }}
                />
              </div>
            </div>

            {isRolled && (
              <div style={{ borderTop: "1px dashed var(--border)", paddingTop: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 10, color: "var(--muted)", display: "block", marginBottom: 3, textTransform: "uppercase" }}>
                      Sheet overhang (inches)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={recipeModal.sheet_overhang_in ?? (cov.sheet_overhang_in || 2.4)}
                      onChange={e => {
                        const v = parseFloat(e.target.value) || 0
                        setRecipeModal(r => ({ ...r, sheet_overhang_in: v }))
                      }}
                      style={{ ...iSt, fontSize: 12, padding: "5px 8px" }}
                    />
                  </div>
                  <div style={{ flex: 2, fontSize: 11, color: "var(--muted)", marginTop: 14 }}>
                    Extra draped around the base before trimming (default: 2.4 in).
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* SECTION: Calibration Helper */}
      <div style={{ background: "#F0F4FA", border: "1px solid #D2E0F5", borderRadius: 8, padding: "10px 12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: "#2355A0" }}>
            Calibrate against a cake you've made
          </div>
          {calSuccess && (
            <span style={{ fontSize: 11, color: "#1E6B37", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
              <Check size={12} /> Rates calibrated!
            </span>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.5fr", gap: 8, marginBottom: 8 }}>
          <div>
            <label style={{ fontSize: 9.5, color: "#4A6E9B", display: "block", marginBottom: 3, textTransform: "uppercase" }}>
              Cake size
            </label>
            <select
              value={calSize}
              onChange={e => setCalSize(e.target.value)}
              style={{ ...iSt, fontSize: 12, padding: "5px 8px" }}
            >
              {["6", "7", "8", "9", "10", "12", "14"].map(s => <option key={s} value={s}>{s} inch</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 9.5, color: "#4A6E9B", display: "block", marginBottom: 3, textTransform: "uppercase" }}>
              Layers
            </label>
            <select
              value={calLayers}
              onChange={e => setCalLayers(e.target.value)}
              style={{ ...iSt, fontSize: 12, padding: "5px 8px" }}
            >
              {["1", "2", "3", "4", "5", "6"].map(l => <option key={l} value={l}>{l} layer{+l > 1 ? "s" : ""}</option>)}
            </select>
          </div>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 3 }}>
              <label style={{ fontSize: 9.5, color: "#4A6E9B", textTransform: "uppercase" }}>
                Quantity used
              </label>
              <div style={{ display: "flex", gap: 4 }}>
                <span
                  onClick={() => setCalUnit("grams")}
                  style={{
                    fontSize: 9.5,
                    cursor: "pointer",
                    fontWeight: calUnit === "grams" ? 700 : 400,
                    color: calUnit === "grams" ? "#2355A0" : "#8AA0C4",
                    textDecoration: calUnit === "grams" ? "underline" : "none"
                  }}
                >
                  Grams
                </span>
                <span style={{ fontSize: 9.5, color: "#8AA0C4" }}>|</span>
                <span
                  onClick={() => setCalUnit("batches")}
                  style={{
                    fontSize: 9.5,
                    cursor: "pointer",
                    fontWeight: calUnit === "batches" ? 700 : 400,
                    color: calUnit === "batches" ? "#2355A0" : "#8AA0C4",
                    textDecoration: calUnit === "batches" ? "underline" : "none"
                  }}
                >
                  Batches
                </span>
              </div>
            </div>
            <input
              type="number"
              step="any"
              placeholder={calUnit === "batches" ? "e.g. 0.5" : `e.g. ${Math.round(calBaseline)}`}
              value={calUsed}
              onChange={e => setCalUsed(e.target.value)}
              style={{ ...iSt, fontSize: 12, padding: "5px 8px" }}
            />
          </div>
        </div>

        {/* Live Calibration Feedback */}
        <div style={{ fontSize: 11, color: "#3B5C82", background: "#E5EDF7", padding: "6px 9px", borderRadius: 6, marginBottom: 8, lineHeight: 1.4 }}>
          <div>
            Standard starting amount for a {calSize}" {calLayers}-layer {calShape.toLowerCase()}: <strong>{Math.round(calBaseline)} g</strong>
          </div>
          {rawEntered > 0 && (
            <>
              <div style={{ marginTop: 2 }}>
                You used: <strong>{Math.round(enteredGrams)} g</strong> ({pctDiff >= 0 ? `+${pctDiff}%` : `${pctDiff}%`})
              </div>
              <div style={{ marginTop: 2, fontSize: 10.5, color: "#2355A0" }}>
                Updated rates: {!isRolled && `Between layers ${scaledFill} g/in², `}Crumb coat {scaledCrumb} g/in², Outside finish {scaledCover} g/in²
              </div>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={handleApplyCalibration}
          disabled={!rawEntered || rawEntered <= 0}
          style={{
            background: rawEntered > 0 ? "#2355A0" : "#A2B8D8",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            padding: "5px 12px",
            fontSize: 11.5,
            fontWeight: 600,
            cursor: rawEntered > 0 ? "pointer" : "not-allowed",
            display: "inline-flex",
            alignItems: "center",
            gap: 4
          }}
        >
          <Check size={12} /> Save these rates to this recipe
        </button>
      </div>
    </div>
  )
}

