// Preallocated object pool (§5.8). Everything spawned during play comes
// from pools created at boot; acquire/release move items along a free list.
export function createPool(size, create, reset) {
  const items = new Array(size);
  const free = new Array(size);
  let freeCount = size;
  for (let i = 0; i < size; i++) {
    items[i] = create ? create(i) : {};
    free[i] = items[i];
  }
  return {
    items,
    acquire() {
      if (freeCount === 0) return null;
      freeCount--;
      return free[freeCount];
    },
    release(item) {
      if (reset) reset(item);
      free[freeCount++] = item;
    },
    freeCount() {
      return freeCount;
    },
  };
}
