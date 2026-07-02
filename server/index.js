// RefillArcade score server — a tiny Express API backed by one JSON file per
// game in server/data/. In production (after `vite build`) it also serves dist/.
import express from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { MAX_NAME_LEN, TOP_N } from '../shared/config.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, 'data')
const DIST_DIR = path.join(__dirname, '..', 'dist')
const PORT = process.env.PORT || 5174
const MAX_STORED = 100 // keep more than we show so ranks stay stable

fs.mkdirSync(DATA_DIR, { recursive: true })

// Game ids are simple slugs; rejecting anything else also blocks path traversal.
const validId = (id) => /^[a-z0-9-]{1,32}$/.test(id)
const fileFor = (id) => path.join(DATA_DIR, `${id}.json`)

function readScores(id) {
  try {
    const list = JSON.parse(fs.readFileSync(fileFor(id), 'utf8'))
    return Array.isArray(list) ? list : []
  } catch {
    return [] // missing or corrupt file = empty board
  }
}

const app = express()
app.use(express.json())

// Top scores for every game that has a data file: { gameId: [entries] }
app.get('/api/scores', (_req, res) => {
  const out = {}
  for (const f of fs.readdirSync(DATA_DIR)) {
    if (!f.endsWith('.json')) continue
    const id = f.slice(0, -'.json'.length)
    if (validId(id)) out[id] = readScores(id).slice(0, TOP_N)
  }
  res.json(out)
})

app.get('/api/scores/:gameId', (req, res) => {
  const { gameId } = req.params
  if (!validId(gameId)) return res.status(400).json({ error: 'bad game id' })
  res.json(readScores(gameId).slice(0, TOP_N))
})

// Submit a score: { name, score } → { scores: top10, rank: 1-based or null }
app.post('/api/scores/:gameId', (req, res) => {
  const { gameId } = req.params
  if (!validId(gameId)) return res.status(400).json({ error: 'bad game id' })

  const name = String(req.body?.name ?? '')
    .replace(/[^\x20-\x7E]/g, '') // printable ASCII only
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NAME_LEN)
    .trim() // clamping can leave a trailing space
  const score = Math.floor(Number(req.body?.score))

  if (!name) return res.status(400).json({ error: 'name required' })
  if (!Number.isFinite(score) || score < 0 || score > 1_000_000) {
    return res.status(400).json({ error: 'bad score' })
  }

  const scores = readScores(gameId)
  const entry = { name, score, at: new Date().toISOString() }
  scores.push(entry)
  scores.sort((a, b) => b.score - a.score || a.at.localeCompare(b.at))
  scores.length = Math.min(scores.length, MAX_STORED)
  fs.writeFileSync(fileFor(gameId), JSON.stringify(scores, null, 2))

  const idx = scores.indexOf(entry)
  const rank = idx >= 0 && idx < TOP_N ? idx + 1 : null
  res.json({ scores: scores.slice(0, TOP_N), rank })
})

// Serve the built app when dist/ exists, so `npm start` is a full deployment.
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR))
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api/')) return next()
    res.sendFile(path.join(DIST_DIR, 'index.html'))
  })
}

app.listen(PORT, () => {
  console.log(`RefillArcade score server → http://localhost:${PORT}`)
})
