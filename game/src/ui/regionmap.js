// §2.18 / M15a.8: the region-map card — the suburb you're in + the other suburbs
// reachable from it (its exits), with locked ones dimmed. M15a.8: it lives in
// the Tab FULL MAP, not the permanent HUD (it used to cover the panels). Pure
// DOM (no GPU draw calls); it re-renders only when the suburb changes.
// Hidden by default; `show()` is called when the full map opens.

function make(cls, text) {
  const e = document.createElement('div');
  e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

export function createRegionMap(ui, getWorld) {
  const root = make('nb-region-map');
  root.style.display = 'none';
  ui.appendChild(root);
  let shown = false;

  function render() {
    const w = getWorld();
    if (!w || !w.def || !(w.def.exits || []).length) { root.style.display = 'none'; return; }
    const def = w.def;
    root.innerHTML = '';
    const title = make('nb-region-title', def.name);
    const row = make('nb-region-places');
    // the place you're in, then every exit's target (locked ones dimmed).
    row.appendChild(make('nb-region-place current', def.name));
    for (const e of def.exits) {
      const target = e.name || e.to;
      const locked = e.unlockStars && e.unlockStars > 0 && e.starsMet === false;
      const chip = make('nb-region-place' + (locked ? ' locked' : ''), (locked ? '· ' : '') + target);
      row.appendChild(chip);
    }
    root.append(title, row);
  }
  function apply() { root.style.display = (shown) ? '' : 'none'; }
  // Refresh the content; only visible while the full map is open.
  function refresh() { render(); apply(); }
  function show() { shown = true; render(); apply(); }
  function hide() { shown = false; root.style.display = 'none'; }

  return { refresh, show, hide, root };
}
