const STEP = 1 / 60;
const MAX_STEPS = 4;
const FPS_WINDOW = 120;

// Fixed-step simulation (60 Hz) with a frame-rate capped renderer.
// update(dt) runs in fixed steps; render() only when the frame cap allows.
// M15a.18: `getFps` (optional) is polled each frame so the cap can drop to
// 30 fps while the full map is open (the sim still runs at 60 Hz).
export function createLoop({ update, render, targetFps = 60, getFps }) {
  let acc = 0;
  let lastTime = 0;
  let lastRender = 0;
  let rafId = 0;
  let running = false;

  // Preallocated ring buffer of render timestamps (no per-frame allocation).
  const times = new Float64Array(FPS_WINDOW);
  let tIdx = 0;
  let tCount = 0;

  function newest() {
    return times[(tIdx - 1 + FPS_WINDOW) % FPS_WINDOW];
  }
  function oldest() {
    return times[(tIdx - Math.min(tCount, FPS_WINDOW) + FPS_WINDOW) % FPS_WINDOW];
  }

  // FPS of the (capped) rendered frames, over the last up-to-120 renders.
  function fps() {
    if (tCount < 2) return 0;
    const n = Math.min(tCount, FPS_WINDOW);
    return Math.round((n - 1) / ((newest() - oldest()) / 1000));
  }
  function frameMs() {
    if (tCount < 2) return 0;
    const n = Math.min(tCount, FPS_WINDOW);
    return Number(((newest() - oldest()) / (n - 1)).toFixed(1));
  }

  function frame(now) {
    rafId = requestAnimationFrame(frame);
    let dt = (now - lastTime) / 1000;
    lastTime = now;
    if (dt > STEP * MAX_STEPS) dt = STEP * MAX_STEPS; // drop the rest: no spiral of death
    acc += dt;
    let steps = 0;
    while (acc >= STEP && steps < MAX_STEPS) {
      update(STEP);
      acc -= STEP;
      steps++;
    }
    const cap = getFps ? getFps() : targetFps;
    if (now - lastRender >= 1000 / cap - 1) {
      lastRender = now;
      render();
      times[tIdx] = now;
      tIdx = (tIdx + 1) % FPS_WINDOW;
      tCount++;
    }
  }

  function start() {
    if (running) return;
    running = true;
    lastTime = performance.now();
    rafId = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    cancelAnimationFrame(rafId);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else start(); // lastTime resets inside start(): no giant delta
  });

  start();
  return { fps, frameMs, stop };
}
