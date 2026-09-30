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
];

export const HAZARD_BY_ID = Object.fromEntries(HAZARDS.map((h) => [h.id, h]));
