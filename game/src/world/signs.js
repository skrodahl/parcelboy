import * as THREE from 'three';

// §7.8: one 1024x1024 canvas texture atlas holds the street-name signs (and
// later shop/depot signs, mailbox numbers, the Quickbox logo). Sign meshes use
// UV sub-rectangles of this atlas, so all signs share ONE texture + ONE
// material (merged into a single draw call). This M2 pass starts it with the
// street name signs at each road's north/west end.

const ATLAS = 1024;
const COLS = 2; // wide slots so street names fit the plate

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Build the atlas canvas + texture. Each street name is drawn on a dark plate
// (rounded rect) with an auto-fitted font; rectFor(name) returns the plate's
// UV sub-rect so a sign quad shows just the plate, not the empty slot.
export function buildSignAtlas(names) {
  const rows = Math.ceil(names.length / COLS);
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS;
  canvas.height = ATLAS;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fffaf0';
  ctx.fillRect(0, 0, ATLAS, ATLAS);

  const slotW = ATLAS / COLS;
  const slotH = ATLAS / rows;
  const PX0 = 0.04, PX1 = 0.96, PY0 = 0.28, PY1 = 0.72; // plate as slot fractions
  const rects = {};
  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    const x = (i % COLS) * slotW;
    const y = ((i / COLS) | 0) * slotH;
    const px0 = x + slotW * PX0, px1 = x + slotW * PX1;
    const py0 = y + slotH * PY0, py1 = y + slotH * PY1;
    ctx.fillStyle = '#3d4152';
    roundRect(ctx, px0, py0, px1 - px0, py1 - py0, 12);
    ctx.fill();
    // Auto-fit the font so the name fits the plate width.
    let fs = Math.floor((py1 - py0) * 0.72);
    ctx.font = 'bold ' + fs + 'px system-ui, sans-serif';
    const tw = ctx.measureText(name).width;
    const maxW = (px1 - px0) * 0.86;
    if (tw > maxW) fs = Math.max(10, Math.floor(fs * maxW / tw));
    ctx.font = 'bold ' + fs + 'px system-ui, sans-serif';
    ctx.fillStyle = '#fffaf0';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, (px0 + px1) / 2, (py0 + py1) / 2);
    // flipY: canvas top -> v=1. Plate spans canvas [py0 (top), py1 (bottom)].
    rects[name] = { u: px0 / ATLAS, v: 1 - py1 / ATLAS, w: (px1 - px0) / ATLAS, h: (py1 - py0) / ATLAS };
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  return { texture, rectFor: (n) => rects[n] };
}

// One merged mesh of vertical street-name sign quads. The posts are merged into
// the chunk opaque builders (vertex colors); the sign faces use the atlas.
export function buildStreetSigns(tm, grid) {
  const roads = tm.def.roads;
  const atlas = buildSignAtlas(roads.map((r) => r.name));
  const pos = [];
  const nor = [];
  const uv = [];
  const idx = [];
  const H = 2.2; // post height to sign center
  for (let i = 0; i < roads.length; i++) {
    const r = roads[i];
    const rect = atlas.rectFor(r.name);
    // Sign at the road's start corner, offset onto the sidewalk.
    let wx, wz, face;
    if (r.axis === 'x') { wx = tm.minX(r.x0) - 2; wz = tm.cz(r.z); face = [0, 0, 1]; }
    else { wx = tm.cx(r.x); wz = tm.minZ(r.z0) - 2; face = [1, 0, 0]; }
    // Post into the owning chunk (tile coord of the post's world position).
    const ch = grid.chunkAt(Math.floor(wx / tm.tileSize), Math.floor(wz / tm.tileSize));
    ch.opaque.box(wx, 0, wz, 0.12, H, 0.12, '#4a4e69', { skipFaces: ['bottom'] });
    const s = 2.4, half = s / 2;
    const base = pos.length / 3;
    // quad corners (vertical, centered at wx,H,wz)
    pos.push(wx - half, H - half, wz, wx + half, H - half, wz, wx + half, H + half, wz, wx - half, H + half, wz);
    for (let k = 0; k < 4; k++) nor.push(face[0], face[1], face[2]);
    // v0 bottom-left, v1 bottom-right, v2 top-right, v3 top-left
    uv.push(rect.u, rect.v, rect.u + rect.w, rect.v, rect.u + rect.w, rect.v + rect.h, rect.u, rect.v + rect.h);
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  const mat = new THREE.MeshBasicMaterial({ map: atlas.texture, side: THREE.DoubleSide, transparent: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'streetSigns';
  return { mesh, atlas, material: mat };
}
