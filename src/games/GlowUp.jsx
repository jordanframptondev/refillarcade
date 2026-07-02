import { useEffect, useRef, useState } from 'react'
import GameShell from '../components/GameShell.jsx'
import { GAME_META } from './meta.js'
import { useGameLoop } from '../lib/useGameLoop.js'
import { sfx } from '../lib/sounds.js'
import { isTypingTarget } from '../lib/keys.js'

const GRAVITY = 165
const JUMP = 80
const SPRING_JUMP = 128
const PLAYER_W = 7 // catch width (%)

export default function GlowUp({ onExit }) {
  const game = GAME_META['glow-up']
  const [score, setScore] = useState(0)
  const [, setFrame] = useState(0)
  const world = useRef(null)
  const keys = useRef({})
  const boardRef = useRef(null)
  const endRef = useRef(() => {})

  const spawnPlatform = (w, y) => {
    const roll = Math.random()
    const type = roll < 0.12 ? 'broken' : roll < 0.22 ? 'spring' : 'normal'
    const p = {
      id: w.nextId++,
      x: 10 + Math.random() * 80,
      y,
      w: 15,
      type,
    }
    w.platforms.push(p)
    if (type === 'normal' && Math.random() < 0.25) {
      w.pickups.push({
        id: w.nextId++,
        x: p.x,
        y: y + 4,
        emoji: Math.random() < 0.5 ? '✨' : '💊',
      })
    }
  }

  const reset = () => {
    const w = {
      x: 50,
      worldY: 2, // height above the spa floor
      vy: JUMP,
      cameraY: 0,
      maxY: 0,
      bonus: 0,
      platforms: [{ id: 1, x: 50, y: 0, w: 20, type: 'normal' }],
      pickups: [],
      pops: [],
      nextId: 2,
      topSpawned: 0,
      sparkleTtl: 0,
    }
    while (w.topSpawned < 110) {
      w.topSpawned += 7 + Math.random() * 7
      spawnPlatform(w, w.topSpawned)
    }
    world.current = w
    setScore(0)
    setFrame((f) => f + 1) // guarantee a re-render so the loop starts
  }

  useEffect(() => {
    const down = (e) => {
      if (isTypingTarget(e)) return // don't hijack name-entry typing
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

  useGameLoop(!!world.current, (dt) => {
    const w = world.current
    if (!w) return

    // Steering (with horizontal wrap, doodle style)
    const speed = 62
    if (keys.current.left) w.x -= speed * dt
    if (keys.current.right) w.x += speed * dt
    if (w.x < -2) w.x = 102
    if (w.x > 102) w.x = -2

    // Physics — vy positive = rising
    const prevY = w.worldY
    w.vy -= GRAVITY * dt
    w.worldY += w.vy * dt
    if (w.sparkleTtl > 0) w.sparkleTtl -= dt

    // Land on a platform only while falling
    if (w.vy < 0) {
      for (const p of w.platforms) {
        if (Math.abs(w.x - p.x) < p.w / 2 + PLAYER_W / 2 && prevY >= p.y && w.worldY <= p.y) {
          if (p.type === 'spring') {
            w.vy = SPRING_JUMP
            w.sparkleTtl = 0.5
            w.pops.push({ id: w.nextId++, x: p.x, y: p.y, text: 'MEGA GLOW!', color: '#ffe94a', ttl: 0.8 })
            sfx.levelUp()
          } else {
            w.vy = JUMP
            sfx.jump()
          }
          if (p.type === 'broken') {
            w.platforms = w.platforms.filter((o) => o !== p)
            sfx.tick()
          }
          w.worldY = p.y
          break
        }
      }
    }

    // Collect pickups
    w.pickups = w.pickups.filter((pk) => {
      if (Math.abs(pk.x - w.x) < 6 && Math.abs(pk.y - w.worldY) < 6) {
        w.bonus += 25
        w.pops.push({ id: w.nextId++, x: pk.x, y: pk.y, text: '+25', color: '#4dff5e', ttl: 0.7 })
        sfx.good()
        return false
      }
      return true
    })

    // Camera follows the climb
    if (w.worldY - w.cameraY > 55) w.cameraY = w.worldY - 55
    w.maxY = Math.max(w.maxY, w.worldY)

    // Keep the sky stocked with platforms; platform gaps widen as you climb
    while (w.topSpawned < w.cameraY + 130) {
      w.topSpawned += 7 + Math.random() * (7 + Math.min(w.maxY / 200, 6))
      spawnPlatform(w, w.topSpawned)
    }
    w.platforms = w.platforms.filter((p) => p.y > w.cameraY - 15)
    w.pickups = w.pickups.filter((p) => p.y > w.cameraY - 15)
    w.pops = w.pops.filter((p) => (p.ttl -= dt) > 0)

    const total = Math.floor(w.maxY) + w.bonus
    setScore(total)

    // Fell off the bottom
    if (w.worldY < w.cameraY - 8) {
      world.current = null
      endRef.current(total)
      return
    }
    setFrame((f) => f + 1)
  })

  const onPointerMove = (e) => {
    const w = world.current
    const board = boardRef.current
    if (!w || !board) return
    const rect = board.getBoundingClientRect()
    w.x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100))
  }

  // World-Y → screen-top % (screen shows cameraY..cameraY+100, bottom to top)
  const toScreen = (w, y) => 100 - (y - w.cameraY)

  const PLATFORM_STYLES = {
    normal: { background: 'linear-gradient(180deg, #2fd4ff, #1673d8)', border: '2px solid #22e5ff', glow: 'rgba(34,229,255,0.7)' },
    broken: { background: 'linear-gradient(180deg, #ff8a3d, #b84a12)', border: '2px dashed #ffb07a', glow: 'rgba(255,138,61,0.7)' },
    spring: { background: 'linear-gradient(180deg, #ff2fb9, #a4128a)', border: '2px solid #ff7ad5', glow: 'rgba(255,47,185,0.8)' },
  }

  return (
    <GameShell
      game={game}
      score={score}
      onExit={onExit}
      onStart={reset}
      extraHud={world.current && <span style={{ color: '#ffe94a' }}>📏 {Math.floor(world.current.maxY)}</span>}
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
                {w.platforms.map((p) => {
                  const st = PLATFORM_STYLES[p.type]
                  const top = toScreen(w, p.y)
                  if (top < -6 || top > 106) return null
                  return (
                    <div
                      key={p.id}
                      style={{
                        position: 'absolute',
                        left: `${p.x}%`,
                        top: `${top}%`,
                        transform: 'translate(-50%, -50%)',
                        width: `${p.w}%`,
                        height: 12,
                        borderRadius: 8,
                        background: st.background,
                        border: st.border,
                        boxShadow: `0 0 10px ${st.glow}`,
                        textAlign: 'center',
                        fontSize: 14,
                        lineHeight: '4px',
                      }}
                    >
                      {p.type === 'spring' ? '💆' : ''}
                    </div>
                  )
                })}
                {w.pickups.map((pk) => {
                  const top = toScreen(w, pk.y)
                  if (top < -6 || top > 106) return null
                  return (
                    <span
                      key={pk.id}
                      style={{
                        position: 'absolute',
                        left: `${pk.x}%`,
                        top: `${top}%`,
                        transform: 'translate(-50%, -50%)',
                        fontSize: 22,
                        filter: 'drop-shadow(0 0 8px #ffe94a)',
                        animation: 'pulse 0.8s ease infinite',
                      }}
                    >
                      {pk.emoji}
                    </span>
                  )
                })}
                {w.pops.map((p) => (
                  <span
                    key={p.id}
                    className="score-pop"
                    style={{ left: `${p.x}%`, top: `${toScreen(w, p.y)}%`, color: p.color }}
                  >
                    {p.text}
                  </span>
                ))}
                {/* Climber */}
                <span
                  style={{
                    position: 'absolute',
                    left: `${w.x}%`,
                    top: `${toScreen(w, w.worldY)}%`,
                    transform: `translate(-50%, -85%) scaleX(${keys.current.left ? -1 : 1})`,
                    fontSize: 36,
                    filter: w.sparkleTtl > 0 ? 'drop-shadow(0 0 16px #ffe94a)' : 'drop-shadow(0 0 10px #ff2fb9)',
                    zIndex: 5,
                  }}
                >
                  {w.sparkleTtl > 0 ? '🤩' : '🧖'}
                </span>
                <div style={{ position: 'absolute', bottom: 4, width: '100%', textAlign: 'center', color: '#6f5fb0', fontSize: 16 }}>
                  ← → steer / drag · 💆 = mega bounce · orange platforms crack!
                </div>
              </>
            )}
          </div>
        )
      }}
    </GameShell>
  )
}
