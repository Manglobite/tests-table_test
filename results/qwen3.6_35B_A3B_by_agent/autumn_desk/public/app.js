/**
 * Autumn Desk — 3D Scene
 * Main application module. Imports Three.js from local build.
 */

import * as THREE from './package/build/three.module.js';

// ─── Configuration ────────────────────────────────────────────────────────────

const CONFIG = {
  // Camera
  homePosition: new THREE.Vector3(2.5, 2.8, 4.5),
  homeTarget: new THREE.Vector3(0, 0.8, 0),
  focusDuration: 800, // ms
  retargetBlend: 0.3, // blend factor on retarget

  // Scene dimensions
  deskWidth: 3.6,
  deskDepth: 1.6,
  deskHeight: 0.05,
  deskY: 0.75,

  // Window
  windowWidth: 2.0,
  windowHeight: 2.2,
  windowY: 2.0,
  windowZ: -1.8,

  // Colors
  oakColor: 0x8B6914,
  oakDark: 0x5C4410,
  wallColor: 0xF5E6C8,
  floorColor: 0x3E2F1C,
};

// ─── State ────────────────────────────────────────────────────────────────────

let scene, camera, renderer;
let clock = new THREE.Clock();
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();
let interactiveObjects = [];
let leafParticles = [];
let curtainGroups = [];

// Camera animation state
let cameraState = {
  currentPos: new THREE.Vector3(),
  currentTarget: new THREE.Vector3(),
  targetPos: null,
  targetLookAt: null,
  animating: false,
  animStart: 0,
  animDuration: 0,
  startPos: new THREE.Vector3(),
  startTarget: new THREE.Vector3(),
  retargetPos: null,
  retargetTarget: null,
};

// Focused object tracking
let focusedObject = null;
let focusOverlay = null;
let passwordInput = null;
let passwordValue = '';

// ─── DOM References ───────────────────────────────────────────────────────────

const canvas = document.createElement('canvas');
document.body.prepend(canvas);
const errorOverlay = document.getElementById('error-overlay');

// ─── Initialization ───────────────────────────────────────────────────────────

function init() {
  // Renderer
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  if (!renderer.capabilities.isWebGL2) {
    errorOverlay.style.display = 'flex';
    return false;
  }

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87CEEB);
  scene.fog = new THREE.FogExp2(0xC4A87A, 0.03);

  // Camera
  camera = new THREE.PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    0.1,
    100
  );
  camera.position.copy(CONFIG.homePosition);
  cameraState.currentPos.copy(CONFIG.homePosition);
  cameraState.currentTarget.copy(CONFIG.homeTarget);
  cameraState.targetPos = null;
  cameraState.targetLookAt = null;
  cameraState.startPos.copy(CONFIG.homePosition);
  cameraState.startTarget.copy(CONFIG.homeTarget);

  buildScene();
  setupLights();
  setupInteraction();

  return true;
}

// ─── Scene Building ───────────────────────────────────────────────────────────

function buildScene() {
  createRoom();
  createDesk();
  createWindow();
  createCurtains();
  createLaptop();
  createNotebook();
  createCalendar();
  createDecor();
  createLeaves();
}

// ─── Room ─────────────────────────────────────────────────────────────────────

function createRoom() {
  // Floor
  const floorGeo = new THREE.PlaneGeometry(12, 12);
  const floorMat = new THREE.MeshStandardMaterial({
    color: CONFIG.floorColor,
    roughness: 0.85,
    metalness: 0.05,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  floor.receiveShadow = true;
  scene.add(floor);

  // Back wall
  const wallMat = new THREE.MeshStandardMaterial({
    color: CONFIG.wallColor,
    roughness: 0.9,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(12, 6), wallMat);
  backWall.position.set(0, 3, -3);
  backWall.receiveShadow = true;
  scene.add(backWall);

  // Left wall
  const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(12, 6), wallMat);
  leftWall.position.set(-4, 3, 0);
  leftWall.rotation.y = Math.PI / 2;
  leftWall.receiveShadow = true;
  scene.add(leftWall);

  // Right wall
  const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(12, 6), wallMat);
  rightWall.position.set(4, 3, 0);
  rightWall.rotation.y = -Math.PI / 2;
  rightWall.receiveShadow = true;
  scene.add(rightWall);
}

// ─── Oak Desk ─────────────────────────────────────────────────────────────────

function createDesk() {
  const w = CONFIG.deskWidth;
  const d = CONFIG.deskDepth;
  const th = CONFIG.deskHeight;
  const y = CONFIG.deskY;

  // Desk top
  const topGeo = new THREE.BoxGeometry(w, th, d);
  const oakMat = new THREE.MeshStandardMaterial({
    color: CONFIG.oakColor,
    roughness: 0.55,
    metalness: 0.05,
  });
  const top = new THREE.Mesh(topGeo, oakMat);
  top.position.set(0, y + th / 2, 0);
  top.castShadow = true;
  top.receiveShadow = true;
  scene.add(top);

  // Desk legs
  const legGeo = new THREE.BoxGeometry(0.08, y, 0.08);
  const legPositions = [
    [-w / 2 + 0.15, y / 2, -d / 2 + 0.15],
    [w / 2 - 0.15, y / 2, -d / 2 + 0.15],
    [-w / 2 + 0.15, y / 2, d / 2 - 0.15],
    [w / 2 - 0.15, y / 2, d / 2 - 0.15],
  ];
  legPositions.forEach((pos) => {
    const leg = new THREE.Mesh(legGeo, oakMat);
    leg.position.set(...pos);
    leg.castShadow = true;
    leg.receiveShadow = true;
    scene.add(leg);
  });

  // Carved decorative panel (front apron)
  const apronGeo = new THREE.BoxGeometry(w - 0.3, 0.35, 0.06);
  const apronMat = new THREE.MeshStandardMaterial({
    color: CONFIG.oakDark,
    roughness: 0.6,
    metalness: 0.02,
  });
  const apron = new THREE.Mesh(apronGeo, apronMat);
  apron.position.set(0, y - 0.15, d / 2 - 0.03);
  apron.castShadow = true;
  scene.add(apron);

  // Decorative carvings on apron - simple geometric patterns
  const carveGeo = new THREE.BoxGeometry(0.04, 0.25, 0.02);
  for (let i = -3; i <= 3; i++) {
    const carve = new THREE.Mesh(carveGeo, apronMat);
    carve.position.set(i * 0.4, y - 0.15, d / 2 - 0.06);
    carve.castShadow = true;
    scene.add(carve);
  }

  // Horizontal decorative bars on apron
  const hBarGeo = new THREE.BoxGeometry(w - 0.5, 0.03, 0.02);
  const hBar1 = new THREE.Mesh(hBarGeo, apronMat);
  hBar1.position.set(0, y + 0.0, d / 2 - 0.06);
  scene.add(hBar1);
  const hBar2 = new THREE.Mesh(hBarGeo, apronMat);
  hBar2.position.set(0, y - 0.3, d / 2 - 0.06);
  scene.add(hBar2);

  // Side aprons
  const sideApronGeo = new THREE.BoxGeometry(0.06, 0.35, d - 0.3);
  const sideApronL = new THREE.Mesh(sideApronGeo, apronMat);
  sideApronL.position.set(-w / 2 + 0.03, y - 0.15, 0);
  scene.add(sideApronL);
  const sideApronR = new THREE.Mesh(sideApronGeo, apronMat);
  sideApronR.position.set(w / 2 - 0.03, y - 0.15, 0);
  scene.add(sideApronR);
}

// ─── Window ───────────────────────────────────────────────────────────────────

let windowGroup;
let windowFocusMesh;

function createWindow() {
  windowGroup = new THREE.Group();
  windowGroup.position.set(0, CONFIG.windowY, CONFIG.windowZ);

  const ww = CONFIG.windowWidth;
  const wh = CONFIG.windowHeight;

  // Window frame
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0xF0F0F0,
    roughness: 0.4,
    metalness: 0.1,
  });

  // Outer frame pieces
  const frameThick = 0.08;
  const frameDepth = 0.12;

  // Top frame
  const topFrame = new THREE.Mesh(
    new THREE.BoxGeometry(ww + frameThick * 2, frameThick, frameDepth),
    frameMat
  );
  topFrame.position.y = wh / 2 + frameThick / 2;
  topFrame.castShadow = true;
  windowGroup.add(topFrame);

  // Bottom frame (sill)
  const sillGeo = new THREE.BoxGeometry(ww + 0.3, 0.06, frameDepth + 0.15);
  const sill = new THREE.Mesh(sillGeo, frameMat);
  sill.position.set(0, -wh / 2 - 0.03, 0.05);
  sill.castShadow = true;
  sill.receiveShadow = true;
  windowGroup.add(sill);

  // Left frame
  const leftFrame = new THREE.Mesh(
    new THREE.BoxGeometry(frameThick, wh, frameDepth),
    frameMat
  );
  leftFrame.position.set(-ww / 2 - frameThick / 2, 0, 0);
  leftFrame.castShadow = true;
  windowGroup.add(leftFrame);

  // Right frame
  const rightFrame = new THREE.Mesh(
    new THREE.BoxGeometry(frameThick, wh, frameDepth),
    frameMat
  );
  rightFrame.position.set(ww / 2 + frameThick / 2, 0, 0);
  rightFrame.castShadow = true;
  windowGroup.add(rightFrame);

  // Center vertical divider
  const divV = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, wh, 0.04),
    frameMat
  );
  divV.position.z = 0;
  windowGroup.add(divV);

  // Center horizontal divider
  const divH = new THREE.Mesh(
    new THREE.BoxGeometry(ww, 0.04, 0.04),
    frameMat
  );
  divH.position.z = 0;
  windowGroup.add(divH);

  // Window glass (open pane - right side pushed open)
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x88AACC,
    transparent: true,
    opacity: 0.15,
    roughness: 0.05,
    metalness: 0.1,
    transmission: 0.8,
    thickness: 0.01,
  });

  // Left pane (fixed)
  const leftPane = new THREE.Mesh(
    new THREE.PlaneGeometry(ww / 2 - 0.06, wh - 0.06),
    glassMat
  );
  leftPane.position.set(-ww / 4, 0, 0.02);
  windowGroup.add(leftPane);

  // Right pane (open - rotated)
  const rightPaneGroup = new THREE.Group();
  rightPaneGroup.position.set(ww / 4, 0, 0);
  const rightPane = new THREE.Mesh(
    new THREE.PlaneGeometry(ww / 2 - 0.06, wh - 0.06),
    glassMat
  );
  rightPane.position.set(ww / 4, 0, 0);
  rightPaneGroup.add(rightPane);
  rightPaneGroup.rotation.y = -Math.PI * 0.35; // Opened outward
  windowGroup.add(rightPaneGroup);

  // Autumn view outside window (sky + trees)
  const viewGroup = new THREE.Group();
  viewGroup.position.z = -1.5;

  // Sky backdrop
  const skyGeo = new THREE.PlaneGeometry(10, 6);
  const skyMat = new THREE.MeshBasicMaterial({
    color: 0xD4A56A,
    side: THREE.DoubleSide,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.position.y = 1.5;
  viewGroup.add(sky);

  // Distant trees (simple cones)
  const treeMat = new THREE.MeshStandardMaterial({
    color: 0x8B4513,
    roughness: 0.9,
  });
  const foliageMat = new THREE.MeshStandardMaterial({
    color: 0xD4872C,
    roughness: 0.8,
  });
  const foliageMat2 = new THREE.MeshStandardMaterial({
    color: 0xC4652A,
    roughness: 0.8,
  });

  for (let i = 0; i < 8; i++) {
    const treeGroup = new THREE.Group();
    const tx = -4 + i * 1.2 + Math.random() * 0.5;
    const tz = -1.5 - Math.random() * 2;
    const th = 1.5 + Math.random() * 1;

    // Trunk
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.08, th * 0.5, 6),
      treeMat
    );
    trunk.position.y = th * 0.25;
    treeGroup.add(trunk);

    // Foliage
    const foliage = new THREE.Mesh(
      new THREE.SphereGeometry(th * 0.35, 8, 6),
      i % 2 === 0 ? foliageMat : foliageMat2
    );
    foliage.position.y = th * 0.6;
    foliage.scale.y = 0.7;
    treeGroup.add(foliage);

    treeGroup.position.set(tx, -wh / 2 + 1, tz);
    viewGroup.add(treeGroup);
  }

  // Birds
  const birdMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
  for (let i = 0; i < 3; i++) {
    const bird = createBird(birdMat);
    bird.position.set(
      -2 + Math.random() * 4,
      wh / 2 + 0.5 + Math.random() * 1.5,
      -2 - Math.random() * 3
    );
    bird.userData = {
      baseX: bird.position.x,
      baseY: bird.position.y,
      phase: Math.random() * Math.PI * 2,
      speed: 0.5 + Math.random() * 0.5,
      amplitude: 0.3 + Math.random() * 0.3,
    };
    viewGroup.add(bird);
  }

  windowGroup.add(viewGroup);
  windowGroup.userData.viewGroup = viewGroup;

  scene.add(windowGroup);

  // Interactive mesh for window
  const windowHitGeo = new THREE.BoxGeometry(ww + 0.2, wh + 0.2, 0.3);
  const windowHitMat = new THREE.MeshBasicMaterial({ visible: false });
  windowFocusMesh = new THREE.Mesh(windowHitGeo, windowHitMat);
  windowFocusMesh.position.copy(windowGroup.position);
  windowFocusMesh.userData.interactive = true;
  windowFocusMesh.userData.objectName = 'window';
  scene.add(windowFocusMesh);
  interactiveObjects.push(windowFocusMesh);
}

function createBird(material) {
  const group = new THREE.Group();
  const wingGeo = new THREE.PlaneGeometry(0.15, 0.04);
  const leftWing = new THREE.Mesh(wingGeo, material);
  leftWing.position.x = -0.075;
  group.add(leftWing);
  const rightWing = new THREE.Mesh(wingGeo, material);
  rightWing.position.x = 0.075;
  group.add(rightWing);
  group.userData.leftWing = leftWing;
  group.userData.rightWing = rightWing;
  return group;
}

// ─── Curtains ─────────────────────────────────────────────────────────────────

function createCurtains() {
  const curtainMat = new THREE.MeshStandardMaterial({
    color: 0xE8D5B7,
    roughness: 0.85,
    metalness: 0,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.85,
  });

  // Left curtain
  const leftCurtainGroup = new THREE.Group();
  const leftCurtainGeo = new THREE.PlaneGeometry(0.6, CONFIG.windowHeight + 0.3, 8, 12);
  const leftCurtain = new THREE.Mesh(leftCurtainGeo, curtainMat);
  leftCurtain.position.set(
    -CONFIG.windowWidth / 2 - 0.25,
    CONFIG.windowY + 0.15,
    CONFIG.windowZ + 0.1
  );
  leftCurtain.castShadow = true;
  leftCurtainGroup.add(leftCurtain);
  leftCurtainGroup.userData.mesh = leftCurtain;
  leftCurtainGroup.userData.phase = 0;
  curtainGroups.push(leftCurtainGroup);
  scene.add(leftCurtainGroup);

  // Right curtain
  const rightCurtainGroup = new THREE.Group();
  const rightCurtainGeo = new THREE.PlaneGeometry(0.6, CONFIG.windowHeight + 0.3, 8, 12);
  const rightCurtain = new THREE.Mesh(rightCurtainGeo, curtainMat);
  rightCurtain.position.set(
    CONFIG.windowWidth / 2 + 0.25,
    CONFIG.windowY + 0.15,
    CONFIG.windowZ + 0.1
  );
  rightCurtain.castShadow = true;
  rightCurtainGroup.add(rightCurtain);
  rightCurtainGroup.userData.mesh = rightCurtain;
  rightCurtainGroup.userData.phase = Math.PI;
  curtainGroups.push(rightCurtainGroup);
  scene.add(rightCurtainGroup);

  // Curtain rod
  const rodMat = new THREE.MeshStandardMaterial({
    color: 0x8B7355,
    roughness: 0.4,
    metalness: 0.3,
  });
  const rod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, CONFIG.windowWidth + 1.2, 8),
    rodMat
  );
  rod.rotation.z = Math.PI / 2;
  rod.position.set(0, CONFIG.windowY + CONFIG.windowHeight / 2 + 0.3, CONFIG.windowZ + 0.15);
  rod.castShadow = true;
  scene.add(rod);
}

// ─── Laptop ───────────────────────────────────────────────────────────────────

let laptopGroup;
let laptopFocusMesh;
let screenCanvas, screenTexture, screenCtx;

function createLaptop() {
  laptopGroup = new THREE.Group();
  laptopGroup.position.set(0.8, CONFIG.deskY + CONFIG.deskHeight / 2, 0.15);
  laptopGroup.rotation.y = -0.15;

  const laptopMat = new THREE.MeshStandardMaterial({
    color: 0x2C2C2C,
    roughness: 0.3,
    metalness: 0.7,
  });

  // Base (keyboard area)
  const baseGeo = new THREE.BoxGeometry(0.7, 0.02, 0.45);
  const base = new THREE.Mesh(baseGeo, laptopMat);
  base.castShadow = true;
  base.receiveShadow = true;
  laptopGroup.add(base);

  // Keyboard area
  const kbMat = new THREE.MeshStandardMaterial({
    color: 0x1A1A1A,
    roughness: 0.6,
    metalness: 0.2,
  });
  const kbGeo = new THREE.BoxGeometry(0.6, 0.005, 0.25);
  const kb = new THREE.Mesh(kbGeo, kbMat);
  kb.position.set(0, 0.013, 0.05);
  laptopGroup.add(kb);

  // Screen back
  const screenBackGeo = new THREE.BoxGeometry(0.7, 0.44, 0.015);
  const screenBack = new THREE.Mesh(screenBackGeo, laptopMat);
  screenBack.position.set(0, 0.23, -0.22);
  screenBack.rotation.x = -0.15;
  screenBack.castShadow = true;
  laptopGroup.add(screenBack);

  // Screen display
  screenCanvas = document.createElement('canvas');
  screenCanvas.width = 512;
  screenCanvas.height = 320;
  screenTexture = new THREE.CanvasTexture(screenCanvas);
  screenTexture.colorSpace = THREE.SRGBColorSpace;

  const screenDisplayMat = new THREE.MeshStandardMaterial({
    map: screenTexture,
    emissiveMap: screenTexture,
    emissive: new THREE.Color(1, 1, 1),
    emissiveIntensity: 0.5,
    roughness: 0.1,
    metalness: 0,
  });
  const screenDisplayGeo = new THREE.PlaneGeometry(0.66, 0.4);
  const screenDisplay = new THREE.Mesh(screenDisplayGeo, screenDisplayMat);
  screenDisplay.position.set(0, 0.23, -0.21);
  screenDisplay.rotation.x = -0.15;
  laptopGroup.add(screenDisplay);

  // Draw initial lock screen
  drawLockScreen();

  scene.add(laptopGroup);

  // Interactive mesh
  const laptopHitGeo = new THREE.BoxGeometry(0.8, 0.5, 0.5);
  const laptopHitMat = new THREE.MeshBasicMaterial({ visible: false });
  laptopFocusMesh = new THREE.Mesh(laptopHitGeo, laptopHitMat);
  laptopFocusMesh.position.copy(laptopGroup.position);
  laptopFocusMesh.position.y += 0.25;
  laptopFocusMesh.userData.interactive = true;
  laptopFocusMesh.userData.objectName = 'laptop';
  scene.add(laptopFocusMesh);
  interactiveObjects.push(laptopFocusMesh);
}

function drawLockScreen() {
  const ctx = screenCtx || (screenCtx = screenCanvas.getContext('2d'));
  const w = screenCanvas.width;
  const h = screenCanvas.height;

  // Background gradient (autumn wallpaper)
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, '#1a0a2e');
  grad.addColorStop(0.3, '#2d1b4e');
  grad.addColorStop(0.6, '#4a2c5e');
  grad.addColorStop(1, '#1a0a2e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Subtle light streaks
  ctx.globalAlpha = 0.1;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(Math.random() * w, Math.random() * h);
    ctx.lineTo(Math.random() * w, Math.random() * h);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2 + Math.random() * 4;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Time
  const now = new Date();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.font = 'bold 72px system-ui, -apple-system, sans-serif';
  ctx.fillText(formatTime(now), w / 2, h / 2 - 30);

  // Date
  ctx.font = '24px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#cccccc';
  ctx.fillText(formatDate(now), w / 2, h / 2 + 15);

  // Password hint
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillStyle = '#aaaaaa';
  ctx.fillText('Пароль', w / 2, h / 2 + 60);

  // Password field
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 1;
  const fieldW = 200;
  const fieldH = 32;
  const fieldX = (w - fieldW) / 2;
  const fieldY = h / 2 + 70;
  ctx.beginPath();
  ctx.roundRect(fieldX, fieldY, fieldW, fieldH, 6);
  ctx.fill();
  ctx.stroke();

  // Password dots
  ctx.fillStyle = '#ffffff';
  const pwLen = passwordValue.length;
  for (let i = 0; i < Math.min(pwLen, 12); i++) {
    ctx.beginPath();
    ctx.arc(fieldX + 25 + i * 15, fieldY + fieldH / 2, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Submit button
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.beginPath();
  ctx.roundRect(fieldX + fieldW - 50, fieldY - 2, 48, fieldH + 4, 6);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = '12px system-ui';
  ctx.fillText('→', fieldX + fieldW - 26, fieldY + fieldH / 2 + 4);

  screenTexture.needsUpdate = true;
}

function formatTime(date) {
  const h = date.getHours().toString().padStart(2, '0');
  const m = date.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

function formatDate(date) {
  const days = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
  const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]}`;
}

// ─── Notebook ─────────────────────────────────────────────────────────────────

let notebookGroup;
let notebookFocusMesh;

function createNotebook() {
  notebookGroup = new THREE.Group();
  notebookGroup.position.set(-0.6, CONFIG.deskY + CONFIG.deskHeight / 2, 0.5);
  notebookGroup.rotation.y = 0.3;

  const paperMat = new THREE.MeshStandardMaterial({
    color: 0xFFF8E7,
    roughness: 0.9,
    metalness: 0,
    side: THREE.DoubleSide,
  });

  const coverMat = new THREE.MeshStandardMaterial({
    color: 0x4A6741,
    roughness: 0.7,
    metalness: 0.05,
  });

  // Open notebook - two pages
  // Left page (slightly angled)
  const pageGeo = new THREE.BoxGeometry(0.18, 0.005, 0.24);

  const leftPage = new THREE.Mesh(pageGeo, paperMat);
  leftPage.position.set(-0.09, 0.005, 0);
  leftPage.rotation.y = 0.15;
  leftPage.rotation.z = 0.05;
  leftPage.castShadow = true;
  notebookGroup.add(leftPage);

  // Right page
  const rightPage = new THREE.Mesh(pageGeo, paperMat);
  rightPage.position.set(0.09, 0.005, 0);
  rightPage.rotation.y = -0.15;
  rightPage.rotation.z = -0.05;
  rightPage.castShadow = true;
  notebookGroup.add(rightPage);

  // Cover underneath
  const coverGeo = new THREE.BoxGeometry(0.4, 0.008, 0.26);
  const cover = new THREE.Mesh(coverGeo, coverMat);
  cover.position.y = -0.002;
  cover.castShadow = true;
  notebookGroup.add(cover);

  // Spine
  const spineGeo = new THREE.BoxGeometry(0.02, 0.01, 0.26);
  const spine = new THREE.Mesh(spineGeo, coverMat);
  spine.position.y = 0.005;
  notebookGroup.add(spine);

  // Draw lines on pages using canvas textures
  drawNotebookPages(leftPage, rightPage);

  scene.add(notebookGroup);

  // Interactive mesh
  const nbHitGeo = new THREE.BoxGeometry(0.45, 0.05, 0.3);
  const nbHitMat = new THREE.MeshBasicMaterial({ visible: false });
  notebookFocusMesh = new THREE.Mesh(nbHitGeo, nbHitMat);
  notebookFocusMesh.position.copy(notebookGroup.position);
  notebookFocusMesh.position.y += 0.02;
  notebookFocusMesh.userData.interactive = true;
  notebookFocusMesh.userData.objectName = 'notebook';
  scene.add(notebookFocusMesh);
  interactiveObjects.push(notebookFocusMesh);
}

function drawNotebookPages(leftPage, rightPage) {
  const canvasW = 128;
  const canvasH = 192;

  // Left page texture
  const leftCanvas = document.createElement('canvas');
  leftCanvas.width = canvasW;
  leftCanvas.height = canvasH;
  const leftCtx = leftCanvas.getContext('2d');
  leftCtx.fillStyle = '#FFF8E7';
  leftCtx.fillRect(0, 0, canvasW, canvasH);

  // Ruled lines
  leftCtx.strokeStyle = '#D0D0D0';
  leftCtx.lineWidth = 0.5;
  for (let y = 20; y < canvasH - 10; y += 12) {
    leftCtx.beginPath();
    leftCtx.moveTo(10, y);
    leftCtx.lineTo(canvasW - 10, y);
    leftCtx.stroke();
  }

  // Handwritten text simulation
  leftCtx.fillStyle = '#2C3E50';
  leftCtx.font = '8px serif';
  leftCtx.fillText('Заметки:', 12, 35);
  leftCtx.fillText('Осенний проект', 12, 55);
  leftCtx.fillText('— начать работу', 12, 75);
  leftCtx.fillText('— проверить свет', 12, 95);
  leftCtx.fillText('— финальная сборка', 12, 115);

  const leftTexture = new THREE.CanvasTexture(leftCanvas);
  leftTexture.colorSpace = THREE.SRGBColorSpace;
  const leftPageMat = new THREE.MeshStandardMaterial({
    map: leftTexture,
    roughness: 0.9,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  leftPage.material = leftPageMat;

  // Right page texture
  const rightCanvas = document.createElement('canvas');
  rightCanvas.width = canvasW;
  rightCanvas.height = canvasH;
  const rightCtx = rightCanvas.getContext('2d');
  rightCtx.fillStyle = '#FFF8E7';
  rightCtx.fillRect(0, 0, canvasW, canvasH);

  // Ruled lines
  rightCtx.strokeStyle = '#D0D0D0';
  rightCtx.lineWidth = 0.5;
  for (let y = 20; y < canvasH - 10; y += 12) {
    rightCtx.beginPath();
    rightCtx.moveTo(10, y);
    rightCtx.lineTo(canvasW - 10, y);
    rightCtx.stroke();
  }

  // More text
  rightCtx.fillStyle = '#2C3E50';
  rightCtx.font = '8px serif';
  rightCtx.fillText('Идеи:', 12, 35);
  rightCtx.fillText('Добавить анимацию', 12, 55);
  rightCtx.fillText('листьев', 12, 75);
  rightCtx.fillText('Улучшить освещение', 12, 95);
  rightCtx.fillText('Окно с птицами', 12, 115);

  const rightTexture = new THREE.CanvasTexture(rightCanvas);
  rightTexture.colorSpace = THREE.SRGBColorSpace;
  const rightPageMat = new THREE.MeshStandardMaterial({
    map: rightTexture,
    roughness: 0.9,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  rightPage.material = rightPageMat;
}

// ─── Calendar ─────────────────────────────────────────────────────────────────

let calendarGroup;
let calendarFocusMesh;

function createCalendar() {
  calendarGroup = new THREE.Group();
  calendarGroup.position.set(-1.3, CONFIG.deskY + CONFIG.deskHeight / 2, 0.2);

  const metalMat = new THREE.MeshStandardMaterial({
    color: 0x888888,
    roughness: 0.3,
    metalness: 0.8,
  });

  // Wall mount bracket
  const bracketGeo = new THREE.BoxGeometry(0.02, 0.3, 0.02);
  const bracket = new THREE.Mesh(bracketGeo, metalMat);
  bracket.position.set(0, 0.15, -0.06);
  bracket.castShadow = true;
  calendarGroup.add(bracket);

  // Metal ring holder
  const ringGeo = new THREE.TorusGeometry(0.02, 0.004, 8, 16);
  for (let i = 0; i < 2; i++) {
    const ring = new THREE.Mesh(ringGeo, metalMat);
    ring.position.set(-0.04 + i * 0.08, 0.28, 0);
    ring.rotation.x = Math.PI / 2;
    ring.castShadow = true;
    calendarGroup.add(ring);
  }

  // Calendar page
  const calCanvas = document.createElement('canvas');
  calCanvas.width = 256;
  calCanvas.height = 320;
  const calCtx = calCanvas.getContext('2d');

  // White page
  calCtx.fillStyle = '#FFFFFF';
  calCtx.fillRect(0, 0, 256, 320);

  // Red header
  calCtx.fillStyle = '#CC3333';
  calCtx.fillRect(0, 0, 256, 60);

  // Month and year
  calCtx.fillStyle = '#FFFFFF';
  calCtx.font = 'bold 28px system-ui, sans-serif';
  calCtx.textAlign = 'center';
  calCtx.fillText('ОКТЯБРЬ', 128, 30);
  calCtx.font = '18px system-ui, sans-serif';
  calCtx.fillText('2024', 128, 50);

  // Day number (large)
  calCtx.fillStyle = '#CC3333';
  calCtx.font = 'bold 80px system-ui, sans-serif';
  calCtx.fillText('15', 128, 150);

  // Day of week
  calCtx.fillStyle = '#333333';
  calCtx.font = '16px system-ui, sans-serif';
  calCtx.fillText('Пятница', 128, 180);

  // Bottom border
  calCtx.fillStyle = '#CC3333';
  calCtx.fillRect(0, 310, 256, 10);

  const calTexture = new THREE.CanvasTexture(calCanvas);
  calTexture.colorSpace = THREE.SRGBColorSpace;

  const pageGeo = new THREE.PlaneGeometry(0.18, 0.22);
  const pageMat = new THREE.MeshStandardMaterial({
    map: calTexture,
    roughness: 0.8,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  const page = new THREE.Mesh(pageGeo, pageMat);
  page.position.set(0, 0.1, 0.005);
  page.castShadow = true;
  calendarGroup.add(page);

  // Backing board
  const backGeo = new THREE.PlaneGeometry(0.18, 0.22);
  const backMat = new THREE.MeshStandardMaterial({
    color: 0xDDDDDD,
    roughness: 0.9,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  const back = new THREE.Mesh(backGeo, backMat);
  back.position.set(0, 0.1, -0.005);
  calendarGroup.add(back);

  scene.add(calendarGroup);

  // Interactive mesh
  const calHitGeo = new THREE.BoxGeometry(0.2, 0.3, 0.05);
  const calHitMat = new THREE.MeshBasicMaterial({ visible: false });
  calendarFocusMesh = new THREE.Mesh(calHitGeo, calHitMat);
  calendarFocusMesh.position.copy(calendarGroup.position);
  calendarFocusMesh.position.y += 0.1;
  calendarFocusMesh.userData.interactive = true;
  calendarFocusMesh.userData.objectName = 'calendar';
  scene.add(calendarFocusMesh);
  interactiveObjects.push(calendarFocusMesh);
}

// ─── Decor ────────────────────────────────────────────────────────────────────

function createDecor() {
  // Coffee cup
  const cupMat = new THREE.MeshStandardMaterial({
    color: 0xF5F5F5,
    roughness: 0.3,
    metalness: 0.05,
  });
  const cupGeo = new THREE.CylinderGeometry(0.04, 0.035, 0.1, 16);
  const cup = new THREE.Mesh(cupGeo, cupMat);
  cup.position.set(1.2, CONFIG.deskY + CONFIG.deskHeight / 2 + 0.05, -0.2);
  cup.castShadow = true;
  scene.add(cup);

  // Cup handle
  const handleGeo = new THREE.TorusGeometry(0.03, 0.005, 8, 16, Math.PI);
  const handle = new THREE.Mesh(handleGeo, cupMat);
  handle.position.set(1.24, CONFIG.deskY + CONFIG.deskHeight / 2 + 0.05, -0.2);
  handle.rotation.y = Math.PI / 2;
  scene.add(handle);

  // Pen
  const penMat = new THREE.MeshStandardMaterial({
    color: 0x1A1A2E,
    roughness: 0.4,
    metalness: 0.5,
  });
  const penGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.15, 8);
  const pen = new THREE.Mesh(penGeo, penMat);
  pen.position.set(-0.2, CONFIG.deskY + CONFIG.deskHeight / 2 + 0.008, -0.1);
  pen.rotation.z = Math.PI / 2;
  pen.rotation.y = 0.5;
  pen.castShadow = true;
  scene.add(pen);

  // Small stack of books
  const bookMat = new THREE.MeshStandardMaterial({
    color: 0x8B0000,
    roughness: 0.8,
    metalness: 0,
  });
  const book2Mat = new THREE.MeshStandardMaterial({
    color: 0x2F4F4F,
    roughness: 0.8,
    metalness: 0,
  });
  const book3Mat = new THREE.MeshStandardMaterial({
    color: 0x4A3728,
    roughness: 0.8,
    metalness: 0,
  });

  const bookGeo = new THREE.BoxGeometry(0.12, 0.02, 0.17);
  const book1 = new THREE.Mesh(bookGeo, bookMat);
  book1.position.set(-1.0, CONFIG.deskY + CONFIG.deskHeight / 2 + 0.01, -0.3);
  book1.castShadow = true;
  scene.add(book1);

  const book2 = new THREE.Mesh(bookGeo, book2Mat);
  book2.position.set(-1.0, CONFIG.deskY + CONFIG.deskHeight / 2 + 0.03, -0.28);
  book2.rotation.y = 0.1;
  book2.castShadow = true;
  scene.add(book2);

  const book3 = new THREE.Mesh(bookGeo, book3Mat);
  book3.position.set(-1.0, CONFIG.deskY + CONFIG.deskHeight / 2 + 0.05, -0.26);
  book3.rotation.y = -0.05;
  book3.castShadow = true;
  scene.add(book3);
}

// ─── Falling Leaves ───────────────────────────────────────────────────────────

function createLeaves() {
  const leafColors = [0xD4872C, 0xC4652A, 0xB8860B, 0x8B4513, 0xCD853F];

  for (let i = 0; i < 25; i++) {
    const leafGeo = new THREE.PlaneGeometry(0.04, 0.06);
    const leafMat = new THREE.MeshStandardMaterial({
      color: leafColors[Math.floor(Math.random() * leafColors.length)],
      roughness: 0.8,
      metalness: 0,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    });
    const leaf = new THREE.Mesh(leafGeo, leafMat);

    // Position leaves in a scattered pattern near the window
    const x = (Math.random() - 0.5) * 6;
    const y = 1 + Math.random() * 4;
    const z = CONFIG.windowZ + Math.random() * 2;
    leaf.position.set(x, y, z);

    leaf.userData = {
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * 0.005,
        -0.002 - Math.random() * 0.003,
        (Math.random() - 0.5) * 0.003
      ),
      rotationSpeed: new THREE.Vector3(
        (Math.random() - 0.5) * 0.02,
        (Math.random() - 0.5) * 0.02,
        (Math.random() - 0.5) * 0.02
      ),
      swayPhase: Math.random() * Math.PI * 2,
      swaySpeed: 0.5 + Math.random() * 1,
      swayAmplitude: 0.003 + Math.random() * 0.005,
      baseX: x,
    };

    leaf.castShadow = true;
    scene.add(leaf);
    leafParticles.push(leaf);
  }
}

// ─── Lights ───────────────────────────────────────────────────────────────────

function setupLights() {
  // Ambient light (warm)
  const ambient = new THREE.AmbientLight(0xFFE4C4, 0.4);
  scene.add(ambient);

  // Main sunlight through window
  const sunLight = new THREE.DirectionalLight(0xFFE4B5, 2.5);
  sunLight.position.set(0, 5, -5);
  sunLight.target.position.set(0, 0, 0);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.camera.near = 0.5;
  sunLight.shadow.camera.far = 20;
  sunLight.shadow.camera.left = -5;
  sunLight.shadow.camera.right = 5;
  sunLight.shadow.camera.top = 5;
  sunLight.shadow.camera.bottom = -5;
  sunLight.shadow.bias = -0.001;
  scene.add(sunLight);
  scene.add(sunLight.target);

  // Fill light (softer, from opposite side)
  const fillLight = new THREE.DirectionalLight(0xC4A882, 0.5);
  fillLight.position.set(-3, 3, 3);
  scene.add(fillLight);

  // Rim light for depth
  const rimLight = new THREE.PointLight(0xFFD700, 0.3, 8);
  rimLight.position.set(2, 3, -2);
  scene.add(rimLight);

  // Warm lamp light near desk
  const lampLight = new THREE.PointLight(0xFFAA55, 0.6, 3);
  lampLight.position.set(-1.2, CONFIG.deskY + 0.8, -0.3);
  lampLight.castShadow = true;
  lampLight.shadow.mapSize.width = 512;
  lampLight.shadow.mapSize.height = 512;
  scene.add(lampLight);

  // Subtle hemisphere light
  const hemiLight = new THREE.HemisphereLight(0xFFE4C4, 0x3E2F1C, 0.3);
  scene.add(hemiLight);
}

// ─── Interaction ──────────────────────────────────────────────────────────────

function setupInteraction() {
  // Mouse events
  canvas.addEventListener('pointerdown', onPointerDown, false);
  canvas.addEventListener('pointermove', onPointerMove, false);
  window.addEventListener('keydown', onKeyDown, false);

  // Resize
  window.addEventListener('resize', onResize, false);
}

function onPointerDown(event) {
  event.preventDefault();
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(interactiveObjects, false);

  if (intersects.length > 0) {
    const obj = intersects[0].object;
    if (obj.userData.interactive) {
      handleObjectClick(obj);
    }
  } else {
    // Click on background -> home
    if (focusedObject) {
      returnToHome();
    }
  }
}

function onPointerMove(event) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  // Cursor feedback
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(interactiveObjects, false);
  canvas.style.cursor = intersects.length > 0 ? 'pointer' : 'default';
}

function onKeyDown(event) {
  if (event.key === 'Escape') {
    if (focusedObject) {
      returnToHome();
    }
  }
}

function handleObjectClick(obj) {
  const name = obj.userData.objectName;

  if (focusedObject === name) {
    // Same object clicked again -> return home
    returnToHome();
  } else {
    // Focus on new object
    focusOnObject(name);
  }
}

function focusOnObject(name) {
  let targetPos, targetLookAt;

  switch (name) {
    case 'window':
      targetPos = new THREE.Vector3(0, 2.0, 0.5);
      targetLookAt = new THREE.Vector3(0, 2.0, CONFIG.windowZ);
      break;
    case 'laptop':
      targetPos = new THREE.Vector3(0.8, 1.3, 1.0);
      targetLookAt = new THREE.Vector3(0.8, 0.95, 0.15);
      break;
    case 'notebook':
      targetPos = new THREE.Vector3(-0.6, 1.3, 1.0);
      targetLookAt = new THREE.Vector3(-0.6, 0.78, 0.5);
      break;
    case 'calendar':
      targetPos = new THREE.Vector3(-1.3, 1.3, 0.8);
      targetLookAt = new THREE.Vector3(-1.3, 0.85, 0.2);
      break;
    default:
      return;
  }

  focusedObject = name;

  // Check if we're already animating (retarget)
  if (cameraState.animating && cameraState.retargetPos) {
    // Retarget: blend smoothly to new target
    const blend = CONFIG.retargetBlend;
    cameraState.retargetPos.lerp(targetPos, blend);
    cameraState.retargetTarget.lerp(targetLookAt, blend);
    cameraState.animDuration = Math.max(100, cameraState.animDuration * (1 - blend));
    cameraState.animStart = performance.now();
  } else {
    // Start fresh animation
    cameraState.startPos.copy(cameraState.currentPos);
    cameraState.startTarget.copy(cameraState.currentTarget);
    cameraState.targetPos = targetPos;
    cameraState.targetLookAt = targetLookAt;
    cameraState.retargetPos = targetPos.clone();
    cameraState.retargetTarget = targetLookAt.clone();
    cameraState.animStart = performance.now();
    cameraState.animDuration = CONFIG.focusDuration;
    cameraState.animating = true;
  }
}

function returnToHome() {
  focusedObject = null;

  if (cameraState.animating && cameraState.retargetPos) {
    // Retarget to home
    const blend = CONFIG.retargetBlend;
    cameraState.retargetPos.lerp(CONFIG.homePosition, blend);
    cameraState.retargetTarget.lerp(CONFIG.homeTarget, blend);
    cameraState.animDuration = Math.max(100, cameraState.animDuration * (1 - blend));
    cameraState.animStart = performance.now();
  } else {
    cameraState.startPos.copy(cameraState.currentPos);
    cameraState.startTarget.copy(cameraState.currentTarget);
    cameraState.targetPos = CONFIG.homePosition.clone();
    cameraState.targetLookAt = CONFIG.homeTarget.clone();
    cameraState.retargetPos = CONFIG.homePosition.clone();
    cameraState.retargetTarget = CONFIG.homeTarget.clone();
    cameraState.animStart = performance.now();
    cameraState.animDuration = CONFIG.focusDuration;
    cameraState.animating = true;
  }
}

// ─── Animation Loop ───────────────────────────────────────────────────────────

function updateCameraAnimation() {
  if (!cameraState.animating) return;

  const elapsed = performance.now() - cameraState.animStart;
  const t = Math.min(elapsed / cameraState.animDuration, 1);

  // Smooth easing (ease-in-out cubic)
  const eased = t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;

  // Interpolate with retarget blend
  const currentTarget = cameraState.retargetPos.clone();
  const currentLookAt = cameraState.retargetTarget.clone();

  cameraState.currentPos.lerpVectors(cameraState.startPos, currentTarget, eased);
  cameraState.currentTarget.lerpVectors(cameraState.startTarget, currentLookAt, eased);

  camera.position.copy(cameraState.currentPos);
  camera.lookAt(cameraState.currentTarget);

  if (t >= 1) {
    cameraState.animating = false;
    cameraState.targetPos = null;
    cameraState.targetLookAt = null;
  }
}

function updateCurtains(time) {
  curtainGroups.forEach((group) => {
    const mesh = group.userData.mesh;
    const phase = group.userData.phase;
    const positions = mesh.geometry.attributes.position;

    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);

      // Wave effect - more movement at bottom
      const bottomFactor = (y + CONFIG.windowHeight / 2) / CONFIG.windowHeight;
      const wave = Math.sin(time * 0.8 + phase + x * 3 + bottomFactor * 2) * 0.03 * bottomFactor;

      positions.setZ(i, wave);
    }
    positions.needsUpdate = true;
    mesh.geometry.computeVertexNormals();
  });
}

function updateLeaves(time) {
  leafParticles.forEach((leaf) => {
    const ud = leaf.userData;

    // Update position
    leaf.position.x = ud.baseX + Math.sin(time * ud.swaySpeed + ud.swayPhase) * ud.swayAmplitude * 20;
    leaf.position.y += ud.velocity.y;
    leaf.position.z += ud.velocity.z;

    // Rotation
    leaf.rotation.x += ud.rotationSpeed.x;
    leaf.rotation.y += ud.rotationSpeed.y;
    leaf.rotation.z += ud.rotationSpeed.z;

    // Reset if falls below desk
    if (leaf.position.y < CONFIG.deskY) {
      leaf.position.set(
        (Math.random() - 0.5) * 6,
        3 + Math.random() * 2,
        CONFIG.windowZ + Math.random() * 2
      );
      ud.baseX = leaf.position.x;
      ud.velocity.y = -0.002 - Math.random() * 0.003;
    }
  });
}

function updateBirds(time) {
  if (!windowGroup || !windowGroup.userData.viewGroup) return;
  const viewGroup = windowGroup.userData.viewGroup;

  viewGroup.children.forEach((child) => {
    if (child.userData && child.userData.baseX !== undefined) {
      const ud = child.userData;
      child.position.x = ud.baseX + Math.sin(time * ud.speed + ud.phase) * ud.amplitude * 3;
      child.position.y = ud.baseY + Math.sin(time * ud.speed * 0.7 + ud.phase) * ud.amplitude;

      // Wing flap
      const flapAngle = Math.sin(time * 12 + ud.phase) * 0.3;
      if (child.userData.leftWing) {
        child.userData.leftWing.rotation.y = flapAngle;
        child.userData.rightWing.rotation.y = -flapAngle;
      }
    }
  });
}

// ─── Resize ───────────────────────────────────────────────────────────────────

function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;

  // Adjust FOV for mobile portrait
  if (w < h && w < 600) {
    camera.fov = 65;
  } else {
    camera.fov = 50;
  }

  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}

// ─── Main Loop ────────────────────────────────────────────────────────────────

function animate() {
  requestAnimationFrame(animate);

  const time = clock.getElapsedTime();

  updateCameraAnimation();
  updateCurtains(time);
  updateLeaves(time);
  updateBirds(time);

  renderer.render(scene, camera);
}

// ─── Entry Point ──────────────────────────────────────────────────────────────

if (init()) {
  animate();
} else {
  renderer = null;
}

// Export for testing
export { init, cameraState, focusedObject, interactiveObjects, CONFIG, getCameraPosition, getFocusedObject, getRenderer };

function getCameraPosition() {
  return camera ? camera.position.clone() : null;
}

function getFocusedObject() {
  return focusedObject;
}

function getRenderer() {
  return renderer;
}
