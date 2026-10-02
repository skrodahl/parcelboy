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
// paying the tip.
// M15a.16: `stars` is now `{ deliveredFrac, style }` — 1★ = at least
// `deliveredFrac` of the parcels delivered (rounded up, any method), 2★ = every
// parcel delivered, 3★ = every parcel delivered AND score ≥ `style` (the old
// pure-score 2★ threshold, re-tuned to the autoplayer). Coins stay floor(score/10).
export const SHIFTS = [
  // Main shifts (giver 'dispatch', pickup 'depot'), offered any time.
  {
    id: 'morning', name: 'Neighborhood Round', kind: 'main', giver: 'dispatch', pickup: 'depot',
    neighborhood: 'maple-hollow', hours: 4, deliveries: 10,
    packageMix: { standard: 0.85, fragile: 0.1, heavy: 0.05 },
    hazards: { car: 3, dog: 1, sprinkler: 2, skater: 0, bees: 1, bin: 8, cone: 0 },
    stars: { deliveredFrac: 0.7, style: 1900 }, unlockStars: 0, grumps: 3, // M15a.16: 1★ ≥70% delivered, 2★ all, 3★ all + score ≥ style (old 2★); open at 0★
  },
  {
    id: 'lunch', name: 'Express Rush', kind: 'main', giver: 'dispatch', pickup: 'depot',
    neighborhood: 'maple-hollow', hours: 3.5, deliveries: 12,
    packageMix: { standard: 0.6, express: 0.3, heavy: 0.1 },
    hazards: { car: 7, dog: 2, sprinkler: 2, skater: 1, bees: 1, bin: 8, cone: 0 },
    stars: { deliveredFrac: 0.7, style: 2680 }, unlockStars: 0, grumps: 3, // open at 0★ (second first mission)
  },
  {
    id: 'fragile', name: 'Fragile Friday', kind: 'main', giver: 'dispatch', pickup: 'depot',
    neighborhood: 'maple-hollow', hours: 4, deliveries: 11,
    packageMix: { fragile: 0.5, standard: 0.4, express: 0.1 },
    hazards: { car: 4, dog: 2, sprinkler: 4, skater: 1, bees: 1, bin: 8, cone: 0 },
    stars: { deliveredFrac: 0.7, style: 2050 }, unlockStars: 2, grumps: 3, // M15a.11: 2★
  },
  {
    id: 'golden', name: 'Big Round', kind: 'main', giver: 'dispatch', pickup: 'depot',
    neighborhood: 'maple-hollow', hours: 4, deliveries: 13,
    packageMix: { standard: 0.6, fragile: 0.2, express: 0.1, heavy: 0.1 },
    hazards: { car: 5, dog: 3, sprinkler: 1, skater: 2, bees: 2, bin: 8, cone: 0 },
    stars: { deliveredFrac: 0.7, style: 2750 }, unlockStars: 5, grumps: 3, // M15a.11: 5★
  },
  {
    id: 'dusk', name: 'Night Owl', kind: 'main', giver: 'dispatch', pickup: 'depot',
    neighborhood: 'maple-hollow', hours: 4.5, deliveries: 14,
    packageMix: { standard: 0.25, fragile: 0.25, express: 0.25, heavy: 0.25 }, // "mixed evenly"
    hazards: { car: 5, dog: 3, sprinkler: 0, skater: 2, bees: 0, bin: 8, cone: 0 }, // bees asleep; hives still hang
    stars: { deliveredFrac: 0.7, style: 2950 }, unlockStars: 8, grumps: 3,
    availableHours: [19, 24], // M15a.11: the only timed mission — evening only (teaser otherwise)
  },
  // M15 §2.18 + M15a.11: Cedar Heights' own kiosk shifts. The suburb unlocks at
  // 8★; the runaway-bin hazard runs at these levels. Renamed by content (M15a.11).
  {
    id: 'cedarMorning', name: 'Hillside Round', kind: 'main', giver: 'dispatch', pickup: 'depot',
    neighborhood: 'cedar-heights', hours: 4, deliveries: 10,
    packageMix: { standard: 0.85, fragile: 0.1, heavy: 0.05 },
    hazards: { car: 3, dog: 1, sprinkler: 2, skater: 0, bees: 1, bin: 8, cone: 0, runawayBin: 3 },
    stars: { deliveredFrac: 0.7, style: 1500 }, unlockStars: 8, grumps: 3,
  },
  {
    id: 'cedarLunch', name: 'Hillside Express', kind: 'main', giver: 'dispatch', pickup: 'depot',
    neighborhood: 'cedar-heights', hours: 3.5, deliveries: 12,
    packageMix: { standard: 0.6, express: 0.3, heavy: 0.1 },
    hazards: { car: 4, dog: 2, sprinkler: 2, skater: 1, bees: 1, bin: 8, cone: 0, runawayBin: 4 },
    stars: { deliveredFrac: 0.7, style: 1750 }, unlockStars: 8, grumps: 3,
  },
  {
    id: 'cedarDusk', name: 'Switchback Run', kind: 'main', giver: 'dispatch', pickup: 'depot',
    neighborhood: 'cedar-heights', hours: 4.5, deliveries: 14,
    packageMix: { standard: 0.4, fragile: 0.2, express: 0.2, heavy: 0.2 },
    hazards: { car: 5, dog: 3, sprinkler: 0, skater: 1, bees: 0, bin: 8, cone: 0, runawayBin: 4 },
    stars: { deliveredFrac: 0.7, style: 1720 }, unlockStars: 8, grumps: 3,
  },
  // M16 §2.17: Lakeside's own kiosk shifts. The suburb unlocks at 16★; the
  // lakeside geese + extra sprinklers run at these levels.
  {
    id: 'lakeMorning', name: 'Lakeside Morning Round', kind: 'main', giver: 'dispatch', pickup: 'depot',
    neighborhood: 'lakeside', hours: 4, deliveries: 10,
    packageMix: { standard: 0.85, fragile: 0.1, heavy: 0.05 },
    hazards: { car: 3, dog: 1, sprinkler: 3, skater: 0, bees: 0, bin: 6, cone: 0, goose: 3 },
    stars: { deliveredFrac: 0.7, style: 1500 }, unlockStars: 16, grumps: 3, // M15a.16: style = old 2★ (re-tuned to the autoplayer)
  },
  {
    id: 'lakeLunch', name: 'Lakeside Lunch Rush', kind: 'main', giver: 'dispatch', pickup: 'depot',
    neighborhood: 'lakeside', hours: 3.5, deliveries: 12,
    packageMix: { standard: 0.6, express: 0.3, heavy: 0.1 },
    hazards: { car: 4, dog: 2, sprinkler: 3, skater: 1, bees: 0, bin: 6, cone: 0, goose: 4 },
    stars: { deliveredFrac: 0.7, style: 1750 }, unlockStars: 16, grumps: 3, // M15a.16: style = old 2★ (re-tuned to the autoplayer)
  },
  {
    id: 'lakeDusk', name: 'Lakeside Dusk Round', kind: 'main', giver: 'dispatch', pickup: 'depot',
    neighborhood: 'lakeside', hours: 4.5, deliveries: 14,
    packageMix: { standard: 0.4, fragile: 0.2, express: 0.2, heavy: 0.2 },
    hazards: { car: 5, dog: 3, sprinkler: 1, skater: 1, bees: 0, bin: 6, cone: 0, goose: 4 },
    stars: { deliveredFrac: 0.7, style: 1720 }, unlockStars: 16, grumps: 3, // M15a.16: style = old 2★ (re-tuned to the autoplayer)
  },
  // M17 §2.18: Old Town's own kiosk shifts. The suburb unlocks at 26★ (the
  // last suburb — ~all the stars in the game); it has 8 houses, so the
  // deliveries cap at 8 targets. More skaters + the pigeon flock + sprinklers.
  {
    id: 'oldMorning', name: 'Old Town Morning Round', kind: 'main', giver: 'dispatch', pickup: 'depot',
    neighborhood: 'old-town', hours: 4, deliveries: 10,
    packageMix: { standard: 0.8, fragile: 0.15, heavy: 0.05 },
    hazards: { car: 3, dog: 1, sprinkler: 2, skater: 4, bees: 0, bin: 0, cone: 0, pigeon: 3 },
    stars: { deliveredFrac: 0.7, style: 1500 }, unlockStars: 26, grumps: 3,
  },
  {
    id: 'oldLunch', name: 'Old Town Lunch Rush', kind: 'main', giver: 'dispatch', pickup: 'depot',
    neighborhood: 'old-town', hours: 3.5, deliveries: 11,
    packageMix: { standard: 0.5, express: 0.3, heavy: 0.2 },
    hazards: { car: 4, dog: 2, sprinkler: 2, skater: 4, bees: 0, bin: 0, cone: 0, pigeon: 3 },
    stars: { deliveredFrac: 0.7, style: 1750 }, unlockStars: 26, grumps: 3,
  },
  {
    id: 'oldDusk', name: 'Old Town Dusk Round', kind: 'main', giver: 'dispatch', pickup: 'depot',
    neighborhood: 'old-town', hours: 4.5, deliveries: 12,
    packageMix: { standard: 0.4, fragile: 0.2, express: 0.2, heavy: 0.2 },
    hazards: { car: 5, dog: 2, sprinkler: 1, skater: 4, bees: 0, bin: 0, cone: 0, pigeon: 3 },
    stars: { deliveredFrac: 0.7, style: 1720 }, unlockStars: 26, grumps: 3,
  },
  // Side missions (each has its own shop marker; hazards null = free-roam levels).
  {
    id: 'cake', name: 'Cake Rush', kind: 'side', giver: 'bakery', pickup: 'bakery',
    neighborhood: 'maple-hollow', deliverBy: 60, deliveries: 1, // soft: full pay + tip in time
    packageMix: { cake: 1 }, hazards: null, stars: { deliveredFrac: 0.7, style: 340 }, unlockStars: 0, grumps: 0, // M15a.11: open at 0★ (a new player's third option)
    // M15a.17: deliver to a house across the suburb (never back to the shop).
    // `minDistance` = the target house's center must be ≥ this far from the shop.
    minDistance: 40,
    customers: [
      { name: 'Mrs. Henderson', line: 'birthday cake' },
      { name: 'Mr. Okafor', line: 'wedding cake' },
      { name: 'The Doyle Family', line: 'anniversary cake' },
      { name: 'Miss Sorensen', line: 'graduation cake' },
      { name: 'Mr. Patel', line: 'a surprise cake' },
    ],
  },
  {
    id: 'haul', name: 'Heavy Haul', kind: 'side', giver: 'hardware', pickup: 'hardware',
    neighborhood: 'maple-hollow', deliverBy: 120, deliveries: 3,
    packageMix: { heavy: 1 }, hazards: null, stars: { deliveredFrac: 0.7, style: 215 }, unlockStars: 3, grumps: 0, // M15a.11: 3★
    // M15a.17: three houses, each ≥ `minDistance` from the shop and ≥ `minSpacing`
    // from every other target, so it's a real run across the suburb.
    minDistance: 20, minSpacing: 15,
    customers: [
      { name: 'Mr. Patel', line: 'a box of bricks' },
      { name: 'Mr. Okafor', line: 'a crate of paint' },
      { name: 'The Doyles', line: 'a pallet of tiles' },
      { name: 'Mr. Sorensen', line: 'a drum of planks' },
      { name: 'Mrs. Kim', line: 'a bag of cement' },
    ],
  },
];

export const MAIN_SHIFTS = SHIFTS.filter((s) => s.kind === 'main');
export const SIDE_SHIFTS = SHIFTS.filter((s) => s.kind === 'side');

// M15a.16: the 1★ delivery threshold (rounded up) + the 3★ style threshold for
// a shift — shown on the mission card and the shift report.
export function starNeed(s) {
  const st = s.stars || { deliveredFrac: 0.7, style: 0 };
  const total = s.deliveries;
  return { needOne: Math.ceil(total * st.deliveredFrac), style: st.style, total };
}
