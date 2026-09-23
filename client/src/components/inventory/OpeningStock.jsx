import React, { useState, useEffect, useMemo, useCallback } from "react"
import { Btn, Inp, Sel, Card, SHead, iSt, TH, Modal, Pagination } from "../common/ui.jsx"
import { fmt, uid } from "../../lib/helpers.js"
import {
  saveInventory,
  deleteOpeningStockOnServer,
  deleteOpeningStockItemOnServer,
  createOpeningStockOnServer,
  updateOpeningStockItemOnServer,
  lockOpeningStockMonthOnServer,
  syncFromBackend,
  loadOpeningStock,
  saveOpeningStock,
  fetchOpeningStockFromServer,
  migrateLocalStorageOpeningStockToDatabase,
  loadLocal,
  calculateOrderUsages
} from "../../lib/data.js"
import { PackageCheck, AlertTriangle, Lock, Unlock, Plus, Upload, Trash2, Search, Edit3, Check, Calculator, RefreshCw, Download } from "lucide-react"
import { exportOpeningStockPDF } from "../../lib/pdfReportGenerator.js"

// Module-level session tracking: months that have already been loaded/verified from backend in the current browser session
export const sessionSyncedMonths = new Set()

export function OpeningStock({ inventory, setInventory, user, company = {} }) {
  const currentMonthStr = new Date().toISOString().slice(0, 7)
  const curMonthName = new Date().toLocaleDateString("en-NG", { month: "long", year: "numeric" })

  const initialCached = loadOpeningStock(currentMonthStr)
  const hasCachedData = Array.isArray(initialCached) && initialCached.length > 0
  const isAlreadySynced = sessionSyncedMonths.has(currentMonthStr)

  const [items, setItems] = useState(() => (hasCachedData ? initialCached : []))
  const [saved, setSaved] = useState(() => Array.isArray(initialCached) && initialCached.some(it => it.locked))
  const [loading, setLoading] = useState(() => !isAlreadySynced && !hasCachedData)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [showSavedMsg, setShowSavedMsg] = useState(false)
  const [addingItem, setAddingItem] = useState(false)
  const [calcMode, setCalcMode] = useState("manual") // "manual" or "auto"
  const [newItem, setNewItem] = useState({ name: "", unit: "kg", cost: "", openingQty: 0, totalPaid: "", qtyBought: "" })
  const [editCosts, setEditCosts] = useState(false)
  const [loadingAction, setLoadingAction] = useState(null)

  // Bulk import states
  const [showImport, setShowImport] = useState(false)
  const [importStep, setImportStep] = useState(1) // 1 = paste columns, 2 = preview, 3 = done
  const [pasteN, setPasteN] = useState("")
  const [pasteU, setPasteU] = useState("")
  const [pasteQ, setPasteQ] = useState("")
  const [pasteC, setPasteC] = useState("")
  const [importItems, setImportItems] = useState([])
  const [warnMsg, setWarnMsg] = useState("")

  // Search and pagination
  const [searchQuery, setSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [deletingAll, setDeletingAll] = useState(false)

  // Fetch opening stock from PostgreSQL / Neon backend
  const syncAndRefresh = useCallback(async (force = false) => {
    // If already loaded in this session and not forced, keep loaded data instantly without loading again
    if (!force && sessionSyncedMonths.has(currentMonthStr)) {
      return
    }

    const currentCached = loadOpeningStock(currentMonthStr)
    const hasCache = Array.isArray(currentCached) && currentCached.length > 0

    if (!hasCache) {
      setLoading(true)
    } else {
      setRefreshing(true)
    }
    setError(null)

    try {
      // 1. Run safe one-time migration if any legacy localStorage data exists
      await migrateLocalStorageOpeningStockToDatabase()
      // 2. Fetch opening stock directly from backend
      const serverItems = await fetchOpeningStockFromServer(currentMonthStr)
      if (serverItems) {
        setItems(serverItems)
        setSaved(serverItems.some(it => it.locked))
      } else if (!hasCache) {
        const cached = loadOpeningStock(currentMonthStr)
        setItems(cached)
        setSaved(cached.some(it => it.locked))
      }
      sessionSyncedMonths.add(currentMonthStr)
    } catch (err) {
      console.warn("Opening stock sync notice:", err)
      if (!hasCache) {
        setError("Failed to load opening stock from database.")
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [currentMonthStr])

  useEffect(() => {
    syncAndRefresh(false)
  }, [syncAndRefresh])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery])

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items
    const q = searchQuery.toLowerCase()
    return items.filter(item =>
      (item.name || "").toLowerCase().includes(q) ||
      (item.unit || "").toLowerCase().includes(q)
    )
  }, [items, searchQuery])

  const paginatedItems = useMemo(() => {
    if (pageSize === "all") return filteredItems
    const sz = Number(pageSize) || 25
    const start = (currentPage - 1) * sz
    return filteredItems.slice(start, start + sz)
  }, [filteredItems, currentPage, pageSize])

  // Aggregate stats
  const totalVal = useMemo(() => {
    return items.reduce((sum, it) => sum + ((parseFloat(it.cost) || 0) * (parseFloat(it.openingQty) || 0)), 0)
  }, [items])

  // Check last day of month
  const isLastDayOfMonth = () => {
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(today.getDate() + 1)
    return tomorrow.getDate() === 1
  }

  const isLocked = saved
  const isEditable = !isLocked && (isLastDayOfMonth() || editCosts)

  // Inline update handlers
  const updateOSQty = async (id, val) => {
    const qtyVal = parseFloat(val) || 0
    const updated = items.map(item => item.id === id ? { ...item, openingQty: qtyVal } : item)
    setItems(updated)
    if (id && !id.startsWith("os_")) {
      updateOpeningStockItemOnServer(id, { openingQty: qtyVal }).catch(e => console.warn(e))
    }
    await saveOpeningStock(updated, currentMonthStr, saved)

    // Opening stock feeds inventory
    if (inventory && setInventory) {
      const targetItem = items.find(it => it.id === id)
      const targetName = targetItem?.name?.toLowerCase()
      const currentInv = Array.isArray(inventory) ? [...inventory] : []
      const invIdx = currentInv.findIndex(invItem =>
        invItem.id === id ||
        (targetItem?.itemId && invItem.id === targetItem.itemId) ||
        (targetName && invItem.name?.toLowerCase() === targetName)
      )

      let updatedInventory
      if (invIdx >= 0) {
        updatedInventory = currentInv.map((invItem, idx) =>
          idx === invIdx ? { ...invItem, stock: qtyVal } : invItem
        )
      } else if (targetItem) {
        updatedInventory = [
          ...currentInv,
          {
            id: targetItem.itemId || targetItem.id || uid(),
            name: targetItem.name,
            cat: "Dry Goods",
            unit: targetItem.unit || "kg",
            cost: targetItem.cost || 0,
            stock: qtyVal,
            minStock: 5
          }
        ]
      } else {
        updatedInventory = currentInv
      }
      setInventory(updatedInventory)
      await saveInventory(updatedInventory)
    }
  }

  const updateOSCost = async (id, val) => {
    const costVal = parseFloat(val) || 0
    const updated = items.map(item => item.id === id ? { ...item, cost: costVal } : item)
    setItems(updated)
    if (id && !id.startsWith("os_")) {
      updateOpeningStockItemOnServer(id, { cost: costVal }).catch(e => console.warn(e))
    }
    await saveOpeningStock(updated, currentMonthStr, saved)

    // Opening stock feeds inventory
    if (inventory && setInventory) {
      const targetItem = items.find(it => it.id === id)
      const targetName = targetItem?.name?.toLowerCase()
      const currentInv = Array.isArray(inventory) ? [...inventory] : []
      const invIdx = currentInv.findIndex(invItem =>
        invItem.id === id ||
        (targetItem?.itemId && invItem.id === targetItem.itemId) ||
        (targetName && invItem.name?.toLowerCase() === targetName)
      )
      if (invIdx >= 0) {
        const updatedInventory = currentInv.map((invItem, idx) =>
          idx === invIdx ? { ...invItem, cost: costVal } : invItem
        )
        setInventory(updatedInventory)
        await saveInventory(updatedInventory)
      }
    }
  }

  const updateOSUnit = async (id, val) => {
    const updated = items.map(item => item.id === id ? { ...item, unit: val } : item)
    setItems(updated)
    if (id && !id.startsWith("os_")) {
      updateOpeningStockItemOnServer(id, { unit: val }).catch(e => console.warn(e))
    }
    await saveOpeningStock(updated, currentMonthStr, saved)

    // Opening stock feeds inventory
    if (inventory && setInventory) {
      const targetItem = items.find(it => it.id === id)
      const targetName = targetItem?.name?.toLowerCase()
      const currentInv = Array.isArray(inventory) ? [...inventory] : []
      const invIdx = currentInv.findIndex(invItem =>
        invItem.id === id ||
        (targetItem?.itemId && invItem.id === targetItem.itemId) ||
        (targetName && invItem.name?.toLowerCase() === targetName)
      )
      if (invIdx >= 0) {
        const updatedInventory = currentInv.map((invItem, idx) =>
          idx === invIdx ? { ...invItem, unit: val } : invItem
        )
        setInventory(updatedInventory)
        await saveInventory(updatedInventory)
      }
    }
  }

  const deleteOSItem = async (id) => {
    const it = items.find(x => x.id === id)
    if (!window.confirm(`Remove "${it?.name || 'this item'}" from opening stock?`)) return
    setLoadingAction("deleteItem_" + id)
    try {
      if (id && !id.startsWith("os_")) {
        await deleteOpeningStockItemOnServer(id)
      }
      const updated = items.filter(item => item.id !== id)
      setItems(updated)
      await saveOpeningStock(updated, currentMonthStr, saved)
    } catch (e) {
      alert("Failed to delete opening stock item: " + e.message)
    } finally {
      setLoadingAction(null)
    }
  }

  const handleDeleteAllOpeningStock = async () => {
    if (items.length === 0) {
      alert("Opening stock is already empty.")
      return
    }
    const confirmed = window.confirm(
      "Delete opening stock from the database?\n\nThis will clear all opening stock records."
    )
    if (!confirmed) return

    setDeletingAll(true)
    try {
      await deleteOpeningStockOnServer(currentMonthStr)
      setItems([])
      setSaved(false)
      setCurrentPage(1)
      alert("Opening stock records deleted from database.")
    } catch (e) {
      alert("Failed to delete opening stock: " + e.message)
    } finally {
      setDeletingAll(false)
    }
  }

  const lockStock = async () => {
    setLoadingAction("lockStock")
    try {
      await lockOpeningStockMonthOnServer(currentMonthStr, true)
      setSaved(true)
      setItems(prev => prev.map(it => ({ ...it, locked: true })))
    } catch (e) {
      alert("Failed to lock opening stock: " + e.message)
    } finally {
      setLoadingAction(null)
    }
  }

  const unlockStock = async () => {
    if (!window.confirm("Are you sure you want to unlock the opening stock?")) return
    setLoadingAction("unlockStock")
    try {
      await lockOpeningStockMonthOnServer(currentMonthStr, false)
      setSaved(false)
      setItems(prev => prev.map(it => ({ ...it, locked: false })))
    } catch (e) {
      alert("Failed to unlock opening stock: " + e.message)
    } finally {
      setLoadingAction(null)
    }
  }

  const handleEditCostsToggle = async () => {
    if (editCosts) {
      setLoadingAction("saveCosts")
      try {
        setEditCosts(false)
        await saveOpeningStock(items, currentMonthStr, saved)
      } finally {
        setLoadingAction(null)
      }
    } else {
      setEditCosts(true)
    }
  }

  const saveToDatabase = async () => {
    setLoadingAction("saveSetup")
    try {
      await saveOpeningStock(items, currentMonthStr, saved)
      setShowSavedMsg(true)
      setTimeout(() => setShowSavedMsg(false), 3500)
    } finally {
      setLoadingAction(null)
    }
  }

  // Add Item to Opening Stock
  const addNewItemToOS = async () => {
    let cost = newItem.cost
    if (calcMode === "auto") {
      const price = parseFloat(newItem.totalPaid)
      const qty = parseFloat(newItem.qtyBought)
      if (!newItem.totalPaid || !newItem.qtyBought || isNaN(price) || isNaN(qty) || qty <= 0) {
        alert("Total amount paid and quantity bought must be valid positive numbers.")
        return
      }
      cost = price / qty
    } else {
      cost = parseFloat(cost) || 0
    }
    if (!newItem.name.trim() || !cost) {
      alert("Name and cost are required.")
      return
    }

    setLoadingAction("addNewItem")
    try {
      const openingQty = parseFloat(newItem.openingQty) || 0

      let created = null
      try {
        created = await createOpeningStockOnServer({
          name: newItem.name.trim(),
          unit: newItem.unit,
          cost,
          openingQty,
          month: currentMonthStr,
          locked: saved
        })
      } catch (err) {
        console.warn("createOpeningStockOnServer error, fallback:", err)
      }

      const osItem = created ? {
        id: created.id,
        itemId: created.itemId,
        name: created.name,
        unit: created.unit,
        cost: Number(created.cost) || 0,
        openingQty: Number(created.openingQty) || 0,
        locked: !!created.locked
      } : {
        id: "os_" + uid(),
        name: newItem.name.trim(),
        unit: newItem.unit,
        cost,
        openingQty,
        locked: saved
      }

      const updatedOSItems = [...items, osItem]
      setItems(updatedOSItems)
      await saveOpeningStock(updatedOSItems, currentMonthStr, saved)

      // Feed to inventory: if item exists in inventory, set its stock to openingQty. If not, add new item.
      if (inventory && setInventory) {
        let updatedInventory
        const currentInv = Array.isArray(inventory) ? [...inventory] : []
        const existingIdx = currentInv.findIndex(i =>
          (osItem.itemId && i.id === osItem.itemId) ||
          (i.name && i.name.toLowerCase() === osItem.name.toLowerCase())
        )
        if (existingIdx >= 0) {
          updatedInventory = currentInv.map((invItem, idx) =>
            idx === existingIdx ? { ...invItem, stock: openingQty, cost: cost || invItem.cost, unit: newItem.unit || invItem.unit } : invItem
          )
        } else {
          const newInvId = osItem.itemId || (created && created.itemId) || uid()
          const masterItem = {
            id: newInvId,
            name: newItem.name.trim(),
            cat: "Dry Goods",
            unit: newItem.unit,
            cost,
            stock: openingQty,
            minStock: 5
          }
          updatedInventory = [...currentInv, masterItem]
        }
        setInventory(updatedInventory)
        await saveInventory(updatedInventory)
      }

      setNewItem({ name: "", unit: "kg", cost: "", openingQty: 0, totalPaid: "", qtyBought: "" })
      setCalcMode("manual")
      setAddingItem(false)
    } finally {
      setLoadingAction(null)
    }
  }

  // Bulk paste helpers
  const L = v => v.trim().split(String.fromCharCode(10)).map(s => s.replace(/,/g, "").trim()).filter(Boolean)

  const doPreview = async () => {
    const ns = L(pasteN)
    const us = L(pasteU)
    const qs = L(pasteQ)
    const cs = L(pasteC)

    if (!ns.length) {
      alert("Item names are required.")
      return
    }
    if (qs.length > 0 && qs.length !== ns.length) {
      alert(`Names (${ns.length}) and quantities (${qs.length}) must have the same number of rows.`)
      return
    }
    if (cs.length > 0 && cs.length !== ns.length) {
      alert(`Names (${ns.length}) and costs (${cs.length}) must have the same number of rows.`)
      return
    }

    setLoadingAction("doPreview")
    try {
      const parsed = ns.map((name, i) => {
        const qtyStr = qs[i] || "0"
        const qty = parseFloat(qtyStr.replace(/[^0-9.]/g, "")) || 0
        const costStr = cs[i] || ""
        const cost = parseFloat(costStr.replace(/[^0-9.]/g, "")) || 0
        const match = items.find(it => it.name.trim().toLowerCase() === name.toLowerCase())

        return {
          id: match ? match.id : "os_" + uid(),
          name: match ? match.name : name,
          unit: us[i] || (match ? match.unit : "kg"),
          cost: cs.length > 0 ? cost : (match ? match.cost : 0),
          openingQty: qs.length > 0 ? qty : (match ? match.openingQty : 0),
          isNew: !match,
          on: true
        }
      })

      setImportItems(parsed)
      setImportStep(2)
    } finally {
      setLoadingAction(null)
    }
  }

  const confirmImport = async () => {
    setLoadingAction("confirmImport")
    try {
      const approved = importItems.filter(x => x.on)
      let updatedItems = [...items]
      let updatedInventory = Array.isArray(inventory) ? [...inventory] : []

      for (const app of approved) {
        const idx = updatedItems.findIndex(it => it.id === app.id || it.name.toLowerCase() === app.name.toLowerCase())
        if (idx >= 0) {
          updatedItems[idx] = {
            ...updatedItems[idx],
            unit: app.unit,
            cost: app.cost,
            openingQty: app.openingQty
          }
          const invIdx = updatedInventory.findIndex(it =>
            (updatedItems[idx].itemId && it.id === updatedItems[idx].itemId) ||
            it.id === updatedItems[idx].id ||
            it.name.toLowerCase() === app.name.toLowerCase()
          )
          if (invIdx >= 0) {
            updatedInventory[invIdx] = {
              ...updatedInventory[invIdx],
              unit: app.unit,
              cost: app.cost,
              stock: app.openingQty
            }
          } else {
            updatedInventory.push({
              id: updatedItems[idx].itemId || updatedItems[idx].id || uid(),
              name: app.name,
              cat: "Dry Goods",
              unit: app.unit || "kg",
              cost: app.cost || 0,
              stock: app.openingQty || 0,
              minStock: 5
            })
          }
        } else {
          const newId = app.id || "os_" + uid()
          const osItem = {
            id: newId,
            name: app.name,
            unit: app.unit,
            cost: app.cost,
            openingQty: app.openingQty
          }
          updatedItems.push(osItem)
          const invIdx = updatedInventory.findIndex(it => it.id === newId || it.name.toLowerCase() === app.name.toLowerCase())
          if (invIdx >= 0) {
            updatedInventory[invIdx] = {
              ...updatedInventory[invIdx],
              unit: app.unit,
              cost: app.cost,
              stock: app.openingQty
            }
          } else {
            updatedInventory.push({
              id: newId,
              name: app.name,
              cat: "Dry Goods",
              unit: app.unit || "kg",
              cost: app.cost || 0,
              stock: app.openingQty || 0,
              minStock: 5
            })
          }
        }
      }

      setItems(updatedItems)
      await saveOpeningStock(updatedItems, currentMonthStr, saved)

      if (setInventory) {
        setInventory(updatedInventory)
        await saveInventory(updatedInventory)
      }

      setPasteN("")
      setPasteU("")
      setPasteQ("")
      setPasteC("")
      setImportStep(3)
    } finally {
      setLoadingAction(null)
    }
  }

  return (
    <div>
      <SHead
        title="Opening Stock Table"
        sub="Manage starting inventory balances and baseline stock valuations."
      />

      {/* STAT SUMMARY CARD */}
      <div style={{ marginBottom: 16 }}>
        <Card style={{ padding: "14px 18px", maxWidth: 320 }}>
          <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>
            Total Baseline Valuation
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "var(--gold)" }}>
            {fmt(totalVal)}
          </div>
          <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 2 }}>
            Opening stock asset value
          </div>
        </Card>
      </div>

      {/* TOP CONTROLS & ACTION BAR */}
      <Card style={{ marginBottom: 16, padding: "14px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          {/* Search */}
          <div style={{ flex: 1, minWidth: 220, maxWidth: 360, position: "relative" }}>
            <Search size={15} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
            <input
              type="text"
              placeholder="Search opening stock items..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px 8px 32px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--panel)",
                color: "var(--text)",
                fontSize: 13,
                outline: "none"
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 13 }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <Btn
              small
              variant="outline"
              onClick={() => syncAndRefresh(true)}
              disabled={refreshing || loading}
              title="Refresh opening stock from database"
              style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
            >
              <RefreshCw size={13} style={refreshing ? { animation: "spin 1s linear infinite" } : {}} />
              <span>{refreshing ? "Syncing..." : "Refresh"}</span>
            </Btn>
            <Btn
              small
              variant="outline"
              onClick={() => exportOpeningStockPDF(items, currentMonthStr, totalVal, company)}
              style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
            >
              <Download size={13} /> Download PDF
            </Btn>
            <Btn small onClick={() => setAddingItem(true)}>
              <Plus size={13} /> Add Item
            </Btn>
            <Btn small variant="outline" onClick={() => { setShowImport(true); setImportStep(1); }}>
              <Upload size={13} /> Import Excel
            </Btn>
            <Btn
              small
              variant={editCosts ? "primary" : "outline"}
              onClick={handleEditCostsToggle}
              title="Toggle inline editing of unit costs and units"
            >
              <Edit3 size={13} /> {editCosts ? "Done Editing" : "Edit Costs"}
            </Btn>
            {isLocked ? (
              <Btn small variant="outline" onClick={unlockStock} style={{ color: "#BA7517" }}>
                <Unlock size={13} /> Unlock
              </Btn>
            ) : (
              <Btn small variant="outline" onClick={lockStock} style={{ color: "#2D7A50" }}>
                <Lock size={13} /> Lock Month
              </Btn>
            )}
            {user?.role === "owner" && (
              <Btn small variant="ghost" onClick={handleDeleteAllOpeningStock} disabled={deletingAll} style={{ color: "#B03A2E" }}>
                <Trash2 size={13} /> Clear
              </Btn>
            )}
          </div>
        </div>

        {showSavedMsg && (
          <div style={{ marginTop: 10, padding: "8px 12px", background: "#E5F4EC", color: "#2D7A50", borderRadius: 8, fontSize: 12.5, fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
            <Check size={14} /> Opening stock changes saved successfully to database!
          </div>
        )}
      </Card>

      {/* DATA TABLE */}
      <Card style={{ padding: 0, overflow: "hidden", marginBottom: 16 }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--cream-deep, #F1E8D2)", borderBottom: "1.5px solid var(--border)", textAlign: "left" }}>
                <th style={{ padding: "11px 16px", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6, color: "var(--muted)", width: 45 }}>#</th>
                <th style={{ padding: "11px 16px", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6, color: "var(--muted)" }}>Item Name</th>
                <th style={{ padding: "11px 16px", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6, color: "var(--muted)", width: 100 }}>Unit</th>
                <th style={{ padding: "11px 16px", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6, color: "var(--muted)", width: 130 }}>Unit Cost</th>
                <th style={{ padding: "11px 16px", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6, color: "var(--muted)", width: 140 }}>Opening Qty</th>
                <th style={{ padding: "11px 16px", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6, color: "var(--muted)", width: 140 }}>Total Value</th>
                <th style={{ padding: "11px 16px", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6, color: "var(--muted)", textAlign: "right", width: 70 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "40px 16px", color: "var(--muted)" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                      <RefreshCw size={24} style={{ animation: "spin 1s linear infinite", color: "var(--gold)" }} />
                      <div style={{ fontWeight: 600, color: "var(--text)" }}>Loading opening stock from database...</div>
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "36px 16px", color: "#B03A2E" }}>
                    <AlertTriangle size={24} style={{ margin: "0 auto 8px" }} />
                    <div style={{ fontWeight: 600, marginBottom: 8 }}>{error}</div>
                    <Btn small variant="outline" onClick={syncAndRefresh}>Retry</Btn>
                  </td>
                </tr>
              ) : paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "36px 16px", color: "var(--muted)" }}>
                    <div style={{ fontSize: 24, marginBottom: 8 }}>📦</div>
                    <div style={{ fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>No opening stock items found</div>
                    <div style={{ fontSize: 12 }}>Click "+ Add Item" or "Bulk Paste" above to populate your starting inventory.</div>
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item, idx) => {
                  const itemCost = parseFloat(item.cost) || 0
                  const itemQty = parseFloat(item.openingQty) || 0
                  const itemVal = itemCost * itemQty
                  const globalIdx = (pageSize === "all" ? 0 : (currentPage - 1) * (Number(pageSize) || 25)) + idx + 1

                  return (
                    <tr
                      key={item.id || idx}
                      style={{
                        borderBottom: "1px solid var(--border)",
                        background: idx % 2 === 0 ? "transparent" : "rgba(0,0,0,0.015)",
                        transition: "background 0.15s"
                      }}
                    >
                      <td style={{ padding: "10px 16px", color: "var(--muted)", fontSize: 12 }}>{globalIdx}</td>
                      <td style={{ padding: "10px 16px", fontWeight: 600, color: "var(--text)" }}>{item.name}</td>
                      <td style={{ padding: "10px 16px" }}>
                        {isEditable ? (
                          <input
                            type="text"
                            value={item.unit || ""}
                            onChange={e => updateOSUnit(item.id, e.target.value)}
                            style={{ ...iSt, width: 75, padding: "4px 8px", fontSize: 12 }}
                          />
                        ) : (
                          <span style={{ color: "var(--muted)" }}>{item.unit || "kg"}</span>
                        )}
                      </td>
                      <td style={{ padding: "10px 16px" }}>
                        {isEditable ? (
                          <input
                            type="number"
                            step="any"
                            value={item.cost !== undefined ? item.cost : ""}
                            onChange={e => updateOSCost(item.id, e.target.value)}
                            style={{ ...iSt, width: 100, padding: "4px 8px", fontSize: 12 }}
                          />
                        ) : (
                          <span style={{ fontFamily: "monospace" }}>{fmt(itemCost)}</span>
                        )}
                      </td>
                      <td style={{ padding: "10px 16px" }}>
                        {!isLocked ? (
                          <input
                            type="number"
                            step="any"
                            value={item.openingQty !== undefined ? item.openingQty : ""}
                            onChange={e => updateOSQty(item.id, e.target.value)}
                            style={{ ...iSt, width: 110, padding: "4px 8px", fontSize: 12, fontWeight: 600 }}
                          />
                        ) : (
                          <span style={{ fontWeight: 600 }}>{itemQty} {item.unit}</span>
                        )}
                      </td>
                      <td style={{ padding: "10px 16px", fontWeight: 600, color: "var(--gold)" }}>
                        {fmt(itemVal)}
                      </td>
                      <td style={{ padding: "10px 16px", textAlign: "right" }}>
                        {!isLocked && (
                          <button
                            onClick={() => deleteOSItem(item.id)}
                            title="Remove item from opening stock"
                            style={{ background: "none", border: "none", color: "#B03A2E", cursor: "pointer", padding: 4 }}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}
        <Pagination
          currentPage={currentPage}
          totalItems={filteredItems.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          pageSizeOptions={[10, 25, 50, 100, "all"]}
          itemLabel="items"
        />
      </Card>

      {/* ADD ITEM MODAL */}
      {addingItem && (
        <Modal title="Add Item to Opening Stock" onClose={() => setAddingItem(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Inp
              label="Ingredient / Item Name *"
              value={newItem.name}
              onChange={v => setNewItem(p => ({ ...p, name: v }))}
              placeholder="e.g. Granulated Sugar"
            />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Sel
                label="Measurement Unit *"
                value={newItem.unit}
                onChange={v => setNewItem(p => ({ ...p, unit: v }))}
                options={[
                  { value: "kg", label: "Kilograms (kg)" },
                  { value: "g", label: "Grams (g)" },
                  { value: "L", label: "Litres (L)" },
                  { value: "ml", label: "Millilitres (ml)" },
                  { value: "pcs", label: "Pieces (pcs)" },
                  { value: "tub", label: "Tubs" },
                  { value: "pack", label: "Packs" }
                ]}
              />
              <Inp
                label="Opening Quantity On Hand"
                type="number"
                value={newItem.openingQty}
                onChange={v => setNewItem(p => ({ ...p, openingQty: v }))}
                placeholder="e.g. 25"
              />
            </div>

            {/* Cost calculation mode */}
            <div style={{ marginTop: 4 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--muted)", marginBottom: 6 }}>
                Unit Cost Pricing Mode
              </label>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <Btn
                  small
                  variant={calcMode === "manual" ? "primary" : "outline"}
                  onClick={() => setCalcMode("manual")}
                >
                  Enter Unit Cost Directly
                </Btn>
                <Btn
                  small
                  variant={calcMode === "auto" ? "primary" : "outline"}
                  onClick={() => setCalcMode("auto")}
                >
                  <Calculator size={12} /> Auto-Calculate from Purchase
                </Btn>
              </div>

              {calcMode === "manual" ? (
                <Inp
                  label={`Unit Cost (₦ per ${newItem.unit}) *`}
                  type="number"
                  value={newItem.cost}
                  onChange={v => setNewItem(p => ({ ...p, cost: v }))}
                  placeholder="e.g. 2400"
                />
              ) : (
                <div style={{ background: "#FAF7F0", padding: 10, borderRadius: 8, border: "1px solid var(--border)" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <Inp
                      label="Total Amount Paid (₦)"
                      type="number"
                      value={newItem.totalPaid}
                      onChange={v => setNewItem(p => ({ ...p, totalPaid: v }))}
                      placeholder="e.g. 48000"
                    />
                    <Inp
                      label={`Total Quantity Bought (${newItem.unit})`}
                      type="number"
                      value={newItem.qtyBought}
                      onChange={v => setNewItem(p => ({ ...p, qtyBought: v }))}
                      placeholder="e.g. 20"
                    />
                  </div>
                  {newItem.totalPaid && newItem.qtyBought && parseFloat(newItem.qtyBought) > 0 && (
                    <div style={{ fontSize: 12, color: "var(--gold)", fontWeight: 600, marginTop: 6 }}>
                      → Calculated Cost: {fmt(parseFloat(newItem.totalPaid) / parseFloat(newItem.qtyBought))} per {newItem.unit}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
              <Btn variant="ghost" onClick={() => setAddingItem(false)}>Cancel</Btn>
              <Btn onClick={addNewItemToOS} disabled={loadingAction === "addNewItem"}>
                {loadingAction === "addNewItem" ? "Adding..." : "Add to Opening Stock"}
              </Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* BULK PASTE IMPORT MODAL */}
      {showImport && (
        <Modal title="Bulk Paste Opening Stock from Spreadsheet" onClose={() => setShowImport(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {importStep === 1 && (
              <>
                <div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.6 }}>
                  Copy columns directly from Microsoft Excel, Google Sheets, or CSV and paste them into the respective fields below:
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 4 }}>
                      Item Names * (Column 1)
                    </label>
                    <textarea
                      rows={6}
                      value={pasteN}
                      onChange={e => setPasteN(e.target.value)}
                      placeholder={"Flour\nSugar\nButter"}
                      style={{ ...iSt, height: 110, resize: "vertical", fontFamily: "monospace", fontSize: 12 }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 4 }}>
                      Units (kg, g, L, pcs)
                    </label>
                    <textarea
                      rows={6}
                      value={pasteU}
                      onChange={e => setPasteU(e.target.value)}
                      placeholder={"kg\nkg\nkg"}
                      style={{ ...iSt, height: 110, resize: "vertical", fontFamily: "monospace", fontSize: 12 }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 4 }}>
                      Opening Quantities
                    </label>
                    <textarea
                      rows={6}
                      value={pasteQ}
                      onChange={e => setPasteQ(e.target.value)}
                      placeholder={"50\n25\n10"}
                      style={{ ...iSt, height: 110, resize: "vertical", fontFamily: "monospace", fontSize: 12 }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 4 }}>
                      Unit Costs (₦)
                    </label>
                    <textarea
                      rows={6}
                      value={pasteC}
                      onChange={e => setPasteC(e.target.value)}
                      placeholder={"1800\n2400\n4500"}
                      style={{ ...iSt, height: 110, resize: "vertical", fontFamily: "monospace", fontSize: 12 }}
                    />
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 6 }}>
                  <Btn variant="ghost" onClick={() => setShowImport(false)}>Cancel</Btn>
                  <Btn onClick={doPreview} disabled={loadingAction === "doPreview"}>
                    {loadingAction === "doPreview" ? "Parsing..." : "Preview Import Rows →"}
                  </Btn>
                </div>
              </>
            )}

            {importStep === 2 && (
              <>
                <div style={{ fontSize: 12.5, color: "var(--text)", fontWeight: 500 }}>
                  Review parsed items ({importItems.length} rows):
                </div>
                <div style={{ maxHeight: 240, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 8 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: "#FAF7F0", textAlign: "left" }}>
                        <th style={{ padding: 6 }}>Import</th>
                        <th style={{ padding: 6 }}>Name</th>
                        <th style={{ padding: 6 }}>Unit</th>
                        <th style={{ padding: 6 }}>Cost</th>
                        <th style={{ padding: 6 }}>Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importItems.map((item, idx) => (
                        <tr key={idx} style={{ borderBottom: "1px solid #f0f0f0" }}>
                          <td style={{ padding: 6 }}>
                            <input
                              type="checkbox"
                              checked={item.on}
                              onChange={e => {
                                const on = e.target.checked
                                setImportItems(prev => prev.map((x, i) => i === idx ? { ...x, on } : x))
                              }}
                            />
                          </td>
                          <td style={{ padding: 6, fontWeight: 600 }}>{item.name}</td>
                          <td style={{ padding: 6 }}>{item.unit}</td>
                          <td style={{ padding: 6 }}>{fmt(item.cost)}</td>
                          <td style={{ padding: 6 }}>{item.openingQty}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                  <Btn small variant="ghost" onClick={() => setImportStep(1)}>← Back</Btn>
                  <div style={{ display: "flex", gap: 8 }}>
                    <Btn variant="ghost" onClick={() => setShowImport(false)}>Cancel</Btn>
                    <Btn onClick={confirmImport} disabled={loadingAction === "confirmImport"}>
                      {loadingAction === "confirmImport" ? "Importing..." : "Confirm & Save"}
                    </Btn>
                  </div>
                </div>
              </>
            )}

            {importStep === 3 && (
              <div style={{ textAlign: "center", padding: "16px 0" }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🎉</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>Import Successful!</div>
                <div style={{ fontSize: 12.5, color: "var(--muted)", margin: "6px 0 16px" }}>
                  Your opening stock items have been loaded into the dedicated table.
                </div>
                <Btn onClick={() => setShowImport(false)}>Close Window</Btn>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}
