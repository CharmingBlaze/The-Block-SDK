import {
  brand,
  type VertexId,
  type EdgeId,
  type HalfEdgeId,
  type FaceId,
  type CornerId,
  type MeshId,
  type MaterialSlotId,
  type UVChannelId,
} from "@modeling-kit/core";
import { HalfEdgeMesh } from "./half-edge-mesh";
import { polygonArea } from "./polygon-triangulation";
import type { VertexRecord, EdgeRecord, HalfEdgeRecord, CornerRecord, FaceRecord } from "./types";

export type ManifoldPolicy = "strict-manifold" | "allow-non-manifold";

export interface MeshBuilderOptions {
  readonly meshId?: MeshId | undefined;
  readonly manifoldPolicy?: ManifoldPolicy | undefined;
}

export interface AddFaceOptions {
  id?: FaceId;
  materialSlot?: number;
  materialSlotId?: MaterialSlotId | null | undefined;
  isSmooth?: boolean;
  uvs?: [u: number, v: number][];
  uvChannels?: Readonly<Record<string, [u: number, v: number]>>[];
  pinnedUvChannels?: readonly (readonly UVChannelId[])[];
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
  readonly manifoldPolicy: ManifoldPolicy;

  // Map from "vA_vB" (directed) to HalfEdgeId for twin lookup
  private directedHalfEdges = new Map<string, HalfEdgeId>();
  // Map from sorted "vA_vB" to EdgeId
  private undirectedEdges = new Map<string, EdgeId>();
  private edgeFaceCount = new Map<EdgeId, number>();

  constructor(meshIdOrOptions?: MeshId | MeshBuilderOptions) {
    let meshId: MeshId | undefined;
    let manifoldPolicy: ManifoldPolicy | undefined;
    if (typeof meshIdOrOptions === "object" && meshIdOrOptions !== null && !isMeshId(meshIdOrOptions)) {
      meshId = meshIdOrOptions.meshId;
      manifoldPolicy = meshIdOrOptions.manifoldPolicy;
    } else if (isMeshId(meshIdOrOptions)) {
      meshId = meshIdOrOptions;
    }
    this.mesh = new HalfEdgeMesh(meshId);
    this.manifoldPolicy = manifoldPolicy ?? "strict-manifold";
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
    if (![x, y, z].every(Number.isFinite)) {
      throw new RangeError("Vertex coordinates must be finite");
    }
    const vId = id ?? brand<string, "VertexId">(this.allocateId(this.mesh.vertices, "v", "vCount"));
    if (this.mesh.vertices.has(vId)) {
      throw new RangeError(`Duplicate vertex id: ${vId}`);
    }
    const record: VertexRecord = {
      id: vId,
      position: [x, y, z],
      halfEdge: null,
    };
    this.mesh.vertices.set(vId, record);
    return vId;
  }

  addFace(vertexIds: readonly VertexId[], options?: AddFaceOptions): FaceId {
    this.validateFaceInput(vertexIds, options);

    const fId =
      options?.id ?? brand<string, "FaceId">(this.allocateId(this.mesh.faces, "f", "fCount"));
    if (this.mesh.faces.has(fId)) {
      throw new RangeError(`Duplicate face id: ${fId}`);
    }

    const n = vertexIds.length;
    const planned = this.planFaceHalfEdges(vertexIds);

    const halfEdgeIds: HalfEdgeId[] = [];
    const cornerIds: CornerId[] = [];

    for (let i = 0; i < n; i++) {
      const vFrom = vertexIds[i]!;
      const vTo = vertexIds[(i + 1) % n]!;
      const plan = planned[i]!;

      if (this.mesh.edges.has(plan.edgeId) === false) {
        const edgeRecord: EdgeRecord = {
          id: plan.edgeId,
          halfEdge: plan.halfEdgeId,
          isSeam: false,
        };
        this.mesh.edges.set(plan.edgeId, edgeRecord);
        this.undirectedEdges.set(plan.edgeKey, plan.edgeId);
        this.edgeFaceCount.set(plan.edgeId, 0);
      }

      const cId = brand<string, "CornerId">(this.allocateId(this.mesh.corners, "c", "cCount"));
      if (this.mesh.corners.has(cId)) {
        throw new RangeError(`Duplicate corner id: ${cId}`);
      }
      const uv = options?.uvs?.[i];
      const normal = options?.normals?.[i];
      const color = options?.colors?.[i];
      const uvChannels = options?.uvChannels?.[i];
      const pinnedUvChannels = options?.pinnedUvChannels?.[i];
      const cornerRecord: CornerRecord = {
        id: cId,
        vertexId: vFrom,
        faceId: fId,
        ...(uv !== undefined ? { uv } : {}),
        ...(uvChannels !== undefined ? { uvChannels } : {}),
        ...(pinnedUvChannels !== undefined ? { pinnedUvChannels: [...pinnedUvChannels] } : {}),
        ...(normal !== undefined ? { normal } : {}),
        ...(color !== undefined ? { color } : {}),
      };
      this.mesh.corners.set(cId, cornerRecord);
      cornerIds.push(cId);

      if (this.mesh.halfEdges.has(plan.halfEdgeId)) {
        throw new RangeError(`Duplicate half-edge id: ${plan.halfEdgeId}`);
      }
      const twinId = this.directedHalfEdges.get(`${vTo}_${vFrom}`) ?? null;
      const heRecord: HalfEdgeRecord = {
        id: plan.halfEdgeId,
        edgeId: plan.edgeId,
        origin: vFrom,
        twin: twinId,
        next: plan.halfEdgeId,
        prev: plan.halfEdgeId,
        face: fId,
        corner: cId,
      };
      this.mesh.halfEdges.set(plan.halfEdgeId, heRecord);
      this.directedHalfEdges.set(`${vFrom}_${vTo}`, plan.halfEdgeId);
      halfEdgeIds.push(plan.halfEdgeId);

      if (twinId) {
        const twinRecord = this.mesh.halfEdges.get(twinId);
        if (twinRecord) {
          twinRecord.twin = plan.halfEdgeId;
        }
      }

      this.edgeFaceCount.set(plan.edgeId, (this.edgeFaceCount.get(plan.edgeId) ?? 0) + 1);

      const vRecord = this.mesh.vertices.get(vFrom);
      if (vRecord && !vRecord.halfEdge) {
        vRecord.halfEdge = plan.halfEdgeId;
      }
    }

    for (let i = 0; i < n; i++) {
      const curr = halfEdgeIds[i]!;
      const next = halfEdgeIds[(i + 1) % n]!;
      const prev = halfEdgeIds[(i - 1 + n) % n]!;
      const he = this.mesh.halfEdges.get(curr)!;
      he.next = next;
      he.prev = prev;
    }

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

  private validateFaceInput(vertexIds: readonly VertexId[], options?: AddFaceOptions): void {
    if (vertexIds.length < 3) {
      throw new RangeError("A face must have at least 3 vertices.");
    }
    const n = vertexIds.length;
    const unique = new Set<VertexId>();
    for (let i = 0; i < n; i++) {
      const id = vertexIds[i]!;
      if (!this.mesh.vertices.has(id)) {
        throw new RangeError(`Face vertex ${id} does not exist`);
      }
      const next = vertexIds[(i + 1) % n]!;
      if (id === next) {
        throw new RangeError("Face rejects consecutive duplicate vertices");
      }
      unique.add(id);
      const position = this.mesh.vertices.get(id)!.position;
      if (!position.every(Number.isFinite)) {
        throw new RangeError(`Face vertex ${id} has non-finite coordinates`);
      }
    }
    if (unique.size < 3) {
      throw new RangeError("A face must have at least 3 unique vertices");
    }
    if (vertexIds[0] === vertexIds[n - 1] && n > 1) {
      throw new RangeError("Face first and last vertex must not be duplicated");
    }

    const points = vertexIds.map((id) => this.mesh.vertices.get(id)!.position);
    if (polygonArea(points) <= 1e-12) {
      throw new RangeError("Face polygon has zero area");
    }

    if (options?.uvs && options.uvs.length !== n) {
      throw new RangeError("Face UV array length must match the corner count");
    }
    if (options?.normals && options.normals.length !== n) {
      throw new RangeError("Face normal array length must match the corner count");
    }
    if (options?.colors && options.colors.length !== n) {
      throw new RangeError("Face color array length must match the corner count");
    }
    if (options?.uvChannels && options.uvChannels.length !== n) {
      throw new RangeError("Face uvChannels array length must match the corner count");
    }
    if (options?.pinnedUvChannels && options.pinnedUvChannels.length !== n) {
      throw new RangeError("Face pinnedUvChannels array length must match the corner count");
    }
  }

  private planFaceHalfEdges(vertexIds: readonly VertexId[]): Array<{
    edgeId: EdgeId;
    edgeKey: string;
    halfEdgeId: HalfEdgeId;
  }> {
    const n = vertexIds.length;
    const planned: Array<{ edgeId: EdgeId; edgeKey: string; halfEdgeId: HalfEdgeId }> = [];
    for (let i = 0; i < n; i++) {
      const vFrom = vertexIds[i]!;
      const vTo = vertexIds[(i + 1) % n]!;
      const directedKey = `${vFrom}_${vTo}`;
      if (this.directedHalfEdges.has(directedKey)) {
        throw new RangeError(`Directed edge ${vFrom} -> ${vTo} is already occupied`);
      }
      const edgeKey = vFrom < vTo ? `${vFrom}_${vTo}` : `${vTo}_${vFrom}`;
      let eId = this.undirectedEdges.get(edgeKey);
      if (!eId) {
        eId = brand<string, "EdgeId">(this.allocateId(this.mesh.edges, "e", "eCount"));
      } else if (this.mesh.edges.has(eId) === false) {
        eId = brand<string, "EdgeId">(this.allocateId(this.mesh.edges, "e", "eCount"));
      }
      const occupied = this.edgeFaceCount.get(eId) ?? 0;
      if (occupied >= 2 && this.manifoldPolicy === "strict-manifold") {
        throw new RangeError(
          `Edge ${eId} already has two incident faces; non-manifold topology is not allowed`,
        );
      }
      if (this.mesh.edges.has(eId) && occupied >= 2 && this.manifoldPolicy === "allow-non-manifold") {
        // Still refuse a third co-directional occupation; a new undirected edge is not created
        // because the kernel stores one directed half-edge per key.
        throw new RangeError(
          `Non-manifold edge ${eId} cannot store a third co-directional half-edge`,
        );
      }
      const heId = brand<string, "HalfEdgeId">(this.allocateId(this.mesh.halfEdges, "he", "heCount"));
      planned.push({ edgeId: eId, edgeKey, halfEdgeId: heId });
    }
    return planned;
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

    for (let i = 0; i < segs; i++) {
      const next = (i + 1) % segs;
      builder.addFace([
        bottomVertices[i]!,
        bottomVertices[next]!,
        topVertices[next]!,
        topVertices[i]!,
      ]);
    }

    builder.addFace([...topVertices]);
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

    const firstRing = ringVertices[0]!;
    for (let s = 0; s < segs; s++) {
      const next = (s + 1) % segs;
      builder.addFace([topPole, firstRing[s]!, firstRing[next]!]);
    }

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

    const lastRing = ringVertices[ringVertices.length - 1]!;
    for (let s = 0; s < segs; s++) {
      const next = (s + 1) % segs;
      builder.addFace([bottomPole, lastRing[next]!, lastRing[s]!]);
    }

    return builder.getMesh();
  }

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

  static fromMesh(mesh: HalfEdgeMesh, options?: { manifoldPolicy?: ManifoldPolicy }): MeshBuilder {
    const builder = new MeshBuilder(
      options?.manifoldPolicy
        ? { meshId: mesh.id, manifoldPolicy: options.manifoldPolicy }
        : { meshId: mesh.id },
    );
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
    for (const [edgeId] of mesh.edges) {
      const [f1, f2] = mesh.getEdgeFaces(edgeId);
      builder.edgeFaceCount.set(edgeId, (f1 ? 1 : 0) + (f2 ? 1 : 0));
    }
    return builder;
  }
}

function isMeshId(value: unknown): value is MeshId {
  return typeof value === "string";
}
