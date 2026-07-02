// Validation + shaping shared by the local Express server (file storage) and
// the Vercel serverless functions (Redis storage), so the security-critical
// rules stay identical no matter which backend is running.
import { MAX_NAME_LEN } from './config.js'

export const MAX_STORED = 100 // keep more than we show so ranks stay stable

// Game ids are simple slugs; rejecting anything else also blocks path traversal
// in the file backend and keeps Redis keys tidy.
export const isValidGameId = (id) => typeof id === 'string' && /^[a-z0-9-]{1,32}$/.test(id)

// Printable ASCII only, collapsed whitespace, clamped to the name limit.
// The trailing trim matters: clamping can leave a dangling space.
export function sanitizeName(raw) {
  return String(raw ?? '')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NAME_LEN)
    .trim()
}

// Returns a clean integer score, or null if it's out of range / not a number.
export function parseScore(raw) {
  const n = Math.floor(Number(raw))
  return Number.isFinite(n) && n >= 0 && n <= 1_000_000 ? n : null
}
