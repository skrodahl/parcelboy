import { VoxelBuilder } from '../render/voxel.js';
import { PALETTE } from '../data/palette.js';
import { mulberry32 } from '../core/rng.js';

// Builds the static ground (tiles, curbs, road lines, crosswalks, parking,
// pond, forest + tree canopies) into the chunk grid's opaque/water builders.
// All geometry is boxes merged per chunk (§8). A tiny per-tile checkerboard
// depth offset keeps coplanar, jittered top faces from z-fighting.

const T = 4;
const SLAB_BASE = -0.4; // slab bottom (hides the underside; forms the diorama skirt)
const TOP_OFF = 0.005;  // checkerboard top-face offset (< a pixel, beats z-fight)

// Per-tile-key base color.
function tileColor(key, x, z) {
  switch (key) {
    case 'forest':   return PALETTE.grassDark;
    case 'yard':     return ((x + z) & 1) ? PALETTE.grass[0] : PALETTE.grass[1];
    case 'road':     return PALETTE.road;
    case 'sidewalk': return PALETTE.sidewalk;
    case 'porch':    return PALETTE.porch;
    case 'driveway': return PALETTE.driveway;
    case 'house':
    case 'building': return PALETTE.grass[1];
    case 'tree':     return PALETTE.grass[0];
    case 'park':     return PALETTE.park;
    case 'path':     return PALETTE.parkPath;
    case 'pond':     return PALETTE.waterEdge; // basin reads as a light rim under the water
    case 'lot':      return PALETTE.lot;
    default:         return PALETTE.grass[0];
  }
}

function addSlab(b, tm, x, z) {
  const key = tm.keyAt(x, z);
  const h = tm.surfH(key);
  const off = ((x + z) & 1) ? TOP_OFF : 0;
  const top = h + off;
  b.box(tm.cx(x), SLAB_BASE, tm.cz(z), T, top - SLAB_BASE, T, tileColor(key, x, z), { skipFaces: ['bottom'] });
}

// One tree = trunk + 1-2 canopy boxes. `forest` canopies are denser/darker.
function addTree(b, wx, wz, rng, forest) {
  const s = 0.8 + rng() * 0.6;
  const h = (forest ? 2.4 : 1.9) * s;
  b.box(wx, 0, wz, 0.3 * s, h, 0.3 * s, PALETTE.trunk, { skipFaces: ['bottom'] });
  const palette = forest ? PALETTE.canopyForest : PALETTE.canopy;
  const col = palette[(rng() * palette.length) | 0];
  const cw = (forest ? 1.7 : 2.3) * s;
  b.box(wx, h - 0.4, wz, cw, 1.5 * s, cw, col, { skipFaces: ['bottom'] });
  if (rng() < 0.55) b.box(wx + 0.5, h + 0.3, wz + 0.3, cw * 0.7, 0.9 * s, cw * 0.7, col, { skipFaces: ['bottom'] });
}

export function buildGround(grid, tm, colliders) {
  const { width, height } = tm;
  const seed = 40 + (tm.def.id.charCodeAt(0) || 0);

  // 1) Base slabs + trees on every tile; record solid-tile and tree colliders.
  for (let z = 0; z < height; z++) {
    for (let x = 0; x < width; x++) {
      const ch = grid.chunkAt(x, z);
      addSlab(ch.opaque, tm, x, z);
      const key = tm.keyAt(x, z);
      if (key === 'tree') {
        const rng = mulberry32(seed * 131 + x * 7 + z * 131);
        addTree(ch.opaque, tm.cx(x), tm.cz(z), rng, false);
        if (colliders) colliders.push({ type: 'circle', x: tm.cx(x), z: tm.cz(z), r: 0.6 });
      } else if (key === 'forest') {
        const rng = mulberry32(seed * 131 + x * 7 + z * 131);
        addTree(ch.opaque, tm.cx(x) - 1 + rng() * 2, tm.cz(z) - 1 + rng() * 2, rng, true);
        addTree(ch.opaque, tm.cx(x) + 1 - rng() * 2, tm.cz(z) + 1 - rng() * 2, rng, true);
        if (colliders) colliders.push({ type: 'box', minX: tm.minX(x), maxX: tm.minX(x) + T, minZ: tm.minZ(z), maxZ: tm.minZ(z) + T });
      } else if (key === 'pond') {
        if (colliders) colliders.push({ type: 'box', minX: tm.minX(x), maxX: tm.minX(x) + T, minZ: tm.minZ(z), maxZ: tm.minZ(z) + T });
      }
    }
  }

  addRoadLines(grid, tm);
  addCrosswalks(grid, tm);
  addParkingLines(grid, tm);
  addPond(grid, tm);
  return grid;
}

// Dashed yellow center lines from `roads` (§6.3): dash 1.5 / gap 1.5, skipped
// inside intersections and the Willow Court bulb.
function roadIntersections(def) {
  const set = new Set();
  const hRoads = def.roads.filter((r) => r.axis === 'x');
  const vRoads = def.roads.filter((r) => r.axis === 'z');
  for (const h of hRoads) for (const v of vRoads) {
    for (let dx = 0; dx < 2; dx++) for (let dz = 0; dz < 2; dz++) set.add((v.x + dx) + ',' + (h.z + dz));
  }
  return set;
}

function inRect(def, x, z) {
  const bulb = def.roads.find((r) => r.bulb).bulb;
  return x >= bulb.x && x < bulb.x + bulb.w && z >= bulb.z && z < bulb.z + bulb.d;
}

function addRoadLines(grid, tm) {
  const def = tm.def;
  const inter = roadIntersections(def);
  const line = PALETTE.roadLine;
  const yTop = 0.012; // just above the road surface
  const skip = (tx, tz) => inter.has(tx + ',' + tz) || inRect(def, tx, tz);

  for (const r of def.roads) {
    if (r.axis === 'x') {
      const wz = (r.z + 1) * T;
      const xStart = r.x0 * T;
      const xEnd = (r.x1 + 1) * T;
      for (let cx = xStart + 0.75; cx + 1.5 <= xEnd; cx += 3.0) {
        const tx = Math.floor((cx + 0.75) / T);
        if (skip(tx, r.z) || skip(tx, r.z + 1)) continue;
        const b = grid.chunkAt(tx, r.z).opaque;
        b.box(cx + 0.75, yTop, wz, 1.5, 0.02, 0.25, line, { skipFaces: ['bottom', 'top'] });
      }
    } else {
      const wx = (r.x + 1) * T;
      const zStart = r.z0 * T;
      const zEnd = (r.z1 + 1) * T;
      for (let cz = zStart + 0.75; cz + 1.5 <= zEnd; cz += 3.0) {
        const tz = Math.floor((cz + 0.75) / T);
        if (skip(r.x, tz) || skip(r.x + 1, tz)) continue;
        const b = grid.chunkAt(r.x, tz).opaque;
        b.box(wx, yTop, cz + 0.75, 0.25, 0.02, 1.5, line, { skipFaces: ['bottom', 'top'] });
      }
    }
  }
}

// White zebra crosswalks on the four road tiles just outside each intersection.
function addCrosswalks(grid, tm) {
  const def = tm.def;
  const hRoads = def.roads.filter((r) => r.axis === 'x');
  const vRoads = def.roads.filter((r) => r.axis === 'z');
  const white = PALETTE.crosswalk;
  const yTop = 0.012;
  for (const h of hRoads) for (const v of vRoads) {
    const ix = v.x, iz = h.z; // top-left of the 2x2 intersection
    const n = 4; // stripes across a 2-tile (8u) road width
    const lane = (2 * T) / n;
    const stripe = (b, wx, wz, horizontal) => {
      for (let i = 0; i < n; i++) {
        const off = (i - n / 2) * lane;
        if (horizontal) b.box(wx + off, yTop, wz, lane * 0.5, 0.02, 1.2, white, { skipFaces: ['bottom', 'top'] });
        else b.box(wx, yTop, wz + off, 1.2, 0.02, lane * 0.5, white, { skipFaces: ['bottom', 'top'] });
      }
    };
    const vcx = (ix + 1) * T; // vertical road center X (spans cols ix,ix+1)
    const hcz = (iz + 1) * T; // horizontal road center Z (spans rows iz,iz+1)
    // North + south: cross the vertical road (stripes span X), at rows iz-1 / iz+2.
    stripe(grid.chunkAt(ix, iz - 1).opaque, vcx, tm.cz(iz - 1), true);
    stripe(grid.chunkAt(ix, iz + 2).opaque, vcx, tm.cz(iz + 2), true);
    // West + east: cross the horizontal road (stripes span Z), at cols ix-2 / ix+2.
    stripe(grid.chunkAt(ix - 2, iz).opaque, tm.cx(ix - 2), hcz, false);
    stripe(grid.chunkAt(ix + 2, iz).opaque, tm.cx(ix + 2), hcz, false);
  }
}

// White parking-stall lines along row 34 of the lot (§6.2 `L`).
function addParkingLines(grid, tm) {
  const def = tm.def;
  const white = PALETTE.lotLine;
  const yTop = 0.012;
  // Lot tiles: find the contiguous `L` run on row 34 from the map.
  const z = 34;
  let x0 = -1, x1 = -1;
  for (let x = 0; x < tm.width; x++) {
    if (tm.keyAt(x, z) === 'lot') { if (x0 < 0) x0 = x; x1 = x; }
    else if (x0 >= 0) break;
  }
  if (x0 < 0) return;
  const count = 6; // stalls
  const w = (x1 - x0 + 1) * T;
  const wx0 = x0 * T + w / (count * 2);
  for (let i = 0; i <= count; i++) {
    const tx = x0 + Math.floor((i / count) * (x1 - x0 + 1));
    const b = grid.chunkAt(Math.max(x0, Math.min(tx, x1)), z).opaque;
    b.box(wx0 + (i / count) * w, yTop, tm.minZ(z) + 0.6, 0.14, 0.02, 2.6, white, { skipFaces: ['bottom', 'top'] });
  }
  void def;
}

// Pond: a translucent water plane per chunk that contains `W` tiles, with a
// brighter rim already painted by the basin slabs.
function addPond(grid, tm) {
  const { def } = tm;
  const p = def.pond;
  if (!p) return;
  const water = new VoxelBuilder(999);
  const top = 0.05;
  for (let dz = 0; dz < p.d; dz++) {
    for (let dx = 0; dx < p.w; dx++) {
      const x = p.x + dx, z = p.z + dz;
      if (tm.keyAt(x, z) !== 'pond') continue;
      water.box(tm.cx(x), top, tm.cz(z), T, 0.02, T, PALETTE.water, { skipFaces: ['bottom', 'top'] });
    }
  }
  const ch = grid.chunkAt(p.x, p.z);
  ch.water = water;
}
