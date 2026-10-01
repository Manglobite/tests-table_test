// Free-look orbit controls (mouse drag + wheel, one-finger drag + pinch).
//
// The controller never owns the camera directly.  It rotates the camera
// around the rig's current look-at target and then asks the CameraFocus rig to
// *adopt* the result, so a hand-driven move and the animated focus transitions
// share one state machine without fighting each other.

import { THREE } from "../core/three-import.js";

const EPS = 1e-4;

export class OrbitController {
  constructor({ domElement, camera, focus, minDistance = 0.9, maxDistance = 9 }) {
    this.dom = domElement;
    this.camera = camera;
    this.focus = focus;
    this.minDistance = minDistance;
    this.maxDistance = maxDistance;

    this.active = false;
    this.dragging = false;
    this.pointers = new Map();
    this.lastPinch = 0;
    this.velocity = { theta: 0, phi: 0 };
    this.down = null;

    this._bind();
  }

  _bind() {
    this.onPointerDown = this._onPointerDown.bind(this);
    this.onPointerMove = this._onPointerMove.bind(this);
    this.onPointerUp = this._onPointerUp.bind(this);
    this.onWheel = this._onWheel.bind(this);
    this.onContext = (e) => e.preventDefault();

    this.dom.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("pointermove", this.onPointerMove, { passive: false });
    window.addEventListener("pointerup", this.onPointerUp);
    window.addEventListener("pointercancel", this.onPointerUp);
    this.dom.addEventListener("wheel", this.onWheel, { passive: false });
    this.dom.addEventListener("contextmenu", this.onContext);
  }

  dispose() {
    this.dom.removeEventListener("pointerdown", this.onPointerDown);
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerup", this.onPointerUp);
    window.removeEventListener("pointercancel", this.onPointerUp);
    this.dom.removeEventListener("wheel", this.onWheel);
    this.dom.removeEventListener("contextmenu", this.onContext);
    this.pointers.clear();
  }

  _onPointerDown(event) {
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    this.dom.setPointerCapture?.(event.pointerId);
    this.active = true;
    this.dragging = false;
    this.velocity.theta = 0;
    this.velocity.phi = 0;
    this.down = { x: event.clientX, y: event.clientY, time: performance.now() };
    if (this.pointers.size === 2) this.lastPinch = this._pinchDistance();
  }

  _onPointerMove(event) {
    if (!this.pointers.has(event.pointerId)) return;
    const prev = this.pointers.get(event.pointerId);
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (this.pointers.size >= 2) {
      event.preventDefault();
      const dist = this._pinchDistance();
      if (this.lastPinch > 0) {
        this._zoom(this.lastPinch / dist);
      }
      this.lastPinch = dist;
      this.dragging = true;
      return;
    }

    const dx = event.clientX - prev.x;
    const dy = event.clientY - prev.y;
    if (!this.dragging) {
      const total = Math.hypot(event.clientX - this.down.x, event.clientY - this.down.y);
      if (total < 6) return;
      this.dragging = true;
    }
    event.preventDefault();
    this._rotate(dx, dy);
  }

  _onPointerUp(event) {
    this.pointers.delete(event.pointerId);
    this.dom.releasePointerCapture?.(event.pointerId);
    if (this.pointers.size < 2) this.lastPinch = 0;
    if (this.pointers.size === 0) this.active = false;
  }

  _onWheel(event) {
    event.preventDefault();
    this._zoom(1 + Math.sign(event.deltaY) * 0.12);
  }

  _pinchDistance() {
    const pts = [...this.pointers.values()];
    if (pts.length < 2) return 0;
    return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  }

  _rotate(dx, dy) {
    const target = this.focus.current.target;
    const offset = new THREE.Vector3(
      this.camera.position.x - target.x,
      this.camera.position.y - target.y,
      this.camera.position.z - target.z,
    );
    const spherical = new THREE.Spherical().setFromVector3(offset);

    const dTheta = -dx * 0.005;
    const dPhi = -dy * 0.005;
    spherical.theta += dTheta;
    spherical.phi = THREE.MathUtils.clamp(
      spherical.phi + dPhi,
      0.12,
      Math.PI - 0.12,
    );
    spherical.radius = THREE.MathUtils.clamp(
      spherical.radius,
      this.minDistance,
      this.maxDistance,
    );

    this.velocity.theta = dTheta;
    this.velocity.phi = dPhi;

    const pos = new THREE.Vector3().setFromSpherical(spherical);
    this.camera.position.set(target.x + pos.x, target.y + pos.y, target.z + pos.z);
    this.camera.lookAt(target.x, target.y, target.z);
    this.focus.adopt({
      position: { x: this.camera.position.x, y: this.camera.position.y, z: this.camera.position.z },
      target: { x: target.x, y: target.y, z: target.z },
      fov: this.camera.fov,
    });
  }

  _zoom(factor) {
    const target = this.focus.current.target;
    const offset = new THREE.Vector3(
      this.camera.position.x - target.x,
      this.camera.position.y - target.y,
      this.camera.position.z - target.z,
    );
    const radius = THREE.MathUtils.clamp(
      offset.length() * factor,
      this.minDistance,
      this.maxDistance,
    );
    offset.setLength(radius);
    this.camera.position.set(target.x + offset.x, target.y + offset.y, target.z + offset.z);
    this.camera.lookAt(target.x, target.y, target.z);
    this.focus.adopt({
      position: { x: this.camera.position.x, y: this.camera.position.y, z: this.camera.position.z },
      target: { x: target.x, y: target.y, z: target.z },
      fov: this.camera.fov,
    });
  }

  /** Whether the last pointer sequence should count as a tap/click. */
  wasTap(upX, upY) {
    if (!this.down) return false;
    const dx = upX - this.down.x;
    const dy = upY - this.down.y;
    return this.dragging === false && Math.hypot(dx, dy) <= 8;
  }

  resetMomentum() {
    this.velocity.theta = 0;
    this.velocity.phi = 0;
  }
}
