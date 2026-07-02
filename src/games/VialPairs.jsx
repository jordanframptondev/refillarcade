import { useRef, useState } from 'react'
import GameShell from '../components/GameShell.jsx'
import { GAME_META } from './meta.js'
import { useGameLoop } from '../lib/useGameLoop.js'
import { sfx } from '../lib/sounds.js'

const FACES = [
  { emoji: '💉', label: 'TEST CYP' },
  { emoji: '🧪', label: 'BPC-157' },
  { emoji: '💊', label: 'SEMAGLUTIDE' },
  { emoji: '🧬', label: 'IPAMORELIN' },
  { emoji: '⚗️', label: 'NAD+' },
  { emoji: '🩹', label: 'ESTRADIOL' },
  { emoji: '🌡️', label: 'HCG' },
  { emoji: '🧫', label: 'PT-141' },
]

function buildDeck() {
  const cards = [...FACES, ...FACES].map((f, i) => ({ ...f, key: i, matched: false }))
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[cards[i], cards[j]] = [cards[j], cards[i]]
  }
  return cards
}

export default function VialPairs({ onExit }) {
  const game = GAME_META['vial-pairs']
  const [cards, setCards] = useState([])
  const [flipped, setFlipped] = useState([]) // indices currently face-up (unmatched)
  const [moves, setMoves] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [liveScore, setLiveScore] = useState(0)
  const running = useRef(false)
  const lock = useRef(false)
  const endRef = useRef(() => {})

  const scoreFor = (mv, secs) => Math.max(50, 1000 - mv * 15 - Math.floor(secs) * 5)

  const reset = () => {
    setCards(buildDeck())
    setFlipped([])
    setMoves(0)
    setElapsed(0)
    setLiveScore(1000)
    lock.current = false
    running.current = true
  }

  useGameLoop(running.current, (dt) => {
    setElapsed((e) => {
      const next = e + dt
      setLiveScore(scoreFor(movesRef.current, next))
      return next
    })
  })
  const movesRef = useRef(0)
  movesRef.current = moves

  const flip = (i) => {
    if (lock.current) return
    if (cards[i].matched || flipped.includes(i)) return
    sfx.blip()
    const nowFlipped = [...flipped, i]
    setFlipped(nowFlipped)
    if (nowFlipped.length === 2) {
      const [a, b] = nowFlipped
      const mv = moves + 1
      setMoves(mv)
      if (cards[a].label === cards[b].label) {
        sfx.good()
        const nextCards = cards.map((c, idx) => (idx === a || idx === b ? { ...c, matched: true } : c))
        setCards(nextCards)
        setFlipped([])
        if (nextCards.every((c) => c.matched)) {
          running.current = false
          sfx.levelUp()
          setTimeout(() => endRef.current(scoreFor(mv, elapsed)), 600)
        }
      } else {
        lock.current = true
        setTimeout(() => {
          setFlipped([])
          lock.current = false
        }, 700)
      }
    }
  }

  return (
    <GameShell
      game={game}
      score={liveScore}
      onExit={onExit}
      onStart={reset}
      extraHud={
        <>
          <span style={{ color: '#a45bff' }}>🃏 {moves}</span>
          <span style={{ color: '#22e5ff' }}>⏱ {Math.floor(elapsed)}s</span>
        </>
      }
    >
      {({ phase, end }) => {
        endRef.current = end
        return (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 14,
            }}
          >
            {phase === 'playing' && cards.length > 0 && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, minmax(64px, 110px))',
                  gap: 'clamp(8px, 1.6vw, 14px)',
                }}
              >
                {cards.map((c, i) => {
                  const faceUp = c.matched || flipped.includes(i)
                  return (
                    <button
                      key={c.key}
                      onClick={() => flip(i)}
                      style={{
                        aspectRatio: '3 / 4',
                        perspective: 400,
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      <div
                        style={{
                          position: 'relative',
                          width: '100%',
                          height: '100%',
                          transformStyle: 'preserve-3d',
                          transition: 'transform 0.35s',
                          transform: faceUp ? 'rotateY(180deg)' : 'none',
                        }}
                      >
                        {/* Back */}
                        <div
                          style={{
                            position: 'absolute',
                            inset: 0,
                            backfaceVisibility: 'hidden',
                            borderRadius: 10,
                            border: '2px solid #22e5ff',
                            background: 'linear-gradient(135deg, #1c0f42, #2a1660)',
                            boxShadow: '0 0 10px rgba(34,229,255,0.4)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 26,
                          }}
                        >
                          ❄️
                        </div>
                        {/* Face */}
                        <div
                          style={{
                            position: 'absolute',
                            inset: 0,
                            backfaceVisibility: 'hidden',
                            transform: 'rotateY(180deg)',
                            borderRadius: 10,
                            border: `2px solid ${c.matched ? '#4dff5e' : '#ff2fb9'}`,
                            background: c.matched
                              ? 'linear-gradient(135deg, #0e3a1c, #123f22)'
                              : 'linear-gradient(135deg, #3a1060, #4a1478)',
                            boxShadow: c.matched ? '0 0 14px rgba(77,255,94,0.7)' : '0 0 12px rgba(255,47,185,0.6)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 4,
                          }}
                        >
                          <span style={{ fontSize: 'clamp(22px, 4.5vw, 36px)' }}>{c.emoji}</span>
                          <span style={{ fontSize: 'clamp(9px, 1.5vw, 13px)', color: '#cfc3ff', fontFamily: 'var(--font-pixel)' }}>
                            {c.label}
                          </span>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )
      }}
    </GameShell>
  )
}
