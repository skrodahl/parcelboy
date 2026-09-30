// §10: pre-render the whole neighborhood map once to an offscreen 2D canvas
// (grass, roads, sidewalks, houses, park, pond, lot). The corner radar and the
// full-screen map both draw from this shared bitmap, so the map costs zero GPU
// draw calls. Colors are chosen for a readable "paper map" look, not fidelity.

// Per-tile ground color (tilemap keys, PLAN §6.2). Houses/buildings/trees are
// drawn in a second pass on top of a grass base.
const GROUND = {
  forest: '#415d3a', yard: '#8ac46f', road: '#454a58', sidewalk: '#d8d2c4',
  porch: '#c8a06a', driveway: '#e2dccb', house: '#8ac46f', building: '#8ac46f',
  tree: '#8ac46f', park: '#9ed8a8', path: '#d9c8a4', pond: '#5aa9e6', lot: '#5a5f6b',
};
// A small rotating roof palette so neighbouring houses differ at a glance.
const HOUSE_ROOF = ['#b56576', '#c47a5a', '#8a90c4', '#c4869c', '#9c88ff', '#d19b5a', '#7a9e7e'];
const BUILDING = '#9aa0b5';

// Internal resolution: px per tile. 6 keeps the full-screen map crisp when it is
// scaled up to the viewport (the plan's "3 px/tile" blurs too far under the
// radar's 2.2× zoom; noted in Decisions).
const PX = 6;

export function renderMapCanvas(tm) {
  const def = tm.def;
  const w = tm.width * PX, h = tm.height * PX;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');

  // Pass 1: flat ground per tile (grass base under houses/buildings/trees).
  for (let z = 0; z < tm.height; z++) {
    for (let x = 0; x < tm.width; x++) {
      g.fillStyle = GROUND[tm.keyAt(x, z)] || GROUND.yard;
      g.fillRect(x * PX, z * PX, PX, PX);
    }
  }

  // Pass 2: roof footprints + a canopy dot per tree, on top of the grass.
  def.houses.forEach((hh, i) => {
    g.fillStyle = HOUSE_ROOF[i % HOUSE_ROOF.length];
    g.fillRect(hh.x * PX, hh.z * PX, 2 * PX, 2 * PX);
  });
  for (const b of def.buildings) {
    g.fillStyle = b.kind === 'depot' ? '#d19b5a' : BUILDING;
    g.fillRect(b.x * PX, b.z * PX, b.w * PX, b.d * PX);
  }
  for (let z = 0; z < tm.height; z++) {
    for (let x = 0; x < tm.width; x++) {
      if (tm.keyAt(x, z) === 'tree') {
        g.fillStyle = '#3f7d4f';
        const r = PX * 0.55;
        g.beginPath(); g.arc(x * PX + PX / 2, z * PX + PX / 2, r, 0, Math.PI * 2); g.fill();
      }
    }
  }
  return { canvas: c, w, h, pxPerUnit: PX / tm.tileSize };
}
