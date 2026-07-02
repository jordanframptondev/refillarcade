// High scores persisted in localStorage, keyed per game.
const KEY = 'refillarcade.scores.v1'

function readAll() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {}
  } catch {
    return {}
  }
}

export function getHighScore(gameId) {
  return readAll()[gameId] || 0
}

// Returns true if this score is a new record.
export function submitScore(gameId, score) {
  const all = readAll()
  if (score > (all[gameId] || 0)) {
    all[gameId] = score
    localStorage.setItem(KEY, JSON.stringify(all))
    return true
  }
  return false
}
