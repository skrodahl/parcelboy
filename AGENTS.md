# Parcelboy: agent rules

You are building **Parcelboy**, a friendly, colorful arcade game in the browser, inspired by *Paperboy*. The player is a courier for the fictional company **Quickbox** and delivers parcels around a suburban neighborhood by throwing them onto porches or handing them over at the door. The gameplay is deliberately **cartoonish**: slapstick, exaggerated and comedic (`PLAN.md` §2.12). The bee swarm hazard is a required feature. The game is **free-roam first**, with optional GTA-style missions started from in-world markers (§2.1, §2.13), and it has a GTA-lite mischief layer (§2.15). Mischief stays cartoon slapstick: people always pop back up and animals are never hurt.

**The full specification is `PLAN.md`. Read it before doing anything.** Your progress is tracked in `PROGRESS.md`. Read it at the start of every session to see which milestone you're on.

## How to work

0. At the start of every session and before every milestone, check the **Plan changes** section at the top of `PLAN.md`, and apply anything not yet logged in `PROGRESS.md`.
1. Work **one milestone at a time**, in order. Don't start the next milestone until the current one meets every item in its *Definition of done*.
2. Before writing code for a milestone, reread that milestone's section in `PLAN.md`, plus any section it references.
3. After each milestone:
   - run the screenshot tool (`PLAN.md` §12),
   - **open and look at every PNG it produced**, and write one or two sentences in `PROGRESS.md` on what each one actually shows,
   - fix anything that doesn't match the expected description and re-shoot,
   - update `PROGRESS.md`, then `git commit -am "M<n>: <title>"` and **`git push origin main`** (the user runs overnight and expects work to land on GitHub each milestone).
4. Never mark something done without evidence: a screenshot you looked at, stats JSON, or zero console errors.
5. If the plan is ambiguous, pick the **simplest** option that satisfies it and record it under *Decisions* in `PROGRESS.md`. Don't ask unless you're blocked.
6. **Autonomous overnight run (user directive 2026-10-01):** do NOT stop at each milestone or at a *User check* gate. A user-check gate (M4 / M7 / M12, etc.) is not a stop: record it under the milestone's `User check:` line in `PROGRESS.md` as "pending — user to verify later" and **continue to the next milestone** so work keeps progressing unattended. Only stop and report if (a) the screenshot tool can't render WebGL after two attempts to fix it, or (b) continuing would require breaking a hard rule below. In both cases, state exactly what you found and where you stopped.

## Hard rules

- **Stack:** plain ES modules plus Three.js (vendored, `game/vendor/`), served by nginx in Docker. **No npm, no bundler, no frameworks, no other libraries**, and no Three.js addons unless `PLAN.md` names one.
- **No external assets.** No image, model, audio or font files. All geometry is built from boxes in code (`render/voxel.js`), all sound is synthesized with WebAudio, and text uses system fonts. The only textures allowed are the few canvas textures `PLAN.md` lists.
- **Data-driven.** Characters, vehicles, hazards, packages, shifts and neighborhoods live in `game/src/data/*.js` and are looked up through registries by id. Game logic must never hard-code a specific character, vehicle or hazard id.
- **Small files.** Keep each file under about 300 lines. Split a file when it grows past that.
- **Performance budget (non-negotiable; `PLAN.md` §8):**
  - frame rate capped (60 fps, or 30 fps in Battery saver),
  - pixel ratio capped at 1.5,
  - no more than 150 draw calls during gameplay,
  - static world merged into chunks,
  - **no allocations** (`new`, object or array literals, closures) inside per-frame update code; reuse scratch objects,
  - dispose of GPU resources you replace,
  - stop rendering when the tab is hidden, and render at a low rate in menus or when paused.
- **No console errors.** Any console error in the screenshot run means the milestone isn't done.
- Don't change a public interface or data schema from an earlier milestone without noting it under *Decisions*.

## Commands

```bash
docker compose up -d --build web          # game at http://localhost:8080 (game/ is live-mounted, so just reload)
docker compose run --rm shots             # all screenshots -> shots/*.png + shots/*.json
docker compose run --rm shots m4          # only shots whose name contains "m4"
docker compose logs web                   # nginx logs (404s etc.)
```
