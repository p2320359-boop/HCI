// ========================================
// audio.js
// ========================================

'use strict'

async function startMic(){

  try{

    const stream =
      await navigator
      .mediaDevices
      .getUserMedia({
        audio:true
      })

    STATE.mediaStream = stream

    STATE.audioContext =
      new (
        window.AudioContext ||
        window.webkitAudioContext
      )()

    if(
      STATE.audioContext.state ===
      'suspended'
    ){

      await STATE.audioContext.resume()
    }

    const source =
      STATE.audioContext
      .createMediaStreamSource(
        stream
      )

    STATE.analyser =
      STATE.audioContext
      .createAnalyser()

    STATE.analyser.fftSize = 2048

    STATE.analyser
      .smoothingTimeConstant = 0.3

    source.connect(
      STATE.analyser
    )

    STATE.freqData =
      new Uint8Array(
        STATE.analyser.frequencyBinCount
      )

    STATE.timeData =
      new Uint8Array(
        STATE.analyser.frequencyBinCount
      )

    STATE.previousSpectrum = null

    STATE.speaking = false

    STATE.audioReady = true

    STATE.audioRunning = true

    startCalibration()

    STATE.audioTimer =
      setInterval(
        readAudio,
        50
      )

    startRenderLoop()

    console.log(
      'Audio Started'
    )

  }
  catch(error){

    console.error(error)

    alert(
      'Microphone access failed'
    )
  }
}

function stopMic(){

  STATE.audioRunning = false

  STATE.audioReady = false

  STATE.speaking = false

  if(
    STATE.audioTimer
  ){

    clearInterval(
      STATE.audioTimer
    )

    STATE.audioTimer = null
  }

  if(
    STATE.mediaStream
  ){

    STATE.mediaStream
      .getTracks()
      .forEach(
        track =>
        track.stop()
      )

    STATE.mediaStream = null
  }

  if(
    STATE.audioContext
  ){

    STATE.audioContext.close()

    STATE.audioContext = null
  }

  if(
    STATE.rafId
  ){

    cancelAnimationFrame(
      STATE.rafId
    )
  }
}

function startCalibration(){

  STATE.calibrating = true

  STATE.calibrationCount = 0

  STATE.calibrationValues = []

}

function readAudio(){

  if(
    !STATE.analyser ||
    !STATE.audioReady
  ){
    return
  }

  STATE.analyser
    .getByteFrequencyData(
      STATE.freqData
    )

  STATE.analyser
    .getByteTimeDomainData(
      STATE.timeData
    )

  const sr =
    STATE.audioContext.sampleRate

  const N =
    STATE.freqData.length

  const binHz =
    sr /
    STATE.analyser.fftSize

  const voiceLow =
    Math.max(
      2,
      Math.floor(65/binHz)
    )

  const voiceHigh =
    Math.min(
      N-1,
      Math.floor(8000/binHz)
    )

  calculateRMS()

  calculateSpectralEnergy(
    voiceLow,
    voiceHigh
  )

  calculateCentroid(
    voiceLow,
    voiceHigh,
    binHz
  )

  calculateFlux(
    voiceLow,
    voiceHigh
  )

  calculatePitch(
    voiceLow,
    N,
    sr
  )

  calculateHarmonicity(
    voiceLow,
    voiceHigh
  )

  if(
    STATE.calibrating
  ){

    updateCalibration()

    return
  }

  detectVoice()

  updateSpeechRate()

  updateSmoothedFeatures()
}

function calculateRMS(){

  let sum = 0

  for(
    let i=0;
    i<STATE.timeData.length;
    i++
  ){

    const v =
      (STATE.timeData[i]-128)
      /128

    sum += v*v
  }

  STATE.rawRms =
    Math.sqrt(
      sum /
      STATE.timeData.length
    )
}

function calculateSpectralEnergy(
  low,
  high
){

  let sum = 0

  for(
    let i=low;
    i<=high;
    i++
  ){

    sum +=
      STATE.freqData[i] *
      STATE.freqData[i]
  }

  STATE.spectralEnergy =
    Math.sqrt(
      sum /
      Math.max(
        high-low+1,
        1
      )
    )
}

// ========================================
// Audio Feature Extraction
// ========================================

function calculateCentroid(
  low,
  high,
  binHz
){

  let weighted = 0
  let total = 0

  for(
    let i=low;
    i<=high;
    i++
  ){

    const value =
      STATE.freqData[i]

    weighted +=
      i * value

    total += value
  }

  if(total > 15){

    const hz =
      (weighted / total)
      * binHz

    STATE.rawCentroid =
      clamp(
        (hz - 65) / 5000,
        0,
        1
      )
  }
}

function calculateFlux(
  low,
  high
){

  let flux = 0

  if(
    STATE.previousSpectrum
  ){

    for(
      let i=low;
      i<=high;
      i++
    ){

      const diff =
        STATE.freqData[i]
        -
        STATE.previousSpectrum[i]

      flux += diff * diff
    }
  }

  STATE.previousSpectrum =
    new Uint8Array(
      STATE.freqData
    )

  STATE.rawFlux =
    Math.sqrt(
      flux /
      Math.max(
        high-low+1,
        1
      )
    )
}

function calculatePitch(
  low,
  N,
  sampleRate
){

  let maxValue = 0
  let maxIndex = 0

  for(
    let i=low;
    i<N/2;
    i++
  ){

    if(
      STATE.freqData[i]
      >
      maxValue
    ){

      maxValue =
        STATE.freqData[i]

      maxIndex = i
    }
  }

  const peakHz =
    (maxIndex / N)
    *
    (sampleRate / 2)

  if(
    peakHz > 60
    &&
    peakHz < 800
  ){

    STATE.rawHz =
      peakHz
  }
}

function calculateHarmonicity(
  low,
  high
){

  let peakEnergy = 0
  let noiseEnergy = 0
  let peakCount = 0

  for(
    let i=low+2;
    i<high-2;
    i++
  ){

    const v =
      STATE.freqData[i]

    const isPeak =

      v >
      STATE.freqData[i-1]

      &&

      v >
      STATE.freqData[i+1]

      &&

      v >
      STATE.freqData[i-2]

      &&

      v >
      STATE.freqData[i+2]

      &&

      v > 25

    if(isPeak){

      peakEnergy +=
        v*v

      peakCount++
    }
    else{

      noiseEnergy +=
        v*v
    }
  }

  if(
    peakCount > 2
    &&
    noiseEnergy > 0
  ){

    STATE.rawHarmonicity =
      clamp(
        peakEnergy /
        (
          peakEnergy
          +
          noiseEnergy*0.5
        ),
        0,
        1
      )
  }
}

// ========================================
// Voice Detection
// ========================================

function detectVoice(){

  const wasSpeaking =
    STATE.speaking

  if(
    STATE.spectralEnergy
    >
    STATE.noiseGate * 0.9
  ){

    STATE.speaking = true
  }
  else if(
    STATE.spectralEnergy
    <
    STATE.noiseFloor * 1.2
  ){

    STATE.speaking = false
  }

  STATE.lastSpeaking =
    wasSpeaking
}

function updateCalibration(){

  STATE.calibrationValues.push(
    STATE.spectralEnergy
  )

  STATE.calibrationCount++

  if(
    STATE.calibrationCount
    <
    STATE.calibrationFrames
  ){
    return
  }

  STATE.calibrationValues.sort(
    (a,b)=>a-b
  )

  STATE.noiseFloor =
    STATE.calibrationValues[
      Math.floor(
        STATE.calibrationValues.length
        * 0.9
      )
    ] || 3

  STATE.noiseGate =
    Math.max(
      STATE.noiseFloor * 1.3,
      2
    )

  STATE.calibrating = false

  STATE.worldStart =
    performance.now()
}

function updateSpeechRate(){

  const now =
    performance.now()

  if(
    STATE.speaking
    &&
    STATE.rawFlux > 8
  ){

    const times =
      STATE.syllableTimes

    if(
      !times.length
      ||
      now -
      times[times.length-1]
      >
      120
    ){

      times.push(now)
    }
  }

  STATE.syllableTimes =
    STATE.syllableTimes.filter(
      t =>
      t > now - 3000
    )

  if(
    STATE.syllableTimes.length >= 3
  ){

    const arr =
      STATE.syllableTimes

    STATE.speechRate =

      (arr.length - 1)

      /

      Math.max(
        (
          arr[arr.length-1]
          -
          arr[0]
        )
        /
        1000,
        0.1
      )
  }
}

function updateSmoothedFeatures(){

  const smooth = 0.3

  const voiceAmount =

    STATE.speaking

    ?

    clamp(
      (
        STATE.spectralEnergy
        -
        STATE.noiseGate
      )
      /
      (
        STATE.noiseGate*3
      ),
      0,
      1
    )

    :

    0

  STATE.smoothVolume =
    lerp(
      STATE.smoothVolume,
      voiceAmount,
      smooth
    )

  STATE.smoothCentroid =
    lerp(
      STATE.smoothCentroid,
      STATE.rawCentroid,
      smooth
    )

  STATE.smoothFlux =
    lerp(
      STATE.smoothFlux,
      clamp(
        STATE.rawFlux / 40,
        0,
        1
      ),
      smooth*0.5
    )

  STATE.smoothHz =
    lerp(
      STATE.smoothHz,
      STATE.rawHz || 200,
      smooth
    )

  STATE.smoothHarmonicity =
    lerp(
      STATE.smoothHarmonicity,
      STATE.rawHarmonicity,
      smooth
    )
}