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

// M15a.10: atlas slots are keyed (not index-based) and sized to the same aspect
// ratio as the sign quad that maps onto them, so text is never squished and the
// plate fills its whole slot (no cream margin bands). Slots are packed in rows
// by height (a shelf packer): wide short strips (shop/school/depot) share rows
// with each other, square street signs + the logo fill 4-up rows, 64px number
// tiles pack 4-wide. `slots` = [{ key, text, bg, fg, w, h }] (w/h in px, aspect
// w/h == the quad's aspect); `numbers` = [n] mailbox tiles; a 'logo' slot is
// added automatically. `rectFor(key)` returns that slot's UV rect.
export function buildSignAtlas({ slots, numbers }) {
  const all = slots.map((s) => ({ ...s }));
  all.push({ key: 'logo', w: 256, h: 256, kind: 'logo' });
  for (const n of numbers) all.push({ key: 'num:' + n, w: 64, h: 64, kind: 'number', value: n });
  // Shelf pack: taller slots first (they set the row height), wide before narrow.
  all.sort((a, b) => b.h - a.h || b.w - a.w);
  let x = 0, y = 0, rowH = 0;
  for (const s of all) {
    if (s.w > ATLAS) s.w = ATLAS;
    if (x + s.w > ATLAS) { x = 0; y += rowH; rowH = 0; }
    s.x = x; s.y = y;
    if (s.h > rowH) rowH = s.h;
    x += s.w;
    if (y + s.h > ATLAS) console.warn('sign atlas overflow at', s.key, y + s.h);
  }

  const canvas = document.createElement('canvas');
  canvas.width = ATLAS;
  canvas.height = ATLAS;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fffaf0';
  ctx.fillRect(0, 0, ATLAS, ATLAS);
  const rects = {};
  for (const s of all) {
    if (s.kind === 'number') drawNumber(ctx, s);
    else if (s.kind === 'logo') drawLogo(ctx, s);
    else drawPlate(ctx, s);
    rects[s.key] = { u: s.x / ATLAS, v: 1 - (s.y + s.h) / ATLAS, w: s.w / ATLAS, h: s.h / ATLAS };
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.anisotropy = 4; // sign quads are often viewed at grazing angles
  return { texture, rectFor: (k) => rects[k] };
}

// A plate fills its whole slot: solid bg + centered text sized to ~60% of the
// slot height (shrunk only if it overflows the width). No cream margin.
function drawPlate(ctx, s) {
  ctx.fillStyle = s.bg || C.plate;
  roundRect(ctx, s.x, s.y, s.w, s.h, Math.min(14, s.h * 0.35));
  ctx.fill();
  ctx.fillStyle = s.fg || C.ink;
  let fs = Math.floor(s.h * 0.6);
  ctx.font = 'bold ' + fs + 'px system-ui, sans-serif';
  const tw = ctx.measureText(s.text).width;
  const maxW = s.w * 0.88;
  if (tw > maxW) fs = Math.max(8, Math.floor((fs * maxW) / tw));
  ctx.font = 'bold ' + fs + 'px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(s.text, s.x + s.w / 2, s.y + s.h / 2);
}

function drawNumber(ctx, s) {
  roundRect(ctx, s.x + 4, s.y + 4, s.w - 8, s.h - 8, 8);
  ctx.fillStyle = '#f8f4ea';
  ctx.fill();
  ctx.fillStyle = '#2f333d';
  ctx.font = 'bold 34px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(s.value), s.x + s.w / 2, s.y + s.h / 2 + 1);
}

function drawLogo(ctx, s) {
  roundRect(ctx, s.x + 24, s.y + 64, s.w - 48, s.h - 128, 24);
  ctx.fillStyle = C.logo;
  ctx.fill();
  ctx.fillStyle = '#fffaf0';
  ctx.font = 'bold 96px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Q', s.x + 110, s.y + 132);
  ctx.beginPath();
  ctx.moveTo(s.x + 170, s.y + 132);
  ctx.lineTo(s.x + 210, s.y + 132);
  ctx.lineTo(s.x + 196, s.y + 114);
  ctx.lineTo(s.x + 210, s.y + 150);
  ctx.closePath();
  ctx.fill();
}

// Street signs: one post (merged into the owning chunk) + sign quad at each
// road's start corner, facing the default cams.
export function addStreetSigns(grid, tm, signQuads) {
  const H = 2.2;
  const T = tm.tileSize;
  // M15a.4: the post must stand on a *sidewalk* tile (a road tile counts as
  // walkable, so the old "first walkable row" rule dropped N/S signs into the
  // cross-road). Nearest sidewalk tile (BFS by squared distance) to a seed.
  function nearestSidewalk(sx, sz, range) {
    let bx = -1, bz = -1, bd = Infinity;
    for (let dz = -range; dz <= range; dz++) for (let dx = -range; dx <= range; dx++) {
      const x = sx + dx, z = sz + dz;
      if (tm.keyAt(x, z) !== 'sidewalk') continue;
      const d = dx * dx + dz * dz;
      if (d < bd) { bd = d; bx = x; bz = z; }
    }
    return bd < Infinity ? { x: bx, z: bz } : null;
  }
  tm.def.roads.forEach((r) => {
    let wx, wz;
    if (r.axis === 'x') {
      // E/W road: stand the sign on a sidewalk at the west end (the NW corner),
      // nudged toward the road corner — never in the road.
      const s = nearestSidewalk(r.x0 - 1, r.z - 1, 4);
      if (s) { wx = tm.cx(s.x) + 0.5; wz = tm.cz(s.z) - 0.5; }
      else { wx = tm.minX(r.x0) - 0.7; wz = tm.minZ(r.z) - 0.7; }
    } else {
      // N/S road: stand the sign on a sidewalk on the west curb.
      const s = nearestSidewalk(r.x - 1, r.z0, 4);
      if (s) { wx = tm.cx(s.x) + 0.5; wz = tm.cz(s.z); }
      else { wx = tm.minX(r.x) - 0.7; wz = tm.cz(r.z0); }
    }
    const ch = grid.chunkAt(Math.floor(wx / T), Math.floor(wz / T));
    const out = r.axis === 'x' ? [0, 0, 1] : [1, 0, 0]; // which way the sign "faces"
    ch.opaque.box(wx, 0, wz, 0.12, H, 0.12, '#4a4e69', { skipFaces: ['bottom'] });
    // M15a.6: the sign is a thin plate, readable from BOTH sides. A quad built
    // with face P has its textured (CCW) side pointing at -P, so each side gets
    // its own outward quad: face=-out on the +out side, face=+out on the -out
    // side. Opposite faces flip the tangent, so both read left-to-right — no
    // separate UV flip needed. A thin solid plate box fills the gap.
    const sy = H - 1.2;
    const alongX = out[0] !== 0; // the plate's thin axis runs along out
    ch.opaque.box(wx, sy, wz, alongX ? 0.1 : 2.4, 2.4, alongX ? 2.4 : 0.1, C.plate, { skipFaces: ['bottom'] });
    const o = 0.07; // each quad floats just off the plate face
    const sk = 'street:' + r.name; // M15a.10: key by road name, not index
    signQuads.push({ rectKey: sk, x: wx + out[0] * o, y: sy, z: wz + out[2] * o, w: 2.4, h: 2.4, face: [-out[0], -out[1], -out[2]], flip: true });
    signQuads.push({ rectKey: sk, x: wx - out[0] * o, y: sy, z: wz - out[2] * o, w: 2.4, h: 2.4, face: [out[0], out[1], out[2]], flip: true });
  });
}

// One merged mesh of all sign quads (street signs, shop signs, depot sign,
// mailbox numbers, van logos). `quads` = [{ rectKey, x, y, z, w, h, face }];
// `atlasSpec` = { slots: [{ key, text, bg, fg, w, h }], numbers: [n] }. Each
// quad's rectKey must match a slot key ('street:<road>', 'shop:<id>', 'school',
// 'depot'), a number key ('num:<n>'), or 'logo'. The slot's aspect matches the
// quad's (M15a.10) so the text is not squished.
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
    // Corners 0/3 sit on the -tan side and 1/2 on the +tan side. For a
    // cam-facing face the texture's left edge (u) must land on the viewer's
    // screen-left, which is the -tan side — so `flip` puts u on corners 0/3.
    // Two-sided street signs (M15a.6) set flip on both back-to-back quads.
    if (q.flip) {
      uv.push(rect.u, rect.v, rect.u + rect.w, rect.v, rect.u + rect.w, rect.v + rect.h, rect.u, rect.v + rect.h);
    } else {
      uv.push(rect.u + rect.w, rect.v, rect.u, rect.v, rect.u, rect.v + rect.h, rect.u + rect.w, rect.v + rect.h);
    }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  // FrontSide: each two-sided sign is two back-to-back quads (see M15a.6);
  // single-face wall signs only ever show their outward face.
  // FrontSide: two-sided signs are two back-to-back quads (M15a.6); single
  // wall signs only ever show their outward face.
  // DoubleSide (M15a.6 decision): two-sided street signs are two back-to-back
  // quads, each readable from its side. We keep DoubleSide (not FrontSide, as
  // the plan suggested) because every single-quad sign (van logo, QUICKBOX
  // depot sign, shop signs, mailbox numbers) has its FrontSide/CCW face
  // pointing AWAY from the street, so FrontSide would cull them. DoubleSide
  // renders all of them correctly (the mirrored back faces of single-quad
  // signs are on building/van undersides the player never sees).
  const mat = new THREE.MeshBasicMaterial({ map: atlas.texture, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'signs';
  return { mesh, atlas, material: mat };
}

function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
