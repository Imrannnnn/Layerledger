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
 *   1. Shopping list:
 *      - Aggregated once across every recipe on the whole order (butter appears once).
 *      - Stock check on every line: Needed, In Stock, Short (with shortfall alert).
 *      - Sub-units where a baker thinks in them: eggs as pieces @ 50g, liquids in litres >= 400g.
 *      - Batch counts shown unrounded (e.g. 12.89 batches means scale by 12.89).
 *   2. Bake sheet:
 *      - Numbered weigh-out list: every pan listed individually with pan size, layer thickness,
 *        and the calibrated gram pour weight.
 *      - Scaled recipe cards for each pan-size-and-flavour group (actual flour, butter, eggs, milk).
 *      - Scaled recipe cards for made-by-the-piece decorations with breakage allowance.
 *      - "Mark as Baked" action triggering raw-materials-to-finished-goods move (Section 8).
 *   3. Build order:
 *      - Generated build timeline from recipes, resting times, and delivery date.
 *      - Made decoration (sugar roses, wafer paper) placed at the FRONT (Step 1) of the build order
 *        before the bake, covering drying time (2 days for sugar roses, 1 day for wafer paper).
 *      - Editable by the baker, and custom versions are preserved.
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
  resolveOrderDecorations,
  STANDARD_PANS
} from '../../lib/cakeGeometry.js';
import { bakeOrder } from '../../lib/accountingApi.js';
import { Printer, AlertTriangle, CheckCircle, Clock, ShoppingCart, Flame, ListOrdered, ChevronRight, Edit3, Sparkles, Check } from 'lucide-react';

export function ProductionSheet({ order, quote, inventory = [], recipes = [], onSaveOrder, onClose, onMarkBaked }) {
  const targetOrder = order || quote || {};
  const [activeTab, setActiveTab] = useState('shopping'); // 'shopping' | 'bake' | 'timeline'
  const [customTimeline, setCustomTimeline] = useState(() => {
    return targetOrder?.metadata?.productionSheet?.timeline || targetOrder?.productionSheet?.timeline || null;
  });
  const [editingStepIndex, setEditingStepIndex] = useState(null);
  const [editedStepText, setEditedStepText] = useState('');

  // Baked state tracking
  const [isBaked, setIsBaked] = useState(() => {
    return Boolean(targetOrder?.isBaked || targetOrder?.metadata?.isBaked || targetOrder?.status === 'ready' || targetOrder?.status === 'delivered');
  });
  const [bakedAt, setBakedAt] = useState(() => {
    return targetOrder?.bakedAt || targetOrder?.metadata?.bakedAt || null;
  });
  const [bakingNotice, setBakingNotice] = useState('');

  // ---------------------------------------------------------------------------
  // Geometric & Production Aggregation Engine
  // ---------------------------------------------------------------------------
  const prodData = useMemo(() => {
    const items = targetOrder?.items || [];
    const pansWeighOut = [];
    const recipePanCards = [];
    const recipeCoverCards = [];
    const madeDecorCards = [];
    const decorList = [];
    const ingredientAgg = new Map(); // key -> { id, name, unit, neededGrams, stockOnHand, recipes: Set }
    const recipeBatches = [];

    let panIndex = 1;

    // A. Parse and process all made decorations first
    const resolvedDecorations = resolveOrderDecorations(targetOrder, recipes, inventory);
    resolvedDecorations.forEach(dec => {
      if (dec.kind === 'made_piece') {
        const rec = dec.recipe;
        const rawIngs = rec.ingredients || rec.ing || [];
        const baseYieldPieces = dec.baseYieldPieces;
        const batchScale = dec.batchScale;

        // Unrounded batch entry
        recipeBatches.push({
          recipeId: rec.id,
          name: `${rec.name} (Made Decoration)`,
          neededGrams: 0,
          baseYield: `${baseYieldPieces} pcs`,
          pieces: dec.piecesToMake,
          batches: batchScale
        });

        // Scale ingredients for this made decoration
        const scaledIngs = rawIngs.map(ing => {
          const invId = ing.inventoryItemId || ing.iid || ing.id;
          const invItem = inventory.find(i => i.id === invId || i.name?.toLowerCase() === (ing.name || '').toLowerCase());
          const unit = ing.unit || invItem?.unit || 'g';
          const perBatchQty = Number(ing.quantity !== undefined ? ing.quantity : ing.qty) || 0;
          const scaledQty = perBatchQty * batchScale;
          const perPieceQty = perBatchQty / Math.max(1, baseYieldPieces);

          let gramsToAdd = scaledQty;
          if (unit.toLowerCase() === 'kg' || unit.toLowerCase() === 'l') {
            gramsToAdd = scaledQty * 1000;
          }

          const key = invId || ing.name?.toLowerCase();
          if (ingredientAgg.has(key)) {
            const existing = ingredientAgg.get(key);
            existing.neededGrams += gramsToAdd;
            existing.recipes.add(`${rec.name} (Decoration)`);
          } else {
            let stockOnHand = 0;
            if (invItem) {
              const u = (invItem.unit || '').toLowerCase();
              stockOnHand = (u === 'kg' || u === 'l') ? (Number(invItem.stock) || 0) * 1000 : (Number(invItem.stock) || 0);
            }
            ingredientAgg.set(key, {
              id: invId,
              name: invItem?.name || ing.name || 'Ingredient',
              unit: (unit === 'kg' || unit === 'l') ? 'g' : unit,
              neededGrams: gramsToAdd,
              stockOnHand,
              recipes: new Set([`${rec.name} (Decoration)`])
            });
          }

          return {
            name: invItem?.name || ing.name,
            unit,
            quantity: Math.round(scaledQty * 10) / 10,
            perPieceStr: `${perPieceQty.toFixed(2)} ${unit}`
          };
        });

        madeDecorCards.push({
          recipeId: rec.id,
          name: rec.name,
          piecesNeeded: dec.qtyNeeded,
          breakagePct: dec.breakagePct,
          piecesToMake: dec.piecesToMake,
          baseYieldPieces,
          batchScale,
          ingredients: scaledIngs,
          baseRecipe: rec
        });
      } else {
        // Weighed or bought piece
        const invItem = dec.invItem || inventory.find(i => i.name?.toLowerCase() === dec.name.toLowerCase());
        const unit = dec.unit || invItem?.unit || 'pcs';
        const key = invItem?.id || dec.name.toLowerCase();
        let neededGrams = dec.qtyNeeded;
        if (unit === 'kg' || unit === 'l') {
          neededGrams = dec.qtyNeeded * 1000;
        }

        if (ingredientAgg.has(key)) {
          const existing = ingredientAgg.get(key);
          existing.neededGrams += neededGrams;
          existing.recipes.add('Decoration Extra');
        } else {
          let stockOnHand = 0;
          if (invItem) {
            const u = (invItem.unit || '').toLowerCase();
            stockOnHand = (u === 'kg' || u === 'l') ? (Number(invItem.stock) || 0) * 1000 : (Number(invItem.stock) || 0);
          }
          ingredientAgg.set(key, {
            id: invItem?.id,
            name: dec.name,
            unit: (unit === 'kg' || unit === 'l') ? 'g' : unit,
            neededGrams,
            stockOnHand,
            recipes: new Set(['Decoration Extra'])
          });
        }

        decorList.push({
          name: dec.name,
          qty: dec.qtyNeeded,
          unit,
          kind: dec.kind
        });
      }
    });

    // B. Cake Tiers
    items.forEach((item, itemIdx) => {
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

          // Fillings
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

      // C. Portions (Slab or Counted)
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
        } else if (p.route === 'count') {
          // Counted portions: Doughnuts, chin chin, bread, cake pops, mousse cups (no geometry, unrounded batches)
          const rec = recipes.find(r => r.id === p.countedRecipeId || r.name?.toLowerCase() === (p.countedRecipeId || '').toLowerCase());
          if (rec) {
            const servings = Number(p.countedServings || p.servings) || 40;
            const batchSize = Number(rec.batchSize || rec.perBatch || rec.per_batch) || 12;
            const breakage = (Number(rec.breakagePct ?? rec.breakage_pct) || 0) / 100;
            const batches = (servings / Math.max(1, batchSize)) * (1 + breakage);

            const existingBatch = recipeBatches.find(b => b.recipeId === rec.id);
            if (existingBatch) {
              existingBatch.batches += batches;
              existingBatch.pieces = (existingBatch.pieces || 0) + servings;
            } else {
              recipeBatches.push({
                recipeId: rec.id,
                name: rec.name,
                neededGrams: 0,
                baseYield: `${batchSize} pcs`,
                pieces: servings,
                batches: batches // Never rounded up! E.g. 2.4
              });
            }

            const rawIngs = rec.ingredients || rec.ing || [];
            rawIngs.forEach(ing => {
              const iid = ing.iid || ing.id || ing.inventoryId;
              const invMatch = inventory.find(i => i.id === iid || i.name?.toLowerCase() === (ing.name || '').toLowerCase());
              const name = invMatch?.name || ing.name || 'Ingredient';
              const unit = (invMatch?.unit || ing.unit || 'g').toLowerCase();
              const perBatchQty = Number(ing.qty !== undefined ? ing.qty : ing.quantity) || 0;
              let gramsToAdd = 0;
              if (unit === 'kg' || unit === 'l') {
                gramsToAdd = perBatchQty * 1000 * batches;
              } else {
                gramsToAdd = perBatchQty * batches;
              }
              const key = iid || name.toLowerCase();
              if (ingredientAgg.has(key)) {
                const existing = ingredientAgg.get(key);
                existing.neededGrams += gramsToAdd;
                existing.recipes.add(rec.name);
              } else {
                let stockOnHand = 0;
                if (invMatch) {
                  const u = (invMatch.unit || '').toLowerCase();
                  stockOnHand = (u === 'kg' || u === 'l') ? (Number(invMatch.stock) || 0) * 1000 : (Number(invMatch.stock) || 0);
                }
                ingredientAgg.set(key, {
                  id: iid,
                  name,
                  unit: (unit === 'kg' || unit === 'l') ? 'g' : unit,
                  neededGrams: gramsToAdd,
                  stockOnHand,
                  recipes: new Set([rec.name])
                });
              }
            });
          }
        }
      }
    });

    // D. Aggregate Ingredients across all scaled cake & covering cards
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
          let stockOnHand = 0;
          if (invItem) {
            const u = (invItem.unit || '').toLowerCase();
            stockOnHand = (u === 'kg' || u === 'l') ? (Number(invItem.stock) || 0) * 1000 : (Number(invItem.stock) || 0);
          }
          ingredientAgg.set(key, {
            id: ing.id,
            name: ing.name,
            unit: (ing.unit === 'kg' || ing.unit === 'l') ? 'g' : ing.unit,
            neededGrams: ing.quantity,
            stockOnHand,
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
      madeDecorCards,
      decorList,
      recipeBatches,
      shoppingList,
      shortfalls: shoppingList.filter(s => s.isShort)
    };
  }, [targetOrder, recipes, inventory]);

  // Default timeline derived from resting & setting constraints, with Made Decorations at the FRONT
  const defaultTimeline = useMemo(() => {
    const list = [];

    // Step 1: Made decoration prep at the FRONT of the build order (drying time requirement)
    if (prodData.madeDecorCards && prodData.madeDecorCards.length > 0) {
      prodData.madeDecorCards.forEach((d, i) => {
        const isWafer = d.name.toLowerCase().includes('wafer');
        list.push({
          id: `step_decor_${i}`,
          time: isWafer ? '1 day ahead (Before bake)' : '2 days ahead (Before bake)',
          title: `Make & dry ${d.name}`,
          desc: `${d.name} require ${isWafer ? '1 day' : '2 days'} drying time to set. Make ${d.piecesToMake} pieces (${d.piecesNeeded} needed + ${d.piecesToMake - d.piecesNeeded} breakage allowance) using gum paste, wire and colour so they are completely dry before assembling the cake.`,
          auto: true,
          isMadeDecor: true
        });
      });
    }

    // Step 2: Fondant prep (if fondant outside finish is used)
    const hasFondant = (targetOrder.items || []).some(it => {
      const fin = typeof it.outsideFinish === 'object' ? it.outsideFinish?.type : (it.finish || '');
      return String(fin).toLowerCase().includes('fondant');
    });
    if (hasFondant) {
      list.push({
        id: 'step_fondant',
        time: '1–2 days ahead',
        title: 'Prepare & rest fondant',
        desc: 'Knead and condition fondant covering so it releases air bubbles before rolling out.',
        auto: true
      });
    }

    // Step 3: Sponge & slab bake
    const totalPans = prodData.pansWeighOut.length;
    list.push({
      id: 'step_bake',
      time: '1 day ahead (Morning)',
      title: 'Bake all sponge layers & slabs',
      desc: `Weigh out batters for all ${totalPans} pans according to the numbered pan weigh-out sheet. Bake, cool completely, and level off domes.`,
      auto: true
    });

    // Step 4: Fill & crumb coat
    list.push({
      id: 'step_fill',
      time: '1 day ahead (Afternoon)',
      title: 'Fill & crumb coat · Chill',
      desc: 'Stack layers with calibrated fillings. Apply crumb coat to seal loose crumbs, then chill for at least 4 hours.',
      auto: true
    });

    // Step 5: Outside finish & mount decorations
    list.push({
      id: 'step_finish',
      time: 'Delivery day (Morning)',
      title: 'Outside finish & mount decorations',
      desc: 'Apply outside finish coat. Mount the dried sugar roses, edible prints, toppers, and decoration accents.',
      auto: true
    });

    // Step 6: Box & dispatch
    list.push({
      id: 'step_box',
      time: 'Delivery day (Final)',
      title: 'Box, chill & dispatch',
      desc: 'Secure tiers with centre dowels, pack securely into delivery box, and mark order ready for collection/delivery.',
      auto: true
    });

    return list;
  }, [prodData.madeDecorCards, prodData.pansWeighOut.length, targetOrder.items]);

  const timeline = customTimeline || defaultTimeline;

  const handleUpdateStep = (idx) => {
    const updated = [...timeline];
    updated[idx] = { ...updated[idx], desc: editedStepText };
    setCustomTimeline(updated);
    setEditingStepIndex(null);
    if (typeof onSaveOrder === 'function') {
      onSaveOrder({
        ...targetOrder,
        metadata: {
          ...targetOrder?.metadata,
          productionSheet: {
            ...targetOrder?.metadata?.productionSheet,
            timeline: updated
          }
        }
      });
    }
  };

  const handleMarkAsBaked = async () => {
    try {
      const now = new Date().toISOString();
      setIsBaked(true);
      setBakedAt(now);
      setBakingNotice('Order marked as baked! Raw materials moved to finished goods inventory (Section 8).');
      setTimeout(() => setBakingNotice(''), 5000);

      // 1. Post GL order bake (Dr 1160 Finished Goods / Cr 1140 Raw Materials)
      if (targetOrder?.id) {
        bakeOrder(targetOrder.id, {
          actualIngredientCost: targetOrder.cost || targetOrder.totalCost,
          usages: targetOrder.usages
        }).catch(err => {
          console.warn("GL bakeOrder notice:", err);
        });
      }

      // 2. Prepare updated order object
      const updatedOrder = {
        ...targetOrder,
        isBaked: true,
        bakedAt: now,
        status: (targetOrder.status === 'pending' || targetOrder.status === 'confirmed') ? 'ready' : (targetOrder.status || 'ready'),
        metadata: {
          ...targetOrder.metadata,
          isBaked: true,
          bakedAt: now
        }
      };

      // 3. Persist updated order locally
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          const prods = JSON.parse(localStorage.getItem('ll_prods') || '[]');
          const updProds = prods.map(p => (p.id === targetOrder.id || p.quoteId === targetOrder.id) ? { ...p, isBaked: true, bakedAt: now, status: 'ready' } : p);
          localStorage.setItem('ll_prods', JSON.stringify(updProds));

          const quotes = JSON.parse(localStorage.getItem('ll_quotes') || '[]');
          const updQuotes = quotes.map(q => q.id === targetOrder.id ? { ...q, isBaked: true, bakedAt: now } : q);
          localStorage.setItem('ll_quotes', JSON.stringify(updQuotes));
        } catch (e) {
          console.warn("Storage update notice:", e);
        }
      }

      // 4. Callback to parent
      if (typeof onSaveOrder === 'function') {
        onSaveOrder(updatedOrder);
      }
      if (typeof onMarkBaked === 'function') {
        onMarkBaked(updatedOrder);
      }
    } catch (e) {
      console.error("Failed to mark order as baked:", e);
    }
  };

  const printSheet = () => {
    window.print();
  };

  const isConfirmed = targetOrder.status === 'confirmed' || !!targetOrder.confirmedAt || targetOrder.isProd;

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
          font-size: 14px;
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
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--gold)' }}>
              Kitchen Production Sheet
            </span>
            <span style={{ fontSize: 11, background: isConfirmed ? '#E5F4EC' : '#FFF9EE', color: isConfirmed ? '#2D7A50' : 'var(--gold)', padding: '2px 8px', borderRadius: 6, fontWeight: 600 }}>
              {isConfirmed ? 'Confirmed Order' : 'Generated on Confirmation'}
            </span>
          </div>
          <h1 style={{ fontFamily: 'var(--display)', fontSize: 24, margin: '4px 0', color: 'var(--text)' }}>
            {targetOrder?.clientName || 'Order'} · {targetOrder?.deliveryDate || (targetOrder?.dueDate ? new Date(targetOrder.dueDate).toLocaleDateString('en-NG', { weekday: 'short', month: 'short', day: 'numeric' }) : 'Confirmed Order')}
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Section 8 "Mark as Baked" Action */}
          {!isBaked ? (
            <Btn
              variant="success"
              onClick={handleMarkAsBaked}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
              title="Click when baking is finished to move raw materials to finished goods inventory (Section 8)"
            >
              <Flame size={15} /> Mark as Baked
            </Btn>
          ) : (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#E8F5EE', color: '#2D7A50', border: '1px solid #C2E0CF', padding: '6px 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 700 }}>
              <CheckCircle size={15} /> Baked {bakedAt ? `(${new Date(bakedAt).toLocaleDateString('en-NG', { month: 'short', day: 'numeric' })})` : '✓'}
            </div>
          )}

          <Btn small variant="outline" onClick={printSheet} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Printer size={14} /> Print Sheet
          </Btn>
          {onClose && (
            <Btn small variant="ghost" onClick={onClose}>Close</Btn>
          )}
        </div>
      </div>

      {/* Confirmation & Inventory Promise Banner */}
      <div style={{ fontSize: 12, color: 'var(--muted)', background: '#F8F6F0', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Check size={14} style={{ color: '#2D7A50', flexShrink: 0 }} />
        <span>
          <strong>Generated when the order is confirmed.</strong> A confirmed order is a promise. Nothing in stock or in the accounts moves at confirmation; inventory moves to Finished Goods when you click <em>Mark as Baked</em>.
        </span>
      </div>

      {bakingNotice && (
        <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 8, background: '#E8F5EE', border: '1.5px solid #2D7A50', color: '#2D7A50', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle size={16} />
          <span>{bakingNotice}</span>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="no-print" style={{ display: 'flex', gap: 8, margin: '14px 0 18px' }}>
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
        <div style={{ marginBottom: 18, padding: '14px 18px', borderRadius: 10, background: '#FDF2E9', border: '1.5px solid #E0AE3A', color: '#9A5B14' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 14.5 }}>
            <AlertTriangle size={18} />
            <span>Shortfall Alert: {prodData.shortfalls.length} ingredient(s) need restocking before production begins!</span>
          </div>
          <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.5 }}>
            {prodData.shortfalls.map((s, idx) => (
              <div key={idx}>
                • <strong>{s.name}</strong>: Needed {s.needed.toLocaleString()} {s.unit}, in stock {s.stockOnHand.toLocaleString()} {s.unit} → <strong style={{ color: '#B03A2E' }}>Short by {s.shortfall.toLocaleString()} {s.unit}</strong>
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
          <div style={{ fontSize: 12.5, color: 'var(--muted)', background: '#F6F1E6', border: '1px dashed var(--border)', borderRadius: 10, padding: '10px 13px', marginBottom: 14 }}>
            <b style={{ color: 'var(--text)' }}>Every ingredient on the whole order, added up once.</b> Butter appears on one line even when it runs through six recipes. That is what a baker carries to the market.
          </div>

          <Card className="sheet-card" style={{ padding: 20, marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text)' }}>
                Aggregated Shopping List &amp; Stock Check
              </span>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                Needed · In Stock · Short
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {prodData.shoppingList.map((item, idx) => {
                const isEggs = item.name.toLowerCase().includes('egg');
                const isLiquid = ['milk', 'water', 'cream', 'oil', 'juice'].some(w => item.name.toLowerCase().includes(w));
                const eggsCount = isEggs ? Math.round(item.needed / 50) : null;
                const litres = (isLiquid && item.needed >= 400) ? (item.needed / 1000).toFixed(2) : null;

                return (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 14px',
                      borderRadius: 8,
                      background: item.isShort ? '#FFF9F5' : 'var(--panel)',
                      border: item.isShort ? '1.5px solid #E0AE3A' : '1px solid var(--border)'
                    }}
                  >
                    <div style={{ flex: 1, paddingRight: 12 }}>
                      <div style={{ fontSize: 15.5, fontWeight: 600, color: 'var(--text)' }}>
                        {item.name}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                        Sources: {item.recipeListStr}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 16, alignItems: 'center', textAlign: 'right' }}>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--muted)' }}>Needed</div>
                        <div style={{ fontSize: 15.5, fontWeight: 700, color: 'var(--text)' }}>
                          {item.needed.toLocaleString()} {item.unit || 'g'}
                        </div>
                        {eggsCount && (
                          <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--gold)' }}>
                            {eggsCount} pcs @ 50g
                          </div>
                        )}
                        {litres && (
                          <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--gold)' }}>
                            {litres} L
                          </div>
                        )}
                      </div>

                      <div style={{ minWidth: 85 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--muted)' }}>In Stock</div>
                        <div style={{ fontSize: 13.5, fontWeight: 500, color: item.stockOnHand > 0 ? 'var(--text)' : '#B03A2E' }}>
                          {item.stockOnHand > 0 ? `${item.stockOnHand.toLocaleString()} ${item.unit}` : 'Out of stock'}
                        </div>
                      </div>

                      <div style={{ minWidth: 90 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--muted)' }}>Short</div>
                        {item.isShort ? (
                          <span style={{ fontSize: 13.5, fontWeight: 700, color: '#B03A2E' }}>
                            Short: {item.shortfall.toLocaleString()} {item.unit}
                          </span>
                        ) : (
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#2D7A50' }}>
                            Sufficient ✓
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Batches Table (Shown Unrounded) */}
          <Card className="sheet-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text)', marginBottom: 6 }}>
              Batches to Mix (Batch Counts Shown Unrounded)
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '0 0 12px' }}>
              Batch counts are shown unrounded (e.g. 12.89 batches means scale ingredients by 12.89). Batches are never rounded up, avoiding excess stock.
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
                    <td style={{ padding: '10px 6px' }}>{b.neededGrams > 0 ? `${Math.round(b.neededGrams).toLocaleString()} g` : `${b.pieces} pcs`}</td>
                    <td style={{ padding: '10px 6px' }}>{typeof b.baseYield === 'number' ? `${Math.round(b.baseYield).toLocaleString()} g` : b.baseYield}</td>
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
          <div style={{ fontSize: 12.5, color: 'var(--muted)', background: '#F6F1E6', border: '1px dashed var(--border)', borderRadius: 10, padding: '10px 13px', marginBottom: 14 }}>
            <b style={{ color: 'var(--text)' }}>Every pan listed individually with calibrated pour weights.</b> Pans of the same size carry different weights because each flavour pours to its own calibration. Scaled recipe cards show actual flour, butter, eggs, and milk.
          </div>

          {/* Numbered Pan Weigh-Out List */}
          <Card className="sheet-card" style={{ padding: 20, marginBottom: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text)' }}>
                Weigh-Out List: Every Pan Listed Individually (Numbered Pan Weigh-Outs)
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                {prodData.pansWeighOut.length} pans to bake
              </div>
            </div>
            <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 12px' }}>
              Pan size, layer thickness, and the calibrated gram weight for that pan.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {prodData.pansWeighOut.map((pan) => (
                <div key={pan.num} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: 8, background: 'var(--panel)', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '4px 10px', borderRadius: 999, background: 'var(--text)', color: '#fff', fontSize: 13, fontWeight: 700 }}>
                      Pan {pan.num}
                    </span>
                    <div>
                      <span style={{ fontSize: 15.5, fontWeight: 600, color: 'var(--text)' }}>{pan.flavour}</span>
                      <span style={{ fontSize: 12.5, color: 'var(--muted)', marginLeft: 8 }}>
                        ({pan.sizeLabel} · {pan.layerThickness.toFixed(2)}″ layer thickness)
                      </span>
                    </div>
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--gold)', fontFamily: 'monospace' }}>
                    {pan.grams.toLocaleString()} g
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Scaled Kitchen Cards per Pan Group */}
          <div style={{ fontSize: 15, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text)', margin: '18px 0 12px' }}>
            Scaled Kitchen Cards (Scaled Recipe Cards by Pan &amp; Flavour Group)
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
                      <span style={{ fontSize: 13, color: 'var(--muted)', marginLeft: 8 }}>for {card.panCount} × {card.sizeLabel} ({card.layerThickness.toFixed(2)}″ thickness)</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                      Scale: <strong>{scalePerPan.toFixed(3)}</strong> (per pan) · <strong>{scaleTotal.toFixed(3)}</strong> (all {card.panCount} pans)
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

            {/* Made Decoration Scaled Recipe Cards (Sugar Roses, Wafer Paper, etc.) */}
            {prodData.madeDecorCards && prodData.madeDecorCards.length > 0 && (
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text)', margin: '18px 0 12px' }}>
                  Made Decoration Recipe Cards (Scaled with Breakage Allowance)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {prodData.madeDecorCards.map((card, idx) => (
                    <Card key={`decor_${idx}`} className="sheet-card" style={{ padding: 20 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '1px solid var(--border)', paddingBottom: 10, marginBottom: 12 }}>
                        <div>
                          <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{card.name}</span>
                          <span style={{ fontSize: 13, color: 'var(--muted)', marginLeft: 8 }}>
                            ({card.piecesNeeded} pcs needed + {card.breakagePct}% breakage = <strong>{card.piecesToMake} pcs to make</strong>)
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                          Scale factor: <strong>{card.batchScale.toFixed(3)}</strong> batches ({card.piecesToMake} ÷ {card.baseYieldPieces} base yield)
                        </div>
                      </div>

                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--muted)', fontSize: 11.5 }}>
                            <th style={{ padding: '6px 4px' }}>Ingredient</th>
                            <th style={{ padding: '6px 4px', textAlign: 'right' }}>Per piece</th>
                            <th style={{ padding: '6px 4px', textAlign: 'right' }}>Across all {card.piecesToMake} pieces</th>
                          </tr>
                        </thead>
                        <tbody>
                          {card.ingredients.map((ing, iIdx) => (
                            <tr key={iIdx} style={{ borderBottom: '1px solid var(--border)' }}>
                              <td style={{ padding: '8px 4px', fontWeight: 500 }}>{ing.name}</td>
                              <td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 600, fontFamily: 'monospace' }}>
                                {ing.perPieceStr}
                              </td>
                              <td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 700, color: 'var(--gold)', fontFamily: 'monospace' }}>
                                {ing.quantity.toLocaleString()} {ing.unit}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Weighed & Bought Decorations Summary */}
            {prodData.decorList.length > 0 && (
              <Card className="sheet-card" style={{ padding: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text)', marginBottom: 10 }}>
                  Weighed &amp; Bought Decoration Materials
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                  {prodData.decorList.map((d, idx) => (
                    <div key={idx} style={{ padding: '8px 14px', borderRadius: 8, background: 'var(--panel)', border: '1px solid var(--border)', fontSize: 13.5 }}>
                      <strong>{d.name}</strong>: {d.qty} {d.unit} ({d.kind === 'weighed' ? 'Weighed extra' : 'Bought piece'})
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Section 8 "Mark as Baked" Action Card */}
            <div style={{ marginTop: 20, padding: '16px 20px', borderRadius: 10, background: isBaked ? '#E8F5EE' : '#FEF9EE', border: `1.5px solid ${isBaked ? '#C2E0CF' : 'var(--gold)'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: isBaked ? '#2D7A50' : 'var(--text)' }}>
                  {isBaked ? 'Order Marked as Baked' : 'Finished Baking This Order?'}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>
                  {isBaked
                    ? `Raw materials moved to finished goods inventory on ${new Date(bakedAt).toLocaleString('en-NG')}.`
                    : "Click 'Mark as Baked' to trigger the Section 8 raw-materials-to-finished-goods inventory movement."}
                </div>
              </div>
              {!isBaked ? (
                <Btn variant="success" onClick={handleMarkAsBaked} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
                  <Flame size={15} /> Mark as Baked
                </Btn>
              ) : (
                <span style={{ fontSize: 13, fontWeight: 700, color: '#2D7A50', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <CheckCircle size={15} /> In Finished Goods
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────── */}
      {/* TAB 3: BUILD ORDER TIMELINE                                          */}
      {/* ──────────────────────────────────────────────────────────────────── */}
      {activeTab === 'timeline' && (
        <div>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', background: '#F6F1E6', border: '1px dashed var(--border)', borderRadius: 10, padding: '10px 13px', marginBottom: 14 }}>
            <b style={{ color: 'var(--text)' }}>The sequence, not the recipes.</b> Made decorations (sugar roses, flowers) are scheduled at the FRONT of the build order so flowers have the required 2 days to dry before baking and assembly.
          </div>

          <Card className="sheet-card" style={{ padding: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text)' }}>
                Build Order &amp; Rest Timeline
              </span>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                Sequence derived from resting, chilling, and setting requirements
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {timeline.map((step, idx) => (
                <div
                  key={step.id || idx}
                  style={{
                    display: 'flex',
                    gap: 14,
                    alignItems: 'flex-start',
                    padding: '12px 16px',
                    borderRadius: 8,
                    background: step.isMadeDecor ? '#FFF9EE' : 'var(--panel)',
                    border: step.isMadeDecor ? '1.5px solid var(--gold)' : '1px solid var(--border)'
                  }}
                >
                  <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 32, height: 32, borderRadius: 999, background: 'var(--gold)', color: '#fff', fontWeight: 700, fontSize: 13.5 }}>
                    {idx + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{step.title}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: step.isMadeDecor ? 'var(--gold)' : 'var(--muted)' }}>
                        {step.time}
                      </span>
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
