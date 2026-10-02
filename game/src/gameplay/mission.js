import { mulberry32 } from '../core/rng.js';

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

// M15a.17: a side mission delivers to houses across the suburb (never back to
// the shop). Pick `shift.deliveries` seeded house targets, each at least
// `shift.minDistance` from the giver shop and at least `shift.minSpacing` from
// every other target, never a Grump house, never a target of the concurrently
// running main shift. Each gets a customer (seeded from `shift.customers`).
// Returns `{ house, customer }` defs; `delivery.setupDelivery` resolves the
// doormat/porch/lot from the house id and the pkg from the package mix.
function selectSideHouses(def, shift, seed, env) {
  const T = def.tileSize;
  const giver = def.buildings.find((x) => x.id === shift.giver) || def.houses.find((x) => x.id === shift.giver);
  if (!giver) return [];
  const gx = (giver.x + giver.w / 2) * T, gz = (giver.z + giver.d / 2) * T;
  const minD = shift.minDistance || 0, minSp = shift.minSpacing || 0;
  const grumps = new Set(env.grumpHouseIds || []);
  const mainTgts = new Set(env.activeMainTargetIds || []);
  const center = (h) => [ (h.x + 0.5) * T, (h.z + 0.5) * T ];
  const cands = def.houses.filter((h) => {
    if (grumps.has(h.id) || mainTgts.has(h.id)) return false;
    const c = center(h);
    return Math.hypot(c[0] - gx, c[1] - gz) >= minD;
  });
  const rng = mulberry32(seed);
  for (let i = cands.length - 1; i > 0; i--) { const j = (rng() * (i + 1)) | 0; const t = cands[i]; cands[i] = cands[j]; cands[j] = t; }
  const picked = [];
  for (const h of cands) {
    if (picked.length >= shift.deliveries) break;
    const c = center(h);
    let ok = true;
    for (const p of picked) { const pc = center(p); if (Math.hypot(c[0] - pc[0], c[1] - pc[1]) < minSp) { ok = false; break; } }
    if (ok) picked.push(h);
  }
  if (picked.length < shift.deliveries) for (const h of cands) { if (picked.length >= shift.deliveries) break; if (picked.indexOf(h) < 0) picked.push(h); } // fill, spacing relaxed
  const cust = (shift.customers || []).slice();
  const crng = mulberry32((seed * 131 + 17) | 0);
  for (let i = cust.length - 1; i > 0; i--) { const j = (crng() * (i + 1)) | 0; const t = cust[i]; cust[i] = cust[j]; cust[j] = t; }
  return picked.map((h, i) => ({ house: h, customer: cust.length ? cust[i % cust.length] : null }));
}

// Build the target defs for a shift: house ids for main shifts, `{ house,
// customer }` defs for side missions (each parcel goes to a customer's house).
function buildTargetDefs(env) {
  const { def, shift, seed } = env;
  if (shift.kind === 'side') return selectSideHouses(def, shift, seed, env);
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
    // M15a.16: stars reward delivering first, style second.
    // 1★ = at least ~`deliveredFrac` of the parcels delivered (rounded up);
    // 2★ = every parcel delivered; 3★ = every parcel delivered AND
    // score ≥ the mission's `style` threshold.
    const st = shift.stars || { deliveredFrac: 0.7, style: 0 };
    const needOne = Math.ceil(total * st.deliveredFrac);
    let stars = 0;
    if (delivered >= total) stars = 2;
    else if (delivered >= needOne) stars = 1;
    if (stars === 2 && score >= st.style) stars = 3;
    const coins = Math.max(0, Math.floor(score / 10)); // §2.6 (never negative)
    // M15a.17: side missions carry a customer line per parcel (the card + the
    // report show who each parcel is for and which house it went to).
    const customers = (session && !isMain) ? session.targets.map((t) => ({
      name: t.customer ? t.customer.name : null,
      line: t.customer ? t.customer.line : null,
      addr: '#' + t.house.num + ' ' + t.house.street,
      delivered: !!t.delivered,
    })) : [];
    const res = {
      shift: shift.id, score, timeBonus, stars, coins, delivered, total, success,
      tip, hoursOut: !success && hoursRanOut(), base,
      needOne, styleThreshold: st.style, customers,
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
