import { VoxelBuilder } from '../render/voxel.js';

// §8: static world is merged into 12x10-tile chunks (a 4x4 grid = 16 chunks).
// Each chunk gets <= 3 meshes (opaque here; glow/water are added by the builder).
export const CHUNK_W = 12;
export const CHUNK_H = 10;

export function createChunkGrid(width, height, seed) {
  const cW = Math.ceil(width / CHUNK_W);
  const cH = Math.ceil(height / CHUNK_H);
  const chunks = new Array(cW * cH);
  for (let cz = 0; cz < cH; cz++) {
    for (let cx = 0; cx < cW; cx++) {
      const i = cz * cW + cx;
      chunks[i] = { cx, cz, opaque: new VoxelBuilder(seed + i * 101), water: null };
    }
  }
  return {
    cW,
    cH,
    chunks,
    // Chunk that owns tile (x,z).
    chunkAt(x, z) {
      return this.chunks[Math.floor(z / CHUNK_H) * this.cW + Math.floor(x / CHUNK_W)];
    },
  };
}
