'use strict'

// ========================================
// shapes/bloom.js
// Petal / flower bloom burst drawn on canvas
// triggered by emphasis accumulator
// ========================================

function drawBloom(cx, cy, radius, color, alpha, petalCount) {

  const ctx = STATE.ctx

  petalCount = petalCount || randInt(4, 8)

  ctx.save()

  for (let i = 0; i < petalCount; i++) {

    const angle =
      (i / petalCount) * Math.PI * 2
      + R(-0.1, 0.1)

    const pr = radius * R(0.6, 1.1)

    const px1 =
      cx + Math.cos(angle) * pr * 0.4

    const py1 =
      cy + Math.sin(angle) * pr * 0.4

    const px2 =
      cx + Math.cos(angle) * pr

    const py2 =
      cy + Math.sin(angle) * pr

    const cx1 =
      px1 +
      Math.cos(angle + Math.PI / 2) *
      pr * R(0.2, 0.45)

    const cy1 =
      py1 +
      Math.sin(angle + Math.PI / 2) *
      pr * R(0.2, 0.45)

    const cx2 =
      px2 +
      Math.cos(angle + Math.PI / 2) *
      pr * R(0.1, 0.3)

    const cy2 =
      py2 +
      Math.sin(angle + Math.PI / 2) *
      pr * R(0.1, 0.3)

    ctx.beginPath()

    ctx.moveTo(cx, cy)

    ctx.bezierCurveTo(
      cx1, cy1,
      cx2, cy2,
      px2, py2
    )

    ctx.bezierCurveTo(

      px2 -
      Math.cos(angle + Math.PI / 2) *
      pr * R(0.1, 0.3),

      py2 -
      Math.sin(angle + Math.PI / 2) *
      pr * R(0.1, 0.3),

      px1 -
      Math.cos(angle + Math.PI / 2) *
      pr * R(0.2, 0.45),

      py1 -
      Math.sin(angle + Math.PI / 2) *
      pr * R(0.2, 0.45),

      cx, cy

    )

    ctx.closePath()

    const petalAlpha = alpha * R(0.2, 0.55)

    const gradient =
      ctx.createRadialGradient(
        cx, cy, 0,
        cx, cy, pr
      )

    gradient.addColorStop(0,   rgba(color, petalAlpha))
    gradient.addColorStop(0.6, rgba(color, petalAlpha * 0.5))
    gradient.addColorStop(1,   rgba(color, 0))

    ctx.fillStyle = gradient

    ctx.fill()
  }

  // Center dot
  ctx.beginPath()
  ctx.arc(cx, cy, radius * 0.08, 0, Math.PI * 2)
  ctx.fillStyle = rgba(color, alpha * 0.5)
  ctx.fill()

  ctx.restore()
}
