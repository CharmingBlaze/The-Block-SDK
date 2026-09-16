import { deserializeMesh, faceNormal, serializeMesh, triangulateMesh } from "@modeling-kit/mesh";
import { validateMesh } from "@modeling-kit/validation";
import { describe, expect, it } from "vitest";
import { cube, sphere } from "primitive-geometry";
import {
  convertSimplicialComplex,
  generateBox,
  generateCapsule,
  generateCone,
  generateCylinder,
  generateIcosphere,
  generatePrimitive,
  generateQuadSphere,
  generateRoundedCube,
  generateTorus,
  generateUvSphere,
  getPrimitiveCatalogEntry,
  resolveCellSize,
} from "../src/index";
import { cubeAtlasIsland } from "../src/cube-surface";

function faceSizes(mesh: ReturnType<typeof generateBox>["mesh"]): { tris: number; quads: number; ngons: number } {
  let tris = 0;
  let quads = 0;
  let ngons = 0;
  for (const [faceId] of mesh.faces) {
    const n = mesh.getFaceVertices(faceId).length;
    if (n === 3) {
      tris += 1;
    } else if (n === 4) {
      quads += 1;
    } else {
      ngons += 1;
    }
  }
  return { tris, quads, ngons };
}

function expectNoRepeatedVertexIds(mesh: ReturnType<typeof generateBox>["mesh"]): void {
  for (const [faceId] of mesh.faces) {
    const verts = mesh.getFaceVertices(faceId);
    expect(new Set(verts).size, `${faceId} repeated vertex`).toBe(verts.length);
  }
}

function expectOutward(mesh: ReturnType<typeof generateBox>["mesh"]): void {
  let cx = 0;
  let cy = 0;
  let cz = 0;
  let count = 0;
  for (const vertex of mesh.vertices.values()) {
    cx += vertex.position[0];
    cy += vertex.position[1];
    cz += vertex.position[2];
    count += 1;
  }
  cx /= count;
  cy /= count;
  cz /= count;
  for (const [faceId] of mesh.faces) {
    const n = faceNormal(mesh, faceId);
    const verts = mesh.getFaceVertices(faceId);
    let fx = 0;
    let fy = 0;
    let fz = 0;
    for (const id of verts) {
      const p = mesh.vertices.get(id)!.position;
      fx += p[0];
      fy += p[1];
      fz += p[2];
    }
    fx /= verts.length;
    fy /= verts.length;
    fz /= verts.length;
    expect(n.x * (fx - cx) + n.y * (fy - cy) + n.z * (fz - cz)).toBeGreaterThan(-1e-4);
  }
}

describe("canonical quad-first topology", () => {
  it("keeps the default cube as six quads", () => {
    const cubeMesh = generateBox({ width: 1, height: 1, depth: 1 }).mesh;
    expect(faceSizes(cubeMesh)).toEqual({ tris: 0, quads: 6, ngons: 0 });
    expectNoRepeatedVertexIds(cubeMesh);
    expect(validateMesh(cubeMesh).statistics.isClosed).toBe(true);
    expectOutward(cubeMesh);
    const tri = triangulateMesh(cubeMesh);
    expect(tri.triangleFaceIds).toHaveLength(12);
    expect(new Set(tri.triangleFaceIds).size).toBe(6);
  });

  it("subdivides a cube into only quads", () => {
    const box = generateBox({ width: 1, height: 1, depth: 1, segmentsX: 2, segmentsY: 3, segmentsZ: 4 }).mesh;
    const sizes = faceSizes(box);
    expect(sizes.tris).toBe(0);
    expect(sizes.ngons).toBe(0);
    expect(sizes.quads).toBe(2 * 3 * 2 + 3 * 4 * 2 + 2 * 4 * 2);
    expectNoRepeatedVertexIds(box);
    expect(validateMesh(box).valid).toBe(true);
    expect(validateMesh(box).statistics.isClosed).toBe(true);
  });

  it("builds a closed all-quad sphere from a projected cube grid", () => {
    const result = generateQuadSphere({ radius: 0.5, segments: 3 });
    const sizes = faceSizes(result.mesh);
    expect(sizes.tris).toBe(0);
    expect(sizes.ngons).toBe(0);
    expect(sizes.quads).toBe(6 * 3 * 3);
    expectNoRepeatedVertexIds(result.mesh);
    const validity = validateMesh(result.mesh);
    expect(validity.valid, validity.errors.map((e) => e.code).join(",")).toBe(true);
    expect(validity.statistics.isClosed).toBe(true);
    expectOutward(result.mesh);
    for (const corner of result.mesh.corners.values()) {
      expect(corner.uv).toBeDefined();
      expect(corner.normal).toBeDefined();
    }
    expect([...result.mesh.edges.values()].some((edge) => edge.isSeam)).toBe(true);
    const tri = triangulateMesh(result.mesh);
    expect(tri.triangleFaceIds).toHaveLength(sizes.quads * 2);
    expect(new Set(tri.triangleFaceIds).size).toBe(result.mesh.faces.size);
    const again = deserializeMesh(serializeMesh(result.mesh));
    expect(again.corners.size).toBe(result.mesh.corners.size);
    for (const [id, corner] of result.mesh.corners) {
      expect(again.corners.get(id)?.uv).toEqual(corner.uv);
    }
  });

  it("keeps torus faces as quads", () => {
    const torus = generateTorus({ radius: 0.5, tube: 0.15, radialSegments: 6, tubularSegments: 8 }).mesh;
    expect(faceSizes(torus)).toEqual({ tris: 0, quads: 48, ngons: 0 });
    expect(validateMesh(torus).statistics.isClosed).toBe(true);
    expectNoRepeatedVertexIds(torus);
  });

  it("documents UV sphere mixed topology: quad bands and triangle poles", () => {
    const uv = generateUvSphere({ radius: 0.5, widthSegments: 8, heightSegments: 6 }).mesh;
    const sizes = faceSizes(uv);
    expect(sizes.ngons).toBe(0);
    expect(sizes.tris).toBe(16);
    expect(sizes.quads).toBe(8 * 4);
    expectNoRepeatedVertexIds(uv);
    expect(validateMesh(uv).statistics.isClosed).toBe(true);
    expectOutward(uv);
  });

  it("uses quad cylinder walls and n-gon caps", () => {
    const cylinder = generateCylinder({
      radius: 0.5,
      height: 1,
      radialSegments: 8,
      heightSegments: 2,
      capTop: true,
      capBottom: true,
    }).mesh;
    const sizes = faceSizes(cylinder);
    expect(sizes.quads).toBe(16);
    expect(sizes.ngons).toBe(2);
    expect(sizes.tris).toBe(0);
    expect(validateMesh(cylinder).statistics.isClosed).toBe(true);
  });

  it("keeps icosphere triangular by design", () => {
    const ico = generateIcosphere({ radius: 0.5, subdivisions: 1 }).mesh;
    const sizes = faceSizes(ico);
    expect(sizes.quads).toBe(0);
    expect(sizes.ngons).toBe(0);
    expect(sizes.tris).toBe(80);
    expectNoRepeatedVertexIds(ico);
    expect(validateMesh(ico).statistics.isClosed).toBe(true);
    expectOutward(ico);
  });

  it("uses cone quad bands with triangles only at the apex", () => {
    const cone = generateCone({
      radius: 0.5,
      height: 1,
      radialSegments: 8,
      heightSegments: 2,
      capBottom: true,
    }).mesh;
    const sizes = faceSizes(cone);
    expect(sizes.tris).toBe(8);
    expect(sizes.quads).toBe(8);
    expect(sizes.ngons).toBe(1);
    expectNoRepeatedVertexIds(cone);
    expect(validateMesh(cone).statistics.isClosed).toBe(true);
  });

  it("uses capsule quad bands with triangle pole caps", () => {
    const capsule = generateCapsule({
      radius: 0.5,
      height: 1,
      radialSegments: 8,
      capSegments: 4,
      heightSegments: 1,
    }).mesh;
    const sizes = faceSizes(capsule);
    expect(sizes.ngons).toBe(0);
    expect(sizes.tris).toBe(16);
    expect(sizes.quads).toBeGreaterThan(0);
    expectNoRepeatedVertexIds(capsule);
    expect(validateMesh(capsule).statistics.isClosed).toBe(true);
    expectOutward(capsule);
  });

  it("builds a rounded cube from quad patches", () => {
    const rounded = generateRoundedCube({
      width: 1,
      height: 1,
      depth: 1,
      radius: 0.15,
      roundSegments: 2,
      edgeSegments: 1,
    }).mesh;
    const sizes = faceSizes(rounded);
    expect(sizes.tris).toBe(0);
    expect(sizes.ngons).toBe(0);
    expect(sizes.quads).toBeGreaterThan(0);
    expectNoRepeatedVertexIds(rounded);
    const validity = validateMesh(rounded);
    expect(validity.valid, validity.errors.map((e) => e.code).join(",")).toBe(true);
    expect(validity.statistics.isClosed).toBe(true);
    expectOutward(rounded);
  });

  it("parses primitive-geometry cells as triangles even when length is divisible by 12", () => {
    const raw = sphere({ radius: 0.5, nx: 10, ny: 6 });
    expect(raw.cells.length % 12).toBe(0);
    const converted = convertSimplicialComplex(raw, {
      type: "sphere",
      cellSize: 3,
      weld: { kind: "uv-grid", columns: 11, rows: 7, wrapU: true, wrapV: false, collapsePoles: true },
    });
    expect(converted.library.cellSize).toBe(3);
    expect(faceSizes(converted.mesh).quads).toBe(0);
    expect(faceSizes(converted.mesh).tris).toBeGreaterThan(0);
  });

  it("imports a library cube as triangulated reference geometry, not canonical quads", () => {
    const raw = cube({ sx: 1, sy: 1, sz: 1, nx: 1, ny: 1, nz: 1 });
    const converted = convertSimplicialComplex(raw, {
      type: "cube",
      cellSize: 3,
      orientation: "outward-from-origin",
    });
    expect(converted.library.cellSize).toBe(3);
    expect(converted.mesh.vertices.size).toBe(8);
    expect(faceSizes(converted.mesh)).toEqual({ tris: 12, quads: 0, ngons: 0 });
    expect(generatePrimitive("cube").mesh.faces.size).toBe(6);
  });

  it("does not infer face size from index-buffer length", () => {
    const twelve = new Uint16Array(12);
    expect(twelve.length % 3).toBe(0);
    expect(twelve.length % 4).toBe(0);
    expect(twelve.length % 12).toBe(0);
    expect(() => resolveCellSize(twelve, undefined, "library")).toThrow(/cellSize/);
    expect(resolveCellSize(twelve, 3, "library")).toBe(3);
    expect(resolveCellSize(twelve, 4, "library")).toBe(4);
    expect(() => resolveCellSize(new Uint16Array(4), 3, "library")).toThrow(/multiple of the explicit cellSize/);
    expect(() =>
      convertSimplicialComplex({
        positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
        cells: new Uint16Array([0, 1, 2]),
      }),
    ).toThrow(/cellSize/);
  });

  it("keeps quadSphere UVs in cube-atlas islands and splits render verts at seams", () => {
    const n = 3;
    const result = generateQuadSphere({ radius: 0.5, segments: n });
    expect(result.mesh.vertices.size).toBe(6 * n * n + 2);
    const poles = [...result.mesh.vertices.values()].filter((vertex) => {
      const [x, y, z] = vertex.position;
      return Math.hypot(x, z) < 1e-9 && Math.abs(Math.abs(y) - 0.5) < 1e-9;
    });
    expect(poles.length).toBeLessThanOrEqual(1);

    for (const [faceId] of result.mesh.faces) {
      const verts = result.mesh.getFaceVertices(faceId);
      const corners = result.mesh.getFaceCorners(faceId);
      let u = 0;
      let v = 0;
      for (let i = 0; i < corners.length; i++) {
        const uv = result.mesh.corners.get(corners[i]!)!.uv!;
        expect(uv[0]).toBeGreaterThanOrEqual(0);
        expect(uv[0]).toBeLessThanOrEqual(1);
        expect(uv[1]).toBeGreaterThanOrEqual(0);
        expect(uv[1]).toBeLessThanOrEqual(1);
        u += uv[0];
        v += uv[1];
      }
      u /= verts.length;
      v /= verts.length;
      const col = Math.min(2, Math.max(0, Math.floor(u * 3)));
      const row = Math.min(1, Math.max(0, Math.floor(v * 2)));
      const island = row * 3 + col;
      expect([0, 1, 2, 3, 4, 5]).toContain(island);
    }

    const seam = [...result.mesh.edges.values()].find((edge) => edge.isSeam);
    expect(seam).toBeDefined();
    const ends = result.mesh.getEdgeVertices(seam!.id);
    expect(ends).toBeDefined();
    const tri = triangulateMesh(result.mesh);
    const uvsForVertex = new Set<string>();
    for (let i = 0; i < tri.vertexIdMap.length; i++) {
      if (tri.vertexIdMap[i] === ends![0]) {
        uvsForVertex.add(`${tri.uvs[i * 2]},${tri.uvs[i * 2 + 1]}`);
      }
    }
    expect(uvsForVertex.size).toBeGreaterThan(1);
    expect(result.mesh.vertices.has(ends![0]!)).toBe(true);
    expect(cubeAtlasIsland("+z")).toBe(0);
    for (const faceId of tri.triangleFaceIds) {
      expect(result.mesh.faces.has(faceId)).toBe(true);
    }
    expect(tri.cornerIdMap).toHaveLength(tri.vertexIdMap.length);
  });

  it("routes cube and library cube through distinct catalog entries", () => {
    expect(getPrimitiveCatalogEntry("cube")).toMatchObject({
      generator: "canonical",
      topology: "quads",
      purpose: "editable",
    });
    expect(getPrimitiveCatalogEntry("ellipsoid")).toMatchObject({
      generator: "library",
      purpose: "reference",
    });
    expect(getPrimitiveCatalogEntry("uvSphere").topology).toBe("mixed");
    expect(getPrimitiveCatalogEntry("icosphere").topology).toBe("triangles");
  });

  it("rejects repeated indices instead of collapsing them into a fake polygon", () => {
    expect(() =>
      convertSimplicialComplex(
        {
          positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
          cells: new Uint16Array([0, 1, 1]),
        },
        { cellSize: 3 },
      ),
    ).toThrow(/repeats a vertex index/);
    expect(() =>
      convertSimplicialComplex(
        {
          positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1]),
          cells: new Uint16Array([0, 1, 2, 0, 1, 1]),
        },
        { cellSize: 3, skipDegenerateFaces: false },
      ),
    ).toThrow(/repeats a vertex index/);
    const mixed = convertSimplicialComplex(
      {
        positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1]),
        cells: new Uint16Array([0, 1, 2, 0, 1, 1]),
      },
      { cellSize: 3 },
    );
    expect(mixed.mesh.faces.size).toBe(1);
    expect(mixed.warnings.some((warning) => warning.code === "degenerate-skipped")).toBe(true);
  });

  it("rejects a zero-area triangle when skipDegenerateFaces is false", () => {
    expect(() =>
      convertSimplicialComplex(
        {
          positions: new Float32Array([0, 0, 0, 1, 0, 0, 2, 0, 0]),
          cells: new Uint16Array([0, 1, 2]),
        },
        { cellSize: 3, skipDegenerateFaces: false },
      ),
    ).toThrow(/degenerate|zero area/i);
  });

  it("keeps source-face to canonical-face mapping for a library cube", () => {
    const raw = cube({ sx: 1, sy: 1, sz: 1, nx: 1, ny: 1, nz: 1 });
    const converted = convertSimplicialComplex(raw, {
      type: "cube",
      cellSize: 3,
      orientation: "outward-from-origin",
    });
    expect(converted.sourceFaceToCanonicalFaceIds).toHaveLength(12);
    expect(converted.sourceFaceToCanonicalFaceIds.every((ids) => ids.length === 1)).toBe(true);
    expect(new Set(converted.sourceFaceToCanonicalFaceIds.flat()).size).toBe(12);
  });

  it("builds deterministic quadSpheres at several subdivision levels", () => {
    for (const segments of [1, 2, 4]) {
      const result = generateQuadSphere({ radius: 1, segments });
      const sizes = faceSizes(result.mesh);
      expect(sizes).toEqual({ tris: 0, quads: 6 * segments * segments, ngons: 0 });
      expectNoRepeatedVertexIds(result.mesh);
      expect(validateMesh(result.mesh).statistics.isClosed).toBe(true);
      for (const vertex of result.mesh.vertices.values()) {
        expect(Math.hypot(...vertex.position)).toBeCloseTo(1, 6);
      }
      for (const corner of result.mesh.corners.values()) {
        const position = result.mesh.vertices.get(corner.vertexId)!.position;
        const normal = corner.normal!;
        const length = Math.hypot(...position);
        expect(
          (normal[0] * position[0] + normal[1] * position[1] + normal[2] * position[2]) / length,
        ).toBeCloseTo(1, 5);
      }
    }
  });
});
