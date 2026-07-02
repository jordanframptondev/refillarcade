# 🕹️ RefillArcade

A neon medspa-themed arcade built with React + Vite. Eight mini-games, one
flashy midway — cartoon vials only, no real dosing advice.

## Run it

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

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

- High scores persist per game in `localStorage` — no accounts, no backend.
- Sound effects are synthesized with WebAudio (mute toggle top-right).
- Press `ESC` in any game to return to the arcade lobby.

## Structure

```
src/
  App.jsx                 lobby, marquee, floating characters, game switch
  components/GameShell.jsx shared HUD + start/game-over overlays
  games/meta.js           game metadata (titles, colors, instructions)
  games/index.js          registry wiring metadata to components
  games/*.jsx             one self-contained file per game
  lib/scores.js           localStorage high scores
  lib/sounds.js           WebAudio synth sfx
  lib/useGameLoop.js      requestAnimationFrame hook
```
