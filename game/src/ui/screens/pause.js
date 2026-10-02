// M15a.13: the pause hub's row panel — the left-third of the screen, the paused
// world visible behind it, in the action-strip's visual language. ↑/↓ (W/S)
// move, F/ENTER choose, mouse works too. Esc/P is consumed by main.update()
// (resume / open), so this panel only drives the row highlight + selection.
function el(tag, cls, txt) { const n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; }

export function createPausePanel(container, ctx) {
  const { el: E, isInMission, getBowled, difficultyName, actions } = ctx;
  let focus = 0;
  let rows = [];        // { el, action, enabled }
  let rowEls = [];

  // Build the row set (once, on open). Restart / Clock-out only in a mission.
  function buildRows() {
    const inM = isInMission ? isInMission() : false;
    rows = [
      { label: 'Resume', icon: '▶', action: 'resume' },
    ];
    if (inM) rows.push({ label: 'Restart mission', icon: '↻', action: 'restart' });
    if (inM) rows.push({ label: 'Clock out early', icon: '⎋', action: 'clockout' });
    rows.push(
      { label: 'Career', icon: '🏆', action: 'career' },
      { label: 'Settings', icon: '⚙', action: 'settings' },
      { label: 'How to play', icon: '?', action: 'howto' },
      { label: 'Save & quit to title', icon: '⏏', action: 'quit' },
    );
  }

  function render() {
    buildRows(); // (re)build the row set for the current mission state
    container.textContent = '';
    const panel = E('div', 'pause-panel');
    panel.append(E('div', 'pause-title', 'Paused'));
    if (difficultyName) panel.append(E('div', 'pause-diff', 'Playing on ' + difficultyName()));
    if (getBowled != null) panel.append(E('div', 'pause-sub', 'People bowled: ' + getBowled()));
    const list = E('div', 'pause-rows');
    rowEls = [];
    for (const r of rows) {
      const it = E('div', 'pause-row');
      it.append(E('span', 'pause-row-key', r.icon), E('span', 'pause-row-label', r.label));
      it.addEventListener('click', () => { focus = rowEls.indexOf(it); select(); });
      list.append(it);
      rowEls.push(it);
    }
    panel.append(list, E('div', 'select-hint', '[↑][↓] choose · [F] select · [Esc] resume'));
    container.append(panel);
    focus = 0;
    paint();
  }
  function paint() {
    for (let i = 0; i < rowEls.length; i++) rowEls[i].classList.toggle('sel', i === focus);
  }
  function move(dir) {
    if (!rows.length) return;
    focus = (focus + dir + rows.length) % rows.length;
    paint();
  }
  function select() {
    const r = rows[focus];
    if (r && actions) actions[r.action];
  }
  function handleKey(e) {
    const c = e.code;
    if (c === 'ArrowUp' || c === 'KeyW') move(-1);
    else if (c === 'ArrowDown' || c === 'KeyS') move(1);
    else if (c === 'Enter' || c === 'KeyF') select();
  }

  render();
  return { render, handleKey, move, select, get focus() { return focus; } };
}
