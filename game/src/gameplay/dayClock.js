// §2.20 / M15a.11: the world day clock. One clock drives the whole neighborhood:
// the day (06:00–24:00) runs at 1 game hour = 60 real seconds, and the night
// (00:00–06:00) is compressed so it passes in 60 real seconds total (6× faster).
// It is the single source of truth for the time-of-day mood (M15a.11: the clock
// no longer gates shift access — it runs always, in free roam and missions).
// No per-frame allocations: the preset blend is read from a fixed keyframe table
// into a preallocated slot.
const _blend = { idx: 0, frac: 0 };

// Time-of-day keyframes: [gameMinute, presetIndex]. Each segment blends from the
// start preset to the end preset; equal indices = a hold. Every transition is
// forward in the cycle (morning0→noon1→golden2→dusk3→morning0, wrapping), so
// dayCycle.setPhase(idx, frac) (which blends idx → (idx+1)%4) is correct.
const TOD_KEYS = [
  [0, 3],     // 00:00 dusk (night holds dark)
  [270, 3],   // 04:30 dusk
  [360, 0],   // 06:00 morning  (dusk→morning 04:30–06:00)
  [600, 0],   // 10:00 morning  (hold 06:00–10:00)
  [660, 1],   // 11:00 noon     (morning→noon 10:00–11:00)
  [900, 1],   // 15:00 noon     (hold 11:00–15:00)
  [960, 2],   // 16:00 golden   (noon→golden 15:00–16:00)
  [1140, 2],  // 19:00 golden   (hold 16:00–19:00)
  [1170, 3],  // 19:30 dusk     (golden→dusk 19:00–19:30)
  [1440, 3],  // 24:00 dusk     (hold 19:30–24:00, then night)
];
const NK = TOD_KEYS.length;

export function createDayClock(save = null) {
  // Game minutes since 00:00 (0..1440). Restore from the save when present so
  // the clock survives a reload (§2.20 / §2.11). A fresh save starts at 06:00.
  let min = 360;
  if (save && typeof save.clock === 'number' && isFinite(save.clock)) {
    min = save.clock; if (min < 0) min += 1440; min %= 1440;
  }

  function isNight() { return min < 360; }

  // §2.20: 1 game hour = 60 real s in the day; the night (00:00–06:00) passes
  // in 60 s total, so it runs 6× faster.
  function tick(dt) {
    const rate = isNight() ? 6 : 1; // game minutes per real second
    min += dt * rate;
    if (min >= 1440) min -= 1440;
  }

  // §2.20: the current time-of-day preset + blend frac, from the clock.
  function presetBlend() {
    let idx = 3, frac = 0;
    for (let i = 0; i < NK - 1; i++) {
      if (min >= TOD_KEYS[i][0] && min < TOD_KEYS[i + 1][0]) {
        const a = TOD_KEYS[i][0], a1 = TOD_KEYS[i + 1][0];
        idx = TOD_KEYS[i][1];
        const ib = TOD_KEYS[i + 1][1];
        frac = (ib === idx || a1 === a) ? 0 : (min - a) / (a1 - a);
        break;
      }
    }
    _blend.idx = idx; _blend.frac = frac;
    return _blend;
  }

  // §2.20: "10:24" — the clock shown on the HUD.
  function timeStr() {
    const h = Math.floor(min / 60), mm = Math.floor(min % 60);
    return (h < 10 ? '0' : '') + h + ':' + (mm < 10 ? '0' + mm : mm);
  }

  return {
    tick, presetBlend, timeStr,
    get min() { return min; },
    set min(v) { min = ((v % 1440) + 1440) % 1440; },
    get isNight() { return isNight(); },
    get hour() { return Math.floor(min / 60); },
  };
}
