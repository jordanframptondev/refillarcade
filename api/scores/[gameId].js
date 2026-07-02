// GET  /api/scores/:gameId → top-N entries for one game
// POST /api/scores/:gameId → submit { name, score }, returns { scores, rank }
// Vercel serverless function (Redis-backed) — validation is shared with the
// local Express server so both backends enforce identical rules.
import { isValidGameId, sanitizeName, parseScore } from '../../shared/leaderboard.js'
import { getTop, submitScore } from '../../server/redisStore.js'

export default async function handler(req, res) {
  const { gameId } = req.query
  if (!isValidGameId(gameId)) return res.status(400).json({ error: 'bad game id' })

  if (req.method === 'GET') {
    try {
      return res.status(200).json(await getTop(gameId))
    } catch (err) {
      console.error('scores GET failed', err)
      return res.status(500).json({ error: 'score store unavailable' })
    }
  }

  if (req.method === 'POST') {
    const name = sanitizeName(req.body?.name)
    const score = parseScore(req.body?.score)
    if (!name) return res.status(400).json({ error: 'name required' })
    if (score === null) return res.status(400).json({ error: 'bad score' })
    try {
      const at = new Date().toISOString()
      const salt = Math.random().toString(36).slice(2, 8)
      return res.status(200).json(await submitScore(gameId, name, score, at, salt))
    } catch (err) {
      console.error('scores POST failed', err)
      return res.status(500).json({ error: 'score store unavailable' })
    }
  }

  return res.status(405).json({ error: 'method not allowed' })
}
