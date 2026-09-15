import type { FaceId, IdFactory, VertexId } from "@modeling-kit/core";
import { MeshBuilder } from "../builder";
import type { HalfEdgeMesh } from "../half-edge-mesh";
import { findEdge } from "../internal/rebuild";
import { TopologyMappingBuilder } from "../internal/topology-mapping-builder";
import {
  createMeshOperationContext,
  type MeshOperationContext,
  type MeshOperationResult,
  type MeshOperationWarning,
} from "./contract";
import { runTransactionalMeshOp } from "./contract";

export interface BridgeLoopsRequest {
  readonly loopA: readonly VertexId[];
  readonly loopB: readonly VertexId[];
  readonly reverseB?: boolean;
}

export interface BridgeEdgesResult {
  readonly bridgeFaceIds: FaceId[];
}

export interface BridgeLoopsOpResult extends MeshOperationResult, BridgeEdgesResult {}

export function bridgeLoops(
  mesh: HalfEdgeMesh,
  request: BridgeLoopsRequest,
  ctx: MeshOperationContext,
): BridgeLoopsOpResult;
export function bridgeLoops(
  mesh: HalfEdgeMesh,
  loopA: readonly VertexId[],
  loopB: readonly VertexId[],
  ids: IdFactory,
): BridgeEdgesResult;
export function bridgeLoops(
  mesh: HalfEdgeMesh,
  requestOrA: BridgeLoopsRequest | readonly VertexId[],
  ctxOrB: MeshOperationContext | readonly VertexId[],
  ids?: IdFactory,
): BridgeLoopsOpResult | BridgeEdgesResult {
  if (Array.isArray(requestOrA) && Array.isArray(ctxOrB)) {
    if (!ids) {
      throw new RangeError("bridgeLoops requires an IdFactory");
    }
    const result = bridgeLoopsOp(
      mesh,
      { loopA: requestOrA, loopB: ctxOrB },
      createMeshOperationContext(ids),
    );
    return { bridgeFaceIds: result.bridgeFaceIds };
  }
  return bridgeLoopsOp(mesh, requestOrA as BridgeLoopsRequest, ctxOrB as MeshOperationContext);
}

function bridgeLoopsOp(
  mesh: HalfEdgeMesh,
  request: BridgeLoopsRequest,
  ctx: MeshOperationContext,
): BridgeLoopsOpResult {
  return runTransactionalMeshOp(mesh, () => {
  const loopA = [...request.loopA];
  const loopB = request.reverseB ? [...request.loopB].reverse() : [...request.loopB];
  if (loopA.length !== loopB.length) {
    throw new RangeError("bridgeLoops requires loops of equal vertex count");
  }
  if (loopA.length < 2) {
    throw new RangeError("bridgeLoops requires at least 2 vertices per loop");
  }

  const mapping = new TopologyMappingBuilder(mesh);
  const warnings: MeshOperationWarning[] = [];
  for (const id of [...loopA, ...loopB]) {
    if (!mesh.vertices.has(id)) {
      throw new RangeError(`Vertex ${id} does not exist`);
    }
  }
  assertSimpleLoop(loopA, "loopA");
  assertSimpleLoop(loopB, "loopB");

  const n = loopA.length;
  const quads: VertexId[][] = [];
  for (let i = 0; i < n; i++) {
    const a0 = loopA[i]!;
    const a1 = loopA[(i + 1) % n]!;
    const b0 = loopB[i]!;
    const b1 = loopB[(i + 1) % n]!;
    const quad = [a0, a1, b1, b0];
    if (new Set(quad).size < 3) {
      throw new RangeError("bridgeLoops would create a degenerate face");
    }
    for (let e = 0; e < 4; e++) {
      const u = quad[e]!;
      const v = quad[(e + 1) % 4]!;
      const existing = findEdge(mesh, u, v);
      if (!existing) {
        continue;
      }
      const [f1, f2] = mesh.getEdgeFaces(existing);
      if (f1 && f2) {
        const message = `Edge ${existing} is already manifold and cannot take a bridge face`;
        if (ctx.validation === "strict") {
          throw new RangeError(message);
        }
        warnings.push({
          code: "nonmanifold-bridge",
          message,
          elementIds: [existing],
        });
      }
    }
    quads.push(quad);
  }

  const builder = MeshBuilder.fromMesh(mesh);
  const bridgeFaceIds: FaceId[] = [];
  for (const quad of quads) {
    const faceId = ctx.idFactory.face();
    builder.addFace(quad, { id: faceId });
    mapping.createFace(faceId);
    bridgeFaceIds.push(faceId);
  }

  const { mapping: topology, changes } = mapping.build(mesh);
  return {
    mesh,
    changes,
    mapping: topology,
    selection: { domain: "face", elementIds: bridgeFaceIds },
    warnings,
    bridgeFaceIds,
  };
  });
}

function assertSimpleLoop(loop: readonly VertexId[], name: string): void {
  for (let i = 0; i < loop.length; i++) {
    if (loop[i] === loop[(i + 1) % loop.length]) {
      throw new RangeError(`${name} has consecutive duplicate vertices`);
    }
  }
}
