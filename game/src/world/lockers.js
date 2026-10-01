import * as THREE from 'three';
import { VoxelBuilder } from '../render/voxel.js';
import { PALETTE } from '../data/palette.js';

// §2.17: the parcel lockers — teal Quickbox cabinets on the sidewalks. The
// cabinet body merges into the chunk (0 draw calls); the status light + the door
// are two small InstancedMeshes (one per locker) whose color/orientation change
// with the full/empty state. `bodies` (from buildLockers) holds the world pos.

export function buildLockers(grid, tm, colliders) {
  const T = tm.tileSize;
  const lockers = tm.def.parcelLockers || [];
  const bodies = [];
  for (let i = 0; i < lockers.length; i++) {
    const [tx, tz] = lockers[i];
    const wx = tm.cx(tx), wz = tm.cz(tz);
    const w = 2 * T * 0.9, d = T * 0.9, H = 2.2;
    const brand = PALETTE.brand;
    const op = new VoxelBuilder(5000 + i * 13);
    op.box(wx, 0, wz, w, H, d, brand, { skipFaces: ['bottom'] }); // cabinet body
    op.box(wx, 0.1, wz + d / 2 - 0.06, w * 0.92, H - 0.2, 0.1, '#0a8f85'); // inset front
    op.box(wx - w / 4, 0.2, wz + d / 2 + 0.03, w * 0.34, H * 0.5, 0.06, PALETTE.roof[5]); // door pane (L)
    op.box(wx + w / 4, 0.2, wz + d / 2 + 0.03, w * 0.34, H * 0.5, 0.06, PALETTE.roof[5]); // door pane (R)
    op.box(wx, H + 0.04, wz, 0.5, 0.14, 0.5, '#5a5e6e'); // status-light housing
    grid.chunkAt(tx, tz).opaque.merge(op);
    colliders.push({ type: 'box', minX: wx - w / 2 + 0.1, maxX: wx + w / 2 - 0.1, minZ: wz - d / 2 + 0.1, maxZ: wz + d / 2 - 0.1, h: H });
    // lightY sits on TOP of the housing (housing top = H + 0.18) so the beacon
    // reads clearly against the cabinet; a slightly smaller housing leaves it open.
    bodies.push({ wx, wz, w, d, lightY: H + 0.28 });
  }
  return bodies;
}

// The dynamic light + door state. One InstancedMesh for the lights (teal=full,
// red=empty) + one for the doors (closed=full, hinging open=empty). State
// changes are just matrix/color writes (no per-frame allocation).
export function createLockerVisuals(bodies, scene) {
  const n = Math.max(1, bodies.length);
  const lightGeo = new THREE.BoxGeometry(0.5, 0.18, 0.5);
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const lights = new THREE.InstancedMesh(lightGeo, lightMat, n);
  lights.frustumCulled = false;
  const doorGeo = new THREE.BoxGeometry(0.5, 1.0, 0.06);
  const doorMat = new THREE.MeshLambertMaterial({ color: 0x3a3e4d });
  const doors = new THREE.InstancedMesh(doorGeo, doorMat, n);
  doors.frustumCulled = false;
  scene.add(lights, doors);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3();
  const xAxis = new THREE.Vector3(1, 0, 0);
  const cLight = new THREE.Color(), _full = new THREE.Color(PALETTE.brand), _empty = new THREE.Color('#e63946');

  function place(i, empty) {
    const b = bodies[i];
    // the status light (teal=full, red=empty) on the roof.
    p.set(b.wx, b.lightY, b.wz); q.identity(); sc.set(1, 1, 1); m4.compose(p, q, sc);
    lights.setMatrixAt(i, m4);
    cLight.copy(empty ? _empty : _full);
    lights.setColorAt(i, cLight);
    // the front door: closed when full, hinged open (~75° forward) when empty.
    p.set(b.wx, 0.72, b.wz + b.d / 2 + 0.08);
    q.setFromAxisAngle(xAxis, empty ? -1.3 : -0.12);
    sc.set(1, 1, 1); m4.compose(p, q, sc);
    doors.setMatrixAt(i, m4);
    doors.instanceMatrix.needsUpdate = true;
    if (lights.instanceColor) lights.instanceColor.needsUpdate = true;
  }

  return {
    lights, doors,
    setAllFull() { for (let i = 0; i < bodies.length; i++) place(i, false); },
    setEmpty(i) { if (bodies[i]) place(i, true); },
    count: bodies.length,
  };
}
