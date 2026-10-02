import * as THREE from 'three';
import { starNeed } from '../data/shifts.js';

// M15a.8: one shared "action strip" component replaces the dispatch card and the
// courier/vehicle select screens. It is used by every in-world interactive spot:
//  - a small bobbing WORLD-ANCHORED prompt above the marker (one reused DOM node)
//    — `[F] Dispatch · 2 open`, `[F] Locker · change courier`, …;
//  - pressing F opens a bottom strip (the world stays visible above it, the
//    courier is locked, the sim keeps running);
//  - cards in a row: ←/→ (A/D) slides the highlight, the highlighted card is
//    larger + shows details, locked ones show a 🔒 + a chip (never long red text);
//  - the locker is the same strip with TWO rows (couriers / vehicles), W/S
//    (↑/↓) switches the row; browsing re-dresses the live courier (changeCourier).
// Data-driven: it only reads registries + shift data + progression, never a
// specific id. No per-frame allocation (one reused prompt node + a scratch
// Vector3 for the world→screen anchor).

function el(tag, cls, txt) { const n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; }

export function createActionStrip(ctx) {
  const { ui, camera, progress, charRegistry, vehRegistry, getNb, getCapacity,
    startShift, redress, getMarkerPos, mainShifts, sideShifts,
    getCharId, getVehId, getHour, closeScreens } = ctx;

  // M15a.11: a mission is offered any time, EXCEPT a shift with `availableHours`
  // (Night Owl) which is only startable inside those game hours. Outside them it
  // shows a teaser ("Evenings only · 19:00–24:00"), not a lock.
  function availableNow(s) {
    if (s.kind === 'side' || !s.availableHours) return true;
    const h = getHour ? getHour() : 12;
    return h >= s.availableHours[0] && h < s.availableHours[1];
  }
  function teaser(s) {
    const h = (n) => ((n < 10 ? '0' : '') + n);
    return 'Evenings only · ' + h(s.availableHours[0]) + ':00–' + h(s.availableHours[1]) + ':00';
  }
  const _v = new THREE.Vector3();
  let t = 0;
  let open = false;
  let nearId = null;          // the marker the player is standing by (or null)
  let mode = null;           // 'dispatch' | 'side' | 'locker'
  let list = [];             // the current card set (shifts, or char/veh defs)
  let focus = 0;
  let row = 0;              // locker: 0 = couriers, 1 = vehicles
  let cardEls = [];         // the built .as-card nodes (rebuilt on open)

  // -- prompt (one reused node, world-anchored) --------------------------------
  const prompt = el('div', 'as-prompt');
  prompt.style.display = 'none';
  prompt.append(el('span', 'as-prompt-key', '[F]'), el('span', 'as-prompt-label', ''));
  ui.appendChild(prompt);

  // -- strip (bottom third; cards are rebuilt on open, updated in place) ------
  const strip = el('div', 'as-strip');
  strip.classList.add('hidden');
  const cards = el('div', 'as-cards');
  const navL = el('div', 'as-nav as-nav-l', '◀');
  const navR = el('div', 'as-nav as-nav-r', '▶');
  const legend = el('div', 'as-legend');
  strip.append(navL, cards, navR, legend);
  ui.appendChild(strip);

  function modeFor(id) {
    if (id === 'locker') return 'locker';
    if (id === 'dispatch') return 'dispatch';
    return 'side'; // bakery / hardware
  }
  // The prompt label, per marker.
  function promptLabel(id) {
    if (id === 'dispatch') {
      // M15a.11: count missions you can start right now (unlocked + available now).
      const n = listFor('dispatch').filter((s) => progress.canStart(s) && availableNow(s)).length;
      return 'Dispatch · ' + n + ' open';
    }
    if (id === 'locker') return 'Locker · change courier';
    const s = listFor('side', id)[0];
    return (id === 'bakery' ? 'Bakery' : 'Hardware') + ' · ' + (s ? s.name : 'Mission');
  }
  // The card set for a strip mode (dispatch/side → the suburb's shifts;
  // locker → the courier + vehicle rosters).
  function listFor(m, id) {
    if (m === 'dispatch') {
      const nb = getNb();
      return mainShifts.filter((s) => !nb || s.neighborhood === nb);
    }
    if (m === 'side') return sideShifts.filter((s) => s.giver === id);
    return row === 0 ? charRegistry.all() : vehRegistry.all();
  }

  // Build the card row for the current mode (once, on open).
  function buildCards() {
    cards.textContent = '';
    cardEls = [];
    cards.className = mode === 'locker' ? 'as-cards as-two' : 'as-cards';
    if (mode === 'locker') {
      // Two rows: couriers (top) + vehicles (bottom); W/S switches the active row.
      for (const r of [0, 1]) {
        const rowEl = el('div', 'as-row' + (r === row ? ' active' : ''));
        const head = el('div', 'as-row-head', r === 0 ? 'Couriers' : 'Vehicles');
        const rowCards = el('div', 'as-cards');
        const defs = (r === 0 ? charRegistry.all() : vehRegistry.all());
        for (const d of defs) rowCards.appendChild(makeItemCard(d, r === 0 ? 'char' : 'veh'));
        rowEl.append(head, rowCards);
        cards.appendChild(rowEl);
      }
      // Re-collect the flat card list for the active row (focus navigates it).
      syncRowCards();
      return;
    }
    list = listFor(mode, nearId);
    for (const s of list) cards.appendChild(makeShiftCard(s));
    cardEls = Array.from(cards.querySelectorAll('.as-card'));
    focus = 0;
  }
  // Locker: (re)collect the card nodes of the ACTIVE row into cardEls + list.
  function syncRowCards() {
    const rowEl = cards.querySelector('.as-row.active');
    list = row === 0 ? charRegistry.all() : vehRegistry.all();
    cardEls = rowEl ? Array.from(rowEl.querySelectorAll('.as-card')) : [];
  }
  function switchRow(r) {
    row = r;
    cards.querySelectorAll('.as-row').forEach((n, i) => n.classList.toggle('active', i === row));
    focus = 0;
    syncRowCards();
    renderFocus();
  }

  // A shift / side-mission card.
  function makeShiftCard(s) {
    const locked = !progress.canStart(s);
    const cap = getCapacity();
    const hrs = s.kind === 'side' ? null : s.hours; // M15a.11: `hours` (any-time)
    const c = el('div', 'as-card');
    c.append(el('div', 'as-card-name', s.name));
    c.append(el('div', 'as-card-meta', s.deliveries + ' drops' + (hrs != null ? ' · ' + hrs + 'h' : '') + (cap != null ? ' · ' + cap + ' on back' : '')));
    if (locked) c.append(el('div', 'as-card-lock', '🔒 ' + s.unlockStars + '★'));
    else if (!availableNow(s)) c.append(el('div', 'as-card-teaser', teaser(s))); // M15a.11: Night Owl out of hours
    else {
      const best = progress.bestFor(s.id).stars;
      c.append(el('div', 'as-card-go', best ? best + '★ best' : 'Ready'));
      // M15a.16: the three star goals (revealed when the card is the big one).
      const n = starNeed(s);
      const stars = el('div', 'as-card-stars');
      stars.append(
        el('div', 'as-card-star', '1★ Delivered ' + n.needOne + ' of ' + n.total),
        el('div', 'as-card-star', '2★ All delivered'),
        el('div', 'as-card-star', '3★ Style ' + n.style),
      );
      c.append(stars, el('div', 'as-card-detail', ''));
    }
    return c;
  }
  // A locker roster card (courier or vehicle).
  function makeItemCard(d, kind) {
    const locked = !progress.canBuy(d);
    const c = el('div', 'as-card');
    c.append(el('div', 'as-card-name', d.name));
    c.append(el('div', 'as-card-meta', kind === 'char' ? (d.ability || '—') : (d.id === 'feet' ? 'On foot' : 'Vehicle')));
    if (locked) c.append(el('div', 'as-card-lock', '🔒 ' + d.unlockCost + ' coins'));
    else { c.append(el('div', 'as-card-go', 'Ready')); c.append(el('div', 'as-card-detail', '')); }
    return c;
  }

  // Update in place: move the highlight (a short slide) + expand the focused
  // card's details. No new DOM — only class toggles + the detail line.
  function renderFocus() {
    for (let i = 0; i < cardEls.length; i++) {
      const big = i === focus;
      cardEls[i].classList.toggle('big', big);
      const det = cardEls[i].querySelector('.as-card-detail');
      if (big && det) {
        const d = list[i];
        det.textContent = mode === 'locker'
          ? (row === 0 ? (d.ability || '—') : (d.id === 'feet' ? 'Walk, hop and slide.' : 'Fast and stable.'))
          : shiftDetail(d);
      }
    }
  }
  function shiftDetail(s) {
    const best = progress.bestFor(s.id).stars;
    let d = s.deliveries + ' drops · ' + (s.kind === 'side' ? 'side mission' : s.hours + 'h') + (best ? ' · best ' + best + '★' : '');
    // M15a.17: a side mission's customer story (a representative line — the
    // specific customer is seeded when the shift actually starts).
    if (s.kind === 'side' && s.customers && s.customers.length) d += ' · ' + s.customers[0].name + "'s " + s.customers[0].line;
    return d;
  }

  // -- public API --------------------------------------------------------------
  function setNear(id) {
    if (id === nearId) return;
    nearId = id;
    mode = id ? modeFor(id) : null;
    if (!open && id) {
      prompt.querySelector('.as-prompt-label').textContent = promptLabel(id);
      prompt.style.display = '';
    } else if (!id) prompt.style.display = 'none';
  }
  function isOpen() { return open; }
  function openStrip(opts) {
    if (!opts || !opts.id) return;
    if (closeScreens) closeScreens(); // only one strip; opening it closes any screen
    nearId = opts.id; mode = modeFor(opts.id);
    open = true;
    focus = 0;
    if (opts.row != null) row = opts.row;
    if (mode === 'dispatch' || mode === 'side') list = listFor(mode, opts.id);
    buildCards();
    // Focus a specific shift (?screen=missionCard:<id>).
    if (opts.focus) { const i = list.findIndex((s) => s.id === opts.focus); if (i >= 0) focus = i; }
    legend.textContent = mode === 'locker' ? '[←][→] choose · [↑][↓] row · [F] keep · [Esc] close' : '[←][→] choose · [F] start · [Esc] close';
    strip.classList.remove('hidden');
    prompt.style.display = 'none';
    renderFocus();
  }
  function close() {
    if (!open) return;
    open = false;
    strip.classList.add('hidden');
    if (nearId) prompt.style.display = '';
  }
  function move(dir) {
    if (!cardEls.length) return;
    focus = (focus + dir + cardEls.length) % cardEls.length;
    renderFocus();
    if (mode === 'locker') {
      // Browsing re-dresses the live courier (outfit + vehicle swap).
      const d = list[focus];
      if (d && progress.canBuy(d)) {
        const other = row === 0 ? getVehId() : getCharId();
        redress(row === 0 ? d.id : other, row === 0 ? other : d.id);
      }
    }
  }
  function confirm() {
    const d = list[focus];
    if (!d) return;
    if (mode === 'locker') {
      // "Done" (F/Esc on the active item) keeps the current choice; buying a
      // locked item spends coins then keeps it.
      if (progress.canBuy(d)) { redress(row === 0 ? d.id : getCharId(), row === 0 ? getVehId() : d.id); close(); }
      else if (progress.buy(d)) redress(row === 0 ? d.id : getCharId(), row === 0 ? getVehId() : d.id);
      return;
    }
    if (progress.canStart(d) && availableNow(d)) { close(); startShift(d.id); } // M15a.11: teaser (out of hours) won't start
  }
  function handleKey(e) {
    if (!open) return;
    const c = e.code;
    if (c === 'ArrowLeft' || c === 'KeyA') move(-1);
    else if (c === 'ArrowRight' || c === 'KeyD') move(1);
    else if (mode === 'locker' && (c === 'ArrowUp' || c === 'KeyW')) switchRow(0);
    else if (mode === 'locker' && (c === 'ArrowDown' || c === 'KeyS')) switchRow(1);
    else if (c === 'Enter' || c === 'KeyF') confirm();
    else if (c === 'Escape') close();
  }
  // Mouse: click a card to highlight, click again to confirm.
  function onCardClick(e) {
    const card = e.target.closest('.as-card');
    if (!card || !cardEls.length) return;
    const i = cardEls.indexOf(card);
    if (i >= 0 && i === focus) confirm();
    else if (i >= 0) { focus = i; renderFocus(); }
  }
  cards.addEventListener('click', onCardClick);

  function tick(dt) {
    t += dt;
    // Keep the prompt pinned to the marker (world → screen), bobbing ±0.4.
    if (!open && nearId && prompt.style.display !== 'none') {
      const p = getMarkerPos(nearId);
      if (!p) { prompt.style.display = 'none'; return; }
      _v.set(p.x, p.y + Math.sin(t * 2.2) * 0.4, p.z).project(camera);
      if (_v.z > 1) { prompt.style.display = 'none'; return; } // behind the cam
      prompt.style.display = '';
      prompt.style.left = (Math.round((_v.x * 0.5 + 0.5) * window.innerWidth) - 20) + 'px';
      prompt.style.top = (Math.round((-_v.y * 0.5 + 0.5) * window.innerHeight) - 34) + 'px';
    }
  }

  return { prompt, strip, setNear, openStrip, close, isOpen, handleKey, tick, move, confirm };
}
