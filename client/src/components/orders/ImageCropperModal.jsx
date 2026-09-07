import React, { useState, useEffect, useRef } from "react"
import { Crop, RotateCw, ZoomIn, ZoomOut, Check, X, RefreshCw } from "lucide-react"

export default function ImageCropperModal({
  isOpen,
  imageSrc,
  queueInfo = null, // e.g. { current: 1, total: 3 }
  onCrop, // (croppedDataUrl) => void
  onSkip, // () => void (use original)
  onCancel, // () => void
  onSkipAll = null // () => void (skip remaining in queue)
}) {
  const [aspectRatio, setAspectRatio] = useState("1:1")
  const [rotation, setRotation] = useState(0) // 0, 90, 180, 270
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 })
  const [imageLoaded, setImageLoaded] = useState(false)

  const imgRef = useRef(null)
  const stageRef = useRef(null)

  // Reset adjustments whenever a new image is loaded
  useEffect(() => {
    if (!isOpen || !imageSrc) return
    setRotation(0)
    setZoom(1)
    setPan({ x: 0, y: 0 })
    setImageLoaded(false)

    const img = new Image()
    img.onload = () => {
      setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight })
      setImageLoaded(true)
    }
    img.src = imageSrc
  }, [isOpen, imageSrc])

  if (!isOpen || !imageSrc) return null

  // Calculate crop box display dimensions (in screen pixels)
  const getCropBoxDimensions = () => {
    const maxBoxW = 310
    const maxBoxH = 310

    switch (aspectRatio) {
      case "1:1":
        return { w: 280, h: 280 }
      case "4:3":
        return { w: 292, h: 219 }
      case "3:4":
        return { w: 219, h: 292 }
      case "16:9":
        return { w: 304, h: 171 }
      case "free":
      default: {
        if (!naturalSize.width || !naturalSize.height) return { w: 280, h: 280 }
        const effW = rotation % 180 === 0 ? naturalSize.width : naturalSize.height
        const effH = rotation % 180 === 0 ? naturalSize.height : naturalSize.width
        const imgAspect = effW / effH
        if (imgAspect >= 1) {
          const w = maxBoxW
          const h = Math.round(maxBoxW / imgAspect)
          return { w, h: Math.min(h, maxBoxH) }
        } else {
          const h = maxBoxH
          const w = Math.round(maxBoxH * imgAspect)
          return { w: Math.min(w, maxBoxW), h }
        }
      }
    }
  }

  const { w: boxW, h: boxH } = getCropBoxDimensions()

  // Base scale so image fills the crop box without empty margins initially
  const effW = rotation % 180 === 0 ? naturalSize.width : naturalSize.height
  const effH = rotation % 180 === 0 ? naturalSize.height : naturalSize.width
  const baseScale = effW && effH ? Math.max(boxW / effW, boxH / effH) : 1

  // Handle Drag / Pan (Mouse & Touch)
  const handleMouseDown = (e) => {
    e.preventDefault()
    setIsDragging(true)
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
  }

  const handleMouseMove = (e) => {
    if (!isDragging) return
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    })
  }

  const handleMouseUp = () => setIsDragging(false)

  const handleTouchStart = (e) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0]
      setIsDragging(true)
      setDragStart({ x: touch.clientX - pan.x, y: touch.clientY - pan.y })
    }
  }

  const handleTouchMove = (e) => {
    if (!isDragging || e.touches.length !== 1) return
    const touch = e.touches[0]
    setPan({
      x: touch.clientX - dragStart.x,
      y: touch.clientY - dragStart.y
    })
  }

  const handleTouchEnd = () => setIsDragging(false)

  // Wheel zoom
  const handleWheel = (e) => {
    e.preventDefault()
    const delta = e.deltaY < 0 ? 0.08 : -0.08
    setZoom(z => Math.max(1, Math.min(3.5, parseFloat((z + delta).toFixed(2)))))
  }

  // Rotate 90 deg clockwise
  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360)
    setPan({ x: 0, y: 0 }) // reset pan on rotate for clean realignment
  }

  // Reset adjustments
  const handleReset = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
    setRotation(0)
  }

  // Perform the crop on high-resolution canvas and export
  const handleApplyCrop = () => {
    if (!naturalSize.width || !naturalSize.height) {
      onSkip && onSkip()
      return
    }

    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      // Create optimized output canvas (up to 640px longest dimension for bandwidth efficiency)
      const maxDim = 640
      let outW, outH
      if (boxW >= boxH) {
        outW = maxDim
        outH = Math.round(maxDim * (boxH / boxW))
      } else {
        outH = maxDim
        outW = Math.round(maxDim * (boxW / boxH))
      }

      const canvas = document.createElement("canvas")
      canvas.width = outW
      canvas.height = outH
      const ctx = canvas.getContext("2d")

      // Fill white background for any transparency
      ctx.fillStyle = "#ffffff"
      ctx.fillRect(0, 0, outW, outH)

      // Transform coordinate space to exactly match the screen preview
      ctx.save()
      // Move to center of canvas
      ctx.translate(outW / 2, outH / 2)
      // Scale from screen pixels to canvas output resolution
      const scaleToCanvas = outW / boxW
      ctx.scale(scaleToCanvas, scaleToCanvas)
      // Apply screen pan
      ctx.translate(pan.x, pan.y)
      // Apply rotation around center
      ctx.rotate((rotation * Math.PI) / 180)
      // Apply base scale & zoom
      const totalScale = baseScale * zoom
      ctx.scale(totalScale, totalScale)
      // Draw image centered
      ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2)
      ctx.restore()

      try {
        const croppedDataUrl = canvas.toDataURL("image/jpeg", 0.70)
        onCrop(croppedDataUrl)
      } catch (err) {
        console.warn("Canvas export error:", err)
        onSkip && onSkip()
      }
    }
    img.onerror = () => onSkip && onSkip()
    img.src = imageSrc
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(18, 14, 10, 0.82)",
        backdropFilter: "blur(5px)",
        zIndex: 99999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        animation: "fadeIn 0.2s ease"
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div
        style={{
          background: "var(--panel, #FFFEFA)",
          borderRadius: 16,
          width: "100%",
          maxWidth: 480,
          boxShadow: "0 24px 48px rgba(0,0,0,0.35)",
          border: "1.5px solid var(--cream-line, #E3D6B3)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column"
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "14px 18px",
            borderBottom: "1px solid var(--cream-line, #E3D6B3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "var(--cream-deep, #F1E8D2)"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Crop size={18} color="var(--gold, #B8862E)" />
            <span style={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, fontSize: 16 }}>
              Crop Inspiration Photo
            </span>
            {queueInfo && queueInfo.total > 1 && (
              <span
                style={{
                  fontSize: 11,
                  background: "var(--gold)",
                  color: "#fff",
                  fontWeight: 700,
                  padding: "2px 7px",
                  borderRadius: 10
                }}
              >
                {queueInfo.current} of {queueInfo.total}
              </span>
            )}
          </div>
          <button
            onClick={onCancel}
            title="Cancel"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--charcoal-soft, #6B6151)",
              padding: 4,
              display: "flex",
              alignItems: "center"
            }}
          >
            <X size={19} />
          </button>
        </div>

        {/* Aspect Ratio Selector */}
        <div
          style={{
            padding: "10px 16px 6px",
            display: "flex",
            alignItems: "center",
            gap: 6,
            overflowX: "auto",
            background: "var(--cream, #FAF6EC)",
            borderBottom: "1px solid var(--cream-line, #E3D6B3)"
          }}
        >
          <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--charcoal-soft, #6B6151)", marginRight: 4 }}>
            Ratio:
          </span>
          {[
            { id: "1:1", label: "1:1 Square" },
            { id: "4:3", label: "4:3" },
            { id: "3:4", label: "3:4" },
            { id: "16:9", label: "16:9" },
            { id: "free", label: "Original" }
          ].map(opt => (
            <button
              key={opt.id}
              onClick={() => {
                setAspectRatio(opt.id)
                setPan({ x: 0, y: 0 })
              }}
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: "4px 10px",
                borderRadius: 20,
                border: aspectRatio === opt.id ? "1.5px solid var(--gold)" : "1px solid var(--cream-line, #E3D6B3)",
                background: aspectRatio === opt.id ? "var(--gold)" : "#fff",
                color: aspectRatio === opt.id ? "#fff" : "var(--charcoal)",
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "all 0.15s"
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Interactive Cropper Stage */}
        <div
          ref={stageRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onWheel={handleWheel}
          style={{
            position: "relative",
            width: "100%",
            height: 330,
            background: "#1E1A16",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            cursor: isDragging ? "grabbing" : "grab",
            userSelect: "none",
            touchAction: "none"
          }}
        >
          {/* Instructions banner */}
          <div
            style={{
              position: "absolute",
              top: 8,
              left: "50%",
              transform: "translateX(-50%)",
              background: "rgba(0,0,0,0.6)",
              color: "#fff",
              fontSize: 10.5,
              padding: "3px 10px",
              borderRadius: 12,
              pointerEvents: "none",
              zIndex: 10,
              whiteSpace: "nowrap"
            }}
          >
            Drag to pan • Scroll / slider to zoom
          </div>

          {/* Crop Box Window */}
          <div
            style={{
              position: "relative",
              width: boxW,
              height: boxH,
              overflow: "hidden",
              borderRadius: 4,
              boxShadow: "0 0 0 9999px rgba(10, 8, 6, 0.72)",
              border: "2px solid #F6AE13",
              zIndex: 2,
              flexShrink: 0
            }}
          >
            {/* Rule of thirds grid lines */}
            <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 3 }}>
              <div style={{ position: "absolute", top: "33.33%", left: 0, right: 0, height: 1, borderTop: "1px dashed rgba(255,255,255,0.3)" }} />
              <div style={{ position: "absolute", top: "66.66%", left: 0, right: 0, height: 1, borderTop: "1px dashed rgba(255,255,255,0.3)" }} />
              <div style={{ position: "absolute", left: "33.33%", top: 0, bottom: 0, width: 1, borderLeft: "1px dashed rgba(255,255,255,0.3)" }} />
              <div style={{ position: "absolute", left: "66.66%", top: 0, bottom: 0, width: 1, borderLeft: "1px dashed rgba(255,255,255,0.3)" }} />
            </div>

            {/* Transformed Image Preview */}
            {imageLoaded && (
              <img
                ref={imgRef}
                src={imageSrc}
                alt="Crop preview"
                draggable={false}
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  width: naturalSize.width,
                  height: naturalSize.height,
                  maxWidth: "none",
                  maxHeight: "none",
                  transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) rotate(${rotation}deg) scale(${baseScale * zoom})`,
                  transformOrigin: "center center",
                  pointerEvents: "none",
                  display: "block"
                }}
              />
            )}
          </div>
        </div>

        {/* Adjustments Toolbar: Zoom, Rotate, Reset */}
        <div
          style={{
            padding: "10px 18px",
            background: "var(--panel, #FFFEFA)",
            borderTop: "1px solid var(--cream-line, #E3D6B3)",
            display: "flex",
            flexDirection: "column",
            gap: 10
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
            {/* Zoom Slider */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
              <ZoomOut size={16} color="var(--charcoal-soft)" style={{ flexShrink: 0 }} />
              <input
                type="range"
                min="1"
                max="3"
                step="0.05"
                value={zoom}
                onChange={e => setZoom(parseFloat(e.target.value))}
                style={{ width: "100%", accentColor: "var(--gold)" }}
                aria-label="Zoom"
              />
              <ZoomIn size={16} color="var(--charcoal-soft)" style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--gold)", minWidth: 36, textAlign: "right" }}>
                {Math.round(zoom * 100)}%
              </span>
            </div>

            {/* Rotate & Reset Buttons */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                type="button"
                onClick={handleRotate}
                title="Rotate 90° clockwise"
                style={{
                  padding: "6px 10px",
                  borderRadius: 8,
                  border: "1px solid var(--cream-line, #E3D6B3)",
                  background: "#FAF6EC",
                  color: "var(--charcoal)",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4
                }}
              >
                <RotateCw size={14} /> 90°
              </button>
              <button
                type="button"
                onClick={handleReset}
                title="Reset adjustments"
                style={{
                  padding: "6px 10px",
                  borderRadius: 8,
                  border: "1px solid var(--cream-line, #E3D6B3)",
                  background: "#FAF6EC",
                  color: "var(--charcoal)",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4
                }}
              >
                <RefreshCw size={13} /> Reset
              </button>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: "12px 18px",
            background: "var(--cream-deep, #F1E8D2)",
            borderTop: "1px solid var(--cream-line, #E3D6B3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 8
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              onClick={onCancel}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "none",
                background: "transparent",
                color: "var(--charcoal-soft, #6B6151)",
                fontSize: 12.5,
                fontWeight: 600,
                cursor: "pointer"
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSkip}
              title="Add original photo without cropping"
              style={{
                padding: "7px 12px",
                borderRadius: 8,
                border: "1px solid var(--cream-line, #E3D6B3)",
                background: "#fff",
                color: "var(--charcoal)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer"
              }}
            >
              Keep Original
            </button>
            {onSkipAll && queueInfo && queueInfo.total > 1 && (
              <button
                type="button"
                onClick={onSkipAll}
                title="Add all remaining photos without cropping"
                style={{
                  padding: "7px 10px",
                  borderRadius: 8,
                  border: "1px solid var(--cream-line, #E3D6B3)",
                  background: "#fff",
                  color: "var(--charcoal-soft)",
                  fontSize: 11.5,
                  fontWeight: 500,
                  cursor: "pointer"
                }}
              >
                Skip All
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={handleApplyCrop}
            style={{
              padding: "8px 18px",
              borderRadius: 8,
              border: "none",
              background: "var(--gold, #B8862E)",
              color: "#fff",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              boxShadow: "0 2px 6px rgba(184, 134, 46, 0.3)"
            }}
          >
            <Check size={16} />
            {queueInfo && queueInfo.current < queueInfo.total ? "Crop & Next" : "Apply Crop & Save"}
          </button>
        </div>
      </div>
    </div>
  )
}
