export {
  ThreeViewportAdapter,
  type ThreeViewportAdapterOptions,
  type ViewportRenderer,
} from "./adapter";
export {
  BruteForceSpatialQuery,
  type SpatialHit,
  type SpatialQueryBackend,
  type SpatialRay,
} from "./spatial-query";
export { SceneDirtyFlag, type SceneMirrorLifecycle } from "./scene-sync";
export { createBufferGeometry, syncDerivedGeometry, type RenderMapping } from "./geometry";
export { createStandardMaterial, defaultViewportMaterial } from "./pbr";
export { buildSelectionOverlay } from "./overlay";
export {
  createKnifeOverlay,
  updateKnifeOverlay,
  dashSegmentPositions,
  type KnifeOverlayState,
  type KnifeOverlayVec3,
} from "./overlays/knife-overlay";
export {
  pickEdgeOnFace,
  pickVertexOnFace,
  resolveFaceId,
  type PickDomain,
  type PickResult,
  type PickingOptions,
} from "./picking";
export { applyPickSelection, clientToNdc, isClickNotDrag } from "./pick-selection";
export {
  createThreeViewport,
  type CreateThreeViewportOptions,
  type ThreeViewportCameraOptions,
  type ThreeViewportHandle,
  type ThreeViewportController,
  type ThreeViewportOptions,
} from "./viewport";
export {
  defaultSubElementTheme,
  defaultSubElementDisplay,
  mergeSubElementTheme,
  mergeSubElementDisplay,
  resolveElementVisualState,
  visualStatePriority,
  emptyElementIdSets,
  worldSizeForPixels,
  clampPixelSize,
  planElementLod,
  isLodIndexVisible,
  IdIndexMap,
  ElementPointerMachine,
  SubElementVisualizer,
  classifyEdge,
  MeshVisualLifecycleMachine,
  IllegalLifecycleTransitionError,
  MeshVisualDirtyFlag,
  MeshVisualScheduler,
  ElementStateFlag,
  CompactElementStates,
  flagsToVisualState,
  collectAffectedFromVertices,
  remapStableId,
  remapIdList,
  remapHover,
  PickRequestGate,
  ViewportHoverStore,
  type ElementVisualState,
  type ElementDomain,
  type VertexMarkerStyle,
  type EdgeLineStyle,
  type FaceOverlayStyle,
  type SubElementVisualTheme,
  type VertexVisualTheme,
  type EdgeVisualTheme,
  type FaceVisualTheme,
  type SubElementDisplayOptions,
  type SubElementHover,
  type PointerPhase,
  type DeepPartial,
  type MeshVisualLifecycle,
  type SubElementDiagnostics,
  type ElementInteractionState,
} from "./sub-element";
