// Interactive props on the desk: laptop (Windows 11 style lock screen),
// open notebook, flip calendar, plus optional decor (mug, pen, books, lamp,
// dry leaves).  Each interactive prop exposes a `focusId` marker and an
// `onFocus`/`reset` pair used by the interaction layer.

import { THREE } from "../core/three-import.js";
import { PALETTE, WORLD } from "./config.js";
import {
  box,
  cone,
  cylinder,
  lathe,
  mergeParts,
  part,
  plane,
  torus,
} from "./geo.js";

export const LOCK_STATE = {
  idle: "idle",
  prompting: "prompting",
};

// ---------------------------------------------------------------------------
// Laptop
// ---------------------------------------------------------------------------

export function buildLaptop(mats) {
  const group = new THREE.Group();
  group.name = "laptop";

  const body = new THREE.Group();
  // Screen group pivots at the hinge so it can tilt.
  const screen = new THREE.Group();

  const baseW = 0.6;
  const baseD = 0.42;
  const baseH = 0.022;
  const screenW = baseW;
  const screenH = 0.38;

  const base = new THREE.Mesh(box(baseW, baseH, baseD), mats.laptopBody);
  base.castShadow = true;
  base.userData.focusId = "laptop";
  body.add(base);

  // Keyboard well.
  const keys = new THREE.Mesh(box(baseW - 0.09, 0.006, baseD * 0.52), mats.laptopKeys);
  keys.position.set(0, baseH / 2 + 0.003, -0.02);
  keys.userData.focusId = "laptop";
  body.add(keys);

  // Trackpad.
  const trackpad = new THREE.Mesh(box(0.16, 0.004, 0.1), mats.laptopKeys);
  trackpad.position.set(0, baseH / 2 + 0.002, baseD / 2 - 0.08);
  trackpad.userData.focusId = "laptop";
  body.add(trackpad);

  // Hinge + screen shell.
  const shell = new THREE.Mesh(box(screenW, screenH, 0.016), mats.laptopBody);
  shell.position.set(0, screenH / 2, 0);
  shell.castShadow = true;
  shell.userData.focusId = "laptop";
  screen.add(shell);

  // Display surface (a canvas texture showing the lock screen).
  const display = new THREE.Mesh(
    plane(screenW - 0.04, screenH - 0.04),
    mats.lockScreen,
  );
  display.position.set(0, screenH / 2, 0.009);
  display.userData.focusId = "laptop";
  screen.add(display);

  // A soft glow behind the screen so it reads as "on".
  const glow = new THREE.PointLight(0x9ecbff, 0.35, 1.2, 2);
  glow.position.set(0, screenH / 2, 0.25);
  screen.add(glow);

  screen.position.set(0, baseH / 2, -baseD / 2 + 0.01);
  screen.rotation.x = -0.22; // upright, leaning slightly back
  body.add(screen);

  group.add(body);
  group.rotation.y = -0.42;
  // Raise by half the base height so the laptop rests on the desk surface.
  group.position.set(
    0.98,
    WORLD.desk.height + WORLD.desk.thickness / 2 + baseH / 2,
    -0.28,
  );

  const lock = createLockScreen();
  group.userData.display = display;
  group.userData.lock = lock;
  group.userData.screen = screen;

  // The lock panel is a screen-space overlay, but focusing the laptop also
  // tells the UI to reveal the HTML password field aligned with the screen.
  group.userData.onFocus = () => lock.show();
  group.userData.onBlur = () => lock.hide();

  return group;
}

// The HTML overlay that turns the rendered lock screen into an interactive
// password prompt.  Nothing is ever stored or sent anywhere.
function createLockScreen() {
  const el = document.getElementById("lock-overlay");
  const input = document.getElementById("lock-input");
  const button = document.getElementById("lock-submit");
  const hint = document.getElementById("lock-hint");
  let state = LOCK_STATE.idle;

  function show() {
    if (!el) return;
    el.hidden = false;
    el.classList.add("is-visible");
    state = LOCK_STATE.prompting;
  }
  function hide() {
    if (!el) return;
    el.classList.remove("is-visible");
    el.hidden = true;
    if (input) input.value = "";
    if (hint) hint.textContent = "";
    state = LOCK_STATE.idle;
  }
  function submit() {
    // Demonstration only: acknowledge in memory and clear immediately.
    if (hint) hint.textContent = "Демонстрационный режим: ввод не сохраняется";
    if (input) input.value = "";
  }

  button?.addEventListener("click", submit);
  input?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      submit();
    }
    // Other keys (including Escape) bubble to the global handler.
  });

  return { show, hide, submit, get state() { return state; } };
}

// ---------------------------------------------------------------------------
// Notebook
// ---------------------------------------------------------------------------

export function buildNotebook(mats) {
  const group = new THREE.Group();
  group.name = "notebook";

  const W = 0.5;
  const H = 0.66;
  const pageH = 0.006;

  const cover = new THREE.Mesh(box(W + 0.02, 0.012, H + 0.02), mats.notebookCover);
  cover.position.y = 0;
  cover.castShadow = true;
  cover.receiveShadow = true;
  cover.userData.focusId = "notebook";
  group.add(cover);

  // Open pages: two slightly angled leaves meeting at the spine.
  const makeLeaf = (side) => {
    const leaf = new THREE.Group();
    const page = new THREE.Mesh(box(W / 2 - 0.01, pageH, H - 0.02), mats.paper);
    page.position.set(side * (W / 4), 0.012, 0);
    page.userData.focusId = "notebook";
    leaf.add(page);

    const writing = new THREE.Mesh(plane((W / 2 - 0.02), H - 0.04), mats.notebookWriting);
    writing.rotation.x = -Math.PI / 2;
    writing.rotation.z = side > 0 ? Math.PI / 2 : -Math.PI / 2;
    writing.position.set(side * (W / 4), 0.016, 0);
    writing.userData.focusId = "notebook";
    leaf.add(writing);

    leaf.rotation.z = side * 0.04;
    return leaf;
  };
  group.add(makeLeaf(-1), makeLeaf(1));

  // Spine + a pen resting across the pages.
  const spine = new THREE.Mesh(box(0.02, 0.02, H), mats.notebookCover);
  spine.position.y = 0.012;
  group.add(spine);

  group.position.set(-0.5, WORLD.desk.height + WORLD.desk.thickness / 2 + 0.02, 0.42);
  group.rotation.y = 0.16;
  return group;
}

// ---------------------------------------------------------------------------
// Flip calendar
// ---------------------------------------------------------------------------

export function buildCalendar(mats) {
  const group = new THREE.Group();
  group.name = "calendar";

  const W = 0.34;
  const H = 0.44;
  const stand = new THREE.Group();

  // Wooden easel base.
  const base = new THREE.Mesh(box(W + 0.06, 0.02, 0.2), mats.calendarStand);
  base.position.y = 0;
  base.castShadow = true;
  base.receiveShadow = true;
  stand.add(base);

  const back = new THREE.Mesh(box(W, H * 0.9, 0.012), mats.calendarStand);
  back.position.set(0, H * 0.46, -0.08);
  back.rotation.x = -0.22;
  stand.add(back);

  // The date page, textured with the live date.
  const page = new THREE.Mesh(box(W * 0.94, H * 0.82, 0.006), mats.calendarPaper);
  page.position.set(0, H * 0.44, -0.055);
  page.rotation.x = -0.22;
  page.userData.focusId = "calendar";
  stand.add(page);

  // The page texture lives on every face; give the front its own thin plate
  // so the artwork reads clearly.
  const face = new THREE.Mesh(plane(W * 0.9, H * 0.78), mats.calendarFace);
  face.position.set(0, H * 0.44, -0.047);
  face.rotation.x = -0.22;
  face.userData.focusId = "calendar";
  stand.add(face);

  // Spiral binding.
  const binding = new THREE.Mesh(
    mergeParts(
      Array.from({ length: 7 }, (_, i) =>
        part(torus(0.012, 0.004, 6, 12), {
          position: [-W * 0.38 + (W * 0.76 / 6) * i, H * 0.9, -0.075],
          rotation: [Math.PI / 2, 0, 0],
        }),
      ),
    ),
    mats.lampMetal,
  );
  stand.add(binding);

  group.add(stand);
  group.position.set(-1.32, WORLD.desk.height + WORLD.desk.thickness / 2, -0.18);
  group.rotation.y = 0.32;
  return group;
}

// ---------------------------------------------------------------------------
// Decor
// ---------------------------------------------------------------------------

export function buildDecor(mats) {
  const group = new THREE.Group();
  group.name = "decor";

  // Coffee mug.
  const mug = new THREE.Group();
  const mugProfile = [
    [0.0, 0],
    [0.05, 0],
    [0.055, 0.02],
    [0.056, 0.11],
    [0.058, 0.12],
  ];
  const mugWall = new THREE.Mesh(lathe(mugProfile, 24), mats.mug);
  mugWall.castShadow = true;
  mug.add(mugWall);
  const coffee = new THREE.Mesh(cylinder(0.05, 0.05, 0.005, 20), mats.mugInner);
  coffee.position.y = 0.1;
  mug.add(coffee);
  const handle = new THREE.Mesh(torus(0.032, 0.009, 8, 20), mats.mug);
  handle.position.set(0.058, 0.06, 0);
  handle.rotation.y = Math.PI / 2;
  mug.add(handle);
  mug.position.set(0.55, WORLD.desk.height + WORLD.desk.thickness / 2, 0.42);
  group.add(mug);

  // Pen beside the notebook.
  const pen = new THREE.Group();
  const shaft = new THREE.Mesh(cylinder(0.006, 0.006, 0.14, 10), mats.pen);
  shaft.rotation.z = Math.PI / 2;
  pen.add(shaft);
  const tip = new THREE.Mesh(cone(0.008, 0.026, 10), mats.penTip);
  tip.rotation.z = -Math.PI / 2;
  tip.position.x = 0.083;
  pen.add(tip);
  pen.position.set(-0.72, WORLD.desk.height + WORLD.desk.thickness / 2 + 0.012, 0.15);
  pen.rotation.y = 0.5;
  group.add(pen);

  // Stack of books on the left.
  const bookStack = new THREE.Group();
  const bookSpecs = [
    { w: 0.28, h: 0.05, d: 0.2, mat: mats.bookRed, rot: 0.1 },
    { w: 0.26, h: 0.045, d: 0.19, mat: mats.bookBlue, rot: -0.08 },
    { w: 0.24, h: 0.04, d: 0.18, mat: mats.bookRed, rot: 0.05 },
  ];
  let y = 0;
  for (const spec of bookSpecs) {
    const book = new THREE.Mesh(box(spec.w, spec.h, spec.d), spec.mat);
    book.position.y = y + spec.h / 2;
    book.rotation.y = spec.rot;
    book.castShadow = true;
    bookStack.add(book);
    y += spec.h;
  }
  bookStack.position.set(-1.55, WORLD.desk.height + WORLD.desk.thickness / 2, 0.42);
  group.add(bookStack);

  // Small desk lamp on the right corner.
  const lamp = new THREE.Group();
  const lampBase = new THREE.Mesh(cylinder(0.09, 0.11, 0.02, 20), mats.lampMetal);
  lamp.add(lampBase);
  const arm = new THREE.Mesh(cylinder(0.012, 0.012, 0.42, 10), mats.lampMetal);
  arm.position.set(0, 0.21, 0);
  arm.rotation.z = -0.25;
  lamp.add(arm);
  const shade = new THREE.Mesh(cone(0.13, 0.16, 20, true), mats.lampShade);
  shade.position.set(0.1, 0.42, 0);
  shade.rotation.z = Math.PI + 0.5;
  lamp.add(shade);
  const bulb = new THREE.PointLight(0xffd9a0, 0.6, 3, 2);
  bulb.position.set(0.12, 0.36, 0);
  lamp.add(bulb);
  lamp.position.set(1.5, WORLD.desk.height + WORLD.desk.thickness / 2, -0.35);
  group.add(lamp);

  // A couple of dry leaves lying on the desk.
  const leafGeo = new THREE.CircleGeometry(0.05, 3);
  leafGeo.scale(1.6, 1, 1);
  const dry = [
    { p: [1.25, 0, 0.45], r: 0.3, c: PALETTE.leafBrown },
    { p: [-1.1, 0.001, -0.5], r: 1.1, c: PALETTE.leafGold },
    { p: [0.2, 0.001, 0.6], r: 2.0, c: PALETTE.leafRed },
  ];
  for (const d of dry) {
    const mat = new THREE.MeshStandardMaterial({ color: d.c, roughness: 0.85, side: THREE.DoubleSide });
    const leaf = new THREE.Mesh(leafGeo.clone(), mat);
    leaf.rotation.x = -Math.PI / 2;
    leaf.rotation.z = d.r;
    leaf.position.set(d.p[0], WORLD.desk.height + WORLD.desk.thickness / 2 + 0.004, d.p[2]);
    group.add(leaf);
  }

  // A small potted plant silhouette near the window sill.
  const plant = new THREE.Group();
  const pot = new THREE.Mesh(cylinder(0.05, 0.04, 0.07, 16), mats.mug);
  plant.add(pot);
  for (let i = 0; i < 7; i++) {
    const leaf = new THREE.Mesh(torus(0.03, 0.006, 6, 14), mats.leafVariants[i % mats.leafVariants.length]);
    const a = (i / 7) * Math.PI * 2;
    leaf.position.set(Math.cos(a) * 0.03, 0.09, Math.sin(a) * 0.03);
    leaf.rotation.set(Math.PI / 2.4, a, 0);
    plant.add(leaf);
  }
  // Sits on the window sill, in front of the glass.
  plant.position.set(0.72, 1.03, -1.7);
  group.add(plant);

  return group;
}


