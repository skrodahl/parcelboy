import * as THREE from 'three';
import { VoxelBuilder } from '../render/voxel.js';
import { PALETTE } from '../data/palette.js';

// §7.5: chibi courier rig. The rig itself is 5 meshes (head+torso merged,
// 2 arms, 2 legs) all sharing the world's vertex-color Lambert material,
// plus one parcel-rack display mesh whose geometry is swapped from 13
// prebuilt variants (0..12 boxes) when the carried count changes.
// Local frame: root at the feet, forward = +Z. Animation is procedural from
// phase values (allocation-free update).

function idSeed(id) {
  let h = 7;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return h >>> 0;
}

const BUILDS = { slim: 0.44, regular: 0.52, sturdy: 0.62 }; // torso widths

// Parcel rack variants: 0..12 boxes, two columns of 0.4-wide parcels.
let rackGeos = null;
function rackGeometries() {
  if (rackGeos) return rackGeos;
  rackGeos = [];
  for (let n = 0; n <= 12; n++) {
    const b = new VoxelBuilder(4000 + n);
    for (let i = 0; i < n; i++) {
      const col = i % 2, row = (i / 2) | 0;
      const x = col === 0 ? -0.21 : 0.21;
      const y = 0.02 + row * 0.4;
      b.box(x, y, 0, 0.4, 0.4, 0.34, PALETTE.parcel);
      b.box(x, y + 0.17, 0.17, 0.12, 0.08, 0.04, PALETTE.parcelTape);
    }
    rackGeos.push(b.toGeometry());
  }
  return rackGeos;
}

// `charDef` = a data/characters.js entry; `material` = the shared world Lambert.
export function buildCourier(charDef, material) {
  const c = charDef.colors;
  const tw = BUILDS[charDef.build] || BUILDS.regular;
  const seed = idSeed(charDef.id);

  // Head + torso + face + cap (one merged mesh; static).
  const hb = new VoxelBuilder(seed);
  hb.box(0, 0.6, 0, tw, 0.65, tw * 0.78, c.shirt, { skipFaces: ['bottom'] });
  hb.box(0, 1.25, 0, 0.62, 0.62, 0.62, c.skin, { skipFaces: ['bottom'] });
  hb.box(0, 1.87, 0, 0.66, 0.2, 0.66, c.cap || c.hair, { skipFaces: ['bottom'] });
  if (c.hair) hb.box(0, 1.87, -0.14, 0.6, 0.12, 0.28, c.hair);
  hb.box(-0.14, 1.52, 0.31, 0.09, 0.13, 0.04, '#22223b'); // eyes
  hb.box(0.14, 1.52, 0.31, 0.09, 0.13, 0.04, '#22223b');
  hb.box(0, 1.38, 0.31, 0.22, 0.05, 0.04, '#a0522d'); // smile
  if (c.headphones) {
    hb.box(0, 1.84, 0, 0.72, 0.08, 0.72, c.headphones);
    hb.box(-0.37, 1.6, 0, 0.08, 0.22, 0.24, c.headphones);
    hb.box(0.37, 1.6, 0, 0.08, 0.22, 0.24, c.headphones);
  }
  if (c.goggles) hb.box(0, 1.92, 0.24, 0.4, 0.12, 0.08, c.goggles);
  const headTorso = new THREE.Mesh(hb.toGeometry(), material);

  // Arms: pivot at the shoulder (origin), hanging down -Y.
  const ab = new VoxelBuilder(seed + 1);
  ab.box(0, -0.55, 0, 0.16, 0.45, 0.18, c.shirt);
  ab.box(0, -0.62, 0, 0.14, 0.14, 0.16, c.skin);
  const armGeo = ab.toGeometry();
  const sx = tw / 2 + 0.1;
  const armL = new THREE.Mesh(armGeo, material);
  armL.position.set(-sx, 1.18, 0);
  const armR = new THREE.Mesh(armGeo, material);
  armR.position.set(sx, 1.18, 0);

  // Legs: pivot at the hip (origin), hanging down to the feet.
  const lb = new VoxelBuilder(seed + 2);
  lb.box(0, -0.56, 0, 0.22, 0.48, 0.26, c.pants);
  lb.box(0, -0.64, 0.04, 0.24, 0.12, 0.34, c.shoes);
  const legGeo = lb.toGeometry();
  const legL = new THREE.Mesh(legGeo, material);
  legL.position.set(-0.12, 0.6, 0);
  const legR = new THREE.Mesh(legGeo, material);
  legR.position.set(0.12, 0.6, 0);

  // Parcel rack on the back (display mesh; geometry swapped by count).
  const rack = new THREE.Mesh(rackGeometries()[0], material);
  rack.position.set(0, 0.75, -(tw * 0.78) / 2 - 0.24);
  rack.visible = false;

  const group = new THREE.Group();
  group.add(headTorso, armL, armR, legL, legR, rack);

  const rig = {
    group,
    headTorso,
    armL,
    armR,
    legL,
    legR,
    rack,
    _phase: Math.random() * 6,
    setCarried(n) {
      const g = rackGeometries();
      n = Math.max(0, Math.min(12, n | 0));
      rack.geometry = g[n];
      rack.visible = n > 0;
    },
    // s = { speedFrac, moving, wave, riding ('walk'|'pedal'|'stand'), air (-1 | 0..1), fall (0..1), t }
    update(dt, s) {
      this._phase += dt * (2 + 10 * s.speedFrac);
      const p = this._phase;
      const swing = Math.sin(p) * 0.55 * s.speedFrac * s.moving;
      this.legL.rotation.x = -swing;
      this.legR.rotation.x = swing;
      this.armL.rotation.x = swing;
      this.armR.rotation.x = -swing;
      if (s.riding === 'stand' || s.riding === 'pedal') {
        this.armL.rotation.x = -1.25;
        this.armR.rotation.x = -1.25;
        if (s.riding === 'pedal') {
          this.legL.rotation.x = 0.45 + 0.5 * Math.sin(p * 1.3);
          this.legR.rotation.x = 0.45 - 0.5 * Math.sin(p * 1.3);
        } else {
          this.legL.rotation.x = 0.3;
          this.legR.rotation.x = 0.3;
        }
      }
      // Wave: raise the right arm and flutter it.
      this.armR.rotation.z = s.wave ? 2.1 + 0.4 * Math.sin(s.t * 7) : 0;
      // Throw wind-up (§2.12 anticipation): cock the right arm and lean back.
      if (s.throw >= 0) {
        const th = s.throw; // 0..1 over the 0.06 s wind-up
        this.armR.rotation.z = 2.5 * th;
        this.armR.rotation.x = -1.3 * th;
        this.group.rotation.x = -0.16 * Math.sin(th * Math.PI);
      }
      // Idle breathing (subtle head scale).
      const breathe = s.moving ? 1 : 1 + 0.02 * Math.sin(s.t * 2.1);
      // Jump squash/stretch (0.9 takeoff/landing, 1.1 apex).
      let scaleY = s.air >= 0 ? 0.9 + 0.2 * Math.sin(Math.PI * s.air) : 1;
      if (s.air >= 0) { this.legL.rotation.x = 0.7; this.legR.rotation.x = 0.7; }

      // §2.12 knockdown gags (M7): flop / bee-panic hop / puffy face / pancake.
      if (s.panic) {
        this.group.position.y = Math.abs(Math.sin(s.t * 9)) * 0.4;
        this.armL.rotation.z = -2.0 + 0.3 * Math.sin(s.t * 12);
        this.armR.rotation.z = 2.0 + 0.3 * Math.sin(s.t * 12);
        this.group.rotation.x = 0.12;
      } else {
        this.group.position.y = 0;
        this.group.rotation.x = s.pancake ? -Math.PI * 0.5 : -Math.PI * 0.5 * s.fall;
        if (s.pancake) scaleY *= 0.45; // flattened on a car hit
      }
      // Puffy face: swell the head 1.35× (bee sting, §2.7).
      this.headTorso.scale.set(s.puffy ? 1.35 : 1, s.puffy ? 1.35 * breathe : breathe, s.puffy ? 1.35 : 1);
      this.group.scale.y = scaleY * (s.blink ? 0.92 : 1); // blinking invuln pulse
    },
  };
  return rig;
}
