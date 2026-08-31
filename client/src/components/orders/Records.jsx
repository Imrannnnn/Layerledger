/**
 * Records.jsx
 * ----------------------------------------------------------------------------
 * Order History screen: lists and filters all confirmed orders.
 * ----------------------------------------------------------------------------
 */
import React, { useState, useEffect, useMemo } from "react"
import { Btn, Card, Badge, SHead, Tabs, TH, TR2, iSt, Pagination } from "../common/ui.jsx"
import { fmt } from "../../lib/helpers.js"
import { updateProdStatus } from "../../lib/data.js"

export function Records({ productions, setProductions, setView, setPrefillProd, user }) {
  const [clientSearch, setClientSearch] = useState("")
  const [productType, setProductType] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  useEffect(() => {
    setCurrentPage(1)
  }, [clientSearch, productType, statusFilter, startDate, endDate])

  const isOwner = user?.role === "owner"


  // Filter confirmed orders
  const filtered = productions.filter(p => {
    // Exclude cancelled quotes
    if ((p.status || "").toLowerCase() === "cancelled") return false

    // Client name search
    if (clientSearch && !p.client?.toLowerCase().includes(clientSearch.toLowerCase())) return false

    // Product type filter
    if (productType !== "all" && p.productType !== productType) return false

    // Status filter
    if (statusFilter !== "all" && (p.status || "pending").toLowerCase() !== statusFilter.toLowerCase()) return false

    // Date range filter
    if (startDate && p.deliveryDate && p.deliveryDate < startDate) return false
    if (endDate && p.deliveryDate && p.deliveryDate > endDate) return false

    return true
  }).sort((a, b) => (b.deliveryDate || "").localeCompare(a.deliveryDate || ""))

  const handleMarkDelivered = async (id) => {
    setProductions(prev => prev.map(x => x.id === id ? { ...x, status: "delivered" } : x))
    await updateProdStatus(id, "delivered")
  }

  // Financial summary of filtered orders
  const revenue = filtered
    .filter(p => p.paymentType !== "gift" && p.paymentType !== "sample")
    .reduce((sum, p) => sum + (p.salePrice || 0), 0)

  const cost = filtered.reduce((sum, p) => sum + (p.cost || 0) + (p.deliveryCost || 0), 0)
  const profit = revenue - cost

  const paginated = useMemo(() => {
    if (pageSize === "all") return filtered
    const sz = Number(pageSize) || 25
    const start = (currentPage - 1) * sz
    return filtered.slice(start, start + sz)
  }, [filtered, currentPage, pageSize])


  return (
    <div>
      <SHead title="Order History" sub={`${productions.length} total confirmed orders`} />

      {/* Advanced Filter Bar */}
      <Card style={{ marginBottom: 16, padding: "14px 16px" }}>
        <div style={{ fontSize: 11.5, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 600, marginBottom: 10 }}>Filter Orders</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
          {/* Client Search */}
          <div>
            <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4 }}>Client Name / Search</label>
            <input
              value={clientSearch}
              onChange={e => setClientSearch(e.target.value)}
              placeholder="Search client..."
              style={{ ...iSt, padding: "6px 10px", fontSize: 12.5 }}
            />
          </div>

          {/* Product Type Dropdown */}
          <div>
            <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4 }}>Product Type</label>
            <select
              value={productType}
              onChange={e => setProductType(e.target.value)}
              style={{ ...iSt, padding: "6px 10px", fontSize: 12.5 }}
            >
              <option value="all">All Products</option>
              <option value="Cake">Cake</option>
              <option value="Cupcakes">Cupcakes</option>
              <option value="Donuts">Donuts</option>
              <option value="Cake Loaf">Cake Loaf</option>
              <option value="Tarts / Pastry">Tarts / Pastry</option>
            </select>
          </div>

          {/* Status Dropdown */}
          <div>
            <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4 }}>Status</label>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              style={{ ...iSt, padding: "6px 10px", fontSize: 12.5 }}
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="in progress">In Progress</option>
              <option value="ready">Ready</option>
              <option value="delivered">Delivered</option>
            </select>
          </div>

          {/* Date range inputs */}
          <div>
            <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4 }}>Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              style={{ ...iSt, padding: "5px 8px", fontSize: 12.5 }}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4 }}>End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              style={{ ...iSt, padding: "5px 8px", fontSize: 12.5 }}
            />
          </div>
        </div>
      </Card>

      {/* Main Table */}
      <Card style={{ padding: 0, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <TH cols={["Date", "Client Name", "Product Summary", "Sale Price", "Ingredient Cost", "Payment Type", "Status", "Actions"]} />
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>
                  No historical orders match the selected filters.
                </td>
              </tr>
            ) : (
              paginated.map((p, i) => {
                const summaryText = p.cakeSummary || p.productType || `${p.size || ""} ${p.covering || ""}`
                const isDelivered = (p.status || "").toLowerCase() === "delivered"
                
                return (
                  <TR2
                    key={p.id}
                    i={i}
                    row={[
                      <span style={{ color: "var(--muted)", fontSize: 12 }}>{p.deliveryDate || "Unscheduled"}</span>,
                      <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text)" }}>{p.client || "—"}</span>,
                      <span style={{ fontSize: 12.5, color: "var(--text)" }}>{summaryText}</span>,
                      <span style={{ color: "var(--gold)", fontWeight: 600, fontSize: 13 }}>{fmt(p.salePrice)}</span>,
                      <span style={{ color: "var(--muted)", fontSize: 13 }}>{fmt(p.cost)}</span>,
                      <Badge color={{ full: "green", gift: "purple", sample: "blue", discount: "gold", deposit: "blue" }[p.paymentType] || "gray"}>
                        {p.paymentType}
                      </Badge>,
                      <Badge color={isDelivered ? "green" : "gold"}>{p.status || "pending"}</Badge>,
                      <div style={{ display: "flex", gap: 4 }}>
                        {!isDelivered && (
                          <Btn small variant="success" onClick={() => handleMarkDelivered(p.id)}>
                            ✓ Mark Delivered
                          </Btn>
                        )}
                      </div>
                    ]}
                  />
                )
              })
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
        itemLabel="orders"
      />


      {/* Summary Stats Row */}
      {isOwner && filtered.length > 0 && (
        <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
          {[
            { label: "Total Orders Shown", val: filtered.length, color: "var(--text)" },
            { label: "Revenue (excl. samples)", val: fmt(revenue), color: "var(--gold)" },
            { label: "Total Cost", val: fmt(cost), color: "#B03A2E" },
            { label: "Net Profit", val: fmt(profit), color: "#2D7A50" }
          ].map(s => (
            <Card key={s.label} style={{ padding: "12px 14px" }}>
              <div style={{ fontSize: 9.5, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 600, marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: s.color }}>{s.val}</div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
