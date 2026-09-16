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
  clientToViewportPixel,
  createFacePickingGeometry,
  createFacePickingMaterial,
  createObjectPickingMaterial,
  decodePickId,
  DefaultGpuPickingService,
  encodePickId,
  GPU_PICK_BACKGROUND_ID,
  InMemoryGpuPickRegistry,
  MAX_GPU_PICK_ID,
  pickIdToUnitRgb,
  softwarePickAtPixel,
  type GpuPickDrawable,
  type GpuPickRecord,
  type GpuPickRegistry,
  type GpuPickRequest,
  type GpuPickingBackend,
  type GpuPickingDiagnostics,
  type GpuPickingReadback,
  type GpuPickingService,
  type GpuPointPickResult,
  type PickingInvalidation,
  type ViewportPixel,
} from "./gpu-picking";
export {
  createThreeViewport,
  type CreateThreeViewportOptions,
  type ThreeViewportCameraOptions,
  type ThreeViewportHandle,
  type ThreeViewportController,
  type ThreeViewportOptions,
  type ThreeViewportPickingOptions,
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
export { applyCpuSkin } from "./skin";
export {
  createThreeSkeleton,
  applyBoneRestTransform,
  type ThreeSkeletonResources,
} from "./rigging/create-skeleton";
export {
  createThreeSkinnedMesh,
  writeSkinAttributes,
  type ThreeSkinnedMeshResources,
} from "./rigging/create-skinned-mesh";
export { updateThreeSkeleton } from "./rigging/update-skeleton";
export { disposeThreeSkeleton } from "./rigging/dispose-skeleton";
export { createThreeAnimationClip } from "./animation/create-animation-clip";
export { createThreeAnimationMixer, createAnimationPlayback } from "./animation/create-animation-mixer";
export {
  playThreeClip,
  updateThreeAnimation,
  type AnimationPlaybackHandle,
} from "./animation/update-animation";
export { disposeThreeAnimation } from "./animation/dispose-animation";
