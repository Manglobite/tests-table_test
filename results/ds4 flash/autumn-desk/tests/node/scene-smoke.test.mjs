// Structural smoke test for the whole scene.
//
// A real browser is not available in CI, but we can still build the entire
// scene graph by stubbing just enough DOM for the procedural canvas textures.
// This catches construction-time errors (bad geometry arguments, missing
// helpers, undefined materials) and verifies that every required object and
// every interactive hit target is actually present in the graph.

import test from "node:test";
import assert from "node:assert/strict";

function makeContext2D(canvas) {
  const special = {
    canvas,
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
    createPattern: () => ({}),
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
    measureText: () => ({ width: 10 }),
  };
  return new Proxy(special, {
    get(target, prop) {
      if (prop in target) return target[prop];
      return () => undefined;
    },
    set() {
      return true;
    },
  });
}

function installDomStub() {
  const createCanvas = () => {
    const canvas = {
      width: 0,
      height: 0,
      style: {},
      getContext(type) {
        if (type === "2d") return makeContext2D(canvas);
        return null;
      },
      addEventListener() {},
      removeEventListener() {},
      setAttribute() {},
    };
    return canvas;
  };
  globalThis.document = {
    createElement(tag) {
      if (tag === "canvas") return createCanvas();
      return {};
    },
    getElementById() {
      return null;
    },
    addEventListener() {},
    removeEventListener() {},
    readyState: "complete",
  };
  globalThis.window = {
    innerWidth: 1440,
    innerHeight: 900,
    devicePixelRatio: 2,
    addEventListener() {},
    removeEventListener() {},
  };
}

installDomStub();

const { createScene } = await import("../../public/js/scene/scene.js");

function countMeshes(root) {
  let meshes = 0;
  let lights = 0;
  root.traverse((o) => {
    if (o.isMesh) meshes++;
    if (o.isLight) lights++;
  });
  return { meshes, lights };
}

function collectFocusIds(root) {
  const ids = new Set();
  root.traverse((o) => {
    if (o.userData && o.userData.focusId) ids.add(o.userData.focusId);
  });
  return ids;
}

test("scene builds without throwing and contains required content", () => {
  const world = createScene();
  try {
    const { meshes, lights } = countMeshes(world.scene);
    assert.ok(meshes > 40, `expected a rich scene, got ${meshes} meshes`);
    assert.ok(lights >= 4, "expected sun/ambient/fill lighting");

    const names = new Set();
    world.scene.traverse((o) => o.name && names.add(o.name));
    for (const required of [
      "room",
      "desk",
      "window",
      "laptop",
      "notebook",
      "calendar",
      "decor",
      "leaves",
    ]) {
      assert.ok(names.has(required), `missing object: ${required}`);
    }

    const focusIds = collectFocusIds(world.scene);
    for (const id of ["window", "laptop", "notebook", "calendar"]) {
      assert.ok(focusIds.has(id), `no hit target for ${id}`);
      assert.ok(world.interactive[id], `interactive map missing ${id}`);
    }

    for (const id of ["window", "laptop", "notebook", "calendar"]) {
      assert.ok(world.focusPoses[id], `missing focus pose for ${id}`);
      assert.ok(Number.isFinite(world.focusPoses[id].position.x));
    }

    assert.equal(typeof world.update, "function");
    assert.equal(typeof world.dispose, "function");
  } finally {
    world.dispose();
  }
});

test("animation update is safe to call repeatedly", () => {
  const world = createScene();
  try {
    for (let i = 0; i < 120; i++) world.update(i / 60, 1 / 60);
    world.locker.tick(new Date());
    world.locker.setTyped(3);
    world.locker.setTyped(0);
  } finally {
    world.dispose();
  }
});

test("dispose is idempotent-safe and clears the scene", () => {
  const world = createScene();
  world.dispose();
  assert.equal(world.scene.children.length, 0);
});
