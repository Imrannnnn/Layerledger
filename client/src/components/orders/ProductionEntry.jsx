/**
 * ProductionEntry.jsx
 * ----------------------------------------------------------------------------
 * Manual production entry (legacy quick-add).
 * Step-based form to log a production directly.
 * ----------------------------------------------------------------------------
 */
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { Btn, iSt, Inp, Sel, Card, SHead, Steps, Spinner } from "../common/ui.jsx"
import { fmt, uid, today, calcFullCost, callClaude, compressImage } from "../../lib/helpers.js"
import { DECORATION_ITEMS, FLAVOR_EXTRAS, PAYMENT_TYPES, DEFAULT_MULTS, DEFAULT_COVERINGS } from "../../constants.js"
import { saveInventory, saveProduction, loadLocal, saveLocal } from "../../lib/data.js"

// ═══════════════════════════════════════════════════════════
export function ProductionEntry({inventory,setInventory,recipes,productions,setProductions,settings,setView,user}){
  const [step,setStep]=useState(1)
  const [photo,setPhoto]=useState(null);const [photoB64,setPhotoB64]=useState(null)
  const [aiObs,setAiObs]=useState(null);const [aiLoading,setAiLoading]=useState(false);const [aiMsg,setAiMsg]=useState("")
  const [saving,setSaving]=useState(false)
  const fileRef=useRef()

  // Order details
  const [recipeId,setRecipeId]=useState("")
  const [layers,setLayers]=useState("1")
  const [size,setSize]=useState("");const [covering,setCovering]=useState("")
  const [flavors,setFlavors]=useState("");const [decorIds,setDecorIds]=useState([])

  // Multi-tier state — load from calculator prefill if available
  const loadCovs=()=>loadLocal("ll_coverings", DEFAULT_COVERINGS)
  const availCoverings=loadCovs()
  const loadPrefill=()=>{
    try{
      // Check quote prefill first, then calc prefill
      const q=loadLocal("ll_quote_prefill", null)
      if(q){saveLocal("ll_quote_prefill", null);return{...q,fromQuote:true}}
      const c=loadLocal("ll_calc_prefill", null)
      if(c){saveLocal("ll_calc_prefill", null);return c}
      return null
    }catch{return null}
  }
  const prefill=useState(()=>loadPrefill())[0]
  const [fromQuote]=useState(()=>!!prefill?.fromQuote)
  const [tiers,setTiers]=useState(()=>{
    if(prefill?.tiers&&prefill.tiers.length>0){
      // Normalize tier data from quote format
      return prefill.tiers.map(t=>({
        ...t,
        size:t.size?String(t.size).replace(/['"]/g,""):"6",
        shape:t.shape||"round",
        covering:t.covering||t.coverings?.[0]?.type||"Buttercream",
        layers:t.layers||[{id:Date.now(),flavour:""}],
        coverings:t.coverings||[{id:Date.now(),type:t.covering||"Buttercream",grams:400}],
        fillings:t.fillings||[]
      }))
    }
    return [{id:1,size:"6",shape:"round",covering:"Buttercream",layers:[{id:1,flavour:""}]}]
  })
  const [topper,setTopper]=useState(()=>prefill?.topper||{enabled:false,make:"",deliver:""})
  const [prefillClient]=useState(()=>prefill?.clientName||"")
  const [prefillPhone]=useState(()=>prefill?.clientPhone||"")
  const [decQtyMap,setDecQtyMap]=useState({})
  const layerRecipes=recipes.filter(r=>!r.type||r.type==="layer")
  const loadMults=()=>loadLocal("ll_multipliers", DEFAULT_MULTS)
  const multTable=loadMults()
  const getMult=(s,sh)=>multTable[`${s}-${sh}`]||1
  const addProdTier=()=>setTiers(t=>[...t,{id:Date.now(),size:"6",shape:"round",covering:"Buttercream",layers:[{id:Date.now()+1,flavour:""}]}])
  const removeProdTier=id=>setTiers(t=>t.filter(x=>x.id!==id))
  const updatePTier=(id,key,val)=>setTiers(t=>t.map(x=>x.id===id?{...x,[key]:val}:x))
  const addPLayer=tierId=>setTiers(t=>t.map(x=>x.id===tierId?{...x,layers:[...x.layers,{id:Date.now(),flavour:""}]}:x))
  const removePLayer=(tierId,layerId)=>setTiers(t=>t.map(x=>x.id===tierId?{...x,layers:x.layers.filter(l=>l.id!==layerId)}:x))
  const updatePLayer=(tierId,layerId,flavour)=>setTiers(t=>t.map(x=>x.id===tierId?{...x,layers:x.layers.map(l=>l.id===layerId?{...l,flavour}:l)}:x))
  const tierRecipeCost=(flavour,size,shape)=>{
    const r=recipes.find(x=>x.name.toLowerCase().includes(flavour.toLowerCase()))
    if(!r)return 0
    const base=r.ing.reduce((s,ing)=>{const it=inventory.find(x=>x.id===ing.iid);return s+(it?it.cost*ing.qty:0)},0)
    return base*getMult(size,shape)
  }
  const tierCoveringCost=(cov,size,shape,numLayers)=>{
    const c=availCoverings.find(x=>x.name===cov)
    if(!c||!c.cost)return 0
    return c.cost*(c.scales?getMult(size,shape):1)*numLayers
  }
  const tierTotalCost=tiers.reduce((s,t)=>s+t.layers.reduce((s2,l)=>s2+(l.flavour?tierRecipeCost(l.flavour,t.size,t.shape):0),0)+tierCoveringCost(t.covering,t.size,t.shape,t.layers.length),0)
  const topperCost=(+topper.make||0)+(+topper.deliver||0)
  const newTotalCost=Math.round((tierTotalCost+topperCost)*(1+(settings.accessoryPct||10)/100))
  const [client,setClient]=useState(()=>prefillClient||"");const [clientPhone,setClientPhone]=useState(()=>prefillPhone||"");const [clientEmail,setClientEmail]=useState("")
  const [orderDate,setOrderDate]=useState(today());const [delivDate,setDelivDate]=useState("")
  const [salePrice,setSalePrice]=useState("");const [deliveryCost,setDeliveryCost]=useState("0")
  const [paymentType,setPaymentType]=useState("full");const [discountPct,setDiscountPct]=useState("0")
  const [notes,setNotes]=useState("")

  const SIZES=['6"','8"','10"','12"','2-tier','3-tier','cupcakes×12','cupcakes×24','loaf']
  const COVERINGS=["buttercream","fondant","ganache","naked","plain"]

  const matchedRecipe = recipes.find(r=>r.id===recipeId) || recipes.find(r=>r.size===size&&r.covering===covering) || recipes.find(r=>r.size===size) || null

  const baseCost = calcFullCost(matchedRecipe, inventory, flavors, decorIds, settings.accessoryPct) * (+layers||1)
  const delivCost = +deliveryCost||0
  const totalProdCost = baseCost + delivCost
  const discount = paymentType==="discount"?(+salePrice*(+discountPct/100)):0
  const effectiveSale = paymentType==="full"||paymentType==="deposit" ? +salePrice : paymentType==="discount" ? +salePrice-discount : 0
  const costPerLayer = calcFullCost(matchedRecipe, inventory, flavors, decorIds, settings.accessoryPct)

  const profitPct = settings.profitPct || 40
  const overheadPct = settings.overheadPct || 27
  const accessoryPct = settings.accessoryPct || 10

  const costWithoutAccessory = baseCost / (1 + accessoryPct / 100)
  const suggestedPrice = Math.round(costWithoutAccessory * (1 + (profitPct + overheadPct + accessoryPct) / 100)) + delivCost

  const customBaseWithoutAccessory = tierTotalCost + topperCost
  const customSuggestedPrice = Math.round(customBaseWithoutAccessory * (1 + (profitPct + overheadPct + accessoryPct) / 100))

  const handleFile=e=>{const file=e.target.files[0];if(!file)return;setPhoto(URL.createObjectURL(file));const r=new FileReader();r.onload=ev=>setPhotoB64(ev.target.result.split(",")[1]);r.readAsDataURL(file)}

  const analyzePhoto = async () => {
    if(!photoB64)return;setAiLoading(true);setAiMsg("")
    try{
      const compressed = await compressImage(photoB64)
      const invList=inventory.map(i=>`${i.name}(${i.unit})`).join(",")
      const decorList=DECORATION_ITEMS.map(d=>`${d.id}:${d.name}`).join(",")
      const raw = await callClaude([{role:"user",content:[
        {type:"image",source:{type:"base64",media_type:"image/jpeg",data:compressed}},
        {type:"text",text:`You are analyzing a custom cake photo for a Nigerian bakery's bookkeeping system. 

Analyze this cake image carefully and return ONLY valid JSON with this exact structure:
{
  "estimatedSize": "6 inch OR 8 inch OR 10 inch OR 12 inch OR 2-tier OR 3-tier OR cupcakes",
  "covering": "buttercream OR fondant OR ganache OR naked",
  "estimatedTiers": 1,
  "colorDescription": "describe the colors used",
  "flavorClues": "any visual clues about flavor (e.g. dark color = chocolate, red = red velvet)",
  "decorationsUsed": ["list of decoration IDs from: ${decorList}"],
  "accessoriesDescription": "describe all decorations, toppings, extras visible",
  "photoNotes": "one sentence summary for the record"
}`
      }]}],"You analyze cake photos for bookkeeping. Return valid JSON only, no markdown.")
      const r=JSON.parse(raw.replace(/```json|```/g,"").trim())
      setAiObs(r)
      // Auto-fill fields
      if(!covering&&r.covering&&COVERINGS.includes(r.covering))setCovering(r.covering)
      if(!size&&r.estimatedSize){
        const s=r.estimatedSize.replace(/\s*(inch|in)\s*/i,'"').replace(/(\d+)"/,'$1"')
        if(SIZES.includes(s))setSize(s); else if(SIZES.includes(r.estimatedSize))setSize(r.estimatedSize)
      }
      if(r.decorationsUsed?.length>0)setDecorIds(r.decorationsUsed.filter(id=>DECORATION_ITEMS.find(d=>d.id===id)))
      if(r.flavorClues&&!flavors){
        const fc=r.flavorClues.toLowerCase()
        if(fc.includes("chocolate")||fc.includes("dark"))setFlavors("Chocolate")
        else if(fc.includes("red velvet"))setFlavors("Red Velvet")
        else if(fc.includes("carrot"))setFlavors("Carrot")
        else setFlavors("Vanilla")
      }
      setAiMsg("✓ AI has pre-filled size, covering, decorations and flavour from the photo. Review and confirm below.")
    }catch(err){setAiMsg("⚠ Could not read photo automatically. Fields have not been pre-filled — please fill in manually below. (Error: "+err.message+")")}
    finally{setAiLoading(false)}
  }

  const toggleDecor = (id) => setDecorIds(prev => prev.includes(id) ? prev.filter(d=>d!==id) : [...prev,id])

  const doSave = async () => {
    setSaving(true)
    const tierSummary=tiers.map(t=>`${t.size}" ${t.shape} ${t.covering} (${t.layers.map(l=>l.flavour||"—").join("/")})`).join(" + ")
    const flavourSummary=tiers.flatMap(t=>t.layers.map(l=>l.flavour)).filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).join(", ")
    const prod={id:uid(),client,clientPhone,clientEmail,orderDate,deliveryDate:delivDate,cost:newTotalCost,deliveryCost:delivCost,salePrice:Math.round(effectiveSale),status:"pending",size:tiers[0]?.size+'"',covering:tiers[0]?.covering,flavors:flavourSummary,tiers,topper,decorations:decorIds.join(","),layers:tiers.reduce((s,t)=>s+t.layers.length,0),accessoryPct:settings.accessoryPct,profitPct:settings.profitPct,paymentType,discountPct:+discountPct,notes,tierSummary}
    // Deduct inventory
    if(matchedRecipe){
      const layerCount=+layers||1
      const deductions=[...matchedRecipe.ing.map(i=>({...i,qty:+(i.qty)*layerCount}))]
      const fl=(flavors||"").toLowerCase().split(/[,+&]/).map(f=>f.trim()).filter(Boolean)
      fl.forEach(f=>(FLAVOR_EXTRAS[f]||[]).forEach(e=>{const ex=deductions.find(d=>d.iid===e.iid);if(ex)ex.qty=parseFloat((ex.qty+e.qty).toFixed(3));else deductions.push({iid:e.iid,qty:e.qty})}))
      decorIds.forEach(did=>{const decor=DECORATION_ITEMS.find(d=>d.id===did);if(decor){const ex=deductions.find(d=>d.iid===decor.iid);if(ex)ex.qty=parseFloat((ex.qty+decor.qty).toFixed(3));else deductions.push({iid:decor.iid,qty:decor.qty})}})
      const updInv=inventory.map(item=>{const ing=deductions.find(i=>i.iid===item.id);return ing?{...item,stock:Math.max(0,parseFloat((item.stock-ing.qty).toFixed(3)))}:item})
      setInventory(updInv);await saveInventory(updInv)
    }
    setProductions(prev=>[prod,...prev]);await saveProduction(prod);setSaving(false)
    // Reset
    setStep(1);setPhoto(null);setPhotoB64(null);setAiObs(null);setAiMsg("");setRecipeId("");setLayers("1");setSize("");setCovering("");setFlavors("");setDecorIds([]);setClient("");setClientPhone("");setClientEmail("");setOrderDate(today());setDelivDate("");setSalePrice("");setDeliveryCost("0");setPaymentType("full");setDiscountPct("0");setNotes("")
    setView("records")
  }

  return <div>
    <SHead title="New Production Entry" sub="Upload cake photo → AI reads it → fills in details automatically."/>
    <Steps steps={["Cake Details","Cost Breakdown","Confirm"]} cur={step}/>

    {step===1&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
      <Card>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:15,fontWeight:600,marginBottom:12}}>📸 Cake Photo <span style={{fontSize:11,color:"var(--muted)"}}>(recommended)</span></div>
        <div onClick={()=>fileRef.current?.click()} style={{border:"2px dashed var(--border)",borderRadius:10,padding:photo?4:36,textAlign:"center",cursor:"pointer",background:"#FAF7F0",marginBottom:10,minHeight:120,display:"flex",alignItems:"center",justifyContent:"center"}}>
          {photo?<img src={photo} alt="cake" style={{maxHeight:180,maxWidth:"100%",borderRadius:8}}/>:<div><div style={{fontSize:36,marginBottom:6}}>🎂</div><div style={{fontSize:13,color:"var(--muted)"}}>Tap to upload cake photo</div></div>}
        </div>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{display:"none"}}/>
        {photo&&!aiObs&&!aiLoading&&<Btn full onClick={analyzePhoto}>✦ Let AI Read This Photo</Btn>}
        {aiLoading&&<div style={{textAlign:"center",padding:"10px",color:"var(--muted)",fontSize:13}}>🔍 AI is reading the photo...</div>}
        {aiMsg&&<div style={{marginTop:8,padding:"8px 12px",background:aiMsg.startsWith("✓")?"#EEF8F3":"#FDEBE9",borderRadius:8,fontSize:12.5,color:aiMsg.startsWith("✓")?"#357A52":"#B03A2E",lineHeight:1.5}}>{aiMsg}</div>}
        {aiObs&&<div style={{marginTop:8,background:"#FFF9EE",borderRadius:8,padding:10,border:"1px solid var(--gold)",fontSize:12.5}}>
          <div style={{fontWeight:600,marginBottom:6,color:"var(--text)"}}>✦ AI observed from photo:</div>
          {[["Size",aiObs.estimatedSize],["Covering",aiObs.covering],["Colour",aiObs.colorDescription],["Flavour clues",aiObs.flavorClues],["Decorations",aiObs.accessoriesDescription]].filter(([,v])=>v).map(([k,v])=><div key={k} style={{marginBottom:3,display:"flex",gap:6}}><span style={{color:"var(--muted)",minWidth:80}}>{k}:</span><span style={{color:"var(--text)"}}>{v}</span></div>)}
        </div>}
      </Card>

      {fromQuote&&<div style={{background:"#E8EFFC",border:"1px solid #B5D4F4",borderRadius:8,padding:"10px 14px",marginBottom:12,fontSize:12.5,color:"#2355A0"}}>
        ✓ Pre-filled from saved quote. Review details and add anything extra before confirming.
      </div>}
      <Card>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:15,fontWeight:600,marginBottom:12}}>Cake Tiers</div>
        {tiers.map((tier,ti)=><div key={tier.id} style={{marginBottom:12,padding:12,background:"#F5F0E4",borderRadius:10,borderLeft:"4px solid var(--gold)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <div style={{fontWeight:500,fontSize:13}}>Tier {ti+1}</div>
            {tiers.length>1&&<Btn small variant="danger" onClick={()=>removeProdTier(tier.id)}>Remove</Btn>}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
            <div>
              <label style={{fontSize:10,color:"var(--muted)",display:"block",marginBottom:3,textTransform:"uppercase",letterSpacing:.8,fontWeight:500}}>Size (inches)</label>
              <select value={tier.size} onChange={e=>updatePTier(tier.id,"size",e.target.value)} style={{...iSt}}>
                {["4","5","6","7","8","9","10","12","14"].map(s=><option key={s} value={s}>{s}"</option>)}
              </select>
            </div>
            <div>
              <label style={{fontSize:10,color:"var(--muted)",display:"block",marginBottom:3,textTransform:"uppercase",letterSpacing:.8,fontWeight:500}}>Shape</label>
              <select value={tier.shape} onChange={e=>updatePTier(tier.id,"shape",e.target.value)} style={{...iSt}}>
                {["round","square","heart","number","sheet"].map(s=><option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
              </select>
            </div>
          </div>
          <div style={{marginBottom:8}}>
            <label style={{fontSize:10,color:"var(--muted)",display:"block",marginBottom:3,textTransform:"uppercase",letterSpacing:.8,fontWeight:500}}>Covering</label>
            <select value={tier.covering} onChange={e=>updatePTier(tier.id,"covering",e.target.value)} style={{...iSt}}>
              {availCoverings.map(c=><option key={c.name} value={c.name}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{fontSize:10,color:"var(--muted)",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:.8,fontWeight:500}}>Layers — one flavour per layer</label>
            {tier.layers.map((layer,li)=><div key={layer.id} style={{display:"flex",gap:6,alignItems:"center",marginBottom:5}}>
              <span style={{fontSize:11.5,color:"var(--muted)",minWidth:52}}>Layer {li+1}</span>
              <select value={layer.flavour} onChange={e=>updatePLayer(tier.id,layer.id,e.target.value)} style={{...iSt,flex:1}}>
                <option value="">— Select flavour —</option>
                {layerRecipes.map(r=><option key={r.id} value={r.name}>{r.name}</option>)}
              </select>
              {layer.flavour&&<span style={{fontSize:11,color:"var(--gold)",whiteSpace:"nowrap"}}>{fmt(tierRecipeCost(layer.flavour,tier.size,tier.shape))}</span>}
              {tier.layers.length>1&&<Btn small variant="danger" onClick={()=>removePLayer(tier.id,layer.id)}>×</Btn>}
            </div>)}
            <Btn small variant="ghost" onClick={()=>addPLayer(tier.id)}>+ Add layer</Btn>
          </div>
          <div style={{marginTop:8,fontSize:12,color:"var(--muted)"}}>Tier cost: <strong style={{color:"var(--gold)"}}>{fmt(tier.layers.reduce((s,l)=>s+(l.flavour?tierRecipeCost(l.flavour,tier.size,tier.shape):0),0)+tierCoveringCost(tier.covering,tier.size,tier.shape,tier.layers.length))}</strong></div>
        </div>)}
        <Btn variant="ghost" onClick={addProdTier} style={{width:"100%",marginBottom:14,borderStyle:"dashed"}}>+ Add tier</Btn>

        <div style={{fontFamily:"'Playfair Display',serif",fontSize:15,fontWeight:600,marginBottom:10}}>Custom topper</div>
        <Card style={{marginBottom:14}}>
          <label style={{display:"flex",alignItems:"center",gap:8,fontSize:13,cursor:"pointer",marginBottom:topper.enabled?10:0}}>
            <input type="checkbox" checked={topper.enabled} onChange={e=>setTopper(t=>({...t,enabled:e.target.checked}))}/>
            This order has a custom topper
          </label>
          {topper.enabled&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            <Inp label="Making cost (₦)" type="number" value={topper.make} onChange={v=>setTopper(t=>({...t,make:v}))} placeholder="5000"/>
            <Inp label="Delivery to shop (₦)" type="number" value={topper.deliver} onChange={v=>setTopper(t=>({...t,deliver:v}))} placeholder="1500"/>
          </div>}
        </Card>

        <div style={{padding:"10px 14px",background:"#E8F5EE",borderRadius:8,fontSize:13,marginBottom:14,display:"flex",justifyContent:"space-between"}}>
          <span>Total ingredient cost</span>
          <strong style={{color:"#357A52"}}>{fmt(newTotalCost)}</strong>
        </div>

        <div style={{fontFamily:"'Playfair Display',serif",fontSize:15,fontWeight:600,marginBottom:10}}>Order details</div>
        <Inp label="Client Name *" value={client} onChange={setClient} placeholder="Mrs. Chioma Okafor"/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <Inp label="Phone" value={clientPhone} onChange={setClientPhone} placeholder="+234…"/>
          <Inp label="Email" value={clientEmail} onChange={setClientEmail} placeholder="optional"/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <Inp label="Order Date" type="date" value={orderDate} onChange={setOrderDate}/>
          <Inp label="Delivery Date *" type="date" value={delivDate} min={today()} onChange={v=>{
            if (v && v < today()) {
              alert("Delivery date cannot be in the past.")
              return
            }
            setDelivDate(v)
          }}/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <Inp label="Sale Price (₦)" type="number" value={salePrice} onChange={setSalePrice} placeholder={newTotalCost>0?`Suggested: ${fmt(customSuggestedPrice)}`:"0"}/>
          <Inp label="Delivery Cost (₦)" type="number" value={deliveryCost} onChange={setDeliveryCost} placeholder="0"/>
        </div>
        <Sel label="Payment Type" value={paymentType} onChange={setPaymentType} options={PAYMENT_TYPES.map(p=>({value:p.v,label:p.l}))}/>
        {paymentType==="discount"&&<Inp label="Discount %" type="number" value={discountPct} onChange={setDiscountPct}/>}
        <Inp label="Notes" value={notes} onChange={setNotes} placeholder="Colour theme, special requests…"/>
        {newTotalCost>0&&!salePrice&&<div style={{padding:"7px 12px",background:"#E8EFFC",borderRadius:8,fontSize:12.5,marginBottom:10,color:"#2355A0"}}>💡 Suggested price ({profitPct}% profit + {overheadPct}% overhead): <strong>{fmt(customSuggestedPrice)}</strong></div>}
        <Btn full onClick={()=>setStep(2)} disabled={!client||!delivDate||!tiers.some(t=>t.layers.some(l=>l.flavour))}>Review Cost Breakdown →</Btn>
      </Card>
    </div>}

    {step===2&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
      <Card>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:16,fontWeight:600,marginBottom:16}}>Cost Breakdown</div>
        {tiers.map((tier,ti)=><div key={tier.id} style={{marginBottom:14}}>
          <div style={{fontSize:10.5,color:"var(--muted)",textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Tier {ti+1} — {tier.size}" {tier.shape} · {tier.covering}</div>
          {tier.layers.map((layer,li)=>{
            const r=recipes.find(x=>x.name.toLowerCase().includes((layer.flavour||"").toLowerCase()))
            const cost=r?tierRecipeCost(layer.flavour,tier.size,tier.shape):0
            return layer.flavour?<div key={layer.id} style={{display:"flex",justifyContent:"space-between",padding:"3px 0",fontSize:12.5}}>
              <span>Layer {li+1}: {layer.flavour}</span><span>{fmt(cost)}</span>
            </div>:null
          })}
          {tier.covering!=="Naked"&&<div style={{display:"flex",justifyContent:"space-between",padding:"3px 0",fontSize:12.5,color:"var(--muted)"}}>
            <span>Covering: {tier.covering}</span><span>{fmt(tierCoveringCost(tier.covering,tier.size,tier.shape,tier.layers.length))}</span>
          </div>}
        </div>)}
        {topper.enabled&&<><div style={{fontSize:10.5,color:"var(--muted)",textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Custom Topper</div>
          <div style={{display:"flex",justifyContent:"space-between",padding:"3px 0",fontSize:12.5}}><span>Making cost</span><span>{fmt(+topper.make||0)}</span></div>
          <div style={{display:"flex",justifyContent:"space-between",padding:"3px 0",fontSize:12.5}}><span>Delivery to shop</span><span>{fmt(+topper.deliver||0)}</span></div>
        </>}
        <div style={{borderTop:"1px solid var(--border)",marginTop:8,paddingTop:8}}>
          {[["Accessory margin ("+settings.accessoryPct+"%)",fmt(Math.round(newTotalCost-(newTotalCost/(1+(settings.accessoryPct||10)/100))))],["Delivery",fmt(delivCost)]].map(([k,v])=><div key={k} style={{display:"flex",justifyContent:"space-between",fontSize:12.5,color:"var(--muted)",padding:"2px 0"}}><span>{k}</span><span>{v}</span></div>)}
          <div style={{display:"flex",justifyContent:"space-between",fontWeight:700,fontSize:14,padding:"8px 0",borderTop:"1px solid var(--border)",marginTop:4}}><span>Total Production Cost</span><span style={{color:"var(--gold)"}}>{fmt(newTotalCost+delivCost)}</span></div>
        </div>
        {effectiveSale>0&&<div style={{background:"#EEF8F3",borderRadius:8,padding:12,border:"1px solid #C2E0CF",marginTop:8}}>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:4}}><span style={{color:"var(--muted)"}}>Sale Price</span><span style={{fontWeight:600}}>{fmt(effectiveSale)}</span></div>
          <div style={{display:"flex",justifyContent:"space-between",fontWeight:700,fontSize:14,paddingTop:8,borderTop:"1px solid #C2E0CF"}}><span>Gross Profit</span><span style={{color:"#357A52"}}>{fmt(effectiveSale-(newTotalCost+delivCost))}</span></div>
          <div style={{fontSize:11,color:"var(--muted)",marginTop:3}}>Margin: {effectiveSale>0?Math.round(((effectiveSale-(newTotalCost+delivCost))/effectiveSale)*100):0}%</div>
        </div>}
        {(paymentType==="gift"||paymentType==="sample")&&<div style={{background:"#F0EAFC",borderRadius:8,padding:10,marginTop:8,fontSize:12.5,color:"#6B32A0"}}>This is a <strong>{paymentType}</strong> — no revenue logged but all costs are tracked.</div>}
      </Card>
      <Card>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:15,fontWeight:600,marginBottom:12}}>Order Summary</div>
        {[["Cake",tiers.map((t,i)=>`Tier ${i+1}: ${t.size}" ${t.shape} ${t.covering} (${t.layers.map(l=>l.flavour||"?").join("/")})`).join(" | ")],["Client",client],["Phone",clientPhone||"—"],["Order Date",orderDate],["Delivery Date",delivDate],["Payment",PAYMENT_TYPES.find(p=>p.v===paymentType)?.l||paymentType],["Notes",notes||"—"]].map(([k,v])=><div key={k} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid var(--border)",fontSize:12.5}}><span style={{color:"var(--muted)"}}>{k}</span><span style={{fontWeight:500,textAlign:"right",maxWidth:"60%"}}>{v}</span></div>)}
        {photo&&<img src={photo} alt="" style={{width:"100%",borderRadius:8,marginTop:10}}/>}
        <div style={{marginTop:10,fontSize:12,color:"var(--muted)",background:"#FFF9EE",borderRadius:6,padding:"7px 10px"}}>⚠ Saving will deduct ingredients from inventory based on recipe quantities.</div>
        <div style={{marginTop:12,display:"flex",gap:8}}><Btn onClick={()=>setStep(3)}>Confirm →</Btn><Btn variant="ghost" onClick={()=>setStep(1)}>← Edit</Btn></div>
      </Card>
    </div>}

    {step===3&&<div style={{maxWidth:460}}>
      <Card style={{borderColor:"#357A52",background:"#F2FAF6"}}>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:17,fontWeight:600,marginBottom:6}}>✓ Ready to Save</div>
        <p style={{fontSize:13,color:"var(--muted)",marginTop:0}}>This will create a production record and deduct all ingredients from inventory.</p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,padding:"12px 0",borderTop:"1px solid var(--border)"}}>
          {[["Prod. Cost",fmt(totalProdCost)],["Sale Price",fmt(effectiveSale)],["Gross Profit",fmt(effectiveSale-totalProdCost)]].map(([k,v])=><div key={k} style={{background:"var(--panel)",borderRadius:8,padding:"10px 12px"}}><div style={{fontSize:10,color:"var(--muted)",textTransform:"uppercase",letterSpacing:0.8}}>{k}</div><div style={{fontFamily:"'Playfair Display',serif",fontSize:15,fontWeight:700,color:"var(--gold)",marginTop:3}}>{v}</div></div>)}
        </div>
        <div style={{display:"flex",gap:8,marginTop:4}}>{saving?<Spinner/>:<><Btn variant="success" onClick={doSave}>✓ Save Production Record</Btn><Btn variant="ghost" onClick={()=>setStep(2)}>← Back</Btn></>}</div>
      </Card>
    </div>}
  </div>
}

// ═══════════════════════════════════════════════════════════
//  RECEIPT SCANNER (fixed)
