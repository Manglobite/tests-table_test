// Hit-testing: выбор интерактивного объекта по координатам указателя.
// Чистая математика над THREE — без DOM и слушателей событий.

import * as THREE from '../vendor/three.module.js';

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();

export function ndcFromClient(clientX, clientY, rect) {
  return {
    x: ((clientX - rect.left) / rect.width) * 2 - 1,
    y: -((clientY - rect.top) / rect.height) * 2 + 1,
  };
}

function focusIdOf(object) {
  let o = object;
  while (o) {
    if (o.userData && o.userData.focusId) return o.userData.focusId;
    o = o.parent;
  }
  return null;
}

// pickTargets — массив корневых Object3D с userData.focusId.
// Возвращает id сфокусированного объекта или null (фон).
export function pickFocusId(clientX, clientY, rect, camera, pickTargets) {
  const p = ndcFromClient(clientX, clientY, rect);
  if (Math.abs(p.x) > 1 || Math.abs(p.y) > 1) return null;
  ndc.set(p.x, p.y);
  camera.updateMatrixWorld();
  for (const t of pickTargets) t.updateMatrixWorld(true);
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects(pickTargets, true);
  for (const hit of hits) {
    const id = focusIdOf(hit.object);
    if (id) return id;
  }
  return null;
}
