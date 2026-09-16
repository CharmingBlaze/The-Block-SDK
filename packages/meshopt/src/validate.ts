import type { MeshoptLimits } from "./limits";
import type { MeshoptRequest } from "./types";

export function validateRequest(request: MeshoptRequest, limits: MeshoptLimits): string | undefined {
  const vertexCount = request.positions.length / 3;
  if (!Number.isInteger(vertexCount) || vertexCount < 3) {
    return "positions length must be a multiple of 3 and at least 9";
  }
  if (request.indices.length < 3 || request.indices.length % 3 !== 0) {
    return "indices length must be a multiple of 3 and at least 3";
  }
  if (vertexCount > limits.maxVertices || request.indices.length > limits.maxIndices) {
    return "limit-exceeded";
  }
  const bytes =
    request.positions.byteLength +
    request.indices.byteLength +
    (request.normals?.byteLength ?? 0) +
    (request.uvs?.byteLength ?? 0);
  if (bytes > limits.maxBytes) {
    return "limit-exceeded";
  }
  for (const index of request.indices) {
    if (!Number.isInteger(index) || index < 0 || index >= vertexCount) {
      return "index out of range";
    }
  }
  if (request.normals && request.normals.length !== vertexCount * 3) {
    return "normals length must match positions";
  }
  if (request.uvs && request.uvs.length !== vertexCount * 2) {
    return "uvs length must match vertex count";
  }
  if (request.triangleFaceIds && request.triangleFaceIds.length !== request.indices.length / 3) {
    return "triangleFaceIds length must match triangle count";
  }
  return undefined;
}

export function resolveTargetIndexCount(request: MeshoptRequest, limits: MeshoptLimits): number {
  if (request.targetIndexCount !== undefined) {
    return clampIndexCount(request.targetIndexCount, request.indices.length, limits);
  }
  const ratio = request.targetIndexRatio ?? 0.5;
  return clampIndexCount(Math.floor(request.indices.length * ratio), request.indices.length, limits);
}

function clampIndexCount(count: number, source: number, limits: MeshoptLimits): number {
  const min = limits.minTriangles * 3;
  const even = count - (count % 3);
  return Math.max(min, Math.min(source, even));
}
