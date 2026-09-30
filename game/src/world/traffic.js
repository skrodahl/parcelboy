// §2.7: closed traffic loops. Cars follow the tile-center waypoints of a loop
// (right-hand traffic), easing into corners. This module only builds the loop
// geometry + a distance→(x,z,heading) lookup; per-car speed/brake state lives
// in gameplay/hazards.js.

export function createTraffic(def, tm) {
  const loops = Object.values(def.traffic).map((waypoints) => buildLoop(waypoints, tm));

  // Closed loop: segments between consecutive waypoint tile centers.
  function buildLoop(waypoints, tm) {
    const pts = waypoints.map(([x, z]) => ({ x: tm.cx(x), z: tm.cz(z) }));
    const segs = [];
    let total = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const len = Math.hypot(b.x - a.x, b.z - a.z) || 0.001;
      segs.push({ a, b, len, heading: Math.atan2(b.x - a.x, -(b.z - a.z)) });
      total += len;
    }
    // Where along the loop each corner (waypoint) sits, for corner easing.
    const corners = [];
    let acc = 0;
    for (let i = 0; i < pts.length; i++) { corners.push(acc); acc += segs[i].len; }
    return { segs, total, corners };
  }

  // Write the point + heading at arc-length `dist` on loop `i` into `out`.
  function pointAt(i, dist, out) {
    const loop = loops[i];
    let d = dist % loop.total;
    if (d < 0) d += loop.total;
    for (let s = 0; s < loop.segs.length; s++) {
      const seg = loop.segs[s];
      if (d <= seg.len) {
        const t = d / seg.len;
        out.x = seg.a.x + (seg.b.x - seg.a.x) * t;
        out.z = seg.a.z + (seg.b.z - seg.a.z) * t;
        out.heading = seg.heading;
        // How far the next corner is ahead (0..seg.len) — for corner easing.
        out.toCorner = seg.len - d;
        return out;
      }
      d -= seg.len;
    }
    out.x = loop.segs[0].a.x; out.z = loop.segs[0].a.z; out.heading = loop.segs[0].heading; out.toCorner = 99;
    return out;
  }

  return { loops, count: loops.length, pointAt };
}
