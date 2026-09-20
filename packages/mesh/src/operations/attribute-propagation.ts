import type { CornerId, EdgeId, FaceId } from "@modeling-kit/core";
import type { HalfEdgeMesh } from "../half-edge-mesh";
import type { TopologyMapping } from "./contract";

export interface AttributePolicy {
  readonly uv: "copy" | "interpolate" | "project" | "reject";
  readonly normals: "copy" | "recalculate" | "interpolate";
  readonly seams: "preserve" | "split" | "clear";
  readonly creases: "preserve" | "interpolate" | "clear";
  readonly materialSlots: "inherit" | "split" | "reject";
  readonly colors: "copy" | "interpolate" | "clear";
  readonly uvChannels: "copy" | "interpolate" | "reject";
  readonly skinWeights: "copy" | "interpolate" | "clear";
}

export interface AttributeSplitContext {
  readonly sourceCorner: CornerId;
  readonly targetCorner: CornerId;
  readonly mesh: HalfEdgeMesh;
  readonly policy: AttributePolicy;
}

export interface AttributeInterpolationContext {
  readonly edge: EdgeId;
  readonly t: number; // 0 to 1
  readonly mesh: HalfEdgeMesh;
  readonly policy: AttributePolicy;
}

export interface AttributeDuplicateContext {
  readonly sourceFace: FaceId;
  readonly targetFace: FaceId;
  readonly mesh: HalfEdgeMesh;
  readonly policy: AttributePolicy;
}

export interface AttributeRemapPolicy {
  readonly mapping: TopologyMapping;
  readonly preserveAll: boolean;
}

export interface AttributeRemapResult {
  readonly preserved: string[];
  readonly lost: string[];
  readonly interpolated: string[];
}

export class AttributePropagationService {
  splitCorner(
    source: CornerId,
    target: CornerId,
    context: AttributeSplitContext,
  ): void {
    const { mesh, policy } = context;
    const sourceCorner = mesh.corners.get(source);
    const targetCorner = mesh.corners.get(target);
    
    if (!sourceCorner || !targetCorner) {
      return;
    }

    // Copy UVs if policy allows
    if (policy.uv === "copy" && sourceCorner.uv) {
      targetCorner.uv = [...sourceCorner.uv];
    }

    // Copy normals if policy allows
    if (policy.normals === "copy" && sourceCorner.normal) {
      targetCorner.normal = [...sourceCorner.normal];
    }

    // Copy colors if policy allows
    if (policy.colors === "copy" && sourceCorner.color) {
      targetCorner.color = [...sourceCorner.color];
    }

    // Copy UV channels if policy allows
    if (policy.uvChannels === "copy" && sourceCorner.uvChannels) {
      targetCorner.uvChannels = { ...sourceCorner.uvChannels };
    }
  }

  interpolateEdge(
    edge: EdgeId,
    t: number,
    context: AttributeInterpolationContext,
  ): Record<string, unknown> {
    const { mesh } = context;
    const result: Record<string, unknown> = {};
    
    // Get the two corners associated with this edge
    const edgeRecord = mesh.edges.get(edge);
    if (!edgeRecord) return result;
    
    const halfEdge = mesh.halfEdges.get(edgeRecord.halfEdge);
    if (!halfEdge) return result;
    
    // For now, return empty attributes
    // In a full implementation, we would interpolate between corners on both faces
    return result;
  }

  duplicateFace(
    sourceFace: FaceId,
    targetFace: FaceId,
    context: AttributeDuplicateContext,
  ): void {
    const { mesh, policy } = context;
    
    const sourceCorners = mesh.getFaceCorners(sourceFace);
    const targetCorners = mesh.getFaceCorners(targetFace);
    
    if (sourceCorners.length !== targetCorners.length) {
      return;
    }

    for (let i = 0; i < sourceCorners.length; i++) {
      const sourceCorner = mesh.corners.get(sourceCorners[i]!);
      const targetCorner = mesh.corners.get(targetCorners[i]!);
      
      if (!sourceCorner || !targetCorner) continue;

      // Copy UVs
      if (policy.uv === "copy" && sourceCorner.uv) {
        targetCorner.uv = [...sourceCorner.uv];
      }

      // Copy normals
      if (policy.normals === "copy" && sourceCorner.normal) {
        targetCorner.normal = [...sourceCorner.normal];
      }

      // Copy colors
      if (policy.colors === "copy" && sourceCorner.color) {
        targetCorner.color = [...sourceCorner.color];
      }

      // Copy UV channels
      if (policy.uvChannels === "copy" && sourceCorner.uvChannels) {
        targetCorner.uvChannels = { ...sourceCorner.uvChannels };
      }
    }
  }

  remap(
    _mapping: TopologyMapping,
    _policy: AttributeRemapPolicy,
  ): AttributeRemapResult {
    // This is a placeholder implementation
    // A real implementation would traverse the mapping and preserve attributes
    return {
      preserved: [],
      lost: [],
      interpolated: [],
    };
  }
}

export const attributePropagationDefaults: AttributePolicy = {
  uv: "copy",
  normals: "copy",
  seams: "preserve",
  creases: "preserve",
  materialSlots: "inherit",
  colors: "copy",
  uvChannels: "copy",
  skinWeights: "copy",
};