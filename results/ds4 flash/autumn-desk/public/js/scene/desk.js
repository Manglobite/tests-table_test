// The carved oak desk: top, apron with carved panels, turned legs and
// stretchers.  The desktop carries the interactive object anchors.

import { THREE } from "../core/three-import.js";
import { WORLD } from "./config.js";
import { box, cylinder, lathe, mergeParts, part, torus } from "./geo.js";

export function buildDesk(mats) {
  const group = new THREE.Group();
  group.name = "desk";

  const { width, depth, thickness, height, legInset } = WORLD.desk;
  const topY = height;

  // --- carcase (wood) ------------------------------------------------------
  const woodParts = [];

  // Desk top.
  woodParts.push(part(box(width, thickness, depth), { position: [0, topY, 0] }));

  // Apron under the top, inset slightly.
  const apronH = 0.18;
  const apronY = topY - thickness / 2 - apronH / 2;
  const apronW = width - legInset * 2;
  const apronD = depth - legInset * 2;
  woodParts.push(part(box(apronW, apronH, 0.05), { position: [0, apronY, -depth / 2 + legInset] }));
  woodParts.push(part(box(apronW, apronH, 0.05), { position: [0, apronY, depth / 2 - legInset] }));
  woodParts.push(part(box(0.05, apronH, apronD), { position: [-width / 2 + legInset, apronY, 0] }));
  woodParts.push(part(box(0.05, apronH, apronD), { position: [width / 2 - legInset, apronY, 0] }));

  // Turned legs (lathe profile: vase + rings).
  const legProfile = [
    [0.055, 0],
    [0.075, 0.03],
    [0.05, 0.08],
    [0.05, 0.14],
    [0.075, 0.2],
    [0.062, 0.28],
    [0.045, 0.4],
    [0.05, 0.55],
    [0.048, 0.7],
    [0.062, 0.82],
    [0.058, 0.86],
    [0.048, 0.9],
    [0.048, 1.0],
  ];
  const legGeo = lathe(legProfile, 18);
  const legH = topY - thickness / 2;
  const legX = width / 2 - legInset;
  const legZ = depth / 2 - legInset;
  // The lathe profile spans y in [0, 1]; scaling by `legH` and sitting it on
  // the floor makes the leg reach exactly the underside of the top.
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      woodParts.push(
        part(legGeo, { position: [sx * legX, 0, sz * legZ], scale: [1, legH, 1] }),
      );
    }
  }

  // Stretchers between the legs, front/back and sides.
  const stretcherY = legH * 0.28;
  woodParts.push(
    part(cylinder(0.03, 0.03, legX * 2, 12), {
      position: [0, stretcherY, -legZ],
      rotation: [0, 0, Math.PI / 2],
    }),
  );
  woodParts.push(
    part(cylinder(0.03, 0.03, legX * 2, 12), {
      position: [0, stretcherY, legZ],
      rotation: [0, 0, Math.PI / 2],
    }),
  );
  woodParts.push(
    part(cylinder(0.026, 0.026, legZ * 2, 12), {
      position: [-legX, stretcherY, 0],
      rotation: [Math.PI / 2, 0, 0],
    }),
  );
  woodParts.push(
    part(cylinder(0.026, 0.026, legZ * 2, 12), {
      position: [legX, stretcherY, 0],
      rotation: [Math.PI / 2, 0, 0],
    }),
  );

  // Carved decorative edge bead around the desktop (four slender mouldings).
  const bead = 0.022;
  woodParts.push(part(box(width + bead, bead, bead), { position: [0, topY + thickness / 2, depth / 2] }));
  woodParts.push(part(box(width + bead, bead, bead), { position: [0, topY + thickness / 2, -depth / 2] }));
  woodParts.push(part(box(bead, bead, depth + bead), { position: [width / 2, topY + thickness / 2, 0] }));
  woodParts.push(part(box(bead, bead, depth + bead), { position: [-width / 2, topY + thickness / 2, 0] }));

  const wood = new THREE.Mesh(mergeParts(woodParts), mats.deskTop);
  wood.castShadow = true;
  wood.receiveShadow = true;
  group.add(wood);

  // --- carved panels (carved material) ------------------------------------
  const carvedParts = [];

  // Front apron panel with rosette relief.
  carvedParts.push(
    part(box(apronW * 0.42, apronH * 0.7, 0.03), {
      position: [0, apronY, depth / 2 - legInset + 0.035],
    }),
  );
  carvedParts.push(
    part(torus(0.06, 0.016, 8, 24), {
      position: [0, apronY, depth / 2 - legInset + 0.055],
    }),
  );
  // Faux corner carvings on the top border.
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      carvedParts.push(
        part(torus(0.05, 0.014, 8, 20), {
          position: [sx * (width / 2 - 0.09), topY, sz * (depth / 2 - 0.09)],
          rotation: [Math.PI / 2, 0, 0],
        }),
      );
    }
  }

  const carved = new THREE.Mesh(mergeParts(carvedParts), mats.deskCarved);
  carved.castShadow = true;
  group.add(carved);

  // A small drawer, kept as its own object (future interaction hook).
  const drawer = buildDrawer(mats, { apronW, apronH, apronY, depth, legInset });
  group.add(drawer);

  return group;
}

function buildDrawer(mats, { apronW, apronH, apronY, depth, legInset }) {
  const drawer = new THREE.Group();
  drawer.name = "desk-drawer";
  const w = apronW * 0.5;
  const h = apronH * 0.8;
  const face = new THREE.Mesh(box(w, h, 0.02), mats.deskTop);
  face.position.set(0, apronY - 0.02, depth / 2 - legInset + 0.045);
  face.castShadow = true;
  drawer.add(face);

  const handle = new THREE.Mesh(cylinder(0.018, 0.018, w * 0.5, 12), mats.lampMetal);
  handle.rotation.z = Math.PI / 2;
  handle.position.set(0, apronY - 0.02, depth / 2 - legInset + 0.075);
  drawer.add(handle);

  // Lock plate.
  const plate = new THREE.Mesh(cylinder(0.028, 0.028, 0.012, 16), mats.lampMetal);
  plate.rotation.x = Math.PI / 2;
  plate.position.set(0.14, apronY - 0.02, depth / 2 - legInset + 0.055);
  drawer.add(plate);

  return drawer;
}
