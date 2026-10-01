// Scene assembly: builds every object once, exposes a single `update` hook
// and a deterministic `dispose`.  This is the only place that knows about the
// concrete set of objects, which keeps `main.js` focused on lifecycle.

import { THREE } from "../core/three-import.js";
import { FOCUS_TARGETS, PALETTE, WORLD, homePose } from "./config.js";
import { createAssets } from "./assets.js";
import { createMaterials } from "./materials.js";
import { disposeObject } from "./geo.js";
import { buildRoom } from "./environment.js";
import { buildDesk } from "./desk.js";
import { buildWindow } from "./window.js";
import { buildLaptop, buildNotebook, buildCalendar, buildDecor } from "./props.js";
import { buildLeaves } from "./leaves.js";
import { buildLighting, buildSunShaft } from "./lighting.js";
import { poseFromFraming } from "../core/camera-focus.js";

export function createScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.sky);
  // Only very distant geometry hazes; the room must stay crisp.
  scene.fog = new THREE.Fog(PALETTE.haze, 14, 30);

  const assets = createAssets();
  const mats = createMaterials(assets.textures);

  const lighting = buildLighting();
  const shaft = buildSunShaft();
  const room = buildRoom(mats);
  const desk = buildDesk(mats);
  const windowGroup = buildWindow(mats);
  const laptop = buildLaptop(mats);
  const notebook = buildNotebook(mats);
  const calendar = buildCalendar(mats);
  const decor = buildDecor(mats);
  const leaves = buildLeaves(mats);

  scene.add(lighting, shaft, room, desk, windowGroup, laptop, notebook, calendar, decor, leaves);

  // Resolve world-space focus poses from the declarative config.
  const focusPoses = {};
  for (const [id, spec] of Object.entries(FOCUS_TARGETS)) {
    focusPoses[id] = poseFromFraming({
      center: spec.center,
      direction: spec.direction,
      distance: spec.distance,
      fov: spec.fov,
    });
  }

  const interactive = { window: windowGroup, laptop, notebook, calendar };

  const update = (t, dt) => {
    windowGroup.userData.update?.(t);
    leaves.userData.update?.(t, dt);
  };

  const dispose = () => {
    for (const obj of [lighting, shaft, room, desk, windowGroup, laptop, notebook, calendar, decor, leaves]) {
      scene.remove(obj);
      disposeObject(obj);
    }
    assets.dispose();
    scene.clear();
  };

  return {
    scene,
    camera: new THREE.PerspectiveCamera(homePose(false).fov, 1, 0.1, 100),
    homePose,
    focusPoses,
    interactive,
    locker: assets.lock,
    update,
    dispose,
    world: WORLD,
  };
}
