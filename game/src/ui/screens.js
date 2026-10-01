import { CHARACTERS } from '../data/characters.js';
import { VEHICLES } from '../data/vehicles.js';
import { buildSettingsRows } from './settingsScreen.js';

// §10: the menu / select / pause / settings / results screens. Each is a DOM
// overlay on top of the 3D scene; the select screens show the chosen courier or
// vehicle standing in the live showroom (in front of the depot) with a stat
// panel + ability card + lock/Buy. All screens are reachable by `?screen=`
// (screenshots) and by keyboard (arrows cycle, ENTER confirms, ESC/Tab back).
// No per-frame allocation: only the active screen's ring/anim is touched.

function el(tag, cls, txt) { const n = document.createElement(tag); if (cls) n.className = cls; if (txt) n.textContent = txt; return n; }

export function createScreens(ctx) {
  const { ui, scene, camera, charRegistry, vehRegistry, buildCourier, buildModel, mat,
    progress, pickChar, pickVeh, getBowled, startShift, gotoFreeRoam, setCam, qualityName } = ctx;
  const root = el('div', 'screens');
  ui.append(root);

  // -- shared showroom state ------------------------------------------------
  let selChar = ctx.activeCharId || CHARACTERS[0].id;
  let selVeh = ctx.activeVehId || VEHICLES[0].id;
  let showroomRig = null, showroomVeh = null;
  const showroomAnim = { speedFrac: 0, moving: 0, wave: 1, riding: 'walk', air: -1, fall: 0, t: 0, throw: -1, panic: 0, puffy: 0, blink: 0, pancake: 0 };

  function clearShowroom() {
    if (showroomRig) { scene.remove(showroomRig.group); showroomRig = null; }
    if (showroomVeh) { scene.remove(showroomVeh); showroomVeh = null; }
  }
  // Put a single courier + its vehicle standing at the showroom center, lit.
  function showroom(charId, vehId) {
    clearShowroom();
    const c = charRegistry.get(charId), v = vehRegistry.get(vehId);
    showroomRig = buildCourier(c, mat);
    showroomRig.group.position.set(158, 0, 140);
    showroomRig.group.rotation.y = 0;
    showroomAnim.wave = 1; showroomAnim.riding = v.riding;
    showroomRig.update(0, showroomAnim);
    scene.add(showroomRig.group);
    showroomVeh = buildModel(v.model, mat);
    if (showroomVeh) { showroomVeh.position.set(158, 0, 140); showroomVeh.rotation.y = 0; scene.add(showroomVeh); }
    setCam('showroom');
  }

  // -- stat bar rows --------------------------------------------------------
  function barRows(container, rows) {
    for (const r of rows) {
      const row = el('div', 'stat-row');
      const lbl = el('div', 'stat-lbl', r.label);
      const track = el('div', 'stat-track');
      const fill = el('div', 'stat-fill');
      fill.style.width = Math.round(r.value * 100) + '%';
      track.append(fill); row.append(lbl, track); container.append(row);
    }
  }

  // -- courier select panel -------------------------------------------------
  function renderCharPanel() {
    const c = charRegistry.get(selChar);
    charPanel.querySelector('.select-name').textContent = c.name;
    charPanel.querySelector('.select-blurb').textContent = c.blurb;
    charPanel.querySelector('.select-ability').textContent = c.ability ? c.ability[0].toUpperCase() + c.ability.slice(1) : '—';
    barRows(charPanel.querySelector('.stat-wrap'), [
      { label: 'Speed', value: c.stats.speed / 1.2 },
      { label: 'Capacity', value: c.stats.capacity / 8 },
      { label: 'Throw range', value: c.stats.throwRange },
      { label: 'Accuracy', value: c.stats.accuracy },
    ]);
    const lock = charPanel.querySelector('.select-lock');
    const unlocked = progress.canBuy(c);
    lock.textContent = unlocked ? 'UNLOCKED' : 'LOCKED · ' + c.unlockCost + ' coins';
    lock.classList.toggle('unlocked', unlocked);
    buyBtn.textContent = unlocked ? 'Use this courier' : 'Buy for ' + c.unlockCost;
    buyBtn.classList.toggle('afford', unlocked || progress.coins >= c.unlockCost);
  }
  function renderVehPanel() {
    const v = vehRegistry.get(selVeh);
    vehPanel.querySelector('.select-name').textContent = v.name;
    vehPanel.querySelector('.select-blurb').textContent = v.id === 'feet' ? 'Walk, hop, and slide.' : (v.canJump ? 'Bunny-hop over curbs.' : 'Fast and stable.');
    barRows(vehPanel.querySelector('.stat-wrap'), [
      { label: 'Speed', value: v.stats.maxSpeed / 14 },
      { label: 'Capacity', value: (1 + v.stats.capacityBonus) / 6 },
      { label: 'Turning', value: v.stats.turnRate / 5.5 },
      { label: 'Top speed', value: v.stats.maxSpeed / 14 },
    ]);
    const lock = vehPanel.querySelector('.select-lock');
    const unlocked = progress.canBuy(v);
    lock.textContent = unlocked ? 'UNLOCKED' : 'LOCKED · ' + v.unlockCost + ' coins';
    lock.classList.toggle('unlocked', unlocked);
    vBuyBtn.textContent = unlocked ? 'Ride this' : 'Buy for ' + v.unlockCost;
    vBuyBtn.classList.toggle('afford', unlocked || progress.coins >= v.unlockCost);
  }

  function makePanel(title, hint) {
    const p = el('div', 'select-panel');
    p.append(
      el('h3', 'select-title', title),
      el('div', 'select-name', '—'),
      el('div', 'select-blurb', ''),
      el('div', 'stat-wrap'),
      el('div', 'select-ability'),
      el('div', 'select-lock'),
      el('div', 'select-hint', hint),
    );
    const buy = el('button', 'select-buy');
    p.append(buy);
    root.append(p);
    return p;
  }
  const charPanel = makePanel('Choose a Courier', '←/→ cycle');
  const vehPanel = makePanel('Choose a Vehicle', '←/→ cycle');
  const buyBtn = charPanel.querySelector('.select-buy');
  const vBuyBtn = vehPanel.querySelector('.select-buy');

  // -- title screen ----------------------------------------------------------
  const title = el('div', 'screen screen-title');
  const titleHow = el('button', 'title-btn', 'How to play');
  const titleSettings = el('button', 'title-btn', 'Settings');
  titleHow.addEventListener('click', () => show('howTo'));
  titleSettings.addEventListener('click', () => { buildSettings(qualityName); show('settings'); });
  const titleMenu = el('div', 'title-menu');
  titleMenu.append(titleHow, titleSettings);
  title.append(
    el('div', 'title-logo', 'Parcelboy'),
    el('div', 'title-co', 'QUICKBOX · suburban delivery, with attitude'),
    el('div', 'title-cta', 'Press ENTER to clock in'),
    el('div', 'title-sub', 'or ESC for the courier locker'),
    titleMenu,
    el('div', 'title-credits', 'a Quickbox production · built with Three.js'),
  );
  root.append(title);

  // -- how-to-play screen ----------------------------------------------------
  const howTo = el('div', 'screen screen-howto');
  const hcard = (head, rows) => {
    const card = el('div', 'howto-card');
    card.append(el('h4', null, head));
    for (const [k, v] of rows) {
      const row = el('div', 'howto-row');
      row.append(el('span', 'howto-key', k), el('span', null, v));
      card.append(row);
    }
    return card;
  };
  const hnote = (head, txt) => {
    const card = el('div', 'howto-card');
    card.append(el('h4', null, head), el('div', 'howto-note', txt));
    return card;
  };
  const howToCols = el('div', 'howto-cols');
  howToCols.append(
    hcard('Move & hop', [
      ['WASD', 'drive or walk (the arrow keys work too)'],
      ['SPACE', 'hop — you can\'t be knocked down mid-air'],
      ['M', 'mute'],
      ['Tab', 'open / close the full map'],
    ]),
    hcard('Throw & deliver', [
      ['Q / E', 'toss the top parcel to your left / right'],
      ['CLICK', 'toss the top parcel at the ground under the cursor'],
      ['R', 'cycle the parcel stack — the top parcel is the one you throw'],
      ['F', 'hold on a porch to doorstep — hands over the matching parcel'],
    ]),
    hnote('The loop', 'Free roam: explore, hunt the 12 Golden Parcels, and restock at the Quickbox depot (the Q blip on the radar). Enter a shift at the teal dispatch marker and deliver every parcel before the clock runs out — more + a time bonus means more stars and coins.'),
    hnote('Mischief', 'Bowl pedestrians over and smash the "NO QUICKBOX!" Grump houses — it\'s all cartoon, so everyone pops back up. Keep the Neighborhood Watch\'s heat under three whistles or you get BUSTED.'),
  );
  howTo.append(el('h3', null, 'How to play'), howToCols, el('div', 'select-hint', 'ESC back'));
  root.append(howTo);

  // -- settings screen -------------------------------------------------------
  const settings = el('div', 'screen screen-settings');
  const setList = el('div', 'settings-list');
  const setNote = el('div', 'settings-note', 'A preset change reloads the page to apply (the antialias flag is set when the WebGL context is created).');
  settings.append(el('h3', null, 'Settings'), setList, setNote, el('div', 'select-hint', 'ESC back'));
  root.append(settings);

  // -- pause menu -----------------------------------------------------------
  const pause = el('div', 'screen screen-pause');
  const pauseList = el('div', 'pause-list');
  pause.append(el('h3', null, 'Paused'), pauseList, el('div', 'select-hint', 'ESC resume'));
  root.append(pause);

  // Hide every screen + panel by default (only the active one is shown).
  root.querySelectorAll('.screen, .select-panel').forEach((s) => s.classList.add('hidden'));

  // -- screen routing -------------------------------------------------------
  let activeName = null;
  function show(name, opts) {
    activeName = name;
    root.querySelectorAll('.screen, .select-panel').forEach((s) => s.classList.add('hidden'));
    clearShowroom();
    if (name === 'title') { title.classList.remove('hidden'); setCam('overview'); }
    else if (name === 'selectCourier') {
      selChar = (opts && opts.char) ? opts.char : selChar;
      charPanel.classList.remove('hidden');
      showroom(selChar, selVeh);
      renderCharPanel();
    }
    else if (name === 'selectVehicle') {
      selVeh = (opts && opts.veh) ? opts.veh : selVeh;
      vehPanel.classList.remove('hidden');
      showroom(selChar, selVeh);
      renderVehPanel();
    }
    else if (name === 'settings') { settings.classList.remove('hidden'); setCam('overview'); }
    else if (name === 'howTo') { howTo.classList.remove('hidden'); }
    else if (name === 'pause') { pause.classList.remove('hidden'); }
  }

  function close() {
    activeName = null;
    root.querySelectorAll('.screen, .select-panel').forEach((s) => s.classList.add('hidden'));
    clearShowroom();
  }

  // -- keyboard navigation --------------------------------------------------
  function handleKey(e) {
    const code = e.code;
    if (activeName === 'selectCourier') {
      if (code === 'ArrowLeft' || code === 'KeyA') { selChar = shiftIdx(CHARACTERS, selChar, -1); showroom(selChar, selVeh); renderCharPanel(); }
      else if (code === 'ArrowRight' || code === 'KeyD') { selChar = shiftIdx(CHARACTERS, selChar, 1); showroom(selChar, selVeh); renderCharPanel(); }
      else if (code === 'Enter') { confirmChar(); }
      else if (code === 'Escape') { gotoFreeRoam(); }
    } else if (activeName === 'selectVehicle') {
      if (code === 'ArrowLeft' || code === 'KeyA') { selVeh = shiftIdx(VEHICLES, selVeh, -1); showroom(selChar, selVeh); renderVehPanel(); }
      else if (code === 'ArrowRight' || code === 'KeyD') { selVeh = shiftIdx(VEHICLES, selVeh, 1); showroom(selChar, selVeh); renderVehPanel(); }
      else if (code === 'Enter') { confirmVeh(); }
      else if (code === 'Escape') { show('selectCourier'); } // §5.3: back to the courier, not free roam
    } else if (activeName === 'title') {
      if (code === 'Enter') gotoFreeRoam();
      else if (code === 'Escape') show('selectCourier');
    } else if (activeName === 'howTo' || activeName === 'settings') {
      if (code === 'Escape') show('title');
    } else if (activeName === 'pause') {
      if (code === 'Escape') ctx.resumePause && ctx.resumePause();
    }
  }

  function shiftIdx(list, id, dir) {
    let i = 0; for (let k = 0; k < list.length; k++) if (list[k].id === id) i = k;
    return list[(i + dir + list.length) % list.length].id;
  }
  // §5.3 / M12a.1: the locker flow is selectCourier → selectVehicle → freeRoam.
  // Confirming a courier advances to the vehicle screen; confirming a vehicle
  // (or ESC from the vehicle screen back to the courier, then ENTER) ends it.
  function confirmChar() { pickChar(selChar); show('selectVehicle'); }
  function confirmVeh() { pickVeh(selVeh); gotoFreeRoam(); }

  buyBtn.addEventListener('click', () => {
    const c = charRegistry.get(selChar);
    if (progress.buy(c)) { renderCharPanel(); }
  });
  vBuyBtn.addEventListener('click', () => {
    const v = vehRegistry.get(selVeh);
    if (progress.buy(v)) { renderVehPanel(); }
  });

  // -- settings rows --------------------------------------------------------
  function buildSettings(active) {
    buildSettingsRows(setList, el, ctx, active);
  }

  // -- pause rows -----------------------------------------------------------
  function buildPause() {
    pauseList.textContent = '';
    const inMission = ctx.isInMission && ctx.isInMission();
    const item = (label, fn) => {
      const it = el('div', 'pause-item' + (fn ? ' clickable' : ''), label);
      if (fn) it.addEventListener('click', fn);
      return it;
    };
    pauseList.append(el('div', 'pause-bowled', 'People bowled: ' + getBowled()));
    pauseList.append(item('▶  Resume (ESC)', () => ctx.resumePause && ctx.resumePause()));
    if (inMission) {
      pauseList.append(item('↻  Restart shift', () => ctx.restartShift && ctx.restartShift()));
      pauseList.append(item('⎋  Clock out early', () => ctx.abandonShift && ctx.abandonShift()));
    }
  }

  function tick(dt) {
    if (showroomRig) { showroomAnim.t += dt; showroomRig.update(dt, showroomAnim); }
    void dt;
  }

  return {
    show, close, handleKey, tick, buildSettings, buildPause,
    get active() { return activeName; },
  };
}
