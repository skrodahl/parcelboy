import * as THREE from 'three';
import { parseParams } from './core/params.js';
import { createLoop } from './core/loop.js';
import { createDebugOverlay } from './core/debug.js';
import { createRenderer, resizeRenderer } from './render/renderer.js';
import { VoxelBuilder } from './render/voxel.js';
import { createLighting } from './render/lighting.js';
import { createSky } from './render/sky.js';
import { Registry } from './core/registry.js';
import { PALETTE } from './data/palette.js';
import { TIMES_OF_DAY } from './data/timeOfDay.js';
import { buildWorld } from './world/worldBuilder.js';
import { NEIGHBORHOODS } from './data/neighborhoods/index.js';

const params = parseParams();

const todRegistry = new Registry('timeOfDay', ['id', 'sunDir', 'sunColor', 'sunIntensity', 'hemiSky', 'hemiGround', 'hemiIntensity', 'skyZenith', 'skyHorizon']);
for (const p of TIMES_OF_DAY) todRegistry.add(p);
const preset = todRegistry.get(params.tod || 'morning');

const canvas = document.getElementById('game');
const { renderer, quality, name: qualityName, targetFps } = createRenderer(canvas, params.quality || 'high');

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 1, 0.5, 220);
window.addEventListener('resize', () => resizeRenderer(renderer, camera));

// One shared Lambert material for all opaque world geometry (§7.3).
// FrontSide: VoxelBuilder now emits CCW-wound triangles, so back-face
// culling is safe and saves fill on every backend.
const worldMat = new THREE.MeshLambertMaterial({ vertexColors: true });

let sky = null;
let cube = null;
let world = null;
let simTime = 0;

if (params.scene === 'test') {
  // M1 test scene: a sample cottage on a grass plate, lit by time of day.
  camera.position.set(11, 8, 14);
  camera.lookAt(0, 2, 0);

  const gb = new VoxelBuilder(11);
  gb.box(0, -0.5, 0, 60, 0.5, 60, PALETTE.grass[0], { skipFaces: ['bottom'] });
  const ground = new THREE.Mesh(gb.toGeometry(), worldMat);
  ground.receiveShadow = true;
  scene.add(ground);

  const hb = new VoxelBuilder(7);
  const wall = PALETTE.wall[0];
  const roof = PALETTE.roof[0];
  // Walls and anything stacked on another box skip the coplanar bottom face
  // (z-fighting rule: never leave two large faces in the same plane).
  // walls: 8x8 footprint, inset 0.4, 3.2 tall, door on the +z side
  hb.box(0, 0, 3.4, 7.2, 3.2, 0.4, wall, { skipFaces: ['bottom'] });
  hb.box(0, 0, -3.4, 7.2, 3.2, 0.4, wall, { skipFaces: ['bottom'] });
  hb.box(-3.4, 0, 0, 0.4, 3.2, 6.4, wall, { skipFaces: ['bottom'] });
  hb.box(3.4, 0, 0, 0.4, 3.2, 6.4, wall, { skipFaces: ['bottom'] });
  // stepped voxel gable roof
  hb.box(0, 3.2, 0, 8.4, 0.5, 8.4, roof, { skipFaces: ['bottom'] });
  hb.box(0, 3.7, 0, 6.4, 0.5, 6.4, roof, { skipFaces: ['bottom'] });
  hb.box(0, 4.2, 0, 4.4, 0.5, 4.4, PALETTE.roof[4], { skipFaces: ['bottom'] });
  hb.box(0, 4.7, 0, 2.4, 0.5, 2.4, PALETTE.roof[5], { skipFaces: ['bottom'] });
  // door, doormat, porch deck and porch roof
  hb.box(0.8, 0, 3.61, 0.9, 1.8, 0.12, PALETTE.door[0]);
  hb.box(0.8, 0.22, 4.4, 1.2, 0.06, 0.9, PALETTE.brand);
  hb.box(0, 0, 5.0, 3.6, 0.2, 2.0, PALETTE.porch, { skipFaces: ['bottom'] });
  hb.box(0, 2.8, 5.0, 3.8, 0.25, 2.4, roof);
  // windows (day color; glow variants come in M3)
  hb.box(-1.7, 1.0, 3.61, 1.1, 1.1, 0.12, PALETTE.windowDay);
  hb.box(2.3, 1.0, 3.61, 1.1, 1.1, 0.12, PALETTE.windowDay);
  hb.box(3.61, 1.0, -0.8, 0.12, 1.1, 1.1, PALETTE.windowDay);
  // flower boxes and round shrubs: the cottage signature
  hb.box(-1.7, 0.55, 3.75, 1.2, 0.25, 0.25, PALETTE.roof[1]);
  hb.box(2.3, 0.55, 3.75, 1.2, 0.25, 0.25, PALETTE.roof[1]);
  hb.box(-2.8, 0, 4.6, 0.9, 0.6, 0.9, PALETTE.canopy[0], { skipFaces: ['bottom'] });
  hb.box(2.6, 0, 4.8, 0.7, 0.5, 0.7, PALETTE.canopy[1], { skipFaces: ['bottom'] });
  const house = new THREE.Mesh(hb.toGeometry(), worldMat);
  house.castShadow = true;
  // The ground receives the house shadow ("shadow under the house"). The
  // house does not receive its own shadow in this test scene; the real
  // world (M2) merges static chunks and handles self-shadowing there.
  scene.add(house);

  const lighting = createLighting(scene, preset);
  if (quality.shadowSize > 0) {
    lighting.sun.castShadow = true;
    lighting.sun.shadow.mapSize.set(quality.shadowSize, quality.shadowSize);
    lighting.sun.shadow.bias = -0.0008;
    // Ortho extent covers the roof's ground shadow at this sun elevation
    // (5.2 tall roof; more extent for a lower sun).
    const elev = Math.asin(preset.sunDir[1] / Math.hypot(preset.sunDir[0], preset.sunDir[1], preset.sunDir[2]));
    const extent = Math.max(14, 5.2 / Math.tan(elev) + 6);
    const sc = lighting.sun.shadow.camera;
    sc.left = -extent; sc.right = extent; sc.top = extent; sc.bottom = -extent;
    sc.near = 5; sc.far = 160;
    sc.updateProjectionMatrix();
  }
  sky = createSky(scene, preset);
  sky.update(0, 0); // place the clouds even if the sim starts paused
} else if (params.scene === 'cube') {
  // M0 placeholder: a spinning cube (kept as a regression scene).
  camera.position.set(0, 5, 9);
  camera.lookAt(0, 1, 0);
  scene.background = new THREE.Color('#8ecae6');
  scene.add(new THREE.HemisphereLight(0xbde0fe, 0xb7e4a0, 1.1));
  const sun = new THREE.DirectionalLight(0xffe3c2, 2.4);
  sun.position.set(-24, 22, -12);
  scene.add(sun);
  cube = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshLambertMaterial({ color: '#00b4a6' }));
  cube.position.y = 1.5;
  scene.add(cube);
  const gb = new VoxelBuilder(11);
  gb.box(0, -0.5, 0, 60, 0.5, 60, PALETTE.grass[0], { skipFaces: ['bottom'] });
  scene.add(new THREE.Mesh(gb.toGeometry(), worldMat));
} else {
  // M2+: the neighborhood world, built once and reused by every state (§5.3).
  world = buildWorld(NEIGHBORHOODS[0]);
  scene.add(world.group);
  for (const ch of world.chunks) { ch.mesh.castShadow = true; ch.mesh.receiveShadow = true; }
  const lighting = createLighting(scene, preset);
  if (quality.shadowSize > 0) {
    lighting.sun.castShadow = true;
    lighting.sun.shadow.mapSize.set(quality.shadowSize, quality.shadowSize);
    lighting.sun.shadow.bias = -0.0006;
    const sc = lighting.sun.shadow.camera;
    sc.left = -110; sc.right = 110; sc.top = 110; sc.bottom = -110;
    sc.near = 5; sc.far = 400;
    sc.updateProjectionMatrix();
  }
  sky = createSky(scene, preset);
  sky.update(0, 0);
  applyCamPreset(camera, params.cam || 'overview');
}
resizeRenderer(renderer, camera);

// Menu / screenshot camera presets (§7.9). Full follow-cam lands in M4.
function applyCamPreset(cam, name) {
  const t = world ? world.tilemap : null;
  if (t) {
    const cx = (t.width / 2) * t.tileSize, cz = (t.height / 2) * t.tileSize;
    const p = {
      overview: { pos: [cx, 104, cz + 78], look: [cx, 0, cz] },
      street:   { pos: [16, 3, (17 + 1) * 4], look: [96, 2, (17 + 1) * 4] },
      park:     { pos: [40, 16, 118], look: [40, 0, 142] },
      depot:    { pos: [158, 8, 128], look: [158, 2, 148] },
    };
    if (p[name]) { cam.position.set(...p[name].pos); cam.lookAt(...p[name].look); return; }
  }
  cam.position.set(0, 8, 14);
  cam.lookAt(0, 2, 0);
}

let simPaused = params.paused;
function update(dt) {
  simTime += dt;
  if (sky) sky.follow(camera); // dome tracks the cam so it is always enclosed
  if (simPaused) return;
  if (cube) cube.rotation.y += dt * 0.8;
  if (sky) sky.update(dt, simTime);
}

let ready = false;
function render() {
  renderer.render(scene, camera);
  if (!ready) {
    ready = true;
    window.__pb.ready = true;
  }
}

const loop = createLoop({ update, render, targetFps });

const gameState = { name: 'boot' };

function stats() {
  return {
    fps: loop.fps(),
    frameMs: loop.frameMs(),
    drawCalls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
    geometries: renderer.info.memory.geometries,
    textures: renderer.info.memory.textures,
    actors: 0,
    quality: qualityName,
    state: gameState.name,
  };
}

if (params.debug) createDebugOverlay(stats);

window.__pb = {
  ready: false,
  stats,
  state() {
    return {
      gameState: gameState.name,
      score: 0,
      streak: 0,
      carried: 0,
      remaining: 0,
      time: 0,
      player: { x: 0, z: 0, heading: 0, speed: 0 },
    };
  },
  // Stubs: implemented in later milestones.
  setCam() {},
  setTimeOfDay() {},
  teleport() {},
  press() {},
  throwAt() {},
  step() {},
  startShift() {},
  freeRoam() {},
  setWaypoint() {},
  abandonMission() {},
  setHeat() {},
  goto() {},
  autoplay() {},
};
