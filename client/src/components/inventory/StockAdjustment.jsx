/**
 * StockAdjustment.jsx
 * ----------------------------------------------------------------------------
 * BakeWealth Dedicated Stock Adjustment Screen
 * 
 * Allows bakers to record stock discrepancies with audit reason codes:
 *   - Spoilt or expired (Out only)
 *   - Damaged (Out only)
 *   - Used for testing or samples (Out only)
 *   - Theft or loss (Out only)
 *   - Counted wrong (Two-way, in or out)
 *   - Other (Out only, note required)
 * 
 * Submits multiple ingredient adjustments in a single atomic submission.
 * ----------------------------------------------------------------------------
 */

import React, { useState } from 'react';
import { Card, SHead, Btn, Inp, Sel } from '../common/ui.jsx';
import { fmt } from '../../lib/helpers.js';
import { AlertTriangle, CheckCircle, Plus, Trash2, Sliders, History, Sparkles } from 'lucide-react';

const REASON_OPTIONS = [
  { value: 'Spoilt or expired', label: 'Spoilt or expired (Out only)' },
  { value: 'Damaged', label: 'Damaged (Out only)' },
  { value: 'Used for testing or samples', label: 'Used for testing or samples (Out only)' },
  { value: 'Theft or loss', label: 'Theft or loss (Out only)' },
  { value: 'Counted wrong', label: 'Counted wrong (Two-way, in or out)' },
  { value: 'Other', label: 'Other (Out only, note required)' }
];

export function StockAdjustment({ inventory = [], setInventory, onAdjustmentSuccess }) {
  const [reason, setReason] = useState('Counted wrong');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');
  const [lines, setLines] = useState([
    { itemId: '', mode: 'target', targetQty: '', qtyDelta: '', note: '' }
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const isCountedWrong = reason === 'Counted wrong';
  const isOther = reason === 'Other';

  const totalValueLeaving = React.useMemo(() => {
    return lines.reduce((sum, line) => {
      const item = inventory.find(it => it.id === line.itemId);
      if (!item) return sum;
      const currentStock = item.stock || 0;
      let delta = 0;
      if (line.mode === 'target') {
        const target = parseFloat(line.targetQty);
        if (!isNaN(target)) delta = target - currentStock;
      } else {
        delta = parseFloat(line.qtyDelta) || 0;
        if (!isCountedWrong && delta > 0) delta = -Math.abs(delta);
      }
      if (delta < 0) {
        const unitCost = Number(item.cost) || 0;
        return sum + (Math.abs(delta) * unitCost);
      }
      return sum;
    }, 0);
  }, [lines, inventory, isCountedWrong]);

  const addLine = () => {
    setLines(prev => [...prev, { itemId: '', mode: isCountedWrong ? 'target' : 'delta', targetQty: '', qtyDelta: '', note: '' }]);
  };

  const removeLine = (idx) => {
    if (lines.length <= 1) return;
    setLines(prev => prev.filter((_, i) => i !== idx));
  };

  const updateLine = (idx, field, val) => {
    setLines(prev => prev.map((line, i) => {
      if (i !== idx) return line;
      const updated = { ...line, [field]: val };
      if (field === 'itemId') {
        const item = inventory.find(it => it.id === val);
        if (item && line.mode === 'target' && (!line.targetQty || line.targetQty === '')) {
          updated.targetQty = item.stock;
        }
      }
      return updated;
    }));
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setError('');
    setSuccess('');

    if (isOther && !note.trim()) {
      setError('A note explaining the adjustment is required when reason is "Other".');
      return;
    }

    const validLines = lines.filter(l => l.itemId);
    if (validLines.length === 0) {
      setError('Please select at least one ingredient to adjust.');
      return;
    }

    const payloadAdjustments = [];
    for (const line of validLines) {
      const item = inventory.find(it => it.id === line.itemId);
      if (!item) continue;

      let delta = 0;
      if (line.mode === 'target' || (line.targetQty !== '' && line.targetQty !== undefined)) {
        const target = parseFloat(line.targetQty);
        if (isNaN(target)) {
          setError(`Invalid physical count for ${item.name}.`);
          return;
        }
        delta = target - item.stock;
      } else {
        const d = parseFloat(line.qtyDelta);
        if (isNaN(d) || d === 0) {
          setError(`Please specify an adjustment quantity for ${item.name}.`);
          return;
        }
        delta = d;
      }

      // Check direction rule
      if (!isCountedWrong && delta > 0) {
        // Enforce out-only
        delta = -Math.abs(delta);
      }

      payloadAdjustments.push({
        itemId: item.id,
        inventoryItemId: item.id,
        targetQty: line.targetQty !== '' && line.targetQty !== undefined ? parseFloat(line.targetQty) : undefined,
        qtyDelta: delta,
        note: line.note || ''
      });
    }

    if (payloadAdjustments.length === 0) {
      setError('No valid stock changes were detected.');
      return;
    }

    setSaving(true);
    try {
      const token = sessionStorage.getItem('ll_token') || localStorage.getItem('ll_token');
      const res = await fetch('/api/inventory/adjustments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          reason,
          date,
          note: note.trim(),
          adjustments: payloadAdjustments
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to record stock adjustment');
      }

      // Update local inventory state
      if (typeof setInventory === 'function') {
        setInventory(prev => {
          if (Array.isArray(data.items)) {
            const map = new Map(data.items.map(it => [it.id, it]));
            return prev.map(it => map.has(it.id) ? { ...it, ...map.get(it.id) } : it);
          }
          const adjMap = new Map(payloadAdjustments.map(a => [a.itemId, a]));
          return prev.map(it => {
            const adj = adjMap.get(it.id);
            if (!adj) return it;
            const newStock = adj.targetQty !== undefined ? Number(adj.targetQty) : (it.stock + Number(adj.qtyDelta));
            return { ...it, stock: newStock };
          });
        });
      }

      setSuccess(`Successfully recorded adjustment for ${data.count || payloadAdjustments.length} ingredient(s).`);
      setLines([{ itemId: '', mode: isCountedWrong ? 'target' : 'delta', targetQty: '', qtyDelta: '', note: '' }]);
      setNote('');
      if (typeof onAdjustmentSuccess === 'function') onAdjustmentSuccess();
    } catch (err) {
      setError(err.message || 'An error occurred while saving adjustments.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', paddingBottom: 60 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <SHead
          title="Stock Adjustment"
          sub="Record physical counts, kitchen spoilage, damages, testing samples, or inventory discrepancies"
        />
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('layerledger:open-help', { detail: { topic: 'stockadjust' } }))}
          title="Learn how stock reason codes, two-way counts, and value loss work"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "rgba(200, 145, 42, 0.12)",
            border: "1.2px solid rgba(200, 145, 42, 0.45)",
            color: "var(--gold)",
            padding: "8px 14px",
            borderRadius: 8,
            fontSize: 12.5,
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 0.15s"
          }}
        >
          <Sparkles size={14} /> How Stock Adjustments Work
        </button>
      </div>

      {error && (
        <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 8, background: '#FDF2E9', border: '1px solid #E0AE3A', color: '#9A5B14', display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5 }}>
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 8, background: '#E1F5EE', border: '1px solid #5DCAA5', color: '#085041', display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5 }}>
          <CheckCircle size={18} />
          <span>{success}</span>
        </div>
      )}

      <Card style={{ padding: 22, marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 18 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
              Adjustment Reason *
            </label>
            <select
              value={reason}
              onChange={e => {
                const r = e.target.value;
                setReason(r);
                if (r !== 'Counted wrong') {
                  setLines(prev => prev.map(l => ({ ...l, mode: 'delta' })));
                }
              }}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', background: '#fff', fontSize: 14 }}
            >
              {REASON_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 4 }}>
              {isCountedWrong ? 'Physical miscount allows stock to adjust up or down.' : 'Loss reason reduces recorded inventory.'}
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
              Adjustment Date *
            </label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: '#fff', fontSize: 14 }}
            />
          </div>
        </div>

        {isOther && (
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#B03A2E', marginBottom: 6 }}>
              Explanation Note * (Required for 'Other')
            </label>
            <input
              type="text"
              placeholder="e.g. Storage pipe leak damaged bottom shelf packaging"
              value={note}
              onChange={e => setNote(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #B03A2E', background: '#FFFDFD', fontSize: 14 }}
            />
          </div>
        )}

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)' }}>
              Discrepancy Items ({lines.length})
            </span>
            <button
              type="button"
              onClick={addLine}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 6, border: '1px solid var(--gold)', background: 'transparent', color: 'var(--gold)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              <Plus size={13} /> Add another item
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {lines.map((line, idx) => {
              const item = inventory.find(it => it.id === line.itemId);
              const currentStock = item ? item.stock : 0;
              const unit = item ? item.unit : '';

              let deltaDisplay = 0;
              if (line.mode === 'target') {
                const target = parseFloat(line.targetQty);
                if (!isNaN(target)) deltaDisplay = target - currentStock;
              } else {
                deltaDisplay = parseFloat(line.qtyDelta) || 0;
                if (!isCountedWrong && deltaDisplay > 0) deltaDisplay = -Math.abs(deltaDisplay);
              }

              return (
                <div key={idx} style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', background: 'var(--panel)', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div style={{ flex: '1 1 220px' }}>
                    <select
                      value={line.itemId}
                      onChange={e => updateLine(idx, 'itemId', e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', background: '#fff', fontSize: 13.5 }}
                    >
                      <option value="">-- Select ingredient --</option>
                      {inventory.map(it => (
                        <option key={it.id} value={it.id}>{it.name} ({it.stock} {it.unit} on hand)</option>
                      ))}
                    </select>
                  </div>

                  {isCountedWrong ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: 11, color: 'var(--muted)' }}>Physical count ({unit})</span>
                        <input
                          type="number"
                          step="any"
                          placeholder={`Counted ${unit}`}
                          value={line.targetQty}
                          onChange={e => updateLine(idx, 'targetQty', e.target.value)}
                          style={{ width: 110, padding: '7px 8px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13.5 }}
                        />
                      </div>
                      <div style={{ fontSize: 12, minWidth: 90, color: deltaDisplay >= 0 ? '#1E7A4D' : '#B03A2E', fontWeight: 600 }}>
                        {deltaDisplay >= 0 ? `+${deltaDisplay}` : `${deltaDisplay}`} {unit}
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: 11, color: 'var(--muted)' }}>Quantity lost ({unit})</span>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          placeholder={`e.g. 2.5`}
                          value={line.qtyDelta ? Math.abs(parseFloat(line.qtyDelta)) : ''}
                          onChange={e => updateLine(idx, 'qtyDelta', e.target.value ? -Math.abs(parseFloat(e.target.value)) : '')}
                          style={{ width: 110, padding: '7px 8px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13.5 }}
                        />
                      </div>
                      <div style={{ fontSize: 12, minWidth: 90, color: '#B03A2E', fontWeight: 600 }}>
                        −{line.qtyDelta ? Math.abs(parseFloat(line.qtyDelta)) : 0} {unit}
                      </div>
                    </div>
                  )}

                  <div style={{ flex: '1 1 180px' }}>
                    <input
                      type="text"
                      placeholder="Optional note / batch details"
                      value={line.note}
                      onChange={e => updateLine(idx, 'note', e.target.value)}
                      style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)', background: '#fff', fontSize: 13 }}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => removeLine(idx)}
                    disabled={lines.length <= 1}
                    style={{ background: 'transparent', border: 'none', color: lines.length <= 1 ? '#ccc' : '#B03A2E', cursor: lines.length <= 1 ? 'not-allowed' : 'pointer', padding: 6 }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })}
          </div>

          {/* TOTAL VALUE LEAVING THE STORE (Artifact 6) */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderTop: '2px solid var(--charcoal, #3D2B1A)', marginTop: 18, paddingTop: 14, fontWeight: 600 }}>
            <span style={{ fontSize: 14.5, color: 'var(--text)' }}>Value leaving the store</span>
            <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 23, fontWeight: 700, color: '#B03A2E' }}>
              {fmt(totalValueLeaving)}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
            <Btn
              onClick={handleSubmit}
              loading={saving}
              loadingText="Saving adjustments..."
              style={{ minWidth: 180 }}
            >
              <Sliders size={14} style={{ marginRight: 6 }} /> Record Stock Adjustment
            </Btn>
          </div>
        </div>
      </Card>
    </div>
  );
}
