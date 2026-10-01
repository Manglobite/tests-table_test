// Automated interaction checks that do not need a browser:
//   * focus state machine over all four objects and every return-home path
//   * real scene-graph hit-test resolution (resolveFocusId walks parents)
//   * tap-vs-drag classification used by the pointer handler
//   * responsive viewport classification and pose adaptation

import test from "node:test";
import assert from "node:assert/strict";

import { THREE } from "../../public/js/core/three-import.js";
import { CameraFocus } from "../../public/js/core/camera-focus.js";
import { resolveFocusId, isTap } from "../../public/js/interactions/picking.js";
import {
  adaptFocusPose,
  adaptHomePose,
  aspectDistanceScale,
  classifyViewport,
  renderPixelRatio,
} from "../../public/js/core/layout.js";
import { homePose } from "../../public/js/scene/config.js";

const IDS = ["window", "laptop", "notebook", "calendar"];

function poseFor(i) {
  return {
    position: { x: i + 1, y: 1.5, z: 3 },
    target: { x: i, y: 1, z: 0 },
    fov: 45,
  };
}

test("focus and home work for every interactive object", () => {
  const focus = new CameraFocus({ home: homePose(false), damping: 12 });
  for (let i = 0; i < IDS.length; i++) {
    const id = IDS[i];
    focus.focus(id, poseFor(i));
    for (let k = 0; k < 900; k++) focus.update(1 / 60);
    assert.equal(focus.activeId, id);
    assert.ok(focus.arrived, `${id} did not settle`);
  }
});

test("toggling the same object returns home", () => {
  const focus = new CameraFocus({ home: homePose(false), damping: 12 });
  focus.toggle("laptop", poseFor(1));
  for (let k = 0; k < 900; k++) focus.update(1 / 60);
  assert.equal(focus.activeId, "laptop");
  const result = focus.toggle("laptop", poseFor(1));
  assert.equal(result, null);
  for (let k = 0; k < 900; k++) focus.update(1 / 60);
  assert.equal(focus.isAtHome(), true);
});

test("retarget between all pairs never jumps", () => {
  const focus = new CameraFocus({ home: homePose(false), damping: 6 });
  for (const from of IDS) {
    focus.focus(from, poseFor(IDS.indexOf(from)));
    for (let k = 0; k < 6; k++) focus.update(1 / 60);
    const before = { ...focus.current.position };
    const to = IDS[(IDS.indexOf(from) + 1) % IDS.length];
    focus.focus(to, poseFor(IDS.indexOf(to)));
    focus.update(1 / 60);
    const after = focus.current.position;
    const jump = Math.hypot(
      after.x - before.x,
      after.y - before.y,
      after.z - before.z,
    );
    assert.ok(jump < 0.25, `${from}->${to} jumped ${jump}`);
  }
});

test("resolveFocusId walks up the parent chain", () => {
  const root = new THREE.Group();
  const target = new THREE.Group();
  target.userData.focusId = "notebook";
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
  target.add(mesh);
  root.add(target);

  assert.equal(resolveFocusId(mesh), "notebook");
  assert.equal(resolveFocusId(root), null);

  const plain = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
  root.add(plain);
  assert.equal(resolveFocusId(plain), null);
});

test("isTap distinguishes clicks from drags", () => {
  const now = 1000;
  assert.equal(
    isTap({ downX: 0, downY: 0, upX: 3, upY: 2, downTime: now, upTime: now + 120 }),
    true,
  );
  assert.equal(
    isTap({ downX: 0, downY: 0, upX: 40, upY: 0, downTime: now, upTime: now + 120 }),
    false,
  );
  assert.equal(
    isTap({ downX: 0, downY: 0, upX: 1, upY: 1, downTime: now, upTime: now + 900 }),
    false,
  );
});

test("viewport classification toggles portrait", () => {
  assert.equal(classifyViewport(390, 844).portrait, true);
  assert.equal(classifyViewport(390, 844).mobile, true);
  assert.equal(classifyViewport(1440, 900).portrait, false);
  assert.equal(classifyViewport(1440, 900).mobile, false);
});

test("narrow viewports pull the camera back", () => {
  const wide = aspectDistanceScale(1.8);
  const narrow = aspectDistanceScale(0.5);
  assert.equal(wide, 1);
  assert.ok(narrow > 1.2);
  assert.ok(narrow <= 1.85);
});

test("portrait phones fit the desk into the horizontal FOV", () => {
  const pose = homePose(true);
  // Horizontal half-angle of the perspective camera.
  const vHalf = ((pose.fov / 2) * Math.PI) / 180;
  const aspect = 390 / 844;
  const hHalf = Math.atan(Math.tan(vHalf) * aspect);
  const distance = Math.abs(pose.position.z - pose.target.z);
  const halfWidthVisible = Math.tan(hHalf) * distance;
  // The desk is 3.6 wide, so its half-width must fit with a little margin.
  assert.ok(
    halfWidthVisible >= 1.8,
    `desk would be cropped: only ${halfWidthVisible.toFixed(2)} half-width visible`,
  );
});

test("home/focus adaptation keeps targets stable", () => {
  const base = homePose(true);
  const adapted = adaptHomePose(base, true, 1.6);
  assert.deepEqual(adapted.target, base.target);

  const focusBase = { position: { x: 2, y: 2, z: 4 }, target: { x: 1, y: 1, z: 0 }, fov: 40 };
  const scaled = adaptFocusPose(focusBase, 1.5);
  assert.deepEqual(scaled.target, focusBase.target);
  assert.ok(scaled.position.z > focusBase.position.z);
});

test("pixel ratio is capped on huge canvases", () => {
  assert.equal(renderPixelRatio(800, 600, 3), 2);
  assert.ok(renderPixelRatio(3840, 2160, 3) <= 1.25);
  assert.equal(renderPixelRatio(800, 600, 0.5), 1);
});
