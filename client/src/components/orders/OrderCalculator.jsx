/**
 * OrderCalculator.jsx
 * ----------------------------------------------------------------------------
 * Multi-Item Order Calculator — builds a client quote with multiple cakes/pastries.
 * Each item has its own tiers, recipes, fillings, coverings, decorations,
 * topper, design photo, packaging, delivery details, and item notes.
 * Quotes share client details, general order note, and a unified invoice total.
 * ----------------------------------------------------------------------------
 */
import React, { useState, useEffect, useMemo, useRef } from "react"
import { Btn, iSt, Inp, Sel, Card, SHead, SearchableSelect } from "../common/ui.jsx"
import { fmt, uid, today, MONTHS, SPECIAL_DATE_TYPES, parseSpecialDate, formatSpecialDate, calculateCakeGeometry, calculateFillingGrams, calculateCoveringGrams, getRecipeCoverageValues } from "../../lib/helpers.js"
import {
  planArea,
  perimeter,
  gapArea,
  surfaceArea,
  calculateDensity,
  gramsPerPan,
  coveringMass,
  reverseThicknessMm,
  perPan,
  calculatePortionsGeometry,
  calculateCostStack,
  deriveOverheadRates,
  STANDARD_PANS,
  CM2
} from "../../lib/cakeGeometry.js"
import { loadCompany, loadLocal, saveLocal, loadQuotes, saveQuotes, loadClients, upsertClient, clearTempCalculatorState, checkPlanLimit, notifyPlanLimitReached } from "../../lib/data.js"
import { DEFAULT_MULTS, DECORATION_ITEMS, PRICING_SIZES } from "../../constants.js"
import { Camera, Check, MessageCircle, ClipboardList, Calculator, Cake, Heart, CalendarHeart, Cookie, X, ChevronDown, ChevronUp, Plus, Trash2, Calendar, Clock, AlertTriangle, Crop, RotateCcw, FileText } from "lucide-react"
import ImageCropperModal from "./ImageCropperModal.jsx"

const compressImage = (file, maxWidth = 640, quality = 0.70) => {
  return new Promise((resolve) => {
    if (!file || !file.type?.startsWith("image/")) {
      resolve(null)
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        let width = img.width
        let height = img.height
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width)
          width = maxWidth
        }
        const canvas = document.createElement("canvas")
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext("2d")
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL("image/jpeg", quality))
      }
      img.onerror = () => resolve(e.target.result)
      img.src = e.target.result
    }
    reader.onerror = () => resolve(null)
    reader.readAsDataURL(file)
  })
}

function ItemPhotoGallery({ item, updateItem, onPreview }) {
  const itemPhotos = Array.isArray(item.photos)
    ? item.photos
    : (item.photo ? [item.photo] : [])

  const [uploading, setUploading] = useState(false)
  const [cropQueue, setCropQueue] = useState([]) // array of { file, dataUrl, isEditIndex }
  const [queueIndex, setQueueIndex] = useState(0)

  const handleFileChange = async (e) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    setUploading(true)
    try {
      const fileList = Array.from(files)
      const readPromises = fileList.map(file => {
        return new Promise((resolve) => {
          if (!file.type?.startsWith("image/")) {
            resolve(null)
            return
          }
          const reader = new FileReader()
          reader.onload = ev => resolve({ file, dataUrl: ev.target.result })
          reader.onerror = () => resolve(null)
          reader.readAsDataURL(file)
        })
      })
      const itemsToCrop = (await Promise.all(readPromises)).filter(Boolean)
      if (itemsToCrop.length > 0) {
        setCropQueue(itemsToCrop)
        setQueueIndex(0)
      }
    } catch (err) {
      console.warn("Photo read error:", err)
    } finally {
      setUploading(false)
      e.target.value = ""
    }
  }

  // Edit/re-crop an existing photo in the gallery
  const handleEditCrop = (imgUrl, pIndex) => {
    setCropQueue([{ file: null, dataUrl: imgUrl, isEditIndex: pIndex }])
    setQueueIndex(0)
  }

  // Save the cropped output
  const handleCropSave = (croppedDataUrl) => {
    const active = cropQueue[queueIndex]
    if (active && active.isEditIndex !== undefined) {
      // Replace existing photo
      updateItem(item.id, cur => {
        const existing = Array.isArray(cur.photos) ? [...cur.photos] : (cur.photo ? [cur.photo] : [])
        existing[active.isEditIndex] = croppedDataUrl
        return {
          ...cur,
          photos: existing,
          photo: existing[0] || null
        }
      })
      setCropQueue([])
      setQueueIndex(0)
      return
    }

    // Add new cropped photo to item
    updateItem(item.id, cur => {
      const existing = Array.isArray(cur.photos) ? cur.photos : (cur.photo ? [cur.photo] : [])
      const merged = [...existing, croppedDataUrl]
      return {
        ...cur,
        photos: merged,
        photo: merged[0] || null
      }
    })

    if (queueIndex + 1 < cropQueue.length) {
      setQueueIndex(queueIndex + 1)
    } else {
      setCropQueue([])
      setQueueIndex(0)
    }
  }

  // Skip cropping this photo (use original compressed)
  const handleCropSkip = async () => {
    const active = cropQueue[queueIndex]
    if (active && active.isEditIndex !== undefined) {
      setCropQueue([])
      setQueueIndex(0)
      return
    }

    const compressed = (active?.file ? await compressImage(active.file) : active?.dataUrl) || active?.dataUrl
    if (compressed) {
      updateItem(item.id, cur => {
        const existing = Array.isArray(cur.photos) ? cur.photos : (cur.photo ? [cur.photo] : [])
        const merged = [...existing, compressed]
        return {
          ...cur,
          photos: merged,
          photo: merged[0] || null
        }
      })
    }

    if (queueIndex + 1 < cropQueue.length) {
      setQueueIndex(queueIndex + 1)
    } else {
      setCropQueue([])
      setQueueIndex(0)
    }
  }

  // Skip all remaining photos in the queue
  const handleCropSkipAll = async () => {
    const remaining = cropQueue.slice(queueIndex)
    const compressedList = await Promise.all(
      remaining.map(async item => {
        if (item.file) return await compressImage(item.file)
        return item.dataUrl
      })
    )
    const valid = compressedList.filter(Boolean)
    if (valid.length > 0) {
      updateItem(item.id, cur => {
        const existing = Array.isArray(cur.photos) ? cur.photos : (cur.photo ? [cur.photo] : [])
        const merged = [...existing, ...valid]
        return {
          ...cur,
          photos: merged,
          photo: merged[0] || null
        }
      })
    }
    setCropQueue([])
    setQueueIndex(0)
  }

  const handleCancelCrop = () => {
    setCropQueue([])
    setQueueIndex(0)
  }

  const handleRemove = (idxToRemove) => {
    updateItem(item.id, cur => {
      const existing = Array.isArray(cur.photos) ? cur.photos : (cur.photo ? [cur.photo] : [])
      const nextPhotos = existing.filter((_, idx) => idx !== idxToRemove)
      return {
        ...cur,
        photos: nextPhotos,
        photo: nextPhotos[0] || null
      }
    })
  }

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "14px 0 8px" }}>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 13.5, fontWeight: 700 }}>
          Design Photos {itemPhotos.length > 0 && <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 500 }}>({itemPhotos.length})</span>}
        </div>
        {itemPhotos.length > 0 && (
          <label style={{ fontSize: 11.5, color: "var(--gold)", fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}>
            <input
              type="file"
              multiple
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleFileChange}
              disabled={uploading}
            />
            <Plus size={13} /> {uploading ? "Preparing..." : "Add more photos"}
          </label>
        )}
      </div>

      {itemPhotos.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(95px, 1fr))", gap: 8 }}>
          {itemPhotos.map((imgUrl, pIndex) => (
            <div
              key={pIndex}
              style={{
                position: "relative",
                borderRadius: 8,
                overflow: "hidden",
                border: "1.4px solid var(--cream-line, #E3D6B3)",
                background: "#000",
                aspectRatio: "1/1",
                boxShadow: "0 2px 5px rgba(0,0,0,0.05)",
                cursor: "pointer"
              }}
              onClick={() => onPreview && onPreview(imgUrl)}
            >
              <img
                src={imgUrl}
                alt={`Design photo ${pIndex + 1}`}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
              <span
                style={{
                  position: "absolute",
                  bottom: 3,
                  left: 3,
                  background: "rgba(0,0,0,0.65)",
                  color: "#fff",
                  fontSize: 9,
                  fontWeight: 600,
                  padding: "1px 4px",
                  borderRadius: 3
                }}
              >
                #{pIndex + 1}
              </span>
              <button
                type="button"
                title="Crop / adjust photo"
                onClick={(e) => {
                  e.stopPropagation()
                  handleEditCrop(imgUrl, pIndex)
                }}
                style={{
                  position: "absolute",
                  top: 4,
                  right: 27,
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  background: "rgba(0,0,0,0.72)",
                  color: "#fff",
                  border: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  padding: 0
                }}
              >
                <Crop size={11} />
              </button>
              <button
                type="button"
                title="Remove photo"
                onClick={(e) => {
                  e.stopPropagation()
                  handleRemove(pIndex)
                }}
                style={{
                  position: "absolute",
                  top: 4,
                  right: 4,
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  background: "rgba(0,0,0,0.72)",
                  color: "#fff",
                  border: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  padding: 0
                }}
              >
                <X size={12} />
              </button>
            </div>
          ))}

          {/* Compact "+ Add" card */}
          <label
            style={{
              border: "1.4px dashed var(--cream-line, #E3D6B3)",
              borderRadius: 8,
              aspectRatio: "1/1",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              background: "var(--cream-deep, #F1E8D2)",
              cursor: uploading ? "wait" : "pointer",
              color: "var(--muted)",
              padding: 4
            }}
          >
            <input
              type="file"
              multiple
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleFileChange}
              disabled={uploading}
            />
            <Camera size={18} color="var(--gold)" />
            <span style={{ fontSize: 10, fontWeight: 600, color: "var(--gold)", marginTop: 3 }}>
              {uploading ? "Loading..." : "+ Add"}
            </span>
          </label>
        </div>
      ) : (
        <label
          style={{
            display: "block",
            border: "1.6px dashed var(--cream-line, #E3D6B3)",
            borderRadius: 10,
            padding: "16px 12px",
            textAlign: "center",
            background: "var(--cream-deep, #F1E8D2)",
            cursor: uploading ? "wait" : "pointer"
          }}
        >
          <input
            type="file"
            multiple
            accept="image/*"
            style={{ display: "none" }}
            onChange={handleFileChange}
            disabled={uploading}
          />
          <div style={{ fontSize: 22, display: "flex", justifyContent: "center", marginBottom: 3 }}>
            <Camera size={24} color="var(--muted)" />
          </div>
          <p style={{ fontSize: 12, fontWeight: 600, color: "var(--charcoal)", margin: "0 0 2px" }}>
            {uploading ? "Preparing photos for crop..." : "Tap to upload design photos"}
          </p>
          <p style={{ fontSize: 11, color: "var(--muted)", margin: 0 }}>
            Select 1 or more pictures — crop &amp; zoom to focus on details
          </p>
        </label>
      )}

      {/* Interactive Image Cropper Modal */}
      {cropQueue.length > 0 && (
        <ImageCropperModal
          isOpen={cropQueue.length > 0}
          imageSrc={cropQueue[queueIndex]?.dataUrl}
          queueInfo={{ current: queueIndex + 1, total: cropQueue.length }}
          onCrop={handleCropSave}
          onSkip={handleCropSkip}
          onSkipAll={handleCropSkipAll}
          onCancel={handleCancelCrop}
        />
      )}
    </div>
  )
}

// INSPIRATION PHOTO GALLERY SPECIFIC TO EACH CAKE TIER
function TierPhotoGallery({ tier, onUpdateTier, onPreview, tierNumber }) {
  const tierPhotos = Array.isArray(tier.photos)
    ? tier.photos
    : (tier.photo ? [tier.photo] : [])

  const [uploading, setUploading] = useState(false)
  const [cropQueue, setCropQueue] = useState([])
  const [queueIndex, setQueueIndex] = useState(0)

  const handleFileChange = async (e) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    setUploading(true)
    try {
      const fileList = Array.from(files)
      const readPromises = fileList.map(file => {
        return new Promise((resolve) => {
          if (!file.type?.startsWith("image/")) {
            resolve(null)
            return
          }
          const reader = new FileReader()
          reader.onload = ev => resolve({ file, dataUrl: ev.target.result })
          reader.onerror = () => resolve(null)
          reader.readAsDataURL(file)
        })
      })
      const itemsToCrop = (await Promise.all(readPromises)).filter(Boolean)
      if (itemsToCrop.length > 0) {
        setCropQueue(itemsToCrop)
        setQueueIndex(0)
      }
    } catch (err) {
      console.warn("Cake photo read error:", err)
    } finally {
      setUploading(false)
      e.target.value = ""
    }
  }

  const handleEditCrop = (imgUrl, pIndex) => {
    setCropQueue([{ file: null, dataUrl: imgUrl, isEditIndex: pIndex }])
    setQueueIndex(0)
  }

  const handleCropSave = (croppedDataUrl) => {
    const active = cropQueue[queueIndex]
    if (active && active.isEditIndex !== undefined) {
      const existing = [...tierPhotos]
      existing[active.isEditIndex] = croppedDataUrl
      onUpdateTier({
        ...tier,
        photos: existing,
        photo: existing[0] || null
      })
      setCropQueue([])
      setQueueIndex(0)
      return
    }

    const merged = [...tierPhotos, croppedDataUrl]
    onUpdateTier({
      ...tier,
      photos: merged,
      photo: merged[0] || null
    })

    if (queueIndex + 1 < cropQueue.length) {
      setQueueIndex(queueIndex + 1)
    } else {
      setCropQueue([])
      setQueueIndex(0)
    }
  }

  const handleCropSkip = async () => {
    const active = cropQueue[queueIndex]
    if (active && active.isEditIndex !== undefined) {
      setCropQueue([])
      setQueueIndex(0)
      return
    }

    const compressed = (active?.file ? await compressImage(active.file) : active?.dataUrl) || active?.dataUrl
    if (compressed) {
      const merged = [...tierPhotos, compressed]
      onUpdateTier({
        ...tier,
        photos: merged,
        photo: merged[0] || null
      })
    }

    if (queueIndex + 1 < cropQueue.length) {
      setQueueIndex(queueIndex + 1)
    } else {
      setCropQueue([])
      setQueueIndex(0)
    }
  }

  const handleCropSkipAll = async () => {
    const remaining = cropQueue.slice(queueIndex)
    const compressedList = await Promise.all(
      remaining.map(async item => {
        if (item.file) return await compressImage(item.file)
        return item.dataUrl
      })
    )
    const valid = compressedList.filter(Boolean)
    if (valid.length > 0) {
      const merged = [...tierPhotos, ...valid]
      onUpdateTier({
        ...tier,
        photos: merged,
        photo: merged[0] || null
      })
    }
    setCropQueue([])
    setQueueIndex(0)
  }

  const handleRemove = (idxToRemove) => {
    const next = tierPhotos.filter((_, idx) => idx !== idxToRemove)
    onUpdateTier({
      ...tier,
      photos: next,
      photo: next[0] || null
    })
  }

  return (
    <div style={{ marginTop: 10, marginBottom: 8, paddingTop: 8, borderTop: "1px dashed var(--cream-line, #E3D6B3)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--charcoal-soft, #6B6151)", textTransform: "uppercase", letterSpacing: ".05em", display: "flex", alignItems: "center", gap: 5 }}>
          <Camera size={13} color="var(--gold)" />
          Cake {tierNumber} Design Photo
          {tierPhotos.length > 0 && <span style={{ fontSize: 10.5, color: "var(--muted)", fontWeight: 500 }}>({tierPhotos.length})</span>}
        </div>
        {tierPhotos.length > 0 && (
          <label style={{ fontSize: 11, color: "var(--gold)", fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 3 }}>
            <input type="file" multiple accept="image/*" style={{ display: "none" }} onChange={handleFileChange} disabled={uploading} />
            <Plus size={12} /> {uploading ? "Preparing..." : "Add photo"}
          </label>
        )}
      </div>

      {tierPhotos.length > 0 ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {tierPhotos.map((imgUrl, pIndex) => (
            <div
              key={pIndex}
              style={{
                position: "relative",
                width: 78,
                height: 78,
                borderRadius: 7,
                overflow: "hidden",
                border: "1.4px solid var(--cream-line, #E3D6B3)",
                background: "#000",
                boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                cursor: "pointer"
              }}
              onClick={() => onPreview && onPreview(imgUrl)}
            >
              <img src={imgUrl} alt={`Cake ${tierNumber} design`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              <button
                type="button"
                title="Crop photo"
                onClick={(e) => { e.stopPropagation(); handleEditCrop(imgUrl, pIndex); }}
                style={{ position: "absolute", top: 3, right: 23, width: 18, height: 18, borderRadius: "50%", background: "rgba(0,0,0,0.72)", color: "#fff", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}
              >
                <Crop size={10} />
              </button>
              <button
                type="button"
                title="Remove photo"
                onClick={(e) => { e.stopPropagation(); handleRemove(pIndex); }}
                style={{ position: "absolute", top: 3, right: 3, width: 18, height: 18, borderRadius: "50%", background: "rgba(0,0,0,0.72)", color: "#fff", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}
              >
                <X size={11} />
              </button>
            </div>
          ))}
          <label
            style={{
              width: 78,
              height: 78,
              border: "1.4px dashed var(--cream-line, #E3D6B3)",
              borderRadius: 7,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              background: "#FFFBF0",
              cursor: uploading ? "wait" : "pointer",
              color: "var(--gold)",
              padding: 4
            }}
          >
            <input type="file" multiple accept="image/*" style={{ display: "none" }} onChange={handleFileChange} disabled={uploading} />
            <Camera size={16} />
            <span style={{ fontSize: 9.5, fontWeight: 600, marginTop: 2 }}>+ Add</span>
          </label>
        </div>
      ) : (
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            border: "1.4px dashed var(--cream-line, #E3D6B3)",
            borderRadius: 8,
            padding: "8px 12px",
            background: "#FFFBF0",
            cursor: uploading ? "wait" : "pointer"
          }}
        >
          <input type="file" multiple accept="image/*" style={{ display: "none" }} onChange={handleFileChange} disabled={uploading} />
          <div style={{ width: 32, height: 32, borderRadius: 6, background: "var(--cream-deep, #F1E8D2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Camera size={16} color="var(--gold)" />
          </div>
          <div>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--charcoal)" }}>
              {uploading ? "Preparing photo..." : `Add inspiration photo for Cake ${tierNumber}`}
            </div>
            <div style={{ fontSize: 10, color: "var(--muted)" }}>
              Click to select &amp; crop picture for Cake {tierNumber}
            </div>
          </div>
        </label>
      )}

      {cropQueue.length > 0 && (
        <ImageCropperModal
          isOpen={cropQueue.length > 0}
          imageSrc={cropQueue[queueIndex]?.dataUrl}
          queueInfo={{ current: queueIndex + 1, total: cropQueue.length }}
          onCrop={handleCropSave}
          onSkip={handleCropSkip}
          onSkipAll={handleCropSkipAll}
          onCancel={() => { setCropQueue([]); setQueueIndex(0); }}
        />
      )}
    </div>
  )
}

const parseBirthdayMonth = (bStr = "") => parseSpecialDate(bStr).month
const parseBirthdayDay = (bStr = "") => parseSpecialDate(bStr).day

export function OrderCalculator({ inventory, recipes, settings, setView, company }) {
  const getMults = () => loadLocal("ll_multipliers", DEFAULT_MULTS)
  const mults = getMults()

  const decorations = useMemo(() => {
    const stored = loadLocal("ll_decorations", DECORATION_ITEMS)
    const itemsMap = new Map()

    stored.forEach(d => {
      const invItem = inventory.find(x => x.id === d.iid)
      itemsMap.set(d.id, {
        id: d.id,
        name: d.name || invItem?.name || "Decoration Extra",
        label: d.label || d.name || invItem?.name || "Decoration Extra",
        iid: d.iid,
        qty: d.qty !== undefined ? d.qty : 1
      })
    })

    inventory.forEach(invItem => {
      const c = (invItem.cat || invItem.category || "").toLowerCase()
      const n = (invItem.name || "").toLowerCase()
      const isDecor = c.includes("decor") || c.includes("topper") || c.includes("ribbon") || c.includes("flower") ||
        n.includes("decor") || n.includes("topper") || n.includes("ribbon") || n.includes("flower")
      if (isDecor) {
        const id = "d_" + invItem.id
        if (!itemsMap.has(id) && ![...itemsMap.values()].some(x => x.iid === invItem.id)) {
          itemsMap.set(id, {
            id,
            name: invItem.name,
            label: invItem.name,
            iid: invItem.id,
            qty: 1
          })
        }
      }
    })

    return Array.from(itemsMap.values())
  }, [inventory])

  const packagingItems = useMemo(() => {
    const pkgInventoryItems = inventory.filter(item => {
      const c = (item.cat || item.category || "").toLowerCase()
      const n = (item.name || "").toLowerCase()
      return c.includes("board") || c.includes("packaging") || c.includes("box") || c.includes("dowel") || c.includes("drum") ||
        n.includes("board") || n.includes("packaging") || n.includes("box") || n.includes("dowel") || n.includes("drum")
    })
    return pkgInventoryItems.map(item => ({
      id: item.id,
      name: item.name,
      price: item.cost,
      unit: item.unit
    }))
  }, [inventory])

  const COVERING_TYPES = ["Buttercream", "Fondant", "Drip", "Ganache", "Whipped Cream", "Mirror Glaze", "Naked"]
  const FILLING_TYPES = ["Buttercream", "Jam", "Ganache", "Custard", "Cream Cheese", "Whipped Cream"]
  const EVENT_TYPES = ["Birthday", "Wedding", "Anniversary", "Naming / Christening", "Graduation", "Corporate / Office", "Bridal Shower", "Baby Shower", "Engagement", "Valentine", "Mother's Day", "Father's Day", "Christmas", "Easter", "Thanksgiving", "Get Well", "Congratulations", "Just Because", "Other"]

  const getMult = (size, shape) => {
    if (!size || !shape) return 0
    const key = `${String(size).replace(/"/g, '').trim()}-${String(shape).trim().toLowerCase()}`
    return mults[key] || 1
  }

  const layerCost = (flavour, size, shape) => {
    if (!flavour || typeof flavour !== "string" || !flavour.trim()) return 0
    const r = recipes.find(x => x.name.toLowerCase() === flavour.trim().toLowerCase()) ||
              recipes.find(x => x.name.toLowerCase().includes(flavour.trim().toLowerCase()))
    if (!r) return 0
    const base = (r.ing || []).reduce((s, ing) => { const it = inventory.find(x => x.id === ing.iid); return s + (it ? (Number(it.cost) || 0) * (Number(ing.qty) || 0) : 0) }, 0)
    return base * getMult(size, shape)
  }

  const FALLBACK_CPK = { "Buttercream": 3500, "Fondant": 7500, "Drip": 4000, "Ganache": 5000, "Whipped Cream": 3000, "Mirror Glaze": 6000, "Jam": 2000, "Custard": 1800, "Cream Cheese": 4500 }
  const coverFillCost = (type, grams) => {
    const numGrams = Number(grams) || 0
    if (!type || typeof type !== "string" || !type.trim() || numGrams <= 0) return 0
    const r = recipes.find(x => (x.type === "covering" || !x.type) && x.name.toLowerCase() === type.trim().toLowerCase()) ||
              recipes.find(x => (x.type === "covering" || !x.type) && x.name.toLowerCase().includes(type.trim().toLowerCase()))
    if (r) {
      const totalCost = (r.ing || []).reduce((s, ing) => { const it = inventory.find(x => x.id === ing.iid); return s + (it ? (Number(it.cost) || 0) * (Number(ing.qty) || 0) : 0) }, 0)
      const batchGrams = +(r.batchWeight) || (r.ing || []).reduce((s, ing) => { const it = inventory.find(x => x.id === ing.iid); return s + (it?.unit === "kg" ? (Number(ing.qty) || 0) * 1000 : it?.unit === "g" ? (Number(ing.qty) || 0) : it?.unit === "L" || it?.unit === "l" ? (Number(ing.qty) || 0) * 1000 : 0) }, 0)
      if (batchGrams > 0) return (totalCost / batchGrams) * numGrams
    }
    const cpk = FALLBACK_CPK[type] || 3000
    return (cpk / 1000) * numGrams
  }

  const getRecipeCostPerGram = (r) => {
    if (!r) return 0
    const totalCost = (r.ing || []).reduce((s, ing) => {
      const it = inventory.find(x => x.id === ing.iid)
      return s + (it ? (Number(it.cost) || 0) * (Number(ing.qty) || 0) : 0)
    }, 0)
    const batchGrams = Number(r.cal_grams) || Number(r.batchWeight) || Number(r.batch_yield_g) ||
      (r.ing || []).reduce((s, ing) => {
        const it = inventory.find(x => x.id === ing.iid)
        return s + (it?.unit === "kg" ? (Number(ing.qty) || 0) * 1000 : it?.unit === "g" ? (Number(ing.qty) || 0) : it?.unit === "L" || it?.unit === "l" ? (Number(ing.qty) || 0) * 1000 : 0)
      }, 0)
    return batchGrams > 0 ? totalCost / batchGrams : 0
  }

  const layerRecipes = recipes.filter(r => !r.type || r.type === "layer" || r.type === "cake_layer")
  const coveringRecipes = recipes.filter(r => r.type === "covering")
  const pastryRecipes = recipes.filter(r => r.type === "pastry")
  const allRecipes = recipes

  const fillingRecipes = useMemo(() => {
    return recipes.filter(r => {
      if (r.type === "cake_layer" || r.type === "pastry") return false
      if (r.job_filling !== undefined || r.can_fill !== undefined) {
        return Boolean(r.job_filling || r.can_fill)
      }
      if (Number(r.thickness_fill) > 0 || Number(r.thickFillMm) > 0) return true
      const name = (r.name || "").toLowerCase()
      if (name.includes("fondant")) return false
      return true
    })
  }, [recipes])

  const crumbRecipes = useMemo(() => {
    return recipes.filter(r => {
      if (r.type === "cake_layer" || r.type === "pastry") return false
      if (r.job_crumb !== undefined || r.can_crumb !== undefined) {
        return Boolean(r.job_crumb || r.can_crumb)
      }
      if (Number(r.thickness_crumb) > 0 || Number(r.thickCrumbMm) > 0) return true
      const name = (r.name || "").toLowerCase()
      if (name.includes("fondant") || name.includes("whipped cream") || name.includes("caramel")) return false
      return true
    })
  }, [recipes])

  const finishRecipes = useMemo(() => {
    return recipes.filter(r => {
      if (r.type === "cake_layer" || r.type === "pastry") return false
      if (r.job_finish !== undefined || r.can_finish !== undefined) {
        return Boolean(r.job_finish || r.can_finish)
      }
      if (Number(r.thickness_finish) > 0 || Number(r.thickFinishMm) > 0) return true
      const name = (r.name || "").toLowerCase()
      if (name.includes("caramel")) return false
      return true
    })
  }, [recipes])

  const getRecipeByName = (name) => {
    if (!name || typeof name !== "string") return null
    const trimmed = name.trim().toLowerCase()
    return recipes.find(x => (x.type === "covering" || !x.type) && x.name.toLowerCase() === trimmed) ||
           recipes.find(x => (x.type === "covering" || !x.type) && x.name.toLowerCase().includes(trimmed)) ||
           { name }
  }

  const computeFormulaFilling = (typeName, size, shape, layers) => {
    if (!typeName) return 0
    const r = getRecipeByName(typeName)
    const layerCount = (layers || []).reduce((sum, l) => sum + (Number(l.qty) || 1), 0) || layers?.length || 1
    const geom = calculateCakeGeometry(size, layerCount, shape)
    return Math.round(calculateFillingGrams(r, geom))
  }

  const computeFormulaCovering = (typeName, size, shape, layers) => {
    if (!typeName) return 0
    const r = getRecipeByName(typeName)
    const cov = getRecipeCoverageValues(r)
    const overhang = cov.application === "rolled" ? (Number(cov.sheet_overhang_in) || 2.4) : 0
    const layerCount = (layers || []).reduce((sum, l) => sum + (Number(l.qty) || 1), 0) || layers?.length || 1
    const geom = calculateCakeGeometry(size, layerCount, shape, overhang)
    return Math.round(calculateCoveringGrams(r, geom))
  }

  const updateTierGeometry = (t, patch) => {
    const newSize = patch.size !== undefined ? patch.size : t.size
    const newShape = patch.shape !== undefined ? patch.shape : t.shape
    const newLayers = patch.layers !== undefined ? patch.layers : t.layers
    const fillings = (patch.fillings !== undefined ? patch.fillings : t.fillings || []).map(f => {
      if (f.isManual || !f.type) return f
      const formulaGrams = computeFormulaFilling(f.type, newSize, newShape, newLayers)
      return { ...f, grams: formulaGrams }
    })
    const coverings = (patch.coverings !== undefined ? patch.coverings : t.coverings || []).map(c => {
      if (c.isManual || !c.type) return c
      const formulaGrams = computeFormulaCovering(c.type, newSize, newShape, newLayers)
      return { ...c, grams: formulaGrams }
    })
    return {
      ...t,
      ...patch,
      fillings,
      coverings
    }
  }

  const allCoveringTypes = useMemo(() => {
    const list = []
    const seen = new Set()
    recipes.filter(r => r.type === "covering" || !r.type).forEach(r => {
      const cov = getRecipeCoverageValues(r)
      if (cov.cover_rate !== null && cov.cover_rate !== undefined && cov.cover_rate > 0) {
        list.push(r.name)
        seen.add(r.name.toLowerCase())
      }
    })
    COVERING_TYPES.forEach(name => {
      if (!seen.has(name.toLowerCase())) {
        const cov = getRecipeCoverageValues({ name })
        if (cov.cover_rate !== null && cov.cover_rate !== undefined && cov.cover_rate > 0) {
          list.push(name)
          seen.add(name.toLowerCase())
        }
      }
    })
    return list
  }, [recipes])

  const allFillingTypes = useMemo(() => {
    const list = []
    const seen = new Set()
    recipes.filter(r => r.type === "covering" || !r.type).forEach(r => {
      const cov = getRecipeCoverageValues(r)
      if (cov.fill_rate !== null && cov.fill_rate !== undefined && cov.fill_rate > 0) {
        list.push(r.name)
        seen.add(r.name.toLowerCase())
      }
    })
    FILLING_TYPES.forEach(name => {
      if (!seen.has(name.toLowerCase())) {
        const cov = getRecipeCoverageValues({ name })
        if (cov.fill_rate !== null && cov.fill_rate !== undefined && cov.fill_rate > 0) {
          list.push(name)
          seen.add(name.toLowerCase())
        }
      }
    })
    return list
  }, [recipes])

  const costPerPiece = (recipeName) => {
    if (!recipeName) return 0
    const r = recipes.find(x => x.name.toLowerCase() === recipeName.toLowerCase()) || recipes.find(x => x.name.toLowerCase().includes(recipeName.toLowerCase()))
    if (!r) return 0
    const totalCost = r.ing.reduce((s, ing) => { const it = inventory.find(x => x.id === ing.iid); return s + (it ? it.cost * ing.qty : 0) }, 0)
    const pieces = r.batchSize || 12
    return totalCost / pieces
  }

  let nid = Date.now()
  const uid2 = () => nid++

  const createDefaultCakeItem = (idx = 1) => {
    const defaultLayers = [{ id: uid2(), flavour: "", qty: 1 }]
    const defCoverGrams = computeFormulaCovering("Buttercream", "10", "Round", defaultLayers) || 461
    const defFillGrams = computeFormulaFilling("Buttercream", "10", "Round", defaultLayers) || 232
    return {
      id: "item-" + uid2(),
      type: "cake",
      name: `Item ${idx} — Cake`,
      tiers: [
        {
          id: uid2(),
          size: "10",
          shape: "Round",
          layers: defaultLayers,
          coverings: [{ id: uid2(), type: "Buttercream", grams: defCoverGrams, isManual: false }],
          fillings: [{ id: uid2(), type: "Buttercream", grams: defFillGrams, isManual: false }],
          photos: [],
          photo: null
        }
      ],
      decQty: {},
      topper: { enabled: false, make: "", deliver: "", description: "" },
    photos: [],
    photo: null,
    accRows: [],
    sameDeliveryAsFirst: idx > 1,
    deliveryDate: "",
    collectionTime: "",
    itemNote: "",
    isCollapsed: false
    }
  }

  const createDefaultPastryItem = (idx = 1) => ({
    id: "item-" + uid2(),
    type: "pastry",
    name: `Item ${idx} — Pastry`,
    pastryItems: [
      { id: uid2(), flavour: "", qty: 12, filling: "", fillingGrams: 0 }
    ],
    decQty: {},
    photos: [],
    photo: null,
    accRows: [],
    sameDeliveryAsFirst: idx > 1,
    deliveryDate: "",
    collectionTime: "",
    itemNote: "",
    isCollapsed: false
  })

  const createDefaultPortionsItem = (idx = 1) => ({
    id: "item-" + uid2(),
    type: "portions",
    name: `Item ${idx} — Portions`,
    route: "slab", // "slab" or "count"
    servings: 100,
    sliceWidth: 2,
    sliceLength: 2,
    sliceHeight: 4,
    allowancePct: 5,
    layers: [{ id: uid2(), flavour: "", qty: 1 }],
    panIndex: 1, // 12x18 half sheet
    fillingRecipe: "",
    topFinishRecipe: "",
    countedServings: 40,
    countedRecipeId: "",
    decQty: {},
    photos: [],
    photo: null,
    accRows: [],
    sameDeliveryAsFirst: idx > 1,
    deliveryDate: "",
    collectionTime: "",
    itemNote: "",
    isCollapsed: false
  })

  // Auto-restore saved calculator state (with seamless multi-item migration)
  const restoreCalc = () => {
    try {
      const prefillRaw = sessionStorage.getItem("ll_calc_prefill")
      if (prefillRaw) {
        sessionStorage.removeItem("ll_calc_prefill")
        const prefill = JSON.parse(prefillRaw)
        const base = loadLocal("ll_calc_state", null) || {}
        return { ...base, ...prefill }
      }
      const edit = loadLocal("ll_calc_edit", null)
      if (edit) {
        saveLocal("ll_calc_edit", null)
        return { ...edit, isEdit: true, editId: edit.id }
      }
      return loadLocal("ll_calc_state", null)
    } catch { return null }
  }
  const saved = useState(() => restoreCalc())[0]

  // Initialize Items
  const [items, setItems] = useState(() => {
    if (saved?.items && Array.isArray(saved.items) && saved.items.length > 0) {
      return saved.items.map(it => ({
        ...it,
        photos: Array.isArray(it.photos) ? it.photos : (it.photo ? [it.photo] : []),
        photo: it.photos?.[0] || it.photo || null
      }))
    }
    // Backward compatibility: migrate legacy single-item structure
    const migrated = []
    if (saved?.tiers?.length > 0 || saved?.showCake || saved?.productType === "Cake") {
      migrated.push({
        id: "item-" + uid2(),
        type: "cake",
        name: "Item 1 — Cake",
        tiers: saved.tiers && saved.tiers.length > 0 ? saved.tiers : [
          {
            id: uid2(),
            size: "10",
            shape: "Round",
            layers: [{ id: uid2(), flavour: "", qty: 1 }],
            coverings: [{ id: uid2(), type: "Buttercream", grams: 400 }],
            fillings: [{ id: uid2(), type: "Buttercream", grams: 200 }]
          }
        ],
        decQty: saved.decQty || {},
        topper: saved.topper || { enabled: false, make: "", deliver: "", description: "" },
        photos: saved.cakePhotos && saved.cakePhotos.length > 0 ? saved.cakePhotos : (saved.cakePhoto ? [saved.cakePhoto] : []),
        photo: saved.cakePhoto || null,
        accRows: saved.accRows || [],
        sameDeliveryAsFirst: false,
        deliveryDate: saved.deliveryDate || "",
        collectionTime: saved.collectionTime || "",
        itemNote: "",
        isCollapsed: false
      })
    }
    if (saved?.pastryItems?.length > 0 || saved?.showPastry) {
      migrated.push({
        id: "item-" + uid2(),
        type: "pastry",
        name: `Item ${migrated.length + 1} — Pastry`,
        pastryItems: saved.pastryItems || [{ id: uid2(), flavour: "", qty: 12, filling: "", fillingGrams: 0 }],
        decQty: {},
        photos: [],
        photo: null,
        accRows: [],
        sameDeliveryAsFirst: migrated.length > 0,
        deliveryDate: saved.deliveryDate || "",
        collectionTime: saved.collectionTime || "",
        itemNote: "",
        isCollapsed: false
      })
    }
    if (migrated.length > 0) return migrated
    return []
  })

  const itemPickerRef = useRef(null)
  const [previewPhoto, setPreviewPhoto] = useState(null)
  const [showItemPicker, setShowItemPicker] = useState(false)
  const [clientName, setClientName] = useState(() => saved?.clientName || "")
  const [clientPhone, setClientPhone] = useState(() => saved?.clientPhone || "")
  const [clientBirthday, setClientBirthday] = useState(() => saved?.clientBirthday || "")
  const [hasSpecialEvent, setHasSpecialEvent] = useState(() => !!(saved?.clientBirthday || saved?.hasSpecialEvent))
  const [eventType, setEventType] = useState(() => saved?.eventType || "")
  const [generalNote, setGeneralNote] = useState(() => saved?.generalNote || saved?.clientNotes || saved?.notes || "")
  const [orderPurpose, setOrderPurpose] = useState(() => saved?.orderPurpose || "sale")
  const [margin, setMargin] = useState(() => saved?.margin || settings.profitPct || 40)
  const [orderHours, setOrderHours] = useState(() => saved?.orderHours !== undefined ? Number(saved.orderHours) : 6)
  const [overheadMethod, setOverheadMethod] = useState(() => saved?.overheadMethod || "pct")
  const [accessoriesPct, setAccessoriesPct] = useState(() => saved?.accessoriesPct !== undefined ? Number(saved.accessoriesPct) : 15)
  const [rushPct, setRushPct] = useState(() => saved?.rushPct !== undefined ? Number(saved.rushPct) : 0)
  const [seasonPct, setSeasonPct] = useState(() => saved?.seasonPct !== undefined ? Number(saved.seasonPct) : 0)
  const [salePrice, setSalePrice] = useState(() => saved?.salePrice || "")
  const [deliveryCharge, setDeliveryCharge] = useState(() => saved?.deliveryCharge || "")
  const [vatEnabled, setVatEnabled] = useState(() => saved?.vatEnabled || false)
  const [vatRate, setVatRate] = useState(() => saved?.vatRate || 7.5)
  const [quoteSaved, setQuoteSaved] = useState(false)
  const [lastSavedQuote, setLastSavedQuote] = useState(null)
  const [isSavingQuote, setIsSavingQuote] = useState(false)
  const isSavingQuoteRef = useRef(false)
  const [saveQuoteError, setSaveQuoteError] = useState(null)
  const [isEdit, setIsEdit] = useState(() => !!saved?.isEdit)
  const [editId, setEditId] = useState(() => saved?.editId || null)

  const quoteLimitCheck = useMemo(() => {
    return typeof checkPlanLimit === "function" ? checkPlanLimit("ordersPerMonth") : { exceeded: false }
  }, [items, isEdit, quoteSaved])

  // Full reset function to clear calculator state and prepare for fresh order
  const resetCalculator = (promptConfirm = false) => {
    if (promptConfirm && (clientName.trim() || items.length > 1 || items[0]?.tiers?.some(t => t.layers?.some(l => l.flavour)))) {
      if (!window.confirm("Clear all details in the order calculator and start a fresh order?")) return
    }
    setClientName("")
    setClientPhone("")
    setClientBirthday("")
    setHasSpecialEvent(false)
    setEventType("")
    setGeneralNote("")
    setOrderPurpose("sale")
    setMargin(settings?.profitPct || 40)
    setOrderHours(6)
    setOverheadMethod("pct")
    setAccessoriesPct(15)
    setRushPct(0)
    setSeasonPct(0)
    setSalePrice("")
    setDeliveryCharge("")
    setVatEnabled(false)
    setVatRate(7.5)
    setIsEdit(false)
    setEditId(null)
    setItems([createDefaultCakeItem(1)])
    setShowItemPicker(false)
    setPreviewPhoto(null)
    setShowClientSuggestions(false)
    setAutoFilledBadge(false)
    clearTempCalculatorState()
    saveLocal("ll_calc_state", null)
  }

  // Saved clients directory integration
  const [savedClients, setSavedClients] = useState(() => loadClients())
  const [showClientSuggestions, setShowClientSuggestions] = useState(false)
  const [autoFilledBadge, setAutoFilledBadge] = useState(false)

  const selectedClientRecord = useMemo(() => {
    if (!clientName.trim()) return null
    return savedClients.find(c => (c.name || "").trim().toLowerCase() === clientName.trim().toLowerCase())
  }, [clientName, savedClients])

  const clientSuggestions = useMemo(() => {
    if (!clientName.trim()) return []
    const q = clientName.toLowerCase()
    return savedClients.filter(c =>
      (c.name || "").toLowerCase().includes(q) ||
      (c.phone || "").toLowerCase().includes(q) ||
      (c.birthday || "").toLowerCase().includes(q)
    ).slice(0, 5)
  }, [clientName, savedClients])

  const selectClient = (c) => {
    setClientName(c.name)
    if (c.phone) setClientPhone(c.phone)
    if (c.notes || c.address) setGeneralNote(c.notes || c.address)
    if (c.birthday && hasSpecialEvent) {
      setClientBirthday(c.birthday)
    }
    autoSave({
      clientName: c.name,
      clientPhone: c.phone || clientPhone,
      clientBirthday: (c.birthday && hasSpecialEvent) ? c.birthday : (hasSpecialEvent ? clientBirthday : ""),
      hasSpecialEvent,
      generalNote: c.notes || c.address || generalNote
    })
    setShowClientSuggestions(false)
    setAutoFilledBadge(true)
    setTimeout(() => setAutoFilledBadge(false), 4000)
  }

  // Mobile layout detector
  const [isMobile, setIsMobile] = useState(window.innerWidth < 800)
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 800)
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  // Auto-save calculator state on every change
  const autoSave = (extra = {}) => {
    saveLocal("ll_calc_state", {
      items,
      clientName,
      clientPhone,
      clientBirthday: hasSpecialEvent ? clientBirthday : "",
      hasSpecialEvent,
      eventType,
      generalNote,
      orderPurpose,
      margin,
      orderHours,
      overheadMethod,
      accessoriesPct,
      rushPct,
      seasonPct,
      salePrice,
      deliveryCharge,
      vatEnabled,
      vatRate,
      ...extra
    })
  }

  // Item management functions
  const addItem = (type) => {
    const nextIdx = items.length + 1
    const newItem = type === "portions"
      ? createDefaultPortionsItem(nextIdx)
      : type === "pastry"
        ? createDefaultPastryItem(nextIdx)
        : createDefaultCakeItem(nextIdx)
    const updated = [...items, newItem]
    setItems(updated)
    setShowItemPicker(false)
    autoSave({ items: updated })
  }

  const removeItem = (itemId) => {
    const updated = items.filter(i => i.id !== itemId)
    setItems(updated)
    autoSave({ items: updated })
  }

  const updateItem = (itemId, updater) => {
    setItems(prev => {
      const next = prev.map(item => item.id === itemId ? updater(item) : item)
      autoSave({ items: next })
      return next
    })
  }

  // Calculation helpers per item
  const tierCost = (tier) => {
    const totalLayers = (tier.layers || []).reduce((sum, l) => sum + (Number(l.qty) || 1), 0) || 1
    const tierHeight = Number(tier.height) > 0 ? Number(tier.height) : (Number(tier.layerHeight) > 0 ? Number(tier.layerHeight) * totalLayers : totalLayers * 2)
    const layerThickness = tierHeight / totalLayers
    const pArea = planArea(tier.shape || "Round", Number(tier.size) || 10, Number(tier.sizeB) || 0)

    const batterCost = (tier.layers || []).reduce((s, l) => {
      if (!l.flavour) return s
      const r = recipes.find(x => x.name.toLowerCase() === l.flavour.toLowerCase())
      if (r && r.cal_grams) {
        const dens = calculateDensity(r.cal_grams, r.cal_shape, r.cal_dim_a, r.cal_dim_b, r.cal_height_in)
        const trim = r.trim_pct !== undefined ? Number(r.trim_pct) : 0.08
        const gpp = gramsPerPan(dens, pArea, layerThickness, trim)
        const cpg = getRecipeCostPerGram(r)
        return s + (gpp * (Number(l.qty) || 1) * cpg)
      } else {
        return s + (layerCost(l.flavour, tier.size, tier.shape) * (Number(l.qty) || 1))
      }
    }, 0)

    const covCost = (tier.coverings || []).reduce((s, c) => s + coverFillCost(c.type, Number(c.grams) || 0), 0)
    const filCost = (tier.fillings || []).reduce((s, f) => s + coverFillCost(f.type, Number(f.grams) || 0), 0)

    return batterCost + covCost + filCost
  }

  const calcItemCost = (item) => {
    if (item.type === "cake") {
      const tCost = (item.tiers || []).reduce((s, t) => s + tierCost(t), 0)
      const dCost = decorations.reduce((s, d) => {
        const qty = item.decQty?.[d.id] || 0
        const it = inventory.find(x => x.id === d.iid)
        return s + (it && qty ? (Number(it.cost) || 0) * (Number(d.qty) || 0) * qty : 0)
      }, 0)
      const topCost = (+item.topper?.make || 0) + (+item.topper?.deliver || 0)
      const pkgCost = (item.accRows || []).reduce((s, r) => {
        const pkg = packagingItems.find(p => p.id === r.itemId)
        const unitPrice = pkg ? pkg.price : (r.price || 0)
        const qty = Number(r.qty) > 0 ? Number(r.qty) : 1
        return s + (unitPrice * qty)
      }, 0)
      return tCost + dCost + topCost + pkgCost
    } else if (item.type === "portions") {
      let baseCost = 0
      if (item.route === "count") {
        const r = recipes.find(x => x.id === item.countedRecipeId || x.name === item.countedRecipeId)
        const costEach = r
          ? (costPerPiece(r.name) || (getRecipeCostPerGram(r) * (Number(r.per_batch) || 50)))
          : 0
        baseCost = (Number(item.countedServings) || 40) * costEach
      } else {
        const pan = STANDARD_PANS[item.panIndex !== undefined ? item.panIndex : 1] || STANDARD_PANS[1]
        const pGeom = calculatePortionsGeometry({
          servings: Number(item.servings) || 100,
          sliceWidth: Number(item.sliceWidth) || 2,
          sliceLength: Number(item.sliceLength) || 2,
          sliceHeight: Number(item.sliceHeight) || 4,
          allowancePct: Number(item.allowancePct) || 5,
          pan,
          layers: (item.layers || [{ flavour: "", qty: 1 }]).map(l => {
            const r = recipes.find(x => x.id === l.flavour || x.name === l.flavour)
            const dens = r && r.cal_grams ? calculateDensity(r.cal_grams, r.cal_shape, r.cal_dim_a, r.cal_dim_b, r.cal_height_in) : 0.8
            const trim = r && r.trim_pct !== undefined ? Number(r.trim_pct) : 0.08
            const cpg = getRecipeCostPerGram(r)
            return { ...l, density: dens, trimPct: trim, costPerGram: cpg, recipe: r }
          }),
          fillRecipe: (() => {
            const r = recipes.find(x => x.id === item.fillingRecipe || x.name === item.fillingRecipe)
            if (!r) return null
            return {
              thickMm: Number(r.thick_fill_mm || r.thickFillMm) || 4.5,
              density: Number(r.density_g_cm3 || r.density) || 0.90,
              wastePct: Number(r.waste_pct || r.wastePct) || 0.15,
              costPerGram: getRecipeCostPerGram(r)
            }
          })(),
          topRecipe: (() => {
            const r = recipes.find(x => x.id === item.topFinishRecipe || x.name === item.topFinishRecipe)
            if (!r) return null
            return {
              thickMm: Number(r.thick_finish_mm || r.thickFinishMm) || 4.0,
              density: Number(r.density_g_cm3 || r.density) || 1.10,
              wastePct: Number(r.waste_pct || r.wastePct) || 0.10,
              costPerGram: getRecipeCostPerGram(r)
            }
          })()
        })
        baseCost = pGeom.totalCost
      }
      const pkgCost = (item.accRows || []).reduce((s, r) => {
        const pkg = packagingItems.find(p => p.id === r.itemId)
        const unitPrice = pkg ? pkg.price : (r.price || 0)
        const qty = Number(r.qty) > 0 ? Number(r.qty) : 1
        return s + (unitPrice * qty)
      }, 0)
      return baseCost + pkgCost
    } else {
      const pCost = (item.pastryItems || []).reduce((s, p) => {
        const pieceCost = p.flavour ? costPerPiece(p.flavour) : 0
        return s + (pieceCost * (+p.qty || 0)) + (p.filling ? coverFillCost(p.filling, +p.fillingGrams || 0) : 0)
      }, 0)
      const pkgCost = (item.accRows || []).reduce((s, r) => {
        const pkg = packagingItems.find(p => p.id === r.itemId)
        const unitPrice = pkg ? pkg.price : (r.price || 0)
        const qty = Number(r.qty) > 0 ? Number(r.qty) : 1
        return s + (unitPrice * qty)
      }, 0)
      return pCost + pkgCost
    }
  }

  // Direct costs across all items
  const subtotal = useMemo(() => items.reduce((sum, it) => sum + calcItemCost(it), 0), [items, inventory, recipes, mults])

  const costStack = useMemo(() => {
    return calculateCostStack({
      directCost: subtotal,
      accessoriesPct: accessoriesPct !== undefined ? accessoriesPct : (settings?.accessoryPct || 15),
      overheadMethod: overheadMethod || "pct",
      orderHours: orderHours !== undefined ? orderHours : 6,
      hourlyRate: settings?.hourlyRate || deriveOverheadRates(settings).hourlyRate,
      perOrderRate: settings?.perOrderRate || deriveOverheadRates(settings).perOrderRate,
      overheadPct: settings?.overheadPct || 27,
      marginPct: margin !== undefined ? margin : (settings?.profitPct || 40),
      rushPct: rushPct || 0,
      seasonPct: seasonPct || 0
    })
  }, [subtotal, accessoriesPct, overheadMethod, orderHours, settings, margin, rushPct, seasonPct])

  const accessoryAmount = Math.round(costStack.accessories)
  const overheadAmount = Math.round(costStack.overhead)
  const totalCost = Math.round(costStack.totalCost)
  const suggestedPrice = Math.round(costStack.price)
  const chargeAmount = costStack.charge
  const profit = suggestedPrice - totalCost

  // Detailed itemized cost breakdown matching Claude Artifact 1 & 2
  const directBreakdown = useMemo(() => {
    let batterCost = 0, batterGrams = 0;
    const batterFlavours = [];
    let fillingCost = 0;
    const fillingFlavours = [];
    let crumbCost = 0, crumbGrams = 0;
    const crumbTypes = [];
    let finishCost = 0, finishGrams = 0;
    const finishTypes = [];
    let decorCost = 0;
    const decorItems = [];
    let pkgToppCost = 0;
    let portionsCost = 0;
    const portionsDesc = [];
    let pastryCost = 0;
    const pastryDesc = [];

    items.forEach(it => {
      if (it.type === "cake") {
        (it.tiers || []).forEach(tier => {
          const totalLayers = (tier.layers || []).reduce((sum, l) => sum + (Number(l.qty) || 1), 0) || 1;
          const tierHeight = Number(tier.height) > 0 ? Number(tier.height) : (Number(tier.layerHeight) > 0 ? Number(tier.layerHeight) * totalLayers : totalLayers * 2);
          const layerThickness = tierHeight / totalLayers;
          const pArea = planArea(tier.shape || "Round", Number(tier.size) || 10, Number(tier.sizeB) || 0);

          // Batter
          (tier.layers || []).forEach(l => {
            if (!l.flavour) return;
            const r = recipes.find(x => x.name.toLowerCase() === l.flavour.toLowerCase());
            let cost = 0;
            let g = 0;
            if (r && r.cal_grams) {
              const dens = calculateDensity(r.cal_grams, r.cal_shape, r.cal_dim_a, r.cal_dim_b, r.cal_height_in);
              const trim = r.trim_pct !== undefined ? Number(r.trim_pct) : 0.08;
              g = gramsPerPan(dens, pArea, layerThickness, trim) * (Number(l.qty) || 1);
              cost = g * getRecipeCostPerGram(r);
            } else {
              cost = layerCost(l.flavour, tier.size, tier.shape) * (Number(l.qty) || 1);
            }
            batterCost += cost;
            batterGrams += g;
            if (!batterFlavours.includes(l.flavour)) batterFlavours.push(l.flavour);
          });

          // Fillings
          (tier.fillings || []).forEach(f => {
            if (!f.type) return;
            const c = coverFillCost(f.type, Number(f.grams) || 0);
            fillingCost += c;
            if (!fillingFlavours.includes(f.type)) fillingFlavours.push(f.type);
          });

          // Coverings
          (tier.coverings || []).forEach(c => {
            if (!c.type) return;
            const g = Number(c.grams) || 0;
            const cost = coverFillCost(c.type, g);
            const r = recipes.find(x => x.name.toLowerCase() === c.type.toLowerCase());
            const isCrumb = r?.job_crumb || r?.can_crumb || c.role === "crumb" || c.type.toLowerCase().includes("crumb");
            if (isCrumb) {
              crumbCost += cost;
              crumbGrams += g;
              if (!crumbTypes.includes(c.type)) crumbTypes.push(c.type);
            } else {
              finishCost += cost;
              finishGrams += g;
              if (!finishTypes.includes(c.type)) finishTypes.push(c.type);
            }
          });
        });

        // Decorations
        decorations.forEach(d => {
          const qty = it.decQty?.[d.id] || 0;
          const inv = inventory.find(x => x.id === d.iid);
          if (inv && qty) {
            const c = (Number(inv.cost) || 0) * (Number(d.qty) || 0) * qty;
            decorCost += c;
            decorItems.push(d.name || inv.name);
          }
        });

        // Topper
        pkgToppCost += (+it.topper?.make || 0) + (+it.topper?.deliver || 0);
        // Packaging
        pkgToppCost += (it.accRows || []).reduce((s, r) => {
          const pkg = packagingItems.find(p => p.id === r.itemId);
          const unitPrice = pkg ? pkg.price : (r.price || 0);
          return s + (unitPrice * (Number(r.qty) > 0 ? Number(r.qty) : 1));
        }, 0);

      } else if (it.type === "portions") {
        const itemCost = calcItemCost(it);
        portionsCost += itemCost;
        const desc = it.route === "count"
          ? `${it.countedServings || 40} servings (counted)`
          : `${it.servings || 100} slices (${STANDARD_PANS[it.panIndex !== undefined ? it.panIndex : 1]?.label || "tray"})`;
        portionsDesc.push(desc);
      } else {
        const itemCost = calcItemCost(it);
        pastryCost += itemCost;
        const desc = it.pastryItems?.[0]?.flavour
          ? `${it.pastryItems[0].qty || 12} pcs ${it.pastryItems[0].flavour}`
          : "Pastry & desserts";
        pastryDesc.push(desc);
      }
    });

    const batterNotes = batterGrams > 0 ? `${Math.round(batterGrams).toLocaleString()} g · ${batterFlavours.join(" + ")}` : batterFlavours.join(" + ");
    const fillingNotes = fillingFlavours.length > 0 ? fillingFlavours.join(" + ") : "none";
    const crumbNotes = crumbTypes.length > 0 ? `${crumbTypes.join(" + ")}${crumbGrams > 0 ? ` · ${Math.round(crumbGrams).toLocaleString()} g` : ""}` : "none";
    const finishNotes = finishTypes.length > 0 ? `${finishTypes.join(" + ")}${finishGrams > 0 ? ` · ${Math.round(finishGrams).toLocaleString()} g` : ""}` : "none";
    const decorNotes = decorItems.length > 0 ? decorItems.join(" + ") : "";
    const portionsNotes = portionsDesc.join(", ");
    const pastryNotes = pastryDesc.join(", ");

    return {
      batterCost: Math.round(batterCost),
      batterNotes,
      fillingCost: Math.round(fillingCost),
      fillingNotes,
      crumbCost: Math.round(crumbCost),
      crumbNotes,
      finishCost: Math.round(finishCost),
      finishNotes,
      decorCost: Math.round(decorCost),
      decorNotes,
      pkgToppCost: Math.round(pkgToppCost),
      portionsCost: Math.round(portionsCost),
      portionsNotes,
      pastryCost: Math.round(pastryCost),
      pastryNotes
    };
  }, [items, inventory, recipes, mults, decorations, packagingItems]);

  const cakePrice = (orderPurpose === "gift" || orderPurpose === "sample") ? 0 : (+salePrice || chargeAmount || suggestedPrice)
  const delivCharge = +deliveryCharge || 0
  const vatAmount = vatEnabled ? Math.round(cakePrice * (vatRate / 100)) : 0
  const grandTotal = cakePrice + delivCharge + vatAmount

  // Batch summary for baker's prep (Quote summary block)
  const prepBatchSummary = useMemo(() => {
    const totals = {}
    items.forEach(it => {
      if (it.type === "cake") {
        (it.tiers || []).forEach(t => {
          (t.fillings || []).forEach(f => {
            if (f.type && Number(f.grams) > 0) {
              totals[f.type] = (totals[f.type] || 0) + Number(f.grams)
            }
          });
          (t.coverings || []).forEach(c => {
            if (c.type && Number(c.grams) > 0) {
              totals[c.type] = (totals[c.type] || 0) + Number(c.grams)
            }
          })
        })
      } else if (it.type === "pastry") {
        (it.pastryItems || []).forEach(p => {
          if (p.filling && Number(p.fillingGrams) > 0) {
            totals[p.filling] = (totals[p.filling] || 0) + Number(p.fillingGrams)
          }
        })
      } else if (it.type === "portions" && it.route !== "count") {
        if (it.fillingRecipe) {
          const pan = STANDARD_PANS[it.panIndex !== undefined ? it.panIndex : 1] || STANDARD_PANS[1]
          const pGeom = calculatePortionsGeometry({
            servings: Number(it.servings) || 100,
            sliceWidth: Number(it.sliceWidth) || 2,
            sliceLength: Number(it.sliceLength) || 2,
            sliceHeight: Number(it.sliceHeight) || 4,
            allowancePct: Number(it.allowancePct) || 5,
            pan,
            layers: it.layers || [],
            fillRecipe: { thickMm: 4.5, density: 0.90, wastePct: 0.15 }
          })
          if (pGeom.fillGrams > 0) {
            totals[it.fillingRecipe] = (totals[it.fillingRecipe] || 0) + pGeom.fillGrams
          }
        }
        if (it.topFinishRecipe) {
          const pan = STANDARD_PANS[it.panIndex !== undefined ? it.panIndex : 1] || STANDARD_PANS[1]
          const pGeom = calculatePortionsGeometry({
            servings: Number(it.servings) || 100,
            sliceWidth: Number(it.sliceWidth) || 2,
            sliceLength: Number(it.sliceLength) || 2,
            sliceHeight: Number(it.sliceHeight) || 4,
            allowancePct: Number(it.allowancePct) || 5,
            pan,
            layers: it.layers || [],
            topRecipe: { thickMm: 4.0, density: 1.10, wastePct: 0.10 }
          })
          if (pGeom.topGrams > 0) {
            totals[it.topFinishRecipe] = (totals[it.topFinishRecipe] || 0) + pGeom.topGrams
          }
        }
      }
    })

    return Object.entries(totals).map(([typeName, grams]) => {
      const r = getRecipeByName(typeName)
      const batchGrams = Number(r?.batchWeight) || Number(r?.batch_yield_g) || 0
      const batches = batchGrams > 0 ? (grams / batchGrams).toFixed(2) : null
      return {
        type: typeName,
        grams: Math.round(grams),
        batches
      }
    })
  }, [items, recipes])

  // Individual item suggested / proportional price for quote summary display
  const itemPrices = useMemo(() => {
    if (orderPurpose === "gift" || orderPurpose === "sample") {
      return items.reduce((acc, it) => { acc[it.id] = 0; return acc }, {})
    }
    const effectiveTotal = +salePrice || suggestedPrice || 0
    if (items.length === 0 || effectiveTotal === 0) {
      return items.reduce((acc, it) => { acc[it.id] = 0; return acc }, {})
    }
    if (items.length === 1) {
      return { [items[0].id]: effectiveTotal }
    }

    const costs = items.map(it => calcItemCost(it))
    const totalCostSum = costs.reduce((s, c) => s + c, 0)

    let allocated = 0
    const res = {}
    items.forEach((it, idx) => {
      if (idx === items.length - 1) {
        res[it.id] = Math.max(0, effectiveTotal - allocated)
      } else {
        const ratio = totalCostSum > 0 ? (costs[idx] / totalCostSum) : (1 / items.length)
        const price = Math.round(ratio * effectiveTotal)
        allocated += price
        res[it.id] = price
      }
    })
    return res
  }, [items, inventory, recipes, mults, salePrice, suggestedPrice, orderPurpose, subtotal])

  const getItemPrice = (item) => itemPrices[item?.id] ?? 0

  // Helper to extract the primary inspiration thumbnail for an item
  const getItemThumb = (item) => {
    if (item.photos && item.photos.length > 0) return item.photos[0]
    if (item.photo) return item.photo
    const tierWithPhoto = (item.tiers || []).find(t => (t.photos && t.photos.length > 0) || t.photo)
    if (tierWithPhoto) return tierWithPhoto.photos?.[0] || tierWithPhoto.photo
    return null
  }

  // Delivery details resolver
  const getDeliveryDetails = (item, idx) => {
    if (idx === 0 || !item.sameDeliveryAsFirst) {
      const d = item?.deliveryDate || ""
      const t = item?.collectionTime || ""
      return {
        date: d,
        time: t,
        isSameAsAbove: false,
        text: d ? `${d}${t ? ` @ ${t}` : ""}` : "Date not set"
      }
    }
    const first = items[0]
    const d = first?.deliveryDate || ""
    const t = first?.collectionTime || ""
    return {
      date: d,
      time: t,
      isSameAsAbove: true,
      text: d ? `Same as above (${d}${t ? ` @ ${t}` : ""})` : "Same as above (Date not set)"
    }
  }

  // RENDER CAKE ITEM INTERFACE
  const renderCakeItem = (item, itemIndex) => {
    const itemCost = calcItemCost(item)
    const itemPrice = getItemPrice(item)
    const deliv = getDeliveryDetails(item, itemIndex)

    return (
      <div
        key={item.id}
        style={{
          border: "1.8px solid var(--gold)",
          borderRadius: 16,
          padding: 16,
          marginBottom: 16,
          background: "var(--white, #FFFEFA)",
          boxShadow: "0 4px 12px rgba(0,0,0,0.03)"
        }}
      >
        {/* Item Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {getItemThumb(item) && (
              <img
                src={getItemThumb(item)}
                alt="Inspiration thumbnail"
                onClick={() => setPreviewPhoto(getItemThumb(item))}
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 7,
                  objectFit: "cover",
                  border: "1.5px solid var(--cream-line, #E3D6B3)",
                  cursor: "pointer",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                  display: "block"
                }}
                title="Click to enlarge inspiration photo"
              />
            )}
            <span style={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, fontSize: 16 }}>
              🎂 {item.name || `Item ${itemIndex + 1} — Cake`}
            </span>
            <span style={{ fontSize: 12, color: "var(--gold)", fontWeight: 600 }}>
              • {fmt(itemCost)} cost
            </span>
            <span
              style={{
                fontSize: 11,
                background: deliv.isSameAsAbove ? "#F5F0E4" : (deliv.date ? "#EBF7F0" : "#FAF6EC"),
                color: deliv.isSameAsAbove ? "var(--charcoal-soft, #6B6151)" : (deliv.date ? "#1E6B37" : "var(--muted)"),
                border: "1px solid " + (deliv.date ? "#C2E0CF" : "var(--cream-line, #E3D6B3)"),
                borderRadius: 14,
                padding: "3px 9px",
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: 4
              }}
            >
              <Calendar size={11} /> {deliv.text}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button
              onClick={() => removeItem(item.id)}
              style={{
                background: "none",
                border: "1px solid var(--border)",
                borderRadius: 7,
                padding: "4px 8px",
                color: "#B03A2E",
                fontSize: 11.5,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 3
              }}
            >
              <Trash2 size={12} /> Remove
            </button>
          </div>
        </div>

        {/* Section: Cakes / Tiers */}
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 13.5, fontWeight: 700, margin: "14px 0 8px" }}>
          Cakes
        </div>

        {item.tiers.map((tier, ti) => {
          const totalLayers = (tier.layers || []).reduce((sum, l) => sum + (Number(l.qty) || 1), 0) || 1
          const cakeH = Number(tier.height) > 0 ? Number(tier.height) : (Number(tier.layerHeight) > 0 ? Number(tier.layerHeight) * totalLayers : totalLayers * 2)
          const eachH = cakeH / totalLayers
          const pArea = planArea(tier.shape || "Round", Number(tier.size) || 10, Number(tier.sizeB) || 0)
          const peri = perimeter(tier.shape || "Round", Number(tier.size) || 10, Number(tier.sizeB) || 0)
          const surf = surfaceArea(pArea, peri, cakeH)
          const tc = tierCost(tier)
          return (
            <div
              key={tier.id}
              style={{
                borderLeft: "4px solid var(--gold)",
                background: "var(--cream, #FAF6EC)",
                borderRadius: "0 12px 12px 0",
                padding: "13px 14px",
                marginBottom: 10,
                border: "1px solid var(--cream-line, #E3D6B3)",
                borderLeftWidth: 4,
                borderLeftColor: "var(--gold)"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 6 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>Cake {ti + 1}</div>
                <div style={{ fontSize: 11.5, color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>
                  {Math.round(surf)} in² outside • {Number(cakeH.toFixed(1))}″ tall
                </div>
                {item.tiers.length > 1 && (
                  <button
                    onClick={() => {
                      updateItem(item.id, it => ({
                        ...it,
                        tiers: it.tiers.filter(t => t.id !== tier.id)
                      }))
                    }}
                    style={{ background: "none", border: "none", color: "#B03A2E", fontSize: 11, cursor: "pointer" }}
                  >
                    Remove cake
                  </button>
                )}
              </div>

              {/* Size & Shape */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                <div>
                  <label style={{ display: "block", fontSize: 9.5, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 4 }}>
                    Size
                  </label>
                  <select
                    value={tier.size}
                    onChange={e => {
                      const val = e.target.value
                      updateItem(item.id, it => ({
                        ...it,
                        tiers: it.tiers.map(t => t.id === tier.id ? updateTierGeometry(t, { size: val }) : t)
                      }))
                    }}
                    style={{ ...iSt }}
                  >
                    <option value="">— Select —</option>
                    {PRICING_SIZES.map(s => <option key={s} value={s}>{s}"</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 9.5, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 4 }}>
                    Shape
                  </label>
                  <select
                    value={tier.shape}
                    onChange={e => {
                      const val = e.target.value
                      updateItem(item.id, it => ({
                        ...it,
                        tiers: it.tiers.map(t => t.id === tier.id ? updateTierGeometry(t, { shape: val }) : t)
                      }))
                    }}
                    style={{ ...iSt }}
                  >
                    <option value="">— Select —</option>
                    {["Round", "Square", "Sheet"].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              {/* Layers */}
              <div style={{ marginBottom: 10 }}>
                <label style={{ display: "block", fontSize: 9.5, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 4 }}>
                  Flavours — Cake Recipe per Layer *
                </label>
                {tier.layers.map((l, li) => (
                  <div key={l.id} style={{ display: "grid", gridTemplateColumns: "auto 1fr auto auto auto", gap: 6, alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 11, color: "var(--muted)", minWidth: 46 }}>F{li + 1} (L{li + 1})</span>
                    <select
                      value={l.flavour}
                      onChange={e => {
                        const val = e.target.value
                        updateItem(item.id, it => ({
                          ...it,
                          tiers: it.tiers.map(t => t.id === tier.id ? {
                            ...t,
                            layers: t.layers.map(layer => layer.id === l.id ? { ...layer, flavour: val } : layer)
                          } : t)
                        }))
                      }}
                      style={{ ...iSt }}
                    >
                      <option value="">— Select cake recipe —</option>
                      {(layerRecipes.length > 0 ? layerRecipes : allRecipes).map(r => (
                        <option key={r.id} value={r.name}>
                          {r.name} {!r.cal_grams && !r.calGrams ? "(Uncalibrated)" : ""} {tier.size && tier.shape && layerCost(r.name, tier.size, tier.shape) > 0 ? "— " + fmt(layerCost(r.name, tier.size, tier.shape)) + "/layer" : ""}
                        </option>
                      ))}
                    </select>
                    <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                      <span style={{ fontSize: 12, color: "var(--muted)" }}>×</span>
                      <input
                        type="number"
                        min="1"
                        value={l.qty === undefined ? 1 : l.qty}
                        onChange={e => {
                          const raw = e.target.value
                          const val = raw === "" ? "" : Math.max(1, parseInt(raw) || 1)
                          updateItem(item.id, it => ({
                            ...it,
                            tiers: it.tiers.map(t => t.id === tier.id ? updateTierGeometry(t, {
                              layers: t.layers.map(layer => layer.id === l.id ? { ...layer, qty: val } : layer)
                            }) : t)
                          }))
                        }}
                        onBlur={() => {
                          if (!l.qty || Number(l.qty) < 1) {
                            updateItem(item.id, it => ({
                              ...it,
                              tiers: it.tiers.map(t => t.id === tier.id ? updateTierGeometry(t, {
                                layers: t.layers.map(layer => layer.id === l.id ? { ...layer, qty: 1 } : layer)
                              }) : t)
                            }))
                          }
                        }}
                        style={{ ...iSt, width: 44, textAlign: "center", padding: "6px 2px" }}
                      />
                    </div>
                    <span style={{ fontSize: 11, color: "var(--gold)", whiteSpace: "nowrap" }}>
                      {l.flavour ? fmt(layerCost(l.flavour, tier.size, tier.shape) * (Number(l.qty) || 1)) : ""}
                    </span>
                    {tier.layers.length > 1 ? (
                      <button
                        onClick={() => {
                          updateItem(item.id, it => ({
                            ...it,
                            tiers: it.tiers.map(t => t.id === tier.id ? updateTierGeometry(t, {
                              layers: t.layers.filter(layer => layer.id !== l.id)
                            }) : t)
                          }))
                        }}
                        style={{ width: 22, height: 22, padding: 0, borderRadius: 4, border: "1px solid var(--border)", background: "transparent", cursor: "pointer", fontSize: 12, color: "var(--muted)" }}
                      >
                        ×
                      </button>
                    ) : <span style={{ width: 22 }} />}
                  </div>
                ))}
                <button
                  onClick={() => {
                    updateItem(item.id, it => ({
                      ...it,
                      tiers: it.tiers.map(t => t.id === tier.id ? updateTierGeometry(t, {
                        layers: [...t.layers, { id: uid2(), flavour: t.layers[t.layers.length - 1]?.flavour || "", qty: 1 }]
                      }) : t)
                    }))
                  }}
                  style={{ fontSize: 10.5, color: "var(--gold)", border: "1.2px dashed var(--cream-line, #E3D6B3)", borderRadius: 7, padding: "5px 9px", background: "transparent", cursor: "pointer", marginTop: 2 }}
                >
                  + Add layer
                </button>

                {/* Linked Height Controls */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 9.5, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 4 }}>
                      Cake height (in)
                    </label>
                    <input
                      type="number"
                      step="0.25"
                      min="0.5"
                      value={tier.height !== undefined ? tier.height : Number(cakeH.toFixed(2))}
                      onChange={e => {
                        const v = parseFloat(e.target.value) || 0
                        updateItem(item.id, it => ({
                          ...it,
                          tiers: it.tiers.map(t => t.id === tier.id ? { ...t, height: v, layerHeight: totalLayers > 0 ? +(v / totalLayers).toFixed(2) : 2 } : t)
                        }))
                      }}
                      style={{ ...iSt }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 9.5, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 4 }}>
                      Each layer (in)
                    </label>
                    <input
                      type="number"
                      step="0.25"
                      min="0.25"
                      value={tier.layerHeight !== undefined ? tier.layerHeight : Number(eachH.toFixed(2))}
                      onChange={e => {
                        const v = parseFloat(e.target.value) || 0
                        updateItem(item.id, it => ({
                          ...it,
                          tiers: it.tiers.map(t => t.id === tier.id ? { ...t, layerHeight: v, height: totalLayers > 0 ? +(v * totalLayers).toFixed(2) : 4 } : t)
                        }))
                      }}
                      style={{ ...iSt }}
                    />
                  </div>
                </div>
              </div>

              {/* Fillings */}
              <div style={{ marginBottom: 10 }}>
                <label style={{ display: "block", fontSize: 9.5, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 4 }}>
                  Fillings
                </label>
                {tier.fillings.map(f => {
                  const formulaGrams = computeFormulaFilling(f.type, tier.size, tier.shape, tier.layers)
                  const r = getRecipeByName(f.type)
                  const batchYield = Number(r?.batchWeight) || Number(r?.batch_yield_g) || 0
                  const batchesStr = batchYield > 0 && formulaGrams > 0 ? ` (${(formulaGrams / batchYield).toFixed(2)} batches)` : ""
                  const layerCount = (tier.layers || []).reduce((sum, l) => sum + (Number(l.qty) || 1), 0) || tier.layers?.length || 1
                  const isManual = f.isManual || (f.grams !== undefined && Number(f.grams) !== formulaGrams)

                  return (
                    <div key={f.id} style={{ marginBottom: 6 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: 6, alignItems: "center" }}>
                        <select
                          value={f.type}
                          onChange={e => {
                            const val = e.target.value
                            const nextFormulaGrams = computeFormulaFilling(val, tier.size, tier.shape, tier.layers)
                            updateItem(item.id, it => ({
                              ...it,
                              tiers: it.tiers.map(t => t.id === tier.id ? {
                                ...t,
                                fillings: t.fillings.map(fil => fil.id === f.id ? { ...fil, type: val, grams: nextFormulaGrams, isManual: false } : fil)
                              } : t)
                            }))
                          }}
                          style={{ ...iSt }}
                        >
                          <option value="">— Select filling recipe —</option>
                          {allFillingTypes.map(x => <option key={x} value={x}>{x}</option>)}
                        </select>
                        <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                          <input
                            type="number"
                            value={f.grams}
                            onChange={e => {
                              const val = parseInt(e.target.value) || 0
                              updateItem(item.id, it => ({
                                ...it,
                                tiers: it.tiers.map(t => t.id === tier.id ? {
                                  ...t,
                                  fillings: t.fillings.map(fil => fil.id === f.id ? { ...fil, grams: val, isManual: true } : fil)
                                } : t)
                              }))
                            }}
                            style={{ ...iSt, width: 64, textAlign: "right", padding: "6px" }}
                          />
                          <span style={{ fontSize: 11, color: "var(--muted)" }}>g</span>
                        </div>
                        <span style={{ fontSize: 11, color: "var(--gold)", whiteSpace: "nowrap" }}>
                          {fmt(coverFillCost(f.type, f.grams))}
                        </span>
                        <button
                          onClick={() => {
                            updateItem(item.id, it => ({
                              ...it,
                              tiers: it.tiers.map(t => t.id === tier.id ? {
                                ...t,
                                fillings: t.fillings.filter(fil => fil.id !== f.id)
                              } : t)
                            }))
                          }}
                          style={{ width: 22, height: 22, padding: 0, borderRadius: 4, border: "1px solid var(--border)", background: "transparent", cursor: "pointer", fontSize: 12, color: "var(--muted)" }}
                        >
                          ×
                        </button>
                      </div>

                      {/* Provenance string */}
                      {f.type && (
                        <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 2, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          {isManual ? (
                            <>
                              <span style={{ color: "#B03A2E" }}>Manual override (standard would be {formulaGrams} g)</span>
                              <span>•</span>
                              <button
                                type="button"
                                onClick={() => {
                                  updateItem(item.id, it => ({
                                    ...it,
                                    tiers: it.tiers.map(t => t.id === tier.id ? {
                                      ...t,
                                      fillings: t.fillings.map(fil => fil.id === f.id ? { ...fil, grams: formulaGrams, isManual: false } : fil)
                                    } : t)
                                  }))
                                }}
                                style={{ background: "none", border: "none", padding: 0, color: "var(--gold)", cursor: "pointer", fontSize: 10.5, fontWeight: 600, textDecoration: "underline" }}
                              >
                                Reset
                              </button>
                            </>
                          ) : (
                            <span>
                              Calculated from {tier.size || "10"}" {layerCount}-layer {(tier.shape || "round").toLowerCase()}: {formulaGrams} g{batchesStr} • Edit
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
                <button
                  onClick={() => {
                    const defType = allFillingTypes[0] || "Buttercream"
                    const defGrams = computeFormulaFilling(defType, tier.size, tier.shape, tier.layers)
                    updateItem(item.id, it => ({
                      ...it,
                      tiers: it.tiers.map(t => t.id === tier.id ? {
                        ...t,
                        fillings: [...t.fillings, { id: uid2(), type: defType, grams: defGrams, isManual: false }]
                      } : t)
                    }))
                  }}
                  style={{ fontSize: 10.5, color: "var(--gold)", border: "1.2px dashed var(--cream-line, #E3D6B3)", borderRadius: 7, padding: "5px 9px", background: "transparent", cursor: "pointer", marginTop: 2 }}
                >
                  + Add filling
                </button>
              </div>

              {/* Coverings */}
              <div style={{ marginBottom: 8 }}>
                <label style={{ display: "block", fontSize: 9.5, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 4 }}>
                  Coverings
                </label>
                {tier.coverings.map(c => {
                  const formulaGrams = computeFormulaCovering(c.type, tier.size, tier.shape, tier.layers)
                  const r = getRecipeByName(c.type)
                  const batchYield = Number(r?.batchWeight) || Number(r?.batch_yield_g) || 0
                  const batchesStr = batchYield > 0 && formulaGrams > 0 ? ` (${(formulaGrams / batchYield).toFixed(2)} batches)` : ""
                  const layerCount = (tier.layers || []).reduce((sum, l) => sum + (Number(l.qty) || 1), 0) || tier.layers?.length || 1
                  const isManual = c.isManual || (c.grams !== undefined && Number(c.grams) !== formulaGrams)

                  return (
                    <div key={c.id} style={{ marginBottom: 6 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: 6, alignItems: "center" }}>
                        <select
                          value={c.type}
                          onChange={e => {
                            const val = e.target.value
                            const nextFormulaGrams = computeFormulaCovering(val, tier.size, tier.shape, tier.layers)
                            updateItem(item.id, it => ({
                              ...it,
                              tiers: it.tiers.map(t => t.id === tier.id ? {
                                ...t,
                                coverings: t.coverings.map(cov => cov.id === c.id ? { ...cov, type: val, grams: nextFormulaGrams, isManual: false } : cov)
                              } : t)
                            }))
                          }}
                          style={{ ...iSt }}
                        >
                          <option value="">— Select covering recipe —</option>
                          {allCoveringTypes.map(x => <option key={x} value={x}>{x}</option>)}
                        </select>
                        <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                          <input
                            type="number"
                            value={c.grams}
                            onChange={e => {
                              const val = parseInt(e.target.value) || 0
                              updateItem(item.id, it => ({
                                ...it,
                                tiers: it.tiers.map(t => t.id === tier.id ? {
                                  ...t,
                                  coverings: t.coverings.map(cov => cov.id === c.id ? { ...cov, grams: val, isManual: true } : cov)
                                } : t)
                              }))
                            }}
                            style={{ ...iSt, width: 64, textAlign: "right", padding: "6px" }}
                          />
                          <span style={{ fontSize: 11, color: "var(--muted)" }}>g</span>
                        </div>
                        <span style={{ fontSize: 11, color: "var(--gold)", whiteSpace: "nowrap" }}>
                          {fmt(coverFillCost(c.type, c.grams))}
                        </span>
                        <button
                          onClick={() => {
                            updateItem(item.id, it => ({
                              ...it,
                              tiers: it.tiers.map(t => t.id === tier.id ? {
                                ...t,
                                coverings: t.coverings.filter(cov => cov.id !== c.id)
                              } : t)
                            }))
                          }}
                          style={{ width: 22, height: 22, padding: 0, borderRadius: 4, border: "1px solid var(--border)", background: "transparent", cursor: "pointer", fontSize: 12, color: "var(--muted)" }}
                        >
                          ×
                        </button>
                      </div>

                      {/* Provenance string */}
                      {c.type && (
                        <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 2, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          {isManual ? (
                            <>
                              <span style={{ color: "#B03A2E" }}>Manual override (standard would be {formulaGrams} g)</span>
                              <span>•</span>
                              <button
                                type="button"
                                onClick={() => {
                                  updateItem(item.id, it => ({
                                    ...it,
                                    tiers: it.tiers.map(t => t.id === tier.id ? {
                                      ...t,
                                      coverings: t.coverings.map(cov => cov.id === c.id ? { ...cov, grams: formulaGrams, isManual: false } : cov)
                                    } : t)
                                  }))
                                }}
                                style={{ background: "none", border: "none", padding: 0, color: "var(--gold)", cursor: "pointer", fontSize: 10.5, fontWeight: 600, textDecoration: "underline" }}
                              >
                                Reset
                              </button>
                            </>
                          ) : (
                            <span>
                              Calculated from {tier.size || "10"}" {layerCount}-layer {(tier.shape || "round").toLowerCase()}: {formulaGrams} g{batchesStr} • Edit
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
                <button
                  onClick={() => {
                    const defType = allCoveringTypes[0] || "Buttercream"
                    const defGrams = computeFormulaCovering(defType, tier.size, tier.shape, tier.layers)
                    updateItem(item.id, it => ({
                      ...it,
                      tiers: it.tiers.map(t => t.id === tier.id ? {
                        ...t,
                        coverings: [...t.coverings, { id: uid2(), type: defType, grams: defGrams, isManual: false }]
                      } : t)
                    }))
                  }}
                  style={{ fontSize: 10.5, color: "var(--gold)", border: "1.2px dashed var(--cream-line, #E3D6B3)", borderRadius: 7, padding: "5px 9px", background: "transparent", cursor: "pointer", marginTop: 2 }}
                >
                  + Add covering
                </button>

                {/* Crumb coat warning flag */}
                {(() => {
                  const hasFondantOrWhipped = (tier.coverings || []).some(c => {
                    const n = (c.type || "").toLowerCase()
                    return n.includes("fondant") || n.includes("whipped cream")
                  })
                  const hasCrumb = (tier.coverings || []).some(c => {
                    const n = (c.type || "").toLowerCase()
                    return n.includes("ganache") || n.includes("buttercream")
                  })
                  if (hasFondantOrWhipped && !hasCrumb) {
                    const finName = (tier.coverings || []).find(c => {
                      const n = (c.type || "").toLowerCase()
                      return n.includes("fondant") || n.includes("whipped cream")
                    })?.type || "Outside finish"
                    return (
                      <div style={{ marginTop: 8, background: "#FFF3CD", border: "1.2px solid #856404", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#856404" }}>
                        <strong>🚩 No crumb coat.</strong> {finName} needs something underneath to seal the crumbs. This cake will not hold.
                      </div>
                    )
                  }
                  return null
                })()}
              </div>

              {/* Inspiration Photo for this specific Cake */}
              <TierPhotoGallery
                tier={tier}
                tierNumber={ti + 1}
                onUpdateTier={(updatedTier) => {
                  updateItem(item.id, it => ({
                    ...it,
                    tiers: it.tiers.map(t => t.id === tier.id ? updatedTier : t)
                  }))
                }}
                onPreview={setPreviewPhoto}
              />

              {/* Cake cost line */}
              <div style={{ fontSize: 11.5, fontWeight: 600, marginTop: 8, paddingTop: 8, borderTop: "1px dashed var(--cream-line, #E3D6B3)" }}>
                Cake cost: <b style={{ color: "var(--gold)" }}>{fmt(tc)}</b>
              </div>
            </div>
          )
        })}

        {/* Add another cake tier button */}
        <div
          onClick={() => {
            const addCakeTierLayers = [{ id: uid2(), flavour: item.tiers[item.tiers.length - 1]?.layers?.[0]?.flavour || "", qty: 1 }]
            const defCoverType = allCoveringTypes[0] || "Buttercream"
            const defFillType = allFillingTypes[0] || "Buttercream"
            const addCoverGrams = computeFormulaCovering(defCoverType, "8", "Round", addCakeTierLayers) || 295
            const addFillGrams = computeFormulaFilling(defFillType, "8", "Round", addCakeTierLayers) || 148
            updateItem(item.id, it => ({
              ...it,
              tiers: [
                ...it.tiers,
                {
                  id: uid2(),
                  size: "8",
                  shape: "Round",
                  layers: addCakeTierLayers,
                  coverings: [{ id: uid2(), type: defCoverType, grams: addCoverGrams, isManual: false }],
                  fillings: [{ id: uid2(), type: defFillType, grams: addFillGrams, isManual: false }],
                  photos: [],
                  photo: null
                }
              ]
            }))
          }}
          style={{
            border: "1.4px dashed var(--cream-line, #E3D6B3)",
            borderRadius: 10,
            padding: 9,
            textAlign: "center",
            fontSize: 12,
            color: "var(--gold)",
            fontWeight: 600,
            cursor: "pointer",
            marginBottom: 14
          }}
        >
          + Add cake
        </div>

        {/* Section: Decoration Extras */}
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 13.5, fontWeight: 700, margin: "14px 0 8px" }}>
          Decoration Extras
        </div>
        {Object.keys(item.decQty || {}).map(did => {
          const d = decorations.find(x => x.id === did)
          if (!d) return null
          const it = inventory.find(x => x.id === d.iid)
          const unitCost = it ? it.cost * d.qty : 0
          const qty = item.decQty[did] || 1
          return (
            <div key={did} style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: 8, alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontSize: 12.5, fontWeight: 500 }}>{d.label || d.name}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <button
                  onClick={() => {
                    updateItem(item.id, cur => {
                      const nextQty = { ...cur.decQty }
                      if (qty <= 1) delete nextQty[did]
                      else nextQty[did] = qty - 1
                      return { ...cur, decQty: nextQty }
                    })
                  }}
                  style={{ width: 22, height: 22, padding: 0, fontSize: 13, borderRadius: 4, border: "1px solid var(--border)", background: "var(--panel)", cursor: "pointer" }}
                >
                  -
                </button>
                <span style={{ fontSize: 12, fontWeight: 600, minWidth: 16, textAlign: "center" }}>{qty}</span>
                <button
                  onClick={() => {
                    updateItem(item.id, cur => ({
                      ...cur,
                      decQty: { ...cur.decQty, [did]: qty + 1 }
                    }))
                  }}
                  style={{ width: 22, height: 22, padding: 0, fontSize: 13, borderRadius: 4, border: "1px solid var(--border)", background: "var(--panel)", cursor: "pointer" }}
                >
                  +
                </button>
              </div>
              <span style={{ fontSize: 11.5, color: "var(--gold)", fontWeight: 600 }}>{fmt(unitCost * qty)}</span>
              <button
                onClick={() => {
                  updateItem(item.id, cur => {
                    const nextQty = { ...cur.decQty }
                    delete nextQty[did]
                    return { ...cur, decQty: nextQty }
                  })
                }}
                style={{ width: 22, height: 22, padding: 0, borderRadius: 4, border: "1px solid var(--border)", background: "transparent", cursor: "pointer", fontSize: 12, color: "var(--muted)" }}
              >
                ×
              </button>
            </div>
          )
        })}
        <SearchableSelect
          value=""
          onChange={val => {
            if (val) {
              updateItem(item.id, cur => ({
                ...cur,
                decQty: { ...cur.decQty, [val]: (cur.decQty?.[val] || 0) + 1 }
              }))
            }
          }}
          options={decorations.filter(d => !item.decQty?.[d.id]).map(d => {
            const it = inventory.find(x => x.id === d.iid)
            return {
              value: d.id,
              label: `${d.label || d.name}${it ? ` — ${fmt(it.cost * d.qty)}` : ""}`
            }
          })}
          placeholder="+ Add decoration extra (type to search)…"
        />

        {/* Section: Custom Topper */}
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 13.5, fontWeight: 700, margin: "14px 0 8px" }}>
          Custom Topper
        </div>
        <div style={{ background: "var(--cream, #FAF6EC)", border: "1.4px solid var(--cream-line, #E3D6B3)", borderRadius: 10, padding: "10px 12px", marginBottom: 12 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 500, cursor: "pointer", marginBottom: item.topper?.enabled ? 10 : 0 }}>
            <input
              type="checkbox"
              checked={!!item.topper?.enabled}
              onChange={e => {
                const checked = e.target.checked
                updateItem(item.id, cur => ({
                  ...cur,
                  topper: { ...cur.topper, enabled: checked }
                }))
              }}
              style={{ width: 14, height: 14 }}
            />
            <span>This order has a custom topper</span>
          </label>
          {item.topper?.enabled && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                <Inp
                  label="Making cost (₦)"
                  type="number"
                  value={item.topper.make}
                  onChange={v => updateItem(item.id, cur => ({ ...cur, topper: { ...cur.topper, make: v } }))}
                  placeholder="5000"
                />
                <Inp
                  label="Delivery to shop (₦)"
                  type="number"
                  value={item.topper.deliver}
                  onChange={v => updateItem(item.id, cur => ({ ...cur, topper: { ...cur.topper, deliver: v } }))}
                  placeholder="1500"
                />
              </div>
              <Inp
                label="Topper description"
                value={item.topper.description}
                onChange={v => updateItem(item.id, cur => ({ ...cur, topper: { ...cur.topper, description: v } }))}
                placeholder="e.g. Gold acrylic Mr & Mrs topper..."
              />
            </>
          )}
        </div>

        {/* Section: Design Photos */}
        <ItemPhotoGallery item={item} updateItem={updateItem} onPreview={setPreviewPhoto} />

        {/* Section: Boards & Packaging */}
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 13.5, fontWeight: 700, margin: "14px 0 8px" }}>
          Boards &amp; Packaging
        </div>
        {(item.accRows || []).map(row => {
          const pkg = packagingItems.find(p => p.id === row.itemId)
          const currentPrice = pkg ? pkg.price : (row.price || 0)
          const qty = row.qty !== undefined && row.qty !== "" ? row.qty : 1
          const rowTotal = currentPrice * (Number(qty) || 0)
          return (
            <div key={row.id} style={{ display: "grid", gridTemplateColumns: "1fr 75px auto auto", gap: 8, alignItems: "center", marginBottom: 8 }}>
              <SearchableSelect
                value={row.itemId || ""}
                onChange={val => {
                  const p = packagingItems.find(x => x.id === val)
                  updateItem(item.id, cur => ({
                    ...cur,
                    accRows: cur.accRows.map(r => r.id === row.id ? { ...r, itemId: val, name: p?.name || "", price: p?.price || 0, qty: r.qty !== undefined && r.qty !== "" ? r.qty : 1 } : r)
                  }))
                }}
                options={packagingItems.map(p => ({
                  value: p.id,
                  label: `${p.name} — ${fmt(p.price)}`
                }))}
                placeholder="— Select item (type to search) —"
              />
              <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                <span style={{ fontSize: 12, color: "var(--muted)", userSelect: "none" }}>×</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={row.qty !== undefined ? row.qty : 1}
                  onChange={e => {
                    const val = e.target.value === "" ? "" : Math.max(1, parseInt(e.target.value, 10) || 1)
                    updateItem(item.id, cur => ({
                      ...cur,
                      accRows: cur.accRows.map(r => r.id === row.id ? { ...r, qty: val } : r)
                    }))
                  }}
                  title="Quantity (multiplier)"
                  placeholder="Qty"
                  style={{
                    width: "100%",
                    padding: "6px 4px",
                    fontSize: 12,
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    textAlign: "center"
                  }}
                />
              </div>
              <span style={{ fontSize: 12, color: "var(--gold)", fontWeight: 600, minWidth: 60, textAlign: "right" }}>
                {rowTotal ? fmt(rowTotal) : ""}
              </span>
              <button
                onClick={() => {
                  updateItem(item.id, cur => ({
                    ...cur,
                    accRows: cur.accRows.filter(r => r.id !== row.id)
                  }))
                }}
                style={{ width: 24, height: 24, padding: 0, borderRadius: 5, border: "1px solid var(--border)", background: "transparent", cursor: "pointer", fontSize: 13, color: "var(--muted)" }}
              >
                ×
              </button>
            </div>
          )
        })}
        <button
          onClick={() => {
            updateItem(item.id, cur => ({
              ...cur,
              accRows: [...(cur.accRows || []), { id: uid2(), itemId: "", name: "", price: 0, qty: 1 }]
            }))
          }}
          style={{ fontSize: 11, color: "var(--gold)", border: "1.2px dashed var(--cream-line, #E3D6B3)", borderRadius: 7, padding: "5px 9px", background: "transparent", cursor: "pointer", marginBottom: 14 }}
        >
          + Add board/packaging item
        </button>

        {/* Section: Delivery */}
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 13.5, fontWeight: 700, margin: "14px 0 8px" }}>
          Delivery
        </div>
        {itemIndex > 0 && (
          <div
            style={{
              background: "var(--cream-deep, #F1E8D2)",
              borderRadius: 9,
              padding: "8px 11px",
              marginBottom: 8
            }}
          >
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={item.sameDeliveryAsFirst}
                onChange={e => {
                  const checked = e.target.checked
                  updateItem(item.id, cur => ({
                    ...cur,
                    sameDeliveryAsFirst: checked
                  }))
                }}
                style={{ width: 14, height: 14, accentColor: "var(--gold)" }}
              />
              <span>Same as above (delivery date &amp; time)</span>
            </label>
            {item.sameDeliveryAsFirst && (
              <div style={{ fontSize: 11, color: "var(--muted)", padding: "4px 2px 0" }}>
                → <b style={{ color: "var(--gold)" }}>{items[0]?.deliveryDate ? `${items[0].deliveryDate}${items[0].collectionTime ? " @ " + items[0].collectionTime : ""}` : "Date not set on Item 1"}</b>
              </div>
            )}
          </div>
        )}

        {(!item.sameDeliveryAsFirst || itemIndex === 0) && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <Inp
                label="Date"
                type="date"
                value={item.deliveryDate}
                onChange={v => updateItem(item.id, cur => ({ ...cur, deliveryDate: v }))}
              />
              <Inp
                label="Time"
                type="time"
                value={item.collectionTime}
                onChange={v => updateItem(item.id, cur => ({ ...cur, collectionTime: v }))}
              />
            </div>
            {hasSpecialEvent && parseSpecialDate(clientBirthday).formatted && itemIndex === 0 && (
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4, display: "flex", alignItems: "center", gap: 5 }}>
                <span>Special Event Date: <strong style={{ color: parseSpecialDate(clientBirthday).type === "Anniversary" ? "#8A2BE2" : "var(--gold)" }}>{parseSpecialDate(clientBirthday).formatted}</strong></span>
                <button
                  type="button"
                  onClick={() => {
                    const spec = parseSpecialDate(clientBirthday)
                    const monthIdx = MONTHS.indexOf(spec.month)
                    if (monthIdx >= 0) {
                      const now = new Date()
                      let targetYear = now.getFullYear()
                      const targetDate = new Date(targetYear, monthIdx, Number(spec.day || 1))
                      if (targetDate < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
                        targetYear += 1
                      }
                      const mm = String(monthIdx + 1).padStart(2, "0")
                      const dd = String(spec.day || 1).padStart(2, "0")
                      updateItem(item.id, cur => ({ ...cur, deliveryDate: `${targetYear}-${mm}-${dd}` }))
                    }
                  }}
                  style={{ background: "none", border: "none", color: "var(--gold)", fontSize: 11, cursor: "pointer", textDecoration: "underline", padding: 0 }}
                >
                  (Set as order date)
                </button>
              </div>
            )}
          </div>
        )}

        {/* Section: Item Note */}
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 13.5, fontWeight: 700, margin: "14px 0 8px" }}>
          Item Note
        </div>
        <textarea
          rows={2}
          value={item.itemNote}
          onChange={e => {
            const v = e.target.value
            updateItem(item.id, cur => ({ ...cur, itemNote: v }))
          }}
          placeholder="Colour theme, flavour preferences, message on cake…"
          style={{ ...iSt, height: 60, resize: "vertical", fontFamily: "inherit", fontSize: 12 }}
        />
      </div>
    )
  }

  // RENDER PORTIONS ITEM INTERFACE
  const renderPortionsItem = (item, itemIndex) => {
    const itemCost = calcItemCost(item)
    const deliv = getDeliveryDetails(item, itemIndex)
    const isSlab = (item.route || "slab") === "slab"

    // Pan & geometry calculations
    const selectedPan = STANDARD_PANS[item.panIndex !== undefined ? item.panIndex : 1] || STANDARD_PANS[1]
    const pGeom = calculatePortionsGeometry({
      servings: Number(item.servings) || 100,
      sliceWidth: Number(item.sliceWidth) || 2,
      sliceLength: Number(item.sliceLength) || 2,
      sliceHeight: Number(item.sliceHeight) || 4,
      allowancePct: Number(item.allowancePct) || 5,
      pan: selectedPan,
      layers: (item.layers || [{ flavour: "", qty: 1 }]).map(l => {
        const r = recipes.find(x => x.id === l.flavour || x.name === l.flavour)
        const dens = r && r.cal_grams ? calculateDensity(r.cal_grams, r.cal_shape, r.cal_dim_a, r.cal_dim_b, r.cal_height_in) : 0.8
        const trim = r && r.trim_pct !== undefined ? Number(r.trim_pct) : 0.08
        const cpg = getRecipeCostPerGram(r)
        return { ...l, density: dens, trimPct: trim, costPerGram: cpg, recipe: r }
      }),
      fillRecipe: (() => {
        const r = recipes.find(x => x.id === item.fillingRecipe || x.name === item.fillingRecipe)
        if (!r) return null
        return {
          thickMm: Number(r.thick_fill_mm || r.thickFillMm) || 4.5,
          density: Number(r.density_g_cm3 || r.density) || 0.90,
          wastePct: Number(r.waste_pct || r.wastePct) || 0.15,
          costPerGram: getRecipeCostPerGram(r),
          recipe: r
        }
      })(),
      topRecipe: (() => {
        const r = recipes.find(x => x.id === item.topFinishRecipe || x.name === item.topFinishRecipe)
        if (!r) return null
        return {
          thickMm: Number(r.thick_finish_mm || r.thickFinishMm) || 4.0,
          density: Number(r.density_g_cm3 || r.density) || 1.10,
          wastePct: Number(r.waste_pct || r.wastePct) || 0.10,
          costPerGram: getRecipeCostPerGram(r),
          recipe: r
        }
      })()
    })

    // Counted mode calculation
    const countedRecipe = recipes.find(r => r.id === item.countedRecipeId || r.name === item.countedRecipeId)
    const countedCostEach = countedRecipe
      ? (costPerPiece(countedRecipe.name) || (getRecipeCostPerGram(countedRecipe) * (Number(countedRecipe.per_batch) || 50)))
      : 0
    const countedServings = Number(item.countedServings) || 40
    const countedTotalCost = countedServings * countedCostEach
    const countedBatchSize = Number(countedRecipe?.per_batch) || Number(countedRecipe?.batchSize) || 30
    const countedBatches = countedBatchSize > 0 ? (countedServings / countedBatchSize).toFixed(2) : "0"

    return (
      <div
        key={item.id}
        style={{
          border: "1.8px solid var(--gold)",
          borderRadius: 16,
          padding: 16,
          marginBottom: 16,
          background: "var(--white, #FFFEFA)",
          boxShadow: "0 4px 12px rgba(0,0,0,0.03)"
        }}
      >
        {/* Item Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, fontSize: 16 }}>
              🍰 {item.name || `Item ${itemIndex + 1} — Portions`}
            </span>
            <span style={{ fontSize: 12, color: "var(--gold)", fontWeight: 600 }}>
              • {fmt(itemCost)} cost
            </span>
            <span
              style={{
                fontSize: 11,
                background: deliv.isSameAsAbove ? "#F5F0E4" : (deliv.date ? "#EBF7F0" : "#FAF6EC"),
                color: deliv.isSameAsAbove ? "var(--charcoal-soft, #6B6151)" : (deliv.date ? "#1E6B37" : "var(--muted)"),
                border: "1px solid " + (deliv.date ? "#C2E0CF" : "var(--cream-line, #E3D6B3)"),
                borderRadius: 14,
                padding: "3px 9px",
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: 4
              }}
            >
              <Calendar size={11} /> {deliv.text}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button
              onClick={() => removeItem(item.id)}
              style={{
                background: "none",
                border: "1px solid var(--border)",
                borderRadius: 7,
                padding: "4px 8px",
                color: "#B03A2E",
                fontSize: 11.5,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 3
              }}
            >
              <Trash2 size={12} /> Remove
            </button>
          </div>
        </div>

        {/* Note from spec */}
        <div style={{ background: "var(--cream, #FAF6EC)", border: "1px solid var(--cream-line, #E3D6B3)", borderRadius: 10, padding: "9px 12px", fontSize: 12, color: "var(--text)", marginBottom: 12 }}>
          <strong>This is the order, not a recipe.</strong> The client asked for a number of servings. There are two ways to make them, and the card asks which.
        </div>

        {/* Route Segmented Toggle */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 6 }}>
            How are these made?
          </label>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              onClick={() => updateItem(item.id, cur => ({ ...cur, route: "slab" }))}
              style={{
                flex: 1,
                padding: "9px 8px",
                borderRadius: 9,
                border: isSlab ? "2px solid var(--gold)" : "1px solid var(--cream-line, #E3D6B3)",
                background: isSlab ? "#FEF9EE" : "var(--panel)",
                color: isSlab ? "var(--gold)" : "var(--muted)",
                fontWeight: isSlab ? 700 : 500,
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: 13
              }}
            >
              Cut from a cake
            </button>
            <button
              type="button"
              onClick={() => updateItem(item.id, cur => ({ ...cur, route: "count" }))}
              style={{
                flex: 1,
                padding: "9px 8px",
                borderRadius: 9,
                border: !isSlab ? "2px solid var(--gold)" : "1px solid var(--cream-line, #E3D6B3)",
                background: !isSlab ? "#FEF9EE" : "var(--panel)",
                color: !isSlab ? "var(--gold)" : "var(--muted)",
                fontWeight: !isSlab ? 700 : 500,
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: 13
              }}
            >
              Counted items
            </button>
          </div>
        </div>

        {/* SLAB MODE */}
        {isSlab ? (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: 8, marginBottom: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 9.5, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 4 }}>
                  Servings
                </label>
                <input
                  type="number"
                  min="1"
                  step="10"
                  value={item.servings || 100}
                  onChange={e => updateItem(item.id, cur => ({ ...cur, servings: Math.max(1, parseInt(e.target.value) || 1) }))}
                  style={{ ...iSt }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 9.5, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 4 }}>
                  Slice width (in)
                </label>
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={item.sliceWidth || 2}
                  onChange={e => updateItem(item.id, cur => ({ ...cur, sliceWidth: parseFloat(e.target.value) || 2 }))}
                  style={{ ...iSt }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 9.5, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 4 }}>
                  Slice length (in)
                </label>
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={item.sliceLength || 2}
                  onChange={e => updateItem(item.id, cur => ({ ...cur, sliceLength: parseFloat(e.target.value) || 2 }))}
                  style={{ ...iSt }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 9.5, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 4 }}>
                  Slice height (in)
                </label>
                <input
                  type="number"
                  min="0.5"
                  step="0.25"
                  value={item.sliceHeight || 4}
                  onChange={e => updateItem(item.id, cur => ({ ...cur, sliceHeight: parseFloat(e.target.value) || 4 }))}
                  style={{ ...iSt }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 9.5, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 4 }}>
                  Cutting allowance %
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={item.allowancePct !== undefined ? item.allowancePct : 5}
                  onChange={e => updateItem(item.id, cur => ({ ...cur, allowancePct: parseFloat(e.target.value) || 0 }))}
                  style={{ ...iSt }}
                />
              </div>
            </div>

            {/* Flavours & Layers */}
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--cream-line, #E3D6B3)" }}>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 13.5, fontWeight: 700, marginBottom: 4 }}>
                What it is made of
              </div>
              <label style={{ display: "block", fontSize: 10, color: "var(--muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: ".05em", fontWeight: 600 }}>
                Flavours • how many layers of each
              </label>

              {(item.layers || [{ id: uid2(), flavour: "", qty: 1 }]).map((l, li) => (
                <div key={l.id || li} style={{ display: "grid", gridTemplateColumns: "30px 1fr 64px 32px", gap: 7, alignItems: "center", marginBottom: 7 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>F{li + 1}</span>
                  <select
                    value={l.flavour || ""}
                    onChange={e => {
                      const val = e.target.value
                      updateItem(item.id, cur => ({
                        ...cur,
                        layers: (cur.layers || []).map((layer, idx) => idx === li ? { ...layer, flavour: val } : layer)
                      }))
                    }}
                    style={{ ...iSt }}
                  >
                    <option value="">— Select cake flavour —</option>
                    {(layerRecipes.length > 0 ? layerRecipes : allRecipes).map(r => (
                      <option key={r.id} value={r.name}>{r.name}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={l.qty || 1}
                    onChange={e => {
                      const val = Math.max(1, parseInt(e.target.value) || 1)
                      updateItem(item.id, cur => ({
                        ...cur,
                        layers: (cur.layers || []).map((layer, idx) => idx === li ? { ...layer, qty: val } : layer)
                      }))
                    }}
                    style={{ ...iSt, textAlign: "center" }}
                  />
                  {(item.layers || []).length > 1 ? (
                    <button
                      type="button"
                      onClick={() => updateItem(item.id, cur => ({
                        ...cur,
                        layers: cur.layers.filter((_, idx) => idx !== li)
                      }))}
                      style={{ background: "transparent", border: "1px solid var(--cream-line, #E3D6B3)", borderRadius: 7, color: "#B03A2E", fontSize: 16, cursor: "pointer", height: 38, lineHeight: 1 }}
                    >
                      ×
                    </button>
                  ) : <span />}
                </div>
              ))}

              <button
                type="button"
                onClick={() => updateItem(item.id, cur => ({
                  ...cur,
                  layers: [...(cur.layers || []), { id: uid2(), flavour: "", qty: 1 }]
                }))}
                style={{ background: "none", border: 0, color: "var(--gold)", fontWeight: 700, fontSize: 13, cursor: "pointer", padding: "4px 0", fontFamily: "inherit" }}
              >
                + Add another flavour
              </button>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 9.5, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 4 }}>
                    Filling
                  </label>
                  <select
                    value={item.fillingRecipe || ""}
                    onChange={e => updateItem(item.id, cur => ({ ...cur, fillingRecipe: e.target.value }))}
                    style={{ ...iSt }}
                  >
                    <option value="">None</option>
                    {(fillingRecipes.length > 0 ? fillingRecipes : allFillingTypes.map(name => ({ id: name, name }))).map(r => (
                      <option key={r.id || r.name} value={r.name}>{r.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 9.5, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 4 }}>
                    Top finish
                  </label>
                  <select
                    value={item.topFinishRecipe || ""}
                    onChange={e => updateItem(item.id, cur => ({ ...cur, topFinishRecipe: e.target.value }))}
                    style={{ ...iSt }}
                  >
                    <option value="">None</option>
                    {(finishRecipes.length > 0 ? finishRecipes : allCoveringTypes.map(name => ({ id: name, name }))).map(r => (
                      <option key={r.id || r.name} value={r.name}>{r.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <p style={{ fontSize: 11.5, color: "var(--muted)", margin: "8px 0 0", lineHeight: 1.45 }}>
                {`A slice is ${item.sliceHeight || 4}″ tall with ${pGeom.totalLayers} layer${pGeom.totalLayers > 1 ? "s" : ""} inside, so every layer is cut to ${pGeom.layerThickness.toFixed(2)}″. The height decides the batter and each flavour is weighed by its own calibration. ${pGeom.totalLayers} layers also means ${Math.max(pGeom.totalLayers - 1, 0)} gap${pGeom.totalLayers - 1 === 1 ? "" : "s"} of filling, so the buttercream moves whenever you change the layers.`}
              </p>
            </div>

            {/* Which pan, and how many */}
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--cream-line, #E3D6B3)" }}>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 13.5, fontWeight: 700, marginBottom: 4 }}>
                Which pan, and how many
              </div>
              <label style={{ display: "block", fontSize: 9.5, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 4 }}>
                Pan
              </label>
              <select
                value={item.panIndex !== undefined ? item.panIndex : 1}
                onChange={e => updateItem(item.id, cur => ({ ...cur, panIndex: Number(e.target.value) }))}
                style={{ ...iSt }}
              >
                {STANDARD_PANS.map((p, idx) => (
                  <option key={idx} value={idx}>{p.label}</option>
                ))}
              </select>

              {/* 4 live pan summary chips */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, margin: "10px 0" }}>
                <div style={{ background: "var(--cream, #FAF6EC)", border: "1px solid var(--cream-line, #E3D6B3)", borderRadius: 9, padding: "8px 10px", textAlign: "center" }}>
                  <div style={{ fontSize: 9.5, textTransform: "uppercase", color: "var(--muted)", fontWeight: 700, letterSpacing: ".04em" }}>Slices a slab gives</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "var(--gold)", fontFamily: "'Playfair Display',serif" }}>{pGeom.slicesPerSlab}</div>
                </div>
                <div style={{ background: "var(--cream, #FAF6EC)", border: "1px solid var(--cream-line, #E3D6B3)", borderRadius: 9, padding: "8px 10px", textAlign: "center" }}>
                  <div style={{ fontSize: 9.5, textTransform: "uppercase", color: "var(--muted)", fontWeight: 700, letterSpacing: ".04em" }}>Slabs to build</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "var(--gold)", fontFamily: "'Playfair Display',serif" }}>{pGeom.slabs}</div>
                </div>
                <div style={{ background: "var(--cream, #FAF6EC)", border: "1px solid var(--cream-line, #E3D6B3)", borderRadius: 9, padding: "8px 10px", textAlign: "center" }}>
                  <div style={{ fontSize: 9.5, textTransform: "uppercase", color: "var(--muted)", fontWeight: 700, letterSpacing: ".04em" }}>Pans to bake</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "var(--gold)", fontFamily: "'Playfair Display',serif" }}>{pGeom.totalPans}</div>
                </div>
                <div style={{ background: "var(--cream, #FAF6EC)", border: "1px solid var(--cream-line, #E3D6B3)", borderRadius: 9, padding: "8px 10px", textAlign: "center" }}>
                  <div style={{ fontSize: 9.5, textTransform: "uppercase", color: "var(--muted)", fontWeight: 700, letterSpacing: ".04em" }}>Batter</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "var(--gold)", fontFamily: "'Playfair Display',serif" }}>
                    {pGeom.totalBatterGrams >= 1000 ? (pGeom.totalBatterGrams / 1000).toFixed(2) + " kg" : Math.round(pGeom.totalBatterGrams) + " g"}
                  </div>
                </div>
              </div>

              <p style={{ fontSize: 11.5, color: "var(--muted)", margin: "4px 0 10px", lineHeight: 1.45 }}>
                {`A ${selectedPan.label} cuts ${pGeom.slicesPerSlab} slices at ${item.sliceWidth || 2}″ × ${item.sliceLength || 2}″. ${pGeom.neededServings} needed with the allowance, so ${pGeom.slabs} slab${pGeom.slabs > 1 ? "s" : ""} of ${pGeom.totalLayers} layer${pGeom.totalLayers > 1 ? "s" : ""}, which is ${pGeom.totalPans} pans. The full scaled recipe for each pan prints on the production sheet.`}
              </p>

              {/* What it costs you breakdown table */}
              <div style={{ marginTop: 12, borderTop: "1px solid var(--cream-line, #E3D6B3)", paddingTop: 10 }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--muted)", marginBottom: 8 }}>
                  What it costs you
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                  <tbody>
                    {pGeom.flavourRows.map((fr, idx) => (
                      <tr key={idx} style={{ borderBottom: "1px solid var(--cream-line, #E3D6B3)" }}>
                        <td style={{ padding: "6px 0" }}>
                          <strong>{fr.recipe?.name || `Flavour ${idx + 1}`}</strong>
                          <span style={{ display: "block", fontSize: 11, color: "var(--muted)" }}>
                            {fr.pansForRow} pan{fr.pansForRow > 1 ? "s" : ""} at {Math.round(fr.gramsPerPan)} g • {fr.layerCount} layer{fr.layerCount > 1 ? "s" : ""} of {pGeom.layerThickness.toFixed(2)}″ • {fr.totalGrams >= 1000 ? (fr.totalGrams / 1000).toFixed(2) + " kg" : Math.round(fr.totalGrams) + " g"}
                          </span>
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 600, padding: "6px 0", whiteSpace: "nowrap" }}>
                          {fmt(fr.cost)}
                        </td>
                      </tr>
                    ))}
                    {pGeom.fillCost > 0 && (
                      <tr style={{ borderBottom: "1px solid var(--cream-line, #E3D6B3)" }}>
                        <td style={{ padding: "6px 0" }}>
                          <strong>{pGeom.fillRecipe?.recipe?.name || "Filling"}</strong>
                          <span style={{ display: "block", fontSize: 11, color: "var(--muted)" }}>
                            Filling • {pGeom.fillGrams >= 1000 ? (pGeom.fillGrams / 1000).toFixed(2) + " kg" : Math.round(pGeom.fillGrams) + " g"}
                          </span>
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 600, padding: "6px 0", whiteSpace: "nowrap" }}>
                          {fmt(pGeom.fillCost)}
                        </td>
                      </tr>
                    )}
                    {pGeom.topCost > 0 && (
                      <tr style={{ borderBottom: "1px solid var(--cream-line, #E3D6B3)" }}>
                        <td style={{ padding: "6px 0" }}>
                          <strong>{pGeom.topRecipe?.recipe?.name || "Top finish"}</strong>
                          <span style={{ display: "block", fontSize: 11, color: "var(--muted)" }}>
                            Top finish • {pGeom.topGrams >= 1000 ? (pGeom.topGrams / 1000).toFixed(2) + " kg" : Math.round(pGeom.topGrams) + " g"}
                          </span>
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 600, padding: "6px 0", whiteSpace: "nowrap" }}>
                          {fmt(pGeom.topCost)}
                        </td>
                      </tr>
                    )}
                    <tr style={{ fontWeight: 700, borderTop: "2px solid var(--gold)" }}>
                      <td style={{ padding: "8px 0", color: "var(--gold)" }}>
                        {item.servings || 100} servings • {fmt(pGeom.totalCost / (item.servings || 100))} each
                      </td>
                      <td style={{ textAlign: "right", padding: "8px 0", color: "var(--gold)", fontSize: 14 }}>
                        {fmt(pGeom.totalCost)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          /* COUNTED MODE */
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 9.5, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 4 }}>
                  Servings
                </label>
                <input
                  type="number"
                  min="1"
                  step="5"
                  value={item.countedServings || 40}
                  onChange={e => updateItem(item.id, cur => ({ ...cur, countedServings: Math.max(1, parseInt(e.target.value) || 1) }))}
                  style={{ ...iSt }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 9.5, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 4 }}>
                  Item
                </label>
                <select
                  value={item.countedRecipeId || ""}
                  onChange={e => updateItem(item.id, cur => ({ ...cur, countedRecipeId: e.target.value }))}
                  style={{ ...iSt }}
                >
                  <option value="">— Select item —</option>
                  {(pastryRecipes.length > 0 ? pastryRecipes : allRecipes).map(r => (
                    <option key={r.id} value={r.id || r.name}>{r.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ marginTop: 12, borderTop: "1px solid var(--cream-line, #E3D6B3)", paddingTop: 10 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--muted)", marginBottom: 8 }}>
                What it costs you
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <tbody>
                  <tr style={{ borderBottom: "1px solid var(--cream-line, #E3D6B3)" }}>
                    <td style={{ padding: "6px 0" }}>Cost each</td>
                    <td style={{ textAlign: "right", fontWeight: 600 }}>{fmt(countedCostEach)}</td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid var(--cream-line, #E3D6B3)" }}>
                    <td style={{ padding: "6px 0" }}>Batches to make</td>
                    <td style={{ textAlign: "right", fontWeight: 600 }}>{countedBatches}</td>
                  </tr>
                  <tr style={{ fontWeight: 700, borderTop: "2px solid var(--gold)" }}>
                    <td style={{ padding: "8px 0", color: "var(--gold)" }}>
                      {countedServings} servings
                    </td>
                    <td style={{ textAlign: "right", padding: "8px 0", color: "var(--gold)", fontSize: 14 }}>
                      {fmt(countedTotalCost)}
                    </td>
                  </tr>
                </tbody>
              </table>
              <p style={{ fontSize: 11.5, color: "var(--muted)", margin: "8px 0 0", lineHeight: 1.45 }}>
                Nothing geometric here. The recipe already says how many a batch makes, so the app multiplies.
              </p>
            </div>
          </div>
        )}

        {/* Section: Packaging */}
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 13.5, fontWeight: 700, margin: "16px 0 8px", borderTop: "1px solid var(--cream-line, #E3D6B3)", paddingTop: 12 }}>
          Packaging
        </div>
        {(item.accRows || []).map(r => {
          const pkg = packagingItems.find(p => p.id === r.itemId)
          const unitPrice = pkg ? pkg.price : (r.price || 0)
          const qty = Number(r.qty) > 0 ? Number(r.qty) : 1
          const rowCost = unitPrice * qty

          return (
            <div key={r.id} style={{ display: "grid", gridTemplateColumns: "1fr 50px 70px 24px", gap: 6, alignItems: "center", marginBottom: 6 }}>
              <select
                value={r.itemId}
                onChange={e => {
                  const itm = packagingItems.find(p => p.id === e.target.value)
                  updateItem(item.id, cur => ({
                    ...cur,
                    accRows: cur.accRows.map(x => x.id === r.id ? { ...x, itemId: e.target.value, name: itm?.name || "", price: itm?.price || 0 } : x)
                  }))
                }}
                style={{ ...iSt }}
              >
                <option value="">— Select packaging —</option>
                {packagingItems.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({fmt(p.price)})</option>
                ))}
              </select>
              <input
                type="number"
                min="1"
                value={r.qty}
                onChange={e => {
                  const val = Math.max(1, parseInt(e.target.value) || 1)
                  updateItem(item.id, cur => ({
                    ...cur,
                    accRows: cur.accRows.map(x => x.id === r.id ? { ...x, qty: val } : x)
                  }))
                }}
                style={{ ...iSt, textAlign: "center" }}
              />
              <span style={{ fontSize: 12, color: "var(--gold)", fontWeight: 600, textAlign: "right" }}>
                {fmt(rowCost)}
              </span>
              <button
                type="button"
                onClick={() => updateItem(item.id, cur => ({
                  ...cur,
                  accRows: cur.accRows.filter(x => x.id !== r.id)
                }))}
                style={{ background: "none", border: "1px solid var(--cream-line, #E3D6B3)", borderRadius: 4, color: "var(--muted)", cursor: "pointer", height: 28 }}
              >
                ×
              </button>
            </div>
          )
        })}
        <button
          type="button"
          onClick={() => updateItem(item.id, cur => ({
            ...cur,
            accRows: [...(cur.accRows || []), { id: uid2(), itemId: "", qty: 1 }]
          }))}
          style={{ fontSize: 10.5, color: "var(--gold)", border: "1.2px dashed var(--cream-line, #E3D6B3)", borderRadius: 7, padding: "5px 9px", background: "transparent", cursor: "pointer", marginTop: 2 }}
        >
          + Add packaging item
        </button>

        {/* Section: Delivery Details */}
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 13.5, fontWeight: 700, margin: "14px 0 8px", borderTop: "1px solid var(--cream-line, #E3D6B3)", paddingTop: 12 }}>
          Delivery Details
        </div>
        {itemIndex > 0 && (
          <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, marginBottom: 8, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={item.sameDeliveryAsFirst}
              onChange={e => updateItem(item.id, cur => ({ ...cur, sameDeliveryAsFirst: e.target.checked }))}
            />
            <span>Same as above (delivery date &amp; time)</span>
          </label>
        )}
        {(!itemIndex || !item.sameDeliveryAsFirst) && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Inp
              label="Date"
              type="date"
              value={item.deliveryDate}
              onChange={v => updateItem(item.id, cur => ({ ...cur, deliveryDate: v }))}
            />
            <Inp
              label="Time"
              type="time"
              value={item.collectionTime}
              onChange={v => updateItem(item.id, cur => ({ ...cur, collectionTime: v }))}
            />
          </div>
        )}

        {/* Section: Item Note */}
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 13.5, fontWeight: 700, margin: "14px 0 8px" }}>
          Item Note
        </div>
        <textarea
          rows={2}
          value={item.itemNote}
          onChange={e => {
            const v = e.target.value
            updateItem(item.id, cur => ({ ...cur, itemNote: v }))
          }}
          placeholder="Cutting instructions, packaging preferences, allergy notes…"
          style={{ ...iSt, height: 60, resize: "vertical", fontFamily: "inherit", fontSize: 12 }}
        />
      </div>
    )
  }

  // RENDER PASTRY ITEM INTERFACE
  const renderPastryItem = (item, itemIndex) => {
    const itemCost = calcItemCost(item)
    const itemPrice = getItemPrice(item)
    const deliv = getDeliveryDetails(item, itemIndex)

    return (
      <div
        key={item.id}
        style={{
          border: "1.8px solid var(--gold)",
          borderRadius: 16,
          padding: 16,
          marginBottom: 16,
          background: "var(--white, #FFFEFA)",
          boxShadow: "0 4px 12px rgba(0,0,0,0.03)"
        }}
      >
        {/* Item Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {getItemThumb(item) && (
              <img
                src={getItemThumb(item)}
                alt="Inspiration thumbnail"
                onClick={() => setPreviewPhoto(getItemThumb(item))}
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 7,
                  objectFit: "cover",
                  border: "1.5px solid var(--cream-line, #E3D6B3)",
                  cursor: "pointer",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                  display: "block"
                }}
                title="Click to enlarge inspiration photo"
              />
            )}
            <span style={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, fontSize: 16 }}>
              🍩 {item.name || `Item ${itemIndex + 1} — Pastry`}
            </span>
            <span style={{ fontSize: 12, color: "var(--gold)", fontWeight: 600 }}>
              • {fmt(itemCost)} cost
            </span>
            <span
              style={{
                fontSize: 11,
                background: deliv.isSameAsAbove ? "#F5F0E4" : (deliv.date ? "#EBF7F0" : "#FAF6EC"),
                color: deliv.isSameAsAbove ? "var(--charcoal-soft, #6B6151)" : (deliv.date ? "#1E6B37" : "var(--muted)"),
                border: "1px solid " + (deliv.date ? "#C2E0CF" : "var(--cream-line, #E3D6B3)"),
                borderRadius: 14,
                padding: "3px 9px",
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: 4
              }}
            >
              <Calendar size={11} /> {deliv.text}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button
              onClick={() => removeItem(item.id)}
              style={{
                background: "none",
                border: "1px solid var(--border)",
                borderRadius: 7,
                padding: "4px 8px",
                color: "#B03A2E",
                fontSize: 11.5,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 3
              }}
            >
              <Trash2 size={12} /> Remove
            </button>
          </div>
        </div>

        {/* Pastry list */}
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 13.5, fontWeight: 700, margin: "14px 0 8px" }}>
          Pastries
        </div>
        {item.pastryItems.map((p, pi) => {
          const unitCost = p.flavour ? costPerPiece(p.flavour) : 0
          const itemTotal = (unitCost * (+p.qty || 0)) + (p.filling ? coverFillCost(p.filling, +p.fillingGrams || 0) : 0)

          return (
            <div
              key={p.id}
              style={{
                background: "var(--cream, #FAF6EC)",
                border: "1px solid var(--cream-line, #E3D6B3)",
                borderRadius: 10,
                padding: "12px 14px",
                marginBottom: 10
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ fontWeight: 600, fontSize: 12.5 }}>Pastry Row {pi + 1}</div>
                {item.pastryItems.length > 1 && (
                  <button
                    onClick={() => {
                      updateItem(item.id, cur => ({
                        ...cur,
                        pastryItems: cur.pastryItems.filter(x => x.id !== p.id)
                      }))
                    }}
                    style={{ background: "none", border: "none", color: "#B03A2E", fontSize: 11, cursor: "pointer" }}
                  >
                    Remove
                  </button>
                )}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                <div>
                  <label style={{ display: "block", fontSize: 9.5, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 4 }}>
                    Pastry Recipe *
                  </label>
                  <select
                    value={p.flavour || ""}
                    onChange={e => {
                      const val = e.target.value
                      updateItem(item.id, cur => ({
                        ...cur,
                        pastryItems: cur.pastryItems.map(x => x.id === p.id ? { ...x, flavour: val } : x)
                      }))
                    }}
                    style={{ ...iSt }}
                  >
                    <option value="">— Select pastry recipe —</option>
                    {(pastryRecipes.length > 0 ? pastryRecipes : allRecipes).map(r => (
                      <option key={r.id} value={r.name}>
                        {r.name} {costPerPiece(r.name) > 0 ? "— " + fmt(costPerPiece(r.name)) + " /pc" : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 9.5, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 4 }}>
                    Pieces *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={p.qty || ""}
                    onChange={e => {
                      const val = +e.target.value || 0
                      updateItem(item.id, cur => ({
                        ...cur,
                        pastryItems: cur.pastryItems.map(x => x.id === p.id ? { ...x, qty: val } : x)
                      }))
                    }}
                    style={{ ...iSt }}
                    placeholder="e.g. 12"
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ display: "block", fontSize: 9.5, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 4 }}>
                    Filling / Glaze (optional)
                  </label>
                  <select
                    value={p.filling || ""}
                    onChange={e => {
                      const val = e.target.value
                      updateItem(item.id, cur => ({
                        ...cur,
                        pastryItems: cur.pastryItems.map(x => x.id === p.id ? { ...x, filling: val } : x)
                      }))
                    }}
                    style={{ ...iSt }}
                  >
                    <option value="">— No filling —</option>
                    {allFillingTypes.map(f => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>
                <Inp
                  label="Filling amount (g)"
                  type="number"
                  value={p.fillingGrams || ""}
                  onChange={v => {
                    const val = +v || 0
                    updateItem(item.id, cur => ({
                      ...cur,
                      pastryItems: cur.pastryItems.map(x => x.id === p.id ? { ...x, fillingGrams: val } : x)
                    }))
                  }}
                  placeholder="e.g. 200"
                />
              </div>

              {p.flavour && (
                <div style={{ marginTop: 8, fontSize: 11.5, color: "var(--gold)", fontWeight: 600 }}>
                  Cost: {fmt(itemTotal)} ({p.qty || 0} pcs @ {fmt(unitCost)}/pc{p.filling ? " + filling" : ""})
                </div>
              )}
            </div>
          )
        })}

        <button
          onClick={() => {
            updateItem(item.id, cur => ({
              ...cur,
              pastryItems: [...cur.pastryItems, { id: uid2(), flavour: "", qty: 12, filling: "", fillingGrams: 0 }]
            }))
          }}
          style={{ fontSize: 11, color: "var(--gold)", border: "1.2px dashed var(--cream-line, #E3D6B3)", borderRadius: 7, padding: "5px 9px", background: "transparent", cursor: "pointer", marginBottom: 14 }}
        >
          + Add pastry row
        </button>

        {/* Section: Boards & Packaging */}
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 13.5, fontWeight: 700, margin: "14px 0 8px" }}>
          Boards &amp; Packaging
        </div>
        {(item.accRows || []).map(row => {
          const pkg = packagingItems.find(p => p.id === row.itemId)
          const currentPrice = pkg ? pkg.price : (row.price || 0)
          const qty = row.qty !== undefined && row.qty !== "" ? row.qty : 1
          const rowTotal = currentPrice * (Number(qty) || 0)
          return (
            <div key={row.id} style={{ display: "grid", gridTemplateColumns: "1fr 75px auto auto", gap: 8, alignItems: "center", marginBottom: 8 }}>
              <SearchableSelect
                value={row.itemId || ""}
                onChange={val => {
                  const p = packagingItems.find(x => x.id === val)
                  updateItem(item.id, cur => ({
                    ...cur,
                    accRows: cur.accRows.map(r => r.id === row.id ? { ...r, itemId: val, name: p?.name || "", price: p?.price || 0, qty: r.qty !== undefined && r.qty !== "" ? r.qty : 1 } : r)
                  }))
                }}
                options={packagingItems.map(p => ({
                  value: p.id,
                  label: `${p.name} — ${fmt(p.price)}`
                }))}
                placeholder="— Select item (type to search) —"
              />
              <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                <span style={{ fontSize: 12, color: "var(--muted)", userSelect: "none" }}>×</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={row.qty !== undefined ? row.qty : 1}
                  onChange={e => {
                    const val = e.target.value === "" ? "" : Math.max(1, parseInt(e.target.value, 10) || 1)
                    updateItem(item.id, cur => ({
                      ...cur,
                      accRows: cur.accRows.map(r => r.id === row.id ? { ...r, qty: val } : r)
                    }))
                  }}
                  title="Quantity (multiplier)"
                  placeholder="Qty"
                  style={{
                    width: "100%",
                    padding: "6px 4px",
                    fontSize: 12,
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    textAlign: "center"
                  }}
                />
              </div>
              <span style={{ fontSize: 12, color: "var(--gold)", fontWeight: 600, minWidth: 60, textAlign: "right" }}>
                {rowTotal ? fmt(rowTotal) : ""}
              </span>
              <button
                onClick={() => {
                  updateItem(item.id, cur => ({
                    ...cur,
                    accRows: cur.accRows.filter(r => r.id !== row.id)
                  }))
                }}
                style={{ width: 24, height: 24, padding: 0, borderRadius: 5, border: "1px solid var(--border)", background: "transparent", cursor: "pointer", fontSize: 13, color: "var(--muted)" }}
              >
                ×
              </button>
            </div>
          )
        })}
        <button
          onClick={() => {
            updateItem(item.id, cur => ({
              ...cur,
              accRows: [...(cur.accRows || []), { id: uid2(), itemId: "", name: "", price: 0, qty: 1 }]
            }))
          }}
          style={{ fontSize: 11, color: "var(--gold)", border: "1.2px dashed var(--cream-line, #E3D6B3)", borderRadius: 7, padding: "5px 9px", background: "transparent", cursor: "pointer", marginBottom: 14 }}
        >
          + Add board/packaging item
        </button>

        {/* Section: Design Photos for Pastry */}
        <ItemPhotoGallery item={item} updateItem={updateItem} onPreview={setPreviewPhoto} />

        {/* Delivery for Pastry */}
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 13.5, fontWeight: 700, margin: "14px 0 8px" }}>
          Delivery
        </div>
        {itemIndex > 0 && (
          <div style={{ background: "var(--cream-deep, #F1E8D2)", borderRadius: 9, padding: "8px 11px", marginBottom: 8 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={item.sameDeliveryAsFirst}
                onChange={e => {
                  const checked = e.target.checked
                  updateItem(item.id, cur => ({ ...cur, sameDeliveryAsFirst: checked }))
                }}
                style={{ width: 14, height: 14, accentColor: "var(--gold)" }}
              />
              <span>Same as above (delivery date &amp; time)</span>
            </label>
            {item.sameDeliveryAsFirst && (
              <div style={{ fontSize: 11, color: "var(--muted)", padding: "4px 2px 0" }}>
                → <b style={{ color: "var(--gold)" }}>{items[0]?.deliveryDate ? `${items[0].deliveryDate}${items[0].collectionTime ? " @ " + items[0].collectionTime : ""}` : "Date not set on Item 1"}</b>
              </div>
            )}
          </div>
        )}

        {(!item.sameDeliveryAsFirst || itemIndex === 0) && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
            <Inp
              label="Date"
              type="date"
              value={item.deliveryDate}
              onChange={v => updateItem(item.id, cur => ({ ...cur, deliveryDate: v }))}
            />
            <Inp
              label="Time"
              type="time"
              value={item.collectionTime}
              onChange={v => updateItem(item.id, cur => ({ ...cur, collectionTime: v }))}
            />
          </div>
        )}

        {/* Section: Item Note */}
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 13.5, fontWeight: 700, margin: "14px 0 8px" }}>
          Item Note
        </div>
        <textarea
          rows={2}
          value={item.itemNote}
          onChange={e => {
            const v = e.target.value
            updateItem(item.id, cur => ({ ...cur, itemNote: v }))
          }}
          placeholder="Pastry flavours, packaging preferences, allergy notes…"
          style={{ ...iSt, height: 60, resize: "vertical", fontFamily: "inherit", fontSize: 12 }}
        />
      </div>
    )
  }

  // Handle Save Quote
  const handleSaveQuote = async () => {
    if (isSavingQuoteRef.current || isSavingQuote) return

    if (!isEdit) {
      const limitCheck = typeof checkPlanLimit === "function" ? checkPlanLimit("ordersPerMonth") : { exceeded: false }
      if (limitCheck.exceeded) {
        if (typeof notifyPlanLimitReached === "function") {
          notifyPlanLimitReached(limitCheck)
        }
        return
      }
    }

    const isGS = orderPurpose === "gift" || orderPurpose === "sample"
    if (!isGS && !clientName.trim()) {
      alert("Please enter a client name at the top of the page.")
      return
    }
    if (!items || items.length === 0) {
      alert("Please add at least one item.")
      return
    }

    // Verify cake items have at least one layer recipe
    const incompleteCake = items.find(it => it.type === "cake" && !it.tiers?.some(t => t.layers?.some(l => l.flavour)))
    if (incompleteCake) {
      alert(`Please select at least one cake flavour for ${incompleteCake.name || "cake"}.`)
      return
    }

    // Immediately provide visual feedback and disable further clicks synchronously
    isSavingQuoteRef.current = true
    setIsSavingQuote(true)
    setSaveQuoteError(null)

    try {
      // Derived summaries
      const cakeTiers = items.filter(it => it.type === "cake").flatMap(it => it.tiers || [])
      const allPastryItems = items.filter(it => it.type === "pastry").flatMap(it => it.pastryItems || [])
      const allDecQty = items.reduce((acc, it) => ({ ...acc, ...(it.decQty || {}) }), {})
      const allAccRows = items.flatMap(it => it.accRows || [])
      const activeTopper = items.find(it => it.topper?.enabled)?.topper || { enabled: false, make: "", deliver: "", description: "" }

      const itemSummaries = items.map((it, idx) => {
        if (it.type === "portions") {
          if (it.route === "count") {
            return `${it.name || `Item ${idx + 1}`}: ${it.countedServings || 40} counted servings`
          }
          const pan = STANDARD_PANS[it.panIndex !== undefined ? it.panIndex : 1] || STANDARD_PANS[1]
          return `${it.name || `Item ${idx + 1}`}: ${it.servings || 100} slices (${pan.label})`
        } else if (it.type === "cake") {
          const tSum = (it.tiers || []).map(t => `${t.size}" ${t.shape} (${t.layers?.map(l => (l.qty > 1 ? l.qty + "×" : "") + (l.flavour || "?")).join("/")})`).join(" + ")
          return `${it.name || `Item ${idx + 1}`}: ${tSum || "Cake"}`
        } else {
          const pSum = (it.pastryItems || []).map(p => `${p.qty || 0}× ${p.flavour || "Pastry"}`).join(", ")
          return `${it.name || `Item ${idx + 1}`}: ${pSum || "Pastry"}`
        }
      })

      const allFlavours = [
        ...new Set([
          ...cakeTiers.flatMap(t => t.layers?.map(l => l.flavour)).filter(Boolean),
          ...allPastryItems.map(p => p.flavour).filter(Boolean)
        ])
      ]

      const co = loadCompany()
      const primaryDeliveryDate = items[0]?.deliveryDate || (isGS ? new Date().toISOString().slice(0, 10) : "")
      const primaryCollectionTime = items[0]?.collectionTime || ""

      // Format items with resolved delivery dates and photo arrays
      const formattedItems = items.map((it, idx) => {
        const deliv = getDeliveryDetails(it, idx)
        return {
          ...it,
          price: getItemPrice(it),
          deliveryDate: deliv.date,
          collectionTime: deliv.time,
          deliveryDetailsText: deliv.text,
          sameDeliveryAsFirst: idx > 0 ? !!it.sameDeliveryAsFirst : false,
          photos: it.photos || (it.photo ? [it.photo] : []),
          photo: it.photos?.[0] || it.photo || null
        }
      })

      const hasMultiDeliveryDates = items.some((it, idx) => idx > 0 && !it.sameDeliveryAsFirst && it.deliveryDate && it.deliveryDate !== items[0]?.deliveryDate)

      const quote = {
        id: isEdit && editId ? editId : uid(),
        clientName: clientName.trim() || (isGS ? (orderPurpose === "gift" ? "Gift" : "Sample/Tasting") : "Walk-in"),
        clientPhone,
        clientBirthday: hasSpecialEvent ? clientBirthday : "",
        hasSpecialEvent: !!hasSpecialEvent,
        date: new Date().toISOString().slice(0, 10),
        items: formattedItems,
        hasMultiDeliveryDates,
        deliveryDates: formattedItems.map(it => it.deliveryDate).filter(Boolean),
        // Backward compatibility fields for QuotesPage, Invoices, ProductionList, and sync:
        productType: items.some(i => i.type === "portions")
          ? "Portions"
          : (items.some(i => i.type === "cake") && items.some(i => i.type === "pastry") ? "Cake & Pastry" : (items.some(i => i.type === "cake") ? "Cake" : "Pastry")),
        orderHours,
        overheadMethod,
        accessoriesPct,
        rushPct,
        seasonPct,
        chargeAmount,
        tiers: cakeTiers,
        pastryItems: allPastryItems,
        donutGroups: allPastryItems.map(p => ({ flavour: p.flavour, qty: p.qty, filling: p.filling, fillingGrams: p.fillingGrams })),
        loaves: allPastryItems.map(p => ({ id: p.id, flavour: p.flavour })),
        tartQty: allPastryItems.reduce((sum, p) => sum + (p.qty || 0), 0),
        tartFillings: allPastryItems.map(p => ({ type: p.filling, grams: p.fillingGrams })),
        decQty: allDecQty,
        accRows: allAccRows,
        topper: activeTopper,
        cakePhoto: items.find(it => (it.photos && it.photos.length > 0) || it.photo || it.tiers?.some(t => t.photo || t.photos?.length))?.photo ||
          items.flatMap(it => it.tiers || []).find(t => (t.photos && t.photos.length > 0) || t.photo)?.photos?.[0] || null,
        cakePhotos: [
          ...items.flatMap(it => (it.photos && it.photos.length > 0) ? it.photos : (it.photo ? [it.photo] : [])),
          ...items.flatMap(it => (it.tiers || []).flatMap(t => (t.photos && t.photos.length > 0) ? t.photos : (t.photo ? [t.photo] : [])))
        ],
        cakeSummary: itemSummaries.join(" | "),
        flavourSummary: allFlavours.join(", "),
        deliveryDate: primaryDeliveryDate,
        collectionTime: primaryCollectionTime,
        notes: [generalNote, ...items.map((it, idx) => it.itemNote ? `[${it.name || `Item ${idx + 1}`}]: ${it.itemNote}` : "").filter(Boolean)].join("\n\n"),
        generalNote,
        eventType,
        totalCost,
        quotePrice: suggestedPrice,
        salePrice: isGS ? 0 : (+salePrice || suggestedPrice),
        orderPurpose,
        deliveryCharge: delivCharge,
        vatEnabled,
        vatRate,
        vatAmount,
        grandTotal,
        margin,
        status: "pending",
        isProd: false,
        fromQuote: false,
        quoteId: null,
        confirmedAt: null,
        bankName: co.bankName || "",
        bankAccount: co.bankAccount || "",
        bankAccountName: co.bankAccountName || "",
        businessName: co.name || "Bakery"
      }

      const existing = loadQuotes()
      const updated = isEdit && editId
        ? existing.map(q => q.id === editId ? { ...quote, id: editId, status: q.status || "pending", confirmedAt: q.confirmedAt || null, isProd: false } : q)
        : [quote, ...existing]
      
      await saveQuotes(updated)

      if (clientName && clientName.trim()) {
        upsertClient(clientName, clientPhone, "", "", generalNote, hasSpecialEvent ? clientBirthday : "").catch(console.error)
      }

      // Keep snapshot of the saved quote so WhatsApp and Quotes links remain accessible
      setLastSavedQuote(quote)
      setQuoteSaved(true)

      // Automatically clear the calculator so the user can insert fresh new details immediately
      resetCalculator(false)
    } catch (saveErr) {
      console.error("Quote save prevented:", saveErr)
      setSaveQuoteError(saveErr.message || "Failed to save quote. Please try again.")
      alert("Failed to save quote: " + (saveErr.message || "Please check your network and try again."))
    } finally {
      isSavingQuoteRef.current = false
      setIsSavingQuote(false)
    }
  }

  // WhatsApp sender (uses saved quote snapshot if available, falling back to current form inputs)
  const handleSendWhatsApp = (targetQuote = lastSavedQuote) => {
    const q = targetQuote || {
      clientPhone,
      clientName,
      items,
      generalNote,
      grandTotal
    }
    const rawPhone = q.clientPhone || ""
    const phone = rawPhone.replace(/[^0-9]/g, "").replace(/^0/, "234")
    const co = loadCompany()

    const qItems = q.items || items || []
    const itemBlocks = qItems.map((it, idx) => {
      const price = it.price !== undefined ? it.price : getItemPrice(it)
      const delivText = it.deliveryDetailsText || getDeliveryDetails(it, idx).text
      const delivLine = `\n  📅 Delivery: ${delivText}`
      const photoLine = (it.photos?.length || it.photo) ? `\n  🖼️ Inspiration: ${(it.photos?.length || 1)} photo${(it.photos?.length || 1) > 1 ? "s" : ""} attached` : ""

      if (it.type === "cake") {
        const tierLines = (it.tiers || []).map((t, ti) =>
          `  • Cake ${ti + 1}: ${t.size}" ${t.shape} - ${t.layers?.map(l => (l.qty > 1 ? l.qty + "× " : "") + (l.flavour || "?")).join("/")}${t.coverings?.length ? " (" + t.coverings.map(c => c.type).join(", ") + ")" : ""}`
        ).join("\n")
        const noteLine = it.itemNote ? `\n  • Note: ${it.itemNote}` : ""
        return `🎂 ${it.name || `Item ${idx + 1} — Cake`} (₦${price.toLocaleString()}):${delivLine}${photoLine}\n${tierLines}${noteLine}`
      } else {
        const pLines = (it.pastryItems || []).map(p =>
          `  • ${p.qty}× ${p.flavour || "Pastry"}${p.filling ? ` (${p.filling} filling)` : ""}`
        ).join("\n")
        const noteLine = it.itemNote ? `\n  • Note: ${it.itemNote}` : ""
        return `🍩 ${it.name || `Item ${idx + 1} — Pastry`} (₦${price.toLocaleString()}):${delivLine}${photoLine}\n${pLines}${noteLine}`
      }
    }).join("\n\n")

    const genNotePart = q.generalNote ? `\n\nGeneral note: ${q.generalNote}` : ""
    const hasMultipleDates = qItems.some((it, idx) => idx > 0 && !it.sameDeliveryAsFirst && it.deliveryDate && it.deliveryDate !== qItems[0]?.deliveryDate)
    const deliveryPart = hasMultipleDates
      ? `\n\n📅 Delivery Schedule: Multi-date delivery (see individual cake dates above)`
      : (qItems[0]?.deliveryDate ? `\n\n📅 Delivery / Collection: ${qItems[0].deliveryDate}${qItems[0].collectionTime ? ` @ ${qItems[0].collectionTime}` : ""}` : "")

    const totalToDisplay = q.grandTotal !== undefined ? q.grandTotal : grandTotal
    const msg = `Hello ${q.clientName || "there"}! Here is your quote from ${co.name || "our bakery"}:\n\n${itemBlocks}${deliveryPart}${genNotePart}\n\n━━━━━━━━━━━━━━━━━━━━\nTotal: ₦${totalToDisplay.toLocaleString()}\n━━━━━━━━━━━━━━━━━━━━\n\nPlease confirm to proceed. Deposit required. Thank you for choosing ${co.name || "us"}!`

    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank")
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <SHead
          title="Order Calculator"
          sub="Build a multi-cake & pastry quote for your client — all items consolidated into one unified quote and invoice."
        />
        <button
          type="button"
          onClick={() => resetCalculator(true)}
          title="Clear all calculator fields and start a fresh quote"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "#FAF6EC",
            border: "1.2px solid var(--cream-line, #E3D6B3)",
            color: "var(--gold)",
            padding: "8px 14px",
            borderRadius: 8,
            fontSize: 12.5,
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 0.15s"
          }}
        >
          <RotateCcw size={14} /> Clear / New Quote
        </button>
      </div>

      {/* TOP NOTIFICATION BANNER IF QUOTA EXCEEDED */}
      {quoteLimitCheck?.exceeded && !isEdit && (
        <div style={{
          marginBottom: 16,
          background: "#FFF4E5",
          border: "1.5px solid #FFE2B8",
          borderRadius: 10,
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 10
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#8A4E00" }}>
            <AlertTriangle size={18} color="#D97706" style={{ flexShrink: 0 }} />
            <span>
              <strong>Monthly Order &amp; Quote Quota Reached:</strong> You have recorded {quoteLimitCheck.currentCount} of {quoteLimitCheck.limit} orders/quotes on the Free plan this month.
            </span>
          </div>
          <Btn
            small
            onClick={() => {
              if (typeof notifyPlanLimitReached === "function") {
                notifyPlanLimitReached(quoteLimitCheck)
              }
            }}
          >
            Upgrade to Standard
          </Btn>
        </div>
      )}

      {/* TOP NOTIFICATION BANNER AFTER SAVING */}
      {quoteSaved && lastSavedQuote && (
        <div style={{
          marginBottom: 16,
          background: "#E1F5EE",
          border: "1.5px solid #A3E0C8",
          borderRadius: 10,
          padding: "12px 16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 10
        }}>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: "#085041", display: "flex", alignItems: "center", gap: 6 }}>
              <Check size={16} /> Quote saved for {lastSavedQuote.clientName}!
            </div>
            <div style={{ fontSize: 12, color: "#145A46", marginTop: 2 }}>
              Total: <strong>{fmt(lastSavedQuote.grandTotal)}</strong>. Calculator has been cleared for your next order.
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={() => handleSendWhatsApp(lastSavedQuote)}
              style={{
                padding: "6px 12px",
                borderRadius: 7,
                border: "none",
                background: "#25D366",
                color: "#fff",
                cursor: "pointer",
                fontSize: 12,
                fontFamily: "inherit",
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: 5
              }}
            >
              <MessageCircle size={14} /> Send via WhatsApp
            </button>
            <button
              onClick={() => setView("quotes")}
              style={{
                padding: "6px 12px",
                borderRadius: 7,
                border: "none",
                background: "var(--gold)",
                color: "#fff",
                cursor: "pointer",
                fontSize: 12,
                fontFamily: "inherit",
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: 5
              }}
            >
              <ClipboardList size={14} /> View in Quotes
            </button>
            <button
              onClick={() => { setQuoteSaved(false); setLastSavedQuote(null); }}
              style={{
                padding: "6px 10px",
                borderRadius: 7,
                border: "1px solid #B8DEC9",
                background: "transparent",
                color: "#085041",
                cursor: "pointer",
                fontSize: 12,
                fontFamily: "inherit"
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* CLIENT DETAILS BLOCK */}
      <Card style={{ marginBottom: 16, background: "var(--cream, #FAF6EC)", border: "1.4px solid var(--cream-line, #E3D6B3)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--gold)" }}>
              Client Details
            </span>
            {autoFilledBadge && (
              <span style={{ fontSize: 11, background: "#E1F5EE", color: "#085041", padding: "2px 8px", borderRadius: 12, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}>
                <Check size={11} /> Auto-filled from saved clients
              </span>
            )}
          </div>
          {savedClients.length > 0 && (
            <select
              style={{
                fontSize: 12,
                padding: "4px 8px",
                borderRadius: 6,
                border: "1px solid var(--cream-line, #E3D6B3)",
                background: "#fff",
                color: "var(--gold)",
                fontWeight: 500,
                cursor: "pointer",
                outline: "none"
              }}
              value=""
              onChange={e => {
                const picked = savedClients.find(c => c.id === e.target.value)
                if (picked) selectClient(picked)
              }}
            >
              <option value="">Choose saved client ({savedClients.length})...</option>
              {savedClients.map(c => {
                const spec = parseSpecialDate(c.birthday)
                return (
                  <option key={c.id} value={c.id}>
                    {c.name} {spec.formatted ? `(${spec.type}: ${spec.formatted})` : ""} {c.phone ? `(${c.phone})` : ""}
                  </option>
                )
              })}
            </select>
          )}
        </div>

        {/* 3-COLUMN MAIN CLIENT DETAILS GRID */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.4fr 1fr 1.1fr", gap: 8, marginBottom: 6 }}>
          <div style={{ position: "relative" }}>
            <Inp
              label="Client Name *"
              value={clientName}
              onChange={v => {
                setClientName(v)
                autoSave({ clientName: v })
                setShowClientSuggestions(true)
              }}
              placeholder="Mrs Iye Achem"
            />
            {showClientSuggestions && clientSuggestions.length > 0 && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  right: 0,
                  background: "#fff",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  boxShadow: "0 6px 16px rgba(0,0,0,0.12)",
                  zIndex: 100,
                  overflow: "hidden",
                  marginTop: 2
                }}
              >
                <div style={{ padding: "4px 10px", fontSize: 10.5, fontWeight: 600, color: "var(--muted)", background: "#FAF7F0", borderBottom: "1px solid var(--border)", textTransform: "uppercase" }}>
                  Matching saved clients:
                </div>
                {clientSuggestions.map(c => {
                  const spec = parseSpecialDate(c.birthday)
                  return (
                    <div
                      key={c.id}
                      onMouseDown={e => {
                        e.preventDefault()
                        selectClient(c)
                      }}
                      style={{
                        padding: "8px 12px",
                        cursor: "pointer",
                        borderBottom: "1px solid #f0f0f0",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontSize: 12.5,
                        transition: "background 0.15s"
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = "#FFF9EE"}
                      onMouseLeave={e => e.currentTarget.style.background = "#fff"}
                    >
                      <span style={{ fontWeight: 600, color: "var(--text)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <span>{c.name}</span>
                        {spec.formatted && (
                          <span style={{ fontSize: 11, color: spec.type === "Anniversary" ? "#8A2BE2" : "#995C00", marginLeft: 6, display: "inline-flex", alignItems: "center", gap: 3 }}>
                            {spec.type === "Anniversary" ? <Heart size={10} /> : <Cake size={10} />}
                            <span>{spec.type}: {spec.formatted}</span>
                          </span>
                        )}
                      </span>
                      <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{c.phone || "No phone"}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <Inp
            label="Phone (WhatsApp)"
            value={clientPhone}
            onChange={v => { setClientPhone(v); autoSave({ clientPhone: v }) }}
            placeholder="+234..."
          />

          <Sel
            label="Event Type"
            value={eventType}
            onChange={v => { setEventType(v); autoSave({ eventType: v }) }}
            options={[{ value: "", label: "— Select event —" }, ...EVENT_TYPES.map(e => ({ value: e, label: e }))]}
          />
        </div>

        {/* SPECIAL EVENT OPTIONAL TOGGLE & RECORD SELECTOR */}
        <div
          style={{
            marginTop: 4,
            marginBottom: 8,
            padding: "8px 12px",
            borderRadius: 8,
            background: hasSpecialEvent ? "rgba(200,145,42,0.06)" : "var(--panel)",
            border: hasSpecialEvent ? "1.5px solid var(--gold)" : "1px solid var(--border)",
            transition: "all 0.2s ease"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12.5, fontWeight: 600, color: hasSpecialEvent ? "var(--gold)" : "var(--text)", userSelect: "none" }}>
              <input
                type="checkbox"
                checked={hasSpecialEvent}
                onChange={e => {
                  const checked = e.target.checked
                  setHasSpecialEvent(checked)
                  if (!checked) {
                    setClientBirthday("")
                    autoSave({ hasSpecialEvent: false, clientBirthday: "" })
                  } else {
                    const savedDate = selectedClientRecord?.birthday || ""
                    if (savedDate) {
                      setClientBirthday(savedDate)
                      autoSave({ hasSpecialEvent: true, clientBirthday: savedDate })
                    } else {
                      autoSave({ hasSpecialEvent: true })
                    }
                  }
                }}
                style={{ width: 16, height: 16, accentColor: "var(--gold)", cursor: "pointer" }}
              />
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <CalendarHeart size={15} />
                <span>Special Event <span style={{ fontWeight: 400, color: "var(--muted)", fontSize: 11 }}>(Optional — tick if this order is for client's Birthday or Anniversary)</span></span>
              </span>
            </label>

            {/* Quick helper when client has a saved record but checkbox is not yet ticked */}
            {!hasSpecialEvent && selectedClientRecord?.birthday && (
              <button
                type="button"
                onClick={() => {
                  setHasSpecialEvent(true)
                  setClientBirthday(selectedClientRecord.birthday)
                  autoSave({ hasSpecialEvent: true, clientBirthday: selectedClientRecord.birthday })
                }}
                style={{
                  fontSize: 11,
                  color: "#8A2BE2",
                  background: "#F5EEFD",
                  border: "1px solid #E0C8F8",
                  borderRadius: 6,
                  padding: "3px 8px",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  fontWeight: 600
                }}
                title="Tick and select client's saved date"
              >
                {parseSpecialDate(selectedClientRecord.birthday).type === "Anniversary" ? <Heart size={11} /> : <Cake size={11} />}
                <span>Client has on record: {parseSpecialDate(selectedClientRecord.birthday).formatted} (Click to apply)</span>
              </button>
            )}
          </div>

          {/* EXPANDED SPECIAL EVENT CONTROLS WHEN TICKED */}
          {hasSpecialEvent && (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px dashed rgba(200,145,42,0.3)" }}>
              {(() => {
                const spec = parseSpecialDate(clientBirthday)
                const curType = spec.type || "Birthday"
                const curMonth = spec.month || ""
                const curDay = spec.day || ""

                const setType = (newType) => {
                  const updated = formatSpecialDate(newType, curDay, curMonth)
                  setClientBirthday(updated)
                  autoSave({ clientBirthday: updated })
                }

                const setMonth = (newMonth) => {
                  const updated = formatSpecialDate(curType, curDay, newMonth)
                  setClientBirthday(updated)
                  autoSave({ clientBirthday: updated })
                }

                const setDay = (newDay) => {
                  const updated = formatSpecialDate(curType, newDay, curMonth)
                  setClientBirthday(updated)
                  autoSave({ clientBirthday: updated })
                }

                return (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexWrap: "wrap", gap: 6 }}>
                      <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--muted)" }}>
                        Select Occasion &amp; Date (No Year)
                      </span>

                      {/* Option to select directly from client's saved record */}
                      {selectedClientRecord?.birthday && (
                        <button
                          type="button"
                          onClick={() => {
                            setClientBirthday(selectedClientRecord.birthday)
                            autoSave({ clientBirthday: selectedClientRecord.birthday })
                          }}
                          style={{
                            fontSize: 10.5,
                            color: "#8A2BE2",
                            background: "#F5EEFD",
                            border: "1px solid #E0C8F8",
                            borderRadius: 6,
                            padding: "2px 7px",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            fontWeight: 600
                          }}
                          title="Click to reset to client profile record"
                        >
                          {parseSpecialDate(selectedClientRecord.birthday).type === "Anniversary" ? <Heart size={10} /> : <Cake size={10} />}
                          <span>Select from client record: {parseSpecialDate(selectedClientRecord.birthday).formatted}</span>
                        </button>
                      )}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.4fr 1.2fr 1fr", gap: 8, alignItems: "center" }}>
                      {/* Birthday / Anniversary selector buttons */}
                      <div style={{ display: "flex", gap: 4 }}>
                        {SPECIAL_DATE_TYPES.map(t => {
                          const active = curType === t.value
                          return (
                            <button
                              key={t.value}
                              type="button"
                              onClick={() => setType(t.value)}
                              style={{
                                flex: 1,
                                padding: "6px 8px",
                                borderRadius: 6,
                                border: active ? "1.5px solid var(--gold)" : "1px solid var(--border)",
                                background: active ? "rgba(200,145,42,0.18)" : "var(--panel)",
                                color: active ? "var(--text)" : "var(--muted)",
                                fontWeight: active ? 700 : 500,
                                fontSize: 11.5,
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 5
                              }}
                            >
                              {t.value === "Anniversary" ? <Heart size={12} /> : <Cake size={12} />}
                              <span>{t.label}</span>
                            </button>
                          )
                        })}
                      </div>

                      <select
                        value={curMonth}
                        onChange={e => setMonth(e.target.value)}
                        style={{ ...iSt, padding: "7px 6px", fontSize: 12 }}
                        title="Special Date Month (No Year)"
                      >
                        <option value="">Month</option>
                        {MONTHS.map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>

                      <select
                        value={curDay}
                        onChange={e => setDay(e.target.value)}
                        style={{ ...iSt, padding: "7px 6px", fontSize: 12 }}
                        title="Special Date Day (No Year)"
                      >
                        <option value="">Day</option>
                        {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>

                    {spec.formatted && (
                      <div style={{ fontSize: 11, color: curType === "Anniversary" ? "#8A2BE2" : "var(--gold)", fontWeight: 600, marginTop: 6, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          {curType === "Anniversary" ? <Heart size={12} /> : <Cake size={12} />}
                          <span>Special Event: {curType} on {spec.formatted}</span>
                        </div>
                        {items[0] && (
                          <button
                            type="button"
                            onClick={() => {
                              if (spec.day && spec.month) {
                                const monthIdx = MONTHS.indexOf(spec.month)
                                if (monthIdx >= 0) {
                                  const now = new Date()
                                  let targetYear = now.getFullYear()
                                  const targetDate = new Date(targetYear, monthIdx, Number(spec.day || 1))
                                  if (targetDate < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
                                    targetYear += 1
                                  }
                                  const mm = String(monthIdx + 1).padStart(2, "0")
                                  const dd = String(spec.day || 1).padStart(2, "0")
                                  const dateStr = `${targetYear}-${mm}-${dd}`
                                  updateItem(items[0].id, cur => ({ ...cur, deliveryDate: dateStr }))
                                }
                              }
                            }}
                            style={{ background: "none", border: "none", color: "var(--gold)", fontSize: 11, cursor: "pointer", textDecoration: "underline", padding: 0 }}
                          >
                            Set as Item 1 delivery date ({spec.formatted})
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>
          )}
        </div>

        {/* GENERAL NOTE — APPLIES TO THE WHOLE ORDER */}
        <div style={{ marginTop: 8 }}>
          <label style={{ display: "block", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--gold)", marginBottom: 4 }}>
            General Note <span style={{ fontWeight: 400, textTransform: "none", color: "var(--muted)" }}>(applies to the whole order)</span>
          </label>
          <textarea
            rows={2}
            value={generalNote}
            onChange={e => {
              const val = e.target.value
              setGeneralNote(val)
              autoSave({ generalNote: val })
            }}
            placeholder="e.g. Deliver to the same address, gate code 4521"
            style={{ ...iSt, height: 50, resize: "vertical", fontFamily: "inherit", fontSize: 12 }}
          />
        </div>
      </Card>

      {/* TOP ADD ITEM BUTTON */}
      <div ref={itemPickerRef} style={{ marginBottom: 14 }}>
        {!showItemPicker ? (
          <button
            onClick={() => setShowItemPicker(true)}
            style={{
              width: "100%",
              border: "1.6px dashed var(--gold-pale, #E7C77E)",
              borderRadius: 12,
              padding: items.length === 0 ? "20px 16px" : 12,
              textAlign: "center",
              color: "var(--gold)",
              fontWeight: 700,
              fontSize: items.length === 0 ? 14 : 13,
              background: "#FFFBF0",
              cursor: "pointer",
              fontFamily: "inherit",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 4
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Plus size={16} /> Add Item
            </span>
            {items.length === 0 && (
              <span style={{ fontSize: 11.5, fontWeight: 400, color: "var(--muted)" }}>
                Choose Cake or Pastry to start building this quote
              </span>
            )}
          </button>
        ) : (
          <Card style={{ background: "#FFF9EE", borderColor: "var(--gold)", marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, textAlign: "center" }}>
              What item are you adding?
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <button
                onClick={() => addItem("cake")}
                style={{
                  padding: "16px 12px",
                  borderRadius: 10,
                  border: "1.5px solid var(--gold)",
                  background: "var(--panel)",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center"
                }}
              >
                <Cake size={26} color="var(--gold)" style={{ marginBottom: 6 }} />
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--gold)" }}>Cake</div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>Sizes, layers, tiers, fillings</div>
              </button>
              <button
                onClick={() => addItem("portions")}
                style={{
                  padding: "16px 12px",
                  borderRadius: 10,
                  border: "1.5px solid var(--gold)",
                  background: "var(--panel)",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center"
                }}
              >
                <Cake size={26} color="var(--gold)" style={{ marginBottom: 6 }} />
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--gold)" }}>Portions</div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>Slices, slabs, counted servings</div>
              </button>
              <button
                onClick={() => addItem("pastry")}
                style={{
                  padding: "16px 12px",
                  borderRadius: 10,
                  border: "1.5px solid var(--gold)",
                  background: "var(--panel)",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center"
                }}
              >
                <Cookie size={26} color="var(--gold)" style={{ marginBottom: 6 }} />
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--gold)" }}>Pastry</div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>Donuts, loaves, tarts &amp; more</div>
              </button>
            </div>
            <div style={{ textAlign: "center", marginTop: 10 }}>
              <button
                onClick={() => setShowItemPicker(false)}
                style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}
              >
                Cancel
              </button>
            </div>
          </Card>
        )}
      </div>

      {/* TWO COLUMN WORKSPACE: LEFT = ITEMS, RIGHT = QUOTE SUMMARY */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.35fr 0.65fr", gap: 18 }}>
        <div>
          {/* RENDER ALL ITEMS */}
          {items.map((item, idx) => (
            item.type === "portions"
              ? renderPortionsItem(item, idx)
              : item.type === "cake"
                ? renderCakeItem(item, idx)
                : renderPastryItem(item, idx)
          ))}

          {/* BOTTOM ADD ITEM BUTTON (only shows when items exist) */}
          {items.length > 0 && (
            <div style={{ marginTop: 8, marginBottom: 20 }}>
              <button
                onClick={() => {
                  setShowItemPicker(true)
                  setTimeout(() => {
                    if (itemPickerRef.current) {
                      if (typeof itemPickerRef.current.scrollIntoView === "function") {
                        itemPickerRef.current.scrollIntoView({ behavior: "smooth", block: "center" })
                      }
                      itemPickerRef.current.style.transition = "box-shadow 0.3s ease"
                      itemPickerRef.current.style.boxShadow = "0 0 0 4px rgba(246, 174, 19, 0.45)"
                      setTimeout(() => {
                        if (itemPickerRef.current) itemPickerRef.current.style.boxShadow = "none"
                      }, 1400)
                    }
                  }, 50)
                }}
                style={{
                  width: "100%",
                  border: "1.6px dashed var(--gold-pale, #E7C77E)",
                  borderRadius: 12,
                  padding: 12,
                  textAlign: "center",
                  color: "var(--gold)",
                  fontWeight: 700,
                  fontSize: 13,
                  background: "#FFFBF0",
                  cursor: "pointer",
                  fontFamily: "inherit"
                }}
              >
                + Add Item
              </button>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: STICKY QUOTE SUMMARY */}
        <div>
          <Card style={{ position: "sticky", top: 16, background: "var(--panel)" }}>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 15, fontWeight: 700, marginBottom: 12 }}>
              Quote Summary
            </div>

            {/* ITEM-BY-ITEM SUMMARY TABLE */}
            {items.length === 0 ? (
              <div
                style={{
                  background: "var(--cream-deep, #F1E8D2)",
                  borderRadius: 12,
                  padding: "24px 14px",
                  marginBottom: 14,
                  border: "1px solid var(--cream-line, #E3D6B3)",
                  textAlign: "center",
                  color: "var(--muted)"
                }}
              >
                <Cake size={28} color="var(--gold-pale, #E7C77E)" style={{ marginBottom: 6 }} />
                <div style={{ fontWeight: 600, fontSize: 13, color: "var(--charcoal)" }}>No items added yet</div>
                <div style={{ fontSize: 11.5, marginTop: 3 }}>Click <b>+ Add Item</b> above to select Cake or Pastry.</div>
              </div>
            ) : (
              <div
                style={{
                  background: "var(--cream-deep, #F1E8D2)",
                  borderRadius: 12,
                  padding: "10px 12px",
                  marginBottom: 14,
                  border: "1px solid var(--cream-line, #E3D6B3)"
                }}
              >
                {items.map((it, idx) => {
                  const iPrice = getItemPrice(it)
                  const desc = it.type === "portions"
                    ? (it.route === "count" ? `${it.countedServings || 40} servings (counted)` : `${it.servings || 100} slices (${STANDARD_PANS[it.panIndex !== undefined ? it.panIndex : 1]?.label || "tray"})`)
                    : it.type === "cake"
                      ? (it.tiers?.[0]?.size ? `${it.tiers[0].size}" ${it.tiers[0].shape || "Round"} Cake` : "Cake")
                      : (it.pastryItems?.[0]?.flavour ? `${it.pastryItems[0].qty || 12} pcs ${it.pastryItems[0].flavour}` : "Pastry")
                  const deliv = getDeliveryDetails(it, idx)
                  const thumb = getItemThumb(it)

                  return (
                    <div
                      key={it.id}
                      style={{
                        display: "flex",
                        gap: 9,
                        alignItems: "center",
                        padding: "8px 0",
                        fontSize: 12.5,
                        borderTop: idx > 0 ? "1px dashed var(--cream-line, #E3D6B3)" : "none"
                      }}
                    >
                      {/* Item Image Thumbnail */}
                      {thumb ? (
                        <img
                          src={thumb}
                          alt=""
                          onClick={() => setPreviewPhoto(thumb)}
                          style={{ width: 34, height: 34, borderRadius: 6, objectFit: "cover", flexShrink: 0, border: "1px solid var(--cream-line, #E3D6B3)", cursor: "pointer" }}
                          title="Click to preview"
                        />
                      ) : (
                        <div
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: 6,
                            background: "#E8DEC5",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 16,
                            flexShrink: 0
                          }}
                        >
                          {it.type === "portions" ? "🍰" : it.type === "cake" ? "🎂" : "🍩"}
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                          <span style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {it.name || `Item ${idx + 1}`}
                          </span>
                          <span style={{ fontWeight: 700, color: "var(--gold)", marginLeft: 6, flexShrink: 0 }}>{fmt(iPrice)}</span>
                        </div>
                        <div style={{ fontSize: 11, color: "var(--muted)" }}>{desc}</div>
                        <div style={{ fontSize: 10.5, color: deliv.isSameAsAbove ? "var(--charcoal-soft, #6B6151)" : (deliv.date ? "#1E6B37" : "var(--muted)"), fontWeight: 500, marginTop: 1, display: "flex", alignItems: "center", gap: 3 }}>
                          <Calendar size={10} /> {deliv.text}
                        </div>
                      </div>
                    </div>
                  )
                })}
                {delivCharge > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--muted)", paddingTop: 5 }}>
                    <span>Delivery</span>
                    <span>{fmt(delivCharge)}</span>
                  </div>
                )}
                {vatAmount > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--muted)", paddingTop: 3 }}>
                    <span>VAT ({vatRate}%)</span>
                    <span>{fmt(vatAmount)}</span>
                  </div>
                )}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontWeight: 700,
                    paddingTop: 8,
                    marginTop: 4,
                    borderTop: "1.4px solid var(--gold-pale, #E7C77E)",
                    fontSize: 13.5
                  }}
                >
                  <span>Total (one invoice)</span>
                  <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, color: "var(--gold)" }}>
                    {fmt(grandTotal)}
                  </span>
                </div>
              </div>
            )}

            {/* ORDER-LEVEL SETTINGS & OVERHEAD */}
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10, marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--muted)", marginBottom: 8 }}>
                Order Settings &amp; Overhead
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                <div>
                  <label style={{ display: "block", fontSize: 9.5, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 3 }}>
                    Hours
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={orderHours}
                    onChange={e => {
                      const v = parseFloat(e.target.value) || 0
                      setOrderHours(v)
                      autoSave({ orderHours: v })
                    }}
                    style={{ ...iSt }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 9.5, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 3 }}>
                    Accessories %
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={accessoriesPct}
                    onChange={e => {
                      const v = parseFloat(e.target.value) || 0
                      setAccessoriesPct(v)
                      autoSave({ accessoriesPct: v })
                    }}
                    style={{ ...iSt }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                <div>
                  <label style={{ display: "block", fontSize: 9.5, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 3 }}>
                    Rush %
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="5"
                    value={rushPct}
                    onChange={e => {
                      const v = parseFloat(e.target.value) || 0
                      setRushPct(v)
                      autoSave({ rushPct: v })
                    }}
                    style={{ ...iSt }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 9.5, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 3 }}>
                    Season %
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="5"
                    value={seasonPct}
                    onChange={e => {
                      const v = parseFloat(e.target.value) || 0
                      setSeasonPct(v)
                      autoSave({ seasonPct: v })
                    }}
                    style={{ ...iSt }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 6 }}>
                <label style={{ display: "block", fontSize: 9.5, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 4 }}>
                  Overhead Method
                </label>
                <div style={{ display: "flex", gap: 4 }}>
                  {[["pct", "Percentage"], ["hr", "Per hour"], ["ord", "Per order"]].map(([k, label]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => {
                        setOverheadMethod(k)
                        autoSave({ overheadMethod: k })
                      }}
                      style={{
                        flex: 1,
                        padding: "6px 2px",
                        borderRadius: 6,
                        border: (overheadMethod || "pct") === k ? "2px solid var(--gold)" : "1px solid var(--border)",
                        background: (overheadMethod || "pct") === k ? "#FEF9EE" : "var(--panel)",
                        color: (overheadMethod || "pct") === k ? "var(--gold)" : "var(--muted)",
                        fontWeight: (overheadMethod || "pct") === k ? 700 : 500,
                        cursor: "pointer",
                        fontSize: 11,
                        fontFamily: "inherit"
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p style={{ fontSize: 11, color: "var(--muted)", margin: "4px 0 0", lineHeight: 1.4 }}>
                  {overheadMethod === "pct"
                    ? "27% of cost. What the app does today. Overcharges ingredient-heavy jobs, undercharges time-heavy ones."
                    : overheadMethod === "hr"
                      ? `${orderHours} hours × ₦${Math.round(costStack.hourlyRate).toLocaleString()}, from your shop costs ÷ 1,800 production hours a year`
                      : `₦${Math.round(costStack.perOrderRate).toLocaleString()} per order, from your monthly overhead ÷ orders per month.`}
                </p>
              </div>
            </div>

            {/* DETAILED COST BREAKDOWN (Itemized Table matching Artifact 1 & 2) */}
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10, marginBottom: 12 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontVariantNumeric: "tabular-nums", fontSize: 12.5 }}>
                <tbody>
                  {directBreakdown.batterCost > 0 && (
                    <tr>
                      <td style={{ padding: "4px 0", borderBottom: "1px solid var(--border)" }}>
                        <div style={{ fontWeight: 500, color: "var(--text)" }}>Batter</div>
                        {directBreakdown.batterNotes && <div style={{ fontSize: 11, color: "var(--muted)" }}>{directBreakdown.batterNotes}</div>}
                      </td>
                      <td style={{ padding: "4px 0", borderBottom: "1px solid var(--border)", textAlign: "right", fontWeight: 500, whiteSpace: "nowrap" }}>
                        {fmt(directBreakdown.batterCost)}
                      </td>
                    </tr>
                  )}
                  {directBreakdown.fillingCost > 0 && (
                    <tr>
                      <td style={{ padding: "4px 0", borderBottom: "1px solid var(--border)" }}>
                        <div style={{ fontWeight: 500, color: "var(--text)" }}>Filling</div>
                        {directBreakdown.fillingNotes && <div style={{ fontSize: 11, color: "var(--muted)" }}>{directBreakdown.fillingNotes}</div>}
                      </td>
                      <td style={{ padding: "4px 0", borderBottom: "1px solid var(--border)", textAlign: "right", fontWeight: 500, whiteSpace: "nowrap" }}>
                        {fmt(directBreakdown.fillingCost)}
                      </td>
                    </tr>
                  )}
                  {directBreakdown.crumbCost > 0 && (
                    <tr>
                      <td style={{ padding: "4px 0", borderBottom: "1px solid var(--border)" }}>
                        <div style={{ fontWeight: 500, color: "var(--text)" }}>Crumb coat</div>
                        {directBreakdown.crumbNotes && <div style={{ fontSize: 11, color: "var(--muted)" }}>{directBreakdown.crumbNotes}</div>}
                      </td>
                      <td style={{ padding: "4px 0", borderBottom: "1px solid var(--border)", textAlign: "right", fontWeight: 500, whiteSpace: "nowrap" }}>
                        {fmt(directBreakdown.crumbCost)}
                      </td>
                    </tr>
                  )}
                  {directBreakdown.finishCost > 0 && (
                    <tr>
                      <td style={{ padding: "4px 0", borderBottom: "1px solid var(--border)" }}>
                        <div style={{ fontWeight: 500, color: "var(--text)" }}>Finish</div>
                        {directBreakdown.finishNotes && <div style={{ fontSize: 11, color: "var(--muted)" }}>{directBreakdown.finishNotes}</div>}
                      </td>
                      <td style={{ padding: "4px 0", borderBottom: "1px solid var(--border)", textAlign: "right", fontWeight: 500, whiteSpace: "nowrap" }}>
                        {fmt(directBreakdown.finishCost)}
                      </td>
                    </tr>
                  )}
                  {directBreakdown.portionsCost > 0 && (
                    <tr>
                      <td style={{ padding: "4px 0", borderBottom: "1px solid var(--border)" }}>
                        <div style={{ fontWeight: 500, color: "var(--text)" }}>Portions</div>
                        {directBreakdown.portionsNotes && <div style={{ fontSize: 11, color: "var(--muted)" }}>{directBreakdown.portionsNotes}</div>}
                      </td>
                      <td style={{ padding: "4px 0", borderBottom: "1px solid var(--border)", textAlign: "right", fontWeight: 500, whiteSpace: "nowrap" }}>
                        {fmt(directBreakdown.portionsCost)}
                      </td>
                    </tr>
                  )}
                  {directBreakdown.pastryCost > 0 && (
                    <tr>
                      <td style={{ padding: "4px 0", borderBottom: "1px solid var(--border)" }}>
                        <div style={{ fontWeight: 500, color: "var(--text)" }}>Pastry &amp; Desserts</div>
                        {directBreakdown.pastryNotes && <div style={{ fontSize: 11, color: "var(--muted)" }}>{directBreakdown.pastryNotes}</div>}
                      </td>
                      <td style={{ padding: "4px 0", borderBottom: "1px solid var(--border)", textAlign: "right", fontWeight: 500, whiteSpace: "nowrap" }}>
                        {fmt(directBreakdown.pastryCost)}
                      </td>
                    </tr>
                  )}
                  {directBreakdown.decorCost > 0 && (
                    <tr>
                      <td style={{ padding: "4px 0", borderBottom: "1px solid var(--border)" }}>
                        <div style={{ fontWeight: 500, color: "var(--text)" }}>Decoration extras</div>
                        {directBreakdown.decorNotes && <div style={{ fontSize: 11, color: "var(--muted)" }}>{directBreakdown.decorNotes}</div>}
                      </td>
                      <td style={{ padding: "4px 0", borderBottom: "1px solid var(--border)", textAlign: "right", fontWeight: 500, whiteSpace: "nowrap" }}>
                        {fmt(directBreakdown.decorCost)}
                      </td>
                    </tr>
                  )}
                  {directBreakdown.pkgToppCost > 0 && (
                    <tr>
                      <td style={{ padding: "4px 0", borderBottom: "1px solid var(--border)", color: "var(--text)", fontWeight: 500 }}>
                        Toppers and packaging
                      </td>
                      <td style={{ padding: "4px 0", borderBottom: "1px solid var(--border)", textAlign: "right", fontWeight: 500, whiteSpace: "nowrap" }}>
                        {fmt(directBreakdown.pkgToppCost)}
                      </td>
                    </tr>
                  )}
                  <tr style={{ fontWeight: 600, borderBottom: "2px solid var(--border)" }}>
                    <td style={{ padding: "6px 0" }}>Direct cost</td>
                    <td style={{ padding: "6px 0", textAlign: "right", whiteSpace: "nowrap" }}>{fmt(subtotal)}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: "4px 0", borderBottom: "1px solid var(--border)", color: "var(--muted)" }}>
                      Accessories {accessoriesPct}%
                    </td>
                    <td style={{ padding: "4px 0", borderBottom: "1px solid var(--border)", textAlign: "right", whiteSpace: "nowrap", color: "var(--muted)" }}>
                      {fmt(accessoryAmount)}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: "4px 0", borderBottom: "1px solid var(--border)", color: "var(--muted)" }}>
                      <div>Overhead</div>
                      <div style={{ fontSize: 10.5, color: "var(--muted)" }}>
                        {overheadMethod === "hr" ? `${orderHours} hours` : overheadMethod === "ord" ? "per order" : `${settings?.overheadPct || 27}% of cost`}
                      </div>
                    </td>
                    <td style={{ padding: "4px 0", borderBottom: "1px solid var(--border)", textAlign: "right", whiteSpace: "nowrap", color: "var(--muted)" }}>
                      {fmt(overheadAmount)}
                    </td>
                  </tr>
                  <tr style={{ fontWeight: 600, borderBottom: "2px solid var(--border)" }}>
                    <td style={{ padding: "6px 0" }}>Total cost</td>
                    <td style={{ padding: "6px 0", textAlign: "right", whiteSpace: "nowrap" }}>{fmt(totalCost)}</td>
                  </tr>
                </tbody>
              </table>

              {/* BATCH SUMMARY FOR BAKER'S PREP */}
              {prepBatchSummary.length > 0 && (
                <div style={{ marginTop: 8, padding: "8px 10px", background: "#F5F0E4", borderRadius: 8, border: "1px solid var(--border)", fontSize: 11.5 }}>
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 4 }}>
                    Prep / Batch Summary
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    {prepBatchSummary.map(b => (
                      <div key={b.type} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                        <span style={{ color: "var(--text)", fontWeight: 500 }}>{b.type}</span>
                        <span style={{ color: "var(--gold)", fontWeight: 600 }}>
                          {b.batches ? `${b.batches} batches (${b.grams}g)` : `${b.grams}g`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* PROFIT MARGIN SLIDER */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 10, color: "var(--muted)", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: .8 }}>
                Profit margin
              </label>
              <input
                type="range"
                min={10}
                max={80}
                value={margin}
                onChange={e => {
                  const m = +e.target.value
                  setMargin(m)
                  autoSave({ margin: m })
                }}
                style={{ width: "100%", accentColor: "var(--gold)", marginBottom: 4 }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--muted)" }}>
                <span>10%</span>
                <span style={{ color: "var(--gold)", fontWeight: 600 }}>{margin}%</span>
                <span>80%</span>
              </div>
            </div>

            {/* SUGGESTED PRICE CARD */}
            <div style={{ background: suggestedPrice > 0 ? "#E8F5EE" : "#F5F0E4", border: `1px solid ${suggestedPrice > 0 ? "#C2E0CF" : "var(--border)"}`, borderRadius: 10, padding: "10px 12px", textAlign: "center", marginBottom: 10 }}>
              <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: .8, marginBottom: 2 }}>
                Suggested price (Charge client rounded to 500)
              </div>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, fontWeight: 700, color: "var(--gold)" }}>
                {fmt(chargeAmount || suggestedPrice)}
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                Base Price: {fmt(suggestedPrice)} • Profit: {fmt(profit)} ({margin}% margin)
                {(rushPct > 0 || seasonPct > 0) && ` • Rush/Season: +${fmt(Math.round(costStack.surcharges))}`}
              </div>
            </div>

            {/* ORDER PURPOSE */}
            <div style={{ margin: "4px 0 12px" }}>
              <label style={{ fontSize: 10, color: "var(--muted)", display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: .8, fontWeight: 500 }}>
                Order Purpose
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 5 }}>
                {[["sale", "Sale"], ["gift", "Gift"], ["sample", "Sample"]].map(([v, l]) => (
                  <button
                    key={v}
                    onClick={() => {
                      setOrderPurpose(v)
                      autoSave({ orderPurpose: v })
                    }}
                    style={{
                      padding: "7px 4px",
                      borderRadius: 7,
                      border: orderPurpose === v ? "2px solid var(--gold)" : "1px solid var(--border)",
                      background: orderPurpose === v ? "#FEF9EE" : "var(--panel)",
                      color: orderPurpose === v ? "var(--gold)" : "var(--muted)",
                      fontSize: 12,
                      fontWeight: orderPurpose === v ? 600 : 400,
                      cursor: "pointer",
                      fontFamily: "inherit"
                    }}
                  >
                    {l}
                  </button>
                ))}
              </div>
              {(orderPurpose === "gift" || orderPurpose === "sample") && (
                <div style={{ background: "#F0EAFC", borderRadius: 8, padding: "8px 10px", marginTop: 8, fontSize: 11.5, color: "#6B32A0", lineHeight: 1.5 }}>
                  {orderPurpose === "gift" ? "Gift" : "Sample/Tasting"} — no revenue recorded, but ingredients ({fmt(totalCost)}) will be deducted from inventory.
                </div>
              )}
            </div>

            {/* ACTUAL SALE PRICE */}
            {orderPurpose === "sale" && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 10, color: "var(--muted)", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: .8, fontWeight: 500 }}>
                  Actual sale price (₦) — what you charge
                </label>
                <input
                  type="number"
                  value={salePrice}
                  onChange={e => {
                    const v = e.target.value
                    setSalePrice(v)
                    autoSave({ salePrice: v })
                  }}
                  placeholder={"e.g. " + suggestedPrice}
                  style={{ ...iSt, fontSize: 16, fontWeight: 600, color: "var(--gold)", textAlign: "center" }}
                />
              </div>
            )}

            {/* DELIVERY + VAT */}
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10, marginBottom: 12 }}>
              <div style={{ marginBottom: 8 }}>
                <label style={{ fontSize: 10, color: "var(--muted)", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: .8, fontWeight: 500 }}>
                  Delivery Charge (₦) — paid by client
                </label>
                <input
                  type="number"
                  value={deliveryCharge}
                  onChange={e => {
                    const v = e.target.value
                    setDeliveryCharge(v)
                    autoSave({ deliveryCharge: v })
                  }}
                  placeholder="0"
                  style={{ ...iSt }}
                />
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={vatEnabled}
                  onChange={e => {
                    const v = e.target.checked
                    setVatEnabled(v)
                    autoSave({ vatEnabled: v })
                  }}
                />
                Add VAT
                {vatEnabled && (
                  <input
                    type="number"
                    value={vatRate}
                    onChange={e => {
                      const v = +e.target.value || 0
                      setVatRate(v)
                      autoSave({ vatRate: v })
                    }}
                    style={{ width: 50, padding: "3px 6px", border: "1px solid var(--border)", borderRadius: 5, fontSize: 11.5, fontFamily: "inherit", textAlign: "center" }}
                  />
                )}
                {vatEnabled && <span style={{ fontSize: 11.5, color: "var(--muted)" }}>%</span>}
              </label>
            </div>

            {/* GRAND TOTAL */}
            {orderPurpose === "sale" && (delivCharge > 0 || vatAmount > 0) && (
              <div style={{ background: "#FEF9EE", border: "1px solid var(--gold)", borderRadius: 10, padding: "10px 12px", marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                  <span style={{ color: "var(--muted)" }}>Items price</span>
                  <span>{fmt(cakePrice)}</span>
                </div>
                {delivCharge > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                    <span style={{ color: "var(--muted)" }}>Delivery</span>
                    <span>{fmt(delivCharge)}</span>
                  </div>
                )}
                {vatAmount > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                    <span style={{ color: "var(--muted)" }}>VAT ({vatRate}%)</span>
                    <span>{fmt(vatAmount)}</span>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 15, paddingTop: 5, borderTop: "1px solid var(--border)", marginTop: 4, color: "var(--gold)" }}>
                  <span>Client Pays</span>
                  <span>{fmt(grandTotal)}</span>
                </div>
              </div>
            )}

            {/* SAVE BUTTON */}
            {quoteLimitCheck?.exceeded && !isEdit && (
              <div style={{
                background: "#FFF4E5",
                border: "1px solid #FFE2B8",
                borderRadius: 10,
                padding: "10px 14px",
                marginBottom: 10,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#8A4E00" }}>
                  <AlertTriangle size={16} color="#D97706" style={{ flexShrink: 0 }} />
                  <span>
                    <strong>Free Plan Quota Reached:</strong> {quoteLimitCheck.currentCount} of {quoteLimitCheck.limit} orders/quotes used this month. Upgrade to continue.
                  </span>
                </div>
                <Btn
                  small
                  onClick={() => {
                    if (typeof notifyPlanLimitReached === "function") {
                      notifyPlanLimitReached(quoteLimitCheck)
                    }
                  }}
                >
                  Upgrade
                </Btn>
              </div>
            )}
            {saveQuoteError && (
              <div style={{
                marginBottom: 10,
                padding: "8px 12px",
                background: "#FCE8E6",
                border: "1px solid #F5C2C7",
                borderRadius: 8,
                color: "#C5221F",
                fontSize: 12,
                display: "flex",
                alignItems: "center",
                gap: 6
              }}>
                <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                <span>{saveQuoteError}</span>
              </div>
            )}
            <Btn
              full
              onClick={handleSaveQuote}
              loading={isSavingQuote}
              loadingText={isEdit ? "Updating quote..." : "Saving quote..."}
              disabled={isSavingQuote || (quoteLimitCheck?.exceeded && !isEdit)}
              style={quoteLimitCheck?.exceeded && !isEdit ? {
                background: "#B8860B",
                color: "#FFFFFF"
              } : {}}
            >
              {isEdit ? "Update quote" : (quoteLimitCheck?.exceeded ? "🔒 Upgrade to Generate & Save Quote" : "Generate & save quote")}
            </Btn>

            {/* AFTER-SAVE ACTIONS */}
            {quoteSaved && lastSavedQuote ? (
              <div style={{ marginTop: 10, background: "#E1F5EE", border: "1px solid #B7E4D3", borderRadius: 8, padding: "12px 14px" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#085041", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                  <Check size={14} /> Quote saved for {lastSavedQuote.clientName}!
                </div>
                <div style={{ fontSize: 11.5, color: "#0E6251", marginBottom: 10 }}>
                  Total: <strong>{fmt(lastSavedQuote.grandTotal)}</strong>. Calculator has been cleared for your next order.
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <button
                    onClick={() => handleSendWhatsApp(lastSavedQuote)}
                    style={{
                      padding: "7px",
                      borderRadius: 8,
                      border: "none",
                      background: "#25D366",
                      color: "#fff",
                      cursor: "pointer",
                      fontSize: 12.5,
                      fontFamily: "inherit",
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6
                    }}
                  >
                    <MessageCircle size={14} /> Send quote via WhatsApp
                  </button>
                  <button
                    onClick={() => setView("quotes")}
                    style={{
                      padding: "7px",
                      borderRadius: 8,
                      border: "none",
                      background: "var(--gold)",
                      color: "#fff",
                      cursor: "pointer",
                      fontSize: 12.5,
                      fontFamily: "inherit",
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6
                    }}
                  >
                    <ClipboardList size={14} /> View in Quotes
                  </button>
                  <button
                    onClick={() => {
                      setQuoteSaved(false)
                      setLastSavedQuote(null)
                    }}
                    style={{
                      padding: "6px",
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                      background: "transparent",
                      color: "var(--muted)",
                      cursor: "pointer",
                      fontSize: 12,
                      fontFamily: "inherit"
                    }}
                  >
                    Dismiss notification
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ marginTop: 6, fontSize: 11, color: "var(--muted)", textAlign: "center" }}>
                Quote will be saved under client name
              </div>
            )}

            {/* MOCKUP EXPLANATION TAG NOTE */}
            <div
              style={{
                background: "#F0EAFC",
                borderRadius: 10,
                padding: "10px 12px",
                fontSize: 11,
                color: "#5B3A8C",
                lineHeight: 1.5,
                marginTop: 14
              }}
            >
              💡 <strong>Multi-Item Ordering:</strong> Every item — cake or pastry — gets its own sizes, layers, fillings, coverings, decorations, custom topper, boards, photo gallery, delivery date/time, and note. Click <em>"+ Add Item"</em> as many times as the order needs. One general note up top, one Quote Summary total, and one consolidated invoice at the end.
            </div>
          </Card>
        </div>
      </div>

      {/* ENLARGED PHOTO PREVIEW MODAL */}
      {previewPhoto && (
        <div
          onClick={() => setPreviewPhoto(null)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.85)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20
          }}
        >
          <div style={{ position: "relative", maxWidth: "90vw", maxHeight: "90vh" }} onClick={e => e.stopPropagation()}>
            <img
              src={previewPhoto}
              alt="Enlarged design photo"
              style={{ maxWidth: "100%", maxHeight: "85vh", borderRadius: 10, display: "block", boxShadow: "0 10px 30px rgba(0,0,0,0.5)" }}
            />
            <button
              onClick={() => setPreviewPhoto(null)}
              style={{
                position: "absolute",
                top: -12,
                right: -12,
                background: "#fff",
                color: "#000",
                border: "none",
                borderRadius: "50%",
                width: 32,
                height: 32,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                boxShadow: "0 2px 8px rgba(0,0,0,0.3)"
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
