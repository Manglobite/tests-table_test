// Птицы за окном: машущие крылья, круговые траектории; одна сидит на ветке.

import * as THREE from '../../vendor/three.module.js';

function makeBird(color) {
  const bird = new THREE.Group();
  const bodyGeo = new THREE.SphereGeometry(0.035, 10, 8);
  bodyGeo.scale(1.7, 0.7, 0.7);
  const body = new THREE.Mesh(
    bodyGeo,
    new THREE.MeshStandardMaterial({ color, roughness: 0.9 })
  );
  bird.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.017, 8, 8),
    body.material
  );
  head.position.set(0.05, 0.014, 0);
  bird.add(head);
  const beak = new THREE.Mesh(
    new THREE.ConeGeometry(0.007, 0.026, 8),
    new THREE.MeshStandardMaterial({ color: '#d9822b' })
  );
  beak.rotation.z = -Math.PI / 2;
  beak.position.set(0.075, 0.012, 0);
  bird.add(beak);
  const tail = new THREE.Mesh(
    new THREE.ConeGeometry(0.018, 0.06, 6),
    body.material
  );
  tail.rotation.z = Math.PI / 2;
  tail.position.set(-0.07, 0.005, 0);
  bird.add(tail);

  const wingGeo = new THREE.PlaneGeometry(0.085, 0.042);
  wingGeo.translate(0.042, 0, 0);
  const wingMat = new THREE.MeshStandardMaterial({
    color, roughness: 0.95, side: THREE.DoubleSide,
  });
  const wingL = new THREE.Mesh(wingGeo, wingMat);
  const wingR = new THREE.Mesh(wingGeo, wingMat);
  wingL.position.set(-0.01, 0.008, 0.012);
  wingR.position.set(-0.01, 0.008, -0.012);
  wingL.rotation.x = Math.PI / 2;
  wingR.rotation.x = -Math.PI / 2;
  bird.add(wingL, wingR);
  bird.userData.wings = [wingL, wingR];
  return bird;
}

export function createBirds() {
  const g = new THREE.Group();
  const colors = [0x5a4636, 0x6b5138, 0x4a3d33, 0x7a5a3c];
  const flyers = [];
  for (let i = 0; i < 4; i++) {
    const bird = makeBird(colors[i % colors.length]);
    g.add(bird);
    flyers.push({
      bird,
      cx: -0.8 + i * 0.55,
      cy: 2.0 + (i % 2) * 0.5,
      cz: -2.4 - (i % 3) * 0.35,
      rx: 0.7 + i * 0.16,
      rz: 0.32 + (i % 2) * 0.12,
      speed: 0.5 + i * 0.13,
      phase: i * 1.9,
      flap: 9 + i,
    });
  }

  // Сидящая птица на ветке (слева от окна, снаружи)
  const sitter = makeBird(0x54402e);
  sitter.scale.setScalar(1.15);
  sitter.position.set(-1.15, 1.62, -1.8);
  sitter.rotation.y = 0.5;
  g.add(sitter);

  function update(t) {
    for (const f of flyers) {
      const a = t * f.speed + f.phase;
      f.bird.position.set(
        f.cx + Math.cos(a) * f.rx,
        f.cy + Math.sin(a * 1.7 + f.phase) * 0.14,
        f.cz + Math.sin(a) * f.rz
      );
      // курс по касательной к эллипсу
      f.bird.rotation.y = -a + Math.PI / 2;
      f.bird.rotation.z = Math.cos(a * 1.7 + f.phase) * 0.18;
      const flap = Math.sin(t * f.flap + f.phase);
      f.bird.userData.wings[0].rotation.y = flap * 0.85;
      f.bird.userData.wings[1].rotation.y = -flap * 0.85;
    }
    // сидящая птица изредка вертит головой и покачивается
    sitter.rotation.y = 0.5 + Math.sin(t * 0.4) * 0.25;
    sitter.position.y = 1.62 + Math.abs(Math.sin(t * 2.2)) * 0.008;
    const flap = Math.sin(t * 3.1) > 0.94 ? Math.sin(t * 26) * 0.5 : 0;
    sitter.userData.wings[0].rotation.y = flap;
    sitter.userData.wings[1].rotation.y = -flap;
  }

  return { group: g, update };
}
