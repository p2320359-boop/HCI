// ========================================
// utils.js
// ========================================

'use strict'

// DOM

function $(id){
  return document.getElementById(id)
}

// Math

function lerp(a,b,t){
  return a + (b - a) * t
}

function clamp(v,min,max){
  return Math.max(min,Math.min(max,v))
}

function map(v,inMin,inMax,outMin,outMax){

  const n = (v - inMin) / (inMax - inMin)

  return outMin + (outMax - outMin) * n
}

function smoothstep(edge0,edge1,x){

  x = clamp(
    (x-edge0)/(edge1-edge0),
    0,
    1
  )

  return x*x*(3-2*x)
}

// Random

function R(min,max){

  return min + Math.random() * (max - min)
}

function randInt(min,max){

  return Math.floor(
    min + Math.random() * (max - min + 1)
  )
}

function choose(arr){

  return arr[
    Math.floor(Math.random() * arr.length)
  ]
}

// Gaussian Noise

function gauss(){

  let u = 0
  let v = 0

  while(u === 0){
    u = Math.random()
  }

  while(v === 0){
    v = Math.random()
  }

  return (
    Math.sqrt(-2 * Math.log(u))
    *
    Math.cos(2 * Math.PI * v)
  )
}

// Geometry

function dist(x1,y1,x2,y2){

  const dx = x2 - x1
  const dy = y2 - y1

  return Math.sqrt(dx*dx + dy*dy)
}

function angle(x1,y1,x2,y2){

  return Math.atan2(
    y2 - y1,
    x2 - x1
  )
}

function normalize(x,y){

  const d = Math.sqrt(x*x + y*y)

  if(d === 0){

    return {
      x:0,
      y:0
    }
  }

  return {
    x:x/d,
    y:y/d
  }
}

function perpendicular(x,y){

  return {
    x:-y,
    y:x
  }
}

// Bezier

function bez(a,c,b,t){

  const m = 1 - t

  return (
    m*m*a
    +
    2*m*t*c
    +
    t*t*b
  )
}

// Time

function now(){

  return performance.now()
}

// Canvas Helpers

function clearCanvas(ctx,w,h,color='#F5F2EB'){

  ctx.fillStyle = color
  ctx.fillRect(
    0,
    0,
    w,
    h
  )
}

// Color Helpers

function rgbaObj(r,g,b,a){

  return `rgba(${r},${g},${b},${a})`
}

// Debug

function log(){

  console.log.apply(
    console,
    arguments
  )
}