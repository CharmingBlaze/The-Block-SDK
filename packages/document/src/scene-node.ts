import type {
  MaterialId,
  MaterialInstanceId,
  MeshId,
  NodeId,
  SkeletonId,
  TextureAssetId,
} from "@modeling-kit/core";
import { identityTransform, type TransformData } from "@modeling-kit/math";

export type Transform = TransformData;

export type SceneNodeType =
  | "group"
  | "mesh"
  | "mesh_instance"
  | "primitive"
  | "primitive_instance"
  | "armature"
  | "locator"
  | "empty"
  | "camera"
  | "light"
  | "bone"
  | "reference-image"
  | "reference_image"
  | "extension";

export function canonicalizeSceneNodeType(type: string): SceneNodeType {
  if (type === "reference_image") {
    return "reference-image";
  }
  return type as SceneNodeType;
}

export interface SkeletonBinding {
  readonly skeletonId: SkeletonId;
  readonly armatureNodeId?: NodeId;
}

export type PrimitiveType =
  | "cube"
  | "box"
  | "plane"
  | "grid"
  | "disc"
  | "circle"
  | "uv-sphere"
  | "quad-sphere"
  | "ico-sphere"
  | "uvSphere"
  | "quadSphere"
  | "icosphere"
  | "cylinder"
  | "cone"
  | "pyramid"
  | "torus"
  | "capsule"
  | "ramp"
  | "stairs"
  | "arch"
  | "wall"
  | "column"
  | "quad"
  | "rectangle"
  | "roundedRectangle"
  | "stadium"
  | "ellipse"
  | "annulus"
  | "superellipse"
  | "squircle"
  | "reuleux"
  | "roundedCube"
  | "ellipsoid"
  | "tetrahedron"
  | "icosahedron";

export type PrimitiveParameters = Record<string, number | string | boolean | undefined>;

export interface SceneNodeBase {
  readonly id: NodeId;
  readonly type: SceneNodeType;
  readonly name: string;
  readonly parentId: NodeId | null;
  readonly childIds: readonly NodeId[];
  readonly localTransform: Transform;
  readonly visible: boolean;
  readonly locked: boolean;
  readonly selectable: boolean;
  readonly tags: readonly string[];
  readonly metadata: Record<string, unknown>;
  readonly payloadRef?: string;
  readonly meshId?: MeshId;
  readonly materialSlots?: readonly {
    readonly id?: string;
    readonly index?: number;
    readonly name?: string;
    readonly materialId?: MaterialId;
    readonly materialInstanceId?: MaterialInstanceId;
  }[];
  readonly skeletonBinding?: SkeletonBinding;
  readonly primitiveType?: PrimitiveType;
  readonly parameters?: PrimitiveParameters;
  readonly generatedMeshId?: MeshId;
  readonly generatorVersion?: number;
  readonly skeletonId?: SkeletonId;
  readonly display?: "axes" | "cross" | "cube" | "sphere";
  readonly size?: number;
  readonly imageAssetId?: TextureAssetId;
  readonly opacity?: number;
  readonly depthMode?: "behind" | "in-scene" | "in-front";
  readonly projection?: "plane" | "camera-background" | "perspective" | "orthographic";
  readonly lightType?: "directional" | "point" | "spot" | "ambient";
  readonly color?: readonly [number, number, number];
  readonly intensity?: number;
  readonly fov?: number;
  readonly near?: number;
  readonly far?: number;
  readonly extensionType?: string;
}

export type SceneNode = SceneNodeBase;
export type GroupNode = SceneNodeBase & { readonly type: "group" };
export type MeshNode = SceneNodeBase & { readonly type: "mesh" | "mesh_instance" };
export type PrimitiveNode = SceneNodeBase & { readonly type: "primitive" | "primitive_instance" };
export type ArmatureNode = SceneNodeBase & { readonly type: "armature" };
export type LocatorNode = SceneNodeBase & { readonly type: "locator" | "empty" };
export type CameraNode = SceneNodeBase & { readonly type: "camera" };
export type LightNode = SceneNodeBase & { readonly type: "light" };
export type ReferenceImageNode = SceneNodeBase & {
  readonly type: "reference-image" | "reference_image";
};
export type ExtensionNode = SceneNodeBase & { readonly type: "extension" };

export function cloneSceneNode(node: SceneNode): SceneNode {
  return {
    ...node,
    childIds: [...node.childIds],
    tags: [...node.tags],
    metadata: { ...node.metadata },
    localTransform: {
      position: { ...node.localTransform.position },
      rotation: { ...node.localTransform.rotation },
      scale: { ...node.localTransform.scale },
    },
    ...(node.materialSlots ? { materialSlots: node.materialSlots.map((slot) => ({ ...slot })) } : {}),
    ...(node.skeletonBinding ? { skeletonBinding: { ...node.skeletonBinding } } : {}),
    ...(node.parameters ? { parameters: { ...node.parameters } } : {}),
  };
}

export function createSceneNodeBase(
  id: NodeId,
  name: string,
  type: SceneNodeType = "group",
): SceneNode {
  return {
    id,
    name,
    type,
    parentId: null,
    childIds: [],
    visible: true,
    locked: false,
    selectable: true,
    localTransform: identityTransform(),
    tags: [],
    metadata: {},
  };
}

export function isMeshLikeNode(node: SceneNode): boolean {
  return node.type === "mesh" || node.type === "mesh_instance";
}

export function nodeMeshId(node: SceneNode): MeshId | undefined {
  if (node.meshId) {
    return node.meshId;
  }
  if (isMeshLikeNode(node) && node.payloadRef) {
    return node.payloadRef as MeshId;
  }
  if (node.generatedMeshId) {
    return node.generatedMeshId;
  }
  return undefined;
}

export function nodeSkeletonId(node: SceneNode): SkeletonId | undefined {
  if (node.skeletonId) {
    return node.skeletonId;
  }
  if (node.skeletonBinding) {
    return node.skeletonBinding.skeletonId;
  }
  if (node.type === "armature" && node.payloadRef) {
    return node.payloadRef as SkeletonId;
  }
  return undefined;
}
