/**
 * MonthlyOverview.jsx
 * ----------------------------------------------------------------------------
 * Monthly Overview Report.
 * Displays Revenue, Production Cost, Overhead Expenses, Net Profit, and Stock.
 * ----------------------------------------------------------------------------
 */
import React, { useState, useMemo, useEffect, useCallback } from "react"
import { Btn, Card, SHead, TH, TR2, Spinner } from "../common/ui.jsx"
import { fmt, isDateInMonth, getMonthKeyFromDate } from "../../lib/helpers.js"
import {
  loadLocal,
  saveLocal,
  saveExpenses,
  saveProductionsList,
  saveQuotes,
  saveTxns,
  savePurchases,
  fetchPaginatedPurchases,
  deleteOpeningStockOnServer,
  fetchOpeningStockFromServer,
  calculateOrderUsages,
  loadOpeningStock,
  getAuthHeaders
} from "../../lib/data.js"
import { Download, Trash2, AlertTriangle, CheckCircle, RefreshCw } from "lucide-react"

export function MonthlyOverview({ inventory, recipes = [], productions = [], setProductions, expenses = [], setExpenses, company, isOwner }) {
  const [quotesList, setQuotesList] = useState(() => loadLocal("ll_quotes", []))
  const [purchasesList, setPurchasesList] = useState(() => loadLocal("ll_purchases", []))
  const cur = new Date().toISOString().slice(0, 7)
  const [osItems, setOsItems] = useState(() => loadOpeningStock(cur))
  const [isRolledOver, setIsRolledOver] = useState(false)
  const [loadingOS, setLoadingOS] = useState(false)
  const [successMsg, setSuccessMsg] = useState("")

  const isOrderConfirmed = (p) => {
    if (!p) return false
    if (p.status === "confirmed" || !!p.confirmedAt) return true
    // Standalone production record must be confirmed or actively in production, not an unconfirmed quote
    if (p.isProd && p.status !== "quote" && p.status !== "pending" && p.status !== "cancelled") return true
    return false
  }

  // Quote revenue mapped from quotesList with full item, tier, and recipe details preserved
  const quoteRevenue = useMemo(() => {
    const prodQuoteIds = new Set((productions || []).filter(p => p.quoteId).map(p => p.quoteId))
    return (quotesList || [])
      .filter(q => q.status === "confirmed" || !!q.confirmedAt || prodQuoteIds.has(q.id))
      .map(q => {
        const isGS = q.orderPurpose === "gift" || q.orderPurpose === "sample"
        const prodMatch = (productions || []).find(p => p.quoteId === q.id || p.id === q.id)
        return {
          ...q,
          ...(prodMatch || {}),
          id: q.id,
          quoteId: q.id,
          fromQuote: true,
          client: q.clientName || prodMatch?.client || "",
          clientPhone: q.clientPhone || prodMatch?.clientPhone || "",
          deliveryDate: q.deliveryDate || q.dueDate || q.date || prodMatch?.deliveryDate || "",
          orderDate: q.orderDate || q.date || prodMatch?.orderDate || "",
          confirmedAt: q.confirmedAt || prodMatch?.confirmedAt || "",
          salePrice: isGS ? 0 : +(q.salePrice || q.quotePrice || prodMatch?.salePrice || 0),
          cost: +(q.totalCost || prodMatch?.cost || 0),
          deliveryCost: 0,
          productType: q.productType || prodMatch?.productType || "Cake",
          orderPurpose: q.orderPurpose || prodMatch?.orderPurpose || "sale",
          size: q.tiers?.map(t => t.size + '" ' + t.shape).join(" + ") || prodMatch?.size || "",
          covering: q.tiers?.[0]?.coverings?.[0]?.type || prodMatch?.covering || "",
          flavors: q.flavourSummary || prodMatch?.flavors || "",
          cakeSummary: q.cakeSummary || prodMatch?.cakeSummary || "",
          notes: q.notes || prodMatch?.notes || "",
          paymentType: isGS ? q.orderPurpose : (prodMatch?.paymentType || "full"),
          status: "confirmed",
          margin: q.margin || prodMatch?.profitPct || 0,
          // Explicitly ensure items, tiers, pastryItems, decQty, accessories, usages are preserved
          items: (Array.isArray(q.items) && q.items.length > 0) ? q.items : (prodMatch?.items || []),
          tiers: (Array.isArray(q.tiers) && q.tiers.length > 0) ? q.tiers : (prodMatch?.tiers || []),
          pastryItems: (Array.isArray(q.pastryItems) && q.pastryItems.length > 0) ? q.pastryItems : (prodMatch?.pastryItems || []),
          donutGroups: (Array.isArray(q.donutGroups) && q.donutGroups.length > 0) ? q.donutGroups : (prodMatch?.donutGroups || []),
          loaves: (Array.isArray(q.loaves) && q.loaves.length > 0) ? q.loaves : (prodMatch?.loaves || []),
          tartQty: q.tartQty || prodMatch?.tartQty || 0,
          decQty: q.decQty || prodMatch?.decQty || null,
          decorations: q.decorations || prodMatch?.decorations || null,
          accRows: (Array.isArray(q.accRows) && q.accRows.length > 0) ? q.accRows : (prodMatch?.accRows || []),
          usages: (Array.isArray(q.usages) && q.usages.length > 0) ? q.usages : (prodMatch?.usages || null),
          matchedRecipe: q.matchedRecipe || prodMatch?.matchedRecipe || null,
          recipeId: q.recipeId || prodMatch?.recipeId || ""
        }
      })
  }, [quotesList, productions])

  // Combine confirmed quotes with standalone confirmed productions
  const allRevenue = useMemo(() => {
    const quoteIds = new Set(quoteRevenue.map(q => q.quoteId || q.id))
    const legacyProds = (productions || []).filter(p => {
      if (p.fromQuote || p.quoteId || quoteIds.has(p.id) || quoteIds.has(p.quoteId)) return false
      if (p.status === "quote" || p.isProd === false) return false
      return isOrderConfirmed(p)
    })
    return [...quoteRevenue, ...legacyProds]
  }, [quoteRevenue, productions])

  const months = useMemo(() => {
    return [...new Set([
      cur,
      ...allRevenue.flatMap(p => [
        p.confirmedAt ? (getMonthKeyFromDate(p.confirmedAt) || p.confirmedAt.slice(0, 7)) : "",
        (p.deliveryDate || p.dueDate || p.orderDate || p.date) ? (getMonthKeyFromDate(p.deliveryDate || p.dueDate || p.orderDate || p.date) || (p.deliveryDate || p.dueDate || p.orderDate || p.date).slice(0, 7)) : ""
      ]),
      ...(expenses || []).map(e => getMonthKeyFromDate(e.date) || e.date?.slice(0, 7)),
      ...(purchasesList || []).map(p => getMonthKeyFromDate(p.date) || p.date?.slice(0, 7))
    ].filter(Boolean))].sort().reverse()
  }, [cur, allRevenue, expenses, purchasesList])

  const [sel, setSel] = useState(cur)
  const monthLabel = new Date(sel + "-02").toLocaleDateString("en-NG", { month: "long", year: "numeric" })
  const [deletingAll, setDeletingAll] = useState(false)

  // Asynchronously fetch opening stock for selected month or fall back to global opening stock
  const fetchMonthStock = useCallback(async (monthStr) => {
    setLoadingOS(true)
    try {
      // 1. Check local cache first for instant UI response
      const cached = loadOpeningStock(monthStr)
      if (cached && cached.length > 0) {
        setOsItems(cached)
        setIsRolledOver(false)
      }

      // 2. Fetch from server for month
      const serverOS = await fetchOpeningStockFromServer(monthStr)
      if (serverOS && serverOS.length > 0) {
        setOsItems(serverOS)
        setIsRolledOver(false)
        setLoadingOS(false)
        return
      }

      if (cached && cached.length > 0) {
        setLoadingOS(false)
        return
      }

      // 3. Fallback: check global opening stock from cache or server
      const globalOS = loadOpeningStock()
      if (globalOS && globalOS.length > 0) {
        setOsItems(globalOS)
        setIsRolledOver(false)
        setLoadingOS(false)
        return
      }

      // 4. Fallback: Rollover from previous month's closing stock if available
      const [y, m] = monthStr.split("-").map(Number)
      const prevM = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`
      let prevOS = loadOpeningStock(prevM)
      if (!prevOS || prevOS.length === 0) {
        try {
          const prevServerOS = await fetchOpeningStockFromServer(prevM)
          if (prevServerOS && prevServerOS.length > 0) prevOS = prevServerOS
        } catch {}
      }

      if (prevOS && prevOS.length > 0) {
        const allPurchases = loadLocal("ll_purchases", [])
        const prevPurchases = allPurchases.filter(p => isDateInMonth(p.date, prevM))
        
        const prevMRev = allRevenue.filter(p => {
          if (!isOrderConfirmed(p)) return false
          if (p.confirmedAt) {
            return isDateInMonth(p.confirmedAt, prevM) || isDateInMonth(p.deliveryDate || p.dueDate || p.orderDate || p.date, prevM)
          }
          return isDateInMonth(p.deliveryDate || p.dueDate || p.orderDate || p.date, prevM)
        })

        const prevUsageMap = {}
        const prevUsageMapByName = {}
        prevMRev.forEach(order => {
          const usages = calculateOrderUsages(order, inventory, recipes)
          usages.forEach(u => {
            if (u.itemId) {
              prevUsageMap[u.itemId] = (prevUsageMap[u.itemId] || 0) + u.qty
              const invItem = (inventory || []).find(i => i.id === u.itemId)
              if (invItem && invItem.name) {
                const cleanName = invItem.name.trim().toLowerCase()
                prevUsageMapByName[cleanName] = (prevUsageMapByName[cleanName] || 0) + u.qty
              }
            }
          })
        })

        const rolled = inventory.map(item => {
          const f = prevOS.find(i => i.id === item.id || i.itemId === item.id || i.name?.toLowerCase() === item.name?.toLowerCase())
          const op = f ? (Number(f.openingQty) || 0) : 0
          const bought = prevPurchases.filter(p => p.itemId === item.id || p.item?.toLowerCase() === item.name?.toLowerCase()).reduce((s, p) => s + (Number(p.stockAdded) || 0), 0)
          const itemName = item.name?.trim().toLowerCase()
          const usedQty = prevUsageMap[item.id] !== undefined
            ? prevUsageMap[item.id]
            : (item.itemId && prevUsageMap[item.itemId] !== undefined)
              ? prevUsageMap[item.itemId]
              : (itemName ? (prevUsageMapByName[itemName] || 0) : 0)
          const used = parseFloat((usedQty || 0).toFixed(3))
          const closing = Math.max(0, parseFloat((op + bought - used).toFixed(3)))
          return {
            id: item.id,
            itemId: item.id,
            name: item.name,
            unit: item.unit || "kg",
            cost: item.cost || 0,
            openingQty: closing,
            isRolledOver: true
          }
        })
        setOsItems(rolled)
        setIsRolledOver(true)
        setLoadingOS(false)
        return
      }

      setOsItems([])
      setIsRolledOver(false)
    } catch (err) {
      console.warn("fetchMonthStock notice:", err)
      setOsItems([])
      setIsRolledOver(false)
    } finally {
      setLoadingOS(false)
    }
  }, [allRevenue, inventory, recipes])

  // Asynchronously fetch purchases for selected month
  const fetchMonthPurchases = useCallback(async (monthStr) => {
    try {
      // 1. Load from local cache immediately for instant response
      const local = loadLocal("ll_purchases", [])
      if (local && local.length > 0) {
        setPurchasesList(local)
      }
      // 2. Fetch all purchases for the month from server
      const res = await fetchPaginatedPurchases({ page: 1, limit: 1000, month: monthStr })
      if (res && Array.isArray(res.data) && res.data.length > 0) {
        const allLocal = loadLocal("ll_purchases", [])
        const otherMonths = allLocal.filter(p => !isDateInMonth(p.date, monthStr))
        const merged = [...res.data, ...otherMonths]
        setPurchasesList(merged)
        saveLocal("ll_purchases", merged)
      }
    } catch (err) {
      console.warn("fetchMonthPurchases notice:", err)
    }
  }, [])

  useEffect(() => {
    fetchMonthStock(sel)
    fetchMonthPurchases(sel)
  }, [sel, fetchMonthStock, fetchMonthPurchases])

  // Listen for real-time purchase updates from ReceiptScanner or Purchases tab
  useEffect(() => {
    const handlePurchasesUpdated = () => {
      const fresh = loadLocal("ll_purchases", [])
      setPurchasesList(fresh)
    }
    window.addEventListener("layerledger:purchases-updated", handlePurchasesUpdated)
    return () => window.removeEventListener("layerledger:purchases-updated", handlePurchasesUpdated)
  }, [])

  // Listen for real-time quote & production updates from QuotesPage or Production
  useEffect(() => {
    const handleQuotesUpdated = () => {
      const fresh = loadLocal("ll_quotes", [])
      setQuotesList(fresh)
    }
    window.addEventListener("layerledger:quotes-updated", handleQuotesUpdated)
    window.addEventListener("layerledger:productions-updated", handleQuotesUpdated)
    return () => {
      window.removeEventListener("layerledger:quotes-updated", handleQuotesUpdated)
      window.removeEventListener("layerledger:productions-updated", handleQuotesUpdated)
    }
  }, [])

  const handleClearMonthData = async () => {
    if (!window.confirm(`Are you sure you want to clear ALL data for ${monthLabel}? This will clear revenue orders, production costs, overhead expenses, purchases, and opening stock logged for this month. This cannot be undone.`)) return
    setDeletingAll(true)
    try {
      // 1. Delete opening stock on server and cache for this month
      await deleteOpeningStockOnServer(sel).catch(e => console.warn("deleteOpeningStock error:", e))

      // 2. Clear quotes for this month and sync to server
      const allQuotes = loadLocal("ll_quotes", [])
      const updatedQuotes = allQuotes.filter(q => {
        const m = q.confirmedAt ? q.confirmedAt.slice(0, 7) : (q.deliveryDate || q.dueDate || q.orderDate || q.date || "").slice(0, 7)
        return m !== sel
      })
      setQuotesList(updatedQuotes)
      await saveQuotes(updatedQuotes).catch(e => console.warn("saveQuotes error:", e))

      // 3. Clear confirmed orders / productions for this month and sync to server
      if (setProductions && productions) {
        const updatedProds = productions.filter(p => {
          const m = p.fromQuote && p.confirmedAt ? p.confirmedAt.slice(0, 7) : (p.deliveryDate || p.dueDate || p.orderDate || "").slice(0, 7)
          return m !== sel
        })
        setProductions(updatedProds)
        await saveProductionsList(updatedProds).catch(e => console.warn("saveProductionsList error:", e))
      }

      // 4. Delete purchases on server for this month and update local storage
      const headers = getAuthHeaders()
      const apiUrl = import.meta.env.VITE_API_URL
      if (headers && apiUrl) {
        try {
          const res = await fetch(`${apiUrl}/api/purchases?month=${encodeURIComponent(sel)}&limit=1000`, { headers })
          if (res.ok) {
            const json = await res.json()
            const items = Array.isArray(json) ? json : (Array.isArray(json.data) ? json.data : [])
            await Promise.allSettled(items.map(p => fetch(`${apiUrl}/api/purchases/${p.id}`, { method: "DELETE", headers })))
          }
        } catch (e) {
          console.warn("Server purchase deletion error:", e)
        }
      }
      const allPurchases = loadLocal("ll_purchases", [])
      const updatedPurchases = allPurchases.filter(p => !isDateInMonth(p.date, sel))
      setPurchasesList(updatedPurchases)
      await savePurchases(updatedPurchases).catch(e => console.warn("savePurchases error:", e))

      // 5. Clear overhead expenses for this month and sync to server
      if (setExpenses && expenses) {
        const updatedExpenses = expenses.filter(e => !isDateInMonth(e.date, sel))
        setExpenses(updatedExpenses)
        await saveExpenses(updatedExpenses).catch(e => console.warn("saveExpenses error:", e))
      }

      // 6. Clear transactions for this month in local storage
      const allTxns = loadLocal("ll_txns", [])
      const updatedTxns = allTxns.filter(t => !t.date?.startsWith(sel))
      await saveTxns(updatedTxns).catch(e => console.warn("saveTxns error:", e))

      // 7. Clear local opening stock state
      setOsItems([])
      setIsRolledOver(false)

      setSuccessMsg(`All data for ${monthLabel} has been permanently cleared.`)
      setTimeout(() => setSuccessMsg(""), 6000)
    } catch (err) {
      console.error("Failed to clear monthly data:", err)
      alert("Failed to clear monthly data: " + err.message)
    } finally {
      setDeletingAll(false)
    }
  }

  // Revenue comes from confirmed quotes/orders confirmed or scheduled in the selected month
  const mRevenue = useMemo(() => {
    return allRevenue.filter(p => {
      if (!isOrderConfirmed(p)) return false
      if (p.confirmedAt) {
        return isDateInMonth(p.confirmedAt, sel) || isDateInMonth(p.deliveryDate || p.dueDate || p.orderDate || p.date, sel)
      }
      return isDateInMonth(p.deliveryDate || p.dueDate || p.orderDate || p.date, sel)
    })
  }, [allRevenue, sel])

  // Revenue excludes gifts and samples
  const paid = useMemo(() => {
    return mRevenue.filter(p => p.paymentType !== "gift" && p.paymentType !== "sample")
  }, [mRevenue])

  const rev = useMemo(() => {
    return paid.reduce((s, p) => s + (p.salePrice || 0), 0)
  }, [paid])

  // Production Cost: total ingredient costs from those same confirmed orders
  const prodCost = useMemo(() => {
    return mRevenue.reduce((s, p) => s + (p.cost || 0), 0)
  }, [mRevenue])

  // Overhead Expenses: total from the Expenses tab, excluding ingredient purchases
  const mExp = useMemo(() => {
    return (expenses || []).filter(e => isDateInMonth(e.date, sel) && e.source !== "purchase")
  }, [expenses, sel])

  const overhead = useMemo(() => {
    return mExp.reduce((s, e) => s + (e.amount || 0), 0)
  }, [mExp])

  const profit = rev - prodCost - overhead
  const margin = rev > 0 ? Math.round((profit / rev) * 100) : 0

  // Revenue by product type
  const byType = useMemo(() => {
    return mRevenue.reduce((acc, p) => {
      const t = p.productType || "Cake"
      if (!acc[t]) acc[t] = { qty: 0, rev: 0 }
      acc[t].qty++
      acc[t].rev += (p.salePrice || 0)
      return acc
    }, {})
  }, [mRevenue])

  // Purchases this month (from purchasesList)
  const mPurchases = useMemo(() => {
    return (purchasesList || []).filter(p => {
      if (!p.date) return false
      return isDateInMonth(p.date, sel)
    })
  }, [purchasesList, sel])

  // Starting inventory snapshot - matches by id, itemId, or item name
  const getOSQty = useCallback((itemOrId) => {
    if (!itemOrId) return 0
    let id = typeof itemOrId === "string" ? itemOrId : itemOrId.id
    let name = (typeof itemOrId === "object" ? itemOrId.name : "")?.trim().toLowerCase()
    if (!name && typeof itemOrId === "string") {
      const foundInInv = (inventory || []).find(inv => inv.id === itemOrId)
      if (foundInInv) name = foundInInv.name?.trim().toLowerCase()
    }
    const f = (osItems || []).find(i => 
      (id && (i.id === id || i.itemId === id)) ||
      (name && i.name && i.name.trim().toLowerCase() === name)
    )
    return f ? (Number(f.openingQty) || 0) : 0
  }, [osItems, inventory])

  const getBought = useCallback((itemOrId) => {
    if (!itemOrId) return 0
    let id = typeof itemOrId === "string" ? itemOrId : itemOrId.id
    let name = (typeof itemOrId === "object" ? itemOrId.name : "")?.trim().toLowerCase()
    if (!name && typeof itemOrId === "string") {
      const foundInInv = (inventory || []).find(inv => inv.id === itemOrId)
      if (foundInInv) name = foundInInv.name?.trim().toLowerCase()
    }
    return mPurchases.filter(p => 
      (id && (p.itemId === id || p.id === id)) ||
      (name && p.item && p.item.trim().toLowerCase() === name)
    ).reduce((s, p) => s + (Number(p.stockAdded ?? p.qty) || 0), 0)
  }, [mPurchases, inventory])

  // Calculate exact ingredient usage from confirmed orders for this month via Order Calculator
  const { monthUsages, monthUsagesByName } = useMemo(() => {
    const usageMap = {}
    const nameMap = {}
    mRevenue.forEach(order => {
      const usages = calculateOrderUsages(order, inventory, recipes)
      usages.forEach(u => {
        if (u.itemId) {
          usageMap[u.itemId] = (usageMap[u.itemId] || 0) + u.qty
          const invItem = (inventory || []).find(i => i.id === u.itemId)
          if (invItem && invItem.name) {
            const cleanName = invItem.name.trim().toLowerCase()
            nameMap[cleanName] = (nameMap[cleanName] || 0) + u.qty
          }
        }
      })
    })
    return { monthUsages: usageMap, monthUsagesByName: nameMap }
  }, [mRevenue, inventory, recipes])

  const getUsed = useCallback((itemOrId) => {
    if (!itemOrId) return 0
    let id = typeof itemOrId === "string" ? itemOrId : (itemOrId.id || itemOrId.itemId)
    let altId = typeof itemOrId === "object" ? itemOrId.itemId : null
    let name = (typeof itemOrId === "object" ? itemOrId.name : "")?.trim().toLowerCase()
    if (!name && typeof itemOrId === "string") {
      const foundInInv = (inventory || []).find(inv => inv.id === itemOrId)
      if (foundInInv) name = foundInInv.name?.trim().toLowerCase()
    }

    let qty = 0
    if (id && monthUsages[id] !== undefined) {
      qty = monthUsages[id]
    } else if (altId && monthUsages[altId] !== undefined) {
      qty = monthUsages[altId]
    } else if (name && monthUsagesByName[name] !== undefined) {
      qty = monthUsagesByName[name]
    }
    return parseFloat((qty || 0).toFixed(3))
  }, [monthUsages, monthUsagesByName, inventory])

  // Combined inventory list including items entered in Opening Stock and Purchases this month
  const allStockItems = useMemo(() => {
    const list = Array.isArray(inventory) ? [...inventory] : []
    const existingNames = new Set(list.map(i => i.name?.trim().toLowerCase()).filter(Boolean))
    const existingIds = new Set(list.map(i => i.id).filter(Boolean))

    const extra = Array.isArray(osItems) ? osItems : []
    extra.forEach(os => {
      const osName = os.name?.trim().toLowerCase()
      const osId = os.itemId || os.id
      if (!existingIds.has(osId) && (!osName || !existingNames.has(osName))) {
        list.push({
          id: osId,
          name: os.name,
          unit: os.unit || "kg",
          cost: os.cost || 0,
          stock: os.openingQty || 0,
          minStock: 5
        })
        if (osName) existingNames.add(osName)
        if (osId) existingIds.add(osId)
      }
    })

    // Also include any items bought this month if not already in inventory or opening stock
    mPurchases.forEach(p => {
      const pName = p.item?.trim().toLowerCase()
      const pId = p.itemId || p.id
      if (!existingIds.has(pId) && (!pName || !existingNames.has(pName))) {
        list.push({
          id: pId,
          name: p.item || "Unknown Item",
          unit: p.unit || "kg",
          cost: p.cpu || p.price || 0,
          stock: 0,
          minStock: 5
        })
        if (pName) existingNames.add(pName)
        if (pId) existingIds.add(pId)
      }
    })

    // Also include any items used this month if not already in inventory, opening stock, or purchases
    Object.keys(monthUsages).forEach(uId => {
      if (!existingIds.has(uId)) {
        const invMatch = (inventory || []).find(i => i.id === uId)
        const uName = invMatch?.name || "Used Ingredient"
        if (!existingNames.has(uName.toLowerCase())) {
          list.push({
            id: uId,
            name: uName,
            unit: invMatch?.unit || "kg",
            cost: invMatch?.cost || 0,
            stock: 0,
            minStock: 5
          })
          existingIds.add(uId)
          existingNames.add(uName.toLowerCase())
        }
      }
    })

    return list
  }, [inventory, osItems, mPurchases, monthUsages])

  const hasMonthData = mPurchases.length > 0 || mExp.length > 0 || osItems.length > 0 || mRevenue.length > 0

  const dl = () => {
    const w = window.open("", "_blank")
    w.document.write(`<!DOCTYPE html><html><head><title>Monthly Overview ${monthLabel}</title>
    <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;color:#291608;padding:32px;max-width:800px;margin:0 auto}
    h1{font-size:22px;font-weight:700;color:${company?.primaryColor || "var(--gold)"}}
    h2{font-size:13px;color:#888;font-weight:400;margin:4px 0 20px}
    .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:16px 0}
    .card{border:1px solid #E0D3BB;border-radius:8px;padding:12px}
    .label{font-size:10px;text-transform:uppercase;letter-spacing:.8px;color:#888;margin-bottom:4px}
    .val{font-size:18px;font-weight:700;color:#291608}
    table{width:100%;border-collapse:collapse;margin:14px 0;font-size:13px}
    th{background:#EDE5D6;padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.8px;color:#888;font-weight:500}
    td{padding:8px 10px;border-bottom:1px solid #E0D3BB}
    .total{background:#F5F0E4;font-weight:700}
    .sec{margin-top:24px;font-size:14px;font-weight:700;color:#291608;border-bottom:2px solid ${company?.primaryColor || "var(--gold)"};padding-bottom:4px;margin-bottom:10px}
    </style></head><body>
    ${company?.logo ? `<img src="${company.logo}" style="height:50px;margin-bottom:10px;display:block"/>` : ""}
    <h1>${company?.name || "Bakery"} — Monthly Overview</h1>
    <h2>${monthLabel}</h2>
    <div class="grid">
      <div class="card"><div class="label">Revenue</div><div class="val">₦${Math.round(rev).toLocaleString()}</div><div style="font-size:11px;color:#888;margin-top:3px">${paid.length} confirmed orders</div></div>
      <div class="card"><div class="label">Production cost</div><div class="val">₦${Math.round(prodCost).toLocaleString()}</div></div>
      <div class="card"><div class="label">Overheads</div><div class="val">₦${Math.round(overhead).toLocaleString()}</div></div>
      <div class="card"><div class="label">Net profit</div><div class="val" style="color:${profit >= 0 ? "#357A52" : "#B03A2E"}">₦${Math.round(profit).toLocaleString()}</div><div style="font-size:11px;color:#888;margin-top:3px">${margin}% margin</div></div>
    </div>
    <div class="sec">Confirmed Orders — Revenue</div>
    <table><tr><th>Delivery date</th><th>Client</th><th>Product</th><th>Ingredient cost</th><th style="text-align:right">Sale price</th></tr>
    ${mRevenue.map(p => `<tr><td>${p.deliveryDate || p.dueDate || p.orderDate || ""}</td><td>${p.client || ""}</td><td>${p.productType || "Cake"}${p.size ? " — " + p.size : ""}</td><td>₦${Math.round(p.cost || 0).toLocaleString()}</td><td style="text-align:right;font-weight:600;color:#C8912A">₦${Math.round(p.salePrice || 0).toLocaleString()}</td></tr>`).join("")}
    ${mRevenue.length === 0 ? `<tr><td colspan="5" style="color:#888;font-style:italic;padding:12px">No confirmed orders this month</td></tr>` : ""}
    <tr class="total"><td colspan="3" style="text-align:right">Total</td><td>₦${Math.round(prodCost).toLocaleString()}</td><td style="text-align:right">₦${Math.round(rev).toLocaleString()}</td></tr></table>
    <div class="sec">Stock Movement ${isRolledOver ? "(Rolled Over from Previous Month)" : ""}</div>
    <table><tr><th>Item</th><th>Unit</th><th>Opening</th><th>+ Bought</th><th>− Used</th><th>Closing</th><th>Value</th></tr>
    ${allStockItems.map(item => {
      const opening = getOSQty(item)
      const cost = item.cost || 0
      const unit = item.unit || ""
      const bought = getBought(item)
      const used = getUsed(item)
      const closing = Math.max(0, parseFloat((opening + bought - used).toFixed(3)))
      return `<tr><td>${item.name}</td><td>${unit}</td><td>${opening}</td><td style="color:#357A52">+${bought}</td><td style="color:#B03A2E">−${used}</td><td><strong>${closing}</strong></td><td>₦${Math.round(closing * cost).toLocaleString()}</td></tr>`
    }).join("")}
    <tr class="total"><td colspan="6" style="text-align:right">Total closing stock value</td><td>₦${Math.round(allStockItems.reduce((s, i) => {
      const opening = getOSQty(i)
      const bought = getBought(i)
      const used = getUsed(i)
      const closing = Math.max(0, parseFloat((opening + bought - used).toFixed(3)))
      return s + closing * (i.cost || 0)
    }, 0)).toLocaleString()}</td></tr></table>
    <div class="sec">Overhead Expenses</div>
    <table><tr><th>Date</th><th>Description</th><th>Category</th><th style="text-align:right">Amount</th></tr>
    ${mExp.map(e => `<tr><td>${e.date || ""}</td><td>${e.description || ""}</td><td>${e.category || ""}</td><td style="text-align:right">₦${Math.round(e.amount || 0).toLocaleString()}</td></tr>`).join("")}
    <tr class="total"><td colspan="3" style="text-align:right">Total</td><td style="text-align:right">₦${Math.round(overhead).toLocaleString()}</td></tr></table>
    <p style="font-size:10px;color:#aaa;margin-top:24px">Generated by BakeWealth · ${new Date().toLocaleDateString()}</p>
    <script>window.print()<\/script></body></html>`)
    w.document.close()
  }

  return (
    <div>
      <SHead title="Monthly Overview" sub="P&L · Stock movement · Purchases · Expenses — everything in one place" />

      {successMsg && (
        <div style={{ marginBottom: 14, padding: "10px 14px", borderRadius: 8, background: "#E1F5EE", border: "1px solid #5DCAA5", color: "#085041", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
          <CheckCircle size={16} color="#0F6E56" />
          <span>{successMsg}</span>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
        <select value={sel} onChange={e => setSel(e.target.value)} style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--panel)", fontSize: 13, color: "var(--text)" }}>
          {months.map(m => (
            <option key={m} value={m}>
              {new Date(m + "-02").toLocaleDateString("en-NG", { month: "long", year: "numeric" })}
            </option>
          ))}
        </select>
        <Btn onClick={dl} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Download size={13} /> Download PDF</Btn>
        {isOwner && (
          deletingAll ? (
            <Spinner />
          ) : (
            <Btn
              small
              variant="ghost"
              disabled={deletingAll}
              style={{ color: "#B03A2E", borderColor: "#F2DEDE", fontSize: "11.5px", fontWeight: "normal", padding: "4px 8px", display: "inline-flex", alignItems: "center", gap: 4 }}
              onClick={handleClearMonthData}
            >
              <Trash2 size={12} /> Clear Month Data
            </Btn>
          )
        )}
        {loadingOS ? (
          <span style={{ fontSize: 12, color: "var(--muted)", display: "inline-flex", alignItems: "center", gap: 4 }}>
            <Spinner size={12} /> Loading stock...
          </span>
        ) : isRolledOver ? (
          <span style={{ fontSize: 12, color: "#0F6E56", background: "#E1F5EE", padding: "4px 10px", borderRadius: 20, display: "inline-flex", alignItems: "center", gap: 4 }}>
            <CheckCircle size={12} /> Opening stock auto-rolled over from previous month's closing stock
          </span>
        ) : osItems.length === 0 ? (
          <span style={{ fontSize: 12, color: "#B03A2E", background: "#FDEBE9", padding: "4px 10px", borderRadius: 20, display: "inline-flex", alignItems: "center", gap: 4 }}>
            <AlertTriangle size={12} /> No opening stock set for {monthLabel} — configure in Settings → Opening Stock
          </span>
        ) : null}
      </div>

      {/* P&L CARDS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px, 1fr))", gap: 10, marginBottom: 16 }}>
        {[
          { l: "Revenue", v: fmt(rev), s: `${paid.length} confirmed orders`, c: "var(--gold)" },
          { l: "Production Cost", v: fmt(prodCost), s: "ingredient cost", c: "#2A5F9A" },
          { l: "Overheads", v: fmt(overhead), s: "non-ingredient", c: "var(--muted)" },
          { l: "Net Profit", v: fmt(profit), s: `${margin}% margin`, c: profit >= 0 ? "#357A52" : "#B03A2E" }
        ].map(s => (
          <Card key={s.l} style={{ borderTop: `3px solid ${s.c}`, borderRadius: "0 0 12px 12px" }}>
            <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 5 }}>{s.l}</div>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 19, fontWeight: 700, color: s.l === "Net Profit" ? s.c : "var(--text)" }}>{s.v}</div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{s.s}</div>
          </Card>
        ))}
      </div>

      {/* CONFIRMED ORDERS — REVENUE */}
      <Card style={{ padding: 0, overflowX: "auto", marginBottom: 14 }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 14, fontWeight: 600 }}>Confirmed orders — {monthLabel}</div>
          <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{paid.length} order{paid.length !== 1 ? "s" : ""} · Revenue: {fmt(rev)}</div>
        </div>
        {mRevenue.length === 0 ? (
          <div style={{ padding: "20px 16px", fontSize: 13, color: "var(--muted)", textAlign: "center", fontStyle: "italic" }}>
            No confirmed orders for {monthLabel}. Confirm orders from the Quotes page to see revenue here.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <TH cols={["Delivery date", "Client", "Product", "Ingredient cost", "Sale price", "Profit"]} />
            <tbody>
              {mRevenue.map((p, i) => {
                const pProfit = (p.salePrice || 0) - (p.cost || 0)
                return (
                  <TR2
                    key={p.id}
                    i={i}
                    row={[
                      <span>{p.deliveryDate || p.orderDate || "—"}</span>,
                      <span style={{ fontWeight: 500 }}>{p.client}</span>,
                      <span style={{ color: "var(--muted)" }}>{p.productType || "Cake"}{p.size ? " — " + p.size : ""}</span>,
                      <span style={{ color: "#2A5F9A" }}>{fmt(p.cost || 0)}</span>,
                      <span style={{ fontWeight: 600, color: "var(--gold)" }}>{fmt(p.salePrice || 0)}</span>,
                      <span style={{ fontWeight: 600, color: pProfit >= 0 ? "#357A52" : "#B03A2E" }}>{fmt(pProfit)}</span>
                    ]}
                  />
                )
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: "#F5F0E4" }}>
                <td colSpan={3} style={{ padding: "10px", textAlign: "right", fontWeight: 600, fontSize: 13 }}>Totals</td>
                <td style={{ padding: "10px", fontWeight: 600, color: "#2A5F9A" }}>{fmt(prodCost)}</td>
                <td style={{ padding: "10px", fontWeight: 700, color: "var(--gold)", fontSize: 15 }}>{fmt(rev)}</td>
                <td style={{ padding: "10px", fontWeight: 700, color: profit >= 0 ? "#357A52" : "#B03A2E", fontSize: 15 }}>{fmt(rev - prodCost)}</td>
              </tr>
            </tfoot>
          </table>
        )}
        {Object.keys(byType).length > 1 && (
          <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border)", display: "flex", gap: 16, flexWrap: "wrap" }}>
            {Object.entries(byType).map(([type, data]) => (
              <span key={type} style={{ fontSize: 12, color: "var(--muted)" }}>
                {type}: <strong style={{color: "var(--gold)"}}>{fmt(data.rev)}</strong> ({data.qty} orders)
              </span>
            ))}
          </div>
        )}
      </Card>

      {/* STOCK MOVEMENT */}
      <Card style={{ padding: 0, overflowX: "auto", marginBottom: 14 }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 14, fontWeight: 600 }}>Stock movement — {monthLabel}</div>
          <div style={{ fontSize: 11.5, color: "var(--muted)" }}>Opening + Bought − Used = Closing</div>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <TH cols={["Item", "Unit", "Opening", "+ Bought", "− Used", "Closing", "Cost/unit", "Value"]} />
          <tbody>
            {allStockItems.map((item, i) => {
              const opening = getOSQty(item)
              const bought = getBought(item)
              const used = getUsed(item)
              const closing = Math.max(0, parseFloat((opening + bought - used).toFixed(3)))
              const isLow = closing <= (item.minStock || 5)
              return (
                <TR2
                  key={item.id}
                  i={i}
                  row={[
                    <span style={{ fontWeight: 500 }}>{item.name}</span>,
                    <span style={{ color: "var(--muted)" }}>{item.unit}</span>,
                    <span>{opening} {item.unit}</span>,
                    <span style={{ color: "#357A52", fontWeight: 500 }}>+{bought} {item.unit}</span>,
                    <span style={{ color: "#B03A2E" }}>−{used} {item.unit}</span>,
                    <span style={{ fontWeight: 600, color: isLow ? "#B03A2E" : "#357A52", display: "inline-flex", alignItems: "center", gap: 3 }}>
                      {closing} {item.unit}{isLow && <AlertTriangle size={11} />}
                    </span>,
                    <span style={{ color: "var(--gold)" }}>{fmt(item.cost)}/{item.unit}</span>,
                    <span style={{ fontWeight: 500 }}>{fmt(closing * item.cost)}</span>
                  ]}
                />
              )
            })}
          </tbody>
          <tfoot>
            <tr style={{ background: "#F5F0E4" }}>
              <td colSpan={7} style={{ padding: "10px", textAlign: "right", fontWeight: 600, fontSize: 13 }}>Total closing stock value</td>
              <td style={{ padding: "10px", textAlign: "left", fontWeight: 700, color: "var(--gold)", fontSize: 15 }}>{fmt(allStockItems.reduce((s, i) => {
                const opening = getOSQty(i)
                const bought = getBought(i)
                const used = getUsed(i)
                const closing = Math.max(0, parseFloat((opening + bought - used).toFixed(3)))
                return s + closing * (i.cost || 0)
              }, 0))}</td>
            </tr>
          </tfoot>
        </table>
      </Card>

      {/* PURCHASES + EXPENSES SIDE BY SIDE */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Card>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Purchases this month</div>
          {mPurchases.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--muted)" }}>No purchases logged for {monthLabel}.</div>
          ) : (
            <>
              {Object.entries(mPurchases.reduce((acc, p) => {
                if (!acc[p.item]) acc[p.item] = { count: 0, total: 0, qty: 0, unit: p.unit }
                acc[p.item].count++
                acc[p.item].total += p.total || 0
                acc[p.item].qty += p.stockAdded || 0
                return acc
              }, {})).map(([name, d]) => (
                <div key={name} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border)", fontSize: 12.5 }}>
                  <span>{name} <span style={{ color: "var(--muted)", fontSize: 11 }}>×{d.count}</span></span>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ color: "#357A52", fontWeight: 500 }}>+{d.qty.toFixed(1)} {d.unit}</div>
                    <div style={{ color: "var(--muted)", fontSize: 11 }}>{fmt(d.total)}</div>
                  </div>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontWeight: 600, fontSize: 13 }}>
                <span>Total spent on ingredients</span>
                <span style={{ color: "var(--gold)" }}>{fmt(mPurchases.reduce((s, p) => s + (p.total || 0), 0))}</span>
              </div>
            </>
          )}
        </Card>
        
        <Card>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Overhead expenses</div>
          {mExp.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--muted)" }}>No overhead expenses for {monthLabel}.</div>
          ) : (
            <>
              {mExp.slice(0, 6).map(e => (
                <div key={e.id} style={{ display: "flex", justifyItems: "space-between", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border)", fontSize: 12.5 }}>
                  <span style={{ flex: 1, marginRight: 8 }}>{e.description || e.category}</span>
                  <span style={{ color: "var(--muted)", flexShrink: 0 }}>{fmt(e.amount || 0)}</span>
                </div>
              ))}
              {mExp.length > 6 && <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 4 }}>+{mExp.length - 6} more expenses</div>}
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontWeight: 600, fontSize: 13 }}>
                <span>Total overheads</span>
                <span style={{ color: "var(--gold)" }}>{fmt(overhead)}</span>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
