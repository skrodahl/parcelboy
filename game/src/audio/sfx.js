// §9: the SFX synth kit. Every sound is synthesized (no files). Nodes are
// created per sound (fine — sounds are rare). Two primitives: `tone` (an
// oscillator with a short ADSR + optional pitch slide) and `noise` (a
// white-noise buffer through a filter, with an optional band sweep). Everything
// routes to the sfx bus. `play(name)` logs to the manager for the ?debug=1
// overlay; when muted the master gain is 0 so nothing is audible (but the id is
// still logged as "triggered").

// mgr = { ensure(), muted, sfxBus() } from audio.js.
export function createSfx(mgr) {
  function env(node, t0, attack, decay, gain) {
    const g = node.gain;
    g.setValueAtTime(0.0001, t0);
    g.exponentialRampToValueAtTime(gain, t0 + attack);
    g.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
  }
  function tone({ freq = 440, type = 'sine', atk = 0.01, dec = 0.15, gain = 0.3, slideTo = 0, pan = 0 }) {
    const ctx = mgr.ensure(); const t0 = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slideTo > 0) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + atk + dec);
    const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (p) { p.pan.value = pan; o.connect(p); p.connect(mgr.sfxBus()); } else o.connect(mgr.sfxBus());
    env(o, t0, atk, dec, gain);
    o.start(t0); o.stop(t0 + atk + dec + 0.05);
    return o;
  }
  let noiseBuf = null;
  function noiseBufFor(ctx) {
    if (noiseBuf) return noiseBuf;
    const b = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noiseBuf = b; return b;
  }
  function noise({ dur = 0.2, filter = 'bandpass', freq = 1200, q = 1, gain = 0.3, sweepTo = 0, pan = 0 }) {
    const ctx = mgr.ensure(); const t0 = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = noiseBufFor(ctx);
    const f = ctx.createBiquadFilter(); f.type = filter; f.frequency.setValueAtTime(freq, t0); f.Q.value = q;
    if (sweepTo > 0) f.frequency.exponentialRampToValueAtTime(sweepTo, t0 + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(gain, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    src.connect(f); f.connect(g); if (p) { p.pan.value = pan; g.connect(p); p.connect(mgr.sfxBus()); } else g.connect(mgr.sfxBus());
    src.start(t0); src.stop(t0 + dur + 0.02);
  }
  function arp(freqs, step = 0.06, type = 'triangle', gain = 0.3) {
    const ctx = mgr.ensure(); const t0 = ctx.currentTime;
    for (let i = 0; i < freqs.length; i++) {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = freqs[i];
      const g = ctx.createGain(); const t = t0 + i * step;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + step + 0.05);
      o.connect(g); g.connect(mgr.sfxBus()); o.start(t); o.stop(t + step + 0.06);
    }
  }
  // note freqs (Hz)
  const N = { C6: 1047, E6: 1319, G6: 1568, C7: 2093, E5: 659, C5: 523, G4: 392, E4: 330, C4: 262, D5: 587, G5: 784 };

  // §9 named sounds. Each is a closure over the kit; a data arg may add flavor.
  const S = {
    throw: () => noise({ dur: 0.18, freq: 800, q: 1.5, gain: 0.28, sweepTo: 2400, filter: 'bandpass' }),
    land: () => { tone({ freq: 110, type: 'sine', dec: 0.12, gain: 0.3, slideTo: 60 }); noise({ dur: 0.08, freq: 500, filter: 'lowpass', gain: 0.2 }); },
    perfect: () => arp([N.C6, N.E6, N.G6, N.C7], 0.06, 'triangle', 0.3),
    nice: () => arp([N.C5, N.G5], 0.07, 'triangle', 0.28),
    sloppy: () => tone({ freq: 500, type: 'sawtooth', dec: 0.25, gain: 0.18, slideTo: 300 }),
    doorbell: () => { arp([N.E5, N.C5], 0.14, 'sine', 0.3); },
    streak: (data) => { const m = data && data.multiplier ? data.multiplier : 1; tone({ freq: 500 + (m - 1) * 200, type: 'square', atk: 0.01, dec: 0.12, gain: 0.16, slideTo: 900 + (m - 1) * 200 }); },
    knockdown: () => { tone({ freq: 500, type: 'sawtooth', dec: 0.3, gain: 0.22, slideTo: 90 }); noise({ dur: 0.12, freq: 400, filter: 'lowpass', gain: 0.15 }); },
    bonk: () => { tone({ freq: 220, type: 'sine', dec: 0.09, gain: 0.3, slideTo: 120 }); },
    splash: () => { noise({ dur: 0.4, freq: 1200, q: 0.7, gain: 0.3, sweepTo: 200, filter: 'lowpass' }); },
    splat: () => { noise({ dur: 0.14, freq: 900, filter: 'lowpass', gain: 0.3 }); tone({ freq: 200, type: 'sine', dec: 0.12, gain: 0.2, slideTo: 70 }); },
    boing: () => tone({ freq: 300, type: 'sine', atk: 0.02, dec: 0.5, gain: 0.28, slideTo: 70 }),
    zip: () => tone({ freq: 400, type: 'square', atk: 0.005, dec: 0.14, gain: 0.16, slideTo: 1400 }),
    star: () => arp([N.E5, N.G5, N.C7], 0.05, 'triangle', 0.3),
    // mischief (§2.15)
    crash: () => { noise({ dur: 0.35, freq: 2400, q: 0.6, gain: 0.3, filter: 'highpass' }); for (let i = 0; i < 6; i++) setTimeout(() => tone({ freq: 2200 + Math.random() * 1600, type: 'sine', dec: 0.15, gain: 0.14 }), i * 45); },
    strike: () => { for (let i = 0; i < 5; i++) setTimeout(() => noise({ dur: 0.05, freq: 700 + i * 200, q: 3, gain: 0.28, filter: 'bandpass' }), i * 60); },
    whistle: () => { tone({ freq: 2800, type: 'sine', atk: 0.02, dec: 0.4, gain: 0.18 }); },
    grumble: () => { noise({ dur: 0.5, freq: 300, q: 4, gain: 0.22, filter: 'bandpass', sweepTo: 200 }); },
    busted: () => arp([N.E4, N.C4, N.C4 * 0.75], 0.16, 'square', 0.28),
    alarm: () => { for (let i = 0; i < 4; i++) setTimeout(() => tone({ freq: 600, type: 'square', atk: 0.05, dec: 0.2, gain: 0.14, slideTo: 1200 }), i * 300); },
    horn: () => { tone({ freq: 400, type: 'square', dec: 0.22, gain: 0.18 }); tone({ freq: 430, type: 'square', dec: 0.22, gain: 0.14 }); },
    bark: () => { tone({ freq: 600, type: 'square', atk: 0.005, dec: 0.1, gain: 0.22, slideTo: 250 }); setTimeout(() => tone({ freq: 560, type: 'square', atk: 0.005, dec: 0.1, gain: 0.2, slideTo: 240 }), 90); },
    restock: () => { tone({ freq: 160, type: 'sine', dec: 0.1, gain: 0.24, slideTo: 90 }); noise({ dur: 0.1, freq: 1000, filter: 'bandpass', gain: 0.18 }); },
    uiClick: () => tone({ freq: 700, type: 'square', atk: 0.005, dec: 0.05, gain: 0.12 }),
    hop: () => tone({ freq: 700, type: 'triangle', atk: 0.01, dec: 0.1, gain: 0.18, slideTo: 1100 }),
    golden: () => arp([N.C6, N.G6, N.E6, N.C7, N.E6, N.C7], 0.05, 'triangle', 0.28),
    // §2.20: the Quickbox bench's fast-forward ticking-clock blip.
    tick: () => tone({ freq: 1900, type: 'sine', atk: 0.004, dec: 0.06, gain: 0.12 }),
  };

  function play(name, data) {
    const fn = S[name];
    if (!fn) return;
    if (!mgr.muted) { try { fn(data); } catch (e) { /* a synth glitch must never break the sim */ } }
    mgr.logSound(name);
  }
  return { play };
}
