// ========================================
// painter.js
// ========================================

'use strict'

function worldAge(){

  if(
    STATE.worldStart <= 0
  ){
    return 0
  }

  return (

    performance.now()

    -

    STATE.worldStart

  ) / 1000
}

function mkPath(){

  const margin =

    STATE.width * 0.12

  return {

    x:R(
      margin,
      STATE.width-margin
    ),

    y:R(
      margin,
      STATE.height-margin
    ),

    angle:R(
      0,
      Math.PI*2
    ),

    colorBias:
      STATE.smoothCentroid,

    age:0,

    colorDrift:R(
      -0.04,
      0.04
    ),

    width:R(
      20,
      55
    ),

    speed:R(
      0.4,
      0.9
    ),

    strokeCount:0,

    brushType:

      Math.random() < 0.5

      ?

      'oil'

      :

      'wc'
  }
}

function createNewPath(){

  STATE.currentPath =
    mkPath()

  STATE.paths.push(
    STATE.currentPath
  )

  if(

    STATE.paths.length

    >

    STATE.maxPaths

  ){

    STATE.paths.shift()
  }
}

function updatePathBreaks(){

  const wasSpeaking =
    STATE.lastSpeaking

  const speaking =
    STATE.speaking

  if(

    wasSpeaking

    &&

    !speaking

  ){

    STATE.lastSpeakEnd =
      performance.now()
  }

  if(

    !wasSpeaking

    &&

    speaking

  ){

    const pauseLength =

      STATE.lastSpeakEnd > 0

      ?

      performance.now()
      -
      STATE.lastSpeakEnd

      :

      9999

    if(

      pauseLength > 1500

      ||

      !STATE.currentPath

    ){

      createNewPath()
    }
  }
}

function paintVoice(){

  if(
    !STATE.speaking
  ){
    return
  }

  if(
    STATE.spectralEnergy
    <
    STATE.noiseGate * 0.8
  ){
    return
  }

  const path =
    STATE.currentPath

  if(!path){
    return
  }

  path.age++

  STATE.hasPainted = true

  const age =
    worldAge()

  const voiceAmount =

    clamp(

      (
        STATE.spectralEnergy
        -
        STATE.noiseGate
      )

      /

      (
        STATE.noiseGate * 3
      ),

      0,
      1

    )

  const pressure =

    0.35

    +

    voiceAmount * 0.65

  const brushWidth =

    path.width

    *

    pressure

    *

    R(
      1.2,
      2.0
    )

  const colorPosition =

    path.colorBias

    +

    path.colorDrift

    *

    path.age

    /

    50

  const color =

    mkCol(

      colorPosition

      +

      STATE.smoothCentroid
      *
      0.2

      +

      R(
        -0.06,
        0.06
      ),

      0.4
      +
      voiceAmount
      *
      0.6

    )

  const pigment =

    0.25

    +

    voiceAmount
    *
    0.25

  const speechFactor =

    clamp(

      STATE.speechRate
      /
      6,

      0,
      1

    )

  const strokeLength =

    30

    +

    voiceAmount
    *
    75

    +

    (

      speechFactor > 0.5

      ?

      35

      :

      0

    )

  const turbulence =

    0.3

    +

    STATE.smoothFlux
    *
    0.7

  const direction =

    path.angle

    +

    gauss()

    *

    0.25

    *

    (
      0.3
      +
      STATE.smoothFlux
      *
      0.7
    )

  const x1 =
    path.x + gauss()*4

  const y1 =
    path.y + gauss()*4

  const x2 =

    x1

    +

    Math.cos(direction)

    *

    strokeLength

  const y2 =

    y1

    +

    Math.sin(direction)

    *

    strokeLength

  const cpx =

    (x1+x2)/2

    +

    gauss()

    *

    strokeLength

    *

    0.3

    *

    turbulence

  const cpy =

    (y1+y2)/2

    +

    gauss()

    *

    strokeLength

    *

    0.3

    *

    turbulence

      const strokeCount =

    1

    +

    Math.floor(
      voiceAmount * 3
    )

  for(
    let i=0;
    i<strokeCount;
    i++
  ){

    const sx1 =
      x1 + gauss()*5

    const sy1 =
      y1 + gauss()*5

    const sx2 =
      x2 + gauss()*5

    const sy2 =
      y2 + gauss()*5

        const subCPX =

      (sx1+sx2)/2

      +

      gauss()

      *

      8

      *

      turbulence

    const subCPY =

      (sy1+sy2)/2

      +

      gauss()

      *

      8

      *

      turbulence

    const subWidth =

      brushWidth

      *

      R(
        0.6,
        1.2
      )

        const subColor =

      mkCol(

        colorPosition

        +

        STATE.smoothCentroid
        *
        0.15

        +

        R(
          -0.05,
          0.05
        )

        +

        i*0.015,

        0.4

        +

        voiceAmount
        *
        0.55

      )

        let brushType =
      path.brushType

    if(
      age < 10
    ){

      brushType =
        'wc'
    }

    else if(

      voiceAmount < 0.25

      &&

      Math.random() < 0.4

    ){

      brushType =
        'dry'
    }

    else if(

      Math.random() < 0.12

    ){

      brushType =

        choose([
          'oil',
          'wc',
          'dry'
        ])
    }

        doStroke(

      sx1,
      sy1,

      sx2,
      sy2,

      subCPX,
      subCPY,

      subWidth,

      subColor,

      pigment,

      brushType,

      turbulence

    )

  }

    if(

    STATE.frame % 8 === 0

    &&

    voiceAmount > 0.15

  ){

    wash(

      x1 +
      gauss()*30,

      y1 +
      gauss()*30,

      120
      +
      voiceAmount
      *
      180,

      mkCol(

        colorPosition

        +

        R(
          -0.08,
          0.08
        ),

        0.35

      ),

      0.08

    )
  }

    path.x = x2
  path.y = y2

  path.angle +=

    gauss()

    *

    0.12

  path.strokeCount++

    const margin =

    STATE.width * 0.07

  if(

    path.x < margin

    ||

    path.x >

    STATE.width - margin

  ){

    path.angle =
      Math.PI -
      path.angle
  }

  if(

    path.y < margin

    ||

    path.y >

    STATE.height - margin

  ){

    path.angle =
      -path.angle
  }

  path.x = clamp(
    path.x,
    margin,
    STATE.width-margin
  )

  path.y = clamp(
    path.y,
    margin,
    STATE.height-margin
  )

}

function diffuseCanvas(){

  if(
    STATE.speaking
  ){

    STATE.silenceFrames = 0

    return
  }

  STATE.silenceFrames++

  if(

    STATE.silenceFrames > 100

    &&

    STATE.silenceFrames % 35 === 0

  ){

    const ctx = STATE.ctx

    ctx.save()

    ctx.filter =
      'blur(0.5px)'

    ctx.globalAlpha =
      0.988

    ctx.drawImage(

      STATE.canvas,

      0,
      0,

      STATE.width,
      STATE.height

    )

    ctx.restore()
  }


    if(

    STATE.silenceFrames > 300

    &&

    STATE.silenceFrames % 70 === 0

  ){

    const ctx = STATE.ctx

    ctx.save()

    ctx.globalAlpha =
      0.003

    ctx.fillStyle =
      STATE.backgroundColor

    ctx.fillRect(

      0,
      0,

      STATE.width,
      STATE.height

    )

    ctx.restore()
  }

}

function checkEmphasis(){

  if(

    STATE.emphasisAccumulator

    <

    2.5

  ){

    return
  }

  STATE.emphasisAccumulator = 0

  const x =

    R(
      STATE.width*0.2,
      STATE.width*0.8
    )

  const y =

    R(
      STATE.height*0.2,
      STATE.height*0.8
    )

  const radius =

    90

    +

    STATE.smoothVolume
    *
    220

      wash(

    x,
    y,

    radius,

    mkCol(

      STATE.smoothCentroid

      +

      R(
        -0.15,
        0.15
      ),

      0.5

      +

      STATE.smoothVolume
      *
      0.5

    ),

    0.04

    +

    STATE.smoothVolume
    *
    0.07

  )

    const burstCount =

    3

    +

    Math.floor(
      STATE.smoothVolume * 5
    )

  for(

    let i=0;

    i<burstCount;

    i++

  ){

    const angle =
      R(
        0,
        Math.PI*2
      )

    const length =

      radius

      *

      R(
        0.4,
        1
      )

    const bx =
      x + gauss()*10

    const by =
      y + gauss()*10

    const bx2 =

      bx

      +

      Math.cos(angle)

      *

      length

    const by2 =

      by

      +

      Math.sin(angle)

      *

      length

        doStroke(

      bx,
      by,

      bx2,
      by2,

      (bx+bx2)/2

      +

      gauss()*20,

      (by+by2)/2

      +

      gauss()*20,

      R(
        10,
        20
      ),

      mkCol(

        STATE.smoothCentroid

        +

        R(
          -0.1,
          0.1
        ),

        0.55

        +

        STATE.smoothVolume
        *
        0.4

      ),

      0.1

      +

      STATE.smoothVolume
      *
      0.14,

      choose([
        'oil',
        'wc',
        'dry'
      ]),

      0.5

    )

  }

}

function paintBackground(){

  const ctx = STATE.ctx

  ctx.fillStyle =
    STATE.backgroundColor

  ctx.fillRect(

    0,
    0,

    STATE.width,
    STATE.height

  )
}

function createGrain(){

  const ctx =
    STATE.grainCtx

  const imageData =

    ctx.createImageData(

      STATE.width,
      STATE.height

    )

  const data =
    imageData.data

  for(

    let i=0;

    i<data.length;

    i+=4

  ){

    const value =

      Math.random()*255

    data[i] = value
    data[i+1] = value
    data[i+2] = value

    data[i+3] = 22
  }

  ctx.putImageData(
    imageData,
    0,
    0
  )
}

// resizeCanvas is defined (and authoritative) in ui.js
// This duplicate is kept for reference only — ui.js version overrides it