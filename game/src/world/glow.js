import * as THREE from 'three';

// §7.3: all "glow" geometry (windows, lamp heads, lit signs) shares ONE
// MeshBasicMaterial({ vertexColors: true }). Each box records a DAY color and a
// NIGHT color; the active time-of-day blend writes the lerped color into the
// geometry's color attribute (a rare event on time-of-day change, never per
// frame, no allocations). material.color stays white; the hue shift (windowDay
// blue -> windowNight warm) comes from the per-vertex blend.
export class GlowBuilder {
  constructor() {
    this._day = [];
    this._night = [];
    this._pos = [];
    this._nor = [];
    this._idx = [];
    this._v = new THREE.Vector3();
    this._n = new THREE.Vector3();
    this._m3 = new THREE.Matrix3();
    // Unit box, 6 faces, CCW outward (same corner layout as VoxelBuilder).
    this._FACES = [
      { n: [0, 1, 0], c: [[-0.5, 1, -0.5], [-0.5, 1, 0.5], [0.5, 1, 0.5], [0.5, 1, -0.5]] },
      { n: [0, -1, 0], c: [[-0.5, 0, -0.5], [0.5, 0, -0.5], [0.5, 0, 0.5], [-0.5, 0, 0.5]] },
      { n: [1, 0, 0], c: [[0.5, 0, 0.5], [0.5, 0, -0.5], [0.5, 1, -0.5], [0.5, 1, 0.5]] },
      { n: [-1, 0, 0], c: [[-0.5, 0, -0.5], [-0.5, 0, 0.5], [-0.5, 1, 0.5], [-0.5, 1, -0.5]] },
      { n: [0, 0, 1], c: [[-0.5, 0, 0.5], [0.5, 0, 0.5], [0.5, 1, 0.5], [-0.5, 1, 0.5]] },
      { n: [0, 0, -1], c: [[0.5, 0, -0.5], [-0.5, 0, -0.5], [-0.5, 1, -0.5], [0.5, 1, -0.5]] },
    ];
    this._dc = new THREE.Color();
    this._nc = new THREE.Color();
  }

  // x/z center, y bottom. day/night = hex, Color or [r,g,b]. opts.skipFaces as VoxelBuilder.
  box(x, y, z, w, h, d, day, night, opts) {
    this._dc.set(day);
    this._nc.set(night);
    const skip = opts && opts.skipFaces;
    for (let f = 0; f < 6; f++) {
      const face = this._FACES[f];
      if (skip && skip.indexOf(this._faceKey(f)) >= 0) continue;
      const base = this._pos.length / 3;
      for (let i = 0; i < 4; i++) {
        const c = face.c[i];
        this._pos.push(x + c[0] * w, y + c[1] * h, z + c[2] * d);
        this._nor.push(face.n[0], face.n[1], face.n[2]);
        this._day.push(this._dc.r, this._dc.g, this._dc.b);
        this._night.push(this._nc.r, this._nc.g, this._nc.b);
      }
      this._idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }

  _faceKey(f) {
    return ['top', 'bottom', 'right', 'left', 'front', 'back'][f];
  }

  // Concatenate another GlowBuilder's boxes, optionally transformed by a
  // THREE.Matrix4 (same semantics as VoxelBuilder.merge).
  merge(other, matrix) {
    const off = this._pos.length / 3;
    if (matrix) {
      this._m3.getNormalMatrix(matrix);
      for (let i = 0; i < other._pos.length; i += 3) {
        this._v.set(other._pos[i], other._pos[i + 1], other._pos[i + 2]).applyMatrix4(matrix);
        this._pos.push(this._v.x, this._v.y, this._v.z);
        this._n.set(other._nor[i], other._nor[i + 1], other._nor[i + 2]).applyMatrix3(this._m3).normalize();
        this._nor.push(this._n.x, this._n.y, this._n.z);
      }
    } else {
      for (let i = 0; i < other._pos.length; i++) this._pos.push(other._pos[i]);
      for (let i = 0; i < other._nor.length; i++) this._nor.push(other._nor[i]);
    }
    for (let i = 0; i < other._day.length; i++) this._day.push(other._day[i]);
    for (let i = 0; i < other._night.length; i++) this._night.push(other._night[i]);
    for (let i = 0; i < other._idx.length; i++) this._idx.push(other._idx[i] + off);
    return this;
  }

  toGeometry() {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this._pos), 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(this._nor), 3));
    const dayArr = this._day;
    const nightArr = this._night;
    const color = new Float32Array(dayArr.length);
    geo.setAttribute('color', new THREE.BufferAttribute(color, 3));
    geo.setIndex(this._idx);
    // Blend helper (called on time-of-day change, not per frame).
    geo.__setGlowBlend = (g) => {
      const a = geo.attributes.color.array;
      for (let i = 0; i < a.length; i++) a[i] = dayArr[i] + (nightArr[i] - dayArr[i]) * g;
      geo.attributes.color.needsUpdate = true;
      return a;
    };
    geo.__setGlowBlend(0);
    return geo;
  }
}

export function createGlowMaterial() {
  return new THREE.MeshBasicMaterial({ vertexColors: true });
}
