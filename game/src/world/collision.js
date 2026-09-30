// §5.7: static spatial hash on the tile grid. Each cell lists the colliders
// overlapping it. `resolveCircle` pushes a circle out of overlaps (X then Z);
// `raySegment` finds the first AABB hit along a flight path (for parcels).
//
// Collider shapes: { type:'box', minX,maxX,minZ,maxZ, h? } (h = top height, for
// roof vs. wall) and { type:'circle', x, z, r }.

export function buildCollision(tm, colliders) {
  const cell = tm.tileSize;
  const cols = tm.width; // one hash cell per tile
  const rows = tm.height;
  const buckets = new Map();
  const key = (cx, cz) => cz * cols + cx;

  for (let i = 0; i < colliders.length; i++) {
    const c = colliders[i];
    let x0, x1, z0, z1;
    if (c.type === 'box') {
      x0 = c.minX; x1 = c.maxX; z0 = c.minZ; z1 = c.maxZ;
    } else {
      x0 = c.x - c.r; x1 = c.x + c.r; z0 = c.z - c.r; z1 = c.z + c.r;
    }
    const c0 = Math.max(0, Math.floor(x0 / cell));
    const c1 = Math.min(cols - 1, Math.floor(x1 / cell));
    const r0 = Math.max(0, Math.floor(z0 / cell));
    const r1 = Math.min(rows - 1, Math.floor(z1 / cell));
    for (let cz = r0; cz <= r1; cz++) {
      for (let cx = c0; cx <= c1; cx++) {
        const k = key(cx, cz);
        let list = buckets.get(k);
        if (!list) { list = []; buckets.set(k, list); }
        list.push(i);
      }
    }
  }

  // No per-call allocation: near colliders are collected into a fixed
  // scratch array (duplicates across cells are harmless — pushOut is
  // idempotent), and push-out reuses one module-scope result object.
  const NEAR_CAP = 256;
  const nearScratch = new Array(NEAR_CAP);
  function nearFill(x, z, r) {
    let n = 0;
    const c0 = Math.max(0, Math.floor((x - r) / cell));
    const c1 = Math.min(cols - 1, Math.floor((x + r) / cell));
    const r0 = Math.max(0, Math.floor((z - r) / cell));
    const r1 = Math.min(rows - 1, Math.floor((z + r) / cell));
    for (let cz = r0; cz <= r1; cz++) {
      for (let cx = c0; cx <= c1; cx++) {
        const list = buckets.get(key(cx, cz));
        if (!list) continue;
        for (let i = 0; i < list.length && n < NEAR_CAP; i++) nearScratch[n++] = colliders[list[i]];
      }
    }
    return n;
  }

  const pushScratch = { hit: false, dx: 0, dz: 0, nx: 0, nz: 0 };

  // Writes the push-out along a single axis into pushScratch and returns it.
  function pushOut(c, x, z, radius) {
    const out = pushScratch;
    out.hit = false; out.dx = 0; out.dz = 0; out.nx = 0; out.nz = 0;
    if (c.type === 'box') {
      const ex = Math.max(c.minX, Math.min(x, c.maxX));
      const ez = Math.max(c.minZ, Math.min(z, c.maxZ));
      const dx = x - ex, dz = z - ez;
      const d2 = dx * dx + dz * dz;
      if (d2 >= radius * radius) return out;
      // Push out along whichever axis has the larger penetration.
      const px = radius - Math.abs(dx), pz = radius - Math.abs(dz);
      if (Math.abs(dx) > Math.abs(dz)) { out.dx = (dx >= 0 ? 1 : -1) * px; out.nx = dx >= 0 ? 1 : -1; out.hit = true; }
      else { out.dz = (dz >= 0 ? 1 : -1) * pz; out.nz = dz >= 0 ? 1 : -1; out.hit = true; }
    } else {
      const dx = x - c.x, dz = z - c.z;
      const d = Math.hypot(dx, dz);
      if (d >= radius + c.r || d === 0) return out;
      const push = radius + c.r - d;
      const ix = dx / d, iz = dz / d;
      out.dx = ix * push; out.dz = iz * push;
      out.nx = ix; out.nz = iz; out.hit = true;
    }
    return out;
  }

  // Push a circle of `radius` at (pos.x, pos.z) out of all overlaps. X then Z.
  // Writes into `out` (a stable object the caller reuses) and returns it:
  // { hit, nx, nz } where (nx,nz) is the averaged hit normal.
  const resScratch = { hit: false, nx: 0, nz: 0 };
  function resolveCircle(pos, radius, out) {
    const res = out || resScratch;
    res.hit = false; res.nx = 0; res.nz = 0;
    // X axis
    for (let i = 0, n = nearFill(pos.x, pos.z, radius + 0.5); i < n; i++) {
      const p = pushOut(nearScratch[i], pos.x, pos.z, radius);
      if (p.hit) { pos.x += p.dx; res.nx = p.nx; res.hit = true; }
    }
    // Z axis
    for (let i = 0, n = nearFill(pos.x, pos.z, radius + 0.5); i < n; i++) {
      const p = pushOut(nearScratch[i], pos.x, pos.z, radius);
      if (p.hit) { pos.z += p.dz; res.nz = p.nz; res.hit = true; }
    }
    return res;
  }

  // First AABB hit along a segment (for parcels). Returns { hit, x, z, h }.
  function raySegment(from, to) {
    const res = { hit: false, x: 0, z: 0, h: 0 };
    const dx = to.x - from.x, dz = to.z - from.z;
    const len = Math.hypot(dx, dz) || 1;
    const steps = Math.ceil(len / 0.25);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const x = from.x + dx * t, z = from.z + dz * t;
      for (let j = 0, m = nearFill(x, z, 0.4); j < m; j++) {
        const c = nearScratch[j];
        if (c.type !== 'box') continue;
        if (x > c.minX && x < c.maxX && z > c.minZ && z < c.maxZ) {
          res.hit = true; res.x = x; res.z = z; res.h = c.h || 0;
          return res;
        }
      }
    }
    return res;
  }

  return { resolveCircle, raySegment, colliders };
}
