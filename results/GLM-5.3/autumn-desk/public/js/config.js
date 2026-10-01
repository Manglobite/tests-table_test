// Конфигурация сцены: палитра, размеры, пресеты камеры.
// Модуль содержит только данные — без THREE и DOM, чтобы использоваться и в проверках.

export const PALETTE = {
  oakLight: '#b98a56',
  oakMid: '#9a6b3c',
  oakDark: '#6d4a28',
  wall: '#e7d9c3',
  wallShade: '#d8c6ab',
  floor: '#a97e52',
  skyTop: '#ffe9c4',
  skyHorizon: '#ffb469',
  sun: '#ffd9a0',
  curtainA: '#c96f4a',
  curtainB: '#d98a63',
  leafYellow: '#e8b23a',
  leafOrange: '#e07b28',
  leafRed: '#c14b2a',
  leafBrown: '#9a5a2e',
  metal: '#8f8f96',
  laptopBody: '#2b2e33',
};

// Габариты (условные метры). Стол: y поверхности ~0.76.
export const LAYOUT = {
  desk: {
    width: 2.5,
    depth: 1.1,
    topThickness: 0.07,
    topY: 0.76,
    apronH: 0.17,
    legInset: 0.16,
  },
  window: {
    cx: 0,
    cy: 1.78,
    width: 1.46,
    height: 1.66,
    wallZ: -1.35,
    openAngle: 0.24, // левая створка приоткрыта наружу, рад
  },
  laptop: { x: 0.74, z: 0.16, yaw: -0.16 },
  notebook: { x: 0.02, z: 0.4 },
  calendar: { x: -0.88, z: 0.2, yaw: 0.2 },
};

// Пресеты камеры: точка взгляда, направление смещения камеры, вертикальный FOV
// и ширина кадра (мировые единицы), которую надо уместить по горизонтали.
export const FOCUS_PRESETS = {
  home: {
    label: 'Общий вид',
    target: [0, 1.08, -0.25],
    offset: [0, 0.42, 3.05],
    fov: 41,
    frameWidth: 3.55,
  },
  window: {
    label: 'Окно',
    target: [0, 1.78, -1.35],
    offset: [0.02, -0.12, 1.75],
    fov: 42,
    frameWidth: 2.15,
  },
  laptop: {
    label: 'Ноутбук',
    target: [0.74, 1.0, 0.16],
    offset: [0.1, 0.24, 0.62],
    fov: 36,
    frameWidth: 0.72,
  },
  notebook: {
    label: 'Блокнот',
    target: [0.02, 0.8, 0.4],
    offset: [0, 0.42, 0.56],
    fov: 40,
    frameWidth: 0.62,
  },
  calendar: {
    label: 'Календарь',
    target: [-0.88, 0.94, 0.2],
    offset: [0.16, 0.22, 0.52],
    fov: 36,
    frameWidth: 0.5,
  },
};

export const FOCUSABLE = ['window', 'laptop', 'notebook', 'calendar'];

export const QUALITY = {
  dprCap: 2,
  shadowMap: 2048,
  shadowMapTouch: 1024,
};
