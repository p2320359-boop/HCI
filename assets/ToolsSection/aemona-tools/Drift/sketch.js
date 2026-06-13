let palette = ['#f398c3', '#cf3895', '#a0d28d', '#06b4b0', '#fed000', '#FF8552']

let gradients = []
let noiseZs = []
let m
let radius
let seed

const PARAMS = {
	step: 75,
	precision: 30,
	diff: 0.3,
	noiseAmt: 0.5,
	noiseScale: 0.8
}

function setVars() {

	m = floor(min(width, height) * 0.9)
	m = floor(m / PARAMS.step) * PARAMS.step

	radius = PARAMS.step * 0.4

	gradients = []
	noiseZs = []

	let i = 0

	for (let x = 0; x < m; x += PARAMS.step) {

		for (let y = 0; y < m; y += PARAMS.step) {

			let gx = random(
				PARAMS.step * -0.25,
				PARAMS.step * 0.25
			)

			let gy = random(
				PARAMS.step * -0.25,
				PARAMS.step * 0.25
			)

			let gradient =
				drawingContext.createRadialGradient(
					gx,
					gy,
					0,
					gx,
					gy,
					PARAMS.step
				)

			gradient.addColorStop(
				0,
				random(palette)
			)

			gradient.addColorStop(
				1,
				random(palette)
			)

			gradients.push(gradient)

			noiseZs[i] = random(100, 500)

			i++
		}
	}
}

function setup() {

	seed = floor(random(1000))

	createCanvas(430, 360).parent('canvas-wrapper')

	noLoop()

	setVars()
}

function draw() {

	background('#F9F7F3')

	push()

	translate(
		(width - m + PARAMS.step) / 2,
		(height - m + PARAMS.step) / 2+20
	)

	noStroke()

	let i = 0

	for (let x = 0; x < m; x += PARAMS.step) {

		for (let y = 0; y < m; y += PARAMS.step) {

			push()

			drawingContext.fillStyle = gradients[i]

			translate(x, y)

			rotate(
				noise(
					y + PARAMS.step,
					x - y
				) * TWO_PI
			)

			noisyCircle(
				radius,
				noiseZs[i]
			)

			noFill()

			stroke(255)

			strokeWeight(2)

			noisyCircle(
				radius,
				noiseZs[i] + PARAMS.diff
			)

			noisyCircle(
				radius,
				noiseZs[i] + PARAMS.diff * 2
			)

			pop()

			i++
		}
	}

	pop()
}

function keyPressed() {

	if (keyCode === 32) {

		seed++

		noiseSeed(seed)

		setVars()

		redraw()
	}
}

function mousePressed() {

	seed++

	noiseSeed(seed)

	setVars()

	redraw()
}

function noisyCircle(r, noiseZ) {

	beginShape()

	let angleStep =
		TWO_PI / PARAMS.precision

	let noiseAmount =
		r * PARAMS.noiseAmt

	let noiseScale =
		PARAMS.noiseScale / r

	for (
		let i = -1;
		i <= PARAMS.precision + 1;
		i++
	) {

		let angle =
			angleStep * i

		let x =
			cos(angle) * r

		let y =
			sin(angle) * r

		let n = noise(
			noiseScale * x,
			noiseScale * y,
			noiseZ
		)

		n = map(
			n,
			0,
			1,
			-noiseAmount,
			noiseAmount
		)

		curveVertex(
			x + n,
			y + n
		)
	}

	endShape()
}
