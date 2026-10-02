// M12a.5: the Settings-screen rows (quality presets + the audio controls),
// extracted from ui/screens.js. `el` is the DOM helper; `ctx` provides
// setQuality / audio / persistSetting; `setList` is the container the rows are
// appended into. Kept out of screens.js so that file stays small.
export function buildSettingsRows(setList, el, ctx, active) {
  setList.textContent = '';
  const presets = ['high', 'balanced', 'battery'];
  for (const p of presets) {
    const row = el('div', 'setting-row' + (p === active ? ' active' : ''));
    row.append(el('div', 'setting-lbl', p[0].toUpperCase() + p.slice(1)),
      el('div', 'setting-desc', p === 'battery' ? '30 fps · low ambient life' : p === 'balanced' ? '60 fps · antialias on' : '60 fps · shadows + antialias'));
    row.addEventListener('click', () => ctx.setQuality && ctx.setQuality(p));
    setList.append(row);
  }
  // M15a.12: the current difficulty (opens the Doom-style select to change it).
  if (ctx.difficultyName) {
    const diffRow = el('div', 'setting-row');
    diffRow.append(el('div', 'setting-lbl', 'Difficulty'), el('div', 'setting-desc', ctx.difficultyName()));
    diffRow.addEventListener('click', () => ctx.openDifficulty && ctx.openDifficulty());
    setList.append(diffRow);
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
