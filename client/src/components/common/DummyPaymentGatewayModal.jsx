import React, { useState } from "react"
import { Modal, Btn } from "./ui.jsx"
import { CreditCard, Building2, Smartphone, CheckCircle, Lock, Loader2, ArrowRight, ShieldCheck } from "lucide-react"
import { purchaseTokens } from "../../lib/data.js"

export function DummyPaymentGatewayModal({
  isOpen,
  onClose,
  amount = 1000,
  tokens = 10,
  packageName = "Starter Pack",
  customerEmail = "bakery@bakewealth.com",
  onPaymentSuccess
}) {
  const [channel, setChannel] = useState("card")
  const [cardNumber, setCardNumber] = useState("4084 •••• •••• 4081")
  const [cardExpiry, setCardExpiry] = useState("09/28")
  const [cardCvv, setCardCvv] = useState("321")
  const [processing, setProcessing] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [reference, setReference] = useState("")

  if (!isOpen) return null

  const handlePay = async () => {
    setProcessing(true)
    const ref = "PAY-BW-" + Math.floor(10000000 + Math.random() * 90000000)
    setReference(ref)

    // Simulate realistic payment gateway processing delay (1.2s)
    setTimeout(async () => {
      try {
        const res = await purchaseTokens(
          tokens,
          `Credit Purchase (${channel}): ${packageName} (+${tokens} credits) [Ref: ${ref}]`
        )
        setProcessing(false)
        setIsSuccess(true)
        if (onPaymentSuccess) {
          onPaymentSuccess(res)
        }
        setTimeout(() => {
          setIsSuccess(false)
          onClose()
        }, 1800)
      } catch (err) {
        setProcessing(false)
        alert("Payment gateway transaction error: " + err.message)
      }
    }, 1200)
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={processing ? undefined : onClose}
      title=""
      maxWidth={460}
    >
      <div style={{ padding: "0 4px" }}>
        {/* Gateway Header */}
        <div
          style={{
            borderBottom: "1px solid var(--border)",
            paddingBottom: 14,
            marginBottom: 16,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}
        >
          <div>
            <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 600 }}>
              Payment Checkout (Paystack Sandbox)
            </div>
            <div style={{ fontSize: 13, color: "var(--text)", fontWeight: 500, marginTop: 2 }}>
              {customerEmail}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.8 }}>
              Pay
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "var(--gold)" }}>
              ₦{Number(amount).toLocaleString()}
            </div>
          </div>
        </div>

        {isSuccess ? (
          <div style={{ textAlign: "center", padding: "30px 10px" }}>
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: "50%",
                background: "#E8F5EE",
                color: "#27AE60",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px"
              }}
            >
              <CheckCircle size={36} />
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>
              Payment Successful!
            </div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 8 }}>
              {tokens} Credits added to your account.
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "monospace" }}>
              Ref: {reference}
            </div>
          </div>
        ) : (
          <>
            {/* Payment Channel Tabs */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 16 }}>
              {[
                { id: "card", label: "Card", icon: <CreditCard size={14} /> },
                { id: "transfer", label: "Transfer", icon: <Building2 size={14} /> },
                { id: "ussd", label: "USSD", icon: <Smartphone size={14} /> }
              ].map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setChannel(c.id)}
                  style={{
                    padding: "8px 4px",
                    borderRadius: 8,
                    border: channel === c.id ? "2px solid var(--gold)" : "1px solid var(--border)",
                    background: channel === c.id ? "rgba(200,145,42,0.08)" : "#FAF7F0",
                    color: channel === c.id ? "var(--gold)" : "var(--text)",
                    fontWeight: 600,
                    fontSize: 12,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6
                  }}
                >
                  {c.icon}
                  <span>{c.label}</span>
                </button>
              ))}
            </div>

            {/* Channel Content */}
            {channel === "card" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
                <div>
                  <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4, fontWeight: 500 }}>
                    CARD NUMBER
                  </label>
                  <input
                    type="text"
                    value={cardNumber}
                    onChange={e => setCardNumber(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: 6,
                      border: "1px solid var(--border)",
                      fontSize: 13,
                      boxSizing: "border-box",
                      fontFamily: "monospace"
                    }}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4, fontWeight: 500 }}>
                      CARD EXPIRY
                    </label>
                    <input
                      type="text"
                      value={cardExpiry}
                      onChange={e => setCardExpiry(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "9px 12px",
                        borderRadius: 6,
                        border: "1px solid var(--border)",
                        fontSize: 13,
                        boxSizing: "border-box",
                        fontFamily: "monospace"
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4, fontWeight: 500 }}>
                      CVV
                    </label>
                    <input
                      type="password"
                      maxLength={3}
                      value={cardCvv}
                      onChange={e => setCardCvv(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "9px 12px",
                        borderRadius: 6,
                        border: "1px solid var(--border)",
                        fontSize: 13,
                        boxSizing: "border-box",
                        fontFamily: "monospace"
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {channel === "transfer" && (
              <div style={{ background: "#F5F0E4", padding: 14, borderRadius: 8, marginBottom: 18 }}>
                <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>
                  Transfer <strong>₦{Number(amount).toLocaleString()}</strong> to the dedicated test account below:
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>Bank:</span>
                  <strong style={{ fontSize: 12.5 }}>Wema Bank</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>Account Number:</span>
                  <strong style={{ fontSize: 13, color: "var(--gold)", fontFamily: "monospace" }}>0123984729</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>Account Name:</span>
                  <strong style={{ fontSize: 12.5 }}>LayerLedger / Paystack Sandbox</strong>
                </div>
              </div>
            )}

            {channel === "ussd" && (
              <div style={{ background: "#F5F0E4", padding: 14, borderRadius: 8, marginBottom: 18, textAlign: "center" }}>
                <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>
                  Dial the code below on your phone to complete payment:
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "var(--gold)", fontFamily: "monospace", marginBottom: 6 }}>
                  *737*000*4500#
                </div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>
                  Supported banks: GTBank, Zenith, Access, UBA, FirstBank
                </div>
              </div>
            )}

            {/* Pay Button */}
            <Btn
              full
              onClick={handlePay}
              disabled={processing}
              style={{
                background: "#0BA4DB",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: "12px",
                fontSize: 14,
                fontWeight: 600,
                borderRadius: 8
              }}
            >
              {processing ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Processing payment with Paystack...</span>
                </>
              ) : (
                <>
                  <Lock size={14} />
                  <span>Pay ₦{Number(amount).toLocaleString()}</span>
                </>
              )}
            </Btn>

            {/* Gateway Security Footer */}
            <div
              style={{
                marginTop: 14,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                fontSize: 11,
                color: "var(--muted)"
              }}
            >
              <ShieldCheck size={13} color="#27AE60" />
              <span>Secured by <strong>Paystack</strong> (Test Gateway Simulator)</span>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
