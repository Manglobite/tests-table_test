import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from '../public/tree_js/package/build/three.module.js';
import { createWorld } from '../public/js/world.js';
import { FocusController } from '../public/js/focus.js';
import { resolveFocus } from '../public/js/picking.js';

test('actual scene construction, finite animation, home framing and target accessibility', () => {
  const context = new Proxy({}, {
    get: (_target, key) => key === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => {},
    set: () => true,
  });
  globalThis.document = { createElement: () => ({ getContext: () => context }) };
  const { scene, objects, animate } = createWorld();
  for (const time of [0, 1, 100]) animate(time);
  scene.updateMatrixWorld(true);
  scene.traverse(object => {
    assert.ok(object.position.toArray().every(Number.isFinite));
    if (object.geometry) assert.ok(object.geometry.attributes.position.array.every(Number.isFinite));
  });
  const raycaster = new THREE.Raycaster();
  for (const aspect of [1440 / 900, 390 / 844, 360 / 640]) {
    const focus = new FocusController(aspect);
    const camera = new THREE.PerspectiveCamera(43, aspect, 0.1, 120);
    camera.position.fromArray(focus.position); camera.lookAt(...focus.look); camera.updateMatrixWorld(true);
    for (const [id, object] of Object.entries(objects)) {
      const bounds = new THREE.Box3().setFromObject(object);
      const center = bounds.getCenter(new THREE.Vector3());
      const screen = center.clone().project(camera);
      assert.ok(Math.abs(screen.x) < 0.95 && Math.abs(screen.y) < 0.95, `${id} outside home, aspect=${aspect}`);
      let accessible = false;
      for (let ix = -3; ix <= 3; ix++) for (let iy = -3; iy <= 3; iy++) {
        const point = center.clone();
        point.x += ix * (bounds.max.x - bounds.min.x) / 8;
        point.y += iy * (bounds.max.y - bounds.min.y) / 8;
        const projected = point.project(camera);
        raycaster.setFromCamera(new THREE.Vector2(projected.x, projected.y), camera);
        const hit = raycaster.intersectObjects(scene.children, true)[0];
        if (resolveFocus(hit?.object) === id) accessible = true;
      }
      assert.ok(accessible, `${id} occluded, aspect=${aspect}`);
    }
  }
  delete globalThis.document;
});
