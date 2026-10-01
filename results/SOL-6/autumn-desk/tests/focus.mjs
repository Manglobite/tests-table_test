import assert from 'node:assert/strict';
import * as THREE from '../public/vendor/three.module.js';
import { FocusController, views } from '../public/js/focus.js';

const camera = new THREE.PerspectiveCamera();
camera.position.set(...views.home.position);
const focus = new FocusController(camera, views);
for (const key of ['window', 'laptop', 'notebook', 'calendar']) {
  focus.select(key);
  assert.equal(focus.current, key);
  for (let i = 0; i < 180; i++) focus.update(1 / 60);
  assert.ok(camera.position.distanceTo(new THREE.Vector3(...views[key].position)) < .001);
  focus.select(key);
  assert.equal(focus.current, 'home');
}
focus.select('laptop');
focus.update(1 / 60);
const before = camera.position.clone();
focus.select('calendar');
assert.equal(camera.position.distanceTo(before), 0);
focus.update(1 / 60);
assert.ok(camera.position.distanceTo(before) < 1);
focus.select('home');
assert.equal(focus.current, 'home');
focus.resize(.5);
assert.equal(camera.aspect, .5);
assert.equal(camera.fov, 66);
console.log('Camera focus tests passed');
