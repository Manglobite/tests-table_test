// Builds the procedural texture set once, up front.  Keeping creation in a
// single factory makes ownership and disposal obvious for the scene lifecycle.

import { createLockScreen } from "./lockscreen.js";
import {
  bookCoverTexture,
  calendarPageTexture,
  carvedPanelTexture,
  curtainTexture,
  floorTexture,
  notebookPageTexture,
  noiseTexture,
  wallTexture,
  woodTexture,
} from "./textures.js";

export function createAssets() {
  const lock = createLockScreen();
  const textures = {
    wood: woodTexture(),
    carvedPanel: carvedPanelTexture(),
    notebook: notebookPageTexture(true),
    calendar: calendarPageTexture(new Date()),
    curtain: curtainTexture(),
    wall: wallTexture(),
    floor: floorTexture(),
    bookRed: bookCoverTexture("#8a2f2f", 0),
    bookBlue: bookCoverTexture("#2f4a6b", 1),
    noise: noiseTexture(5),
    lockDisplayTexture: lock.texture,
  };

  return {
    textures,
    lock,
    dispose() {
      for (const value of Object.values(textures)) {
        // The lock texture is owned by `lock` and disposed with it.
        if (value && value.isTexture && value !== lock.texture) value.dispose();
      }
      lock.dispose();
    },
  };
}
