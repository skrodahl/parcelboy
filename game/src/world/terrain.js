// §2.19 Terrain heights. A neighborhood's optional `heights` layer is an array
// of strings the same size as `map`: one char per tile.
//   '0'..'3'  = a flat tile at that level (1.5 units per level)
//   '/'       = a ramp rising from its lower neighbor to its higher neighbor
//               along one axis (cars + walkers ride it)
//   '='       = stairs, same as a ramp but walk-only (vehicles are blocked)
// A missing layer means every tile is level 0 (Maple Hollow stays flat), so a
// no-hills terrain returns 0 everywhere and every caller behaves exactly as it
// did before.
//
// The result is precomputed into flat typed arrays so groundY(x, z) and
// edgeBlocked() are allocation-free (safe to call on the per-frame hot path).

const LEVEL_H = 1.5;
const DIGIT0 = 48; // '0'

function isSlope(c) { return c === '/' || c === '='; }

export function createTerrain(tm) {
  const { width, height, tileSize: t } = tm;
  const H = tm.def.heights;

  // No heights layer → flat. The fast path keeps Maple Hollow byte-identical.
  if (!H) {
    return {
      hasHills: false,
      LEVEL_H,
      baseYAt() { return 0; },
      levelAt() { return 0; },
      edgeBlocked() { return false; },
    };
  }

  const N = width * height;
  const level = new Uint8Array(N);   // per tile: 0..3 (slope tiles hold the LOW level)
  const slopeAxis = new Int8Array(N); // 0 = rises along +X, 1 = rises along +Z, -1 = flat
  const slopeUp = new Int8Array(N);   // 0 = low side is the -x/-z edge, 1 = the +x/+z edge
  const idx = (x, z) => z * width + x;

  const charAt = (x, z) => (x >= 0 && z >= 0 && x < width && z < height) ? H[z][x] : -1;
  const flatLevel = (x, z) => {
    const c = charAt(x, z);
    return c >= '0' && c <= '3' ? c.charCodeAt(0) - DIGIT0 : -1;
  };

  // Pass 1: flat tiles.
  for (let z = 0; z < height; z++) for (let x = 0; x < width; x++) {
    const c = H[z][x];
    if (c >= '0' && c <= '3') level[idx(x, z)] = c.charCodeAt(0) - DIGIT0;
    else if (isSlope(c)) level[idx(x, z)] = 0; // refined in pass 2
    else if (c === '#') { /* solid border tiles: treated as level 0 for reads */ level[idx(x, z)] = 0; }
    else throw new Error(`terrain ${tm.id}: unknown heights char '${c}' at (${x},${z})`);
  }

  // Pass 2: ramps/stairs must sit between exactly two adjacent levels along one
  // axis; record the axis + which edge is the low side.
  for (let z = 0; z < height; z++) for (let x = 0; x < width; x++) {
    const c = H[z][x];
    if (!isSlope(c)) continue;
    const xl = flatLevel(x - 1, z), xr = flatLevel(x + 1, z);
    const zu = flatLevel(x, z - 1), zd = flatLevel(x, z + 1);
    let ax, lowL;
    if (xl !== -1 && xr !== -1 && (xr === xl + 1 || xl === xr + 1)) {
      ax = 0; lowL = Math.min(xl, xr);
      slopeUp[idx(x, z)] = (xr === xl + 1) ? 0 : 1; // up toward +x, or -x
    } else if (zu !== -1 && zd !== -1 && (zd === zu + 1 || zu === zd + 1)) {
      ax = 1; lowL = Math.min(zu, zd);
      slopeUp[idx(x, z)] = (zd === zu + 1) ? 0 : 1; // up toward +z, or -z
    } else {
      throw new Error(`terrain ${tm.id}: ramp/stairs at (${x},${z}) must bridge two adjacent levels along one axis`);
    }
    const i = idx(x, z);
    level[i] = lowL;
    slopeAxis[i] = ax;
  }

  function levelAt(tx, tz) {
    if (tx < 0 || tz < 0 || tx >= width || tz >= height) return 0;
    return level[tz * width + tx];
  }

  // World Y of the terrain surface under (wx, wz). Constant on a flat tile, a
  // linear ramp on a slope tile.
  function baseYAt(wx, wz) {
    let tx = (wx / t) | 0; if (tx < 0) tx = 0; else if (tx >= width) tx = width - 1;
    let tz = (wz / t) | 0; if (tz < 0) tz = 0; else if (tz >= height) tz = height - 1;
    const i = tz * width + tx;
    const ax = slopeAxis[i];
    if (ax < 0) return level[i] * LEVEL_H;
    const fx = (wx - tx * t) / t;
    const fz = (wz - tz * t) / t;
    const along = ax === 0 ? fx : fz;
    const up = slopeUp[i] === 0 ? along : 1 - along;
    return (level[i] + up) * LEVEL_H;
  }

  // Is moving from tile (ax,az) to tile (bx,bz) blocked? Dropping / staying at
  // the same level is always allowed; climbing up needs a ramp or stairs bridge,
  // and a bridge of stairs blocks vehicles.
  function edgeBlocked(ax, az, bx, bz, vehicle) {
    if (ax === bx && az === bz) return false;
    const la = levelAt(ax, az), lb = levelAt(bx, bz);
    if (lb <= la) return false; // drop or level: fine
    let bridge = -1;
    if (slopeAxis[az * width + ax] >= 0) bridge = H[az][ax];
    else if (slopeAxis[bz * width + bx] >= 0) bridge = H[bz][bx];
    else return true; // no ramp/stairs between them → a retaining wall
    return !!(vehicle && bridge === '=');
  }

  return {
    hasHills: true,
    LEVEL_H,
    raw: H,
    level,
    slopeAxis,
    slopeUp,
    baseYAt,
    levelAt,
    edgeBlocked,
  };
}

// §2.19: the terrain level height (units) under tile (x,z); 0 when the
// neighborhood is flat. Shared by the world builders so they lift structures
// to their tile's level.
export function tileBaseY(tm, x, z) {
  const tr = tm.terrain;
  return tr ? tr.levelAt(x, z) * tr.LEVEL_H : 0;
}
