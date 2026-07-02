import { useRef, useState } from 'react'
import GameShell from '../components/GameShell.jsx'
import { GAME_META } from './meta.js'
import { useGameLoop } from '../lib/useGameLoop.js'
import { sfx } from '../lib/sounds.js'

const GOOD = [
  { emoji: '💊', points: 5 },
  { emoji: '💉', points: 10 },
  { emoji: '🧪', points: 15 },
  { emoji: '🧬', points: 25 }, // rare
]
const BAD = [
  { emoji: '☠️', label: 'COUNTERFEIT!' },
  { emoji: '🛢️', label: 'DEA AUDIT!' },
]

const TRAY_W = 14 // percent of board width

export default function PeptidePanic({ onExit }) {
  const game = GAME_META['peptide-panic']
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(3)
  const [combo, setCombo] = useState(0)
  const [, setFrame] = useState(0) // re-render tick; world lives in refs

  const world = useRef(null)
  const keys = useRef({})
  const boardRef = useRef(null)
  const endRef = useRef(() => {})

  const reset = () => {
    world.current = {
      trayX: 50,
      items: [], // {id, x, y, speed, good, emoji, points, label}
      pops: [], // {id, x, y, text, color}
      spawnIn: 0.5,
      elapsed: 0,
      nextId: 1,
      lives: 3,
      score: 0,
      combo: 0,
      shake: false,
    }
    setScore(0)
    setLives(3)
    setCombo(0)
    setFrame((f) => f + 1) // guarantee a re-render so the loop starts
  }

  useGameLoop(!!world.current && lives > 0, (dt) => {
    const w = world.current
    if (!w) return
    w.elapsed += dt

    // Tray movement — keyboard
    const speed = 65 // percent per second
    if (keys.current.ArrowLeft || keys.current.a) w.trayX -= speed * dt
    if (keys.current.ArrowRight || keys.current.d) w.trayX += speed * dt
    w.trayX = Math.max(TRAY_W / 2, Math.min(100 - TRAY_W / 2, w.trayX))

    // Difficulty ramps over time
    const level = 1 + w.elapsed / 25
    w.spawnIn -= dt
    if (w.spawnIn <= 0) {
      w.spawnIn = Math.max(0.28, 1 / level)
      const isBad = Math.random() < Math.min(0.38, 0.16 + w.elapsed / 120)
      const type = isBad
        ? BAD[Math.floor(Math.random() * BAD.length)]
        : GOOD[Math.random() < 0.08 ? 3 : Math.floor(Math.random() * 3)]
      w.items.push({
        id: w.nextId++,
        x: 5 + Math.random() * 90,
        y: -8,
        speed: (16 + Math.random() * 12) * Math.min(level, 3.2),
        good: !isBad,
        ...type,
      })
    }

    // Move items, detect catches / misses
    const trayTop = 88
    w.items = w.items.filter((it) => {
      it.y += it.speed * dt
      const caught = it.y >= trayTop - 4 && it.y <= trayTop + 6 && Math.abs(it.x - w.trayX) < TRAY_W / 2 + 3
      if (caught) {
        if (it.good) {
          w.combo += 1
          const mult = 1 + Math.floor(w.combo / 5)
          const pts = it.points * mult
          w.score += pts
          w.pops.push({ id: w.nextId++, x: it.x, y: trayTop - 6, text: `+${pts}${mult > 1 ? ` x${mult}` : ''}`, color: '#4dff5e' })
          sfx.good()
        } else {
          w.lives -= 1
          w.combo = 0
          w.pops.push({ id: w.nextId++, x: it.x, y: trayTop - 6, text: it.label, color: '#ff3355' })
          w.shake = true
          setTimeout(() => { if (world.current) world.current.shake = false }, 400)
          sfx.bad()
        }
        return false
      }
      if (it.y > 105) {
        // Dropping a good vial breaks the combo (but no life lost)
        if (it.good) w.combo = 0
        return false
      }
      return true
    })

    // Expire popups
    w.pops = w.pops.filter((p) => {
      p.ttl = (p.ttl ?? 0.8) - dt
      return p.ttl > 0
    })

    setScore(w.score)
    setCombo(w.combo)
    if (w.lives !== undefined) setLives(w.lives)
    if (w.lives <= 0) {
      const final = w.score
      world.current = null
      endRef.current(final)
      return
    }
    setFrame((f) => f + 1)
  })

  const onKey = (down) => (e) => {
    if (['ArrowLeft', 'ArrowRight', 'a', 'd'].includes(e.key)) {
      keys.current[e.key] = down
      e.preventDefault()
    }
  }

  const onPointerMove = (e) => {
    const w = world.current
    const board = boardRef.current
    if (!w || !board) return
    const rect = board.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    w.trayX = Math.max(TRAY_W / 2, Math.min(100 - TRAY_W / 2, x))
  }

  return (
    <GameShell
      game={game}
      score={score}
      onExit={onExit}
      onStart={reset}
      extraHud={
        <>
          <span style={{ color: '#ff3355' }}>{'❤️'.repeat(Math.max(lives, 0)) || '💔'}</span>
          {combo >= 5 && <span style={{ color: '#ffe94a' }}>🔥x{1 + Math.floor(combo / 5)}</span>}
        </>
      }
    >
      {({ phase, end }) => {
        endRef.current = end
        const w = world.current
        return (
          <div
            className={w?.shake ? 'shake' : ''}
            onKeyDown={onKey(true)}
            onKeyUp={onKey(false)}
            onPointerMove={onPointerMove}
            tabIndex={0}
            ref={(el) => {
              boardRef.current = el
              if (el && phase === 'playing' && document.activeElement !== el) el.focus()
            }}
            style={{ position: 'absolute', inset: 0, outline: 'none', touchAction: 'none', cursor: 'none' }}
          >
            {phase === 'playing' && w && (
              <>
                {w.items.map((it) => (
                  <span
                    key={it.id}
                    style={{
                      position: 'absolute',
                      left: `${it.x}%`,
                      top: `${it.y}%`,
                      transform: 'translate(-50%, -50%)',
                      fontSize: 34,
                      filter: it.good
                        ? 'drop-shadow(0 0 8px rgba(77,255,94,0.9))'
                        : 'drop-shadow(0 0 10px rgba(255,51,85,1))',
                    }}
                  >
                    {it.emoji}
                  </span>
                ))}
                {w.pops.map((p) => (
                  <span key={p.id} className="score-pop" style={{ left: `${p.x}%`, top: `${p.y}%`, color: p.color }}>
                    {p.text}
                  </span>
                ))}
                {/* Tray */}
                <div
                  style={{
                    position: 'absolute',
                    left: `${w.trayX}%`,
                    top: '88%',
                    transform: 'translate(-50%, -50%)',
                    width: `${TRAY_W}%`,
                    textAlign: 'center',
                    fontSize: 40,
                    filter: 'drop-shadow(0 0 12px #22e5ff)',
                  }}
                >
                  🛒
                </div>
                <div style={{ position: 'absolute', bottom: 4, width: '100%', textAlign: 'center', color: '#6f5fb0', fontSize: 16 }}>
                  ← → move · catch 💊💉🧪🧬 · dodge ☠️🛢️
                </div>
              </>
            )}
          </div>
        )
      }}
    </GameShell>
  )
}
