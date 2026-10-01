// Декор: чашка кофе с паром, книги, лампа, картина на стене.

import * as THREE from '../../vendor/three.module.js';
import { makeTexture, makeSoftCircleTexture } from '../materials.js';
import { LAYOUT } from '../config.js';

function cupProfile() {
  const pts = [];
  pts.push(new THREE.Vector2(0, 0));
  pts.push(new THREE.Vector2(0.036, 0));
  pts.push(new THREE.Vector2(0.038, 0.004));
  pts.push(new THREE.Vector2(0.04, 0.075));
  pts.push(new THREE.Vector2(0.036, 0.082));
  pts.push(new THREE.Vector2(0.033, 0.08));
  pts.push(new THREE.Vector2(0.031, 0.01));
  pts.push(new THREE.Vector2(0.0, 0.008));
  return pts;
}

function bookTexture(title, bg, fg) {
  return makeTexture(256, 64, (ctx, w, h) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(0, 8, w, 3);
    ctx.fillRect(0, h - 11, w, 3);
    ctx.fillStyle = fg;
    ctx.textAlign = 'center';
    ctx.font = '600 26px Georgia, serif';
    ctx.fillText(title, w / 2, h / 2 + 9);
  });
}

function paintingTexture() {
  return makeTexture(256, 320, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#ffd9a0');
    g.addColorStop(0.6, '#e8a15c');
    g.addColorStop(1, '#a05a2c');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.beginPath();
    ctx.arc(w * 0.68, h * 0.3, 26, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,245,225,0.95)';
    ctx.fill();
    ctx.fillStyle = '#7c3f1e';
    ctx.beginPath();
    ctx.moveTo(0, h * 0.78);
    ctx.quadraticCurveTo(w * 0.5, h * 0.6, w, h * 0.82);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.fill();
    ctx.strokeStyle = '#5d3218';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(w * 0.3, h * 0.86);
    ctx.quadraticCurveTo(w * 0.27, h * 0.66, w * 0.33, h * 0.55);
    ctx.stroke();
    const cols = ['#e8b23a', '#c14b2a', '#d4622a', '#9a5a2e'];
    for (let i = 0; i < 16; i++) {
      ctx.fillStyle = cols[i % 4];
      ctx.beginPath();
      ctx.ellipse(w * 0.24 + (i % 5) * 18, h * 0.42 + ((i * 7) % 3) * 22, 11, 6, i, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

export function createDecor(mats) {
  const g = new THREE.Group();
  const updates = [];
  const topY = LAYOUT.desk.topY;

  // ---- Чашка кофе на блюдце
  const cupG = new THREE.Group();
  const ceramic = new THREE.MeshStandardMaterial({ color: '#e9e2d4', roughness: 0.35 });
  const cup = new THREE.Mesh(new THREE.LatheGeometry(cupProfile(), 28), ceramic);
  cup.castShadow = cup.receiveShadow = true;
  cupG.add(cup);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.006, 10, 22, Math.PI * 1.3), ceramic);
  handle.position.set(0.04, 0.045, 0);
  handle.rotation.z = -Math.PI / 2 - 0.35;
  handle.castShadow = true;
  cupG.add(handle);
  const coffee = new THREE.Mesh(
    new THREE.CircleGeometry(0.031, 24),
    new THREE.MeshStandardMaterial({ color: '#4a2c18', roughness: 0.25 })
  );
  coffee.rotation.x = -Math.PI / 2;
  coffee.position.y = 0.07;
  cupG.add(coffee);
  const saucer = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.045, 0.008, 26), ceramic);
  saucer.position.y = -0.004;
  saucer.receiveShadow = true;
  cupG.add(saucer);
  cupG.position.set(-0.32, topY + 0.012, -0.14);
  g.add(cupG);

  // Пар над чашкой
  const steamTex = makeSoftCircleTexture();
  const steam = [];
  for (let i = 0; i < 3; i++) {
    const p = new THREE.Mesh(
      new THREE.PlaneGeometry(0.05, 0.1),
      new THREE.MeshBasicMaterial({
        map: steamTex, transparent: true, opacity: 0.16, depthWrite: false,
      })
    );
    p.position.set(cupG.position.x, topY + 0.12, cupG.position.z);
    g.add(p);
    steam.push({ p, phase: i * 2.1, speed: 0.35 + i * 0.08 });
  }
  updates.push((t) => {
    for (const s of steam) {
      const k = (t * s.speed + s.phase) % 2.4;
      s.p.position.y = topY + 0.1 + k * 0.09;
      s.p.position.x = cupG.position.x + Math.sin(t * 1.4 + s.phase) * 0.012;
      s.p.material.opacity = 0.16 * (1 - k / 2.4);
    }
  });

  // ---- Стопка книг слева сзади
  const books = [
    { w: 0.24, d: 0.17, t: 0.035, color: '#5d3a63', title: 'Тихая осень' },
    { w: 0.22, d: 0.16, t: 0.03, color: '#3a5d4c', title: 'Лес и погода' },
    { w: 0.2, d: 0.15, t: 0.026, color: '#8c4a2c', title: 'Чай. Рецепты' },
  ];
  let by = topY + 0.012;
  books.forEach((b, i) => {
    const mat = new THREE.MeshStandardMaterial({ map: bookTexture(b.title, b.color, '#f2e4c8'), roughness: 0.7 });
    const m = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.t, b.d), mat);
    m.position.set(-1.02, by + b.t / 2, -0.34);
    m.rotation.y = (i - 1) * 0.14;
    m.castShadow = m.receiveShadow = true;
    g.add(m);
    by += b.t;
  });

  // ---- Настольная лампа
  const lampG = new THREE.Group();
  const darkMetal = new THREE.MeshStandardMaterial({ color: '#3d3a35', roughness: 0.5, metalness: 0.5 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 0.02, 22), darkMetal);
  base.castShadow = true;
  lampG.add(base);
  const armLow = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.2, 10), darkMetal);
  armLow.position.set(0, 0.1, 0);
  armLow.rotation.z = 0.18;
  armLow.castShadow = true;
  lampG.add(armLow);
  const armTop = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.007, 0.18, 10), darkMetal);
  armTop.position.set(0.075, 0.245, 0);
  armTop.rotation.z = 1.05;
  armTop.castShadow = true;
  lampG.add(armTop);
  const shade = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.062, 0.075, 24, 1, true),
    new THREE.MeshStandardMaterial({
      color: '#b0653a', roughness: 0.6, side: THREE.DoubleSide,
      emissive: '#ff9a4a', emissiveIntensity: 0.28,
    })
  );
  shade.position.set(0.15, 0.29, 0);
  shade.rotation.z = 0.35;
  shade.castShadow = true;
  lampG.add(shade);
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.016, 12, 10),
    new THREE.MeshBasicMaterial({ color: '#ffd9a0' })
  );
  bulb.position.set(0.16, 0.268, 0);
  lampG.add(bulb);
  const lampLight = new THREE.PointLight(0xffc27a, 0.55, 1.6, 2);
  lampLight.position.set(0.16, 0.26, 0);
  lampG.add(lampLight);
  lampG.position.set(-1.02, topY + 0.012, 0.28);
  lampG.rotation.y = -0.5;
  g.add(lampG);

  // ---- Картина на правой стене
  const art = new THREE.Group();
  const artMat = new THREE.MeshStandardMaterial({ map: paintingTexture(), roughness: 0.9 });
  const artMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.62), artMat);
  const artFrame = new THREE.Mesh(
    new THREE.BoxGeometry(0.56, 0.68, 0.03),
    new THREE.MeshStandardMaterial({ color: '#6d4a28', roughness: 0.55 })
  );
  artFrame.position.z = -0.012;
  artFrame.castShadow = true;
  art.add(artFrame, artMesh);
  art.position.set(1.9, 1.75, -0.65);
  art.rotation.y = -Math.PI / 2;
  g.add(art);

  return {
    group: g,
    update(t) {
      for (const u of updates) u(t);
    },
  };
}
