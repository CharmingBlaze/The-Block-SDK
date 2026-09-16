import type { CornerId } from "@modeling-kit/core";
import { describe, expect, it } from "vitest";
import { createUvChannel } from "../../src/channels";
import { edgeHasSeam } from "../../src/seams";
import { UV_SEAM_TOLERANCE } from "../../src/unwrap";
import { detectSeamsFromCornerUvs, islandsFromSeams } from "../../src/unwrap/seams";
import { cubeMesh, twoQuadMesh } from "./helpers";

describe("automatic chart unwrap seams and islands", () => {
  it("marks boundary edges and UV discontinuities, not continuous UVs", () => {
    const mesh = twoQuadMesh();
    const faceIds = [...mesh.faces.keys()];
    const selected = new Set(faceIds);
    const shared = [...mesh.edges.values()].find((edge) => {
      const [left, right] = mesh.getEdgeFaces(edge.id);
      return Boolean(left && right);
    });
    expect(shared).toBeDefined();
    const continuous = new Map<CornerId, readonly [number, number]>(
      [...mesh.corners.values()].map((corner) => [corner.id, [0.2, 0.4]]),
    );
    const continuousSeams = detectSeamsFromCornerUvs(mesh, selected, continuous);
    expect(continuousSeams.has(shared!.id)).toBe(false);
    for (const edgeId of mesh.findBoundaryEdges()) {
      expect(continuousSeams.has(edgeId)).toBe(true);
    }
    const discontinuous = new Map(continuous);
    const leftFace = mesh.getEdgeFaces(shared!.id)[0]!;
    const vertexId = mesh.getEdgeVertices(shared!.id)![0]!;
    const leftCorner = mesh.getFaceCorners(leftFace).find((id) => mesh.corners.get(id)?.vertexId === vertexId)!;
    discontinuous.set(leftCorner, [0.2 + UV_SEAM_TOLERANCE * 10, 0.4]);
    expect(detectSeamsFromCornerUvs(mesh, selected, discontinuous).has(shared!.id)).toBe(true);
  });

  it("keeps seam flags specific to the target UV channel", async () => {
    const mesh = cubeMesh();
    const lightmap = createUvChannel(1, { name: "Lightmap" });
    for (const edge of mesh.edges.values()) {
      expect(edgeHasSeam(edge, lightmap.id)).toBe(false);
    }
    const { automaticUnwrap } = await import("../../src/unwrap");
    await automaticUnwrap({ mesh, options: { resolution: 64 } });
    for (const edge of mesh.edges.values()) {
      expect(edgeHasSeam(edge, lightmap.id)).toBe(false);
    }
  });

  it("flood-fills islands and terminates when faces are isolated by seams", () => {
    const mesh = twoQuadMesh();
    const faceIds = [...mesh.faces.keys()];
    const uvs = new Map([...mesh.corners.values()].map((corner) => [corner.id, [0, 0] as const]));
    const connected = islandsFromSeams(mesh, faceIds, new Set(), uvs);
    expect(connected).toHaveLength(1);
    const allEdges = new Set(mesh.edges.keys());
    const isolated = islandsFromSeams(mesh, faceIds, allEdges, uvs);
    expect(isolated).toHaveLength(2);
    expect(isolated.reduce((sum, island) => sum + island.faceIds.length, 0)).toBe(2);
  });
});
