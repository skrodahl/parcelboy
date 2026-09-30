import * as THREE from 'three';

// One HemisphereLight plus one DirectionalLight sun — nothing else (§7.3).
// Presets come from data/timeOfDay.js; apply(preset) updates in place.
export function createLighting(scene, preset) {
  const hemi = new THREE.HemisphereLight(new THREE.Color(preset.hemiSky), new THREE.Color(preset.hemiGround), preset.hemiIntensity);
  const sun = new THREE.DirectionalLight(new THREE.Color(preset.sunColor), preset.sunIntensity);
  sun.position.set(preset.sunDir[0], preset.sunDir[1], preset.sunDir[2]).normalize().multiplyScalar(60);
  sun.target.position.set(0, 0, 0);
  scene.add(hemi, sun, sun.target);

  function apply(p) {
    hemi.color.set(p.hemiSky);
    hemi.groundColor.set(p.hemiGround);
    hemi.intensity = p.hemiIntensity;
    sun.color.set(p.sunColor);
    sun.intensity = p.sunIntensity;
    sun.position.set(p.sunDir[0], p.sunDir[1], p.sunDir[2]).normalize().multiplyScalar(60);
  }
  return { sun, hemi, apply };
}
