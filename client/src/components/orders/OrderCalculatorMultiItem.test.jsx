global.IS_REACT_ACT_ENVIRONMENT = true

import React from "react"
import { createRoot } from "react-dom/client"
import { act } from "react"
import { OrderCalculator } from "./OrderCalculator"
import * as dataLib from "../../lib/data"

// Mock data library
jest.mock("../../lib/data", () => ({
  loadCompany: jest.fn(() => ({ name: "BakeWealth", bankName: "GTBank", bankAccount: "0123456789" })),
  loadLocal: jest.fn((key, fallback) => fallback),
  saveLocal: jest.fn().mockResolvedValue(true),
  loadQuotes: jest.fn(() => []),
  saveQuotes: jest.fn().mockResolvedValue(true),
  loadClients: jest.fn(() => []),
  upsertClient: jest.fn().mockResolvedValue(true),
  clearTempCalculatorState: jest.fn()
}))

// Mock UI components
jest.mock("../common/ui.jsx", () => {
  const React = require("react")
  return {
    Btn: ({ children, onClick, disabled, full, variant }) => (
      <button onClick={onClick} disabled={disabled} data-variant={variant}>{children}</button>
    ),
    Inp: ({ label, value, onChange, type, placeholder }) => (
      <div data-testid={`field-${label}`}>
        <label>{label}</label>
        <input
          type={type || "text"}
          value={value || ""}
          placeholder={placeholder}
          onChange={e => onChange(e.target.value)}
        />
      </div>
    ),
    Sel: ({ label, value, onChange, options }) => (
      <div data-testid={`select-${label}`}>
        <label>{label}</label>
        <select value={value || ""} onChange={e => onChange(e.target.value)}>
          {options.map(o => <option key={o.value || o} value={o.value || o}>{o.label || o}</option>)}
        </select>
      </div>
    ),
    Card: ({ children, style }) => <div className="card" style={style}>{children}</div>,
    SHead: ({ title, sub }) => <div><h2>{title}</h2><p>{sub}</p></div>,
    SearchableSelect: ({ value, onChange, options, placeholder }) => (
      <select data-testid="searchable-select" value={value || ""} onChange={e => onChange(e.target.value)}>
        <option value="">{placeholder}</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    )
  }
})

// Helper to simulate text input in React 18
const typeIntoInput = (input, value) => {
  const lastValue = input.value
  input.value = value
  const tracker = input._valueTracker
  if (tracker) {
    tracker.setValue(lastValue)
  }
  input.dispatchEvent(new Event("change", { bubbles: true }))
}

// Helper to simulate select dropdown change in React 18
const selectOption = (select, value) => {
  const lastValue = select.value
  select.value = value
  const tracker = select._valueTracker
  if (tracker) {
    tracker.setValue(lastValue)
  }
  select.dispatchEvent(new Event("change", { bubbles: true }))
}

describe("OrderCalculator Multi-Item Tests", () => {
  let container, root

  const mockInventory = [
    { id: "i-flour", name: "Flour", cat: "Dry Goods", unit: "kg", cost: 1000, stock: 50 },
    { id: "i-sugar", name: "Sugar", cat: "Dry Goods", unit: "kg", cost: 800, stock: 40 },
    { id: "i-board-10", name: "Cake board 10\"", cat: "Board and Packaging", unit: "pcs", cost: 600, stock: 20 },
    { id: "d-topper", name: "Gold Topper", cat: "Decorations", unit: "pcs", cost: 1500, stock: 10 }
  ]

  const mockRecipes = [
    {
      id: "r-rv",
      name: "Red Velvet",
      type: "layer",
      ing: [
        { iid: "i-flour", qty: 0.5, unit: "kg" },
        { iid: "i-sugar", qty: 0.4, unit: "kg" }
      ]
    },
    {
      id: "r-choc",
      name: "Chocolate",
      type: "layer",
      ing: [
        { iid: "i-flour", qty: 0.6, unit: "kg" },
        { iid: "i-sugar", qty: 0.5, unit: "kg" }
      ]
    },
    {
      id: "r-bc",
      name: "Buttercream",
      type: "covering",
      batchWeight: 1000,
      ing: [
        { iid: "i-sugar", qty: 0.8, unit: "kg" }
      ]
    },
    {
      id: "r-donut",
      name: "Glazed Donuts",
      type: "pastry",
      batchSize: 12,
      ing: [
        { iid: "i-flour", qty: 1.0, unit: "kg" },
        { iid: "i-sugar", qty: 0.3, unit: "kg" }
      ]
    }
  ]

  const mockSettings = {
    profitPct: 40,
    overheadPct: 25,
    accessoryPct: 10,
    miscPct: 5
  }

  beforeEach(() => {
    container = document.createElement("div")
    document.body.appendChild(container)
    window.alert = jest.fn()
    window.confirm = jest.fn(() => true)
    jest.clearAllMocks()
  })

  afterEach(() => {
    if (root) {
      act(() => { root.unmount() })
      root = null
    }
    document.body.removeChild(container)
    container = null
  })

  it("should render client details, general note, and show no item divs until + Add Item is clicked", async () => {
    await act(async () => {
      root = createRoot(container)
      root.render(
        <OrderCalculator
          inventory={mockInventory}
          recipes={mockRecipes}
          settings={mockSettings}
          setView={jest.fn()}
          company={{ name: "BakeWealth" }}
        />
      )
    })

    expect(container.textContent).toContain("Client Details")
    expect(container.textContent).toContain("General Note")
    // Initially NO item div is displayed
    expect(container.textContent).not.toContain("Item 1 — Cake")
    expect(container.textContent).toContain("No items added yet")
    expect(container.textContent).toContain("Quote Summary")

    // Click "+ Add Item"
    const addBtn = Array.from(container.querySelectorAll("button")).find(
      b => b.textContent.includes("Add Item")
    )
    expect(addBtn).toBeDefined()
    await act(async () => {
      addBtn.click()
    })

    expect(container.textContent).toContain("What item are you adding?")

    // Click Cake
    const cakeBtn = Array.from(container.querySelectorAll("button")).find(
      b => b.textContent.includes("Cake") && b.textContent.includes("Sizes")
    )
    await act(async () => {
      cakeBtn.click()
    })

    // Now Item 1 — Cake div appears
    expect(container.textContent).toContain("Item 1 — Cake")
    expect(container.textContent).toContain("Cake 1")
    expect(container.textContent).toContain("Cake 1 Design Photo")
  })

  it("should allow adding multiple cake items and a pastry item", async () => {
    await act(async () => {
      root = createRoot(container)
      root.render(
        <OrderCalculator
          inventory={mockInventory}
          recipes={mockRecipes}
          settings={mockSettings}
          setView={jest.fn()}
          company={{ name: "BakeWealth" }}
        />
      )
    })

    // Add first item: Cake
    const addBtn = Array.from(container.querySelectorAll("button")).find(
      b => b.textContent.includes("Add Item")
    )
    await act(async () => {
      addBtn.click()
    })
    const cakeBtn1 = Array.from(container.querySelectorAll("button")).find(
      b => b.textContent.includes("Cake") && b.textContent.includes("Sizes")
    )
    await act(async () => {
      cakeBtn1.click()
    })
    expect(container.textContent).toContain("Item 1 — Cake")

    // Click "+ Add Item" again for second cake
    const addItemButtons = Array.from(container.querySelectorAll("button")).filter(
      b => b.textContent.includes("+ Add Item")
    )
    await act(async () => {
      addItemButtons[0].click()
    })

    // Click Cake for Item 2
    const cakeBtn2 = Array.from(container.querySelectorAll("button")).find(
      b => b.textContent.includes("Cake") && b.textContent.includes("Sizes")
    )
    await act(async () => {
      cakeBtn2.click()
    })

    // Now we should have 2 items: Item 1 and Item 2
    expect(container.textContent).toContain("Item 1 — Cake")
    expect(container.textContent).toContain("Item 2 — Cake")

    // Verify Item 2 defaults to "Same as above (delivery date & time)"
    expect(container.textContent).toContain("Same as above (delivery date & time)")

    // Add another item: Pastry
    const addAnotherItemBtn = Array.from(container.querySelectorAll("button")).find(
      b => b.textContent.includes("+ Add Item")
    )
    await act(async () => {
      addAnotherItemBtn.click()
    })

    const pastryBtn = Array.from(container.querySelectorAll("button")).find(
      b => b.textContent.includes("Pastry") && b.textContent.includes("Donuts")
    )
    await act(async () => {
      pastryBtn.click()
    })

    // Now we have 3 items!
    expect(container.textContent).toContain("Item 3 — Pastry")
    expect(container.textContent).toContain("Total (one invoice)")
  })

  it("should save a multi-item quote with consolidated details", async () => {
    await act(async () => {
      root = createRoot(container)
      root.render(
        <OrderCalculator
          inventory={mockInventory}
          recipes={mockRecipes}
          settings={mockSettings}
          setView={jest.fn()}
          company={{ name: "BakeWealth" }}
        />
      )
    })

    // Click Add Item -> Cake first
    const addBtn = Array.from(container.querySelectorAll("button")).find(
      b => b.textContent.includes("Add Item")
    )
    await act(async () => {
      addBtn.click()
    })
    const cakeBtn = Array.from(container.querySelectorAll("button")).find(
      b => b.textContent.includes("Cake") && b.textContent.includes("Sizes")
    )
    await act(async () => {
      cakeBtn.click()
    })

    // Fill Client Name
    const clientNameInput = container.querySelector("div[data-testid='field-Client Name *'] input")
    await act(async () => {
      typeIntoInput(clientNameInput, "Mrs Iye Achem")
    })

    // Select flavour for Item 1 Cake
    const selects = Array.from(container.querySelectorAll("select"))
    const cakeRecipeSelect = selects.find(s => s.innerHTML.includes("Red Velvet"))
    expect(cakeRecipeSelect).toBeDefined()

    await act(async () => {
      selectOption(cakeRecipeSelect, "Red Velvet")
    })

    // Click Generate & save quote
    const saveBtn = Array.from(container.querySelectorAll("button")).find(
      b => b.textContent.includes("Generate & save quote")
    )
    expect(saveBtn).toBeDefined()

    await act(async () => {
      saveBtn.click()
    })

    // Verify saveQuotes was called
    expect(dataLib.saveQuotes).toHaveBeenCalled()
    const savedQuotesArg = dataLib.saveQuotes.mock.calls[0][0]
    expect(savedQuotesArg.length).toBe(1)
    const savedQuote = savedQuotesArg[0]

    expect(savedQuote.clientName).toBe("Mrs Iye Achem")
    expect(savedQuote.items).toBeDefined()
    expect(savedQuote.items.length).toBe(1)
    expect(savedQuote.items[0].photos).toEqual([])
    expect(savedQuote.tiers.length).toBeGreaterThan(0)
    expect(savedQuote.cakeSummary).toContain("Item 1")

    // Verify after-save confirmation appears
    expect(container.textContent).toContain("Quote saved for Mrs Iye Achem!")
    expect(container.textContent).toContain("Send quote via WhatsApp")
  })

  it("should support multiple design photos per cake and include them in the saved quote", async () => {
    // Mock prefill with multiple photos on item 1 and item 2
    sessionStorage.setItem("ll_calc_prefill", JSON.stringify({
      clientName: "Amaka Obi",
      items: [
        {
          id: "cake-1",
          type: "cake",
          name: "Item 1 — Wedding Cake",
          tiers: [{ id: 1, size: "12", shape: "Round", layers: [{ id: 10, flavour: "Vanilla", qty: 1 }], coverings: [], fillings: [] }],
          photos: ["data:image/png;base64,front_view", "data:image/png;base64,side_view", "data:image/png;base64,topper_view"],
          decQty: {},
          accRows: []
        },
        {
          id: "cake-2",
          type: "cake",
          name: "Item 2 — Birthday Cake",
          tiers: [{ id: 2, size: "8", shape: "Round", layers: [{ id: 20, flavour: "Chocolate", qty: 1 }], coverings: [], fillings: [] }],
          photos: ["data:image/png;base64,bday_cake_pic"],
          decQty: {},
          accRows: []
        }
      ]
    }))

    await act(async () => {
      root = createRoot(container)
      root.render(
        <OrderCalculator
          inventory={mockInventory}
          recipes={mockRecipes}
          settings={mockSettings}
          setView={jest.fn()}
          company={{ name: "BakeWealth" }}
        />
      )
    })

    // Verify photos header and count appear
    expect(container.textContent).toContain("Design Photos (3)")
    expect(container.textContent).toContain("Design Photos (1)")

    // Verify images are rendered
    const images = Array.from(container.querySelectorAll("img[alt*='Design photo']"))
    expect(images.length).toBe(4) // 3 for cake 1, 1 for cake 2

    // Click Generate & save quote
    const saveBtn = Array.from(container.querySelectorAll("button")).find(
      b => b.textContent.includes("Generate & save quote")
    )
    await act(async () => {
      saveBtn.click()
    })

    expect(dataLib.saveQuotes).toHaveBeenCalled()
    const savedQuote = dataLib.saveQuotes.mock.calls[0][0][0]
    expect(savedQuote.clientName).toBe("Amaka Obi")
    expect(savedQuote.items[0].photos.length).toBe(3)
    expect(savedQuote.items[1].photos.length).toBe(1)
    expect(savedQuote.cakePhotos.length).toBe(4)
    expect(savedQuote.cakePhoto).toBe("data:image/png;base64,front_view")
  })

  it("should support 3 cakes on different dates and times with inspiration images and 'same as above'", async () => {
    sessionStorage.setItem("ll_calc_prefill", JSON.stringify({
      clientName: "Folashade Balogun",
      items: [
        {
          id: "cake-1",
          type: "cake",
          name: "Item 1 — Wedding Cake",
          tiers: [{ id: 1, size: "12", shape: "Round", layers: [{ id: 10, flavour: "Vanilla", qty: 1 }], coverings: [], fillings: [] }],
          photos: ["data:image/png;base64,wedding_cake_pic"],
          deliveryDate: "2026-09-04",
          collectionTime: "14:00",
          sameDeliveryAsFirst: false,
          decQty: {},
          accRows: []
        },
        {
          id: "cake-2",
          type: "cake",
          name: "Item 2 — Birthday Cake",
          tiers: [{ id: 2, size: "8", shape: "Round", layers: [{ id: 20, flavour: "Chocolate", qty: 1 }], coverings: [], fillings: [] }],
          photos: ["data:image/png;base64,bday_cake_pic"],
          deliveryDate: "2026-09-14",
          collectionTime: "10:00",
          sameDeliveryAsFirst: false,
          decQty: {},
          accRows: []
        },
        {
          id: "cake-3",
          type: "cake",
          name: "Item 3 — Anniversary Cake",
          tiers: [{ id: 3, size: "6", shape: "Heart", layers: [{ id: 30, flavour: "Vanilla", qty: 1 }], coverings: [], fillings: [] }],
          photos: ["data:image/png;base64,anniversary_cake_pic"],
          deliveryDate: "",
          collectionTime: "",
          sameDeliveryAsFirst: true, // Same as above
          decQty: {},
          accRows: []
        }
      ]
    }))

    await act(async () => {
      root = createRoot(container)
      root.render(
        <OrderCalculator
          inventory={mockInventory}
          recipes={mockRecipes}
          settings={mockSettings}
          setView={jest.fn()}
          company={{ name: "BakeWealth" }}
        />
      )
    })

    // Verify item header badges reflect dates and 'same as above'
    expect(container.textContent).toContain("2026-09-04 @ 14:00")
    expect(container.textContent).toContain("2026-09-14 @ 10:00")
    expect(container.textContent).toContain("Same as above (2026-09-04 @ 14:00)")

    // Save the quote
    const saveBtn = Array.from(container.querySelectorAll("button")).find(
      b => b.textContent.includes("Generate & save quote")
    )
    await act(async () => {
      saveBtn.click()
    })

    expect(dataLib.saveQuotes).toHaveBeenCalled()
    const savedQuote = dataLib.saveQuotes.mock.calls[0][0][0]
    expect(savedQuote.clientName).toBe("Folashade Balogun")
    expect(savedQuote.items.length).toBe(3)
    expect(savedQuote.hasMultiDeliveryDates).toBe(true)

    // Verify each item reflected its own date and photos
    expect(savedQuote.items[0].deliveryDate).toBe("2026-09-04")
    expect(savedQuote.items[0].photos.length).toBe(1)

    expect(savedQuote.items[1].deliveryDate).toBe("2026-09-14")
    expect(savedQuote.items[1].collectionTime).toBe("10:00")
    expect(savedQuote.items[1].photos.length).toBe(1)

    expect(savedQuote.items[2].sameDeliveryAsFirst).toBe(true)
    expect(savedQuote.items[2].deliveryDate).toBe("2026-09-04")
    expect(savedQuote.items[2].photos.length).toBe(1)
  })

  it("should scroll to item picker at the top when clicking + Add Item at the bottom", async () => {
    sessionStorage.setItem("ll_calc_prefill", JSON.stringify({
      clientName: "Tomiwa Adeleke",
      items: [
        {
          id: "cake-scroll-test",
          type: "cake",
          name: "Item 1 — Celebration Cake",
          tiers: [{ id: 1, size: "10", shape: "Round", layers: [{ id: 10, flavour: "Vanilla", qty: 1 }], coverings: [], fillings: [] }],
          photos: [],
          decQty: {},
          accRows: []
        }
      ]
    }))

    const scrollMock = jest.fn()
    window.HTMLElement.prototype.scrollIntoView = scrollMock

    await act(async () => {
      root = createRoot(container)
      root.render(
        <OrderCalculator
          inventory={mockInventory}
          recipes={mockRecipes}
          settings={mockSettings}
          setView={jest.fn()}
          company={{ name: "BakeWealth" }}
        />
      )
    })

    // Find the bottom "+ Add Item" button
    const bottomAddBtn = Array.from(container.querySelectorAll("button")).find(
      b => b.textContent.trim() === "+ Add Item"
    )
    expect(bottomAddBtn).toBeDefined()

    // Click the bottom button
    await act(async () => {
      bottomAddBtn.click()
      // advance timers for the scrollIntoView setTimeout
      await new Promise(r => setTimeout(r, 60))
    })

    // Item picker card should now be visible asking "What item are you adding?"
    expect(container.textContent).toContain("What item are you adding?")
    expect(container.textContent).toContain("Cake")
    expect(container.textContent).toContain("Pastry")

    // scrollIntoView should have been triggered
    expect(scrollMock).toHaveBeenCalledWith({ behavior: "smooth", block: "center" })
  })

  it("should provide photo crop controls for uploaded inspiration images", async () => {
    sessionStorage.setItem("ll_calc_prefill", JSON.stringify({
      clientName: "Tomiwa Adeleke",
      items: [
        {
          id: "cake-crop-test",
          type: "cake",
          name: "Item 1 — Celebration Cake",
          tiers: [{ id: 1, size: "10", shape: "Round", layers: [{ id: 10, flavour: "Vanilla", qty: 1 }], coverings: [], fillings: [] }],
          photos: ["data:image/png;base64,initial_photo_data"],
          decQty: {},
          accRows: []
        }
      ]
    }))

    await act(async () => {
      root = createRoot(container)
      root.render(
        <OrderCalculator
          inventory={mockInventory}
          recipes={mockRecipes}
          settings={mockSettings}
          setView={jest.fn()}
          company={{ name: "BakeWealth" }}
        />
      )
    })

    // Find the crop button on the uploaded photo thumbnail
    const cropBtn = container.querySelector("button[title='Crop / adjust photo']")
    expect(cropBtn).toBeTruthy()

    // Click to open the crop modal
    await act(async () => {
      cropBtn.click()
    })

    // Verify ImageCropperModal opened
    expect(container.textContent).toContain("Crop Inspiration Photo")
    expect(container.textContent).toContain("1:1 Square")
    expect(container.textContent).toContain("Apply Crop & Save")
    expect(container.textContent).toContain("Keep Original")
  })

  it("should support each cake under Item 1 having its own inspiration photo", async () => {
    sessionStorage.setItem("ll_calc_prefill", JSON.stringify({
      clientName: "Amina Yusuf",
      items: [
        {
          id: "item-multi-cake-photos",
          type: "cake",
          name: "Item 1 — 2-Tier Wedding Cake",
          tiers: [
            {
              id: "tier-1",
              size: "12",
              shape: "Round",
              layers: [{ id: 1, flavour: "Vanilla", qty: 2 }],
              coverings: [],
              fillings: [],
              photos: ["data:image/png;base64,cake1_photo_data"],
              photo: "data:image/png;base64,cake1_photo_data"
            },
            {
              id: "tier-2",
              size: "8",
              shape: "Round",
              layers: [{ id: 2, flavour: "Chocolate", qty: 2 }],
              coverings: [],
              fillings: [],
              photos: ["data:image/png;base64,cake2_photo_data"],
              photo: "data:image/png;base64,cake2_photo_data"
            }
          ],
          photos: [],
          decQty: {},
          accRows: []
        }
      ]
    }))

    await act(async () => {
      root = createRoot(container)
      root.render(
        <OrderCalculator
          inventory={mockInventory}
          recipes={mockRecipes}
          settings={mockSettings}
          setView={jest.fn()}
          company={{ name: "BakeWealth" }}
        />
      )
    })

    // Verify both Cake 1 and Cake 2 design photo sections exist
    expect(container.textContent).toContain("Cake 1 Design Photo")
    expect(container.textContent).toContain("Cake 2 Design Photo")

    // Verify crop buttons exist for both cake 1 and cake 2 photos
    const cropButtons = container.querySelectorAll("button[title='Crop photo']")
    expect(cropButtons.length).toBe(2)

    // Save quote and verify both tier photos are preserved and aggregated
    const saveBtn = Array.from(container.querySelectorAll("button")).find(
      b => b.textContent.includes("Generate & save quote")
    )
    await act(async () => {
      saveBtn.click()
    })

    expect(dataLib.saveQuotes).toHaveBeenCalled()
    const savedQuote = dataLib.saveQuotes.mock.calls[0][0][0]
    expect(savedQuote.items[0].tiers[0].photos[0]).toBe("data:image/png;base64,cake1_photo_data")
    expect(savedQuote.items[0].tiers[1].photos[0]).toBe("data:image/png;base64,cake2_photo_data")
    expect(savedQuote.cakePhotos).toContain("data:image/png;base64,cake1_photo_data")
    expect(savedQuote.cakePhotos).toContain("data:image/png;base64,cake2_photo_data")
  })

  it("should allow removing an item and show no item divs when all items are removed", async () => {
    sessionStorage.setItem("ll_calc_prefill", JSON.stringify({
      clientName: "Bisi Akande",
      items: [
        {
          id: "item-to-remove",
          type: "cake",
          name: "Item 1 — Cake",
          tiers: [{ id: 1, size: "10", shape: "Round", layers: [], coverings: [], fillings: [] }],
          photos: [],
          decQty: {},
          accRows: []
        }
      ]
    }))

    await act(async () => {
      root = createRoot(container)
      root.render(
        <OrderCalculator
          inventory={mockInventory}
          recipes={mockRecipes}
          settings={mockSettings}
          setView={jest.fn()}
          company={{ name: "BakeWealth" }}
        />
      )
    })

    expect(container.textContent).toContain("Item 1 — Cake")

    // Find and click the Remove button
    const removeBtn = Array.from(container.querySelectorAll("button")).find(
      b => b.textContent.trim().includes("Remove")
    )
    expect(removeBtn).toBeDefined()

    await act(async () => {
      removeBtn.click()
    })

    // Item div should now be gone, showing empty state
    expect(container.textContent).not.toContain("Item 1 — Cake")
    expect(container.textContent).toContain("No items added yet")
  })

  it("should calculate suggested price and increment when adding layers and changing layer quantity", async () => {
    // Start with 1 cake item configured with Red Velvet recipe
    sessionStorage.setItem("ll_calc_prefill", JSON.stringify({
      clientName: "Tunde Ade",
      items: [
        {
          id: "cake-1",
          type: "cake",
          name: "Item 1 — Cake",
          tiers: [
            {
              id: 1,
              size: "10",
              shape: "Round",
              layers: [{ id: 101, flavour: "Red Velvet", qty: 1 }],
              coverings: [{ id: 102, type: "Buttercream", grams: 400 }],
              fillings: [{ id: 103, type: "Buttercream", grams: 200 }]
            }
          ],
          decQty: {},
          accRows: []
        }
      ]
    }))

    await act(async () => {
      root = createRoot(container)
      root.render(
        <OrderCalculator
          inventory={mockInventory}
          recipes={mockRecipes}
          settings={mockSettings}
          setView={jest.fn()}
          company={{ name: "BakeWealth" }}
        />
      )
    })

    // Suggested price must be visible and > 0 (not ₦0 or NaN)
    const suggestedPriceCard = Array.from(container.querySelectorAll("div")).find(
      d => d.textContent.includes("Suggested price") && d.textContent.includes("Profit:")
    )
    expect(suggestedPriceCard).toBeDefined()
    expect(suggestedPriceCard.textContent).not.toContain("₦0")
    expect(suggestedPriceCard.textContent).not.toContain("NaN")

    // Extract initial suggested price
    const initialPriceText = suggestedPriceCard.textContent.match(/₦[0-9,]+/)[0]
    const initialPriceNum = parseInt(initialPriceText.replace(/[^0-9]/g, ""), 10)
    expect(initialPriceNum).toBeGreaterThan(0)

    // Click "+ Add layer"
    const addLayerBtn = Array.from(container.querySelectorAll("button")).find(
      b => b.textContent.includes("+ Add layer")
    )
    expect(addLayerBtn).toBeDefined()

    await act(async () => {
      addLayerBtn.click()
    })

    // Now we should have 2 layers L1 and L2
    expect(container.textContent).toContain("L1")
    expect(container.textContent).toContain("L2")

    // Suggested price should have INCREMENTED
    const updatedPriceText = suggestedPriceCard.textContent.match(/₦[0-9,]+/)[0]
    const updatedPriceNum = parseInt(updatedPriceText.replace(/[^0-9]/g, ""), 10)
    expect(updatedPriceNum).toBeGreaterThan(initialPriceNum)
  })

  it("should accurately add up quote summary with items, delivery charge, and VAT", async () => {
    sessionStorage.setItem("ll_calc_prefill", JSON.stringify({
      clientName: "Folake Ojo",
      items: [
        {
          id: "cake-1",
          type: "cake",
          name: "Item 1 — Birthday Cake",
          tiers: [
            {
              id: 1,
              size: "10",
              shape: "Round",
              layers: [{ id: 101, flavour: "Red Velvet", qty: 1 }],
              coverings: [{ id: 102, type: "Buttercream", grams: 400 }],
              fillings: [{ id: 103, type: "Buttercream", grams: 200 }]
            }
          ],
          decQty: {},
          accRows: []
        },
        {
          id: "cake-2",
          type: "cake",
          name: "Item 2 — Anniversary Cake",
          tiers: [
            {
              id: 2,
              size: "8",
              shape: "Round",
              layers: [{ id: 201, flavour: "Chocolate", qty: 1 }],
              coverings: [{ id: 202, type: "Buttercream", grams: 300 }],
              fillings: []
            }
          ],
          decQty: {},
          accRows: []
        }
      ],
      deliveryCharge: "5000",
      vatEnabled: true,
      vatRate: 7.5
    }))

    await act(async () => {
      root = createRoot(container)
      root.render(
        <OrderCalculator
          inventory={mockInventory}
          recipes={mockRecipes}
          settings={mockSettings}
          setView={jest.fn()}
          company={{ name: "BakeWealth" }}
        />
      )
    })

    // Verify Quote summary contains both items
    expect(container.textContent).toContain("Quote Summary")
    expect(container.textContent).toContain("Item 1 — Birthday Cake")
    expect(container.textContent).toContain("Item 2 — Anniversary Cake")
    expect(container.textContent).toContain("Delivery")
    expect(container.textContent).toContain("VAT (7.5%)")
    expect(container.textContent).toContain("Total (one invoice)")

    // Ensure no NaN anywhere in the container
    expect(container.textContent).not.toContain("NaN")
  })
})
