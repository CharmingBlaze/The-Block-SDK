import { MeshBuilder } from "@modeling-kit/mesh";
import { describe, expect, it } from "vitest";
import { applyAutomaticUnwrapResult, automaticUnwrap, UvUnwrapError } from "../../src/unwrap";
import { getCornerUv, setCornerUv } from "../../src/corners";
import { DEFAULT_UV_CHANNEL } from "../../src/channels";
import { cubeMesh } from "./helpers";
import { identityAtlas, MockUnwrapBackend } from "./mock-backend";
import type { AutomaticUvUnwrapResult } from "../../src/unwrap";

function snapshotUvs(mesh: ReturnType<typeof cubeMesh>) {
  return [...mesh.corners.values()].map((corner) => getCornerUv(mesh, corner.id));
}

describe("automatic chart unwrap failures", () => {
  it("rejects an empty mesh", async () => {
    const mesh = new MeshBuilder().getMesh();
    await expect(automaticUnwrap({ mesh })).rejects.toMatchObject({ code: "empty-mesh" });
  });

  it("rejects non-finite positions", async () => {
    const mesh = cubeMesh();
    const vertex = [...mesh.vertices.values()][0]!;
    vertex.position[0] = Number.NaN;
    await expect(automaticUnwrap({ mesh })).rejects.toBeInstanceOf(UvUnwrapError);
  });

  it("rejects unsupported seam and chart-preservation flags", async () => {
    const mesh = cubeMesh();
    await expect(automaticUnwrap({ mesh, options: { respectExistingSeams: true } })).rejects.toMatchObject({
      code: "unsupported-option",
    });
    await expect(automaticUnwrap({ mesh, options: { preserveExistingCharts: true } })).rejects.toMatchObject({
      code: "unsupported-option",
    });
  });

  it("settles cancellation before native generate when already aborted", async () => {
    const mesh = cubeMesh();
    for (const corner of mesh.corners.values()) {
      setCornerUv(mesh, corner.id, [0.4, 0.6], DEFAULT_UV_CHANNEL);
    }
    const before = snapshotUvs(mesh);
    const controller = new AbortController();
    controller.abort();
    await expect(automaticUnwrap({ mesh }, { signal: controller.signal })).rejects.toMatchObject({
      code: "cancelled",
    });
    expect(snapshotUvs(mesh)).toEqual(before);
  });

  it("leaves the mesh unchanged when the backend fails", async () => {
    const mesh = cubeMesh();
    for (const corner of mesh.corners.values()) {
      setCornerUv(mesh, corner.id, [0.3, 0.3], DEFAULT_UV_CHANNEL);
    }
    const before = snapshotUvs(mesh);
    const backend = new MockUnwrapBackend(() => {
      throw new UvUnwrapError("invalid-atlas", "mock backend failure");
    });
    await expect(automaticUnwrap({ mesh }, { backend })).rejects.toMatchObject({ code: "invalid-atlas" });
    expect(snapshotUvs(mesh)).toEqual(before);
  });

  it("leaves the mesh unchanged when conversion rejects non-finite UVs", async () => {
    const mesh = cubeMesh();
    for (const corner of mesh.corners.values()) {
      setCornerUv(mesh, corner.id, [0.15, 0.85], DEFAULT_UV_CHANNEL);
    }
    const before = snapshotUvs(mesh);
    const backend = new MockUnwrapBackend((input) => {
      const result = identityAtlas(input);
      result.uvs[0] = Number.NaN;
      return result;
    });
    await expect(automaticUnwrap({ mesh }, { backend })).rejects.toMatchObject({ code: "invalid-atlas" });
    expect(snapshotUvs(mesh)).toEqual(before);
  });

  it("leaves the mesh unchanged when triangle mapping validation fails", async () => {
    const mesh = cubeMesh();
    for (const corner of mesh.corners.values()) {
      setCornerUv(mesh, corner.id, [0.11, 0.22], DEFAULT_UV_CHANNEL);
    }
    const before = snapshotUvs(mesh);
    const backend = new MockUnwrapBackend((input) => ({
      ...identityAtlas(input),
      triangleCount: 1,
    }));
    await expect(automaticUnwrap({ mesh }, { backend })).rejects.toMatchObject({ code: "missing-corner-mapping" });
    expect(snapshotUvs(mesh)).toEqual(before);
  });

  it("rolls back a partial apply if seam writes fail", () => {
    const mesh = cubeMesh();
    for (const corner of mesh.corners.values()) {
      setCornerUv(mesh, corner.id, [0.5, 0.5], DEFAULT_UV_CHANNEL);
    }
    const before = snapshotUvs(mesh);
    const cornerUvs = new Map([...mesh.corners.keys()].map((id) => [id, [0.9, 0.1] as const]));
    const result: AutomaticUvUnwrapResult = {
      cornerUvs,
      seamEdgeIds: {
        has(): boolean {
          throw new Error("seam write failed");
        },
      } as unknown as Set<never>,
      islands: [],
      warnings: [],
      statistics: {
        chartCount: 1,
        islandCount: 0,
        atlasWidth: 64,
        atlasHeight: 64,
        inputVertexCount: 8,
        outputVertexCount: 8,
        triangleCount: 12,
        distortion: {
          flippedTriangleCount: 0,
          zeroAreaTriangleCount: 0,
          meanAngleDistortion: 0,
          maxAngleDistortion: 0,
          meanAreaDistortion: 0,
          maxAreaDistortion: 0,
        },
      },
      targetedFaceIds: [...mesh.faces.keys()],
      uvChannel: DEFAULT_UV_CHANNEL,
    };
    expect(() => applyAutomaticUnwrapResult(mesh, result)).toThrow(/seam write failed/);
    expect(snapshotUvs(mesh)).toEqual(before);
  });
});
