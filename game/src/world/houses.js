import * as THREE from 'three';
import { VoxelBuilder } from '../render/voxel.js';
import { GlowBuilder } from './glow.js';
import { PALETTE } from '../data/palette.js';
import { mulberry32 } from '../core/rng.js';

// §6.4: 5 house styles, style + colors seeded by house id (stable). Footprint
// 8x8 units, walls inset 0.4. Local frame: front (door) = +Z; the house is
// rotated into its facing and merged into one chunk. Windows are glow boxes
// (day/night colors); every window rect is recorded in world space for the
// M6 cracked-window overlay.

const T = 4;
const THETA = { N: Math.PI, S: 0, E: Math.PI / 2, W: -Math.PI / 2 };
const FACES = { N: [0, 0, -1], S: [0, 0, 1], E: [1, 0, 0], W: [-1, 0, 0] };

function idSeed(id) {
  let h = 7;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return h >>> 0;
}

// Driveway side of a house (which side has `d` tiles), or null.
function drivewaySide(tm, h) {
  const counts = { N: 0, E: 0, S: 0, W: 0 };
  for (let x = h.x - 1; x <= h.x + 2; x++) {
    for (let z = h.z - 1; z <= h.z + 2; z++) {
      if (tm.charAt(x, z) !== 'd') continue;
      const dx = x - (h.x + 0.5), dz = z - (h.z + 0.5);
      if (Math.abs(dx) > Math.abs(dz)) counts[dx > 0 ? 'E' : 'W']++;
      else counts[dz > 0 ? 'S' : 'N']++;
    }
  }
  let best = null;
  for (const s of ['E', 'W', 'S', 'N']) if (counts[s] > (best ? counts[best] : 0)) best = s;
  return best;
}

function win(gl, rec, x, y, z, w, h, nx, nz) {
  gl.box(x, y - h / 2, z, w, h, 0.12, PALETTE.windowDay, PALETTE.windowNight);
  rec.push({ x, y, z, w, h, nx, nz });
}

// Styles. op = opaque local builder, gl = glow local builder, rec = window rect
// recorder (local coords), c = { wall, roof, door }, rng.
const STYLES = {
  cottage(op, gl, rec, c, rng) {
    const H = 3.2;
    walls(op, c, H);
    roof(op, H, c.roof, [8.4, 6.4, 4.4, 2.4], 0.5); // steep gable
    door(op, c.door, 2.0);
    win(gl, rec, -2.0, 1.5, 3.66, 1.2, 1.2, 0, 1);
    win(gl, rec, 2.0, 1.5, 3.66, 1.2, 1.2, 0, 1);
    sideWin(gl, rec, c, H);
    // flower boxes under the front windows + round shrub
    op.box(-2.0, 0.75, 3.78, 1.7, 0.25, 0.25, PALETTE.roof[1], { skipFaces: ['bottom'] });
    op.box(2.0, 0.75, 3.78, 1.7, 0.25, 0.25, PALETTE.roof[1], { skipFaces: ['bottom'] });
    op.box(-2.8, 0, 4.4, 0.9, 0.6, 0.9, PALETTE.canopy[(rng() * 4) | 0], { skipFaces: ['bottom'] });
    porch(op, c, 2.8, 2.6, false);
    return { roofTop: H + 2.0, garage: false };
  },
  colonial(op, gl, rec, c, rng) {
    const H = 5.8;
    walls(op, c, H);
    roof(op, H, c.roof, [8.4, 6.0, 3.6], 0.5);
    op.box(1.8, H, -1.5, 0.8, 2.6, 0.8, PALETTE.roof[3], { skipFaces: ['bottom'] }); // chimney
    door(op, c.door, 2.2);
    for (const y of [1.4, 4.0]) {
      win(gl, rec, -2.0, y, 3.66, 1.1, 1.1, 0, 1);
      win(gl, rec, 2.0, y, 3.66, 1.1, 1.1, 0, 1);
      // shutters
      op.box(-2.85, y, 3.66, 0.18, 1.3, 0.08, '#4a4e69');
      op.box(2.85, y, 3.66, 0.18, 1.3, 0.08, '#4a4e69');
    }
    for (const s of [-1, 1]) {
      win(gl, rec, 3.66 * s, 1.4, 0, 1.1, 1.1, s, 0);
      win(gl, rec, 3.66 * s, 4.0, 0, 1.1, 1.1, s, 0);
    }
    porch(op, c, 3.0, 3.0, false);
    return { roofTop: H + 1.5, garage: false };
  },
  ranch(op, gl, rec, c, rng, side, facing) {
    const H = 3.0;
    walls(op, c, H);
    roof(op, H, c.roof, [8.8, 5.6], 0.45); // low hip
    door(op, c.door, 2.0);
    win(gl, rec, -1.9, 1.5, 3.66, 2.2, 1.3, 0, 1);
    win(gl, rec, 1.9, 1.5, 3.66, 2.2, 1.3, 0, 1);
    win(gl, rec, 3.66, 1.5, -0.5, 2.0, 1.3, 1, 0);
    // Attached garage block on the driveway side (only N/S-facing houses have
    // side driveways; local +X is world E for S-facing, world W for N-facing).
    let s = 0;
    if (side && (facing === 'N' || facing === 'S')) {
      s = side === 'E' ? (facing === 'S' ? 1 : -1) : (facing === 'S' ? -1 : 1);
      op.box(5.4 * s, 0, 0, 3.2, 2.6, 3.2, c.wall, { skipFaces: ['bottom'] });
      op.box(7.1 * s, 0.1, 0, 0.2, 2.2, 3.0, '#f8f9fa', { skipFaces: ['bottom'] });
      op.box(5.4 * s, 2.6, 0, 3.6, 0.3, 3.6, c.roof, { skipFaces: ['bottom'] });
    }
    porch(op, c, 3.4, 2.4, false);
    return { roofTop: H + 0.9, garage: s };
  },
  modern(op, gl, rec, c, rng) {
    const H = 5.8;
    walls(op, c, H);
    // flat roof with parapet
    op.box(0, H, 0, 8.0, 0.4, 8.0, c.roof, { skipFaces: ['bottom'] });
    op.box(0, H, 3.85, 8.0, 0.5, 0.3, c.roof);
    op.box(0, H, -3.85, 8.0, 0.5, 0.3, c.roof);
    op.box(3.85, H, 0, 0.3, 0.5, 7.7, c.roof);
    op.box(-3.85, H, 0, 0.3, 0.5, 7.7, c.roof);
    door(op, c.door, 2.4);
    win(gl, rec, -2.0, 2.2, 3.66, 2.2, 2.6, 0, 1);
    win(gl, rec, 2.0, 2.2, 3.66, 2.2, 2.6, 0, 1);
    win(gl, rec, -2.0, 4.4, 3.66, 2.2, 1.4, 0, 1);
    win(gl, rec, 2.0, 4.4, 3.66, 2.2, 1.4, 0, 1);
    win(gl, rec, 3.66, 2.2, 0, 2.6, 2.6, 1, 0);
    win(gl, rec, -3.66, 2.2, 0, 2.6, 2.6, -1, 0);
    // wood slat accent on the front facade
    for (let i = 0; i < 3; i++) op.box(2.4 + i * 0.5, 0.2, 3.7, 0.12, 5.4, 0.1, PALETTE.trunk);
    porch(op, c, 3.0, 3.0, false);
    return { roofTop: H + 0.9, garage: false };
  },
  bungalow(op, gl, rec, c, rng) {
    const H = 3.6;
    walls(op, c, H);
    roof(op, H, c.roof, [8.4, 5.6], 0.5);
    op.box(0, H + 1.0, 0, 2.4, 0.5, 7.0, c.roof, { skipFaces: ['bottom'] }); // ridge
    // dormer on the front slope
    op.box(1.4, H + 0.2, 2.6, 1.6, 1.4, 1.2, c.wall, { skipFaces: ['bottom'] });
    op.box(1.4, H + 1.4, 2.6, 2.0, 0.3, 1.6, c.roof);
    win(gl, rec, 1.4, H + 0.8, 3.15, 1.0, 0.8, 0, 1);
    door(op, c.door, 2.0);
    win(gl, rec, -1.8, 1.6, 3.66, 1.4, 1.4, 0, 1);
    win(gl, rec, 1.0, 1.6, 3.66, 1.4, 1.4, 0, 1);
    for (const s of [-1, 1]) win(gl, rec, 3.66 * s, 1.6, -0.5, 1.4, 1.4, s, 0);
    // wide front porch with two posts + railing
    op.box(0, 2.8, 5.0, 5.0, 0.2, 2.6, c.roof, { skipFaces: ['bottom'] });
    for (const s of [-1, 1]) op.box(2.2 * s, 0.12, 6.0, 0.18, 2.6, 0.18, PALETTE.trim, { skipFaces: ['bottom'] });
    op.box(0, 0.5, 6.1, 4.6, 0.1, 0.1, PALETTE.trim);
    return { roofTop: H + 1.5, garage: false };
  },
};

function walls(op, c, H) {
  op.box(0, 0, 3.4, 7.2, H, 0.4, c.wall, { skipFaces: ['bottom'] });
  op.box(0, 0, -3.4, 7.2, H, 0.4, c.wall, { skipFaces: ['bottom'] });
  op.box(-3.4, 0, 0, 0.4, H, 6.4, c.wall, { skipFaces: ['bottom'] });
  op.box(3.4, 0, 0, 0.4, H, 6.4, c.wall, { skipFaces: ['bottom'] });
}

function roof(op, baseY, roofCol, steps, stepH) {
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    op.box(0, baseY + i * stepH, 0, s, stepH, s, roofCol, { skipFaces: ['bottom'] });
  }
}

function door(op, doorCol, h) {
  op.box(0, 0, 3.66, 1.0, h, 0.12, doorCol, { skipFaces: ['bottom'] });
}

function sideWin(gl, rec, c, H) {
  for (const s of [-1, 1]) win(gl, rec, 3.66 * s, 1.5, 0, 1.2, 1.2, s, 0);
}

function porch(op, c, w, roofH, wide) {
  op.box(0, roofH, 4.8, w, 0.18, 1.8, c.roof, { skipFaces: ['bottom'] });
  for (const s of [-1, 1]) op.box((w / 2 - 0.2) * s, 0.12, 5.4, 0.15, roofH - 0.1, 0.15, PALETTE.trim, { skipFaces: ['bottom'] });
  // doormat (M5 target visual) on the deck
  op.box(0, 0.12, 4.4, 1.4, 0.06, 0.9, PALETTE.brand, { skipFaces: ['bottom', 'top'] });
}

// Mailbox (post + box) at the porch edge + porch lamp post (opaque) and lamp
// head (glow). The mailbox number quad is pushed onto the sign mesh by the
// caller, in world space.
function mailbox(op, gl) {
  const x = 3.0, z = 7.4;
  op.box(x, 0.12, z, 0.12, 0.8, 0.12, '#4a4e69', { skipFaces: ['bottom'] });
  op.box(x, 0.92, z, 0.55, 0.4, 0.45, '#f8f4ea', { skipFaces: ['bottom'] });
  op.box(-1.6, 0.12, 5.2, 0.1, 1.1, 0.1, '#4a4e69', { skipFaces: ['bottom'] }); // lamp post
  gl.box(-1.6, 1.22, 5.2, 0.26, 0.24, 0.26, '#8a8f9e', PALETTE.windowNight); // lamp head
}

const _v = new THREE.Vector3();

// lampPools (optional): gets [wx, wz] of every porch lamp, for the light pools.
export function buildHouses(grid, tm, glowAll, signQuads, colliders, windowRects, lampPools) {
  const names = Object.keys(STYLES);
  for (const h of tm.def.houses) {
    const rng = mulberry32(idSeed(h.id));
    const style = STYLES[names[(rng() * names.length) | 0]];
    const c = {
      wall: PALETTE.wall[(rng() * PALETTE.wall.length) | 0],
      roof: PALETTE.roof[(rng() * PALETTE.roof.length) | 0],
      door: PALETTE.door[(rng() * PALETTE.door.length) | 0],
    };
    const side = drivewaySide(tm, h);
    const op = new VoxelBuilder(idSeed(h.id) & 0xffff);
    const gl = new GlowBuilder();
    const rec = [];
    const info = style(op, gl, rec, c, rng, side, h.facing);
    mailbox(op, gl);

    // World transform: rotate by facing, translate to footprint center.
    const ox = tm.minX(h.x) + 4, oz = tm.minZ(h.z) + 4;
    const m = new THREE.Matrix4().makeRotationY(THETA[h.facing]);
    m.setPosition(ox, 0, oz);
    const ch = grid.chunkAt(h.x, h.z);
    ch.opaque.merge(op, m);
    glowAll.merge(gl, m);

    // Record window rects in world space (center, size, world facing).
    windowRects[h.id] = [];
    for (const r of rec) {
      _v.set(r.x, r.y, r.z).applyMatrix4(m);
      windowRects[h.id].push({ x: _v.x, y: _v.y, z: _v.z, w: r.w, h: r.h, face: faceLetter(m, r.nx, r.nz) });
    }

    // Mailbox number quad (atlas) on the mailbox front, facing the street.
    const q = _v.set(3.0, 0.97, 7.64).applyMatrix4(m);
    signQuads.push({ rectKey: 'num:' + h.num, x: q.x, y: q.y, z: q.z, w: 0.34, h: 0.3, face: FACES[h.facing] });
    // Porch lamp light pool position (deck at 0.12).
    if (lampPools) {
      const lp = _v.set(-1.6, 0, 5.2).applyMatrix4(m);
      lampPools.push([lp.x, lp.z]);
    }

    // Colliders: footprint box + garage.
    colliders.push({ type: 'box', minX: tm.minX(h.x), maxX: tm.minX(h.x) + 8, minZ: tm.minZ(h.z), maxZ: tm.minZ(h.z) + 8, h: info.roofTop });
    if (info.garage) {
      const a = _v.set(3.8 * info.garage, 0, -1.6).applyMatrix4(m);
      const b = _v.set(7.0 * info.garage, 0, 1.6).applyMatrix4(m);
      colliders.push({
        type: 'box',
        minX: Math.min(a.x, b.x), maxX: Math.max(a.x, b.x),
        minZ: Math.min(a.z, b.z), maxZ: Math.max(a.z, b.z),
        h: 2.9,
      });
    }
  }
}

// World-facing letter of a local (nx,nz) normal under the house matrix.
function faceLetter(m, nx, nz) {
  _v.set(nx, 0, nz).applyMatrix4(m);
  const ax = Math.round(_v.x), az = Math.round(_v.z);
  if (ax > 0) return 'E';
  if (ax < 0) return 'W';
  if (az > 0) return 'S';
  return 'N';
}
