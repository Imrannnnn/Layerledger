/**
 * Expenses.jsx
 * ----------------------------------------------------------------------------
 * Overhead Expenses Ledger.
 * Logs Utilities, Salary, Delivery, Transport, etc. Excludes ingredient purchases.
 * ----------------------------------------------------------------------------
 */
import React, { useState } from "react"
import { Btn, Inp, Sel, Card, Badge, SHead, Tabs, TH, TR2, iSt } from "../common/ui.jsx"
import { fmt, uid, today } from "../../lib/helpers.js"
import { EXP_CATS } from "../../constants.js"
import { saveExpenses } from "../../lib/data.js"

export function Expenses({ expenses, setExpenses }) {
  const [tab, setTab] = useState("all")
  const [adding, setAdding] = useState(false)
  const [editId, setEditId] = useState(null)
  const [editData, setEditData] = useState({})
  
  const [ne, setNe] = useState({
    date: today(),
    description: "",
    amount: "",
    category: "Utilities",
    paymentMethod: "cash",
    notes: ""
  })
  
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState(EXP_CATS[0])

  // Save manual Cash Expense
  const saveExp = async () => {
    if (!ne.description.trim() || !ne.amount) {
      alert("Description and Amount are required")
      return
    }
    const updated = [
      {
        ...ne,
        id: uid(),
        amount: Number(ne.amount),
        source: "manual"
      },
      ...expenses
    ]
    setExpenses(updated)
    await saveExpenses(updated)
    
    setNe({
      date: today(),
      description: "",
      amount: "",
      category: "Utilities",
      paymentMethod: "cash",
      notes: ""
    })
    setAdding(false)
  }

  // Inline editor functions
  const startEdit = (e) => {
    setEditId(e.id)
    setEditData({ ...e })
  }
  
  const saveEdit = async () => {
    const updated = expenses.map(e => e.id === editId ? { ...editData, amount: Number(editData.amount) } : e)
    setExpenses(updated)
    await saveExpenses(updated)
    setEditId(null)
  }

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this expense?")) {
      const updated = expenses.filter(e => e.id !== id)
      setExpenses(updated)
      await saveExpenses(updated)
    }
  }

  // Filter logic
  const currentMonthStr = new Date().toISOString().slice(0, 7)
  
  const filtered = expenses.filter(e => {
    // Ingredient purchases are tracked separately in Purchases, exclude here
    if (e.source === "purchase") return false

    if (tab === "this_month") {
      return e.date?.startsWith(currentMonthStr)
    }
    if (tab === "by_category") {
      return e.category === selectedCategoryFilter
    }
    if (tab === "manual") {
      return e.source === "manual" || !e.source
    }
    if (tab === "bank") {
      return e.source === "bank"
    }
    return true // "all"
  })

  const total = filtered.reduce((sum, e) => sum + (e.amount || 0), 0)

  // Calculate category totals for the CURRENT filtered view
  const categoryTotals = {}
  EXP_CATS.forEach(c => { categoryTotals[c] = 0 })
  filtered.forEach(e => {
    const cat = e.category || "Miscellaneous"
    categoryTotals[cat] = (categoryTotals[cat] || 0) + (e.amount || 0)
  })

  return (
    <div>
      <SHead title="Overhead Expenses" sub="Log and track non-ingredient running costs." />

      {/* Tip Banner */}
      <div style={{ marginBottom: 14, padding: "12px 16px", background: "#FFF9EE", borderRadius: 8, fontSize: 13, color: "#8A6D3B", border: "1px solid #F0DFA0", lineHeight: 1.6 }}>
        💡 <strong>Tip:</strong> Ingredient purchases go in <strong>Purchases</strong> and update your stock. Use <strong>Expenses</strong> for your running costs like electricity, salary, and delivery.
      </div>

      {/* Action / Filter row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <Tabs
            tabs={[
              { v: "all", l: "All" },
              { v: "this_month", l: "This Month" },
              { v: "by_category", l: "By Category" },
              { v: "manual", l: "Manual Entry" },
              { v: "bank", l: "From Bank Statement" }
            ]}
            active={tab}
            onChange={setTab}
          />
          {tab === "by_category" && (
            <select
              value={selectedCategoryFilter}
              onChange={e => setSelectedCategoryFilter(e.target.value)}
              style={{ ...iSt, width: 180, padding: "5px 8px", fontSize: 12.5 }}
            >
              {EXP_CATS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
        </div>
        <Btn onClick={() => setAdding(!adding)}>+ Add Cash Expense</Btn>
      </div>

      {/* New Expense Form */}
      {adding && (
        <Card style={{ marginBottom: 14, background: "#FFF9EE", borderColor: "var(--gold)" }}>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 14, fontWeight: 600, marginBottom: 12 }}>New Manual Expense (Cash / No Receipt)</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10, marginBottom: 12 }}>
            <Inp label="Date *" type="date" value={ne.date} onChange={v => setNe(p => ({ ...p, date: v }))} />
            <Inp label="Description *" value={ne.description} onChange={v => setNe(p => ({ ...p, description: v }))} placeholder="e.g. Electricity bill" />
            <Inp label="Amount (₦) *" type="number" value={ne.amount} onChange={v => setNe(p => ({ ...p, amount: v }))} />
            <Sel
              label="Category"
              value={ne.category}
              onChange={v => setNe(p => ({ ...p, category: v }))}
              options={EXP_CATS.map(c => ({ value: c, label: c }))}
            />
            <Sel
              label="Payment Method"
              value={ne.paymentMethod}
              onChange={v => setNe(p => ({ ...p, paymentMethod: v }))}
              options={[
                { value: "cash", label: "Cash" },
                { value: "transfer", label: "Bank Transfer" },
                { value: "pos", label: "POS/Card" }
              ]}
            />
            <Inp label="Notes" value={ne.notes} onChange={v => setNe(p => ({ ...p, notes: v }))} placeholder="Optional notes" />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn variant="success" onClick={saveExp}>Save Expense</Btn>
            <Btn variant="ghost" onClick={() => setAdding(false)}>Cancel</Btn>
          </div>
        </Card>
      )}

      {/* Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2.5fr", gap: 14, marginBottom: 14, alignItems: "stretch" }}>
        {/* Total card */}
        <Card style={{ borderLeft: "4px solid #B03A2E", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 5 }}>Total Expenses ({filtered.length})</div>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, fontWeight: 700, color: "#B03A2E" }}>{fmt(total)}</div>
        </Card>

        {/* By Category panel */}
        <Card>
          <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 600, marginBottom: 8 }}>Category Totals (Current View)</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {Object.entries(categoryTotals).filter(([_, amt]) => amt > 0).map(([cat, amt]) => (
              <div key={cat} style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 6, padding: "6px 10px", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11.5, fontWeight: 500 }}>{cat}</span>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: "#B03A2E" }}>{fmt(amt)}</span>
              </div>
            ))}
            {Object.values(categoryTotals).every(amt => amt === 0) && (
              <span style={{ fontSize: 12, color: "var(--muted)" }}>No overhead expenses in the current selection.</span>
            )}
          </div>
        </Card>
      </div>

      {/* Expenses Table */}
      <Card style={{ padding: 0, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <TH cols={["Date", "Description", "Category", "Amount", "Source", "Actions"]} />
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>
                  No expenses matching current filters.
                </td>
              </tr>
            ) : (
              filtered.map((e, i) => editId === e.id ? (
                <tr key={e.id} style={{ background: "#FEF9EE" }}>
                  <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--border)" }}>
                    <input
                      type="date"
                      value={editData.date || ""}
                      onChange={ev => setEditData(p => ({ ...p, date: ev.target.value }))}
                      style={{ padding: "4px 6px", border: "1px solid var(--border)", borderRadius: 5, fontSize: 12, fontFamily: "inherit", width: 130 }}
                    />
                  </td>
                  <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--border)" }}>
                    <input
                      value={editData.description || ""}
                      onChange={ev => setEditData(p => ({ ...p, description: ev.target.value }))}
                      style={{ padding: "4px 6px", border: "1px solid var(--border)", borderRadius: 5, fontSize: 12, fontFamily: "inherit", width: "100%", minWidth: 140 }}
                    />
                  </td>
                  <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--border)" }}>
                    <select
                      value={editData.category || ""}
                      onChange={ev => setEditData(p => ({ ...p, category: ev.target.value }))}
                      style={{ padding: "4px 6px", border: "1px solid var(--border)", borderRadius: 5, fontSize: 11, fontFamily: "inherit" }}
                    >
                      {EXP_CATS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--border)" }}>
                    <input
                      type="number"
                      value={editData.amount || ""}
                      onChange={ev => setEditData(p => ({ ...p, amount: ev.target.value }))}
                      style={{ padding: "4px 6px", border: "1px solid var(--border)", borderRadius: 5, fontSize: 12, fontFamily: "inherit", width: 90 }}
                    />
                  </td>
                  <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--border)" }}>
                    <Badge color="gold">editing</Badge>
                  </td>
                  <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--border)" }}>
                    <div style={{ display: "flex", gap: 4 }}>
                      <Btn small variant="success" onClick={saveEdit}>✓</Btn>
                      <Btn small variant="ghost" onClick={() => setEditId(null)}>✕</Btn>
                    </div>
                  </td>
                </tr>
              ) : (
                <TR2
                  key={e.id}
                  i={i}
                  row={[
                    <span style={{ color: "var(--muted)", fontSize: 12 }}>{e.date}</span>,
                    <span style={{ fontWeight: 500 }}>{e.description}</span>,
                    <Badge>{e.category}</Badge>,
                    <span style={{ color: "#B03A2E", fontWeight: 600 }}>{fmt(e.amount)}</span>,
                    <Badge color={e.source === "receipt" ? "blue" : e.source === "bank" ? "green" : "gray"}>
                      {e.source || "manual"}
                    </Badge>,
                    <div style={{ display: "flex", gap: 4 }}>
                      <Btn small variant="ghost" onClick={() => startEdit(e)}>Edit</Btn>
                      <Btn small variant="ghost" onClick={() => handleDelete(e.id)}>×</Btn>
                    </div>
                  ]}
                />
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
