// Проверки интеракций (headless, без браузера): машина состояний фокуса,
// плавность переходов и перенацеливания камеры, адаптация под портретный
// экран, корректность picking по объектам сцены.
// Запуск: node scripts/check-interactions.mjs

import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from '../public/vendor/three.module.js';
import { CameraRig } from '../public/js/camera-rig.js';
import { FocusManager } from '../public/js/interactions.js';
import { pickFocusId } from '../public/js/picking.js';
import { FOCUS_PRESETS, FOCUSABLE } from '../public/js/config.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
const ok = (name) => {
  passed++;
  console.log(`  ok  ${name}`);
};

// ---------- 1. Пресеты четырёх объектов присутствуют и различны
assert.deepEqual(FOCUSABLE, ['window', 'laptop', 'notebook', 'calendar']);
for (const id of FOCUSABLE) {
  const p = FOCUS_PRESETS[id];
  assert.ok(p, `нет пресета ${id}`);
  assert.equal(p.target.length, 3);
  assert.equal(p.offset.length, 3);
  assert.ok(p.fov > 10 && p.fov < 100);
  assert.ok(p.frameWidth > 0.1);
}
assert.notDeepEqual(FOCUS_PRESETS.laptop.target, FOCUS_PRESETS.window.target);
ok('пресеты окна, ноутбука, блокнота и календаря настроены');

// ---------- 2. Машина состояний FocusManager
{
  const camera = new THREE.PerspectiveCamera(41, 1.6, 0.05, 30);
  const rig = new CameraRig(camera, FOCUS_PRESETS);
  const events = [];
  const focus = new FocusManager(rig, FOCUS_PRESETS, {
    onStateChange: (id) => events.push(id),
  });
  const hooks = {};
  for (const id of FOCUSABLE) {
    hooks[id] = { enter: 0, leave: 0 };
    focus.register(id, {
      onEnter: () => hooks[id].enter++,
      onLeave: () => hooks[id].leave++,
    });
  }

  for (const id of FOCUSABLE) {
    focus.select(id);
    assert.equal(focus.current, id);
    assert.equal(rig.presetId, id);
    assert.equal(hooks[id].enter, 1);
    // повторный выбор того же объекта -> home
    focus.select(id);
    assert.equal(focus.current, null);
    assert.equal(rig.presetId, 'home');
    assert.equal(hooks[id].leave, 1);
  }
  ok('фокус на каждом из 4 объектов; повторный тап возвращает home');

  focus.select('window');
  focus.select('laptop'); // перенацеливание
  assert.equal(focus.current, 'laptop');
  assert.equal(hooks.window.leave, 2);
  assert.equal(hooks.laptop.enter, 2);
  focus.handleBackground();
  assert.equal(focus.current, null);
  focus.select('notebook');
  focus.handleEscape();
  assert.equal(focus.current, null);
  ok('фон и Esc возвращают home; смена объекта корректно меняет хуки');

  assert.ok(events.includes('window') && events.includes('home'));
  ok('события смены состояния приходят для подписи ракурса');
}

// ---------- 3. Плавность: без рывков и телепортаций, retarget посреди полёта
{
  const camera = new THREE.PerspectiveCamera(41, 1.6, 0.05, 30);
  const rig = new CameraRig(camera, FOCUS_PRESETS);
  const dt = 1 / 60;
  let maxStep = 0;
  let teleports = 0;
  const step = () => {
    const before = camera.position.clone();
    rig.update(dt);
    const step = camera.position.distanceTo(before);
    maxStep = Math.max(maxStep, step);
    if (step > 0.5) teleports++;
  };
  rig.applyPreset('home', { immediate: true });
  for (let i = 0; i < 30; i++) step(); // 0.5 c home
  rig.applyPreset('window');
  for (let i = 0; i < 30; i++) step(); // 0.5 c к окну...
  rig.applyPreset('laptop'); // ...и перенацеливание ещё до прилёта
  for (let i = 0; i < 60; i++) step();
  rig.applyPreset('calendar'); // ещё один retarget
  for (let i = 0; i < 240; i++) step();
  assert.equal(teleports, 0, 'были телепортации');
  assert.ok(maxStep < 0.35, `слишком большой шаг: ${maxStep.toFixed(3)}`);
  assert.ok(rig.settled, 'камера не сошлась к цели');
  const goal = new THREE.Vector3(...FOCUS_PRESETS.calendar.target)
    .addScaledVector(
      new THREE.Vector3(...FOCUS_PRESETS.calendar.offset).normalize(),
      rig.computeFraming(FOCUS_PRESETS.calendar).distance
    );
  assert.ok(camera.position.distanceTo(goal) < 0.02, 'камера не в целевой точке');
  ok(`переходы плавные (макс. шаг ${maxStep.toFixed(3)}), retarget без рывка, схождение к цели`);
}

// ---------- 4. Адаптация к портретной ориентации: объект влезает по ширине
{
  const camera = new THREE.PerspectiveCamera(41, 0.5, 0.05, 30);
  const rig = new CameraRig(camera, FOCUS_PRESETS);
  rig.setViewport(0.5); // узкий экран
  const distPortrait = rig.computeFraming(FOCUS_PRESETS.laptop).distance;
  rig.setViewport(1.8); // широкий экран
  const distWide = rig.computeFraming(FOCUS_PRESETS.laptop).distance;
  assert.ok(distPortrait > distWide, 'на портретном экране камера не отъезжает');
  // дистанции остаются умеренными (без «телескопа» из-за тумана/дальности)
  for (const id of FOCUSABLE.concat('home')) {
    const base = new THREE.Vector3(...FOCUS_PRESETS[id].offset).length();
    assert.ok(rig.computeFraming(FOCUS_PRESETS[id]).distance <= base * 1.95,
      `${id}: чрезмерный отъезд камеры на портрете`);
  }
  // проверка фактической ширины кадра на цели
  for (const aspect of [0.45, 0.75, 1.3, 1.9]) {
    rig.setViewport(aspect);
    rig.applyPreset('laptop', { immediate: true });
    const dir = new THREE.Vector3(...FOCUS_PRESETS.laptop.offset).normalize();
    const target = new THREE.Vector3(...FOCUS_PRESETS.laptop.target);
    const vFov = THREE.MathUtils.degToRad(camera.fov);
    const hHalf = Math.atan(Math.tan(vFov / 2) * aspect);
    const dist = camera.position.distanceTo(target);
    const visibleW = 2 * Math.tan(hHalf) * dist;
    assert.ok(
      visibleW >= FOCUS_PRESETS.laptop.frameWidth * 0.999,
      `aspect ${aspect}: видна ширина ${visibleW.toFixed(2)} < требуемой ${FOCUS_PRESETS.laptop.frameWidth}`
    );
    assert.ok(
      Math.abs(dir.dot(camera.position.clone().sub(target).normalize()) - 1) < 1e-6,
      'камера ушла с направления пресета'
    );
  }
  ok('портретная/широкая адаптация: требуемая ширина объекта влезает в кадр');
}

// ---------- 5. Picking: выбор по объектам сцены, а не по координатам
{
  const camera = new THREE.PerspectiveCamera(41, 800 / 600, 0.05, 30);
  camera.position.set(0, 1.5, 3);
  camera.lookAt(0, 1.5, 0);

  const mkObj = (id, x, size) => {
    const g = new THREE.Group();
    g.userData.focusId = id;
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(size, size, size),
      new THREE.MeshBasicMaterial()
    );
    m.position.set(x, 1.5, 0);
    g.add(m);
    return g;
  };
  const targets = [
    mkObj('window', -1.2, 0.8),
    mkObj('laptop', 0, 0.8),
    mkObj('calendar', 1.2, 0.8),
  ];
  const rect = { left: 0, top: 0, width: 800, height: 600 };

  const center = pickFocusId(400, 300, rect, camera, targets);
  assert.equal(center, 'laptop');
  const left = pickFocusId(80, 300, rect, camera, targets);
  assert.equal(left, 'window');
  const right = pickFocusId(720, 300, rect, camera, targets);
  assert.equal(right, 'calendar');
  const bg = pickFocusId(400, 20, rect, camera, targets);
  assert.equal(bg, null);
  ok('hit-testing выбирает объекты сцены; мимо объектов — фон (home)');
}

// ---------- 6. Синтаксис всех публичных модулей (import без DOM-ошибок)
{
  // камера-риг/интеракции/пикинг уже импортированы выше — это и есть проверка.
  ok('модули camera-rig/interactions/picking импортируются и работают headless');
}

console.log(`\ncheck-interactions: пройдено ${passed}`);
