// §10: the full-screen map (Tab). North-up, the whole pre-rendered map scaled
// to fit, with all blips, a legend, the player arrow and the waypoint. Clicking
// sets (or clears) the waypoint. The game pauses while it is open. 2D canvas:
// zero GPU draw calls.
import { renderMapCanvas } from './mapcanvas.js';

const KIND_COLOR = { target: '#00b4a6', pickup: '#ffbe0b', depot: '#00b4a6', marker: '#8338ec', waypoint: '#ff5d5d', bee: '#ffe14d', locker: '#00b4a6' };
const KIND_LABEL = { target: 'Deliver', pickup: 'Pickup', depot: 'Quickbox Q', marker: 'Mission', waypoint: 'Waypoint', bee: 'Angry bees', locker: 'Parcel locker' };

export function createFullMap({ tm, state, radar, onPause }) {
  const map = renderMapCanvas(tm);
  const worldW = tm.width * tm.tileSize, worldH = tm.height * tm.tileSize;

  const root = document.createElement('div');
  root.className = 'fullmap';
  const canvas = document.createElement('canvas');
  const legend = document.createElement('div');
  legend.className = 'fm-legend';
  legend.innerHTML = '<b>Legend</b>' + Object.keys(KIND_LABEL).map((k) =>
    '<span><i style="background:' + KIND_COLOR[k] + '"></i>' + KIND_LABEL[k] + '</span>').join('') +
    '<span class="fm-hint">Click: set / clear waypoint · Tab / Esc: close</span>';
  root.appendChild(canvas);
  root.appendChild(legend);
  document.getElementById('ui').appendChild(root);

  const ctx = canvas.getContext('2d');
  let mapOpen = false, acc = 0;
  let s = 1, ox = 0, oy = 0; // scale + letterbox offsets (filled in fit())

  function fit() {
    const m = 40;
    s = Math.min((canvas.width - m) / worldW, (canvas.height - m) / worldH);
    ox = (canvas.width - worldW * s) / 2;
    oy = (canvas.height - worldH * s) / 2;
  }

  function drawBlips() {
    const p = state.player;
    // Deliver / Pickup
    if (state.delivery) {
      for (const t of state.delivery.targets) if (!t.delivered) dot(t.doormat.x, t.doormat.z, KIND_COLOR.target, 5);
      const rz = state.world.def.restockZone;
      dot(tm.cx((rz.x0 + rz.x1) / 2), tm.cz((rz.z0 + rz.z1) / 2), KIND_COLOR.pickup, 6);
      // §2.17: the parcel lockers (teal=full, grey=empty for the rest of the shift).
      const del = state.delivery;
      if (del.lockerState && del.lockerBodies) for (let i = 0; i < del.lockerState.length; i++) {
        dot(del.lockerBodies[i].wx, del.lockerBodies[i].wz, del.lockerState[i].full ? KIND_COLOR.locker : '#8d99ae', 5);
      }
    }
    const depot = state.world.def.buildings.find((b) => b.kind === 'depot');
    if (depot) letter('Q', tm.cx(depot.x + depot.w / 2), tm.cz(depot.z + depot.d / 2), KIND_COLOR.depot);
    if (!state.delivery) for (const mk of state.world.def.missionMarkers) dot(tm.cx(mk.x), tm.cz(mk.z), mk.color, 5);
    if (state.waypoint) { dot(state.waypoint.x, state.waypoint.z, KIND_COLOR.waypoint, 7); }
    if (state.hazards && state.hazards.hiveSt) for (const h of state.hazards.hiveSt) if (h.state === 'angry') dot(h.x, h.z, KIND_COLOR.bee, 3);
    if (p) {
      // player arrow (rotated to its facing)
      ctx.save(); ctx.translate(ox + p.pos.x * s, oy + p.pos.z * s); ctx.rotate(p.heading);
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#22223b'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(-5, 6); ctx.lineTo(5, 6); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
  }
  const toPx = (wx) => ox + wx * s, toPy = (wz) => oy + wz * s;
  function dot(wx, wz, color, r) {
    ctx.fillStyle = color; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(toPx(wx), toPy(wz), r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  function letter(t, wx, wz, color) {
    ctx.fillStyle = color; ctx.font = '800 16px ui-rounded, system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, toPx(wx), toPy(wz));
  }

  function draw() {
    fit();
    ctx.fillStyle = '#1c2333'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(map.canvas, ox, oy, worldW * s, worldH * s);
    drawBlips();
  }

  function onKey(e) {
    if (!mapOpen) return;
    // M12a.8: Tab is a toggle handled by main.js (input 'map'); Escape closes here.
    if (e.key === 'Escape') { e.preventDefault(); close(); }
  }
  function onClick(e) {
    if (!mapOpen) return;
    const r = canvas.getBoundingClientRect();
    const wx = (e.clientX - r.left - ox) / s, wz = (e.clientY - r.top - oy) / s;
    const tx = Math.floor(wx / tm.tileSize), tz = Math.floor(wz / tm.tileSize);
    if (state.waypoint) {
      const dx = Math.abs(state.waypoint.x - tm.cx(tx)), dz = Math.abs(state.waypoint.z - tm.cz(tz));
      if (dx < tm.tileSize && dz < tm.tileSize) { radar.clearWaypoint(); return; }
    }
    radar.setWaypoint(tx, tz);
  }
  window.addEventListener('keydown', onKey);
  canvas.addEventListener('click', onClick);

  function open() {
    if (mapOpen) return;
    mapOpen = true;
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    root.style.display = 'block';
    root.style.pointerEvents = 'auto';
    onPause(true);
    draw();
  }
  function close() {
    if (!mapOpen) return;
    mapOpen = false;
    root.style.display = 'none';
    root.style.pointerEvents = 'none';
    onPause(false);
  }
  function tick(dt) {
    if (!mapOpen) return;
    acc += dt;
    if (acc >= 1 / 15) { acc = 0; draw(); }
  }
  function dispose() {
    window.removeEventListener('keydown', onKey);
    canvas.removeEventListener('click', onClick);
  }
  return { open, close, isOpen: () => mapOpen, tick, dispose };
}
