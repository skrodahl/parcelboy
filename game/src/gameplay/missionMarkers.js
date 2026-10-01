import * as THREE from 'three';

// §2.13 / M12a.1: the visible mission / locker / side markers. A tall light
// column + a spinning icon at each `def.missionMarkers` tile, so a player can
// spot them from far away and walk up to start a shift. The materials have fog
// off so the columns don't fade. Two InstancedMeshes (columns + icons) share
// one box geometry = 2 draw calls; the icon spin is allocation-free.
export function createMissionMarkers({ scene, def, T }) {
  const marks = (def.missionMarkers || []).map((m, i) => ({
    id: m.id, color: m.color || '#00b4a6', x: m.x * T + T / 2, z: m.z * T + T / 2, spin: i * 0.9,
  }));
  const n = marks.length;
  if (!n) return { tick() {}, dispose() {}, byId: {}, nearest() { return null; } };

  const colGeo = new THREE.BoxGeometry(0.4, 15, 0.4);
  const colMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, fog: false, depthWrite: false });
  const iconGeo = new THREE.BoxGeometry(1.1, 1.1, 1.1);
  const iconMat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false });
  const columns = new THREE.InstancedMesh(colGeo, colMat, n);
  const icons = new THREE.InstancedMesh(iconGeo, iconMat, n);
  columns.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  icons.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  const M = new THREE.Matrix4(), P = new THREE.Vector3(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), C = new THREE.Color();
  const Y = new THREE.Vector3(0, 1, 0);
  const COL_TOP = 7.5, ICON_Y = 15.6;
  for (let i = 0; i < n; i++) {
    const m = marks[i];
    Q.identity(); S.set(1, 1, 1);
    P.set(m.x, COL_TOP, m.z); M.compose(P, Q, S); columns.setMatrixAt(i, M); columns.setColorAt(i, C.set(m.color));
    P.set(m.x, ICON_Y, m.z); M.compose(P, Q, S); icons.setMatrixAt(i, M); icons.setColorAt(i, C.set(m.color));
  }
  if (columns.instanceColor) columns.instanceColor.needsUpdate = true;
  if (icons.instanceColor) icons.instanceColor.needsUpdate = true;
  scene.add(columns, icons);

  function tick(dt) {
    for (let i = 0; i < n; i++) {
      const m = marks[i];
      m.spin += dt * 1.2;
      Q.setFromAxisAngle(Y, m.spin); S.set(1, 1, 1);
      P.set(m.x, ICON_Y, m.z); M.compose(P, Q, S);
      icons.setMatrixAt(i, M);
    }
    icons.instanceMatrix.needsUpdate = true;
  }
  const byId = {};
  for (const m of marks) byId[m.id] = m;
  function nearest(x, z, r) {
    let best = null, bd = r * r;
    for (const m of marks) { const dx = m.x - x, dz = m.z - z; const d2 = dx * dx + dz * dz; if (d2 < bd) { bd = d2; best = m.id; } }
    return best;
  }
  function dispose() { scene.remove(columns, icons); colGeo.dispose(); iconGeo.dispose(); colMat.dispose(); iconMat.dispose(); }
  return { tick, dispose, byId, nearest };
}
