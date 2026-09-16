import { createSequenceIdFactory } from "@modeling-kit/core";
import { deserializeMesh, faceNormal, serializeMesh, triangulateMesh } from "@modeling-kit/mesh";
import { validateMesh } from "@modeling-kit/validation";
import { describe, expect, it } from "vitest";
import {
  generateArch,
  generateBox,
  generateCapsule,
  generateColumn,
  generateCone,
  generateCylinder,
  generateDisc,
  generateGrid,
  generateIcosphere,
  generatePlane,
  generatePrimitive,
  generatePyramid,
  generateRamp,
  generateStairs,
  generateTorus,
  generateUvSphere,
  generateWall,
  validateBoxParameters,
  type PrimitiveType,
} from "../src/index";

function expectValidMesh(type: string, closed: boolean): void {
  const result = generatePrimitive(type as PrimitiveType, reducedParams(type as PrimitiveType));
  const { mesh } = result;
  const validity = validateMesh(mesh);
  expect(validity.valid, `${type} errors ${validity.errors.map((e) => e.code).join(",")}`).toBe(true);
  expect(validity.statistics.isClosed, `${type} closed`).toBe(closed);
  expect(mesh.faces.size).toBeGreaterThan(0);
  expect(triangulateMesh(mesh).triangleFaceIds.length).toBeGreaterThan(0);
  for (const corner of mesh.corners.values()) {
    expect(corner.uv).toBeDefined();
  }
  for (const vertex of mesh.vertices.values()) {
    expect(vertex.position.every(Number.isFinite)).toBe(true);
  }
  if (closed && ["box", "cube", "cylinder"].includes(type)) {
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
      const normal = faceNormal(mesh, faceId);
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
      expect(normal.x * (fx - cx) + normal.y * (fy - cy) + normal.z * (fz - cz)).toBeGreaterThan(-1e-4);
    }
  }
  const grouped = new Set<string>();
  for (const bucket of [result.groups.top, result.groups.bottom, result.groups.front, result.groups.back, result.groups.sides, result.groups.caps]) {
    for (const faceId of bucket) {
      expect(mesh.faces.has(faceId), `${type} group face missing`).toBe(true);
      grouped.add(faceId);
    }
  }
  expect(grouped.size, `${type} semantic groups`).toBeGreaterThan(0);
  for (const [faceId] of mesh.faces) {
    const normal = faceNormal(mesh, faceId);
    expect(normal.lengthSq(), `${type} degenerate face`).toBeGreaterThan(1e-16);
  }
  const again = generatePrimitive(type as PrimitiveType, reducedParams(type as PrimitiveType));
  expect(again.mesh.vertices.size).toBe(mesh.vertices.size);
  expect(again.mesh.faces.size).toBe(mesh.faces.size);
  const positions = [...mesh.vertices.values()].map((v) => v.position.join(",")).sort();
  const againPositions = [...again.mesh.vertices.values()].map((v) => v.position.join(",")).sort();
  expect(againPositions).toEqual(positions);
  const roundTrip = deserializeMesh(serializeMesh(mesh));
  expect(roundTrip.vertices.size).toBe(mesh.vertices.size);
  expect(roundTrip.faces.size).toBe(mesh.faces.size);
}

function reducedParams(type: PrimitiveType) {
  switch (type) {
    case "grid":
      return { segmentsX: 2, segmentsZ: 2 };
    case "disc":
    case "circle":
    case "cylinder":
    case "cone":
    case "column":
      return { segments: 8, radialSegments: 8 };
    case "uvSphere":
      return { widthSegments: 8, heightSegments: 6 };
    case "quadSphere":
      return { radius: 0.5, segments: 2 };
    case "icosphere":
      return { subdivisions: 1 };
    case "torus":
      return { radialSegments: 6, tubularSegments: 8 };
    case "capsule":
      return { radialSegments: 8, capSegments: 4, heightSegments: 1 };
    case "stairs":
      return { steps: 3 };
    case "arch":
      return { segments: 8 };
    case "quad":
      return { scale: 0.5 };
    case "rectangle":
      return { width: 1, depth: 1, segmentsX: 2, segmentsZ: 2 };
    case "roundedRectangle":
    case "stadium":
      return { width: 1, depth: 0.5, radius: 0.15, roundSegments: 4, edgeSegments: 1 };
    case "ellipse":
    case "annulus":
    case "superellipse":
    case "squircle":
    case "reuleux":
      return { radius: 0.5, segments: 10, innerSegments: 3 };
    case "roundedCube":
      return { width: 1, height: 1, depth: 1, radius: 0.15, roundSegments: 3 };
    case "ellipsoid":
      return { radius: 1, widthSegments: 8, heightSegments: 6 };
    case "tetrahedron":
    case "icosahedron":
      return { radius: 0.5 };
    default:
      return {};
  }
}

describe("@modeling-kit/primitives box", () => {
  it("rejects non-positive dimensions", () => {
    expect(validateBoxParameters({ width: 0, height: 1, depth: 1 }).ok).toBe(false);
    expect(() => generateBox({ width: -1, height: 1, depth: 1 })).toThrow(/width/);
  });

  it("meets the canonical box acceptance bar", () => {
    const ids = createSequenceIdFactory("box");
    const faceIds = {
      posX: ids.face(),
      negX: ids.face(),
      posY: ids.face(),
      negY: ids.face(),
      posZ: ids.face(),
      negZ: ids.face(),
    };
    const result = generateBox(
      { width: 2, height: 3, depth: 1 },
      { meshId: ids.mesh(), faceIds },
    );
    const { mesh, groups } = result;

    expect(mesh.vertices.size).toBe(8);
    expect(mesh.edges.size).toBe(12);
    expect(mesh.faces.size).toBe(6);
    expect(mesh.corners.size).toBe(24);
    expect(mesh.halfEdges.size).toBe(24);
    expect(triangulateMesh(mesh).triangleFaceIds.length).toBe(12);
    expect(validateMesh(mesh).valid).toBe(true);
    expect(validateMesh(mesh).statistics.isClosed).toBe(true);

    expect(groups.top).toEqual([faceIds.posY]);
    expect(groups.posY).toBe(faceIds.posY);
    expect(faceNormal(mesh, groups.posY!).y).toBeGreaterThan(0.9);
    expect(faceNormal(mesh, groups.negY!).y).toBeLessThan(-0.9);
    expect(faceNormal(mesh, groups.posZ!).z).toBeGreaterThan(0.9);
    expect(faceNormal(mesh, groups.negZ!).z).toBeLessThan(-0.9);
    expect(faceNormal(mesh, groups.posX!).x).toBeGreaterThan(0.9);
    expect(faceNormal(mesh, groups.negX!).x).toBeLessThan(-0.9);
  });
});

describe("@modeling-kit/primitives topology", () => {
  it("builds open planar primitives with +Y normals", () => {
    const plane = generatePlane({ width: 2, depth: 4 });
    expect(plane.mesh.vertices.size).toBe(4);
    expect(plane.mesh.faces.size).toBe(1);
    expect(plane.mesh.findBoundaryEdges()).toHaveLength(4);
    expect(faceNormal(plane.mesh, plane.groups.top[0]!).y).toBeGreaterThan(0.9);

    const grid = generateGrid({ width: 2, depth: 2, segmentsX: 2, segmentsZ: 3 });
    expect(grid.mesh.vertices.size).toBe(3 * 4);
    expect(grid.mesh.faces.size).toBe(6);
    expect(validateMesh(grid.mesh).statistics.isClosed).toBe(false);
    expect(faceNormal(grid.mesh, grid.groups.top[0]!).y).toBeGreaterThan(0.9);

    const disc = generateDisc({ radius: 1, segments: 8 });
    expect(disc.mesh.vertices.size).toBe(9);
    expect(disc.mesh.faces.size).toBe(8);
    expect(faceNormal(disc.mesh, disc.groups.top[0]!).y).toBeGreaterThan(0.9);
  });

  it("builds closed solids with outward caps", () => {
    const cylinder = generateCylinder({
      radius: 1,
      height: 2,
      radialSegments: 8,
      heightSegments: 2,
      capTop: true,
      capBottom: true,
    });
    expect(cylinder.mesh.vertices.size).toBe(8 * 3);
    expect(cylinder.mesh.faces.size).toBe(8 * 2 + 2);
    expect(validateMesh(cylinder.mesh).statistics.isClosed).toBe(true);
    expect(faceNormal(cylinder.mesh, cylinder.groups.top[0]!).y).toBeGreaterThan(0.9);
    expect(faceNormal(cylinder.mesh, cylinder.groups.bottom[0]!).y).toBeLessThan(-0.9);

    const cone = generateCone({
      radius: 1,
      height: 2,
      radialSegments: 8,
      heightSegments: 1,
      capBottom: true,
    });
    expect(cone.mesh.vertices.size).toBe(1 + 8);
    expect(validateMesh(cone.mesh).statistics.isClosed).toBe(true);
    expect(faceNormal(cone.mesh, cone.groups.bottom[0]!).y).toBeLessThan(-0.9);

    const pyramid = generatePyramid({ width: 2, depth: 2, height: 2 });
    expect(pyramid.mesh.vertices.size).toBe(5);
    expect(pyramid.mesh.faces.size).toBe(5);
    expect(faceNormal(pyramid.mesh, pyramid.groups.bottom[0]!).y).toBeLessThan(-0.9);
    expect(faceNormal(pyramid.mesh, pyramid.groups.front[0]!).z).toBeGreaterThan(0);

    const capsule = generateCapsule({
      radius: 0.5,
      height: 1,
      radialSegments: 8,
      capSegments: 4,
      heightSegments: 1,
    });
    expect(validateMesh(capsule.mesh).statistics.isClosed).toBe(true);
    expect([...capsule.mesh.vertices.values()].every((v) => Number.isFinite(v.position[1]))).toBe(true);
  });

  it("builds spheres and a torus as closed manifolds", () => {
    const uv = generateUvSphere({ radius: 1, widthSegments: 8, heightSegments: 6 });
    expect(validateMesh(uv.mesh).statistics.isClosed).toBe(true);
    expect(uv.mesh.vertices.size).toBe(2 + 8 * 5);

    const ico = generateIcosphere({ radius: 1, subdivisions: 1 });
    expect(ico.mesh.faces.size).toBe(80);
    expect(validateMesh(ico.mesh).statistics.isClosed).toBe(true);

    const torus = generateTorus({ radius: 1, tube: 0.25, radialSegments: 6, tubularSegments: 8 });
    expect(torus.mesh.vertices.size).toBe(6 * 8);
    expect(torus.mesh.faces.size).toBe(6 * 8);
    expect(validateMesh(torus.mesh).statistics.isClosed).toBe(true);
  });

  it("builds architectural hulls without internal faces", () => {
    const ramp = generateRamp({ width: 2, height: 1, depth: 3 });
    expect(ramp.mesh.vertices.size).toBe(6);
    expect(ramp.mesh.faces.size).toBe(5);
    expect(validateMesh(ramp.mesh).statistics.isClosed).toBe(true);
    expect(faceNormal(ramp.mesh, ramp.groups.bottom[0]!).y).toBeLessThan(-0.9);

    const stairs = generateStairs({ width: 2, height: 1, depth: 2, steps: 4 });
    expect(validateMesh(stairs.mesh).valid).toBe(true);
    expect(validateMesh(stairs.mesh).statistics.isClosed).toBe(true);
    expect(stairs.groups.top).toHaveLength(4);
    expect(faceNormal(stairs.mesh, stairs.groups.top[0]!).y).toBeGreaterThan(0.9);

    const wall = generateWall({ width: 4, height: 2, depth: 0.2 });
    expect(wall.mesh.vertices.size).toBe(8);
    expect([...wall.mesh.vertices.values()].every((v) => v.position[1] >= -1e-9)).toBe(true);
    expect(validateMesh(wall.mesh).statistics.isClosed).toBe(true);

    const column = generateColumn({ radius: 0.5, height: 3, radialSegments: 8 });
    expect([...column.mesh.vertices.values()].every((v) => v.position[1] >= -1e-9)).toBe(true);
    expect(faceNormal(column.mesh, column.groups.top[0]!).y).toBeGreaterThan(0.9);

    const arch = generateArch({ innerRadius: 0.5, outerRadius: 1, depth: 0.4, segments: 8 });
    expect(validateMesh(arch.mesh).valid).toBe(true);
    expect(validateMesh(arch.mesh).statistics.isClosed).toBe(true);
  });

  it("validates every catalog type", () => {
    const open: PrimitiveType[] = [
      "plane",
      "grid",
      "disc",
      "circle",
      "quad",
      "rectangle",
      "roundedRectangle",
      "stadium",
      "ellipse",
      "annulus",
      "superellipse",
      "squircle",
      "reuleux",
    ];
    const closed: PrimitiveType[] = [
      "box",
      "cube",
      "cylinder",
      "cone",
      "pyramid",
      "uvSphere",
      "quadSphere",
      "icosphere",
      "torus",
      "capsule",
      "ramp",
      "stairs",
      "arch",
      "wall",
      "column",
      "roundedCube",
      "ellipsoid",
      "tetrahedron",
      "icosahedron",
    ];
    for (const type of open) {
      expectValidMesh(type, false);
    }
    for (const type of closed) {
      expectValidMesh(type, true);
    }
  });

  it("maps document kebab aliases onto catalog ids", () => {
    const kebab = generatePrimitive("uv-sphere", { widthSegments: 8, heightSegments: 6 });
    const camel = generatePrimitive("uvSphere", { widthSegments: 8, heightSegments: 6 });
    expect(kebab.mesh.faces.size).toBe(camel.mesh.faces.size);
    const ico = generatePrimitive("ico-sphere", { subdivisions: 1 });
    expect(ico.type).toBe("icosphere");
    expect(generatePrimitive("pryamid", { width: 1, depth: 1, height: 1 }).type).toBe("pyramid");
    expect(generatePrimitive("sphere", { widthSegments: 8, heightSegments: 6 }).type).toBe("uvSphere");
    expect(generatePrimitive("quad-sphere", { segments: 2 }).type).toBe("quadSphere");
  });
});
