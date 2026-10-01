import { SCORING } from '../data/config.js';

// §2.4 judging. The outcome is decided by where the parcel rests (parcels.js);
// this module turns that into points + streak and applies the package rules
// (§2.5). `createScoring()` owns the running score/streak for one session.

// Floating-text label + color per outcome (§10: PERFECT gold, Nice teal,
// Sloppy grey, miss/wrong red).
const LABEL = {
  perfect: { text: 'PERFECT!', color: '#ffd166' },
  nice:    { text: 'Nice!', color: '#00b4a6' },
  lucky:   { text: 'Lucky!', color: '#ffd166' },
  sloppy:  { text: 'Sloppy…', color: '#8d99ae' },
  doorstep:{ text: 'Signed for!', color: '#00b4a6' },
  wrong:   { text: 'Wrong house!', color: '#e63946' },
  road:    { text: 'In the road!', color: '#e63946' },
  splash:  { text: 'Splash!', color: '#4cc9f0' },
  roof:    { text: 'On the roof!', color: '#e63946' },
  missed:  { text: 'Missed!', color: '#e63946' },
  broken:  { text: 'Broken!', color: '#e63946' },
};
const SPLAT = { text: 'SPLAT!', color: '#ff8fab' };

// Which outcomes grow the streak, which keep it, which reset it.
const STREAK_UP = { perfect: true, nice: true, lucky: true };
const STREAK_KEEP = { doorstep: true, lucky: true };
// Positive outcomes that earn the multiplier.
const MULTIPLICABLE = { perfect: true, nice: true, lucky: true, sloppy: true, doorstep: true };

// §11.4 rule handlers, selected by rule key so a new key needs one new entry.
// Each handler mutates `ctx` = { pkg, outcome, points, throw: {dist, impact}, timeFrac, splat }.
const RULES = {
  breakDistance(pkg, ctx) {
    const r = pkg.rules;
    const safe = ctx.outcome === 'perfect' || ctx.outcome === 'doorstep';
    if (!safe && (ctx.throw.dist > r.breakDistance || ctx.throw.impact > r.breakImpact)) {
      ctx.outcome = 'broken';
      ctx.splat = !!r.splat; // cake → pink frosting burst
    }
  },
  doorstepBonus(pkg, ctx) {
    if (ctx.outcome === 'doorstep') ctx.points += pkg.rules.doorstepBonus;
  },
  expressBonus(pkg, ctx) {
    // §2.5: +100 if delivered within the first half of the shift. M5's interim
    // session has no timer (timeFrac 0), so an express parcel always qualifies.
    if (MULTIPLICABLE[ctx.outcome] && ctx.timeFrac < 0.5) ctx.points += pkg.rules.expressBonus;
  },
};

export function createScoring() {
  let score = 0;
  let streak = 0;

  function multiplier() {
    return Math.min(SCORING.multMax, 1 + SCORING.multPer * Math.floor(streak / SCORING.multStep));
  }

  // pkg = data/packages.js entry; outcome = resting outcome;
  // info = { dist, impact, airMail, timeFrac }. Returns a result record.
  function judge(pkg, outcome, info) {
    const r = { outcome, points: SCORING[outcome] || 0, label: (LABEL[outcome] || LABEL.missed).text, color: (LABEL[outcome] || LABEL.missed).color, splat: false, streak };
    // Bonuses (§2.4), added to the base before the multiplier.
    if (MULTIPLICABLE[r.outcome]) {
      if (info.airMail) r.points += SCORING.airMail;
      if (info.dist > SCORING.longShotDist) r.points += SCORING.longShot;
    }
    // Package rules may rewrite the outcome (e.g. fragile → broken) or add points.
    const ctx = { pkg, outcome: r.outcome, points: r.points, throw: { dist: info.dist, impact: info.impact }, timeFrac: info.timeFrac || 0, splat: false };
    for (const key of Object.keys(pkg.rules)) {
      const h = RULES[key];
      if (h) h(pkg, ctx);
    }
    if (ctx.splat) r.splat = true;
    if (ctx.outcome !== r.outcome) {
      r.outcome = ctx.outcome;
      r.points = ctx.outcome === 'broken' ? 0 : ctx.points;
      r.label = r.splat ? SPLAT.text : LABEL[ctx.outcome].text;
      r.color = r.splat ? SPLAT.color : LABEL[ctx.outcome].color;
      r.outcomeChanged = true;
    } else {
      r.points = ctx.points;
    }
    // Multiplier on positive deliveries only.
    if (MULTIPLICABLE[r.outcome] && !r.outcomeChanged) r.points = Math.round(r.points * multiplier());
    // Streak.
    if (STREAK_UP[r.outcome]) streak++;
    else if (STREAK_KEEP[r.outcome]) { /* kept, not increased */ }
    else streak = 0;
    score += r.points;
    r.streakAfter = streak;
    r.multiplier = multiplier();
    r.scoreAfter = score;
    return r;
  }

  // A doorstep delivery is judged directly (no flight): safe, keeps streak.
  function doorstep(pkg, info) {
    return judge(pkg, 'doorstep', info || {});
  }

  // A raw points award (gags like STRIKE! / Hop! / the mischief bounces add a
  // flat amount outside the normal judging pipeline).
  function add(n) { score += n; }

  function reset() { score = 0; streak = 0; }
  // A lost parcel (a knockdown drop or a dog steal) breaks the streak (§2.6/§2.12).
  function breakStreak() { streak = 0; }

  return {
    judge,
    doorstep,
    add,
    reset,
    breakStreak,
    get score() { return score; },
    get streak() { return streak; },
    multiplier,
  };
}
