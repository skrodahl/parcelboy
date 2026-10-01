// §10: the corner radar — a circular 200px canvas, player-centered, that rotates
// with the camera (the direction the courier faces is "up"). It draws the
// pre-rendered map, the GPS route (BFS over walkable tiles), and the blips.
// Runs at 15 Hz; costs zero GPU draw calls (it's a 2D canvas).

import { renderMapCanvas } from './mapcanvas.js';

const S = 200;      // logical CSS size
const SCALE = 2;    // internal device pixels for crispness
const C = S / 2;    // center
const R = S / 2 - 3; // clip radius
const RANGE = 45;   // world units visible in the radius
const PPU = R / RANGE; // pixels per world unit

// Blip colors (§10). The white outline is drawn around each marker.
const KIND_COLOR = { target: '#00b4a6', pickup: '#ffbe0b', depot: '#00b4a6', marker: '#8338ec', waypoint: '#ff5d5d', bee: '#ffe14d' };

export function createRadar({ tm, state, ui }) {
  const map = renderMapCanvas(tm);
  const W = tm.width, H = tm.height;
  const worldW = W * tm.tileSize, worldH = H * tm.tileSize; // world units

  // Preallocated BFS + route buffers (no per-frame allocation; the route is
  // recomputed only when the player's tile or the objective tile changes).
  const visited = new Uint8Array(W * H);
  const prev = new Int32Array(W * H);
  const queue = new Int32Array(W * H);
  const routeX = new Float32Array(512), routeZ = new Float32Array(512);
  let routeLen = 0, lastPTile = -1, lastOTile = -1;
  const DIRS = [1, -1, W, -W];

  // Preallocated blip scratch (reused every draw).
  const BLIP_N = 48;
  const blip = new Array(BLIP_N);
  for (let i = 0; i < BLIP_N; i++) blip[i] = { wx: 0, wz: 0, kind: '', color: '' };
  let blipCount = 0;

  const canvas = document.createElement('canvas');
  canvas.className = 'radar';
  canvas.width = S * SCALE; canvas.height = S * SCALE;
  const ctx = canvas.getContext('2d');
  ctx.scale(SCALE, SCALE);
  ui.appendChild(canvas);

  function objectiveOf() {
    if (state.waypoint) return state.waypoint; // a user-set waypoint wins
    const del = state.delivery;
    if (del) {
      if (del.carried > 0) {
        const t = del.nextUndelivered();
        if (t) return { x: t.doormat.x, z: t.doormat.z };
      }
      const rz = state.world.def.restockZone; // empty → head to the depot pickup
      return { x: tm.cx((rz.x0 + rz.x1) / 2), z: tm.cz((rz.z0 + rz.z1) / 2) };
    }
    return null;
  }

  function recomputeRoute(px, pz, ox, oz) {
    const T = tm.tileSize;
    const pti = Math.floor(pz / T) * W + Math.floor(px / T);
    const oti = Math.floor(oz / T) * W + Math.floor(ox / T);
    lastPTile = pti; lastOTile = oti;
    visited.fill(0);
    if (!tm.isWalkable(Math.floor(ox / T), Math.floor(oz / T))) { routeLen = 0; return; }
    let head = 0, tail = 0;
    queue[tail++] = oti; visited[oti] = 1; prev[oti] = -1;
    let found = false;
    while (head < tail) {
      const cur = queue[head++];
      if (cur === pti) { found = true; break; }
      const cx = cur % W;
      for (let k = 0; k < 4; k++) {
        const ni = cur + DIRS[k];
        if (ni < 0 || ni >= W * H || visited[ni]) continue;
        const nx = ni % W;
        if (k === 0 && cx === W - 1) continue; // +1 must not wrap to the next row
        if (k === 1 && cx === 0) continue;     // -1 must not wrap to the previous row
        if (!tm.isWalkable(nx, (ni - nx) / W)) continue;
        visited[ni] = 1; prev[ni] = cur; queue[tail++] = ni;
      }
    }
    routeLen = 0;
    if (found) {
      let c = pti;
      while (c !== -1) {
        routeX[routeLen] = tm.cx(c % W); routeZ[routeLen] = tm.cz((c - (c % W)) / W); routeLen++;
        if (c === oti) break;
        c = prev[c];
      }
    }
  }

  function collectBlips() {
    blipCount = 0;
    const del = state.delivery, wd = state.world;
    const push = (wx, wz, kind, color) => { if (blipCount < BLIP_N) { const s = blip[blipCount++]; s.wx = wx; s.wz = wz; s.kind = kind; s.color = color; } };
    if (del) for (const t of del.targets) if (!t.delivered) push(t.doormat.x, t.doormat.z, 'target', KIND_COLOR.target);
    if (del) { const rz = wd.def.restockZone; push(tm.cx((rz.x0 + rz.x1) / 2), tm.cz((rz.z0 + rz.z1) / 2), 'pickup', KIND_COLOR.pickup); }
    const depot = wd.def.buildings.find((b) => b.kind === 'depot');
    if (depot) push(tm.cx(depot.x + depot.w / 2), tm.cz(depot.z + depot.d / 2), 'depot', KIND_COLOR.depot);
    if (!del) for (const m of wd.def.missionMarkers) push(tm.cx(m.x), tm.cz(m.z), 'marker', m.color);
    if (state.waypoint) push(state.waypoint.x, state.waypoint.z, 'waypoint', KIND_COLOR.waypoint);
    if (state.hazards && state.hazards.hiveSt) for (const h of state.hazards.hiveSt) if (h.state === 'angry') push(h.x, h.z, 'bee', KIND_COLOR.bee);
    // §2.15: red house blips at the Grumps (mission) + flashing Watch units.
    if (del && state.mischief && state.mischief.grumps.length) for (const id of state.mischief.grumps) {
      const dm = wd.doormatPoints[id];
      if (dm) push(dm.x, dm.z, 'grump', '#e63946');
    }
    if (state.watch) for (const w of state.watch.positions) push(w.x, w.z, 'watch', '#ff3b3b');
  }

  function drawBlip(wx, wz, kind, color) {
    const sx = (wx - state.player.pos.x) * PPU, sz = (wz - state.player.pos.z) * PPU; // local, north-up
    const d = Math.hypot(sx, sz), rim = R - 4;
    let lx = sx, ly = sz, atRim = false;
    if (d > rim) { const f = rim / d; lx *= f; ly *= f; atRim = true; }
    ctx.save();
    ctx.globalAlpha = atRim ? 0.9 : 1;
    if (kind === 'depot') {
      ctx.fillStyle = color; ctx.font = '800 ' + (atRim ? 11 : 15) + 'px ui-rounded, system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('Q', lx, ly);
    } else if (kind === 'waypoint') {
      ctx.fillStyle = color; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(lx, ly, atRim ? 4 : 5.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (atRim) { ctx.beginPath(); ctx.moveTo(lx, ly); const a = Math.atan2(ly, lx); ctx.lineTo(lx + Math.cos(a) * 7, ly + Math.sin(a) * 7); ctx.stroke(); }
    } else if (kind === 'bee') {
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(lx, ly, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke();
    } else if (kind === 'grump') {
      // a red "house" blip (roofed square) at the Grump house.
      ctx.globalAlpha = atRim ? 0.8 : 1;
      ctx.fillStyle = color; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2;
      const r = atRim ? 2.5 : 3.5;
      ctx.fillRect(lx - r, ly - r, r * 2, r * 2); ctx.strokeRect(lx - r, ly - r, r * 2, r * 2);
      ctx.beginPath(); ctx.moveTo(lx - r, ly - r); ctx.lineTo(lx, ly - r - 3); ctx.lineTo(lx + r, ly - r); ctx.closePath(); ctx.fill(); // roof
    } else if (kind === 'watch') {
      // a flashing red ring (the Neighborhood Watch), clamped to the disc.
      ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(rt * 5));
      ctx.strokeStyle = color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(lx, ly, atRim ? 4 : 5, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(lx, ly, 1.5, 0, Math.PI * 2); ctx.fill();
    } else {
      // parcel-style marker (targets / pickup) with a white outline
      const r = atRim ? 3 : 5;
      ctx.fillStyle = color; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
      ctx.fillRect(lx - r, ly - r, r * 2, r * 2); ctx.strokeRect(lx - r, ly - r, r * 2, r * 2);
    }
    ctx.restore();
  }

  function draw() {
    const p = state.player;
    if (!p) return;
    const px = p.pos.x, pz = p.pos.z;
    const obj = objectiveOf();
    const objTile = obj ? Math.floor(obj.x / tm.tileSize) + Math.floor(obj.z / tm.tileSize) * W : -1;
    const pTile = Math.floor(px / tm.tileSize) + Math.floor(pz / tm.tileSize) * W;
    if (obj && (pTile !== lastPTile || objTile !== lastOTile)) recomputeRoute(px, pz, obj.x, obj.z);
    collectBlips();

    ctx.clearRect(0, 0, S, S);
    ctx.save();
    ctx.beginPath(); ctx.arc(C, C, R, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = '#26362a'; ctx.fill();
    ctx.translate(C, C);
    ctx.rotate(-p.heading); // the facing direction is "up"; N tick tracks north
    ctx.drawImage(map.canvas, -px * PPU, -pz * PPU, worldW * PPU, worldH * PPU);
    if (routeLen > 1) {
      ctx.strokeStyle = '#00b4a6'; ctx.lineWidth = 5; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo((routeX[0] - px) * PPU, (routeZ[0] - pz) * PPU);
      for (let i = 1; i < routeLen; i++) ctx.lineTo((routeX[i] - px) * PPU, (routeZ[i] - pz) * PPU);
      ctx.stroke();
    }
    for (let i = 0; i < blipCount; i++) drawBlip(blip[i].wx, blip[i].wz, blip[i].kind, blip[i].color);
    ctx.restore();

    // Rim + N tick + player arrow (drawn in screen space, not rotated).
    ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(C, C, R, 0, Math.PI * 2); ctx.stroke();
    const nx = C - Math.sin(p.heading) * (R - 12), ny = C - Math.cos(p.heading) * (R - 12);
    ctx.fillStyle = '#fff'; ctx.font = '800 13px ui-rounded, system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('N', nx, ny);
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#22223b'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(C, C - 8); ctx.lineTo(C - 5, C + 6); ctx.lineTo(C + 5, C + 6); ctx.closePath();
    ctx.fill(); ctx.stroke();

    // §2.15: the 3-whistle heat meter just above the disc (fills with the level).
    const level = state.heat ? state.heat.level : 0;
    ctx.save();
    for (let i = 0; i < 3; i++) {
      const wx = C - 18 + i * 18, wy = 12;
      const on = i < level;
      ctx.fillStyle = on ? '#ff3b3b' : 'rgba(255,255,255,0.25)';
      ctx.strokeStyle = on ? '#fff' : 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1;
      // a little whistle: a body + a short mouthpiece.
      ctx.beginPath(); ctx.arc(wx, wy, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillRect(wx + 3, wy - 1.5, 5, 3);
      if (on) { ctx.fillStyle = '#22223b'; ctx.fillRect(wx + 4, wy - 0.6, 3, 1.2); } // the "note"
    }
    ctx.restore();
  }

  let acc = 0, rt = 0;
  function tick(dt) {
    acc += dt; rt += dt;
    if (acc >= 1 / 15) { acc = 0; draw(); }
  }

  function setWaypoint(tileX, tileZ) {
    state.waypoint = { x: tm.cx(tileX), z: tm.cz(tileZ) };
    draw();
  }
  function clearWaypoint() { state.waypoint = null; draw(); }

  return { canvas, tick, setWaypoint, clearWaypoint };
}
