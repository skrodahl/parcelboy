import { VoxelBuilder } from '../render/voxel.js';

// §7.5 / §2.7: the hazard meshes. Every hazard is one merged, vertex-colored
// Box-geometry (built with the shared VoxelBuilder) so an InstancedMesh of a
// whole pool renders in a single draw call under the shared world Lambert
// material. Geometry is local, base at y=0, forward = +Z.
// `color` values are baked into the geometry's vertex colors.

function carGeo(seed) {
  const op = new VoxelBuilder(seed);
  op.box(0, 0.35, 0.1, 1.9, 0.7, 3.9, '#118ab2', { skipFaces: ['bottom'] }); // body
  op.box(0, 0.6, 0.0, 1.7, 0.5, 3.3, '#0d739a', { skipFaces: ['bottom'] });  // bevel
  op.box(0, 0.85, -0.35, 1.55, 0.5, 2.2, '#118ab2', { skipFaces: ['bottom'] }); // cabin
  op.box(0, 0.85, 0.85, 1.4, 0.5, 0.12, '#bde0fe');  // windshield
  op.box(0, 0.85, -1.45, 1.4, 0.45, 0.12, '#bde0fe'); // rear glass
  for (const sx of [-1, 1]) for (const dz of [-1.25, 1.25]) op.box(sx * 0.95, 0.15, dz, 0.32, 0.32, 0.72, '#2f333d', { skipFaces: ['bottom'] });
  return op.toGeometry();
}

function dogGeo(seed) {
  const op = new VoxelBuilder(seed);
  op.box(0, 0.35, 0.15, 0.5, 0.4, 0.9, '#8a5a3b', { skipFaces: ['bottom'] }); // body
  op.box(0, 0.55, 0.75, 0.4, 0.35, 0.35, '#8a5a3b'); // head
  op.box(-0.12, 0.78, 0.82, 0.12, 0.2, 0.12, '#6e452c'); // ears
  op.box(0.12, 0.78, 0.82, 0.12, 0.2, 0.12, '#6e452c');
  op.box(0, 0.3, 0.95, 0.1, 0.1, 0.12, '#4a2e1b'); // nose
  for (const sx of [-1, 1]) for (const dz of [-0.35, 0.35]) op.box(sx * 0.16, 0.15, dz, 0.14, 0.3, 0.14, '#6e452c'); // legs
  op.box(0, 0.55, -0.45, 0.1, 0.1, 0.4, '#8a5a3b'); // tail
  return op.toGeometry();
}

function skaterGeo(seed) {
  const op = new VoxelBuilder(seed);
  op.box(0, 0.4, 0, 0.42, 0.5, 0.42, '#f4a261', { skipFaces: ['bottom'] }); // torso
  op.box(0, 0.9, 0, 0.34, 0.34, 0.34, '#f1c27d'); // head
  op.box(0, 1.08, 0, 0.36, 0.1, 0.3, '#22223b'); // helmet
  op.box(0, 0.05, 0, 0.6, 0.12, 1.0, '#4cc9f0'); // board
  op.box(-0.2, 0, 0.35, 0.14, 0.12, 0.14, '#2f333d'); // wheels
  op.box(0.2, 0, 0.35, 0.14, 0.12, 0.14, '#2f333d');
  op.box(-0.2, 0, -0.35, 0.14, 0.12, 0.14, '#2f333d');
  op.box(0.2, 0, -0.35, 0.14, 0.12, 0.14, '#2f333d');
  return op.toGeometry();
}

function beehiveGeo(seed) {
  // A short ground-level skep sitting at the tree base (below the canopy, so it
  // stays visible and the swarm cloud can hug it). Legs + honey-yellow stack.
  const op = new VoxelBuilder(seed);
  for (const sx of [-0.28, 0.28]) op.box(sx, 0.15, 0, 0.12, 0.3, 0.12, '#6e452c'); // legs
  op.box(0, 0.35, 0, 0.72, 0.26, 0.72, '#f4a261'); // base
  op.box(0, 0.52, 0, 0.84, 0.28, 0.84, '#ffca3a'); // mid
  op.box(0, 0.72, 0, 0.6, 0.26, 0.6, '#f4a261'); // top
  op.box(0, 0.42, 0.34, 0.2, 0.16, 0.16, '#22223b'); // entrance
  return op.toGeometry();
}

// A single bee (2-box body + wings). The swarm InstancedMesh reuses this; the
// swarm's ~24 instances orbit a center so a cluster reads as a buzzing cloud.
function beeGeo(seed) {
  const op = new VoxelBuilder(seed);
  op.box(0, 0, 0, 0.3, 0.24, 0.42, '#ffd166');
  op.box(0, 0, 0.09, 0.34, 0.26, 0.09, '#22223b');
  op.box(-0.24, 0.12, 0, 0.26, 0.06, 0.3, '#ffffff');
  op.box(0.24, 0.12, 0, 0.26, 0.06, 0.3, '#ffffff');
  return op.toGeometry();
}

function binGeo(seed) {
  const op = new VoxelBuilder(seed);
  op.box(0, 0.4, 0, 0.6, 0.8, 0.6, '#06d6a0', { skipFaces: ['bottom'] }); // body
  op.box(0, 0.84, 0, 0.66, 0.12, 0.66, '#05b58c'); // lid
  op.box(0.14, 0.92, 0, 0.3, 0.06, 0.14, '#05b58c'); // handle
  return op.toGeometry();
}

function coneGeo(seed) {
  const op = new VoxelBuilder(seed);
  op.box(0, 0.05, 0, 0.5, 0.1, 0.5, '#fb8500'); // base
  op.box(0, 0.28, 0, 0.34, 0.45, 0.34, '#fb8500');
  op.box(0, 0.4, 0, 0.4, 0.12, 0.4, '#fff'); // white band
  op.box(0, 0.6, 0, 0.14, 0.24, 0.14, '#fb8500');
  return op.toGeometry();
}

function sprinklerGeo(seed) {
  const op = new VoxelBuilder(seed);
  op.box(0, 0.3, 0, 0.5, 0.6, 0.5, '#118ab2', { skipFaces: ['bottom'] }); // base
  op.box(0, 0.75, 0, 0.16, 0.5, 0.16, '#0d739a'); // riser
  op.box(0, 1.05, 0, 0.5, 0.14, 0.5, '#4cc9f0'); // spray head
  op.box(0.22, 1.05, 0, 0.14, 0.2, 0.14, '#4cc9f0'); // nozzle
  return op.toGeometry();
}

// Build all hazard geometries once (keyed by model id). Shared by the pool
// InstancedMeshes; all render under the world's vertex-color Lambert material.
export function buildHazardGeos(seed = 1) {
  return {
    car: carGeo(seed),
    dog: dogGeo(seed + 1),
    skater: skaterGeo(seed + 2),
    beehive: beehiveGeo(seed + 3),
    bee: beeGeo(seed + 4),
    bin: binGeo(seed + 5),
    cone: coneGeo(seed + 6),
    sprinkler: sprinklerGeo(seed + 7),
  };
}
