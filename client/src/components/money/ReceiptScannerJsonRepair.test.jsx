import { extractAndRepairJson } from "./ReceiptScanner.jsx"

describe("extractAndRepairJson resilience tests", () => {
  it("parses clean standard JSON object", () => {
    const raw = JSON.stringify({
      items: [
        { item_on_receipt: "Flour 50kg", qty: 2, unit_price: 57000 }
      ],
      receipt_total: 114000
    })
    const res = extractAndRepairJson(raw)
    expect(res).toBeDefined()
    expect(res.items).toHaveLength(1)
    expect(res.items[0].item_on_receipt).toBe("Flour 50kg")
  })

  it("handles top-level JSON array and wraps into items", () => {
    const raw = JSON.stringify([
      { item_on_receipt: "Sugar 50kg", qty: 1, unit_price: 82000 },
      { item_on_receipt: "Butter carton", qty: 3, unit_price: 24000 }
    ])
    const res = extractAndRepairJson(raw)
    expect(res).toBeDefined()
    expect(res.items).toHaveLength(2)
    expect(res.items[0].item_on_receipt).toBe("Sugar 50kg")
  })

  it("extracts from markdown codeblocks with surrounding text", () => {
    const raw = `Here is the parsed bakery receipt:
\`\`\`json
{
  "items": [
    { "item_on_receipt": "Golden Penny Semovita", "qty": 5, "unit_price": 4500 }
  ],
  "receipt_total": 22500
}
\`\`\`
Let me know if you need anything else!`
    const res = extractAndRepairJson(raw)
    expect(res).toBeDefined()
    expect(res.items).toHaveLength(1)
    expect(res.items[0].item_on_receipt).toBe("Golden Penny Semovita")
  })

  it("handles trailing commas and unquoted keys", () => {
    const raw = `{
      items: [
        { item_on_receipt: "Eggs crate", qty: 10, unit_price: 4500, },
      ],
      receipt_total: 45000,
    }`
    const res = extractAndRepairJson(raw)
    expect(res).toBeDefined()
    expect(res.items).toHaveLength(1)
    expect(res.items[0].item_on_receipt).toBe("Eggs crate")
  })

  it("rescues items from truncated JSON cutoff mid-stream", () => {
    // Simulates an AI response cut off at max_tokens limit
    const raw = `{
      "items": [
        { "item_on_receipt": "Dangote Sugar 50kg", "qty": 2, "unit_price": 82000, "line_total": 164000 },
        { "item_on_receipt": "Simas Margarine", "qty": 4, "unit_price": 28000, "line_total": 112000 },
        { "item_on_receipt": "Vanilla Fla`
    const res = extractAndRepairJson(raw)
    expect(res).toBeDefined()
    expect(res.items.length).toBeGreaterThanOrEqual(2)
    expect(res.items[0].item_on_receipt).toBe("Dangote Sugar 50kg")
    expect(res.items[1].item_on_receipt).toBe("Simas Margarine")
  })

  it("uses regex fallback for text with embedded item objects", () => {
    const raw = `I found the following items:
{"item_on_receipt": "Cocoa powder", "qty": 1, "unit_price": 6000}
And also another one:
{"item_on_receipt": "Baking powder", "qty": 3, "unit_price": 1200}`
    const res = extractAndRepairJson(raw)
    expect(res).toBeDefined()
    expect(res.items).toHaveLength(2)
    expect(res.items[0].item_on_receipt).toBe("Cocoa powder")
    expect(res.items[1].item_on_receipt).toBe("Baking powder")
  })

  it("returns null for empty or invalid text", () => {
    expect(extractAndRepairJson("")).toBeNull()
    expect(extractAndRepairJson(null)).toBeNull()
    expect(extractAndRepairJson("Just some conversational text with no items")).toBeNull()
  })
})
