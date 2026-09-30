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
