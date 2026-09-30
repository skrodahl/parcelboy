import * as THREE from 'three';

// §7.9: angled follow cam (the menu/screenshot presets stay in main.js).
// The cam sits behind the player: desired = player + rotateY(camYaw)·(0,11,13)
// with "behind" opposite the heading, so camYaw eases toward -heading.
// All scratch objects are allocation-free; `camLookOut` receives the look
// point so the distance-scaled fog/far (§7.3 plan change) can follow.
// If `collision` is given, the cam position is marched back toward the look
// target until it is outside statics (the cam never sits inside a building).
const N_STEPS = 16; // march resolution for clearPos

export function createFollowCam(camera, collision) {
  const desired = new THREE.Vector3();
  const look = new THREE.Vector3();
  const cand = new THREE.Vector3();
  const res = { hit: false, nx: 0, nz: 0 };
  let camYaw = 0;
  let trauma = 0;
  let lastFov = 50;

  // March from `look` to `dst` in N_STEPS steps; keep the first spot that is
  // not inside a static (cam radius 0.6). Writes into `desired`.
  function clearPos(dst) {
    if (collision) {
      for (let i = N_STEPS; i >= 1; i--) {
        const t = i / N_STEPS;
        cand.set(
          look.x + (dst.x - look.x) * t,
          look.y + (dst.y - look.y) * t,
          look.z + (dst.z - look.z) * t,
        );
        cand.y = Math.max(cand.y, 1.0); // cam stays above the ground
        res.hit = false;
        collision.resolveCircle(cand, 0.6, res);
        if (!res.hit) { desired.copy(cand); return; }
      }
    }
    desired.copy(dst);
  }

  function shake(amount) {
    trauma = Math.min(1, trauma + amount);
  }

  // Look target: player + forward×4 + (0,1,0) (§5.1 forward = (sin h,0,-cos h)).
  function setLook(tgt) {
    look.set(
      tgt.pos.x + Math.sin(tgt.heading) * 4,
      tgt.pos.y + 1,
      tgt.pos.z + -Math.cos(tgt.heading) * 4,
    );
  }

  // tgt = { pos, heading, speed, speedFrac }; camLookOut = scratch Vector3.
  function update(dt, simT, tgt, camLookOut) {
    // Yaw: ease toward -heading at 2.5/s; hold while the player is (nearly) still.
    if (Math.abs(tgt.speed) > 0.5) {
      const targetYaw = -tgt.heading;
      let diff = (targetYaw - camYaw) % (Math.PI * 2);
      if (diff > Math.PI) diff -= Math.PI * 2;
      if (diff < -Math.PI) diff += Math.PI * 2;
      camYaw += diff * (1 - Math.exp(-2.5 * dt));
    }
    setLook(tgt);
    // Position: ease at 8/s with a speed-based pull-back.
    const pull = 1 + 0.15 * Math.min(1, Math.abs(tgt.speed) / 12);
    desired.set(
      tgt.pos.x + Math.sin(camYaw) * 13 * pull,
      tgt.pos.y + 11 * pull,
      tgt.pos.z + Math.cos(camYaw) * 13 * pull,
    );
    clearPos(desired);
    const k = 1 - Math.exp(-8 * dt);
    camera.position.x += (desired.x - camera.position.x) * k;
    camera.position.y += (desired.y - camera.position.y) * k;
    camera.position.z += (desired.z - camera.position.z) * k;

    // FOV widens up to 4° at top speed.
    const fov = 50 + 4 * Math.min(1, Math.abs(tgt.speed) / 12);
    if (Math.abs(fov - lastFov) > 0.1) {
      camera.fov = fov;
      lastFov = fov;
      camera.updateProjectionMatrix();
    }

    // Trauma shake: offset = trauma² × 0.35 × noise, trauma decays at 1.5/s.
    if (trauma > 0) {
      const s = trauma * trauma * 0.35;
      camera.position.x += Math.sin(simT * 7.3) * s;
      camera.position.y += Math.sin(simT * 9.1 + 1.7) * s * 0.5;
      camera.position.z += Math.sin(simT * 11.3 + 4.2) * s;
      trauma = Math.max(0, trauma - 1.5 * dt);
    }
    camera.lookAt(look.x, look.y, look.z);
    if (camLookOut) camLookOut.copy(look);
  }

  // Place the cam at the desired spot immediately (no ease-in), for the
  // first frame of a session / paused screenshots.
  function snap(tgt, camLookOut) {
    camYaw = -tgt.heading;
    setLook(tgt);
    desired.set(
      tgt.pos.x + Math.sin(camYaw) * 13,
      tgt.pos.y + 11,
      tgt.pos.z + Math.cos(camYaw) * 13,
    );
    clearPos(desired);
    camera.position.copy(desired);
    camera.lookAt(look.x, look.y, look.z);
    if (camLookOut) camLookOut.copy(look);
  }

  return { update, shake, snap };
}
