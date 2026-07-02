import { useEffect, useRef, useState } from 'react'
import GameShell from '../components/GameShell.jsx'
import { GAME_META } from './meta.js'
import { useGameLoop } from '../lib/useGameLoop.js'
import { sfx } from '../lib/sounds.js'
import { isTypingTarget } from '../lib/keys.js'

export default function PerfectDose({ onExit }) {
  const game = GAME_META['perfect-dose']
  const [score, setScore] = useState(0)
  const [round, setRound] = useState(1)
  const [misses, setMisses] = useState(0)
  const [needle, setNeedle] = useState(50)
  const [result, setResult] = useState(null) // {text, color}
  const [, bump] = useState(0)
  const world = useRef(null)
  const endRef = useRef(() => {})

  const newWindow = (r) => {
    const width = Math.max(7, 26 - r * 1.6)
    const start = 8 + Math.random() * (84 - width)
    return { start, width }
  }

  const reset = () => {
    world.current = {
      pos: 0,
      speed: 55,
      window: newWindow(1),
      round: 1,
      misses: 0,
      score: 0,
      locked: false,
    }
    setScore(0)
    setRound(1)
    setMisses(0)
    setResult(null)
    bump((n) => n + 1) // guarantee a re-render so the loop starts
  }

  // After a hit or miss, pause briefly, then next sweep (or game over).
  const scheduleNext = (w) => {
    setTimeout(() => {
      if (!world.current) return
      if (w.misses >= 3) {
        const final = w.score
        world.current = null
        endRef.current(final)
        return
      }
      w.window = newWindow(w.round)
      w.speed = 55 + w.round * 7
      w.pos = 0
      w.locked = false
      setResult(null)
    }, 750)
  }

  useGameLoop(!!world.current && misses < 3, (dt) => {
    const w = world.current
    if (!w || w.locked) return
    w.pos += w.speed * dt
    if (w.pos >= 100) {
      // One sweep only — letting the needle reach the end is a miss.
      w.pos = 100
      w.locked = true
      w.misses += 1
      setMisses(w.misses)
      setResult({ text: '⏰ TOO SLOW!', color: '#ff3355' })
      sfx.bad()
      scheduleNext(w)
    }
    setNeedle(w.pos)
  })

  const shoot = () => {
    const w = world.current
    if (!w || w.locked) return
    w.locked = true
    const { start, width } = w.window
    const inWindow = w.pos >= start && w.pos <= start + width
    const center = start + width / 2
    const offCenter = Math.abs(w.pos - center) / (width / 2) // 0 = bullseye

    if (inWindow) {
      const perfect = offCenter < 0.25
      const pts = perfect ? 50 : Math.round(30 - offCenter * 15)
      w.score += pts
      w.round += 1
      setResult(perfect ? { text: `💯 PERFECT! +${pts}`, color: '#ffe94a' } : { text: `✅ NICE +${pts}`, color: '#4dff5e' })
      if (perfect) sfx.levelUp()
      else sfx.good()
    } else {
      w.misses += 1
      const high = w.pos > center
      setResult({ text: high ? '📈 OVERSHOT!' : '📉 UNDERSHOT!', color: '#ff3355' })
      sfx.bad()
    }
    setScore(w.score)
    setRound(w.round)
    setMisses(w.misses)
    scheduleNext(w)
  }

  useEffect(() => {
    const onKey = (e) => {
      if (isTypingTarget(e)) return // don't hijack name-entry typing
      if (e.code === 'Space') {
        e.preventDefault()
        shoot()
      }
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
          <span style={{ color: '#a45bff' }}>RND {round}</span>
          <span style={{ color: '#ff3355' }}>{'❌'.repeat(misses)}</span>
        </>
      }
    >
      {({ phase, end }) => {
        endRef.current = end
        const w = world.current
        return (
          <div
            onPointerDown={phase === 'playing' ? shoot : undefined}
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 30,
              userSelect: 'none',
              touchAction: 'manipulation',
            }}
          >
            {phase === 'playing' && w && (
              <>
                <div style={{ fontSize: 56, filter: 'drop-shadow(0 0 12px #ffe94a)' }}>
                  {result ? (result.color === '#ff3355' ? '😵' : '😎') : '🧑‍⚕️'}
                </div>
                {/* Meter */}
                <div style={{ width: '84%', position: 'relative' }}>
                  <div
                    style={{
                      position: 'relative',
                      height: 54,
                      borderRadius: 27,
                      border: '3px solid #a45bff',
                      background: 'linear-gradient(90deg, rgba(255,51,85,0.25), rgba(255,138,61,0.2) 30%, rgba(255,138,61,0.2) 70%, rgba(255,51,85,0.25))',
                      boxShadow: '0 0 20px rgba(164,91,255,0.5), inset 0 0 18px rgba(0,0,0,0.6)',
                      overflow: 'hidden',
                    }}
                  >
                    {/* Therapeutic window */}
                    <div
                      style={{
                        position: 'absolute',
                        left: `${w.window.start}%`,
                        width: `${w.window.width}%`,
                        top: 0,
                        bottom: 0,
                        background: 'rgba(77,255,94,0.45)',
                        border: '2px solid #4dff5e',
                        boxShadow: '0 0 16px rgba(77,255,94,0.9)',
                      }}
                    />
                    {/* Bullseye tick */}
                    <div
                      style={{
                        position: 'absolute',
                        left: `${w.window.start + w.window.width / 2}%`,
                        top: 0,
                        bottom: 0,
                        width: 2,
                        background: '#ffe94a',
                      }}
                    />
                  </div>
                  {/* Needle */}
                  <div
                    style={{
                      position: 'absolute',
                      left: `${needle}%`,
                      top: -18,
                      transform: 'translateX(-50%)',
                      fontSize: 32,
                      filter: 'drop-shadow(0 0 8px #22e5ff)',
                      transition: w.locked ? 'none' : undefined,
                    }}
                  >
                    💉
                  </div>
                </div>
                <div style={{ minHeight: 40, fontFamily: 'var(--font-arcade)', fontSize: 16 }}>
                  {result ? (
                    <span style={{ color: result.color, textShadow: `0 0 12px ${result.color}` }}>{result.text}</span>
                  ) : (
                    <span style={{ color: '#6f5fb0', fontSize: 12 }}>SPACE / TAP TO DOSE</span>
                  )}
                </div>
                <div style={{ color: '#6f5fb0', fontSize: 16 }}>
                  One sweep only — stop it in the green window before it reaches the end · center line = PERFECT
                </div>
              </>
            )}
          </div>
        )
      }}
    </GameShell>
  )
}
