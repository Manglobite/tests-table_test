// Состояния интеракций: фокус на объектах и возврат к общему ракурсу.
// Чистая логика (без DOM): события ввода подаёт точка входа main.js,
// побочные эффекты — через хуки registry (например, экран ноутбука).

import { FOCUSABLE } from './config.js';

export class FocusManager {
  constructor(rig, presets, { onStateChange } = {}) {
    this.rig = rig;
    this.presets = presets;
    this.current = null; // null = home
    this.registry = new Map();
    this.onStateChange = onStateChange ?? (() => {});
    for (const id of FOCUSABLE) this.register(id, {});
  }

  // Регистрация хуков объекта: { onEnter, onLeave } — расширяемо.
  register(id, hooks = {}) {
    this.registry.set(id, {
      onEnter: hooks.onEnter ?? (() => {}),
      onLeave: hooks.onLeave ?? (() => {}),
    });
  }

  has(id) {
    return this.registry.has(id);
  }

  // Тап по объекту: новый фокус или возврат home при повторном выборе.
  select(id) {
    if (!this.has(id)) return false;
    if (this.current === id) {
      this.goHome();
      return true;
    }
    this._leave();
    this.current = id;
    this.rig.applyPreset(id);
    this.registry.get(id).onEnter();
    this.onStateChange(id, this.presets[id].label);
    return true;
  }

  goHome({ silent = false } = {}) {
    this._leave();
    const changed = this.current !== null;
    this.current = null;
    this.rig.applyPreset('home');
    if (changed || silent) this.onStateChange('home', this.presets.home.label);
  }

  // Клик по фону и клавиша Esc — возврат к общему ракурсу.
  handleBackground() {
    this.goHome();
  }

  handleEscape() {
    this.goHome();
  }

  _leave() {
    if (this.current) this.registry.get(this.current).onLeave();
  }
}
