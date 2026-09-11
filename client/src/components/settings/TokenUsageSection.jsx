import React, { useState, useEffect, useCallback, useMemo } from "react"
import { Card, Btn, Badge, TH, TR2, Pagination, iSt } from "../common/ui.jsx"
import { Coins, Zap, RefreshCw, ArrowUpRight, ArrowDownLeft, CreditCard, MessageSquare, Search, X, ShieldCheck, CheckCircle, AlertTriangle } from "lucide-react"
import { fetchTokenBalance, fetchTokenHistory, loadLocal } from "../../lib/data.js"
import { DummyPaymentGatewayModal } from "../common/DummyPaymentGatewayModal.jsx"

const TOKEN_PACKS = [
  {
    id: "starter",
    name: "Starter Pack",
    tokens: 5,
    credits: 5,
    price: 1000,
    scans: 2,
    popular: false,
    description: "Ideal for light usage & receipt scanning."
  },
  {
    id: "pro",
    name: "Baker Pro Pack",
    tokens: 12.5,
    credits: 12.5,
    price: 2500,
    scans: 6,
    popular: true,
    description: "Best value for busy bakeries with regular orders & expenses."
  },
  {
    id: "commercial",
    name: "Commercial Pack",
    tokens: 25,
    credits: 25,
    price: 5000,
    scans: 12,
    popular: false,
    description: "Maximum savings for high-volume bakeries & teams."
  }
]

export function TokenUsageSection({ company = {} }) {
  const [balance, setBalance] = useState(() => {
    const t = loadLocal("ll_tenant_info", null)
    return typeof t?.tokenBalance === "number" ? t.tokenBalance : 0
  })
  const [history, setHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [selectedPackId, setSelectedPackId] = useState("pro")
  const [customTokens, setCustomTokens] = useState("")
  const [isCustom, setIsCustom] = useState(false)
  const [paymentSuccess, setPaymentSuccess] = useState("")
  const [paymentError, setPaymentError] = useState("")
  const [gatewayOpen, setGatewayOpen] = useState(false)

  // Pagination & Filtering state
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [filterType, setFilterType] = useState("all") // "all" | "topups" | "deductions"
  const [searchQuery, setSearchQuery] = useState("")

  const loadData = useCallback(async () => {
    setLoadingHistory(true)
    try {
      const [balRes, histRes] = await Promise.all([
        fetchTokenBalance(),
        fetchTokenHistory()
      ])
      if (typeof balRes?.tokenBalance === "number") {
        setBalance(balRes.tokenBalance)
      }
      setHistory(Array.isArray(histRes) ? histRes : [])
    } catch (err) {
      console.warn("Failed to load token information:", err)
    } finally {
      setLoadingHistory(false)
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

    window.addEventListener("bakewealth:token-updated", onTokenUpdated)
    window.addEventListener("layerledger:token-updated", onTokenUpdated)
    window.addEventListener("layerledger:credit-updated", onTokenUpdated)
    return () => {
      window.removeEventListener("bakewealth:token-updated", onTokenUpdated)
      window.removeEventListener("layerledger:token-updated", onTokenUpdated)
      window.removeEventListener("layerledger:credit-updated", onTokenUpdated)
    }
  }, [loadData])

  const selectedPack = TOKEN_PACKS.find(p => p.id === selectedPackId) || TOKEN_PACKS[1]
  const activeTokens = isCustom ? (parseFloat(customTokens) || 0) : selectedPack.tokens
  const activePrice = isCustom ? Math.round(activeTokens * 200) : selectedPack.price

  const handlePayAndTopup = () => {
    if (activeTokens <= 0) {
      setPaymentError("Please select or enter a valid number of credits.")
      return
    }
    setPaymentError("")
    setGatewayOpen(true)
  }

  const handleGatewaySuccess = async (res) => {
    if (res && typeof res.newBalance === "number") {
      setBalance(res.newBalance)
    }
    setPaymentSuccess(`Payment successful! ${activeTokens} credits added to your balance.`)
    const hist = await fetchTokenHistory()
    if (Array.isArray(hist)) setHistory(hist)
    setTimeout(() => setPaymentSuccess(""), 4000)
  }

  const handleWhatsAppOrder = () => {
    const adminPhone = company.phone || "2348000000000"
    const cleanPhone = adminPhone.replace(/[^0-9]/g, "").replace(/^0/, "234")
    const packName = isCustom ? `${activeTokens} Custom Credits` : selectedPack.name
    const text = encodeURIComponent(
      `Hello! I would like to pay for ${packName} (${activeTokens} AI Credits for ₦${activePrice.toLocaleString()}) for my bakery account: "${company.name || "My Bakery"}". Current credit balance: ${Number(balance).toFixed(1)}.`
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

  const handleFilterChange = (type) => {
    setFilterType(type)
    setCurrentPage(1)
  }

  const handleSearchChange = (val) => {
    setSearchQuery(val)
    setCurrentPage(1)
  }

  const handleClearFilters = () => {
    setFilterType("all")
    setSearchQuery("")
    setCurrentPage(1)
  }

  const scansRemaining = Math.floor(balance / 2)

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* 1. Top Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
        <Card style={{ background: "var(--panel)", border: "1px solid var(--border)", position: "relative" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 600 }}>
              Current Credit Balance
            </div>
            {balance >= 2 ? (
              <Badge color="green">Active</Badge>
            ) : (
              <Badge color="red">Low / Needs Top-Up</Badge>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
            <Coins size={28} color="var(--gold)" style={{ alignSelf: "center" }} />
            <span style={{ fontSize: 30, fontWeight: 700, color: "var(--text)" }}>
              {Number(balance).toFixed(1)}
            </span>
            <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 500 }}>Credits</span>
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", display: "flex", alignItems: "center", gap: 5 }}>
            <Zap size={13} color="var(--gold)" />
            <span>Receipts: <strong>2 credits</strong> • Bank statements: <strong>5 credits</strong></span>
          </div>
        </Card>

        <Card style={{ background: "var(--panel)", border: "1px solid var(--border)" }}>
          <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 600, marginBottom: 10 }}>
            Estimated Receipt Scans Remaining
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 30, fontWeight: 700, color: scansRemaining > 0 ? "var(--gold)" : "#B03A2E" }}>
              {scansRemaining}
            </span>
            <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 500 }}>Scans Available</span>
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>
            Receipt OCR (2 credits) & Bank Statement reconciliations (5 credits).
          </div>
        </Card>
      </div>

      {/* 2. Make Payment / Purchase Credits Section */}
      <Card style={{ background: "var(--panel)", border: "1px solid var(--border)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
          <div>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, fontWeight: 600 }}>
              Make Payment for AI Credits
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
              Choose a credit bundle and complete payment to top up your account balance.
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#27AE60" }}>
            <ShieldCheck size={16} />
            <span>Secure & Instant Fulfillment</span>
          </div>
        </div>

        {paymentSuccess && (
          <div style={{ background: "#EEF8F3", border: "1px solid #C2E0CF", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "#2D7A50", display: "flex", alignItems: "center", gap: 8 }}>
            <CheckCircle size={16} color="#2D7A50" />
            <span>{paymentSuccess}</span>
          </div>
        )}

        {paymentError && (
          <div style={{ background: "#FDEBE9", border: "1px solid #F0A89E", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "#B03A2E", display: "flex", alignItems: "center", gap: 8 }}>
            <AlertTriangle size={16} color="#B03A2E" />
            <span>{paymentError}</span>
          </div>
        )}

        {/* Packages Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 16 }}>
          {TOKEN_PACKS.map(pack => {
            const isSelected = !isCustom && selectedPackId === pack.id
            return (
              <div
                key={pack.id}
                onClick={() => {
                  setIsCustom(false)
                  setSelectedPackId(pack.id)
                }}
                style={{
                  border: isSelected ? "2px solid var(--gold)" : "1px solid var(--border)",
                  background: isSelected ? "rgba(200,145,42,0.08)" : "#FAF7F0",
                  borderRadius: 10,
                  padding: 14,
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
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4, color: "var(--text)" }}>
                  {pack.name}
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "var(--gold)", marginBottom: 4 }}>
                  ₦{pack.price.toLocaleString()}
                </div>
                <div style={{ fontSize: 12, color: "var(--text)", fontWeight: 500, marginBottom: 4 }}>
                  {pack.tokens} Credits (~{pack.scans} receipt scans)
                </div>
                <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.4 }}>
                  {pack.description}
                </div>
              </div>
            )
          })}

          {/* Custom Credits Option */}
          <div
            onClick={() => setIsCustom(true)}
            style={{
              border: isCustom ? "2px solid var(--gold)" : "1px solid var(--border)",
              background: isCustom ? "rgba(200,145,42,0.08)" : "#FAF7F0",
              borderRadius: 10,
              padding: 14,
              cursor: "pointer",
              transition: "all 0.15s ease"
            }}
          >
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4, color: "var(--text)" }}>
              Custom Amount
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>
              Enter any number of credits (₦200 / credit)
            </div>
            <input
              type="number"
              min="1"
              step="any"
              placeholder="e.g. 25"
              value={customTokens}
              onFocus={() => setIsCustom(true)}
              onChange={e => {
                setIsCustom(true)
                setCustomTokens(e.target.value)
              }}
              style={{
                width: "100%",
                padding: "6px 8px",
                borderRadius: 6,
                border: "1px solid var(--border)",
                fontSize: 13,
                boxSizing: "border-box"
              }}
            />
            {isCustom && activeTokens > 0 && (
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--gold)", marginTop: 6 }}>
                Total: ₦{activePrice.toLocaleString()}
              </div>
            )}
          </div>
        </div>

        {/* Payment Action Bar */}
        <div style={{ background: "#F5EFE3", borderRadius: 10, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.8 }}>
              Selected Package
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>
              {isCustom ? `${activeTokens} Credits` : selectedPack.name} — <span style={{ color: "var(--gold)" }}>₦{activePrice.toLocaleString()}</span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Btn
              variant="outline"
              onClick={handleWhatsAppOrder}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5 }}
            >
              <MessageSquare size={14} />
              <span>Pay via WhatsApp Concierge</span>
            </Btn>

            <Btn
              onClick={handlePayAndTopup}
              disabled={activeTokens <= 0}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600 }}
            >
              <CreditCard size={14} />
              <span>Pay & Top-Up ₦{activePrice.toLocaleString()}</span>
            </Btn>
          </div>
        </div>
      </Card>

      {/* 3. Credit Usage & Transaction History */}
      <Card style={{ background: "var(--panel)", border: "1px solid var(--border)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
          <div>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, fontWeight: 600 }}>
              Credit Usage & Transaction History
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
              Detailed ledger of every AI scan deduction and credit top-up.
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

        {history.length === 0 ? (
          <div style={{ textAlign: "center", padding: "30px 10px", color: "var(--muted)", fontSize: 13 }}>
            <Zap size={24} style={{ margin: "0 auto 8px", opacity: 0.4 }} />
            <div>No credit transactions recorded yet.</div>
            <div style={{ fontSize: 11.5, marginTop: 4 }}>
              Every time you use the Receipt Scanner, Bank Statement reader, or purchase credits, logs will appear here.
            </div>
          </div>
        ) : (
          <div>
            {/* Quick KPI Overview */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
              gap: 10,
              marginBottom: 16
            }}>
              <div style={{
                background: "#F0FDF4",
                border: "1px solid #BBF7D0",
                borderRadius: 8,
                padding: "10px 12px",
                display: "flex",
                flexDirection: "column"
              }}>
                <div style={{ fontSize: 11, color: "#166534", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Total Credits Added
                </div>
                <div style={{ fontSize: 17, fontWeight: 700, color: "#15803D", marginTop: 2 }}>
                  +{stats.totalAdded.toFixed(1)} <span style={{ fontSize: 11.5, fontWeight: 500 }}>({stats.topUpsCount} top-ups)</span>
                </div>
              </div>

              <div style={{
                background: "#FFFBEB",
                border: "1px solid #FDE68A",
                borderRadius: 8,
                padding: "10px 12px",
                display: "flex",
                flexDirection: "column"
              }}>
                <div style={{ fontSize: 11, color: "#92400E", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Total AI Deductions
                </div>
                <div style={{ fontSize: 17, fontWeight: 700, color: "#B45309", marginTop: 2 }}>
                  -{stats.totalDeducted.toFixed(1)} <span style={{ fontSize: 11.5, fontWeight: 500 }}>({stats.deductionsCount} scans)</span>
                </div>
              </div>

              <div style={{
                background: "#FAF7F0",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "10px 12px",
                display: "flex",
                flexDirection: "column"
              }}>
                <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Total Activity
                </div>
                <div style={{ fontSize: 17, fontWeight: 700, color: "var(--text)", marginTop: 2 }}>
                  {stats.totalCount} <span style={{ fontSize: 11.5, fontWeight: 500, color: "var(--muted)" }}>transactions</span>
                </div>
              </div>
            </div>

            {/* Filter & Search Toolbar */}
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 10,
              marginBottom: 12
            }}>
              {/* Filter Pills */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {[
                  { id: "all", label: `All (${history.length})` },
                  { id: "topups", label: `Top-Ups (${stats.topUpsCount})` },
                  { id: "deductions", label: `AI Usage (${stats.deductionsCount})` }
                ].map(tab => {
                  const isActive = filterType === tab.id
                  return (
                    <button
                      key={tab.id}
                      onClick={() => handleFilterChange(tab.id)}
                      style={{
                        background: isActive ? "var(--gold)" : "var(--panel)",
                        color: isActive ? "#fff" : "var(--text)",
                        border: `1px solid ${isActive ? "var(--gold)" : "var(--border)"}`,
                        borderRadius: 20,
                        padding: "5px 12px",
                        fontSize: 12,
                        fontWeight: isActive ? 600 : 400,
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                        fontFamily: "inherit"
                      }}
                    >
                      {tab.label}
                    </button>
                  )
                })}
              </div>

              {/* Search input */}
              <div style={{ position: "relative", minWidth: 200, flex: "1 1 200px", maxWidth: 280 }}>
                <Search size={14} color="var(--muted)" style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)" }} />
                <input
                  type="text"
                  placeholder="Search description or type..."
                  value={searchQuery}
                  onChange={e => handleSearchChange(e.target.value)}
                  style={{
                    ...iSt,
                    padding: "6px 28px 6px 28px",
                    fontSize: 12,
                    borderRadius: 20
                  }}
                />
                {searchQuery && (
                  <X
                    size={13}
                    color="var(--muted)"
                    onClick={() => handleSearchChange("")}
                    style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)", cursor: "pointer" }}
                  />
                )}
              </div>
            </div>

            {/* Table */}
            {filteredHistory.length === 0 ? (
              <div style={{
                textAlign: "center",
                padding: "24px 12px",
                color: "var(--muted)",
                fontSize: 12.5,
                background: "#FAF7F0",
                borderRadius: 8,
                border: "1px dashed var(--border)"
              }}>
                <div>No transactions match your current search or filter.</div>
                <button
                  onClick={handleClearFilters}
                  style={{
                    marginTop: 8,
                    background: "none",
                    border: "none",
                    color: "var(--gold)",
                    cursor: "pointer",
                    textDecoration: "underline",
                    fontSize: 12,
                    fontFamily: "inherit"
                  }}
                >
                  Clear search & filters
                </button>
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
                              {tx.type === "ai_usage" ? "AI Feature" : tx.type || "Transaction"}
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

                {/* Pagination Controls */}
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
          </div>
        )}
      </Card>

      <DummyPaymentGatewayModal
        isOpen={gatewayOpen}
        onClose={() => setGatewayOpen(false)}
        amount={activePrice}
        tokens={activeTokens}
        packageName={isCustom ? `${activeTokens} Custom Credits` : selectedPack.name}
        customerEmail={company.email || "bakery@bakewealth.com"}
        onPaymentSuccess={handleGatewaySuccess}
      />
    </div>
  )
}
