// §2.10 + §2.20 + §11.5: all main shifts + side missions. `giver` is where the
// marker stands (a `missionMarkers` id or a shop building id); `pickup` is the
// restock zone ('depot' or a shop building id). `hazards: null` = keep the
// current free-roam hazard counts (side missions). M12b: main shifts carry a
// `window: [start, end]` (game minutes, the world clock) instead of a fixed
// `duration`, and the `timeOfDay` follows from it; side missions carry a soft
// `deliverBy` (game minutes after accepting) instead of a timer — they never
// fail, they just stop paying the tip. Star thresholds re-tuned in M12b.
export const SHIFTS = [
  // Main shifts (giver 'dispatch', pickup 'depot'), pageable from the hub card.
  {
    id: 'morning', name: 'Morning Round', kind: 'main', giver: 'dispatch', pickup: 'depot',
    neighborhood: 'maple-hollow', timeOfDay: 'morning', window: [420, 660], deliveries: 10, // 07:00–11:00
    packageMix: { standard: 0.85, fragile: 0.1, heavy: 0.05 },
    hazards: { car: 3, dog: 1, sprinkler: 2, skater: 0, bees: 1, bin: 8, cone: 0 },
    stars: [1400, 1900, 2350], unlockStars: 0, grumps: 3, // M12b: tuned to the autoplayer (1466) → 1 star
  },
  {
    id: 'lunch', name: 'Lunch Rush', kind: 'main', giver: 'dispatch', pickup: 'depot',
    neighborhood: 'maple-hollow', timeOfDay: 'noon', window: [690, 900], deliveries: 12, // 11:30–15:00
    packageMix: { standard: 0.6, express: 0.3, heavy: 0.1 },
    hazards: { car: 7, dog: 2, sprinkler: 2, skater: 1, bees: 1, bin: 8, cone: 0 },
    stars: [2000, 2680, 3300], unlockStars: 2, grumps: 3, // M12b: tuned to the autoplayer (2062) → 1 star
  },
  {
    id: 'fragile', name: 'Fragile Friday', kind: 'main', giver: 'dispatch', pickup: 'depot',
    neighborhood: 'maple-hollow', timeOfDay: 'noon', window: [690, 930], deliveries: 11, // 11:30–15:30
    packageMix: { fragile: 0.5, standard: 0.4, express: 0.1 },
    hazards: { car: 4, dog: 2, sprinkler: 4, skater: 1, bees: 1, bin: 8, cone: 0 },
    stars: [1500, 2050, 2530], unlockStars: 4, grumps: 3, // M12b: tuned to the autoplayer (1580) → 1 star
  },
  {
    id: 'golden', name: 'Golden Hour', kind: 'main', giver: 'dispatch', pickup: 'depot',
    neighborhood: 'maple-hollow', timeOfDay: 'golden', window: [960, 1200], deliveries: 13, // 16:00–20:00
    packageMix: { standard: 0.6, fragile: 0.2, express: 0.1, heavy: 0.1 },
    hazards: { car: 5, dog: 3, sprinkler: 1, skater: 2, bees: 2, bin: 8, cone: 0 },
    stars: [2050, 2750, 3380], unlockStars: 6, grumps: 3, // M12b: tuned to the autoplayer (2114) → 1 star
  },
  {
    id: 'dusk', name: 'Night Owl', kind: 'main', giver: 'dispatch', pickup: 'depot',
    neighborhood: 'maple-hollow', timeOfDay: 'dusk', window: [1170, 1440], deliveries: 14, // 19:30–24:00
    packageMix: { standard: 0.25, fragile: 0.25, express: 0.25, heavy: 0.25 }, // "mixed evenly"
    hazards: { car: 5, dog: 3, sprinkler: 0, skater: 2, bees: 0, bin: 8, cone: 0 }, // bees asleep; hives still hang
    stars: [2200, 2950, 3630], unlockStars: 9, grumps: 3, // M12b: tuned to the autoplayer (2266) → 1 star
  },
  // M15 §2.18: Cedar Heights' own kiosk shifts (giver 'dispatch' + pickup
  // 'depot', both resolved to this suburb's kiosk + restockZone). The suburb
  // unlocks at 8★; the runaway-bin hazard runs at these levels. Stars tuned to
  // the autoplayer in M15 (see PROGRESS).
  {
    id: 'cedarMorning', name: 'Cedar Morning Round', kind: 'main', giver: 'dispatch', pickup: 'depot',
    neighborhood: 'cedar-heights', timeOfDay: 'morning', window: [420, 660], deliveries: 10, // 07:00–11:00
    packageMix: { standard: 0.85, fragile: 0.1, heavy: 0.05 },
    hazards: { car: 3, dog: 1, sprinkler: 2, skater: 0, bees: 1, bin: 8, cone: 0, runawayBin: 3 },
    stars: [1050, 1500, 1950], unlockStars: 8, grumps: 3, // M15: tuned to the autoplayer (1118) → 1 star
  },
  {
    id: 'cedarLunch', name: 'Cedar Lunch Rush', kind: 'main', giver: 'dispatch', pickup: 'depot',
    neighborhood: 'cedar-heights', timeOfDay: 'noon', window: [690, 900], deliveries: 12, // 11:30–15:00
    packageMix: { standard: 0.6, express: 0.3, heavy: 0.1 },
    hazards: { car: 4, dog: 2, sprinkler: 2, skater: 1, bees: 1, bin: 8, cone: 0, runawayBin: 4 },
    stars: [1200, 1750, 2200], unlockStars: 8, grumps: 3, // M15: tuned to the autoplayer (1280) → 1 star
  },
  {
    id: 'cedarDusk', name: 'Cedar Dusk Round', kind: 'main', giver: 'dispatch', pickup: 'depot',
    neighborhood: 'cedar-heights', timeOfDay: 'dusk', window: [1170, 1440], deliveries: 14, // 19:30–24:00
    packageMix: { standard: 0.4, fragile: 0.2, express: 0.2, heavy: 0.2 },
    hazards: { car: 5, dog: 3, sprinkler: 0, skater: 1, bees: 0, bin: 8, cone: 0, runawayBin: 4 },
    stars: [1180, 1720, 2150], unlockStars: 8, grumps: 3, // M15: tuned to the autoplayer (1254) → 1 star
  },
  // M16 §2.17: Lakeside's own kiosk shifts (giver 'dispatch' + pickup 'depot',
  // both resolved to this suburb's kiosk + restockZone). The suburb unlocks at
  // 16★; the lakeside geese + extra sprinklers run at these levels. Stars tuned
  // to the autoplayer in M16 (see PROGRESS).
  {
    id: 'lakeMorning', name: 'Lakeside Morning Round', kind: 'main', giver: 'dispatch', pickup: 'depot',
    neighborhood: 'lakeside', timeOfDay: 'morning', window: [420, 660], deliveries: 10, // 07:00–11:00
    packageMix: { standard: 0.85, fragile: 0.1, heavy: 0.05 },
    hazards: { car: 3, dog: 1, sprinkler: 3, skater: 0, bees: 0, bin: 6, cone: 0, goose: 3 },
    stars: [1050, 1500, 1950], unlockStars: 16, grumps: 3, // M16: tuned to the autoplayer → 1 star
  },
  {
    id: 'lakeLunch', name: 'Lakeside Lunch Rush', kind: 'main', giver: 'dispatch', pickup: 'depot',
    neighborhood: 'lakeside', timeOfDay: 'noon', window: [690, 900], deliveries: 12, // 11:30–15:00
    packageMix: { standard: 0.6, express: 0.3, heavy: 0.1 },
    hazards: { car: 4, dog: 2, sprinkler: 3, skater: 1, bees: 0, bin: 6, cone: 0, goose: 4 },
    stars: [1200, 1750, 2200], unlockStars: 16, grumps: 3, // M16: tuned to the autoplayer → 1 star
  },
  {
    id: 'lakeDusk', name: 'Lakeside Dusk Round', kind: 'main', giver: 'dispatch', pickup: 'depot',
    neighborhood: 'lakeside', timeOfDay: 'dusk', window: [1170, 1440], deliveries: 14, // 19:30–24:00
    packageMix: { standard: 0.4, fragile: 0.2, express: 0.2, heavy: 0.2 },
    hazards: { car: 5, dog: 3, sprinkler: 1, skater: 1, bees: 0, bin: 6, cone: 0, goose: 4 },
    stars: [1180, 1720, 2150], unlockStars: 16, grumps: 3, // M16: tuned to the autoplayer → 1 star
  },
  // Side missions (each has its own shop marker; hazards null = free-roam levels).
  {
    id: 'cake', name: 'Cake Rush', kind: 'side', giver: 'bakery', pickup: 'bakery',
    neighborhood: 'maple-hollow', timeOfDay: null, deliverBy: 60, deliveries: 1, // soft: full pay + tip in time
    packageMix: { cake: 1 }, hazards: null, stars: [250, 340, 430], unlockStars: 1, grumps: 0, // M12b: tuned to the autoplayer (270) → 1 star
  },
  {
    id: 'haul', name: 'Heavy Haul', kind: 'side', giver: 'hardware', pickup: 'hardware',
    neighborhood: 'maple-hollow', timeOfDay: null, deliverBy: 120, deliveries: 3,
    packageMix: { heavy: 1 }, hazards: null, stars: [160, 215, 275], unlockStars: 3, grumps: 0, // M12b: tuned to the autoplayer (170) → 1 star
  },
];

export const MAIN_SHIFTS = SHIFTS.filter((s) => s.kind === 'main');
export const SIDE_SHIFTS = SHIFTS.filter((s) => s.kind === 'side');
