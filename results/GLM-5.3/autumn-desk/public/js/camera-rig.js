// Камера-риг: плавные переходы home <-> фокус на объекте, перенацеливание
// без телепортации (экспоненциальное сглаживание), адаптация кадра под аспект.
// Модуль не зависит от DOM — только от THREE.

import * as THREE from '../vendor/three.module.js';
import { FOCUS_PRESETS } from './config.js';

const SMOOTH = 4.0; // скорость сглаживания, 1/с

function v3(arr) {
  return new THREE.Vector3(arr[0], arr[1], arr[2]);
}

export class CameraRig {
  constructor(camera, presets = FOCUS_PRESETS) {
    this.camera = camera;
    this.presets = presets;
    this.presetId = 'home';
    this.aspect = 16 / 9;
    this._goal = { pos: new THREE.Vector3(), target: new THREE.Vector3(), fov: 45 };
    this._current = { pos: new THREE.Vector3(), target: new THREE.Vector3(), fov: 45 };
    this.applyPreset('home', { immediate: true });
  }

  // Подбор дистанции и вертикального FOV, чтобы frameWidth умещался
  // по горизонтали: вначале — авторская дистанция, на узких экранах —
  // умеренный отъезд с расширением FOV (без экстремальных дистанций).
  computeFraming(preset) {
    const d0 = v3(preset.offset).length();
    const vHalf0 = THREE.MathUtils.degToRad(preset.fov) / 2;
    const hHalf0 = Math.atan(Math.tan(vHalf0) * this.aspect);
    const dFit = hHalf0 > 0.001 ? (preset.frameWidth / 2) / Math.tan(hHalf0) : d0;
    const d = THREE.MathUtils.clamp(dFit, d0 * 0.7, d0 * 1.9);
    const hHalf = Math.atan((preset.frameWidth / 2) / d);
    const vHalf = Math.atan(Math.tan(hHalf) / Math.max(this.aspect, 0.1));
    const fov = THREE.MathUtils.clamp(
      THREE.MathUtils.radToDeg(vHalf * 2),
      22, 84
    );
    return { distance: d, fov };
  }

  _computeGoal(presetId) {
    const preset = this.presets[presetId];
    const target = v3(preset.target);
    const dir = v3(preset.offset).normalize();
    const { distance, fov } = this.computeFraming(preset);
    const pos = target.clone().addScaledVector(dir, distance);
    return { pos, target, fov };
  }

  // Смена цели: мгновенно пересчитывает точку назначения (без скачка камеры).
  applyPreset(presetId, { immediate = false } = {}) {
    this.presetId = presetId;
    const g = this._computeGoal(presetId);
    this._goal.pos.copy(g.pos);
    this._goal.target.copy(g.target);
    this._goal.fov = g.fov;
    if (immediate) {
      this._current.pos.copy(g.pos);
      this._current.target.copy(g.target);
      this._current.fov = g.fov;
      this._syncCamera();
    }
  }

  // Пересчёт кадра при изменении размеров (камера остаётся на своей цели).
  setViewport(aspect) {
    this.aspect = aspect;
    this.applyPreset(this.presetId);
  }

  update(dt) {
    const k = 1 - Math.exp(-SMOOTH * Math.max(dt, 0));
    this._current.pos.lerp(this._goal.pos, k);
    this._current.target.lerp(this._goal.target, k);
    this._current.fov += (this._goal.fov - this._current.fov) * k;
    this._syncCamera();
  }

  _syncCamera() {
    this.camera.position.copy(this._current.pos);
    this.camera.fov = this._current.fov;
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(this._current.target);
  }

  get settled() {
    return this._current.pos.distanceTo(this._goal.pos) < 0.01
      && Math.abs(this._current.fov - this._goal.fov) < 0.05;
  }

  goalDistance() {
    return this._current.pos.distanceTo(this._goal.pos);
  }
}
