import * as THREE from 'three';

// §7.3: dynamic actors get blob shadows — a pooled dark soft circular quad
// with the alpha gradient from the shared tiny canvas texture (§7.8: one
// texture for pools + blobs). One InstancedMesh = 1 draw call.
export function createBlobShadows(count, texture, material) {
  const pos = [];
  const idx = [];
  const S = 0.9; // half-size of one blob quad
  for (let i = 0; i < count; i++) {
    const base = i * 4;
    pos.push(-S, 0, -S, S, 0, -S, S, 0, S, -S, 0, S);
    idx.push(base, base + 2, base + 1, base, base + 1, base + 3); // +Y facing
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  const mat = material || new THREE.MeshBasicMaterial({
    map: texture,
    color: '#141625',
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.name = 'blobShadows';
  mesh.renderOrder = 0;
  mesh.frustumCulled = false; // instances span the map
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    mesh.setMatrixAt(i, m4.compose(p.set(0, -10, 0), q, s.set(0.001, 0.001, 0.001)));
  }
  mesh.instanceMatrix.needsUpdate = true;
  let dirty = false;
  return {
    mesh,
    // Allocation-free: writes into the module-scope matrix.
    set(i, x, z, scale) {
      p.set(x, 0.15, z);
      s.set(scale, scale, scale);
      m4.compose(p, q, s);
      mesh.setMatrixAt(i, m4);
      dirty = true;
    },
    hide(i) {
      p.set(0, -10, 0);
      s.set(0.001, 0.001, 0.001);
      m4.compose(p, q, s);
      mesh.setMatrixAt(i, m4);
      dirty = true;
    },
    flush() {
      if (dirty) { mesh.instanceMatrix.needsUpdate = true; dirty = false; }
    },
  };
}
