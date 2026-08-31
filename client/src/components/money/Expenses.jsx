/**
 * Expenses.jsx
 * ----------------------------------------------------------------------------
 * Overhead Expenses Ledger.
 * Logs Utilities, Salary, Delivery, Transport, etc. Excludes ingredient purchases.
 * ----------------------------------------------------------------------------
 */
import React, { useState, useEffect, useMemo } from "react"
import { Btn, Inp, Sel, Card, Badge, SHead, Tabs, TH, TR2, iSt, Spinner, Pagination } from "../common/ui.jsx"
import { fmt, uid, today } from "../../lib/helpers.js"
import { EXP_CATS } from "../../constants.js"
import { saveExpenses } from "../../lib/data.js"

export function Expenses({ expenses, setExpenses, isOwner }) {
  const [tab, setTab] = useState("monthly")
  const [adding, setAdding] = useState(false)
  const [editingRows, setEditingRows] = useState({}) // { [id]: editData }
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [deletingAll, setDeletingAll] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)


  const [draftExpenses, setDraftExpenses] = useState([
    {
      date: today(),
      description: "",
      amount: "",
      category: "Utilities",
      paymentMethod: "cash",
      notes: ""
    }
  ])

  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState(EXP_CATS[0])

  const updateDraftExpense = (idx, field, value) => {
    setDraftExpenses(prev => {
      const copy = [...prev]
      copy[idx] = { ...copy[idx], [field]: value }
      return copy
    })
  }

  const addDraftRow = () => {
    const lastRow = draftExpenses[draftExpenses.length - 1]
    setDraftExpenses(p => [
      ...p,
      {
        date: lastRow?.date || today(),
        description: "",
        amount: "",
        category: lastRow?.category || "Utilities",
        paymentMethod: lastRow?.paymentMethod || "cash",
        notes: ""
      }
    ])
  }

  const removeDraftExpense = (idx) => {
    setDraftExpenses(prev => prev.filter((_, i) => i !== idx))
  }

  // Save manual Cash Expenses
  const saveExp = async () => {
    const invalid = draftExpenses.some(de => !de.description.trim() || !de.amount)
    if (invalid) {
      alert("Description and Amount are required for all entries")
      return
    }
    const newExpenses = draftExpenses.map(de => ({
      ...de,
      id: uid(),
      amount: Number(de.amount),
      source: "manual"
    }))
    const updated = [...newExpenses, ...expenses]
    setExpenses(updated)
    await saveExpenses(updated)

    setDraftExpenses([
      {
        date: today(),
        description: "",
        amount: "",
        category: "Utilities",
        paymentMethod: "cash",
        notes: ""
      }
    ])
    setAdding(false)
  }

  // Inline editor functions
  const startEdit = (e) => {
    setEditingRows(p => ({ ...p, [e.id]: { ...e } }))
  }

  const saveEdit = async (id) => {
    const editRowData = editingRows[id]
    if (!editRowData.description?.trim() || !editRowData.amount) {
      alert("Description and Amount are required")
      return
    }
    const updated = expenses.map(e => e.id === id ? { ...editRowData, amount: Number(editRowData.amount) } : e)
    setExpenses(updated)
    await saveExpenses(updated)
    setEditingRows(p => {
      const copy = { ...p }
      delete copy[id]
      return copy
    })
  }

  const cancelEdit = (id) => {
    setEditingRows(p => {
      const copy = { ...p }
      delete copy[id]
      return copy
    })
  }

  const saveAllEdits = async () => {
    const rows = Object.values(editingRows)
    const invalid = rows.some(r => !r.description?.trim() || !r.amount)
    if (invalid) {
      alert("Description and Amount are required for all editing entries")
      return
    }
    const updated = expenses.map(e => {
      if (editingRows[e.id]) {
        return { ...editingRows[e.id], amount: Number(editingRows[e.id].amount) }
      }
      return e
    })
    setExpenses(updated)
    await saveExpenses(updated)
    setEditingRows({})
  }

  const cancelAllEdits = () => {
    setEditingRows({})
  }

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this expense?")) {
      const updated = expenses.filter(e => e.id !== id)
      setExpenses(updated)
      await saveExpenses(updated)
      setSelectedIds(p => {
        const copy = new Set(p)
        copy.delete(id)
        return copy
      })
    }
  }

  // Bulk Actions
  const handleSelectRowToggle = (id) => {
    setSelectedIds(p => {
      const copy = new Set(p)
      if (copy.has(id)) {
        copy.delete(id)
      } else {
        copy.add(id)
      }
      return copy
    })
  }

  const handleSelectAllToggle = () => {
    const allFilteredSelected = filtered.length > 0 && filtered.every(e => selectedIds.has(e.id))
    setSelectedIds(p => {
      const copy = new Set(p)
      if (allFilteredSelected) {
        filtered.forEach(e => copy.delete(e.id))
      } else {
        filtered.forEach(e => copy.add(e.id))
      }
      return copy
    })
  }

  const handleBulkDelete = async () => {
    if (window.confirm(`Are you sure you want to delete the ${selectedIds.size} selected expenses?`)) {
      const updated = expenses.filter(e => !selectedIds.has(e.id))
      setExpenses(updated)
      await saveExpenses(updated)
      setSelectedIds(new Set())
    }
  }

  const startBulkEdit = () => {
    setEditingRows(p => {
      const copy = { ...p }
      filtered.forEach(e => {
        if (selectedIds.has(e.id)) {
          copy[e.id] = { ...e }
        }
      })
      return copy
    })
    setSelectedIds(new Set())
  }

  const handleBulkChangeField = async (field, value) => {
    if (window.confirm(`Are you sure you want to change the ${field} of the ${selectedIds.size} selected expenses to "${value}"?`)) {
      const updated = expenses.map(e => selectedIds.has(e.id) ? { ...e, [field]: value } : e)
      setExpenses(updated)
      await saveExpenses(updated)
      setSelectedIds(new Set())
    }
  }

  // Filter logic
  const filtered = expenses.filter(e => {
    // Ingredient purchases are tracked separately in Purchases, exclude here
    if (e.source === "purchase") return false

    // Filter globally by the selected month
    if (!e.date?.startsWith(selectedMonth)) return false

    if (tab === "by_category") {
      return e.category === selectedCategoryFilter
    }
    if (tab === "manual") {
      return e.source === "manual" || e.source === "receipt" || !e.source
    }
    if (tab === "bank") {
      return e.source === "bank"
    }
    return true // "monthly"
  })

  useEffect(() => {
    setCurrentPage(1)
  }, [selectedMonth, tab, selectedCategoryFilter])

  const paginatedExpenses = useMemo(() => {
    if (pageSize === "all") return filtered
    const sz = Number(pageSize) || 25
    const start = (currentPage - 1) * sz
    return filtered.slice(start, start + sz)
  }, [filtered, currentPage, pageSize])


  const handleDeleteAll = async () => {
    if (!window.confirm("Are you sure you want to delete ALL overhead expenses? This will permanently delete all manual and bank expenses across all months. (Ingredient purchase expenses will be preserved). This cannot be undone.")) return
    setDeletingAll(true)
    try {
      const updated = expenses.filter(e => e.source === "purchase")
      setExpenses(updated)
      await saveExpenses(updated)
    } catch (err) {
      alert("Failed to delete expenses: " + err.message)
    } finally {
      setDeletingAll(false)
    }
  }

  const hasExpenses = expenses.some(e => e.source !== "purchase")

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
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <label style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8 }}>Month:</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              style={{ ...iSt, width: 140, padding: "5px 8px", fontSize: 12.5, marginTop: 0 }}
            />
          </div>
          <Tabs
            tabs={[
              { v: "monthly", l: "Monthly Ledger" },
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
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {isOwner && (
            deletingAll ? (
              <Spinner />
            ) : (
              <Btn
                small
                variant="ghost"
                disabled={deletingAll}
                style={{ color: "#B03A2E", borderColor: "#F2DEDE", fontSize: "11.5px", fontWeight: "normal", padding: "4px 8px" }}
                onClick={handleDeleteAll}
              >
                🗑 Clear All Overhead
              </Btn>
            )
          )}
          <Btn onClick={() => setAdding(!adding)}>+ Add Cash Expense</Btn>
        </div>
      </div>

      {/* New Expense Form */}
      {adding && (
        <Card style={{ marginBottom: 14, background: "#FFF9EE", borderColor: "var(--gold)" }}>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 14, fontWeight: 600, marginBottom: 12 }}>New Manual Expenses (Cash / No Receipt)</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 12 }}>
            {draftExpenses.map((de, idx) => (
              <div key={idx} style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: 12,
                background: "var(--panel)",
                position: "relative"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--gold)" }}>Entry #{idx + 1}</span>
                  {draftExpenses.length > 1 && (
                    <button
                      onClick={() => removeDraftExpense(idx)}
                      style={{ background: "none", border: "none", color: "#B03A2E", cursor: "pointer", fontSize: 11, fontWeight: 600 }}
                    >
                      🗑 Remove Entry
                    </button>
                  )}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 8 }}>
                  <Inp label="Date *" type="date" value={de.date} onChange={v => updateDraftExpense(idx, "date", v)} small />
                  <Inp label="Description *" value={de.description} onChange={v => updateDraftExpense(idx, "description", v)} placeholder="e.g. Electricity bill" small />
                  <Inp label="Amount (₦) *" type="number" value={de.amount} onChange={v => updateDraftExpense(idx, "amount", v)} placeholder="0" small />
                  <Sel
                    label="Category"
                    value={de.category}
                    onChange={v => updateDraftExpense(idx, "category", v)}
                    options={EXP_CATS.map(c => ({ value: c, label: c }))}
                  />
                  <Sel
                    label="Payment Method"
                    value={de.paymentMethod}
                    onChange={v => updateDraftExpense(idx, "paymentMethod", v)}
                    options={[
                      { value: "cash", label: "Cash" },
                      { value: "transfer", label: "Bank Transfer" },
                      { value: "pos", label: "POS/Card" }
                    ]}
                  />
                  <Inp label="Notes" value={de.notes} onChange={v => updateDraftExpense(idx, "notes", v)} placeholder="Optional notes" small />
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14 }}>
            <Btn variant="outline" onClick={addDraftRow}>+ Add Another Entry</Btn>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn variant="success" onClick={saveExp}>Save {draftExpenses.length} {draftExpenses.length === 1 ? "Expense" : "Expenses"}</Btn>
              <Btn variant="ghost" onClick={() => {
                setAdding(false)
                setDraftExpenses([{
                  date: today(),
                  description: "",
                  amount: "",
                  category: "Utilities",
                  paymentMethod: "cash",
                  notes: ""
                }])
              }}>Cancel</Btn>
            </div>
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
      </div>      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div style={{
          background: "#FFF9EE",
          border: "1px solid var(--gold)",
          borderRadius: 8,
          padding: "10px 16px",
          marginBottom: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 600, fontSize: 13.5 }}>
              ⚡ {selectedIds.size} {selectedIds.size === 1 ? "expense" : "expenses"} selected
            </span>
            <Btn small variant="ghost" onClick={startBulkEdit}> Edit Selected</Btn>

            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>Category:</span>
              <select
                defaultValue=""
                onChange={e => {
                  if (e.target.value) {
                    handleBulkChangeField("category", e.target.value)
                    e.target.value = "" // reset select
                  }
                }}
                style={{ ...iSt, width: 140, padding: "3px 6px", fontSize: 12, marginTop: 0 }}
              >
                <option value="" disabled>— Bulk Set —</option>
                {EXP_CATS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>Payment:</span>
              <select
                defaultValue=""
                onChange={e => {
                  if (e.target.value) {
                    handleBulkChangeField("paymentMethod", e.target.value)
                    e.target.value = "" // reset select
                  }
                }}
                style={{ ...iSt, width: 140, padding: "3px 6px", fontSize: 12, marginTop: 0 }}
              >
                <option value="" disabled>— Bulk Set —</option>
                <option value="cash">Cash</option>
                <option value="transfer">Bank Transfer</option>
                <option value="pos">POS/Card</option>
              </select>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn small variant="danger" onClick={handleBulkDelete}>🗑 Delete Selected</Btn>
            <Btn small variant="ghost" style={{ borderColor: "transparent" }} onClick={() => setSelectedIds(new Set())}>Clear</Btn>
          </div>
        </div>
      )}

      {/* Editing Summary Bar */}
      {Object.keys(editingRows).length > 0 && (
        <div style={{
          background: "#E8EFFC",
          border: "1px solid #B5D4F4",
          borderRadius: 8,
          padding: "10px 16px",
          marginBottom: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap"
        }}>
          <span style={{ fontWeight: 600, fontSize: 13.5, color: "#2355A0" }}>
            📝 Editing {Object.keys(editingRows).length} {Object.keys(editingRows).length === 1 ? "expense" : "expenses"}
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn small variant="success" onClick={saveAllEdits}>✓ Save All Changes</Btn>
            <Btn small variant="ghost" onClick={cancelAllEdits}>✕ Cancel All</Btn>
          </div>
        </div>
      )}

      {/* Expenses Table */}
      <Card style={{ padding: 0, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <TH cols={[
            <input
              key="select-all-cb"
              type="checkbox"
              checked={filtered.length > 0 && filtered.every(e => selectedIds.has(e.id))}
              onChange={handleSelectAllToggle}
              style={{ cursor: "pointer" }}
            />,
            "Date", "Description", "Category", "Amount", "Source", "Actions"
          ]} />
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>
                  No expenses matching current filters.
                </td>
              </tr>
            ) : (
              paginatedExpenses.map((e, i) => editingRows[e.id] ? (
                <tr key={e.id} style={{ background: "#FEF9EE" }}>
                  <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--border)" }}>
                    {/* Checkbox column alignment placeholder */}
                  </td>
                  <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--border)" }}>
                    <input
                      type="date"
                      value={editingRows[e.id].date || ""}
                      onChange={ev => setEditingRows(p => ({
                        ...p,
                        [e.id]: { ...p[e.id], date: ev.target.value }
                      }))}
                      style={{ padding: "4px 6px", border: "1px solid var(--border)", borderRadius: 5, fontSize: 12, fontFamily: "inherit", width: 130 }}
                    />
                  </td>
                  <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--border)" }}>
                    <input
                      value={editingRows[e.id].description || ""}
                      onChange={ev => setEditingRows(p => ({
                        ...p,
                        [e.id]: { ...p[e.id], description: ev.target.value }
                      }))}
                      style={{ padding: "4px 6px", border: "1px solid var(--border)", borderRadius: 5, fontSize: 12, fontFamily: "inherit", width: "100%", minWidth: 140 }}
                    />
                  </td>
                  <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--border)" }}>
                    <select
                      value={editingRows[e.id].category || "Utilities"}
                      onChange={ev => setEditingRows(p => ({
                        ...p,
                        [e.id]: { ...p[e.id], category: ev.target.value }
                      }))}
                      style={{ padding: "4px 6px", border: "1px solid var(--border)", borderRadius: 5, fontSize: 12, fontFamily: "inherit" }}
                    >
                      {EXP_CATS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--border)" }}>
                    <input
                      type="number"
                      value={editingRows[e.id].amount || ""}
                      onChange={ev => setEditingRows(p => ({
                        ...p,
                        [e.id]: { ...p[e.id], amount: ev.target.value }
                      }))}
                      style={{ padding: "4px 6px", border: "1px solid var(--border)", borderRadius: 5, fontSize: 12, fontFamily: "inherit", width: 90 }}
                    />
                  </td>
                  <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--border)" }}>
                    <Badge color="gold">editing</Badge>
                  </td>
                  <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--border)" }}>
                    <div style={{ display: "flex", gap: 4 }}>
                      <Btn small variant="success" onClick={() => saveEdit(e.id)}>✓</Btn>
                      <Btn small variant="ghost" onClick={() => cancelEdit(e.id)}>✕</Btn>
                    </div>
                  </td>
                </tr>
              ) : (
                <TR2
                  key={e.id}
                  i={i}
                  row={[
                    <input
                      type="checkbox"
                      checked={selectedIds.has(e.id)}
                      onChange={() => handleSelectRowToggle(e.id)}
                      style={{ cursor: "pointer" }}
                    />,
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

      <Pagination
        currentPage={currentPage}
        totalItems={filtered.length}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        onPageSizeChange={(sz) => {
          setPageSize(sz)
          setCurrentPage(1)
        }}
        pageSizeOptions={[10, 25, 50, 100]}
        itemLabel="expenses"
      />
    </div>
  )
}
