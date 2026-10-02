import * as THREE from 'three';
import { PLAYER, HAZARD } from '../data/config.js';
import { RIDE_HEIGHT } from './vehicleModels.js';
import { createModifierStack } from '../gameplay/abilities.js';

// §2.3: arcade kinematics, no physics engine. The player has a `heading`
// (radians; 0 = north/−Z, clockwise, forward = (sin h, 0, −cos h) per §5.1)
// and a scalar `speed`. Wall hits above 60% of max speed cause a bonk
// (bounce back + camera shake, no knockdown).
const SPAWN_HEADING = { N: 0, S: Math.PI, E: Math.PI / 2, W: -Math.PI / 2 };

export function createPlayer({ charDef, vehDef, rig, vehicleMesh, world, onBonk }) {
  const pos = new THREE.Vector3();
  const spawn = world.def.spawn;
  pos.set(world.tilemap.cx(spawn.x), 0, world.tilemap.cz(spawn.z));
  // §2.19 terrain: the player rides the ground surface. A flat neighborhood's
  // terrain is all-zero, so this is a no-op for Maple Hollow.
  const terrain = world.terrain;
  const TSIZE = world.tilemap.tileSize;
  const isVehicle = vehDef.id !== 'feet'; // stairs are walk-only (vehicles blocked)
  let groundY = 0; // the terrain surface height under the player this frame
  let heading = SPAWN_HEADING[spawn.facing] || 0;
  let speed = 0;
  let airT = -1; // 0..PLAYER.jumpTime while airborne
  let throwT = -1; // 0..0.06 s throw wind-up (§2.12), -1 = idle
  const THROW_WINDUP = 0.06;
  // §11.6: the ability modifier stack — abilities (Sprint / Unstoppable /
  // Trick Shot / Charm / Turbo) write to it; movement, hazards and targeting
  // read it. Bea's `unstoppable` is no longer a permanent flag; it is an
  // ability that sets `knockdownImmune` for 5 s. Marlo's `dogFriendly` is a
  // static perk (dogs never chase).
  const stack = createModifierStack();
  const dogFriendly = (charDef.perks || []).includes('dogFriendly');
  let dunkSink = 0;  // M15a.14: 1 while the courier is sunk to the neck in the pond
  let teetering = 0; // M15a.14: 1 while windmilling at the water's edge / underwater
  let dunked = 0;    // M15a.14: remaining s stunned underwater (locked like a knockdown)
  let kdT = -1;      // 0..HAZARD.knockdownTime while knocked down / panicking
  let kdKind = null; // 'car' | 'dog' | 'skater' | 'panic'
  let puffyT = 0;    // §2.7: remaining puffy-face time (bee sting)
  let invulnT = 0;   // §2.6: remaining blinking invulnerability
  let spraySlow = 1; // set by hazards each frame (×0.6 inside a sprinkler spray)
  let abilities = null; // §11.6: the ability system (set via setAbilities)
  // §2.12 trampoline: a launch 5 units up on landing on a `gagSpots.trampoline`.
  let trampT = -1;
  let trampSpots = [];
  let onTrampoline = null;
  const TRAMP_T = 0.9, TRAMP_H = 5, TRAMP_R = 1.6;
  function boing() { trampT = 0; if (onTrampoline) onTrampoline(); return true; }
  function setTrampolines(spots) { trampSpots = spots; }
  function setOnTrampoline(cb) { onTrampoline = cb; }
  // §2.12: flying over the handlebars in a ~2.5 u arc, landing flat on the back.
  let hbT = -1;
  const HB_T = 0.75, HB_H = 2.5;
  function handlebars() { if (canBeKnocked()) startKnockdown('car'); hbT = 0; return hbT; }
  // One stable anim-scratch object per player (no per-frame allocation).
  const anim = { speedFrac: 0, moving: 0, wave: 0, riding: 'walk', air: -1, fall: 0, t: 0, throw: -1, panic: 0, puffy: 0, blink: 0, pancake: 0, sink: 0 };

  function startKnockdown(kind) {
    if (stack.knockdownImmune > 0) return 'blocked';
    if (kdT >= 0 || invulnT > 0) return 'invuln';
    kdKind = kind; kdT = 0;
    if (kind === 'panic') puffyT = HAZARD.puffyTime;
    return 'knockdown';
  }
  function canBeKnocked() { return stack.knockdownImmune <= 0 && kdT < 0 && invulnT <= 0; }

  // Final stats = vehicle base × courier speed multiplier (§11.2); static, so
  // computed once — the per-frame paths must not allocate.
  const maxSpeed = vehDef.stats.maxSpeed * charDef.stats.speed;
  const accel = vehDef.stats.accel;
  const turnRate = vehDef.stats.turnRate;

  // dt = fixed sim step; input = createInput() result; simT = sim time.
  function update(dt, input, simT) {
    // Hazard timers (§2.6/§2.7): knockdown fall/panic, puffy face, invuln.
    if (puffyT > 0) puffyT -= dt;
    if (invulnT > 0) invulnT -= dt;
    if (kdT >= 0) { kdT += dt; if (kdT >= HAZARD.knockdownTime) { kdT = -1; kdKind = null; invulnT = HAZARD.invulnTime; } }
    if (dunked > 0) dunked -= dt; // M15a.14: stunned underwater until it expires
    const down = kdT >= 0 || dunked > 0; // M15a.14: a dunk locks the courier like a knockdown

    const fwd = input.isHeld('forward');
    const back = input.isHeld('back');
    // §2.7: standing in a sprinkler spray slows movement (×0.6). §11.6: an
    // ability's speed modifier (Sprint ×1.5, Turbo ×1.6) scales the top speed.
    const spd = maxSpeed * stack.speedMul * (down ? 0 : spraySlow);
    const target = down ? 0 : fwd ? spd : back ? -spd * 0.35 : 0;
    if (down) speed = 0;
    // §2.3: accelerate at `accel`, coast at accel*1.5, brake at accel*3.
    let rate = accel;
    if (target === 0) rate = accel * 1.5;
    else if (speed * target < 0) rate = accel * 3;
    const d = target - speed;
    speed += Math.max(-rate * dt, Math.min(rate * dt, d));
    if (target === 0 && Math.abs(speed) < 0.05) speed = 0;

    // §2.3: turn rate scaled down at high speed.
    const steer = (input.isHeld('right') ? 1 : 0) - (input.isHeld('left') ? 1 : 0);
    if (steer && Math.abs(speed) > 0.01) {
      heading += steer * turnRate * (1 - 0.4 * Math.abs(speed) / maxSpeed) * dt;
    }
    // §2.7 / §2.8: cartoon steering wobble (Turbo's wobbly 2nd phase, or the
    // puffy face after a bee sting) — a small sin drift so it reads as wobble.
    if (stack.turnWobble > 0 || puffyT > 0) heading += Math.sin(simT * 9) * 0.8 * dt;

    // §11.6: Shift triggers the courier's ability (writes the modifier stack).
    if (input.consume('ability') && abilities) abilities.use();

    // Integrate (§5.1 heading convention).
    const prevX = pos.x, prevZ = pos.z;
    const ptx = (prevX / TSIZE) | 0, ptz = (prevZ / TSIZE) | 0;
    pos.x += Math.sin(heading) * speed * dt;
    pos.z += -Math.cos(heading) * speed * dt;

    // Throw wind-up timer (§2.12 anticipation): starts on startThrow(), runs 0.06 s.
    if (throwT >= 0) { throwT += dt; if (throwT >= THROW_WINDUP) throwT = -1; }
    // Advance the airborne timers; their effect on pos.y is resolved below, on the
    // terrain surface (§2.19) rather than a fixed y=0.
    if (input.consume('jump') && airT < 0 && vehDef.canJump) airT = 0;
    if (airT >= 0) airT += dt;
    if (trampT >= 0) trampT += dt;
    else if (trampSpots.length && airT < 0) {
      for (let i = 0; i < trampSpots.length; i++) {
        const s = trampSpots[i];
        const dx = pos.x - s.x, dz = pos.z - s.z;
        if (dx * dx + dz * dz < TRAMP_R * TRAMP_R) { boing(); break; }
      }
    }
    if (hbT >= 0) hbT += dt;

    // Collision: slide out of statics; bonk if the hit was fast enough.
    const hit = world.collision.resolveCircle(pos, PLAYER.radius);
    if (hit.hit && Math.abs(speed) > PLAYER.bonkSpeedFrac * maxSpeed && airT < 0) {
      speed = -speed * 0.3; // small bounce back
      if (onBonk) onBonk(PLAYER.bonkShake);
    }
    // §2.19: climbing up a retaining wall or stairs without a ramp is blocked.
    if (terrain.hasHills) {
      const ctx = (pos.x / TSIZE) | 0, ctz = (pos.z / TSIZE) | 0;
      if ((ctx !== ptx || ctz !== ptz) && terrain.edgeBlocked(ptx, ptz, ctx, ctz, isVehicle)) {
        pos.x = prevX; pos.z = prevZ;
        if (Math.abs(speed) > 1) { speed *= -0.3; if (onBonk) onBonk(PLAYER.bonkShake); }
      }
    }
    // World bounds (the interior is clamped to the map; the forest border also
    // collides, so these are a loose outer limit).
    pos.x = Math.max(4, Math.min(world.tilemap.width * TSIZE + 4, pos.x));
    pos.z = Math.max(4, Math.min(world.tilemap.height * TSIZE - 4, pos.z));

    // §2.19: sit on the terrain surface; the airborne gags arc above it.
    groundY = terrain.baseYAt(pos.x, pos.z);
    if (airT >= 0) {
      const JT = PLAYER.jumpTime;
      if (airT >= JT) { airT = -1; pos.y = groundY; }
      else { const t = airT / JT; pos.y = groundY + 4 * PLAYER.jumpHeight * t * (1 - t); }
    } else if (trampT >= 0) {
      if (trampT >= TRAMP_T) { trampT = -1; pos.y = groundY; }
      else { const t = trampT / TRAMP_T; pos.y = groundY + TRAMP_H * 4 * t * (1 - t) * 0.9; }
    } else if (hbT >= 0) {
      const t = hbT / HB_T;
      if (t >= 1) { hbT = -1; pos.y = groundY; }
      else { pos.y = groundY + HB_H * 4 * t * (1 - t); pos.x += Math.sin(heading) * 1.5 * dt * 4; pos.z += -Math.cos(heading) * 1.5 * dt * 4; }
    } else {
      pos.y = groundY;
    }
  }

  // Apply the kinematic state to the rig + vehicle + anim scratch.
  function syncVisuals(dt, simT) {
    anim.t = simT;
    anim.speedFrac = Math.min(1, Math.abs(speed) / maxSpeed);
    anim.moving = Math.abs(speed) > 0.2 ? 1 : 0;
    anim.riding = vehDef.riding;
    anim.air = airT >= 0 ? airT / PLAYER.jumpTime : -1;
    anim.throw = throwT >= 0 ? throwT / THROW_WINDUP : -1;
    // §2.12 knockdown gags: flop (fall), bee panic hop, puffy face, pancake,
    // and blinking during the invulnerability window.
    anim.fall = kdT >= 0 && kdKind !== 'panic' ? 1 : 0;
    // M15a.14: the teeter / underwater windmill reuses the bee-panic flail.
    anim.panic = (kdT >= 0 && kdKind === 'panic') || teetering ? 1 : 0;
    anim.puffy = puffyT > 0 ? 1 : 0;
    anim.pancake = kdKind === 'car' && kdT >= 0 ? 1 : 0;
    anim.blink = invulnT > 0 ? (Math.sin(simT * 22) > 0 ? 1 : 0) : 0;
    const seat = RIDE_HEIGHT[vehDef.id] || 0;
    anim.sink = dunkSink; // M15a.14: sunk to the neck in the pond (applied in the rig)
    rig.group.position.set(pos.x, pos.y + seat, pos.z);
    rig.group.rotation.y = Math.atan2(Math.sin(heading), -Math.cos(heading));
    rig.update(dt, anim);
    if (vehicleMesh) {
      vehicleMesh.position.set(pos.x, pos.y, pos.z); // §2.19: wheels ride the terrain
      vehicleMesh.rotation.y = rig.group.rotation.y;
    }
  }

  function setCarried(n) {
    rig.setCarried(n);
  }

  function teleport(tileX, tileZ, headingDeg) {
    const cx = world.tilemap.cx(tileX), cz = world.tilemap.cz(tileZ);
    pos.set(cx, terrain.baseYAt(cx, cz), cz); // §2.19: land on the tile's terrain level
    heading = (headingDeg * Math.PI) / 180;
    speed = 0;
    airT = -1;
  }

  rig.setCarried(0);

  return {
    pos,
    get groundY() { return groundY; }, // §2.19: the terrain surface under the player (for the cam)
    get heading() { return heading; },
    get speed() { return speed; },
    get spraySlow() { return spraySlow; },
    set spraySlow(v) { spraySlow = v; },
    get dogFriendly() { return dogFriendly; },
    get knockdownImmune() { return stack.knockdownImmune > 0; },
    get dunkSink() { return dunkSink; },
    set dunkSink(v) { dunkSink = v; },
    get teetering() { return teetering; },
    set teetering(v) { teetering = v ? 1 : 0; },
    get dunked() { return dunked; },
    set dunked(v) { dunked = v; },
    // M15a.14: the pond respawn's invuln blink (reuses the knockdown's invuln timer).
    grantInvuln(t) { invulnT = Math.max(invulnT, t); },
    get stack() { return stack; },
    setAbilities(a) { abilities = a; },
    startKnockdown,
    canBeKnocked,
    rig,
    update,
    syncVisuals,
    setCarried,
    teleport,
    startThrow() { throwT = 0; },
    boing,
    setTrampolines,
    setOnTrampoline,
    get onTramp() { return trampT >= 0; },
    handlebars,
    get onHandlebars() { return hbT >= 0; },
  };
}
