// §2.11: the save layer. One localStorage key (`parcelboy.save.v1`), every
// access wrapped in try/catch so the game runs with defaults when storage is
// unavailable or the data is corrupt. No position is saved — Continue always
// starts at the Distribution Center.
export const SAVE_KEY = 'parcelboy.save.v1';

export function defaultSave() {
  return {
    version: 1,
    coins: 0,
    unlocked: { characters: [], vehicles: [] },
    best: {},
    goldenParcels: [],
    last: { character: 'pip', vehicle: 'feet' },
    settings: { quality: 'high', musicVol: 0.35, sfxVol: 0.8, showFps: false },
  };
}

// Read + validate the save. Any shape that is not exactly a save → defaults
// (this is the "corrupt save falls back to defaults without errors" DoD).
export function loadSave() {
  let raw = null;
  try { raw = window.localStorage.getItem(SAVE_KEY); } catch (e) { return defaultSave(); }
  if (!raw) return defaultSave();
  let data;
  try { data = JSON.parse(raw); } catch (e) { return defaultSave(); }
  if (!data || typeof data !== 'object' || data.version !== 1) return defaultSave();
  const d = defaultSave();
  if (typeof data.coins === 'number' && isFinite(data.coins)) d.coins = data.coins;
  if (data.unlocked) {
    if (Array.isArray(data.unlocked.characters)) d.unlocked.characters = data.unlocked.characters.filter((x) => typeof x === 'string');
    if (Array.isArray(data.unlocked.vehicles)) d.unlocked.vehicles = data.unlocked.vehicles.filter((x) => typeof x === 'string');
  }
  if (data.best && typeof data.best === 'object') d.best = data.best; // shape checked at read sites
  if (Array.isArray(data.goldenParcels)) d.goldenParcels = data.goldenParcels.filter((x) => typeof x === 'number');
  if (data.last && typeof data.last === 'object') {
    if (typeof data.last.character === 'string') d.last.character = data.last.character;
    if (typeof data.last.vehicle === 'string') d.last.vehicle = data.last.vehicle;
  }
  if (data.settings && typeof data.settings === 'object') {
    for (const k of Object.keys(d.settings)) {
      if (typeof data.settings[k] === typeof d.settings[k]) d.settings[k] = data.settings[k];
    }
  }
  return d;
}

export function writeSave(data) {
  try { window.localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) { /* storage full/blocked: keep playing */ }
}

export function clearSave() {
  try { window.localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
}
