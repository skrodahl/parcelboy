import * as THREE from 'three';
import { parseParams } from './core/params.js';
import { createLoop } from './core/loop.js';
import { createDebugOverlay } from './core/debug.js';

const params = parseParams();

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

const scene = new THREE.Scene();
scene.background = new THREE.Color('#8ecae6');

const camera = new THREE.PerspectiveCamera(50, 1, 0.5, 220);
camera.position.set(0, 5, 9);
camera.lookAt(0, 1, 0);

function resize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', resize);
resize();

// M0 placeholder scene: sunlit spinning cube on a grass plate.
scene.add(new THREE.HemisphereLight(0xbde0fe, 0xb7e4a0, 1.1));
const sun = new THREE.DirectionalLight(0xffe3c2, 2.4);
sun.position.set(-0.6, 0.55, -0.3).normalize().multiplyScalar(40);
scene.add(sun);

const cube = new THREE.Mesh(
  new THREE.BoxGeometry(2, 2, 2),
  new THREE.MeshLambertMaterial({ color: '#00b4a6' })
);
cube.position.y = 1.5;
scene.add(cube);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(60, 60),
  new THREE.MeshLambertMaterial({ color: '#7ccf6a' })
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

let simPaused = params.paused;
function update(dt) {
  if (simPaused) return;
  cube.rotation.y += dt * 0.8;
}

let ready = false;
function render() {
  renderer.render(scene, camera);
  if (!ready) {
    ready = true;
    window.__pb.ready = true;
  }
}

const loop = createLoop({ update, render, targetFps: 60 });

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
    quality: 'high',
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
