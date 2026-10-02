import { DIFFICULTIES } from '../data/difficulties.js';

// M15a.12: the Doom-style difficulty select. A vertical list, the highlighted
// line marked by the courier's face at its left; the face gets more frazzled
// down the list (smile → sweat → panic → dizzy → Santa hat + spinning eyes).
// Built entirely in code (a small canvas face, no image files). ←/↑/↓ move,
// F/ENTER pick; picking a level with a `warning` shows the Doom-style confirm.
// No per-frame allocation (faces are drawn once; selection only toggles classes).

function el(tag, cls, txt) { const n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; }

// A small voxel-cartoon face. `key` ∈ smile|sweat|panic|dizzy|santa.
export function drawFace(canvas, key) {
  const c = canvas.getContext('2d');
  const s = canvas.width; // square
  c.clearRect(0, 0, s, s);
  const cx = s / 2, cy = s / 2, r = s * 0.42;
  // head
  c.fillStyle = '#ffd7a8';
  c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill();
  c.lineWidth = 2; c.strokeStyle = '#22223b'; c.stroke();
  c.strokeStyle = '#22223b'; c.fillStyle = '#22223b';
  const eyeY = cy - r * 0.18, ex = r * 0.42;
  if (key === 'dizzy') {
    // spiral eyes
    for (const side of [-1, 1]) {
      c.lineWidth = 2; c.beginPath();
      for (let a = 0; a < Math.PI * 4; a += 0.3) { const rr = (a / (Math.PI * 4)) * r * 0.28; c.lineTo(cx + side * ex + Math.cos(a) * rr, eyeY + Math.sin(a) * rr); }
      c.stroke();
    }
  } else if (key === 'panic') {
    for (const side of [-1, 1]) { c.beginPath(); c.arc(cx + side * ex, eyeY, r * 0.2, 0, Math.PI * 2); c.stroke(); c.beginPath(); c.arc(cx + side * ex, eyeY, r * 0.06, 0, Math.PI * 2); c.fill(); }
  } else { // smile / sweat (calm eyes)
    for (const side of [-1, 1]) { c.beginPath(); c.arc(cx + side * ex, eyeY, r * 0.08, 0, Math.PI * 2); c.fill(); }
  }
  // mouth
  c.lineWidth = 2; c.beginPath();
  const my = cy + r * 0.35;
  if (key === 'panic' || key === 'dizzy') { c.arc(cx, my, r * 0.18, 0, Math.PI * 2); c.stroke(); }
  else if (key === 'sweat') { for (let i = -3; i <= 3; i++) { c.moveTo(cx + i * r * 0.09 - r * 0.045, my); c.lineTo(cx + i * r * 0.09 + r * 0.045, my + (i % 2 ? 4 : -4)); } c.stroke(); }
  else { c.arc(cx, my - r * 0.1, r * 0.4, Math.PI * 0.15, Math.PI * 0.85); c.stroke(); }
  // extras
  if (key === 'sweat') { c.fillStyle = '#4cc9f0'; c.beginPath(); c.arc(cx + r * 0.7, cy - r * 0.55, s * 0.05, 0, Math.PI * 2); c.fill(); }
  if (key === 'santa') {
    // a red Santa hat tilted on top
    c.fillStyle = '#e63946'; c.beginPath();
    c.moveTo(cx - r * 0.9, cy - r * 0.5); c.lineTo(cx + r * 0.9, cy - r * 0.7); c.lineTo(cx + r * 0.55, cy - r * 0.95); c.closePath(); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(cx + r * 0.6, cy - r * 0.95, s * 0.06, 0, Math.PI * 2); c.fill();
  }
}

// The Doom-style list. `container` is the on-screen DOM node; returns { handleKey,
// current(), select() } + wires F/ENTER confirm. `ctx.onPick(id)` fires on a
// confirmed pick; `ctx.el` is the element factory.
export function createDifficultyList(container, ctx) {
  const elF = ctx.el || el;
  // Doom default: the highlighted line opens on the middle level (Ship Me Plenty,
  // `hard`), not on the saved difficulty.
  let focus = DIFFICULTIES.findIndex((d) => d.id === 'hard');
  if (focus < 0) focus = 0;
  let confirming = false;
  const list = elF('div', 'diff-list');
  const rows = [];
  for (const d of DIFFICULTIES) {
    const row = elF('div', 'diff-row');
    const face = elF('canvas', 'diff-face');
    face.width = 48; face.height = 48;
    drawFace(face, d.face);
    const name = elF('div', 'diff-name', d.name);
    const desc = elF('div', 'diff-desc', grantsText(d));
    row.append(face, name, desc);
    list.append(row);
    rows.push(row);
  }
  const confirm = elF('div', 'diff-confirm', '');
  const hint = elF('div', 'diff-hint', '↑/↓ choose · F/ENTER pick · ESC back');
  container.append(list, confirm, hint);

  function grantsText(d) {
    if (d.grants.neighborhoods) return 'Everything unlocked · gentler hazards';
    if (d.grants.missions) return d.grants.characters ? 'All missions + couriers/vehicles' : 'All missions · couriers/vehicles by coins';
    return d.id === 'holiday' ? 'Everything earned · the hardest, and it\'s festive' : 'Everything earned · the standard run';
  }

  function render() {
    for (let i = 0; i < rows.length; i++) rows[i].classList.toggle('active', i === focus);
    if (!confirming) { confirm.style.display = 'none'; confirm.textContent = ''; }
  }
  function move(dir) { focus = (focus + dir + DIFFICULTIES.length) % DIFFICULTIES.length; render(); }
  function current() { return DIFFICULTIES[focus].id; }
  function select() {
    const d = DIFFICULTIES[focus];
    if (d.warning && !confirming) { confirming = true; confirm.style.display = 'block'; confirm.textContent = d.warning; render(); return; }
    confirming = false;
    ctx.onPick(d.id);
  }
  function handleKey(e) {
    const code = e.code;
    if (confirming) {
      if (code === 'Enter' || code === 'KeyF') select();
      else if (code === 'Escape') { confirming = false; render(); }
      return;
    }
    if (code === 'ArrowUp' || code === 'KeyW') move(-1);
    else if (code === 'ArrowDown' || code === 'KeyS') move(1);
    else if (code === 'Enter' || code === 'KeyF') select();
    else if (code === 'Escape') ctx.onCancel && ctx.onCancel();
  }
  render();
  return { handleKey, current, select, get confirming() { return confirming; } };
}
