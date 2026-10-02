import * as THREE from 'three';
import { HAZARD } from '../data/config.js';
import { buildHazardGeos } from '../world/hazardModels.js';
import { createTraffic } from '../world/traffic.js';
import { findDriveways } from '../world/cars.js';
import { mulberry32 } from '../core/rng.js';
import { aheadOf, dist2d, inArcOf, loopPerim, pointOnRect } from './hazardGeom.js';

// §2.7: the neighborhood hazard manager. Spawns the hazards a shift (or free
// roam) asks for, renders each pool as one InstancedMesh, and runs every
// behavior. Knockdowns fire `env.onKnockdown(kind)`; the manager reads the
// player's state via `env.player` (invuln/immune/airborne). Allocation-free
// step: all per-instance state is preallocated.
//
// env = { scene, world, def, charDef, counts, effects, floatText,
// onKnockdown(kind), onHiveHit(x, z), onDogSteal(), onDogRecover(), onHop() }
const MAX = { car: 8, dog: 4, sprinkler: 4, skater: 4, beehive: 4, bee: 48, bin: 10, cone: 4, runaway: 6, goose: 5 };

export function createHazards(env) {
  const { scene, world, def, counts, effects, floatText, player } = env;
  const geos = buildHazardGeos(7);
  const material = world.worldMat;
  const traffic = createTraffic(def, world.tilemap);
  const spots = world.def.hazardSpots || { dog: [], sprinkler: [], beehive: [], bin: [], skater: [] };
  const rng = mulberry32(1234);
  const scratch = { x: 0, z: 0, heading: 0, toCorner: 99 };
  const skPt = { x: 0, z: 0, h: 0 }; // M15a.5: pointOnRect scratch (no per-frame alloc)
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3(1, 1, 1), E = new THREE.Euler();
  const carX = new Float32Array(MAX.car), carZ = new Float32Array(MAX.car); // car positions for the collision pass

  function instanced(model, max, count) {
    const m = new THREE.InstancedMesh(geos[model], material, max);
    m.count = count; m.frustumCulled = false; m.renderOrder = 2;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(m);
    return m;
  }
  function place(mesh, i, x, z, ry, scale) {
    const gy = world.terrain ? world.terrain.baseYAt(x, z) : 0; // §2.19: ride the terrain
    P.set(x, gy, z); S.set(scale, scale, scale); Q.setFromEuler(E.set(0, ry, 0));
    M.compose(P, Q, S); mesh.setMatrixAt(i, M);
  }
  // y-aware variant (bees hover above the ground/skep, not at y=0).
  function placeY(mesh, i, x, y, z, ry, scale) {
    P.set(x, y, z); S.set(scale, scale, scale); Q.setFromEuler(E.set(0, ry, 0));
    M.compose(P, Q, S); mesh.setMatrixAt(i, M);
  }

  // -- Spawn per count -----------------------------------------------------
  const spotOf = { dog: spots.dog || [], sprinkler: spots.sprinkler || [], beehive: spots.beehive || [], bin: spots.bin || [], goose: spots.goose || [] };
  const T = world.tilemap.tileSize;
  const wx = (t) => world.tilemap.cx(t[0]), wz = (t) => world.tilemap.cz(t[1]);

  // Cars: distributed round-robin over the loops, seeded start offsets.
  const nCars = counts.car || 0;
  const cars = [];
  for (let i = 0; i < nCars; i++) {
    const loop = i % traffic.count;
    const off = rng() * traffic.loops[loop].total;
    cars.push({ loop, dist: off, speed: 0, honkT: 0 });
  }
  const dogs = Math.min(counts.dog || 0, spotOf.dog.length);
  const dogSt = [];
  for (let i = 0; i < dogs; i++) { const s = spotOf.dog[i % spotOf.dog.length]; dogSt.push({ x: wx(s), z: wz(s), spot: s, state: 'sleep', t: 0, stealT: -1 }); }
  // §2.17 M16: lakeside geese (chase like dogs but honk and never hurt).
  const gooses = Math.min(counts.goose || 0, spotOf.goose.length);
  const gooseSt = [];
  for (let i = 0; i < gooses; i++) { const s = spotOf.goose[i % spotOf.goose.length]; gooseSt.push({ x: wx(s), z: wz(s), spot: s, state: 'sleep', t: 0, honkT: 0 }); }
  const sprinks = Math.min(counts.sprinkler || 0, spotOf.sprinkler.length);
  const spSt = [];
  for (let i = 0; i < sprinks; i++) { const s = spotOf.sprinkler[i % spotOf.sprinkler.length]; spSt.push({ x: wx(s), z: wz(s), on: (i % 2 === 0), t: 0, angle: rng() * Math.PI * 2 }); }
  const skaters = (counts.skater || 0);
  const skSt = [];
  for (let i = 0; i < skaters; i++) { skSt.push({ loop: i % 4, dist: rng() * 60, weave: rng() * 6, hopT: -1 }); }
  const hives = Math.min(Math.min(counts.bees || 0, HAZARD.maxActiveSwarms + 1), spotOf.beehive.length);
  const hiveSt = [];
  for (let i = 0; i < hives; i++) { const s = spotOf.beehive[i % spotOf.beehive.length]; hiveSt.push({ x: wx(s), z: wz(s), state: 'idle', t: 0, shakeT: 0, cx: wx(s), cz: wz(s), phase: rng() * 6 }); }
  const bins = (counts.bin || 0);
  const binSt = [];
  const cones = (counts.cone || 0);
  const coneSt = [];
  // §11.3 `spawn: 'driveways'` — bins/cones sit at driveway ends (seeded pick).
  const dv = findDriveways(world.tilemap);
  const dvPos = dv.map((g) => ({ x: world.tilemap.cx(g.x), z: world.tilemap.cz(g.z1) }));
  for (let i = 0; i < bins; i++) { const p = dvPos[i % Math.max(1, dvPos.length)]; binSt.push({ x: p ? p.x : 40, z: p ? p.z : 40, tip: -1 }); }
  for (let i = 0; i < cones; i++) { const p = dvPos[(i + 2) % Math.max(1, dvPos.length)]; coneSt.push({ x: p ? p.x : 40, z: p ? p.z : 40 }); }
  // M15 §2.18: runaway bins sit at the bin spots and periodically lunge downhill.
  // `state` 0 = idle at home, 1 = rolling; `t` is the (idle wake / roll) timer.
  const runCount = Math.min(counts.runawayBin || 0, spotOf.bin.length || MAX.runaway);
  const runSt = [];
  for (let i = 0; i < runCount; i++) { const s = spotOf.bin[i % spotOf.bin.length]; runSt.push({ x: wx(s), z: wz(s), hx: wx(s), hz: wz(s), vx: 0, vz: 0, state: 0, t: rng() * 5, roll: 0 }); }

  // -- Instanced meshes ----------------------------------------------------
  const carM = instanced('car', MAX.car, nCars);
  const dogM = instanced('dog', MAX.dog, dogs);
  const gooseM = instanced('goose', MAX.goose, gooses);
  const spM = instanced('sprinkler', MAX.sprinkler, sprinks);
  const skM = instanced('skater', MAX.skater, skaters);
  const hiveM = instanced('beehive', MAX.beehive, hives);
  const BEE = 24;
  const beeM = instanced('bee', MAX.bee, hives * BEE);
  const binM = instanced('bin', MAX.bin, bins);
  const coneM = instanced('cone', MAX.cone, cones);
  const runM = instanced('bin', MAX.runaway, runCount); // M15 runaway bins (share the bin geo)
  const mapW = world.tilemap.width * T, mapH = world.tilemap.height * T; // M15: clamp the roll to the map

  // Static placement (bins/cones/hives/sprinklers sit; set once).
  for (let i = 0; i < bins; i++) place(binM, i, binSt[i].x, binSt[i].z, rng() * 6, 1);
  for (let i = 0; i < cones; i++) place(coneM, i, coneSt[i].x, coneSt[i].z, 0, 1);
  for (let i = 0; i < runCount; i++) place(runM, i, runSt[i].x, runSt[i].z, 0, 1);
  for (let i = 0; i < hives; i++) place(hiveM, i, hiveSt[i].x, hiveSt[i].z, 0, 1);
  for (let i = 0; i < sprinks; i++) place(spM, i, spSt[i].x, spSt[i].z, 0, 1);

  // Behavior helpers --------------------------------------------------------
  function stepCars(dt) {
    for (let i = 0; i < nCars; i++) {
      const c = cars[i];
      traffic.pointAt(c.loop, c.dist, scratch);
      const px = scratch.x, pz = scratch.z, hd = scratch.heading;
      let target = 7.5;
      if (scratch.toCorner < 4) target *= 0.55; // ease into corners
      if (player.stack.charmActive) target = 0;   // §2.8 Charm: cars stop
      // Brake for the player / a car ahead.
      const dxp = player.pos.x - px, dzp = player.pos.z - pz;
      let braking = false;
      if (Math.hypot(dxp, dzp) < 7 && aheadOf(px, pz, hd, dxp, dzp) > Math.cos((25 * Math.PI) / 180)) { target = 0; braking = true; }
      for (let j = 0; j < nCars; j++) {
        if (j === i || cars[j].loop !== c.loop) continue;
        let dd = cars[j].dist - c.dist; if (dd < 0) dd += traffic.loops[c.loop].total;
        if (dd < 7) { target = 0; braking = true; break; }
      }
      c.speed += Math.max(-8 * dt, Math.min(6 * dt, target - c.speed));
      c.dist = (c.dist + c.speed * dt) % traffic.loops[c.loop].total;
      if (braking && c.honkT < 0) c.honkT = 0;
      if (c.honkT >= 0) { c.honkT += dt; if (c.honkT > 0.5) c.honkT = -1; }
      // The car model's front is local +Z; to face the travel dir (sin hd, -cos hd)
      // the Y rotation is PI - hd (hd + PI mirrors E/W cars backwards).
      place(carM, i, px, pz, Math.PI - hd, 1);
      carX[i] = px; carZ[i] = pz;
    }
    carM.instanceMatrix.needsUpdate = true;
  }

  // M15a.14: water tiles are no longer colliders, so chasers slide around the
  // pond instead of stepping into it (animals are never dunked). Allocation-
  // free: a module-scope scratch point the caller writes from.
  const avoid = { x: 0, z: 0 };
  function stepOffWater(x, z, nx, nz) {
    if (!world.def.pond) { avoid.x = nx; avoid.z = nz; return avoid; }
    const t = world.tilemap;
    const tx = (nx / T) | 0, tz = (nz / T) | 0;
    if (t.keyAt(tx, tz) !== 'pond') { avoid.x = nx; avoid.z = nz; return avoid; }
    if (t.keyAt(tx, (z / T) | 0) !== 'pond') { avoid.x = nx; avoid.z = z; return avoid; } // slide along X
    if (t.keyAt((x / T) | 0, tz) !== 'pond') { avoid.x = x; avoid.z = nz; return avoid; } // slide along Z
    avoid.x = x; avoid.z = z; return avoid; // cornered: hold
  }

  function stepDogs(dt) {
    for (let i = 0; i < dogs; i++) {
      const d = dogSt[i];
      const dpx = player.pos.x - d.x, dpz = player.pos.z - d.z;
      const dpd = Math.hypot(dpx, dpz);
      if (d.state === 'sleep') {
        if (dpd < 9 && !player.dogFriendly) { d.state = 'chase'; d.t = 0; floatText.pop('!', d.x, 1.2, d.z, { color: '#ffd166', burst: true }); }
      } else if (d.state === 'chase') {
        d.t += dt;
        const sp = 7.2;
        const a = stepOffWater(d.x, d.z, d.x + (dpx / (dpd || 1)) * sp * dt, d.z + (dpz / (dpd || 1)) * sp * dt);
        d.x = a.x; d.z = a.z;
        const sdx = d.x - wx(d.spot), sdz = d.z - wz(d.spot);
        if (d.t > 5 || Math.hypot(sdx, sdz) > 16) {
          // M15a.12: on Holiday a gave-up dog turns around and chases again after
          // `dogRechase` s instead of trotting home.
          const re = env.dogRechase ? env.dogRechase() : null;
          d.state = re != null ? 'rechase' : 'home'; d.t = 0;
        }
        if (dpd < 0.9 && !player.dogFriendly) {
          const r = player.startKnockdown('dog');
          if (r === 'knockdown' && env.onDogSteal) { env.onDogSteal(); d.stealT = 0; }
        }
      } else if (d.state === 'rechase') { // M15a.12: face the courier, wait, then chase again
        d.t += dt;
        if (d.t >= (env.dogRechase ? env.dogRechase() : 3)) { d.state = 'chase'; d.t = 0; }
      } else { // home / give up
        const hx = wx(d.spot), hz = wz(d.spot);
        const hdx = hx - d.x, hdz = hz - d.z; const hd = Math.hypot(hdx, hdz);
        if (hd < 0.4) { d.state = 'sleep'; }
        else {
          const a = stepOffWater(d.x, d.z, d.x + (hdx / hd) * 4 * dt, d.z + (hdz / hd) * 4 * dt);
          d.x = a.x; d.z = a.z;
        }
        if (d.stealT >= 0) { d.stealT += dt; if (dpd < 0.9 && env.onDogRecover) { env.onDogRecover(); d.stealT = -1; } else if (d.stealT > 8) d.stealT = -1; }
      }
      place(dogM, i, d.x, d.z, Math.atan2(dpx, -dpz), 1);
    }
    dogM.instanceMatrix.needsUpdate = true;
  }

  // §2.17 M16: geese chase the courier like a dog but honk on the way and never
  // knock down (slapstick only). Honk is throttled per goose; a "HONK!" pop +
  // the honk sound (env.onHonk) sells it.
  function stepGooles(dt) {
    if (!gooses) return;
    for (let i = 0; i < gooses; i++) {
      const g = gooseSt[i];
      const dpx = player.pos.x - g.x, dpz = player.pos.z - g.z;
      const dpd = Math.hypot(dpx, dpz);
      if (g.state === 'sleep') {
        if (dpd < 8 && !player.dogFriendly) { g.state = 'chase'; g.t = 0; g.honkT = 0; floatText.pop('HONK!', g.x, 1.6, g.z, { color: '#fb8500', burst: true }); if (env.onHonk) env.onHonk(); }
      } else if (g.state === 'chase') {
        g.t += dt; g.honkT += dt;
        const sp = 6.4;
        const a = stepOffWater(g.x, g.z, g.x + (dpx / (dpd || 1)) * sp * dt, g.z + (dpz / (dpd || 1)) * sp * dt);
        g.x = a.x; g.z = a.z;
        if (g.honkT >= 0.9) { g.honkT = 0; if (env.onHonk) env.onHonk(); }
        const sdx = g.x - wx(g.spot), sdz = g.z - wz(g.spot);
        if (g.t > 6 || Math.hypot(sdx, sdz) > 14) g.state = 'home';
      } else { // home / give up
        const hx = wx(g.spot), hz = wz(g.spot);
        const hdx = hx - g.x, hdz = hz - g.z; const hd = Math.hypot(hdx, hdz);
        if (hd < 0.4) g.state = 'sleep';
        else {
          const a = stepOffWater(g.x, g.z, g.x + (hdx / hd) * 3.5 * dt, g.z + (hdz / hd) * 3.5 * dt);
          g.x = a.x; g.z = a.z;
        }
      }
      // Idle waddle pulse so the geese read as alive at their pad.
      place(gooseM, i, g.x, g.z, Math.atan2(dpx, -dpz), g.state === 'sleep' ? 1 + Math.sin(performance.now() * 0.003 + i) * 0.03 : 1);
    }
    gooseM.instanceMatrix.needsUpdate = true;
  }

  function stepSprinklers(dt) {
    for (let i = 0; i < sprinks; i++) {
      const s = spSt[i];
      s.t += dt;
      const cycle = s.on ? 3 : 3;
      if (s.t >= cycle) { s.t = 0; s.on = !s.on; }
      if (s.on) {
        s.angle += 2.4 * dt;
        effects.spray(s.x, s.z, s.angle);
        // Slow the player standing in the active 120° arc.
        const inArc = dist2d(s.x, s.z, player.pos.x, player.pos.z) < 5 && inArcOf(s, player.pos.x, player.pos.z);
        if (inArc) player.spraySlow = 0.6;
        // §2.7 tie-in: a bee swarm caught in the spray scatters straight home.
        for (let h = 0; h < hives; h++) {
          const hz = hiveSt[h];
          if (hz.state === 'angry' && dist2d(s.x, s.z, hz.cx, hz.cz) < 5) { hz.state = 'home'; hz.t = 0; effects.dust(hz.cx, 1.5, hz.cz); floatText.pop('fizz', hz.cx, 2, hz.cz, { color: '#90e0ef' }); }
        }
      }
    }
  }

  function stepSkaters(dt) {
    for (let i = 0; i < skaters; i++) {
      const k = skSt[i];
      // Sidewalk loops: a fixed perimeter the skater paces at 5 u/s + weave.
      const loop = def.sidewalkLoops ? Object.values(def.sidewalkLoops)[k.loop % 4] : null;
      if (loop) {
        const per = loopPerim(loop, T);
        // §2.8 Charm: skaters swerve away — during Charm they stop and give space.
        k.dist = (k.dist + (player.stack.charmActive ? 0 : 5) * dt) % per;
        pointOnRect(loop, k.dist, T, skPt);
        k.x = skPt.x + Math.sin(k.weave + k.dist * 0.5) * 0.3;
        k.z = skPt.z;
        place(skM, i, k.x, k.z, skPt.h, 1);
        // Jump-over: a skater under an airborne player = "Hop!" +25 (once).
        if (player.pos.y > 0.1 && dist2d(k.x, k.z, player.pos.x, player.pos.z) < 0.9 && k.hopT < 0) { k.hopT = 0; if (env.onHop) env.onHop(); }
      }
      if (k.hopT >= 0) { k.hopT += dt; if (k.hopT > 2) k.hopT = -1; }
    }
    skM.instanceMatrix.needsUpdate = true;
  }

  function stepBees(dt) {
    for (let h = 0; h < hives; h++) {
      const s = hiveSt[h];
      s.phase += dt;
      if (s.shakeT >= 0) { s.shakeT += dt; if (s.shakeT > 0.5) s.shakeT = -1; }
      if (s.state === 'idle') {
        s.cx = s.x + Math.cos(s.phase * 0.6) * 0.8; s.cz = s.z + Math.sin(s.phase * 0.6) * 0.8;
        if (dist2d(s.x, s.z, player.pos.x, player.pos.z) < 6) { s.state = 'angry'; s.t = 0; s.shakeT = 0; floatText.pop('BZZZ!', s.x, 2.4, s.z, { color: '#ffd166', burst: true }); }
      } else if (s.state === 'angry') {
        s.t += dt;
        const dx = player.pos.x - s.cx, dz = player.pos.z - s.cz; const d = Math.hypot(dx, dz) || 1;
        s.cx += (dx / d) * 7.8 * dt + Math.sin(s.phase * 6) * 0.6 * dt; // weaves
        s.cz += (dz / d) * 7.8 * dt + Math.cos(s.phase * 6) * 0.6 * dt;
        if (s.t > 8 || d > 20) s.state = 'home';
        if (d < 1.0) {
          const r = player.startKnockdown('panic');
          if (r === 'knockdown') { s.shakeT = 0; }
          else if (r === 'blocked') { s.state = 'home'; floatText.pop('Bzzt… nope!', s.cx, 2, s.cz, { color: '#ffd166', burst: true }); }
        }
      } else { // home
        const dx = s.x - s.cx, dz = s.z - s.cz; const d = Math.hypot(dx, dz);
        if (d < 0.5) s.state = 'idle'; else { s.cx += (dx / d) * 3 * dt; s.cz += (dz / d) * 3 * dt; }
      }
      // Bees render as a dense buzzing puff around the swarm center (24 inst.
      // in a tight 3D cluster reads as a cloud, not scattered specks). The cloud
      // hugs the ground-level skep (base y=0, below the tree canopy) so it stays
      // visible. Lower cy = readable; small vertical bob + per-bee scale.
      const cy = s.state === 'angry' ? 0.55 : 0.5;
      const crad = s.state === 'angry' ? 0.35 : 0.5;
      for (let b = 0; b < BEE; b++) {
        const idx = h * BEE + b;
        const a = s.phase * 3 + b * 0.5;
        const by = cy + Math.sin(a * 1.7 + b) * 0.3;
        placeY(beeM, idx, s.cx + Math.cos(a) * crad, by, s.cz + Math.sin(a) * crad, a, 1.0);
      }
    }
    beeM.instanceMatrix.needsUpdate = true;
  }

  function stepBins(dt) {
    if (!bins) return;
    let dirty = false;
    for (let i = 0; i < bins; i++) {
      const b = binSt[i];
      if (b.tip < 0) continue; // never tipped: static
      if (b.tip < 1) { b.tip = Math.min(1, b.tip + dt / 0.25); dirty = true; }
      // Tipped bins lean over (rotate about their base) with a small bounce.
      E.set(0, 0, b.tip * 1.4 * (b.tip < 1 ? 1 : 1 + 0.1 * Math.sin(b.tip * 40)));
      Q.setFromEuler(E); P.set(b.x, 0, b.z); S.set(1, 1, 1); M.compose(P, Q, S);
      binM.setMatrixAt(i, M);
    }
    if (dirty) binM.instanceMatrix.needsUpdate = true;
  }

  // M15 §2.18: a runaway bin periodically lunges and rolls downhill along the
  // terrain (gradient of the surface height). It rolls on its side, keeps
  // momentum on flat ground, and is clamped to the map. Idle = upright at home.
  function stepRunaway(dt) {
    if (!runCount) return;
    const gAt = world.terrain ? world.terrain.baseYAt : null;
    const d = 0.6;
    for (let i = 0; i < runCount; i++) {
      const r = runSt[i];
      r.t -= dt;
      if (r.state === 0) {
        // Wake from rest: the downhill gradient (nonzero on the ramp the bin
        // sits on) drives the roll. A slight seeded nudge breaks symmetry.
        if (r.t <= 0) { r.state = 1; r.vx = (rng() - 0.5) * 0.6; r.vz = (rng() - 0.5) * 0.6; r.roll = 0; }
        P.set(r.x, gAt ? gAt(r.x, r.z) : 0, r.z); S.set(1, 1, 1); Q.setFromEuler(E.set(0, 0, 0));
        M.compose(P, Q, S); runM.setMatrixAt(i, M);
        continue;
      }
      // rolling: accelerate downhill + keep momentum, stay on the surface
      const gx = (gAt ? gAt(r.x + d, r.z) : 0) - (gAt ? gAt(r.x - d, r.z) : 0);
      const gz = (gAt ? gAt(r.x, r.z + d) : 0) - (gAt ? gAt(r.x, r.z - d) : 0);
      r.vx += -gx * 5 * dt; r.vz += -gz * 5 * dt;
      let sp = Math.hypot(r.vx, r.vz);
      if (sp > 7) { r.vx = r.vx / sp * 7; r.vz = r.vz / sp * 7; sp = 7; }
      r.x = Math.max(0.5, Math.min(mapW - 0.5, r.x + r.vx * dt));
      r.z = Math.max(0.5, Math.min(mapH - 0.5, r.z + r.vz * dt));
      r.roll += sp * dt * 0.9;
      const gy = gAt ? gAt(r.x, r.z) : 0;
      if (sp > 0.1) { P.set(r.vz, 0, -r.vx).normalize(); Q.setFromAxisAngle(P, r.roll); } else { P.set(1, 0, 0); Q.setFromAxisAngle(P, 0); }
      S.set(1, 1, 1); P.set(r.x, gy + 0.3, r.z);
      M.compose(P, Q, S); runM.setMatrixAt(i, M);
      if (r.t <= 0) { r.x = r.hx; r.z = r.hz; r.vx = 0; r.vz = 0; r.state = 0; r.t = 3 + rng() * 4; }
    }
    runM.instanceMatrix.needsUpdate = true;
  }

  // Collision pass: hazards that knock the player down (skaters on the ground,
  // cars only if you darted out in front of a moving one, §2.7).
  function collide() {
    if (!player.canBeKnocked()) return;
    for (let i = 0; i < skaters; i++) {
      const k = skSt[i];
      if (k.x && dist2d(k.x, k.z, player.pos.x, player.pos.z) < 0.5 && player.pos.y < 0.1) {
        if (player.startKnockdown('skater') === 'knockdown' && env.onKnockdown) env.onKnockdown('skater');
        break;
      }
    }
    for (let i = 0; i < nCars; i++) {
      const c = cars[i];
      if (c.speed > 3 && dist2d(carX[i], carZ[i], player.pos.x, player.pos.z) < 1.5) {
        if (player.startKnockdown('car') === 'knockdown' && env.onKnockdown) env.onKnockdown('car');
        break;
      }
    }
    // M15: a fast-moving runaway bin clips the grounded courier (like a skater).
    for (let i = 0; i < runCount; i++) {
      const r = runSt[i];
      if (r.state === 1 && Math.hypot(r.vx, r.vz) > 2 && dist2d(r.x, r.z, player.pos.x, player.pos.z) < 0.7 && player.pos.y < 0.1) {
        if (player.startKnockdown('bin') === 'knockdown' && env.onKnockdown) env.onKnockdown('bin');
        r.state = 0; r.x = r.hx; r.z = r.hz; r.vx = 0; r.vz = 0; r.t = 2; // it stops and rolls home
        break;
      }
    }
  }

  // M12a.5: the shared geometry helpers (dist2d / inArcOf / loopPerim /
  // pointOnRect + aheadOf) live in gameplay/hazardGeom.js.

  // Public API -------------------------------------------------------------
  function step(dt) {
    if (player) player.spraySlow = 1; // reset; sprinklers raise it this frame
    stepCars(dt); stepDogs(dt); stepGooles(dt); stepSprinklers(dt); stepSkaters(dt); stepBees(dt); stepBins(dt); stepRunaway(dt);
    collide();
  }
  function angersSwarmAt(x, z) {
    for (let h = 0; h < hives; h++) if (dist2d(x, z, hiveSt[h].x, hiveSt[h].z) < 3) { hiveSt[h].state = 'angry'; hiveSt[h].t = 0; hiveSt[h].shakeT = 0; floatText.pop('BZZZ!', x, 2.4, z, { color: '#ffd166', burst: true }); return; }
  }
  function tipBin(x, z) {
    for (let i = 0; i < bins; i++) if (binSt[i].tip < 0 && dist2d(x, z, binSt[i].x, binSt[i].z) < 1.2) { binSt[i].tip = 0; effects.dust(x, 0.6, z); return; }
  }
  // QA: each car's world point + travel heading (for the __pb.debugCars hook).
  function carDebug() {
    const out = [];
    for (let i = 0; i < cars.length; i++) {
      const c = cars[i];
      traffic.pointAt(c.loop, c.dist, scratch);
      out.push({ x: +scratch.x.toFixed(2), z: +scratch.z.toFixed(2), hd: +scratch.heading.toFixed(3), loop: c.loop });
    }
    return out;
  }

  // Static matrices uploaded once.
  binM.instanceMatrix.needsUpdate = true; coneM.instanceMatrix.needsUpdate = true;
  hiveM.instanceMatrix.needsUpdate = true; spM.instanceMatrix.needsUpdate = true;

    return {
      step, angersSwarmAt, tipBin, carDebug,
      cars, dogs, skaters, hives, bins, cones, gooses,
      dogSt, hiveSt, spSt, skSt, binSt, runSt, gooseSt, // internal state (for __pb hooks + tests)
      dispose() {
        for (const m of [carM, dogM, gooseM, spM, skM, hiveM, beeM, binM, coneM, runM]) { scene.remove(m); m.dispose && m.dispose(); }
        for (const k of Object.keys(geos)) geos[k].dispose(); // §2.18: free the hazard geos (built per suburb)
      },
    };
}
