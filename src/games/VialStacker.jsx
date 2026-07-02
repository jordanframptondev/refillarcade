import { useEffect, useRef, useState } from 'react'
import GameShell from '../components/GameShell.jsx'
import { GAME_META } from './meta.js'
import { useGameLoop } from '../lib/useGameLoop.js'
import { sfx } from '../lib/sounds.js'
import { isTypingTarget } from '../lib/keys.js'

const ROW_H = 4.4 // row height in board %
const BASE_Y = 92 // screen % of the base row's center
const VISIBLE_ROWS = 16
const STACK_COLORS = ['#ff2fb9', '#22e5ff', '#4dff5e', '#ffe94a', '#a45bff', '#ff8a3d']
const PERFECT_EPS = 1.3 // max misalignment (%) that still counts as perfect

export default function VialStacker({ onExit }) {
  const game = GAME_META['vial-stacker']
  const [score, setScore] = useState(0)
  const [height, setHeight] = useState(0)
  const [, setFrame] = useState(0)
  const world = useRef(null)
  const endRef = useRef(() => {})

  const reset = () => {
    world.current = {
      rows: [{ x: 50, w: 30 }], // base tray
      cur: { x: 15, w: 30, dir: 1, speed: 30 },
      score: 0,
      streak: 0,
      pops: [],
      dropFlash: 0,
      nextId: 1,
    }
    setScore(0)
    setHeight(0)
    setFrame((f) => f + 1) // guarantee a re-render so the loop starts
  }

  const drop = () => {
    const w = world.current
    if (!w) return
    const below = w.rows[w.rows.length - 1]
    const cur = w.cur
    const left = Math.max(cur.x - cur.w / 2, below.x - below.w / 2)
    const right = Math.min(cur.x + cur.w / 2, below.x + below.w / 2)
    const overlap = right - left

    if (overlap <= 1.2) {
      // Missed the stack — the tray shatters
      sfx.bad()
      const final = w.score
      world.current = null
      endRef.current(final)
      return
    }

    const perfect = Math.abs(cur.x - below.x) < PERFECT_EPS
    let newRow
    if (perfect) {
      w.streak += 1
      const bonus = 25 * w.streak
      w.score += 10 + bonus
      newRow = { x: below.x, w: cur.w } // perfect keeps your full width
      w.pops.push({ id: w.nextId++, text: `PERFECT! +${10 + bonus}`, color: '#ffe94a', ttl: 0.9 })
      sfx.levelUp()
    } else {
      w.streak = 0
      w.score += 10
      newRow = { x: (left + right) / 2, w: overlap }
      w.pops.push({ id: w.nextId++, text: '+10', color: '#4dff5e', ttl: 0.6 })
      sfx.good()
    }

    w.rows.push(newRow)
    w.dropFlash = 0.15
    const fromLeft = w.rows.length % 2 === 0
    w.cur = {
      x: fromLeft ? newRow.w / 2 + 2 : 100 - newRow.w / 2 - 2,
      w: newRow.w,
      dir: fromLeft ? 1 : -1,
      speed: Math.min(78, 30 + w.rows.length * 2.4),
    }
    setScore(w.score)
    setHeight(w.rows.length - 1)
  }

  useEffect(() => {
    const onKey = (e) => {
      if (isTypingTarget(e)) return // don't hijack name-entry typing
      if (e.code === 'Space') {
        e.preventDefault()
        drop()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useGameLoop(!!world.current, (dt) => {
    const w = world.current
    if (!w) return
    if (w.dropFlash > 0) w.dropFlash -= dt
    w.cur.x += w.cur.dir * w.cur.speed * dt
    const half = w.cur.w / 2
    if (w.cur.x > 100 - half) { w.cur.x = 100 - half; w.cur.dir = -1 }
    if (w.cur.x < half) { w.cur.x = half; w.cur.dir = 1 }
    w.pops = w.pops.filter((p) => (p.ttl -= dt) > 0)
    setFrame((f) => f + 1)
  })

  // Row index → screen top %, sliding the camera up as the tower grows
  const rowTop = (w, idx) => {
    const hidden = Math.max(0, w.rows.length - VISIBLE_ROWS)
    return BASE_Y - (idx - hidden) * ROW_H
  }

  return (
    <GameShell
      game={game}
      score={score}
      onExit={onExit}
      onStart={reset}
      extraHud={<span style={{ color: '#ffe94a' }}>🏗️ {height}</span>}
    >
      {({ phase, end }) => {
        endRef.current = end
        const w = world.current
        return (
          <div
            onPointerDown={phase === 'playing' ? drop : undefined}
            style={{ position: 'absolute', inset: 0, touchAction: 'manipulation', userSelect: 'none', overflow: 'hidden' }}
          >
            {phase === 'playing' && w && (
              <>
                {w.rows.map((row, i) => {
                  const top = rowTop(w, i)
                  if (top < -6 || top > 104) return null
                  const color = STACK_COLORS[i % STACK_COLORS.length]
                  return (
                    <div
                      key={i}
                      style={{
                        position: 'absolute',
                        left: `${row.x}%`,
                        top: `${top}%`,
                        transform: 'translate(-50%, -50%)',
                        width: `${row.w}%`,
                        height: `${ROW_H - 0.7}%`,
                        borderRadius: 7,
                        background: `linear-gradient(180deg, ${color}, ${color}77)`,
                        border: `2px solid ${color}`,
                        boxShadow: i === w.rows.length - 1 && w.dropFlash > 0 ? `0 0 22px ${color}` : `0 0 8px ${color}55`,
                      }}
                    />
                  )
                })}
                {/* The sliding tray */}
                <div
                  style={{
                    position: 'absolute',
                    left: `${w.cur.x}%`,
                    top: `${rowTop(w, w.rows.length)}%`,
                    transform: 'translate(-50%, -50%)',
                    width: `${w.cur.w}%`,
                    height: `${ROW_H - 0.7}%`,
                    borderRadius: 7,
                    background: 'linear-gradient(180deg, #ffffff, #9fb6ff88)',
                    border: '2px solid #ffffff',
                    boxShadow: '0 0 16px rgba(255,255,255,0.8)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 13,
                    zIndex: 5,
                  }}
                >
                  🧪
                </div>
                {w.pops.map((p) => (
                  <span
                    key={p.id}
                    className="score-pop"
                    style={{ left: '50%', top: '30%', transform: 'translateX(-50%)', color: p.color, whiteSpace: 'nowrap' }}
                  >
                    {p.text}
                  </span>
                ))}
                <div style={{ position: 'absolute', bottom: 4, width: '100%', textAlign: 'center', color: '#6f5fb0', fontSize: 16 }}>
                  SPACE / tap to drop the tray · line it up PERFECT to keep your width
                </div>
              </>
            )}
          </div>
        )
      }}
    </GameShell>
  )
}
