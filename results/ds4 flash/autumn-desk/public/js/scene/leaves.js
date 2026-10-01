// Falling autumn leaves drifting through the room.
//
// A lightweight particle field: a fixed pool of leaf meshes recycled by
// wrapping them back to the top when they fall out of view.  No allocations
// happen per frame.

import { THREE } from "../core/three-import.js";
import { leafGeometry } from "./geo.js";

export function buildLeaves(mats) {
  const group = new THREE.Group();
  group.name = "leaves";

  const COUNT = 26;
  const geometry = leafGeometry(0.16, 0.09, 0.04);
  const variants = mats.leafVariants;
  const leaves = [];
  const random = mulberry(2024);

  const bounds = {
    minX: -2.6, maxX: 2.6,
    minY: 0.4, maxY: 3.4,
    minZ: -1.5, maxZ: 1.6,
  };

  for (let i = 0; i < COUNT; i++) {
    const mesh = new THREE.Mesh(geometry, variants[i % variants.length]);
    const state = {
      x: random() * (bounds.maxX - bounds.minX) + bounds.minX,
      y: random() * (bounds.maxY - bounds.minY) + bounds.minY,
      z: random() * (bounds.maxZ - bounds.minZ) + bounds.minZ,
      fall: 0.08 + random() * 0.14,
      sway: 0.3 + random() * 0.6,
      phase: random() * Math.PI * 2,
      spin: (random() - 0.5) * 1.6,
      rotX: random() * Math.PI,
      rotY: random() * Math.PI,
    };
    leaves.push({ mesh, state });
    group.add(mesh);
  }

  const update = (t, dt) => {
    for (const { mesh, state } of leaves) {
      state.y -= state.fall * dt;
      state.x += Math.sin(t * state.sway + state.phase) * 0.25 * dt;
      state.z += Math.cos(t * state.sway * 0.7 + state.phase) * 0.12 * dt;
      state.rotX += state.spin * dt;
      state.rotY += state.spin * 0.6 * dt;

      if (state.y < bounds.minY) {
        state.y = bounds.maxY;
        state.x = Math.random() * (bounds.maxX - bounds.minX) + bounds.minX;
        state.z = Math.random() * (bounds.maxZ - bounds.minZ) + bounds.minZ;
      }
      if (state.x < bounds.minX) state.x = bounds.maxX;
      if (state.x > bounds.maxX) state.x = bounds.minX;
      if (state.z < bounds.minZ) state.z = bounds.maxZ;
      if (state.z > bounds.maxZ) state.z = bounds.minZ;

      mesh.position.set(state.x, state.y, state.z);
      mesh.rotation.set(state.rotX, state.rotY, Math.sin(t * state.sway) * 0.5);
    }
  };

  update(0, 0);
  group.userData.update = update;
  return group;
}

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
