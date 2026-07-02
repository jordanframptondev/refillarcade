import { useEffect, useRef, useState } from 'react'
import GameShell from '../components/GameShell.jsx'
import { GAME_META } from './meta.js'
import { useGameLoop } from '../lib/useGameLoop.js'
import { sfx } from '../lib/sounds.js'

// Real peptides & compounds from the medspa / wellness / longevity world
const REAL = [
  // Healing & recovery
  'BPC-157', 'TB-500', 'THYMOSIN BETA-4', 'GHK-CU', 'KPV', 'LL-37', 'ARA-290',
  // Growth hormone axis
  'CJC-1295', 'IPAMORELIN', 'SERMORELIN', 'TESAMORELIN', 'HEXARELIN',
  'GHRP-2', 'GHRP-6', 'MK-677', 'IGF-1 LR3', 'PEG-MGF', 'FOLLISTATIN-344',
  // GLP-1s & weight
  'SEMAGLUTIDE', 'TIRZEPATIDE', 'RETATRUTIDE', 'LIRAGLUTIDE', 'CAGRILINTIDE',
  'SURVODUTIDE', 'MAZDUTIDE', 'AOD-9604', 'TESOFENSINE', 'ADIPOTIDE', '5-AMINO-1MQ',
  // Hormone & libido
  'PT-141', 'KISSPEPTIN-10', 'GONADORELIN', 'TRIPTORELIN', 'ENCLOMIPHENE', 'OXYTOCIN',
  // Skin & aesthetics
  'MELANOTAN II', 'AFAMELANOTIDE', 'SETMELANOTIDE', 'ARGIRELINE', 'MATRIXYL',
  'SNAP-8', 'SYN-AKE', 'GLUTATHIONE',
  // Brain & mood
  'SELANK', 'SEMAX', 'DIHEXA', 'P21', 'CEREBROLYSIN', 'DSIP',
  // Longevity & cellular
  'EPITHALON', 'PINEALON', 'THYMOSIN ALPHA-1', 'THYMULIN', 'MOTS-C', 'HUMANIN',
  'SS-31', 'NAD+', 'NMN', 'SPERMIDINE', 'UROLITHIN A', 'METHYLENE BLUE', 'VIP',
]
// Total nonsense that sounds plausible — the funnier the better
const PRETEND = [
  // Gym bro classics
  'GAINZATROPIN', 'SWOLEMAX-9', 'FLEXORELIN', 'SHREDZEPATIDE', 'JUICEARELIN',
  'ABSOLUTIDE', 'PUMPAMORELIN', 'YOLOTROPIN', 'CHADMORELIN', 'THICCTIDE',
  'ZADDYZEPATIDE', 'GLUTESAMORELIN', 'BROSCIENCE-B12', 'SHREDDERALL',
  'MAXXOTROPIN', 'GYMTELLIGENCE-4', 'HULKAMORELIN', 'BROTEIN-9000',
  'ALPHAMAX-ULTRA', 'PREWORKATROPIN', 'GYMBROMIDE', 'SPOTTERELIN',
  'LEGDAYOLOL', 'BULKAMAX-50', 'CUTSEASONIDE', 'SWOLEMAGLUTIDE',
  // Body parts dept.
  'DELTOIDINE', 'QUADZILLATIDE', 'BICEPTIN-21', 'TRICEPTIDE', 'LATSPREADIN',
  'VASCULARELIN', 'PUMPZEPATIDE', 'JAWLINATIDE', 'CHISELINE-7', 'SCULPTORELIN',
  // Aesthetic influencer aisle
  'GLOWTIDE-X', 'SNATCHEDERMIN', 'VIBECELIN', 'LOOKSMAXINE', 'MEWTIDE',
  'AURAMORELIN', 'RIZZATIDE', 'SIGMARELIN', 'MOGATROPIN', 'DEWDROPIN',
  'GLASSKINULIN', 'FILTERELIN', 'SELFIETROPIN', 'THIRSTRAPTIDE', 'FILLERELIN',
  'PLUMPAMIDE', 'POUTATROPIN', 'SNATCHATIDE',
  // Hustle culture pharmacy
  'GRINDSETINE', 'HUSTLECULIN', 'MANSPLAINOLOL', 'FLEXAPENTIN',
  'NOPAINATIDE', 'SORENOMORE-5',
]
const Q_TIME = 6 // seconds per question

function buildDeck() {
  const qs = [
    ...REAL.map((name) => ({ name, real: true })),
    ...PRETEND.map((name) => ({ name, real: false })),
  ]
  for (let i = qs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[qs[i], qs[j]] = [qs[j], qs[i]]
  }
  return qs
}

export default function PeptideOrPretend({ onExit }) {
  const game = GAME_META['peptide-or-pretend']
  const [score, setScore] = useState(0)
  const [strikes, setStrikes] = useState(0)
  const [qIndex, setQIndex] = useState(0)
  const [timer, setTimer] = useState(Q_TIME)
  const [reveal, setReveal] = useState(null) // {correct, wasReal}
  const [, bump] = useState(0)
  const world = useRef(null)
  const endRef = useRef(() => {})

  const reset = () => {
    world.current = {
      deck: buildDeck(),
      i: 0,
      score: 0,
      strikes: 0,
      streak: 0,
      t: Q_TIME,
      locked: false,
    }
    setScore(0)
    setStrikes(0)
    setQIndex(0)
    setTimer(Q_TIME)
    setReveal(null)
    bump((n) => n + 1) // guarantee a re-render so the loop starts
  }

  const gameOver = () => {
    const final = world.current.score
    world.current = null
    endRef.current(final)
  }

  const next = () => {
    const w = world.current
    if (!w) return
    w.i += 1
    if (w.i >= w.deck.length) {
      // Cleared the whole deck — bonus!
      w.score += 100
      gameOver()
      return
    }
    w.t = Q_TIME
    w.locked = false
    setQIndex(w.i)
    setTimer(Q_TIME)
    setReveal(null)
  }

  const miss = () => {
    const w = world.current
    w.streak = 0
    w.strikes += 1
    setStrikes(w.strikes)
    sfx.bad()
  }

  const guess = (sayReal) => {
    const w = world.current
    if (!w || w.locked) return
    w.locked = true
    const q = w.deck[w.i]
    const correct = q.real === sayReal
    if (correct) {
      w.streak += 1
      const speedBonus = Math.round((w.t / Q_TIME) * 10)
      const pts = 10 + speedBonus + Math.min(w.streak, 5)
      w.score += pts
      sfx.good()
    } else {
      miss()
    }
    setScore(w.score)
    setReveal({ correct, wasReal: q.real })
    setTimeout(() => {
      if (!world.current) return
      if (world.current.strikes >= 3) gameOver()
      else next()
    }, 1000)
  }

  // Question countdown — running out = a strike.
  useGameLoop(!!world.current && strikes < 3, (dt) => {
    const w = world.current
    if (!w || w.locked) return
    w.t -= dt
    setTimer(Math.max(0, w.t))
    if (w.t <= 0) {
      w.locked = true
      miss()
      setReveal({ correct: false, wasReal: w.deck[w.i].real, timeout: true })
      setTimeout(() => {
        if (!world.current) return
        if (world.current.strikes >= 3) gameOver()
        else next()
      }, 1000)
    }
  })

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowLeft') guess(true)
      if (e.key === 'ArrowRight') guess(false)
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
          <span style={{ color: '#a45bff' }}>Q{qIndex + 1}</span>
          <span style={{ color: '#ff3355' }}>{'❌'.repeat(strikes)}</span>
        </>
      }
    >
      {({ phase, end }) => {
        endRef.current = end
        const w = world.current
        const q = w?.deck[w.i]
        return (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 26,
              padding: 20,
              textAlign: 'center',
            }}
          >
            {phase === 'playing' && q && (
              <>
                <div style={{ fontSize: 44 }}>{reveal ? (reveal.correct ? '🎉' : '🤡') : '🧐'}</div>
                {/* Timer bar */}
                <div style={{ width: '70%', height: 12, borderRadius: 6, border: '2px solid #a45bff', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${(timer / Q_TIME) * 100}%`,
                      height: '100%',
                      background: timer < 2 ? '#ff3355' : 'linear-gradient(90deg, #22e5ff, #4dff5e)',
                      boxShadow: '0 0 10px rgba(77,255,94,0.8)',
                    }}
                  />
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-arcade)',
                    fontSize: 'clamp(14px, 3.6vw, 26px)',
                    color: '#fff',
                    textShadow: '0 0 14px #a45bff',
                    letterSpacing: 2,
                    animation: reveal && !reveal.correct ? 'shake 0.4s ease' : 'popIn 0.25s ease',
                  }}
                >
                  {q.name}
                </div>
                <div style={{ minHeight: 30, fontFamily: 'var(--font-arcade)', fontSize: 13 }}>
                  {reveal && (
                    <span style={{ color: reveal.correct ? '#4dff5e' : '#ff3355' }}>
                      {reveal.timeout ? '⏰ TOO SLOW! ' : ''}
                      {reveal.wasReal ? 'IT\'S REAL 🧬' : 'TOTAL NONSENSE 🤡'}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <button
                    className="btn btn-big"
                    style={{ borderColor: '#4dff5e', color: '#4dff5e', background: 'rgba(77,255,94,0.1)' }}
                    onClick={() => guess(true)}
                  >
                    🧬 REAL [←]
                  </button>
                  <button
                    className="btn btn-big"
                    style={{ borderColor: '#ff8a3d', color: '#ff8a3d', background: 'rgba(255,138,61,0.1)' }}
                    onClick={() => guess(false)}
                  >
                    🤡 PRETEND [→]
                  </button>
                </div>
                <div style={{ color: '#6f5fb0', fontSize: 16 }}>Fast answers = bonus points!</div>
              </>
            )}
          </div>
        )
      }}
    </GameShell>
  )
}
