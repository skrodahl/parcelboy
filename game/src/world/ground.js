import { VoxelBuilder } from '../render/voxel.js';
import { PALETTE } from '../data/palette.js';
import { mulberry32 } from '../core/rng.js';

// Builds the static ground (tiles, curbs, road lines, crosswalks, parking,
// pond, forest + tree canopies, and the §2.19 terrain features: ramps, stairs
// and retaining walls) into the chunk grid's opaque/water builders. All
// geometry is boxes merged per chunk (§8). A tiny per-tile checkerboard depth
// offset keeps coplanar, jittered top faces from z-fighting.
//
// §2.19: every tile's geometry is lifted to its terrain level (`baseY`). A
// flat neighborhood (no heights) has baseY = 0 everywhere, so the output is
// identical to the original flat world.

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

// §2.19: the terrain level height (units) under tile (x,z); 0 when flat.
function terrainBaseY(tm, x, z) {
  const tr = tm.terrain;
  return tr ? tr.levelAt(x, z) * tr.LEVEL_H : 0;
}

function addSlab(b, tm, x, z) {
  const key = tm.keyAt(x, z);
  const baseY = terrainBaseY(tm, x, z);
  const h = tm.surfH(key);
  const off = ((x + z) & 1) ? TOP_OFF : 0;
  const top = baseY + h + off;
  b.box(tm.cx(x), SLAB_BASE, tm.cz(z), T, top - SLAB_BASE, T, tileColor(key, x, z), { skipFaces: ['bottom'] });
}

// One tree = trunk + 1-2 canopy boxes, raised to its tile's terrain level.
function addTree(b, wx, wz, rng, forest, baseY) {
  const s = 0.8 + rng() * 0.6;
  const h = (forest ? 2.4 : 1.9) * s;
  b.box(wx, baseY, wz, 0.3 * s, h, 0.3 * s, PALETTE.trunk, { skipFaces: ['bottom'] });
  const palette = forest ? PALETTE.canopyForest : PALETTE.canopy;
  const col = palette[(rng() * palette.length) | 0];
  const cw = (forest ? 1.7 : 2.3) * s;
  b.box(wx, baseY + h - 0.4, wz, cw, 1.5 * s, cw, col, { skipFaces: ['bottom'] });
  if (rng() < 0.55) b.box(wx + 0.5, baseY + h + 0.3, wz + 0.3, cw * 0.7, 0.9 * s, cw * 0.7, col, { skipFaces: ['bottom'] });
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
      const baseY = terrainBaseY(tm, x, z);
      if (key === 'tree') {
        const rng = mulberry32(seed * 131 + x * 7 + z * 131);
        addTree(ch.opaque, tm.cx(x), tm.cz(z), rng, false, baseY);
        if (colliders) colliders.push({ type: 'circle', x: tm.cx(x), z: tm.cz(z), r: 0.6 });
      } else if (key === 'forest') {
        const rng = mulberry32(seed * 131 + x * 7 + z * 131);
        addTree(ch.opaque, tm.cx(x) - 1 + rng() * 2, tm.cz(z) - 1 + rng() * 2, rng, true, baseY);
        addTree(ch.opaque, tm.cx(x) + 1 - rng() * 2, tm.cz(z) + 1 - rng() * 2, rng, true, baseY);
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
  buildTerrainFeatures(grid, tm);
  return grid;
}

// §2.19 terrain features: ramps/stairs (voxel steps) + retaining walls. Only
// present on hilly neighborhoods; a flat map adds nothing.
function buildTerrainFeatures(grid, tm) {
  const tr = tm.terrain;
  if (!tr || !tr.hasHills) return;
  const { width, height } = tm;
  const L = tr.LEVEL_H;
  const H = tr.raw;
  const isSlope = (c) => c === '/' || c === '=';

  // Ramps/stairs: four voxel steps climbing from the low level to the high one.
  for (let z = 0; z < height; z++) for (let x = 0; x < width; x++) {
    const c = H[z][x];
    if (!isSlope(c)) continue;
    const lowL = tr.levelAt(x, z);
    const ax = tr.slopeAxis[z * width + x];
    const up = tr.slopeUp[z * width + x];
    const b = grid.chunkAt(x, z).opaque;
    const color = c === '=' ? PALETTE.rampConcrete : PALETTE.road;
    const steps = 4;
    const stepH = L / steps;
    for (let i = 0; i < steps; i++) {
      // band index (which 1-tile slice of the tile is lowest): 0 = lowest.
      const band = up === 0 ? i : steps - 1 - i;
      const top = lowL * L + (band + 1) * stepH;
      if (ax === 0) b.box(tm.cx(x + band), lowL * L, tm.cz(z), T, top - lowL * L, T, color, { skipFaces: ['bottom'] });
      else b.box(tm.cx(x), lowL * L, tm.cz(z + band), T, top - lowL * L, T, color, { skipFaces: ['bottom'] });
    }
  }

  // Retaining walls: a stone block on a tile's edge whenever that edge faces a
  // LOWER tile (the drop-off) with no ramp/stairs bridge. Built on the high
  // tile's own edge so each wall is placed exactly once.
  const wallColor = PALETTE.stone;
  const thick = 0.4;
  for (let z = 0; z < height; z++) for (let x = 0; x < width; x++) {
    if (isSlope(H[z][x])) continue;
    const la = tr.levelAt(x, z);
    for (let d = 0; d < 4; d++) {
      const dx = d === 0 ? 1 : d === 1 ? -1 : 0;
      const dz = d === 2 ? 1 : d === 3 ? -1 : 0;
      const nx = x + dx, nz = z + dz;
      if (nx < 0 || nz < 0 || nx >= width || nz >= height) continue;
      if (isSlope(H[nz][nx])) continue; // a ramp/stairs bridges this edge
      const lb = tr.levelAt(nx, nz);
      if (lb >= la) continue; // neighbor not lower → the drop-off is on their side
      // Wall on this (high) tile's edge facing the low neighbor.
      const b = grid.chunkAt(x, z).opaque;
      const y0 = lb * L, hgt = (la - lb) * L;
      if (dx === 1) b.box((x + 1) * T - thick / 2, y0, z * T + T / 2, thick, hgt, T, wallColor);
      else if (dx === -1) b.box(x * T + thick / 2, y0, z * T + T / 2, thick, hgt, T, wallColor);
      else if (dz === 1) b.box(x * T + T / 2, y0, (z + 1) * T - thick / 2, T, hgt, thick, wallColor);
      else b.box(x * T + T / 2, y0, z * T + thick / 2, T, hgt, thick, wallColor);
    }
  }
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
  const skip = (tx, tz) => inter.has(tx + ',' + tz) || inRect(def, tx, tz);

  for (const r of def.roads) {
    if (r.axis === 'x') {
      const wz = (r.z + 1) * T;
      const xStart = r.x0 * T;
      const xEnd = (r.x1 + 1) * T;
      for (let cx = xStart + 0.75; cx + 1.5 <= xEnd; cx += 3.0) {
        const tx = Math.floor((cx + 0.75) / T);
        if (skip(tx, r.z) || skip(tx, r.z + 1)) continue;
        const baseY = terrainBaseY(tm, tx, r.z);
        const b = grid.chunkAt(tx, r.z).opaque;
        // M15a.3: keep the TOP face (skipFaces ['bottom'] only) so the dash reads
        // as a flat line from above; sit ~0.015 off the road so it can't z-fight.
        b.box(cx + 0.75, baseY + 0.015, wz, 1.5, 0.02, 0.25, line, { skipFaces: ['bottom'] });
      }
    } else {
      const wx = (r.x + 1) * T;
      const zStart = r.z0 * T;
      const zEnd = (r.z1 + 1) * T;
      for (let cz = zStart + 0.75; cz + 1.5 <= zEnd; cz += 3.0) {
        const tz = Math.floor((cz + 0.75) / T);
        if (skip(r.x, tz) || skip(r.x + 1, tz)) continue;
        const baseY = terrainBaseY(tm, r.x, tz);
        const b = grid.chunkAt(r.x, tz).opaque;
        // M15a.3: keep the top face + 0.015 lift (see the x-axis branch above).
        b.box(wx, baseY + 0.015, cz + 0.75, 0.25, 0.02, 1.5, line, { skipFaces: ['bottom'] });
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
  for (const h of hRoads) for (const v of vRoads) {
    const ix = v.x, iz = h.z; // top-left of the 2x2 intersection
    const n = 4; // stripes across a 2-tile (8u) road width
    const lane = (2 * T) / n;
    const stripe = (b, wx, wz, horizontal, baseY) => {
      for (let i = 0; i < n; i++) {
        const off = (i - n / 2) * lane;
        // M15a.3: keep the top face + 0.015 lift so the zebra reads from above.
        if (horizontal) b.box(wx + off, baseY + 0.015, wz, lane * 0.5, 0.02, 1.2, white, { skipFaces: ['bottom'] });
        else b.box(wx, baseY + 0.015, wz + off, 1.2, 0.02, lane * 0.5, white, { skipFaces: ['bottom'] });
      }
    };
    const vcx = (ix + 1) * T; // vertical road center X (spans cols ix,ix+1)
    const hcz = (iz + 1) * T; // horizontal road center Z (spans rows iz,iz+1)
    // North + south: cross the vertical road (stripes span X), at rows iz-1 / iz+2.
    stripe(grid.chunkAt(ix, iz - 1).opaque, vcx, tm.cz(iz - 1), true, terrainBaseY(tm, ix, iz - 1));
    stripe(grid.chunkAt(ix, iz + 2).opaque, vcx, tm.cz(iz + 2), true, terrainBaseY(tm, ix, iz + 2));
    // West + east: cross the horizontal road (stripes span Z), at cols ix-1 / ix+2.
    // M15a.3: the west arm was at ix-2 (one tile too far — the tile just outside
    // the 2×2 intersection is ix-1); the east arm at ix+2 was already right.
    stripe(grid.chunkAt(ix - 1, iz).opaque, tm.cx(ix - 1), hcz, false, terrainBaseY(tm, ix - 1, iz));
    stripe(grid.chunkAt(ix + 2, iz).opaque, tm.cx(ix + 2), hcz, false, terrainBaseY(tm, ix + 2, iz));
  }
}

// White parking-stall lines along row 34 of the lot (§6.2 `L`).
function addParkingLines(grid, tm) {
  const white = PALETTE.lotLine;
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
    b.box(wx0 + (i / count) * w, terrainBaseY(tm, tx, z) + 0.015, tm.minZ(z) + 0.6, 0.14, 0.02, 2.6, white, { skipFaces: ['bottom'] }); // M15a.3: top face + 0.015
  }
}

// Pond: a translucent water plane per chunk that contains `W` tiles, with a
// brighter rim already painted by the basin slabs.
function addPond(grid, tm) {
  const { def } = tm;
  const p = def.pond;
  if (!p) return;
  const water = new VoxelBuilder(999);
  const top = terrainBaseY(tm, p.x, p.z) + 0.05;
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
