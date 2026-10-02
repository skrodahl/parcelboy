// §2.11: the save-backed progression. Wraps the save data from core/save.js
// into the API the rest of the game (main.js + the M8 screens) already use:
// coins / stars / canBuy / canStart / buy / earn, plus the M10 extras — best
// scores, found Golden Parcels, the golden-bike unlock, last courier/vehicle
// and persisted settings. Every mutation writes the save (cheap + rare).
import { writeSave } from '../core/save.js';

// The kind of a def (a character or a vehicle) — the data is schema-stable:
// vehicles carry a `model`, characters an `ability`.
const kindOf = (def) => (def && def.model ? 'vehicles' : 'characters');

export function createProgression(saveData, { refresh = () => {}, onGolden = () => {} } = {}) {
  const d = saveData;
  function totalStars() {
    let s = 0;
    for (const k of Object.keys(d.best)) { const b = d.best[k]; if (b && b.stars) s += b.stars; }
    return s;
  }
  // M15a.1: golden parcels are per-suburb (`d.goldenParcels[nbId] = [idx…]`).
  function totalGolden() { let s = 0; for (const k of Object.keys(d.goldenParcels)) s += (d.goldenParcels[k] || []).length; return s; }
  function goldenCount(nbId) { return (d.goldenParcels[nbId] || []).length; }
  // A golden-bike requirement maps suburb → needed count; met when every suburb
  // has at least its number. The bike is `{ 'maple-hollow': 12 }` (§2.13).
  function goldenReqMet(req) { for (const nb of Object.keys(req)) if (goldenCount(nb) < req[nb]) return false; return true; }
  function isUnlocked(id, kind) { return d.unlocked[kind].indexOf(id) >= 0; }
  function save() { writeSave(d); }

  const progression = {
    get coins() { return d.coins; },
    get stars() { return totalStars(); },
    get data() { return d; },
    totalStars,
    totalGolden,
    goldenCount,
    goldenBikeUnlocked() { return goldenReqMet({ 'maple-hollow': 12 }); },
    // §2.11: a locked mission's marker still shows; its card says the star need.
    canStart(shift) { return totalStars() >= (shift.unlockStars || 0); },
    canBuy(def) {
      if (def.unlockCost === 0) return true;
      // M15a.1: a golden unlock is a per-suburb requirement, not a flat count.
      if (def.unlock && def.unlock.goldenParcels) return goldenReqMet(def.unlock.goldenParcels);
      return isUnlocked(def.id, kindOf(def));
    },
    // Buy with coins (golden items unlock by finding, not buying).
    buy(def) {
      if (def.unlockCost === 0 || def.unlock) return this.canBuy(def);
      if (isUnlocked(def.id, kindOf(def))) return true;
      if (d.coins < def.unlockCost) return false;
      d.coins -= def.unlockCost;
      d.unlocked[kindOf(def)].push(def.id);
      refresh(); save();
      return true;
    },
    earn(n) { if (n) { d.coins += n; refresh(); save(); } },
    // §2.11: best score/stars per shift; a new best (or first try) records it.
    recordShift(shiftId, score, stars) {
      const cur = d.best[shiftId];
      if (!cur || score > cur.score || (score === cur.score && stars > cur.stars)) d.best[shiftId] = { score, stars: stars || 0 };
      save();
    },
    bestFor(shiftId) { return d.best[shiftId] || { score: 0, stars: 0 }; },
    // M15a.1: finding a Golden Parcel (by suburb + index). Marks it in that
    // suburb's list; returns { isNew, count } where count is the suburb's found
    // total. Re-finding (already saved) is a no-op.
    foundGolden(nbId, index) {
      let arr = d.goldenParcels[nbId];
      if (!arr) { arr = []; d.goldenParcels[nbId] = arr; }
      const isNew = arr.indexOf(index) < 0;
      if (isNew) { arr.push(index); save(); onGolden(nbId); }
      return { isNew, count: goldenCount(nbId) };
    },
    foundSet(nbId) { return d.goldenParcels[nbId] || []; },
    // §2.11: remember the last courier / vehicle so Continue restores them.
    setLast(charId, vehId) { d.last.character = charId; d.last.vehicle = vehId; save(); },
    get last() { return d.last; },
    // §2.11 settings persistence (quality / musicVol / sfxVol / showFps).
    get settings() { return d.settings; },
    setSetting(k, v) { d.settings[k] = v; save(); },
    save,
  };
  return progression;
}
