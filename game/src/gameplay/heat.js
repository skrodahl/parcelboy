import { MISCHIEF } from '../data/config.js';

// §2.15: the mischief heat meter. Breaking things / shoving a Grump / a
// subscriber "Oops!" adds heat; it decays over time; the level (0–3, Marlo's
// Charm drops one level) drives how many Neighborhood Watch units are on the
// map (level 2 → Deputy Doug's Segway, level 3 → + the golf cart). A Watch
// unit you shake off respawns after a short cooldown while heat stays up.
//
// env = {
//   charm: boolean,              // Marlo's Charm active
//   spawnWatch(i): unit|null,    // i: 0 = Segway, 1 = golf cart
//   removeWatch(i),
//   onBusted(level),             // freeze + ticket + penalty (wired by main)
// }

const TH = MISCHIEF.heatThresholds;
const RESPAWN = MISCHIEF.watch.loseAfterSec * 0.5;

export function createHeat(env) {
  let heat = 0;
  let t = 0;
  const units = [null, null];
  const lostAt = [-99, -99];

  function rawLevel() {
    let l = 0;
    for (let i = 0; i < TH.length; i++) if (heat >= TH[i]) l = i + 1;
    return l;
  }
  function level() { return Math.max(0, rawLevel() - (env.charm ? MISCHIEF.charmDrops : 0)); }

  function reconcile() {
    const lv = level();
    // Desired units: Segway from level 2, golf cart from level 3.
    const wantSeg = lv >= 2, wantCart = lv >= 3;
    if (wantSeg && !units[0] && t >= lostAt[0] + RESPAWN) { units[0] = env.spawnWatch(0); if (units[0]) lostAt[0] = -99; }
    if (wantCart && !units[1] && t >= lostAt[1] + RESPAWN) { units[1] = env.spawnWatch(1); if (units[1]) lostAt[1] = -99; }
    if (!wantSeg && units[0]) { env.removeWatch(0); units[0] = null; }
    if (!wantCart && units[1]) { env.removeWatch(1); units[1] = null; }
  }

  function tick(dt) {
    t += dt;
    heat = Math.max(0, heat - MISCHIEF.heatDecayPerSec * dt);
    reconcile();
  }

  // A Watch unit got shaken off (stayed clear for loseAfterSec / 25u apart).
  function unitLost(i) {
    if (units[i]) { env.removeWatch(i); units[i] = null; lostAt[i] = t; }
  }

  function reset() {
    heat = 0; t = 0;
    for (let i = 0; i < 2; i++) { if (units[i]) env.removeWatch(i); units[i] = null; lostAt[i] = -99; }
  }

  return {
    tick,
    add: (n) => { heat = Math.max(0, heat + n); },
    unitLost,
    reset,
    get heat() { return heat; },
    get level() { return level(); },
    get units() { return units; },
  };
}
