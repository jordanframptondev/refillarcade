// Tiny WebAudio synth for arcade blips — no audio assets needed.
const MUTE_KEY = 'refillarcade.muted'
let ctx = null

function audio() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)()
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

export function isMuted() {
  return localStorage.getItem(MUTE_KEY) === '1'
}

export function toggleMute() {
  const next = !isMuted()
  localStorage.setItem(MUTE_KEY, next ? '1' : '0')
  return next
}

function tone(freq, dur = 0.08, type = 'square', vol = 0.08, when = 0) {
  if (isMuted()) return
  try {
    const ac = audio()
    const t = ac.currentTime + when
    const osc = ac.createOscillator()
    const gain = ac.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t)
    gain.gain.setValueAtTime(vol, t)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    osc.connect(gain).connect(ac.destination)
    osc.start(t)
    osc.stop(t + dur + 0.02)
  } catch {
    // audio blocked — stay silent
  }
}

export const sfx = {
  blip: () => tone(880, 0.06),
  coin: () => { tone(988, 0.07); tone(1319, 0.18, 'square', 0.08, 0.07) },
  good: () => { tone(659, 0.06); tone(880, 0.1, 'square', 0.08, 0.06) },
  bad: () => tone(140, 0.25, 'sawtooth', 0.1),
  jump: () => tone(523, 0.1, 'triangle', 0.1),
  whack: () => tone(220, 0.08, 'square', 0.12),
  levelUp: () => { tone(523, 0.08); tone(659, 0.08, 'square', 0.08, 0.08); tone(784, 0.2, 'square', 0.08, 0.16) },
  gameOver: () => { tone(392, 0.15, 'sawtooth', 0.09); tone(311, 0.15, 'sawtooth', 0.09, 0.15); tone(233, 0.4, 'sawtooth', 0.09, 0.3) },
  select: () => { tone(659, 0.05); tone(988, 0.08, 'square', 0.07, 0.05) },
  tick: () => tone(1200, 0.03, 'square', 0.04),
}
