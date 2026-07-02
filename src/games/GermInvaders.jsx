import { useEffect, useRef, useState } from 'react'
import GameShell from '../components/GameShell.jsx'
import { GAME_META } from './meta.js'
import { useGameLoop } from '../lib/useGameLoop.js'
import { sfx } from '../lib/sounds.js'

const COLS = 8
const ROWS = 4
const SX = 8.5 // formation spacing (%)
const SY = 8
// Top rows are rarer germs worth more, classic invaders style
const ROW_TYPES = [
  { emoji: '💀', pts: 40 },
  { emoji: '🦠', pts: 20 },
  { emoji: '🦠', pts: 20 },
  { emoji: '🧫', pts: 10 },
]
const PLAYER_Y = 88

export default function GermInvaders({ onExit }) {
  const game = GAME_META['germ-invaders']
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(3)
  const [wave, setWave] = useState(1)
  const [, setFrame] = useState(0)
  const world = useRef(null)
  const keys = useRef({})
  const boardRef = useRef(null)
  const endRef = useRef(() => {})

  const spawnFormation = (w) => {
    w.ox = 10
    w.oy = 10
    w.dir = 1
    w.invaders = []
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        w.invaders.push({ c, r, alive: true, ...ROW_TYPES[r] })
      }
    }
  }

  const reset = () => {
    const w = {
      playerX: 50,
      bullet: null, // one dose in flight at a time
      enemyBullets: [],
      pops: [],
      fireIn: 1.6,
      invuln: 0,
      wave: 1,
      lives: 3,
      score: 0,
      nextId: 1,
    }
    spawnFormation(w)
    world.current = w
    setScore(0)
    setLives(3)
    setWave(1)
    setFrame((f) => f + 1) // guarantee a re-render so the loop starts
  }

  const shoot = () => {
    const w = world.current
    if (!w || w.bullet) return
    w.bullet = { x: w.playerX, y: PLAYER_Y - 4 }
    sfx.blip()
  }

  useEffect(() => {
    const down = (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') keys.current.left = true
      if (e.key === 'ArrowRight' || e.key === 'd') keys.current.right = true
      if (e.code === 'Space') {
        e.preventDefault()
        shoot()
      }
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

  useGameLoop(!!world.current && lives > 0, (dt) => {
    const w = world.current
    if (!w) return
    if (w.invuln > 0) w.invuln -= dt

    // Player movement
    const pSpeed = 55
    if (keys.current.left) w.playerX -= pSpeed * dt
    if (keys.current.right) w.playerX += pSpeed * dt
    w.playerX = Math.max(4, Math.min(96, w.playerX))

    // Formation march — speeds up as germs die and waves rise
    const alive = w.invaders.filter((i) => i.alive)
    const speed = (5 + w.wave * 1.5 + (1 - alive.length / (COLS * ROWS)) * 16) * (w.dir)
    w.ox += speed * dt
    const xs = alive.map((i) => w.ox + i.c * SX)
    if (xs.length && (Math.max(...xs) > 93 || Math.min(...xs) < 3)) {
      w.dir *= -1
      w.oy += 3.5
      w.ox += w.dir * 0.8
    }

    // Germs reaching the clinic floor costs a life and pushes them back up
    const lowest = alive.length ? Math.max(...alive.map((i) => w.oy + i.r * SY)) : 0
    if (lowest > PLAYER_Y - 8) {
      w.lives -= 1
      w.oy = 10
      w.enemyBullets = []
      sfx.bad()
    }

    // Player bullet
    if (w.bullet) {
      w.bullet.y -= 95 * dt
      if (w.bullet.y < -4) w.bullet = null
      else {
        for (const inv of alive) {
          const ix = w.ox + inv.c * SX
          const iy = w.oy + inv.r * SY
          if (Math.abs(w.bullet.x - ix) < 3.4 && Math.abs(w.bullet.y - iy) < 3.6) {
            inv.alive = false
            w.score += inv.pts
            w.pops.push({ id: w.nextId++, x: ix, y: iy, text: `+${inv.pts}`, color: '#4dff5e', ttl: 0.7 })
            w.bullet = null
            sfx.whack()
            break
          }
        }
      }
    }

    // Wave cleared → bonus, faster wave
    if (!w.invaders.some((i) => i.alive)) {
      w.score += 100
      w.wave += 1
      w.enemyBullets = []
      w.bullet = null
      spawnFormation(w)
      sfx.levelUp()
    }

    // Enemy fire — bottom-most germ of a random column shoots
    w.fireIn -= dt
    if (w.fireIn <= 0) {
      w.fireIn = Math.max(0.45, 1.5 - w.wave * 0.12)
      const cols = [...new Set(alive.map((i) => i.c))]
      if (cols.length) {
        const c = cols[Math.floor(Math.random() * cols.length)]
        const shooter = alive.filter((i) => i.c === c).sort((a, b) => b.r - a.r)[0]
        if (shooter) {
          w.enemyBullets.push({ id: w.nextId++, x: w.ox + shooter.c * SX, y: w.oy + shooter.r * SY + 3 })
        }
      }
    }

    // Enemy bullets fall
    const ebSpeed = 38 + w.wave * 4
    w.enemyBullets = w.enemyBullets.filter((b) => {
      b.y += ebSpeed * dt
      if (b.y > 103) return false
      if (w.invuln <= 0 && Math.abs(b.x - w.playerX) < 3 && Math.abs(b.y - PLAYER_Y) < 4) {
        w.lives -= 1
        w.invuln = 1.4
        w.pops.push({ id: w.nextId++, x: w.playerX, y: PLAYER_Y - 6, text: 'OUCH!', color: '#ff3355', ttl: 0.7 })
        sfx.bad()
        return false
      }
      return true
    })

    w.pops = w.pops.filter((p) => (p.ttl -= dt) > 0)

    setScore(w.score)
    setLives(w.lives)
    setWave(w.wave)
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
    w.playerX = Math.max(4, Math.min(96, ((e.clientX - rect.left) / rect.width) * 100))
  }

  return (
    <GameShell
      game={game}
      score={score}
      onExit={onExit}
      onStart={reset}
      extraHud={
        <>
          <span style={{ color: '#a45bff' }}>WAVE {wave}</span>
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
            onPointerDown={phase === 'playing' ? shoot : undefined}
            style={{ position: 'absolute', inset: 0, touchAction: 'none', userSelect: 'none' }}
          >
            {phase === 'playing' && w && (
              <>
                {w.invaders.filter((i) => i.alive).map((inv) => (
                  <span
                    key={`${inv.r}-${inv.c}`}
                    style={{
                      position: 'absolute',
                      left: `${w.ox + inv.c * SX}%`,
                      top: `${w.oy + inv.r * SY}%`,
                      transform: 'translate(-50%, -50%)',
                      fontSize: 28,
                      filter: 'drop-shadow(0 0 8px rgba(164,91,255,0.9))',
                    }}
                  >
                    {inv.emoji}
                  </span>
                ))}
                {w.bullet && (
                  <div
                    style={{
                      position: 'absolute',
                      left: `${w.bullet.x}%`,
                      top: `${w.bullet.y}%`,
                      transform: 'translate(-50%, -50%)',
                      width: 4,
                      height: 14,
                      borderRadius: 2,
                      background: '#22e5ff',
                      boxShadow: '0 0 10px #22e5ff',
                    }}
                  />
                )}
                {w.enemyBullets.map((b) => (
                  <div
                    key={b.id}
                    style={{
                      position: 'absolute',
                      left: `${b.x}%`,
                      top: `${b.y}%`,
                      transform: 'translate(-50%, -50%)',
                      width: 5,
                      height: 12,
                      borderRadius: 3,
                      background: '#ff3355',
                      boxShadow: '0 0 10px #ff3355',
                    }}
                  />
                ))}
                {w.pops.map((p) => (
                  <span key={p.id} className="score-pop" style={{ left: `${p.x}%`, top: `${p.y}%`, color: p.color }}>
                    {p.text}
                  </span>
                ))}
                {/* Player syringe */}
                <span
                  style={{
                    position: 'absolute',
                    left: `${w.playerX}%`,
                    top: `${PLAYER_Y}%`,
                    transform: 'translate(-50%, -50%) rotate(-45deg)',
                    fontSize: 36,
                    filter: 'drop-shadow(0 0 12px #22e5ff)',
                    opacity: w.invuln > 0 && Math.floor(w.invuln * 10) % 2 === 0 ? 0.3 : 1,
                  }}
                >
                  💉
                </span>
                <div style={{ position: 'absolute', bottom: 4, width: '100%', textAlign: 'center', color: '#6f5fb0', fontSize: 16 }}>
                  ← → move · SPACE / tap to fire · stop the germ armada!
                </div>
              </>
            )}
          </div>
        )
      }}
    </GameShell>
  )
}
