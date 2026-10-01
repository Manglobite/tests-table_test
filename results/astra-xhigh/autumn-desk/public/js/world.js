import * as THREE from '../tree_js/package/build/three.module.js';
import { woodTexture, screenTexture, notebookTexture, calendarTexture } from './textures.js';

export function createWorld() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#d7decc');
  scene.fog = new THREE.Fog('#dddcc0', 19, 58);
  const objects = {};
  const moving = { curtains: [], birds: [], leaves: [] };
  const material = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...extra });
  const oak = material('#e2b27d', { map: woodTexture() });
  const darkOak = material('#69462b');
  const cream = material('#f3e5c8');
  const brass = material('#bc9554', { metalness: 0.7, roughness: 0.3 });
  const ink = material('#39463e');
  function mesh(geometry, mat, parent, position = [0, 0, 0]) {
    const item = new THREE.Mesh(geometry, mat);
    item.position.set(...position); item.castShadow = true; item.receiveShadow = true;
    parent.add(item); return item;
  }
  const box = (parent, size, position, mat) => mesh(new THREE.BoxGeometry(...size), mat, parent, position);
  const sphere = (parent, radius, position, mat) => mesh(new THREE.SphereGeometry(radius, 16, 12), mat, parent, position);
  function cylinder(parent, top, bottom, height, position, mat) {
    return mesh(new THREE.CylinderGeometry(top, bottom, height, 24), mat, parent, position);
  }
  function group(id, position) {
    const result = new THREE.Group(); result.position.set(...position); scene.add(result);
    if (id) { result.userData.focusId = id; objects[id] = result; }
    return result;
  }
  function panel(parent, width, height, position, map, horizontal = false) {
    const item = mesh(new THREE.PlaneGeometry(width, height), material('#ffffff', { map, roughness: 0.9 }), parent, position);
    if (horizontal) item.rotation.x = -Math.PI / 2;
    return item;
  }
  scene.add(new THREE.HemisphereLight('#fff3d6', '#777659', 2.2));
  const sun = new THREE.DirectionalLight('#ffe0a0', 4.2);
  sun.position.set(-5, 9, -8); sun.target.position.set(1, 0, 1);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 0.5, far: 30 });
  sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.025;
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight('#e2ecff', 1.2); fill.position.set(3, 5, 7); scene.add(fill);
  box(scene, [200, 0.2, 200], [0, -1.9, -25], material('#b3b58a'));
  box(scene, [15, 0.2, 10], [0, -1.65, 1.7], material('#987652', { map: oak.map }));
  const wall = material('#dcd2b7');
  box(scene, [5, 8, 0.25], [-5.1, 2.1, -3.15], wall);
  box(scene, [5, 8, 0.25], [5.1, 2.1, -3.15], wall);
  box(scene, [5.2, 2.9, 0.25], [0, -0.35, -3.15], wall);
  box(scene, [5.2, 2, 0.25], [0, 6.75, -3.15], wall);
  box(scene, [15, 0.16, 0.18], [0, -1.3, -2.98], cream);

  const desk = group(null, [0, 0, 0]);
  box(desk, [7.15, 0.26, 4.05], [0, 0.85, 0.12], oak);
  box(desk, [7.25, 0.09, 4.15], [0, 0.72, 0.12], darkOak);
  box(desk, [6.7, 0.55, 0.16], [0, 0.4, 1.94], oak);
  for (const x of [-2.25, 0, 2.25]) {
    box(desk, [2.08, 0.4, 0.09], [x, 0.41, 2.045], darkOak);
    box(desk, [1.96, 0.31, 0.06], [x, 0.41, 2.102], oak);
    const handle = mesh(new THREE.TorusGeometry(0.095, 0.018, 8, 24, Math.PI), brass, desk, [x, 0.36, 2.17]);
    handle.rotation.z = Math.PI;
    for (let i = -3; i <= 3; i++) {
      const carving = sphere(desk, 0.04, [x + i * 0.2, 0.49 + Math.cos(i) * 0.027, 2.146], darkOak);
      carving.scale.set(1.9, 0.5, 0.35); carving.rotation.z = i * 0.35;
    }
  }
  for (const x of [-3.1, 3.1]) for (const z of [-1.4, 1.65]) {
    cylinder(desk, 0.17, 0.11, 2.15, [x, -0.45, z], oak);
    for (const y of [-1.35, -0.1, 0.25]) {
      const bead = sphere(desk, 0.22, [x, y, z], oak); bead.scale.y = 0.65;
      cylinder(desk, 0.19, 0.19, 0.08, [x, y + 0.13, z], darkOak);
    }
  }

  const windowGroup = group('window', [0, 0, -3]);
  for (const x of [-2.58, 2.58]) box(windowGroup, [0.16, 4.6, 0.24], [x, 3.5, 0], cream);
  for (const y of [1.22, 5.78]) box(windowGroup, [5.35, 0.16, 0.24], [0, y, 0], cream);
  box(windowGroup, [5.8, 0.15, 0.65], [0, 1.15, 0.12], oak);
  const glass = material('#bedce0', { transparent: true, opacity: 0.09, roughness: 0.08, depthWrite: false });
  for (const side of [-1, 1]) {
    const sash = new THREE.Group(); sash.position.set(side < 0 ? -2.47 : 0.04, 1.34, 0.04); windowGroup.add(sash);
    if (side > 0) sash.rotation.y = -0.31;
    const width = 2.42, height = 4.31;
    for (const x of [0, width]) box(sash, [0.085, height, 0.11], [x, height / 2, 0], cream);
    for (const y of [0, height / 2, height]) box(sash, [width, 0.08, 0.11], [width / 2, y, 0], cream);
    const pane = box(sash, [width - 0.08, height - 0.08, 0.015], [width / 2, height / 2, 0], glass); pane.castShadow = false;
    box(sash, [0.06, 0.3, 0.07], [side > 0 ? 0.15 : width - 0.15, 1.8, 0.1], brass);
  }
  const rod = cylinder(scene, 0.035, 0.035, 6.4, [0, 6.0, -2.57], brass); rod.rotation.z = Math.PI / 2;
  for (const side of [-1, 1]) {
    const geo = new THREE.PlaneGeometry(1.25, 4.8, 24, 32);
    const curtain = mesh(geo, material('#efe5cc', { side: THREE.DoubleSide }), scene, [side * 2.9, 3.45, -2.52]);
    curtain.userData.base = Float32Array.from(geo.attributes.position.array);
    curtain.userData.side = side; moving.curtains.push(curtain);
    for (let i = 0; i < 7; i++) {
      const ring = mesh(new THREE.TorusGeometry(0.058, 0.012, 6, 12), brass, scene, [side * 2.9 - 0.52 + i * 0.17, 5.89, -2.57]);
      ring.rotation.y = Math.PI / 2;
    }
  }

  const laptop = group('laptop', [1.65, 1.035, -0.28]);
  const aluminum = material('#7c888a', { metalness: 0.7, roughness: 0.33 });
  box(laptop, [2.25, 0.09, 1.45], [0, 0, 0], aluminum);
  box(laptop, [0.75, 0.007, 0.35], [0, 0.05, 0.44], material('#9ba4a3', { metalness: 0.4 }));
  for (let row = 0; row < 5; row++) for (let col = 0; col < 13; col++) box(laptop, [0.13, 0.018, 0.12], [-0.94 + col * 0.157, 0.056, -0.48 + row * 0.155], ink);
  const lid = new THREE.Group(); lid.position.set(0, 0.045, -0.69); lid.rotation.x = -0.14; laptop.add(lid);
  box(lid, [2.28, 1.52, 0.08], [0, 0.76, 0], aluminum);
  box(lid, [2.2, 1.43, 0.012], [0, 0.76, 0.048], ink);
  const screen = panel(lid, 2.1, 1.31, [0, 0.77, 0.058], screenTexture());
  screen.material.emissive.set('#ffffff'); screen.material.emissiveMap = screen.material.map; screen.material.emissiveIntensity = 0.45;
  sphere(lid, 0.015, [0, 1.465, 0.06], ink);

  const notebook = group('notebook', [-0.38, 1.03, 1.11]); notebook.rotation.y = -0.12;
  box(notebook, [2.35, 0.045, 1.58], [0, 0, 0], material('#496157'));
  for (const x of [-0.575, 0.575]) box(notebook, [1.12, 0.075, 1.5], [x, 0.055, 0], cream);
  panel(notebook, 2.26, 1.5, [0, 0.096, 0], notebookTexture(), true);
  box(notebook, [0.045, 0.006, 0.64], [0.26, 0.105, 0.62], material('#bb6945'));
  const pen = cylinder(scene, 0.032, 0.032, 1.03, [1.03, 1.07, 1.37], ink); pen.rotation.set(Math.PI / 2, 0, -0.3);

  const calendar = group('calendar', [-2, 1.0, -0.48]);
  box(calendar, [1.26, 0.07, 0.76], [0, 0.04, 0], darkOak);
  const card = box(calendar, [1.12, 1.29, 0.07], [0, 0.66, 0.12], cream); card.rotation.x = -0.13;
  const date = panel(calendar, 1.08, 1.24, [0, 0.67, 0.165], calendarTexture()); date.rotation.x = -0.13;
  const back = box(calendar, [1.1, 1.28, 0.05], [0, 0.64, -0.25], oak); back.rotation.x = 0.35;
  for (const x of [-0.35, 0.35]) {
    const ring = mesh(new THREE.TorusGeometry(0.078, 0.017, 8, 20), brass, calendar, [x, 1.3, 0.04]); ring.rotation.y = Math.PI / 2;
  }

  const cup = group(null, [-2.4, 1.02, 0.83]);
  cylinder(cup, 0.44, 0.38, 0.045, [0, 0, 0], cream);
  cylinder(cup, 0.29, 0.22, 0.43, [0, 0.25, 0], material('#789183'));
  cylinder(cup, 0.257, 0.257, 0.01, [0, 0.469, 0], material('#49301d'));
  mesh(new THREE.TorusGeometry(0.27, 0.027, 8, 32), cream, cup, [0, 0.48, 0]).rotation.x = Math.PI / 2;
  mesh(new THREE.TorusGeometry(0.17, 0.046, 10, 24), material('#789183'), cup, [-0.3, 0.27, 0]);
  for (let i = 0; i < 3; i++) {
    box(scene, [1.18, 0.16, 0.83], [-0.45, 1.09 + i * 0.19, -1.12], material(['#8f5140', '#596c61', '#ccac70'][i]));
    box(scene, [1.1, 0.12, 0.75], [-0.45, 1.09 + i * 0.19, -1.06], cream);
  }
  const vase = group(null, [2.8, 1.01, -1.28]);
  cylinder(vase, 0.12, 0.22, 0.55, [0, 0.28, 0], material('#b06b4a'));
  for (let i = 0; i < 5; i++) {
    const stem = cylinder(vase, 0.008, 0.008, 0.85, [(i - 2) * 0.075, 0.91, 0], darkOak); stem.rotation.z = (i - 2) * 0.19;
    const seed = sphere(vase, 0.08, [(i - 2) * 0.15, 1.3 - Math.abs(i - 2) * 0.05, 0], material('#d6b277')); seed.scale.set(0.65, 2.7, 0.65);
  }

  let seed = 42;
  const random = () => ((seed = seed * 16807 % 2147483647) / 2147483647);
  const foliage = ['#ad6133', '#cc8a39', '#dfa74c', '#8c994f', '#b64d2e'].map(color => material(color));
  for (let i = 0; i < 17; i++) {
    const x = (random() - 0.5) * 32, z = -9 - random() * 23;
    const height = 4 + random() * 5;
    const tree = group(null, [x, -1.6, z]);
    cylinder(tree, 0.12, 0.25, height, [0, height / 2, 0], darkOak);
    for (let j = 0; j < 8; j++) {
      const crown = sphere(tree, 1 + random() * 1.25, [(random() - 0.5) * 2.6, height - 0.5 + random() * 2.3, (random() - 0.5) * 2], foliage[(i + j) % foliage.length]);
      crown.scale.y = 0.8 + random() * 0.7;
    }
  }
  const path = box(scene, [4, 0.03, 34], [3, -1.77, -20], material('#d5c2a0')); path.rotation.y = -0.32;
  const leafShape = new THREE.Shape();
  leafShape.moveTo(0, -0.23); leafShape.lineTo(-0.07, -0.08); leafShape.lineTo(-0.23, 0.01); leafShape.lineTo(-0.13, 0.07); leafShape.lineTo(-0.17, 0.2); leafShape.lineTo(-0.04, 0.15); leafShape.lineTo(0, 0.3); leafShape.lineTo(0.06, 0.16); leafShape.lineTo(0.2, 0.2); leafShape.lineTo(0.14, 0.06); leafShape.lineTo(0.25, 0.01); leafShape.lineTo(0.07, -0.09); leafShape.closePath();
  const leafGeo = new THREE.ShapeGeometry(leafShape);
  const leafMats = ['#ce8231', '#a8502d', '#d7aa42'].map(color => material(color, { side: THREE.DoubleSide }));
  for (let i = 0; i < 28; i++) {
    const leaf = mesh(leafGeo, leafMats[i % 3], scene);
    if (i < 7) {
      leaf.position.set((random() - 0.5) * 6.3, 1.0, -1.5 + random() * 3.1);
      leaf.rotation.set(-Math.PI / 2, 0, random() * 6);
      leaf.scale.setScalar(0.6 + random() * 0.4);
    } else {
      leaf.userData.origin = [(random() - 0.5) * 15, random() * 8, -4.5 - random() * 12];
      leaf.userData.phase = random() * 6; moving.leaves.push(leaf);
    }
  }
  const birdMat = material('#454a3c');
  for (let i = 0; i < 7; i++) {
    const bird = group(null, [0, 0, 0]);
    const body = sphere(bird, 0.09, [0, 0, 0], birdMat); body.scale.set(1.6, 0.7, 0.65);
    bird.userData.wings = [];
    for (const side of [-1, 1]) {
      const wing = new THREE.Group(); bird.add(wing);
      const shape = new THREE.Shape(); shape.moveTo(0, 0); shape.lineTo(side * 0.46, 0.08); shape.lineTo(side * 0.18, -0.13); shape.closePath();
      const feather = mesh(new THREE.ShapeGeometry(shape), material('#454a3c', { side: THREE.DoubleSide }), wing); feather.rotation.x = -Math.PI / 2;
      wing.userData.side = side; bird.userData.wings.push(wing);
    }
    bird.userData.phase = i * 0.85; moving.birds.push(bird);
  }

  function animate(time) {
    for (const curtain of moving.curtains) {
      const positions = curtain.geometry.attributes.position;
      const base = curtain.userData.base;
      for (let i = 0; i < positions.count; i++) {
        const x = base[i * 3], y = base[i * 3 + 1];
        const bottom = (2.4 - y) / 4.8;
        positions.setXYZ(i, x + Math.sin(time * 0.8 + y) * 0.055 * bottom, y, Math.sin(x * 24) * 0.095 + Math.sin(time + y * 1.2) * 0.13 * bottom);
      }
      positions.needsUpdate = true; curtain.geometry.computeVertexNormals();
    }
    for (const leaf of moving.leaves) {
      const [x, y, z] = leaf.userData.origin, p = leaf.userData.phase;
      leaf.position.set(x + Math.sin(time * 0.4 + p) * 1.5, ((y - time * 0.3) % 9 + 9) % 9 - 1, z + Math.cos(time * 0.3 + p));
      leaf.rotation.set(time * 0.6 + p, time * 0.35, Math.sin(time + p));
    }
    for (const bird of moving.birds) {
      const p = bird.userData.phase;
      bird.position.set(Math.sin(time * 0.1 + p * 0.3) * 8, 4.2 + Math.sin(time * 0.3 + p) * 0.6 + p * 0.2, -12 - p);
      bird.rotation.y = -Math.cos(time * 0.1 + p * 0.3) * 0.25;
      for (const wing of bird.userData.wings) wing.rotation.z = Math.sin(time * 5 + p) * 0.65 * wing.userData.side;
    }
  }
  return { scene, objects, animate };
}
