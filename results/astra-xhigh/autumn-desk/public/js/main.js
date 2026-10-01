import * as THREE from '../tree_js/package/build/three.module.js';
import { createWorld } from './world.js';
import { FocusController } from './focus.js';
import { bindPicking } from './picking.js';

const canvas = document.querySelector('#scene');
const error = document.querySelector('#error');
let dispose = () => {};

function initialize() {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  } catch {
    error.hidden = false;
    error.textContent = 'Не удалось запустить WebGL. Включите аппаратное ускорение или откройте страницу в браузере с поддержкой WebGL 2.';
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const { scene, animate } = createWorld();
  const camera = new THREE.PerspectiveCamera(43, 1, 0.1, 120);
  const focus = new FocusController(window.innerWidth / window.innerHeight);
  const unbind = bindPicking(canvas, camera, scene, focus);
  let frame = 0, last = performance.now(), elapsed = 0, stopped = false;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  function resize() {
    const width = canvas.clientWidth, height = Math.max(1, canvas.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    focus.resize(camera.aspect);
  }
  function render(now) {
    if (stopped) return;
    const dt = Math.min((now - last) / 1000, 0.05); last = now;
    focus.update(dt);
    camera.position.fromArray(focus.position);
    camera.lookAt(...focus.look);
    if (!reducedMotion.matches) elapsed += dt;
    animate(elapsed);
    renderer.render(scene, camera);
    frame = requestAnimationFrame(render);
  }
  function lost(event) {
    event.preventDefault();
    stopped = true; cancelAnimationFrame(frame);
    error.hidden = false;
    error.textContent = 'Графический контекст потерян. Восстановление сцены…';
  }
  function restored() { dispose(); error.hidden = true; initialize(); }
  function visibility() { last = performance.now(); }
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', visibility);
  canvas.addEventListener('webglcontextlost', lost);
  canvas.addEventListener('webglcontextrestored', restored);
  dispose = () => {
    stopped = true; cancelAnimationFrame(frame); unbind();
    window.removeEventListener('resize', resize);
    document.removeEventListener('visibilitychange', visibility);
    canvas.removeEventListener('webglcontextlost', lost);
    canvas.removeEventListener('webglcontextrestored', restored);
    const geometries = new Set(), materials = new Set(), textures = new Set();
    scene.traverse(object => {
      if (object.geometry) geometries.add(object.geometry);
      for (const mat of object.material ? (Array.isArray(object.material) ? object.material : [object.material]) : []) {
        materials.add(mat);
        for (const value of Object.values(mat)) if (value?.isTexture) textures.add(value);
      }
      object.shadow?.dispose();
    });
    for (const resource of [...geometries, ...materials, ...textures]) resource.dispose();
    renderer.dispose();
  };
  resize(); render(performance.now());
}

window.addEventListener('pagehide', () => dispose());
window.addEventListener('pageshow', event => { if (event.persisted) initialize(); });
initialize();
