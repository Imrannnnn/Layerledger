/**
 * GeneralLedgerView.jsx
 * ----------------------------------------------------------------------------
 * General Ledger Account Inquiry & Trial Balance Explorer.
 * Allows bakery owners to audit running balances, debit/credit transactions,
 * and verify the trial balance equality (sum(debits) === sum(credits)).
 * ----------------------------------------------------------------------------
 */
import React, { useState, useEffect } from "react"
import { Btn, Card, SHead, Badge } from "../common/ui.jsx"
import { fmt, today } from "../../lib/helpers.js"
import {
  fetchAccounts,
  fetchAccountLedger,
  fetchTrialBalance,
  postManualJournalEntry,
  reverseJournalEntry
} from "../../lib/accountingApi.js"
import {
  BookOpen,
  Scale,
  RefreshCw,
  PlusCircle,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Filter
} from "lucide-react"

export function GeneralLedgerView({ company }) {
  const [activeTab, setActiveTab] = useState("ledger") // "ledger" | "trial" | "manual"
  const [accounts, setAccounts] = useState([])
  const [selectedAccount, setSelectedAccount] = useState("1110") // default Bank
  const [ledgerData, setLedgerData] = useState(null)
  const [loadingLedger, setLoadingLedger] = useState(false)

  // Filters for ledger
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState(today())

  // Trial balance state
  const [asOfDate, setAsOfDate] = useState(today())
  const [trialData, setTrialData] = useState(null)
  const [loadingTrial, setLoadingTrial] = useState(false)

  // Manual journal entry modal/form state
  const [showManualModal, setShowManualModal] = useState(false)
  const [manualDate, setManualDate] = useState(today())
  const [manualMemo, setManualMemo] = useState("")
  const [manualLines, setManualLines] = useState([
    { accountCode: "1110", debit: "", credit: "", memo: "" },
    { accountCode: "2120", debit: "", credit: "", memo: "" }
  ])
  const [submittingManual, setSubmittingManual] = useState(false)
  const [manualError, setManualError] = useState(null)

  // Reversal modal state
  const [reversingEntryId, setReversingEntryId] = useState(null)
  const [reversalReason, setReversalReason] = useState("")
  const [submittingReversal, setSubmittingReversal] = useState(false)

  // Load chart of accounts
  useEffect(() => {
    fetchAccounts()
      .then(accs => setAccounts(accs || []))
      .catch(err => console.error("Error loading accounts:", err))
  }, [])

  // Load account ledger when selectedAccount, startDate, or endDate changes
  const loadLedger = async () => {
    if (!selectedAccount) return
    try {
      setLoadingLedger(true)
      const data = await fetchAccountLedger(selectedAccount, {
        startDate: startDate || undefined,
        endDate: endDate || undefined
      })
      setLedgerData(data)
    } catch (err) {
      console.error("Error loading account ledger:", err)
    } finally {
      setLoadingLedger(false)
    }
  }

  useEffect(() => {
    if (activeTab === "ledger") {
      loadLedger()
    }
  }, [selectedAccount, startDate, endDate, activeTab])

  // Load trial balance
  const loadTrial = async () => {
    try {
      setLoadingTrial(true)
      const data = await fetchTrialBalance({ asOfDate })
      setTrialData(data)
    } catch (err) {
      console.error("Error loading trial balance:", err)
    } finally {
      setLoadingTrial(false)
    }
  }

  useEffect(() => {
    if (activeTab === "trial") {
      loadTrial()
    }
  }, [asOfDate, activeTab])

  // Handle manual journal entry submission
  const handleSaveManualEntry = async (e) => {
    e.preventDefault()
    setManualError(null)

    // Compute debit and credit sums
    const formattedLines = manualLines.map(l => ({
      accountCode: l.accountCode,
      debit: parseFloat(l.debit) || 0,
      credit: parseFloat(l.credit) || 0,
      memo: l.memo || undefined
    }))

    const totalDebit = formattedLines.reduce((s, l) => s + l.debit, 0)
    const totalCredit = formattedLines.reduce((s, l) => s + l.credit, 0)

    if (Math.abs(totalDebit - totalCredit) > 0.009) {
      setManualError(`Debits (₦${totalDebit.toLocaleString()}) must equal Credits (₦${totalCredit.toLocaleString()}). Difference: ₦${Math.abs(totalDebit - totalCredit).toLocaleString()}`)
      return
    }

    try {
      setSubmittingManual(true)
      await postManualJournalEntry({
        entryDate: manualDate,
        memo: manualMemo || "Manual journal entry",
        lines: formattedLines
      })
      setShowManualModal(false)
      setManualMemo("")
      setManualLines([
        { accountCode: "1110", debit: "", credit: "", memo: "" },
        { accountCode: "2120", debit: "", credit: "", memo: "" }
      ])
      loadLedger()
      if (activeTab === "trial") loadTrial()
      alert("Manual journal entry posted successfully!")
    } catch (err) {
      setManualError(err.message || "Failed to post journal entry")
    } finally {
      setSubmittingManual(false)
    }
  }

  // Handle reversing entry
  const handleExecuteReversal = async () => {
    if (!reversingEntryId) return
    try {
      setSubmittingReversal(true)
      await reverseJournalEntry(reversingEntryId, reversalReason || "Owner requested reversal")
      setReversingEntryId(null)
      setReversalReason("")
      loadLedger()
      alert("Reversing entry posted successfully!")
    } catch (err) {
      alert("Reversal failed: " + (err.message || "Unknown error"))
    } finally {
      setSubmittingReversal(false)
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <div>
          <SHead title="General Ledger & Trial Balance" sub="Double-entry single source of truth — Inspect accounts, transactions, and balance proofs" />
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <span style={{ fontSize: 11, background: "#E8F5EE", color: "#1D6B40", padding: "2px 8px", borderRadius: 4, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}>
              <CheckCircle2 size={11} /> Double-Entry General Ledger
            </span>
            <span style={{ fontSize: 11, color: "var(--muted)" }}>
              58 Standard Chart of Accounts (BakeWealth spec)
            </span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Btn
            variant={activeTab === "ledger" ? "primary" : "ghost"}
            onClick={() => setActiveTab("ledger")}
            style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 13 }}
          >
            <BookOpen size={14} /> Account Ledger
          </Btn>
          <Btn
            variant={activeTab === "trial" ? "primary" : "ghost"}
            onClick={() => setActiveTab("trial")}
            style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 13 }}
          >
            <Scale size={14} /> Trial Balance
          </Btn>
          <Btn
            variant="outline"
            onClick={() => setShowManualModal(true)}
            style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 13 }}
          >
            <PlusCircle size={14} /> Post Journal Entry
          </Btn>
        </div>
      </div>

      {/* TAB 1: ACCOUNT LEDGER INQUIRY */}
      {activeTab === "ledger" && (
        <div>
          {/* Controls Header */}
          <Card style={{ marginBottom: 14, padding: "14px 18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", flex: 1 }}>
                <div>
                  <label style={{ fontSize: 10.5, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 700, display: "block", marginBottom: 3 }}>
                    Select Account
                  </label>
                  <select
                    value={selectedAccount}
                    onChange={e => setSelectedAccount(e.target.value)}
                    style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--panel)", fontSize: 13, color: "var(--text)", minWidth: 260 }}
                  >
                    {accounts.map(a => (
                      <option key={a.accountCode} value={a.accountCode}>
                        {a.accountName} ({a.classification})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 10.5, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 700, display: "block", marginBottom: 3 }}>
                    From Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--panel)", fontSize: 13, color: "var(--text)" }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 10.5, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 700, display: "block", marginBottom: 3 }}>
                    To Date
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--panel)", fontSize: 13, color: "var(--text)" }}
                  />
                </div>
              </div>

              <Btn small variant="ghost" onClick={loadLedger} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <RefreshCw size={13} className={loadingLedger ? "spin" : ""} /> Refresh
              </Btn>
            </div>
          </Card>

          {/* Account Overview Cards */}
          {ledgerData && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 14 }}>
              <Card style={{ padding: "12px 14px", borderTop: "3px solid var(--gold)" }}>
                <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 600 }}>Beginning Balance</div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>
                  {fmt(ledgerData.beginningBalance)}
                </div>
              </Card>

              <Card style={{ padding: "12px 14px", borderTop: "3px solid #2D7A50" }}>
                <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 600 }}>Period Debits</div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, color: "#1D6B40", marginTop: 4 }}>
                  +{fmt(ledgerData.periodDebits)}
                </div>
              </Card>

              <Card style={{ padding: "12px 14px", borderTop: "3px solid #B03A2E" }}>
                <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 600 }}>Period Credits</div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, color: "#B03A2E", marginTop: 4 }}>
                  −{fmt(ledgerData.periodCredits)}
                </div>
              </Card>

              <Card style={{ padding: "12px 14px", borderTop: "3px solid var(--gold)" }}>
                <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 600 }}>Ending Balance</div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, color: "var(--gold)", marginTop: 4 }}>
                  {fmt(ledgerData.endingBalance)}
                </div>
              </Card>
            </div>
          )}

          {/* Ledger Transactions Table */}
          <Card style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 700, fontSize: 13.5 }}>
                {ledgerData?.account ? ledgerData.account.accountName : "General Ledger"}
              </div>
              <span style={{ fontSize: 11, color: "var(--muted)" }}>
                {ledgerData?.lines?.length || 0} transaction{ledgerData?.lines?.length !== 1 ? "s" : ""}
              </span>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead>
                  <tr style={{ background: "var(--bg)", borderBottom: "1px solid var(--border)", textAlign: "left" }}>
                    <th style={{ padding: "9px 12px", fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.8, color: "var(--muted)", fontWeight: 700 }}>Date</th>
                    <th style={{ padding: "9px 12px", fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.8, color: "var(--muted)", fontWeight: 700 }}>Source / Memo</th>
                    <th style={{ padding: "9px 12px", fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.8, color: "var(--muted)", fontWeight: 700, textAlign: "right" }}>Debit (₦)</th>
                    <th style={{ padding: "9px 12px", fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.8, color: "var(--muted)", fontWeight: 700, textAlign: "right" }}>Credit (₦)</th>
                    <th style={{ padding: "9px 12px", fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.8, color: "var(--muted)", fontWeight: 700, textAlign: "right" }}>Running Balance</th>
                    <th style={{ padding: "9px 12px", fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.8, color: "var(--muted)", fontWeight: 700, textAlign: "center" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerData?.lines?.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: "24px", textAlign: "center", color: "var(--muted)" }}>
                        No journal entries posted to this account in the selected date range.
                      </td>
                    </tr>
                  ) : (
                    ledgerData?.lines?.map((line, idx) => (
                      <tr key={line.id || idx} style={{ borderBottom: "1px solid var(--border)", background: idx % 2 === 0 ? "transparent" : "var(--bg)" }}>
                        <td style={{ padding: "9px 12px", whiteSpace: "nowrap" }}>
                          {line.entryDate ? new Date(line.entryDate).toISOString().slice(0, 10) : "—"}
                        </td>
                        <td style={{ padding: "9px 12px" }}>
                          <div style={{ fontWeight: 600 }}>{line.memo || line.journalMemo || "Journal Entry"}</div>
                          <div style={{ fontSize: 11, color: "var(--muted)", display: "flex", gap: 6 }}>
                            <span>Type: {line.sourceType}</span>
                            {line.sourceId && <span>ID: {line.sourceId.slice(0, 8)}...</span>}
                          </div>
                        </td>
                        <td style={{ padding: "9px 12px", textAlign: "right", color: line.debit > 0 ? "#1D6B40" : "var(--muted)", fontWeight: line.debit > 0 ? 600 : 400 }}>
                          {line.debit > 0 ? fmt(line.debit) : "—"}
                        </td>
                        <td style={{ padding: "9px 12px", textAlign: "right", color: line.credit > 0 ? "#B03A2E" : "var(--muted)", fontWeight: line.credit > 0 ? 600 : 400 }}>
                          {line.credit > 0 ? fmt(line.credit) : "—"}
                        </td>
                        <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 700 }}>
                          {fmt(line.runningBalance)}
                        </td>
                        <td style={{ padding: "9px 12px", textAlign: "center" }}>
                          {line.journalEntryId && line.sourceType === "manual" && (
                            <button
                              onClick={() => setReversingEntryId(line.journalEntryId)}
                              style={{ background: "none", border: "none", color: "#BA7517", cursor: "pointer", fontSize: 11, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 3 }}
                              title="Post reversing entry (Ruling 5)"
                            >
                              <RotateCcw size={11} /> Reverse
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 2: TRIAL BALANCE EXPLORER */}
      {activeTab === "trial" && (
        <div>
          <Card style={{ marginBottom: 14, padding: "14px 18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 10.5, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 700, display: "block", marginBottom: 3 }}>
                    As At Date
                  </label>
                  <input
                    type="date"
                    value={asOfDate}
                    onChange={e => setAsOfDate(e.target.value)}
                    style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--panel)", fontSize: 13, color: "var(--text)" }}
                  />
                </div>
              </div>

              <Btn small variant="ghost" onClick={loadTrial} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <RefreshCw size={13} className={loadingTrial ? "spin" : ""} /> Refresh
              </Btn>
            </div>
          </Card>

          {/* Trial Balance Status Pill */}
          {trialData && (
            <div style={{
              marginBottom: 14,
              padding: "12px 16px",
              borderRadius: 10,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: trialData.isBalanced ? "#EAF6EF" : "#FDECEB",
              border: `1px solid ${trialData.isBalanced ? "#BCE3CD" : "#F6B3AF"}`,
              color: trialData.isBalanced ? "#176337" : "#A32D2D"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, fontSize: 13.5 }}>
                {trialData.isBalanced ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                <span>
                  {trialData.isBalanced
                    ? "Trial Balance Verified: Total Debits equal Total Credits (Difference: ₦0.00)"
                    : `Trial Balance Out of Equilibrium by ${fmt(trialData.difference)}`}
                </span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>
                Total: {fmt(trialData.totalDebits)}
              </div>
            </div>
          )}

          {/* Trial Balance Table */}
          <Card style={{ padding: 0, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: "var(--bg)", borderBottom: "1px solid var(--border)", textAlign: "left" }}>
                  <th style={{ padding: "9px 12px", fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.8, color: "var(--muted)", fontWeight: 700 }}>Account Name</th>
                  <th style={{ padding: "9px 12px", fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.8, color: "var(--muted)", fontWeight: 700 }}>Classification</th>
                  <th style={{ padding: "9px 12px", fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.8, color: "var(--muted)", fontWeight: 700, textAlign: "right" }}>Debit (₦)</th>
                  <th style={{ padding: "9px 12px", fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.8, color: "var(--muted)", fontWeight: 700, textAlign: "right" }}>Credit (₦)</th>
                </tr>
              </thead>
              <tbody>
                {trialData?.accounts?.map((acc, idx) => (
                  <tr
                    key={acc.accountCode}
                    onClick={() => { setSelectedAccount(acc.accountCode); setActiveTab("ledger") }}
                    style={{ borderBottom: "1px solid var(--border)", background: idx % 2 === 0 ? "transparent" : "var(--bg)", cursor: "pointer" }}
                    title="Click to view detailed account ledger"
                  >
                    <td style={{ padding: "9px 12px", fontWeight: 600 }}>
                      {acc.accountName}
                    </td>
                    <td style={{ padding: "9px 12px", color: "var(--muted)", fontSize: 11 }}>
                      {acc.classification}
                    </td>
                    <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: acc.debitBalance > 0 ? 600 : 400, color: acc.debitBalance > 0 ? "#1D6B40" : "var(--muted)" }}>
                      {acc.debitBalance > 0 ? fmt(acc.debitBalance) : "—"}
                    </td>
                    <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: acc.creditBalance > 0 ? 600 : 400, color: acc.creditBalance > 0 ? "#B03A2E" : "var(--muted)" }}>
                      {acc.creditBalance > 0 ? fmt(acc.creditBalance) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: "#FEF9EE", fontWeight: 700, borderTop: "2px solid var(--gold)" }}>
                  <td colSpan={2} style={{ padding: "12px 14px", textTransform: "uppercase", fontSize: 12 }}>
                    Total Trial Balance
                  </td>
                  <td style={{ padding: "12px 14px", textAlign: "right", color: "#1D6B40", fontSize: 13.5 }}>
                    {fmt(trialData?.totalDebits || 0)}
                  </td>
                  <td style={{ padding: "12px 14px", textAlign: "right", color: "#B03A2E", fontSize: 13.5 }}>
                    {fmt(trialData?.totalCredits || 0)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </Card>
        </div>
      )}

      {/* MODAL: POST MANUAL JOURNAL ENTRY */}
      {showManualModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "var(--panel)", borderRadius: 12, width: "100%", maxWidth: 650, padding: 22, border: "1px solid var(--border)", boxShadow: "0 8px 30px rgba(0,0,0,0.15)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, fontWeight: 700 }}>
                Post Manual Journal Entry (Double-Entry Balanced)
              </div>
              <button onClick={() => setShowManualModal(false)} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "var(--muted)" }}>×</button>
            </div>

            {manualError && (
              <div style={{ background: "#FDECEB", border: "1px solid #F6B3AF", color: "#A32D2D", padding: "10px 14px", borderRadius: 8, fontSize: 12.5, marginBottom: 14 }}>
                {manualError}
              </div>
            )}

            <form onSubmit={handleSaveManualEntry}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>Entry Date *</label>
                  <input
                    type="date"
                    value={manualDate}
                    onChange={e => setManualDate(e.target.value)}
                    required
                    style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", marginTop: 4, fontSize: 13 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>Memo / Description *</label>
                  <input
                    type="text"
                    value={manualMemo}
                    onChange={e => setManualMemo(e.target.value)}
                    placeholder="e.g. Opening cash balance adjustment"
                    required
                    style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", marginTop: 4, fontSize: 13 }}
                  />
                </div>
              </div>

              <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", fontWeight: 700, marginBottom: 6 }}>
                Journal Lines (Debits must equal Credits)
              </div>

              {manualLines.map((line, idx) => (
                <div key={idx} style={{ display: "grid", gridTemplateColumns: "2.5fr 1fr 1fr 24px", gap: 8, marginBottom: 8, alignItems: "center" }}>
                  <select
                    value={line.accountCode}
                    onChange={e => {
                      const updated = [...manualLines]
                      updated[idx].accountCode = e.target.value
                      setManualLines(updated)
                    }}
                    style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", fontSize: 12.5 }}
                  >
                    {accounts.map(a => (
                      <option key={a.accountCode} value={a.accountCode}>
                        {a.accountName}
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    placeholder="Debit"
                    value={line.debit}
                    onChange={e => {
                      const updated = [...manualLines]
                      updated[idx].debit = e.target.value
                      if (e.target.value) updated[idx].credit = ""
                      setManualLines(updated)
                    }}
                    style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", fontSize: 12.5, textAlign: "right" }}
                  />

                  <input
                    type="number"
                    placeholder="Credit"
                    value={line.credit}
                    onChange={e => {
                      const updated = [...manualLines]
                      updated[idx].credit = e.target.value
                      if (e.target.value) updated[idx].debit = ""
                      setManualLines(updated)
                    }}
                    style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", fontSize: 12.5, textAlign: "right" }}
                  />

                  {manualLines.length > 2 && (
                    <button
                      type="button"
                      onClick={() => setManualLines(manualLines.filter((_, i) => i !== idx))}
                      style={{ background: "none", border: "none", color: "#B03A2E", cursor: "pointer", fontSize: 14, fontWeight: 700 }}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setManualLines([...manualLines, { accountCode: "6000", debit: "", credit: "", memo: "" }])}
                  style={{ background: "none", border: "none", color: "var(--gold)", cursor: "pointer", fontSize: 12, fontWeight: 600 }}
                >
                  + Add Line
                </button>

                <div style={{ fontSize: 12, fontWeight: 600 }}>
                  <span>Debits: ₦{manualLines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0).toLocaleString()}</span>
                  <span style={{ margin: "0 8px" }}>|</span>
                  <span>Credits: ₦{manualLines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0).toLocaleString()}</span>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
                <Btn variant="ghost" onClick={() => setShowManualModal(false)}>Cancel</Btn>
                <Btn type="submit" variant="primary" disabled={submittingManual}>
                  {submittingManual ? "Posting..." : "Post Entry to Ledger"}
                </Btn>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REVERSE POSTED ENTRY (Ruling 5) */}
      {reversingEntryId && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "var(--panel)", borderRadius: 12, width: "100%", maxWidth: 480, padding: 22, border: "1px solid var(--border)" }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 700, marginBottom: 8, color: "#BA7517" }}>
              Confirm Journal Entry Reversal (Ruling 5)
            </div>
            <div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.6, marginBottom: 14 }}>
              Per General Ledger immutability principles, posted entries are never modified or deleted. LayerLedger will create an equal and opposite mirror reversing journal entry to neutralize this transaction.
            </div>

            <label style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>
              Reason for Reversal *
            </label>
            <input
              type="text"
              value={reversalReason}
              onChange={e => setReversalReason(e.target.value)}
              placeholder="e.g. Error in amount or client cancelled transaction"
              style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", marginTop: 4, marginBottom: 16, fontSize: 13 }}
            />

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <Btn variant="ghost" onClick={() => setReversingEntryId(null)}>Cancel</Btn>
              <Btn variant="danger" onClick={handleExecuteReversal} disabled={submittingReversal}>
                {submittingReversal ? "Reversing..." : "Execute Mirror Reversal"}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
