import mapleHollow from './maple-hollow.js';
import testHills from './test-hills.js';
import cedarHeights from './cedar-heights.js';

// §2.18: the neighborhoods, looked up by id. `debug` ones (the §2.19 terrain
// test map) are loadable via `?nb=` but excluded from the region map / save /
// suburb unlocks.
export const NEIGHBORHOODS = [mapleHollow, cedarHeights, testHills];
export const DEFAULT_NEIGHBORHOOD = 'maple-hollow';

export function getNeighborhood(id) {
  for (const n of NEIGHBORHOODS) if (n.id === id) return n;
  return NEIGHBORHOODS[0];
}
