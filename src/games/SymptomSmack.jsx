import { useRef, useState } from 'react'
import GameShell from '../components/GameShell.jsx'
import { GAME_META } from './meta.js'
import { useGameLoop } from '../lib/useGameLoop.js'
import { sfx } from '../lib/sounds.js'

const SYMPTOMS = [
  { emoji: '😴', label: 'LOW ENERGY' },
  { emoji: '🌫️', label: 'BRAIN FOG' },
  { emoji: '😪', label: 'POOR SLEEP' },
  { emoji: '📉', label: 'LOW LIBIDO' },
  { emoji: '🦴', label: 'JOINT PAIN' },
  { emoji: '🍔', label: 'CRAVINGS' },
]
const DECOY = { emoji: '😊', label: 'HAPPY PATIENT!' }
const GAME_LEN = 45

export default function SymptomSmack({ onExit }) {
  const game = GAME_META['symptom-smack']
  const [score, setScore] = useState(0)
  const [timeLeft, setTimeLeft] = useState(GAME_LEN)
  const [, setFrame] = useState(0)
  const world = useRef(null)
  const endRef = useRef(() => {})

  const reset = () => {
    world.current = {
      holes: Array.from({ length: 9 }, () => ({ occupant: null, ttl: 0, hit: null })),
      spawnIn: 0.6,
      elapsed: 0,
      score: 0,
      nextId: 1,
    }
    setScore(0)
    setTimeLeft(GAME_LEN)
    setFrame((f) => f + 1) // guarantee a re-render so the loop starts
  }

  useGameLoop(!!world.current && timeLeft > 0, (dt) => {
    const w = world.current
    if (!w) return
    w.elapsed += dt
    const left = Math.max(0, GAME_LEN - w.elapsed)
    setTimeLeft(left)
    if (left <= 0) {
      const final = w.score
      world.current = null
      endRef.current(final)
      return
    }

    // Spawn into a random empty hole; gets faster over time
    w.spawnIn -= dt
    if (w.spawnIn <= 0) {
      const pace = Math.max(0.32, 0.85 - w.elapsed / 70)
      w.spawnIn = pace
      const empty = w.holes.map((h, i) => (h.occupant ? null : i)).filter((i) => i !== null)
      if (empty.length) {
        const idx = empty[Math.floor(Math.random() * empty.length)]
        const isDecoy = Math.random() < 0.18
        w.holes[idx] = {
          occupant: isDecoy ? { ...DECOY, decoy: true } : { ...SYMPTOMS[Math.floor(Math.random() * SYMPTOMS.length)] },
          ttl: Math.max(0.6, 1.5 - w.elapsed / 45),
          hit: null,
        }
      }
    }

    // Tick down occupants
    w.holes.forEach((h) => {
      if (h.occupant && !h.hit) {
        h.ttl -= dt
        if (h.ttl <= 0) h.occupant = null
      }
      if (h.hit) {
        h.hitTtl -= dt
        if (h.hitTtl <= 0) {
          h.occupant = null
          h.hit = null
        }
      }
    })

    setFrame((f) => f + 1)
  })

  const smack = (i) => {
    const w = world.current
    if (!w) return
    const h = w.holes[i]
    if (!h.occupant || h.hit) return
    if (h.occupant.decoy) {
      w.score = Math.max(0, w.score - 15)
      h.hit = { text: '-15!', color: '#ff3355' }
      sfx.bad()
    } else {
      w.score += 10
      h.hit = { text: '+10', color: '#4dff5e' }
      sfx.whack()
    }
    h.hitTtl = 0.35
    setScore(w.score)
  }

  return (
    <GameShell
      game={game}
      score={score}
      onExit={onExit}
      onStart={reset}
      extraHud={<span style={{ color: timeLeft < 10 ? '#ff3355' : '#22e5ff' }}>⏱ {Math.ceil(timeLeft)}s</span>}
    >
      {({ phase, end }) => {
        endRef.current = end
        const w = world.current
        return (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              userSelect: 'none',
            }}
          >
            {phase === 'playing' && w && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, minmax(80px, 130px))',
                  gap: 'clamp(10px, 3vw, 24px)',
                  padding: 12,
                }}
              >
                {w.holes.map((h, i) => (
                  <button
                    key={i}
                    onPointerDown={() => smack(i)}
                    style={{
                      aspectRatio: '1',
                      borderRadius: '50%',
                      border: '3px solid #a45bff',
                      background: 'radial-gradient(circle at 50% 65%, #241354, #0a0320 75%)',
                      boxShadow: 'inset 0 8px 18px rgba(0,0,0,0.9), 0 0 12px rgba(164,91,255,0.4)',
                      position: 'relative',
                      overflow: 'hidden',
                      cursor: 'pointer',
                      touchAction: 'manipulation',
                    }}
                  >
                    {h.occupant && (
                      <span
                        style={{
                          fontSize: 'clamp(30px, 6vw, 48px)',
                          display: 'inline-block',
                          animation: h.hit ? 'none' : 'popIn 0.2s ease',
                          transform: h.hit ? 'scale(0.6) rotate(20deg)' : undefined,
                          opacity: h.hit ? 0.5 : 1,
                          filter: h.occupant.decoy
                            ? 'drop-shadow(0 0 8px #ffe94a)'
                            : 'drop-shadow(0 0 8px #ff8a3d)',
                        }}
                      >
                        {h.hit ? '💥' : h.occupant.emoji}
                      </span>
                    )}
                    {h.occupant && !h.hit && (
                      <span
                        style={{
                          position: 'absolute',
                          bottom: 4,
                          left: 0,
                          right: 0,
                          fontSize: 'clamp(9px, 1.6vw, 13px)',
                          color: h.occupant.decoy ? '#ffe94a' : '#ffb08a',
                          fontFamily: 'var(--font-pixel)',
                        }}
                      >
                        {h.occupant.label}
                      </span>
                    )}
                    {h.hit && (
                      <span
                        className="score-pop"
                        style={{ left: '50%', top: '20%', transform: 'translateX(-50%)', color: h.hit.color }}
                      >
                        {h.hit.text}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      }}
    </GameShell>
  )
}
