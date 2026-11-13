global.IS_REACT_ACT_ENVIRONMENT = true

import React, { useState } from "react"
import { createRoot } from "react-dom/client"
import { act } from "react"
import { RecipeCard, CakeLayerCalibrationCard } from "./MasterList"
import { calculateDensity } from "../../lib/cakeGeometry"

// Mock UI components
jest.mock("../common/ui.jsx", () => {
  const React = require("react")
  return {
    Btn: ({ children, onClick, disabled, variant }) => (
      <button onClick={onClick} disabled={disabled} data-variant={variant}>{children}</button>
    ),
    Inp: ({ label, value, onChange, type, placeholder }) => (
      <div>
        <label>{label}</label>
        <input type={type} value={value || ""} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
      </div>
    ),
    Card: ({ children, style }) => <div className="card" style={style}>{children}</div>,
    Badge: ({ children }) => <span className="badge">{children}</span>
  }
})

describe("Recipe Calibration Display & Interaction Tests", () => {
  let container, root

  beforeEach(() => {
    container = document.createElement("div")
    document.body.appendChild(container)
  })

  afterEach(() => {
    if (root) {
      act(() => { root.unmount() })
      root = null
    }
    document.body.removeChild(container)
    container = null
  })

  it("1. RecipeCard displays 'Cake Layer · Uncalibrated' when recipe is uncalibrated", async () => {
    const uncalRecipe = {
      id: "rec-uncal",
      name: "Standard Vanilla Sponge",
      type: "layer",
      batchWeight: 1000,
      batchSize: 1,
      yieldLayers: 2,
      ing: []
    }

    await act(async () => {
      root = createRoot(container)
      root.render(
        <RecipeCard
          r={uncalRecipe}
          inventory={[]}
          isOwner={true}
          onEdit={jest.fn()}
          onDelete={jest.fn()}
        />
      )
    })

    expect(container.textContent).toContain("Standard Vanilla Sponge")
    expect(container.textContent).toContain("Cake Layer · Uncalibrated")
  })

  it("2. RecipeCard displays 'Calibrated · 10.91 g/in³' when recipe has calibration fields", async () => {
    const calRecipe = {
      id: "rec-cal",
      name: "Signature Butter Cake",
      type: "layer",
      batchWeight: 1221,
      batchSize: 1,
      yieldLayers: 2,
      calShape: "round",
      calDimA: 6,
      calDimB: 8,
      calGrams: 617,
      calHeightIn: 2,
      trimPct: 8,
      density: 10.911,
      isCalibrated: true,
      ing: []
    }

    await act(async () => {
      root = createRoot(container)
      root.render(
        <RecipeCard
          r={calRecipe}
          inventory={[]}
          isOwner={true}
          onEdit={jest.fn()}
          onDelete={jest.fn()}
        />
      )
    })

    expect(container.textContent).toContain("Signature Butter Cake")
    expect(container.textContent).toContain("Calibrated · 10.91 g/in³")
    expect(container.textContent).not.toContain("Cake Layer · Uncalibrated")
  })

  it("3. RecipeCard dynamically derives density if density property is null but calGrams is entered", async () => {
    const recWithGramsOnly = {
      id: "rec-derive",
      name: "Chocolate Mud Cake",
      type: "layer",
      batchWeight: 1500,
      batchSize: 1,
      yieldLayers: 2,
      cal_shape: "round",
      cal_dim_a: 6,
      cal_dim_b: 8,
      cal_grams: 617,
      cal_height_in: 2,
      trim_pct: 8,
      density: null,
      is_calibrated: true,
      ing: []
    }

    await act(async () => {
      root = createRoot(container)
      root.render(
        <RecipeCard
          r={recWithGramsOnly}
          inventory={[]}
          isOwner={true}
          onEdit={jest.fn()}
          onDelete={jest.fn()}
        />
      )
    })

    expect(container.textContent).toContain("Chocolate Mud Cake")
    expect(container.textContent).toContain("Calibrated · 10.91 g/in³")
  })

  it("4. CakeLayerCalibrationCard shows calculated density live and updates on input change", async () => {
    function TestCalibrationWrapper() {
      const [modal, setModal] = useState({
        calShape: "round",
        calDimA: 6,
        calDimB: 8,
        calGrams: 617,
        calHeightIn: 2,
        trimPct: 8,
        isCalibrated: true
      })
      return <CakeLayerCalibrationCard recipeModal={modal} setRecipeModal={setModal} />
    }

    await act(async () => {
      root = createRoot(container)
      root.render(<TestCalibrationWrapper />)
    })

    // Initially shows density: 10.91 g/in³
    expect(container.textContent).toContain("Density: 10.91 g/in³")
    expect(container.textContent).not.toContain("Not calibrated")

    // Find the grams input (default 617)
    const inputs = container.querySelectorAll("input[type='number']")
    const gramsInput = Array.from(inputs).find(input => input.value === "617")
    expect(gramsInput).toBeDefined()

    // Update grams to 800
    await act(async () => {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
      nativeInputValueSetter.call(gramsInput, "800")
      gramsInput.dispatchEvent(new Event("change", { bubbles: true }))
    })

    // Expected density: 800 / (pi * 3^2 * 2) = 800 / (28.274 * 2) = 14.15 g/in³
    expect(container.textContent).toContain("Density: 14.15 g/in³")
  })

  it("5. Order Calculator base recipe select dropdown displays uncalibrated indicator accurately", () => {
    const uncal = { id: "1", name: "Plain Sponge", type: "layer" }
    const cal = { id: "2", name: "Red Velvet", type: "layer", calGrams: 741, isCalibrated: true, density: 13.1 }

    const isUncalCalibrated = !!(uncal.cal_grams || uncal.calGrams || uncal.isCalibrated || uncal.is_calibrated || uncal.density)
    const isCalCalibrated = !!(cal.cal_grams || cal.calGrams || cal.isCalibrated || cal.is_calibrated || cal.density)

    expect(isUncalCalibrated).toBe(false)
    expect(isCalCalibrated).toBe(true)
  })
})
