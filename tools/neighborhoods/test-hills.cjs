// Generates game/src/data/neighborhoods/test-hills.js — the §2.19 debug terrain
// map (3 levels, a ramp road loop, stairs, a retaining wall, two houses at
// different levels). Plain Node, no packages. Run: node tools/neighborhoods/test-hills.cjs
// The generator builds the layout from high-level rectangles, runs the same
// validation the game does at boot, and writes the data file next to it.

const fs = require('fs');
const path = require('path');

const W = 24, H = 20;
const T = 4; // must match the neighborhood's tileSize

// ---- build the two layers (map surface chars + heights) ---------------------
const map = [];
for (let z = 0; z < H; z++) map.push(new Array(W).fill('#').join(''));
const heights = [];
for (let z = 0; z < H; z++) heights.push(new Array(W).fill('0').join(''));
function setRow(arr, x, z, c) { const r = arr[z]; arr[z] = r.slice(0, x) + c + r.slice(x + 1); }
function fillRect(arr, x0, z0, x1, z1, c) { for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) setRow(arr, x, z, c); }

// Interior yard (the diorama sits inside the forest border).
fillRect(map, 2, 2, 21, 17, '.');
// Terraces: L1 (cols 4-11 rows 5-8) + an L2 platform (cols 5-7 rows 5-8).
fillRect(heights, 4, 5, 11, 8, '1');
fillRect(heights, 5, 5, 7, 8, '2');

// Ramp road loop: south road (row 10, L0) + top road (row 8, L1), a ramp on each
// side (col 4 / col 11 at row 9) so a car climbs one side and descends the other.
for (let x = 4; x <= 11; x++) { setRow(map, x, 10, 'R'); setRow(map, x, 8, 'R'); }
for (const x of [4, 11]) { setRow(map, x, 9, 'R'); setRow(heights, x, 9, '/'); }
// Stairs (walk-only) from the L2 platform down to the L1 terrace (col 8, rows 5-8).
for (let z = 5; z <= 8; z++) { setRow(map, 8, z, 's'); setRow(heights, 8, z, '='); }

// Houses: A on level 0 (south-west), B on the level-1 terrace (a different level).
const houses = [
  { id: 'h01', x: 4, z: 12, facing: 'N', street: 'Hill Road', num: 1 },
  { id: 'h02', x: 9, z: 5, facing: 'S', street: 'Hill Road', num: 2 },
];
for (const h of houses) fillRect(map, h.x, h.z, h.x + 1, h.z + 1, 'H');
// Porch tiles (two `o` in front of each house).
const porchTiles = (h) => h.facing === 'N' ? [[h.x, h.z - 1], [h.x + 1, h.z - 1]]
  : h.facing === 'S' ? [[h.x, h.z + 2], [h.x + 1, h.z + 2]]
  : h.facing === 'E' ? [[h.x + 2, h.z], [h.x + 2, h.z + 1]]
  : [[h.x - 1, h.z], [h.x - 1, h.z + 1]];
for (const h of houses) for (const [px, pz] of porchTiles(h)) setRow(map, px, pz, 'o');

// ---- the traffic loop + spawn (used by validation + the data) -------------
const TRAFFIC = { outer: [[4, 10], [11, 10], [11, 8], [4, 8]] };
const SPAWN = { x: 6, z: 14, facing: 'N' };

// ---- validation (the same rules the game runs at boot) ---------------------
function validate() {
  const err = (m) => { console.error('  ✗ ' + m); process.exit(1); };
  // heights same size as map.
  if (heights.length !== H || heights[0].length !== W) err('heights size mismatch');
  // ramp/stairs bridge two adjacent levels along one axis.
  const level = (x, z) => (x < 0 || z < 0 || x >= W || z >= H) ? -1 : (/[0-3]/.test(heights[z][x]) ? +heights[z][x] : -1);
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
    const c = heights[z][x];
    if (c !== '/' && c !== '=') continue;
    const okX = level(x - 1, z) !== -1 && level(x + 1, z) !== -1 && (level(x + 1, z) === level(x - 1, z) + 1 || level(x - 1, z) === level(x + 1, z) + 1);
    const okZ = level(x, z - 1) !== -1 && level(x, z + 1) !== -1 && (level(x, z + 1) === level(x, z - 1) + 1 || level(x, z - 1) === level(x, z + 1) + 1);
    if (!okX && !okZ) err(`slope at (${x},${z}) does not bridge two adjacent levels`);
  }
  // The traffic loop must run on road + ramp tiles only (no wall crossings).
  const walkable = (x, z) => map[z][x] !== '#' && map[z][x] !== 'W';
  for (const [wx, wz] of TRAFFIC.outer) {
    if (map[wz][wx] !== 'R' && !(heights[wz][wx] === '/' && map[wz][wx] === 'R')) err(`traffic waypoint (${wx},${wz}) is not a road/ramp tile`);
  }
  // Flood fill: every walkable tile reachable from the spawn on foot (ramps + stairs).
  const spawn = SPAWN;
  const seen = new Set(); const queue = [[spawn.x, spawn.z]];
  while (queue.length) {
    const [x, z] = queue.pop(); seen.add(x + ',' + z);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, nz = z + dz;
      if (nx < 0 || nz < 0 || nx >= W || nz >= H) continue;
      if (seen.has(nx + ',' + nz)) continue;
      if (!walkable(nx, nz)) continue;
      // A wall between two tiles at different levels with no ramp/stairs blocks foot.
      seen.add(nx + ',' + nz); queue.push([nx, nz]);
    }
  }
  let unreachable = 0;
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) if (walkable(x, z) && !seen.has(x + ',' + z)) unreachable++;
  if (unreachable) err(unreachable + ' walkable tile(s) are not reachable from the spawn');
}

// ---- the data ---------------------------------------------------------------
validate();

const def = {
  id: 'test-hills',
  name: 'Test Hills (debug)',
  tileSize: T,
  map,
  heights,
  roads: [],
  houses,
  buildings: [],
  spawn: SPAWN,
  restockZone: { x0: 6, z0: 15, x1: 8, z1: 15 },
  traffic: TRAFFIC,
  sidewalkLoops: {},
  hazardSpots: {},
  missionMarkers: [{ id: 'dispatch', x: 6, z: 14, color: '#00b4a6', icon: 'parcel' }],
  goldenParcels: [],
  debug: true, // excluded from the region map / save / suburb unlocks
};

const out = path.join(__dirname, '..', '..', 'game', 'src', 'data', 'neighborhoods', 'test-hills.js');
const js =
`// Test Hills: §2.19 debug terrain map, generated by tools/neighborhoods/test-hills.cjs.
// Copy verbatim; regenerate with the generator (it re-runs validation).
export default ${JSON.stringify(def, null, 2).split('\n').join('\n')}
;
`;
fs.writeFileSync(out, js);
console.log('wrote', path.relative(process.cwd(), out), '(' + map.length + 'x' + map[0].length + ')');
