/**
 * Invoices.jsx
 * ----------------------------------------------------------------------------
 * Invoice list + PDF/WhatsApp share.
 * Generates a printable invoice window with a Share button.
 * ----------------------------------------------------------------------------
 */
import React, { useState, useEffect, useMemo } from "react"
import { Btn, iSt, Card, Badge, SHead, Tabs, Spinner, Pagination } from "../common/ui.jsx"
import { loadLocal, saveLocal } from "../../lib/data.js"
import { Receipt, Trash2, Calendar, Truck, Cake, Check, Zap, Clock } from "lucide-react"

export function Invoices({productions,company,prefillProd,setPrefillProd,isOwner}){
  const loadInvs=()=>{return loadLocal("ll_quote_invoices",[])}
  const [invoices,setInvoices]=useState(loadInvs)
  const [search,setSearch]=useState("")
  const [filter,setFilter]=useState("all")
  const [deletingAll, setDeletingAll] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [selectedIds, setSelectedIds] = useState(new Set())

  const handleSelectRowToggle = (id) => {
    setSelectedIds(p => {
      const copy = new Set(p)
      if (copy.has(id)) copy.delete(id)
      else copy.add(id)
      return copy
    })
  }

  const handleSelectAllToggle = () => {
    const allSelected = filtered.length > 0 && filtered.every(inv => selectedIds.has(inv.id))
    setSelectedIds(p => {
      const copy = new Set(p)
      if (allSelected) {
        filtered.forEach(inv => copy.delete(inv.id))
      } else {
        filtered.forEach(inv => copy.add(inv.id))
      }
      return copy
    })
  }

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return
    const count = selectedIds.size
    if (!window.confirm(`Are you sure you want to delete the ${count} selected invoice${count !== 1 ? "s" : ""}? This cannot be undone.`)) return
    const updated = invoices.filter(inv => !selectedIds.has(inv.id))
    setInvoices(updated)
    await saveLocal("ll_quote_invoices", updated)
    setSelectedIds(new Set())
  }

  const handleDeleteSingle = async (id) => {
    if (!window.confirm("Are you sure you want to delete this invoice?")) return
    const updated = invoices.filter(inv => inv.id !== id)
    setInvoices(updated)
    await saveLocal("ll_quote_invoices", updated)
    setSelectedIds(p => {
      const copy = new Set(p)
      copy.delete(id)
      return copy
    })
  }

  useEffect(() => {
    setCurrentPage(1)
  }, [search, filter])

  const handleDeleteAll = async () => {
    if (!window.confirm("Are you sure you want to delete ALL invoices? This will clear all invoice records permanently. This cannot be undone.")) return
    setDeletingAll(true)
    try {
      setInvoices([])
      await saveLocal("ll_quote_invoices", [])
      setSelectedIds(new Set())
    } catch (err) {
      alert("Failed to delete invoices: " + err.message)
    } finally {
      setDeletingAll(false)
    }
  }

  // Reload when component mounts
  useEffect(()=>{ setInvoices(loadInvs()) },[])

  const filtered=invoices
    .filter(inv=>filter==="all"||(filter==="paid" ? inv.status==="paid" : inv.status!=="paid"))
    .filter(inv=>!search||inv.clientName?.toLowerCase().includes(search.toLowerCase())||inv.id?.toLowerCase().includes(search.toLowerCase()))
    .sort((a,b)=>new Date(b.date||0)-new Date(a.date||0))

  const paginatedInvoices = useMemo(() => {
    if (pageSize === "all") return filtered
    const sz = Number(pageSize) || 10
    const start = (currentPage - 1) * sz
    return filtered.slice(start, start + sz)
  }, [filtered, currentPage, pageSize])


  const markPaid=async(id)=>{
    const updated=invoices.map(i=>i.id===id?{...i,status:"paid",paymentType:"full",remainingAmount:0,depositedAmount:i.amount}:i)
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

    const tenantInfo = loadLocal("ll_tenant_info", {})
    const isPremiumOrStudio = (tenantInfo?.plan === "premium" || tenantInfo?.plan === "studio") && (!tenantInfo?.planExpiresAt || new Date(tenantInfo.planExpiresAt) > new Date())
    const watermark = isPremiumOrStudio ? "" : " · Generated by BakeWealth"

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
      +(inv.items && inv.items.length > 0
        ? inv.items.map((it, idx) => {
            const delivText = it.deliveryDetailsText || (it.sameDeliveryAsFirst ? `Same as above (${inv.items[0]?.deliveryDate || inv.deliveryDate || ""})` : (it.deliveryDate ? `${it.deliveryDate}${it.collectionTime ? " @ " + it.collectionTime : ""}` : (inv.deliveryDate || "Date not set")))
            const thumb = it.photos?.[0] || it.photo
            const imgTag = thumb ? `<div style='margin:6px 0'><img src='${thumb}' style='height:75px;border-radius:6px;border:1px solid #E3D6B3;object-fit:cover'/></div>` : ""
            const content = it.type === "cake"
              ? (it.tiers || []).map((t, ti) => {
                  const tThumb = (t.photos && t.photos.length > 0) ? t.photos[0] : t.photo
                  const tImg = tThumb ? `<div style='margin:4px 0'><img src='${tThumb}' style='height:65px;border-radius:4px;border:1px solid #E3D6B3;object-fit:cover'/></div>` : ""
                  return `<div><strong>Cake ${ti + 1}: ${t.size}" ${t.shape || "Round"}</strong><br>`
                    + tImg
                    + `Flavours: ${t.layers?.map(l => (l.qty > 1 ? l.qty + "× " : "") + l.flavour).filter(Boolean).join(", ") || "—"}<br>`
                    + (t.fillings?.length ? `Fillings: ${t.fillings.map(f => f.type + (f.grams ? ` (${f.grams}g)` : "")).join(", ")}<br>` : "")
                    + `Covering: ${t.coverings?.map(c => c.type).join(" + ") || "—"}</div>`
                }).join("<hr style='border:none;border-top:1px dashed #EDE5D6;margin:6px 0'/>")
              : (it.pastryItems || []).map(p =>
                  `<div>${p.qty}× ${p.flavour || "Pastry"}${p.filling ? ` (${p.filling})` : ""}</div>`
                ).join("")
            const notePart = it.itemNote ? `<div style='font-size:11.5px;color:#777;margin-top:4px'>Note: ${it.itemNote}</div>` : ""
            return `<div class='tier' style='margin-bottom:12px'>`
              + `<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;flex-wrap:wrap;gap:4px'>`
              + `<strong style='font-size:13.5px;color:${gold}'>${it.type === "cake" ? "🎂 " : "🍩 "}${it.name || `Item ${idx + 1}`}</strong>`
              + `<span style='font-size:11px;background:#F5F0E4;padding:2px 8px;border-radius:4px;font-weight:600'>📅 ${delivText}</span>`
              + `</div>`
              + imgTag
              + `<div style='font-size:12px;color:#555;line-height:1.7'>${content}</div>`
              + notePart
              + `</div>`
          }).join("")
        : "<div class='tier'>"+(inv.cakeSummary||inv.productType||"")+(inv.notes?"<br><span style='color:#888;font-size:12px'>"+inv.notes+"</span>":"")+"</div>"
      )
      +"<div class='price-box'>"
      +"<div style='font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px'>Total amount</div>"
      +"<div style='font-size:36px;font-weight:700;color:"+gold+"'>&#8358;"+(inv.amount||0).toLocaleString()+"</div>"
      +"</div>"
      +(inv.status === "paid" || inv.paymentType === "full"
        ? "<div style='margin:16px 0;padding:14px 16px;background:#EEF8F3;border:1px solid #C2E0CF;border-radius:8px;font-size:13px;text-align:left'>"
          + "<div class='row' style='border-bottom:none;padding:4px 0'><span><strong>Payment Status</strong></span><span style='color:#357A52;font-weight:700'>PAID IN FULL</span></div>"
          + "<div class='row' style='border-bottom:none;padding:4px 0'><span>Amount Received</span><span>&#8358;" + (inv.amount || 0).toLocaleString() + " via " + (inv.paymentMethod || "transfer").toUpperCase() + "</span></div>"
          + "</div>"
        : (inv.status === "partially_paid" || inv.paymentType === "advance")
        ? "<div style='margin:16px 0;padding:14px 16px;background:#FFF9EE;border:1px solid #E8D5A3;border-radius:8px;font-size:13px;text-align:left'>"
          + "<div class='row' style='border-bottom:none;padding:4px 0'><span><strong>Payment Status</strong></span><span style='color:#8C5E00;font-weight:700'>DEPOSIT PAID</span></div>"
          + "<div class='row' style='border-bottom:none;padding:4px 0'><span>Deposited Amount</span><span>&#8358;" + (parseFloat(inv.depositedAmount || 0)).toLocaleString() + " via " + (inv.paymentMethod || "transfer").toUpperCase() + "</span></div>"
          + "<div class='row' style='border-bottom:none;padding:8px 0 4px 0;margin-top:6px;border-top:1px dashed #E8D5A3'><span><strong>Remaining Balance</strong></span><span style='color:#B03A2E;font-weight:700'>&#8358;" + (parseFloat(inv.remainingAmount || 0)).toLocaleString() + "</span></div>"
          + "</div>"
        : ""
      )
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
      +"<button onclick='window.print()' style='padding:12px 24px;background:"+gold+";color:#fff;border:none;border-radius:8px;font-size:14px;cursor:pointer;font-weight:600'>Print / Save PDF</button>"
      +(inv.clientPhone?"<button onclick=\"window.open('https://wa.me/"+(inv.clientPhone||"").replace(/[^0-9]/g,"").replace(/^0/,"234")+"?text="+encodeURIComponent("Hello "+inv.clientName+"! Your invoice is ready.\n\nInvoice: "+inv.id+"\nAmount: ₦"+(inv.amount||0).toLocaleString()+"\n\nPlease make payment to:\nBank: "+(company.bankName||"")+"\nAccount: "+(company.bankAccount||"")+" ("+(company.bankAccountName||"")+")\n\nThank you for choosing "+(company.name||"our bakery")+"!")+"','_blank')\" style='padding:12px 24px;background:#25D366;color:#fff;border:none;border-radius:8px;font-size:14px;cursor:pointer;font-weight:600'>Share via WhatsApp</button>":"")
      +"</div>"
      +"<div style='margin-top:16px;font-size:11px;color:#aaa;text-align:center'>"+(company.name||"")+watermark+"</div>"
      +"</body></html>"

    const w=window.open("","_blank")
    w.document.write(html)
    w.document.close()
  }

  const totalInvoices = invoices.length
  const totalInvoiced = invoices.reduce((s,i)=>s+(i.amount||0), 0)
  const totalOutstanding = invoices.reduce((s, i) => {
    if (i.status === "paid") return s
    if (i.status === "partially_paid") return s + (parseFloat(i.remainingAmount) || 0)
    return s + (i.amount || 0)
  }, 0)

  return <div>
    <SHead title="Invoices" sub="All invoices generated from client quotes."/>

    {invoices.length===0
      ?<Card style={{textAlign:"center",padding:48}}>
        <div style={{display:"flex",justifyContent:"center",marginBottom:12,color:"var(--muted)"}}><Receipt size={36}/></div>
        <div style={{fontSize:16,fontWeight:600,marginBottom:8,color:"var(--text)"}}>No invoices yet</div>
        <div style={{fontSize:13,color:"var(--muted)",marginBottom:20}}>Invoices are created from the Quotes page. Open a quote and click "Convert to invoice" to generate one.</div>
      </Card>
      :<>
        {/* Search and filter */}
        <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{display:"flex",gap:10,flex:1,minWidth:200,alignItems:"center",flexWrap:"wrap"}}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by client name or invoice number..." style={{...iSt,flex:1,minWidth:200}}/>
            <Tabs tabs={[{v:"all",l:"All"},{v:"unpaid",l:"Unpaid"},{v:"paid",l:"Paid"}]} active={filter} onChange={setFilter}/>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {filtered.length > 0 && isOwner && (
              <Btn
                small
                variant="outline"
                onClick={handleSelectAllToggle}
                style={{ fontSize: "11.5px", padding: "4px 8px" }}
              >
                {filtered.length > 0 && filtered.every(inv => selectedIds.has(inv.id)) ? "Deselect All" : "Select All"}
              </Btn>
            )}
            {isOwner && (
              deletingAll ? (
                <Spinner />
              ) : (
                <Btn
                  small
                  variant="ghost"
                  disabled={deletingAll}
                  style={{ color: "#B03A2E", borderColor: "#F2DEDE", fontSize: "11.5px", fontWeight: "normal", padding: "4px 8px", display: "inline-flex", alignItems: "center", gap: 5 }}
                  onClick={handleDeleteAll}
                >
                  <Trash2 size={12} /> Clear All Invoices
                </Btn>
              )
            )}
          </div>
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

        {/* Bulk Actions Bar */}
        {selectedIds.size > 0 && (
          <div style={{
            background: "#FFF9EE",
            border: "1px solid var(--gold)",
            borderRadius: 8,
            padding: "10px 16px",
            marginBottom: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap"
          }}>
            <span style={{ fontWeight: 600, fontSize: 13.5 }}>
              {selectedIds.size} invoice{selectedIds.size !== 1 ? "s" : ""} selected
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn small variant="danger" onClick={handleBulkDelete} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <Trash2 size={12} /> Delete Selected ({selectedIds.size})
              </Btn>
              <Btn small variant="ghost" onClick={() => setSelectedIds(new Set())}>
                Clear
              </Btn>
            </div>
          </div>
        )}

        {/* Invoice list */}
        {filtered.length===0
          ?<div style={{textAlign:"center",padding:32,color:"var(--muted)"}}>No invoices match your search.</div>
          :paginatedInvoices.map(inv=><Card key={inv.id} style={{marginBottom:10,borderLeft:`4px solid ${inv.status==="paid"?"#357A52":inv.status==="partially_paid"?"#1D75B0":"var(--gold)"}`, background: selectedIds.has(inv.id) ? "#FFFDF5" : "var(--panel)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,flexWrap:"wrap"}}>
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6,flexWrap:"wrap"}}>
                  {isOwner && (
                    <input
                      type="checkbox"
                      checked={selectedIds.has(inv.id)}
                      onChange={() => handleSelectRowToggle(inv.id)}
                      style={{ cursor: "pointer", width: 16, height: 16, accentColor: "var(--gold)", margin: 0 }}
                    />
                  )}
                  <span style={{fontFamily:"'Playfair Display',serif",fontSize:15,fontWeight:600}}>{inv.clientName}</span>
                  <span style={{fontSize:11,color:"var(--muted)",background:"var(--bg)",padding:"2px 8px",borderRadius:20}}>{inv.id}</span>
                  <Badge color={inv.status === "paid" ? "green" : inv.status === "partially_paid" ? "blue" : "gold"}>{inv.status === "paid" ? "Paid" : inv.status === "partially_paid" ? "Partially Paid" : "Unpaid"}</Badge>
                </div>
                <div style={{fontSize:12.5,color:"var(--muted)",display:"flex",gap:16,flexWrap:"wrap",alignItems:"center"}}>
                  <span style={{display:"inline-flex",alignItems:"center",gap:4}}><Calendar size={12}/> Date: {inv.date}</span>
                  {inv.deliveryDate&&<span style={{display:"inline-flex",alignItems:"center",gap:4}}><Truck size={12}/> Delivery: {inv.deliveryDate}</span>}
                  <span style={{display:"inline-flex",alignItems:"center",gap:4}}><Cake size={12}/> {inv.productType||"Cake"}</span>
                </div>
                {inv.notes&&<div style={{fontSize:12,color:"var(--muted)",marginTop:4,fontStyle:"italic"}}>{inv.notes}</div>}
                
                {/* Payment status and remaining balance display */}
                <div style={{
                  marginTop: 10,
                  padding: "6px 12px",
                  background: inv.status === "paid" ? "#EEF8F3" : inv.status === "partially_paid" ? "#EAF2F8" : "#FDFAF4",
                  borderRadius: 6,
                  display: "inline-flex",
                  gap: 12,
                  fontSize: 12,
                  border: `1px solid ${inv.status === "paid" ? "#C2E0CF" : inv.status === "partially_paid" ? "#B5D6EB" : "#EDE5D6"}`,
                  flexWrap: "wrap",
                  alignItems: "center"
                }}>
                  <span style={{ fontWeight: 600, color: inv.status === "paid" ? "#357A52" : inv.status === "partially_paid" ? "#1D75B0" : "#8C5E00", display: "inline-flex", alignItems: "center", gap: 5 }}>
                    {inv.status === "paid" ? <><Check size={12}/> Full Payment (Paid)</> : (inv.status === "partially_paid" || inv.paymentType === "advance") ? <><Zap size={12}/> Part Payment (Deposit Paid)</> : <><Clock size={12}/> Unpaid</>}
                  </span>
                  {(inv.paymentType === "advance" || inv.status === "partially_paid") && inv.status !== "paid" && (
                    <>
                      <span style={{ width: 1, height: 12, background: inv.status === "partially_paid" ? "#B5D6EB" : "#EDE5D6" }}></span>
                      <span style={{ color: "var(--text)" }}>Deposited: <strong>₦{(parseFloat(inv.depositedAmount || 0)).toLocaleString()}</strong></span>
                      <span style={{ width: 1, height: 12, background: inv.status === "partially_paid" ? "#B5D6EB" : "#EDE5D6" }}></span>
                      <span style={{ color: "#B03A2E", fontWeight: 700 }}>Remaining Balance: ₦{(parseFloat(inv.remainingAmount || 0)).toLocaleString()}</span>
                    </>
                  )}
                </div>
              </div>
              <div style={{textAlign:"right",flexShrink:0}}>
                <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700,color:"var(--gold)",marginBottom:8}}>₦{(inv.amount||0).toLocaleString()}</div>
                <div style={{display:"flex",gap:6,justifyContent:"flex-end",flexWrap:"wrap",alignItems:"center"}}>
                  <Btn small onClick={()=>generateInvoice(inv)} style={{display:"inline-flex",alignItems:"center",gap:5}}><Receipt size={12}/> Generate invoice</Btn>
                  {inv.status!=="paid"&&<Btn small variant="success" onClick={()=>markPaid(inv.id)} style={{display:"inline-flex",alignItems:"center",gap:5}}><Check size={12}/> Mark paid</Btn>}
                  {isOwner && (
                    <Btn small variant="danger" onClick={()=>handleDeleteSingle(inv.id)} title="Delete invoice" style={{display:"inline-flex",alignItems:"center",padding:"5px 7px"}}>
                      <Trash2 size={12}/>
                    </Btn>
                  )}
                </div>
              </div>
            </div>
          </Card>)}

        <Pagination
          currentPage={currentPage}
          totalItems={filtered.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(sz) => {
            setPageSize(sz)
            setCurrentPage(1)
          }}
          pageSizeOptions={[10, 25, 50, 100]}
          itemLabel="invoices"
        />
      </>}
  </div>
}
