export { getCornerUv, normalizeUvBounds, setCornerUv, setCornerUvs, setCornerPinned, isCornerPinned, describeCornerLoop } from "./corners";
export { DEFAULT_UV_CHANNEL, createDefaultUvChannel, createUvChannel, type UVChannel, type UVChannelPurpose } from "./channels";
export { extractUvIslands, findUvIslands, setSeams, type ConnectedUvIsland } from "./islands";
export { edgeHasSeam, setEdgeSeam, toggleSeams, clearAllSeams, markBoundarySeams } from "./seams";
export { packUvs, type PackUvsOptions } from "./pack";
export { projectUvs, type ProjectUvsOptions, type UvProjection } from "./project";
export {
  resetUvs,
  snapUvsToPixels,
  splitUvsAtVertex,
  texelDensity,
  transformUvs as transformUvCorners,
  weldUvs,
  type UvTransform,
} from "./ops";
export {
  projectPlanarUv,
  projectBoxUv,
  projectCylindricalUv,
  projectSphericalUv,
} from "./projections";
export { computeUvBounds, transformUvs, type TransformUvOptions } from "./transforms";
export { analyzeUvMesh, type UvAnalysis } from "./analyze";
export {
  UvTopologyCache,
  buildDerivedUvTopology,
  getOrBuildUvTopology,
  meshUvCacheKey,
  type DerivedUvEdge,
  type DerivedUvFace,
  type DerivedUvTopology,
  type DerivedUvVertex,
  type UVCacheKey,
} from "./cache";
export {
  buildUvTopology,
  refreshUvTopologyPositions,
  type UVEdge,
  type UVFace,
  type UVIsland,
  type UVTopology,
  type UVVertex,
} from "./topology";
export { UvTransformSession } from "./session";
export type {
  UVCornerSnapshot,
  UVOperationResult,
  UVPreview,
  UVTransformCommitHandler,
  UVTransformDelta,
  UVTransformOperation,
  UVTransformPivot,
  UVTransformRequest,
} from "./session";
export type {
  BoxProjectionOptions,
  CylindricalProjectionOptions,
  PlanarProjectionOptions,
  SphericalProjectionOptions,
  UvBounds,
  UvIsland,
} from "./types";
export { UVSelection, type UVElementId, type UVSelectionHit, type UVSelectionMode, type UVSelectionOperation, type UVSelectionState } from "./selection";
export {
  DEFAULT_UV_THEME,
  UV_VISUAL_PRIORITY,
  hitRadiusUv,
  resolveVisualState,
  screenPointSize,
  themeForPreset,
  type UVEditorPreset,
  type UVElementVisualState,
  type UVVisualTheme,
} from "./visual";
export { UVDirtyBatcher, UVPaintDirtyFlag, emptyUvPaintRevisions, type UVPaintRevisions } from "./dirty";
export { UVInteractionMachine, canTransitionUvInteraction, type UVInteractionState } from "./interaction";
export { uvIdsInBox, uvIdsInPolygon, normalizeUvBox, type UvBox } from "./marquee";
export { pickUv, type UVPickHit } from "./picking";
export {
  IDENTITY_UV_VIEW,
  buildUvViewData,
  type Rect2,
  type UVDiagnosticDrawData,
  type UVEdgeDrawData,
  type UVFaceDrawData,
  type UVIslandDrawData,
  type UVSelectionDrawData,
  type UVTileDrawData,
  type UVVertexDrawData,
  type UVViewData,
  type UVViewTransform,
} from "./view-data";
export { UVViewAdapter, type UVViewAdapterOptions, type UVViewSchedule } from "./view-adapter";
export { UVEditor, createUvEditor, type CreateUvEditorOptions, type UVCornerPatch, type UVEditorLifecycle, type UVPointerModifiers, type UVPointerTool } from "./editor";
