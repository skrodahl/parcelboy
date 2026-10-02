import * as THREE from 'three';
import { loadTilemap } from './tilemap.js';
import { createChunkGrid } from './chunkGrid.js';
import { buildGround } from './ground.js';
import { createTerrain, tileBaseY } from './terrain.js';
import { buildProps, sidewalkLampPositions } from './props.js';
import { buildCollision } from './collision.js';
import { buildSignMesh, addStreetSigns } from './signs.js';
import { buildBuildings } from './buildings.js';
import { buildLockers, createLockerVisuals } from './lockers.js';
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
  const terrain = createTerrain(tm); // §2.19: null-heights (flat) → all-zero terrain
  tm.terrain = terrain;
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
  const lockerBodies = buildLockers(grid, tm, colliders); // §2.17: the parcel lockers

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
  // M15a.10: key-based, aspect-matched slots. Each slot's w/h (px) matches the
  // sign quad's aspect (see buildings.js / signs.js) so text is never squished,
  // and slots are keyed (not index-based) so a suburb with more/fewer roads or
  // shops can't show the wrong name. Only add slots for buildings that exist.
  const slot = (key, text, bg, fg, h, aspect) => ({ key, text, bg, fg, h, w: Math.round(h * aspect) });
  const slots = [
    ...def.roads.map((r) => slot('street:' + r.name, r.name, '#3d4152', '#fffaf0', 256, 1)),
    ...def.buildings.filter((b) => b.kind === 'shop').map((b) => slot('shop:' + b.id, b.name, b.accent, '#fffaf0', 94, 30 / 7)),
  ];
  const schoolB = def.buildings.find((b) => b.kind === 'school');
  if (schoolB) slots.push(slot('school', schoolB.name.toUpperCase(), '#c8553d', '#fffaf0', 76, 50 / 7));
  const depotB = def.buildings.find((b) => b.kind === 'depot');
  if (depotB) slots.push(slot('depot', 'QUICKBOX', PALETTE.brand, '#fffaf0', 110, 6));
  const numbers = [...new Set(def.houses.map((h) => h.num))].sort((a, b) => a - b);
  const signs = buildSignMesh(signQuads, { slots, numbers });
  signs.mesh.castShadow = true;
  group.add(signs.mesh);

  // School flag: one animated mesh, waved in main.js update().
  let flag = null;
  if (flagGeo) {
    flag = new THREE.Mesh(flagGeo, worldMat);
    flag.position.set(flagPos.x, flagPos.y || 0, flagPos.z); // §2.19: flagpole base at the tile level
    flag.castShadow = true;
    group.add(flag);
  }

  // Lamp light pools: under every sidewalk + porch lamp, visible at glow.
  // §2.19: sidewalk-lamp pools sit on their tile's terrain level (0 on a flat map).
  const poolPts = [
    ...lampPoolPts.map((p) => [p[0], p[1], 0.12]),
    ...sidewalkLampPositions(tm).map((p) => [p.wx, p.wz, tileBaseY(tm, p.tx, p.tz) + 0.12]),
  ];
  // One shared radial disc texture (§7.8): lamp pools here, blob shadows in M4.
  const poolTexture = createPoolTexture();
  const pools = createLampPools(poolPts, poolTexture);
  pools.mesh.visible = !!preset && preset.glow > 0;
  group.add(pools.mesh);

  // §2.17: the locker lights + doors (the dynamic full/empty state).
  const lockers = createLockerVisuals(lockerBodies, group);
  lockers.setAllFull();

  const collision = buildCollision(tm, colliders);
  const porches = buildPorches(tm);
  const doormatPoints = buildDoormats(tm, porches);
  const lots = buildLots(tm);

  return {
    def,
    tilemap: tm,
    terrain,
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
    lockerBodies,
    lockers,
  };
}

// §2.18: free every geometry/material/texture a suburb created, so a
// Maple Hollow → other → Maple Hollow round trip returns renderer.info to the
// same values (no GPU leak). The caller removes `world.group` from the scene
// first; the locker lights/doors (added to the group) are disposed here too.
export function disposeWorld(world) {
  if (!world) return;
  for (const m of world.group.children) {
    if (m.isMesh && m.geometry) m.geometry.dispose();
  }
  world.worldMat.dispose();
  world.waterMat.dispose();
  if (world.glowMesh && world.glowMesh.material) world.glowMesh.material.dispose();
  if (world.signs) {
    if (world.signs.material) world.signs.material.dispose();
    if (world.signs.atlas && world.signs.atlas.texture) world.signs.atlas.texture.dispose();
  }
  if (world.poolTexture) world.poolTexture.dispose();
  if (world.lockers) {
    if (world.lockers.lights) { world.lockers.lights.geometry.dispose(); world.lockers.lights.material.dispose(); }
    if (world.lockers.doors) { world.lockers.doors.geometry.dispose(); world.lockers.doors.material.dispose(); }
  }
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
