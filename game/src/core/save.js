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
    goldenParcels: {}, // M15a.1: per-suburb { [nbId]: [found indices] } (was a flat array)
    last: { character: 'pip', vehicle: 'feet' },
    settings: { quality: 'balanced', musicVol: 0.35, sfxVol: 0.8, showFps: false },
    clock: 360, // §2.20: the world day clock (game minutes since 00:00), persisted
    neighborhood: 'maple-hollow', // §2.18: the suburb the player is in
    difficulty: 'brutal', // M15a.12: the current skill level (additive; old saves default here)
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
  if (data.goldenParcels) {
    if (Array.isArray(data.goldenParcels)) {
      // M15a.1 migration: the pre-suburbs flat array was Maple Hollow's finds.
      d.goldenParcels = { 'maple-hollow': data.goldenParcels.filter((x) => typeof x === 'number') };
    } else if (typeof data.goldenParcels === 'object') {
      for (const k of Object.keys(data.goldenParcels)) {
        if (Array.isArray(data.goldenParcels[k])) d.goldenParcels[k] = data.goldenParcels[k].filter((x) => typeof x === 'number');
      }
    }
  }
  if (typeof data.clock === 'number' && isFinite(data.clock)) d.clock = ((data.clock % 1440) + 1440) % 1440; // §2.20
  if (typeof data.neighborhood === 'string' && data.neighborhood) d.neighborhood = data.neighborhood; // §2.18
  if (typeof data.difficulty === 'string' && data.difficulty) d.difficulty = data.difficulty; // M15a.12 (validated at read)
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
