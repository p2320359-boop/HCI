'use strict'

// ========================================
// shapes/ribbon.js
// Flowing ribbon along a bezier path —
// used for long sustained vocal passages
// ========================================

function drawRibbon(
  x1, y1,
  x2, y2,
  cpx, cpy,
  width,
  color,
  alpha,
  turbulence,
  steps
){

  const ctx = STATE.ctx

  steps = steps || 30

  ctx.save()

  for (let layer = 0; layer < 3; layer++) {

    const layerWidth =
      width * (1 - layer * 0.25)

    const layerAlpha =
      alpha * (0.5 - layer * 0.12)

    ctx.beginPath()

    for (let s = 0; s <= steps; s++) {

      const t = s / steps

      const bx =
        bez(x1, cpx, x2, t)
        + gauss() * turbulence * layerWidth * 0.3

      const by =
        bez(y1, cpy, y2, t)
        + gauss() * turbulence * layerWidth * 0.3

      if (s === 0) {
        ctx.moveTo(bx, by)
      } else {
        ctx.lineTo(bx, by)
      }
    }

    const pressure =
      0.5 +
      Math.sin(
        (STATE.frame || 0) * 0.05 + layer
      ) * 0.3

    ctx.lineWidth   = layerWidth * pressure
    ctx.strokeStyle = rgba(color, layerAlpha)
    ctx.lineCap     = 'round'
    ctx.lineJoin    = 'round'
    ctx.stroke()
  }

  // Shimmer highlights along the ribbon spine
  const highlightCount = Math.max(3, (steps * 0.4) | 0)

  for (let i = 0; i < highlightCount; i++) {

    const t = Math.random()

    const hx = bez(x1, cpx, x2, t) + gauss() * 2
    const hy = bez(y1, cpy, y2, t) + gauss() * 2

    ctx.beginPath()
    ctx.arc(hx, hy, R(0.5, 1.5), 0, Math.PI * 2)
    ctx.fillStyle = rgba(color, alpha * R(0.3, 0.6))
    ctx.fill()
  }

  ctx.restore()
}
