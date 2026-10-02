import * as THREE from 'three';
import { VoxelBuilder } from '../render/voxel.js';

// §2.14: the busy Distribution Center. A conveyor belt (boxes on one
// InstancedMesh) feeding the pickup zone, and a forklift NPC driving back and
// forth between the pallets and the open dock. Cosmetic + pooled; `battery`
// halves the moving box count. Two extra draw calls (boxes + forklift).
const BOX_COLORS = ['#f4a261', '#e07a5f', '#80b918', '#4cc9f0', '#8338ec'];

function buildForklift() {
  const b = new VoxelBuilder(5501);
  b.box(0, 0.5, 0, 1.6, 0.7, 2.4, '#f4a261', { skipFaces: ['bottom'] }); // body
  b.box(0, 1.1, -0.4, 1.2, 0.8, 1.0, '#3d4152'); // cab
  b.box(0, 1.0, 1.3, 1.1, 0.1, 0.5, '#3d4152'); // mast
  b.box(-0.5, 0.4, 1.5, 0.1, 0.1, 0.9, '#22223b'); // fork
  b.box(0.5, 0.4, 1.5, 0.1, 0.1, 0.9, '#22223b');
  for (const s of [-1, 1]) for (const dz of [0.8, -0.7]) b.box(s * 0.6, 0.2, dz, 0.4, 0.4, 0.7, '#2f333d');
  return b.toGeometry();
}

export function createDepotLife(scene, world, mat, battery) {
  const T = world.tilemap.tileSize;
  // Anchor to the parking lot in front of the open dock (the L tiles east of
  // the depot). Everything is placed in world coords here, so no static merge.
  const lot = { x: world.tilemap.cx(44), z: world.tilemap.cz(36) };

  // Pallet stacks (one merged static mesh).
  const palletGeo = new VoxelBuilder(5502);
  for (let pi = 0; pi < 3; pi++) {
    const dx = lot.x - 3 + pi * 2.6, dz = lot.z - 4;
    palletGeo.box(dx, 0, dz, 1.4, 0.2, 1.4, '#8a5a33');
    palletGeo.box(dx, 0.35, dz, 1.2, 0.5, 1.2, BOX_COLORS[pi % BOX_COLORS.length]);
    palletGeo.box(dx + 0.5, 0.35, dz, 1.0, 0.5, 1.2, BOX_COLORS[(pi + 1) % BOX_COLORS.length]);
  }
  const palletMesh = new THREE.Mesh(palletGeo.toGeometry(), mat);
  scene.add(palletMesh);
  // The conveyor belt: a long dark strip from the pallets toward the dock.
  const beltGeo = new VoxelBuilder(5503);
  beltGeo.box(lot.x - 3, 0.2, lot.z, 0.9, 0.4, 9, '#3d4152');
  const belt = new THREE.Mesh(beltGeo.toGeometry(), mat);
  scene.add(belt);

  // Sliding boxes on the conveyor (one InstancedMesh, colored once).
  const NB = battery ? 3 : 5;
  const boxMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), mat, NB);
  boxMesh.frustumCulled = false;
  boxMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(boxMesh);
  const boxCols = new Array(NB);
  for (let i = 0; i < NB; i++) { boxCols[i] = new THREE.Color(BOX_COLORS[i % BOX_COLORS.length]); boxMesh.setColorAt(i, boxCols[i]); }
  boxMesh.instanceColor.needsUpdate = true;
  const boxes = [];
  for (let i = 0; i < NB; i++) boxes.push({ f: i / NB });

  // The forklift (a single merged mesh) drives back and forth along the lot.
  const fork = new THREE.Mesh(buildForklift(), mat);
  scene.add(fork);

  const M = new THREE.Matrix4();
  let t = 0;
  let fx = 0;
  function step(dt) {
    t += dt;
    for (let i = 0; i < NB; i++) {
      const bx = boxes[i];
      bx.f = (bx.f + dt * 0.08) % 1;
      M.makeTranslation(lot.x - 3, 0.4, lot.z - 4.5 + bx.f * 9);
      boxMesh.setMatrixAt(i, M);
    }
    boxMesh.instanceMatrix.needsUpdate = true;
    const s = (Math.sin(t * 0.4) + 1) / 2;
    fx = s;
    fork.position.set(lot.x + 1.5, 0, lot.z - 1 + s * 6);
    fork.rotation.y = Math.cos(t * 0.4) >= 0 ? Math.PI : 0;
  }

  function dispose() {
    // §2.18: free every mesh's geometry on unload (the shared `mat` is disposed
    // with the world). `palletGeo`/`beltGeo` are VoxelBuilders (no dispose); the
    // real geometries are the meshes'.
    scene.remove(palletMesh, belt, boxMesh, fork);
    palletMesh.geometry.dispose();
    belt.geometry.dispose();
    fork.geometry.dispose();
    boxMesh.geometry.dispose();
    boxMesh.dispose();
  }

  return { step, dispose, get reversing() { return fx > 0.5; } };
}
