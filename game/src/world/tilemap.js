// Tile legend (PLAN §6.2) + loader that validates the neighborhood map (§6.2).
// Coordinates (PLAN §5.1): tile (x,z) covers world [x*T, x*T+T] x [z*T, z*T+T],
// center ((x+0.5)*T, (z+0.5)*T). +Y is up, North is -Z.

export const TILES = {
  '#': { key: 'forest',   walkable: false }, // solid; dark grass + dense trees
  '.': { key: 'yard',     walkable: true },  // lawn
  R:   { key: 'road',     walkable: true },  // asphalt
  s:   { key: 'sidewalk', walkable: true },  // raised concrete slab
  o:   { key: 'porch',    walkable: true },  // raised wooden deck; porch zone of adjacent house
  d:   { key: 'driveway', walkable: true },  // raised light concrete
  H:   { key: 'house',    walkable: false }, // collider from houses; grass underneath
  X:   { key: 'building', walkable: false }, // collider from buildings; grass underneath
  t:   { key: 'tree',     walkable: true },  // one tree (trunk is a solid circle)
  P:   { key: 'park',     walkable: true },  // brighter lawn / playground
  p:   { key: 'path',     walkable: true },  // sandy park path
  W:   { key: 'pond',     walkable: false }, // solid; water
  L:   { key: 'lot',      walkable: true },  // asphalt parking lot
};

// Raised-to-curb surface heights (§5.1): sidewalks, porches, driveways sit at 0.12.
const RAISED = { sidewalk: 0.12, porch: 0.12, driveway: 0.12 };

function rectTiles(x, z, w, d) {
  const out = [];
  for (let dz = 0; dz < d; dz++) for (let dx = 0; dx < w; dx++) out.push((x + dx) + ',' + (z + dz));
  return out;
}

import { validateLayout } from './layoutValidate.js';

// Parses + validates a neighborhood def (§6.2). Throws a clear error on any problem.
export function loadTilemap(def) {
  const rows = def.map;
  const height = rows.length;
  const width = rows[0].length;
  for (let z = 0; z < height; z++) {
    if (rows[z].length !== width) {
      throw new Error(`tilemap ${def.id}: row ${z} has ${rows[z].length} chars, expected ${width}`);
    }
    for (let x = 0; x < width; x++) {
      if (!TILES[rows[z][x]]) throw new Error(`tilemap ${def.id}: unknown char '${rows[z][x]}' at (${x},${z})`);
    }
  }

  // H tiles must exactly match the 2x2 house footprints; X tiles the building footprints.
  const expectH = new Set(def.houses.flatMap((h) => rectTiles(h.x, h.z, 2, 2)));
  const expectX = new Set(def.buildings.flatMap((b) => rectTiles(b.x, b.z, b.w, b.d)));
  const seenH = new Set();
  const seenX = new Set();
  for (let z = 0; z < height; z++) {
    for (let x = 0; x < width; x++) {
      const c = rows[z][x];
      if (c === 'H') seenH.add(x + ',' + z);
      else if (c === 'X') seenX.add(x + ',' + z);
    }
  }
  const extraH = [...seenH].filter((k) => !expectH.has(k));
  const extraX = [...seenX].filter((k) => !expectX.has(k));
  if (extraH.length) throw new Error(`tilemap ${def.id}: H tiles not in a house footprint: ${extraH.slice(0, 5)}`);
  if (extraX.length) throw new Error(`tilemap ${def.id}: X tiles not in a building footprint: ${extraX.slice(0, 5)}`);
  if (seenH.size !== expectH.size || seenX.size !== expectX.size) {
    throw new Error(`tilemap ${def.id}: footprint tile count mismatch (H ${seenH.size}/${expectH.size}, X ${seenX.size}/${expectX.size})`);
  }

  // §2.17: parcel lockers must sit on walkable sidewalk tiles.
  if (def.parcelLockers) {
    for (const [lx, lz] of def.parcelLockers) {
      const c = rows[lz] ? rows[lz][lx] : '#';
      if (!TILES[c] || !TILES[c].walkable) throw new Error(`tilemap ${def.id}: parcel locker at (${lx},${lz}) is not walkable`);
      if (TILES[c].key !== 'sidewalk') throw new Error(`tilemap ${def.id}: parcel locker at (${lx},${lz}) must be on a sidewalk tile`);
    }
  }

  // §2.19: an optional heights layer must match the map size; chars are
  // '0'..'3' (levels), '/' (ramp), '=' (stairs). The bridge + reachability rules
  // are checked by createTerrain / the map generator.
  if (def.heights) {
    const hr = def.heights;
    if (hr.length !== height) throw new Error(`tilemap ${def.id}: heights has ${hr.length} rows, expected ${height}`);
    for (let z = 0; z < height; z++) {
      if (hr[z].length !== width) throw new Error(`tilemap ${def.id}: heights row ${z} has ${hr[z].length} chars, expected ${width}`);
      for (let x = 0; x < width; x++) {
        const c = hr[z][x];
        if (!((c >= '0' && c <= '3') || c === '/' || c === '=')) {
          throw new Error(`tilemap ${def.id}: unknown heights char '${c}' at (${x},${z})`);
        }
      }
    }
  }

  const t = def.tileSize;
  const tm = {
    def,
    id: def.id,
    width,
    height,
    tileSize: t,
    // Out-of-bounds reads as forest (solid border).
    charAt(x, z) {
      if (x < 0 || z < 0 || x >= width || z >= height) return '#';
      return rows[z][x];
    },
    keyAt(x, z) {
      return TILES[this.charAt(x, z)].key;
    },
    isWalkable(x, z) {
      return TILES[this.charAt(x, z)].walkable;
    },
    // World position of a tile center / edge.
    cx(x) { return (x + 0.5) * t; },
    cz(z) { return (z + 0.5) * t; },
    minX(x) { return x * t; },
    minZ(z) { return z * t; },
    // Surface height for a tile key (curbs raise s/o/d to 0.12, §5.1).
    surfH(key) {
      return RAISED[key] || 0;
    },
    // §2.19: the raw heights layer (or null when the neighborhood is flat).
    heights: def.heights || null,
    hasHeights: !!def.heights,
    heightCharAt(x, z) {
      if (!def.heights) return '0';
      const c = (z >= 0 && z < height && x >= 0 && x < width) ? def.heights[z][x] : '0';
      return c;
    },
  };
  // §2.18/§2.19: boot-time layout checks (reachability, traffic, porches, exits).
  validateLayout(tm);
  return tm;
}
