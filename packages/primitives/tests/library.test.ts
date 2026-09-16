import { box, cube, sphere, torus } from "primitive-geometry";
import { deserializeMesh, faceNormal, serializeMesh, triangulateMesh } from "@modeling-kit/mesh";
import { validateMesh } from "@modeling-kit/validation";
import { describe, expect, it } from "vitest";
import {
  convertSimplicialComplex,
  generateLibraryPrimitive,
  generatePrimitive,
  LIBRARY_CLOSED,
  LIBRARY_GEOMETRY_IDS,
  validateLibraryParameters,
  type LibraryGeometryId,
} from "../src/index";

function reducedLibraryParams(kind: LibraryGeometryId) {
  switch (kind) {
    case "rectangle":
      return { width: 1, depth: 1, segmentsX: 2, segmentsZ: 2 };
    case "roundedRectangle":
    case "stadium":
      return { width: 1, depth: 0.5, roundSegments: 4, edgeSegments: 1, radius: 0.15 };
    case "ellipse":
    case "disc":
    case "annulus":
    case "superellipse":
    case "squircle":
    case "reuleux":
      return { radius: 0.5, segments: 12, innerSegments: 3 };
    case "cube":
    case "roundedCube":
      return { width: 1, height: 1, depth: 1, nx: 1, ny: 1, nz: 1, roundSegments: 3, edgeSegments: 1, radius: 0.15 };
    case "sphere":
    case "ellipsoid":
      return { radius: 0.5, widthSegments: 10, heightSegments: 6 };
    case "icosphere":
      return { radius: 0.5, subdivisions: 1 };
    case "cylinder":
    case "cone":
    case "capsule":
      return { radius: 0.3, height: 0.8, radialSegments: 8, heightSegments: 1, roundSegments: 4, capSegments: 1 };
    case "torus":
      return { radius: 0.4, tube: 0.1, segments: 12, radialSegments: 8 };
    default:
      return { radius: 0.5, scale: 0.5 };
  }
}

describe("primitive-geometry conversion", () => {
  it("converts every library geometry with defaults and reduced custom parameters", () => {
    for (const kind of LIBRARY_GEOMETRY_IDS) {
      const result = generateLibraryPrimitive(kind, reducedLibraryParams(kind));
      const { mesh, library } = result;
      expect(library, kind).toBeDefined();
      const validity = validateMesh(mesh);
      expect(validity.valid, `${kind} ${validity.errors.map((issue) => issue.code).join(",")}`).toBe(true);
      expect(validity.statistics.isClosed, kind).toBe(LIBRARY_CLOSED.has(kind));
      expect(mesh.faces.size).toBeGreaterThan(0);
      expect(library?.sourceIndexToVertex.length).toBe(library?.renderVertexCount);
      const tri = triangulateMesh(mesh);
      expect(tri.positions.length).toBeGreaterThan(0);
      expect(tri.normals.length).toBe(tri.positions.length);
      expect(tri.uvs.length).toBe((tri.positions.length / 3) * 2);
      expect(tri.indices.length % 3).toBe(0);
      for (const index of tri.indices) {
        expect(index).toBeGreaterThanOrEqual(0);
        expect(index).toBeLessThan(tri.positions.length / 3);
      }
      for (const value of tri.positions) {
        expect(Number.isFinite(value)).toBe(true);
      }
      for (const value of tri.uvs) {
        expect(Number.isFinite(value)).toBe(true);
      }
      for (const corner of mesh.corners.values()) {
        expect(corner.uv).toBeDefined();
        expect(corner.normal).toBeDefined();
      }
    }
  });

  it("welds coincident render vertices and keeps per-corner UVs on a cube", () => {
    const raw = cube({ sx: 1, sy: 1, sz: 1, nx: 1, ny: 1, nz: 1 });
    const converted = convertSimplicialComplex(raw, { type: "cube", cellSize: 3, orientation: "outward-from-origin" });
    expect(converted.library.hadUvs).toBe(true);
    expect(converted.library.hadNormals).toBe(true);
    expect(converted.mesh.vertices.size).toBe(8);
    expect(converted.library.cellSize).toBe(3);
    expect(converted.mesh.faces.size).toBe(12);
    expect(converted.mesh.corners.size).toBe(36);
    const uniqueCornerUvs = new Set(
      [...converted.mesh.corners.values()].map((corner) => `${corner.vertexId}:${corner.uv?.[0]},${corner.uv?.[1]}`),
    );
    expect(uniqueCornerUvs.size).toBeGreaterThanOrEqual(8);
    const byVertex = new Map<string, Set<string>>();
    for (const corner of converted.mesh.corners.values()) {
      const uvs = byVertex.get(corner.vertexId) ?? new Set<string>();
      uvs.add(`${corner.uv?.[0]},${corner.uv?.[1]}`);
      byVertex.set(corner.vertexId, uvs);
    }
    expect([...byVertex.values()].some((uvs) => uvs.size > 1)).toBe(true);
    const tri = triangulateMesh(converted.mesh);
    expect(tri.positions.length / 3).toBe(36);
    const seams = [...converted.mesh.edges.values()].filter((edge) => edge.isSeam);
    expect(seams.length).toBeGreaterThan(0);
    const cx = 0;
    const cy = 0;
    const cz = 0;
    for (const [faceId] of converted.mesh.faces) {
      const n = faceNormal(converted.mesh, faceId);
      const verts = converted.mesh.getFaceVertices(faceId);
      let fx = 0;
      let fy = 0;
      let fz = 0;
      for (const id of verts) {
        const p = converted.mesh.vertices.get(id)!.position;
        fx += p[0];
        fy += p[1];
        fz += p[2];
      }
      fx /= verts.length;
      fy /= verts.length;
      fz /= verts.length;
      expect(n.x * (fx - cx) + n.y * (fy - cy) + n.z * (fz - cz)).toBeGreaterThan(0);
    }
  });

  it("fills missing UVs and normals for the library box", () => {
    const converted = convertSimplicialComplex(box({ sx: 1, sy: 2, sz: 3 }), { type: "box", cellSize: 4 });
    expect(converted.library.hadUvs).toBe(false);
    expect(converted.library.hadNormals).toBe(false);
    expect(converted.mesh.vertices.size).toBe(8);
    for (const corner of converted.mesh.corners.values()) {
      expect(corner.uv).toBeDefined();
      expect(corner.normal).toBeDefined();
    }
  });

  it("preserves cylinder caps, wrap seams, and outward winding", () => {
    const result = generateLibraryPrimitive("cylinder", {
      radius: 0.5,
      height: 1,
      radialSegments: 8,
      heightSegments: 1,
      capTop: true,
      capBottom: true,
    });
    expect(result.groups.top.length).toBeGreaterThan(0);
    expect(result.groups.bottom.length).toBeGreaterThan(0);
    expect(validateMesh(result.mesh).statistics.isClosed).toBe(true);
    expect(faceNormal(result.mesh, result.groups.top[0]!).y).toBeGreaterThan(0.5);
    expect(faceNormal(result.mesh, result.groups.bottom[0]!).y).toBeLessThan(-0.5);
    expect([...result.mesh.edges.values()].some((edge) => edge.isSeam)).toBe(true);
  });

  it("keeps cone caps facing outward", () => {
    const result = generateLibraryPrimitive("cone", {
      radius: 0.5,
      height: 1,
      radialSegments: 8,
      capBottom: true,
    });
    expect(result.groups.bottom.length).toBeGreaterThan(0);
    expect(faceNormal(result.mesh, result.groups.bottom[0]!).y).toBeLessThan(-0.5);
    expect(validateMesh(result.mesh).statistics.isClosed).toBe(true);
  });

  it("marks sphere and torus wrap seams without dropping poles", () => {
    const uv = generateLibraryPrimitive("sphere", { radius: 0.5, widthSegments: 10, heightSegments: 6 });
    expect(uv.mesh.vertices.size).toBe(2 + 5 * 10);
    expect(validateMesh(uv.mesh).statistics.isClosed).toBe(true);
    expect([...uv.mesh.edges.values()].some((edge) => edge.isSeam)).toBe(true);
    const ring = torus({ radius: 0.4, minorRadius: 0.1, segments: 12, minorSegments: 8 });
    const converted = convertSimplicialComplex(ring, { type: "torus", cellSize: 3, smooth: true });
    expect(validateMesh(converted.mesh).statistics.isClosed).toBe(true);
    expect(converted.mesh.faces.size).toBeGreaterThan(0);
  });

  it("builds rounded-cube and capsule rounding without holes", () => {
    const rounded = generateLibraryPrimitive("roundedCube", {
      width: 1,
      height: 1,
      depth: 1,
      radius: 0.2,
      roundSegments: 4,
      edgeSegments: 1,
    });
    expect(validateMesh(rounded.mesh).statistics.isClosed).toBe(true);
    const capsule = generateLibraryPrimitive("capsule", {
      radius: 0.25,
      height: 0.5,
      radialSegments: 8,
      roundSegments: 4,
    });
    expect(validateMesh(capsule.mesh).statistics.isClosed).toBe(true);
  });

  it("round-trips a converted mesh through serialization", () => {
    const result = generateLibraryPrimitive("tetrahedron", { radius: 0.5 });
    const again = deserializeMesh(serializeMesh(result.mesh));
    expect(again.vertices.size).toBe(result.mesh.vertices.size);
    expect(again.faces.size).toBe(result.mesh.faces.size);
    expect(again.corners.size).toBe(result.mesh.corners.size);
  });

  it("exposes library shapes through the catalog", () => {
    const quad = generatePrimitive("quad", { scale: 0.5 });
    expect(quad.type).toBe("quad");
    expect(validateMesh(quad.mesh).statistics.isClosed).toBe(false);
    expect(generatePrimitive("reuleaux", { radius: 0.5, segments: 12, innerSegments: 3 }).type).toBe("reuleux");
    expect(generatePrimitive("rounded-cube", { width: 1, height: 1, depth: 1, radius: 0.2, roundSegments: 3 }).type).toBe(
      "roundedCube",
    );
  });

  it("rejects invalid input before building a mesh", () => {
    expect(validateLibraryParameters("roundedCube", { width: 0 }).ok).toBe(false);
    expect(() => generateLibraryPrimitive("ellipsoid", { radiusX: -1 })).toThrow(/radiusX/);
    expect(() => generateLibraryPrimitive("annulus", { radius: 0.5, innerRadius: 0.9 })).toThrow(/innerRadius/);
    expect(() => generateLibraryPrimitive("quad", { scale: 0 })).toThrow(/scale/);
    expect(() =>
      convertSimplicialComplex(
        {
          positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
          cells: new Uint16Array([0, 1, 9]),
        },
        { cellSize: 3 },
      ),
    ).toThrow(/out of range/);
    expect(() =>
      convertSimplicialComplex({
        positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
        normals: new Float32Array([0, 0, 1]),
        cells: new Uint16Array([0, 1, 2]),
      }),
    ).toThrow(/normals length/);
    const sphereGeom = sphere({ radius: 0.5, nx: 8, ny: 6 });
    expect(() =>
      convertSimplicialComplex({
        positions: sphereGeom.positions,
        uvs: sphereGeom.uvs,
        cells: sphereGeom.cells,
        normals: sphereGeom.normals.subarray(0, 3),
      }),
    ).toThrow(/normals length/);
  });

  it("does not overwrite supplied UVs", () => {
    const raw = cube({ sx: 1, ny: 1 });
    const converted = convertSimplicialComplex(raw, { type: "cube", cellSize: 3 });
    const firstUv = [raw.uvs[0]!, raw.uvs[1]!] as const;
    const vertexId = converted.sourceIndexToVertex[0]!;
    const match = [...converted.mesh.corners.values()].find(
      (corner) => corner.vertexId === vertexId && corner.uv?.[0] === firstUv[0] && corner.uv[1] === firstUv[1],
    );
    expect(match).toBeDefined();
  });

  it("keeps a source-index map aligned with render vertices", () => {
    const raw = cube({ sx: 1 });
    const converted = convertSimplicialComplex(raw, { type: "cube", cellSize: 3 });
    expect(converted.sourceIndexToVertex).toHaveLength(raw.positions.length / 3);
    for (const id of converted.sourceIndexToVertex) {
      expect(converted.mesh.vertices.has(id)).toBe(true);
    }
  });

  it("does not merge disconnected coincident triangles when weld is none", () => {
    const converted = convertSimplicialComplex(
      {
        positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0]),
        cells: new Uint16Array([0, 1, 2, 3, 4, 5]),
      },
      { cellSize: 3, weld: { kind: "none" } },
    );
    expect(converted.mesh.vertices.size).toBe(6);
    expect(converted.mesh.faces.size).toBe(2);
  });
});
