import React from "react"
import { Modal, Btn } from "./ui.jsx"
import { Sparkles, Crown, CheckCircle2, ArrowRight, ShieldCheck, X } from "lucide-react"

/**
 * PlanLimitModal
 * ----------------------------------------------------------------------------
 * Prominently and politely alerts the user when an action exceeds their
 * current prepaid plan's quotas (orders, recipes, inventory, clients, staff).
 * Provides clear 1-click upgrade navigation so the user is never left wondering
 * why an item failed to save.
 * ----------------------------------------------------------------------------
 */
export function PlanLimitModal({
  isOpen,
  onClose,
  limitData = {},
  onUpgradePlan,
  onOpenSettings
}) {
  if (!isOpen) return null

  const {
    limitType = "ordersPerMonth",
    message,
    limit,
    currentCount,
    plan = "free",
    upgradePlan = "standard",
    upgradePrice = 5000
  } = limitData

  const getLimitTitle = () => {
    switch (limitType) {
      case "ordersPerMonth":
        return "Monthly Order Limit Reached"
      case "recipes":
        return "Recipe Capacity Reached"
      case "inventoryItems":
        return "Inventory Item Limit Reached"
      case "clients":
        return "Client Directory Limit Reached"
      case "staffLogins":
        return "Staff Logins Limit Reached"
      default:
        return "Subscription Plan Limit Reached"
    }
  }

  const getLimitExplanation = () => {
    if (message) return message
    switch (limitType) {
      case "ordersPerMonth":
        return `You have reached your Free plan quota of ${limit || 8} orders and quotes this month. Generating and saving new quotes or production orders requires upgrading to Standard or Premium.`
      case "recipes":
        return `You have reached the maximum of ${limit || 10} recipes allowed on your current plan. Upgrade to add more recipes.`
      case "inventoryItems":
        return `You have reached the maximum of ${limit || 50} inventory items on your current plan. Upgrade to add more items.`
      case "clients":
        return `You have reached the client directory limit (${limit || 20} clients) for your current plan. Upgrade to add more clients.`
      case "staffLogins":
        return `Your current plan has reached its allowed staff member logins (${limit || 0}). Upgrade to add staff accounts.`
      default:
        return "You have reached the capacity limit for this feature on your current subscription plan."
    }
  }

  const handleUpgradeClick = () => {
    if (onUpgradePlan) {
      onUpgradePlan(upgradePlan)
    } else if (onOpenSettings) {
      onOpenSettings()
    }
    onClose()
  }

  const handleSettingsClick = () => {
    if (onOpenSettings) {
      onOpenSettings()
    }
    onClose()
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(30, 20, 10, 0.65)",
        backdropFilter: "blur(4px)",
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16
      }}
    >
      <div
        style={{
          background: "var(--panel, #FDFAF4)",
          borderRadius: 16,
          padding: "28px 24px",
          maxWidth: 520,
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 20px 40px rgba(0, 0, 0, 0.2)",
          border: "1px solid var(--border, #E0D3BB)",
          position: "relative"
        }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 18,
            right: 18,
            background: "transparent",
            border: "none",
            color: "var(--muted, #8C6E52)",
            cursor: "pointer",
            padding: 4,
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
          aria-label="Close modal"
        >
          <X size={20} />
        </button>

        {/* Top Header Badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              background: "rgba(200, 145, 42, 0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0
            }}
          >
            <Crown size={24} color="var(--gold, #C8912A)" />
          </div>
          <div>
            <div
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: 19,
                fontWeight: 700,
                color: "var(--text, #291608)",
                lineHeight: 1.2
              }}
            >
              {getLimitTitle()}
            </div>
            <div style={{ fontSize: 12, color: "var(--muted, #8C6E52)", marginTop: 3 }}>
              Current Plan: <strong style={{ textTransform: "capitalize", color: "var(--gold, #C8912A)" }}>{plan}</strong>
            </div>
          </div>
        </div>

        {/* Notification Description */}
        <div
          style={{
            background: "#FFF9EE",
            border: "1px solid rgba(200, 145, 42, 0.3)",
            borderRadius: 10,
            padding: "12px 14px",
            fontSize: 13,
            color: "#63471D",
            lineHeight: 1.5,
            marginBottom: 20
          }}
        >
          {getLimitExplanation()}
        </div>

        {/* Upgrade Solution Card */}
        <div
          style={{
            background: "#FAF6EE",
            borderRadius: 12,
            border: "1px solid var(--border, #E0D3BB)",
            padding: 16,
            marginBottom: 20
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text, #291608)" }}>
              Recommended: Standard Plan
            </div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "var(--gold, #C8912A)" }}>
              ₦5,000 <span style={{ fontSize: 11, fontWeight: 500, color: "var(--muted, #8C6E52)" }}>/ month</span>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 7, fontSize: 12.5, color: "#4A3319" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <CheckCircle2 size={15} color="#27AE60" />
              <span><strong>Unlimited Orders & Invoices</strong> (No monthly order cap)</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <CheckCircle2 size={15} color="#27AE60" />
              <span><strong>60 Recipes</strong> & <strong>250 Inventory Items</strong></span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <CheckCircle2 size={15} color="#27AE60" />
              <span><strong>150 Client Profiles</strong> with order history</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <CheckCircle2 size={15} color="#27AE60" />
              <span><strong>40 AI Scan Credits</strong> every month</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <CheckCircle2 size={15} color="#27AE60" />
              <span><strong>2 Staff Member Logins</strong></span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Btn
            onClick={handleUpgradeClick}
            variant="primary"
            style={{
              padding: "12px 18px",
              fontSize: 14,
              fontWeight: 600,
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              borderRadius: 10
            }}
          >
            <Sparkles size={16} />
            <span>Upgrade to Standard (₦5,000/mo)</span>
            <ArrowRight size={16} />
          </Btn>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={handleSettingsClick}
              style={{
                flex: 1,
                background: "transparent",
                border: "1px solid var(--border, #E0D3BB)",
                color: "var(--text, #291608)",
                borderRadius: 8,
                padding: "9px 12px",
                fontSize: 12.5,
                fontWeight: 500,
                cursor: "pointer"
              }}
            >
              View All Plans & Billing
            </button>
            <button
              onClick={onClose}
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                color: "var(--muted, #8C6E52)",
                borderRadius: 8,
                padding: "9px 12px",
                fontSize: 12.5,
                cursor: "pointer"
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
