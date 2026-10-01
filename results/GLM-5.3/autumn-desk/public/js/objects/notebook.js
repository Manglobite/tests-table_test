// Открытый блокнот: обложка, страницы с рукописным содержимым, пружина, ручка.
// Группа помечена focusId = 'notebook'.

import * as THREE from '../../vendor/three.module.js';
import { makeTexture } from '../materials.js';
import { LAYOUT } from '../config.js';

function pageTexture(kind) {
  return makeTexture(512, 700, (ctx, w, h) => {
    ctx.fillStyle = '#f7efdd';
    ctx.fillRect(0, 0, w, h);
    // лёгкие линии бумаги
    ctx.strokeStyle = 'rgba(120,150,170,0.28)';
    ctx.lineWidth = 1.4;
    for (let y = 90; y < h - 40; y += 52) {
      ctx.beginPath();
      ctx.moveTo(36, y);
      ctx.lineTo(w - 36, y);
      ctx.stroke();
    }
    // поля
    ctx.strokeStyle = 'rgba(200,90,70,0.5)';
    ctx.beginPath();
    ctx.moveTo(kind === 'left' ? w - 46 : 46, 30);
    ctx.lineTo(kind === 'left' ? w - 46 : 46, h - 30);
    ctx.stroke();
    // тень у корешка
    const grad = ctx.createLinearGradient(kind === 'left' ? w : 0, 0, kind === 'left' ? w - 90 : 90, 0);
    grad.addColorStop(0, 'rgba(90,60,30,0.22)');
    grad.addColorStop(1, 'rgba(90,60,30,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    const ink = '#2e3a5c';
    const pen = (font) => { ctx.font = font; ctx.fillStyle = ink; };

    if (kind === 'left') {
      ctx.textAlign = 'left';
      pen('600 40px "Segoe Script", "Comic Sans MS", cursive');
      ctx.fillText('Сентябрь, вторник', 60, 74);
      pen('38px "Segoe Script", "Comic Sans MS", cursive');
      const lines = [
        'Чай с корицей — две щепотки',
        'Дописать письмо бабушке',
        'Гулять до заката',
        'Полить дубок на балконе',
      ];
      lines.forEach((s, i) => ctx.fillText(s, 60, 190 + i * 110));
      // клякса
      ctx.fillStyle = 'rgba(46,58,92,0.16)';
      ctx.beginPath();
      ctx.ellipse(400, 620, 22, 12, 0.4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.textAlign = 'left';
      pen('600 40px "Segoe Script", "Comic Sans MS", cursive');
      ctx.fillText('Сделать:', 60, 74);
      pen('34px "Segoe Script", "Comic Sans MS", cursive');
      const items = [
        ['собрать листья для гербария', true],
        ['выбрать раму для фото', true],
        ['позвонить в 18:00', false],
        ['новый плейлист на вечер', false],
      ];
      items.forEach(([s, done], i) => {
        const y = 190 + i * 96;
        ctx.strokeStyle = ink;
        ctx.lineWidth = 2.4;
        ctx.strokeRect(58, y - 26, 26, 26);
        if (done) {
          ctx.beginPath();
          ctx.moveTo(62, y - 13);
          ctx.lineTo(68, y - 6);
          ctx.lineTo(80, y - 22);
          ctx.stroke();
          ctx.fillStyle = 'rgba(46,58,92,0.45)';
          ctx.fillText(s, 100, y);
          ctx.fillStyle = ink;
        } else {
          ctx.fillText(s, 100, y);
        }
      });
      // набросок дубового листа
      ctx.save();
      ctx.translate(330, 590);
      ctx.rotate(-0.35);
      ctx.strokeStyle = '#7a4a20';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 60);
      ctx.lineTo(0, -50);
      ctx.stroke();
      ctx.fillStyle = '#d98a3a';
      ctx.beginPath();
      ctx.moveTo(0, -50);
      ctx.bezierCurveTo(-70, -34, -66, 44, 0, 26);
      ctx.bezierCurveTo(66, 44, 70, -34, 0, -50);
      ctx.fill();
      ctx.strokeStyle = 'rgba(120,60,20,0.6)';
      ctx.lineWidth = 1.6;
      for (let i = 0; i < 4; i++) {
        const y = -34 + i * 16;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(-34 + i * 3, y - 14);
        ctx.moveTo(0, y);
        ctx.lineTo(34 - i * 3, y - 14);
        ctx.stroke();
      }
      ctx.restore();
    }
  });
}

export function createNotebook(mats) {
  const g = new THREE.Group();
  g.userData.focusId = 'notebook';

  const PW = 0.21; // половина раскрытой ширины
  const PH = 0.3;  // высота страницы

  // Обложка
  const cover = new THREE.Mesh(
    new THREE.BoxGeometry(PW * 2 + 0.02, 0.008, PH + 0.02),
    new THREE.MeshStandardMaterial({ color: '#7c2f24', roughness: 0.75 })
  );
  cover.position.y = -0.008;
  cover.castShadow = cover.receiveShadow = true;
  g.add(cover);

  // Стопка страниц под верхними
  const stack = new THREE.Mesh(
    new THREE.BoxGeometry(PW * 2 - 0.004, 0.01, PH - 0.004),
    new THREE.MeshStandardMaterial({ color: '#efe5cd', roughness: 0.95 })
  );
  stack.position.y = -0.002;
  stack.castShadow = true;
  g.add(stack);

  const pageMatL = new THREE.MeshStandardMaterial({ map: pageTexture('left'), roughness: 0.95 });
  const pageMatR = new THREE.MeshStandardMaterial({ map: pageTexture('right'), roughness: 0.95 });

  const pageL = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), pageMatL);
  pageL.rotation.x = -Math.PI / 2;
  pageL.rotation.y = 0;
  pageL.rotation.z = 0.055;
  pageL.position.set(-PW / 2, 0.004, 0);
  const pageR = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), pageMatR);
  pageR.rotation.x = -Math.PI / 2;
  pageR.rotation.z = -0.055;
  pageR.position.set(PW / 2, 0.004, 0);
  g.add(pageL, pageR);

  // Пружина по корешку
  for (let i = 0; i < 9; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.009, 0.0022, 8, 14), mats.metal);
    ring.rotation.y = Math.PI / 2;
    ring.position.set(0, 0.006, -PH / 2 + 0.012 + i * (PH - 0.024) / 8);
    g.add(ring);
  }

  // Ручка поверх правой страницы
  const pen = new THREE.Group();
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.006, 0.006, 0.15, 12),
    new THREE.MeshStandardMaterial({ color: '#27333f', roughness: 0.35, metalness: 0.3 })
  );
  barrel.rotation.z = Math.PI / 2;
  pen.add(barrel);
  const tip = new THREE.Mesh(
    new THREE.ConeGeometry(0.006, 0.024, 12),
    new THREE.MeshStandardMaterial({ color: '#b9c2cc', roughness: 0.3, metalness: 0.6 })
  );
  tip.rotation.z = -Math.PI / 2;
  tip.position.x = 0.085;
  pen.add(tip);
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0064, 0.0064, 0.02, 12),
    new THREE.MeshStandardMaterial({ color: '#d9a441', roughness: 0.4, metalness: 0.5 })
  );
  cap.rotation.z = Math.PI / 2;
  cap.position.x = -0.07;
  pen.add(cap);
  pen.rotation.set(-Math.PI / 2 + 0.03, 0.25, Math.PI / 2 - 0.06);
  pen.position.set(0.07, 0.012, 0.09);
  pen.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  g.add(pen);

  g.position.set(LAYOUT.notebook.x, LAYOUT.desk.topY + 0.012, LAYOUT.notebook.z);
  g.rotation.y = -0.08;

  return { group: g, update() {} };
}
