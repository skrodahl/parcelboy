// ?debug=1 overlay: fps, frame ms, draw calls, triangles, geometries,
// textures, active actors and the current quality preset.
// Updated at 4 Hz; a single getStats() callback supplies the values.
export function createDebugOverlay(getStats) {
  const el = document.createElement('div');
  el.id = 'debug';
  document.getElementById('ui').appendChild(el);
  setInterval(() => {
    const s = getStats();
    el.textContent =
      'fps: ' + s.fps + '  ms: ' + s.frameMs + '\n' +
      'calls: ' + s.drawCalls + '  tris: ' + s.triangles + '\n' +
      'geo: ' + s.geometries + '  tex: ' + s.textures + '\n' +
      'actors: ' + s.actors + '  quality: ' + s.quality + '\n' +
      'state: ' + s.state;
  }, 250);
}
