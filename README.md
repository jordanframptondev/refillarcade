# 🕹️ RefillArcade

A neon medspa-themed arcade built with React + Vite. Eight mini-games, one
flashy midway — cartoon vials only, no real dosing advice.

## Run it

```bash
npm install
npm run dev   # starts the Vite app (5173) + score API (5174) together
```

Then open http://localhost:5173.

For production: `npm run build && npm start` — the score server also serves the
built app from `dist/` on port 5174.

## The cabinets

| Game | Mechanic | Controls |
| --- | --- | --- |
| 💉 Peptide Panic | Catch good vials, dodge counterfeits & DEA barrels | ← → or drag |
| 🏃 Gains Run | One-button flappy runner down the clinic hallway | Space / tap |
| 📋 Script Sorter | Sort scripts into PEPTIDE / TRT / HRT / REJECT bins | 1-4 or tap |
| 🎯 Perfect Dose | Stop the sweeping needle in the therapeutic window | Space / tap |
| 🔨 Symptom Smack | Whack-a-mole on symptoms, spare the happy patients | Click / tap |
| 🧠 Peptide or Pretend? | Real compound or made-up nonsense quiz | ← → or tap |
| 🃏 Vial Pairs | Memory match with product vials | Click / tap |
| ⚗️ Merge Lab | Merge vials up to the ✨ Golden Formula | Click / tap |

## Notes

- High scores are stored by a tiny Express API (`server/index.js`) as one JSON
  file per game in `server/data/` — no database needed. Crack the top 10 and
  the game asks for your name (20 chars max); every game has a 🏆 HIGH SCORES
  button showing its top 10.
- Sound effects are synthesized with WebAudio (mute toggle top-right).
- Press `ESC` in any game to return to the arcade lobby.

## Structure

```
server/index.js           Express score API + static host for dist/
server/data/              runtime score files, one JSON per game (gitignored)
shared/config.js          constants shared by app + server (name length, top N)
src/
  App.jsx                 lobby, marquee, floating characters, game switch
  components/GameShell.jsx shared HUD, overlays, name entry, leaderboard
  games/meta.js           game metadata (titles, colors, instructions)
  games/index.js          registry wiring metadata to components
  games/*.jsx             one self-contained file per game
  lib/scores.js           score API client
  lib/sounds.js           WebAudio synth sfx
  lib/useGameLoop.js      requestAnimationFrame hook
```
