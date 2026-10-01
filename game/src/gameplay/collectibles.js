// §2.13: the hidden Golden Parcels. 12 shiny gold boxes scattered at
// `def.goldenParcels`; each spins + bobs + sparkles. They are NOT shown on the
// radar. Touch one to collect it: a "GOLDEN PARCEL n/12" popup, +50 coins and a
// save. Finding all 12 unlocks the golden bike. One InstancedMesh (12 instances
//) keeps this to a single draw call; per-frame work is allocation-free.
import * as THREE from 'three';

export function createCollectibles({ scene, world, mat, progression, floatText, events }) {
  const T = world.tilemap.tileSize;
  const spots = (world.def.goldenParcels || []).map(([tx, tz], i) => ({
    x: tx * T + T / 2, z: tz * T + T / 2, found: false, spin: i * 0.7, bob: i * 1.3,
  }));
  const count = spots.length;
  const geo = new THREE.BoxGeometry(1.1, 1.1, 1.1);
  const gmat = new THREE.MeshLambertMaterial({ color: 0xffe066, emissive: 0xffb000, emissiveIntensity: 2.2 });
  const mesh = new THREE.InstancedMesh(geo, gmat, count);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(mesh);

  // Preallocated scratch (never allocated per frame).
  const M = new THREE.Matrix4(), P = new THREE.Vector3(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), E = new THREE.Euler();
  const RADIUS = 1.6;

  // Place every instance at its spot on creation so the boxes are correct even
  // before the first sim tick (e.g. a paused / screenshot boot). tick() then
  // drives the spin, bob and sparkle.
  for (let i = 0; i < count; i++) {
    P.set(spots[i].x, 0.9, spots[i].z);
    Q.identity();
    S.set(1, 1, 1);
    M.compose(P, Q, S);
    mesh.setMatrixAt(i, M);
  }
  mesh.instanceMatrix.needsUpdate = true;

  function collect(i) {
    const sp = spots[i];
    if (sp.found) return;
    sp.found = true;
    const total = progression.foundGolden(i);
    progression.earn(50);
    if (floatText) floatText.pop('GOLDEN PARCEL ' + total + '/' + count, sp.x, 2.4, sp.z, { color: '#ffd24a', burst: true });
    if (events) events.emit('golden', { total, count });
  }

  function tick(dt, time, player) {
    for (let i = 0; i < count; i++) {
      const sp = spots[i];
      if (sp.found) S.set(0, 0, 0);
      else {
        sp.spin += dt * 1.4;
        const pulse = 1 + Math.sin(time * 3 + i) * 0.12; // the "sparkle"
        S.set(pulse, pulse, pulse);
        P.set(sp.x, 0.9 + Math.sin(time * 2 + sp.bob) * 0.2, sp.z);
        E.set(0, sp.spin, 0); Q.setFromEuler(E);
        if (player) {
          const dx = player.pos.x - sp.x, dz = player.pos.z - sp.z;
          if (dx * dx + dz * dz < RADIUS * RADIUS) collect(i);
        }
      }
      M.compose(P, Q, S);
      mesh.setMatrixAt(i, M);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  return {
    mesh, tick, collect,
    found(i) { return spots[i] ? spots[i].found : false; },
    anyFound() { for (let i = 0; i < count; i++) if (spots[i].found) return i; return -1; },
    dispose() { scene.remove(mesh); geo.dispose(); gmat.dispose(); },
  };
}
