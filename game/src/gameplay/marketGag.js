// §2.18 M17: the market-stall fruit gag. "Bowl into fruit" — when the courier
// passes a market stall, the colorful fruit crates scatter: a cartoon fruit
// burst + a comic "FRUIT!" pop + a small heat bump. Throttled per stall. Pure
// slapstick flavor; the stalls themselves are baked into the town chunk (no
// extra draw calls). The module reads the live world/heat via getters, so it
// stays valid across suburb travel (re-scans its stalls once per suburb).
export function createMarketGag(env) {
  const FRUIT_HEAT = 0.15; // a small mischief bump (the fruit-gag heat)
  const CD = 2.6;         // per-stall cooldown (s)
  const BOWL2 = 3.6 * 3.6; // squared bowl radius (~3.6u of the counter)
  let stalls = null;      // { cx, cz, cy, cd }[] for the current suburb
  let lastNb = '';

  function rescan(w) {
    stalls = [];
    const T = w.tilemap.tileSize;
    const bs = w.def.buildings || [];
    for (let i = 0; i < bs.length; i++) {
      const b = bs[i];
      if (b.kind !== 'marketstall') continue;
      stalls.push({ cx: (b.x + b.w / 2) * T, cz: (b.z + b.d / 2) * T, cy: 1.2, cd: 0 });
    }
  }

  function tick(dt) {
    const w = env.getWorld();
    const pl = env.getPlayer();
    if (!w || !pl) return;
    if (w.def.id !== lastNb) { lastNb = w.def.id; rescan(w); } // one-time re-scan on travel
    if (!stalls || !stalls.length) return;
    const px = pl.pos.x, pz = pl.pos.z;
    for (let i = 0; i < stalls.length; i++) {
      const s = stalls[i];
      if (s.cd > 0) s.cd -= dt;
      const dx = px - s.cx, dz = pz - s.cz;
      if (s.cd <= 0 && dx * dx + dz * dz < BOWL2) {
        s.cd = CD;
        if (env.effects && env.effects.fruit) env.effects.fruit(s.cx, s.cy, s.cz);
        if (env.floatText) env.floatText.pop('FRUIT!', s.cx, 2.4, s.cz, { color: '#ffd166' });
        const h = env.getHeat ? env.getHeat() : null;
        if (h) h.add(FRUIT_HEAT);
      }
    }
  }

  function reset() { if (stalls) for (const s of stalls) s.cd = 0; }

  return { tick, reset };
}
