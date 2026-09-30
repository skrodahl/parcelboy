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
  const mailboxes = world.mailboxes || [];
  const std = PACKAGES.find((p) => p.id === 'standard');
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
  const floatText = createFloatText(ui, camera, renderer);
  const effects = createEffects(scene);
  const npcs = createNpcs(scene, world.worldMat, world, 4);
  const markers = createMarkers(scene, world, targets);

  const s = {
    targets, houseRects, scoring, targeting, rng, floatText, effects, npcs, markers,
    carried: targets.length, lastResult: null,
    throwRange: vehDef.stats.throwRange * charDef.stats.throwRange,
    accuracy: charDef.stats.accuracy,
    doorstepT: 0, doorstepHouse: null, doorstepStart: { x: 0, z: 0 }, mouseHeld: false,
  };
  s.remaining = () => { let n = 0; for (let i = 0; i < targets.length; i++) if (!targets[i].delivered) n++; return n; };
  s.nextUndelivered = () => { for (let i = 0; i < targets.length; i++) if (!targets[i].delivered) return targets[i]; return null; };

  function onRest(parcel, zoneOutcome) {
    const pkg = parcel.pkg;
    const target = parcel.target;
    const res = scoring.judge(pkg, zoneOutcome, { dist: parcel.dist, impact: parcel.impact, airMail: parcel.airMail, timeFrac: 0 });
    s.lastResult = res;
    const wx = parcel.mesh.position.x, wy = parcel.mesh.position.y, wz = parcel.mesh.position.z;
    res.rest = { x: wx, z: wz };
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
      s.carried = s.remaining();
      floatText.pop(res.label, wx, wy + 0.4, wz, { color: res.color });
      if (res.points > 0) floatText.pop('+' + res.points, wx, wy + 1.1, wz, { color: res.color });
    } else if (res.outcome === 'splash') {
      // §2.12 onomatopoeia: a big comic "SPLOOSH!" for the water gag.
      floatText.pop('SPLOOSH!', wx, 0.6, wz, { color: res.color, burst: true });
    } else {
      floatText.pop(res.label, wx, wy + 0.4, wz, { color: res.color });
    }
    parcel.rest = 3.0;
  }
  s.onRest = onRest;
  // §2.12 mailbox gag: a parcel that clips a mailbox pops the flag + "DING!".
  s.parcels = createParcels({ scene, material: world.worldMat, world, packages: PACKAGES, targets, houseRects, rng, effects, onRest, mailboxes, onMailbox: (x, z) => { effects.dust(x, 1.1, z); floatText.pop('DING!', x, 1.8, z, { color: '#ffd166', burst: true }); }, onThrow: (p) => { player.startThrow(); floatText.pop('THWUMP!', p.mesh.position.x, p.mesh.position.y + 0.8, p.mesh.position.z, { burst: true }); } });

  function doThrow(aim) {
    if (s.parcels.cooldownGet() > 0) return;
    const target = aim.target || s.nextUndelivered();
    if (!target) return; // everything delivered: nothing to throw
    // §2.5: a heavy parcel halves the throw range.
    let ax = aim.x, az = aim.z;
    const maxDist = s.throwRange * (target.pkg.rules.rangeFactor || 1);
    const dx = ax - player.pos.x, dz = az - player.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > maxDist) { const f = maxDist / d; ax = player.pos.x + dx * f; az = player.pos.z + dz * f; }
    s.parcels.throwParcel({ x: player.pos.x, y: PARCEL.throwHeight, z: player.pos.z }, { x: ax, z: az }, { pkg: target.pkg, target, airMail: player.pos.y > 0.05 });
  }
  s.doThrow = doThrow;

  s.tryAssistThrow = (side) => doThrow(targeting.assist(player, targets, side, s.throwRange));

  // Q/E aim-assist throws and a mouse-click throw at the cursor.
  s.handleInput = () => {
    let side = 0;
    if (input.consume('throwLeft')) side = -1;
    else if (input.consume('throwRight')) side = 1;
    if (side !== 0) { s.tryAssistThrow(side); s.mouseHeld = input.mouse.down; return; }
    if (input.mouse.down && !s.mouseHeld) doThrow(targeting.mouseAim(input.mouse.x, input.mouse.y, player, targets, s.throwRange, s.accuracy));
    s.mouseHeld = input.mouse.down;
  };

  // §2.4 doorstep delivery: hold F on a target's porch for 0.8 s.
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
      const res = scoring.doorstep(on.pkg, { dist: 0, impact: 0, airMail: false, timeFrac: 0 });
      s.lastResult = res;
      on.delivered = true;
      markers.setDelivered(on.house.id);
      npcs.react(on.house.id, 'doorstep');
      effects.confetti(player.pos.x, 1, player.pos.z);
      s.carried = s.remaining();
      floatText.pop(res.label, player.pos.x, 1.7, player.pos.z, { color: res.color });
      if (res.points > 0) floatText.pop('+' + res.points, player.pos.x, 2.3, player.pos.z, { color: res.color });
      s.doorstepT = 0; s.doorstepHouse = null;
    }
  };
  return s;
}
