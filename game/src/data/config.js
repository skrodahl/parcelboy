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

// §2.12 skeleton: gag tuning is filled in when the gags land (M7/M11); the
// `enabled` flags let any gag be toned down or switched off.
export const CARTOON = {
  enabled: true,
  hitStopMs: 70,
};
