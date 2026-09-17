export type {
  ElementVisualState,
  ElementDomain,
  VertexMarkerStyle,
  EdgeLineStyle,
  FaceOverlayStyle,
  EdgeRole,
  SubElementVisualTheme,
  VertexVisualTheme,
  EdgeVisualTheme,
  FaceVisualTheme,
  SubElementDisplayOptions,
  SubElementLodOptions,
  SubElementLODPolicy,
  SubElementHover,
  CustomVertexMarker,
  ColorOpacity,
  DeepPartial,
} from "./types";
export {
  defaultSubElementTheme,
  defaultSubElementDisplay,
  mergeSubElementTheme,
  mergeSubElementDisplay,
  subElementDisplayForDomain,
} from "./theme";
export { resolveElementVisualState, visualStatePriority, emptyElementIdSets } from "./resolve-state";
export { worldSizeForPixels, clampPixelSize, distanceAlongView } from "./screen-space";
export { planElementLod, isLodIndexVisible } from "./lod";
export { IdIndexMap } from "./id-index";
export {
  ElementPointerMachine,
  type PointerPhase,
  type PointerTarget,
  type ElementInteractionState,
  type InteractionCancelReason,
} from "./pointer-machine";
export { GpuResourceTracker } from "./resources";
export { classifyEdge } from "./mesh-query";
export { SubElementVisualizer, type OverlayMeshSource, type VisualizerView } from "./visualizer";
export {
  MeshVisualLifecycleMachine,
  IllegalLifecycleTransitionError,
  canTransitionLifecycle,
  type MeshVisualLifecycle,
} from "./lifecycle";
export {
  MeshVisualDirtyFlag,
  MeshVisualScheduler,
  emptyMeshRevisions,
  type MeshRevisions,
  type MeshVisualSchedulerHandler,
} from "./dirty";
export { ElementStateFlag, CompactElementStates, flagsToVisualState } from "./element-flags";
export { collectAffectedFromVertices, type AffectedTopology } from "./dependency-graph";
export { remapStableId, remapIdList, remapHover, type IdRemapTable } from "./topology-remap";
export { PickRequestGate, ViewportHoverStore, type ViewportHoverState } from "./pick-request";
export { emptyDiagnostics, type SubElementDiagnostics } from "./diagnostics";
