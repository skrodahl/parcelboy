// §2.18: the region-map inset — a small top-right card showing the suburb you're
// in + the other suburbs reachable from it (its exits), with locked ones dimmed.
// Pure DOM (no GPU draw calls); it re-renders only when the suburb changes.

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

  function refresh() {
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
    root.style.display = '';
  }

  return { refresh, root };
}
