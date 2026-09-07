global.IS_REACT_ACT_ENVIRONMENT = true

import React from "react"
import { createRoot } from "react-dom/client"
import { act } from "react"
import { Clients } from "./Clients.jsx"
import { OrderCalculator } from "../orders/OrderCalculator.jsx"
import * as dataLib from "../../lib/data.js"

// Mock dependencies
jest.mock("../../lib/data.js", () => ({
  loadClients: jest.fn(),
  saveClients: jest.fn(),
  deleteClient: jest.fn(),
  upsertClient: jest.fn(),
  fetchPaginatedClients: jest.fn(),
  createClientOnServer: jest.fn(),
  updateClientOnServer: jest.fn(),
  deleteClientOnServer: jest.fn(),
  loadCompany: jest.fn(() => ({ name: "Test Bakery", phone: "08011112222" })),
  loadLocal: jest.fn(),
  saveLocal: jest.fn(),
  loadQuotes: jest.fn(() => []),
  saveQuotes: jest.fn(),
  clearTempCalculatorState: jest.fn()
}))

// Mock UI components
jest.mock("../common/ui.jsx", () => {
  const React = require("react")
  return {
    Btn: ({ children, onClick, disabled }) => (
      <button onClick={onClick} disabled={disabled}>{children}</button>
    ),
    Inp: ({ label, value, onChange, placeholder }) => (
      <div>
        <label>{label}</label>
        <input
          placeholder={placeholder}
          value={value || ""}
          onChange={e => onChange(e.target.value)}
        />
      </div>
    ),
    Sel: ({ label, value, onChange, options }) => (
      <div>
        <label>{label}</label>
        <select value={value || ""} onChange={e => onChange(e.target.value)}>
          {(options || []).map(o => (
            <option key={o.value || o} value={o.value || o}>{o.label || o}</option>
          ))}
        </select>
      </div>
    ),
    Card: ({ children, style }) => <div style={style}>{children}</div>,
    SHead: ({ title, sub }) => <div><h1>{title}</h1><p>{sub}</p></div>,
    Modal: ({ title, onClose, children }) => (
      <div data-testid="modal">
        <h2>{title}</h2>
        <button onClick={onClose}>Close</button>
        {children}
      </div>
    ),
    Pagination: ({ currentPage, totalItems, pageSize, onPageChange }) => (
      <div data-testid="pagination">
        <span>Page {currentPage} of {Math.ceil(totalItems / (pageSize || 1))}</span>
        <button data-testid="btn-page-2" onClick={() => onPageChange(2)}>Page 2</button>
      </div>
    )
  }
})

// Helper to simulate text input in React
const typeIntoInput = (input, value) => {
  const lastValue = input.value
  input.value = value
  const tracker = input._valueTracker
  if (tracker) {
    tracker.setValue(lastValue)
  }
  input.dispatchEvent(new Event("change", { bubbles: true }))
}

// Helper to simulate select dropdown change in React
const selectOption = (select, value) => {
  const lastValue = select.value
  select.value = value
  const tracker = select._valueTracker
  if (tracker) {
    tracker.setValue(lastValue)
  }
  select.dispatchEvent(new Event("change", { bubbles: true }))
}

describe("Clients Directory & OrderCalculator — Birthday (No Year)", () => {
  let container = null
  let root = null

  const mockClients = [
    {
      id: "cl_1",
      name: "Amina Yusuf",
      phone: "08031112222",
      email: "amina@example.com",
      address: "12 Cake Lane, Abuja",
      birthday: "15 April",
      notes: "Likes vanilla sponge",
      createdAt: "2026-01-10T10:00:00.000Z",
      ordersCount: 3,
      lastOrder: "2026-09-01"
    },
    {
      id: "cl_2",
      name: "Chidi Eze",
      phone: "08053334444",
      email: "chidi@example.com",
      address: "44 Victoria Island, Lagos",
      birthday: "22 September",
      notes: "Nut allergy",
      createdAt: "2026-02-15T12:00:00.000Z",
      ordersCount: 1,
      lastOrder: "2026-08-15"
    }
  ]

  beforeEach(() => {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    jest.clearAllMocks()
    dataLib.loadClients.mockReturnValue([...mockClients])
    dataLib.loadLocal.mockImplementation((key, def) => def)
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    container.remove()
    container = null
    sessionStorage.clear()
  })

  test("Clients directory renders client special dates as badges without years", () => {
    act(() => {
      root.render(<Clients setView={jest.fn()} company={{ name: "Test Bakery" }} />)
    })

    expect(container.textContent).toContain("Amina Yusuf")
    expect(container.textContent).toContain("Birthday: 15 April")
    expect(container.textContent).toContain("Chidi Eze")
    expect(container.textContent).toContain("Birthday: 22 September")
  })

  test("Special Dates this month stat card calculates count accurately", () => {
    const currentMonth = new Date().toLocaleString("en-US", { month: "long" })
    const clientsWithCurrentMonth = [
      ...mockClients,
      {
        id: "cl_3",
        name: "Birthday Star",
        birthday: `10 ${currentMonth}`,
        phone: "08099998888"
      },
      {
        id: "cl_4",
        name: "Anniversary Couple",
        birthday: `Anniversary: 14 ${currentMonth}`,
        phone: "08011223344"
      }
    ]
    dataLib.loadClients.mockReturnValue(clientsWithCurrentMonth)

    act(() => {
      root.render(<Clients setView={jest.fn()} company={{ name: "Test Bakery" }} />)
    })

    expect(container.textContent).toContain("Special Dates This Month")
    const matchingCount = clientsWithCurrentMonth.filter(c => c.birthday && c.birthday.includes(currentMonth)).length
    expect(container.textContent).toContain(String(matchingCount))
  })

  test("Add Client modal allows selecting Birthday or Anniversary with month and day", async () => {
    act(() => {
      root.render(<Clients setView={jest.fn()} company={{ name: "Test Bakery" }} />)
    })

    // Find and click "+ Add Client"
    const addBtn = Array.from(container.querySelectorAll("button")).find(b => b.textContent.includes("Add Client"))
    act(() => {
      addBtn.click()
    })

    expect(container.textContent).toContain("Add New Client")
    expect(container.textContent).toContain("Special Date (Birthday or Anniversary)")

    // Fill in client name
    const inputs = container.querySelectorAll("input")
    const nameInput = Array.from(inputs).find(i => i.placeholder?.includes("Folake"))
    act(() => {
      typeIntoInput(nameInput, "Blessing Okon")
    })

    // Toggle to Anniversary
    const annivBtn = Array.from(container.querySelectorAll("button")).find(b => b.textContent.includes("Anniversary"))
    expect(annivBtn).toBeDefined()
    act(() => {
      annivBtn.click()
    })

    // Select Month and Day from modal selects
    const selects = container.querySelectorAll("select")
    const monthSelect = Array.from(selects).find(s => s.textContent.includes("Select Month"))
    const daySelect = Array.from(selects).find(s => s.textContent.includes("Day"))

    act(() => {
      selectOption(monthSelect, "June")
    })
    act(() => {
      selectOption(daySelect, "28")
    })

    // Special Date indicator preview
    expect(container.textContent).toContain("Anniversary: 28 June")

    // Submit
    const createBtn = Array.from(container.querySelectorAll("button")).find(b => b.textContent.includes("Create Client"))
    await act(async () => {
      createBtn.click()
    })

    expect(dataLib.saveClients).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          name: "Blessing Okon",
          birthday: "Anniversary: 28 June"
        })
      ])
    )
  })

  test("Clicking Quote for client saves birthday into sessionStorage prefill", () => {
    const setView = jest.fn()

    act(() => {
      root.render(<Clients setView={setView} company={{ name: "Test Bakery" }} />)
    })

    const quoteBtn = Array.from(container.querySelectorAll("button")).find(b => b.textContent.includes("Quote"))
    act(() => {
      quoteBtn.click()
    })

    const prefill = JSON.parse(sessionStorage.getItem("ll_calc_prefill"))
    expect(prefill).toBeDefined()
    expect(prefill.clientName).toBe("Amina Yusuf")
    expect(prefill.clientBirthday).toBe("15 April")
    expect(setView).toHaveBeenCalledWith("calculator")
  })

  test("OrderCalculator loads prefilled client birthday and shows Month & Day controls", () => {
    sessionStorage.setItem("ll_calc_prefill", JSON.stringify({
      clientName: "Amina Yusuf",
      clientPhone: "08031112222",
      clientBirthday: "15 April",
      clientNotes: "Likes vanilla"
    }))

    act(() => {
      root.render(
        <OrderCalculator
          inventory={[]}
          recipes={[]}
          settings={{ profitPct: 40 }}
          setView={jest.fn()}
          company={{ name: "Test Bakery" }}
        />
      )
    })

    expect(container.textContent).toContain("Amina Yusuf")
    expect(container.textContent).toContain("Birthday: 15 April")
    const monthSelect = container.querySelector('select[title="Special Date Month (No Year)"]')
    expect(monthSelect.value).toBe("April")
    const daySelect = container.querySelector('select[title="Special Date Day (No Year)"]')
    expect(daySelect.value).toBe("15")
  })

  test("OrderCalculator: Special Event is an optional checkbox; ticking enables selection from client record", () => {
    sessionStorage.removeItem("ll_calc_prefill")
    localStorage.removeItem("ll_calc_state")
    dataLib.loadClients.mockReturnValue([
      { id: "cl_1", name: "Amina Yusuf", birthday: "Birthday: 15 April", phone: "08031112222" }
    ])

    act(() => {
      root.render(
        <OrderCalculator
          inventory={[]}
          recipes={[]}
          settings={{ profitPct: 40 }}
          setView={jest.fn()}
          company={{ name: "Test Bakery" }}
        />
      )
    })

    // Initially Special Event is optional and unticked
    const specialEventCheckbox = container.querySelector('input[type="checkbox"][style*="accent-color"]')
    expect(specialEventCheckbox).toBeDefined()
    expect(specialEventCheckbox.checked).toBe(false)

    // Month & Day dropdowns are not rendered when unticked
    let monthSelect = container.querySelector('select[title="Special Date Month (No Year)"]')
    expect(monthSelect).toBeNull()

    // Normal order date exists in delivery section
    const dateInput = container.querySelector('input[type="date"]')
    expect(dateInput).toBeDefined()

    // Select saved client Amina Yusuf
    const clientSelect = container.querySelector("select")
    act(() => {
      selectOption(clientSelect, "cl_1")
    })

    // Shows button indicating client has a record: "Client has on record: 15 April (Click to apply)"
    expect(container.textContent).toContain("15 April")

    // Now tick Special Event checkbox
    act(() => {
      specialEventCheckbox.click()
    })

    expect(specialEventCheckbox.checked).toBe(true)
    // Month and Day selects now open, filled with client's saved record
    monthSelect = container.querySelector('select[title="Special Date Month (No Year)"]')
    expect(monthSelect).not.toBeNull()
    expect(monthSelect.value).toBe("April")

    const daySelect = container.querySelector('select[title="Special Date Day (No Year)"]')
    expect(daySelect.value).toBe("15")
  })

  test("True Server-Side Pagination: triggers API request with page 2 when page 2 is clicked", async () => {
    dataLib.fetchPaginatedClients.mockResolvedValue({
      data: [
        { id: "cl_10", name: "Page 2 Client", phone: "08012345678", birthday: "10 May" }
      ],
      pagination: { page: 2, limit: 25, total: 35, totalPages: 2 },
      stats: { totalClients: 35, totalWithPhone: 30, birthdaysThisMonth: 2 }
    })

    await act(async () => {
      root.render(<Clients setView={jest.fn()} company={{ name: "Test Bakery" }} />)
    })

    // Click Page 2 button
    const page2Btn = container.querySelector('[data-testid="btn-page-2"]')
    expect(page2Btn).toBeDefined()

    await act(async () => {
      page2Btn.click()
    })

    // Check that fetchPaginatedClients was called with page 2
    expect(dataLib.fetchPaginatedClients).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 2,
        limit: 25
      })
    )

    // Table now renders Page 2 Client
    expect(container.textContent).toContain("Page 2 Client")
  })
})
