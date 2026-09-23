/**
 * Login.jsx
 * ----------------------------------------------------------------------------
 * Login / Register screen with activation email confirmation and resend support.
 * Authenticates users against the backend database and supports tenant creation.
 * ----------------------------------------------------------------------------
 */
import React, { useState } from "react"
import { Mail, CheckCircle2, ArrowRight } from "lucide-react"
import { Btn, Inp, Card, Alert } from "../common/ui.jsx"

export function Login({ onLogin, initialError = "" }) {
  const [tab, setTab] = useState("login") // "login" | "register" | "activation_sent"
  const [tenantType, setTenantType] = useState("individual") // "individual" | "organization"
  
  // Fields
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [companyName, setCompanyName] = useState("")
  
  const [err, setErr] = useState(initialError || "")
  const [loading, setLoading] = useState(false)
  const [registeredEmail, setRegisteredEmail] = useState("")
  const [pendingActivationEmail, setPendingActivationEmail] = useState("")
  const [resendLoading, setResendLoading] = useState(false)
  const [resendSuccess, setResendSuccess] = useState("")

  React.useEffect(() => {
    if (initialError) setErr(initialError);
  }, [initialError]);

  const handleResendActivation = async (targetEmail) => {
    const apiUrl = import.meta.env.VITE_API_URL;
    if (!apiUrl) return setErr("Configuration error: VITE_API_URL is not set");
    const emailToSend = (targetEmail || email || registeredEmail || "").trim().toLowerCase();
    if (!emailToSend) return setErr("Please enter your email to resend activation link");

    setResendLoading(true);
    setResendSuccess("");
    try {
      const res = await fetch(`${apiUrl}/api/auth/resend-activation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailToSend })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to resend activation email");
      setResendSuccess("A fresh activation link has been sent to your email!");
    } catch (e) {
      setErr(e.message);
    } finally {
      setResendLoading(false);
    }
  };

  const attempt = async () => {
    const apiUrl = import.meta.env.VITE_API_URL;
    if (!apiUrl) {
      return setErr("Configuration error: VITE_API_URL is not set");
    }
    const normalizedEmail = (email || "").trim().toLowerCase();

    if (tab === "login") {
      if (!normalizedEmail || !password) return setErr("Please enter email and password")
      setLoading(true)
      setErr("")
      setResendSuccess("")
      try {
        const res = await fetch(`${apiUrl}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: normalizedEmail, password })
        })
        const data = await res.json()
        if (!res.ok) {
          if (data.notActivated) {
            setPendingActivationEmail(normalizedEmail);
          }
          throw new Error(data.message || "Invalid email or password")
        }
        setPendingActivationEmail("");
        onLogin({ ...data, isNewRegistration: false })
      } catch (e) {
        setErr(e.message)
      } finally {
        setLoading(false)
      }
    } else if (tab === "register") {
      if (!name || !normalizedEmail || !password) return setErr("Please fill in all required fields")
      if (tenantType === "organization" && !companyName) {
        return setErr("Please enter your organization name")
      }
      setLoading(true)
      setErr("")
      setResendSuccess("")
      try {
        const res = await fetch(`${apiUrl}/api/auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            email: normalizedEmail,
            password,
            companyName: tenantType === "organization" ? companyName : undefined,
            tenantType
          })
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.message || "Registration failed")

        // Switch to activation email notice state
        setRegisteredEmail(normalizedEmail)
        setTab("activation_sent")
      } catch (e) {
        setErr(e.message)
      } finally {
        setLoading(false)
      }
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "var(--bg)", padding: 16 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=DM+Sans:opsz,wght@9..40,400;9..40,500&display=swap');
        * { box-sizing: border-box }
        body { margin: 0; font-family: 'DM Sans', sans-serif; }
        :root {
          --gold: #c8912a;
          --sidebar: #0a0a0a;
          --bg: #F4EEE4;
          --panel: #FDFAF4;
          --text: #291608;
          --muted: #8C6E52;
          --border: #E0D3BB;
        }
      `}</style>
      
      <Card style={{ width: "100%", maxWidth: 410, padding: 32, textAlign: "left" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 32, color: "var(--gold)", fontWeight: 700, marginBottom: 4 }}>BakeWealth</div>
          <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 2.5 }}>Bakery Bookkeeping</div>
        </div>

        {tab === "activation_sent" ? (
          <div style={{ textAlign: "center", animation: "fadeIn 0.2s ease-in" }}>
            <div style={{
              width: 56,
              height: 56,
              background: "rgba(200,145,42,0.12)",
              color: "var(--gold)",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px auto"
            }}>
              <Mail size={28} />
            </div>

            <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: "var(--text)", margin: "0 0 8px 0", fontWeight: 700 }}>
              Check Your Email
            </h3>

            <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6, margin: "0 0 16px 0" }}>
              We've sent an activation link to:
            </p>

            <div style={{
              background: "#FAF4EB",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "10px 14px",
              fontSize: 13.5,
              fontWeight: 600,
              color: "var(--text)",
              marginBottom: 16,
              wordBreak: "break-all"
            }}>
              {registeredEmail}
            </div>

            <p style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.6, margin: "0 0 20px 0" }}>
              Click the link in the email to activate your account and start your interactive onboarding session. Your starter allowance of <strong>10 Free AI Scans (20 credits)</strong> will be ready.
            </p>

            {resendSuccess && (
              <div style={{ marginBottom: 14 }}>
                <Alert msg={resendSuccess} color="green" onClose={() => setResendSuccess("")} />
              </div>
            )}
            {err && (
              <div style={{ marginBottom: 14 }}>
                <Alert msg={err} color="red" onClose={() => setErr("")} />
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Btn 
                full 
                variant="outline"
                loading={resendLoading}
                loadingText="Resending..."
                onClick={() => handleResendActivation(registeredEmail)}
              >
                Resend Activation Email
              </Btn>

              <button
                type="button"
                onClick={() => { setTab("login"); setErr(""); setResendSuccess(""); }}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--muted)",
                  fontSize: 12.5,
                  cursor: "pointer",
                  padding: 8,
                  textDecoration: "underline"
                }}
              >
                ← Return to Sign In
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Custom Tabs */}
            <div style={{ display: "flex", gap: 4, marginBottom: 24, background: "var(--border)", borderRadius: 10, padding: 3 }}>
              <button 
                onClick={() => { setTab("login"); setErr(""); setPendingActivationEmail(""); }} 
                style={{
                  flex: 1, padding: "8px 12px", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: "pointer",
                  background: tab === "login" ? "var(--panel)" : "transparent",
                  color: tab === "login" ? "var(--gold)" : "var(--muted)",
                  transition: "all 0.15s"
                }}
              >
                Sign In
              </button>
              <button 
                onClick={() => { setTab("register"); setErr(""); setPendingActivationEmail(""); }} 
                style={{
                  flex: 1, padding: "8px 12px", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: "pointer",
                  background: tab === "register" ? "var(--panel)" : "transparent",
                  color: tab === "register" ? "var(--gold)" : "var(--muted)",
                  transition: "all 0.15s"
                }}
              >
                Create Account
              </button>
            </div>

            {err && (
              <div style={{ marginBottom: 16 }}>
                <Alert msg={err} color="red" onClose={() => setErr("")} />
                {pendingActivationEmail && (
                  <div style={{ marginTop: 8, textAlign: "center" }}>
                    <button
                      type="button"
                      disabled={resendLoading}
                      onClick={() => handleResendActivation(pendingActivationEmail)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--gold)",
                        fontSize: 12.5,
                        fontWeight: 600,
                        cursor: "pointer",
                        textDecoration: "underline"
                      }}
                    >
                      {resendLoading ? "Sending new link..." : "Resend Activation Email"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {resendSuccess && (
              <div style={{ marginBottom: 16 }}>
                <Alert msg={resendSuccess} color="green" onClose={() => setResendSuccess("")} />
              </div>
            )}

            <form onSubmit={(e) => { e.preventDefault(); attempt(); }}>
              {tab === "register" && (
                <>
                  <Inp label="Full Name" value={name} onChange={setName} placeholder="Enter your full name" />
                  
                  {/* Account Type Toggle */}
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 10.5, color: "var(--muted)", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 500 }}>
                      Account Type
                    </label>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button 
                        type="button"
                        onClick={() => setTenantType("individual")} 
                        style={{
                          flex: 1, padding: 8, borderRadius: 8, border: `1px solid ${tenantType === 'individual' ? 'var(--gold)' : 'var(--border)'}`,
                          background: tenantType === 'individual' ? 'rgba(200,145,42,0.08)' : 'var(--panel)',
                          color: tenantType === 'individual' ? 'var(--gold)' : 'var(--muted)',
                          cursor: "pointer", fontSize: 12.5, fontWeight: 500, transition: "all 0.15s"
                        }}
                      >
                        Individual
                      </button>
                      <button 
                        type="button"
                        onClick={() => setTenantType("organization")} 
                        style={{
                          flex: 1, padding: 8, borderRadius: 8, border: `1px solid ${tenantType === 'organization' ? 'var(--gold)' : 'var(--border)'}`,
                          background: tenantType === 'organization' ? 'rgba(200,145,42,0.08)' : 'var(--panel)',
                          color: tenantType === 'organization' ? 'var(--gold)' : 'var(--muted)',
                          cursor: "pointer", fontSize: 12.5, fontWeight: 500, transition: "all 0.15s"
                        }}
                      >
                        Organization
                      </button>
                    </div>
                  </div>

                  {tenantType === "organization" && (
                    <Inp label="Organization / Bakery Name" value={companyName} onChange={setCompanyName} placeholder="e.g. Sweet Treats Bakery" />
                  )}

                </>
              )}

              <Inp 
                label="Email Address / Username" 
                value={email} 
                onChange={setEmail} 
                onBlur={() => setEmail(prev => (prev || "").trim().toLowerCase())}
                type="email" 
                placeholder="e.g. name@example.com" 
              />
              <Inp label="Password" value={password} onChange={setPassword} type="password" placeholder="••••••••" />

              <div style={{ marginTop: 8 }}>
                <Btn full type="submit" loading={loading} loadingText={tab === "login" ? "Signing in..." : "Creating account..."}>
                  {tab === "login" ? "Sign In →" : "Create Account & Send Activation →"}
                </Btn>
              </div>
            </form>
          </>
        )}
      </Card>
    </div>
  )
}
