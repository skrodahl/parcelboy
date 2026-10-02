import * as THREE from 'three';
import { VoxelBuilder } from '../render/voxel.js';
import { PALETTE } from '../data/palette.js';
import { mulberry32 } from '../core/rng.js';
import { tileBaseY } from './terrain.js';

// §6.2: a parked car on 40% of driveways (static collider). Cars are rounded
// boxes merged into the owning chunk, colors from the §7.6 list.
const T = 4;
const CAR_COLORS = ['#ef476f', '#ffd166', '#06d6a0', '#118ab2', '#f8f9fa', '#8338ec'];
const CAR_DARK = {
  '#ef476f': '#c73654', '#ffd166': '#e0b84e', '#06d6a0': '#05b58c',
  '#118ab2': '#0d739a', '#f8f9fa': '#d9dbde', '#8338ec': '#6f2bd0',
};

// Contiguous vertical `d` runs per column: { x, z0, z1 } (z0 = north end).
export function findDriveways(tm) {
  const groups = [];
  for (let x = 0; x < tm.width; x++) {
    let z = 0;
    while (z < tm.height) {
      if (tm.charAt(x, z) !== 'd') { z++; continue; }
      let zEnd = z;
      while (zEnd + 1 < tm.height && tm.charAt(x, zEnd + 1) === 'd') zEnd++;
      groups.push({ x, z0: z, z1: zEnd });
      z = zEnd + 1;
    }
  }
  return groups;
}

// One rounded-box sedan facing +Z, centered at origin, base at y=0.
function carBoxes(op, col) {
  op.box(0, 0.35, 0.1, 1.9, 0.7, 3.9, col, { skipFaces: ['bottom'] }); // lower body
  op.box(0, 0.6, 0.0, 1.7, 0.5, 3.3, CAR_DARK[col], { skipFaces: ['bottom'] }); // bevel
  op.box(0, 0.85, -0.35, 1.55, 0.5, 2.2, col, { skipFaces: ['bottom'] }); // greenhouse
  op.box(0, 0.85, 0.85, 1.4, 0.5, 0.12, PALETTE.windowDay); // windshield
  op.box(0, 0.85, -1.45, 1.4, 0.45, 0.12, PALETTE.windowDay); // rear glass
  for (const s of [-1, 1]) for (const dz of [-1.25, 1.25]) {
    op.box(s * 0.95, 0.15, dz, 0.32, 0.32, 0.72, '#2f333d', { skipFaces: ['bottom'] }); // wheels
  }
}

export function parkCars(grid, tm, colliders, seed = 7) {
  const groups = findDriveways(tm);
  const rng = mulberry32(seed);
  let placed = 0;
  for (const g of groups) {
    if (rng() >= 0.4) continue;
    placed++;
    const col = CAR_COLORS[(rng() * CAR_COLORS.length) | 0];
    const zc = ((g.z0 + g.z1) / 2) | 0; // center tile of the run
    const wx = tm.cx(g.x), wz = tm.cz(zc);
    const faceNorth = rng() < 0.5;
    const op = new VoxelBuilder(seed * 13 + g.x * 7 + zc * 31);
    carBoxes(op, col);
    const sitY = tileBaseY(tm, g.x, zc) + 0.12; // §2.19: sit on the driveway's terrain level
    const m = new THREE.Matrix4().makeRotationY(faceNorth ? Math.PI : 0);
    m.setPosition(wx, sitY, wz); // sit on the raised driveway
    grid.chunkAt(g.x, zc).opaque.merge(op, m);
    colliders.push({
      type: 'box',
      minX: wx - 1.0, maxX: wx + 1.0,
      minZ: wz - 2.0, maxZ: wz + 2.0,
      h: sitY + 1.6,
    });
  }
  return { placed, total: groups.length };
}
