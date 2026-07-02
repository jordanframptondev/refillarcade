# 🕹️ RefillArcade

A neon medspa-themed arcade built with React + Vite. Eight mini-games, one
flashy midway — cartoon vials only, no real dosing advice.

## Run it

```bash
npm install
npm run dev   # starts the Vite app (5173) + score API (5174) together
```

Then open http://localhost:5173.

Locally the leaderboard is served by the file-based Express server in
`server/index.js` (scores land in `server/data/`). In production on Vercel the
same API is served by serverless functions backed by Redis — see below.

## Deploy to Vercel

The game is a static Vite bundle; the leaderboard needs a backend, so scores
live in serverless functions under `api/` backed by **Upstash Redis** (a sorted
set per game — atomic and safe under concurrent submissions). The browser calls
the same relative `/api/scores` URLs in every environment, so no client code
changes between local and prod.

1. Import the repo into Vercel (it auto-detects Vite → build `vite build`,
   output `dist`, and turns `api/` into functions — no `vercel.json` needed).
2. In the project's **Storage** tab, add **Upstash Redis** from the Marketplace
   and connect it to the project. This injects `KV_REST_API_URL` and
   `KV_REST_API_TOKEN` automatically — don't set them by hand.
3. Redeploy so the functions pick up the env vars. Done — scores persist.

> A static-only deploy (no functions, or Redis not connected) is exactly what
> makes the app report "score server offline": there's no backend answering
> `/api`. The client now retries every 5s, so once Redis is connected and you
> redeploy, open boards recover on their own.

`npm test` runs the leaderboard store's logic against an in-memory Redis fake.

## The cabinets

| Game | Mechanic | Controls |
| --- | --- | --- |
| 👾 Age Invaders | Space Invaders vs the signs of aging, with peptide power-ups | ← → + Space / drag + tap |
| 🧱 Peptide Breakout | Breakout vs the plaque wall — HRT/GLOW/GLP-1/TRT/NAD+ drops | Drag or ← → |
| 🏗️ Vial Stacker | One-button tower stacker — overhang gets sliced | Space / tap |
| 🚶 Clinic Crossing | Frogger across UV, sugar, and paperwork lanes | Arrows / D-pad |
| 🧬 Clean DNA | Snake — grow the strand on pills and syringes | Arrows / D-pad |
| ✨ Glow Up | Doodle-jump up pill platforms with spa springs | ← → or drag |
| 😮 Peptide Panic | Catch good vials, dodge counterfeits & DEA barrels | ← → or drag |
| 🏃 Gains Run | One-button flappy runner down the clinic hallway | Space / tap |
| 📋 Script Sorter | Sort scripts into PEPTIDE / TRT / HRT / REJECT bins | 1-4 or tap |
| 🎯 Perfect Dose | Stop the sweeping needle in the therapeutic window | Space / tap |
| 🖐️ Symptom Smack | Whack-a-mole on symptoms, spare the happy patients | Click / tap |
| 🧠 Peptide or Pretend? | Real compound or made-up nonsense quiz | ← → or tap |
| 🃏 Vial Pairs | Memory match with product vials | Click / tap |
| ⚗️ Merge Lab | Merge vials up to the ✨ Golden Formula | Click / tap |

## Notes

- Crack the top 10 and the game asks for your name (20 chars max); every game
  has a 🏆 HIGH SCORES button showing its top 10. Locally these persist to JSON
  files in `server/data/`; in production to Upstash Redis. Name/score
  validation is shared between both backends (`shared/leaderboard.js`), so the
  rules are identical either way.
- Sound effects are synthesized with WebAudio (mute toggle top-right).
- Press `ESC` in any game to return to the arcade lobby.

## Structure

```
api/scores/index.js       Vercel function: GET all games' top-10 (Redis)
api/scores/[gameId].js    Vercel function: GET one board / POST a score (Redis)
server/index.js           local Express API + static host for dist/ (file store)
server/redisStore.js      Redis-backed leaderboard used by the Vercel functions
server/redisStore.test.js in-memory test for the store logic (npm test)
server/data/              local score files, one JSON per game (gitignored)
shared/config.js          constants shared by app + server (name length, top N)
shared/leaderboard.js     shared validation + limits (both backends use these)
src/
  App.jsx                 lobby, marquee, floating characters, game switch
  components/GameShell.jsx shared HUD, overlays, name entry, leaderboard
  games/meta.js           game metadata (titles, colors, instructions)
  games/index.js          registry wiring metadata to components
  games/*.jsx             one self-contained file per game
  lib/scores.js           score API client (relative /api URLs)
  lib/sounds.js           WebAudio synth sfx
  lib/useGameLoop.js      requestAnimationFrame hook
```
