// §2.9 + §11.2: vehicles. `stats` are the base stats the courier multipliers
// apply to; `riding` picks the rider pose (walk | pedal | stand); `model` is
// the model-builder id registered in M4.
export const VEHICLES = [
  {
    id: 'feet', name: 'On Foot', model: 'feet', riding: 'walk',
    stats: { maxSpeed: 6.5, accel: 30, turnRate: 5.5, capacityBonus: 0, throwRange: 12 },
    canJump: true, unlockCost: 0,
  },
  {
    id: 'bike', name: 'Bicycle', model: 'bike', riding: 'pedal',
    stats: { maxSpeed: 11, accel: 14, turnRate: 3.2, capacityBonus: 1, throwRange: 12 },
    canJump: true, unlockCost: 0,
  },
  {
    id: 'scooter', name: 'E-Scooter', model: 'scooter', riding: 'stand',
    stats: { maxSpeed: 13.5, accel: 11, turnRate: 2.7, capacityBonus: 2, throwRange: 12 },
    canJump: false, unlockCost: 500,
  },
  {
    id: 'cargo', name: 'Cargo E-Bike', model: 'cargo', riding: 'pedal',
    stats: { maxSpeed: 9.5, accel: 9, turnRate: 2.4, capacityBonus: 5, throwRange: 12 },
    canJump: false, unlockCost: 800,
  },
];
