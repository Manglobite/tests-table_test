// Настольный перекидной календарь: подставка, блок листов, текущая дата.
// Группа помечена focusId = 'calendar'.

import * as THREE from '../../vendor/three.module.js';
import { makeTexture } from '../materials.js';
import { LAYOUT } from '../config.js';

const MONTHS = ['ЯНВАРЬ', 'ФЕВРАЛЬ', 'МАРТ', 'АПРЕЛЬ', 'МАЙ', 'ИЮНЬ',
  'ИЮЛЬ', 'АВГУСТ', 'СЕНТЯБРЬ', 'ОКТЯБРЬ', 'НОЯБРЬ', 'ДЕКАБРЬ'];
const WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

function sheetTexture(now) {
  return makeTexture(512, 640, (ctx, w, h) => {
    // Лист
    ctx.fillStyle = '#f8f2e4';
    ctx.fillRect(0, 0, w, h);
    // Верхняя плашка месяца
    ctx.fillStyle = '#8c2f24';
    ctx.fillRect(0, 0, w, 108);
    ctx.fillStyle = '#f3e2c2';
    ctx.textAlign = 'center';
    ctx.font = '700 44px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(MONTHS[now.getMonth()], w / 2, 58);
    ctx.font = '600 26px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(String(now.getFullYear()), w / 2, 92);
    // Большое число
    ctx.fillStyle = '#33261a';
    ctx.font = '700 210px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(String(now.getDate()), w / 2, 330);
    // День недели
    const wd = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'][now.getDay()];
    ctx.font = '500 40px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = '#8c2f24';
    ctx.fillText(wd, w / 2, 396);
    // Мини-календарь месяца
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const lead = first.getDay();
    const cols = 7;
    const cellW = (w - 80) / cols;
    ctx.font = '400 22px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = '#9b8a72';
    WEEKDAYS.forEach((d, i) => {
      ctx.fillText(d, 40 + cellW * (i + 0.5), 452);
    });
    for (let day = 1; day <= daysInMonth; day++) {
      const idx = lead + day - 1;
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const x = 40 + cellW * (col + 0.5);
      const y = 490 + row * 38;
      const isToday = day === now.getDate();
      if (isToday) {
        ctx.fillStyle = '#d98a3a';
        ctx.beginPath();
        ctx.arc(x, y - 8, 19, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
      } else {
        ctx.fillStyle = '#4a3a28';
      }
      ctx.fillText(String(day), x, y);
    }
    // Лёгкие тени листа
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(60,40,20,0.06)');
    grad.addColorStop(1, 'rgba(60,40,20,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 108, w, h - 108);
  });
}

export function createCalendar(mats) {
  const g = new THREE.Group();
  g.userData.focusId = 'calendar';

  const now = new Date();
  const CW = 0.19;
  const CH = 0.24;

  // Задняя опора
  const support = new THREE.Mesh(new THREE.BoxGeometry(CW - 0.02, 0.2, 0.012), mats.oakDark);
  support.position.set(0, 0.085, -0.075);
  support.rotation.x = 0.42;
  support.castShadow = true;
  g.add(support);

  // Блок листов
  const block = new THREE.Group();
  const sheets = new THREE.Mesh(
    new THREE.BoxGeometry(CW, 0.012, CH),
    new THREE.MeshStandardMaterial({ color: '#e9e0cc', roughness: 0.95 })
  );
  sheets.position.y = 0.006;
  sheets.castShadow = sheets.receiveShadow = true;
  block.add(sheets);
  for (let i = 0; i < 3; i++) {
    const back = new THREE.Mesh(
      new THREE.BoxGeometry(CW - 0.004 - i * 0.002, 0.0016, CH - 0.004 - i * 0.002),
      new THREE.MeshStandardMaterial({ color: '#f3ecd9', roughness: 0.95 })
    );
    back.position.set(0, 0.013 + i * 0.0018, 0);
    back.rotation.x = -0.012 * i;
    block.add(back);
  }
  // Текущий лист
  const sheet = new THREE.Mesh(
    new THREE.PlaneGeometry(CW - 0.006, CH - 0.006),
    new THREE.MeshStandardMaterial({ map: sheetTexture(now), roughness: 0.92 })
  );
  sheet.rotation.x = -Math.PI / 2;
  sheet.position.y = 0.0195;
  block.add(sheet);
  block.rotation.x = -0.16; // листы слегка отклонены назад
  block.position.y = 0;
  g.add(block);

  // Металлическая планка с кольцами сверху
  const bar = new THREE.Mesh(new THREE.BoxGeometry(CW + 0.015, 0.012, 0.014), mats.metal);
  bar.position.set(0, 0.022, -CH / 2 + 0.004);
  g.add(bar);
  for (const rx of [-0.055, 0.055]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.011, 0.0028, 8, 16), mats.metal);
    ring.position.set(rx, 0.016, -CH / 2 + 0.004);
    g.add(ring);
  }

  g.position.set(LAYOUT.calendar.x, LAYOUT.desk.topY + 0.012, LAYOUT.calendar.z);
  g.rotation.y = LAYOUT.calendar.yaw;

  return { group: g, update() {} };
}
