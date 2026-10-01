import { mulberry32 } from '../core/rng.js';
import { PACKAGES } from '../data/packages.js';

// §2.10 / §2.6: a shift runner. It picks the delivery targets for a shift,
// owns the mission timer, and turns the delivery session's running score into
// a result (stars, coins, time bonus) when the timer runs out or all targets
// are delivered. `env = { def, shift, seed, onResults, onActiveChange }`.

// §2.6: pick `count` houses, at most 3 per 4×4-tile region, seeded.
function selectTargets(def, count, seed) {
  const rng = mulberry32(seed);
  const houses = def.houses.slice();
  for (let i = houses.length - 1; i > 0; i--) {
    const j = (rng() * (i + 1)) | 0;
    const t = houses[i]; houses[i] = houses[j]; houses[j] = t;
  }
  const picked = [];
  const cell = {};
  for (let i = 0; i < houses.length && picked.length < count; i++) {
    const h = houses[i];
    const key = ((h.x / 4) | 0) + ':' + ((h.z / 4) | 0);
    if ((cell[key] || 0) >= 3) continue;
    picked.push(h.id);
    cell[key] = (cell[key] || 0) + 1;
  }
  return picked;
}

// §2.14: a building's front delivery point (front face pushed out 1u).
function buildingDeliveryPoint(def, T, buildingId) {
  const b = def.buildings.find((x) => x.id === buildingId) || def.houses.find((x) => x.id === buildingId);
  const cx = (b.x + b.w / 2) * T, cz = (b.z + b.d / 2) * T;
  const f = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] }[b.facing] || [0, 1];
  const off = (b.facing === 'N' || b.facing === 'S') ? (b.d / 2) * T : (b.w / 2) * T;
  const dx = cx + f[0] * (off + 1.0), dz = cz + f[1] * (off + 1.0);
  return {
    house: b, doormat: { x: dx, z: dz },
    porch: { minX: dx - 1.6, maxX: dx + 1.6, minZ: dz - 1.6, maxZ: dz + 1.6 },
    lot: { minX: dx - 3, maxX: dx + 3, minZ: dz - 3, maxZ: dz + 3 },
  };
}

// Build the target defs for a shift: house ids for main shifts, building defs
// for side missions (each of the `deliveries` parcels goes to the giver).
function buildTargetDefs(env) {
  const { def, shift, seed } = env;
  const T = def.tileSize;
  const mixKeys = Object.keys(shift.packageMix);
  const pkg = PACKAGES.find((p) => p.id === mixKeys[0]);
  if (shift.kind === 'side') {
    const defs = [];
    for (let i = 0; i < shift.deliveries; i++) defs.push({ ...buildingDeliveryPoint(def, T, shift.giver), pkg });
    return defs;
  }
  return selectTargets(def, shift.deliveries, seed);
}

export function createMission(env) {
  const { def, shift, seed } = env;
  const targetDefs = buildTargetDefs(env);
  let session = null;
  let active = false;
  let timer = shift.duration;
  let ended = false;
  let lastRes = null;

  function start(s) { session = s; active = true; ended = false; timer = shift.duration; if (env.onActiveChange) env.onActiveChange(true); }

  function allDelivered() { return session && session.remaining() === 0; }

  function update(dt) {
    if (!active || ended) return;
    timer -= dt;
    if (timer <= 0 || allDelivered()) end();
  }

  function end() {
    if (ended || !active) return lastRes;
    active = false; ended = true;
    const delivered = session ? session.targets.length - session.remaining() : 0;
    const total = session ? session.targets.length : 0;
    const timeBonus = delivered === total && timer > 0 ? Math.floor(timer) * 10 : 0; // §2.6
    const score = (session ? session.scoring.score : 0) + timeBonus;
    const th = shift.stars || [1, 2, 3];
    let stars = 0;
    for (let i = th.length - 1; i >= 0; i--) if (score >= th[i]) { stars = i + 1; break; }
    const coins = Math.max(0, Math.floor(score / 10)); // §2.6 (never negative)
    const res = { shift: shift.id, score, timeBonus, stars, coins, delivered, total, success: delivered === total };
    lastRes = res;
    if (env.onResults) env.onResults(res);
    if (env.onActiveChange) env.onActiveChange(false);
    return res;
  }

  function abandon() { if (active) end(); }

  return {
    targetDefs,
    start, update, end, abandon,
    get timer() { return Math.max(0, timer); },
    get active() { return active; },
    get session() { return session; },
    get lastResult() { return lastRes; },
    get duration() { return shift.duration; },
  };
}
