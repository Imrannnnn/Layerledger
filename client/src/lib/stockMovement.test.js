import { calculateOrderUsages } from "./data.js"

describe("calculateOrderUsages — Order Calculator to Stock Movement", () => {
  const sampleInventory = [
    { id: "flour-1", name: "Flour", unit: "kg", cost: 1000, stock: 50 },
    { id: "sugar-1", name: "Sugar", unit: "kg", cost: 1200, stock: 40 },
    { id: "butter-1", name: "Butter", unit: "kg", cost: 3000, stock: 20 },
    { id: "egg-1", name: "Eggs", unit: "pcs", cost: 150, stock: 200 },
    { id: "box-1", name: "10 inch Box", unit: "pcs", cost: 500, stock: 30 }
  ]

  const sampleRecipes = [
    {
      id: "rec-vanilla",
      name: "Vanilla Cake",
      type: "layer",
      batchWeight: 1000,
      ing: [
        { iid: "flour-1", qty: 0.5 },
        { iid: "sugar-1", qty: 0.3 },
        { iid: "egg-1", qty: 4 }
      ]
    },
    {
      id: "rec-buttercream",
      name: "Buttercream",
      type: "covering",
      batchWeight: 500,
      ing: [
        { iid: "butter-1", qty: 0.25 },
        { iid: "sugar-1", qty: 0.25 }
      ]
    },
    {
      id: "rec-meatpie",
      name: "Meat Pie",
      type: "pastry",
      batchSize: 10,
      ing: [
        { iid: "flour-1", qty: 1.0 },
        { iid: "butter-1", qty: 0.5 }
      ]
    }
  ]

  test("calculates cake tier layer ingredient usage with multipliers and layer count", () => {
    const order = {
      items: [
        {
          type: "cake",
          tiers: [
            {
              size: "8",
              shape: "Round",
              layers: [
                { flavour: "Vanilla Cake", qty: 2 }
              ],
              coverings: [],
              fillings: []
            }
          ]
        }
      ]
    }

    // 8-round multiplier is 1.5 in DEFAULT_MULTS.
    // Flour: 0.5 * 1.5 * 2 layers = 1.5 kg
    // Sugar: 0.3 * 1.5 * 2 layers = 0.9 kg
    // Eggs: 4 * 1.5 * 2 layers = 12 pcs
    const usages = calculateOrderUsages(order, sampleInventory, sampleRecipes)
    const flourUsage = usages.find(u => u.itemId === "flour-1")
    const sugarUsage = usages.find(u => u.itemId === "sugar-1")
    const eggUsage = usages.find(u => u.itemId === "egg-1")

    expect(flourUsage).toBeDefined()
    expect(flourUsage.qty).toBeCloseTo(1.5, 3)
    expect(sugarUsage).toBeDefined()
    expect(sugarUsage.qty).toBeCloseTo(0.9, 3)
    expect(eggUsage).toBeDefined()
    expect(eggUsage.qty).toBeCloseTo(12, 3)
  })

  test("calculates covering and filling ingredients based on grams used", () => {
    const order = {
      items: [
        {
          type: "cake",
          tiers: [
            {
              size: "8",
              shape: "Round",
              layers: [],
              coverings: [
                { type: "Buttercream", grams: 250 } // 250g of 500g batch = 0.5 ratio
              ],
              fillings: []
            }
          ]
        }
      ]
    }

    // Butter: 0.25 * (250 / 500) = 0.125 kg
    // Sugar: 0.25 * (250 / 500) = 0.125 kg
    const usages = calculateOrderUsages(order, sampleInventory, sampleRecipes)
    const butterUsage = usages.find(u => u.itemId === "butter-1")
    const sugarUsage = usages.find(u => u.itemId === "sugar-1")

    expect(butterUsage).toBeDefined()
    expect(butterUsage.qty).toBeCloseTo(0.125, 3)
    expect(sugarUsage).toBeDefined()
    expect(sugarUsage.qty).toBeCloseTo(0.125, 3)
  })

  test("calculates pastry item ingredient usage based on batch size", () => {
    const order = {
      items: [
        {
          type: "pastry",
          pastryItems: [
            { flavour: "Meat Pie", qty: 20 } // 20 pieces / batch of 10 = 2 batches
          ]
        }
      ]
    }

    // Flour: 1.0 * 2 = 2.0 kg
    // Butter: 0.5 * 2 = 1.0 kg
    const usages = calculateOrderUsages(order, sampleInventory, sampleRecipes)
    const flourUsage = usages.find(u => u.itemId === "flour-1")
    const butterUsage = usages.find(u => u.itemId === "butter-1")

    expect(flourUsage).toBeDefined()
    expect(flourUsage.qty).toBeCloseTo(2.0, 3)
    expect(butterUsage).toBeDefined()
    expect(butterUsage.qty).toBeCloseTo(1.0, 3)
  })

  test("handles multi-item orders combining cake, coverings, and pastries", () => {
    const order = {
      items: [
        {
          type: "cake",
          tiers: [
            {
              size: "8",
              shape: "Round",
              layers: [{ flavour: "Vanilla Cake", qty: 1 }], // Flour: 0.5 * 1.5 = 0.75
              coverings: [{ type: "Buttercream", grams: 500 }] // Butter: 0.25, Sugar: 0.25
            }
          ]
        },
        {
          type: "pastry",
          pastryItems: [
            { flavour: "Meat Pie", qty: 10 } // Flour: 1.0, Butter: 0.5
          ]
        }
      ]
    }

    const usages = calculateOrderUsages(order, sampleInventory, sampleRecipes)
    const flourUsage = usages.find(u => u.itemId === "flour-1")
    const butterUsage = usages.find(u => u.itemId === "butter-1")
    const sugarUsage = usages.find(u => u.itemId === "sugar-1")

    // Total flour: 0.75 + 1.0 = 1.75
    expect(flourUsage.qty).toBeCloseTo(1.75, 3)
    // Total butter: 0.25 + 0.5 = 0.75
    expect(butterUsage.qty).toBeCloseTo(0.75, 3)
    // Total sugar: (0.3 * 1.5) + 0.25 = 0.45 + 0.25 = 0.7
    expect(sugarUsage.qty).toBeCloseTo(0.7, 3)
  })
})
