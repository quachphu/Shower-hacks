# Shower Simulator

A first-person 3D shower sim. You are in a bathroom. The bathroom is not on your side.

Built for [Showerhacks](https://showerhacks.org) — a 12-hour hackathon where the winner gets to take a shower.

## The routine

Wet → Shampoo → Rinse → Condition → Body wash → Rinse → Escape.

In that order. A stage only clears when the one before it has, which is what makes
the same state machine work for both the relaxed single-player sim and the
Speedrun mode it was built to grow into.

## The bit that is actually a game

**Lather is currency.** Squeezing a bottle builds lather; rinsing converts that
lather into cleanliness, one for one. So you cannot cheese it — whatever you put
on has to be washed off, and you cannot lather under running water because the
water takes it straight down the drain. Step out of the stream, squeeze, step back in.

**Comfort is scored over time, not at the end.** Standing in a freezing stream for
four seconds is a permanent dent in your average, even if you fix the knob after.

Score = cleanliness + average comfort − water used − time over par.

## What the bathroom does to you

| Event | What you do about it |
|---|---|
| Someone flushes the toilet | Temperature spikes ~15°. Turn it down, then back. |
| The water turns freezing | Ride it out or chase it with the knob. |
| Pressure drops | Rinsing crawls until it recovers. |
| Shampoo in your eyes | Look up into the stream to rinse them out. |
| You dropped the soap | It is on the floor now. |
| You forgot the towel | It is on the far shelf. You will be dripping when you get it. |

The temperature gauge shows a faint ghost tick at whatever you dialled in whenever
an event has dragged the real temperature away from it.

## Controls

- **WASD / arrows** — move
- **Mouse** — look
- **Scroll** (or hold LMB and drag) — turn the knob you are looking at
- **E** — pick up / put down
- **Hold LMB / space** — squeeze the bottle, scrub with the soap
- **Look up** in the stream — rinse your eyes
- **R** — restart · **Esc** — release the mouse

## Run it

No build step and no `npm install` — three.js loads from a CDN as an ES module.

```bash
python3 -m http.server 8123
```

Then open http://localhost:8123

## Deploy

Static files, so anything that serves them works. For GitHub Pages: push to `main`,
then Settings → Pages → Source: `main` / root.

## Layout

```
src/config.js          every balance number, in one place
src/game/state.js      the run as plain data
src/game/sim.js        one pure tick(state, dt, ctx) — no three.js, no DOM
src/game/stages.js     the routine, in order
src/game/events.js     the bathroom's repertoire
src/world/bathroom.js  geometry and procedural tile textures
src/world/water.js     stream and steam particles
src/core/player.js     pointer-lock first-person controller
src/ui/hud.js          DOM overlay
```

`src/game/` never imports three.js or touches the DOM. The 3D world tells the
simulation three booleans per frame — `underStream`, `faceUp`, `applying` — and
nothing else crosses that line. That is deliberate: it is what lets Speedrun mode
run and verify the same simulation over the network.

`window.game` is exposed for live poking in the console.

## Not built yet

**Competitive Shower Speedrun** — same room, same route, racing other people.
Supabase Realtime for live rival progress, Postgres for the leaderboard.
The stage splits the sim already records (`state.splits`) are the race data.

The original 2D Phaser prototype — a temperature-knob boss fight — is archived in
[`legacy/`](legacy/).
