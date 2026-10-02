// §11.3 / §2.7: the neighborhood's hazards. `behavior` is a key into the
// gameplay/hazards.js behavior table; `model` a key into world/hazardModels.js;
// `radius` is the knockdown distance to the player; `params` are per-hazard
// tuning (read by its behavior); `spawn` says where instances are placed
// (a `def` key — hazardSpots.<n>, 'traffic', 'sidewalkLoops', or 'driveways').
// Counts per situation come from a shift's `hazards` map or FREE_ROAM (M6).
export const HAZARDS = [
  {
    id: 'car', name: 'Car', behavior: 'carPatrol', model: 'car', radius: 1.5, spawn: 'traffic',
    params: { speed: 7.5, brakeDist: 7, brakeCone: 25, honk: true }, knockdown: true,
  },
  {
    id: 'dog', name: 'Dog', behavior: 'dogChase', model: 'dog', radius: 0.6, spawn: 'hazardSpots.dog',
    params: { wakeRadius: 9, chaseSpeed: 7.2, chaseTime: 5, leash: 16, catchRadius: 0.9, recoverTime: 8 }, knockdown: true,
  },
  {
    id: 'sprinkler', name: 'Sprinkler', behavior: 'sprinkler', model: 'sprinkler', radius: 0.6, spawn: 'hazardSpots.sprinkler',
    params: { arc: 120, radius: 5, onTime: 3, offTime: 3, slowFactor: 0.6 }, knockdown: false,
  },
  {
    id: 'skater', name: 'Skater', behavior: 'patrolPath', model: 'skater', radius: 0.5, spawn: 'sidewalkLoops',
    params: { speed: 5, hopBonus: 25 }, knockdown: true,
  },
  {
    id: 'bees', name: 'Bee Swarm', behavior: 'beeSwarm', model: 'beehive', radius: 1.0, spawn: 'hazardSpots.beehive',
    params: { angerRadius: 6, chaseSpeed: 7.8, chaseTime: 8, escapeDistance: 20, escapeTime: 2, stingRadius: 1.0, puffyTime: 5, beeCount: 24, waterScatters: true }, knockdown: true,
  },
  {
    id: 'bin', name: 'Trash Bin', behavior: 'knockable', model: 'bin', radius: 0.6, spawn: 'driveways',
    params: {}, knockdown: false,
  },
  {
    id: 'cone', name: 'Traffic Cone', behavior: 'static', model: 'cone', radius: 0.4, spawn: 'driveways',
    params: {}, knockdown: false,
  },
  // §2.17 Lakeside M16: lakeside geese — chase the courier like a dog and honk
  // (honk via env.onHonk), but NEVER hurt or knock down. Pure slapstick nuisance.
  // Spawn at the `hazardSpots.goose` pads; only Lakeside defines any.
  {
    id: 'goose', name: 'Goose', behavior: 'gooseChase', model: 'goose', radius: 0.6, spawn: 'hazardSpots.goose',
    params: { wakeRadius: 8, chaseSpeed: 6.4, chaseTime: 6, leash: 14, honkEvery: 0.9 }, knockdown: false,
  },
  // §2.18 Cedar Heights: a tipped bin that rolls downhill along the terrain
  // (rolls on its side, accelerates down the slope, knocks the courier down
  // like a skater when it's moving). Spawns at the bin hazard spots and, on a
  // flat suburb, just sits — the downhill term is zero there.
  {
    id: 'runawayBin', name: 'Runaway Bin', behavior: 'binRoll', model: 'bin', radius: 0.7, spawn: 'hazardSpots.bin',
    params: { wakeMin: 3, wakeMax: 7, rollTime: 2.4, accel: 5, maxSpeed: 7 }, knockdown: true,
  },
  // §2.18 M17: Old Town's pigeon flock — the unique gag. A loose flock roosts
  // at each `hazardSpots.pigeon` pad; when the courier gets close, the whole
  // flock LIFTS OFF as one big cloud (flaps + scatters up and out), then comes
  // back down to the roost. Pure slapstick — they never hurt or knock down.
  {
    id: 'pigeon', name: 'Pigeon Flock', behavior: 'pigeonFlock', model: 'pigeon', radius: 0.5, spawn: 'hazardSpots.pigeon',
    params: { wakeRadius: 7, flockTime: 2.6, returnTime: 4 }, knockdown: false,
  },
  // M15a.14: the pond / any water tile - a cartoon dunk (behavior 'dunk'),
  // triggered when the courier's center enters a water tile (not a spawned
  // entity; the `water` behavior runs the teeter/splish/respawn sequence).
  {
    id: 'water', name: 'Pond', behavior: 'dunk', model: 'none', radius: 0.5, spawn: 'none',
    params: { teeterTime: 0.6, dunkTime: 1.5, grace: 2.0, respawnMinWater: 3, respawnMinHazard: 8 }, knockdown: false,
  },
  // §2.15: Neighborhood Watch. Spawned by the heat system, not by the per-shift
  // counts (their "count" is the heat level). `watchChase` runs the pursuit +
  // BUSTED logic; speed/radii come from config MISCHIEF.watch (read by the
  // behavior). Not in the per-shift `hazards` maps, so the count table ignores
  // them.
  {
    id: 'watchSegway', name: 'Deputy Doug', behavior: 'watchChase', model: 'watchSegway', radius: 1.0,
    params: {}, knockdown: false, // touch = BUSTED (handled by the behavior), not a plain knockdown
  },
  {
    id: 'watchCart', name: 'Neighborhood Watch Van', behavior: 'watchChase', model: 'watchCart', radius: 1.2,
    params: {}, knockdown: false,
  },
];

export const HAZARD_BY_ID = Object.fromEntries(HAZARDS.map((h) => [h.id, h]));
