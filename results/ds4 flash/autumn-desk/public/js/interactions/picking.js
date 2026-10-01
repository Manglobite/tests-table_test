// Hit testing for the four interactive objects.
//
// Picking walks the real scene graph with a Raycaster: the object under the
// pointer is resolved by following `userData.focusId` up the parent chain.
// This is true geometry picking, not a screen-coordinate lookup table.

import { THREE } from "../core/three-import.js";

export class Picker {
  /**
   * @param {object} options
   * @param {THREE.Camera} options.camera
   * @param {THREE.Object3D[]} options.targets interactive subtrees to test
   * @param {HTMLElement} options.domElement
   */
  constructor({ camera, targets, domElement }) {
    this.camera = camera;
    this.targets = targets;
    this.domElement = domElement;
    this.raycaster = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
    this.pointer = new THREE.Vector2();
    this.hasPointer = false;
  }

  setPointer(clientX, clientY) {
    const rect = this.domElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    this.pointer.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.hasPointer = true;
  }

  /**
   * @returns {{id:string|null, point:THREE.Vector3|null, distance:number}}
   */
  pick() {
    if (!this.hasPointer) return { id: null, point: null, distance: Infinity };
    this.ndc.copy(this.pointer);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    // Only the interactive subtrees are tested, so decorative transparent
    // geometry (sun beam, drifting leaves) can never block a click.
    const hits = this.raycaster.intersectObjects(this.targets, true);
    for (const hit of hits) {
      const id = resolveFocusId(hit.object);
      if (id) {
        return { id, point: hit.point, distance: hit.distance, object: hit.object };
      }
    }
    return { id: null, point: null, distance: Infinity };
  }
}

export function resolveFocusId(object) {
  let node = object;
  while (node) {
    if (node.userData && node.userData.focusId) return node.userData.focusId;
    node = node.parent;
  }
  return null;
}

/**
 * Normalise a pointer event time into the "tap" decision used to distinguish
 * a click from a camera drag.  Pure and testable.
 */
export function isTap({ downX, downY, upX, upY, downTime, upTime }, { move = 10, ms = 500 } = {}) {
  const dx = upX - downX;
  const dy = upY - downY;
  const moved = Math.hypot(dx, dy);
  return moved <= move && upTime - downTime <= ms;
}
