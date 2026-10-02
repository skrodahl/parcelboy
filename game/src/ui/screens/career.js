// M15a.13: the Career page — a scrollable record of the player's ledger, opened
// from the pause hub. Three sections (Record / Mischief / Slapstick) + the full
// achievements list (earned in colour with a date, the rest greyed with the
// description as a hint). The current difficulty is shown at the top, with a
// "change" link to the difficulty list. ↑/↓ scroll. No per-frame allocation.
function el(tag, cls, txt) { const n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; }

export function createCareerPage(container, ctx) {
  const { el: E, careerData, achievements, difficultyName, openDifficulty } = ctx;
  let scrollEl = null;

  function row(label, value) {
    const r = E('div', 'career-row');
    r.append(E('span', 'career-lbl', label), E('span', 'career-val', String(value)));
    return r;
  }
  function section(title, body) {
    const s = E('div', 'career-section');
    s.append(E('h4', 'career-h', title));
    body(s);
    return s;
  }

  function render() {
    container.textContent = '';
    const c = careerData();
    const page = E('div', 'career-page');
    const scroll = E('div', 'career-scroll');

    // Header: the current difficulty + "change".
    const head = E('div', 'career-head');
    head.append(E('h3', 'career-title', 'Career'));
    const diff = E('div', 'career-diff', 'Difficulty: ' + (difficultyName ? difficultyName() : '—'));
    const chg = E('button', 'career-diff-chg', 'change');
    chg.addEventListener('click', () => openDifficulty && openDifficulty());
    diff.append(chg);
    head.append(diff);
    page.append(head);

    // Record.
    scroll.append(section('Record', (s) => {
      s.append(row('Missions worked', c.shifts));
      s.append(row('Parcels delivered', c.delivered));
      s.append(row('Perfect', c.outcomes.perfect));
      s.append(row('Nice', c.outcomes.nice));
      s.append(row('Sloppy', c.outcomes.sloppy));
      s.append(row('Doorstep', c.outcomes.doorstep));
      s.append(row('Lucky', c.outcomes.lucky));
      s.append(row('Wrong address', c.wrongAddress));
      s.append(row('Best streak', c.bestStreak));
      s.append(row('Coins earned', c.coins));
      s.append(row('Total stars', c.stars));
      const golden = E('div', 'career-sub');
      golden.append(E('div', 'career-lbl', 'Golden parcels'));
      const g = E('div', 'career-val career-val-col');
      let any = false;
      for (const nb of Object.keys(c.golden)) { g.append(E('div', null, nb + ': ' + c.golden[nb])); any = true; }
      if (!any) g.append(E('div', null, '—'));
      golden.append(g);
      s.append(golden);
      s.append(row('Suburbs visited', c.suburbs.length + (c.suburbs.length ? ' (' + c.suburbs.join(', ') + ')' : '')));
    }));

    // Mischief.
    scroll.append(section('Mischief', (s) => {
      s.append(row('People bowled', c.bowled));
      s.append(row('STRIKEs', c.strikes));
      s.append(row('Windows broken', c.windows));
      s.append(row('Times BUSTED', c.busted));
      s.append(row('Highest heat', c.maxHeat));
    }));

    // Slapstick.
    scroll.append(section('Slapstick', (s) => {
      for (const k of ['car', 'dog', 'skater', 'bees', 'bin', 'grump']) s.append(row('Knockdown · ' + k, c.knockdowns[k]));
      s.append(row('Parcels stolen by dogs', c.stolen));
      s.append(row('Cakes splatted', c.splats));
      s.append(row('Trampoline bounces', c.trampoline));
      const dist = E('div', 'career-sub');
      dist.append(E('div', 'career-lbl', 'Distance travelled'));
      const dv = E('div', 'career-val career-val-col');
      let anyD = false;
      for (const v of Object.keys(c.distance)) { dv.append(E('div', null, v + ': ' + (c.distance[v] / 1000).toFixed(1) + ' km')); anyD = true; }
      if (!anyD) dv.append(E('div', null, '—'));
      dist.append(dv);
      s.append(dist);
    }));

    // Achievements: earned in colour + date, the rest greyed with the hint.
    scroll.append(section('Achievements', (s) => {
      const list = achievements ? achievements() : [];
      for (const a of list) {
        const item = E('div', 'ach' + (a.earned ? ' earned' : ''));
        item.append(E('span', 'ach-icon', a.icon), E('span', 'ach-name', a.name), E('span', 'ach-meta', a.earned && a.date ? a.date : a.description));
        s.append(item);
      }
    }));

    page.append(scroll);
    container.append(page);
    scrollEl = scroll;
  }

  function handleKey(e) {
    if (!scrollEl) return;
    const c = e.code;
    if (c === 'ArrowUp' || c === 'KeyW') scrollEl.scrollTop = Math.max(0, scrollEl.scrollTop - 40);
    else if (c === 'ArrowDown' || c === 'KeyS') scrollEl.scrollTop = Math.min(scrollEl.scrollHeight, scrollEl.scrollTop + 40);
  }

  render();
  return { render, handleKey };
}
