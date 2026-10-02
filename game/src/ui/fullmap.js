// §10 + M15a.18: the full map (Tab) is the LIVE 3D world seen from above (like
// the title screen). The main camera is driven top-down by mapCam; the sim keeps
// running (the world stays live) but the courier is locked and protected. This
// module is the overlay: a compact legend, projected DOM labels (suburb, streets,
// landmarks, exits, blips), and zoom / pan / recenter / waypoint / close input.
import * as THREE from 'three';

const KIND_COLOR = { target: '#00b4a6', pickup: '#ffbe0b', depot: '#00b4a6', marker: '#8338ec', waypoint: '#ff5d5d', bee: '#ffe14d', locker: '#00b4a6', exit: '#ffbe0b' };
const KIND_LABEL = { target: 'Deliver', pickup: 'Pickup', depot: 'Quickbox Q', marker: 'Mission', waypoint: 'Waypoint', bee: 'Angry bees', locker: 'Parcel locker', exit: 'Exit' };

function el(cls, text) { const d = document.createElement('div'); d.className = cls; if (text != null) d.textContent = text; return d; }

export function createFullMap({ tm, state, radar, camera, mapCam, onOpen, onClose, onMode }) {
  const worldW = tm.width * tm.tileSize, worldH = tm.height * tm.tileSize;
  const T = tm.tileSize;

  // --- DOM overlay (transparent: the 3D world renders behind it). ---
  const root = document.createElement('div');
  root.className = 'fullmap';
  const labelsRoot = document.createElement('div'); labelsRoot.className = 'fm-labels';
  const suburb = el('fm-suburb', tm.def.name);
  const legend = el('fm-legend');
  legend.innerHTML = Object.keys(KIND_LABEL).map((k) =>
    '<span><i style="background:' + KIND_COLOR[k] + '"></i>' + KIND_LABEL[k] + '</span>').join('') +
    '<span class="fm-hint">wheel: zoom · drag: pan · F: recenter · click: waypoint · Tab/Esc: close</span>';
  root.append(suburb, labelsRoot, legend);
  root.style.display = 'none';
  document.getElementById('ui').appendChild(root);

  // The mapCam height at which the WHOLE suburb fits the viewport (with margin),
  // so the default map view shows the entire neighborhood, not a cropped slice.
  function fitHeight() {
    const fov = (camera.fov * Math.PI) / 180;
    const aspect = window.innerWidth / Math.max(1, window.innerHeight);
    const hV = worldH / (2 * Math.tan(fov / 2));          // vertical fit
    const hH = worldW / (2 * Math.tan(fov / 2) * aspect); // horizontal fit
    return Math.max(hV, hH) * 1.06;
  }

  // Projected label pool (rebuilt only when the suburb changes).
  let labels = [];      // [{ el, wx, wz, kind, dynamic }]
  let builtFor = null;  // the suburb id the labels were built for
  const proj = new THREE.Vector3();
  const ndc = new THREE.Vector2();
  const ray = new THREE.Raycaster();

  function roadMid(r) {
    if (r.axis === 'x') return [((r.x0 + r.x1) / 2) * T, r.z * T];
    return [r.x * T, ((r.z0 + r.z1) / 2) * T];
  }
  function buildLabels() {
    labelsRoot.innerHTML = '';
    labels = [];
    const add = (wx, wz, kind, text) => {
      const e = el('fm-label ' + kind, text);
      labelsRoot.appendChild(e);
      labels.push({ el: e, wx, wz, kind, dynamic: false });
    };
    for (const r of (tm.def.roads || [])) { const m = roadMid(r); add(m[0], m[1], 'street', r.name); }
    for (const b of (tm.def.buildings || [])) add((b.x + b.w / 2) * T, (b.z + b.d / 2) * T, 'landmark', b.name || b.kind);
    if (tm.def.playground) add((tm.def.playground.x + tm.def.playground.w / 2) * T, (tm.def.playground.z + tm.def.playground.d / 2) * T, 'landmark', 'Playground');
    if (tm.def.pond) add((tm.def.pond.x + (tm.def.pond.w || 4) / 2) * T, (tm.def.pond.z + (tm.def.pond.d || 3) / 2) * T, 'landmark', 'Pond');
    if (tm.def.kiosk) add(tm.def.kiosk.x * T + T / 2, tm.def.kiosk.z * T + T / 2, 'landmark', tm.def.kiosk.name || 'Kiosk');
    for (const x of (tm.def.exits || [])) add(x.tiles[0][0] * T + T / 2, x.tiles[0][1] * T + T / 2, 'exit', (x.unlockStars ? '🔒 ' : '→ ') + (x.name || x.to));
    builtFor = tm.def.id;
  }

  // Dynamic blips are rebuilt every refresh (a small, allocation-free set).
  function addBlip(wx, wz, kind) {
    const e = el('fm-label ' + kind, kind === 'depot' ? 'Q' : '');
    labelsRoot.appendChild(e);
    labels.push({ el: e, wx, wz, kind, dynamic: true });
  }
  function refreshDynamic() {
    for (let i = labels.length - 1; i >= 0; i--) if (labels[i].dynamic) { labels[i].el.remove(); labels.splice(i, 1); }
    if (state.delivery) {
      for (const t of state.delivery.targets) if (!t.delivered) addBlip(t.doormat.x, t.doormat.z, 'target');
      const rz = state.world.def.restockZone;
      addBlip(tm.cx((rz.x0 + rz.x1) / 2), tm.cz((rz.z0 + rz.z1) / 2), 'pickup');
      if (state.delivery.lockerState && state.delivery.lockerBodies) for (let i = 0; i < state.delivery.lockerState.length; i++) {
        addBlip(state.delivery.lockerBodies[i].wx, state.delivery.lockerBodies[i].wz, state.delivery.lockerState[i].full ? 'locker' : 'empty');
      }
    }
    const depot = state.world.def.buildings.find((b) => b.kind === 'depot');
    if (depot) addBlip(tm.cx(depot.x + depot.w / 2), tm.cz(depot.z + depot.d / 2), 'depot');
    if (!state.delivery) for (const mk of state.world.def.missionMarkers) addBlip(tm.cx(mk.x), tm.cz(mk.z), 'marker');
    if (state.waypoint) addBlip(state.waypoint.x, state.waypoint.z, 'waypoint');
  }

  function updateLabels() {
    const w = window.innerWidth, h = window.innerHeight;
    const dense = mapCam && mapCam.height() < 95; // street names get crowded up close
    for (let i = 0; i < labels.length; i++) {
      const L = labels[i];
      if (L.kind === 'street' && dense) { L.el.style.display = 'none'; continue; }
      proj.set(L.wx, 0, L.wz).project(camera);
      const sx = (proj.x * 0.5 + 0.5) * w, sy = (-proj.y * 0.5 + 0.5) * h;
      if (sx < -80 || sx > w + 80 || sy < -40 || sy > h + 40) { L.el.style.display = 'none'; continue; }
      L.el.style.display = '';
      L.el.style.transform = 'translate(' + sx.toFixed(0) + 'px,' + sy.toFixed(0) + 'px) translate(-50%,-50%)';
    }
  }

  function screenToWorld(cx, cy) {
    const w = window.innerWidth, h = window.innerHeight;
    ndc.set((cx / w) * 2 - 1, -(cy / h) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const t = -ray.ray.origin.y / ray.ray.direction.y; // intersect the y=0 ground
    return [ray.ray.origin.x + ray.ray.direction.x * t, ray.ray.origin.z + ray.ray.direction.z * t];
  }

  // --- input: zoom / pan / recenter / waypoint / close ---
  let mapOpen = false, dragging = false, lastX = 0, lastY = 0;
  function onKey(e) {
    if (!mapOpen) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    if (e.key === 'f' || e.key === 'F') { const p = state.player; if (p) mapCam.recenter(p.pos.x, p.pos.z); }
  }
  function onWheel(e) { if (!mapOpen) return; e.preventDefault(); mapCam.zoom(e.deltaY < 0 ? 1.18 : 1 / 1.18); }
  function onDown(e) { if (!mapOpen) return; dragging = true; lastX = e.clientX; lastY = e.clientY; }
  function onMove(e) {
    if (!mapOpen || !dragging) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY; lastX = e.clientX; lastY = e.clientY;
    const wpp = (2 * Math.tan((camera.fov * Math.PI / 180) / 2) * mapCam.height()) / window.innerHeight;
    mapCam.pan(-dx * wpp, -dy * wpp); // grab-and-drag: the map follows the cursor
  }
  function onUp() { dragging = false; }
  function onClick(e) {
    if (!mapOpen || dragging) return;
    const [wx, wz] = screenToWorld(e.clientX, e.clientY);
    const tx = Math.floor(wx / T), tz = Math.floor(wz / T);
    if (state.waypoint) {
      const dx = Math.abs(state.waypoint.x - tm.cx(tx)), dz = Math.abs(state.waypoint.z - tm.cz(tz));
      if (dx < T && dz < T) { radar.clearWaypoint(); refreshDynamic(); return; }
    }
    radar.setWaypoint(tx, tz); refreshDynamic();
  }
  window.addEventListener('keydown', onKey);
  root.addEventListener('wheel', onWheel, { passive: false });
  root.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  root.addEventListener('click', onClick);

  // --- open / close ---
  function open() {
    if (mapOpen) return;
    mapOpen = true;
    root.style.display = 'block';
    root.style.pointerEvents = 'auto';
    if (builtFor !== tm.def.id) { buildLabels(); refreshDynamic(); }
    const p = state.player;
    if (mapCam && p) mapCam.enter(p.pos.x, p.pos.z, fitHeight());
    if (onMode) onMode(true);   // main.js: top-down cam, fog off, HUD hidden, sim live
    if (onOpen) onOpen();
    updateLabels(); // position the labels immediately (the cam is snapped on enter)
  }
  function close() {
    if (!mapOpen) return;
    mapOpen = false;
    root.style.display = 'none';
    root.style.pointerEvents = 'none';
    if (onMode) onMode(false);  // main.js: restore follow cam + fog + HUD
    if (onClose) onClose();
  }
  function tick(dt) {
    if (!mapOpen) return;
    updateLabels(); // projected each frame (~30 Hz, matches the render cap)
  }
  function dispose() {
    window.removeEventListener('keydown', onKey);
    root.removeEventListener('wheel', onWheel);
    root.removeEventListener('pointerdown', onDown);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    root.removeEventListener('click', onClick);
  }
  return { open, close, isOpen: () => mapOpen, tick, dispose, refreshDynamic };
}
