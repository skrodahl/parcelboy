import * as THREE from 'three';
import { loadTilemap } from './tilemap.js';
import { createChunkGrid } from './chunkGrid.js';
import { buildGround } from './ground.js';
import { buildProps } from './props.js';
import { buildCollision } from './collision.js';
import { buildStreetSigns } from './signs.js';

// Builds the static world once at boot (§5.3): ground + props merged into 16
// chunks (<= 3 meshes each), the static-collider spatial hash, and the derived
// porch / doormat / lot data (§6.3). Returns a reusable `world` object.
export function buildWorld(def, seed = 1) {
  const tm = loadTilemap(def);
  const grid = createChunkGrid(tm.width, tm.height, seed);
  const colliders = [];
  buildGround(grid, tm, colliders);
  buildProps(grid, tm, colliders);
  const signs = buildStreetSigns(tm, grid); // posts go into chunk builders

  // One shared opaque material for all world geometry (§7.3), plus a translucent
  // water material. FrontSide: VoxelBuilder emits CCW-wound triangles.
  const worldMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const waterMat = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.85 });

  const group = new THREE.Group();
  const chunks = [];
  for (const ch of grid.chunks) {
    const m = new THREE.Mesh(ch.opaque.toGeometry(), worldMat);
    m.userData.chunk = ch;
    group.add(m);
    chunks.push({ cx: ch.cx, cz: ch.cz, mesh: m });
    if (ch.water) {
      const wm = new THREE.Mesh(ch.water.toGeometry(), waterMat);
      group.add(wm);
    }
  }

  signs.mesh.castShadow = true;
  group.add(signs.mesh);

  const collision = buildCollision(tm, colliders);
  const porches = buildPorches(tm);
  const doormatPoints = buildDoormats(tm, porches);
  const lots = buildLots(tm);

  return {
    def,
    tilemap: tm,
    group,
    chunks,
    collision,
    colliders,
    porches,
    doormatPoints,
    lots,
    signs,
    worldMat,
    waterMat,
  };
}

// §6.3: porch zone = the two `o` tiles adjacent to the house per its facing.
function buildPorches(tm) {
  const out = {};
  for (const h of tm.def.houses) {
    const { x, z, facing } = h;
    let a, b;
    if (facing === 'N') { a = [x, z - 1]; b = [x + 1, z - 1]; }
    else if (facing === 'S') { a = [x, z + 2]; b = [x + 1, z + 2]; }
    else if (facing === 'E') { a = [x + 2, z]; b = [x + 2, z + 1]; }
    else { a = [x - 1, z]; b = [x - 1, z + 1]; }
    out[h.id] = { tiles: [a, b], house: h };
  }
  return out;
}

// Doormat point = middle of the two porch tiles, pushed 1.2 units toward the door.
function buildDoormats(tm, porches) {
  const out = {};
  for (const id of Object.keys(porches)) {
    const [a, b] = porches[id].tiles;
    const px = (tm.cx(a[0]) + tm.cx(b[0])) / 2;
    const pz = (tm.cz(a[1]) + tm.cz(b[1])) / 2;
    const h = porches[id].house;
    const hx = tm.cx(h.x) + 2, hz = tm.cz(h.z) + 2; // house footprint center
    const dx = hx - px, dz = hz - pz;
    const d = Math.hypot(dx, dz) || 1;
    out[id] = { x: px + (dx / d) * 1.2, z: pz + (dz / d) * 1.2 };
  }
  return out;
}

// Lot = footprint expanded by 1 tile, clipped to walkable non-road tiles (§6.3).
function buildLots(tm) {
  const out = {};
  for (const h of tm.def.houses) {
    const tiles = [];
    for (let dz = -1; dz <= 2; dz++) {
      for (let dx = -1; dx <= 2; dx++) {
        const x = h.x + dx, z = h.z + dz;
        const key = tm.keyAt(x, z);
        if (tm.isWalkable(x, z) && key !== 'road') tiles.push([x, z]);
      }
    }
    out[h.id] = tiles;
  }
  return out;
}
