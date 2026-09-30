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
    paused: q.has('paused'),
  };
}
