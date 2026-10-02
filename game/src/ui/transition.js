// §2.18: the suburb-to-suburb transition. A full-screen fade + a "sign card"
// (the destination's name + a one-line region blurb) that reads like a
// road-sign you pass when driving between neighborhoods. `begin(title, sub,
// onDone)` fades out, runs `onDone` (the actual world swap) mid-fade, holds the
// card briefly, then fades back in. `hold(title, sub)` keeps the card up for
// screenshots.

function make(tag, cls, text) {
  const e = document.createElement(tag);
  e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

export function createTransition(ui) {
  const overlay = make('div', 'nb-transition');
  const card = make('div', 'nb-sign-card');
  const eyebrow = make('div', 'nb-sign-eyebrow', 'TRAVELING TO');
  const title = make('div', 'nb-sign-title', '');
  const blurb = make('div', 'nb-sign-blurb', '');
  card.append(eyebrow, title, blurb);
  overlay.append(card);
  overlay.style.display = 'none';
  ui.appendChild(overlay);

  let busy = false;
  let held = false;

  function showCard(subTitle, subBlurb) {
    title.textContent = subTitle || '';
    blurb.textContent = subBlurb || '';
    blurb.style.display = subBlurb ? '' : 'none';
  }

  function begin(subTitle, subBlurb, onDone) {
    if (busy) return;
    busy = true;
    held = false;
    showCard(subTitle, subBlurb);
    overlay.style.display = 'flex';
    requestAnimationFrame(() => overlay.classList.add('shown'));
    // Run the swap mid-fade (the screen is dark), hold the card, then fade back.
    setTimeout(() => {
      onDone && onDone();
      setTimeout(() => {
        overlay.classList.remove('shown');
        busy = false;
        setTimeout(() => { if (!held) overlay.style.display = 'none'; }, 400);
      }, 500);
    }, 650);
  }

  // Static hold for the m14-exit-sign shot (the card stays up, no fade cycle).
  function hold(subTitle, subBlurb) {
    held = true;
    showCard(subTitle, subBlurb);
    overlay.style.display = 'flex';
    requestAnimationFrame(() => overlay.classList.add('shown'));
  }
  function release() {
    held = false;
    overlay.classList.remove('shown');
    setTimeout(() => { if (!busy && !held) overlay.style.display = 'none'; }, 400);
  }
  function isHeld() { return held; }

  return { begin, hold, release, isHeld, overlay, card };
}
