// ========================================
// color.js
// ========================================

'use strict'

// Aemona / Voice Bloom Palette

const COLOR_STOPS = [

  [48,75,140],     // blue

  [75,65,135],     // violet

  [60,125,130],    // teal

  [148,120,95],    // earth

  [190,128,70],    // orange

  [210,168,60]     // gold

]

// interpolate palette

function mkCol(position,saturation=1){

  position = clamp(position,0,1)

  const t =
    position *
    (COLOR_STOPS.length - 1)

  const i = Math.floor(t)

  const f = t - i

  const a =
    COLOR_STOPS[
      Math.min(
        i,
        COLOR_STOPS.length - 1
      )
    ]

  const b =
    COLOR_STOPS[
      Math.min(
        i + 1,
        COLOR_STOPS.length - 1
      )
    ]

  let r =
    lerp(
      a[0],
      b[0],
      f
    )

  let g =
    lerp(
      a[1],
      b[1],
      f
    )

  let bl =
    lerp(
      a[2],
      b[2],
      f
    )

  const gray =
    (r + g + bl) / 3

  r = lerp(gray,r,saturation)
  g = lerp(gray,g,saturation)
  bl = lerp(gray,bl,saturation)

  return {
    r:Math.round(r),
    g:Math.round(g),
    b:Math.round(bl)
  }
}

// rgba string

function rgba(color,alpha){

  return `rgba(
    ${color.r},
    ${color.g},
    ${color.b},
    ${clamp(alpha,0,1)}
  )`
}

// brighten

function brighten(color,amount=20){

  return {

    r:Math.min(
      255,
      color.r + amount
    ),

    g:Math.min(
      255,
      color.g + amount
    ),

    b:Math.min(
      255,
      color.b + amount
    )
  }
}

// darken

function darken(color,amount=20){

  return {

    r:Math.max(
      0,
      color.r - amount
    ),

    g:Math.max(
      0,
      color.g - amount
    ),

    b:Math.max(
      0,
      color.b - amount
    )
  }
}

// blend

function blendColor(
  c1,
  c2,
  t
){

  return {

    r:Math.round(
      lerp(c1.r,c2.r,t)
    ),

    g:Math.round(
      lerp(c1.g,c2.g,t)
    ),

    b:Math.round(
      lerp(c1.b,c2.b,t)
    )
  }
}

// random variation

function varyColor(
  color,
  amount=10
){

  return {

    r:clamp(
      color.r + gauss()*amount,
      0,
      255
    ),

    g:clamp(
      color.g + gauss()*amount,
      0,
      255
    ),

    b:clamp(
      color.b + gauss()*amount,
      0,
      255
    )
  }
}

// emotion palette helper

function emotionColor(
  centroid,
  saturation=1
){

  return mkCol(
    centroid,
    saturation
  )
}