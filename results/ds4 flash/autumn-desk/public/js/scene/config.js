// Shared scene configuration: palette, world dimensions and per-object focus
// poses.  Keeping this in one place means objects and the camera rig can be
// extended or restyled without touching interaction logic.

export const PALETTE = {
  sky: 0xbfd8e8,
  haze: 0xead9b6,
  sun: 0xfff0cf,
  wall: 0xe8dcc6,
  wallShadow: 0xcbb99b,
  deskTop: 0x7a4f28,
  deskEdge: 0x5d3a1c,
  deskCarved: 0x93643a,
  floor: 0x9c6b3f,
  windowFrame: 0xf2e9d8,
  curtain: 0xe7c9a0,
  curtainEdge: 0xc99a5f,
  leafGold: 0xd98a2b,
  leafRed: 0xb2431f,
  leafBrown: 0x8a5326,
  leafGreen: 0x7d8a3a,
  laptopBody: 0x2b2f36,
  laptopScreen: 0x0b1220,
  paper: 0xf7f1e3,
  paperLine: 0xc9bda2,
  calendarPaper: 0xfbf7ee,
  calendarAccent: 0xb2431f,
  mug: 0xdfe6ea,
  bird: 0x3a3630,
};

export const WORLD = {
  desk: {
    width: 3.6,
    depth: 1.5,
    thickness: 0.12,
    height: 1.0, // top surface height
    legInset: 0.18,
  },
  window: {
    width: 1.7,
    height: 1.4,
    sillY: 1.55,
    wallZ: -1.8,
  },
};

// Object focus poses are expressed in world space.  Directions point from the
// focus target toward the camera.  Only these four objects are interactive.
export const FOCUS_TARGETS = {
  window: {
    label: "Окно",
    center: { x: 0, y: 2.15, z: -1.65 },
    direction: { x: 0, y: 0.05, z: 1 },
    distance: 3.4,
    fov: 44,
  },
  laptop: {
    label: "Ноутбук",
    center: { x: 0.98, y: 1.3, z: -0.35 },
    direction: { x: 0.35, y: 0.5, z: 0.85 },
    distance: 1.5,
    fov: 40,
  },
  notebook: {
    label: "Блокнот",
    center: { x: -0.4, y: 1.13, z: 0.42 },
    direction: { x: -0.1, y: 0.75, z: 0.9 },
    distance: 1.15,
    fov: 40,
  },
  calendar: {
    label: "Календарь",
    center: { x: -1.35, y: 1.34, z: -0.2 },
    direction: { x: -0.45, y: 0.35, z: 0.9 },
    distance: 1.4,
    fov: 40,
  },
};

// Home framing.  The desktop pose keeps the whole desk readable; the portrait
// pose backs the camera off and raises the FOV so key objects still fit the
// narrow phone frame.
export function homePose(portrait) {
  if (portrait) {
    return {
      position: { x: 0.1, y: 2.3, z: 6.6 },
      target: { x: 0.0, y: 1.55, z: -0.3 },
      fov: 66,
    };
  }
  return {
    position: { x: 1.2, y: 2.35, z: 4.4 },
    target: { x: 0.05, y: 1.4, z: -0.25 },
    fov: 45,
  };
}

// Objects that may be clicked.  Order matters only for documentation.
export const INTERACTIVE_IDS = ["window", "laptop", "notebook", "calendar"];
