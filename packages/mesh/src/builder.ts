import {
  brand,
  type VertexId,
  type EdgeId,
  type HalfEdgeId,
  type FaceId,
  type CornerId,
  type MeshId,
  type MaterialSlotId,
} from "@modeling-kit/core";
import { HalfEdgeMesh } from "./half-edge-mesh";
import type { VertexRecord, EdgeRecord, HalfEdgeRecord, CornerRecord, FaceRecord } from "./types";

export interface AddFaceOptions {
  id?: FaceId;
  materialSlot?: number;
  materialSlotId?: MaterialSlotId | null;
  isSmooth?: boolean;
  uvs?: [u: number, v: number][];
  normals?: [nx: number, ny: number, nz: number][];
  colors?: [r: number, g: number, b: number, a: number][];
}

export interface CubeFaceIds {
  readonly posX: FaceId;
  readonly negX: FaceId;
  readonly posY: FaceId;
  readonly negY: FaceId;
  readonly posZ: FaceId;
  readonly negZ: FaceId;
}

export class MeshBuilder {
  private mesh: HalfEdgeMesh;
  private vCount = 0;
  private eCount = 0;
  private heCount = 0;
  private fCount = 0;
  private cCount = 0;

  // Map from "vA_vB" (directed) to HalfEdgeId for twin lookup
  private directedHalfEdges = new Map<string, HalfEdgeId>();
  // Map from sorted "vA_vB" to EdgeId
  private undirectedEdges = new Map<string, EdgeId>();

  constructor(meshId?: MeshId) {
    this.mesh = new HalfEdgeMesh(meshId);
  }

  getMesh(): HalfEdgeMesh {
    return this.mesh;
  }

  private allocateId(
    existing: { has(id: string): boolean },
    prefix: string,
    counter: "vCount" | "eCount" | "heCount" | "fCount" | "cCount",
  ): string {
    let id: string;
    do {
      this[counter] += 1;
      id = `${prefix}_${this[counter]}`;
    } while (existing.has(id));
    return id;
  }

  addVertex(x: number, y: number, z: number, id?: VertexId): VertexId {
    const vId = id ?? brand<string, "VertexId">(this.allocateId(this.mesh.vertices, "v", "vCount"));
    const record: VertexRecord = {
      id: vId,
      position: [x, y, z],
      halfEdge: null,
    };
    this.mesh.vertices.set(vId, record);
    return vId;
  }

  addFace(vertexIds: readonly VertexId[], options?: AddFaceOptions): FaceId {
    if (vertexIds.length < 3) {
      throw new RangeError("A face must have at least 3 vertices.");
    }

    const fId =
      options?.id ?? brand<string, "FaceId">(this.allocateId(this.mesh.faces, "f", "fCount"));
    const halfEdgeIds: HalfEdgeId[] = [];
    const cornerIds: CornerId[] = [];

    const n = vertexIds.length;
    for (let i = 0; i < n; i++) {
      const vFrom = vertexIds[i]!;
      const vTo = vertexIds[(i + 1) % n]!;

      // Find or create undirected edge
      const edgeKey = vFrom < vTo ? `${vFrom}_${vTo}` : `${vTo}_${vFrom}`;
      let eId = this.undirectedEdges.get(edgeKey);
      const heId = brand<string, "HalfEdgeId">(
        this.allocateId(this.mesh.halfEdges, "he", "heCount"),
      );
      halfEdgeIds.push(heId);

      if (!eId) {
        eId = brand<string, "EdgeId">(this.allocateId(this.mesh.edges, "e", "eCount"));
        const edgeRecord: EdgeRecord = {
          id: eId,
          halfEdge: heId,
          isSeam: false,
        };
        this.mesh.edges.set(eId, edgeRecord);
        this.undirectedEdges.set(edgeKey, eId);
      }

      // Create corner
      const cId = brand<string, "CornerId">(this.allocateId(this.mesh.corners, "c", "cCount"));
      const uv = options?.uvs?.[i];
      const normal = options?.normals?.[i];
      const color = options?.colors?.[i];
      const cornerRecord: CornerRecord = {
        id: cId,
        vertexId: vFrom,
        faceId: fId,
        ...(uv !== undefined ? { uv } : {}),
        ...(normal !== undefined ? { normal } : {}),
        ...(color !== undefined ? { color } : {}),
      };
      this.mesh.corners.set(cId, cornerRecord);
      cornerIds.push(cId);

      // Check for twin half-edge (directed reverse: vTo -> vFrom)
      const reverseKey = `${vTo}_${vFrom}`;
      const twinId = this.directedHalfEdges.get(reverseKey) ?? null;

      const heRecord: HalfEdgeRecord = {
        id: heId,
        edgeId: eId,
        origin: vFrom,
        twin: twinId,
        next: heId, // patched in next loop
        prev: heId, // patched in next loop
        face: fId,
        corner: cId,
      };
      this.mesh.halfEdges.set(heId, heRecord);
      this.directedHalfEdges.set(`${vFrom}_${vTo}`, heId);

      if (twinId) {
        const twinRecord = this.mesh.halfEdges.get(twinId);
        if (twinRecord) {
          twinRecord.twin = heId;
        }
      }

      // Update vertex outward pointer
      const vRecord = this.mesh.vertices.get(vFrom);
      if (vRecord && !vRecord.halfEdge) {
        vRecord.halfEdge = heId;
      }
    }

    // Connect next/prev cyclically
    for (let i = 0; i < n; i++) {
      const curr = halfEdgeIds[i]!;
      const next = halfEdgeIds[(i + 1) % n]!;
      const prev = halfEdgeIds[(i - 1 + n) % n]!;

      const he = this.mesh.halfEdges.get(curr)!;
      he.next = next;
      he.prev = prev;
    }

    // Create face record
    const faceRecord: FaceRecord = {
      id: fId,
      halfEdge: halfEdgeIds[0]!,
      materialSlot: options?.materialSlot ?? 0,
      materialSlotId: options?.materialSlotId ?? null,
      isSmooth: options?.isSmooth ?? false,
    };
    this.mesh.faces.set(fId, faceRecord);
    this.mesh.bumpRevision();

    return fId;
  }

  /**
   * Procedurally generates a 6-face polygonal box in 3D space.
   */
  static createCube(
    width = 1,
    height = 1,
    depth = 1,
    meshId?: MeshId,
    faceIds?: CubeFaceIds,
  ): HalfEdgeMesh {
    const builder = new MeshBuilder(meshId);
    const hx = width / 2;
    const hy = height / 2;
    const hz = depth / 2;

    const v0 = builder.addVertex(-hx, -hy, hz);
    const v1 = builder.addVertex(hx, -hy, hz);
    const v2 = builder.addVertex(hx, hy, hz);
    const v3 = builder.addVertex(-hx, hy, hz);
    const v4 = builder.addVertex(-hx, -hy, -hz);
    const v5 = builder.addVertex(hx, -hy, -hz);
    const v6 = builder.addVertex(hx, hy, -hz);
    const v7 = builder.addVertex(-hx, hy, -hz);

    builder.addFace([v0, v1, v2, v3], faceIds ? { id: faceIds.posZ } : undefined);
    builder.addFace([v5, v4, v7, v6], faceIds ? { id: faceIds.negZ } : undefined);
    builder.addFace([v3, v2, v6, v7], faceIds ? { id: faceIds.posY } : undefined);
    builder.addFace([v4, v5, v1, v0], faceIds ? { id: faceIds.negY } : undefined);
    builder.addFace([v1, v5, v6, v2], faceIds ? { id: faceIds.posX } : undefined);
    builder.addFace([v4, v0, v3, v7], faceIds ? { id: faceIds.negX } : undefined);

    return builder.getMesh();
  }

  /**
   * Procedurally generates a polygonal cylinder primitive with caps.
   */
  static createCylinder(
    radius = 1,
    height = 2,
    segments = 8,
    meshId?: MeshId,
  ): HalfEdgeMesh {
    const builder = new MeshBuilder(meshId);
    const hy = height / 2;
    const segs = Math.max(3, segments);

    const bottomVertices: VertexId[] = [];
    const topVertices: VertexId[] = [];

    for (let i = 0; i < segs; i++) {
      const angle = (i / segs) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      bottomVertices.push(builder.addVertex(x, -hy, z));
      topVertices.push(builder.addVertex(x, hy, z));
    }

    // Side quad faces
    for (let i = 0; i < segs; i++) {
      const next = (i + 1) % segs;
      builder.addFace([
        bottomVertices[i]!,
        bottomVertices[next]!,
        topVertices[next]!,
        topVertices[i]!,
      ]);
    }

    // Top cap (counter-clockwise viewed from above)
    builder.addFace([...topVertices]);

    // Bottom cap (counter-clockwise viewed from below)
    builder.addFace([...bottomVertices].reverse());

    return builder.getMesh();
  }

  /**
   * Procedurally generates a UV sphere primitive.
   */
  static createSphere(
    radius = 1,
    segments = 8,
    rings = 6,
    meshId?: MeshId,
  ): HalfEdgeMesh {
    const builder = new MeshBuilder(meshId);
    const segs = Math.max(3, segments);
    const numRings = Math.max(2, rings);

    const topPole = builder.addVertex(0, radius, 0);
    const bottomPole = builder.addVertex(0, -radius, 0);

    const ringVertices: VertexId[][] = [];
    for (let r = 1; r < numRings; r++) {
      const phi = (r / numRings) * Math.PI;
      const y = Math.cos(phi) * radius;
      const ringRadius = Math.sin(phi) * radius;
      const ring: VertexId[] = [];
      for (let s = 0; s < segs; s++) {
        const theta = (s / segs) * Math.PI * 2;
        const x = Math.cos(theta) * ringRadius;
        const z = Math.sin(theta) * ringRadius;
        ring.push(builder.addVertex(x, y, z));
      }
      ringVertices.push(ring);
    }

    // Top cap triangles
    const firstRing = ringVertices[0]!;
    for (let s = 0; s < segs; s++) {
      const next = (s + 1) % segs;
      builder.addFace([topPole, firstRing[s]!, firstRing[next]!]);
    }

    // Middle quad bands
    for (let r = 0; r < ringVertices.length - 1; r++) {
      const currentRing = ringVertices[r]!;
      const nextRing = ringVertices[r + 1]!;
      for (let s = 0; s < segs; s++) {
        const next = (s + 1) % segs;
        builder.addFace([
          currentRing[s]!,
          nextRing[s]!,
          nextRing[next]!,
          currentRing[next]!,
        ]);
      }
    }

    // Bottom cap triangles
    const lastRing = ringVertices[ringVertices.length - 1]!;
    for (let s = 0; s < segs; s++) {
      const next = (s + 1) % segs;
      builder.addFace([bottomPole, lastRing[next]!, lastRing[s]!]);
    }

    return builder.getMesh();
  }

  /**
   * Creates a single planar quad face.
   */
  static createQuad(
    p0: [number, number, number],
    p1: [number, number, number],
    p2: [number, number, number],
    p3: [number, number, number],
    meshId?: MeshId,
  ): HalfEdgeMesh {
    const builder = new MeshBuilder(meshId);
    const v0 = builder.addVertex(...p0);
    const v1 = builder.addVertex(...p1);
    const v2 = builder.addVertex(...p2);
    const v3 = builder.addVertex(...p3);
    builder.addFace([v0, v1, v2, v3]);
    return builder.getMesh();
  }

  /**
   * Creates a single triangle face.
   */
  static createTriangle(
    p0: [number, number, number],
    p1: [number, number, number],
    p2: [number, number, number],
    meshId?: MeshId,
  ): HalfEdgeMesh {
    const builder = new MeshBuilder(meshId);
    const v0 = builder.addVertex(...p0);
    const v1 = builder.addVertex(...p1);
    const v2 = builder.addVertex(...p2);
    builder.addFace([v0, v1, v2]);
    return builder.getMesh();
  }

  static fromMesh(mesh: HalfEdgeMesh): MeshBuilder {
    const builder = new MeshBuilder(mesh.id);
    builder.mesh = mesh;
    for (const he of mesh.halfEdges.values()) {
      const next = mesh.halfEdges.get(he.next);
      if (next) {
        builder.directedHalfEdges.set(`${he.origin}_${next.origin}`, he.id);
      }
      const dest = next?.origin;
      if (dest) {
        const edgeKey = he.origin < dest ? `${he.origin}_${dest}` : `${dest}_${he.origin}`;
        builder.undirectedEdges.set(edgeKey, he.edgeId);
      }
    }
    return builder;
  }
}
