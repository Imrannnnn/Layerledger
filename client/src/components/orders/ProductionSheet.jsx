/**
 * ProductionSheet.jsx
 * ----------------------------------------------------------------------------
 * BakeWealth Kitchen Production Sheet
 * 
 * Generated when an order is confirmed. Designed specifically for kitchen use
 * (propped on a phone next to a mixer, with large type, clear weigh-outs,
 * and high-contrast, ink-saving printable formatting).
 * 
 * Three Tabs:
 *   1. Shopping list (aggregated ingredients once, shortfall banner, egg pieces @ 50g,
 *      liquids >400g in litres, unrounded batch counts).
 *   2. Bake sheet (numbered weigh-out list per pan, scaled recipe cards per pan & flavour).
 *   3. Build order (resting & chilling prep timeline, editable sequence).
 * ----------------------------------------------------------------------------
 */

import React, { useState, useMemo } from 'react';
import { Card, Btn } from '../common/ui.jsx';
import { fmt } from '../../lib/helpers.js';
import {
  planArea,
  perimeter,
  gapArea,
  surfaceArea,
  gramsPerPan,
  coveringMass,
  calculateDensity,
  scaleRecipeIngredients,
  calculatePortionsGeometry,
  STANDARD_PANS
} from '../../lib/cakeGeometry.js';
import { Printer, AlertTriangle, CheckCircle, Clock, ShoppingCart, Flame, ListOrdered, ChevronRight, Edit3, Sparkles } from 'lucide-react';

export function ProductionSheet({ order, quote, inventory = [], recipes = [], onSaveOrder, onClose }) {
  const targetOrder = order || quote || {};
  const [activeTab, setActiveTab] = useState('shopping'); // 'shopping' | 'bake' | 'timeline'
  const [customTimeline, setCustomTimeline] = useState(() => {
    return targetOrder?.metadata?.productionSheet?.timeline || targetOrder?.productionSheet?.timeline || null;
  });
  const [editingStepIndex, setEditingStepIndex] = useState(null);
  const [editedStepText, setEditedStepText] = useState('');

  // ---------------------------------------------------------------------------
  // Geometric & Production Aggregation Engine
  // ---------------------------------------------------------------------------
  const prodData = useMemo(() => {
    const items = targetOrder?.items || [];
    const pansWeighOut = [];
    const recipePanCards = [];
    const recipeCoverCards = [];
    const decorList = [];
    const ingredientAgg = new Map(); // ingredientId -> { id, name, unit, neededGrams, recipes: Set }
    const recipeBatches = [];

    let panIndex = 1;

    items.forEach((item, itemIdx) => {
      // 1. CAKE TIERS
      if (item.tiers && Array.isArray(item.tiers)) {
        item.tiers.forEach((tier, tierIdx) => {
          const shape = (tier.shape || 'round').toLowerCase();
          const a = Number(tier.dimensionA || tier.size || tier.dimA) || 8;
          const b = Number(tier.dimensionB || tier.width || tier.dimB) || (shape === 'rect' ? 8 : a);
          const H = Number(tier.height || tier.cakeHeight) || 4;
          const pa = planArea(shape, a, b);
          const pe = perimeter(shape, a, b);

          const flavourRows = tier.flavourRows || (Array.isArray(tier.layers) ? tier.layers.map(l => ({
            recipeId: l.recipeId || recipes.find(r => r.name.toLowerCase() === (l.flavour || '').trim().toLowerCase())?.id,
            flavour: l.flavour,
            layers: Number(l.qty) || Number(l.layers) || 1
          })) : (tier.recipeId ? [{ recipeId: tier.recipeId, layers: tier.layers || 2 }] : []));

          const totalLayers = flavourRows.reduce((s, f) => s + (Number(f.layers) || 0), 0) || 1;
          const layerThickness = H / totalLayers;

          flavourRows.forEach((row) => {
            const recipe = recipes.find(r => r.id === row.recipeId) ||
                           recipes.find(r => r.name.toLowerCase() === (row.flavour || '').trim().toLowerCase());
            const rName = recipe?.name || row.flavour || 'Cake Layer';
            const density = Number(recipe?.density || recipe?.cal_density) || ((recipe?.cal_grams || recipe?.calGrams) ? calculateDensity(recipe?.cal_grams || recipe?.calGrams, recipe?.cal_shape || recipe?.calShape || shape, recipe?.cal_dim_a || recipe?.calDimA || a, recipe?.cal_dim_b || recipe?.calDimB || b, recipe?.cal_height_in || recipe?.calHeightIn || 2) : 10.911);
            const trimPct = recipe?.trimPct !== undefined ? Number(recipe?.trimPct) : (recipe?.trim_pct !== undefined ? Number(recipe?.trim_pct) : 0.08);
            const gPerPan = gramsPerPan(density, pa, layerThickness, trimPct);
            const count = Number(row.layers) || 1;

            for (let i = 0; i < count; i++) {
              pansWeighOut.push({
                num: panIndex++,
                flavour: rName,
                recipeId: recipe?.id,
                sizeLabel: `${a}″ ${shape}`,
                layerThickness,
                grams: Math.round(gPerPan),
                tierIndex: tierIdx + 1,
                itemIndex: itemIdx + 1
              });
            }

            // Recipe card per pan & flavour combination
            const existingCard = recipePanCards.find(c => c.recipeId === recipe?.id && c.sizeLabel === `${a}″ ${shape}` && Math.abs(c.layerThickness - layerThickness) < 0.05);
            if (existingCard) {
              existingCard.panCount += count;
              existingCard.totalGrams += Math.round(gPerPan) * count;
            } else {
              recipePanCards.push({
                recipeId: recipe?.id,
                recipeName: rName,
                sizeLabel: `${a}″ ${shape}`,
                layerThickness,
                gramsPerPan: Math.round(gPerPan),
                panCount: count,
                totalGrams: Math.round(gPerPan) * count,
                baseRecipe: recipe
              });
            }
          });

          // Coverings for this tier
          const tierGap = gapArea(pa, totalLayers);
          const tierSurf = surfaceArea(pa, pe, H);

          // Fillings from item.fillings or tier.fillings
          const fillingsList = item.fillings && item.fillings.length > 0 ? item.fillings : (tier.fillings || []);
          if (fillingsList && Array.isArray(fillingsList) && tierGap > 0) {
            const gapShare = tierGap / fillingsList.length;
            fillingsList.forEach((f) => {
              const fType = f.type || f.recipeId;
              const covRecipe = recipes.find(r => r.id === f.recipeId || r.name.toLowerCase() === (fType || '').trim().toLowerCase());
              if (covRecipe) {
                const mm = Number(f.thicknessMm || covRecipe.thickFillMm || covRecipe.thickness_fill) || 4.5;
                const den = Number(covRecipe.densityGPerCm3 || covRecipe.density) || 0.90;
                const was = Number(covRecipe.wastePct || covRecipe.waste_pct) || 0.15;
                const mass = coveringMass(gapShare, mm, den, was);

                const existing = recipeCoverCards.find(c => c.recipeId === covRecipe.id && c.job === 'filling');
                if (existing) {
                  existing.totalGrams += mass;
                } else {
                  recipeCoverCards.push({
                    recipeId: covRecipe.id,
                    recipeName: covRecipe.name,
                    job: 'filling',
                    thicknessMm: mm,
                    wastePct: was,
                    totalGrams: mass,
                    baseRecipe: covRecipe
                  });
                }
              }
            });
          }

          // Crumb coat
          const crumbType = item.crumb !== undefined ? item.crumb : (item.crumbCoatId || tier.crumb || "");
          if (crumbType && crumbType !== "None") {
            const crumbRecipe = recipes.find(r => r.id === crumbType || r.name.toLowerCase() === (crumbType || '').trim().toLowerCase());
            if (crumbRecipe) {
              const mm = Number(crumbRecipe.thickCrumbMm || crumbRecipe.thickness_crumb) || 1.0;
              const den = Number(crumbRecipe.densityGPerCm3 || crumbRecipe.density) || 0.90;
              const was = Number(crumbRecipe.wastePct || crumbRecipe.waste_pct) || 0.10;
              const mass = coveringMass(tierSurf, mm, den, was);

              const existing = recipeCoverCards.find(c => c.recipeId === crumbRecipe.id && c.job === 'crumb');
              if (existing) {
                existing.totalGrams += mass;
              } else {
                recipeCoverCards.push({
                  recipeId: crumbRecipe.id,
                  recipeName: crumbRecipe.name,
                  job: 'crumb',
                  thicknessMm: mm,
                  wastePct: was,
                  totalGrams: mass,
                  baseRecipe: crumbRecipe
                });
              }
            }
          }

          // Outside finish
          const finType = item.finish !== undefined ? item.finish : (item.finishId || tier.finish || (tier.coverings?.[0]?.type) || "");
          if (finType && finType !== "None") {
            const finRecipe = recipes.find(r => r.id === finType || r.name.toLowerCase() === (finType || '').trim().toLowerCase());
            if (finRecipe) {
              const mm = Number(finRecipe.thickFinishMm || finRecipe.thickness_finish) || 4.9;
              const den = Number(finRecipe.densityGPerCm3 || finRecipe.density) || 1.10;
              const was = Number(finRecipe.wastePct || finRecipe.waste_pct) || 0.15;
              const mass = coveringMass(tierSurf, mm, den, was);

              const existing = recipeCoverCards.find(c => c.recipeId === finRecipe.id && c.job === 'finish');
              if (existing) {
                existing.totalGrams += mass;
              } else {
                recipeCoverCards.push({
                  recipeId: finRecipe.id,
                  recipeName: finRecipe.name,
                  job: 'finish',
                  thicknessMm: mm,
                  wastePct: was,
                  totalGrams: mass,
                  baseRecipe: finRecipe
                });
              }
            }
          }
        });
      }

      // 2. PORTIONS (Slab or Counted)
      if (item.type === 'portions' || item.portions) {
        const p = item.portions || item;
        if (p.route === 'slab' || (!p.route && (p.layers || p.flavourRows))) {
          const pan = STANDARD_PANS[p.panIndex || 0] || STANDARD_PANS[1];
          const trayW = p.trayW || pan.width;
          const trayL = p.trayL || pan.length;
          const sliceW = Number(p.sliceWidth || p.w) || 2;
          const sliceL = Number(p.sliceLength || p.l) || 2;
          const sliceH = Number(p.sliceHeight || p.h) || 4;
          const allowance = Number(p.allowancePct) || 5;
          const servings = Number(p.servings || p.needed) || 100;
          const geom = calculatePortionsGeometry({
            servings,
            sliceWidth: sliceW,
            sliceLength: sliceL,
            sliceHeight: sliceH,
            allowancePct: allowance,
            trayW,
            trayL,
            pan,
            layers: p.layers,
            flavourRows: p.flavourRows
          });
          const slabs = geom.slabs;
          const layerTh = geom.layerThickness;
          const pa = geom.panArea || geom.panAreaSqIn || (trayW * trayL);

          const pRows = p.flavourRows || (p.layers || []).map(l => ({
            recipeId: l.recipeId || recipes.find(r => r.name.toLowerCase() === (l.flavour || '').trim().toLowerCase())?.id,
            flavour: l.flavour,
            layers: Number(l.qty) || 1
          }));

          pRows.forEach(row => {
            const recipe = recipes.find(r => r.id === row.recipeId) ||
                           recipes.find(r => r.name.toLowerCase() === (row.flavour || '').trim().toLowerCase());
            const rName = recipe?.name || row.flavour || 'Slab Layer';
            const density = Number(recipe?.density || recipe?.cal_density) || ((recipe?.cal_grams || recipe?.calGrams) ? calculateDensity(recipe?.cal_grams || recipe?.calGrams, recipe?.cal_shape || recipe?.calShape || 'rect', recipe?.cal_dim_a || recipe?.calDimA || trayW, recipe?.cal_dim_b || recipe?.calDimB || trayL, recipe?.cal_height_in || recipe?.calHeightIn || 2) : 10.911);
            const trimPct = recipe?.trimPct !== undefined ? Number(recipe?.trimPct) : (recipe?.trim_pct !== undefined ? Number(recipe?.trim_pct) : 0.08);
            const gPerPan = gramsPerPan(density, pa, layerTh, trimPct);
            const count = (Number(row.layers) || 1) * slabs;

            for (let i = 0; i < count; i++) {
              pansWeighOut.push({
                num: panIndex++,
                flavour: rName,
                recipeId: recipe?.id,
                sizeLabel: `${trayW} × ${trayL} slab`,
                layerThickness: layerTh,
                grams: Math.round(gPerPan),
                itemIndex: itemIdx + 1,
                isPortions: true
              });
            }

            recipePanCards.push({
              recipeId: recipe?.id,
              recipeName: rName,
              sizeLabel: `${trayW} × ${trayL} slab`,
              layerThickness: layerTh,
              gramsPerPan: Math.round(gPerPan),
              panCount: count,
              totalGrams: Math.round(gPerPan) * count,
              baseRecipe: recipe
            });
          });

          // Slab filling
          if (p.fillingRecipe && geom.gapArea > 0) {
            const fRecipe = recipes.find(r => r.name.toLowerCase() === p.fillingRecipe.toLowerCase() || r.id === p.fillingRecipe);
            if (fRecipe) {
              const mm = Number(fRecipe.thickness_fill || fRecipe.thickFillMm) || 4.5;
              const den = Number(fRecipe.density || fRecipe.densityGPerCm3) || 0.90;
              const was = Number(fRecipe.waste_pct || fRecipe.wastePct) || 0.15;
              const mass = coveringMass(geom.gapArea, mm, den, was);
              recipeCoverCards.push({
                recipeId: fRecipe.id,
                recipeName: fRecipe.name,
                job: 'filling',
                thicknessMm: mm,
                wastePct: was,
                totalGrams: mass,
                baseRecipe: fRecipe
              });
            }
          }

          // Slab top finish
          if (p.topFinishRecipe && geom.topArea > 0) {
            const tRecipe = recipes.find(r => r.name.toLowerCase() === p.topFinishRecipe.toLowerCase() || r.id === p.topFinishRecipe);
            if (tRecipe) {
              const mm = Number(tRecipe.thickness_finish || tRecipe.thickFinishMm) || 4.9;
              const den = Number(tRecipe.density || tRecipe.densityGPerCm3) || 0.90;
              const was = Number(tRecipe.waste_pct || tRecipe.wastePct) || 0.15;
              const mass = coveringMass(geom.topArea, mm, den, was);
              recipeCoverCards.push({
                recipeId: tRecipe.id,
                recipeName: tRecipe.name,
                job: 'finish',
                thicknessMm: mm,
                wastePct: was,
                totalGrams: mass,
                baseRecipe: tRecipe
              });
            }
          }
        }
      }

      // 3. DECORATIONS
      if (item.decorations && Array.isArray(item.decorations)) {
        item.decorations.forEach(d => {
          decorList.push({
            name: d.name || 'Decoration Item',
            grams: Number(d.grams) || 0
          });
        });
      }
    });

    // Aggregate Ingredients across all recipe cards
    const allScaledCards = [...recipePanCards, ...recipeCoverCards];
    allScaledCards.forEach(card => {
      const base = card.baseRecipe;
      const rawIngs = base?.ingredients || base?.ing || [];
      if (!base || !Array.isArray(rawIngs) || rawIngs.length === 0) return;
      const baseYield = Number(base.batch_yield_g) || Number(base.yield_grams) || Number(base.batchWeight) || (rawIngs.reduce((s, it) => s + (Number(it.qty !== undefined ? it.qty : it.quantity) || 0), 0)) || Number(base.cal_grams) || 1000;
      const cardGrams = card.totalGrams || (card.gramsPerPan * card.panCount) || 0;

      // Batches needed (never rounded)
      const batches = cardGrams / Math.max(1, baseYield);
      const existingBatch = recipeBatches.find(b => b.recipeId === base.id);
      if (existingBatch) {
        existingBatch.neededGrams += cardGrams;
        existingBatch.batches += batches;
      } else {
        recipeBatches.push({
          recipeId: base.id,
          name: base.name,
          neededGrams: cardGrams,
          baseYield,
          batches
        });
      }

      const normalizedIngs = rawIngs.map(ing => {
        const invId = ing.inventoryItemId || ing.iid || ing.id;
        const invItem = inventory.find(i => i.id === invId || i.name?.toLowerCase() === (ing.name || '').toLowerCase());
        const unit = ing.unit || invItem?.unit || 'g';
        let rawQty = Number(ing.quantity !== undefined ? ing.quantity : ing.qty) || 0;
        let qtyInGrams = rawQty;
        if (unit.toLowerCase() === 'kg' || unit.toLowerCase() === 'l') {
          qtyInGrams = rawQty * 1000;
        }
        return {
          id: invId,
          name: invItem?.name || ing.name || 'Ingredient',
          unit,
          quantity: qtyInGrams
        };
      });

      const scaledIngs = scaleRecipeIngredients(
        normalizedIngs,
        cardGrams,
        baseYield
      );

      scaledIngs.forEach(ing => {
        const key = ing.id || ing.name.toLowerCase();
        const existing = ingredientAgg.get(key);
        if (existing) {
          existing.neededGrams += ing.quantity;
          existing.recipes.add(base.name);
        } else {
          const invItem = inventory.find(i => i.id === ing.id || i.name?.toLowerCase() === ing.name.toLowerCase());
          ingredientAgg.set(key, {
            id: ing.id,
            name: ing.name,
            unit: ing.unit,
            neededGrams: ing.quantity,
            stockOnHand: invItem ? invItem.stock : 0,
            recipes: new Set([base.name])
          });
        }
      });
    });

    const shoppingList = Array.from(ingredientAgg.values()).map(it => {
      const needed = Math.round(it.neededGrams);
      const stock = it.stockOnHand;
      const shortfall = Math.max(0, needed - stock);
      return {
        ...it,
        needed,
        shortfall,
        isShort: shortfall > 0,
        recipeListStr: Array.from(it.recipes).join(', ')
      };
    });

    return {
      pansWeighOut,
      recipePanCards,
      recipeCoverCards,
      decorList,
      recipeBatches,
      shoppingList,
      shortfalls: shoppingList.filter(s => s.isShort)
    };
  }, [targetOrder, recipes, inventory]);

  // Default timeline derived from resting & setting constraints
  const defaultTimeline = useMemo(() => {
    return [
      { id: 'step_1', time: '2 days ahead', title: 'Prepare & rest fondant', desc: 'Roll out or knead fondant covering so it rests overnight and releases air bubbles.', auto: true },
      { id: 'step_2', time: '1 day ahead (Morning)', title: 'Bake all sponge layers & slabs', desc: 'Weigh out batters according to the bake sheet. Bake, cool, and level off domes.', auto: true },
      { id: 'step_3', time: '1 day ahead (Afternoon)', title: 'Fill & crumb coat · Chill', desc: 'Stack layers with calibrated fillings. Apply crumb coat to seal surface, then Chill for at least 4 hours.', auto: true },
      { id: 'step_4', time: 'Delivery day (Morning)', title: 'Outside finish & decorations', desc: 'Apply outside buttercream/ganache/fondant finish. Add gold leaf, pearls, and toppers.', auto: true },
      { id: 'step_5', time: 'Delivery day (Final)', title: 'Box, chill & dispatch', desc: 'Secure tiers with centre dowels, pack into box, and record client delivery in BakeWealth.', auto: true }
    ];
  }, []);

  const timeline = customTimeline || defaultTimeline;

  const handleUpdateStep = (idx) => {
    const updated = [...timeline];
    updated[idx] = { ...updated[idx], desc: editedStepText };
    setCustomTimeline(updated);
    setEditingStepIndex(null);
    if (typeof onSaveOrder === 'function') {
      onSaveOrder({
        ...order,
        metadata: {
          ...order?.metadata,
          productionSheet: {
            ...order?.metadata?.productionSheet,
            timeline: updated
          }
        }
      });
    }
  };

  const printSheet = () => {
    window.print();
  };

  return (
    <div className="kitchen-sheet-container" style={{ maxWidth: 840, margin: '0 auto', paddingBottom: 64 }}>
      <style>{`
        @media print {
          body { background: #fff !important; color: #000 !important; }
          .no-print { display: none !important; }
          .sheet-card { border: 1px solid #ccc !important; box-shadow: none !important; page-break-inside: avoid; }
        }
        .sheet-tab-btn {
          font-family: var(--body);
          font-size: 14.5px;
          font-weight: 600;
          padding: 8px 18px;
          border-radius: 999px;
          border: 1px solid var(--border);
          background: #fff;
          color: var(--muted);
          cursor: pointer;
        }
        .sheet-tab-btn[aria-selected="true"] {
          background: var(--text);
          border-color: var(--text);
          color: #fff;
        }
      `}</style>

      {/* Top Header */}
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--gold)' }}>
            Kitchen Production Sheet
          </div>
          <h1 style={{ fontFamily: 'var(--display)', fontSize: 24, margin: '4px 0', color: 'var(--text)' }}>
            {targetOrder?.clientName || 'Order'} · {targetOrder?.deliveryDate || (targetOrder?.dueDate ? new Date(targetOrder.dueDate).toLocaleDateString('en-NG', { weekday: 'short', month: 'short', day: 'numeric' }) : 'Confirmed Order')}
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('layerledger:open-help', { detail: { topic: 'prodsheet' } }))}
            title="Learn how production sheets, numbered weigh-outs, and stock deduction work"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "rgba(200, 145, 42, 0.12)",
              border: "1.2px solid rgba(200, 145, 42, 0.45)",
              color: "var(--gold)",
              padding: "6px 12px",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s"
            }}
          >
            <Sparkles size={14} /> How Production Sheets Work
          </button>
          <Btn small variant="outline" onClick={printSheet} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Printer size={14} /> Print Sheet
          </Btn>
          {onClose && (
            <Btn small variant="ghost" onClick={onClose}>Close</Btn>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="no-print" style={{ display: 'flex', gap: 8, margin: '14px 0 20px' }}>
        <button
          type="button"
          className="sheet-tab-btn"
          aria-selected={activeTab === 'shopping'}
          onClick={() => setActiveTab('shopping')}
        >
          <ShoppingCart size={14} style={{ display: 'inline', marginRight: 6 }} />
          1. Shopping List ({prodData.shoppingList.length})
        </button>
        <button
          type="button"
          className="sheet-tab-btn"
          aria-selected={activeTab === 'bake'}
          onClick={() => setActiveTab('bake')}
        >
          <Flame size={14} style={{ display: 'inline', marginRight: 6 }} />
          2. Bake Sheet ({prodData.pansWeighOut.length} pans)
        </button>
        <button
          type="button"
          className="sheet-tab-btn"
          aria-selected={activeTab === 'timeline'}
          onClick={() => setActiveTab('timeline')}
        >
          <ListOrdered size={14} style={{ display: 'inline', marginRight: 6 }} />
          3. Build Order
        </button>
      </div>

      {/* Shortfall Alert Banner */}
      {prodData.shortfalls.length > 0 && (
        <div style={{ marginBottom: 20, padding: '14px 18px', borderRadius: 10, background: '#FDF2E9', border: '1.5px solid #E0AE3A', color: '#9A5B14' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 14.5 }}>
            <AlertTriangle size={18} />
            <span>Shortfall Alert: {prodData.shortfalls.length} ingredient(s) need restocking before production begins!</span>
          </div>
          <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.5 }}>
            {prodData.shortfalls.map((s, idx) => (
              <div key={idx}>
                • <strong>{s.name}</strong>: Need {s.needed} {s.unit}, have {s.stockOnHand} {s.unit} (Short by {s.shortfall} {s.unit})
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────── */}
      {/* TAB 1: AGGREGATED SHOPPING LIST                                      */}
      {/* ──────────────────────────────────────────────────────────────────── */}
      {activeTab === 'shopping' && (
        <div>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', background: '#F6F1E6', border: '1px dashed var(--border)', borderRadius: 11, padding: '10px 13px', marginBottom: 14 }}>
            <b style={{ color: 'var(--text)' }}>Every ingredient on the whole order, added up once.</b> Butter runs through six of the recipes below. The list adds them together rather than printing butter six times, because that is what you carry to the market.
          </div>

          <Card className="sheet-card" style={{ padding: 20, marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text)' }}>
                Aggregated Shopping List & Ingredients
              </span>
              <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>
                Every ingredient summed once across all batters, fillings, and coverings
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {prodData.shoppingList.map((item, idx) => {
                const isEggs = item.name.toLowerCase().includes('egg');
                const isLiquid = ['milk', 'water', 'cream', 'oil', 'juice'].some(w => item.name.toLowerCase().includes(w));
                const eggsCount = isEggs ? Math.round(item.needed / 50) : null;
                const litres = (isLiquid && item.needed >= 400) ? (item.needed / 1000).toFixed(2) : null;

                return (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '10px 14px', borderRadius: 8, background: item.isShort ? '#FFF9F5' : 'var(--panel)', border: item.isShort ? '1px solid #E0AE3A' : '1px solid var(--border)' }}>
                    <div>
                      <div style={{ fontSize: 15.5, fontWeight: 600, color: 'var(--text)' }}>
                        {item.name}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                        Sources: {item.recipeListStr}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 16.5, fontWeight: 700, color: item.isShort ? '#B03A2E' : 'var(--text)' }}>
                        {item.needed.toLocaleString()} {item.unit || 'g'}
                        {eggsCount && <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--muted)', marginLeft: 6 }}>({eggsCount} pcs @ 50g)</span>}
                        {litres && <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--muted)', marginLeft: 6 }}>({litres} L)</span>}
                      </div>
                      <div style={{ fontSize: 12, color: item.isShort ? '#B03A2E' : 'var(--muted)' }}>
                        {item.stockOnHand > 0 ? `Stock on hand: ${item.stockOnHand} ${item.unit}` : 'Out of stock'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Batches Table */}
          <Card className="sheet-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text)', marginBottom: 6 }}>
              Batches to Mix (Exact Unrounded Batches)
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '0 0 12px' }}>
              The recipe is one batch. These are not whole numbers and they are not meant to be. Scale the ingredients, do not round the batches.
            </p>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: '1.5px solid var(--border)', textAlign: 'left', color: 'var(--muted)', fontSize: 12 }}>
                  <th style={{ padding: '8px 6px' }}>Recipe</th>
                  <th style={{ padding: '8px 6px' }}>Total Needed</th>
                  <th style={{ padding: '8px 6px' }}>Base Yield</th>
                  <th style={{ padding: '8px 6px', textAlign: 'right' }}>Exact Batches</th>
                </tr>
              </thead>
              <tbody>
                {prodData.recipeBatches.map((b, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 6px', fontWeight: 600 }}>{b.name}</td>
                    <td style={{ padding: '10px 6px' }}>{Math.round(b.neededGrams).toLocaleString()} g</td>
                    <td style={{ padding: '10px 6px' }}>{Math.round(b.baseYield).toLocaleString()} g</td>
                    <td style={{ padding: '10px 6px', textAlign: 'right', fontWeight: 700, color: 'var(--gold)' }}>
                      {b.batches.toFixed(2)} batches
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────── */}
      {/* TAB 2: BAKE SHEET (WEIGH-OUT & SCALED RECIPE CARDS)                  */}
      {/* ──────────────────────────────────────────────────────────────────── */}
      {activeTab === 'bake' && (
        <div>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', background: '#F6F1E6', border: '1px dashed var(--border)', borderRadius: 11, padding: '10px 13px', marginBottom: 14 }}>
            <b style={{ color: 'var(--text)' }}>One card per pan size and flavour, with the base recipe already scaled to it.</b> Not "1,851 g of vanilla sponge" with nothing behind it. The flour, butter, eggs and milk that add up to those 1,851 g, for that pan.
          </div>

          {/* Numbered Weigh-out List */}
          <Card className="sheet-card" style={{ padding: 20, marginBottom: 22 }}>
            <div style={{ fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text)', marginBottom: 12 }}>
              Numbered Pan Weigh-Outs (One Row Per Pan)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {prodData.pansWeighOut.map((pan) => (
                <div key={pan.num} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: 8, background: 'var(--panel)', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '4px 10px', borderRadius: 999, background: 'var(--text)', color: '#fff', fontSize: 13, fontWeight: 700 }}>
                      Pan {pan.num}
                    </span>
                    <div>
                      <span style={{ fontSize: 15.5, fontWeight: 600, color: 'var(--text)' }}>{pan.flavour}</span>
                      <span style={{ fontSize: 12.5, color: 'var(--muted)', marginLeft: 8 }}>({pan.sizeLabel} · {pan.layerThickness.toFixed(2)}″ layer)</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--gold)', fontFamily: 'monospace' }}>
                    {pan.grams.toLocaleString()} g
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Scaled Recipe Cards per Pan Combination */}
          <div style={{ fontSize: 15, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text)', margin: '18px 0 12px' }}>
            Scaled Kitchen Cards (Scaled Recipe Cards)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {prodData.recipePanCards.map((card, idx) => {
              const base = card.baseRecipe;
              const rawCardIngs = base?.ingredients || base?.ing || [];
              const baseYield = Number(base?.batch_yield_g) || Number(base?.yield_grams) || Number(base?.batchWeight) || (rawCardIngs.reduce((s, it) => s + (Number(it.qty !== undefined ? it.qty : it.quantity) || 0), 0)) || Number(base?.cal_grams) || 1221;
              const scalePerPan = card.gramsPerPan / baseYield;
              const scaleTotal = card.totalGrams / baseYield;

              const perPanIngredients = scaleRecipeIngredients(
                rawCardIngs.map(i => ({ name: i.inventoryItem?.name || i.name, quantity: Number(i.quantity !== undefined ? i.quantity : i.qty) || 0, unit: i.inventoryItem?.unit || i.unit || 'g' })),
                card.gramsPerPan,
                baseYield
              );

              return (
                <Card key={idx} className="sheet-card" style={{ padding: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '1px solid var(--border)', paddingBottom: 10, marginBottom: 12 }}>
                    <div>
                      <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{card.recipeName}</span>
                      <span style={{ fontSize: 13, color: 'var(--muted)', marginLeft: 8 }}>for {card.panCount} × {card.sizeLabel}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                      Scale factor: <strong>{scalePerPan.toFixed(3)}</strong> (per pan) · <strong>{scaleTotal.toFixed(3)}</strong> (all {card.panCount} pans)
                    </div>
                  </div>

                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--muted)', fontSize: 11.5 }}>
                        <th style={{ padding: '6px 4px' }}>Ingredient</th>
                        <th style={{ padding: '6px 4px', textAlign: 'right' }}>Into each pan</th>
                        <th style={{ padding: '6px 4px', textAlign: 'right' }}>Across all pans ({card.panCount})</th>
                      </tr>
                    </thead>
                    <tbody>
                      {perPanIngredients.map((ing, iIdx) => (
                        <tr key={iIdx} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '8px 4px', fontWeight: 500 }}>{ing.name}</td>
                          <td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 600, fontFamily: 'monospace' }}>
                            {ing.quantity.toLocaleString()} {ing.unit}
                          </td>
                          <td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 700, color: 'var(--gold)', fontFamily: 'monospace' }}>
                            {(ing.quantity * card.panCount).toLocaleString()} {ing.unit}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ fontWeight: 700, color: 'var(--text)' }}>
                        <td style={{ padding: '10px 4px' }}>Total Batter</td>
                        <td style={{ padding: '10px 4px', textAlign: 'right', fontFamily: 'monospace' }}>{card.gramsPerPan.toLocaleString()} g</td>
                        <td style={{ padding: '10px 4px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--gold)' }}>{card.totalGrams.toLocaleString()} g</td>
                      </tr>
                    </tfoot>
                  </table>
                </Card>
              );
            })}

            {/* Fillings & Coverings Scaled Cards */}
            {prodData.recipeCoverCards.map((card, idx) => (
              <Card key={`cov_${idx}`} className="sheet-card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '1px solid var(--border)', paddingBottom: 10, marginBottom: 12 }}>
                  <div>
                    <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{card.recipeName}</span>
                    <span style={{ fontSize: 13, color: 'var(--muted)', marginLeft: 8 }}>({card.job === 'filling' ? 'Between layers' : card.job === 'crumb' ? 'Crumb coat' : 'Outside finish'})</span>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--gold)' }}>
                    {Math.round(card.totalGrams).toLocaleString()} g
                  </div>
                </div>
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                  Applied at {card.thicknessMm} mm thickness with {Math.round(card.wastePct * 100)}% waste included.
                </div>
              </Card>
            ))}

            {/* Decorations */}
            {prodData.decorList.length > 0 && (
              <Card className="sheet-card" style={{ padding: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text)', marginBottom: 10 }}>
                  Decoration Materials
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                  {prodData.decorList.map((d, idx) => (
                    <div key={idx} style={{ padding: '8px 14px', borderRadius: 8, background: 'var(--panel)', border: '1px solid var(--border)', fontSize: 14 }}>
                      <strong>{d.name}</strong>: {d.grams} g
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────── */}
      {/* TAB 3: BUILD ORDER TIMELINE                                          */}
      {/* ──────────────────────────────────────────────────────────────────── */}
      {activeTab === 'timeline' && (
        <div>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', background: '#F6F1E6', border: '1px dashed var(--border)', borderRadius: 11, padding: '10px 13px', marginBottom: 14 }}>
            <b style={{ color: 'var(--text)' }}>The sequence, not the recipes.</b> Each recipe keeps its own method. This page only says what has to happen before what, based on which steps need resting, chilling or setting time.
          </div>

          <Card className="sheet-card" style={{ padding: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text)' }}>
                Build Order & Rest Timeline (Production Timeline & Resting Order)
              </span>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                Sequence derived from resting, chilling, and setting requirements
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {timeline.map((step, idx) => (
                <div key={step.id || idx} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: '12px 16px', borderRadius: 8, background: 'var(--panel)', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 32, height: 32, borderRadius: 999, background: 'var(--gold)', color: '#fff', fontWeight: 700, fontSize: 13.5 }}>
                    {idx + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{step.title}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>{step.time}</span>
                    </div>

                    {editingStepIndex === idx ? (
                      <div style={{ marginTop: 8 }}>
                        <textarea
                          rows={3}
                          value={editedStepText}
                          onChange={e => setEditedStepText(e.target.value)}
                          style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13.5 }}
                        />
                        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                          <Btn small onClick={() => handleUpdateStep(idx)}>Save Step</Btn>
                          <Btn small variant="ghost" onClick={() => setEditingStepIndex(null)}>Cancel</Btn>
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: 13.5, color: 'var(--text)', marginTop: 4, lineHeight: 1.5 }}>
                        {step.desc}
                        <button
                          type="button"
                          className="no-print"
                          onClick={() => { setEditingStepIndex(idx); setEditedStepText(step.desc); }}
                          style={{ background: 'transparent', border: 'none', color: 'var(--gold)', cursor: 'pointer', marginLeft: 8, fontSize: 12 }}
                        >
                          <Edit3 size={12} style={{ display: 'inline', marginRight: 2 }} /> Edit
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
              <b style={{ color: 'var(--gold)', fontSize: 10, letterSpacing: '.09em', textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>Generated</b>
              Read from the recipes on this order, their resting and chilling times, and the delivery date. Edit any step and the app keeps your version for this order.
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
