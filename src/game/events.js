import { CONFIG } from '../config.js';

// Each event is a one-shot insult. `apply` mutates the state; `ttl` events keep
// an entry in state.active so sim.js can decay their offsets over time.
export const EVENTS = [
  {
    id: 'flush', title: 'SOMEONE FLUSHED THE TOILET', sub: 'cold line robbed — brace for scalding',
    when: s => s.knob.pressure > 15,
    apply: s => { s.active.push({ id: 'flush', field: 'temp', amount: 15, ttl: 4.5, life: 4.5 }); },
  },
  {
    id: 'freeze', title: 'THE WATER TURNS FREEZING', sub: 'the hot tank hiccups',
    when: s => s.knob.pressure > 15,
    apply: s => { s.active.push({ id: 'freeze', field: 'temp', amount: -24, ttl: 5.5, life: 5.5 }); },
  },
  {
    id: 'pressure', title: 'PRESSURE DROPS', sub: 'someone started the dishwasher',
    when: s => s.knob.pressure > 30,
    apply: s => { s.active.push({ id: 'pressure', field: 'pressure', amount: -45, ttl: 6, life: 6 }); },
  },
  {
    id: 'eyes', title: 'SHAMPOO IN YOUR EYES', sub: 'look up into the water to rinse them',
    when: s => s.body.hairLather > 0.25 || s.body.condLather > 0.25,
    apply: s => { s.sting = 1; },
  },
  {
    id: 'soap', title: 'YOU DROPPED THE SOAP', sub: 'it is on the floor. deal with it.',
    when: s => s.holding === 'soap',
    apply: s => { s.holding = null; s.soapDropped = true; },
  },
  {
    id: 'towel', title: 'YOU FORGOT THE TOWEL', sub: 'it is on the far shelf. you will be dripping.',
    when: s => !s.towelMissing && !s.hasTowel,
    apply: s => { s.towelMissing = true; },
  },
];

// Picks a random event whose precondition holds, so the game never fires a
// "you dropped the soap" at someone holding nothing.
export function maybeFireEvent(s, rng = Math.random) {
  if (s.t < s.nextEventAt || s.finished) return null;
  const pool = EVENTS.filter(e => e.when(s));
  s.nextEventAt = s.t + CONFIG.events.minGap + rng() * (CONFIG.events.maxGap - CONFIG.events.minGap);
  if (!pool.length) return null;
  const ev = pool[Math.floor(rng() * pool.length)];
  ev.apply(s);
  s.log.push({ t: s.t, title: ev.title });
  return ev;
}
