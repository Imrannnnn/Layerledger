import React, { useState, useMemo, useEffect } from "react"
import { Btn, Inp, Card, SHead, Modal, Pagination, Spinner } from "../common/ui.jsx"
import {
  loadClients,
  saveClients,
  deleteClient,
  fetchPaginatedClients,
  createClientOnServer,
  updateClientOnServer
} from "../../lib/data.js"
import { Users, Search, MessageCircle, MapPin, Calculator, Pencil, Trash2, AlertTriangle, Plus, Cake, Heart, CalendarHeart } from "lucide-react"
import { MONTHS, SPECIAL_DATE_TYPES, parseSpecialDate, formatSpecialDate } from "../../lib/helpers.js"

export function Clients({ setView, company = {} }) {
  const initialData = (typeof loadClients === "function" ? loadClients() : []) || []
  const [clients, setClients] = useState(initialData)
  const [totalCount, setTotalCount] = useState(initialData.length)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [loading, setLoading] = useState(false)

  const currentMonthName = useMemo(() => new Date().toLocaleString("en-US", { month: "long" }), [])

  const [stats, setStats] = useState(() => ({
    totalClients: initialData.length,
    totalWithPhone: initialData.filter(c => !!c.phone).length,
    birthdaysThisMonth: initialData.filter(c => c.birthday && c.birthday.toLowerCase().includes(currentMonthName.toLowerCase())).length
  }))

  // Modal states
  const [modalOpen, setModalOpen] = useState(false)
  const [editingClient, setEditingClient] = useState(null)
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    birthday: "",
    notes: ""
  })
  const [errorMsg, setErrorMsg] = useState("")
  const [saving, setSaving] = useState(false)

  // Debounce search input to avoid spamming the backend
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setCurrentPage(1)
    }, 250)
    return () => clearTimeout(timer)
  }, [search])

  // Fetch paginated slice directly from server/database
  const loadPage = async () => {
    if (typeof fetchPaginatedClients !== "function") return
    setLoading(true)
    try {
      const res = await fetchPaginatedClients({
        page: currentPage,
        limit: pageSize,
        search: debouncedSearch
      })
      if (res && res.data) {
        setClients(res.data)
        setTotalCount(res.pagination?.total ?? res.total ?? res.data.length)
        if (res.stats) {
          setStats(res.stats)
        } else {
          setStats({
            totalClients: res.pagination?.total ?? res.data.length,
            totalWithPhone: res.data.filter(c => !!c.phone).length,
            birthdaysThisMonth: res.data.filter(c => c.birthday && c.birthday.toLowerCase().includes(currentMonthName.toLowerCase())).length
          })
        }
      }
    } catch (err) {
      console.warn("fetchPaginatedClients failed, falling back to local:", err)
      const all = (typeof loadClients === "function" ? loadClients() : []) || []
      setClients(all)
      setTotalCount(all.length)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPage()
  }, [currentPage, pageSize, debouncedSearch])

  // Paginated clients slice is directly what the server returned for this page
  const paginatedClients = clients

  const openAddModal = () => {
    setEditingClient(null)
    setFormData({ name: "", phone: "", email: "", address: "", birthday: "", notes: "" })
    setErrorMsg("")
    setModalOpen(true)
  }

  const openEditModal = (client) => {
    setEditingClient(client)
    setFormData({
      name: client.name || "",
      phone: client.phone || "",
      email: client.email || "",
      address: client.address || "",
      birthday: client.birthday || "",
      notes: client.notes || ""
    })
    setErrorMsg("")
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setErrorMsg("Client name is required")
      return
    }
    setSaving(true)
    setErrorMsg("")
    try {
      const spec = parseSpecialDate(formData.birthday)
      const cleanBirthday = spec.formatted ? `${spec.type}: ${spec.formatted}` : ""

      if (editingClient) {
        if (typeof updateClientOnServer === "function" && editingClient.id && !editingClient.id.startsWith("cl_")) {
          try {
            await updateClientOnServer(editingClient.id, {
              name: formData.name.trim(),
              phone: formData.phone || "",
              email: formData.email || "",
              address: formData.address || "",
              birthday: cleanBirthday,
              notes: formData.notes || ""
            })
          } catch {}
        }
        const updated = clients.map(c =>
          c.id === editingClient.id
            ? { ...c, ...formData, name: formData.name.trim(), birthday: cleanBirthday }
            : c
        )
        setClients(updated)
        await saveClients(updated)
      } else {
        let created = null
        if (typeof createClientOnServer === "function") {
          try {
            created = await createClientOnServer({
              name: formData.name.trim(),
              phone: formData.phone || "",
              email: formData.email || "",
              address: formData.address || "",
              birthday: cleanBirthday,
              notes: formData.notes || ""
            })
          } catch {}
        }
        const newClient = created || {
          id: "cl_" + Date.now(),
          ...formData,
          name: formData.name.trim(),
          birthday: cleanBirthday,
          createdAt: new Date().toISOString(),
          lastOrder: "",
          ordersCount: 0
        }
        const updated = [newClient, ...clients]
        setClients(updated)
        await saveClients(updated)
      }
      setModalOpen(false)
      await loadPage()
    } catch (err) {
      setErrorMsg("Failed to save client: " + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (client) => {
    const confirmed = window.confirm(`Are you sure you want to delete "${client.name}" from your clients directory?`)
    if (!confirmed) return
    try {
      await deleteClient(client.id)
      const updated = clients.filter(c => c.id !== client.id)
      setClients(updated)
      await loadPage()
    } catch (err) {
      alert("Failed to delete client: " + err.message)
    }
  }

  const startQuoteForClient = (client) => {
    sessionStorage.setItem("ll_calc_prefill", JSON.stringify({
      clientName: client.name,
      clientPhone: client.phone,
      clientBirthday: client.birthday || "",
      clientNotes: client.notes || client.address || ""
    }))
    if (setView) setView("calculator")
  }

  // Summary stats (using server aggregate stats with local fallback)
  const totalClientsCount = stats.totalClients || totalCount || clients.length
  const totalWithPhoneCount = stats.totalWithPhone ?? clients.filter(c => !!c.phone).length
  const activeThisMonth = useMemo(() => {
    const currentMonthPrefix = new Date().toISOString().slice(0, 7)
    return clients.filter(c => c.lastOrder && c.lastOrder.startsWith(currentMonthPrefix)).length
  }, [clients])

  const birthdaysThisMonthCount = stats.birthdaysThisMonth ?? clients.filter(c => c.birthday && c.birthday.toLowerCase().includes(currentMonthName.toLowerCase())).length

  return (
    <div>
      <SHead
        title="Clients Directory"
        sub="Manage customer details, view order histories, and auto-fill client records into orders."
      />

      {/* STAT SUMMARY CARDS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginBottom: 16 }}>
        <Card style={{ padding: "14px 16px" }}>
          <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>
            Total Clients
          </div>
          <div style={{ fontSize: 24, fontWeight: 600, color: "var(--text)" }}>{totalClientsCount}</div>
        </Card>
        <Card style={{ padding: "14px 16px" }}>
          <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>
            WhatsApp Contacts
          </div>
          <div style={{ fontSize: 24, fontWeight: 600, color: "#25D366" }}>{totalWithPhoneCount}</div>
        </Card>
        <Card style={{ padding: "14px 16px" }}>
          <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>
            Special Dates This Month
          </div>
          <div style={{ fontSize: 24, fontWeight: 600, color: "var(--gold)", display: "flex", alignItems: "center", gap: 8 }}>
            <CalendarHeart size={22} style={{ color: "var(--gold)" }} />
            <span>{birthdaysThisMonthCount}</span>
          </div>
          <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 2 }}>In {currentMonthName} (Birthdays &amp; Anniv.)</div>
        </Card>
        <Card style={{ padding: "14px 16px" }}>
          <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>
            Active This Month
          </div>
          <div style={{ fontSize: 24, fontWeight: 600, color: "var(--text)" }}>{activeThisMonth}</div>
        </Card>
      </div>

      {/* TOP CONTROLS */}
      <Card style={{ marginBottom: 16, padding: "14px 16px" }}>
        <div style={{ display: "flex", gap: 12, justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 240, maxWidth: 420, position: "relative" }}>
            <Search size={15} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
            <input
              type="text"
              placeholder="Search clients by name, phone, email, or notes..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px 8px 32px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "#FAF7F0",
                fontSize: 13,
                outline: "none"
              }}
            />
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Btn onClick={openAddModal}><Plus size={14} /> Add Client</Btn>
          </div>
        </div>
      </Card>

      {/* CLIENTS TABLE */}
      <Card style={{ padding: 0, overflow: "hidden", position: "relative" }}>
        {loading && clients.length === 0 ? (
          <div style={{ padding: "60px 20px", textAlign: "center", display: "flex", justifyContent: "center", alignItems: "center" }}>
            <Spinner />
          </div>
        ) : clients.length === 0 ? (
          <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--muted)" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 10, color: "var(--muted)" }}>
              <Users size={36} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 6 }}>
              {search ? "No clients match your search" : "No clients saved yet"}
            </div>
            <div style={{ fontSize: 13, marginBottom: 14 }}>
              {search ? "Try searching for a different name or phone number." : "Add clients here or create a quote/order to save clients automatically."}
            </div>
            {!search && <Btn onClick={openAddModal}><Plus size={14} /> Add First Client</Btn>}
          </div>
        ) : (
          <div style={{ overflowX: "auto", opacity: loading ? 0.6 : 1, transition: "opacity 0.2s" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "rgba(200,145,42,0.08)", borderBottom: "1px solid var(--border)", textAlign: "left" }}>
                  <th style={{ padding: "12px 16px", fontWeight: 600, color: "var(--text)" }}>Client</th>
                  <th style={{ padding: "12px 16px", fontWeight: 600, color: "var(--text)" }}>Phone / WhatsApp</th>
                  <th style={{ padding: "12px 16px", fontWeight: 600, color: "var(--text)" }}>Email & Address</th>
                  <th style={{ padding: "12px 16px", fontWeight: 600, color: "var(--text)" }}>Notes / Preferences</th>
                  <th style={{ padding: "12px 16px", fontWeight: 600, color: "var(--text)" }}>Orders / Last Active</th>
                  <th style={{ padding: "12px 16px", fontWeight: 600, color: "var(--text)", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedClients.map((client, idx) => {
                  const rawPhone = (client.phone || "").replace(/[^0-9]/g, "")
                  const waNumber = rawPhone.startsWith("0") ? "234" + rawPhone.slice(1) : rawPhone
                  const initials = (client.name || "C")
                    .split(" ")
                    .filter(Boolean)
                    .slice(0, 2)
                    .map(n => n[0].toUpperCase())
                    .join("")

                  return (
                    <tr
                      key={client.id || idx}
                      style={{
                        borderBottom: "1px solid var(--border)",
                        background: idx % 2 === 0 ? "transparent" : "rgba(250,247,240,0.5)",
                        transition: "background 0.15s"
                      }}
                    >
                      {/* Name with avatar */}
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: "50%",
                              background: "var(--gold)",
                              color: "#fff",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: 600,
                              fontSize: 12,
                              flexShrink: 0
                            }}
                          >
                            {initials}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: "var(--text)", fontSize: 13.5 }}>{client.name}</div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
                              {client.birthday && (() => {
                                const spec = parseSpecialDate(client.birthday)
                                if (!spec.formatted) return null
                                const isAnniv = spec.type === "Anniversary"
                                return (
                                  <span
                                    style={{
                                      fontSize: 10.5,
                                      color: isAnniv ? "#7A1FA2" : "#995C00",
                                      background: isAnniv ? "#F3E5F5" : "#FFF4DC",
                                      border: `1px solid ${isAnniv ? "#E1BEE7" : "#FFE0A3"}`,
                                      padding: "1px 6px",
                                      borderRadius: 10,
                                      fontWeight: 600,
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: 4
                                    }}
                                    title={`${spec.type}: ${spec.formatted}`}
                                  >
                                    {isAnniv ? <Heart size={11} /> : <Cake size={11} />}
                                    <span>{spec.type}: {spec.formatted}</span>
                                  </span>
                                )
                              })()}
                              {client.createdAt && (
                                <div style={{ fontSize: 11, color: "var(--muted)" }}>
                                  Added {client.createdAt.slice(0, 10)}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Phone / WhatsApp */}
                      <td style={{ padding: "12px 16px" }}>
                        {client.phone ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontFamily: "monospace", fontSize: 12.5 }}>{client.phone}</span>
                            <button
                              title="Chat on WhatsApp"
                              onClick={() => window.open(`https://wa.me/${waNumber}?text=${encodeURIComponent(`Hello ${client.name}! Greetings from ${company.name || "our bakery"}.`)}`, "_blank")}
                              style={{
                                background: "#25D366",
                                color: "#fff",
                                border: "none",
                                borderRadius: 12,
                                padding: "2px 8px",
                                fontSize: 11,
                                fontWeight: 600,
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4
                              }}
                            >
                              <MessageCircle size={11} /> WA
                            </button>
                          </div>
                        ) : (
                          <span style={{ color: "var(--muted)", fontStyle: "italic", fontSize: 12 }}>None</span>
                        )}
                      </td>

                      {/* Email & Address */}
                      <td style={{ padding: "12px 16px" }}>
                        {client.email && <div style={{ fontSize: 12, color: "var(--text)" }}>{client.email}</div>}
                        {client.address && (
                          <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2, display: "flex", alignItems: "center", gap: 3 }}>
                            <MapPin size={11} style={{ flexShrink: 0 }} /> {client.address}
                          </div>
                        )}
                        {!client.email && !client.address && (
                          <span style={{ color: "var(--muted)", fontStyle: "italic", fontSize: 12 }}>—</span>
                        )}
                      </td>

                      {/* Notes / Preferences */}
                      <td style={{ padding: "12px 16px", maxWidth: 220 }}>
                        {client.notes ? (
                          <div style={{ fontSize: 12, color: "var(--text)", whiteSpace: "normal", wordBreak: "break-word" }}>
                            {client.notes}
                          </div>
                        ) : (
                          <span style={{ color: "var(--muted)", fontStyle: "italic", fontSize: 12 }}>No notes</span>
                        )}
                      </td>

                      {/* Orders Count & Last Order */}
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ fontWeight: 500 }}>
                          {client.ordersCount || 0} order{client.ordersCount !== 1 ? "s" : ""}
                        </div>
                        {client.lastOrder && (
                          <div style={{ fontSize: 11, color: "var(--muted)" }}>
                            Last: {client.lastOrder}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: "12px 16px", textAlign: "right" }}>
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                          <Btn
                            small
                            variant="outline"
                            onClick={() => startQuoteForClient(client)}
                            title="Start a new quote for this client"
                            style={{ fontSize: 11.5 }}
                          >
                            <Calculator size={12} /> Quote
                          </Btn>
                          <Btn
                            small
                            variant="ghost"
                            onClick={() => openEditModal(client)}
                            title="Edit client details"
                            style={{ fontSize: 11.5 }}
                          >
                            <Pencil size={12} /> Edit
                          </Btn>
                          <Btn
                            small
                            variant="ghost"
                            onClick={() => handleDelete(client)}
                            title="Delete client"
                            style={{ color: "#B03A2E", fontSize: 11.5 }}
                          >
                            <Trash2 size={12} />
                          </Btn>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* PAGINATION */}
        <Pagination
          currentPage={currentPage}
          totalItems={totalCount}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={sz => {
            setPageSize(sz)
            setCurrentPage(1)
          }}
          pageSizeOptions={[10, 25, 50, 100, "all"]}
          itemLabel="clients"
        />
      </Card>

      {/* ADD / EDIT MODAL */}
      {modalOpen && (
        <Modal
          title={editingClient ? `Edit Client: ${editingClient.name}` : "Add New Client"}
          onClose={() => setModalOpen(false)}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Inp
              label="Client Name *"
              value={formData.name}
              onChange={v => setFormData(p => ({ ...p, name: v }))}
              placeholder="e.g. Mrs. Folake Ade"
            />
            <Inp
              label="Phone / WhatsApp"
              value={formData.phone}
              onChange={v => setFormData(p => ({ ...p, phone: v }))}
              placeholder="e.g. 0803 123 4567"
            />
            <Inp
              label="Email Address"
              value={formData.email}
              onChange={v => setFormData(p => ({ ...p, email: v }))}
              placeholder="e.g. folake@example.com"
            />
            <Inp
              label="Delivery / Residential Address"
              value={formData.address}
              onChange={v => setFormData(p => ({ ...p, address: v }))}
              placeholder="e.g. 14 Admiralty Way, Lekki Phase 1, Lagos"
            />

            {/* Special Date (Birthday / Anniversary — Date & Month only — no year) */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--muted)" }}>
                  Special Date (Birthday or Anniversary)
                </label>
                {formData.birthday && (
                  <button
                    type="button"
                    onClick={() => setFormData(p => ({ ...p, birthday: "" }))}
                    style={{ background: "none", border: "none", color: "#B03A2E", fontSize: 11, cursor: "pointer", textDecoration: "underline", padding: 0 }}
                  >
                    Clear Date
                  </button>
                )}
              </div>

              {(() => {
                const spec = parseSpecialDate(formData.birthday)
                const curType = spec.type || "Birthday"
                const curMonth = spec.month || ""
                const curDay = spec.day || ""

                const handleTypeChange = (newType) => {
                  const updated = formatSpecialDate(newType, curDay, curMonth)
                  setFormData(p => ({ ...p, birthday: updated }))
                }

                const handleMonthChange = (newMonth) => {
                  const updated = formatSpecialDate(curType, curDay, newMonth)
                  setFormData(p => ({ ...p, birthday: updated }))
                }

                const handleDayChange = (newDay) => {
                  const updated = formatSpecialDate(curType, newDay, curMonth)
                  setFormData(p => ({ ...p, birthday: updated }))
                }

                return (
                  <div>
                    {/* Occasion Type Selector: Birthday vs Anniversary */}
                    <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                      {SPECIAL_DATE_TYPES.map(t => {
                        const active = curType === t.value
                        return (
                          <button
                            key={t.value}
                            type="button"
                            onClick={() => handleTypeChange(t.value)}
                            style={{
                              flex: 1,
                              padding: "7px 12px",
                              borderRadius: 8,
                              border: active ? "1.5px solid var(--gold)" : "1px solid var(--border)",
                              background: active ? "rgba(200,145,42,0.12)" : "var(--panel)",
                              color: active ? "var(--text)" : "var(--muted)",
                              fontWeight: active ? 600 : 500,
                              fontSize: 12.5,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 6,
                              transition: "all 0.15s"
                            }}
                          >
                            {t.value === "Anniversary" ? <Heart size={14} /> : <Cake size={14} />}
                            <span>{t.label}</span>
                          </button>
                        )
                      })}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 8 }}>
                      <select
                        value={curMonth}
                        onChange={e => handleMonthChange(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "8px 10px",
                          borderRadius: 8,
                          border: "1px solid var(--border)",
                          background: "var(--panel)",
                          color: "var(--text)",
                          fontFamily: "inherit",
                          fontSize: 13
                        }}
                      >
                        <option value="">— Select Month —</option>
                        {MONTHS.map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                      <select
                        value={curDay}
                        onChange={e => handleDayChange(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "8px 10px",
                          borderRadius: 8,
                          border: "1px solid var(--border)",
                          background: "var(--panel)",
                          color: "var(--text)",
                          fontFamily: "inherit",
                          fontSize: 13
                        }}
                      >
                        <option value="">— Day —</option>
                        {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>

                    {spec.formatted && (
                      <div style={{ fontSize: 11.5, color: curType === "Anniversary" ? "#7A1FA2" : "var(--gold)", fontWeight: 600, marginTop: 6, display: "flex", alignItems: "center", gap: 5 }}>
                        {curType === "Anniversary" ? <Heart size={13} /> : <Cake size={13} />}
                        <span>{curType}: <b>{spec.formatted}</b></span>
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>

            <Inp
              label="Notes & Preferences (Allergies, favorite flavours, etc.)"
              value={formData.notes}
              onChange={v => setFormData(p => ({ ...p, notes: v }))}
              placeholder="e.g. Likes less sugar, loves red velvet, allergic to nuts"
            />

            {errorMsg && (
              <div style={{ color: "#B03A2E", fontSize: 12, fontWeight: 500, display: "flex", alignItems: "center", gap: 5 }}>
                <AlertTriangle size={13} style={{ flexShrink: 0 }} /> {errorMsg}
              </div>
            )}

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
              <Btn variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Btn>
              <Btn onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : (editingClient ? "Save Changes" : "Create Client")}
              </Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
