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
import { validateFaceInsertion, type AddFaceRequest as AddFaceRequestForValidation } from "./operations/face-insertion";

export type ManifoldPolicy = "strict-manifold" | "allow-non-manifold";

export interface MeshBuilderOptions {
  readonly meshId?: MeshId | undefined;
  readonly manifoldPolicy?: ManifoldPolicy | undefined;
  /** `"deferred"` bumps topology once on `getMesh()` instead of once per face. */
  readonly revisionMode?: "immediate" | "deferred" | undefined;
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
  /**
   * Skip Newell zero-area check. Generators that already emit known-planar
   * faces may set this. Public modeling still validates area.
   */
  skipAreaCheck?: boolean;
}

export interface CubeFaceIds {
  readonly posX: FaceId;
  readonly negX: FaceId;
  readonly posY: FaceId;
  readonly negY: FaceId;
  readonly posZ: FaceId;
  readonly negZ: FaceId;
}

/**
 * Programmatic mesh construction API.
 *
 * MeshBuilder is the **primary way to create HalfEdgeMesh instances**. It handles:
 *
 * - **Vertex merging** — duplicate positions at the same 3D coordinate are automatically
 *   welded to the same vertex ID.
 * - **Edge deduplication** — faces sharing edge vertices see the same edge and half-edges,
 *   enforcing manifold connectivity.
 * - **Manifold enforcement** — `"strict-manifold"` (default) rejects faces that would create
 *   more than two faces sharing one edge. Use `"allow-non-manifold"` to permit T-junctions.
 * - **Revision batching** — `"deferred"` revision mode accumulates topology changes and
 *   bumps the revision counter once on `getMesh()`, avoiding intermediate invalid states.
 *
 * ## Usage
 *
 * ```ts
 * import { MeshBuilder } from "@modeling-kit/mesh";
 *
 * // Simple quad
 * const builder = new MeshBuilder({ revisionMode: "deferred" });
 * const v0 = builder.addVertex(0, 0, 0);
 * const v1 = builder.addVertex(1, 0, 0);
 * const v2 = builder.addVertex(1, 1, 0);
 * const v3 = builder.addVertex(0, 1, 0);
 * builder.addFace([v0, v1, v2, v3]);
 * const mesh = builder.getMesh();
 *
 * // Convenience static builders
 * const cube = MeshBuilder.createCube(2);
 * const sphere = MeshBuilder.createUVSphere(1, 16, 32);
 * ```
 *
 * @see {@link HalfEdgeMesh} for the mesh data structure
 * @see {@link AddFaceOptions} for per-face attribute configuration
 */
export class MeshBuilder {
  private mesh: HalfEdgeMesh;
  private vCount = 0;
  private eCount = 0;
  private heCount = 0;
  private fCount = 0;
  private cCount = 0;
  readonly manifoldPolicy: ManifoldPolicy;
  private readonly revisionMode: "immediate" | "deferred";
  private pendingTopologyBump = false;
  private scanExistingIds = false;

  // Nested maps avoid interpolating `vFrom_vTo` strings on every edge.
  private directedHalfEdges = new Map<VertexId, Map<VertexId, HalfEdgeId>>();
  private undirectedEdges = new Map<VertexId, Map<VertexId, EdgeId>>();
  private edgeFaceCount = new Map<EdgeId, number>();

  constructor(meshIdOrOptions?: MeshId | MeshBuilderOptions) {
    let meshId: MeshId | undefined;
    let manifoldPolicy: ManifoldPolicy | undefined;
    let revisionMode: "immediate" | "deferred" | undefined;
    if (typeof meshIdOrOptions === "object" && meshIdOrOptions !== null && !isMeshId(meshIdOrOptions)) {
      meshId = meshIdOrOptions.meshId;
      manifoldPolicy = meshIdOrOptions.manifoldPolicy;
      revisionMode = meshIdOrOptions.revisionMode;
    } else if (isMeshId(meshIdOrOptions)) {
      meshId = meshIdOrOptions;
    }
    this.mesh = new HalfEdgeMesh(meshId);
    this.manifoldPolicy = manifoldPolicy ?? "strict-manifold";
    this.revisionMode = revisionMode ?? "immediate";
  }

  getMesh(): HalfEdgeMesh {
    this.flushRevision();
    return this.mesh;
  }

  private flushRevision(): void {
    if (!this.pendingTopologyBump) {
      return;
    }
    this.mesh.bumpRevision();
    this.pendingTopologyBump = false;
  }

  private noteTopologyChange(): void {
    if (this.revisionMode === "deferred") {
      this.pendingTopologyBump = true;
      return;
    }
    this.mesh.bumpRevision();
  }

  private allocateId(
    existing: { has(id: string): boolean },
    prefix: string,
    counter: "vCount" | "eCount" | "heCount" | "fCount" | "cCount",
  ): string {
    this[counter] += 1;
    let id = `${prefix}_${this[counter]}`;
    if (this.scanExistingIds) {
      while (existing.has(id)) {
        this[counter] += 1;
        id = `${prefix}_${this[counter]}`;
      }
    }
    return id;
  }

  private getDirected(from: VertexId, to: VertexId): HalfEdgeId | undefined {
    return this.directedHalfEdges.get(from)?.get(to);
  }

  private setDirected(from: VertexId, to: VertexId, id: HalfEdgeId): void {
    let inner = this.directedHalfEdges.get(from);
    if (!inner) {
      inner = new Map();
      this.directedHalfEdges.set(from, inner);
    }
    inner.set(to, id);
  }

  private getUndirected(a: VertexId, b: VertexId): EdgeId | undefined {
    const lo = a < b ? a : b;
    const hi = a < b ? b : a;
    return this.undirectedEdges.get(lo)?.get(hi);
  }

  private setUndirected(a: VertexId, b: VertexId, id: EdgeId): void {
    const lo = a < b ? a : b;
    const hi = a < b ? b : a;
    let inner = this.undirectedEdges.get(lo);
    if (!inner) {
      inner = new Map();
      this.undirectedEdges.set(lo, inner);
    }
    inner.set(hi, id);
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
    // Enhanced preflight validation using the comprehensive validator
    this.validateFaceInputWithPreflight(vertexIds, options);

    const fId =
      options?.id ?? brand<string, "FaceId">(this.allocateId(this.mesh.faces, "f", "fCount"));
    if (this.mesh.faces.has(fId)) {
      throw new RangeError(`Duplicate face id: ${fId}`);
    }

    const n = vertexIds.length;
    const planned = this.planFaceHalfEdges(vertexIds);

    // Transactional insertion: build all records first, then apply
    const newRecords = {
      edges: new Map<EdgeId, EdgeRecord>(),
      corners: new Map<CornerId, CornerRecord>(),
      halfEdges: new Map<HalfEdgeId, HalfEdgeRecord>(),
      face: null as FaceRecord | null,
    };

    const halfEdgeIds: HalfEdgeId[] = [];
    const cornerIds: CornerId[] = [];

    for (let i = 0; i < n; i++) {
      const vFrom = vertexIds[i]!;
      const vTo = vertexIds[(i + 1) % n]!;
      const plan = planned[i]!;

      if (this.mesh.edges.has(plan.edgeId) === false && !newRecords.edges.has(plan.edgeId)) {
        const edgeRecord: EdgeRecord = {
          id: plan.edgeId,
          halfEdge: plan.halfEdgeId,
          isSeam: false,
        };
        newRecords.edges.set(plan.edgeId, edgeRecord);
      }

      const cId = brand<string, "CornerId">(this.allocateId(this.mesh.corners, "c", "cCount"));
      if (this.mesh.corners.has(cId) || Array.from(newRecords.corners.keys()).some(id => id === cId)) {
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
      newRecords.corners.set(cId, cornerRecord);
      cornerIds.push(cId);

      if (this.mesh.halfEdges.has(plan.halfEdgeId) || newRecords.halfEdges.has(plan.halfEdgeId)) {
        throw new RangeError(`Duplicate half-edge id: ${plan.halfEdgeId}`);
      }
      
      const twinId = this.getDirected(vTo, vFrom) ?? null;
      const heRecord: HalfEdgeRecord = {
        id: plan.halfEdgeId,
        edgeId: plan.edgeId,
        origin: vFrom,
        twin: twinId,
        next: plan.halfEdgeId, // Temporary self-reference
        prev: plan.halfEdgeId, // Temporary self-reference
        face: fId,
        corner: cId,
      };
      newRecords.halfEdges.set(plan.halfEdgeId, heRecord);
      halfEdgeIds.push(plan.halfEdgeId);
    }

    // Now set up next/prev links
    for (let i = 0; i < n; i++) {
      const curr = halfEdgeIds[i]!;
      const next = halfEdgeIds[(i + 1) % n]!;
      const prev = halfEdgeIds[(i - 1 + n) % n]!;
      const he = newRecords.halfEdges.get(curr)!;
      he.next = next;
      he.prev = prev;
    }

    // Create face record
    newRecords.face = {
      id: fId,
      halfEdge: halfEdgeIds[0]!,
      materialSlot: options?.materialSlot ?? 0,
      materialSlotId: options?.materialSlotId ?? null,
      isSmooth: options?.isSmooth ?? false,
    };

    // Apply all changes atomically
    this.applyFaceInsertionTransaction(newRecords, halfEdgeIds, fId, vertexIds, planned);

    this.noteTopologyChange();
    return fId;
  }

  private validateFaceInputWithPreflight(vertexIds: readonly VertexId[], options?: AddFaceOptions): void {
    // First run the existing validation
    this.validateFaceInput(vertexIds, options);

    // Then run comprehensive preflight validation
    const request: AddFaceRequestForValidation = {
      vertexIds,
      ...(options?.id !== undefined ? { id: options.id } : {}),
      ...(options?.materialSlot !== undefined ? { materialSlot: options.materialSlot } : {}),
      ...(options?.isSmooth !== undefined ? { isSmooth: options.isSmooth } : {}),
      ...(options?.uvs !== undefined ? { uvs: options.uvs } : {}),
      ...(options?.uvChannels !== undefined ? { uvChannels: options.uvChannels } : {}),
      ...(options?.pinnedUvChannels !== undefined ? { pinnedUvChannels: options.pinnedUvChannels } : {}),
      ...(options?.normals !== undefined ? { normals: options.normals } : {}),
      ...(options?.colors !== undefined ? { colors: options.colors } : {}),
    };

    const tolerance = {
      epsilon: 1e-6,
      minEdgeLength: 1e-6,
      minFaceArea: 1e-14, // More lenient for cube faces
    };

    const issues = validateFaceInsertion(
      this.mesh,
      request,
      tolerance,
      this.manifoldPolicy,
    );

    if (issues.length > 0) {
      // Use the first issue's message as the error
      // This preserves compatibility with existing tests
      throw new RangeError(issues[0]!.message);
    }
  }

  private applyFaceInsertionTransaction(
    newRecords: {
      edges: Map<EdgeId, EdgeRecord>;
      corners: Map<CornerId, CornerRecord>;
      halfEdges: Map<HalfEdgeId, HalfEdgeRecord>;
      face: FaceRecord | null;
    },
    halfEdgeIds: HalfEdgeId[],
    faceId: FaceId,
    vertexIds: readonly VertexId[],
    planned: Array<{ edgeId: EdgeId; halfEdgeId: HalfEdgeId }>,
  ): void {
    // Apply edges - only those that don't already exist
    for (const [edgeId, edgeRecord] of newRecords.edges) {
      if (!this.mesh.edges.has(edgeId)) {
        this.mesh.edges.set(edgeId, edgeRecord);
        
        // Update undirected edge map
        const halfEdge = newRecords.halfEdges.get(edgeRecord.halfEdge);
        if (halfEdge) {
          const vFrom = halfEdge.origin;
          // Get the "to" vertex from the next half-edge in the face
          const nextHalfEdge = newRecords.halfEdges.get(halfEdge.next);
          if (nextHalfEdge) {
            const vTo = nextHalfEdge.origin;
            this.setUndirected(vFrom, vTo, edgeId);
          }
        }
        
        this.edgeFaceCount.set(edgeId, 0);
      }
    }

    // Apply corners
    for (const [cornerId, cornerRecord] of newRecords.corners) {
      this.mesh.corners.set(cornerId, cornerRecord);
    }

    // Apply half-edges and update twin links
    for (const [halfEdgeId, halfEdgeRecord] of newRecords.halfEdges) {
      this.mesh.halfEdges.set(halfEdgeId, halfEdgeRecord);
      
      // Update directed edge map
      const vFrom = halfEdgeRecord.origin;
      const nextHalfEdge = newRecords.halfEdges.get(halfEdgeRecord.next);
      if (nextHalfEdge) {
        const vTo = nextHalfEdge.origin;
        this.setDirected(vFrom, vTo, halfEdgeId);
      }
      
      // Update twin links if twin exists
      if (halfEdgeRecord.twin) {
        const twinRecord = this.mesh.halfEdges.get(halfEdgeRecord.twin);
        if (twinRecord) {
          twinRecord.twin = halfEdgeId;
        }
      }
      
      // Update vertex half-edge reference if needed
      const vRecord = this.mesh.vertices.get(vFrom);
      if (vRecord && !vRecord.halfEdge) {
        vRecord.halfEdge = halfEdgeId;
      }
    }

    // Apply face
    if (newRecords.face) {
      this.mesh.faces.set(faceId, newRecords.face);
    }

    // Update edge face counts
    for (const plan of planned) {
      const currentCount = this.edgeFaceCount.get(plan.edgeId) ?? 0;
      this.edgeFaceCount.set(plan.edgeId, currentCount + 1);
    }
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

    if (!options?.skipAreaCheck) {
      const points = vertexIds.map((id) => this.mesh.vertices.get(id)!.position);
      if (polygonArea(points) <= 1e-12) {
        throw new RangeError("Face polygon has zero area");
      }
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
    halfEdgeId: HalfEdgeId;
  }> {
    const n = vertexIds.length;
    const planned: Array<{ edgeId: EdgeId; halfEdgeId: HalfEdgeId }> = [];
    for (let i = 0; i < n; i++) {
      const vFrom = vertexIds[i]!;
      const vTo = vertexIds[(i + 1) % n]!;
      if (this.getDirected(vFrom, vTo)) {
        throw new RangeError(`Directed edge ${vFrom} -> ${vTo} is already occupied`);
      }
      let eId = this.getUndirected(vFrom, vTo);
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
      planned.push({ edgeId: eId, halfEdgeId: heId });
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
    const builder = new MeshBuilder(meshId ? { meshId, revisionMode: "deferred" } : { revisionMode: "deferred" });
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
    const builder = new MeshBuilder(meshId ? { meshId, revisionMode: "deferred" } : { revisionMode: "deferred" });
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
    const builder = new MeshBuilder(meshId ? { meshId, revisionMode: "deferred" } : { revisionMode: "deferred" });
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
    const builder = new MeshBuilder(meshId ? { meshId, revisionMode: "deferred" } : { revisionMode: "deferred" });
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
    const builder = new MeshBuilder(meshId ? { meshId, revisionMode: "deferred" } : { revisionMode: "deferred" });
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
    builder.scanExistingIds = true;
    for (const he of mesh.halfEdges.values()) {
      const next = mesh.halfEdges.get(he.next);
      if (next) {
        builder.setDirected(he.origin, next.origin, he.id);
      }
      const dest = next?.origin;
      if (dest) {
        builder.setUndirected(he.origin, dest, he.edgeId);
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
