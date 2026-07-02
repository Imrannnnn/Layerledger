/**
 * lib/costing.jsx
 * ----------------------------------------------------------------------------
 * Shared revenue / accounting helper functions and the tiny presentational
 * rows used by the financial report screens (P&L, Balance Sheet, etc.):
 *   - loadQuoteRevenue()     read confirmed quotes from storage as revenue rows
 *   - mergeRevenueSources()  merge confirmed-quote revenue with productions
 *   - loadOpeningBalance()   read the balance-sheet opening figures
 *   - PLSection / PLRow      reusable section + line-item rows for statements
 * ----------------------------------------------------------------------------
 */
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { fmt } from "./helpers.js"

export function loadQuoteRevenue(){
  try{
    const qs=JSON.parse(localStorage.getItem("ll_quotes")||"[]")
    return qs
      .filter(q=>q.confirmedAt)
      .map(q=>{
        const isGS=q.orderPurpose==="gift"||q.orderPurpose==="sample"
        return {
        id:q.id,
        quoteId:q.id,
        fromQuote:true,
        client:q.clientName||"",
        clientPhone:q.clientPhone||"",
        deliveryDate:q.deliveryDate||q.date||"",
        orderDate:q.date||"",
        confirmedAt:q.confirmedAt,
        salePrice:isGS?0:+(q.salePrice||q.quotePrice||0),
        cost:+(q.totalCost||0),
        deliveryCost:0,
        productType:q.productType||"Cake",
        orderPurpose:q.orderPurpose||"sale",
        size:q.tiers?.map(t=>t.size+'" '+t.shape).join(" + ")||"",
        covering:q.tiers?.[0]?.coverings?.[0]?.type||"",
        flavors:q.flavourSummary||"",
        cakeSummary:q.cakeSummary||"",
        donutGroups:q.donutGroups||[],
        loaves:q.loaves||[],
        tartQty:q.tartQty||0,
        notes:q.notes||"",
        paymentType:isGS?q.orderPurpose:"full",
        status:"approved",
        margin:q.margin||0,
      }})
  }catch{return[]}
}

// Merge revenue sources — confirmed quotes PRIMARY, old manual productions SECONDARY

export function mergeRevenueSources(productions){
  const quoteRevenue=loadQuoteRevenue()
  const quoteIds=new Set(quoteRevenue.map(q=>q.quoteId))
  // Only include production records that are NOT from the quote flow
  const legacyProds=productions.filter(p=>!p.fromQuote&&!p.quoteId&&!quoteIds.has(p.quoteId))
  return[...quoteRevenue,...legacyProds]
}

// ═══════════════════════════════════════════════════════════
export function loadOpeningBalance(){
  try{return JSON.parse(localStorage.getItem("ll_opening_balance")||"null")}catch{return null}
}

// ═══════════════════════════════════════════════════════════
export function PLSection({title,gold,children}){
  return <div style={{marginBottom:16}}>
    <div style={{fontSize:10.5,textTransform:"uppercase",letterSpacing:1,color:"var(--muted)",fontWeight:600,paddingBottom:6,borderBottom:`2px solid ${gold||"var(--gold)"}`,marginBottom:8}}>{title}</div>
    {children}
  </div>
}

export function PLRow({label,value,indent,bold,color}){
  return <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:bold?"9px 12px":"6px 0",background:bold?"#F5F0E4":"transparent",borderRadius:bold?6:0,borderBottom:bold?"none":"1px solid var(--border)",marginTop:bold?4:0,paddingLeft:indent?16:bold?12:0}}>
    <span style={{fontSize:bold?13.5:12.5,fontWeight:bold?600:400,color:color||"var(--text)"}}>{label}</span>
    <span style={{fontSize:bold?14:12.5,fontWeight:bold?600:400,color:color||"var(--text)"}}>{value}</span>
  </div>
}

// ═══════════════════════════════════════════════════════════
//  P&L STATEMENT
// ═══════════════════════════════════════════════════════════
// ─────────────────────────────────────────────────────────────
//  DATA BRIDGE — confirmed quotes → financial reports
//  This is the single source of truth for revenue.
//  Confirmed quotes (ll_quotes where confirmedAt is set) are used
//  as the primary revenue source. Old manual production records
//  (no quoteId) are included as legacy fallback only.
// ─────────────────────────────────────────────────────────────
