import * as THREE from 'three';

// M15a.9: GTA-style markers. Each spot gets a big downward voxel arrow (a
// stepped, upside-down pyramid ~2.4u wide, ~2u tall) floating ~3.5u above the
// ground, bobbing (±0.4) and slowly spinning, in the marker's color (unlit,
// fog off, so it reads from across the suburb, even above roofs). A flat
// glowing ring on the ground pulses outward every ~1.5 s, and a small kind-icon
// (parcel / shirt / cake / wrench, a few boxes each) sits on top of the arrow.
// In range the arrow bounces higher + the ring brightens; within 8u everything
// scales to 70% so it doesn't cover the courier.
//
// Draw calls: THREE total — one InstancedMesh for the arrow boxes, one for the
// rings, one for the icon boxes. Animation is allocation-free (pre-allocated
// scratch Matrix4/Vector3/Quaternion/Color + per-mark scalars).
const ARROW_Y = 3.5;      // the arrow's base height above the ground
const ICON_LIFT = 1.5;    // the icon sits this far above the arrow's center
const RING_Y = 0.06;      // just off the ground
const RING_BASE = 1.6;    // the ring's resting outer radius
const RING_PERIOD = 1.5;  // s per sonar ping
const NEAR_DIST = 8;      // within this, scale to 70%

// A stepped, upside-down pyramid (~2.4 wide at the top, ~2 tall, pointing down).
const ARROW_STEPS = [
  { oy: 0.8, w: 2.4, h: 0.55 }, // top (widest)
  { oy: 0.0, w: 1.5, h: 0.55 }, // middle
  { oy: -0.8, w: 0.7, h: 0.55 }, // bottom (narrowest = the point)
];
// The kind icons: a few axis-aligned boxes each, centered on the icon origin
// (~1u tall). Unknown icon → a plain cube.
const ICONS = {
  parcel: [
    { ox: 0, oy: 0, oz: 0, sx: 1.0, sy: 0.9, sz: 1.0 },
    { ox: 0, oy: 0.55, oz: 0, sx: 1.05, sy: 0.12, sz: 0.42 },
    { ox: 0, oy: 0, oz: 0.1, sx: 0.34, sy: 0.95, sz: 1.05 },
  ],
  shirt: [
    { ox: 0, oy: 0, oz: 0, sx: 0.9, sy: 0.95, sz: 0.28 },
    { ox: -0.6, oy: 0.2, oz: 0, sx: 0.32, sy: 0.5, sz: 0.28 },
    { ox: 0.6, oy: 0.2, oz: 0, sx: 0.32, sy: 0.5, sz: 0.28 },
  ],
  cake: [
    { ox: 0, oy: 0, oz: 0, sx: 1.0, sy: 0.5, sz: 1.0 },
    { ox: 0, oy: 0.35, oz: 0, sx: 0.85, sy: 0.25, sz: 0.85 },
    { ox: 0, oy: 0.62, oz: 0, sx: 0.14, sy: 0.35, sz: 0.14 },
  ],
  wrench: [
    { ox: 0, oy: 0, oz: 0, sx: 0.28, sy: 1.0, sz: 0.28 },
    { ox: 0, oy: 0.55, oz: 0, sx: 0.6, sy: 0.4, sz: 0.32 },
    { ox: 0.36, oy: 0.55, oz: 0, sx: 0.3, sy: 0.34, sz: 0.32 },
  ],
};
const CUBE_ICON = [{ ox: 0, oy: 0, oz: 0, sx: 1, sy: 1, sz: 1 }];
const ICONS_PER = 3; // every icon is exactly 3 boxes

export function createMissionMarkers({ scene, def, T }) {
  const marks = (def.missionMarkers || []).map((m, i) => ({
    id: m.id, color: m.color || '#00b4a6', icon: m.icon || 'parcel',
    x: m.x * T + T / 2, z: m.z * T + T / 2,
    spin: i * 0.9, bobPhase: i * 1.7, ringPhase: i * 0.35, shrink: 1, inRange: false,
  }));
  const n = marks.length;
  if (!n) return { tick() {}, dispose() {}, byId: {}, nearest() { return null; } };

  const M = new THREE.Matrix4(), P = new THREE.Vector3(), Q = new THREE.Quaternion(), S = new THREE.Vector3();
  const C = new THREE.Color(), TINT = new THREE.Color(), ringTint = new THREE.Color();
  const Y = new THREE.Vector3(0, 1, 0);

  // arrows + icons share one unit box; rings use a flat ring geometry.
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const unlit = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false, transparent: true, opacity: 0.92, depthWrite: false });
  const arrowMat = unlit;
  const iconMat = unlit.clone();
  const ringGeo = new THREE.RingGeometry(0.7, 1.0, 28); // unit ring; scaled per instance
  ringGeo.rotateX(-Math.PI / 2); // lie flat in XZ
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide });

  const arrows = new THREE.InstancedMesh(boxGeo, arrowMat, ARROW_STEPS.length * n);
  const icons = new THREE.InstancedMesh(boxGeo, iconMat, ICONS_PER * n);
  const rings = new THREE.InstancedMesh(ringGeo, ringMat, n);
  arrows.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  icons.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  rings.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  // The instances span the whole suburb + bob/spin, so the base geometry's
  // bounding sphere (a unit box at the world origin) would frustum-cull the
  // whole mesh whenever the cam looks away from the origin. Cull manually: off.
  arrows.frustumCulled = false;
  icons.frustumCulled = false;
  rings.frustumCulled = false;
  scene.add(arrows, rings, icons);

  function writeArrow(i, m) {
    const s = m.shrink;
    const cy = ARROW_Y + Math.sin(m.bobPhase) * (m.inRange ? 0.8 : 0.4);
    let k = i * ARROW_STEPS.length;
    for (const st of ARROW_STEPS) {
      P.set(m.x, cy + st.oy * s, m.z);
      Q.setFromAxisAngle(Y, m.spin);
      S.set(st.w * s, st.h * s, st.w * s);
      M.compose(P, Q, S);
      arrows.setMatrixAt(k, M);
      arrows.setColorAt(k, C.set(m.color));
      k++;
    }
  }
  function writeIcon(i, m) {
    const boxes = ICONS[m.icon] || CUBE_ICON;
    const s = m.shrink;
    const cy = ARROW_Y + Math.sin(m.bobPhase) * (m.inRange ? 0.8 : 0.4) + ICON_LIFT * s;
    const ca = Math.cos(m.spin), sa = Math.sin(m.spin);
    let k = i * ICONS_PER;
    for (const b of boxes) {
      const ox = b.ox * s, oz = b.oz * s; // orbit the offset around the marker as it spins
      P.set(m.x + ox * ca - oz * sa, cy + b.oy * s, m.z + ox * sa + oz * ca);
      Q.setFromAxisAngle(Y, m.spin);
      S.set(b.sx * s, b.sy * s, b.sz * s);
      M.compose(P, Q, S);
      icons.setMatrixAt(k, M);
      icons.setColorAt(k, TINT.set(m.color).lerp(C.set(0xffffff), 0.45)); // a bright, readable icon
      k++;
    }
  }
  function writeRing(i, m, t) {
    const ph = ((t / RING_PERIOD + m.ringPhase) % 1 + 1) % 1; // 0→1 ping cycle
    const grow = 0.5 + ph * 1.1;
    P.set(m.x, RING_Y, m.z);
    Q.identity();
    S.set(RING_BASE * grow * m.shrink, 1, RING_BASE * grow * m.shrink);
    M.compose(P, Q, S);
    rings.setMatrixAt(i, M);
    // brighter (toward white) while the ping is fresh + the player is in range.
    const bright = Math.min(1, (m.inRange ? 0.7 : 0.3) * (1 - ph));
    rings.setColorAt(i, ringTint.set(m.color).lerp(C.set(0xffffff), bright));
  }
  function tick(dt, px, pz) {
    const t = performance.now() * 0.001;
    for (let i = 0; i < n; i++) {
      const m = marks[i];
      m.spin += dt * 0.6;
      m.bobPhase += dt * 2.2;
      const dx = (px || 0) - m.x, dz = (pz || 0) - m.z;
      const d2 = dx * dx + dz * dz;
      m.inRange = d2 < NEAR_DIST * NEAR_DIST * 0.25; // ~half the marker radius
      const want = d2 < NEAR_DIST * NEAR_DIST ? 0.7 : 1;
      m.shrink += (want - m.shrink) * Math.min(1, dt * 6);
      writeArrow(i, m);
      writeIcon(i, m);
      writeRing(i, m, t);
    }
    for (const mesh of [arrows, icons, rings]) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }
  const byId = {};
  for (const m of marks) byId[m.id] = m;
  function nearest(x, z, r) {
    let best = null, bd = r * r;
    for (const m of marks) { const dx = m.x - x, dz = m.z - z; const d2 = dx * dx + dz * dz; if (d2 < bd) { bd = d2; best = m.id; } }
    return best;
  }
  function dispose() {
    scene.remove(arrows, rings, icons);
    boxGeo.dispose(); ringGeo.dispose();
    arrowMat.dispose(); iconMat.dispose(); ringMat.dispose();
  }
  return { tick, dispose, byId, nearest };
}
