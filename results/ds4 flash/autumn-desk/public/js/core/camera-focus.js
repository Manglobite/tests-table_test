// Pure camera-focus engine.
//
// This module is intentionally free of THREE.js and of any DOM dependency so
// it can be unit-tested in Node.  It owns the *logic* of the cinematic
// camera: the home pose, per-object focus poses and the smooth, frame-rate
// independent interpolation between them.
//
// Interpolation strategy
// ----------------------
// Instead of a fixed-duration tween (which would teleport or snap when the
// target changes mid-flight) we use exponential damping toward the goal:
//
//     alpha = 1 - exp(-damping * dt)
//     current += (goal - current) * alpha
//
// * It is frame-rate independent (large dt -> larger step, small dt -> smaller).
// * It can be retargeted at any moment without a discontinuity, because the
//   current pose is the integration state and the goal is just swapped.
// * It never overshoots.
//
// `arrived` is reported once every tracked value is within `epsilon`.

export function vec(x = 0, y = 0, z = 0) {
  return { x, y, z };
}

export function cloneVec(v) {
  return { x: v.x, y: v.y, z: v.z };
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// Frame-rate independent damping factor for a given time step.
export function dampFactor(damping, dt) {
  if (dt <= 0) return 0;
  return 1 - Math.exp(-Math.max(0, damping) * dt);
}

export function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function approachVector(current, goal, alpha) {
  current.x = lerp(current.x, goal.x, alpha);
  current.y = lerp(current.y, goal.y, alpha);
  current.z = lerp(current.z, goal.z, alpha);
  return current;
}

export function normalizePose(pose) {
  return {
    position: cloneVec(pose.position),
    target: cloneVec(pose.target),
    fov: pose.fov ?? 45,
  };
}

export class CameraFocus {
  /**
   * @param {object} options
   * @param {object} options.home     home pose {position,target,fov}
   * @param {number} [options.damping] damping strength (1/s). Higher = snappier.
   * @param {number} [options.epsilon] arrival threshold in world units.
   * @param {number} [options.fovEpsilon]
   */
  constructor({ home, damping = 5.5, epsilon = 0.01, fovEpsilon = 0.1 }) {
    this.homePose = normalizePose(home);
    this.damping = damping;
    this.epsilon = epsilon;
    this.fovEpsilon = fovEpsilon;

    this.current = normalizePose(home);
    this.goal = normalizePose(home);
    this.activeId = null; // null == home
    this.arrived = true;
  }

  /** Replace the home pose (e.g. on resize) and, if idle at home, adopt it. */
  setHome(pose) {
    this.homePose = normalizePose(pose);
    if (this.activeId === null && this.arrived) {
      this.current = normalizePose(pose);
      this.goal = normalizePose(pose);
    } else if (this.activeId === null) {
      this.goal = normalizePose(pose);
    }
  }

  /**
   * Focus a target.  Calling it for the already active id toggles back home,
   * which is exactly the interaction required by the task.
   * @returns {string|null} the resulting active id (null == home)
   */
  toggle(id, pose) {
    if (this.activeId === id) {
      this.goHome();
      return null;
    }
    return this.focus(id, pose);
  }

  focus(id, pose) {
    this.activeId = id;
    this.goal = normalizePose(pose);
    this.arrived = false;
    return id;
  }

  goHome() {
    this.activeId = null;
    this.goal = normalizePose(this.homePose);
    this.arrived = false;
    return null;
  }

  isAtHome() {
    return this.activeId === null;
  }

  /**
   * Advance the simulation.
   * @param {number} dt seconds
   * @returns {object} the resulting pose
   */
  update(dt) {
    const alpha = dampFactor(this.damping, dt);

    approachVector(this.current.position, this.goal.position, alpha);
    approachVector(this.current.target, this.goal.target, alpha);
    this.current.fov = lerp(this.current.fov, this.goal.fov, alpha);

    const posDone = distance(this.current.position, this.goal.position) <= this.epsilon;
    const tgtDone = distance(this.current.target, this.goal.target) <= this.epsilon;
    const fovDone = Math.abs(this.current.fov - this.goal.fov) <= this.fovEpsilon;

    if (posDone && tgtDone && fovDone) {
      // Snap exactly so the state is clean and stable.
      this.current = normalizePose(this.goal);
      this.arrived = true;
    } else {
      this.arrived = false;
    }
    return this.pose();
  }

  /**
   * Adopt an externally driven pose (e.g. after a manual orbit/drag) as the
   * new resting state.  No animation is scheduled, so hand control and the
   * automated focus rig never fight over the camera.
   */
  adopt(pose) {
    const normalized = normalizePose(pose);
    this.current = normalized;
    this.goal = normalizePose(pose);
    this.arrived = true;
    return this.pose();
  }

  /** Force the current pose to the goal immediately (used on first frame). */
  snapToGoal() {
    this.current = normalizePose(this.goal);
    this.arrived = true;
    return this.pose();
  }

  pose() {
    return {
      position: cloneVec(this.current.position),
      target: cloneVec(this.current.target),
      fov: this.current.fov,
      activeId: this.activeId,
      arrived: this.arrived,
    };
  }
}

/**
 * Build a camera pose that frames a bounding sphere-ish description.
 * Kept here (pure math) so both desktop and portrait layouts share logic.
 */
export function poseFromFraming({ center, direction, distance, fov = 45 }) {
  const len = Math.hypot(direction.x, direction.y, direction.z) || 1;
  const nx = direction.x / len;
  const ny = direction.y / len;
  const nz = direction.z / len;
  return {
    position: vec(
      center.x + nx * distance,
      center.y + ny * distance,
      center.z + nz * distance,
    ),
    target: vec(center.x, center.y, center.z),
    fov,
  };
}
