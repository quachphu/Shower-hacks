import { CONFIG } from '../config.js';

// The entire simulation is this plain object. Nothing in here knows about
// three.js or the DOM, which is what lets Speedrun mode replay and verify runs.
export function createState(mode = 'relaxed') {
  return {
    mode,                              // 'relaxed' | 'baba'
    t: 0,
    finished: false,
    escaped: false,
    dead: false,

    knob: { temp: 21, pressure: 0 },   // what the player dialled in
    offset: { temp: 0, pressure: 0 },  // what events are doing to it right now
    hotTank: 100,
    waterUsed: 0,                      // litres, roughly

    body: {
      wet: 0,
      hairLather: 0, condLather: 0, bodyLather: 0,
      hairClean: 0, conditioned: 0, bodyClean: 0,
    },

    sting: 0,
    comfort: CONFIG.comfort.max,
    comfortIntegral: 0,   // comfort summed over time, so a bad moment stays on your record
    holding: null,                     // 'shampoo' | 'conditioner' | 'soap' | 'towel'
    hasTowel: false,
    towelMissing: false,
    soapDropped: false,

    stage: 0,
    splits: [],                        // seconds at which each stage was cleared
    active: [],                        // events currently modifying the world
    nextEventAt: CONFIG.events.firstDelay,
    log: [],                           // the run's story, for the results screen
  };
}

// Actual water temperature = what you dialled, plus whatever the bathroom is doing to you.
export function waterTemp(s) {
  const t = s.knob.temp + s.offset.temp;
  return Math.max(CONFIG.water.tempMin - 6, Math.min(CONFIG.water.tempMax + 12, t));
}

export function waterPressure(s) {
  return Math.max(0, Math.min(100, s.knob.pressure + s.offset.pressure));
}

// 0..1 — everything that scales with how hard the water is coming out.
export function flow(s) {
  return waterPressure(s) / 100;
}
