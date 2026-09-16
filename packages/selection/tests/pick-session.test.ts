import { brand } from "@modeling-kit/core";
import { describe, expect, it } from "vitest";
import {
  classifyPickSession,
  createPickSession,
  PointerPickSessionStore,
  resolveClickFromSession,
  type PointPickRequest,
} from "../src/picking";

const request: PointPickRequest = {
  clientX: 10,
  clientY: 12,
  canvasRect: { left: 0, top: 0, width: 100, height: 100 },
  domain: "face",
  purpose: "selection",
};

function session(revisions: { scene: number; camera: number }) {
  return createPickSession({
    pointerId: 1,
    clientX: 10,
    clientY: 12,
    request,
    result: {
      kind: "identity",
      source: "gpu-id-buffer",
      domain: "face",
      objectId: brand<string, "ObjectId">("obj"),
      faceId: brand<string, "FaceId">("face"),
    },
    backend: "gpu-id-buffer",
    sceneRevision: revisions.scene,
    cameraRevision: revisions.camera,
  });
}

describe("pick sessions", () => {
  it("reuses the pointer-down result when revisions are unchanged", async () => {
    const store = new PointerPickSessionStore();
    const started = store.begin(session({ scene: 4, camera: 2 }));
    const click = await resolveClickFromSession(started, 4, 2, {
      backendFor: () => "gpu-id-buffer",
      resolve: async () => {
        throw new Error("must not pick again");
      },
    });
    expect(click.reused).toBe(true);
    expect(click.result).toBe(started.result);
    store.applyToolResponse(1, { consumed: true });
    expect(store.get(1)?.consumed).toBe(true);
    expect(store.commit(1)?.consumed).toBe(true);
    expect(store.get(1)).toBeUndefined();
  });

  it("cancels when scene revision changes and reruns when only the camera moves", async () => {
    expect(classifyPickSession(session({ scene: 1, camera: 1 }), 2, 1)).toBe("cancel");
    expect(classifyPickSession(session({ scene: 1, camera: 1 }), 1, 9)).toBe("rerun");
    const rerun = await resolveClickFromSession(session({ scene: 1, camera: 1 }), 1, 9, {
      backendFor: () => "gpu-id-buffer",
      resolve: async () => undefined,
    });
    expect(rerun.reused).toBe(false);
    expect(rerun.cancelled).toBe(false);
  });

  it("cancels click selection when a rerun would mix CPU and GPU backends", async () => {
    const click = await resolveClickFromSession(session({ scene: 1, camera: 1 }), 1, 2, {
      backendFor: () => "cpu-raycast",
      resolve: async () => {
        throw new Error("must not mix backends");
      },
    });
    expect(click.cancelled).toBe(true);
    expect(click.result).toBeUndefined();
  });

  it("records tool consumption, rejection, drag start, and pointer cancel", () => {
    const store = new PointerPickSessionStore();
    const consumed = store.begin(session({ scene: 0, camera: 0 }));
    store.applyToolResponse(consumed.pointerId, { consumed: true });
    expect(consumed.consumed).toBe(true);
    expect(consumed.status).toBe("consumed");

    const rejected = store.begin(session({ scene: 0, camera: 0 }));
    store.applyToolResponse(rejected.pointerId, { consumed: false });
    expect(rejected.consumed).toBe(false);
    expect(rejected.status).toBe("active");

    const dragged = store.begin(
      createPickSession({
        pointerId: 7,
        clientX: 0,
        clientY: 0,
        request,
        result: undefined,
        backend: "gpu-id-buffer",
        sceneRevision: 0,
        cameraRevision: 0,
      }),
    );
    store.applyToolResponse(7, { consumed: false, beginDrag: true });
    expect(store.get(7)?.status).toBe("dragging");
    expect(dragged.consumed).toBe(false);

    store.cancel(7);
    expect(store.get(7)).toBeUndefined();
  });

  it("keeps pointer ids independent", () => {
    const store = new PointerPickSessionStore();
    store.begin(createPickSession({
      pointerId: 1,
      clientX: 0,
      clientY: 0,
      request,
      result: undefined,
      backend: "gpu-id-buffer",
      sceneRevision: 0,
      cameraRevision: 0,
    }));
    store.begin(createPickSession({
      pointerId: 2,
      clientX: 1,
      clientY: 1,
      request,
      result: undefined,
      backend: "cpu-raycast",
      sceneRevision: 0,
      cameraRevision: 0,
    }));
    store.cancel(1);
    expect(store.get(1)).toBeUndefined();
    expect(store.get(2)?.pointerId).toBe(2);
  });
});
