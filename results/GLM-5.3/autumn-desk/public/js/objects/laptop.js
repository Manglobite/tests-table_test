// Ноутбук с экраном блокировки в стиле Windows 11.
// Экран — живая canvas-текстура: крупные часы/дата, спокойный фон, поле пароля.
// Состояние демонстрационное: ввод живёт только в памяти вкладки,
// не логируется и никуда не отправляется. Группа помечена focusId = 'laptop'.

import * as THREE from '../../vendor/three.module.js';
import { makeTexture } from '../materials.js';
import { LAYOUT } from '../config.js';

const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const MONTHS_NOM = ['ЯНВАРЬ', 'ФЕВРАЛЬ', 'МАРТ', 'АПРЕЛЬ', 'МАЙ', 'ИЮНЬ',
  'ИЮЛЬ', 'АВГУСТ', 'СЕНТЯБРЬ', 'ОКТЯБРЬ', 'НОЯБРЬ', 'ДЕКАБРЬ'];
const WEEKDAYS = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];

const SW = 1024;
const SH = 600;

function drawLockScreen(ctx, state, t) {
  const now = state.fixedTime ?? new Date();
  // Спокойный фон: глубокий сине-бирюзовый градиент с мягкими «боке»
  const bg = ctx.createLinearGradient(0, 0, SW * 0.25, SH);
  bg.addColorStop(0, '#12304a');
  bg.addColorStop(0.55, '#1d4c5e');
  bg.addColorStop(1, '#7a4a2f');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, SW, SH);
  for (let i = 0; i < 14; i++) {
    const x = ((i * 173) % SW);
    const y = ((i * 311) % SH);
    const r = 26 + (i % 5) * 22;
    const grad = ctx.createRadialGradient(x, y, 1, x, y, r);
    const warm = i % 3 === 0;
    grad.addColorStop(0, warm ? 'rgba(255,170,90,0.16)' : 'rgba(140,220,255,0.10)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  if (state.mode === 'welcome') {
    // Экран приветствия с спиннером (чисто демонстрация)
    ctx.fillStyle = 'rgba(10,24,36,0.55)';
    ctx.fillRect(0, 0, SW, SH);
    ctx.fillStyle = 'rgba(255,255,255,0.94)';
    ctx.font = '600 44px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Добро пожаловать', SW / 2, SH / 2 - 26);
    const a = t * 3.4;
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(SW / 2, SH / 2 + 48, 22, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#ffcf8a';
    ctx.beginPath();
    ctx.arc(SW / 2, SH / 2 + 48, 22, a, a + Math.PI * 0.85);
    ctx.stroke();
    return;
  }

  // Часы и дата (крупно, слева сверху)
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255,255,255,0.97)';
  ctx.font = '600 118px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(`${hh}:${mm}`, 56, 150);
  ctx.font = '400 34px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  const wd = WEEKDAYS[now.getDay()];
  ctx.fillText(`${wd}, ${now.getDate()} ${MONTHS_GEN[now.getMonth()]}`, 60, 202);

  // Погода (декоративно, без сети)
  ctx.font = '400 26px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.62)';
  ctx.fillText('14°  солнечно', 60, 248);
  ctx.beginPath();
  ctx.arc(196, 240, 10, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,205,130,0.85)';
  ctx.fill();

  // Центральный блок входа: аватар + пилюля пароля
  const cx = SW / 2;
  const cy = SH - 148;
  ctx.beginPath();
  ctx.arc(cx, cy - 74, 42, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy - 88, 13, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx, cy - 48, 22, 16, 0, Math.PI, Math.PI * 2);
  ctx.fill();

  const pillW = 300;
  const pillH = 40;
  const pillX = cx - pillW / 2;
  const pillY = cy - 20;
  ctx.beginPath();
  const r = pillH / 2;
  ctx.moveTo(pillX + r, pillY);
  ctx.arcTo(pillX + pillW, pillY, pillX + pillW, pillY + pillH, r);
  ctx.arcTo(pillX + pillW, pillY + pillH, pillX, pillY + pillH, r);
  ctx.arcTo(pillX, pillY + pillH, pillX, pillY, r);
  ctx.arcTo(pillX, pillY, pillX + pillW, pillY, r);
  ctx.closePath();
  ctx.fillStyle = 'rgba(12,22,32,0.55)';
  ctx.fill();
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = state.typing ? 'rgba(255,210,140,0.9)' : 'rgba(255,255,255,0.4)';
  ctx.stroke();

  ctx.textAlign = 'center';
  if (state.password.length > 0) {
    ctx.font = '500 22px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.fillText('•'.repeat(Math.min(state.password.length, 18)), cx, cy + 6);
  } else {
    ctx.font = '400 19px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillText('ПИН-код', cx, cy + 5);
  }

  // Стрелка «войти»
  ctx.beginPath();
  ctx.arc(pillX + pillW + 26, pillY + pillH / 2, 16, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fill();
  ctx.strokeStyle = '#12304a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(pillX + pillW + 19, pillY + pillH / 2);
  ctx.lineTo(pillX + pillW + 33, pillY + pillH / 2);
  ctx.moveTo(pillX + pillW + 28, pillY + pillH / 2 - 5);
  ctx.lineTo(pillX + pillW + 33, pillY + pillH / 2);
  ctx.lineTo(pillX + pillW + 28, pillY + pillH / 2 + 5);
  ctx.stroke();

  // Индикаторы в правом нижнем углу
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.arc(SW - 78, SH - 42, 5, 0, Math.PI * 2);
  ctx.moveTo(SW - 66, SH - 42);
  ctx.arc(SW - 70, SH - 42, 4.5, -Math.PI / 3.2, Math.PI / 3.2);
  ctx.moveTo(SW - 59, SH - 42);
  ctx.arc(SW - 62, SH - 42, 4, -Math.PI / 3.4, Math.PI / 3.4);
  ctx.stroke();
  ctx.strokeRect(SW - 38, SH - 50, 24, 13);
  ctx.fillRect(SW - 36, SH - 48, 16, 9);
  ctx.fillRect(SW - 13, SH - 46, 3, 5);
}

function makeKeyboardTexture() {
  return makeTexture(512, 340, (ctx, w, h) => {
    ctx.fillStyle = '#1d2025';
    ctx.fillRect(0, 0, w, h);
    const kw = 42;
    const kh = 22;
    for (let row = 0; row < 5; row++) {
      const y = 14 + row * (kh + 7);
      let x = 16;
      const rows = [
        [14, 1.6, 1], [13, 1.3, 1], [12, 1.2, 1], [11, 1.35, 1], [10, 1, 3],
      ][row];
      const [count, stretch, wide] = rows;
      for (let i = 0; i < count; i++) {
        const width = kw * (i === count - 1 ? wide * 1.9 : stretch);
        ctx.fillStyle = '#2c3038';
        ctx.beginPath();
        ctx.roundRect(x, y, width, kh, 4);
        ctx.fill();
        x += width + 6;
      }
    }
    // тачпад
    ctx.fillStyle = '#33383f';
    ctx.beginPath();
    ctx.roundRect(w / 2 - 70, h - 74, 140, 58, 8);
    ctx.fill();
  });
}

export function createLaptop(mats) {
  const g = new THREE.Group();
  g.userData.focusId = 'laptop';

  const screenCanvas = document.createElement('canvas');
  screenCanvas.width = SW;
  screenCanvas.height = SH;
  const sctx = screenCanvas.getContext('2d');
  const screenTex = new THREE.CanvasTexture(screenCanvas);
  screenTex.colorSpace = THREE.SRGBColorSpace;
  screenTex.anisotropy = 8;

  const state = {
    mode: 'lock', // lock | welcome
    password: '',
    typing: false,
    fixedTime: null,
    lastMinute: -1,
    welcomeUntil: 0,
  };
  let needsRedraw = true;

  const screenMat = new THREE.MeshBasicMaterial({ map: screenTex });
  const emissiveScreen = new THREE.MeshStandardMaterial({
    map: screenTex,
    emissiveMap: screenTex,
    emissive: 0xffffff,
    emissiveIntensity: 0.65,
    roughness: 0.35,
  });

  // ---- корпус
  const W = 0.36;
  const D = 0.25;
  const base = new THREE.Mesh(new THREE.BoxGeometry(W, 0.014, D), mats.dark);
  base.position.y = 0.007;
  base.castShadow = base.receiveShadow = true;
  g.add(base);

  const kb = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.024, D - 0.05), new THREE.MeshStandardMaterial({ map: makeKeyboardTexture(), roughness: 0.6 }));
  kb.rotation.x = -Math.PI / 2;
  kb.position.set(0, 0.0145, -0.008);
  g.add(kb);

  // крышка с экраном
  const lid = new THREE.Group();
  lid.position.set(0, 0.012, -D / 2 + 0.006);
  const lidBack = new THREE.Mesh(new THREE.BoxGeometry(W, 0.235, 0.009), mats.dark);
  lidBack.position.y = 0.235 / 2;
  lidBack.castShadow = true;
  lid.add(lidBack);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.03, 0.212), emissiveScreen);
  screen.position.set(0, 0.235 / 2, 0.0052);
  lid.add(screen);
  lid.rotation.x = -1.92; // открыт сильнее прямого угла
  g.add(lid);
  g.userData.screenMesh = screen;

  // мягкое свечение экрана
  const glow = new THREE.PointLight(0xbfd8ff, 0.5, 0.9, 2);
  glow.position.set(0, 0.14, 0.16);
  g.add(glow);

  function redraw(t) {
    drawLockScreen(sctx, state, t);
    screenTex.needsUpdate = true;
    needsRedraw = false;
  }

  const api = {
    group: g,
    setPassword(text) {
      state.password = String(text).slice(0, 24);
      state.typing = state.password.length > 0;
      needsRedraw = true;
    },
    submit() {
      if (state.mode !== 'lock') return;
      state.mode = 'welcome';
      state.welcomeUntil = performance.now() + 1500;
      needsRedraw = true;
      setTimeout(() => {
        state.mode = 'lock';
        state.password = '';
        state.typing = false;
        api.onCleared?.();
        needsRedraw = true;
      }, 1500);
    },
    update(t) {
      const now = new Date();
      const minute = now.getHours() * 60 + now.getMinutes();
      if (minute !== state.lastMinute) {
        state.lastMinute = minute;
        needsRedraw = true;
      }
      if (state.mode === 'welcome') needsRedraw = true; // анимация спиннера
      if (needsRedraw) redraw(t);
    },
    screenMesh: screen,
  };

  // позиция на столе
  g.position.set(LAYOUT.laptop.x, LAYOUT.desk.topY, LAYOUT.laptop.z);
  g.rotation.y = LAYOUT.laptop.yaw;

  return api;
}
