import type {
  AnimationId,
  BoneId,
  DocumentId,
  ImageDocumentId,
  LayerId,
  MeshId,
  MaterialId,
  MaterialInstanceId,
  MaterialSlotId,
  NodeId,
  SamplerId,
  SkeletonId,
  TextureId,
  TextureSetId,
  UVChannelId,
  VertexId,
  TileKey,
} from "@modeling-kit/core";
import type { DocumentRevisions } from "@modeling-kit/core";
import type { TransformData } from "@modeling-kit/math";
import type { EntityStore } from "./entity-store";
import type { SceneNode } from "./scene-node";

export const CURRENT_SCHEMA_VERSION = 2;

export type {
  ArmatureNode,
  CameraNode,
  ExtensionNode,
  GroupNode,
  LightNode,
  LocatorNode,
  MeshNode,
  PrimitiveNode,
  PrimitiveParameters,
  PrimitiveType,
  ReferenceImageNode,
  SceneNode,
  SceneNodeType,
  SkeletonBinding,
  Transform,
} from "./scene-node";

export interface SceneGraphData {
  /** Synthetic scene origin. User-facing roots are its children (`rootIds`). */
  rootNodeId: NodeId;
  /** Outliner order of top-level nodes; always matches the origin node's `childIds`. */
  rootIds: NodeId[];
  nodes: EntityStore<SceneNode>;
}

export interface DocumentSettings {
  readonly units: "unitless" | "millimeter" | "centimeter" | "meter" | "inch";
  readonly unitsPerMeter: number;
  readonly upAxis: "Y";
  readonly forwardAxis: "-Z";
  readonly handedness: "right";
  readonly angleUnit: "degrees";
  readonly gridSize: number;
}

export type MaterialSlotTarget =
  | { readonly type: "material"; readonly materialId: MaterialId }
  | {
      readonly type: "material-instance";
      readonly materialInstanceId: MaterialInstanceId;
    };

export interface MaterialSlot {
  readonly id: MaterialSlotId;
  readonly name: string;
  readonly target: MaterialSlotTarget;
  readonly slotIndex?: number | undefined;
  readonly materialId?: MaterialId | null | undefined;
}

export interface MeshRecord {
  readonly id: MeshId;
  readonly name: string;
  readonly kernel?: unknown;
  /** Material slots with stable IDs */
  readonly materialSlots?: readonly MaterialSlot[];
  /** Material IDs indexed by `FaceRecord.materialSlot`. */
  readonly materialIds: readonly MaterialId[];
  readonly skin?: MeshSkinBinding;
  readonly metadata: Record<string, unknown>;
}

export type MeshData = MeshRecord;
export type MaterialDefinition = MaterialData;
export type TextureAsset = TextureData;

export interface MaterialInstance {
  readonly id: MaterialInstanceId;
  readonly name: string;
  readonly materialId: MaterialId;
  readonly parentMaterialId?: MaterialId | undefined;
  readonly overrides?: Record<string, unknown> | undefined;
  readonly metadata: Record<string, unknown>;
}

export interface TextureTransform {
  readonly offset: readonly [number, number];
  readonly scale: readonly [number, number];
  readonly rotation: number;
  readonly pivot?: readonly [number, number] | undefined;
}

export interface TextureBinding {
  readonly textureId?: TextureId | undefined;
  readonly samplerId?: SamplerId | undefined;
  readonly uvChannelId?: UVChannelId | undefined;
  readonly transform?: TextureTransform | undefined;
  readonly colorSpace?: ColorSpace | undefined;
  readonly strength?: number | undefined;
  readonly enabled?: boolean | undefined;
}

export type TextureSourceKind = "embedded" | "external" | "generated" | "image-document";
export type TextureUsage = "color" | "normal" | "data" | "unknown";

export type TextureSetChannel =
  | "baseColor"
  | "normal"
  | "metallicRoughness"
  | "emissive"
  | "occlusion";

export interface TextureSet {
  readonly id: TextureSetId;
  readonly name: string;
  readonly channels: Readonly<Partial<Record<TextureSetChannel, TextureId>>>;
  readonly textureIds: readonly TextureId[];
  readonly metadata: Record<string, unknown>;
}

export type ImageLayerType = "raster" | "group" | "mask";
export type LayerBlendMode = "normal" | "multiply" | "add" | "screen";
export type PixelFormat = "rgba8";

export interface PixelRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface PixelTile {
  readonly key: TileKey;
  readonly tx: number;
  readonly ty: number;
  readonly pixelsBase64: string;
}

export interface ImageLayer {
  readonly id: LayerId;
  readonly name: string;
  readonly type: ImageLayerType;
  readonly parentId: LayerId | null;
  readonly childIds: readonly LayerId[];
  readonly visible: boolean;
  readonly opacity: number;
  readonly blendMode: LayerBlendMode;
  readonly locked: boolean;
  readonly alphaLock: boolean;
  readonly tiles: readonly PixelTile[];
  readonly propertyRevision: number;
  readonly pixelRevision: number;
  readonly metadata: Record<string, unknown>;
}

export interface ImageDocument {
  readonly id: ImageDocumentId;
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly colorSpace: ColorSpace;
  readonly pixelFormat: PixelFormat;
  readonly tileSize: number;
  readonly rootLayerIds: readonly LayerId[];
  readonly layers: readonly ImageLayer[];
  readonly metadata: Record<string, unknown>;
}

export type DocumentLifecycle =
  | "creating"
  | "ready"
  | "loading"
  | "saving"
  | "closing"
  | "closed"
  | "failed";

export type AlphaMode = "opaque" | "mask" | "blend";
export type ColorSpace = "srgb" | "linear";
export type FilterMode = "nearest" | "linear";
export type MipmapFilterMode = FilterMode | "none";
export type WrapMode = "repeat" | "clamp" | "mirror";

export interface TextureSampler {
  readonly magFilter: FilterMode;
  readonly minFilter: FilterMode;
  /** Combined with `minFilter` when writing glTF `minFilter` enums. Omitted means unspecified. */
  readonly mipmapFilter?: MipmapFilterMode;
  readonly wrapS: WrapMode;
  readonly wrapT: WrapMode;
}

export interface MaterialData {
  readonly id: MaterialId;
  readonly name: string;
  readonly type?: "standard-pbr" | "unlit" | undefined;
  readonly baseColor: readonly [number, number, number, number];
  readonly metallic: number;
  readonly roughness: number;
  readonly emissive: readonly [number, number, number];
  readonly emissiveColor?: readonly [number, number, number] | undefined;
  readonly emissiveStrength?: number | undefined;
  readonly opacity?: number | undefined;
  readonly normalScale?: number | undefined;
  readonly occlusionStrength?: number | undefined;
  readonly color?: readonly [number, number, number, number] | undefined;
  readonly vertexColors?: boolean | undefined;
  readonly alphaMode: AlphaMode;
  readonly alphaCutoff: number;
  readonly doubleSided: boolean;
  readonly pixelArt: boolean;
  readonly baseColorTexture?: TextureId;
  readonly normalTexture?: TextureId;
  readonly metallicRoughnessTexture?: TextureId;
  readonly emissiveTexture?: TextureId;
  readonly occlusionTexture?: TextureId;
  readonly textureBindings?: Readonly<Partial<Record<string, TextureBinding>>> | undefined;
  readonly textureSetId?: TextureSetId | undefined;
  readonly metadata: Record<string, unknown>;
}

export interface TextureData {
  readonly id: TextureId;
  readonly name: string;
  readonly colorSpace: ColorSpace;
  readonly sampler: TextureSampler;
  readonly samplerId?: SamplerId | undefined;
  readonly sourceKind?: TextureSourceKind | undefined;
  readonly usage?: TextureUsage | undefined;
  readonly imageDocumentId?: ImageDocumentId | undefined;
  readonly uri?: string;
  readonly mimeType?: string;
  readonly width?: number;
  readonly height?: number;
  /** Base64-encoded tightly packed RGBA8 pixels (`width * height * 4`). */
  readonly pixelsBase64?: string;
  /** Original encoded image bytes (PNG/JPEG/WebP). Prefer this over decoding on import. */
  readonly encodedBytesBase64?: string;
  readonly metadata: Record<string, unknown>;
}

export interface BoneData {
  readonly id: BoneId;
  readonly name: string;
  readonly parentId: BoneId | null;
  readonly restTransform: TransformData;
  readonly visible: boolean;
  readonly locked: boolean;
  readonly metadata: Record<string, unknown>;
}

export interface SkeletonData {
  readonly id: SkeletonId;
  readonly name: string;
  readonly bones: readonly BoneData[];
  readonly metadata: Record<string, unknown>;
}

export type AnimationLoopMode = "once" | "repeat" | "ping-pong" | "hold";
export type AnimationInterpolation = "constant" | "linear" | "cubic";
export type AnimationChannel = "position" | "rotation" | "scale" | "visibility";
export type AnimationTargetKind = "bone" | "object";

export interface AnimationKeyframe {
  readonly time: number;
  readonly value: readonly number[];
}

export interface AnimationTrackData {
  readonly id: string;
  readonly targetKind: AnimationTargetKind;
  readonly targetId: string;
  readonly channel: AnimationChannel;
  readonly interpolation: AnimationInterpolation;
  readonly keys: readonly AnimationKeyframe[];
}

export interface TimelineMarker {
  readonly time: number;
  readonly name: string;
}

export interface AnimationClipData {
  readonly id: AnimationId;
  readonly name: string;
  readonly duration: number;
  readonly loopMode: AnimationLoopMode;
  readonly tracks: readonly AnimationTrackData[];
  readonly markers: readonly TimelineMarker[];
  readonly metadata: Record<string, unknown>;
}

export interface SkinInfluence {
  readonly boneId: BoneId;
  readonly weight: number;
}

export interface VertexSkinData {
  readonly vertexId: VertexId;
  readonly influences: readonly SkinInfluence[];
}

export interface InverseBindMatrix {
  readonly boneId: BoneId;
  /** Column-major 4×4 matrix, 16 finite numbers. */
  readonly matrix: readonly number[];
}

export interface MeshSkinBinding {
  readonly skeletonId: SkeletonId;
  readonly maxInfluences: number;
  readonly vertices: readonly VertexSkinData[];
  /**
   * Authored inverse bind matrices keyed by bone.
   * When omitted, evaluators use rest-pose inverses from the skeleton.
   * When present (including identity entries), imported values are not recomputed.
   */
  readonly inverseBindMatrices?: readonly InverseBindMatrix[];
}

export interface ModelDocument {
  schemaVersion: number;
  revision: number;
  revisions: DocumentRevisions;
  id: DocumentId;
  name: string;
  settings: DocumentSettings;
  scene: SceneGraphData;
  meshes: EntityStore<MeshRecord>;
  materials: EntityStore<MaterialData>;
  materialInstances: EntityStore<MaterialInstance>;
  textures: EntityStore<TextureData>;
  textureSets: EntityStore<TextureSet>;
  images: EntityStore<ImageDocument>;
  skeletons: EntityStore<SkeletonData>;
  animations: EntityStore<AnimationClipData>;
  metadata: Record<string, unknown>;
  lifecycle: DocumentLifecycle;
}
