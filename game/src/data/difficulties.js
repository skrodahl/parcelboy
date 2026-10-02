// M15a.12: difficulty levels, modeled on Doom's skill list. Data-driven
// (registry by id, §5.4) — read through `progression` and the hazard/setup
// code; game logic never checks a difficulty id, only its fields.
//
// Fields:
//   id, name, face — the selectable face ("smile" → "santa", more frazzled down
//   the list); `face` is a key the select UI draws (no image files).
//   grants.{missions,characters,vehicles,neighborhoods} — "earned OR granted":
//   an unlock is met if the player earned it (stars/coins/golden) OR the current
//   level grants that kind. Nothing earned is ever removed, so switching never
//   loses progress.
//   hazardMul — every hazard count × this (still capped by the pools' MAX).
//   deliveriesMul — a shift's delivery count × this (rounded up; capacity stays).
//   watchSpeedMul — Neighborhood Watch pursuit speed × this.
//   heatDecayMul — mischief heat decays at this fraction of its normal rate.
//   knockdownCostsParcel — a knockdown (and the pond gag) drops a carried parcel
//   (false = you keep it).
//   dogRechase — a dog that gave up turns around and chases again after this
//   many seconds (null = it trots home, the default).
//   giftWrap — parcels are gift-wrapped (red/green, a ribbon) for flavor.
//   warning — the Doom-style confirm line (or null).
// List order is the select order; `brutal` (Ship Me Plenty) is the default
// (existing saves keep playing exactly as they did).
export const DIFFICULTIES = [
  {
    id: 'easy', name: "I'm Too Young to Deliver", face: 'smile',
    grants: { missions: true, characters: true, vehicles: true, neighborhoods: true },
    hazardMul: 0.6, deliveriesMul: 1, watchSpeedMul: 0.85, heatDecayMul: 1,
    knockdownCostsParcel: false, dogRechase: null, giftWrap: false, warning: null,
  },
  {
    id: 'medium', name: 'Hey, Not Too Heavy', face: 'sweat',
    grants: { missions: true, characters: true, vehicles: true, neighborhoods: false },
    hazardMul: 0.85, deliveriesMul: 1, watchSpeedMul: 1, heatDecayMul: 1,
    knockdownCostsParcel: true, dogRechase: null, giftWrap: false, warning: null,
  },
  {
    id: 'hard', name: 'Ship Me Plenty', face: 'panic',
    grants: { missions: true, characters: false, vehicles: false, neighborhoods: false },
    hazardMul: 1, deliveriesMul: 1, watchSpeedMul: 1, heatDecayMul: 1,
    knockdownCostsParcel: true, dogRechase: null, giftWrap: false, warning: null,
  },
  {
    id: 'brutal', name: 'Ultra-Delivery', face: 'dizzy',
    grants: { missions: false, characters: false, vehicles: false, neighborhoods: false },
    hazardMul: 1.15, deliveriesMul: 1, watchSpeedMul: 1.1, heatDecayMul: 1,
    knockdownCostsParcel: true, dogRechase: null, giftWrap: false,
    warning: "Are you sure? Mrs. Henderson's cake isn't even remotely safe.",
  },
  {
    id: 'holiday', name: 'Holiday Rush!', face: 'santa',
    grants: { missions: false, characters: false, vehicles: false, neighborhoods: false },
    hazardMul: 1.35, deliveriesMul: 1.25, watchSpeedMul: 1.2, heatDecayMul: 0.5,
    knockdownCostsParcel: true, dogRechase: 3, giftWrap: true,
    warning: 'Holiday Rush! Are you sure? This shift isn\'t even remotely fair.',
  },
];

export const DEFAULT_DIFFICULTY = 'brutal';
export const DIFFICULTY_BY_ID = Object.fromEntries(DIFFICULTIES.map((d) => [d.id, d]));
export function getDifficulty(id) { return DIFFICULTY_BY_ID[id] || DIFFICULTY_BY_ID[DEFAULT_DIFFICULTY]; }
