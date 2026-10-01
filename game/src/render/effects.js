import * as THREE from 'three';
import { PALETTE } from '../data/palette.js';
import { CARTOON } from '../data/config.js';

// §2.12 / M5: cartoon particle bursts — confetti (delivery), dust (bonks),
// water splash, pink frosting splat. All particles share ONE InstancedMesh
// (a pool of tiny cubes with per-instance color + scale) = 1 draw call.

const MAX = 128;
const CONFETTI_COLORS = [PALETTE.brand, PALETTE.brandAccent, '#ff8fab', '#4cc9f0', '#80b918', '#f4a261'];

export function createEffects(scene) {
  const geo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
  const mat = new THREE.MeshLambertMaterial({ vertexColors: false });
  const mesh = new THREE.InstancedMesh(geo, mat, MAX);
  mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.renderOrder = 5;
  scene.add(mesh);

  // Preallocated particle records (no runtime growth).
  const P = [];
  for (let i = 0; i < MAX; i++) {
    P.push({ active: false, x: 0, y: -10, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, s: 1, color: '#fff', spin: 0, type: 'confetti' });
    mesh.setColorAt(i, new THREE.Color('#ffffff'));
  }
  mesh.instanceColor.needsUpdate = true;
  let cursor = 0;

  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const col = new THREE.Color();
  let colorsDirty = true;

  function spawnOne(type, x, y, z, vx, vy, vz, life, color, scl) {
    const i = cursor;
    cursor = (cursor + 1) % MAX;
    const pt = P[i];
    pt.active = true; pt.type = type;
    pt.x = x; pt.y = y; pt.z = z;
    pt.vx = vx; pt.vy = vy; pt.vz = vz;
    pt.life = 0; pt.max = life;
    pt.s = scl; pt.spin = 4 + Math.random() * 4;
    pt.color = color;
    col.set(color);
    mesh.setColorAt(i, col);
    colorsDirty = true;
  }

  // A burst of `n` particles with a random upward/outward cone.
  function burst(type, x, y, z, n, opts) {
    const speed = opts.speed || 3;
    const up = opts.up !== undefined ? opts.up : 1;
    const colors = opts.colors || CONFETTI_COLORS;
    const life = opts.life || 0.9;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 0.6;
      const vx = Math.cos(a) * r * speed;
      const vz = Math.sin(a) * r * speed;
      const vy = speed * up * (0.6 + Math.random() * 0.8);
      spawnOne(type, x, y, z, vx, vy, vz, life, colors[(Math.random() * colors.length) | 0], opts.scale || 1);
    }
  }

  return {
    mesh,
    // Public burst helpers (called by parcels.js / main.js on events).
    confetti(x, y, z) { if (CARTOON.enabled) burst('confetti', x, y, z, CARTOON.confettiCount, { speed: 3.2, up: 1.8, life: 1.1, scale: 2.0 }); },
    dust(x, y, z) { burst('dust', x, y, z, 6, { speed: 1.6, up: 0.4, life: 0.5, colors: ['#cfc4b8', '#b8ad9e'], scale: 1.4 }); },
    splash(x, y, z) { burst('splash', x, y, z, 12, { speed: 2.4, up: 1.8, life: 0.7, colors: ['#4cc9f0', '#90e0ef', '#bde0fe'], scale: 1.0 }); },
    splat(x, y, z) { burst('splat', x, y, z, 12, { speed: 2.0, up: 0.8, life: 0.6, colors: ['#ff8fab', '#fffaf0', '#f4acb7'], scale: 1.3 }); },
    // §2.15: broken-window glass shards (a quick, sharp cyan/white burst).
    shards(x, y, z) { if (CARTOON.enabled) burst('shards', x, y, z, 22, { speed: 3.4, up: 1.0, life: 1.0, colors: ['#bde0fe', '#fffaf0', '#90e0ef', '#ffffff'], scale: 1.8 }); },
    // §2.7: a sprinkler's rotating spray — a few light-blue droplets arcing
    // outward from the head each frame (called while the sprinkler is on).
    spray(x, z, angle) {
      const n = 3;
      for (let i = 0; i < n; i++) {
        const a = angle + (i - 1) * 0.6; // spread over ~±0.6 rad of the head
        const sp = 3.5 + Math.random() * 2;
        spawnOne('splash', x + Math.sin(a) * 0.4, 1.05, z + -Math.cos(a) * 0.4, Math.sin(a) * sp, 2.5 + Math.random(), -Math.cos(a) * sp, 0.6, '#90e0ef', 0.9);
      }
    },
    // §2.12: a ×3-streak celebration — a quick rainbow ring burst (a jingle
    // plays alongside; see audio.js `streak`).
    celebrate(x, y, z) {
      if (!CARTOON.enabled) return;
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2;
        const c = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
        spawnOne('confetti', x, y + 0.5, z, Math.cos(a) * 3.2, 4 + Math.random() * 2, Math.sin(a) * 3.2, 0.9, c, 1.8);
      }
    },
    // §2.12: speed lines when sprinting / on Turbo — a few fast white streaks
    // trailing behind the courier (a short-lived comet trail).
    speedLines(x, z, vx, vz) {
      for (let i = 0; i < 3; i++) {
        const o = (i - 1) * 0.3;
        spawnOne('dust', x - vx * 0.05 - o, 0.3 + i * 0.15, z - vz * 0.05, -vx * 0.2, 1.5, -vz * 0.2, 0.35, '#ffffff', 0.9);
      }
    },
    step(dt) {
      let any = false;
      for (let i = 0; i < MAX; i++) {
        const pt = P[i];
        if (!pt.active) continue;
        any = true;
        pt.life += dt;
        if (pt.life >= pt.max) {
          pt.active = false;
          s.set(0.001, 0.001, 0.001);
          p.set(0, -10, 0);
          m4.compose(p, q.identity(), s);
          mesh.setMatrixAt(i, m4);
          continue;
        }
        const k = pt.life / pt.max;
        if (pt.type === 'dust') {
          // Puff: rise slowly, expand then shrink.
          pt.y += pt.vy * dt;
          const sc = pt.s * (k < 0.4 ? (k / 0.4) * 1.6 : 1.6 * (1 - (k - 0.4) / 0.6));
          s.set(Math.max(0.001, sc), Math.max(0.001, sc), Math.max(0.001, sc));
          p.set(pt.x, pt.y, pt.z);
          m4.compose(p, q.identity(), s);
          mesh.setMatrixAt(i, m4);
          continue;
        }
        // Gravity for confetti / splash / splat.
        pt.vy -= 14 * dt;
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.z += pt.vz * dt;
        if (pt.y < 0.05) { pt.y = 0.05; pt.vy *= -0.3; pt.vx *= 0.7; pt.vz *= 0.7; }
        const fade = pt.type === 'confetti' ? (k > 0.7 ? (1 - k) / 0.3 : 1) : (1 - k);
        const sc = Math.max(0.001, pt.s * fade);
        s.set(sc, sc, sc);
        p.set(pt.x, pt.y, pt.z);
        e.set(pt.life * pt.spin, pt.life * pt.spin * 0.7, 0);
        q.setFromEuler(e);
        m4.compose(p, q, s);
        mesh.setMatrixAt(i, m4);
      }
      if (any) {
        mesh.instanceMatrix.needsUpdate = true;
        if (colorsDirty) { mesh.instanceColor.needsUpdate = true; colorsDirty = false; }
      }
    },
  };
}
