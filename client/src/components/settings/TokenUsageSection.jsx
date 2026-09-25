import React, { useState, useEffect, useCallback, useMemo } from "react"
import { Card, Btn, Badge, TH, TR2, Pagination } from "../common/ui.jsx"
import {
  Coins, Zap, RefreshCw, ArrowUpRight, ArrowDownLeft, CreditCard,
  MessageSquare, Search, X, ShieldCheck, CheckCircle, AlertTriangle,
  Sparkles, Check, Clock, Users, BookOpen, Package, ShoppingBag, Gift
} from "lucide-react"
import {
  fetchTokenBalance,
  fetchTokenHistory,
  fetchPlanInfo,
  purchasePlan,
  claimFreeScans,
  purchaseCreditPack,
  purchaseTokens,
  loadLocal
} from "../../lib/data.js"
import { DummyPaymentGatewayModal } from "../common/DummyPaymentGatewayModal.jsx"

export const CREDIT_PACKS = [
  {
    id: "small",
    name: "Small Pack",
    credits: 20,
    price: 3000,
    scans: 10,
    statements: 4,
    popular: false,
    description: "Roughly 10 receipt scans or 4 bank statement imports. Ideal for occasional top-ups."
  },
  {
    id: "medium",
    name: "Medium Pack",
    credits: 50,
    price: 6500,
    scans: 25,
    statements: 10,
    popular: true,
    description: "Roughly 25 receipt scans or 10 bank statement imports. Best value for active bakers."
  },
  {
    id: "large",
    name: "Large Pack",
    credits: 120,
    price: 14000,
    scans: 60,
    statements: 24,
    popular: false,
    description: "Roughly 60 receipt scans or 24 bank statement imports. Maximum credit efficiency."
  }
]

export const PREPAID_PLANS = [
  {
    id: "standard",
    name: "Standard Plan",
    monthlyPrice: 5000,
    scansPerMonth: 20,
    creditsPerMonth: 40,
    tagline: "Essential tools for growing home & boutique bakers",
    color: "#C8912A",
    limits: {
      orders: "Unlimited",
      recipes: "60 recipes",
      inventory: "250 items",
      clients: "150 clients",
      staff: "2 staff logins (+ owner)",
      scans: "20 scans / month (40 credits)",
      branding: "BakeWealth mark",
      accounting: "Full accounting reports"
    }
  },
  {
    id: "premium",
    name: "Premium Plan",
    monthlyPrice: 10000,
    scansPerMonth: 80,
    creditsPerMonth: 160,
    tagline: "Unlimited scale & unbranded invoices for established bakeries",
    color: "#1E293B",
    popular: true,
    limits: {
      orders: "Unlimited",
      recipes: "Unlimited recipes",
      inventory: "Unlimited items",
      clients: "Unlimited clients",
      staff: "4 staff logins (+ owner)",
      scans: "80 scans / month (160 credits)",
      branding: "Removed — Your own logo only",
      accounting: "Full accounting reports"
    }
  }
]

export const DURATION_OPTIONS = [
  { months: 1, discount: 0, label: "1 Month" },
  { months: 3, discount: 5, label: "3 Months (5% off)" },
  { months: 6, discount: 10, label: "6 Months (10% off)" },
  { months: 12, discount: 15, label: "12 Months (15% off)" }
]

export function TokenUsageSection({ company = {} }) {
  const [balance, setBalance] = useState(() => {
    const t = loadLocal("ll_tenant_info", null)
    return typeof t?.tokenBalance === "number" ? t.tokenBalance : 0
  })
  const [planInfo, setPlanInfo] = useState(null)
  const [loadingPlan, setLoadingPlan] = useState(false)
  const [history, setHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  // Plan Selection State
  const [selectedPlanId, setSelectedPlanId] = useState("standard")
  const [selectedMonths, setSelectedMonths] = useState(1)

  // Credit Pack Selection State
  const [selectedPackId, setSelectedPackId] = useState("medium")

  // Payment Gateway State
  const [gatewayOpen, setGatewayOpen] = useState(false)
  const [checkoutTarget, setCheckoutTarget] = useState({ type: "pack", amount: 6500, name: "Medium Pack", credits: 50 })
  const [paymentSuccess, setPaymentSuccess] = useState("")
  const [paymentError, setPaymentError] = useState("")
  const [claimingFree, setClaimingFree] = useState(false)

  // Active section tab: "plans" | "credits"
  const [activeTab, setActiveTab] = useState("plans")

  // Pagination & Filtering state
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [filterType, setFilterType] = useState("all") // "all" | "topups" | "deductions"
  const [searchQuery, setSearchQuery] = useState("")

  const loadData = useCallback(async () => {
    setLoadingHistory(true)
    setLoadingPlan(true)
    try {
      const [balRes, histRes, planRes] = await Promise.all([
        fetchTokenBalance().catch(() => null),
        fetchTokenHistory().catch(() => []),
        fetchPlanInfo().catch(() => null)
      ])

      if (typeof balRes?.tokenBalance === "number") {
        setBalance(balRes.tokenBalance)
      } else if (typeof planRes?.tokenBalance === "number") {
        setBalance(planRes.tokenBalance)
      }

      setHistory(Array.isArray(histRes) ? histRes : [])
      if (planRes) {
        setPlanInfo(planRes)
      }
    } catch (err) {
      console.warn("Failed to load token or plan information:", err)
    } finally {
      setLoadingHistory(false)
      setLoadingPlan(false)
    }
  }, [])

  useEffect(() => {
    loadData()

    const onTokenUpdated = (e) => {
      const newBal = e.detail?.creditsDeducted !== undefined
        ? (e.detail?.newBalance ?? e.detail?.tokenBalance)
        : (e.detail?.creditBalance ?? e.detail?.tokenBalance)
      if (typeof newBal === "number") {
        setBalance(newBal)
      }
      fetchTokenHistory().then(hist => {
        if (Array.isArray(hist)) setHistory(hist)
      })
    }

    const onPlanUpdated = () => {
      loadData()
    }

    window.addEventListener("bakewealth:token-updated", onTokenUpdated)
    window.addEventListener("layerledger:token-updated", onTokenUpdated)
    window.addEventListener("layerledger:credit-updated", onTokenUpdated)
    window.addEventListener("bakewealth:plan-updated", onPlanUpdated)

    return () => {
      window.removeEventListener("bakewealth:token-updated", onTokenUpdated)
      window.removeEventListener("layerledger:token-updated", onTokenUpdated)
      window.removeEventListener("layerledger:credit-updated", onTokenUpdated)
      window.removeEventListener("bakewealth:plan-updated", onPlanUpdated)
    }
  }, [loadData])

  // Calculation for Plan purchase
  const selectedPlanObj = PREPAID_PLANS.find(p => p.id === selectedPlanId) || PREPAID_PLANS[0]
  const selectedDurationObj = DURATION_OPTIONS.find(d => d.months === selectedMonths) || DURATION_OPTIONS[0]
  const basePlanPrice = selectedPlanObj.monthlyPrice * selectedMonths
  const planDiscountAmount = Math.round(basePlanPrice * (selectedDurationObj.discount / 100))
  const finalPlanPrice = basePlanPrice - planDiscountAmount
  const planCreditsGranted = selectedPlanObj.creditsPerMonth * selectedMonths

  // Calculation for Credit Pack purchase
  const selectedPack = CREDIT_PACKS.find(p => p.id === selectedPackId) || CREDIT_PACKS[1]

  const handleOpenPlanCheckout = () => {
    setCheckoutTarget({
      type: "plan",
      planId: selectedPlanObj.id,
      months: selectedMonths,
      amount: finalPlanPrice,
      credits: planCreditsGranted,
      name: `${selectedPlanObj.name} (${selectedMonths} Month${selectedMonths > 1 ? "s" : ""})`,
      subtitle: `${planCreditsGranted} scan credits granted instantly. Access stacked to your account.`
    })
    setGatewayOpen(true)
  }

  const handleOpenPackCheckout = () => {
    setCheckoutTarget({
      type: "pack",
      packId: selectedPack.id,
      amount: selectedPack.price,
      credits: selectedPack.credits,
      name: selectedPack.name,
      subtitle: `${selectedPack.credits} credits (~${selectedPack.scans} receipt scans) added. Credits never expire.`
    })
    setGatewayOpen(true)
  }

  const handleGatewaySuccess = async (res) => {
    if (res && typeof res.newBalance === "number") {
      setBalance(res.newBalance)
    }
    if (checkoutTarget.type === "plan") {
      setPaymentSuccess(`Payment successful! ${selectedPlanObj.name} (${selectedMonths} mo) activated with +${planCreditsGranted} scan credits!`)
    } else {
      setPaymentSuccess(`Payment successful! +${checkoutTarget.credits} credits added to your account!`)
    }
    await loadData()
    setTimeout(() => setPaymentSuccess(""), 5000)
  }

  const handleClaimFreeScans = async () => {
    setClaimingFree(true)
    setPaymentError("")
    try {
      const res = await claimFreeScans()
      if (typeof res?.newBalance === "number") {
        setBalance(res.newBalance)
      }
      setPaymentSuccess("Welcome allowance unlocked: 20 free credits (~10 receipt scans) credited to your account!")
      await loadData()
      setTimeout(() => setPaymentSuccess(""), 5000)
    } catch (err) {
      setPaymentError(err.message || "Failed to claim free scans.")
    } finally {
      setClaimingFree(false)
    }
  }

  const handleWhatsAppOrder = (itemText) => {
    const adminPhone = company.phone || "2348000000000"
    const cleanPhone = adminPhone.replace(/[^0-9]/g, "").replace(/^0/, "234")
    const text = encodeURIComponent(
      `Hello! I would like to pay for ${itemText} for my bakery account: "${company.name || "My Bakery"}". Current credit balance: ${Number(balance).toFixed(1)}.`
    )
    window.open(`https://wa.me/${cleanPhone}?text=${text}`, "_blank")
  }

  // Aggregate statistics for transaction ledger
  const stats = useMemo(() => {
    let totalAdded = 0
    let totalDeducted = 0
    let topUpsCount = 0
    let deductionsCount = 0

    history.forEach(tx => {
      const amt = Number(tx.amount) || 0
      if (amt > 0) {
        totalAdded += amt
        topUpsCount++
      } else if (amt < 0) {
        totalDeducted += Math.abs(amt)
        deductionsCount++
      }
    })

    return {
      totalAdded,
      totalDeducted,
      topUpsCount,
      deductionsCount,
      totalCount: history.length
    }
  }, [history])

  // Filter by Type (All / Top-Ups / Deductions) & Search query
  const filteredHistory = useMemo(() => {
    return history.filter(tx => {
      const amt = Number(tx.amount) || 0
      if (filterType === "topups" && amt <= 0) return false
      if (filterType === "deductions" && amt >= 0) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const desc = (tx.description || "").toLowerCase()
        const type = (tx.type || "").toLowerCase()
        if (!desc.includes(q) && !type.includes(q)) return false
      }
      return true
    })
  }, [history, filterType, searchQuery])

  // Calculate safe page and slice items for pagination
  const effectivePageSize = pageSize === "all" ? Math.max(1, filteredHistory.length) : (Number(pageSize) || 10)
  const totalPages = Math.max(1, Math.ceil(filteredHistory.length / effectivePageSize))
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages)

  const paginatedHistory = useMemo(() => {
    if (pageSize === "all") return filteredHistory
    const sz = Number(pageSize) || 10
    const start = (safeCurrentPage - 1) * sz
    return filteredHistory.slice(start, start + sz)
  }, [filteredHistory, safeCurrentPage, pageSize])

  const scansRemaining = Math.floor(balance / 2)
  const effectivePlan = planInfo?.plan || "free"
  const isPaidPlan = effectivePlan === "standard" || effectivePlan === "premium" || effectivePlan === "studio"

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* 1. Header & Active Plan Status Banner */}
      <Card style={{
        background: "linear-gradient(135deg, #FAF7F0 0%, #F5EFE3 100%)",
        border: "1px solid #E6D8BA",
        position: "relative",
        overflow: "hidden"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 14 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 700 }}>
                BakeWealth Prepaid Access
              </span>
              <span style={{ fontSize: 11, color: "var(--muted)" }}>• 5 September 2026</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 700, margin: 0, color: "var(--text)" }}>
                {(effectivePlan === "premium" || effectivePlan === "studio") ? "Premium Plan" : effectivePlan === "standard" ? "Standard Plan" : "Free Plan"}
              </h2>
              <Badge color={(effectivePlan === "premium" || effectivePlan === "studio") ? "purple" : effectivePlan === "standard" ? "gold" : "gray"}>
                {effectivePlan === "studio" ? "PREMIUM" : effectivePlan.toUpperCase()}
              </Badge>
              {isPaidPlan && planInfo?.daysRemaining > 0 && (
                <span style={{ fontSize: 12, color: "#27AE60", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <Clock size={13} /> {planInfo.daysRemaining} days active remaining
                </span>
              )}
            </div>
            <p style={{ margin: "6px 0 0 0", fontSize: 12.5, color: "var(--muted)", maxWidth: 640, lineHeight: 1.4 }}>
              {isPaidPlan
                ? "Prepaid & stackable. No recurring card debit or cancellation: extra months stack onto your remaining time."
                : "Explore BakeWealth without commitments. Upgrade anytime to unlock higher recipe and inventory capacities."}
            </p>
          </div>

          {/* Balance Widget */}
          <div style={{
            background: "#fff",
            padding: "12px 18px",
            borderRadius: 12,
            border: "1px solid var(--border)",
            minWidth: 200,
            boxShadow: "0 2px 6px rgba(0,0,0,0.03)"
          }}>
            <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", fontWeight: 600, marginBottom: 4 }}>
              Current Credit Balance
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 2 }}>
              <Coins size={22} color="var(--gold)" />
              <span style={{ fontSize: 26, fontWeight: 700, color: "var(--text)" }}>
                {Number(balance).toFixed(1)}
              </span>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>Credits</span>
            </div>
            <div style={{ fontSize: 12, color: scansRemaining > 0 ? "var(--gold)" : "#B03A2E", fontWeight: 600 }}>
              ≈ {scansRemaining} Scans Available
            </div>
            <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 2 }}>
              2 credits / receipt • 5 / statement
            </div>
          </div>
        </div>

        {/* Free Scans Claim CTA if available */}
        {planInfo && !planInfo.freeScansGranted && (
          <div style={{
            marginTop: 16,
            background: "#EEF8F3",
            border: "1px solid #C2E0CF",
            borderRadius: 10,
            padding: "12px 16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 10
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Gift size={20} color="#2D7A50" />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#2D7A50" }}>
                  Claim Your 10 Free Scans (20 Credits)
                </div>
                <div style={{ fontSize: 11.5, color: "#3B6E52" }}>
                  One-time trial allowance: scan your market receipts and watch your inventory & recipe costs update automatically.
                </div>
              </div>
            </div>
            <Btn
              small
              disabled={claimingFree}
              onClick={handleClaimFreeScans}
              style={{ background: "#27AE60", color: "#fff", fontWeight: 600 }}
            >
              {claimingFree ? "Claiming..." : "Claim 10 Free Scans"}
            </Btn>
          </div>
        )}

        {/* Live Usage Quotas */}
        {planInfo?.limits && planInfo?.usage && (() => {
          const ordersUsed = planInfo.usage.ordersThisMonth ?? 0
          const recipesUsed = planInfo.usage.recipesCount ?? planInfo.usage.recipes ?? 0
          const inventoryUsed = planInfo.usage.inventoryCount ?? planInfo.usage.inventoryItems ?? 0
          const clientsUsed = planInfo.usage.clientsCount ?? planInfo.usage.clients ?? 0
          const staffUsed = planInfo.usage.staffCount ?? planInfo.usage.staffLogins ?? 0

          return (
            <div style={{ marginTop: 18, borderTop: "1px solid rgba(200,145,42,0.2)", paddingTop: 14 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10 }}>
                Account Capacity & Limits ({effectivePlan.toUpperCase()})
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
                {/* Orders */}
                <div style={{ background: "#fff", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>
                    <span>Orders / Month</span>
                    <span style={{ fontWeight: 600, color: "var(--text)" }}>
                      {planInfo.limits.ordersPerMonth === null ? "Unlimited" : `${ordersUsed} / ${planInfo.limits.ordersPerMonth}`}
                    </span>
                  </div>
                  <div style={{ width: "100%", height: 6, background: "#F1EEDB", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{
                      width: planInfo.limits.ordersPerMonth === null ? "100%" : `${Math.min(100, (ordersUsed / (planInfo.limits.ordersPerMonth || 1)) * 100)}%`,
                      height: "100%",
                      background: planInfo.limits.ordersPerMonth === null ? "#27AE60" : "var(--gold)",
                      borderRadius: 4
                    }} />
                  </div>
                </div>

                {/* Recipes */}
                <div style={{ background: "#fff", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>
                    <span>Recipes</span>
                    <span style={{ fontWeight: 600, color: "var(--text)" }}>
                      {planInfo.limits.recipes === null ? "Unlimited" : `${recipesUsed} / ${planInfo.limits.recipes}`}
                    </span>
                  </div>
                  <div style={{ width: "100%", height: 6, background: "#F1EEDB", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{
                      width: planInfo.limits.recipes === null ? "100%" : `${Math.min(100, (recipesUsed / (planInfo.limits.recipes || 1)) * 100)}%`,
                      height: "100%",
                      background: planInfo.limits.recipes === null ? "#27AE60" : "var(--gold)",
                      borderRadius: 4
                    }} />
                  </div>
                </div>

                {/* Inventory Items */}
                <div style={{ background: "#fff", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>
                    <span>Inventory Items</span>
                    <span style={{ fontWeight: 600, color: "var(--text)" }}>
                      {planInfo.limits.inventoryItems === null ? "Unlimited" : `${inventoryUsed} / ${planInfo.limits.inventoryItems}`}
                    </span>
                  </div>
                  <div style={{ width: "100%", height: 6, background: "#F1EEDB", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{
                      width: planInfo.limits.inventoryItems === null ? "100%" : `${Math.min(100, (inventoryUsed / (planInfo.limits.inventoryItems || 1)) * 100)}%`,
                      height: "100%",
                      background: planInfo.limits.inventoryItems === null ? "#27AE60" : "var(--gold)",
                      borderRadius: 4
                    }} />
                  </div>
                </div>

                {/* Clients */}
                <div style={{ background: "#fff", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>
                    <span>Clients</span>
                    <span style={{ fontWeight: 600, color: "var(--text)" }}>
                      {planInfo.limits.clients === null ? "Unlimited" : `${clientsUsed} / ${planInfo.limits.clients}`}
                    </span>
                  </div>
                  <div style={{ width: "100%", height: 6, background: "#F1EEDB", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{
                      width: planInfo.limits.clients === null ? "100%" : `${Math.min(100, (clientsUsed / (planInfo.limits.clients || 1)) * 100)}%`,
                      height: "100%",
                      background: planInfo.limits.clients === null ? "#27AE60" : "var(--gold)",
                      borderRadius: 4
                    }} />
                  </div>
                </div>

                {/* Staff Logins */}
                <div style={{ background: "#fff", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>
                    <span>Staff Logins</span>
                    <span style={{ fontWeight: 600, color: "var(--text)" }}>
                      {planInfo.limits.staffLogins === null ? "Unlimited" : (planInfo.limits.staffLogins === 0 ? "0 / 0 (Owner)" : `${staffUsed} / ${planInfo.limits.staffLogins}`)}
                    </span>
                  </div>
                  <div style={{ width: "100%", height: 6, background: "#F1EEDB", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{
                      width: planInfo.limits.staffLogins === null ? "100%" : `${Math.min(100, (staffUsed / (planInfo.limits.staffLogins || 1)) * 100)}%`,
                      height: "100%",
                      background: planInfo.limits.staffLogins === null ? "#27AE60" : "var(--gold)",
                      borderRadius: 4
                    }} />
                  </div>
                </div>
              </div>
            </div>
          )
        })()}
      </Card>

      {/* Notifications */}
      {paymentSuccess && (
        <div style={{ background: "#EEF8F3", border: "1px solid #C2E0CF", borderRadius: 8, padding: "12px 16px", fontSize: 13, color: "#2D7A50", display: "flex", alignItems: "center", gap: 8 }}>
          <CheckCircle size={18} color="#2D7A50" />
          <span>{paymentSuccess}</span>
        </div>
      )}

      {paymentError && (
        <div style={{ background: "#FDEBE9", border: "1px solid #F0A89E", borderRadius: 8, padding: "12px 16px", fontSize: 13, color: "#B03A2E", display: "flex", alignItems: "center", gap: 8 }}>
          <AlertTriangle size={18} color="#B03A2E" />
          <span>{paymentError}</span>
        </div>
      )}

      {/* 2. Navigation Tabs for Plans vs Credit Packs */}
      <div style={{ display: "flex", gap: 10, borderBottom: "2px solid var(--border)", paddingBottom: 6 }}>
        <button
          type="button"
          onClick={() => setActiveTab("plans")}
          style={{
            background: "none",
            border: "none",
            borderBottom: activeTab === "plans" ? "3px solid var(--gold)" : "3px solid transparent",
            padding: "8px 16px",
            fontSize: 14,
            fontWeight: 700,
            color: activeTab === "plans" ? "var(--gold)" : "var(--muted)",
            cursor: "pointer",
            marginBottom: -8,
            display: "flex",
            alignItems: "center",
            gap: 6
          }}
        >
          <Sparkles size={16} />
          <span>Prepaid Stackable Plans</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("credits")}
          style={{
            background: "none",
            border: "none",
            borderBottom: activeTab === "credits" ? "3px solid var(--gold)" : "3px solid transparent",
            padding: "8px 16px",
            fontSize: 14,
            fontWeight: 700,
            color: activeTab === "credits" ? "var(--gold)" : "var(--muted)",
            cursor: "pointer",
            marginBottom: -8,
            display: "flex",
            alignItems: "center",
            gap: 6
          }}
        >
          <Coins size={16} />
          <span>Scan & Import Credit Packs</span>
        </button>
      </div>

      {/* 3. Tab Content: Prepaid Plans */}
      {activeTab === "plans" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Duration Selector with Discounts */}
          <div style={{
            background: "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: "14px 18px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12
          }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
                Select Prepaid Duration
              </div>
              <div style={{ fontSize: 11.5, color: "var(--muted)" }}>
                Multi-month purchases include progressive discounts: 3 mo (5%), 6 mo (10%), 12 mo (15%). Stackable anytime.
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {DURATION_OPTIONS.map(d => (
                <button
                  key={d.months}
                  type="button"
                  onClick={() => setSelectedMonths(d.months)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 8,
                    border: selectedMonths === d.months ? "2px solid var(--gold)" : "1px solid var(--border)",
                    background: selectedMonths === d.months ? "rgba(200,145,42,0.1)" : "#fff",
                    color: selectedMonths === d.months ? "var(--gold)" : "var(--text)",
                    fontWeight: selectedMonths === d.months ? 700 : 500,
                    fontSize: 12.5,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6
                  }}
                >
                  <span>{d.label}</span>
                  {d.discount > 0 && (
                    <span style={{
                      background: selectedMonths === d.months ? "var(--gold)" : "#27AE60",
                      color: "#fff",
                      fontSize: 10,
                      fontWeight: 700,
                      padding: "1px 5px",
                      borderRadius: 6
                    }}>
                      -{d.discount}%
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Plans Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
            {PREPAID_PLANS.map(p => {
              const isSelected = selectedPlanId === p.id
              const basePrice = p.monthlyPrice * selectedMonths
              const discountAmt = Math.round(basePrice * (selectedDurationObj.discount / 100))
              const finalPrice = basePrice - discountAmt
              const totalCredits = p.creditsPerMonth * selectedMonths

              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedPlanId(p.id)}
                  style={{
                    background: "var(--panel)",
                    border: isSelected ? "2px solid var(--gold)" : "1px solid var(--border)",
                    borderRadius: 14,
                    padding: 20,
                    cursor: "pointer",
                    position: "relative",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    boxShadow: isSelected ? "0 4px 14px rgba(200,145,42,0.15)" : "none",
                    transition: "all 0.15s ease"
                  }}
                >
                  {p.popular && (
                    <div style={{
                      position: "absolute",
                      top: -11,
                      right: 20,
                      background: "var(--gold)",
                      color: "#fff",
                      fontSize: 10,
                      fontWeight: 700,
                      padding: "2px 10px",
                      borderRadius: 10,
                      textTransform: "uppercase",
                      letterSpacing: 0.5
                    }}>
                      Recommended for Scale
                    </div>
                  )}

                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                      <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, margin: 0, color: "var(--text)" }}>
                        {p.name}
                      </h3>
                      <span style={{ fontSize: 12, color: "var(--muted)" }}>
                        ₦{p.monthlyPrice.toLocaleString()} / mo
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 14, minHeight: 34 }}>
                      {p.tagline}
                    </div>

                    {/* Price display with discount */}
                    <div style={{
                      background: "#F5EFE3",
                      padding: "12px 14px",
                      borderRadius: 10,
                      marginBottom: 16
                    }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                        <span style={{ fontSize: 26, fontWeight: 700, color: "var(--gold)" }}>
                          ₦{finalPrice.toLocaleString()}
                        </span>
                        <span style={{ fontSize: 12, color: "var(--muted)" }}>
                          for {selectedMonths} month{selectedMonths > 1 ? "s" : ""}
                        </span>
                        {discountAmt > 0 && (
                          <span style={{ fontSize: 11, color: "#27AE60", fontWeight: 700, marginLeft: "auto" }}>
                            Save ₦{discountAmt.toLocaleString()}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
                        Includes <strong>+{totalCredits} scan credits</strong> (~{p.scansPerMonth * selectedMonths} receipt scans)
                      </div>
                    </div>

                    {/* Feature Limits List */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12.5 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Check size={15} color="#27AE60" />
                        <span>Orders: <strong>{p.limits.orders}</strong></span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Check size={15} color="#27AE60" />
                        <span>Recipes: <strong>{p.limits.recipes}</strong></span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Check size={15} color="#27AE60" />
                        <span>Inventory Items: <strong>{p.limits.inventory}</strong></span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Check size={15} color="#27AE60" />
                        <span>Client Records: <strong>{p.limits.clients}</strong></span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Check size={15} color="#27AE60" />
                        <span>Staff Logins: <strong>{p.limits.staff}</strong></span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Check size={15} color="#27AE60" />
                        <span>Scan Allowance: <strong>{p.limits.scans}</strong></span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Check size={15} color="#27AE60" />
                        <span>Invoices: <strong>{p.limits.branding}</strong></span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Check size={15} color="#27AE60" />
                        <span>Accounting: <strong>Full accounting reports without exception</strong></span>
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: 20 }}>
                    <Btn
                      full
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedPlanId(p.id)
                        handleOpenPlanCheckout()
                      }}
                      style={{
                        background: isSelected ? "var(--gold)" : "#FAF7F0",
                        color: isSelected ? "#fff" : "var(--text)",
                        border: isSelected ? "none" : "1px solid var(--border)",
                        fontWeight: 700,
                        padding: "10px",
                        borderRadius: 8
                      }}
                    >
                      {effectivePlan === p.id ? "Stack & Renew Plan" : `Upgrade to ${p.name}`}
                    </Btn>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Strategic Conversion & Economics Callout (Section 4 of document) */}
          <Card style={{ background: "#F5F0E4", border: "1px solid #E6D8BA" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <Zap size={22} color="var(--gold)" style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ fontSize: 12.5, color: "#5C4623", lineHeight: 1.5 }}>
                <strong>The Premium Arithmetic:</strong> A Standard baker who runs out of scans buys a Medium pack (₦5,000 plan + ₦6,500 pack = <strong>₦11,500</strong> for 45 scans). <strong>Premium is only ₦10,000 for 80 scans</strong> with unlimited recipes, inventory items, and clients. Cheaper, with nearly double the scans.
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* 4. Tab Content: Credit Packs */}
      {activeTab === "credits" && (
        <Card style={{ background: "var(--panel)", border: "1px solid var(--border)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
            <div>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, fontWeight: 700, color: "var(--text)" }}>
                Scan & Import Credit Packs
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                For free users, and for paid users who need more scans than their prepaid plan includes. Credits never expire.
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#27AE60" }}>
              <ShieldCheck size={16} />
              <span>1 Receipt = 2 Credits • 1 Statement = 5 Credits</span>
            </div>
          </div>

          {/* Packages Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 14, marginBottom: 16 }}>
            {CREDIT_PACKS.map(pack => {
              const isSelected = selectedPackId === pack.id
              return (
                <div
                  key={pack.id}
                  onClick={() => setSelectedPackId(pack.id)}
                  style={{
                    border: isSelected ? "2px solid var(--gold)" : "1px solid var(--border)",
                    background: isSelected ? "rgba(200,145,42,0.08)" : "#FAF7F0",
                    borderRadius: 10,
                    padding: 16,
                    cursor: "pointer",
                    position: "relative",
                    transition: "all 0.15s ease"
                  }}
                >
                  {pack.popular && (
                    <div
                      style={{
                        position: "absolute",
                        top: -10,
                        right: 12,
                        background: "var(--gold)",
                        color: "#fff",
                        fontSize: 9.5,
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: 10,
                        textTransform: "uppercase"
                      }}
                    >
                      Best Value
                    </div>
                  )}
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4, color: "var(--text)" }}>
                    {pack.name}
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: "var(--gold)", marginBottom: 4 }}>
                    ₦{pack.price.toLocaleString()}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text)", fontWeight: 600, marginBottom: 6 }}>
                    {pack.credits} Credits (~{pack.scans} scans)
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1.4 }}>
                    {pack.description}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Plain terms summary bar */}
          <div style={{
            background: "#F5EFE3",
            borderRadius: 10,
            padding: "14px 16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12
          }}>
            <div>
              <div style={{ fontSize: 11.5, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 600 }}>
                Selected Credit Pack
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>
                {selectedPack.name} ({selectedPack.credits} credits) — <span style={{ color: "var(--gold)" }}>₦{selectedPack.price.toLocaleString()}</span>
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                Roughly {selectedPack.scans} receipt scans or {selectedPack.statements} bank statement imports.
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Btn
                variant="outline"
                onClick={() => handleWhatsAppOrder(`${selectedPack.name} (${selectedPack.credits} credits for ₦${selectedPack.price.toLocaleString()})`)}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5 }}
              >
                <MessageSquare size={14} />
                <span>Pay via WhatsApp</span>
              </Btn>

              <Btn
                onClick={handleOpenPackCheckout}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600 }}
              >
                <CreditCard size={14} />
                <span>Pay & Top-Up ₦{selectedPack.price.toLocaleString()}</span>
              </Btn>
            </div>
          </div>
        </Card>
      )}

      {/* 5. Credit Usage & Transaction History */}
      <Card style={{ background: "var(--panel)", border: "1px solid var(--border)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
          <div>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, fontWeight: 700, color: "var(--text)" }}>
              Credit Usage & Transaction History
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
              Detailed ledger of every AI scan deduction, credit refund, and prepaid plan grant.
            </div>
          </div>

          <Btn
            small
            variant="ghost"
            onClick={loadData}
            disabled={loadingHistory}
            style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
          >
            <RefreshCw size={13} className={loadingHistory ? "animate-spin" : ""} />
            <span>Refresh</span>
          </Btn>
        </div>

        {/* Aggregate Stats Badges */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 14 }}>
          <div style={{ background: "#FAF7F0", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)" }}>
            <div style={{ fontSize: 10.5, color: "var(--muted)", textTransform: "uppercase" }}>Total Credits In</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#27AE60" }}>+{stats.totalAdded.toFixed(1)}</div>
          </div>
          <div style={{ background: "#FAF7F0", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)" }}>
            <div style={{ fontSize: 10.5, color: "var(--muted)", textTransform: "uppercase" }}>Total Consumed</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#D97706" }}>-{stats.totalDeducted.toFixed(1)}</div>
          </div>
          <div style={{ background: "#FAF7F0", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)" }}>
            <div style={{ fontSize: 10.5, color: "var(--muted)", textTransform: "uppercase" }}>Top-Up Events</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>{stats.topUpsCount}</div>
          </div>
          <div style={{ background: "#FAF7F0", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)" }}>
            <div style={{ fontSize: 10.5, color: "var(--muted)", textTransform: "uppercase" }}>Scan Events</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>{stats.deductionsCount}</div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
          <div style={{ display: "flex", gap: 6 }}>
            {["all", "topups", "deductions"].map(type => (
              <button
                key={type}
                type="button"
                onClick={() => {
                  setFilterType(type)
                  setCurrentPage(1)
                }}
                style={{
                  padding: "5px 10px",
                  borderRadius: 6,
                  border: filterType === type ? "1px solid var(--gold)" : "1px solid var(--border)",
                  background: filterType === type ? "rgba(200,145,42,0.1)" : "#FAF7F0",
                  color: filterType === type ? "var(--gold)" : "var(--text)",
                  fontSize: 12,
                  fontWeight: filterType === type ? 700 : 500,
                  cursor: "pointer"
                }}
              >
                {type === "all" ? "All Entries" : type === "topups" ? "Top-Ups" : "AI Usage"}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ position: "relative" }}>
              <Search size={14} color="var(--muted)" style={{ position: "absolute", left: 9, top: 8 }} />
              <input
                type="text"
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value)
                  setCurrentPage(1)
                }}
                placeholder="Search description or type..."
                style={{
                  padding: "6px 26px 6px 28px",
                  borderRadius: 6,
                  border: "1px solid var(--border)",
                  fontSize: 12,
                  outline: "none"
                }}
              />
              {searchQuery && (
                <X
                  size={14}
                  color="var(--muted)"
                  onClick={() => setSearchQuery("")}
                  style={{ position: "absolute", right: 8, top: 8, cursor: "pointer" }}
                />
              )}
            </div>
          </div>
        </div>

        {/* History Table */}
        {filteredHistory.length === 0 ? (
          <div style={{ textAlign: "center", padding: "26px 10px", color: "var(--muted)", fontSize: 13 }}>
            <Zap size={22} style={{ margin: "0 auto 6px", opacity: 0.4 }} />
            <div>No transactions match your search or filter.</div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <TH cols={["Date & Time", "Description", "Type", "Amount", "Status"]} />
              <tbody>
                {paginatedHistory.map((tx, idx) => {
                  const isDeduction = tx.amount < 0
                  const dateStr = tx.createdAt ? new Date(tx.createdAt).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit"
                  }) : "—"

                  return (
                    <TR2
                      key={tx.id || idx}
                      i={idx}
                      row={[
                        <span style={{ color: "var(--muted)", fontSize: 12 }}>{dateStr}</span>,
                        <span style={{ fontWeight: 500, color: "var(--text)" }}>{tx.description}</span>,
                        <Badge color={isDeduction ? "blue" : "green"}>
                          {tx.type === "ai_usage" ? "AI Scan" : tx.type === "refund" ? "Auto Refund" : tx.type || "Transaction"}
                        </Badge>,
                        <span style={{
                          fontWeight: 700,
                          color: isDeduction ? "#D97706" : "#27AE60",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 3
                        }}>
                          {isDeduction ? (
                            <>
                              <ArrowDownLeft size={13} />
                              <span>{Number(tx.amount).toFixed(1)}</span>
                            </>
                          ) : (
                            <>
                              <ArrowUpRight size={13} />
                              <span>+{Number(tx.amount).toFixed(1)}</span>
                            </>
                          )}
                        </span>,
                        <Badge color="gray">Completed</Badge>
                      ]}
                    />
                  )
                })}
              </tbody>
            </table>

            <Pagination
              currentPage={safeCurrentPage}
              totalItems={filteredHistory.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={(sz) => {
                setPageSize(sz)
                setCurrentPage(1)
              }}
              pageSizeOptions={[5, 10, 25, 50]}
              itemLabel="transactions"
            />
          </div>
        )}
      </Card>

      {/* 6. Checkout Gateway Modal */}
      <DummyPaymentGatewayModal
        isOpen={gatewayOpen}
        onClose={() => setGatewayOpen(false)}
        amount={checkoutTarget.amount}
        tokens={checkoutTarget.credits}
        packageName={checkoutTarget.name}
        customerEmail={company.email || "bakery@bakewealth.com"}
        resourceType={checkoutTarget.type === "plan" ? "subscription_plan" : "credit_pack"}
        resourceId={checkoutTarget.type === "plan" ? checkoutTarget.planId : checkoutTarget.packId}
        options={checkoutTarget.type === "plan" ? { months: checkoutTarget.months } : { packId: checkoutTarget.packId }}
        successTitle="Payment Successful!"
        successSubtitle={checkoutTarget.subtitle}
        onConfirmPay={async (ref) => {
          if (checkoutTarget.type === "plan") {
            return await purchasePlan(checkoutTarget.planId, checkoutTarget.months, ref)
          } else {
            return await purchaseCreditPack(checkoutTarget.packId, ref)
          }
        }}
        onPaymentSuccess={handleGatewaySuccess}
      />
    </div>
  )
}
