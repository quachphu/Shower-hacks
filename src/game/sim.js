import { CONFIG } from '../config.js';
import { waterTemp, waterPressure, flow } from './state.js';
import { checkStages, STAGES } from './stages.js';
import { maybeFireEvent } from './events.js';

const clamp01 = v => Math.max(0, Math.min(1, v));

// Which lather/cleanliness pair a held item feeds.
const PRODUCTS = {
  shampoo:     { lather: 'hairLather', clean: 'hairClean' },
  conditioner: { lather: 'condLather', clean: 'conditioned' },
  soap:        { lather: 'bodyLather', clean: 'bodyClean' },
};

// You cannot lather under running water — it washes straight off the moment it
// lands. Stating it as a rule is clearer than letting the rates fight it out.
export function canApply(s, underStream) {
  if (!PRODUCTS[s.holding]) return { ok: false, why: null };
  if (underStream)          return { ok: false, why: 'The water rinses it straight off — step out of the stream' };
  if (s.body.wet < 0.35)    return { ok: false, why: 'You need to be wet first' };
  return { ok: true, why: null };
}

/**
 * One simulation step.
 * ctx: { underStream, faceUp, applying } — everything the 3D world has to tell
 * the simulation. Nothing else crosses the boundary.
 */
export function tick(s, dt, ctx) {
  if (s.finished) return { cleared: null, event: null };
  s.t += dt;

  decayActiveEvents(s, dt);

  const temp = waterTemp(s);
  const f = flow(s);
  const wet = s.body.wet;

  // --- water supply ------------------------------------------------------
  if (f > 0) {
    s.waterUsed += f * (9 / 60) * dt;                // ~9 L/min at full bore
    const heatDemand = Math.max(0, temp - 18) / 30;
    s.hotTank = Math.max(0, s.hotTank - CONFIG.rates.tankDrain * f * heatDemand * dt);
  }
  // An empty tank drags the real temperature down no matter what the knob says.
  if (s.hotTank <= 0) s.knob.temp = Math.max(CONFIG.water.tempMin, s.knob.temp - 9 * dt);

  // --- getting wet / drying off -----------------------------------------
  s.body.wet = ctx.underStream && f > 0
    ? clamp01(wet + CONFIG.rates.wet * f * dt)
    : clamp01(wet - CONFIG.rates.dry * dt);

  // --- applying product --------------------------------------------------
  const apply = canApply(s, ctx.underStream);
  if (ctx.applying && apply.ok) {
    const p = PRODUCTS[s.holding];
    s.body[p.lather] = clamp01(s.body[p.lather] + CONFIG.rates.apply * dt);
  }

  // --- rinsing: lather removed is exactly what becomes clean -------------
  if (ctx.underStream && f > 0) {
    for (const p of Object.values(PRODUCTS)) {
      const removed = Math.min(s.body[p.lather], CONFIG.rates.rinse * f * dt);
      if (removed <= 0) continue;
      s.body[p.lather] -= removed;
      s.body[p.clean] = clamp01(s.body[p.clean] + removed * CONFIG.rates.cleanPerLather);
    }
  }

  // --- eyes ---------------------------------------------------------------
  if (s.sting > 0) {
    const rinsing = ctx.underStream && ctx.faceUp && f > 0.15;
    const rate = rinsing ? CONFIG.rates.stingRinse * f : CONFIG.rates.stingDecay;
    s.sting = clamp01(s.sting - rate * dt);
  }

  // --- comfort ------------------------------------------------------------
  s.comfort = updateComfort(s, dt, ctx, temp, f);
  s.comfortIntegral += s.comfort * dt;

  const event = maybeFireEvent(s);
  const cleared = checkStages(s);
  return { cleared, event };
}

function updateComfort(s, dt, ctx, temp, f) {
  const [lo, hi] = CONFIG.water.comfortBand;
  const C = CONFIG.comfort;
  let c = s.comfort;

  if (ctx.underStream && f > 0.05) {
    if (temp < lo)      c -= (lo - temp) * C.coldPerDeg * dt;
    else if (temp > hi) c -= (temp - hi) * C.hotPerDeg * dt;
    else                c += C.recover * dt;
  } else if (s.body.wet > 0.3) {
    c -= C.exposed * s.body.wet * dt;   // wet and in the open air is miserable
  }

  c -= s.sting * C.sting * dt;
  return Math.max(0, Math.min(C.max, c));
}

function decayActiveEvents(s, dt) {
  s.offset.temp = 0;
  s.offset.pressure = 0;
  s.active = s.active.filter(a => (a.ttl -= dt) > 0);
  for (const a of s.active) {
    // Hit hard immediately, then ease back out over the event's lifetime.
    s.offset[a.field] += a.amount * Math.min(1, (a.ttl / a.life) * 1.6);
  }
}

// Called when the player steps out of the shower footprint.
export function tryEscape(s) {
  if (STAGES[s.stage]?.id !== 'escape') return 'Finish the shower first';
  if (waterPressure(s) > 1) return 'Turn the water off before you go';
  if (!s.hasTowel) return s.towelMissing ? 'The towel is on the far shelf' : 'Take the towel';
  s.escaped = true;
  checkStages(s);
  return null;
}

/** Seconds left in Baba Yaga mode, and the same as a 0..1 fraction. */
export function timeLeft(s) {
  const secs = Math.max(0, CONFIG.baba.limit - s.t);
  return { secs, frac: secs / CONFIG.baba.limit };
}

/** She got you, or the clock did. Ends the run without a score. */
export function die(s, cause) {
  if (s.finished) return;
  s.dead = true;
  s.deathCause = cause;
  s.finished = true;
}

export function scoreRun(s) {
  const b = s.body;
  const clean = (b.hairClean + b.conditioned + b.bodyClean) / 3;
  // Averaged over the whole run: recovering late does not erase being scalded early.
  const avgComfort = s.t > 0 ? s.comfortIntegral / s.t : CONFIG.comfort.max;
  const S = CONFIG.score;
  const late = Math.max(0, s.t - S.parTime);
  const points = Math.round(
    clean * S.cleanWeight + avgComfort * S.comfortWeight
    - s.waterUsed * S.waterPenalty - late * S.latePenalty
  );
  return { clean, avgComfort, points: Math.max(0, points), late, grade: grade(points) };
}

function grade(p) {
  if (p >= 520) return 'S — spa day';
  if (p >= 440) return 'A — genuinely refreshed';
  if (p >= 350) return 'B — clean enough';
  if (p >= 250) return 'C — technically a shower';
  if (p >= 150) return 'D — you are damp';
  return 'F — worse than before';
}
