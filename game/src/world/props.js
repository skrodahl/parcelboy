import { PALETTE } from '../data/palette.js';
import { mulberry32 } from '../core/rng.js';
import { tileBaseY } from './terrain.js';

// Static props (§6.2 / §7.3): sidewalk lamps, hydrants, benches + reeds by the
// pond, and the playground set. All are boxes merged into the chunk's opaque
// builder so they add no draw calls.

const T = 4;
const Y = 0.0; // props sit on the raised sidewalk (0.12) where placed; base given per call

function lamp(b, wx, wz, baseY) {
  b.box(wx, baseY, wz, 0.14, 2.6, 0.14, '#4a4e69', { skipFaces: ['bottom'] });
  b.box(wx, baseY + 2.55, wz, 0.5, 0.28, 0.5, '#2f333d', { skipFaces: ['bottom'] });
}

function hydrant(b, wx, wz, baseY) {
  b.box(wx, baseY, wz, 0.4, 0.7, 0.4, '#ef476f', { skipFaces: ['bottom'] });
  b.box(wx, baseY + 0.7, wz, 0.5, 0.12, 0.5, '#ffd166', { skipFaces: ['bottom'] });
}

function bench(b, wx, wz, baseY, rotZ) {
  const c = rotZ === 0;
  const w = c ? 1.6 : 0.5, d = c ? 0.5 : 1.6;
  b.box(wx, baseY + 0.25, wz, w, 0.12, d, PALETTE.porch, { skipFaces: ['bottom'] });
  b.box(wx, baseY + 0.55, wz, w * 0.9, 0.4, 0.1, PALETTE.porch, { skipFaces: ['bottom'] });
  b.box(wx - (c ? w / 2 : 0) * 0.8, baseY, wz - (c ? 0 : d / 2) * 0.8, 0.12, 0.25, 0.12, PALETTE.trunk, { skipFaces: ['bottom'] });
}

function reeds(b, wx, wz, rng, baseY) {
  for (let i = 0; i < 4; i++) {
    const a = rng() * 6.28, r = rng() * 0.5;
    const h = 0.5 + rng() * 0.4;
    b.box(wx + Math.cos(a) * r, baseY, wz + Math.sin(a) * r, 0.06, h, 0.06, PALETTE.canopy[2], { skipFaces: ['bottom'] });
    // M15a.14: every other stem is a cattail (a brown seed head on top).
    if (i % 2 === 0) b.box(wx + Math.cos(a) * r, baseY + h - 0.04, wz + Math.sin(a) * r, 0.1, 0.22, 0.1, PALETTE.trunk, { skipFaces: ['bottom'] });
  }
}

// Every 5th sidewalk tile around a loop gets a lamp, alternating side.
// Positions are returned so lamp light pools (§7.3) can sit under the same lamps.
export function sidewalkLampPositions(tm) {
  const rng = mulberry32(777);
  const out = [];
  if (!tm.def.sidewalkLoops) return out;
  for (const key of Object.keys(tm.def.sidewalkLoops)) {
    const L = tm.def.sidewalkLoops[key];
    const pts = [];
    for (let x = L.x0; x <= L.x1; x++) pts.push([x, L.z0]);
    for (let z = L.z0 + 1; z <= L.z1; z++) pts.push([L.x1, z]);
    for (let x = L.x1 - 1; x >= L.x0; x--) pts.push([x, L.z1]);
    for (let z = L.z1 - 1; z > L.z0; z--) pts.push([L.x0, z]);
    let flip = 0;
    for (let i = 0; i < pts.length; i += 5) {
      const [x, z] = pts[i];
      if (tm.keyAt(x, z) !== 'sidewalk') continue;
      const side = (flip++ % 2 === 0) ? 1 : -1;
      out.push({ tx: x, tz: z, wx: tm.cx(x) + side * 0.7 + (rng() - 0.5) * 0.2, wz: tm.cz(z) + side * 0.7 + (rng() - 0.5) * 0.2 });
    }
  }
  return out;
}

function sidewalkLamps(grid, tm, colliders) {
  for (const p of sidewalkLampPositions(tm)) {
    lamp(grid.chunkAt(p.tx, p.tz).opaque, p.wx, p.wz, tileBaseY(tm, p.tx, p.tz) + 0.12); // §2.19
    if (colliders) colliders.push({ type: 'circle', x: p.wx, z: p.wz, r: 0.25 });
  }
}

// A hydrant at the near corner of every 4-way intersection.
function hydrants(grid, tm, colliders) {
  if (!tm.def.roads) return;
  const h = tm.def.roads.filter((r) => r.axis === 'x');
  const v = tm.def.roads.filter((r) => r.axis === 'z');
  for (const a of h) for (const b of v) {
    const wx = tm.cx(b.x - 1), wz = tm.cz(a.z - 1);
    hydrant(grid.chunkAt(b.x - 1, a.z - 1).opaque, wx, wz, tileBaseY(tm, b.x - 1, a.z - 1) + 0.12); // §2.19
    if (colliders) colliders.push({ type: 'circle', x: wx, z: wz, r: 0.25 });
  }
}

// M15a.14: the natural pond edge - rounded stones ringing the basin, rock +
// grass blocks filling the rectangle corners (so the outline isn't a
// rectangle), reeds/cattails, lily pads, and a small wooden dock on the north
// side. The water tiles are no longer colliders (the courier can dunk).
function stoneRing(b, tm, p, baseY) {
  const rng = mulberry32(555);
  // Rocks + grass blocks filling the four rectangle corners (rounds the outline).
  for (const [cx, cz] of [[p.x, p.z], [p.x + p.w - 1, p.z], [p.x, p.z + p.d - 1], [p.x + p.w - 1, p.z + p.d - 1]]) {
    b.box(tm.cx(cx), baseY, tm.cz(cz), T * 0.7, 0.35, T * 0.7, PALETTE.stone, { skipFaces: ['bottom'] });
    b.box(tm.cx(cx) + 0.4, baseY + 0.2, tm.cz(cz) + 0.4, T * 0.5, 0.25, T * 0.5, PALETTE.grass[0], { skipFaces: ['bottom'] });
  }
  // A ring of small rounded stones just outside the basin edge.
  for (let z = p.z - 1; z <= p.z + p.d; z++) for (let x = p.x - 1; x <= p.x + p.w; x++) {
    const inRect = x >= p.x && x < p.x + p.w && z >= p.z && z < p.z + p.d;
    if (inRect) continue;
    let adj = false;
    for (let a = 0; a < 4; a++) {
      const nx = x + (a === 0 ? 1 : a === 1 ? -1 : 0), nz = z + (a === 2 ? 1 : a === 3 ? -1 : 0);
      if (nx >= p.x && nx < p.x + p.w && nz >= p.z && nz < p.z + p.d) adj = true;
    }
    if (!adj) continue;
    const wx = tm.cx(x) + (rng() - 0.5) * 1.5, wz = tm.cz(z) + (rng() - 0.5) * 1.5;
    b.box(wx, baseY, wz, 0.5 + rng() * 0.4, 0.3, 0.5 + rng() * 0.4, PALETTE.stone, { skipFaces: ['bottom'] });
  }
}
function lilyPads(b, tm, p, waterY) {
  const rng = mulberry32(556);
  for (let i = 0; i < 5; i++) {
    const x = p.x + 0.5 + rng() * (p.w - 1), z = p.z + 0.5 + rng() * (p.d - 1);
    b.box(tm.cx(x), waterY + 0.02, tm.cz(z), 0.7, 0.05, 0.7, PALETTE.canopy[1], { skipFaces: ['bottom'] }); // a pad
    b.box(tm.cx(x), waterY + 0.06, tm.cz(z), 0.12, 0.12, 0.12, PALETTE.canopy[0], { skipFaces: ['bottom'] }); // a leaf bump
  }
}
function dock(b, tm, p, baseY) {
  // A small wooden dock on the north side, reaching into the water.
  const wx = tm.minX(p.x) + (p.w * T) / 2, wz = tm.cz(p.z - 0.6);
  b.box(wx, baseY, wz, 0.9, 0.12, 3.2, PALETTE.porch, { skipFaces: ['bottom'] }); // planks
  b.box(wx - 0.45, baseY, wz + 1.2, 0.12, 0.5, 0.12, PALETTE.trunk, { skipFaces: ['bottom'] }); // posts
  b.box(wx + 0.45, baseY, wz + 1.2, 0.12, 0.5, 0.12, PALETTE.trunk, { skipFaces: ['bottom'] });
}
function pondProps(grid, tm) {
  const p = tm.def.pond;
  if (!p) return;
  const rng = mulberry32(555);
  const b = grid.chunkAt(p.x, p.z).opaque;
  const baseY = tileBaseY(tm, p.x, p.z);
  const waterY = baseY - 0.2; // matches addPond
  stoneRing(b, tm, p, baseY);
  lilyPads(b, tm, p, waterY);
  dock(b, tm, p, baseY);
  bench(b, tm.cx(p.x + 1), tm.cz(p.z - 1), baseY, 0);
  bench(b, tm.cx(p.x + p.w - 1), tm.cz(p.z + p.d), baseY, Math.PI / 2);
  reeds(b, tm.cx(p.x - 1), tm.cz(p.z + p.d - 1), rng, baseY);
  reeds(b, tm.cx(p.x + p.w), tm.cz(p.z), rng, baseY);
  reeds(b, tm.cx(p.x + 2), tm.cz(p.z + p.d), rng, baseY); // M15a.14: a third clump, south side
}

// Playground set (§6.1): sandbox base, a swing frame, a slide, and a spring rider.
function playground(grid, tm) {
  const pg = tm.def.playground;
  if (!pg) return;
  const b = grid.chunkAt(pg.x, pg.z).opaque;
  const x0 = tm.minX(pg.x), z0 = tm.minZ(pg.z);
  const w = pg.w * T, d = pg.d * T;
  const baseY = tileBaseY(tm, pg.x, pg.z); // §2.19
  b.box(x0 + w / 2, baseY, z0 + d / 2, w, 0.12, d, PALETTE.parkPath, { skipFaces: ['bottom', 'top'] });
  // swing frame
  const sx = x0 + w * 0.25, sz = z0 + d * 0.5;
  b.box(sx - 1.2, baseY, sz, 0.2, 1.6, 0.2, PALETTE.brandAccent, { skipFaces: ['bottom'] });
  b.box(sx + 1.2, baseY, sz, 0.2, 1.6, 0.2, PALETTE.brandAccent, { skipFaces: ['bottom'] });
  b.box(sx, baseY + 1.5, sz, 2.6, 0.2, 0.2, PALETTE.brandAccent, { skipFaces: ['bottom'] });
  // slide
  const lx = x0 + w * 0.7, lz = z0 + d * 0.3;
  b.box(lx - 0.8, baseY, lz, 0.3, 1.2, 0.3, PALETTE.door[1], { skipFaces: ['bottom'] });
  b.box(lx + 0.4, baseY + 0.4, lz, 1.6, 0.12, 0.6, PALETTE.door[1], { skipFaces: ['bottom'] });
  // spring rider
  const rx = x0 + w * 0.55, rz = z0 + d * 0.7;
  b.box(rx, baseY, rz, 0.5, 0.3, 0.5, PALETTE.door[3], { skipFaces: ['bottom'] });
  b.box(rx, baseY + 0.3, rz, 0.16, 0.7, 0.16, PALETTE.brand, { skipFaces: ['bottom'] });
}

export function buildProps(grid, tm, colliders) {
  sidewalkLamps(grid, tm, colliders);
  hydrants(grid, tm, colliders);
  pondProps(grid, tm);
  playground(grid, tm);
  return grid;
}
