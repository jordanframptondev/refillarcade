// Score API client — talks to the Express server in server/index.js, which
// persists one JSON file per game. (localStorage only keeps the player's name
// as a convenience prefill; all scores live on the server.)
import { MAX_NAME_LEN, TOP_N } from '../../shared/config.js'

export { MAX_NAME_LEN, TOP_N }

const NAME_KEY = 'refillarcade.playerName'

async function asJson(res) {
  if (!res.ok) throw new Error(`scores api ${res.status}`)
  return res.json()
}

// { gameId: [ {name, score, at}, ... ] } for every game with saved scores
export function fetchAllScores() {
  return fetch('/api/scores').then(asJson)
}

// Top 10 for one game: [ {name, score, at}, ... ]
export function fetchScores(gameId) {
  return fetch(`/api/scores/${gameId}`).then(asJson)
}

// Returns { scores: top10, rank: 1-based rank or null if outside the top 10 }
export function saveScore(gameId, name, score) {
  return fetch(`/api/scores/${gameId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, score }),
  }).then(asJson)
}

export function getSavedName() {
  try {
    return localStorage.getItem(NAME_KEY) || ''
  } catch {
    return ''
  }
}

export function rememberName(name) {
  try {
    localStorage.setItem(NAME_KEY, name)
  } catch {
    // private mode etc. — prefill is best-effort
  }
}
