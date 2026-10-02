// §2.10 + §2.20 + §11.5 + M15a.11: all main shifts + side missions. `giver` is
// where the marker stands (a `missionMarkers` id or a shop building id);
// `pickup` is the restock zone ('depot' or a shop building id). `hazards: null`
// = keep the current free-roam hazard counts (side missions).
// M15a.11 (any-time missions): a main shift carries `hours` (its length in game
// hours from the moment you accept it) — NOT a fixed `window` on the world
// clock and no `timeOfDay`. It's offered any time; the clock only sets the
// mood (TOD_HAZARDS in config.js). It ends when everything is delivered, when
// its `hours` run out, or on clock-out. Optional `availableHours: [from, to]`
// (game hours) for a special timed mission: Night Owl is offered only in the
// evening (a teaser when outside its hours). Side missions keep a soft
// `deliverBy` (game minutes after accepting) — they never fail, they just stop
// paying the tip. Star thresholds re-tuned in M12b / M15a.16.
export const SHIFTS = [
  // Main shifts (giver 'dispatch', pickup 'depot'), offered any time.
  {
    id: 'morning', name: 'Neighborhood Round', kind: 'main', giver: 'dispatch', pickup: 'depot',
    neighborhood: 'maple-hollow', hours: 4, deliveries: 10,
    packageMix: { standard: 0.85, fragile: 0.1, heavy: 0.05 },
    hazards: { car: 3, dog: 1, sprinkler: 2, skater: 0, bees: 1, bin: 8, cone: 0 },
    stars: [1400, 1900, 2350], unlockStars: 0, grumps: 3, // M15a.11: open at 0★ (a new player's first mission)
  },
  {
    id: 'lunch', name: 'Express Rush', kind: 'main', giver: 'dispatch', pickup: 'depot',
    neighborhood: 'maple-hollow', hours: 3.5, deliveries: 12,
    packageMix: { standard: 0.6, express: 0.3, heavy: 0.1 },
    hazards: { car: 7, dog: 2, sprinkler: 2, skater: 1, bees: 1, bin: 8, cone: 0 },
    stars: [2000, 2680, 3300], unlockStars: 0, grumps: 3, // M15a.11: open at 0★ (second first mission)
  },
  {
    id: 'fragile', name: 'Fragile Friday', kind: 'main', giver: 'dispatch', pickup: 'depot',
    neighborhood: 'maple-hollow', hours: 4, deliveries: 11,
    packageMix: { fragile: 0.5, standard: 0.4, express: 0.1 },
    hazards: { car: 4, dog: 2, sprinkler: 4, skater: 1, bees: 1, bin: 8, cone: 0 },
    stars: [1500, 2050, 2530], unlockStars: 2, grumps: 3, // M15a.11: 2★
  },
  {
    id: 'golden', name: 'Big Round', kind: 'main', giver: 'dispatch', pickup: 'depot',
    neighborhood: 'maple-hollow', hours: 4, deliveries: 13,
    packageMix: { standard: 0.6, fragile: 0.2, express: 0.1, heavy: 0.1 },
    hazards: { car: 5, dog: 3, sprinkler: 1, skater: 2, bees: 2, bin: 8, cone: 0 },
    stars: [2050, 2750, 3380], unlockStars: 5, grumps: 3, // M15a.11: 5★
  },
  {
    id: 'dusk', name: 'Night Owl', kind: 'main', giver: 'dispatch', pickup: 'depot',
    neighborhood: 'maple-hollow', hours: 4.5, deliveries: 14,
    packageMix: { standard: 0.25, fragile: 0.25, express: 0.25, heavy: 0.25 }, // "mixed evenly"
    hazards: { car: 5, dog: 3, sprinkler: 0, skater: 2, bees: 0, bin: 8, cone: 0 }, // bees asleep; hives still hang
    stars: [2200, 2950, 3630], unlockStars: 8, grumps: 3,
    availableHours: [19, 24], // M15a.11: the only timed mission — evening only (teaser otherwise)
  },
  // M15 §2.18 + M15a.11: Cedar Heights' own kiosk shifts. The suburb unlocks at
  // 8★; the runaway-bin hazard runs at these levels. Renamed by content (M15a.11).
  {
    id: 'cedarMorning', name: 'Hillside Round', kind: 'main', giver: 'dispatch', pickup: 'depot',
    neighborhood: 'cedar-heights', hours: 4, deliveries: 10,
    packageMix: { standard: 0.85, fragile: 0.1, heavy: 0.05 },
    hazards: { car: 3, dog: 1, sprinkler: 2, skater: 0, bees: 1, bin: 8, cone: 0, runawayBin: 3 },
    stars: [1050, 1500, 1950], unlockStars: 8, grumps: 3,
  },
  {
    id: 'cedarLunch', name: 'Hillside Express', kind: 'main', giver: 'dispatch', pickup: 'depot',
    neighborhood: 'cedar-heights', hours: 3.5, deliveries: 12,
    packageMix: { standard: 0.6, express: 0.3, heavy: 0.1 },
    hazards: { car: 4, dog: 2, sprinkler: 2, skater: 1, bees: 1, bin: 8, cone: 0, runawayBin: 4 },
    stars: [1200, 1750, 2200], unlockStars: 8, grumps: 3,
  },
  {
    id: 'cedarDusk', name: 'Switchback Run', kind: 'main', giver: 'dispatch', pickup: 'depot',
    neighborhood: 'cedar-heights', hours: 4.5, deliveries: 14,
    packageMix: { standard: 0.4, fragile: 0.2, express: 0.2, heavy: 0.2 },
    hazards: { car: 5, dog: 3, sprinkler: 0, skater: 1, bees: 0, bin: 8, cone: 0, runawayBin: 4 },
    stars: [1180, 1720, 2150], unlockStars: 8, grumps: 3,
  },
  // M16 §2.17: Lakeside's own kiosk shifts. The suburb unlocks at 16★; the
  // lakeside geese + extra sprinklers run at these levels.
  {
    id: 'lakeMorning', name: 'Lakeside Morning Round', kind: 'main', giver: 'dispatch', pickup: 'depot',
    neighborhood: 'lakeside', hours: 4, deliveries: 10,
    packageMix: { standard: 0.85, fragile: 0.1, heavy: 0.05 },
    hazards: { car: 3, dog: 1, sprinkler: 3, skater: 0, bees: 0, bin: 6, cone: 0, goose: 3 },
    stars: [1050, 1500, 1950], unlockStars: 16, grumps: 3, // M16: tuned to the autoplayer → 1 star
  },
  {
    id: 'lakeLunch', name: 'Lakeside Lunch Rush', kind: 'main', giver: 'dispatch', pickup: 'depot',
    neighborhood: 'lakeside', hours: 3.5, deliveries: 12,
    packageMix: { standard: 0.6, express: 0.3, heavy: 0.1 },
    hazards: { car: 4, dog: 2, sprinkler: 3, skater: 1, bees: 0, bin: 6, cone: 0, goose: 4 },
    stars: [1200, 1750, 2200], unlockStars: 16, grumps: 3, // M16: tuned to the autoplayer → 1 star
  },
  {
    id: 'lakeDusk', name: 'Lakeside Dusk Round', kind: 'main', giver: 'dispatch', pickup: 'depot',
    neighborhood: 'lakeside', hours: 4.5, deliveries: 14,
    packageMix: { standard: 0.4, fragile: 0.2, express: 0.2, heavy: 0.2 },
    hazards: { car: 5, dog: 3, sprinkler: 1, skater: 1, bees: 0, bin: 6, cone: 0, goose: 4 },
    stars: [1180, 1720, 2150], unlockStars: 16, grumps: 3, // M16: tuned to the autoplayer → 1 star
  },
  // Side missions (each has its own shop marker; hazards null = free-roam levels).
  {
    id: 'cake', name: 'Cake Rush', kind: 'side', giver: 'bakery', pickup: 'bakery',
    neighborhood: 'maple-hollow', deliverBy: 60, deliveries: 1, // soft: full pay + tip in time
    packageMix: { cake: 1 }, hazards: null, stars: [250, 340, 430], unlockStars: 0, grumps: 0, // M15a.11: open at 0★ (a new player's third option)
  },
  {
    id: 'haul', name: 'Heavy Haul', kind: 'side', giver: 'hardware', pickup: 'hardware',
    neighborhood: 'maple-hollow', deliverBy: 120, deliveries: 3,
    packageMix: { heavy: 1 }, hazards: null, stars: [160, 215, 275], unlockStars: 3, grumps: 0, // M15a.11: 3★
  },
];

export const MAIN_SHIFTS = SHIFTS.filter((s) => s.kind === 'main');
export const SIDE_SHIFTS = SHIFTS.filter((s) => s.kind === 'side');
