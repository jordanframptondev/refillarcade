import { useEffect, useRef, useState } from 'react'
import GameShell from '../components/GameShell.jsx'
import DPad from '../components/DPad.jsx'
import { GAME_META } from './meta.js'
import { useGameLoop } from '../lib/useGameLoop.js'
import { sfx } from '../lib/sounds.js'

const COLS = 13
const ROWS = 9
const DIRS = {
  up: [-1, 0],
  down: [1, 0],
  left: [0, -1],
  right: [0, 1],
}
const ZAP_RANGE = 3
const ZAP_COOLDOWN = 0.8

export default function DigDose({ onExit }) {
  const game = GAME_META['dig-dose']
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(3)
  const [level, setLevel] = useState(1)
  const [, setFrame] = useState(0)
  const world = useRef(null)
  const endRef = useRef(() => {})

  const buildLevel = (w) => {
    // 1 = tissue, 0 = dug tunnel
    w.grid = Array.from({ length: ROWS }, () => Array(COLS).fill(1))
    w.player = { r: 0, c: 0 }
    w.facing = 'right'
    w.grid[0][0] = 0
    w.enemies = []
    const count = 2 + w.level
    while (w.enemies.length < count) {
      const r = 2 + Math.floor(Math.random() * (ROWS - 2))
      const c = 2 + Math.floor(Math.random() * (COLS - 2))
      // keep spawn pockets away from the player and each other
      if (Math.abs(r - w.player.r) + Math.abs(c - w.player.c) < 6) continue
      if (w.enemies.some((e) => Math.abs(e.r - r) + Math.abs(e.c - c) < 3)) continue
      w.grid[r][c] = 0 // each bad cell sits in a little pre-dug pocket
      w.enemies.push({ id: w.enemies.length + 1, r, c })
    }
  }

  const reset = () => {
    const w = {
      level: 1,
      lives: 3,
      score: 0,
      stepIn: 0.6,
      zapCd: 0,
      zap: null, // {cells: [{r,c}], ttl}
      invuln: 0,
      pops: [],
      nextId: 100,
    }
    buildLevel(w)
    world.current = w
    setScore(0)
    setLives(3)
    setLevel(1)
    setFrame((f) => f + 1) // guarantee a re-render so the loop starts
  }

  const move = (dir) => {
    const w = world.current
    if (!w) return
    w.facing = dir
    const [dr, dc] = DIRS[dir]
    const r = w.player.r + dr
    const c = w.player.c + dc
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return
    if (w.grid[r][c] === 1) {
      w.grid[r][c] = 0
      w.score += 2 // digging tissue scores a little
      sfx.tick()
    }
    w.player = { r, c }
  }

  const zap = () => {
    const w = world.current
    if (!w || w.zapCd > 0) return
    w.zapCd = ZAP_COOLDOWN
    const [dr, dc] = DIRS[w.facing]
    const cells = []
    let { r, c } = w.player
    for (let i = 0; i < ZAP_RANGE; i++) {
      r += dr
      c += dc
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) break
      if (w.grid[r][c] === 1) break // the beam only travels through tunnels
      cells.push({ r, c })
      const hit = w.enemies.find((e) => e.r === r && e.c === c)
      if (hit) {
        w.enemies = w.enemies.filter((e) => e !== hit)
        w.score += 50
        w.pops.push({ id: w.nextId++, r, c, text: '+50', color: '#4dff5e', ttl: 0.7 })
        sfx.whack()
        break
      }
    }
    w.zap = { cells, ttl: 0.15 }
    sfx.blip()
  }

  useEffect(() => {
    const onKey = (e) => {
      const map = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' }
      if (map[e.key]) {
        e.preventDefault()
        move(map[e.key])
      }
      if (e.code === 'Space') {
        e.preventDefault()
        zap()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useGameLoop(!!world.current && lives > 0, (dt) => {
    const w = world.current
    if (!w) return
    if (w.zapCd > 0) w.zapCd -= dt
    if (w.invuln > 0) w.invuln -= dt
    if (w.zap && (w.zap.ttl -= dt) <= 0) w.zap = null
    w.pops = w.pops.filter((p) => (p.ttl -= dt) > 0)

    // Bad cells step toward the player through tunnels; sometimes they
    // gnaw through tissue to cut you off.
    w.stepIn -= dt
    if (w.stepIn <= 0) {
      w.stepIn = Math.max(0.28, 0.62 - w.level * 0.04)
      for (const e of w.enemies) {
        const options = Object.values(DIRS)
          .map(([dr, dc]) => ({ r: e.r + dr, c: e.c + dc }))
          .filter((p) => p.r >= 0 && p.r < ROWS && p.c >= 0 && p.c < COLS)
          .filter((p) => !w.enemies.some((o) => o !== e && o.r === p.r && o.c === p.c))
        const dist = (p) => Math.abs(p.r - w.player.r) + Math.abs(p.c - w.player.c)
        const dug = options.filter((p) => w.grid[p.r][p.c] === 0).sort((a, b) => dist(a) - dist(b))
        if (dug.length && (w.grid[e.r][e.c] === 0 || Math.random() < 0.8)) {
          const target = Math.random() < 0.8 ? dug[0] : dug[Math.floor(Math.random() * dug.length)]
          e.r = target.r
          e.c = target.c
        } else if (Math.random() < 0.35) {
          const digs = options.sort((a, b) => dist(a) - dist(b))
          if (digs.length) {
            w.grid[digs[0].r][digs[0].c] = 0
            e.r = digs[0].r
            e.c = digs[0].c
          }
        }
      }
    }

    // Touched by a bad cell → lose a life, respawn at the entrance
    if (w.invuln <= 0 && w.enemies.some((e) => e.r === w.player.r && e.c === w.player.c)) {
      w.lives -= 1
      w.invuln = 1.5
      w.player = { r: 0, c: 0 }
      w.facing = 'right'
      sfx.bad()
    }

    // Level cleared
    if (w.enemies.length === 0) {
      w.score += 100
      w.level += 1
      buildLevel(w)
      sfx.levelUp()
    }

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

  const cellLeft = (c) => `${((c + 0.5) / COLS) * 100}%`
  const cellTop = (r) => `${((r + 0.5) / ROWS) * 100}%`

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
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', userSelect: 'none' }}>
            {phase === 'playing' && w && (
              <>
                <div
                  style={{
                    position: 'relative',
                    width: 'min(92%, 720px)',
                    aspectRatio: `${COLS} / ${ROWS}`,
                    border: '3px solid #ff8a3d',
                    borderRadius: 10,
                    boxShadow: '0 0 18px rgba(255,138,61,0.5)',
                    overflow: 'hidden',
                    background: '#12052e',
                  }}
                >
                  {/* Tissue blocks */}
                  <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: `repeat(${COLS}, 1fr)`, gridTemplateRows: `repeat(${ROWS}, 1fr)` }}>
                    {w.grid.flatMap((row, r) =>
                      row.map((cell, c) => (
                        <div
                          key={`${r}-${c}`}
                          style={{
                            background: cell === 1 ? 'linear-gradient(135deg, #7a3b6e, #5a2456)' : 'transparent',
                            border: cell === 1 ? '1px solid rgba(255,150,200,0.25)' : 'none',
                            borderRadius: cell === 1 ? 4 : 0,
                            margin: cell === 1 ? 1 : 0,
                          }}
                        />
                      )),
                    )}
                  </div>
                  {/* Zap beam */}
                  {w.zap?.cells.map((cl) => (
                    <div
                      key={`z${cl.r}-${cl.c}`}
                      style={{
                        position: 'absolute',
                        left: cellLeft(cl.c),
                        top: cellTop(cl.r),
                        transform: 'translate(-50%, -50%)',
                        width: `${80 / COLS}%`,
                        height: `${60 / ROWS}%`,
                        background: 'rgba(34,229,255,0.5)',
                        boxShadow: '0 0 14px #22e5ff',
                        borderRadius: 6,
                      }}
                    />
                  ))}
                  {/* Bad cells */}
                  {w.enemies.map((e) => (
                    <span
                      key={e.id}
                      style={{
                        position: 'absolute',
                        left: cellLeft(e.c),
                        top: cellTop(e.r),
                        transform: 'translate(-50%, -50%)',
                        fontSize: 'clamp(18px, 3.4vw, 30px)',
                        filter: 'drop-shadow(0 0 8px #ff3355)',
                        transition: 'left 0.12s linear, top 0.12s linear',
                      }}
                    >
                      ☣️
                    </span>
                  ))}
                  {w.pops.map((p) => (
                    <span key={p.id} className="score-pop" style={{ left: cellLeft(p.c), top: cellTop(p.r), color: p.color }}>
                      {p.text}
                    </span>
                  ))}
                  {/* Peptide hero */}
                  <span
                    style={{
                      position: 'absolute',
                      left: cellLeft(w.player.c),
                      top: cellTop(w.player.r),
                      transform: 'translate(-50%, -50%)',
                      fontSize: 'clamp(18px, 3.6vw, 32px)',
                      filter: 'drop-shadow(0 0 10px #4dff5e)',
                      transition: 'left 0.08s linear, top 0.08s linear',
                      opacity: w.invuln > 0 && Math.floor(w.invuln * 10) % 2 === 0 ? 0.3 : 1,
                      zIndex: 5,
                    }}
                  >
                    🧬
                  </span>
                </div>
                <DPad onDir={move} actionLabel="⚡" onAction={zap} />
                <div style={{ position: 'absolute', bottom: 4, width: '100%', textAlign: 'center', color: '#6f5fb0', fontSize: 16 }}>
                  arrows/WASD dig · SPACE zaps down your tunnel · clear the bad cells!
                </div>
              </>
            )}
          </div>
        )
      }}
    </GameShell>
  )
}
