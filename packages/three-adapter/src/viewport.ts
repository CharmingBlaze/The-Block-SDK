import type { ModelingSession } from "@modeling-kit/commands";
import {
  AmbientLight,
  Color,
  DirectionalLight,
  GridHelper,
  HemisphereLight,
  MOUSE,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { ThreeViewportAdapter } from "./adapter";
import { applyPickSelection, clientToNdc, isClickNotDrag } from "./pick-selection";
import type { PickDomain, PickResult } from "./picking";
import {
  createKnifeOverlay,
  updateKnifeOverlay,
  type KnifeOverlayState,
} from "./overlays/knife-overlay";
import {
  ElementPointerMachine,
  type DeepPartial,
  type PointerPhase,
  type SubElementDisplayOptions,
  type SubElementHover,
  type SubElementVisualTheme,
} from "./sub-element";

export interface ThreeViewportCameraOptions {
  readonly fov?: number;
  readonly near?: number;
  readonly far?: number;
  readonly position?: readonly [number, number, number];
}

export interface CreateThreeViewportOptions {
  readonly container: HTMLElement;
  readonly session: ModelingSession;
  readonly grid?: boolean;
  /** Studio = hemisphere sky/ground + 3-point key/fill/rim. */
  readonly lighting?: "studio" | "none";
  /** Alias of `lighting !== "none"`. */
  readonly lights?: boolean;
  readonly camera?: ThreeViewportCameraOptions;
  readonly orbitControls?: boolean;
  /** OrbitControls inertia. Defaults to true when orbit is enabled. */
  readonly damping?: boolean;
  readonly autoResize?: boolean;
  readonly background?: number;
  /** Left-click raycast pick into the session. Defaults to true. */
  readonly picking?: boolean;
  readonly pickDomain?: PickDomain;
  readonly onSelect?: (hit: PickResult | null) => void;
  /** If this returns true, the pick is not written into session selection. */
  readonly consumePick?: (hit: PickResult | null) => boolean;
  /** Pointer-move pick for tool overlays. Does not change selection. */
  readonly onHoverPick?: (hit: PickResult | null) => void;
  /** Override the pick domain per event (knife=face, loop cut=edge). */
  readonly resolvePickDomain?: () => PickDomain;
  readonly subElement?: {
    readonly theme?: DeepPartial<SubElementVisualTheme>;
    readonly display?: DeepPartial<SubElementDisplayOptions>;
  };
}

export type ThreeViewportHandle = {
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  readonly renderer: WebGLRenderer;
  readonly adapter: ThreeViewportAdapter;
  readonly controls: OrbitControls | undefined;
  pickFromClient(clientX: number, clientY: number, domain?: PickDomain): PickResult | null;
  toMeshLocal(hit: PickResult): [number, number, number];
  setKnifePreview(state: KnifeOverlayState | null): void;
  pointerPhase(): PointerPhase;
  dispose(): void;
};

export type ThreeViewportController = ThreeViewportHandle;
export type ThreeViewportOptions = CreateThreeViewportOptions;

/** Zero-config Three.js viewport bound to a headless ModelingSession. */
export function createThreeViewport(options: CreateThreeViewportOptions): ThreeViewportHandle {
  const scene = new Scene();
  scene.background = new Color(options.background ?? 0x13131c);

  const lightsOn = options.lighting !== "none" && options.lights !== false;
  if (lightsOn) {
    scene.add(new HemisphereLight(0xddeeff, 0x2a2a38, 0.55));
    scene.add(new AmbientLight(0xffffff, 0.2));
    const key = new DirectionalLight(0xffffff, 0.9);
    key.position.set(5, 8, 6);
    const fill = new DirectionalLight(0xb8c8ff, 0.28);
    fill.position.set(-6, 3, 2);
    const rim = new DirectionalLight(0xffe6c8, 0.35);
    rim.position.set(0, 4, -7);
    scene.add(key, fill, rim);
  }

  if (options.grid !== false) {
    scene.add(new GridHelper(16, 16, 0x3d3d54, 0x222230));
  }

  const cam = options.camera ?? {};
  const camera = new PerspectiveCamera(cam.fov ?? 45, 1, cam.near ?? 0.1, cam.far ?? 200);
  const pos = cam.position ?? ([5, 5, 7] as const);
  camera.position.set(pos[0], pos[1], pos[2]);
  camera.lookAt(0, 0, 0);

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
    ...(options.subElement ? { subElement: options.subElement } : {}),
  });
  adapter.mount();

  const pickingEnabled = options.picking !== false;
  const pickDomain: PickDomain = options.pickDomain ?? "face";

  let controls: OrbitControls | undefined;
  if (options.orbitControls !== false) {
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = options.damping !== false;
    if (pickingEnabled) {
      controls.mouseButtons = {
        LEFT: -1 as unknown as typeof MOUSE.ROTATE,
        MIDDLE: MOUSE.DOLLY,
        RIGHT: MOUSE.ROTATE,
      };
    }
  }

  const resize = (): void => {
    const width = Math.max(1, options.container.clientWidth || window.innerWidth);
    const height = Math.max(1, options.container.clientHeight || window.innerHeight);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    adapter.resize(width, height, window.devicePixelRatio);
  };
  resize();

  let frame = 0;
  const tick = (): void => {
    frame = requestAnimationFrame(tick);
    controls?.update();
    adapter.updateView();
    renderer.render(scene, camera);
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

  let pointerStart: { x: number; y: number } | undefined;
  let pickConsumed = false;
  const pointer = new ElementPointerMachine();

  const hoverFromHit = (hit: PickResult | null): SubElementHover | null => {
    if (!hit) {
      return null;
    }
    if (hit.vertexId) {
      return { objectId: hit.objectId, domain: "vertex", elementId: hit.vertexId };
    }
    if (hit.edgeId) {
      return { objectId: hit.objectId, domain: "edge", elementId: hit.edgeId };
    }
    if (hit.faceId) {
      return { objectId: hit.objectId, domain: "face", elementId: hit.faceId };
    }
    return null;
  };

  const applyHover = (hit: PickResult | null): void => {
    const hover = hoverFromHit(hit);
    pointer.hover(
      hover
        ? { pointerId: -1, x: 0, y: 0, elementId: hover.elementId }
        : null,
    );
    adapter.setHover(hover);
  };

  const pickFromClient = (clientX: number, clientY: number, domain?: PickDomain): PickResult | null => {
    const resolved = domain ?? options.resolvePickDomain?.() ?? pickDomain;
    const ndc = clientToNdc(clientX, clientY, canvas.getBoundingClientRect());
    return adapter.pick(ndc.x, ndc.y, { domain: resolved });
  };

  const toMeshLocal = (hit: PickResult): [number, number, number] => {
    const object = adapter.object3D(hit.objectId);
    if (!object) {
      return [hit.point.x, hit.point.y, hit.point.z];
    }
    const local = object.worldToLocal(new Vector3(hit.point.x, hit.point.y, hit.point.z));
    return [local.x, local.y, local.z];
  };

  const attachKnifeOverlay = (): void => {
    const objectId = options.session.selection.objectIds[0];
    const host = objectId ? adapter.object3D(objectId) : undefined;
    const parent = host ?? adapter.root;
    if (knifeOverlay.parent !== parent) {
      parent.add(knifeOverlay);
    }
  };

  const onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) {
      return;
    }
    pointerStart = { x: event.clientX, y: event.clientY };
    pickConsumed = false;
    if (!pickingEnabled) {
      return;
    }
    const hit = pickFromClient(event.clientX, event.clientY);
    pointer.press({
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      elementId: hoverFromHit(hit)?.elementId ?? null,
    });
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      // Capture is optional on environments without PointerEvent capture.
    }
    if (options.consumePick?.(hit) === true) {
      pickConsumed = true;
      options.onSelect?.(hit);
    }
  };

  const onPointerUp = (event: PointerEvent): void => {
    if (!pickingEnabled || event.button !== 0 || !pointerStart) {
      pointerStart = undefined;
      pickConsumed = false;
      return;
    }
    const wasClick = isClickNotDrag(pointerStart.x, pointerStart.y, event.clientX, event.clientY);
    pointer.commit();
    pointerStart = undefined;
    if (pickConsumed) {
      pickConsumed = false;
      return;
    }
    if (!wasClick) {
      return;
    }
    const hit = pickFromClient(event.clientX, event.clientY);
    const consumed = options.consumePick?.(hit) === true;
    if (!consumed) {
      applyPickSelection(options.session, hit);
    }
    options.onSelect?.(hit);
  };

  const onPointerCancel = (): void => {
    pointer.cancel("pointercancel");
    adapter.setHover(null);
    pointerStart = undefined;
    pickConsumed = false;
  };

  const onLostCapture = (): void => {
    pointer.lostCapture();
    pointerStart = undefined;
    pickConsumed = false;
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (!pickingEnabled) {
      return;
    }
    pointer.move({
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      elementId: pointer.hoverId,
    });
    const hit = pickFromClient(event.clientX, event.clientY);
    applyHover(hit);
    options.onHoverPick?.(hit);
  };

  const knifeOverlay = createKnifeOverlay();
  adapter.root.add(knifeOverlay);

  if (pickingEnabled) {
      canvas.addEventListener("pointerdown", onPointerDown);
      canvas.addEventListener("pointerup", onPointerUp);
      canvas.addEventListener("pointercancel", onPointerCancel);
      canvas.addEventListener("lostpointercapture", onLostCapture);
      canvas.addEventListener("pointermove", onPointerMove);
  }

  let disposed = false;
  return {
    scene,
    camera,
    renderer,
    adapter,
    controls,
    pickFromClient,
    toMeshLocal,
    setKnifePreview(state: KnifeOverlayState | null): void {
      attachKnifeOverlay();
      updateKnifeOverlay(knifeOverlay, state);
    },
    pointerPhase(): PointerPhase {
      return pointer.phase;
    },
    dispose(): void {
      if (disposed) {
        return;
      }
      disposed = true;
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onWindowResize);
      resizeObserver?.disconnect();
      if (pickingEnabled) {
        canvas.removeEventListener("pointerdown", onPointerDown);
        canvas.removeEventListener("pointerup", onPointerUp);
        canvas.removeEventListener("pointercancel", onPointerCancel);
        canvas.removeEventListener("lostpointercapture", onLostCapture);
        canvas.removeEventListener("pointermove", onPointerMove);
      }
      controls?.dispose();
      pointer.cancel("adapter-dispose");
      adapter.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      knifeOverlay.removeFromParent();
      pointer.cancel("document-close");
    },
  };
}
