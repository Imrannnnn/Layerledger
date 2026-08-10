/**
 * OrderCalculator.jsx
 * ----------------------------------------------------------------------------
 * Order Calculator — builds a client quote.
 * Add Item (Cake/Pastry), event type, gift/sample, delivery + VAT.
 * Prices using profit + overhead margins from Settings.
 * ----------------------------------------------------------------------------
 */
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { Btn, iSt, Inp, Sel, Card, SHead, SearchableSelect } from "../common/ui.jsx"
import { fmt, uid, today } from "../../lib/helpers.js"
import { DECORATION_ITEMS, DEFAULT_MULTS, DEFAULT_COVERINGS, PRICING_SIZES } from "../../constants.js"
import { loadCompany, loadLocal, saveLocal, loadQuotes, saveQuotes } from "../../lib/data.js"


export function OrderCalculator({inventory,recipes,settings,setView,company}){
  const getMults=()=>loadLocal("ll_multipliers", DEFAULT_MULTS)
  const mults=getMults()

  const decorations = useMemo(() => {
    const stored = loadLocal("ll_decorations", DECORATION_ITEMS)
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
      const c = (invItem.cat || invItem.category || "").toLowerCase()
      const n = (invItem.name || "").toLowerCase()
      const isDecor = c.includes("decor") || c.includes("topper") || c.includes("ribbon") || c.includes("flower") ||
                      n.includes("decor") || n.includes("topper") || n.includes("ribbon") || n.includes("flower")
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
  }, [inventory])

  const packagingItems = useMemo(() => {
    const pkgInventoryItems = inventory.filter(item => {
      const c = (item.cat || item.category || "").toLowerCase()
      const n = (item.name || "").toLowerCase()
      return c.includes("board") || c.includes("packaging") || c.includes("box") || c.includes("dowel") || c.includes("drum") ||
             n.includes("board") || n.includes("packaging") || n.includes("box") || n.includes("dowel") || n.includes("drum")
    })
    return pkgInventoryItems.map(item => ({
      id: item.id,
      name: item.name,
      price: item.cost,
      unit: item.unit
    }))
  }, [inventory])

  // Accessory types with sizes and prices — in real app these come from settings
  const ACC_TYPES=[
    {name:"Cake board",sizes:['4" — ₦200','6" — ₦300','8" — ₦450','10" — ₦600','12" — ₦800','14" — ₦1,000']},
    {name:"Cake drum",sizes:['6" — ₦500','8" — ₦700','10" — ₦900','12" — ₦1,200','14" — ₦1,500']},
    {name:"Cake box",sizes:['6" — ₦400','8" — ₦600','10" — ₦800','12" — ₦1,000','14" — ₦1,200']},
    {name:"Dowels",sizes:['Per set — ₦300']},
    {name:"Ribbon roll",sizes:['Standard — ₦500']},
  ]
  const COVERING_TYPES=["Buttercream","Fondant","Drip","Ganache","Whipped Cream","Mirror Glaze","Naked"]
  const FILLING_TYPES=["Buttercream","Jam","Ganache","Custard","Cream Cheese","Whipped Cream"]
  const SIZES=["4\"","5\"","6\"","7\"","8\"","9\"","10\"","12\"","14\""]
  const PRODUCT_TYPES=["Cake","Donuts","Cake Loaf","Tarts / Pastry","Cupcakes"]
  const EVENT_TYPES=["Birthday","Wedding","Anniversary","Naming / Christening","Graduation","Corporate / Office","Bridal Shower","Baby Shower","Engagement","Valentine","Mother's Day","Father's Day","Christmas","Easter","Thanksgiving","Get Well","Congratulations","Just Because","Other"]

  const getMult=(size,shape)=>{
    if(!size||!shape)return 0
    const key=`${String(size).replace('"','')}-${shape.toLowerCase()}`
    return mults[key]||1
  }

  // Cost per kg from recipe — looks up recipe by name, calculates total cost
  const recipeCostPerKg=(flavour)=>{
    const r=recipes.find(x=>x.name.toLowerCase().includes(flavour.toLowerCase()))
    if(!r)return 0
    const totalCost=r.ing.reduce((s,ing)=>{const it=inventory.find(x=>x.id===ing.iid);return s+(it?it.cost*ing.qty:0)},0)
    const totalWeight=r.ing.reduce((s,ing)=>s+(ing.unit==="kg"?ing.qty:ing.unit==="g"?ing.qty/1000:0),0)
    if(totalWeight===0)return totalCost // fallback
    return totalCost/totalWeight
  }

  // Layer cost = recipe cost/kg × approx layer weight × size multiplier
  const LAYER_WEIGHT_KG=0.4 // approx 400g per standard layer at 6"
  const layerCost=(flavour,size,shape)=>{
    const r=recipes.find(x=>x.name.toLowerCase().includes(flavour.toLowerCase()))
    if(!r)return 0
    const base=r.ing.reduce((s,ing)=>{const it=inventory.find(x=>x.id===ing.iid);return s+(it?it.cost*ing.qty:0)},0)
    return base*getMult(size,shape)
  }

  // Covering/filling cost = recipe cost/kg × quantity in grams
  // Falls back to standard cost per kg if no recipe found
  const FALLBACK_CPK={"Buttercream":3500,"Fondant":7500,"Drip":4000,"Ganache":5000,"Whipped Cream":3000,"Mirror Glaze":6000,"Jam":2000,"Custard":1800,"Cream Cheese":4500}
  const coverFillCost=(type,grams)=>{
    if(!grams||grams===0)return 0
    // Look for covering/filling recipe first
    const r=recipes.find(x=>(x.type==="covering"||!x.type)&&x.name.toLowerCase().includes(type.toLowerCase()))
    if(r){
      const totalCost=r.ing.reduce((s,ing)=>{const it=inventory.find(x=>x.id===ing.iid);return s+(it?it.cost*ing.qty:0)},0)
      // Use batch weight if set, otherwise derive from ingredients
      const batchGrams=+(r.batchWeight)||r.ing.reduce((s,ing)=>{const it=inventory.find(x=>x.id===ing.iid);return s+(it?.unit==="kg"?ing.qty*1000:it?.unit==="g"?ing.qty:it?.unit==="L"||it?.unit==="l"?ing.qty*1000:0)},0)
      if(batchGrams>0)return (totalCost/batchGrams)*grams
    }
    // Fallback: use standard cost per gram until recipe is added
    const cpk=FALLBACK_CPK[type]||3000
    return (cpk/1000)*grams
  }

  // Separate recipe lists for UI dropdowns
  const layerRecipes=recipes.filter(r=>!r.type||r.type==="layer")
  const coveringRecipes=recipes.filter(r=>r.type==="covering")
  const pastryRecipes=recipes.filter(r=>r.type==="pastry")
  const allRecipes=recipes // all recipes for fallback search
  const allCoveringTypes=[...new Set([...coveringRecipes.map(r=>r.name),...["Buttercream","Fondant","Drip","Ganache","Whipped Cream","Mirror Glaze","Naked"]])]
  const allFillingTypes=[...new Set([...coveringRecipes.map(r=>r.name),...["Buttercream","Jam","Ganache","Custard","Cream Cheese","Whipped Cream"]])]

  const getAccPrice=(type,size)=>{if(!size)return 0;const m=String(size).match(/[₦N$]?([\d,]+)\s*$/);return m?parseInt(m[1].replace(",","")):0}

  // Batch cost — total ingredient cost for one recipe batch
  const batchCost=(recipeName)=>{
    if(!recipeName)return 0
    const r=recipes.find(x=>x.name.toLowerCase()===recipeName.toLowerCase())||recipes.find(x=>x.name.toLowerCase().includes(recipeName.toLowerCase()))
    if(!r)return 0
    return r.ing.reduce((s,ing)=>{const it=inventory.find(x=>x.id===ing.iid);return s+(it?it.cost*ing.qty:0)},0)
  }
  // Cost per piece from a pastry recipe — uses batchSize if set, defaults to 12
  const costPerPiece=(recipeName)=>{
    if(!recipeName)return 0
    const r=recipes.find(x=>x.name.toLowerCase()===recipeName.toLowerCase())||recipes.find(x=>x.name.toLowerCase().includes(recipeName.toLowerCase()))
    if(!r)return 0
    const totalCost=r.ing.reduce((s,ing)=>{const it=inventory.find(x=>x.id===ing.iid);return s+(it?it.cost*ing.qty:0)},0)
    const pieces=r.batchSize||12
    return totalCost/pieces
  }

  let nid=Date.now()
  const uid2=()=>nid++

  // Auto-restore saved calculator state
  const restoreCalc=()=>{
    try{
      // Check if editing an existing quote
      const edit=loadLocal("ll_calc_edit", null)
      if(edit){saveLocal("ll_calc_edit", null);return{...edit,isEdit:true,editId:edit.id}}
      return loadLocal("ll_calc_state", null)
    }catch{return null}
  }
  const saved=useState(()=>restoreCalc())[0]

  const [productType,setProductType]=useState(()=>saved?.productType||"")
  const [showItemPicker,setShowItemPicker]=useState(false)
  const [clientName,setClientName]=useState(()=>saved?.clientName||saved?.clientName||"")
  const [eventType,setEventType]=useState(()=>saved?.eventType||"")
  const [clientPhone,setClientPhone]=useState(()=>saved?.clientPhone||"")
  const [clientNotes,setClientNotes]=useState(()=>saved?.clientNotes||saved?.notes||"")
  const [deliveryDate,setDeliveryDate]=useState(()=>saved?.deliveryDate||"")
  const [collectionTime,setCollectionTime]=useState(()=>saved?.collectionTime||"")
  const [quoteSaved,setQuoteSaved]=useState(false)
  const [isEdit,setIsEdit]=useState(()=>!!saved?.isEdit)
  const [editId,setEditId]=useState(()=>saved?.editId||null)
  const [salePrice,setSalePrice]=useState(()=>saved?.salePrice||"")
  const [cakePhoto,setCakePhoto]=useState(()=>saved?.cakePhoto||null)
  const photoRef=useRef(null)

  // Non-cake product states
  const [isMobile, setIsMobile] = useState(window.innerWidth < 800)
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 800)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const [donutGroups,setDonutGroups]=useState(()=>saved?.donutGroups||[{id:uid2(),flavour:"",qty:12,filling:"",fillingGrams:0}])
  const [loaves,setLoaves]=useState(()=>saved?.loaves||[{id:uid2(),flavour:""}])
  const [tartQty,setTartQty]=useState(()=>saved?.tartQty||12)
  const [tartFillings,setTartFillings]=useState(()=>saved?.tartFillings||[{id:uid2(),type:"",grams:0}])
  const [tartGarnish,setTartGarnish]=useState(()=>saved?.tartGarnish||"")

  // Auto-save calculator state on every change
  const autoSave=(extra={})=>{
    saveLocal("ll_calc_state",{productType,clientName,clientPhone,clientNotes,tiers,accRows,topper,margin,deliveryDate,collectionTime,...extra})
  }
  const [tiers,setTiers]=useState(()=>saved?.tiers?.length>0?saved.tiers:[])
  const [decQty,setDecQty]=useState(()=>saved?.decQty||{})
  const [accRows,setAccRows]=useState(()=>saved?.accRows?.length>0?saved.accRows:[{id:uid2(),itemId:"",name:"",price:0}])
  const [topper,setTopper]=useState(()=>saved?.topper||{enabled:false,make:"",deliver:"",description:""})
  const [margin,setMargin]=useState(()=>saved?.margin||settings.profitPct||40)
  const [orderPurpose,setOrderPurpose]=useState(()=>saved?.orderPurpose||"sale")
  const [deliveryCharge,setDeliveryCharge]=useState(()=>saved?.deliveryCharge||"")
  const [vatEnabled,setVatEnabled]=useState(()=>saved?.vatEnabled||false)
  const [vatRate,setVatRate]=useState(()=>saved?.vatRate||7.5)

  // Tier operations
  const addTier=()=>setTiers(t=>[...t,{id:uid2(),size:"",shape:"",layers:[{id:uid2(),flavour:""}],coverings:[{id:uid2(),type:"Buttercream",grams:0}],fillings:[{id:uid2(),type:"Buttercream",grams:0}]}])
  const removeTier=id=>setTiers(t=>t.filter(x=>x.id!==id))
  const updateTier=(id,key,val)=>setTiers(t=>t.map(x=>x.id===id?{...x,[key]:val}:x))
  const addLayer=tid=>setTiers(t=>t.map(x=>x.id===tid?{...x,layers:[...x.layers,{id:uid2(),flavour:""}]}:x))
  const removeLayer=(tid,lid)=>setTiers(t=>t.map(x=>x.id===tid?{...x,layers:x.layers.filter(l=>l.id!==lid)}:x))
  const updateLayer=(tid,lid,v)=>setTiers(t=>t.map(x=>x.id===tid?{...x,layers:x.layers.map(l=>l.id===lid?{...l,flavour:v}:l)}:x))
  const addFilling=tid=>setTiers(t=>t.map(x=>x.id===tid?{...x,fillings:[...x.fillings,{id:uid2(),type:"Buttercream",grams:200}]}:x))
  const removeFilling=(tid,fid)=>setTiers(t=>t.map(x=>x.id===tid?{...x,fillings:x.fillings.filter(f=>f.id!==fid)}:x))
  const updateFilling=(tid,fid,key,val)=>setTiers(t=>t.map(x=>x.id===tid?{...x,fillings:x.fillings.map(f=>f.id===fid?{...f,[key]:key==="grams"?parseInt(val)||0:val}:f)}:x))
  const addCovering=tid=>setTiers(t=>t.map(x=>x.id===tid?{...x,coverings:[...x.coverings,{id:uid2(),type:"Fondant",grams:500}]}:x))
  const removeCovering=(tid,cid)=>setTiers(t=>t.map(x=>x.id===tid?{...x,coverings:x.coverings.filter(c=>c.id!==cid)}:x))
  const updateCovering=(tid,cid,key,val)=>setTiers(t=>t.map(x=>x.id===tid?{...x,coverings:x.coverings.map(c=>c.id===cid?{...c,[key]:key==="grams"?parseInt(val)||0:val}:c)}:x))

  // Accessory operations
  const addAcc=()=>setAccRows(r=>[...r,{id:uid2(),itemId:"",name:"",price:0}])
  const removeAcc=id=>setAccRows(r=>r.filter(x=>x.id!==id))
  const updateAcc=(id,itemId)=>{
    const pkg=packagingItems.find(p=>p.id===itemId)
    setAccRows(r=>r.map(x=>x.id===id?{...x,itemId,name:pkg?.name||"",price:pkg?.price||0}:x))
  }
  const changeDec=(id,delta)=>setDecQty(q=>{const n={...q};if(delta<=-999){delete n[id];return n}n[id]=(n[id]||0)+delta;if(n[id]<=0)delete n[id];return n})

  // Cost calculations
  const tierCost=tier=>
    tier.layers.reduce((s,l)=>s+(l.flavour?layerCost(l.flavour,tier.size,tier.shape):0),0)+
    tier.coverings.reduce((s,c)=>s+coverFillCost(c.type,c.grams),0)+
    tier.fillings.reduce((s,f)=>s+coverFillCost(f.type,f.grams),0)
  const totalTiers=useMemo(() => tiers.reduce((s,t)=>s+tierCost(t),0), [tiers, inventory, recipes, mults])
  const totalDecs=useMemo(() => decorations.reduce((s,d)=>{const qty=decQty[d.id]||0;const it=inventory.find(x=>x.id===d.iid);return s+(it&&qty?it.cost*d.qty*qty:0)},0), [decorations, decQty, inventory])
  const totalAcc=useMemo(() => accRows.reduce((s,r)=>{
    const pkg=packagingItems.find(p=>p.id===r.itemId)
    return s+(pkg?pkg.price:(r.price||0))
  },0), [accRows, packagingItems])
  const topperCost=(+topper.make||0)+(+topper.deliver||0)

  const donutTotalQty=useMemo(() => donutGroups.reduce((s,g)=>s+(+g.qty||0),0), [donutGroups])
  const donutCost=useMemo(() => donutGroups.reduce((s,g)=>{
    const pieceCost=g.flavour?costPerPiece(g.flavour):0
    return s+(pieceCost*(+g.qty||0))+(g.filling?coverFillCost(g.filling,+g.fillingGrams||0):0)
  },0), [donutGroups, inventory, recipes])
  const loafCost=useMemo(() => loaves.reduce((s,l)=>s+(l.flavour?batchCost(l.flavour):0),0), [loaves, inventory, recipes])
  const tartShellCost=useMemo(() => tartQty>0?(()=>{
    const r=pastryRecipes.find(x=>x.name.toLowerCase().includes("tart"))||recipes.find(x=>x.name.toLowerCase().includes("tart"))
    if(!r)return 0
    const bc=r.ing.reduce((s,ing)=>{const it=inventory.find(x=>x.id===ing.iid);return s+(it?it.cost*ing.qty:0)},0)
    return r.batchSize>0?bc/r.batchSize*tartQty:bc*Math.ceil(tartQty/12)
  })():0, [tartQty, pastryRecipes, recipes, inventory])
  const tartFillCost=useMemo(() => tartFillings.reduce((s,f)=>s+coverFillCost(f.type,+f.grams||0),0), [tartFillings, inventory, recipes])
  const productBaseCost=productType==="Cake"||productType==="Cupcakes"?totalTiers+totalDecs+topperCost
    :productType==="Donuts"?donutCost
    :productType==="Cake Loaf"?loafCost
    :productType==="Tarts / Pastry"?tartShellCost+tartFillCost
    :totalTiers+totalDecs+topperCost

  const subtotal=productBaseCost+totalAcc
  const accessoryPct=settings.accessoryPct||10
  const profitPct=margin
  const overheadPct=settings.overheadPct||27
  const miscPct=settings.miscPct!==undefined?settings.miscPct:5

  const overheadAmount=Math.round(subtotal*(overheadPct/100))
  const accessoryAmount=Math.round(subtotal*(accessoryPct/100))
  const miscAmount=Math.round(subtotal*(miscPct/100))
  const totalCost=Math.round(subtotal+overheadAmount+accessoryAmount+miscAmount)
  const suggestedPrice=Math.round(totalCost/Math.max(0.05,1-profitPct/100))

  const profit=suggestedPrice-totalCost

  const cakePrice=(orderPurpose==="gift"||orderPurpose==="sample")?0:(+salePrice||suggestedPrice)
  const delivCharge=+deliveryCharge||0
  const vatAmount=vatEnabled?Math.round(cakePrice*(vatRate/100)):0
  const grandTotal=cakePrice+delivCharge+vatAmount

  const renderTierCard=(tier,ti)=>{
    const tc=tierCost(tier)
    return <Card key={tier.id} style={{marginBottom:12,borderLeft:"4px solid var(--gold)",padding:14}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <div style={{fontWeight:500,fontSize:13}}>Tier {ti+1}</div>
        {tiers.length>1&&<Btn small variant="danger" onClick={()=>removeTier(tier.id)}>Remove tier</Btn>}
      </div>

      {/* Size + Shape */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
        <div>
          <label style={{fontSize:10,color:"var(--muted)",display:"block",marginBottom:3,textTransform:"uppercase",letterSpacing:.8,fontWeight:500}}>Size</label>
          <select value={tier.size} onChange={e=>updateTier(tier.id,"size",e.target.value)} style={{...iSt}}>
            <option value="">— Select —</option>
            {PRICING_SIZES.map(s=><option key={s} value={s}>{s}"</option>)}
          </select>
        </div>
        <div>
          <label style={{fontSize:10,color:"var(--muted)",display:"block",marginBottom:3,textTransform:"uppercase",letterSpacing:.8,fontWeight:500}}>Shape</label>
          <select value={tier.shape} onChange={e=>updateTier(tier.id,"shape",e.target.value)} style={{...iSt}}>
            <option value="">— Select —</option>
            {["Round","Square","Sheet"].map(s=><option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Layers */}
      <div style={{marginBottom:10}}>
        <label style={{fontSize:10,color:"var(--muted)",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:.8,fontWeight:500}}>Layers — one flavour per layer</label>
        {tier.layers.map((l,li)=><div key={l.id} style={{display:"grid",gridTemplateColumns:"auto 1fr auto auto",gap:6,alignItems:"center",marginBottom:5}}>
          <span style={{fontSize:11.5,color:"var(--muted)",minWidth:52}}>Layer {li+1}</span>
          <select value={l.flavour} onChange={e=>updateLayer(tier.id,l.id,e.target.value)} style={{...iSt}}>
            <option value="">— Select flavour —</option>
            {layerRecipes.map(r=><option key={r.id} value={r.name}>{r.name}</option>)}
          </select>
          <span style={{fontSize:11,color:"var(--gold)",whiteSpace:"nowrap"}}>{l.flavour?fmt(layerCost(l.flavour,tier.size,tier.shape)):""}</span>
          {tier.layers.length>1
            ?<button onClick={()=>removeLayer(tier.id,l.id)} style={{width:22,height:22,padding:0,borderRadius:4,border:"1px solid var(--border)",background:"transparent",cursor:"pointer",fontSize:12,color:"var(--muted)"}}>×</button>
            :<span style={{width:22}}/>}
        </div>)}
        <Btn small variant="ghost" onClick={()=>addLayer(tier.id)}>+ Add layer</Btn>
      </div>

      {/* Fillings */}
      <div style={{marginBottom:10}}>
        <label style={{fontSize:10,color:"var(--muted)",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:.8,fontWeight:500}}>Fillings between layers</label>
        {tier.fillings.map(f=><div key={f.id} style={{display:"grid",gridTemplateColumns:"1fr 1fr auto auto",gap:6,alignItems:"center",marginBottom:5}}>
          <select value={f.type} onChange={e=>updateFilling(tier.id,f.id,"type",e.target.value)} style={{...iSt}}>
            {allFillingTypes.map(x=><option key={x} value={x}>{x}</option>)}
          </select>
          <div style={{display:"flex",alignItems:"center",gap:4}}>
            <input type="number" value={f.grams} onChange={e=>updateFilling(tier.id,f.id,"grams",e.target.value)} style={{...iSt,width:70,textAlign:"right",padding:"6px 6px"}}/>
            <span style={{fontSize:12,color:"var(--muted)"}}>g</span>
          </div>
          <span style={{fontSize:11,color:"var(--gold)",whiteSpace:"nowrap"}}>{fmt(coverFillCost(f.type,f.grams))}</span>
          <button onClick={()=>removeFilling(tier.id,f.id)} style={{width:22,height:22,padding:0,borderRadius:4,border:"1px solid var(--border)",background:"transparent",cursor:"pointer",fontSize:12,color:"var(--muted)"}}>×</button>
        </div>)}
        <Btn small variant="ghost" onClick={()=>addFilling(tier.id)}>+ Add filling</Btn>
      </div>

      {/* Coverings */}
      <div style={{marginBottom:8}}>
        <label style={{fontSize:10,color:"var(--muted)",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:.8,fontWeight:500}}>Coverings</label>
        {tier.coverings.map(c=><div key={c.id} style={{background:"var(--bg)",borderRadius:6,padding:"8px 10px",marginBottom:5}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr auto auto",gap:6,alignItems:"center"}}>
            <select value={c.type} onChange={e=>updateCovering(tier.id,c.id,"type",e.target.value)} style={{...iSt}}>
              {allCoveringTypes.map(x=><option key={x} value={x}>{x}</option>)}
            </select>
            <div style={{display:"flex",alignItems:"center",gap:4}}>
              <input type="number" value={c.grams} onChange={e=>updateCovering(tier.id,c.id,"grams",e.target.value)} style={{...iSt,width:70,textAlign:"right",padding:"6px 6px"}}/>
              <span style={{fontSize:12,color:"var(--muted)"}}>g</span>
            </div>
            <span style={{fontSize:11,color:"var(--gold)",whiteSpace:"nowrap"}}>{fmt(coverFillCost(c.type,c.grams))}</span>
            <button onClick={()=>removeCovering(tier.id,c.id)} style={{width:22,height:22,padding:0,borderRadius:4,border:"1px solid var(--border)",background:"transparent",cursor:"pointer",fontSize:12,color:"var(--muted)"}}>×</button>
          </div>
        </div>)}
        <Btn small variant="ghost" onClick={()=>addCovering(tier.id)}>+ Add covering</Btn>
      </div>

      <div style={{marginTop:8,padding:"6px 10px",background:"#F5F0E4",borderRadius:6,fontSize:12,color:"var(--muted)"}}>
        Tier cost: <strong style={{color:"var(--gold)"}}>{fmt(tc)}</strong>
      </div>
    </Card>
  }

  return <div>
    <SHead title="Order Calculator" sub="Build a cake quote for a client — saved quotes appear in the Quotes page."/>

    {/* CLIENT DETAILS — always visible at top */}
    <Card style={{marginBottom:16,background:"#F5F0E4"}}>
      <div style={{fontFamily:"'Playfair Display',serif",fontSize:14,fontWeight:600,marginBottom:10}}>Client details</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
        <Inp label="Client name *" value={clientName} onChange={v=>{setClientName(v);autoSave({clientName:v})}} placeholder="Mrs Iye Achem"/>
        <Inp label="Phone (WhatsApp)" value={clientPhone} onChange={v=>{setClientPhone(v);autoSave({clientPhone:v})}} placeholder="+234..."/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1.5fr 1fr 1.5fr",gap:8,marginBottom:8}}>
        <Inp label="Delivery / collection date *" type="date" value={deliveryDate} min={today()} onChange={v=>{
          if (v && v < today()) {
            alert("Delivery date cannot be in the past.")
            return
          }
          setDeliveryDate(v);
          autoSave({deliveryDate:v})
        }}/>
        <Inp label="Time of Collection *" type="time" value={collectionTime} onChange={v=>{
          setCollectionTime(v);
          autoSave({collectionTime:v})
        }}/>
        <Sel label="Event" value={eventType} onChange={v=>{setEventType(v);autoSave({eventType:v})}} options={[{value:"",label:"— Select event —"},...EVENT_TYPES.map(e=>({value:e,label:e}))]}/>
      </div>
      <Inp label="Notes / special requests" value={clientNotes} onChange={v=>{setClientNotes(v);autoSave({clientNotes:v})}} placeholder="Colour theme, flavour preferences, delivery instructions..."/>
    </Card>

    {/* PHOTO UPLOAD */}
    <Card style={{marginBottom:16}}>
      <div style={{fontFamily:"'Playfair Display',serif",fontSize:14,fontWeight:600,marginBottom:10}}>📸 Design photo <span style={{fontSize:11,color:"var(--muted)",fontWeight:400}}>(client's inspiration or approved design)</span></div>
      <input ref={photoRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>{
        const file=e.target.files[0]
        if(!file)return
        const reader=new FileReader()
        reader.onload=ev=>{
          const dataUrl=ev.target.result
          setCakePhoto(dataUrl)
          const state = loadLocal("ll_calc_state", {})
          saveLocal("ll_calc_state", { ...state, cakePhoto: dataUrl })
        }
        reader.readAsDataURL(file)
      }}/>
      {cakePhoto
        ?<div style={{position:"relative",display:"inline-block"}}>
          <img src={cakePhoto} alt="Cake design" style={{maxWidth:"100%",maxHeight:220,borderRadius:8,display:"block"}}/>
          <button onClick={()=>{setCakePhoto(null);if(photoRef.current)photoRef.current.value=""}} style={{position:"absolute",top:6,right:6,background:"rgba(0,0,0,0.6)",color:"#fff",border:"none",borderRadius:20,padding:"3px 10px",cursor:"pointer",fontSize:12}}>✕ Remove</button>
        </div>
        :<div onClick={()=>photoRef.current?.click()} style={{border:"2px dashed var(--border)",borderRadius:10,padding:28,textAlign:"center",cursor:"pointer",background:"var(--bg)"}}>
          <div style={{fontSize:28,marginBottom:6}}>📷</div>
          <div style={{fontSize:13,color:"var(--muted)"}}>Tap to upload design photo</div>
          <div style={{fontSize:11,color:"var(--muted)",marginTop:4}}>JPG, PNG — stored on this device</div>
        </div>}
    </Card>

    <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1.3fr 0.7fr",gap:18}}>
      <div>
        {/* Add Item — choose Cake or Pastry */}
        {!productType&&<div style={{marginBottom:14}}>
          {!showItemPicker
            ?<Btn onClick={()=>setShowItemPicker(true)} style={{width:"100%",borderStyle:"dashed"}} variant="ghost">+ Add Item</Btn>
            :<Card style={{background:"#FFF9EE",borderColor:"var(--gold)"}}>
              <div style={{fontSize:13,fontWeight:600,marginBottom:10,textAlign:"center"}}>What are you adding?</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <button onClick={()=>{setProductType("Cake");setShowItemPicker(false);if(tiers.length===0)setTiers([{id:uid2(),size:"",shape:"",layers:[{id:uid2(),flavour:""}],coverings:[{id:uid2(),type:"Buttercream",grams:0}],fillings:[{id:uid2(),type:"Buttercream",grams:0}]}])}} style={{padding:"18px 12px",borderRadius:10,border:"1.5px solid var(--gold)",background:"var(--panel)",cursor:"pointer",fontFamily:"inherit"}}>
                  <div style={{fontSize:26,marginBottom:6}}>🎂</div>
                  <div style={{fontSize:14,fontWeight:600,color:"var(--gold)"}}>Cake</div>
                  <div style={{fontSize:11,color:"var(--muted)",marginTop:2}}>Layers, tiers, fillings</div>
                </button>
                <button onClick={()=>{setProductType("Tarts / Pastry");setShowItemPicker(false)}} style={{padding:"18px 12px",borderRadius:10,border:"1.5px solid var(--gold)",background:"var(--panel)",cursor:"pointer",fontFamily:"inherit"}}>
                  <div style={{fontSize:26,marginBottom:6}}>🧁</div>
                  <div style={{fontSize:14,fontWeight:600,color:"var(--gold)"}}>Pastry</div>
                  <div style={{fontSize:11,color:"var(--muted)",marginTop:2}}>Loaves, donuts, tarts</div>
                </button>
              </div>
              <div style={{textAlign:"center",marginTop:10}}><button onClick={()=>setShowItemPicker(false)} style={{background:"none",border:"none",color:"var(--muted)",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>Cancel</button></div>
            </Card>}
        </div>}

        {/* Product type sub-selector (once an item type chosen) */}
        {productType&&<div style={{marginBottom:14,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
          <label style={{fontSize:10,color:"var(--muted)",textTransform:"uppercase",letterSpacing:.8,fontWeight:500}}>Item type</label>
          <select value={productType} onChange={e=>setProductType(e.target.value)} style={{...iSt,maxWidth:200,marginTop:0}}>
            {PRODUCT_TYPES.map(p=><option key={p} value={p}>{p}</option>)}
          </select>
          <button onClick={()=>{setProductType("");setTiers([]);setShowItemPicker(false)}} style={{background:"none",border:"1px solid var(--border)",borderRadius:7,padding:"6px 12px",color:"var(--muted)",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>✕ Clear item</button>
        </div>}

        {/* CAKE / CUPCAKES — Tiers */}
        {(productType==="Cake"||productType==="Cupcakes")&&<>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:14,fontWeight:600,marginBottom:10}}>{productType==="Cupcakes"?"Cupcake tiers":"Cake tiers"}</div>
          {tiers.map((tier,ti)=>renderTierCard(tier,ti))}
          <Btn variant="ghost" onClick={addTier} style={{width:"100%",marginBottom:18,borderStyle:"dashed"}}>+ Add tier</Btn>
          {/* Decorations */}
          <div style={{marginBottom:18}}>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:14,fontWeight:600,marginBottom:10}}>Decoration extras</div>
            {Object.keys(decQty).map(did=>{
              const d=decorations.find(x=>x.id===did)
              if(!d)return null
              const it=inventory.find(x=>x.id===d.iid)
              const unitCost=it?it.cost*d.qty:0
              const qty=decQty[did]||1
              return <div key={did} style={{display:"grid",gridTemplateColumns:"1fr auto auto auto",gap:8,alignItems:"center",marginBottom:8}}>
                <div style={{fontSize:13,color:"var(--text)",fontWeight:500}}>{d.label||d.name}</div>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <span style={{fontSize:11,color:"var(--muted)"}}>Qty:</span>
                  <button onClick={()=>changeDec(did,-1)} style={{width:22,height:22,padding:0,fontSize:14,borderRadius:4,border:"1px solid var(--border)",background:"var(--panel)",cursor:"pointer"}}>-</button>
                  <span style={{fontSize:13,fontWeight:500,minWidth:18,textAlign:"center"}}>{qty}</span>
                  <button onClick={()=>changeDec(did,1)} style={{width:22,height:22,padding:0,fontSize:14,borderRadius:4,border:"1px solid var(--border)",background:"var(--panel)",cursor:"pointer"}}>+</button>
                </div>
                <span style={{fontSize:12,color:"var(--gold)",fontWeight:500,whiteSpace:"nowrap"}}>{fmt(unitCost*qty)}</span>
                <button onClick={()=>changeDec(did,-999)} style={{width:24,height:24,padding:0,borderRadius:4,border:"1px solid var(--border)",background:"transparent",cursor:"pointer",fontSize:13,color:"var(--muted)"}}>×</button>
              </div>
            })}
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <SearchableSelect
                value=""
                onChange={val => {
                  if (val) changeDec(val, 1)
                }}
                options={decorations.filter(d => !decQty[d.id]).map(d => {
                  const it = inventory.find(x => x.id === d.iid)
                  return {
                    value: d.id,
                    label: `${d.label || d.name}${it ? ` — ${fmt(it.cost * d.qty)} per set` : ""}`
                  }
                })}
                placeholder="+ Add decoration extra (type to search)..."
              />
            </div>
          </div>
          {/* Custom Topper */}
          <div style={{marginBottom:18}}>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:14,fontWeight:600,marginBottom:10}}>Custom topper</div>
            <Card>
              <label style={{display:"flex",alignItems:"center",gap:8,fontSize:13,cursor:"pointer",marginBottom:topper.enabled?12:0}}>
                <input type="checkbox" checked={topper.enabled} onChange={e=>setTopper(t=>({...t,enabled:e.target.checked}))}/>
                This order has a custom topper
              </label>
              {topper.enabled&&<>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
                  <Inp label="Making cost (₦)" type="number" value={topper.make} onChange={v=>setTopper(t=>({...t,make:v}))} placeholder="5000"/>
                  <Inp label="Delivery to shop (₦)" type="number" value={topper.deliver} onChange={v=>setTopper(t=>({...t,deliver:v}))} placeholder="1500"/>
                </div>
                <div>
                  <label style={{fontSize:10,color:"var(--muted)",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:.8,fontWeight:500}}>Topper description</label>
                  <textarea value={topper.description} onChange={e=>setTopper(t=>({...t,description:e.target.value}))} placeholder="e.g. Gold acrylic Mr & Mrs topper..." style={{...iSt,height:70,resize:"vertical",fontFamily:"inherit"}}/>
                </div>
              </>}
            </Card>
          </div>
        </>}

        {/* DONUTS */}
        {productType==="Donuts"&&<>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:14,fontWeight:600,marginBottom:10}}>Donut groups — total: {donutTotalQty} donuts</div>
          {pastryRecipes.length===0&&<div style={{fontSize:12.5,color:"#8C5E00",background:"#FFF3CD",padding:"8px 12px",borderRadius:7,marginBottom:12,border:"1px solid #F0D080"}}>⚠️ No pastry recipes found. Go to <strong>Master List → Base Recipes → Pastry/Batch</strong> to add your donut recipe first.</div>}
          {donutGroups.map((g,gi)=><Card key={g.id} style={{marginBottom:10,borderLeft:"4px solid var(--gold)",padding:14}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <div style={{fontWeight:500,fontSize:13}}>Group {gi+1}</div>
              {donutGroups.length>1&&<button onClick={()=>setDonutGroups(dg=>dg.filter(x=>x.id!==g.id))} style={{background:"#B03A2E",color:"#fff",border:"none",borderRadius:6,padding:"3px 10px",cursor:"pointer",fontSize:12}}>Remove</button>}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
              <div>
                <label style={{fontSize:10,color:"var(--muted)",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:.8,fontWeight:500}}>Base donut recipe</label>
                <select value={g.flavour} onChange={e=>setDonutGroups(dg=>dg.map(x=>x.id===g.id?{...x,flavour:e.target.value}:x))} style={{...iSt}}>
                  <option value="">— Select recipe —</option>
                  {(pastryRecipes.length>0?pastryRecipes:allRecipes).map(r=><option key={r.id} value={r.name}>{r.name} {batchCost(r.name)>0?"— "+fmt(r.batchSize>0?batchCost(r.name)/r.batchSize:batchCost(r.name))+(r.batchSize>0?" /pc":" /batch"):""}</option>)}
                </select>
              </div>
              <div>
                <label style={{fontSize:10,color:"var(--muted)",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:.8,fontWeight:500}}>Quantity (donuts)</label>
                <input type="number" min="1" value={g.qty} onChange={e=>setDonutGroups(dg=>dg.map(x=>x.id===g.id?{...x,qty:+e.target.value||0}:x))} style={{...iSt}}/>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              <div>
                <label style={{fontSize:10,color:"var(--muted)",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:.8,fontWeight:500}}>Filling (optional)</label>
                <select value={g.filling} onChange={e=>setDonutGroups(dg=>dg.map(x=>x.id===g.id?{...x,filling:e.target.value}:x))} style={{...iSt}}>
                  <option value="">— No filling —</option>
                  {["Chocolate","Jam","Pastry Cream","Lemon Curd","Custard","Nutella",...allFillingTypes].filter((v,i,a)=>a.indexOf(v)===i).map(f=><option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <Inp label="Filling amount (g)" type="number" value={g.fillingGrams} onChange={v=>setDonutGroups(dg=>dg.map(x=>x.id===g.id?{...x,fillingGrams:+v||0}:x))} placeholder="e.g. 200"/>
            </div>
            {g.flavour&&<div style={{marginTop:8,fontSize:12,color:"var(--gold)",fontWeight:500}}>
              Cost: {fmt(batchCost(g.flavour)*Math.ceil((g.qty||0)/12)+(g.filling?coverFillCost(g.filling,g.fillingGrams||0):0))} — {Math.ceil((g.qty||0)/12)} batch{Math.ceil((g.qty||0)/12)>1?"es":""}
            </div>}
          </Card>)}
          <Btn variant="ghost" onClick={()=>setDonutGroups(dg=>[...dg,{id:uid2(),flavour:"",qty:12,filling:"",fillingGrams:0}])} style={{width:"100%",marginBottom:18,borderStyle:"dashed"}}>+ Add donut group</Btn>
        </>}

        {/* CAKE LOAF */}
        {productType==="Cake Loaf"&&<>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:14,fontWeight:600,marginBottom:10}}>Loaves — {loaves.length} loaf{loaves.length>1?"es":""}</div>
          {loaves.map((l,li)=><div key={l.id} style={{display:"grid",gridTemplateColumns:"auto 1fr auto auto",gap:8,alignItems:"center",marginBottom:8}}>
            <span style={{fontSize:12,color:"var(--muted)",minWidth:52}}>Loaf {li+1}</span>
            <select value={l.flavour} onChange={e=>setLoaves(lv=>lv.map(x=>x.id===l.id?{...x,flavour:e.target.value}:x))} style={{...iSt}}>
              <option value="">— Select flavour —</option>
              {(pastryRecipes.length>0?pastryRecipes:allRecipes).map(r=><option key={r.id} value={r.name}>{r.name}</option>)}
            </select>
            <span style={{fontSize:12,color:"var(--gold)",fontWeight:500,whiteSpace:"nowrap"}}>{l.flavour?fmt(batchCost(l.flavour)):""}</span>
            {loaves.length>1&&<button onClick={()=>setLoaves(lv=>lv.filter(x=>x.id!==l.id))} style={{width:24,height:24,padding:0,borderRadius:4,border:"1px solid var(--border)",background:"transparent",cursor:"pointer",fontSize:13,color:"var(--muted)"}}>×</button>}
          </div>)}
          <Btn variant="ghost" onClick={()=>setLoaves(lv=>[...lv,{id:uid2(),flavour:""}])} style={{width:"100%",marginBottom:18,borderStyle:"dashed"}}>+ Add loaf</Btn>
        </>}

        {/* TARTS / PASTRY */}
        {productType==="Tarts / Pastry"&&<>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:14,fontWeight:600,marginBottom:10}}>Tarts & Pastry</div>
          <Card style={{marginBottom:12}}>
            <div style={{fontWeight:500,fontSize:13,marginBottom:10}}>Shells</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              <Inp label="Number of shells" type="number" value={tartQty} onChange={v=>setTartQty(+v||0)} placeholder="e.g. 120"/>
              <div style={{fontSize:12,color:"var(--muted)",paddingTop:22}}>= {Math.ceil(tartQty/12)} batch{Math.ceil(tartQty/12)>1?"es":""} of 12 · {fmt(tartShellCost)}</div>
            </div>
            <div style={{fontSize:11.5,color:"var(--muted)",marginTop:4}}>Tip: Add a "Tart Shell" or "Pastry Shell" recipe in Master List to get accurate costs.</div>
          </Card>
          <Card style={{marginBottom:12}}>
            <div style={{fontWeight:500,fontSize:13,marginBottom:10}}>Fillings & creams</div>
            {tartFillings.map((f,fi)=><div key={f.id} style={{display:"grid",gridTemplateColumns:"1fr 1fr auto",gap:8,alignItems:"center",marginBottom:8}}>
              <select value={f.type} onChange={e=>setTartFillings(tf=>tf.map(x=>x.id===f.id?{...x,type:e.target.value}:x))} style={{...iSt}}>
                <option value="">— Select filling —</option>
                {["Lemon Curd","Chantilly Cream","Pastry Cream","Custard","Jam","Ganache","Nutella",...allFillingTypes].filter((v,i,a)=>a.indexOf(v)===i).map(t=><option key={t} value={t}>{t}</option>)}
              </select>
              <div style={{display:"flex",gap:6,alignItems:"center"}}>
                <input type="number" value={f.grams} onChange={e=>setTartFillings(tf=>tf.map(x=>x.id===f.id?{...x,grams:+e.target.value||0}:x))} placeholder="grams" style={{...iSt,flex:1}}/>
                <span style={{fontSize:11,color:"var(--muted)",whiteSpace:"nowrap"}}>g · {fmt(coverFillCost(f.type,+f.grams||0))}</span>
              </div>
              {tartFillings.length>1&&<button onClick={()=>setTartFillings(tf=>tf.filter(x=>x.id!==f.id))} style={{width:24,height:24,padding:0,borderRadius:4,border:"1px solid var(--border)",background:"transparent",cursor:"pointer",fontSize:13,color:"var(--muted)"}}>×</button>}
            </div>)}
            <Btn variant="ghost" small onClick={()=>setTartFillings(tf=>[...tf,{id:uid2(),type:"",grams:0}])}>+ Add filling</Btn>
          </Card>
          <Card style={{marginBottom:18}}>
            <Inp label="Garnish / topping notes" value={tartGarnish} onChange={setTartGarnish} placeholder="e.g. Fresh berries, powdered sugar, edible flowers..."/>
          </Card>
        </>}

        {/* Boards & Accessories — shared across all product types */}
        <div style={{marginBottom:18}}>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:14,fontWeight:600,marginBottom:10}}>Boards & packaging</div>
          {accRows.map(row=>{
            const pkg=packagingItems.find(p=>p.id===row.itemId)
            const currentPrice = pkg?pkg.price:(row.price||0)
            return <div key={row.id} style={{display:"grid",gridTemplateColumns:"1fr auto auto",gap:8,alignItems:"center",marginBottom:8}}>
            <SearchableSelect
              value={row.itemId||""}
              onChange={val => updateAcc(row.id, val)}
              options={packagingItems.map(p => ({
                value: p.id,
                label: `${p.name} — ${fmt(p.price)}`
              }))}
              placeholder="— Select item (type to search) —"
            />
            <span style={{fontSize:12,color:"var(--gold)",fontWeight:500,whiteSpace:"nowrap",minWidth:52,textAlign:"right"}}>{currentPrice?fmt(currentPrice):""}</span>
            <button onClick={()=>removeAcc(row.id)} style={{width:28,height:28,padding:0,borderRadius:6,border:"1px solid var(--border)",background:"transparent",cursor:"pointer",fontSize:14,color:"var(--muted)"}}>×</button>
          </div>
          })}
          <Btn variant="ghost" onClick={addAcc}>+ Add board/packaging item</Btn>
        </div>
      </div>
      <div>
        <Card style={{position:"sticky",top:16}}>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:14,fontWeight:600,marginBottom:12}}>Quote summary</div>

          {tiers.map((tier,ti)=><div key={tier.id} style={{background:"#F5F0E4",borderRadius:8,padding:"8px 10px",marginBottom:8,fontSize:12}}>
            <div style={{fontWeight:500,marginBottom:4}}>Tier {ti+1}: {tier.size} {tier.shape}</div>
            {tier.layers.map((l,li)=>l.flavour?<div key={l.id} style={{color:"var(--muted)"}}>L{li+1}: {l.flavour} {fmt(layerCost(l.flavour,tier.size,tier.shape))}</div>:null)}
            {tier.fillings.map(f=><div key={f.id} style={{color:"var(--muted)"}}>Fill: {f.type} {f.grams}g {fmt(coverFillCost(f.type,f.grams))}</div>)}
            {tier.coverings.map(c=><div key={c.id} style={{color:"var(--muted)"}}>Cover: {c.type} {c.grams}g {fmt(coverFillCost(c.type,c.grams))}</div>)}
          </div>)}

          <div style={{borderTop:"1px solid var(--border)",paddingTop:8,marginBottom:12}}>
            {(productType==="Cake"||productType==="Cupcakes")&&[
              ["Layers",tiers.reduce((s,t)=>s+t.layers.reduce((s2,l)=>s2+(l.flavour?layerCost(l.flavour,t.size,t.shape):0),0),0)],
              ["Fillings",tiers.reduce((s,t)=>s+t.fillings.reduce((s2,f)=>s2+coverFillCost(f.type,f.grams),0),0)],
              ["Coverings",tiers.reduce((s,t)=>s+t.coverings.reduce((s2,c)=>s2+coverFillCost(c.type,c.grams),0),0)],
              ["Decorations",totalDecs],
              ["Custom topper",topperCost],
            ].filter(([,v])=>v>0).map(([l,v])=><div key={l} style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"var(--muted)",marginBottom:3}}><span>{l}</span><span>{fmt(v)}</span></div>)}
            {productType==="Donuts"&&donutGroups.map((g,i)=>g.flavour&&<div key={g.id} style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"var(--muted)",marginBottom:3}}><span>Group {i+1}: {g.qty} donuts ({g.filling||"plain"})</span><span>{fmt(batchCost(g.flavour)*Math.ceil((g.qty||0)/12)+(g.filling?coverFillCost(g.filling,g.fillingGrams||0):0))}</span></div>)}
            {productType==="Cake Loaf"&&loaves.map((l,i)=>l.flavour&&<div key={l.id} style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"var(--muted)",marginBottom:3}}><span>Loaf {i+1}: {l.flavour}</span><span>{fmt(batchCost(l.flavour))}</span></div>)}
            {productType==="Tarts / Pastry"&&<>
              {tartQty>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"var(--muted)",marginBottom:3}}><span>{tartQty} shells ({Math.ceil(tartQty/12)} batch{Math.ceil(tartQty/12)>1?"es":""})</span><span>{fmt(tartShellCost)}</span></div>}
              {tartFillings.filter(f=>f.type&&f.grams>0).map(f=><div key={f.id} style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"var(--muted)",marginBottom:3}}><span>{f.type} {f.grams}g</span><span>{fmt(coverFillCost(f.type,f.grams))}</span></div>)}
            </>}
            {totalAcc>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"var(--muted)",marginBottom:3}}><span>Boards & accessories</span><span>{fmt(totalAcc)}</span></div>}
            {(productType==="Cake"||productType==="Cupcakes")&&<div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"var(--muted)",marginBottom:3}}><span>Accessory {accessoryPct}%</span><span>{fmt(accessoryAmount)}</span></div>}
            <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"var(--muted)",marginBottom:3}}><span>Overhead {overheadPct}%</span><span>{fmt(overheadAmount)}</span></div>
            {miscAmount>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"var(--muted)",marginBottom:3}}><span>Miscellaneous {miscPct}%</span><span>{fmt(miscAmount)}</span></div>}
            <div style={{display:"flex",justifyContent:"space-between",fontWeight:600,fontSize:13,paddingTop:6,borderTop:"1px solid var(--border)",marginTop:4}}>

              <span>Total cost</span><span>{fmt(totalCost)}</span>
            </div>
          </div>

          <div style={{marginBottom:14}}>
            <label style={{fontSize:10,color:"var(--muted)",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:.8}}>Profit margin</label>
            <input type="range" min={10} max={80} value={margin} onChange={e=>setMargin(+e.target.value)} style={{width:"100%",accentColor:"var(--gold)",marginBottom:4}}/>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"var(--muted)"}}>
              <span>10%</span><span style={{color:"var(--gold)",fontWeight:600}}>{margin}%</span><span>80%</span>
            </div>
          </div>

          <div style={{background:suggestedPrice>0?"#E8F5EE":"#F5F0E4",border:`1px solid ${suggestedPrice>0?"#C2E0CF":"var(--border)"}`,borderRadius:10,padding:"12px 14px",textAlign:"center",marginBottom:10}}>
            <div style={{fontSize:10,color:"var(--muted)",textTransform:"uppercase",letterSpacing:.8,marginBottom:4}}>Suggested price</div>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:26,fontWeight:700,color:"var(--gold)"}}>{fmt(suggestedPrice)}</div>
            <div style={{fontSize:11,color:"var(--muted)",marginTop:3}}>Profit: {fmt(profit)} ({margin}% profit)</div>
          </div>
          {/* Order purpose */}
          <div style={{margin:"4px 0 14px"}}>
            <label style={{fontSize:10,color:"var(--muted)",display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:.8,fontWeight:500}}>Order Purpose</label>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:5}}>
              {[["sale","Sale"],["gift","Gift"],["sample","Sample"]].map(([v,l])=>
                <button key={v} onClick={()=>setOrderPurpose(v)} style={{padding:"8px 4px",borderRadius:7,border:orderPurpose===v?"2px solid var(--gold)":"1px solid var(--border)",background:orderPurpose===v?"#FEF9EE":"var(--panel)",color:orderPurpose===v?"var(--gold)":"var(--muted)",fontSize:12,fontWeight:orderPurpose===v?600:400,cursor:"pointer",fontFamily:"inherit"}}>{l}</button>
              )}
            </div>
            {(orderPurpose==="gift"||orderPurpose==="sample")&&<div style={{background:"#F0EAFC",borderRadius:8,padding:"8px 10px",marginTop:8,fontSize:11.5,color:"#6B32A0",lineHeight:1.6}}>
              {orderPurpose==="gift"?"🎁 Gift":"🧪 Sample/Tasting"} — no revenue recorded, but ingredients ({fmt(totalCost)}) will be deducted from inventory and logged as a {orderPurpose} cost. This keeps your stock accurate.
            </div>}
          </div>

          {orderPurpose==="sale"&&<div style={{marginBottom:14}}>
            <label style={{fontSize:10,color:"var(--muted)",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:.8,fontWeight:500}}>Actual sale price (₦) — what you charge the client</label>
            <input type="number" value={salePrice} onChange={e=>setSalePrice(e.target.value)} placeholder={"e.g. "+suggestedPrice} style={{...iSt,fontSize:18,fontWeight:600,color:"var(--gold)",textAlign:"center"}}/>
            {salePrice&&+salePrice!==suggestedPrice&&<div style={{fontSize:11,color:+salePrice>suggestedPrice?"#357A52":"#B03A2E",marginTop:3,textAlign:"center"}}>{+salePrice>suggestedPrice?"▲ Above suggested":"▼ Below suggested"} by {fmt(Math.abs(+salePrice-suggestedPrice))}</div>}
          </div>}

          {/* Delivery + VAT */}
          <div style={{borderTop:"1px solid var(--border)",paddingTop:12,marginBottom:14}}>
            <div style={{marginBottom:10}}>
              <label style={{fontSize:10,color:"var(--muted)",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:.8,fontWeight:500}}>Delivery Charge (₦) — paid by client</label>
              <input type="number" value={deliveryCharge} onChange={e=>setDeliveryCharge(e.target.value)} placeholder="0" style={{...iSt}}/>
              <div style={{fontSize:10.5,color:"var(--muted)",marginTop:3}}>Pass-through — collected from client, paid to dispatch. Not counted as your income.</div>
            </div>
            <label style={{display:"flex",alignItems:"center",gap:8,fontSize:12.5,cursor:"pointer"}}>
              <input type="checkbox" checked={vatEnabled} onChange={e=>setVatEnabled(e.target.checked)}/>
              Add VAT
              {vatEnabled&&<input type="number" value={vatRate} onChange={e=>setVatRate(+e.target.value||0)} style={{width:54,padding:"4px 6px",border:"1px solid var(--border)",borderRadius:5,fontSize:12,fontFamily:"inherit",textAlign:"center"}}/>}
              {vatEnabled&&<span style={{fontSize:12,color:"var(--muted)"}}>%</span>}
            </label>
          </div>

          {orderPurpose==="sale"&&(delivCharge>0||vatAmount>0)&&<div style={{background:"#FEF9EE",border:"1px solid var(--gold)",borderRadius:10,padding:"12px 14px",marginBottom:14}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:12.5,marginBottom:4}}><span style={{color:"var(--muted)"}}>Cake price</span><span>{fmt(cakePrice)}</span></div>
            {delivCharge>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:12.5,marginBottom:4}}><span style={{color:"var(--muted)"}}>Delivery</span><span>{fmt(delivCharge)}</span></div>}
            {vatAmount>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:12.5,marginBottom:4}}><span style={{color:"var(--muted)"}}>VAT ({vatRate}%)</span><span>{fmt(vatAmount)}</span></div>}
            <div style={{display:"flex",justifyContent:"space-between",fontWeight:700,fontSize:16,paddingTop:6,borderTop:"1px solid var(--border)",marginTop:4,color:"var(--gold)"}}><span>Client Pays</span><span>{fmt(grandTotal)}</span></div>
          </div>}

          <Btn full onClick={()=>{
            const isGS=orderPurpose==="gift"||orderPurpose==="sample"
            if(!isGS&&!clientName.trim()){alert("Please enter a client name at the top of the page");return}
            if(!productType){alert("Please add an item first — tap '+ Add Item' and choose Cake or Pastry");return}
            if((productType==="Cake"||productType==="Cupcakes")&&!tiers.some(t=>t.size&&t.shape&&t.layers.some(l=>l.flavour))){alert("Please complete at least one cake tier (size, shape and flavour)");return}
            // Generate summaries based on product type
            let flavourSummary=""
            let cakeSummary=""
            if(productType==="Cake"||productType==="Cupcakes"){
              flavourSummary=tiers.flatMap(t=>t.layers.map(l=>l.flavour)).filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).join(", ")
              cakeSummary=tiers.map((t,i)=>`${t.size}" ${t.shape} (${t.layers.map(l=>l.flavour||"?").join("/")})`).join(" + ")
            } else if(productType==="Donuts"){
              flavourSummary=donutGroups.map(g=>g.flavour||"?").filter((v,i,a)=>a.indexOf(v)===i).join(", ")
              cakeSummary=donutGroups.map(g=>`${g.qty} ${g.flavour||"?"} donuts${g.filling?" ("+g.filling+" filling)":""}`).join(", ")
            } else if(productType==="Cake Loaf"){
              flavourSummary=loaves.map(l=>l.flavour||"?").filter((v,i,a)=>a.indexOf(v)===i).join(", ")
              cakeSummary=loaves.length+" loaf"+( loaves.length>1?"ves":"")+" ("+loaves.map(l=>l.flavour||"?").join(", ")+")"
            } else if(productType==="Tarts / Pastry"){
              flavourSummary=tartFillings.filter(f=>f.type).map(f=>f.type).join(", ")
              cakeSummary=tartQty+" tart shells"+( tartFillings.filter(f=>f.type).length?" — "+tartFillings.filter(f=>f.type).map(f=>f.type).join(", "):"")
            }
            const co=loadCompany()
            const quote={
              id:uid(),
              clientName:clientName.trim()||(orderPurpose==="gift"?"Gift":orderPurpose==="sample"?"Sample/Tasting":"Walk-in"),
              clientPhone,
              date:new Date().toISOString().slice(0,10),
              productType:isGS?orderPurpose:productType,tiers,accRows,topper,decQty,
              donutGroups,loaves,tartQty,tartFillings,tartGarnish,
              cakePhoto:cakePhoto||null,
              totalCost,quotePrice:suggestedPrice,
              salePrice:isGS?0:(+salePrice||suggestedPrice),
              orderPurpose,
              deliveryCharge:delivCharge,vatEnabled,vatRate,vatAmount,grandTotal,
              margin,
              cakeSummary,flavourSummary,
              notes:clientNotes,
              deliveryDate:deliveryDate||(isGS?new Date().toISOString().slice(0,10):""),
              collectionTime,
              eventType,
              status:"pending",
              bankName:co.bankName||"",
              bankAccount:co.bankAccount||"",
              bankAccountName:co.bankAccountName||"",
              businessName:co.name||"Bakery",
            }
            const existing=loadQuotes()
            const updated=isEdit&&editId
              ?existing.map(q=>q.id===editId?{...quote,id:editId,status:q.status}:q)
              :[quote,...existing]
            saveQuotes(updated)
            localStorage.removeItem("ll_calc_state")
            setQuoteSaved(true)
          }}>{isEdit?"💬 Update quote":"💬 Generate & save quote"}</Btn>
          {quoteSaved
            ?<div style={{marginTop:10,background:"#E1F5EE",borderRadius:8,padding:"10px 12px"}}>
              <div style={{fontSize:13,fontWeight:500,color:"#085041",marginBottom:8}}>✓ Quote saved for {clientName}!</div>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                <button onClick={()=>{
                  const phone=clientPhone.replace(/[^0-9]/g,"").replace(/^0/,"234")
                  const tierText=tiers.map((t,i)=>`Tier ${i+1}: ${t.size}" ${t.shape} - ${t.layers.map(l=>l.flavour||"?").join("/")}${t.coverings?.length?" - Covering: "+t.coverings.map(c=>c.type).join(", "):"" }`).join("\n")
                  const msg="Hello "+clientName+"! Cake quote:\n\n"+tierText+"\n\nQuote price: N"+suggestedPrice.toLocaleString()+"\n\n"+(clientNotes||"")+"\n\nPlease confirm to proceed. Deposit required. Thank you for choosing "+(co.name||"our bakery")+"!"
                  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`,"_blank")
                }} style={{padding:"7px",borderRadius:8,border:"none",background:"#25D366",color:"#fff",cursor:"pointer",fontSize:12.5,fontFamily:"inherit",fontWeight:500}}>📱 Send quote via WhatsApp</button>

                <button onClick={()=>setView("quotes")} style={{padding:"7px",borderRadius:8,border:"none",background:"var(--gold)",color:"#fff",cursor:"pointer",fontSize:12.5,fontFamily:"inherit"}}>📋 View all quotes</button>
                <button onClick={()=>{setQuoteSaved(false);setIsEdit(false);setEditId(null);setClientName("");setClientPhone("");setClientNotes("");localStorage.removeItem("ll_calc_state")}} style={{padding:"7px",borderRadius:8,border:"1px solid var(--border)",background:"transparent",color:"var(--muted)",cursor:"pointer",fontSize:12.5,fontFamily:"inherit"}}>🧮 Start new quote</button>
              </div>
            </div>
            :<div style={{marginTop:6,fontSize:11.5,color:"var(--muted)",textAlign:"center"}}>Quote will be saved under client name</div>
          }
        </Card>
      </div>
    </div>
  </div>
}

