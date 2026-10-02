import { mulberry32 } from '../core/rng.js';
import { PACKAGES } from '../data/packages.js';

// §2.10 / §2.6 / §2.20 / M15a.11: a shift runner. It picks the delivery targets
// and owns the shift's end conditions. M15a.11 (any-time): a main shift has
// `hours` (game hours from acceptance) — it ends when all are delivered, when
// those `hours` run out on the world clock, or when the courier clocks out
// early. It has no fixed window / time of day; starting it never moves the
// clock. A side mission ends when all are delivered and never fails — it just
// stops paying the tip once it's past its soft `deliverBy`. The delivery
// session's running score becomes a result (stars, coins, early-finish bonus /
// tip). Nothing ever reads as a failure: an unfinished shift is a partial-pay
// report. `env = { def, shift, seed, clock, onResults, onActiveChange }`.

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
  const { def, shift, seed, clock } = env;
  const targetDefs = buildTargetDefs(env);
  const isMain = shift.kind !== 'side';
  let session = null;
  let active = false;
  let ended = false;
  let lastRes = null;
  // M15a.11: the shift's deadline on the world clock (game minutes), `hours`
  // after acceptance for a main shift; the soft deliver-by for a side mission.
  let deadlineMin = 0;   // main: start + hours; the shift closes here
  let startMin = 0;      // main: the clock minute the shift was accepted
  let tipByMin = 0;      // side: the soft deliver-by (full pay + tip before it)
  const spanMin = isMain ? shift.hours * 60 : shift.deliverBy; // M15a.11: hours → minutes

  function start(s) {
    session = s; active = true; ended = false;
    if (clock) {
      startMin = clock.min;
      if (isMain) deadlineMin = (startMin + shift.hours * 60) % 1440;
      else tipByMin = (clock.min + shift.deliverBy) % 1440;
    }
    if (env.onActiveChange) env.onActiveChange(true);
  }

  function allDelivered() { return session && session.remaining() === 0; }
  // M15a.11: a main shift closes when its `hours` run out on the world clock
  // (elapsed game minutes since acceptance ≥ the span, wrap-aware).
  function hoursRanOut() {
    if (!clock || !isMain) return false;
    const elapsed = (clock.min - startMin + 1440) % 1440;
    return elapsed >= shift.hours * 60;
  }

  function update(dt) {
    if (!active || ended) return;
    if (allDelivered()) { end(); return; }
    if (hoursRanOut()) end(); // the hours ran out: a partial-pay report
  }

  function end() {
    if (ended || !active) return lastRes;
    active = false; ended = true;
    const delivered = session ? session.targets.length - session.remaining() : 0;
    const total = session ? session.targets.length : 0;
    const success = delivered === total;
    let timeBonus = 0, tip = 0;
    if (clock && success) {
      if (isMain) {
        // M15a.11: an early finish (all delivered before the shift's `hours`
        // run out) pays a bonus of the remaining game minutes of the mission's
        // own hours × 2.
        const elapsed = (clock.min - startMin + 1440) % 1440;
        const remaining = Math.max(0, shift.hours * 60 - elapsed);
        timeBonus = Math.floor(remaining) * 2;
      } else {
        // §2.20: a side mission delivered in time (before its soft deliverBy)
        // earns full pay + a tip; late is pay without the tip. Nothing fails.
        const inTime = clock.min <= tipByMin || clock.min < tipByMin - 1440; // (handles the 24:00 wrap)
        tip = inTime ? 50 : 0;
        timeBonus = tip; // the tip is scored so it lifts the stars/coins too
      }
    }
    const base = session ? session.scoring.score : 0;
    const score = base + timeBonus;
    const th = shift.stars || [1, 2, 3];
    let stars = 0;
    for (let i = th.length - 1; i >= 0; i--) if (score >= th[i]) { stars = i + 1; break; }
    const coins = Math.max(0, Math.floor(score / 10)); // §2.6 (never negative)
    const res = {
      shift: shift.id, score, timeBonus, stars, coins, delivered, total, success,
      tip, hoursOut: !success && hoursRanOut(), base,
    };
    lastRes = res;
    if (env.onResults) env.onResults(res);
    if (env.onActiveChange) env.onActiveChange(false);
    return res;
  }

  // §2.20: "clock out early" — the courier ends the shift on their own terms.
  function abandon() { if (active) end(); }

  return {
    targetDefs,
    start, update, end, abandon,
    get active() { return active; },
    get session() { return session; },
    get lastResult() { return lastRes; },
    get deadlineMin() { return deadlineMin; },
    get tipByMin() { return tipByMin; },
    // §2.20 / M15a.11: the shift's span in game minutes (the autopayer's pacing
    // proxy). A main shift's span is its `hours`.
    get shiftSpanMin() { return spanMin; },
  };
}
