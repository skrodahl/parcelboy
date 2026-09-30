# Progress

Current milestone: M2 (next; M1 complete)

## Decisions
- (2026-09-30) Git branch is `master` (git default); kept as-is.
- (2026-09-30) M0 kept renderer setup inline in `main.js`; it moves to `render/renderer.js` in M1 when quality presets land.
- (2026-09-30) `three.module.js` @ 0.170.0 is self-contained (grep for `three.core` found no import, per the M0 check), so only one vendored file is needed.
- (2026-09-30) `voxel.js` originally emitted the 2nd triangle of each face as `(v1,v3,v2)`, which is wound **inward** (back-face). In a `FrontSide` material that triangle is culled → the "triangular holes" I first misread as "SwiftShader drops triangles" (it reproduces on any backend). A `DoubleSide` workaround hid the holes but rendered those triangles as back faces with flipped normals → the "comb" shading streaks on the roof. **Fix:** index split is now `base, base+1, base+2, base, base+2, base+3` (all triangles CCW); `worldMat` reverted to the correct `FrontSide` (saves fill vs DoubleSide). Verified clean on SwiftShader and Chromium.
- (2026-09-30) Stacked boxes use `skipFaces:['bottom']` to avoid coplanar z-fighting (never leave two large faces in the same plane).
- (2026-09-30) M1 test scene: the house casts but does not receive its own shadow (the ground receives the house shadow); real static-chunk self-shadowing is handled in M2. Shadow camera extent `max(14, 5.2/tan(sunElev)+6)`, bias −0.0008, near 5 / far 160.

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
