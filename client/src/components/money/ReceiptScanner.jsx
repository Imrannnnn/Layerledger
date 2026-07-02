/**
 * ReceiptScanner.jsx
 * ----------------------------------------------------------------------------
 * AI receipt scanner.
 * Photograph a receipt; AI extracts items; confirm to update stock + expenses.
 * ----------------------------------------------------------------------------
 */
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { Btn, iSt, Inp, Card, Badge, SHead } from "../common/ui.jsx"
import { fmt, uid, today, callClaude, compressImage } from "../../lib/helpers.js"
import { saveInventory, saveExpenses } from "../../lib/data.js"

// ═══════════════════════════════════════════════════════════
export function ReceiptScanner({inventory,setInventory,expenses,setExpenses}){
  const [photo,setPhoto]=useState(null);const [photoB64,setPhotoB64]=useState(null)
  const [loading,setLoading]=useState(false);const [error,setError]=useState("");const [saved,setSaved]=useState(false)
  const [parsed,setParsed]=useState(null);const [totalAmount,setTotalAmount]=useState("")
  const fileRef=useRef()

  const handleFile=e=>{const file=e.target.files[0];if(!file)return;setPhoto(URL.createObjectURL(file));const r=new FileReader();r.onload=ev=>setPhotoB64(ev.target.result.split(",")[1]);r.readAsDataURL(file);setParsed(null);setSaved(false);setError("")}

  const scan=async()=>{
    if(!photoB64)return;setLoading(true);setError("")
    try{
      const compressed=await compressImage(photoB64,1200)
      const invList=inventory.map(i=>`${i.id}:${i.name}(${i.unit})`).join(", ")
      const raw=await callClaude([{role:"user",content:[
        {type:"image",source:{type:"base64",media_type:"image/jpeg",data:compressed}},
        {type:"text",text:`This is a Nigerian bakery receipt — printed or handwritten. Read every item carefully.

Inventory list to match against:
${invList}

For each item, classify as:
- "purchase" if it is a baking ingredient or supply (flour, sugar, butter, eggs, oil, cocoa, milk, cream, food colour, packaging materials, cake boards, boxes, ribbons, decorations, etc.)
- "expense" if it is an overhead cost (delivery fee, transport, utility, salary, cleaning, equipment repair, marketing, rent, etc.)

For purchase items, also extract:
- unit_size: the size of one pack/bag/crate (e.g. 50 for a 50kg bag, 30 for a 30-egg crate)
- If unit_size is not clear from the receipt, use the qty as the unit_size and set qty to 1.

Return ONLY this exact JSON, no other text:
{
  "items": [
    {"item_on_receipt":"flour","qty":3,"unit":"kg","unit_size":50,"unit_price":57000,"line_total":171000,"type":"purchase","matched_id":"i1","matched_name":"Flour","confidence":"high"},
    {"item_on_receipt":"delivery fee","qty":1,"unit":"","unit_size":1,"unit_price":2000,"line_total":2000,"type":"expense","matched_id":"","matched_name":"Delivery","confidence":"high"}
  ],
  "receipt_total":173000,
  "receipt_date":"2026-04-01",
  "supplier":"market name if visible"
}
confidence: "high", "medium", or "low". For unclear handwriting, make best guess.`}
      ]}],"Parse Nigerian bakery receipts. Classify each item as purchase or expense. Return valid JSON only.")
      const result=JSON.parse(raw.replace(/```json|```/g,"").trim())
      if(!result.items||result.items.length===0)throw new Error("No items found. Try a brighter, clearer photo.")
      setParsed({...result,items:result.items.map(r=>({...r,approved:r.confidence!=="low",overrideId:r.matched_id||"",type:r.type||"purchase"}))})
      if(result.receipt_total)setTotalAmount(String(result.receipt_total))
    }catch(err){setError(`Could not read receipt: ${err.message}`)}
    finally{setLoading(false)}
  }

  const toggleApprove=idx=>setParsed(p=>({...p,items:p.items.map((r,i)=>i===idx?{...r,approved:!r.approved}:r)}))
  const setMatch=(idx,id)=>setParsed(p=>({...p,items:p.items.map((r,i)=>i===idx?{...r,overrideId:id,approved:true}:r)}))

  const toggleType=(idx)=>setParsed(p=>({...p,items:p.items.map((r,i)=>i===idx?{...r,type:r.type==="purchase"?"expense":"purchase"}:r)}))

  const applyUpdates=async()=>{
    const approved=parsed.items.filter(r=>r.approved)
    const purchases=approved.filter(r=>r.type==="purchase"&&r.overrideId)
    const expItems=approved.filter(r=>r.type==="expense"||!r.overrideId)

    // Update inventory: stock + cost/unit for purchases
    let updInv=[...inventory]
    const purchaseLog=[]
    purchases.forEach(r=>{
      const invItem=updInv.find(i=>i.id===r.overrideId)
      if(!invItem)return
      const unitSize=+r.unit_size||+r.qty||1
      const cpu=parseFloat((+r.unit_price/unitSize).toFixed(2))
      const stockAdded=parseFloat((unitSize*(+r.qty||1)).toFixed(3))
      updInv=updInv.map(i=>i.id===r.overrideId?{...i,cost:cpu,stock:parseFloat((i.stock+stockAdded).toFixed(3))}:i)
      purchaseLog.push({id:uid(),date:parsed.receipt_date||today(),itemId:r.overrideId,item:invItem.name,unit:invItem.unit,unitSize,qty:+r.qty||1,price:+r.unit_price,total:+r.line_total||0,cpu,stockAdded})
    })
    if(purchases.length>0){setInventory(updInv);await saveInventory(updInv)}

    // Save purchase records
    if(purchaseLog.length>0){
      const existing=JSON.parse(localStorage.getItem("ll_purchases")||"[]")
      localStorage.setItem("ll_purchases",JSON.stringify([...purchaseLog,...existing]))
    }

    // Log expense for the whole receipt
    const amt=+totalAmount||parsed.items.reduce((s,r)=>s+(+r.line_total||0),0)
    const purchaseNames=purchases.map(r=>r.matched_name||r.item_on_receipt)
    const expNames=expItems.map(r=>r.item_on_receipt)
    const allNames=[...purchaseNames,...expNames]
    const category=purchases.length>0&&expItems.length===0?"Ingredients":expItems.length>0&&purchases.length===0?"Operations":"Mixed"
    const exp={id:uid(),date:parsed.receipt_date||today(),description:`${parsed.supplier||"Receipt"} — ${category}`,amount:amt,category,paymentMethod:"cash",source:"receipt",notes:`Purchases: ${purchaseNames.join(", ")||"none"} | Expenses: ${expNames.join(", ")||"none"}`}
    const updExp=[exp,...expenses];setExpenses(updExp);saveExpenses(updExp)

    setParsed(null);setPhoto(null);setPhotoB64(null);setSaved(true)
  }

  return <div>
    <SHead title="Receipt Scanner" sub="Photo → AI reads items → updates inventory + logs expense."/>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
      <Card>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:15,fontWeight:600,marginBottom:12}}>📷 Upload Receipt Photo</div>
        {!photo&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
          <button onClick={async()=>{
            try{
              const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"}})
              const video=document.createElement("video")
              video.srcObject=stream;video.autoplay=true
              const overlay=document.createElement("div")
              overlay.style.cssText="position:fixed;top:0;left:0;width:100%;height:100%;background:#000;z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px"
              video.style.cssText="max-width:100%;max-height:70vh;border-radius:10px"
              const btn=document.createElement("button")
              btn.textContent="📷 Capture"
              btn.style.cssText="padding:14px 32px;border-radius:10px;border:none;background:var(--gold);color:#fff;font-size:16px;cursor:pointer"
              const close=document.createElement("button")
              close.textContent="✕ Cancel"
              close.style.cssText="padding:10px 24px;border-radius:10px;border:none;background:#555;color:#fff;font-size:14px;cursor:pointer"
              overlay.appendChild(video);overlay.appendChild(btn);overlay.appendChild(close)
              document.body.appendChild(overlay)
              btn.onclick=()=>{
                const canvas=document.createElement("canvas")
                canvas.width=video.videoWidth;canvas.height=video.videoHeight
                canvas.getContext("2d").drawImage(video,0,0)
                stream.getTracks().forEach(t=>t.stop())
                document.body.removeChild(overlay)
                const dataUrl=canvas.toDataURL("image/jpeg",0.8)
                const b64=dataUrl.split(",")[1]
                handleFile({target:{files:[new File([Uint8Array.from(atob(b64),c=>c.charCodeAt(0))],"capture.jpg",{type:"image/jpeg"})]}})
              }
              close.onclick=()=>{stream.getTracks().forEach(t=>t.stop());document.body.removeChild(overlay)}
            }catch(e){
              // fallback to file input with capture on mobile
              const inp=document.createElement("input");inp.type="file";inp.accept="image/*";inp.capture="environment"
              inp.onchange=e=>handleFile({target:inp});inp.click()
            }
          }} style={{padding:"14px 8px",borderRadius:10,border:"2px dashed var(--border)",background:"#FAF7F0",cursor:"pointer",textAlign:"center"}}>
            <div style={{fontSize:28,marginBottom:4}}>📷</div>
            <div style={{fontSize:12.5,color:"var(--muted)",fontWeight:500}}>Open camera</div>
            <div style={{fontSize:11,color:"#C8B89A",marginTop:2}}>Take a photo now</div>
          </button>
          <button onClick={()=>fileRef.current?.click()} style={{padding:"14px 8px",borderRadius:10,border:"2px dashed var(--border)",background:"#FAF7F0",cursor:"pointer",textAlign:"center"}}>
            <div style={{fontSize:28,marginBottom:4}}>🖼️</div>
            <div style={{fontSize:12.5,color:"var(--muted)",fontWeight:500}}>Upload photo</div>
            <div style={{fontSize:11,color:"#C8B89A",marginTop:2}}>From your gallery</div>
          </button>
        </div>}
        {photo&&<div onClick={()=>fileRef.current?.click()} style={{border:"2px dashed var(--border)",borderRadius:10,padding:4,textAlign:"center",cursor:"pointer",background:"#FAF7F0",marginBottom:12,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <img src={photo} alt="receipt" style={{maxHeight:260,maxWidth:"100%",borderRadius:8}}/>
        </div>}
        <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{display:"none"}}/>
        {photo&&!parsed&&!saved&&<><Btn full onClick={scan} disabled={loading}>{loading?"🔍 AI is reading the receipt…":"✦ Scan & Extract Items"}</Btn>
          {loading&&<div style={{fontSize:12,color:"var(--muted)",textAlign:"center",marginTop:8}}>This may take 15-30 seconds…</div>}
          {error&&<div style={{marginTop:10,padding:"8px 12px",background:"#FDEBE9",borderRadius:8,fontSize:12.5,color:"#B03A2E",lineHeight:1.5}}>⚠ {error}<br/>Try: better lighting, hold camera steady, make sure writing is visible.</div>}
        </>}
        {saved&&<div style={{background:"#EEF8F3",borderRadius:8,padding:12,border:"1px solid #C2E0CF"}}>
          <div style={{fontWeight:600,color:"#357A52",marginBottom:4}}>✓ Done! Purchases updated inventory · expenses logged · cost/unit recalculated.</div>
          <Btn small variant="outline" onClick={()=>{setSaved(false);setPhoto(null);setPhotoB64(null)}}>Scan Another</Btn>
        </div>}
      </Card>
      <div>
        {parsed?<Card>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:15,fontWeight:600,marginBottom:6}}>Items Detected</div>
          {parsed.supplier&&<div style={{fontSize:12,color:"var(--muted)",marginBottom:3}}>Supplier: <strong>{parsed.supplier}</strong></div>}
          {parsed.receipt_date&&<div style={{fontSize:12,color:"var(--muted)",marginBottom:8}}>Date: <strong>{parsed.receipt_date}</strong></div>}
          {parsed.items.map((r,idx)=><div key={idx} style={{padding:"10px 0",borderBottom:"1px solid var(--border)",opacity:r.approved?1:0.45}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:500}}>{r.item_on_receipt}</div>
                <div style={{fontSize:11.5,color:"var(--muted)",marginTop:2}}>{r.qty} {r.unit} · {fmt(r.line_total||0)}</div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
                <span onClick={()=>toggleType(idx)} style={{fontSize:11,padding:"2px 9px",borderRadius:20,cursor:"pointer",fontWeight:500,background:r.type==="purchase"?"#E8EFFC":"#FEF0D0",color:r.type==="purchase"?"#2355A0":"#7A5500",border:`1px solid ${r.type==="purchase"?"#B5D4F4":"#E8C97A"}`}}>
                  {r.type==="purchase"?"🛍 Purchase":"💸 Expense"}
                </span>
                <Badge color={r.confidence==="high"?"green":r.confidence==="medium"?"gold":"red"}>{r.confidence}</Badge>
                <div onClick={()=>toggleApprove(idx)} style={{width:32,height:18,borderRadius:9,background:r.approved?"#357A52":"var(--border)",cursor:"pointer",position:"relative",transition:"background 0.2s",flexShrink:0}}><div style={{width:14,height:14,borderRadius:"50%",background:"white",position:"absolute",top:2,left:r.approved?16:2,transition:"left 0.2s"}}/></div>
              </div>
            </div>
            {r.approved&&r.type==="purchase"&&<div style={{marginTop:6,display:"flex",gap:6}}>
              <select value={r.overrideId||""} onChange={e=>setMatch(idx,e.target.value)} style={{...iSt,fontSize:12,padding:"5px 8px",flex:1}}><option value="">— Match to inventory item —</option>{inventory.map(i=><option key={i.id} value={i.id}>{i.name} ({i.unit}) · stock: {i.stock}</option>)}</select>
            </div>}
            {r.approved&&r.type==="expense"&&<div style={{marginTop:4,fontSize:11.5,color:"var(--muted)",background:"#FFF9EE",padding:"4px 8px",borderRadius:6}}>→ Will be logged to Expenses tab only</div>}
          </div>)}
          <Inp label="Receipt Total (₦)" type="number" value={totalAmount} onChange={setTotalAmount} placeholder="Total amount paid"/>
          <div style={{marginTop:8,fontSize:11.5,color:"var(--muted)",display:"flex",gap:12}}>
            <span>🛍 {parsed.items.filter(r=>r.approved&&r.type==="purchase").length} purchases → inventory + cost/unit updated</span>
            <span>💸 {parsed.items.filter(r=>r.approved&&r.type==="expense").length} expenses → expenses tab</span>
          </div>
          <div style={{display:"flex",gap:8,marginTop:10}}><Btn variant="success" onClick={applyUpdates} disabled={!parsed.items.some(r=>r.approved)}>✓ Confirm & Apply All</Btn><Btn variant="ghost" onClick={()=>{setParsed(null);setPhoto(null);setPhotoB64(null)}}>← Rescan</Btn></div>
        </Card>:<Card style={{background:"#FFF9EE",borderColor:"var(--gold)"}}>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:14,fontWeight:600,marginBottom:12}}>How It Works</div>
          {[["📸","Take a clear photo — printed supermarket receipt or handwritten market receipt."],["🔍","AI reads every item, quantity, and price. It can read handwriting too."],["✅","Review each item. Toggle off anything misread. Fix inventory matches if needed."],["📦","Tap Update — stock is added and expense is automatically logged."]].map(([icon,text])=><div key={icon} style={{display:"flex",gap:10,marginBottom:12}}><span style={{fontSize:18,flexShrink:0}}>{icon}</span><span style={{fontSize:13,color:"var(--muted)",lineHeight:1.6}}>{text}</span></div>)}
          <div style={{padding:"8px 12px",background:"#FEF0D0",borderRadius:8,fontSize:12,color:"#7A5500",lineHeight:1.6}}><strong>Best results:</strong> Take photos in good natural or bright light. Lay the receipt flat. Avoid shadows across the writing. Even imperfect handwriting usually works.</div>
        </Card>}
      </div>
    </div>
  </div>
}

// ═══════════════════════════════════════════════════════════
//  EXPENSES
