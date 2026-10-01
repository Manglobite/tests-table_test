// Резной дубовый стол: столешница с фаской, фронтальный фартук с розетками
// и бусинами, точёные ножки, угловые кронштейны.

import * as THREE from '../../vendor/three.module.js';
import { LAYOUT } from '../config.js';

export function createDesk(mats) {
  const g = new THREE.Group();
  const d = LAYOUT.desk;
  const halfW = d.width / 2;
  const halfD = d.depth / 2;
  const topY = d.topY;

  // Столешница
  const top = new THREE.Mesh(new THREE.BoxGeometry(d.width, d.topThickness, d.depth), mats.oak);
  top.position.y = topY - d.topThickness / 2;
  top.castShadow = top.receiveShadow = true;
  g.add(top);

  // Фаска-молдинг по периметру столешницы (ромбический профиль)
  const bevel = 0.028;
  const moldMat = mats.oakDark;
  const mold = new THREE.Mesh(new THREE.BoxGeometry(d.width - bevel * 2, bevel, bevel), moldMat);
  const moldZ = new THREE.Mesh(new THREE.BoxGeometry(d.width - bevel * 2, bevel, bevel), moldMat);
  mold.rotation.z = Math.PI / 4;
  moldZ.rotation.z = Math.PI / 4;
  mold.position.set(0, topY - bevel * 0.4, halfD);
  moldZ.position.set(0, topY - bevel * 0.4, -halfD);
  mold.castShadow = moldZ.castShadow = true;
  g.add(mold, moldZ);
  const moldL = mold.clone();
  const moldR = mold.clone();
  moldL.rotation.set(Math.PI / 2, 0, Math.PI / 4);
  moldR.rotation.set(Math.PI / 2, 0, Math.PI / 4);
  moldL.position.set(-halfW + bevel * 0.4, topY - bevel * 0.4, 0);
  moldR.position.set(halfW - bevel * 0.4, topY - bevel * 0.4, 0);
  g.add(moldL, moldR);

  // Фронтальный фартук с резьбой
  const apronY = topY - d.topThickness - d.apronH / 2;
  const apron = new THREE.Mesh(new THREE.BoxGeometry(d.width - 0.26, d.apronH, 0.05), mats.oakDark);
  apron.position.set(0, apronY, halfD - 0.06);
  apron.castShadow = apron.receiveShadow = true;
  g.add(apron);

  // Резные канавки фартука
  const groove = new THREE.Mesh(
    new THREE.BoxGeometry(d.width - 0.34, 0.014, 0.012),
    new THREE.MeshStandardMaterial({ color: '#4a3018', roughness: 0.8 })
  );
  groove.position.set(0, apronY + d.apronH * 0.3, halfD - 0.033);
  g.add(groove);
  const groove2 = groove.clone();
  groove2.position.y = apronY - d.apronH * 0.3;
  g.add(groove2);

  // Розетки с концентрическими кольцами
  const rosetteMat = mats.oak;
  const nRos = 7;
  for (let i = 0; i < nRos; i++) {
    const x = -((nRos - 1) / 2) * 0.3 + i * 0.3;
    const ros = new THREE.Group();
    ros.position.set(x, apronY, halfD - 0.05);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.018, 24), rosetteMat);
    disc.rotation.x = Math.PI / 2;
    disc.position.z = 0.012;
    disc.castShadow = true;
    ros.add(disc);
    const ring1 = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.005, 10, 28), mats.oakDark);
    ring1.position.z = 0.022;
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.004, 8, 22), mats.oakDark);
    ring2.position.z = 0.023;
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.011, 12, 12), rosetteMat);
    core.position.z = 0.026;
    ros.add(ring1, ring2, core);
    g.add(ros);
  }

  // Бусины между розетками
  const bead = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.28, 10), rosetteMat);
  bead.rotation.z = Math.PI / 2;
  bead.position.set(0, apronY - d.apronH * 0.42, halfD - 0.052);
  for (let i = 0; i < nRos - 1; i++) {
    const b = bead.clone();
    b.position.x = -((nRos - 2) / 2) * 0.3 + i * 0.3;
    g.add(b);
  }

  // Точёные ножки
  const legH = topY - d.topThickness - 0.02;
  const mkLeg = () => {
    const leg = new THREE.Group();
    let y = 0;
    const add = (mesh, h) => {
      mesh.position.y = y + h / 2;
      leg.add(mesh);
      y += h;
    };
    add(new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.03, 0.11), mats.oakDark), 0.03);
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 12), mats.oakDark);
    foot.scale.y = 0.7;
    add(foot, 0.05);
    const ringA = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 10, 24), mats.oakDark);
    ringA.rotation.x = Math.PI / 2;
    add(ringA, 0.02);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.05, legH * 0.42, 16), mats.oak), legH * 0.42);
    const bulge = new THREE.Mesh(new THREE.SphereGeometry(0.056, 16, 12), mats.oak);
    bulge.scale.y = 1.5;
    add(bulge, 0.09);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, legH * 0.4, 16), mats.oak), legH * 0.4);
    const ringB = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.009, 10, 24), mats.oakDark);
    ringB.rotation.x = Math.PI / 2;
    add(ringB, 0.018);
    const topPart = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.06, 16), mats.oak);
    add(topPart, 0.06);
    // компенсация накопленной высоты
    const total = 0.03 + 0.05 + 0.02 + legH * 0.42 + 0.09 + legH * 0.4 + 0.018 + 0.06;
    const stretch = legH / total;
    leg.scale.y = stretch;
    leg.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    return leg;
  };
  const xs = [halfW - d.legInset, -(halfW - d.legInset)];
  const zs = [halfD - 0.12, -(halfD - 0.12)];
  for (const x of xs) {
    for (const z of zs) {
      const leg = mkLeg();
      leg.position.set(x, 0.02, z);
      g.add(leg);
    }
  }

  // Угловые кронштейны с завитком
  const mkBracket = (x, z, rotY) => {
    const br = new THREE.Group();
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.22), mats.oak);
    plate.position.set(0, -0.09, 0.11);
    br.add(plate);
    const scroll = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.012, 10, 20, Math.PI * 1.4), mats.oakDark);
    scroll.rotation.set(0, Math.PI / 2, 0.3);
    scroll.position.set(0, -0.16, 0.05);
    br.add(scroll);
    br.position.set(x, topY - d.topThickness, z);
    br.rotation.y = rotY;
    br.traverse((o) => {
      if (o.isMesh) o.castShadow = true;
    });
    return br;
  };
  g.add(mkBracket(halfW - 0.14, halfD - 0.12, 0));
  g.add(mkBracket(-(halfW - 0.14), halfD - 0.12, 0));

  return g;
}
