/**
 * components/common/ui.jsx
 * ----------------------------------------------------------------------------
 * Small, reusable presentational building blocks used by every screen:
 *   Btn     - styled button with variants (primary/ghost/success/danger/...)
 *   iSt      - shared input style object (also imported by screens)
 *   Inp     - labelled text input
 *   Sel     - labelled <select> dropdown
 *   Card    - white rounded panel
 *   Badge   - small coloured status pill
 *   SHead   - screen heading with title + subtitle
 *   Tabs    - horizontal tab switcher
 *   TH/TR2  - table header row / striped table body row
 *   Steps   - numbered step progress indicator
 *   Spinner - loading spinner
 *   Modal   - centered popup dialog
 *   Alert   - inline coloured message banner
 * ----------------------------------------------------------------------------
 */
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react"

export function Btn({children,onClick,variant="primary",small,full,disabled,style={}}){
  const v={primary:{background:"var(--gold)",color:"#fff",border:"none"},ghost:{background:"transparent",color:"var(--muted)",border:"1px solid var(--border)"},success:{background:"#357A52",color:"#fff",border:"none"},danger:{background:"#B03A2E",color:"#fff",border:"none"},outline:{background:"transparent",color:"var(--gold)",border:"1px solid var(--gold)"},dark:{background:"var(--sidebar)",color:"var(--gold)",border:"none"}}[variant]||{}
  return <button onClick={onClick} disabled={disabled} style={{...v,borderRadius:8,padding:small?"5px 11px":"8px 16px",fontSize:small?12:13.5,fontWeight:500,cursor:disabled?"not-allowed":"pointer",width:full?"100%":"auto",opacity:disabled?0.5:1,fontFamily:"inherit",whiteSpace:"nowrap",flexShrink:0,...style}}>{children}</button>
}
export const iSt = {width:"100%",padding:"8px 10px",borderRadius:8,border:"1px solid var(--border)",background:"var(--panel)",fontSize:13.5,color:"var(--text)",boxSizing:"border-box",outline:"none",fontFamily:"inherit"}
export function Inp({label,value,onChange,type="text",placeholder,small}){return<div style={{marginBottom:11}}>{label&&<label style={{fontSize:10.5,color:"var(--muted)",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:0.8,fontWeight:500}}>{label}</label>}<input type={type} value={value||""} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={{...iSt,fontSize:small?12:13.5}}/></div>}
export function Sel({label,value,onChange,options,placeholder="— Select —"}){return<div style={{marginBottom:11}}>{label&&<label style={{fontSize:10.5,color:"var(--muted)",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:0.8,fontWeight:500}}>{label}</label>}<select value={value||""} onChange={e=>onChange(e.target.value)} style={{...iSt,cursor:"pointer"}}><option value="">{placeholder}</option>{options.map(o=><option key={o.value||o} value={o.value||o}>{o.label||o}</option>)}</select></div>}
export function Card({children,style={}}){return<div style={{background:"var(--panel)",border:"1px solid var(--border)",borderRadius:12,padding:18,...style}}>{children}</div>}
export function Badge({children,color="gray"}){const m={green:["#E5F4EC","#2D7A50"],gold:["#FDF2DC","var(--gold)"],red:["#FDEBE9","#912622"],blue:["#E8EFFC","#2355A0"],purple:["#F0EAFC","#6B32A0"],gray:["#F0EBE3","#6B5B45"]}[color]||["#F0EBE3","#6B5B45"];return<span style={{background:m[0],color:m[1],borderRadius:20,padding:"2px 8px",fontSize:11,fontWeight:500,whiteSpace:"nowrap"}}>{children}</span>}
export function SHead({title,sub}){return<div style={{marginBottom:20}}><h1 style={{fontFamily:"'Playfair Display',serif",fontSize:22,color:"var(--text)",fontWeight:600,margin:0}}>{title}</h1>{sub&&<p style={{color:"var(--muted)",fontSize:13,marginTop:3,marginBottom:0}}>{sub}</p>}</div>}
export function Tabs({tabs,active,onChange}){return<div style={{display:"flex",gap:3,marginBottom:18,background:"var(--border)",borderRadius:10,padding:3,flexWrap:"wrap"}}>{tabs.map(t=><div key={t.v||t} onClick={()=>onChange(t.v||t)} style={{padding:"6px 13px",borderRadius:7,fontSize:12.5,fontWeight:active===(t.v||t)?500:400,cursor:"pointer",background:active===(t.v||t)?"var(--panel)":"transparent",color:active===(t.v||t)?"var(--gold)":"var(--muted)",transition:"all 0.15s"}}>{t.l||t}</div>)}</div>}
export function TH({cols}){return<thead><tr style={{background:"#EDE5D6"}}>{cols.map(c=><th key={c} style={{padding:"8px 10px",textAlign:"left",fontSize:10,textTransform:"uppercase",letterSpacing:0.8,color:"var(--muted)",fontWeight:500,whiteSpace:"nowrap"}}>{c}</th>)}</tr></thead>}
export function TR2({row,i,onClick}){return<tr onClick={onClick} style={{background:i%2===0?"var(--panel)":"#F8F3EA",cursor:onClick?"pointer":"default"}} onMouseEnter={e=>{if(onClick)e.currentTarget.style.background="#F0E9DB"}} onMouseLeave={e=>{if(onClick)e.currentTarget.style.background=i%2===0?"var(--panel)":"#F8F3EA"}}>{row.map((c,j)=><td key={j} style={{padding:"9px 10px",fontSize:13,color:"var(--text)",borderBottom:"1px solid var(--border)"}}>{c}</td>)}</tr>}
export function Steps({steps,cur}){return<div style={{display:"flex",alignItems:"center",gap:4,marginBottom:20,flexWrap:"wrap"}}>{steps.map((s,i)=><div key={s} style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:22,height:22,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",background:cur>i+1?"#357A52":cur===i+1?"var(--gold)":"var(--border)",color:cur>=i+1?"#fff":"var(--muted)",fontSize:11,fontWeight:700}}>{cur>i+1?"✓":i+1}</div><span style={{fontSize:12,color:cur===i+1?"var(--text)":"var(--muted)",fontWeight:cur===i+1?500:400,marginRight:4}}>{s}</span>{i<steps.length-1&&<span style={{color:"var(--border)",marginRight:4}}>›</span>}</div>)}</div>}
export function Spinner(){return<div style={{display:"flex",justifyContent:"center",alignItems:"center",padding:32}}><div style={{width:26,height:26,border:"3px solid var(--border)",borderTopColor:"var(--gold)",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/></div>}
export function Modal({title,children,onClose}){return<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}><div style={{background:"var(--panel)",borderRadius:14,padding:24,maxWidth:560,width:"100%",maxHeight:"90vh",overflowY:"auto"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}><div style={{fontFamily:"'Playfair Display',serif",fontSize:17,fontWeight:600,color:"var(--text)"}}>{title}</div><button onClick={onClose} style={{background:"none",border:"none",fontSize:20,cursor:"pointer",color:"var(--muted)"}}>×</button></div>{children}</div></div>}
export function Alert({msg,color="gold",onClose}){if(!msg)return null;const c={gold:["#FFF9EE","var(--gold)","var(--gold)"],red:["#FDEBE9","#912622","#B03A2E"],green:["#E5F4EC","#2D7A50","#357A52"]}[color]||["#FFF9EE","var(--gold)","var(--gold)"];return<div style={{padding:"10px 14px",background:c[0],color:c[1],borderRadius:8,marginBottom:12,fontSize:13,display:"flex",justifyContent:"space-between",alignItems:"center"}}><span>{msg}</span>{onClose&&<button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:c[2],fontWeight:700,marginLeft:8}}>×</button>}</div>}
