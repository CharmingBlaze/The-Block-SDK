import { brand } from "@modeling-kit/core";
import { describe, expect, it } from "vitest";
import { pickPointHybrid, type HybridPickContext } from "../src/hybrid-pick";
import type { DefaultGpuPickingService } from "../src/gpu-picking/service";
import type { PickResult } from "../src/picking";
import { gpuIdentityFromHit } from "../src/gpu-picking/gpu-result-adapter";

const objectId = brand<string, "ObjectId">("obj");

function cpuHit(): PickResult {
  return {
    domain: "face",
    objectId,
    elementId: "face",
    faceId: brand<string, "FaceId">("face"),
    point: { x: 0.2, y: 0.1, z: 1 },
    distance: 4,
  };
}

describe("hybrid pick overflow and identity conversion", () => {
  it("does not invent a world point when adapting a GPU identity hit", () => {
    const identity = gpuIdentityFromHit(
      {
        objectId,
        faceId: brand<string, "FaceId">("face"),
        screenDistance: 0,
        source: "gpu-id-buffer",
      },
      "face",
    );
    expect(identity.kind).toBe("identity");
    expect("worldPoint" in identity).toBe(false);
    expect("point" in identity).toBe(false);
  });

  it("falls back to CPU when GPU IDs overflow", async () => {
    const context: HybridPickContext = {
      gpuPickingMode: "software",
      gpuPicking: {
        diagnostics: () => ({
          backend: "gpu-id-buffer",
          lastBackend: "gpu-id-buffer",
          registrySize: 1,
          lastInvalidation: null,
          disposed: false,
          pendingRequests: 0,
          geometryBuilds: 1,
          pickRenders: 1,
          idOverflow: true,
          uniqueFaceIds: 0,
          triangleSlots: 0,
          hasReadback: true,
          contextLost: false,
        }),
        pick: async () => undefined,
      } as unknown as DefaultGpuPickingService,
      renderer: { setSize: () => undefined, setPixelRatio: () => undefined },
      viewport: { width: 800, height: 600, pixelRatio: 1 },
      lastPickSource: "unavailable",
      pick: () => cpuHit(),
    };
    const hit = await pickPointHybrid(context, {
      clientX: 400,
      clientY: 300,
      canvasRect: { left: 0, top: 0, width: 800, height: 600 },
      domain: "face",
      purpose: "selection",
    });
    expect(context.lastPickFailure).toBe("id-overflow");
    expect(context.lastPickSource).toBe("cpu-raycast");
    expect(hit?.kind).toBe("identity");
    expect(hit?.objectId).toBe(objectId);
    if (hit?.kind === "identity") {
      expect("worldPoint" in hit).toBe(false);
    }
  });
});
