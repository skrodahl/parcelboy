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

function reeds(b, wx, wz, rng) {
  for (let i = 0; i < 4; i++) {
    const a = rng() * 6.28, r = rng() * 0.5;
    b.box(wx + Math.cos(a) * r, 0, wz + Math.sin(a) * r, 0.06, 0.5 + rng() * 0.4, 0.06, PALETTE.canopy[2], { skipFaces: ['bottom'] });
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

// Benches + reeds ringing the pond.
function pondProps(grid, tm) {
  const p = tm.def.pond;
  if (!p) return;
  const rng = mulberry32(555);
  const b = grid.chunkAt(p.x, p.z).opaque;
  bench(b, tm.cx(p.x + 1), tm.cz(p.z - 1), 0, 0);
  bench(b, tm.cx(p.x + p.w - 1), tm.cz(p.z + p.d), 0, Math.PI / 2);
  reeds(b, tm.cx(p.x - 1), tm.cz(p.z + p.d - 1), rng);
  reeds(b, tm.cx(p.x + p.w), tm.cz(p.z), rng);
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
