// UI-слой: сообщение об отсутствии WebGL, подпись ракурса, демонстрационное
// поле пароля, проецируемое на экран ноутбука. Ввод живёт только в памяти.

import * as THREE from '../vendor/three.module.js';

const $ = (id) => document.getElementById(id);

export function showFatal(text) {
  const box = $('fatal');
  $('fatal-text').textContent = text;
  box.hidden = false;
}

export class ViewCaption {
  constructor() {
    this.el = $('view-caption');
    this.timer = 0;
    this.el.hidden = false;
  }
  set(text) {
    this.el.textContent = text;
    this.el.classList.add('visible');
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.el.classList.remove('visible'), 2600);
  }
  destroy() {
    clearTimeout(this.timer);
    this.el.hidden = true;
  }
}

// Поле пароля: DOM-элемент позиционируется над 3D-экраном ноутбука.
// Значение нигде не сохраняется и не логируется.
export class LaptopPasswordInput {
  constructor({ onSubmit } = {}) {
    this.box = $('laptop-overlay');
    this.input = $('laptop-password');
    this.onSubmit = onSubmit ?? (() => {});
    this.active = false;
    this._onChange = () => { /* содержимое читает ноутбук через getPassword() */ };
    this._onKeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.onSubmit();
      }
      if (e.key !== 'Escape') e.stopPropagation();
    };
  }

  attach() {
    this.input.addEventListener('input', this._onChange);
    this.input.addEventListener('keydown', this._onKeydown);
  }

  detach() {
    this.input.removeEventListener('input', this._onChange);
    this.input.removeEventListener('keydown', this._onKeydown);
    this.clear();
    this.hide();
  }

  show() {
    this.active = true;
    this.box.hidden = false;
    this.input.value = '';
    // фокус после кадра, чтобы мобильная клавиатура не мигала
    setTimeout(() => this.input.focus({ preventScroll: true }), 60);
  }

  hide() {
    this.active = false;
    this.box.hidden = true;
    this.input.blur();
  }

  clear() {
    this.input.value = '';
  }

  get value() {
    return this.input.value;
  }

  // Позиционирование поверх экрана ноутбука (в CSS-пикселях).
  place({ left, top, width, height }) {
    if (!this.active) return;
    this.box.style.left = `${left}px`;
    this.box.style.top = `${top}px`;
    this.box.style.width = `${width}px`;
    this.box.style.height = `${height}px`;
  }
}

// Проекция мирового прямоугольника экрана в экранные пиксели.
export function projectQuad(mesh, camera, canvasRect) {
  const v = new THREE.Vector3();
  mesh.getWorldPosition(v);
  const center = v.clone().project(camera);
  const halfW = mesh.geometry.parameters.width / 2;
  const halfH = mesh.geometry.parameters.height / 2;
  const p = (x, y) => {
    mesh.localToWorld(v.set(x, y, 0.01));
    v.project(camera);
    return {
      x: canvasRect.left + ((v.x + 1) / 2) * canvasRect.width,
      y: canvasRect.top + ((1 - v.y) / 2) * canvasRect.height,
    };
  };
  const a = p(-halfW, -halfH * 0.28);
  const b = p(halfW, -halfH * 0.28);
  const c = p(halfW, halfH * 0.12);
  const d = p(-halfW, halfH * 0.12);
  const left = Math.min(a.x, d.x);
  const right = Math.max(b.x, c.x);
  const top = Math.min(a.y, b.y);
  const bottom = Math.max(c.y, d.y);
  return { left, top, width: right - left, height: bottom - top, center };
}
