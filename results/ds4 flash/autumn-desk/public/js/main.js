// Entry point and lifecycle owner.
//
// Responsibilities kept here on purpose:
//   * renderer/camera creation and disposal
//   * resize + orientation handling (delegated to core/layout.js)
//   * the animation loop
//   * wiring picking, orbit controls and the focus rig together
// Nothing here knows how an object is built; that lives in scene/*.

import { THREE } from "./core/three-import.js";
import { CameraFocus } from "./core/camera-focus.js";
import {
  adaptFocusPose,
  adaptHomePose,
  aspectDistanceScale,
  classifyViewport,
  renderPixelRatio,
} from "./core/layout.js";
import { createScene } from "./scene/scene.js";
import { Picker } from "./interactions/picking.js";
import { OrbitController } from "./interactions/controls.js";

function showFallback(message) {
  const fallback = document.getElementById("webgl-fallback");
  const canvas = document.getElementById("scene-canvas");
  if (canvas) canvas.hidden = true;
  if (fallback) {
    fallback.hidden = false;
    const detail = fallback.querySelector("[data-reason]");
    if (detail && message) detail.textContent = message;
  }
  document.body.classList.add("has-error");
}

function hasWebGL() {
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2") ||
      canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl");
    return !!gl;
  } catch {
    return false;
  }
}

function boot() {
  const canvas = document.getElementById("scene-canvas");
  if (!canvas) {
    showFallback("Не найден элемент canvas.");
    return;
  }
  if (!hasWebGL()) {
    showFallback("Браузер не поддерживает WebGL.");
    return;
  }

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
  } catch (err) {
    showFallback(`Не удалось создать WebGL-контекст: ${err.message}`);
    return;
  }

  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;

  let world;
  try {
    world = createScene();
  } catch (err) {
    renderer.dispose();
    showFallback(`Не удалось построить сцену: ${err.message}`);
    return;
  }
  const { scene } = world;
  const camera = world.camera;

  const focus = new CameraFocus({
    home: world.homePose(false),
    damping: 5.2,
    epsilon: 0.008,
  });

  const picker = new Picker({
    camera,
    targets: Object.values(world.interactive),
    domElement: canvas,
  });
  const controls = new OrbitController({ domElement: canvas, camera, focus });
  const lockInput = document.getElementById("lock-input");

  const clock = new THREE.Clock();
  let disposed = false;
  let rafId = 0;
  let lastPortrait = null;
  let currentScale = 1;
  let ui = null;

  // ---- responsive ---------------------------------------------------------

  function applyLayout() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const { portrait, aspect } = classifyViewport(width, height);
    const scale = aspectDistanceScale(aspect, portrait ? 0.72 : 1.6);

    renderer.setPixelRatio(renderPixelRatio(width, height, window.devicePixelRatio));
    renderer.setSize(width, height, false);

    // The projection must follow the viewport, otherwise the image stretches.
    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    const base = world.homePose(portrait);
    focus.setHome(adaptHomePose(base, portrait, scale));

    if (portrait !== lastPortrait) {
      lastPortrait = portrait;
      document.body.classList.toggle("is-portrait", portrait);
    }
    currentScale = Math.min(aspectDistanceScale(aspect, 1.6), 1.45);

    // Re-aim the focused object smoothly if the viewport changed while a
    // focus is active, so a rotation/resize never crops the subject.
    if (activeId) {
      const pose = currentFocusPose(activeId);
      if (pose) focus.focus(activeId, pose);
    }
  }

  function currentFocusPose(id) {
    const base = world.focusPoses[id];
    if (!base) return null;
    return adaptFocusPose(base, currentScale);
  }

  // ---- interaction --------------------------------------------------------

  let activeId = null;
  function setActive(id) {
    if (id === activeId) return;
    const prev = activeId;
    activeId = id;
    world.interactive[prev]?.userData.onBlur?.();
    world.interactive[id]?.userData.onFocus?.();
    if (id !== "laptop") {
      const input = document.getElementById("lock-input");
      if (input) input.value = "";
      world.locker.setTyped(0);
    }
    ui?.setActive(id);
  }

  function handleTap(clientX, clientY) {
    picker.setPointer(clientX, clientY);
    const hit = picker.pick();
    if (!hit.id) {
      focus.goHome();
      setActive(null);
      return;
    }
    if (focus.activeId === hit.id) {
      focus.goHome();
      setActive(null);
      return;
    }
    const pose = currentFocusPose(hit.id);
    if (pose) {
      focus.focus(hit.id, pose);
      setActive(hit.id);
    }
  }

  const onCanvasPointerDown = (e) => {
    picker.setPointer(e.clientX, e.clientY);
    lockInput?.blur();
  };
  const onCanvasPointerUp = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    if (controls.wasTap(e.clientX, e.clientY)) {
      handleTap(e.clientX, e.clientY);
    }
    controls.resetMomentum();
  };
  canvas.addEventListener("pointerdown", onCanvasPointerDown);
  canvas.addEventListener("pointerup", onCanvasPointerUp);

  // The password field lives in the UI overlay, but it is the laptop's lock
  // screen.  Mirror only the character *count* into the 3D texture and keep
  // focus/Enter handling local to the overlay.
  lockInput?.addEventListener("input", (e) => {
    world.locker.setTyped(e.target.value.length);
  });
  lockInput?.addEventListener("focus", () => world.locker.setFocused(true));
  lockInput?.addEventListener("blur", () => world.locker.setFocused(false));

  const onKeyDown = (e) => {
    if (e.key === "Escape") {
      // The lock input swallows Escape and simply blurs.
      if (document.activeElement === lockInput) {
        lockInput.blur();
        return;
      }
      focus.goHome();
      setActive(null);
    }
  };
  window.addEventListener("keydown", onKeyDown);

  // ---- animation loop -----------------------------------------------------

  function frame() {
    if (disposed) return;
    rafId = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

    // While the user is dragging, the controller owns the camera; otherwise
    // the focus rig advances toward its goal.
    if (!controls.active) {
      focus.update(dt);
    }
    const pose = focus.current;
    camera.position.set(pose.position.x, pose.position.y, pose.position.z);
    camera.lookAt(pose.target.x, pose.target.y, pose.target.z);
    if (Math.abs(camera.fov - pose.fov) > 0.01) {
      camera.fov = pose.fov;
      camera.updateProjectionMatrix();
    }

    world.update(t, dt);
    world.locker.tick(new Date());
    renderer.render(scene, camera);
  }

  // ---- lifecycle ----------------------------------------------------------

  function dispose() {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(rafId);
    window.removeEventListener("resize", onResize);
    window.removeEventListener("orientationchange", onResize);
    window.removeEventListener("beforeunload", dispose);
    window.removeEventListener("keydown", onKeyDown);
    canvas.removeEventListener("pointerdown", onCanvasPointerDown);
    canvas.removeEventListener("pointerup", onCanvasPointerUp);
    controls.dispose();
    world.dispose();
    renderer.dispose();
    renderer.forceContextLoss?.();
  }

  const onResize = () => applyLayout();

  window.addEventListener("resize", onResize);
  window.addEventListener("orientationchange", onResize);
  window.addEventListener("beforeunload", dispose);

  ui = createUI({ onHome: () => { focus.goHome(); setActive(null); } });

  applyLayout();
  focus.snapToGoal();
  frame();

  return { focus, handleTap, dispose, picker };
}

// ---------------------------------------------------------------------------
// Minimal DOM UI: only a "home" reset button.  No start screen, no menus.
// ---------------------------------------------------------------------------

function createUI({ onHome }) {
  const chip = document.getElementById("home-chip");
  const activeLabel = document.getElementById("active-label");

  chip?.addEventListener("click", onHome);

  return {
    setActive(id) {
      if (chip) chip.classList.toggle("is-home", !id);
      if (activeLabel) {
        activeLabel.textContent = id ? id : "";
        activeLabel.hidden = !id;
      }
      document.body.dataset.focus = id || "home";
    },
  };
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}
