// The room shell: floor, back wall (with a window opening), side walls and a
// rug.  Everything is static, so it is built once and disposed as a unit.

import { THREE } from "../core/three-import.js";
import { WORLD } from "./config.js";
import { box, mergeParts, part } from "./geo.js";

export function buildRoom(mats) {
  const group = new THREE.Group();
  group.name = "room";

  const roomWidth = 8;
  const roomHeight = 4;
  // Deep enough that the portrait home camera (z ~ 6.6) still stands over
  // the floor and between the side walls.
  const roomDepth = 16;

  const floorGeo = new THREE.PlaneGeometry(roomWidth, roomDepth);
  const floor = new THREE.Mesh(floorGeo, mats.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, -1);
  floor.receiveShadow = true;
  group.add(floor);

  const win = WORLD.window;
  const wallZ = win.wallZ;
  const openingW = 2.1;
  const openingH = 1.9;
  const openingBottom = 1.1; // world Y of window opening bottom

  const z = wallZ;
  const t = 0.16;

  const sideLeft = roomWidth / 2 - openingW / 2;

  const parts = [
    // Wall above the opening.
    part(box(roomWidth, roomHeight - (openingBottom + openingH), t), {
      position: [0, (openingBottom + openingH + roomHeight) / 2, z],
    }),
    // Wall below the opening.
    part(box(roomWidth, openingBottom, t), {
      position: [0, openingBottom / 2, z],
    }),
    // Wall left of the opening.
    part(box(sideLeft, openingH, t), {
      position: [-openingW / 2 - sideLeft / 2, openingBottom + openingH / 2, z],
    }),
    // Wall right of the opening.
    part(box(sideLeft, openingH, t), {
      position: [openingW / 2 + sideLeft / 2, openingBottom + openingH / 2, z],
    }),
    // Side return walls to sell the depth of the room.
    part(box(t, roomHeight, roomDepth), {
      position: [-roomWidth / 2, roomHeight / 2, z + roomDepth / 2 - 0.5],
    }),
    part(box(t, roomHeight, roomDepth), {
      position: [roomWidth / 2, roomHeight / 2, z + roomDepth / 2 - 0.5],
    }),
    // Ceiling.
    part(box(roomWidth, t, roomDepth), {
      position: [0, roomHeight, z + roomDepth / 2 - 0.5],
    }),
  ];

  const walls = new THREE.Mesh(mergeParts(parts), mats.wall);
  walls.receiveShadow = true;
  group.add(walls);

  // Warm rug under the desk.
  const rug = new THREE.Mesh(new THREE.CircleGeometry(2.1, 48), makeRugMaterial());
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(0.1, 0.012, 0.7);
  rug.receiveShadow = true;
  group.add(rug);

  return group;
}

function makeRugMaterial() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#8a5a3a";
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = "rgba(240,215,170,0.5)";
  ctx.lineWidth = 6;
  ctx.strokeRect(14, 14, 228, 228);
  ctx.strokeStyle = "rgba(60,35,20,0.4)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 0; i < 256; i += 32) {
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 256);
    ctx.moveTo(0, i);
    ctx.lineTo(256, i);
  }
  ctx.stroke();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 });
}
