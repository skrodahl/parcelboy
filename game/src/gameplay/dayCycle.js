// §2.13: the free-roam day cycle. Free roam slowly blends through
// morning → noon → golden → dusk → back to morning; each preset is held for
// `minutesPerPhase` then blended into the next over `blendTime` seconds.
// Blending interpolates every numeric + color field of the two presets into one
// preallocated scratch preset (no per-frame allocations). While blending, the
// static shadow map is refreshed at most every 2 s. A mission snaps to its own
// time of day (handled in main.js); this module only drives free roam.
import * as THREE from 'three';
import { TIMES_OF_DAY } from '../data/timeOfDay.js';

const COLOR_KEYS = ['sunColor', 'hemiSky', 'hemiGround', 'skyZenith', 'skyHorizon'];
const NUM_KEYS = ['sunIntensity', 'hemiIntensity', 'glow', 'autumn'];

export function createDayCycle({ lighting, sky, world, minutesPerPhase = 2, blendTime = 30 }) {
  const N = TIMES_OF_DAY.length;
  const hold = minutesPerPhase * 60;
  const scratch = Object.assign({}, TIMES_OF_DAY[0]);
  scratch.sunDir = [TIMES_OF_DAY[0].sunDir[0], TIMES_OF_DAY[0].sunDir[1], TIMES_OF_DAY[0].sunDir[2]];
  const cScratch = {}; for (const k of COLOR_KEYS) cScratch[k] = new THREE.Color(TIMES_OF_DAY[0][k]);
  const cA = new THREE.Color(), cB = new THREE.Color();

  let phase = 0, mode = 'hold', modeT = 0, shadowGap = -2;

  // M15a.15: re-apply only when the blend actually moved — a HELD time of day
  // costs nothing. The last-applied values live in preallocated scratch (no
  // per-frame allocation); the glow color attribute is the big upload, so it
  // gets its own coarser 0.01 step (its value changes slowly during a blend).
  const lastNum = {}; for (const k of NUM_KEYS) lastNum[k] = 0;
  const lastCol = {}; for (const k of COLOR_KEYS) lastCol[k] = new THREE.Color();
  const lastSun = [0, 0, 0];
  let appliedOnce = false;
  let lastGlow = NaN;

  function moved() {
    if (!appliedOnce) return true;
    for (const k of NUM_KEYS) if (Math.abs(scratch[k] - lastNum[k]) > 0.01) return true;
    for (const k of COLOR_KEYS) {
      const a = scratch[k], b = lastCol[k];
      if (Math.abs(a.r - b.r) > 0.004 || Math.abs(a.g - b.g) > 0.004 || Math.abs(a.b - b.b) > 0.004) return true;
    }
    for (let i = 0; i < 3; i++) if (Math.abs(scratch.sunDir[i] - lastSun[i]) > 0.001) return true;
    return false;
  }
  function commit() {
    for (const k of NUM_KEYS) lastNum[k] = scratch[k];
    for (const k of COLOR_KEYS) lastCol[k].copy(scratch[k]);
    for (let i = 0; i < 3; i++) lastSun[i] = scratch.sunDir[i];
    appliedOnce = true;
  }

  function apply() {
    if (!moved()) return; // held preset: nothing re-applied this frame
    lighting.apply(scratch);
    if (sky) sky.apply(scratch);
    if (world && world.pools) world.pools.mesh.visible = scratch.glow > 0.15;
    if (world && world.glowMesh && (!isFinite(lastGlow) || Math.abs(scratch.glow - lastGlow) > 0.01)) {
      world.glowMesh.geometry.__setGlowBlend(scratch.glow);
      lastGlow = scratch.glow;
    }
    commit();
  }

  // Write the preset blended between source `phase` and the next, by `frac`,
  // into the scratch + apply it (used both by the live tick and the shot hook).
  function setPhase(i, frac) {
    phase = ((i % N) + N) % N;
    const a = TIMES_OF_DAY[phase], b = TIMES_OF_DAY[(phase + 1) % N];
    frac = Math.max(0, Math.min(1, frac));
    for (const k of NUM_KEYS) scratch[k] = a[k] + (b[k] - a[k]) * frac;
    for (const k of COLOR_KEYS) { cA.set(a[k]); cB.set(b[k]); cScratch[k].copy(cA).lerp(cB, frac); scratch[k] = cScratch[k]; }
    scratch.sunDir[0] = a.sunDir[0] + (b.sunDir[0] - a.sunDir[0]) * frac;
    scratch.sunDir[1] = a.sunDir[1] + (b.sunDir[1] - a.sunDir[1]) * frac;
    scratch.sunDir[2] = a.sunDir[2] + (b.sunDir[2] - a.sunDir[2]) * frac;
    apply();
  }

  function tick(dt) {
    if (mode === 'hold') {
      modeT += dt;
      if (modeT >= hold) { mode = 'blend'; modeT = 0; shadowGap = -2; }
    } else {
      modeT += dt;
      const f = Math.min(1, modeT / blendTime);
      setPhase(phase, f);
      if (lighting && lighting.sun && lighting.sun.shadow && lighting.sun.shadow.map && modeT - shadowGap >= 2) {
        lighting.sun.shadow.map.needsUpdate = true;
        shadowGap = modeT;
      }
      if (f >= 1) { phase = (phase + 1) % N; mode = 'hold'; modeT = 0; }
    }
  }

  return {
    tick,
    setPhase,
    get phase() { return phase; },
    // Start the cycle at the boot/mission preset (frac 0 = fully that preset).
    startAt(id) { let i = 0; for (let k = 0; k < N; k++) if (TIMES_OF_DAY[k].id === id) i = k; mode = 'hold'; modeT = 0; setPhase(i, 0); },
  };
}
