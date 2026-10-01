import * as THREE from '../vendor/three.module.js';

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .8, ...extra });
const oak = mat('#855032');
const darkOak = mat('#4d2c20');
const brass = mat('#bb8d44', { metalness: .65, roughness: .33 });
const paper = mat('#f8e8cc', { side: THREE.DoubleSide });
const ink = mat('#493a34');

export function makeScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#a9b5a9');
  scene.fog = new THREE.Fog('#b5ac91', 15, 34);
  const targets = {};
  const animated = [];
  const ambient = new THREE.HemisphereLight('#fff0d0', '#48342d', 2.3);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight('#ffca80', 3.4);
  sun.position.set(-4, 8, -5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -9; sun.shadow.camera.right = 9;
  sun.shadow.camera.top = 9; sun.shadow.camera.bottom = -9;
  sun.shadow.bias = -.0003;
  scene.add(sun);

  function box(parent, w, h, d, material, x, y, z, angle = 0) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z); mesh.rotation.y = angle;
    mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh);
    return mesh;
  }
  function cylinder(parent, r1, r2, h, material, x, y, z, sides = 32) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, sides), material);
    mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh);
    return mesh;
  }
  function canvasTexture(draw, width = 512, height = 512) {
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d'); draw(ctx, width, height);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    return texture;
  }
  function textTexture(lines, background = '#f7e9d0', color = '#514034') {
    return canvasTexture((ctx, w, h) => {
      ctx.fillStyle = background; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = color;
      lines.forEach(([text, x, y, size, font = 'Georgia']) => {
        ctx.font = `${size}px ${font}`; ctx.fillText(text, x, y);
      });
    });
  }
  function plane(parent, width, height, texture, x, y, z, facingUp = false) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }));
    mesh.position.set(x, y, z);
    if (facingUp) mesh.rotation.x = -Math.PI / 2;
    parent.add(mesh);
    return mesh;
  }

  box(scene, 40, .15, 38, mat('#978676'), 0, -.17, 0);
  box(scene, 15, 8, .23, mat('#d5c4a3'), 0, 3.65, -4.55);
  box(scene, 9, 7, .15, mat('#d0b993'), -7, 3.5, 0);
  box(scene, 9, 7, .15, mat('#d0b993'), 7, 3.5, 0);
  box(scene, 11, .18, .55, mat('#ead3a7'), 0, 2.54, -4.03);

  const desk = new THREE.Group(); scene.add(desk);
  box(desk, 7.4, .22, 3.55, oak, 0, .82, .25);
  box(desk, 7.5, .075, 3.66, darkOak, 0, .72, .25);
  box(desk, 7.1, .37, .12, darkOak, 0, .52, 1.91);
  box(desk, 7.1, .37, .12, darkOak, 0, .52, -1.41);
  for (const x of [-3.45, 3.45]) {
    for (const z of [-1.25, 1.7]) {
      box(desk, .24, .75, .24, darkOak, x, .35, z);
      cylinder(desk, .16, .19, .12, brass, x, .47, z);
    }
    box(desk, .045, .22, 3.15, brass, x, .53, .25);
  }
  for (let i = 0; i < 12; i++) {
    const x = -3.25 + i * .59;
    box(desk, .016, .16, .09, brass, x, .52, 1.985);
  }
  for (let i = 0; i < 15; i++) {
    const streak = box(desk, .012, .002, 2.7, mat(i % 3 ? '#ad7550' : '#5d3627', { transparent: true, opacity: .27 }), -3.3 + i * .45, .936, .2);
    streak.rotation.y = .015 * i;
  }

  const windowGroup = new THREE.Group(); scene.add(windowGroup); targets.window = windowGroup;
  const outdoor = canvasTexture((ctx, w, h) => {
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#8baabe'); sky.addColorStop(.49, '#efcd91'); sky.addColorStop(1, '#65785a');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#fff2c5'; ctx.beginPath(); ctx.arc(380, 155, 42, 0, 7); ctx.fill();
    for (let row = 0; row < 4; row++) {
      for (let i = 0; i < 24; i++) {
        const x = i * 25 - 20 + (row % 2) * 12;
        const y = 295 + row * 48 + Math.sin(i * 1.4 + row) * 19;
        ctx.fillStyle = ['#716944', '#aa713b', '#b56531', '#536442'][((i * 7 + row * 3) % 4)];
        ctx.beginPath(); ctx.arc(x, y, 17 + row * 7, 0, 7); ctx.fill();
      }
    }
  });
  plane(windowGroup, 6.6, 3.6, outdoor, 0, 3.94, -4.09);
  const frame = mat('#eee0bc');
  for (const x of [-3.48, 3.48]) box(windowGroup, .19, 3.95, .24, frame, x, 3.88, -3.92);
  for (const y of [1.94, 5.84]) box(windowGroup, 7.1, .19, .24, frame, 0, y, -3.92);
  box(windowGroup, .09, 3.75, .18, frame, 0, 3.87, -3.8);
  box(windowGroup, 7, .07, .18, frame, 0, 3.95, -3.8);
  const sash = new THREE.Group(); windowGroup.add(sash);
  sash.position.set(.08, 0, -.1); sash.rotation.y = -.18;
  box(sash, 3.24, .12, .13, frame, 1.62, 5.64, -3.65);
  box(sash, 3.24, .12, .13, frame, 1.62, 2.16, -3.65);
  box(sash, .12, 3.55, .13, frame, 3.19, 3.9, -3.65);
  cylinder(sash, .042, .042, .3, brass, 3, 3.85, -3.45);
  for (const side of [-1, 1]) {
    const curtain = new THREE.Group(); windowGroup.add(curtain);
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(.88, 3.7, 12, 20), mat('#c5ad83', { side: THREE.DoubleSide, transparent: true, opacity: .94 }));
    const p = cloth.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i);
      p.setZ(i, Math.sin(x * 17) * .07 + (1 - y / 3.7) * Math.sin(y * 1.4) * .08);
    }
    cloth.geometry.computeVertexNormals(); curtain.add(cloth);
    curtain.position.set(side * 3.03, 3.88, -3.59);
    animated.push(t => { curtain.rotation.y = Math.sin(t * .75 + side) * .065; });
    box(windowGroup, .13, 3.86, .12, brass, side * 3.53, 3.89, -3.45);
  }
  for (let i = 0; i < 5; i++) {
    const bird = new THREE.Group(); windowGroup.add(bird);
    const wings = mat('#393c34', { side: THREE.DoubleSide });
    for (const sign of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.ConeGeometry(.09, .26, 3), wings);
      wing.position.x = sign * .11; wing.rotation.z = sign * 1.04; bird.add(wing);
    }
    bird.position.set(-2 + i * .85, 4.58 + Math.sin(i * 3) * .42, -3.99);
    bird.scale.setScalar(.65 + i * .13);
    animated.push(t => { bird.position.x = -2 + i * .85 + Math.sin(t * .35 + i) * .12; bird.rotation.z = Math.sin(t * 3 + i) * .07; });
  }

  const laptop = new THREE.Group(); scene.add(laptop); targets.laptop = laptop;
  box(laptop, 2.38, .085, 1.4, mat('#343c40', { metalness: .55 }), 1.47, 1.02, -.6);
  box(laptop, 2.15, .008, .88, mat('#20292c'), 1.47, 1.07, -.78);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 12; c++) box(laptop, .125, .012, .12, mat('#636e70'), .44 + c * .185, 1.081, -1.12 + r * .19);
  box(laptop, .53, .008, .32, mat('#596364'), 1.47, 1.085, -.07);
  const lid = new THREE.Group(); laptop.add(lid);
  lid.position.set(1.47, 1.08, -1.31); lid.rotation.x = -.13;
  box(lid, 2.36, 1.48, .075, mat('#293133', { metalness: .5 }), 0, .74, 0);
  const screenTexture = canvasTexture((ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#144866'); g.addColorStop(.45, '#4f779b'); g.addColorStop(1, '#c6a68f');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 7; i++) {
      ctx.fillStyle = `rgba(226,234,236,${.12 + i * .025})`;
      ctx.beginPath(); ctx.ellipse(300 - i * 43, 300 + i * 24, 140 + i * 22, 44 + i * 12, -.6, 0, 7); ctx.fill();
    }
    ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.shadowColor = '#17283c'; ctx.shadowBlur = 12;
    ctx.font = '76px system-ui'; ctx.fillText('09:41', 256, 202);
    ctx.font = '23px system-ui'; ctx.fillText('Четверг, 1 октября', 256, 250);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff88'; ctx.fillRect(120, 350, 272, 47);
    ctx.fillStyle = '#27394b'; ctx.textAlign = 'left'; ctx.font = '18px system-ui'; ctx.fillText('Пароль', 139, 381);
  });
  plane(lid, 2.18, 1.32, screenTexture, 0, .74, .043);

  const notebook = new THREE.Group(); scene.add(notebook); targets.notebook = notebook;
  box(notebook, 2.5, .065, 1.72, mat('#665044'), -.4, 1.001, 1.03, -.13);
  for (const x of [-1.02, .22]) {
    box(notebook, 1.23, .035, 1.61, paper, x, 1.05, 1.03, -.13);
    const writing = textTexture(x < 0 ? [['OCTOBER NOTES', 48, 78, 34], ['little things to remember', 48, 148, 22], ['morning light / warm coffee', 48, 235, 20], ['a walk among the trees', 48, 290, 20], ['slow down & breathe', 48, 346, 20]] : [['TODAY', 55, 80, 43], ['01 / 10', 55, 143, 27], ['The air feels golden.', 55, 240, 23], ['New ideas begin here.', 55, 300, 23]]);
    const page = plane(notebook, 1.19, 1.55, writing, x, 1.073, 1.03, true);
    page.rotation.y = -.13;
  }
  box(notebook, .035, .055, 1.63, darkOak, -.4, 1.078, 1.03);
  const pen = cylinder(notebook, .025, .025, 1.18, mat('#294447', { metalness: .3 }), 1.12, 1.08, 1.48, 12);
  pen.rotation.x = Math.PI / 2; pen.rotation.z = -.28;

  const calendar = new THREE.Group(); scene.add(calendar); targets.calendar = calendar;
  box(calendar, 1.43, .12, .83, darkOak, -2.27, 1.015, -.38);
  const backing = box(calendar, 1.24, 1.18, .08, mat('#eeeeea'), -2.27, 1.66, -.62);
  backing.rotation.x = -.17;
  const date = textTexture([['ОКТЯБРЬ', 70, 82, 35, 'sans-serif'], ['01', 155, 321, 205], ['ЧЕТВЕРГ', 115, 413, 39, 'sans-serif']], '#f6efe3', '#493b34');
  const datePlane = plane(calendar, 1.19, 1.1, date, -2.27, 1.67, -.565);
  datePlane.rotation.x = -.17;
  for (const x of [-2.65, -1.89]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.065, .017, 8, 20), brass);
    ring.position.set(x, 2.27, -.54); calendar.add(ring);
  }

  cylinder(scene, .31, .27, .33, mat('#e8ddc4'), 2.86, 1.11, 1.06);
  cylinder(scene, .26, .26, .006, mat('#57372a'), 2.86, 1.285, 1.06);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(.18, .045, 8, 24), mat('#e8ddc4'));
  handle.position.set(3.21, 1.16, 1.06); handle.rotation.y = Math.PI / 2; scene.add(handle);
  for (let i = 0; i < 9; i++) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(.085, 7, 4), mat(['#ac7034', '#cc9248', '#95502e'][i % 3]));
    leaf.scale.set(1.6, .12, .8);
    const x = (i % 5) * 1.4 - 2.9;
    const z = i < 5 ? -2.1 : 2.25;
    leaf.position.set(x, 1.12 + i * .12, z);
    leaf.rotation.y = i * 1.7;
    scene.add(leaf);
    animated.push(t => { leaf.position.y = 1.12 + i * .12 + Math.sin(t * .8 + i * 2) * .14; leaf.rotation.y += .004; });
  }
  return { scene, targets, update(t) { animated.forEach(fn => fn(t)); } };
}
