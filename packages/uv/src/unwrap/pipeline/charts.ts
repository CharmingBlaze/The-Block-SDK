import { getUvUnwrapBackend } from "../backend/registry";
import { throwIfAborted, UvUnwrapError } from "../errors";
import { buildUvTriangulation } from "../triangulation";
import type { AutomaticUvUnwrapRequest, UvChartBuffers } from "../types";
import type { UnwrapExecutionOptions } from "./execution";
import { resolveTargetFaceIds } from "./faces";
import { toBackendOptions } from "./options";

export async function computeUvCharts(
  request: AutomaticUvUnwrapRequest,
  execution: UnwrapExecutionOptions = {},
): Promise<UvChartBuffers> {
  throwIfAborted(execution.signal);
  if (request.mesh.faces.size === 0 || request.mesh.vertices.size === 0) {
    throw new UvUnwrapError("empty-mesh", "Automatic chart unwrap requires a non-empty mesh");
  }
  const faceIds = resolveTargetFaceIds(request.mesh, request.faceIds);
  const built = buildUvTriangulation(request.mesh, faceIds);
  const backend = execution.backend ?? getUvUnwrapBackend();
  await backend.initialize();
  throwIfAborted(execution.signal);
  const result = await backend.unwrap(built.input, toBackendOptions(request.options), execution.signal);
  return {
    result,
    mapping: built.mapping,
    positions: built.input.positions,
    indices: built.input.indices,
  };
}

/**
 * xatlas computeCharts already parameterizes. This stage is a documented no-op.
 */
export async function parameterizeUvCharts(charts: UvChartBuffers): Promise<UvChartBuffers> {
  return charts;
}

/**
 * Re-runs xatlas generate with new pack options. Native packCharts needs a live atlas;
 * watlas does not expose a durable atlas handle through this SDK.
 */
export async function packUvCharts(
  request: AutomaticUvUnwrapRequest,
  execution: UnwrapExecutionOptions = {},
): Promise<UvChartBuffers> {
  return computeUvCharts(request, execution);
}
