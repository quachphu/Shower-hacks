// Synthesised with WebAudio so the game stays asset-free and still deploys as
// static files. Nothing here loads; it is all oscillators and shaped noise.

let ctx = null;
let master = null;
let drone = null;

export function initAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

const now = () => ctx.currentTime;

function noiseBuffer(seconds) {
  const n = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function env(node, peak, attack, decay) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, now());
  g.gain.exponentialRampToValueAtTime(peak, now() + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, now() + attack + decay);
  node.connect(g);
  g.connect(master);
  return g;
}

/** Two low thumps. `urgency` 0..1 raises pitch and volume. */
export function heartbeat(urgency = 0) {
  if (!ctx) return;
  for (const [delay, level] of [[0, 1], [0.21, 0.72]]) {
    const o = ctx.createOscillator();
    o.type = 'sine';
    const f = 46 + urgency * 22;
    o.frequency.setValueAtTime(f, now() + delay);
    o.frequency.exponentialRampToValueAtTime(f * 0.55, now() + delay + 0.17);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now() + delay);
    g.gain.exponentialRampToValueAtTime((0.16 + urgency * 0.3) * level, now() + delay + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, now() + delay + 0.2);
    o.connect(g); g.connect(master);
    o.start(now() + delay); o.stop(now() + delay + 0.24);
  }
}

/** Knuckles on a door, somewhere else in the flat. */
export function knock(times = 3) {
  if (!ctx) return;
  for (let i = 0; i < times; i++) {
    const t = now() + i * 0.34;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(0.12);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 320;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
    src.connect(lp); lp.connect(g); g.connect(master);
    src.start(t); src.stop(t + 0.14);
  }
}

/** A hinge that has not been oiled this century. */
export function creak() {
  if (!ctx) return;
  const o = ctx.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(128, now());
  o.frequency.linearRampToValueAtTime(58, now() + 1.1);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 7;
  o.connect(bp);
  env(bp, 0.1, 0.25, 0.9);
  o.start(); o.stop(now() + 1.3);
}

/** One wet footstep on tile. */
export function step() {
  if (!ctx) return;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(0.09);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 900;
  src.connect(lp);
  env(lp, 0.22, 0.004, 0.1);
  src.start(); src.stop(now() + 0.12);
}

/** She has you. */
export function shriek() {
  if (!ctx) return;
  const o = ctx.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(1500, now());
  o.frequency.exponentialRampToValueAtTime(180, now() + 1.25);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.35, now());
  g.gain.exponentialRampToValueAtTime(0.0001, now() + 1.3);
  o.connect(g); g.connect(master);
  o.start(); o.stop(now() + 1.35);

  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(1.1);
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass'; hp.frequency.value = 1100;
  src.connect(hp);
  env(hp, 0.3, 0.02, 1.0);
  src.start(); src.stop(now() + 1.2);
}

/** A low bed that rises with dread. Call with 0 to fade it out. */
export function setDrone(level) {
  if (!ctx) return;
  if (!drone) {
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = 38;
    const o2 = ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = 57.3;          // a deliberately sour interval
    const g = ctx.createGain();
    g.gain.value = 0;
    o.connect(g); o2.connect(g); g.connect(master);
    o.start(); o2.start();
    drone = g;
  }
  drone.gain.setTargetAtTime(level * 0.1, now(), 0.7);
}

/** Running water, as filtered noise. `flow` 0..1. */
export function setWater(flow) {
  if (!ctx) return;
  if (!setWater._g) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(2.4);
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 0.55;
    const g = ctx.createGain();
    g.gain.value = 0;
    src.connect(bp); bp.connect(g); g.connect(master);
    src.start();
    setWater._g = g; setWater._bp = bp;
  }
  setWater._g.gain.setTargetAtTime(flow * 0.13, now(), 0.15);
  setWater._bp.frequency.setTargetAtTime(900 + flow * 1500, now(), 0.2);
}

/** The duck. Obviously. */
export function squeak() {
  if (!ctx) return;
  const o = ctx.createOscillator();
  o.type = 'square';
  o.frequency.setValueAtTime(680, now());
  o.frequency.exponentialRampToValueAtTime(1180, now() + 0.09);
  o.frequency.exponentialRampToValueAtTime(520, now() + 0.2);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, now());
  g.gain.exponentialRampToValueAtTime(0.11, now() + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, now() + 0.22);
  o.connect(g); g.connect(master);
  o.start(); o.stop(now() + 0.24);
}
