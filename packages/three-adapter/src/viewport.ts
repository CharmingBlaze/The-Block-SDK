import { Vector3, WebGLRenderer } from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { PointPickRequest, PointPickResult, SelectionIntent } from "@modeling-kit/selection";
import { ThreeViewportAdapter } from "./adapter";
import {
  createKnifeOverlay,
  updateKnifeOverlay,
  type KnifeOverlayState,
} from "./overlays/knife-overlay";
import type { PickResult } from "./picking";
import type { PointerPhase } from "./sub-element";
import { createOrbitEventGate } from "./orbit-event-gate";
import { createViewportGestureController } from "./viewport-gesture-controller";
import type { ViewportGestureController } from "./viewport-gesture-types";
import { bindViewportPointer } from "./viewport-pointer";
import {
  applyViewportNavigation,
  resolvePickingNavigation,
} from "./viewport-pointer-policy";
import { createViewportScene } from "./viewport-studio";
import { ViewportDisplayController } from "./viewport-display-controller";
import type { ViewportRenderMode, ViewportRenderSettingsInput } from "./viewport-display-settings";
import {
  applyViewportPointPick,
  resolvedPickingOptions,
  type CreateThreeViewportOptions,
  type ThreeViewportHandle,
} from "./viewport-types";

export type {
  CreateThreeViewportOptions,
  ThreeViewportCameraOptions,
  ThreeViewportController,
  ThreeViewportHandle,
  ThreeViewportOptions,
  ThreeViewportPickingOptions,
  ViewportPointerLocation,
} from "./viewport-types";
export type { ViewportRenderMode, ViewportRenderSettingsInput } from "./viewport-display-settings";

/** Zero-config Three.js viewport bound to a headless ModelingSession. */
export function createThreeViewport(options: CreateThreeViewportOptions): ThreeViewportHandle {
  const { scene, camera, grid } = createViewportScene(options);
  const picking = resolvedPickingOptions(options.picking);

  const renderer = new WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  const canvas = renderer.domElement;
  canvas.style.display = "block";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.touchAction = "none";
  options.container.appendChild(canvas);

  const adapter = new ThreeViewportAdapter({
    session: options.session,
    scene,
    camera,
    renderer,
    ...(options.textureResolver ? { textureResolver: options.textureResolver } : {}),
    gpuPicking: picking.gpuPicking === false ? "off" : "webgl",
    ...(options.spatialAcceleration === false ? { spatialAcceleration: false } : {}),
    ...(options.subElement ? { subElement: options.subElement } : {}),
  });
  adapter.mount();

  const display = new ViewportDisplayController({
    renderer,
    scene,
    camera,
    presentationRoot: adapter.root,
    ...(grid ? { grid } : {}),
    ...((options.renderSettings ?? options.display) ? { initial: options.renderSettings ?? options.display } : {}),
    lightingEnabled: options.lighting !== "none" && options.lights !== false,
    getSelectedObjects: () => options.session.selection.objectIds
      .map((objectId) => adapter.object3D(objectId))
      .filter((object): object is NonNullable<typeof object> => object !== undefined),
    setTopologyEdges: (visible) => adapter.setSubElementTheme({
      edges: {
        roles: {
          interior: { opacity: visible ? 0.85 : 0 },
          boundary: { opacity: visible ? 1 : 0 },
          seam: { opacity: visible ? 1 : 0 },
          sharp: { opacity: visible ? 1 : 0 },
          crease: { opacity: visible ? 1 : 0 },
        },
      },
    }),
  });
  const displayUnsubscribers = [
    options.session.events.on("document:changed", (change) => {
      if (change.aspect === "material" || change.aspect === "texture" || change.kind === "materials") {
        display.invalidateDerivedMaterials();
      }
      if (change.kind === "transform" || change.kind === "visibility" || change.kind === "hierarchy") {
        display.invalidateShadows();
      }
    }),
    options.session.events.on("mesh:changed", () => {
      display.invalidateDerivedMaterials();
      display.invalidateShadows();
    }),
    options.session.events.on("selection:changed", () => display.invalidateShadows()),
  ];

  const pickingEnabled = picking.enabled;
  const pickDomain = options.pickDomain ?? "face";
  const navigation = resolvePickingNavigation({
    ...(options.minDistance !== undefined ? { minDistance: options.minDistance } : {}),
    ...(options.zoomToCursor !== undefined ? { zoomToCursor: options.zoomToCursor } : {}),
    ...(options.touchNavigation !== undefined ? { touchNavigation: options.touchNavigation } : {}),
    ...(options.navigation ? { navigation: options.navigation } : {}),
  });

  let disposed = false;
  // Viewport picking is not `@modeling-kit/input` bindDom. Do not wire them together.
  const controlSlot: { controls: OrbitControls | undefined } = { controls: undefined };
  const gestureSlot: { applyClaim?: ViewportGestureController["applyClaim"] } = {};
  const navigationTarget = pickingEnabled ? createOrbitEventGate(canvas) : undefined;
  const pointerBinding = bindViewportPointer({
    canvas,
    adapter,
    viewport: options,
    pickingEnabled,
    pickDomain,
    attachListeners: false,
    onBeginToolDrag: (pointerId) => {
      gestureSlot.applyClaim?.(pointerId, { owner: "tool", beginDrag: true });
    },
    isDisposed: () => disposed,
  });

  const gestures = createViewportGestureController({
    canvas,
    attachListeners: pickingEnabled,
    pickingEnabled,
    navigation,
    ...(options.minDistance !== undefined ? { minDistance: options.minDistance } : {}),
    ...(options.zoomToCursor !== undefined ? { zoomToCursor: options.zoomToCursor } : {}),
    getControls: () => controlSlot.controls,
    getNavigationTarget: () => navigationTarget,
    onSelectionDown: pointerBinding.handlePointerDown,
    onSelectionMove: pointerBinding.handlePointerMove,
    onSelectionUp: pointerBinding.handlePointerUp,
    onSelectionCancel: pointerBinding.handlePointerCancel,
  });
  if (options.gestureHooks) {
    gestures.setHooks(options.gestureHooks);
  }
  gestureSlot.applyClaim = (pointerId, claim) => gestures.applyClaim(pointerId, claim);

  let controls: OrbitControls | undefined;
  if (options.orbitControls !== false) {
    const orbitElement = (navigationTarget ?? renderer.domElement) as HTMLElement;
    controls = new OrbitControls(camera, orbitElement);
    controls.enableDamping = options.damping !== false;
    if (pickingEnabled) {
      applyViewportNavigation(controls, navigation, {
        ...(options.minDistance !== undefined ? { minDistance: options.minDistance } : {}),
        ...(options.zoomToCursor !== undefined ? { zoomToCursor: options.zoomToCursor } : {}),
      });
    }
    controlSlot.controls = controls;
  }

  const resize = (): void => {
    const width = Math.max(1, options.container.clientWidth || window.innerWidth);
    const height = Math.max(1, options.container.clientHeight || window.innerHeight);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    adapter.resize(width, height, window.devicePixelRatio);
    display.resize(width, height, window.devicePixelRatio);
  };
  resize();

  let frame = 0;
  const tick = (): void => {
    frame = requestAnimationFrame(tick);
    gestures.enforceNavigation();
    controls?.update();
    adapter.updateView();
    display.render();
  };
  tick();

  const onWindowResize = (): void => {
    resize();
  };
  let resizeObserver: ResizeObserver | undefined;
  if (options.autoResize !== false) {
    window.addEventListener("resize", onWindowResize);
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => {
        resize();
      });
      resizeObserver.observe(options.container);
    }
  }

  const worldPointOf = (hit: PointPickResult | PickResult): { x: number; y: number; z: number } | undefined => {
    if ("kind" in hit) {
      if (hit.kind !== "surface") {
        return undefined;
      }
      return hit.worldPoint;
    }
    return hit.point;
  };

  const toMeshLocal = (hit: PointPickResult | PickResult): [number, number, number] | undefined => {
    const world = worldPointOf(hit);
    if (!world) {
      return undefined;
    }
    const object = adapter.object3D(hit.objectId);
    if (!object) {
      return [world.x, world.y, world.z];
    }
    const local = object.worldToLocal(new Vector3(world.x, world.y, world.z));
    return [local.x, local.y, local.z];
  };

  const knifeOverlay = createKnifeOverlay();
  adapter.root.add(knifeOverlay);

  const attachKnifeOverlay = (): void => {
    const objectId = options.session.selection.objectIds[0];
    const host = objectId ? adapter.object3D(objectId) : undefined;
    const parent = host ?? adapter.root;
    if (knifeOverlay.parent !== parent) {
      parent.add(knifeOverlay);
    }
  };

  return {
    scene,
    camera,
    renderer,
    adapter,
    controls,
    gestures,
    display,
    setRenderMode(mode: ViewportRenderMode): void {
      display.setRenderMode(mode);
    },
    updateRenderSettings(settings: ViewportRenderSettingsInput): void {
      display.updateRenderSettings(settings);
    },
    setDisplaySettings(settings: ViewportRenderSettingsInput): void {
      display.updateRenderSettings(settings);
    },
    setSubElementDisplay(settings) {
      adapter.setSubElementDisplay(settings);
    },
    pickFromClient: pointerBinding.pickFromClient,
    resolvePointPick(request: PointPickRequest) {
      return adapter.pickPoint(request);
    },
    applyPointPick(result: PointPickResult | undefined, intent?: SelectionIntent) {
      applyViewportPointPick(options.session, result, intent);
    },
    toMeshLocal,
    setKnifePreview(state: KnifeOverlayState | null): void {
      attachKnifeOverlay();
      updateKnifeOverlay(knifeOverlay, state);
    },
    pointerPhase(): PointerPhase {
      return pointerBinding.pointer.phase;
    },
    dispose(): void {
      if (disposed) {
        return;
      }
      disposed = true;
      pointerBinding.invalidateClicks();
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onWindowResize);
      resizeObserver?.disconnect();
      pointerBinding.dispose();
      gestures.dispose();
      controls?.dispose();
      pointerBinding.pointer.cancel("adapter-dispose");
      for (const unsubscribe of displayUnsubscribers) unsubscribe();
      display.dispose();
      adapter.dispose();
      if (grid) {
        grid.removeFromParent();
        grid.geometry.dispose();
        const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material];
        for (const material of gridMaterials) material.dispose();
      }
      renderer.dispose();
      renderer.domElement.remove();
      knifeOverlay.removeFromParent();
      pointerBinding.pointer.cancel("document-close");
    },
  };
}
