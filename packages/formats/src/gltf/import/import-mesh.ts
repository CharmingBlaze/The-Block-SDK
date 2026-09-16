import type { Mesh as GltfMesh } from "@gltf-transform/core";
import { serializeMesh, MeshBuilder, type HalfEdgeMesh } from "@modeling-kit/mesh";
import type { MaterialId, MeshId } from "@modeling-kit/core";
import { importPrimitive, type PrimitiveSkinWeights } from "./import-primitive";
import { importMaterial } from "./import-material";
import type { GltfImportContext } from "./import-context";

export interface ImportedMesh {
  readonly meshId: MeshId;
  readonly mesh: HalfEdgeMesh;
  readonly skinWeights: PrimitiveSkinWeights;
}

export function importMesh(context: GltfImportContext, gltfMesh: GltfMesh): ImportedMesh | undefined {
  const existing = context.meshByGltf.get(gltfMesh);
  if (existing) {
    const mesh = context.meshes.get(existing);
    return mesh ? { meshId: existing, mesh, skinWeights: { weights: new Map() } } : undefined;
  }
  const builder = new MeshBuilder(context.ids.mesh());
  const vertexKey = new Map<string, ReturnType<MeshBuilder["addVertex"]>>();
  const skinWeights: PrimitiveSkinWeights = { weights: new Map() };
  let faces = 0;
  const materialIds: MaterialId[] = [];
  for (const primitive of gltfMesh.listPrimitives()) {
    faces += importPrimitive(context, primitive, builder, vertexKey, skinWeights);
    const material = primitive.getMaterial();
    if (material && context.options.importMaterials) {
      const imported = importMaterial(context, material);
      if (imported && !materialIds.includes(imported.id)) {
        materialIds.push(imported.id);
      }
    }
  }
  if (faces === 0) {
    return undefined;
  }
  const mesh = builder.getMesh();
  const meshId = mesh.id;
  context.meshes.set(meshId, mesh);
  context.meshByGltf.set(gltfMesh, meshId);
  context.meshSkinWeights.set(meshId, skinWeights);
  context.document.meshes.set({
    id: meshId,
    name: gltfMesh.getName() || `Mesh ${context.meshes.size}`,
    kernel: serializeMesh(mesh),
    materialIds,
    metadata: {},
  });
  return { meshId, mesh, skinWeights };
}
