// GET /api/scores → { gameId: [top-N entries] } for every game with scores.
// Runs as a Vercel serverless function in production (Redis-backed).
import { getAllTop } from '../../server/redisStore.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' })
  try {
    res.status(200).json(await getAllTop())
  } catch (err) {
    console.error('scores GET-all failed', err)
    res.status(500).json({ error: 'score store unavailable' })
  }
}
