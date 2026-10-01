// §11.7: brand + tuning constants. Any number that appears in §2 lives here,
// not scattered through code. Later milestones extend it (CARTOON, scoring,
// hazard tuning).
export const BRAND = { company: 'Quickbox', game: 'Parcelboy' };

export const PLAYER = {
  radius: 0.5,          // §2.3: the player is a circle of radius 0.5
  jumpHeight: 1.2,      // §2.2: jump 1.2 units high
  jumpTime: 0.5,        // §2.2: … 0.5 s
  bonkSpeedFrac: 0.6,   // §2.3: wall hit above 60% of max speed = bonk
  bonkShake: 0.15,      // §2.3: camera shake 0.15
};

// §2.4 + §2.5: scoring numbers. Every value from the Delivering table lives
// here so tuning never means hunting through code.
export const SCORING = {
  perfect: 200,      // target porch, within perfectRadius of the doormat
  nice: 150,         // target porch, elsewhere
  sloppy: 60,        // target's lot, not the porch (still delivered)
  wrong: -25,        // a non-target / already-delivered house
  wrongAddress: -25, // §2.16: landed on another target's house (the parcel is lost)
  road: 0, splash: 0, roof: 0, missed: 0,
  doorstep: 120,     // hold F on the target porch (safe, keeps streak)
  perfectRadius: 1.0,
  airMail: 50,       // thrown while airborne
  longShot: 50,      // throw distance > longShotDist
  longShotDist: 11,
  express: 100,      // express package delivered in the first half of the shift
  // multiplier = min(multMax, 1 + multPer * floor(streak / multStep))
  multStep: 3, multPer: 0.5, multMax: 3,
};

// §2.12: gag tuning. Each gag has an `enabled` flag so it can be toned down or
// switched off without touching the code that plays it.
export const CARTOON = {
  enabled: true,
  hitStopMs: 70,
  // M5 parcel-side gags.
  jelly: { enabled: true, squash: 0.3, wobbleTime: 0.4 }, // squash 30%, wobble 0.4 s
  roofLuck: { enabled: true, slideDelay: 0.5, luckyChance: 0.35 }, // slide off the eave 35%
  mailbox: { enabled: true }, // a parcel hitting a mailbox pops the flag + bounces off
  confettiCount: 12,          // delivery confetti burst
  onomatopoeia: true,         // comic burst popups (THWUMP!, SPLOOSH!, …)
};

// §2.4 flight + §2.6 doorstep tuning.
// (gravity / maxTime raised from the §2.4 numbers so a far throw lobs high
//  enough to clear a roof and land "On the roof!"; see PROGRESS M5.)
export const PARCEL = {
  pool: 16,          // max parcels in flight
  gravity: 18,      // units/s^2, Y only
  minTime: 0.35,    // s, clamped flight time
  maxTime: 1.1,     // s
  timeDivisor: 14,  // t = clamp(dist / timeDivisor, minTime, maxTime)
  // §2.4 says the first bounce keeps 35% vert / 50% horiz; that carries the
  // parcel ~1.1u past a snapped doormat aim, just outside the 1.0 PERFECT
  // radius, so an assisted throw always read "Nice". Tuned down so an
  // assisted throw rests inside the PERFECT circle (see PROGRESS M5).
  bounceVert: 0.28,
  bounceHoriz: 0.38,
  slideTime: 0.2,   // s of slide after the second contact
  cooldown: 0.3,    // s between throws
  doorwayTime: 0.8, // s to hold F for a doorstep delivery
  doorwayCancel: 0.3, // moving more than this (units) cancels the doorstep hold
  throwHeight: 1.8, // y the parcel leaves the hand at (a lobbied cartoon throw)
};

// §2.13: free roam is the hub state (no timer/score). Hazard counts run at
// these levels; missions override per-shift (§2.6). Day cycle + golden parcels
// land in M10/M8; this block seeds the free-roam hazard manager (M7).
export const FREE_ROAM = {
  hazards: { car: 5, dog: 3, sprinkler: 3, skater: 2, bees: 2, bin: 8, cone: 0 },
  grumps: 4,
  goldenParcels: 12,
  minutesPerPhase: 2, // M10 day cycle: each ToD preset held this long (blend 30 s)
};

// §2.6 / §2.7 / §2.12: knockdown + hazard-flow tuning shared by every hazard.
// Per-hazard numbers (wake/chase radii, etc.) live in data/hazards.js params.
export const HAZARD = {
  knockdownTime: 1.2,   // §2.6: the courier falls 1.2 s
  invulnTime: 1.5,      // §2.6: … then 1.5 s of blinking invulnerability
  knockdownShake: 0.3,  // §2.6: camera shake 0.3
  puffyTime: 5,         // §2.7: the bee-stung puffy face lasts 5 s
  maxActiveSwarms: 2,   // §2.7: up to 2 bee swarms at once
};

// §2.15: GTA-lite mischief tuning. Levels, decay, Watch-unit + BUSTED numbers,
// bowling speed thresholds and Grump chase. All values from §2.15 live here.
export const MISCHIEF = {
  // 0–3 whistle icons; level = number of thresholds (3 / 6 / 10) heat has passed.
  heatThresholds: [3, 6, 10],
  heatDecayPerSec: 0.05,   // ~0.5 heat per 10 s
  charmDrops: 1,           // Marlo's Charm: drop one level instantly
  // Neighborhood Watch. Level 2 → Deputy Doug on a Segway (8.5); level 3 →
  // golf cart (11). A unit despawns when you stay clear for `loseAfterSec`.
  watch: {
    segway: { speed: 8.5, minLevel: 1, radius: 1.0 },
    cart: { speed: 11, minLevel: 2, radius: 1.0 },
    loseAfterSec: 8,
    loseRadius: 25,
    bustedFreezeSec: 2,
  },
  bustedPenalty: { freeRoamCoinPct: 0.10, freeRoamMin: 10, freeRoamMax: 100, missionPoints: -300 },
  // Bowling: a walker is launched when hit above these player speeds.
  bowlVehicleSpeed: 0.4,
  bowlFootSpeed: 0.75,
  strikeWindowSec: 1,     // 2+ bowls within 1 s = "STRIKE!"
  // Grump chase + shove; subscriber "Oops!".
  grumpChaseSpeed: 5,
  grumpChaseSec: 4,
  grumpShoveHeat: 3,
  grumpShoveCdSec: 2,
  subscriberOops: { points: -50, heat: 2 },
};

// §11.6 + §2.8: ability cooldowns (seconds). The ability *definitions*
// (name/description/duration + how they touch the modifier stack) live in
// gameplay/abilities.js and read these cooldowns.
export const ABILITY = {
  sprint: 12,        // §2.8: Pip — max speed ×1.5 for 2.5 s, cooldown 12 s
  unstoppable: 20,   // §2.8: Bea — knockdown-immune 5 s, cooldown 20 s
  trickshot: 25,     // §2.8: Juno — next 3 throws PERFECT, cooldown 25 s
  charm: 22,         // §2.8: Marlo — 6 s charm, cooldown 22 s
  turbo: 15,         // §2.8: Ollie — vehicle ×1.6 for 3 s + 1 s wobble, cooldown 15 s
};
