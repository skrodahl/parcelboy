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
   - update `PROGRESS.md`, then `git commit -am "M<n>: <title>"` and **`git push origin main`** (the user expects work to land on GitHub after every milestone and every M12a fix).
4. Never mark something done without evidence: a screenshot you looked at, stats JSON, or zero console errors.
5. If the plan is ambiguous, pick the **simplest** option that satisfies it and record it under *Decisions* in `PROGRESS.md`. Don't ask unless you're blocked.
6. **Never stop on your own (user directive 2026-10-01, replaces the earlier overnight-run rule).** Work through **every** milestone in `PLAN.md` §13, in order, until the last one is DONE. Only the user decides when you stop. That means:
   - A finished milestone is **not** a stopping point: commit, push, and start the next milestone in the same run.
   - There are no user-check gates. Never wait for a review, a sign-off or an answer.
   - **Don't write a summary, a status report or a question to the user** until every milestone is DONE. In your agent a plain text reply ends your turn, which stops the work. Keep calling tools instead; your progress report is `PROGRESS.md` and the git log.
   - If something is blocked (a tool fails, a fix doesn't work after two serious attempts, the plan contradicts itself), record it under *Known issues* in `PROGRESS.md` with exactly what you found, pick the simplest workaround or skip that one item, and **keep going** with the rest. Never break a hard rule to get unblocked; skip the item instead.
   - If your context fills up or the session restarts, resume from `PROGRESS.md` and `git log` and continue where you left off.
   - **Auto-continue hook** (`.opencode/plugin/autocontinue.js`): a plugin re-prompts "please continue" whenever a turn ends, so a plain-text reply no longer stalls the run. **If your reply actually stops the work — you're done, or you need a decision from the user — append the token `[pb-done]`**; the hook reads it and stops pinging. If there is still pending work, do **not** append it (the hook will nudge you to continue). Don't end a "done / waiting" reply without it.
7. **No narration between steps.** Run each milestone as one uninterrupted flow: read the PLAN section → implement → run the shot tool → confirm **0 console errors + ≤150 draw calls** → open and look at the PNGs → update `PROGRESS.md` → `git commit -am "M<n>: <title>"` → `git push origin main` → next milestone. Chain tool calls silently.
   - **Never end a reply with an announcement** like "Now I'll implement the lockers…". If you say what you'll do next, make that tool call in the same reply. A reply without a tool call ends your turn and stops the work.

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
