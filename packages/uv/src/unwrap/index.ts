export { UV_CORNER_ASSIGNMENT_TOLERANCE, UV_SEAM_TOLERANCE, UV_V_AXIS } from "./constants";
export { UvUnwrapError, type UvUnwrapErrorCode } from "./errors";
export { XAtlasUnwrapBackend } from "./backend/xatlas/backend";
export { createXAtlasUnwrapBackend, getUvUnwrapBackend, setUvUnwrapBackend } from "./backend/registry";
export {
  automaticUnwrap,
  computeUvCharts,
  packUvCharts,
  parameterizeUvCharts,
  prepareAutomaticUnwrap,
  type UnwrapExecutionOptions,
} from "./pipeline";
export { applyAutomaticUnwrapResult } from "./apply";
export { packUvIslands, projectBox, projectCylindrical, projectPlanar, projectSpherical } from "./project-api";
export { buildUvTriangulation } from "./triangulation";
export type {
  AutomaticUvUnwrapOptions,
  AutomaticUvUnwrapRequest,
  AutomaticUvUnwrapResult,
  PinnedUvPolicy,
  PreparedUvUnwrap,
  UvChartBuffers,
  UvDistortionMetrics,
  UvIslandResult,
  UvTriangulationMapping,
  UvUnwrapBackend,
  UvUnwrapBackendInput,
  UvUnwrapBackendOptions,
  UvUnwrapBackendResult,
  UvUnwrapMethod,
  UvUnwrapStatistics,
  UvUnwrapWarning,
  UvUnwrapWarningCode,
} from "./types";
