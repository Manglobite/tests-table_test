// Warm autumn lighting: a low morning sun pouring through the window, a soft
// ambient bounce and a gentle fill so the desk reads cleanly on mobile.

import { THREE } from "../core/three-import.js";
import { PALETTE } from "./config.js";

export function buildLighting() {
  const group = new THREE.Group();
  group.name = "lighting";

  const hemisphere = new THREE.HemisphereLight(0xf4e4c4, 0x6b4a2a, 0.75);
  group.add(hemisphere);

  const ambient = new THREE.AmbientLight(0xffe9cf, 0.28);
  group.add(ambient);

  // The sun sits outside the window and slightly to the left, so long shadows
  // fall across the desk toward the viewer.
  const sun = new THREE.DirectionalLight(PALETTE.sun, 2.1);
  sun.position.set(-3.2, 3.6, -4.5);
  sun.target.position.set(0.2, 1.0, 0.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 14;
  sun.shadow.camera.left = -4;
  sun.shadow.camera.right = 4;
  sun.shadow.camera.top = 4;
  sun.shadow.camera.bottom = -4;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.02;
  group.add(sun, sun.target);

  // Cool sky bounce to keep shadows from going muddy.
  const skyFill = new THREE.DirectionalLight(0xbcd6ef, 0.35);
  skyFill.position.set(2.5, 4, 3);
  group.add(skyFill);

  return group;
}

/**
 * A soft volumetric "sun shaft" plane that adds a visible beam of warm light
 * from the window across the desk.  Cheap, additive and non-interactive.
 */
export function buildSunShaft() {
  const group = new THREE.Group();
  group.name = "sun-shaft";

  const width = 1.5;
  const length = 4.2;
  const geo = new THREE.PlaneGeometry(width, length);
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, "rgba(255,236,190,0.55)");
  grad.addColorStop(0.5, "rgba(255,226,160,0.18)");
  grad.addColorStop(1, "rgba(255,226,160,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;

  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const beam = new THREE.Mesh(geo, mat);
  beam.rotation.x = -1.15;
  beam.position.set(-0.1, 1.7, 0.6);
  group.add(beam);

  group.userData.material = mat;
  return group;
}
