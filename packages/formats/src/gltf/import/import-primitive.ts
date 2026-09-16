import type { Primitive as GltfPrimitive } from "@gltf-transform/core";
import type { VertexId } from "@modeling-kit/core";
import { SchemaError } from "@modeling-kit/core";
import { MeshBuilder } from "@modeling-kit/mesh";
import { accessorToNumbers } from "../conversion/accessors";
import { quantizeTuple, weldKey } from "../conversion/attributes";
import { isTriangleMode, primitiveModeName } from "../conversion/topology";
import { isStrict, type GltfImportContext } from "./import-context";
import { importMaterial } from "./import-material";
import type { PrimitiveSkinWeights, VertexJointInfluence } from "./primitive-skin-weights";

export type { PrimitiveSkinWeights, VertexJointInfluence } from "./primitive-skin-weights";

export function importPrimitive(
  context: GltfImportContext,
  primitive: GltfPrimitive,
  builder: MeshBuilder,
  vertexKey: Map<string, VertexId>,
  skinWeights: PrimitiveSkinWeights,
): number {
  const mode = primitive.getMode();
  if (!isTriangleMode(mode)) {
    context.sink.loss("unsupported-primitive-mode", `Skipped primitive with unsupported mode ${primitiveModeName(mode)}`, {
      suggestedCorrection: "Triangulate the primitive before export",
    });
    return 0;
  }
  const positionAccessor = primitive.getAttribute("POSITION");
  if (!positionAccessor) {
    context.sink.warn("missing-position", "Skipped primitive without POSITION");
    return 0;
  }
  const positions = accessorToNumbers(positionAccessor);
  const uvs = accessorToNumbers(primitive.getAttribute("TEXCOORD_0"));
  const uv1 = accessorToNumbers(primitive.getAttribute("TEXCOORD_1"));
  const normals = accessorToNumbers(primitive.getAttribute("NORMAL"));
  const colors = accessorToNumbers(primitive.getAttribute("COLOR_0"));
  const joints = accessorToNumbers(primitive.getAttribute("JOINTS_0"));
  const weights = accessorToNumbers(primitive.getAttribute("WEIGHTS_0"));
  if (primitive.getAttribute("JOINTS_1") || primitive.getAttribute("WEIGHTS_1")) {
    context.sink.loss("skin-influence-truncated", "Additional joint sets JOINTS_1/WEIGHTS_1 are not imported", {
      suggestedCorrection: "Keep at most four influences per vertex",
    });
  }
  const indexAccessor = primitive.getIndices();
  const indices = indexAccessor
    ? accessorToNumbers(indexAccessor)
    : Array.from({ length: positions.length / 3 }, (_, i) => i);
  const material = primitive.getMaterial();
  const importedMaterial = material && context.options.importMaterials ? importMaterial(context, material) : undefined;
  const slot = importedMaterial
    ? Math.max(0, [...context.document.materials.values()].findIndex((item) => item.id === importedMaterial.id))
    : 0;
  let faces = 0;
  const epsilon = context.options.weldEpsilon;
  const weldMode = joints.length > 0 ? "attributes" : context.options.weldMode;

  for (let i = 0; i + 2 < indices.length; i += 3) {
    const cornerIds: VertexId[] = [];
    const cornerUvs: [number, number][] = [];
    const cornerNormals: [number, number, number][] = [];
    const cornerColors: [number, number, number, number][] = [];
    let valid = true;
    for (let k = 0; k < 3; k++) {
      const vertexIndex = Math.round(indices[i + k]!);
      const px = positions[vertexIndex * 3];
      const py = positions[vertexIndex * 3 + 1];
      const pz = positions[vertexIndex * 3 + 2];
      if (px === undefined || py === undefined || pz === undefined) {
        if (isStrict(context)) {
          throw new SchemaError(`glTF index ${vertexIndex} is outside the POSITION accessor`);
        }
        valid = false;
        break;
      }
      if (![px, py, pz].every(Number.isFinite)) {
        if (isStrict(context)) {
          throw new SchemaError("glTF POSITION accessor contains non-finite coordinates");
        }
        valid = false;
        break;
      }
      const uv: [number, number] | undefined =
        uvs.length >= (vertexIndex + 1) * 2 ? [uvs[vertexIndex * 2]!, uvs[vertexIndex * 2 + 1]!] : undefined;
      const normal: [number, number, number] | undefined =
        normals.length >= (vertexIndex + 1) * 3
          ? [normals[vertexIndex * 3]!, normals[vertexIndex * 3 + 1]!, normals[vertexIndex * 3 + 2]!]
          : undefined;
      const color: [number, number, number, number] | undefined =
        colors.length >= (vertexIndex + 1) * 4
          ? [
              colors[vertexIndex * 4]!,
              colors[vertexIndex * 4 + 1]!,
              colors[vertexIndex * 4 + 2]!,
              colors[vertexIndex * 4 + 3]!,
            ]
          : undefined;
      const extra = [
        quantizeTuple(uv, epsilon),
        quantizeTuple(normal, epsilon),
        quantizeTuple(color, epsilon),
        quantizeTuple(uv1.length >= (vertexIndex + 1) * 2 ? [uv1[vertexIndex * 2]!, uv1[vertexIndex * 2 + 1]!] : undefined, epsilon),
        joints.length >= (vertexIndex + 1) * 4
          ? joints.slice(vertexIndex * 4, vertexIndex * 4 + 4).join(":")
          : "-",
      ].join("|");
      const key = weldKey(weldMode, epsilon, px, py, pz, extra);
      let vertexId = key ? vertexKey.get(key) : undefined;
      if (!vertexId) {
        vertexId = builder.addVertex(px, py, pz, context.ids.vertex());
        if (key) {
          vertexKey.set(key, vertexId);
        }
      }
      if (joints.length >= (vertexIndex + 1) * 4) {
        const raw: VertexJointInfluence[] = [];
        for (let j = 0; j < 4; j += 1) {
          raw.push({
            jointIndex: Math.round(joints[vertexIndex * 4 + j] ?? 0),
            weight: weights[vertexIndex * 4 + j] ?? 0,
          });
        }
        skinWeights.weights.set(vertexId, raw);
      }
      cornerIds.push(vertexId);
      if (uv) {
        cornerUvs.push(uv);
      }
      if (normal) {
        cornerNormals.push(normal);
      }
      if (color) {
        cornerColors.push(color);
      }
    }
    if (!valid || new Set(cornerIds).size < 3) {
      continue;
    }
    builder.addFace(cornerIds, {
      id: context.ids.face(),
      materialSlot: slot,
      ...(cornerUvs.length === 3 ? { uvs: cornerUvs } : {}),
      ...(cornerNormals.length === 3 ? { normals: cornerNormals } : {}),
      ...(cornerColors.length === 3 ? { colors: cornerColors } : {}),
    });
    faces += 1;
  }
  return faces;
}
