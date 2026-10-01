import * as THREE from 'three';
import { VoxelBuilder } from '../render/voxel.js';
import { MISCHIEF } from '../data/config.js';
import { BREAKABLES } from '../data/mischief.js';
import { grumpPropsGeo, parkedCarGeo, crackedWindowGeo } from '../world/mischiefModels.js';

// §2.15: the Grump-house layer. `setup(ids)` dresses a set of houses as
// non-subscriber Grumps (sign, gnome, flamingos, drawn curtains, dark mailbox,
// a parked car) and registers their breakables; `grumpHit(x,z)` reports what a
// resting parcel or a bowled body just broke (adding heat + points + a comic
// burst); `tick` runs the Grump's "burst out, shake a fist, shove" chase.
// All breakables reset on `reset()` (mission start/end).

const FACING_OUT = { N: Math.PI, S: 0, E: Math.PI / 2, W: -Math.PI / 2 };
const UP = new THREE.Vector3(0, 1, 0);

export function createMischief(env) {
  const { world, scene, mat, rng } = env;
  const def = world.def;
  const T = def.tileSize;
  let grumpIds = [];
  let dressing = [];      // { mesh, car, house, broken:Set, brokenMeshes:[] }
  let grumpFig = null;   // the single chasing Grump figure (pooled)
  let chase = null;      // { house, t, shoving }

  function houseById(id) { return def.houses.find((h) => h.id === id); }

  function grumpFigure() {
    if (grumpFig) return grumpFig;
    const b = new VoxelBuilder(9401);
    b.box(0, 0.7, 0, 0.5, 0.75, 0.4, '#c8553d');        // grumpy cardigan
    b.box(0, 1.5, 0, 0.4, 0.4, 0.4, '#f1c27d');          // head
    b.box(0, 1.62, 0.2, 0.3, 0.08, 0.05, '#22223b');    // frown
    b.box(-0.32, 0.8, 0.2, 0.12, 0.6, 0.12, '#c8553d'); // shaking fist arm
    const m = new THREE.Mesh(b.toGeometry(), mat);
    scene.add(m);
    grumpFig = { mesh: m, visible: false };
    return grumpFig;
  }

  // Dress one Grump house + register its breakables.
  function dressHouse(id) {
    const h = houseById(id);
    if (!h) return;
    const dm = world.doormatPoints[id];
    const out = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] }[h.facing] || [0, 1];
    const side = { N: [1, 0], S: [-1, 0], E: [0, 1], W: [0, -1] }[h.facing] || [1, 0];
    const facingRot = FACING_OUT[h.facing] || 0;
    const cx = (h.x + h.w / 2) * T, cz = (h.z + h.d / 2) * T;

    // Merged lawn dressing, placed at the doormat, rotated so local +Z points
    // to the street (lawn props in front, drawn curtains at local -Z on the wall).
    const props = new THREE.Mesh(grumpPropsGeo(id.length * 7 + 3), mat);
    props.position.set(dm.x, 0, dm.z);
    props.rotation.y = Math.atan2(out[0], out[1]);
    scene.add(props);
    // Parked car on the driveway side of the house.
    const car = new THREE.Mesh(parkedCarGeo(), mat);
    car.position.set(cx + side[0] * (h.w / 2 + 1.2) * T, 0, cz + side[1] * (h.w / 2 + 1.2) * T);
    car.rotation.y = (h.facing === 'E' || h.facing === 'W') ? Math.PI / 2 : 0;
    scene.add(car);

    const broken = new Set();
    const rec = { mesh: props, car, house: id, broken, brokenMeshes: [] };
    dressing.push(rec);
    return rec;
  }

  // Breakable (x,z) footprints for a dressed house, in world space: its 2
  // front windows, the gnome / flamingo pair / mailbox on the lawn, the parked
  // car, and a bin by the curb. The lawn props sit in front of the door at
  // `dm + out*d + side*s`, matching where grumpPropsGeo placed them.
  function breakables(rec) {
    const h = houseById(rec.house);
    const dm = world.doormatPoints[rec.house];
    const out = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] }[h.facing] || [0, 1];
    const side = [out[1], -out[0]]; // 90° off the outward direction
    const lawn = (d, s) => ({ x: dm.x + out[0] * d + side[0] * s, z: dm.z + out[1] * d + side[1] * s });
    const list = [];
    // The two FRONT windows (face = the house's street side), so a broken pane
    // reads from the porch. Fall back to any panes if the house has no front ones.
    const all = world.windowRects[rec.house] || [];
    const front = all.filter((w) => w.face === h.facing);
    const wins = (front.length ? front : all).slice(0, 2);
    for (let i = 0; i < wins.length; i++) list.push({ id: 'window:' + i, kind: 'window', x: wins[i].x, y: wins[i].y, z: wins[i].z, r: 1.7 });
    let p;
    p = lawn(2.0, 1.6); list.push({ id: 'gnome', kind: 'gnome', x: p.x, y: 0.5, z: p.z, r: 1.0 });
    p = lawn(2.5, 0.7); list.push({ id: 'flamingo', kind: 'flamingo', x: p.x, y: 0.4, z: p.z, r: 1.0 });
    p = lawn(1.6, 2.3); list.push({ id: 'mailbox', kind: 'mailbox', x: p.x, y: 0.9, z: p.z, r: 1.0 });
    p = lawn(1.0, -2.6); list.push({ id: 'bin', kind: 'bin', x: p.x, y: 0.5, z: p.z, r: 0.9 });
    list.push({ id: 'carAlarm', kind: 'carAlarm', x: rec.car.position.x, y: 0.6, z: rec.car.position.z, r: 2.2 });
    return list;
  }
  function breakList(rec) { if (!rec._bl) rec._bl = breakables(rec); return rec._bl; }

  // What (if anything) breaks at a resting (x,z)? Only undamaged breakables.
  function grumpHit(x, z, y) {
    for (let d = 0; d < dressing.length; d++) {
      const rec = dressing[d];
      for (let i = 0; i < breakList(rec).length; i++) {
        const bl = breakList(rec)[i];
        if (rec.broken.has(bl.id)) continue;
        const dx = x - bl.x, dz = z - bl.z;
        if (dx * dx + dz * dz > bl.r * bl.r) continue;
        if (y != null && Math.abs(y - bl.y) > 2.5) continue; // don't break the car from a high parcel
        rec.broken.add(bl.id);
        onBreak(rec, bl, x, z, y);
        return bl;
      }
    }
    return null;
  }

  function onBreak(rec, bl, x, z, y) {
    const def2 = BREAKABLES[bl.kind];
    const dl = env.delivery ? env.delivery() : null;
    env.heat.add(def2.heat);
    if (dl && dl.active && def2.points) dl.addScore(def2.points);
    if (def2.kind === 'shard') {
      // A persistent cracked overlay on that window until the mission ends,
      // pushed just out to the street side so it reads (not z-fighting the glass).
      const m = new THREE.Mesh(crackedWindowGeo(), mat);
      const wins = world.windowRects[rec.house] || [];
      const w = wins.find((ww) => Math.abs(ww.x - bl.x) < 0.5 && Math.abs(ww.z - bl.z) < 0.5) || { x: bl.x, y: bl.y, z: bl.z };
      const fdir = { S: [0, 1], N: [0, -1], E: [1, 0], W: [-1, 0] }[w.face] || [0, 1];
      m.position.set(w.x + fdir[0] * 0.18, w.y, w.z + fdir[1] * 0.18);
      scene.add(m);
      rec.brokenMeshes.push(m);
      env.effects && env.effects.shards(w.x + fdir[0] * 0.2, Math.max(1.5, w.y), w.z + fdir[1] * 0.2);
    } else {
      env.effects && env.effects.dust(x, (y != null ? y : bl.y) + 0.4, z);
    }
    const fy = Math.max(y != null ? y : bl.y, 1);
    if (env.floatText) env.floatText.pop(labelFor(bl.kind), x, fy + 1, z, { color: '#ffd166', burst: true });
    // A subscriber sees it and says "Oops!" (points only in a mission).
    if (dl && dl.active) {
      if (env.floatText) env.floatText.pop('Oops!', x, fy + 1.6, z, { color: '#ef476f' });
      dl.addScore(MISCHIEF.subscriberOops.points);
      env.heat.add(MISCHIEF.subscriberOops.heat);
    }
    // The Grump bursts out, shakes a fist, and gives chase.
    startChase(rec.house);
  }
  function labelFor(kind) { return (BREAKABLES[kind] || {}).label || 'CRASH!'; }

  function startChase(houseId) {
    const dm = world.doormatPoints[houseId];
    if (!dm) return;
    grumpFigure(); // ensure the pooled figure exists
    chase = { house: houseId, t: 0, shoving: false };
    grumpFig.mesh.visible = true;
    grumpFig.mesh.position.set(dm.x, 0, dm.z);
  }

  function tick(dt) {
    const pl = (env.player && typeof env.player === 'function') ? env.player() : env.player;
    if (!chase || !grumpFig || !pl) { chase = null; if (grumpFig) grumpFig.mesh.visible = false; return; }
    const p = pl.pos;
    chase.t += dt;
    // Charge from the porch toward the player, then a hard shove on arrival.
    const dx = p.x - grumpFig.mesh.position.x, dz = p.z - grumpFig.mesh.position.z;
    const d = Math.hypot(dx, dz);
    if (d > 1.1 && chase.t < MISCHIEF.grumpChaseSec) {
      const sp = MISCHIEF.grumpChaseSpeed * dt;
      grumpFig.mesh.position.x += (dx / (d || 1)) * sp;
      grumpFig.mesh.position.z += (dz / (d || 1)) * sp;
      grumpFig.mesh.rotation.y = Math.atan2(dx, dz);
    } else if (!chase.shoving && chase.t <= MISCHIEF.grumpChaseSec + 0.5) {
      chase.shoving = true;
      // The shove is a hard bonk: knock the courier down (no heat from it).
      if (d < 2.0 && env.onGrumpShove) env.onGrumpShove();
    }
    if (chase.t >= MISCHIEF.grumpChaseSec + 1.2) {
      chase = null;
      grumpFig.mesh.visible = false;
      grumpFig.visible = false;
    }
  }

  function setup(ids) {
    grumpIds = ids.slice();
    for (const id of grumpIds) dressHouse(id);
  }

  function reset() {
    for (const rec of dressing) {
      scene.remove(rec.mesh);
      scene.remove(rec.car);
      for (const m of rec.brokenMeshes) scene.remove(m);
    }
    dressing = [];
    grumpIds = [];
    chase = null;
    if (grumpFig) grumpFig.mesh.visible = false;
  }

  // Scripted: break a Grump's breakable by kind (shots / soak checks) without
  // a parcel. `kind` omitted = the first undamaged one.
  function forceBreak(houseId, kind) {
    const rec = dressing.find((r) => r.house === houseId);
    if (!rec) return false;
    let bl = null;
    for (const b of breakList(rec)) {
      if (rec.broken.has(b.id)) continue;
      if (!kind || b.kind === kind) { bl = b; break; }
    }
    if (!bl) return false;
    rec.broken.add(bl.id);
    onBreak(rec, bl, bl.x, bl.z, bl.y);
    return true;
  }

  function brokenCount() { let n = 0; for (const r of dressing) n += r.broken.size; return n; }

  return {
    setup, reset, tick, grumpHit, forceBreak,
    get grumps() { return grumpIds; },
    get brokenCount() { return brokenCount(); },
    isGrump: (id) => grumpIds.indexOf(id) >= 0,
  };
}
