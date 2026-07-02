import { useEffect, useState } from 'react'
import { GAMES } from './games/index.js'
import { fetchAllScores } from './lib/scores.js'
import { sfx, isMuted, toggleMute } from './lib/sounds.js'

const FLOATERS = ['💉', '🧪', '💊', '🧬', '⚗️', '🩹', '✨', '👾', '🕹️', '💪']

function Floaters() {
  return (
    <div className="floaters" aria-hidden="true">
      {FLOATERS.map((f, i) => (
        <span
          key={i}
          className="floater"
          style={{
            left: `${(i * 97) % 100}%`,
            top: `${(i * 53 + 15) % 90}%`,
            fontSize: `${26 + (i % 4) * 12}px`,
            '--dur': `${9 + (i % 5) * 3}s`,
            animationDelay: `${-i * 1.7}s`,
          }}
        >
          {f}
        </span>
      ))}
    </div>
  )
}

function Marquee() {
  const msg =
    '🕹️ WELCOME TO REFILLARCADE 🕹️ ··· 💉 CATCH THE VIALS ··· 🏃 RUN FOR GAINS ··· 🎯 HIT THE THERAPEUTIC WINDOW ··· 🔨 SMACK THOSE SYMPTOMS ··· 🧠 PEPTIDE OR PRETEND? ··· NO REAL DOSING ADVICE, JUST HIGH SCORES ··· '
  return (
    <div className="marquee">
      <span className="marquee-inner">{msg + msg}</span>
    </div>
  )
}

function Lobby({ onSelect }) {
  // Champion per game, fetched from the score server
  const [bests, setBests] = useState({})
  useEffect(() => {
    fetchAllScores()
      .then((all) => {
        const map = {}
        for (const id of Object.keys(all)) map[id] = all[id][0] || null
        setBests(map)
      })
      .catch(() => {}) // server offline — cabinets just show no score
  }, [])

  return (
    <div className="lobby">
      <h1 className="neon-title lobby-title">REFILL ARCADE</h1>
      <div className="insert-coin">▸ INSERT COIN — PICK A CABINET ◂</div>
      <div className="cabinet-grid">
        {GAMES.map((g) => {
          const best = bests[g.id]
          return (
            <button
              key={g.id}
              className="cabinet"
              style={{ '--cab-color': g.color }}
              onClick={() => {
                sfx.coin()
                onSelect(g.id)
              }}
            >
              <div className="cabinet-marquee">{g.title}</div>
              <div className="cabinet-screen">{g.emoji}</div>
              <div className="cabinet-tagline">{g.tagline}</div>
              <div className="cabinet-best">
                {best ? `★ ${best.score} · ${best.name}` : '☆ NO SCORE YET'}
              </div>
              <div className="cabinet-play">▶ PLAY</div>
            </button>
          )
        })}
      </div>
      <p style={{ marginTop: 40, color: '#8f7fc9', fontSize: 18 }}>
        Cartoon vials only — nothing in here is medical advice. 😄
      </p>
    </div>
  )
}

export default function App() {
  const [gameId, setGameId] = useState(null)
  const [muted, setMuted] = useState(isMuted())
  const game = GAMES.find((g) => g.id === gameId)

  return (
    <div className="app">
      <Floaters />
      <Marquee />
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 16px 0' }}>
        <button
          className="btn"
          onClick={() => {
            setMuted(toggleMute())
            sfx.blip()
          }}
        >
          {muted ? '🔇 SOUND OFF' : '🔊 SOUND ON'}
        </button>
      </div>
      {game ? (
        <game.Component
          key={game.id}
          onExit={() => {
            sfx.blip()
            setGameId(null)
          }}
        />
      ) : (
        <Lobby onSelect={setGameId} />
      )}
    </div>
  )
}
