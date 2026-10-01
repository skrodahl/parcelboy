// §11.6: abilities act ONLY through a modifier stack on the player
// (speedMul, turnWobble, knockdownImmune, perfectThrows, charmActive). Movement,
// hazards and targeting read the stack; there are no ability special cases
// anywhere else. The stack is a plain object (no per-frame allocation); the
// ability system is a small closure that starts the courier's ability on demand,
// counts its duration, and then holds its cooldown.
import { ABILITY } from '../data/config.js';

// One shared shape so callers can read a live field (a 0 means "off").
export function createModifierStack() {
  return { speedMul: 1, turnWobble: 0, knockdownImmune: 0, perfectThrows: 0, charmActive: 0 };
}

// §2.8: the five courier abilities. `duration` in s (0 = "until" the predicate
// holds); `cooldown` in s. They only write to the stack.
const DEFS = [
  {
    id: 'sprint', name: 'Sprint', description: 'Dash at top speed.', cooldown: ABILITY.sprint, duration: 2.5,
    start: (c) => { c.stack.speedMul = 1.5; }, end: (c) => { c.stack.speedMul = 1; },
  },
  {
    id: 'unstoppable', name: 'Unstoppable', description: 'Immune to knockdown for 5 s.', cooldown: ABILITY.unstoppable, duration: 5,
    start: (c) => { c.stack.knockdownImmune = 1; }, end: (c) => { c.stack.knockdownImmune = 0; },
  },
  {
    id: 'trickshot', name: 'Trick Shot', description: 'Your next 3 throws home in and are guaranteed PERFECT.', cooldown: ABILITY.trickshot, duration: 0,
    start: (c) => { c.stack.perfectThrows = 3; }, until: (c) => c.stack.perfectThrows > 0,
  },
  {
    id: 'charm', name: 'Charm', description: 'For 6 s cars stop, skaters swerve and the Watch lose interest.', cooldown: ABILITY.charm, duration: 6,
    start: (c) => { c.stack.charmActive = 1; }, end: (c) => { c.stack.charmActive = 0; },
  },
  {
    id: 'turbo', name: 'Turbo', description: 'Vehicle speed ×1.6 for 3 s, then 1 s of wobbly steering.', cooldown: ABILITY.turbo, duration: 4,
    start: (c) => { c.stack.speedMul = 1.6; }, update: (c, t, s) => { s.turnWobble = t > 3 ? 1 : 0; },
    end: (c) => { c.stack.speedMul = 1; c.stack.turnWobble = 0; },
  },
];
const BY_ID = {};
for (const d of DEFS) BY_ID[d.id] = d;

// ctx = { stack, player } — the abilities read the stack live. No allocation.
export function createAbilitySystem(stack, charDef, vehDef) {
  const def = BY_ID[charDef.ability] || null;
  let active = null;   // the ability def currently running
  let t = 0;           // elapsed time in the active ability
  let cd = 0;          // remaining cooldown (s)

  function use() {
    if (!def || active || cd > 0) return false;
    active = def; t = 0; cd = 0;
    if (active.start) active.start({ stack, player: null }, stack);
    return true;
  }
  function tick(dt) {
    if (cd > 0) cd -= dt;
    if (active) {
      t += dt;
      if (active.update) active.update({ stack }, t, stack);
      const done = active.duration > 0 ? (t + 1e-4 >= active.duration) : (active.until ? !active.until({ stack }, stack) : false);
      if (done) {
        if (active.end) active.end({ stack }, stack);
        cd = active.cooldown;
        active = null; t = 0;
      }
    }
  }
  // Fraction of the cooldown still running: 1 = just used / in use, 0 = ready.
  function coolFrac() {
    if (active) return 1;
    if (cd > 0 && def) return Math.min(1, cd / def.cooldown);
    return 0;
  }
  return {
    get stack() { return stack; },
    get active() { return active; },
    get ready() { return !active && cd <= 1e-4; },
    get hasAbility() { return !!def; },
    name: def ? def.name : '',
    description: def ? def.description : '',
    use, tick, coolFrac,
  };
}
