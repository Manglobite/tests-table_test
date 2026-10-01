import * as THREE from '../tree_js/package/build/three.module.js';

export function texture(width, height, paint) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  paint(canvas.getContext('2d'), width, height);
  const result = new THREE.CanvasTexture(canvas);
  result.colorSpace = THREE.SRGBColorSpace;
  result.anisotropy = 4;
  return result;
}

export function woodTexture() {
  return texture(1024, 512, (ctx, w, h) => {
    ctx.fillStyle = '#a9733d';
    ctx.fillRect(0, 0, w, h);
    let seed = 71;
    const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 850; i++) {
      const y = random() * h;
      ctx.strokeStyle = `rgba(${random() > 0.5 ? '65,32,12' : '245,201,133'},${random() * 0.22})`;
      ctx.lineWidth = random() * 2 + 0.3;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= w; x += 16) ctx.lineTo(x, y + Math.sin(x / 95 + y) * 2.5 + Math.sin(x / 230) * 5);
      ctx.stroke();
    }
    for (let i = 1; i < 5; i++) {
      ctx.fillStyle = '#53371e66';
      ctx.fillRect(0, h * i / 5, w, 2);
    }
  });
}

export function screenTexture() {
  return texture(1280, 800, (ctx, w, h) => {
    const sky = ctx.createLinearGradient(0, 0, w, h);
    sky.addColorStop(0, '#163f61');
    sky.addColorStop(0.55, '#639dbe');
    sky.addColorStop(1, '#e8b5a1');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 9; i++) {
      ctx.beginPath();
      ctx.moveTo(-100, 660 + i * 26);
      ctx.bezierCurveTo(350, 80 + i * 25, 690, 980 - i * 39, 1400, 220 + i * 30);
      ctx.strokeStyle = `rgba(215,235,255,${0.08 + i * 0.012})`;
      ctx.lineWidth = 32;
      ctx.stroke();
    }
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = '300 128px sans-serif';
    ctx.fillText('09:41', w / 2, 250);
    ctx.font = '28px sans-serif';
    ctx.fillText('Понедельник, 21 сентября', w / 2, 305);
    ctx.fillStyle = '#ffffff27';
    ctx.beginPath();
    ctx.arc(640, 440, 48, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#eef4f8';
    ctx.beginPath();
    ctx.arc(640, 428, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(640, 462, 25, 16, 0, Math.PI, 0);
    ctx.fill();
    ctx.font = '27px sans-serif';
    ctx.fillText('Тихий сентябрь', 640, 529);
    ctx.fillStyle = '#18384caa';
    ctx.fillRect(445, 560, 390, 58);
    ctx.fillStyle = '#f1f5f8';
    ctx.textAlign = 'left';
    ctx.font = '23px sans-serif';
    ctx.fillText('Пароль', 467, 599);
    ctx.fillText('→', 794, 599);
    ctx.fillStyle = '#ffffffaa';
    ctx.textAlign = 'center';
    ctx.font = '18px sans-serif';
    ctx.fillText('Демонстрация · ввод отключён', 640, 658);
  });
}

export function notebookTexture() {
  return texture(1024, 720, (ctx, w, h) => {
    ctx.fillStyle = '#fff8e3';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ba6b42';
    ctx.font = '20px sans-serif';
    ctx.fillText('21 / 09 / 2026', 65, 65);
    ctx.font = 'italic 43px Georgia';
    ctx.fillStyle = '#484e42';
    ctx.fillText('Тихий сентябрь', 65, 125);
    ctx.strokeStyle = '#aeb4a64d';
    for (let y = 175; y < h - 40; y += 43) {
      for (const x of [50, 555]) {
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 420, y); ctx.stroke();
      }
    }
    ctx.fillStyle = '#52615b';
    ctx.font = 'italic 25px Georgia';
    ['Открыть окно.', 'Впустить немного солнца.', '', 'Кофе, мысли и чистый лист.', 'Сегодня можно не спешить.'].forEach((line, i) => ctx.fillText(line, 65, 205 + i * 43));
    ctx.font = '20px sans-serif';
    ctx.fillStyle = '#b07343';
    ctx.fillText('МАЛЕНЬКИЕ ПЛАНЫ', 574, 125);
    ctx.fillStyle = '#52615b';
    ['Прогуляться в парке', 'Дочитать главу', 'Сохранить этот свет'].forEach((line, i) => {
      ctx.strokeRect(575, 190 + i * 43, 16, 16);
      ctx.fillText(line, 604, 205 + i * 43);
    });
    ctx.strokeStyle = '#b48049';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(730, 630); ctx.quadraticCurveTo(860, 510, 770, 370); ctx.stroke();
    for (let i = 0; i < 7; i++) {
      ctx.fillStyle = i % 2 ? '#bd753b' : '#d2a54b';
      ctx.beginPath(); ctx.ellipse(785 + Math.sin(i) * 33, 430 + i * 24, 36, 12, i % 2 ? -0.7 : 0.7, 0, Math.PI * 2); ctx.fill();
    }
    const fold = ctx.createLinearGradient(490, 0, 535, 0);
    fold.addColorStop(0, '#ac987600'); fold.addColorStop(0.5, '#79694d60'); fold.addColorStop(1, '#ac987600');
    ctx.fillStyle = fold; ctx.fillRect(490, 0, 45, h);
  });
}

export function calendarTexture() {
  return texture(512, 600, (ctx, w, h) => {
    ctx.fillStyle = '#fff9e9'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#8d4935'; ctx.fillRect(0, 0, w, 110);
    ctx.textAlign = 'center'; ctx.fillStyle = '#fff3d9'; ctx.font = '27px sans-serif'; ctx.fillText('С Е Н Т Я Б Р Ь', 256, 70);
    ctx.fillStyle = '#3e493b'; ctx.font = '180px Georgia'; ctx.fillText('21', 256, 320);
    ctx.font = '25px sans-serif'; ctx.fillText('ПОНЕДЕЛЬНИК', 256, 383);
    ctx.fillStyle = '#a08b6f'; ctx.font = '20px sans-serif'; ctx.fillText('2026', 256, 435);
    ctx.font = 'italic 23px Georgia'; ctx.fillText('Время для простых вещей', 256, 526);
  });
}
