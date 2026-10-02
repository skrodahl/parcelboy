import * as THREE from 'three';
import { VoxelBuilder } from '../render/voxel.js';
import { GlowBuilder } from './glow.js';
import { PALETTE } from '../data/palette.js';
import { buildHouses } from './houses.js';
import { parkCars } from './cars.js';
import { tileBaseY } from './terrain.js';

// §6.4: the neighborhood's special buildings — Hollow Elementary, 3 shops and
// the Quickbox Distribution Center — plus parked cars. Everything merges into
// the chunk opaque builders (no draw calls); windows/glass/lit sign trims go
// into the shared glow builder; sign text uses the atlas sign mesh.

const T = 4;
const _v = new THREE.Vector3();

// Facing N (front door faces north, -Z): local +Z is the front. `baseY`
// (§2.19) lifts the whole structure to its tile's terrain level (0 when flat).
function frontMatrix(def, x, z, w, d, baseY) {
  const m = new THREE.Matrix4().makeRotationY(Math.PI);
  m.setPosition(x * T + (w * T) / 2, baseY || 0, z * T + (d * T) / 2);
  return m;
}

function buildingColliders(def, colliders, id, x, z, w, d, h, baseY) {
  colliders.push({ type: 'box', minX: x * T, maxX: (x + w) * T, minZ: z * T, maxZ: (z + d) * T, h: (baseY || 0) + h });
}

// Returns { flagGeo, flagPos }: the school flag's geometry + pole-top position
// (worldBuilder makes one Mesh with the shared world material; main.js waves it).
export function buildBuildings(grid, tm, glow, signQuads, colliders, windowRects, lampPools, mailboxes) {
  buildHouses(grid, tm, glow, signQuads, colliders, windowRects, lampPools, mailboxes);
  // A neighborhood (e.g. the debug terrain map) may omit a school or a depot.
  let flag = null;
  if (tm.def.buildings.some((b) => b.kind === 'school')) flag = buildSchool(grid, tm, glow, signQuads, colliders);
  for (const b of tm.def.buildings.filter((b) => b.kind === 'shop')) buildShop(grid, tm, glow, signQuads, colliders, b);
  if (tm.def.buildings.some((b) => b.kind === 'depot')) buildDepot(grid, tm, glow, signQuads, colliders);
  for (const b of tm.def.buildings.filter((b) => b.kind === 'watertower')) buildWaterTower(grid, tm, glow, signQuads, colliders, b);
  for (const b of tm.def.buildings.filter((b) => b.kind === 'lighthouse')) buildLighthouse(grid, tm, glow, signQuads, colliders, b);
  // M17 §2.18: Old Town landmarks + the market-stall fruit gag.
  for (const b of tm.def.buildings.filter((b) => b.kind === 'clocktower')) buildClockTower(grid, tm, glow, signQuads, colliders, b);
  for (const b of tm.def.buildings.filter((b) => b.kind === 'church')) buildChurch(grid, tm, glow, signQuads, colliders, b);
  for (const b of tm.def.buildings.filter((b) => b.kind === 'marketstall')) buildMarketStall(grid, tm, glow, signQuads, colliders, b);
  parkCars(grid, tm, colliders);
  return flag || { flagGeo: null, flagPos: null };
}

// --- Hollow Elementary: 2 floors, brick, clock over the door, flagpole.
function buildSchool(grid, tm, glow, signQuads, colliders) {
  const b = tm.def.buildings.find((x) => x.kind === 'school');
  const op = new VoxelBuilder(301);
  const gl = new GlowBuilder();
  const W = b.w * T, D = b.d * T, H = 5.8;
  const brick = '#c8553d';
  const baseY = tileBaseY(tm, b.x, b.z);
  const m = frontMatrix(tm.def, b.x, b.z, b.w, b.d, baseY);
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
  const pole = { x: pv.x, y: baseY, z: pv.z }; // plain copy (scratch _v gets reused); §2.19 pole base at the tile level

  // school sign board + glow trim + atlas plate
  op.box(0, 3.6, D / 2 + 0.1, 5.4, 0.9, 0.18, '#f8f4ea', { skipFaces: ['bottom'] });
  gl.box(0, 3.6, D / 2 + 0.02, 5.7, 1.15, 0.1, '#5a5e6e', '#ffd6a5');
  const p = _v.set(0, 3.6, D / 2 + 0.22).applyMatrix4(m);
  // M15a.10: center the quad on the board (board center y = p.y, quad h = 0.7).
  signQuads.push({ rectKey: 'school', x: p.x, y: p.y - 0.35, z: p.z, w: 5.0, h: 0.7, face: [0, 0, -1] });

  ch.opaque.merge(op, m);
  glow.merge(gl, m);
  buildingColliders(tm.def, colliders, b.id, b.x, b.z, b.w, b.d, H + 0.6, baseY);

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
  const baseY = tileBaseY(tm, b.x, b.z);
  const m = frontMatrix(tm.def, b.x, b.z, b.w, b.d, baseY);
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
  // M15a.10: center the quad on the board (board center y = p.y, quad h = 0.7).
  signQuads.push({ rectKey: 'shop:' + b.id, x: p.x, y: p.y - 0.35, z: p.z, w: 3.0, h: 0.7, face: [0, 0, -1] });
  buildingColliders(tm.def, colliders, b.id, b.x, b.z, b.w, b.d, H + 0.3, baseY);
}

// --- Quickbox Distribution Center: teal warehouse, docks, lit sign, 2 vans.
function buildDepot(grid, tm, glow, signQuads, colliders) {
  const b = tm.def.buildings.find((x) => x.kind === 'depot');
  const op = new VoxelBuilder(303);
  const gl = new GlowBuilder();
  const W = b.w * T, D = b.d * T, H = 4.0;
  const baseY = tileBaseY(tm, b.x, b.z);
  const m = frontMatrix(tm.def, b.x, b.z, b.w, b.d, baseY);
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
  signQuads.push({ rectKey: 'depot', x: p.x, y: p.y - 0.55, z: p.z, w: 6.6, h: 1.1, face: [0, 0, -1] });
  buildingColliders(tm.def, colliders, b.id, b.x, b.z, b.w, b.d, H + 0.8, baseY);

  // 2 parked Quickbox vans in the lot in front of the docks.
  addVan(grid, tm, b.x + 2, b.z - 1, 311, signQuads, colliders);
  addVan(grid, tm, b.x + 4, b.z - 1, 312, signQuads, colliders);
}

// One parked van (brand cab + cargo box with logo quads) on a lot tile, built
// in world coords and merged into the owning chunk.
function addVan(grid, tm, tx, tz, seed, signQuads, colliders) {
  const op = new VoxelBuilder(seed);
  const wx = tm.cx(tx), wz = tm.cz(tz);
  const baseY = tileBaseY(tm, tx, tz); // §2.19: the lot tile's terrain level
  op.yOff = baseY;
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
  signQuads.push({ rectKey: 'logo', x: wx - 1.17, y: baseY + 0.9, z: wz + 1.1, w: 1.5, h: 0.94, face: [-1, 0, 0] });
  signQuads.push({ rectKey: 'logo', x: wx + 1.17, y: baseY + 0.9, z: wz + 1.1, w: 1.5, h: 0.94, face: [1, 0, 0] });
  colliders.push({ type: 'box', minX: wx - 1.3, maxX: wx + 1.3, minZ: wz - 2.4, maxZ: wz + 2.4, h: baseY + 2.9 });
}

// --- Cedar Heights: a hilltop water tower (concrete legs + tank) with an
// overlook bench. A landmark, so it's taller than the houses and its tank
// window glows at night.
function buildWaterTower(grid, tm, glow, signQuads, colliders, b) {
  const op = new VoxelBuilder(320);
  const gl = new GlowBuilder();
  const W = b.w * T, D = b.d * T;
  const baseY = tileBaseY(tm, b.x, b.z);
  const m = frontMatrix(tm.def, b.x, b.z, b.w, b.d, baseY);
  const ch = grid.chunkAt(b.x, b.z);
  const legH = 6.0;
  const concrete = PALETTE.roof[5];
  const lx = W / 2 - 0.8, lz = D / 2 - 0.8;
  for (const sx of [-1, 1]) for (const sz of [-1, 1])
    op.box(sx * lx, legH / 2, sz * lz, 0.7, legH, 0.7, concrete, { skipFaces: ['bottom'] });
  for (const y of [1.5, 3.0, 4.5]) {
    op.box(0, y, lz, W - 1.6, 0.35, 0.35, concrete);
    op.box(0, y, -lz, W - 1.6, 0.35, 0.35, concrete);
    op.box(lx, y, 0, 0.35, 0.35, D - 1.6, concrete);
    op.box(-lx, y, 0, 0.35, 0.35, D - 1.6, concrete);
  }
  const tankW = W * 0.66, tankH = 3.0, tankY = legH + tankH / 2;
  op.box(0, tankY, 0, tankW, tankH, tankW, PALETTE.trim, { skipFaces: ['bottom'] });
  op.box(0, legH + tankH + 0.25, 0, tankW + 0.4, 0.5, tankW + 0.4, PALETTE.brand, { skipFaces: ['bottom'] });
  op.box(0, legH + tankH + 0.7, 0, tankW * 0.5, 0.6, tankW * 0.5, PALETTE.brand);
  op.box(0, 0.1, D / 2 + 0.4, 0.9, 2.0, 0.1, PALETTE.door[4], { skipFaces: ['bottom'] }); // access door
  gl.box(0, tankY, tankW / 2 + 0.02, 1.4, 1.0, 0.1, PALETTE.windowDay, PALETTE.windowNight);
  ch.opaque.merge(op, m);
  glow.merge(gl, m);
  buildingColliders(tm.def, colliders, b.id, b.x, b.z, b.w, b.d, legH + tankH + 1.2, baseY);
  // overlook bench on the hilltop, just in front of the tower (world coords).
  addBench(grid, tm, b.x + 1, b.z + b.d, colliders);
}

// One overlook bench (wood seat + two legs) sitting on the tile's terrain level.
function addBench(grid, tm, tx, tz, colliders) {
  const op = new VoxelBuilder(321);
  const wx = tm.cx(tx), wz = tm.cz(tz);
  const baseY = tileBaseY(tm, tx, tz);
  op.yOff = baseY;
  const wood = PALETTE.porch;
  op.box(wx, 0.5, wz, 3.0, 0.18, 0.8, wood, { skipFaces: ['bottom'] }); // seat
  op.box(wx, 0.85, wz - 0.5, 3.0, 0.6, 0.14, wood, { skipFaces: ['bottom'] }); // backrest
  for (const s of [-1, 1]) op.box(wx + s * 1.2, 0.25, wz, 0.16, 0.5, 0.7, PALETTE.roof[5], { skipFaces: ['bottom'] });
  grid.chunkAt(tx, tz).opaque.merge(op);
  colliders.push({ type: 'box', minX: wx - 1.6, maxX: wx + 1.6, minZ: wz - 0.9, maxZ: wz + 0.9, h: baseY + 1.4 });
}

// §2.17 M16: the Lakeside landmark — a little lighthouse on the pier. A tapered
// cream tower with red bands, a teal gallery + lantern room, and a lamp that
// glows at dusk (the glow quads carry the day/night window colors).
function buildLighthouse(grid, tm, glow, signQuads, colliders, b) {
  const op = new VoxelBuilder(322);
  const gl = new GlowBuilder();
  const baseY = tileBaseY(tm, b.x, b.z);
  const m = frontMatrix(tm.def, b.x, b.z, b.w, b.d, baseY);
  const ch = grid.chunkAt(b.x, b.z);
  const cream = PALETTE.trim; // '#fffaf0'
  const band = PALETTE.roof[0]; // '#e76f51' red
  const teal = PALETTE.roof[4]; // '#2a9d8f'
  // Tapered tower: four stacked boxes, narrower toward the top.
  const segs = [[1.0, 2.6, 2.0], [2.9, 2.3, 1.8], [4.6, 2.0, 1.7], [6.1, 1.7, 1.5]];
  for (const [y, w, h] of segs) op.box(0, y, 0, w, h, w, cream, { skipFaces: ['bottom'] });
  for (const by of [1.95, 3.75, 5.4]) op.box(0, by, 0, 2.7, 0.3, 2.7, band); // red bands
  const topY = 7.0;
  op.box(0, topY, 0, 2.3, 0.3, 2.3, teal); // gallery deck
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) op.box(sx * 0.95, topY + 0.15, sz * 0.95, 0.14, 0.3, 0.14, teal); // gallery posts
  op.box(0, topY + 0.95, 0, 1.5, 1.4, 1.5, teal); // lantern room
  op.box(0, topY + 1.85, 0, 1.9, 0.3, 1.9, band); // cap
  op.box(0, topY + 2.2, 0, 0.4, 0.7, 0.4, band); // finial
  // Glowing lantern glass (two faces) — reads warm at dusk.
  gl.box(0, topY + 0.95, 0.78, 1.1, 1.0, 0.1, PALETTE.windowDay, PALETTE.windowNight);
  gl.box(0, topY + 0.95, -0.78, 1.1, 1.0, 0.1, PALETTE.windowDay, PALETTE.windowNight);
  ch.opaque.merge(op, m);
  glow.merge(gl, m);
  // Compact collider at the tower base (a full-footprint box would block the pier).
  const cxw = b.x * T + (b.w * T) / 2, czw = b.z * T + (b.d * T) / 2, half = 1.8;
  colliders.push({ type: 'box', minX: cxw - half, maxX: cxw + half, minZ: czw - half, maxZ: czw + half, h: baseY + 9 });
}

// M17 §2.18: Old Town's clock tower — a tall stone tower with a glowing clock
// face + a pyramidal slate cap and finial. It's a landmark (taller than the
// row houses). The hour chime is audio (main.js triggers it on the clock).
function buildClockTower(grid, tm, glow, signQuads, colliders, b) {
  const op = new VoxelBuilder(323);
  const gl = new GlowBuilder();
  const baseY = tileBaseY(tm, b.x, b.z);
  const m = frontMatrix(tm.def, b.x, b.z, b.w, b.d, baseY);
  const ch = grid.chunkAt(b.x, b.z);
  const stone = PALETTE.stone, cap = PALETTE.roof[2]; // slate
  const H = 9.0;
  op.box(0, H / 2, 0, 2.8, H, 2.8, stone, { skipFaces: ['bottom'] }); // the tower body
  op.box(0, H, 0, 3.2, 0.5, 3.2, cap); // cap band
  op.box(0, H + 0.5, 0, 2.4, 0.7, 2.4, cap); // the pyramid base
  op.box(0, H + 1.1, 0, 1.4, 0.6, 1.4, cap);
  op.box(0, H + 1.6, 0, 0.4, 1.2, 0.4, cap); // finial
  // The clock face (front, +Z) glows day/night; hands baked in stone-dark.
  const fy = H - 2.2;
  gl.box(0, fy, 1.42, 1.6, 1.6, 0.1, PALETTE.windowDay, PALETTE.windowNight);
  op.box(0, fy + 0.6, 1.5, 0.4, 0.4, 0.06, '#2f333d'); // the hands' hub
  op.box(0, fy + 0.9, 1.52, 0.09, 0.5, 0.05, '#2f333d'); // minute hand
  op.box(0.35, fy + 0.4, 1.52, 0.4, 0.09, 0.05, '#2f333d'); // hour hand
  op.box(0, 0.4, 1.44, 1.2, 1.8, 0.1, PALETTE.door[4], { skipFaces: ['bottom'] }); // entrance door
  ch.opaque.merge(op, m);
  glow.merge(gl, m);
  buildingColliders(tm.def, colliders, b.id, b.x, b.z, b.w, b.d, H + 2.4, baseY);
}

// M17 §2.18: the old chapel on the town's low rise — a stone nave with a tall
// steeple + a cross, and arched windows that glow at night.
function buildChurch(grid, tm, glow, signQuads, colliders, b) {
  const op = new VoxelBuilder(324);
  const gl = new GlowBuilder();
  const baseY = tileBaseY(tm, b.x, b.z);
  const m = frontMatrix(tm.def, b.x, b.z, b.w, b.d, baseY);
  const ch = grid.chunkAt(b.x, b.z);
  const W = b.w * T, D = b.d * T;
  const stone = PALETTE.stone, roof = PALETTE.roof[2]; // slate
  const naveH = 4.6;
  op.box(0, naveH / 2, 0, W - 0.8, naveH, D - 0.8, stone, { skipFaces: ['bottom'] }); // nave
  op.box(0, naveH + 1.1, -D / 2 + 1.4, W - 0.8, 2.2, D - 1.6, roof, { skipFaces: ['bottom'] }); // nave roof
  // The steeple (tall tower + spire) on the front-left corner.
  const sx = -W / 2 + 1.6, sz = D / 2 - 1.6, spH = 7.5;
  op.box(sx, spH / 2, sz, 2.2, spH, 2.2, stone, { skipFaces: ['bottom'] });
  op.box(sx, spH + 0.9, sz, 2.6, 1.8, 2.6, roof); // spire base
  op.box(sx, spH + 2.0, sz, 1.6, 1.2, 1.6, roof);
  op.box(sx, spH + 2.9, sz, 0.3, 1.4, 0.3, roof); // finial
  op.box(sx + 0.9, spH + 3.6, sz, 0.3, 0.9, 0.9, PALETTE.trim); // the cross (vertical + arm)
  op.box(sx + 0.9, spH + 3.9, sz, 0.9, 0.3, 0.3, PALETTE.trim);
  // Arched nave windows (glow) + the steeple bell window.
  for (let i = -1; i <= 1; i++) gl.box(i * (W / 4), 2.4, D / 2 - 0.4, 1.1, 1.6, 0.1, PALETTE.windowDay, PALETTE.windowNight);
  gl.box(sx, spH - 1.4, sz + 1.12, 0.9, 1.1, 0.1, PALETTE.windowDay, PALETTE.windowNight);
  // Entrance doors + steps on the front.
  op.box(W / 4, 0.5, D / 2 - 0.2, 1.4, 2.4, 0.1, PALETTE.door[1], { skipFaces: ['bottom'] });
  ch.opaque.merge(op, m);
  glow.merge(gl, m);
  buildingColliders(tm.def, colliders, b.id, b.x, b.z, b.w, b.d, spH + 4.2, baseY);
}

// M17 §2.18: the market stall — the unique gag. A low wooden counter with a
// striped awning + a row of colorful fruit crates on top (bowl into fruit, +heat).
// The fruit-crate "break" + burst is driven by gameplay/marketGag.js (the crate
// tops sit at a known offset this module records via `signQuads`-free data).
function buildMarketStall(grid, tm, glow, signQuads, colliders, b) {
  const op = new VoxelBuilder(325 + (b.x % 7));
  const baseY = tileBaseY(tm, b.x, b.z);
  const m = frontMatrix(tm.def, b.x, b.z, b.w, b.d, baseY);
  const ch = grid.chunkAt(b.x, b.z);
  const W = b.w * T, D = b.d * T;
  const wood = PALETTE.porch, accent = b.accent || PALETTE.roof[0];
  const counterH = 1.1;
  op.box(0, counterH / 2, 0, W - 0.4, counterH, D - 0.4, wood, { skipFaces: ['bottom'] }); // counter
  op.box(0, counterH + 0.05, 0, W - 0.2, 0.1, D - 0.2, PALETTE.roof[5]); // counter top
  // 3 fruit crates on the counter (the colorful "fruit everywhere" payoff).
  const fruits = ['#e63946', '#f4a261', '#ffd166', '#57cc99'];
  for (let i = 0; i < 3; i++) {
    const fx = -W / 2 + 1.2 + i * (W - 2.4) / 2;
    op.box(fx, counterH + 0.4, 0, 1.1, 0.7, 1.1, fruits[(i + b.x) % fruits.length], { skipFaces: ['bottom'] });
  }
  // The striped awning overhanging the front + two support posts.
  for (let i = 0; i < 4; i++) op.box(-W / 2 + (i + 0.5) * (W / 4), counterH + 0.9, D / 2 - 0.2, W / 4 - 0.1, 0.12, 1.6, i % 2 ? accent : PALETTE.trim, { skipFaces: ['bottom'] });
  for (const s of [-1, 1]) op.box(s * (W / 2 - 0.3), counterH / 2, D / 2 - 0.5, 0.2, counterH + 0.4, 0.2, wood, { skipFaces: ['bottom'] });
  ch.opaque.merge(op, m);
  buildingColliders(tm.def, colliders, b.id, b.x, b.z, b.w, b.d, counterH + 1.0, baseY);
}
