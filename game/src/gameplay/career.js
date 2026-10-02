// M15a.13: the career ledger. A live `career` object inside the save, updated by
// LISTENING TO THE EXISTING EVENTS (delivery / knockdown / golden / busted / …),
// not by sprinkling counters through gameplay. Distance is a scratch number
// accumulated per frame (no allocation). The save is written at most every few
// seconds, or on shift end / quit — never per frame. Achievements are cheap
// tests over the ledger, run only when a counter changes.
import { ACHIEVEMENTS } from '../data/achievements.js';

const POSITIVE = { perfect: 1, nice: 1, sloppy: 1, doorstep: 1, lucky: 1 };
const CAUSE = { car: 'car', dog: 'dog', skater: 'skater', bin: 'bin', grump: 'grump', panic: 'bees', bees: 'bees' };

export function createCareer({ saveData, progress, events, suburbCount }) {
  const career = saveData.career;
  let flushTimer = 3;
  let achievementCb = null;

  function earnAchievements() {
    const earned = career.achievements;
    const env = { suburbCount: suburbCount || 3 };
    let fresh = null;
    for (const a of ACHIEVEMENTS) {
      if (earned.indexOf(a.id) >= 0) continue;
      if (a.test(career, env)) {
        earned.push(a.id);
        career.achievementDates[a.id] = new Date().toISOString().slice(0, 10);
        if (!fresh) fresh = [];
        fresh.push(a);
      }
    }
    if (fresh && fresh.length) { achievementCb && achievementCb(fresh); progress.save(); }
    return fresh;
  }

  // -- event listeners (the "counter change" points) --------------------------
  if (events) {
    events.on('delivery', (res) => {
      const o = res.outcome;
      if (POSITIVE[o]) { career.delivered++; career.outcomes[o]++; }
      if (o === 'wrong' || o === 'wrongAddress') career.wrongAddress++;
      if (res.splat) { career.splats++; }
      else if (res.cakeClean) career.cakesClean++;
      if (res.airMail) career.airMail++;
      if (res.streakAfter > career.bestStreak) career.bestStreak = res.streakAfter;
      earnAchievements();
    });
    events.on('golden', (g) => {
      if (g.nb) career.golden[g.nb] = Math.max(career.golden[g.nb] || 0, g.count || 0);
      earnAchievements();
    });
    events.on('bowled', () => { career.bowled++; earnAchievements(); });
    events.on('busted', () => {
      career.busted++;
      if (career.maxHeat < 3) career.maxHeat = 3;
      earnAchievements();
    });
    events.on('strike', () => { career.strikes++; earnAchievements(); });
    events.on('crash', () => { career.windows++; earnAchievements(); }); // a Grump front window broke
    events.on('boing', () => { career.trampoline++; earnAchievements(); });
    events.on('neighborhoodChange', (n) => {
      if (n && n.to && career.suburbs.indexOf(n.to) < 0) career.suburbs.push(n.to);
      earnAchievements();
    });
    events.on('knockdown', (k) => {
      const c = CAUSE[k && k.cause] || 'car';
      career.knockdowns[c]++;
      earnAchievements();
    });
    events.on('stolen', () => { career.stolen++; earnAchievements(); });
    events.on('recovered', () => { career.recovered++; earnAchievements(); });
    events.on('results', (res) => {
      if (!res) return;
      career.shifts++;
      if (res.coins) career.coins += res.coins;
      career.stars += res.stars || 0;
      if (res.success) { career.cleanMissions++; if (progress.difficultyId === 'holiday') career.holidayMissions++; }
      earnAchievements();
      progress.save(); // shift end: always persist the ledger
    });
  }

  // -- per-frame distance (scratch, no allocation) ----------------------------
  function tick(dt, vehId, speedMps) {
    if (vehId && speedMps > 0.1) {
      career.distance[vehId] = (career.distance[vehId] || 0) + speedMps * dt;
    }
    flushTimer -= dt;
    if (flushTimer <= 0) { flushTimer = 3; progress.save(); }
  }

  return {
    get career() { return career; },
    tick,
    flush() { progress.save(); },
    isEarned(id) { return career.achievements.indexOf(id) >= 0; },
    onAchievement(cb) { achievementCb = cb; },
    // For the Career page: every def + its earned state + date.
    list() {
      return ACHIEVEMENTS.map((a) => ({
        id: a.id, name: a.name, icon: a.icon, description: a.description,
        earned: career.achievements.indexOf(a.id) >= 0, date: career.achievementDates[a.id] || '',
      }));
    },
  };
}
