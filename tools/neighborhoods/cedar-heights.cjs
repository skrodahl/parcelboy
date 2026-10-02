// Generates game/src/data/neighborhoods/cedar-heights.js — the §2.18/§2.19
// hillside suburb (4 terraces, a switchback road climbing north, a hilltop
// water tower + overlook, foot-only stair paths, long steep driveways).
// Plain Node, no packages. Run: node tools/neighborhoods/cedar-heights.cjs
// Builds the map + heights from high-level rectangles, runs the same validation
// the game does at boot (flood-fill reachability, traffic, porches, exits, and
// the terrain ramp/stairs bridge rule), and writes the data file next to it.

const fs = require('fs');
const path = require('path');

const W = 30, H = 40;
const T = 4; // must match the neighborhood's tileSize

// ---- build the two layers (map surface chars + heights) ---------------------
const map = [];
for (let z = 0; z < H; z++) map.push(new Array(W).fill('#').join(''));
const heights = [];
for (let z = 0; z < H; z++) heights.push(new Array(W).fill('0').join(''));
function setRow(arr, x, z, c) { const r = arr[z]; arr[z] = r.slice(0, x) + c + r.slice(x + 1); }
function fillRect(arr, x0, z0, x1, z1, c) { for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) setRow(arr, x, z, c); }

// The hill tapers: the valley (south) is wide, the hilltop (north) is narrow.
// Playable column bounds per terrace band (outside = forest).
function playableCols(z) {
  if (z <= 9) return [9, 20];    // L3 hilltop
  if (z <= 18) return [7, 22];   // L2
  if (z <= 27) return [5, 24];   // L1
  return [4, 25];                // L0 valley
}
function bandLevel(z) {
  if (z <= 9) return 3;
  if (z <= 18) return 2;
  if (z <= 27) return 1;
  return 0;
}

// 1. Fill each terrace band's playable interior with yard + set its base level.
for (let z = 2; z <= 37; z++) {
  const [lo, hi] = playableCols(z);
  const lvl = bandLevel(z);
  for (let x = lo; x <= hi; x++) { setRow(map, x, z, '.'); setRow(heights, x, z, String(lvl)); }
}

// 2. The switchback road (2 wide) climbs north: up the left, across, up the
//    right, across the top, up to the hilltop.
fillRect(map, 10, 6, 11, 35, 'R');   // left vertical (valley → mid)
fillRect(map, 10, 24, 21, 25, 'R');  // middle horizontal
fillRect(map, 20, 15, 21, 35, 'R');  // right vertical (mid → upper)
fillRect(map, 10, 15, 21, 16, 'R');  // top horizontal

// 3. Sidewalks ring the switchback so every terrace's yard connects to it.
const SIDEWALK = (x0, z0, x1, z1) => fillRect(map, x0, z0, x1, z1, 's');
SIDEWALK(9, 23, 22, 26);   // mid-terrace sidewalk band (L1)
SIDEWALK(9, 14, 22, 17);   // upper-terrace sidewalk band (L2)
SIDEWALK(11, 4, 20, 9);    // hilltop overlook sidewalk (L3)
// valley perimeter sidewalk (L0) so the valley yard connects + the kiosk sits on it
for (let x = 4; x <= 25; x++) { setRow(map, x, 30, 's'); setRow(map, x, 36, 's'); }
for (let z = 30; z <= 36; z++) { setRow(map, 4, z, 's'); setRow(map, 25, z, 's'); }

// 4. Ramps (road climbs) + stairs (foot-only), in the heights layer.
//    ramp rows: 10 (L3↔L2), 19 (L2↔L1), 28 (L1↔L0)
for (const x of [10, 11]) { setRow(heights, x, 28, '/'); setRow(heights, x, 10, '/'); } // left road climbs
for (const x of [20, 21]) { setRow(heights, x, 19, '/'); }                            // right road climbs
// foot-only stairs off the main road (blocked to vehicles)
setRow(map, 14, 19, 's'); setRow(map, 15, 19, 's'); setRow(heights, 14, 19, '='); setRow(heights, 15, 19, '='); // L1↔L2
setRow(map, 16, 10, 's'); setRow(map, 17, 10, 's'); setRow(heights, 16, 10, '='); setRow(heights, 17, 10, '='); // L2↔L3

// 5. The hilltop water tower + overlook bench (a landmark building).
fillRect(map, 13, 3, 15, 5, 'X');
const buildings = [
  { id: 'watertower', kind: 'watertower', name: 'Cedar Heights Water Tower', x: 13, z: 3, w: 3, d: 3, facing: 'S' },
];

// 6. Houses on the terraces (2×2 footprints + a porch + a long driveway).
const houses = [
  { id: 'c01', x: 16, z: 33, facing: 'N', street: 'Valley Road', num: 1 },   // L0
  { id: 'c02', x: 7, z: 31, facing: 'E', street: 'Valley Road', num: 2 },     // L0
  { id: 'c03', x: 16, z: 21, facing: 'N', street: 'Cedar Lane', num: 3 },     // L1
  { id: 'c04', x: 7, z: 22, facing: 'E', street: 'Cedar Lane', num: 4 },      // L1
  { id: 'c05', x: 16, z: 12, facing: 'N', street: 'Summit Drive', num: 5 },   // L2
  { id: 'c06', x: 8, z: 13, facing: 'E', street: 'Summit Drive', num: 6 },    // L2
  { id: 'c07', x: 16, z: 4, facing: 'S', street: 'Summit Drive', num: 7 },    // L3 (overlook)
];
for (const h of houses) fillRect(map, h.x, h.z, h.x + 1, h.z + 1, 'H');
// porch tiles (two `o` in front of each house, facing side)
function porchTiles(h) {
  return h.facing === 'N' ? [[h.x, h.z - 1], [h.x + 1, h.z - 1]]
    : h.facing === 'S' ? [[h.x, h.z + 2], [h.x + 1, h.z + 2]]
    : h.facing === 'E' ? [[h.x + 2, h.z], [h.x + 2, h.z + 1]]
    : [[h.x - 1, h.z], [h.x - 1, h.z + 1]];
}
for (const h of houses) for (const [px, pz] of porchTiles(h)) setRow(map, px, pz, 'o');
// long steep driveways (a 4-tile `d` run up each house's terrace to the road)
for (const h of houses) {
  for (let i = 1; i <= 3; i++) {
    const dx = h.facing === 'W' ? h.x - i : h.facing === 'E' ? h.x + 2 + i : (h.x % 2 ? h.x : h.x + 1);
    const dz = h.facing === 'N' ? h.z - 1 - i : h.facing === 'S' ? h.z + 2 + i : h.z;
    if (dx >= 2 && dx < W - 2 && dz >= 2 && dz < H - 2 && map[dz][dx] === '.') setRow(map, dx, dz, 'd');
  }
}

// 7. The spawn + kiosk + restock zone at the valley (the Quickbox pickup).
const SPAWN = { x: 15, z: 34, facing: 'N' };
const KIOSK = { x: 15, z: 33, name: 'Cedar Heights Kiosk' };
const RESTOCK = { x0: 13, z0: 33, x1: 17, z1: 33 };

// 8. Valley traffic loop (closed, L0) — the two switchback verticals (cols 10-11,
//    20-21, already R down to row 35) are joined by top + bottom roads so cars
//    loop the valley (they can't take the switchback ramp climbs + drops).
fillRect(map, 10, 31, 20, 31, 'R');
fillRect(map, 10, 35, 20, 35, 'R');
const TRAFFIC = { valley: [[10, 31], [20, 31], [20, 35], [10, 35]] };

// 9. Hazards, golden parcels, lockers, markers.
const HAZARD_SPOTS = {
  // The runaway bins sit ON the switchback ramp tiles so the downhill gradient
  // makes them roll down the road (the M15 gag). One per ramp, both ramp tiles
  // where there are two, spread over the three climbs.
  bin: [[10, 10], [11, 10], [20, 19], [21, 19], [10, 28]],
  dog: [[8, 33], [22, 24]],
  sprinkler: [[6, 33], [23, 15]],
};
const GOLDEN = [[12, 35], [22, 32], [9, 26], [23, 21], [12, 18], [21, 12], [10, 8], [18, 4]];
const LOCKERS = [[11, 14], [10, 26]]; // M15a.2: sidewalk tiles with a road on one side (doors face the street)
const MARKERS = [
  { id: 'dispatch', x: KIOSK.x, z: KIOSK.z, color: '#00b4a6', icon: 'parcel' },
];
// The south exit back to Maple Hollow (the road runs off the map edge).
const EXITS = [
  { id: 'south', to: 'maple-hollow', name: 'Maple Hollow', edge: 'S', tiles: [[15, 37]], entry: 'spawn', unlockStars: 0 },
];

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
  if (unreachable) err(unreachable + ' walkable tile(s) unreachable from the spawn');
  // Traffic on road/ramp tiles only, no wall crossing.
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
}

// ---- the data ---------------------------------------------------------------
validate();

const def = {
  id: 'cedar-heights',
  name: 'Cedar Heights',
  tileSize: T,
  map,
  heights,
  roads: [],
  houses,
  buildings,
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
  region: 'Cedar Heights — a hillside suburb: four terraces up a switchback road to a hilltop water tower and overlook. Bins roll downhill.',
};

const out = path.join(__dirname, '..', '..', 'game', 'src', 'data', 'neighborhoods', 'cedar-heights.js');
const js =
`// Cedar Heights: §2.18/§2.19 hillside suburb, generated by tools/neighborhoods/cedar-heights.cjs.
// Copy verbatim; regenerate with the generator (it re-runs validation).
export default ${JSON.stringify(def, null, 2).split('\n').join('\n')}
;
`;
fs.writeFileSync(out, js);
console.log('wrote', path.relative(process.cwd(), out), '(' + map.length + 'x' + map[0].length + ')');
