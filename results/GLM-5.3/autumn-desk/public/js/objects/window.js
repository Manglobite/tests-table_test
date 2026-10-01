// Окно: дубовая рама, приоткрытая левая створка, вид на осенний пейзаж
// (небо с солнцем, дальние холмы, ветка с листьями), подоконник.
// Группа помечена focusId = 'window'.

import * as THREE from '../../vendor/three.module.js';
import { LAYOUT } from '../config.js';
import {
  makeSkyTexture, makeHillsTexture, makeBranchTexture,
} from '../materials.js';

export function createWindow(mats) {
  const g = new THREE.Group();
  const W = LAYOUT.window;
  const hw = W.width / 2;
  const hh = W.height / 2;
  const frameDepth = 0.1;
  const bar = 0.06;

  g.userData.focusId = 'window';

  const frameMat = mats.oakPainted;

  // Внешняя рама
  const mkBar = (w, h, x, y) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, frameDepth), frameMat);
    m.position.set(x, y, 0);
    m.castShadow = m.receiveShadow = true;
    g.add(m);
  };
  mkBar(W.width + bar * 2, bar, 0, hh + bar / 2);
  mkBar(W.width + bar * 2, bar, 0, -hh - bar / 2);
  mkBar(bar, W.height, -hw - bar / 2, 0);
  mkBar(bar, W.height, hw + bar / 2, 0);

  // Средник (створочный разделитель)
  const mid = new THREE.Mesh(new THREE.BoxGeometry(0.05, W.height, 0.07), frameMat);
  mid.castShadow = true;
  g.add(mid);

  // Правая (закрытая) створка: рамка + стекло
  const mkSash = (w, h) => {
    const sash = new THREE.Group();
    const sb = 0.045;
    const parts = [
      [w, sb, 0, h / 2 - sb / 2],
      [w, sb, 0, -h / 2 + sb / 2],
      [sb, h - sb * 2, -w / 2 + sb / 2, 0],
      [sb, h - sb * 2, w / 2 - sb / 2, 0],
      [w - sb * 2, 0.032, 0, h * 0.16],
    ];
    for (const [bw, bh, x, y] of parts) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.055), frameMat);
      m.position.set(x, y, 0);
      m.castShadow = true;
      sash.add(m);
    }
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(w - sb * 2, h - sb * 2 - 0.05), mats.glass);
    glass.position.z = -0.005;
    sash.add(glass);
    return sash;
  };

  const sashH = W.height / 2 - 0.008;
  const sashW = hw - 0.035;

  const sashRight = mkSash(sashW, sashH);
  sashRight.position.set(hw / 2 + 0.017, 0, 0.01);
  g.add(sashRight);

  // Левая створка приоткрыта наружу (навес на левой кромке)
  const hingeGroup = new THREE.Group();
  hingeGroup.position.set(-hw / 2 - 0.017, 0, 0.01);
  const sashLeft = mkSash(sashW, sashH);
  sashLeft.position.x = hw / 2 + 0.017; // в системе петли
  hingeGroup.add(sashLeft);
  hingeGroup.rotation.y = -LAYOUT.window.openAngle;
  g.add(hingeGroup);
  g.userData.doorSash = hingeGroup;

  // Подоконник с кронштейнами
  const sill = new THREE.Mesh(new THREE.BoxGeometry(W.width + 0.42, 0.05, 0.3), mats.oakPainted);
  sill.position.set(0, -hh - bar - 0.02, 0.12);
  sill.castShadow = sill.receiveShadow = true;
  g.add(sill);
  for (const sx of [-hw + 0.1, hw - 0.1]) {
    const br = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.22), mats.oakPainted);
    br.position.set(sx, -hh - bar - 0.065, 0.08);
    g.add(br);
  }

  // ---- Вид снаружи (за окно)
  const view = new THREE.Group();
  view.position.z = -0.2;
  const sky = new THREE.Mesh(
    new THREE.PlaneGeometry(9, 5.6),
    new THREE.MeshBasicMaterial({ map: makeSkyTexture(), fog: false })
  );
  sky.position.set(0, 1.9, -3.4);
  view.add(sky);

  const hills = new THREE.Mesh(
    new THREE.PlaneGeometry(9, 1.9),
    new THREE.MeshBasicMaterial({
      map: makeHillsTexture(), transparent: true, alphaTest: 0.05, fog: false,
    })
  );
  hills.position.set(0, 0.7, -3.1);
  view.add(hills);

  const branch = new THREE.Mesh(
    new THREE.PlaneGeometry(1.9, 1.9),
    new THREE.MeshBasicMaterial({
      map: makeBranchTexture(), transparent: true, alphaTest: 0.1, side: THREE.DoubleSide,
    })
  );
  branch.position.set(-1.05, 2.35, -1.85);
  branch.rotation.z = 0.12;
  view.add(branch);
  g.userData.branch = branch;

  g.add(view);

  // Позиция в комнате
  g.position.set(W.cx, W.cy, W.wallZ);

  return g;
}
