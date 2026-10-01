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
    setTimeOfDay() {},
    teleport(tileX, tileZ, headingDeg) {
      const p = R.player;
      if (p) p.teleport(tileX, tileZ, headingDeg === undefined ? 0 : headingDeg);
    },
    press(action, ms) { input.press(action, ms); },
    throwAt(tileX, tileZ) {
      const d = R.delivery, p = R.player;
      if (!d || !p) return;
      const aim = d.targeting.pointAim(tileX, tileZ, p, d.targets, d.throwRange, d.accuracy);
      d.doThrow(aim);
    },
    throwRaw(wx, wz) {
      const d = R.delivery, p = R.player;
      if (!d || !p) return;
      let best = null, bd = Infinity;
      for (let i = 0; i < d.targets.length; i++) {
        const t = d.targets[i];
        if (t.delivered) continue;
        const dx = t.doormat.x - wx, dz = t.doormat.z - wz;
        const dist = dx * dx + dz * dz;
        if (dist < bd) { bd = dist; best = t; }
      }
      const target = best || d.nextUndelivered();
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
    setGolden(n) { for (let i = 0; i < (n | 0); i++) progress.foundGolden(i); ctx.refreshGolden(); return progress.totalGolden(); },
    collectGolden(i) { const c = R.collectibles; if (c) { c.collect(i | 0); ctx.refreshGolden(); } return progress.totalGolden(); },
    // M12a.1: place the player at a marker (the "walked up to it" position) so the
    // next sim step's proximity edge opens the card; or open the card directly.
    nearMarker(id) { const mk = R.markers, p = R.player; const m = mk && mk.byId[id]; if (m && p) { p.pos.x = m.x; p.pos.z = m.z; ctx.setPrevM(null); } return m ? id : null; },
    openMarker(id) {
      const mk = R.markers, s = R.screens;
      if (mk && mk.byId[id]) {
        if (id === 'locker') { s.show('selectCourier'); } else { ctx.openMarkerCard(id); }
        ctx.setPrevM(id);
      }
      return R.mcMarker || id;
    },
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
      const t = d.nextUndelivered();
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
  };
}
