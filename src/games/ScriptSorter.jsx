import { useEffect, useRef, useState } from 'react'
import GameShell from '../components/GameShell.jsx'
import { GAME_META } from './meta.js'
import { useGameLoop } from '../lib/useGameLoop.js'
import { sfx } from '../lib/sounds.js'
import { isTypingTarget } from '../lib/keys.js'

const BINS = [
  { key: '1', id: 'peptide', label: 'PEPTIDE', emoji: '🧬', color: '#4dff5e' },
  { key: '2', id: 'trt', label: 'TRT', emoji: '💪', color: '#22e5ff' },
  { key: '3', id: 'hrt', label: 'HRT', emoji: '🌸', color: '#ff2fb9' },
  { key: '4', id: 'reject', label: 'REJECT', emoji: '🗑️', color: '#ff3355' },
]

const SCRIPTS = [
  { name: 'BPC-157', bin: 'peptide' },
  { name: 'CJC-1295', bin: 'peptide' },
  { name: 'IPAMORELIN', bin: 'peptide' },
  { name: 'SEMAGLUTIDE', bin: 'peptide' },
  { name: 'TIRZEPATIDE', bin: 'peptide' },
  { name: 'PT-141', bin: 'peptide' },
  { name: 'SERMORELIN', bin: 'peptide' },
  { name: 'TESAMORELIN', bin: 'peptide' },
  { name: 'TEST CYPIONATE', bin: 'trt' },
  { name: 'TEST ENANTHATE', bin: 'trt' },
  { name: 'HCG 5000IU', bin: 'trt' },
  { name: 'ENCLOMIPHENE', bin: 'trt' },
  { name: 'ESTRADIOL PATCH', bin: 'hrt' },
  { name: 'PROGESTERONE', bin: 'hrt' },
  { name: 'ESTRADIOL CREAM', bin: 'hrt' },
  { name: 'BIEST 50/50', bin: 'hrt' },
  { name: 'EXPIRED VIAL ☠️', bin: 'reject' },
  { name: 'DR. SKETCHY, NO DEA#', bin: 'reject' },
  { name: 'CRAYON ON NAPKIN', bin: 'reject' },
  { name: '"TRUST ME BRO" BLEND', bin: 'reject' },
  { name: 'GAS STATION SPECIAL', bin: 'reject' },
  { name: 'UNSIGNED SCRIPT', bin: 'reject' },
]

function nextScript(lastName) {
  let s
  do {
    s = SCRIPTS[Math.floor(Math.random() * SCRIPTS.length)]
  } while (s.name === lastName)
  return s
}

export default function ScriptSorter({ onExit }) {
  const game = GAME_META['script-sorter']
  const [score, setScore] = useState(0)
  const [strikes, setStrikes] = useState(0)
  const [card, setCard] = useState(null) // {script, progress}
  const [sorted, setSorted] = useState(0)
  const [flash, setFlash] = useState(null) // {binId, ok}
  const world = useRef(null)
  const endRef = useRef(() => {})

  const reset = () => {
    world.current = { progress: 0, sorted: 0, strikes: 0, score: 0, streak: 0 }
    setScore(0)
    setStrikes(0)
    setSorted(0)
    setCard({ script: nextScript(null), progress: 0 })
  }

  const gameOver = () => {
    const final = world.current.score
    world.current = null
    setCard(null)
    endRef.current(final)
  }

  const advance = () => {
    const w = world.current
    w.progress = 0
    setCard({ script: nextScript(card?.script.name), progress: 0 })
  }

  const answer = (binId) => {
    const w = world.current
    if (!w || !card) return
    if (binId === card.script.bin) {
      w.streak += 1
      const bonus = Math.min(w.streak, 5)
      w.score += 10 + bonus
      w.sorted += 1
      sfx.good()
      setFlash({ binId, ok: true })
    } else {
      w.streak = 0
      w.strikes += 1
      sfx.bad()
      setFlash({ binId, ok: false })
    }
    setTimeout(() => setFlash(null), 250)
    setScore(w.score)
    setSorted(w.sorted)
    setStrikes(w.strikes)
    if (w.strikes >= 3) gameOver()
    else advance()
  }

  // Conveyor timer: card slides left→right; reaching the end = a strike.
  useGameLoop(!!card, (dt) => {
    const w = world.current
    if (!w || !card) return
    const speed = 14 + Math.min(w.sorted * 1.4, 30) // %/s, ramps with progress
    w.progress += speed * dt
    if (w.progress >= 100) {
      w.streak = 0
      w.strikes += 1
      sfx.bad()
      setStrikes(w.strikes)
      if (w.strikes >= 3) {
        gameOver()
        return
      }
      advance()
      return
    }
    setCard((c) => (c ? { ...c, progress: w.progress } : c))
  })

  useEffect(() => {
    const onKey = (e) => {
      if (isTypingTarget(e)) return // don't hijack name-entry typing
      const bin = BINS.find((b) => b.key === e.key)
      if (bin) answer(bin.id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <GameShell
      game={game}
      score={score}
      onExit={onExit}
      onStart={reset}
      extraHud={
        <>
          <span style={{ color: '#22e5ff' }}>📦 {sorted}</span>
          <span style={{ color: '#ff3355' }}>{'❌'.repeat(strikes)}</span>
        </>
      }
    >
      {({ phase, end }) => {
        endRef.current = end
        return (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
            {phase === 'playing' && card && (
              <>
                {/* Conveyor */}
                <div
                  style={{
                    position: 'relative',
                    height: '46%',
                    borderBottom: '4px solid #a45bff',
                    background:
                      'repeating-linear-gradient(90deg, rgba(164,91,255,0.12) 0 30px, rgba(164,91,255,0.04) 30px 60px)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      left: `${card.progress * 0.82}%`,
                      top: '50%',
                      transform: 'translateY(-50%) rotate(-2deg)',
                      background: 'linear-gradient(180deg, #fdf8e2, #efe3b8)',
                      color: '#241354',
                      border: '3px solid #a45bff',
                      borderRadius: 8,
                      padding: '14px 18px',
                      fontFamily: 'var(--font-arcade)',
                      fontSize: 'clamp(9px, 2.2vw, 13px)',
                      boxShadow: '0 0 18px rgba(164,91,255,0.7)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <div style={{ fontSize: 10, color: '#8b6ad1', marginBottom: 6 }}>℞ SCRIPT</div>
                    {card.script.name}
                  </div>
                  {/* Danger zone at end of belt */}
                  <div
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: 0,
                      bottom: 0,
                      width: '7%',
                      background: 'linear-gradient(90deg, transparent, rgba(255,51,85,0.4))',
                      borderLeft: '2px dashed #ff3355',
                    }}
                  />
                </div>
                {/* Bins */}
                <div
                  style={{
                    flex: 1,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: 12,
                    padding: 16,
                    alignItems: 'stretch',
                  }}
                >
                  {BINS.map((b) => {
                    const isFlash = flash?.binId === b.id
                    return (
                      <button
                        key={b.id}
                        onClick={() => answer(b.id)}
                        style={{
                          border: `3px solid ${b.color}`,
                          borderRadius: 12,
                          background: isFlash
                            ? flash.ok
                              ? 'rgba(77,255,94,0.35)'
                              : 'rgba(255,51,85,0.4)'
                            : 'rgba(255,255,255,0.04)',
                          color: b.color,
                          fontFamily: 'var(--font-arcade)',
                          fontSize: 'clamp(8px, 1.8vw, 12px)',
                          boxShadow: `0 0 14px ${b.color}55`,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 8,
                          transition: 'background 0.15s',
                        }}
                      >
                        <span style={{ fontSize: 34 }}>{b.emoji}</span>
                        {b.label}
                        <span style={{ fontFamily: 'var(--font-pixel)', fontSize: 16, opacity: 0.7 }}>
                          [{b.key}]
                        </span>
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        )
      }}
    </GameShell>
  )
}
