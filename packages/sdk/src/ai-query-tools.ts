/**
 * @packageDocumentation
 * Read-only mesh introspection algorithms backing the AI query tools
 * (`get_spatial_bounds`, `get_mesh_topology_summary`, `detect_mesh_anomalies`,
 * `get_faces_by_angle`, `get_contiguous_surfaces`, `get_island_centroids`).
 *
 * These are pure queries over the half-edge kernel: they never mutate the mesh
 * and return plain JSON-friendly records consumed by the executor (`./ai`).
 * Argument parsing and `requireTargetMesh` stay in the executor so this module
 * has no reverse dependency on the tool dispatcher.
 */
import type { FaceId } from "@modeling-kit/core";
import type { FluentMeshObject } from "@modeling-kit/commands";
import { faceNormal } from "@modeling-kit/mesh";
import { validateMesh } from "@modeling-kit/validation";

/** The live half-edge mesh owned by a fluent mesh object (nullable until checked). */
export type ActiveMesh = NonNullable<FluentMeshObject["mesh"]>;

/** Axis-aligned bounds, center, and size of every vertex in the mesh. */
function spatialBounds(object: FluentMeshObject, mesh: ActiveMesh): Record<string, unknown> {
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (const vertex of mesh.vertices.values()) {
    const [x, y, z] = vertex.position;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (z < minZ) minZ = z;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    if (z > maxZ) maxZ = z;
  }
  return {
    objectId: object.objectId,
    meshId: object.meshId,
    min: [minX, minY, minZ],
    max: [maxX, maxY, maxZ],
    center: [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2],
    size: [maxX - minX, maxY - minY, maxZ - minZ],
    vertexCount: mesh.vertices.size,
  };
}

/** Euler + manifold topology statistics (counts, components, seams, creases). */
function topologySummary(object: FluentMeshObject, mesh: ActiveMesh): Record<string, unknown> {
  let triangles = 0;
  let quads = 0;
  let ngons = 0;
  for (const faceId of mesh.faces.keys()) {
    const count = mesh.getFaceVertices(faceId).length;
    if (count === 3) {
      triangles += 1;
    } else if (count === 4) {
      quads += 1;
    } else {
      ngons += 1;
    }
  }
  let seams = 0;
  let creases = 0;
  for (const edge of mesh.edges.values()) {
    if (edge.isSeam || (edge.seamChannels && edge.seamChannels.length > 0)) {
      seams += 1;
    }
    if ((edge.creaseWeight ?? 0) > 0) {
      creases += 1;
    }
  }
  const validation = validateMesh(mesh);
  const vertexCount = mesh.vertices.size;
  const edgeCount = mesh.edges.size;
  const faceCount = mesh.faces.size;
  return {
    objectId: object.objectId,
    meshId: object.meshId,
    vertexCount,
    edgeCount,
    faceCount,
    triangles,
    quads,
    ngons,
    boundaryEdges: mesh.findBoundaryEdges().length,
    components: mesh.findConnectedComponents().length,
    seams,
    creases,
    isManifold: validation.statistics.isManifold,
    isClosed: validation.statistics.isClosed,
    eulerCharacteristic: vertexCount - edgeCount + faceCount,
    issueCount: validation.errors.length + validation.warnings.length,
  };
}

/** Structural validation summarized as structured anomalies for an agent. */
function meshAnomalies(mesh: ActiveMesh): Record<string, unknown> {
  const result = validateMesh(mesh);
  const toIssue = (issue: (typeof result.errors)[number]) => ({
    code: issue.code,
    message: issue.message,
    elementIds: [...issue.elementIds],
    recoverable: issue.recoverable,
  });
  return {
    valid: result.valid,
    isManifold: result.statistics.isManifold,
    isClosed: result.statistics.isClosed,
    errorCount: result.errors.length,
    warningCount: result.warnings.length,
    errors: result.errors.map(toIssue),
    warnings: result.warnings.map(toIssue),
  };
}

/** Dihedral angle between two faces' normals, in degrees (0 = coplanar, 180 = opposite). */
function dihedralDegrees(mesh: ActiveMesh, f1: FaceId, f2: FaceId): number | undefined {
  const a = faceNormal(mesh, f1);
  const b = faceNormal(mesh, f2);
  const la = Math.hypot(a.x, a.y, a.z);
  const lb = Math.hypot(b.x, b.y, b.z);
  if (la < 1e-12 || lb < 1e-12) {
    return undefined;
  }
  const dot = (a.x * b.x + a.y * b.y + a.z * b.z) / (la * lb);
  const clamped = Math.min(1, Math.max(-1, dot));
  return (Math.acos(clamped) * 180) / Math.PI;
}

/** Shared-edge face pairs whose dihedral angle matches `targetDegrees` within `toleranceDegrees`. */
function facesByAngle(
  mesh: ActiveMesh,
  targetDegrees: number,
  toleranceDegrees: number,
): Record<string, unknown> {
  const matches: Record<string, unknown>[] = [];
  for (const [edgeId] of mesh.edges) {
    const [f1, f2] = mesh.getEdgeFaces(edgeId);
    if (!f1 || !f2) {
      continue;
    }
    const angle = dihedralDegrees(mesh, f1, f2);
    if (angle === undefined) {
      continue;
    }
    if (Math.abs(angle - targetDegrees) <= toleranceDegrees) {
      matches.push({ edgeId, faceA: f1, faceB: f2, angleDegrees: angle });
    }
  }
  return {
    targetAngleDegrees: targetDegrees,
    toleranceDegrees,
    matchCount: matches.length,
    matches,
  };
}

/** Partition of the mesh into connected face/vertex islands. */
function contiguousSurfaces(mesh: ActiveMesh): Record<string, unknown> {
  const components = mesh.findConnectedComponents();
  return {
    componentCount: components.length,
    components: components.map((component, index) => ({
      index,
      faceCount: component.faceIds.length,
      vertexCount: component.vertexIds.length,
      faceIds: [...component.faceIds],
      vertexIds: [...component.vertexIds],
    })),
  };
}

/** Centroid and bounds of each connected island (component). */
function islandCentroids(mesh: ActiveMesh): Record<string, unknown> {
  const components = mesh.findConnectedComponents();
  return {
    componentCount: components.length,
    islands: components.map((component, index) => {
      let cx = 0;
      let cy = 0;
      let cz = 0;
      let minX = Infinity;
      let minY = Infinity;
      let minZ = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      let maxZ = -Infinity;
      for (const vertexId of component.vertexIds) {
        const vertex = mesh.vertices.get(vertexId);
        if (!vertex) {
          continue;
        }
        const [x, y, z] = vertex.position;
        cx += x;
        cy += y;
        cz += z;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (z < minZ) minZ = z;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
        if (z > maxZ) maxZ = z;
      }
      const n = component.vertexIds.length || 1;
      return {
        index,
        faceCount: component.faceIds.length,
        vertexCount: component.vertexIds.length,
        centroid: [cx / n, cy / n, cz / n],
        min: [minX, minY, minZ],
        max: [maxX, maxY, maxZ],
      };
    }),
  };
}

export { contiguousSurfaces, facesByAngle, islandCentroids, meshAnomalies, spatialBounds, topologySummary };