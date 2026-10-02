// M15a.14: the pond dunk - a cartoon water hazard (behavior 'dunk', data-driven
// via the `water` def in data/hazards.js). When the courier's center enters a
// water tile: on foot + slow -> a 0.6 s teeter (windmill arms; stop or turn
// back to save yourself); faster or on any vehicle -> straight in. SPLOOSH +
// a splash burst + bubbles, sink to the neck, pop up spluttering with a duck
// on the head, then respawn on the nearest safe park-path/sidewalk tile
// (>=3u from water, >=8u from active hazards), facing away from the water,
// dripping, with the knockdown's invuln blink + a 2 s water grace. In a
// mission you lose one parcel (respects the difficulty's
// knockdownCostsParcel); in free roam it's just the gag.
import * as THREE from 'three';
import { VoxelBuilder } from '../render/voxel.js';
import { HAZARD_BY_ID } from '../data/hazards.js';

const DUCK_Y = 1.7; // sits on the courier's head when standing

export function createDunk(env) {
  const { world, getDelivery, getDiff, getHazards, watch, effects, floatText, events, scene, mat, getVehId, getMaxSpeed } = env;
  const getPlayer = env.getPlayer || (() => null);
  const tm = world.tilemap;
  const T = tm.tileSize;
  // M15a.14: all tuning comes from the `water` hazard def (data-driven, §5.4).
  const P = (HAZARD_BY_ID.water || { params: {} }).params;
  const TEETER_TIME = P.teeterTime || 0.6;
  const SINK_END = 0.9;
  const DUNK_TIME = P.dunkTime || 1.5;
  const GRACE_TIME = P.grace || 2.0;
  const MIN_HAZ = P.respawnMinHazard || 8;
  const INVULN_TIME = 1.5; // the knockdown's invuln blink (§2.6)
  const TEETER_SPEED_FRAC = 0.4; // on foot below ~40% of top speed -> teeter

  let state = 'idle';
  let t = 0;
  let entryX = 0, entryZ = 0;
  let lastTx = -1, lastTz = -1;
  let grace = 0, invuln = 0, sputter = 0;

  // A small duck (one merged mesh, one draw call) shown on the head on pop-up.
  const duckGeo = (() => {
    const b = new VoxelBuilder(77);
    b.box(0, 0, 0, 0.22, 0.15, 0.32, '#fffaf0');
    b.box(0, 0.11, -0.15, 0.13, 0.13, 0.13, '#fffaf0');
    b.box(0, 0.11, -0.24, 0.06, 0.05, 0.06, '#f4a261');
    return b.toGeometry();
  })();
  let duck = new THREE.Mesh(duckGeo, mat);
  duck.visible = false;
  duck.frustumCulled = false;
  scene.add(duck);

  function tileOf(wx, wz) { return [Math.floor(wx / T), Math.floor(wz / T)]; }
  function isWater(wx, wz) { const c = tileOf(wx, wz); return tm.keyAt(c[0], c[1]) === 'pond'; }
  function maxSpd() { return getMaxSpeed ? getMaxSpeed() : 6; }

  // The active hazards to stay >= MIN_HAZ u from: angry swarms, chasing dogs,
  // skaters (their loop points) and the Watch units.
  const hazPts = [];
  function activeHazardPoints() {
    hazPts.length = 0;
    const hz = getHazards ? getHazards() : null;
    if (hz) {
      if (hz.hiveSt) for (const h of hz.hiveSt) if (h.state === 'angry') hazPts.push(h.x, h.z);
      if (hz.dogSt) for (const d of hz.dogSt) if (d.state === 'chase') hazPts.push(d.x, d.z);
      if (hz.skSt) for (const s of hz.skSt) if (s.x != null) hazPts.push(s.x, s.z);
    }
    if (watch && watch.positions) for (const wp of watch.positions) hazPts.push(wp.x, wp.z);
    return hazPts;
  }

  // Nearest safe park-path (`path`) or sidewalk (`sidewalk`) tile: never a road
  // or the grass right at the edge, >=3u from any water tile, >=MIN_HAZ u from
  // active hazards. Searches outward ring by ring from the entry tile.
  let respawn = { x: 0, z: 0, wx: 0, wz: 0 };
  function findRespawn() {
    const c = tileOf(entryX, entryZ);
    const etx = c[0], etz = c[1];
    const pts = activeHazardPoints();
    let found = false;
    for (let r = 0; r <= 16 && !found; r++) {
      for (let dz = -r; dz <= r && !found; dz++) for (let dx = -r; dx <= r && !found; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue; // this ring only
        const x = etx + dx, z = etz + dz;
        const key = tm.keyAt(x, z);
        if (key !== 'path' && key !== 'sidewalk') continue;
        let nearWater = false; // >=3u from any water tile (a 1-tile ring is ~4u edge-to-edge)
        for (let cz = -1; cz <= 1 && !nearWater; cz++) for (let cx = -1; cx <= 1; cx++) if (tm.keyAt(x + cx, z + cz) === 'pond') { nearWater = true; break; }
        if (nearWater) continue;
        const wx = tm.cx(x), wz = tm.cz(z);
        let nearHaz = false;
        for (let i = 0; i < pts.length; i += 2) { const ddx = wx - pts[i], ddz = wz - pts[i + 1]; if (ddx * ddx + ddz * ddz < MIN_HAZ * MIN_HAZ) { nearHaz = true; break; } }
        if (nearHaz) continue;
        respawn = { x, z, wx, wz };
        found = true;
      }
    }
    if (!found) respawn = { x: etx, z: etz, wx: tm.cx(etx), wz: tm.cz(etz) };
    return respawn;
  }

  function startDunk(p) {
    state = 'dunking'; t = 0;
    p.dunkSink = 1;      // sink the rig to the neck (player.js syncVisuals)
    p.dunked = DUNK_TIME; // stunned underwater for the whole dunk (no swimming off)
    p.teetering = true;  // windmill arms while underwater (the panic flail)
    if (effects) effects.splash(entryX, 0.2, entryZ);
    if (floatText) floatText.pop('SPLOOSH!', entryX, 1, entryZ, { color: '#4cc9f0', burst: true });
    // In a mission: lose the top parcel (it floats away and sinks, "blub") and
    // the streak resets - the same rule as a knockdown drop, so it respects
    // the difficulty's knockdownCostsParcel (on Easy you keep it). Free
    // roam: just the gag.
    const d = getDelivery ? getDelivery() : null;
    if (d && getDiff && getDiff().knockdownCostsParcel) {
      d.dropParcel(false);
      if (floatText) floatText.pop('blub…', entryX + 0.6, 0.5, entryZ + 0.6, { color: '#4cc9f0' });
    }
    if (events) events.emit('dunk');
  }

  function doRespawn(p) {
    const r = findRespawn();
    lastTx = r.x; lastTz = r.z;
    const pond = world.def.pond;
    let hd = 0;
    if (pond) {
      const pcx = (pond.x + pond.w / 2) * T, pcz = (pond.z + pond.d / 2) * T;
      hd = Math.atan2(r.wx - pcx, -(r.wz - pcz)) * 180 / Math.PI; // face away from the water
    }
    p.teleport(r.x, r.z, hd);
    p.dunkSink = 0; p.dunked = 0; p.teetering = false;
    p.grantInvuln(INVULN_TIME); // the knockdown's 1.5 s invuln blink (§2.6)
    sputter = 0.5; // a quick splutter (flailing arms, no knockdown side effects)
    if (effects) effects.splash(r.wx, 0.4, r.wz); // a little dripping
    duck.visible = false;
    invuln = INVULN_TIME; grace = GRACE_TIME;
    state = 'idle';
  }

  function step(dt) {
    const p = getPlayer();
    if (!p) return;
    if (invuln > 0) invuln -= dt;
    if (sputter > 0) { sputter -= dt; p.teetering = sputter > 0; }
    if (grace > 0) {
      grace -= dt;
      // The water tiles act as a wall for the grace window: can't fall back in.
      if (isWater(p.pos.x, p.pos.z) && lastTx >= 0) p.teleport(lastTx, lastTz, (p.heading * 180) / Math.PI);
    }
    const px = p.pos.x, pz = p.pos.z;
    if (state === 'idle') {
      // M15a.14: dunking is a gag, not a knockdown - it triggers on entry
      // even while knockdown-immune (Unstoppable doesn't prevent ponds).
      if (isWater(px, pz) && invuln <= 0) {
        entryX = px; entryZ = pz;
        const onVehicle = getVehId && getVehId() !== 'feet';
        const slow = p.speed < TEETER_SPEED_FRAC * maxSpd();
        if (!onVehicle && slow) { state = 'teeter'; t = 0; p.teetering = true; } // teeter first
        else startDunk(p);
      }
    } else if (state === 'teeter') {
      t += dt;
      if (!isWater(px, pz)) { state = 'idle'; p.teetering = false; } // stopped / turned back: saved
      else if (t >= TEETER_TIME) startDunk(p);
    } else if (state === 'dunking') {
      t += dt;
      const wy = (p.groundY || 0) - 0.2; // the water surface
      if (t - dt < 0.45 && t >= 0.45 && effects) effects.splash(px, wy, pz); // bubble trail
      if (t - dt < SINK_END && t >= SINK_END) duck.visible = true; // the pop-up beat
      if (t >= DUNK_TIME) doRespawn(p);
    }
    // Keep the duck pinned to the courier's head while shown.
    if (duck.visible) duck.position.set(p.pos.x, p.pos.y + DUCK_Y - p.dunkSink * 0.5, p.pos.z);
  }

  // -- shot hooks -------------------------------------------------------------
  function teeterAt(wx, wz) {
    const p = getPlayer();
    if (!p) return false;
    if (wx != null) { p.pos.x = wx; p.pos.z = wz; }
    entryX = p.pos.x; entryZ = p.pos.z;
    state = 'teeter'; t = 0; p.teetering = true;
    return true;
  }
  function forceDunk(wx, wz) {
    const p = getPlayer();
    if (!p) return false;
    if (wx != null) { p.pos.x = wx; p.pos.z = wz; }
    entryX = p.pos.x; entryZ = p.pos.z;
    startDunk(p);
    return true;
  }

  return {
    step,
    get state() { return state; },
    teeterAt,
    forceDunk,
    info() {
      const r = findRespawn();
      return {
        state, t: +t.toFixed(2), grace: +Math.max(0, grace).toFixed(2),
        entry: [ +entryX.toFixed(1), +entryZ.toFixed(1) ],
        respawn: [ r.x, r.z, tm.keyAt(r.x, r.z), +r.wx.toFixed(1), +r.wz.toFixed(1) ],
      };
    },
    dispose() { if (duck) { scene.remove(duck); duck.geometry.dispose(); duck = null; } },
  };
}
