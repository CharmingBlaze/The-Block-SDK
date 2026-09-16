import { triangulatePolygon } from "@modeling-kit/mesh";
import { describe, expect, it } from "vitest";
import { automaticUnwrap, buildUvTriangulation } from "../../src/unwrap";
import { getCornerUv } from "../../src/corners";
import { canonicalSnapshot, concaveNgonMesh, cubeMesh } from "./helpers";

describe("automatic chart unwrap triangulation mapping", () => {
  it("preserves canonical IDs, loops, materials, normals, and positions", async () => {
    const mesh = cubeMesh();
    const face = [...mesh.faces.values()][0]!;
    face.materialSlot = 4;
    const corner = mesh.corners.get(mesh.getFaceCorners(face.id)[0]!)!;
    mesh.corners.set(corner.id, { ...corner, normal: [0, 1, 0] });
    const before = canonicalSnapshot(mesh);
    const vertexIds = new Set(before.vertexIds);
    await automaticUnwrap({ mesh, options: { resolution: 128 } });
    expect(canonicalSnapshot(mesh)).toEqual(before);
    expect([...mesh.vertices.keys()].every((id) => vertexIds.has(id))).toBe(true);
  });

  it("maps n-gon triangles through the canonical triangulator, not a fan", () => {
    const mesh = concaveNgonMesh();
    const faceId = [...mesh.faces.keys()][0]!;
    const verts = mesh.getFaceVertices(faceId);
    const corners = mesh.getFaceCorners(faceId);
    const points = verts.map((id) => {
      const vertex = mesh.vertices.get(id)!;
      return [vertex.position[0], vertex.position[1], vertex.position[2]] as const;
    });
    const canonical = triangulatePolygon(points, { rejectSelfIntersecting: true });
    expect(canonical.status).toBe("ok");
    const built = buildUvTriangulation(mesh, [faceId]);
    expect(built.mapping.triangleFaceIds.every((id) => id === faceId)).toBe(true);
    const canonicalCorners = canonical.sourceVertexIndices.map(
      (triple) => [corners[triple[0]!], corners[triple[1]!], corners[triple[2]!]] as const,
    );
    expect(built.mapping.triangleCornerIds).toEqual(canonicalCorners);
    const naiveFanCorners = Array.from({ length: verts.length - 2 }, (_, index) => [
      corners[0],
      corners[index + 1],
      corners[index + 2],
    ]);
    const canonicalIsNaiveFan = JSON.stringify(canonicalCorners) === JSON.stringify(naiveFanCorners);
    if (!canonicalIsNaiveFan) {
      expect(built.mapping.triangleCornerIds).not.toEqual(naiveFanCorners);
    }
    expect(built.vertexIds).toHaveLength(verts.length);
    expect([...built.vertexIds].sort()).toEqual([...verts].sort());
  });

  it("keeps xatlas output vertices out of the editable mesh", async () => {
    const mesh = cubeMesh();
    const beforeCount = mesh.vertices.size;
    const result = await automaticUnwrap({ mesh, options: { resolution: 128 } });
    expect(mesh.vertices.size).toBe(beforeCount);
    expect(result.statistics.outputVertexCount).toBeGreaterThanOrEqual(result.statistics.inputVertexCount);
    for (const faceId of result.targetedFaceIds) {
      for (const cornerId of mesh.getFaceCorners(faceId)) {
        expect(getCornerUv(mesh, cornerId).every(Number.isFinite)).toBe(true);
      }
    }
  });
});
