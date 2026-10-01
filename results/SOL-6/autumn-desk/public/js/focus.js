import * as THREE from '../vendor/three.module.js';

export class FocusController {
  constructor(camera, views, onChange = () => {}) {
    this.camera = camera;
    this.views = views;
    this.onChange = onChange;
    this.current = 'home';
    this.position = camera.position.clone();
    this.target = new THREE.Vector3(...views.home.target);
    this.destination = this.position.clone();
    this.lookAt = this.target.clone();
  }
  select(key) {
    const next = key === this.current ? 'home' : (key in this.views ? key : 'home');
    this.current = next;
    this.destination.set(...this.views[next].position);
    this.lookAt.set(...this.views[next].target);
    this.onChange(next);
  }
  update(dt) {
    const alpha = 1 - Math.exp(-4.2 * Math.min(dt, .1));
    this.camera.position.lerp(this.destination, alpha);
    this.target.lerp(this.lookAt, alpha);
    this.camera.lookAt(this.target);
  }
  resize(aspect) {
    this.camera.aspect = aspect;
    this.camera.fov = aspect < .85 ? 66 : 48;
    this.camera.updateProjectionMatrix();
  }
}

export const views = {
  home: { position: [0, 4.7, 9.6], target: [0, 1.7, -.45] },
  window: { position: [0, 3.65, 1.5], target: [0, 3.2, -3.2] },
  laptop: { position: [1.35, 2.38, 2.85], target: [1.45, 1.65, -.64] },
  notebook: { position: [-.35, 2.75, 3.15], target: [-.35, .82, 1.05] },
  calendar: { position: [-2, 2.25, 2.35], target: [-2, 1.17, -.15] }
};
