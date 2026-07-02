import { useEffect, useRef, useState } from 'react'
import GameShell from '../components/GameShell.jsx'
import { GAME_META } from './meta.js'
import { useGameLoop } from '../lib/useGameLoop.js'
import { sfx } from '../lib/sounds.js'

const COLS = 8
const ROWS = 5
const BRICK_TOP = 8 // % where the brick field starts
const BRICK_H = 4.6
const PADDLE_Y = 92
const ROW_STYLES = [
  { color: '#a45bff', pts: 30 },
  { color: '#ff2fb9', pts: 25 },
  { color: '#ff8a3d', pts: 20 },
  { color: '#ffe94a', pts: 15 },
  { color: '#4dff5e', pts: 10 },
]
const DROPS = [
  { kind: 'wide', emoji: '🛡️', label: 'GHK-CU', note: 'WIDE PADDLE!' },
  { kind: 'multi', emoji: '✨', label: 'GLOW', note: 'MULTI-BALL!' },
  { kind: 'slow', emoji: '🧘', label: 'MAGNESIUM', note: 'SLOW-MO!' },
]

export default function PlaqueBreaker({ onExit }) {
  const game = GAME_META['plaque-breaker']
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(3)
  const [level, setLevel] = useState(1)
  const [, setFrame] = useState(0)
  const world = useRef(null)
  const keys = useRef({})
  const boardRef = useRef(null)
  const endRef = useRef(() => {})

  const buildBricks = (w) => {
    w.bricks = []
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        w.bricks.push({ r, c, alive: true, power: Math.random() < 0.18 })
      }
    }
  }

  const newBall = (w) => ({
    x: w.paddleX,
    y: PADDLE_Y - 4,
    vx: 0,
    vy: 0,
    held: 0.9, // seconds until auto-launch
  })

  const reset = () => {
    const w = {
      paddleX: 50,
      balls: [],
      bricks: [],
      drops: [],
      pops: [],
      fx: { wide: 0, slow: 0 },
      level: 1,
      lives: 3,
      score: 0,
      nextId: 1,
    }
    buildBricks(w)
    w.balls = [newBall(w)]
    world.current = w
    setScore(0)
    setLives(3)
    setLevel(1)
    setFrame((f) => f + 1) // guarantee a re-render so the loop starts
  }

  useEffect(() => {
    const down = (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') keys.current.left = true
      if (e.key === 'ArrowRight' || e.key === 'd') keys.current.right = true
    }
    const up = (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') keys.current.left = false
      if (e.key === 'ArrowRight' || e.key === 'd') keys.current.right = false
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  const paddleW = () => (world.current?.fx.wide > 0 ? 24 : 15)

  useGameLoop(!!world.current && lives > 0, (dt) => {
    const w = world.current
    if (!w) return
    for (const k of Object.keys(w.fx)) if (w.fx[k] > 0) w.fx[k] -= dt

    // Paddle
    const pw = paddleW()
    if (keys.current.left) w.paddleX -= 70 * dt
    if (keys.current.right) w.paddleX += 70 * dt
    w.paddleX = Math.max(pw / 2, Math.min(100 - pw / 2, w.paddleX))

    const speed = (52 + w.level * 6) * (w.fx.slow > 0 ? 0.6 : 1)

    // Balls
    w.balls = w.balls.filter((b) => {
      if (b.held > 0) {
        b.held -= dt
        b.x = w.paddleX
        b.y = PADDLE_Y - 4
        if (b.held <= 0) {
          const ang = (Math.random() * 60 - 30) * (Math.PI / 180)
          b.vx = Math.sin(ang) * speed
          b.vy = -Math.cos(ang) * speed
          sfx.blip()
        }
        return true
      }
      const px = b.x
      const py = b.y
      // keep the ball's pace matched to the current speed setting
      const mag = Math.hypot(b.vx, b.vy) || 1
      b.x += (b.vx / mag) * speed * dt
      b.y += (b.vy / mag) * speed * dt

      // Walls
      if (b.x < 1.2) { b.x = 1.2; b.vx = Math.abs(b.vx) }
      if (b.x > 98.8) { b.x = 98.8; b.vx = -Math.abs(b.vx) }
      if (b.y < 1.5) { b.y = 1.5; b.vy = Math.abs(b.vy) }

      // Paddle bounce — angle depends on where it lands
      if (b.vy > 0 && b.y >= PADDLE_Y - 2 && b.y <= PADDLE_Y + 2.5 && Math.abs(b.x - w.paddleX) < pw / 2 + 1.5) {
        const rel = Math.max(-1, Math.min(1, (b.x - w.paddleX) / (pw / 2)))
        const ang = rel * 1.05 // ~60° max
        b.vx = Math.sin(ang) * speed
        b.vy = -Math.cos(ang) * speed
        b.y = PADDLE_Y - 2.2
        sfx.tick()
      }

      // Bricks
      const c = Math.floor((b.x / 100) * COLS)
      const r = Math.floor((b.y - BRICK_TOP) / BRICK_H)
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
        const brick = w.bricks.find((k) => k.alive && k.r === r && k.c === c)
        if (brick) {
          brick.alive = false
          const pts = ROW_STYLES[r].pts
          w.score += pts
          w.pops.push({ id: w.nextId++, x: b.x, y: b.y, text: `+${pts}`, color: ROW_STYLES[r].color, ttl: 0.6 })
          if (brick.power) {
            const d = DROPS[Math.floor(Math.random() * DROPS.length)]
            w.drops.push({ id: w.nextId++, x: b.x, y: b.y, ...d })
          }
          // Reflect off whichever face we crossed
          const prevR = Math.floor((py - BRICK_TOP) / BRICK_H)
          const prevC = Math.floor((px / 100) * COLS)
          if (prevR !== r) b.vy = -b.vy
          else if (prevC !== c) b.vx = -b.vx
          else b.vy = -b.vy
          sfx.whack()
        }
      }

      return b.y < 103 // fell off the bottom
    })

    // Out of balls → lose a life
    if (w.balls.length === 0) {
      w.lives -= 1
      sfx.bad()
      if (w.lives > 0) w.balls = [newBall(w)]
    }

    // Board cleared → next level
    if (!w.bricks.some((b) => b.alive)) {
      w.score += 100
      w.level += 1
      buildBricks(w)
      w.drops = []
      w.balls = [newBall(w)]
      sfx.levelUp()
    }

    // Falling power-ups
    w.drops = w.drops.filter((d) => {
      d.y += 22 * dt
      if (d.y > 103) return false
      if (Math.abs(d.x - w.paddleX) < pw / 2 + 2 && Math.abs(d.y - PADDLE_Y) < 3.5) {
        if (d.kind === 'wide') w.fx.wide = 10
        if (d.kind === 'slow') w.fx.slow = 8
        if (d.kind === 'multi') {
          const live = w.balls.filter((b) => b.held <= 0)
          const src = live[0] || w.balls[0]
          if (src && w.balls.length < 6) {
            for (const spin of [-0.5, 0.5]) {
              const ang = Math.atan2(src.vx, -src.vy) + spin
              w.balls.push({ x: src.x, y: src.y, vx: Math.sin(ang) * speed, vy: -Math.cos(ang) * speed, held: 0 })
            }
          }
        }
        w.pops.push({ id: w.nextId++, x: d.x, y: PADDLE_Y - 6, text: `${d.label}: ${d.note}`, color: '#22e5ff', ttl: 1 })
        sfx.levelUp()
        return false
      }
      return true
    })

    w.pops = w.pops.filter((p) => (p.ttl -= dt) > 0)

    setScore(w.score)
    setLives(w.lives)
    setLevel(w.level)
    if (w.lives <= 0) {
      const final = w.score
      world.current = null
      endRef.current(final)
      return
    }
    setFrame((f) => f + 1)
  })

  const onPointerMove = (e) => {
    const w = world.current
    const board = boardRef.current
    if (!w || !board) return
    const rect = board.getBoundingClientRect()
    const pw = paddleW()
    w.paddleX = Math.max(pw / 2, Math.min(100 - pw / 2, ((e.clientX - rect.left) / rect.width) * 100))
  }

  return (
    <GameShell
      game={game}
      score={score}
      onExit={onExit}
      onStart={reset}
      extraHud={
        <>
          <span style={{ color: '#a45bff' }}>LVL {level}</span>
          <span style={{ color: '#ff3355' }}>{'❤️'.repeat(Math.max(lives, 0)) || '💔'}</span>
        </>
      }
    >
      {({ phase, end }) => {
        endRef.current = end
        const w = world.current
        return (
          <div
            ref={boardRef}
            onPointerMove={onPointerMove}
            style={{ position: 'absolute', inset: 0, touchAction: 'none', userSelect: 'none' }}
          >
            {phase === 'playing' && w && (
              <>
                {w.bricks.filter((b) => b.alive).map((b) => (
                  <div
                    key={`${b.r}-${b.c}`}
                    style={{
                      position: 'absolute',
                      left: `${(b.c / COLS) * 100 + 0.4}%`,
                      top: `${BRICK_TOP + b.r * BRICK_H + 0.3}%`,
                      width: `${100 / COLS - 0.8}%`,
                      height: `${BRICK_H - 0.6}%`,
                      borderRadius: 6,
                      background: `linear-gradient(180deg, ${ROW_STYLES[b.r].color}, ${ROW_STYLES[b.r].color}88)`,
                      boxShadow: `0 0 8px ${ROW_STYLES[b.r].color}66`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                    }}
                  >
                    {b.power ? '✨' : ''}
                  </div>
                ))}
                {w.balls.map((b, i) => (
                  <div
                    key={i}
                    style={{
                      position: 'absolute',
                      left: `${b.x}%`,
                      top: `${b.y}%`,
                      transform: 'translate(-50%, -50%)',
                      width: 13,
                      height: 13,
                      borderRadius: '50%',
                      background: 'radial-gradient(circle at 35% 30%, #fff, #22e5ff)',
                      boxShadow: '0 0 12px #22e5ff',
                    }}
                  />
                ))}
                {w.drops.map((d) => (
                  <div key={d.id} style={{ position: 'absolute', left: `${d.x}%`, top: `${d.y}%`, transform: 'translate(-50%, -50%)', textAlign: 'center', zIndex: 6 }}>
                    <div style={{ fontSize: 22, filter: 'drop-shadow(0 0 10px #4dff5e)', animation: 'pulse 0.7s ease infinite' }}>{d.emoji}</div>
                    <div style={{ fontFamily: 'var(--font-arcade)', fontSize: 8, color: '#7dffb0', whiteSpace: 'nowrap' }}>{d.label}</div>
                  </div>
                ))}
                {w.pops.map((p) => (
                  <span key={p.id} className="score-pop" style={{ left: `${p.x}%`, top: `${p.y}%`, color: p.color, whiteSpace: 'nowrap' }}>
                    {p.text}
                  </span>
                ))}
                {/* Paddle */}
                <div
                  style={{
                    position: 'absolute',
                    left: `${w.paddleX}%`,
                    top: `${PADDLE_Y}%`,
                    transform: 'translate(-50%, -50%)',
                    width: `${paddleW()}%`,
                    height: 13,
                    borderRadius: 8,
                    background: 'linear-gradient(180deg, #6ef0ff, #1673d8)',
                    border: '2px solid #22e5ff',
                    boxShadow: w.fx.wide > 0 ? '0 0 18px #4dff5e' : '0 0 12px #22e5ff',
                  }}
                />
                <div style={{ position: 'absolute', bottom: 4, width: '100%', textAlign: 'center', color: '#6f5fb0', fontSize: 16 }}>
                  drag / ← → paddle · smash the plaque · catch 🛡️✨🧘 power-ups
                </div>
              </>
            )}
          </div>
        )
      }}
    </GameShell>
  )
}
