import { mulberry32 } from '../core/rng.js';
import { PACKAGES } from '../data/packages.js';
import { PARCEL } from '../data/config.js';
import { createScoring } from './scoring.js';
import { createTargeting } from './targeting.js';
import { createMarkers } from './markers.js';
import { createParcels } from '../entities/parcels.js';
import { createNpcs } from '../entities/npcs.js';
import { createEffects } from '../render/effects.js';
import { createFloatText } from '../render/floatText.js';

// §2.5: a weighted package pick from a `packageMix` ({ standard: 0.85, ... })
// using the caller's rng. No mix → the fallback (standard).
function pickPackage(mix, rng, fallback) {
  if (!mix) return fallback;
  let r = rng(), acc = 0;
  const keys = Object.keys(mix);
  for (let i = 0; i < keys.length; i++) {
    acc += mix[keys[i]];
    if (r < acc) return PACKAGES.find((p) => p.id === keys[i]) || fallback;
  }
  return fallback;
}

// §6.3: a tile rect is the axis-aligned world box enclosing its tiles.
function tileRect(world, tiles) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  const T = world.tilemap.tileSize;
  for (let i = 0; i < tiles.length; i++) {
    const x = tiles[i][0], z = tiles[i][1];
    if (x * T < minX) minX = x * T;
    if ((x + 1) * T > maxX) maxX = (x + 1) * T;
    if (z * T < minZ) minZ = z * T;
    if ((z + 1) * T > maxZ) maxZ = (z + 1) * T;
  }
  return { minX, maxX, minZ, maxZ };
}

// §2.4 / §2.5 delivery session: N targets, each with one parcel to deliver.
// M6 runs it per shift (a `packageMix` picks each target's package); the M5
// interim used all-standard. Throws are judged by where the parcel rests;
// points feed the running score/streak.
// env = { world, camera, renderer, scene, player, input, charDef, vehDef,
// targets, seed, ui, packageMix }.
export function createDelivery(env) {
  const { world, camera, renderer, scene, player, input, charDef, vehDef, targets: targetIds, seed, ui, packageMix } = env;
  const events = env.events; // §9: audio listens to these; gameplay never imports audio
  const hazards = env.hazards; // M7: anger a bee swarm when a parcel lands on its tree (§2.7)
  const mailboxes = world.mailboxes || [];
  const std = PACKAGES.find((p) => p.id === 'standard');
  // M7: effects + float text are shared (created once in main.js) so hazards in
  // free roam can use them too; fall back to own copies if none are provided.
  const effects = env.effects || createEffects(scene);
  const floatText = env.floatText || createFloatText(ui, camera, renderer);
  const houseRects = world.def.houses.map((h) => ({
    house: h,
    porch: tileRect(world, world.porches[h.id].tiles),
    lot: tileRect(world, world.lots[h.id]),
  }));
  // §2.5: each target's package is picked from the shift's packageMix (seeded,
  // a separate stream from the scoring rng). No mix → all standard (M5).
  const pkgRng = mulberry32(((seed || 1) * 101 + 7) | 0);
  // `targetIds` is either house ids (main shifts / M5) or pre-built target
  // defs for a side mission's building target (doormat/porch/lot/pkg given).
  const targetDefs = targetIds.map((t) => {
    if (typeof t === 'string') {
      const h = world.def.houses.find((x) => x.id === t);
      return { house: h, doormat: world.doormatPoints[t], porch: tileRect(world, world.porches[t].tiles), lot: tileRect(world, world.lots[t]), pkg: pickPackage(packageMix, pkgRng, std) };
    }
    return { house: t.house, doormat: t.doormat, porch: t.porch, lot: t.lot, pkg: t.pkg };
  });
  const targets = targetDefs.map((t) => ({ ...t, delivered: false }));

  const scoring = createScoring();
  const rng = mulberry32(seed || 1);
  const targeting = createTargeting({ world, camera, renderer, rng });
  const npcs = createNpcs(scene, world.worldMat, world, 4);
  const markers = createMarkers(scene, world, targets);
  // §2.6: capacity = the courier's base capacity + the vehicle's bonus. The back
  // stack holds up to `capacity` parcels, refilled on restock.
  const capacity = charDef.stats.capacity + vehDef.stats.capacityBonus;
  // §2.16: each carried parcel is addressed to one target (that target's `pkg` +
  // `house`). The stack is the carried-parcel order and the TOP parcel (stack[0])
  // is the next throw. Preallocated (no growth at runtime).
  const stack = new Array(capacity);
  let stackLen = 0;
  const targetHouseIds = new Set(targets.map((t) => t.house.id)); // §2.16 'wrongAddress'
  function syncCarried() { player.setCarried(stackLen); }
  // §2.16: refill with the undelivered targets' parcels, in target-list order.
  function rebuildStack() {
    stackLen = 0;
    for (let i = 0; i < targets.length && stackLen < capacity; i++) if (!targets[i].delivered) stack[stackLen++] = targets[i];
  }
  // §2.16: remove the parcel addressed to `t` from the stack (no allocation).
  function removeFromStack(t) {
    for (let i = 0; i < stackLen; i++) if (stack[i] === t) { for (let k = i; k + 1 < stackLen; k++) stack[k] = stack[k + 1]; stackLen--; return true; }
    return false;
  }
  rebuildStack(); syncCarried(); // you start restocked

  const s = {
    targets, houseRects, scoring, targeting, rng, floatText, effects, npcs, markers,
    capacity, lastResult: null,
    restockZone: env.restockZone || null, restockLabel: env.restockLabel || 'depot', restockT: 0,
    throwRange: vehDef.stats.throwRange * charDef.stats.throwRange,
    accuracy: charDef.stats.accuracy,
    doorstepT: 0, doorstepHouse: null, doorstepStart: { x: 0, z: 0 }, mouseHeld: false,
    targetHouseIds,
    get carried() { return stackLen; },
    topParcel() { return stackLen > 0 ? stack[0] : null; },
    syncCarried,
  };
  s.remaining = () => { let n = 0; for (let i = 0; i < targets.length; i++) if (!targets[i].delivered) n++; return n; };
  s.nextUndelivered = () => { for (let i = 0; i < targets.length; i++) if (!targets[i].delivered) return targets[i]; return null; };
  // §2.16: R cycles the stack — the top parcel moves to the bottom (your route).
  s.cycle = () => {
    if (stackLen <= 1) return;
    const top = stack[0];
    for (let k = 0; k + 1 < stackLen; k++) stack[k] = stack[k + 1];
    stack[stackLen - 1] = top;
    if (events) events.emit('cycle');
  };

  function onRest(parcel, zoneOutcome) {
    const pkg = parcel.pkg;
    const target = parcel.target;
    // §2.8 Trick Shot: a banked throw that reaches its target (porch or lot) is
    // guaranteed PERFECT — it scores as a perfect delivery (so the multiplier +
    // streak apply and a fragile/cake parcel stays safe).
    if (parcel.trick && target && (zoneOutcome === 'perfect' || zoneOutcome === 'nice' || zoneOutcome === 'sloppy')) zoneOutcome = 'perfect';
    const res = scoring.judge(pkg, zoneOutcome, { dist: parcel.dist, impact: parcel.impact, airMail: parcel.airMail, timeFrac: 0 });
    s.lastResult = res;
    // §9: audio listens to the delivery result + the landing (never imported by gameplay).
    if (events) {
      events.emit('land');
      events.emit('delivery', res);
      if (res.streakAfter > res.streak) events.emit('streak', { multiplier: res.multiplier });
    }
    const wx = parcel.mesh.position.x, wy = parcel.mesh.position.y, wz = parcel.mesh.position.z;
    res.rest = { x: wx, z: wz };
    // §2.7: a parcel that lands on the beehive or its tree angers the swarm.
    if (hazards) hazards.angersSwarmAt(wx, wz);
    // §2.15: a parcel that comes to rest on a Grump's property may break it.
    if (env.onParcelRest) env.onParcelRest(wx, wy, wz);
    // §2.6: which outcomes remove the target (delivered) vs. lose the parcel.
    const delivered = { perfect: 1, nice: 1, sloppy: 1, lucky: 1, doorstep: 1, broken: 1 };
    if (res.splat) effects.splat(wx, wy, wz);
    if (delivered[res.outcome]) {
      if (target && !target.delivered) {
        target.delivered = true;
        markers.setDelivered(target.house.id);
        npcs.react(target.house.id, res.outcome);
        effects.confetti(wx, Math.max(wy, 0.2), wz);
      }
      // §2.12: a ×3+ streak celebration — a quick rainbow ring + the jingle.
      if (res.multiplier >= 3) {
        effects.celebrate(wx, Math.max(wy, 0.2), wz);
        floatText.pop('×' + res.multiplier + ' STREAK!', wx, wy + 1.8, wz, { color: '#ffd166', burst: true });
      }
      floatText.pop(res.label, wx, wy + 0.4, wz, { color: res.color });
      if (res.points > 0) floatText.pop('+' + res.points, wx, wy + 1.1, wz, { color: res.color });
    } else if (res.outcome === 'splash') {
      // §2.12 onomatopoeia: a big comic "SPLOOSH!" for the water gag. The M16
      // float gag already popped "SPLOOSH! …and it floats" on the splash, so a
      // bobbed parcel skips the second "SPLOOSH!".
      if (!parcel.gagged) floatText.pop('SPLOOSH!', wx, 0.6, wz, { color: res.color, burst: true });
    } else {
      floatText.pop(res.label, wx, wy + 0.4, wz, { color: res.color });
    }
    parcel.rest = 3.0;
  }
  s.onRest = onRest;
  // §2.12 mailbox gag: a parcel that clips a mailbox pops the flag + "DING!".
  s.parcels = createParcels({ scene, material: world.worldMat, world, packages: PACKAGES, targets, houseRects, rng, effects, onRest, mailboxes, targetHouseIds, onMailbox: (x, z) => { effects.dust(x, 1.1, z); floatText.pop('DING!', x, 1.8, z, { color: '#ffd166', burst: true }); },     onGag: (p, x, z) => {
      if (p.state === 'floating') { floatText.pop('SPLOOSH! …and it floats', x, 0.6, z, { color: '#4cc9f0', burst: true }); }
      else { floatText.pop('Come back!', x, 1.8, z, { color: '#ff6b6b', burst: true }); effects.dust(x, 0.6, z); }
    }, onThrow: (p) => { player.startThrow(); floatText.pop('THWUMP!', p.mesh.position.x, p.mesh.position.y + 0.8, p.mesh.position.z, { burst: true }); }, giftWrap: env.giftWrap });

  function doThrow(aim) {
    if (s.parcels.cooldownGet() > 0) return;
    // §2.16: the top parcel (addressed to a specific target) is the one you throw.
    // At 0 carried, a throw just nudges you to restock instead of firing.
    if (stackLen <= 0) {
      floatText.pop('Empty! Restock at the ' + s.restockLabel, player.pos.x, 2, player.pos.z, { color: '#ff6b6b' });
      return;
    }
    const target = stack[0]; // the parcel's address (where it's FOR)
    for (let k = 0; k + 1 < stackLen; k++) stack[k] = stack[k + 1]; // it leaves the stack
    stackLen--;
    syncCarried();
    let ax = aim.x, az = aim.z;
    // §2.8 Trick Shot: while perfectThrows are banked, the throw homes in to the
    // top parcel's own house + is guaranteed PERFECT (the parcel is tagged so
    // onRest scores it PERFECT). Consumed only when that house is in range.
    let trick = false;
    if (player.stack && player.stack.perfectThrows > 0) {
      const dd = Math.hypot(target.doormat.x - player.pos.x, target.doormat.z - player.pos.z);
      if (dd <= s.throwRange * (target.pkg.rules.rangeFactor || 1)) { ax = target.doormat.x; az = target.doormat.z; player.stack.perfectThrows--; trick = true; }
    }
    // §2.5: a heavy parcel halves the throw range.
    const maxDist = s.throwRange * (target.pkg.rules.rangeFactor || 1);
    const dx = ax - player.pos.x, dz = az - player.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > maxDist) { const f = maxDist / d; ax = player.pos.x + dx * f; az = player.pos.z + dz * f; }
    s.parcels.throwParcel({ x: player.pos.x, y: PARCEL.throwHeight, z: player.pos.z }, { x: ax, z: az }, { pkg: target.pkg, target, airMail: player.pos.y > 0.05, trick });
    if (events) events.emit('throw');
  }
  s.doThrow = doThrow;

  // §2.16: the aim assist + mouse aim snap to the top parcel's house.
  s.tryAssistThrow = (side) => doThrow(targeting.assist(player, s.topParcel(), side, s.throwRange));

  // Q/E aim-assist throws, a mouse-click throw at the cursor, + R cycles the stack.
  s.handleInput = () => {
    if (input.consume('cycle')) s.cycle();
    let side = 0;
    if (input.consume('throwLeft')) side = -1;
    else if (input.consume('throwRight')) side = 1;
    if (side !== 0) { s.tryAssistThrow(side); s.mouseHeld = input.mouse.down; return; }
    if (input.mouse.down && !s.mouseHeld) doThrow(targeting.mouseAim(input.mouse.x, input.mouse.y, player, s.topParcel(), s.throwRange, s.accuracy));
    s.mouseHeld = input.mouse.down;
  };

  // §2.4 doorstep delivery: hold F on a target's porch for 0.8 s.
  // §2.6: a knockdown drops one carried parcel (lost, streak resets). A dog
  // thief (§2.12) can steal that dropped parcel — the courier recovers it by
  // catching the dog, else it's gone when the dog trots home.
  s.stolen = false;
  // §2.6: a knockdown drops the top carried parcel (lost, streak resets). A dog
  // thief (§2.12) can steal that dropped parcel — the courier recovers it by
  // catching the dog, else it's gone when the dog trots home.
  let droppedTarget = null;
  s.dropParcel = (stolen) => { if (stackLen > 0) { droppedTarget = stack[--stackLen]; } syncCarried(); scoring.breakStreak(); if (stolen) s.stolen = true; };
  s.recoverParcel = () => { if (s.stolen && droppedTarget) { s.stolen = false; stack[stackLen++] = droppedTarget; droppedTarget = null; syncCarried(); floatText.pop('Got it back!', player.pos.x, 2, player.pos.z, { color: '#a7c957' }); } };
  // §2.6: restock — refill the stack to min(capacity, undelivered) + the ka-chunk.
  // Running out never ends the shift; you can always restock again. Only refills
  // when it actually adds parcels (so it doesn't re-emit at a full stack).
  s.restock = () => {
    const oldLen = stackLen;
    rebuildStack();
    syncCarried();
    if (stackLen > oldLen) {
      if (events) events.emit('restock');
      floatText.pop('Restocked!', player.pos.x, 2, player.pos.z, { color: '#a7c957' });
    }
  };
  // §2.6: stand in the pickup zone for 1.0 s to restock (progress ring). Only
  // refills while there's still room in the stack for more parcels.
  s.updateRestock = (dt) => {
    if (!s.restockZone || stackLen >= Math.min(s.capacity, s.remaining())) { s.restockT = 0; return; }
    const z = s.restockZone;
    const inZone = player.pos.x >= z.minX && player.pos.x <= z.maxX && player.pos.z >= z.minZ && player.pos.z <= z.maxZ;
    if (inZone) { s.restockT += dt; if (s.restockT >= 1.0) { s.restock(); s.restockT = 0; } }
    else s.restockT = 0;
  };
  s.addScore = (n) => { scoring.add(n); };

  // §2.17: the parcel lockers. Stand at a FULL locker for 1.0 s to restock; it
  // goes empty for the rest of the shift (light red, door open, radar grey).
  const lockerBodies = env.lockerBodies || [];
  const lockerVis = env.lockers || null;
  const lockerState = lockerBodies.map(() => ({ full: true }));
  const LOCKER_RADIUS = 2.4;
  let lockerT = 0, lockerIdx = -1;
  s.lockerBodies = lockerBodies;
  s.lockerState = lockerState;
  s.updateLockerRestock = (dt) => {
    let idx = -1, bd = LOCKER_RADIUS * LOCKER_RADIUS;
    for (let i = 0; i < lockerBodies.length; i++) {
      if (!lockerState[i].full) continue;
      const dx = lockerBodies[i].wx - player.pos.x, dz = lockerBodies[i].wz - player.pos.z;
      const dd = dx * dx + dz * dz;
      if (dd < bd) { bd = dd; idx = i; }
    }
    if (idx === -1) { lockerT = 0; lockerIdx = -1; return; }
    if (idx !== lockerIdx) { lockerIdx = idx; lockerT = 0; }
    lockerT += dt;
    if (lockerT >= 1.0) {
      lockerT = 0;
      s.restock();
      lockerState[idx].full = false; // empty for the rest of this shift
      if (lockerVis) lockerVis.setEmpty(idx);
      floatText.pop('Locker emptied!', player.pos.x, 2, player.pos.z, { color: '#ffbe0b' });
    }
  };
  // §2.17: the GPS objective when the stack is empty — the nearest FULL locker or
  // the pickup zone, whichever is closer.
  s.nearestRestock = () => {
    const pz = s.restockZone ? { x: (s.restockZone.minX + s.restockZone.maxX) / 2, z: (s.restockZone.minZ + s.restockZone.maxZ) / 2 } : null;
    let best = pz, bd = Infinity;
    for (let i = 0; i < lockerBodies.length; i++) {
      if (!lockerState[i].full) continue;
      const dx = lockerBodies[i].wx - player.pos.x, dz = lockerBodies[i].wz - player.pos.z;
      const dd = dx * dx + dz * dz;
      if (dd < bd) { bd = dd; best = { x: lockerBodies[i].wx, z: lockerBodies[i].wz }; }
    }
    return best;
  };
  s.updateDoorstep = (dt) => {
    if (!input.isHeld('doorstep')) { s.doorstepT = 0; s.doorstepHouse = null; return; }
    let on = null;
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      if (t.delivered) continue;
      if (player.pos.x >= t.porch.minX && player.pos.x <= t.porch.maxX && player.pos.z >= t.porch.minZ && player.pos.z <= t.porch.maxZ) { on = t; break; }
    }
    if (!on) { s.doorstepT = 0; s.doorstepHouse = null; return; }
    if (s.doorstepHouse !== on.house.id) { s.doorstepHouse = on.house.id; s.doorstepT = 0; s.doorstepStart.x = player.pos.x; s.doorstepStart.z = player.pos.z; }
    const dx = player.pos.x - s.doorstepStart.x, dz = player.pos.z - s.doorstepStart.z;
    if (dx * dx + dz * dz > PARCEL.doorwayCancel * PARCEL.doorwayCancel) { s.doorstepT = 0; s.doorstepHouse = null; s.doorstepStart.x = player.pos.x; s.doorstepStart.z = player.pos.z; return; }
    s.doorstepT += dt;
    if (s.doorstepT >= PARCEL.doorwayTime) {
      // §2.16: the doorstep auto-hands-over the matching parcel from anywhere in
      // the stack (no cycling needed). If its parcel isn't carried, nudge to restock.
      if (!removeFromStack(on)) { s.doorstepT = 0; s.doorstepHouse = null; floatText.pop('Empty! Restock at the ' + s.restockLabel, player.pos.x, 2, player.pos.z, { color: '#ff6b6b' }); return; }
      syncCarried();
      const res = scoring.doorstep(on.pkg, { dist: 0, impact: 0, airMail: false, timeFrac: 0 });
      s.lastResult = res;
      on.delivered = true;
      markers.setDelivered(on.house.id);
      npcs.react(on.house.id, 'doorstep');
      effects.confetti(player.pos.x, 1, player.pos.z);
      floatText.pop(res.label, player.pos.x, 1.7, player.pos.z, { color: res.color });
      if (res.points > 0) floatText.pop('+' + res.points, player.pos.x, 2.3, player.pos.z, { color: res.color });
      s.doorstepT = 0; s.doorstepHouse = null;
    }
  };
  return s;
}
