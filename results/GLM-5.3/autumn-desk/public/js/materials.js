// Процедурные материалы и текстуры (canvas 2D). Никаких внешних ресурсов.

import * as THREE from '../vendor/three.module.js';

export function makeTexture(w, h, draw, { srgb = true } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function noise(ctx, w, h, alpha, n = 900) {
  for (let i = 0; i < n; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    ctx.fillStyle = Math.random() > 0.5
      ? `rgba(255,255,255,${alpha * Math.random()})`
      : `rgba(0,0,0,${alpha * Math.random()})`;
    ctx.fillRect(x, y, 1.5, 1.5);
  }
}

// ---------- дерево (дуб)

function oakBase(ctx, w, h, base, dark, light) {
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 120; i++) {
    const x = Math.random() * w;
    const wob = 2 + Math.random() * 6;
    const seg = 6 + Math.floor(Math.random() * 8);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    for (let s = 1; s <= seg; s++) {
      const y = (h / seg) * s;
      ctx.lineTo(x + Math.sin(s * 1.7 + i) * wob, y);
    }
    ctx.strokeStyle = Math.random() > 0.42 ? dark : light;
    ctx.globalAlpha = 0.05 + Math.random() * 0.09;
    ctx.lineWidth = 0.8 + Math.random() * 2.2;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // сучки
  for (let k = 0; k < 4; k++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    for (let r = 10; r > 0; r -= 2.2) {
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * 1.8, 0, 0, Math.PI * 2);
      ctx.strokeStyle = dark;
      ctx.globalAlpha = 0.05 + (10 - r) * 0.012;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
  noise(ctx, w, h, 0.05);
}

export function makeOakTexture(w = 512, h = 512) {
  return makeTexture(w, h, (ctx, w, h) => {
    oakBase(ctx, w, h, '#b98a56', 'rgba(84,54,26,0.9)', 'rgba(230,190,130,0.9)');
  });
}

export function makeOakDarkTexture(w = 512, h = 512) {
  return makeTexture(w, h, (ctx, w, h) => {
    oakBase(ctx, w, h, '#8a5f34', 'rgba(52,32,14,0.95)', 'rgba(180,132,80,0.9)');
  });
}

export function makeFloorTexture(w = 512, h = 512) {
  const tex = makeTexture(w, h, (ctx, w, h) => {
    const plank = 64;
    for (let row = 0; row * plank < h; row++) {
      const shade = 0.86 + ((row * 37) % 5) * 0.06;
      ctx.fillStyle = `rgb(${166 * shade | 0},${126 * shade | 0},${80 * shade | 0})`;
      ctx.fillRect(0, row * plank, w, plank);
      for (let i = 0; i < 26; i++) {
        const y = row * plank + Math.random() * plank;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(w * 0.3, y + 3, w * 0.6, y - 3, w, y + 2);
        ctx.strokeStyle = 'rgba(70,45,22,0.25)';
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(40,25,12,0.55)';
      ctx.fillRect(0, row * plank, w, 2);
      const gap = ((row * 173) % w + w / 2) % w;
      ctx.fillRect(gap, row * plank, 2, plank);
    }
    noise(ctx, w, h, 0.04);
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2.6, 2.1);
  return tex;
}

export function makeWallTexture(w = 256, h = 256) {
  const tex = makeTexture(w, h, (ctx, w, h) => {
    ctx.fillStyle = '#e7d9c3';
    ctx.fillRect(0, 0, w, h);
    noise(ctx, w, h, 0.035, 1400);
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 2);
  return tex;
}

// ---------- ткани и листья

export function makeCurtainTexture(w = 256, h = 512) {
  const tex = makeTexture(w, h, (ctx, w, h) => {
    for (let x = 0; x < w; x += 18) {
      ctx.fillStyle = (x / 18) % 2 ? '#c96f4a' : '#d98a63';
      ctx.fillRect(x, 0, 18, h);
      ctx.fillStyle = 'rgba(90,40,20,0.18)';
      ctx.fillRect(x, 0, 3, h);
    }
    // мягкие вертикальные складки
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, 'rgba(60,20,8,0.22)');
    grad.addColorStop(0.5, 'rgba(255,220,190,0.10)');
    grad.addColorStop(1, 'rgba(60,20,8,0.22)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    noise(ctx, w, h, 0.05, 700);
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

let leafTextureCache = null;
export function getLeafTexture() {
  if (leafTextureCache) return leafTextureCache;
  leafTextureCache = makeTexture(128, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    // черенок
    ctx.strokeStyle = '#7a4a20';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(w / 2, h - 6);
    ctx.quadraticCurveTo(w / 2 - 4, h - 30, w / 2, h - 44);
    ctx.stroke();
    // пластина
    ctx.beginPath();
    ctx.moveTo(w / 2, h - 44);
    ctx.bezierCurveTo(w * 0.1, h - 60, w * 0.12, 26, w / 2, 12);
    ctx.bezierCurveTo(w * 0.88, 26, w * 0.9, h - 60, w / 2, h - 44);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#e8933a');
    g.addColorStop(0.55, '#d4622a');
    g.addColorStop(1, '#a5401f');
    ctx.fillStyle = g;
    ctx.fill();
    // жилки
    ctx.strokeStyle = 'rgba(120,50,18,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(w / 2, h - 44);
    ctx.lineTo(w / 2, 16);
    ctx.stroke();
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 5; i++) {
      const y = h - 52 - i * 14;
      ctx.beginPath();
      ctx.moveTo(w / 2, y);
      ctx.lineTo(w / 2 - 26 + i * 2, y - 16);
      ctx.moveTo(w / 2, y);
      ctx.lineTo(w / 2 + 26 - i * 2, y - 16);
      ctx.stroke();
    }
  });
  return leafTextureCache;
}

export function makeLeafMaterials() {
  const colors = [0xe8b23a, 0xe07b28, 0xc14b2a, 0x9a5a2e, 0xb98f2e];
  return colors.map((c) => new THREE.MeshStandardMaterial({
    map: getLeafTexture(),
    color: c,
    transparent: true,
    alphaTest: 0.45,
    side: THREE.DoubleSide,
    roughness: 0.9,
    metalness: 0,
  }));
}

// ---------- вид из окна

export function makeSkyTexture(w = 1024, h = 640) {
  return makeTexture(w, h, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#ffe9c4');
    g.addColorStop(0.55, '#ffcf8e');
    g.addColorStop(1, '#ffb469');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // солнце с мягким ореолом
    const sx = w * 0.3;
    const sy = h * 0.3;
    for (let r = 190; r > 6; r -= 7) {
      const a = 0.028 * (1 - r / 200);
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,246,220,${a + 0.015})`;
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(sx, sy, 26, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,252,238,0.95)';
    ctx.fill();
    // лёгкие облака
    ctx.fillStyle = 'rgba(255,255,255,0.20)';
    for (let i = 0; i < 9; i++) {
      const cx = (i * 137) % w;
      const cy = 40 + ((i * 83) % 140);
      ctx.beginPath();
      ctx.ellipse(cx, cy, 60 + (i % 3) * 30, 9 + (i % 4) * 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

export function makeHillsTexture(w = 1024, h = 256) {
  return makeTexture(w, h, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    // дальняя гряда
    ctx.fillStyle = 'rgba(150,86,44,0.85)';
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(0, h * 0.62);
    for (let x = 0; x <= w; x += 24) {
      ctx.lineTo(x, h * 0.62 + Math.sin(x * 0.012) * 18 + Math.sin(x * 0.05) * 6);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
    // деревья кронами
    for (let i = 0; i < 46; i++) {
      const x = (i * 223) % w;
      const y = h * 0.66 + Math.sin(x * 0.012) * 18;
      const r = 10 + (i % 5) * 4;
      ctx.fillStyle = ['#c96a2c', '#b5541f', '#d98a3a', '#a04620'][i % 4];
      ctx.beginPath();
      ctx.arc(x, y - r * 0.6, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(80,44,18,0.8)';
      ctx.fillRect(x - 1.5, y - r * 0.6, 3, r);
    }
  });
}

export function makeBranchTexture(w = 512, h = 512) {
  return makeTexture(w, h, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = '#6d4a28';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.28);
    ctx.bezierCurveTo(w * 0.3, h * 0.3, w * 0.55, h * 0.42, w * 0.9, h * 0.5);
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(w * 0.35, h * 0.33);
    ctx.quadraticCurveTo(w * 0.5, h * 0.2, w * 0.68, h * 0.16);
    ctx.stroke();
    // гроздья листьев
    const cols = ['#e8b23a', '#e07b28', '#c14b2a', '#b98f2e', '#d4622a'];
    for (let i = 0; i < 42; i++) {
      const t = i / 42;
      const x = w * (0.08 + t * 0.82) + Math.sin(i * 7) * 26;
      const y = h * (0.3 + t * 0.18) + Math.cos(i * 5) * 34 - 8;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(i * 1.7);
      ctx.fillStyle = cols[i % cols.length];
      ctx.beginPath();
      ctx.ellipse(0, 0, 13, 6.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  });
}

// ---------- мелочи

export function makeSoftCircleTexture(w = 64, h = 64) {
  return makeTexture(w, h, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 1, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,246,230,1)');
    g.addColorStop(0.5, 'rgba(255,246,230,0.35)');
    g.addColorStop(1, 'rgba(255,246,230,0)');
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

export function makeLightShaftTexture(w = 64, h = 256) {
  return makeTexture(w, h, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(255,214,150,0.5)');
    g.addColorStop(1, 'rgba(255,214,150,0)');
    const gx = ctx.createLinearGradient(0, 0, w, 0);
    gx.addColorStop(0, 'rgba(0,0,0,1)');
    gx.addColorStop(0.5, 'rgba(0,0,0,0)');
    gx.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = gx;
    ctx.fillRect(0, 0, w, h);
  });
}

// ---------- общие материалы

export function commonMaterials() {
  const oak = makeOakTexture();
  const oakDark = makeOakDarkTexture();
  return {
    oak: new THREE.MeshStandardMaterial({ map: oak, roughness: 0.62, metalness: 0.02 }),
    oakDark: new THREE.MeshStandardMaterial({ map: oakDark, roughness: 0.66, metalness: 0.02 }),
    oakPainted: new THREE.MeshStandardMaterial({ color: '#efe6d4', roughness: 0.7 }),
    floor: new THREE.MeshStandardMaterial({ map: makeFloorTexture(), roughness: 0.8 }),
    wall: new THREE.MeshStandardMaterial({ map: makeWallTexture(), roughness: 0.95 }),
    metal: new THREE.MeshStandardMaterial({ color: '#8f8f96', roughness: 0.35, metalness: 0.85 }),
    brass: new THREE.MeshStandardMaterial({ color: '#c9a35a', roughness: 0.4, metalness: 0.8 }),
    dark: new THREE.MeshStandardMaterial({ color: '#2b2e33', roughness: 0.5, metalness: 0.35 }),
    glass: new THREE.MeshPhysicalMaterial({
      color: '#cfe4ea', roughness: 0.05, metalness: 0, transparent: true,
      opacity: 0.16, side: THREE.DoubleSide,
    }),
  };
}
