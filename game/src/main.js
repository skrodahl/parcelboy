import * as THREE from 'three';
import { parseParams } from './core/params.js';
import { createLoop } from './core/loop.js';
import { createDebugOverlay } from './core/debug.js';
import { createRenderer, resizeRenderer } from './render/renderer.js';
import { VoxelBuilder } from './render/voxel.js';
import { createLighting } from './render/lighting.js';
import { createSky } from './render/sky.js';
import { applyCamPreset } from './render/camPresets.js';
import { Registry } from './core/registry.js';
import { PALETTE } from './data/palette.js';
import { TIMES_OF_DAY } from './data/timeOfDay.js';
import { buildWorld, disposeWorld } from './world/worldBuilder.js';
import { createDepotLife } from './world/depot.js';
import { NEIGHBORHOODS, getNeighborhood, DEFAULT_NEIGHBORHOOD } from './data/neighborhoods/index.js';
import { CHARACTERS } from './data/characters.js';
import { VEHICLES } from './data/vehicles.js';
import { createInput } from './core/input.js';
import { createPlayer } from './entities/player.js';
import { buildCourier } from './entities/courierModel.js';
import { buildModel } from './entities/vehicleModels.js';
import { createBlobShadows } from './entities/blobShadows.js';
import { createFollowCam } from './render/camera.js';
import { FREE_ROAM, HAZARD, CARTOON, MISCHIEF } from './data/config.js';
import { SHIFTS, MAIN_SHIFTS, SIDE_SHIFTS } from './data/shifts.js';
import { createDelivery } from './gameplay/delivery.js';
import { createMission } from './gameplay/mission.js';
import { createHazards } from './gameplay/hazards.js';
import { createEffects } from './render/effects.js';
import { createFloatText } from './render/floatText.js';
import { createRadar } from './ui/radar.js';
import { createFullMap } from './ui/fullmap.js';
import { createExits } from './gameplay/exits.js';
import { createTransition } from './ui/transition.js';
import { createRegionMap } from './ui/regionmap.js';
import { createHeat } from './gameplay/heat.js';
import { createMischief } from './gameplay/mischief.js';
import { createAmbient } from './entities/ambient.js';
import { createWatch } from './gameplay/watch.js';
import { createAbilitySystem } from './gameplay/abilities.js';
import { createScreens } from './ui/screens.js';
import { createEvents } from './core/events.js';
import { createAudio } from './audio/audio.js';
import { mulberry32 } from './core/rng.js';
import { loadSave, defaultSave, writeSave } from './core/save.js';
import { createProgression } from './gameplay/progression.js';
import { createCollectibles } from './gameplay/collectibles.js';
import { createDayCycle } from './gameplay/dayCycle.js';
import { createDayClock, setNextOpen } from './gameplay/dayClock.js';
import { createMissionMarkers } from './gameplay/missionMarkers.js';
import { createDebugHooks } from './core/debugHooks.js';
import { createShiftFlow } from './gameplay/shiftFlow.js';

const params = parseParams();
// §2.11: load the save once at boot (corrupt → defaults). A `?coins=` param seeds
// a balance for screenshots. Persisted settings feed the renderer quality below.
const saveData = loadSave();
if (params.coins) saveData.coins = parseInt(params.coins, 10);
// §2.18 test hook: `?stars=N` seeds the total-star count a one-entry `best` map
// supplies, so the exit-unlock gate can be photographed at a chosen star total.
if (params.stars) {
  saveData.best = saveData.best || {};
  saveData.best._seed = { score: 0, stars: parseInt(params.stars, 10) };
}

const todRegistry = new Registry('timeOfDay', ['id', 'sunDir', 'sunColor', 'sunIntensity', 'hemiSky', 'hemiGround', 'hemiIntensity', 'skyZenith', 'skyHorizon']);
for (const p of TIMES_OF_DAY) todRegistry.add(p);
const preset = todRegistry.get(params.tod || 'morning');

const canvas = document.getElementById('game');
// §2.11: a `?quality=` param overrides the persisted quality setting.
const { renderer, quality, name: qualityName, targetFps } = createRenderer(canvas, params.quality || saveData.settings.quality || 'balanced');

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 1, 0.5, 220);
window.addEventListener('resize', () => resizeRenderer(renderer, camera));

// §9: the event bus (gameplay emits; audio/subsystems listen) + the audio
// manager. The AudioContext itself is created on the first user input (unlock).
const events = createEvents();
let audio = createAudio({ events, muted: !!params.mute });
// §2.11: restore the persisted music/SFX volumes from the save.
audio.setMusicVol(saveData.settings.musicVol);
audio.setSfxVol(saveData.settings.sfxVol);
let audioDebugEl = null; // §9: the ?debug=1 last-sound readout

// One shared Lambert material for all opaque world geometry (§7.3).
// FrontSide: VoxelBuilder now emits CCW-wound triangles, so back-face
// culling is safe and saves fill on every backend.
const worldMat = new THREE.MeshLambertMaterial({ vertexColors: true });

let sky = null;
let lighting = null;
let cube = null;
let world = null;
let depotLife = null;
let simTime = 0;
// M4 dynamic actors (assigned in the world branch; null in menus/test scenes).
let player = null;
let vehicleMesh = null;
let blobs = null;
let followCam = null;
let courierRig = null, courierVehMesh = null, courierVehMat = null; // rig + vehicle (+ a dedicated mat for the golden bike)
let delivery = null; // M5 interim delivery session (M6 replaces with shifts)
let mission = null; // M6 active shift runner (null in free roam)
let activeShiftId = null; // M12a.1: the running shift's id (for the pause Restart / Abandon)
let hud = null; // M6 HUD (free-roam chip + mission timer/score)
let activeChar = null, activeVeh = null; // the spawned courier/vehicle
let abilities = null; // §11.6: the active courier's ability system (Modifier stack)
let abilityBtn = null, abilityRing = null, abilityName = null; // the HUD ability button (§10)
let screens = null; // §10: the menu / select / pause / settings screens
let charRegistry = null, vehRegistry = null; // filled at boot; reused by the locker

// §2.11: the save-backed progression (coins / unlocks / best / golden / last /
// settings) loaded from localStorage (corrupt → defaults). Every mutation
// persists via progression.save(). `saveData` is loaded at the top of the file.
function refreshCoins() { if (hud) hud.coins.textContent = progress.coins; }
function refreshGolden() { if (hud) hud.golden.textContent = progress.data.goldenParcels.length + '/12'; }

// §2.13 / M12a.0: the golden-parcel banner — a reused top-center DOM element
// (pop-in, held, fade; no per-frame work). The HUD golden counter pulses too.
let goldenBanner = null, goldenBannerTitle = null, goldenBannerSub = null, goldenT1 = 0, goldenT2 = 0;
function showGoldenBanner(total, count) {
  if (!goldenBanner) return;
  const all = total >= count;
  goldenBannerTitle.textContent = all ? 'ALL 12 FOUND!' : 'GOLDEN PARCEL!';
  goldenBannerSub.textContent = all ? 'Golden Bike unlocked!' : total + ' / ' + count + ' found · +50 coins';
  goldenBanner.style.display = 'block';
  goldenBanner.classList.remove('fade');
  goldenBanner.classList.add('show');
  const hold = all ? 4000 : 2500;
  clearTimeout(goldenT1); clearTimeout(goldenT2);
  goldenT1 = setTimeout(() => goldenBanner.classList.add('fade'), hold);
  goldenT2 = setTimeout(() => { goldenBanner.style.display = 'none'; goldenBanner.classList.remove('show', 'fade'); }, hold + 400);
}
function pulseGolden() { if (hud && hud.golden) { const g = hud.golden; g.classList.remove('pulse'); void g.offsetWidth; g.classList.add('pulse'); } }
events.on('golden', (d) => { pulseGolden(); showGoldenBanner(d.total, d.count); });

// §2.15 / M12a.9: the heat whistles — a DOM row of 3 whistle icons above the
// radar (the old in-canvas 4px dots were invisible). Filled red per level,
// wobbling + a tick when heat rises, flashing while the Watch is losing you,
// hidden at level 0. Built in buildHUD; this just drives it.
let heatRowEl = null, heatWhistles = null, watchPopupEl = null, watchT1 = 0, watchT2 = 0;
let prevHeatLevel = 0, heatLvl2Shown = false;
function showWatchPopup() {
  if (!watchPopupEl) return;
  watchPopupEl.style.display = 'block';
  watchPopupEl.classList.remove('fade');
  watchPopupEl.classList.add('show');
  clearTimeout(watchT1); clearTimeout(watchT2);
  watchT1 = setTimeout(() => watchPopupEl.classList.add('fade'), 2500);
  watchT2 = setTimeout(() => { watchPopupEl.style.display = 'none'; watchPopupEl.classList.remove('show', 'fade'); }, 2900);
}
function updateHeatRow() {
  if (!heatRowEl) return;
  const lvl = heat ? heat.level : 0;
  if (lvl <= 0) {
    heatRowEl.style.display = 'none'; heatRowEl.classList.remove('flash', 'wobble');
    prevHeatLevel = 0; return;
  }
  heatRowEl.style.display = '';
  for (let i = 0; i < 3; i++) heatWhistles[i].classList.toggle('on', i < lvl);
  if (lvl > prevHeatLevel) {
    heatRowEl.classList.remove('wobble'); void heatRowEl.offsetWidth; heatRowEl.classList.add('wobble');
    if (events) events.emit('whistle'); // the short tick
    if (lvl >= 2 && !heatLvl2Shown) { heatLvl2Shown = true; showWatchPopup(); }
  }
  prevHeatLevel = lvl;
  heatRowEl.classList.toggle('flash', !!(heat && heat.losing));
}

const progress = createProgression(saveData, { refresh: refreshCoins, onGolden: refreshGolden });
// M10: the free-roam Golden Parcels + the day cycle (created in the world branch).
let collectibles = null, dayCycle = null;
// §2.20 (M12b): the world day clock (drives the time-of-day look + shift windows).
let dayClock = null, clockSaveGap = 0;
// §2.20: the Quickbox bench (next to the dispatch marker) — sitting + holding F
// fast-forwards the clock to the next shift window opening. `benchIn` tracks whether
// the courier is in the bench zone (so the fast-forward + its prompt show only there).
let benchZone = null, benchIn = false, benchFF = false, benchMesh = null, benchPromptEl = null, benchFFTarget = -1;
// M12a.1: the visible mission/locker/side markers + their free-roam proximity card.
let markers = null, prevM = null, prevLocker = -1;
let MARKER_RADIUS = 8; // ~2 tiles; set from the tilemap's tile size at boot
// §9: crickets only at dusk/golden (a preset with meaningful glow).
function setCricketsForPreset(p) { if (audio) audio.setCrickets(!!p && p.glow > 0.4); }
// M12a.5: the free-roam dispatch / marker card + the results screen live in
// gameplay/shiftFlow.js (their card state now lives there). main.js keeps only
// the marker proximity edge (`prevM`) and calls the card functions via the
// destructured refs. `startShift`/`endShift` are hoisted; the mutable refs are
// read through getters so the card always sees the live value.
const flow = createShiftFlow({
  el, progress, MAIN_SHIFTS, SIDE_SHIFTS, startShift, endShift, events,
  setPrevM: (v) => { prevM = v; },
  getSharedEffects: () => sharedEffects,
  getPlayer: () => player,
   getCapacity: () => activeChar ? activeChar.stats.capacity + (activeVeh ? activeVeh.stats.capacityBonus : 0) : null,
   getClock: () => dayClock,
   fmtMin: (m) => minToTime(m),
   getNb: () => (world ? world.def.id : null), // §2.18: the dispatch card lists only this suburb's shifts
});
const { openMarkerCard, closeMarkerCard, mcKey, showShiftCard, showResults, getMarkerState } = flow;
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
let simPaused = params.paused; // M6b: also toggled while the full-screen map is open
let musicPaused = !!params.paused; // §9: keep the music state in sync with the sim
let radar = null, fullMap = null; // M6b: the corner radar + full-screen map
// §2.18: the multi-neighborhood engine (exits are per-suburb; the transition +
// region-map inset are session-level DOM).
let exits = null, transition = null, regionMap = null, exitPromptEl = null, activeExit = null;
// M6b: live refs the radar/full-map read each tick (kept current in main).
const radarState = { player: null, delivery: null, hazards: null, world: null, waypoint: null, mischief: null, heat: null, watch: null };
// M7b: the GTA-lite mischief layer (heat + Grumps + breakables + Watch).
let heat = null, mischief = null, ambient = null, watch = null;
let bustedUntil = 0; // §2.15: the sim freezes for ~2 s on a BUSTED!
const mischiefRng = mulberry32(((params.seed || 1) * 131 + 7) | 0);

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
  // §2.18: a `?nb=<id>` param (or the save's neighborhood) picks the suburb;
  // it defaults to Maple Hollow.
  // §2.18: a `?nb=<id>` param picks the suburb; otherwise the save's current
  // neighborhood (restored), defaulting to Maple Hollow.
  const nbId = params.nb || saveData.neighborhood || DEFAULT_NEIGHBORHOOD;
  world = buildWorld(getNeighborhood(nbId), 1, preset);
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
  const tt = world.tilemap;
  sky = createSky(scene, preset, {
    cx: (tt.width / 2) * tt.tileSize,
    cz: (tt.height / 2) * tt.tileSize,
    sx: tt.width * tt.tileSize + 120,
    sz: tt.height * tt.tileSize + 120,
  });
  sky.update(0, 0);
  // §2.14: the busy Distribution Center (conveyor boxes + a forklift NPC).
  depotLife = createDepotLife(scene, world, world.worldMat, qualityName === 'battery');

  // M4: dynamic actors (courier + vehicle) on top of the static world.
  charRegistry = new Registry('character', ['id', 'name', 'build', 'colors', 'stats', 'ability']);
  for (const c of CHARACTERS) charRegistry.add(c);
  vehRegistry = new Registry('vehicle', ['id', 'name', 'model', 'riding', 'stats', 'canJump']);
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
    camPreset('showroom');
  } else {
    // M6: free roam is the hub state (§2.13). `?autostart=<shiftId>` starts that
    // shift; `?autostart=freeroam` or no autostart = plain free roam at the depot.
    // §2.11: restore the last courier/vehicle from the save (a `?char=`/`?veh=`
    // override or a missing id falls back to the defaults).
    const lastChar = charRegistry.get(saveData.last.character) ? saveData.last.character : 'pip';
    const lastVeh = vehRegistry.get(saveData.last.vehicle) ? saveData.last.vehicle : 'feet';
    const charDef = charRegistry.get(params.char || lastChar);
    const vehDef = vehRegistry.get(params.veh || lastVeh);
    spawnCourier(charDef, vehDef);
    progress.setLast(charDef.id, vehDef.id);
    buildHUD();
    refreshCoins();
    refreshGolden();
    // M10: the hidden Golden Parcels (free roam) + the day cycle.
    collectibles = createCollectibles({ scene, world, mat: world.worldMat, progression: progress, floatText: sharedFloatText, events });
    // M12a.1: the tall mission/locker/side marker columns + their proximity card.
    markers = createMissionMarkers({ scene, def: world.def, T: world.tilemap.tileSize });
    MARKER_RADIUS = 2 * world.tilemap.tileSize; // ~2 tiles
    dayCycle = createDayCycle({ lighting, sky, world, minutesPerPhase: FREE_ROAM.minutesPerPhase, blendTime: 30 });
    dayCycle.startAt(preset.id); // sync the cycle to the boot time of day
    setCricketsForPreset(preset);
    // §2.20: the world clock (restored from the save; drives the time-of-day look +
    // shift windows). Its preset blend feeds the day cycle each frame in free roam.
    dayClock = createDayClock(saveData);
    dayClock.min = saveData.clock != null ? saveData.clock : 360; // 06:00 default
    // Register the main shifts' window openings so the bench knows where to fast-forward.
    setNextOpen(MAIN_SHIFTS.map((s) => s.window[0]));
    // §2.20: the Quickbox bench — a small seat next to the dispatch marker. Sitting
    // in its zone + holding F fast-forwards the clock to the next window opening.
    createBench();
    // §2.13: a `?cam=` param frames the screenshots (street / overview / golden).
    if (params.cam) camPreset(params.cam);
    // §10: the menu / select / pause / settings screens + keyboard navigation.
    screens = createScreens({
      ui: document.getElementById('ui'), scene, camera, charRegistry, vehRegistry,
      buildCourier, buildModel, mat: world.worldMat, progress,
      pickChar: (id) => changeCourier(id, activeVeh.id),
      pickVeh: (id) => changeCourier(activeChar.id, id),
      getBowled: () => (ambient ? ambient.bowledTotal : 0),
       startShift, gotoFreeRoam, setCam: (n) => camPreset(n),
       activeCharId: charDef.id, activeVehId: vehDef.id, qualityName, setQuality: applyQuality,
        resumePause: () => { simPaused = false; if (screens) screens.close(); },
        // M12a.1: the pause menu's shift actions. Restart re-runs the shift;
        // Abandon clocks out to free roam (you keep what you earned, §2.20-ish).
        isInMission: () => !!mission,
        restartShift: () => { const id = activeShiftId; if (id) endShift(id); simPaused = false; if (screens) screens.close(); },
        abandonShift: () => { endShift(false); simPaused = false; if (screens) screens.close(); },
        audio,
        persistSetting: (k, v) => progress.setSetting(k, v), // §2.11: persist the settings screen changes
    });
    window.addEventListener('keydown', (e) => {
      if (screens && screens.active) screens.handleKey(e);
      else if (getMarkerState()) mcKey(e); // M12a.1: the free-roam marker card
    });
    if (params.showCard && !params.screen) showShiftCard();
    if (params.autostart && params.autostart !== 'freeroam' && SHIFTS.some((s) => s.id === params.autostart)) startShift(params.autostart);
    // §10: route `?screen=` to the matching screen (screenshots + the DoD flow).
    routeScreen(params.screen, params);
    // §10: a plain load (no query params) lands on the Title instead of free-roam.
    // Param-driven loads (?screen / ?autostart / ?paused / ?char / ...) skip it.
    if (!location.search) screens.show('title');
  }
}

// §2.18: travel to another suburb. Disposes the current suburb's GPU + its
// per-suburb systems, builds + binds the new one, and re-points the courier /
// camera / radar at it. Session state (courier identity, save, registries, the
// day clock, screens) persists. `viaExit` marks an in-world exit (vs `?nb=`).
function gotoNeighborhood(nbId, viaExit) {
  const def = getNeighborhood(nbId);
  if (!def || def.id === world.def.id) return;
  if (delivery) endShift(false); // a shift can't span suburbs
  // --- dispose the current suburb's dynamic + static GPU -------------------
  if (hazards) { hazards.dispose(); hazards = null; }
  if (depotLife) { depotLife.dispose(); depotLife = null; }
  if (collectibles) { collectibles.dispose(); collectibles = null; }
  if (markers) { markers.dispose(); markers = null; }
  if (ambient) { ambient.dispose(); ambient = null; }
  if (watch) { watch.dispose(); watch = null; }
  if (mischief) { mischief.dispose(); mischief = null; }
  heat = null;
  if (benchMesh) { scene.remove(benchMesh.seat, benchMesh.post); benchMesh.seat.geometry.dispose(); benchMesh.post.geometry.dispose(); benchMesh.seat.material.dispose(); benchMesh = null; }
  benchZone = null;
  if (benchPromptEl) { benchPromptEl.remove(); benchPromptEl = null; }
  if (radar) { if (radar.canvas) radar.canvas.remove(); radar = null; }
  if (fullMap) { fullMap.dispose(); fullMap = null; }
  if (sky) { sky.dispose(); sky = null; }
  dayCycle = null;
  if (world) { scene.remove(world.group); disposeWorld(world); }
  // --- build + bind the new suburb -----------------------------------------
  world = buildWorld(def, 1, preset);
  scene.add(world.group);
  for (const ch of world.chunks) { ch.mesh.castShadow = true; ch.mesh.receiveShadow = true; }
  const tt = world.tilemap;
  sky = createSky(scene, preset, { cx: (tt.width / 2) * tt.tileSize, cz: (tt.height / 2) * tt.tileSize, sx: tt.width * tt.tileSize + 120, sz: tt.height * tt.tileSize + 120 });
  sky.update(0, 0);
  depotLife = createDepotLife(scene, world, world.worldMat, qualityName === 'battery');
  collectibles = createCollectibles({ scene, world, mat: world.worldMat, progression: progress, floatText: sharedFloatText, events });
  markers = createMissionMarkers({ scene, def: world.def, T: world.tilemap.tileSize });
  MARKER_RADIUS = 2 * world.tilemap.tileSize;
  dayCycle = createDayCycle({ lighting, sky, world, minutesPerPhase: FREE_ROAM.minutesPerPhase, blendTime: 30 });
  dayCycle.startAt(preset.id);
  createBench();
  // re-point the courier + camera + radar + hazards + mischief at the new world
  radarState.world = world;
  spawnCourier(activeChar, activeVeh);
  bindNeighborhood();
  saveData.neighborhood = nbId; writeSave(saveData);
  if (events) events.emit('neighborhoodChange', { to: nbId, viaExit: !!viaExit });
}

// §2.18: (re)build the per-suburb exit set + refresh the region-map inset after a
// suburb is loaded. The transition overlay is session-level (created once).
function bindNeighborhood() {
  exits = createExits(world, saveData);
  if (!transition) transition = createTransition(document.getElementById('ui'));
  if (!regionMap) regionMap = createRegionMap(document.getElementById('ui'), () => world);
  if (regionMap) regionMap.refresh();
}

// §2.18: travel from an in-world exit — fade + sign card, swap mid-fade. A
// locked exit shows a "earn N stars" prompt instead.
function travelFromExit(exit) {
  if (!exit) return;
  const unlocked = exits.isUnlocked(exit);
  if (!unlocked) {
    const need = exit.unlockStars || 0;
    showExitPrompt({ title: exit.to, blurb: `Locked — earn ${need} star${need === 1 ? '' : 's'} to travel`, locked: true, key: null });
    return;
  }
  const target = getNeighborhood(exit.to);
  const blurb = target && target.region ? target.region : target ? target.name : exit.to;
  transition.begin(target ? target.name : exit.to, blurb, () => { gotoNeighborhood(exit.to, exit.id); });
}

// §2.18: the bottom-center travel prompt (created once, updated in place).
function showExitPrompt({ title, blurb, locked, key }) {
  if (!exitPromptEl) { exitPromptEl = el('div', 'nb-exit-prompt'); document.getElementById('ui').appendChild(exitPromptEl); }
  exitPromptEl.className = 'nb-exit-prompt' + (locked ? ' locked' : '');
  exitPromptEl.innerHTML = '';
  exitPromptEl.append(el('div', 'nb-exit-title', (locked ? 'Locked · ' : 'Exit · ') + title));
  if (key != null) exitPromptEl.append(el('div', 'nb-exit-key', key + ' to ' + (locked ? 'unlock' : 'travel')));
  if (blurb) exitPromptEl.append(el('div', 'nb-exit-blurb', blurb));
  exitPromptEl.style.display = '';
}
function hideExitPrompt() { if (exitPromptEl) exitPromptEl.style.display = 'none'; }

// §2.18: run each sim tick — raise the prompt on the exit the courier stands on
// (a shift shows a "clock out + travel" variant) and act on the T key.
function stepExits() {
  if (!exits || !player) return;
  const onExit = exits.onExitTile(player.pos);
  if (onExit !== activeExit) {
    activeExit = onExit;
    if (onExit) {
      const unlocked = exits.isUnlocked(onExit);
      showExitPrompt({
        title: onExit.to, locked: !unlocked, key: unlocked ? 'T' : null,
        blurb: delivery ? 'Clock out + travel' : (unlocked ? 'Press T to travel' : `Locked — earn ${onExit.unlockStars} star${onExit.unlockStars === 1 ? '' : 's'}`),
      });
    } else hideExitPrompt();
  }
  if (input.isHeld('travel') && activeExit && exits.isUnlocked(activeExit)) {
    const e = activeExit; activeExit = null; hideExitPrompt();
    travelFromExit(e);
  }
}

// M6: spawn the courier + vehicle + follow cam at the depot, free roam.
function spawnCourier(charDef, vehDef) {
  activeChar = charDef; activeVeh = vehDef;
  // §10 locker: re-spawn removes the previous courier's rig + vehicle + shadows.
  // §2.18: dispose the rig/vehicle geometries too (built per spawn) so a
  // suburb round trip leaks none. Their material (world or the golden mat) is
  // handled separately below / with the world.
  if (courierRig) { courierRig.group.traverse((o) => { if (o.isMesh && o.geometry) o.geometry.dispose(); }); scene.remove(courierRig.group); courierRig = null; }
  if (courierVehMesh) { if (courierVehMesh.geometry) courierVehMesh.geometry.dispose(); scene.remove(courierVehMesh); courierVehMesh = null; }
  if (courierVehMat && courierVehMat !== world.worldMat) { courierVehMat.dispose(); courierVehMat = null; }
  const rig = buildCourier(charDef, world.worldMat);
  courierRig = rig;
  scene.add(rig.group);
  // §2.13: the golden bike rides as solid gold (a dedicated material); every other
  // vehicle shares the world material.
  courierVehMat = vehDef.id === 'golden' ? new THREE.MeshLambertMaterial({ color: 0xf5c518 }) : world.worldMat;
  const vehicleMesh = buildModel(vehDef.model, courierVehMat);
  if (vehicleMesh) scene.add(vehicleMesh);
  courierVehMesh = vehicleMesh;
  // §2.18: drop the previous courier's blob shadows (its material references the
  // old suburb's pool texture, which would otherwise re-upload on every swap).
  if (blobs) { scene.remove(blobs.mesh); blobs.mesh.geometry.dispose(); if (blobs.mesh.material) blobs.mesh.material.dispose(); blobs = null; }
  blobs = createBlobShadows(16, world.poolTexture);
  scene.add(blobs.mesh);
  player = createPlayer({ charDef, vehDef, rig, vehicleMesh, world, onBonk: (amount) => { if (followCam) followCam.shake(amount); } });
  // §11.6: the courier's ability (writes the modifier stack the player reads).
  abilities = createAbilitySystem(player.stack, charDef, vehDef);
  player.setAbilities(abilities);
  // §2.12 trampolines: launch the courier 5u up with a "BOING!" when they land on one.
  const trampSpots = ((world.def.gagSpots || {}).trampoline || []).map(([tx, tz]) => ({ x: world.tilemap.cx(tx), z: world.tilemap.cz(tz) }));
  player.setTrampolines(trampSpots);
  player.setOnTrampoline(() => {
    if (sharedFloatText) sharedFloatText.pop('BOING!', player.pos.x, 1.6, player.pos.z, { color: '#ffd166', burst: true });
    if (sharedEffects) sharedEffects.dust(player.pos.x, 0.3, player.pos.z);
    if (events) events.emit('boing');
  });
  followCam = createFollowCam(camera, world.collision, world.terrain ? world.terrain.baseYAt : null);
  camTgt.pos = player.pos; camTgt.heading = player.heading;
  player.syncVisuals(0, simTime);
  blobs.set(0, player.pos.x, player.pos.z, 1.4);
  blobs.flush();
  followCam.snap(camTgt, camLook);
  gameState.name = 'freeRoam';
  // M7: shared effects/float-text (used by hazards + delivery) + free-roam hazards.
  if (!sharedEffects) { sharedEffects = createEffects(scene); sharedFloatText = createFloatText(document.getElementById('ui'), camera, renderer); }
  setHazards(FREE_ROAM.hazards);
  // M6b: the corner radar + full-screen map (created once; they read radarState).
  radarState.player = player; radarState.world = world;
  if (!radar) {
    radar = createRadar({ tm: world.tilemap, state: radarState, ui: document.getElementById('ui') });
    fullMap = createFullMap({
      tm: world.tilemap, state: radarState, radar,
      onPause: (p) => { if (p) simPaused = true; else if (!params.paused) simPaused = false; },
    });
  }
  setupMischief(); // M7b: heat + Grumps + breakables + Watch (free-roam Grumps)
  bindNeighborhood(); // §2.18: the per-suburb exits + region-map inset
}

// M7b: create the mischief systems once (they are session-independent) and
// dress the free-roam Grumps. A shift re-dresses + resets on start/end.
function setupMischief() {
  if (mischief) return;
  const mat = world.worldMat;
  const unitOps = { spawn: () => null, remove: () => {} };
  heat = createHeat({
    stack: () => (player ? player.stack : null), // M8: Marlo's Charm reads the live stack
    spawnWatch: (i) => unitOps.spawn(i), removeWatch: (i) => unitOps.remove(i),
    onBusted: (level) => onBusted(level),
  });
  ambient = createAmbient({ scene, world, mat, rng: mulberry32(mischiefRng()), onStrike: () => onStrike(), battery: qualityName === 'battery' });
  watch = createWatch({ scene, mat, colors: activeChar.colors, heat, player, onBusted: (i) => onBusted(i) });
  unitOps.spawn = watch.spawn; unitOps.remove = watch.remove;
  mischief = createMischief({
    world, scene, mat, rng: mulberry32(mischiefRng()),
    heat, delivery: () => delivery, effects: sharedEffects, floatText: sharedFloatText,
    player: () => player, onGrumpShove: () => onKnockdown('grump'),
  });
  radarState.mischief = mischief; radarState.heat = heat; radarState.watch = watch;
  setupGrumps(FREE_ROAM.grumps, []);
}

// Dress `count` seeded houses (excluding `excludeIds`) as Grumps.
function setupGrumps(count, excludeIds) {
  if (!mischief) return;
  mischief.reset();
  if (!count) return;
  const houses = world.def.houses.filter((h) => excludeIds.indexOf(h.id) < 0);
  const rng = mulberry32(mischiefRng());
  for (let i = houses.length - 1; i > 0; i--) { const j = (rng() * (i + 1)) | 0; const t = houses[i]; houses[i] = houses[j]; houses[j] = t; }
  mischief.setup(houses.slice(0, count).map((h) => h.id));
}

// §2.15 BUSTED!: freeze the sim ~2 s, pop the ticket, apply the penalty.
let bustedEl = null;
function onBusted(level) {
  if (!player) return;
  bustedUntil = simTime + MISCHIEF.bustedFreezeSec;
  const p = player.pos;
  if (followCam) followCam.shake(0.3);
  const inMission = !!delivery;
  const penalty = inMission ? MISCHIEF.bustedPenalty.missionPoints : -Math.max(MISCHIEF.bustedPenalty.freeRoamMin, Math.min(MISCHIEF.bustedPenalty.freeRoamMax, 10));
  if (inMission) delivery.addScore(MISCHIEF.bustedPenalty.missionPoints);
  sharedFloatText.pop('BUSTED!', p.x, 2.2, p.z, { color: '#e63946', burst: true });
  // A comic "ticket" card pops up center-screen for the freeze.
  if (bustedEl) bustedEl.remove();
  bustedEl = el('div', 'busted-ticket');
  bustedEl.append(
    el('div', 'busted-title', 'BUSTED!'),
    el('div', 'busted-sub', 'Neighborhood Watch'),
    el('div', 'busted-pen', (inMission ? 'Score ' : '−') + penalty + (inMission ? '' : ' coins')),
  );
  document.getElementById('ui').append(bustedEl);
  if (events) events.emit('busted');
  void level;
}

// §2.15 STRIKE!: two pedestrians bowled within the window → comic + points.
function onStrike() {
  if (!player) return;
  const p = player.pos;
  sharedFloatText.pop('STRIKE!', p.x, 3, p.z, { color: '#ffd166', burst: true });
  if (sharedEffects) sharedEffects.confetti(p.x, 2, p.z);
  if (delivery) delivery.addScore(100);
  if (events) events.emit('strike');
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
      onHop: () => { if (delivery) { delivery.addScore(25); sharedFloatText.pop('Hop! +25', player.pos.x, 2, player.pos.z, { color: '#a7c957' }); } if (events) events.emit('hop'); },
  });
  radarState.hazards = hazards;
}

// §2.6 knockdown: camera shake + hit-stop + drop a parcel (in a mission) + dust.
function onKnockdown(kind) {
  if (!player) return;
  if (followCam) followCam.shake(HAZARD.knockdownShake);
  hitStopUntil = simTime + (CARTOON.enabled ? CARTOON.hitStopMs : 0) / 1000;
  if (delivery) delivery.dropParcel(false);
  sharedEffects.dust(player.pos.x, 0.6, player.pos.z);
  if (events) events.emit(kind === 'grump' ? 'grumble' : 'knockdown');
}

// §2.10: start a shift by id. Builds the mission (targets + timer) and a
// delivery session with per-target packages.
function startShift(shiftId) {
  if (!player || (mission && mission.active)) return;
  const shift = SHIFTS.find((s) => s.id === shiftId);
  if (!shift) return;
  activeShiftId = shiftId;
  const seed = params.seed || 1;
  setHazards(shift.hazards || FREE_ROAM.hazards); // before the delivery so it can read the live set
  mission = createMission({ def: world.def, shift, seed, clock: dayClock, onResults: (r) => showResults(r) });
  // §2.15: a shift picks its own Grumps (seeded, excluding delivery targets);
  // heat + Watch start clean for the shift.
  if (heat) heat.reset();
  setupGrumps(shift.grumps || 0, mission.targetDefs.map((t) => (typeof t === 'string' ? t : t.house.id)));
  delivery = setupDelivery(activeChar, activeVeh, mission.targetDefs, shift.packageMix, seed, sharedEffects, sharedFloatText, shift);
  radarState.delivery = delivery;
  if (world.lockers) world.lockers.setAllFull(); // §2.17: lockers refill when a new shift starts
  mission.start(delivery);
  player.setCarried(delivery.carried);
  // §2.13: snap to the shift's time of day (the day cycle resumes from here when
  // the mission ends). Also refreshes the glow + lamp pools + the dusk crickets.
  if (shift.timeOfDay) {
    const p = todRegistry.get(shift.timeOfDay);
    if (p) {
      if (dayCycle) dayCycle.startAt(shift.timeOfDay); else { if (lighting) lighting.apply(p); if (sky) sky.apply(p); }
      setCricketsForPreset(p);
    }
  }
  gameState.name = 'mission';
  if (hud) hud.missionStart(delivery, shift);
}

// §2.11: end the shift (timer / all-delivered / abandon). `retry` re-starts the
// same shift from the pickup; otherwise continue back into free roam.
function endShift(retry) {
  if (delivery) delivery.floatText.clear();
  delivery = null;
  radarState.delivery = null;
  if (mission) mission = null;
  gameState.name = 'freeRoam';
  if (hud) hud.missionEnd();
  setHazards(FREE_ROAM.hazards);
  if (retry) startShift(retry);
  else { activeShiftId = null; if (heat) heat.reset(); setupGrumps(FREE_ROAM.grumps, []); } // §2.15: back to the free-roam Grumps
}

// §10: the locker — swap the active courier / vehicle (a re-spawn) and return to
// free roam. Used by the select screens + the distribution-center locker.
function changeCourier(charId, vehId) {
  if (mission) endShift(false);
  if (screens) screens.close();
  spawnCourier(charRegistry.get(charId), vehRegistry.get(vehId));
  progress.setLast(charId, vehId); // §2.11: remember the choice for the next session
  gameState.name = 'freeRoam';
}
function gotoFreeRoam() { if (mission) endShift(false); if (screens) screens.close(); }

function el(tag, cls, txt) { const n = document.createElement(tag); if (cls) n.className = cls; if (txt) n.textContent = txt; return n; }

// §2.13 + §10: the free-roam chip + the mission HUD (timer / targets / next /
// score). Built once; `tick` refreshes the live values each sim step.
// §2.20: the Quickbox bench — a small seat next to the dispatch marker + a zone.
// Sitting in the zone + holding F fast-forwards the clock to the next shift
// window opening. `benchZone` (the AABB) + `benchMesh` (a seat + post) + a DOM
// prompt ("Sit + hold F to fast-forward to the next shift").
function createBench() {
  const T = world.tilemap.tileSize;
  const disp = (world.def.missionMarkers || []).find((m) => m.id === 'dispatch');
  if (!disp) return;
  // Placed just outside the dispatch marker's ~2-tile proximity radius, so the
  // dispatch card doesn't auto-open here (F at the bench fast-forwards, not start).
  const bx = (disp.x + 3.0) * T, bz = (disp.z + 0.0) * T; // next to, but beside, the marker
  benchZone = { minX: bx - 2.2, maxX: bx + 2.2, minZ: bz - 2.2, maxZ: bz + 2.2, x: bx, z: bz };
  const mat = new THREE.MeshStandardMaterial({ color: 0x00b4a6 });
  const seat = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.4, 1.1), mat);
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.35, 2.0, 0.35), mat);
  seat.position.set(bx, 0.5, bz); seat.rotation.y = 0.4;
  post.position.set(bx - 1.0, 1.0, bz - 0.5); post.rotation.y = 0.4;
  scene.add(seat, post);
  benchMesh = { seat, post };
  benchPromptEl = el('div', 'bench-prompt', 'Sit · hold F to fast-forward to the next shift');
  benchPromptEl.style.display = 'none';
  document.getElementById('ui').append(benchPromptEl);
}

function buildHUD() {
  if (hud) return;
  const ui = document.getElementById('ui');
  const chip = el('div', 'hud-chip', 'FREE ROAM');
  const coins = el('div', 'hud-coins', '0');
  const golden = el('div', 'hud-golden', progress.data.goldenParcels.length + '/12');
  const panel = el('div', 'hud-mission');
  const pName = el('div', 'hud-mission-name');
  const pTimer = el('div', 'hud-mission-timer');
  const pTargets = el('div', 'hud-mission-targets');
  const pParcels = el('div', 'hud-mission-parcels');
  const pNext = el('div', 'hud-mission-next');
  const pScore = el('div', 'hud-mission-score');
  const pRestock = el('div', 'hud-restock');
  const pRestockFill = el('div', 'hud-restock-fill');
  pRestock.append(el('span', 'hud-restock-lbl', 'Restock'), el('div', 'hud-restock-bar'), pRestockFill);
  pRestock.style.display = 'none';
  panel.append(pName, pTimer, pTargets, pParcels, pNext, pScore, pRestock);
  // §2.20 / §10: the world clock readout (free roam + missions: "10:24 · shift
  // ends 11:00", orange in the last game hour). Always visible.
  const clockEl = el('div', 'hud-clock');
  panel.style.display = 'none';
  // §10: the ability button (bottom-right) + its cooldown ring.
  const ab = el('div', 'ability-btn');
  const abRing = el('div', 'ability-ring');
  const abName = el('div', 'ability-name', '—');
  const abKey = el('div', 'ability-key', 'Shift');
  ab.append(abRing, abName, abKey);
  ab.style.display = 'none';
  const banner = el('div', 'pb-banner');
  const bannerTitle = el('div', 'pb-banner-title');
  const bannerSub = el('div', 'pb-banner-sub');
  banner.append(bannerTitle, bannerSub);
  // §2.15 / M12a.9: the heat-whistle row (above the radar) + the "Watch is on to
  // you" popup. Created once; updateHeatRow() drives them each frame.
  const heatRow = el('div', 'heat-row');
  const heatWh = [el('div', 'heat-whistle'), el('div', 'heat-whistle'), el('div', 'heat-whistle')];
  heatRow.append(heatWh[0], heatWh[1], heatWh[2]);
  heatRow.style.display = 'none';
  const watchPopup = el('div', 'watch-popup');
  watchPopup.append(el('div', 'watch-popup-title', 'Neighborhood Watch'), el('div', 'watch-popup-sub', 'is on to you!'));
  watchPopup.style.display = 'none';
  ui.append(chip, coins, golden, clockEl, panel, ab, banner, heatRow, watchPopup);
  abilityBtn = ab; abilityRing = abRing; abilityName = abName;
  goldenBanner = banner; goldenBannerTitle = bannerTitle; goldenBannerSub = bannerSub;
  heatRowEl = heatRow; heatWhistles = heatWh; watchPopupEl = watchPopup;
    hud = {
      chip, coins, golden, clockEl, panel, pName, pTimer, pTargets, pParcels, pNext, pScore, pRestock, pRestockFill,
    missionStart(session, shift) {
      this.panel.style.display = ''; this.chip.style.display = 'none';
      this.pName.textContent = shift.name; this.pNext.textContent = addrLabel(session.topParcel());
    },
    missionEnd() { this.panel.style.display = 'none'; this.chip.style.display = ''; },
    tick(mission2, session) {
      if (!session) return;
      // §2.20: the pTimer (where the old countdown was) now shows the shift's end
      // time on the world clock ("shift ends 11:00"), orange in the last game hour.
      const endMin = mission2.tipByMin > 0 ? mission2.tipByMin : mission2.deadlineMin;
      this.pTimer.textContent = 'shift ends ' + minToTime(endMin);
      this.pTimer.classList.toggle('urgent', !!dayClock && dayClock.min >= endMin - 60 && dayClock.min < endMin);
      this.pTargets.textContent = (session.targets.length - session.remaining()) + '/' + session.targets.length + ' delivered';
      // M12a.7: the live parcel counter "📦 carried / capacity"; red + pulsing
      // with a Restock! nudge when the stack is empty (but targets still remain).
      const empty = session.carried <= 0 && session.remaining() > 0;
      this.pParcels.textContent = '📦 ' + session.carried + '/' + session.capacity + (empty ? ' · Restock!' : '');
      this.pParcels.classList.toggle('empty', empty);
      this.pScore.textContent = 'score ' + session.scoring.score + '  ×' + session.scoring.multiplier();
      // §2.16: the HUD shows the top parcel's address (the one you throw next).
      const nx = session.topParcel();
      this.pNext.textContent = nx ? addrLabel(nx) : 'all delivered';
      // §2.6: the restock progress ring — fills over 1.0 s while standing in the
      // pickup zone (restockT only accumulates when there's still room to refill).
      if (session.restockT > 0) {
        this.pRestock.style.display = '';
        this.pRestockFill.style.width = Math.min(100, Math.round(session.restockT * 100)) + '%';
      } else this.pRestock.style.display = 'none';
    },
  };
}

// §10: refresh the ability button's cooldown ring + state each frame.
function updateAbilityBtn() {
  if (!abilityBtn) return;
  if (!abilities || !abilities.hasAbility) { abilityBtn.style.display = 'none'; return; }
  abilityBtn.style.display = '';
  abilityName.textContent = abilities.name;
  let deg, color;
  if (abilities.active) { deg = 360; color = '#ff7b9c'; }         // running: full, pulsing
  else {
    const cdFrac = abilities.coolFrac(); // 0 = ready .. 1 = just used
    deg = Math.round((1 - cdFrac) * 360);
    color = cdFrac <= 0 ? '#ffd166' : '#90e0ef';
  }
  abilityBtn.classList.toggle('active', !!abilities.active);
  abilityBtn.classList.toggle('ready', abilities.ready);
  abilityRing.style.background = 'conic-gradient(' + color + ' ' + deg + 'deg, rgba(255,255,255,0.16) 0deg)';
}

// §2.16: the top parcel's address for the HUD — "#num street · type".
function addrLabel(t) {
  if (!t) return '—';
  return '📦 #' + t.house.num + ' ' + t.house.street + ' · ' + t.pkg.name;
}

// §2.20 / §10: the world clock readout. Free roam shows the clock; a running
// shift appends " · shift ends HH:MM" and turns orange in the last game hour.
function minToTime(min) {
  const m = ((min % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60), mm = Math.floor(m % 60);
  return (h < 10 ? '0' : '') + h + ':' + (mm < 10 ? '0' + mm : mm);
}
function updateHudClock() {
  if (!hud || !hud.clockEl || !dayClock) return;
  let txt = dayClock.timeStr();
  let urgent = false;
  if (mission && mission.active) {
    const endMin = mission.tipByMin > 0 ? mission.tipByMin : mission.deadlineMin;
    txt += ' · shift ends ' + minToTime(endMin);
    // §2.20: orange in the last game hour of the window.
    urgent = dayClock.min >= endMin - 60 && dayClock.min < endMin;
  }
  hud.clockEl.textContent = txt;
  hud.clockEl.classList.toggle('urgent', !!urgent);
  // §2.20: the bench prompt shows when the courier is sitting in the bench zone.
  if (benchPromptEl) benchPromptEl.style.display = benchIn && !mission ? '' : 'none';
}

// M12a.5: the results screen, the dispatch card and the free-roam marker card
// (mcShifts/mcRenderList/openMarkerCard/closeMarkerCard/mcStart/mcKey) live in
// gameplay/shiftFlow.js; the destructured refs above call them.

// §10: route a `?screen=` value to the matching screen. The results + full-map
// screens have their own handlers; the rest go through the screens module.
function routeScreen(name, params) {
  if (!name) return;
  if (name === 'title') { screens.show('title'); }
  else if (name === 'selectCourier') { screens.show('selectCourier', { char: params.char }); }
  else if (name === 'selectVehicle') { screens.show('selectVehicle', { veh: params.veh }); }
  else if (name === 'results') { showResults({ shift: 'morning', success: true, score: 3420, stars: 3, coins: 340, timeBonus: 120, delivered: 10, total: 10 }); }
  else if (name === 'settings') { screens.show('settings'); screens.buildSettings(qualityName); }
  else if (name === 'howTo') { screens.show('howTo'); }
  else if (name === 'pause') { if (screens) { screens.buildPause(); screens.show('pause'); } simPaused = true; }
  else if (name.startsWith('missionCard:')) { showShiftCard(name.slice(12)); }
  else if (name === 'fullMap') { fullMap.open(); }
}

// Setup a delivery session for an explicit target list + package mix (M6 shifts
// and the M5 interim both go through this). `charDef`/`vehDef` come from the
// currently-spawned courier.
// §2.6: the restock zone for a shift's `pickup` (world-space rect). Main shifts
// use the depot's `restockZone`; side missions restock at their shop's front row.
function restockZoneFor(shift) {
  const T = world.tilemap.tileSize;
  const rect = (x0, z0, x1, z1) => ({ minX: x0 * T, maxX: (x1 + 1) * T, minZ: z0 * T, maxZ: (z1 + 1) * T });
  if (shift.kind === 'main' || shift.pickup === 'depot') { const rz = world.def.restockZone; return rect(rz.x0, rz.z0, rz.x1, rz.z1); }
  const b = (world.def.buildings || []).find((x) => x.id === shift.pickup);
  if (!b) { const rz = world.def.restockZone; return rect(rz.x0, rz.z0, rz.x1, rz.z1); }
  if (b.facing === 'S') return rect(b.x, b.z + b.d, b.x + b.w - 1, b.z + b.d);
  if (b.facing === 'E') return rect(b.x + b.w, b.z, b.x + b.w, b.z + b.d - 1);
  if (b.facing === 'W') return rect(b.x - 1, b.z, b.x - 1, b.z + b.d - 1);
  return rect(b.x, b.z - 1, b.x + b.w - 1, b.z - 1); // facing N (default)
}
function restockLabelFor(shift) {
  if (shift.kind === 'main' || shift.pickup === 'depot') return 'depot';
  const b = (world.def.buildings || []).find((x) => x.id === shift.pickup);
  return b ? b.name : 'depot';
}

function setupDelivery(charDef, vehDef, targetDefs, packageMix, seed, effects, floatText, shift) {
  return createDelivery({ world, camera, renderer, scene, player, input, charDef, vehDef, targets: targetDefs || M5_TARGETS, seed, ui: document.getElementById('ui'), packageMix, effects, floatText, hazards, events, restockZone: shift ? restockZoneFor(shift) : null, restockLabel: shift ? restockLabelFor(shift) : 'depot', lockerBodies: world.lockerBodies || [], lockers: world.lockers || null, onParcelRest: (x, y, z) => { const b = mischief ? mischief.grumpHit(x, z, y) : null; if (b && events) events.emit(b.kind === 'window' ? 'crash' : 'splat'); } });
}
resizeRenderer(renderer, camera);

// §2.11: apply a quality preset chosen on the Settings screen. The WebGL
// antialias flag + the renderer/loop/shadow maps are built at boot, so the
// choice is persisted and the page reloaded to rebuild them with the preset.
function applyQuality(name) {
  if (!name || name === qualityName) return;
  progress.setSetting('quality', name);
  location.reload();
}

// M12a.5: camera presets live in render/camPresets.js; this thin wrapper passes
// the live module refs (the world is read at call time, null until built).
function camPreset(name) { applyCamPreset(camera, name, { world, camLook, scene }); }

// One fixed sim step for the playing core: player kinematics + visuals, the
// follow cam, and the blob shadow. Called by update() each fixed step, or
// manually by __pb.step() while paused.
// §10: while a non-pause menu is up, the player is locked (no movement) but the
// rest of the world stays live behind it. The pause screen freezes the whole sim.
function menuGate() { return !!(screens && screens.active && screens.active !== 'pause'); }

function simStep(dt) {
  // §2.12 hit-stop: on a knockdown the world freezes ~70 ms (dramatic beat).
  if (simTime < hitStopUntil) return;
  // §2.15 BUSTED!: a ~2 s freeze on a ticket (the sim halts, not just the player).
  if (simTime < bustedUntil) return;
  if (hazards) hazards.step(dt);
  // M8: the courier's ability (counts down its duration + cooldown; the stack
  // the player/hazards/targeting read is mutated live by its start/update/end).
  if (abilities) abilities.tick(dt);
  // M7b: the mischief layer (heat + Grump chase + Watch pursuit + bowling).
  if (heat) heat.tick(dt);
  if (mischief) mischief.tick(dt);
  if (watch) watch.step(dt);
  if (ambient) {
    const bt = (activeVeh && activeVeh.id === 'feet') ? MISCHIEF.bowlFootSpeed : MISCHIEF.bowlVehicleSpeed;
    ambient.step(dt, player, bt);
  }
  if (depotLife) depotLife.step(dt);
  // §2.18: the in-world exit travel prompt + the T-key travel.
  stepExits();
  // M10: the hidden Golden Parcels (spin/bob + collect on contact) + the free-roam
  // day cycle (a mission holds its own time of day, so it only ticks in free roam).
  if (collectibles && player) collectibles.tick(dt, simTime, player);
  // §2.20: the Quickbox bench — sitting in its zone + holding F (in free roam, no
  // dispatch card open) fast-forwards the clock ×20 to the next shift window's
  // opening; walking off or releasing F stops it.
  benchIn = !!(benchZone && player && !mission && !delivery && !menuGate()
    && player.pos.x >= benchZone.minX && player.pos.x <= benchZone.maxX
    && player.pos.z >= benchZone.minZ && player.pos.z <= benchZone.maxZ);
  benchFF = benchIn && !menuGate() && !!input.isHeld('doorstep');
  // §2.20: the world clock always advances (the HUD + shift windows follow it);
  // the time-of-day look is clock-driven in free roam, held at the shift's preset
  // while a shift is running (snapped at its start).
  if (dayClock) {
    if (benchFF) {
      // §2.20: fast-forward ×20 to the next window opening, stopping there (the
      // target is captured on the first frame of the fast-forward, then clamped).
      if (benchFFTarget < 0) benchFFTarget = dayClock.nextWindowOpen();
      if (benchFFTarget > 0) dayClock.min = Math.min(dayClock.min + dt * 20, benchFFTarget);
      if (audio && simTime % 0.12 < dt) audio.tickFast(); // a ticking-clock blip
    } else {
      benchFFTarget = -1;
      dayClock.tick(dt);
    }
  }
  if (dayClock && dayCycle && !mission && !delivery) {
    const pb = dayClock.presetBlend();
    dayCycle.setPhase(pb.idx, pb.frac);
    setCricketsForPreset(TIMES_OF_DAY[pb.idx]);
  }
  if (player && !menuGate()) {
    player.update(dt, input, simTime);
    player.syncVisuals(dt, simTime);
    // §2.12 speed lines: while Sprint/Turbo raise the top speed, a short white
    // streak trails behind at speed (throttled to ~6/s, allocation-free).
    if (sharedEffects && player.stack.speedMul > 1 && Math.abs(player.speed) > 6 && (simTime % 0.15) < dt) {
      sharedEffects.speedLines(player.pos.x, player.pos.z, Math.sin(player.heading) * player.speed, -Math.cos(player.heading) * player.speed);
    }
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
  // M12a.1: free-roam proximity to a mission / locker / side marker opens its
  // card (edge-triggered on the marker id changing, so leaving + re-entering
  // re-opens it, but a standing-still card doesn't flap).
  if (player && markers && !mission && !delivery && !menuGate()) {
    const nearM = markers.nearest(player.pos.x, player.pos.z, MARKER_RADIUS);
    if (nearM !== prevM) {
      prevM = nearM;
      if (nearM === 'locker') screens.show('selectCourier');
      else if (nearM) openMarkerCard(nearM);
      else closeMarkerCard();
    }
    // §2.17: a parcel locker in free roam does nothing — a "Closed" nudge on approach.
    if (world.lockerBodies && world.lockerBodies.length) {
      let nl = -1;
      const LR = 2.4;
      for (let i = 0; i < world.lockerBodies.length; i++) {
        const dx = world.lockerBodies[i].wx - player.pos.x, dz = world.lockerBodies[i].wz - player.pos.z;
        if (dx * dx + dz * dz < LR * LR) { nl = i; break; }
      }
      if (nl !== prevLocker) {
        prevLocker = nl;
        if (nl !== -1 && sharedFloatText) sharedFloatText.pop('Closed. Shift parcels only.', player.pos.x, 1.7, player.pos.z, { color: '#8d99ae' });
      }
    }
  }
  if (delivery) {
    delivery.handleInput();
    delivery.updateDoorstep(dt);
    delivery.updateRestock(dt);
    delivery.updateLockerRestock(dt); // §2.17: restock at a full parcel locker
    delivery.parcels.step(dt);
    delivery.npcs.step(dt);
    delivery.markers.update(dt, simTime, player ? player.pos.x : 0, player ? player.pos.z : 0, delivery.topParcel());
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

// M12: a headless autoplayer for the star-threshold soak test. It "walks" to each
// undelivered doormat at a brisk-but-human pace (so the shift clock runs down and
// the time bonus stays realistic), then throws a slightly-off parcel — a
// decent-but-imperfect game. Its score is the ~1-star baseline that a careful
// human (perfect throws, no knockdowns) is expected to beat for 2–3 stars.
// M12a.6 / M12b: the autoplayer refills its parcel stack at the pickup zone (the
// depot for main shifts, the shop front for side missions) like a real courier.
function autoplayerRestock() {
  const shift = SHIFTS.find((s) => s.id === activeShiftId) || {};
  const rz = restockZoneFor(shift);
  if (!rz) return;
  const cx = (rz.minX + rz.maxX) / 2, cz = (rz.minZ + rz.maxZ) / 2;
  const TS = world.tilemap.tileSize;
  player.teleport(Math.floor(cx / TS), Math.floor(cz / TS), 0);
  for (let r = 0; r < 75; r++) simStep(1 / 60); // ~1.25 s: the 1.0 s restock ring fills
}

function autoplayRun() {
  if (!delivery || !player || !mission) return null;
  const m = mission, d = delivery; // endShift (on the auto-end) nulls the module vars; keep refs
  const T = 1 / 60;
  const outcomes = [];
  let lastRes = null, guard = 0, lastTid = '', retries = 0;
  while (guard++ < 200 && !lastRes) {
    if (m.lastResult) { lastRes = m.lastResult; break; } // auto-ended (all delivered or time out)
    // M15: when the stack has run dry but parcels remain, restock before the top
    // grab (which bails on an empty stack). The M13 order skipped this restock
    // and capped every run at the courier's capacity.
    if (d.carried <= 0 && d.remaining() > 0) autoplayerRestock();
    const t = d.topParcel(); // §2.16: deliver the top parcel's house (auto-matching doorstep)
    if (!t) { m.end(); lastRes = m.lastResult; break; } // nothing left to deliver
    const tid = String(t.house.id);
    if (tid === lastTid) retries++; else { retries = 0; lastTid = tid; }
    if (retries >= 3) break; // give up on a stubborn target (the shift ends short)
    const dx = t.doormat.x, dz = t.doormat.z;
    // Teleport to the target's porch (the doormat tile) + doorstep it (safe + reliable).
    const TS = world.tilemap.tileSize;
    player.teleport(Math.floor(dx / TS), Math.floor(dz / TS), 0);
    input.forceHeld('doorstep', true);
    const before = d.lastResult;
    for (let s = 0; s < 140; s++) {
      if (m.lastResult) { lastRes = m.lastResult; break; }
      simStep(T);
      if (d.lastResult && d.lastResult !== before) break;
    }
    input.forceHeld('doorstep', false);
    if (m.lastResult) { lastRes = m.lastResult; break; }
    if (d.lastResult) outcomes.push(d.lastResult.outcome);
    // A "reposition / look for the next target" pause burns ~45% of the shift's
    // window spread across the deliveries, so the autoplayer plays at a real-courier pace.
    const reposition = Math.floor((m.shiftSpanMin * 0.45) / T / Math.max(1, d.targets.length));
    for (let p = 0; p < reposition && !m.lastResult; p++) simStep(T);
  }
  if (!lastRes) { m.end(); lastRes = m.lastResult; }
  return { res: lastRes, outcomes };
}

function update(dt) {
  simTime += dt;
  if (bustedEl && simTime >= bustedUntil) { bustedEl.remove(); bustedEl = null; }
  if (sky) sky.follow(camera); // dome tracks the cam so it is always enclosed
  if (world && world.flag) world.flag.rotation.y = Math.sin(simTime * 2.0) * 0.3;
  if (markers) markers.tick(dt); // M12a.1: the marker icons keep spinning (even while paused)
  // Distance-scaled fog + far clip (§7.3 plan change): near/far track the
  // camera's distance d to its look target, updated every frame with no
  // allocation. updateProjectionMatrix only when far actually changes.
  const d = camera.position.distanceTo(camLook);
  if (scene.fog) { scene.fog.near = d + 45; scene.fog.far = d + 150; }
  const far = Math.max(220, d + 260);
  if (far !== camera.far) { camera.far = far; camera.updateProjectionMatrix(); }
  if (sharedFloatText) sharedFloatText.sync(); // the shared pool: mission results + free-roam gags + Golden Parcels (also while paused)
  if (radar) radar.tick(dt); // M6b: the corner radar stays live (also while paused)
  if (fullMap) fullMap.tick(dt);
  updateAbilityBtn(); // §10: the ability button's ring reflects the live cooldown
  updateHudClock(); // §2.20: the world clock readout (free roam + shift end)
  updateHeatRow(); // §2.15 / M12a.9: the heat-whistle row above the radar
  // §2.20: persist the world clock ~every 4 s so it survives a reload.
  if (dayClock && (clockSaveGap -= dt) <= 0) { clockSaveGap = 4; saveData.clock = dayClock.min; progress.save(); }
  if (simPaused !== musicPaused) { musicPaused = simPaused; if (musicPaused) audio.stopMusic(); else audio.startMusic(false); }
  if (input.consume('mute')) audio.setMuted(!audio.muted);
  // M12a.8: Tab opens / closes the full map (in free roam + missions, not menus).
  if (!menuGate() && input.consume('map')) { if (fullMap) { if (fullMap.isOpen()) fullMap.close(); else fullMap.open(); } }
  if (audioDebugEl) audioDebugEl.textContent = 'SFX ' + audio.lastSounds().join(' ');
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

// §9: the AudioContext is created + resumed on the first user gesture (browsers
// block audio otherwise); the light ambience + the music loop start there too.
let audioUnlocked = false;
function unlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;
  audio.unlock();
  audio.beginAmbience();
}
window.addEventListener('keydown', unlockAudio);
window.addEventListener('mousedown', unlockAudio);
// A hidden tab suspends the whole context (and stops the music); a visible tab
// resumes it. The rAF loop is separately paused/started by createLoop.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { audio.suspend(); audio.stopMusic(); }
  else { audio.resume(); if (!simPaused) audio.startMusic(false); }
});

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

// §2.11: the FPS overlay is available via `?debug=1` or the persisted `showFps`
// setting; the M9 last-sound readout is only on with `?debug=1`.
if (params.debug || saveData.settings.showFps) createDebugOverlay(stats);
if (params.debug) {
  audioDebugEl = el('div', 'audio-debug', 'SFX —');
  document.getElementById('ui').append(audioDebugEl);
}

// M12a.5: the __pb debug hooks live in core/debugHooks.js; they read the live
// module refs through a context of getters (mutable refs) + plain consts/functions,
// and write back into main.js state only through stepSim / setPrevM / setSimPaused.
const debugCtx = {
  get audio() { return audio; },
  get delivery() { return delivery; },
  get player() { return player; },
  get world() { return world; },
  get ambient() { return ambient; },
  get hazards() { return hazards; },
  get mission() { return mission; },
  get heat() { return heat; },
  get watch() { return watch; },
  get mischief() { return mischief; },
  get collectibles() { return collectibles; },
  get screens() { return screens; },
  get followCam() { return followCam; },
  get radar() { return radar; },
  get abilities() { return abilities; },
  get sharedFloatText() { return sharedFloatText; },
  get sharedEffects() { return sharedEffects; },
  get charRegistry() { return charRegistry; },
  get vehRegistry() { return vehRegistry; },
  get markers() { return markers; },
  get mcMarker() { return getMarkerState(); },
  get dayCycle() { return dayCycle; },
  get dayClock() { return dayClock; },
  get shifts() { return SHIFTS; },
  get benchZone() { return benchZone; },
  get transition() { return transition; },
  get regionMap() { return regionMap; },
  get exits() { return exits; },
  setClock(min) { if (dayClock) dayClock.min = min; },
  get benchState() { return { in: benchIn, ff: benchFF, zone: !!benchZone, isHeldF: input.isHeld('doorstep'), menuGate: menuGate() }; },
  get simTime() { return simTime; },
  events, gameState, M5_TARGETS, input, camTgt, camLook, camera, scene, renderer, progress, params,
  stats, camPreset, startShift, gotoFreeRoam, endShift, routeScreen, openMarkerCard,
  refreshCoins, refreshGolden, onStrike, onBusted, autoplayRun,
  gotoNeighborhood: (nbId, exitId) => { gotoNeighborhood(nbId, exitId); },
  stepSim(frames) { const st = 1 / 60; for (let i = 0; i < (frames | 0); i++) { simTime += st; simStep(st); } },
  setPrevM(v) { prevM = v; },
  setSimPaused(v) { simPaused = v; },
};
window.__pb = createDebugHooks(debugCtx);
