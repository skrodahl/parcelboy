// M15a.18: a one-time top-down snapshot of the suburb, rendered once at load and
// reused as the radar's base map (replacing the 6px/tile hand-painted bitmap).
// It reuses the live scene: force noon lighting + hide the actors + sky, render
// the static world straight down into a render target, read the pixels back
// into a 2D canvas, then restore lighting/visibility and dispose the RT (§8).
import * as THREE from 'three';

// The "noon" preset (data/timeOfDay.js): a high, warm, near-straight-down sun —
// flat and legible for a top-down map.
const NOON = { sunDir: [0.2, 0.95, 0.25], sunColor: '#fff8e7', sunIntensity: 2.8, hemiSky: '#caf0f8', hemiGround: '#a7d88c', hemiIntensity: 1.2 };

export function renderRadarSnapshot({ scene, world, lighting, renderer }) {
  const tm = world.tilemap;
  const worldW = tm.width * tm.tileSize, worldH = tm.height * tm.tileSize;
  const cx = worldW / 2, cz = worldH / 2;

  // The render target's aspect must equal the world's aspect (worldW:worldH) so
  // the ortho view is undistorted; the longest edge is ~2048px.
  let texW, texH;
  if (worldW >= worldH) { texW = 2048; texH = Math.max(1, Math.round(2048 * worldH / worldW)); }
  else { texH = 2048; texW = Math.max(1, Math.round(2048 * worldW / worldH)); }

  // A dedicated top-down ortho camera (only the view is new, no new geometry).
  const cam = new THREE.OrthographicCamera(-worldW / 2, worldW / 2, worldH / 2, -worldH / 2, 1, 500);
  cam.position.set(cx, 240, cz);
  cam.up.set(0, 0, -1); // screen-up = north, screen-right = east
  cam.lookAt(cx, 0, cz);

  const rt = new THREE.WebGLRenderTarget(texW, texH);
  rt.texture.colorSpace = THREE.SRGBColorSpace;

  // Save the live lighting + fog so we can restore them exactly.
  const savedLight = {
    sunDir: [lighting.sun.position.x, lighting.sun.position.y, lighting.sun.position.z],
    sunColor: lighting.sun.color.clone(), sunIntensity: lighting.sun.intensity,
    hemiSky: lighting.hemi.color.clone(), hemiGround: lighting.hemi.groundColor.clone(),
    hemiIntensity: lighting.hemi.intensity, castShadow: lighting.sun.castShadow,
  };
  const savedFog = scene.fog;
  const hidden = [];
  lighting.apply(NOON);
  lighting.sun.castShadow = false;
  scene.fog = null; // a clean top-down map has no depth haze
  for (const c of scene.children) {
    if (c === world.group || c === lighting.sun || c === lighting.hemi || c === lighting.sun.target) continue;
    if (c.visible !== false) { hidden.push(c); c.visible = false; }
  }

  renderer.setRenderTarget(rt);
  renderer.render(scene, cam);
  renderer.setRenderTarget(null);

  // Read the pixels back into a 2D canvas the radar can drawImage from.
  const buf = new Uint8Array(texW * texH * 4);
  renderer.readRenderTargetPixels(rt, 0, 0, texW, texH, buf);
  const canvas = document.createElement('canvas');
  canvas.width = texW; canvas.height = texH;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(texW, texH);
  img.data.set(buf);
  ctx.putImageData(img, 0, 0);

  // Restore everything + dispose the render target we just replaced (§8).
  for (const c of hidden) c.visible = true;
  lighting.apply({ sunDir: savedLight.sunDir, sunColor: savedLight.sunColor, sunIntensity: savedLight.sunIntensity, hemiSky: savedLight.hemiSky, hemiGround: savedLight.hemiGround, hemiIntensity: savedLight.hemiIntensity });
  lighting.sun.castShadow = savedLight.castShadow;
  scene.fog = savedFog;
  rt.dispose();

  return { canvas, texW, texH, worldW, worldH };
}
