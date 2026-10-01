// Шторы: карниз с кольцами и два полотна с мягкой волной (CPU-анимация вершин).

import * as THREE from '../../vendor/three.module.js';
import { makeCurtainTexture } from '../materials.js';

const SEG_X = 26;
const SEG_Y = 30;

function makePanel(width, height, tex) {
  const geo = new THREE.PlaneGeometry(width, height, SEG_X, SEG_Y);
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.92,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  return mesh;
}

export function createCurtains(mats) {
  const g = new THREE.Group();
  const win = { cx: 0, wallZ: -1.35, width: 1.46 };
  const rodY = 2.72;
  const panelH = 1.98;
  const panelW = 0.58;

  // Карниз
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 2.5, 14), mats.brass);
  rod.rotation.z = Math.PI / 2;
  rod.position.set(win.cx, rodY, win.wallZ + 0.16);
  rod.castShadow = true;
  g.add(rod);
  for (const fx of [-1.24, 1.24]) {
    const fin = new THREE.Mesh(new THREE.SphereGeometry(0.036, 14, 12), mats.brass);
    fin.position.set(win.cx + fx, rodY, win.wallZ + 0.16);
    g.add(fin);
  }

  const tex = makeCurtainTexture();
  const panels = [];
  for (const side of [-1, 1]) {
    const panel = makePanel(panelW, panelH, tex);
    const px = win.cx + side * (0.75 + panelW / 2 - 0.14);
    panel.position.set(px, rodY - 0.06 - panelH / 2, win.wallZ + 0.14);
    panel.userData.baseX = panel.position.x;
    panel.userData.phase = side * 1.7;
    // кольца поверх полотна
    for (let i = 0; i < 4; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.007, 8, 18), mats.brass);
      ring.position.set(px - side * 0.06 + i * side * 0.045, rodY - 0.03, win.wallZ + 0.15);
      ring.rotation.y = Math.PI / 2;
      g.add(ring);
    }
    g.add(panel);
    panels.push(panel);
  }

  const pos = panels.map((p) => p.geometry.attributes.position);
  const base = pos.map((arr) => Float32Array.from(arr.array));

  function update(t) {
    for (let pi = 0; pi < panels.length; pi++) {
      const arr = pos[pi];
      const b = base[pi];
      const phase = panels[pi].userData.phase;
      for (let i = 0; i < arr.count; i++) {
        const ix = i * 3;
        const x = b[ix];
        const y = b[ix + 1];
        const k = (panelW / 2 - Math.abs(x)) / panelW; // сильнее у кромок
        arr.array[ix + 2] = (Math.sin(x * 9 + t * 1.15 + phase) * 0.045
          + Math.sin(y * 6 - t * 0.8 + phase) * 0.03) * (0.35 + k);
        arr.array[ix] = x + Math.sin(y * 4 + t * 0.6 + phase) * 0.012;
      }
      arr.needsUpdate = true;
      panels[pi].geometry.computeVertexNormals();
    }
  }

  return { group: g, update };
}
