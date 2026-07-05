/**
 * Invoices.jsx
 * ----------------------------------------------------------------------------
 * Invoice list + PDF/WhatsApp share.
 * Generates a printable invoice window with a Share button.
 * ----------------------------------------------------------------------------
 */
import React, { useState, useEffect } from "react"
import { Btn, iSt, Card, Badge, SHead, Tabs } from "../common/ui.jsx"
import { loadLocal, saveLocal } from "../../lib/data.js"

export function Invoices({productions,company,prefillProd,setPrefillProd}){
  const loadInvs=()=>{return loadLocal("ll_quote_invoices",[])}
  const [invoices,setInvoices]=useState(loadInvs)
  const [search,setSearch]=useState("")
  const [filter,setFilter]=useState("all")

  // Reload when component mounts
  useEffect(()=>{ setInvoices(loadInvs()) },[])

  const filtered=invoices
    .filter(inv=>filter==="all"||(filter==="paid" ? inv.status==="paid" : inv.status!=="paid"))
    .filter(inv=>!search||inv.clientName?.toLowerCase().includes(search.toLowerCase())||inv.id?.toLowerCase().includes(search.toLowerCase()))
    .sort((a,b)=>new Date(b.date||0)-new Date(a.date||0))

  const markPaid=async(id)=>{
    const updated=invoices.map(i=>i.id===id?{...i,status:"paid"}:i)
    setInvoices(updated)
    await saveLocal("ll_quote_invoices",updated)
  }

  const generateInvoice=(inv)=>{
    const gold=company.primaryColor||"#C8912A"
    const tmpl=company.invoiceTemplate||"classic"
    const tmplStyles={
      classic:`body{font-family:Arial,sans-serif}.inv-badge{background:#F5F0E4;padding:6px 14px;border-radius:6px;display:inline-block;color:${gold};font-weight:600}`,
      modern:`body{font-family:'Helvetica Neue',Arial,sans-serif}.header{background:${gold};color:#fff;padding:24px;margin:-36px -36px 24px}.header .cn{color:#fff!important}.inv-badge{background:rgba(255,255,255,0.2);padding:6px 14px;border-radius:6px;display:inline-block;color:#fff}`,
      minimal:`body{font-family:'Helvetica Neue',Arial,sans-serif;color:#333}.inv-badge{font-size:11px;color:#888;letter-spacing:2px;text-transform:uppercase}`,
      elegant:`body{font-family:Georgia,serif;color:#2a1a0a}.header{text-align:center;border-bottom:1px solid ${gold};padding-bottom:20px;margin-bottom:28px}.cn{font-family:Georgia,serif!important;font-size:26px!important}.inv-badge{border:1px solid ${gold};padding:6px 16px;display:inline-block;font-style:italic;color:${gold};font-size:12px}`,
      bold:`body{font-family:Arial,sans-serif}.header{background:#1a1a1a;color:#fff;padding:24px 28px;margin:-36px -36px 24px}.header .cn{color:${gold}!important}.inv-badge{background:${gold};color:#fff;padding:6px 16px;border-radius:4px;display:inline-block;font-weight:bold}`,
    }[tmpl]||""

    const html="<!DOCTYPE html><html><head><title>"+inv.id+"</title>"
      +"<style>*{margin:0;padding:0;box-sizing:border-box}body{color:#291608;padding:36px;max-width:680px;margin:0 auto}"
      +".header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px}"
      +".cn{font-size:22px;font-weight:700;color:"+gold+"}"
      +".row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #F0EBE3;font-size:13px}"
      +".tier{background:#FFF9EE;border-left:3px solid "+gold+";padding:10px 12px;margin-bottom:8px;border-radius:0 6px 6px 0;font-size:13px}"
      +".price-box{background:#F5F0E4;border-radius:8px;padding:20px;text-align:center;margin:20px 0}"
      +".bank{background:#E8EFFC;border-radius:8px;padding:14px;margin:16px 0}"
      +".terms{font-size:11px;color:#888;margin-top:16px;line-height:1.8;border-top:1px solid #E0D3BB;padding-top:12px}"
      +"@media print{.no-print{display:none}}"
      +tmplStyles+"</style></head><body>"
      +"<div class='header'>"
      +(company.logo?"<img src='"+company.logo+"' style='height:55px;display:block;margin-bottom:6px'/>":"")
      +"<div><div class='cn'>"+(company.name||"Bakery")+"</div>"
      +(company.tagline?"<div style='font-size:12px;color:#888;margin-top:2px'>"+company.tagline+"</div>":"")
      +(company.phone?"<div style='font-size:12px;color:#888;margin-top:4px'>"+company.phone+"</div>":"")
      +(company.email?"<div style='font-size:12px;color:#888'>"+company.email+"</div>":"")
      +(company.address?"<div style='font-size:12px;color:#888'>"+company.address+"</div>":"")
      +"</div>"
      +"<div style='text-align:right'>"
      +"<div style='font-size:28px;font-weight:700;color:#E0D3BB'>INVOICE</div>"
      +"<div class='inv-badge' style='margin-top:6px'>"+inv.id+"</div>"
      +"<div style='font-size:12px;color:#888;margin-top:8px'>Date: <strong>"+(inv.date||"")+"</strong></div>"
      +(inv.deliveryDate?"<div style='font-size:12px;color:#888'>Delivery: <strong>"+inv.deliveryDate+"</strong></div>":"")
      +"</div></div>"
      +"<div style='display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:24px'>"
      +"<div><div style='font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:6px;font-weight:600'>Bill To</div>"
      +"<div style='font-size:16px;font-weight:700'>"+inv.clientName+"</div>"
      +(inv.clientPhone?"<div style='font-size:13px;color:#555;margin-top:3px'>"+inv.clientPhone+"</div>":"")
      +"</div></div>"
      +"<div style='font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#888;border-bottom:2px solid "+gold+";padding-bottom:4px;margin-bottom:12px;font-weight:600'>Order details</div>"
      +"<div class='tier'>"+(inv.cakeSummary||inv.productType||"")+(inv.notes?"<br><span style='color:#888;font-size:12px'>"+inv.notes+"</span>":"")+"</div>"
      +"<div class='price-box'>"
      +"<div style='font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px'>Total amount</div>"
      +"<div style='font-size:36px;font-weight:700;color:"+gold+"'>&#8358;"+(inv.amount||0).toLocaleString()+"</div>"
      +"</div>"
      +(company.bankName?"<div class='bank'><div style='font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#888;font-weight:600;margin-bottom:8px'>Payment details</div>"
        +"<div class='row'><span>Bank</span><span><strong>"+company.bankName+"</strong></span></div>"
        +"<div class='row'><span>Account number</span><span><strong>"+company.bankAccount+"</strong></span></div>"
        +"<div class='row'><span>Account name</span><span>"+company.bankAccountName+"</span></div></div>":"")
      +"<div class='terms'><strong>Terms & Conditions:</strong><br>"
      +"&bull; A 50% non-refundable deposit is required to confirm your order.<br>"
      +"&bull; Balance to be paid on or before collection/delivery.<br>"
      +"&bull; Cake design may slightly differ from inspiration photos.<br>"
      +(company.invoiceFooter?"<br>"+company.invoiceFooter:"")
      +"</div>"
      +"<div class='no-print' style='margin-top:28px;display:flex;gap:10px;justify-content:center'>"
      +"<button onclick='window.print()' style='padding:12px 24px;background:"+gold+";color:#fff;border:none;border-radius:8px;font-size:14px;cursor:pointer;font-weight:600'>📥 Print / Save PDF</button>"
      +(inv.clientPhone?"<button onclick=\"window.open('https://wa.me/"+(inv.clientPhone||"").replace(/[^0-9]/g,"").replace(/^0/,"234")+"?text="+encodeURIComponent("Hello "+inv.clientName+"! 🎂 Your invoice is ready.\n\nInvoice: "+inv.id+"\nAmount: ₦"+(inv.amount||0).toLocaleString()+"\n\nPlease make payment to:\nBank: "+(company.bankName||"")+"\nAccount: "+(company.bankAccount||"")+" ("+(company.bankAccountName||"")+")\n\nThank you for choosing "+(company.name||"Fayvouree Cakes")+"! 🎂")+"','_blank')\" style='padding:12px 24px;background:#25D366;color:#fff;border:none;border-radius:8px;font-size:14px;cursor:pointer;font-weight:600'>📱 Share via WhatsApp</button>":"")
      +"</div>"
      +"<div style='margin-top:16px;font-size:11px;color:#aaa;text-align:center'>"+(company.name||"")+" · Generated by LayerLedger</div>"
      +"</body></html>"

    const w=window.open("","_blank")
    w.document.write(html)
    w.document.close()
  }

  const totalInvoices = invoices.length
  const totalInvoiced = invoices.reduce((s,i)=>s+(i.amount||0), 0)
  const totalOutstanding = invoices.filter(i=>i.status!=="paid").reduce((s,i)=>s+(i.amount||0), 0)

  return <div>
    <SHead title="Invoices" sub="All invoices generated from client quotes."/>

    {invoices.length===0
      ?<Card style={{textAlign:"center",padding:48}}>
        <div style={{fontSize:32,marginBottom:12}}>🧾</div>
        <div style={{fontSize:16,fontWeight:600,marginBottom:8,color:"var(--text)"}}>No invoices yet</div>
        <div style={{fontSize:13,color:"var(--muted)",marginBottom:20}}>Invoices are created from the Quotes page. Open a quote and click "Convert to invoice" to generate one.</div>
      </Card>
      :<>
        {/* Search and filter */}
        <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by client name or invoice number..." style={{...iSt,flex:1,minWidth:200}}/>
          <Tabs tabs={[{v:"all",l:"All"},{v:"unpaid",l:"Unpaid"},{v:"paid",l:"Paid"}]} active={filter} onChange={setFilter}/>
        </div>

        {/* Summary row */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:18}}>
          {[
            {l:"Total invoices",v:totalInvoices,c:"var(--text)"},
            {l:"Total invoiced",v:"₦"+totalInvoiced.toLocaleString(),c:"var(--gold)"},
            {l:"Total outstanding",v:"₦"+totalOutstanding.toLocaleString(),c:"#B03A2E"},
          ].map(s=><Card key={s.l} style={{padding:"12px 16px"}}>
            <div style={{fontSize:10,color:"var(--muted)",textTransform:"uppercase",letterSpacing:.8,marginBottom:4}}>{s.l}</div>
            <div style={{fontSize:18,fontWeight:700,color:s.c}}>{s.v}</div>
          </Card>)}
        </div>

        {/* Invoice list */}
        {filtered.length===0
          ?<div style={{textAlign:"center",padding:32,color:"var(--muted)"}}>No invoices match your search.</div>
          :filtered.map(inv=><Card key={inv.id} style={{marginBottom:10,borderLeft:`4px solid ${inv.status==="paid"?"#357A52":"var(--gold)"}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,flexWrap:"wrap"}}>
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6,flexWrap:"wrap"}}>
                  <span style={{fontFamily:"'Playfair Display',serif",fontSize:15,fontWeight:600}}>{inv.clientName}</span>
                  <span style={{fontSize:11,color:"var(--muted)",background:"var(--bg)",padding:"2px 8px",borderRadius:20}}>{inv.id}</span>
                  <Badge color={inv.status==="paid"?"green":"gold"}>{inv.status==="paid"?"Paid":"Unpaid"}</Badge>
                </div>
                <div style={{fontSize:12.5,color:"var(--muted)",display:"flex",gap:16,flexWrap:"wrap"}}>
                  <span>📅 Date: {inv.date}</span>
                  {inv.deliveryDate&&<span>🚚 Delivery: {inv.deliveryDate}</span>}
                  <span>🧁 {inv.productType||"Cake"}</span>
                </div>
                {inv.notes&&<div style={{fontSize:12,color:"var(--muted)",marginTop:4,fontStyle:"italic"}}>{inv.notes}</div>}
              </div>
              <div style={{textAlign:"right",flexShrink:0}}>
                <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700,color:"var(--gold)",marginBottom:8}}>₦{(inv.amount||0).toLocaleString()}</div>
                <div style={{display:"flex",gap:6,justifyContent:"flex-end",flexWrap:"wrap"}}>
                  <Btn small onClick={()=>generateInvoice(inv)}>🧾 Generate invoice</Btn>
                  {inv.status!=="paid"&&<Btn small variant="success" onClick={()=>markPaid(inv.id)}>✓ Mark paid</Btn>}
                </div>
              </div>
            </div>
          </Card>)}
      </>}
  </div>
}
