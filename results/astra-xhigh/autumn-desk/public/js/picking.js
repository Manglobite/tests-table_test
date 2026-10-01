import * as THREE from '../tree_js/package/build/three.module.js';

export function resolveFocus(object) {
  for (let current = object; current; current = current.parent) {
    if (current.userData?.focusId) return current.userData.focusId;
  }
  return null;
}

export function bindPicking(canvas, camera, scene, focus) {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let down = null;
  function pick(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    scene.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(scene.children, true)[0];
    return hit ? resolveFocus(hit.object) : null;
  }
  function start(event) {
    if (!event.isPrimary || event.button !== 0) return;
    down = { x: event.clientX, y: event.clientY, id: event.pointerId };
    canvas.setPointerCapture(event.pointerId);
  }
  function end(event) {
    if (!down || down.id !== event.pointerId) return;
    const distance = Math.hypot(event.clientX - down.x, event.clientY - down.y);
    down = null;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    if (distance < 14) focus.select(pick(event));
  }
  function cancel() { down = null; }
  function move(event) {
    if (event.pointerType === 'mouse') canvas.style.cursor = pick(event) ? 'pointer' : 'default';
  }
  function key(event) { if (event.key === 'Escape') focus.home(); }
  const handlers = { pointerdown: start, pointerup: end, pointercancel: cancel, lostpointercapture: cancel, pointermove: move };
  for (const [name, handler] of Object.entries(handlers)) canvas.addEventListener(name, handler);
  window.addEventListener('keydown', key);
  return () => {
    for (const [name, handler] of Object.entries(handlers)) canvas.removeEventListener(name, handler);
    window.removeEventListener('keydown', key);
  };
}
