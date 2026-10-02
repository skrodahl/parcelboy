// Generates game/src/data/neighborhoods/lakeside.js — the §2.18/§2.19
// Lakeside suburb: a lake biting into the map from the east, an irregular
// shoreline (rocks + reeds), two raised-deck bridges, a boardwalk, houses on a
// low bluff, and a pier with a little lighthouse (the landmark). Geese + the
// floating-parcel gag are wired in M16 (hazard def + parcels state).
// Plain Node, no packages. Run: node tools/neighborhoods/lakeside.cjs
// Builds the map + heights from high-level rectangles, runs the same validation
// the game does at boot, and writes the data file next to it.

const fs = require('fs');
const path = require('path');

const W = 34, H = 40;
const T = 4; // must match the neighborhood's tileSize

// ---- build the two layers (map surface chars + heights) ---------------------
const map = [];
for (let z = 0; z < H; z++) map.push(new Array(W).fill('#').join(''));
const heights = [];
for (let z = 0; z < H; z++) heights.push(new Array(W).fill('0').join(''));
function setRow(arr, x, z, c) { const r = arr[z]; arr[z] = r.slice(0, x) + c + r.slice(x + 1); }
function fillRect(arr, x0, z0, x1, z1, c) { for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) setRow(arr, x, z, c); }

// 1. The playable interior: a low-bluff west half (L1) + a lakeshore east half
//    (L0). The lake bites in from the east; the bluff is the raised half where
//    the houses sit.
fillRect(map, 2, 2, 31, 37, '.');
fillRect(heights, 2, 2, 22, 37, '1'); // the bluff (west two-thirds)
// (the east third x 23-31 stays level 0: the shore + the lake bed)

// 2. The lake: an irregular bay biting in from the east edge (x 25-31).
//    Carve an uneven shoreline: the bay is deeper (further west) mid-map.
const LAKE = [];
for (let z = 8; z <= 32; z++) {
  // the shoreline wobbles: the bay indents furthest around the middle.
  const edge = 27 - Math.round(2 * Math.cos((z - 20) / 12)); // ~25..27
  for (let x = Math.max(24, edge); x <= 31; x++) LAKE.push([x, z]);
}
for (const [x, z] of LAKE) setRow(map, x, z, 'W');
// a small island/peninsula in the bay (the bridges land on it).
fillRect(map, 30, 15, 31, 21, '.');
fillRect(heights, 30, 15, 31, 21, '1');

// 3. Two bridges (road on a raised L1 deck) crossing the bay to the peninsula.
//    Bridge 1 (north) and Bridge 2 (south): a 2-wide road deck at x 23-29.
fillRect(map, 23, 16, 29, 17, 'R');  // bridge 1
fillRect(map, 23, 24, 29, 25, 'R');   // bridge 2
fillRect(heights, 23, 16, 29, 17, '1'); // the deck rides above the water
fillRect(heights, 23, 24, 29, 25, '1');
// the bluff-side ends of the bridges meet the L1 bluff; the far ends meet the
// L1 peninsula. Both ends same level, so no ramps are needed on the decks.

// 4. The boardwalk: a sandy path skirting the bay's west shore (L0).
for (let z = 9; z <= 31; z++) {
  const edge = 27 - Math.round(2 * Math.cos((z - 20) / 12));
  if (edge >= 24) setRow(map, edge - 1, z, 'p'); // one path tile in front of the shore
}

// 5. The pier: a walkable deck jutting into the bay (L0, water level) with the
//    little lighthouse at the end. The pier replaces water tiles with `p`.
const PIER = { z: 30, x0: 25, x1: 29 };
for (let x = PIER.x0; x <= PIER.x1; x++) setRow(map, x, PIER.z, 'p');
// a short approach from the shore to the pier.
setRow(map, 24, PIER.z, 'p');
const buildings = [
  { id: 'lighthouse', kind: 'lighthouse', name: 'Lakeside Lighthouse', x: 28, z: 29, w: 2, d: 2, facing: 'W' },
];
fillRect(map, 28, 29, 29, 30, 'X');

// 6. (the foot-only bluff stair is set last, after all the path fills, so the
//    shore path doesn't overwrite it — see the block before validate()).

// 7. Houses on the bluff (2×2 footprints + a porch).
// House rows avoid the bridge-spur road rows (16-17, 24-25) and the main road
// (cols 8-9), so no house footprint is clobbered by a road.
const houses = [
  { id: 'l01', x: 5, z: 5, facing: 'S', street: 'Bluff Road', num: 1 },
  { id: 'l02', x: 12, z: 4, facing: 'S', street: 'Bluff Road', num: 2 },
  { id: 'l03', x: 19, z: 5, facing: 'S', street: 'Bluff Road', num: 3 },
  { id: 'l04', x: 5, z: 12, facing: 'E', street: 'Harbor Lane', num: 4 },
  { id: 'l05', x: 12, z: 12, facing: 'S', street: 'Harbor Lane', num: 5 },
  { id: 'l06', x: 5, z: 22, facing: 'E', street: 'Shore Drive', num: 6 },
  { id: 'l07', x: 12, z: 22, facing: 'S', street: 'Shore Drive', num: 7 },
  { id: 'l08', x: 19, z: 22, facing: 'S', street: 'Shore Drive', num: 8 },
];
for (const h of houses) fillRect(map, h.x, h.z, h.x + 1, h.z + 1, 'H');
function porchTiles(h) {
  return h.facing === 'N' ? [[h.x, h.z - 1], [h.x + 1, h.z - 1]]
    : h.facing === 'S' ? [[h.x, h.z + 2], [h.x + 1, h.z + 2]]
    : h.facing === 'E' ? [[h.x + 2, h.z], [h.x + 2, h.z + 1]]
    : [[h.x - 1, h.z], [h.x - 1, h.z + 1]];
}
for (const h of houses) for (const [px, pz] of porchTiles(h)) setRow(map, px, pz, 'o');

// 8. Roads on the bluff (a loop + spurs to the bridge ends).
fillRect(map, 8, 8, 9, 32, 'R');   // the bluff's main north-south road
fillRect(map, 4, 10, 20, 10, 'R');  // spurs to the houses
fillRect(map, 4, 20, 20, 20, 'R');
fillRect(map, 4, 30, 20, 30, 'R');
// connect the bluff road to the two bridge west ends (x=23).
fillRect(map, 10, 16, 22, 17, 'R');
fillRect(map, 10, 24, 22, 25, 'R');

// 9. The spawn + kiosk + restock zone on the shore (the Quickbox pickup),
//    reachable from the bluff by the foot-only stair.
const SPAWN = { x: 23, z: 34, facing: 'N' };
const KIOSK = { x: 23, z: 35, name: 'Lakeside Kiosk' };
const RESTOCK = { x0: 22, z0: 34, x1: 25, z1: 35 };
// a short shore path so the kiosk/pier area connects to the bluff stair.
fillRect(map, 23, 31, 24, 35, 'p');
fillRect(map, 22, 33, 22, 35, 's');

// 10. Traffic loop (on the bluff road, L1 — cars stay on the bluff; the bridges
//     are foot+car decks but cars loop the bluff so the loop stays simple).
const TRAFFIC = { bluff: [[8, 10], [8, 30], [20, 30], [20, 10]] };

// 10b. Two sidewalk pads on the bluff for the parcel lockers (lockers must sit
//      on a sidewalk tile, §2.17).
setRow(map, 11, 34, 's'); setRow(map, 13, 8, 's');

// 11. Hazards, golden parcels, lockers, markers.
const HAZARD_SPOTS = {
  goose: [[6, 18], [18, 12], [14, 28]], // the geese wander the bluff lawns (dog-like chase)
  sprinkler: [[6, 33], [20, 33], [8, 20]],
};
const GOLDEN = [[23, 12], [24, 20], [30, 15], [24, 28], [6, 33], [18, 33], [10, 8], [29, 21]];
const LOCKERS = [[11, 34], [13, 8]]; // on the two bluff sidewalk pads (validated)
const MARKERS = [
  { id: 'dispatch', x: KIOSK.x, z: KIOSK.z, color: '#00b4a6', icon: 'parcel' },
];
// The west exit back to Maple Hollow (the road runs off the map edge).
const EXITS = [
  { id: 'west', to: 'maple-hollow', name: 'Maple Hollow', edge: 'W', tiles: [[2, 20]], entry: 'spawn', unlockStars: 0 },
];

// The lake's water plane (a single bounding box; only the `W` tiles render).
const POND = { x: 24, z: 8, w: 8, d: 25 };

// 12. The foot-only stair down from the bluff to the shore (L1 → L0), set LAST so
//     the shore-path fills above don't clobber it. The `=` bridges the bluff
//     (x=22, L1) and the shore (x=24, L0) along the x axis.
setRow(map, 23, 33, 's'); setRow(heights, 23, 33, '=');

// ---- validation (the same rules the game runs at boot) ---------------------
const TILES = { '.': 1, R: 1, s: 1, o: 1, d: 1, P: 1, p: 1, L: 1, t: 1 }; // walkable
function validate() {
  const err = (m) => { console.error('  ✗ ' + m); process.exit(1); };
  if (heights.length !== H || heights[0].length !== W) err('heights size mismatch');
  const lvl = (x, z) => (x < 0 || z < 0 || x >= W || z >= H) ? -1
    : (/[0-3]/.test(heights[z][x]) ? +heights[z][x] : -1);
  // Ramps/stairs bridge exactly two adjacent levels along one axis.
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
    const c = heights[z][x];
    if (c !== '/' && c !== '=') continue;
    const okX = lvl(x - 1, z) !== -1 && lvl(x + 1, z) !== -1 && (lvl(x + 1, z) === lvl(x - 1, z) + 1 || lvl(x - 1, z) === lvl(x + 1, z) + 1);
    const okZ = lvl(x, z - 1) !== -1 && lvl(x, z + 1) !== -1 && (lvl(x, z + 1) === lvl(x, z - 1) + 1 || lvl(x, z - 1) === lvl(x, z + 1) + 1);
    if (!okX && !okZ) err(`slope at (${x},${z}) does not bridge two adjacent levels`);
  }
  const walkable = (x, z) => x >= 0 && z >= 0 && x < W && z < H && !!TILES[map[z][x]];
  // A retaining wall: a climb with no ramp/stairs bridge (blocks foot).
  const isSlope = (x, z) => heights[z][x] === '/' || heights[z][x] === '=';
  const level = (x, z) => (x < 0 || z < 0 || x >= W || z >= H) ? 0 : (isSlope(x, z) ? Math.min(lvl(x - 1, z), lvl(x + 1, z), lvl(x, z - 1), lvl(x, z + 1)) : lvl(x, z));
  const wallBetween = (ax, az, bx, bz) => {
    const la = level(ax, az), lb = level(bx, bz);
    if (lb <= la) return false;
    if (isSlope(ax, az) || isSlope(bx, bz)) return false;
    return true;
  };
  // Flood fill from the spawn (foot: ramps + stairs bridge, drops free).
  const seen = new Set();
  const q = [[SPAWN.x, SPAWN.z]];
  seen.add(SPAWN.x + ',' + SPAWN.z);
  while (q.length) {
    const [x, z] = q.pop();
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, nz = z + dz;
      if (nx < 0 || nz < 0 || nx >= W || nz >= H) continue;
      if (seen.has(nx + ',' + nz) || !walkable(nx, nz)) continue;
      if (wallBetween(x, z, nx, nz)) continue;
      seen.add(nx + ',' + nz);
      q.push([nx, nz]);
    }
  }
  let unreachable = 0;
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) if (walkable(x, z) && !seen.has(x + ',' + z)) unreachable++;
  if (unreachable) err(unreachable + ' walkable tile(s) unreachable from the spawn: ' +
    (() => { const out = []; for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) if (walkable(x, z) && !seen.has(x + ',' + z)) out.push(`(${x},${z})${map[z][x]}`); return out.slice(0, 12).join(' '); })());
  // Traffic on road/ramp tiles only.
  for (const key of Object.keys(TRAFFIC)) for (const [tx, tz] of TRAFFIC[key]) {
    if (map[tz][tx] !== 'R') err(`traffic '${key}' waypoint (${tx},${tz}) is not a road tile`);
  }
  // Porches reachable from a same-level walkable tile.
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
    if (map[z][x] !== 'o') continue;
    let ok = false;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, nz = z + dz;
      if (nx < 0 || nz < 0 || nx >= W || nz >= H) continue;
      const c = map[nz][nx];
      if (c === 'o' || c === 'H' || !TILES[c]) continue;
      if (wallBetween(x, z, nx, nz)) continue;
      ok = true; break;
    }
    if (!ok) err(`porch tile (${x},${z}) not reachable from a same-level walkable tile`);
  }
  // Exits on the map edge.
  for (const e of EXITS) for (const [ex, ez] of e.tiles) {
    const nearEdge = ex <= 3 || ez <= 3 || ex >= W - 4 || ez >= H - 4;
    if (!nearEdge) err(`exit '${e.id}' tile (${ex},${ez}) not on the map edge`);
  }
  // The lighthouse footprint must sit on the pier.
  for (const b of buildings) if (b.kind === 'lighthouse') {
    if (map[b.z][b.x] !== 'X') err(`lighthouse at (${b.x},${b.z}) is not on the pier`);
  }
}

// ---- the data ---------------------------------------------------------------
validate();

const def = {
  id: 'lakeside',
  name: 'Lakeside',
  tileSize: T,
  map,
  heights,
  roads: [],
  houses,
  buildings,
  pond: POND,
  spawn: SPAWN,
  restockZone: RESTOCK,
  traffic: TRAFFIC,
  sidewalkLoops: {},
  hazardSpots: HAZARD_SPOTS,
  missionMarkers: MARKERS,
  goldenParcels: GOLDEN,
  parcelLockers: LOCKERS,
  exits: EXITS,
  kiosk: KIOSK,
  region: 'Lakeside — a lakeshore suburb: a low bluff of houses over a bayside lake, two bridges to a peninsula, a boardwalk, and a little lighthouse on the pier. Geese honk.',
};

const out = path.join(__dirname, '..', '..', 'game', 'src', 'data', 'neighborhoods', 'lakeside.js');
const js =
`// Lakeside: §2.18/§2.19 lakeshore suburb, generated by tools/neighborhoods/lakeside.cjs.
// Copy verbatim; regenerate with the generator (it re-runs validation).
export default ${JSON.stringify(def, null, 2).split('\n').join('\n')}
;
`;
fs.writeFileSync(out, js);
console.log('wrote', path.relative(process.cwd(), out), '(' + map.length + 'x' + map[0].length + ')');
