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
import { CHARACTERS } from './data/characters.js';
import { VEHICLES } from './data/vehicles.js';
import { createInput } from './core/input.js';
import { createPlayer } from './entities/player.js';
import { buildCourier } from './entities/courierModel.js';
import { buildModel } from './entities/vehicleModels.js';
import { createBlobShadows } from './entities/blobShadows.js';
import { createFollowCam } from './render/camera.js';
import { PARCEL, FREE_ROAM, HAZARD, CARTOON } from './data/config.js';
import { SHIFTS, MAIN_SHIFTS } from './data/shifts.js';
import { createDelivery } from './gameplay/delivery.js';
import { createMission } from './gameplay/mission.js';
import { createHazards } from './gameplay/hazards.js';
import { createEffects } from './render/effects.js';
import { createFloatText } from './render/floatText.js';

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
let lighting = null;
let cube = null;
let world = null;
let simTime = 0;
// M4 dynamic actors (assigned in the world branch; null in menus/test scenes).
let player = null;
let vehicleMesh = null;
let blobs = null;
let followCam = null;
let delivery = null; // M5 interim delivery session (M6 replaces with shifts)
let mission = null; // M6 active shift runner (null in free roam)
let hud = null; // M6 HUD (free-roam chip + mission timer/score)
let activeChar = null, activeVeh = null; // the spawned courier/vehicle
let resultsEl = null; // the results-screen DOM (M6)
let shiftCardEl = null; // the dispatch mission-card DOM (M6)
let hazards = null; // M7 hazard manager (free-roam or per-shift counts)
let sharedEffects = null, sharedFloatText = null; // M7: created once, shared by hazards + delivery
let hitStopUntil = 0; // M7: §2.12 hit-stop (sim-time the sim freezes on a knockdown)
// M5 interim: 5 fixed houses are delivery targets until M6 adds shifts.
const M5_TARGETS = ['h01', 'h06', 'h09', 'h17', 'h22'];
const lineup = [];
const input = createInput();
const camTgt = { pos: null, heading: 0, speed: 0, speedFrac: 0 }; // follow-cam scratch
const gameState = { name: 'boot' };
// The camera's current look-at target (allocation-free; updated by presets).
// Fog + far clip scale with the distance from the camera to this point (§7.3).
const camLook = new THREE.Vector3(0, 0, 0);

if (params.scene === 'test') {
  // M1 test scene: a sample cottage on a grass plate, lit by time of day.
  camera.position.set(11, 8, 14);
  camera.lookAt(0, 2, 0);
  camLook.set(0, 2, 0);

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
  camLook.set(0, 1, 0);
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
  world = buildWorld(NEIGHBORHOODS[0], 1, preset);
  scene.add(world.group);
  for (const ch of world.chunks) { ch.mesh.castShadow = true; ch.mesh.receiveShadow = true; }
  lighting = createLighting(scene, preset);
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

  // M4: dynamic actors (courier + vehicle) on top of the static world.
  const charRegistry = new Registry('character', ['id', 'name', 'build', 'colors', 'stats', 'ability']);
  for (const c of CHARACTERS) charRegistry.add(c);
  const vehRegistry = new Registry('vehicle', ['id', 'name', 'model', 'riding', 'stats', 'canJump']);
  for (const v of VEHICLES) vehRegistry.add(v);
  followCam = null;
  if (params.lineup) {
    // M4 temporary debug: all 5 couriers side by side in the showroom
    // (in front of the Distribution Center), facing the cam.
    const xs = [148, 153, 158, 163, 168];
    CHARACTERS.forEach((c, i) => {
      const rig = buildCourier(c, world.worldMat);
      // Spawn row (z=138), one row in front of the parked vans (z≈142) so all
      // 5 stay visible against the depot facade.
      rig.group.position.set(xs[i], 0, 138);
      rig.group.rotation.y = Math.PI;
      rig._anim = { speedFrac: 0, moving: 0, wave: i % 2, riding: 'walk', air: -1, fall: 0, t: i * 0.37 };
      rig.update(0, rig._anim);
      lineup.push(rig);
      scene.add(rig.group);
    });
    applyCamPreset(camera, 'showroom');
  } else {
    // M6: free roam is the hub state (§2.13). `?autostart=<shiftId>` starts that
    // shift; `?autostart=freeroam` or no autostart = plain free roam at the depot.
    const charDef = charRegistry.get(params.char || 'pip');
    const vehDef = vehRegistry.get(params.veh || 'feet');
    spawnCourier(charDef, vehDef);
    buildHUD();
    if (params.screen === 'results') showResults({ shift: 'morning', success: true, score: 3420, stars: 2, coins: 340, timeBonus: 120, delivered: 10, total: 10 });
    else if (params.showCard) showShiftCard();
    if (params.autostart && params.autostart !== 'freeroam' && SHIFTS.some((s) => s.id === params.autostart)) startShift(params.autostart);
  }
}

// M6: spawn the courier + vehicle + follow cam at the depot, free roam.
function spawnCourier(charDef, vehDef) {
  activeChar = charDef; activeVeh = vehDef;
  const rig = buildCourier(charDef, world.worldMat);
  scene.add(rig.group);
  const vehicleMesh = buildModel(vehDef.model, world.worldMat);
  if (vehicleMesh) scene.add(vehicleMesh);
  blobs = createBlobShadows(16, world.poolTexture);
  scene.add(blobs.mesh);
  player = createPlayer({ charDef, vehDef, rig, vehicleMesh, world, onBonk: (amount) => { if (followCam) followCam.shake(amount); } });
  followCam = createFollowCam(camera, world.collision);
  camTgt.pos = player.pos; camTgt.heading = player.heading;
  player.syncVisuals(0, simTime);
  blobs.set(0, player.pos.x, player.pos.z, 1.4);
  blobs.flush();
  followCam.snap(camTgt, camLook);
  gameState.name = 'freeRoam';
  // M7: shared effects/float-text (used by hazards + delivery) + free-roam hazards.
  if (!sharedEffects) { sharedEffects = createEffects(scene); sharedFloatText = createFloatText(document.getElementById('ui'), camera, renderer); }
  setHazards(FREE_ROAM.hazards);
}

// M7: (re)create the hazard manager for a set of counts. Free roam uses the
// FREE_ROAM levels; a shift uses its own (`hazards: null` → free-roam levels).
function setHazards(counts) {
  if (!player || !sharedEffects) return;
  if (hazards) { hazards.dispose(); hazards = null; }
  hazards = createHazards({
    scene, world, def: world.def, charDef: activeChar, counts: counts || FREE_ROAM.hazards,
    effects: sharedEffects, floatText: sharedFloatText, player,
    onKnockdown, parcels: delivery ? delivery.parcels : null,
    onDogSteal: () => { if (delivery) delivery.dropParcel(true); },
    onDogRecover: () => { if (delivery) delivery.recoverParcel(); },
    onHop: () => { if (delivery) { delivery.addScore(25); sharedFloatText.pop('Hop! +25', player.pos.x, 2, player.pos.z, { color: '#a7c957' }); } },
  });
}

// §2.6 knockdown: camera shake + hit-stop + drop a parcel (in a mission) + dust.
function onKnockdown(kind) {
  if (!player) return;
  if (followCam) followCam.shake(HAZARD.knockdownShake);
  hitStopUntil = simTime + (CARTOON.enabled ? CARTOON.hitStopMs : 0) / 1000;
  if (delivery) delivery.dropParcel(false);
  sharedEffects.dust(player.pos.x, 0.6, player.pos.z);
  void kind;
}

// §2.10: start a shift by id. Builds the mission (targets + timer) and a
// delivery session with per-target packages.
function startShift(shiftId) {
  if (!player || (mission && mission.active)) return;
  const shift = SHIFTS.find((s) => s.id === shiftId);
  if (!shift) return;
  const seed = params.seed || 1;
  setHazards(shift.hazards || FREE_ROAM.hazards); // before the delivery so it can read the live set
  mission = createMission({ def: world.def, shift, seed, onResults: (r) => showResults(r) });
  delivery = setupDelivery(activeChar, activeVeh, mission.targetDefs, shift.packageMix, seed, sharedEffects, sharedFloatText);
  mission.start(delivery);
  player.setCarried(delivery.carried);
  // §2.13: snap to the shift's time of day (a 2 s blend lands in M10's day cycle).
  if (shift.timeOfDay) { const p = todRegistry.get(shift.timeOfDay); if (p && lighting) { lighting.apply(p); if (sky) sky.apply(p); } }
  gameState.name = 'mission';
  if (hud) hud.missionStart(delivery, shift);
}

// §2.11: end the shift (timer / all-delivered / abandon). `retry` re-starts the
// same shift from the pickup; otherwise continue back into free roam.
function endShift(retry) {
  if (delivery) delivery.floatText.clear();
  delivery = null;
  if (mission) mission = null;
  gameState.name = 'freeRoam';
  if (hud) hud.missionEnd();
  setHazards(FREE_ROAM.hazards);
  if (retry) startShift(retry);
}

function el(tag, cls, txt) { const n = document.createElement(tag); if (cls) n.className = cls; if (txt) n.textContent = txt; return n; }

// §2.13 + §10: the free-roam chip + the mission HUD (timer / targets / next /
// score). Built once; `tick` refreshes the live values each sim step.
function buildHUD() {
  if (hud) return;
  const ui = document.getElementById('ui');
  const chip = el('div', 'hud-chip', 'FREE ROAM');
  const coins = el('div', 'hud-coins', '0');
  const panel = el('div', 'hud-mission');
  const pName = el('div', 'hud-mission-name');
  const pTimer = el('div', 'hud-mission-timer');
  const pTargets = el('div', 'hud-mission-targets');
  const pNext = el('div', 'hud-mission-next');
  const pScore = el('div', 'hud-mission-score');
  panel.append(pName, pTimer, pTargets, pNext, pScore);
  panel.style.display = 'none';
  ui.append(chip, coins, panel);
  hud = {
    chip, coins, panel, pName, pTimer, pTargets, pNext, pScore,
    missionStart(session, shift) {
      this.panel.style.display = ''; this.chip.style.display = 'none';
      this.pName.textContent = shift.name; this.pNext.textContent = 'next: ' + (session.targets[0] ? session.targets[0].pkg.name : '—');
    },
    missionEnd() { this.panel.style.display = 'none'; this.chip.style.display = ''; },
    tick(mission2, session) {
      if (!session) return;
      const m = Math.max(0, mission2.timer);
      this.pTimer.textContent = Math.floor(m / 60) + ':' + String(Math.floor(m % 60)).padStart(2, '0');
      this.pTargets.textContent = (session.targets.length - session.remaining()) + '/' + session.targets.length + ' delivered';
      this.pScore.textContent = 'score ' + session.scoring.score + '  ×' + session.scoring.multiplier();
      const nx = session.nextUndelivered();
      this.pNext.textContent = nx ? 'next: ' + nx.pkg.name : 'all delivered';
    },
  };
}

// §2.1 / §10: the results screen (functional; polished in M8).
function showResults(res) {
  endShift(false);
  if (resultsEl) { resultsEl.remove(); resultsEl = null; }
  resultsEl = el('div', 'results');
  const stars = '★'.repeat(res.stars) + '☆'.repeat(Math.max(0, 3 - res.stars));
  resultsEl.append(
    el('h2', 'results-title', res.success ? 'Shift complete!' : "Time's up"),
    el('div', 'results-stars', stars),
    el('div', 'results-score', 'Score ' + res.score + (res.timeBonus ? ' (+' + res.timeBonus + ' time bonus)' : '')),
    el('div', 'results-detail', res.delivered + '/' + res.total + ' delivered · +' + res.coins + ' coins'),
  );
  const btnC = el('button', 'results-btn', 'Continue');
  const btnR = el('button', 'results-btn', 'Retry');
  btnC.onclick = () => { resultsEl.remove(); resultsEl = null; };
  btnR.onclick = () => { const id = res.shift; resultsEl.remove(); resultsEl = null; startShift(id); };
  resultsEl.append(btnC, btnR);
  document.getElementById('ui').append(resultsEl);
}

// §2.10: the dispatch card, paged through the main shifts. Shown at the
// dispatch marker in free roam; `?showCard=1` forces it for the m6-card shot.
function showShiftCard() {
  if (shiftCardEl) { shiftCardEl.remove(); shiftCardEl = null; return; }
  shiftCardEl = el('div', 'shift-card');
  shiftCardEl.append(el('h3', null, 'Quickbox Dispatch'));
  const list = el('div');
  for (const s of MAIN_SHIFTS) {
    const row = el('div');
    row.textContent = s.name + ' — ' + s.deliveries + ' drops · ' + s.duration + 's' + (s.unlockStars ? ' · ' + s.unlockStars + '★' : '');
    list.append(row);
  }
  shiftCardEl.append(list, el('div', 'sc-cta', 'Press ENTER to start a shift'));
  document.getElementById('ui').append(shiftCardEl);
}

// Setup a delivery session for an explicit target list + package mix (M6 shifts
// and the M5 interim both go through this). `charDef`/`vehDef` come from the
// currently-spawned courier.
function setupDelivery(charDef, vehDef, targetDefs, packageMix, seed, effects, floatText) {
  return createDelivery({ world, camera, renderer, scene, player, input, charDef, vehDef, targets: targetDefs || M5_TARGETS, seed, ui: document.getElementById('ui'), packageMix, effects, floatText, hazards });
}
resizeRenderer(renderer, camera);

// Menu / screenshot camera presets (§7.9). Full follow-cam lands in M4.
// Every path records the look target in camLook so the distance-scaled fog
// (§7.3 plan change) can run each frame.
function applyCamPreset(cam, name) {
  const t = world ? world.tilemap : null;
  if (t) {
    const cx = (t.width / 2) * t.tileSize, cz = (t.height / 2) * t.tileSize;
    const p = {
      // High, south of the map: frames the entire 48x40 grid, including the
      // south strip (park + Distribution Center). Look target sits just north
      // of center so the map is vertically centered.
       overview: { pos: [cx, 170, cz + 130], look: [cx, 0, cz - 4] },
       street:   { pos: [16, 3, (17 + 1) * 4], look: [96, 2, (17 + 1) * 4] },
       park:     { pos: [40, 16, 118], look: [40, 0, 142] },
       depot:    { pos: [158, 8, 128], look: [158, 2, 148] },
       // M4 lineup: elevated look at the courier row; high enough to see
       // over the parked vans (2.8u tall), far enough for all 5, with the
       // depot + lit QUICKBOX sign as backdrop.
       showroom: { pos: [158, 6, 124], look: [158, 1.4, 140] },
    };
    if (name.startsWith('porch:')) {
      const id = name.slice(6);
      const h = t.def.houses.find((x) => x.id === id);
      const mat = world.doormatPoints[id];
      if (h && mat) {
        const f = { N: [0, 0, -1], S: [0, 0, 1], E: [1, 0, 0], W: [-1, 0, 0] }[h.facing];
        cam.position.set(mat.x + f[0] * 6.5, 2.8, mat.z + f[2] * 6.5);
        cam.lookAt(mat.x, 1.4, mat.z);
        camLook.set(mat.x, 1.4, mat.z);
        return;
      }
    }
    if (p[name]) {
      cam.position.set(...p[name].pos);
      cam.lookAt(...p[name].look);
      camLook.set(...p[name].look);
      return;
    }
  }
  cam.position.set(0, 8, 14);
  cam.lookAt(0, 2, 0);
  camLook.set(0, 2, 0);
}

let simPaused = params.paused;

// One fixed sim step for the playing core: player kinematics + visuals, the
// follow cam, and the blob shadow. Called by update() each fixed step, or
// manually by __pb.step() while paused.
function simStep(dt) {
  // §2.12 hit-stop: on a knockdown the world freezes ~70 ms (dramatic beat).
  if (simTime < hitStopUntil) return;
  if (hazards) hazards.step(dt);
  if (player) {
    player.update(dt, input, simTime);
    player.syncVisuals(dt, simTime);
    if (blobs) {
      blobs.set(0, player.pos.x, player.pos.z, 1.4 + Math.min(1, Math.abs(player.speed) / 12) * 0.4);
      blobs.flush();
    }
    if (followCam) {
      camTgt.pos = player.pos;
      camTgt.heading = player.heading;
      camTgt.speed = player.speed;
      camTgt.speedFrac = Math.min(1, Math.abs(player.speed) / 12);
      followCam.update(dt, simTime, camTgt, camLook);
    }
  }
  if (delivery) {
    delivery.handleInput();
    delivery.updateDoorstep(dt);
    delivery.parcels.step(dt);
    delivery.npcs.step(dt);
    delivery.markers.update(dt, simTime, player ? player.pos.x : 0, player ? player.pos.z : 0);
  }
  // M7: shared effects + float text (the delivery session uses these same ones).
  if (sharedEffects) sharedEffects.step(dt);
  if (sharedFloatText) sharedFloatText.step(dt);
  if (mission && hud) {
    mission.update(dt); // may fire end() → showResults()
    hud.tick(mission, delivery);
  }
  for (let i = 0; i < lineup.length; i++) lineup[i].update(dt, lineup[i]._anim);
}

function update(dt) {
  simTime += dt;
  if (sky) sky.follow(camera); // dome tracks the cam so it is always enclosed
  if (world && world.flag) world.flag.rotation.y = Math.sin(simTime * 2.0) * 0.3;
  // Distance-scaled fog + far clip (§7.3 plan change): near/far track the
  // camera's distance d to its look target, updated every frame with no
  // allocation. updateProjectionMatrix only when far actually changes.
  const d = camera.position.distanceTo(camLook);
  if (scene.fog) { scene.fog.near = d + 45; scene.fog.far = d + 150; }
  const far = Math.max(220, d + 260);
  if (far !== camera.far) { camera.far = far; camera.updateProjectionMatrix(); }
  if (delivery) delivery.floatText.sync(); // project live text (also while paused)
  if (simPaused) return;
  if (cube) cube.rotation.y += dt * 0.8;
  if (sky) sky.update(dt, simTime);
  simStep(dt);
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
      score: delivery ? delivery.scoring.score : 0,
      streak: delivery ? delivery.scoring.streak : 0,
      multiplier: delivery ? delivery.scoring.multiplier() : 1,
      carried: delivery ? delivery.carried : 0,
      remaining: delivery ? delivery.remaining() : 0,
      lastResult: delivery ? delivery.lastResult : null,
      time: simTime,
      player: player
        ? { x: player.pos.x, z: player.pos.z, heading: (player.heading * 180) / Math.PI, speed: player.speed }
        : { x: 0, z: 0, heading: 0, speed: 0 },
    };
  },
  setCam(name) {
    applyCamPreset(camera, name);
  },
  setTimeOfDay() {},
  teleport(tileX, tileZ, headingDeg) {
    if (player) player.teleport(tileX, tileZ, headingDeg === undefined ? 0 : headingDeg);
  },
  press(action, ms) {
    input.press(action, ms);
  },
  throwAt(tileX, tileZ) {
    if (!delivery || !player) return;
    const aim = delivery.targeting.pointAim(tileX, tileZ, player, delivery.targets, delivery.throwRange, delivery.accuracy);
    delivery.doThrow(aim);
  },
  throwRaw(wx, wz) {
    if (!delivery || !player) return;
    let best = null, bd = Infinity;
    for (let i = 0; i < delivery.targets.length; i++) {
      const t = delivery.targets[i];
      if (t.delivered) continue;
      const dx = t.doormat.x - wx, dz = t.doormat.z - wz;
      const d = dx * dx + dz * dz;
      if (d < bd) { bd = d; best = t; }
    }
    const target = best || delivery.nextUndelivered();
    delivery.parcels.throwParcel({ x: player.pos.x, y: PARCEL.throwHeight, z: player.pos.z }, { x: wx, z: wz }, { pkg: target ? target.pkg : null, target, airMail: player.pos.y > 0.05 });
  },
  debugParcels() {
    if (!delivery) return [];
    return delivery.parcels.parcels.map((p) => ({ s: p.state, x: +p.mesh.position.x.toFixed(1), z: +p.mesh.position.z.toFixed(1), y: +p.mesh.position.y.toFixed(1), vis: p.mesh.visible, target: p.target ? p.target.house.id : null, mh: p.mailHit || false }));
  },
  debugRoofs() {
    if (!world) return [];
    return world.colliders.filter((c) => c.type === 'box' && c.h && c.h < 8).map((c) => ({ minZ: c.minZ, maxZ: c.maxZ, minX: c.minX, maxX: c.maxX, h: +c.h.toFixed(2) }));
  },
  debugZones() {
    if (!world) return null;
    const T = world.tilemap.tileSize;
    const tile = (w) => [Math.floor(w.x / T), Math.floor(w.z / T)];
    return {
      doormats: M5_TARGETS.map((id) => ({ id, x: world.doormatPoints[id].x, z: world.doormatPoints[id].z, tile: tile(world.doormatPoints[id]) })),
      pond: world.def.pond,
      mailboxes: (world.mailboxes || []).slice(0, 3).map((m) => [ +m[0].toFixed(1), +m[1].toFixed(1) ]),
      roadTiles: world.def.roads.map((r) => ({ name: r.name, axis: r.axis, at: r.at, tile: [r.at, r.axis === 'z' ? r.at : 0] })),
    };
  },
  step(frames) {
    const step = 1 / 60;
    for (let i = 0; i < (frames | 0); i++) {
      simTime += step;
      simStep(step);
    }
  },
  debugHazards() {
    if (!hazards) return null;
    return {
      cars: hazards.cars.length, dogs: hazards.dogs, skaters: hazards.skaters, hives: hazards.hives, bins: hazards.bins, cones: hazards.cones,
      hiveStates: hazards.hiveSt ? hazards.hiveSt.map((h) => h.state) : [],
      dogStates: hazards.dogSt ? hazards.dogSt.map((d) => d.state) : [],
      dogSteal: hazards.dogSt ? hazards.dogSt.map((d) => d.stealT) : [],
    };
  },
  debugPlayer() {
    if (!player) return null;
    return {
      x: +player.pos.x.toFixed(1), z: +player.pos.z.toFixed(1), y: +player.pos.y.toFixed(2),
      immune: player.knockdownImmune, dogFriendly: player.dogFriendly,
    };
  },
  debugBees() {
    if (!hazards) return null;
    return {
      swarms: hazards.hiveSt.map((h) => ({ cx: +h.cx.toFixed(1), cz: +h.cz.toFixed(1), state: h.state })),
    };
  },
  startShift(id) { startShift(id); },
  angerBees() { if (hazards) hazards.angersSwarmAt(hazards.hiveSt[0].x, hazards.hiveSt[0].z); },
  setCamDist(h, v) {
    if (!followCam || !player) return;
    camTgt.pos = player.pos; camTgt.heading = player.heading;
    followCam.setDist(h, v);
    followCam.snap(camTgt, camLook);
  },
  // §12.1: point the camera at a world spot (a "porch-style close camera").
  // The cam position is given explicitly (camX, camZ, up) so a shot can approach
  // a target from whichever side is clear. Set after the last step in a paused
  // shot so the follow-cam doesn't override it.
  aimAt(wx, wz, camX, camZ, up) {
    camera.position.set(camX, up, camZ);
    camLook.set(wx, 1.5, wz);
    camera.lookAt(camLook.x, camLook.y, camLook.z);
    const d = camera.position.distanceTo(camLook);
    if (scene.fog) { scene.fog.near = d + 45; scene.fog.far = d + 150; }
    camera.far = Math.max(220, d + 260);
    camera.updateProjectionMatrix();
  },
  freeRoam() { if (mission) endShift(false); },
  setWaypoint() {},
  abandonMission() { if (mission) endShift(false); },
  setHeat() {},
  goto() {},
  autoplay() {},
};
