import { useEffect, useState } from 'react'
import { getHighScore, submitScore } from '../lib/scores.js'
import { sfx } from '../lib/sounds.js'

// Shared wrapper for every cabinet: HUD (score/best/back), ready overlay with
// instructions, and game-over overlay with new-record handling.
// `onStart` runs when the player hits START/AGAIN — games reset their world there.
// Children is a render function: ({ phase, start, end }) => game board.
// Games call `end(finalScore)` when the run is over.
export default function GameShell({ game, score, children, onExit, onStart, extraHud = null }) {
  const [phase, setPhase] = useState('ready') // ready | playing | over
  const [best, setBest] = useState(() => getHighScore(game.id))
  const [isRecord, setIsRecord] = useState(false)
  const [finalScore, setFinalScore] = useState(0)

  const start = () => {
    sfx.select()
    setIsRecord(false)
    onStart?.()
    setPhase('playing')
  }

  const end = (s) => {
    setFinalScore(s)
    const record = submitScore(game.id, s)
    setIsRecord(record)
    if (record) setBest(s)
    sfx.gameOver()
    setPhase('over')
  }

  // ESC backs out to the lobby.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onExit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onExit])

  return (
    <div className="game-page">
      <div className="game-hud">
        <button className="btn btn-pink" onClick={onExit}>◀ ARCADE</button>
        <div className="hud-stats">
          <span className="hud-score">SCORE {score}</span>
          <span className="hud-best">BEST {best}</span>
          {extraHud}
        </div>
      </div>
      <div className="game-frame" style={{ height: 'min(64vh, 560px)' }}>
        {phase === 'ready' && (
          <div className="game-overlay">
            <div className="overlay-emoji">{game.emoji}</div>
            <div className="overlay-title">{game.title}</div>
            <div className="overlay-text">{game.howTo}</div>
            <button className="btn btn-big" onClick={start}>▶ START</button>
          </div>
        )}
        {phase === 'over' && (
          <div className="game-overlay">
            <div className="overlay-emoji">{isRecord ? '🏆' : '💀'}</div>
            <div className="overlay-title">GAME OVER</div>
            {isRecord && <div className="new-record">★ NEW HIGH SCORE! ★</div>}
            <div className="overlay-text">
              You scored <b style={{ color: '#4dff5e' }}>{finalScore}</b>
              {!isRecord && best > 0 && <> — best is {best}</>}
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-big" onClick={start}>↻ AGAIN</button>
              <button className="btn btn-big btn-pink" onClick={onExit}>◀ ARCADE</button>
            </div>
          </div>
        )}
        {children({ phase, start, end })}
      </div>
    </div>
  )
}
