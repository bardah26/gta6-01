# gta6-01

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/bardah26/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/bardah26/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Neon Streets of Solara Bay** — a 2D top-down open-world crime game in the spirit of GTA 6, built from scratch in vanilla JavaScript on HTML5 Canvas. No libraries, no network, no assets from any commercial game: every street, name, character and sound is original.

You are **Dante Reyes**, a former getaway driver back in the neon coastal city of **Solara Bay**. Your brother Leo was framed for a dock heist by kingpin **Silas Kane**. Fixer **Marisol Vega ("La Jefa")** has six jobs for you — steal cars, collect debts, lose the cops, hit the docks, and finally wreck Kane's armored Rhino — to clear Leo's name.

The city has four districts (Barrio del Sol, Neon Row, Portside, Palmera Beach), traffic and pedestrians with simple AI, cars to steal and drive, a 0–5 star wanted level with SBPD patrol cars that chase, ram and shoot, six story missions, combat, a HUD with health, cash, wanted stars and a live minimap, a start screen, save/load via localStorage, synthesized WebAudio sound and music, and a full day/night cycle with neon glow and headlights.

## Run it

```sh
node serve.ts
# then open http://localhost:8080
```

Or open `game/index.html` directly in a desktop browser — the game is plain static files with no build step.

## Controls

- **WASD / Arrows** — move on foot, drive in a car
- **Mouse** — aim, **Left Click** shoots
- **E** — enter / exit / steal a car
- **Shift** — sprint, **Space** — handbrake
- **P** — save game, **M** — mute, **Esc** — pause

## Files

- `main.ts` — entrypoint: copies `game/` and `screenshots/` to the output directory and writes `dossier.json`
- `game/` — the game (`index.html` + `src/*.js`, vanilla JS, no dependencies)
- `screenshots/` — real gameplay screenshots taken in headless Chrome
- `serve.ts` — tiny static server for local play
- `vendor/makefun-game.ts` — the kit's dossier builder (unchanged)

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
