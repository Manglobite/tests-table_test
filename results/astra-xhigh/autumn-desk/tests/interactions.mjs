import assert from 'node:assert/strict';
import test from 'node:test';
import { FocusController, targets } from '../public/js/focus.js';
import { bindPicking, resolveFocus } from '../public/js/picking.js';
import * as THREE from '../public/tree_js/package/build/three.module.js';

function settle(focus) { for (let i = 0; i < 240; i++) focus.update(1 / 60); }

for (const id of Object.keys(targets)) {
  test(`focus and repeat home: ${id}`, () => {
    const focus = new FocusController(1.7);
    focus.select(id); settle(focus);
    assert.equal(focus.active, id);
    assert.ok(Math.hypot(...focus.position.map((v, i) => v - targets[id].position[i])) < 0.001);
    focus.select(id); settle(focus);
    assert.equal(focus.active, null);
  });
}

test('retarget has no immediate jump and approaches new target', () => {
  const focus = new FocusController(1.7);
  focus.select('window'); focus.update(0.02);
  const previous = [...focus.position];
  focus.select('notebook');
  assert.deepEqual(focus.position, previous);
  focus.update(0.016);
  assert.ok(Math.hypot(...focus.position.map((v, i) => v - previous[i])) < 1);
  settle(focus);
  assert.ok(Math.abs(focus.position[0] - targets.notebook.position[0]) < 0.001);
  focus.select(null); assert.equal(focus.active, null);
  focus.select('calendar'); focus.home(); assert.equal(focus.active, null);
});

test('portrait resize preserves current position and increases framing distance', () => {
  const focus = new FocusController(1.7);
  focus.select('laptop'); settle(focus);
  const previous = [...focus.position];
  focus.resize(0.45);
  assert.deepEqual(focus.position, previous);
  assert.ok(focus.pose().position[2] > targets.laptop.position[2]);
  settle(focus);
  assert.ok(focus.position.every(Number.isFinite));
});

test('real raycasting, nested targets, background, Escape, drag, cleanup', () => {
  const handlers = new Map(), keys = new Map();
  globalThis.window = { addEventListener: (name, fn) => keys.set(name, fn), removeEventListener: name => keys.delete(name) };
  const canvas = {
    style: {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    addEventListener: (name, fn) => handlers.set(name, fn), removeEventListener: name => handlers.delete(name),
    setPointerCapture() {}, hasPointerCapture: () => false,
  };
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 800 / 600, 0.1, 100);
  camera.position.z = 6; camera.lookAt(0, 0, 0);
  const parent = new THREE.Group(); scene.add(parent);
  const object = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 1), new THREE.MeshBasicMaterial()); parent.add(object);
  const focus = new FocusController(1.7);
  const unbind = bindPicking(canvas, camera, scene, focus);
  const event = (x = 400, y = 300) => ({ clientX: x, clientY: y, isPrimary: true, button: 0, pointerId: 1 });
  function click(x, y) { handlers.get('pointerdown')(event(x, y)); handlers.get('pointerup')(event(x, y)); }
  for (const id of Object.keys(targets)) {
    parent.userData.focusId = id;
    assert.equal(resolveFocus(object), id);
    click(); assert.equal(focus.active, id);
    click(); assert.equal(focus.active, null);
  }
  click(); click(5, 5); assert.equal(focus.active, null);
  click(); keys.get('keydown')({ key: 'Escape' }); assert.equal(focus.active, null);
  handlers.get('pointerdown')(event()); handlers.get('pointerup')(event(450)); assert.equal(focus.active, null);
  unbind(); assert.equal(handlers.size, 0); assert.equal(keys.size, 0);
  object.geometry.dispose(); object.material.dispose(); delete globalThis.window;
});
