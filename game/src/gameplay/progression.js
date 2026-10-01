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
  function totalGolden() { return d.goldenParcels.length; }
  function isUnlocked(id, kind) { return d.unlocked[kind].indexOf(id) >= 0; }
  function save() { writeSave(d); }

  const progression = {
    get coins() { return d.coins; },
    get stars() { return totalStars(); },
    get data() { return d; },
    totalStars,
    totalGolden,
    goldenBikeUnlocked() { return totalGolden() >= 12; },
    // §2.11: a locked mission's marker still shows; its card says the star need.
    canStart(shift) { return totalStars() >= (shift.unlockStars || 0); },
    canBuy(def) {
      if (def.unlockCost === 0) return true;
      if (def.unlock) return totalGolden() >= def.unlock.goldenParcels;
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
    // §2.13: finding a Golden Parcel (by index). Returns the new total.
    foundGolden(index) {
      if (d.goldenParcels.indexOf(index) < 0) { d.goldenParcels.push(index); save(); onGolden(totalGolden()); }
      return totalGolden();
    },
    foundSet() { return d.goldenParcels; },
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
