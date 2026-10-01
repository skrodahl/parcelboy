import { createSfx } from './sfx.js';
import { createMusic } from './music.js';

// §9: one AudioContext (created/resumed on the first user input), with a
// master → (music, sfx, ambience) bus tree. Mute sets master to 0; `?mute=1`
// starts muted. `suspend()` on hidden tab, `resume()` when visible again.
// Composes the SFX kit + the music loop + a light ambience, and subscribes to
// the game's event bus so gameplay code never imports audio.

export function createAudio({ events, muted = false, musicVol = 0.35, sfxVol = 0.8 } = {}) {
  let ctx = null, master, musicBus, sfxBus, ambBus;
  let musicRunning = false, menuMode = false;
  const lastSounds = [];

  function ensure() {
    if (ctx) return ctx;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.connect(ctx.destination);
    musicBus = ctx.createGain(); sfxBus = ctx.createGain(); ambBus = ctx.createGain();
    musicBus.connect(master); sfxBus.connect(master); ambBus.connect(master);
    musicBus.gain.value = musicVol; sfxBus.gain.value = sfxVol; ambBus.gain.value = 0.5;
    return ctx;
  }
  const mgr = {
    ensure,
    sfxBus: () => ensure() ? sfxBus : null,
    musicBus: () => ensure() ? musicBus : null,
    get muted() { return muted; },
    logSound(id) { lastSounds.push(id); if (lastSounds.length > 5) lastSounds.shift(); },
  };
  const sfx = createSfx(mgr);
  const music = createMusic(mgr);

  // -- ambience: light bird chirps + dusk crickets (a slow scheduler) --------
  let ambTimer = null;
  function chirp() {
    if (!ctx || muted) return;
    const t = ctx.currentTime; const f = 2200 + Math.random() * 1800;
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * 1.25, t + 0.06); o.frequency.exponentialRampToValueAtTime(f * 0.8, t + 0.18);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.08, t + 0.04); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g); g.connect(ambBus); o.start(t); o.stop(t + 0.25);
    ambTimer = setTimeout(chirp, 2000 + Math.random() * 4000);
  }

  // -- crickets (§9): a periodic filtered-noise burst, on only at dusk/golden.
  let cricketTimer = null, cricketOn = false;
  function cricket() {
    if (!ctx || muted || !cricketOn) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    const b = ctx.createBuffer(1, ctx.sampleRate * 0.06, ctx.sampleRate);
    const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    src.buffer = b;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 4200; f.Q.value = 8;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    src.connect(f); f.connect(g); g.connect(ambBus); src.start(t); src.stop(t + 0.07);
    cricketTimer = setTimeout(cricket, 320 + Math.random() * 260);
  }
  function toggleCrickets(on) {
    cricketOn = !!on;
    if (on && !cricketTimer && ctx) cricket();
    if (!on && cricketTimer) { clearTimeout(cricketTimer); cricketTimer = null; }
  }

  // -- bee buzz: one sawtooth per angry swarm (created on anger, stopped home)
  const buzzes = new Map();
  function startBuzz(id) {
    if (!ctx || buzzes.has(id)) return;
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 210;
    const trem = ctx.createOscillator(); trem.frequency.value = 18; const tg = ctx.createGain(); tg.gain.value = 30;
    trem.connect(tg); tg.connect(o.frequency);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
    const g = ctx.createGain(); g.gain.value = 0;
    o.connect(f); f.connect(g); g.connect(ambBus); o.start(); trem.start();
    buzzes.set(id, { o, trem, f, g });
  }
  function stopBuzz(id) {
    const b = buzzes.get(id); if (!b) return;
    b.g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
    setTimeout(() => { try { b.o.stop(); b.trem.stop(); } catch (e) {} }, 500);
    buzzes.delete(id);
  }

  // -- event wiring (gameplay emits; audio listens) --------------------------
  const hook = {
    throw: () => sfx.play('throw'),
    land: () => sfx.play('land'),
    bonk: () => sfx.play('bonk'),
    knockdown: () => sfx.play('knockdown'),
    restock: () => sfx.play('restock'),
    hop: () => sfx.play('hop'),
    boing: () => sfx.play('boing'),
    ability: () => sfx.play('zip'),
    streak: (d) => sfx.play('streak', d),
    delivery: (d) => {
      if (!d) return;
      const o = d.outcome;
      if (o === 'perfect') sfx.play('perfect');
      else if (o === 'nice' || o === 'good') sfx.play('nice');
      else if (o === 'doorstep') { sfx.play('doorbell'); sfx.play('nice'); }
      else if (o === 'sloppy') sfx.play('sloppy');
      if (d.splat) sfx.play('splat');
    },
    results: () => sfx.play('star'),
    golden: () => sfx.play('golden'),
    // mischief (§2.15)
    crash: () => sfx.play('crash'), strike: () => sfx.play('strike'),
    whistle: () => sfx.play('whistle'), grumble: () => sfx.play('grumble'),
    busted: () => sfx.play('busted'), alarm: () => sfx.play('alarm'), bark: () => sfx.play('bark'),
    buzzStart: (d) => startBuzz(d && d.id), buzzStop: (d) => stopBuzz(d && d.id),
  };
  const hooks = [];
  for (const name of Object.keys(hook)) { const fn = hook[name]; events.on(name, fn); hooks.push({ type: name, fn }); }

  // -- public API ------------------------------------------------------------
  return {
    unlock() { ensure(); if (ctx.state === 'suspended') ctx.resume(); if (!musicRunning) { music.start({ menu: menuMode }); musicRunning = true; } },
    startMusic(menu) { ensure(); menuMode = !!menu; music.stop(); music.start({ menu: menuMode }); musicRunning = true; },
    stopMusic() { music.stop(); musicRunning = false; },
    setMuted(m) { muted = !!m; if (master) master.gain.value = muted ? 0 : 1; },
    get muted() { return muted; },
    setMusicVol(v) { musicVol = v; if (musicBus) musicBus.gain.value = v; },
    setSfxVol(v) { sfxVol = v; if (sfxBus) sfxBus.gain.value = v; },
    suspend() { if (ctx && ctx.state === 'running') ctx.suspend(); },
    resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); },
    get musicVol() { return musicVol; },
    get sfxVol() { return sfxVol; },
    lastSounds: () => lastSounds.slice(),
    // the ambience chirp loop starts after the first unlock.
    beginAmbience() { if (!ambTimer) chirp(); },
    setCrickets(on) { toggleCrickets(on); },
    dispose() { for (const h of hooks) events.off(h.type, h.fn); if (ambTimer) clearTimeout(ambTimer); if (cricketTimer) clearTimeout(cricketTimer); music.stop(); },
  };
}
