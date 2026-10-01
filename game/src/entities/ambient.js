import * as THREE from 'three';
import { VoxelBuilder } from '../render/voxel.js';
import { MISCHIEF } from '../data/config.js';

// §2.15: ambient pedestrians who can be bowled over. A small pooled set of
// sidewalk walkers wanders the lawns; when the courier plows into one above
// the (vehicle / foot) speed threshold it is launched, spins, bounces, gets
// dizzy stars and pops back up. Two within `strikeWindowSec` = "STRIKE!".
// Pooled (6 rigs) + one shared dizzy star, so the draw-call cost stays tiny.

const SKINS = ['#f1c27d', '#8d5524', '#c68642', '#f8d5b0', '#e0ac69', '#e0ac69'];
const SHIRTS = ['#ef476f', '#2a9d8f', '#8338ec', '#ff8c42', '#118ab2', '#06d6a0'];
const PANTS = ['#3d5a80', '#22223b', '#5f6275', '#385170', '#4a2c2a', '#2a9d8f'];

function buildWalker(seed) {
  let h = seed;
  const pick = (a) => { h = (h * 31 + 7) | 0; return a[h % a.length]; };
  const b = new VoxelBuilder(seed);
  b.box(0, 0.75, 0, 0.46, 0.7, 0.32, pick(SHIRTS), { skipFaces: ['bottom'] });
  b.box(0, 1.42, 0, 0.36, 0.34, 0.34, pick(SKINS));
  b.box(-0.1, 1.3, 0.18, 0.1, 0.05, 0.04, '#22223b');
  b.box(0.1, 1.3, 0.18, 0.1, 0.05, 0.04, '#22223b');
  b.box(-0.3, 0.85, 0, 0.12, 0.5, 0.14, pick(SHIRTS));
  b.box(0.3, 0.85, 0, 0.12, 0.5, 0.14, pick(SHIRTS));
  b.box(-0.11, 0, 0, 0.16, 0.6, 0.18, pick(PANTS));
  b.box(0.11, 0, 0, 0.16, 0.6, 0.18, pick(PANTS));
  return b.toGeometry();
}

function buildStar() {
  const b = new VoxelBuilder(9501);
  b.box(0, 0, 0, 0.5, 0.06, 0.06, '#ffd166');
  b.box(0, 0, 0, 0.06, 0.5, 0.06, '#ffd166');
  b.box(0, 0, 0, 0.36, 0.05, 0.05, '#ffd166');
  return b.toGeometry();
}

export function createAmbient(env) {
  const { scene, mat, rng } = env;
  const tm = env.world.tilemap;
  const N = 6;
  const walkers = [];
  const star = new THREE.Mesh(buildStar(), mat);
  star.visible = false;
  scene.add(star);

  // Spread N walkable lawn/park tiles across the map.
  const cand = [];
  for (let x = 2; x < tm.width - 2; x++)
    for (let z = 2; z < tm.height - 2; z++)
      if (tm.keyAt(x, z) === 'yard' || tm.keyAt(x, z) === 'park') cand.push([x, z]);
  for (let i = cand.length - 1; i > 0; i--) { const j = (rng() * (i + 1)) | 0; const t = cand[i]; cand[i] = cand[j]; cand[j] = t; }
  const chosen = [];
  for (const c of cand) {
    if (chosen.length >= N) break;
    if (chosen.every((o) => Math.hypot(o[0] - c[0], o[1] - c[1]) > 12)) chosen.push(c);
  }
  for (let i = 0; i < chosen.length; i++) {
    const g = new THREE.Mesh(buildWalker(77 + i * 97), mat);
    g.position.set(tm.cx(chosen[i][0]), 0, tm.cz(chosen[i][1]));
    g.visible = true;
    scene.add(g);
    walkers.push({
      mesh: g, x: g.position.x, z: g.position.z, y: 0, vy: 0,
      state: 'walk', t: 0, tx: g.position.x, tz: g.position.z,
      vx: 0, vz: 0, spin: 0, sdir: 0.4 + rng() * 0.5,
    });
  }

  let bowledTotal = 0;
  let strike = 0;
  const bowlTimes = []; // recent bowl timestamps (for STRIKE)

  function launch(w, vx, vz) {
    w.state = 'air'; w.t = 0; w.y = 0.2; w.vy = 4.5;
    w.vx = vx; w.vz = vz; w.spin = (rng() - 0.5) * 22; w.sdir = 0;
    bowledTotal++;
    bowlTimes.push(now());
    while (bowlTimes.length && bowlTimes[0] < now() - MISCHIEF.strikeWindowSec) bowlTimes.shift();
    if (bowlTimes.length >= 2) { strike++; env.onStrike && env.onStrike(); bowlTimes.length = 0; }
  }

  let _t = 0;
  function now() { return _t; }

  // Scripted: bowl the walker nearest (x,z) with a given launch velocity.
  function forceBowl(x, z, vx, vz) {
    let best = null, bd = 1e9;
    for (const w of walkers) { const d = (w.x - x) ** 2 + (w.z - z) ** 2; if (d < bd) { bd = d; best = w; } }
    if (best) launch(best, vx, vz);
  }

  function step(dt, player, bowlThresh) {
    _t += dt;
    for (const w of walkers) {
      if (w.state === 'walk') {
        w.x += (w.tx - w.x) * Math.min(1, dt * 1.2);
        w.z += (w.tz - w.z) * Math.min(1, dt * 1.2);
        if (Math.hypot(w.tx - w.x, w.tz - w.z) < 0.6) {
          w.tx = w.x + (rng() - 0.5) * 14; w.tz = w.z + (rng() - 0.5) * 14;
          w.sdir = 0.4 + rng() * 0.6;
        }
        w.mesh.rotation.y = Math.atan2(w.tx - w.x, w.tz - w.z);
        w.mesh.position.set(w.x, Math.abs(Math.sin(_t * 6 + w.x)) * 0.06, w.z);
        // Player plows in above the threshold → launch (polite bump below it).
        if (player && player.speed >= bowlThresh) {
          const dx = w.x - player.pos.x, dz = w.z - player.pos.z;
          if (dx * dx + dz * dz < 1.1 * 1.1) {
            const pxx = Math.sin(player.heading) * player.speed, pxz = -Math.cos(player.heading) * player.speed;
            launch(w, pxx * 1.4 + (rng() - 0.5) * 2, pxz * 1.4 + (rng() - 0.5) * 2);
          }
        }
      } else if (w.state === 'air') {
        w.t += dt;
        w.x += w.vx * dt; w.z += w.vz * dt; w.vy -= 22 * dt; w.y += w.vy * dt;
        if (w.y <= 0) { w.y = 0; w.vy = -w.vy * 0.4; w.vx *= 0.6; w.vz *= 0.6; if (Math.abs(w.vy) < 0.6) w.vy = 0; }
        w.mesh.rotation.y += w.spin * dt;
        w.mesh.position.set(w.x, w.y, w.z);
        if (w.t > 1.2) { w.state = 'dizzy'; w.t = 0; star.position.set(w.x, 1.9, w.z); star.visible = true; }
      } else if (w.state === 'dizzy') {
        w.t += dt; star.rotation.y += 6 * dt;
        if (w.t > 1.0) { w.state = 'recover'; w.t = 0; star.visible = false; }
      } else if (w.state === 'recover') {
        w.t += dt;
        // Pop back up (scale) and stride away a little faster, then resume.
        const s = Math.min(1, w.t / 0.3);
        w.mesh.scale.set(s, s, s);
        w.x += (w.tx - w.x) * Math.min(1, dt * 3);
        w.z += (w.tz - w.z) * Math.min(1, dt * 3);
        w.mesh.position.set(w.x, 0, w.z);
        if (w.t > 2.2) { w.state = 'walk'; w.t = 0; }
      }
    }
  }

  return { walkers, step, forceBowl, get bowledTotal() { return bowledTotal; }, get strikes() { return strike; } };
}
