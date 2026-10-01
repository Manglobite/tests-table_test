// Procedural canvas textures.
//
// The scene must be fully offline, so every texture is painted at runtime
// with the 2D canvas API instead of loading image files from anywhere.  A
// tiny seeded PRNG keeps the result deterministic between reloads.

import { THREE } from "../core/three-import.js";

export function makeCanvas(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export function finishTexture(canvas, { repeat = null, aniso = 4 } = {}) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = aniso;
  if (repeat) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeat[0], repeat[1]);
  }
  texture.needsUpdate = true;
  return texture;
}

// Deterministic PRNG (mulberry32) so textures look the same every run.
export function rng(seed = 1) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rgb(r, g, b) {
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

// ---------------------------------------------------------------------------
// Oak desk top
// ---------------------------------------------------------------------------

export function woodTexture() {
  const size = 1024;
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext("2d");
  const random = rng(20241001);

  const base = ctx.createLinearGradient(0, 0, size, size);
  base.addColorStop(0, "#8a5a2b");
  base.addColorStop(0.5, "#7a4f28");
  base.addColorStop(1, "#6b4220");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  // Long grain streaks, slightly wavy.
  ctx.globalAlpha = 0.22;
  for (let i = 0; i < 220; i++) {
    const y = random() * size;
    const amp = 2 + random() * 8;
    const shade = random();
    ctx.strokeStyle =
      shade > 0.5
        ? rgb(150, 104, 58)
        : rgb(74, 45, 22);
    ctx.lineWidth = 0.6 + random() * 2.4;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= size; x += 24) {
      ctx.lineTo(x, y + Math.sin((x / size) * Math.PI * 4 + i) * amp);
    }
    ctx.stroke();
  }

  // Knots.
  ctx.globalAlpha = 0.35;
  for (let k = 0; k < 5; k++) {
    const cx = random() * size;
    const cy = random() * size;
    const r = 8 + random() * 16;
    for (let ring = 0; ring < 6; ring++) {
      ctx.strokeStyle = rgb(70, 42, 20);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, r + ring * 4, (r + ring * 4) * 0.55, random(), 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;

  // Carved decorative border bands near the edge.
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = "#4a2c13";
  ctx.lineWidth = 8;
  ctx.strokeRect(26, 26, size - 52, size - 52);
  ctx.strokeStyle = "#a5743f";
  ctx.lineWidth = 3;
  ctx.strokeRect(40, 40, size - 80, size - 80);
  ctx.globalAlpha = 1;

  return finishTexture(canvas, { repeat: [2.4, 1.1] });
}

// Carved rosette panel used on the desk apron / legs.
export function carvedPanelTexture() {
  const w = 512;
  const h = 256;
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#6b4220";
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = "#a5743f";
  ctx.lineWidth = 4;
  ctx.strokeRect(18, 18, w - 36, h - 36);
  ctx.strokeStyle = "#4a2c13";
  ctx.lineWidth = 2;
  ctx.strokeRect(30, 30, w - 60, h - 60);

  // Central diamond + acanthus-like curls.
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.strokeStyle = "#b8863f";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(0, -60);
  ctx.lineTo(70, 0);
  ctx.lineTo(0, 60);
  ctx.lineTo(-70, 0);
  ctx.closePath();
  ctx.stroke();
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(dir * 90, 0);
    ctx.bezierCurveTo(dir * 150, -40, dir * 180, 40, dir * 220, 0);
    ctx.stroke();
  }
  ctx.restore();

  return finishTexture(canvas);
}

// ---------------------------------------------------------------------------
// Notebook paper
// ---------------------------------------------------------------------------

export function notebookPageTexture(writing = true) {
  const w = 1024;
  const h = 1024;
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext("2d");

  const paper = ctx.createLinearGradient(0, 0, 0, h);
  paper.addColorStop(0, "#fbf6ea");
  paper.addColorStop(1, "#efe6d2");
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, w, h);

  // Ruled lines.
  ctx.strokeStyle = "rgba(120,150,185,0.55)";
  ctx.lineWidth = 2;
  for (let y = 120; y < h - 60; y += 46) {
    ctx.beginPath();
    ctx.moveTo(90, y);
    ctx.lineTo(w - 60, y);
    ctx.stroke();
  }
  // Margin.
  ctx.strokeStyle = "rgba(200,90,80,0.7)";
  ctx.beginPath();
  ctx.moveTo(90, 70);
  ctx.lineTo(90, h - 50);
  ctx.stroke();

  // Handwriting-like strokes.
  if (writing) {
    const random = rng(77);
    ctx.strokeStyle = "rgba(40,55,90,0.78)";
    ctx.lineWidth = 2.4;
    let y = 138;
    for (let line = 0; line < 13; line++) {
      let x = 110;
      const end = w - 90 - random() * 260;
      while (x < end) {
        const len = 6 + random() * 22;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.bezierCurveTo(
          x + len * 0.3,
          y - 12 - random() * 10,
          x + len * 0.7,
          y + 8,
          x + len,
          y - 2,
        );
        ctx.stroke();
        x += len + 4 + random() * 6;
      }
      y += 46;
    }
  }

  return finishTexture(canvas, { aniso: 8 });
}

// ---------------------------------------------------------------------------
// Desk calendar
// ---------------------------------------------------------------------------

const MONTHS_RU = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];
const WEEKDAYS_RU = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export function calendarPageTexture(date = new Date()) {
  const w = 1024;
  const h = 768;
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fbf7ee";
  ctx.fillRect(0, 0, w, h);

  // Header band.
  const day = date.getDate();
  const month = MONTHS_RU[date.getMonth()];
  const year = date.getFullYear();

  ctx.fillStyle = "#b2431f";
  ctx.fillRect(0, 0, w, 170);
  ctx.fillStyle = "#fff7ef";
  ctx.font = "bold 96px Georgia, 'Times New Roman', serif";
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText(`${day}`, 48, 88);

  ctx.font = "600 54px Georgia, 'Times New Roman', serif";
  ctx.textAlign = "right";
  ctx.fillText(month, w - 48, 66);
  ctx.font = "400 40px Georgia, 'Times New Roman', serif";
  ctx.fillText(String(year), w - 48, 124);

  // Weekday header.
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "600 30px Arial, sans-serif";
  ctx.fillStyle = "#7a6a52";
  const gridLeft = 60;
  const gridWidth = w - 120;
  const cellW = gridWidth / 7;
  for (let c = 0; c < 7; c++) {
    ctx.fillText(WEEKDAYS_RU[c], gridLeft + cellW * (c + 0.5), 220);
  }
  ctx.strokeStyle = "#e0d4bd";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(gridLeft, 244);
  ctx.lineTo(gridLeft + gridWidth, 244);
  ctx.stroke();

  // Month grid.
  const first = new Date(year, date.getMonth(), 1);
  let startCol = first.getDay() - 1;
  if (startCol < 0) startCol = 6;
  const daysInMonth = new Date(year, date.getMonth() + 1, 0).getDate();

  const rows = 6;
  const rowH = 78;
  ctx.font = "400 34px Arial, sans-serif";
  for (let d = 1; d <= daysInMonth; d++) {
    const idx = startCol + d - 1;
    const r = Math.floor(idx / 7);
    const c = idx % 7;
    if (r >= rows) break;
    const x = gridLeft + cellW * (c + 0.5);
    const y = 268 + r * rowH + 30;
    if (d === day) {
      ctx.fillStyle = "#b2431f";
      ctx.beginPath();
      ctx.arc(x, y - 4, 28, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff7ef";
    } else {
      ctx.fillStyle = (c === 5 || c === 6) ? "#b2431f" : "#3a332a";
    }
    ctx.fillText(String(d), x, y - 4);
  }

  // Ring holes along the top.
  ctx.fillStyle = "rgba(60,50,40,0.35)";
  for (const fx of [0.2, 0.5, 0.8]) {
    ctx.beginPath();
    ctx.arc(w * fx, 22, 12, 0, Math.PI * 2);
    ctx.fill();
  }

  return finishTexture(canvas, { aniso: 8 });
}

// ---------------------------------------------------------------------------
// Curtains
// ---------------------------------------------------------------------------

export function curtainTexture() {
  const w = 256;
  const h = 1024;
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext("2d");
  const grad = ctx.createLinearGradient(0, 0, w, 0);
  grad.addColorStop(0, "#d8b184");
  grad.addColorStop(0.5, "#efd6b2");
  grad.addColorStop(1, "#d8b184");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Vertical folds.
  for (let x = 0; x < w; x += 16) {
    const dark = ((x / 16) % 2) * 0.12;
    ctx.fillStyle = `rgba(150,110,70,${dark})`;
    ctx.fillRect(x, 0, 8, h);
  }
  // Warm leaf motif near the top.
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = "#b2431f";
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.ellipse(40 + i * 32, 90 + (i % 2) * 24, 10, 18, i, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  return finishTexture(canvas, { repeat: [1, 1.2] });
}

// ---------------------------------------------------------------------------
// Walls / floor / book covers
// ---------------------------------------------------------------------------

export function wallTexture() {
  const size = 512;
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#e8dcc6";
  ctx.fillRect(0, 0, size, size);
  const random = rng(9);
  for (let i = 0; i < 2400; i++) {
    ctx.fillStyle = `rgba(180,160,130,${random() * 0.08})`;
    ctx.fillRect(random() * size, random() * size, 2, 2);
  }
  return finishTexture(canvas, { repeat: [3, 2] });
}

export function floorTexture() {
  const size = 512;
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#9c6b3f";
  ctx.fillRect(0, 0, size, size);
  const random = rng(31);
  for (let i = 0; i < 80; i++) {
    ctx.fillStyle = `rgba(90,55,25,${0.05 + random() * 0.12})`;
    ctx.fillRect(0, random() * size, size, 1 + random() * 3);
  }
  ctx.strokeStyle = "rgba(70,42,20,0.4)";
  ctx.lineWidth = 3;
  for (let x = 0; x < size; x += 128) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, size);
    ctx.stroke();
  }
  return finishTexture(canvas, { repeat: [4, 4] });
}

export function bookCoverTexture(color, seed) {
  const w = 256;
  const h = 384;
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(255,240,210,0.65)";
  ctx.lineWidth = 4;
  ctx.strokeRect(20, 20, w - 40, h - 40);
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = "rgba(255,240,210,0.8)";
  ctx.font = "bold 40px Georgia, serif";
  ctx.textAlign = "center";
  ctx.fillText(["ОСЕНЬ", "ПИСЬМА", "ПОЭЗИЯ"][seed % 3], w / 2, h / 2);
  ctx.globalAlpha = 1;
  return finishTexture(canvas);
}

// ---------------------------------------------------------------------------
// Windows 11 style lock-screen background (calm abstract landscape)
// ---------------------------------------------------------------------------

// Paints the calm lock-screen backdrop onto a 2D context.  Used by the live
// lock-screen canvas in lockscreen.js.
export function drawLockBackground(ctx, w, h) {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#1b2f4b");
  sky.addColorStop(0.45, "#3a5f86");
  sky.addColorStop(0.68, "#c98a5a");
  sky.addColorStop(0.85, "#e8b97c");
  sky.addColorStop(1, "#7a5a44");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // Soft sun.
  const sun = ctx.createRadialGradient(w * 0.72, h * 0.6, 0, w * 0.72, h * 0.6, 220);
  sun.addColorStop(0, "rgba(255,235,190,0.95)");
  sun.addColorStop(0.4, "rgba(255,210,150,0.35)");
  sun.addColorStop(1, "rgba(255,210,150,0)");
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, w, h);

  // Distant hills.
  const drawHill = (y, amp, color, phase) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 16) {
      const yy = y + Math.sin(x / 200 + phase) * amp + Math.sin(x / 70) * amp * 0.3;
      ctx.lineTo(x, yy);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
  };
  drawHill(h * 0.72, 26, "rgba(60,55,70,0.85)", 0.4);
  drawHill(h * 0.8, 20, "rgba(40,38,48,0.95)", 1.3);
  drawHill(h * 0.88, 14, "rgba(25,24,30,1)", 2.1);

  // Reflection hints.
  ctx.globalAlpha = 0.15;
  ctx.fillStyle = "#ffe6b8";
  for (let i = 0; i < 40; i++) {
    ctx.fillRect(w * 0.6 + (i % 8) * 10, h * 0.86 + i * 2, 40, 2);
  }
  ctx.globalAlpha = 1;
}

// Subtle vignette used on plain glass/plastic.
export function noiseTexture(seed = 5) {
  const size = 256;
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext("2d");
  const random = rng(seed);
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 200 + random() * 55;
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return finishTexture(canvas, { repeat: [1, 1] });
}
