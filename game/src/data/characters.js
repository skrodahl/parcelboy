// §2.8 + §11.1: starter couriers. `stats` are multipliers/factors applied to
// the vehicle base stats; `ability` is registered in M8; `build` scales the
// torso (slim | regular | sturdy). Skin tones are intentionally varied.
export const CHARACTERS = [
  {
    id: 'pip', name: 'Pip', blurb: 'Quick on their feet, light on parcels.',
    build: 'slim',
    colors: { skin: '#f1c27d', hair: '#4a2c2a', shirt: '#ef476f', pants: '#3d5a80', shoes: '#22223b', cap: '#ffd166' },
    stats: { speed: 1.15, capacity: 4, throwRange: 0.9, accuracy: 0.75 },
    ability: 'sprint', perks: [], unlockCost: 0,
  },
  {
    id: 'bea', name: 'Bea', blurb: 'Tall, sturdy, unshakable.',
    build: 'sturdy',
    colors: { skin: '#8d5524', hair: '#1d1d2c', shirt: '#2a9d8f', pants: '#385170', shoes: '#f8f9fa', cap: '#073b4c' },
    stats: { speed: 0.9, capacity: 7, throwRange: 1.0, accuracy: 0.8 },
    ability: 'unstoppable', perks: [], unlockCost: 0,
  },
  {
    id: 'juno', name: 'Juno', blurb: 'Purple jacket, headphones, dead-accurate throws.',
    build: 'slim',
    colors: { skin: '#c68642', hair: '#073b4c', shirt: '#8338ec', pants: '#22223b', shoes: '#f8f9fa', cap: '#8338ec', headphones: '#22223b' },
    stats: { speed: 1.0, capacity: 5, throwRange: 1.1, accuracy: 0.95 },
    ability: 'trickshot', perks: [], unlockCost: 0,
  },
  {
    id: 'marlo', name: 'Marlo', blurb: 'Big smile, bigger charm.',
    build: 'regular',
    colors: { skin: '#f8d5b0', hair: '#f4a261', shirt: '#ff8c42', pants: '#5f6275', shoes: '#22223b', cap: '#ffd166' },
    stats: { speed: 1.0, capacity: 5, throwRange: 1.0, accuracy: 0.8 },
    ability: 'charm', perks: ['dogFriendly'], unlockCost: 600,
  },
  {
    id: 'ollie', name: 'Ollie', blurb: 'Goggles up, ready to turbo.',
    build: 'regular',
    colors: { skin: '#e0ac69', hair: '#4a2c2a', shirt: '#118ab2', pants: '#3d5a80', shoes: '#f8f9fa', cap: '#118ab2', goggles: '#f8f9fa' },
    stats: { speed: 1.05, capacity: 5, throwRange: 1.0, accuracy: 0.85 },
    ability: 'turbo', perks: [], unlockCost: 900,
  },
];
