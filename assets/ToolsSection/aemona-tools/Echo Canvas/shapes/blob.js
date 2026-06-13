'use strict'

// ========================================
// shapes/blob.js
// Organic soft blob — painted at rest points
// or during breath / long silence breaks
// ========================================

function drawBlob(cx, cy, baseRadius, color, alpha, segments) {

  const ctx = STATE.ctx

  segments = segments || 8

  const points = []

  for (let i = 0; i < segments; i++) {

    const angle =
      (i / segments) * Math.PI * 2

    const r =
      baseRadius *
      (
        0.75
        +
        gauss() * 0.25
      )

    points.push({
      x: cx + Math.cos(angle) * r,
      y: cy + Math.sin(angle) * r
    })
  }

  ctx.save()

  ctx.beginPath()

  ctx.moveTo(
    (points[0].x + points[segments - 1].x) / 2,
    (points[0].y + points[segments - 1].y) / 2
  )

  for (let i = 0; i < segments; i++) {

    const curr = points[i]
    const next = points[(i + 1) % segments]

    const midX = (curr.x + next.x) / 2
    const midY = (curr.y + next.y) / 2

    ctx.quadraticCurveTo(
      curr.x,
      curr.y,
      midX,
      midY
    )
  }

  ctx.closePath()

  const gradient =
    ctx.createRadialGradient(
      cx, cy, 0,
      cx, cy, baseRadius
    )

  gradient.addColorStop(0,   rgba(color, alpha * 0.9))
  gradient.addColorStop(0.5, rgba(color, alpha * 0.4))
  gradient.addColorStop(1,   rgba(color, 0))

  ctx.fillStyle = gradient

  ctx.fill()

  ctx.restore()
}

function drawBlobRing(cx, cy, baseRadius, color, alpha) {

  const ctx = STATE.ctx

  ctx.save()

  ctx.beginPath()

  ctx.arc(cx, cy, baseRadius, 0, Math.PI * 2)

  ctx.strokeStyle = rgba(color, alpha * 0.3)

  ctx.lineWidth = R(1, 3)

  ctx.stroke()

  ctx.restore()
}
