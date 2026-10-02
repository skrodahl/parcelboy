import * as THREE from 'three';
import { mulberry32 } from '../core/rng.js';

// Face definitions: outward normal + 4 corners (unit box coords: x/z in
// [-0.5, 0.5], y in [0, 1]), ordered CCW as seen from outside.
const FACES = [
  { key: 'top',    n: [0, 1, 0], c: [[-0.5, 1, -0.5], [-0.5, 1, 0.5], [0.5, 1, 0.5], [0.5, 1, -0.5]] },
  { key: 'bottom', n: [0, -1, 0], c: [[-0.5, 0, -0.5], [0.5, 0, -0.5], [0.5, 0, 0.5], [-0.5, 0, 0.5]] },
  { key: 'right',  n: [1, 0, 0], c: [[0.5, 0, 0.5], [0.5, 0, -0.5], [0.5, 1, -0.5], [0.5, 1, 0.5]] },
  { key: 'left',   n: [-1, 0, 0], c: [[-0.5, 0, -0.5], [-0.5, 0, 0.5], [-0.5, 1, 0.5], [-0.5, 1, -0.5]] },
  { key: 'front',  n: [0, 0, 1], c: [[-0.5, 0, 0.5], [0.5, 0, 0.5], [0.5, 1, 0.5], [-0.5, 1, 0.5]] },
  { key: 'back',   n: [0, 0, -1], c: [[0.5, 0, -0.5], [-0.5, 0, -0.5], [-0.5, 1, -0.5], [0.5, 1, -0.5]] },
];

// Accumulates boxes into one indexed BufferGeometry (position, normal,
// color). Fake AO and per-box brightness jitter are baked into vertex
// colors (§7.3): vertices at y <= 0.3 are darkened 12%, down-facing faces
// 25%, and every box gets a stable +/-4% brightness jitter.
export class VoxelBuilder {
  constructor(seed = 1) {
    this._positions = [];
    this._normals = [];
    this._colors = [];
    this._indices = [];
    this._rng = mulberry32(seed);
    this._color = new THREE.Color();
    this._v = new THREE.Vector3();
    this._n = new THREE.Vector3();
    this._m3 = new THREE.Matrix3();
    this.yOff = 0; // §2.19: a per-builder Y lift so a whole structure sits at its tile's terrain level
  }

  // x/z = center, y = bottom. color: hex string, THREE.Color or [r,g,b] 0-1.
  // opts.skipFaces: array of 'top' | 'bottom' | 'left' | 'right' | 'front' | 'back'.
  box(x, y, z, w, h, d, color, opts) {
    this._color.set(color);
    const jitter = 1 + (this._rng() * 2 - 1) * 0.04;
    const skip = opts && opts.skipFaces;
    for (let f = 0; f < FACES.length; f++) {
      const face = FACES[f];
      if (skip && skip.indexOf(face.key) >= 0) continue;
      let r = this._color.r * jitter;
      let g = this._color.g * jitter;
      let b = this._color.b * jitter;
      if (face.n[1] === -1) { r *= 0.75; g *= 0.75; b *= 0.75; }
      const base = this._positions.length / 3;
      const y0 = y + this.yOff;
      for (let c = 0; c < 4; c++) {
        const corner = face.c[c];
        const py = y0 + corner[1] * h;
        let cr = r, cg = g, cb = b;
        if (py <= 0.3) { cr *= 0.88; cg *= 0.88; cb *= 0.88; }
        this._positions.push(x + corner[0] * w, py, z + corner[2] * d);
        this._normals.push(face.n[0], face.n[1], face.n[2]);
        this._colors.push(cr, cg, cb);
      }
      this._indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }

  // Concatenates another builder's attributes and offsets its indices.
  // matrix (optional THREE.Matrix4) transforms the other builder's output.
  merge(other, matrix) {
    const g = other.toGeometry();
    const pos = g.attributes.position.array;
    const nrm = g.attributes.normal.array;
    const col = g.attributes.color.array;
    const idx = g.index.array;
    const off = this._positions.length / 3;
    if (matrix) {
      this._m3.getNormalMatrix(matrix);
      for (let i = 0; i < pos.length; i += 3) {
        this._v.set(pos[i], pos[i + 1], pos[i + 2]).applyMatrix4(matrix);
        this._positions.push(this._v.x, this._v.y, this._v.z);
        this._n.set(nrm[i], nrm[i + 1], nrm[i + 2]).applyMatrix3(this._m3).normalize();
        this._normals.push(this._n.x, this._n.y, this._n.z);
        this._colors.push(col[i], col[i + 1], col[i + 2]);
      }
    } else {
      for (let i = 0; i < pos.length; i++) this._positions.push(pos[i]);
      for (let i = 0; i < nrm.length; i++) this._normals.push(nrm[i]);
      for (let i = 0; i < col.length; i++) this._colors.push(col[i]);
    }
    for (let i = 0; i < idx.length; i++) this._indices.push(idx[i] + off);
    return this;
  }

  toGeometry() {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this._positions), 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(this._normals), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(this._colors), 3));
    geo.setIndex(this._indices);
    return geo;
  }
}
