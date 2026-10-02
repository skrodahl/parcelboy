// §2.18/§2.19: boot-time layout validation, run by the tilemap validator
// (tilemap.js) on every loaded neighborhood. Each check throws a clear error on a
// layout mistake. Runs once at boot (never the per-frame path), so plain loops are
// fine. A flat neighborhood (no `heights`) passes every check trivially.

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function validateLayout(tm) {
  const def = tm.def;
  const rows = def.map;
  const { width, height } = tm;
  const H = def.heights;
  const N = width * height;
  const inb = (x, z) => x >= 0 && z >= 0 && x < width && z < height;

  // Level model matching terrain.js: '0'..'3' are flat levels; a ramp/stairs tile
  // holds the LOW level of the two it bridges. No heights → every tile is 0.
  const level = new Uint8Array(N);
  const isSlope = (x, z) => !!H && (H[z][x] === '/' || H[z][x] === '=');
  const flatL = (x, z) => {
    if (!inb(x, z)) return -1;
    const c = H ? H[z][x] : '0';
    return c >= '0' && c <= '3' ? c.charCodeAt(0) - 48 : -1;
  };
  for (let z = 0; z < height; z++) for (let x = 0; x < width; x++) {
    if (!H) continue; // stays 0
    const c = H[z][x];
    if (c >= '0' && c <= '3') { level[z * width + x] = c.charCodeAt(0) - 48; continue; }
    const xl = flatL(x - 1, z), xr = flatL(x + 1, z);
    if (xl >= 0 && xr >= 0 && (xr === xl + 1 || xl === xr + 1)) level[z * width + x] = Math.min(xl, xr);
    else {
      const zu = flatL(x, z - 1), zd = flatL(x, z + 1);
      level[z * width + x] = Math.min(zu, zd);
    }
  }
  const L = (x, z) => (inb(x, z) ? level[z * width + x] : 0);
  const walkable = (x, z) => inb(x, z) && tm.isWalkable(x, z);

  // A retaining wall: a level CLIMB between two walkable tiles with no ramp/stairs
  // bridge. Drops and level steps are not walls (terrain.js: hop-down is free).
  function wallBetween(ax, az, bx, bz) {
    if (ax === bx && az === bz) return false;
    const la = L(ax, az), lb = L(bx, bz);
    if (lb <= la) return false;
    if (isSlope(ax, az) || isSlope(bx, bz)) return false; // a ramp/stairs bridges it
    return true;
  }

  // §2.19: every walkable tile (exits + the kiosk included, since they sit on
  // walkable tiles) reachable from the spawn on foot (ramps + stairs bridge
  // climbs; dropping is free).
  const sp = def.spawn;
  if (!sp || !walkable(sp.x, sp.z)) {
    throw new Error(`tilemap ${def.id}: spawn (${sp ? sp.x : '?'} ${sp ? sp.z : '?'}) is not a walkable tile`);
  }
  const seen = new Uint8Array(N);
  const q = [sp.z * width + sp.x];
  seen[sp.z * width + sp.x] = 1;
  for (let qi = 0; qi < q.length; qi++) {
    const cur = q[qi];
    const cx = cur % width, cz = (cur / width) | 0;
    for (let d = 0; d < 4; d++) {
      const nx = cx + DIRS[d][0], nz = cz + DIRS[d][1];
      if (!inb(nx, nz) || seen[nz * width + nx]) continue;
      if (!walkable(nx, nz) || wallBetween(cx, cz, nx, nz)) continue;
      seen[nz * width + nx] = 1;
      q.push(nz * width + nx);
    }
  }
  let unreachable = 0;
  for (let i = 0; i < N; i++) {
    const x = i % width, z = (i / width) | 0;
    if (walkable(x, z) && !seen[i]) unreachable++;
  }
  if (unreachable) {
    throw new Error(`tilemap ${def.id}: ${unreachable} walkable tile(s) unreachable from the spawn (${sp.x},${sp.z})`);
  }

  // §2.19: traffic loops run on road/ramp tiles only and never cross a wall.
  if (def.traffic) {
    for (const key of Object.keys(def.traffic)) {
      const loop = def.traffic[key];
      for (let i = 0; i < loop.length; i++) {
        const [x0, z0] = loop[i];
        const [x1, z1] = loop[(i + 1) % loop.length];
        if (!inb(x0, z0) || rows[z0][x0] !== 'R') {
          throw new Error(`tilemap ${def.id}: traffic '${key}' waypoint (${x0},${z0}) is not a road/ramp tile`);
        }
        if (x0 === x1) {
          const step = z1 > z0 ? 1 : -1;
          for (let z = z0; z !== z1; z += step) {
            if (wallBetween(x0, z, x0, z + step)) throw new Error(`tilemap ${def.id}: traffic '${key}' crosses a retaining wall near (${x0},${z})`);
          }
        } else if (z0 === z1) {
          const step = x1 > x0 ? 1 : -1;
          for (let x = x0; x !== x1; x += step) {
            if (wallBetween(x, z0, x + step, z0)) throw new Error(`tilemap ${def.id}: traffic '${key}' crosses a retaining wall near (${x},${z0})`);
          }
        }
      }
    }
  }

  // §2.19: a porch (the house's wooden deck) must be reachable from a same-level
  // walkable tile (sidewalk / road / yard) — a porch sealed off by a wall is a
  // house you can't deliver to.
  for (let z = 0; z < height; z++) for (let x = 0; x < width; x++) {
    if (rows[z][x] !== 'o') continue;
    let ok = false;
    for (let d = 0; d < 4; d++) {
      const nx = x + DIRS[d][0], nz = z + DIRS[d][1];
      if (!inb(nx, nz)) continue;
      const c = rows[nz][nx];
      if (c === 'o' || c === 'H' || !walkable(nx, nz)) continue;
      if (wallBetween(x, z, nx, nz)) continue;
      ok = true;
      break;
    }
    if (!ok) throw new Error(`tilemap ${def.id}: porch tile (${x},${z}) is not reachable from a same-level walkable tile`);
  }

  // §2.18: an exit is a road gap that runs off the map edge. The tile must sit in
  // the border ring and name a target; the generator (maple-hollow-exits.cjs)
  // cuts the road so the tile is on a walkable gap.
  if (def.exits) for (const e of def.exits) {
    if (!e.to) throw new Error(`tilemap ${def.id}: exit '${e.id}' has no 'to' target`);
    for (const [ex, ez] of e.tiles || []) {
      const nearEdge = ex <= 3 || ez <= 3 || ex >= width - 4 || ez >= height - 4;
      if (!inb(ex, ez) || !nearEdge) {
        throw new Error(`tilemap ${def.id}: exit '${e.id}' tile (${ex},${ez}) is not on the map edge`);
      }
    }
  }
}
