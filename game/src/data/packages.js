// §2.5 + §11.4: the five package types. Each target's package is picked from a
// shift's `packageMix` (M6); the interim M5 session uses `standard`.
// `model` is the parcel-model builder id (entities/parcels.js); `rules` are
// key/value knobs read by the handlers in gameplay/scoring.js; `icon` is a
// short glyph for the HUD.
export const PACKAGES = [
  {
    id: 'standard', name: 'Standard', model: 'parcelStandard',
    rules: {}, icon: '▢',
    colors: { box: '#c8925a', tape: '#00b4a6', label: null },
  },
  {
    id: 'fragile', name: 'Fragile', model: 'parcelFragile',
    rules: { breakDistance: 7, breakImpact: 14 }, icon: '▲',
    colors: { box: '#e8c39e', tape: '#e8c39e', label: '#e63946' },
  },
  {
    id: 'heavy', name: 'Heavy', model: 'parcelHeavy',
    rules: { rangeFactor: 0.5 }, icon: '⬛',
    colors: { box: '#8a6a44', tape: '#5f6275', label: null },
  },
  {
    id: 'express', name: 'Express', model: 'parcelExpress',
    rules: { expressBonus: 100 }, icon: '⚡',
    colors: { box: '#c8925a', tape: '#00b4a6', label: '#ffd166' },
  },
  {
    id: 'cake', name: 'Cake', model: 'parcelCake',
    rules: { breakDistance: 5, breakImpact: 10, doorstepBonus: 100, splat: true }, icon: '✿',
    colors: { box: '#ff8fab', tape: '#fffaf0', label: '#fffaf0' },
  },
];
