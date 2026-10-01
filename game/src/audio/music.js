// §9: a light, happy procedural loop at 112 BPM in C major. I–V–vi–IV with a
// triangle bass, a soft square lead (a fixed 4-bar melody) and a noise hi-hat.
// A 25 ms lookahead scheduler (schedule ~100 ms ahead) drives it; it stops when
// the game is paused or the tab is hidden. Runs a slower, sparser pattern in
// menus. musicVol defaults to 0.35 (set by the manager on the music bus).

// mgr = { ensure(), musicBus() } from audio.js.
export function createMusic(mgr) {
  const BPM = 112, SPB = 60 / BPM; // seconds per beat
  // I–V–vi–IV in C: roots + chord tones (freqs).
  const CHORDS = [
    [262, 330, 392], [392, 440, 523], [330, 392, 494], [349, 440, 523],
  ];
  const BASS = [131, 98, 165, 175];
  // A simple 4-bar melody (C major), 2 notes per beat, 0 = rest.
  const MELODY = [523, 587, 0, 659, 784, 659, 587, 523, 0, 587, 659, 0, 784, 880, 784, 659];
  let timer = null, on = false, menu = false;
  let nextTime = 0, step = 0;

  function schedNote(freq, t, type, gain, dur) {
    const ctx = mgr.ensure();
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(mgr.musicBus()); o.start(t); o.stop(t + dur + 0.02);
  }
  function hat(t) {
    const ctx = mgr.ensure();
    const src = ctx.createBufferSource();
    const b = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
    const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    src.buffer = b;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.08, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    src.connect(f); f.connect(g); g.connect(mgr.musicBus()); src.start(t); src.stop(t + 0.05);
  }
  function schedule() {
    const ctx = mgr.ensure();
    if (nextTime < ctx.currentTime) nextTime = ctx.currentTime + 0.05;
    const bar = Math.floor(step / 8) % 4, beat = step % 8;
    const spb = menu ? SPB * 1.5 : SPB;
    while (nextTime < ctx.currentTime + 0.1) {
      const t = nextTime;
      if (!menu && beat % 4 === 0) CHORDS[bar].forEach((f, i) => schedNote(f, t, 'triangle', 0.06, spb * 2));
      if (beat % 2 === 0) schedNote(BASS[bar], t, 'triangle', 0.22, spb * (menu ? 1.5 : 1));
      if (!menu) { const m = MELODY[step % MELODY.length]; if (m && (beat % 2 === 0 || menu)) schedNote(m, t, 'square', 0.05, spb * 0.9); }
      if (beat % 4 === 2) hat(t);
      nextTime += spb * 0.5; step++;
    }
  }
  function start(opts) {
    if (on) return;
    on = true; menu = !!(opts && opts.menu);
    const ctx = mgr.ensure();
    nextTime = ctx.currentTime + 0.1; step = 0;
    timer = setInterval(schedule, 25);
  }
  function stop() {
    on = false;
    if (timer) { clearInterval(timer); timer = null; }
  }
  function setMenu(menuMode) { menu = !!menuMode; }
  return { start, stop, setMenu, get running() { return on; } };
}
