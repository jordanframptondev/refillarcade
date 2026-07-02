// Exercises the real redisStore module against an in-memory fake Redis that
// mimics sorted-set semantics, so the leaderboard algorithm (ordering, rank,
// trim, tie-uniqueness) is verified without a live Upstash connection.
// Run: node server/redisStore.test.js
import assert from 'node:assert'
import { TOP_N } from '../shared/config.js'
import { MAX_STORED } from '../shared/leaderboard.js'
import { __setRedisClient, getTop, getAllTop, submitScore } from './redisStore.js'

// --- Fake Redis: ZSETs sorted by (score asc, member lex), plain sets ---
function makeFakeRedis() {
  const zsets = new Map() // key -> [{member, score}]
  const sets = new Map() // key -> Set
  const z = (k) => zsets.get(k) || (zsets.set(k, []), zsets.get(k))
  const sorted = (arr) => [...arr].sort((a, b) => a.score - b.score || (a.member < b.member ? -1 : 1))
  return {
    async zadd(key, { score, member }) {
      const arr = z(key)
      const found = arr.find((e) => e.member === member)
      if (found) found.score = score
      else arr.push({ member, score })
    },
    async zrange(key, start, stop, opts = {}) {
      let arr = sorted(z(key))
      if (opts.rev) arr.reverse()
      const slice = arr.slice(start, stop + 1)
      if (opts.withScores) return slice.flatMap((e) => [e.member, String(e.score)])
      return slice.map((e) => e.member)
    },
    async zremrangebyrank(key, start, stop) {
      const arr = sorted(z(key))
      const n = arr.length
      // Match Redis: normalize negatives, clamp lo up to 0 and hi down to n-1,
      // but a still-negative hi leaves lo > hi → empty range (remove nothing).
      let lo = start < 0 ? start + n : start
      let hi = stop < 0 ? stop + n : stop
      if (lo < 0) lo = 0
      if (hi >= n) hi = n - 1
      if (n === 0 || lo > hi) return
      const remove = new Set(arr.slice(lo, hi + 1).map((e) => e.member))
      zsets.set(key, z(key).filter((e) => !remove.has(e.member)))
    },
    async zrevrank(key, member) {
      const arr = sorted(z(key)).reverse()
      const i = arr.findIndex((e) => e.member === member)
      return i === -1 ? null : i
    },
    async sadd(key, member) {
      if (!sets.has(key)) sets.set(key, new Set())
      sets.get(key).add(member)
    },
    async smembers(key) {
      return [...(sets.get(key) || [])]
    },
  }
}

let passed = 0
const ok = (label) => {
  passed++
  console.log(`  ✓ ${label}`)
}

async function run() {
  __setRedisClient(makeFakeRedis())

  // 1. Ordering + rank on submit
  await submitScore('dna', 'Newman', 50, '2026-01-01T00:00:00.000Z', 'a')
  let r = await submitScore('dna', 'Kramer', 999, '2026-01-01T00:00:01.000Z', 'b')
  assert.equal(r.rank, 1, 'top score ranks #1')
  r = await submitScore('dna', 'Jerry', 100, '2026-01-01T00:00:02.000Z', 'c')
  assert.equal(r.rank, 2, 'middle score ranks #2')
  const top = await getTop('dna')
  assert.deepEqual(top.map((e) => e.name), ['Kramer', 'Jerry', 'Newman'], 'descending order')
  assert.deepEqual(top.map((e) => e.score), [999, 100, 50], 'scores parsed as numbers')
  ok('ordering + rank + numeric score parsing')

  // 2. Duplicate name+score both survive (salt keeps them distinct)
  await submitScore('dna', 'Elaine', 77, '2026-01-01T00:00:03.000Z', 'x')
  await submitScore('dna', 'Elaine', 77, '2026-01-01T00:00:04.000Z', 'y')
  const elaines = (await getTop('dna', TOP_N)).filter((e) => e.name === 'Elaine')
  assert.equal(elaines.length, 2, 'two identical entries both stored')
  ok('duplicate entries kept distinct by salt')

  // 3. Trim: flood past MAX_STORED, only the highest survive, getTop caps at TOP_N
  for (let i = 0; i < MAX_STORED + 25; i++) {
    await submitScore('flood', `P${i}`, i, `2026-02-01T00:00:${String(i % 60).padStart(2, '0')}.000Z`, `s${i}`)
  }
  const flood = await getTop('flood', TOP_N)
  assert.equal(flood.length, TOP_N, `getTop returns TOP_N (${TOP_N})`)
  assert.equal(flood[0].score, MAX_STORED + 24, 'highest score is first')
  // The lowest surviving score must be exactly MAX_STORED entries down from the top
  const lowestKept = await getTop('flood', MAX_STORED + 100)
  assert.equal(lowestKept.length, MAX_STORED, `store trimmed to MAX_STORED (${MAX_STORED})`)
  assert.equal(lowestKept[lowestKept.length - 1].score, 25, 'lowest 25 scores were trimmed away')
  ok('trim keeps the highest MAX_STORED, getTop caps at TOP_N')

  // 4. Rank is null when the new score misses the top N
  const low = await submitScore('flood', 'Straggler', 0, '2026-02-02T00:00:00.000Z', 'z')
  assert.equal(low.rank, null, 'a score outside the top N returns rank null')
  ok('rank null when outside the top N')

  // 5. getAllTop groups by game and only lists games with scores
  const all = await getAllTop()
  assert.deepEqual(Object.keys(all).sort(), ['dna', 'flood'], 'all games with scores listed')
  assert.equal(all.dna[0].name, 'Kramer', 'per-game board intact')
  ok('getAllTop groups per game')

  console.log(`\n${passed} checks passed ✅`)
}

run().catch((e) => {
  console.error('\n❌ TEST FAILED:', e.message)
  process.exit(1)
})
