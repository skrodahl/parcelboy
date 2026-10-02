# Parcelboy: build plan

> Audience: the coding agent building this game (see `AGENTS.md`). Read this whole document once, then work milestone by milestone (§13).
> Where the plan gives a value (a speed, a color, a size), use it as the starting value. Tune only in the milestones that say so, and record the changes in `PROGRESS.md`.

## Plan changes (read first; apply before starting the next milestone)

**2026-10-02: new milestone M18** (adaptive music) after M17 in §13; the order is M15 → M15a → M16 → M17 → **M18**.

**2026-10-02: new milestone M15a** (play-test fixes, round 2) **moved ahead of M16**: the order is now M15 → **M15a** → M16 → M17. If you've already started M16, park it first: `git add` the new Lakeside files and commit as `M16 (WIP): Lakeside, parked for M15a` (push too), then do all of M15a, then resume M16. The user may add more items to M15a; do every item in it.

**2026-10-01: new milestones M12b–M17** (user design session): shifts follow the day clock with no time limit or game over (§2.20), addressed parcels + parcel lockers (§2.16, §2.17), terrain heights (§2.19) and more suburbs joined by Zelda-style edge exits (§2.18), with Cedar Heights, Lakeside and Old Town. Do M12a (the review fixes) first, then continue with M12b in §13. §15 no longer rules out a bigger world (it now rules out a streamed open world and the delivery van). These are additive: the save stays `parcelboy.save.v1` with new fields, and Maple Hollow's layout only changes by its exit roads.

**2026-10-01: post-M12 review fixes moved into milestone M12a** (§13). They're a normal milestone now: do M12a next, then M12b, M13, … M17, without stopping.
- **No user-check gates anymore.** The user waived the M4–M12 checks (2026-10-01) and every ⛔ gate is removed. Never stop for a review; the user gives feedback by editing this plan.

**2026-09-30: fog, tone mapping, overview framing** (you raised fog concerns in PROGRESS.md; they were right, and the original spec was tuned only for the close follow cam):
1. `render/renderer.js`: `toneMapping = THREE.NeutralToneMapping` (ACES washes out the pastel palette). See §7.3.
2. Fog and the camera's far plane scale with the camera's distance `d` to its look-at target, updated every frame with no allocation: `fog.near = d + 45`, `fog.far = d + 150`, `camera.far = max(220, d + 260)` (call `updateProjectionMatrix()` only when the value changes). The sky dome keeps `depthWrite: false` and gets `renderOrder = -1`. See §7.3.
3. The `overview` camera preset must frame the **entire** map, including the south strip (park + Distribution Center). See §7.9.
4. Re-shoot `m2-*` and `m3-*`, compare them with the previous shots, and log this under *Decisions* in PROGRESS.md.

---

## 1. Vision

**Parcelboy** is a bright, cozy, arcade-style delivery game. You play a Quickbox courier in **Maple Hollow**, a hand-built suburban neighborhood you can move around freely. The game is **free-roam first**: ride around, explore and hunt for hidden Golden Parcels, then pick up delivery missions at the **Quickbox Distribution Center** (or at shops around town) whenever you like, GTA-style. You throw parcels onto porches for style points, or walk up and hand them over for a safe delivery. Along the way you dodge traffic, grumpy dogs, sprinklers and kids on skateboards, then head back to the distribution center to restock.

### Design pillars (use these to settle any doubt)
1. **Friendly and colorful.** Pastel houses, bright green lawns, soft sunlight and chunky toy-like "voxel-ish" shapes. Nothing is grim; failure is funny (a parcel stuck on a roof, a dog stealing a package).
2. **Cartoon arcade.** The gameplay behaves like a Saturday-morning cartoon: exaggerated physics, slapstick knockdowns that nobody gets hurt by, comic sound effects and onomatopoeia ("BONK!", "SPLOOSH!"), and a world that reacts theatrically to everything you do. Instant controls, generous aim assist, big readable feedback ("PERFECT! x3"), streaks and a score. A shift lasts 3–4 minutes. The cartoon rules are in §2.12. There's also a **GTA-lite mischievous streak**: bowl pedestrians over, sabotage grumpy non-subscriber houses, and outrun the Neighborhood Watch (§2.15).
3. **Immersive, living world.** The neighborhood feels inhabited: walkers, birds that scatter, residents who wave from the door, window lights at dusk, and ambient sound. Immersion comes from lots of small reactions, not heavy graphics.
4. **Light on the hardware.** It must run cool and quiet on a laptop. The performance budget (§8) is a feature, not an afterthought.
5. **Extensible.** New couriers, vehicles, hazards, package types, shifts and neighborhoods can be added through data files (§14).

---

## 2. Game design

### 2.1 Core loop: free roam hub plus optional missions (GTA-style)
1. **Title → Play.** The first time, choose a courier and vehicle. After that, **Continue** drops you straight into free roam with the last courier and vehicle you used.
2. **Free roam** (the default state, §2.13): no timer and no score. Ride anywhere, find Golden Parcels, bounce on trampolines, annoy the bees. The day slowly cycles. The circular **radar** (§10) shows mission markers as blips.
3. **Start a mission** by entering a **mission marker**: a tall glowing column of light with a spinning icon. A mission card slides in (name, description, deliveries, time, time of day, best score and stars, rewards). **F starts it**; walking out of the marker dismisses the card. The main shifts start at the Distribution Center's dispatch marker; side missions start at shops (§2.10).
4. **Mission intro.** A 2-second camera swoop from above the pickup location down to the player, with the banner "Morning Round: 10 deliveries". The time of day blends to the mission's setting over 2 s.
5. **Deliver.** Target houses get a floating bobbing parcel icon, a glowing ring on the porch, and a blip on the radar. A **GPS route** on the radar leads to the nearest target, or to the pickup zone when you're empty. A compass arrow on the ground under the player points the same way.
6. **Restock** at the mission's **pickup zone**: the Distribution Center's loading bay for shifts, or the shop counter for side missions.
7. **Mission ends** when every delivery is done (early finish bonus), when the shift's window on the day clock closes, or when you **clock out early** (pause menu; you keep what you earned). See §2.20.
8. **Results** screen: score, stars (0–3), coins earned, best record. Then choose **Continue** (back to free roam, exactly where you are) or **Retry** (teleports to the mission's pickup and restarts). Coins unlock couriers and vehicles; stars unlock missions.

**You can always ignore a mission.** During a mission nothing stops you from riding off to explore. The day clock keeps running and the targets wait. When the shift's window closes you're paid for what you delivered, and you're back in free roam. There is no game over (§2.20).

### 2.2 Controls (keyboard and mouse; gamepad is out of scope)
| Input | Action |
|---|---|
| W / ↑ | accelerate forward |
| S / ↓ | brake, then reverse slowly (reverse top speed is 35% of max speed) |
| A / D, ← / → | steer (turn left/right). Steering applies on foot too, with a fast turn rate |
| Q / E | throw a parcel to the **left** / **right** (the Paperboy nod), with aim assist |
| Left mouse click | throw toward the point on the ground under the cursor |
| Space | jump or hop: 1.2 units high, 0.5 s. You can't be knocked down while airborne; a throw while airborne earns "Air Mail!" |
| F (hold 0.8 s) | doorstep delivery while standing in a target's porch zone; a ring fills around the player |
| F (tap) | start the mission while standing in a mission marker; open the locker while in the locker marker |
| R | cycle the parcel stack: move the top parcel to the bottom (§2.16) |
| Shift | use the courier's special ability |
| Esc / P | pause |
| M | mute or unmute |
| Tab | open or close the **full-screen map** (§10): the live world seen from above (M15a item 18); your courier is safe and frozen while it's open. Click a spot to set a **waypoint** (GPS route on the radar, a pin on the map); click the waypoint again to clear it |

The input layer maps keys to **actions** (`forward`, `back`, `left`, `right`, `throwLeft`, `throwRight`, `throwAim`, `jump`, `doorstep`, `ability`, `cycle`, `pause`, `mute`, `map`). Game code only ever reads actions, never raw keys.

### 2.3 Movement
- Arcade kinematics, no physics engine. The player has a `heading` (radians) and a scalar `speed`. Speed accelerates toward the target at `accel`, decelerates at `accel * 1.5` when no key is held, and at `accel * 3` when braking.
- Turn rate is scaled down at high speed: `turn = turnRate * (1 - 0.4 * speed / maxSpeed)`.
- **Collision:** the player is a circle (radius 0.5) and solids are axis-aligned boxes (AABBs) or circles. Resolve on the X and Z axes separately so the player slides along walls. Hitting a wall at more than 60% of max speed causes a "bonk" (small bounce back, camera shake of 0.15, a *bonk* sound, no knockdown).
- Final stats = vehicle base stats × courier multipliers (§11).

### 2.4 Delivering

**Throwing (Q / E / mouse)**
- **Aim assist (Q/E):** find undelivered target zones (porch zones of target houses or shops) whose center lies within ±50° of the player's left (Q) or right (E) side and within `throwRange`. Choose the one with the smallest angle offset. If there is none, aim at a point `throwRange * 0.6` units to that side.
- **Mouse:** raycast the cursor onto the ground plane (y = 0) and clamp the distance to `throwRange`. If a target zone is within 2.5 units of that point, snap to the zone's doormat point (a light assist).
- **Accuracy:** add a random offset of radius `(1 - accuracy) * 1.6` units to the aim point, using the seeded RNG.
- **Flight:** flight time `t = clamp(dist / 16, 0.35, 0.9)` s and gravity `g = 22` units/s². Launch velocity = (Δ − ½·g·t²) / t per axis, with gravity only on Y. Parcels spin while flying.
- **Collision in flight:** check against house and building AABBs. If the parcel is above the wall height of the box it hits, it lands **on the roof** and stays there ("On the roof!", counts as a miss, funny). Otherwise it hits the wall and drops straight down at the wall.
- **Landing:** first bounce keeps 35% of vertical speed and 50% of horizontal speed. After the second contact the parcel slides for 0.2 s, then rests. It is judged when it comes to rest.
- **Cooldown:** 0.3 s between throws. Parcels in flight come from a pool (16 max).

**Judging a resting parcel**
| Where it rests | Result | Base points | Streak |
|---|---|---|---|
| The target's porch zone, within 1.0 of the doormat point | **PERFECT!** | 200 | +1 |
| The target's porch zone, elsewhere | **Nice!** | 150 | +1 |
| Inside the target's lot (house footprint expanded by 1 tile), not the porch | **Sloppy…** (still counts as delivered) | 60 | reset |
| A non-target or already-delivered house's zone or lot | **Wrong house!** (the parcel is lost) | −25 | reset |
| Road tile | **In the road!** (a car flattens it if one passes; cosmetic) | 0 | reset |
| Water | **Splash!** (the parcel sinks with a ripple) | 0 | reset |
| On a roof | **On the roof!** | 0 | reset |
| Anywhere else | **Missed!** | 0 | reset |

- **Bonuses** (added to the base before the multiplier): Air Mail (thrown while airborne) +50; Long Shot (throw distance > 11 units) +50; Express on time +100 (see packages).
- **Multiplier** = `min(3, 1 + 0.5 * floor(streak / 3))`, shown as ×1, ×1.5, ×2, ×2.5, ×3.

**Doorstep delivery (hold F)**
- Stand inside a target's porch zone and hold F for 0.8 s. Moving more than 0.3 units cancels it.
- Result: **Signed for!** worth 120 points × multiplier. The streak is **kept but not increased**. It is always safe, including for fragile parcels.

**After any successful delivery**, a resident pops out of the door, waves for 1.5 s and goes back in (pooled NPC, §7.6). Also: confetti burst (12 particles), floating text, and a sound effect.

### 2.5 Packages (package types)
Each target gets a package type when the shift starts, picked from the shift's `packageMix`.
| id | Look | Rule |
|---|---|---|
| `standard` | brown box with teal tape | none |
| `fragile` | box with a red ▲ label | Breaks if the throw distance > 7 or the first impact speed > 14: **Broken!** (0 points, delivered, streak reset). PERFECT or doorstep is always safe. |
| `heavy` | bigger, darker box | Throw range × 0.5 for this parcel |
| `express` | box with a yellow ⚡ stripe | +100 bonus if delivered within the first 50% of the shift time |
| `cake` | pink box with a white ribbon bow | Like fragile, but breaks above throw distance 5 or impact speed 10. When it breaks: **SPLAT!** with a burst of pink frosting particles. Doorstep delivery gives +100 ("Service with a smile!") |

The player carries a **queue** of parcels whose order follows the target list. The HUD shows the type of the next parcel, and throws always use the next one. This keeps things simple, and the next-parcel indicator makes it readable.

### 2.6 Shift rules
- Targets are `deliveries` houses or shops chosen with the seeded RNG. Each 4×4-tile region of the map holds at most 3 targets, to spread them out.
- When a mission starts, the player's stack is filled right away as if restocked (you start in the pickup zone). Parcels carried on restock = `min(capacity, undeliveredTargets)`. Restocking takes 1.0 s inside the mission's **pickup zone** (a progress ring), and parcels visibly slide down the conveyor or out of the shop door into the player's back stack. Restocking is only possible during a mission.
- A lost parcel (miss, wrong house, splash, knockdown drop) doesn't remove the target. You need a parcel from a later restock to deliver it.
- **Knockdown** (from a car, dog or skater): the player falls for 1.2 s, drops 1 parcel (lost), the streak resets, the camera shakes (0.3), then 1.5 s of blinking invulnerability. Every knockdown is played as a slapstick gag (§2.12); the timings here stay the same.
- **Early finish bonus** when all targets are delivered: remaining game minutes in the shift's window × 2 (§2.20).
- **Stars** use the shift's `stars` thresholds. **Coins earned** = `floor(score / 10)`.

### 2.7 Hazards (behaviors, §11.3)
- **Cars** (`carPatrol`) follow closed traffic loops at about 7.5 units/s and ease into corners. They brake smoothly when the player or another car is within 7 units ahead in a ±25° cone. Cars are friendly and stop for you, but darting out in front of one at under 3 units causes a knockdown if the car's speed is above 3. A honk sounds when braking for the player.
- **Dogs** (`dogChase`) sleep at their spot (with a *zZz* particle). They wake when the player is within 9 units: a bark and a "!" pop. They chase at 7.2 units/s for up to 5 s, then give up if the player is more than 16 units from the spot, and trot home. A catch within 0.9 units causes a knockdown, and the dog grabs the dropped parcel and runs home with it. You can chase it to get the parcel back (Dog thief, §2.12). Couriers with the `dogFriendly` perk are never chased; the dog wags its tail instead.
- **Sprinklers** (`sprinkler`) spray a 120° rotating arc with a 5-unit radius, on for 3 s and off for 3 s (water particles). A player in the spray moves at × 0.6 speed. A standard parcel landing in the spray gets **Soggy** (−50%); a fragile one is Broken.
- **Skater kids** (`patrolPath`) follow a sidewalk loop at 5 units/s, weaving slightly. Contact causes a knockdown unless the player is airborne; jumping over them earns "Hop!" worth +25.
- **Bee swarm** (`beeSwarm`), a nod to Paperboy and **a required feature**. A beehive hangs from a tree at each `hazardSpots.beehive` spot, and a small cloud of bees drifts lazily around it with a quiet buzz. The swarm gets **angry** when the player comes within 6 units, **or immediately when a parcel hits the hive or its tree**: the hive shakes, "BZZZ!" pops up and the swarm pours out. An angry swarm chases the player at 7.8 units/s, faster than walking and slower than a bike. It weaves around as it flies, so a sharp turn can buy you a moment. The chase lasts up to 8 s; then the swarm gives up and drifts back to the hive. **Ways to shake it off:** outrun it (more than 20 units away for 2 s), or run through an active sprinkler spray. Water scatters the swarm with a "fizz" and sends it straight home, which ties two hazards together. **Getting stung** (the swarm center within 1.0 unit): "OUCH!", a panic knockdown (the courier hops around waving their arms instead of falling; 1.2 s, 1 parcel dropped, as in §2.6), then a **puffy face** for 5 s: the head is scaled 1.35 with red dots, and steering wobbles (`turnWobble` modifier). Couriers who are knockdown-immune (Bea's Unstoppable) get "Bzzt… nope!" and the swarm bounces off them. Up to 2 swarms can be active at once.
- **Static obstacles:** trash bins (`knockable`: they tip over when hit, with a small bounce and a sound; there is no knockdown and they don't reset) and traffic cones (`static`).

### 2.8 Couriers (starter content; stats are multipliers)
| id | Name | Look | speed | capacity | throwRange | accuracy | Ability / perk | Unlock |
|---|---|---|---|---|---|---|---|---|
| `pip` | Pip | small, red hoodie, yellow cap | 1.15 | 4 | 0.9 | 0.75 | **Sprint** (Shift): max speed × 1.5 for 2.5 s, cooldown 12 s | free |
| `bea` | Bea | tall, sturdy, green overalls | 0.9 | 7 | 1.0 | 0.8 | **Unstoppable**: immune to knockdown for 5 s, cooldown 20 s | free |
| `juno` | Juno | purple jacket, headphones | 1.0 | 5 | 1.1 | 0.95 | **Trick Shot**: the next 3 throws home in and are guaranteed PERFECT if a target is in range, cooldown 25 s | free |
| `marlo` | Marlo | orange sweater, big smile | 1.0 | 5 | 1.0 | 0.8 | perk `dogFriendly`; **Charm**: for 6 s cars stop, skaters swerve away, and Neighborhood Watch units lose interest (heat −1 level), cooldown 22 s | 600 coins |
| `ollie` | Ollie | blue work jacket, goggles | 1.05 | 5 | 1.0 | 0.85 | **Turbo**: vehicle speed × 1.6 for 3 s, then 1 s wobbly steering, cooldown 15 s | 900 coins |

Capacity is the base number of parcels; the vehicle adds `capacityBonus`.

### 2.9 Vehicles
| id | Name | maxSpeed | accel | turnRate (rad/s) | capacityBonus | canJump | Unlock |
|---|---|---|---|---|---|---|---|
| `feet` | On Foot | 6.5 | 30 | 5.5 | 0 | yes | free |
| `bike` | Bicycle | 11 | 14 | 3.2 | 1 | yes (bunny hop) | free |
| `scooter` | E-Scooter | 13.5 | 11 | 2.7 | 2 | no | 500 coins |
| `cargo` | Cargo E-Bike | 9.5 | 9 | 2.4 | 5 | no | 800 coins |

`throwRange` base = 12 units on all vehicles (multiplied by the courier's value). A vehicle's model attaches under the courier, and the courier switches to a riding pose (§7.5).

### 2.10 Missions
Every mission is a **shift** definition (§11.5) with a `giver` (where its marker stands) and a `pickup` (where you restock). There are two kinds: **main shifts**, all started from the Distribution Center's dispatch marker (the mission card lets you page through the unlocked ones with ←/→), and **side missions**, each with its own marker at a shop.

**Main shifts** (giver `dispatch`, pickup `depot`):

| id | Name | Time | Deliveries | Time of day | packageMix | Hazards | Stars (1/2/3) | Unlock |
|---|---|---|---|---|---|---|---|---|
| `morning` | Morning Round | 240 s | 10 | morning | standard .85, fragile .1, heavy .05 | car 3, dog 1, sprinkler 2, skater 0, bees 1 | 1500 / 2600 / 3600 | free |
| `lunch` | Lunch Rush | 210 s | 12 | noon | standard .6, express .3, heavy .1 | car 7, dog 2, sprinkler 2, skater 1, bees 1 | 1800 / 3000 / 4300 | 2 total stars |
| `fragile` | Fragile Friday | 240 s | 11 | noon | fragile .5, standard .4, express .1 | car 4, dog 2, sprinkler 4, skater 1, bees 1 | 1600 / 2800 / 4000 | 4 total stars |
| `golden` | Golden Hour | 240 s | 13 | golden | standard .6, fragile .2, express .1, heavy .1 | car 5, dog 3, sprinkler 1, skater 2, bees 2 | 2000 / 3400 / 4800 | 6 total stars |
| `dusk` | Night Owl | 270 s | 14 | dusk | mixed evenly | car 5, dog 3, sprinkler 0, skater 2, bees 0 (asleep; hives still hang there, and a parcel hitting a hive still wakes it) | 2200 / 3700 / 5200 | 9 total stars |

**Side missions** (short and snappy; they use whatever time of day and free-roam hazards are current): you **pick up** at the shop and **deliver to houses** across the suburb (never back to the shop; see M15a item 17).

| id | Name | Giver / pickup | Time | Deliveries | packageMix | Stars (1/2/3) | Unlock |
|---|---|---|---|---|---|---|---|
| `cake` | Cake Rush | `bakery` | 60 s | 1 | cake 1.0 | 250 / 400 / 550 | 1 total star |
| `haul` | Heavy Haul | `hardware` | 120 s | 3 | heavy 1.0 | 500 / 800 / 1100 | 3 total stars |

Star thresholds are first guesses. Tune them in M12 by playing through with the debug autoplayer (§12.4) and recording the scores.

### 2.11 Progression and saving
- Save to `localStorage` key `parcelboy.save.v1` as `{ version: 1, coins, unlocked: { characters: [], vehicles: [] }, best: { [shiftId]: { score, stars } }, goldenParcels: [indices found], last: { character, vehicle }, settings: { quality, musicVol, sfxVol, showFps } }`.
- The game saves after each mission, each Golden Parcel and each purchase or setting change. It doesn't save the player's position; Continue always starts at the Distribution Center.
- Mission unlocks come from total stars (the sum of best stars per mission), not coins. A locked mission's marker still appears (grey, with a padlock icon), and its card says how many stars it needs.
- Every storage access goes in `try/catch`. If storage is unavailable, the game runs with defaults.

### 2.12 Cartoon gameplay (the "Saturday-morning" rules)
The game must *play* like a cartoon, not just look like one. Physics is exaggerated, failure is slapstick, nobody ever gets hurt, and everyone bounces straight back. Every gag below is tuned in `data/config.js` under `CARTOON`: timings, chances, and an `enabled` flag per gag, so any of them can be toned down or switched off.

**Timing and physics**
- **Hit-stop:** freeze the simulation for 70 ms on PERFECT, knockdowns, stings and bonks. Rendering continues. Add a camera "punch" (FOV −3°, easing back over 0.25 s).
- **Anticipation and follow-through:** jumps start with a 0.08 s crouch (scale 1.2 wide / 0.8 tall), throws start with a 0.06 s wind-up, landings squash, and everything overshoots then settles (elastic ease).
- **Jelly parcels:** a parcel squashes 30% on its first impact and wobbles for 0.4 s.
- **Skids:** braking from above 60% of max speed causes a 0.3 s skid: "SKRRT!", smoke puffs, and on foot the legs windmill.

**Slapstick knockdowns** (same 1.2 s duration and parcel-drop rules as §2.6)
| Cause | Gag |
|---|---|
| Car | **Pancake:** the courier is flattened (scale y 0.1) with "SPLAT!", then peels up and pops back to full size with "BOING!" and an accordion wobble. The car does a startled hop and honks twice. |
| Dog | A **fight cloud**: a ball of dust puffs with the occasional paw or sneaker poking out, 0.6 s (nothing violent visible). Then the dog trots off with the parcel in its mouth. |
| Skater | Both spin like tops for 0.8 s and topple over. The kid pops up: "Sorry!" |
| Bees | The courier panic-hops, arms flailing, then gets the puffy face (§2.7). |
| Any knockdown while riding | The courier flies **over the handlebars** in a 2–3 unit high arc and lands flat on their back. The vehicle tumbles and lands upright beside them. |

After every knockdown, 3 small cartoon stars circle the courier's head for the whole invulnerability period.

**Wall bonks** (§2.3): above 60% of max speed the courier flattens against the wall (scale 0.5 along the impact axis), "BONK!", then slides back wobbling. Above 90% it's a lighter knockdown: dizzy stars for 1 s, no parcel lost.

**The world reacts**
- **Dog thief:** a dog that grabs a parcel runs back toward its spot at 6 units/s. Touch the dog within 8 s to take the parcel back ("Gotcha!", +50, the parcel returns to your stack). Otherwise it digs a hole and buries the parcel (dirt particles, "Aww…"), and the parcel is lost.
- **Bonk!** A parcel hitting a walker, resident or skater bonks them on the head. They wobble with stars for 1 s, then shake a fist. Score doesn't change. A parcel hitting a car makes it honk; one hitting a sleeping dog wakes it; one hitting a beehive angers the swarm.
- **Roof luck:** 0.5 s after a parcel lands on a roof, it slides down with a slide-whistle. 35% of the time it flips off the eave onto the porch: **Lucky!** (counts as Nice). Otherwise it catches on the gutter and teeters there (still "On the roof!").
- **Mailboxes:** a parcel that hits a mailbox pops its flag up with a "ding!" and bounces off.
- **Close call:** passing within 1.5 units in front of a moving car without getting hit gives "Close call!" (+25). The car wobbles as the driver flails. The streak is unaffected.
- **Startled walkers:** rushing past a walker within 2 units at more than 70% speed makes them leap up ("Eek!") and land.
- **Soggy courier:** after a sprinkler soaking, the courier drips water particles for 3 s and every footstep squeaks.
- **Residents act out the result:** PERFECT → jumps for joy with 3 hearts; Nice → waves; Sloppy → shrugs; Signed for → handshake; Broken → head in hands; Wrong house → tosses the parcel back onto the lawn with "Not mine!"; Lucky → looks up at the roof, then shrugs happily.
- **Trampolines:** backyard trampolines stand at `gagSpots.trampoline`. Walking or riding onto one launches the player 5 units up with "BOING!". The player is airborne, so Air Mail throws work, making it a great trick spot. A parcel landing on one bounces high toward a random nearby spot.

**Onomatopoeia:** big moments get a comic-style burst popup (§10): BONK!, SPLAT!, BOING!, WOOF!, BZZZ!, SPLOOSH!, THWUMP!, SKRRT!, HONK!, OUCH! One per event, max 3 on screen.

**Tone limits:** slapstick only. People *can* be bowled over (§2.15), but like cartoon characters: they fly, bounce, see stars and pop right back up to shake a fist. Nobody bleeds, cries, stays down or gets squashed flat for longer than a gag. No mean-spirited gags. **Animals are never hurt**: dogs hop out of the way, ducks flap off, and the bees just go home. Cars never hit pedestrians.

### 2.13 Free roam and exploration
- **Free roam is the hub state.** The HUD shows the radar, coins, Golden Parcel count and a "FREE ROAM" chip. There's no timer or score. Hazards run at the free-roam levels in `data/config.js` → `FREE_ROAM.hazards` (start with car 5, dog 3, sprinkler 3, skater 2, bees 2, bin 8). Knockdowns and gags all work; knockdowns just don't cost anything.
- **Day cycle** (superseded by the day clock in §2.20; the blending rules below still apply): free roam slowly blends through morning → noon → golden → dusk → back to morning, with each preset held for `FREE_ROAM.minutesPerPhase` (2) and blended over 30 s. Blend by interpolating every numeric and color field of the two presets into a scratch preset (no allocations). While blending, refresh the static shadow map at most every 2 s. Missions with a fixed time of day blend to theirs over 2 s at mission start, then back to the cycle when the mission ends.
- **Changing hazard counts** between free roam and missions: the hazard manager holds a *target count* per hazard type. It despawns extra actors and spawns missing ones from the pools **only when the spot is outside the camera frustum**, so nothing pops in or out on screen.
- **Golden Parcels** (a nod to GTA's hidden packages): 12 shiny golden boxes at `goldenParcels` in the neighborhood data. Each one spins, bobs and sparkles, but **isn't** shown on the radar. Pick one up by touching it: fanfare, "GOLDEN PARCEL 4/12", +50 coins, saved forever. Finding all 12 unlocks the **golden bike** (a vehicle identical to `bike` with gold colors, `unlockCost: null`, unlocked by `unlock: { goldenParcels: 12 }`). Some are hidden in fun places: the middle of the cul-de-sac, the playground, behind the school, beside the pond.
- **Mission markers are visible from far away** (tall light columns with fog disabled on their material), so the world invites you to go and pick something up.
- **Locker marker** at the Distribution Center: opens the courier and vehicle select screens (live showroom) to swap or buy. That's the only place to change them after the first choice.

### 2.14 The Quickbox Distribution Center (the hub)
The Distribution Center is the depot building (footprint `x 36, z 36, w 7, d 2`) plus the parking lot in front of it. It's the heart of the map and must feel busy:
- A large teal warehouse with a big lit **QUICKBOX** sign, 3 loading docks with roll-up doors (the middle one open), and a **conveyor belt** coming out of the open dock carrying boxes. The boxes use one InstancedMesh and slide along; the belt feeds the **pickup zone** (`restockZone`).
- 2 parked Quickbox vans at the docks, a semi-truck trailer in the lot's east end (tiles x 43–45, z 36–37; static collider), pallets of boxes, and a **forklift NPC** driving back and forth between the pallets and the dock (ambient, cosmetic, it beeps when reversing).
- **Markers** in the lot (tiles from `missionMarkers` in the data): `dispatch` (teal, a parcel icon; all main shifts) and `locker` (purple, a shirt icon). Side-mission markers stand in front of their shops (`bakery`: a pink cake icon, `hardware`: an orange wrench icon).
- On the radar, the Distribution Center is always shown as a **Q** blip, clamped to the radar's edge when far away, so you can always find your way back.

### 2.15 Mischief (GTA-lite)
A nod to both Paperboy (vandalizing non-subscribers) and GTA (running people over, the wanted level), played strictly as cartoon slapstick. All tuning goes in `data/mischief.js` (breakables, points, heat) and `data/config.js` → `MISCHIEF`.

**Bowling pedestrians**
- Walkers, waving residents, skater kids and the forklift driver (when out of the forklift) can be **bowled over**. This happens when the player hits them at more than 40% of max speed on a vehicle, or more than 75% on foot (a "shove"). Slower contact just makes them step aside with "Hey, watch it!".
- A bowled pedestrian flies like a bowling pin: launched along the player's direction plus upward (speed ∝ player speed), spinning on two axes. They bounce twice ("BONK!"), skid, lie there with dizzy stars for 1.5 s, then **pop back up** with an elastic bounce, shake a fist ("HEY!"), and walk away 50% faster, keeping clear of the player for 20 s.
- Hitting 2 or more within 1 s: **STRIKE!** (pins sound). Players lose only 15% speed on impact and never get knocked down by this.
- In a mission it's worth **0 points** (couriers don't get paid for this) and adds **heat**. In free roam the pause menu keeps a "People bowled" counter just for fun.
- Hazard dogs and ambient animals are never bowled. They always hop aside in time (a scripted dodge when within 2 units, with a "Yip!").

**Grump houses (sabotage targets)**
- **Grumps** are non-subscribers who hate Quickbox. Every mission picks `grumps` houses (default 3) among the non-target houses with the mission seed; free roam picks `FREE_ROAM.grumps` (4) per session.
- **A Grump house is easy to spot:** a "NO QUICKBOX!" lawn sign (from the sign atlas), a grumpy garden gnome, 2 plastic flamingos, drawn curtains (window glow color darkened), a dark mailbox with a red flag, and their car in the driveway (if there is one). On the radar, Grump houses are **red house blips** during a mission. In free roam they appear only within radar range.
- **Breakables** (from a pool at mission start; they reset at mission start and end, and in free roam 60 s after being off-screen):
  | Breakable | How | Points (mission) | Heat | Effect |
  |---|---|---|---|---|
  | Window | parcel hits a window rect | 75 | 1 | "CRASH!", glass shard particles, a cracked-pane overlay appears |
  | Garden gnome | parcel or player hits it | 50 | 1 | the gnome tips over and rolls, with "Bonk!" |
  | Flamingo | parcel or player hits it | 25 each | 0.5 | spins up into the air and lands head-first in the lawn |
  | Mailbox | parcel or player hits it | 50 | 1 | "THUNK!", pops off its post and wobbles on the ground |
  | Car alarm | parcel hits the Grump's car | 100 | 1.5 | whoop-whoop alarm for 5 s, flashing lights (glow geometry toggle) |
  | Trash bin | as knockable | 10 | 0 | tips over, spilling a few boxes |
- Every hit makes the Grump burst out of the front door shaking a fist ("YOU KIDS!") for 2 s. On the 3rd hit on the same house, the Grump chases you on foot for 4 s at 5 units/s, which is harmless but funny. If they catch you, you get a "shove" knockdown-lite (dizzy stars, no parcel lost).
- **Sabotage costs a parcel** (unless you do it by crashing into things yourself), so it's a real risk/reward choice during a mission.
- Breaking a **subscriber's** things (any non-Grump house) gives "Oops!" (−50 in a mission), 2 heat, and the resident storms out.

**Neighborhood Watch (the wanted level)**
- **Heat** is a number that maps to **0–3 whistle icons** above the radar (thresholds 3 / 6 / 10). Sources: bowling a pedestrian (+1), breakables (table above), subscriber damage (+2).
- **Level 1:** walkers point and gasp, residents glare, and nobody chases you yet.
- **Level 2:** **Deputy Doug** of the Neighborhood Watch appears on a **Segway** (spawned off-screen at the nearest road or sidewalk tile 30–45 units away). He chases at 8.5 units/s, so a bike or scooter can outrun him but on foot you're caught. He blows his whistle every few seconds.
- **Level 3:** plus a Watch **golf cart** (11 units/s, uses roads, brakes for corners) with a spinning orange light.
- **Losing them:** when no Watch unit is within 25 units for 8 s, the whistle icons flash, and then heat drops to the bottom of the next lower level. Marlo's Charm drops one level instantly. Watch units give up and trundle off when heat reaches level 1.
- **BUSTED!** (a Watch unit within 1.0 unit): hit-stop, whistle blast, Doug writes a ticket (a big paper-note particle flutters), and a 2 s control freeze. Penalty: in free roam, lose 10% of coins (min 10, max 100); in a mission, −300 points and the streak resets. Heat resets to 0. Then Doug says "Move along!" and leaves.
- Watch units use the hazard system: hazard defs `watchSegway` and `watchCart` with behavior `watchChase`, spawned by the heat system rather than by counts. Max 2 at once.
- **Heat decays by itself** at 0.5 per 10 s while below level 2, so small mischief is forgiven.

### 2.16 Addressed parcels (every parcel has an address)
Missions are real routes: each parcel in the stack is addressed to one target, so the order you deliver in matters.
- On restock, the stack is filled with the undelivered targets' parcels in target-list order (`min(capacity, undelivered)`, §2.6). Each parcel carries its target's address and package type.
- **The top parcel is the one you throw.** The HUD shows it: `📦 #14 Maple Ave · fragile` (address from §6.3). **R** cycles the stack (top parcel to the bottom, a short shuffle animation on the back stack plus a *zip* SFX), so you can choose your own route as long as the right parcel is on top.
- A throw that lands on the top parcel's own house scores normally (§2.4). A throw that lands on **another target house** is **"Wrong address!"**: −25, streak reset, the parcel is lost (the target stays; you need a restock to replace it, §2.6). A non-target house stays "Wrong house!" as today.
- **Doorstep hand-over** (the slow, safe option) automatically hands over the matching parcel from anywhere in the stack, so walking up never needs cycling.
- The GPS route, the radar's highlighted blip and the strongest target marker follow the **top parcel's** house. The other targets keep a dimmer marker.
- The aim assist only snaps to the top parcel's house (a Trick Shot homes in on it too, §2.8).
- The autoplayer (§12.2) always throws the top parcel at its own house (and cycles with R when another target is closer).

### 2.17 Parcel lockers
Fixed Quickbox **parcel lockers** (not the courier/vehicle locker marker at the depot) stand on sidewalks around each neighborhood (`parcelLockers: [[x, z], ...]` in the neighborhood data, 2–4 per neighborhood, never right next to the depot or the local pickup point).
- **In a mission**, standing at a locker for 1.0 s (the same progress ring as the depot) restocks you like the pickup zone (§2.6). After that the locker is **empty for the rest of the shift**: its light turns from teal to red, its door hangs open, and its radar blip turns grey. All lockers refill when a new shift starts.
- In free roam, a locker does nothing (a little "Closed. Shift parcels only" popup).
- Radar and full map show full lockers as teal squares and empty ones as grey squares; the GPS points to the nearest *full* locker or the pickup zone, whichever is closer, when you're empty.
- Model: a teal voxel cabinet that fits **inside its one sidewalk tile** (about 3.2 wide × 1.2 deep × 2.2 tall units), its back against the yard-side edge of the tile and its doors facing the sidewalk/street, leaving room to walk past. It never reaches onto a road or a neighboring tile. It has a grid of little doors, the Quickbox logo (atlas) and a glow light (glow mesh, §7.4). It's a static collider; all lockers merge into the chunk, and only the light/door state changes (one small InstancedMesh for the doors + lights).
- **Future option (not now):** a Quickbox van you call from a call box that drives to you along the roads. Leave it out; lockers cover the need.

### 2.18 More neighborhoods (old-school Zelda-style edge transitions)
The world becomes **several suburbs**, each its own neighborhood data file, joined by roads that leave the map edge. Only one suburb is loaded at a time.
- **Every suburb must look and play differently** from Maple Hollow, which stays the flat, square starter. Each new suburb needs all of these:
  - an **irregular outline**: forest, water, cliffs or fences carve the playable shape out of the rectangular grid, so it never reads as a box;
  - **elevation**: terraces at different heights joined by ramps, stairs and retaining walls (§2.19);
  - a **different road layout**: winding roads, dead ends, a loop, bridges, alleys, rather than Maple Hollow's grid;
  - its own **landmark**, **house-style mix and palette tint**, a **hazard mix** and at least one **unique gag**.
- **Edge exits:** a road that runs off the map edge is an exit (`exits: [{ id, edge: 'N'|'E'|'S'|'W', tiles: [from, to], to: '<neighborhoodId>', entry: '<exitId in the target>' }]`). Driving into it fades to a road-sign card ("Welcome to Cedar Heights", 0.6 s), unloads the current suburb (dispose every GPU resource, §8), loads the next, and places you at the matching entry facing inward, keeping your courier, vehicle and speed.
- **Leaving during a shift** asks "Clock out? Undelivered parcels go back to the depot." (§2.20); yes ends the shift with its report, no turns you around. Shifts belong to one suburb (`neighborhood` in §11.5).
- **Unlocks:** each suburb has `unlockStars` (total stars from all shifts). A locked exit shows a barrier with a sign "Opens at 8★" and a padlock blip on the radar.
- **Each suburb has a small Quickbox pickup point** (a kiosk with an awning and a parked van) holding its own `dispatch` marker and `restockZone`, so its shifts work without driving back to Maple Hollow. Its shifts are added to `data/shifts.js` with `giver: 'dispatch'` + `neighborhood: '<id>'`. The dispatch card at each kiosk lists only that suburb's shifts.
- **Region map:** the full map (Tab) gets a small inset showing the suburbs as tiles linked by their roads (locked ones greyed with the star count), with "you are here".
- **Save** (`parcelboy.save.v1`, additive fields only): `neighborhood` (current suburb id), and golden parcels become per-suburb (`goldenParcels: { [neighborhoodId]: [indices] }`; migrate the old array to `maple-hollow`). The golden bike still needs Maple Hollow's 12.
- **Starter suburbs** (names, themes and unlocks are starting values):
  | id | Name | Unlock | Shape and terrain | Landmark | Hazards / gag |
  |---|---|---|---|---|---|
  | `cedar-heights` | Cedar Heights | 8★ | a hillside: 3–4 terraces, a switchback road climbing north, long steep driveways, stair paths only couriers on foot can take | a hilltop water tower + overlook with a bench | runaway bins that roll downhill; **gag:** a missed parcel bounces and rolls downhill ("Come back!") |
  | `lakeside` | Lakeside | 16★ | a lake bites into the map from one side; an irregular shoreline, two bridges, a boardwalk along the water, houses on a low bluff | a pier with a little lighthouse | geese (chase like dogs, honk, never hurt), more sprinklers; **gag:** parcels that land in the lake float and bob ("SPLOOSH! …and it floats"), still lost |
  | `old-town` | Old Town | 26★ | dense, crooked streets around a market square, narrow alleys (walk-only), row houses, a low hill with the old church | a clock tower that chimes on the hour (day cycle) | more skaters and pedestrians, a market stall you can bowl into fruit everywhere (cartoon, +heat); **gag:** pigeons that lift off as one big flock |
- Maple Hollow gets one exit per new suburb (a road cut through the forest border), added by a script in M14.

### 2.19 Terrain heights
Neighborhoods can have **levels** (0–3, 1.5 units per level).
- A neighborhood has an optional `heights` layer: an array of strings the same size as `map`, one char per tile: `0`–`3` = that level, `/` = a **ramp** that rises from its lower neighbor to its higher neighbor along one axis, `=` = **stairs** (like a ramp, but walk-only: vehicles are blocked). Missing layer = everything at 0 (Maple Hollow stays flat).
- Where two walkable tiles meet at different levels with no ramp or stairs, there's a **retaining wall** (a solid edge collider, built as stone or brick boxes with a cap). Dropping off a wall edge is allowed (a cartoon hop down, land with a little squash); climbing up is not.
- `world/terrain.js` exposes `groundY(x, z)` (constant per level tile, a linear slope on ramp/stairs tiles; allocation-free) and `edgeBlocked(fromTile, toTile, vehicle)`. Everything that stands on the ground uses it: player, parcels (landing and bouncing), hazards, Watch units, ambient life, markers, golden parcels, blob shadows, the follow cam's ground clearance. Traffic loops may only use road tiles and ramps.
- Ground tiles, curbs, roads and sidewalks are built at their level (slabs reach down to the level below so there are no gaps); ramps are sloped boxes, built as small steps if a true slope isn't possible with boxes (keep the voxel look). Houses, buildings and props sit at their tile's level.
- Throwing up or down a level works naturally with the parcel's flight (§2.4); aim assist uses the target's real `y`.

### 2.20 Shifts follow the day clock (no time limit, no game over)
> **Changed 2026-10-02 (M15a item 11):** shift windows, "Opens at" and the wait bench are gone; missions are available any time and last a number of game hours from when you accept them. The rest of this section (one world clock, partial pay, no game over, side missions' soft deadline, the clock HUD) still applies.

A shift is a part of the day, not a stopwatch. If you don't deliver everything, you just aren't paid in full. Overrides the timer wording in §2.1, §2.6, §2.10, §2.13 and §10.
- **One world clock.** The game has a clock (`gameplay/dayClock.js`) that runs everywhere, in free roam and in shifts: **1 game hour = 60 real seconds** from 06:00 to 24:00, and the night (00:00–06:00) passes in 60 real seconds total. The time-of-day look is driven by the clock (replacing `FREE_ROAM.minutesPerPhase`): morning ~06–10, noon ~11–15, golden ~16–19, dusk ~19.5–24, blended in between (same no-allocation blending as §2.13). A shift never snaps the lighting; the clock is the truth. The clock is saved, and shown on the HUD (`10:24`).
- **Shift windows.** Each shift has a `window: ['07:00', '11:00']` instead of `duration`; its time of day follows from the window. Starting values: Morning Round 07:00–11:00, Lunch Rush 11:30–15:00, Fragile Friday 11:30–15:30, Golden Hour 16:00–20:00, Night Owl 19:30–24:00. The dispatch card lists every shift whose window is open now (others show "Opens at 16:00"). You can take an open shift any time inside its window; starting late just leaves less of the day. One main shift at a time.
- **Waiting is optional:** a Quickbox bench next to the dispatch marker; F there fast-forwards the clock (×20, with a ticking-clock sound) to the next shift window opening. Walking off stops it.
- **The shift ends** when every parcel is delivered, when its window closes, or when you **clock out early** (pause menu, replacing "Abandon"). There is no failure screen: the results are a **shift report**: "8 / 10 delivered", pay for the delivered parcels, style points, stars, coins, best record. Undelivered parcels go back to the depot automatically: no penalty, they're just unpaid.
- **Pay and score:** each delivered parcel adds its points (§2.4, multiplier and streak as before); coins = `floor(score / 10)` as before. The old "time bonus" becomes an **early finish bonus**: remaining game minutes in the window × 2 points. Stars use the shift's thresholds; re-tune them for windows with the autoplayer (§12.4).
- **During a shift you play freely.** Golden parcels, mischief, trampolines and side missions all keep working; the shift just keeps running on the clock. Leaving the suburb through an exit (§2.18) asks "Clock out? Undelivered parcels go back to the depot." instead of being blocked.
- **Side missions** (Cake Rush, Heavy Haul) have a soft **deliver-by** time (`deliverBy: 60` game minutes after accepting) instead of a timer: delivered in time = full pay plus the tip, late = pay without the tip. They never fail; they end on delivery or when you clock out. They can run alongside a main shift (the HUD shows both).
- **HUD:** the countdown is replaced by the clock and the shift's end, e.g. `10:24 · shift ends 11:00`, which turns orange in the window's last game hour. No red pulsing panic timer.
- **Schema change** (§11.5, log under *Decisions*): `duration` → `window` (main shifts) or `deliverBy` (side missions); `timeOfDay` is derived from the window (main shifts) or `null` (side missions). The save gains `clock` (game minutes since 00:00).

---

## 3. Tech stack and project layout

- **Three.js r170** (`three@0.170.0`), vendored as an ES module. No addons.
- Plain ES modules loaded by the browser through an import map. **No build step.**
- **nginx:alpine** in Docker serves `game/`. In development the folder is bind-mounted, so you edit and reload.
- Screenshots come from **Playwright** in its own container, which uses the same compose network.
- UI is **HTML/CSS overlays** above the canvas, not drawn in WebGL.

```
parcelboy/
  AGENTS.md  PLAN.md  PROGRESS.md
  Dockerfile  compose.yaml  .dockerignore  .gitignore
  docker/nginx.conf
  tools/shots/Dockerfile  tools/shoot.cjs  tools/shots.json
  shots/                      (output, git-ignored)
  game/
    index.html
    css/ui.css
    vendor/three.module.js    (+ three.core.js if r170 needs it; see M0)
    src/
      main.js                 boot: parse URL params, create systems, start the loop
      core/   loop.js rng.js events.js input.js save.js registry.js params.js debug.js pool.js
      render/ renderer.js voxel.js palette.js lighting.js sky.js camera.js effects.js floatText.js
      world/  tilemap.js worldBuilder.js ground.js buildings.js props.js collision.js traffic.js markers.js
      entities/ player.js courierModel.js vehicleModels.js parcels.js hazards.js npcs.js ambient.js
      behaviors/ index.js carPatrol.js dogChase.js sprinkler.js patrolPath.js knockable.js static.js beeSwarm.js watchChase.js
      gameplay/ freeRoam.js mission.js mischief.js heat.js markers.js collectibles.js dayCycle.js scoring.js targeting.js abilities.js progression.js pathfind.js
      audio/  audio.js sfx.js music.js ambience.js
      ui/     ui.js hud.js radar.js fullMap.js missionCard.js screens/title.js screens/select.js
              screens/pause.js screens/results.js screens/settings.js
      data/   config.js palette.js characters.js vehicles.js hazards.js packages.js shifts.js timeOfDay.js mischief.js
              neighborhoods/index.js neighborhoods/maple-hollow.js
```
The file list is a guide. Split or merge files when it keeps each one under about 300 lines, and keep the folder structure.

---

## 4. Infrastructure files (create these verbatim in M0)

**`Dockerfile`** (production image; development uses the bind mount in compose):
```dockerfile
FROM nginx:1.27-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY game/ /usr/share/nginx/html/
```

**`docker/nginx.conf`**
```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;
    sendfile off;
    gzip on;
    gzip_types text/css application/javascript application/json;
    location / {
        add_header Cache-Control "no-cache";
        try_files $uri $uri/ =404;
    }
}
```

**`compose.yaml`**
```yaml
services:
  web:
    build: .
    ports:
      - "8080:80"
    volumes:
      - ./game:/usr/share/nginx/html:ro
      - ./docker/nginx.conf:/etc/nginx/conf.d/default.conf:ro
  shots:
    build: ./tools/shots
    profiles: ["tools"]
    depends_on: [web]
    user: "${UID:-1000}:${GID:-1000}"
    environment:
      BASE_URL: http://web
      HOME: /tmp
    volumes:
      - ./tools:/tools:ro
      - ./shots:/shots
    entrypoint: ["node", "/tools/shoot.cjs"]
```

**`tools/shots/Dockerfile`** (the image tag and the npm version **must match**):
```dockerfile
FROM mcr.microsoft.com/playwright:v1.55.0-noble
WORKDIR /opt/shots
RUN npm init -y >/dev/null && npm install playwright@1.55.0
ENV NODE_PATH=/opt/shots/node_modules
```

**`tools/shoot.cjs`**
```js
// Usage (inside container): node /tools/shoot.cjs [nameFilter]
const { chromium } = require('playwright');
const fs = require('fs');
const BASE = process.env.BASE_URL || 'http://web';
const filter = process.argv[2] || '';
const list = JSON.parse(fs.readFileSync('/tools/shots.json', 'utf8')).filter(s => s.name.includes(filter));

(async () => {
  const browser = await chromium.launch({
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  let failed = 0;
  for (const shot of list) {
    const page = await browser.newPage({ viewport: { width: shot.width || 1280, height: shot.height || 720 } });
    const errors = [], warnings = [];
    page.on('console', m => {
      if (m.type() === 'error') errors.push(m.text());
      if (m.type() === 'warning') warnings.push(m.text());
    });
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    try {
      await page.goto(BASE + shot.url, { waitUntil: 'load' });
      await page.waitForFunction(() => window.__pb && window.__pb.ready === true, null, { timeout: 30000 });
      for (const js of shot.eval || []) await page.evaluate(js);
      await page.waitForTimeout(shot.waitMs ?? 1500);
      await page.screenshot({ path: `/shots/${shot.name}.png` });
      const stats = await page.evaluate(() => window.__pb.stats());
      fs.writeFileSync(`/shots/${shot.name}.json`, JSON.stringify({ url: shot.url, stats, errors, warnings }, null, 2));
      console.log(`${errors.length ? 'FAIL' : 'ok  '} ${shot.name}  calls=${stats.drawCalls} tris=${stats.triangles} geos=${stats.geometries} tex=${stats.textures}`);
      if (errors.length) { failed++; errors.forEach(e => console.log('   error: ' + e)); }
    } catch (e) {
      failed++;
      console.log(`FAIL ${shot.name}: ${e.message}`);
      errors.forEach(x => console.log('   error: ' + x));
    }
    await page.close();
  }
  await browser.close();
  process.exit(failed ? 1 : 0);
})();
```

**`tools/shots.json`**: an array of `{ "name", "url", "waitMs"?, "eval"?: [js strings], "width"?, "height"? }`. Each milestone **adds** its entries (§13); never delete earlier ones. Name them `m<N>-<what>`.

**`.dockerignore`**: `shots/`, `tools/`, `.git/`, `*.md`. **`.gitignore`**: `shots/`.

**`game/index.html`** skeleton:
```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Parcelboy</title>
  <link rel="stylesheet" href="css/ui.css">
  <script type="importmap">{ "imports": { "three": "./vendor/three.module.js" } }</script>
</head>
<body>
  <canvas id="game"></canvas>
  <div id="ui"></div>
  <script type="module" src="src/main.js"></script>
</body>
</html>
```

---

## 5. Architecture

### 5.1 Coordinates
- 1 world unit ≈ 1 meter. **Tile size = 4 units.** The map's tile `(x, z)` covers world `[x*4, x*4+4] × [z*4, z*4+4]`, and its center is `((x+0.5)*4, (z+0.5)*4)`.
- **+Y is up. North is −Z.** Heading 0 faces north (−Z) and heading increases clockwise, so forward = `(sin h, 0, −cos h)`. Put these conversions in one helper module and use it everywhere.
- The ground is at y = 0. Sidewalks, porches and driveways are raised to y = 0.12 (curbs); this is visual only, and movement ignores it.

### 5.2 The game loop (`core/loop.js`)
- Fixed-step simulation at **60 Hz** with an accumulator. At most 4 sim steps per frame; drop leftover time beyond that (no spiral of death).
- **Frame cap:** `requestAnimationFrame` always fires, but render only when `now − lastRender ≥ 1000/targetFps − 1`. `targetFps` = 60, or 30 in Battery saver and in menus. When the game is paused **and** nothing is animating, render at 10 fps.
- `document.visibilitychange` → hidden: cancel the rAF loop entirely and suspend the AudioContext. Visible again: resume, and reset `lastTime` so there's no giant delta.
- `window.blur` during a shift → automatic pause.
- Interpolation between sim steps isn't needed. Render the latest state.

### 5.3 Game states (`main.js` owns a small state machine)
`boot → title → (first time: selectCourier → selectVehicle) → freeRoam`.
`freeRoam → missionIntro → mission → results → freeRoam` (Continue) or `→ missionIntro` (Retry). `freeRoam`/`mission` ⇄ `paused` and ⇄ `fullMap`. `freeRoam → locker (selectCourier → selectVehicle) → freeRoam`. Abandoning a mission goes `paused → freeRoam`.
`freeRoam` and `mission` share one "playing" core (player, hazards, ambient, world). A mission is a **layer on top** (`gameplay/mission.js`) that adds targets, a timer, scoring and the pickup zone. There's no separate world or scene per mode.
Each state has `enter(params)`, `exit()`, `update(dt)` and `uiScreen`. The world (neighborhood meshes) is built **once** at boot and reused by every state. Menus show the live world in the background, using camera presets.

### 5.4 Registries (`core/registry.js`)
```js
export class Registry {
  constructor(kind, requiredFields) { /* store, kind for error messages */ }
  add(def)   { /* throw if id missing/duplicate or a required field is missing */ }
  get(id)    { /* throw Error(`Unknown ${kind}: ${id}`) if missing */ }
  has(id)    {}
  all()      { /* array in insertion order */ }
}
```
There are registries for `characters`, `vehicles`, `hazards`, `packages`, `shifts`, `neighborhoods`, `behaviors`, `abilities`, `timesOfDay` and `models` (model builders by id). `data/*.js` files export plain arrays, and `main.js` registers them at boot. **Behaviors, abilities and model builders are registered by string id**, so data can refer to them without the code knowing the id.

### 5.5 Events (`core/events.js`)
A tiny pub/sub (`on`, `off`, `emit`). Main events: `delivery` `{ targetId, result, points, pos }`, `parcelLost` `{ reason, pos }`, `knockdown`, `restock`, `throw`, `abilityUsed`, `shiftStart`, `shiftEnd`, `streak`. Audio, HUD, effects and NPCs listen to events, so gameplay code doesn't import them.

### 5.6 Actors and behaviors
- Each hazard instance is a plain object: `{ def, behavior, state, pos: Vector3, heading, mesh, radius, active }`.
- A behavior module exports `{ id, create(actor, ctx), update(actor, dt, ctx), onPlayerContact?(actor, ctx) }`, where `ctx` = `{ world, player, rng, events, collision, time }`.
- `entities/hazards.js` spawns instances from the shift's `hazards` counts, looks up each def and behavior, calls `update` every sim step, and handles contact checks (circle vs. circle).

### 5.7 Collision (`world/collision.js`)
- A static spatial hash on the tile grid. Each cell lists the static colliders overlapping it: AABBs for houses, buildings and parked cars; circles for tree trunks (r 0.6), lamps and hydrants (r 0.25); and the solid tiles `#` and `W` as tile-sized AABBs.
- `resolveCircle(pos, radius)` moves `pos` out of overlaps, X then Z, and returns whether a hit happened plus the hit normal.
- `raySegment(from, to)` is used for parcels in flight: return the first AABB hit plus its top height (`h`), so roof vs. wall can be told apart.
- Dynamic actors are checked against each other with a simple O(n²) loop over fewer than 30 actors, which is fine.

### 5.8 Pools (`core/pool.js`)
Everything spawned during play comes from a preallocated pool: parcels, particles, floating texts, NPC residents and markers. Pools are created at boot.

### 5.9 Seeded randomness
`core/rng.js` exports `mulberry32(seed)`. The shift seed comes from `?seed=` or `Date.now()`. Gameplay randomness (targets, accuracy offsets, spawns) uses it. Purely cosmetic randomness may use its own RNG.

---

## 6. The neighborhood: Maple Hollow

### 6.1 Data (copy **verbatim** into `game/src/data/neighborhoods/maple-hollow.js`)
This file was generated and checked by a script: every row is 48 characters, there are 40 rows, porches sit next to sidewalks, and traffic loops only run on road tiles. **Don't edit it by hand.**

```js
// Maple Hollow: generated and validated. Copy verbatim. x = column, z = row, (0,0) = north-west corner.
export default {
  id: 'maple-hollow',
  name: 'Maple Hollow',
  tileSize: 4,
  map: [
    '################################################', // 0
    '################################################', // 1
    '##ssssssssssssssssssssssssssssssssssssssssssss##', // 2
    '##sRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRs##', // 3
    '##sRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRs##', // 4
    '##sRRssssssssssssssssssRRssssssssssssssssssRRs##', // 5
    '##sRRs.ood.ood.ood.oodsRRs.XXXXXXXX.......sRRs##', // 6
    '##sRRs.HHd.HHd.HHd.HHdsRRs.XXXXXXXX.PPPPP.sRRs##', // 7
    '##sRRs.HHd.HHd.HHd.HHdsRRs.XXXXXXXX.PPPPP.sRRs##', // 8
    '##sRRs.t.t..t.t.tt..t.sRRs.XXXXXXXX.PPPPP.sRRs##', // 9
    '##sRRs.....t..tt..t...sRRs.XXXXXXXX.PPPPP.sRRs##', // 10
    '##sRRs.ttt............sRRs...t..t.t.......sRRs##', // 11
    '##sRRs................sRRs................sRRs##', // 12
    '##sRRs.HHd.HHd.HHd.HHdsRRs.HHd.HHd.HHd.HHdsRRs##', // 13
    '##sRRs.HHd.HHd.HHd.HHdsRRs.HHd.HHd.HHd.HHdsRRs##', // 14
    '##sRRs.ood.ood.ood.oodsRRs.ood.ood.ood.oodsRRs##', // 15
    '##sRRssssssssssssssssssRRssssssssssssssssssRRs##', // 16
    '##sRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRs##', // 17
    '##sRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRs##', // 18
    '##sRRssssssssssssssssssRRssssssssRRssssssssRRs##', // 19
    '##sRRs.ood.ood.ood.oodsRRsoo.HHosRRsoHH.oosRRs##', // 20
    '##sRRs.HHd.HHd.HHd.HHdsRRsHH.HHosRRsoHH.HHsRRs##', // 21
    '##sRRs.HHd.HHd.HHd.HHdsRRsHH....sRRs....HHsRRs##', // 22
    '##sRRs......t.......t.sRRst.....sRRs......sRRs##', // 23
    '##sRRsttt.t...t.......sRRs....sssRRsss...tsRRs##', // 24
    '##sRRs...tt.....t.....sRRs....sRRRRRRs....sRRs##', // 25
    '##sRRs................sRRs.HHosRRRRRRsoHH.sRRs##', // 26
    '##sRRs.HHd.HHd.HHd.HHdsRRs.HHosRRRRRRsoHH.sRRs##', // 27
    '##sRRs.HHd.HHd.HHd.HHdsRRs....sRRRRRRs....sRRs##', // 28
    '##sRRs.ood.ood.ood.oodsRRst...ssssssss...tsRRs##', // 29
    '##sRRssssssssssssssssssRRssssssssssssssssssRRs##', // 30
    '##sRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRs##', // 31
    '##sRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRs##', // 32
    '##ssssssssssssssssssssssssssssssssssssssssssss##', // 33
    '##PpppppppppppppppppppP..LLLLLLLLLLLLLLLLLLLLL##', // 34
    '##PPPPPPWWWWWWPPPpPPPPP..LLLLLLLLLLLLLLLLLLLLL##', // 35
    '##PtPPPPWWWWWWPtPpPPtPP...XXXXXXXXX.XXXXXXXLLL##', // 36
    '##PPPtPPPPPPPPPPPpPPPtP...XXXXXXXXX.XXXXXXXLLL##', // 37
    '################################################', // 38
    '################################################', // 39
  ],
  roads: [
    { name: 'North Road',   axis: 'x', x0: 3,  x1: 44, z: 3 },  // occupies rows z and z+1
    { name: 'Maple Avenue', axis: 'x', x0: 3,  x1: 44, z: 17 },
    { name: 'Creek Road',   axis: 'x', x0: 3,  x1: 44, z: 31 },
    { name: 'West Lane',    axis: 'z', z0: 3,  z1: 32, x: 3 },  // occupies cols x and x+1
    { name: 'Oak Street',   axis: 'z', z0: 3,  z1: 32, x: 23 },
    { name: 'East Drive',   axis: 'z', z0: 3,  z1: 32, x: 43 },
    { name: 'Willow Court', axis: 'z', z0: 19, z1: 24, x: 33, bulb: { x: 31, z: 25, w: 6, d: 4 } },
  ],
  // footprint is 2x2 tiles with top-left (x,z); facing = side the front door is on
  houses: [
    { id: 'h01', x: 7, z: 7, facing: 'N', street: 'North Road', num: 2 },
    { id: 'h02', x: 11, z: 7, facing: 'N', street: 'North Road', num: 4 },
    { id: 'h03', x: 15, z: 7, facing: 'N', street: 'North Road', num: 6 },
    { id: 'h04', x: 19, z: 7, facing: 'N', street: 'North Road', num: 8 },
    { id: 'h05', x: 7, z: 13, facing: 'S', street: 'Maple Avenue', num: 1 },
    { id: 'h06', x: 11, z: 13, facing: 'S', street: 'Maple Avenue', num: 3 },
    { id: 'h07', x: 15, z: 13, facing: 'S', street: 'Maple Avenue', num: 5 },
    { id: 'h08', x: 19, z: 13, facing: 'S', street: 'Maple Avenue', num: 7 },
    { id: 'h09', x: 27, z: 13, facing: 'S', street: 'Maple Avenue', num: 21 },
    { id: 'h10', x: 31, z: 13, facing: 'S', street: 'Maple Avenue', num: 23 },
    { id: 'h11', x: 35, z: 13, facing: 'S', street: 'Maple Avenue', num: 25 },
    { id: 'h12', x: 39, z: 13, facing: 'S', street: 'Maple Avenue', num: 27 },
    { id: 'h13', x: 7, z: 21, facing: 'N', street: 'Maple Avenue', num: 2 },
    { id: 'h14', x: 11, z: 21, facing: 'N', street: 'Maple Avenue', num: 4 },
    { id: 'h15', x: 15, z: 21, facing: 'N', street: 'Maple Avenue', num: 6 },
    { id: 'h16', x: 19, z: 21, facing: 'N', street: 'Maple Avenue', num: 8 },
    { id: 'h17', x: 7, z: 27, facing: 'S', street: 'Creek Road', num: 1 },
    { id: 'h18', x: 11, z: 27, facing: 'S', street: 'Creek Road', num: 3 },
    { id: 'h19', x: 15, z: 27, facing: 'S', street: 'Creek Road', num: 5 },
    { id: 'h20', x: 19, z: 27, facing: 'S', street: 'Creek Road', num: 7 },
    { id: 'h21', x: 26, z: 21, facing: 'N', street: 'Maple Avenue', num: 22 },
    { id: 'h22', x: 40, z: 21, facing: 'N', street: 'Maple Avenue', num: 30 },
    { id: 'h23', x: 29, z: 20, facing: 'E', street: 'Willow Court', num: 1 },
    { id: 'h24', x: 37, z: 20, facing: 'W', street: 'Willow Court', num: 2 },
    { id: 'h25', x: 27, z: 26, facing: 'E', street: 'Willow Court', num: 3 },
    { id: 'h26', x: 39, z: 26, facing: 'W', street: 'Willow Court', num: 4 },
  ],
  buildings: [
    { id: 'school',    kind: 'school', name: 'Hollow Elementary',  x: 27, z: 6,  w: 8, d: 5, facing: 'N' },
    { id: 'bakery',    kind: 'shop',   name: 'Crumb & Co.',        x: 26, z: 36, w: 3, d: 2, facing: 'N', deliverable: true, accent: '#ff8fab' },
    { id: 'hardware',  kind: 'shop',   name: 'Nuts & Bolts',       x: 29, z: 36, w: 3, d: 2, facing: 'N', deliverable: true, accent: '#4cc9f0' },
    { id: 'icecream',  kind: 'shop',   name: 'Scoops',             x: 32, z: 36, w: 3, d: 2, facing: 'N', deliverable: true, accent: '#ffd166' },
    { id: 'depot',     kind: 'depot',  name: 'Quickbox Distribution Center', x: 36, z: 36, w: 7, d: 2, facing: 'N' },
  ],
  playground: { x: 36, z: 7, w: 5, d: 4 },
  pond: { x: 8, z: 35, w: 6, d: 2 },
  spawn: { x: 39, z: 34, facing: 'N' },
  restockZone: { x0: 37, z0: 35, x1: 41, z1: 35 },   // inclusive tile rect in front of the depot
  // Closed loops of tile waypoints, right-hand traffic, cars drive tile centers between them.
  traffic: {
    outer: [[4, 4], [43, 4], [43, 31], [4, 31]],
    east:  [[24, 18], [43, 18], [43, 31], [24, 31]],
    west:  [[23, 17], [4, 17], [4, 4], [23, 4]],
  },
  // Sidewalk rectangles (inclusive tile rects); walkers and skaters follow their perimeter.
  sidewalkLoops: {
    A: { x0: 5,  z0: 5,  x1: 22, z1: 16 },
    B: { x0: 25, z0: 5,  x1: 42, z1: 16 },
    C: { x0: 5,  z0: 19, x1: 22, z1: 30 },
    D: { x0: 25, z0: 19, x1: 42, z1: 30 },
  },
  hazardSpots: {
    dog:       [[12, 12], [16, 23], [40, 28]],
    sprinkler: [[6, 6], [6, 15], [26, 15], [6, 29]],
    beehive:   [[8, 11], [15, 36], [41, 24]],   // these are 't' tiles: the hive hangs from that tree
  },
  // Mission and locker markers (tile centers). `giver` ids referenced by shifts.
  missionMarkers: [
    { id: 'dispatch', x: 41, z: 34, color: '#00b4a6', icon: 'parcel' },
    { id: 'locker',   x: 37, z: 34, color: '#8338ec', icon: 'shirt' },
    { id: 'bakery',   x: 27, z: 35, color: '#ff8fab', icon: 'cake' },
    { id: 'hardware', x: 30, z: 35, color: '#fb8500', icon: 'wrench' },
  ],
  // Pickup zones for side missions = the shop's front row; the depot uses restockZone.
  // Hidden collectibles (walkable tiles, validated). Not shown on the radar.
  goldenParcels: [[6, 12], [41, 6], [35, 10], [38, 9], [21, 24], [26, 27], [33, 26], [8, 37], [23, 35], [14, 35], [28, 24], [20, 12]],
  gagSpots: {
    trampoline: [[14, 11], [38, 12], [12, 24]], // '.' back-yard tiles; trampoline radius 1.6 units, not solid
  },
};
```

### 6.2 Tile legend
| Char | Meaning | Walkable | Visual |
|---|---|---|---|
| `#` | forest border | no (solid) | dark grass plus dense tree instances (2 per tile, random offset) |
| `.` | yard grass | yes | lawn |
| `R` | road | yes | asphalt; lines from `roads` (§6.3) |
| `s` | sidewalk | yes | raised concrete slabs with thin seams |
| `o` | porch / front path | yes | wooden porch deck; also the **porch zone** of the adjacent house |
| `d` | driveway | yes | light concrete; parked car on 40% of them (static collider) |
| `H` | house footprint | no (collider from `houses`) | grass under the house |
| `X` | building footprint | no (collider from `buildings`) | grass under the building |
| `t` | tree | trunk is solid (circle) | one tree, random species and size |
| `P` | park lawn / playground | yes | brighter lawn |
| `p` | park path | yes | sandy path |
| `W` | pond | no (solid) | water (§7.3) |
| `L` | parking lot | yes | asphalt with white parking-stall lines along row 34 |

At boot, the tilemap loader **validates**: equal row lengths, known characters only, `H` tiles exactly matching the 2×2 house footprints, `X` tiles exactly matching building footprints. It throws a clear error if anything fails.

### 6.3 Derived geometry
- **Porch zone** for each house = its two `o` tiles (from `facing`: N → row z−1, S → row z+2, E → col x+2, W → col x−1). The **doormat point** is the middle of the two tiles, pushed 1.2 units toward the door. The porch zone of a shop = the tile row in front of it (row 35), width = shop width.
- **Lot** of a house = footprint expanded by 1 tile, clipped to walkable non-road tiles (used for "Sloppy").
- **Road lines:** from `roads`, draw a dashed yellow center line along the boundary between a road's two tiles (dash 1.5, gap 1.5). Skip it inside intersections, meaning tiles covered by two roads. At each intersection, draw white zebra crosswalks on the road tiles right outside the intersection, all four arms. The Willow Court bulb gets no lines.
- **Addresses:** `${num} ${street}`, shown in the delivery list and on each house's mailbox (texture atlas, §7.8).

### 6.4 Building styles
Pick a style for each house with the RNG seeded by the house id (so it's stable between runs). Colors come from the palettes in §7.2. Every house needs: walls, a roof, a front door on the `facing` side, windows (separate "glow" geometry, §7.4), a porch deck with a small roof over the door, a doormat (target visual), a mailbox at the sidewalk edge of the porch, and a porch lamp. Footprint = 8×8 units, with the walls inset 0.4 units.
| Style | Floors | Roof | Signature detail |
|---|---|---|---|
| `cottage` | 1 (wall 3.2) | steep gable | flower boxes under the windows, round shrub |
| `colonial` | 2 (wall 5.8) | gable | symmetric windows, shutters, chimney |
| `ranch` | 1 (wall 3.0) | low hip | wide windows, attached garage block toward the driveway side |
| `modern` | 2 (wall 5.8) | flat with parapet | large glass panels, wood slat accent |
| `bungalow` | 1.5 (wall 3.6) | gable with a dormer | wide front porch with two posts |

Other buildings: **Hollow Elementary** (2 floors, brick red `#c8553d`, clock over the door, flagpole with a flag that gently waves via mesh rotation), **shops** (1 floor, glass front, striped awning in `accent`, sign), **Quickbox Distribution Center** (see §2.14 for everything it must contain).

Roofs are built as stepped boxes (a stacked voxel look). **No custom triangle geometry** is needed; everything is boxes.

---

## 7. Visual style guide

### 7.1 Look
A toy diorama: chunky boxes, bevels faked with slightly darker outer boxes, bright saturated pastels, soft warm sunlight, and gentle fog that fades distant things into the sky color. The mood is happy and tidy. Reference feel: *Crossy Road* meets *Animal Crossing*, from a 3/4 view.

### 7.2 Palette (`data/palette.js`)
```js
export const PALETTE = {
  grass: ['#7ccf6a', '#74c663'], grassDark: '#4f9a46', park: '#8fd872', parkPath: '#e9c46a',
  road: '#4a4e69', roadLine: '#ffd166', crosswalk: '#f2e9e4', sidewalk: '#e6ddd4', sidewalkSeam: '#cfc4b8',
  driveway: '#cbbfb3', porch: '#c98f5a', lot: '#5f6275', lotLine: '#f2e9e4',
  water: '#4cc9f0', waterEdge: '#90e0ef',
  trunk: '#8d5a3b', canopy: ['#57cc99', '#38b000', '#80b918', '#52b788'], canopyForest: ['#2d6a4f', '#40916c'],
  canopyAutumn: ['#f4a261', '#e76f51', '#e9c46a'],
  wall: ['#ffd6a5', '#fdffb6', '#caffbf', '#9bf6ff', '#a0c4ff', '#bdb2ff', '#ffc6ff', '#fffcf2', '#f4acb7'],
  roof: ['#e76f51', '#6d597a', '#355070', '#b56576', '#2a9d8f', '#8d99ae'],
  door: ['#ef476f', '#118ab2', '#06d6a0', '#ffd166', '#073b4c'],
  trim: '#fffaf0', windowDay: '#bde0fe', windowNight: '#ffe8a3',
  brand: '#00b4a6', brandAccent: '#ffbe0b', parcel: '#c8925a', parcelTape: '#00b4a6',
};
```
`timeOfDay` may swap canopies to autumn variants (Golden Hour uses 30% autumn).

### 7.3 Materials and lighting
- **One shared `MeshLambertMaterial({ vertexColors: true })` for all opaque world geometry.** Colors live in vertex colors. Plus: one `MeshBasicMaterial({ vertexColors: true })` for "glow" geometry (windows, lamp heads, signs), whose color multiplier changes with time of day; one water material (Lambert, 0.85 opacity); and one material for the sign texture atlas.
- **Fake ambient occlusion in vertex colors:** vertices at y ≤ 0.3 are darkened by 12%, and box faces pointing down by 25%. Add ±4% random brightness per box for a handmade look.
- `renderer.outputColorSpace = SRGBColorSpace`, `toneMapping = NeutralToneMapping`, exposure 1.0. (Not ACES: ACES desaturates and flattens the pastel palette.)
- Lights: one `HemisphereLight` (sky color and ground color from the time of day) plus one `DirectionalLight` sun. Nothing else. There are no point lights; lamps at dusk are emissive glow geometry plus a flat, soft, additive-blended ground "light pool" disc.
- **Shadows (static-only trick):** the sun's shadow map renders **only static world chunks**, with `renderer.shadowMap.autoUpdate = false`. Set `needsUpdate = true` only when (a) the time of day changes or (b) the player has moved more than 16 units from the last shadow-camera center (the shadow camera covers 96×96 units around the player, snapped to the texel grid). Dynamic actors (player, cars, dogs, NPCs, parcels) get **blob shadows**: a pooled dark, soft circular quad with an alpha gradient from one small canvas texture.
- Water: a flat plane that moves up and down by ±0.03 units with a sine, lighter edge tiles, and 3 ducks (tiny voxel models) swimming slow circles.
- **Sky:** a large inverted sphere with vertex colors running from horizon to zenith (colors from the time of day), `fog: false`, drawn first. `scene.fog = Fog(horizonColor, near, far)`, where near and far **scale with the camera's distance `d` to its look-at target**: `near = d + 45`, `far = d + 150`, updated every frame (no allocation). With the follow cam (d ≈ 17) that gives about 62/167; far-away preset cameras (overview) get almost no fog. The camera's `far` plane follows the same rule, `max(220, d + 260)`. The sky dome must use `depthWrite: false` and `renderOrder = -1`, so geometry beyond its radius still draws. Add 6 flat voxel clouds (one InstancedMesh) drifting slowly at y = 45.

### 7.4 Time-of-day presets (`data/timeOfDay.js`)
```js
export const TIMES_OF_DAY = [
  { id: 'morning', sunDir: [-0.6, 0.55, -0.3], sunColor: '#ffe3c2', sunIntensity: 2.4, hemiSky: '#bde0fe', hemiGround: '#b7e4a0', hemiIntensity: 1.1, skyZenith: '#8ecae6', skyHorizon: '#ffd6a5', glow: 0.0, autumn: 0.0 },
  { id: 'noon',    sunDir: [0.2, 0.95, 0.25],   sunColor: '#fff8e7', sunIntensity: 2.8, hemiSky: '#caf0f8', hemiGround: '#a7d88c', hemiIntensity: 1.2, skyZenith: '#5fa8d3', skyHorizon: '#caf0f8', glow: 0.0, autumn: 0.0 },
  { id: 'golden',  sunDir: [0.75, 0.3, 0.2],    sunColor: '#ffb86b', sunIntensity: 2.6, hemiSky: '#ffc8a2', hemiGround: '#9cc27a', hemiIntensity: 0.9, skyZenith: '#f4a261', skyHorizon: '#ffe5b4', glow: 0.3, autumn: 0.3 },
  { id: 'dusk',    sunDir: [0.8, 0.12, 0.4],    sunColor: '#ff8fab', sunIntensity: 1.1, hemiSky: '#7b8cde', hemiGround: '#4a5a6a', hemiIntensity: 0.8, skyZenith: '#2b2d62', skyHorizon: '#f28482', glow: 1.0, autumn: 0.0 },
];
```
These are starting values. Tune them in M11 by looking at screenshots: the scene should never look washed out or too dark. `glow` scales the window and lamp colors from `windowDay` to `windowNight` and turns on the lamp light pools.

### 7.5 Characters (`entities/courierModel.js`)
- Chibi proportions, about 1.9 units tall: legs 0.6, torso 0.65, **head 0.62 cube** (big and cute), and a cap or hair box on top. Eyes are 2 small dark boxes; a smile is 1 thin box.
- **At most 5 meshes per rig:** head+torso merged (1), 2 arms, 2 legs. Pivot the arms and legs at the shoulders and hips. All parts share the world Lambert material (vertex colors).
- A backpack or back rack shows the **carried parcel stack**. Pre-build geometry variants for 0–12 boxes at boot and swap `mesh.geometry` when the count changes (no new geometry during play).
- Procedural animation from a phase value: walk/run swings (limb angle ∝ speed), idle breathing (torso scale y ±2%), a throw pose (arm arcs over 0.25 s), jump squash and stretch (0.9/1.1), a knockdown spin-and-flop, a wave, and a riding pose (legs bent; on bike/cargo the legs pedal). Plus the cartoon set from §2.12: anticipation crouch, pancake flatten and pop-back, over-the-handlebars flight, windmill-legs skid, panic hop, puffy face (a head-scale morph plus red dot boxes, prebuilt), dizzy stars (a small InstancedMesh), jump-for-joy, shrug, head in hands, fist shake, and startled leap. All of them are driven by the same phase and timer system, with no new geometry during play.
- Colors come from the courier's `colors` in data. **The builder must work for any colors and `build`** (`slim` | `regular` | `sturdy`, which scale the torso width and height), so new couriers need data only.

### 7.6 Vehicles, hazards and NPCs
- **Mischief models:** Deputy Doug (the courier rig in a khaki uniform, a cap, big sunglasses and a whistle; always a bit smug), a Segway (a platform, 2 wheels and a T-bar), a Watch golf cart (white with an orange stripe and a spinning orange light box in glow geometry), a garden gnome (red hat, white beard, grumpy eyebrows), plastic flamingos (pink, on one thin leg), a "NO QUICKBOX!" lawn sign (atlas), and a cracked-window overlay (one InstancedMesh, placed over each Grump window and hidden with scale 0 until broken). `buildings.js` must **record each house's window rectangles** (center, size, facing) while building, so windows can be hit and overlaid.
- Vehicle models are built from boxes by id through the `models` registry: `bike` (frame, 2 wheels, handlebar, front crate), `scooter`, `cargo` (big front box with the Quickbox logo color). Each is a single merged mesh; wheels don't spin. Bob it and tilt 8° into turns for feel.
- Cars: rounded-box sedan and hatchback variants, merged into one mesh each, with colors picked from `#ef476f #ffd166 #06d6a0 #118ab2 #f8f9fa #8338ec`. They squash slightly when braking hard.
- Dogs: body, head, ears, tail and legs merged into one mesh. Animate with a whole-body bob plus a hop while running. The tail wag is a tiny separate mesh (so 2 meshes per dog).
- Skater kid: the courier rig builder with kid colors, plus a skateboard.
- **Bees:** one InstancedMesh of tiny yellow-and-black 2-box bees (24 per swarm, 1 draw call per swarm). Each bee orbits the swarm center on its own noisy loop (phase and radius precomputed at spawn; no allocation). When angry the cloud tightens and speeds up. **Beehive:** a striped honey-yellow stack of boxes hanging from a branch. It shakes when disturbed. **Trampoline:** a round-ish stepped box frame, a dark mat, and springs as small boxes; the mat dips on bounce.
- **Residents** (door wave NPCs) and **walkers**: the courier rig builder with random resident palettes. A walker 40% of the time walks a tiny dog (a separate simple mesh).

### 7.7 Ambient life (`entities/ambient.js`); this is what sells immersion
- 6 **walkers** on sidewalk loops (at 1.4 units/s). They wave when the player passes within 4 units.
- **Birds:** 3 flocks of 6 (InstancedMesh, 2-box birds) sitting on roofs or lawns. They scatter up and away when the player comes within 6 units, then land somewhere else later, with a flap sound.
- **Butterflies** in the park (InstancedMesh, 10), **ducks** on the pond, **chimney smoke** puffs on colonial houses (pooled particles, 1 per 0.8 s, only near the camera).
- Kids shooting hoops in the Willow Court bulb (2 NPCs; the ball arcs up and down).
- Every pedestrian NPC shares one **bowling state machine** (`entities/npcs.js`): walking → launched (arc and spin) → bounce/skid → dizzy → pop-up → fist-shake → avoiding. It's used by walkers, residents, skaters, Grumps and the forklift driver alike.
- **Window lights** at dusk, randomly 70% on.
- Distant ambient sound (§9).
- Everything here is cosmetic, must stay within budget, and **scales down in Battery saver** (half the counts, no smoke or butterflies).

### 7.8 Text on objects
**One** canvas texture atlas (1024×1024) is built at boot holding: street name signs, shop and depot signs, mailbox numbers, and the Quickbox logo (teal rounded box with a white "Q" and an arrow). Sign meshes use UV sub-rectangles of the atlas. This is one texture and one material. Blob shadows and the lamp light pool use one more tiny canvas texture. **Total textures ≤ 4.**

### 7.9 Camera (`render/camera.js`): angled follow cam
- `PerspectiveCamera(50°, aspect, 0.5, 220)`.
- The desired position = player position + rotateY(camYaw) × (0, 11, 13), where "behind" is opposite the heading. Look at player position + forward × 4 + (0, 1, 0).
- `camYaw` eases toward the player heading at 2.5/s (exponential smoothing: `1 − exp(−k·dt)`). While the player moves slower than 0.5, the yaw holds.
- Position eases at 8/s. Add a speed-based pull-back: distance × (1 + 0.15 × speed / maxSpeed). The FOV widens by up to 4° at top speed.
- **Shake:** trauma-based. `shake(amount)` adds to trauma (max 1). The offset is trauma² × 0.35 × noise, and trauma decays at 1.5/s.
- **Presets** for menus and screenshots: `overview` (high, framing the **entire** 48×40-tile map including the south strip with the park and Distribution Center), `depot`, `street` (low shot down Maple Ave), `porch:<houseId>` (close on that porch), `showroom` (in front of the depot, framing the player for the select screens).
- **Intro flyover:** 3 s ease from `overview` to the follow position.

---

## 8. Performance budget (hard requirements)

The game must run **cool and quiet on a laptop**. An earlier prototype spun the fans up because of uncapped fps, full Retina resolution and thousands of draw calls. Don't repeat that.

| Rule | Value |
|---|---|
| Frame cap | 60 fps (High / Balanced), 30 fps (Battery saver), 30 fps in menus, 10 fps paused with nothing animating |
| Pixel ratio | High `min(dpr, 1.5)`, Balanced `min(dpr, 1.25)`, Battery `1.0` |
| Antialias | on for High and Balanced, off for Battery (needs a page reload; the settings screen says so) |
| Shadows | High: 2048 map, PCFSoft; Balanced: 1024, PCF; Battery: off (blob shadows only). Static-only shadow updates (§7.3) |
| **Draw calls in gameplay** | **≤ 150** (target about 100), measured by `renderer.info.render.calls` |
| Triangles | ≤ 400k |
| Textures | ≤ 4 |
| Static world | merged into **chunks of 12×10 tiles** (a 4×4 grid, 16 chunks). Each chunk has ≤ 3 meshes: opaque, glow, and water if present. Frustum culling stays on |
| Repeated dynamic things | InstancedMesh (birds, butterflies, clouds, markers, particles) or a small fixed mesh count |
| Per-frame allocations | **none.** Module-level scratch `Vector3`/`Quaternion`/`Matrix4` objects. No `.map/.filter/forEach` with new arrays, no spreads, no template strings in hot loops |
| GPU resources | created at boot or when a shift starts. Anything replaced is `.dispose()`d. `renderer.info.memory.geometries` must be **stable** during a shift (±2) |
| DOM updates | HUD text written only when the value changes. The radar redraws at 15 Hz from a pre-rendered base canvas |
| Hidden tab | loop stopped, audio suspended |

`debug.js` shows an overlay with `?debug=1`: fps, frame ms, draw calls, triangles, geometries, textures, active actors and the current quality preset. `__pb.stats()` (§12) returns the same data.

**Headless screenshots use a software renderer (SwiftShader), so fps numbers there mean nothing. Use draw calls, triangles and geometry counts from the stats JSON as your proof.** Real fps and fan noise are checked by the user at the *User check* gates.

---

## 9. Audio (`audio/`): all synthesized, no files

- One `AudioContext`, created or resumed on the first user input. Buses: `master → (music, sfx, ambience)` gain nodes. Mute (M) sets master to 0. `?mute=1` starts muted, and the screenshot URLs use it.
- **sfx.js** is a small synth kit: `tone(freq, type, attack, decay, gain, pitchSlideTo?)` and `noise(duration, filterFreq, filterQ, gain, sweepTo?)`, with short envelopes, and nodes created per sound (fine; sounds are rare). Sounds:
  - throw *whoosh* (bandpass noise sweeping 800→2400 Hz, 0.18 s),
  - landing *thunk* (sine 110→60 Hz plus a short lowpassed noise),
  - PERFECT (major arpeggio C6-E6-G6-C7, triangle, 60 ms apart), Nice (two notes), Sloppy (a descending "wah"),
  - doorbell *ding-dong* on delivery (sine E5 then C5),
  - streak up (a rising blip whose pitch increases with the multiplier),
  - **mischief:** glass *crash* (a highpassed noise burst plus 6 random high sine tinkles), bowling *strike* (several short woody noise clicks), car alarm *whoop-whoop* (a square wave sweeping 600→1200 Hz, looping for 5 s), Watch whistle (a 2.8 kHz sine with fast vibrato, 0.4 s), angry grumble (a sawtooth through a wobbling bandpass, a gibberish "voice"), and a *busted* sting (three descending brass-like square notes),
  - car horn (two detuned square waves, 0.25 s), dog bark (short square burst with a fast pitch drop, ×2), splash (noise with a lowpass sweep down), bonk, knockdown (a cartoon descending slide), bike bell (on horn-like events while cycling), sprinkler *tsk-tsk* (filtered noise ticks), restock *ka-chunk* plus pops, UI hover and click ticks, and a star chime on results.
  - **Cartoon kit:** *boing* (a sine dropping in pitch with fast vibrato), slide whistle (a sine glide up or down, 0.5 s), *splat* (short lowpassed noise with a pitch-dropping thump), *pop*, *zip* (a fast upward square sweep), sneaker squeak (a narrow bandpass noise chirp), skid *skrrt* (a noisy sawtooth), bike *honk-honk* bulb horn (two nasal square blips), and a dizzy *tweet-tweet* loop while stars circle.
  - **Bee buzz:** one persistent sawtooth oscillator (~210 Hz, slight detune, a 18 Hz tremolo LFO) per swarm through a lowpass. Its gain and pitch rise with anger and fall off with distance. Create it at shift start and stop and disconnect it at shift end. The idle buzz is audible only within about 10 units.
- **music.js:** a light, happy procedural loop at 112 BPM in C major. The chords are I–V–vi–IV with a triangle bass, a soft square lead playing a 4-bar melody from a fixed note array, and a noise hi-hat. It uses a lookahead scheduler (`setInterval` 25 ms, schedule 100 ms ahead) that **stops when paused or hidden**. It runs on a different, slower pattern in menus. Music volume defaults to 0.35.
- **ambience.js:** random bird chirps every 2–6 s (short sine chirps with a pitch wobble), a distant car pass now and then, and crickets in dusk (a periodic filtered noise burst). Positional flavor comes from a simple `StereoPannerNode` pan computed from the angle to the source relative to the camera, and gain drops off with distance. No `PannerNode`/HRTF.

---

## 10. UI (`ui/`; HTML/CSS overlay)

- Font: `ui-rounded, "SF Pro Rounded", "Nunito", system-ui, sans-serif`. Big, round and friendly. White text with a 3px dark outline (`paint-order: stroke`) for readability over the 3D scene.
- The UI uses the palette (brand teal, accent yellow, pastel cards with a 16px radius and chunky bottom shadows). Buttons "squish" on press (CSS transform). Screen transitions are 200 ms fade and slide.
- **HUD:** top-left score plus multiplier badge (pulses on change); top-center day clock and shift end (`10:24 · shift ends 11:00`, orange in the window's last game hour; §2.20); bottom-left corner **radar** (see below); left the **delivery list** (next 5 targets: address + package-type icon, with a check animation when delivered); above the radar, the carried **parcel stack** (icons) with the next parcel's type highlighted; bottom-right the **ability button** with a cooldown ring (conic-gradient) and key hint.
- **Radar (GTA-style, `ui/radar.js`):** a **circular** 200px canvas in the bottom-left corner with a chunky white rim and soft shadow. It is **player-centered and rotates with the camera**, so up on the radar is always the direction the camera faces, and the player is a fixed arrow in the middle. Draw it like this:
  - At boot, pre-render the whole map once to an offscreen canvas at 3 px per tile: grass, roads (dark with lighter edges), sidewalks, houses as roof-colored rectangles, park, pond, lot.
  - At 15 Hz: clear, clip to a circle, translate and rotate, then `drawImage` the pre-rendered map. Visible range is about a 45-unit radius, zooming out to 60 at top speed.
  - Draw the **GPS route** as a thick rounded line in route color: the path of tile centers from the player to the current objective (nearest target, the pickup zone when empty, or the waypoint). Compute it with a BFS over walkable tiles into preallocated typed arrays, only when the player's tile or the objective changes.
  - **Blips** (small icons with a white outline): targets (teal parcel), pickup (yellow box), Distribution Center (**Q**), mission markers (their color and icon; hidden during a mission), waypoint (pin), angry bee swarms (a tiny yellow dot, as a warning). Blips outside the range are **clamped to the rim** as smaller arrow-tipped markers. Add a small **N** tick on the rim that rotates with the map.
  - In free roam with no waypoint, there's no route.
- **Full-screen map (Tab):** the whole pre-rendered map, north-up, scaled to fit, with all blips, a legend, and the player arrow. Clicking sets or clears a waypoint. Golden Parcels found so far show as small gold checkmarks. The game pauses while the map is open.
- **Mission card:** slides in from the right while you stand in a mission marker. It shows the name, a one-line blurb, deliveries, time limit, time-of-day icon, package-mix icons, best score and stars, and "Press F to start". Locked missions show the padlock and the stars needed. At `dispatch`, ←/→ pages through the main shifts.
- **Heat:** 3 whistle icons sit just above the radar, filled per level. They wobble when heat rises and flash while the Watch is losing you. Watch units are **flashing red blips** on the radar and are always clamped to the rim when far away.
- **Free-roam HUD:** radar, coins, Golden Parcels found (x/12), a "FREE ROAM" chip, and an ability button. The mission HUD adds score, multiplier, the shift-end time and the delivery list, and the chip becomes the mission name.
- **Floating texts** (PERFECT! and so on) are pooled DOM elements (max 8), positioned by projecting the world position each frame. Only positions are written, via `transform`. They pop in, rise and fade over 0.9 s. Colors: PERFECT gold, Nice teal, Sloppy grey, miss/wrong red. **Onomatopoeia** (§2.12) uses a second style from the same pool: a jagged comic burst (CSS `clip-path` polygon) in yellow or white with thick dark outlined, slightly rotated text. It pops in with an overshoot scale (0 → 1.3 → 1) and shakes briefly.
- **Screens:**
  - **Title:** a big logo "PARCELBOY" in chunky letters (CSS) with a small parcel icon, over the live world with the camera slowly orbiting the Distribution Center. Continue (only with a save), New Game (confirms before wiping a save), Settings, and a credits line.
  - **Choose courier:** the courier stands in the showroom (live 3D) and idles or waves. Arrows or ←/→ cycle through couriers. Stat bars, ability card, and a lock with price if locked (a Buy button when you have enough coins).
  - **Choose vehicle:** same layout; the vehicle appears under the chosen courier.
  - **Pause:** Resume, Map, Settings, Quit to title. During a mission, also Restart mission and **Abandon mission**. Shows the Golden Parcel count and total stars.
  - **Results:** stars fill one by one (chime each), stats rows count up (delivered, perfects, best streak, parcels lost), coins earned with a new total, "New best!" ribbon. Retry / Next shift / Title.
  - **Settings:** quality (High / Balanced / Battery saver), music and sfx volume sliders, show fps toggle. Saved immediately.
- Keyboard navigation for every menu (arrows, Enter, Esc).

---

## 11. Data schemas and starter content

Every data file exports an array of plain objects. Put the content from §2 into these shapes.

### 11.1 Character
```js
{ id: 'pip', name: 'Pip', blurb: 'Quick on their feet, light on parcels.',
  build: 'slim',   // slim | regular | sturdy
  colors: { skin: '#f1c27d', hair: '#4a2c2a', shirt: '#ef476f', pants: '#3d5a80', shoes: '#22223b', cap: '#ffd166' },
  stats: { speed: 1.15, capacity: 4, throwRange: 0.9, accuracy: 0.75 },
  ability: 'sprint', perks: [], unlockCost: 0 }
```
Give each courier distinct skin, hair and clothing colors. Represent a range of skin tones across the cast.

### 11.2 Vehicle
```js
{ id: 'bike', name: 'Bicycle', model: 'bike', riding: 'pedal',   // riding pose: walk | pedal | stand
  stats: { maxSpeed: 11, accel: 14, turnRate: 3.2, capacityBonus: 1, throwRange: 12 },
  canJump: true, unlockCost: 0 }
```

### 11.3 Hazard
```js
{ id: 'dog', name: 'Dog', behavior: 'dogChase', model: 'dog', radius: 0.5, spawn: 'hazardSpots.dog',
  params: { wakeRadius: 9, chaseSpeed: 7.2, chaseTime: 5, leash: 16, catchRadius: 0.9 }, knockdown: true }
{ id: 'bees', name: 'Bee Swarm', behavior: 'beeSwarm', model: 'beehive', radius: 1.0, spawn: 'hazardSpots.beehive',
  params: { angerRadius: 6, chaseSpeed: 7.8, chaseTime: 8, escapeDistance: 20, escapeTime: 2, stingRadius: 1.0,
            puffyTime: 5, beeCount: 24, waterScatters: true }, knockdown: true }
```
`spawn` says where instances go: `'hazardSpots.dog'`, `'hazardSpots.sprinkler'`, `'hazardSpots.beehive'`, `'traffic'` (spread evenly over the loops), `'sidewalkLoops'`, or `'driveways'` (bins at driveway ends).

### 11.4 Package
```js
{ id: 'fragile', name: 'Fragile', model: 'parcelFragile', rules: { breakDistance: 7, breakImpact: 14 }, icon: '▲' }
```
Rule handlers are functions in `gameplay/scoring.js`, selected by rule key, so new keys need one new handler.

### 11.5 Shift
```js
{ id: 'morning', name: 'Morning Round', kind: 'main', giver: 'dispatch', pickup: 'depot',   // pickup: 'depot' or a shop building id
  neighborhood: 'maple-hollow', timeOfDay: 'morning',                          // timeOfDay: null = keep the current cycle
  duration: 240, deliveries: 10,
  packageMix: { standard: 0.85, fragile: 0.10, heavy: 0.05 },
  hazards: { car: 3, dog: 1, sprinkler: 2, skater: 0, bees: 1, bin: 8, cone: 0 },
  stars: [1500, 2600, 3600], unlockStars: 0, grumps: 3 }
// Side mission: hazards: null means keep the free-roam hazards.
{ id: 'cake', name: 'Cake Rush', kind: 'side', giver: 'bakery', pickup: 'bakery', neighborhood: 'maple-hollow',
  timeOfDay: null, duration: 60, deliveries: 1, packageMix: { cake: 1 }, hazards: null, stars: [250, 400, 550], unlockStars: 1 }
```

### 11.6 Ability
Abilities live in `gameplay/abilities.js`, registered by id: `{ id, name, description, cooldown, duration, start(ctx), update(ctx, dt), end(ctx) }`. They act only through a **modifier stack** on the player (`speedMul`, `turnWobble`, `knockdownImmune`, `perfectThrows`, `charmActive`), which movement, hazards and targeting read from. There are no special cases elsewhere.

### 11.7 Config (`data/config.js`)
`BRAND = { company: 'Quickbox', game: 'Parcelboy' }`, tuning constants (gravity, cooldowns, scoring numbers from §2.4), the `CARTOON` block (§2.12), quality presets (§8), and the default settings. **Any number that appears in §2 goes here**, not scattered through code.

---

## 12. Verification tooling

### 12.1 URL parameters (`core/params.js`)
| Param | Effect |
|---|---|
| `debug=1` | stats overlay plus collider wireframes toggle (key `F3`) |
| `mute=1` | start muted |
| `quality=high\|balanced\|battery` | override the setting |
| `seed=<int>` | RNG seed |
| `scene=test` | M1 test scene instead of the game |
| `screen=<title\|selectCourier\|selectVehicle\|results\|settings\|fullMap\|missionCard:<id>>` | open that screen directly (results uses fake data) |
| `autostart=<freeroam\|shiftId>` + `char=<id>` + `veh=<id>` | skip the menus and the intro. `freeroam` spawns at the Distribution Center in free roam; a mission id starts that mission immediately |
| `cam=<overview\|depot\|street\|porch:<houseId>\|showroom\|follow>` | force a camera preset |
| `tod=<timeOfDayId>` | override the time of day |
| `paused=1` | freeze the simulation after load (rendering continues); use with `__pb.step` |

### 12.2 `window.__pb` (always present; tiny)
```js
window.__pb = {
  ready: false,                  // true once the first frame after load has rendered
  stats(),                       // { fps, frameMs, drawCalls, triangles, geometries, textures, actors, quality, state }
  state(),                       // { gameState, score, streak, carried, remaining, time, player: { x, z, heading, speed } }
  setCam(name), setTimeOfDay(id),
  teleport(tileX, tileZ, headingDeg),
  press(action, ms),             // simulate holding an input action
  throwAt(tileX, tileZ),         // throw the next parcel at a tile center
  step(frames),                  // advance the sim by N fixed steps (works while paused)
  startShift({ shift, char, veh, seed }),
  freeRoam(), setWaypoint(tileX, tileZ), abandonMission(), setHeat(n),
  goto(screenName),
  autoplay(on),                  // §12.4
};
```

### 12.3 Running and checking screenshots
1. `docker compose up -d --build web`, then `docker compose run --rm shots m5` (a filter by name is optional).
2. Output: `shots/<name>.png` plus `shots/<name>.json` (stats, console errors and warnings). A non-zero exit means errors.
3. **Open every PNG with your file-reading tool and look at it.** In `PROGRESS.md`, describe what you actually see and compare it to the milestone's *Expected* text. Look especially for: black or blank frames, missing objects, z-fighting (flickering stripes where surfaces overlap; keep ≥ 0.02 offsets), wrong colors (washed out means check color space), floating or buried objects, text overlapping, and UI outside the viewport.
4. If WebGL fails in headless mode (a black canvas or a context error): check that the flags in `shoot.cjs` are present and that the image and npm versions match, and try `--use-gl=angle` in addition. After two failed attempts, **stop and ask the user**.

### 12.4 Autoplayer (from M6 on)
`__pb.autoplay(true)` drives the player with a simple bot: steer toward the nearest target's porch using the tile grid and a BFS path over walkable tiles (computed once per target change, not per frame), throw with Q/E when a target is in assist range, and go restock when empty. In free roam it rides to the dispatch marker and starts the next unlocked main shift. It doesn't need to be good. It's for soak tests (memory stability and errors over 3 minutes) and rough score tuning.

---

## 13. Milestones

Every milestone ends with: shots added to `tools/shots.json` → run → **look at them** → fix → update `PROGRESS.md` → commit → push → **start the next milestone right away**. There are no user-check gates. "Expected" describes what the screenshots must show.

### M0: Scaffold, Docker and tooling
- `git init`. Create every file from §4. Create `PROGRESS.md` from the appendix template.
- Vendor Three.js: `curl -fL -o game/vendor/three.module.js https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js`. Then `grep -n "three.core" game/vendor/three.module.js`. If it imports `./three.core.js`, download `build/three.core.js` into the same folder too.
- `main.js`: a renderer on `#game`, a spinning colored cube, the loop from §5.2 with the fps cap and visibility pause, `params.js`, the `debug.js` overlay, and `window.__pb` with `ready`, `stats()` and `state()` (others can be stubs).
- Shots: `m0-cube` → `/?debug=1&mute=1`.
- **Done when:** the container serves the game at :8080; the shot shows the cube and the debug overlay; zero console errors; `stats.drawCalls` ≥ 1.

### M1: Rendering foundations
- `renderer.js` (quality presets from §8, resize handling, pixel ratio cap), `voxel.js` (below), `palette.js`, `lighting.js` + `sky.js` (time of day from data), `data/timeOfDay.js`, `registry.js`, `events.js`, `rng.js`, `pool.js`.
- **`voxel.js` API:** `const b = new VoxelBuilder(); b.box(x, y, z, w, h, d, color, opts?)` (x/z = center, y = bottom), `b.merge(otherBuilder, matrix?)`, `b.toGeometry()` → one indexed `BufferGeometry` with `position`, `normal` and `color` attributes, with the fake AO and ±4% jitter from §7.3 applied. Write the merge yourself: concatenate the attribute arrays and offset the indices. Don't use addons. `opts.skipFaces` can drop the bottom faces of boxes resting on the ground to save triangles.
- A test scene (`?scene=test`): a ground plate and one sample house built with `VoxelBuilder` (any style), lit by the time of day.
- Shots: `m1-test-morning` `/?scene=test&tod=morning&mute=1`, `m1-test-dusk` (`tod=dusk`), `m1-test-battery` (`quality=battery`).
- **Expected:** a cute, clearly lit house, soft sky gradient, correct colors (not washed out), shadow under the house (not in battery). Dusk is darker and bluish.
- **Done when:** the house draws in ≤ 3 draw calls, and the fps cap works (the overlay reads ~60 in a real browser; note it for the user).

### M2: Neighborhood ground and props
- `tilemap.js` (parse + validate, §6.2), `worldBuilder.js`/`ground.js` (all tiles, curbs, road lines, crosswalks, parking lines, pond, forest border), `props.js` (trees, lamps every 5 tiles along sidewalks with alternating sides, hydrants near intersections, benches and reeds around the pond in the park, playground set on the playground rect), chunk merging (§8), and the sign texture atlas started (street signs at intersections).
- Colliders for all static things are registered in `collision.js` (houses are added in M3).
- Shots: `m2-overview` `/?cam=overview&mute=1&paused=1`, `m2-street` `/?cam=street&mute=1&paused=1`, `m2-park` (add a `park` camera preset or use `eval` to set the camera).
- **Expected:** the whole map layout is recognizable against §6.1: three horizontal and three vertical roads, the cul-de-sac bulb, the park with the pond bottom-left, the lot bottom-right, and the forest border. Road lines don't run through intersections.
- **Done when:** the static world is ≤ 40 draw calls and there are no z-fighting stripes in the street shot.

### M3: Buildings
- `buildings.js`: 5 house styles (§6.4) with stable seeded colors, porch, doormat, mailbox with number (atlas), porch lamp, windows in glow geometry; the school, 3 shops, and the depot with sign and van; parked cars on 40% of driveways. Everything goes into the chunks.
- Shots: `m3-overview`, `m3-porch` `/?cam=porch:h06&mute=1&paused=1`, `m3-depot` `/?cam=depot&...`, `m3-dusk-street` `/?cam=street&tod=dusk&...`.
- **Expected:** varied, charming houses facing the right way (every door faces its porch `o` tiles), readable mailbox numbers, lit windows at dusk, depot clearly branded.
- **Done when:** the whole world is ≤ 60 draw calls; the triangle count is noted; zero errors.

### M4: Courier, movement, camera, collision
- `courierModel.js` (§7.5, all animations except the throw), `player.js` (movement from §2.3, jump, collision, bonk), `input.js` (actions), `camera.js` follow cam and presets, the vehicle `feet` and `bike` models, and data files for characters and vehicles (all 5 couriers and 4 vehicles defined; models for all 4 vehicles built).
- Shots: `m4-follow` `/?autostart=morning&char=pip&veh=feet&mute=1&paused=1` (spawn at the depot), `m4-bike` (`veh=bike`, eval `__pb.teleport(12,16,90); __pb.step(30)`), `m4-cast` (a temporary debug param `lineup=1` placing all 5 couriers side by side in the showroom).
- **Expected:** the courier is readable, cute and correctly colored; the camera sits behind and above; the bike looks like a bike, with the rider in a pedaling pose.
- **Done when:** walking into a house can't pass through it (verify with `teleport` + `press('forward', 2000)` + `state()`), and the draw calls in `m4-follow` are ≤ 90.

### M5: Parcels and delivering
- `parcels.js` (pool, flight, bounce, roof/wall/water/road outcomes), `targeting.js` (assist, mouse raycast), `scoring.js` (the table in §2.4 plus package rules), doorstep delivery, the throw animation, `markers.js` (floating target icons + porch rings as InstancedMesh, the compass arrow), `effects.js` (confetti, dust, splash; pooled particles in one InstancedMesh), `floatText.js`, and resident door-wave NPCs (`npcs.js`).
- Temporary: in `autostart` mode, mark 5 fixed houses as targets until M6 adds shifts.
- Include the parcel-side cartoon gags from §2.12: jelly parcels, roof luck (slide + Lucky!), mailbox flag bounce, resident result reactions, and the first onomatopoeia popups (THWUMP!, SPLOOSH!).
- Shots: `m5-throw-midair` (teleport near h06, `throwAt` its porch, `step(12)`), `m5-perfect` (same but `step(80)`: parcel on the porch, PERFECT text, confetti, resident waving), `m5-roof` (throw at the house center so it lands on the roof).
- **Expected:** a visible arc mid-flight; a parcel resting on the porch with a gold PERFECT; a parcel sitting on the roof.
- **Done when:** all outcomes in §2.4 can be triggered and each shows the correct text (list them in `PROGRESS.md` with how you checked each).

### M6: Free roam, missions and HUD
- The shared playing core plus **free roam** as the default state (§2.13, without the day cycle, which comes in M10), mission markers with the mission card, `mission.js` (target selection, timer, pickup zones, parcel queue, end conditions, abandon, time bonus, stars, coins, results → Continue or Retry), `data/shifts.js` + `data/packages.js` (all main shifts and side missions from §2.5 and §2.10), the mission HUD and the free-roam HUD (a simple north-up placeholder minimap is fine here; the radar comes in M6b), the mission intro, the results screen (functional; polished in M8), and `__pb.autoplay` (§12.4). The autoplayer walks into the dispatch marker and starts a mission when in free roam.
- The Distribution Center gets its full set of props and animations here (§2.14): conveyor, vans, trailer, forklift.
- Shots: `m6-freeroam` `/?autostart=freeroam&char=pip&veh=bike&mute=1`; `m6-hub` (`cam=depot`, showing the markers and the conveyor); `m6-card` (teleport into the dispatch marker; the mission card is visible); `m6-hud` `/?autostart=morning&char=pip&veh=bike&seed=1&mute=1` with `waitMs 3000`; `m6-side-cake` (`autostart=cake`); `m6-results` `/?screen=results&mute=1`.
- **Soak test:** a shot with eval `__pb.autoplay(true)` and `waitMs 180000`, named `m6-soak`. Its JSON must show zero errors, and geometries within ±2 of the `m6-hud` count. (If SwiftShader makes 3 minutes too slow, use `__pb.step` in chunks through `eval` instead of waiting.)
- **Done when:** in the browser you can ride around freely, enter the dispatch marker, start a shift, ignore it and ride away until the timer runs out, get results, Continue back into free roam where you were, start the Cake Rush side mission from the bakery, and abandon a mission from the pause menu. HUD values are correct and the soak test is clean.

### M6b: Radar, full-screen map and GPS
- `ui/radar.js` and the full-screen map exactly as §10 describes, BFS route in preallocated arrays, waypoints, rim-clamped blips, and the rotating N tick.
- Shots: `m6b-radar-freeroam` (in free roam near the school, with mission blips clamped on the rim), `m6b-radar-mission` (during `morning`: target blips and the GPS route line toward a target), `m6b-fullmap` (`screen=fullMap` with a waypoint set via `__pb.setWaypoint(8,37)`), `m6b-radar-turned` (after teleporting with heading 90°: the map is rotated and the N tick has moved).
- **Expected:** the radar is a clean circle in the corner, easy to read at a glance, rotates with the camera, and the route line follows the roads and sidewalks rather than cutting through houses.
- **Done when:** the route updates within 0.5 s of the objective changing, the radar costs no GPU draw calls (it's a 2D canvas), and the soak test still shows stable geometry and no errors.

### M7: Hazards
- `hazards.js` manager plus all behaviors (§2.7) and models (car variants, dog, sprinkler with spray particles, skater, **bee swarm and beehives**, bin, cone), `traffic.js` (loop following, cornering, braking cone), and knockdown flow **with every slapstick knockdown gag from §2.12** (pancake, fight cloud, spinning tops, bee panic, over the handlebars, dizzy stars), plus Dog thief, Close call, hit-stop and trampolines.
- Shots: `m7-traffic` (`cam=street`, `step(300)`, cars spread out and on the correct side of the road), `m7-dog-chase` (teleport near the `[12,12]` spot, step until the dog is chasing), `m7-sprinkler`, `m7-knockdown`, `m7-pancake` (mid-flatten after a car hit), `m7-bees-idle` (`porch`-style close camera on the `[8,11]` hive), `m7-bees-chase` (after `throwAt(8,11)` and a few steps; the swarm is streaming toward the player with "BZZZ!"), `m7-puffy` (the stung courier with the puffy face).
- **Expected:** cars stay in lanes and don't overlap each other at corners; the dog visibly runs toward the player with a "!"; spray particles are visible; the bee swarm reads clearly as a buzzing cloud (not scattered specks) and is funny, not scary.
- **Also verify by script** (and log in `PROGRESS.md`): a parcel hitting a hive tree angers its swarm; running through an active sprinkler sends an angry swarm home; Bea's Unstoppable blocks a sting; a dog's stolen parcel can be recovered by touching the dog within 8 s.
- **Done when:** the gameplay draw calls in a busy scene (the `lunch` shift, all hazards) are ≤ 130; there are zero errors; the soak test passes again with the `lunch` shift.

### M7b: Mischief
- Everything in §2.15: the pedestrian bowling state machine, Grump selection and dressing, breakables with pooled props and the window-overlay InstancedMesh, heat and whistles, Deputy Doug and the golf cart (`watchChase`), BUSTED!, Grump chases, subscriber "Oops!", and radar blips for Grumps and Watch units.
- Shots: `m7b-bowling` (a walker mid-flight, spinning, after a bike hit), `m7b-strike` (two pins in the air with STRIKE!), `m7b-grump-house` (`porch:` camera on a Grump house showing the sign, gnome, flamingos and curtains), `m7b-window-crash` (a window just broken with shards and CRASH!), `m7b-watch-chase` (heat level 2, Doug on his Segway chasing, whistles lit), `m7b-busted` (the ticket moment).
- **Also verify by script:** bowled NPCs always get back up (run 20 bowls through `eval`; none remain lying down after 5 s); dogs are never bowled; heat decays; Marlo's Charm drops a level; Grump breakables reset when a mission starts.
- **Expected:** everything reads as a cartoon (spinning, bouncing, fist-shaking, nothing painful-looking) and Grump houses are obviously different at a glance.
- **Done when:** the draw calls with 2 Watch units active and all mischief props present stay ≤ 140; zero errors; the soak test with autoplay plus a scripted bowling spree is clean.

### M8: Couriers, vehicles, abilities and menus
- All 5 abilities through the modifier stack (§11.6), the perk `dogFriendly`, and all screens from §10 with keyboard navigation, live 3D showroom for select screens, locks, buying with coins, and the polished results screen.
- Shots: `m8-title`, `m8-select-courier` (`screen=selectCourier`), `m8-select-vehicle`, `m8-mission-card-locked` (`screen=missionCard:golden` with a fresh save), `m8-pause-mission`, `m8-results` (fake data with 3 stars), `m8-settings`.
- **Expected:** every screen is readable and fits a 1280×720 viewport; no overlapping elements; the showroom courier is centered and well lit. Also shoot each screen at 1024×640 (`width`/`height` in shots.json) to check layout.
- **Done when:** a full flow title → (first-time select) → free roam → dispatch marker → mission → results → Continue → locker → change courier → free roam works by keyboard alone.

### M9: Audio
- Everything in §9. Hook sounds to events. Add volume settings.
- There's no screenshot evidence for this. Instead, log each sound triggered in debug mode (`?debug=1` shows the last 5 sound ids in the overlay) and take shot `m9-audio-debug` after a scripted throw and delivery, showing those ids.
- **Done when:** no sound plays while muted; audio suspends when the tab is hidden; music stops while paused.

### M10: Time of day, progression and saving
- All 4 time-of-day presets fully working (glow, lamp pools, autumn canopies, crickets at dusk), plus the **free-roam day cycle** with blending (§2.13), `save.js` + `progression.js` (coins, unlocks, best scores, star-based mission unlocks, Golden Parcels and the golden bike unlock, last courier and vehicle), and settings persistence.
- Shots: `m10-tod-<id>` for all four, at `cam=street` and `cam=overview` (8 shots); `m10-blend` (free roam, midway through a morning → noon blend); `m10-golden-parcel` (close-up of one Golden Parcel sparkling) and `m10-golden-pickup` (the moment of pickup, with the popup).
- **Expected:** four clearly different, beautiful moods; dusk is readable, not murky; lamps visibly glowing.
- **Done when:** a reload keeps the coins, unlocks, found Golden Parcels and settings; setting all 12 found via eval unlocks the golden bike; corrupt save data (set `localStorage` to garbage through eval) falls back to defaults without errors.

### M11: Immersion and juice pass
- A full **cartoon pass**: play every gag in §2.12 and tune its timing until it reads clearly and feels funny (record the before and after values). Then ambient life (§7.7), squash and stretch everywhere it's missing, camera shake tuning, speed lines when sprinting or turbo (a pooled particle trail), dust puffs on landing and braking, parcel stack wobble, streak celebration (at ×3: a brief rainbow ring particle burst and a jingle), results confetti, flag waving, bird scatter, and time-of-day tuning by screenshot review.
- Shots: `m11-life-street`, `m11-park`, `m11-cul-de-sac`, `m11-golden-overview`, `m11-hub-busy` (the Distribution Center with the conveyor, forklift and marker columns), `m11-trampoline` (player mid-air above a trampoline with BOING!), `m11-handlebars` (mid-flight over the handlebars), plus a before/after pair for any tuning you did.
- **Expected:** every shot looks alive: people, animals and movement cues visible.
- **Done when:** the draw calls stay within budget in every shot and Battery saver shows reduced ambient life.

### M12: Performance, QA, tuning and release
- Run all shots and fix every issue. Soak-test each shift with autoplay. Run the autoplayer for 3 shifts per shift type and record the scores; set star thresholds so the autoplayer usually gets 1 star (humans should reach 2–3). Check that the geometry and texture counts are stable.
- Audit the hot paths for allocations (search the `update` functions for `new `, `[`, `{`, `=>`, `.map(`, `.filter(`, spreads). Record the findings and fixes.
- Write `README.md`: how to run (dev and production), controls, and how to add content (a copy of §14).
- Production check: `docker build -t parcelboy . && docker run --rm -d -p 8081:80 --name pb-prod parcelboy`, then run a shot against it (temporarily set `BASE_URL`), then stop the container.
- **Done when:** every shot is clean, the budgets are met, and the README is complete.

### M12a: Post-M12 review fixes
Fixes from the user's play-through and a code review. Do them in order (item 0 first), and commit + push each fix separately (`M12a.<n>: <title>`), logging each under *Decisions* in PROGRESS.md.

0. **PRIORITY: do this first. Golden parcel pickup message is unreadable.** It does pop "GOLDEN PARCEL n/12", but:
   - **Yellow on yellow:** `.pb-burst` (`css/ui.css`) is dark text on a yellow `#ffbe0b` badge, and `floatText.pop()` sets the text color from `opts.color`, so `collectibles.js` (`#ffd24a`) gives yellow text on yellow. Same bug for every burst popup that passes a color (e.g. "×N STREAK!" `#ffd166`, the dog's "!", "DING!"). Fix in `render/floatText.js`: for a burst, `opts.color` sets the badge **background** and the text stays dark `#22223b`; for plain text it stays the text color. Reset both inline styles on every `pop()`, since the elements are pooled.
   - **Clipped:** the jagged `clip-path` is applied to the text box itself, so long labels lose their first and last letters. Give bursts enough padding (e.g. `8px 22px`) so the polygon's inner points clear the text.
   - **Too short:** every popup lives 0.9 s. Add an optional `opts.life` and use it for milestones.
   - **The golden parcel gets a proper banner:** a big screen-space banner (top-center, not world-anchored) with a gold badge, dark outlined text "GOLDEN PARCEL!", a second line "4 / 12 found · +50 coins", a pop-in, held for **2.5 s**, then a 0.4 s fade. At 12/12, show "ALL 12 FOUND! Golden Bike unlocked!" for 4 s. Keep the small world popup "+50" at the parcel. One DOM element, reused (no allocation per frame; the HUD golden counter also pulses).
   - **Shots:** `fix-golden-banner` (`__pb.collectGolden(0)` then a few frames; the banner must be legible), `fix-burst-streak` (a burst popup with a color, readable dark text on a colored badge). Look at both PNGs.
1. **A normal player can't start a shift (blocker).** The §2.13 dispatch-marker flow was deferred in M6 and never built: `showShiftCard()` is only reachable through `?showCard=1` / `?screen=missionCard:` and `startShift()` only through `?autostart=`, `__pb` or the results-screen Retry. The How-to-play screen already tells players to "enter a shift at the teal dispatch marker". Build it as §2.13 describes: a visible marker column at each `missionMarkers` entry (dispatch, locker, bakery, hardware); in free roam, stepping within ~2 tiles shows the matching card (dispatch → main shifts, bakery/hardware → their side shift, locker → the courier/vehicle locker); ←/→ pages, F (tap, §2.2) or ENTER starts the focused shift if unlocked, walking away or ESC closes it. Also add the pause-menu "abandon shift" if it's still missing. Add a shot that starts from a plain load, walks to the marker and opens the card.
   **The vehicle select screen is unreachable.** It's fully built (`selectVehicle` in `ui/screens.js`), but `confirmChar()` goes straight to free roam, so it's only reachable through `?screen=selectVehicle`. Per §5.3 the locker flow is `selectCourier → selectVehicle → freeRoam`: ENTER on the courier screen must open the vehicle screen, and ESC on the vehicle screen goes back to the courier screen, not to free roam. The same flow runs from the title (ESC) and from the locker marker.
2. **"Cars" outside the map (north / north-west) that sit still, then jump.** These are almost certainly the **clouds** in `render/sky.js`: 6 white box-cluster clouds at y=45 spread over ±80 around world (0,0). The map spans roughly (0,0)→(192,160), so they all hang over the NW corner and beyond, and they wrap from x=80 to x=-80 (the "jump"). Fix: spread the clouds over the map's extent plus a margin (centered on the map center from the tilemap, not hard-coded), wrap them over that full width well outside the camera's view so the wrap is never seen, and make them read as clouds, not cars (bigger, flatter, softer). Verify with the `overview` shot over time (step a few hundred frames). Separately, also fix the Grump driveway car in `gameplay/mischief.js`: it offsets along `side` by `h.w` for every facing, but for E/W-facing houses `side` runs along Z, so it should use `h.d`.
3. **Pedestrian walking outside the map.** `entities/ambient.js` walkers random-walk with `tx/tz = x/z ± 7` and no bounds or collision, so they drift off the map (and through houses). Pick each new target from walkable sidewalk/yard tiles near the walker (or clamp to the tilemap and reject non-walkable tiles), and keep the pop-back-up target after a bowl on a walkable tile too.
4. **Birds only spawn in the north-west corner.** In `ambient.js`, the bird spawn is `4 + rng() * (tm.width - 8) * tm.tileSize / 4`, which covers only about a quarter of the map. Spawn them on lawn tiles across the whole map, like the walkers.
5. **Split `main.js`.** At ~1,160 lines it is far past the ~300-line rule. Move the shift/results/dispatch-card flow, the `__pb` debug hooks and the cam presets into their own modules (e.g. `gameplay/shiftFlow.js`, `core/debugHooks.js`, `render/camPresets.js`) with no behavior change; 72/72 shots must stay clean. `gameplay/hazards.js` (333) and `ui/screens.js` (310) should get a light split too.
6. **The parcel stack, capacity and restock (§2.5/§2.6) were never built.** This is a blocker after item 1. Today `delivery.carried` is just "undelivered targets" (no capacity), a throw never uses up a parcel, there is no restock (the `restock` event is only emitted by `__pb.debugAudio`), and the back stack is set once at shift start (`main.js` `player.setCarried`) and never again after a delivery. It also always adds the vehicle's `capacityBonus` (`player.js` `setCarried(n + capacityBonus)`), so it shows boxes even at 0 carried. Implement §2.6 as written:
   - capacity = courier `capacity` + vehicle `capacityBonus`; at shift start and on restock, carried = `min(capacity, undelivered targets)`.
   - every throw takes the next parcel off the queue (carried − 1), whatever the outcome; a doorstep hand-over uses one too; a knockdown drop or dog steal loses one (already there). With carried = 0, Q/E does nothing except a small "Empty! Restock at the depot" popup.
   - restock: stand in the mission's pickup zone (`restockZone` for main shifts, the shop front row for side missions) for 1.0 s with a progress ring; emit `restock` (the ka-chunk SFX already exists). The radar/GPS already points to the pickup when empty.
   - the back stack shows exactly `carried`, updated on every change (throw, delivery, drop, steal/recover, restock). The courier-only `capacityBonus` add is removed.
   - running out never ends a shift; you can always restock. (Shifts don't fail at all, see §2.20 / M12b.)
7. **The HUD has no parcel count.** The mission panel shows "x/y delivered" + next package but not what you carry. Add a parcel counter, e.g. "📦 3 / 5" (carried / capacity), that pulses red at 0 with "Restock!" and the depot direction. The game start or the dispatch card also says how many drops the shift has and how many you can carry.
8. **Tab doesn't open the full map.** `core/input.js` maps `Tab → 'map'`, but nothing ever does `input.consume('map')`, so the map only opens through `?screen=fullMap` (its own key handler only closes it). Consume `'map'` in `update()` (free roam and missions, not in menus) and call `fullMap.open()`. Also, the How-to-play row `['M · TAB', 'mute · open the full map']` reads like "M-Tab = full map"; split it into two rows: `M` mute, `Tab` full map.
9. **The heat whistles are effectively invisible.** `ui/radar.js` draws them *inside* the radar canvas at y=12 as 4 px dots, sitting on the radar's white rim; empty ones are 25% white. Players don't see them, so the Watch seems to appear from nowhere. Per §10 they go **above** the radar: a DOM row of 3 proper whistle icons (~28 px each, emoji or CSS/inline-SVG drawn in code, no files) just above the radar disc, filled red per level, with a dark outline so they read on any background. They **wobble** + play a short whistle tick when heat rises, **flash** while the Watch is losing you, and the whole row is hidden while heat is 0 (it appears as soon as heat > 0). Also show a short popup the first time a level is reached ("Neighborhood Watch is on to you!" at level 2). Remove the in-canvas version. Add a shot with `__pb.setHeat(7)` (2 whistles) to prove it reads.
- **Done when:** items 0–9 are fixed, every new shot exists and you looked at it, all existing shots are still clean, 0 console errors, ≤150 draw calls.

### M12b: Shifts follow the day clock
Needs M12a.
- §2.20: `gameplay/dayClock.js` (one clock, saved; drives the time-of-day blend), shift `window` / `deliverBy` in `data/shifts.js` (schema change, logged), the dispatch card's open/"Opens at" states, the fast-forward bench, end conditions (all delivered / window closes / clock out early), the shift report (no failure wording anywhere: grep for "Time's up"), early finish bonus, side missions' soft deadline + tip, the HUD clock line, and the exit clock-out prompt once exits exist (M14). Re-tune star thresholds with the autoplayer and record the scores.
- **Shots:** `m12b-clock-hud` (HUD showing `hh:mm · shift ends hh:mm`), `m12b-card-closed` (a shift showing "Opens at"), `m12b-report-partial` (a report with e.g. 6/10 delivered and partial pay, no failure wording), `m12b-bench` (fast-forward in progress), `m12b-dusk-by-clock` (the clock at 21:00 with the dusk look, reached by stepping the clock, not by a URL preset).
- **Done when:** a shift ends on its window close with a partial-pay report, nothing in the game says you failed, the clock survives a reload, 0 console errors, ≤150 draw calls.

### M13: Addressed parcels and parcel lockers
Needs M12b.
- §2.16: addressed stack (each carried parcel = a target ref), top parcel = next throw, R cycles (`cycle` action), "Wrong address!" outcome in `parcels.js`/`scoring.js` (new `wrongAddress` label + config value), doorstep auto-match, GPS/radar/marker/aim assist follow the top parcel, autoplayer updated.
- §2.17: `parcelLockers` in Maple Hollow's data (3 lockers on sidewalks, away from the depot; validated as walkable sidewalk tiles), the locker model, restock-at-locker, empty-for-the-shift state, refill on shift start, radar/full-map blips, the free-roam "Closed" popup.
- **Shots:** `m13-hud-address` (the HUD showing `📦 #n Street · type`), `m13-cycle` (after R, a different top parcel and route), `m13-wrong-address` (a throw at another target → "Wrong address!"), `m13-locker-full`, `m13-locker-empty` (after a locker restock: red light, open door, grey blip).
- **Done when:** a shift can't be completed by throwing at targets in any order without the right parcel on top; a locker restocks once per shift; 0 console errors; ≤150 draw calls.

### M14: Terrain heights and the multi-neighborhood engine
- §2.19: the `heights` layer, `world/terrain.js` (`groundY`, `edgeBlocked`), ramps, stairs, retaining walls, and every ground-standing system switched to `groundY` (see the list in §2.19). Maple Hollow has no `heights` and must look and play exactly as before (re-shoot `m2-*`/`m3-*`/`m4-*` and compare).
- A **terrain test neighborhood** (`?nb=test-hills`, small, debug only): 3 levels, a ramp road, stairs, a retaining wall, two houses at different levels. Use it to prove walking/riding up ramps, being blocked by walls, hopping down, stairs blocking vehicles, parcels landing on upper and lower levels, and cars driving a ramp loop.
- §2.18 engine: `exits`, the fade + sign card transition, unload (dispose every geometry/material/texture the suburb created; check `renderer.info` before and after a round trip: counts must return to the same values) and load, the clock-out prompt at exits during a shift, locked exits with `unlockStars`, the per-suburb kiosk pickup point + dispatch card filtering by `neighborhood`, the region-map inset, save fields + the golden-parcel migration, `?nb=<id>` URL param, `__pb.gotoNeighborhood(id, exitId)`.
- **Extend the tilemap validator** (boot-time, clear errors): `heights` same size as `map`; ramps/stairs sit between exactly two adjacent levels along one axis; traffic loops only on road + ramp tiles and never across a wall; porches reachable from a sidewalk at the same level; every walkable tile (including each exit and the kiosk) reachable from the spawn by flood fill, with vehicles (ramps only) and on foot (ramps + stairs); exits on the map edge with a matching entry in the target suburb.
- **Author maps with a generator, not by hand.** Maple Hollow was generated and validated by a script; do the same. Write `tools/neighborhoods/<id>.cjs` (plain Node, no packages; run it in the shots container) that builds the map + heights + houses + roads + traffic from a high-level layout, runs the same validation, and prints the data file. Commit the generator next to its output.
- Maple Hollow gets its exits. Its generator isn't in the repo, so write `tools/neighborhoods/maple-hollow-exits.cjs` that takes the current map and cuts one road through the forest border for each suburb, then re-validates it (this is the one allowed edit to §6.1's data; log it under *Decisions*) (north → Cedar Heights, east → Lakeside, west → Old Town), with no other change to the layout. Exits to suburbs that don't exist yet stay locked barriers.
- **Shots:** `m14-hills-ramp`, `m14-hills-wall`, `m14-hills-throw-up`, `m14-exit-sign` (the transition card), `m14-exit-locked`, `m14-region-map`, plus a stats check that a Maple Hollow → test-hills → Maple Hollow round trip leaves geometries/textures unchanged.
- **Done when:** heights work everywhere in the test suburb, Maple Hollow is unchanged apart from its exits, the round trip leaks nothing, 0 console errors, ≤150 draw calls.

### M15: Cedar Heights
- Build `cedar-heights` per §2.18 (generator + data), its kiosk, 3 shifts (morning/lunch/dusk-style, star thresholds tuned with the autoplayer like M12), 2–3 parcel lockers, 8 golden parcels, hazard spots, the runaway-bin hazard (a data-driven hazard def; rolls downhill along `groundY`, knocks you down like a skater) and the roll-downhill parcel gag.
- **Shots:** `m15-overview` (irregular outline and terraces must be obvious), `m15-switchback`, `m15-stairs`, `m15-watertower`, `m15-bin-roll`, `m15-shift`.
- **Done when:** the suburb is reachable through Maple Hollow's north exit once unlocked, a shift can be played start to finish, the overview clearly doesn't look like Maple Hollow, 0 console errors, ≤150 draw calls.

### M15a: Play-test fixes (round 2)
Fixes from the user's play-through after M15; done before M16. Same rules as M12a: in order, commit + push each fix separately (`M15a.<n>: <title>`), log each under *Decisions*.
1. **Golden parcels: found ones come back, the count is shared across suburbs, and "ALL 12 FOUND!" repeats.**
   - *Respawn:* `gameplay/collectibles.js` creates every spot with `found: false` and never reads the save, so after a reload or a suburb change every parcel you found is back. Picking one up again adds nothing to the save but still pays +50 coins and fires the banner (a coin farm).
   - *Flat save:* `save.goldenParcels` is still one flat index array (§2.18 asked for per-suburb). Index 3 in Cedar Heights collides with index 3 in Maple Hollow, and the total mixes all suburbs.
   - *Banner/HUD:* `main.js` `showGoldenBanner` compares that global total with the *current* suburb's count, so once you're past it every pickup says "ALL 12 FOUND! Golden Bike unlocked!"; the HUD and the banner hard-code `/12`.
   - **Fix:** save as `goldenParcels: { [neighborhoodId]: [indices] }` (migrate an old flat array to `maple-hollow`; additive, still `parcelboy.save.v1`). `progression.foundGolden(nbId, i)` returns whether it was new + the suburb's count. `createCollectibles` marks saved spots `found` at creation (hidden, never collectable again). A pickup that isn't new does nothing (no coins, no banner). The HUD shows the current suburb: `🎁 3 / 8` (that suburb's `goldenParcels.length`, never a literal 12), updated on every suburb change. The banner: "GOLDEN PARCEL!" + "3 / 8 found in Cedar Heights · +50 coins"; when a suburb is complete: "ALL FOUND IN CEDAR HEIGHTS!" once. The golden bike still unlocks on Maple Hollow's 12 only (`unlock: { goldenParcels: { 'maple-hollow': 12 } }`, or keep the number and read Maple Hollow's list; log the choice), and "Golden Bike unlocked!" shows only on that unlocking pickup. The pause menu or full map can show per-suburb totals.
   - **Verify** (debug hooks, then shots): collect 2 in Maple Hollow → reload → those 2 stay hidden and the HUD says `2 / 12`; go to Cedar Heights → HUD `0 / 8`, collecting its index 0 counts even though Maple Hollow's index 0 is found; re-collecting is impossible; coins rise by exactly 50 per new parcel. Shots: `m15a-golden-reload`, `m15a-golden-cedar-hud`, `m15a-golden-banner-suburb`.
2. **Parcel lockers are too wide and stick out into the street.** The old spec (§2.17) said "2×1 tiles", so `world/lockers.js` builds a 7.2 × 3.6-unit cabinet centered on a single 4-unit sidewalk tile: it overhangs half a tile on both sides (onto the road and the next tile), always faces +Z, and its collider blocks the whole sidewalk. §2.17 is now corrected.
   - **Fix:** about 3.2 wide × 1.2 deep × 2.2 tall, inside its tile. Find the yard/lawn side from the neighboring tiles (the side facing away from the road) and put the cabinet's back against that edge, rotated so the doors face the road side; doors, status light, logo and the door InstancedMesh follow the same rotation. The collider matches the new footprint, so a walker or the courier can pass between the locker and the curb. Restock triggers from the tile in front of the doors.
   - The neighborhood validator rejects a locker whose tile isn't a sidewalk with a road on one side and a non-road on the other. Re-check every suburb's `parcelLockers` (Maple Hollow, Cedar Heights, and the later ones).
   - **Shots:** `m15a-locker-street` (a low cam along the sidewalk: the locker sits on the sidewalk, nothing on the road, a gap to walk past), `m15a-locker-top` (from above, the locker inside one tile).
3. **Road center lines (and crosswalks) look rotated 90° on E/W streets.** In `world/ground.js` every dash and crosswalk stripe is a 0.02-high box built with `skipFaces: ['bottom', 'top']`, so it has **no top face**: from above the dashes are nearly invisible, and what you do see are the short end walls, which read as little ticks *across* an E/W street. (Verified in a top-down view of Maple Avenue × Oak Street.) The dash dimensions themselves are right.
   - **Fix:** build dashes and stripes with `skipFaces: ['bottom']` only (keep the top), sitting ~0.015 above the road surface so they don't z-fight. Same for parking lines and any other flat paint.
   - Also: the west crosswalk at each intersection is placed at column `ix - 2`, one tile too far; the tile just outside a 2×2 intersection is `ix - 1` (the east one at `ix + 2` is right).
   - **Shots:** `m15a-lines-top` (top-down over an intersection: solid yellow dashes running *along* both streets, zebra stripes on all four arms right next to the intersection), `m15a-lines-follow` (follow-cam view along an E/W street).
4. **Street signs stand in the road (e.g. Oak Street, East Drive).** `world/signs.js` places a N/S street's sign on the first row where the tile west of the road is *walkable*, but road tiles count as walkable. At Oak Street's north end that tile is North Road (row 3), so the sign stands in the middle of North Road; East Drive has the same problem. **Fix:** require a **sidewalk** tile (`s`) next to the road, for both N/S and E/W signs, and check that the post's position falls inside a sidewalk tile; in a suburb without a matching sidewalk, use the nearest sidewalk tile beside the road's start. Check every suburb (the new exit roads changed the edges). **Shot:** `m15a-sign-oak` (the Oak Street sign on the sidewalk at the corner).
5. **The skateboard is rotated 90°.** The skater model's board is long along local Z (`world/hazardModels.js`), but `pointOnRect` in `gameplay/hazardGeom.js` returns heading 0 for travel along +X (π/2 for +Z, and so on), so the board always sits across its direction of travel. **Fix:** use the same convention as the cars (model front = local +Z, rotation `atan2(dx, dz)` of the travel direction): +X → π/2, +Z → 0, −X → −π/2, −Z → π. Also `pointOnRect` allocates `{ x, z, h }` per skater per frame, which breaks the no-allocation rule: pass a scratch `out` object. Check the walkers/kids on sidewalk loops for the same heading bug. **Shot:** `m15a-skater` (a skater mid-run, board pointing along the sidewalk).
6. **The back of every street sign shows the name mirrored.** `buildSignMesh` (`world/signs.js`) makes each sign one single-sided quad and draws it with `side: THREE.DoubleSide`, so from behind you see the texture flipped. **Fix:** street signs (and any other sign seen from both sides, e.g. the "NO QUICKBOX!" lawn signs, kiosk signs) get **two quads back to back**, each facing outward with its own correct UVs (the back one with the tangent flipped so the text reads left-to-right), a thin plate box between them (merged into the chunk), and the sign material switched to `FrontSide`. Mailbox numbers, shop/depot signs and van logos on walls only need the front quad. Still one mesh, one material, one texture. **Shot:** `m15a-sign-back` (a street sign seen from behind: readable, not mirrored).
7. **The courier/vehicle select panels grow with every ←/→ press.** `barRows()` in `ui/screens.js` appends 4 new stat rows on every render and never removes the old ones, so each arrow press adds 4 more bars. **Fix:** build the 4 rows once per panel (in `makePanel`) and only update each label and fill width on render (no new DOM per press). Also the vehicle panel's "Speed" and "Top speed" both show `maxSpeed`; replace one with **Acceleration** (`accel`, scaled to the fastest vehicle) so the 4 bars are Speed, Acceleration, Turning, Capacity. Scale every bar against the max of that stat in the registry, not a hard-coded divisor. **Shot:** `m15a-select-cycle` (open the courier screen, press → 6 times via `__pb.press`, then shoot: exactly 4 bars, same panel height as on open; same for the vehicle screen).
8. **One light "action strip" replaces the dispatch card and the courier/vehicle screens (user design, 2026-10-02).** Today the dispatch card is a big centered white panel listing every shift (locked ones as red text) that covers the courier; the locker is a differently styled dark panel with other keys and a full-screen showroom; a screen opened over the dispatch card leaves the card open underneath. Replace both with one shared component, `ui/actionStrip.js`, used by every interactive spot (dispatch, side-mission shops, the courier/vehicle locker; parcel lockers keep their 1 s hold-to-restock and only get the prompt):
   - **Prompt, not panel.** In range of a spot (~2 tiles), a small bobbing world-anchored label appears above the marker: a key cap plus what it does, e.g. `[F] Dispatch · 1 shift open`, `[F] Bakery · Cake Rush`, `[F] Locker · change courier`. Nothing else opens. One reused DOM element.
   - **F opens a bottom strip** (about the bottom third of the screen, translucent dark background, rounded top corners). The world stays visible above it, and the follow cam keeps the courier centered in the visible part. The player is locked while the strip is open; the world keeps running.
   - **Cards in a row.** ←/→ (or A/D) move the highlight with a short slide; the highlighted card is larger and shows the details, the others are small. Locked items show a 🔒 and a chip ("2★" or "500 coins"), never long red text. Shift cards: name, drops, length in game hours, how many fit on your back, pay/best stars (missions are available any time, item 11; only Night Owl shows an "Evenings only" teaser outside its hours). `◀ ▶` arrows at the strip's ends when there's more to scroll. Mouse: click a card to highlight, click again (or a button on it) to confirm.
   - **Key legend** along the bottom edge as key caps: `[←][→] choose  [F] start  [Esc] close` (wording per strip). F or ENTER confirms; Esc or walking out of range closes it. Only one strip can be open; opening one closes any other screen.
   - **Locker:** the same strip with **two rows**, couriers on top and vehicles below, ↑/↓ (W/S) switches rows. Browsing re-dresses the player's own courier live (outfit and vehicle swap, the camera swings in a little), instead of a separate showroom. Buying a locked item happens on the card (`[F] Buy · 500 coins` when affordable). One F on "Done" (or Esc) keeps the current choice. Remove the old select panels and the dispatch card (and their `?screen=` routes map to the strip).
   - **The region-map box moves into the Tab full map** (§2.18 said so); today `ui/regionmap.js` shows it on the HUD permanently at the top right, where it covers the panels.
   - **Shots:** `m15a-prompt-dispatch` (the prompt above the dispatch marker, nothing else open), `m15a-strip-dispatch` (the strip with one highlighted shift, locked ones small with chips, the courier visible above), `m15a-strip-locker` (two rows, the courier wearing the highlighted outfit), `m15a-hud-clean` (free roam with no region box on the HUD).
9. **Markers must be obvious from a distance: big arrows, not thin sticks.** Each marker is now a 0.4-unit-wide, 15-unit-tall translucent column with a plain cube 15.6 units up, which from the follow cam is usually above the top of the screen; players just see a thin line. Replace them (`gameplay/missionMarkers.js`) with a GTA-style marker:
   - a **big downward-pointing arrow** (a chunky voxel chevron: a stepped, upside-down pyramid ~2.4 units wide, ~2 tall) floating ~3.5 units above the spot, **bobbing** (±0.4) and slowly **spinning**, in the marker's color with a bright glow (fog off, unlit material);
   - a **flat glowing ring** on the ground at the spot (pulsing outward every ~1.5 s), the area you step into, same color;
   - a **colored icon** on top of the arrow per kind, built from a few boxes: a parcel (dispatch), a shirt (courier/vehicle locker), a cake (bakery), a wrench (hardware);
   - when you're in range, the arrow bounces higher and the ring brightens, and the action-strip prompt from item 8 appears;
   - visible from across the suburb (it may stand above roofs), but drawn at ~70% size within 8 units so it doesn't cover the courier.
   - Draw calls: one InstancedMesh for the arrows, one for the rings, one for the icons (vertex-colored merged geometry per kind, or one instanced box pool), so ≤ 3 calls total. Allocation-free animation. Applies in every suburb (kiosk dispatch markers included). Remove the thin columns.
   - **Shots:** `m15a-marker-far` (from the depot entrance at the follow cam: the dispatch and locker arrows clearly visible), `m15a-marker-near` (in range: bigger bounce, bright ring, prompt shown).
10. **Shop, school and depot sign text is squished and misaligned.** In `world/signs.js` every plate is drawn into a square 256×256 atlas slot (the colored plate covering only its middle 64%, cream background around it), and that whole square is mapped onto the sign quad. The quads are wide strips (shops 3.0 × 0.7, school 5.0 × 0.7, depot 6.6 × 1.1 units), so the text is flattened 4–7× and the cream margins show as an off-center band (seen in-game on "Nuts & Bolts"). The M2 decision "plate-only UV sub-rects" was lost along the way.
   - **Fix:** give every sign a slot with **the same aspect ratio as its quad** (e.g. a 512×96 slot for a 5.33:1 sign; pack the atlas in rows by height), draw the plate to fill the whole slot, and map exactly that rect (no cream margins). Size the font to ~60% of the slot height, shrink only if it doesn't fit the width, and center it. Street signs keep their own aspect (they can stay square or become 2:1 plates; then make the quad match).
   - **Center each quad on its sign board** (the awning fascia / sign box geometry), with the board's width and height taken from the same numbers, so text sits in the middle of the board, not offset.
   - **Allocate atlas slots by key, not by index:** `street:<road name>`, `shop:<building id>`, `school`, `depot`. Today `buildings.js` uses `plate:7…11`, which assumes Maple Hollow's seven streets; a suburb with more roads would show a street name on a shop. Check every suburb's signs.
   - Applies to the kiosks and any landmark signs in the new suburbs too. Still one mesh, one material, one texture (§7.8).
   - **Shots:** `m15a-sign-shops` (the shop row: each name readable, normal letter proportions, centered on its board), `m15a-sign-school`, `m15a-sign-depot`, `m15a-sign-cedar` (a Cedar Heights kiosk/shop sign).
11. **Missions are available any time; the day clock only sets the mood (user design, 2026-10-02; overrides the shift windows of §2.20).** With windows plus star unlocks, a new player can only play Morning Round, and only 07:00–11:00, so most of the day there's nothing but free roam.
   - **Schema** (`data/shifts.js`, log under *Decisions*): replace `window: [start, end]` with `hours` (the mission's length in game hours from the moment you accept it; keep today's lengths: 4, 3.5, 4, 4, 4.5) and drop the fixed `timeOfDay`. Optional `availableHours: [from, to]` for a special timed mission (see below). The shift ends when everything is delivered, when its `hours` run out, or on clock-out, with the same shift report as now (partial pay, no failure wording). The early finish bonus uses the remaining game minutes of the mission's own hours.
   - **Any time:** the dispatch strip (item 8) lists every unlocked mission at any hour, no "Opens at". Starting one never changes the clock or the lighting.
   - **The time of day changes the world, not access:** at night (dusk preset) dogs mostly sleep, sprinklers are off and bees are asleep (as Night Owl's hazards do today); around lunch there's more traffic. Implement this as a per-time-of-day hazard modifier in data (e.g. `TOD_HAZARDS` in `config.js`) applied on top of the mission's hazard counts, not hard-coded per mission.
   - **Names:** missions are named by content, not time: e.g. Morning Round → **Neighborhood Round**, Lunch Rush → **Express Rush** (keeps its express-heavy mix), Fragile Friday stays, Golden Hour → **Big Round** (13 drops); the Cedar Heights ones become **Hillside Round**, **Hillside Express**, **Switchback Run**. Ids can stay for save compatibility; only `name` changes.
   - **One special timed mission:** **Night Owl** keeps `availableHours: [19, 24]`: a bonus mission only offered in the evening (its card shows "Evenings only · 19:00–24:00" when outside the hours, as a teaser rather than a lock). This is the only mission with hours.
   - **Unlocks:** a new player has at least **two main missions** open at 0★ (Neighborhood Round and Express Rush) plus Cake Rush at 0★; then Fragile Friday 2★, Big Round 5★, Heavy Haul 3★, Night Owl 8★. Suburb missions keep their suburb's unlock.
   - **The bench** (§2.20) is removed (nothing to wait for). Remove its marker/prompt, its debug hooks and its shot.
   - Re-tune star thresholds with the autoplayer as in M12 (record the scores), and update §2.20's wording where it now contradicts this (the windows, "Opens at", the bench).
   - **Shots:** `m15a-dispatch-anytime` (at 03:00, the dispatch strip shows the open missions, no "Opens at"), `m15a-nightowl-teaser` (at 10:00, Night Owl shows "Evenings only"), `m15a-night-world` (a mission started at 22:00: dusk look, sprinklers off).
12. **Difficulty levels, modeled on Doom's skill levels (user design, 2026-10-02).** Data-driven: `data/difficulties.js` (a registry by id, §5.4), read through `progression` and the hazard setup. Game logic never checks a difficulty id, only its fields.

    | id | Name (Doom original) | Unlocked from the start | Hazards and rules |
    |---|---|---|---|
    | `easy` | **I'm Too Young to Deliver** (I'm Too Young to Die) | everything: all missions, couriers, vehicles incl. the golden bike, all suburbs | hazard counts ×0.6, knockdowns never cost a parcel, Watch speed ×0.85 |
    | `medium` | **Hey, Not Too Heavy** (Hey, Not Too Rough) | all missions, couriers and vehicles; suburbs need stars | hazard counts ×0.85 |
    | `hard` | **Ship Me Plenty** (Hurt Me Plenty) | all missions; couriers/vehicles cost coins, suburbs need stars | as designed (×1.0) |
    | `brutal` | **Ultra-Delivery** (Ultra-Violence) | nothing: everything is earned (today's rules) | hazard counts ×1.15, Watch speed ×1.1 |
    | `holiday` | **Holiday Rush!** (Nightmare!) | nothing (as Ultra-Delivery) | harder than Ultra-Delivery: hazard counts ×1.35, deliveries per mission ×1.25 (rounded up; capacity unchanged), Watch speed ×1.2, heat decays at half speed, a dog that gives up turns around and chases again after 3 s instead of going home; parcels are gift-wrapped (red/green with a ribbon) for flavor |

    - Fields per level: `id, name, face, grants: { missions, characters, vehicles, neighborhoods }` (booleans), `hazardMul, deliveriesMul, watchSpeedMul, heatDecayMul, knockdownCostsParcel, dogRechase` (seconds or null), `giftWrap`, `warning` (text or null). Hazard counts = round(mission or free-roam count × `hazardMul`), and still capped by the pools' `MAX`.
    - **Unlocks are "earned OR granted":** `progression.isUnlocked(def)` returns true if the player earned it (stars/coins/golden parcels as today) **or** the current level's `grants` covers that kind. Nothing earned is ever removed, so switching levels never loses progress; a harder level just shows what you've earned yourself. Locked cards in the action strip (item 8) say why ("Earn 8★" / "500 coins").
    - **Choosing:** Title → **New Game** → the difficulty list (Doom style: a vertical list, the highlighted line marked by the courier's face at its left, ←/↑/↓ to move, F/ENTER to pick). The face gets more frazzled down the list: smiling → sweating → panicked → dizzy eyes → Santa hat with spinning eyes (Holiday Rush). Built from code (CSS/canvas or voxel-rendered into the strip), no image files. Default highlight is **Ship Me Plenty** (Doom's default was Hurt Me Plenty). Picking Ultra-Delivery or Holiday Rush shows a Doom-style confirm: *"Are you sure? Mrs. Henderson's cake isn't even remotely safe."* (Ultra-Delivery) / *"Holiday Rush! Are you sure? This shift isn't even remotely fair."* (Holiday Rush). F/ENTER = yes, Esc = back.
    - **Changing later:** Settings has a Difficulty row (same list); any change applies immediately (re-applies hazard counts at the next mission or suburb load).
    - **Save:** a new `difficulty` field (additive, still `parcelboy.save.v1`). An existing save without it is set to `brutal` (that's how it has been playing). The HUD chip and the shift report show a small difficulty badge.
    - **Shots:** `m15a-difficulty-select` (the list with the face on Ship Me Plenty), `m15a-difficulty-warning` (the Holiday Rush confirm), `m15a-easy-locker` (on Easy, every courier/vehicle unlocked in the locker strip), `m15a-holiday-parcels` (gift-wrapped parcels on the courier's back), plus a stats check that a Holiday Rush mission spawns more hazards than the same mission on Ship Me Plenty.
13. **The pause menu becomes the game hub: career, achievements, difficulty, settings, quit (user request, 2026-10-02).** Today Esc shows "People bowled", Resume and (in a mission) Restart / Clock out, mouse-only. Rebuild it (`ui/screens/pause.js` + `ui/screens/career.js`, each under ~300 lines) in the same visual language as the action strip (item 8): a panel on the left third of the screen, the paused world visible behind it, ↑/↓ (W/S) to move, F/ENTER to choose, Esc to go back or resume; mouse works too.
    - **First, make it reachable (bug).** `core/input.js` maps Esc and P to the `pause` action, but nothing ever does `input.consume('pause')` (the same bug Tab had in M12a.8), so in play the pause menu, and with it Restart / Clock out, can't be opened at all; only `?screen=pause` shows it. Consume `pause` in `update()`: if a strip, the full map or another screen is open, Esc closes that one; otherwise Esc/P opens the pause hub, and Esc/P again resumes. Also add §5.2's auto-pause on `window.blur` (open the hub). The How-to-play screen and the HUD hint list `Esc / P  pause`.
    - **Rows:** ▶ Resume · (in a mission) ↻ Restart mission, ⎋ Clock out early · 🏆 Career · ⚙ Settings (now including the Difficulty row from item 12) · ? How to play · ⏏ Save & quit to title. The game autosaves, so "quit" just saves and returns to the Title (a browser page can't close itself); from the Title, Continue picks up where you were.
    - **Career page** (tabs or sections, scrollable with ↑/↓): 
      - *Record:* missions worked, parcels delivered, deliveries by outcome (Perfect / Nice / Sloppy / Doorstep / Lucky), wrong addresses, best streak, coins earned all-time, total stars and stars per mission (a small grid: mission × ★★★, best score), golden parcels per suburb (`3 / 8`), suburbs visited.
      - *Mischief:* people bowled, STRIKEs, windows broken, times BUSTED, highest heat reached.
      - *Slapstick:* knockdowns by cause (car, dog, skater, bees, runaway bin, Grump), parcels stolen by dogs, cakes splatted, trampoline bounces, distance travelled per vehicle (km, from the sim, 1 unit = 1 m).
      - The current difficulty is shown at the top, with "change" leading to the difficulty list.
    - **Tracking:** a new `career` object in the save (additive, still `parcelboy.save.v1`; missing fields default to 0), updated by **listening to the existing events** (`core/events.js`: `delivery`, `knockdown`, `throw`, `restock`, `golden`, mischief events, `shiftEnd`, …), not by sprinkling counters through gameplay code. Add events where one is missing. Write to the save at most every few seconds (or on shift end / quit), never per frame. Distance accumulates into a scratch number per frame, no allocation.
    - **Achievements:** data-driven in `data/achievements.js`: `{ id, name, description, icon, test(career) }` (a cheap check, run only when a career counter changes, not per frame). Earned ones show a toast (one reused DOM element, ~3 s, top-center like the golden banner) and are saved (`career.achievements: [ids]`). The Career page lists them all: earned in color with the date, the rest greyed with the description as a hint. Start with ~15 in the game's voice, e.g. *First Drop* (1 delivery), *Porch Pirate's Nightmare* (25 Perfects), *Streak Freak* (a ×5 streak), *Signed, Sealed, Delivered* (finish a mission with every parcel delivered), *Bee Whisperer* (get stung 10 times), *Good Boy* (get a stolen parcel back from a dog), *Strike!* (1 STRIKE), *Ten-Pin Wizard* (10 STRIKEs), *Most Wanted* (reach 3 whistles), *Ticket Collector* (BUSTED 5 times), *Air Mail* (an Air Mail delivery), *Cake Boss* (5 cakes delivered without a SPLAT), *Golden Boy* (all of Maple Hollow's golden parcels), *Commuter* (visit every suburb), *Holiday Spirit* (finish any mission on Holiday Rush!).
    - **Shots:** `m15a-pause` (the hub over the paused world), `m15a-career` (the Career page with non-zero numbers set through a debug hook), `m15a-achievements` (the list with a few earned), `m15a-achievement-toast`.
14. **The Maple Hollow pond reads as a tiled swimming pool, and its invisible wall makes no sense. Make it a pond you can fall into: a cartoon hazard (user design, 2026-10-02).** In-game it's a flat, perfectly rectangular light-blue slab flush with the grass, with the tile seams showing and no edge; you just bump into nothing. (`addPond` in `world/ground.js` also builds the water box with `skipFaces: ['bottom', 'top']`, the same missing-top bug as the road lines in item 3, so what you see is the pond bed.) The reeds M2 asked for are missing.
   - **Look:** water sunk ~0.25 below the grass with a top face (one water mesh, as now), darker toward the middle (vertex colors), a few slow sparkle flecks, no tile seams. A natural edge of rounded stones and earth, with the corners rounded off (rock and grass blocks fill the rectangle's corners) so the outline isn't a rectangle. Reeds and cattails in clumps, 4–6 lily pads, a small wooden dock on the north side, and the ambient ducks swimming on it. A little sign by the path: "NO SWIMMING · DUCKS ONLY" (sign atlas, item 10). **No fence and no invisible wall**: the water tiles are no longer a collider.
   - **Falling in** (a new hazard, data-driven: a `water` hazard def with behavior `dunk`, triggered when the courier's center enters a water tile; it applies to any water tile in any suburb, so Lakeside's lake (M16) gets it for free):
     - On foot, slowly (below ~40% speed): a cartoon **teeter** first: 0.6 s of windmilling arms at the edge; stopping or turning back in that time saves you. Faster, or on any vehicle: straight in.
     - **SPLOOSH!** (the existing splash SFX + comic text + a big splash particle burst), the courier sinks to the neck with a bubble trail, then pops up spluttering with a duck sitting on their head (and the vehicle bobbing next to them). About 1.5 s in total, played as slapstick like the knockdowns (§2.12).
     - **Respawn near where you fell in, on a safe spot:** from the point where you crossed into the water, pick the nearest **park-path (`p`) or sidewalk (`s`) tile** (never a road, never the grass right at the edge), at least ~3 units from any water tile, and **at least ~8 units from any active hazard** (an angry swarm, a beehive, a chasing dog or Grump, a Watch unit, a skater's loop point); if the nearest fails those checks, take the next nearest. Put the courier on that tile's center, **standing still**, facing away from the water. Dripping (a short trail of water drops), with the knockdown's 1.5 s invulnerability blink plus a **2 s water grace** (the water tiles act as a wall for those 2 s), so you can't fall straight back in.
     - **In a mission:** you lose **one parcel** (the top one floats away on the water and sinks with a "blub"), and the streak resets: the same rule as a knockdown drop (§2.6), so it respects the difficulty's `knockdownCostsParcel` (item 12; on Easy you keep it). **In free roam:** just the gag.
     - Parcels thrown into the water still SPLOOSH as today. Dogs, skaters, Watch units and walkers path around the water (they never fall in; animals are never hurt).
   - **Career/achievements** (item 13): count dunks; add an achievement *Duck, Duck, Splash!* (fall into the pond 3 times).
   - **Shots:** `m15a-pond` (the park pond from the path: rounded rocky edge, reeds, dock, sign readable, no fence), `m15a-pond-top` (from above: no rectangle, no tile seams), `m15a-pond-teeter` (windmilling at the edge), `m15a-pond-dunk` (popped up with a duck on the head), and a stats/JSON check that a dunk during a mission lowers `carried` by 1 and respawns the courier on the nearest safe path/sidewalk tile to where they went in (not on a road, ≥8 units from the active hazards), plus a shot `m15a-pond-respawn-bees` with a beehive placed near the entry point: the courier respawns away from it.
15. **Street lights don't light up at night.**
   - *No light part:* `lamp()` in `world/props.js` builds the post and a dark grey head (`#2f333d`) into the opaque chunk only. Only the house porch lamps are in the shared glow mesh (§7.3/§7.4), so sidewalk lamps never light; at night only their faint ground pool appears. **Fix:** give each street lamp a lamp head in the glow builder (day color: pale frosted glass; night color: warm yellow `#ffd98a`, bright), plus a small downward cone/shade in the opaque chunk so it reads as a lamp. Same for the kiosk, depot lot, school and park lamps and every suburb's lamps (anything built by the lamp helper or a landmark that should glow: the lighthouse in M16, the clock tower face in M17).
   - *Lighting freezes during a mission:* `main.js` only lets the day clock drive the lighting when `!mission && !delivery`, so a mission started in the afternoon keeps afternoon light even after the clock passes 21:00 (and the lamps never come on during a mission). With item 11 (missions any time, the clock is the truth) the clock must drive the lighting, glow and lamp pools **always**, in free roam and in missions alike.
   - *Per-frame cost:* `dayCycle.setPhase()` runs every frame and calls `__setGlowBlend`, which re-lerps and re-uploads the whole glow color attribute every frame. Only re-apply the glow when its value changed by more than ~0.01 (and the lighting/sky when the blend moved), so a held time of day costs nothing.
   - Lamp pools stay as they are (visible when glow > 0.15), and light up together with the heads. No real `PointLight`s (§8).
   - **Shots:** `m15a-lamps-night` (a street at 22:00: every street lamp head glowing warm yellow with its pool under it), `m15a-lamps-day` (the same street at 12:00: heads unlit), `m15a-lamps-mission` (a mission started at 17:00, stepped to 21:30: the lamps are on).
16. **CRITICAL: a new player can hardly earn their first star.** Today stars are pure score thresholds tuned so the autoplayer *barely* gets 1★ (Neighborhood/Morning Round: 1★ = 1400). Delivering all 10 parcels by hand at the door (120 each) scores 1200: **0 stars with a perfect delivery record**; any wrong address or knockdown means you must throw stylishly to make up for it. On a fresh save that one mission is the only one open (Cake Rush needs 1★) and, until item 11, only 07:00–11:00. A careful new player can stay stuck at 0★ with nothing else to do.
   - **Stars reward delivering first, style second** (all missions, main and side):
     - **1★ = delivered at least ~70% of the parcels** (any method, doorstep included; round up: 7 of 10).
     - **2★ = delivered every parcel.**
     - **3★ = every parcel delivered and score ≥ the mission's `style` threshold** (the old 2★ value is a good start; re-tune with the autoplayer so a decent human gets it with a few Perfects).
     - Schema (log under *Decisions*): replace `stars: [a, b, c]` with `stars: { deliveredFrac: 0.7, style: <score> }`. The shift report shows the three star conditions as a checklist with ✓/✗ ("Delivered 7 of 10 ✓", "All delivered ✗ (8/10)", "Style 2600 ✗ (2140)"), so the player sees exactly what the next star needs. The mission card in the dispatch strip (item 8) shows the same three lines.
     - Coins stay `floor(score / 10)`, so style still pays.
   - **Starting unlocks** (with item 11): Neighborhood Round, Express Rush and Cake Rush open at 0★, so there are always three things to try. Check the full chain on a fresh Ship Me Plenty save: 0★ → 2★ (Fragile Friday) → 3★ (Heavy Haul) → 5★ (Big Round) → 8★ (Night Owl and Cedar Heights) → Lakeside → Old Town are all reachable by delivering everything (2★ per mission) without needing 3★ anywhere; adjust the unlock numbers if not.
   - **Verify with the autoplayer and a "careful player" run:** add `__pb.autoplay({ doorstepOnly: true })` (walks to every door and hands over, never throws). On a fresh save it must earn **2★ on Neighborhood Round**; the normal autoplayer must also get ≥ 1★. Record both in PROGRESS.md. Shots: `m15a-report-stars` (a report with the ✓/✗ checklist), `m15a-card-stars` (the dispatch card's star lines).
17. **Side missions deliver to the shop you picked up from.** §2.10 only said "Giver / pickup: `bakery`" and never where the parcels go, so since M6 `buildTargetDefs` in `gameplay/mission.js` sends every side-mission parcel to the giver building itself: Cake Rush is picked up *and* delivered at the bakery, Heavy Haul at the hardware store. (The spec's gap, not a code mistake.)
   - **Fix:** a side mission picks its delivery targets like a main shift, from **houses**, seeded, but with a minimum distance from the shop so it's a real run: `minDistance` in the shift data (Cake Rush: 1 house at least ~40 units away, preferably across the suburb; Heavy Haul: 3 houses at least ~20 units away and ≥ 15 units apart). Never a Grump house, never a house that's a target of the main shift running at the same time.
   - **Story on the card and the report:** each side-mission parcel gets a customer line from data, e.g. Cake Rush: "Mrs. Henderson's birthday cake → #14 Willow Court", Heavy Haul: "A box of bricks for Mr. Patel → #7 Oak Street". Pick from a small list per side mission (`customers: [{ name, line }]` in `data/shifts.js`), seeded.
   - The pickup stays at the shop (restock there if a parcel is lost). The GPS points to the house once you carry the parcel.
   - Apply to every suburb's side missions.
   - **Shots:** `m15a-cake-route` (after accepting Cake Rush: the radar/GPS route from the bakery to a house across the map, the target house marked), `m15a-cake-card` (the card with the customer line).
18. **The full map (Tab) is blurry and says nothing; reuse the real 3D world, as the title screen does (user design, 2026-10-02).** Today `ui/mapcanvas.js` paints its own map at 6 px per tile and scales it up: blurry, no street names, no suburb name; its legend sits under the HUD's top-left chips, and the region box (item 8) covers the top. The title screen already shows the real neighborhood from above in 3D, and it looks good.
   - **The full map is the live 3D world from above,** like the title screen. While the map is open, the main camera switches to a **top-down map camera** over the suburb (straight down or nearly so, orthographic or a narrow-FOV perspective), with no fog and the HUD hidden. The world stays live: cars, walkers, ducks, the Watch and your courier are all visible and moving (the sim keeps running at a low render rate, e.g. 30 fps; it no longer pauses while the map is open, but the player's controls are locked, and nothing can knock the courier down, steal a parcel or bust them while it's open; a running mission's clock keeps going). Closing the map restores the follow cam exactly. It reuses the existing scene, so no new geometry; check that the whole suburb in view stays ≤150 draw calls (the title overview is ~63 today).
   - **The radar** can't afford a second live render every frame, so it uses a **one-time top-down snapshot**: when a suburb loads, render the suburb once with the same map camera (noon lighting, actors hidden) into a ~2048 px render target, copy it to a 2D canvas, dispose the render target (§8), and draw the radar from it (replacing `mapcanvas.js`'s hand-painted 6 px/tile bitmap, so the radar is crisp and matches the world). Blips stay live on top as now.
   - **Labels on top of the live map** (one reused set of DOM labels, system font, white with a dark outline like the HUD, §10), placed in world positions from the neighborhood data and projected to the screen each frame like the floating texts (allocation-free), so they follow pan and zoom:
     - the **suburb name** as a title in the top-left of the map ("MAPLE HOLLOW"),
     - **every street name** along its road (rotated along N/S roads, placed mid-block, repeated on long roads, never across an intersection),
     - **landmarks and buildings**: Quickbox Distribution Center, Hollow Elementary, each shop by name, the park and pond, a suburb's landmark (water tower, pier/lighthouse, clock tower) and kiosk,
     - **exits** at the map edge: "→ Cedar Heights" (or "🔒 Cedar Heights · 8★"), replacing the separate region box (item 8),
     - the existing blips as screen-space icons over their world positions (you, targets, top-parcel house highlighted, pickup, lockers, mission markers, waypoint, Watch units), drawn larger than the 3D actors so they stay readable from high up.
   - **Full-map UI:** the map camera is **zoomable** (mouse wheel / +/−: from the whole suburb down to a few blocks) and **pannable** (drag, or WASD/arrows), starting centered on the player at a zoom where street names are readable; F or Space re-centers on you; the camera eases between positions. The legend becomes a compact strip along the bottom edge (icons + words), not a box under the HUD chips. Click to set/clear a waypoint as now; Tab/Esc closes. The HUD chips hide while the map is open.
   - **Radar:** uses the snapshot above, zoomed in, rotating as now, with nearby street names shown when they fit (small text, only 1–2 at a time, rotated with the radar) so you can tell where you are.
   - **Title screen fixes:** hide the HUD (FREE ROAM chip, coins, golden counter, radar, ability button) while the Title, How-to-play, Settings or difficulty screens are up; the title's overview camera shows a large dark wedge and bare brown ground beyond the map edge (the sky dome / ground plane don't cover that view): frame the title camera so it only sees the neighborhood and its forest border, or extend the ground/forest skirt beyond the map edge so no bare ground or sky-dome edge is visible.
   - **Shots:** `m15a-fullmap` (the live top-down view of all of Maple Hollow with cars visible on the roads, suburb name, every street name readable, shops/school/depot/park labeled, exits labeled), `m15a-fullmap-zoom` (zoomed 2.5× on the depot), `m15a-fullmap-cedar` (Cedar Heights with its own names), `m15a-radar-names` (the radar crisp with a street name), `m15a-title-clean` (the title with no HUD and no dark wedge or bare ground).
- **Done when:** every item above is fixed and verified, all existing shots are still clean, 0 console errors, ≤150 draw calls.

### M16: Lakeside
- Same structure as M15: `lakeside` with the lake, irregular shoreline (water edge tiles, shore rocks and reeds), bridges (road tiles on a raised deck), boardwalk, pier + lighthouse landmark (a glow light at dusk), geese as a data-driven hazard (dog-like chase with honks), floating-parcel gag, kiosk, shifts, lockers, golden parcels.
- **Shots:** `m16-overview`, `m16-bridge`, `m16-pier-dusk`, `m16-geese`, `m16-float`, `m16-shift`.
- **Done when:** as M15, through Maple Hollow's east exit.

### M17: Old Town
- Same structure: `old-town` with crooked streets, a market square, walk-only alleys (vehicles blocked like stairs), row houses (a new building style: narrow, 2–3 floors, joined walls), the church hill, the clock tower (chimes on the hour of the day cycle), the market-stall fruit gag (§2.15 breakable, cartoon, +heat), the pigeon flock, kiosk, shifts, lockers, golden parcels.
- **Shots:** `m17-overview`, `m17-alley`, `m17-market`, `m17-clocktower`, `m17-pigeons`, `m17-shift`.
- **Done when:** as M15, through Maple Hollow's west exit; a full tour Maple Hollow → each suburb → back works by keyboard alone, and a final soak (autoplay one shift per suburb) shows no errors and no leaks.


### M18: Adaptive music (user design, 2026-10-02)
Today `audio/music.js` plays one 4-bar, 16-note melody over I–V–vi–IV at 112 BPM, forever (~8.5 s on loop). Make the music varied and reactive, still 100% synthesized (§9), with no audio files.
- **One theme, many arrangements.** Write a short, catchy Parcelboy **main theme** (an 8-bar motif) as note data, plus a contrasting **B section** and a short **bridge**, so a song runs A–A–B–A–bridge–A (about 1–1.5 minutes before it repeats) instead of 4 bars. Each part has 2–3 melody variations (the scheduler picks one per pass, seeded), and the bass and drums vary by section (fills on the last bar of a section).
- **Per suburb, the same theme in a different arrangement** (data: `data/music.js`, keyed by neighborhood id, so a new suburb just adds an entry):
  - *Maple Hollow:* the current bright pop feel, C major, 112 BPM, triangle bass, square lead, hi-hat.
  - *Cedar Heights:* a breezy, open folk/country feel, G major, ~100 BPM, plucked lead (short decaying triangle), a "boom-chick" bass, shaker.
  - *Lakeside:* laid-back and summery, F major, ~92 BPM, soft sine lead with vibrato, a swung rhythm, light woodblock.
  - *Old Town:* a playful marching-band/accordion feel, D major, ~120 BPM, a reedy lead (square + detuned saw through a lowpass), oom-pah bass, snare rolls.
  - When you change suburb, the music crossfades during the transition card.
- **Time of day:** the same arrangement gets mellower at dusk/night (lower filter cutoff, sparser drums, -5 BPM) and brighter around lunch. Menus keep the existing sparse version.
- **Intensity layers that react to play** (a single `musicState` the scheduler reads at bar or beat boundaries, so changes land on the beat):
  - *Moving fast* (sprinting, Sprint/Turbo ability, top speed on a vehicle): a driving drum layer (kick on every beat, 16th hats) and **+8% tempo**, easing back over 2 bars when you slow down.
  - *Mission running:* an extra bass/arpeggio layer; the last game hour of a mission adds a ticking hi-hat.
  - *Danger* (a dog or Grump chasing, an angry bee swarm nearby, or heat ≥ 2 with a Watch unit within ~20 units): **switch to the parallel minor** (same theme in C minor in Maple Hollow, etc.), a low pulsing bass, a tense "dun-dun" figure. It stays cartoonish: think Saturday-morning chase music, not horror. The closer the Watch unit, the louder the tension layer.
  - *Stingers* (short, one-shot, on top of the music): a rising fanfare for a ×3+ streak or a Perfect delivery (already in SFX: duck the music under it), a "wah-wah-waaah" for BUSTED, a cheerful jingle when you lose the Watch, a sweep up when a mission starts and a little cadence when it ends.
- **Implementation:** split into `audio/music/` (scheduler, theme data, instruments, layers, each under ~300 lines). Keep the 25 ms lookahead scheduler. Reuse one noise buffer for all drum hits (today `hat()` allocates a new buffer for every hit) and create oscillators only for scheduled notes (no per-frame allocation in the game loop; the scheduler runs on its own timer). The music still stops when paused / the tab is hidden, and Mute / the music volume still apply. Danger detection reads existing state (hazards, heat, watch) once per beat; don't add per-frame work.
- **Verify:** headless shots can't hear audio, so expose `__pb.debugMusic()` returning `{ suburb, section, variation, bpm, mode: 'major'|'minor', layers: [...], lastStinger }`, and add shots/JSON checks: `m18-music-maple` (normal), `m18-music-sprint` (tempo up, drum layer on), `m18-music-danger` (with `__pb.setHeat(7)` and a Watch unit near: minor mode, tension layer), `m18-music-cedar` (Cedar arrangement after a suburb change), `m18-music-night` (dusk variant). The user will judge the actual sound in a browser.
- **Done when:** the debug readout shows every state above switching correctly, a song plays at least a minute before repeating, each suburb has its own arrangement, 0 console errors, no new per-frame allocations.

---

## 14. Extension guide (goes into the README)

- **New courier:** add an entry to `data/characters.js`. If it uses a new ability, add one registered ability in `gameplay/abilities.js` that only touches the modifier stack. No other code changes.
- **New vehicle:** add an entry to `data/vehicles.js` and a model builder registered under its `model` id in `entities/vehicleModels.js`.
- **New hazard:** add an entry to `data/hazards.js`. Reuse a behavior, or add `behaviors/<id>.js` exporting `{ id, create, update, onPlayerContact? }` and register it in `behaviors/index.js`. Add a model builder.
- **New package type:** add an entry to `data/packages.js` and, for a new rule key, one handler in `scoring.js`.
- **New mission:** add an entry to `data/shifts.js`. For a side mission with a new giver, also add a marker to the neighborhood's `missionMarkers`.
- **New neighborhood:** add a file in `data/neighborhoods/` with the same shape as Maple Hollow (map, roads, houses, buildings, spawn, restockZone, missionMarkers, goldenParcels, traffic, sidewalkLoops, hazardSpots, gagSpots, plus the optional `heights`, `parcelLockers`, `exits` and `unlockStars` of §2.17–§2.19) and register it. Link it from an existing suburb's `exits` (both directions). The tilemap validator will catch layout mistakes. Shifts pick it with `neighborhood: '<id>'`.

---

## 15. Out of scope (don't build)
A procedurally generated or streamed open world (the world is a set of hand-made suburbs, one loaded at a time, §2.18), the call-a-delivery-van mechanic (a future option, §2.17), Multiplayer, online leaderboards, gamepad, touch or mobile controls, a level editor, physics engines, post-processing (bloom, SSAO, etc.), external asset files, a build step, TypeScript, localization, weather (rain is a possible future hazard, so leave room in the time-of-day structure but don't implement it).

---

## Appendix: `PROGRESS.md` template
```markdown
# Progress

Current milestone: M0

## Decisions
- (date) decision, and why

## Milestones
### M0: Scaffold, Docker and tooling: IN PROGRESS
- Done:
- Screenshots reviewed:
  - m0-cube: <what I actually see>
- Stats: drawCalls=…, triangles=…, geometries=…
- Known issues:
- User check: n/a
```
