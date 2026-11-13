/**
 * HelpAssistantModal.jsx
 * ----------------------------------------------------------------------------
 * BakeWealth Context-Aware AI Help & Feature Walkthrough Assistant
 * 
 * Provides bakers with instant, step-by-step explanations and verified setup
 * instructions for:
 *   1. Recipe Calibration (Batter Pour Weights, Levelled Height, Density g/in³)
 *   2. Order Calculator (Multi-Tier Geometry, Portions, Margins, Quotes)
 *   3. Coverings & Fillings (Applied Thickness in mm, Density, Waste %)
 *   4. Production Sheets & Workflow (Numbered Weigh-Outs, Committed vs. Delivered Stock)
 *   5. Stock Discrepancies & Adjustments (Reason Codes, 2-Way Counts, Store Loss Value)
 *   6. Enterprise Accounting (Customer Deposits as Liability, Delivery Invariants, Depreciation)
 *   7. Bakery Setup Checklist (From Raw Ingredients to First Confirmed Order)
 * ----------------------------------------------------------------------------
 */

import React, { useState, useEffect, useRef } from 'react';
import { Card, Btn } from './ui.jsx';
import { callClaude } from '../../lib/helpers.js';
import {
  Sparkles,
  X,
  BookOpen,
  MessageSquare,
  Calculator,
  Layers,
  ClipboardList,
  Sliders,
  DollarSign,
  CheckCircle,
  HelpCircle,
  ArrowRight,
  Send,
  RefreshCw,
  Copy,
  Check,
  ChevronRight,
  Search
} from 'lucide-react';

export const HELP_TOPICS = [
  {
    id: 'calibration',
    title: 'Recipe Calibration',
    icon: Layers,
    badge: 'Updated',
    tagline: 'Batter pour weights, levelled height & automatic pan scaling'
  },
  {
    id: 'calculator',
    title: 'Order Calculator',
    icon: Calculator,
    badge: 'Updated',
    tagline: 'Multi-tier cake geometry, party vs. wedding portions & live margins'
  },
  {
    id: 'coverings',
    title: 'Coverings & Fillings',
    icon: Sparkles,
    badge: 'Updated',
    tagline: 'Millimeter thicknesses, material densities & reverse calibration'
  },
  {
    id: 'prodsheet',
    title: 'Production Sheets',
    icon: ClipboardList,
    badge: 'New',
    tagline: 'Numbered pan weigh-outs, aggregated shopping & resting timeline'
  },
  {
    id: 'stockadjust',
    title: 'Stock Adjustments',
    icon: Sliders,
    badge: 'New',
    tagline: 'Audit reason codes, 2-way count corrections & store loss value'
  },
  {
    id: 'accounting',
    title: 'Accounting & Deposits',
    icon: DollarSign,
    badge: 'Rulings',
    tagline: 'Customer deposits as liabilities, revenue on delivery & asset rules'
  },
  {
    id: 'setup',
    title: 'Setup Checklist',
    icon: CheckCircle,
    badge: 'Guide',
    tagline: 'Step-by-step path: ingredients → calibration → first quote'
  },
  {
    id: 'glossary',
    title: 'Bakery Terms & Glossary',
    icon: HelpCircle,
    badge: 'Dictionary',
    tagline: 'Plain-English guide to Calibrated, Density, Trim %, Committed Stock & more'
  }
];

export const BAKERY_GLOSSARY = [
  {
    id: 'calibrated',
    term: 'Calibrated / Calibration Bake',
    category: 'Recipe & Baking',
    keywords: ['calibrated', 'calibration', 'calibrate', 'test bake', 'what is calibrated', 'what does calibrated mean', 'uncalibrated'],
    shortDef: 'Teaching BakeWealth how your specific sponge rises so it scales batter to any pan automatically.',
    plainEnglish: 'Just like zeroing a digital kitchen scale before weighing flour, "calibrating" a recipe means baking a single test pan, weighing the batter you poured in grams, levelling the dome flat, and measuring the finished layer height. BakeWealth saves this once and uses it forever.',
    kitchenAnalogy: 'Think of it as recording your recipe\'s unique fingerprint. A heavy mud cake behaves differently from an airy chiffon. Once calibrated, BakeWealth knows the exact volume-to-weight ratio and scales batter for an 8″, 10″, 12″, or sheet pan with zero guesswork.',
    whereToFind: 'Master List → Base Recipes → Edit Recipe → Calibration Bake'
  },
  {
    id: 'density',
    term: 'Batter Density (g/in³ or g/cm³)',
    category: 'Recipe & Baking',
    keywords: ['density', 'batter density', 'g/in3', 'g/cm3', 'weight per volume', 'what is density', 'what does density mean', 'how to calculate density'],
    shortDef: 'How heavy a scoop of batter is for its physical volume (grams divided by cubic inches).',
    plainEnglish: 'Density is simply the weight of your batter per cubic inch of baked, levelled cake. Light sponges have lower density (~9–10 g/in³), while rich fruitcakes or dense mud cakes have higher density (~12–14 g/in³).',
    kitchenAnalogy: 'If you fill a 1-cup measuring cup with whipped cream, it is light (~120g). If you fill the exact same cup with honey, it is heavy (~340g). Density is just that weight-per-cup measurement expressed in grams per cubic inch.',
    whereToFind: 'Calculated automatically on the Calibration Bake Card.'
  },
  {
    id: 'levelled_height',
    term: 'Levelled Height',
    category: 'Geometry & Sizing',
    keywords: ['levelled height', 'leveled height', 'level height', 'trim height', 'layer height', 'what is levelled height'],
    shortDef: 'The height of a cake layer AFTER slicing off the rounded top dome.',
    plainEnglish: 'When cakes bake, they crown or dome in the center. Professional tier construction requires flat surfaces. Levelled height is the ruler measurement (e.g., 2.0″) of the flat, usable cake layer that remains after trimming the dome.',
    kitchenAnalogy: 'If your cake baked to 2.5″ at the peak of the dome, but you slice the dome off at 2.0″ so it is flat, your Levelled Height is 2.0″.',
    whereToFind: 'Calibration Bake card & Order Calculator Tier Height.'
  },
  {
    id: 'trim_pct',
    term: 'Trim % (Trim Margin)',
    category: 'Recipe & Baking',
    keywords: ['trim %', 'trim pct', 'trim percentage', 'trim margin', 'dome trim', 'what is trim %', 'what is trim percentage', 'trimming'],
    shortDef: 'The extra batter you pour to allow for the dome or caramelized crust trimmed off.',
    plainEnglish: 'If you want a 2.0″ finished flat layer, you cannot pour only enough batter for 2.0″, or after cutting off the dome the cake will be too short. Trim % adds a small extra allowance (default 8%) so your trimmed cake meets the exact requested height.',
    kitchenAnalogy: 'Like buying 1.1 meters of fabric when sewing a 1-meter dress to allow for seam allowances.',
    whereToFind: 'Master List Calibration card (default is 8%).'
  },
  {
    id: 'plan_area',
    term: 'Plan Area (sq in or cm²)',
    category: 'Geometry & Sizing',
    keywords: ['plan area', 'pan area', 'surface area of pan', 'what is plan area', 'square inches', 'pan area formula'],
    shortDef: 'The 2D surface area of the bottom of the pan looking straight down from above.',
    plainEnglish: 'A 6″ round pan has an area of 28.3 sq in. An 8″ round pan has an area of 50.3 sq in. BakeWealth uses precise geometric formulas (πr² for round, L×W for rect, special curves for hearts and hexagons) to calculate exact pan areas.',
    kitchenAnalogy: 'Think of plan area as the size of the parchment paper circle or square you cut to line the bottom of your pan.',
    whereToFind: 'Order Calculator tier sizing.'
  },
  {
    id: 'crumb_vs_finish',
    term: 'Crumb Coat vs. Finish Coat',
    category: 'Coverings & Frosting',
    keywords: ['crumb coat', 'finish coat', 'crumb vs finish', 'what is crumb coat', 'what is finish coat', 'crumb coating'],
    shortDef: 'Crumb coat seals loose crumbs; finish coat is the smooth outer presentation layer.',
    plainEnglish: 'A Crumb Coat is a thin scraping (~1.0 mm) of buttercream or ganache applied to lock in loose crumbs before chilling. The Finish Coat is the outer, thicker layer (~4.9 mm) that creates the flawless, smooth surface for decorating.',
    kitchenAnalogy: 'Like applying a primer undercoat on a wall (crumb coat) before applying your rich finish paint (finish coat).',
    whereToFind: 'Master List → Covering Recipes & Order Calculator tier covering selections.'
  },
  {
    id: 'applied_thickness',
    term: 'Applied Thickness (mm)',
    category: 'Coverings & Frosting',
    keywords: ['applied thickness', 'thickness mm', 'frosting thickness', 'filling thickness', 'what is applied thickness'],
    shortDef: 'How thick you spread frosting or filling, measured in millimeters.',
    plainEnglish: 'Rather than guessing "a cup of buttercream", BakeWealth measures frosting in millimeters of thickness spread across the cake surface. Standard values: Filling between layers = 4.5 mm (thickness of two ₦100 coins), Crumb coat = 1.0 mm, Finish coat = 4.9 mm.',
    kitchenAnalogy: 'Spreading butter on toast: a scrape is 1 mm; a thick decadent layer is 4–5 mm.',
    whereToFind: 'Master List → Covering recipe settings & Order Calculator.'
  },
  {
    id: 'reverse_thickness',
    term: 'Reverse Thickness Calibration',
    category: 'Coverings & Frosting',
    keywords: ['reverse thickness', 'reverse calibration', 'hand thickness', 'palette knife thickness', 'what is reverse thickness', 'reverse thickness calibration'],
    shortDef: 'Deriving your personal frosting thickness by weighing what you actually spread on a cake.',
    plainEnglish: 'Every baker has a different hand pressure with a palette knife or scraper. Instead of measuring with a ruler, you frost a known cake (e.g. 8″ round), weigh the frosting bowl before and after to get grams used, and BakeWealth calculates your personal millimeter thickness.',
    kitchenAnalogy: 'Like timing how long it takes you to run 1 km to find your personal jogging speed.',
    whereToFind: 'Master List → Covering Recipe → Reverse Calibration Tool.'
  },
  {
    id: 'committed_stock',
    term: 'Committed Stock vs. Physical Deduction',
    category: 'Inventory & Production',
    keywords: ['committed stock', 'committed vs physical', 'physical deduction', 'what is committed stock', 'deduct stock', 'stock committed'],
    shortDef: 'Committed reserves ingredients for confirmed orders; physical deduction only happens on delivery.',
    plainEnglish: 'When an order is confirmed, BakeWealth "commits" the needed flour and butter on paper so you don\'t promise them to another client. But the physical bags stay in your storeroom. When you change order status to "Delivered", BakeWealth physically subtracts them from stock and logs COGS.',
    kitchenAnalogy: 'Committed is like a hotel room reservation; Physical Deduction is checking in and sleeping in the bed.',
    whereToFind: 'Production List status changes & Inventory Master List.'
  },
  {
    id: 'two_way_adjustment',
    term: 'Counted Wrong (Two-Way Adjustment)',
    category: 'Inventory & Stocktaking',
    keywords: ['counted wrong', 'two way adjustment', 'two-way', '2-way', 'why counted wrong', 'stock adjustment reason', 'two way count'],
    shortDef: 'The only stock adjustment reason code allowed to increase inventory.',
    plainEnglish: 'If ingredients are spoilt, damaged, sampled, or stolen, inventory can ONLY go down. "Counted wrong" is the sole reason that can adjust stock UP or DOWN, because a physical counting mistake is the only reason you might have more flour on a shelf than your computer shows.',
    kitchenAnalogy: 'Food cannot multiply in a storeroom on its own; only human miscounting can result in discovering extra tins of milk.',
    whereToFind: 'Stock Adjustment screen dropdown.'
  },
  {
    id: 'party_vs_wedding',
    term: 'Party Portions vs. Wedding Portions',
    category: 'Geometry & Sizing',
    keywords: ['party portions', 'wedding portions', 'party vs wedding', 'finger slice', 'dessert slice', 'portions difference', 'cake portions'],
    shortDef: 'Party portions are generous dessert cubes (2″ × 2″); wedding portions are slender finger slices (1″ × 2″).',
    plainEnglish: 'At birthday parties, cake is usually the main dessert, so guests expect a generous 2″ × 2″ slice (~16 cu in). At weddings, cake is served alongside champagne after a multi-course dinner, so standard catering serves a 1″ × 2″ finger slice (~8 cu in).',
    kitchenAnalogy: 'Party = a hearty dessert bowl slice; Wedding = a dainty finger food slice.',
    whereToFind: 'Order Calculator portions summary box.'
  },
  {
    id: 'margin_vs_markup',
    term: 'Profit Margin % vs. Mark-up %',
    category: 'Costing & Accounting',
    keywords: ['margin vs markup', 'profit margin', 'markup', 'mark-up', 'difference between margin and markup', 'what is margin', 'what is markup'],
    shortDef: 'Margin is the % of selling price you keep; markup is the % added on top of your costs.',
    plainEnglish: 'If a cake costs ₦6,000 to bake and you sell it for ₦10,000: your Profit is ₦4,000. Your Profit Margin is 40% (₦4,000 ÷ ₦10,000). Your Markup is 66.7% (₦4,000 ÷ ₦6,000). BakeWealth prices by Profit Margin to protect your net take-home earnings.',
    kitchenAnalogy: 'If you want 40 out of every 100 Naira that enters your till to be pure profit, you are targeting a 40% margin.',
    whereToFind: 'Order Calculator margin slider & Settings → Pricing Setup.'
  },
  {
    id: 'deposits_liability',
    term: 'Customer Deposits as Liability (Ruling 2)',
    category: 'Costing & Accounting',
    keywords: ['customer deposits', 'deposit as liability', 'ruling 2', 'why deposit is liability', 'advance payment', 'deposit liability'],
    shortDef: 'Advance customer payments are debts (liabilities) until the cake is baked and delivered.',
    plainEnglish: 'When a bride pays you ₦100,000 deposit in November for a wedding cake in December, that money is NOT yet revenue because you have not earned it. You owe her a cake. If the bakery burned down, you would have to refund it. Only upon delivery does it convert into Revenue.',
    kitchenAnalogy: 'You cannot spend the bride\'s money and call it profit before you bake her cake.',
    whereToFind: 'Balance Sheet (Account 2120) & Financial Assistant.'
  },
  {
    id: 'depreciation_contra',
    term: 'Contra-Asset (Account 1290) & Depreciation',
    category: 'Costing & Accounting',
    keywords: ['contra asset', 'contra-asset', 'depreciation', 'account 1290', 'fixed asset', 'wear and tear', 'asset depreciation'],
    shortDef: 'An account that records wear-and-tear value loss on expensive bakery equipment over 5 years.',
    plainEnglish: 'If you buy a commercial oven for ₦300,000, it is a Fixed Asset (Account 1210). Instead of expensing ₦300,000 in one month (which would falsely make you look bankrupt), you spread the cost over 5 years (60 months). Each month, ₦5,000 is deducted via Contra-Asset 1290 (Accumulated Depreciation).',
    kitchenAnalogy: 'Your oven slowly ages and loses resale value each month, like a car accumulating mileage.',
    whereToFind: 'Balance Sheet Account 1290 & Reports → Asset Register.'
  }
];

export const TOPIC_KNOWLEDGE = {
  calibration: {
    title: 'Recipe Calibration Bake — How Batter Density Works',
    summary: 'Never guess how much batter to pour into an 8″, 10″ or sheet pan again. You calibrate each recipe once with a test bake, and BakeWealth derives the exact density (g/in³) to scale any cake size automatically.',
    steps: [
      {
        num: 1,
        title: 'Bake One Reference Pan',
        text: 'Pick a standard pan you frequently use (e.g., 6″ round, 8″ round, or 8″ square). Pour your normal batter into it and weigh what you poured on a kitchen scale before baking. Record this as Grams Poured (e.g. 617g).'
      },
      {
        num: 2,
        title: 'Level and Measure Finished Height',
        text: 'Bake the cake and allow it to cool. Cut off the baked dome with a levelling knife so the top is completely flat. Measure the height of the levelled layer with a clean ruler in inches (e.g. 2.0″).'
      },
      {
        num: 3,
        title: 'Enter Values in Master List → Base Recipes',
        text: 'Open Master List, edit or create your cake recipe, and scroll to Calibration Bake. Select your reference shape, diameter/side, grams poured, and levelled height.'
      },
      {
        num: 4,
        title: 'Automatic Density & Scaling',
        text: 'BakeWealth automatically calculates your batter density: Density = Grams / (Plan Area × Height). For 617g in a 6″ round levelled to 2″, density is 10.91 g/in³. When used in the Order Calculator, BakeWealth uses this density plus an 8% trim margin to calculate exact batter for any pan shape or size.'
      }
    ],
    workedExample: {
      title: 'Worked Example: Scaling 617g Reference to 10″ Round (3 Layers @ 2″)',
      points: [
        'Reference Bake: 617g poured into 6″ round (Area = 28.27 sq in) levelled to 2″ → Density = 10.911 g/in³.',
        'Target Cake: 10″ round (Plan Area = 78.54 sq in), 3 layers, each 2″ thick.',
        'Batter per 10″ Pan: 10.911 × 78.54 sq in × 2″ × 1.08 (8% trim) = 1,851 g per pan.',
        'Total Batter to Mix: 1,851 g × 3 pans = 5,553 g total.'
      ]
    },
    keyTerms: [
      { term: 'Calibrated', def: 'A recipe that has had a single reference test bake entered so BakeWealth knows its exact rise and density.' },
      { term: 'Batter Density (g/in³)', def: 'The weight of raw batter per cubic inch of baked, levelled cake (grams ÷ volume).' },
      { term: 'Levelled Height', def: 'The height of the cake layer after cutting off the rounded dome with a levelling knife.' },
      { term: 'Trim %', def: 'Extra batter poured (default 8%) to account for the dome and crust cut off during levelling.' }
    ],
    proTips: [
      'Always measure the levelled layer height, not the dome peak before trimming.',
      'Leave Trim % at 8% for standard sponges, or increase to 10-12% for sculpted novelty cakes.',
      'You only calibrate once per recipe. All future quotes for that sponge flavour calculate automatically.'
    ],
    faqs: [
      {
        q: 'How do I calibrate my vanilla sponge?',
        a: 'Bake a single 6″ or 8″ pan. Weigh the raw batter poured in grams (e.g. 617g). After baking and cooling, trim the dome flat and measure the height (e.g. 2″). In Master List → Base Recipes, enter 6″ round, 617g poured, and 2″ height. BakeWealth saves your density (10.91 g/in³) and automatically scales any future size.'
      },
      {
        q: 'What is the Trim % for?',
        a: 'Trim % accounts for the batter lost when levelling off the dome or edge crust after baking. The standard allowance is 8%. This ensures your weighed batter yields the exact requested layer height.'
      },
      {
        q: 'Does calibration work for square and rectangular pans?',
        a: 'Yes. In the Reference Pan selector, choose square (enter side length) or rect (enter length and width). BakeWealth computes the exact planar geometry and volume.'
      }
    ]
  },

  calculator: {
    title: 'Order Calculator — Multi-Tier Geometries, Portions & Margins',
    summary: 'Cost single and tiered custom cakes down to the gram. BakeWealth calculates 3D geometric volumes, batter masses, fillings, crumb and finish coats, cake boards, packaging, labor hours, and profit margins.',
    steps: [
      {
        num: 1,
        title: 'Choose Cake Item & Stacking',
        text: 'In Order Calculator, add a Cake item. Choose whether it is a single cake or a multi-tier wedding/celebration cake (e.g., 3 tiers: 10″ base, 8″ middle, 6″ top).'
      },
      {
        num: 2,
        title: 'Configure Each Tier',
        text: 'For each tier, choose shape (Round, Square, Rect, Heart, Hexagon, Oval), diameter, total height (e.g. 4″, 6″, 8″), and number of cake layers.'
      },
      {
        num: 3,
        title: 'Select Cake Batter & Coverings',
        text: 'Pick your calibrated cake recipe for the layers. Then select your Filling recipe (between layers) and Outside Covering recipe (crumb coat + finish coat). BakeWealth applies millimeter thicknesses and ingredient densities automatically.'
      },
      {
        num: 4,
        title: 'Add Packaging, Labor & Review Portions',
        text: 'Select cake boards, dowels, and boxes. Enter decorator labor hours and hourly rate. Check Party portions (2″ × 2″) vs. Wedding portions (1″ × 2″). Adjust your target profit margin (e.g. 40%) to see the suggested retail price, then save the quote.'
      }
    ],
    workedExample: {
      title: 'Worked Example: 2-Tier Celebration Cake (8″ round + 6″ round)',
      points: [
        'Tier 1 (Base): 8″ round, 4″ tall (2 layers of 2″ Vanilla Sponge) with Buttercream filling & finish coat.',
        'Tier 2 (Top): 6″ round, 4″ tall (2 layers of 2″ Chocolate Fudge) with Dark Ganache filling & finish coat.',
        'Portions: Yields ~36 party portions or ~62 wedding portions.',
        'Cost Stack: Ingredients (₦12,400) + Coverings (₦8,200) + Packaging (₦3,500) + Labor 3 hrs @ ₦2,000 (₦6,000) = ₦30,100 total cost.',
        'Target Price: At 40% margin, suggested quote is ₦50,167.'
      ]
    },
    proTips: [
      'Heart, hexagon, and oval shapes use real geometric plan area formulas—no rough approximations.',
      'Wedding portions assume 1″ × 2″ finger slices; Party portions assume 2″ × 2″ square slices.',
      'Click "Convert to Invoice" or "Send WhatsApp" directly from saved quotes.'
    ],
    faqs: [
      {
        q: 'How do I add a multi-tier cake?',
        a: 'In Order Calculator, click "+ Add Item" → "Cake". Under Tier Stacking, add Tier 1 (e.g. 10″ round, 4″ tall), then click "+ Add Tier" for Tier 2 (e.g. 8″ round) and Tier 3 (e.g. 6″ round). Each tier can have its own sponge flavour, filling, and height.'
      },
      {
        q: 'What is the difference between party and wedding portions?',
        a: 'Party portions are larger dessert slices (2″ × 2″ × height, ~16 cu in). Wedding portions are coffee/finger slices (1″ × 2″ × height, ~8 cu in). BakeWealth displays both counts side-by-side so you can advise clients accurately.'
      },
      {
        q: 'How does BakeWealth calculate the suggested price?',
        a: 'It adds Direct Ingredients + Coverings + Packaging + Decorations + Labor Cost, applies your overhead % (e.g. 10%), and divides by (1 - Margin %) to ensure your specified gross margin is mathematically guaranteed.'
      }
    ]
  },

  coverings: {
    title: 'Coverings & Fillings — Millimeter Thickness & Applied Densities',
    summary: 'Professional cake coating is based on surface area and applied thickness, not arbitrary scoops. BakeWealth uses exact millimeter thicknesses and material density (g/cm³) to calculate the grams of buttercream, ganache, fondant, or whipped cream required.',
    steps: [
      {
        num: 1,
        title: 'Define Covering Capabilities',
        text: 'In Master List → Base Recipes, check the jobs this covering can perform: [x] Filling (between layers), [x] Crumb coat, [x] Outside finish coat.'
      },
      {
        num: 2,
        title: 'Set Standard Thicknesses (mm)',
        text: 'Set standard kitchen thicknesses: Filling (e.g. 4.5 mm), Crumb coat (e.g. 1.0 mm), and Outside finish (e.g. 4.9 mm).'
      },
      {
        num: 3,
        title: 'Set Density and Kitchen Waste',
        text: 'Enter density in g/cm³: Buttercream (~0.90), Dark Ganache (~1.10), Fondant (~1.35), Whipped cream (~0.45). Add a waste margin (e.g. 15% for bowl scraping and piping bag residue).'
      },
      {
        num: 4,
        title: 'Use Reverse Thickness Calibration',
        text: 'If you already know that you use 600g of buttercream on a 10″ round 3-layer cake, enter 10″ round, 3 layers, and 600g into the Reverse Thickness tool to derive your exact applied millimeter thickness.'
      }
    ],
    workedExample: {
      title: 'Worked Example: 10″ Round Cake (3 Layers at 2″ Height)',
      points: [
        'Filling: 2 internal gaps (2 × 78.54 sq in) @ 4.5mm thickness + 15% waste = 527 g Buttercream.',
        'Crumb Coat: Outer side wall + top (188.5 sq in) @ 1.0mm thickness + 15% waste = 126 g Buttercream.',
        'Outside Finish: Outer side wall + top (188.5 sq in) @ 4.9mm thickness + 15% waste = 618 g Buttercream.',
        'Total Buttercream Required: 527g + 126g + 618g = 1,271 g total.'
      ]
    },
    proTips: [
      'Fondant is only an Outside Finish coat (not for filling or crumb coat), typically rolled at 4.0mm to 8.0mm thickness.',
      'Whipped cream has low density (~0.452 g/cm³), meaning it requires much less weight to achieve the same visual thickness.',
      'Ganache has higher density (~1.10 g/cm³) and sets firmer, so lower millimeter thicknesses (3.0mm filling, 4.0mm finish) are standard.'
    ],
    faqs: [
      {
        q: 'Why are coverings measured in millimeters instead of scoops?',
        a: 'Because a 10″ round cake has over 3 times the surface area of a 6″ cake. Measuring applied thickness in millimeters guarantees that costs scale in proportion to true surface area, preventing underpricing on large cakes.'
      },
      {
        q: 'How does the Reverse Thickness calculator work?',
        a: 'Weigh your covering before and after coating a cake. Enter the cake diameter, layer count, and grams used. BakeWealth divides by the surface area and material density to show you whether your finish is 3.5mm, 4.9mm, or 6.0mm.'
      }
    ]
  },

  prodsheet: {
    title: 'Baker’s Production Sheets & Stock Commitment Workflow',
    summary: 'When a quote is confirmed, BakeWealth generates a comprehensive Kitchen Production Sheet designed for propping on a phone or clipboard next to your mixer, while managing stock reservations cleanly.',
    steps: [
      {
        num: 1,
        title: 'Order Confirmation & Stock Commitment',
        text: 'When a client accepts a quote, confirm the order. Crucially, BakeWealth does NOT immediately deduct stock from your physical inventory. Instead, it tags the ingredients as Committed Stock, showing you what is reserved so you do not double-book ingredients.'
      },
      {
        num: 2,
        title: 'Tab 1: Aggregated Shopping List',
        text: 'Every ingredient across all tiers, fillings, and coverings is summed once. Butter in 6 different recipes is combined into a single grand total. Eggs are converted to pieces (@ 50g/egg), liquids over 400g appear in litres, and a Shortfall Banner alerts you if stock is insufficient.'
      },
      {
        num: 3,
        title: 'Tab 2: Numbered Pan Weigh-Outs',
        text: 'Shows each pan individually numbered (Pan 1: 8″ Vanilla 617g, Pan 2: 8″ Vanilla 617g) with scaled recipe cards showing exact gram amounts to mix into each pan and across all pans.'
      },
      {
        num: 4,
        title: 'Tab 3: Build Order & Rest Timeline',
        text: 'Presents an editable sequence based on which steps need chilling, resting, or setting time before assembly.'
      },
      {
        num: 5,
        title: 'Delivery & Final Stock Deduction',
        text: 'When baking is finished and the cake is handed to the client or driver, mark the status as Delivered in Production List. Physical stock is deducted at this exact moment, and double-entry revenue & COGS are recognized.'
      }
    ],
    workedExample: {
      title: 'Worked Example: Confirmed Order Workflow',
      points: [
        'Quote Confirmed: 10kg Flour needed. Store on-hand is 25kg. On-hand remains 25kg, Committed becomes 10kg, Free Stock becomes 15kg.',
        'Production: Baker opens Production Sheet, weighs out numbered pans, checks off aggregated shopping list.',
        'Order Delivered: Status updated to "Delivered". On-hand stock drops from 25kg to 15kg. Accounting automatically posts Dr 1110 Bank / Cr 4000 Revenue and Dr 5000 COGS / Cr 1140 Raw Materials.'
      ]
    },
    proTips: [
      'Print the Production Sheet using the "Print Sheet" button—it formats in clean, high-contrast black-and-white ink.',
      'You can edit any timeline step and BakeWealth persists your customized kitchen sequence for that order.',
      'Negative stock is flagged with a warning if a deduction exceeds on-hand quantity, but it will never block your kitchen workflow.'
    ],
    faqs: [
      {
        q: 'Why does confirming an order not deduct stock immediately?',
        a: 'Because confirmed orders may not be baked for days or weeks. Deducting stock prematurely creates phantom inventory discrepancies on your shelves. BakeWealth tags ingredients as Committed, and only deducts physical stock upon delivery.'
      },
      {
        q: 'Where do I find the Production Sheet?',
        a: 'Go to Quotes or Production List. On any confirmed order, click the "Production Sheet" button to view or print the 3-tab kitchen document.'
      }
    ]
  },

  stockadjust: {
    title: 'Stock Discrepancies & Multi-Item Stock Adjustments',
    summary: 'Record kitchen breakages, expired ingredients, testing samples, or inventory count corrections with audit reason codes and full financial tracking of store losses.',
    steps: [
      {
        num: 1,
        title: 'Open Operations → Stock Adjustment',
        text: 'In the sidebar, click Operations → Stock Adjustment to access the dedicated adjustment terminal.'
      },
      {
        num: 2,
        title: 'Select Audit Reason Code',
        text: 'Choose from the 6 standard reasons: Spoilt or expired, Damaged, Used for testing or samples, Theft or loss, Counted wrong, or Other.'
      },
      {
        num: 3,
        title: 'Understand Directional Rules',
        text: 'Counted wrong is the only reason that allows stock to increase or decrease (because real counts can exceed records). Loss reasons (spoilt, damaged, samples, theft) strictly reduce inventory.'
      },
      {
        num: 4,
        title: 'Enter Items and Quantities',
        text: 'Select your ingredients. For "Counted wrong", enter the physical count you found. For loss reasons, enter the quantity lost. BakeWealth calculates the total Value Leaving the Store.'
      },
      {
        num: 5,
        title: 'Reconciliation in Monthly Overview',
        text: 'Submitted adjustments create audit history entries and feed directly into the Stock Movement report: Opening + Bought - Used ± Adjusted = Closing.'
      }
    ],
    workedExample: {
      title: 'Worked Example: Spoilage & Count Correction',
      points: [
        'Spoilt Cream: 2 Litres of whipping cream expired. Reason selected: "Spoilt or expired". Quantity lost: 2 L. Value deducted: ₦9,000.',
        'Flour Miscount: Record showed 12kg, physical count showed 15kg. Reason: "Counted wrong". Target count: 15kg. Delta: +3kg.',
        'Audit Trace: Both adjustments recorded in inventory history with user timestamp and reason code.'
      ]
    },
    proTips: [
      'When selecting "Other", a descriptive note is mandatory to maintain strict audit integrity.',
      'Check the "Value leaving the store" summary at the bottom before submitting to see the immediate naira impact.',
      'Adjustments update average unit costs and total on-hand values atomically in the database.'
    ],
    faqs: [
      {
        q: 'Which reason allows stock to go up?',
        a: 'Only "Counted wrong". A physical miscount is the only scenario where actual kitchen stock turns out to be higher than recorded. All other reasons represent waste or loss and strictly deduct stock.'
      },
      {
        q: 'How does stock adjustment affect my profit and loss?',
        a: 'Spoilage, damages, and sample usage are logged with their financial value. In financial reporting, these values flow to Spoilage / Wastage or Promotional Sample expenses.'
      }
    ]
  },

  accounting: {
    title: 'Enterprise Accounting — BakeWealth 27 Rulings Guide',
    summary: 'BakeWealth operates on strict double-entry General Ledger accounting principles certified for bakery operations. Every transaction preserves balance sheet equality with zero stored totals.',
    steps: [
      {
        num: 1,
        title: 'Ruling 2: Customer Deposits on Unbaked Orders',
        text: 'When a customer pays a deposit for a cake, it is NOT revenue. BakeWealth posts Dr 1110 Bank / Cr 2120 Customer Deposits (a Liability). Revenue remains ₦0 until the cake is delivered.'
      },
      {
        num: 2,
        title: 'Ruling 2: Delivery Recognition',
        text: 'When the order is marked Delivered, BakeWealth simultaneously recognizes Revenue (Cr 4000), clears Customer Deposits (Dr 2120), records Accounts Receivable if a balance is pending (Dr 1120), and records Cost of Goods Sold (Dr 5000 / Cr 1140 Raw Materials).'
      },
      {
        num: 3,
        title: 'Ruling 8, 9 & 10: Fixed Assets & Depreciation',
        text: 'Equipment purchases of ₦50,000 or more are capitalised to Account 1200 (PPE), not expensed immediately. Straight-line monthly depreciation charges Dr 5060/6400 Depreciation Expense and Cr 1290 Accumulated Depreciation (contra-asset). The gross cost in 1200 is never reduced.'
      },
      {
        num: 4,
        title: 'Ruling 21 & 24: Bank Transfers & Zero Profit Impact',
        text: 'Transfers between your own bank accounts (e.g. POS collection account to Main operational account) post Dr Destination Bank / Cr Source Bank with zero profit impact.'
      }
    ],
    workedExample: {
      title: 'Worked Example: ₦100,000 Order with ₦50,000 Deposit & ₦30,000 Cost',
      points: [
        'Deposit Paid: Dr 1110 Bank ₦50,000 / Cr 2120 Customer Deposits ₦50,000. Profit = ₦0.',
        'Bake Event: Dr 1160 Finished Goods ₦30,000 / Cr 1140 Raw Materials ₦30,000. Profit = ₦0.',
        'Delivery Event: Dr 2120 Deposits ₦50,000 + Dr 1120 AR ₦50,000 / Cr 4000 Revenue ₦100,000. Simultaneously: Dr 5000 COGS ₦30,000 / Cr 1160 Finished Goods ₦30,000. Gross Profit recognized: ₦70,000.',
        'Balance Paid Later: Dr 1110 Bank ₦50,000 / Cr 1120 AR ₦50,000. Zero duplicate revenue.'
      ]
    },
    proTips: [
      'Never treat customer deposits as personal income before baking and delivering the order.',
      'Check the Trial Balance report under Reports → Accounting to verify that Total Debits always equal Total Credits.',
      'Asset disposal automatically computes and records Gain on Disposal (7020) or Loss on Disposal (8030).'
    ],
    faqs: [
      {
        q: 'Why does my P&L not show deposit income immediately?',
        a: 'Per Accounting Ruling 2, revenue is earned when performance obligations are satisfied (i.e. when the cake is delivered). Until delivery, a deposit is a customer debt that you owe in goods or refund.'
      },
      {
        q: 'How does straight-line depreciation work in BakeWealth?',
        a: 'Standard bakery equipment uses a 5-year life (60 months) with zero salvage value. An industrial oven purchased for ₦1,200,000 depreciates by exactly ₦20,000 each month starting in the purchase month.'
      }
    ]
  },

  setup: {
    title: 'Bakery Setup Checklist — From Zero to First Quote',
    summary: 'A clear, 5-step roadmap to get your bakery completely configured in BakeWealth without getting overwhelmed.',
    steps: [
      {
        num: 1,
        title: 'Step 1: Set Company Profile & Currency',
        text: 'Go to Settings → Company. Enter your bakery name, contact details, currency (default ₦ NGN), and logo.'
      },
      {
        num: 2,
        title: 'Step 2: Enter Master Inventory & Opening Stock',
        text: 'Go to Master List → Inventory. Add your core raw materials (Flour, Butter, Sugar, Eggs, Milk, Packaging, Boards). Enter cost per unit. Then set your initial shelf quantities in Settings → Opening Stock.'
      },
      {
        num: 3,
        title: 'Step 3: Build & Calibrate Base Recipes',
        text: 'Go to Master List → Base Recipes. Enter your signature cake sponges. Calibrate each batter with one reference bake (pan size, grams poured, levelled height) so BakeWealth can scale any cake automatically.'
      },
      {
        num: 4,
        title: 'Step 4: Set Up Coverings & Fillings',
        text: 'Add your buttercreams, ganaches, and fondants. Set their applied thickness in mm (fill, crumb, finish) and density.'
      },
      {
        num: 5,
        title: 'Step 5: Create Your First Quote',
        text: 'Open Order Calculator. Add your customer cake, pick your flavours and coverings, review your profit margin, and click Save Quote!'
      }
    ],
    workedExample: {
      title: 'Quick 15-Minute Launch Plan',
      points: [
        'Minute 1-5: Add 5 essential ingredients (Flour, Sugar, Butter, Eggs, Cocoa) and cost per unit.',
        'Minute 6-10: Add 1 Vanilla Cake recipe and enter calibration (e.g. 617g in 6″ round levelled to 2″).',
        'Minute 11-13: Add Buttercream covering with 4.5mm fill and 4.9mm finish thickness.',
        'Minute 14-15: Open Order Calculator and build a 2-tier celebration quote.'
      ]
    },
    proTips: [
      'You can import recipes and inventory from Excel, CSV, or take a photo of an invoice via AI Import.',
      'Set your default markup percentage in Settings → Pricing Setup (e.g. 40% margin, 10% overhead).',
      'Need help on any screen? Click the "Need Help? Ask AI" button anytime.'
    ],
    faqs: [
      {
        q: 'Do I have to enter all my recipes before taking orders?',
        a: 'No. Start with your top 2 or 3 best-selling cake sponges and 1 covering. You can cost and take orders immediately, and add specialty recipes as orders arrive.'
      },
      {
        q: 'Can I import from my existing spreadsheet?',
        a: 'Yes. In Master List and Opening Stock, click "Import" to upload an Excel sheet, CSV file, or scan a written recipe photo using AI.'
      }
    ]
  },

  glossary: {
    title: 'Bakery Terms & Plain-English Glossary',
    summary: 'No confusing math or accounting jargon. Here is what every technical word in BakeWealth means in simple, everyday kitchen language.',
    termsList: BAKERY_GLOSSARY,
    steps: [
      {
        num: 1,
        title: 'Calibrated vs. Uncalibrated',
        text: 'A calibrated recipe has a recorded test bake. BakeWealth knows its exact batter density (g/in³) and automatically scales batter weights for any 6″, 8″, 10″, or rectangular pan without guessing.'
      },
      {
        num: 2,
        title: 'Plan Area & Geometry',
        text: 'Plan area is the 2D surface of your pan bottom. An 8″ round has 50.3 sq in. BakeWealth uses real geometry (including heart, hexagon, and oval) to avoid under-baking or over-costing.'
      },
      {
        num: 3,
        title: 'Applied Thickness (mm)',
        text: 'Frostings are measured in millimeters spread on the cake. Standard filling between layers is 4.5 mm (two ₦100 coins), crumb coat is 1.0 mm, finish coat is 4.9 mm.'
      },
      {
        num: 4,
        title: 'Committed Stock vs. Physical Deduction',
        text: 'Confirming an order marks stock as "Committed" so it cannot be double-booked. Physical stock is only deducted from shelves when you mark the order "Delivered".'
      },
      {
        num: 5,
        title: 'Customer Deposits as Liabilities (Ruling 2)',
        text: 'Advance deposits are debts you owe until you deliver the cake. They become Revenue strictly when delivered, protecting you from fake paper profits.'
      }
    ],
    workedExample: {
      title: 'Quick Translation Cheat-Sheet',
      points: [
        'Calibrated = Software knows how your batter bakes so you never guess pan weights.',
        'Density = How heavy 1 cubic inch of your batter or frosting is.',
        'Trim % = The dome cut off with a knife, baked into the pour weight as extra (default 8%).',
        'Committed Stock = Reserved on paper for a confirmed order, physical bag stays on shelf until delivery.',
        'Ruling 2 = Customer deposit is a liability (obligation) until delivered.'
      ]
    },
    proTips: [
      'Type any term like "What is density?" into the Ask AI tab for a detailed explanation anytime.',
      'Click on any term card below to copy its definition or ask the AI to coach you on it.',
      'Terms are consistent across Order Calculator, Master List, and Accounting reports.'
    ],
    faqs: [
      {
        q: 'What does "Calibrated" mean in BakeWealth?',
        a: 'Calibrated means you have baked a single test pan, weighed what you poured, trimmed the dome flat, and measured the levelled height. BakeWealth saves your batter density (e.g. 10.91 g/in³) so you never have to guess pan pour weights again.'
      },
      {
        q: 'What is the difference between Margin % and Mark-up %?',
        a: 'Margin is the percentage of the final selling price that is profit. Mark-up is the percentage added on top of your raw cost. A 40% margin on a ₦10,000 cake gives you ₦4,000 profit (cost was ₦6,000).'
      },
      {
        q: 'Why are Customer Deposits recorded as a Liability?',
        a: 'Because until you bake and deliver the cake, you owe the customer that cake or their money back. You have not earned the revenue until delivery. This prevents you from spending money that is not yet earned profit.'
      }
    ]
  }
};

export function HelpAssistantModal({
  isOpen,
  onClose,
  initialTopic = 'calculator',
  user,
  company = {}
}) {
  const [activeTopicId, setActiveTopicId] = useState(initialTopic || 'calculator');
  const [activeTab, setActiveTab] = useState('guide'); // 'guide' | 'chat'
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      sender: 'assistant',
      text: `Hello! I am your **BakeWealth AI Assistant**. 

I am here to guide you through every feature of your bakery workspace — including the **Recipe Calibration Bake**, **Order Calculator**, **Coverings & Thicknesses (mm)**, **Production Sheets**, **Stock Discrepancy Adjustments**, and **Accounting Rulings**.

Select any topic on the left or type your question below!`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [glossarySearch, setGlossarySearch] = useState('');
  const [glossaryCat, setGlossaryCat] = useState('All');
  const chatScrollRef = useRef(null);

  // Sync initial topic when modal opens
  useEffect(() => {
    if (initialTopic && TOPIC_KNOWLEDGE[initialTopic]) {
      setActiveTopicId(initialTopic);
    }
  }, [initialTopic, isOpen]);

  // Auto-scroll chat
  useEffect(() => {
    if (activeTab === 'chat' && chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, isTyping, activeTab]);

  if (!isOpen) return null;

  const currentTopicData = TOPIC_KNOWLEDGE[activeTopicId] || TOPIC_KNOWLEDGE.calculator;

  const handleCopy = (id, text) => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleSendMessage = async (queryText) => {
    const textToSend = (queryText || inputText || '').trim();
    if (!textToSend || isTyping) return;

    setInputText('');
    const userMsgId = `user-${Date.now()}`;
    const userMsg = {
      id: userMsgId,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);
    setActiveTab('chat');

    // 1. Check if the user is explicitly asking about a term definition or terminology
    const lowerQuery = textToSend.toLowerCase();
    let localAnswer = null;

    const isTermDefinitionQuery =
      lowerQuery.startsWith('what is') ||
      lowerQuery.startsWith('what does') ||
      lowerQuery.startsWith('define') ||
      lowerQuery.startsWith('explain') ||
      lowerQuery.startsWith('meaning of') ||
      lowerQuery.split(' ').length <= 3;

    let matchedTerm = null;
    if (isTermDefinitionQuery) {
      matchedTerm = BAKERY_GLOSSARY.find(t => {
        const lowerT = t.term.toLowerCase();
        if (lowerQuery === lowerT) return true;
        if (t.keywords && t.keywords.some(k => lowerQuery.includes(k.toLowerCase()))) return true;
        return false;
      });
    }

    if (matchedTerm) {
      localAnswer = `### 🏷️ What Does "${matchedTerm.term}" Mean in BakeWealth?\n\n**In Plain English:**\n${matchedTerm.plainEnglish}\n\n**Kitchen Analogy:**\n${matchedTerm.kitchenAnalogy || matchedTerm.analogy}\n\n**Why It Matters to You as a Baker:**\n${matchedTerm.shortDef}\n\n**Where to Find / Set It in BakeWealth:**\n*${matchedTerm.whereToFind || matchedTerm.where}*`;
    }

    // 2. Check general glossary / terminology request
    if (!localAnswer && (lowerQuery.includes('glossary') || lowerQuery.includes('terminology') || lowerQuery.includes('explain terms') || lowerQuery.includes('what terms') || lowerQuery.includes('definitions') || lowerQuery === 'terms')) {
      localAnswer = `### 📖 BakeWealth Bakery Terminology Quick Guide\n\nHere are the most common technical terms demystified for your kitchen in plain English:\n\n` +
        BAKERY_GLOSSARY.map(t => `- **${t.term}:** ${t.shortDef}`).join('\n\n') +
        `\n\n*💡 Tip: Click any term chip below or ask "What is [term]?" for a complete explanation with kitchen analogies!*`;
    }

    // 3. Scan all FAQs across topics
    if (!localAnswer) {
      for (const [topicKey, topicObj] of Object.entries(TOPIC_KNOWLEDGE)) {
        if (topicObj.faqs) {
          for (const faq of topicObj.faqs) {
            const faqLower = faq.q.toLowerCase();
            const words = lowerQuery.split(' ').filter(w => w.length > 3);
            const matchCount = words.filter(w => faqLower.includes(w)).length;
            if (lowerQuery.includes(faqLower) || faqLower.includes(lowerQuery) || matchCount >= 3) {
              localAnswer = `### ${faq.q}\n\n${faq.a}\n\n*Source: BakeWealth Knowledge Base (${topicObj.title})*`;
              break;
            }
          }
        }
        if (localAnswer) break;
      }
    }

    // 4. Fallback check for any glossary term keyword if still not matched
    if (!localAnswer) {
      const fallbackTerm = BAKERY_GLOSSARY.find(t => {
        return t.keywords && t.keywords.some(k => lowerQuery.includes(k.toLowerCase()));
      });
      if (fallbackTerm) {
        localAnswer = `### 🏷️ What Does "${fallbackTerm.term}" Mean in BakeWealth?\n\n**In Plain English:**\n${fallbackTerm.plainEnglish}\n\n**Kitchen Analogy:**\n${fallbackTerm.kitchenAnalogy || fallbackTerm.analogy}\n\n**Why It Matters to You as a Baker:**\n${fallbackTerm.shortDef}\n\n**Where to Find / Set It in BakeWealth:**\n*${fallbackTerm.whereToFind || fallbackTerm.where}*`;
      }
    }

    // Keyword topic fallbacks if no FAQ matched
    if (!localAnswer) {
      if (lowerQuery.includes('calibrate') || lowerQuery.includes('density') || lowerQuery.includes('pour weight') || lowerQuery.includes('levelled height')) {
        localAnswer = `### How to Calibrate a Cake Recipe in BakeWealth\n\n1. **Bake a single reference pan:** Pour batter into a known pan (e.g. 6″ round) and weigh the raw batter in grams before baking (e.g. **617g**).\n2. **Level and measure:** Bake, let cool, trim the dome flat, and measure the levelled height in inches (e.g. **2.0″**).\n3. **Enter in Master List:** Under *Base Recipes → Calibration Bake*, enter your pan dimensions, grams poured, and levelled height.\n4. **Automatic Scaling:** BakeWealth computes your batter density (**10.91 g/in³**) and automatically calculates the exact batter needed for any future cake size or shape with 8% trim margin included.`;
      } else if (lowerQuery.includes('party') || lowerQuery.includes('wedding') || lowerQuery.includes('portion') || lowerQuery.includes('slice')) {
        localAnswer = `### Party Portions vs. Wedding Portions\n\n- **Party Portions (Dessert Slice):** Sized at **2″ × 2″ × layer height** (~16 cu in). Standard for birthdays, family gatherings, and events where cake is the primary dessert.\n- **Wedding Portions (Finger Slice):** Sized at **1″ × 2″ × layer height** (~8 cu in). Standard for multi-course dinners and weddings where cake is served with coffee or late snacks.\n\n*BakeWealth displays both portion counts side-by-side in the Order Calculator so you can advise your clients accurately.*`;
      } else if (lowerQuery.includes('committed') || lowerQuery.includes('deduct') || lowerQuery.includes('inventory drop') || lowerQuery.includes('stock')) {
        localAnswer = `### Committed Stock vs. Physical Deduction\n\n- **When an order is CONFIRMED:** Ingredients are marked as **Committed Stock**. Physical stock on your shelves is NOT touched yet. This prevents double-booking while ensuring phantom inventory deductions do not corrupt shelf counts.\n- **When an order is DELIVERED:** In the Production List, change status to **Delivered**. Only at this point does BakeWealth physically deduct the ingredients from inventory and post the accounting entries for Revenue and COGS.`;
      } else if (lowerQuery.includes('reason') || lowerQuery.includes('spoil') || lowerQuery.includes('counted wrong') || lowerQuery.includes('adjustment')) {
        localAnswer = `### Stock Adjustment Audit Reason Codes\n\n- **Counted wrong:** The **ONLY** reason that allows stock to go up or down, because a miscount is the only scenario where actual kitchen stock exceeds records.\n- **Spoilt or expired:** Deducts stock due to perishability.\n- **Damaged:** Deducts stock due to dropped/ruined items.\n- **Used for testing or samples:** Deducts stock and logs promotional tasting costs.\n- **Theft or loss:** Deducts unexplained missing stock.\n- **Other:** Requires an explanatory note.\n\n*All adjustments show the total 'Value leaving the store' in ₦ and reconcile in your monthly stock movement.*`;
      } else if (lowerQuery.includes('deposit') || lowerQuery.includes('revenue') || lowerQuery.includes('accounting') || lowerQuery.includes('ruling')) {
        localAnswer = `### Customer Deposits & Revenue Recognition (Ruling 2)\n\nIn BakeWealth, **deposits on unbaked orders are recorded as a Liability (Customer Deposits), NOT Revenue**.\n\n- When deposit is received: **Dr 1110 Bank / Cr 2120 Customer Deposits** (Revenue = ₦0).\n- When order is delivered: **Dr 2120 Customer Deposits / Cr 4000 Revenue** and **Dr 5000 COGS / Cr 1140 Raw Materials**.\n\n*This ensures your business never books premature profit before goods are delivered.*`;
      }
    }

    // If local answer exists, display immediately
    if (localAnswer) {
      setTimeout(() => {
        setMessages(prev => [
          ...prev,
          {
            id: `assist-${Date.now()}`,
            sender: 'assistant',
            text: localAnswer,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
        setIsTyping(false);
      }, 350);
      return;
    }

    // Try Claude AI proxy for complex custom inquiries
    try {
      const systemPrompt = `You are the BakeWealth AI Kitchen & Financial Assistant. You help professional cake bakers and bakery owners navigate BakeWealth.
Terminology & Plain-English Guidelines:
When explaining technical terms like 'calibrated', 'density', 'levelled height', 'trim %', 'plan area', 'applied thickness (mm)', 'reverse thickness', 'committed stock', 'two-way adjustments', or accounting terms like 'customer deposit liability' and 'depreciation':
1. Always give the warm, plain-English kitchen explanation FIRST before any math or formula.
2. Use relatable kitchen analogies (e.g. calibrating is like zeroing your digital kitchen scale or tuning an oven thermometer; density is comparing light sponge to heavy mud cake; trim % is the dome sliced flat with a levelling knife; committed stock is reserving a hotel room while physical deduction is checking in).
3. Tell the baker exactly which screen or button to use in BakeWealth to see or set that value.
4. Keep tone warm, empowering, practical, and clear. Never use emojis in technical data.`;

      const aiResponse = await callClaude(
        [{ role: 'user', content: textToSend }],
        systemPrompt,
        1500,
        { creditCost: 0 } // Free for help walkthrough
      );

      setMessages(prev => [
        ...prev,
        {
          id: `assist-${Date.now()}`,
          sender: 'assistant',
          text: aiResponse || 'I am ready to help you with recipe calibration, order calculations, stock adjustments, or kitchen production sheets. Please ask any specific question.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } catch {
      // Graceful fallback to topic overview if proxy is offline
      setMessages(prev => [
        ...prev,
        {
          id: `assist-${Date.now()}`,
          sender: 'assistant',
          text: `### ${currentTopicData.title}\n\n${currentTopicData.summary}\n\n**Key Steps to Set Up:**\n${currentTopicData.steps.map(s => `${s.num}. **${s.title}:** ${s.text}`).join('\n\n')}\n\n*Pro-Tip: ${currentTopicData.proTips[0]}*`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(3px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: 'var(--panel, #FDFAF4)',
          borderRadius: 16,
          border: '1px solid var(--border, #E0D3BB)',
          boxShadow: '0 20px 60px rgba(41, 22, 8, 0.25)',
          width: '100%',
          maxWidth: 1040,
          height: '90vh',
          maxHeight: 740,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          fontFamily: "'DM Sans', sans-serif"
        }}
      >
        {/* Header Bar */}
        <div
          style={{
            padding: '16px 24px',
            background: 'var(--sidebar, #1E1712)',
            color: '#FFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(200, 145, 42, 0.3)',
            flexShrink: 0
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 9,
                background: 'rgba(200, 145, 42, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--gold, #C8912A)'
              }}
            >
              <Sparkles size={20} />
            </div>
            <div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, color: 'var(--gold, #C8912A)' }}>
                BakeWealth AI Assistant & Kitchen Guide
              </div>
              <div style={{ fontSize: 12, color: '#D4C4B5' }}>
                Clear explanations, step-by-step setup guides, and instant calculations support
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Guide vs Chat Tab Switcher */}
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.08)', borderRadius: 8, padding: 3 }}>
              <button
                type="button"
                onClick={() => setActiveTab('guide')}
                style={{
                  padding: '5px 12px',
                  borderRadius: 6,
                  border: 'none',
                  background: activeTab === 'guide' ? 'var(--gold, #C8912A)' : 'transparent',
                  color: activeTab === 'guide' ? '#FFF' : '#E0D3BB',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5
                }}
              >
                <BookOpen size={13} /> Step-by-Step Guide
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('chat')}
                style={{
                  padding: '5px 12px',
                  borderRadius: 6,
                  border: 'none',
                  background: activeTab === 'chat' ? 'var(--gold, #C8912A)' : 'transparent',
                  color: activeTab === 'chat' ? '#FFF' : '#E0D3BB',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5
                }}
              >
                <MessageSquare size={13} /> Ask AI Anything
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                borderRadius: 8,
                color: '#FFF',
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
              title="Close Guide"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body Container */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Sidebar Topic List */}
          <div
            style={{
              width: 280,
              background: '#F9F5EE',
              borderRight: '1px solid var(--border, #E0D3BB)',
              overflowY: 'auto',
              padding: '14px 10px',
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 4
            }}
          >
            <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted, #8C6E52)', padding: '6px 10px 8px' }}>
              Select Help Section
            </div>

            {HELP_TOPICS.map((topic) => {
              const IconComp = topic.icon;
              const isActive = activeTopicId === topic.id;
              return (
                <button
                  key={topic.id}
                  type="button"
                  onClick={() => {
                    setActiveTopicId(topic.id);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: isActive ? '1.5px solid var(--gold, #C8912A)' : '1px solid transparent',
                    background: isActive ? '#FFF9EE' : 'transparent',
                    color: isActive ? 'var(--gold, #C8912A)' : 'var(--text, #291608)',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      background: isActive ? 'var(--gold, #C8912A)' : 'rgba(200, 145, 42, 0.12)',
                      color: isActive ? '#FFF' : 'var(--gold, #C8912A)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    <IconComp size={15} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 13, fontWeight: isActive ? 700 : 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {topic.title}
                      </span>
                      {topic.badge && (
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 700,
                            padding: '1px 5px',
                            borderRadius: 4,
                            background: isActive ? 'rgba(200, 145, 42, 0.2)' : '#EDE5D6',
                            color: isActive ? 'var(--gold, #C8912A)' : 'var(--muted, #8C6E52)'
                          }}
                        >
                          {topic.badge}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}

            <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid var(--border, #E0D3BB)', paddingInline: 8 }}>
              <div style={{ fontSize: 11.5, color: 'var(--muted, #8C6E52)', lineHeight: 1.5 }}>
                💡 <strong>Tip:</strong> Need live help on any screen? Click the "Ask AI Anything" tab above to type your specific kitchen inquiry.
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#FFFDF9' }}>
            {activeTab === 'guide' ? (
              <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
                {/* Topic Header */}
                <div style={{ marginBottom: 20, borderBottom: '1px solid var(--border, #E0D3BB)', paddingBottom: 16 }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--gold, #C8912A)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                    <Sparkles size={14} /> BakeWealth Official System Guide
                  </div>
                  <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 24, fontWeight: 700, color: 'var(--text, #291608)', margin: '0 0 8px' }}>
                    {currentTopicData.title}
                  </h2>
                  <p style={{ fontSize: 14, color: 'var(--muted, #8C6E52)', lineHeight: 1.6, margin: 0 }}>
                    {currentTopicData.summary}
                  </p>
                </div>

                {/* Step-by-Step Instructions */}
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text, #291608)', marginBottom: 14 }}>
                    Step-by-Step Kitchen & System Setup
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {currentTopicData.steps.map((st) => (
                      <div
                        key={st.num}
                        style={{
                          display: 'flex',
                          gap: 14,
                          padding: '14px 16px',
                          borderRadius: 10,
                          background: 'var(--panel, #FDFAF4)',
                          border: '1px solid var(--border, #E0D3BB)'
                        }}
                      >
                        <div
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            background: 'var(--gold, #C8912A)',
                            color: '#FFF',
                            fontWeight: 700,
                            fontSize: 13,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}
                        >
                          {st.num}
                        </div>
                        <div>
                          <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text, #291608)', marginBottom: 4 }}>
                            {st.title}
                          </div>
                          <div style={{ fontSize: 13, color: 'var(--text, #291608)', lineHeight: 1.6 }}>
                            {st.text}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Worked Example Box */}
                {currentTopicData.workedExample && (
                  <div
                    style={{
                      background: '#F6F1E6',
                      borderRadius: 12,
                      padding: '18px 20px',
                      border: '1.5px solid var(--gold, #C8912A)',
                      marginBottom: 24
                    }}
                  >
                    <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 700, color: 'var(--text, #291608)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>📐</span> {currentTopicData.workedExample.title}
                    </div>
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--text, #291608)', lineHeight: 1.65 }}>
                      {currentTopicData.workedExample.points.map((pt, pIdx) => (
                        <li key={pIdx} style={{ marginBottom: 4 }}>{pt}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Key Terminology Demystified */}
                {currentTopicData.keyTerms && (
                  <div style={{ marginBottom: 24, background: '#FFFDF9', border: '1px solid var(--border, #E0D3BB)', borderRadius: 10, padding: 14 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--gold, #C8912A)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <HelpCircle size={15} /> Key Terms Demystified
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
                      {currentTopicData.keyTerms.map((kt, ktIdx) => (
                        <div key={ktIdx} style={{ background: '#FAF6EE', borderRadius: 8, padding: '10px 12px', border: '1px solid rgba(200, 145, 42, 0.2)' }}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text, #291608)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span>{kt.term}</span>
                            <button
                              type="button"
                              onClick={() => handleSendMessage(`What does "${kt.term}" mean?`)}
                              style={{ background: 'none', border: 'none', color: 'var(--gold, #C8912A)', fontSize: 11, cursor: 'pointer', fontWeight: 600, padding: 0 }}
                              title="Ask AI to explain in depth"
                            >
                              Ask AI →
                            </button>
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--muted, #8C6E52)', marginTop: 4, lineHeight: 1.5 }}>
                            {kt.def}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Full Interactive Glossary Browser if viewing Glossary topic */}
                {activeTopicId === 'glossary' && (
                  <div style={{ marginBottom: 24 }}>
                    <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
                      <div style={{ position: 'relative', flex: '1 1 240px' }}>
                        <Search size={14} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--muted, #8C6E52)' }} />
                        <input
                          type="text"
                          placeholder="Search terms (e.g. Calibrated, Density, Trim %, Committed)..."
                          value={glossarySearch}
                          onChange={e => setGlossarySearch(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px 12px 8px 32px',
                            borderRadius: 8,
                            border: '1px solid var(--border, #E0D3BB)',
                            fontSize: 12.5,
                            outline: 'none',
                            fontFamily: 'inherit'
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {['All', 'Recipe & Baking', 'Geometry & Sizing', 'Coverings & Frosting', 'Inventory & Production', 'Costing & Accounting'].map(cat => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setGlossaryCat(cat)}
                            style={{
                              padding: '5px 10px',
                              borderRadius: 16,
                              fontSize: 11,
                              border: glossaryCat === cat ? '1px solid var(--gold, #C8912A)' : '1px solid var(--border, #E0D3BB)',
                              background: glossaryCat === cat ? 'var(--gold, #C8912A)' : '#FFF',
                              color: glossaryCat === cat ? '#FFF' : 'var(--text, #291608)',
                              fontWeight: glossaryCat === cat ? 700 : 500,
                              cursor: 'pointer'
                            }}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {BAKERY_GLOSSARY
                        .filter(t => glossaryCat === 'All' || t.category === glossaryCat)
                        .filter(t => !glossarySearch || t.term.toLowerCase().includes(glossarySearch.toLowerCase()) || t.shortDef.toLowerCase().includes(glossarySearch.toLowerCase()) || (t.plainEnglish && t.plainEnglish.toLowerCase().includes(glossarySearch.toLowerCase())))
                        .map(item => (
                          <div
                            key={item.id}
                            style={{
                              padding: 16,
                              borderRadius: 10,
                              background: '#FFFDF9',
                              border: '1.2px solid var(--border, #E0D3BB)',
                              boxShadow: '0 2px 6px rgba(41, 22, 8, 0.03)'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', gap: 6 }}>
                              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text, #291608)' }}>
                                {item.term}
                              </div>
                              <span style={{ fontSize: 10.5, fontWeight: 700, background: 'rgba(200, 145, 42, 0.15)', color: 'var(--gold, #C8912A)', padding: '2px 8px', borderRadius: 12 }}>
                                {item.category}
                              </span>
                            </div>
                            <div style={{ fontSize: 13, color: 'var(--text, #291608)', marginBottom: 8, lineHeight: 1.55 }}>
                              <strong>In Plain English:</strong> {item.plainEnglish}
                            </div>
                            <div style={{ fontSize: 12.5, color: '#684E33', background: '#F8F4EC', padding: '8px 12px', borderRadius: 6, marginBottom: 8, lineHeight: 1.5 }}>
                              💡 <strong>Kitchen Analogy:</strong> {item.kitchenAnalogy || item.analogy}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, fontSize: 11.5 }}>
                              <span style={{ color: 'var(--muted, #8C6E52)' }}>
                                📍 <strong>Where:</strong> {item.whereToFind || item.where}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleSendMessage(`Explain ${item.term} to me in detail`)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--gold, #C8912A)',
                                  fontSize: 12,
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  padding: 0,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4
                                }}
                              >
                                Ask AI to Elaborate →
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Pro-Tips & Common Mistakes */}
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text, #291608)', marginBottom: 10 }}>
                    Professional Kitchen Tips
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {currentTopicData.proTips.map((tip, tIdx) => (
                      <div key={tIdx} style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 13, color: 'var(--muted, #8C6E52)' }}>
                        <span style={{ color: 'var(--gold, #C8912A)', fontWeight: 700 }}>•</span>
                        <span>{tip}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quick Interactive FAQ Chips */}
                {currentTopicData.faqs && (
                  <div style={{ borderTop: '1px solid var(--border, #E0D3BB)', paddingTop: 18 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--muted, #8C6E52)', marginBottom: 10 }}>
                      Frequently Asked Questions (Click to Ask AI)
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {currentTopicData.faqs.map((faq, fIdx) => (
                        <button
                          key={fIdx}
                          type="button"
                          onClick={() => handleSendMessage(faq.q)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: 20,
                            border: '1px solid rgba(200, 145, 42, 0.4)',
                            background: '#FFFDF9',
                            color: 'var(--text, #291608)',
                            fontSize: 12,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            transition: 'all 0.15s'
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.background = 'rgba(200, 145, 42, 0.12)';
                            e.currentTarget.style.borderColor = 'var(--gold, #C8912A)';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background = '#FFFDF9';
                            e.currentTarget.style.borderColor = 'rgba(200, 145, 42, 0.4)';
                          }}
                        >
                          <HelpCircle size={13} color="var(--gold, #C8912A)" />
                          <span>{faq.q}</span>
                          <ArrowRight size={11} color="var(--gold, #C8912A)" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Chat Assistant View */
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div
                  ref={chatScrollRef}
                  style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '20px 24px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 14
                  }}
                >
                  {messages.map((m) => {
                    const isUser = m.sender === 'user';
                    return (
                      <div
                        key={m.id}
                        style={{
                          display: 'flex',
                          justifyContent: isUser ? 'flex-end' : 'flex-start',
                          gap: 10,
                          alignItems: 'flex-start'
                        }}
                      >
                        {!isUser && (
                          <div
                            style={{
                              width: 30,
                              height: 30,
                              borderRadius: '50%',
                              background: 'var(--gold, #C8912A)',
                              color: '#FFF',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              marginTop: 2
                            }}
                          >
                            <Sparkles size={14} />
                          </div>
                        )}

                        <div
                          style={{
                            maxWidth: '82%',
                            borderRadius: isUser ? '14px 4px 14px 14px' : '4px 14px 14px 14px',
                            padding: '12px 16px',
                            background: isUser ? 'linear-gradient(135deg, #2D1D10, #3E2917)' : '#FFFFFF',
                            color: isUser ? '#FFF' : 'var(--text, #291608)',
                            border: isUser ? 'none' : '1px solid var(--border, #E0D3BB)',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                            fontSize: 13.5,
                            lineHeight: 1.6
                          }}
                        >
                          <div style={{ whiteSpace: 'pre-wrap' }}>{m.text}</div>
                          {!isUser && (
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8, paddingTop: 6, borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                              <button
                                type="button"
                                onClick={() => handleCopy(m.id, m.text)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: copiedId === m.id ? '#357A52' : 'var(--muted, #8C6E52)',
                                  fontSize: 11,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4
                                }}
                              >
                                {copiedId === m.id ? <Check size={12} /> : <Copy size={12} />}
                                <span>{copiedId === m.id ? 'Copied' : 'Copy'}</span>
                              </button>
                            </div>
                          )}
                        </div>

                        {isUser && (
                          <div
                            style={{
                              width: 30,
                              height: 30,
                              borderRadius: '50%',
                              background: '#2D1D10',
                              color: '#FFF',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              marginTop: 2,
                              fontSize: 12,
                              fontWeight: 700
                            }}
                          >
                            {user?.name ? user.name[0].toUpperCase() : 'U'}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {isTyping && (
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <div
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: '50%',
                          background: 'var(--gold, #C8912A)',
                          color: '#FFF',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}
                      >
                        <Sparkles size={14} />
                      </div>
                      <div style={{ padding: '8px 14px', borderRadius: 8, background: '#FFFFFF', border: '1px solid var(--border, #E0D3BB)', fontSize: 12.5, color: 'var(--muted, #8C6E52)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <RefreshCw size={12} className="spin" />
                        <span>BakeWealth AI is generating an explanation...</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Terminology Quick Explainer Strip */}
                <div style={{ padding: '6px 24px', background: '#F8F4EC', borderTop: '1px solid var(--border, #E0D3BB)', display: 'flex', gap: 6, overflowX: 'auto', whiteSpace: 'nowrap', alignItems: 'center' }}>
                  <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', color: 'var(--gold, #C8912A)', letterSpacing: '0.06em', flexShrink: 0 }}>
                    Explain Term:
                  </span>
                  {[
                    'What does "Calibrated" mean?',
                    'What is "Density"?',
                    'What is "Levelled Height"?',
                    'What is "Trim %"?',
                    'What is "Plan Area"?',
                    'Crumb vs. Finish Coat',
                    'What is "Reverse Thickness"?',
                    'What is "Committed Stock"?',
                    'Margin vs. Markup',
                    'Why Deposits are Liabilities'
                  ].map((termQ, tIdx) => (
                    <button
                      key={tIdx}
                      type="button"
                      onClick={() => handleSendMessage(termQ)}
                      style={{
                        padding: '3px 9px',
                        borderRadius: 14,
                        border: '1px solid rgba(200, 145, 42, 0.35)',
                        background: '#FFF',
                        fontSize: 11,
                        cursor: 'pointer',
                        color: 'var(--text, #291608)',
                        fontWeight: 500,
                        flexShrink: 0
                      }}
                    >
                      🏷️ {termQ}
                    </button>
                  ))}
                </div>

                {/* Question Chips Strip */}
                {currentTopicData.faqs && (
                  <div style={{ padding: '8px 24px', background: '#FDFBF7', borderTop: '1px solid var(--border, #E0D3BB)', display: 'flex', gap: 6, overflowX: 'auto', whiteSpace: 'nowrap' }}>
                    {currentTopicData.faqs.map((faq, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSendMessage(faq.q)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 16,
                          border: '1px solid rgba(200, 145, 42, 0.3)',
                          background: '#FFF',
                          fontSize: 11.5,
                          cursor: 'pointer',
                          color: 'var(--text, #291608)'
                        }}
                      >
                        {faq.q}
                      </button>
                    ))}
                  </div>
                )}

                {/* Input Strip */}
                <div style={{ padding: '12px 24px', background: '#FFF', borderTop: '1px solid var(--border, #E0D3BB)' }}>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSendMessage();
                    }}
                    style={{ display: 'flex', gap: 10 }}
                  >
                    <input
                      type="text"
                      placeholder={`Ask anything about ${currentTopicData.title} or general bakery questions...`}
                      value={inputText}
                      onChange={e => setInputText(e.target.value)}
                      style={{
                        flex: 1,
                        padding: '10px 14px',
                        borderRadius: 8,
                        border: '1px solid var(--border, #E0D3BB)',
                        fontSize: 13.5,
                        outline: 'none',
                        fontFamily: 'inherit'
                      }}
                    />
                    <button
                      type="submit"
                      disabled={!inputText.trim() || isTyping}
                      style={{
                        padding: '10px 18px',
                        borderRadius: 8,
                        border: 'none',
                        background: 'var(--gold, #C8912A)',
                        color: '#FFF',
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: !inputText.trim() || isTyping ? 'not-allowed' : 'pointer',
                        opacity: !inputText.trim() || isTyping ? 0.6 : 1,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6
                      }}
                    >
                      <Send size={14} /> Send
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
