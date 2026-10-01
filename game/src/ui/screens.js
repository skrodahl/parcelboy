import { CHARACTERS } from '../data/characters.js';
import { VEHICLES } from '../data/vehicles.js';

// §10: the menu / select / pause / settings / results screens. Each is a DOM
// overlay on top of the 3D scene; the select screens show the chosen courier or
// vehicle standing in the live showroom (in front of the depot) with a stat
// panel + ability card + lock/Buy. All screens are reachable by `?screen=`
// (screenshots) and by keyboard (arrows cycle, ENTER confirms, ESC/Tab back).
// No per-frame allocation: only the active screen's ring/anim is touched.

function el(tag, cls, txt) { const n = document.createElement(tag); if (cls) n.className = cls; if (txt) n.textContent = txt; return n; }

export function createScreens(ctx) {
  const { ui, scene, camera, charRegistry, vehRegistry, buildCourier, buildModel, mat,
    progress, pickChar, pickVeh, getBowled, startShift, gotoFreeRoam, setCam } = ctx;
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
  title.append(
    el('div', 'title-logo', 'Parcelboy'),
    el('div', 'title-co', 'QUICKBOX · suburban delivery, with attitude'),
    el('div', 'title-cta', 'Press ENTER to clock in'),
    el('div', 'title-sub', 'or ESC for the courier locker'),
  );
  root.append(title);

  // -- settings screen -------------------------------------------------------
  const settings = el('div', 'screen screen-settings');
  const setList = el('div', 'settings-list');
  const setNote = el('div', 'settings-note', 'Antialias needs a page reload to apply.');
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
      else if (code === 'Escape') { gotoFreeRoam(); }
    } else if (activeName === 'title') {
      if (code === 'Enter') gotoFreeRoam();
      else if (code === 'Escape') show('selectCourier');
    } else if (activeName === 'pause') {
      if (code === 'Escape') ctx.resumePause && ctx.resumePause();
    }
  }

  function shiftIdx(list, id, dir) {
    let i = 0; for (let k = 0; k < list.length; k++) if (list[k].id === id) i = k;
    return list[(i + dir + list.length) % list.length].id;
  }
  function confirmChar() { pickChar(selChar); gotoFreeRoam(); }
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
    setList.textContent = '';
    const presets = ['high', 'balanced', 'battery'];
    for (const p of presets) {
      const row = el('div', 'setting-row' + (p === active ? ' active' : ''));
      row.append(el('div', 'setting-lbl', p[0].toUpperCase() + p.slice(1)),
        el('div', 'setting-desc', p === 'battery' ? '30 fps · low ambient life' : p === 'balanced' ? '60 fps · antialias on' : '60 fps · shadows + antialias'));
      row.addEventListener('click', () => ctx.setQuality && ctx.setQuality(p));
      setList.append(row);
    }
    // M9: audio controls (mute toggle + music/SFX volume sliders).
    if (ctx.audio) {
      const muteVal = el('div', 'setting-desc', ctx.audio.muted ? 'ON' : 'OFF');
      const muteRow = el('div', 'setting-row');
      muteRow.append(el('div', 'setting-lbl', 'Mute'), muteVal);
      muteRow.addEventListener('click', () => { const m = !ctx.audio.muted; ctx.audio.setMuted(m); muteVal.textContent = m ? 'ON' : 'OFF'; });
      setList.append(muteRow);
      for (const which of ['music', 'sfx']) {
        const base = which === 'music' ? ctx.audio.musicVol : ctx.audio.sfxVol;
        const slider = el('input', 'setting-slider');
        slider.type = 'range'; slider.min = '0'; slider.max = '100'; slider.value = Math.round(base * 100);
        const valEl = el('div', 'setting-desc', slider.value);
        slider.addEventListener('input', () => {
          valEl.textContent = slider.value;
          const v = Number(slider.value) / 100;
          if (which === 'music') ctx.audio.setMusicVol(v); else ctx.audio.setSfxVol(v);
          if (ctx.persistSetting) ctx.persistSetting(which === 'music' ? 'musicVol' : 'sfxVol', v);
        });
        const volRow = el('div', 'setting-row audio');
        volRow.append(el('div', 'setting-lbl', which === 'music' ? 'Music' : 'SFX'), slider, valEl);
        setList.append(volRow);
      }
    }
  }

  // -- pause rows -----------------------------------------------------------
  function buildPause(resume, quit) {
    pauseList.textContent = '';
    const bowled = getBowled();
    pauseList.append(
      el('div', 'pause-bowled', 'People bowled: ' + bowled),
      el('div', 'pause-item', '▶  Resume (ESC)'),
      el('div', 'pause-item', '↻  Restart shift'),
      el('div', 'pause-item', '⎋  Quit to free roam'),
    );
    void resume; void quit;
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
