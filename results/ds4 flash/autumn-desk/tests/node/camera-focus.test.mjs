// Unit tests for the pure camera-focus engine.  No THREE.js required.
import test from "node:test";
import assert from "node:assert/strict";

import {
  CameraFocus,
  dampFactor,
  distance,
  easeInOutCubic,
  poseFromFraming,
} from "../../public/js/core/camera-focus.js";

const HOME = {
  position: { x: 0, y: 2, z: 6 },
  target: { x: 0, y: 1, z: 0 },
  fov: 45,
};

const WINDOW = {
  position: { x: 1, y: 2, z: 3 },
  target: { x: 1, y: 1.5, z: 0 },
  fov: 40,
};
const LAPTOP = {
  position: { x: 2, y: 2, z: 4 },
  target: { x: 2, y: 1, z: 1 },
  fov: 38,
};

function approx(a, b, eps = 1e-6) {
  return Math.abs(a - b) <= eps;
}

test("dampFactor is frame-rate independent and bounded", () => {
  assert.equal(dampFactor(5, 0), 0);
  const oneBig = dampFactor(5, 1);
  // Two half-second steps should approach the same total as one full step.
  const twoHalf = 1 - (1 - dampFactor(5, 0.5)) ** 2;
  assert.ok(approx(oneBig, twoHalf, 1e-9));
  assert.ok(oneBig > 0 && oneBig < 1);
});

test("easeInOutCubic endpoints and monotonicity", () => {
  assert.equal(easeInOutCubic(0), 0);
  assert.equal(easeInOutCubic(1), 1);
  assert.ok(easeInOutCubic(0.5) === 0.5);
  assert.ok(easeInOutCubic(0.25) < easeInOutCubic(0.5));
});

test("starts at home, arrived", () => {
  const focus = new CameraFocus({ home: HOME });
  assert.equal(focus.isAtHome(), true);
  assert.equal(focus.arrived, true);
  assert.equal(focus.pose().position.z, HOME.position.z);
});

test("focus then toggle returns home", () => {
  const focus = new CameraFocus({ home: HOME, damping: 8 });
  assert.equal(focus.toggle("window", WINDOW), "window");
  for (let i = 0; i < 600; i++) focus.update(1 / 60);
  assert.equal(focus.activeId, "window");
  assert.ok(distance(focus.pose().position, WINDOW.position) < 0.02);

  assert.equal(focus.toggle("window", WINDOW), null);
  for (let i = 0; i < 600; i++) focus.update(1 / 60);
  assert.equal(focus.isAtHome(), true);
  assert.ok(distance(focus.pose().position, HOME.position) < 0.02);
});

test("retarget mid-flight is continuous (no teleport)", () => {
  const focus = new CameraFocus({ home: HOME, damping: 4 });
  focus.focus("window", WINDOW);
  for (let i = 0; i < 10; i++) focus.update(1 / 60);
  const before = focus.pose().position;

  focus.focus("laptop", LAPTOP); // retarget while moving
  focus.update(1 / 60);
  const after = focus.pose().position;

  const jump = distance(before, after);
  // A single frame must be a small step, nowhere near the object separation.
  assert.ok(jump < 0.2, `unexpected jump ${jump}`);
  assert.notDeepEqual(before, after);
});

test("never overshoots the goal during monotone approach", () => {
  const focus = new CameraFocus({ home: HOME, damping: 6 });
  focus.focus("window", WINDOW);
  let prev = distance(focus.pose().position, WINDOW.position);
  for (let i = 0; i < 400; i++) {
    focus.update(1 / 60);
    const d = distance(focus.pose().position, WINDOW.position);
    assert.ok(d <= prev + 1e-9, "distance increased");
    prev = d;
  }
  assert.ok(focus.arrived);
});

test("goHome sets activeId null and arrives", () => {
  const focus = new CameraFocus({ home: HOME, damping: 10 });
  focus.focus("laptop", LAPTOP);
  focus.goHome();
  assert.equal(focus.activeId, null);
  focus.snapToGoal();
  assert.ok(distance(focus.pose().position, HOME.position) < 1e-9);
});

test("setHome while at home adopts new pose immediately", () => {
  const focus = new CameraFocus({ home: HOME });
  const tall = {
    position: { x: 0, y: 3, z: 9 },
    target: { x: 0, y: 1, z: 0 },
    fov: 50,
  };
  focus.setHome(tall);
  assert.ok(distance(focus.pose().position, tall.position) < 1e-9);
  assert.equal(focus.pose().fov, 50);
});

test("poseFromFraming places camera along direction at distance", () => {
  const pose = poseFromFraming({
    center: { x: 0, y: 0, z: 0 },
    direction: { x: 0, y: 0, z: 1 },
    distance: 5,
  });
  assert.ok(approx(pose.position.z, 5));
  assert.equal(pose.target.z, 0);
});

test("zero and negative dt are safe", () => {
  const focus = new CameraFocus({ home: HOME });
  focus.focus("window", WINDOW);
  const before = focus.pose().position;
  focus.update(0);
  focus.update(-1);
  assert.deepEqual(focus.pose().position, before);
});
