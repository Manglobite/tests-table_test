// Material factory.  All materials are created once and owned by the scene so
// they can be disposed deterministically by `disposeObject`/`disposeScene`.

import { THREE } from "../core/three-import.js";
import { PALETTE } from "./config.js";

export function createMaterials(textures) {
  const mats = {
    deskTop: new THREE.MeshStandardMaterial({
      map: textures.wood,
      color: 0xffffff,
      roughness: 0.55,
      metalness: 0.02,
    }),
    deskEdge: new THREE.MeshStandardMaterial({
      map: textures.carvedPanel,
      color: 0xffffff,
      roughness: 0.7,
      metalness: 0.02,
    }),
    deskCarved: new THREE.MeshStandardMaterial({
      color: PALETTE.deskCarved,
      roughness: 0.6,
      metalness: 0.03,
    }),
    wall: new THREE.MeshStandardMaterial({
      map: textures.wall,
      color: 0xffffff,
      roughness: 0.95,
    }),
    floor: new THREE.MeshStandardMaterial({
      map: textures.floor,
      color: 0xffffff,
      roughness: 0.85,
    }),
    frame: new THREE.MeshStandardMaterial({
      color: PALETTE.windowFrame,
      roughness: 0.6,
    }),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0xdcecf5,
      roughness: 0.08,
      metalness: 0,
      transmission: 0.0,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide,
    }),
    curtain: new THREE.MeshStandardMaterial({
      map: textures.curtain,
      color: 0xffffff,
      roughness: 0.9,
      side: THREE.DoubleSide,
    }),
    paper: new THREE.MeshStandardMaterial({
      color: PALETTE.paper,
      roughness: 0.85,
      side: THREE.DoubleSide,
    }),
    notebookWriting: new THREE.MeshBasicMaterial({
      map: textures.notebook,
      transparent: true,
      toneMapped: false,
      side: THREE.DoubleSide,
    }),
    lockScreen: new THREE.MeshBasicMaterial({
      map: textures.lockDisplayTexture,
      toneMapped: false,
    }),

    notebookCover: new THREE.MeshStandardMaterial({
      color: 0x8a4a2f,
      roughness: 0.7,
    }),
    calendarPaper: new THREE.MeshStandardMaterial({
      map: textures.calendar,
      color: 0xffffff,
      roughness: 0.8,
      side: THREE.DoubleSide,
    }),
    calendarStand: new THREE.MeshStandardMaterial({
      color: 0x6b4220,
      roughness: 0.6,
    }),
    calendarFace: new THREE.MeshBasicMaterial({
      map: textures.calendar,
      toneMapped: false,
    }),
    laptopBody: new THREE.MeshStandardMaterial({
      color: PALETTE.laptopBody,
      roughness: 0.35,
      metalness: 0.55,
    }),
    laptopKeys: new THREE.MeshStandardMaterial({
      color: 0x1c1f24,
      roughness: 0.55,
      metalness: 0.2,
    }),
    mug: new THREE.MeshStandardMaterial({
      color: PALETTE.mug,
      roughness: 0.35,
      metalness: 0.05,
    }),
    mugInner: new THREE.MeshStandardMaterial({
      color: 0x6b4220,
      roughness: 0.5,
      side: THREE.BackSide,
    }),
    bookRed: new THREE.MeshStandardMaterial({
      map: textures.bookRed,
      color: 0xffffff,
      roughness: 0.7,
    }),
    bookBlue: new THREE.MeshStandardMaterial({
      map: textures.bookBlue,
      color: 0xffffff,
      roughness: 0.7,
    }),
    bookPages: new THREE.MeshStandardMaterial({
      color: 0xefe4cc,
      roughness: 0.9,
    }),
    pen: new THREE.MeshStandardMaterial({
      color: 0x2a2d33,
      roughness: 0.3,
      metalness: 0.5,
    }),
    penTip: new THREE.MeshStandardMaterial({
      color: 0xd8b24a,
      roughness: 0.25,
      metalness: 0.9,
    }),
    lampMetal: new THREE.MeshStandardMaterial({
      color: 0x4a4f57,
      roughness: 0.4,
      metalness: 0.6,
    }),
    lampShade: new THREE.MeshStandardMaterial({
      color: 0xf2c978,
      roughness: 0.6,
      emissive: 0x7a4a12,
      emissiveIntensity: 0.6,
      side: THREE.DoubleSide,
    }),
    bird: new THREE.MeshStandardMaterial({
      color: PALETTE.bird,
      roughness: 0.7,
      side: THREE.DoubleSide,
    }),
  };

  // A few pre-tinted leaf materials so leaves vary without per-leaf clones.
  mats.leafVariants = [
    new THREE.MeshStandardMaterial({ color: PALETTE.leafGold, roughness: 0.8, side: THREE.DoubleSide }),
    new THREE.MeshStandardMaterial({ color: PALETTE.leafRed, roughness: 0.8, side: THREE.DoubleSide }),
    new THREE.MeshStandardMaterial({ color: PALETTE.leafBrown, roughness: 0.85, side: THREE.DoubleSide }),
    new THREE.MeshStandardMaterial({ color: PALETTE.leafGreen, roughness: 0.85, side: THREE.DoubleSide }),
  ];

  return mats;
}
