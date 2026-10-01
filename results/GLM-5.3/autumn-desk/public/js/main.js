// Точка входа: проверка WebGL, жизненный цикл рендера, ввод, адаптивность,
// фокус-интеракции и очистка ресурсов.

import * as THREE from '../vendor/three.module.js';
import { FOCUS_PRESETS, QUALITY } from './config.js';
import { buildScene } from './scene.js';
import { CameraRig } from './camera-rig.js';
import { pickFocusId } from './picking.js';
import { FocusManager } from './interactions.js';
import { showFatal, ViewCaption, LaptopPasswordInput, projectQuad } from './ui.js';

function webglProbe() {
  const results = {};
  try {
    const c = document.createElement('canvas');
    for (const type of ['webgl2', 'webgl', 'experimental-webgl']) {
      try {
        results[type] = !!c.getContext(type);
      } catch (err) {
        results[type] = 'throw: ' + err.message;
      }
    }
  } catch (err) {
    results.probe = 'throw: ' + err.message;
  }
  return results;
}

const canvas = document.getElementById('scene');

const probe = webglProbe();
const hasWebGL = probe.webgl2 === true || probe.webgl === true || probe.experimentalWebgl === true || probe['experimental-webgl'] === true;
if (!hasWebGL) {
  const ua = navigator.userAgent;
  const detail = Object.entries(probe).map(([k, v]) => `${k}:${v}`).join(', ');
  showFatal(`В браузере недоступен WebGL (${detail}). Аппаратное ускорение включено? chrome://gpu → Graphics Feature Status. UA: ${ua}`);
} else {
  start();
}

function start() {
  const isTouch = window.matchMedia('(pointer: coarse)').matches;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
  } catch (err) {
    showFatal('Не удалось инициализировать WebGL: ' + err.message);
    return;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, QUALITY.dprCap));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const camera = new THREE.PerspectiveCamera(41, 1, 0.05, 30);
  const built = buildScene({ isTouch });
  const rig = new CameraRig(camera, FOCUS_PRESETS);
  const caption = new ViewCaption();

  // ---- Демонстрационный ввод пароля (только память вкладки)
  const passwordInput = new LaptopPasswordInput({
    onSubmit: () => {
      built.laptop.setPassword(passwordInput.value);
      built.laptop.submit();
      passwordInput.clear();
    },
  });
  passwordInput.attach();
  built.laptop.setPassword('');
  built.laptop.onCleared = () => passwordInput.clear();

  const focus = new FocusManager(rig, FOCUS_PRESETS, {
    onStateChange: (id, label) => caption.set(label),
  });
  focus.register('laptop', {
    onEnter: () => passwordInput.show(),
    onLeave: () => passwordInput.hide(),
  });

  // ---- Размеры
  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    const aspect = w / Math.max(h, 1);
    camera.aspect = aspect;
    rig.setViewport(aspect);
  }
  resize();

  // ---- Ввод: тап/клик по объектам, фон, Esc
  let downX = 0;
  let downY = 0;
  let downTime = 0;
  const PICK_SLOP = 10; // px
  const PICK_MS = 700;

  const onPointerDown = (e) => {
    downX = e.clientX;
    downY = e.clientY;
    downTime = performance.now();
  };

  const onPointerUp = (e) => {
    const moved = Math.hypot(e.clientX - downX, e.clientY - downY);
    const elapsed = performance.now() - downTime;
    if (moved > PICK_SLOP || elapsed > PICK_MS) return;
    const rect = canvas.getBoundingClientRect();
    const id = pickFocusId(e.clientX, e.clientY, rect, camera, built.pickTargets);
    if (id) {
      if (id === 'laptop' && focus.current === 'laptop') {
        // повторный тап по ноутбуку при активном вводе — не считаем фоновым
      }
      focus.select(id);
    } else {
      // тап по полону ноутбука уходит в input; сюда попадают клики по фону
      focus.handleBackground();
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') focus.handleEscape();
  };

  // Ховер-курсор на точных указателях
  let hoverPending = false;
  const onPointerMove = (e) => {
    if (isTouch || hoverPending) return;
    hoverPending = true;
    requestAnimationFrame(() => {
      hoverPending = false;
      const rect = canvas.getBoundingClientRect();
      const id = pickFocusId(e.clientX, e.clientY, rect, camera, built.pickTargets);
      canvas.style.cursor = id ? 'pointer' : 'default';
    });
  };

  const onContextLost = (e) => {
    e.preventDefault();
    showFatal('Контекст WebGL потерян. Обновите страницу, чтобы продолжить.');
  };

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('webglcontextlost', onContextLost, false);
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);
  window.addEventListener('keydown', onKeyDown);

  // ---- Цикл рендера
  const clock = new THREE.Clock();
  let raf = 0;
  let running = true;

  function frame() {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    rig.update(dt);
    built.update(dt, t);

    // синхронизация пароля с экраном ноутбука + позиция поля ввода
    if (focus.current === 'laptop') {
      built.laptop.setPassword(passwordInput.value);
      const rect = canvas.getBoundingClientRect();
      const q = projectQuad(built.laptop.screenMesh, camera, rect);
      passwordInput.place(q);
    }

    renderer.render(built.scene, camera);
  }
  frame();

  // ---- Очистка (нет утечек обработчиков и ресурсов)
  function dispose() {
    running = false;
    cancelAnimationFrame(raf);
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointerup', onPointerUp);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('webglcontextlost', onContextLost);
    window.removeEventListener('resize', resize);
    window.removeEventListener('orientationchange', resize);
    window.removeEventListener('keydown', onKeyDown);
    passwordInput.detach();
    caption.destroy();
    built.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of ms) {
          for (const key of Object.keys(m)) {
            const v = m[key];
            if (v && v.isTexture) v.dispose();
          }
          m.dispose();
        }
      }
    });
    renderer.dispose();
  }
  window.addEventListener('pagehide', dispose, { once: true });
}
