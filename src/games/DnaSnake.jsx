import { useEffect, useRef, useState } from 'react'
import GameShell from '../components/GameShell.jsx'
import DPad from '../components/DPad.jsx'
import { GAME_META } from './meta.js'
import { useGameLoop } from '../lib/useGameLoop.js'
import { sfx } from '../lib/sounds.js'

const COLS = 17
const ROWS = 13
const DIRS = {
  up: [-1, 0],
  down: [1, 0],
  left: [0, -1],
  right: [0, 1],
}
const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' }
const FOODS = ['💊', '💊', '💊', '💉', '🧪'] // mostly pills
const BONUS = { emoji: '🧬', pts: 30, life: 6 }
// Base-pair colors so the strand reads as a double helix
const STRAND_COLORS = ['#22e5ff', '#ff2fb9', '#4dff5e', '#ffe94a']

export default function DnaSnake({ onExit }) {
  const game = GAME_META['dna']
  const [score, setScore] = useState(0)
  const [len, setLen] = useState(3)
  const [, setFrame] = useState(0)
  const world = useRef(null)
  const endRef = useRef(() => {})

  const placeFood = (w, isBonus = false) => {
    let r, c
    do {
      r = Math.floor(Math.random() * ROWS)
      c = Math.floor(Math.random() * COLS)
    } while (w.snake.some((s) => s.r === r && s.c === c) || (w.food && w.food.r === r && w.food.c === c))
    const item = isBonus
      ? { r, c, emoji: BONUS.emoji, pts: BONUS.pts, ttl: BONUS.life, bonus: true }
      : { r, c, emoji: FOODS[Math.floor(Math.random() * FOODS.length)], pts: 10 }
    if (isBonus) w.bonus = item
    else w.food = item
  }

  const reset = () => {
    const w = {
      snake: [
        { r: 6, c: 5 },
        { r: 6, c: 4 },
        { r: 6, c: 3 },
      ],
      dir: 'right',
      queue: [],
      food: null,
      bonus: null,
      bonusIn: 9,
      stepIn: 0,
      stepEvery: 0.16,
      score: 0,
    }
    placeFood(w)
    world.current = w
    setScore(0)
    setLen(3)
    setFrame((f) => f + 1) // guarantee a re-render so the loop starts
  }

  const turn = (dir) => {
    const w = world.current
    if (!w) return
    const last = w.queue[w.queue.length - 1] || w.dir
    if (dir === last || dir === OPPOSITE[last]) return // no reversing into yourself
    if (w.queue.length < 2) w.queue.push(dir)
  }

  useEffect(() => {
    const onKey = (e) => {
      const map = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' }
      if (map[e.key]) {
        e.preventDefault()
        turn(map[e.key])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useGameLoop(!!world.current, (dt) => {
    const w = world.current
    if (!w) return

    // Bonus item timing
    w.bonusIn -= dt
    if (!w.bonus && w.bonusIn <= 0) placeFood(w, true)
    if (w.bonus && (w.bonus.ttl -= dt) <= 0) {
      w.bonus = null
      w.bonusIn = 8 + Math.random() * 6
    }

    w.stepIn -= dt
    if (w.stepIn > 0) {
      setFrame((f) => f + 1)
      return
    }
    w.stepIn = w.stepEvery

    if (w.queue.length) w.dir = w.queue.shift()
    const [dr, dc] = DIRS[w.dir]
    const head = { r: w.snake[0].r + dr, c: w.snake[0].c + dc }

    // Wall or self collision unravels the strand
    const hitWall = head.r < 0 || head.r >= ROWS || head.c < 0 || head.c >= COLS
    const hitSelf = w.snake.some((s) => s.r === head.r && s.c === head.c)
    if (hitWall || hitSelf) {
      const final = w.score
      world.current = null
      endRef.current(final)
      return
    }

    w.snake.unshift(head)
    let grew = false
    if (w.food && head.r === w.food.r && head.c === w.food.c) {
      w.score += w.food.pts
      grew = true
      placeFood(w)
      w.stepEvery = Math.max(0.075, w.stepEvery - 0.0035) // strand gets faster
      sfx.good()
    }
    if (w.bonus && head.r === w.bonus.r && head.c === w.bonus.c) {
      w.score += w.bonus.pts
      grew = true
      w.bonus = null
      w.bonusIn = 8 + Math.random() * 6
      sfx.levelUp()
    }
    if (!grew) w.snake.pop()

    setScore(w.score)
    setLen(w.snake.length)
    setFrame((f) => f + 1)
  })

  const cellLeft = (c) => `${((c + 0.5) / COLS) * 100}%`
  const cellTop = (r) => `${((r + 0.5) / ROWS) * 100}%`

  return (
    <GameShell
      game={game}
      score={score}
      onExit={onExit}
      onStart={reset}
      extraHud={<span style={{ color: '#4dff5e' }}>🧬 {len}</span>}
    >
      {({ phase, end }) => {
        endRef.current = end
        const w = world.current
        return (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', userSelect: 'none' }}>
            {phase === 'playing' && w && (
              <>
                <div
                  style={{
                    position: 'relative',
                    height: 'min(94%, 520px)',
                    aspectRatio: `${COLS} / ${ROWS}`,
                    maxWidth: '94%',
                    border: '3px solid #4dff5e',
                    borderRadius: 10,
                    boxShadow: '0 0 18px rgba(77,255,94,0.5), inset 0 0 30px rgba(0,0,0,0.6)',
                    background:
                      'repeating-linear-gradient(0deg, rgba(77,255,94,0.04) 0 2px, transparent 2px 40px), repeating-linear-gradient(90deg, rgba(77,255,94,0.04) 0 2px, transparent 2px 40px), #0a0320',
                  }}
                >
                  {/* Body segments — alternating base-pair colors */}
                  {w.snake.map((s, i) =>
                    i === 0 ? null : (
                      <div
                        key={i}
                        style={{
                          position: 'absolute',
                          left: cellLeft(s.c),
                          top: cellTop(s.r),
                          transform: 'translate(-50%, -50%)',
                          width: `${72 / COLS}%`,
                          aspectRatio: '1',
                          borderRadius: '40%',
                          background: STRAND_COLORS[i % STRAND_COLORS.length],
                          boxShadow: `0 0 8px ${STRAND_COLORS[i % STRAND_COLORS.length]}`,
                          opacity: 0.9,
                        }}
                      />
                    ),
                  )}
                  {/* Head */}
                  <span
                    style={{
                      position: 'absolute',
                      left: cellLeft(w.snake[0].c),
                      top: cellTop(w.snake[0].r),
                      transform: 'translate(-50%, -50%)',
                      fontSize: 'clamp(16px, 3vw, 26px)',
                      filter: 'drop-shadow(0 0 10px #4dff5e)',
                      zIndex: 5,
                    }}
                  >
                    🧬
                  </span>
                  {/* Food */}
                  {w.food && (
                    <span
                      style={{
                        position: 'absolute',
                        left: cellLeft(w.food.c),
                        top: cellTop(w.food.r),
                        transform: 'translate(-50%, -50%)',
                        fontSize: 'clamp(14px, 2.6vw, 24px)',
                        filter: 'drop-shadow(0 0 8px #ffe94a)',
                      }}
                    >
                      {w.food.emoji}
                    </span>
                  )}
                  {/* Timed bonus */}
                  {w.bonus && (
                    <span
                      style={{
                        position: 'absolute',
                        left: cellLeft(w.bonus.c),
                        top: cellTop(w.bonus.r),
                        transform: 'translate(-50%, -50%)',
                        fontSize: 'clamp(16px, 3vw, 26px)',
                        filter: 'drop-shadow(0 0 10px #ff2fb9)',
                        animation: 'pulse 0.5s ease infinite',
                        opacity: w.bonus.ttl < 2 ? 0.5 : 1,
                      }}
                    >
                      {w.bonus.emoji}
                    </span>
                  )}
                </div>
                <DPad onDir={turn} />
                <div style={{ position: 'absolute', bottom: 4, width: '100%', textAlign: 'center', color: '#6f5fb0', fontSize: 16 }}>
                  arrows/WASD steer · eat 💊 to grow · 🧬 = +30 before it fades
                </div>
              </>
            )}
          </div>
        )
      }}
    </GameShell>
  )
}
