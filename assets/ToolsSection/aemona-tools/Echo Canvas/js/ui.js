function resizeCanvas(){

  const rect =

    STATE.canvas
    .parentElement
    .getBoundingClientRect()

  STATE.dpr =

    Math.min(
      window.devicePixelRatio || 1,
      2
    )

  STATE.width  = rect.width
  STATE.height = rect.height

  // Main drawing canvas
  STATE.canvas.width  = STATE.width  * STATE.dpr
  STATE.canvas.height = STATE.height * STATE.dpr

  STATE.ctx.setTransform(
    STATE.dpr, 0, 0, STATE.dpr, 0, 0
  )

  // Grain overlay canvas — must match main canvas
  STATE.grainCanvas.width  = STATE.width  * STATE.dpr
  STATE.grainCanvas.height = STATE.height * STATE.dpr

  STATE.grainCtx.setTransform(
    STATE.dpr, 0, 0, STATE.dpr, 0, 0
  )

  // Rebuild grain at new size
  createGrain()
}

// ========================================
// ui.js
// ========================================

'use strict'

function setupCanvas(){

  STATE.canvas =
    $('c')

  STATE.ctx =
    STATE.canvas.getContext('2d')

  STATE.grainCanvas =
    $('g')

  STATE.grainCtx =
    STATE.grainCanvas.getContext('2d')
}

function resetCanvas(){

  STATE.paths = []

  createNewPath()

  STATE.emphasisAccumulator = 0

  STATE.silenceFrames = 0

  STATE.worldStart =
    performance.now()

  paintBackground()

  toast(
    'Cleared'
  )
}

function saveArtwork(){

  if(
    !STATE.hasPainted
  ){

    toast(
      'Paint something first'
    )

    return
  }

  const exportCanvas =
    document.createElement(
      'canvas'
    )

  const dpr =

    Math.min(
      window.devicePixelRatio || 1,
      2
    )

  exportCanvas.width =
    STATE.width * dpr

  exportCanvas.height =
    STATE.height * dpr

  const ctx =
    exportCanvas.getContext('2d')

  ctx.setTransform(
    dpr,
    0,
    0,
    dpr,
    0,
    0
  )

  ctx.fillStyle =
    STATE.backgroundColor

  ctx.fillRect(
    0,
    0,
    STATE.width,
    STATE.height
  )

  ctx.drawImage(
    STATE.canvas,
    0,
    0,
    STATE.width,
    STATE.height
  )

  const link =
    document.createElement(
      'a'
    )

  link.download =
    'echo-canvas-' +
    Date.now() +
    '.png'

  link.href =
    exportCanvas
    .toDataURL(
      'image/png'
    )

  link.click()

  toast(
    'Saved'
  )
}

function updateStats(){

  const el =
    $('stats')

  if(!el){
    return
  }

  const hzText =

    STATE.rawHz > 0

    ?

    STATE.rawHz.toFixed(0)

    :

    '--'

  const voiceClass =

    STATE.speaking

    ?

    'vy'

    :

    ''

  const voiceText =

    STATE.speaking

    ?

    'YES'

    :

    'no'

  const acText =

    STATE.audioContext

    ?

    STATE.audioContext.state

    :

    '--'

      el.innerHTML =

    '<span class="l">se</span> ' +

    '<span>' +
    STATE.spectralEnergy.toFixed(1) +
    '</span> ' +

    '<span class="l">gate</span> ' +

    '<span>' +
    STATE.noiseGate.toFixed(1) +
    '</span> ' +

    '<span class="l">floor</span> ' +

    '<span>' +
    STATE.noiseFloor.toFixed(1) +
    '</span><br>' +

    '<span class="l">rms</span> ' +

    '<span>' +
    STATE.rawRms.toFixed(4) +
    '</span> ' +

    '<span class="l">Hz</span> ' +

    '<span>' +
    hzText +
    '</span> ' +

    '<span class="l">voice</span> ' +

    '<span class="' +
    voiceClass +
    '">' +
    voiceText +
    '</span><br>' +

    '<span class="l">cent</span> ' +

    '<span>' +
    (STATE.rawCentroid*100).toFixed(0) +
    '</span> ' +

    '<span class="l">flux</span> ' +

    '<span>' +
    STATE.rawFlux.toFixed(1) +
    '</span> ' +

    '<span class="l">harm</span> ' +

    '<span>' +
    (STATE.rawHarmonicity*100).toFixed(0) +
    '</span><br>' +

    '<span class="l">paths</span> ' +

    '<span>' +
    STATE.paths.length +
    '</span> ' +

    '<span class="l">AC</span> ' +

    '<span>' +
    acText +
    '</span>' +

    (
      STATE.calibrating

      ?

      ' <span class="vy">CAL ' +
      STATE.calibrationCount +
      '/' +
      STATE.calibrationFrames +
      '</span>'

      :

      ''
    )
}

function hideStartScreen(){

  const el =
    $('startScreen')

  if(!el){
    return
  }

  el.classList.add(
    'hidden'
  )
}

function showCalibrationOverlay(){

  const overlay =
    $('overlay')

  if(!overlay){
    return
  }

  // Reset fill bar to 0 for a fresh calibration
  const fill =
    overlay.querySelector('.calib-fill')

  if(fill){
    fill.style.width = '0%'
  }

  overlay.classList.remove('hidden')
}

function updateCalibrationProgress(){

  const fill =
    document.querySelector(
      '.calib-fill'
    )

  if(!fill){
    return
  }

  fill.style.width =

    (
      STATE.calibrationCount /
      STATE.calibrationFrames *
      100
    )

    +

    '%'
}

function hideOverlay(){

  const overlay =
    $('overlay')

  if(!overlay){
    return
  }

  overlay.classList.add(
    'hidden'
  )
}

function toast(message){

  const el =
    $('toast')

  if(!el){
    return
  }

  el.textContent = message

  el.classList.add('show')

  setTimeout(
    function(){
      el.classList.remove('show')
    },
    2500
  )
}

function setMicActive(active){

  const btn =
    $('btnMic')

  if(!btn){
    return
  }

  if(active){
    btn.classList.add('on')
  }
  else{
    btn.classList.remove('on')
  }
}