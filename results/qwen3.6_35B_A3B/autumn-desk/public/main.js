import * as THREE from "./vendor/three.module.js";

// ============================================================
// Configuration
// ============================================================
const CONFIG = {
  camera: {
    fov: 45,
    near: 0.1,
    far: 100,
    homePos: new THREE.Vector3(2.5, 2.2, 3.5),
    homeTarget: new THREE.Vector3(0, 0.6, -0.5),
    focusDuration: 800,
  },
  lights: {
    sunIntensity: 3.0,
    ambientIntensity: 0.4,
  },
  leaves: { count: 40 },
};

// ============================================================
// Renderer & Scene
// ============================================================
let renderer, scene, camera, clock;
let raycaster, mouse;
let interactiveObjects = {};
let focusState = {
  active: false,
  targetObj: null,
  startPos: null,
  startTarget: null,
  startTime: null,
  retargeting: false,
};

// ============================================================
// Curtain animation
// ============================================================
let curtains = [];
let fallingLeaves = [];
let birds = [];
let laptopScreenTexture;
let laptopPasswordInput = "";

// ============================================================
// Init
// ============================================================
function init() {
  const canvas = document.createElement("canvas");
  document.getElementById("webgl-canvas").replaceWith(canvas);
  canvas.id = "webgl-canvas";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.display = "block";

  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  if (!renderer.capabilities.isWebGL2) {
    showWebGLError();
    return;
  }

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87CEEB);
  scene.fog = new THREE.Fog(0xC4A882, 15, 40);

  camera = new THREE.PerspectiveCamera(
    CONFIG.camera.fov,
    window.innerWidth / window.innerHeight,
    CONFIG.camera.near,
    CONFIG.camera.far
  );
  camera.position.copy(CONFIG.camera.homePos);
  camera.lookAt(CONFIG.camera.homeTarget);

  clock = new THREE.Clock();
  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();

  setupLights();
  buildScene();
  setupEvents();
  animate();
}

function showWebGLError() {
  const container = document.getElementById("container");
  container.innerHTML =
    '<div style="position:fixed;top:0;left:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#1a1a2e;color:#e0d5c1;font-family:sans-serif;font-size:1.5em;z-index:9999;"><div style="text-align:center;padding:2em;"><h1>WebGL не поддерживается</h1><p>Ваш браузер не поддерживает WebGL. Пожалуйста, используйте современный браузер.</p></div></div>';
}

// ============================================================
// Lights
// ============================================================
function setupLights() {
  const ambient = new THREE.AmbientLight(0xffeedd, CONFIG.lights.ambientIntensity);
  scene.add(ambient);

  const hemi = new THREE.HemisphereLight(0xfff4e0, 0x8b7355, 0.3);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffd699, CONFIG.lights.sunIntensity);
  sun.position.set(-3, 5, -4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 20;
  sun.shadow.camera.left = -5;
  sun.shadow.camera.right = 5;
  sun.shadow.camera.top = 5;
  sun.shadow.camera.bottom = -5;
  sun.shadow.bias = -0.001;
  scene.add(sun);

  const fill = new THREE.DirectionalLight(0xffe4c4, 0.5);
  fill.position.set(2, 3, 2);
  scene.add(fill);
}

// ============================================================
// Materials
// ============================================================
function createWoodMaterial(color) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 256, 256);

  // Wood grain
  for (let i = 0; i < 60; i++) {
    ctx.strokeStyle = `rgba(60,40,20,${0.05 + Math.random() * 0.1})`;
    ctx.lineWidth = 0.5 + Math.random() * 2;
    ctx.beginPath();
    const y = Math.random() * 256;
    ctx.moveTo(0, y);
    for (let x = 0; x < 256; x += 10) {
      ctx.lineTo(x, y + Math.sin(x * 0.05) * 3 + (Math.random() - 0.5) * 2);
    }
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  texture.colorSpace = THREE.SRGBColorSpace;

  const mat = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.7,
    metalness: 0.05,
  });
  return mat;
}

function createCarvedWoodMaterial() {
  const base = createWoodMaterial("#8B6914");
  const mat = new THREE.MeshStandardMaterial({
    map: base.map,
    roughness: 0.6,
    metalness: 0.1,
    color: 0x9B7B3A,
  });
  return mat;
}

// ============================================================
// Scene building
// ============================================================
function buildScene() {
  buildFloor();
  buildWall();
  buildWindow();
  buildCurtains();
  buildDesk();
  buildLaptop();
  buildNotebook();
  buildCalendar();
  buildDecorations();
  buildFallingLeaves();
  buildBirds();
  buildOutsideView();
}

// ============================================================
// Floor
// ============================================================
function buildFloor() {
  const floorGeo = new THREE.PlaneGeometry(10, 10);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x8B7355,
    roughness: 0.9,
    metalness: 0.0,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.01;
  floor.receiveShadow = true;
  scene.add(floor);
}

// ============================================================
// Back wall
// ============================================================
function buildWall() {
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0xF5E6D3,
    roughness: 0.95,
    metalness: 0.0,
  });

  // Back wall with window hole (built from sections)
  const wallGroup = new THREE.Group();

  // Left section
  const leftWall = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 3.5, 0.2),
    wallMat
  );
  leftWall.position.set(-2.75, 1.75, -3);
  leftWall.castShadow = true;
  leftWall.receiveShadow = true;
  wallGroup.add(leftWall);

  // Right section
  const rightWall = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 3.5, 0.2),
    wallMat
  );
  rightWall.position.set(2.75, 1.75, -3);
  rightWall.castShadow = true;
  rightWall.receiveShadow = true;
  wallGroup.add(rightWall);

  // Top section above window
  const topWall = new THREE.Mesh(
    new THREE.BoxGeometry(3, 0.5, 0.2),
    wallMat
  );
  topWall.position.set(0, 3.25, -3);
  topWall.castShadow = true;
  topWall.receiveShadow = true;
  wallGroup.add(topWall);

  // Bottom section below window
  const bottomWall = new THREE.Mesh(
    new THREE.BoxGeometry(3, 0.5, 0.2),
    wallMat
  );
  bottomWall.position.set(0, 0.25, -3);
  bottomWall.castShadow = true;
  bottomWall.receiveShadow = true;
  wallGroup.add(bottomWall);

  // Side walls
  const sideWallL = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 3.5, 6),
    wallMat
  );
  sideWallL.position.set(-4, 1.75, 0);
  sideWallL.castShadow = true;
  sideWallL.receiveShadow = true;
  wallGroup.add(sideWallL);

  const sideWallR = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 3.5, 6),
    wallMat
  );
  sideWallR.position.set(4, 1.75, 0);
  sideWallR.castShadow = true;
  sideWallR.receiveShadow = true;
  wallGroup.add(sideWallR);

  scene.add(wallGroup);
}

// ============================================================
// Window
// ============================================================
function buildWindow() {
  const windowGroup = new THREE.Group();
  windowGroup.userData.type = "window";
  windowGroup.userData.interactive = true;
  windowGroup.userData.focusPos = new THREE.Vector3(0, 1.5, -1.2);
  windowGroup.userData.focusTarget = new THREE.Vector3(0, 1.2, -3);

  const frameMat = new THREE.MeshStandardMaterial({
    color: 0xF5F5F0,
    roughness: 0.5,
    metalness: 0.1,
  });

  // Window frame
  const frameThickness = 0.08;

  // Top frame
  const topFrame = new THREE.Mesh(
    new THREE.BoxGeometry(3.1, frameThickness, 0.15),
    frameMat
  );
  topFrame.position.set(0, 2.95, -2.92);
  topFrame.castShadow = true;
  windowGroup.add(topFrame);

  // Bottom frame
  const bottomFrame = new THREE.Mesh(
    new THREE.BoxGeometry(3.1, frameThickness, 0.15),
    frameMat
  );
  bottomFrame.position.set(0, 0.55, -2.92);
  bottomFrame.castShadow = true;
  windowGroup.add(bottomFrame);

  // Left frame
  const leftFrame = new THREE.Mesh(
    new THREE.BoxGeometry(frameThickness, 2.5, 0.15),
    frameMat
  );
  leftFrame.position.set(-1.45, 1.75, -2.92);
  leftFrame.castShadow = true;
  windowGroup.add(leftFrame);

  // Right frame
  const rightFrame = new THREE.Mesh(
    new THREE.BoxGeometry(frameThickness, 2.5, 0.15),
    frameMat
  );
  rightFrame.position.set(1.45, 1.75, -2.92);
  rightFrame.castShadow = true;
  windowGroup.add(rightFrame);

  // Center vertical divider
  const centerV = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 2.45, 0.12),
    frameMat
  );
  centerV.position.set(0, 1.75, -2.93);
  windowGroup.add(centerV);

  // Center horizontal divider
  const centerH = new THREE.Mesh(
    new THREE.BoxGeometry(2.95, 0.05, 0.12),
    frameMat
  );
  centerH.position.set(0, 1.75, -2.93);
  windowGroup.add(centerH);

  // Window sill
  const sill = new THREE.Mesh(
    new THREE.BoxGeometry(3.5, 0.06, 0.3),
    frameMat
  );
  sill.position.set(0, 0.52, -2.8);
  sill.castShadow = true;
  sill.receiveShadow = true;
  windowGroup.add(sill);

  // Glass panes (semi-transparent)
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xaaddff,
    transparent: true,
    opacity: 0.15,
    roughness: 0.05,
    metalness: 0.0,
    transmission: 0.9,
    thickness: 0.01,
  });

  // Left pane
  const leftPane = new THREE.Mesh(
    new THREE.PlaneGeometry(1.35, 1.15),
    glassMat
  );
  leftPane.position.set(-0.725, 1.75, -2.94);
  windowGroup.add(leftPane);

  // Right pane
  const rightPane = new THREE.Mesh(
    new THREE.PlaneGeometry(1.35, 1.15),
    glassMat
  );
  rightPane.position.set(0.725, 1.75, -2.94);
  windowGroup.add(rightPane);

  // Top pane
  const topPane = new THREE.Mesh(
    new THREE.PlaneGeometry(1.35, 1.15),
    glassMat
  );
  topPane.position.set(-0.725, 2.375, -2.94);
  windowGroup.add(topPane);

  // Bottom pane
  const bottomPane = new THREE.Mesh(
    new THREE.PlaneGeometry(1.35, 1.15),
    glassMat
  );
  bottomPane.position.set(0.725, 1.125, -2.94);
  windowGroup.add(bottomPane);

  scene.add(windowGroup);
  interactiveObjects.window = windowGroup;
}

// ============================================================
// Outside view (visible through window)
// ============================================================
function buildOutsideView() {
  // Autumn sky backdrop
  const skyGeo = new THREE.PlaneGeometry(20, 10);
  const skyCanvas = document.createElement("canvas");
  skyCanvas.width = 512;
  skyCanvas.height = 256;
  const skyCtx = skyCanvas.getContext("2d");
  const skyGrad = skyCtx.createLinearGradient(0, 0, 0, 256);
  skyGrad.addColorStop(0, "#87CEEB");
  skyGrad.addColorStop(0.4, "#B0D4F1");
  skyGrad.addColorStop(0.7, "#F0E68C");
  skyGrad.addColorStop(1, "#DEB887");
  skyCtx.fillStyle = skyGrad;
  skyCtx.fillRect(0, 0, 512, 256);

  // Autumn trees silhouette
  skyCtx.fillStyle = "#8B6914";
  for (let i = 0; i < 8; i++) {
    const x = 50 + i * 60 + Math.random() * 30;
    const h = 40 + Math.random() * 60;
    skyCtx.beginPath();
    skyCtx.ellipse(x, 256 - h / 2, 20 + Math.random() * 15, h / 2, 0, 0, Math.PI * 2);
    skyCtx.fill();
  }

  const skyTex = new THREE.CanvasTexture(skyCanvas);
  skyTex.colorSpace = THREE.SRGBColorSpace;
  const skyMat = new THREE.MeshBasicMaterial({ map: skyTex });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.position.set(0, 2, -8);
  scene.add(sky);

  // Ground outside
  const outGround = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 10),
    new THREE.MeshStandardMaterial({ color: 0x8B7355, roughness: 1 })
  );
  outGround.rotation.x = -Math.PI / 2;
  outGround.position.set(0, -0.5, -6);
  scene.add(outGround);
}

// ============================================================
// Curtains
// ============================================================
function buildCurtains() {
  const curtainMat = new THREE.MeshStandardMaterial({
    color: 0xF5E1C8,
    roughness: 0.8,
    metalness: 0.0,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.85,
  });

  // Left curtain
  const leftCurtainGeo = createCurtainGeometry(0.8, 2.2, 12, 8);
  const leftCurtain = new THREE.Mesh(leftCurtainGeo, curtainMat);
  leftCurtain.position.set(-1.3, 1.8, -2.85);
  leftCurtain.castShadow = true;
  scene.add(leftCurtain);
  curtains.push({ mesh: leftCurtain, phase: 0, side: 1 });

  // Right curtain
  const rightCurtainGeo = createCurtainGeometry(0.8, 2.2, 12, 8);
  const rightCurtain = new THREE.Mesh(rightCurtainGeo, curtainMat);
  rightCurtain.position.set(1.3, 1.8, -2.85);
  rightCurtain.castShadow = true;
  scene.add(rightCurtain);
  curtains.push({ mesh: rightCurtain, phase: Math.PI, side: -1 });

  // Curtain rod
  const rodMat = new THREE.MeshStandardMaterial({
    color: 0x8B7355,
    roughness: 0.4,
    metalness: 0.3,
  });
  const rod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, 3.2, 8),
    rodMat
  );
  rod.rotation.z = Math.PI / 2;
  rod.position.set(0, 3.05, -2.85);
  scene.add(rod);
}

function createCurtainGeometry(width, height, segW, segH) {
  const geo = new THREE.PlaneGeometry(width, height, segW, segH);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const fold = Math.sin((x / width) * Math.PI * 6) * 0.06;
    pos.setZ(i, fold + Math.sin(y * 2) * 0.02);
  }
  geo.computeVertexNormals();
  return geo;
}

// ============================================================
// Desk
// ============================================================
function buildDesk() {
  const deskGroup = new THREE.Group();
  const woodMat = createCarvedWoodMaterial();

  // Table top
  const topGeo = new THREE.BoxGeometry(3, 0.08, 1.5);
  const top = new THREE.Mesh(topGeo, woodMat);
  top.position.set(0, 0.75, 0);
  top.castShadow = true;
  top.receiveShadow = true;
  deskGroup.add(top);

  // Legs
  const legGeo = new THREE.BoxGeometry(0.1, 0.75, 0.1);
  const legPositions = [
    [-1.35, 0.375, -0.6],
    [1.35, 0.375, -0.6],
    [-1.35, 0.375, 0.6],
    [1.35, 0.375, 0.6],
  ];
  for (const [x, y, z] of legPositions) {
    const leg = new THREE.Mesh(legGeo, woodMat);
    leg.position.set(x, y, z);
    leg.castShadow = true;
    deskGroup.add(leg);
  }

  // Carved edge detail - front
  const carveGeo = new THREE.BoxGeometry(3, 0.06, 0.04);
  const frontCarve = new THREE.Mesh(carveGeo, woodMat);
  frontCarve.position.set(0, 0.71, 0.75);
  frontCarve.castShadow = true;
  deskGroup.add(frontCarve);

  // Decorative carved patterns on front panel
  for (let i = 0; i < 5; i++) {
    const patternGeo = new THREE.TorusGeometry(0.06, 0.015, 8, 16, Math.PI);
    const pattern = new THREE.Mesh(patternGeo, woodMat);
    pattern.position.set(-1 + i * 0.5, 0.68, 0.77);
    pattern.rotation.y = Math.PI / 2;
    pattern.castShadow = true;
    deskGroup.add(pattern);
  }

  // Side carved panels
  const sidePanelGeo = new THREE.BoxGeometry(0.04, 0.15, 1.3);
  const leftPanel = new THREE.Mesh(sidePanelGeo, woodMat);
  leftPanel.position.set(-1.48, 0.65, 0);
  leftPanel.castShadow = true;
  deskGroup.add(leftPanel);

  const rightPanel = new THREE.Mesh(sidePanelGeo, woodMat);
  rightPanel.position.set(1.48, 0.65, 0);
  rightPanel.castShadow = true;
  deskGroup.add(rightPanel);

  // Cross brace
  const braceGeo = new THREE.BoxGeometry(2.6, 0.06, 0.06);
  const brace = new THREE.Mesh(braceGeo, woodMat);
  brace.position.set(0, 0.3, 0);
  brace.castShadow = true;
  deskGroup.add(brace);

  scene.add(deskGroup);
}

// ============================================================
// Laptop
// ============================================================
function buildLaptop() {
  const laptopGroup = new THREE.Group();
  laptopGroup.userData.type = "laptop";
  laptopGroup.userData.interactive = true;
  laptopGroup.userData.focusPos = new THREE.Vector3(0.8, 1.1, 0.5);
  laptopGroup.userData.focusTarget = new THREE.Vector3(0.8, 0.85, 0);

  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0xC0C0C0,
    roughness: 0.3,
    metalness: 0.7,
  });

  // Base
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.02, 0.4),
    bodyMat
  );
  base.position.set(0.8, 0.79, 0.3);
  base.castShadow = true;
  base.receiveShadow = true;
  laptopGroup.add(base);

  // Keyboard area
  const kbMat = new THREE.MeshStandardMaterial({
    color: 0x333333,
    roughness: 0.8,
    metalness: 0.1,
  });
  const kb = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.005, 0.25),
    kbMat
  );
  kb.position.set(0.8, 0.805, 0.35);
  laptopGroup.add(kb);

  // Screen back
  const screenBack = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.4, 0.01),
    bodyMat
  );
  screenBack.position.set(0.8, 1.0, 0.12);
  screenBack.rotation.x = 0.15;
  screenBack.castShadow = true;
  laptopGroup.add(screenBack);

  // Screen display
  laptopScreenTexture = createLaptopScreenTexture();
  const screenMat = new THREE.MeshStandardMaterial({
    map: laptopScreenTexture,
    emissive: 0x333333,
    emissiveMap: laptopScreenTexture,
    emissiveIntensity: 0.5,
    roughness: 0.2,
    metalness: 0.0,
  });
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.56, 0.36),
    screenMat
  );
  screen.position.set(0.8, 1.0, 0.125);
  screen.rotation.x = 0.15;
  laptopGroup.add(screen);

  // Screen hinge
  const hinge = new THREE.Mesh(
    new THREE.CylinderGeometry(0.01, 0.01, 0.55, 8),
    bodyMat
  );
  hinge.rotation.z = Math.PI / 2;
  hinge.position.set(0.8, 0.8, 0.12);
  laptopGroup.add(hinge);

  scene.add(laptopGroup);
  interactiveObjects.laptop = laptopGroup;
}

function createLaptopScreenTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 320;
  const ctx = canvas.getContext("2d");

  // Background - Windows 11 lock screen style
  const bgGrad = ctx.createLinearGradient(0, 0, 512, 320);
  bgGrad.addColorStop(0, "#1a1a2e");
  bgGrad.addColorStop(0.5, "#16213e");
  bgGrad.addColorStop(1, "#0f3460");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 512, 320);

  // Abstract background pattern
  ctx.globalAlpha = 0.1;
  for (let i = 0; i < 20; i++) {
    ctx.fillStyle = `hsl(${Math.random() * 60 + 200}, 70%, 50%)`;
    ctx.beginPath();
    ctx.arc(
      Math.random() * 512,
      Math.random() * 320,
      20 + Math.random() * 60,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Time
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 64px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  ctx.fillText(`${hours}:${minutes}`, 256, 100);

  // Date
  ctx.font = "24px Arial, sans-serif";
  ctx.fillStyle = "#cccccc";
  const options = { weekday: "long", year: "numeric", month: "long", day: "numeric" };
  ctx.fillText(now.toLocaleDateString("ru-RU", options), 256, 150);

  // Password field
  ctx.fillStyle = "rgba(255,255,255,0.1)";
  ctx.strokeStyle = "rgba(255,255,255,0.3)";
  ctx.lineWidth = 1;
  roundRect(ctx, 156, 190, 200, 40, 5);
  ctx.fill();
  ctx.stroke();

  // Password placeholder
  ctx.font = "16px Arial, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.fillText("Пароль", 256, 212);

  // User icon circle
  ctx.beginPath();
  ctx.arc(256, 65, 20, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.fill();
  ctx.font = "20px Arial";
  ctx.fillStyle = "#ffffff";
  ctx.fillText("👤", 256, 65);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function updateLaptopScreen() {
  if (!laptopScreenTexture) return;
  const canvas = laptopScreenTexture.image;
  const ctx = canvas.getContext("2d");

  // Redraw background
  const bgGrad = ctx.createLinearGradient(0, 0, 512, 320);
  bgGrad.addColorStop(0, "#1a1a2e");
  bgGrad.addColorStop(0.5, "#16213e");
  bgGrad.addColorStop(1, "#0f3460");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 512, 320);

  ctx.globalAlpha = 0.1;
  for (let i = 0; i < 20; i++) {
    ctx.fillStyle = `hsl(${Math.random() * 60 + 200}, 70%, 50%)`;
    ctx.beginPath();
    ctx.arc(
      Math.random() * 512,
      Math.random() * 320,
      20 + Math.random() * 60,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Time
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 64px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  ctx.fillText(`${hours}:${minutes}`, 256, 100);

  // Date
  ctx.font = "24px Arial, sans-serif";
  ctx.fillStyle = "#cccccc";
  const options = { weekday: "long", year: "numeric", month: "long", day: "numeric" };
  ctx.fillText(now.toLocaleDateString("ru-RU", options), 256, 150);

  // Password field with dots
  ctx.fillStyle = "rgba(255,255,255,0.1)";
  ctx.strokeStyle = "rgba(255,255,255,0.3)";
  ctx.lineWidth = 1;
  roundRect(ctx, 156, 190, 200, 40, 5);
  ctx.fill();
  ctx.stroke();

  // Password dots
  ctx.fillStyle = "#ffffff";
  ctx.font = "20px Arial";
  for (let i = 0; i < laptopPasswordInput.length; i++) {
    ctx.fillText("•", 236 + i * 14, 213);
  }

  // User icon
  ctx.beginPath();
  ctx.arc(256, 65, 20, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.fill();
  ctx.font = "20px Arial";
  ctx.fillStyle = "#ffffff";
  ctx.fillText("👤", 256, 65);

  laptopScreenTexture.needsUpdate = true;
}

// ============================================================
// Notebook
// ============================================================
function buildNotebook() {
  const nbGroup = new THREE.Group();
  nbGroup.userData.type = "notebook";
  nbGroup.userData.interactive = true;
  nbGroup.userData.focusPos = new THREE.Vector3(0, 1.0, 1.2);
  nbGroup.userData.focusTarget = new THREE.Vector3(0, 0.75, 0.8);

  const coverMat = new THREE.MeshStandardMaterial({
    color: 0x2C3E50,
    roughness: 0.7,
    metalness: 0.1,
  });

  const pageMat = new THREE.MeshStandardMaterial({
    color: 0xFFF8DC,
    roughness: 0.9,
    metalness: 0.0,
  });

  // Open notebook - bottom page
  const bottomPage = new THREE.Mesh(
    new THREE.BoxGeometry(0.35, 0.01, 0.25),
    pageMat
  );
  bottomPage.position.set(0, 0.755, 1.0);
  bottomPage.rotation.x = -0.1;
  bottomPage.receiveShadow = true;
  nbGroup.add(bottomPage);

  // Open notebook - top page (slightly angled)
  const topPage = new THREE.Mesh(
    new THREE.BoxGeometry(0.35, 0.01, 0.25),
    pageMat
  );
  topPage.position.set(0, 0.76, 1.0);
  topPage.rotation.x = -0.05;
  topPage.receiveShadow = true;
  nbGroup.add(topPage);

  // Cover (bottom)
  const cover = new THREE.Mesh(
    new THREE.BoxGeometry(0.37, 0.015, 0.27),
    coverMat
  );
  cover.position.set(0, 0.75, 1.0);
  cover.castShadow = true;
  nbGroup.add(cover);

  // Written lines on page
  const lineMat = new THREE.MeshStandardMaterial({
    color: 0x4444AA,
    roughness: 0.8,
  });
  for (let i = 0; i < 6; i++) {
    const line = new THREE.Mesh(
      new THREE.BoxGeometry(0.25 - Math.random() * 0.08, 0.002, 0.003),
      lineMat
    );
    line.position.set(
      -0.05 + Math.random() * 0.1,
      0.762,
      0.92 + i * 0.03
    );
    nbGroup.add(line);
  }

  // Pen
  const penMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a1a,
    roughness: 0.3,
    metalness: 0.5,
  });
  const pen = new THREE.Mesh(
    new THREE.CylinderGeometry(0.008, 0.006, 0.15, 8),
    penMat
  );
  pen.position.set(0.22, 0.78, 1.05);
  pen.rotation.z = Math.PI / 2;
  pen.rotation.y = 0.3;
  pen.castShadow = true;
  nbGroup.add(pen);

  // Pen cap
  const capMat = new THREE.MeshStandardMaterial({
    color: 0xC0C0C0,
    roughness: 0.2,
    metalness: 0.8,
  });
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.009, 0.009, 0.03, 8),
    capMat
  );
  cap.position.set(0.3, 0.78, 1.05);
  cap.rotation.z = Math.PI / 2;
  cap.rotation.y = 0.3;
  nbGroup.add(cap);

  scene.add(nbGroup);
  interactiveObjects.notebook = nbGroup;
}

// ============================================================
// Calendar
// ============================================================
function buildCalendar() {
  const calGroup = new THREE.Group();
  calGroup.userData.type = "calendar";
  calGroup.userData.interactive = true;
  calGroup.userData.focusPos = new THREE.Vector3(-1.2, 1.0, 0.8);
  calGroup.userData.focusTarget = new THREE.Vector3(-1.2, 0.85, 0.5);

  const standMat = new THREE.MeshStandardMaterial({
    color: 0x8B7355,
    roughness: 0.6,
    metalness: 0.1,
  });

  const paperMat = new THREE.MeshStandardMaterial({
    color: 0xFFFFFF,
    roughness: 0.9,
    metalness: 0.0,
  });

  // Stand base
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 0.02, 0.15),
    standMat
  );
  base.position.set(-1.2, 0.76, 0.5);
  base.castShadow = true;
  calGroup.add(base);

  // Stand arm
  const arm = new THREE.Mesh(
    new THREE.BoxGeometry(0.02, 0.15, 0.02),
    standMat
  );
  arm.position.set(-1.2, 0.84, 0.42);
  arm.rotation.x = 0.3;
  arm.castShadow = true;
  calGroup.add(arm);

  // Calendar paper
  const calCanvas = document.createElement("canvas");
  calCanvas.width = 128;
  calCanvas.height = 160;
  const calCtx = calCanvas.getContext("2d");

  // Paper background
  calCtx.fillStyle = "#FFFFFF";
  calCtx.fillRect(0, 0, 128, 160);

  // Header
  calCtx.fillStyle = "#CC0000";
  calCtx.fillRect(0, 0, 128, 30);

  // Month name
  calCtx.fillStyle = "#FFFFFF";
  calCtx.font = "bold 14px Arial";
  calCtx.textAlign = "center";
  calCtx.fillText("ОКТЯБРЬ", 64, 20);

  // Date
  calCtx.fillStyle = "#1a1a1a";
  calCtx.font = "bold 48px Arial";
  calCtx.textAlign = "center";
  const now = new Date();
  calCtx.fillText(String(now.getDate()), 64, 90);

  // Day of week
  calCtx.font = "12px Arial";
  calCtx.fillStyle = "#666666";
  const days = ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"];
  calCtx.fillText(days[now.getDay()], 64, 120);

  // Year
  calCtx.font = "10px Arial";
  calCtx.fillStyle = "#999999";
  calCtx.fillText(String(now.getFullYear()), 64, 145);

  const calTexture = new THREE.CanvasTexture(calCanvas);
  calTexture.colorSpace = THREE.SRGBColorSpace;

  const paper = new THREE.Mesh(
    new THREE.PlaneGeometry(0.18, 0.22),
    new THREE.MeshStandardMaterial({
      map: calTexture,
      roughness: 0.9,
    })
  );
  paper.position.set(-1.2, 0.95, 0.44);
  paper.rotation.x = -0.3;
  paper.castShadow = true;
  calGroup.add(paper);

  scene.add(calGroup);
  interactiveObjects.calendar = calGroup;
}

// ============================================================
// Decorations
// ============================================================
function buildDecorations() {
  // Coffee cup
  const cupMat = new THREE.MeshStandardMaterial({
    color: 0xF5F5F0,
    roughness: 0.4,
    metalness: 0.1,
  });

  const cup = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.035, 0.1, 16),
    cupMat
  );
  cup.position.set(-0.6, 0.84, 0.5);
  cup.castShadow = true;
  scene.add(cup);

  // Cup handle
  const handleGeo = new THREE.TorusGeometry(0.025, 0.005, 8, 16, Math.PI);
  const handle = new THREE.Mesh(handleGeo, cupMat);
  handle.position.set(-0.56, 0.84, 0.5);
  handle.rotation.y = Math.PI / 2;
  scene.add(handle);

  // Small book stack
  const bookColors = [0x8B4513, 0x2F4F4F, 0x800020];
  for (let i = 0; i < 3; i++) {
    const bookMat = new THREE.MeshStandardMaterial({
      color: bookColors[i],
      roughness: 0.8,
      metalness: 0.05,
    });
    const book = new THREE.Mesh(
      new THREE.BoxGeometry(0.15, 0.02, 0.2),
      bookMat
    );
    book.position.set(1.0, 0.79 + i * 0.025, -0.3);
    book.rotation.y = 0.1 * i;
    book.castShadow = true;
    book.receiveShadow = true;
    scene.add(book);
  }

  // Small dried leaf on desk
  const leafMat = new THREE.MeshStandardMaterial({
    color: 0xB8860B,
    roughness: 0.8,
    side: THREE.DoubleSide,
  });
  const leafShape = new THREE.Shape();
  leafShape.moveTo(0, 0);
  leafShape.quadraticCurveTo(0.03, 0.02, 0, 0.06);
  leafShape.quadraticCurveTo(-0.03, 0.02, 0, 0);
  const leafGeo = new THREE.ShapeGeometry(leafShape);
  const deskLeaf = new THREE.Mesh(leafGeo, leafMat);
  deskLeaf.position.set(0.5, 0.795, -0.2);
  deskLeaf.rotation.x = -Math.PI / 2;
  deskLeaf.rotation.z = 0.5;
  deskLeaf.castShadow = true;
  scene.add(deskLeaf);
}

// ============================================================
// Falling leaves
// ============================================================
function buildFallingLeaves() {
  const leafColors = [0xB8860B, 0xCD853F, 0xDEB887, 0xD2691E, 0xB22222, 0xFF4500];

  for (let i = 0; i < CONFIG.leaves.count; i++) {
    const color = leafColors[Math.floor(Math.random() * leafColors.length)];
    const mat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    });

    const size = 0.02 + Math.random() * 0.03;
    const geo = new THREE.PlaneGeometry(size, size * 1.5);

    // Leaf shape
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.quadraticCurveTo(size * 0.3, size * 0.1, 0, size * 0.6);
    shape.quadraticCurveTo(-size * 0.3, size * 0.1, 0, 0);
    const shapeGeo = new THREE.ShapeGeometry(shape);

    const leaf = new THREE.Mesh(shapeGeo, mat);
    leaf.position.set(
      (Math.random() - 0.5) * 4,
      1 + Math.random() * 3,
      -1 + (Math.random() - 0.5) * 2
    );
    leaf.rotation.set(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI
    );
    leaf.castShadow = true;

    scene.add(leaf);
    fallingLeaves.push({
      mesh: leaf,
      speed: 0.1 + Math.random() * 0.2,
      drift: (Math.random() - 0.5) * 0.5,
      rotationSpeed: (Math.random() - 0.5) * 2,
      phase: Math.random() * Math.PI * 2,
    });
  }
}

// ============================================================
// Birds
// ============================================================
function buildBirds() {
  const birdMat = new THREE.MeshStandardMaterial({
    color: 0x2F2F2F,
    roughness: 0.6,
    metalness: 0.2,
  });

  for (let i = 0; i < 3; i++) {
    const birdGroup = new THREE.Group();

    // Body
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.03, 8, 6),
      birdMat
    );
    body.scale.set(1, 0.7, 1.5);
    birdGroup.add(body);

    // Wings
    const wingGeo = new THREE.PlaneGeometry(0.12, 0.03);
    const leftWing = new THREE.Mesh(wingGeo, birdMat);
    leftWing.position.set(-0.06, 0.01, 0);
    leftWing.rotation.z = 0.3;
    birdGroup.add(leftWing);

    const rightWing = new THREE.Mesh(wingGeo, birdMat);
    rightWing.position.set(0.06, 0.01, 0);
    rightWing.rotation.z = -0.3;
    birdGroup.add(rightWing);

    birdGroup.position.set(
      (Math.random() - 0.5) * 6,
      3 + Math.random() * 2,
      -5 + (Math.random() - 0.5) * 3
    );

    scene.add(birdGroup);
    birds.push({
      group: birdGroup,
      leftWing,
      rightWing,
      speed: 0.5 + Math.random() * 0.5,
      phase: Math.random() * Math.PI * 2,
      baseY: birdGroup.position.y,
    });
  }
}

// ============================================================
// Events
// ============================================================
function setupEvents() {
  window.addEventListener("resize", onResize);
  renderer.domElement.addEventListener("pointerdown", onPointerDown);
  renderer.domElement.addEventListener("pointerup", onPointerUp);
  window.addEventListener("keydown", onKeyDown);
}

let pointerDownPos = { x: 0, y: 0 };

function onPointerDown(e) {
  pointerDownPos.x = e.clientX;
  pointerDownPos.y = e.clientY;
}

function onPointerUp(e) {
  const dx = e.clientX - pointerDownPos.x;
  const dy = e.clientY - pointerDownPos.y;
  if (Math.sqrt(dx * dx + dy * dy) > 5) return; // Dragged, not clicked

  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  const interactiveArr = Object.values(interactiveObjects);
  const intersects = raycaster.intersectObjects(interactiveArr, true);

  if (intersects.length > 0) {
    let obj = intersects[0].object;
    while (obj && !obj.userData.interactive) {
      obj = obj.parent;
    }
    if (obj && obj.userData.interactive) {
      handleObjectClick(obj);
      return;
    }
  }

  // Click on background - return home
  if (focusState.active) {
    returnHome();
  }
}

function onKeyDown(e) {
  if (e.key === "Escape") {
    if (focusState.active) {
      returnHome();
    }
  }
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// ============================================================
// Focus / Camera system
// ============================================================
function handleObjectClick(obj) {
  if (focusState.active && focusState.targetObj === obj) {
    returnHome();
    return;
  }

  const targetPos = obj.userData.focusPos;
  const targetLook = obj.userData.focusTarget;

  if (!targetPos || !targetLook) return;

  if (focusState.active && focusState.retargeting) {
    // Retarget mid-animation
    focusState.retargeting = true;
    focusState.startPos = camera.position.clone();
    focusState.startTarget = cameraTarget.clone();
    focusState.targetObj = obj;
    focusState.targetPos = targetPos;
    focusState.targetLook = targetLook;
    focusState.startTime = performance.now();
    return;
  }

  // New focus
  focusState.active = true;
  focusState.targetObj = obj;
  focusState.startPos = camera.position.clone();
  focusState.startTarget = cameraTarget.clone();
  focusState.targetPos = targetPos;
  focusState.targetLook = targetLook;
  focusState.startTime = performance.now();
  focusState.retargeting = false;

  if (obj.userData.type === "laptop") {
    updateLaptopScreen();
  }
}

let cameraTarget = new THREE.Vector3();
cameraTarget.copy(CONFIG.camera.homeTarget);

function returnHome() {
  focusState.active = false;
  focusState.startPos = camera.position.clone();
  focusState.startTarget = cameraTarget.clone();
  focusState.targetPos = CONFIG.camera.homePos;
  focusState.targetLook = CONFIG.camera.homeTarget;
  focusState.startTime = performance.now();
  focusState.targetObj = null;
  focusState.retargeting = false;
}

function updateCamera(now) {
  if (!focusState.startPos || !focusState.startTarget) return;
  const duration = CONFIG.camera.focusDuration;
  const elapsed = now - focusState.startTime;
  let t = Math.min(elapsed / duration, 1);

  // Smooth easing
  t = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  camera.position.lerpVectors(focusState.startPos, focusState.targetPos, t);
  cameraTarget.lerpVectors(focusState.startTarget, focusState.targetLook, t);
  camera.lookAt(cameraTarget);

  if (t >= 1) {
    if (!focusState.active) {
      // Home animation complete
      focusState.startPos = null;
    } else if (!focusState.retargeting) {
      // Focus animation complete
      focusState.startPos = null;
      focusState.startTarget = null;
    }
  }
}

// ============================================================
// Animation
// ============================================================
function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();
  const elapsed = clock.getElapsedTime();
  const now = performance.now();

  updateCamera(now);
  updateCurtains(elapsed);
  updateFallingLeaves(delta, elapsed);
  updateBirds(delta, elapsed);

  renderer.render(scene, camera);
}

function updateCurtains(time) {
  for (const curtain of curtains) {
    const pos = curtain.mesh.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const wave = Math.sin(x * 4 + time * 1.5 + curtain.phase) * 0.02;
      const wave2 = Math.sin(y * 2 + time * 0.8) * 0.01;
      pos.setZ(i, wave + wave2);
    }
    pos.needsUpdate = true;
    curtain.mesh.geometry.computeVertexNormals();
  }
}

function updateFallingLeaves(delta, time) {
  for (const leaf of fallingLeaves) {
    leaf.mesh.position.y -= leaf.speed * delta;
    leaf.mesh.position.x += Math.sin(time * leaf.speed + leaf.phase) * leaf.drift * delta;
    leaf.mesh.rotation.x += leaf.rotationSpeed * delta;
    leaf.mesh.rotation.z += leaf.rotationSpeed * 0.5 * delta;

    // Reset when fallen below desk
    if (leaf.mesh.position.y < 0.5) {
      leaf.mesh.position.y = 3 + Math.random() * 2;
      leaf.mesh.position.x = (Math.random() - 0.5) * 4;
      leaf.mesh.position.z = -1 + (Math.random() - 0.5) * 2;
    }
  }
}

function updateBirds(delta, time) {
  for (const bird of birds) {
    bird.group.position.x += bird.speed * delta;
    bird.group.position.y = bird.baseY + Math.sin(time * 2 + bird.phase) * 0.3;

    const wingAngle = Math.sin(time * 8 + bird.phase) * 0.4;
    bird.leftWing.rotation.z = 0.3 + wingAngle;
    bird.rightWing.rotation.z = -0.3 - wingAngle;

    // Reset when too far
    if (bird.group.position.x > 8) {
      bird.group.position.x = -8;
    }
  }
}

// ============================================================
// Start
// ============================================================
init();
