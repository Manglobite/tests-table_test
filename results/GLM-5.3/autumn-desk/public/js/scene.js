// Сборка сцены: комната с проёмом окна, свет, воздух (пылинки в луче),
// все предметы, список интерактивных объектов и их анимации.

import * as THREE from '../vendor/three.module.js';
import { LAYOUT, QUALITY } from './config.js';
import { commonMaterials, makeLightShaftTexture, makeSoftCircleTexture } from './materials.js';
import { createDesk } from './objects/desk.js';
import { createWindow } from './objects/window.js';
import { createCurtains } from './objects/curtains.js';
import { createBirds } from './objects/birds.js';
import { createLeaves } from './objects/leaves.js';
import { createLaptop } from './objects/laptop.js';
import { createNotebook } from './objects/notebook.js';
import { createCalendar } from './objects/calendar.js';
import { createDecor } from './objects/decor.js';

const ROOM = { w: 5, h: 3.1, d: 4.2 };

export function buildScene({ isTouch = false } = {}) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#241a12');
  scene.fog = new THREE.Fog('#3a2a1c', 7, 18);

  const mats = commonMaterials();
  const updaters = [];
  const pickTargets = [];

  // ---- Пол
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.w, ROOM.d), mats.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, 0);
  floor.receiveShadow = true;
  scene.add(floor);

  // ---- Стены с проёмом окна в задней стене
  const W = LAYOUT.window;
  const wallZ = W.wallZ;
  const winTop = W.cy + W.height / 2 + 0.06;
  const winBottom = W.cy - W.height / 2 - 0.06;
  const winL = W.cx - W.width / 2 - 0.06;
  const winR = W.cx + W.width / 2 + 0.06;
  const mkWall = (w, h, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.08), mats.wall);
    m.position.set(x, y, z);
    m.receiveShadow = true;
    scene.add(m);
  };
  // задняя стена: низ/верх/слева/справа от проёма
  mkWall(ROOM.w, winBottom, 0, winBottom / 2, wallZ - 0.04);
  mkWall(ROOM.w, ROOM.h - winTop, 0, winTop + (ROOM.h - winTop) / 2, wallZ - 0.04);
  mkWall(winL - (-ROOM.w / 2), W.height + 0.12, (-ROOM.w / 2 + winL) / 2, W.cy, wallZ - 0.04);
  mkWall(ROOM.w / 2 - winR, W.height + 0.12, (winR + ROOM.w / 2) / 2, W.cy, wallZ - 0.04);
  // боковые стены
  const sideL = new THREE.Mesh(new THREE.BoxGeometry(0.08, ROOM.h, ROOM.d), mats.wall);
  sideL.position.set(-ROOM.w / 2, ROOM.h / 2, wallZ + ROOM.d / 2);
  sideL.receiveShadow = true;
  scene.add(sideL);
  const sideR = sideL.clone();
  sideR.position.x = ROOM.w / 2;
  scene.add(sideR);
  // потолок (в кадр почти не попадает, но замыкает объём)
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.w, ROOM.d), mats.wall);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(0, ROOM.h, wallZ + ROOM.d / 2);
  scene.add(ceil);
  // плинтусы
  const skMat = new THREE.MeshStandardMaterial({ color: '#c9b6a0', roughness: 0.8 });
  const skBack = new THREE.Mesh(new THREE.BoxGeometry(ROOM.w, 0.09, 0.02), skMat);
  skBack.position.set(0, 0.045, wallZ + 0.01);
  scene.add(skBack);

  // ---- Свет
  scene.add(new THREE.AmbientLight(0xffe2c0, 0.34));
  const hemi = new THREE.HemisphereLight(0xdfe8ff, 0x6a4a2e, 0.5);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffd9a0, 2.5);
  sun.position.set(-1.7, 3.4, -4.2);
  sun.target.position.set(0.3, 0.7, 0.9);
  scene.add(sun, sun.target);
  sun.castShadow = true;
  const shadowRes = isTouch ? QUALITY.shadowMapTouch : QUALITY.shadowMap;
  sun.shadow.mapSize.set(shadowRes, shadowRes);
  sun.shadow.camera.left = -2.6;
  sun.shadow.camera.right = 2.6;
  sun.shadow.camera.top = 2.8;
  sun.shadow.camera.bottom = -0.6;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 12;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;

  // мягкий заполняющий свет из окна
  const windowFill = new THREE.PointLight(0xffe6c0, 0.5, 4.5, 2);
  windowFill.position.set(0, 1.9, -1.0);
  scene.add(windowFill);

  // ---- Стол
  scene.add(createDesk(mats));

  // ---- Окно (интерактив)
  const win = createWindow(mats);
  scene.add(win.group ?? win);
  pickTargets.push(win.group ?? win);
  const winGroup = win.group ?? win;
  updaters.push((t) => {
    // ветка снаружи едва покачивается
    winGroup.userData.branch.rotation.z = 0.12 + Math.sin(t * 0.7) * 0.012;
  });

  // ---- Шторы
  const curtains = createCurtains(mats);
  scene.add(curtains.group);
  updaters.push((t) => curtains.update(t));

  // ---- Птицы
  const birds = createBirds();
  scene.add(birds.group);
  updaters.push((t) => birds.update(t));

  // ---- Листья
  const leaves = createLeaves();
  scene.add(leaves.group);
  updaters.push((t, dt) => leaves.update(t, dt));

  // ---- Ноутбук (интерактив)
  const laptop = createLaptop(mats);
  scene.add(laptop.group);
  pickTargets.push(laptop.group);

  // ---- Блокнот (интерактив)
  const notebook = createNotebook(mats);
  scene.add(notebook.group);
  pickTargets.push(notebook.group);

  // ---- Календарь (интерактив)
  const calendar = createCalendar(mats);
  scene.add(calendar.group);
  pickTargets.push(calendar.group);

  // ---- Декор
  const decor = createDecor(mats);
  scene.add(decor.group);
  updaters.push((t) => decor.update(t));

  // ---- Луч света и пылинки
  const shaftTex = makeLightShaftTexture();
  const shaft = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 2.6),
    new THREE.MeshBasicMaterial({
      map: shaftTex, transparent: true, opacity: 0.34,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    })
  );
  shaft.position.set(-0.3, 1.45, -0.35);
  shaft.rotation.set(-0.42, 0.12, -0.14);
  scene.add(shaft);
  const shaft2 = shaft.clone();
  shaft2.scale.set(0.55, 0.85, 1);
  shaft2.position.set(0.42, 1.35, 0.1);
  scene.add(shaft2);
  updaters.push((t) => {
    shaft.material.opacity = 0.3 + Math.sin(t * 0.35) * 0.05;
    shaft2.material.opacity = 0.24 + Math.sin(t * 0.42 + 1.4) * 0.045;
  });

  const moteCount = 90;
  const motePos = new Float32Array(moteCount * 3);
  const moteSeed = new Float32Array(moteCount);
  for (let i = 0; i < moteCount; i++) {
    motePos[i * 3] = -1.1 + Math.random() * 2.1;
    motePos[i * 3 + 1] = 0.55 + Math.random() * 1.9;
    motePos[i * 3 + 2] = -1.2 + Math.random() * 1.7;
    moteSeed[i] = Math.random() * Math.PI * 2;
  }
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
  const motes = new THREE.Points(moteGeo, new THREE.PointsMaterial({
    map: makeSoftCircleTexture(),
    color: 0xffe8c0, size: 0.017, transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
  }));
  scene.add(motes);
  updaters.push((t) => {
    const arr = moteGeo.attributes.position.array;
    for (let i = 0; i < moteCount; i++) {
      arr[i * 3 + 1] += 0.00035 + (i % 5) * 0.00008;
      if (arr[i * 3 + 1] > 2.5) arr[i * 3 + 1] = 0.55;
      arr[i * 3] += Math.sin(t * 0.6 + moteSeed[i]) * 0.00045;
      arr[i * 3 + 2] += Math.cos(t * 0.5 + moteSeed[i]) * 0.0003;
    }
    moteGeo.attributes.position.needsUpdate = true;
  });

  function update(dt, t) {
    for (const u of updaters) u(t, dt);
    laptop.update(t);
  }

  return { scene, pickTargets, update, laptop };
}
