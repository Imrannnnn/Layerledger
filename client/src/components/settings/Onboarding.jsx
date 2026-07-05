/**
 * Onboarding.jsx
 * ----------------------------------------------------------------------------
 * Step-by-step wizard shown to new users on their very first login.
 * Handles Business Details, Bank Details, first Ingredient, Profit Margin slider,
 * and Done summary.
 * ----------------------------------------------------------------------------
 */
import React, { useState, useRef } from "react"
import { Btn, iSt, Inp, Sel, Card, Badge } from "../common/ui.jsx"
import { saveCompany, saveSetting, saveInventory } from "../../lib/data.js"
import { uid } from "../../lib/helpers.js"

export function Onboarding({ gold, company, setCompany, inventory, setInventory, settings, setSettings, onComplete, onSkip, setView }) {
  const [step, setStep] = useState(1)
  const logoRef = useRef()

  // Step 3: First Ingredient State
  const [ingName, setIngName] = useState("")
  const [ingCat, setIngCat] = useState("Dry Goods")
  const [ingUnit, setIngUnit] = useState("kg")
  const [ingCost, setIngCost] = useState("")
  const [ingStock, setIngStock] = useState("")
  const [ingMinStock, setIngMinStock] = useState("")
  const [ingErr, setIngErr] = useState("")

  // Step 4: Margin State
  const [profitPct, setProfitPct] = useState(settings.profitPct || 40)

  const co = (field, val) => {
    const u = { ...company, [field]: val }
    setCompany(u)
    saveCompany(u)
  }

  const st = (field, val) => {
    const u = { ...settings, [field]: val }
    setSettings(u)
    saveSetting(field, val)
  }

  const handleLogo = e => {
    const f = e.target.files[0]
    if (!f) return
    const r = new FileReader()
    r.onload = ev => co("logo", ev.target.result)
    r.readAsDataURL(f)
  }

  const handleAddIngredient = () => {
    setIngErr("")
    if (!ingName.trim()) {
      return setIngErr("Please enter the ingredient name")
    }
    const costNum = parseFloat(ingCost)
    if (isNaN(costNum) || costNum <= 0) {
      return setIngErr("Please enter a valid cost greater than ₦0")
    }

    const newIng = {
      id: uid(),
      name: ingName.trim(),
      cat: ingCat,
      unit: ingUnit,
      cost: costNum,
      stock: parseFloat(ingStock) || 0,
      minStock: parseFloat(ingMinStock) || 0
    }

    const updated = [...inventory, newIng]
    setInventory(updated)
    saveInventory(updated)
    setStep(4)
  }

  const getMarginLabel = (val) => {
    if (val <= 25) return "Low profit margin (For bulk wholesale or basic budget cakes)"
    if (val <= 45) return "Healthy profit margin (Recommended standard for bakeries)"
    if (val <= 65) return "High profit margin (For highly custom premium cake designs)"
    return "Very high profit margin (Luxury/High-end custom cake studio)"
  }

  const pct = Math.round(((step - 1) / 4) * 100)

  // Quick categories and units
  const CATEGORIES = ["Dry Goods", "Fats & Oils", "Dairy", "Chocolate", "Colorings", "Fruits", "Decoration", "Packaging", "Flavoring", "Other"]
  const UNITS = ["kg", "g", "L", "ml", "pcs", "bottle", "pack", "roll"]

  return (
    <div style={{ minHeight: "100vh", background: "#F4EEE4", display: "flex", alignItems: "center", justifyItems: "center", justifyContent: "center", padding: 24, fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&display=swap');
        * { box-sizing: border-box }
        :root {
          --gold: ${gold};
          --bg: #F4EEE4;
          --panel: #FDFAF4;
          --text: #291608;
          --muted: #8C6E52;
          --border: #E0D3BB;
        }
      `}</style>

      <div style={{ width: "100%", maxWidth: 520, background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 16, padding: "30px 28px", boxShadow: "0 8px 30px rgba(41,22,8,0.06)" }}>
        
        {/* Progress bar */}
        {step < 5 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--muted)", fontWeight: 500, marginBottom: 6 }}>
              <span>Setup progress: Step {step} of 4</span>
              <span>{pct}%</span>
            </div>
            <div style={{ height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: gold, borderRadius: 3, transition: "width 0.4s ease" }} />
            </div>
          </div>
        )}

        {/* STEP 1: BUSINESS DETAILS */}
        {step === 1 && (
          <div>
            <div style={{ textAlign: "center", marginBottom: 22 }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>Step 1 — Business Details</div>
              <div style={{ fontSize: 13, color: "var(--muted)" }}>Let's set up your bakery's brand identity.</div>
            </div>

            <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 20 }}>
              <div onClick={() => logoRef.current?.click()} style={{ width: 80, height: 80, borderRadius: 10, border: "2px dashed var(--border)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", background: "#FAF7F0", flexShrink: 0, overflow: "hidden", transition: "border-color 0.2s" }} onMouseEnter={e => e.currentTarget.style.borderColor = gold} onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}>
                {company.logo ? (
                  <img src={company.logo} alt="logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <div style={{ textAlign: "center", fontSize: 10.5, color: "var(--muted)", fontWeight: 500 }}>Upload<br />Logo</div>
                )}
              </div>
              <input ref={logoRef} type="file" accept="image/*" onChange={handleLogo} style={{ display: "none" }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>Bakery Logo</div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>Upload a JPG or PNG. This logo will appear on all customer invoices and quotes.</div>
              </div>
            </div>

            <Inp label="Business Name *" value={company.name} onChange={v => co("name", v)} placeholder="e.g. Fayvouree Luxe Cakes Studio" />
            <Inp label="Address" value={company.address} onChange={v => co("address", v)} placeholder="e.g. Abuja, Nigeria" />
            <Inp label="Phone Number" value={company.phone} onChange={v => co("phone", v)} placeholder="e.g. +234 80 1234 5678" />
            <Inp label="Email Address" value={company.email} onChange={v => co("email", v)} placeholder="e.g. contact@fayvoureecakes.com" />

            <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end" }}>
              <Btn disabled={!company.name?.trim()} onClick={() => setStep(2)}>Next: Bank Details →</Btn>
            </div>
          </div>
        )}

        {/* STEP 2: BANK DETAILS */}
        {step === 2 && (
          <div>
            <div style={{ textAlign: "center", marginBottom: 22 }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>Step 2 — Bank Details</div>
              <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>Enter your payment account details. These are appended automatically to client invoices for direct bank transfers.</div>
            </div>

            <Inp label="Bank Name" value={company.bankName} onChange={v => co("bankName", v)} placeholder="e.g. GTBank, Access Bank" />
            <Inp label="Account Number" value={company.bankAccount} onChange={v => co("bankAccount", v)} placeholder="e.g. 0123456789" type="number" />
            <Inp label="Account Name" value={company.bankAccountName} onChange={v => co("bankAccountName", v)} placeholder="e.g. Fayvouree Luxe Cakes" />

            <div style={{ marginTop: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Btn variant="ghost" onClick={() => setStep(1)}>← Back</Btn>
              <Btn onClick={() => setStep(3)}>Next: Add First Ingredient →</Btn>
            </div>
          </div>
        )}

        {/* STEP 3: ADD FIRST INGREDIENT */}
        {step === 3 && (
          <div>
            <div style={{ textAlign: "center", marginBottom: 22 }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>Step 3 — Add First Ingredient</div>
              <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>Add one item to your inventory to see how LayerLedger handles cost calculations. Try adding Flour or Butter.</div>
            </div>

            {ingErr && (
              <div style={{ background: "#FDEBE9", border: "1px solid #F0A89E", borderRadius: 8, padding: "8px 12px", color: "#B03A2E", fontSize: 12.5, marginBottom: 12, fontWeight: 500 }}>
                ⚠ {ingErr}
              </div>
            )}

            <Inp label="Ingredient Name *" value={ingName} onChange={setIngName} placeholder="e.g. Flour, Butter, Icing Sugar" />
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Sel label="Category" value={ingCat} onChange={setIngCat} options={CATEGORIES} />
              <Sel label="Unit" value={ingUnit} onChange={setIngUnit} options={UNITS} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: 10 }}>
              <Inp label="Cost (₦ per unit) *" value={ingCost} onChange={setIngCost} placeholder="e.g. 1500" type="number" />
              <Inp label="Initial stock" value={ingStock} onChange={setIngStock} placeholder="0" type="number" />
              <Inp label="Min level (alert)" value={ingMinStock} onChange={setIngMinStock} placeholder="0" type="number" />
            </div>

            <div style={{ marginTop: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Btn variant="ghost" onClick={() => setStep(2)}>← Back</Btn>
              <Btn onClick={handleAddIngredient}>Add & Continue →</Btn>
            </div>
          </div>
        )}

        {/* STEP 4: SET PROFIT MARGIN */}
        {step === 4 && (
          <div>
            <div style={{ textAlign: "center", marginBottom: 22 }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>Step 4 — Set Profit Margin</div>
              <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>Choose your default net profit margin. The calculator will automatically suggest prices to protect this margin. You can change this anytime.</div>
            </div>

            <div style={{ background: "#FAF7F0", padding: "16px 20px", borderRadius: 12, border: "1px solid var(--border)", marginBottom: 20, textAlign: "center" }}>
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "var(--muted)", marginBottom: 6 }}>Target Margin</div>
              <div style={{ fontSize: 36, fontWeight: 700, color: gold }}>{profitPct}%</div>
              <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--text)", marginTop: 4 }}>{getMarginLabel(profitPct)}</div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <input type="range" min={10} max={80} step={5} value={profitPct} onChange={e => { setProfitPct(+e.target.value); st("profitPct", +e.target.value) }} style={{ width: "100%", accentColor: gold, cursor: "pointer", height: 6 }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--muted)", marginTop: 6 }}>
                <span>10% (Low Profit)</span>
                <span>80% (High Profit)</span>
              </div>
            </div>

            <div style={{ marginTop: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Btn variant="ghost" onClick={() => setStep(3)}>← Back</Btn>
              <Btn onClick={() => setStep(5)}>Save & Finish →</Btn>
            </div>
          </div>
        )}

        {/* STEP 5: DONE */}
        {step === 5 && (
          <div style={{ textAlign: "center" }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#E5F4EC", border: "2px solid #357A52", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <span style={{ fontSize: 28, color: "#2D7A50" }}>✓</span>
            </div>

            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 600, color: "var(--text)", marginBottom: 8 }}>You're all set!</div>
            <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.7, marginBottom: 24 }}>
              Your profile, bank details, first ingredient, and margins are set up. Here is what you should do next:
            </div>

            <div style={{ textAlign: "left", background: "#FAF7F0", padding: 18, borderRadius: 12, border: "1px solid var(--border)", marginBottom: 24 }}>
              <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                <span style={{ fontSize: 16 }}>📖</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>Add base recipes</div>
                  <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>Head to **Master List** → **Base Recipes** to enter standard recipes per layer.</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                <span style={{ fontSize: 16 }}>🧮</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>Calculate a custom quote</div>
                  <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>Use the **Order Calculator** to build pricing quotes for multi-tiered cakes.</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <span style={{ fontSize: 16 }}>🧾</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>Scan purchase receipts</div>
                  <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>Upload receipt photos to automatically restock ingredients and update costs.</div>
                </div>
              </div>
            </div>

            <Btn full onClick={onComplete}>Go to Dashboard</Btn>
          </div>
        )}

        {/* Skip option */}
        {step < 5 && (
          <div style={{ textAlign: "center", marginTop: 18, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
            <span onClick={onSkip} style={{ fontSize: 12.5, color: "var(--muted)", cursor: "pointer", textDecoration: "underline" }} onMouseEnter={e => e.currentTarget.style.color = gold} onMouseLeave={e => e.currentTarget.style.color = "var(--muted)"}>
              Skip setup wizard (I'll do it later)
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
