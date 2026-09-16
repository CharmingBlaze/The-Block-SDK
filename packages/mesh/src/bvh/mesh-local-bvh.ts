import type { FaceId, MeshId, VertexId } from "@modeling-kit/core";
import {
  buildAabbBvh,
  Ray,
  raycastAabbBvh,
  rayIntersectIndexedTriangle,
  refitAabbBvh,
  triangleBoundsFromPositions,
  Vector3,
  type BvhNode,
} from "@modeling-kit/math";
import type { HalfEdgeMesh } from "../half-edge-mesh";
import { triangulateMesh } from "../triangulate";
import type { TriangulatedMesh } from "../types";

export interface MeshLocalHit {
  readonly faceId: FaceId;
  readonly triangleIndex: number;
  readonly distance: number;
  readonly point: { x: number; y: number; z: number };
}

/**
 * Derived triangle AABB index for one mesh.
 * Rebuilds when topology changes, refits when positions change, and ignores
 * materials, UVs, seams, pins, and selection colors.
 */
export class MeshLocalBvh {
  rebuildCount = 0;
  refitCount = 0;
  primitiveCount = 0;

  private tree: BvhNode<number> | undefined;
  private positions = new Float32Array(0);
  private indices = new Uint32Array(0);
  private triangleFaceIds: FaceId[] = [];
  private vertexIds: VertexId[] = [];
  private topologyRevision = -1;
  private positionsRevision = -1;
  private meshId: MeshId | undefined;
  private disposed = false;

  sync(mesh: HalfEdgeMesh, derived?: TriangulatedMesh): void {
    this.assertOpen();
    if (this.meshId !== mesh.id || mesh.topologyRevision !== this.topologyRevision) {
      this.rebuild(mesh, derived);
      return;
    }
    if (mesh.positionsRevision !== this.positionsRevision) {
      this.refitPositions(mesh);
    }
  }

  raycast(origin: { x: number; y: number; z: number }, direction: { x: number; y: number; z: number }): MeshLocalHit | null {
    if (this.disposed) {
      return null;
    }
    const ray = new Ray(Vector3.from(origin), direction);
    const hit = raycastAabbBvh(this.tree, ray, (triangleIndex, _primitive, current) => {
      const base = triangleIndex * 3;
      return rayIntersectIndexedTriangle(
        current,
        this.positions,
        this.indices[base]!,
        this.indices[base + 1]!,
        this.indices[base + 2]!,
      );
    });
    if (!hit) {
      return null;
    }
    const point = ray.at(hit.distance);
    return {
      faceId: this.triangleFaceIds[hit.item]!,
      triangleIndex: hit.item,
      distance: hit.distance,
      point: { x: point.x, y: point.y, z: point.z },
    };
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.tree = undefined;
    this.positions = new Float32Array(0);
    this.indices = new Uint32Array(0);
    this.triangleFaceIds = [];
    this.vertexIds = [];
    this.primitiveCount = 0;
  }

  private rebuild(mesh: HalfEdgeMesh, derived?: TriangulatedMesh): void {
    const tri = derived ?? triangulateMesh(mesh);
    this.positions = tri.positions.slice();
    this.indices = tri.indices.slice();
    this.triangleFaceIds = [...tri.triangleFaceIds];
    this.vertexIds = [...tri.vertexIdMap];
    const primitives = [];
    const triangleCount = this.indices.length / 3;
    for (let triangleIndex = 0; triangleIndex < triangleCount; triangleIndex += 1) {
      const base = triangleIndex * 3;
      primitives.push({
        item: triangleIndex,
        bounds: triangleBoundsFromPositions(
          this.positions,
          this.indices[base]!,
          this.indices[base + 1]!,
          this.indices[base + 2]!,
        ),
      });
    }
    this.tree = buildAabbBvh(primitives);
    this.meshId = mesh.id;
    this.topologyRevision = mesh.topologyRevision;
    this.positionsRevision = mesh.positionsRevision;
    this.primitiveCount = primitives.length;
    this.rebuildCount += 1;
  }

  private refitPositions(mesh: HalfEdgeMesh): void {
    for (let i = 0; i < this.vertexIds.length; i += 1) {
      const vertex = mesh.vertices.get(this.vertexIds[i]!);
      if (!vertex) {
        continue;
      }
      const base = i * 3;
      this.positions[base] = vertex.position[0];
      this.positions[base + 1] = vertex.position[1];
      this.positions[base + 2] = vertex.position[2];
    }
    refitAabbBvh(this.tree, (triangleIndex) => {
      const base = triangleIndex * 3;
      return triangleBoundsFromPositions(
        this.positions,
        this.indices[base]!,
        this.indices[base + 1]!,
        this.indices[base + 2]!,
      );
    });
    this.positionsRevision = mesh.positionsRevision;
    this.refitCount += 1;
  }

  private assertOpen(): void {
    if (this.disposed) {
      throw new Error("MeshLocalBvh is disposed");
    }
  }
}

export function createMeshLocalBvh(mesh?: HalfEdgeMesh): MeshLocalBvh {
  const index = new MeshLocalBvh();
  if (mesh) {
    index.sync(mesh);
  }
  return index;
}
