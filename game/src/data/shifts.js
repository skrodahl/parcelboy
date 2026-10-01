// §2.10 + §11.5: all main shifts + side missions. `giver` is where the marker
// stands (a `missionMarkers` id or a shop building id); `pickup` is the
// restock zone ('depot' or a shop building id). `hazards: null` = keep the
// current free-roam hazard counts (side missions). `timeOfDay: null` = keep
// the current day-cycle phase. Star thresholds are first guesses (tuned M12).
export const SHIFTS = [
  // Main shifts (giver 'dispatch', pickup 'depot'), pageable from the hub card.
  {
    id: 'morning', name: 'Morning Round', kind: 'main', giver: 'dispatch', pickup: 'depot',
    neighborhood: 'maple-hollow', timeOfDay: 'morning', duration: 240, deliveries: 10,
    packageMix: { standard: 0.85, fragile: 0.1, heavy: 0.05 },
    hazards: { car: 3, dog: 1, sprinkler: 2, skater: 0, bees: 1, bin: 8, cone: 0 },
    stars: [2400, 3000, 3450], unlockStars: 0, grumps: 3, // M12: tuned to the autoplayer (2540) → 1 star
  },
  {
    id: 'lunch', name: 'Lunch Rush', kind: 'main', giver: 'dispatch', pickup: 'depot',
    neighborhood: 'maple-hollow', timeOfDay: 'noon', duration: 210, deliveries: 12,
    packageMix: { standard: 0.6, express: 0.3, heavy: 0.1 },
    hazards: { car: 7, dog: 2, sprinkler: 2, skater: 1, bees: 1, bin: 8, cone: 0 },
    stars: [2850, 3400, 3900], unlockStars: 2, grumps: 3, // M12: autoplayer (2970) → 1 star
  },
  {
    id: 'fragile', name: 'Fragile Friday', kind: 'main', giver: 'dispatch', pickup: 'depot',
    neighborhood: 'maple-hollow', timeOfDay: 'noon', duration: 240, deliveries: 11,
    packageMix: { fragile: 0.5, standard: 0.4, express: 0.1 },
    hazards: { car: 4, dog: 2, sprinkler: 4, skater: 1, bees: 1, bin: 8, cone: 0 },
    stars: [2500, 3050, 3550], unlockStars: 4, grumps: 3, // M12: autoplayer (2650) → 1 star
  },
  {
    id: 'golden', name: 'Golden Hour', kind: 'main', giver: 'dispatch', pickup: 'depot',
    neighborhood: 'maple-hollow', timeOfDay: 'golden', duration: 240, deliveries: 13,
    packageMix: { standard: 0.6, fragile: 0.2, express: 0.1, heavy: 0.1 },
    hazards: { car: 5, dog: 3, sprinkler: 1, skater: 2, bees: 2, bin: 8, cone: 0 },
    stars: [3000, 3550, 4050], unlockStars: 6, grumps: 3, // M12: autoplayer (3150) → 1 star
  },
  {
    id: 'dusk', name: 'Night Owl', kind: 'main', giver: 'dispatch', pickup: 'depot',
    neighborhood: 'maple-hollow', timeOfDay: 'dusk', duration: 270, deliveries: 14,
    packageMix: { standard: 0.25, fragile: 0.25, express: 0.25, heavy: 0.25 }, // "mixed evenly"
    hazards: { car: 5, dog: 3, sprinkler: 0, skater: 2, bees: 0, bin: 8, cone: 0 }, // bees asleep; hives still hang
    stars: [3300, 3850, 4350], unlockStars: 9, grumps: 3, // M12: autoplayer (3440) → 1 star
  },
  // Side missions (each has its own shop marker; hazards null = free-roam levels).
  {
    id: 'cake', name: 'Cake Rush', kind: 'side', giver: 'bakery', pickup: 'bakery',
    neighborhood: 'maple-hollow', timeOfDay: null, duration: 60, deliveries: 1,
    packageMix: { cake: 1 }, hazards: null, stars: [600, 900, 1250], unlockStars: 1, grumps: 0, // M12: autoplayer (810) → 1 star
  },
  {
    id: 'haul', name: 'Heavy Haul', kind: 'side', giver: 'hardware', pickup: 'hardware',
    neighborhood: 'maple-hollow', timeOfDay: null, duration: 120, deliveries: 3,
    packageMix: { heavy: 1 }, hazards: null, stars: [1100, 1400, 1750], unlockStars: 3, grumps: 0, // M12: autoplayer (1310) → 1 star
  },
];

export const MAIN_SHIFTS = SHIFTS.filter((s) => s.kind === 'main');
export const SIDE_SHIFTS = SHIFTS.filter((s) => s.kind === 'side');
