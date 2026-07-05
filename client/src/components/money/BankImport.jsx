/**
 * BankImport.jsx
 * ----------------------------------------------------------------------------
 * Bank statement import (PDF statement upload or text copy-paste).
 * Reconciles income to orders and overhead expenses.
 * ----------------------------------------------------------------------------
 */
import React, { useState, useRef } from "react"
import { Btn, Card, Badge, SHead, TH, TR2 } from "../common/ui.jsx"
import { fmt, uid, callClaude, today } from "../../lib/helpers.js"
import { saveTxns, saveExpenses, saveProductionsList } from "../../lib/data.js"

export function BankImport({ transactions, setTransactions, productions, setProductions, expenses, setExpenses }) {
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [parsed, setParsed] = useState([]) // Array of: { id, date, description, amount, type, category, matchedProdId }
  const [mode, setMode] = useState("paste") // paste | file
  const fileRef = useRef()

  // Clean and filter transactions (bank charges, stamp duty, VAT < 500 NGN)
  const cleanAndFilterTransactions = (txList) => {
    return txList.filter(t => {
      const amt = Number(t.amount) || 0
      const desc = (t.description || "").toLowerCase()
      
      // Programmatically filter out low-value bank fees/charges under 500 NGN
      if (amt < 500) {
        if (
          desc.includes("stamp duty") ||
          desc.includes("vat") ||
          desc.includes("bank charge") ||
          desc.includes("charge") ||
          desc.includes("commission") ||
          desc.includes("fee")
        ) {
          return false
        }
      }
      return amt >= 100 // skip extremely small micro-txns
    }).map(t => ({
      ...t,
      id: t.id || uid(),
      matchedProdId: null,
      category: t.category || "miscellaneous"
    }))
  }

  const parseFromText = async (text) => {
    setLoading(true)
    setError("")
    try {
      const raw = await callClaude([
        {
          role: "user",
          content: `Parse this Nigerian bank statement. Extract ALL transactions and return ONLY a JSON array with no other text before or after it:
[{"date":"YYYY-MM-DD","description":"narration","amount":12345,"type":"credit|debit","category":"sales|ingredients|delivery|packaging|salary|transport|advertising|equipment|rent|bank_charges|miscellaneous"}]

Rules:
- Credits = money IN (customers paying you)
- Debits = money OUT (your expenses)
- Ignore stamp duty, VAT, and commission lines under ₦500
- Convert all dates to YYYY-MM-DD format
- Amount must be a number only, no currency symbols

Statement text:
${text.slice(0, 8000)}`
        }
      ], "You extract bank transactions from Nigerian bank statements. Return ONLY a valid JSON array, nothing else.")

      const jsonMatch = raw.match(/\[[\s\S]*\]/)
      if (!jsonMatch) throw new Error("Could not find transaction data in response. Try pasting more of the statement.")
      const result = JSON.parse(jsonMatch[0])
      if (!Array.isArray(result) || result.length === 0) throw new Error("No transactions found. Make sure you copied the full statement text.")
      
      const cleaned = cleanAndFilterTransactions(result)
      setParsed(cleaned)
    } catch (err) {
      setError("Could not parse: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    e.target.value = ""
    setLoading(true)
    setError("")
    const isPDF = file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf"
    const reader = new FileReader()

    if (isPDF) {
      reader.onload = async (ev) => {
        try {
          const base64 = ev.target.result.split(",")[1]
          if (!base64) {
            setError("Could not read PDF file — try pasting the text instead.")
            setLoading(false)
            return
          }
          const raw = await callClaude([
            {
              role: "user",
              content: [
                { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
                {
                  type: "text",
                  text: `Parse ALL transactions from this Nigerian bank statement PDF. Return ONLY a JSON array, no other text:
[{"date":"YYYY-MM-DD","description":"narration","amount":12345,"type":"credit|debit","category":"sales|ingredients|delivery|packaging|salary|transport|advertising|equipment|rent|bank_charges|miscellaneous"}]

Credits = money IN from customers. Debits = money OUT (expenses).
Ignore stamp duty and VAT lines under ₦500.`
                }
              ]
            }
          ], "You extract bank transactions from Nigerian bank statements. Return only a valid JSON array.")
          
          const cleanedText = raw.replace(/```json|```/g, "").trim()
          const result = JSON.parse(cleanedText)
          const cleaned = cleanAndFilterTransactions(result)
          setParsed(cleaned)
        } catch (err) {
          setError("Could not read PDF: " + err.message + ". Try using Paste Text instead.")
        } finally {
          setLoading(false)
        }
      }
      reader.readAsDataURL(file)
    } else {
      reader.onload = async (ev) => {
        try {
          const text = ev.target.result
          if (!text || !text.trim()) {
            setError("File appears to be empty.")
            setLoading(false)
            return
          }
          await parseFromText(text)
        } catch (err) {
          setError("Could not read file: " + err.message)
          setLoading(false)
        }
      }
      reader.readAsText(file)
    }
  }

  const match = (txId, prodId) => {
    setParsed(p => p.map(t => t.id === txId ? { ...t, matchedProdId: prodId } : t))
  }

  const saveAll = async () => {
    // 1. Split incoming payments that match an invoice with delivery
    let invs = []
    try {
      invs = JSON.parse(localStorage.getItem("ll_quote_invoices") || "[]")
    } catch (e) {}

    const expandedCredits = []
    parsed.filter(t => t.type === "credit").forEach(t => {
      const invoiceMatch = invs.find(iv => iv.deliveryCharge > 0 && Math.abs((iv.amount || 0) - t.amount) < 1)
      if (invoiceMatch) {
        const cakeAmt = invoiceMatch.cakeAmount || (t.amount - invoiceMatch.deliveryCharge)
        expandedCredits.push({ ...t, id: uid(), amount: cakeAmt, category: "sales" })
        expandedCredits.push({ ...t, id: uid(), amount: invoiceMatch.deliveryCharge, category: "delivery", description: (t.description || "") + " (delivery)" })
      } else {
        expandedCredits.push(t)
      }
    })

    const allDebits = parsed.filter(t => t.type === "debit")
    const finalParsed = [...expandedCredits, ...allDebits]

    // 2. Append parsed transactions to ledger and save (avoid overwriting history!)
    const updatedTxns = [...finalParsed, ...transactions]
    setTransactions(updatedTxns)
    await saveTxns(updatedTxns)

    // 3. Match Credits to Confirmed Orders (payment status = "full")
    let updProds = [...productions]
    let prodsUpdated = false
    parsed.filter(t => t.type === "credit" && t.matchedProdId).forEach(t => {
      updProds = updProds.map(p => {
        if (p.id === t.matchedProdId) {
          prodsUpdated = true
          return { ...p, paymentType: "full" }
        }
        return p
      })
    })
    
    if (prodsUpdated) {
      setProductions(updProds)
      await saveProductionsList(updProds)
    }

    // 4. Auto-add debits to Expenses log
    const debits = parsed.filter(t => t.type === "debit" && t.category !== "bank_charges").map(t => ({
      id: uid(),
      date: t.date,
      description: t.description,
      amount: t.amount,
      category: {
        ingredients: "Ingredients / Supplies",
        delivery: "Delivery",
        packaging: "Packaging",
        salary: "Salary",
        utilities: "Utilities",
        transport: "Transport",
        advertising: "Advertising",
        equipment: "Equipment",
        rent: "Rent",
        miscellaneous: "Miscellaneous"
      }[t.category] || "Miscellaneous",
      paymentMethod: "transfer",
      source: (t.category === "ingredients" || t.category === "packaging") ? "purchase" : "bank"
    }))

    if (debits.length > 0) {
      const updExp = [...debits, ...expenses]
      setExpenses(updExp)
      saveExpenses(updExp)
    }

    setParsed([])
    setInput("")
  }

  const credits = parsed.filter(t => t.type === "credit")
  const debits = parsed.filter(t => t.type === "debit")

  return (
    <div>
      <SHead title="Bank Statement" sub="Upload PDF statements or paste text to reconcile payments and log overhead expenses." />

      <Card style={{ marginBottom: 14, background: "#FFF9EE", borderColor: "var(--gold)" }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>📅 Payment Matching & Reconcile</div>
        <p style={{ fontSize: 12.5, color: "var(--muted)", margin: 0, lineHeight: 1.7 }}>
          Clients often pay deposits before delivery. After statement parsing, match credit transactions to confirmed orders in the <strong>Match to Order</strong> column. Debits (money out) are automatically categorised and added directly to your Overhead Expenses.
        </p>
      </Card>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <Btn small variant={mode === "paste" ? "primary" : "ghost"} onClick={() => setMode("paste")}>📋 Paste Text</Btn>
        <Btn small variant={mode === "file" ? "primary" : "ghost"} onClick={() => setMode("file")}>📄 Upload PDF / CSV</Btn>
      </div>

      {parsed.length === 0 ? (
        <Card>
          {mode === "paste" ? (
            <>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Paste Bank Statement Text</div>
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder={"Copy and paste your bank statement text here.\n\nYou can copy the text from your bank's website or app.\n\nThe AI will recognize GTBank, Access, Zenith, UBA, First Bank and all other Nigerian banks."}
                style={{ width: "100%", minHeight: 180, padding: "12px", borderRadius: 8, border: "1px solid var(--border)", background: "#FAF7F0", fontSize: 13, fontFamily: "monospace", color: "var(--text)", boxSizing: "border-box", resize: "vertical", outline: "none" }}
              />
              {error && <div style={{ color: "#B03A2E", fontSize: 12.5, marginTop: 8 }}>⚠ {error}</div>}
              <div style={{ marginTop: 10 }}>
                <Btn onClick={() => parseFromText(input)} disabled={loading || !input.trim()}>{loading ? "🔍 Parsing…" : "✦ Parse Statement"}</Btn>
              </div>
            </>
          ) : (
            <>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Upload Bank Statement PDF</div>
              <div onClick={() => fileRef.current?.click()} style={{ border: "2px dashed var(--border)", borderRadius: 10, padding: 40, textAlign: "center", cursor: "pointer", background: "#FAF7F0", marginBottom: 10 }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>📄</div>
                <div style={{ fontSize: 14, color: "var(--muted)" }}>Click to upload</div>
                <div style={{ fontSize: 12, color: "#C8B89A", marginTop: 4 }}>PDF or CSV bank statement</div>
                <div style={{ fontSize: 11.5, color: "var(--gold)", marginTop: 8 }}>✓ GTBank PDF statements supported</div>
              </div>
              <input ref={fileRef} type="file" accept=".pdf,.csv,.txt" onChange={handleFile} style={{ display: "none" }} />
              {loading && <div style={{ textAlign: "center", color: "var(--muted)", fontSize: 13 }}>🔍 AI is reading your statement… This may take 30-60 seconds for long statements.</div>}
              {error && <div style={{ color: "#B03A2E", fontSize: 12.5, marginTop: 8 }}>⚠ {error}</div>}
            </>
          )}
        </Card>
      ) : (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 14 }}>
            {[
              { label: "Credits (In)", val: fmt(credits.reduce((s, t) => s + t.amount, 0)), sub: `${credits.length} payments in`, color: "#357A52" },
              { label: "Debits (Out)", val: fmt(debits.reduce((s, t) => s + t.amount, 0)), sub: `${debits.length} payments out`, color: "#B03A2E" },
              { label: "Unmatched Credits", val: parsed.filter(t => t.type === "credit" && !t.matchedProdId).length, sub: "need order matching", color: "var(--gold)" }
            ].map(s => (
              <Card key={s.label}>
                <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 5 }}>{s.label}</div>
                <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, fontWeight: 700, color: s.color }}>{s.val}</div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{s.sub}</div>
              </Card>
            ))}
          </div>

          <Card style={{ padding: 0, marginBottom: 12, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <TH cols={["Date", "Description", "Amount", "Type", "Category (Edit)", "Match to Order"]} />
              <tbody>
                {parsed.map((t, i) => (
                  <TR2
                    key={t.id}
                    i={i}
                    row={[
                      <span style={{ color: "var(--muted)", fontSize: 12 }}>{t.date}</span>,
                      <span style={{ fontSize: 12.5 }}>{t.description}</span>,
                      <span style={{ fontWeight: 600, color: t.type === "credit" ? "#357A52" : "#B03A2E" }}>
                        {t.type === "credit" ? "+" : "–"}{fmt(t.amount)}
                      </span>,
                      <Badge color={t.type === "credit" ? "green" : "red"}>{t.type}</Badge>,
                      
                      // Category drop down for manual corrections
                      <select
                        value={t.category || "miscellaneous"}
                        onChange={e => setParsed(prev => prev.map(x => x.id === t.id ? { ...x, category: e.target.value } : x))}
                        style={{ fontSize: 12, padding: "4px 6px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--panel)", color: "var(--text)" }}
                      >
                        <option value="sales">Sales (Income)</option>
                        <option value="ingredients">Ingredients</option>
                        <option value="delivery">Delivery</option>
                        <option value="packaging">Packaging</option>
                        <option value="salary">Salary</option>
                        <option value="transport">Transport</option>
                        <option value="advertising">Advertising</option>
                        <option value="equipment">Equipment</option>
                        <option value="rent">Rent</option>
                        <option value="bank_charges">Bank Charges</option>
                        <option value="miscellaneous">Miscellaneous</option>
                      </select>,

                      t.type === "credit" ? (
                        t.matchedProdId ? (
                          <span style={{ fontSize: 12, color: "#357A52", fontWeight: 500 }}>✓ Matched</span>
                        ) : (
                          <select
                            onChange={e => match(t.id, e.target.value)}
                            defaultValue=""
                            style={{ fontSize: 12, padding: "4px 6px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--panel)", color: "var(--text)" }}
                          >
                            <option value="">Match to order…</option>
                            {productions.map(p => (
                              <option key={p.id} value={p.id}>{p.client} — {p.deliveryDate || "Unscheduled"} ({fmt(p.salePrice)})</option>
                            ))}
                          </select>
                        )
                      ) : (
                        <span style={{ color: "var(--border)" }}>—</span>
                      )
                    ]}
                  />
                ))}
              </tbody>
            </table>
          </Card>

          <div style={{ display: "flex", gap: 8 }}>
            <Btn variant="success" onClick={saveAll}>✓ Save All Transactions</Btn>
            <Btn variant="ghost" onClick={() => { setParsed([]); setInput("") }}>← New Statement</Btn>
          </div>
        </div>
      )}
    </div>
  )
}
