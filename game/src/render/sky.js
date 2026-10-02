import * as THREE from 'three';
import { VoxelBuilder } from './voxel.js';
import { mulberry32 } from '../core/rng.js';

// Inverted sky sphere with horizon-to-zenith vertex colors (fog disabled,
// drawn first), scene fog, and 6 drifting flat voxel clouds in one
// InstancedMesh (§7.3). update(dt, time) is allocation-free.
// `region` ({ cx, cz, sx, sz }) is the map center + a span (map extent + a
// margin) that the clouds are distributed over; omit it for the small test
// scenes (they default to a field around the origin).
export function createSky(scene, preset, region) {
  const r = region || { cx: 0, cz: 0, sx: 200, sz: 200 };
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

  // Clouds: a puffy, flat, soft shape (a low wide base under three puffs) so
  // they read as clouds, not little cars. Six instances, drifting slowly at
  // y = 45, distributed over the map region (extent + a margin, centered on
  // the map center) and wrapped over that span, so the x-wrap happens well
  // off the map's edge and is never seen from the overview (§7.3 / M12a.2).
  const cb = new VoxelBuilder(13);
  cb.box(-2.6, 0.2, 0, 6.0, 0.9, 3.4, '#fffdf5');
  cb.box(2.6, 0.4, 0.8, 4.6, 0.8, 2.8, '#fffdf5');
  cb.box(-0.4, 1.0, -0.8, 3.8, 0.7, 2.4, '#fffdf5');
  cb.box(0.4, -0.3, 0.4, 7.5, 0.7, 3.2, '#f8f2e6');
  const cloudGeo = cb.toGeometry();
  const clouds = new THREE.InstancedMesh(cloudGeo, new THREE.MeshLambertMaterial({ vertexColors: true }), 6);
  const N = 6;
  const ox = new Float64Array(N);
  const czArr = new Float64Array(N);
  const cseed = new Float64Array(N);
  const rng = mulberry32(1234);
  for (let i = 0; i < N; i++) {
    ox[i] = rng() * r.sx;
    czArr[i] = r.cz - r.sz / 2 + rng() * r.sz;
    cseed[i] = rng() * 1000;
  }
  scene.add(clouds);
  const m4 = new THREE.Matrix4();

  function update(dt, time) {
    for (let i = 0; i < N; i++) {
      const x = r.cx - r.sx / 2 + ((ox[i] + time * 0.25) % r.sx);
      const bob = Math.sin(time * 0.3 + cseed[i]) * 0.5;
      m4.makeTranslation(x, 45 + bob, czArr[i]);
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
      if (scene.fog) scene.fog.color.set(p.skyHorizon); // M15a.18: fog is off in the map / menu showcase
    },
    update,
    follow,
    // M15a.18: hide the dome + clouds (the full map / title show a clean background
    // instead of the horizon-color "void" the dome leaves past the ground).
    setVisible(on) { skyMesh.visible = on; clouds.visible = on; },
    get visible() { return skyMesh.visible; },
    // §2.18: free the sky dome + clouds + their materials/textures on unload.
    dispose() {
      scene.remove(skyMesh, clouds);
      geo.dispose();
      skyMesh.material.dispose();
      cloudGeo.dispose();
      clouds.material.dispose();
    },
  };
}
