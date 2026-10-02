// §2.11: the save layer. One localStorage key (`parcelboy.save.v1`), every
// access wrapped in try/catch so the game runs with defaults when storage is
// unavailable or the data is corrupt. No position is saved — Continue always
// starts at the Distribution Center.
export const SAVE_KEY = 'parcelboy.save.v1';

// M15a.13: the career ledger. Additive (missing fields default to 0), so an old
// save without it upgrades in place. Kept here (core) so loadSave normalizes it.
export function defaultCareer() {
  return {
    shifts: 0,                  // missions worked
    delivered: 0,              // successful deliveries
    outcomes: { perfect: 0, nice: 0, sloppy: 0, doorstep: 0, lucky: 0 },
    wrongAddress: 0,
    bestStreak: 0,
    coins: 0,                  // coins earned all-time
    stars: 0,                  // total stars earned
    golden: {},                // per-suburb { [nbId]: found count }
    suburbs: [],               // suburb ids visited
    bowled: 0, strikes: 0, windows: 0, busted: 0, maxHeat: 0,
    knockdowns: { car: 0, dog: 0, skater: 0, bees: 0, bin: 0, grump: 0 },
    stolen: 0, recovered: 0, splats: 0, trampoline: 0, airMail: 0, dunk: 0,
    cleanMissions: 0,          // missions finished with every parcel delivered
    cakesClean: 0,             // cake deliveries that did NOT splat
    holidayMissions: 0,        // missions finished on Holiday Rush!
    distance: {},              // per-vehicle { [vehId]: metres }
    achievements: [],          // earned ids
    achievementDates: {},      // { [id]: 'YYYY-MM-DD' }
  };
}

function normalizeCareer(c) {
  const d = defaultCareer();
  if (!c || typeof c !== 'object') return d;
  for (const k of ['shifts', 'delivered', 'wrongAddress', 'bestStreak', 'coins', 'stars', 'bowled', 'strikes', 'windows', 'busted', 'maxHeat', 'stolen', 'recovered', 'splats', 'trampoline', 'airMail', 'dunk', 'cleanMissions', 'cakesClean', 'holidayMissions']) {
    if (typeof c[k] === 'number' && isFinite(c[k])) d[k] = c[k];
  }
  if (c.outcomes) for (const k of Object.keys(d.outcomes)) if (typeof c.outcomes[k] === 'number') d.outcomes[k] = c.outcomes[k];
  if (c.knockdowns) for (const k of Object.keys(d.knockdowns)) if (typeof c.knockdowns[k] === 'number') d.knockdowns[k] = c.knockdowns[k];
  if (c.golden && typeof c.golden === 'object') { for (const k of Object.keys(c.golden)) if (typeof c.golden[k] === 'number') d.golden[k] = c.golden[k]; }
  if (c.distance && typeof c.distance === 'object') { for (const k of Object.keys(c.distance)) if (typeof c.distance[k] === 'number') d.distance[k] = c.distance[k]; }
  if (c.achievementDates && typeof c.achievementDates === 'object') { for (const k of Object.keys(c.achievementDates)) if (typeof c.achievementDates[k] === 'string') d.achievementDates[k] = c.achievementDates[k]; }
  if (Array.isArray(c.suburbs)) d.suburbs = c.suburbs.filter((x) => typeof x === 'string');
  if (Array.isArray(c.achievements)) d.achievements = c.achievements.filter((x) => typeof x === 'string');
  return d;
}

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
    career: defaultCareer(), // M15a.13: the career ledger
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
  d.career = normalizeCareer(data.career); // M15a.13 (missing fields default to 0)
  return d;
}

export function writeSave(data) {
  try { window.localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) { /* storage full/blocked: keep playing */ }
}

export function clearSave() {
  try { window.localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
}
