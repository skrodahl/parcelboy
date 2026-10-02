// Cuts Maple Hollow's exit roads (§2.18) — the one allowed edit to §6.1's data.
//
// Maple Hollow's original generator isn't in the repo, so this tool reads the
// committed data file, cuts ONE 2-wide road gap through the 2-tile forest border
// for each exit (north → Cedar Heights, east → Lakeside, west → Old Town), and
// re-runs the same layout validation the game runs at boot before writing the
// file back. No other layout change is made. Exits to suburbs that don't exist
// yet (M15–M17) stay locked barriers.
//
// Plain Node, no packages. Run inside the shots container:
//   node /tools/neighborhoods/maple-hollow-exits.cjs

const fs = require('fs');
const path = require('path');

const DATA = path.join(__dirname, '..', '..', 'game', 'src', 'data', 'neighborhoods', 'maple-hollow.js');

// ---- load the committed def -------------------------------------------------
// The file is `export default {...};` — strip the wrapper and eval the plain
// object literal (our own generated data: no side effects).
function loadDef() {
  const raw = fs.readFileSync(DATA, 'utf8');
  const objSrc = raw.replace(/^.*?export default\s*/s, '').replace(/;\s*$/, '');
  return (0, eval)('(' + objSrc + ')');
}

// ---- cut the exit road gaps -------------------------------------------------
// Each exit's `tiles[0]` is the interior trigger tile; the gap is cut on the
// exit's edge, 2 tiles wide (a road is 2 tiles in this map), aligned to it.
function carveExits(def) {
  const rows = def.map;
  const H = rows.length, W = rows[0].length;
  const setR = (x, z) => {
    const r = rows[z];
    if (r[x] !== '#') throw new Error(`exit carve at (${x},${z}) is not forest ('${r[x]}') — refusing to touch the layout`);
    rows[z] = r.slice(0, x) + 'R' + r.slice(x + 1);
  };
  const carved = [];
  for (const e of def.exits || []) {
    const [ex, ez] = e.tiles[0];
    const cells = [];
    if (e.edge === 'N') for (let z = 0; z <= 1; z++) for (let x = ex; x <= ex + 1; x++) cells.push([x, z]);
    else if (e.edge === 'S') for (let z = H - 2; z <= H - 1; z++) for (let x = ex; x <= ex + 1; x++) cells.push([x, z]);
    else if (e.edge === 'E') for (let z = ez; z <= ez + 1; z++) for (let x = W - 2; x <= W - 1; x++) cells.push([x, z]);
    else if (e.edge === 'W') for (let z = ez; z <= ez + 1; z++) for (let x = 0; x <= 1; x++) cells.push([x, z]);
    else throw new Error(`exit '${e.id}' has unknown edge '${e.edge}'`);
    for (const [x, z] of cells) setR(x, z);
    carved.push({ id: e.id, edge: e.edge, cells: cells.length });
  }
  return carved;
}

// ---- re-validate (the same rules the game runs at boot) ---------------------
function validate(def) {
  const rows = def.map;
  const H = rows.length, W = rows[0].length;
  const walkable = (x, z) => x >= 0 && z >= 0 && x < W && z < H &&
    (def.map[z][x] !== '#' && def.map[z][x] !== 'W' && def.map[z][x] !== 'H' && def.map[z][x] !== 'X');
  // Flood fill: every walkable tile reachable from the spawn (a flat map, so no walls).
  const sp = def.spawn;
  const seen = new Set([sp.x + ',' + sp.z]);
  const q = [[sp.x, sp.z]];
  while (q.length) {
    const [x, z] = q.pop();
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, nz = z + dz;
      if (nx < 0 || nz < 0 || nx >= W || nz >= H) continue;
      if (!walkable(nx, nz) || seen.has(nx + ',' + nz)) continue;
      seen.add(nx + ',' + nz);
      q.push([nx, nz]);
    }
  }
  let unreachable = 0;
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) if (walkable(x, z) && !seen.has(x + ',' + z)) unreachable++;
  if (unreachable) throw new Error(unreachable + ' walkable tile(s) unreachable from the spawn');
  // Each exit's trigger tile sits on the border ring and is walkable after the cut.
  for (const e of def.exits || []) {
    const [ex, ez] = e.tiles[0];
    const nearEdge = ex <= 3 || ez <= 3 || ex >= W - 4 || ez >= H - 4;
    if (!nearEdge) throw new Error(`exit '${e.id}' tile (${ex},${ez}) is not on the map edge`);
    if (!walkable(ex, ez)) throw new Error(`exit '${e.id}' tile (${ex},${ez}) is not walkable`);
  }
}

// ---- main -------------------------------------------------------------------
const def = loadDef();
const carved = carveExits(def);
validate(def);

const out =
`// Maple Hollow: generated and validated. Copy verbatim. x = column, z = row, (0,0) = north-west corner.
// §2.18: the exit road gaps (forest → road) are cut by tools/neighborhoods/maple-hollow-exits.cjs —
// the one allowed edit to §6.1's layout. Regenerate with that tool (it re-runs validation).
export default ${JSON.stringify(def, null, 2).split('\n').join('\n')}
;
`;
fs.writeFileSync(DATA, out);
console.log('wrote', path.relative(process.cwd(), DATA));
for (const c of carved) console.log(`  cut exit '${c.id}' (${c.edge}): ${c.cells} road tiles through the forest border`);
