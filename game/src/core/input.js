// §2.2: the input layer maps keys to actions. Game code only ever reads
// actions, never raw keys. Edge-triggered actions report once per press via
// `consume`; `press(action, ms)` lets tests (__pb.press) hold an action for a
// duration of simulation time.

const KEYS = {
  KeyW: 'forward', ArrowUp: 'forward',
  KeyS: 'back', ArrowDown: 'back',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  KeyQ: 'throwLeft', KeyE: 'throwRight',
  Space: 'jump',
  KeyF: 'doorstep',
  ShiftLeft: 'ability', ShiftRight: 'ability',
  Enter: 'confirm',
  Escape: 'pause', KeyP: 'pause',
  KeyM: 'mute',
  Tab: 'map',
};

export function createInput() {
  const held = new Set();
  const edge = new Set();
  const mouse = { x: 0, y: 0, down: false };
  const simHolds = new Array(8).fill(null); // { action, end } — fixed-size, no growth

  function keyAction(e) {
    return e.type === 'keydown' ? KEYS[e.code] : undefined;
  }
  window.addEventListener('keydown', (e) => {
    const a = KEYS[e.code];
    if (!a) return;
    e.preventDefault();
    if (!e.repeat) edge.add(a);
    held.add(a);
  });
  window.addEventListener('keyup', (e) => {
    const a = KEYS[e.code];
    if (a) held.delete(a);
  });
  window.addEventListener('mousedown', (e) => {
    if (e.button === 0) mouse.down = true;
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) mouse.down = false;
  });
  window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });

  // Simulated holds for __pb.press (wall-clock; fine for the step() test
  // flow where the sim is advanced manually right after the press).
  function press(action, ms) {
    let slot = -1;
    let oldestEnd = Infinity;
    for (let i = 0; i < simHolds.length; i++) {
      if (!simHolds[i]) { slot = i; break; }
      if (simHolds[i].end < oldestEnd) { oldestEnd = simHolds[i].end; slot = i; }
    }
    simHolds[slot] = { action, end: performance.now() + ms };
  }

  function heldOrSim(action) {
    if (held.has(action)) return true;
    const now = performance.now();
    for (let i = 0; i < simHolds.length; i++) {
      const h = simHolds[i];
      if (h && h.action === action && now < h.end) return true;
    }
    return false;
  }

  return {
    mouse,
    isHeld: heldOrSim,
    consume(action) {
      if (edge.has(action)) { edge.delete(action); return true; }
      return false;
    },
    clearEdge() { edge.clear(); },
    press,
    // M12: the headless autoplayer holds an action (e.g. the F doorstep) for a run.
    forceHeld(action, on) { if (on) held.add(action); else held.delete(action); },
  };
}
