/**
 * Login.jsx
 * ----------------------------------------------------------------------------
 * Login / Register screen.
 * Authenticates users against the backend database and supports tenant creation.
 * ----------------------------------------------------------------------------
 */
import React, { useState } from "react"
import { Btn, Inp, Card, Alert } from "../common/ui.jsx"

export function Login({ onLogin }) {
  const [tab, setTab] = useState("login") // "login" | "register"
  const [tenantType, setTenantType] = useState("individual") // "individual" | "organization"
  
  // Fields
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [companyName, setCompanyName] = useState("")
  
  const [err, setErr] = useState("")
  const [loading, setLoading] = useState(false)

  const attempt = async () => {
    const apiUrl = import.meta.env.VITE_API_URL;
    if (!apiUrl) {
      return setErr("Configuration error: VITE_API_URL is not set");
    }
    if (tab === "login") {
      if (!email || !password) return setErr("Please enter email and password")
      setLoading(true)
      setErr("")
      try {
        const res = await fetch(`${apiUrl}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password })
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.message || "Invalid email or password")
        onLogin(data)
      } catch (e) {
        setErr(e.message)
      } finally {
        setLoading(false)
      }
    } else {
      if (!name || !email || !password) return setErr("Please fill in all required fields")
      if (tenantType === "organization" && !companyName) {
        return setErr("Please enter your organization name")
      }
      setLoading(true)
      setErr("")
      try {
        const res = await fetch(`${apiUrl}/api/auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            email,
            password,
            companyName: tenantType === "organization" ? companyName : undefined,
            tenantType
          })
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.message || "Registration failed")

        // Auto-login on success
        const loginRes = await fetch(`${apiUrl}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password })
        })
        const loginData = await loginRes.json()
        if (!loginRes.ok) throw new Error("Account created, but failed to log in automatically.")
        onLogin(loginData)
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
      
      <Card style={{ width: "100%", maxWidth: 390, padding: 32, textAlign: "left" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 32, color: "var(--gold)", fontWeight: 700, marginBottom: 4 }}>LayerLedger</div>
          <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 2.5 }}>Bakery Bookkeeping</div>
        </div>

        {/* Custom Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 24, background: "var(--border)", borderRadius: 10, padding: 3 }}>
          <button 
            onClick={() => { setTab("login"); setErr(""); }} 
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
            onClick={() => { setTab("register"); setErr(""); }} 
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

        {err && <Alert msg={err} color="red" onClose={() => setErr("")} />}

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
              <Inp label="Organization / Bakery Name" value={companyName} onChange={setCompanyName} placeholder="e.g. Fayvouree Luxe Cakes" />
            )}
          </>
        )}

        <Inp label="Email Address" value={email} onChange={setEmail} type="email" placeholder="e.g. name@example.com" />
        <Inp label="Password" value={password} onChange={setPassword} type="password" placeholder="••••••••" />

        <div style={{ marginTop: 8 }}>
          <Btn full onClick={attempt} disabled={loading}>
            {loading ? "Please wait..." : tab === "login" ? "Sign In →" : "Register & Sign In →"}
          </Btn>
        </div>
      </Card>
    </div>
  )
}
