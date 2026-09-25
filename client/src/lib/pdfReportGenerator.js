/**
 * pdfReportGenerator.js
 * ----------------------------------------------------------------------------
 * Centralized PDF report & backup generator for BakeWealth (LayerLedger).
 * Generates beautifully formatted, print-optimized documents for all data lists
 * and reports with company branding, totals, and crisp vector printing.
 * ----------------------------------------------------------------------------
 */
import { fmt, formatDateDMY, mapCategory } from "./helpers.js"

/**
 * Opens a print window and writes a styled HTML document that automatically
 * triggers the browser's print / Save to PDF dialog.
 */
export function printHtmlDocument({ title, contentHtml, company = {}, subtitle = "" }) {
  const gold = company?.primaryColor || "#C8912A"
  const w = window.open("", "_blank")
  if (!w) {
    alert("Popup blocked! Please allow popups for this site to download the PDF backup.")
    return
  }

  const generatedDate = new Date().toLocaleDateString("en-NG", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  })

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page {
      size: A4;
      margin: 12mm 15mm;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #291608;
      background: #fff;
      padding: 24px;
      max-width: 900px;
      margin: 0 auto;
      font-size: 12px;
      line-height: 1.45;
    }
    .header-container {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid ${gold};
      padding-bottom: 14px;
      margin-bottom: 18px;
    }
    .brand-section {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .brand-logo {
      height: 52px;
      max-width: 120px;
      object-fit: contain;
      border-radius: 4px;
    }
    .biz-name {
      font-size: 20px;
      font-weight: 700;
      color: ${gold};
      letter-spacing: -0.3px;
    }
    .biz-sub {
      font-size: 11px;
      color: #666;
      margin-top: 2px;
    }
    .doc-meta {
      text-align: right;
    }
    .doc-title {
      font-size: 18px;
      font-weight: 700;
      color: #222;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .doc-subtitle {
      font-size: 11.5px;
      color: #777;
      margin-top: 3px;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
      gap: 10px;
      margin-bottom: 18px;
    }
    .summary-card {
      border: 1px solid #E2D7C5;
      background: #FDFBF7;
      border-radius: 6px;
      padding: 10px 12px;
    }
    .summary-label {
      font-size: 9.5px;
      text-transform: uppercase;
      letter-spacing: 0.7px;
      color: #777;
      margin-bottom: 3px;
      font-weight: 600;
    }
    .summary-val {
      font-size: 16px;
      font-weight: 700;
      color: ${gold};
    }
    .summary-sub {
      font-size: 10px;
      color: #888;
      margin-top: 2px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 12px 0 20px;
    }
    th {
      background: #F4EFE6;
      color: #555;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      padding: 8px 10px;
      text-align: left;
      font-weight: 700;
      border-top: 1px solid #E2D7C5;
      border-bottom: 1.5px solid #D5C7B0;
    }
    td {
      padding: 7px 10px;
      border-bottom: 1px solid #EAE4D9;
      font-size: 11.5px;
      vertical-align: middle;
    }
    tr:nth-child(even) td {
      background: #FAF7F2;
    }
    .right {
      text-align: right;
    }
    .center {
      text-align: center;
    }
    .bold {
      font-weight: 700;
    }
    .badge {
      display: inline-block;
      padding: 2px 7px;
      border-radius: 12px;
      font-size: 9.5px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .badge-green { background: #E5F4EC; color: #2D7A50; }
    .badge-amber { background: #FDF2DC; color: #BA7517; }
    .badge-red { background: #FDEBE9; color: #B03A2E; }
    .badge-blue { background: #E8EFFC; color: #185FA5; }
    .total-row {
      background: #F2ECE0 !important;
      font-weight: 700;
      border-top: 2px solid #D5C7B0;
      border-bottom: 2px solid #D5C7B0;
    }
    .footer {
      margin-top: 24px;
      padding-top: 10px;
      border-top: 1px solid #EAE4D9;
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      color: #999;
    }
    @media print {
      body { padding: 0; }
      button, .no-print { display: none !important; }
      tr { page-break-inside: avoid; }
      .summary-card { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header-container">
    <div class="brand-section">
      ${(company?.logo || "/Bakewealthlogo.jpeg") ? `<img src="${company?.logo || "/Bakewealthlogo.jpeg"}" class="brand-logo" alt="Logo"/>` : ""}
      <div>
        <div class="biz-name">${company?.name || "BakeWealth Bakery"}</div>
        <div class="biz-sub">
          ${company?.phone ? `Tel: ${company.phone} · ` : ""}
          ${company?.email ? `Email: ${company.email} · ` : ""}
          ${company?.address || company?.tagline || "Bakery Management & Accounting System"}
        </div>
      </div>
    </div>
    <div class="doc-meta">
      <div class="doc-title">${title}</div>
      <div class="doc-subtitle">${subtitle || "Official Backup Record"}</div>
    </div>
  </div>

  ${contentHtml}

  <div class="footer">
    <span>Generated by BakeWealth Accounting · ${generatedDate}</span>
    <span>Confidential Business Record · Page 1</span>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 250);
    };
  </script>
</body>
</html>`

  w.document.open()
  w.document.write(html)
  w.document.close()
}

/**
 * 1. INVENTORY MASTER LIST PDF EXPORT
 */
export function exportInventoryPDF(inventory = [], company = {}) {
  const totalItems = inventory.length
  const totalValuation = inventory.reduce((sum, item) => sum + ((Number(item.stock) || 0) * (Number(item.cost) || 0)), 0)
  const lowStockCount = inventory.filter(i => (Number(i.stock) || 0) <= (i.minStock !== undefined && i.minStock !== null && i.minStock !== "" && !isNaN(Number(i.minStock)) ? Number(i.minStock) : 5)).length
  const outOfStockCount = inventory.filter(i => (Number(i.stock) || 0) === 0).length
  const wellStockedCount = totalItems - lowStockCount

  // Sort by category then name
  const sorted = [...inventory].sort((a, b) => {
    const catA = (a.cat || a.category || "General").toLowerCase()
    const catB = (b.cat || b.category || "General").toLowerCase()
    if (catA !== catB) return catA.localeCompare(catB)
    return (a.name || "").localeCompare(b.name || "")
  })

  const contentHtml = `
    <div class="summary-grid">
      <div class="summary-card">
        <div class="summary-label">Total Inventory Items</div>
        <div class="summary-val">${totalItems}</div>
        <div class="summary-sub">${wellStockedCount} in stock</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Total Stock Valuation</div>
        <div class="summary-val">${fmt(totalValuation)}</div>
        <div class="summary-sub">Asset value on hand</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Low Stock Alerts</div>
        <div class="summary-val" style="color: ${lowStockCount > 0 ? '#B03A2E' : '#2D7A50'}">${lowStockCount}</div>
        <div class="summary-sub">${outOfStockCount} out of stock</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width: 30px;">#</th>
          <th>Item Name</th>
          <th>Category</th>
          <th>Unit</th>
          <th class="right">Current Stock</th>
          <th class="right">Min Level</th>
          <th class="right">Unit Cost</th>
          <th class="right">Total Value</th>
          <th class="center" style="width: 85px;">Status</th>
        </tr>
      </thead>
      <tbody>
        ${sorted.map((item, idx) => {
          const stock = Number(item.stock) || 0
          const minStock = item.minStock !== undefined && item.minStock !== null && item.minStock !== "" && !isNaN(Number(item.minStock)) ? Number(item.minStock) : 5
          const cost = Number(item.cost) || 0
          const val = stock * cost
          let statusBadge = `<span class="badge badge-green">In Stock</span>`
          if (stock === 0) {
            statusBadge = `<span class="badge badge-red">Out of Stock</span>`
          } else if (stock <= minStock) {
            statusBadge = `<span class="badge badge-amber">Low Stock</span>`
          }

          return `
            <tr>
              <td style="color: #888;">${idx + 1}</td>
              <td class="bold">${item.name || "—"}</td>
              <td>${mapCategory(item.cat, item.name)}</td>
              <td>${item.unit || "kg"}</td>
              <td class="right bold">${stock.toLocaleString()}</td>
              <td class="right" style="color: #777;">${minStock}</td>
              <td class="right">${fmt(cost)}</td>
              <td class="right bold">${fmt(val)}</td>
              <td class="center">${statusBadge}</td>
            </tr>
          `
        }).join("")}
        <tr class="total-row">
          <td colspan="4" class="bold">TOTAL INVENTORY ASSETS (${totalItems} ITEMS)</td>
          <td colspan="3"></td>
          <td class="right bold" style="color: ${company?.primaryColor || '#C8912A'}; font-size: 13px;">${fmt(totalValuation)}</td>
          <td></td>
        </tr>
      </tbody>
    </table>
  `

  printHtmlDocument({
    title: "Inventory Master List",
    subtitle: `Full Stock & Valuation Backup (${totalItems} items)`,
    company,
    contentHtml
  })
}

/**
 * 2. OPENING STOCK BACKUP PDF EXPORT
 */
export function exportOpeningStockPDF(items = [], monthStr = "", totalVal = 0, company = {}) {
  const monthName = monthStr
    ? new Date(monthStr + "-02").toLocaleDateString("en-NG", { month: "long", year: "numeric" })
    : new Date().toLocaleDateString("en-NG", { month: "long", year: "numeric" })

  const totalItems = items.length
  const lockedCount = items.filter(it => it.locked).length
  const calcValuation = totalVal || items.reduce((s, it) => s + ((Number(it.cost) || 0) * (Number(it.openingQty) || 0)), 0)

  const sorted = [...items].sort((a, b) => (a.name || "").localeCompare(b.name || ""))

  const contentHtml = `
    <div class="summary-grid">
      <div class="summary-card">
        <div class="summary-label">Month Period</div>
        <div class="summary-val" style="font-size: 15px;">${monthName}</div>
        <div class="summary-sub">${lockedCount > 0 ? "Month Locked" : "Month Editable"}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Opening Items Logged</div>
        <div class="summary-val">${totalItems}</div>
        <div class="summary-sub">Starting stock items</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Baseline Valuation</div>
        <div class="summary-val">${fmt(calcValuation)}</div>
        <div class="summary-sub">Starting month asset value</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width: 30px;">#</th>
          <th>Item Name</th>
          <th>Unit</th>
          <th class="right">Unit Cost</th>
          <th class="right">Opening Quantity</th>
          <th class="right">Baseline Value</th>
          <th class="center" style="width: 80px;">Lock Status</th>
        </tr>
      </thead>
      <tbody>
        ${sorted.map((item, idx) => {
          const qty = Number(item.openingQty) || 0
          const cost = Number(item.cost) || 0
          const val = qty * cost

          return `
            <tr>
              <td style="color: #888;">${idx + 1}</td>
              <td class="bold">${item.name || "—"}</td>
              <td>${item.unit || "kg"}</td>
              <td class="right">${fmt(cost)}</td>
              <td class="right bold">${qty.toLocaleString()} ${item.unit || ""}</td>
              <td class="right bold">${fmt(val)}</td>
              <td class="center">
                <span class="badge ${item.locked ? 'badge-green' : 'badge-amber'}">
                  ${item.locked ? 'Locked' : 'Active'}
                </span>
              </td>
            </tr>
          `
        }).join("")}
        <tr class="total-row">
          <td colspan="4" class="bold">TOTAL BASELINE VALUATION (${totalItems} ITEMS)</td>
          <td></td>
          <td class="right bold" style="color: ${company?.primaryColor || '#C8912A'}; font-size: 13px;">${fmt(calcValuation)}</td>
          <td></td>
        </tr>
      </tbody>
    </table>
  `

  printHtmlDocument({
    title: `Opening Stock Statement`,
    subtitle: `Starting Inventory Snapshot for ${monthName}`,
    company,
    contentHtml
  })
}

/**
 * 3. PURCHASES LEDGER PDF EXPORT
 */
export function exportPurchasesPDF(purchases = [], monthStr = "all", stats = {}, company = {}) {
  const periodLabel = (!monthStr || monthStr === "all")
    ? "All-Time Records"
    : new Date(monthStr + "-02").toLocaleDateString("en-NG", { month: "long", year: "numeric" })

  const totalSpent = stats?.totalSpent ?? purchases.reduce((s, p) => s + (Number(p.total) || 0), 0)
  const totalCount = stats?.totalPurchases ?? purchases.length
  const uniqueItemsCount = new Set(purchases.map(p => p.item || p.itemId)).size

  const sorted = [...purchases].sort((a, b) => (b.date || "").localeCompare(a.date || ""))

  const contentHtml = `
    <div class="summary-grid">
      <div class="summary-card">
        <div class="summary-label">Period</div>
        <div class="summary-val" style="font-size: 15px;">${periodLabel}</div>
        <div class="summary-sub">${totalCount} entries logged</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Total Amount Spent</div>
        <div class="summary-val">${fmt(totalSpent)}</div>
        <div class="summary-sub">Ingredient purchases</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Distinct Items Bought</div>
        <div class="summary-val">${uniqueItemsCount}</div>
        <div class="summary-sub">Inventory lines stocked</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Item Purchased</th>
          <th>Supplier / Market</th>
          <th>Category</th>
          <th class="right">Qty Bought</th>
          <th class="right">Pack/Unit Size</th>
          <th class="right">Unit Cost</th>
          <th class="right">Total Cost</th>
        </tr>
      </thead>
      <tbody>
        ${sorted.map(p => {
          const total = Number(p.total) || 0
          const price = Number(p.price) || 0
          const qty = Number(p.qty) || 1
          const unitSize = Number(p.unitSize) || 1

          return `
            <tr>
              <td style="white-space: nowrap;">${formatDateDMY(p.date) || "—"}</td>
              <td class="bold">${p.item || "Unknown Item"}</td>
              <td>${p.supplier || "Market Run"}</td>
              <td>${p.category || "Ingredients / Supplies"}</td>
              <td class="right">${qty}</td>
              <td class="right">${unitSize} ${p.unit || "kg"}</td>
              <td class="right">${fmt(price)}</td>
              <td class="right bold">${fmt(total)}</td>
            </tr>
          `
        }).join("")}
        <tr class="total-row">
          <td colspan="7" class="bold">TOTAL PURCHASES (${purchases.length} ENTRIES)</td>
          <td class="right bold" style="color: ${company?.primaryColor || '#C8912A'}; font-size: 13px;">${fmt(totalSpent)}</td>
        </tr>
      </tbody>
    </table>
  `

  printHtmlDocument({
    title: "Purchases Ledger Report",
    subtitle: `Ingredient Purchases History · ${periodLabel}`,
    company,
    contentHtml
  })
}

/**
 * 4. OVERHEAD EXPENSES LEDGER PDF EXPORT
 */
export function exportExpensesPDF(expenses = [], monthStr = "", company = {}) {
  const periodLabel = monthStr
    ? new Date(monthStr + "-02").toLocaleDateString("en-NG", { month: "long", year: "numeric" })
    : "All-Time Records"

  // Filter for month if specified and exclude ingredient purchases (as done in Expenses.jsx)
  const filtered = expenses.filter(e => {
    if (monthStr && e.date && !e.date.startsWith(monthStr)) return false
    return true
  })

  const totalOverhead = filtered.reduce((s, e) => s + (Number(e.amount) || 0), 0)
  const byCategory = filtered.reduce((acc, e) => {
    const cat = e.category || "Miscellaneous"
    acc[cat] = (acc[cat] || 0) + (Number(e.amount) || 0)
    return acc
  }, {})

  const sorted = [...filtered].sort((a, b) => (b.date || "").localeCompare(a.date || ""))

  const contentHtml = `
    <div class="summary-grid">
      <div class="summary-card">
        <div class="summary-label">Expense Period</div>
        <div class="summary-val" style="font-size: 15px;">${periodLabel}</div>
        <div class="summary-sub">${filtered.length} entries recorded</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Total Overhead Expenses</div>
        <div class="summary-val" style="color: #B03A2E;">${fmt(totalOverhead)}</div>
        <div class="summary-sub">Excludes direct ingredient costs</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Top Expense Category</div>
        <div class="summary-val" style="font-size: 13px;">
          ${Object.entries(byCategory).sort((a,b)=>b[1]-a[1])[0]?.[0] || "None"}
        </div>
        <div class="summary-sub">${fmt(Object.entries(byCategory).sort((a,b)=>b[1]-a[1])[0]?.[1] || 0)}</div>
      </div>
    </div>

    <div style="margin-bottom: 16px;">
      <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; color: #777; margin-bottom: 6px;">Expense Category Breakdown</div>
      <div style="display: flex; flex-wrap: wrap; gap: 8px;">
        ${Object.entries(byCategory).map(([cat, amt]) => `
          <div style="background: #FAF7F2; border: 1px solid #E2D7C5; border-radius: 4px; padding: 4px 8px; font-size: 11px;">
            <span style="font-weight: 600;">${cat}:</span> <span>${fmt(amt)}</span>
          </div>
        `).join("")}
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Description</th>
          <th>Category</th>
          <th>Method</th>
          <th>Source</th>
          <th class="right">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${sorted.map(e => `
          <tr>
            <td style="white-space: nowrap;">${formatDateDMY(e.date) || "—"}</td>
            <td class="bold">${e.description || "Expense"}</td>
            <td>${e.category || "Miscellaneous"}</td>
            <td><span class="badge badge-blue">${e.paymentMethod || "cash"}</span></td>
            <td>${e.source || "manual"}</td>
            <td class="right bold">${fmt(e.amount)}</td>
          </tr>
        `).join("")}
        <tr class="total-row">
          <td colspan="5" class="bold">TOTAL OVERHEAD EXPENSES (${filtered.length} ENTRIES)</td>
          <td class="right bold" style="color: #B03A2E; font-size: 13px;">${fmt(totalOverhead)}</td>
        </tr>
      </tbody>
    </table>
  `

  printHtmlDocument({
    title: "Overhead Expenses Report",
    subtitle: `Overhead & Operational Costs · ${periodLabel}`,
    company,
    contentHtml
  })
}

/**
 * 5. BALANCE SHEET PDF EXPORT
 */
export function exportBalanceSheetPDF(data = {}, company = {}) {
  const asOf = data.asOf ? formatDateDMY(data.asOf) : new Date().toLocaleDateString("en-NG")
  const gold = company?.primaryColor || "#C8912A"

  const contentHtml = `
    <div class="summary-grid">
      <div class="summary-card">
        <div class="summary-label">Total Assets</div>
        <div class="summary-val">${fmt(data.totalAssets)}</div>
        <div class="summary-sub">What the bakery owns</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Total Liabilities</div>
        <div class="summary-val" style="color: #B03A2E;">${fmt(data.totalLiabilities)}</div>
        <div class="summary-sub">What the bakery owes</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Total Equity</div>
        <div class="summary-val" style="color: #2D7A50;">${fmt(data.totalEquity)}</div>
        <div class="summary-sub">Owner's net stake</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Balance Status</div>
        <div class="summary-val" style="font-size: 14px; color: ${data.balanced ? '#2D7A50' : '#B03A2E'}">
          ${data.balanced ? "✓ Perfectly Balanced" : `Out by ${fmt(Math.abs(data.totalAssets - (data.totalLiabilities + data.totalEquity)))}`}
        </div>
        <div class="summary-sub">Assets = Liabilities + Equity</div>
      </div>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
      <div>
        <div style="font-size: 12px; font-weight: 700; color: ${gold}; border-bottom: 2px solid ${gold}; padding-bottom: 4px; margin-bottom: 8px; text-transform: uppercase;">
          Assets (What You Own)
        </div>
        <table>
          <tbody>
            <tr><td>Cash & Bank Balance</td><td class="right bold">${fmt(data.cash)}</td></tr>
            <tr><td>Inventory (Ingredients in Store)</td><td class="right bold">${fmt(data.inventoryValue)}</td></tr>
            <tr><td>Accounts Receivable (Owed by Clients)</td><td class="right bold">${fmt(data.receivables)}</td></tr>
            <tr><td>Equipment & Bakery Assets</td><td class="right bold">${fmt(data.obEquip)}</td></tr>
            <tr class="total-row">
              <td class="bold">TOTAL ASSETS</td>
              <td class="right bold" style="color: ${gold}; font-size: 13px;">${fmt(data.totalAssets)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div>
        <div style="font-size: 12px; font-weight: 700; color: ${gold}; border-bottom: 2px solid ${gold}; padding-bottom: 4px; margin-bottom: 8px; text-transform: uppercase;">
          Liabilities & Equity
        </div>
        <table>
          <tbody>
            <tr><td colspan="2" style="font-weight: 600; color: #888; background: #FAF7F2;">LIABILITIES</td></tr>
            <tr><td>Accounts Payable (Owed to Vendors)</td><td class="right bold">${fmt(data.payables)}</td></tr>
            <tr><td>Outstanding Business Loans</td><td class="right bold">${fmt(data.obLoan)}</td></tr>
            <tr style="background: #FDF4F3;"><td>Total Liabilities</td><td class="right bold" style="color: #B03A2E;">${fmt(data.totalLiabilities)}</td></tr>

            <tr><td colspan="2" style="font-weight: 600; color: #888; background: #FAF7F2; border-top: 1px solid #E2D7C5;">EQUITY</td></tr>
            <tr><td>Owner's Contributed Capital</td><td class="right bold">${fmt(data.obCapital)}</td></tr>
            <tr><td>Retained Earnings (Accumulated Profit)</td><td class="right bold">${fmt(data.retainedEarnings)}</td></tr>
            <tr style="background: #E8F5EE;"><td>Total Equity</td><td class="right bold" style="color: #2D7A50;">${fmt(data.totalEquity)}</td></tr>

            <tr class="total-row">
              <td class="bold">TOTAL LIABILITIES + EQUITY</td>
              <td class="right bold" style="color: ${gold}; font-size: 13px;">${fmt(data.totalLiabilities + data.totalEquity)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `

  printHtmlDocument({
    title: "Balance Sheet Statement",
    subtitle: `Financial Position As At ${asOf}`,
    company,
    contentHtml
  })
}

/**
 * 6. ORDER RECORDS / PRODUCTION HISTORY PDF EXPORT
 */
export function exportRecordsPDF(records = [], company = {}) {
  const totalOrders = records.length
  const totalRevenue = records
    .filter(p => p.paymentType !== "gift" && p.paymentType !== "sample")
    .reduce((sum, p) => sum + (Number(p.salePrice) || 0), 0)
  const totalCost = records.reduce((sum, p) => sum + (Number(p.cost) || 0) + (Number(p.deliveryCost) || 0), 0)
  const totalProfit = totalRevenue - totalCost
  const profitMargin = totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : 0

  const contentHtml = `
    <div class="summary-grid">
      <div class="summary-card">
        <div class="summary-label">Total Orders</div>
        <div class="summary-val">${totalOrders}</div>
        <div class="summary-sub">Confirmed productions</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Total Revenue</div>
        <div class="summary-val">${fmt(totalRevenue)}</div>
        <div class="summary-sub">Gross sales</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Total Production Cost</div>
        <div class="summary-val" style="color: #B03A2E;">${fmt(totalCost)}</div>
        <div class="summary-sub">Ingredients & delivery</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Gross Margin</div>
        <div class="summary-val" style="color: ${totalProfit >= 0 ? '#2D7A50' : '#B03A2E'};">
          ${fmt(totalProfit)} (${profitMargin}%)
        </div>
        <div class="summary-sub">Net order margin</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Delivery Date</th>
          <th>Client</th>
          <th>Product / Details</th>
          <th>Type</th>
          <th>Status</th>
          <th class="right">Cost</th>
          <th class="right">Sale Price</th>
          <th class="right">Profit</th>
        </tr>
      </thead>
      <tbody>
        ${records.map(p => {
          const sale = Number(p.salePrice) || 0
          const cost = (Number(p.cost) || 0) + (Number(p.deliveryCost) || 0)
          const profit = sale - cost
          const status = (p.status || "pending").toLowerCase()
          let statusBadge = `<span class="badge badge-amber">${status}</span>`
          if (status === "delivered" || status === "completed" || status === "paid") {
            statusBadge = `<span class="badge badge-green">${status}</span>`
          }

          return `
            <tr>
              <td style="white-space: nowrap;">${formatDateDMY(p.deliveryDate || p.orderDate) || "—"}</td>
              <td class="bold">${p.client || "Client"}</td>
              <td>${p.size || ""} ${p.covering || p.cakeSummary || p.productType || "Cake"}</td>
              <td>${p.paymentType || "sale"}</td>
              <td>${statusBadge}</td>
              <td class="right">${fmt(cost)}</td>
              <td class="right bold">${fmt(sale)}</td>
              <td class="right bold" style="color: ${profit >= 0 ? '#2D7A50' : '#B03A2E'}">${fmt(profit)}</td>
            </tr>
          `
        }).join("")}
        <tr class="total-row">
          <td colspan="5" class="bold">TOTAL ORDER HISTORY (${totalOrders} ORDERS)</td>
          <td class="right bold" style="color: #B03A2E;">${fmt(totalCost)}</td>
          <td class="right bold">${fmt(totalRevenue)}</td>
          <td class="right bold" style="color: #2D7A50;">${fmt(totalProfit)}</td>
        </tr>
      </tbody>
    </table>
  `

  printHtmlDocument({
    title: "Order History & Production Report",
    subtitle: `Full Record of Confirmed Customer Orders (${totalOrders} orders)`,
    company,
    contentHtml
  })
}

/**
 * 7. CLIENTS DIRECTORY PDF EXPORT
 */
export function exportClientsPDF(clients = [], company = {}) {
  const totalClients = clients.length
  const withPhone = clients.filter(c => !!c.phone).length
  const withBirthday = clients.filter(c => !!c.birthday).length

  const sorted = [...clients].sort((a, b) => (a.name || "").localeCompare(b.name || ""))

  const contentHtml = `
    <div class="summary-grid">
      <div class="summary-card">
        <div class="summary-label">Total Clients</div>
        <div class="summary-val">${totalClients}</div>
        <div class="summary-sub">Customer database</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">With Phone Number</div>
        <div class="summary-val">${withPhone}</div>
        <div class="summary-sub">WhatsApp contactable</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Birthdays / Anniversaries</div>
        <div class="summary-val">${withBirthday}</div>
        <div class="summary-sub">Celebration reminders</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width: 30px;">#</th>
          <th>Client Name</th>
          <th>Phone Number</th>
          <th>Email Address</th>
          <th>Delivery Address</th>
          <th>Special Celebrations / Dates</th>
        </tr>
      </thead>
      <tbody>
        ${sorted.map((c, idx) => `
          <tr>
            <td style="color: #888;">${idx + 1}</td>
            <td class="bold">${c.name || "—"}</td>
            <td>${c.phone || "—"}</td>
            <td>${c.email || "—"}</td>
            <td>${c.address || "—"}</td>
            <td>${c.birthday ? `🎂 ${c.birthday}` : "—"}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `

  printHtmlDocument({
    title: "Client Directory Report",
    subtitle: `Customer Contact & Celebration Backup (${totalClients} clients)`,
    company,
    contentHtml
  })
}
