import React, { useState } from "react"
import { Modal, Btn } from "./ui.jsx"
import { Coins, AlertTriangle, ArrowRight, ShieldCheck, Zap, CreditCard } from "lucide-react"
import { DummyPaymentGatewayModal } from "./DummyPaymentGatewayModal.jsx"

const TOKEN_PACKS = [
  {
    id: "starter",
    name: "Starter Pack",
    tokens: 10,
    scans: 14,
    price: "₦1,000",
    description: "Ideal for light usage & occasional receipt scanning.",
    popular: false
  },
  {
    id: "pro",
    name: "Baker Pro Pack",
    tokens: 50,
    scans: 71,
    price: "₦4,500",
    description: "Best value for busy bakeries with regular orders & expenses.",
    popular: true
  },
  {
    id: "commercial",
    name: "Commercial Bakery Pack",
    tokens: 100,
    scans: 142,
    price: "₦8,000",
    description: "Maximum savings for high-volume bakeries & teams.",
    popular: false
  }
]

export function TokenPurchaseModal({
  isOpen,
  onClose,
  currentBalance = 0,
  isInsufficient = false,
  requiredTokens = 0.7,
  company = {},
  onOpenSettings
}) {
  const [selectedPack, setSelectedPack] = useState("pro")
  const [gatewayOpen, setGatewayOpen] = useState(false)

  if (!isOpen) return null

  const chosenPack = TOKEN_PACKS.find(p => p.id === selectedPack) || TOKEN_PACKS[1]

  const handleWhatsAppBuy = () => {
    const adminPhone = company.phone || "2348000000000"
    const cleanPhone = adminPhone.replace(/[^0-9]/g, "").replace(/^0/, "234")
    const text = encodeURIComponent(
      `Hello! I would like to purchase the ${chosenPack.name} (${chosenPack.tokens} AI Tokens for ${chosenPack.price}) for my bakery account: "${company.name || "My Bakery"}". Current balance: ${Number(currentBalance).toFixed(1)} tokens.`
    )
    window.open(`https://wa.me/${cleanPhone}?text=${text}`, "_blank")
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title=""
      maxWidth={520}
    >
      <div style={{ padding: "4px 2px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: "50%",
              background: "rgba(200,145,42,0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--gold)"
            }}
          >
            <Coins size={22} />
          </div>
          <div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, color: "var(--text)" }}>
              AI Feature Tokens
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>
              Smart receipt scanning, price list readers, and recipe AI
            </div>
          </div>
        </div>

        {/* Insufficient Tokens Warning Banner */}
        {isInsufficient ? (
          <div
            style={{
              background: "#FFF4E5",
              border: "1px solid #FFE0B2",
              borderRadius: 8,
              padding: "10px 12px",
              marginBottom: 14,
              display: "flex",
              alignItems: "flex-start",
              gap: 10
            }}
          >
            <AlertTriangle size={18} color="#D97706" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 12, color: "#92400E", lineHeight: 1.4 }}>
              <strong>Insufficient Token Balance:</strong> You need at least <strong>{requiredTokens} tokens</strong> to use this AI feature. Your current balance is <strong>{Number(currentBalance).toFixed(1)} tokens</strong>. Please top up to continue.
            </div>
          </div>
        ) : (
          <div
            style={{
              background: "rgba(200,145,42,0.06)",
              border: "1px solid rgba(200,145,42,0.18)",
              borderRadius: 8,
              padding: "10px 14px",
              marginBottom: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between"
            }}
          >
            <div style={{ fontSize: 12, color: "var(--text)" }}>
              Current Token Balance:
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--gold)", display: "flex", alignItems: "center", gap: 5 }}>
              <Coins size={16} />
              <span>{Number(currentBalance).toFixed(1)} Tokens</span>
            </div>
          </div>
        )}

        {/* Rate Notice */}
        <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
          <Zap size={13} color="var(--gold)" />
          <span>Every AI feature usage consumes exactly <strong>0.7 tokens</strong>.</span>
        </div>

        {/* Token Packages */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
          {TOKEN_PACKS.map(pack => {
            const isSelected = selectedPack === pack.id
            return (
              <div
                key={pack.id}
                onClick={() => setSelectedPack(pack.id)}
                style={{
                  border: isSelected ? "2px solid var(--gold)" : "1px solid var(--border)",
                  borderRadius: 10,
                  padding: "10px 14px",
                  background: isSelected ? "rgba(200,145,42,0.08)" : "var(--panel)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  transition: "all 0.15s ease",
                  position: "relative"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      border: isSelected ? "5px solid var(--gold)" : "2px solid var(--border)",
                      background: "#fff"
                    }}
                  />
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontWeight: 700, fontSize: 13, color: "var(--text)" }}>{pack.name}</span>
                      {pack.popular && (
                        <span
                          style={{
                            background: "var(--gold)",
                            color: "#fff",
                            fontSize: 9.5,
                            fontWeight: 700,
                            padding: "1px 6px",
                            borderRadius: 10,
                            textTransform: "uppercase"
                          }}
                        >
                          Best Value
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                      {pack.tokens} Tokens (~{pack.scans} AI scans) • {pack.description}
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: "right", minWidth: 70 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--gold)" }}>
                    {pack.price}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Purchase Action Buttons */}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", alignItems: "center" }}>
          {onOpenSettings && (
            <button
              type="button"
              onClick={() => {
                onClose()
                onOpenSettings()
              }}
              style={{
                marginRight: "auto",
                background: "none",
                border: "none",
                color: "var(--gold)",
                fontSize: 12,
                cursor: "pointer",
                padding: "4px 0",
                textDecoration: "underline"
              }}
            >
              View usage history & payment options →
            </button>
          )}
          <Btn variant="ghost" onClick={onClose}>
            Cancel
          </Btn>
          <Btn
            variant="outline"
            onClick={handleWhatsAppBuy}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              fontSize: 12
            }}
          >
            <span>WhatsApp</span>
          </Btn>
          <Btn
            onClick={() => setGatewayOpen(true)}
            style={{
              background: "var(--gold)",
              color: "#fff",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontWeight: 600
            }}
          >
            <CreditCard size={14} />
            <span>Pay {chosenPack.price}</span>
            <ArrowRight size={14} />
          </Btn>
        </div>

        {/* Security & Support note */}
        <div style={{ fontSize: 10.5, color: "var(--muted)", textAlign: "center", marginTop: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
          <ShieldCheck size={12} color="#27AE60" />
          <span>Instant token top-up via Paystack test simulator. Tokens never expire.</span>
        </div>
      </div>

      <DummyPaymentGatewayModal
        isOpen={gatewayOpen}
        onClose={() => setGatewayOpen(false)}
        amount={parseInt(chosenPack.price.replace(/[^0-9]/g, ""), 10) || 1000}
        tokens={chosenPack.tokens}
        packageName={chosenPack.name}
        customerEmail={company.email || "bakery@bakewealth.com"}
        onPaymentSuccess={() => {
          setTimeout(() => {
            onClose()
          }, 1500)
        }}
      />
    </Modal>
  )
}
