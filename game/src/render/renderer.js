import * as THREE from 'three';

// §8 quality presets. `antialias` is a WebGL context flag: changing it
// needs a page reload (the settings screen says so).
export const QUALITIES = {
  high: { fps: 60, pixelRatioCap: 1.5, antialias: true, shadowSize: 2048, shadowFilter: THREE.PCFSoftShadowMap },
  balanced: { fps: 60, pixelRatioCap: 1.25, antialias: true, shadowSize: 1024, shadowFilter: THREE.PCFShadowMap },
  battery: { fps: 30, pixelRatioCap: 1.0, antialias: false, shadowSize: 0, shadowFilter: 0 },
};

export function createRenderer(canvas, qualityName = 'high') {
  const quality = QUALITIES[qualityName] || QUALITIES.high;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: quality.antialias });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // Neutral (not ACES): ACES desaturates and flattens the pastel palette (§7.3).
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality.pixelRatioCap));
  renderer.shadowMap.enabled = quality.shadowSize > 0;
  renderer.shadowMap.type = quality.shadowFilter;
  return { renderer, quality, name: qualityName, targetFps: quality.fps };
}

export function resizeRenderer(renderer, camera) {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
