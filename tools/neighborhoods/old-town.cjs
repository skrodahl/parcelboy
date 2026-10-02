// Generates game/src/data/neighborhoods/old-town.js — the §2.18/§2.19 Old Town
// suburb: a dense, crooked old town on a low hill (L1) ringed by L0 streets,
// around a central market square. Narrow walk-only alleys (vehicles blocked,
// like stairs) climb off the L0 streets onto the hill; the row houses, the old
// church on the low rise, and a clock tower (that chimes on the hour of the day
// cycle) are the landmarks; a market stall you can bowl into fruit (+heat) is
// the unique gag and the pigeons lift off as one big flock.
// Plain Node, no packages. Run: node tools/neighborhoods/old-town.cjs
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

// 1. The playable interior: everything is the L0 ring + streets by default.
fillRect(map, 2, 2, 31, 37, '.');

// 2. The town: a low hill (L1) in the middle, x 6-27 / z 8-31. The L0 ring is
//    the crooked streets that run off the map edge to the other suburbs.
fillRect(map, 6, 8, 27, 31, '.');
fillRect(heights, 6, 8, 27, 31, '1');

// 3. The market square: an open cobblestone (s) square in the town's center,
//    ringed by a short loop road + the clock tower + the market stalls + the
//    pigeon flock.
fillRect(map, 9, 14, 23, 24, 's');           // the open square (cobble)
fillRect(map, 8, 13, 24, 13, 'R');           // north side of the square's loop
fillRect(map, 8, 25, 24, 25, 'R');           // south side
fillRect(map, 8, 13, 8, 25, 'R');            // west side
fillRect(map, 24, 13, 24, 25, 'R');          // east side (closes the loop)

// 4. The crooked streets on the hill (L1). A jogged N-S main street, an E-W
//    street, and a couple of dead-end spurs — deliberately not a grid.
fillRect(map, 15, 9, 15, 18, 'R');           // N-S main, upper (col 15)
fillRect(map, 16, 19, 16, 31, 'R');          // N-S main, lower (col 16, the jog)
fillRect(map, 10, 22, 22, 23, 'R');          // E-W street (z 22-23)
fillRect(map, 9, 8, 10, 8, 'R');             // a dead-end spur, NW
fillRect(map, 20, 30, 21, 31, 'R');          // a dead-end spur, SE

// 5. The L0 streets that run off the map edge (the exits) + the ring the cars
//    loop. The west street (z 19-20) runs off the west edge to Maple Hollow.
fillRect(map, 2, 19, 2, 20, 'R');            // the west exit road (runs off edge)
fillRect(map, 3, 19, 4, 20, 'R');            // the west street up to the ramp
// the L0 ring loop (cars stay on L0; they can't climb the town): west/south/east
fillRect(map, 3, 5, 3, 34, 'R');             // west L0 road
fillRect(map, 3, 34, 30, 34, 'R');           // south L0 road
fillRect(map, 30, 5, 30, 34, 'R');           // east L0 road
fillRect(map, 3, 5, 30, 5, 'R');             // north L0 road

// 6. Ramps (vehicle entry onto the hill) + walk-only stair alleys (L0 <-> L1,
//    `=` blocks vehicles). Both bridge exactly one level along one axis.
setRow(map, 5, 19, 'R'); setRow(map, 5, 20, 'R'); setRow(heights, 5, 19, '/'); setRow(heights, 5, 20, '/'); // the west ramp up
setRow(map, 15, 31, 'R'); setRow(heights, 15, 31, '/'); // the south ramp up (kiosk side)
// walk-only stair alleys (vehicles can't climb `=`):
setRow(map, 5, 12, 's'); setRow(heights, 5, 12, '='); // north alley
setRow(map, 5, 24, 's'); setRow(heights, 5, 24, '='); // south alley
setRow(map, 27, 16, 's'); setRow(heights, 27, 16, '='); // east alley
setRow(map, 20, 8, 's'); setRow(heights, 20, 8, '=');   // NE alley (up to the rise)

// 7. Row houses: two tight rows flanking the market square (narrow, joined).
//    Facing the square (north row faces S, south row faces N). `style` selects
//    the new row-house style (narrow 2-3 floors, joined walls).
const houses = [
  { id: 'o01', x: 8, z: 10, facing: 'S', street: 'Mason Row', num: 1, style: 'rowhouse' },
  { id: 'o02', x: 13, z: 10, facing: 'S', street: 'Mason Row', num: 2, style: 'rowhouse' },
  { id: 'o03', x: 18, z: 10, facing: 'S', street: 'Mason Row', num: 3, style: 'rowhouse' },
  { id: 'o04', x: 23, z: 10, facing: 'S', street: 'Mason Row', num: 4, style: 'rowhouse' },
  { id: 'o05', x: 8, z: 26, facing: 'N', street: 'Cooper Row', num: 5, style: 'rowhouse' },
  { id: 'o06', x: 13, z: 26, facing: 'N', street: 'Cooper Row', num: 6, style: 'rowhouse' },
  { id: 'o07', x: 18, z: 26, facing: 'N', street: 'Cooper Row', num: 7, style: 'rowhouse' },
  { id: 'o08', x: 23, z: 26, facing: 'N', street: 'Cooper Row', num: 8, style: 'rowhouse' },
];
for (const h of houses) fillRect(map, h.x, h.z, h.x + 1, h.z + 1, 'H');
function porchTiles(h) {
  return h.facing === 'N' ? [[h.x, h.z - 1], [h.x + 1, h.z - 1]]
    : h.facing === 'S' ? [[h.x, h.z + 2], [h.x + 1, h.z + 2]]
    : h.facing === 'E' ? [[h.x + 2, h.z], [h.x + 2, h.z + 1]]
    : [[h.x - 1, h.z], [h.x - 1, h.z + 1]];
}
for (const h of houses) for (const [px, pz] of porchTiles(h)) setRow(map, px, pz, 'o');
// short foot-only driveways off the row streets to each porch (the alleys).
for (const h of houses) {
  const dx = h.x + 1, dz = h.facing === 'S' ? h.z + 2 : h.z - 1;
  if (map[dz][dx] === '.') setRow(map, dx, dz, 'd');
}

// 8. The landmarks: the clock tower (the market square's NW corner), the old
//    church on the low rise (the NE corner), and two market stalls (the fruit
//    gag) in the square.
const buildings = [
  { id: 'clocktower', kind: 'clocktower', name: 'Old Town Clock Tower', x: 9, z: 14, w: 2, d: 2, facing: 'E' }, // face the market square
  { id: 'church', kind: 'church', name: 'Old Chapel', x: 25, z: 8, w: 3, d: 3, facing: 'S' },
  { id: 'stallA', kind: 'marketstall', name: 'Market Stall', x: 18, z: 18, w: 2, d: 1, facing: 'S', accent: '#e63946' },
  { id: 'stallB', kind: 'marketstall', name: 'Market Stall', x: 20, z: 20, w: 2, d: 1, facing: 'N', accent: '#2a9d8f' },
];
for (const b of buildings) fillRect(map, b.x, b.z, b.x + b.w - 1, b.z + b.d - 1, 'X');

// 9. The spawn + kiosk + restock zone at the town's south L0 edge (the pickup).
const SPAWN = { x: 15, z: 35, facing: 'N' };
const KIOSK = { x: 15, z: 34, name: 'Old Town Kiosk' };
const RESTOCK = { x0: 13, z0: 34, x1: 17, z1: 35 };
fillRect(map, 13, 34, 17, 35, 's'); // the kiosk's L0 plaza

// 10. Traffic loop (the L0 ring — cars stay on the ground level).
const TRAFFIC = { ring: [[3, 5], [30, 5], [30, 34], [3, 34]] };

// 11. Hazards, golden parcels, lockers, markers.
//     Old Town: more skaters + pedestrians (ambient) + the pigeon flock (the
//     unique gag) sitting in the market square + a couple of sprinkler pads.
const HAZARD_SPOTS = {
  pigeon: [[14, 18], [16, 21], [21, 19]], // the flock roosts in the market square
  sprinkler: [[6, 33], [27, 33]],
};
const GOLDEN = [[4, 12], [30, 20], [12, 32], [24, 32], [21, 10], [10, 27], [6, 6], [28, 6]];
const LOCKERS = [[11, 24], [20, 24]]; // `s` pads just south of the E-W street (M15a.2: road on the north side)
const MARKERS = [
  { id: 'dispatch', x: KIOSK.x, z: KIOSK.z, color: '#00b4a6', icon: 'parcel' },
];
// The west exit back to Maple Hollow (the road runs off the map edge).
const EXITS = [
  { id: 'west', to: 'maple-hollow', name: 'Maple Hollow', edge: 'W', tiles: [[2, 20]], entry: 'spawn', unlockStars: 0 },
];

// 12. The NE alley (`=`) up to the church's low rise is set LAST so the road
//     fills above don't clobber it.

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
    if (!okX && !okZ) err(`slope at (${x},${z}) does not bridge two adjacent levels [${lvl(x-1,z)},${lvl(x+1,z)} x / ${lvl(x,z-1)},${lvl(x,z+1)} z]`);
  }
  const walkable = (x, z) => x >= 0 && z >= 0 && x < W && z < H && !!TILES[map[z][x]];
  const isSlope = (x, z) => heights[z][x] === '/' || heights[z][x] === '=';
  const level = (x, z) => (x < 0 || z < 0 || x >= W || z >= H) ? 0 : (isSlope(x, z) ? Math.min(lvl(x - 1, z), lvl(x + 1, z), lvl(x, z - 1), lvl(x, z + 1)) : lvl(x, z));
  const wallBetween = (ax, az, bx, bz) => {
    const la = level(ax, az), lb = level(bx, bz);
    if (lb <= la) return false;
    if (isSlope(ax, az) || isSlope(bx, bz)) return false;
    return true;
  };
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
  for (const key of Object.keys(TRAFFIC)) for (const [tx, tz] of TRAFFIC[key]) {
    if (map[tz][tx] !== 'R') err(`traffic '${key}' waypoint (${tx},${tz}) is not a road tile`);
  }
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
  for (const e of EXITS) for (const [ex, ez] of e.tiles) {
    const nearEdge = ex <= 3 || ez <= 3 || ex >= W - 4 || ez >= H - 4;
    if (!nearEdge) err(`exit '${e.id}' tile (${ex},${ez}) not on the map edge`);
  }
  // The lockers must sit on sidewalk pads with a road on one side (M15a.2).
  for (const [lx, lz] of LOCKERS) {
    if (map[lz][lx] !== 's') err(`locker (${lx},${lz}) is not on a sidewalk pad (char ${map[lz][lx]})`);
    let road = false;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (TILES[map[lz + dz] && map[lz + dz][lx + dx]] && map[lz + dz][lx + dx] === 'R') road = true;
    if (!road) err(`locker pad (${lx},${lz}) has no road on one side`);
  }
}

validate();

const def = {
  id: 'old-town',
  name: 'Old Town',
  tileSize: T,
  map,
  heights,
  roads: [],
  houses,
  buildings,
  spawn: SPAWN,
  restockZone: RESTOCK,
  traffic: TRAFFIC,
  // Skater loops (§2.8): named rectangles the skaters pace on the town's
  // cobble. Four (so `k.loop % 4` always lands on a real loop), around the
  // square + along the E-W street.
  sidewalkLoops: {
    A: { x0: 9, z0: 13, x1: 14, z1: 25 },
    B: { x0: 15, z0: 13, x1: 24, z1: 25 },
    C: { x0: 10, z0: 22, x1: 15, z1: 23 },
    D: { x0: 16, z0: 22, x1: 22, z1: 23 },
  },
  hazardSpots: HAZARD_SPOTS,
  missionMarkers: MARKERS,
  goldenParcels: GOLDEN,
  parcelLockers: LOCKERS,
  exits: EXITS,
  kiosk: KIOSK,
  region: 'Old Town — a dense old town on a low hill: crooked streets around a market square, narrow walk-only alleys, row houses, an old chapel on the rise, a clock tower that chimes on the hour, and a market stall full of fruit. The pigeons take off as one big flock.',
};

const out = path.join(__dirname, '..', '..', 'game', 'src', 'data', 'neighborhoods', 'old-town.js');
const js =
`// Old Town: §2.18/§2.19 dense old town on a low hill, generated by tools/neighborhoods/old-town.cjs.
// Copy verbatim; regenerate with the generator (it re-runs validation).
export default ${JSON.stringify(def, null, 2).split('\n').join('\n')}
;
`;
fs.writeFileSync(out, js);
console.log('wrote', path.relative(process.cwd(), out), '(' + map.length + 'x' + map[0].length + ')');
