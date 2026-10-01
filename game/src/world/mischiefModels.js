import * as THREE from 'three';
import { VoxelBuilder } from '../render/voxel.js';

// §2.15: the mischief prop set. Static props are merged into single
// geometries (one draw call each) so 4 Grump houses + 2 Watch units stay
// inside the 140 draw-call budget.

// Grump lawn dressing, in a local frame whose origin is the doormat, +Z
// pointing out to the street/lawn, the house behind at -Z. One geometry.
export function grumpPropsGeo(seed) {
  const b = new VoxelBuilder(seed);
  // "NO QUICKBOX!" lawn sign (post + white board + red border + a slash bar).
  b.box(-1.6, 0.6, 1.8, 0.12, 1.2, 0.12, '#8d6e63');
  b.box(-1.6, 1.2, 1.8, 1.2, 0.72, 0.09, '#f8f4ea');
  b.box(-1.6, 1.2, 1.85, 1.28, 0.8, 0.05, '#e63946');
  b.box(-1.6, 1.2, 1.9, 1.0, 0.1, 0.03, '#e63946');
  // a grumpy gnome (body + face + pointed hat + scowl).
  b.box(1.6, 0.5, 2.0, 0.42, 0.5, 0.42, '#2f333d');
  b.box(1.6, 0.88, 2.0, 0.34, 0.3, 0.3, '#f1c27d');
  b.box(1.6, 1.1, 2.0, 0.3, 0.42, 0.22, '#e63946');
  b.box(1.6, 0.95, 2.16, 0.2, 0.05, 0.03, '#22223b');
  // a pair of pink flamingos.
  for (const s of [-1, 1]) {
    const z = 2.5 + s * 0.55;
    b.box(0.7 * s, 0.4, z, 0.3, 0.5, 0.3, '#ff6fa5');
    b.box(0.7 * s, 0.85, z, 0.08, 0.35, 0.08, '#ff6fa5');
    b.box(0.7 * s, 1.05, z, 0.16, 0.1, 0.12, '#ff6fa5');
    b.box(0.6 * s, 0.05, z + 0.15, 0.06, 0.35, 0.06, '#e0559a'); // legs
  }
  // drawn curtains: two dark panes over the front windows (house at -Z).
  b.box(-1.0, 2.0, -0.35, 1.1, 1.1, 0.06, '#2b2b3a');
  b.box(1.0, 2.0, -0.35, 1.1, 1.1, 0.06, '#2b2b3a');
  // a dark (non-subscriber) mailbox.
  b.box(2.3, 0.95, 1.6, 0.42, 0.5, 0.42, '#2f333d');
  b.box(2.3, 1.25, 1.6, 0.3, 0.1, 0.3, '#1c1c28');
  return b.toGeometry();
}

// A parked car in the Grump's driveway (one shared geometry).
export function parkedCarGeo() {
  const b = new VoxelBuilder(9001);
  b.box(0, 0.6, 0, 1.7, 0.7, 3.0, '#e05a4a', { skipFaces: ['bottom'] });
  b.box(0, 1.25, -0.2, 1.4, 0.5, 1.7, '#20313a'); // cabin/glass
  for (const [wx, wz] of [[-0.85, 1.0], [0.85, 1.0], [-0.85, -1.0], [0.85, -1.0]]) {
    b.box(wx, 0.35, wz, 0.4, 0.5, 0.4, '#22223b'); // wheels
  }
  return b.toGeometry();
}

// Deputy Doug riding a Segway: a courier-ish rig on a two-wheeled platform.
export function buildWatchSegway(mat, colors) {
  const g = new THREE.Group();
  const b = new VoxelBuilder(9101);
  b.box(0, 0.4, 0, 1.0, 0.6, 0.6, '#e63946');          // platform + handle post base
  b.box(0, 1.2, 0.25, 0.16, 1.2, 0.16, '#5a5e6e');      // handlebar post
  b.box(0, 1.9, 0.25, 0.6, 0.12, 0.12, '#5a5e6e');      // handlebar
  for (const s of [-1, 1]) b.box(s * 0.5, 0.35, 0, 0.34, 0.7, 0.7, '#22223b'); // wheels
  const body = new THREE.Mesh(b.toGeometry(), mat);
  // Doug himself (courier-ish, in the Watch colors), a separate mesh so the
  // little "reach for the ticket" wave can swing.
  const bb = new VoxelBuilder(9102);
  bb.box(0, 1.4, 0.1, 0.44, 0.7, 0.3, '#3a4d8f');       // navy torso
  bb.box(0, 2.1, 0.1, 0.34, 0.34, 0.34, colors.skin);
  bb.box(0, 2.42, 0.1, 0.4, 0.1, 0.4, '#f8f9fa');       // white cap
  bb.box(-0.28, 1.5, 0.1, 0.12, 0.5, 0.14, '#3a4d8f');
  const arm = new THREE.Mesh((() => { const a = new VoxelBuilder(9103); a.box(0, -0.25, 0, 0.14, 0.5, 0.14, '#3a4d8f'); return a.toGeometry(); })(), mat);
  arm.position.set(0.3, 1.5, 0.1);
  g.add(body, arm);
  return { group: g, arm };
}

// A Neighborhood Watch golf cart (level 3). One body + a canopy + 4 wheels.
export function buildWatchCart(mat, colors) {
  const g = new THREE.Group();
  const b = new VoxelBuilder(9201);
  b.box(0, 0.55, 0, 1.9, 0.7, 2.6, '#f8f9fa', { skipFaces: ['bottom'] }); // body
  b.box(0, 1.1, 0.2, 1.5, 0.2, 1.6, colors.skin || '#f1c27d');           // seat
  b.box(0, 2.0, 0, 1.9, 0.1, 2.6, '#3a4d8f');                            // canopy roof
  for (const s of [-1, 1]) { b.box(s * 0.85, 0.95, 1.0, 0.12, 0.7, 0.12, '#5a5e6e'); b.box(s * 0.85, 0.95, -1.0, 0.12, 0.7, 0.12, '#5a5e6e'); }
  for (const [wx, wz] of [[-0.9, 1.1], [0.9, 1.1], [-0.9, -1.1], [0.9, -1.1]]) b.box(wx, 0.35, wz, 0.5, 0.7, 0.5, '#22223b');
  // a little Deputy in the driver's seat.
  const cb = new VoxelBuilder(9202);
  cb.box(0.5, 1.3, 0.2, 0.4, 0.6, 0.3, '#3a4d8f');
  cb.box(0.5, 1.95, 0.2, 0.3, 0.3, 0.3, colors.skin);
  const body = new THREE.Mesh(b.toGeometry(), mat);
  const driver = new THREE.Mesh(cb.toGeometry(), mat);
  g.add(body, driver);
  return { group: g };
}

// A cracked-window overlay (dark pane + crack lines), placed at a window rect.
export function crackedWindowGeo() {
  const b = new VoxelBuilder(9301);
  b.box(0, 0, 0, 1.2, 1.2, 0.04, '#20313a');
  b.box(0, 0, 0.03, 0.08, 1.2, 0.02, '#aee3ff');
  b.box(0.3, 0.2, 0.03, 0.9, 0.05, 0.02, '#aee3ff');
  b.box(-0.2, -0.3, 0.03, 0.7, 0.05, 0.02, '#aee3ff');
  return b.toGeometry();
}
