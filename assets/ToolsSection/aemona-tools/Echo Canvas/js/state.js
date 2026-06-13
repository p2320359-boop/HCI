// ========================================
// state.js
// Global Runtime State
// ========================================

'use strict'

const STATE = {

  // ====================
  // Canvas
  // ====================

  canvas:null,
  ctx:null,

  grainCanvas:null,
  grainCtx:null,

  width:0,
  height:0,
  dpr:1,

  frame:0,

  // ====================
  // Audio Engine
  // ====================

  audioContext:null,
  analyser:null,
  mediaStream:null,

  freqData:null,
  timeData:null,

  audioRunning:false,
  audioReady:false,

  audioTimer:null,
  rafId:null,

  // ====================
  // Calibration
  // ====================

  calibrating:false,

  calibrationFrames:60,

  calibrationCount:0,

  calibrationValues:[],

  noiseFloor:0,

  noiseGate:0,

  // ====================
  // Raw Audio Features
  // ====================

  rawRms:0,

  spectralEnergy:0,

  rawCentroid:0.5,

  rawFlux:0,

  rawHz:0,

  rawHarmonicity:0.5,

  previousSpectrum:null,

  // ====================
  // Voice Detection
  // ====================

  speaking:false,

  lastSpeaking:false,

  lastSpeakEnd:0,

  silenceFrames:0,

  // ====================
  // Smoothed Features
  // ====================

  smoothVolume:0,

  smoothCentroid:0.5,

  smoothFlux:0,

  smoothHz:220,

  smoothHarmonicity:0.5,

  smoothPresence:0,

  // ====================
  // Speech Rhythm
  // ====================

  syllableTimes:[],

  speechRate:0,

  emphasisAccumulator:0,

  // ====================
  // World
  // ====================

  worldStart:0,

  worldAge:0,

  hasPainted:false,

  // ====================
  // Path System
  // ====================

  paths:[],

  currentPath:null,

  maxPaths:14,

  // ====================
  // UI
  // ====================

  overlayVisible:true,

  statsVisible:true,

  // ====================
  // Config
  // ====================

  backgroundColor:'#F5F2EB'

}