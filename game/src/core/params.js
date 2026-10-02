export function parseParams() {
  const q = new URLSearchParams(location.search);
  const int = (k) => {
    const v = q.get(k);
    return v === null ? undefined : parseInt(v, 10);
  };
  return {
    debug: q.has('debug'),
    mute: q.has('mute'),
    quality: q.get('quality'),
    seed: int('seed'),
    scene: q.get('scene'),
    screen: q.get('screen'),
    autostart: q.get('autostart'),
    char: q.get('char'),
    veh: q.get('veh'),
    lineup: q.has('lineup'),
    cam: q.get('cam'),
    tod: q.get('tod'),
    nb: q.get('nb'), // §2.18: the neighborhood id (defaults to maple-hollow)
    paused: q.has('paused'),
    showCard: q.get('showCard'),
    coins: int('coins'), // §2.11: seed a coin balance for screenshots
    stars: int('stars'), // §2.18: seed the total-star count (exit-gate screenshots)
  };
}
