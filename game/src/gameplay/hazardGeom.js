// M12a.5: the pure geometry helpers the hazard manager uses, extracted from
// gameplay/hazards.js into their own module (no allocation, no world deps).
// `loopPerim` / `pointOnRect` take the tile size `T` (they'd otherwise need the
// tilemap, which the manager already reads as `world.tilemap.tileSize`).
export function aheadOf(x, z, heading, dx, dz) {
  const fx = Math.sin(heading), fz = -Math.cos(heading);
  const d = Math.hypot(dx, dz);
  if (d < 0.001) return -1;
  return (dx * fx + dz * fz) / d; // -1..1, 1 = directly ahead
}
export function dist2d(ax, az, bx, bz) { const dx = ax - bx, dz = az - bz; return Math.hypot(dx, dz); }
export function inArcOf(s, px, pz) {
  const a = Math.atan2(px - s.x, -(pz - s.z)) - s.angle;
  let n = a % (Math.PI * 2); if (n < 0) n += Math.PI * 2; if (n > Math.PI) n = Math.PI * 2 - n;
  return n < (120 * Math.PI) / 180 / 2;
}
export function loopPerim(r, T) { return 2 * (Math.abs((r.x1 - r.x0) + 1) * T + Math.abs((r.z1 - r.z0) + 1) * T); }
// A point + heading at distance `d` around a loop's rectangular perimeter.
// (cx/cz of tile r.x0 is r.x0*T, since the tilemap's center is (t + 0.5)*T.)
// M15a.5: the heading is the car convention (model front = local +Z, Y rotation
// = atan2(dx, dz) of the travel direction): +X → π/2, +Z → 0, -X → -π/2, -Z → π.
// `out` is the caller's scratch object (written in place, no allocation).
export function pointOnRect(r, d, T, out) {
  const w = (r.x1 - r.x0 + 1) * T, h = (r.z1 - r.z0 + 1) * T;
  const x0 = r.x0 * T, z0 = r.z0 * T;
  const dd = d % (2 * (w + h));
  if (dd < w) { out.x = x0 + dd; out.z = z0; out.h = Math.PI / 2; }
  else if (dd < w + h) { out.x = x0 + w; out.z = z0 + (dd - w); out.h = 0; }
  else if (dd < 2 * w + h) { out.x = x0 + w - (dd - w - h); out.z = z0 + h; out.h = -Math.PI / 2; }
  else { out.x = x0; out.z = z0 + h - (dd - 2 * w - h); out.h = Math.PI; }
  return out;
}
