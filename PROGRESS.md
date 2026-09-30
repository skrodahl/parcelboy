# Progress

Current milestone: M3 (next; M2 complete)

## Decisions
- (2026-09-30) Git branch is `master` (git default); kept as-is.
- (2026-09-30) M0 kept renderer setup inline in `main.js`; it moves to `render/renderer.js` in M1 when quality presets land.
- (2026-09-30) `three.module.js` @ 0.170.0 is self-contained (grep for `three.core` found no import, per the M0 check), so only one vendored file is needed.
- (2026-09-30) `voxel.js` originally emitted the 2nd triangle of each face as `(v1,v3,v2)`, which is wound **inward** (back-face). In a `FrontSide` material that triangle is culled → the "triangular holes" I first misread as "SwiftShader drops triangles" (it reproduces on any backend). A `DoubleSide` workaround hid the holes but rendered those triangles as back faces with flipped normals → the "comb" shading streaks on the roof. **Fix:** index split is now `base, base+1, base+2, base, base+2, base+3` (all triangles CCW); `worldMat` reverted to the correct `FrontSide` (saves fill vs DoubleSide). Verified clean on SwiftShader and Chromium.
- (2026-09-30) Stacked boxes use `skipFaces:['bottom']` to avoid coplanar z-fighting (never leave two large faces in the same plane).
- (2026-09-30) M1 test scene: the house casts but does not receive its own shadow (the ground receives the house shadow); real static-chunk self-shadowing is handled in M2. Shadow camera extent `max(14, 5.2/tan(sunElev)+6)`, bias −0.0008, near 5 / far 160.
- (2026-09-30) M2: the M0/M1 scenes are now opt-in (`?scene=test`, `?scene=cube`); the default scene is the built neighborhood world. `m0-cube` shot URL is now `/?scene=cube&debug=1&mute=1`.
- (2026-09-30) M2: sky dome follows the camera (centered on cam, R=200 < far plane 220) — a fixed dome at the origin clips to black for far-off cams. `createSky` returns `follow(cam)`, called every frame in `update()` (allocation-free).
- (2026-09-30) M2: per-tile slabs get a checkerboard top-face depth offset (0.005, `((x+z)&1)`) so coplanar jittered tile tops never z-fight; slabs span `SLAB_BASE=-0.4` up to the surface height (curbs raised to 0.12).
- (2026-09-30) M2: world shadow camera was set with `top`/`bottom` swapped (±110); fixed to `top=110, bottom=-110`.
- (2026-09-30) M2: `m0-cube` triangles read 22 now (was 14) — its ground plate is a `VoxelBuilder` box (10 tris) in addition to the cube (12).
- (2026-09-30) M2: sign atlas (§7.8) built with 2 columns, auto-fit font (`measureText`), and plate-only UV sub-rects so a sign quad shows just the plate (first attempt mapped the whole slot → cream background showed; font also overflowed the plate → garbled text; both fixed). Sign posts merge into chunk opaque builders; all sign quads merge into one mesh + one `MeshBasicMaterial` (1 call, 1 texture).
- (2026-09-30) Push target: GitHub repo `skrodahl/parcelboy`, branch `main` (local branch renamed `master` → `main` to match; user instruction 2026-09-30).

## Milestones
### M0: Scaffold, Docker and tooling: DONE
- Done: `git init`; infra files from PLAN §4 verbatim (Dockerfile, docker/nginx.conf, compose.yaml, tools/shots/Dockerfile, tools/shoot.cjs, .dockerignore, .gitignore, game/index.html); PROGRESS.md from the appendix template; three@0.170.0 vendored to `game/vendor/three.module.js`; `main.js` boots a renderer on #game with a spinning teal cube on a grass plate; `core/loop.js` (60 Hz fixed step, 4-step clamp, 60 fps frame cap, visibility pause/resume), `core/params.js` (all §12.1 params), `core/debug.js` (?debug=1 overlay, 4 Hz refresh); `window.__pb` with `ready`/`stats()`/`state()` plus no-op stubs for the rest; `m0-cube` added to `tools/shots.json`.
- Screenshots reviewed:
  - m0-cube: teal cube mid-rotation on green grass under a light-blue sky; debug overlay top-right reads fps 60, ms 16.7, calls 2, tris 14, geo 2, tex 0, actors 0, quality high, state boot. No black frame, no z-fighting.
- Stats: drawCalls=2, triangles=14, geometries=2, textures=0; zero console errors/warnings; container serves at http://localhost:8080 (HTTP 200, three.module.js served).
- Known issues: none.
- User check: n/a (no gate on M0).

### M1: Rendering foundations: DONE
- Done: `render/renderer.js` (QUALITIES high/balanced/battery per §8: fps, pixelRatioCap, antialias, shadowSize, shadowFilter; `createRenderer` + `resizeRenderer`), `render/voxel.js` (`VoxelBuilder.box/merge/toGeometry` → one indexed BufferGeometry with position/normal/color, §7.3 fake AO (y≤0.3 → ×0.88, down-facing ×0.75) + per-box ±4% brightness jitter, `opts.skipFaces`), `render/lighting.js` (one `HemisphereLight` + one `DirectionalLight` sun, §7.3), `render/sky.js` (inverted sky sphere with horizon→zenith vertex-color gradient, scene fog, 6 drifting voxel clouds in one `InstancedMesh` at y=45, allocation-free `update`), `data/palette.js`, `data/timeOfDay.js` (4 presets verbatim from §7.3), `core/registry.js`, `core/events.js`, `core/rng.js` (mulberry32), `core/pool.js`. Rewrote `main.js` with the `?scene=test` cottage (grass plate + 4-step gable roof + door/porch/windows/flower boxes/shrubs), camera (11,8,14)→(0,2,0); added `m1-test-morning/dusk/battery` to `tools/shots.json`.
- Screenshots reviewed:
  - m1-test-morning (SwiftShader): cute cottage on grass, solid 4-step roof, soft beige sky gradient, warm sun, house shadow cast on the grass, flower boxes + 2 shrubs. No black frame, no z-fighting, no comb streaks.
  - m1-test-dusk (SwiftShader): clearly darker scene; pink horizon afterglow with blue zenith above-frame (faithful to the §7.3 dusk preset — visible sky band is the `#f28482` horizon, `#2b2d62` zenith is out of frame at this near-horizontal cam); house reads in cool blue hemisphere light + low warm sun.
  - m1-test-battery (SwiftShader): same cottage, morning light, **no** house shadow (shadowSize=0) and hard un-antialiased edges, as expected for the battery preset.
- Stats: calls=4 (ground, house, sky, clouds — the house alone is **1** call, satisfying "house in ≤ 3 calls"), triangles=960, geometries=4, textures=1 (morning/dusk shadow map) / 0 (battery); zero console errors across all 4 shots (`m0-cube` still passes: calls=2, tris=22). fps cap verified on a real Chromium backend: high=60 fps (16.7 ms), battery=30 fps (33.3 ms).
- Known issues: none. (A roof "comb" streak + triangular holes were traced to a `voxel.js` index-split winding bug, not to SwiftShader — see Decisions; fixed and re-shot clean on both backends.)
- User check: n/a (no gate on M1; the ~60 fps cap on a real browser is noted above as the M1 DoD item).

### M2: Neighborhood ground and props: DONE
- Done: `data/neighborhoods/maple-hollow.js` (verbatim §6.1 data: 40×48 map, 26 houses, 5 buildings, 7 roads, sidewalk loops, traffic loops, hazard spots, mission markers, golden parcels) + `data/neighborhoods/index.js` (registry export); `world/tilemap.js` (TILES legend, `loadTilemap` validation incl. H=2×2 house / X=building footprint checks, `cx/cz/minX/minZ/surfH`); `world/chunkGrid.js` (12×10 chunks, 4×4 = 16 chunks, one `VoxelBuilder` + water slot each); `world/ground.js` (per-tile slabs with checkerboard anti-z-fight offset, forest 2 trees/tile + scattered `t` trees, dashed yellow centerlines (skip intersections + Willow Court bulb), zebra crosswalks at intersections, parking stall lines, pond water plane + basin); `world/props.js` (sidewalk lamps every 5th loop tile alternating side, hydrants at intersection corners, benches + reeds by the pond, playground set); `world/collision.js` (static spatial hash, one cell per tile; `resolveCircle`, `raySegment`); `world/signs.js` (sign texture atlas §7.8 start: street name signs, one merged mesh); `world/worldBuilder.js` (`buildWorld` → chunk meshes, collision, `porches`/`doormatPoints`/`lots` per §6.3). `main.js` now branches `?scene=test|cube` vs default world, with cam presets (overview/street/park/depot) and world shadow setup (±110, near 5/far 400, bias −0.0006); `render/sky.js` dome follows the camera.
- Screenshots reviewed (SwiftShader, all 0 console errors):
  - m2-overview: high south view of the map — park with playground + pond bottom-left, dark empty lot bottom-right, 3 vertical roads + sidewalks + street lamps, forest border; the far (north) half fades into the sky with the spec fog [70,160] (intended diorama aesthetic, §655) — road layout still reads down to mid-map.
  - m2-street: low shot down Maple Avenue — yellow dashed centerline, sidewalks, street lamps, trees; sign posts visible along the road; no z-fighting stripes on the asphalt.
  - m2-park: pond (light-blue water + light rim), park lawn, sandy path, bench, reeds, dense forest line; clean.
  - Sign legibility verified in Chromium (temp `?cam=sign` view): "North Road" / "West Lane" plates upright and readable, plate-only UV (no background bleed); temp preset removed after.
- Stats: m2-overview calls=20 tris=43056 geos=20 tex=2; m2-street calls=16 tris=35358 geos=18 tex=2; m2-park calls=7 tris=11208 geos=19 tex=2. All ≤ 40 draw calls (DoD); textures=2 ≤ 4 budget (atlas + shadow map); calls/geos vary between shots due to chunk frustum culling (boot-time, not the ±2 runtime rule). `m0-cube`/`m1-*` shots still pass unchanged.
- Known issues: m2-overview north half fades to sky (spec fog + high cam; revisit with M4 camera work); houses/buildings are M3 (lots + porches + colliders for them land there); sign quads are unlit `MeshBasicMaterial` (fine for the start pass; shop/depot signs + logo + mailbox numbers join the atlas later).
- User check: n/a (no gate on M2).
