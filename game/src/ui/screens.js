import { CHARACTERS } from '../data/characters.js';
import { VEHICLES } from '../data/vehicles.js';
import { buildSettingsRows } from './settingsScreen.js';
import { createDifficultyList } from './difficulty.js';
import { createPausePanel } from './screens/pause.js';
import { createCareerPage } from './screens/career.js';

// §10: the menu / select / pause / settings / results screens. Each is a DOM
// overlay on top of the 3D scene; the select screens show the chosen courier or
// vehicle standing in the live showroom (in front of the depot) with a stat
// panel + ability card + lock/Buy. All screens are reachable by `?screen=`
// (screenshots) and by keyboard (arrows cycle, ENTER confirms, ESC/Tab back).
// No per-frame allocation: only the active screen's ring/anim is touched.

function el(tag, cls, txt) { const n = document.createElement(tag); if (cls) n.className = cls; if (txt) n.textContent = txt; return n; }

export function createScreens(ctx) {
  const { ui, scene, camera, charRegistry, vehRegistry, buildCourier, buildModel, mat,
    progress, pickChar, pickVeh, getBowled, startShift, gotoFreeRoam, setCam, qualityName,
    currentDifficulty, onPickDifficulty, careerData, achievements, saveAndQuit } = ctx;
  // M15a.13: sub-screens opened from the pause hub return to the hub; from the
  // title they return to the title. Career is a view *inside* the pause screen.
  let subParent = 'title';
  let pauseView = 'menu'; // 'menu' (the row panel) | 'career'
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

  // -- stat bar rows (M15a.7) ----------------------------------------------
  // The 4 rows are built ONCE per panel (in makePanel); each render only
  // updates the label text and the fill width — no new DOM per ←/→ press.
  function buildStatRows(container) {
    const refs = [];
    for (let i = 0; i < 4; i++) {
      const row = el('div', 'stat-row');
      const lbl = el('div', 'stat-lbl', '');
      const track = el('div', 'stat-track');
      const fill = el('div', 'stat-fill');
      fill.style.width = '0%';
      track.append(fill); row.append(lbl, track); container.append(row);
      refs.push({ label: lbl, fill });
    }
    return refs;
  }
  function setStatRows(refs, rows) {
    for (let i = 0; i < rows.length && i < refs.length; i++) {
      refs[i].label.textContent = rows[i].label;
      refs[i].fill.style.width = Math.round(Math.max(0, Math.min(1, rows[i].value)) * 100) + '%';
    }
  }

  // -- courier select panel -------------------------------------------------
  function renderCharPanel() {
    const c = charRegistry.get(selChar);
    charPanel.querySelector('.select-name').textContent = c.name;
    charPanel.querySelector('.select-blurb').textContent = c.blurb;
    charPanel.querySelector('.select-ability').textContent = c.ability ? c.ability[0].toUpperCase() + c.ability.slice(1) : '—';
    setStatRows(charPanel._statRefs, [
      { label: 'Speed', value: c.stats.speed / CHAR_MAX.speed },
      { label: 'Capacity', value: c.stats.capacity / CHAR_MAX.capacity },
      { label: 'Throw range', value: c.stats.throwRange / CHAR_MAX.throwRange },
      { label: 'Accuracy', value: c.stats.accuracy / CHAR_MAX.accuracy },
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
    setStatRows(vehPanel._statRefs, [
      { label: 'Speed', value: v.stats.maxSpeed / VEH_MAX.maxSpeed },
      { label: 'Acceleration', value: v.stats.accel / VEH_MAX.accel },
      { label: 'Turning', value: v.stats.turnRate / VEH_MAX.turnRate },
      { label: 'Capacity', value: (1 + v.stats.capacityBonus) / VEH_MAX.capacity },
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
    const wrap = el('div', 'stat-wrap');
    p.append(
      el('h3', 'select-title', title),
      el('div', 'select-name', '—'),
      el('div', 'select-blurb', ''),
      wrap,
      el('div', 'select-ability'),
      el('div', 'select-lock'),
      el('div', 'select-hint', hint),
    );
    const buy = el('button', 'select-buy');
    p.append(buy);
    p._statRefs = buildStatRows(wrap); // the 4 stat rows, built once
    root.append(p);
    return p;
  }
  const charPanel = makePanel('Choose a Courier', '←/→ cycle');
  const vehPanel = makePanel('Choose a Vehicle', '←/→ cycle');

  // M15a.7: scale every stat bar against the max of that stat in the registry
  // (never a hard-coded divisor), so bars are comparable across the roster.
  function statMax(list, pick) { let m = 0; for (let i = 0; i < list.length; i++) { const v = pick(list[i]); if (v > m) m = v; } return m; }
  const _charAll = charRegistry.all(), _vehAll = vehRegistry.all();
  const CHAR_MAX = {
    speed: statMax(_charAll, (c) => c.stats.speed),
    capacity: statMax(_charAll, (c) => c.stats.capacity),
    throwRange: statMax(_charAll, (c) => c.stats.throwRange),
    accuracy: statMax(_charAll, (c) => c.stats.accuracy),
  };
  const VEH_MAX = {
    maxSpeed: statMax(_vehAll, (v) => v.stats.maxSpeed),
    accel: statMax(_vehAll, (v) => v.stats.accel),
    turnRate: statMax(_vehAll, (v) => v.stats.turnRate),
    capacity: statMax(_vehAll, (v) => 1 + v.stats.capacityBonus),
  };
  const buyBtn = charPanel.querySelector('.select-buy');
  const vBuyBtn = vehPanel.querySelector('.select-buy');

  // -- title screen ----------------------------------------------------------
  const title = el('div', 'screen screen-title');
  const titleHow = el('button', 'title-btn', 'How to play');
  const titleSettings = el('button', 'title-btn', 'Settings');
  const titleNewGame = el('button', 'title-btn title-newgame', 'New Game');
  titleHow.addEventListener('click', () => { subParent = 'title'; show('howTo'); });
  titleSettings.addEventListener('click', () => { subParent = 'title'; buildSettings(qualityName); show('settings'); });
  titleNewGame.addEventListener('click', () => { subParent = 'title'; show('difficulty'); }); // M15a.12: pick a difficulty
  const titleMenu = el('div', 'title-menu');
  titleMenu.append(titleNewGame, titleHow, titleSettings);
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

  // -- difficulty select screen (M15a.12, Doom-style) ------------------------
  const difficulty = el('div', 'screen screen-difficulty');
  const diffContainer = el('div', 'diff-body');
  difficulty.append(el('h3', null, 'Pick a Difficulty'), diffContainer); // the list carries its own hint
  root.append(difficulty);
  let diffList = null;
  function buildDifficultyList() {
    diffContainer.textContent = ''; // drop the previous list (a new current highlight)
    diffList = createDifficultyList(diffContainer, {
      el,
      currentId: currentDifficulty ? currentDifficulty() : 'brutal',
      onPick: (id) => { onPickDifficulty && onPickDifficulty(id); show(subParent); }, // M15a.13: back to the hub (or title)
      onCancel: () => show(subParent),
    });
  }

  // -- pause hub (M15a.13) ---------------------------------------------------
  // A panel on the left third, the paused world behind it. "Career" is a view
  // inside this screen (not a separate active screen), so Esc never double-fires.
  const pause = el('div', 'screen screen-pause');
  const pauseMenuWrap = el('div', 'pause-menu-wrap');
  const careerWrap = el('div', 'career-wrap');
  careerWrap.classList.add('hidden');
  pause.append(pauseMenuWrap, careerWrap);
  root.append(pause);
  let pausePanel = null;
  let careerPage = null;

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
    else if (name === 'difficulty') { difficulty.classList.remove('hidden'); buildDifficultyList(); setCam('overview'); }
    else if (name === 'pause') { buildPause(); pause.classList.remove('hidden'); }
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
    } else if (activeName === 'difficulty') {
      if (diffList) diffList.handleKey(e); // M15a.12: the Doom-style list drives its own keys
      else if (code === 'Escape' || code === 'KeyP') show(subParent);
    } else if (activeName === 'howTo' || activeName === 'settings') {
      if (code === 'Escape' || code === 'KeyP') show(subParent); // M15a.13: back to the hub (or title)
    } else if (activeName === 'pause') {
      if (pauseView === 'career') {
        if (code === 'Escape' || code === 'KeyP') buildPause(); // back to the hub menu
        else if (careerPage) careerPage.handleKey(e);
      } else {
        if (code === 'Escape' || code === 'KeyP') ctx.resumePause && ctx.resumePause(); // resume
        else if (pausePanel) pausePanel.handleKey(e);
      }
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

  // -- pause hub rows (M15a.13) --------------------------------------------
  function buildPause() {
    pauseView = 'menu';
    subParent = 'pause';
    pauseMenuWrap.classList.remove('hidden');
    careerWrap.classList.add('hidden');
    const actions = {
      resume: () => ctx.resumePause && ctx.resumePause(),
      restart: () => ctx.restartShift && ctx.restartShift(),
      clockout: () => ctx.abandonShift && ctx.abandonShift(),
      career: () => { pauseView = 'career'; pauseMenuWrap.classList.add('hidden'); careerWrap.classList.remove('hidden'); if (!careerPage) careerPage = createCareerPage(careerWrap, { el, careerData: careerData || null, achievements: achievements || null, difficultyName: ctx.difficultyName, openDifficulty: () => show('difficulty') }); careerPage.render(); },
      settings: () => { subParent = 'pause'; buildSettings(qualityName); show('settings'); },
      howto: () => { subParent = 'pause'; show('howTo'); },
      quit: () => { saveAndQuit && saveAndQuit(); },
    };
    if (!pausePanel) pausePanel = createPausePanel(pauseMenuWrap, { el, isInMission: ctx.isInMission, getBowled, difficultyName: ctx.difficultyName, actions });
    else pausePanel.render();
  }

  function tick(dt) {
    if (showroomRig) { showroomAnim.t += dt; showroomRig.update(dt, showroomAnim); }
    void dt;
  }

  // M15a.13: open the Career view directly (the pause hub with pauseView='career').
  function openCareer() {
    buildPause();
    pauseView = 'career';
    pauseMenuWrap.classList.add('hidden');
    careerWrap.classList.remove('hidden');
    if (!careerPage) careerPage = createCareerPage(careerWrap, { el, careerData: careerData || null, achievements: achievements || null, difficultyName: ctx.difficultyName, openDifficulty: () => show('difficulty') });
    careerPage.render();
    pause.classList.remove('hidden');
  }

  return {
    show, close, handleKey, tick, buildSettings, buildPause, openCareer,
    get active() { return activeName; },
  };
}
