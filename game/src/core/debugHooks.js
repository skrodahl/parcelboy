import * as THREE from 'three';
import { PARCEL } from '../data/config.js';

// §2.11 + M12a.5: the `window.__pb` debug hooks, extracted from main.js so the
// orchestration file stays small. `ctx` exposes the live module refs — the
// mutable ones as getters (so hooks always see the current value) and the
// stable constants/functions as plain properties — plus the mutators that
// write back into main.js state (stepSim, setPrevM, setSimPaused).
export function createDebugHooks(ctx) {
  const { events, gameState, M5_TARGETS, input, camTgt, camLook, camera, scene, renderer, progress, params } = ctx;
  const R = ctx; // alias so a `R.<ref>` read hits the ctx getter
  return {
    ready: false,
    stats: ctx.stats,
    // §2.20 (M12b): the world day clock + the Quickbox bench zone (shots set the
    // clock to specific times; the bench fast-forward is testable via holdF + step).
    get dayClock() { return R.dayClock; },
    setClock(min) { R.setClock && R.setClock(min); },
    get benchZone() { return R.benchZone; },
    get benchState() { return R.benchState; },
    audio() { const a = R.audio; return { muted: a.muted, lastSounds: a.lastSounds(), musicVol: a.musicVol, sfxVol: a.sfxVol }; },
    setAudioVol(musicVol, sfxVol) { const a = R.audio; if (musicVol != null) a.setMusicVol(musicVol); if (sfxVol != null) a.setSfxVol(sfxVol); },
    debugAudio() {
      events.emit('throw');
      events.emit('land');
      events.emit('delivery', { outcome: 'perfect', streak: 2, streakAfter: 3, multiplier: 2 });
      events.emit('streak', { multiplier: 2 });
      events.emit('restock');
      events.emit('results');
      return R.audio.lastSounds();
    },
    state() {
      const d = R.delivery, p = R.player;
      return {
        gameState: gameState.name,
        score: d ? d.scoring.score : 0,
        streak: d ? d.scoring.streak : 0,
        multiplier: d ? d.scoring.multiplier() : 1,
        carried: d ? d.carried : 0,
        remaining: d ? d.remaining() : 0,
        lastResult: d ? d.lastResult : null,
        time: R.simTime,
        player: p ? { x: p.pos.x, z: p.pos.z, heading: (p.heading * 180) / Math.PI, speed: p.speed } : { x: 0, z: 0, heading: 0, speed: 0 },
      };
    },
    setCam(name) { ctx.camPreset(name); },
    // frame an arbitrary world point (a close-up for the shots).
    camAt(wx, wz, dist, up) {
      const c = camera, cl = camLook;
      const d = dist || 12, u = up || 4.5;
      c.position.set(wx + d * 0.45, u, wz + d * 0.45);
      c.lookAt(wx, 1.3, wz);
      cl.set(wx, 1.3, wz);
      const dd = c.position.distanceTo(cl);
      if (scene && scene.fog) { scene.fog.near = dd + 45; scene.fog.far = dd + 150; }
    },
    // Free camera: sit at (px, up, pz) and look at (tx, 1.3, tz). For shots
    // that need a specific facing (e.g. a sign's back, which camAt's NE
    // vantage can't reach).
    camFree(px, pz, tx, tz, up) {
      const c = camera, cl = camLook;
      const u = up || 4.5;
      c.position.set(px, u, pz);
      c.lookAt(tx, 1.3, tz);
      cl.set(tx, 1.3, tz);
      const dd = c.position.distanceTo(cl);
      if (scene && scene.fog) { scene.fog.near = dd + 45; scene.fog.far = dd + 150; }
    },
    setTimeOfDay() {},
    teleport(tileX, tileZ, headingDeg) {
      const p = R.player;
      if (p) p.teleport(tileX, tileZ, headingDeg === undefined ? 0 : headingDeg);
    },
    press(action, ms) { input.press(action, ms); },
    // M15a.7: dispatch a DOM keydown + keyup (screens react to e.code, not the
    // input-action holds that press() drives). For cycling the select panels.
    pressKey(code) {
      window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
      window.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true }));
    },
    // §2.16: rotate the parcel stack (top → bottom), like the R key.
    cycle() { if (R.delivery) R.delivery.cycle(); },
    // §2.16: the top parcel's house + address (for the HUD-address shot).
    topParcel() {
      const t = R.delivery ? R.delivery.topParcel() : null;
      return t ? { house: t.house.id, num: t.house.num, street: t.house.street, pkg: t.pkg.name, x: t.doormat.x, z: t.doormat.z } : null;
    },
    // §2.17: the locker full/empty state + positions.
    lockerState() {
      const d = R.delivery;
      if (!d || !d.lockerState) return [];
      return d.lockerState.map((st, i) => ({ i, full: st.full, wx: d.lockerBodies[i].wx, wz: d.lockerBodies[i].wz }));
    },
    // §2.17: the locker positions + state (free roam or a shift).
    lockers() {
      const w = R.world;
      if (!w || !w.lockerBodies) return [];
      const d = R.delivery;
      return w.lockerBodies.map((b, i) => ({ i, wx: b.wx, wz: b.wz, full: d ? d.lockerState[i].full : true }));
    },
    // §2.17: view a locker (frame the cabinet with a fixed close-up cam).
    lockerView(i) {
      const w = R.world;
      if (!w || !w.lockerBodies[i]) return;
      const b = w.lockerBodies[i];
      this.camAt(b.wx, b.wz, 11, 4.2);
    },
    // §2.16: throw the top parcel at the nearest OTHER target → "Wrong address!".
    wrongAddressDemo() {
      const d = R.delivery, p = R.player, w = R.world;
      if (!d || !p || !w) return null;
      const top = d.topParcel();
      if (!top) return null;
      let other = null, bd = Infinity;
      for (const t of d.targets) {
        if (!t.delivered && t !== top) {
          const dx = t.doormat.x - top.doormat.x, dz = t.doormat.z - top.doormat.z;
          const dd = dx * dx + dz * dz;
          if (dd < bd) { bd = dd; other = t; }
        }
      }
      if (!other) return null;
      const T = w.tilemap.tileSize;
      p.teleport(Math.floor(top.doormat.x / T), Math.floor(top.doormat.z / T), 0);
      d.parcels.throwParcel({ x: p.pos.x, y: PARCEL.throwHeight, z: p.pos.z }, { x: other.doormat.x, z: other.doormat.z }, { pkg: top.pkg, target: top, airMail: false });
      // stand at the landing (the other target's porch) + face the top target, so
      // the follow cam shows the "Wrong address!" popup + the lost parcel.
      const a = Math.atan2(top.doormat.x - other.doormat.x, -(top.doormat.z - other.doormat.z));
      p.teleport(Math.floor(other.doormat.x / T), Math.floor(other.doormat.z / T), (a * 180) / Math.PI);
      return { top: top.house.id, other: other.house.id, x: other.doormat.x, z: other.doormat.z };
    },
    // §2.17: force a locker to restock + go empty (for the empty-state shot).
    emptyLocker(i) {
      const d = R.delivery, w = R.world;
      if (!d || !d.lockerBodies[i]) return;
      d.restock();
      if (d.lockerState[i]) d.lockerState[i].full = false;
      if (w.lockers) w.lockers.setEmpty(i);
    },
    // §2.16/§10: step the sim until every thrown parcel has come to rest. A
    // paused run doesn't age the shared float text (only __pb.step does), so
    // the result float ("Wrong address!") is fresh (life ~0) when this returns
    // — the shot then grows it with stepFloat() + frames it with camAt().
    settleParcel(maxSteps) {
      const d = R.delivery; if (!d || !d.parcels) return 0;
      const ps = d.parcels.parcels;
      const max = maxSteps || 300; let n = 0;
      for (; n < max; n++) {
        let active = false;
        for (let i = 0; i < ps.length; i++) { const st = ps[i].state; if (st !== 'idle' && st !== 'resting') { active = true; break; } }
        if (!active) break;
        ctx.stepSim(1);
      }
      return n;
    },
    throwAt(tileX, tileZ) {
      const d = R.delivery, p = R.player;
      if (!d || !p) return;
      const aim = d.targeting.pointAim(tileX, tileZ, p, d.topParcel(), d.throwRange, d.accuracy);
      d.doThrow(aim);
    },
    throwRaw(wx, wz) {
      const d = R.delivery, p = R.player;
      if (!d || !p) return;
      // §2.16: the parcel thrown is always the top one (addressed to its target);
      // where it lands decides the outcome.
      const target = d.topParcel();
      d.parcels.throwParcel({ x: p.pos.x, y: PARCEL.throwHeight, z: p.pos.z }, { x: wx, z: wz }, { pkg: target ? target.pkg : null, target, airMail: p.pos.y > 0.05 });
    },
    debugParcels() {
      const d = R.delivery;
      if (!d) return [];
      return d.parcels.parcels.map((pp) => ({ s: pp.state, x: +pp.mesh.position.x.toFixed(1), z: +pp.mesh.position.z.toFixed(1), y: +pp.mesh.position.y.toFixed(1), vis: pp.mesh.visible, target: pp.target ? pp.target.house.id : null, mh: pp.mailHit || false }));
    },
    debugRoofs() {
      const w = R.world;
      if (!w) return [];
      return w.colliders.filter((c) => c.type === 'box' && c.h && c.h < 8).map((c) => ({ minZ: c.minZ, maxZ: c.maxZ, minX: c.minX, maxX: c.maxX, h: +c.h.toFixed(2) }));
    },
    debugZones() {
      const w = R.world;
      if (!w) return null;
      const T = w.tilemap.tileSize;
      const tile = (o) => [Math.floor(o.x / T), Math.floor(o.z / T)];
      return {
        doormats: M5_TARGETS.map((id) => ({ id, x: w.doormatPoints[id].x, z: w.doormatPoints[id].z, tile: tile(w.doormatPoints[id]) })),
        pond: w.def.pond,
        mailboxes: (w.mailboxes || []).slice(0, 3).map((m) => [ +m[0].toFixed(1), +m[1].toFixed(1) ]),
        roadTiles: w.def.roads.map((r) => ({ name: r.name, axis: r.axis, at: r.at, tile: [r.at, r.axis === 'z' ? r.at : 0] })),
      };
    },
    step(frames) { ctx.stepSim(frames); },
    debugHazards() {
      const h = R.hazards;
      if (!h) return null;
      return {
        cars: h.cars.length, dogs: h.dogs, skaters: h.skaters, hives: h.hives, bins: h.bins, cones: h.cones,
        hiveStates: h.hiveSt ? h.hiveSt.map((hs) => hs.state) : [],
        dogStates: h.dogSt ? h.dogSt.map((ds) => ds.state) : [],
        dogSteal: h.dogSt ? h.dogSt.map((ds) => ds.stealT) : [],
      };
    },
    // M15: the runaway-bin states (x,z,home,rolling flag) so a shot can frame
    // one mid-roll; `kickBin(i)` forces bin i into its rolling state now.
    debugRunaway() {
      const h = R.hazards;
      if (!h || !h.runSt) return [];
      return h.runSt.map((r) => ({ x: +r.x.toFixed(1), z: +r.z.toFixed(1), hx: +r.hx.toFixed(1), hz: +r.hz.toFixed(1), rolling: r.state === 1 }));
    },
    // M15a.5: skater positions (x,z) so a shot can frame one mid-run to check
    // the board points along its direction of travel.
    debugSkaters() {
      const h = R.hazards;
      if (!h || !h.skSt) return [];
      return h.skSt.map((s, i) => ({ i, x: +(s.x || 0).toFixed(1), z: +(s.z || 0).toFixed(1) }));
    },
    kickBin(i) {
      const h = R.hazards;
      if (!h || !h.runSt || !h.runSt[i]) return -1;
      const r = h.runSt[i];
      r.state = 1; r.vx = 0; r.vz = 0.4; r.t = 4; r.roll = 0;
      return i;
    },
    debugPlayer() {
      const p = R.player;
      if (!p) return null;
      return {
        x: +p.pos.x.toFixed(1), z: +p.pos.z.toFixed(1), y: +p.pos.y.toFixed(2),
        immune: p.knockdownImmune, dogFriendly: p.dogFriendly,
      };
    },
    debugBees() {
      const h = R.hazards;
      if (!h) return null;
      return { swarms: h.hiveSt.map((hs) => ({ cx: +hs.cx.toFixed(1), cz: +hs.cz.toFixed(1), state: hs.state })) };
    },
    startShift(id) { ctx.startShift(id); },
    gotoFreeRoam() { ctx.gotoFreeRoam(); },
    angerBees() { const h = R.hazards; if (h) h.angersSwarmAt(h.hiveSt[0].x, h.hiveSt[0].z); },
    setCamDist(h, v) {
      const fc = R.followCam, p = R.player;
      if (!fc || !p) return;
      camTgt.pos = p.pos; camTgt.heading = p.heading;
      fc.setDist(h, v);
      fc.snap(camTgt, camLook);
    },
    // §12.1: point the camera at a world spot (a "porch-style close camera").
    // The cam position is given explicitly (camX, camZ, up) so a shot can approach
    // a target from whichever side is clear. Set after the last step in a paused
    // shot so the follow-cam doesn't override it.
    aimAt(wx, wz, camX, camZ, up) {
      camera.position.set(camX, up, camZ);
      camLook.set(wx, 1.5, wz);
      camera.lookAt(camLook.x, camLook.y, camLook.z);
      const d = camera.position.distanceTo(camLook);
      if (scene.fog) { scene.fog.near = d + 45; scene.fog.far = d + 150; }
      camera.far = Math.max(220, d + 260);
      camera.updateProjectionMatrix();
    },
    freeRoam() { const m = R.mission; if (m) ctx.endShift(false); },
    setWaypoint(tileX, tileZ) { const rd = R.radar; if (rd) rd.setWaypoint(tileX, tileZ); },
    abandonMission() { const m = R.mission; if (m) ctx.endShift(false); },
    setHeat(n) { const ht = R.heat; if (ht) ht.add(n); },
    heat(n) { const ht = R.heat; if (ht) ht.add(n); },
    bowl(x, z) { const am = R.ambient; if (am) am.forceBowl(x, z, 3, 2); },
    strike() { ctx.onStrike(); },
    bust() { ctx.onBusted(0); },
    crashGrump() { const mi = R.mischief; if (mi && mi.grumps[0]) mi.forceBreak(mi.grumps[0], 'window'); },
    goto(name) { ctx.routeScreen(name, params); },
    openScreen(name, opts) { const s = R.screens; if (s) s.show(name, opts); },
    openPause() { const s = R.screens; if (s) { s.buildPause(); s.show('pause'); } ctx.setSimPaused(true); },
    closeScreens() { const s = R.screens; if (s) s.close(); },
    buyChar(id) { return progress.buy(R.charRegistry.get(id)); },
    buyVeh(id) { return progress.buy(R.vehRegistry.get(id)); },
    setCoins(n) { progress.data.coins = n | 0; ctx.refreshCoins(); progress.save(); },
    // M10: the save-backed progression + Golden Parcels + the day cycle (shots/DoD).
    progression() {
      return {
        coins: progress.coins, stars: progress.stars, golden: progress.totalGolden(),
        goldenUnlocked: progress.goldenBikeUnlocked(), unlocked: progress.data.unlocked,
        best: progress.data.best, last: progress.data.last, settings: progress.data.settings,
      };
    },
    // M15a.1: golden finds are per-suburb; the hooks act on the current suburb.
    setGolden(n) { const nb = R.world ? R.world.def.id : 'maple-hollow'; for (let i = 0; i < (n | 0); i++) progress.foundGolden(nb, i); ctx.refreshGolden(nb); return progress.goldenCount(nb); },
    collectGolden(i) { const c = R.collectibles; if (c) c.collect(i | 0); const nb = R.world ? R.world.def.id : 'maple-hollow'; ctx.refreshGolden(nb); return progress.goldenCount(nb); },
    // M15a.1: read the current suburb's found set + whether the collectibles hide them.
    goldenFound() {
      const c = R.collectibles, w = R.world, nb = w ? w.def.id : null;
      if (!nb) return null;
      return { nb, found: progress.foundSet(nb), total: (w.def.goldenParcels || []).length, hidden: c ? w.def.goldenParcels.filter((_, i) => c.found(i)).length : -1 };
    },
    // M15a.8: place the player at a marker and show its world-anchored prompt
    // (the next sim step's proximity edge calls setNear; step() then pins it).
    nearMarker(id) { const mk = R.markers, p = R.player; const m = mk && mk.byId[id]; if (m && p) { p.pos.x = m.x; p.pos.z = m.z; ctx.setPrevM(null); } if (R.actionStrip) R.actionStrip.setNear(id); return m ? id : null; },
    // M15a.8: open the shared action strip for a marker (teleports + setNear + open).
    openStrip(id, opts) {
      const mk = R.markers, p = R.player; const m = mk && mk.byId[id];
      if (m && p) { p.pos.x = m.x; p.pos.z = m.z; }
      if (R.actionStrip) { R.actionStrip.setNear(id); R.actionStrip.openStrip(Object.assign({ id }, opts || {})); }
      ctx.setPrevM(id);
      return m ? id : null;
    },
    // M15a.8: stand by a marker so its prompt shows (nothing else open).
    showPrompt(id) { this.nearMarker(id); return id; },
    openMarker(id) { return this.openStrip(id); },
    setTod(i, frac) { const dc = R.dayCycle; if (dc) dc.setPhase(i | 0, frac == null ? 0 : frac); return dc ? dc.phase : null; },
    debugGolden() {
      const c = R.collectibles, w = R.world;
      if (!c || !w) return null;
      const T = w.tilemap.tileSize;
      const g0 = (w.def.goldenParcels || [])[0] || [0, 0];
      const wx = g0[0] * T + T / 2, wz = g0[1] * T + T / 2;
      const v = new THREE.Vector3(wx, 0.9, wz).project(camera);
      const wpx = renderer.domElement.clientWidth, hpx = renderer.domElement.clientHeight;
      return { world: [wx, wz], screen: [Math.round((v.x * 0.5 + 0.5) * wpx), Math.round((-v.y * 0.5 + 0.5) * hpx)], z: +v.z.toFixed(2), cam: [Math.round(camera.position.x), Math.round(camera.position.y), Math.round(camera.position.z)], vw: wpx, vh: hpx };
    },
    syncFloat() { const ft = R.sharedFloatText; if (ft) ft.sync(); return true; },
    stepFloat() { const ft = R.sharedFloatText; if (ft) ft.step(1 / 60); if (ft) ft.sync(); return true; },
    boing(i) {
      const p = R.player, w = R.world;
      if (!p || !w) return false;
      const spots = ((w.def.gagSpots || {}).trampoline || []);
      if (!spots.length) return false;
      const idx = ((i == null ? 0 : i) | 0) % spots.length;
      const [tx, tz] = spots[idx];
      p.teleport(tx, tz, 90);
      p.boing();
      return true;
    },
    handlebars() {
      const p = R.player;
      if (!p) return false;
      p.teleport(11, 17, 0); // a clear stretch of Maple Avenue
      p.handlebars();
      return true;
    },
    scatterBirds() { const am = R.ambient; if (am) am.scatterBirds(); return am ? am.birds.length : 0; },
    debugAmbient() {
      const am = R.ambient, w = R.world;
      if (!am || !w) return null;
      const r1 = (n) => Math.round(n * 10) / 10;
      return {
        alive: am.aliveCount, walkers: am.walkers.length, birds: am.birds.length,
        butterflies: am.butterflies.length, ducks: am.ducks.length, kids: am.kids.length,
        walkerPos: am.walkers.map((wk) => [r1(wk.x), r1(wk.z), wk.state]),
        birdPos: am.birds.map((bd) => [r1(bd.x), r1(bd.z), bd.state]),
      };
    },
    speedLines() { const p = R.player, se = R.sharedEffects; if (!p || !se) return false; se.speedLines(p.pos.x, p.pos.z, Math.sin(p.heading) * 9, -Math.cos(p.heading) * 9); return true; },
    celebrate() { const p = R.player, se = R.sharedEffects; if (!p || !se) return false; se.celebrate(p.pos.x, 1, p.pos.z); return true; },
    autoplay() { return ctx.autoplayRun(); },
    debugCars() { const h = R.hazards; return h ? h.carDebug() : []; },
    playerPos() { const p = R.player; return p ? [ +p.pos.x.toFixed(2), +p.pos.z.toFixed(2) ] : null; },
    holdF(on) { input.forceHeld('doorstep', !!on); return !!on; },
    playerTeleportWorld(x, z) {
      const p = R.player, w = R.world;
      if (!p || !w) return false;
      const T = w.tilemap.tileSize;
      p.teleport(Math.floor(x / T), Math.floor(z / T), 0);
      return true;
    },
    // M12 soak test: run `times` autoplay shifts of `shiftId` and return their
    // scores + the star the current thresholds award each. Used to tune the stars.
     soak(shiftId, times) {
      const runs = [];
      for (let i = 0; i < (times || 3); i++) {
        // §2.20: start the shift at the open of its window (main) so the autoplayer
        // has the full window; side missions run from the current clock.
        const sh = ctx.shifts && ctx.shifts.find((s) => s.id === shiftId);
        if (sh && ctx.setClock) ctx.setClock(sh.kind === 'side' ? 400 : sh.window[0]);
        ctx.startShift(shiftId);
        const out = ctx.autoplayRun();
        const r = out && out.res;
        runs.push({ score: r ? r.score : 0, stars: r ? r.stars : 0, delivered: r ? r.delivered : 0, total: r ? r.total : 0, timeBonus: r ? r.timeBonus : 0, success: r ? r.success : false });
        ctx.gotoFreeRoam();
      }
      return runs;
    },
    nextTarget() {
      const d = R.delivery;
      if (!d) return null;
      // §2.16: the next throw is the top parcel's house.
      const t = d.topParcel();
      return t ? [t.doormat.x, t.doormat.z] : null;
    },
    useAbility() { const ab = R.abilities; return ab ? ab.use() : false; },
    debugAbility() {
      const p = R.player, ab = R.abilities;
      if (!p) return null;
      const st = p.stack;
      return {
        name: ab ? ab.name : null,
        active: ab ? ab.active : null,
        ready: ab ? ab.ready : false,
        coolFrac: ab ? +ab.coolFrac().toFixed(2) : 0,
        speedMul: st.speedMul, turnWobble: st.turnWobble,
        knockdownImmune: st.knockdownImmune, perfectThrows: st.perfectThrows, charmActive: st.charmActive,
        dogFriendly: p.dogFriendly,
      };
    },
    debugMischief() {
      const mi = R.mischief, ht = R.heat, wt = R.watch, am = R.ambient;
      return {
        grumps: mi ? mi.grumps : [],
        heat: ht ? +ht.heat.toFixed(2) : 0,
        level: ht ? ht.level : 0,
        watchActive: wt ? wt.active : 0,
        watchPos: wt ? wt.positions.map((pp) => [+pp.x.toFixed(1), +pp.z.toFixed(1)]) : [],
        walkers: am ? am.walkers.slice(0, 4).map((wk) => [+wk.x.toFixed(1), +wk.z.toFixed(1), wk.state]) : [],
        broken: mi ? mi.brokenCount : 0,
        bowled: am ? am.bowledTotal : 0,
        strikes: am ? am.strikes : 0,
      };
    },
    // §2.18: the multi-neighborhood engine. `gotoNeighborhood(id, exitId)`
    // travels to a suburb (exits are the in-world way; `id` alone is the debug
    // shortcut). `gpuInfo()` snapshots renderer.info for the round-trip leak
    // check (counts must return to the same values).
    gotoNeighborhood(nbId, exitId) { R.gotoNeighborhood && R.gotoNeighborhood(nbId, exitId); },
    // §2.18: hold the transition sign card up for a shot (m14-exit-sign).
    holdTransition(title, blurb) { const t = R.transition; t && t.hold(title, blurb); },
    releaseTransition() { const t = R.transition; t && t.release(); },
    gpuInfo() {
      const i = renderer.info;
      return {
        drawCalls: i.render.calls,
        geometries: i.memory.geometries,
        textures: i.memory.textures,
        triangles: i.render.triangles,
      };
    },
    get currentNeighborhood() { return R.world ? R.world.def.id : null; },
  };
}
