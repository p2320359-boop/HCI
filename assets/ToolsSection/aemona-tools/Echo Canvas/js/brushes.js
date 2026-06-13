// ========================================
// brushes.js
// ========================================

'use strict'

function doStroke(
  x1,
  y1,
  x2,
  y2,
  cpx,
  cpy,
  width,
  color,
  alpha,
  type,
  turbulence
){

  const distance =
    Math.hypot(
      x2-x1,
      y2-y1
    )

  if(distance < 0.5){
    return
  }

  switch(type){

    case 'oil':

      oilBrush(
        x1,y1,
        x2,y2,
        cpx,cpy,
        width,
        color,
        alpha,
        distance,
        turbulence
      )

      break

    case 'wc':

      watercolorBrush(
        x1,y1,
        x2,y2,
        cpx,cpy,
        width,
        color,
        alpha,
        distance,
        turbulence
      )

      break

    case 'dry':

      dryBrush(
        x1,y1,
        x2,y2,
        cpx,cpy,
        width,
        color,
        alpha,
        distance,
        turbulence
      )

      break

    case 'knife':

      knifeBrush(
        x1,y1,
        x2,y2,
        width,
        color,
        alpha,
        distance
      )

      break
  }
}

function oilBrush(
  x1,
  y1,
  x2,
  y2,
  cpx,
  cpy,
  width,
  color,
  alpha,
  distance,
  turbulence
){

  const ctx = STATE.ctx

  const dx = x2 - x1
  const dy = y2 - y1

  const d =
    Math.hypot(dx,dy) || 1

  const nx = -dy / d
  const ny = dx / d

  const bristleCount =
    Math.max(
      7,
      Math.floor(
        width / 2.5
      )
    )

  const steps =
    Math.max(
      10,
      Math.floor(
        distance / 2
      )
    )

  for(
    let b=0;
    b<bristleCount;
    b++
  ){

    const offset =

      (
        b /
        bristleCount
        -
        0.5
      )

      *

      width

      *

      0.85

    const load =
      0.6 +
      Math.random()*0.4

    ctx.beginPath()

    let pressure = 1

    for(
      let s=0;
      s<=steps;
      s++
    ){

      const t =
        s / steps

      pressure =
        Math.sin(
          t*Math.PI
        )*0.8 + 0.2

      const px =

        bez(
          x1,
          cpx,
          x2,
          t
        )

        +

        nx *

        (
          offset
          +
          gauss()
          *
          turbulence
          *
          2
        )

      const py =

        bez(
          y1,
          cpy,
          y2,
          t
        )

        +

        ny *

        (
          offset
          +
          gauss()
          *
          turbulence
          *
          2
        )

      if(s===0){
        ctx.moveTo(px,py)
      }
      else{
        ctx.lineTo(px,py)
      }
    }

    ctx.lineWidth =
      R(1.2,3.2)
      *
      pressure

    ctx.strokeStyle =
      rgba(
        color,
        alpha * load
      )

    ctx.lineCap =
      'round'

    ctx.stroke()
  }

  addOilPooling(
    x1,
    y1,
    x2,
    y2,
    cpx,
    cpy,
    width,
    color,
    alpha
  )
}

function addOilPooling(

  x1,
  y1,

  x2,
  y2,

  cpx,
  cpy,

  width,

  color,

  alpha

){

  const ctx =
    STATE.ctx

  const mx =
    bez(
      x1,
      cpx,
      x2,
      0.5
    )

  const my =
    bez(
      y1,
      cpy,
      y2,
      0.5
    )

  const radius =
    width * 0.8

  const gradient =

    ctx.createRadialGradient(
      mx,
      my,
      0,
      mx,
      my,
      radius
    )

  gradient.addColorStop(
    0,
    rgba(
      color,
      alpha*0.8
    )
  )

  gradient.addColorStop(
    0.4,
    rgba(
      color,
      alpha*0.3
    )
  )

  gradient.addColorStop(
    1,
    rgba(
      color,
      0
    )
  )

  ctx.fillStyle =
    gradient

  ctx.fillRect(
    mx-radius,
    my-radius,
    radius*2,
    radius*2
  )
}

function watercolorBrush(

  x1,
  y1,

  x2,
  y2,

  cpx,
  cpy,

  width,

  color,

  alpha,

  distance,

  turbulence

){

  const ctx = STATE.ctx

  const dx = x2 - x1
  const dy = y2 - y1

  const d =
    Math.hypot(dx,dy) || 1

  const nx = -dy / d
  const ny = dx / d

  // =====================
  // Bleed Halo
  // =====================

  ctx.save()

  ctx.beginPath()

  ctx.moveTo(
    x1 + gauss()*3,
    y1 + gauss()*3
  )

  ctx.quadraticCurveTo(

    cpx +
    gauss()*4*turbulence,

    cpy +
    gauss()*4*turbulence,

    x2 + gauss()*3,
    y2 + gauss()*3

  )

  ctx.lineWidth =
    width * 3.5

  ctx.lineCap =
    'round'

  ctx.strokeStyle =
    rgba(
      color,
      alpha * 0.12
    )

  ctx.stroke()

  ctx.restore()

  // =====================
  // Wash Layers
  // =====================

  for(
    let p=0;
    p<7;
    p++
  ){

    ctx.save()

    ctx.beginPath()

    const jx =
      gauss()*2.5

    const jy =
      gauss()*2.5

    ctx.moveTo(
      x1+jx,
      y1+jy
    )

    ctx.quadraticCurveTo(

      cpx +
      gauss()*3*turbulence,

      cpy +
      gauss()*3*turbulence,

      x2+jx,
      y2+jy

    )

    ctx.lineWidth =

      width *

      R(0.5,1.3)

      *

      (1-p*0.05)

    ctx.lineCap =
      'round'

    ctx.strokeStyle =
      rgba(
        color,
        alpha *
        (
          0.1 +
          p*0.035
        )
      )

    ctx.stroke()

    ctx.restore()
  }

  // =====================
  // Coffee Ring
  // =====================

  ctx.save()

  ctx.beginPath()

  ctx.moveTo(
    x1 + gauss(),
    y1 + gauss()
  )

  ctx.quadraticCurveTo(

    cpx +
    gauss()*2*turbulence,

    cpy +
    gauss()*2*turbulence,

    x2 + gauss(),
    y2 + gauss()

  )

  ctx.lineWidth =
    width * 1.3

  ctx.lineCap =
    'round'

  ctx.strokeStyle =
    rgba(

      {

        r:color.r*0.6,

        g:color.g*0.6,

        b:color.b*0.6

      },

      alpha * 0.2

    )

  ctx.stroke()

  ctx.restore()

  // =====================
  // Granulation
  // =====================

  const grainCount =

    Math.max(

      10,

      Math.floor(
        distance *
        width *
        0.06
      )

    )

  for(
    let i=0;
    i<grainCount;
    i++
  ){

    const t =
      Math.random()

    const px =

      bez(
        x1,
        cpx,
        x2,
        t
      )

      +

      nx *

      gauss()

      *

      width

      *

      0.55

    const py =

      bez(
        y1,
        cpy,
        y2,
        t
      )

      +

      ny *

      gauss()

      *

      width

      *

      0.55

    ctx.beginPath()

    ctx.arc(
      px,
      py,
      R(0.5,2),
      0,
      Math.PI*2
    )

    ctx.fillStyle =
      rgba(
        color,
        alpha *
        R(
          0.15,
          0.45
        )
      )

    ctx.fill()
  }

}

function dryBrush(

  x1,
  y1,

  x2,
  y2,

  cpx,
  cpy,

  width,

  color,

  alpha,

  distance,

  turbulence

){

  const ctx = STATE.ctx

  const dx = x2 - x1
  const dy = y2 - y1

  const d =
    Math.hypot(dx,dy) || 1

  const nx = -dy / d
  const ny = dx / d

  const bristleCount =

    Math.max(
      5,
      Math.floor(
        width / 3.5
      )
    )

  for(
    let b=0;
    b<bristleCount;
    b++
  ){

    const offset =

      (
        b /
        bristleCount
        -
        0.5
      )

      *

      width

      *

      0.7

    ctx.beginPath()

    let drawing = false

    const steps =

      Math.max(
        12,
        Math.floor(
          distance / 1.8
        )
      )

          for(
      let s=0;
      s<=steps;
      s++
    ){

      const t =
        s / steps

      if(
        Math.random()
        <
        0.25
      ){

        drawing = false

        continue
      }

      const px =

        bez(
          x1,
          cpx,
          x2,
          t
        )

        +

        nx *

        (
          offset +
          gauss() *
          turbulence *
          2.5
        )

      const py =

        bez(
          y1,
          cpy,
          y2,
          t
        )

        +

        ny *

        (
          offset +
          gauss() *
          turbulence *
          2.5
        )

      if(!drawing){

        ctx.moveTo(
          px,
          py
        )

        drawing = true
      }
      else{

        ctx.lineTo(
          px,
          py
        )
      }
    }

    ctx.lineWidth =
      R(0.7,1.8)

    ctx.strokeStyle =
      rgba(
        color,
        alpha *
        R(
          0.35,
          0.65
        )
      )

    ctx.lineCap =
      'round'

    ctx.stroke()
  }
}

function knifeBrush(

  x1,
  y1,

  x2,
  y2,

  width,

  color,

  alpha,

  distance

){

  const ctx = STATE.ctx

  const dx = x2 - x1
  const dy = y2 - y1

  const d =
    Math.hypot(dx,dy) || 1

  const nx = -dy / d
  const ny = dx / d

  const halfWidth =
    width * 0.6

  ctx.save()

  ctx.beginPath()

  ctx.moveTo(
    x1 + nx*halfWidth + gauss(),
    y1 + ny*halfWidth + gauss()
  )

  ctx.lineTo(
    x2 + nx*halfWidth + gauss(),
    y2 + ny*halfWidth + gauss()
  )

  ctx.lineTo(
    x2 - nx*halfWidth + gauss(),
    y2 - ny*halfWidth + gauss()
  )

  ctx.lineTo(
    x1 - nx*halfWidth + gauss(),
    y1 - ny*halfWidth + gauss()
  )

  ctx.closePath()

  ctx.fillStyle =
    rgba(
      color,
      alpha * 0.4
    )

  ctx.fill()

  ctx.beginPath()

  ctx.moveTo(
    x1 + nx*halfWidth,
    y1 + ny*halfWidth
  )

  ctx.lineTo(
    x2 + nx*halfWidth,
    y2 + ny*halfWidth
  )

  ctx.lineWidth =
    R(0.8,2.2)

  ctx.strokeStyle =
    rgba(

      {

        r:Math.min(
          255,
          color.r + 50
        ),

        g:Math.min(
          255,
          color.g + 50
        ),

        b:Math.min(
          255,
          color.b + 50
        )

      },

      alpha * 0.5

    )

  ctx.stroke()

  ctx.restore()
}

function wash(

  cx,
  cy,

  radius,

  color,

  alpha

){

  const ctx = STATE.ctx

  for(
    let layer=0;
    layer<4;
    layer++
  ){

    const r =

      radius *

      R(
        0.6,
        1.3
      )

    const ox =
      gauss()
      *
      radius
      *
      0.05

    const oy =
      gauss()
      *
      radius
      *
      0.05

    const gradient =

      ctx.createRadialGradient(

        cx+ox,
        cy+oy,
        0,

        cx+ox,
        cy+oy,
        r

      )

          gradient.addColorStop(

      0,

      rgba(
        color,
        alpha * 1.5
      )

    )

    gradient.addColorStop(

      0.35,

      rgba(
        color,
        alpha * 0.7
      )

    )

    gradient.addColorStop(

      0.7,

      rgba(
        color,
        alpha * 0.15
      )

    )

    gradient.addColorStop(

      1,

      rgba(
        color,
        0
      )

    )

    ctx.fillStyle =
      gradient

    ctx.fillRect(

      cx+ox-r,
      cy+oy-r,

      r*2,
      r*2

    )
  }

    const grainCount =

    Math.max(

      6,

      Math.floor(
        radius *
        radius *
        0.003
      )

    )

  for(
    let i=0;
    i<grainCount;
    i++
  ){

    const angle =
      Math.random()
      *
      Math.PI
      *
      2

    const dist =
      Math.random()
      *
      radius
      *
      0.85

    const gx =
      cx +
      Math.cos(angle)
      *
      dist

    const gy =
      cy +
      Math.sin(angle)
      *
      dist

    STATE.ctx.beginPath()

    STATE.ctx.arc(

      gx,
      gy,

      R(
        0.4,
        1.8
      ),

      0,
      Math.PI*2

    )

    STATE.ctx.fillStyle =
      rgba(
        color,
        alpha *
        R(
          0.15,
          0.4
        )
      )

    STATE.ctx.fill()
  }

}