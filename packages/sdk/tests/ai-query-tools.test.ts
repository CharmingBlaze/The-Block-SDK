import { describe, expect, it } from "vitest";
import { createEditor, executeEditorTool } from "../src/ai";

function spawnCube(size = 2): ReturnType<typeof createEditor> {
  const editor = createEditor();
  const result = executeEditorTool(editor, "spawn_primitive", {
    type: "cube",
    width: size,
    height: size,
    depth: size,
  });
  expect(result.ok).toBe(true);
  return editor;
}

describe("editor AI query tools", () => {
  it("reports spatial bounds of a cube", () => {
    const editor = spawnCube(2);
    const result = executeEditorTool(editor, "get_spatial_bounds", {});
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const data = result.data as {
      min: [number, number, number];
      max: [number, number, number];
      center: [number, number, number];
      size: [number, number, number];
      vertexCount: number;
    };
    expect(data.vertexCount).toBe(8);
    expect(data.min).toEqual([-1, -1, -1]);
    expect(data.max).toEqual([1, 1, 1]);
    expect(data.size).toEqual([2, 2, 2]);
    expect(data.center).toEqual([0, 0, 0]);
    editor.dispose();
  });

  it("reports Euler and manifold topology of a cube", () => {
    const editor = spawnCube(2);
    const result = executeEditorTool(editor, "get_mesh_topology_summary", {});
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const data = result.data as {
      vertexCount: number;
      edgeCount: number;
      faceCount: number;
      triangles: number;
      quads: number;
      ngons: number;
      boundaryEdges: number;
      components: number;
      isManifold: boolean;
      isClosed: boolean;
      eulerCharacteristic: number;
      issueCount: number;
    };
    expect(data.vertexCount).toBe(8);
    expect(data.edgeCount).toBe(12);
    expect(data.faceCount).toBe(6);
    expect(data.triangles).toBe(0);
    expect(data.quads).toBe(6);
    expect(data.ngons).toBe(0);
    expect(data.boundaryEdges).toBe(0);
    expect(data.components).toBe(1);
    expect(data.isManifold).toBe(true);
    expect(data.isClosed).toBe(true);
    expect(data.eulerCharacteristic).toBe(2);
    expect(data.issueCount).toBe(0);
    editor.dispose();
  });

  it("reports no anomalies for a clean cube", () => {
    const editor = spawnCube(2);
    const result = executeEditorTool(editor, "detect_mesh_anomalies", {});
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const data = result.data as {
      valid: boolean;
      isManifold: boolean;
      isClosed: boolean;
      errorCount: number;
      warningCount: number;
      errors: unknown[];
    };
    expect(data.valid).toBe(true);
    expect(data.isManifold).toBe(true);
    expect(data.isClosed).toBe(true);
    expect(data.errorCount).toBe(0);
    expect(data.warningCount).toBe(0);
    expect(data.errors).toEqual([]);
    editor.dispose();
  });

  it("finds 90-degree dihedral edges on a cube and none at 0 degrees", () => {
    const editor = spawnCube(2);
    const rightAngles = executeEditorTool(editor, "get_faces_by_angle", { angle: 90, tolerance: 0.01 });
    expect(rightAngles.ok).toBe(true);
    if (!rightAngles.ok) {
      return;
    }
    const data = rightAngles.data as { matchCount: number; matches: Array<{ angleDegrees: number }> };
    expect(data.matchCount).toBe(12);
    expect(data.matches.every((match) => Math.abs(match.angleDegrees - 90) < 0.01)).toBe(true);

    const coplanar = executeEditorTool(editor, "get_faces_by_angle", { angle: 0, tolerance: 0.01 });
    expect(coplanar.ok).toBe(true);
    if (!coplanar.ok) {
      return;
    }
    expect((coplanar.data as { matchCount: number }).matchCount).toBe(0);
    editor.dispose();
  });

  it("returns a single contiguous surface for a cube", () => {
    const editor = spawnCube(2);
    const result = executeEditorTool(editor, "get_contiguous_surfaces", {});
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const data = result.data as {
      componentCount: number;
      components: Array<{ faceCount: number; vertexCount: number }>;
    };
    expect(data.componentCount).toBe(1);
    expect(data.components[0]?.faceCount).toBe(6);
    expect(data.components[0]?.vertexCount).toBe(8);
    editor.dispose();
  });

  it("returns the island centroid and bounds of a cube", () => {
    const editor = spawnCube(2);
    const result = executeEditorTool(editor, "get_island_centroids", {});
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const data = result.data as {
      componentCount: number;
      islands: Array<{
        faceCount: number;
        vertexCount: number;
        centroid: [number, number, number];
        min: [number, number, number];
        max: [number, number, number];
      }>;
    };
    expect(data.componentCount).toBe(1);
    expect(data.islands[0]?.faceCount).toBe(6);
    expect(data.islands[0]?.vertexCount).toBe(8);
    expect(data.islands[0]?.centroid).toEqual([0, 0, 0]);
    expect(data.islands[0]?.min).toEqual([-1, -1, -1]);
    expect(data.islands[0]?.max).toEqual([1, 1, 1]);
    editor.dispose();
  });
});