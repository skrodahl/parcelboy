import * as THREE from 'three';
import { VoxelBuilder } from '../render/voxel.js';
import { PALETTE } from '../data/palette.js';

// §2.17 / M15a.2: the parcel lockers — teal Quickbox cabinets on the sidewalks.
// The cabinet is ~3.2 wide × 1.2 deep × 2.2 tall, built *inside its one tile*
// (it never reaches onto a road or a neighboring tile). Its back sits against the
// yard-side edge (the side away from the road) and its doors face the road side,
// so a walker/courier can pass between the cabinet and the curb. The cabinet body
// merges into the chunk (0 draw calls); the status light + the door are two small
// InstancedMeshes whose color/orientation change with the full/empty state.

const ROAD = new Set(['road', 'lot']);
// Cabinet fits one tile (tileSize 4): 3.2 wide × 1.2 deep × 2.2 tall.
const W = 3.2, D = 1.2, H = 2.2;

export function buildLockers(grid, tm, colliders) {
  const T = tm.tileSize;
  const lockers = tm.def.parcelLockers || [];
  const bodies = [];
  const brand = PALETTE.brand;
  for (let i = 0; i < lockers.length; i++) {
    const [tx, tz] = lockers[i];
    // M15a.2: which side of the tile is the road? The doors face it, the back
    // sits against the opposite (yard) edge. Priority N, W, S, E.
    let rdx = 0, rdz = 1; // fallback: face +Z (the validator guarantees a road side)
    for (const [sx, sz] of [[0, -1], [-1, 0], [0, 1], [1, 0]]) {
      if (ROAD.has(tm.keyAt(tx + sx, tz + sz))) { rdx = sx; rdz = sz; break; }
    }
    const ang = Math.atan2(rdx, rdz); // Y rotation that points the doors at the road
    const alongZ = Math.abs(rdz) > Math.abs(rdx); // road N/S → the long side runs along X
    const cx = tm.cx(tx), cz = tm.cz(tz);
    const off = (T - D) / 2; // push the cabinet to the yard edge (opposite the road)
    const bx = cx - off * rdx, bz = cz - off * rdz; // cabinet center
    const wX = alongZ ? W : D, wZ = alongZ ? D : W; // box extents along X / Z
    const op = new VoxelBuilder(5000 + i * 13);
    op.box(bx, 0, bz, wX, H, wZ, brand, { skipFaces: ['bottom'] }); // cabinet body
    // The front (facing the road): an inset panel + two door panes, just inside
    // the front face. `alongZ` decides which axis the long side runs on.
    const face = 0.5; // the front face is half the depth (0.6) in from the center
    if (alongZ) {
      const fz = bz + face * rdz;
      op.box(bx, 0.1, fz, wX * 0.92, H - 0.2, 0.1, '#0a8f85'); // inset front
      op.box(bx - W / 4, 0.2, fz + 0.04 * rdz, W * 0.34, H * 0.5, 0.06, PALETTE.roof[5]); // door pane (L)
      op.box(bx + W / 4, 0.2, fz + 0.04 * rdz, W * 0.34, H * 0.5, 0.06, PALETTE.roof[5]); // door pane (R)
    } else {
      const fx = bx + face * rdx;
      op.box(fx, 0.1, bz, 0.1, H - 0.2, wZ * 0.92, '#0a8f85'); // inset front
      op.box(fx + 0.04 * rdx, 0.2, bz - W / 4, 0.06, H * 0.5, W * 0.34, PALETTE.roof[5]); // door pane (top)
      op.box(fx + 0.04 * rdx, 0.2, bz + W / 4, 0.06, H * 0.5, W * 0.34, PALETTE.roof[5]); // door pane (bottom)
    }
    op.box(bx, H + 0.04, bz, 0.5, 0.14, 0.5, '#5a5e6e'); // status-light housing
    grid.chunkAt(tx, tz).opaque.merge(op);
    // The collider matches the new footprint (so you can pass between it + the curb).
    colliders.push({ type: 'box', minX: bx - wX / 2 + 0.1, maxX: bx + wX / 2 - 0.1, minZ: bz - wZ / 2 + 0.1, maxZ: bz + wZ / 2 - 0.1, h: H });
    bodies.push({ wx: bx, wz: bz, ang, lightY: H + 0.28 });
  }
  return bodies;
}

// The dynamic light + door state. One InstancedMesh for the lights (teal=full,
// red=empty) + one for the doors (closed=full, hinging open=empty). The doors +
// light follow each locker's `ang` (the road-facing rotation). State changes are
// just matrix/color writes (no per-frame allocation).
export function createLockerVisuals(bodies, scene) {
  const n = Math.max(1, bodies.length);
  const lightGeo = new THREE.BoxGeometry(0.5, 0.18, 0.5);
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const lights = new THREE.InstancedMesh(lightGeo, lightMat, n);
  lights.frustumCulled = false;
  const doorGeo = new THREE.BoxGeometry(0.9, 1.0, 0.06); // a wider single door
  const doorMat = new THREE.MeshLambertMaterial({ color: 0x3a3e4d });
  const doors = new THREE.InstancedMesh(doorGeo, doorMat, n);
  doors.frustumCulled = false;
  scene.add(lights, doors);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), qO = new THREE.Quaternion();
  const p = new THREE.Vector3(), sc = new THREE.Vector3();
  const xAxis = new THREE.Vector3(1, 0, 0), yAxis = new THREE.Vector3(0, 1, 0);
  const cLight = new THREE.Color(), _full = new THREE.Color(PALETTE.brand), _empty = new THREE.Color('#e63946');

  function place(i, empty) {
    const b = bodies[i];
    // the status light (teal=full, red=empty) on the roof (centered, axis-aligned).
    p.set(b.wx, b.lightY, b.wz); q.identity(); sc.set(1, 1, 1); m4.compose(p, q, sc);
    lights.setMatrixAt(i, m4);
    cLight.copy(empty ? _empty : _full);
    lights.setColorAt(i, cLight);
    // the front door: closed when full, hinged open (~75° forward) when empty.
    // It sits on the front face (rotated to the road by `ang`), hinges about its
    // top edge (the door's local X) and opens forward (local +Z, out to the road).
    q.setFromAxisAngle(yAxis, b.ang);
    qO.setFromAxisAngle(xAxis, empty ? -1.3 : -0.12);
    q.multiply(qO);
    const oz = 0.68; // out to the front face along the (rotated) local +Z
    p.set(b.wx + Math.sin(b.ang) * oz, 0.72, b.wz + Math.cos(b.ang) * oz);
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
