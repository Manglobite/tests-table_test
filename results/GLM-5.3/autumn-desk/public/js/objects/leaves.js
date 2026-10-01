// Осенние листья: падающие за окном и у порога, пара дрейфующих у окна,
// статические сухие листья на столе и полу.

import * as THREE from '../../vendor/three.module.js';
import { makeLeafMaterials } from '../materials.js';

function rand(min, max) {
  return min + Math.random() * (max - min);
}

export function createLeaves() {
  const g = new THREE.Group();
  const mats = makeLeafMaterials();
  const leafGeo = new THREE.PlaneGeometry(0.09, 0.09);

  const mkLeaf = () => new THREE.Mesh(leafGeo, mats[(Math.random() * mats.length) | 0]);

  // ---- Падающие снаружи
  const falling = [];
  for (let i = 0; i < 26; i++) {
    const m = mkLeaf();
    m.castShadow = false;
    g.add(m);
    falling.push({
      m,
      x: rand(-1.7, 1.7),
      y: rand(0.6, 4.2),
      z: rand(-3.0, -1.55),
      fall: rand(0.16, 0.4),
      swayA: rand(0.14, 0.42),
      swayF: rand(0.5, 1.3),
      phase: rand(0, Math.PI * 2),
      spinX: rand(0.6, 2.4),
      spinZ: rand(0.6, 2.8),
    });
  }

  // ---- Дрейфующие в комнате у окна
  const indoor = [];
  for (let i = 0; i < 3; i++) {
    const m = mkLeaf();
    g.add(m);
    indoor.push({
      m,
      cx: rand(-0.7, 0.7),
      cy: rand(1.0, 1.9),
      cz: rand(-1.15, -0.5),
      amp: rand(0.16, 0.3),
      speed: rand(0.14, 0.3),
      phase: rand(0, Math.PI * 2),
    });
  }

  // ---- Статичные сухие листья (стол и пол)
  const statics = [];
  const putStatic = (x, y, z, rotY, scale, curl) => {
    const m = mkLeaf();
    m.scale.setScalar(scale);
    m.position.set(x, y, z);
    m.rotation.set(curl, rotY, curl * 0.6);
    m.receiveShadow = true;
    g.add(m);
    statics.push(m);
  };
  putStatic(1.05, 0.768, 0.42, 0.7, 1.1, 0.15);
  putStatic(1.16, 0.768, 0.3, 2.1, 0.95, -0.12);
  putStatic(0.92, 0.768, 0.5, 4.0, 0.85, 0.2);
  putStatic(-1.15, 0.768, -0.42, 1.2, 1.0, -0.18);
  putStatic(0.55, 0.012, 1.05, 0.4, 1.2, 0.1);
  putStatic(0.8, 0.012, 1.3, 2.6, 1.05, -0.15);
  putStatic(-0.5, 0.012, 1.18, 5.1, 1.15, 0.12);
  putStatic(-0.95, 0.012, 0.75, 3.4, 0.9, -0.1);
  putStatic(0.1, 0.012, 1.5, 1.9, 1.0, 0.14);

  function update(t, dt) {
    for (const f of falling) {
      f.y -= f.fall * dt;
      if (f.y < 0.35) {
        f.y = rand(3.2, 4.3);
        f.x = rand(-1.7, 1.7);
      }
      f.m.position.set(
        f.x + Math.sin(t * f.swayF + f.phase) * f.swayA,
        f.y,
        f.z + Math.cos(t * f.swayF * 0.7 + f.phase) * 0.1
      );
      f.m.rotation.set(t * f.spinX + f.phase, t * 0.7, t * f.spinZ);
    }
    for (const d of indoor) {
      d.m.position.set(
        d.cx + Math.sin(t * d.speed + d.phase) * d.amp,
        d.cy + Math.sin(t * d.speed * 1.6 + d.phase * 2) * 0.16,
        d.cz + Math.cos(t * d.speed * 0.8 + d.phase) * 0.14
      );
      d.m.rotation.set(t * 0.5 + d.phase, t * 0.3, t * 0.42);
    }
  }

  return { group: g, update };
}
