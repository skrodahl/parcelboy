import * as THREE from 'three';
import { PALETTE } from '../data/palette.js';

// M5 target markers: a pulsing ring on each target's doormat + a bobbing
// parcel icon above it (both single InstancedMeshes), and a small 3D compass
// arrow that hovers over the player and points at the nearest undelivered
// target. Delivered targets are hidden by scaling their instance to zero.

export function createMarkers(scene, world, targets) {
  const n = targets.length;
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const e = new THREE.Euler();

  // Pulsing doormat rings (flat annulus, +Y facing).
  const ringGeo = new THREE.RingGeometry(0.42, 0.62, 24);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({ color: PALETTE.brand, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false });
  const rings = new THREE.InstancedMesh(ringGeo, ringMat, n);
  rings.frustumCulled = false;
  rings.renderOrder = 2;
  scene.add(rings);

  // Bobbing parcel icons above each doormat.
  const iconGeo = new THREE.BoxGeometry(0.34, 0.3, 0.34);
  const iconMat = new THREE.MeshLambertMaterial({ color: PALETTE.brand });
  const icons = new THREE.InstancedMesh(iconGeo, iconMat, n);
  icons.frustumCulled = false;
  scene.add(icons);
  const tapeGeo = new THREE.BoxGeometry(0.34, 0.1, 0.06);
  const tapeMat = new THREE.MeshLambertMaterial({ color: PALETTE.brandAccent });
  const tapes = new THREE.InstancedMesh(tapeGeo, tapeMat, n);
  tapes.frustumCulled = false;
  scene.add(tapes);

  // Compass arrow over the player.
  const compassGeo = new THREE.ConeGeometry(0.16, 0.5, 4);
  compassGeo.rotateX(Math.PI / 2); // point forward (+Z)
  const compass = new THREE.Mesh(compassGeo, new THREE.MeshLambertMaterial({ color: PALETTE.brandAccent }));
  compass.frustumCulled = false;
  scene.add(compass);

  function nearestTarget(px, pz) {
    let best = null;
    let bd = Infinity;
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      if (t.delivered) continue;
      const dx = t.doormat.x - px, dz = t.doormat.z - pz;
      const d = dx * dx + dz * dz;
      if (d < bd) { bd = d; best = t; }
    }
    return best;
  }

  function setDelivered(houseId) {
    for (let i = 0; i < targets.length; i++) if (targets[i].house.id === houseId) targets[i].delivered = true;
  }

  // dt + player position; animates the markers. §2.16: `top` = the top parcel's
  // target — its marker is emphasized (bigger) + the others are dimmed.
  function update(dt, simT, playerX, playerZ, top) {
    for (let i = 0; i < n; i++) {
      const t = targets[i];
      const dm = t.doormat;
      const hidden = t.delivered;
      if (hidden) { s.set(0.001, 0.001, 0.001); p.set(dm.x, 0.13, dm.z); m4.compose(p, q.identity(), s); rings.setMatrixAt(i, m4); icons.setMatrixAt(i, m4); tapes.setMatrixAt(i, m4); continue; }
      // §2.16: emphasize the top parcel's marker, dim the rest.
      const em = (t === top) ? 1.4 : 0.8;
      // Ring pulse (grow + settle), offset per target so they don't sync.
      const ph = (simT * 1.4 + i * 0.7) % 1;
      const pulse = em * (1 + 0.25 * Math.sin(ph * Math.PI * 2));
      s.set(pulse, 1, pulse);
      p.set(dm.x, 0.14, dm.z);
      m4.compose(p, q, s);
      rings.setMatrixAt(i, m4);
      // Bobbing icon + tape, spinning slowly (emphasized/dimmed to match).
      const bob = 1.5 + 0.25 * Math.sin(simT * 2.2 + i);
      p.set(dm.x, bob, dm.z);
      e.set(0, simT * 1.5 + i, 0);
      q.setFromEuler(e);
      s.set(em, em, em);
      m4.compose(p, q, s);
      icons.setMatrixAt(i, m4);
      p.set(dm.x, bob + 0.16, dm.z);
      m4.compose(p, q, s);
      tapes.setMatrixAt(i, m4);
    }
    rings.instanceMatrix.needsUpdate = true;
    icons.instanceMatrix.needsUpdate = true;
    tapes.instanceMatrix.needsUpdate = true;

  // §2.16: the compass points at the TOP parcel's house (the next throw); when
  // nothing is carried it falls back to the nearest undelivered target.
  const goal = (top && !top.delivered) ? top : nearestTarget(playerX, playerZ);
  if (goal) {
    const dx = goal.doormat.x - playerX, dz = goal.doormat.z - playerZ;
    const ang = Math.atan2(dx, -dz); // 0 = north
    compass.position.set(playerX, 2.3 + 0.1 * Math.sin(simT * 3), playerZ);
    compass.rotation.y = ang;
    compass.visible = true;
  } else {
    compass.visible = false;
  }
  }

  return { update, setDelivered, rings, icons, tapes, compass };
}
