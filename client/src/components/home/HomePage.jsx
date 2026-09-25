import React, { useState, useEffect, useMemo } from "react"

const DENS = {
  "All-purpose flour": 0.53,
  "Bread flour": 0.55,
  "Granulated sugar": 0.85,
  "Icing sugar": 0.56,
  "Brown sugar, packed": 0.72,
  "Cocoa powder": 0.41,
  "Butter": 0.911,
  "Vegetable oil": 0.92,
  "Whole milk": 1.03,
  "Water": 1.00,
  "Honey": 1.42,
  "Golden syrup": 1.43,
  "Cornstarch": 0.54,
  "Milk powder": 0.45,
  "Desiccated coconut": 0.30,
  "Salt, fine": 1.20,
  "Baking powder": 0.90
}

const CUP = 236.588
const SIZES = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16]

const PAY = {
  standard: { 1: "", 3: "", 6: "", 12: "" },
  premium: { 1: "", 3: "", 6: "", 12: "" }
}

export function HomePage({
  onLoginClick,
  onRegisterClick,
  onGoToDashboard,
  currentUser,
  onLogout
}) {
  const [scrolled, setScrolled] = useState(false)

  // Pricing duration state: 1, 3, 6, 12
  const [durationMonths, setDurationMonths] = useState(1)
  const [discountRate, setDiscountRate] = useState(0)

  // Toolkit state
  const [activeTool, setActiveTool] = useState("conv") // "conv" | "scale" | "pan"

  // 1. Converter state
  const [cIng, setCIng] = useState("All-purpose flour")
  const [cAmt, setCAmt] = useState(100)
  const [cFrom, setCFrom] = useState("g")
  const [cTo, setCTo] = useState("ml")

  // 2. Scaler state
  const [sFromSize, setSFromSize] = useState(6)
  const [sFromShape, setSFromShape] = useState("Round")
  const [sToSize, setSToSize] = useState(8)
  const [sToShape, setSToShape] = useState("Round")

  // 3. Pan equivalents state
  const [pSize, setPSize] = useState(8)
  const [pShape, setPShape] = useState("Round")

  // Nav scroll listener
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10)
    }
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  // Helper formatting for currency
  const fmt = (n) => Number(n).toLocaleString("en-NG")

  // Pricing calculation
  const STD_BASE = 5000
  const PRM_BASE = 10000

  const stdTotal = Math.round(STD_BASE * durationMonths * (1 - discountRate))
  const prmTotal = Math.round(PRM_BASE * durationMonths * (1 - discountRate))
  const durationLabel = durationMonths === 1 ? " / month" : ` for ${durationMonths} months`

  // Converter calculations
  const { cOutText, cNoteText } = useMemo(() => {
    const d = DENS[cIng] || 1
    const a = parseFloat(cAmt) || 0
    const g = cFrom === "g" ? a : cFrom === "ml" ? a * d : a * CUP * d
    const out = cTo === "g" ? g : cTo === "ml" ? g / d : g / d / CUP
    const unit = cTo === "g" ? "g" : cTo === "ml" ? "ml" : "cups"
    const rounded = Math.round(out * 100) / 100
    return {
      cOutText: `${rounded.toLocaleString("en-NG")} ${unit}`,
      cNoteText: `Approximate conversion for ${cIng.toLowerCase()}.`
    }
  }, [cIng, cAmt, cFrom, cTo])

  // Scaler calculation
  const { sOutText, sNoteText } = useMemo(() => {
    const area = (n, shape) => shape === "Round" ? Math.PI * Math.pow(n / 2, 2) : n * n
    const a = area(Number(sFromSize), sFromShape)
    const b = area(Number(sToSize), sToShape)
    const r = a > 0 ? b / a : 1
    const roundedRatio = Math.round(r * 100) / 100
    return {
      sOutText: `× ${roundedRatio}`,
      sNoteText: `Multiply every ingredient by this number to go from a ${sFromSize}" ${sFromShape.toLowerCase()} to a ${sToSize}" ${sToShape.toLowerCase()}.`
    }
  }, [sFromSize, sFromShape, sToSize, sToShape])

  // Pan equivalent calculation
  const { pOutText, pNoteText } = useMemo(() => {
    const area = (n, shape) => shape === "Round" ? Math.PI * Math.pow(n / 2, 2) : n * n
    const shape = pShape
    const n = Number(pSize)
    const a = area(n, shape)
    const other = shape === "Round" ? "Square" : "Round"
    let best = SIZES[0]
    let diff = 1e9

    SIZES.forEach(s => {
      const d = Math.abs(area(s, other) - a)
      if (d < diff) {
        diff = d
        best = s
      }
    })

    const pct = a > 0 ? Math.round((area(best, other) / a - 1) * 100) : 0
    const pctDesc = pct === 0 ? "." : `, which is ${pct > 0 ? pct + "% more" : Math.abs(pct) + "% less"} batter.`
    return {
      pOutText: `${best}" ${other.toLowerCase()}`,
      pNoteText: `A ${n}" ${shape.toLowerCase()} holds about the same as a ${best}" ${other.toLowerCase()}${pctDesc}`
    }
  }, [pSize, pShape])

  const handleChoosePlan = (plan) => {
    const payLink = PAY[plan]?.[durationMonths]
    if (payLink) {
      window.location.href = payLink
      return
    }
    if (currentUser) {
      if (onGoToDashboard) onGoToDashboard()
    } else {
      if (onRegisterClick) onRegisterClick(plan)
    }
  }

  return (
    <div className="bw-home-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,700;12..96,800&family=Inter:wght@400;500;600;700&display=swap');

        .bw-home-root {
          --bg: #FCF8F2;
          --bg-alt: #FAF0E9;
          --bg-deep: #F6E9DE;
          --ink: #3B2317;
          --ink-soft: #6E5546;
          --ink-faint: #8E7565;
          --brand: #4A2B1B;
          --brand-hover: #5D3926;
          --gold: #B98B32;
          --gold-soft: #D9B978;
          --line: #EADFD0;
          --card: #FFFFFF;
          --radius: 18px;
          --radius-sm: 12px;
          --maxw: 1200px;
          background: var(--bg);
          color: var(--ink);
          font-family: Inter, system-ui, -apple-system, "Segoe UI", sans-serif;
          font-size: 17px;
          line-height: 1.65;
          -webkit-font-smoothing: antialiased;
          min-height: 100vh;
        }

        .bw-home-root * {
          box-sizing: border-box;
        }

        .bw-home-root h1,
        .bw-home-root h2,
        .bw-home-root h3,
        .bw-home-root h4 {
          font-family: "Bricolage Grotesque", Inter, system-ui, sans-serif;
          font-weight: 800;
          letter-spacing: -0.02em;
          line-height: 1.08;
          margin: 0;
        }

        .bw-home-root p { margin: 0; }
        .bw-home-root img { max-width: 100%; }
        .bw-home-root a { color: inherit; }

        .bw-home-root .wrap {
          max-width: var(--maxw);
          margin: 0 auto;
          padding: 0 24px;
        }

        .bw-home-root .eyebrow {
          font-size: 12.5px;
          font-weight: 700;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: var(--gold);
          display: flex;
          align-items: center;
          gap: 8px;
          justify-content: center;
        }
        .bw-home-root .eyebrow.left { justify-content: flex-start; }

        .bw-home-root .btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border-radius: 999px;
          padding: 14px 26px;
          font-weight: 600;
          font-size: 16px;
          text-decoration: none;
          border: 1.5px solid transparent;
          cursor: pointer;
          transition: 0.18s;
          font-family: inherit;
        }
        .bw-home-root .btn-primary {
          background: var(--brand);
          color: #FFF6EA;
        }
        .bw-home-root .btn-primary:hover {
          background: var(--brand-hover);
        }
        .bw-home-root .btn-ghost {
          background: #fff;
          color: var(--ink);
          border-color: var(--line);
        }
        .bw-home-root .btn-ghost:hover {
          border-color: var(--gold-soft);
        }
        .bw-home-root .btn-gold {
          background: var(--gold);
          color: #3B2317;
        }
        .bw-home-root .btn-gold:hover {
          background: #A87B27;
        }
        .bw-home-root .btn-block {
          width: 100%;
          justify-content: center;
        }

        /* NAV */
        .bw-home-root .nav {
          position: sticky;
          top: 0;
          z-index: 50;
          background: rgba(252, 248, 242, 0.94);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid transparent;
          transition: border-color 0.2s ease, background 0.2s ease;
        }
        .bw-home-root .nav.scrolled {
          border-bottom-color: var(--line);
          box-shadow: 0 4px 20px -8px rgba(59, 35, 23, 0.08);
        }
        .bw-home-root .nav-in {
          display: flex;
          align-items: center;
          gap: 28px;
          height: 86px;
        }
        .bw-home-root .brand-logo-wrap {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          text-decoration: none;
          color: var(--ink);
          font-family: "Bricolage Grotesque", sans-serif;
          font-weight: 800;
          font-size: 24px;
          letter-spacing: -0.03em;
        }
        .bw-home-root .brand-logo-img {
          height: 44px;
          width: auto;
          max-width: 130px;
          border-radius: 8px;
          object-fit: contain;
          border: 1px solid var(--line);
          background: #fff;
          box-shadow: 0 2px 6px rgba(59, 35, 23, 0.05);
        }
        .bw-home-root .nav-links {
          display: flex;
          gap: 26px;
          margin-left: 24px;
          flex: 1;
        }
        .bw-home-root .nav-links a {
          text-decoration: none;
          color: var(--ink-soft);
          font-size: 16px;
          font-weight: 500;
          transition: color 0.15s;
        }
        .bw-home-root .nav-links a:hover {
          color: var(--ink);
        }
        .bw-home-root .nav-cta {
          display: flex;
          gap: 12px;
          align-items: center;
        }

        /* HERO */
        .bw-home-root .hero {
          padding: 64px 0 88px;
        }
        .bw-home-root .hero-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 56px;
          align-items: center;
        }
        .bw-home-root .hero h1 {
          font-size: clamp(44px, 5.4vw, 76px);
          margin: 22px 0 24px;
        }
        .bw-home-root .hero p.lead {
          font-size: 19px;
          color: var(--ink-soft);
          max-width: 520px;
        }
        .bw-home-root .hero-btns {
          display: flex;
          gap: 14px;
          flex-wrap: wrap;
          margin-top: 34px;
        }
        .bw-home-root .hero-note {
          font-size: 14.5px;
          color: var(--ink-faint);
          margin-top: 22px;
        }

        /* DASHBOARD MOCK */
        .bw-home-root .mock {
          background: var(--card);
          border: 1px solid var(--line);
          border-radius: 22px;
          padding: 26px;
          box-shadow: 0 24px 60px -30px rgba(59, 35, 23, 0.28);
          position: relative;
        }
        .bw-home-root .mock-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-bottom: 16px;
          border-bottom: 1px solid var(--line);
        }
        .bw-home-root .mock-brand {
          font-weight: 700;
          font-size: 15px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .bw-home-root .mock-brand span {
          color: var(--ink-faint);
          font-weight: 500;
        }
        .bw-home-root .chip {
          background: var(--bg-deep);
          border-radius: 999px;
          padding: 5px 13px;
          font-size: 12px;
          font-weight: 600;
          color: var(--ink-soft);
        }
        .bw-home-root .mock h3 {
          font-size: 22px;
          margin: 20px 0 16px;
        }
        .bw-home-root .stat-row {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
        }
        .bw-home-root .stat {
          background: var(--bg-alt);
          border-radius: var(--radius-sm);
          padding: 14px;
        }
        .bw-home-root .stat .k {
          font-size: 11.5px;
          color: var(--ink-faint);
          font-weight: 500;
        }
        .bw-home-root .stat .v {
          font-family: "Bricolage Grotesque", sans-serif;
          font-size: 23px;
          font-weight: 800;
          margin: 3px 0;
        }
        .bw-home-root .stat .s {
          font-size: 11.5px;
          color: var(--ink-faint);
        }
        .bw-home-root .mock-cols {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-top: 14px;
        }
        .bw-home-root .panel {
          border: 1px solid var(--line);
          border-radius: var(--radius-sm);
          padding: 15px;
        }
        .bw-home-root .panel h4 {
          font-size: 14.5px;
          margin-bottom: 12px;
        }
        .bw-home-root .bar-row {
          display: flex;
          align-items: center;
          gap: 9px;
          margin-bottom: 11px;
          font-size: 12.5px;
        }
        .bw-home-root .bar-dot {
          width: 24px;
          height: 24px;
          border-radius: 7px;
          background: var(--bg-deep);
          flex: none;
        }
        .bw-home-root .bar-name {
          flex: 1;
          color: var(--ink-soft);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .bw-home-root .bar {
          height: 5px;
          background: var(--bg-deep);
          border-radius: 99px;
          margin-top: 5px;
          overflow: hidden;
        }
        .bw-home-root .bar i {
          display: block;
          height: 100%;
          background: var(--gold-soft);
        }
        .bw-home-root .pct {
          font-weight: 700;
          font-size: 12.5px;
        }
        .bw-home-root .todo {
          display: flex;
          align-items: center;
          gap: 9px;
          font-size: 12.5px;
          color: var(--ink-soft);
          margin-bottom: 11px;
        }
        .bw-home-root .todo i {
          width: 22px;
          height: 22px;
          border-radius: 7px;
          background: var(--bg-deep);
          flex: none;
          display: grid;
          place-items: center;
          font-style: normal;
          font-size: 11px;
          color: var(--gold);
        }
        .bw-home-root .float {
          position: absolute;
          left: -14px;
          bottom: 52px;
          background: var(--card);
          border: 1px solid var(--line);
          border-radius: var(--radius-sm);
          padding: 15px 17px;
          max-width: 250px;
          box-shadow: 0 18px 44px -22px rgba(59, 35, 23, 0.3);
        }
        .bw-home-root .float b {
          font-size: 13.5px;
          display: block;
          margin-bottom: 5px;
        }
        .bw-home-root .float p {
          font-size: 12.5px;
          color: var(--ink-soft);
          line-height: 1.5;
        }

        /* SECTIONS */
        .bw-home-root section {
          padding: 92px 0;
        }
        .bw-home-root .alt {
          background: var(--bg-alt);
        }
        .bw-home-root .sec-head {
          text-align: center;
          max-width: 720px;
          margin: 0 auto 52px;
        }
        .bw-home-root .sec-head h2 {
          font-size: clamp(34px, 4vw, 52px);
          margin: 16px 0 18px;
        }
        .bw-home-root .sec-head p {
          color: var(--ink-soft);
          font-size: 18px;
        }

        /* FEATURE CARDS */
        .bw-home-root .cards {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
        }
        .bw-home-root .card {
          background: var(--card);
          border: 1px solid var(--line);
          border-radius: var(--radius);
          padding: 28px;
          transition: 0.2s;
        }
        .bw-home-root .card:hover {
          border-color: var(--gold-soft);
          transform: translateY(-2px);
        }
        .bw-home-root .card .ico {
          width: 46px;
          height: 46px;
          border-radius: 13px;
          background: var(--bg-deep);
          display: grid;
          place-items: center;
          margin-bottom: 18px;
          font-size: 20px;
        }
        .bw-home-root .card h3 {
          font-size: 20px;
          margin-bottom: 10px;
        }
        .bw-home-root .card p {
          color: var(--ink-soft);
          font-size: 15.5px;
          line-height: 1.6;
        }
        .bw-home-root .alt .card {
          background: var(--bg);
        }

        /* TOOLKIT */
        .bw-home-root .toolkit-grid {
          display: grid;
          grid-template-columns: 0.85fr 1.15fr;
          gap: 48px;
          align-items: start;
        }
        .bw-home-root .tabs {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 22px;
        }
        .bw-home-root .tab {
          border-radius: 999px;
          padding: 10px 20px;
          font-size: 14.5px;
          font-weight: 600;
          border: 1px solid var(--line);
          background: var(--card);
          cursor: pointer;
          color: var(--ink-soft);
          font-family: inherit;
          transition: 0.15s;
        }
        .bw-home-root .tab.on {
          background: var(--brand);
          color: #FFF6EA;
          border-color: var(--brand);
        }
        .bw-home-root .tool {
          background: var(--card);
          border: 1px solid var(--line);
          border-radius: 22px;
          padding: 30px;
        }
        .bw-home-root .tool h3 {
          font-size: 22px;
          margin-bottom: 8px;
        }
        .bw-home-root .tool .hint {
          color: var(--ink-soft);
          font-size: 14.5px;
          margin-bottom: 22px;
        }
        .bw-home-root .fields {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .bw-home-root .f label {
          display: block;
          font-size: 13.5px;
          font-weight: 600;
          margin-bottom: 7px;
          color: var(--ink-soft);
        }
        .bw-home-root .f select,
        .bw-home-root .f input {
          width: 100%;
          border: 1px solid var(--line);
          border-radius: 11px;
          padding: 13px 14px;
          font-size: 15.5px;
          font-family: inherit;
          background: var(--bg);
          color: var(--ink);
          outline: none;
        }
        .bw-home-root .f select:focus,
        .bw-home-root .f input:focus {
          border-color: var(--gold-soft);
        }
        .bw-home-root .result {
          background: var(--bg-deep);
          border-radius: 14px;
          padding: 20px;
          margin-top: 22px;
        }
        .bw-home-root .result .big {
          font-family: "Bricolage Grotesque", sans-serif;
          font-size: 30px;
          font-weight: 800;
        }
        .bw-home-root .result .sm {
          font-size: 13.5px;
          color: var(--ink-soft);
          margin-top: 5px;
        }
        .bw-home-root .fineprint {
          font-size: 12.5px;
          color: var(--ink-faint);
          margin-top: 16px;
        }

        /* STEPS */
        .bw-home-root .steps {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0;
        }
        .bw-home-root .step {
          border-left: 2px solid var(--line);
          padding: 6px 30px 6px 26px;
        }
        .bw-home-root .step .n {
          font-size: 12.5px;
          font-weight: 700;
          letter-spacing: 0.14em;
          color: var(--gold);
          text-transform: uppercase;
          margin-bottom: 10px;
        }
        .bw-home-root .step h3 {
          font-size: 20px;
          margin-bottom: 10px;
        }
        .bw-home-root .step p {
          color: var(--ink-soft);
          font-size: 15.5px;
        }

        /* PRICING */
        .bw-home-root .dur {
          display: flex;
          gap: 9px;
          justify-content: center;
          flex-wrap: wrap;
          margin-bottom: 14px;
        }
        .bw-home-root .dur button {
          border-radius: 11px;
          padding: 11px 20px;
          font-size: 14.5px;
          font-weight: 600;
          border: 1.5px solid var(--line);
          background: var(--card);
          cursor: pointer;
          color: var(--ink-soft);
          font-family: inherit;
          transition: 0.15s;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .bw-home-root .dur button.on {
          border-color: var(--gold);
          color: var(--ink);
          background: #fff;
          box-shadow: 0 4px 12px rgba(185, 139, 50, 0.12);
        }
        .bw-home-root .save {
          background: #E8F3EC;
          color: #1E6B45;
          border-radius: 6px;
          padding: 2px 7px;
          font-size: 11px;
          font-weight: 700;
        }
        .bw-home-root .dur-note {
          text-align: center;
          font-size: 13.5px;
          color: var(--ink-faint);
          margin-bottom: 40px;
        }
        .bw-home-root .plans {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
          align-items: start;
        }
        .bw-home-root .plan {
          background: var(--card);
          border: 1.5px solid var(--line);
          border-radius: var(--radius);
          padding: 30px;
          position: relative;
          display: flex;
          flex-direction: column;
          height: 100%;
        }
        .bw-home-root .plan.featured {
          border-color: var(--gold);
          box-shadow: 0 20px 50px -28px rgba(185, 139, 50, 0.5);
        }
        .bw-home-root .ribbon {
          position: absolute;
          top: -13px;
          left: 50%;
          transform: translateX(-50%);
          background: var(--gold);
          color: #3B2317;
          font-size: 11.5px;
          font-weight: 700;
          letter-spacing: 0.09em;
          padding: 5px 15px;
          border-radius: 999px;
          white-space: nowrap;
        }
        .bw-home-root .plan h3 {
          font-size: 25px;
          margin-bottom: 7px;
        }
        .bw-home-root .plan .tagline {
          color: var(--ink-soft);
          font-size: 14.5px;
          min-height: 44px;
        }
        .bw-home-root .price-box {
          background: var(--bg-alt);
          border-radius: 14px;
          padding: 19px;
          margin: 20px 0;
        }
        .bw-home-root .price {
          font-family: "Bricolage Grotesque", sans-serif;
          font-size: 38px;
          font-weight: 800;
          color: var(--gold);
          line-height: 1;
        }
        .bw-home-root .price .per {
          font-size: 15px;
          color: var(--ink-soft);
          font-weight: 600;
          font-family: Inter, sans-serif;
        }
        .bw-home-root .price-sub {
          font-size: 13px;
          color: var(--ink-soft);
          margin-top: 7px;
        }
        .bw-home-root .was {
          font-size: 13.5px;
          color: var(--ink-faint);
          text-decoration: line-through;
          margin-top: 4px;
        }
        .bw-home-root .plan ul {
          list-style: none;
          padding: 0;
          margin: 0 0 24px;
          flex: 1;
        }
        .bw-home-root .plan li {
          display: flex;
          gap: 10px;
          font-size: 14.5px;
          padding: 7px 0;
          color: var(--ink-soft);
          align-items: flex-start;
        }
        .bw-home-root .plan li b {
          color: var(--ink);
          font-weight: 600;
        }
        .bw-home-root .tick {
          color: #1E6B45;
          flex: none;
          font-weight: 700;
        }
        .bw-home-root .packs {
          margin-top: 44px;
          background: var(--card);
          border: 1px solid var(--line);
          border-radius: var(--radius);
          padding: 30px;
        }
        .bw-home-root .packs h3 {
          font-size: 22px;
          margin-bottom: 8px;
        }
        .bw-home-root .packs > p {
          color: var(--ink-soft);
          font-size: 15px;
          margin-bottom: 22px;
        }
        .bw-home-root .pack-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }
        .bw-home-root .pack {
          border: 1px solid var(--line);
          border-radius: 14px;
          padding: 20px;
          text-align: center;
        }
        .bw-home-root .pack .nm {
          font-weight: 700;
          font-size: 16px;
        }
        .bw-home-root .pack .cr {
          font-family: "Bricolage Grotesque", sans-serif;
          font-size: 26px;
          font-weight: 800;
          color: var(--gold);
          margin: 8px 0 2px;
        }
        .bw-home-root .pack .sc {
          font-size: 13px;
          color: var(--ink-soft);
          margin-bottom: 14px;
        }
        .bw-home-root .arith {
          background: var(--bg-alt);
          border-radius: 12px;
          padding: 17px;
          margin-top: 22px;
          font-size: 14.5px;
          color: var(--ink-soft);
          display: flex;
          gap: 12px;
        }
        .bw-home-root .arith b {
          color: var(--ink);
        }

        /* CTA + FOOTER */
        .bw-home-root .cta-wrap {
          background: var(--bg-deep);
          border-radius: 26px;
          padding: 64px 40px;
          text-align: center;
        }
        .bw-home-root .cta-wrap h2 {
          font-size: clamp(32px, 4vw, 48px);
          margin: 16px auto 18px;
          max-width: 760px;
        }
        .bw-home-root .cta-wrap p {
          color: var(--ink-soft);
          font-size: 18px;
          max-width: 600px;
          margin: 0 auto 32px;
        }
        .bw-home-root footer {
          background: var(--brand);
          color: #E4D4C2;
          padding: 56px 0 40px;
          margin-top: 0;
        }
        .bw-home-root .foot-grid {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr;
          gap: 40px;
        }
        .bw-home-root footer .brand-logo-wrap {
          color: #FFF6EA;
          margin-bottom: 12px;
        }
        .bw-home-root footer p {
          font-size: 14.5px;
          line-height: 1.6;
          max-width: 320px;
        }
        .bw-home-root footer h4 {
          font-size: 13px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--gold-soft);
          margin-bottom: 14px;
          font-weight: 700;
        }
        .bw-home-root footer a {
          display: block;
          color: #E4D4C2;
          text-decoration: none;
          font-size: 14.5px;
          padding: 5px 0;
          font-family: Inter, sans-serif;
          font-weight: 400;
        }
        .bw-home-root footer a:hover {
          color: #FFF6EA;
        }
        .bw-home-root .foot-base {
          border-top: 1px solid rgba(255, 246, 234, 0.16);
          margin-top: 40px;
          padding-top: 24px;
          display: flex;
          justify-content: space-between;
          font-size: 13.5px;
          gap: 16px;
          flex-wrap: wrap;
        }

        @media (max-width: 940px) {
          .bw-home-root .hero-grid,
          .bw-home-root .toolkit-grid {
            grid-template-columns: 1fr;
            gap: 40px;
          }
          .bw-home-root .cards,
          .bw-home-root .plans,
          .bw-home-root .pack-grid {
            grid-template-columns: 1fr;
          }
          .bw-home-root .steps {
            grid-template-columns: 1fr;
            gap: 26px;
          }
          .bw-home-root .step {
            border-left: 2px solid var(--line);
            padding-left: 22px;
          }
          .bw-home-root .nav-links {
            display: none;
          }
          .bw-home-root .foot-grid {
            grid-template-columns: 1fr;
            gap: 28px;
          }
          .bw-home-root .float {
            position: static;
            max-width: none;
            margin-top: 16px;
          }
          .bw-home-root section {
            padding: 66px 0;
          }
          .bw-home-root .hero {
            padding: 40px 0 60px;
          }
          .bw-home-root .mock-cols {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 560px) {
          .bw-home-root .fields {
            grid-template-columns: 1fr;
          }
          .bw-home-root .stat-row {
            grid-template-columns: 1fr;
          }
          .bw-home-root .hero-btns .btn {
            width: 100%;
            justify-content: center;
          }
          .bw-home-root .cta-wrap {
            padding: 44px 22px;
          }
        }
      `}</style>

      {/* NAVIGATION */}
      <nav className={`nav ${scrolled ? "scrolled" : ""}`} id="nav">
        <div className="wrap nav-in">
          <a href="#" className="brand-logo-wrap" title="BakeWealth Home">
            <img
              src="/Bakewealthlogo.jpeg"
              alt="BakeWealth Logo"
              className="brand-logo-img"
            />
            <span>BakeWealth</span>
          </a>

          <div className="nav-links">
            <a href="#features">What you can do</a>
            <a href="#toolkit">Baker's toolkit</a>
            <a href="#pricing">Pricing</a>
            <a href="#how">How it works</a>
          </div>

          <div className="nav-cta">
            {currentUser ? (
              <>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={onGoToDashboard}
                >
                  Go to Workspace ↗
                </button>
                {onLogout && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={onLogout}
                    title="Log out"
                  >
                    Log out
                  </button>
                )}
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={onLoginClick}
                >
                  Log in
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={onRegisterClick}
                >
                  Get started ↗
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* HERO */}
      <header className="hero">
        <div className="wrap hero-grid">
          <div>
            <div className="eyebrow left">✦ A little more ease behind every bake</div>
            <h1>Your baking business, beautifully organized.</h1>
            <p className="lead">
              From the first customer message to the final flourish, keep your orders,
              ingredients, recipes and business details together, with smart AI support along the way.
            </p>
            <div className="hero-btns">
              <a className="btn btn-primary" href="#pricing">See the plans →</a>
              <a className="btn btn-ghost" href="#toolkit">Try the baker's toolkit</a>
            </div>
            <p className="hero-note">Made for home bakers, cake artists and growing baking businesses.</p>
          </div>

          <div className="mock">
            <div className="mock-top">
              <div className="mock-brand">
                <img
                  src="/Bakewealthlogo.jpeg"
                  alt="BakeWealth"
                  style={{ height: 26, width: "auto", borderRadius: 5, border: "1px solid var(--line)" }}
                />
                <span>BakeWealth <span>/ My workspace</span></span>
              </div>
              <div className="chip">Your business</div>
            </div>

            <h3>A sweet little overview</h3>

            <div className="stat-row">
              <div className="stat">
                <div className="k">Orders to make</div>
                <div className="v">12</div>
                <div className="s">This week</div>
              </div>
              <div className="stat">
                <div className="k">Ingredients</div>
                <div className="v">All set</div>
                <div className="s">Stock at a glance</div>
              </div>
              <div className="stat">
                <div className="k">Recipes</div>
                <div className="v">24</div>
                <div className="s">Costed &amp; saved</div>
              </div>
            </div>

            <div className="mock-cols">
              <div className="panel">
                <h4>Recipe cost snapshot</h4>
                <div className="bar-row">
                  <div className="bar-dot"></div>
                  <div style={{ flex: 1 }}>
                    <div className="bar-name">Vanilla celebration cake</div>
                    <div className="bar"><i style={{ width: "68%" }}></i></div>
                  </div>
                  <div className="pct">68%</div>
                </div>
                <div className="bar-row">
                  <div className="bar-dot"></div>
                  <div style={{ flex: 1 }}>
                    <div className="bar-name">Chocolate fudge tier</div>
                    <div className="bar"><i style={{ width: "43%" }}></i></div>
                  </div>
                  <div className="pct">43%</div>
                </div>
                <div className="bar-row">
                  <div className="bar-dot"></div>
                  <div style={{ flex: 1 }}>
                    <div className="bar-name">Red velvet, 8 inch</div>
                    <div className="bar"><i style={{ width: "57%" }}></i></div>
                  </div>
                  <div className="pct">57%</div>
                </div>
              </div>

              <div className="panel">
                <h4>Today's little list</h4>
                <div className="todo"><i>♡</i> Confirm order details</div>
                <div className="todo"><i>◈</i> Check ingredient stock</div>
                <div className="todo"><i>✓</i> Plan tomorrow's bake</div>
              </div>
            </div>

            <div className="float">
              <b>✦ Your AI baking-sidekick</b>
              <p>Quick help with the business details, so you can keep your hands and mind on your craft.</p>
            </div>
          </div>
        </div>
      </header>

      {/* FEATURES */}
      <section id="features" className="alt">
        <div className="wrap">
          <div className="sec-head">
            <div className="eyebrow">Your business, in rhythm</div>
            <h2>More space for the joy of baking.</h2>
            <p>
              Keep the behind-the-scenes details in order, so you can give your creativity
              and your customers the attention they deserve.
            </p>
          </div>

          <div className="cards">
            <div className="card">
              <div className="ico">▤</div>
              <h3>Orders, without the scramble</h3>
              <p>Keep requests, order details, deadlines and progress together, from inquiry to collection.</p>
            </div>
            <div className="card">
              <div className="ico">◫</div>
              <h3>Ingredients at a glance</h3>
              <p>Track stock, follow ingredient use and spot what needs replenishing before your next big bake.</p>
            </div>
            <div className="card">
              <div className="ico">◑</div>
              <h3>Recipe costing made clearer</h3>
              <p>Understand what each recipe costs and make more informed decisions about your pricing.</p>
            </div>
            <div className="card">
              <div className="ico">♡</div>
              <h3>Customers you remember</h3>
              <p>Keep customer details and order history close, for thoughtful service and smoother repeat orders.</p>
            </div>
            <div className="card">
              <div className="ico">✦</div>
              <h3>AI in your corner</h3>
              <p>Scan receipts and statements, and get smart assistance with everyday workflows, while you stay in control.</p>
            </div>
            <div className="card">
              <div className="ico">◈</div>
              <h3>A clearer view of business</h3>
              <p>Bring your activity, invoices and reports together to understand what is happening and plan what comes next.</p>
            </div>
          </div>
        </div>
      </section>

      {/* TOOLKIT */}
      <section id="toolkit">
        <div className="wrap toolkit-grid">
          <div>
            <div className="eyebrow left">✦ A little something for your next bake</div>
            <h2 style={{ fontSize: "clamp(34px, 4vw, 50px)", margin: "18px 0 16px" }}>The Baker's Toolkit</h2>
            <p style={{ color: "var(--ink-soft)", fontSize: "17px" }}>
              Quick, handy calculators for everyday baking questions. No account needed. Choose a tool and get a useful estimate.
            </p>
            <p style={{ marginTop: 22 }}>
              <span className="chip">✦ Free tools for your baking day</span>
            </p>
          </div>

          <div>
            <div className="tabs">
              <button
                type="button"
                className={`tab ${activeTool === "conv" ? "on" : ""}`}
                onClick={() => setActiveTool("conv")}
              >
                Weight ↔ volume
              </button>
              <button
                type="button"
                className={`tab ${activeTool === "scale" ? "on" : ""}`}
                onClick={() => setActiveTool("scale")}
              >
                Recipe scaler
              </button>
              <button
                type="button"
                className={`tab ${activeTool === "pan" ? "on" : ""}`}
                onClick={() => setActiveTool("pan")}
              >
                Pan size
              </button>
            </div>

            {/* TOOL 1: CONVERTER */}
            {activeTool === "conv" && (
              <div className="tool" id="t-conv">
                <h3>Ingredient conversion</h3>
                <p className="hint">Convert common baking ingredients between grams and millilitres or cups.</p>
                <div className="fields">
                  <div className="f">
                    <label>Ingredient</label>
                    <select
                      value={cIng}
                      onChange={(e) => setCIng(e.target.value)}
                    >
                      {Object.keys(DENS).map((k) => (
                        <option key={k} value={k}>{k}</option>
                      ))}
                    </select>
                  </div>
                  <div className="f">
                    <label>Amount</label>
                    <input
                      type="number"
                      value={cAmt}
                      min="0"
                      step="any"
                      onChange={(e) => setCAmt(e.target.value)}
                    />
                  </div>
                  <div className="f">
                    <label>Convert from</label>
                    <select
                      value={cFrom}
                      onChange={(e) => setCFrom(e.target.value)}
                    >
                      <option value="g">Grams (g)</option>
                      <option value="ml">Millilitres (ml)</option>
                      <option value="cup">Cups</option>
                    </select>
                  </div>
                  <div className="f">
                    <label>Convert to</label>
                    <select
                      value={cTo}
                      onChange={(e) => setCTo(e.target.value)}
                    >
                      <option value="ml">Millilitres (ml)</option>
                      <option value="g">Grams (g)</option>
                      <option value="cup">Cups</option>
                    </select>
                  </div>
                </div>

                <div className="result">
                  <div className="big">{cOutText}</div>
                  <div className="sm">{cNoteText}</div>
                </div>
                <p className="fineprint">Approximate kitchen conversions. Actual weights vary by ingredient, packing and measuring method.</p>
              </div>
            )}

            {/* TOOL 2: RECIPE SCALER */}
            {activeTool === "scale" && (
              <div className="tool" id="t-scale">
                <h3>Recipe scaler</h3>
                <p className="hint">Your recipe was written for one pan. Work out what it becomes in another.</p>
                <div className="fields">
                  <div className="f">
                    <label>Recipe written for</label>
                    <select
                      value={sFromSize}
                      onChange={(e) => setSFromSize(Number(e.target.value))}
                    >
                      {SIZES.map(n => (
                        <option key={n} value={n}>{n}"</option>
                      ))}
                    </select>
                  </div>
                  <div className="f">
                    <label>Shape</label>
                    <select
                      value={sFromShape}
                      onChange={(e) => setSFromShape(e.target.value)}
                    >
                      <option value="Round">Round</option>
                      <option value="Square">Square</option>
                    </select>
                  </div>
                  <div className="f">
                    <label>You want to bake</label>
                    <select
                      value={sToSize}
                      onChange={(e) => setSToSize(Number(e.target.value))}
                    >
                      {SIZES.map(n => (
                        <option key={n} value={n}>{n}"</option>
                      ))}
                    </select>
                  </div>
                  <div className="f">
                    <label>Shape</label>
                    <select
                      value={sToShape}
                      onChange={(e) => setSToShape(e.target.value)}
                    >
                      <option value="Round">Round</option>
                      <option value="Square">Square</option>
                    </select>
                  </div>
                </div>

                <div className="result">
                  <div className="big">{sOutText}</div>
                  <div className="sm">{sNoteText}</div>
                </div>
                <p className="fineprint">Assumes the same layer height in both pans. Scaling is by pan area.</p>
              </div>
            )}

            {/* TOOL 3: PAN SIZE EQUIVALENTS */}
            {activeTool === "pan" && (
              <div className="tool" id="t-pan">
                <h3>Pan size equivalents</h3>
                <p className="hint">Which pans hold roughly the same amount of batter?</p>
                <div className="fields">
                  <div className="f">
                    <label>Pan size</label>
                    <select
                      value={pSize}
                      onChange={(e) => setPSize(Number(e.target.value))}
                    >
                      {SIZES.map(n => (
                        <option key={n} value={n}>{n}"</option>
                      ))}
                    </select>
                  </div>
                  <div className="f">
                    <label>Shape</label>
                    <select
                      value={pShape}
                      onChange={(e) => setPShape(e.target.value)}
                    >
                      <option value="Round">Round</option>
                      <option value="Square">Square</option>
                    </select>
                  </div>
                </div>

                <div className="result">
                  <div className="big">{pOutText}</div>
                  <div className="sm">{pNoteText}</div>
                </div>
                <p className="fineprint">Based on surface area. Keep the batter depth the same and adjust baking time.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="alt">
        <div className="wrap">
          <div className="sec-head">
            <div className="eyebrow">Simple by design</div>
            <h2>Made to fit the way bakers work.</h2>
            <p>Less juggling between tools. More clarity from one step to the next.</p>
          </div>

          <div className="steps">
            <div className="step">
              <div className="n">01 / Organize</div>
              <h3>Bring the details together</h3>
              <p>Keep orders, customer information, ingredients and recipes in one workspace.</p>
            </div>
            <div className="step">
              <div className="n">02 / Understand</div>
              <h3>Make informed choices</h3>
              <p>Use costing, stock visibility and business reports to plan with more confidence.</p>
            </div>
            <div className="step">
              <div className="n">03 / Grow</div>
              <h3>Get support as you go</h3>
              <p>Use AI assistance and connected workflows to make everyday business tasks easier.</p>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing">
        <div className="wrap">
          <div className="sec-head">
            <div className="eyebrow">Ready when you are</div>
            <h2>Prepaid plans. No auto-renewal, no surprises.</h2>
            <p>
              Pay for what you need, when you need it. Multi-month purchases carry a discount,
              and plans stack, so you can add time whenever it suits you.
            </p>
          </div>

          <div className="dur" id="dur">
            <button
              type="button"
              className={durationMonths === 1 ? "on" : ""}
              onClick={() => { setDurationMonths(1); setDiscountRate(0); }}
            >
              1 Month
            </button>
            <button
              type="button"
              className={durationMonths === 3 ? "on" : ""}
              onClick={() => { setDurationMonths(3); setDiscountRate(0.05); }}
            >
              3 Months <span className="save">5% off</span>
            </button>
            <button
              type="button"
              className={durationMonths === 6 ? "on" : ""}
              onClick={() => { setDurationMonths(6); setDiscountRate(0.10); }}
            >
              6 Months <span className="save">10% off</span>
            </button>
            <button
              type="button"
              className={durationMonths === 12 ? "on" : ""}
              onClick={() => { setDurationMonths(12); setDiscountRate(0.15); }}
            >
              12 Months <span className="save">15% off</span>
            </button>
          </div>

          <p className="dur-note">Stackable anytime. Buy more months whenever you like and they add to what you have.</p>

          <div className="plans">
            {/* FREE PLAN */}
            <div className="plan">
              <h3>Free</h3>
              <p className="tagline">Explore BakeWealth without commitments. Upgrade anytime.</p>
              <div className="price-box">
                <div className="price">₦0</div>
                <div className="price-sub">No card needed</div>
              </div>
              <ul>
                <li><span className="tick">✓</span><span>Orders: <b>limited</b></span></li>
                <li><span className="tick">✓</span><span>Recipes: <b>limited</b></span></li>
                <li><span className="tick">✓</span><span>Inventory: <b>limited</b></span></li>
                <li><span className="tick">✓</span><span>Client records: <b>limited</b></span></li>
                <li><span className="tick">✓</span><span>Invoices with BakeWealth mark</span></li>
                <li><span className="tick">✓</span><span>See how it fits your business before you spend anything</span></li>
              </ul>
              <button
                type="button"
                className="btn btn-ghost btn-block"
                onClick={() => onRegisterClick ? onRegisterClick("free") : handleChoosePlan("free")}
              >
                Start free
              </button>
            </div>

            {/* STANDARD PLAN */}
            <div className="plan">
              <h3>Standard</h3>
              <p className="tagline">Essential tools for growing home and boutique bakers.</p>
              <div className="price-box">
                <div className="price">
                  ₦<span>{fmt(stdTotal)}</span>
                  <span className="per">{durationLabel}</span>
                </div>
                {discountRate > 0 && (
                  <div className="was">
                    was ₦{fmt(STD_BASE * durationMonths)}
                  </div>
                )}
                <div className="price-sub">
                  Includes {fmt(40 * durationMonths)} scan credits, about {fmt(20 * durationMonths)} receipt scans
                </div>
              </div>
              <ul>
                <li><span className="tick">✓</span><span>Orders: <b>Unlimited</b></span></li>
                <li><span className="tick">✓</span><span>Recipes: <b>60</b></span></li>
                <li><span className="tick">✓</span><span>Inventory items: <b>250</b></span></li>
                <li><span className="tick">✓</span><span>Client records: <b>150</b></span></li>
                <li><span className="tick">✓</span><span>Staff logins: <b>2</b> plus owner</span></li>
                <li><span className="tick">✓</span><span>Scans: <b>20 a month</b>, 40 credits</span></li>
                <li><span className="tick">✓</span><span>Invoices carry the BakeWealth mark</span></li>
                <li><span className="tick">✓</span><span>Full accounting reports, without exception</span></li>
              </ul>
              <button
                type="button"
                className="btn btn-primary btn-block"
                onClick={() => handleChoosePlan("standard")}
              >
                Choose Standard
              </button>
            </div>

            {/* PREMIUM PLAN */}
            <div className="plan featured">
              <div className="ribbon">RECOMMENDED FOR SCALE</div>
              <h3>Premium</h3>
              <p className="tagline">Unlimited scale and unbranded invoices for established bakeries.</p>
              <div className="price-box">
                <div className="price">
                  ₦<span>{fmt(prmTotal)}</span>
                  <span className="per">{durationLabel}</span>
                </div>
                {discountRate > 0 && (
                  <div className="was">
                    was ₦{fmt(PRM_BASE * durationMonths)}
                  </div>
                )}
                <div className="price-sub">
                  Includes {fmt(160 * durationMonths)} scan credits, about {fmt(80 * durationMonths)} receipt scans
                </div>
              </div>
              <ul>
                <li><span className="tick">✓</span><span>Orders: <b>Unlimited</b></span></li>
                <li><span className="tick">✓</span><span>Recipes: <b>Unlimited</b></span></li>
                <li><span className="tick">✓</span><span>Inventory items: <b>Unlimited</b></span></li>
                <li><span className="tick">✓</span><span>Client records: <b>Unlimited</b></span></li>
                <li><span className="tick">✓</span><span>Staff logins: <b>4</b> plus owner</span></li>
                <li><span className="tick">✓</span><span>Scans: <b>80 a month</b>, 160 credits</span></li>
                <li><span className="tick">✓</span><span>Invoices: <b>your own logo only</b></span></li>
                <li><span className="tick">✓</span><span>Full accounting reports, without exception</span></li>
              </ul>
              <button
                type="button"
                className="btn btn-gold btn-block"
                onClick={() => handleChoosePlan("premium")}
              >
                Choose Premium
              </button>
            </div>
          </div>

          {/* CREDIT PACKS */}
          <div className="packs">
            <h3>Scan and import credit packs</h3>
            <p>
              Run out of scans before the month is up? Top up without changing your plan.
              A receipt costs 2 credits. A bank statement costs 5.
            </p>
            <div className="pack-grid">
              <div className="pack">
                <div className="nm">Small</div>
                <div className="cr">30 credits</div>
                <div className="sc">About 15 receipts</div>
                <button
                  type="button"
                  className="btn btn-ghost btn-block"
                  onClick={() => currentUser ? (onGoToDashboard && onGoToDashboard()) : onRegisterClick && onRegisterClick()}
                >
                  Buy credits
                </button>
              </div>
              <div className="pack">
                <div className="nm">Medium</div>
                <div className="cr">90 credits</div>
                <div className="sc">About 45 receipts</div>
                <button
                  type="button"
                  className="btn btn-ghost btn-block"
                  onClick={() => currentUser ? (onGoToDashboard && onGoToDashboard()) : onRegisterClick && onRegisterClick()}
                >
                  Buy credits
                </button>
              </div>
              <div className="pack">
                <div className="nm">Large</div>
                <div className="cr">200 credits</div>
                <div className="sc">About 100 receipts</div>
                <button
                  type="button"
                  className="btn btn-ghost btn-block"
                  onClick={() => currentUser ? (onGoToDashboard && onGoToDashboard()) : onRegisterClick && onRegisterClick()}
                >
                  Buy credits
                </button>
              </div>
            </div>

            <div className="arith">
              <span>⚡</span>
              <div>
                <b>Worth knowing.</b> A Standard baker who runs out of scans
                and buys a Medium pack ends up above the Premium price, for fewer scans and tighter limits.
                If you scan often, Premium is usually the cheaper answer.
              </div>
            </div>
          </div>

          <p className="dur-note" style={{ marginTop: 26 }}>
            Current plan names, pricing and availability are always shown in the BakeWealth app.
          </p>
        </div>
      </section>

      {/* CTA BANNER */}
      <section className="alt">
        <div className="wrap">
          <div className="cta-wrap">
            <div className="eyebrow">For the craft you love, and the business you are building</div>
            <h2>Make beautiful things. Let the business feel beautiful, too.</h2>
            <p>
              Bring your baking business into focus with BakeWealth: a thoughtful workspace
              for the work behind every order.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={currentUser ? onGoToDashboard : onRegisterClick}
            >
              {currentUser ? "Open BakeWealth Workspace ↗" : "Explore BakeWealth ↗"}
            </button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer>
        <div className="wrap">
          <div className="foot-grid">
            <div>
              <a href="#" className="brand-logo-wrap" style={{ color: "#FFF6EA", marginBottom: 12 }}>
                <img
                  src="/Bakewealthlogo.jpeg"
                  alt="BakeWealth Logo"
                  style={{
                    height: 38,
                    width: "auto",
                    borderRadius: 6,
                    objectFit: "contain",
                    background: "#fff",
                    padding: 2
                  }}
                />
                <span style={{ color: "#FFF6EA" }}>BakeWealth</span>
              </a>
              <p>
                A thoughtful workspace for bakers. Orders, ingredients, recipes and costing,
                together in one place, with AI support along the way.
              </p>
            </div>

            <div>
              <h4>Product</h4>
              <a href="#features">What you can do</a>
              <a href="#toolkit">Baker's toolkit</a>
              <a href="#pricing">Pricing</a>
              {currentUser ? (
                <a href="#dashboard" onClick={(e) => { e.preventDefault(); onGoToDashboard && onGoToDashboard(); }}>
                  Go to Workspace
                </a>
              ) : (
                <a href="#login" onClick={(e) => { e.preventDefault(); onLoginClick && onLoginClick(); }}>
                  Log in
                </a>
              )}
            </div>

            <div>
              <h4>Company</h4>
              <a href="https://instagram.com/iyeibe" target="_blank" rel="noopener noreferrer">Instagram</a>
              <a href="https://tiktok.com/@ibeachem" target="_blank" rel="noopener noreferrer">TikTok</a>
              <a href="mailto:hello@bakewealthinternational.com">Contact</a>
            </div>
          </div>

          <div className="foot-base">
            <span>© 2026 BakeWealth. Built by Iye Ibe Achem.</span>
            <span>Terms · Privacy · Refund policy</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
