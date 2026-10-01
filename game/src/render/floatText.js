import * as THREE from 'three';

// §10 floating texts + §2.12 onomatopoeia. Pooled DOM elements (max N),
// positioned each frame by projecting the world position (transform only).
// Two styles from the same pool: `text` (result words) and `burst` (jagged
// comic popups). Pop in, rise, and fade over ~0.9 s.
export function createFloatText(container, camera, renderer) {
  const N = 12;
  const items = new Array(N);
  for (let i = 0; i < N; i++) {
    const el = document.createElement('div');
    el.className = 'pb-float';
    el.style.display = 'none';
    container.appendChild(el);
    items[i] = { active: false, wx: 0, wy: 0, wz: 0, life: 0, max: 0.9, burst: false, el };
  }
  const v = new THREE.Vector3();
  let cursor = 0;

  // text, world (x,y,z), opts = { burst, color }.
  function pop(text, wx, wy, wz, opts) {
    let slot = -1;
    for (let i = 0; i < N; i++) if (!items[i].active) { slot = i; break; }
    if (slot < 0) slot = cursor;
    cursor = (cursor + 1) % N;
    const it = items[slot];
    const el = it.el;
    it.active = true;
    it.wx = wx; it.wy = wy; it.wz = wz;
    it.life = 0; it.max = (opts && opts.life) || 0.9;
    it.burst = !!opts && opts.burst;
    el.className = 'pb-float ' + (it.burst ? 'pb-burst' : 'pb-text');
    el.textContent = text;
    // The elements are pooled: reset both inline colors so a reused slot can't
    // carry the previous pop's style. For a burst, opts.color is the badge
    // *background* (the text stays the dark #22223b from CSS, so it reads on
    // any badge color); for plain text it's the text color.
    el.style.color = '';
    el.style.backgroundColor = '';
    if (it.burst) { if (opts && opts.color) el.style.backgroundColor = opts.color; }
    else if (opts && opts.color) el.style.color = opts.color;
    el.style.opacity = '1';
    el.style.display = 'block';
    return it;
  }

  function step(dt) {
    for (let i = 0; i < N; i++) {
      const it = items[i];
      if (!it.active) continue;
      it.life += dt;
      if (it.life >= it.max) { it.active = false; it.el.style.display = 'none'; }
    }
  }

  // Project live text to screen space (runs every frame, even while paused).
  function sync() {
    const w = renderer.domElement.clientWidth;
    const h = renderer.domElement.clientHeight;
    for (let i = 0; i < N; i++) {
      const it = items[i];
      if (!it.active) continue;
      const el = it.el;
      const k = it.life / it.max;
      v.set(it.wx, it.wy, it.wz).project(camera);
      if (v.z > 1) { el.style.opacity = '0'; continue; } // behind the camera
      const sx = (v.x * 0.5 + 0.5) * w;
      const sy = (-v.y * 0.5 + 0.5) * h;
      if (it.burst) {
        // Overshoot scale 0 -> 1.3 -> 1, then a brief shake.
        let scale;
        if (k < 0.18) scale = (k / 0.18) * 1.3;
        else if (k < 0.34) scale = 1.3 - ((k - 0.18) / 0.16) * 0.3;
        else scale = 1.0;
        const shake = (k > 0.68 && k < 0.85) ? Math.sin(it.life * 90) * 2.5 : 0;
        const rot = -5 + (k > 0.68 ? Math.sin(it.life * 40) * 2 : 0);
        el.style.transform = `translate(${sx + shake}px, ${sy}px) translate(-50%,-50%) scale(${scale}) rotate(${rot}deg)`;
        el.style.opacity = k < 0.7 ? '1' : String((1 - k) / 0.3);
      } else {
        const scale = k < 0.15 ? 0.5 + (k / 0.15) * 0.5 : 1.0;
        const rise = 26 * k;
        el.style.transform = `translate(${sx}px, ${sy - rise}px) translate(-50%,-50%) scale(${scale})`;
        el.style.opacity = k < 0.6 ? '1' : String((1 - k) / 0.4);
      }
    }
  }

  function clear() {
    for (let i = 0; i < N; i++) { items[i].active = false; items[i].el.style.display = 'none'; }
  }

  return { pop, step, sync, clear };
}
