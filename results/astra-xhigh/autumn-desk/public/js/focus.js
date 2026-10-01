export const targets = {
  window: { look: [0, 3.45, -2.7], position: [0.1, 3.6, 2.5], distance: 5.2 },
  laptop: { look: [1.65, 1.99, -0.4], position: [1.65, 2.55, 2.8], distance: 3.4 },
  notebook: { look: [-0.35, 1.03, 1.12], position: [-0.35, 4.1, 2.8], distance: 3.6 },
  calendar: { look: [-2, 1.62, -0.5], position: [-2, 2.15, 2.5], distance: 3.1 },
};

export class FocusController {
  constructor(aspect = 1) {
    this.active = null;
    this.aspect = aspect;
    this.position = [...this.pose().position];
    this.look = [...this.pose().look];
  }

  pose() {
    const mobile = this.aspect < 0.85;
    if (!this.active) {
      return { position: mobile ? [0.4, 6.2, 15.5] : [6.4, 5.7, 10.6], look: [0, 2, -0.55] };
    }
    const target = targets[this.active];
    const ratio = mobile ? Math.max(1, 0.95 / this.aspect) : 1;
    return {
      look: target.look,
      position: target.position.map((v, i) => target.look[i] + (v - target.look[i]) * ratio),
    };
  }

  select(id) {
    this.active = id && targets[id] && this.active !== id ? id : null;
  }

  home() {
    this.active = null;
  }

  resize(aspect) {
    this.aspect = aspect;
  }

  update(dt) {
    const next = this.pose();
    const alpha = 1 - Math.exp(-5 * Math.min(Math.max(dt, 0), 0.05));
    for (let i = 0; i < 3; i++) {
      this.position[i] += (next.position[i] - this.position[i]) * alpha;
      this.look[i] += (next.look[i] - this.look[i]) * alpha;
    }
  }
}
