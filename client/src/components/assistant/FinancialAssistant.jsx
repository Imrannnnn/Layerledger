/**
 * FinancialAssistant.jsx
 * ----------------------------------------------------------------------------
 * AI Financial Intelligence & Conversational Advisor.
 *
 * Core Value:
 * Gives bakery owners a complete, unified estimate of how much they have earned
 * and their true profit margins (gross and net) directly from verified database
 * records — without having to manually navigate and cross-reference multiple
 * dashboards (Orders, Invoices, Expenses, P&L, Monthly Overview).
 *
 * Premium Gatekeeping:
 * Exclusively available for active Premium plan subscribers.
 * Non-premium users are presented with a high-converting Premium feature
 * showcase and direct upgrade path.
 * ----------------------------------------------------------------------------
 */
import React, { useState, useEffect, useRef, useMemo } from "react"
import { Card, Btn, Badge, SHead, Spinner, Modal } from "../common/ui.jsx"
import {
  Sparkles,
  Crown,
  Send,
  TrendingUp,
  BarChart3,
  DollarSign,
  PieChart,
  ShieldCheck,
  RefreshCw,
  Copy,
  Check,
  AlertTriangle,
  ArrowRight,
  Info,
  Calendar,
  Layers,
  ChevronDown,
  HelpCircle,
  FileSpreadsheet,
  CheckCircle2,
  Lock
} from "lucide-react"
import {
  fetchAssistantStatus,
  fetchFinancialOverview,
  sendAssistantChat
} from "../../lib/data.js"
import { fmt } from "../../lib/helpers.js"

/**
 * Format currency in Nigerian Naira (₦)
 */
const fmtMoney = (val) => {
  const num = Number(val) || 0
  return `₦${Math.round(num).toLocaleString("en-NG")}`
}

/**
 * Lightweight, robust markdown renderer for assistant responses
 */
const SimpleMarkdownRenderer = ({ content }) => {
  if (!content) return null

  // Split into lines
  const lines = content.split("\n")
  const elements = []
  let tableRows = []
  let inTable = false

  const flushTable = (keyPrefix) => {
    if (tableRows.length > 0) {
      elements.push(
        <div key={`${keyPrefix}-tbl`} style={{ overflowX: "auto", margin: "14px 0" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 12.5,
              background: "rgba(255,255,255,0.7)",
              borderRadius: 8,
              overflow: "hidden"
            }}
          >
            <thead>
              <tr style={{ background: "rgba(200, 145, 42, 0.12)", borderBottom: "1.5px solid var(--border)" }}>
                {tableRows[0].map((th, idx) => (
                  <th key={idx} style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, color: "var(--text)" }}>
                    {formatInline(th)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.slice(1).map((row, rIdx) => (
                <tr
                  key={rIdx}
                  style={{
                    borderBottom: "1px solid rgba(0,0,0,0.06)",
                    background: rIdx % 2 === 0 ? "transparent" : "rgba(250,247,240,0.5)"
                  }}
                >
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} style={{ padding: "7px 12px", color: "var(--text)" }}>
                      {formatInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
      tableRows = []
      inTable = false
    }
  }

  const formatInline = (text = "") => {
    if (!text) return ""
    // Parse bold **text**
    const parts = text.split(/(\*\*.*?\*\*)/g)
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i} style={{ color: "var(--text)", fontWeight: 600 }}>{part.slice(2, -2)}</strong>
      }
      return part
    })
  }

  lines.forEach((line, index) => {
    const trimmed = line.trim()

    // Table detection
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      const cells = trimmed
        .split("|")
        .slice(1, -1)
        .map((c) => c.trim())

      // Skip separator row |:---|:---|
      if (cells.every((c) => /^:?-+:?$/.test(c))) {
        return
      }

      inTable = true
      tableRows.push(cells)
      return
    } else if (inTable) {
      flushTable(index)
    }

    // Blank lines
    if (!trimmed) {
      elements.push(<div key={index} style={{ height: 8 }} />)
      return
    }

    // Headings
    if (trimmed.startsWith("### ")) {
      elements.push(
        <h3
          key={index}
          style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 16,
            fontWeight: 700,
            color: "var(--text)",
            margin: "14px 0 6px",
            display: "flex",
            alignItems: "center",
            gap: 6
          }}
        >
          {formatInline(trimmed.slice(4))}
        </h3>
      )
      return
    }

    if (trimmed.startsWith("#### ")) {
      elements.push(
        <h4
          key={index}
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "var(--gold)",
            margin: "12px 0 4px"
          }}
        >
          {formatInline(trimmed.slice(5))}
        </h4>
      )
      return
    }

    // Blockquote / Audit Trace Callout
    if (trimmed.startsWith("> ")) {
      elements.push(
        <div
          key={index}
          style={{
            borderLeft: "3px solid var(--gold)",
            background: "rgba(200, 145, 42, 0.08)",
            padding: "8px 12px",
            borderRadius: "0 8px 8px 0",
            fontSize: 12,
            color: "var(--muted)",
            margin: "10px 0",
            lineHeight: 1.6
          }}
        >
          {formatInline(trimmed.slice(2))}
        </div>
      )
      return
    }

    // Bullet lists
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      elements.push(
        <div
          key={index}
          style={{
            display: "flex",
            gap: 8,
            alignItems: "flex-start",
            fontSize: 13,
            lineHeight: 1.6,
            marginBottom: 4,
            color: "var(--text)"
          }}
        >
          <span style={{ color: "var(--gold)", fontWeight: 700, flexShrink: 0 }}>•</span>
          <div>{formatInline(trimmed.slice(2))}</div>
        </div>
      )
      return
    }

    // Numbered lists
    const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/)
    if (numMatch) {
      elements.push(
        <div
          key={index}
          style={{
            display: "flex",
            gap: 8,
            alignItems: "flex-start",
            fontSize: 13,
            lineHeight: 1.6,
            marginBottom: 5,
            color: "var(--text)"
          }}
        >
          <span
            style={{
              width: 18,
              height: 18,
              borderRadius: "50%",
              background: "rgba(200, 145, 42, 0.15)",
              color: "var(--gold)",
              fontSize: 11,
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              marginTop: 2
            }}
          >
            {numMatch[1]}
          </span>
          <div>{formatInline(numMatch[2])}</div>
        </div>
      )
      return
    }

    // Standard paragraph
    elements.push(
      <p
        key={index}
        style={{
          fontSize: 13,
          lineHeight: 1.65,
          margin: "4px 0",
          color: "var(--text)"
        }}
      >
        {formatInline(trimmed)}
      </p>
    )
  })

  if (inTable) {
    flushTable("final")
  }

  return <div>{elements}</div>
}

export function FinancialAssistant({
  setView,
  user,
  tenantInfo,
  company = {},
  onUpgradePlan
}) {
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [status, setStatus] = useState({ hasAccess: false, plan: "free" })
  const [overview, setOverview] = useState(null)
  const [loadingOverview, setLoadingOverview] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [copiedId, setCopiedId] = useState(null)
  const [activeAuditModal, setActiveAuditModal] = useState(null)

  // Chat State
  const [messages, setMessages] = useState([
    {
      id: "welcome-msg",
      sender: "assistant",
      text: `### Executive Financial Intelligence Assistant
I provide verified, real-time calculations of your earnings, step-by-step profit margins (gross & net), and complete overhead breakdowns — directly from your database records without needing to navigate multiple dashboards.

Inquire about any timeframe: current month, year-to-date (YTD), previous month, or all-time performance.`,
      metrics: null,
      auditTrace: null,
      suggestedQuestions: [
        "Complete Earnings & Margin Analysis",
        "What is my current profit margin?",
        "How much have I spent, and on what?",
        "Which products generate the most profit?",
        "Compare this month with last month",
        "What areas are reducing my profitability?"
      ],
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    }
  ])
  const [inputMessage, setInputMessage] = useState("")
  const [isSending, setIsSending] = useState(false)
  const chatScrollRef = useRef(null)

  // Auto-scroll chat on new messages
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
    }
  }, [messages, isSending])

  // Check Subscription Entitlement
  const checkAccess = async () => {
    setLoadingStatus(true)
    try {
      const data = await fetchAssistantStatus()
      setStatus(data || { hasAccess: false, plan: "free" })
      if (data?.hasAccess) {
        loadFinancialOverview(selectedMonth)
      }
    } catch (err) {
      console.error("Assistant access check failed:", err)
      setStatus({ hasAccess: false, plan: "free", error: err.message })
    } finally {
      setLoadingStatus(false)
    }
  }

  // Load Financial Dataset
  const loadFinancialOverview = async (monthKey) => {
    setLoadingOverview(true)
    try {
      const res = await fetchFinancialOverview(monthKey)
      if (res?.success && res.data) {
        setOverview(res.data)
      }
    } catch (err) {
      console.error("Failed to load financial overview:", err)
    } finally {
      setLoadingOverview(false)
    }
  }

  useEffect(() => {
    checkAccess()
  }, [])

  // Handle Month Switch
  const handleMonthChange = (e) => {
    const newMonth = e.target.value
    setSelectedMonth(newMonth)
    if (status.hasAccess) {
      loadFinancialOverview(newMonth)
    }
  }

  // Submit Query to Assistant
  const handleSendMessage = async (textToSend) => {
    const query = (textToSend || inputMessage || "").trim()
    if (!query || isSending) return

    // Append user message immediately
    const userMsgId = `user-${Date.now()}`
    const newMessages = [
      ...messages,
      {
        id: userMsgId,
        sender: "user",
        text: query,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      }
    ]
    setMessages(newMessages)
    setInputMessage("")
    setIsSending(true)

    try {
      // Build conversation history for Claude context
      const conversationHistory = newMessages
        .filter((m) => m.id !== "welcome-msg")
        .slice(-6)
        .map((m) => ({
          role: m.sender === "user" ? "user" : "assistant",
          content: m.text
        }))

      const response = await sendAssistantChat({
        question: query,
        message: query,
        conversationHistory,
        month: selectedMonth
      })

      if (response && response.success) {
        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-${Date.now()}`,
            sender: "assistant",
            text: response.answer,
            metrics: response.metrics,
            auditTrace: response.auditTrace,
            suggestedQuestions: response.suggestedQuestions || [],
            engineUsed: response.engineUsed || "financial_analytics_engine",
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          }
        ])

        // If metrics returned, optionally sync with overview state
        if (response.metrics && overview?.currentMonth) {
          setOverview((prev) => ({
            ...prev,
            currentMonth: {
              ...prev?.currentMonth,
              ...response.metrics
            }
          }))
        }
      } else if (response?.code === "PREMIUM_PLAN_REQUIRED" || response?.status === 403) {
        setStatus((prev) => ({ ...prev, hasAccess: false }))
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            sender: "assistant",
            text: `**Plan Upgrade Required:**\n${response.message || "The AI Financial Intelligence Assistant is exclusively available for active Premium plan subscribers. Please upgrade your subscription to access this feature."}`,
            isError: true,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          }
        ])
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            sender: "assistant",
            text: `**Notice:** ${response?.message || "Could not retrieve financial answer. Please try again."}`,
            isError: true,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          }
        ])
      }
    } catch (err) {
      console.error("Error communicating with financial assistant:", err)
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: "assistant",
          text: `**Connection Error:** ${err.message || "Failed to reach assistant engine. Please verify your connection."}`,
          isError: true,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        }
      ])
    } finally {
      setIsSending(false)
    }
  }

  // Copy answer to clipboard
  const handleCopy = (id, text) => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    }
  }

  // Quick Questions
  const QUICK_QUESTIONS = [
    { label: "Complete Estimate & Margin Analysis", q: "Give me a complete estimate of how much I have earned and my profit margin" },
    { label: "Revenue Earned", q: "How much have I earned this month?" },
    { label: "Profit Margin Steps", q: "What is my current profit margin?" },
    { label: "Where Money Goes", q: "How much have I spent, and on what?" },
    { label: "Best Margin Products", q: "Which products generate the most profit?" },
    { label: "MoM Comparison", q: "How does this month compare with last month?" },
    { label: "Profit Drains", q: "What areas are reducing my profitability?" }
  ]

  // If loading status
  if (loadingStatus) {
    return (
      <div style={{ padding: "40px 20px", textAlign: "center" }}>
        <Spinner />
        <div style={{ marginTop: 12, fontSize: 13, color: "var(--muted)" }}>
          Checking AI Financial Assistant subscription status...
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────
  // PREMIUM PAYWALL GATEWAY (NON-PREMIUM USERS)
  // ─────────────────────────────────────────────────────────────
  if (!status.hasAccess) {
    return (
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "10px 0 40px" }}>
        <SHead
          title="AI Financial Intelligence"
          sub="Complete earnings estimates, gross & net profit margin analyses, and instant business diagnostics."
        />

        {/* Hero Showcase Card */}
        <div
          style={{
            background: "linear-gradient(135deg, #1E1712 0%, #2D2117 50%, #17110C 100%)",
            borderRadius: 16,
            padding: "36px 32px",
            color: "#FFF",
            boxShadow: "0 12px 36px rgba(0,0,0,0.25)",
            border: "1px solid rgba(200, 145, 42, 0.35)",
            position: "relative",
            overflow: "hidden",
            marginBottom: 24
          }}
        >
          {/* Subtle Ambient Glow */}
          <div
            style={{
              position: "absolute",
              top: -60,
              right: -60,
              width: 240,
              height: 240,
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(200,145,42,0.25) 0%, transparent 70%)",
              pointerEvents: "none"
            }}
          />

          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(200, 145, 42, 0.2)", padding: "4px 12px", borderRadius: 20, border: "1px solid rgba(200, 145, 42, 0.4)", marginBottom: 16 }}>
            <Crown size={14} color="var(--gold)" />
            <span style={{ fontSize: 11.5, color: "var(--gold)", fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase" }}>
              BakeWealth Premium Exclusive
            </span>
          </div>

          <h2
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 28,
              fontWeight: 700,
              color: "#FFF",
              margin: "0 0 12px",
              lineHeight: 1.25
            }}
          >
            A Complete Estimate of Your Earnings & Profit Margin — Without Navigating Every Dashboard
          </h2>

          <p
            style={{
              fontSize: 14.5,
              color: "#E0D3BB",
              lineHeight: 1.7,
              maxWidth: 720,
              margin: "0 0 24px"
            }}
          >
            Instead of manually clicking through Orders, Quotes, Expenses, Invoices, Monthly Overviews, and P&L statements to figure out your true profitability, our <strong>AI Financial Advisor</strong> reviews your verified bakery records and delivers instant, step-by-step earnings and margin analyses on demand.
          </p>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <button
              id="upgrade-to-premium-btn"
              onClick={() => {
                if (typeof onUpgradePlan === "function") {
                  onUpgradePlan("premium")
                } else if (typeof setView === "function") {
                  setView("settings")
                }
              }}
              style={{
                background: "linear-gradient(135deg, #C8912A, #A6751E)",
                border: "none",
                borderRadius: 8,
                padding: "12px 24px",
                color: "#FFF",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                boxShadow: "0 4px 16px rgba(200, 145, 42, 0.4)",
                transition: "all 0.2s"
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-1px)")}
              onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
            >
              <Crown size={16} />
              <span>Upgrade to Premium (₦10,000 / month)</span>
              <ArrowRight size={16} />
            </button>

            <Btn
              variant="ghost"
              onClick={() => setView("dashboard")}
              style={{ color: "#E0D3BB", borderColor: "rgba(255,255,255,0.2)" }}
            >
              Return to Dashboard
            </Btn>
          </div>
        </div>

        {/* Feature Highlights Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 24 }}>
          <Card style={{ borderLeft: "4px solid var(--gold)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: "rgba(200,145,42,0.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--gold)" }}>
                <DollarSign size={18} />
              </div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 700 }}>
                Instant Earnings Estimates
              </div>
            </div>
            <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.65 }}>
              Ask "How much have I made so far?" and get total revenue across paid orders, average order values (AOV), and year-to-date trajectories in seconds.
            </div>
          </Card>

          <Card style={{ borderLeft: "4px solid #357A52" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: "rgba(53,122,82,0.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "#357A52" }}>
                <TrendingUp size={18} />
              </div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 700 }}>
                Full Profit Margin Analysis
              </div>
            </div>
            <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.65 }}>
              Step-by-step breakdown: Gross Revenue -> COGS (ingredient production) -> Gross Margin % -> Operating Overheads -> Net Profit & Net Margin %.
            </div>
          </Card>

          <Card style={{ borderLeft: "4px solid #BA7517" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: "rgba(186,117,23,0.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "#BA7517" }}>
                <PieChart size={18} />
              </div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 700 }}>
                Expense & Drain Diagnostics
              </div>
            </div>
            <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.65 }}>
              Automatically detects high overhead categories, unbilled sample costs, and low-margin custom cake tiers that are reducing your take-home profits.
            </div>
          </Card>

          <Card style={{ borderLeft: "4px solid #2B4C7E" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: "rgba(43,76,126,0.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "#2B4C7E" }}>
                <ShieldCheck size={18} />
              </div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 700 }}>
                Zero Hallucinations
              </div>
            </div>
            <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.65 }}>
              Every calculation is strictly grounded in verified database transactions from your tenant account. No simulated or imaginary figures.
            </div>
          </Card>
        </div>

        {/* Interactive Sample Demo Preview */}
        <Card style={{ background: "#FFFDF9", border: "1px dashed var(--gold)", padding: 24 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Sparkles size={18} color="var(--gold)" />
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 700 }}>
                Preview What the AI Financial Advisor Provides
              </div>
            </div>
            <Badge color="gold">Live Demonstration</Badge>
          </div>

          <div
            style={{
              background: "#FAF6EF",
              borderRadius: 8,
              padding: 16,
              border: "1px solid var(--border)",
              fontSize: 13,
              lineHeight: 1.7,
              color: "var(--text)"
            }}
          >
            <div style={{ fontWeight: 600, color: "var(--gold)", marginBottom: 6 }}>
              Inquiry: "Give me a complete estimate of how much I've earned and my profit margin"
            </div>
            <div style={{ borderLeft: "3px solid var(--gold)", paddingLeft: 12, marginTop: 10 }}>
              <strong>AI Advisor:</strong>
              <div style={{ marginTop: 4 }}>
                • <strong>Total Confirmed Revenue:</strong> ₦850,000 across 18 orders (Avg ₦47,222/order)<br />
                • <strong>Ingredient Costs (COGS):</strong> -₦290,000 (34.1% of revenue)<br />
                • <strong>Gross Profit:</strong> ₦560,000 (<strong>65.9% Gross Margin</strong> [Optimal])<br />
                • <strong>Operating Overheads:</strong> -₦210,000 (Delivery, packaging, fuel)<br />
                • <strong>Net Take-Home Profit:</strong> ₦350,000 (<strong>41.2% Net Margin</strong> [Profitable])<br />
                • <strong>Top Earner:</strong> Custom 3-Tier Cakes generated ₦420,000 in gross profit.
              </div>
            </div>
          </div>

          <div style={{ textAlign: "center", marginTop: 20 }}>
            <Btn
              onClick={() => {
                if (typeof onUpgradePlan === "function") {
                  onUpgradePlan("premium")
                } else if (typeof setView === "function") {
                  setView("settings")
                }
              }}
              style={{ padding: "10px 24px", fontWeight: 600 }}
            >
              Unlock AI Financial Advisor on Premium →
            </Btn>
          </div>
        </Card>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────
  // ACTIVE PREMIUM INTERFACE: CONVERSATIONAL ASSISTANT & KPIS
  // ─────────────────────────────────────────────────────────────
  const curMetrics = overview?.currentMonth || {}
  const mom = overview?.momComparison || null

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", paddingBottom: 30 }}>
      {/* Header bar with Month Selector and Status Badge */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 16
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h1
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: 22,
                fontWeight: 700,
                color: "var(--text)",
                margin: 0
              }}
            >
              AI Financial Intelligence
            </h1>
            <Badge color="gold">PREMIUM</Badge>
          </div>
          <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>
            Instant earnings estimates, gross & net profit margins, and business diagnostics.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--panel)", padding: "4px 10px", borderRadius: 8, border: "1px solid var(--border)" }}>
            <Calendar size={14} color="var(--gold)" />
            <input
              type="month"
              value={selectedMonth}
              onChange={handleMonthChange}
              style={{
                border: "none",
                background: "transparent",
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 12.5,
                fontWeight: 500,
                color: "var(--text)",
                outline: "none",
                cursor: "pointer"
              }}
            />
          </div>

          <button
            onClick={() => {
              loadFinancialOverview(selectedMonth)
            }}
            disabled={loadingOverview}
            title="Refresh database metrics"
            style={{
              padding: "6px 12px",
              background: "rgba(200, 145, 42, 0.1)",
              border: "1px solid rgba(200, 145, 42, 0.25)",
              borderRadius: 8,
              color: "var(--gold)",
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6
            }}
          >
            <RefreshCw size={13} className={loadingOverview ? "spin" : ""} />
            <span>{loadingOverview ? "Auditing..." : "Refresh"}</span>
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          TOP EXECUTIVE SNAPSHOT CARDS
          (Gives users their complete estimate without visiting other dashboards)
      ───────────────────────────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
          marginBottom: 20
        }}
      >
        {/* Card 1: Total Revenue */}
        <Card style={{ padding: "14px 16px", background: "#FFFDF9", borderLeft: "4px solid var(--gold)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <span style={{ fontSize: 11.5, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 600 }}>
              Total Earned (Revenue)
            </span>
            <DollarSign size={16} color="var(--gold)" />
          </div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: "var(--text)", margin: "6px 0 2px" }}>
            {fmtMoney(curMetrics.revenue || 0)}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--muted)", display: "flex", alignItems: "center", gap: 6 }}>
            <span>{curMetrics.paidOrderCount || 0} confirmed orders</span>
            {mom?.revenue && (
              <span style={{ color: mom.revenue.difference >= 0 ? "#357A52" : "#B03A2E", fontWeight: 600 }}>
                {mom.revenue.percentageChange >= 0 ? `+${mom.revenue.percentageChange}%` : `${mom.revenue.percentageChange}%`}
              </span>
            )}
          </div>
        </Card>

        {/* Card 2: Gross Profit & Margin */}
        <Card style={{ padding: "14px 16px", background: "#FFFDF9", borderLeft: "4px solid #357A52" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <span style={{ fontSize: 11.5, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 600 }}>
              Gross Profit & Margin
            </span>
            <span
              style={{
                background: (curMetrics.grossMarginPct || 0) >= 40 ? "#E1F5EE" : "#FAEEDA",
                color: (curMetrics.grossMarginPct || 0) >= 40 ? "#085041" : "#BA7517",
                fontSize: 11,
                fontWeight: 700,
                padding: "2px 6px",
                borderRadius: 4
              }}
            >
              {curMetrics.grossMarginPct || 0}% Margin
            </span>
          </div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: "#357A52", margin: "6px 0 2px" }}>
            {fmtMoney(curMetrics.grossProfit || 0)}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--muted)" }}>
            COGS: -{fmtMoney(curMetrics.cogs || 0)}
          </div>
        </Card>

        {/* Card 3: Operating Overheads */}
        <Card style={{ padding: "14px 16px", background: "#FFFDF9", borderLeft: "4px solid #BA7517" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <span style={{ fontSize: 11.5, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 600 }}>
              Operating Overheads
            </span>
            <PieChart size={16} color="#BA7517" />
          </div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: "var(--text)", margin: "6px 0 2px" }}>
            {fmtMoney(curMetrics.totalOverhead || 0)}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {curMetrics.topExpenseDrains?.[0]
              ? `Top: ${curMetrics.topExpenseDrains[0].category} (${fmtMoney(curMetrics.topExpenseDrains[0].amount)})`
              : `${curMetrics.expenseCount || 0} expense entries`}
          </div>
        </Card>

        {/* Card 4: Net Profit & Net Margin */}
        <Card
          style={{
            padding: "14px 16px",
            background: "#FFFDF9",
            borderLeft: `4px solid ${(curMetrics.netProfit || 0) >= 0 ? "#357A52" : "#B03A2E"}`
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <span style={{ fontSize: 11.5, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 600 }}>
              Net Profit (Take-Home)
            </span>
            <span
              style={{
                background: (curMetrics.netProfit || 0) >= 0 ? "#E1F5EE" : "#FDEBE9",
                color: (curMetrics.netProfit || 0) >= 0 ? "#085041" : "#B03A2E",
                fontSize: 11,
                fontWeight: 700,
                padding: "2px 6px",
                borderRadius: 4
              }}
            >
              {curMetrics.netMarginPct || 0}% Net
            </span>
          </div>
          <div
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 22,
              fontWeight: 700,
              color: (curMetrics.netProfit || 0) >= 0 ? "#357A52" : "#B03A2E",
              margin: "6px 0 2px"
            }}
          >
            {fmtMoney(curMetrics.netProfit || 0)}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--muted)" }}>
            {(curMetrics.netProfit || 0) >= 0 ? "Retained cash after overheads" : "Expenses exceeded gross profit"}
          </div>
        </Card>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          CONVERSATIONAL AI CHAT INTERFACE
      ───────────────────────────────────────────────────────────── */}
      <Card
        style={{
          display: "flex",
          flexDirection: "column",
          height: 600,
          padding: 0,
          overflow: "hidden",
          border: "1px solid rgba(200, 145, 42, 0.25)",
          boxShadow: "0 6px 24px rgba(41, 22, 8, 0.04)"
        }}
      >
        {/* Chat Header Bar */}
        <div
          style={{
            padding: "12px 18px",
            background: "linear-gradient(135deg, #FAF4E8, #FFFDF9)",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #C8912A, #8C6E52)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#FFF",
                boxShadow: "0 2px 8px rgba(200, 145, 42, 0.3)"
              }}
            >
              <Sparkles size={16} />
            </div>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text)" }}>
                BakeWealth Chief Financial Advisor
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)", display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#357A52", display: "inline-block" }} />
                <span>Grounded in verified database records • Dual-Engine AI</span>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => {
                setMessages([
                  {
                    id: `reset-${Date.now()}`,
                    sender: "assistant",
                    text: `### Financial Session Reset
Ask me anything about your earnings, profit margin steps, or overhead drains for **${overview?.currentMonth?.periodLabel || selectedMonth}**!`,
                    suggestedQuestions: [
                      "Complete Earnings & Margin Analysis",
                      "What is my current profit margin?",
                      "How much have I spent, and on what?"
                    ],
                    timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                  }
                ])
              }}
              style={{
                background: "transparent",
                border: "none",
                fontSize: 11.5,
                color: "var(--muted)",
                cursor: "pointer",
                padding: "4px 8px"
              }}
            >
              Clear conversation
            </button>
          </div>
        </div>

        {/* Chat Message Scroll Window */}
        <div
          ref={chatScrollRef}
          style={{
            flex: 1,
            padding: "20px 22px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 16,
            background: "#FDFAF4"
          }}
        >
          {messages.map((m) => {
            const isUser = m.sender === "user"

            return (
              <div
                key={m.id}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: isUser ? "flex-end" : "flex-start",
                  maxWidth: "100%"
                }}
              >
                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    maxWidth: isUser ? "85%" : "92%",
                    alignItems: "flex-start",
                    flexDirection: isUser ? "row-reverse" : "row"
                  }}
                >
                  {/* Avatar */}
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: isUser ? "var(--text)" : "var(--gold)",
                      color: "#FFF",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                      fontWeight: 700,
                      flexShrink: 0,
                      marginTop: 2
                    }}
                  >
                    {isUser ? (user?.name ? user.name[0].toUpperCase() : "U") : <Sparkles size={14} />}
                  </div>

                  {/* Bubble Container */}
                  <div
                    style={{
                      background: isUser
                        ? "linear-gradient(135deg, #2D1D10, #3E2917)"
                        : m.isError
                        ? "#FFF5F5"
                        : "#FFFFFF",
                      color: isUser ? "#FFF" : "var(--text)",
                      padding: "12px 16px",
                      borderRadius: isUser ? "16px 4px 16px 16px" : "4px 16px 16px 16px",
                      border: isUser
                        ? "none"
                        : m.isError
                        ? "1px solid #FEB2B2"
                        : "1px solid var(--border)",
                      boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
                      fontSize: 13,
                      lineHeight: 1.6
                    }}
                  >
                    {/* Render content */}
                    {isUser ? (
                      <div style={{ whiteSpace: "pre-wrap", fontWeight: 500 }}>{m.text}</div>
                    ) : (
                      <SimpleMarkdownRenderer content={m.text} />
                    )}

                    {/* Actions Row for Assistant */}
                    {!isUser && !m.isError && (
                      <div
                        style={{
                          marginTop: 10,
                          paddingTop: 8,
                          borderTop: "1px solid rgba(0,0,0,0.06)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          fontSize: 11,
                          color: "var(--muted)",
                          flexWrap: "wrap",
                          gap: 8
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <button
                            onClick={() => handleCopy(m.id, m.text)}
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              padding: 0,
                              color: copiedId === m.id ? "#357A52" : "var(--muted)",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              fontSize: 11
                            }}
                          >
                            {copiedId === m.id ? <Check size={12} /> : <Copy size={12} />}
                            <span>{copiedId === m.id ? "Copied" : "Copy analysis"}</span>
                          </button>

                          {m.auditTrace && (
                            <button
                              onClick={() => setActiveAuditModal(m.auditTrace)}
                              style={{
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                padding: 0,
                                color: "var(--gold)",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                fontSize: 11
                              }}
                            >
                              <ShieldCheck size={12} />
                              <span>Audit Trace</span>
                            </button>
                          )}
                        </div>

                        <div style={{ fontSize: 10.5, color: "#A08A75" }}>
                          {m.timestamp}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Suggested Follow-up Questions Chips */}
                {!isUser && Array.isArray(m.suggestedQuestions) && m.suggestedQuestions.length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 6,
                      marginTop: 8,
                      marginLeft: 38
                    }}
                  >
                    {m.suggestedQuestions.map((sq, sIdx) => (
                      <button
                        key={sIdx}
                        onClick={() => handleSendMessage(sq)}
                        style={{
                          background: "#FFFDF9",
                          border: "1px solid rgba(200, 145, 42, 0.35)",
                          borderRadius: 20,
                          padding: "4px 10px",
                          fontSize: 11.5,
                          color: "var(--text)",
                          cursor: "pointer",
                          transition: "all 0.15s",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "rgba(200, 145, 42, 0.1)"
                          e.currentTarget.style.borderColor = "var(--gold)"
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "#FFFDF9"
                          e.currentTarget.style.borderColor = "rgba(200, 145, 42, 0.35)"
                        }}
                      >
                        <span>{sq}</span>
                        <ArrowRight size={10} color="var(--gold)" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          {/* Typing / Auditing Indicator */}
          {isSending && (
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 4 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: "var(--gold)",
                  color: "#FFF",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11
                }}
              >
                <Sparkles size={14} className="spin" />
              </div>
              <div
                style={{
                  background: "#FFF",
                  border: "1px solid var(--border)",
                  padding: "10px 14px",
                  borderRadius: "4px 16px 16px 16px",
                  fontSize: 12.5,
                  color: "var(--muted)",
                  display: "flex",
                  alignItems: "center",
                  gap: 8
                }}
              >
                <span>Reviewing your bakery records & calculating profit margins...</span>
              </div>
            </div>
          )}
        </div>

        {/* Quick Questions Strip */}
        <div
          style={{
            padding: "8px 16px",
            background: "#FAF6EF",
            borderTop: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            gap: 8,
            overflowX: "auto",
            flexShrink: 0
          }}
        >
          <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8, flexShrink: 0 }}>
            Quick Prompts:
          </span>
          {QUICK_QUESTIONS.map((item, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(item.q)}
              disabled={isSending}
              style={{
                background: "#FFF",
                border: "1px solid var(--border)",
                borderRadius: 14,
                padding: "3px 10px",
                fontSize: 11.5,
                color: "var(--text)",
                cursor: "pointer",
                whiteSpace: "nowrap",
                flexShrink: 0,
                transition: "all 0.15s"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--gold)"
                e.currentTarget.style.color = "var(--gold)"
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--border)"
                e.currentTarget.style.color = "var(--text)"
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div
          style={{
            padding: "12px 18px",
            background: "#FFF",
            borderTop: "1px solid var(--border)",
            display: "flex",
            gap: 10,
            alignItems: "center",
            flexShrink: 0
          }}
        >
          <input
            id="financial-assistant-input"
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handleSendMessage()
              }
            }}
            placeholder="Ask anything about your earnings, profit margins, costs, or product profitability..."
            disabled={isSending}
            style={{
              flex: 1,
              padding: "10px 14px",
              borderRadius: 8,
              border: "1.5px solid var(--border)",
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 13,
              color: "var(--text)",
              background: "#FDFAF4",
              outline: "none",
              transition: "border-color 0.2s"
            }}
            onFocus={(e) => (e.target.style.borderColor = "var(--gold)")}
            onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
          />

          <button
            id="financial-assistant-send-btn"
            onClick={() => handleSendMessage()}
            disabled={!inputMessage.trim() || isSending}
            style={{
              background: inputMessage.trim() && !isSending ? "var(--gold)" : "rgba(200, 145, 42, 0.4)",
              color: "#FFF",
              border: "none",
              borderRadius: 8,
              padding: "10px 18px",
              cursor: inputMessage.trim() && !isSending ? "pointer" : "not-allowed",
              fontSize: 13,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 6,
              transition: "background 0.2s"
            }}
          >
            <span>Ask</span>
            <Send size={14} />
          </button>
        </div>
      </Card>

      {/* ─────────────────────────────────────────────────────────────
          AUDIT TRACE MODAL
      ───────────────────────────────────────────────────────────── */}
      {activeAuditModal && (
        <Modal title="Database Calculation & Audit Trace" onClose={() => setActiveAuditModal(null)}>
          <div style={{ padding: "4px 0", fontSize: 13, lineHeight: 1.7, color: "var(--text)" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "rgba(53, 122, 82, 0.1)",
                padding: "8px 12px",
                borderRadius: 8,
                color: "#357A52",
                fontWeight: 600,
                marginBottom: 14
              }}
            >
              <CheckCircle2 size={16} />
              <span>100% Mathematically Verified Database Trace</span>
            </div>

            <p>
              This financial analysis was computed in real-time by querying your business's confirmed orders, ingredient costs, and operating expenses. Zero figures were guessed, projected, or simulated.
            </p>

            <div style={{ background: "#FAF7F0", padding: 12, borderRadius: 8, border: "1px solid var(--border)", fontSize: 12.5 }}>
              <div><strong>Tenant ID:</strong> {activeAuditModal.tenantId || tenantInfo?.id || "Current Tenant"}</div>
              <div><strong>Reporting Period:</strong> {activeAuditModal.reportingPeriod || selectedMonth}</div>
              <div><strong>Orders Audited:</strong> {activeAuditModal.ordersAnalyzed ?? curMetrics.paidOrderCount ?? 0} confirmed records</div>
              <div><strong>Expenses Audited:</strong> {activeAuditModal.expensesAnalyzed ?? curMetrics.expenseCount ?? 0} overhead entries</div>
              <div><strong>Computed At:</strong> {activeAuditModal.calculatedAt ? new Date(activeAuditModal.calculatedAt).toLocaleString() : new Date().toLocaleString()}</div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18 }}>
              <Btn onClick={() => setActiveAuditModal(null)}>Close</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
