import * as THREE from 'three';

// §2.4 Throwing: aim assist (Q/E), mouse ground-raycast + snap, and the
// seeded-accuracy offset. `targets` is an array of { house, doormat:{x,z},
// delivered } — the M5 interim 5-house list (M6 replaces it with shifts).

const ASSIST_ANGLE = (50 * Math.PI) / 180; // ±50° cone per side
const SNAP_DIST = 2.5;                     // snap a target whose doormat is this close
const FALLBACK = 0.6;                      // no target in range: aim here * throwRange to the side

// wrap to [-PI, PI]
function wrap(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
// Bearing (0 = north/-Z, east-positive) of the world direction (dx, dz).
function bearing(dx, dz) { return Math.atan2(dx, -dz); }

export function createTargeting({ world, camera, renderer, rng }) {
  const ndc = new THREE.Vector3();
  const ray = new THREE.Vector3();

  function dist2(ax, az, bx, bz) { const dx = ax - bx, dz = az - bz; return dx * dx + dz * dz; }

  // §2.4 aim assist: the undelivered target on the given side (-1 left / +1
  // right) with the smallest angle offset, within throwRange.
  function assist(player, targets, side, throwRange) {
    const sideBearing = player.heading + side * (Math.PI / 2);
    let best = null;
    let bestOff = Infinity;
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      if (t.delivered) continue;
      const dx = t.doormat.x - player.pos.x;
      const dz = t.doormat.z - player.pos.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d > throwRange) continue;
      const off = wrap(bearing(dx, dz) - sideBearing);
      if (Math.abs(off) <= ASSIST_ANGLE && Math.abs(off) < bestOff) { bestOff = Math.abs(off); best = t; }
    }
    if (best) return { x: best.doormat.x, z: best.doormat.z, target: best };
    // Fallback: a point throwRange*0.6 out to that side (no target).
    const r = throwRange * FALLBACK;
    return { x: player.pos.x + Math.sin(sideBearing) * r, z: player.pos.z - Math.cos(sideBearing) * r, target: null };
  }

  // Raycast the cursor (pixel coords) onto the ground plane y = 0.
  function groundPoint(mx, my) {
    const w = renderer.domElement.clientWidth;
    const h = renderer.domElement.clientHeight;
    ndc.set((mx / w) * 2 - 1, -(my / h) * 2 + 1, 0.5);
    ndc.unproject(camera);
    ray.sub(camera.position).normalize();
    const t = -camera.position.y / ray.y;
    return { x: camera.position.x + ray.x * t, z: camera.position.z + ray.z * t };
  }

  // Clamp a ground point to throwRange from the player, snap to a target's
  // doormat when one is within SNAP_DIST, then add the seeded accuracy offset.
  function refine(px, pz, player, targets, throwRange, accuracy) {
    let dx = px - player.pos.x;
    let dz = pz - player.pos.z;
    const d = Math.sqrt(dx * dx + dz * dz) || 1;
    if (d > throwRange) { dx = (dx / d) * throwRange; dz = (dz / d) * throwRange; px = player.pos.x + dx; pz = player.pos.z + dz; }
    // Snap assist: nearest undelivered doormat within 2.5 units.
    let best = null;
    let bd = SNAP_DIST * SNAP_DIST;
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      if (t.delivered) continue;
      const dd = dist2(px, pz, t.doormat.x, t.doormat.z);
      if (dd < bd) { bd = dd; best = t; }
    }
    if (best) { px = best.doormat.x; pz = best.doormat.z; }
    // §2.4: random offset of radius (1 - accuracy) * 1.6, seeded RNG.
    const radius = (1 - accuracy) * 1.6;
    if (radius > 0) {
      const a = rng() * Math.PI * 2;
      const m = Math.sqrt(rng()) * radius; // uniform in the disc
      px += Math.cos(a) * m;
      pz += Math.sin(a) * m;
    }
    return { x: px, z: pz, target: best };
  }

  // Mouse throw aim (called on click).
  function mouseAim(mx, my, player, targets, throwRange, accuracy) {
    const g = groundPoint(mx, my);
    return refine(g.x, g.z, player, targets, throwRange, accuracy);
  }

  // §12.2 __pb.throwAt: aim at a tile center (then clamp + snap + accuracy).
  function pointAim(tileX, tileZ, player, targets, throwRange, accuracy) {
    return refine(world.tilemap.cx(tileX), world.tilemap.cz(tileZ), player, targets, throwRange, accuracy);
  }

  return { assist, mouseAim, pointAim };
}
