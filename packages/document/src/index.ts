export { createEditorSession, createModelDocument } from "./create";
export { createDocument, transitionDocumentLifecycle } from "./document";
export type {
  CreateDocumentOptions,
  EditorSession,
  InteractionState,
  SelectionState,
  SnappingSettings,
} from "./create";
export { EntityStore, type EntityStoreJson } from "./entity-store";
export { nodeId } from "./ids";
export {
  documentFromUnknown,
  parseDocument,
  serializeDocument,
  toSerializedDocument,
} from "./serialize";
export { bytesToBase64, base64ToBytes } from "./base64";
export { CURRENT_SCHEMA_VERSION } from "./types";
export type {
  AlphaMode,
  AnimationChannel,
  AnimationClipData,
  AnimationInterpolation,
  AnimationKeyframe,
  AnimationLoopMode,
  AnimationTargetKind,
  AnimationTrackData,
  BoneData,
  ColorSpace,
  DocumentLifecycle,
  DocumentSettings,
  FilterMode,
  ImageDocument,
  ImageLayer,
  LayerBlendMode,
  MaterialData,
  MaterialDefinition,
  MaterialInstance,
  MeshData,
  MeshRecord,
  MeshSkinBinding,
  ModelDocument,
  PixelRect,
  PixelTile,
  SceneGraphData,
  SceneNode,
  SceneNodeType,
  SkeletonData,
  SkinInfluence,
  TextureAsset,
  TextureBinding,
  TextureData,
  TextureSampler,
  TextureSet,
  TextureSetChannel,
  TextureSourceKind,
  TextureTransform,
  TextureUsage,
  TimelineMarker,
  VertexSkinData,
  WrapMode,
} from "./types";
export {
  createAnimationClipData,
  createBoneData,
  createSkeletonData,
  normalizeClip,
  normalizeSkeleton,
  normalizeSkin,
} from "./clips";
export {
  createMaterialData,
  createMaterialInstanceData,
  createTextureData,
  createTextureSet,
  defaultTextureSampler,
  materialFromTextureSet,
  normalizeMaterial,
  normalizeTexture,
  syncMaterialDualFields,
} from "./pbr";
export {
  applyTilePatches,
  compositeImage,
  createGroupLayer,
  createImageDocument,
  createRasterLayer,
  DEFAULT_IMAGE_TILE_SIZE,
  getLayer,
  makeTileKey,
  normalizeImageDocument,
  readImagePixel,
  reorderRootLayers,
  replaceLayer,
  addImageLayer,
  removeImageLayer,
  updateLayerProperties,
  writeImageRect,
  type PixelTilePatch,
} from "./image";
export { bumpDocumentRevisions, ensureDocumentRevisions, parseDocumentRevisions } from "./revisions";
export { applyMigrations, migrations, type Migration } from "./migrate";
export {
  beginDocumentTransaction,
  recordNodeChange,
  type DocumentTransaction,
  type DocumentTransactionResult,
} from "./transaction";
export {
  assertValidDocument,
  validateDocument,
  type DocumentIssue,
  type DocumentValidationResult,
  type SceneGraphIssue,
} from "./validation";
export {
  addNode,
  ancestors,
  buildResourceUsageIndex,
  clearSceneChildren,
  descendants,
  duplicateHierarchy,
  duplicateNode,
  duplicateSubtree,
  effectiveLocked,
  effectiveVisibility,
  findByName,
  findByTag,
  findByType,
  findUnusedResources,
  getAncestors,
  getChildren,
  getDescendants,
  getEffectiveLocked,
  getEffectiveSelectable,
  getEffectiveVisibility,
  getMaterialUsers,
  getMeshUsers,
  getNode,
  getParent,
  getRoots,
  getWorldTransform,
  groupNodes,
  isAncestorOf,
  isDescendant,
  linkMesh,
  removeNode,
  removeUnusedResources,
  renameNode,
  reorderChildren,
  reorderNode,
  reparent,
  restoreNode,
  setLocalTransform,
  setLocked,
  setNodeLocked,
  setNodeSelectable,
  setNodeVisible,
  setSelectable,
  setVisibility,
  syncRootIds,
  traverse,
  ungroupNode,
  worldMatrix,
} from "./scene-graph";
export type {
  AddNodeInput,
  DuplicateMeshPolicy,
  DuplicateOptions,
  DuplicateRemap,
  RemoveNodePolicy,
  ReparentMode,
  ReparentTransformPolicy,
  ResourceUsageIndex,
} from "./scene-graph";
export { hierarchyIndex } from "./hierarchy-index";
export { worldTransformCache } from "./transform-cache";
export {
  cloneTransform,
  composeTransform,
  decomposeTransform,
  identityLocalTransform,
  invertTransform,
  multiplyTransforms,
  normalizeStoredTransform,
  transformDirection,
  transformPoint,
  tryInvertTransform,
  validateTransform,
} from "./transforms";
export { MAX_HIERARCHY_TRAVERSAL } from "./transform-cache";
export {
  extractFragment,
  insertFragment,
  type DocumentFragment,
  type FragmentInsertResult,
} from "./fragment";
export { cloneSceneNode, canonicalizeSceneNodeType, isMeshLikeNode, nodeMeshId } from "./scene-node";
export {
  SceneNodeExtensionRegistry,
  registerSceneNodeExtension,
  sceneNodeExtensions,
} from "./extension-registry";
export type { SceneNodeExtensionDefinition } from "./extension-registry";
export type { Transform } from "./scene-node";
export {
  createChangeSet,
  inferredDocumentChangeKind,
  type StructuredDocumentChangeSet,
} from "./change-set";
