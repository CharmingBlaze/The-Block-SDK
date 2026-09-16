import {
  applyPointPickToSelection,
  createPickSession,
  PointerPickSessionStore,
  resolveClickFromSession,
  resolvePickPolicy,
  type PointPickRequest,
  type ToolPickResponse,
} from "@modeling-kit/selection";
import { clientToNdc, isClickNotDrag } from "./pick-selection";
import type { PickDomain, PickResult } from "./picking";
import type { ThreeViewportAdapter } from "./adapter";
import { resolvedPickingOptions, type CreateThreeViewportOptions } from "./viewport-types";
import { ElementPointerMachine, type SubElementHover } from "./sub-element";

export interface ViewportPointerBinding {
  pickFromClient(clientX: number, clientY: number, domain?: PickDomain): PickResult | null;
  pointer: ElementPointerMachine;
  invalidateClicks(): void;
  dispose(): void;
}

function hoverFromHit(hit: PickResult | null): SubElementHover | null {
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
}

export function bindViewportPointer(options: {
  readonly canvas: HTMLCanvasElement;
  readonly adapter: ThreeViewportAdapter;
  readonly viewport: CreateThreeViewportOptions;
  readonly pickingEnabled: boolean;
  readonly pickDomain: PickDomain;
  isDisposed(): boolean;
}): ViewportPointerBinding {
  const { canvas, adapter, viewport, pickingEnabled, pickDomain } = options;
  const picking = resolvedPickingOptions(viewport.picking);
  const pointer = new ElementPointerMachine();
  const sessions = new PointerPickSessionStore();
  const inflight = new Map<number, Promise<void>>();
  let pointerStart: { x: number; y: number } | undefined;
  let clickPickGeneration = 0;

  const applyHover = (hit: PickResult | null): void => {
    const hover = hoverFromHit(hit);
    pointer.hover(
      hover ? { pointerId: -1, x: 0, y: 0, elementId: hover.elementId } : null,
    );
    adapter.setHover(hover);
  };

  const pickFromClient = (clientX: number, clientY: number, domain?: PickDomain): PickResult | null => {
    const resolved = domain ?? viewport.resolvePickDomain?.() ?? pickDomain;
    const ndc = clientToNdc(clientX, clientY, canvas.getBoundingClientRect());
    return adapter.pick(ndc.x, ndc.y, { domain: resolved });
  };

  const buildRequest = (clientX: number, clientY: number, domain: PickDomain): PointPickRequest => {
    const canvasRect = canvas.getBoundingClientRect();
    return {
      clientX,
      clientY,
      canvasRect: { left: canvasRect.left, top: canvasRect.top, width: canvasRect.width, height: canvasRect.height },
      domain,
      purpose: "selection",
      ...(picking.refineSurfacePoint !== undefined ? { requireSurfacePoint: picking.refineSurfacePoint } : {}),
      ...(picking.xray ? { xray: true } : {}),
      ...(picking.selectThrough ? { selectThrough: true } : {}),
      ...(picking.backfaceMode ? { backfaceMode: picking.backfaceMode } : {}),
      ...(picking.clickBackend ? { clickBackend: picking.clickBackend } : {}),
      ...(picking.gpuPicking === false ? { clickBackend: "cpu" as const } : {}),
    };
  };

  const onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) {
      return;
    }
    pointerStart = { x: event.clientX, y: event.clientY };
    if (!pickingEnabled) {
      return;
    }
    pointer.press({
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      elementId: null,
    });
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      // Capture is optional on environments without PointerEvent capture.
    }
    const domain = viewport.resolvePickDomain?.() ?? pickDomain;
    const request = buildRequest(event.clientX, event.clientY, domain);
    const revisions = adapter.pickingRevisions();
    const pointerId = event.pointerId;
    inflight.set(
      pointerId,
      adapter.pickPoint(request).then((result) => {
        if (options.isDisposed()) {
          return;
        }
        sessions.begin(
          createPickSession({
            pointerId,
            clientX: request.clientX,
            clientY: request.clientY,
            request,
            result,
            backend: resolvePickPolicy(request).backend,
            sceneRevision: revisions.scene,
            cameraRevision: revisions.camera,
          }),
        );
        const tool = viewport.consumePick?.(result ?? null);
        const response: ToolPickResponse =
          tool && typeof tool === "object"
            ? { consumed: tool.consumed, ...(tool.beginDrag ? { beginDrag: true } : {}) }
            : { consumed: tool === true };
        sessions.applyToolResponse(pointerId, response);
      }),
    );
  };

  const onPointerUp = (event: PointerEvent): void => {
    if (!pickingEnabled || event.button !== 0 || !pointerStart) {
      pointerStart = undefined;
      return;
    }
    const wasClick = isClickNotDrag(pointerStart.x, pointerStart.y, event.clientX, event.clientY);
    pointer.commit();
    pointerStart = undefined;
    const pointerId = event.pointerId;
    const generation = (clickPickGeneration += 1);
    const applyMode = viewport.resolvePickApplyMode?.(event) ?? viewport.pickApplyMode ?? "replace";
    void (inflight.get(pointerId) ?? Promise.resolve()).then(async () => {
      if (options.isDisposed() || generation !== clickPickGeneration) {
        return;
      }
      const session = sessions.get(pointerId);
      inflight.delete(pointerId);
      if (!wasClick) {
        sessions.cancel(pointerId);
        return;
      }
      if (!session || session.consumed || session.status === "dragging") {
        sessions.commit(pointerId);
        return;
      }
      const revisions = adapter.pickingRevisions();
      const click = await resolveClickFromSession(session, revisions.scene, revisions.camera, {
        backendFor: (request) => resolvePickPolicy(request).backend,
        resolve: (request) => adapter.pickPoint(request),
      });
      sessions.commit(pointerId);
      if (click.cancelled) {
        return;
      }
      applyPointPickToSelection(viewport.session.selection, click.result, applyMode);
      viewport.onSelect?.(click.result ?? null);
    });
  };

  const onPointerCancel = (event: PointerEvent): void => {
    pointer.cancel("pointercancel");
    adapter.setHover(null);
    pointerStart = undefined;
    sessions.cancel(event.pointerId);
    inflight.delete(event.pointerId);
  };

  const onLostCapture = (): void => {
    pointer.lostCapture();
    pointerStart = undefined;
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
    viewport.onHoverPick?.(hit);
  };

  if (pickingEnabled) {
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerCancel);
    canvas.addEventListener("lostpointercapture", onLostCapture);
    canvas.addEventListener("pointermove", onPointerMove);
  }

  return {
    pickFromClient,
    pointer,
    invalidateClicks(): void {
      clickPickGeneration += 1;
    },
    dispose(): void {
      sessions.clear();
      inflight.clear();
      if (!pickingEnabled) {
        return;
      }
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerCancel);
      canvas.removeEventListener("lostpointercapture", onLostCapture);
      canvas.removeEventListener("pointermove", onPointerMove);
    },
  };
}
