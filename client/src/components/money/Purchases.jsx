/**
 * Purchases.jsx
 * ----------------------------------------------------------------------------
 * Ingredient purchases list.
 * ----------------------------------------------------------------------------
 */
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { Btn, iSt, Inp, Card, SHead, TH, TR2, Spinner, Pagination } from "../common/ui.jsx"
import { fmt, uid, DEFAULT_CATEGORIES, mapCategory, formatDateDMY, normalizeToIsoDate, isDateInMonth } from "../../lib/helpers.js"
import { saveInventory, saveExpenses, loadLocal, saveLocal, savePurchases, fetchPaginatedPurchases, deletePurchaseFromServer, deletePurchasesFromServer, clearAllPurchasesFromServer } from "../../lib/data.js"
import { Link, Receipt, Trash2, Check, Calendar, AlertCircle, Download } from "lucide-react"
import { exportPurchasesPDF } from "../../lib/pdfReportGenerator.js"

const formatMonthLabel = (m) => {
  if (!m || m === "all") return "All Months"
  try {
    const [y, mon] = m.split("-")
    if (y && mon) {
      const d = new Date(Number(y), Number(mon) - 1, 2)
      return d.toLocaleDateString("en-NG", { month: "short", year: "numeric" })
    }
  } catch {}
  return m
}

// ═══════════════════════════════════════════════════════════
export function Purchases({ inventory, setInventory, expenses, setExpenses, setView, isOwner, company = {} }) {
  const [showForm, setShowForm] = useState(false)
  const initialPurchases = (typeof loadLocal === "function" ? loadLocal("ll_purchases", []) : []) || []
  const [purchases, setPurchases] = useState(initialPurchases)
  const [totalCount, setTotalCount] = useState(initialPurchases.length)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [loading, setLoading] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState(() => {
    try {
      const active = sessionStorage.getItem("ll_active_purchases_month")
      if (active) return active
    } catch {}
    return new Date().toISOString().slice(0, 7)
  })
  const [stats, setStats] = useState(() => ({
    totalSpent: initialPurchases.reduce((s, p) => s + (p.total || 0), 0),
    totalPurchases: initialPurchases.length,
    availableMonths: []
  }))
  const [draftPurchases, setDraftPurchases] = useState([
    {
      item: "",
      category: "",
      unit: "",
      unitSize: "",
      qty: "",
      price: "",
      date: new Date().toISOString().slice(0, 10)
    }
  ])
  const [deletingAll, setDeletingAll] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [logging, setLogging] = useState(false)

  // Fetch paginated slice directly from server/database
  const loadPage = async () => {
    if (typeof fetchPaginatedPurchases !== "function") return
    setLoading(true)
    try {
      const res = await fetchPaginatedPurchases({
        page: currentPage,
        limit: pageSize,
        month: selectedMonth
      })
      if (res && res.data) {
        setPurchases(res.data)
        setTotalCount(res.pagination?.total ?? res.total ?? res.data.length)
        if (res.stats) {
          setStats(res.stats)
        } else {
          const totalSpent = res.data.reduce((s, p) => s + (p.total || 0), 0)
          setStats({ totalSpent, totalPurchases: res.pagination?.total ?? res.data.length })
        }
      }
    } catch (err) {
      console.warn("fetchPaginatedPurchases failed, falling back to local:", err)
      const all = (typeof loadLocal === "function" ? loadLocal("ll_purchases", []) : []) || []
      const filtered = selectedMonth ? all.filter(p => isDateInMonth(p.date, selectedMonth)) : all
      setPurchases(filtered)
      setTotalCount(filtered.length)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPage()
  }, [currentPage, pageSize, selectedMonth])

  // Real-time listener for receipt scans and purchase updates
  useEffect(() => {
    const handlePurchasesUpdated = (e) => {
      const targetMonth = e?.detail?.month
      if (targetMonth && targetMonth !== selectedMonth) {
        setSelectedMonth(targetMonth)
        setCurrentPage(1)
      } else {
        loadPage()
      }
    }
    window.addEventListener("layerledger:purchases-updated", handlePurchasesUpdated)
    return () => window.removeEventListener("layerledger:purchases-updated", handlePurchasesUpdated)
  }, [selectedMonth])

  // Aggregate all distinct months that have purchase data
  const availableMonths = useMemo(() => {
    const cur = new Date().toISOString().slice(0, 7)
    const local = (typeof loadLocal === "function" ? loadLocal("ll_purchases", []) : []) || []
    const localDates = local.map(p => (p.date ? normalizeToIsoDate(p.date).slice(0, 7) : null)).filter(Boolean)
    const serverDates = stats?.availableMonths || []
    return [...new Set([cur, ...localDates, ...serverDates])].filter(Boolean).sort().reverse()
  }, [stats?.availableMonths])

  const otherMonthsWithData = useMemo(() => {
    return availableMonths.filter(m => m !== selectedMonth && m !== "all")
  }, [availableMonths, selectedMonth])

  const handleSelectRowToggle = (id) => {
    setSelectedIds(p => {
      const copy = new Set(p)
      if (copy.has(id)) copy.delete(id)
      else copy.add(id)
      return copy
    })
  }

  const handleSelectAllToggle = () => {
    const allSelected = purchases.length > 0 && purchases.every(p => selectedIds.has(p.id))
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(purchases.map(p => p.id)))
    }
  }

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return
    const count = selectedIds.size
    if (!window.confirm(`Are you sure you want to delete the ${count} selected purchase record${count !== 1 ? "s" : ""}?`)) return
    
    const idsToDelete = Array.from(selectedIds)
    // 1. Filter purchases locally
    const updatedPurchases = purchases.filter(p => !selectedIds.has(p.id))
    setPurchases(updatedPurchases)
    await saveLocal("ll_purchases", updatedPurchases)

    // Delete on server
    if (typeof deletePurchasesFromServer === "function") {
      await deletePurchasesFromServer(idsToDelete)
    }

    // 2. Remove matching expense entries
    if (expenses && setExpenses) {
      const selectedPurchasesList = purchases.filter(p => selectedIds.has(p.id))
      const toRemoveNames = new Set(selectedPurchasesList.map(p => p.item).filter(Boolean))
      const updatedExpenses = expenses.filter(e => {
        if (e.source !== "purchase") return true
        if (e.id && selectedIds.has(e.id)) return false
        if (toRemoveNames.has(e.description)) return false
        return true
      })
      setExpenses(updatedExpenses)
      await saveExpenses(updatedExpenses)
    }

    setSelectedIds(new Set())
    await loadPage()
  }

  const handleDeleteSingle = async (id) => {
    if (!window.confirm("Are you sure you want to delete this purchase record?")) return
    const updatedPurchases = purchases.filter(p => p.id !== id)
    setPurchases(updatedPurchases)
    await saveLocal("ll_purchases", updatedPurchases)

    if (typeof deletePurchaseFromServer === "function") {
      await deletePurchaseFromServer(id)
    }

    if (expenses && setExpenses) {
      const pItem = purchases.find(p => p.id === id)
      const updatedExpenses = expenses.filter(e => {
        if (e.source !== "purchase") return true
        if (e.id === id) return false
        if (pItem && e.description === pItem.item) return false
        return true
      })
      setExpenses(updatedExpenses)
      await saveExpenses(updatedExpenses)
    }

    setSelectedIds(p => {
      const copy = new Set(p)
      copy.delete(id)
      return copy
    })
    await loadPage()
  }

  useEffect(() => {
    setCurrentPage(1)
  }, [selectedMonth])


  const customCats = loadLocal("ll_custom_categories", [])
  const categoriesList = useMemo(() => {
    const invCats = inventory.map(i => mapCategory(i.cat, i.name)).filter(Boolean)
    return Array.from(new Set([...DEFAULT_CATEGORIES, ...customCats, ...invCats]))
  }, [customCats, inventory])

  const updateDraftPurchaseField = (idx, field, value) => {
    setDraftPurchases(prev => {
      const copy = [...prev]
      copy[idx] = { ...copy[idx], [field]: value }
      if (field === "item" && value) {
        const it = inventory.find(i => i.id === value)
        if (it) {
          copy[idx].category = it.cat || mapCategory(it.cat, it.name)
          copy[idx].unit = it.unit || ""
        }
      }
      return copy
    })
  }

  const addDraftPurchase = () => {
    const lastRow = draftPurchases[draftPurchases.length - 1]
    setDraftPurchases(p => [
      ...p,
      {
        item: "",
        category: "",
        unit: "",
        unitSize: "",
        qty: "",
        price: "",
        date: lastRow?.date || new Date().toISOString().slice(0, 10)
      }
    ])
  }

  const removeDraftPurchase = (idx) => {
    setDraftPurchases(prev => prev.filter((_, i) => i !== idx))
  }

  const persistPurchases = async (p) => {
    setPurchases(p)
    if (typeof savePurchases === "function") {
      await savePurchases(p)
    } else {
      await saveLocal("ll_purchases", p)
    }
  }

  const log = async () => {
    if (logging) return
    const invalid = draftPurchases.some(dp => !dp.item || !dp.category || !dp.unitSize || !dp.qty || !dp.price)
    if (invalid) {
      alert("All fields are required for all items")
      return
    }

    setLogging(true)
    try {
      let updInv = [...inventory]
      let updExp = [...expenses]
      let newPurchases = []

      for (const dp of draftPurchases) {
        const selItem = updInv.find(i => i.id === dp.item)
        const cpu = dp.price && dp.unitSize ? parseFloat((+dp.price / (+dp.unitSize || 1)).toFixed(2)) : 0
        const total = dp.price && dp.qty ? Math.round(+dp.price * (+dp.qty)) : 0
        const stockAdded = dp.unitSize && dp.qty ? parseFloat(((+dp.unitSize) * (+dp.qty)).toFixed(3)) : 0

        // 1. Update cost/unit in inventory using weighted average cost
        updInv = updInv.map(i => {
          if (i.id === dp.item) {
            const currentStock = Number(i.stock || 0);
            const currentCost = Number(i.cost || 0);
            const currentValue = currentStock * currentCost;
            const newStock = parseFloat((currentStock + stockAdded).toFixed(3));
            const newValue = currentValue + total;
            const newAvgCost = newStock > 0 ? parseFloat((newValue / newStock).toFixed(2)) : currentCost;
            return {
              ...i,
              cost: newAvgCost,
              stock: newStock,
              cat: dp.category || i.cat
            };
          }
          return i;
        });

        // 2. Log as expense with category mapping
        let expCat = "Ingredients / Supplies"
        if (dp.category === "Board and Packaging" || dp.category === "Packaging") {
          expCat = "Packaging"
        } else if (dp.category === "Decoration Extras" || dp.category === "Decorations") {
          expCat = "Decorations"
        }
        const exp = { 
          id: uid(), 
          date: dp.date, 
          description: `Purchase: ${selItem?.name || dp.item}`, 
          amount: total, 
          category: expCat, 
          paymentMethod: "transfer", 
          source: "purchase", 
          notes: `${dp.qty}×${dp.unitSize}${selItem?.unit || ""} @ ₦${(+dp.price).toLocaleString()} — cost/unit updated to ${fmt(cpu)}` 
        }
        updExp = [exp, ...updExp];

        // 3. Log purchase record
        const rec = { 
          id: uid(), 
          date: dp.date, 
          itemId: dp.item, 
          item: selItem?.name || "", 
          category: dp.category, 
          unit: selItem?.unit || "", 
          unitSize: +dp.unitSize, 
          qty: +dp.qty, 
          price: +dp.price, 
          total, 
          cpu, 
          stockAdded 
        }
        newPurchases = [rec, ...newPurchases]
      }

      setInventory(updInv)
      setExpenses(updExp)
      const existingAll = (typeof loadLocal === "function" ? loadLocal("ll_purchases", []) : []) || []
      const mergedPurchases = [...newPurchases, ...existingAll.filter(e => !newPurchases.some(np => np.id === e.id))]
      setPurchases(prev => [...newPurchases, ...prev])

      await Promise.all([
        saveInventory(updInv),
        saveExpenses(updExp),
        typeof savePurchases === "function" ? savePurchases(mergedPurchases) : saveLocal("ll_purchases", mergedPurchases)
      ])
      await loadPage()

      setDraftPurchases([
        {
          item: "",
          category: "",
          unit: "",
          unitSize: "",
          qty: "",
          price: "",
          date: new Date().toISOString().slice(0, 10)
        }
      ])
      setShowForm(false)
    } catch (err) {
      console.error("Failed to log purchases:", err)
      alert("Error saving purchases: " + (err.message || "Unknown error"))
    } finally {
      setLogging(false)
    }
  }

  const paginatedPurchases = purchases
  const monthTotal = stats.totalSpent ?? purchases.reduce((s, p) => s + (p.total || 0), 0)
  const loggedPurchasesCount = stats.totalPurchases ?? totalCount ?? purchases.length
  const itemsUpdatedCount = useMemo(() => {
    return new Set(purchases.map(p => p.itemId)).size
  }, [purchases])

  const handleDeleteAll = async () => {
    if (!window.confirm("Are you sure you want to delete ALL logged purchase records? This will clear the purchase history log and remove corresponding entries in Expenses. (Inventory stock/cost levels will remain). This cannot be undone.")) return
    setDeletingAll(true)
    try {
      if (typeof clearAllPurchasesFromServer === "function") {
        await clearAllPurchasesFromServer()
      } else if (typeof savePurchases === "function") {
        await savePurchases([])
      } else {
        await saveLocal("ll_purchases", [])
      }
      setPurchases([])
      setTotalCount(0)
      setSelectedIds(new Set())
      const updatedExpenses = expenses.filter(e => e.source !== "purchase")
      setExpenses(updatedExpenses)
      await saveExpenses(updatedExpenses)
      await loadPage()
    } catch (err) {
      alert("Failed to delete purchases: " + err.message)
    } finally {
      setDeletingAll(false)
    }
  }

  return <div>
    <SHead title="Purchases" sub="Log every ingredient purchase — cost per unit updates inventory automatically." />
    <div style={{ background: "#E8EFFC", border: "1px solid #B5D4F4", borderRadius: 8, padding: "10px 14px", fontSize: 12.5, color: "#185FA5", marginBottom: 14, lineHeight: 1.7, display: "flex", alignItems: "center", gap: 6 }}>
      <Link size={14} style={{ flexShrink: 0 }} />
      <span>When you log a purchase here, the <strong>Cost/Unit</strong> in your Inventory updates automatically.</span>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 14 }}>
      <Card style={{ padding: "12px 14px" }}><div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>{selectedMonth === "all" ? "All-Time Total" : `${formatMonthLabel(selectedMonth)} Total`}</div><div style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, fontWeight: 700, color: "var(--text)" }}>{fmt(monthTotal)}</div></Card>
      <Card style={{ padding: "12px 14px" }}><div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Purchases logged</div><div style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, fontWeight: 700, color: "var(--text)" }}>{loggedPurchasesCount}</div></Card>
      <Card style={{ padding: "12px 14px" }}><div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Items updated</div><div style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, fontWeight: 700, color: "#357A52" }}>{itemsUpdatedCount}</div></Card>
    </div>

    {purchases.length === 0 && !loading && otherMonthsWithData.length > 0 && selectedMonth !== "all" && (
      <div style={{
        background: "rgba(200,145,42,0.08)",
        border: "1px solid rgba(200,145,42,0.3)",
        borderRadius: 8,
        padding: "10px 14px",
        fontSize: 12.5,
        color: "var(--text)",
        marginBottom: 14,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 10
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <AlertCircle size={16} color="var(--gold)" style={{ flexShrink: 0 }} />
          <span>
            No purchases logged in <strong>{formatMonthLabel(selectedMonth)}</strong>. Recorded purchases exist in:{" "}
            <strong>{otherMonthsWithData.map(formatMonthLabel).join(", ")}</strong>.
          </span>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <Btn
            small
            variant="outline"
            onClick={() => {
              setSelectedMonth(otherMonthsWithData[0])
              setCurrentPage(1)
            }}
          >
            View {formatMonthLabel(otherMonthsWithData[0])} →
          </Btn>
          <Btn
            small
            variant="ghost"
            onClick={() => {
              setSelectedMonth("all")
              setCurrentPage(1)
            }}
          >
            View All Months
          </Btn>
        </div>
      </div>
    )}

    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        {setView && (
          <Btn variant="ghost" onClick={() => setView("receipts")} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <Receipt size={13} /> Go to Receipt Scanner →
          </Btn>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <label style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8 }}>Month:</label>
          <input
            type="month"
            value={selectedMonth === "all" ? "" : selectedMonth}
            onChange={e => {
              if (e.target.value) {
                setSelectedMonth(e.target.value)
                setCurrentPage(1)
              }
            }}
            title="Pick specific month"
            style={{
              padding: "5px 9px",
              border: "1px solid var(--border)",
              borderRadius: 6,
              fontSize: 12.5,
              background: "var(--panel)",
              color: "var(--text)",
              fontFamily: "inherit"
            }}
          />
          <button
            type="button"
            onClick={() => {
              setSelectedMonth(selectedMonth === "all" ? new Date().toISOString().slice(0, 7) : "all")
              setCurrentPage(1)
            }}
            style={{
              padding: "4px 9px",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
              border: "1px solid var(--border)",
              background: selectedMonth === "all" ? "var(--gold)" : "var(--panel)",
              color: selectedMonth === "all" ? "#fff" : "var(--text)"
            }}
          >
            {selectedMonth === "all" ? "✓ All Months" : "All Months"}
          </button>
          {availableMonths.slice(0, 4).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setSelectedMonth(m)
                setCurrentPage(1)
              }}
              style={{
                padding: "4px 8px",
                borderRadius: 6,
                fontSize: 11.5,
                fontWeight: selectedMonth === m ? 600 : 400,
                cursor: "pointer",
                border: "1px solid var(--border)",
                background: selectedMonth === m ? "rgba(200,145,42,0.15)" : "transparent",
                color: selectedMonth === m ? "var(--gold)" : "var(--muted)"
              }}
            >
              {formatMonthLabel(m)}
            </button>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <Btn
          variant="outline"
          onClick={() => exportPurchasesPDF(purchases, selectedMonth, stats, company)}
          style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
        >
          <Download size={13} /> Download PDF
        </Btn>
        {isOwner && paginatedPurchases.length > 0 && (
          <Btn
            variant="danger"
            onClick={handleDeleteAll}
            disabled={deletingAll}
            style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}
          >
            <Trash2 size={12} /> {deletingAll ? "Deleting..." : "Clear History"}
          </Btn>
        )}
        <Btn onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ Log Purchase"}
        </Btn>
      </div>
    </div>

    {showForm && <Card style={{ marginBottom: 14, background: "#FFF9EE", borderColor: "var(--gold)" }}>
      <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Log New Purchases</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 12 }}>
        {draftPurchases.map((dp, idx) => {
          const selItem = inventory.find(i => i.id === dp.item)
          const cpu = dp.price && dp.unitSize ? parseFloat((+dp.price / (+dp.unitSize || 1)).toFixed(2)) : 0
          const total = dp.price && dp.qty ? Math.round(+dp.price * (+dp.qty)) : 0
          const stockAdded = dp.unitSize && dp.qty ? parseFloat(((+dp.unitSize) * (+dp.qty)).toFixed(3)) : 0

          return (
            <div key={idx} style={{ 
              display: "flex", 
              flexDirection: "column", 
              gap: 8, 
              border: "1px solid var(--border)", 
              borderRadius: 8, 
              padding: 12, 
              background: "var(--panel)", 
              position: "relative"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--gold)" }}>Purchase Item #{idx + 1}</span>
                {draftPurchases.length > 1 && (
                  <button 
                    onClick={() => removeDraftPurchase(idx)} 
                    style={{ background: "none", border: "none", color: "#B03A2E", cursor: "pointer", fontSize: 11, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}
                  >
                    <Trash2 size={11} /> Remove Item
                  </button>
                )}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 8 }}>
                <div>
                  <label style={{ fontSize: 10.5, color: "var(--muted)", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: .8, fontWeight: 500 }}>Item *</label>
                  <select value={dp.item} onChange={e => updateDraftPurchaseField(idx, "item", e.target.value)} style={{ ...iSt }}>
                    <option value="">— Select item —</option>
                    {inventory.map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 10.5, color: "var(--muted)", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: .8, fontWeight: 500 }}>Category *</label>
                  <select value={dp.category} onChange={e => updateDraftPurchaseField(idx, "category", e.target.value)} style={{ ...iSt }}>
                    <option value="">— Select category —</option>
                    {categoriesList.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <Inp label="Pack size *" type="number" value={dp.unitSize} onChange={v => updateDraftPurchaseField(idx, "unitSize", v)} placeholder="e.g. 50" small />
                <Inp label="Qty bought *" type="number" value={dp.qty} onChange={v => updateDraftPurchaseField(idx, "qty", v)} placeholder="e.g. 3" small />
                <Inp label="Price / pack (₦) *" type="number" value={dp.price} onChange={v => updateDraftPurchaseField(idx, "price", v)} placeholder="e.g. 57000" small />
                <Inp label="Date" type="date" value={dp.date} onChange={v => updateDraftPurchaseField(idx, "date", v)} small />
              </div>

              {cpu > 0 && (
                <div style={{ display: "flex", gap: 14, background: "rgba(200, 145, 42, 0.05)", padding: "6px 12px", borderRadius: 6, fontSize: 11.5, flexWrap: "wrap" }}>
                  <div>Total spent: <strong>{fmt(total)}</strong></div>
                  <div>Stock to add: <strong style={{ color: "#357A52" }}>+{stockAdded} {selItem?.unit || ""}</strong></div>
                  <div>New Cost/unit: <strong style={{ color: "var(--gold)" }}>{fmt(cpu)}/{selItem?.unit || "unit"}</strong></div>
                </div>
              )}
            </div>
          )
        })}
      </div>
      
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14 }}>
        <Btn variant="outline" onClick={addDraftPurchase} disabled={logging}>+ Add Another Item</Btn>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn
            variant="success"
            onClick={log}
            loading={logging}
            loadingText="Saving & Updating Inventory..."
            disabled={logging}
            style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
          >
            <Check size={13} /> Log {draftPurchases.length} {draftPurchases.length === 1 ? "Purchase" : "Purchases"} & Update Inventory
          </Btn>
          <Btn variant="ghost" disabled={logging} onClick={() => {
            setShowForm(false)
            setDraftPurchases([
              {
                item: "",
                category: "",
                unit: "",
                unitSize: "",
                qty: "",
                price: "",
                date: new Date().toISOString().slice(0, 10)
              }
            ])
          }}>Cancel</Btn>
        </div>
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
          {selectedIds.size} purchase{selectedIds.size !== 1 ? "s" : ""} selected
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

    <Card style={{ padding: 0, overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, opacity: loading ? 0.6 : 1, transition: "opacity 0.2s" }}>
        <TH cols={[
          ...(isOwner ? [
            <input
              key="purch-select-all"
              type="checkbox"
              checked={purchases.length > 0 && purchases.every(p => selectedIds.has(p.id))}
              onChange={handleSelectAllToggle}
              title="Select / Deselect all"
              style={{ cursor: "pointer", width: 16, height: 16, accentColor: "var(--gold)", margin: 0 }}
            />
          ] : []),
          "Date", "Item", "Category", "Unit", "Pack size", "Qty", "Price/pack", "Total", "Cost/unit *", "Status",
          ...(isOwner ? ["Actions"] : [])
        ]} />
        <tbody>{purchases.length === 0 ? <tr><td colSpan={isOwner ? 12 : 10} style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>{loading ? "Loading purchases..." : `No purchases logged for ${formatMonthLabel(selectedMonth)}. Click + Log Purchase or scan a receipt to start.`}</td></tr> :
          paginatedPurchases.map((p, i) => {
            const invItem = inventory.find(item => item.id === p.itemId)
            const displayCat = invItem?.cat || p.category || "—"
            const displayUnit = invItem?.unit || p.unit || ""
            return <TR2 key={p.id} i={i} row={[
              ...(isOwner ? [
                <input
                  key={`cb-${p.id}`}
                  type="checkbox"
                  checked={selectedIds.has(p.id)}
                  onChange={() => handleSelectRowToggle(p.id)}
                  style={{ cursor: "pointer", width: 16, height: 16, accentColor: "var(--gold)" }}
                />
              ] : []),
              <span style={{ color: "var(--muted)", fontSize: 12 }}>{formatDateDMY(p.date)}</span>,
              <span style={{ fontWeight: 500 }}>{p.item}</span>,
              <span style={{ color: "var(--muted)" }}>{displayCat}</span>,
              <span style={{ color: "var(--muted)" }}>{displayUnit}</span>,
              <span>{p.unitSize} {displayUnit}</span>,
              <span>{p.qty}</span>,
              fmt(p.price),
              <span style={{ fontWeight: 500 }}>{fmt(p.total)}</span>,
              <span style={{ color: "var(--gold)", fontWeight: 500 }}>{fmt(p.cpu)}/{displayUnit}</span>,
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, background: "#E8EFFC", color: "#2355A0", padding: "2px 8px", borderRadius: 20, fontWeight: 500 }}><Link size={10}/> Updated</span>,
              ...(isOwner ? [
                <Btn key={`del-${p.id}`} small variant="danger" onClick={() => handleDeleteSingle(p.id)} title="Delete purchase" style={{ padding: "3px 6px", display: "inline-flex", alignItems: "center" }}>
                  <Trash2 size={11} />
                </Btn>
              ] : [])
            ]} />
          })
        }</tbody>
      </table>
    </Card>

    <Pagination
      currentPage={currentPage}
      totalItems={totalCount}
      pageSize={pageSize}
      onPageChange={setCurrentPage}
      onPageSizeChange={(sz) => {
        setPageSize(sz)
        setCurrentPage(1)
      }}
      pageSizeOptions={[10, 25, 50, 100]}
      itemLabel="purchases"
    />

    <div style={{ marginTop: 8, fontSize: 11.5, color: "var(--muted)" }}>* Cost/unit = Price per pack ÷ Pack size. Updates inventory and starting inventory immediately.</div>
  </div>
}


// ═══════════════════════════════════════════════════════════
//  CREDIT PURCHASES / ACCOUNTS PAYABLE
