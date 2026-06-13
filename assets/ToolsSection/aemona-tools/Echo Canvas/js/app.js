// ========================================
// app.js
// ========================================

'use strict'

// Track previous calibration state so we know when it just finished
var _wasCalibrating = false

window.addEventListener(
  'load',
  init
)

function init(){

  setupCanvas()

  resizeCanvas()   // must run first — sets STATE.width/height

  paintBackground()

  bindUI()
}

function bindUI(){

  // Mic is the single entry point — no Begin button
  $('btnMic')?.addEventListener(
    'click',
    toggleMic
  )

  $('btnSave')?.addEventListener(
    'click',
    saveArtwork
  )

  $('btnSaveLg')?.addEventListener(
    'click',
    saveArtwork
  )

  $('btnReset')?.addEventListener(
    'click',
    resetCanvas
  )

  $('btnResetLg')?.addEventListener(
    'click',
    resetCanvas
  )

  window.addEventListener(
    'resize',
    resizeCanvas
  )

  document.addEventListener(
    'dblclick',
    function(e){ e.preventDefault() }
  )
}

function toggleMic(){

  if(STATE.audioRunning){

    stopMic()

    setMicActive(false)

    hideOverlay()

  } else {

    // Show calibration overlay before the async mic setup begins
    showCalibrationOverlay()

    setMicActive(true)

    startMic().catch(function(){

      // Mic permission denied / error — roll back UI
      setMicActive(false)

      hideOverlay()
    })
  }
}

// ─── Render loop ──────────────────────────────────────────────────────────────

function startRenderLoop(){

  if(STATE.rafId){
    cancelAnimationFrame(STATE.rafId)
  }

  _wasCalibrating = true  // mic just started, calibration is first

  render()
}

function render(){

  STATE.frame++

  updateStats()

  if(!STATE.audioRunning){

    // Keep looping so stats stay live even when stopped
    STATE.rafId = requestAnimationFrame(render)

    return
  }

  if(STATE.calibrating){

    updateCalibrationProgress()

  } else {

    // Calibration just finished — hide the overlay once
    if(_wasCalibrating){

      hideOverlay()

      _wasCalibrating = false
    }

    paintVoice()

    updatePathBreaks()

    checkEmphasis()

    diffuseCanvas()
  }

  STATE.rafId = requestAnimationFrame(render)
}
