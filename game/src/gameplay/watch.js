import * as THREE from 'three';
import { MISCHIEF } from '../data/config.js';
import { buildWatchSegway, buildWatchCart } from '../world/mischiefModels.js';

// §2.15: the Neighborhood Watch. The heat system asks us to spawn/release the
// right units for its level (level 2 → Deputy Doug's Segway, level 3 → + the
// golf cart). Each unit chases the courier; stay clear long enough (or 25u)
// and it despawns; touch one and it's BUSTED! (freeze + ticket + penalty).
//
// env = { scene, mat, colors, heat, get player(), onBusted(level) }

const CFG = MISCHIEF.watch;
const CLEAR_DIST = 12;

export function createWatch(env) {
  const { scene, mat, colors, heat } = env;
  const W = MISCHIEF;
  const units = [
    { kind: 'segway', speed: CFG.segway.speed, radius: CFG.segway.radius },
    { kind: 'cart', speed: CFG.cart.speed, radius: CFG.cart.radius },
  ];
  const state = [null, null]; // { group, arm, x, z, clearT, lastTouch, bustCd }

  function spawn(i) {
    if (state[i]) return state[i];
    const model = i === 0 ? buildWatchSegway(mat, colors) : buildWatchCart(mat, colors);
    const p = env.player.pos;
    const g = model.group;
    g.position.set(p.x + (i === 0 ? 6 : -6), 0, p.z + 4);
    scene.add(g);
    const s = { group: g, arm: model.arm, x: g.position.x, z: g.position.z, clearT: 0, lastTouch: -99, bustCd: 0 };
    state[i] = s;
    return s;
  }
  function remove(i) {
    if (state[i]) { scene.remove(state[i].group); state[i].group = null; state[i] = null; }
  }

  function step(dt) {
    const p = env.player.pos;
    for (let i = 0; i < 2; i++) {
      const s = state[i];
      if (!s) continue;
      const u = units[i];
      s.bustCd = Math.max(0, s.bustCd - dt);
      const dx = p.x - s.x, dz = p.z - s.z;
      const d = Math.hypot(dx, dz);
      // Chase the courier (no pathing — a straight-line cartoon pursuit).
      // M15a.12: the difficulty's watchSpeedMul scales the pursuit speed.
      const mul = env.watchSpeedMul ? env.watchSpeedMul() : 1;
      if (d > 0.4) {
        s.x += (dx / d) * u.speed * mul * dt;
        s.z += (dz / d) * u.speed * mul * dt;
      }
      s.group.position.set(s.x, 0, s.z);
      s.group.rotation.y = Math.atan2(dx, -dz);
      if (s.arm) s.arm.rotation.z = 1.8 + Math.sin(s.bustCd * 6) * 0.2;
      // BUSTED: touch the courier (with a per-unit cooldown).
      if (d < u.radius && s.bustCd <= 0) { s.bustCd = 2.5; s.lastTouch = nowT(); env.onBusted(i); }
      // Losing them: 25u apart = immediate; else stay clear for loseAfterSec.
      if (d > CFG.loseRadius) { heat.unitLost(i); continue; }
      if (d > CLEAR_DIST) s.clearT += dt; else s.clearT = 0;
      if (s.clearT > CFG.loseAfterSec) heat.unitLost(i);
    }
  }

  let _t = 0;
  function nowT() { return _t; }
  function tickClock(dt) { _t += dt; }

  function reset() { for (let i = 0; i < 2; i++) remove(i); }

  // §2.18: dispose any active unit's geometry on unload (the segway/cart geos
  // are built per spawn; the shared `mat` is disposed with the world).
  function dispose() {
    for (let i = 0; i < 2; i++) {
      if (state[i]) {
        scene.remove(state[i].group);
        state[i].group.traverse((o) => { if (o.isMesh && o.geometry) o.geometry.dispose(); });
        state[i] = null;
      }
    }
  }

  return {
    dispose,
    spawn, remove, reset,
    step: (dt) => { tickClock(dt); step(dt); },
    get active() { let n = 0; for (let i = 0; i < 2; i++) if (state[i]) n++; return n; },
    get positions() { const out = []; for (let i = 0; i < 2; i++) if (state[i]) out.push({ x: state[i].x, z: state[i].z }); return out; },
  };
}
