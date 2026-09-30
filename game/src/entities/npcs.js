import * as THREE from 'three';
import { VoxelBuilder } from '../render/voxel.js';
import { PALETTE } from '../data/palette.js';

// §2.4 / §7.6: after a successful delivery a resident pops out of the door,
// reacts (waves / jumps for joy on a PERFECT) for ~1.5 s, then goes back in.
// Pooled: a fixed set of resident rigs, one visible per active house.

const SKINS = ['#f1c27d', '#8d5524', '#c68642', '#f8d5b0', '#e0ac69'];
const SHIRTS = ['#ef476f', '#2a9d8f', '#8338ec', '#ff8c42', '#118ab2'];

function buildResident(seed) {
  let h = seed;
  const pick = (arr) => arr[h % arr.length];
  h = (h * 31 + 7) | 0;
  const skin = pick(SKINS), shirt = pick(SHIRTS);
  const b = new VoxelBuilder(seed);
  b.box(0, 0.6, 0, 0.46, 0.7, 0.34, shirt, { skipFaces: ['bottom'] });      // torso
  b.box(0, 1.3, 0, 0.34, 0.34, 0.34, skin, { skipFaces: ['bottom'] });     // head
  b.box(-0.1, 1.15, 0.18, 0.1, 0.05, 0.04, '#22223b');                    // eyes
  b.box(0.1, 1.15, 0.18, 0.1, 0.05, 0.04, '#22223b');
  b.box(-0.3, 0.7, 0, 0.14, 0.5, 0.16, shirt);                             // static arm
  b.box(-0.1, 0, 0, 0.18, 0.6, 0.2, '#3d5a80');                           // legs
  b.box(0.1, 0, 0, 0.18, 0.6, 0.2, '#3d5a80');
  const body = new THREE.Mesh(b.toGeometry(), null);
  const ab = new VoxelBuilder(seed + 1);
  ab.box(0, -0.5, 0, 0.14, 0.5, 0.16, shirt);
  const arm = new THREE.Mesh(ab.toGeometry(), null);
  const group = new THREE.Group();
  group.add(body, arm);
  return { group, body, arm, wave: false, t: 0, active: false, outcome: 'nice', house: null };
}

export function createNpcs(scene, material, world, poolSize) {
  const npcs = [];
  for (let i = 0; i < poolSize; i++) {
    const r = buildResident(1234 + i * 101);
    r.body.material = material;
    r.arm.material = material;
    r.group.visible = false;
    r.group.scale.set(0.001, 0.001, 0.001);
    scene.add(r.group);
    npcs.push(r);
  }

  // Pop a resident out of `house`'s door reacting to `outcome`.
  function react(houseId, outcome) {
    let r = null;
    for (let i = 0; i < npcs.length; i++) if (npcs[i].active && npcs[i].house === houseId) { r = npcs[i]; break; }
    if (!r) {
      for (let i = 0; i < npcs.length; i++) if (!npcs[i].active) { r = npcs[i]; break; }
      if (!r) return;
    }
    const dm = world.doormatPoints[houseId];
    if (!dm) return;
    r.active = true;
    r.house = houseId;
    r.outcome = outcome;
    r.t = 0;
    r.wave = true;
    r.group.visible = true;
    r.group.position.set(dm.x, 0, dm.z - 0.4); // just inside the door
    // Face the porch (outward, away from the house center).
    const h = world.tilemap.def.houses.find((x) => x.id === houseId);
    const facing = { N: Math.PI, S: 0, E: Math.PI / 2, W: -Math.PI / 2 }[h.facing];
    r.group.rotation.y = facing;
  }

  function step(dt) {
    for (let i = 0; i < npcs.length; i++) {
      const r = npcs[i];
      if (!r.active) continue;
      r.t += dt;
      const T = 1.5;
      const k = r.t / T;
      // Pop out (scale up) in the first 0.2 s, hold, then go back in.
      let s = 1;
      if (r.t < 0.2) s = r.t / 0.2;
      else if (r.t > T - 0.2) s = (T - r.t) / 0.2;
      s = Math.max(0.001, Math.min(1, s));
      r.group.scale.set(s, s, s);
      // Jump for joy on a PERFECT.
      r.group.position.y = r.outcome === 'perfect' ? Math.abs(Math.sin(r.t * 6)) * 0.3 : 0;
      // Wave the arm (or hold it for a handshake).
      if (r.wave) r.arm.rotation.z = 2.0 + 0.5 * Math.sin(r.t * 8);
      else r.arm.rotation.z = 0;
      if (r.t >= T) {
        r.active = false;
        r.group.visible = false;
      }
    }
  }

  return { react, step };
}
