import { useCallback, useEffect, useState } from 'react'
import { fetchScores, saveScore, getSavedName, rememberName, MAX_NAME_LEN, TOP_N } from '../lib/scores.js'
import { sfx } from '../lib/sounds.js'

const MEDALS = ['🥇', '🥈', '🥉']

// Shared wrapper for every cabinet: HUD (score/best/back), ready overlay with
// instructions, game-over overlay with name entry when the score makes the
// top 10, and a leaderboard viewer. Scores live on the score server.
// `onStart` runs when the player hits START/AGAIN — games reset their world there.
// Children is a render function: ({ phase, start, end }) => game board.
// Games call `end(finalScore)` when the run is over.
export default function GameShell({ game, score, children, onExit, onStart, extraHud = null }) {
  const [phase, setPhase] = useState('ready') // ready | playing | over
  const [finalScore, setFinalScore] = useState(0)
  const [wasRecord, setWasRecord] = useState(false)
  const [board, setBoard] = useState(null) // top-10 list, null while loading
  const [boardError, setBoardError] = useState(false)
  const [showBoard, setShowBoard] = useState(false)
  const [name, setName] = useState(getSavedName())
  const [saveState, setSaveState] = useState('idle') // idle | saving | saved | skipped | error
  const [savedRank, setSavedRank] = useState(null)

  const loadBoard = useCallback(() => {
    fetchScores(game.id)
      .then((s) => {
        setBoard(s)
        setBoardError(false)
      })
      .catch(() => setBoardError(true))
  }, [game.id])

  useEffect(() => {
    loadBoard()
  }, [loadBoard])

  const best = board?.[0]?.score ?? 0

  const start = () => {
    sfx.select()
    setSaveState('idle')
    setSavedRank(null)
    setShowBoard(false)
    onStart?.()
    setPhase('playing')
  }

  const end = (s) => {
    setFinalScore(s)
    setWasRecord(s > best)
    setSaveState('idle')
    setSavedRank(null)
    sfx.gameOver()
    setPhase('over')
  }

  // Does this run make the top 10? (Only decidable once the board has loaded.)
  const qualifies =
    finalScore > 0 &&
    !boardError &&
    board !== null &&
    (board.length < TOP_N || finalScore > board[board.length - 1].score)

  const doSave = async (e) => {
    e.preventDefault()
    const trimmed = name.replace(/\s+/g, ' ').trim()
    if (!trimmed || saveState === 'saving') return
    setSaveState('saving')
    try {
      rememberName(trimmed)
      const res = await saveScore(game.id, trimmed, finalScore)
      setBoard(res.scores)
      setSavedRank(res.rank)
      setSaveState('saved')
      sfx.levelUp()
    } catch {
      setSaveState('error')
    }
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
            <div className="overlay-emoji">{wasRecord ? '🏆' : '💀'}</div>
            <div className="overlay-title">GAME OVER</div>
            {wasRecord && <div className="new-record">★ NEW HIGH SCORE! ★</div>}
            <div className="overlay-text">
              You scored <b style={{ color: '#4dff5e' }}>{finalScore}</b>
              {!wasRecord && best > 0 && <> — best is {best}</>}
            </div>

            {qualifies && (saveState === 'idle' || saveState === 'saving' || saveState === 'error') && (
              <form onSubmit={doSave} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <div style={{ color: '#22e5ff', fontSize: 20 }}>
                  🎉 You made the TOP {TOP_N}! Enter your name:
                </div>
                <input
                  className="name-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={MAX_NAME_LEN}
                  placeholder="YOUR NAME"
                  autoFocus
                  aria-label="Player name"
                />
                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="submit" className="btn" disabled={saveState === 'saving' || !name.trim()}>
                    {saveState === 'saving' ? 'SAVING…' : '💾 SAVE SCORE'}
                  </button>
                  <button type="button" className="btn btn-pink" onClick={() => setSaveState('skipped')}>
                    SKIP
                  </button>
                </div>
                {saveState === 'error' && (
                  <div style={{ color: '#ff3355', fontSize: 18 }}>Couldn't reach the score server — try again?</div>
                )}
              </form>
            )}
            {saveState === 'saved' && (
              <div className="new-record" style={{ animation: 'none' }}>
                💾 SAVED{savedRank ? ` — RANK #${savedRank}` : '!'}
              </div>
            )}

            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-big" onClick={start}>↻ AGAIN</button>
              <button className="btn btn-big btn-pink" onClick={onExit}>◀ ARCADE</button>
            </div>
          </div>
        )}
        {showBoard && (
          <div className="game-overlay" style={{ zIndex: 30 }}>
            <div className="overlay-title" style={{ color: '#ffe94a', textShadow: '0 0 14px #ffe94a' }}>
              🏆 TOP {TOP_N}
            </div>
            <div style={{ color: '#cfc3ff', fontSize: 20 }}>{game.title}</div>
            {boardError ? (
              <div className="overlay-text" style={{ color: '#ff3355' }}>
                Score server offline — start it with <b>npm run dev</b>.
              </div>
            ) : board === null ? (
              <div className="overlay-text">Loading…</div>
            ) : board.length === 0 ? (
              <div className="overlay-text">No scores yet — be the first! 👀</div>
            ) : (
              <div className="lb-list">
                {board.map((entry, i) => (
                  <div key={`${entry.at}-${i}`} className={`lb-row${i === 0 ? ' lb-top' : ''}`}>
                    <span className="lb-rank">{MEDALS[i] || `${i + 1}.`}</span>
                    <span className="lb-name">{entry.name}</span>
                    <span className="lb-score">{entry.score}</span>
                  </div>
                ))}
              </div>
            )}
            <button className="btn" onClick={() => setShowBoard(false)}>✕ CLOSE</button>
          </div>
        )}
        {children({ phase, start, end })}
      </div>
      {phase !== 'playing' && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 14 }}>
          <button
            className="btn"
            onClick={() => {
              sfx.blip()
              loadBoard()
              setShowBoard((v) => !v)
            }}
          >
            🏆 HIGH SCORES
          </button>
        </div>
      )}
    </div>
  )
}
