'use strict'

// ========================================
// shapes/particle.js
// Floating particle emitted on voice emphasis
// ========================================

function createParticle(x, y, color, voiceAmount) {

  const speed = R(0.4, 1.2) * (0.5 + voiceAmount * 0.5)

  const angle = R(0, Math.PI * 2)

  return {

    x: x,
    y: y,

    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed - R(0.2, 0.8),

    radius: R(1.5, 4) * (0.6 + voiceAmount * 0.4),

    color: color,

    alpha: R(0.4, 0.8),

    decay: R(0.008, 0.02),

    life: 1.0

  }
}

function updateParticle(p) {

  p.x += p.vx
  p.y += p.vy

  p.vy += 0.012

  p.vx *= 0.97

  p.life -= p.decay

  p.alpha = p.life * 0.7
}

function drawParticle(p) {

  if (p.life <= 0) return

  const ctx = STATE.ctx

  ctx.save()

  ctx.globalAlpha = clamp(p.alpha, 0, 1)

  ctx.beginPath()

  ctx.arc(
    p.x,
    p.y,
    p.radius * p.life,
    0,
    Math.PI * 2
  )

  ctx.fillStyle = rgba(p.color, 1)

  ctx.fill()

  ctx.restore()
}

function isParticleAlive(p) {
  return p.life > 0
}
