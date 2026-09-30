import * as THREE from 'three';
import { loadTilemap } from './tilemap.js';
import { createChunkGrid } from './chunkGrid.js';
import { buildGround } from './ground.js';
import { buildProps, sidewalkLampPositions } from './props.js';
import { buildCollision } from './collision.js';
import { buildSignMesh, addStreetSigns } from './signs.js';
import { buildBuildings } from './buildings.js';
import { GlowBuilder, createGlowMaterial } from './glow.js';
import { createLampPools, createPoolTexture } from './lightPools.js';
import { PALETTE } from '../data/palette.js';

// Builds the static world once at boot (§5.3): ground + props + buildings
// merged into 16 chunks, the shared glow + sign-atlas meshes, the lamp pools,
// the animated school flag, the static-collider hash, and the derived
// porch / doormat / lot data (§6.3). `preset` = the active time-of-day preset
// (its `glow` value bakes the initial window/lamp colors).
export function buildWorld(def, seed = 1, preset) {
  const tm = loadTilemap(def);
  const grid = createChunkGrid(tm.width, tm.height, seed);
  const colliders = [];
  const signQuads = [];
  const lampPoolPts = [];
  buildGround(grid, tm, colliders);
  buildProps(grid, tm, colliders);
  addStreetSigns(grid, tm, signQuads); // sign posts go into chunk builders

  // Glow geometry (windows, lamp heads, lit sign trims) in one shared mesh.
  const glowB = new GlowBuilder();
  for (const p of sidewalkLampPositions(tm)) {
    glowB.box(p.wx, 2.69, p.wz, 0.42, 0.24, 0.42, '#8a8f9e', PALETTE.windowNight);
  }
  const windowRects = {};
  const mailboxes = [];
  const { flagGeo, flagPos } = buildBuildings(grid, tm, glowB, signQuads, colliders, windowRects, lampPoolPts, mailboxes);

  // One shared opaque material for all world geometry (§7.3), plus a
  // translucent water material. FrontSide: builders emit CCW triangles.
  const worldMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const waterMat = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.85 });
  const glowMat = createGlowMaterial();

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

  // Glow mesh, colors blended for the active time of day.
  const glowGeo = glowB.toGeometry();
  glowGeo.__setGlowBlend(preset ? preset.glow : 0);
  const glowMesh = new THREE.Mesh(glowGeo, glowMat);
  group.add(glowMesh);

  // Sign-atlas mesh (all sign quads share one texture + one material).
  const shops = def.buildings.filter((b) => b.kind === 'shop');
  const plates = [
    ...def.roads.map((r) => ({ text: r.name })),
    ...shops.map((s) => ({ text: s.name, bg: s.accent, fg: '#fffaf0' })),
    { text: 'QUICKBOX', bg: PALETTE.brand, fg: '#fffaf0' },
    { text: 'HOLLOW ELEMENTARY', bg: '#c8553d', fg: '#fffaf0' },
  ];
  const numbers = [...new Set(def.houses.map((h) => h.num))].sort((a, b) => a - b);
  const signs = buildSignMesh(signQuads, { plates, numbers });
  signs.mesh.castShadow = true;
  group.add(signs.mesh);

  // School flag: one animated mesh, waved in main.js update().
  let flag = null;
  if (flagGeo) {
    flag = new THREE.Mesh(flagGeo, worldMat);
    flag.position.set(flagPos.x, 0, flagPos.z);
    flag.castShadow = true;
    group.add(flag);
  }

  // Lamp light pools: under every sidewalk + porch lamp, visible at glow.
  const poolPts = [
    ...lampPoolPts.map((p) => [p[0], p[1], 0.12]),
    ...sidewalkLampPositions(tm).map((p) => [p.wx, p.wz, 0.12]),
  ];
  // One shared radial disc texture (§7.8): lamp pools here, blob shadows in M4.
  const poolTexture = createPoolTexture();
  const pools = createLampPools(poolPts, poolTexture);
  pools.mesh.visible = !!preset && preset.glow > 0;
  group.add(pools.mesh);

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
    glowMesh,
    flag,
    pools,
    poolTexture,
    windowRects,
    mailboxes,
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
