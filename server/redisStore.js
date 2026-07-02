// Redis-backed leaderboard for the Vercel serverless functions.
// One sorted set per game (scores:<id>) keyed by score — atomic ZADD means
// concurrent submissions can't clobber each other the way a read-modify-write
// JSON blob would. A companion set (`games`) tracks which games have scores so
// the lobby can fetch every champion in one shot.
import { Redis } from '@upstash/redis'
import { TOP_N } from '../shared/config.js'
import { MAX_STORED } from '../shared/leaderboard.js'

// Lazily create the client so importing this module never throws on a missing
// env var — a misconfiguration surfaces as a caught 500 at request time
// (logged) instead of crashing the whole function on cold start.
let redis
function db() {
  if (!redis) {
    // The Vercel + Upstash marketplace integration injects KV_REST_API_*; the
    // Upstash-native names are accepted too in case the DB is linked directly.
    redis = new Redis({
      url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
      automaticDeserialization: false, // we JSON-encode members ourselves
    })
  }
  return redis
}

// Test hook: inject a fake client (see server/redisStore.test.js).
export function __setRedisClient(fake) {
  redis = fake
}

const GAMES_KEY = 'games'
const keyFor = (id) => `scores:${id}`

// zrange(..., withScores) returns a flat [member, score, member, score, ...]
function toEntries(flat) {
  const out = []
  for (let i = 0; i < flat.length; i += 2) {
    try {
      const { name, at } = JSON.parse(flat[i])
      out.push({ name, score: Number(flat[i + 1]), at })
    } catch {
      // skip a malformed member rather than break the whole board
    }
  }
  return out
}

export async function getTop(gameId, n = TOP_N) {
  const flat = await db().zrange(keyFor(gameId), 0, n - 1, { rev: true, withScores: true })
  return toEntries(flat)
}

export async function getAllTop(n = TOP_N) {
  const ids = await db().smembers(GAMES_KEY)
  const out = {}
  await Promise.all(
    ids.map(async (id) => {
      out[id] = await getTop(id, n)
    }),
  )
  return out
}

// Returns { scores: top-N, rank: 1-based rank or null if outside the top N }.
export async function submitScore(gameId, name, score, at, salt) {
  const member = JSON.stringify({ name, at, s: salt }) // salt keeps ties unique
  const key = keyFor(gameId)
  await db().zadd(key, { score, member })
  await db().sadd(GAMES_KEY, gameId)
  // Trim to the highest MAX_STORED (rank 0 is the lowest score).
  await db().zremrangebyrank(key, 0, -(MAX_STORED + 1))
  const idx = await db().zrevrank(key, member) // 0-based, highest = 0
  const scores = await getTop(gameId, TOP_N)
  return { scores, rank: idx != null && idx < TOP_N ? idx + 1 : null }
}
