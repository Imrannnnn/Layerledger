/**
 * Dashboard.jsx
 * ----------------------------------------------------------------------------
 * Home dashboard.
 * Shows the weekly metrics, pending orders list, low stock alerts, monthly revenue,
 * and quick actions.
 * ----------------------------------------------------------------------------
 */
import React, { useState } from "react"
import { Btn, Card, Badge } from "../common/ui.jsx"
import { fmt } from "../../lib/helpers.js"
import { loadLocal, saveLocal } from "../../lib/data.js"

export function Dashboard({ productions, inventory, expenses, setView, user, tenantInfo }) {
  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)
  const currentMonthStr = today.toISOString().slice(0, 7)

  // 1. This week at a glance calculations
  const next7Days = new Date()
  next7Days.setDate(today.getDate() + 7)
  const endOfWeekStr = next7Days.toISOString().slice(0, 10)

  const thisWeekOrders = productions.filter(p => p.deliveryDate && p.deliveryDate >= todayStr && p.deliveryDate <= endOfWeekStr && (p.status || "").toLowerCase() !== "cancelled")
  const numThisWeek = thisWeekOrders.length

  const futureDeliveries = productions
    .filter(p => p.deliveryDate && p.deliveryDate >= todayStr && !["delivered", "cancelled"].includes((p.status || "").toLowerCase()))
    .map(p => p.deliveryDate)
    .sort()
  const nextDeliveryDate = futureDeliveries[0] || "No upcoming deliveries"

  const pendingThisWeek = thisWeekOrders.filter(p => ["pending", "in progress"].includes((p.status || "pending").toLowerCase())).length
  const readyThisWeek = thisWeekOrders.filter(p => (p.status || "").toLowerCase() === "ready").length

  // 2. Low stock alert calculations
  const lowStockCount = inventory.filter(i => i.stock <= (i.minStock || 5)).length

  // 3. Revenue this month (confirmed orders total - Owner only)
  const confirmedOrders = productions.filter(p => p.deliveryDate?.startsWith(currentMonthStr) && (p.status || "").toLowerCase() !== "cancelled")
  const rev = confirmedOrders.reduce((s, p) => s + (p.salePrice || 0), 0)
  
  // Cost calculations
  const cost = confirmedOrders.reduce((s, p) => s + (p.cost || 0) + (p.deliveryCost || 0), 0)
  const expTotal = expenses.filter(e => e.date?.startsWith(currentMonthStr) && e.category !== "Ingredients" && e.source !== "purchase" && e.source !== "receipt").reduce((s, e) => s + (e.amount || 0), 0)
  const profit = rev - cost - expTotal
  const margin = rev > 0 ? Math.round((profit / rev) * 100) : 0
  
  const monthLabel = today.toLocaleDateString("en-NG", { month: "long", year: "numeric" })

  // Month-end notification banner
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  const dayOfMonth = today.getDate()
  const daysLeft = daysInMonth - dayOfMonth
  const isFirstOfMonth = dayOfMonth === 1
  const notifDays = parseInt(loadLocal("ll_notif_days", "2"))
  const notifEnabled = loadLocal("ll_notif_enabled", true) !== false
  const [bannerDismissed, setBannerDismissed] = useState(() => {
    const dismissed = loadLocal("ll_banner_dismissed", "")
    return dismissed === today.toISOString().slice(0, 10)
  })

  const showBanner = notifEnabled && user?.role === "owner" && !bannerDismissed && (daysLeft <= (+notifDays) || isFirstOfMonth)
  const dismissBanner = async () => { await saveLocal("ll_banner_dismissed", today.toISOString().slice(0, 10)); setBannerDismissed(true) }
  const prevMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1).toLocaleDateString("en-NG", { month: "long", year: "numeric" })

  // Greeting
  const hr = today.getHours()
  const greetWord = hr < 12 ? "Good morning" : hr < 17 ? "Good afternoon" : "Good evening"
  const firstName = user?.name?.split(" ")[0] || "Business"
  const quotes = [
    "A great cake starts with great numbers.",
    "Every slice tells a story — make yours profitable.",
    "The secret ingredient is knowing your costs.",
    "Beautiful cakes, beautiful books.",
    "Bake with love, price with confidence.",
    "Success is baked in, one order at a time.",
    "Know your numbers, grow your bakery."
  ]
  const quote = quotes[today.getDay() % quotes.length]

  // 4. Next 3 orders due
  const next3Orders = productions
    .filter(p => p.deliveryDate && p.deliveryDate >= todayStr && !["delivered", "completed", "cancelled"].includes((p.status || "").toLowerCase()))
    .sort((a, b) => a.deliveryDate.localeCompare(b.deliveryDate))
    .slice(0, 3)

  // 5. In-App Notifications
  const notifications = []
  
  // - Low stock alert
  const lowStockItems = inventory.filter(i => i.stock <= (i.minStock || 5))
  if (lowStockItems.length > 0) {
    notifications.push({
      id: "low_stock",
      type: "warning",
      icon: "⚠️",
      title: "Low Stock Alert",
      message: `${lowStockItems.length} ingredient${lowStockItems.length !== 1 ? 's are' : ' is'} below minimum stock level.`,
      action: () => setView("shopping"),
      actionLabel: "View Shopping List"
    })
  }

  // - Token balance warning
  if (tenantInfo && tenantInfo.tokenBalance <= 2) {
    notifications.push({
      id: "low_tokens",
      type: "danger",
      icon: "🪙",
      title: "Low Token Balance",
      message: `You have ${tenantInfo.tokenBalance} token${tenantInfo.tokenBalance !== 1 ? 's' : ''} remaining. Top up soon to avoid interruption.`,
      action: () => setView("settings"),
      actionLabel: "Top Up Now"
    })
  }

  // - Order due today
  const ordersDueToday = productions.filter(p => p.deliveryDate === todayStr && !["delivered", "cancelled"].includes((p.status || "").toLowerCase()))
  if (ordersDueToday.length > 0) {
    notifications.push({
      id: "orders_due",
      type: "info",
      icon: "🚚",
      title: "Orders Due Today",
      message: `You have ${ordersDueToday.length} order${ordersDueToday.length !== 1 ? 's' : ''} due for delivery today.`,
      action: () => setView("prodlist"),
      actionLabel: "View Orders"
    })
  }

  return (
    <div>
      {/* Greeting Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 600, color: "var(--text)" }}>{greetWord}, {firstName}! 🎂</div>
        <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4, fontStyle: "italic" }}>"{quote}"</div>
      </div>

      {/* Month-end Lock Banner */}
      {showBanner && (
        <div style={{ marginBottom: 14, borderRadius: 10, overflow: "hidden", border: `1px solid ${isFirstOfMonth ? "#5DCAA5" : daysLeft === 0 ? "#F09595" : "#FAC775"}` }}>
          <div style={{ background: isFirstOfMonth ? "#E1F5EE" : daysLeft === 0 ? "#FCEBEB" : "#FFF9EE", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <div style={{ width: 14, height: 14, borderRadius: "50%", background: isFirstOfMonth ? "#0F6E56" : daysLeft === 0 ? "#A32D2D" : "#BA7517", flexShrink: 0, marginTop: 3 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: isFirstOfMonth ? "#085041" : daysLeft === 0 ? "#501313" : "#633806" }}>
                  {isFirstOfMonth ? `New month started — ${monthLabel}` : daysLeft === 0 ? "Today is the last day of the month" : `Month closing in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}`}
                </div>
                <div style={{ fontSize: 12, color: isFirstOfMonth ? "#0F6E56" : daysLeft === 0 ? "#791F1F" : "#854F0B", marginTop: 3, lineHeight: 1.6 }}>
                  {isFirstOfMonth ? "Starting inventory set automatically from last month. Your " + prevMonth + " overview is ready." : daysLeft === 0 ? "Lock your closing stock today — midnight auto-sets next month's starting inventory." : "Review your monthly overview and lock closing stock before the 1st."}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0, flexWrap: "wrap" }}>
              {isFirstOfMonth ? (
                <Btn small onClick={() => setView("monthly")}>Download {prevMonth} overview</Btn>
              ) : (
                <>
                  <Btn small onClick={() => setView("monthly")}>View monthly overview</Btn>
                  <Btn small variant="ghost" onClick={() => setView("settings")}>Lock closing stock</Btn>
                </>
              )}
              <span onClick={dismissBanner} style={{ fontSize: 11, color: "var(--muted)", cursor: "pointer", textDecoration: "underline" }}>Dismiss</span>
            </div>
          </div>
        </div>
      )}

      {/* Week At A Glance */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 14, marginBottom: 14 }}>
        <Card style={{ padding: "16px 20px", borderLeft: "4px solid var(--gold)" }}>
          <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1, fontWeight: 600, marginBottom: 10 }}>📅 This Week At A Glance</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 16 }}>
            <div>
              <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text)" }}>{numThisWeek}</div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>Orders due this week</div>
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingTop: 4 }}>{nextDeliveryDate}</div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>Next delivery date</div>
            </div>
            <div>
              <div style={{ display: "flex", gap: 10, alignItems: "center", paddingTop: 2 }}>
                <Badge color="gold">{pendingThisWeek} pending</Badge>
                <Badge color="green">{readyThisWeek} ready</Badge>
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>Current weekly status</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Dynamic Notifications Feed */}
      {notifications.length > 0 && (
        <div style={{ marginBottom: 14, display: "flex", flexDirection: "column", gap: 10 }}>
          {notifications.map(n => (
            <div key={n.id} onClick={n.action} style={{ 
                cursor: "pointer", 
                background: n.type === "danger" ? "#FFF1F1" : n.type === "warning" ? "#FFF9EE" : "#F4F8FF", 
                border: `1px solid ${n.type === "danger" ? "#FFCDCD" : n.type === "warning" ? "var(--gold)" : "#CDE2FF"}`, 
                borderRadius: 12, 
                padding: "14px 18px", 
                display: "flex", 
                justifyContent: "space-between", 
                alignItems: "center", 
                transition: "background 0.2s" 
              }} 
              onMouseEnter={e => e.currentTarget.style.background = n.type === "danger" ? "#FCEBEB" : n.type === "warning" ? "#FDF2DC" : "#EBF2FF"} 
              onMouseLeave={e => e.currentTarget.style.background = n.type === "danger" ? "#FFF1F1" : n.type === "warning" ? "#FFF9EE" : "#F4F8FF"}>
              
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span style={{ fontSize: 20 }}>{n.icon}</span>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: n.type === "danger" ? "#A32D2D" : n.type === "warning" ? "#7B5A3A" : "#2D5AA3" }}>{n.title}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{n.message}</div>
                </div>
              </div>
              <span style={{ color: n.type === "danger" ? "#A32D2D" : n.type === "warning" ? "var(--gold)" : "#2D5AA3", fontWeight: 600, fontSize: 13, whiteSpace: "nowrap" }}>{n.actionLabel} →</span>
            </div>
          ))}
        </div>
      )}

      {/* Summary Financials (Owner Only) */}
      {user?.role === "owner" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12, marginBottom: 14 }}>
          {[
            { label: `Revenue (${monthLabel})`, val: fmt(rev), sub: "Confirmed orders", c: "var(--gold)" },
            { label: "Production Cost", val: fmt(cost), sub: "Ingredients + delivery", c: "#378ADD" },
            { label: "Monthly Expenses", val: fmt(expTotal), sub: "Overhead expenses", c: "#888780" },
            { label: "Net Profit Estimate", val: fmt(profit), sub: `${margin}% net margin`, c: profit >= 0 ? "#357A52" : "#B03A2E" },
          ].map(s => (
            <Card key={s.label} style={{ borderTop: `3px solid ${s.c}`, borderRadius: "0 0 12px 12px", padding: "14px 16px" }}>
              <div style={{ fontSize: 9.5, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 600, marginBottom: 5 }}>{s.label}</div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: s.label.startsWith("Net Profit") ? s.c : "var(--text)" }}>{s.val}</div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 3 }}>{s.sub}</div>
            </Card>
          ))}
        </div>
      )}

      {/* Next 3 Orders Due & Quick Actions Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
        
        {/* Next 3 Orders Card */}
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, fontWeight: 600 }}>📋 Next 3 Orders Due</div>
            <span style={{ fontSize: 11, color: "var(--muted)", cursor: "pointer", textDecoration: "underline" }} onClick={() => setView("records")}>View all</span>
          </div>

          {next3Orders.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--muted)", padding: "20px 0", textAlign: "center" }}>No upcoming orders.</div>
          ) : (
            <div>
              {next3Orders.map((o, idx) => (
                <div key={o.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: idx < next3Orders.length - 1 ? "1px solid var(--border)" : "none" }}>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text)" }}>{o.client || "Client Name"}</div>
                    <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>
                      {o.tierSummary || o.size || "Cake"} • Due {o.deliveryDate}
                    </div>
                  </div>
                  <Badge color={{ pending: "gold", "in progress": "blue", ready: "green", delivered: "purple" }[(o.status || "pending").toLowerCase()] || "gray"}>
                    {o.status || "pending"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Quick Actions Grid */}
        <Card>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, fontWeight: 600, marginBottom: 14 }}>⚡ Quick Actions</div>
          
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {/* Primary Action - Order Calculator */}
            <div onClick={() => setView("calculator")} style={{ cursor: "pointer", background: "linear-gradient(135deg, #FAF1DC, #F5E3BD)", border: "1px solid var(--gold)", borderRadius: 10, padding: "14px 16px", display: "flex", alignItems: "center", gap: 14, transition: "transform 0.15s ease", boxShadow: "0 2px 8px rgba(200,145,42,0.06)" }} onMouseEnter={e => e.currentTarget.style.transform = "translateY(-1px)"} onMouseLeave={e => e.currentTarget.style.transform = "none"}>
              <div style={{ width: 42, height: 42, borderRadius: "50%", background: "var(--gold)", display: "flex", alignItems: "center", justifyItems: "center", justifyContent: "center", fontSize: 20, color: "#fff", flexShrink: 0 }}>🧮</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#7B5A3A" }}>Order Calculator</div>
                <div style={{ fontSize: 11.5, color: "#8C6E52", marginTop: 2 }}>Build custom multi-tier pricing quotes instantly</div>
              </div>
            </div>

            {/* Grid of secondary actions */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[
                { label: "Production List", view: "prodlist", icon: "📅", bg: "#F8F3EA", border: "1px solid var(--border)" },
                { label: "Shopping List", view: "shopping", icon: "🛒", bg: "#F8F3EA", border: "1px solid var(--border)" },
                { label: "View Quotes", view: "quotes", icon: "📋", bg: "#F8F3EA", border: "1px solid var(--border)" },
                { label: "Log Expense", view: "expenses", icon: "💸", bg: "#F8F3EA", border: "1px solid var(--border)", roles: ["owner"] },
              ].filter(a => !a.roles || a.roles.includes(user?.role)).map(a => (
                <div key={a.view} onClick={() => setView(a.view)} style={{ cursor: "pointer", background: a.bg, border: a.border, borderRadius: 10, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10, transition: "transform 0.15s ease" }} onMouseEnter={e => e.currentTarget.style.transform = "translateY(-1px)"} onMouseLeave={e => e.currentTarget.style.transform = "none"}>
                  <span style={{ fontSize: 16 }}>{a.icon}</span>
                  <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--text)" }}>{a.label}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

      </div>
    </div>
  )
}
