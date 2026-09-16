export { CreatePrimitiveCommand } from "./create-primitive";
export { CreateLibraryPrimitiveCommand } from "./create-library-primitive";
export { ExtrudeProfileCommand } from "./extrude-profile";
export type {
  CreatePrimitiveParams,
  CreatePrimitiveResult,
  PrimitiveType,
} from "./create-primitive-result";
export {
  ExtrudeFacesCommand,
  type ExtrudeFacesParams,
  type ExtrudeFacesResult,
} from "./extrude-faces";
export { ExtrudeRegionCommand, type ExtrudeRegionParams } from "./extrude-region";
export { InsetFacesCommand, type InsetFacesParams } from "./inset-faces";
export { SubdivideFacesCommand, type SubdivideFacesParams } from "./subdivide-faces";
export { HealMeshCommand } from "./heal-mesh";
export { FillBoundaryCommand, type FillBoundaryParams } from "./fill-boundary";
export { BridgeLoopsCommand, type BridgeLoopsParams } from "./bridge-loops";
export { BevelEdgesCommand, type BevelEdgesParams } from "./bevel-edges";
export { LoopCutCommand, type LoopCutParams } from "./loop-cut";
export { DissolveEdgesCommand, type DissolveEdgesParams } from "./dissolve-edges";
export {
  CollapseEdgeCommand,
  DissolveFaceCommand,
  DissolveVertexCommand,
  ReverseFaceWindingCommand,
  type CollapseEdgeParams,
  type DissolveFaceCommandParams,
  type DissolveVertexParams,
  type ReverseFaceWindingParams,
} from "./dissolve-collapse";
export {
  SplitEdgeCommand,
  CutFaceCommand,
  type SplitEdgeParams,
  type CutFaceParams,
} from "./split-cut";
export { KnifeCutCommand, type KnifeCutParams } from "./knife";
export { ExecuteKnifePlanCommand, type ExecuteKnifePlanParams } from "./execute-knife-plan";
export {
  CatmullClarkSubdivideCommand,
  type CatmullClarkParams,
} from "./catmull-clark";
export { ConnectVerticesCommand, type ConnectVerticesParams } from "./connect-vertices";
export { MergeVerticesCommand, type MergeVerticesParams } from "./merge-vertices";
export { TriangulateFacesCommand, type TriangulateFacesParams } from "./triangulate-faces";
export { SetCornerUvsCommand, type SetCornerUvsParams, type CornerUvSnapshot } from "./set-corner-uvs";
export { ProjectUvCommand, type ProjectUvMode, type ProjectUvParams } from "./project-uv";
export { AssignMaterialSlotCommand, type AssignMaterialSlotParams } from "./assign-material-slot";
export {
  AddMaterialSlotCommand,
  ReorderMaterialSlotsCommand,
  type AddMaterialSlotParams,
  type ReorderMaterialSlotsParams,
} from "./material-slot-commands";
export { UpdateMaterialCommand, type UpdateMaterialParams } from "./update-material";
export { canExecute, type CapabilityDecision, type CapabilityContext } from "./capabilities";
export { ModelingSession, createModelingSession } from "./session";
export { CreateMaterialCommand, type CreateMaterialParams } from "./create-material";
export { AssignMaterialCommand, type AssignMaterialParams } from "./assign-material";
export { ProjectUvsCommand, type ProjectUvsParams } from "./project-uvs";
export { PackUvsCommand, type PackUvsParams } from "./pack-uvs";
export { SetSeamsCommand, type SetSeamsParams } from "./set-seams";
export { CreateClipCommand, type CreateClipParams } from "./create-clip";
export { SetKeyframeCommand, type SetKeyframeParams } from "./set-keyframe";
export {
  CreateSkeletonCommand,
  type CreateSkeletonParams,
  type CreateSkeletonResult,
} from "./create-skeleton";
export { BindSkinCommand, type BindSkinParams } from "./bind-skin";
export { SetTransformsCommand, type SetTransformsParams } from "./set-transforms";
export { ReparentCommand, type ReparentParams } from "./reparent";
export {
  DuplicateObjectsCommand,
  type DuplicateObjectsParams,
  type DuplicateObjectsResult,
} from "./duplicate-objects";
export { SetVisibilityCommand, type SetVisibilityParams } from "./set-visibility";
export {
  GroupObjectsCommand,
  type GroupObjectsParams,
  type GroupObjectsResult,
} from "./group-objects";
export { UngroupObjectsCommand, type UngroupObjectsParams } from "./ungroup-objects";
export { CreateTextureCommand, type CreateTextureParams } from "./create-texture";
export {
  BindMaterialTextureSetCommand,
  CreateTextureSetCommand,
  DeleteTextureSetCommand,
  UpdateTextureSetCommand,
  type BindMaterialTextureSetParams,
  type CreateTextureSetParams,
  type DeleteTextureSetParams,
  type UpdateTextureSetParams,
} from "./texture-sets";
export {
  CreateMaterialInstanceCommand,
  UpdateMaterialInstanceCommand,
  type CreateMaterialInstanceParams,
  type UpdateMaterialInstanceParams,
} from "./material-instances";
export { CreateImageDocumentCommand, type CreateImageDocumentParams } from "./create-image-document";
export {
  AddImageLayerCommand,
  ApplyImageTilePatchesCommand,
  RemoveImageLayerCommand,
  UpdateImageLayerCommand,
  type AddImageLayerParams,
  type ApplyImageTilePatchesParams,
  type RemoveImageLayerParams,
  type UpdateImageLayerParams,
} from "./image-layers";
export {
  PaintStrokeCommand,
  snapshotTexturePixels,
  type PaintStrokeParams,
} from "./paint-stroke";
export { RenameNodeCommand, type RenameNodeParams } from "./rename-node";
export { ReorderNodeCommand, type ReorderNodeParams } from "./reorder-node";
export { SetLockedCommand, type SetLockedParams } from "./set-locked";
export {
  MakeMeshIndependentCommand,
  type MakeMeshIndependentParams,
  type MakeMeshIndependentResult,
} from "./make-mesh-independent";
export { WeldVerticesCommand, type WeldVerticesParams, type WeldResult } from "./weld-vertices";
export {
  inspectScene,
  type ObjectSummary,
  type SceneInspectionResult,
  type SelectedSummary,
} from "./scene-inspector";
export {
  FluentEditor,
  FluentMeshObject,
  FluentSelection,
  createEditor,
  type FaceSelectFilter,
  type VecDelta,
} from "./fluent-editor";
export {
  SessionCapabilities,
  type CapabilityDenial,
  type CapabilityId,
  type CapabilityResult,
} from "./capabilities";
