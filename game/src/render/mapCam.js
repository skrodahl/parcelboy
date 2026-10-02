// M15a.18: the full map's top-down camera. It reuses the single perspective
// camera (the follow cam's) but drives it straight down: position (panX, height,
// panZ + a hair of south) looking at (panX, 0, panZ), so screen-up is north and
// screen-right is east. Zoom lowers/raises `height`; pan moves the target;
// everything eases each frame with preallocated scratch (no allocation).

export function createMapCam(camera, camLook) {
  const goal = { x: 0, z: 0, h: 150 }; // where the pan + zoom ease toward
  const cur = { x: 0, z: 0, h: 150 };  // the camera's live x/z + height
  const MIN_H = 22, MAX_H = 240;
  let active = false;

  function clampH(h) { return h < MIN_H ? MIN_H : (h > MAX_H ? MAX_H : h); }

  function apply() {
    // The +0.5 south offset keeps lookAt from the degenerate straight-down
    // case (up vector parallel to the view axis) while staying top-down.
    camera.position.set(cur.x, cur.h, cur.z + 0.5);
    camera.up.set(0, 1, 0);
    camera.lookAt(cur.x, 0, cur.z);
    camLook.set(cur.x, 0, cur.z); // fog + far clip read this (§7.3)
  }

  function enter(px, pz, h) {
    active = true;
    cur.x = goal.x = px;
    cur.z = goal.z = pz;
    cur.h = goal.h = clampH(h != null ? h : 150);
    apply();
  }
  function exit() { active = false; }
  function isActive() { return active; }
  function recenter(px, pz) { goal.x = px; goal.z = pz; }
  function pan(dx, dz) { goal.x += dx; goal.z += dz; }
  function zoom(f) { goal.h = clampH(goal.h / f); } // f>1 zooms in, f<1 out
  function setZoom(h) { goal.h = clampH(h); }

  function update(dt) {
    if (!active) return;
    const k = 1 - Math.exp(-7 * dt);
    const kh = 1 - Math.exp(-9 * dt);
    cur.x += (goal.x - cur.x) * k;
    cur.z += (goal.z - cur.z) * k;
    cur.h += (goal.h - cur.h) * kh;
    if (Math.abs(cur.h - goal.h) < 0.03) cur.h = goal.h;
    apply();
  }

  return { enter, exit, isActive, recenter, pan, zoom, setZoom, update, height: () => cur.h };
}
