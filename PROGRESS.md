# Progress

Current milestone: M1

## Decisions
- (2026-09-30) Git branch is `master` (git default); kept as-is.
- (2026-09-30) M0 kept renderer setup inline in `main.js`; it moves to `render/renderer.js` in M1 when quality presets land.
- (2026-09-30) `three.module.js` @ 0.170.0 is self-contained (grep for `three.core` found no import, per the M0 check), so only one vendored file is needed.

## Milestones
### M0: Scaffold, Docker and tooling: DONE
- Done: `git init`; infra files from PLAN §4 verbatim (Dockerfile, docker/nginx.conf, compose.yaml, tools/shots/Dockerfile, tools/shoot.cjs, .dockerignore, .gitignore, game/index.html); PROGRESS.md from the appendix template; three@0.170.0 vendored to `game/vendor/three.module.js`; `main.js` boots a renderer on #game with a spinning teal cube on a grass plate; `core/loop.js` (60 Hz fixed step, 4-step clamp, 60 fps frame cap, visibility pause/resume), `core/params.js` (all §12.1 params), `core/debug.js` (?debug=1 overlay, 4 Hz refresh); `window.__pb` with `ready`/`stats()`/`state()` plus no-op stubs for the rest; `m0-cube` added to `tools/shots.json`.
- Screenshots reviewed:
  - m0-cube: teal cube mid-rotation on green grass under a light-blue sky; debug overlay top-right reads fps 60, ms 16.7, calls 2, tris 14, geo 2, tex 0, actors 0, quality high, state boot. No black frame, no z-fighting.
- Stats: drawCalls=2, triangles=14, geometries=2, textures=0; zero console errors/warnings; container serves at http://localhost:8080 (HTTP 200, three.module.js served).
- Known issues: none.
- User check: n/a (no gate on M0).

### M1: Rendering foundations: IN PROGRESS
- Done:
- Screenshots reviewed:
- Stats:
- Known issues:
- User check: n/a
