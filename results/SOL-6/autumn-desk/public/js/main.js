import * as THREE from '../vendor/three.module.js';
import { makeScene } from './scene.js';
import { FocusController, views } from './focus.js';

const host = document.getElementById('scene');
const fallback = document.getElementById('fallback');
const password = document.getElementById('password');
const input = document.getElementById('demo-input');
const button = document.getElementById('demo-button');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
} catch {
  fallback.hidden = false;
}
if (renderer) {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.4;
  host.append(renderer.domElement);
  const { scene, targets, update } = makeScene();
  const camera = new THREE.PerspectiveCamera(48, 1, .05, 90);
  camera.position.set(...views.home.position);
  const focus = new FocusController(camera, views, key => {
    password.hidden = key !== 'laptop';
    if (key !== 'laptop') input.value = '';
  });
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const pickables = Object.entries(targets).flatMap(([key, group]) => {
    group.traverse(child => { if (child.isMesh) child.userData.focusKey = key; });
    return group.children;
  });
  function pick(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(pickables, true);
    focus.select(hits[0]?.object.userData.focusKey || 'home');
  }
  let press;
  renderer.domElement.addEventListener('pointerdown', e => { press = { x: e.clientX, y: e.clientY }; });
  renderer.domElement.addEventListener('pointerup', e => {
    if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) < 14) pick(e);
    press = null;
  });
  window.addEventListener('keydown', e => { if (e.key === 'Escape') focus.select('home'); });
  button.addEventListener('click', () => { input.value = ''; input.blur(); });
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { input.value = ''; input.blur(); } });
  const resize = () => {
    const width = host.clientWidth, height = host.clientHeight;
    renderer.setSize(width, height);
    focus.resize(width / height);
    const scale = width / height < .85 ? .78 : 1;
    focus.views.home.position = [0, 4.7, 9.6 / scale];
    if (focus.current === 'home') focus.destination.set(...focus.views.home.position);
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();
  const clock = new THREE.Clock();
  let frame;
  function animate() {
    frame = requestAnimationFrame(animate);
    const dt = clock.getDelta();
    focus.update(dt);
    update(clock.elapsedTime);
    renderer.render(scene, camera);
  }
  animate();
  window.addEventListener('pagehide', () => {
    cancelAnimationFrame(frame);
    observer.disconnect();
    scene.traverse(object => {
      if (object.geometry) object.geometry.dispose();
      if (object.material) {
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) { material.map?.dispose(); material.dispose(); }
      }
    });
    renderer.dispose();
  }, { once: true });
}
