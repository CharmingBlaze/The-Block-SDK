import { describe, expect, it } from "vitest";
import { UvUnwrapError, buildUvTriangulation } from "../../src/unwrap";
import { assignCornerUvs } from "../../src/unwrap/convert";
import { cubeMesh, quadMesh } from "./helpers";
import { identityAtlas } from "./mock-backend";

describe("automatic chart unwrap conversion", () => {
  it("assigns one finite UV per targeted corner from identity xref", () => {
    const mesh = cubeMesh();
    const built = buildUvTriangulation(mesh, [...mesh.faces.keys()]);
    const assigned = assignCornerUvs(built.mapping, identityAtlas(built.input), built.input.positions.length / 3);
    expect(assigned.size).toBe(mesh.corners.size);
    for (const uv of assigned.values()) {
      expect(uv.every(Number.isFinite)).toBe(true);
    }
  });

  it("rejects conflicting UVs on the same canonical corner instead of averaging", () => {
    const mesh = quadMesh();
    const built = buildUvTriangulation(mesh, [...mesh.faces.keys()]);
    const firstCorner = built.mapping.triangleCornerIds[0]![0]!;
    const secondIndex = built.mapping.triangleCornerIds.findIndex((triple, index) => index > 0 && triple.includes(firstCorner));
    expect(secondIndex).toBeGreaterThan(0);
    const vertexCount = built.input.positions.length / 3;
    const extra = vertexCount;
    const indices = Uint32Array.from(built.input.indices);
    const slot = secondIndex * 3 + built.mapping.triangleCornerIds[secondIndex]!.indexOf(firstCorner);
    indices[slot] = extra;
    const xref = new Uint32Array(extra + 1);
    for (let i = 0; i < vertexCount; i += 1) {
      xref[i] = i;
    }
    xref[extra] = built.mapping.triangleVertexIndices[0]![0]!;
    const uvs = new Float32Array((extra + 1) * 2);
    uvs[0] = 0;
    uvs[1] = 0;
    uvs[extra * 2] = 1;
    uvs[extra * 2 + 1] = 1;
    expect(() =>
      assignCornerUvs(
        built.mapping,
        {
          atlasWidth: 64,
          atlasHeight: 64,
          chartCount: 1,
          triangleCount: built.mapping.triangleCornerIds.length,
          vertexCount: extra + 1,
          indices,
          uvs,
          xref,
        },
        vertexCount,
      ),
    ).toThrow(UvUnwrapError);
    try {
      assignCornerUvs(
        built.mapping,
        {
          atlasWidth: 64,
          atlasHeight: 64,
          chartCount: 1,
          triangleCount: built.mapping.triangleCornerIds.length,
          vertexCount: extra + 1,
          indices,
          uvs,
          xref,
        },
        vertexCount,
      );
    } catch (error) {
      expect(error).toMatchObject({ code: "conflicting-corner-uv", cornerIds: [firstCorner] });
    }
  });
});
