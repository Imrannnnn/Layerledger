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

const SELAR_PAID = "https://selar.com/cakecostingsystem"
const SELAR_FREE = "https://selar.com/cakecostingsystem"

const K_SQ = 6.4516
const K_FLAV = {
  van: { g: 10.911, c: 2.01 },
  choc: { g: 11.0878, c: 2.61 },
  rv: { g: 13.1038, c: 2.57 }
}
const K_COV = {
  bc: { c: 10.45, d: 0.90, w: 0.15, f: 2, k: 1, n: 4.9, name: "Buttercream" },
  gan: { c: 11.93, d: 1.10, w: 0.10, f: 2, k: 1, n: 4.9, name: "Ganache" },
  fon: { c: 2.58, d: 1.35, w: 0.25, f: null, k: null, n: 8, name: "Fondant" },
  whip: { c: 8.67, d: 0.452, w: 0.15, f: 2, k: null, n: 4.9, name: "Whipped cream" }
}
const K_UNDER = K_COV.bc
const K_PACK = 2000
const K_MARGIN = 0.5

const QUIZ_Q = [
  {
    q: "What does one 8 inch chocolate cake cost you in ingredients?",
    a: [
      ["I know it within ₦2,000", 1, "You can price anything, because you start from a real number."],
      ["A rough idea, maybe ₦5,000 out", 0.5, "₦5,000 out on a ₦35,000 cake is your entire profit on that cake."],
      ["I would be guessing", 0, "Every price you have ever quoted was a guess built on a guess."]
    ]
  },
  {
    q: "What is one hour of your kitchen worth, once rent, light, gas, wages and your own pay are counted?",
    a: [
      ["I know the figure", 1, "This is the number most bakers never work out, and it sets every price."],
      ["I have never worked it out", 0.5, "Then your prices cover ingredients and nothing else."],
      ["I do not charge for my time at all", 0, "You are working for free and calling the leftovers profit."]
    ]
  },
  {
    q: "Do you pay yourself a salary from the business?",
    a: [
      ["Yes, a set amount every month", 1, "Which means your cakes carry the real cost of running the place."],
      ["I take money when I need it", 0.5, "Then you cannot tell your pay apart from your profit, and neither can your books."],
      ["No, whatever is left over is mine", 0, "Your own labour is free in every price you quote. It is the biggest hidden subsidy in the business."]
    ]
  },
  {
    q: "The last time you raised your prices, why did you?",
    a: [
      ["My costs went up and I recalculated", 1, "Prices that follow costs are the only prices that survive this market."],
      ["I felt I could get away with a bit more", 0.5, "That works until the month costs move and feelings do not."],
      ["I have not raised prices in over a year", 0, "Your ingredients have. You have been quietly absorbing every increase since."]
    ]
  },
  {
    q: "Which of the things you sell earns you the most per hour of your time?",
    a: [
      ["I know, I have compared them", 1, "Then you know which orders to chase and which to decline."],
      ["The big cakes, surely", 0.5, "Usually not. Big cakes carry big hours. The earner is often something small."],
      ["No idea", 0, "So you cannot tell which orders to take more of, and you take whatever comes."]
    ]
  },
  {
    q: "If flour went up 20% tomorrow, how many of your prices would change this week?",
    a: [
      ["All of them. I would recalculate", 1, "That is what a costing system is for."],
      ["A few, the ones that felt wrong", 0.5, "The ones that feel wrong are rarely the ones that are wrong."],
      ["None. I would absorb it", 0, "Absorbing it means paying it yourself, out of the profit you were counting on."]
    ]
  },
  {
    q: "What share of your price is ingredients?",
    a: [
      ["I know the percentage", 1, "Then you can spot a bad quote before you send it."],
      ["Around a third, I think", 0.5, "Thinking is not knowing, and the gap between them is your margin."],
      ["Never thought about it", 0, "Without it you cannot tell a profitable cake from one that is quietly losing."]
    ]
  },
  {
    q: "How do you price a cake you have never made before?",
    a: [
      ["I cost it properly before I quote", 1, "The only method that does not punish you for being adventurous."],
      ["I look at something similar and add a bit", 0.5, "If the similar one was underpriced, so is this one, and now the error has spread."],
      ["I say a number and hope", 0, "New designs take the most hours and are the most likely to lose money."]
    ]
  },
  {
    q: "A customer says your price is too high. What do you do?",
    a: [
      ["Explain what is in the price, and hold it", 1, "You can only hold a price you can explain, which is why the number matters."],
      ["Offer a smaller size or simpler design", 0.5, "Right instinct. Only safe if you know what the smaller version costs."],
      ["Drop the price to keep the order", 0, "You just paid to do the work. The discount comes out of profit, never out of cost."]
    ]
  },
  {
    q: "Do you know whether you made a profit last month?",
    a: [
      ["Yes, I have the figure", 1, "Rare, and the whole point of the exercise."],
      ["I think so. Money came in", 0.5, "Money coming in is not profit. It is other people's deposits and your own ingredients."],
      ["No", 0, "Then every decision you make this month is being made blind."]
    ]
  }
]

const QUIZ_FIX = [
  "Weigh one batch. Divide what you paid for each ingredient by its pack size, multiply by what actually went into the bowl. One afternoon, and you never guess again.",
  "Add up every monthly cost including your own pay, multiply by twelve, divide by the hours you genuinely produce in a year. Not the hours the shop is open.",
  "Put yourself on the payroll at a figure the business can carry today, even a small one. Then your labour shows up in every price instead of vanishing.",
  "Reprice when an ingredient moves more than 10%, not when you feel brave enough. Check it the first week of every month and it stops being a decision.",
  "Cost your five best sellers once, then divide each one's profit by the hours it takes you. Rank them. The order will surprise you.",
  "If one ingredient price can move all your prices in an afternoon, you have a costing system. If it cannot, you have a price list.",
  "Work out ingredients as a percentage of your price on three recent orders. If the three are far apart, your pricing is not a method, it is a mood.",
  "Cost it before you quote it, even roughly. Twenty minutes with a scale beats a number you cannot defend when she asks why.",
  "Decide your floor before the conversation, not during it. Then you can offer a smaller cake instead of a smaller margin.",
  "One page a month: money in, ingredients out, fixed costs out. Until that page exists, nothing else on this list can be checked."
]

const QUIZ_BANDS = [
  { min: 8.5, t: "You are in the small minority", s: "Most bakers cannot answer half of these. You can. The gaps that are left are worth closing, because they are the expensive ones." },
  { min: 6, t: "You know more than most, and it is not enough", s: "The parts you have covered are real. The parts you have not are where the money goes, quietly, every month." },
  { min: 3.5, t: "You are running on feel", s: "This is where most Nigerian bakers sit. It is not carelessness, nobody ever showed you the arithmetic. But feel cannot tell you which orders are losing money." },
  { min: 0, t: "You cannot tell whether you are making money", s: "That is uncomfortable to read and it is worth reading. Nothing here says you are a bad baker. It says you are flying blind on the money, and that is fixable in an afternoon." }
]

export const CREDIT_PACKS = [
  {
    id: "small",
    name: "Small Pack",
    price: 3000,
    credits: 20,
    scans: 10,
    statements: 4,
    popular: false,
    tagline: "Ideal for occasional top-ups",
    description: "Roughly 10 receipt scans or 4 bank statement imports."
  },
  {
    id: "medium",
    name: "Medium Pack",
    price: 6500,
    credits: 50,
    scans: 25,
    statements: 10,
    popular: true,
    tagline: "Best value for active bakers",
    description: "Roughly 25 receipt scans or 10 bank statement imports."
  },
  {
    id: "large",
    name: "Large Pack",
    price: 14000,
    credits: 120,
    scans: 60,
    statements: 24,
    popular: false,
    tagline: "Maximum credit efficiency",
    description: "Roughly 60 receipt scans or 24 bank statement imports."
  }
]

export function HomePage({
  onLoginClick,
  onRegisterClick,
  onGoToDashboard,
  currentUser,
  onLogout,
  onOpenPrivacy,
  onOpenTerms
}) {
  const [scrolled, setScrolled] = useState(false)

  // Pricing duration state: 1, 3, 6, 12
  const [durationMonths, setDurationMonths] = useState(1)
  const [discountRate, setDiscountRate] = useState(0)

  // Toolkit state
  const [activeTool, setActiveTool] = useState("conv") // "conv" | "scale" | "pan" | "cost" | "test"

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

  // 4. Cake Costing state
  const [kShape, setKShape] = useState("round")
  const [kA, setKA] = useState(8)
  const [kB, setKB] = useState(10)
  const [kLayers, setKLayers] = useState(3)
  const [kLh, setKLh] = useState(2)
  const [kFlav, setKFlav] = useState("choc")
  const [kCov, setKCov] = useState("bc")
  const [kHours, setKHours] = useState(4)
  const [kRate, setKRate] = useState(2500)
  const [kCharge, setKCharge] = useState("")

  // 5. Psychology of a Baker Quiz state
  const [pbIndex, setPbIndex] = useState(0)
  const [pbAnswers, setPbAnswers] = useState([])
  const [pbFinished, setPbFinished] = useState(false)

  // Nav scroll listener
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10)
    }
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  // Deep linking for toolkit (e.g. /#test, /#cost)
  useEffect(() => {
    const openFromHash = () => {
      const want = (window.location.hash || "").replace("#", "")
      if (["conv", "scale", "pan", "cost", "test"].includes(want)) {
        setActiveTool(want)
        setTimeout(() => {
          const el = document.getElementById("toolkit")
          if (el && typeof el.scrollIntoView === "function") el.scrollIntoView({ behavior: "smooth" })
        }, 50)
      }
    }
    window.addEventListener("hashchange", openFromHash)
    openFromHash()
    return () => window.removeEventListener("hashchange", openFromHash)
  }, [])

  // Helper formatting for currency
  const fmt = (n) => Number(n).toLocaleString("en-NG")
  const kNaira = (n) => "₦" + Math.round(n).toLocaleString("en-NG")

  // Cost calculator logic
  const costCalc = useMemo(() => {
    const a = parseFloat(kA) || 0
    const b = parseFloat(kB) || 0
    const layers = Math.max(1, Math.round(parseFloat(kLayers) || 1))
    const lh = parseFloat(kLh) || 0
    const hours = parseFloat(kHours) || 0
    const rate = parseFloat(kRate) || 0
    const h = layers * lh
    let top = 0
    let per = 0
    if (kShape === "round") {
      top = Math.PI * (a / 2) * (a / 2)
      per = Math.PI * a
    } else if (kShape === "square") {
      top = a * a
      per = 4 * a
    } else {
      top = a * b
      per = 2 * (a + b)
    }
    const surface = top + per * h
    const fillArea = Math.max(0, layers - 1) * top

    const cv = K_COV[kCov] || K_COV.bc
    const fl = K_FLAV[kFlav] || K_FLAV.choc
    const kGrams = (areaSqIn, mm, m) => areaSqIn * K_SQ * (mm / 10) * m.d * (1 + m.w)

    const batter = fl.g * top * h * fl.c
    const fill =
      kGrams(fillArea, cv.f !== null ? cv.f : K_UNDER.f, cv.f !== null ? cv : K_UNDER) *
      (cv.f !== null ? cv.c : K_UNDER.c)
    let crumb = 0
    if (cv.k !== null) crumb = kGrams(surface, cv.k, cv) * cv.c
    else if (kCov !== "whip") crumb = kGrams(surface, K_UNDER.k, K_UNDER) * K_UNDER.c
    const finish = kGrams(surface, cv.n, cv) * cv.c
    const time = hours * rate
    const cost = batter + fill + crumb + finish + K_PACK + time
    const price = cost / (1 - K_MARGIN)

    return {
      batter,
      fill,
      crumb,
      finish,
      pack: K_PACK,
      time,
      cost,
      price,
      surface,
      covName: cv.name
    }
  }, [kShape, kA, kB, kLayers, kLh, kFlav, kCov, kHours, kRate])

  // Quiz calculations and handlers
  const quizResult = useMemo(() => {
    if (!pbFinished) return null
    let total = 0
    pbAnswers.forEach((ansIndex, qIndex) => {
      total += QUIZ_Q[qIndex].a[ansIndex][1]
    })
    const shown = Math.round(total * 2) / 2
    const scoreStr = shown % 1 === 0 ? shown.toString() : shown.toFixed(1)
    const band = QUIZ_BANDS.find((b) => total >= b.min) || QUIZ_BANDS[QUIZ_BANDS.length - 1]
    return {
      total,
      scoreStr,
      bandTitle: band.t,
      bandSay: band.s
    }
  }, [pbFinished, pbAnswers])

  const handlePbPick = (n) => {
    const nextAns = [...pbAnswers]
    nextAns[pbIndex] = n
    setPbAnswers(nextAns)
    if (pbIndex < QUIZ_Q.length - 1) {
      setPbIndex(pbIndex + 1)
    } else {
      setPbFinished(true)
      setTimeout(() => {
        const el = document.getElementById("t-test")
        if (el && typeof el.scrollIntoView === "function") el.scrollIntoView({ behavior: "smooth", block: "start" })
      }, 50)
    }
  }

  const handlePbBack = () => {
    if (pbIndex > 0) setPbIndex(pbIndex - 1)
  }

  const handlePbAgain = () => {
    setPbIndex(0)
    setPbAnswers([])
    setPbFinished(false)
    setTimeout(() => {
      const el = document.getElementById("t-test")
      if (el && typeof el.scrollIntoView === "function") el.scrollIntoView({ behavior: "smooth", block: "start" })
    }, 50)
  }

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

        /* The Psychology of a Baker */
        .bw-home-root .pb-bar { height: 5px; background: var(--line); border-radius: 999px; overflow: hidden; margin: 4px 0 6px; }
        .bw-home-root .pb-bar i { display: block; height: 100%; width: 0; background: var(--gold); border-radius: 999px; transition: width .25s ease; }
        @media (prefers-reduced-motion: reduce) { .bw-home-root .pb-bar i { transition: none; } }
        .bw-home-root .pb-count { font-size: 12px; letter-spacing: .1em; text-transform: uppercase; color: var(--ink-faint); font-weight: 700; margin: 0 0 16px; }
        .bw-home-root .pb-q { font-family: "Bricolage Grotesque", sans-serif; font-weight: 700; font-size: clamp(19px, 2.4vw, 23px); line-height: 1.28; margin: 0 0 16px; color: var(--brand); }
        .bw-home-root .pb-opts { display: flex; flex-direction: column; gap: 10px; }
        .bw-home-root .pb-opts button { font-family: inherit; font-size: 15.5px; line-height: 1.45; text-align: left; background: var(--bg); color: var(--ink); border: 1.5px solid var(--line); border-radius: 12px; padding: 14px 16px; cursor: pointer; transition: border-color .12s; }
        .bw-home-root .pb-opts button:hover { border-color: var(--gold); }
        .bw-home-root .pb-opts button:focus-visible { outline: 3px solid var(--gold); outline-offset: 2px; }
        .bw-home-root .pb-back { background: none; border: none; color: var(--ink-faint); font-family: inherit; font-size: 13.5px; cursor: pointer; padding: 8px 2px; text-decoration: underline; }
        .bw-home-root .pb-score { background: var(--brand); border-radius: 16px; padding: 26px 20px; text-align: center; color: #FFF6EA; margin: 0 0 20px; }
        .bw-home-root .pb-num { font-family: "Bricolage Grotesque", sans-serif; font-weight: 800; font-size: clamp(50px, 9vw, 74px); line-height: 1; color: var(--gold-soft); display: block; }
        .bw-home-root .pb-of { font-size: 12.5px; letter-spacing: .14em; text-transform: uppercase; color: #E3CBAC; display: block; margin-top: 6px; }
        .bw-home-root .pb-band { font-family: "Bricolage Grotesque", sans-serif; font-weight: 700; font-size: clamp(18px, 2.4vw, 22px); margin: 16px 0 8px; text-wrap: balance; }
        .bw-home-root .pb-say { font-size: 15px; color: #EBDCC8; margin: 0 auto; max-width: 44ch; }
        .bw-home-root .pb-h { font-family: "Bricolage Grotesque", sans-serif; font-weight: 700; font-size: 19px; margin: 26px 0 4px; color: var(--brand); }
        .bw-home-root .pb-row { background: var(--bg); border: 1px solid var(--line); border-left-width: 4px; border-radius: 0 12px 12px 0; padding: 14px 16px; margin: 0 0 10px; }
        .bw-home-root .pb-row.bad { border-left-color: #A3221B; }
        .bw-home-root .pb-row.mid { border-left-color: #A8761A; }
        .bw-home-root .pb-row.good { border-left-color: #1F6B41; }
        .bw-home-root .pb-row b { display: block; font-size: 14.6px; margin-bottom: 3px; }
        .bw-home-root .pb-row.bad b { color: #A3221B; }
        .bw-home-root .pb-row.mid b { color: #A8761A; }
        .bw-home-root .pb-row.good b { color: #1F6B41; }
        .bw-home-root .pb-row span { display: block; font-size: 14.2px; color: var(--ink-soft); }
        .bw-home-root .pb-row em { display: block; margin-top: 8px; padding-top: 8px; border-top: 1px dashed var(--line); font-style: normal; font-size: 14.2px; color: var(--ink); }
        .bw-home-root .pb-row em b { display: block; font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: var(--gold); margin-bottom: 3px; }
        .bw-home-root .pb-cta { border: 1.5px solid var(--gold); border-radius: 16px; padding: 22px 20px; margin: 24px 0 0; background: var(--bg-alt); }
        .bw-home-root .pb-cta .pb-h { margin-top: 0; }
        .bw-home-root .pb-punch { font-size: 15.5px; margin: 13px 0 0; color: var(--ink); }
        .bw-home-root .pb-punch em { font-style: italic; color: var(--gold); }
        .bw-home-root .pb-strong { font-family: "Bricolage Grotesque", sans-serif; font-weight: 700; font-size: clamp(17px, 2.2vw, 20px); color: var(--brand); line-height: 1.32; margin-top: 14px; text-wrap: balance; }
        .bw-home-root .pb-buy { display: inline-block; margin-top: 18px; background: var(--brand); color: #FFF6EA; text-decoration: none; font-weight: 700; font-size: 15.5px; padding: 14px 24px; border-radius: 11px; }
        .bw-home-root .pb-buy:hover { background: var(--brand-hover); }
        .bw-home-root .pb-buy:focus-visible { outline: 3px solid var(--gold); outline-offset: 2px; }

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
          background: var(--card);
          border: 1.5px solid var(--line);
          border-radius: 16px;
          padding: 24px 20px;
          text-align: center;
          position: relative;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
        }
        .bw-home-root .pack:hover {
          border-color: var(--gold-soft);
          box-shadow: 0 8px 24px rgba(59, 35, 23, 0.06);
        }
        .bw-home-root .pack.popular {
          border-color: var(--gold);
          background: rgba(185, 139, 50, 0.03);
          box-shadow: 0 10px 30px -15px rgba(185, 139, 50, 0.35);
        }
        .bw-home-root .pack-badge {
          position: absolute;
          top: -11px;
          right: 16px;
          background: var(--gold);
          color: #FFF6EA;
          font-size: 10px;
          font-weight: 700;
          padding: 2px 10px;
          border-radius: 999px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .bw-home-root .pack .nm {
          font-weight: 700;
          font-size: 17px;
          color: var(--ink);
        }
        .bw-home-root .pack .pr {
          font-family: "Bricolage Grotesque", sans-serif;
          font-size: 28px;
          font-weight: 800;
          color: var(--gold);
          margin: 6px 0 2px;
          line-height: 1.1;
        }
        .bw-home-root .pack .cr {
          font-family: "Bricolage Grotesque", sans-serif;
          font-size: 18px;
          font-weight: 700;
          color: var(--ink);
          margin: 4px 0 2px;
        }
        .bw-home-root .pack .sc {
          font-size: 12.5px;
          color: var(--ink-soft);
          margin-bottom: 6px;
          line-height: 1.4;
        }
        .bw-home-root .pack .desc {
          font-size: 12px;
          color: var(--ink-faint);
          margin-bottom: 18px;
          line-height: 1.4;
          min-height: 34px;
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
          align-items: flex-start;
        }
        .bw-home-root .arith strong {
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
                data-tool="conv"
              >
                Weight ↔ volume
              </button>
              <button
                type="button"
                className={`tab ${activeTool === "scale" ? "on" : ""}`}
                onClick={() => setActiveTool("scale")}
                data-tool="scale"
              >
                Recipe scaler
              </button>
              <button
                type="button"
                className={`tab ${activeTool === "pan" ? "on" : ""}`}
                onClick={() => setActiveTool("pan")}
                data-tool="pan"
              >
                Pan size
              </button>
              <button
                type="button"
                className={`tab ${activeTool === "cost" ? "on" : ""}`}
                onClick={() => setActiveTool("cost")}
                data-tool="cost"
              >
                What a cake costs
              </button>
              <button
                type="button"
                className={`tab ${activeTool === "test" ? "on" : ""}`}
                onClick={() => setActiveTool("test")}
                data-tool="test"
              >
                The Psychology of a Baker
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

            {/* TOOL 4: WHAT A CAKE COSTS */}
            {activeTool === "cost" && (
              <div className="tool" id="t-cost">
                <h3>What a cake costs</h3>
                <p className="hint">
                  Typical Abuja prices are already filled in, so you get a number
                  before you find a single receipt.
                </p>
                <div className="fields">
                  <div className="f">
                    <label>Shape</label>
                    <select
                      id="kShape"
                      value={kShape}
                      onChange={(e) => setKShape(e.target.value)}
                    >
                      <option value="round">Round</option>
                      <option value="square">Square</option>
                      <option value="rect">Rectangle</option>
                    </select>
                  </div>
                  <div className="f">
                    <label id="kLabA">
                      {kShape === "round"
                        ? "Diameter (inches)"
                        : kShape === "square"
                        ? "Side (inches)"
                        : "Length (inches)"}
                    </label>
                    <input
                      id="kA"
                      type="number"
                      value={kA}
                      min="2"
                      max="60"
                      step="1"
                      onChange={(e) => setKA(e.target.value)}
                    />
                  </div>
                  {kShape === "rect" && (
                    <div className="f" id="kWrapB">
                      <label>Width (inches)</label>
                      <input
                        id="kB"
                        type="number"
                        value={kB}
                        min="2"
                        max="60"
                        step="1"
                        onChange={(e) => setKB(e.target.value)}
                      />
                    </div>
                  )}
                  <div className="f">
                    <label>Layers</label>
                    <input
                      id="kLayers"
                      type="number"
                      value={kLayers}
                      min="1"
                      max="8"
                      step="1"
                      onChange={(e) => setKLayers(e.target.value)}
                    />
                  </div>
                  <div className="f">
                    <label>Each layer, inches tall</label>
                    <input
                      id="kLh"
                      type="number"
                      value={kLh}
                      min="0.5"
                      max="4"
                      step="0.5"
                      onChange={(e) => setKLh(e.target.value)}
                    />
                  </div>
                  <div className="f">
                    <label>Flavour</label>
                    <select
                      id="kFlav"
                      value={kFlav}
                      onChange={(e) => setKFlav(e.target.value)}
                    >
                      <option value="van">Vanilla</option>
                      <option value="choc">Chocolate</option>
                      <option value="rv">Red velvet</option>
                    </select>
                  </div>
                  <div className="f">
                    <label>Covering</label>
                    <select
                      id="kCov"
                      value={kCov}
                      onChange={(e) => setKCov(e.target.value)}
                    >
                      <option value="bc">Buttercream</option>
                      <option value="gan">Ganache</option>
                      <option value="fon">Fondant</option>
                      <option value="whip">Whipped cream</option>
                    </select>
                  </div>
                  <div className="f">
                    <label>Hours on this cake</label>
                    <input
                      id="kHours"
                      type="number"
                      value={kHours}
                      min="0"
                      max="200"
                      step="0.5"
                      onChange={(e) => setKHours(e.target.value)}
                    />
                  </div>
                  <div className="f">
                    <label>What an hour of your shop costs (₦)</label>
                    <input
                      id="kRate"
                      type="number"
                      value={kRate}
                      min="0"
                      step="100"
                      onChange={(e) => setKRate(e.target.value)}
                    />
                  </div>
                </div>

                <div className="result">
                  <div className="big" id="kOut">{kNaira(costCalc.cost)}</div>
                  <div className="sm" id="kNote">
                    What this cake costs you to make. {Math.round(costCalc.surface)} square inches to cover.
                  </div>
                  <div className="sm" id="kBreak" style={{ marginTop: 10, lineHeight: 1.7 }}>
                    Cake {kNaira(costCalc.batter)} · filling {kNaira(costCalc.fill)}
                    {costCalc.crumb ? ` · crumb coat ${kNaira(costCalc.crumb)}` : ""}
                    {" · "}{costCalc.covName.toLowerCase()} {kNaira(costCalc.finish)}
                    {" · "}board and box {kNaira(costCalc.pack)} · your time {kNaira(costCalc.time)}
                  </div>
                  <div className="sm" id="kPrice" style={{ marginTop: 12, fontWeight: 700 }}>
                    Sell it for at least {kNaira(Math.ceil(costCalc.price / 500) * 500)} to keep a {Math.round(K_MARGIN * 100)}% margin.
                  </div>
                </div>

                <div className="fields" style={{ marginTop: 20, gridTemplateColumns: "1fr" }}>
                  <div className="f">
                    <label>Now the honest part: what do you charge for this cake today? (₦)</label>
                    <input
                      id="kCharge"
                      type="number"
                      placeholder="35000"
                      min="0"
                      step="500"
                      value={kCharge}
                      onChange={(e) => setKCharge(e.target.value)}
                    />
                  </div>
                </div>

                {(() => {
                  const charge = parseFloat(kCharge)
                  if (!isFinite(charge) || charge <= 0) return null
                  const gap = costCalc.price - charge
                  if (gap > 0) {
                    return (
                      <div className="result" id="kVerdict" style={{ marginTop: 14 }}>
                        <div className="big">{kNaira(gap)} short</div>
                        <div className="sm">
                          That is {kNaira(gap * 4)} a month if you bake one a week.{" "}
                          {charge < costCalc.cost
                            ? `At ${kNaira(charge)} you are not even covering what it costs to make.`
                            : "You are covering your costs. You are not making the margin you wanted."}
                        </div>
                      </div>
                    )
                  } else {
                    return (
                      <div className="result" id="kVerdict" style={{ marginTop: 14 }}>
                        <div className="big">{kNaira(-gap)} above</div>
                        <div className="sm">
                          That is a {Math.round((1 - costCalc.cost / charge) * 100)}% margin on typical prices. Run it again with your own costs before you trust it.
                        </div>
                      </div>
                    )
                  }
                })()}

                <p className="fineprint" style={{ marginTop: 18 }}>
                  This uses typical prices, not yours. It cannot know what you paid for flour last week,
                  learn your own recipes, cost a second or third tier, add decoration materials, or work
                  out your real hourly rate.{" "}
                  <a href={SELAR_PAID} id="kPaid">The Cake Costing System does all of that.</a>{" "}
                  <a href={SELAR_FREE} id="kFree">Free serving &amp; covering chart.</a>
                </p>
              </div>
            )}

            {/* TOOL 5: THE PSYCHOLOGY OF A BAKER */}
            {activeTool === "test" && (
              <div className="tool" id="t-test">
                <h3>The Psychology of a Baker</h3>
                <p className="hint">
                  Ten questions about the money side of your cakes. About ninety seconds.
                  Answer honestly, nobody sees it but you. Most bakers score three.
                </p>

                {!pbFinished ? (
                  <div id="pb-quiz">
                    <div className="pb-bar">
                      <i id="pb-fill" style={{ width: `${(pbIndex / QUIZ_Q.length) * 100}%` }}></i>
                    </div>
                    <p className="pb-count" id="pb-count">
                      Question {pbIndex + 1} of {QUIZ_Q.length}
                    </p>
                    <h4 className="pb-q" id="pb-q">
                      {QUIZ_Q[pbIndex].q}
                    </h4>
                    <div className="pb-opts" id="pb-opts">
                      {QUIZ_Q[pbIndex].a.map((opt, n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => handlePbPick(n)}
                        >
                          {opt[0]}
                        </button>
                      ))}
                    </div>
                    {pbIndex > 0 && (
                      <button
                        type="button"
                        className="pb-back"
                        id="pb-back"
                        onClick={handlePbBack}
                      >
                        Back
                      </button>
                    )}
                  </div>
                ) : (
                  <div id="pb-result">
                    <div className="pb-score">
                      <span className="pb-num" id="pb-num">{quizResult?.scoreStr}</span>
                      <span className="pb-of">out of 10</span>
                      <p className="pb-band" id="pb-band">{quizResult?.bandTitle}</p>
                      <p className="pb-say" id="pb-say">{quizResult?.bandSay}</p>
                    </div>

                    <h4 className="pb-h">Where the money is leaking</h4>
                    <p className="hint">Every answer, and what it is costing you.</p>
                    <div id="pb-rows">
                      {QUIZ_Q.map((item, k) => {
                        const ansIdx = pbAnswers[k] !== undefined ? pbAnswers[k] : 0
                        const opt = item.a[ansIdx]
                        const cls = opt[1] === 1 ? "good" : opt[1] === 0.5 ? "mid" : "bad"
                        return (
                          <div key={k} className={`pb-row ${cls}`}>
                            <b>{item.q}</b>
                            <span>{opt[2]}</span>
                            {opt[1] < 1 && (
                              <em>
                                <b>What to do</b>
                                {QUIZ_FIX[k]}
                              </em>
                            )}
                          </div>
                        )
                      })}
                    </div>

                    <div className="pb-cta">
                      <h4 className="pb-h">You love baking. But are you making money from it?</h4>
                      <p className="pb-punch">
                        You have just answered ten questions about the money side of your cakes.
                        Some of them you could answer straight away. Others you had to think about, or guess at.
                      </p>
                      <p className="pb-punch">
                        That is the point of them. Every one of those questions is sitting behind a
                        price you have already quoted this year. What a cake costs you in ingredients. What an hour
                        in your kitchen is worth. Whether you are on your own payroll. What you do when a customer
                        says it is too much. Whether you could say, right now, if last month made money.
                      </p>
                      <p className="pb-punch">
                        Your time, your labour, electricity, gas, decoration, packaging and the cost
                        of simply keeping the place open all go into every cake you sell. When those are not counted,
                        you can be busy, taking orders and posting cakes you are proud of, and still not making the
                        profit your business needs.
                      </p>
                      <p className="pb-punch">
                        The problem may not be that you are not selling enough cakes. It may be that
                        you are not costing them properly.
                      </p>
                      <p className="pb-punch">But you can change that.</p>
                      <p className="pb-punch pb-strong">Meet the Cake Costing System</p>
                      <p className="pb-punch">
                        A practical costing and pricing tool that works out the true cost of
                        producing your cakes, accounts for your business expenses, prepares accurate quotations, and
                        shows you which of the things you sell are actually making you money.
                      </p>
                      <p className="pb-punch">
                        Imagine knowing what a cake costs you before you decide what to charge.
                        Imagine sending a quotation without second-guessing it, or wondering what you have forgotten.
                        Imagine a customer telling you it is too expensive, and holding your price, because you can
                        account for every naira in it.
                      </p>
                      <p className="pb-punch">You do not have to keep guessing. You need a better system.</p>
                      <p className="pb-punch">
                        Your baking business deserves more than beautiful cakes and impressive sales.
                        It deserves to make money.
                      </p>
                      <p className="pb-punch pb-strong">
                        Take the next step towards costing with clarity and pricing with confidence.
                      </p>
                      <a className="pb-buy" href="https://selar.com/cakecostingsystem">
                        Get the Cake Costing System
                      </a>
                    </div>

                    <button
                      type="button"
                      className="pb-back"
                      id="pb-again"
                      style={{ marginTop: 18 }}
                      onClick={handlePbAgain}
                    >
                      Take it again
                    </button>
                  </div>
                )}
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

          {/* FREE PLAN AI & USAGE HIGHLIGHT BANNER */}
          <div style={{
            background: "#FAF7F0",
            border: "1.5px dashed var(--gold)",
            borderRadius: 14,
            padding: "16px 20px",
            marginBottom: 28,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 14
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, flex: 1, minWidth: 280 }}>
              <div style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: "rgba(185, 139, 50, 0.15)",
                color: "var(--gold)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
                fontSize: 20,
                flexShrink: 0
              }}>
                ✦
              </div>
              <div>
                <strong style={{ fontSize: 15, color: "var(--ink)", display: "block" }}>
                  What the Free Plan Entails: Free Forever with 10 Bonus AI Scans
                </strong>
                <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>
                  Start free with <strong>8 orders/mo</strong>, <strong>10 costed recipes</strong>, <strong>50 inventory items</strong>, <strong>20 clients</strong>, and <strong>10 free AI receipt scans (20 credits)</strong> upon registration. Run automated bookkeeping, generate invoices, view full P&amp;L reports, and top up scan packs anytime without subscribing!
                </span>
              </div>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              style={{ padding: "9px 20px", fontSize: 13.5, flexShrink: 0 }}
              onClick={() => onRegisterClick ? onRegisterClick("free") : handleChoosePlan("free")}
            >
              Get Started Free ↗
            </button>
          </div>

          <div className="plans">
            {/* FREE PLAN */}
            <div className="plan">
              <div className="ribbon" style={{ background: "#E8F3EC", color: "#1E6B45" }}>
                10 FREE AI SCANS INCLUDED
              </div>
              <h3>Free</h3>
              <p className="tagline">Explore BakeWealth without commitments. Upgrade or top up anytime.</p>
              <div className="price-box">
                <div className="price">₦0</div>
                <div className="price-sub">No card needed · Free forever</div>
              </div>

              {/* Free AI & Quota Highlight Callout */}
              <div style={{ background: "#F6FBF7", border: "1px solid #C6E7D2", borderRadius: 10, padding: "10px 12px", margin: "0 0 16px", fontSize: 12.5, color: "#1B5E38", lineHeight: 1.45 }}>
                <strong style={{ display: "block", color: "#166534", marginBottom: 3, fontWeight: 700 }}>
                  ✦ AI &amp; Scan Usage on Free:
                </strong>
                Get <strong>10 free receipt scans (20 AI credits)</strong> immediately upon registration. Need more scans? Buy credit packs whenever you want — no subscription required!
              </div>

              <ul>
                <li><span className="tick">✓</span><span>AI Allowance: <b>10 free starter scans</b> (20 credits bonus)</span></li>
                <li><span className="tick">✓</span><span>AI Rates: <b>2 credits</b> / receipt, <b>5 credits</b> / statement</span></li>
                <li><span className="tick">✓</span><span>Top-up Scans: <b>Credit packs anytime</b> (credits never expire)</span></li>
                <li><span className="tick">✓</span><span>Orders: <b>8 / month</b></span></li>
                <li><span className="tick">✓</span><span>Recipes: <b>10 recipes</b></span></li>
                <li><span className="tick">✓</span><span>Inventory items: <b>50 items</b></span></li>
                <li><span className="tick">✓</span><span>Client records: <b>20 clients</b></span></li>
                <li><span className="tick">✓</span><span>Staff logins: <b>1 user</b> (Owner account)</span></li>
                <li><span className="tick">✓</span><span>Invoices carry the BakeWealth mark</span></li>
                <li><span className="tick">✓</span><span>Accounting: <b>Full P&amp;L &amp; Balance Sheet reports</b></span></li>
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
              <div>
                <h3>Scan and import credit packs</h3>
                <p style={{ margin: "4px 0 0", color: "var(--ink-soft)", fontSize: 15 }}>
                  For free users, and for paid users who need more scans than their prepaid plan includes. Credits never expire.
                </p>
              </div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "#1E6B45", background: "#E8F3EC", padding: "6px 14px", borderRadius: 999, fontWeight: 600 }}>
                <span>✓</span>
                <span>1 Receipt = 2 Credits • 1 Statement = 5 Credits</span>
              </div>
            </div>

            <div className="pack-grid">
              {CREDIT_PACKS.map(pack => (
                <div key={pack.id} className={`pack ${pack.popular ? "popular" : ""}`}>
                  {pack.popular && (
                    <div className="pack-badge">Best Value</div>
                  )}
                  <div>
                    <div className="nm">{pack.name}</div>
                    <div className="pr">₦{fmt(pack.price)}</div>
                    <div className="cr">{pack.credits} Credits</div>
                    <div className="sc">~{pack.scans} receipt scans or {pack.statements} bank statements</div>
                    <div className="desc">{pack.description}</div>
                  </div>
                  <button
                    type="button"
                    className={`btn ${pack.popular ? "btn-gold" : "btn-ghost"} btn-block`}
                    onClick={() => currentUser ? (onGoToDashboard && onGoToDashboard("credits")) : (onRegisterClick && onRegisterClick())}
                  >
                    {currentUser ? "Buy credits" : "Get started"}
                  </button>
                </div>
              ))}
            </div>

            <div className="arith">
              <span style={{ fontSize: 22, lineHeight: 1 }}>⚡</span>
              <div>
                <strong>The Premium Arithmetic:</strong> A Standard baker who runs out of scans and buys a Medium pack spends <strong>₦11,500</strong> (₦5,000 plan + ₦6,500 pack) for 45 scans with plan limits. <strong>Premium is only ₦10,000 for 80 scans</strong> with unlimited recipes, inventory items, and clients. Cheaper, with nearly double the scans!
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
            <span style={{ display: "inline-flex", gap: 10, alignItems: "center" }}>
              <a
                href="#terms"
                onClick={(e) => { e.preventDefault(); onOpenTerms && onOpenTerms(); }}
                style={{ color: "inherit", textDecoration: "underline", cursor: "pointer" }}
              >
                Terms of Service
              </a>
              <span>·</span>
              <a
                href="#privacy"
                onClick={(e) => { e.preventDefault(); onOpenPrivacy && onOpenPrivacy(); }}
                style={{ color: "inherit", textDecoration: "underline", cursor: "pointer" }}
              >
                Privacy Policy
              </a>
              <span>·</span>
              <a
                href="#terms"
                onClick={(e) => { e.preventDefault(); onOpenTerms && onOpenTerms(); }}
                style={{ color: "inherit", textDecoration: "underline", cursor: "pointer" }}
              >
                Refund Policy
              </a>
            </span>
          </div>
        </div>
      </footer>
    </div>
  )
}
