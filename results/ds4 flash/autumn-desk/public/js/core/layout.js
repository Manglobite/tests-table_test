// Pure, DOM-free layout math for the responsive camera.
//
// Two independent adaptations are needed:
//   1. Orientation: a narrow portrait screen gets the portrait home pose.
//   2. Aspect: a wide screen needs the camera pulled back so the desk is not
//      cropped; a narrow screen can come closer.
//
// All of it is expressed as small pure functions so it can be reasoned about
// and tested without a browser.

export const PORTRAIT_MAX_ASPECT = 1.05;
export const MOBILE_MAX_WIDTH = 820;

export function clamp(value, lo, hi) {
  return Math.min(hi, Math.max(lo, value));
}

/**
 * @returns {{portrait:boolean, mobile:boolean, aspect:number}}
 */
export function classifyViewport(width, height) {
  if (!(width > 0) || !(height > 0)) {
    return { portrait: true, mobile: true, aspect: 1 };
  }
  const aspect = width / height;
  const portrait = aspect < PORTRAIT_MAX_ASPECT;
  const mobile = width <= MOBILE_MAX_WIDTH;
  return { portrait, mobile, aspect };
}

/**
 * Extra distance needed to fit a fixed vertical FOV into a given aspect.
 * Wide viewports keep distance 1; narrow ones move the camera back a bit.
 */
export function aspectDistanceScale(aspect, baseAspect = 1.6) {
  if (!(aspect > 0)) return 1;
  if (aspect >= baseAspect) return 1;
  return clamp(Math.sqrt(baseAspect / aspect), 1, 1.85);
}

/**
 * Resize the renderer with a device-pixel-ratio cap to keep mobile fast.
 */
export function renderPixelRatio(width, height, devicePixelRatio = 1) {
  const base = clamp(devicePixelRatio || 1, 1, 2);
  const pixels = width * height;
  if (pixels > 2600 * 1600) return Math.min(base, 1.25);
  return base;
}

/**
 * Apply the home framing to a base pose for the current viewport: pull the
 * camera back and widen the FOV a little when the viewport is narrow so the
 * whole desk stays inside the frame.
 */
export function adaptHomePose(base, portrait, aspectScale) {
  return {
    position: {
      x: base.position.x,
      y: base.position.y * (portrait ? 0.94 : 1),
      z: base.position.z * (portrait ? 1 : aspectScale),
    },
    target: { x: base.target.x, y: base.target.y, z: base.target.z },
    fov: clamp(base.fov + (portrait ? 0 : aspectScale > 1.2 ? 3 : 0), 35, 65),
  };
}

/**
 * Push a focused pose back a touch on narrow viewports so the focused object
 * is not cropped; the look-at target is preserved exactly.
 */
export function adaptFocusPose(base, distanceScale) {
  const s = clamp(distanceScale, 1, 1.6);
  // Push the camera away from the look-at target (not from the world origin)
  // so the focused object stays centred while regaining breathing room.
  return {
    position: {
      x: base.target.x + (base.position.x - base.target.x) * s,
      y: base.target.y + (base.position.y - base.target.y) * s,
      z: base.target.z + (base.position.z - base.target.z) * s,
    },
    target: { x: base.target.x, y: base.target.y, z: base.target.z },
    fov: clamp(base.fov + (s > 1.2 ? 3 : 0), 32, 62),
  };
}
