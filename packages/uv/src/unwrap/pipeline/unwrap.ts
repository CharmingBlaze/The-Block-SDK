import { applyAutomaticUnwrapResult } from "../apply";
import { assignCornerUvs } from "../convert";
import { computeUvDistortion } from "../distortion";
import { assertPinsAllowed, collectPinnedCorners, resolvePinnedPolicy, resolveUvChannel } from "../pins";
import { detectSeamsFromCornerUvs, islandsFromSeams } from "../seams";
import type { AutomaticUvUnwrapRequest, AutomaticUvUnwrapResult } from "../types";
import { overlapWarnings, validatePreparedUnwrap } from "../validate";
import { computeUvCharts } from "./charts";
import type { UnwrapExecutionOptions } from "./execution";
import { resolveTargetFaceIds } from "./faces";
import { assertSupportedUnwrapOptions } from "./options";
import { assertAllTargetCornersMapped, distortionWarnings, pinIgnoredWarning } from "./warnings";

export async function prepareAutomaticUnwrap(
  request: AutomaticUvUnwrapRequest,
  execution: UnwrapExecutionOptions = {},
): Promise<AutomaticUvUnwrapResult> {
  const warnings = assertSupportedUnwrapOptions(request.options);
  const channelId = resolveUvChannel(request.uvChannel);
  const faceIds = resolveTargetFaceIds(request.mesh, request.faceIds);
  const pinned = collectPinnedCorners(request.mesh, faceIds, channelId);
  const policy = resolvePinnedPolicy(request.options);
  assertPinsAllowed(pinned, policy);
  if (pinned.length > 0 && policy === "ignore-with-warning") {
    warnings.push(pinIgnoredWarning(pinned));
  }

  const topology = {
    vertices: request.mesh.vertices.size,
    faces: request.mesh.faces.size,
    edges: request.mesh.edges.size,
  };
  const charts = await computeUvCharts(request, execution);
  const cornerUvs = assignCornerUvs(charts.mapping, charts.result, charts.positions.length / 3);
  assertAllTargetCornersMapped(request.mesh, faceIds, cornerUvs);

  const seamEdgeIds = detectSeamsFromCornerUvs(request.mesh, new Set(faceIds), cornerUvs);
  const islands = islandsFromSeams(request.mesh, faceIds, seamEdgeIds, cornerUvs);
  const distortion = computeUvDistortion(request.mesh, charts.mapping, cornerUvs);
  warnings.push(...distortionWarnings(distortion));
  warnings.push(...overlapWarnings(request.mesh, faceIds, cornerUvs, channelId));

  const result: AutomaticUvUnwrapResult = {
    cornerUvs,
    seamEdgeIds,
    islands,
    warnings,
    statistics: {
      chartCount: charts.result.chartCount,
      islandCount: islands.length,
      atlasWidth: charts.result.atlasWidth,
      atlasHeight: charts.result.atlasHeight,
      inputVertexCount: charts.positions.length / 3,
      outputVertexCount: charts.result.vertexCount,
      triangleCount: charts.result.triangleCount,
      distortion,
    },
    targetedFaceIds: faceIds,
    uvChannel: channelId,
  };
  validatePreparedUnwrap(request.mesh, charts.mapping, result, topology);
  return result;
}

export async function automaticUnwrap(
  request: AutomaticUvUnwrapRequest,
  execution: UnwrapExecutionOptions = {},
): Promise<AutomaticUvUnwrapResult> {
  const result = await prepareAutomaticUnwrap(request, execution);
  if (execution.apply !== false) {
    applyAutomaticUnwrapResult(request.mesh, result);
  }
  return result;
}
