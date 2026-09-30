import * as THREE from 'three';
import { VoxelBuilder } from '../render/voxel.js';
import { GlowBuilder } from './glow.js';
import { PALETTE } from '../data/palette.js';
import { buildHouses } from './houses.js';
import { parkCars } from './cars.js';

// §6.4: the neighborhood's special buildings — Hollow Elementary, 3 shops and
// the Quickbox Distribution Center — plus parked cars. Everything merges into
// the chunk opaque builders (no draw calls); windows/glass/lit sign trims go
// into the shared glow builder; sign text uses the atlas sign mesh.

const T = 4;
const _v = new THREE.Vector3();

// Facing N (front door faces north, -Z): local +Z is the front.
function frontMatrix(def, x, z, w, d) {
  const m = new THREE.Matrix4().makeRotationY(Math.PI);
  m.setPosition(x * T + (w * T) / 2, 0, z * T + (d * T) / 2);
  return m;
}

function buildingColliders(def, colliders, id, x, z, w, d, h) {
  colliders.push({ type: 'box', minX: x * T, maxX: (x + w) * T, minZ: z * T, maxZ: (z + d) * T, h });
}

// Returns { flagGeo, flagPos }: the school flag's geometry + pole-top position
// (worldBuilder makes one Mesh with the shared world material; main.js waves it).
export function buildBuildings(grid, tm, glow, signQuads, colliders, windowRects, lampPools, mailboxes) {
  buildHouses(grid, tm, glow, signQuads, colliders, windowRects, lampPools, mailboxes);
  const flag = buildSchool(grid, tm, glow, signQuads);
  for (const b of tm.def.buildings.filter((b) => b.kind === 'shop')) buildShop(grid, tm, glow, signQuads, colliders, b);
  buildDepot(grid, tm, glow, signQuads, colliders);
  parkCars(grid, tm, colliders);
  return flag;
}

// --- Hollow Elementary: 2 floors, brick, clock over the door, flagpole.
function buildSchool(grid, tm, glow, signQuads) {
  const b = tm.def.buildings.find((x) => x.kind === 'school');
  const op = new VoxelBuilder(301);
  const gl = new GlowBuilder();
  const W = b.w * T, D = b.d * T, H = 5.8;
  const brick = '#c8553d';
  const m = frontMatrix(tm.def, b.x, b.z, b.w, b.d);
  const ch = grid.chunkAt(b.x, b.z);

  op.box(0, 0, D / 2 - 0.25, W, H, 0.5, brick, { skipFaces: ['bottom'] });
  op.box(0, 0, -D / 2 + 0.25, W, H, 0.5, brick, { skipFaces: ['bottom'] });
  op.box(-W / 2 + 0.25, 0, 0, 0.5, H, D - 1.0, brick, { skipFaces: ['bottom'] });
  op.box(W / 2 - 0.25, 0, 0, 0.5, H, D - 1.0, brick, { skipFaces: ['bottom'] });
  op.box(0, H, 0, W + 1.0, 0.6, D + 1.0, PALETTE.roof[2], { skipFaces: ['bottom'] });
  op.box(0, H + 0.6, 0, W * 0.7, 0.6, D * 0.7, PALETTE.roof[2], { skipFaces: ['bottom'] });
  // double front door + steps
  op.box(0, 0, D / 2 + 0.06, 2.6, 2.8, 0.12, PALETTE.door[4], { skipFaces: ['bottom'] });
  op.box(0, 0.12, D / 2 + 1.2, 3.6, 0.12, 2.4, PALETTE.sidewalk, { skipFaces: ['bottom'] });
  // clock over the door (face glows) + hands
  gl.box(0, 4.4, D / 2 + 0.08, 1.1, 1.1, 0.1, '#fffaf0', PALETTE.windowNight);
  op.box(0, 4.9, D / 2 + 0.16, 0.1, 0.4, 0.05, '#2f333d');
  op.box(0, 4.4, D / 2 + 0.16, 0.35, 0.08, 0.05, '#2f333d');
  // windows: 2 rows of 4 front + 2 per side
  for (const y of [1.6, 4.2]) {
    for (let i = -1.5; i <= 1.5; i += 1) {
      const x = i * (W / 4);
      if (Math.abs(x) < 2 && y < 3) continue; // keep the door clear
      gl.box(x, y, D / 2 + 0.08, 1.4, 1.4, 0.1, PALETTE.windowDay, PALETTE.windowNight);
    }
    for (const s of [-1, 1]) {
      gl.box(s * (W / 2 + 0.08), y, 0, 0.1, 1.4, 1.4, PALETTE.windowDay, PALETTE.windowNight);
    }
  }
  // flagpole at the front-left; the flag itself is a separate animated mesh
  // (gentle wave via mesh rotation, §6.4).
  const fx = -W / 2 + 3, fz = D / 2 + 3;
  op.box(fx, 0.12, fz, 0.12, 6.0, 0.12, '#cfc4b8', { skipFaces: ['bottom'] });
  const pv = _v.set(fx, 0, fz).applyMatrix4(m);
  const pole = { x: pv.x, y: 0, z: pv.z }; // plain copy (scratch _v gets reused)

  // school sign board + glow trim + atlas plate
  op.box(0, 3.6, D / 2 + 0.1, 5.4, 0.9, 0.18, '#f8f4ea', { skipFaces: ['bottom'] });
  gl.box(0, 3.6, D / 2 + 0.02, 5.7, 1.15, 0.1, '#5a5e6e', '#ffd6a5');
  const p = _v.set(0, 3.6, D / 2 + 0.22).applyMatrix4(m);
  signQuads.push({ rectKey: 'plate:11', x: p.x, y: p.y - 0.4, z: p.z, w: 5.0, h: 0.7, face: [0, 0, -1] });

  ch.opaque.merge(op, m);
  glow.merge(gl, m);

  // Flag geometry: built around the pole (world orientation, so the animated
  // mesh's rotation.y swings it), origin at the pole base. worldBuilder makes
  // one Mesh with the shared world material; main.js waves rotation.y.
  const fb = new VoxelBuilder(305);
  fb.box(0.85, 5.4, 0, 1.7, 0.9, 0.08, PALETTE.brand, { skipFaces: ['bottom'] });
  fb.box(0.85, 5.4, 0.06, 0.5, 0.5, 0.05, PALETTE.trim);
  const fwb = new VoxelBuilder(306);
  fwb.merge(fb, new THREE.Matrix4().makeRotationY(Math.PI)); // school faces N
  return { flagGeo: fwb.toGeometry(), flagPos: pole };
}

// --- Shops: 1 floor, glass front, striped awning in the accent, sign.
function buildShop(grid, tm, glow, signQuads, colliders, b) {
  const op = new VoxelBuilder(302 + b.x);
  const gl = new GlowBuilder();
  const W = b.w * T, D = b.d * T, H = 3.0;
  const m = frontMatrix(tm.def, b.x, b.z, b.w, b.d);
  const ch = grid.chunkAt(b.x, b.z);
  const wall = PALETTE.wall[(b.x * 7) % PALETTE.wall.length];

  op.box(0, 0, D / 2 - 0.25, W, H, 0.5, wall, { skipFaces: ['bottom'] });
  op.box(0, 0, -D / 2 + 0.25, W, H, 0.5, wall, { skipFaces: ['bottom'] });
  op.box(-W / 2 + 0.25, 0, 0, 0.5, H, D - 1.0, wall, { skipFaces: ['bottom'] });
  op.box(W / 2 - 0.25, 0, 0, 0.5, H, D - 1.0, wall, { skipFaces: ['bottom'] });
  op.box(0, H, 0, W + 0.6, 0.3, D + 0.6, PALETTE.roof[5], { skipFaces: ['bottom'] });
  // glass front (glow) + door
  gl.box(-1.2, 0.4, D / 2 + 0.08, 5.4, 2.2, 0.1, PALETTE.windowDay, PALETTE.windowNight);
  gl.box(2.2, 0.4, D / 2 + 0.08, 2.6, 2.2, 0.1, PALETTE.windowDay, PALETTE.windowNight);
  op.box(2.2, 0.1, D / 2 + 0.1, 0.9, 2.4, 0.1, PALETTE.door[1], { skipFaces: ['bottom'] });
  // striped awning (accent / white) overhanging the front
  for (let i = 0; i < 4; i++) {
    op.box(-W / 2 + (i + 0.5) * (W / 4), 2.75, D / 2 + 0.7, W / 4 - 0.1, 0.12, 1.8, i % 2 ? PALETTE.trim : b.accent, { skipFaces: ['bottom'] });
  }
  // sign board + glow trim + atlas plate
  op.box(0, 3.5, D / 2 + 0.1, 3.2, 0.9, 0.18, '#f8f4ea', { skipFaces: ['bottom'] });
  gl.box(0, 3.5, D / 2 + 0.02, 3.5, 1.15, 0.1, b.accent, b.accent);
  ch.opaque.merge(op, m);
  glow.merge(gl, m);
  const p = _v.set(0, 3.5, D / 2 + 0.22).applyMatrix4(m);
  signQuads.push({ rectKey: 'plate:' + (7 + tm.def.buildings.filter((x) => x.kind === 'shop').indexOf(b)), x: p.x, y: p.y - 0.4, z: p.z, w: 3.0, h: 0.7, face: [0, 0, -1] });
  buildingColliders(tm.def, colliders, b.id, b.x, b.z, b.w, b.d, H + 0.3);
}

// --- Quickbox Distribution Center: teal warehouse, docks, lit sign, 2 vans.
function buildDepot(grid, tm, glow, signQuads, colliders) {
  const b = tm.def.buildings.find((x) => x.kind === 'depot');
  const op = new VoxelBuilder(303);
  const gl = new GlowBuilder();
  const W = b.w * T, D = b.d * T, H = 4.0;
  const m = frontMatrix(tm.def, b.x, b.z, b.w, b.d);
  const ch = grid.chunkAt(b.x, b.z);
  const brand = PALETTE.brand;

  op.box(0, 0, D / 2 - 0.3, W, H, 0.6, brand, { skipFaces: ['bottom'] });
  op.box(0, 0, -D / 2 + 0.3, W, H, 0.6, '#0a8f85', { skipFaces: ['bottom'] });
  op.box(-W / 2 + 0.3, 0, 0, 0.6, H, D - 1.2, '#0a8f85', { skipFaces: ['bottom'] });
  op.box(W / 2 - 0.3, 0, 0, 0.6, H, D - 1.2, brand, { skipFaces: ['bottom'] });
  op.box(0, H, 0, W + 0.8, 0.4, D + 0.8, PALETTE.roof[5], { skipFaces: ['bottom'] });
  op.box(0, H + 0.4, D / 2 + 0.4, W + 0.8, 0.4, 0.4, PALETTE.roof[5]); // parapet lip
  // 3 loading docks on the front (middle open)
  for (let i = -1; i <= 1; i++) {
    const dx = i * (W / 3.4);
    op.box(dx, 0, D / 2 + 0.05, 3.4, 3.0, 0.3, '#f8f4ea', { skipFaces: ['bottom'] }); // door frame
    if (i === 0) {
      op.box(dx, 0, D / 2 - 0.5, 3.0, 3.0, 0.5, '#2f333d'); // open dock interior
      op.box(dx, 0, D / 2 + 1.2, 3.4, 0.1, 2.0, PALETTE.sidewalk, { skipFaces: ['bottom', 'top'] }); // ramp
    } else {
      op.box(dx, 0, D / 2 + 0.1, 3.0, 2.8, 0.1, PALETTE.roof[5], { skipFaces: ['bottom'] }); // roll-up door
    }
  }
  // big lit QUICKBOX sign: board + glow trim + atlas plate
  op.box(0, 2.6, D / 2 + 0.12, 7.0, 1.4, 0.25, '#f8f4ea', { skipFaces: ['bottom'] });
  gl.box(0, 3.45, D / 2 + 0.05, 7.4, 0.14, 0.1, '#5a5e6e', PALETTE.brandAccent);
  gl.box(0, 1.75, D / 2 + 0.05, 7.4, 0.14, 0.1, '#5a5e6e', PALETTE.brandAccent);
  ch.opaque.merge(op, m);
  glow.merge(gl, m);
  const p = _v.set(0, 2.6, D / 2 + 0.27).applyMatrix4(m);
  signQuads.push({ rectKey: 'plate:10', x: p.x, y: p.y - 0.55, z: p.z, w: 6.6, h: 1.1, face: [0, 0, -1] });
  buildingColliders(tm.def, colliders, b.id, b.x, b.z, b.w, b.d, H + 0.8);

  // 2 parked Quickbox vans in the lot in front of the docks.
  addVan(grid, tm, b.x + 2, b.z - 1, 311, signQuads, colliders);
  addVan(grid, tm, b.x + 4, b.z - 1, 312, signQuads, colliders);
}

// One parked van (brand cab + cargo box with logo quads) on a lot tile, built
// in world coords and merged into the owning chunk.
function addVan(grid, tm, tx, tz, seed, signQuads, colliders) {
  const op = new VoxelBuilder(seed);
  const wx = tm.cx(tx), wz = tm.cz(tz);
  const brand = PALETTE.brand;
  op.box(wx, 0.47, wz - 0.4, 1.9, 0.9, 2.6, brand, { skipFaces: ['bottom'] }); // body
  op.box(wx, 0.62, wz - 1.4, 1.9, 1.4, 1.4, brand, { skipFaces: ['bottom'] }); // cab
  op.box(wx, 0.62, wz - 0.1, 1.5, 0.7, 1.6, '#3d4152'); // windshield band
  op.box(wx, 0.47, wz + 1.1, 2.3, 2.3, 2.4, brand, { skipFaces: ['bottom'] }); // cargo box
  for (const s of [-1, 1]) for (const dz of [-1.0, 1.2]) {
    op.box(wx + s * 0.9, 0.17, wz + dz, 0.3, 0.4, 0.9, '#2f333d', { skipFaces: ['bottom'] });
  }
  grid.chunkAt(tx, tz).opaque.merge(op);
  // Quickbox logo quads on both cargo sides.
  signQuads.push({ rectKey: 'logo', x: wx - 1.17, y: 0.9, z: wz + 1.1, w: 1.5, h: 0.94, face: [-1, 0, 0] });
  signQuads.push({ rectKey: 'logo', x: wx + 1.17, y: 0.9, z: wz + 1.1, w: 1.5, h: 0.94, face: [1, 0, 0] });
  colliders.push({ type: 'box', minX: wx - 1.3, maxX: wx + 1.3, minZ: wz - 2.4, maxZ: wz + 2.4, h: 2.9 });
}
