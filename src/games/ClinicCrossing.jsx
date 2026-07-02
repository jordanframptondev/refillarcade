import { useEffect, useRef, useState } from 'react'
import GameShell from '../components/GameShell.jsx'
import DPad from '../components/DPad.jsx'
import { GAME_META } from './meta.js'
import { useGameLoop } from '../lib/useGameLoop.js'
import { sfx } from '../lib/sounds.js'

const COLS = 13
// Rows top→bottom: 0 = medspa door, 8 = starting sidewalk
const LANES = {
  1: { dir: 1, speed: 17, emoji: '📄', label: 'PAPERWORK', gap: 26 },
  2: { dir: -1, speed: 23, emoji: '🛵', label: 'COURIER', gap: 34 },
  4: { dir: 1, speed: 19, emoji: '🍩', label: 'SUGAR', gap: 28 },
  5: { dir: -1, speed: 14, emoji: '☀️', label: 'UV RAYS', gap: 24 },
  7: { dir: 1, speed: 25, emoji: '📱', label: 'DOOMSCROLLER', gap: 36 },
}
const ROWS = 9
const START = { r: 8, c: 6 }
const HIT_DIST = 4.4

export default function ClinicCrossing({ onExit }) {
  const game = GAME_META['clinic-crossing']
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(3)
  const [level, setLevel] = useState(1)
  const [, setFrame] = useState(0)
  const world = useRef(null)
  const endRef = useRef(() => {})

  const laneSpeed = (w, r) => LANES[r].speed * (1 + (w.level - 1) * 0.18)

  const buildTraffic = (w) => {
    w.traffic = {}
    for (const r of Object.keys(LANES)) {
      const lane = LANES[r]
      w.traffic[r] = []
      for (let x = Math.random() * lane.gap; x < 106; x += lane.gap * (0.8 + Math.random() * 0.5)) {
        w.traffic[r].push({ x })
      }
    }
  }

  const reset = () => {
    const w = {
      player: { ...START },
      bestRow: START.r,
      level: 1,
      lives: 3,
      score: 0,
      invuln: 0,
      banner: null,
      pops: [],
      nextId: 1,
    }
    buildTraffic(w)
    world.current = w
    setScore(0)
    setLives(3)
    setLevel(1)
    setFrame((f) => f + 1) // guarantee a re-render so the loop starts
  }

  const respawn = (w) => {
    w.player = { ...START }
    w.bestRow = START.r
    w.invuln = 1.2
  }

  const move = (dir) => {
    const w = world.current
    if (!w) return
    const p = w.player
    if (dir === 'up') p.r -= 1
    if (dir === 'down') p.r += 1
    if (dir === 'left') p.c -= 1
    if (dir === 'right') p.c += 1
    p.r = Math.max(0, Math.min(ROWS - 1, p.r))
    p.c = Math.max(0, Math.min(COLS - 1, p.c))
    sfx.tick()
    // Points for pushing further forward this crossing
    if (p.r < w.bestRow) {
      w.bestRow = p.r
      w.score += 10
      setScore(w.score)
    }
    // Made it to the medspa!
    if (p.r === 0) {
      w.score += 100
      w.level += 1
      w.banner = { text: `CHECKED IN! +100 — SHIFT ${w.level}`, ttl: 1.6 }
      respawn(w)
      w.invuln = 0.6
      sfx.coin()
      setScore(w.score)
      setLevel(w.level)
    }
  }

  useEffect(() => {
    const onKey = (e) => {
      const map = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' }
      if (map[e.key]) {
        e.preventDefault()
        move(map[e.key])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useGameLoop(!!world.current && lives > 0, (dt) => {
    const w = world.current
    if (!w) return
    if (w.invuln > 0) w.invuln -= dt
    if (w.banner && (w.banner.ttl -= dt) <= 0) w.banner = null

    // Traffic flows
    for (const r of Object.keys(w.traffic)) {
      const lane = LANES[r]
      const speed = laneSpeed(w, r) * lane.dir
      for (const item of w.traffic[r]) {
        item.x += speed * dt
        if (item.x > 106) item.x -= 112
        if (item.x < -6) item.x += 112
      }
    }

    // Collision with the player's lane
    const p = w.player
    if (w.invuln <= 0 && w.traffic[p.r]) {
      const playerX = ((p.c + 0.5) / COLS) * 100
      if (w.traffic[p.r].some((item) => Math.abs(item.x - playerX) < HIT_DIST)) {
        w.lives -= 1
        w.pops.push({ id: w.nextId++, r: p.r, c: p.c, text: LANES[p.r].label + '!', color: '#ff3355', ttl: 1 })
        respawn(w)
        sfx.bad()
        setLives(w.lives)
      }
    }

    w.pops = w.pops.filter((pp) => (pp.ttl -= dt) > 0)

    if (w.lives <= 0) {
      const final = w.score
      world.current = null
      endRef.current(final)
      return
    }
    setFrame((f) => f + 1)
  })

  const rowTop = (r) => ((r + 0.5) / ROWS) * 100
  const colLeft = (c) => ((c + 0.5) / COLS) * 100

  return (
    <GameShell
      game={game}
      score={score}
      onExit={onExit}
      onStart={reset}
      extraHud={
        <>
          <span style={{ color: '#a45bff' }}>SHIFT {level}</span>
          <span style={{ color: '#ff3355' }}>{'❤️'.repeat(Math.max(lives, 0)) || '💔'}</span>
        </>
      }
    >
      {({ phase, end }) => {
        endRef.current = end
        const w = world.current
        return (
          <div style={{ position: 'absolute', inset: 0, userSelect: 'none' }}>
            {phase === 'playing' && w && (
              <>
                {/* Lane striping + goal/start rows */}
                {Array.from({ length: ROWS }, (_, r) => (
                  <div
                    key={r}
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      top: `${(r / ROWS) * 100}%`,
                      height: `${100 / ROWS}%`,
                      background:
                        r === 0
                          ? 'linear-gradient(180deg, rgba(255,47,185,0.22), rgba(255,47,185,0.08))'
                          : LANES[r]
                            ? 'rgba(255,255,255,0.035)'
                            : 'transparent',
                      borderBottom: LANES[r] ? '1px dashed rgba(164,91,255,0.35)' : '1px solid rgba(164,91,255,0.15)',
                    }}
                  />
                ))}
                {/* The medspa door row */}
                <div
                  style={{
                    position: 'absolute',
                    top: `${rowTop(0)}%`,
                    left: 0,
                    right: 0,
                    transform: 'translateY(-50%)',
                    textAlign: 'center',
                    fontSize: 24,
                    letterSpacing: 30,
                    filter: 'drop-shadow(0 0 10px #ff2fb9)',
                  }}
                >
                  🏥🏥🏥
                </div>
                {/* Traffic */}
                {Object.keys(w.traffic).flatMap((r) =>
                  w.traffic[r].map((item, i) => (
                    <span
                      key={`${r}-${i}`}
                      style={{
                        position: 'absolute',
                        left: `${item.x}%`,
                        top: `${rowTop(Number(r))}%`,
                        transform: `translate(-50%, -50%) scaleX(${LANES[r].dir < 0 ? -1 : 1})`,
                        fontSize: 'clamp(20px, 3.6vw, 30px)',
                        filter: 'drop-shadow(0 0 6px rgba(255,138,61,0.8))',
                      }}
                    >
                      {LANES[r].emoji}
                    </span>
                  )),
                )}
                {w.pops.map((p) => (
                  <span
                    key={p.id}
                    className="score-pop"
                    style={{ left: `${colLeft(p.c)}%`, top: `${rowTop(p.r)}%`, color: p.color, whiteSpace: 'nowrap' }}
                  >
                    {p.text}
                  </span>
                ))}
                {w.banner && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '44%',
                      width: '100%',
                      textAlign: 'center',
                      fontFamily: 'var(--font-arcade)',
                      fontSize: 'clamp(12px, 2.6vw, 20px)',
                      color: '#ffe94a',
                      textShadow: '0 0 16px #ffe94a',
                      animation: 'popIn 0.4s ease',
                      zIndex: 8,
                    }}
                  >
                    {w.banner.text}
                  </div>
                )}
                {/* Patient */}
                <span
                  style={{
                    position: 'absolute',
                    left: `${colLeft(w.player.c)}%`,
                    top: `${rowTop(w.player.r)}%`,
                    transform: 'translate(-50%, -50%)',
                    fontSize: 'clamp(22px, 4vw, 32px)',
                    filter: 'drop-shadow(0 0 10px #22e5ff)',
                    transition: 'left 0.08s linear, top 0.08s linear',
                    opacity: w.invuln > 0 && Math.floor(w.invuln * 10) % 2 === 0 ? 0.3 : 1,
                    zIndex: 5,
                  }}
                >
                  🚶
                </span>
                <DPad onDir={move} />
                <div style={{ position: 'absolute', bottom: 4, width: '100%', textAlign: 'center', color: '#6f5fb0', fontSize: 16 }}>
                  arrows/WASD hop · dodge the lanes · reach 🏥 for +100
                </div>
              </>
            )}
          </div>
        )
      }}
    </GameShell>
  )
}
