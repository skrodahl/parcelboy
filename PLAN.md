# Parcelboy: build plan

> Audience: the coding agent building this game (see `AGENTS.md`). Read this whole document once, then work milestone by milestone (§13).
> Where the plan gives a value (a speed, a color, a size), use it as the starting value. Tune only in the milestones that say so, and record the changes in `PROGRESS.md`.

## Plan changes (read first; apply before starting the next milestone)

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
7. **Mission ends** when every delivery is done (time bonus), when the timer reaches 0, or when you **abandon** it (pause menu → Abandon mission: no reward, no penalty).
8. **Results** screen: score, stars (0–3), coins earned, best record. Then choose **Continue** (back to free roam, exactly where you are) or **Retry** (teleports to the mission's pickup and restarts). Coins unlock couriers and vehicles; stars unlock missions.

**You can always ignore a mission.** During a mission nothing stops you from riding off to explore. The timer keeps running and the targets wait. When time runs out you get whatever you scored, and you're back in free roam.

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
| Shift | use the courier's special ability |
| Esc / P | pause |
| M | mute or unmute |
| Tab | open or close the **full-screen map** (§10). The game pauses while it's open. Click a spot to set a **waypoint** (GPS route on the radar, a pin on the map); click the waypoint again to clear it |

The input layer maps keys to **actions** (`forward`, `back`, `left`, `right`, `throwLeft`, `throwRight`, `throwAim`, `jump`, `doorstep`, `ability`, `pause`, `mute`, `map`). Game code only ever reads actions, never raw keys.

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
- **Time bonus** when all targets are delivered: remaining seconds × 10.
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

**Side missions** (short and snappy; they use whatever time of day and free-roam hazards are current):

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
- **Day cycle:** free roam slowly blends through morning → noon → golden → dusk → back to morning, with each preset held for `FREE_ROAM.minutesPerPhase` (2) and blended over 30 s. Blend by interpolating every numeric and color field of the two presets into a scratch preset (no allocations). While blending, refresh the static shadow map at most every 2 s. Missions with a fixed time of day blend to theirs over 2 s at mission start, then back to the cycle when the mission ends.
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
- **HUD:** top-left score plus multiplier badge (pulses on change); top-center timer (turns red and pulses under 30 s); bottom-left corner **radar** (see below); left the **delivery list** (next 5 targets: address + package-type icon, with a check animation when delivered); above the radar, the carried **parcel stack** (icons) with the next parcel's type highlighted; bottom-right the **ability button** with a cooldown ring (conic-gradient) and key hint.
- **Radar (GTA-style, `ui/radar.js`):** a **circular** 200px canvas in the bottom-left corner with a chunky white rim and soft shadow. It is **player-centered and rotates with the camera**, so up on the radar is always the direction the camera faces, and the player is a fixed arrow in the middle. Draw it like this:
  - At boot, pre-render the whole map once to an offscreen canvas at 3 px per tile: grass, roads (dark with lighter edges), sidewalks, houses as roof-colored rectangles, park, pond, lot.
  - At 15 Hz: clear, clip to a circle, translate and rotate, then `drawImage` the pre-rendered map. Visible range is about a 45-unit radius, zooming out to 60 at top speed.
  - Draw the **GPS route** as a thick rounded line in route color: the path of tile centers from the player to the current objective (nearest target, the pickup zone when empty, or the waypoint). Compute it with a BFS over walkable tiles into preallocated typed arrays, only when the player's tile or the objective changes.
  - **Blips** (small icons with a white outline): targets (teal parcel), pickup (yellow box), Distribution Center (**Q**), mission markers (their color and icon; hidden during a mission), waypoint (pin), angry bee swarms (a tiny yellow dot, as a warning). Blips outside the range are **clamped to the rim** as smaller arrow-tipped markers. Add a small **N** tick on the rim that rotates with the map.
  - In free roam with no waypoint, there's no route.
- **Full-screen map (Tab):** the whole pre-rendered map, north-up, scaled to fit, with all blips, a legend, and the player arrow. Clicking sets or clears a waypoint. Golden Parcels found so far show as small gold checkmarks. The game pauses while the map is open.
- **Mission card:** slides in from the right while you stand in a mission marker. It shows the name, a one-line blurb, deliveries, time limit, time-of-day icon, package-mix icons, best score and stars, and "Press F to start". Locked missions show the padlock and the stars needed. At `dispatch`, ←/→ pages through the main shifts.
- **Heat:** 3 whistle icons sit just above the radar, filled per level. They wobble when heat rises and flash while the Watch is losing you. Watch units are **flashing red blips** on the radar and are always clamped to the rim when far away.
- **Free-roam HUD:** radar, coins, Golden Parcels found (x/12), a "FREE ROAM" chip, and an ability button. The mission HUD adds score, multiplier, timer and the delivery list, and the chip becomes the mission name.
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

Every milestone ends with: shots added to `tools/shots.json` → run → **look at them** → fix → update `PROGRESS.md` → commit. "Expected" describes what the screenshots must show.

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
- ⛔ **User check:** ask the user to play in a real browser on their laptop and confirm the controls feel good and the fans stay quiet. Record the answer in `PROGRESS.md`.

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
- ⛔ **User check:** play a `lunch` shift and report on feel, difficulty and fans.

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
- ⛔ **User check:** a final play session on the laptop in all 3 quality presets.
- **Done when:** every shot is clean, the budgets are met, the README is complete, and the user signs off.

---

## 14. Extension guide (goes into the README)

- **New courier:** add an entry to `data/characters.js`. If it uses a new ability, add one registered ability in `gameplay/abilities.js` that only touches the modifier stack. No other code changes.
- **New vehicle:** add an entry to `data/vehicles.js` and a model builder registered under its `model` id in `entities/vehicleModels.js`.
- **New hazard:** add an entry to `data/hazards.js`. Reuse a behavior, or add `behaviors/<id>.js` exporting `{ id, create, update, onPlayerContact? }` and register it in `behaviors/index.js`. Add a model builder.
- **New package type:** add an entry to `data/packages.js` and, for a new rule key, one handler in `scoring.js`.
- **New mission:** add an entry to `data/shifts.js`. For a side mission with a new giver, also add a marker to the neighborhood's `missionMarkers`.
- **New neighborhood:** add a file in `data/neighborhoods/` with the same shape as Maple Hollow (map, roads, houses, buildings, spawn, restockZone, missionMarkers, goldenParcels, traffic, sidewalkLoops, hazardSpots, gagSpots) and register it. The tilemap validator will catch layout mistakes. Shifts pick it with `neighborhood: '<id>'`.

---

## 15. Out of scope (don't build)
A bigger or procedurally generated world (the free-roam area is Maple Hollow only), Multiplayer, online leaderboards, gamepad, touch or mobile controls, a level editor, physics engines, post-processing (bloom, SSAO, etc.), external asset files, a build step, TypeScript, localization, weather (rain is a possible future hazard, so leave room in the time-of-day structure but don't implement it).

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
