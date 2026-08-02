/**
 * SuperAdminDashboard.jsx
 * ----------------------------------------------------------------------------
 * Super Admin interface for platform owner (Iye Ibe Achem).
 * Features registration stats, subscription breakdown, monthly revenue,
 * active user count, and full tenant control tools (suspend, delete, add tokens).
 * ----------------------------------------------------------------------------
 */
import React, { useState, useEffect } from "react"
import { Btn, Card, Badge, Inp, SHead } from "../common/ui.jsx"
import { fmt } from "../../lib/helpers.js"

export function SuperAdminDashboard() {
  const [token, setToken] = useState(() => localStorage.getItem("ll_superadmin_token") || "")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // Dashboard state
  const [stats, setStats] = useState(null)
  const [tenants, setTenants] = useState([])
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  // Token adjustment modal state
  const [adjustingTenant, setAdjustingTenant] = useState(null)
  const [tokenAmount, setTokenAmount] = useState("")
  const [adjustmentDesc, setAdjustmentDesc] = useState("")

  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:4000"

  // Load stats
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
        setTenants(data.tenants)
        setError("")
      })
      .catch(err => {
        setError(err.message)
        handleLogout()
      })
      .finally(() => setLoading(false))
  }, [token, refreshTrigger])

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`${apiUrl}/api/superadmin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || "Login failed")

      localStorage.setItem("ll_superadmin_token", data.token)
      localStorage.setItem("ll_superadmin_email", data.email)
      setToken(data.token)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem("ll_superadmin_token")
    localStorage.removeItem("ll_superadmin_email")
    setToken("")
    setStats(null)
    setTenants([])
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
    } catch (err) {
      alert(err.message)
    }
  }

  const deleteTenant = async (tenantId, name) => {
    if (!confirm(`⚠ DANGER: Are you absolutely sure you want to delete ${name}? This will permanently delete ALL their recipes, orders, inventory, and accounts. This action is irreversible.`)) return
    if (!confirm(`Confirm a second time: Delete ${name} permanently?`)) return
    try {
      const res = await fetch(`${apiUrl}/api/superadmin/tenants/${tenantId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      })
      if (!res.ok) throw new Error("Could not delete account")
      setRefreshTrigger(p => p + 1)
      alert("Tenant permanently deleted.")
    } catch (err) {
      alert(err.message)
    }
  }

  const adjustTokens = async (e) => {
    e.preventDefault()
    if (!adjustingTenant) return
    const amt = parseFloat(tokenAmount)
    if (isNaN(amt)) return alert("Please enter a valid number of tokens")

    try {
      const res = await fetch(`${apiUrl}/api/superadmin/tenants/${adjustingTenant.id}/tokens`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ amount: amt, description: adjustmentDesc })
      })
      if (!res.ok) throw new Error("Could not adjust tokens")
      setRefreshTrigger(p => p + 1)
      setAdjustingTenant(null)
      setTokenAmount("")
      setAdjustmentDesc("")
      alert("Tokens adjusted successfully.")
    } catch (err) {
      alert(err.message)
    }
  }

  // --- Login View ---
  if (!token) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#F4EEE4", padding: 20 }}>
        <Card style={{ width: "100%", maxWidth: 400, padding: 32, boxShadow: "0 8px 30px rgba(41,22,8,0.08)" }}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={{ fontSize: 42, marginBottom: 8 }}>👑</div>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 700, color: "var(--text)", margin: 0 }}>BakeWealth</h1>
            <p style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 4 }}>Platform Super Admin Dashboard</p>
          </div>

          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Inp label="Admin Email" type="email" value={email} onChange={setEmail} placeholder="admin@bakewealth.com" />
            <Inp label="Secure Password" type="password" value={password} onChange={setPassword} placeholder="••••••••" />
            
            {error && <div style={{ fontSize: 12.5, color: "#B03A2E", background: "#FDEBE9", padding: "8px 12px", borderRadius: 8 }}>⚠ {error}</div>}
            
            <Btn full type="submit" disabled={loading}>{loading ? "Verifying..." : "Secure Login"}</Btn>
          </form>
        </Card>
      </div>
    )
  }

  // --- Main Dashboard View ---
  return (
    <div style={{ background: "#F4EEE4", minHeight: "100vh", padding: "24px 30px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 700, color: "var(--text)", margin: 0 }}>Super Admin Workspace</h1>
          <p style={{ fontSize: 13, color: "var(--muted)" }}>Platform Owner: Iye Ibe Achem</p>
        </div>
        <Btn variant="outline" onClick={handleLogout}>Logout ✕</Btn>
      </div>

      {stats ? (
        <>
          {/* KPI Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 18 }}>
            <Card style={{ borderLeft: "4px solid var(--gold)" }}>
              <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 600, marginBottom: 4 }}>Total Accounts</div>
              <div style={{ fontSize: 26, fontWeight: 700 }}>{stats.totalTenants}</div>
              <div style={{ fontSize: 11, color: "green", marginTop: 4 }}>+{stats.tenantsThisMonth} registered this month</div>
            </Card>

            <Card style={{ borderLeft: "4px solid #357A52" }}>
              <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 600, marginBottom: 4 }}>Active Users (30 Days)</div>
              <div style={{ fontSize: 26, fontWeight: 700 }}>{stats.activeTenants30Days}</div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>engaged users</div>
            </Card>

            <Card style={{ borderLeft: "4px solid #2A5F9A" }}>
              <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 600, marginBottom: 4 }}>Monthly Revenue</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: "var(--gold)" }}>{fmt(stats.monthlyRevenue.total)}</div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>₦{stats.monthlyRevenue.subscriptions.toLocaleString()} subscriptions</div>
            </Card>

            <Card style={{ borderLeft: "4px solid #B03A2E" }}>
              <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 600, marginBottom: 4 }}>Token Sales (This Month)</div>
              <div style={{ fontSize: 26, fontWeight: 700 }}>{stats.tokenSales.units} units</div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>₦{stats.tokenSales.revenue.toLocaleString()} revenue</div>
            </Card>
          </div>

          {/* Breakdown & Usage panels */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: 14, marginBottom: 18 }}>
            <Card>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Subscription Breakdown</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span>Free Tier:</span>
                  <strong>{stats.subscriptionBreakdown.free} accounts</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span>Token Balance Tier:</span>
                  <strong>{stats.subscriptionBreakdown.token} accounts</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span>Pro Plan:</span>
                  <strong>{stats.subscriptionBreakdown.pro} accounts</strong>
                </div>
              </div>
            </Card>

            <Card>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Platform Feature Usage Statistics</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 8, padding: 10, textAlign: "center" }}>
                  <div style={{ fontSize: 9.5, color: "var(--muted)", textTransform: "uppercase" }}>Recipes</div>
                  <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>{stats.usage.recipes}</div>
                </div>
                <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 8, padding: 10, textAlign: "center" }}>
                  <div style={{ fontSize: 9.5, color: "var(--muted)", textTransform: "uppercase" }}>Orders</div>
                  <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>{stats.usage.orders}</div>
                </div>
                <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 8, padding: 10, textAlign: "center" }}>
                  <div style={{ fontSize: 9.5, color: "var(--muted)", textTransform: "uppercase" }}>Inventory</div>
                  <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>{stats.usage.inventory}</div>
                </div>
                <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 8, padding: 10, textAlign: "center" }}>
                  <div style={{ fontSize: 9.5, color: "var(--muted)", textTransform: "uppercase" }}>Expenses</div>
                  <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>{stats.usage.expenses}</div>
                </div>
              </div>
            </Card>
          </div>

          {/* Tenants List */}
          <Card style={{ padding: 0, overflowX: "auto" }}>
            <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", fontFamily: "'Playfair Display', serif", fontSize: 15, fontWeight: 600 }}>
              Registered Tenant Workspaces
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "var(--panel)", borderBottom: "1px solid var(--border)" }}>
                  <th style={{ textAlign: "left", padding: "10px 14px", fontSize: 11, color: "var(--muted)", textTransform: "uppercase" }}>Business Details</th>
                  <th style={{ textAlign: "left", padding: "10px 14px", fontSize: 11, color: "var(--muted)", textTransform: "uppercase" }}>Registered</th>
                  <th style={{ textAlign: "left", padding: "10px 14px", fontSize: 11, color: "var(--muted)", textTransform: "uppercase" }}>Plan</th>
                  <th style={{ textAlign: "left", padding: "10px 14px", fontSize: 11, color: "var(--muted)", textTransform: "uppercase" }}>Token Bal</th>
                  <th style={{ textAlign: "left", padding: "10px 14px", fontSize: 11, color: "var(--muted)", textTransform: "uppercase" }}>Last Active</th>
                  <th style={{ textAlign: "left", padding: "10px 14px", fontSize: 11, color: "var(--muted)", textTransform: "uppercase" }}>Status</th>
                  <th style={{ textAlign: "right", padding: "10px 14px", fontSize: 11, color: "var(--muted)", textTransform: "uppercase" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map(t => {
                  const regDate = new Date(t.registrationDate).toLocaleDateString()
                  const activeDate = new Date(t.lastActiveDate).toLocaleDateString()
                  return (
                    <tr key={t.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "12px 14px" }}>
                        <div style={{ fontWeight: 600, fontSize: 13.5 }}>{t.name}</div>
                        <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{t.ownerEmail}</div>
                      </td>
                      <td style={{ padding: "12px 14px", color: "var(--muted)" }}>{regDate}</td>
                      <td style={{ padding: "12px 14px" }}>
                        <Badge color={t.currentPlan === "pro" ? "green" : "gray"}>{t.currentPlan}</Badge>
                      </td>
                      <td style={{ padding: "12px 14px", fontWeight: 500 }}>{t.tokenBalance}</td>
                      <td style={{ padding: "12px 14px", color: "var(--muted)" }}>{activeDate}</td>
                      <td style={{ padding: "12px 14px" }}>
                        <Badge color={t.status === "Active" ? "green" : "red"}>{t.status}</Badge>
                      </td>
                      <td style={{ padding: "12px 14px", textAlign: "right" }}>
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                          <Btn small variant="outline" onClick={() => setAdjustingTenant(t)}>🪙 Tokens</Btn>
                          <Btn
                            small
                            variant={t.status === "Active" ? "warning" : "success"}
                            onClick={() => toggleStatus(t.id, t.status)}
                          >
                            {t.status === "Active" ? "Suspend" : "Activate"}
                          </Btn>
                          <Btn small variant="danger" onClick={() => deleteTenant(t.id, t.name)}>✕</Btn>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Card>
        </>
      ) : (
        <Card style={{ textAlign: "center", padding: 48 }}>
          <p style={{ color: "var(--muted)" }}>Loading super admin statistics...</p>
        </Card>
      )}

      {/* Adjust Tokens Modal */}
      {adjustingTenant && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <Card style={{ width: "100%", maxWidth: 400, padding: 24 }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
              Adjust Tokens: {adjustingTenant.name}
            </div>
            <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>
              Current token balance: <strong>{adjustingTenant.tokenBalance}</strong>
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
