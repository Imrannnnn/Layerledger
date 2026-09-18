import React, { useState } from "react"
import { Modal, Btn } from "./ui.jsx"
import { CreditCard, Building2, Smartphone, CheckCircle, Lock, Loader2, ExternalLink, ShieldCheck, AlertCircle, RefreshCw } from "lucide-react"
import { purchaseTokens, initializeGatewayPayment, verifyGatewayPayment } from "../../lib/data.js"

export function DummyPaymentGatewayModal({
  isOpen,
  onClose,
  amount = 1000,
  tokens = 10,
  packageName = "Starter Pack",
  customerEmail = "bakery@bakewealth.com",
  resourceType,
  resourceId,
  options,
  successTitle = "Payment Successful!",
  successSubtitle,
  onConfirmPay,
  onPaymentSuccess
}) {
  const paystackPublicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || ""
  const [channel, setChannel] = useState("paystack")
  const [cardNumber, setCardNumber] = useState("4084 •••• •••• 4081")
  const [cardExpiry, setCardExpiry] = useState("09/28")
  const [cardCvv, setCardCvv] = useState("321")
  const [processing, setProcessing] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [reference, setReference] = useState("")
  const [hostedUrl, setHostedUrl] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [verifying, setVerifying] = useState(false)

  if (!isOpen) return null

  const handleManualVerify = async (refToVerify) => {
    const targetRef = refToVerify || reference
    if (!targetRef) return
    setVerifying(true)
    setErrorMessage("")
    try {
      const res = await verifyGatewayPayment(targetRef)
      setVerifying(false)
      if (res && (res.status === "SUCCESS" || res.success)) {
        setIsSuccess(true)
        if (onPaymentSuccess) onPaymentSuccess(res)
        setTimeout(() => {
          setIsSuccess(false)
          onClose()
        }, 1800)
      } else {
        setErrorMessage(`Paystack reported status: "${res.status || 'PENDING'}". Please complete checkout first.`)
      }
    } catch (err) {
      setVerifying(false)
      setErrorMessage("Verification error: " + (err.message || err))
    }
  }

  const handlePay = async () => {
    setProcessing(true)
    setErrorMessage("")

    if (channel === "paystack" && import.meta.env?.VITE_API_URL) {
      try {
        let resType = resourceType
        let resId = resourceId
        let opts = options || {}

        // Auto-infer if not explicitly supplied
        if (!resType) {
          if (tokens === 20 || tokens === 50 || tokens === 120) {
            resType = "credit_pack"
            resId = tokens === 20 ? "small" : tokens === 50 ? "medium" : "large"
            opts = { packId: resId }
          } else if (
            packageName.toLowerCase().includes("standard") ||
            packageName.toLowerCase().includes("premium") ||
            packageName.toLowerCase().includes("studio")
          ) {
            resType = "subscription_plan"
            resId = packageName.toLowerCase().includes("standard") ? "standard" : "premium"
            opts = { months: 1 }
          } else {
            resType = "custom"
            opts = { amount }
          }
        }

        // 1. Authoritative Backend Initialization with Paystack API
        if (typeof initializeGatewayPayment !== "function") {
          throw new Error("Payment service is not available.")
        }

        const initRes = await initializeGatewayPayment({
          resourceType: resType,
          resourceId: resId,
          options: opts,
          callbackUrl: window.location.href
        })

        const payRef = initRes.reference
        setReference(payRef)
        if (initRes.authorizationUrl) {
          setHostedUrl(initRes.authorizationUrl)
        }

        const accessCode = initRes.accessCode

        // 2. Launch Paystack InlineJS V2 Popup if available and accessCode exists
        if (typeof window !== "undefined" && window.PaystackPop && accessCode) {
          try {
            const popup = new window.PaystackPop()
            if (typeof popup.resumeTransaction === "function") {
              popup.resumeTransaction(accessCode, {
                onSuccess: async (transaction) => {
                  setProcessing(true)
                  const confirmedRef = transaction?.reference || payRef
                  setReference(confirmedRef)
                  try {
                    const verifyRes = await verifyGatewayPayment(confirmedRef)
                    setProcessing(false)
                    setIsSuccess(true)
                    if (onPaymentSuccess) onPaymentSuccess(verifyRes)
                    setTimeout(() => {
                      setIsSuccess(false)
                      onClose()
                    }, 1800)
                  } catch (vErr) {
                    setProcessing(false)
                    setErrorMessage("Payment verification failed: " + (vErr.message || vErr))
                  }
                },
                onCancel: () => {
                  setProcessing(false)
                }
              })
              return
            }
          } catch (popupErr) {
            console.warn("Paystack InlineJS V2 popup could not be initialized:", popupErr)
          }
        }

        // 3. Fallback to Paystack Hosted Checkout URL if popup is unavailable or blocked
        if (initRes.authorizationUrl) {
          window.open(initRes.authorizationUrl, "_blank")
          setProcessing(false)
          return
        }

        // If neither popup nor hosted url is available, report the error
        setProcessing(false)
        setErrorMessage("Paystack initialization succeeded, but no checkout URL or popup access code was returned.")
        return
      } catch (err) {
        console.error("Paystack live transaction error:", err)
        setProcessing(false)
        setErrorMessage(err.message || "Failed to initialize Paystack payment. Please verify your connection or credentials.")
        return
      }
    }

    // Offline / Demo Simulator fallback
    const ref = "PAY-BW-" + Math.floor(10000000 + Math.random() * 90000000)
    setReference(ref)

    setTimeout(async () => {
      try {
        let res
        if (onConfirmPay) {
          res = await onConfirmPay(ref)
        } else {
          res = await purchaseTokens(
            tokens,
            `Credit Purchase (${channel}): ${packageName} (+${tokens} credits) [Ref: ${ref}]`
          )
        }
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
        setErrorMessage("Payment gateway transaction error: " + (err.message || err))
      }
    }, 1200)
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={processing ? undefined : onClose}
      title=""
      maxWidth={480}
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
              {successTitle}
            </div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 8 }}>
              {successSubtitle || `${tokens} Credits added to your account.`}
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "monospace" }}>
              Ref: {reference}
            </div>
          </div>
        ) : (
          <>
            {/* Error Message Banner */}
            {errorMessage && (
              <div
                style={{
                  background: "#FEF2F2",
                  border: "1px solid #FECACA",
                  borderRadius: 8,
                  padding: "10px 12px",
                  marginBottom: 14,
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 8,
                  color: "#991B1B",
                  fontSize: 12
                }}
              >
                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Payment Channel Tabs */}
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr 1fr", gap: 5, marginBottom: 16 }}>
              {[
                { id: "paystack", label: "Paystack", icon: <ShieldCheck size={14} /> },
                { id: "card", label: "Card (Demo)", icon: <CreditCard size={14} /> },
                { id: "transfer", label: "Transfer", icon: <Building2 size={14} /> },
                { id: "ussd", label: "USSD", icon: <Smartphone size={14} /> }
              ].map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setChannel(c.id)
                    setErrorMessage("")
                  }}
                  style={{
                    padding: "8px 4px",
                    borderRadius: 8,
                    border: channel === c.id ? "2px solid var(--gold)" : "1px solid var(--border)",
                    background: channel === c.id ? "rgba(200,145,42,0.08)" : "#FAF7F0",
                    color: channel === c.id ? "var(--gold)" : "var(--text)",
                    fontWeight: 600,
                    fontSize: 11.5,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 4
                  }}
                >
                  {c.icon}
                  <span>{c.label}</span>
                </button>
              ))}
            </div>

            {/* Channel Content */}
            {channel === "paystack" && (
              <div style={{ background: "#F0F9FF", border: "1px solid #BAE6FD", padding: 14, borderRadius: 8, marginBottom: 18, textAlign: "center" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0369A1", marginBottom: 6 }}>
                  Official Paystack Sandbox Integration
                </div>
                <div style={{ fontSize: 12, color: "#0C4A6E", marginBottom: 10, lineHeight: 1.4 }}>
                  Real transaction registered on your Paystack Dashboard (<strong>dashboard.paystack.com</strong>) with instant server verification.
                </div>
                {paystackPublicKey ? (
                  <div style={{ fontSize: 11, fontFamily: "monospace", color: "#0284C7", background: "rgba(2, 132, 199, 0.08)", padding: "4px 8px", borderRadius: 4, display: "inline-block", marginBottom: 8 }}>
                    Key: {paystackPublicKey.slice(0, 16)}...{paystackPublicKey.slice(-6)}
                  </div>
                ) : null}

                {hostedUrl && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px dashed #BAE6FD" }}>
                    <div style={{ fontSize: 11.5, color: "#0369A1", marginBottom: 8 }}>
                      Payment session active. Reference: <strong style={{ fontFamily: "monospace" }}>{reference}</strong>
                    </div>
                    <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                      <a
                        href={hostedUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          padding: "6px 12px",
                          borderRadius: 6,
                          background: "#0284C7",
                          color: "#fff",
                          fontSize: 11.5,
                          fontWeight: 600,
                          textDecoration: "none"
                        }}
                      >
                        <ExternalLink size={12} />
                        <span>Open Checkout Page</span>
                      </a>
                      <button
                        type="button"
                        onClick={() => handleManualVerify()}
                        disabled={verifying}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          padding: "6px 12px",
                          borderRadius: 6,
                          border: "1px solid #0284C7",
                          background: "#fff",
                          color: "#0284C7",
                          fontSize: 11.5,
                          fontWeight: 600,
                          cursor: "pointer"
                        }}
                      >
                        <RefreshCw size={12} className={verifying ? "animate-spin" : ""} />
                        <span>{verifying ? "Verifying..." : "Check Status"}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {channel === "card" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
                <div style={{ fontSize: 11, color: "var(--muted)", fontStyle: "italic", background: "rgba(0,0,0,0.03)", padding: "6px 10px", borderRadius: 6 }}>
                  Offline Demo Card Simulator — simulates payment locally without contacting Paystack API.
                </div>
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
                background: channel === "paystack" ? "#0BA4DB" : "var(--gold)",
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
                  <span>Connecting to Paystack...</span>
                </>
              ) : (
                <>
                  <Lock size={14} />
                  <span>
                    {channel === "paystack"
                      ? `Pay ₦${Number(amount).toLocaleString()} with Paystack`
                      : `Pay ₦${Number(amount).toLocaleString()} (Demo Simulator)`}
                  </span>
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
              <span>Secured by <strong>Paystack</strong>{paystackPublicKey ? ` · Key: ${paystackPublicKey.slice(0, 14)}...` : ""}</span>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
