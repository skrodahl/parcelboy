import * as THREE from 'three';
import { VoxelBuilder } from '../render/voxel.js';
import { PALETTE } from '../data/palette.js';

// §7.6: vehicle models are built from boxes by id through the `models`
// registry (§5.4). Each model is a single merged mesh; wheels don't spin
// (the rider bobs and tilts 8° into turns — handled by the player).
// Local frame: root at the ground, forward = +Z.
export const MODELS = {};
export function registerModel(id, builder) { MODELS[id] = builder; }
export function buildModel(id, material) {
  const b = MODELS[id];
  return b ? b(material) : null;
}

// A two-wheeled frame: wheels, fork, handlebar, seat. Shared by bike/cargo.
function twoWheelFrame(b, color) {
  b.box(0, 0.06, -0.62, 0.08, 0.5, 0.42, '#22223b'); // rear wheel (disc in Y-Z)
  b.box(0, 0.06, 0.62, 0.08, 0.5, 0.42, '#22223b'); // front wheel
  b.box(0, 0.5, -0.55, 0.1, 0.34, 0.5, color); // rear tube
  b.box(0, 0.62, 0.05, 0.1, 0.1, 0.7, color); // top tube
  b.box(0, 0.5, 0.55, 0.08, 0.5, 0.08, color); // front fork
  b.box(0, 0.92, 0.55, 0.56, 0.08, 0.08, '#22223b'); // handlebar
  b.box(0, 0.66, -0.35, 0.3, 0.1, 0.34, '#22223b'); // seat
  b.box(-0.16, 0.3, 0.1, 0.1, 0.06, 0.1, '#22223b'); // pedals
  b.box(0.16, 0.3, 0.1, 0.1, 0.06, 0.1, '#22223b');
}

registerModel('bike', (mat) => {
  const b = new VoxelBuilder(801);
  twoWheelFrame(b, '#8338ec');
  b.box(0, 0.3, 0.95, 0.42, 0.34, 0.4, PALETTE.brand); // front crate
  b.box(0, 0.5, 0.95, 0.42, 0.06, 0.4, PALETTE.brandAccent);
  return new THREE.Mesh(b.toGeometry(), mat);
});

registerModel('scooter', (mat) => {
  const b = new VoxelBuilder(802);
  b.box(0, 0.04, 0.5, 0.08, 0.36, 0.36, '#22223b');
  b.box(0, 0.04, -0.5, 0.08, 0.36, 0.36, '#22223b');
  b.box(0, 0.3, 0, 0.2, 0.08, 1.1, '#f4a261'); // deck
  b.box(0, 0.34, 0.55, 0.08, 0.62, 0.08, '#5f6275'); // stem
  b.box(0, 0.94, 0.55, 0.5, 0.08, 0.08, '#22223b'); // handlebar
  return new THREE.Mesh(b.toGeometry(), mat);
});

registerModel('cargo', (mat) => {
  const b = new VoxelBuilder(803);
  twoWheelFrame(b, '#073b4c');
  // Big front cargo box with the Quickbox colors + a flat Q plate.
  b.box(0, 0.28, 0.95, 0.66, 0.62, 0.62, PALETTE.brand);
  b.box(0, 0.42, 1.28, 0.5, 0.34, 0.04, PALETTE.trim);
  b.box(0, 0.49, 1.3, 0.14, 0.2, 0.05, PALETTE.brand); // the "Q" block
  return new THREE.Mesh(b.toGeometry(), mat);
});

// Seat / deck heights where the rider's rig root sits, per model id.
export const RIDE_HEIGHT = { feet: 0, bike: 0.72, scooter: 0.34, cargo: 0.72 };
