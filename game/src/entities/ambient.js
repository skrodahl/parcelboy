import * as THREE from 'three';
import { VoxelBuilder } from '../render/voxel.js';
import { MISCHIEF } from '../data/config.js';

// §7.7: the ambient life that sells immersion. Everything here is cosmetic,
// pooled (a few InstancedMeshes + a handful of walker rigs), and scales down in
// Battery saver (half the counts, no butterflies or kids). Per-frame work is
// allocation-free (preallocated per-entity records + one scratch set).
const SKINS = ['#f1c27d', '#8d5524', '#c68642', '#f8d5b0', '#e0ac69', '#e0ac69'];
const SHIRTS = ['#ef476f', '#2a9d8f', '#8338ec', '#ff8c42', '#118ab2', '#06d6a0'];
const PANTS = ['#3d5a80', '#22223b', '#5f6275', '#385170', '#4a2c2a', '#2a9d8f'];

function pick(seed, arr) { return arr[(Math.abs(seed) * 7 + 3) % arr.length]; }
function buildWalker(seed) {
  let h = seed;
  const p = (a) => { h = (h * 31 + 7) | 0; return a[h % a.length]; };
  const b = new VoxelBuilder(seed);
  b.box(0, 0.75, 0, 0.46, 0.7, 0.32, p(SHIRTS), { skipFaces: ['bottom'] });
  b.box(0, 1.42, 0, 0.36, 0.34, 0.34, p(SKINS));
  b.box(-0.3, 0.85, 0, 0.12, 0.5, 0.14, p(SHIRTS));
  b.box(0.3, 0.85, 0, 0.12, 0.5, 0.14, p(SHIRTS));
  b.box(-0.11, 0, 0, 0.16, 0.6, 0.18, p(PANTS));
  b.box(0.11, 0, 0, 0.16, 0.6, 0.18, p(PANTS));
  return b.toGeometry();
}
function buildStar() {
  const b = new VoxelBuilder(9501);
  b.box(0, 0, 0, 0.5, 0.06, 0.06, '#ffd166');
  b.box(0, 0, 0, 0.06, 0.5, 0.06, '#ffd166');
  return b.toGeometry();
}
// Merged two-box birds (body + one wing slab reads as a flapping bird from a
// distance) — one geometry shared by a single InstancedMesh.
function buildBird() {
  const b = new VoxelBuilder(3001);
  b.box(0, 0, 0, 0.16, 0.12, 0.4, '#5b5f7a');
  b.box(0, 0.06, 0, 0.4, 0.03, 0.3, '#7a7fa0'); // wing
  b.box(0, 0.06, 0.24, 0.06, 0.05, 0.06, '#f4a261'); // beak
  return b.toGeometry();
}
function buildButterfly() {
  const b = new VoxelBuilder(3002);
  b.box(-0.08, 0, 0, 0.14, 0.015, 0.11, '#ff8fab');
  b.box(0.08, 0, 0, 0.14, 0.015, 0.11, '#4cc9f0');
  b.box(0, 0, 0, 0.03, 0.03, 0.14, '#22223b');
  return b.toGeometry();
}
function buildDuck() {
  const b = new VoxelBuilder(3003);
  b.box(0, 0, 0, 0.2, 0.14, 0.3, '#fffaf0');
  b.box(0, 0.1, -0.14, 0.12, 0.12, 0.12, '#fffaf0');
  b.box(0, 0.1, -0.22, 0.06, 0.04, 0.06, '#f4a261');
  return b.toGeometry();
}

export function createAmbient(env) {
  const { scene, mat, rng, battery = false } = env;
  const tm = env.world.tilemap;
  const N = battery ? 3 : 6;
  const BIRDS = battery ? 9 : 18;
  const BUTTER = battery ? 0 : 10;
  const DUCKS = battery ? 2 : 5;
  const KIDS = battery ? 0 : 2;

  const walkers = [];
  const star = new THREE.Mesh(buildStar(), mat);
  star.visible = false;
  scene.add(star);

  // Spread N walkable lawn tiles across the map.
  const cand = [];
  for (let x = 2; x < tm.width - 2; x++)
    for (let z = 2; z < tm.height - 2; z++)
      if (tm.keyAt(x, z) === 'yard') cand.push([x, z]);
  for (let i = cand.length - 1; i > 0; i--) { const j = (rng() * (i + 1)) | 0; const t = cand[i]; cand[i] = cand[j]; cand[j] = t; }
  const chosen = [];
  for (const c of cand) {
    if (chosen.length >= N) break;
    if (chosen.every((o) => Math.hypot(o[0] - c[0], o[1] - c[1]) > 12)) chosen.push(c);
  }
  for (let i = 0; i < chosen.length; i++) {
    const g = new THREE.Mesh(buildWalker(77 + i * 97), mat);
    g.position.set(tm.cx(chosen[i][0]), 0, tm.cz(chosen[i][1]));
    scene.add(g);
    walkers.push({ mesh: g, x: g.position.x, z: g.position.z, y: 0, vy: 0, state: 'walk', t: 0, tx: g.position.x, tz: g.position.z, spin: 0, sdir: 0.4 + rng() * 0.5 });
  }

  // Birds: perched on lawns, scatter up and away within 6 u, land elsewhere.
  const birdMesh = new THREE.InstancedMesh(buildBird(), mat, BIRDS);
  birdMesh.frustumCulled = false;
  birdMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(birdMesh);
  const birds = [];
  for (let i = 0; i < BIRDS; i++) {
    // M12a.4: perch on a lawn tile spread across the whole map (like the
    // walkers), not just the north-west quarter.
    const t = cand.length ? cand[(i * 7919 + 13) % cand.length] : [2, 2];
    const x = tm.cx(t[0]), z = tm.cz(t[1]);
    birds.push({ x, z, y: 0.3, hx: x, hz: z, hy: 0.3, state: 'perched', t: rng() * 3, vx: 0, vz: 0, flap: rng() * 6 });
  }

  // Butterflies: flutter through the park (InstancedMesh, one color pair).
  let butterMesh = null;
  const butterflies = [];
  if (BUTTER > 0) {
    butterMesh = new THREE.InstancedMesh(buildButterfly(), mat, BUTTER);
    butterMesh.frustumCulled = false;
    butterMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(butterMesh);
    for (let i = 0; i < BUTTER; i++) {
      const cx = tm.cx(4 + ((i * 5) % 14)), cz = tm.cz(34 + (i % 4));
      butterflies.push({ cx, cz, r: 1.5 + rng() * 2, a: rng() * 6.28, sp: 0.5 + rng() * 0.6, bob: rng() * 6 });
    }
  }

  // Ducks: drift in slow circles on the pond.
  const duckMesh = new THREE.InstancedMesh(buildDuck(), mat, DUCKS);
  duckMesh.frustumCulled = false;
  duckMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(duckMesh);
  const pond = env.world.def.pond || { x: (tm.width / 2) - 1, z: (tm.height / 2) - 1, w: 2, d: 2 };
  const px = tm.cx(pond.x + pond.w / 2), pz = tm.cz(pond.z + pond.d / 2);
  const ducks = [];
  for (let i = 0; i < DUCKS; i++) ducks.push({ a: rng() * 6.28, r: 1.5 + rng() * 2.5, sp: 0.2 + rng() * 0.25, bob: rng() * 6 });

  // Kids: two hoops players in the Willow Court bulb + an arcing ball.
  let kidMesh = null, ballMesh = null;
  const kids = [];
  const ball = { x: 0, y: 0, z: 0, vy: 0, t: 0 };
  if (KIDS > 0) {
    const bulbRoad = (env.world.def.roads || []).find((r) => r.bulb);
    if (bulbRoad) {
      const bulb = bulbRoad.bulb;
      const kx = tm.cx(bulb.x + bulb.w / 2), kz = tm.cz(bulb.z + bulb.d / 2);
      kidMesh = new THREE.InstancedMesh(buildWalker(555), mat, KIDS);
      kidMesh.frustumCulled = false;
      kidMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      scene.add(kidMesh);
      for (let i = 0; i < KIDS; i++) kids.push({ x: kx + (i ? 3 : -3), z: kz, face: 0 });
      ballMesh = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), new THREE.MeshLambertMaterial({ color: '#f4a261' }));
      scene.add(ballMesh);
    }
  }

  // Allocation-free scratch.
  const M = new THREE.Matrix4(), P = new THREE.Vector3(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), E = new THREE.Euler();
  const R = new THREE.Color('#ffffff');
  for (let i = 0; i < BIRDS; i++) birdMesh.setColorAt(i, R);
  for (let i = 0; i < DUCKS; i++) duckMesh.setColorAt(i, R);

  let bowledTotal = 0, strike = 0;
  const bowlTimes = [];
  let _t = 0;
  function now() { return _t; }
  function launch(w, vx, vz) {
    w.state = 'air'; w.t = 0; w.y = 0.2; w.vy = 4.5;
    w.vx = vx; w.vz = vz; w.spin = (rng() - 0.5) * 22; w.sdir = 0;
    bowledTotal++;
    env.onBowled && env.onBowled(); // M15a.13: the career ledger counts people bowled
    bowlTimes.push(now());
    while (bowlTimes.length && bowlTimes[0] < now() - MISCHIEF.strikeWindowSec) bowlTimes.shift();
    if (bowlTimes.length >= 2) { strike++; env.onStrike && env.onStrike(); bowlTimes.length = 0; }
  }
  function forceBowl(x, z, vx, vz) {
    let best = null, bd = 1e9;
    for (const w of walkers) { const d = (w.x - x) ** 2 + (w.z - z) ** 2; if (d < bd) { bd = d; best = w; } }
    if (best) launch(best, vx, vz);
  }
  // For the shots: scatter every perched bird at once (a "whoosh").
  function scatterBirds() { for (const b of birds) if (b.state === 'perched') { b.state = 'fly'; b.t = 0; b.vx = (rng() - 0.5) * 6; b.vz = (rng() - 0.5) * 6; } }

  // M12a.3: pick the walker's next target on a walkable tile within ~3 tiles
  // of where it stands — so it wanders the sidewalks and lawns but never drifts
  // off the map or through a house. Infrequent (fires once the walker reaches
  // its target), so a tiny local search is fine; the fallback keeps it in place.
  // M15a.14: the straight line to the target must also not cross the pond
  // (walkers route around water; they never wade).
  function segClearsWater(x0, z0, x1, z1) {
    if (!tm.def.pond) return true;
    const T = tm.tileSize;
    for (let i = 1; i <= 4; i++) {
      const f = i / 5;
      if (tm.keyAt(Math.floor((x0 + (x1 - x0) * f) / T), Math.floor((z0 + (z1 - z0) * f) / T)) === 'pond') return false;
    }
    return true;
  }
  function pickWalkerTarget(w) {
    const T = tm.tileSize;
    const tx0 = Math.max(1, Math.min(tm.width - 2, Math.floor(w.x / T)));
    const tz0 = Math.max(1, Math.min(tm.height - 2, Math.floor(w.z / T)));
    for (let a = 0; a < 6; a++) {
      const tx = tx0 + ((rng() * 7) | 0) - 3;
      const tz = tz0 + ((rng() * 7) | 0) - 3;
      if (tx >= 1 && tz >= 1 && tx < tm.width - 1 && tz < tm.height - 1 && tm.isWalkable(tx, tz) && segClearsWater(w.x, w.z, tm.cx(tx), tm.cz(tz))) {
        w.tx = tm.cx(tx); w.tz = tm.cz(tz);
        return;
      }
    }
    w.tx = w.x; w.tz = w.z;
  }

  function step(dt, player, bowlThresh) {
    _t += dt;
    // Walkers (the §2.15 bowling state machine).
    for (const w of walkers) {
      if (w.state === 'walk') {
        w.x += (w.tx - w.x) * Math.min(1, dt * 1.2);
        w.z += (w.tz - w.z) * Math.min(1, dt * 1.2);
        if (Math.hypot(w.tx - w.x, w.tz - w.z) < 0.6) pickWalkerTarget(w);
        w.mesh.rotation.y = Math.atan2(w.tx - w.x, w.tz - w.z);
        w.mesh.position.set(w.x, Math.abs(Math.sin(_t * 6 + w.x)) * 0.06, w.z);
        if (player && player.speed >= bowlThresh) {
          const dx = w.x - player.pos.x, dz = w.z - player.pos.z;
          if (dx * dx + dz * dz < 1.21) launch(w, Math.sin(player.heading) * player.speed * 1.4, -Math.cos(player.heading) * player.speed * 1.4);
        }
      } else if (w.state === 'air') {
        w.t += dt; w.x += w.vx * dt; w.z += w.vz * dt; w.vy -= 22 * dt; w.y += w.vy * dt;
        if (w.y <= 0) { w.y = 0; w.vy = -w.vy * 0.4; w.vx *= 0.6; w.vz *= 0.6; if (Math.abs(w.vy) < 0.6) w.vy = 0; }
        w.mesh.rotation.y += w.spin * dt; w.mesh.position.set(w.x, w.y, w.z);
        if (w.t > 1.2) { w.state = 'dizzy'; w.t = 0; star.position.set(w.x, 1.9, w.z); star.visible = true; }
      } else if (w.state === 'dizzy') {
        w.t += dt; star.rotation.y += 6 * dt;
        if (w.t > 1.0) { w.state = 'recover'; w.t = 0; star.visible = false; }
      } else {
        w.t += dt; const s = Math.min(1, w.t / 0.3);
        w.mesh.scale.set(s, s, s);
        w.x += (w.tx - w.x) * Math.min(1, dt * 3); w.z += (w.tz - w.z) * Math.min(1, dt * 3);
        w.mesh.position.set(w.x, 0, w.z);
        if (w.t > 2.2) { w.state = 'walk'; w.t = 0; }
      }
    }
    // Birds: perched → scatter within 6 u → land elsewhere.
    for (let i = 0; i < BIRDS; i++) {
      const b = birds[i];
      b.flap += dt * 9;
      if (b.state === 'perched') {
        b.y = b.hy + Math.sin(_t * 2 + i) * 0.04;
        if (player) { const dx = b.x - player.pos.x, dz = b.z - player.pos.z; if (dx * dx + dz * dz < 36) { b.state = 'fly'; b.t = 0; b.vx = (rng() - 0.5) * 8; b.vz = (rng() - 0.5) * 8; b.vy = 6; } }
      } else {
        b.t += dt; b.y += b.vy * dt; b.vy -= 6 * dt; b.x += b.vx * dt; b.z += b.vz * dt;
        if (b.t > 2.2) { b.state = 'land'; b.t = 0; }
        if (b.t > 3.4 && b.state === 'land') { b.state = 'perched'; b.hx = b.x; b.hz = b.z; b.hy = 0.3 + rng() * 0.2; b.x = b.hx; b.z = b.hz; b.y = b.hy; }
      }
      P.set(b.x, b.y, b.z);
      const sc = b.state === 'perched' ? 1 + Math.sin(b.flap) * 0.12 : 1;
      S.set(sc, sc, sc); Q.identity();
      M.compose(P, Q, S); birdMesh.setMatrixAt(i, M);
    }
    birdMesh.instanceMatrix.needsUpdate = true;
    // Butterflies: a slow circular flutter in the park.
    if (butterMesh) for (let i = 0; i < BUTTER; i++) {
      const b = butterflies[i];
      b.a += b.sp * dt;
      const x = b.cx + Math.cos(b.a) * b.r, z = b.cz + Math.sin(b.a) * b.r;
      const flap = Math.sin(_t * 14 + b.bob) * 0.5 + 0.5;
      P.set(x, 1.1 + Math.sin(_t * 2 + b.bob) * 0.4, z);
      S.set(0.4 + flap * 0.6, 1, 0.4 + flap * 0.6);
      E.set(0, b.a, 0); Q.setFromEuler(E);
      M.compose(P, Q, S); butterMesh.setMatrixAt(i, M);
    }
    if (butterMesh) butterMesh.instanceMatrix.needsUpdate = true;
    // Ducks: slow circles on the pond.
    for (let i = 0; i < DUCKS; i++) {
      const d = ducks[i];
      d.a += d.sp * dt;
      P.set(px + Math.cos(d.a) * d.r, 0.28 + Math.sin(_t * 1.5 + d.bob) * 0.05, pz + Math.sin(d.a) * d.r);
      S.set(1, 1, 1); E.set(0, -d.a, 0); Q.setFromEuler(E);
      M.compose(P, Q, S); duckMesh.setMatrixAt(i, M);
    }
    duckMesh.instanceMatrix.needsUpdate = true;
    // Kids + the arcing ball (a hoop loop between the two of them).
    if (kidMesh) {
      ball.t += dt;
      const k = (Math.sin(ball.t * 1.3) + 1) / 2; // 0..1 loop
      const ax = kids[0].x, az = kids[0].z, bx = kids[1].x, bz = kids[1].z;
      ball.x = ax + (bx - ax) * k; ball.z = az + (bz - az) * k;
      ball.y = 0.4 + 3 * k * (1 - k) * 4 * 0.75; // parabola up to ~3u
      for (let i = 0; i < KIDS; i++) {
        const kd = kids[i];
        E.set(0, i === 0 ? Math.atan2(bx - ax, bz - az) : Math.atan2(ax - bx, az - bz), 0);
        P.set(kd.x, 0, kd.z); S.set(0.9, 0.9, 0.9); Q.setFromEuler(E);
        M.compose(P, Q, S); kidMesh.setMatrixAt(i, M);
      }
      kidMesh.instanceMatrix.needsUpdate = true;
      ballMesh.position.set(ball.x, ball.y, ball.z);
      ballMesh.rotation.x += 6 * dt;
    }
  }

  // §2.18: free ambient's own geometries + the ball's material on unload. The
  // shared `mat` (world.worldMat) is disposed with the world, not here.
  function dispose() {
    scene.remove(star); star.geometry.dispose();
    for (const w of walkers) { scene.remove(w.mesh); w.mesh.geometry.dispose(); }
    scene.remove(birdMesh); birdMesh.geometry.dispose();
    if (butterMesh) { scene.remove(butterMesh); butterMesh.geometry.dispose(); }
    scene.remove(duckMesh); duckMesh.geometry.dispose();
    if (kidMesh) { scene.remove(kidMesh); kidMesh.geometry.dispose(); }
    if (ballMesh) { scene.remove(ballMesh); ballMesh.geometry.dispose(); ballMesh.material.dispose(); }
  }

  return {
    walkers, birds, butterflies, ducks, kids,
    step, forceBowl, scatterBirds, dispose,
    get bowledTotal() { return bowledTotal; },
    get strikes() { return strike; },
    get aliveCount() { return walkers.length + BIRDS + BUTTER + DUCKS + KIDS; },
  };
}
