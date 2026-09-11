import {
  printHtmlDocument,
  exportInventoryPDF,
  exportOpeningStockPDF,
  exportPurchasesPDF,
  exportExpensesPDF,
  exportBalanceSheetPDF,
  exportRecordsPDF,
  exportClientsPDF
} from "./pdfReportGenerator.js"

describe("pdfReportGenerator tests", () => {
  let mockWindow
  let writtenHtml = ""

  beforeEach(() => {
    writtenHtml = ""
    mockWindow = {
      document: {
        open: jest.fn(),
        write: jest.fn(html => { writtenHtml += html }),
        close: jest.fn()
      }
    }
    window.open = jest.fn(() => mockWindow)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("printHtmlDocument opens window and writes styled HTML with company branding", () => {
    printHtmlDocument({
      title: "Test Report",
      subtitle: "Test Subtitle",
      company: { name: "Royal Delights Bakery", primaryColor: "#C8912A", phone: "08012345678" },
      contentHtml: "<div>Test Content</div>"
    })

    expect(window.open).toHaveBeenCalledWith("", "_blank")
    expect(mockWindow.document.open).toHaveBeenCalled()
    expect(mockWindow.document.write).toHaveBeenCalled()
    expect(mockWindow.document.close).toHaveBeenCalled()

    expect(writtenHtml).toContain("Royal Delights Bakery")
    expect(writtenHtml).toContain("Test Report")
    expect(writtenHtml).toContain("Test Subtitle")
    expect(writtenHtml).toContain("08012345678")
    expect(writtenHtml).toContain("Test Content")
    expect(writtenHtml).toContain("window.print()")
  })

  it("exportInventoryPDF formats full inventory stock and valuation", () => {
    const mockInventory = [
      { id: "1", name: "Flour 50kg", cat: "Dry Goods", unit: "bag", cost: 55000, stock: 4, minStock: 2 },
      { id: "2", name: "Sugar 50kg", cat: "Dry Goods", unit: "bag", cost: 82000, stock: 1, minStock: 2 },
      { id: "3", name: "Vanilla Flavour", cat: "Flavours and Extracts", unit: "bottle", cost: 2500, stock: 0, minStock: 5 }
    ]
    const company = { name: "Sweet Treats" }

    exportInventoryPDF(mockInventory, company)

    expect(writtenHtml).toContain("Inventory Master List")
    expect(writtenHtml).toContain("Sweet Treats")
    expect(writtenHtml).toContain("Flour 50kg")
    expect(writtenHtml).toContain("Sugar 50kg")
    expect(writtenHtml).toContain("Vanilla Flavour")
    expect(writtenHtml).toContain("Low Stock")
    expect(writtenHtml).toContain("Out of Stock")
    expect(writtenHtml).toContain("In Stock")
    // Total valuation = (4*55000) + (1*82000) + (0*2500) = 220000 + 82000 = 302000
    expect(writtenHtml).toContain("302,000")
  })

  it("exportOpeningStockPDF formats opening baseline valuation and lock status", () => {
    const mockItems = [
      { id: "1", name: "Golden Penny Flour", unit: "kg", cost: 1100, openingQty: 100, locked: true },
      { id: "2", name: "Dangote Sugar", unit: "kg", cost: 1640, openingQty: 50, locked: false }
    ]
    const company = { name: "BakeWealth Demo" }

    exportOpeningStockPDF(mockItems, "2026-09", 192000, company)

    expect(writtenHtml).toContain("Opening Stock Statement")
    expect(writtenHtml).toContain("September 2026")
    expect(writtenHtml).toContain("Golden Penny Flour")
    expect(writtenHtml).toContain("Dangote Sugar")
    expect(writtenHtml).toContain("Locked")
    expect(writtenHtml).toContain("Active")
    expect(writtenHtml).toContain("192,000")
  })

  it("exportPurchasesPDF formats purchases history with suppliers and totals", () => {
    const mockPurchases = [
      { id: "p1", date: "2026-09-05", item: "Simas Margarine", supplier: "Mile 12 Market", category: "Ingredients / Supplies", qty: 2, unit: "carton", unitSize: 1, price: 28000, total: 56000 },
      { id: "p2", date: "2026-09-08", item: "Eggs", supplier: "Poultry Direct", category: "Ingredients / Supplies", qty: 10, unit: "crate", unitSize: 1, price: 4500, total: 45000 }
    ]

    exportPurchasesPDF(mockPurchases, "2026-09", { totalSpent: 101000, totalPurchases: 2 }, { name: "Luxury Bakes" })

    expect(writtenHtml).toContain("Purchases Ledger Report")
    expect(writtenHtml).toContain("Simas Margarine")
    expect(writtenHtml).toContain("Mile 12 Market")
    expect(writtenHtml).toContain("Poultry Direct")
    expect(writtenHtml).toContain("101,000")
  })

  it("exportExpensesPDF formats overhead expenses and category breakdowns", () => {
    const mockExpenses = [
      { id: "e1", date: "2026-09-02", description: "Diesel for Generator", category: "Utilities", paymentMethod: "transfer", amount: 45000 },
      { id: "e2", date: "2026-09-04", description: "Bakery Dispatch Delivery", category: "Delivery / Transport", paymentMethod: "cash", amount: 12000 }
    ]

    exportExpensesPDF(mockExpenses, "2026-09", { name: "Flavour Haven" })

    expect(writtenHtml).toContain("Overhead Expenses Report")
    expect(writtenHtml).toContain("Diesel for Generator")
    expect(writtenHtml).toContain("Bakery Dispatch Delivery")
    expect(writtenHtml).toContain("57,000")
    expect(writtenHtml).toContain("Utilities")
  })

  it("exportBalanceSheetPDF formats assets, liabilities, and equity", () => {
    const balanceData = {
      asOf: "2026-09-10",
      cash: 500000,
      inventoryValue: 300000,
      receivables: 100000,
      obEquip: 800000,
      totalAssets: 1700000,
      payables: 200000,
      obLoan: 300000,
      totalLiabilities: 500000,
      obCapital: 700000,
      retainedEarnings: 500000,
      totalEquity: 1200000,
      balanced: true
    }

    exportBalanceSheetPDF(balanceData, { name: "Balance Demo Bakery" })

    expect(writtenHtml).toContain("Balance Sheet Statement")
    expect(writtenHtml).toContain("1,700,000")
    expect(writtenHtml).toContain("500,000")
    expect(writtenHtml).toContain("1,200,000")
    expect(writtenHtml).toContain("Perfectly Balanced")
  })

  it("exportRecordsPDF formats customer order history", () => {
    const mockRecords = [
      { id: "r1", deliveryDate: "2026-09-12", client: "Mrs. Adebayo", size: "8 inch", covering: "Buttercream", paymentType: "full", status: "delivered", salePrice: 45000, cost: 18000 }
    ]

    exportRecordsPDF(mockRecords, { name: "Cakes by Grace" })

    expect(writtenHtml).toContain("Order History & Production Report")
    expect(writtenHtml).toContain("Mrs. Adebayo")
    expect(writtenHtml).toContain("8 inch Buttercream")
    expect(writtenHtml).toContain("45,000")
    expect(writtenHtml).toContain("18,000")
  })

  it("exportClientsPDF formats client contact directory", () => {
    const mockClients = [
      { id: "c1", name: "Chinedu Okafor", phone: "08033334444", email: "chinedu@example.com", address: "Lekki Phase 1", birthday: "October 14" }
    ]

    exportClientsPDF(mockClients, { name: "Grace Bakes" })

    expect(writtenHtml).toContain("Client Directory Report")
    expect(writtenHtml).toContain("Chinedu Okafor")
    expect(writtenHtml).toContain("08033334444")
    expect(writtenHtml).toContain("chinedu@example.com")
    expect(writtenHtml).toContain("October 14")
  })
})
