/**
 * Purchases.jsx
 * ----------------------------------------------------------------------------
 * Ingredient purchases list.
 * ----------------------------------------------------------------------------
 */
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { Btn, iSt, Inp, Card, SHead, TH, TR2, Spinner, Pagination, Modal } from "../common/ui.jsx"
import { fmt, uid, DEFAULT_CATEGORIES, mapCategory, formatDateDMY, normalizeToIsoDate, isDateInMonth } from "../../lib/helpers.js"
import { saveInventory, saveExpenses, loadLocal, saveLocal, savePurchases, fetchPaginatedPurchases, deletePurchaseFromServer, deletePurchasesFromServer, clearAllPurchasesFromServer, updatePurchaseOnServer } from "../../lib/data.js"
import { Link, Receipt, Trash2, Check, Calendar, AlertCircle, Download, Pencil, Search, X, Lightbulb } from "lucide-react"
import { exportPurchasesPDF } from "../../lib/pdfReportGenerator.js"

const formatMonthLabel = (m) => {
  if (!m || m === "all") return "All Months"
  try {
    const [y, mon] = m.split("-")
    if (y && mon) {
      const d = new Date(Number(y), Number(mon) - 1, 2)
      return d.toLocaleDateString("en-NG", { month: "short", year: "numeric" })
    }
  } catch { }
  return m
}

const ModalComp = Modal || (({ children, title, onClose }) => (
  <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
    <div style={{ background: "var(--panel, #fff)", borderRadius: 14, padding: 24, maxWidth: 560, width: "100%", maxHeight: "90vh", overflowY: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 17, fontWeight: 600, color: "var(--text)" }}>{title}</div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 4 }}>×</button>
      </div>
      {children}
    </div>
  </div>
))

// ═══════════════════════════════════════════════════════════
export function Purchases({ inventory, setInventory, expenses, setExpenses, setView, isOwner, company = {} }) {
  const [showForm, setShowForm] = useState(false)
  const initialPurchases = (typeof loadLocal === "function" ? loadLocal("ll_purchases", []) : []) || []
  const [purchases, setPurchases] = useState(initialPurchases)
  const [totalCount, setTotalCount] = useState(initialPurchases.length)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [loading, setLoading] = useState(false)
  const [searchInput, setSearchInput] = useState("")
  const [appliedSearch, setAppliedSearch] = useState("")
  const [selectedMonth, setSelectedMonth] = useState(() => {
    try {
      const active = sessionStorage.getItem("ll_active_purchases_month")
      if (active) return active
    } catch { }
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
      destination: "inventory",
      date: new Date().toISOString().slice(0, 10)
    }
  ])
  const [deletingAll, setDeletingAll] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [logging, setLogging] = useState(false)
  const [editingPurchase, setEditingPurchase] = useState(null)
  const [savingEdit, setSavingEdit] = useState(false)

  // Fetch paginated slice directly from server/database
  const loadPage = async (searchOverride) => {
    if (typeof fetchPaginatedPurchases !== "function") return
    setLoading(true)
    const activeSearch = searchOverride !== undefined ? searchOverride : appliedSearch
    try {
      const res = await fetchPaginatedPurchases({
        page: currentPage,
        limit: pageSize,
        month: selectedMonth,
        search: activeSearch
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
      let filtered = selectedMonth ? all.filter(p => isDateInMonth(p.date, selectedMonth)) : all
      if (activeSearch) {
        const s = activeSearch.toLowerCase()
        filtered = filtered.filter(p =>
          (p.item && p.item.toLowerCase().includes(s)) ||
          (p.supplier && p.supplier.toLowerCase().includes(s)) ||
          (p.notes && p.notes.toLowerCase().includes(s)) ||
          (p.category && p.category.toLowerCase().includes(s))
        )
      }
      setPurchases(filtered)
      setTotalCount(filtered.length)
    } finally {
      setLoading(false)
    }
  }

  const handleSearchSubmit = (e) => {
    if (e && e.preventDefault) e.preventDefault()
    setAppliedSearch(searchInput.trim())
    setCurrentPage(1)
  }

  const handleClearSearch = () => {
    setSearchInput("")
    setAppliedSearch("")
    setCurrentPage(1)
  }

  useEffect(() => {
    loadPage()
  }, [currentPage, pageSize, selectedMonth, appliedSearch])

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

    // 2. Remove matching legacy purchase expense entries if any
    if (expenses && setExpenses) {
      const selectedPurchasesList = purchases.filter(p => selectedIds.has(p.id))
      const toRemoveNames = new Set(selectedPurchasesList.map(p => p.item).filter(Boolean))
      const updatedExpenses = expenses.filter(e => {
        const isLegacyPurExp = e.source === "purchase" || String(e.description || '').toLowerCase().startsWith("purchase:") || e.purchaseId
        if (!isLegacyPurExp) return true
        if (e.id && selectedIds.has(e.id)) return false
        if (e.purchaseId && selectedIds.has(e.purchaseId)) return false
        if (toRemoveNames.has(e.description) || toRemoveNames.has(e.description?.replace(/^Purchase:\s*/i, ''))) return false
        return true
      })
      if (updatedExpenses.length !== expenses.length) {
        setExpenses(updatedExpenses)
        await saveExpenses(updatedExpenses)
      }
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
        const isLegacyPurExp = e.source === "purchase" || String(e.description || '').toLowerCase().startsWith("purchase:") || e.purchaseId
        if (!isLegacyPurExp) return true
        if (e.id === id || e.purchaseId === id) return false
        if (pItem && (e.description === pItem.item || e.description === `Purchase: ${pItem.item}`)) return false
        return true
      })
      if (updatedExpenses.length !== expenses.length) {
        setExpenses(updatedExpenses)
        await saveExpenses(updatedExpenses)
      }
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
      if (field === "item") {
        if (value === "__new__") {
          copy[idx].isNew = true
          copy[idx].item = "__new__"
          copy[idx].unit = copy[idx].unit || "g"
        } else {
          copy[idx].isNew = false
          copy[idx].item = value
          const it = inventory.find(i => i.id === value)
          if (it) {
            copy[idx].category = it.cat || mapCategory(it.cat, it.name)
            copy[idx].unit = it.unit || ""
          }
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
        isNew: false,
        newItemName: "",
        category: "",
        unit: "",
        unitSize: "",
        qty: "",
        price: "",
        destination: "inventory",
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

  const openEditModal = (pur) => {
    const invItem = inventory.find(i => i.id === pur.itemId)
    setEditingPurchase({
      id: pur.id,
      original: { ...pur },
      item: pur.itemId || "",
      category: invItem?.cat || pur.category || "",
      unitSize: pur.unitSize != null ? String(pur.unitSize) : "",
      qty: pur.qty != null ? String(pur.qty) : "",
      price: pur.price != null ? String(pur.price) : "",
      date: pur.date ? normalizeToIsoDate(pur.date) : new Date().toISOString().slice(0, 10),
      supplier: pur.supplier || "",
      notes: pur.notes || ""
    })
  }

  const updateEditField = (field, value) => {
    setEditingPurchase(prev => {
      if (!prev) return null
      const updated = { ...prev, [field]: value }
      if (field === "item" && value) {
        const it = inventory.find(i => i.id === value)
        if (it) {
          updated.category = it.cat || mapCategory(it.cat, it.name)
        }
      }
      return updated
    })
  }

  const saveEditedPurchase = async () => {
    if (!editingPurchase || savingEdit) return
    const { id, original, item, category, unitSize, qty, price, date, supplier, notes } = editingPurchase

    if (!item || !unitSize || !qty || !price) {
      alert("Item, Pack size, Quantity bought, and Price per pack are required.")
      return
    }

    const parsedUnitSize = parseFloat(unitSize)
    const parsedQty = parseFloat(qty)
    const parsedPrice = parseFloat(price)

    if (isNaN(parsedUnitSize) || parsedUnitSize <= 0 || isNaN(parsedQty) || parsedQty <= 0 || isNaN(parsedPrice) || parsedPrice < 0) {
      alert("Please enter valid positive numbers for Pack size, Quantity, and Price.")
      return
    }

    setSavingEdit(true)
    try {
      const newStockAdded = parseFloat((parsedUnitSize * parsedQty).toFixed(3))
      const newTotal = Math.round(parsedPrice * parsedQty)
      const newCpu = parseFloat((parsedPrice / (parsedUnitSize || 1)).toFixed(2))

      const oldItemId = original.itemId
      const oldStockAdded = Number(original.stockAdded != null ? original.stockAdded : (Number(original.unitSize || 0) * Number(original.qty || 0))) || 0
      const oldTotal = Number(original.total != null ? original.total : (Number(original.price || 0) * Number(original.qty || 0))) || 0
      const oldItemName = original.item || ""

      // 1. Update inventory stock and weighted average cost
      let updInv = [...inventory]
      if (oldItemId && oldItemId === item) {
        const deltaStock = newStockAdded - oldStockAdded
        const deltaValue = newTotal - oldTotal

        updInv = updInv.map(i => {
          if (i.id === item) {
            const curStock = Number(i.stock || 0)
            const curCost = Number(i.cost || 0)
            const curValue = curStock * curCost
            const newStock = Math.max(0, parseFloat((curStock + deltaStock).toFixed(3)))
            const newValue = Math.max(0, parseFloat((curValue + deltaValue).toFixed(2)))
            const newCost = newStock > 0 ? parseFloat((newValue / newStock).toFixed(2)) : curCost
            return {
              ...i,
              stock: newStock,
              cost: newCost,
              cat: category || i.cat
            }
          }
          return i
        })
      } else {
        updInv = updInv.map(i => {
          if (oldItemId && i.id === oldItemId) {
            const curStock = Number(i.stock || 0)
            const curCost = Number(i.cost || 0)
            const curValue = curStock * curCost
            const newStock = Math.max(0, parseFloat((curStock - oldStockAdded).toFixed(3)))
            const newValue = Math.max(0, parseFloat((curValue - oldTotal).toFixed(2)))
            const newCost = newStock > 0 ? parseFloat((newValue / newStock).toFixed(2)) : curCost
            return {
              ...i,
              stock: newStock,
              cost: newCost
            }
          }
          if (i.id === item) {
            const curStock = Number(i.stock || 0)
            const curCost = Number(i.cost || 0)
            const curValue = curStock * curCost
            const newStock = parseFloat((curStock + newStockAdded).toFixed(3))
            const newValue = parseFloat((curValue + newTotal).toFixed(2))
            const newCost = newStock > 0 ? parseFloat((newValue / newStock).toFixed(2)) : curCost
            return {
              ...i,
              stock: newStock,
              cost: newCost,
              cat: category || i.cat
            }
          }
          return i
        })
      }

      setInventory(updInv)
      await saveInventory(updInv)

      // 2. Disconnect: Purchases do not show in expenses. Clean up any legacy linked expense if present.
      if (expenses && setExpenses) {
        const hasLegacyExp = expenses.some(e =>
          (e.id === id) || (e.purchaseId === id) ||
          ((e.source === "purchase" || String(e.description || '').toLowerCase().startsWith("purchase:")) &&
            (e.description === `Purchase: ${oldItemName}` || e.description === oldItemName))
        )
        if (hasLegacyExp) {
          const updatedExpenses = expenses.filter(e =>
            !(e.id === id || e.purchaseId === id ||
              ((e.source === "purchase" || String(e.description || '').toLowerCase().startsWith("purchase:")) &&
                (e.description === `Purchase: ${oldItemName}` || e.description === oldItemName)))
          )
          setExpenses(updatedExpenses)
          await saveExpenses(updatedExpenses)
        }
      }

      // 3. Update purchase record locally and on server
      const selItem = updInv.find(i => i.id === item)
      const updatedPurchaseRecord = {
        ...original,
        id,
        date,
        itemId: item,
        item: selItem?.name || original.item,
        category,
        unit: selItem?.unit || original.unit,
        unitSize: parsedUnitSize,
        qty: parsedQty,
        price: parsedPrice,
        total: newTotal,
        cpu: newCpu,
        stockAdded: newStockAdded,
        supplier: supplier || original.supplier || "Market Run",
        notes: notes || `${selItem?.name || "Ingredient"} — Qty: ${parsedQty} (added: ${newStockAdded})`
      }

      setPurchases(prev => prev.map(p => p.id === id ? updatedPurchaseRecord : p))

      const existingAll = (typeof loadLocal === "function" ? loadLocal("ll_purchases", []) : []) || []
      const mergedPurchases = existingAll.map(p => p.id === id ? updatedPurchaseRecord : p)
      saveLocal("ll_purchases", mergedPurchases)

      if (typeof updatePurchaseOnServer === "function") {
        await updatePurchaseOnServer(id, updatedPurchaseRecord)
      }
      if (typeof savePurchases === "function") {
        await savePurchases(mergedPurchases)
      }

      setEditingPurchase(null)
      await loadPage()
    } catch (err) {
      console.error("Failed to update purchase:", err)
      alert("Error updating purchase: " + (err.message || "Unknown error"))
    } finally {
      setSavingEdit(false)
    }
  }

  const log = async () => {
    if (logging) return
    const invalid = draftPurchases.some(dp => {
      const hasItem = dp.isNew ? (dp.newItemName && dp.newItemName.trim()) : dp.item
      return !hasItem || !dp.category || !dp.unitSize || !dp.qty || !dp.price
    })
    if (invalid) {
      alert("All fields are required for all items")
      return
    }

    setLogging(true)
    try {
      let updInv = [...inventory]
      let newPurchases = []

      for (const dp of draftPurchases) {
        const cpu = dp.price && dp.unitSize ? parseFloat((+dp.price / (+dp.unitSize || 1)).toFixed(2)) : 0
        const total = dp.price && dp.qty ? Math.round(+dp.price * (+dp.qty)) : 0
        const stockAdded = dp.unitSize && dp.qty ? parseFloat(((+dp.unitSize) * (+dp.qty)).toFixed(3)) : 0

        let selItem = null

        if (dp.isNew || dp.item === "__new__") {
          const rawName = (dp.newItemName || "").trim()
          const cleanName = rawName || "New Item"
          const itemUnit = dp.unit || "g"
          const existingItem = updInv.find(i => i.name.toLowerCase() === cleanName.toLowerCase())

          if (existingItem) {
            selItem = existingItem
            const currentStock = Number(existingItem.stock || 0)
            const currentCost = Number(existingItem.cost || 0)
            const currentValue = currentStock * currentCost
            const newStock = parseFloat((currentStock + stockAdded).toFixed(3))
            const newValue = currentValue + total
            const newAvgCost = newStock > 0 ? parseFloat((newValue / newStock).toFixed(2)) : currentCost

            updInv = updInv.map(i => i.id === existingItem.id ? {
              ...i,
              cost: newAvgCost,
              stock: newStock,
              cat: dp.category || i.cat,
              unit: itemUnit || i.unit
            } : i)
          } else {
            const newId = uid()
            selItem = {
              id: newId,
              name: cleanName,
              unit: itemUnit,
              cat: dp.category || "Dry Goods",
              cost: cpu,
              stock: stockAdded,
              minStock: 5,
              on: true
            }
            updInv = [...updInv, selItem]
          }
        } else {
          selItem = updInv.find(i => i.id === dp.item)
          updInv = updInv.map(i => {
            if (i.id === dp.item) {
              const currentStock = Number(i.stock || 0)
              const currentCost = Number(i.cost || 0)
              const currentValue = currentStock * currentCost
              const newStock = parseFloat((currentStock + stockAdded).toFixed(3))
              const newValue = currentValue + total
              const newAvgCost = newStock > 0 ? parseFloat((newValue / newStock).toFixed(2)) : currentCost
              return {
                ...i,
                cost: newAvgCost,
                stock: newStock,
                cat: dp.category || i.cat
              }
            }
            return i
          })
        }

        // Purchases are tracked in Purchases and update inventory stock/cost — NOT in Expenses
        const rec = {
          id: uid(),
          date: dp.date,
          itemId: selItem?.id || dp.item,
          item: selItem?.name || dp.newItemName || "",
          category: dp.category,
          unit: selItem?.unit || dp.unit || "",
          unitSize: +dp.unitSize,
          qty: +dp.qty,
          price: +dp.price,
          total,
          cpu,
          stockAdded,
          destination: dp.destination || "inventory"
        }
        newPurchases = [rec, ...newPurchases]
      }

      setInventory(updInv)
      const existingAll = (typeof loadLocal === "function" ? loadLocal("ll_purchases", []) : []) || []
      const mergedPurchases = [...newPurchases, ...existingAll.filter(e => !newPurchases.some(np => np.id === e.id))]
      setPurchases(prev => [...newPurchases, ...prev])

      await Promise.all([
        saveInventory(updInv),
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
          destination: "inventory",
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
      if (expenses && setExpenses) {
        const updatedExpenses = expenses.filter(e => {
          const isLegacyPurExp = e.source === "purchase" || String(e.description || '').toLowerCase().startsWith("purchase:") || e.purchaseId
          return !isLegacyPurExp
        })
        setExpenses(updatedExpenses)
        await saveExpenses(updatedExpenses)
      }
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
                {dp.isNew ? (
                  <>
                    <div>
                      <Inp label="New Item Name *" value={dp.newItemName || ""} onChange={v => updateDraftPurchaseField(idx, "newItemName", v)} placeholder="e.g. Cocoa Powder" small />
                      <button
                        type="button"
                        onClick={() => updateDraftPurchaseField(idx, "item", "")}
                        style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 10.5, marginTop: 2, padding: 0, textDecoration: "underline" }}
                      >
                        ← Choose existing
                      </button>
                    </div>
                    <div>
                      <label style={{ fontSize: 10.5, color: "var(--muted)", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: .8, fontWeight: 500 }}>Unit *</label>
                      <input
                        type="text"
                        value={dp.unit || ""}
                        onChange={e => updateDraftPurchaseField(idx, "unit", e.target.value)}
                        placeholder="g, kg, ml, pcs"
                        style={{ ...iSt, padding: "5px 8px", fontSize: 12.5 }}
                      />
                    </div>
                  </>
                ) : (
                  <div>
                    <label style={{ fontSize: 10.5, color: "var(--muted)", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: .8, fontWeight: 500 }}>Item *</label>
                    <select value={dp.item} onChange={e => updateDraftPurchaseField(idx, "item", e.target.value)} style={{ ...iSt }}>
                      <option value="">— Select item —</option>
                      <option value="__new__" style={{ fontWeight: 600, color: "var(--gold)" }}>✨ + Add new item (not in inventory)</option>
                      {inventory.map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
                    </select>
                    <button
                      type="button"
                      onClick={() => updateDraftPurchaseField(idx, "item", "__new__")}
                      style={{ background: "none", border: "none", color: "var(--gold)", cursor: "pointer", fontSize: 10.5, marginTop: 2, padding: 0, textDecoration: "underline" }}
                    >
                      + Item not listed? Add new
                    </button>
                  </div>
                )}
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
                <div>
                  <label style={{ fontSize: 10.5, color: "var(--muted)", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: .8, fontWeight: 500 }}>Accounting Routing</label>
                  <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                    {[
                      { id: "inventory", label: "Inventory" },
                      { id: "expense", label: "Expense" },
                      { id: "fixed_asset", label: "PPE Asset" }
                    ].map(r => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => updateDraftPurchaseField(idx, "destination", r.id)}
                        style={{
                          padding: "5px 8px",
                          borderRadius: 6,
                          border: (dp.destination || "inventory") === r.id ? "1px solid var(--gold)" : "1px solid var(--border)",
                          background: (dp.destination || "inventory") === r.id ? "var(--gold)" : "var(--panel)",
                          color: (dp.destination || "inventory") === r.id ? "#fff" : "var(--text)",
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: "pointer"
                        }}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {total >= 50000 && (dp.destination || "inventory") !== "fixed_asset" && (
                <div style={{ background: "#FEF9EE", border: "1px solid var(--gold)", borderRadius: 6, padding: "6px 10px", fontSize: 11.5, color: "#7A5500", marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
                  <Lightbulb size={13} style={{ flexShrink: 0 }} />
                  <span><strong>₦50,000 Threshold (Ruling 8/9):</strong> Total is ₦{total.toLocaleString()}. If this item is bakery equipment, an oven, or machinery (useful life &gt; 1 yr), select <strong>Fixed Asset (PPE)</strong> to capitalise and depreciate over 4–5 years.</span>
                </div>
              )}

              {cpu > 0 && (
                <div style={{ display: "flex", gap: 14, background: "rgba(200, 145, 42, 0.05)", padding: "6px 12px", borderRadius: 6, fontSize: 11.5, flexWrap: "wrap" }}>
                  <div>Total spent: <strong>{fmt(total)}</strong></div>
                  <div>Stock to add: <strong style={{ color: "#357A52" }}>+{stockAdded} {selItem?.unit || dp.unit || ""}</strong></div>
                  <div>New Cost/unit: <strong style={{ color: "var(--gold)" }}>{fmt(cpu)}/{selItem?.unit || dp.unit || "unit"}</strong></div>
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
                destination: "inventory",
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

    {/* Search & Filter Toolbar */}
    <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12, flexWrap: "wrap", justifyContent: "space-between" }}>
      <form onSubmit={handleSearchSubmit} style={{ display: "flex", gap: 6, alignItems: "center", flex: "1 1 280px", maxWidth: 460 }}>
        <div style={{ position: "relative", flex: 1, display: "flex", alignItems: "center" }}>
          <Search size={14} style={{ position: "absolute", left: 10, color: "var(--muted)", pointerEvents: "none" }} />
          <input
            type="text"
            placeholder="Search purchases (item, supplier, notes)..."
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") {
                handleSearchSubmit(e)
              }
            }}
            style={{
              width: "100%",
              padding: "7px 28px 7px 30px",
              border: "1px solid var(--border)",
              borderRadius: 6,
              fontSize: 12.5,
              background: "var(--panel)",
              color: "var(--text)",
              fontFamily: "inherit",
              outline: "none"
            }}
          />
          {searchInput && (
            <button
              type="button"
              onClick={handleClearSearch}
              title="Clear search"
              style={{
                position: "absolute",
                right: 8,
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 2,
                color: "var(--muted)",
                display: "flex",
                alignItems: "center"
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>
        <Btn type="submit" small variant="primary" style={{ display: "inline-flex", alignItems: "center", gap: 4, height: 32 }}>
          <Search size={13} /> Search
        </Btn>
        {appliedSearch && (
          <Btn type="button" small variant="ghost" onClick={handleClearSearch} style={{ height: 32 }}>
            Reset
          </Btn>
        )}
      </form>
      {appliedSearch && (
        <span style={{ fontSize: 12, color: "var(--gold)", fontWeight: 500 }}>
          Filtered by: &ldquo;{appliedSearch}&rdquo; ({totalCount} record{totalCount !== 1 ? "s" : ""})
        </span>
      )}
    </div>

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
        <tbody>{purchases.length === 0 ? <tr><td colSpan={isOwner ? 12 : 10} style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>{loading ? "Loading purchases..." : appliedSearch ? `No purchases matched "${appliedSearch}".` : `No purchases logged for ${formatMonthLabel(selectedMonth)}. Click + Log Purchase or scan a receipt to start.`}</td></tr> :
          paginatedPurchases.map((p, i) => {
            const invItem = inventory.find(item => item.id === p.itemId)
            const displayCat = invItem?.cat || p.category || "—"
            const displayUnit = invItem?.unit || p.unit || ""
            return <TR2 key={`${p.id || 'purch'}-${i}`} i={i} row={[
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
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, background: "#E8EFFC", color: "#2355A0", padding: "2px 8px", borderRadius: 20, fontWeight: 500 }}><Link size={10} /> Updated</span>,
              ...(isOwner ? [
                <div key={`act-${p.id}`} style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  <Btn key={`edit-${p.id}`} small variant="outline" onClick={() => openEditModal(p)} title="Edit purchase" style={{ padding: "3px 6px", display: "inline-flex", alignItems: "center" }}>
                    <Pencil size={11} />
                  </Btn>
                  <Btn key={`del-${p.id}`} small variant="danger" onClick={() => handleDeleteSingle(p.id)} title="Delete purchase" style={{ padding: "3px 6px", display: "inline-flex", alignItems: "center" }}>
                    <Trash2 size={11} />
                  </Btn>
                </div>
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

    {/* Edit Purchase Modal */}
    {editingPurchase && (() => {
      const selItem = inventory.find(i => i.id === editingPurchase.item)
      const calcUnitSize = parseFloat(editingPurchase.unitSize) || 0
      const calcQty = parseFloat(editingPurchase.qty) || 0
      const calcPrice = parseFloat(editingPurchase.price) || 0
      const calcTotal = Math.round(calcPrice * calcQty)
      const calcStockAdded = parseFloat((calcUnitSize * calcQty).toFixed(3))
      const calcCpu = calcUnitSize > 0 ? parseFloat((calcPrice / calcUnitSize).toFixed(2)) : 0
      const unit = selItem?.unit || editingPurchase.original.unit || "unit"

      const origTotal = editingPurchase.original.total || 0
      const origStockAdded = editingPurchase.original.stockAdded || 0
      const diffTotal = calcTotal - origTotal
      const diffStock = parseFloat((calcStockAdded - origStockAdded).toFixed(3))

      return (
        <ModalComp title="Edit Purchase Record" onClose={() => !savingEdit && setEditingPurchase(null)}>
          <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 16, lineHeight: 1.5 }}>
            Update any mistakes in this purchase. Corrected pack size, quantity, or price will automatically adjust your inventory stock level, weighted average cost, and overhead expenses.
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 10.5, color: "var(--muted)", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 600 }}>
                Item Purchased *
              </label>
              <select
                data-testid="edit-purchase-item-select"
                value={editingPurchase.item}
                onChange={e => updateEditField("item", e.target.value)}
                style={{ ...iSt, cursor: "pointer" }}
              >
                <option value="">— Select item —</option>
                {inventory.map(i => (
                  <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: 10.5, color: "var(--muted)", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 600 }}>
                Category *
              </label>
              <select
                data-testid="edit-purchase-category-select"
                value={editingPurchase.category}
                onChange={e => updateEditField("category", e.target.value)}
                style={{ ...iSt, cursor: "pointer" }}
              >
                <option value="">— Select category —</option>
                {categoriesList.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <Inp
              label="Pack size *"
              type="number"
              value={editingPurchase.unitSize}
              onChange={v => updateEditField("unitSize", v)}
              placeholder="e.g. 50"
            />

            <Inp
              label="Qty bought *"
              type="number"
              value={editingPurchase.qty}
              onChange={v => updateEditField("qty", v)}
              placeholder="e.g. 3"
            />

            <Inp
              label="Price / pack (₦) *"
              type="number"
              value={editingPurchase.price}
              onChange={v => updateEditField("price", v)}
              placeholder="e.g. 57000"
            />

            <Inp
              label="Purchase Date"
              type="date"
              value={editingPurchase.date}
              onChange={v => updateEditField("date", v)}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
            <Inp
              label="Supplier / Vendor"
              value={editingPurchase.supplier}
              onChange={v => updateEditField("supplier", v)}
              placeholder="e.g. Market Run / Flour Mills"
            />
            <Inp
              label="Notes (optional)"
              value={editingPurchase.notes}
              onChange={v => updateEditField("notes", v)}
              placeholder="Additional notes"
            />
          </div>

          {/* Real-time Calculation Summary */}
          <div style={{
            background: "#FFF9EE",
            border: "1px solid var(--gold)",
            borderRadius: 8,
            padding: "12px 14px",
            marginBottom: 16
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--gold)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>
              Calculated Impact
            </div>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12.5 }}>
              <div>
                Total Spent: <strong>{fmt(calcTotal)}</strong>
                {diffTotal !== 0 && (
                  <span style={{ fontSize: 11, marginLeft: 6, color: diffTotal > 0 ? "#B03A2E" : "#357A52", fontWeight: 600 }}>
                    ({diffTotal > 0 ? `+${fmt(diffTotal)}` : `-${fmt(Math.abs(diffTotal))}`})
                  </span>
                )}
              </div>
              <div>
                Stock to Add: <strong style={{ color: "#357A52" }}>+{calcStockAdded} {unit}</strong>
                {diffStock !== 0 && (
                  <span style={{ fontSize: 11, marginLeft: 6, color: diffStock > 0 ? "#357A52" : "#B03A2E", fontWeight: 600 }}>
                    ({diffStock > 0 ? `+${diffStock} ${unit}` : `${diffStock} ${unit}`})
                  </span>
                )}
              </div>
              <div>
                New Cost/unit: <strong style={{ color: "var(--gold)" }}>{fmt(calcCpu)}/{unit}</strong>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Btn variant="ghost" disabled={savingEdit} onClick={() => setEditingPurchase(null)}>
              Cancel
            </Btn>
            <Btn
              variant="success"
              loading={savingEdit}
              loadingText="Saving & Updating..."
              onClick={saveEditedPurchase}
              style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
            >
              <Check size={13} /> Save Changes & Update Inventory
            </Btn>
          </div>
        </ModalComp>
      )
    })()}

    <div style={{ marginTop: 8, fontSize: 11.5, color: "var(--muted)" }}>* Cost/unit = Price per pack ÷ Pack size. Updates inventory and starting inventory immediately.</div>
  </div>
}


// ═══════════════════════════════════════════════════════════
//  CREDIT PURCHASES / ACCOUNTS PAYABLE
