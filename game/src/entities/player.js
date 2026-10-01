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
  let kdT = -1;      // 0..HAZARD.knockdownTime while knocked down / panicking
  let kdKind = null; // 'car' | 'dog' | 'skater' | 'panic'
  let puffyT = 0;    // §2.7: remaining puffy-face time (bee sting)
  let invulnT = 0;   // §2.6: remaining blinking invulnerability
  let spraySlow = 1; // set by hazards each frame (×0.6 inside a sprinkler spray)
  let abilities = null; // §11.6: the ability system (set via setAbilities)
  // One stable anim-scratch object per player (no per-frame allocation).
  const anim = { speedFrac: 0, moving: 0, wave: 0, riding: 'walk', air: -1, fall: 0, t: 0, throw: -1, panic: 0, puffy: 0, blink: 0, pancake: 0 };

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
    const down = kdT >= 0;

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
    pos.x += Math.sin(heading) * speed * dt;
    pos.z += -Math.cos(heading) * speed * dt;

    // Throw wind-up timer (§2.12 anticipation): starts on startThrow(), runs 0.06 s.
    if (throwT >= 0) { throwT += dt; if (throwT >= THROW_WINDUP) throwT = -1; }
    // Jump / hop (§2.2): 1.2 units high in 0.5 s, a parabola.
    if (input.consume('jump') && airT < 0 && vehDef.canJump) airT = 0;
    if (airT >= 0) {
      airT += dt;
      const T = PLAYER.jumpTime;
      if (airT >= T) { airT = -1; pos.y = 0; }
      else {
        const t = airT / T;
        pos.y = 4 * PLAYER.jumpHeight * t * (1 - t);
      }
    }

    // Collision: slide out of statics; bonk if the hit was fast enough.
    const hit = world.collision.resolveCircle(pos, PLAYER.radius);
    if (hit.hit && Math.abs(speed) > PLAYER.bonkSpeedFrac * maxSpeed && airT < 0) {
      speed = -speed * 0.3; // small bounce back
      if (onBonk) onBonk(PLAYER.bonkShake);
    }
    // World bounds.
    pos.x = Math.max(4, Math.min(188, pos.x));
    pos.z = Math.max(4, Math.min(156, pos.z));
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
    anim.panic = kdT >= 0 && kdKind === 'panic' ? 1 : 0;
    anim.puffy = puffyT > 0 ? 1 : 0;
    anim.pancake = kdKind === 'car' && kdT >= 0 ? 1 : 0;
    anim.blink = invulnT > 0 ? (Math.sin(simT * 22) > 0 ? 1 : 0) : 0;
    const seat = RIDE_HEIGHT[vehDef.id] || 0;
    rig.group.position.set(pos.x, pos.y + seat, pos.z);
    rig.group.rotation.y = Math.atan2(Math.sin(heading), -Math.cos(heading));
    rig.update(dt, anim);
    if (vehicleMesh) {
      vehicleMesh.position.set(pos.x, 0, pos.z); // wheels stay on the ground
      vehicleMesh.rotation.y = rig.group.rotation.y;
    }
  }

  function setCarried(n) {
    rig.setCarried(n + vehDef.stats.capacityBonus);
  }

  function teleport(tileX, tileZ, headingDeg) {
    pos.set(world.tilemap.cx(tileX), 0, world.tilemap.cz(tileZ));
    heading = (headingDeg * Math.PI) / 180;
    speed = 0;
    airT = -1;
  }

  rig.setCarried(0 + vehDef.stats.capacityBonus);

  return {
    pos,
    get heading() { return heading; },
    get speed() { return speed; },
    get spraySlow() { return spraySlow; },
    set spraySlow(v) { spraySlow = v; },
    get dogFriendly() { return dogFriendly; },
    get knockdownImmune() { return stack.knockdownImmune > 0; },
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
  };
}
