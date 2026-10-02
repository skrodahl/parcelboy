import * as THREE from 'three';
import { VoxelBuilder } from '../render/voxel.js';
import { PALETTE } from '../data/palette.js';
import { PARCEL, SCORING } from '../data/config.js';

// §2.4: the parcel pool. Each slot is a Mesh whose geometry is swapped to the
// package's model on acquire. One shared world Lambert material (vertex
// colors baked into the geometry). Flight is a gravity-only arc; on the
// ground the parcel bounces (35%/50%), slides 0.2 s, rests, and is judged.

const G = PARCEL.gravity;

// Parcel model geometry per package (small stacked boxes, vertex-colored).
function buildParcelGeometry(model, colors) {
  const b = new VoxelBuilder(9000 + model.length);
  const box = colors.box || PALETTE.parcel;
  const tape = colors.tape || PALETTE.parcelTape;
  let w = 0.62, h = 0.5, d = 0.52;
  if (model === 'parcelHeavy') { w = 0.82; h = 0.66; d = 0.72; }
  b.box(0, 0, 0, w, h, d, box, { skipFaces: ['bottom'] });
  b.box(0, h * 0.42, -d / 2 - 0.01, w * 0.8, h * 0.16, 0.02, tape); // front tape band
  b.box(0, h * 0.42, d / 2 + 0.01, w * 0.8, h * 0.16, 0.02, tape);
  if (model === 'parcelFragile') b.box(0, h * 0.62, d / 2 + 0.02, 0.24, 0.14, 0.02, colors.label); // red ▲ label
  if (model === 'parcelExpress') b.box(0, h * 0.3, -d / 2 - 0.02, w, 0.1, 0.02, colors.label); // ⚡ stripe
  if (model === 'parcelCake') { // white ribbon bow
    b.box(-0.12, h + 0.05, 0, 0.2, 0.1, 0.2, colors.label);
    b.box(0.12, h + 0.05, 0, 0.2, 0.1, 0.2, colors.label);
    b.box(0, h + 0.03, 0, 0.1, 0.14, 0.1, colors.label);
  }
  return b.toGeometry();
}

// Judge where a resting parcel landed (parcels.js decides the outcome key;
// scoring.js turns it into points). Returns 'perfect'|'nice'|'sloppy'|'wrong'
// |'wrongAddress'|'road'|'splash'|'missed'. `target` = the target object this
// parcel was thrown at (its address, or null); `houseRects` = { house, porch,
// lot } for every house; `targetHouseIds` = the set of target house ids (§2.16).
function judgeZone(x, z, target, houseRects, world, targetHouseIds) {
  const t = world.tilemap;
  const key = t.keyAt(Math.floor(x / t.tileSize), Math.floor(z / t.tileSize));
  if (key === 'pond') return 'splash';
  if (key === 'road') return 'road';
  if (target) {
    const dm = target.doormat;
    if (x >= target.porch.minX && x <= target.porch.maxX && z >= target.porch.minZ && z <= target.porch.maxZ) {
      const dx = x - dm.x, dz = z - dm.z;
      return dx * dx + dz * dz <= SCORING.perfectRadius * SCORING.perfectRadius ? 'perfect' : 'nice';
    }
    if (x >= target.lot.minX && x <= target.lot.maxX && z >= target.lot.minZ && z <= target.lot.maxZ) return 'sloppy';
  }
  const selfHouse = target ? target.house : null;
  for (let i = 0; i < houseRects.length; i++) {
    const r = houseRects[i];
    if (r.house === selfHouse) continue;
    const onHouse =
      (x >= r.porch.minX && x <= r.porch.maxX && z >= r.porch.minZ && z <= r.porch.maxZ) ||
      (x >= r.lot.minX && x <= r.lot.maxX && z >= r.lot.minZ && z <= r.lot.maxZ);
    if (!onHouse) continue;
    // §2.16: landing on ANOTHER target's house is "Wrong address!" (the parcel is
    // lost); a non-target house stays "Wrong house!".
    return targetHouseIds && targetHouseIds.has(r.house.id) ? 'wrongAddress' : 'wrong';
  }
  return 'missed';
}

export function createParcels({ scene, material, world, packages, targets, houseRects, rng, effects, onRest, onThrow, onMailbox, mailboxes, targetHouseIds }) {
  const geos = {};
  for (const p of packages) geos[p.id] = buildParcelGeometry(p.model, p.colors);
  const defaultGeo = geos.standard;

  // Preallocated pool (no growth at runtime).
  const parcels = [];
  for (let i = 0; i < PARCEL.pool; i++) {
    const mesh = new THREE.Mesh(defaultGeo, material);
    mesh.visible = false;
    mesh.castShadow = true;
    scene.add(mesh);
    parcels.push({
      mesh, state: 'idle', pkg: null, target: null,
      vel: new THREE.Vector3(), spin: 0,
      contact: 0, slideT: 0, roofT: 0, jellyT: 0,
      impact: 0, dist: 0, airMail: false, rest: 0, mailHit: false, trick: false,
    });
  }
  let cooldown = 0;
  const tmp = new THREE.Vector3();

  // Launch the next free parcel. from = {x,y,z}, to = {x,z} (aim point),
  // info = { pkg, target, airMail }. Returns the parcel or null if the pool
  // is full / on cooldown.
  function throwParcel(from, to, info) {
    if (cooldown > 0) return null;
    let p = null;
    for (let i = 0; i < parcels.length; i++) if (parcels[i].state === 'idle') { p = parcels[i]; break; }
    if (!p) return null;
    p.pkg = info.pkg;
    p.target = info.target;
    p.airMail = !!info.airMail;
    p.trick = !!info.trick; // §2.8 Trick Shot: a banked throw scores PERFECT on the target
    p.mesh.geometry = geos[info.pkg.id] || defaultGeo;
    p.mesh.position.set(from.x, from.y, from.z);
    p.mesh.visible = true;
    p.mesh.scale.set(1, 1, 1);
    p.mesh.rotation.set(0, 0, 0);
    p.spin = 0;
    p.contact = 0;
    p.slideT = 0; p.roofT = 0; p.jellyT = 0; p.mailHit = false;
    const dx = to.x - from.x, dz = to.z - from.z;
    const dist = Math.hypot(dx, dz);
    p.dist = dist;
    p.impact = 0;
    const t = Math.max(PARCEL.minTime, Math.min(PARCEL.maxTime, dist / PARCEL.timeDivisor));
    const gy = groundY(to.x, to.z); // land on the aim tile's surface
    p.vel.set(dx / t, (0.5 * G * t * t - (from.y - gy)) / t, dz / t);
    p.state = 'flying';
    cooldown = PARCEL.cooldown;
    if (onThrow) onThrow(p);
    return p;
  }

  // §2.19: the parcel's ground = the terrain level + the curb (0.12 on s/o/d).
  // On a flat neighborhood the terrain term is 0, so this is the old curb-only
  // value.
  function groundY(x, z) {
    const t = world.tilemap;
    const ty = world.terrain ? world.terrain.baseYAt(x, z) : 0;
    return ty + (t.surfH(t.keyAt(Math.floor(x / t.tileSize), Math.floor(z / t.tileSize))) || 0);
  }

  // Roof vs. wall on an in-flight hit (world.colliders: boxes with h = roof top).
  function checkColliders(p) {
    const colliders = world.colliders;
    const y = p.mesh.position.y;
    for (let i = 0; i < colliders.length; i++) {
      const c = colliders[i];
      if (c.type !== 'box' || !c.h) continue;
      if (p.mesh.position.x > c.minX && p.mesh.position.x < c.maxX && p.mesh.position.z > c.minZ && p.mesh.position.z < c.maxZ) {
        if (y > c.h + 2) continue; // well above the roof → pass over, keep flying
        if (y > c.h - 1.2) { // roof band → land on the roof (judged after roof-luck)
          p.mesh.position.y = c.h;
          p.vel.set(0, 0, 0);
          p.state = 'roofWait';
          p.roofT = 0;
          if (effects) effects.dust(p.mesh.position.x, c.h, p.mesh.position.z);
        } else { // wall → drop straight down at the wall face
          const px = p.mesh.position.x - (c.minX + c.maxX) / 2;
          const pz = p.mesh.position.z - (c.minZ + c.maxZ) / 2;
          // push to the nearest outer face
          const ox = c.maxX - p.mesh.position.x + 0.3, oxn = p.mesh.position.x - c.minX - 0.3;
          const oz = c.maxZ - p.mesh.position.z + 0.3, ozn = p.mesh.position.z - c.minZ - 0.3;
          let dx = 0, dz = 0;
          if (Math.abs(px) > Math.abs(pz)) { dx = px > 0 ? ox : -oxn; } else { dz = pz > 0 ? oz : -ozn; }
          p.mesh.position.x += dx;
          p.mesh.position.z += dz;
          p.vel.set(0, -2, 0); // drop straight down
          p.state = 'bouncing';
          p.contact = 0;
        }
        return;
      }
    }
  }

  function firstContact(p) {
    p.impact = p.vel.length();
    p.jellyT = 0.01; // start the jelly wobble
    p.contact = 1;
    p.vel.y = -p.vel.y * PARCEL.bounceVert;
    p.vel.x *= PARCEL.bounceHoriz;
    p.vel.z *= PARCEL.bounceHoriz;
    p.state = 'bouncing';
    if (effects) effects.dust(p.mesh.position.x, groundY(p.mesh.position.x, p.mesh.position.z), p.mesh.position.z);
  }

  function step(dt) {
    if (cooldown > 0) cooldown -= dt;
    const colliders = world.colliders;
    for (let i = 0; i < parcels.length; i++) {
      const p = parcels[i];
      const m = p.mesh;
      if (p.state === 'idle' || p.state === 'resting') continue;
      if (p.state === 'flying' || p.state === 'bouncing') {
        m.position.x += p.vel.x * dt;
        m.position.y += p.vel.y * dt;
        m.position.z += p.vel.z * dt;
        p.vel.y -= G * dt;
        p.spin += dt * 6;
        m.rotation.x = p.spin;
        m.rotation.z = p.spin * 0.6;
        // §2.12 mailbox gag: clipping a mailbox pops the flag + a gentle drop.
        if (p.state === 'flying' && !p.mailHit && mailboxes && mailboxes.length) {
          for (let k = 0; k < mailboxes.length; k++) {
            const ddx = m.position.x - mailboxes[k][0], ddz = m.position.z - mailboxes[k][1];
            if (ddx * ddx + ddz * ddz < 0.8 * 0.8) {
              p.mailHit = true;
              p.vel.x *= 0.8; p.vel.z *= 0.8; p.vel.y = Math.min(p.vel.y, 0.4);
              if (onMailbox) onMailbox(mailboxes[k][0], mailboxes[k][1]);
              break;
            }
          }
        }
        if (p.state === 'flying') checkColliders(p);
        if (p.state !== 'flying' && p.state !== 'bouncing') continue; // became roofWait
        const gy = groundY(m.position.x, m.position.z);
        if (m.position.y <= gy && p.vel.y < 0) {
          m.position.y = gy;
          const key = world.tilemap.keyAt(Math.floor(m.position.x / world.tilemap.tileSize), Math.floor(m.position.z / world.tilemap.tileSize));
          if (key === 'pond') {
            p.vel.set(0, 0, 0);
            p.state = 'resting';
            if (effects) effects.splash(m.position.x, 0, m.position.z);
            onRest(p, 'splash');
            continue;
          }
          if (p.contact === 0) firstContact(p);
          else { p.state = 'sliding'; p.slideT = 0; p.vel.y = 0; }
        }
      } else if (p.state === 'sliding') {
        p.slideT += dt;
        m.position.x += p.vel.x * dt * 0.4;
        m.position.z += p.vel.z * dt * 0.4;
        p.vel.x *= 0.9; p.vel.z *= 0.9;
        m.rotation.x += dt * 3;
        if (p.slideT >= PARCEL.slideTime) {
          p.state = 'resting';
          onRest(p, judgeZone(m.position.x, m.position.z, p.target, houseRects, world, targetHouseIds));
        }
      } else if (p.state === 'roofWait') {
        p.roofT += dt;
        // §2.12 roof luck: after the slide delay, 35% flip off onto the porch.
        if (p.roofT >= 0.5) {
          p.state = 'resting';
          if (rng() < 0.35 && p.target) {
            const dm = p.target.doormat;
            m.position.set(dm.x, groundY(dm.x, dm.z), dm.z); // §2.19: land on the porch's level
            onRest(p, 'lucky');
          } else {
            onRest(p, 'roof');
          }
        }
      }
    }
  }

  function activeCount() {
    let n = 0;
    for (let i = 0; i < parcels.length; i++) if (parcels[i].state !== 'idle' && parcels[i].state !== 'resting') n++;
    return n;
  }

  return { throwParcel, step, activeCount, parcels, cooldownGet() { return cooldown; } };
}
