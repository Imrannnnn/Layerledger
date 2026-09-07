import React, { useState, useEffect, useCallback } from "react"
import { Card, Btn, Badge, TH, TR2, Inp } from "../common/ui.jsx"
import { Coins, Zap, RefreshCw, ArrowUpRight, ArrowDownLeft, CheckCircle, AlertTriangle, ShieldCheck, CreditCard, Building2, MessageSquare } from "lucide-react"
import { fetchTokenBalance, fetchTokenHistory, purchaseTokens, loadLocal } from "../../lib/data.js"
import { fmt } from "../../lib/helpers.js"
import { DummyPaymentGatewayModal } from "../common/DummyPaymentGatewayModal.jsx"

const TOKEN_PACKS = [
  {
    id: "starter",
    name: "Starter Pack",
    tokens: 10,
    price: 1000,
    scans: 14,
    popular: false,
    description: "Ideal for light usage & occasional receipt scanning."
  },
  {
    id: "pro",
    name: "Baker Pro Pack",
    tokens: 50,
    price: 4500,
    scans: 71,
    popular: true,
    description: "Best value for busy bakeries with regular orders & expenses."
  },
  {
    id: "commercial",
    name: "Commercial Pack",
    tokens: 100,
    price: 8000,
    scans: 142,
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
  const [paying, setPaying] = useState(false)
  const [paymentSuccess, setPaymentSuccess] = useState("")
  const [paymentError, setPaymentError] = useState("")
  const [gatewayOpen, setGatewayOpen] = useState(false)

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
      const newBal = e.detail?.tokenBalance
      if (typeof newBal === "number") {
        setBalance(newBal)
      }
      // Refresh history
      fetchTokenHistory().then(hist => {
        if (Array.isArray(hist)) setHistory(hist)
      })
    }

    window.addEventListener("bakewealth:token-updated", onTokenUpdated)
    window.addEventListener("layerledger:token-updated", onTokenUpdated)
    return () => {
      window.removeEventListener("bakewealth:token-updated", onTokenUpdated)
      window.removeEventListener("layerledger:token-updated", onTokenUpdated)
    }
  }, [loadData])

  const selectedPack = TOKEN_PACKS.find(p => p.id === selectedPackId) || TOKEN_PACKS[1]
  const activeTokens = isCustom ? (parseInt(customTokens, 10) || 0) : selectedPack.tokens
  const activePrice = isCustom ? activeTokens * 100 : selectedPack.price

  const handlePayAndTopup = () => {
    if (activeTokens <= 0) {
      setPaymentError("Please select or enter a valid number of tokens.")
      return
    }
    setPaymentError("")
    setGatewayOpen(true)
  }

  const handleGatewaySuccess = async (res) => {
    if (res && typeof res.newBalance === "number") {
      setBalance(res.newBalance)
    }
    setPaymentSuccess(`Payment successful! ${activeTokens} tokens added to your balance.`)
    const hist = await fetchTokenHistory()
    if (Array.isArray(hist)) setHistory(hist)
    setTimeout(() => setPaymentSuccess(""), 4000)
  }

  const handleWhatsAppOrder = () => {
    const adminPhone = company.phone || "2348000000000"
    const cleanPhone = adminPhone.replace(/[^0-9]/g, "").replace(/^0/, "234")
    const packName = isCustom ? `${activeTokens} Custom Tokens` : selectedPack.name
    const text = encodeURIComponent(
      `Hello! I would like to pay for ${packName} (${activeTokens} AI Tokens for ₦${activePrice.toLocaleString()}) for my bakery account: "${company.name || "My Bakery"}". Current token balance: ${Number(balance).toFixed(1)}.`
    )
    window.open(`https://wa.me/${cleanPhone}?text=${text}`, "_blank")
  }

  const scansRemaining = Math.floor(balance / 0.7)

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* 1. Top Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
        <Card style={{ background: "var(--panel)", border: "1px solid var(--border)", position: "relative" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 600 }}>
              Current Token Balance
            </div>
            {balance >= 0.7 ? (
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
            <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 500 }}>Tokens</span>
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", display: "flex", alignItems: "center", gap: 5 }}>
            <Zap size={13} color="var(--gold)" />
            <span>Consumes <strong>0.7 tokens</strong> per AI feature usage</span>
          </div>
        </Card>

        <Card style={{ background: "var(--panel)", border: "1px solid var(--border)" }}>
          <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 600, marginBottom: 10 }}>
            Estimated AI Scans Remaining
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 30, fontWeight: 700, color: scansRemaining > 0 ? "var(--gold)" : "#B03A2E" }}>
              {scansRemaining}
            </span>
            <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 500 }}>Scans Available</span>
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>
            Receipt OCR, price list reader, inspiration photo analyzer, & bank statements.
          </div>
        </Card>
      </div>

      {/* 2. Make Payment / Purchase Tokens Section */}
      <Card style={{ background: "var(--panel)", border: "1px solid var(--border)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
          <div>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, fontWeight: 600 }}>
              Make Payment for AI Tokens
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
              Choose a token bundle and complete payment to top up your account balance.
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
                  {pack.tokens} Tokens (~{pack.scans} AI scans)
                </div>
                <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.4 }}>
                  {pack.description}
                </div>
              </div>
            )
          })}

          {/* Custom Tokens Option */}
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
              Enter any number of tokens (₦100 / token)
            </div>
            <input
              type="number"
              min="1"
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
              {isCustom ? `${activeTokens} Tokens` : selectedPack.name} — <span style={{ color: "var(--gold)" }}>₦{activePrice.toLocaleString()}</span>
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

      {/* 3. How Token is Used (Usage & Transaction History) */}
      <Card style={{ background: "var(--panel)", border: "1px solid var(--border)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
          <div>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, fontWeight: 600 }}>
              Token Usage & Transaction History
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
              Detailed ledger of every AI scan deduction and token top-up.
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
            <div>No token transactions recorded yet.</div>
            <div style={{ fontSize: 11.5, marginTop: 4 }}>
              Every time you use the Receipt Scanner, Bank Statement reader, or purchase tokens, logs will appear here.
            </div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <TH cols={["Date & Time", "Description", "Type", "Amount", "Status"]} />
              <tbody>
                {history.map((tx, idx) => {
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
          </div>
        )}
      </Card>

      <DummyPaymentGatewayModal
        isOpen={gatewayOpen}
        onClose={() => setGatewayOpen(false)}
        amount={activePrice}
        tokens={activeTokens}
        packageName={isCustom ? `${activeTokens} Custom Tokens` : selectedPack.name}
        customerEmail={company.email || "bakery@bakewealth.com"}
        onPaymentSuccess={handleGatewaySuccess}
      />
    </div>
  )
}
