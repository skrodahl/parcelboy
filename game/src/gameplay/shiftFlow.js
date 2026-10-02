import { MAIN_SHIFTS, SIDE_SHIFTS } from '../data/shifts.js';

// M12a.5: the free-roam dispatch / marker card + the results screen, extracted
// from main.js. These are the player-facing DOM flows (a card that pages through
// the main shifts at the dispatch marker, the side-mission card, the results
// screen). The card state lives here; the shift start/end core stays in
// main.js (it's tightly coupled to the world + player spawn). `ctx` provides the
// DOM helper, the registries/data, the shift-start functions, and the prevM
// edge the free-roam proximity uses.
export function createShiftFlow(ctx) {
  const { el, progress, startShift, endShift, events, setPrevM, getSharedEffects, getPlayer, getClock, fmtMin } = ctx;
  let markerCardEl = null, mcList = null, mcMarker = null, mcIdx = 0;
  let shiftCardEl = null, resultsEl = null;

  // §2.18: the dispatch card at a suburb's kiosk lists only THAT suburb's main
  // shifts (each carries a `neighborhood`). `ctx.getNb()` is the loaded suburb id.
  function mcShifts(id) {
    if (id === 'dispatch') {
      const nb = ctx.getNb ? ctx.getNb() : null;
      return nb ? MAIN_SHIFTS.filter((s) => s.neighborhood === nb) : MAIN_SHIFTS;
    }
    return SIDE_SHIFTS.filter((s) => s.giver === id);
  }
  // §2.20 / M15a.11: the card row's meta — the drops, your carry capacity, and the
  // shift's length in game hours (main, "4h") or soft deliver-by (side, "by 12:00").
  function meta(s) {
    const cap = ctx.getCapacity ? ctx.getCapacity() : null;
    const when = s.kind === 'side' ? 'by ' + fmtMin(clockMin() + s.deliverBy) : s.hours + 'h';
    return s.deliveries + ' drops' + (cap != null ? ' · ' + cap + ' on your back' : '') + ' · ' + when;
  }
  function clockMin() { return getClock() ? getClock().min : 0; }
  // M15a.11: a main mission is offered any time; a shift with `availableHours`
  // (Night Owl) is open only inside those game hours (a teaser outside them).
  function availableNow(s) {
    if (s.kind === 'side' || !s.availableHours) return true;
    const c = getClock(); if (!c) return true;
    const h = Math.floor(c.min / 60);
    return h >= s.availableHours[0] && h < s.availableHours[1];
  }
  function teaser(s) {
    const h = (n) => ((n < 10 ? '0' : '') + n);
    return 'Evenings only · ' + h(s.availableHours[0]) + ':00–' + h(s.availableHours[1]) + ':00';
  }
  function mcRenderList() {
    if (!mcList) return;
    const list = mcShifts(mcMarker);
    mcList.textContent = '';
    for (let i = 0; i < list.length; i++) {
      const s = list[i], locked = !progress.canStart(s);
      const open = availableNow(s);
      const row = el('div', 'sc-row' + (locked ? ' locked' : '') + (i === (mcIdx % list.length) ? ' focus' : ''));
      row.append(el('div', 'sc-row-name', s.name), el('div', 'sc-row-meta', meta(s)));
      if (locked) row.append(el('div', 'sc-row-lock', 'LOCKED · earn ' + s.unlockStars + '★'));
      else if (!open) row.append(el('div', 'sc-row-wait', teaser(s)));
      else row.append(el('div', 'sc-row-go', 'Ready'));
      mcList.append(row);
    }
  }
  // M12a.1: the free-roam marker card. Walking within ~2 tiles of a mission /
  // locker / side marker opens the matching card (dispatch → the main shifts, a
  // side marker → its side mission, the locker → the courier/vehicle select).
  // ←/→ pages, F/ENTER starts the focused (unlocked) shift, ESC or walking away
  // closes. The locker is a full screen (it locks the player); the dispatch and
  // side cards are light and let you keep riding.
  function openMarkerCard(id) {
    if (markerCardEl) { markerCardEl.remove(); markerCardEl = null; }
    mcMarker = id; mcIdx = 0;
    markerCardEl = el('div', 'shift-card marker-card');
    markerCardEl.append(el('h3', null, id === 'dispatch' ? 'Quickbox Dispatch' : 'Quickbox Side Mission'));
    mcList = el('div', 'sc-list'); markerCardEl.append(mcList);
    markerCardEl.append(el('div', 'sc-cta', '←/→ page · F / ENTER start · ESC close'));
    mcRenderList();
    document.getElementById('ui').append(markerCardEl);
  }
  function closeMarkerCard() {
    if (markerCardEl) { markerCardEl.remove(); markerCardEl = null; }
    mcList = null; mcMarker = null; mcIdx = 0;
  }
  function mcStart() {
    const list = mcShifts(mcMarker);
    const s = list[(mcIdx % list.length) | 0];
    // M15a.11: a main shift is startable any time (a timed one only in its hours).
    if (s && progress.canStart(s) && availableNow(s)) { const id = s.id; closeMarkerCard(); setPrevM(null); startShift(id); }
  }
  function mcKey(e) {
    if (!markerCardEl || mcMarker === 'locker') return;
    const list = mcShifts(mcMarker), code = e.code;
    if (code === 'ArrowLeft' || code === 'KeyA') { mcIdx = (mcIdx - 1 + list.length) % list.length; mcRenderList(); }
    else if (code === 'ArrowRight' || code === 'KeyD') { mcIdx = (mcIdx + 1) % list.length; mcRenderList(); }
    else if (code === 'Enter' || code === 'KeyF') mcStart();
    else if (code === 'Escape') { closeMarkerCard(); setPrevM(null); }
  }

  // §2.10: the dispatch card, paged through the main shifts. Shown at the
  // dispatch marker in free roam; `?showCard=1` forces it, and
  // `?screen=missionCard:<id>` focuses a specific shift (locked on a fresh save).
  function showShiftCard(focusId) {
    if (shiftCardEl) { shiftCardEl.remove(); shiftCardEl = null; }
    shiftCardEl = el('div', 'shift-card');
    shiftCardEl.append(el('h3', null, 'Quickbox Dispatch'));
    const list = el('div', 'sc-list');
    for (const s of MAIN_SHIFTS) {
      const locked = !progress.canStart(s);
      const open = availableNow(s);
      const row = el('div', 'sc-row' + (locked ? ' locked' : '') + (s.id === focusId ? ' focus' : ''));
      row.append(el('div', 'sc-row-name', s.name), el('div', 'sc-row-meta', meta(s)));
      if (locked) row.append(el('div', 'sc-row-lock', 'LOCKED · earn ' + s.unlockStars + '★ to unlock'));
      else if (!open) row.append(el('div', 'sc-row-wait', teaser(s)));
      else row.append(el('div', 'sc-row-go', 'Ready'));
      list.append(row);
    }
    shiftCardEl.append(list, el('div', 'sc-cta', 'Press ENTER to start a shift'));
    document.getElementById('ui').append(shiftCardEl);
  }

  // §2.1 / §10: the results screen (functional; polished in M8).
  function showResults(res) {
    endShift(false);
    // §10: the shift pays out coins + its best star count (unlocks later shifts).
    progress.earn(res.coins || 0);
    progress.recordShift(res.shift, res.score, res.stars || 0); // §2.11: save the best
    if (events) events.emit('results');
    // §2.12: a results-screen confetti / celebration on a finished shift.
    const p = getPlayer();
    const se = getSharedEffects();
    if (se && p && res.success) se.celebrate(p.pos.x, 1, p.pos.z);
    if (resultsEl) { resultsEl.remove(); resultsEl = null; }
    resultsEl = el('div', 'results');
    // §2.20 / M15a.11: no failure wording ever. A full clear is "Shift complete!";
    // a partial shift (hours ran out / clocked out early) is a plain shift report
    // of what you delivered + earned. Undelivered parcels go back to the depot.
    const title = res.success ? 'Shift complete!' : 'Shift report';
    const stars = '★'.repeat(res.stars) + '☆'.repeat(Math.max(0, 3 - res.stars));
    const bonus = res.timeBonus ? ' (+' + res.timeBonus + (res.tip ? ' early tip' : ' early-finish') + ')' : '';
    const backNote = (!res.success && res.delivered < res.total) ? ' · the rest goes back to the depot' : '';
    resultsEl.append(
      el('h2', 'results-title', title),
      el('div', 'results-stars', stars),
      el('div', 'results-score', 'Score ' + res.score + bonus),
      el('div', 'results-detail', res.delivered + '/' + res.total + ' delivered · +' + res.coins + ' coins' + backNote),
    );
    const btnC = el('button', 'results-btn', 'Continue');
    const btnR = el('button', 'results-btn', 'Retry');
    btnC.onclick = () => { resultsEl.remove(); resultsEl = null; };
    btnR.onclick = () => { const id = res.shift; resultsEl.remove(); resultsEl = null; startShift(id); };
    resultsEl.append(btnC, btnR);
    document.getElementById('ui').append(resultsEl);
  }

  return { openMarkerCard, closeMarkerCard, mcStart, mcKey, showShiftCard, showResults, getMarkerState: () => mcMarker };
}
