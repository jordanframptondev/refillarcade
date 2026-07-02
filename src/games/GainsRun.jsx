import { useEffect, useRef, useState } from 'react'
import GameShell from '../components/GameShell.jsx'
import { GAME_META } from './meta.js'
import { useGameLoop } from '../lib/useGameLoop.js'
import { sfx } from '../lib/sounds.js'

const PLAYER_X = 22 // fixed x position (%)
const BOOSTS = [
  { emoji: '💊', points: 10 },
  { emoji: '🥗', points: 10 },
  { emoji: '💉', points: 15 },
  { emoji: '🧬', points: 25 },
]

// Random celebration shown when a pickup is collected
const BRO_WORDS = [
  'SWOLE!', 'GAINZ!', 'YOKED!', 'PUMPED!', 'SHREDDED!', 'JACKED!',
  'BEAST MODE!', "LET'S GOOO!", 'ABSOLUTE UNIT!', 'HUGE!', 'ANABOLIC!', 'MAXED OUT!',
]

export default function GainsRun({ onExit }) {
  const game = GAME_META['gains-run']
  const [score, setScore] = useState(0)
  const [, setFrame] = useState(0)
  const world = useRef(null)
  const endRef = useRef(() => {})
  const [alive, setAlive] = useState(false)

  const reset = () => {
    world.current = {
      y: 45, // player y (%)
      vy: 0,
      obstacles: [], // {id, x, gapY, gapH, passed}
      boosts: [], // {id, x, y, ...}
      pops: [],
      spawnIn: 1.2,
      elapsed: 0,
      dist: 0,
      score: 0,
      nextId: 1,
    }
    setScore(0)
    setAlive(true)
  }

  const flap = () => {
    const w = world.current
    if (!w) return
    w.vy = -55
    sfx.jump()
  }

  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'Space' || e.key === 'ArrowUp') {
        e.preventDefault()
        flap()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useGameLoop(alive, (dt) => {
    const w = world.current
    if (!w) return
    w.elapsed += dt
    const speed = 26 + Math.min(w.elapsed, 60) * 0.5 // %/s scroll speed, ramps

    // Physics
    w.vy += 130 * dt // gravity
    w.y += w.vy * dt

    // Spawn wall pairs with a gap
    w.spawnIn -= dt
    if (w.spawnIn <= 0) {
      w.spawnIn = Math.max(1.15, 1.9 - w.elapsed / 60)
      const gapH = Math.max(26, 38 - w.elapsed / 5)
      const gapY = 12 + Math.random() * (76 - gapH)
      w.obstacles.push({ id: w.nextId++, x: 108, gapY, gapH, passed: false })
      if (Math.random() < 0.6) {
        const b = BOOSTS[Math.floor(Math.random() * BOOSTS.length)]
        w.boosts.push({ id: w.nextId++, x: 108 + 12, y: gapY + gapH / 2, ...b })
      }
    }

    // Scroll world
    w.obstacles.forEach((o) => (o.x -= speed * dt))
    w.boosts.forEach((b) => (b.x -= speed * dt))
    w.obstacles = w.obstacles.filter((o) => o.x > -12)
    w.boosts = w.boosts.filter((b) => b.x > -8)

    w.dist += speed * dt
    // Passing an obstacle = +5
    w.obstacles.forEach((o) => {
      if (!o.passed && o.x < PLAYER_X - 4) {
        o.passed = true
        w.score += 5
        sfx.tick()
      }
    })

    // Collect boosts
    w.boosts = w.boosts.filter((b) => {
      if (Math.abs(b.x - PLAYER_X) < 5 && Math.abs(b.y - w.y) < 8) {
        w.score += b.points
        const word = BRO_WORDS[Math.floor(Math.random() * BRO_WORDS.length)]
        w.pops.push({ id: w.nextId++, x: b.x, y: b.y, text: `+${b.points} ${word}`, color: '#4dff5e', ttl: 0.9 })
        sfx.good()
        return false
      }
      return true
    })

    w.pops = w.pops.filter((p) => (p.ttl -= dt) > 0)

    // Collisions: floor/ceiling or walls
    const hitEdge = w.y < 3 || w.y > 95
    const hitWall = w.obstacles.some(
      (o) => Math.abs(o.x - PLAYER_X) < 6 && (w.y < o.gapY + 3 || w.y > o.gapY + o.gapH - 3),
    )
    setScore(w.score)
    if (hitEdge || hitWall) {
      const final = w.score
      world.current = null
      setAlive(false)
      endRef.current(final)
      return
    }
    setFrame((f) => f + 1)
  })

  return (
    <GameShell game={game} score={score} onExit={onExit} onStart={reset}>
      {({ phase, end }) => {
        endRef.current = end
        const w = world.current
        return (
          <div
            onPointerDown={phase === 'playing' ? flap : undefined}
            style={{
              position: 'absolute',
              inset: 0,
              touchAction: 'none',
              userSelect: 'none',
              background:
                'repeating-linear-gradient(90deg, rgba(34,229,255,0.05) 0 2px, transparent 2px 90px)',
            }}
          >
            {phase === 'playing' && w && (
              <>
                {/* Player */}
                <span
                  style={{
                    position: 'absolute',
                    left: `${PLAYER_X}%`,
                    top: `${w.y}%`,
                    transform: `translate(-50%, -50%) rotate(${Math.max(-25, Math.min(45, w.vy * 0.5))}deg)`,
                    fontSize: 38,
                    filter: 'drop-shadow(0 0 10px #22e5ff)',
                    zIndex: 5,
                  }}
                >
                  🏃
                </span>
                {/* Obstacles: plain neon walls top + bottom */}
                {w.obstacles.map((o) => (
                  <div key={o.id}>
                    <div
                      style={{
                        position: 'absolute',
                        left: `${o.x}%`,
                        top: 0,
                        height: `${o.gapY}%`,
                        width: '9%',
                        transform: 'translateX(-50%)',
                        background: 'repeating-linear-gradient(0deg, #3a2470 0 14px, #2b185c 14px 28px)',
                        border: '2px solid #a45bff',
                        borderTop: 'none',
                        borderRadius: '0 0 8px 8px',
                        boxShadow: '0 0 12px rgba(164,91,255,0.6)',
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        left: `${o.x}%`,
                        top: `${o.gapY + o.gapH}%`,
                        bottom: 0,
                        width: '9%',
                        transform: 'translateX(-50%)',
                        background: 'repeating-linear-gradient(0deg, #3a2470 0 14px, #2b185c 14px 28px)',
                        border: '2px solid #a45bff',
                        borderBottom: 'none',
                        borderRadius: '8px 8px 0 0',
                        boxShadow: '0 0 12px rgba(164,91,255,0.6)',
                      }}
                    />
                  </div>
                ))}
                {/* Boosts */}
                {w.boosts.map((b) => (
                  <span
                    key={b.id}
                    style={{
                      position: 'absolute',
                      left: `${b.x}%`,
                      top: `${b.y}%`,
                      transform: 'translate(-50%, -50%)',
                      fontSize: 28,
                      filter: 'drop-shadow(0 0 8px #ffe94a)',
                      animation: 'pulse 0.8s ease infinite',
                    }}
                  >
                    {b.emoji}
                  </span>
                ))}
                {w.pops.map((p) => (
                  <span key={p.id} className="score-pop" style={{ left: `${p.x}%`, top: `${p.y}%`, color: p.color }}>
                    {p.text}
                  </span>
                ))}
                <div style={{ position: 'absolute', bottom: 4, width: '100%', textAlign: 'center', color: '#6f5fb0', fontSize: 16 }}>
                  SPACE / tap to flap · grab 💊🥗💉🧬 · dodge the walls
                </div>
              </>
            )}
          </div>
        )
      }}
    </GameShell>
  )
}
