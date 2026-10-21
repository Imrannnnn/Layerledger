/**
 * SuperAdminDashboard.jsx
 * ----------------------------------------------------------------------------
 * Super Admin interface for platform owner (Iye Ibe Achem).
 * Features:
 * 1. Workspace Accounts moderation (suspend, delete, adjust credits)
 * 2. Full Subscriptions & Payments Analytics (paying tenants, expiration dates,
 *    renewal tracking, revenue metrics)
 * 3. Grant Complimentary Premium Plan Access for configurable duration (1, 2, or custom days)
 *    with automated Brevo email notification dispatch.
 * ----------------------------------------------------------------------------
 */
import React, { useState, useEffect, useMemo } from "react"
import { Btn, Card, Badge, Inp, SHead, Pagination } from "../common/ui.jsx"
import { fmt } from "../../lib/helpers.js"
import {
  Crown,
  AlertTriangle,
  LogOut,
  Trash2,
  Sparkles,
  Calendar,
  Clock,
  Search,
  CheckCircle2,
  Filter,
  CreditCard,
  Users,
  DollarSign,
  Mail,
  RefreshCw,
  ShieldCheck
} from "lucide-react"

export function SuperAdminDashboard() {
  const [token, setToken] = useState(() => sessionStorage.getItem("ll_superadmin_token") || "")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [successToast, setSuccessToast] = useState("")

  // Navigation tab: 'tenants' | 'subscriptions'
  const [activeTab, setActiveTab] = useState("tenants")

  // Dashboard data
  const [stats, setStats] = useState(null)
  const [tenants, setTenants] = useState([])
  const [payments, setPayments] = useState([])
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  // Tenants table pagination & filter
  const [tenantSearch, setTenantSearch] = useState("")
  const [tenantCurrentPage, setTenantCurrentPage] = useState(1)
  const [tenantPageSize, setTenantPageSize] = useState(25)

  // Subscriptions & payments table pagination & filter
  const [paymentSearch, setPaymentSearch] = useState("")
  const [filterPlan, setFilterPlan] = useState("all")
  const [filterExpiryStatus, setFilterExpiryStatus] = useState("all")
  const [paymentCurrentPage, setPaymentCurrentPage] = useState(1)
  const [paymentPageSize, setPaymentPageSize] = useState(25)

  // Token adjustment modal state
  const [adjustingTenant, setAdjustingTenant] = useState(null)
  const [tokenAmount, setTokenAmount] = useState("")
  const [adjustmentDesc, setAdjustmentDesc] = useState("")

  // Grant Premium modal state
  const [grantingTenant, setGrantingTenant] = useState(null)
  const [grantDays, setGrantDays] = useState(2) // Default to 2 days
  const [customDays, setCustomDays] = useState("")
  const [grantBonusCredits, setGrantBonusCredits] = useState(20)
  const [grantNotifyEmail, setGrantNotifyEmail] = useState(true)
  const [grantNote, setGrantNote] = useState("Complimentary Premium access granted by Super Admin")
  const [grantLoading, setGrantLoading] = useState(false)

  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:4000"

  // Load stats and data
  useEffect(() => {
    if (!token) return
    setLoading(true)
    fetch(`${apiUrl}/api/superadmin/dashboard`, {
      headers: { "Authorization": `Bearer ${token}` }
    })
      .then(res => {
        if (!res.ok) throw new Error("Session expired or unauthorized")
        return res.json()
      })
      .then(data => {
        setStats(data.stats)
        setTenants(data.tenants || [])
        setPayments(data.payments || [])
        setError("")
      })
      .catch(err => {
        setError(err.message)
        handleLogout()
      })
      .finally(() => setLoading(false))
  }, [token, refreshTrigger])

  const showSuccess = (msg) => {
    setSuccessToast(msg)
    setTimeout(() => setSuccessToast(""), 6000)
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    const normalizedEmail = (email || "").trim().toLowerCase()
    try {
      const res = await fetch(`${apiUrl}/api/superadmin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, password })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || "Login failed")

      sessionStorage.setItem("ll_superadmin_token", data.token)
      sessionStorage.setItem("ll_superadmin_email", data.email)
      setToken(data.token)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    sessionStorage.removeItem("ll_superadmin_token")
    sessionStorage.removeItem("ll_superadmin_email")
    setToken("")
    setStats(null)
    setTenants([])
    setPayments([])
  }

  const toggleStatus = async (tenantId, currentStatus) => {
    const nextStatus = currentStatus === "Active" ? "Suspended" : "Active"
    if (!confirm(`Are you sure you want to change status of this tenant to ${nextStatus}?`)) return
    try {
      const res = await fetch(`${apiUrl}/api/superadmin/tenants/${tenantId}/status`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ status: nextStatus })
      })
      if (!res.ok) throw new Error("Could not update status")
      setRefreshTrigger(p => p + 1)
      showSuccess(`Tenant status updated to ${nextStatus}`)
    } catch (err) {
      alert(err.message)
    }
  }

  const deleteTenant = async (tenantId, name) => {
    if (!confirm(`DANGER: Are you absolutely sure you want to delete ${name}? This will permanently delete ALL their recipes, orders, inventory, and accounts. This action is irreversible.`)) return
    if (!confirm(`Confirm a second time: Delete ${name} permanently?`)) return
    try {
      const res = await fetch(`${apiUrl}/api/superadmin/tenants/${tenantId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      })
      if (!res.ok) throw new Error("Could not delete account")
      setRefreshTrigger(p => p + 1)
      showSuccess(`Tenant account ${name} permanently deleted.`)
    } catch (err) {
      alert(err.message)
    }
  }

  const adjustTokens = async (e) => {
    e.preventDefault()
    if (!adjustingTenant) return
    const amt = parseFloat(tokenAmount)
    if (isNaN(amt)) return alert("Please enter a valid number of credits")

    try {
      const res = await fetch(`${apiUrl}/api/superadmin/tenants/${adjustingTenant.id}/tokens`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ amount: amt, description: adjustmentDesc })
      })
      if (!res.ok) throw new Error("Could not adjust credits")
      setRefreshTrigger(p => p + 1)
      showSuccess(`Credits successfully adjusted for ${adjustingTenant.name}.`)
      setAdjustingTenant(null)
      setTokenAmount("")
      setAdjustmentDesc("")
    } catch (err) {
      alert(err.message)
    }
  }

  // Grant complimentary premium plan access
  const handleGrantPremium = async (e) => {
    e.preventDefault()
    if (!grantingTenant) return

    const effectiveDays = grantDays === "custom" ? parseInt(customDays, 10) : parseInt(grantDays, 10)
    if (isNaN(effectiveDays) || effectiveDays < 1) {
      return alert("Please select or enter a valid duration of at least 1 day.")
    }

    setGrantLoading(true)
    try {
      const res = await fetch(`${apiUrl}/api/superadmin/tenants/${grantingTenant.id}/grant-premium`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          days: effectiveDays,
          bonusCredits: Number(grantBonusCredits) || 0,
          notifyEmail: grantNotifyEmail,
          note: grantNote
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.message || "Failed to grant premium access")

      showSuccess(`🎉 ${data.message}${data.emailSent ? " — Notification email dispatched to owner!" : ""}`)
      setRefreshTrigger(p => p + 1)
      setGrantingTenant(null)
      setCustomDays("")
    } catch (err) {
      alert("Error: " + err.message)
    } finally {
      setGrantLoading(false)
    }
  }

  // Compute preview expiry date for Grant Modal
  const previewExpiryDate = useMemo(() => {
    if (!grantingTenant) return ""
    const effectiveDays = grantDays === "custom" ? (parseInt(customDays, 10) || 0) : parseInt(grantDays, 10)
    if (effectiveDays <= 0) return ""

    const now = new Date()
    const currentExpiry = grantingTenant.planExpiresAt ? new Date(grantingTenant.planExpiresAt) : null
    const baseTime = (currentExpiry && currentExpiry.getTime() > now.getTime())
      ? currentExpiry.getTime()
      : now.getTime()

    const calculated = new Date(baseTime + effectiveDays * 24 * 60 * 60 * 1000)
    return calculated.toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    })
  }, [grantingTenant, grantDays, customDays])

  // Filtered tenants
  const filteredTenants = useMemo(() => {
    return tenants.filter(t => {
      if (!tenantSearch) return true
      const q = tenantSearch.toLowerCase()
      return (
        t.name?.toLowerCase().includes(q) ||
        t.ownerEmail?.toLowerCase().includes(q) ||
        t.currentPlan?.toLowerCase().includes(q) ||
        t.status?.toLowerCase().includes(q)
      )
    })
  }, [tenants, tenantSearch])

  const paginatedTenants = useMemo(() => {
    if (tenantPageSize === "all") return filteredTenants
    const sz = Number(tenantPageSize) || 25
    const start = (tenantCurrentPage - 1) * sz
    return filteredTenants.slice(start, start + sz)
  }, [filteredTenants, tenantCurrentPage, tenantPageSize])

  // Filtered payments & subscriptions
  const filteredPayments = useMemo(() => {
    return payments.filter(p => {
      // Search query
      if (paymentSearch) {
        const q = paymentSearch.toLowerCase()
        const matchName = p.tenantName?.toLowerCase().includes(q)
        const matchEmail = p.customerEmail?.toLowerCase().includes(q)
        const matchRef = p.reference?.toLowerCase().includes(q)
        const matchPlan = p.plan?.toLowerCase().includes(q)
        if (!matchName && !matchEmail && !matchRef && !matchPlan) return false
      }

      // Filter by plan
      if (filterPlan !== "all") {
        if (filterPlan === "subscription") {
          if (p.resourceType !== "subscription_plan") return false
        } else if (filterPlan === "credit_pack") {
          if (p.resourceType !== "credit_pack") return false
        } else if (filterPlan === "premium") {
          if (p.plan !== "premium" && p.resourceId !== "premium") return false
        } else if (filterPlan === "standard") {
          if (p.plan !== "standard" && p.resourceId !== "standard") return false
        }
      }

      // Filter by expiry status
      if (filterExpiryStatus !== "all") {
        if (filterExpiryStatus === "active") {
          if (p.isExpired !== false) return false
        } else if (filterExpiryStatus === "expiring_soon") {
          if (p.daysRemaining === null || p.daysRemaining > 7 || p.isExpired) return false
        } else if (filterExpiryStatus === "expired") {
          if (p.isExpired !== true) return false
        }
      }

      return true
    })
  }, [payments, paymentSearch, filterPlan, filterExpiryStatus])

  const paginatedPayments = useMemo(() => {
    if (paymentPageSize === "all") return filteredPayments
    const sz = Number(paymentPageSize) || 25
    const start = (paymentCurrentPage - 1) * sz
    return filteredPayments.slice(start, start + sz)
  }, [filteredPayments, paymentCurrentPage, paymentPageSize])

  // --- Login View ---
  if (!token) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#F4EEE4", padding: 20 }}>
        <Card style={{ width: "100%", maxWidth: 400, padding: 32, boxShadow: "0 8px 30px rgba(41,22,8,0.08)" }}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
              <img
                src="/Bakewealthlogo.jpeg"
                alt="BakeWealth Logo"
                style={{
                  maxWidth: 150,
                  height: "auto",
                  maxHeight: 65,
                  borderRadius: 8,
                  objectFit: "contain"
                }}
              />
            </div>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 700, color: "var(--text)", margin: 0 }}>BakeWealth</h1>
            <p style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 4 }}>Platform Super Admin Dashboard</p>
          </div>

          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Inp label="Admin Email" type="email" value={email} onChange={setEmail} onBlur={() => setEmail(prev => (prev || "").trim().toLowerCase())} placeholder="admin@bakewealth.com" />
            <Inp label="Secure Password" type="password" value={password} onChange={setPassword} placeholder="••••••••" />
            
            {error && <div style={{ fontSize: 12.5, color: "#B03A2E", background: "#FDEBE9", padding: "8px 12px", borderRadius: 8, display: "flex", alignItems: "center", gap: 6 }}><AlertTriangle size={13} /> {error}</div>}
            
            <Btn full type="submit" disabled={loading}>{loading ? "Verifying..." : "Secure Login"}</Btn>
          </form>
        </Card>
      </div>
    )
  }

  // --- Main Dashboard View ---
  return (
    <div style={{ background: "#F4EEE4", minHeight: "100vh", padding: "24px 30px" }}>
      {/* Top Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <img src="/Bakewealthlogo.jpeg" alt="BakeWealth" style={{ height: 44, maxWidth: 120, objectFit: "contain", borderRadius: 6 }} />
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 700, color: "var(--text)", margin: 0 }}>Super Admin Workspace</h1>
              <Badge color="gold" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><ShieldCheck size={12} /> Root Controller</Badge>
            </div>
            <p style={{ fontSize: 12.5, color: "var(--muted)", margin: 0 }}>Platform Owner: Iye Ibe Achem</p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Btn variant="outline" onClick={() => setRefreshTrigger(p => p + 1)} style={{ display: "inline-flex", alignItems: "center", gap: 6 }} title="Refresh live stats">
            <RefreshCw size={13} /> Sync Data
          </Btn>
          <Btn variant="outline" onClick={handleLogout} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            Logout <LogOut size={13} />
          </Btn>
        </div>
      </div>

      {/* Success Feedback Toast */}
      {successToast && (
        <div style={{
          background: "#E8F5E9",
          border: "1px solid #81C784",
          color: "#1B5E20",
          borderRadius: 8,
          padding: "10px 16px",
          marginBottom: 16,
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 13.5,
          fontWeight: 600,
          boxShadow: "0 2px 8px rgba(0,0,0,0.06)"
        }}>
          <CheckCircle2 size={16} /> {successToast}
        </div>
      )}

      {stats ? (
        <>
          {/* Main KPI Stats Bar */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 18 }}>
            <Card style={{ borderLeft: "4px solid var(--gold)", padding: "14px 16px" }}>
              <div style={{ fontSize: 9.5, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 600 }}>Total Accounts</div>
              <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>{stats.totalTenants}</div>
              <div style={{ fontSize: 11, color: "green", marginTop: 2 }}>+{stats.tenantsThisMonth} this month</div>
            </Card>

            <Card style={{ borderLeft: "4px solid #357A52", padding: "14px 16px" }}>
              <div style={{ fontSize: 9.5, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 600 }}>Active Users (30d)</div>
              <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>{stats.activeTenants30Days}</div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>engaged bakeries</div>
            </Card>

            <Card style={{ borderLeft: "4px solid #2A5F9A", padding: "14px 16px" }}>
              <div style={{ fontSize: 9.5, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 600 }}>Paying Customers</div>
              <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4, color: "#2A5F9A" }}>
                {stats.subscriptionAnalytics?.totalPayingTenants ?? stats.totalPayingTenants ?? 0}
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>accounts with paid history</div>
            </Card>

            <Card style={{ borderLeft: "4px solid #8E44AD", padding: "14px 16px" }}>
              <div style={{ fontSize: 9.5, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 600 }}>Active Subscriptions</div>
              <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4, color: "#8E44AD" }}>
                {stats.subscriptionAnalytics?.activeSubscriptions ?? (stats.subscriptionBreakdown?.standard + stats.subscriptionBreakdown?.premium)}
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>active standard & premium</div>
            </Card>

            <Card style={{ borderLeft: "4px solid #D35400", padding: "14px 16px" }}>
              <div style={{ fontSize: 9.5, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 600 }}>Expiring Soon (≤7d)</div>
              <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4, color: "#D35400" }}>
                {stats.subscriptionAnalytics?.expiringSoon ?? 0}
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>need renewal attention</div>
            </Card>

            <Card style={{ borderLeft: "4px solid #16A085", padding: "14px 16px" }}>
              <div style={{ fontSize: 9.5, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 600 }}>Granted Trials Active</div>
              <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4, color: "#16A085" }}>
                {stats.subscriptionAnalytics?.activeTrials ?? stats.subscriptionBreakdown?.activeTrials ?? 0}
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>complimentary premium</div>
            </Card>

            <Card style={{ borderLeft: "4px solid #B03A2E", padding: "14px 16px" }}>
              <div style={{ fontSize: 9.5, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 600 }}>Monthly Revenue</div>
              <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4, color: "var(--gold)" }}>
                {fmt(stats.monthlyRevenue?.total ?? 0)}
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>subs & credit packs</div>
            </Card>
          </div>

          {/* Navigation Tabs */}
          <div style={{ display: "flex", gap: 10, marginBottom: 16, borderBottom: "2px solid #E0D3BB", paddingBottom: 10 }}>
            <button
              onClick={() => setActiveTab("tenants")}
              style={{
                background: activeTab === "tenants" ? "var(--text)" : "transparent",
                color: activeTab === "tenants" ? "#FAF6EE" : "var(--text)",
                border: "none",
                borderRadius: 8,
                padding: "8px 16px",
                fontSize: 13.5,
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                transition: "all 0.15s ease"
              }}
            >
              <Users size={15} /> Workspace Accounts ({tenants.length})
            </button>

            <button
              onClick={() => setActiveTab("subscriptions")}
              style={{
                background: activeTab === "subscriptions" ? "var(--text)" : "transparent",
                color: activeTab === "subscriptions" ? "#FAF6EE" : "var(--text)",
                border: "none",
                borderRadius: 8,
                padding: "8px 16px",
                fontSize: 13.5,
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                transition: "all 0.15s ease"
              }}
            >
              <CreditCard size={15} /> Subscriptions & Payment History ({payments.length})
            </button>
          </div>

          {/* TAB 1: WORKSPACES & TENANTS */}
          {activeTab === "tenants" && (
            <>
              {/* Filter & Search Bar */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 12, flexWrap: "wrap" }}>
                <div style={{ position: "relative", width: 320, maxWidth: "100%" }}>
                  <input
                    type="text"
                    value={tenantSearch}
                    onChange={(e) => {
                      setTenantSearch(e.target.value)
                      setTenantCurrentPage(1)
                    }}
                    placeholder="Search by workspace, email or plan..."
                    style={{
                      width: "100%",
                      padding: "8px 12px 8px 34px",
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                      fontSize: 13,
                      background: "#fff"
                    }}
                  />
                  <Search size={15} style={{ position: "absolute", left: 10, top: 10, color: "var(--muted)" }} />
                </div>

                <div style={{ fontSize: 12.5, color: "var(--muted)" }}>
                  Showing <strong>{filteredTenants.length}</strong> of {tenants.length} workspaces
                </div>
              </div>

              <Card style={{ padding: 0, overflowX: "auto", boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "var(--panel)", borderBottom: "1px solid var(--border)" }}>
                      <th style={{ textAlign: "left", padding: "11px 14px", fontSize: 11, color: "var(--muted)", textTransform: "uppercase" }}>Workspace & Owner</th>
                      <th style={{ textAlign: "left", padding: "11px 14px", fontSize: 11, color: "var(--muted)", textTransform: "uppercase" }}>Plan & Expiration</th>
                      <th style={{ textAlign: "left", padding: "11px 14px", fontSize: 11, color: "var(--muted)", textTransform: "uppercase" }}>AI Credits</th>
                      <th style={{ textAlign: "left", padding: "11px 14px", fontSize: 11, color: "var(--muted)", textTransform: "uppercase" }}>Latest Paid</th>
                      <th style={{ textAlign: "left", padding: "11px 14px", fontSize: 11, color: "var(--muted)", textTransform: "uppercase" }}>Last Active</th>
                      <th style={{ textAlign: "left", padding: "11px 14px", fontSize: 11, color: "var(--muted)", textTransform: "uppercase" }}>Status</th>
                      <th style={{ textAlign: "right", padding: "11px 14px", fontSize: 11, color: "var(--muted)", textTransform: "uppercase" }}>Admin Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedTenants.map(t => {
                      const regDate = new Date(t.registrationDate).toLocaleDateString()
                      const activeDate = new Date(t.lastActiveDate).toLocaleDateString()
                      const expiryDateFormatted = t.planExpiresAt
                        ? new Date(t.planExpiresAt).toLocaleDateString()
                        : null

                      return (
                        <tr key={t.id} style={{ borderBottom: "1px solid var(--border)" }}>
                          <td style={{ padding: "12px 14px" }}>
                            <div style={{ fontWeight: 600, fontSize: 13.5, color: "var(--text)" }}>{t.name}</div>
                            <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{t.ownerEmail}</div>
                            <div style={{ fontSize: 10.5, color: "#8C6E52", marginTop: 2 }}>Joined: {regDate}</div>
                          </td>

                          <td style={{ padding: "12px 14px" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                              {t.hasActiveTrial ? (
                                <Badge color="gold" style={{ display: "inline-flex", alignItems: "center", gap: 4, width: "fit-content" }}>
                                  <Sparkles size={11} /> Premium Trial ({t.daysRemaining ?? t.grantedTrial?.days}d left)
                                </Badge>
                              ) : t.isExpired ? (
                                <Badge color="red" style={{ width: "fit-content" }}>
                                  Expired ({t.configuredPlan})
                                </Badge>
                              ) : t.currentPlan === "premium" ? (
                                <Badge color="green" style={{ width: "fit-content" }}>
                                  ⭐ Premium
                                </Badge>
                              ) : t.currentPlan === "standard" ? (
                                <Badge color="blue" style={{ width: "fit-content" }}>
                                  Standard
                                </Badge>
                              ) : (
                                <Badge color="gray" style={{ width: "fit-content" }}>Free Plan</Badge>
                              )}

                              {t.planExpiresAt ? (
                                <div style={{ fontSize: 11, color: t.isExpired ? "#B03A2E" : t.daysRemaining <= 7 ? "#D35400" : "var(--muted)" }}>
                                  {t.isExpired ? "Expired on: " : "Expires: "}
                                  <strong>{expiryDateFormatted}</strong>
                                  {!t.isExpired && t.daysRemaining !== null && ` (${t.daysRemaining}d left)`}
                                </div>
                              ) : (
                                <div style={{ fontSize: 11, color: "var(--muted)" }}>No expiration (Free)</div>
                              )}
                            </div>
                          </td>

                          <td style={{ padding: "12px 14px" }}>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{t.tokenBalance}</div>
                            <div style={{ fontSize: 10.5, color: "var(--muted)" }}>~{Math.floor(t.tokenBalance / 2)} scans</div>
                          </td>

                          <td style={{ padding: "12px 14px" }}>
                            {t.latestPaymentAmount ? (
                              <div>
                                <strong style={{ color: "#2E7D32" }}>{fmt(t.latestPaymentAmount)}</strong>
                                <div style={{ fontSize: 11, color: "var(--muted)" }}>
                                  {new Date(t.latestPaymentDate).toLocaleDateString()}
                                </div>
                              </div>
                            ) : (
                              <span style={{ fontSize: 11.5, color: "var(--muted)" }}>No paid orders</span>
                            )}
                          </td>

                          <td style={{ padding: "12px 14px", color: "var(--muted)", fontSize: 12 }}>{activeDate}</td>

                          <td style={{ padding: "12px 14px" }}>
                            <Badge color={t.status === "Active" ? "green" : "red"}>{t.status}</Badge>
                          </td>

                          <td style={{ padding: "12px 14px", textAlign: "right" }}>
                            <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
                              {/* Grant Premium Button */}
                              <Btn
                                small
                                variant="outline"
                                onClick={() => {
                                  setGrantingTenant(t)
                                  setGrantDays(2) // prefill 2 days
                                }}
                                style={{
                                  background: "#FAF4E8",
                                  border: "1px solid var(--gold)",
                                  color: "#7B5A3A",
                                  fontWeight: 600,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4
                                }}
                                title="Grant complimentary Premium plan access"
                              >
                                <Sparkles size={11} color="var(--gold)" /> Grant Premium
                              </Btn>

                              <Btn small variant="outline" onClick={() => setAdjustingTenant(t)}>
                                🪙 Credits
                              </Btn>

                              <Btn
                                small
                                variant={t.status === "Active" ? "warning" : "success"}
                                onClick={() => toggleStatus(t.id, t.status)}
                              >
                                {t.status === "Active" ? "Suspend" : "Activate"}
                              </Btn>

                              <Btn
                                small
                                variant="danger"
                                onClick={() => deleteTenant(t.id, t.name)}
                                style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "4px 8px" }}
                                title="Permanently delete account"
                              >
                                <Trash2 size={12} />
                              </Btn>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </Card>

              <Pagination
                currentPage={tenantCurrentPage}
                totalItems={filteredTenants.length}
                pageSize={tenantPageSize}
                onPageChange={setTenantCurrentPage}
                onPageSizeChange={(sz) => {
                  setTenantPageSize(sz)
                  setTenantCurrentPage(1)
                }}
                pageSizeOptions={[10, 25, 50, 100]}
                itemLabel="workspaces"
              />
            </>
          )}

          {/* TAB 2: SUBSCRIPTIONS & PAYMENTS ANALYTICS */}
          {activeTab === "subscriptions" && (
            <>
              {/* Analytics Summary Banner */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginBottom: 16 }}>
                <Card style={{ background: "linear-gradient(135deg, #FAF6EE, #F4ECE0)", border: "1px solid #E0D3BB", padding: 16 }}>
                  <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", fontWeight: 600 }}>All-Time Revenue Collected</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: "var(--gold)", marginTop: 4 }}>
                    {fmt(stats.subscriptionAnalytics?.revenue?.totalAllTime ?? 0)}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                    Subs: {fmt(stats.subscriptionAnalytics?.revenue?.subscriptionsAllTime ?? 0)} | Packs: {fmt(stats.subscriptionAnalytics?.revenue?.tokenSalesAllTime ?? 0)}
                  </div>
                </Card>

                <Card style={{ background: "linear-gradient(135deg, #FAF6EE, #F4ECE0)", border: "1px solid #E0D3BB", padding: 16 }}>
                  <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", fontWeight: 600 }}>This Month's Subscriptions</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: "#2E7D32", marginTop: 4 }}>
                    {fmt(stats.subscriptionAnalytics?.revenue?.thisMonthSubscriptions ?? 0)}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                    + {fmt(stats.subscriptionAnalytics?.revenue?.thisMonthTokenSales ?? 0)} scan credit packs
                  </div>
                </Card>

                <Card style={{ background: "linear-gradient(135deg, #FAF6EE, #F4ECE0)", border: "1px solid #E0D3BB", padding: 16 }}>
                  <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", fontWeight: 600 }}>Expiring in ≤ 7 Days</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: "#D35400", marginTop: 4 }}>
                    {stats.subscriptionAnalytics?.expiringSoon ?? 0} Accounts
                  </div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>proactive renewal follow-up</div>
                </Card>

                <Card style={{ background: "linear-gradient(135deg, #FAF6EE, #F4ECE0)", border: "1px solid #E0D3BB", padding: 16 }}>
                  <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", fontWeight: 600 }}>Expired Subscriptions</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: "#B03A2E", marginTop: 4 }}>
                    {stats.subscriptionAnalytics?.expiredSubscriptions ?? 0} Accounts
                  </div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>fallen back to free tier</div>
                </Card>
              </div>

              {/* Filter controls */}
              <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
                <div style={{ position: "relative", minWidth: 280, flex: 1 }}>
                  <input
                    type="text"
                    value={paymentSearch}
                    onChange={(e) => {
                      setPaymentSearch(e.target.value)
                      setPaymentCurrentPage(1)
                    }}
                    placeholder="Search by customer, bakery name, or payment ref..."
                    style={{
                      width: "100%",
                      padding: "8px 12px 8px 34px",
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                      fontSize: 13,
                      background: "#fff"
                    }}
                  />
                  <Search size={15} style={{ position: "absolute", left: 10, top: 10, color: "var(--muted)" }} />
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>Filter Plan:</span>
                  <select
                    value={filterPlan}
                    onChange={(e) => {
                      setFilterPlan(e.target.value)
                      setPaymentCurrentPage(1)
                    }}
                    style={{ padding: "7px 10px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 12.5, background: "#fff" }}
                  >
                    <option value="all">All Plans & Items</option>
                    <option value="subscription">All Subscriptions</option>
                    <option value="premium">Premium Plans</option>
                    <option value="standard">Standard Plans</option>
                    <option value="credit_pack">AI Credit Packs</option>
                  </select>
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>Expiry Status:</span>
                  <select
                    value={filterExpiryStatus}
                    onChange={(e) => {
                      setFilterExpiryStatus(e.target.value)
                      setPaymentCurrentPage(1)
                    }}
                    style={{ padding: "7px 10px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 12.5, background: "#fff" }}
                  >
                    <option value="all">All Statuses</option>
                    <option value="active">Active Plan</option>
                    <option value="expiring_soon">Expiring Soon (≤ 7 days)</option>
                    <option value="expired">Expired</option>
                  </select>
                </div>
              </div>

              {/* Payments & Subscriptions Table */}
              <Card style={{ padding: 0, overflowX: "auto", boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "var(--panel)", borderBottom: "1px solid var(--border)" }}>
                      <th style={{ textAlign: "left", padding: "11px 14px", fontSize: 11, color: "var(--muted)", textTransform: "uppercase" }}>Bakery Workspace</th>
                      <th style={{ textAlign: "left", padding: "11px 14px", fontSize: 11, color: "var(--muted)", textTransform: "uppercase" }}>Item / Plan</th>
                      <th style={{ textAlign: "left", padding: "11px 14px", fontSize: 11, color: "var(--muted)", textTransform: "uppercase" }}>Amount</th>
                      <th style={{ textAlign: "left", padding: "11px 14px", fontSize: 11, color: "var(--muted)", textTransform: "uppercase" }}>Payment Reference</th>
                      <th style={{ textAlign: "left", padding: "11px 14px", fontSize: 11, color: "var(--muted)", textTransform: "uppercase" }}>Date Paid</th>
                      <th style={{ textAlign: "left", padding: "11px 14px", fontSize: 11, color: "var(--muted)", textTransform: "uppercase" }}>Subscription Expiration</th>
                      <th style={{ textAlign: "left", padding: "11px 14px", fontSize: 11, color: "var(--muted)", textTransform: "uppercase" }}>Current Status</th>
                      <th style={{ textAlign: "right", padding: "11px 14px", fontSize: 11, color: "var(--muted)", textTransform: "uppercase" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedPayments.length > 0 ? (
                      paginatedPayments.map(p => {
                        const paidDateFormatted = new Date(p.paidAt).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit"
                        })
                        const expiryDateFormatted = p.planExpiresAt
                          ? new Date(p.planExpiresAt).toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "short",
                              day: "numeric"
                            })
                          : null

                        const isExpiringSoon = p.daysRemaining !== null && p.daysRemaining <= 7 && !p.isExpired

                        return (
                          <tr key={p.id} style={{ borderBottom: "1px solid var(--border)" }}>
                            <td style={{ padding: "12px 14px" }}>
                              <div style={{ fontWeight: 600, fontSize: 13.5 }}>{p.tenantName}</div>
                              <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{p.customerEmail}</div>
                            </td>

                            <td style={{ padding: "12px 14px" }}>
                              {p.resourceType === "subscription_plan" ? (
                                <Badge color={p.plan === "premium" ? "green" : "blue"}>
                                  {p.plan === "premium" ? "⭐ Premium Plan" : "Standard Plan"} ({p.months} mo)
                                </Badge>
                              ) : p.resourceType === "credit_pack" ? (
                                <Badge color="gold">🪙 AI Scan Credits Pack</Badge>
                              ) : (
                                <Badge color="gray">{p.resourceType}</Badge>
                              )}
                            </td>

                            <td style={{ padding: "12px 14px", fontWeight: 700, color: "#2E7D32" }}>
                              {fmt(p.amount)}
                            </td>

                            <td style={{ padding: "12px 14px" }}>
                              <div style={{ fontFamily: "monospace", fontSize: 12 }}>{p.reference}</div>
                              <div style={{ fontSize: 10.5, color: "var(--muted)", textTransform: "uppercase" }}>{p.provider || "Paystack"}</div>
                            </td>

                            <td style={{ padding: "12px 14px", fontSize: 12, color: "var(--text)" }}>
                              {paidDateFormatted}
                            </td>

                            <td style={{ padding: "12px 14px" }}>
                              {expiryDateFormatted ? (
                                <div>
                                  <div style={{ fontWeight: 600, color: p.isExpired ? "#B03A2E" : isExpiringSoon ? "#D35400" : "#2E7D32" }}>
                                    {expiryDateFormatted}
                                  </div>
                                  <div style={{ fontSize: 11, color: "var(--muted)" }}>
                                    {p.isExpired
                                      ? "Expired"
                                      : `${p.daysRemaining} day${p.daysRemaining === 1 ? "" : "s"} left`}
                                  </div>
                                </div>
                              ) : (
                                <span style={{ fontSize: 11.5, color: "var(--muted)" }}>N/A (One-off pack)</span>
                              )}
                            </td>

                            <td style={{ padding: "12px 14px" }}>
                              {p.isExpired ? (
                                <Badge color="red">Expired</Badge>
                              ) : isExpiringSoon ? (
                                <Badge color="orange">Expiring Soon</Badge>
                              ) : p.planExpiresAt ? (
                                <Badge color="green">Active</Badge>
                              ) : (
                                <Badge color="gray">Completed</Badge>
                              )}
                            </td>

                            <td style={{ padding: "12px 14px", textAlign: "right" }}>
                              {p.tenantId && (
                                <Btn
                                  small
                                  variant="outline"
                                  onClick={() => {
                                    const matchingTenant = tenants.find(t => t.id === p.tenantId)
                                    setGrantingTenant(matchingTenant || { id: p.tenantId, name: p.tenantName, ownerEmail: p.customerEmail })
                                    setGrantDays(2)
                                  }}
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 4,
                                    fontSize: 11
                                  }}
                                  title="Extend or grant Premium trial for this customer"
                                >
                                  <Sparkles size={11} color="var(--gold)" /> Grant +Days
                                </Btn>
                              )}
                            </td>
                          </tr>
                        )
                      })
                    ) : (
                      <tr>
                        <td colSpan={8} style={{ padding: 36, textAlign: "center", color: "var(--muted)" }}>
                          No payment records match the selected filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </Card>

              <Pagination
                currentPage={paymentCurrentPage}
                totalItems={filteredPayments.length}
                pageSize={paymentPageSize}
                onPageChange={setPaymentCurrentPage}
                onPageSizeChange={(sz) => {
                  setPaymentPageSize(sz)
                  setPaymentCurrentPage(1)
                }}
                pageSizeOptions={[10, 25, 50, 100]}
                itemLabel="transactions"
              />
            </>
          )}
        </>
      ) : (
        <Card style={{ textAlign: "center", padding: 48 }}>
          <p style={{ color: "var(--muted)" }}>Loading super admin statistics & subscriptions...</p>
        </Card>
      )}

      {/* Grant Complimentary Premium Plan Access Modal */}
      {grantingTenant && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 120, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <Card style={{ width: "100%", maxWidth: 520, padding: 26, boxShadow: "0 10px 40px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#FAF4E8", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--gold)" }}>
                <Sparkles size={18} color="var(--gold)" />
              </div>
              <div>
                <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, margin: 0, color: "var(--text)" }}>
                  Grant Complimentary Premium Plan Access
                </h3>
                <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>
                  Workspace: <strong>{grantingTenant.name}</strong> ({grantingTenant.ownerEmail})
                </p>
              </div>
            </div>

            <form onSubmit={handleGrantPremium} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Duration Presets */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", display: "block", marginBottom: 6 }}>
                  Select Premium Access Duration:
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                  {[
                    { label: "1 Day", val: 1 },
                    { label: "2 Days (Recommended)", val: 2 },
                    { label: "3 Days", val: 3 },
                    { label: "7 Days (1 Wk)", val: 7 },
                    { label: "14 Days", val: 14 },
                    { label: "30 Days (1 Mo)", val: 30 }
                  ].map(item => (
                    <button
                      key={item.val}
                      type="button"
                      onClick={() => setGrantDays(item.val)}
                      style={{
                        padding: "8px 10px",
                        borderRadius: 8,
                        border: grantDays === item.val ? "2px solid var(--gold)" : "1px solid var(--border)",
                        background: grantDays === item.val ? "#FAF4E8" : "#fff",
                        color: grantDays === item.val ? "#7B5A3A" : "var(--text)",
                        fontWeight: grantDays === item.val ? 700 : 500,
                        fontSize: 12,
                        cursor: "pointer",
                        transition: "all 0.1s ease"
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                {/* Custom Days Input Option */}
                <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setGrantDays("custom")}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 6,
                      border: grantDays === "custom" ? "2px solid var(--gold)" : "1px solid var(--border)",
                      background: grantDays === "custom" ? "#FAF4E8" : "#fff",
                      fontSize: 12,
                      cursor: "pointer"
                    }}
                  >
                    Custom Days
                  </button>
                  {grantDays === "custom" && (
                    <input
                      type="number"
                      min="1"
                      placeholder="e.g. 5"
                      value={customDays}
                      onChange={(e) => setCustomDays(e.target.value)}
                      style={{
                        width: 120,
                        padding: "6px 10px",
                        borderRadius: 6,
                        border: "1px solid var(--border)",
                        fontSize: 12.5
                      }}
                      autoFocus
                    />
                  )}
                </div>
              </div>

              {/* Expiry Preview Box */}
              {previewExpiryDate && (
                <div style={{
                  background: "#FAF6EE",
                  border: "1px dashed var(--gold)",
                  borderRadius: 8,
                  padding: "10px 14px",
                  fontSize: 12.5,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  color: "#7B5A3A"
                }}>
                  <Clock size={16} color="var(--gold)" />
                  <div>
                    Access will be valid until: <strong>{previewExpiryDate}</strong>
                  </div>
                </div>
              )}

              {/* Bonus Scan Credits */}
              <Inp
                label="Bonus AI Scan Credits (Optional allowance for receipt scanning)"
                type="number"
                value={grantBonusCredits}
                onChange={setGrantBonusCredits}
                placeholder="20"
              />

              {/* Transactional Email Notification Checkbox */}
              <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", fontSize: 12.5, color: "var(--text)" }}>
                <input
                  type="checkbox"
                  checked={grantNotifyEmail}
                  onChange={(e) => setGrantNotifyEmail(e.target.checked)}
                  style={{ marginTop: 2 }}
                />
                <div>
                  <strong>Send notification email to {grantingTenant.ownerEmail}</strong>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>
                    Informs them that they have received complimentary Premium Plan access for the selected days and describes unlocked features.
                  </div>
                </div>
              </label>

              {/* Note / Reason */}
              <Inp
                label="Internal Admin Note"
                value={grantNote}
                onChange={setGrantNote}
                placeholder="e.g. Complimentary trial for high-volume baker"
              />

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
                <Btn variant="ghost" onClick={() => setGrantingTenant(null)}>Cancel</Btn>
                <Btn
                  variant="success"
                  type="submit"
                  disabled={grantLoading}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                >
                  <Sparkles size={14} />
                  {grantLoading ? "Granting Access..." : "Confirm & Grant Premium Plan"}
                </Btn>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Adjust Credits Modal */}
      {adjustingTenant && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <Card style={{ width: "100%", maxWidth: 400, padding: 24 }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
              Adjust Credits: {adjustingTenant.name}
            </div>
            <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>
              Current credit balance: <strong>{adjustingTenant.tokenBalance}</strong>
            </p>
            <form onSubmit={adjustTokens} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Inp
                label="Amount (Positive to add, Negative to subtract) *"
                type="number"
                value={tokenAmount}
                onChange={setTokenAmount}
                placeholder="e.g. 50 or -20"
              />
              <Inp
                label="Adjustment Note / Reason *"
                value={adjustmentDesc}
                onChange={setAdjustmentDesc}
                placeholder="e.g. Customer support topup"
              />
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
                <Btn variant="success" type="submit">Apply Adjustment</Btn>
                <Btn variant="ghost" onClick={() => setAdjustingTenant(null)}>Cancel</Btn>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  )
}
