import React, { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { Btn, Inp, Sel, Card, SHead, iSt, TH, Modal, Pagination } from "../common/ui.jsx"
import { fmt, fmtCost, uid, callClaude, compressImage, extractAndRepairJson } from "../../lib/helpers.js"
import {
  saveInventory,
  deleteOpeningStockOnServer,
  deleteOpeningStockItemOnServer,
  createOpeningStockOnServer,
  updateOpeningStockItemOnServer,
  lockOpeningStockMonthOnServer,
  syncFromBackend,
  loadOpeningStock,
  isOpeningStockLocked,
  saveOpeningStock,
  fetchOpeningStockFromServer,
  migrateLocalStorageOpeningStockToDatabase,
  loadLocal,
  calculateOrderUsages,
  refundScanCredits
} from "../../lib/data.js"
import { PackageCheck, AlertTriangle, Lock, Unlock, Plus, Upload, Trash2, Search, Edit3, Check, Calculator, RefreshCw, Download, Camera, Sparkles, UploadCloud, FileText, X, FileSpreadsheet, Image as ImageIcon } from "lucide-react"
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
  const [saved, setSaved] = useState(() => {
    if (typeof isOpeningStockLocked === "function" && isOpeningStockLocked(currentMonthStr)) return true
    return Array.isArray(initialCached) && initialCached.some(it => it.locked)
  })
  const [loading, setLoading] = useState(() => !isAlreadySynced && !hasCachedData)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [showSavedMsg, setShowSavedMsg] = useState(false)
  const [addingItem, setAddingItem] = useState(false)
  const [calcMode, setCalcMode] = useState("manual") // "manual" or "auto"
  const [newItem, setNewItem] = useState({ name: "", unit: "g", cost: "", openingQty: "", totalPaid: "", qtyBought: "" })
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

  // AI Document/Photo Scan States for Bulk Import
  const [aiFile, setAiFile] = useState(null)
  const [aiScanning, setAiScanning] = useState(false)
  const [aiScanError, setAiScanError] = useState("")
  const [aiScanRefund, setAiScanRefund] = useState("")
  const aiFileInputRef = useRef(null)
  const aiCameraInputRef = useRef(null)

  // Single Item Photo Scan States
  const [scanningItem, setScanningItem] = useState(null)
  const [itemScanFile, setItemScanFile] = useState(null)
  const [itemScanning, setItemScanning] = useState(false)
  const [itemScanError, setItemScanError] = useState("")
  const [itemScanResult, setItemScanResult] = useState(null)
  const itemScanFileRef = useRef(null)
  const itemScanCameraRef = useRef(null)

  // Manual Add Item Photo Scan States
  const [manualScanning, setManualScanning] = useState(false)
  const [manualScanError, setManualScanError] = useState("")
  const manualScanFileRef = useRef(null)

  // Search and pagination
  const [searchQuery, setSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [deletingAll, setDeletingAll] = useState(false)

  // Fetch opening stock from PostgreSQL / Neon backend
  const syncAndRefresh = useCallback(async (force = false) => {
    // If already loaded in this session with data and not forced, keep loaded data instantly without loading again
    if (!force && sessionSyncedMonths.has(currentMonthStr) && items.length > 0) {
      if (typeof isOpeningStockLocked === "function" && isOpeningStockLocked(currentMonthStr)) {
        setSaved(true)
      }
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
        const isLocked = serverItems.some(it => it.locked) || (typeof isOpeningStockLocked === "function" && isOpeningStockLocked(currentMonthStr))
        setSaved(isLocked)
      } else if (!hasCache) {
        const cached = loadOpeningStock(currentMonthStr)
        setItems(cached)
        const isLocked = cached.some(it => it.locked) || (typeof isOpeningStockLocked === "function" && isOpeningStockLocked(currentMonthStr))
        setSaved(isLocked)
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
  }, [currentMonthStr, items.length])

  useEffect(() => {
    syncAndRefresh(false)
  }, [syncAndRefresh])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery])

  // Keep opening stock items in sync with any items present in inventory
  useEffect(() => {
    if (!Array.isArray(inventory) || inventory.length === 0) return
    setItems(prevItems => {
      const currentList = Array.isArray(prevItems) ? prevItems : []
      const existingIds = new Set(currentList.map(it => (it.itemId || it.id || "").toLowerCase()).filter(Boolean))
      const existingNames = new Set(currentList.map(it => (it.name || "").trim().toLowerCase()).filter(Boolean))
      let added = false
      const merged = [...currentList]
      inventory.forEach(invItem => {
        if (!invItem || !invItem.name) return
        const idMatch = invItem.id && (existingIds.has(invItem.id.toLowerCase()) || existingIds.has(("os_" + invItem.id).toLowerCase()))
        const nameMatch = existingNames.has((invItem.name || "").trim().toLowerCase())
        if (!idMatch && !nameMatch) {
          merged.push({
            id: "os_" + invItem.id,
            itemId: invItem.id,
            name: invItem.name,
            unit: invItem.unit || "g",
            cost: invItem.cost === "" || invItem.cost === undefined ? 0 : (parseFloat(invItem.cost) || 0),
            openingQty: invItem.stock === "" || invItem.stock === undefined ? 0 : (parseFloat(invItem.stock) || 0),
            locked: saved
          })
          existingNames.add((invItem.name || "").trim().toLowerCase())
          if (invItem.id) existingIds.add(invItem.id.toLowerCase())
          added = true
        }
      })
      return added ? merged : prevItems
    })
  }, [inventory, saved])

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
    const isBlank = val === "" || val === undefined || val === null
    const qtyVal = isBlank ? 0 : (parseFloat(val) || 0)
    const displayVal = isBlank ? "" : val
    const updated = items.map(item => item.id === id ? { ...item, openingQty: displayVal } : item)
    setItems(updated)
    if (id && !id.startsWith("os_")) {
      try {
        const p = updateOpeningStockItemOnServer(id, { openingQty: qtyVal })
        if (p && typeof p.catch === "function") p.catch(e => console.warn(e))
      } catch (err) {
        console.warn(err)
      }
    }
    const forSaving = updated.map(it => ({ ...it, openingQty: it.openingQty === "" ? 0 : (parseFloat(it.openingQty) || 0) }))
    await saveOpeningStock(forSaving, currentMonthStr, saved)

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
            unit: targetItem.unit || "g",
            cost: targetItem.cost === "" || targetItem.cost === undefined ? 0 : (parseFloat(targetItem.cost) || 0),
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
    const isBlank = val === "" || val === undefined || val === null
    const costVal = isBlank ? 0 : (parseFloat(val) || 0)
    const displayVal = isBlank ? "" : val
    const updated = items.map(item => item.id === id ? { ...item, cost: displayVal } : item)
    setItems(updated)
    if (id && !id.startsWith("os_")) {
      try {
        const p = updateOpeningStockItemOnServer(id, { cost: costVal })
        if (p && typeof p.catch === "function") p.catch(e => console.warn(e))
      } catch (err) {
        console.warn(err)
      }
    }
    const forSaving = updated.map(it => ({ ...it, cost: it.cost === "" ? 0 : (parseFloat(it.cost) || 0) }))
    await saveOpeningStock(forSaving, currentMonthStr, saved)

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
      } else if (targetItem) {
        const rawQty = targetItem.openingQty !== undefined ? targetItem.openingQty : targetItem.qty
        const updatedInventory = [
          ...currentInv,
          {
            id: targetItem.itemId || targetItem.id || uid(),
            name: targetItem.name,
            cat: "Dry Goods",
            unit: targetItem.unit || "g",
            cost: costVal,
            stock: rawQty === "" || rawQty === undefined ? 0 : (parseFloat(rawQty) || 0),
            minStock: 5
          }
        ]
        setInventory(updatedInventory)
        await saveInventory(updatedInventory)
      }
    }
  }

  const updateOSUnit = async (id, val) => {
    const updated = items.map(item => item.id === id ? { ...item, unit: val } : item)
    setItems(updated)
    if (id && !id.startsWith("os_")) {
      try {
        const p = updateOpeningStockItemOnServer(id, { unit: val })
        if (p && typeof p.catch === "function") p.catch(e => console.warn(e))
      } catch (err) {
        console.warn(err)
      }
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
      } else if (targetItem) {
        const rawQty = targetItem.openingQty !== undefined ? targetItem.openingQty : targetItem.qty
        const updatedInventory = [
          ...currentInv,
          {
            id: targetItem.itemId || targetItem.id || uid(),
            name: targetItem.name,
            cat: "Dry Goods",
            unit: val || "g",
            cost: targetItem.cost === "" || targetItem.cost === undefined ? 0 : (parseFloat(targetItem.cost) || 0),
            stock: rawQty === "" || rawQty === undefined ? 0 : (parseFloat(rawQty) || 0),
            minStock: 5
          }
        ]
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
      const openingQty = newItem.openingQty === "" ? 0 : (parseFloat(newItem.openingQty) || 0)

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

      setNewItem({ name: "", unit: "g", cost: "", openingQty: "", totalPaid: "", qtyBought: "" })
      setCalcMode("manual")
      setAddingItem(false)
    } finally {
      setLoadingAction(null)
    }
  }

  // Bulk paste helpers
  const L = v => v.trim().split(String.fromCharCode(10)).map(s => s.trim()).filter(Boolean)

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
        const rawQty = qs[i] || "0"
        const cleanQty = (rawQty.includes(",") && !rawQty.includes("."))
          ? rawQty.replace(/,/g, ".")
          : rawQty.replace(/,/g, "")
        const qty = parseFloat(cleanQty.replace(/[^0-9.]/g, "")) || 0

        const rawCost = cs[i] || ""
        const cleanCost = (rawCost.includes(",") && !rawCost.includes("."))
          ? rawCost.replace(/,/g, ".")
          : rawCost.replace(/,/g, "")
        const cost = parseFloat(cleanCost.replace(/[^0-9.]/g, "")) || 0
        const match = items.find(it => it.name.trim().toLowerCase() === name.toLowerCase())

        return {
          id: match ? match.id : "os_" + uid(),
          name: match ? match.name : name,
          unit: us[i] || (match ? match.unit : "g"),
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
              unit: app.unit || "g",
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
              unit: app.unit || "g",
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

  // AI Document / Photo Scan Handlers for Bulk Import
  const handleAiFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAiScanError("")
    setAiScanRefund("")

    const isPdf = file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf"
    const isImg = file.type.startsWith("image/") || /\.(jpe?g|png|webp|gif|bmp)$/i.test(file.name)

    if (!isPdf && !isImg) {
      setAiScanError("Please select a PDF document (.pdf) or an image photo (.jpg, .png, .webp).")
      return
    }

    const reader = new FileReader()
    reader.onload = (ev) => {
      setAiFile({
        name: file.name,
        size: (file.size / 1024).toFixed(1) + " KB",
        type: isPdf ? "pdf" : "image",
        rawBase64: ev.target.result
      })
    }
    reader.readAsDataURL(file)
  }

  const scanAiInventory = async () => {
    if (!aiFile) return
    setAiScanning(true)
    setAiScanError("")
    setAiScanRefund("")

    try {
      const content = []
      if (aiFile.type === "pdf") {
        const base64Data = aiFile.rawBase64.includes(",") ? aiFile.rawBase64.split(",")[1] : aiFile.rawBase64
        content.push({
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: base64Data
          }
        })
      } else {
        const compressed = await compressImage(aiFile.rawBase64, 1920, 0.88, { enhanceContrast: true })
        content.push({
          type: "image",
          source: {
            type: "base64",
            media_type: "image/jpeg",
            data: compressed
          }
        })
      }

      const promptText = `You are an expert AI inventory and stock-audit specialist for a bakery and cake business.
Analyze this document or photo carefully. The input could be:
1. An inventory list, stock-take sheet, or spreadsheet (printed or PDF).
2. A supplier invoice, receipt, purchase order, or waybill (e.g. from flour mills, supermarket, packaging store).
3. A handwritten inventory sheet, notebook page, or paper stock count.
4. A photo of physical bakery stock, pantry shelves, ingredients (flour sacks, sugar bags, butter, eggs, flavour bottles, boxes, cake boards).
5. A price list or quotation for bakery supplies.

YOUR GOAL: Extract EVERY single distinct ingredient, material, packaging item, or supply item visible in this file.

For each item, extract:
- "name": Clean, standard ingredient/item name (e.g. "Flour", "Granulated Sugar", "Unsalted Butter", "Eggs", "Vanilla Flavour", "10-inch Cake Board", "Cocoa Powder", "Baking Powder").
- "unit": Standard measurement unit. Use "g", "kg", "ml", "l", "pcs", "crate", "carton", "pack", or "bag". Never leave empty. Default dry goods to "g" or "kg", liquids to "ml" or "l", packaging/eggs to "pcs" or "crate".
- "openingQty": Stock quantity or count visible. If it's a photo of physical items, count how many are visible (e.g. 2 sacks -> 2). If not specified or unknown, default to 1.
- "cost": Cost or price per unit (in Nigerian Naira ₦ or number). If an invoice has a total price and quantity, calculate unit price = total / quantity. If cost is not visible or unknown, set cost to 0 so the user can enter it.
- "category": Choose one of: "Dry Goods", "Dairy", "Flavours & Colours", "Packaging", "Decorations", "Other".

Return ONLY valid JSON in this exact structure, with no markdown code fences or conversational text:
{
  "items": [
    {
      "name": "Flour",
      "unit": "kg",
      "openingQty": 50,
      "cost": 1140,
      "category": "Dry Goods"
    }
  ]
}`

      content.push({
        type: "text",
        text: promptText
      })

      const raw = await callClaude([
        {
          role: "user",
          content: content
        }
      ], "You are an expert AI vision assistant for a bakery business. Extract inventory and opening stock items from documents or photos into JSON. Return valid JSON only.", 4000, { creditCost: 2, feature: "inventory_scanner" })

      let result = null
      try {
        const cleanJson = raw.replace(/```json|```/g, "").trim()
        result = JSON.parse(cleanJson)
      } catch {
        result = extractAndRepairJson(raw)
      }

      const extractedItems = result && (
        Array.isArray(result.items) ? result.items :
        Array.isArray(result.inventory) ? result.inventory :
        Array.isArray(result.data) ? result.data :
        Array.isArray(result) ? result : null
      )

      if (!extractedItems || extractedItems.length === 0) {
        if (typeof refundScanCredits === "function") {
          try {
            await refundScanCredits(2, "Failed inventory scan: no readable items detected")
            setAiScanRefund("Scan could not read any items. 2 credits refunded automatically.")
          } catch (_) {}
        }
        setAiScanError("No inventory items could be detected in this file. Please make sure the photo or document is clear and readable.")
        return
      }

      const parsedItems = extractedItems.map(it => {
        const rawCost = it.cost !== undefined ? it.cost : (it.unit_price || it.price || 0)
        const costNum = parseFloat(String(rawCost).replace(/[^0-9.]/g, "")) || 0
        const rawQty = it.openingQty !== undefined ? it.openingQty : (it.stock !== undefined ? it.stock : (it.qty || 1))
        const qtyNum = parseFloat(String(rawQty).replace(/[^0-9.]/g, "")) || 1
        const cleanName = (it.name || it.item || "Unnamed Item").trim()
        const match = items.find(existing => existing.name.trim().toLowerCase() === cleanName.toLowerCase())

        return {
          id: match ? match.id : "os_" + uid(),
          name: match ? match.name : cleanName,
          unit: it.unit || (match ? match.unit : "g"),
          cost: costNum > 0 ? costNum : (match ? match.cost : 0),
          openingQty: qtyNum,
          isNew: !match,
          on: true
        }
      }).filter(p => p.name)

      if (parsedItems.length === 0) {
        setAiScanError("No valid items could be parsed from the file.")
        return
      }

      setImportItems(parsedItems)
      setPasteN(parsedItems.map(p => p.name).join("\n"))
      setPasteU(parsedItems.map(p => p.unit).join("\n"))
      setPasteQ(parsedItems.map(p => p.openingQty).join("\n"))
      setPasteC(parsedItems.map(p => p.cost).join("\n"))
      setImportStep(2)
    } catch (err) {
      console.error("AI inventory scan failed:", err)
      if (!err.message?.includes("DAILY_AI_CEILING_REACHED") && !err.message?.includes("Insufficient")) {
        if (typeof refundScanCredits === "function") {
          try {
            await refundScanCredits(2, `Failed inventory scan: ${err.message}`)
            setAiScanRefund("Scan failed. 2 credits refunded automatically.")
          } catch (_) {}
        }
      }
      setAiScanError(`Scan failed: ${err.message}`)
    } finally {
      setAiScanning(false)
    }
  }

  // Single Item Photo Scan Handlers
  const handleItemScanFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setItemScanError("")
    setItemScanResult(null)

    const isPdf = file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf"
    const isImg = file.type.startsWith("image/") || /\.(jpe?g|png|webp|gif|bmp)$/i.test(file.name)

    if (!isPdf && !isImg) {
      setItemScanError("Please select an image photo (.jpg, .png, .webp) or PDF.")
      return
    }

    const reader = new FileReader()
    reader.onload = (ev) => {
      setItemScanFile({
        name: file.name,
        size: (file.size / 1024).toFixed(1) + " KB",
        type: isPdf ? "pdf" : "image",
        rawBase64: ev.target.result
      })
    }
    reader.readAsDataURL(file)
  }

  const scanSingleItemPhoto = async () => {
    if (!itemScanFile || !scanningItem) return
    setItemScanning(true)
    setItemScanError("")
    setItemScanResult(null)

    try {
      const content = []
      if (itemScanFile.type === "pdf") {
        const base64Data = itemScanFile.rawBase64.includes(",") ? itemScanFile.rawBase64.split(",")[1] : itemScanFile.rawBase64
        content.push({
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: base64Data }
        })
      } else {
        const compressed = await compressImage(itemScanFile.rawBase64, 1920, 0.88, { enhanceContrast: true })
        content.push({
          type: "image",
          source: { type: "base64", media_type: "image/jpeg", data: compressed }
        })
      }

      content.push({
        type: "text",
        text: `You are an expert AI vision assistant for a bakery business.
Analyze this photo of a bakery ingredient, packaging supply, or purchase receipt/label for the target inventory item: "${scanningItem.name}".
Extract:
- "name": Detected brand or item name.
- "unit": Measurement unit ("kg", "g", "ml", "l", "pcs", "crate", "pack", "carton", "bag").
- "cost": Unit price or amount paid per unit (in Naira ₦ or number). If total amount and quantity are shown, calculate cost per unit. If not visible, return 0.
- "openingQty": Quantity visible or stated (default 1).

Return ONLY valid JSON:
{
  "name": "${scanningItem.name}",
  "unit": "${scanningItem.unit || 'g'}",
  "cost": 0,
  "openingQty": 1
}`
      })

      const raw = await callClaude([
        { role: "user", content }
      ], "Extract inventory item cost and quantity from image into JSON. Return valid JSON only.", 2000, { creditCost: 2, feature: "inventory_scanner" })

      let result = null
      try {
        const cleanJson = raw.replace(/```json|```/g, "").trim()
        result = JSON.parse(cleanJson)
      } catch {
        result = extractAndRepairJson(raw)
      }

      const itemData = (result?.items && result.items[0]) || result || {}
      const extractedCost = parseFloat(String(itemData.cost || itemData.unit_price || 0).replace(/[^0-9.]/g, "")) || 0
      const extractedQty = parseFloat(String(itemData.openingQty || itemData.qty || itemData.stock || 1).replace(/[^0-9.]/g, "")) || 1
      const extractedUnit = itemData.unit || scanningItem.unit || "g"

      setItemScanResult({
        cost: extractedCost,
        openingQty: extractedQty,
        unit: extractedUnit,
        name: itemData.name || scanningItem.name
      })
    } catch (err) {
      console.error("Item photo scan failed:", err)
      if (!err.message?.includes("DAILY_AI_CEILING_REACHED") && !err.message?.includes("Insufficient")) {
        if (typeof refundScanCredits === "function") {
          try {
            await refundScanCredits(2, `Failed item photo scan: ${err.message}`)
          } catch (_) {}
        }
      }
      setItemScanError(`Scan failed: ${err.message}`)
    } finally {
      setItemScanning(false)
    }
  }

  const applyItemScanResult = async () => {
    if (!scanningItem || !itemScanResult) return
    const id = scanningItem.id
    const newCost = itemScanResult.cost !== undefined ? itemScanResult.cost : scanningItem.cost
    const newQty = itemScanResult.openingQty !== undefined ? itemScanResult.openingQty : scanningItem.openingQty
    const newUnit = itemScanResult.unit || scanningItem.unit

    const updated = items.map(item => item.id === id ? { ...item, cost: newCost, openingQty: newQty, unit: newUnit } : item)
    setItems(updated)

    if (id && !id.startsWith("os_")) {
      try {
        const p = updateOpeningStockItemOnServer(id, { cost: newCost, openingQty: newQty, unit: newUnit })
        if (p && typeof p.catch === "function") p.catch(e => console.warn(e))
      } catch (err) {
        console.warn(err)
      }
    }

    const forSaving = updated.map(it => ({ ...it, cost: parseFloat(it.cost) || 0, openingQty: it.openingQty === "" ? 0 : (parseFloat(it.openingQty) || 0) }))
    await saveOpeningStock(forSaving, currentMonthStr, saved)

    if (inventory && setInventory) {
      const currentInv = Array.isArray(inventory) ? [...inventory] : []
      const existingIdx = currentInv.findIndex(i =>
        (scanningItem.itemId && i.id === scanningItem.itemId) ||
        i.id === scanningItem.id ||
        (i.name && i.name.toLowerCase() === scanningItem.name.toLowerCase())
      )
      if (existingIdx >= 0) {
        const updatedInventory = currentInv.map((invItem, idx) =>
          idx === existingIdx ? { ...invItem, stock: newQty, cost: newCost, unit: newUnit || invItem.unit } : invItem
        )
        setInventory(updatedInventory)
        await saveInventory(updatedInventory)
      }
    }

    setScanningItem(null)
    setItemScanFile(null)
    setItemScanResult(null)
    setItemScanError("")
  }

  // Manual Add Item Photo Scan Handler
  const handleManualPhotoScan = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setManualScanError("")
    setManualScanning(true)

    try {
      const isPdf = file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf"
      const reader = new FileReader()
      const rawBase64 = await new Promise((resolve, reject) => {
        reader.onload = ev => resolve(ev.target.result)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      const content = []
      if (isPdf) {
        const base64Data = rawBase64.includes(",") ? rawBase64.split(",")[1] : rawBase64
        content.push({
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: base64Data }
        })
      } else {
        const compressed = await compressImage(rawBase64, 1920, 0.88, { enhanceContrast: true })
        content.push({
          type: "image",
          source: { type: "base64", media_type: "image/jpeg", data: compressed }
        })
      }

      content.push({
        type: "text",
        text: `You are an expert AI vision assistant for a bakery business.
Analyze this photo of a bakery ingredient, packaging supply, or purchase receipt/label.
Extract:
- "name": Clean item or brand name (e.g. "Dangote Sugar", "Simas Margarine", "Golden Penny Flour", "Egg Crate").
- "unit": Measurement unit ("kg", "g", "ml", "l", "pcs", "crate", "pack", "carton", "bag").
- "cost": Unit price or cost (in Naira ₦ or number). If total paid and quantity are shown, calculate unit price.
- "openingQty": Starting stock quantity visible or stated (default 1).
- "category": One of "Dry Goods", "Dairy", "Flavours & Colours", "Packaging", "Decorations", "Other".

Return ONLY valid JSON:
{
  "name": "Item name",
  "unit": "kg",
  "cost": 1500,
  "openingQty": 1,
  "category": "Dry Goods"
}`
      })

      const raw = await callClaude([
        { role: "user", content }
      ], "Extract inventory item details from photo into JSON. Return valid JSON only.", 2000, { creditCost: 2, feature: "inventory_scanner" })

      let result = null
      try {
        const cleanJson = raw.replace(/```json|```/g, "").trim()
        result = JSON.parse(cleanJson)
      } catch {
        result = extractAndRepairJson(raw)
      }

      const itemData = (result?.items && result.items[0]) || result || {}
      const extractedCost = parseFloat(String(itemData.cost || itemData.unit_price || 0).replace(/[^0-9.]/g, "")) || ""
      const extractedQty = parseFloat(String(itemData.openingQty || itemData.qty || itemData.stock || 1).replace(/[^0-9.]/g, "")) || ""

      setCalcMode("manual")
      setNewItem(m => ({
        ...m,
        name: itemData.name || m.name,
        unit: itemData.unit || m.unit,
        cost: extractedCost !== "" ? extractedCost : m.cost,
        openingQty: extractedQty !== "" ? extractedQty : m.openingQty
      }))
    } catch (err) {
      console.error("Manual add scan failed:", err)
      if (!err.message?.includes("DAILY_AI_CEILING_REACHED") && !err.message?.includes("Insufficient")) {
        if (typeof refundScanCredits === "function") {
          try {
            await refundScanCredits(2, `Failed manual item photo scan: ${err.message}`)
          } catch (_) {}
        }
      }
      setManualScanError(`Scan failed: ${err.message}`)
    } finally {
      setManualScanning(false)
      if (manualScanFileRef.current) manualScanFileRef.current.value = ""
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
          <form
            onSubmit={e => {
              e.preventDefault()
              setCurrentPage(1)
            }}
            style={{ display: "flex", gap: 6, flex: 1, minWidth: 240, maxWidth: 440, alignItems: "center" }}
          >
            <div style={{ flex: 1, position: "relative", display: "flex", alignItems: "center" }}>
              <Search size={15} style={{ position: "absolute", left: 10, color: "var(--muted)", pointerEvents: "none" }} />
              <input
                type="text"
                placeholder="Search opening stock items..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 28px 8px 32px",
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
                  type="button"
                  onClick={() => setSearchQuery("")}
                  title="Clear search"
                  style={{ position: "absolute", right: 8, background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center" }}
                >
                  ✕
                </button>
              )}
            </div>
            <Btn type="submit" small variant="primary" style={{ display: "inline-flex", alignItems: "center", gap: 4, height: 35 }}>
              <Search size={13} /> Search
            </Btn>
            {searchQuery && (
              <Btn type="button" small variant="ghost" onClick={() => setSearchQuery("")} style={{ height: 35 }}>
                Reset
              </Btn>
            )}
          </form>

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
            <Btn small variant="outline" onClick={() => { setShowImport(true); setImportStep(1); }} title="Import from Excel, PDF, or Photo">
              <Upload size={13} /> Import Excel / Scan
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
                      <td style={{ padding: "10px 16px", fontWeight: 600, color: "var(--text)" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                          <span>{item.name}</span>
                          {!isLocked && (
                            <button
                              type="button"
                              onClick={() => {
                                setScanningItem(item)
                                setItemScanFile(null)
                                setItemScanError("")
                                setItemScanResult(null)
                              }}
                              title={`Scan photo/receipt for ${item.name} (AI)`}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 3,
                                padding: "2px 6px",
                                borderRadius: 4,
                                fontSize: 10.5,
                                fontWeight: 600,
                                background: "var(--panel)",
                                border: "1px solid var(--border)",
                                color: "var(--muted)",
                                cursor: "pointer",
                                transition: "all 0.15s"
                              }}
                              onMouseEnter={e => {
                                e.currentTarget.style.color = "var(--gold)"
                                e.currentTarget.style.borderColor = "var(--gold)"
                              }}
                              onMouseLeave={e => {
                                e.currentTarget.style.color = "var(--muted)"
                                e.currentTarget.style.borderColor = "var(--border)"
                              }}
                            >
                              <Camera size={11} /> Scan
                            </button>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: "10px 16px" }}>
                        {isEditable ? (
                          <input
                            type="text"
                            value={item.unit || ""}
                            onChange={e => updateOSUnit(item.id, e.target.value)}
                            style={{ ...iSt, width: 75, padding: "4px 8px", fontSize: 12 }}
                          />
                        ) : (
                          <span style={{ color: "var(--muted)" }}>{item.unit || "g"}</span>
                        )}
                      </td>
                      <td style={{ padding: "10px 16px" }}>
                        {isEditable ? (
                          <input
                            type="number"
                            step="any"
                            value={item.cost !== undefined ? item.cost : ""}
                            placeholder="0"
                            onFocus={e => {
                              if (e.target.value === "0") e.target.select()
                            }}
                            onBlur={() => {
                              if (item.cost === "" || item.cost === undefined) updateOSCost(item.id, 0)
                            }}
                            onChange={e => updateOSCost(item.id, e.target.value)}
                            style={{ ...iSt, width: 100, padding: "4px 8px", fontSize: 12 }}
                          />
                        ) : (
                          <span style={{ fontFamily: "monospace" }}>
                            {itemCost % 1 !== 0
                              ? `₦${itemCost.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`
                              : fmt(itemCost)}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "10px 16px" }}>
                        {!isLocked ? (
                          <input
                            type="number"
                            step="any"
                            value={item.openingQty !== undefined ? item.openingQty : ""}
                            placeholder="0"
                            onFocus={e => {
                              if (e.target.value === "0") e.target.select()
                            }}
                            onBlur={() => {
                              if (item.openingQty === "" || item.openingQty === undefined) {
                                updateOSQty(item.id, 0)
                              } else {
                                const num = parseFloat(item.openingQty)
                                if (!isNaN(num) && String(item.openingQty).endsWith(".")) {
                                  updateOSQty(item.id, num)
                                }
                              }
                            }}
                            onChange={e => updateOSQty(item.id, e.target.value)}
                            style={{ ...iSt, width: 110, padding: "4px 8px", fontSize: 12, fontWeight: 600 }}
                          />
                        ) : (
                          <span style={{ fontWeight: 600 }}>{itemQty} {item.unit}</span>
                        )}
                      </td>
                      <td style={{ padding: "10px 16px", fontWeight: 600, color: "var(--gold)" }}>
                        {itemVal % 1 !== 0 && itemVal < 100
                          ? `₦${itemVal.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : fmt(itemVal)}
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
        <Modal title="Add Item to Opening Stock" onClose={() => { setAddingItem(false); setManualScanError(""); }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {manualScanError && (
              <div style={{ padding: "8px 12px", background: "#FDEBE9", borderRadius: 8, fontSize: 12, color: "#B03A2E", display: "flex", alignItems: "center", gap: 6 }}>
                <AlertTriangle size={14} /> {manualScanError}
              </div>
            )}

            {/* AI Photo Auto-Fill */}
            <div>
              <Btn
                type="button"
                small
                variant="outline"
                onClick={() => manualScanFileRef.current?.click()}
                disabled={manualScanning}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  borderColor: "var(--gold)",
                  color: "var(--gold)",
                  background: "#FAF7F0",
                  padding: "8px 12px",
                  borderRadius: 8
                }}
              >
                {manualScanning ? (
                  <>
                    <RefreshCw size={13} style={{ animation: "spin 1s linear infinite" }} /> Scanning photo with AI...
                  </>
                ) : (
                  <>
                    <Sparkles size={13} /> Scan Photo or Receipt to Auto-Fill (AI)
                  </>
                )}
              </Btn>
              <input
                ref={manualScanFileRef}
                type="file"
                accept="image/*,.pdf"
                onChange={handleManualPhotoScan}
                style={{ display: "none" }}
              />
            </div>

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
                  { value: "g", label: "Grams (g)" },
                  { value: "ml", label: "Millilitres (ml)" },
                  { value: "m", label: "Millimeter / Metre (m)" },
                  { value: "kg", label: "Kilograms (kg)" },
                  { value: "L", label: "Litres (L)" },
                  { value: "pcs", label: "Pieces (pcs)" },
                  { value: "tub", label: "Tubs" },
                  { value: "pack", label: "Packs" }
                ]}
              />
              <Inp
                label="Opening Quantity On Hand"
                type="number"
                value={newItem.openingQty}
                onFocus={e => {
                  if (e.target.value === "0") e.target.select()
                }}
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
                      {(() => {
                        const calculated = parseFloat(newItem.totalPaid) / parseFloat(newItem.qtyBought)
                        const costDisplay = calculated % 1 !== 0
                          ? `₦${calculated.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`
                          : fmt(calculated)
                        return `→ Calculated Cost: ${costDisplay} per ${newItem.unit}`
                      })()}
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
        <Modal title="Import Opening Stock — Excel, PDF or a photo" onClose={() => { setShowImport(false); setAiFile(null); setAiScanError(""); setAiScanRefund(""); }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {importStep === 1 && (
              <>
                {/* OPTION A: AI SCAN (PDF OR PHOTO) */}
                <div style={{ marginBottom: 18, padding: "14px 16px", background: "#FAF7F0", border: "1.5px dashed var(--gold)", borderRadius: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Sparkles size={16} color="var(--gold)" />
                      <span style={{ fontWeight: 600, fontSize: 13.5, color: "var(--text)" }}>Option A: Scan PDF or Photo with AI</span>
                    </div>
                    <span style={{ fontSize: 10.5, background: "#FFF3D6", color: "#8A6318", padding: "2px 7px", borderRadius: 4, fontWeight: 600 }}>2 Credits</span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12, lineHeight: 1.5 }}>
                    Upload a stock sheet PDF, supplier invoice, paper receipt, handwritten inventory list, or snap a photo of physical ingredients/supplies. AI will read all item names, units, stock quantities, and costs.
                  </div>

                  {aiScanError && (
                    <div style={{ padding: "8px 12px", background: "#FDEBE9", borderRadius: 8, fontSize: 12, color: "#B03A2E", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                      <AlertTriangle size={14} /> {aiScanError}
                    </div>
                  )}

                  {aiScanRefund && (
                    <div style={{ padding: "8px 12px", background: "#E8F4FD", borderRadius: 8, fontSize: 12, color: "#0B5394", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                      <Check size={14} /> {aiScanRefund}
                    </div>
                  )}

                  {!aiFile ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <div
                        onClick={() => aiFileInputRef.current?.click()}
                        style={{
                          border: "1.5px dashed #D5C29D",
                          borderRadius: 10,
                          padding: "18px 16px",
                          textAlign: "center",
                          cursor: "pointer",
                          background: "#FFFFFF",
                          transition: "all 0.2s"
                        }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = "var(--gold)"}
                        onMouseLeave={e => e.currentTarget.style.borderColor = "#D5C29D"}
                      >
                        <UploadCloud size={26} color="var(--gold)" style={{ margin: "0 auto 6px" }} />
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)" }}>
                          Click or drop PDF document or photo here
                        </div>
                        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                          Supports .pdf, .jpg, .png, .webp (invoices, stock sheets, photos)
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                        <Btn small variant="outline" onClick={() => aiFileInputRef.current?.click()} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                          <UploadCloud size={13} /> Select PDF or Photo
                        </Btn>
                        <Btn small variant="outline" onClick={() => aiCameraInputRef.current?.click()} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                          <Camera size={13} /> Take photo
                        </Btn>
                      </div>

                      <input ref={aiFileInputRef} type="file" accept=".pdf,image/*,application/pdf" onChange={handleAiFileSelect} style={{ display: "none" }} />
                      <input ref={aiCameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleAiFileSelect} style={{ display: "none" }} />
                    </div>
                  ) : (
                    <div style={{ padding: 12, background: "#FFFFFF", borderRadius: 8, border: "1px solid var(--border)" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {aiFile.type === "image" ? (
                            <img src={aiFile.rawBase64} alt="Preview" style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 6 }} />
                          ) : (
                            <FileText size={30} color="var(--gold)" />
                          )}
                          <div>
                            <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)" }}>{aiFile.name}</div>
                            <div style={{ fontSize: 11, color: "var(--muted)" }}>{aiFile.size} • {aiFile.type.toUpperCase()}</div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => { setAiFile(null); setAiScanError(""); setAiScanRefund(""); }}
                          style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", padding: 4 }}
                          title="Remove file"
                        >
                          <X size={16} />
                        </button>
                      </div>

                      <Btn
                        onClick={scanAiInventory}
                        disabled={aiScanning}
                        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                      >
                        {aiScanning ? (
                          <>
                            <RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} /> Scanning & Extracting with AI...
                          </>
                        ) : (
                          <>
                            <Sparkles size={14} /> Scan & Extract Inventory with AI (2 Credits)
                          </>
                        )}
                      </Btn>
                    </div>
                  )}
                </div>

                {/* OPTION B: EXCEL COPY-PASTE */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <FileSpreadsheet size={15} color="var(--muted)" />
                    <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text)" }}>Option B: Paste Columns from Excel</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 10, lineHeight: 1.6 }}>
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
                        Units (g, ml, m, kg, pcs)
                      </label>
                      <textarea
                        rows={6}
                        value={pasteU}
                        onChange={e => setPasteU(e.target.value)}
                        placeholder={"g\nml\nm\nkg"}
                        style={{ ...iSt, height: 110, resize: "vertical", fontFamily: "monospace", fontSize: 12 }}
                      />
                      <div style={{ fontSize: 9.5, color: "var(--muted)", marginTop: 3 }}>Default gram(g) millimeter (m)</div>
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
                          <td style={{ padding: 6 }}>
                            {item.cost % 1 !== 0
                              ? `₦${item.cost.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`
                              : fmt(item.cost)}
                          </td>
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

      {/* SINGLE ITEM PHOTO SCAN MODAL */}
      {scanningItem && (
        <Modal title={`Scan Photo for ${scanningItem.name}`} onClose={() => { setScanningItem(null); setItemScanFile(null); setItemScanResult(null); setItemScanError(""); }}>
          <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 12, lineHeight: 1.6 }}>
            Upload or snap a photo of your <strong>{scanningItem.name}</strong> bag, packaging, price label, or purchase receipt. AI will extract the unit cost and stock count.
          </div>

          {itemScanError && (
            <div style={{ padding: "8px 12px", background: "#FDEBE9", borderRadius: 8, fontSize: 12, color: "#B03A2E", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
              <AlertTriangle size={14} /> {itemScanError}
            </div>
          )}

          {!itemScanFile ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
              <div
                onClick={() => itemScanFileRef.current?.click()}
                style={{
                  border: "2px dashed var(--border)",
                  borderRadius: 12,
                  padding: "22px 16px",
                  textAlign: "center",
                  cursor: "pointer",
                  background: "#FAF7F0",
                  transition: "all 0.2s"
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = "var(--gold)"}
                onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}
              >
                <Camera size={26} color="var(--gold)" style={{ margin: "0 auto 8px" }} />
                <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text)", marginBottom: 4 }}>
                  Click to upload photo or document
                </div>
                <div style={{ fontSize: 11.5, color: "var(--muted)" }}>
                  Supports JPG, PNG, WEBP or PDF receipt
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                <Btn small variant="outline" onClick={() => itemScanFileRef.current?.click()} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <UploadCloud size={13} /> Select Photo or PDF
                </Btn>
                <Btn small variant="outline" onClick={() => itemScanCameraRef.current?.click()} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <Camera size={13} /> Take photo
                </Btn>
              </div>

              <input ref={itemScanFileRef} type="file" accept="image/*,.pdf" onChange={handleItemScanFileSelect} style={{ display: "none" }} />
              <input ref={itemScanCameraRef} type="file" accept="image/*" capture="environment" onChange={handleItemScanFileSelect} style={{ display: "none" }} />
            </div>
          ) : (
            <div style={{ marginBottom: 16, padding: 12, background: "#FAF7F0", borderRadius: 10, border: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {itemScanFile.type === "image" ? (
                    <img src={itemScanFile.rawBase64} alt="Preview" style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 6 }} />
                  ) : (
                    <FileText size={30} color="var(--gold)" />
                  )}
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)" }}>{itemScanFile.name}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>{itemScanFile.size} • {itemScanFile.type.toUpperCase()}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setItemScanFile(null); setItemScanResult(null); }}
                  style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", padding: 4 }}
                >
                  <X size={16} />
                </button>
              </div>

              {!itemScanResult && (
                <Btn
                  onClick={scanSingleItemPhoto}
                  disabled={itemScanning}
                  style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                >
                  {itemScanning ? (
                    <>
                      <RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} /> Scanning photo with AI...
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} /> Scan Photo with AI (2 Credits)
                    </>
                  )}
                </Btn>
              )}
            </div>
          )}

          {itemScanResult && (
            <div style={{ padding: 14, background: "#F5FBF6", border: "1.5px solid #C3E6CB", borderRadius: 10, marginBottom: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: "#155724", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                <Check size={16} color="#28A745" /> AI Scan Detected Details
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 12.5 }}>
                <div>
                  <span style={{ color: "var(--muted)" }}>Unit Cost:</span>{" "}
                  <strong>{fmtCost(itemScanResult.cost)}</strong>
                </div>
                <div>
                  <span style={{ color: "var(--muted)" }}>Stock Count:</span>{" "}
                  <strong>{itemScanResult.openingQty} {itemScanResult.unit}</strong>
                </div>
              </div>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Btn variant="ghost" onClick={() => { setScanningItem(null); setItemScanFile(null); setItemScanResult(null); }}>
              Cancel
            </Btn>
            {itemScanResult && (
              <Btn onClick={applyItemScanResult} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Check size={14} /> Apply to {scanningItem.name}
              </Btn>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}
