// Windows 11 style lock screen rendered into a live canvas texture.
//
// The texture shows: a calm background, large clock, date, and a password
// input field.  `setTyped(n)` only ever receives the *length* of what was
// typed, so the actual characters never leave the input element and are never
// stored anywhere.  `tick()` refreshes the clock.

import { THREE } from "../core/three-import.js";
import { drawLockBackground, makeCanvas } from "./textures.js";

const WEEKDAYS_RU = [
  "воскресенье", "понедельник", "вторник", "среда",
  "четверг", "пятница", "суббота",
];
const MONTHS_RU_GEN = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

export function createLockScreen() {
  const W = 1024;
  const H = 640;
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext("2d");

  const state = {
    typed: 0,
    focused: false,
    date: new Date(),
  };

  function draw() {
    drawLockBackground(ctx, W, H);
    drawClock(ctx, W, H, state.date);
    drawPasswordField(ctx, W, H, state);
  }

  function drawClock(c, w, h, date) {
    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    const timeStr = `${hh}:${mm}`;

    c.textAlign = "center";
    c.textBaseline = "alphabetic";
    c.fillStyle = "rgba(255,255,255,0.96)";
    c.shadowColor = "rgba(0,0,0,0.45)";
    c.shadowBlur = 24;
    c.font = "300 210px 'Segoe UI', Arial, sans-serif";
    c.fillText(timeStr, w / 2, h * 0.34);

    const dateStr = `${WEEKDAYS_RU[date.getDay()]}, ${date.getDate()} ${MONTHS_RU_GEN[date.getMonth()]}`;
    c.font = "400 42px 'Segoe UI', Arial, sans-serif";
    c.fillStyle = "rgba(255,255,255,0.92)";
    c.fillText(dateStr, w / 2, h * 0.34 + 70);
    c.shadowBlur = 0;
  }

  function drawPasswordField(c, w, h, st) {
    const boxW = 420;
    const boxH = 62;
    const x = (w - boxW) / 2;
    const y = h * 0.78;

    c.save();
    c.globalAlpha = 0.92;
    c.fillStyle = "rgba(20,26,36,0.55)";
    roundRect(c, x, y, boxW, boxH, 10);
    c.fill();
    c.strokeStyle = st.focused ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.55)";
    c.lineWidth = 2;
    roundRect(c, x, y, boxW, boxH, 10);
    c.stroke();

    // Placeholder / typed dots.
    c.textAlign = "left";
    c.textBaseline = "middle";
    if (st.typed <= 0) {
      c.fillStyle = "rgba(255,255,255,0.78)";
      c.font = "400 30px 'Segoe UI', Arial, sans-serif";
      c.fillText("Пароль", x + 26, y + boxH / 2 + 1);
    } else {
      c.fillStyle = "rgba(255,255,255,0.95)";
      const dots = Math.min(st.typed, 18);
      for (let i = 0; i < dots; i++) {
        c.beginPath();
        c.arc(x + 30 + i * 22, y + boxH / 2, 6, 0, Math.PI * 2);
        c.fill();
      }
    }

    // Submit arrow.
    c.beginPath();
    c.arc(x + boxW - 34, y + boxH / 2, 20, 0, Math.PI * 2);
    c.fillStyle = st.typed > 0 ? "rgba(120,180,255,0.95)" : "rgba(255,255,255,0.28)";
    c.fill();
    c.fillStyle = "#0b1220";
    c.font = "bold 24px Arial, sans-serif";
    c.textAlign = "center";
    c.fillText("→", x + boxW - 32, y + boxH / 2 + 1);
    c.restore();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;

  function redraw() {
    draw();
    texture.needsUpdate = true;
  }

  redraw();

  return {
    texture,
    canvas,
    setTyped(count) {
      state.typed = Math.max(0, count | 0);
      redraw();
    },
    setFocused(focused) {
      state.focused = !!focused;
      redraw();
    },
    tick(date = new Date()) {
      const changed =
        date.getMinutes() !== state.date.getMinutes() ||
        date.getDate() !== state.date.getDate();
      state.date = date;
      if (changed) redraw();
    },
    dispose() {
      texture.dispose();
    },
  };
}

function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}
