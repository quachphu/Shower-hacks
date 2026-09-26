# Knob & Clog — A Shower Boss Fight

You are naked, unarmed except for soap, and the shower is trying to kill you.

Built for [Showerhacks](https://showerhacks.org) — a 12-hour hackathon where the winner gets to take a shower.

## Phase 1: The Temperature Knob

The knob swings between Antarctica and the surface of the sun. Dodge the bands,
pelt the dial with soap, and every time you hurt it your shower gets an upgrade:

| Tier | |
|---|---|
| 1 | Sad Dorm Shower |
| 2 | Rainfall Head |
| 3 | RGB Gamer Shower |
| 4 | Sauna Mode |
| 5 | $500,000 Billionaire Shower |

## Controls

- **WASD / arrows** — move
- **Mouse** — aim
- **Click / space** — throw soap
- **R** — restart

## Run it

No build step, no dependencies to install — Phaser loads from a CDN.

```bash
python3 -m http.server 8123
```

Then open http://localhost:8123

## Deploy

It's a static site, so anything that serves files works. For GitHub Pages:
push to `main`, then Settings → Pages → Source: `main` / root.

## Tuning

Every balance number lives in [`src/config.js`](src/config.js) — boss health, soap
damage, attack timing, and the tier list. Game logic is in
[`src/scenes/BossScene.js`](src/scenes/BossScene.js).

`window.game` is exposed in the console for live poking during development.

## Not built yet

Phase 2: The Hair Clog™ emerges from the drain.
