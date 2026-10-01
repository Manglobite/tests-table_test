// The open window: carved frame, autumn view outside, drifting birds and
// gently swaying curtains.  The frame and everything outside it are merged
// where possible; the curtains and birds stay as live objects.

import { THREE } from "../core/three-import.js";
import { WORLD, PALETTE } from "./config.js";
import { box, mergeParts, part, plane } from "./geo.js";
import { makeCanvas, finishTexture, rng } from "./textures.js";

const OPENING = { w: 2.1, h: 1.9, bottom: 1.1, wallZ: WORLD.window.wallZ };

export function buildWindow(mats) {
  const group = new THREE.Group();
  group.name = "window";

  const frameParts = [];
  const fw = OPENING.w;
  const fh = OPENING.h;
  const cx = 0;
  const cy = OPENING.bottom + fh / 2;
  const z = OPENING.wallZ;
  const bar = 0.09;
  const depth = 0.14;

  // Outer frame + mullions (a two-pane sash window).
  frameParts.push(part(box(fw + bar * 2, bar, depth), { position: [cx, OPENING.bottom + fh + bar / 2, z] }));
  frameParts.push(part(box(fw + bar * 2, bar, depth), { position: [cx, OPENING.bottom - bar / 2, z] }));
  frameParts.push(part(box(bar, fh, depth), { position: [cx - fw / 2 - bar / 2, cy, z] }));
  frameParts.push(part(box(bar, fh, depth), { position: [cx + fw / 2 + bar / 2, cy, z] }));
  // Vertical mullion in the middle.
  frameParts.push(part(box(0.07, fh, depth), { position: [cx, cy, z] }));
  // Horizontal transom.
  frameParts.push(part(box(fw, 0.06, depth), { position: [cx, cy + 0.15, z] }));

  // Sill (a bit deeper than the frame).
  frameParts.push(
    part(box(fw + bar * 4, 0.08, depth + 0.18), {
      position: [cx, OPENING.bottom - bar - 0.02, z + 0.08],
    }),
  );

  const frame = new THREE.Mesh(mergeParts(frameParts), mats.frame);
  frame.castShadow = true;
  frame.receiveShadow = true;
  frame.userData.focusId = "window";
  group.add(frame);

  // Glass panes (subtle, mostly transparent).
  const glassL = new THREE.Mesh(plane(fw / 2 - 0.06, fh - 0.06), mats.glass);
  glassL.position.set(cx - fw / 4, cy, z + 0.01);
  glassL.userData.focusId = "window";
  group.add(glassL);
  const glassR = glassL.clone();
  glassR.position.x = cx + fw / 4;
  group.add(glassR);

  // --- autumn view outside -------------------------------------------------
  const view = buildAutumnView(mats);
  view.position.set(cx, cy, z - 0.9);
  group.add(view);

  // --- curtains ------------------------------------------------------------
  const left = buildCurtain(mats, -1);
  const right = buildCurtain(mats, 1);
  group.add(left.group, right.group);

  // --- birds ---------------------------------------------------------------
  const birds = buildBirds();
  for (const b of birds.groups) group.add(b);

  group.userData.update = (t) => {
    left.update(t);
    right.update(t);
    birds.update(t);
  };
  group.userData.focusBounds = {
    center: new THREE.Vector3(cx, cy, z),
    radius: 1.1,
  };

  return group;
}

// ---------------------------------------------------------------------------
// Outdoor scene: painted backdrop + a few layered 3D trees for parallax.
// ---------------------------------------------------------------------------

function buildAutumnView(mats) {
  const group = new THREE.Group();
  group.name = "autumn-view";

  const tex = autumnBackdropTexture();
  const backdrop = new THREE.Mesh(
    plane(OPENING.w + 1.2, OPENING.h + 0.9),
    new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }),
  );
  group.add(backdrop);

  // Two rows of stylised trees to give the view real depth.
  const treeGroup = new THREE.Group();
  const random = rng(4242);
  // The `autumn-view` group sits outside the wall; local +z points back
  // toward the room. The painted backdrop is at local z 0, so the trees sit
  // at slightly positive z to appear *in front of* it but still behind the
  // glass (the glass is ~0.9 further toward the room).
  const rows = [
    { z: 0.55, scale: 1.0, count: 5, color: 0xb2431f },
    { z: 0.3, scale: 0.8, count: 6, color: 0xd98a2b },
  ];
  for (const row of rows) {
    for (let i = 0; i < row.count; i++) {
      const x = -1.6 + (3.2 / (row.count - 1)) * i + (random() - 0.5) * 0.2;
      const tree = makeTree(row.color, row.scale * (0.8 + random() * 0.4));
      tree.position.set(x, -0.95 + random() * 0.1, row.z);
      treeGroup.add(tree);
    }
  }
  group.add(treeGroup);

  return group;
}

function makeTree(color, scale) {
  const tree = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5b3a22, roughness: 0.9 });
  const crownMat = new THREE.MeshStandardMaterial({ color, roughness: 0.9 });

  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.5, 7), trunkMat);
  trunk.position.y = 0.25;
  tree.add(trunk);

  const random = rng(Math.floor(color + scale * 1000));
  for (let i = 0; i < 5; i++) {
    const r = 0.12 + random() * 0.12;
    const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), crownMat);
    blob.position.set((random() - 0.5) * 0.3, 0.5 + random() * 0.35, (random() - 0.5) * 0.2);
    tree.add(blob);
  }
  tree.scale.setScalar(scale);
  return tree;
}

function autumnBackdropTexture() {
  const w = 1024;
  const h = 768;
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext("2d");

  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#9fc4dc");
  sky.addColorStop(0.42, "#cfe0e2");
  sky.addColorStop(0.6, "#f2d9a8");
  sky.addColorStop(0.75, "#e8b877");
  sky.addColorStop(1, "#a5763f");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // Sun disc and haze.
  const sun = ctx.createRadialGradient(w * 0.32, h * 0.3, 0, w * 0.32, h * 0.3, 260);
  sun.addColorStop(0, "rgba(255,246,220,0.95)");
  sun.addColorStop(0.35, "rgba(255,226,160,0.35)");
  sun.addColorStop(1, "rgba(255,226,160,0)");
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, w, h);

  // Distant hills.
  const hill = (y, amp, color, phase) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 12) {
      ctx.lineTo(x, y + Math.sin(x / 180 + phase) * amp);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
  };
  hill(h * 0.66, 30, "#b8b184", 0.2);
  hill(h * 0.72, 24, "#8f8455", 1.1);
  hill(h * 0.8, 18, "#6f6a3c", 2.0);

  // Foreground tree line.
  const random = rng(88);
  ctx.fillStyle = "#5b4a2a";
  for (let x = -20; x < w + 20; x += 26) {
    const th = 60 + random() * 120;
    ctx.beginPath();
    ctx.moveTo(x, h * 0.82);
    ctx.lineTo(x + 8, h * 0.82 - th);
    ctx.lineTo(x + 16, h * 0.82);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = random() > 0.5 ? "#9c7a2e" : "#a35a2a";
    ctx.beginPath();
    ctx.arc(x + 8, h * 0.82 - th, 20 + random() * 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#5b4a2a";
  }

  // Drifting leaves painted into the haze.
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = `rgba(${180 + random() * 60},${90 + random() * 60},30,${0.25 + random() * 0.4})`;
    ctx.beginPath();
    ctx.ellipse(random() * w, h * (0.2 + random() * 0.6), 4 + random() * 6, 2 + random() * 3, random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  return finishTexture(canvas);
}

// ---------------------------------------------------------------------------
// Curtains
// ---------------------------------------------------------------------------

function buildCurtain(mats, side) {
  const width = 0.62;
  const height = OPENING.h + 0.5;
  const cols = 14;
  const rows = 22;
  const geo = new THREE.PlaneGeometry(width, height, cols, rows);
  geo.translate(0, 0, 0);

  const group = new THREE.Group();
  group.name = side < 0 ? "curtain-left" : "curtain-right";
  const mesh = new THREE.Mesh(geo, mats.curtain);
  mesh.castShadow = true;
  mesh.userData.focusId = "window";
  group.add(mesh);

  // A curtain rod cap so the fabric hangs from something.
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, width, 8), mats.lampMetal);
  rod.rotation.z = Math.PI / 2;
  rod.position.y = height / 2 + 0.02;
  group.add(rod);

  const gather = 0.28 + (side < 0 ? 0 : 0.02);
  group.position.set(
    side * (OPENING.w / 2 + 0.02),
    OPENING.bottom + OPENING.h / 2 + 0.1,
    OPENING.wallZ + 0.22,
  );
  group.rotation.y = side * 0.22;

  const base = geo.attributes.position.array.slice();
  const rand = rng(side < 0 ? 13 : 71);
  const phase = rand() * Math.PI * 2;

  const update = (t) => {
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const bx = base[i * 3];
      const by = base[i * 3 + 1];
      const u = bx / width; // -0.5..0.5
      // Gather the fabric into folds, then sway it with a slow breeze.
      const folds = Math.sin(u * Math.PI * 5) * gather;
      const sway = Math.sin(t * 0.9 + phase + by * 1.6) * 0.03 * (0.4 + (by + height / 2) / height);
      pos.array[i * 3] = bx + folds * 0.12;
      pos.array[i * 3 + 2] = folds * 0.5 + sway;
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  };

  update(0);
  return { group, update };
}

// ---------------------------------------------------------------------------
// Birds
// ---------------------------------------------------------------------------

function buildBirds() {
  const groups = [];
  const random = rng(1234);
  const count = 5;
  const states = [];

  for (let i = 0; i < count; i++) {
    const bird = makeBird();
    const state = {
      radius: 0.7 + random() * 0.9,
      speed: 0.16 + random() * 0.22,
      phase: random() * Math.PI * 2,
      y: 0.15 + random() * 0.55,
      z: -0.25 - random() * 0.5,
      tilt: random() * 0.4,
      wing: 6 + random() * 4,
    };
    states.push(state);
    bird.userData.focusId = "window";
    // The window group applies its own transform, so birds live in a local
    // frame centred on the opening.
    bird.position.set(0, OPENING.bottom + OPENING.h / 2, 0);
    groups.push(bird);
  }

  const update = (t) => {
    for (let i = 0; i < groups.length; i++) {
      const s = states[i];
      const a = s.phase + t * s.speed;
      groups[i].position.x = Math.cos(a) * s.radius;
      groups[i].position.y = OPENING.bottom + OPENING.h / 2 + s.y + Math.sin(a * 2) * 0.08;
      groups[i].position.z = OPENING.wallZ - 0.35 + s.z + Math.sin(a) * 0.05;
      const dir = Math.cos(a) >= 0 ? 1 : -1;
      groups[i].scale.x = dir;
      groups[i].rotation.z = Math.sin(a) * s.tilt;
      const wings = groups[i].userData.wings;
      if (wings) {
        const flap = Math.sin(t * s.wing + s.phase) * 0.6;
        wings[0].rotation.z = flap;
        wings[1].rotation.z = -flap;
      }
    }
  };

  update(0);
  return { groups, update };
}

function makeBird() {
  const bird = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), birdMat());
  body.scale.set(1.8, 1, 1);
  bird.add(body);

  const wingGeo = new THREE.CircleGeometry(0.14, 3);
  const wingMat = birdMat();
  const left = new THREE.Mesh(wingGeo, wingMat.clone());
  left.position.set(0, 0.01, 0.01);
  const right = new THREE.Mesh(wingGeo, wingMat);
  right.position.set(0, 0.01, -0.01);
  right.rotation.y = Math.PI;
  bird.add(left, right);
  bird.userData.wings = [left, right];
  return bird;
}

function birdMat() {
  return new THREE.MeshStandardMaterial({
    color: PALETTE.bird,
    roughness: 0.8,
    side: THREE.DoubleSide,
  });
}
