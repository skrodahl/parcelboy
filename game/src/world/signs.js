import * as THREE from 'three';

// §7.8: ONE 1024x1024 canvas texture atlas holds every sign: street name signs,
// shop signs, the Quickbox logo + depot sign, and mailbox numbers. All sign
// meshes use UV sub-rectangles of the atlas and are merged into a single mesh
// + one MeshBasicMaterial (1 draw call, 1 texture).

const ATLAS = 1024;
const C = { plate: '#3d4152', ink: '#fffaf0', brand: '#00b4a6', logo: '#00b4a6' };

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Build the atlas. `plates` = [{ text, bg?, fg? }] wide sign plates;
// `numbers` = [1..n] small mailbox plates; plus one logo tile.
// Layout (1024px, 256px slots): rows 0-2 hold up to 12 plates (4 per row);
// row 3: a 4x4 grid of 64px number tiles in the left slot, the logo in the
// right slot. Nothing is drawn twice, so no rect overlaps another.
export function buildSignAtlas({ plates, numbers }) {
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS;
  canvas.height = ATLAS;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fffaf0';
  ctx.fillRect(0, 0, ATLAS, ATLAS);
  const rects = {};

  const plate = (text, x, y, w, h, bg, fg) => {
    roundRect(ctx, x + 8, y + h * 0.18, w - 16, h * 0.64, 12);
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.fillStyle = fg;
    let fs = Math.floor(h * 0.4);
    ctx.font = 'bold ' + fs + 'px system-ui, sans-serif';
    const tw = ctx.measureText(text).width;
    const maxW = (w - 16) * 0.9;
    if (tw > maxW) fs = Math.max(8, Math.floor(fs * maxW / tw));
    ctx.font = 'bold ' + fs + 'px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + w / 2, y + h / 2);
  };

  // Plates: up to 12, 4 per row in the top 3 rows (256px slots).
  for (let i = 0; i < plates.length; i++) {
    const p = plates[i];
    const row = (i / 4) | 0;
    const col = i % 4;
    const x = col * 256, y = row * 256;
    plate(p.text, x, y, 256, 256, p.bg || C.plate, p.fg || C.ink);
    rects['plate:' + i] = { u: x / ATLAS, v: 1 - (y + 256) / ATLAS, w: 256 / ATLAS, h: 256 / ATLAS };
  }

  // Number tiles: 4x4 grid of 64px tiles in the bottom-left slot (row 3).
  for (let n = 0; n < numbers.length; n++) {
    const col = n % 4, row = (n / 4) | 0;
    const x = col * 64, y = 768 + row * 64;
    roundRect(ctx, x + 6, y + 6, 52, 52, 8);
    ctx.fillStyle = '#f8f4ea';
    ctx.fill();
    ctx.fillStyle = '#2f333d';
    ctx.font = 'bold 34px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(numbers[n]), x + 32, y + 33);
    rects['num:' + numbers[n]] = { u: x / ATLAS, v: 1 - (y + 64) / ATLAS, w: 64 / ATLAS, h: 64 / ATLAS };
  }

  // Logo tile: bottom-right slot (row 3, col 3) -> teal rounded box, white Q + arrow.
  {
    const x = 3 * 256, y = 3 * 256;
    roundRect(ctx, x + 24, y + 64, 208, 128, 24);
    ctx.fillStyle = C.logo;
    ctx.fill();
    ctx.fillStyle = '#fffaf0';
    ctx.font = 'bold 96px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Q', x + 110, y + 132);
    ctx.beginPath();
    ctx.moveTo(x + 170, y + 132);
    ctx.lineTo(x + 210, y + 132);
    ctx.lineTo(x + 196, y + 114);
    ctx.lineTo(x + 210, y + 150);
    ctx.closePath();
    ctx.fill();
    rects['logo'] = { u: x / ATLAS, v: 1 - (y + 256) / ATLAS, w: 256 / ATLAS, h: 256 / ATLAS };
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  return { texture, rectFor: (k) => rects[k] };
}

// Street signs: one post (merged into the owning chunk) + sign quad at each
// road's start corner, facing the default cams.
export function addStreetSigns(grid, tm, signQuads) {
  const H = 2.2;
  tm.def.roads.forEach((r, i) => {
    let wx, wz;
    if (r.axis === 'x') { wx = tm.minX(r.x0) - 2; wz = tm.cz(r.z); }
    else { wx = tm.cx(r.x); wz = tm.minZ(r.z0) - 2; }
    const ch = grid.chunkAt(Math.floor(wx / tm.tileSize), Math.floor(wz / tm.tileSize));
    ch.opaque.box(wx, 0, wz, 0.12, H, 0.12, '#4a4e69', { skipFaces: ['bottom'] });
    signQuads.push({
      rectKey: 'plate:' + i,
      x: wx, y: H - 1.2, z: wz, w: 2.4, h: 2.4,
      face: r.axis === 'x' ? [0, 0, 1] : [1, 0, 0],
    });
  });
}

// One merged mesh of all sign quads (street signs, shop signs, depot sign,
// mailbox numbers, van logos). `quads` = [{ rectKey, x, y, z, w, h, face }];
// `atlasSpec` = { plates: [{ text, bg?, fg? }], numbers: [n] }. Plate rect keys
// are 'plate:<i>' (in spec order), numbers 'num:<n>', plus 'logo'.
export function buildSignMesh(quads, atlasSpec) {
  const atlas = buildSignAtlas(atlasSpec);
  const pos = [];
  const nor = [];
  const uv = [];
  const idx = [];
  for (let i = 0; i < quads.length; i++) {
    const q = quads[i];
    const rect = atlas.rectFor(q.rectKey);
    if (!rect) continue;
    const f = q.face; // [nx,ny,nz]
    // Quad in the plane defined by `f`; h vertical (y), w along the tangent.
    // Signs are all vertical, so vert = up; cross(f, up) gives a horizontal
    // tangent. (Using vert=[0,0,1] would make ±Z faces degenerate.)
    const vert = [0, 1, 0];
    const tan = cross(f, vert);
    const cx = q.x, cz = q.z, cy = q.y + q.h / 2;
    const base = pos.length / 3;
    const corners = [
      [-tan[0] * q.w / 2, -q.h / 2, -tan[2] * q.w / 2],
      [tan[0] * q.w / 2, -q.h / 2, tan[2] * q.w / 2],
      [tan[0] * q.w / 2, q.h / 2, tan[2] * q.w / 2],
      [-tan[0] * q.w / 2, q.h / 2, -tan[2] * q.w / 2],
    ];
    for (let k = 0; k < 4; k++) pos.push(cx + corners[k][0], cy + corners[k][1], cz + corners[k][2]);
    for (let k = 0; k < 4; k++) nor.push(f[0], f[1], f[2]);
    // Corners 0/3 sit on the -tan side (screen right for our cam-facing
    // faces) and 1/2 on the +tan side, so the texture's left edge (u) goes on
    // corners 1/2. Getting this backwards mirrors the text.
    uv.push(rect.u + rect.w, rect.v, rect.u, rect.v, rect.u, rect.v + rect.h, rect.u + rect.w, rect.v + rect.h);
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  const mat = new THREE.MeshBasicMaterial({ map: atlas.texture, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'signs';
  return { mesh, atlas, material: mat };
}

function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
