import { useEffect, useRef, useState } from 'react'
import GameShell from '../components/GameShell.jsx'
import { GAME_META } from './meta.js'
import { useGameLoop } from '../lib/useGameLoop.js'
import { sfx } from '../lib/sounds.js'

const COLS = 8
const ROWS = 4
const SX = 8.5 // formation spacing (%)
const SY = 8
const PLAYER_Y = 88
// Back rows are the hardest to reverse — collagen loss is a boss fight
const ROW_TYPES = [
  { emoji: '🫠', label: 'SAGGING', hp: 4, pts: 40 },
  { emoji: '🟤', label: 'SUN SPOT', hp: 3, pts: 30, pigment: true },
  { emoji: '➿', label: 'WRINKLE', hp: 2, pts: 20 },
  { emoji: '〰️', label: 'FINE LINE', hp: 1, pts: 10 },
]

// Peptide power-ups — the game effect is the marketing message
const POWERUPS = [
  { kind: 'vitc', emoji: '🍊', label: 'VITAMIN C', note: 'DOUBLE SHOT!', weight: 3 },
  { kind: 'nad', emoji: '🧪', label: 'NAD+', note: 'RAPID FIRE!', weight: 2 },
  { kind: 'glow', emoji: '✨', label: 'GLOW BLEND', note: 'TRIPLE BEAM!', weight: 2 },
  { kind: 'gluta', emoji: '🫧', label: 'GLUTATHIONE', note: 'SPOTS CLEARED!', weight: 2 },
  { kind: 'tox', emoji: '🧊', label: 'TOX SHOT', note: 'WRINKLES FROZEN!', weight: 2 },
  { kind: 'trt', emoji: '💪', label: 'TRT', note: 'POWER SURGE!', weight: 2 },
  { kind: 'glp', emoji: '💉', label: 'GLP-1', note: 'CRAVINGS GONE!', weight: 1 },
  { kind: 'biotin', emoji: '💛', label: 'BIOTIN', note: '+75 SHINE!', weight: 2 },
  { kind: 'hrt', emoji: '🌸', label: 'HRT', note: '+1 LIFE!', weight: 1 },
]
// Accelerated-aging hazards — catching one helps the invaders
const HAZARDS = [
  { emoji: '☀️', label: 'UV RAYS' },
  { emoji: '🍩', label: 'SUGAR' },
  { emoji: '😰', label: 'STRESS' },
  { emoji: '📱', label: 'BLUE LIGHT' },
]
const BUFF_ICONS = { rapid: '🧪', spread: '✨', surge: '⚡', freeze: '🧊', double: '🍊' }

function pickPowerup() {
  const total = POWERUPS.reduce((s, p) => s + p.weight, 0)
  let roll = Math.random() * total
  for (const p of POWERUPS) {
    roll -= p.weight
    if (roll <= 0) return p
  }
  return POWERUPS[0]
}

export default function AgeInvaders({ onExit }) {
  const game = GAME_META['age-invaders']
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(3)
  const [wave, setWave] = useState(1)
  const [, setFrame] = useState(0)
  const world = useRef(null)
  const keys = useRef({})
  const boardRef = useRef(null)
  const endRef = useRef(() => {})

  const decadeLabel = (w) => `YOUR ${10 + w * 10}s`

  const spawnFormation = (w) => {
    w.ox = 10
    w.oy = 12
    w.dir = 1
    w.invaders = []
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const type = ROW_TYPES[r]
        w.invaders.push({ c, r, alive: true, hp: type.hp, ...type })
      }
    }
  }

  const reset = () => {
    const w = {
      playerX: 50,
      bullets: [], // {x, y, vx}
      enemyBullets: [],
      drops: [], // falling powerups/hazards {x, y, kind|hazard, emoji, label}
      pops: [],
      banner: { text: 'YOUR 20s — IT BEGINS', ttl: 2 },
      fx: { rapid: 0, spread: 0, surge: 0, freeze: 0, double: 0, rush: 0 },
      fireCd: 0,
      fireIn: 1.7,
      dropIn: 4,
      ufo: null,
      ufoIn: 12,
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
    if (!w || w.fireCd > 0) return
    const maxShots = w.fx.double > 0 ? 10 : 6
    if (w.bullets.length >= maxShots) return
    // Fire as fast as the player can press — the tiny cooldown only
    // debounces duplicate events from a single press
    w.fireCd = 0.05
    if (w.fx.spread > 0) {
      w.bullets.push({ x: w.playerX, y: PLAYER_Y - 4, vx: -16 }, { x: w.playerX, y: PLAYER_Y - 4, vx: 0 }, { x: w.playerX, y: PLAYER_Y - 4, vx: 16 })
    } else {
      w.bullets.push({ x: w.playerX, y: PLAYER_Y - 4, vx: 0 })
    }
    sfx.blip()
  }

  const applyPowerup = (w, p) => {
    if (p.kind === 'vitc') w.fx.double = 10
    if (p.kind === 'nad') w.fx.rapid = 8
    if (p.kind === 'glow') w.fx.spread = 8
    if (p.kind === 'tox') w.fx.freeze = 4
    if (p.kind === 'trt') w.fx.surge = 6
    if (p.kind === 'biotin') w.score += 75
    if (p.kind === 'hrt') w.lives = Math.min(5, w.lives + 1)
    if (p.kind === 'gluta') {
      // The master antioxidant — wipes every sun spot on the board
      w.invaders.forEach((inv) => {
        if (inv.alive && inv.pigment) {
          inv.alive = false
          w.score += inv.pts
        }
      })
    }
    if (p.kind === 'glp') {
      // Kills the cravings — clears every falling hazard
      w.drops = w.drops.filter((d) => {
        if (d.hazard) w.score += 30
        return !d.hazard
      })
    }
    sfx.levelUp()
  }

  useEffect(() => {
    const down = (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') keys.current.left = true
      if (e.key === 'ArrowRight' || e.key === 'd') keys.current.right = true
      if (e.code === 'Space') {
        e.preventDefault()
        // Every distinct press fires; holding only auto-fires with NAD+ rapid
        if (e.repeat && !(world.current?.fx.rapid > 0)) return
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
    if (w.fireCd > 0) w.fireCd -= dt
    if (w.banner && (w.banner.ttl -= dt) <= 0) w.banner = null
    for (const k of Object.keys(w.fx)) if (w.fx[k] > 0) w.fx[k] -= dt

    // Player movement (NAD+ = more energy = faster)
    const pSpeed = w.fx.rapid > 0 ? 75 : 55
    if (keys.current.left) w.playerX -= pSpeed * dt
    if (keys.current.right) w.playerX += pSpeed * dt
    w.playerX = Math.max(4, Math.min(96, w.playerX))

    // Formation march — relentless, faster each decade, frantic when few remain
    const alive = w.invaders.filter((i) => i.alive)
    if (w.fx.freeze <= 0) {
      const rush = w.fx.rush > 0 ? 1.8 : 1
      const speed = (4.5 + w.wave * 1.6 + (1 - alive.length / (COLS * ROWS)) * 15) * w.dir * rush
      w.ox += speed * dt
      const xs = alive.map((i) => w.ox + i.c * SX)
      if (xs.length && (Math.max(...xs) > 93 || Math.min(...xs) < 3)) {
        w.dir *= -1
        w.oy += 3.5
        w.ox += w.dir * 0.8
      }
    }

    // Aging reaching the bottom costs a life and pushes the clock back up
    const lowest = alive.length ? Math.max(...alive.map((i) => w.oy + i.r * SY)) : 0
    if (lowest > PLAYER_Y - 8) {
      w.lives -= 1
      w.oy = 12
      w.enemyBullets = []
      sfx.bad()
    }

    // Father Time drifts across the top for bonus points
    w.ufoIn -= dt
    if (!w.ufo && w.ufoIn <= 0) {
      const dir = Math.random() < 0.5 ? 1 : -1
      w.ufo = { x: dir > 0 ? -4 : 104, dir }
      w.ufoIn = 14 + Math.random() * 10
    }
    if (w.ufo) {
      w.ufo.x += w.ufo.dir * 24 * dt
      if (w.ufo.x < -6 || w.ufo.x > 106) w.ufo = null
    }

    // Player bullets
    const dmg = w.fx.surge > 0 ? 3 : 1
    w.bullets = w.bullets.filter((b) => {
      b.y -= 95 * dt
      b.x += (b.vx || 0) * dt
      if (b.y < -4 || b.x < -2 || b.x > 102) return false
      // Father Time hit
      if (w.ufo && Math.abs(b.x - w.ufo.x) < 4 && Math.abs(b.y - 6) < 4) {
        w.score += 150
        w.pops.push({ id: w.nextId++, x: w.ufo.x, y: 6, text: 'TIME OUT! +150', color: '#ffe94a', ttl: 0.9 })
        w.ufo = null
        sfx.coin()
        return false
      }
      for (const inv of alive) {
        if (!inv.alive) continue
        const ix = w.ox + inv.c * SX
        const iy = w.oy + inv.r * SY
        if (Math.abs(b.x - ix) < 3.4 && Math.abs(b.y - iy) < 3.6) {
          inv.hp -= dmg
          if (inv.hp <= 0) {
            inv.alive = false
            w.score += inv.pts
            w.pops.push({ id: w.nextId++, x: ix, y: iy, text: `+${inv.pts}`, color: '#4dff5e', ttl: 0.7 })
            sfx.whack()
          } else {
            w.pops.push({ id: w.nextId++, x: ix, y: iy, text: inv.pigment ? 'NEEDS GLUTA!' : 'HIT!', color: '#ff8a3d', ttl: 0.45 })
            sfx.tick()
          }
          return false
        }
      }
      return true
    })

    // Wave cleared → a new decade begins
    if (!w.invaders.some((i) => i.alive)) {
      w.score += 150
      w.wave += 1
      w.enemyBullets = []
      w.bullets = []
      spawnFormation(w)
      w.banner = { text: `WELCOME TO ${decadeLabel(w.wave)}`, ttl: 2 }
      sfx.levelUp()
    }

    // Enemy fire — frozen wrinkles don't shoot
    if (w.fx.freeze <= 0) {
      w.fireIn -= dt
      if (w.fireIn <= 0) {
        const rushFire = w.fx.rush > 0 ? 0.6 : 1
        w.fireIn = Math.max(0.4, (1.6 - w.wave * 0.12) * rushFire)
        const cols = [...new Set(alive.map((i) => i.c))]
        if (cols.length) {
          const c = cols[Math.floor(Math.random() * cols.length)]
          const shooter = alive.filter((i) => i.c === c).sort((a, b) => b.r - a.r)[0]
          if (shooter) w.enemyBullets.push({ id: w.nextId++, x: w.ox + shooter.c * SX, y: w.oy + shooter.r * SY + 3 })
        }
      }
    }

    const ebSpeed = 36 + w.wave * 4
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

    // Falling capsules: peptides to catch, agers to dodge
    w.dropIn -= dt
    if (w.dropIn <= 0) {
      w.dropIn = Math.max(3, 6.5 - w.wave * 0.4) + Math.random() * 2
      const isHazard = Math.random() < 0.35
      const item = isHazard ? HAZARDS[Math.floor(Math.random() * HAZARDS.length)] : pickPowerup()
      w.drops.push({ id: w.nextId++, x: 8 + Math.random() * 84, y: -4, hazard: isHazard, ...item })
    }
    w.drops = w.drops.filter((d) => {
      d.y += 20 * dt
      if (d.y > 104) return false
      if (Math.abs(d.x - w.playerX) < 5 && Math.abs(d.y - PLAYER_Y) < 5) {
        if (d.hazard) {
          w.fx.rush = 5
          w.oy += 2
          w.pops.push({ id: w.nextId++, x: d.x, y: PLAYER_Y - 8, text: `${d.label} — AGING x2!`, color: '#ff3355', ttl: 1 })
          sfx.bad()
        } else {
          w.pops.push({ id: w.nextId++, x: d.x, y: PLAYER_Y - 8, text: `${d.label}: ${d.note}`, color: '#22e5ff', ttl: 1 })
          applyPowerup(w, d)
        }
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

  const w = world.current
  const activeBuffs = w ? Object.keys(w.fx).filter((k) => k !== 'rush' && w.fx[k] > 0) : []

  return (
    <GameShell
      game={game}
      score={score}
      onExit={onExit}
      onStart={reset}
      extraHud={
        <>
          <span style={{ color: '#a45bff' }}>{decadeLabel(wave)}</span>
          <span style={{ color: '#ff3355' }}>{'❤️'.repeat(Math.max(lives, 0)) || '💔'}</span>
          {activeBuffs.length > 0 && <span>{activeBuffs.map((k) => BUFF_ICONS[k]).join('')}</span>}
        </>
      }
    >
      {({ phase, end }) => {
        endRef.current = end
        return (
          <div
            ref={boardRef}
            onPointerMove={onPointerMove}
            onPointerDown={phase === 'playing' ? shoot : undefined}
            style={{ position: 'absolute', inset: 0, touchAction: 'none', userSelect: 'none' }}
          >
            {phase === 'playing' && w && (
              <>
                {w.banner && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '42%',
                      width: '100%',
                      textAlign: 'center',
                      fontFamily: 'var(--font-arcade)',
                      fontSize: 'clamp(13px, 3vw, 22px)',
                      color: '#ffe94a',
                      textShadow: '0 0 16px #ffe94a',
                      animation: 'popIn 0.4s ease',
                      zIndex: 8,
                    }}
                  >
                    {w.banner.text}
                  </div>
                )}
                {w.ufo && (
                  <span
                    style={{
                      position: 'absolute',
                      left: `${w.ufo.x}%`,
                      top: '6%',
                      transform: 'translate(-50%, -50%)',
                      fontSize: 30,
                      filter: 'drop-shadow(0 0 12px #ffe94a)',
                    }}
                  >
                    ⏳
                  </span>
                )}
                {w.invaders.filter((i) => i.alive).map((inv) => (
                  <span
                    key={`${inv.r}-${inv.c}`}
                    style={{
                      position: 'absolute',
                      left: `${w.ox + inv.c * SX}%`,
                      top: `${w.oy + inv.r * SY}%`,
                      transform: 'translate(-50%, -50%)',
                      fontSize: 26,
                      opacity: 0.4 + 0.6 * (inv.hp / ROW_TYPES[inv.r].hp),
                      filter: w.fx.freeze > 0 ? 'drop-shadow(0 0 8px #22e5ff) grayscale(0.4)' : 'drop-shadow(0 0 8px rgba(164,91,255,0.9))',
                    }}
                  >
                    {inv.emoji}
                  </span>
                ))}
                {w.bullets.map((b, i) => (
                  <div
                    key={i}
                    style={{
                      position: 'absolute',
                      left: `${b.x}%`,
                      top: `${b.y}%`,
                      transform: 'translate(-50%, -50%)',
                      width: 4,
                      height: 14,
                      borderRadius: 2,
                      background: w.fx.surge > 0 ? '#ffe94a' : '#22e5ff',
                      boxShadow: `0 0 10px ${w.fx.surge > 0 ? '#ffe94a' : '#22e5ff'}`,
                    }}
                  />
                ))}
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
                {w.drops.map((d) => (
                  <div
                    key={d.id}
                    style={{
                      position: 'absolute',
                      left: `${d.x}%`,
                      top: `${d.y}%`,
                      transform: 'translate(-50%, -50%)',
                      textAlign: 'center',
                      zIndex: 6,
                    }}
                  >
                    <div style={{ fontSize: 24, filter: d.hazard ? 'drop-shadow(0 0 8px #ff3355)' : 'drop-shadow(0 0 10px #4dff5e)', animation: 'pulse 0.7s ease infinite' }}>
                      {d.emoji}
                    </div>
                    <div style={{ fontFamily: 'var(--font-arcade)', fontSize: 8, color: d.hazard ? '#ff8080' : '#7dffb0', textShadow: '0 0 6px currentColor', whiteSpace: 'nowrap' }}>
                      {d.label}
                    </div>
                  </div>
                ))}
                {w.pops.map((p) => (
                  <span key={p.id} className="score-pop" style={{ left: `${p.x}%`, top: `${p.y}%`, color: p.color, whiteSpace: 'nowrap' }}>
                    {p.text}
                  </span>
                ))}
                {/* Your treatment cannon */}
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
                  ← → move · SPACE fire · catch peptides 🍊🧪✨ · dodge agers ☀️🍩😰📱
                </div>
              </>
            )}
          </div>
        )
      }}
    </GameShell>
  )
}
