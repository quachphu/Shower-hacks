// All balance numbers live here so they can be tuned without touching game logic.
const CONFIG = {
  width: 960,
  height: 640,

  // Play area the player is confined to (below the boss, inside the stall walls).
  arena: { left: 46, right: 914, top: 232, bottom: 604 },

  player: { speed: 235, radius: 15, maxHealth: 100, invulnMs: 450 },

  soap: { speed: 640, radius: 8, damage: 7, cooldownMs: 210, lifeMs: 1600 },

  boss: { maxHealth: 1000, x: 480, y: 128, radius: 64 },

  attack: {
    intervalMs: 2500,   // gap between attacks
    telegraphMs: 850,   // warning flash before the band turns lethal
    activeMs: 1050,     // how long the band burns/freezes
    damagePerSec: 34,
    bandThickness: 152,
    minIntervalMs: 1500, // attacks speed up as the boss loses health
  },
};

// Each tier unlocks as the Knob loses health. Purely cosmetic — the escalation gag.
const TIERS = [
  {
    name: 'SAD DORM SHOWER',
    sub: 'one sad drip',
    tile: 0x8d8b7f, grout: 0x6f6d63, accent: 0x5f6b52, heads: 1, rgb: false, steam: false,
  },
  {
    name: 'RAINFALL HEAD',
    sub: 'ooh, water pressure',
    tile: 0xdfe9ef, grout: 0xa9bcc7, accent: 0x4da3d8, heads: 1, rgb: false, steam: false,
  },
  {
    name: 'RGB GAMER SHOWER',
    sub: '+12% shampoo DPS',
    tile: 0x1b1f2e, grout: 0x0e1119, accent: 0xff00d4, heads: 3, rgb: true, steam: false,
  },
  {
    name: 'SAUNA MODE',
    sub: 'you are now a soup',
    tile: 0x7a4a2c, grout: 0x59341d, accent: 0xffae5c, heads: 5, rgb: false, steam: true,
  },
  {
    name: '$500,000 BILLIONAIRE SHOWER',
    sub: '14 heads. no regrets.',
    tile: 0x14100c, grout: 0x2b2114, accent: 0xffd76a, heads: 14, rgb: false, steam: true,
  },
];
