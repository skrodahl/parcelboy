// §2.15: what you can break, what a Grump house wears, and the Grump's
// reaction. Numeric tuning (speeds, heat, decay, chase) lives in config.js
// → MISCHIEF; this table is the "what" (points / heat / comic label / kind).
//
// `kind` drives the visual: 'shard' (window → glass particles + a cracked
// overlay that persists until the mission ends), 'fall' (gnome/flamingo tips
// over), 'alarm' (car: the horn blares + lights flash), 'flip' (bin tumbles).
export const BREAKABLES = {
  window:   { points: 40, heat: 2, label: 'CRASH!',  kind: 'shard' },
  gnome:    { points: 30, heat: 1, label: 'SPLAT!',  kind: 'fall' },
  flamingo: { points: 30, heat: 1, label: 'SPLAT!',  kind: 'fall' },
  mailbox:  { points: 25, heat: 1, label: 'CLANG!',  kind: 'flip' },
  carAlarm: { points: 40, heat: 2, label: 'BEEP!',   kind: 'alarm' },
  bin:      { points: 15, heat: 1, label: 'CLONK!',  kind: 'flip' },
};

// A Grump house (a non-subscriber, §2.15) wears these so it reads at a glance.
// The sign + gnome + flamingos are placed per-house by the mischief module
// (on the lawn, seeded); drawn curtains + dark mailbox + a car in the
// driveway are switched on for the Grump's own house.
export const GRUMP = {
  signText: 'NO QUICKBOX!',
  props: ['gnome', 'flamingo'],   // one of each on the lawn, seeded side
};

// Which props can be broken (keyed to BREAKABLES ids) — the Grump's lawn.
export const GRUMP_BREAKABLE = ['window', 'gnome', 'flamingo', 'mailbox', 'carAlarm', 'bin'];
