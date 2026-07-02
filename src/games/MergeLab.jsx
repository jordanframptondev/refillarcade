import { useRef, useState } from 'react'
import GameShell from '../components/GameShell.jsx'
import { GAME_META } from './meta.js'
import { useGameLoop } from '../lib/useGameLoop.js'
import { sfx } from '../lib/sounds.js'

const TIERS = [
  null, // tiers are 1-indexed
  { emoji: '🧪', label: 'SALINE', color: '#8fa4ff' },
  { emoji: '💊', label: 'B12 SHOT', color: '#ff8a3d' },
  { emoji: '💉', label: 'BPC-157', color: '#22e5ff' },
  { emoji: '⚗️', label: 'IPAMORELIN', color: '#a45bff' },
  { emoji: '🧬', label: 'SEMAGLUTIDE', color: '#ff2fb9' },
  { emoji: '✨', label: 'GOLDEN FORMULA', color: '#ffe94a' },
]
const MAX_TIER = 6
const SLOTS = 12
const GAME_LEN = 90

export default function MergeLab({ onExit }) {
  const game = GAME_META['merge-lab']
  const [score, setScore] = useState(0)
  const [board, setBoard] = useState([]) // array of tier numbers or 0 = empty
  const [selected, setSelected] = useState(-1)
  const [timeLeft, setTimeLeft] = useState(GAME_LEN)
  const [pop, setPop] = useState(null) // {i, text, color, id}
  const world = useRef(null)
  const endRef = useRef(() => {})

  const reset = () => {
    world.current = { score: 0, elapsed: 0, autoIn: 3, popId: 1 }
    setBoard(Array(SLOTS).fill(0))
    setSelected(-1)
    setScore(0)
    setTimeLeft(GAME_LEN)
    setPop(null)
  }

  useGameLoop(!!world.current && timeLeft > 0, (dt) => {
    const w = world.current
    if (!w) return
    w.elapsed += dt
    const left = Math.max(0, GAME_LEN - w.elapsed)
    setTimeLeft(left)
    if (left <= 0) {
      const final = w.score
      world.current = null
      endRef.current(final)
      return
    }
    // Free vial drip every 3s so the board never starves
    w.autoIn -= dt
    if (w.autoIn <= 0) {
      w.autoIn = 3
      fill(true)
    }
  })

  const showPop = (i, text, color) => {
    const w = world.current
    if (!w) return
    setPop({ i, text, color, id: w.popId++ })
  }

  const fill = (auto = false) => {
    const w = world.current
    if (!w) return
    setBoard((b) => {
      const empty = b.map((t, i) => (t === 0 ? i : null)).filter((i) => i !== null)
      if (empty.length === 0) return b
      const i = empty[Math.floor(Math.random() * empty.length)]
      const next = [...b]
      next[i] = 1
      if (!auto) sfx.blip()
      return next
    })
  }

  const tap = (i) => {
    const w = world.current
    if (!w) return
    const tier = board[i]
    if (tier === 0) {
      setSelected(-1)
      return
    }
    if (selected === -1 || selected === i) {
      sfx.tick()
      setSelected(selected === i ? -1 : i)
      return
    }
    if (board[selected] === tier && tier < MAX_TIER) {
      // Merge!
      const merged = tier + 1
      const pts = merged * 10 + (merged === MAX_TIER ? 200 : 0)
      w.score += pts
      setScore(w.score)
      setBoard((b) => {
        const next = [...b]
        next[selected] = 0
        next[i] = merged
        return next
      })
      showPop(i, `+${pts}${merged === MAX_TIER ? ' 🏆' : ''}`, TIERS[merged].color)
      if (merged === MAX_TIER) sfx.levelUp()
      else sfx.good()
      setSelected(-1)
    } else {
      sfx.tick()
      setSelected(i)
    }
  }

  return (
    <GameShell
      game={game}
      score={score}
      onExit={onExit}
      onStart={reset}
      extraHud={<span style={{ color: timeLeft < 15 ? '#ff3355' : '#22e5ff' }}>⏱ {Math.ceil(timeLeft)}s</span>}
    >
      {({ phase, end }) => {
        endRef.current = end
        return (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 16,
              padding: 14,
            }}
          >
            {phase === 'playing' && board.length > 0 && (
              <>
                {/* Recipe strip */}
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
                  {TIERS.slice(1).map((t, i) => (
                    <span key={t.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ filter: `drop-shadow(0 0 6px ${t.color})` }}>{t.emoji}</span>
                      {i < MAX_TIER - 1 && <span style={{ color: '#6f5fb0' }}>→</span>}
                    </span>
                  ))}
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, minmax(64px, 105px))',
                    gap: 'clamp(8px, 1.5vw, 12px)',
                  }}
                >
                  {board.map((tier, i) => {
                    const t = TIERS[tier]
                    const isSel = selected === i
                    return (
                      <button
                        key={i}
                        onClick={() => tap(i)}
                        style={{
                          position: 'relative',
                          aspectRatio: '1',
                          borderRadius: 12,
                          border: `3px solid ${isSel ? '#ffe94a' : t ? t.color : '#3a2a6e'}`,
                          background: t
                            ? `radial-gradient(circle at 50% 35%, ${t.color}33, rgba(10,3,32,0.9))`
                            : 'rgba(255,255,255,0.03)',
                          boxShadow: isSel
                            ? '0 0 18px #ffe94a'
                            : t
                              ? `0 0 12px ${t.color}66`
                              : 'inset 0 0 12px rgba(0,0,0,0.6)',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 2,
                          cursor: 'pointer',
                          transform: isSel ? 'scale(1.07)' : 'none',
                          transition: 'transform 0.12s, box-shadow 0.12s',
                        }}
                      >
                        {t && (
                          <>
                            <span
                              style={{
                                fontSize: 'clamp(24px, 5vw, 38px)',
                                animation: tier === MAX_TIER ? 'pulse 0.8s ease infinite' : undefined,
                              }}
                            >
                              {t.emoji}
                            </span>
                            <span style={{ fontSize: 'clamp(9px, 1.4vw, 13px)', color: t.color, fontFamily: 'var(--font-pixel)' }}>
                              {t.label}
                            </span>
                          </>
                        )}
                        {pop && pop.i === i && (
                          <span
                            key={pop.id}
                            className="score-pop"
                            style={{ left: '50%', top: 0, transform: 'translateX(-50%)', color: pop.color }}
                          >
                            {pop.text}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
                <button className="btn btn-big btn-pink" onClick={() => fill(false)}>
                  🚰 FILL VIAL
                </button>
                <div style={{ color: '#6f5fb0', fontSize: 16, textAlign: 'center' }}>
                  Tap a vial, then tap its twin to merge · ✨ = +260 pts
                </div>
              </>
            )}
          </div>
        )
      }}
    </GameShell>
  )
}
