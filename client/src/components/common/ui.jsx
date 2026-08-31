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

export function Btn({children,onClick,variant="primary",small,full,disabled,loading,loadingText,style={}}){
  const v={primary:{background:"var(--gold)",color:"#fff",border:"none"},ghost:{background:"transparent",color:"var(--muted)",border:"1px solid var(--border)"},success:{background:"#357A52",color:"#fff",border:"none"},danger:{background:"#B03A2E",color:"#fff",border:"none"},outline:{background:"transparent",color:"var(--gold)",border:"1px solid var(--gold)"},dark:{background:"var(--sidebar)",color:"var(--gold)",border:"none"}}[variant]||{}
  return <button onClick={onClick} disabled={disabled || loading} style={{...v,borderRadius:8,padding:small?"5px 11px":"8px 16px",fontSize:small?12:13.5,fontWeight:500,cursor:(disabled || loading)?"not-allowed":"pointer",width:full?"100%":"auto",opacity:(disabled || loading)?0.65:1,fontFamily:"inherit",whiteSpace:"nowrap",flexShrink:0,display:"inline-flex",alignItems:"center",justifyContent:"center",gap:6,...style}}>
    {loading && <span style={{display:"inline-block",width:small?11:13,height:small?11:13,border:"2px solid currentColor",borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.6s linear infinite",flexShrink:0}} />}
    {loading ? (loadingText || children) : children}
  </button>
}
export const iSt = {width:"100%",padding:"8px 10px",borderRadius:8,border:"1px solid var(--border)",background:"var(--panel)",fontSize:13.5,color:"var(--text)",boxSizing:"border-box",outline:"none",fontFamily:"inherit"}
export function Inp({label,value,onChange,type="text",placeholder,small,min}){return<div style={{marginBottom:11}}>{label&&<label style={{fontSize:10.5,color:"var(--muted)",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:0.8,fontWeight:500}}>{label}</label>}<input type={type} value={value||""} onChange={e=>onChange(e.target.value)} placeholder={placeholder} min={min} style={{...iSt,fontSize:small?12:13.5}}/></div>}
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

export function SearchableSelect({ value, onChange, options, placeholder, style = {} }) {
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
    <div ref={ref} style={{ position: "relative", flex: 2, ...style }}>
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
          maxHeight: 200,
          overflowY: "auto",
          zIndex: 1000,
          marginTop: 4,
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)"
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

export function Pagination({
  currentPage = 1,
  totalItems = 0,
  pageSize = 25,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  itemLabel = "items",
  style = {}
}) {
  const isAll = pageSize === "all" || pageSize >= totalItems
  const effectivePageSize = isAll ? Math.max(1, totalItems) : Number(pageSize) || 25
  const totalPages = Math.max(1, Math.ceil(totalItems / effectivePageSize))
  const page = Math.min(Math.max(1, currentPage), totalPages)

  if (totalItems === 0) return null

  const start = isAll ? 1 : (page - 1) * effectivePageSize + 1
  const end = isAll ? totalItems : Math.min(page * effectivePageSize, totalItems)

  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1)
    }
    const pages = []
    pages.push(1)
    if (page > 3) pages.push("...")
    const startPage = Math.max(2, page - 1)
    const endPage = Math.min(totalPages - 1, page + 1)
    for (let p = startPage; p <= endPage; p++) {
      if (!pages.includes(p)) pages.push(p)
    }
    if (page < totalPages - 2) pages.push("...")
    if (!pages.includes(totalPages)) pages.push(totalPages)
    return pages
  }

  const pageNumbers = getPageNumbers()

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      flexWrap: "wrap",
      gap: 12,
      padding: "12px 6px",
      fontSize: 12.5,
      color: "var(--muted)",
      userSelect: "none",
      ...style
    }}>
      {/* Range text */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span>
          Showing <strong>{start}–{end}</strong> of <strong>{totalItems}</strong> {itemLabel}
        </span>
      </div>

      {/* Controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        {onPageSizeChange && (
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontSize: 11.5 }}>Per page:</span>
            <select
              value={isAll ? "all" : effectivePageSize}
              onChange={(e) => {
                const val = e.target.value === "all" ? "all" : Number(e.target.value)
                onPageSizeChange(val)
              }}
              style={{
                ...iSt,
                width: "auto",
                padding: "3px 8px",
                fontSize: 12,
                cursor: "pointer",
                borderRadius: 6
              }}
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt === "all" ? "All" : opt}
                </option>
              ))}
              {!pageSizeOptions.includes("all") && <option value="all">All</option>}
            </select>
          </div>
        )}

        {!isAll && totalPages > 1 && (
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {/* Prev button */}
            <button
              onClick={() => onPageChange && onPageChange(page - 1)}
              disabled={page <= 1}
              style={{
                padding: "4px 8px",
                borderRadius: 6,
                border: "1px solid var(--border)",
                background: page <= 1 ? "transparent" : "var(--panel)",
                color: page <= 1 ? "var(--border)" : "var(--text)",
                cursor: page <= 1 ? "not-allowed" : "pointer",
                fontSize: 12,
                fontFamily: "inherit"
              }}
              title="Previous Page"
            >
              ‹ Prev
            </button>

            {/* Page number buttons */}
            {pageNumbers.map((p, idx) => {
              if (p === "...") {
                return (
                  <span key={`dots-${idx}`} style={{ padding: "0 4px", color: "var(--muted)" }}>
                    …
                  </span>
                )
              }
              const isCurrent = p === page
              return (
                <button
                  key={p}
                  onClick={() => onPageChange && onPageChange(p)}
                  style={{
                    minWidth: 28,
                    height: 28,
                    padding: "0 6px",
                    borderRadius: 6,
                    border: isCurrent ? "1px solid var(--gold)" : "1px solid var(--border)",
                    background: isCurrent ? "var(--gold)" : "var(--panel)",
                    color: isCurrent ? "#fff" : "var(--text)",
                    fontWeight: isCurrent ? 600 : 400,
                    cursor: "pointer",
                    fontSize: 12,
                    fontFamily: "inherit",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                >
                  {p}
                </button>
              )
            })}

            {/* Next button */}
            <button
              onClick={() => onPageChange && onPageChange(page + 1)}
              disabled={page >= totalPages}
              style={{
                padding: "4px 8px",
                borderRadius: 6,
                border: "1px solid var(--border)",
                background: page >= totalPages ? "transparent" : "var(--panel)",
                color: page >= totalPages ? "var(--border)" : "var(--text)",
                cursor: page >= totalPages ? "not-allowed" : "pointer",
                fontSize: 12,
                fontFamily: "inherit"
              }}
              title="Next Page"
            >
              Next ›
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

