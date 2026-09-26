// Every balance number lives here so the game can be tuned without touching logic.
// Distances are metres, times are seconds, temperatures are degrees Celsius.

export const CONFIG = {
  room:   { minX: -2.0, maxX: 2.0, minZ: -1.6, maxZ: 1.6, height: 2.6 },
  // The tiled wet area. Escaping means leaving it with the water off and a towel.
  shower: { minX: -2.0, maxX: -0.2, minZ: -1.6, maxZ: 1.6 },

  player: { eyeHeight: 1.62, speed: 1.9, radius: 0.24, lookSens: 0.0021, reach: 1.7 },

  water: {
    head:         [-1.72, 2.26, 0],  // where the shower head hangs
    streamCentre: [-1.44, 0],        // xz the water actually lands on
    streamRadius: 0.42,
    tempMin: 8, tempMax: 55,
    comfortBand: [37, 42],
    knobStep: 1.8,                   // degrees / pressure-percent per wheel notch
  },

  rates: {
    wet: 0.62, dry: 0.055,
    apply: 0.55,            // lather built per second while squeezing a bottle
    rinse: 0.62,            // lather stripped per second under full pressure
    cleanPerLather: 1.30,   // cleanliness earned per unit of lather rinsed away
    tankDrain: 1.35,        // % of the hot tank per second at full heat + pressure
    stingGrow: 0.5,
    stingRinse: 0.55,       // sting washed out per second with your face up
    stingDecay: 0.04,       // it fades on its own, but barely
  },

  comfort: {
    max: 100,
    coldPerDeg: 0.55,       // drain per second per degree below the comfort band
    hotPerDeg: 0.80,        // scalding hurts more than shivering
    sting: 11,
    exposed: 3.2,           // wet, and standing outside the stream
    recover: 4.0,           // regained per second inside a perfect stream
  },

  events: { firstDelay: 13, minGap: 12, maxGap: 21 },

  // Baba Yaga mode. She wakes partway through and closes in whenever you are
  // not looking at her, which is most of the time, because showering needs eyes.
  baba: {
    limit: 105,        // seconds on the clock
    wakesAt: 0.62,     // fraction of the limit remaining when she appears
    speed: 0.26,       // m/s unobserved, at the moment she wakes
    speedMax: 1.15,    // m/s as the clock runs out
    reach: 0.85,       // how close before she takes you
    seenDot: 0.55,     // how centred in view she must be to count as watched
  },

  score: { cleanWeight: 340, comfortWeight: 2.4, waterPenalty: 1.5, parTime: 100, latePenalty: 2.5 },
};

// The canonical shower. Also, exactly the Speedrun route.
export const STAGE_ORDER = ['wet', 'shampoo', 'rinse1', 'condition', 'bodywash', 'rinse2', 'escape'];
