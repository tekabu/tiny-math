let ctx: AudioContext | null = null

function audio() {
  ctx ??= new AudioContext()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

/**
 * iOS only lets audio start inside a touch handler. Our sounds play after an
 * await (the DB save), so unlock the context on the very first touch instead.
 */
export function unlockAudio() {
  const ac = audio()
  const src = ac.createBufferSource()
  src.buffer = ac.createBuffer(1, 1, 22050)
  src.connect(ac.destination)
  src.start(0)
}

function tone(freq: number, start: number, dur: number, type: OscillatorType, vol = 0.25) {
  const ac = audio()
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  osc.type = type
  osc.frequency.value = freq
  const t = ac.currentTime + start
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(vol, t + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  osc.connect(gain).connect(ac.destination)
  osc.start(t)
  osc.stop(t + dur + 0.05)
}

/** bright rising "ding-ding" */
export function playCorrect() {
  tone(784, 0, 0.18, 'sine')
  tone(1175, 0.12, 0.35, 'sine')
}

/** low descending "bwomp" */
export function playWrong() {
  tone(220, 0, 0.25, 'square', 0.12)
  tone(165, 0.2, 0.4, 'square', 0.12)
}

/** quick "pop" when the little piñata bursts */
export function playPop() {
  tone(1400, 0, 0.08, 'triangle', 0.3)
  tone(1047, 0.06, 0.15, 'triangle', 0.2)
}

/** little fanfare for 100% */
export function playFanfare() {
  ;[523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.3, 'triangle'))
  tone(1047, 0.5, 0.6, 'triangle')
}
