# Parcelboy

**Parcelboy** is a friendly, colorful arcade game in the browser, inspired by *Paperboy*. You are a courier for the fictional company **Quickbox**, delivering parcels around a cartoon suburban neighborhood — throw them onto porches or hand them over at the door. The gameplay is deliberately cartoonish: slapstick, exaggerated, and comedic. Free-roam first, with optional GTA-style shifts started from in-world markers, a neighborhood-watch mischief layer, a bee-swarm hazard, and a hidden "Golden Parcels" collect-a-thon that unlocks the golden bike.

The game is a single static site: plain ES modules + [Three.js](https://threejs.org/) (vendored, `game/vendor/`), served by nginx in Docker. No build step, no npm, no external asset files — all geometry is built from boxes in code, all sound is synthesized with WebAudio, and text uses system fonts.

## Run it

### Development (live-mounted)

```bash
docker compose up -d --build web
# → http://localhost:8080  (the game/ directory is live-mounted: just reload to see changes)
```

Useful extras:

```bash
docker compose run --rm shots            # render every screenshot -> shots/*.png + shots/*.json
docker compose run --rm shots m4         # only shots whose name contains "m4"
docker compose logs web                   # nginx logs (404s etc.)
```

`shots/*.json` records the draw-call / triangle / geometry / texture counts the shot tool captured, so a shot only counts when those are within budget.

### Production (single image)

```bash
docker build -t parcelboy .
docker run --rm -d -p 8081:80 --name pb-prod parcelboy
# → http://localhost:8081
docker rm -f pb-prod   # stop it when done
```

The `Dockerfile` bakes `game/` into the nginx image (no live mount). You can point a one-off screenshot at it by setting `BASE_URL=http://localhost:8081` on the `shots` service.

## Controls

| Key | Action |
| --- | --- |
| `W` / `↑` | forward |
| `S` / `↓` | back |
| `A` / `←` · `D` / `→` | steer |
| `Q` / `E` | throw with left / right aim-assist |
| Mouse click | throw at the cursor |
| `Space` | jump (clears curbs, low cones) |
| `F` (hold) | doorstep delivery — stand still on the target porch for 0.8 s |
| `Shift` | use your courier's ability (each character has one) |
| `Enter` | confirm (the dispatch card) |
| `Tab` | toggle the corner radar / full map |
| `Esc` / `P` | pause |
| `M` | mute |

Approach the in-world **dispatch marker** (or a side-mission marker) and press `Enter` to start a shift; delivering all the parcels before the timer runs out ends the shift and pays out coins + stars.

## Quality presets

Three rendering presets, chosen on the start screen or by `?quality=<high|balanced|battery>`:

- **High** — 60 fps, pixel ratio ≤ 1.5, soft 2048-pixel shadows.
- **Balanced** — 60 fps, pixel ratio ≤ 1.25, 1024-pixel shadows.
- **Battery** — 30 fps, pixel ratio ≤ 1.0, no shadows, and reduced ambient life.

The performance budget is non-negotiable: the frame rate is capped, the pixel ratio is capped at 1.5, and gameplay holds to ≤ 150 draw calls.

## How to add content

The game is data-driven: characters, vehicles, hazards, packages, shifts and neighborhoods live in `game/src/data/*.js` and are looked up through registries by id, so the game logic never hard-codes a specific entry. Add content by editing data, not code.

- **New courier** — add an entry to `data/characters.js`. If it uses a new ability, add one registered ability in `gameplay/abilities.js` that only touches the modifier stack. No other code changes.
- **New vehicle** — add an entry to `data/vehicles.js` and a model builder registered under its `model` id in `entities/vehicleModels.js`.
- **New hazard** — add an entry to `data/hazards.js`. Reuse a behavior, or add `behaviors/<id>.js` exporting `{ id, create, update, onPlayerContact? }` and register it in `behaviors/index.js`. Add a model builder.
- **New package type** — add an entry to `data/packages.js` and, for a new rule key, one handler in `scoring.js`.
- **New mission** — add an entry to `data/shifts.js`. For a side mission with a new giver, also add a marker to the neighborhood's `missionMarkers`.
- **New neighborhood** — add a file in `data/neighborhoods/` with the same shape as Maple Hollow (map, roads, houses, buildings, spawn, restockZone, missionMarkers, goldenParcels, traffic, sidewalkLoops, hazardSpots, gagSpots) and register it. The tilemap validator catches layout mistakes. Shifts pick it with `neighborhood: '<id>'`.

## Project layout

```
game/
  index.html        the single page (canvas + UI)
  vendor/           vendored Three.js (the only dependency)
  src/
    main.js         boot, the game loop, HUD + the __pb debug/test hooks
    core/           rng, input, save, the frame loop
    world/          chunk building, traffic, the sky + lighting, the busy depot
    entities/       the courier (player), parcels, ambient NPCs, hazards
    gameplay/       shifts, delivery, scoring, the mischief + heat layer,
                    progressions, the free-roam day cycle, abilities
    render/         the renderer/quality presets, the pooled particle effects,
                    the camera, lighting, float text
    data/           characters, vehicles, hazards, packages, shifts,
                    neighborhoods, the time-of-day presets, config
  shots/            generated screenshots + their stats JSON
tools/
  shoot.cjs         the headless screenshot runner (Puppeteer, one page per shot)
  shots.json        the shot list (name, boot URL, waits, the expected description)
compose.yaml        the web + shots services
Dockerfile          the production nginx image
```

The game is tested by running the screenshot suite (each shot asserts 0 console errors + a draw-call budget) and by a headless autoplayer soak (`__pb.soak`) that tunes the star thresholds so the autoplayer reliably earns one star while a careful human earns two or three.
