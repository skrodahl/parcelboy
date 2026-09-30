import * as THREE from 'three';
import { VoxelBuilder } from './voxel.js';
import { mulberry32 } from '../core/rng.js';

// Inverted sky sphere with horizon-to-zenith vertex colors (fog disabled,
// drawn first), scene fog, and 6 drifting flat voxel clouds in one
// InstancedMesh (§7.3). update(dt, time) is allocation-free.
export function createSky(scene, preset) {
  // The dome follows the camera and must stay inside its far clip plane (220),
  // so a fixed 200-radius dome centered on the camera reads as "infinity".
  const R = 200;
  const geo = new THREE.SphereGeometry(R, 24, 12);
  const posAttr = geo.attributes.position;
  const count = posAttr.count;
  const colors = new Float32Array(count * 3);
  const colorAttr = new THREE.BufferAttribute(colors, 3);
  geo.setAttribute('color', colorAttr);
  const cHorizon = new THREE.Color();
  const cZenith = new THREE.Color();
  const cTmp = new THREE.Color();

  function applyColors(p) {
    cHorizon.set(p.skyHorizon);
    cZenith.set(p.skyZenith);
    for (let i = 0; i < count; i++) {
      const t = Math.max(0, posAttr.getY(i) / R);
      cTmp.copy(cHorizon).lerp(cZenith, t);
      colors[i * 3] = cTmp.r;
      colors[i * 3 + 1] = cTmp.g;
      colors[i * 3 + 2] = cTmp.b;
    }
    colorAttr.needsUpdate = true;
  }

  const skyMesh = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false })
  );
  skyMesh.renderOrder = -1;
  scene.add(skyMesh);
  scene.fog = new THREE.Fog(new THREE.Color(preset.skyHorizon), 70, 160);

  // Clouds: a puffy 3-box shape instanced 6 times, drifting at y = 45.
  const cb = new VoxelBuilder(99);
  cb.box(-1.2, 0, 0, 3.4, 0.9, 2.2, '#fffaf0');
  cb.box(1.4, 0.2, 0.4, 2.6, 0.8, 1.8, '#fffaf0');
  cb.box(0.2, 0.7, -0.4, 2.0, 0.7, 1.6, '#fffaf0');
  const cloudGeo = cb.toGeometry();
  const clouds = new THREE.InstancedMesh(cloudGeo, new THREE.MeshLambertMaterial({ vertexColors: true }), 6);
  const N = 6;
  const cx = new Float64Array(N);
  const cz = new Float64Array(N);
  const cseed = new Float64Array(N);
  const rng = mulberry32(1234);
  for (let i = 0; i < N; i++) {
    cx[i] = (rng() * 2 - 1) * 80;
    cz[i] = (rng() * 2 - 1) * 80;
    cseed[i] = rng() * 1000;
  }
  scene.add(clouds);
  const m4 = new THREE.Matrix4();

  function update(dt, time) {
    for (let i = 0; i < N; i++) {
      const x = ((cx[i] + time * 0.35) % 160 + 160) % 160 - 80;
      const bob = Math.sin(time * 0.3 + cseed[i]) * 0.5;
      m4.makeTranslation(x, 45 + bob, cz[i]);
      clouds.setMatrixAt(i, m4);
    }
    clouds.instanceMatrix.needsUpdate = true;
  }

  // Keep the dome centered on the camera so it is always enclosed (allocation-free).
  function follow(cam) {
    skyMesh.position.copy(cam.position);
  }

  applyColors(preset);
  return {
    apply(p) {
      applyColors(p);
      scene.fog.color.set(p.skyHorizon);
    },
    update,
    follow,
  };
}
