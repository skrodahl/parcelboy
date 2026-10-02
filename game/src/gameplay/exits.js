import * as THREE from 'three';

// §2.18: a suburb's exits — the off-map-edge road gaps that travel to another
// suburb. Each exit is `{ id, to, edge, tiles: [[x,z],...], entry?, unlockStars? }`.
// An exit with `unlockStars` is a locked barrier until the player has that many
// total stars; an exit whose target suburb doesn't exist yet is also locked.
// `onExitTile(pos)` (allocation-free, called each sim tick) reports which exit
// (if any) the courier is standing on so main.js can raise the travel prompt.

// `grants` (M15a.12): a live predicate — when the current difficulty grants
// neighborhoods, every exit is open regardless of stars.
export function createExits(world, save, grants) {
  const def = world.def;
  const tm = world.tilemap;
  const T = tm.tileSize;
  const exits = (def.exits || []).map((e) => ({
    ...e,
    // the exit's tile rect as a Set of "x,z" keys (allocation-free lookups).
    tiles: new Set((e.tiles || []).map(([x, z]) => x + ',' + z)),
  }));
  if (!exits.length) {
    return {
      exits: [],
      onExitTile: () => null,
      unlocked: () => true,
      lockedStars: () => 0,
      travel: () => {},
    };
  }

  function tileOf(wx, wz) {
    const x = (wx / T) | 0, z = (wz / T) | 0;
    return x + ',' + z;
  }

  function onExitTile(pos) {
    const t = tileOf(pos.x, pos.z);
    for (let i = 0; i < exits.length; i++) if (exits[i].tiles.has(t)) return exits[i];
    return null;
  }

  // Total stars earned across every shift (best is per-shift {score, stars}).
  function totalStars() {
    const best = (save && save.best) || {};
    let n = 0;
    for (const k of Object.keys(best)) n += (best[k] && best[k].stars) || 0;
    return n;
  }

  function isUnlocked(e) {
    // M15a.12: the current difficulty may grant all neighborhoods (open exits).
    if (grants && grants()) return true;
    // A locked exit: needs its stars AND the target must be a known suburb.
    const need = e.unlockStars || 0;
    if (need > 0 && totalStars() < need) return false;
    return true;
  }

  return {
    exits,
    onExitTile,
    isUnlocked,
    totalStars,
  };
}
