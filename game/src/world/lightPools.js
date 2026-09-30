import * as THREE from 'three';

// §7.3/§7.8: one small radial-gradient canvas texture is shared by the lamp
// light pools (additive, warm) and M4's blob shadows (dark, normal blend).
// Pools are one merged quad mesh (1 draw call), shown only when the time of
// day has glow.
export function createPoolTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

export function createLampPools(positions, texture) {
  const pos = [];
  const idx = [];
  for (const p of positions) {
    const s = 1.3, base = pos.length / 3;
    const y = p[2] + 0.03; // just above the raised curb/deck
    pos.push(p[0] - s, y, p[1] - s, p[0] + s, y, p[1] - s, p[0] + s, y, p[1] + s, p[0] - s, y, p[1] + s);
    idx.push(base, base + 2, base + 1, base, base + 1, base + 3); // +Y facing
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  const mat = new THREE.MeshBasicMaterial({
    map: texture,
    color: '#ffe8a3',
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'lampPools';
  mesh.renderOrder = 1;
  return { mesh, texture };
}
