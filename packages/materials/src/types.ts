import type {
  FaceId,
  MaterialId,
  MaterialInstanceId,
  MaterialSlotId,
  SamplerId,
  TextureAssetId,
  TextureId,
  UVChannelId,
} from "@modeling-kit/core";

export type MaterialAlphaMode = "opaque" | "mask" | "blend";
/** Backwards compatible alias for existing uppercase alpha mode types */
export type AlphaMode = MaterialAlphaMode | "OPAQUE" | "MASK" | "BLEND";

export interface TextureTransform {
  readonly offset: readonly [u: number, v: number];
  readonly scale: readonly [u: number, v: number];
  readonly rotation: number;
  readonly pivot?: readonly [u: number, v: number] | undefined;
}

export interface TextureBinding {
  readonly textureAssetId?: TextureAssetId | undefined;
  readonly textureId?: TextureId | undefined;
  readonly samplerId?: SamplerId | undefined;
  readonly uvChannelId?: UVChannelId | undefined;
  readonly transform?: TextureTransform | undefined;
  readonly colorSpace?: "srgb" | "linear" | undefined;
  readonly strength?: number | undefined;
  readonly enabled?: boolean | undefined;

  // Legacy fields
  readonly texCoord?: number | undefined;
  readonly scale?: number | undefined;
  readonly rotation?: number | undefined;
  readonly offset?: readonly [u: number, v: number] | undefined;
}

export interface StandardPBRMaterial {
  readonly type: "standard-pbr";
  readonly id: MaterialId;
  readonly name: string;
  readonly baseColor: readonly [r: number, g: number, b: number, a: number];
  readonly metallic: number;
  readonly roughness: number;
  readonly emissiveColor: readonly [r: number, g: number, b: number];
  readonly emissiveStrength: number;
  readonly opacity: number;
  readonly alphaMode: MaterialAlphaMode;
  readonly alphaCutoff: number;
  readonly doubleSided: boolean;
  readonly normalScale: number;
  readonly occlusionStrength: number;
  readonly textureBindings?: Readonly<Record<string, TextureBinding | undefined>> | undefined;
  readonly metadata: Record<string, unknown>;

  // Backwards compatibility aliases
  readonly emissive?: readonly [r: number, g: number, b: number] | undefined;
  readonly baseColorFactor?: readonly [r: number, g: number, b: number, a: number] | undefined;
  readonly metallicFactor?: number | undefined;
  readonly roughnessFactor?: number | undefined;
  readonly emissiveFactor?: readonly [r: number, g: number, b: number] | undefined;
  readonly pixelArt?: boolean | undefined;
}

export interface UnlitMaterial {
  readonly type: "unlit";
  readonly id: MaterialId;
  readonly name: string;
  readonly color: readonly [r: number, g: number, b: number, a: number];
  readonly opacity: number;
  readonly alphaMode: MaterialAlphaMode;
  readonly doubleSided: boolean;
  readonly textureBinding?: TextureBinding | undefined;
  readonly vertexColors: boolean;
  readonly metadata: Record<string, unknown>;

  // Backwards compatibility aliases
  readonly baseColor?: readonly [r: number, g: number, b: number, a: number] | undefined;
}

export type MaterialDefinition = StandardPBRMaterial | UnlitMaterial;

export interface MaterialInstance {
  readonly type: "material-instance";
  readonly id: MaterialInstanceId;
  readonly name: string;
  readonly parentMaterialId: MaterialId;
  readonly overrides: Partial<Omit<StandardPBRMaterial, "id" | "type" | "metadata">> &
    Partial<Omit<UnlitMaterial, "id" | "type" | "metadata">> & {
      metadata?: Record<string, unknown>;
    };
  readonly metadata: Record<string, unknown>;
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

  // Legacy fields
  readonly slotIndex?: number | undefined;
  readonly materialId?: MaterialId | null | undefined;
}

export interface MeshFace {
  readonly id: FaceId;
  readonly materialSlotId: MaterialSlotId | null;
}

/** Legacy type retained for backwards compatibility */
export type PbrMaterialData = StandardPBRMaterial;

