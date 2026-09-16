import { describe, expect, it } from "vitest";
import { XAtlasUnwrapBackend, buildUvTriangulation } from "../../src/unwrap";
import { cubeMesh } from "./helpers";

describe("XAtlasUnwrapBackend", () => {
  it("initializes once, unwraps a cube, and rejects use after dispose", async () => {
    const backend = new XAtlasUnwrapBackend();
    await backend.initialize();
    await backend.initialize();
    const mesh = cubeMesh();
    const triangulation = buildUvTriangulation(mesh, [...mesh.faces.keys()]);
    const result = await backend.unwrap(triangulation.input, { resolution: 256, padding: 2 });
    expect(result.atlasWidth).toBeGreaterThan(0);
    expect(result.atlasHeight).toBeGreaterThan(0);
    expect(result.triangleCount).toBe(triangulation.input.indices.length / 3);
    expect(result.xref.length).toBe(result.vertexCount);
    expect(result.uvs.every((value) => Number.isFinite(value))).toBe(true);
    backend.dispose();
    await expect(backend.unwrap(triangulation.input, {})).rejects.toMatchObject({ code: "disposed" });
  });
});
