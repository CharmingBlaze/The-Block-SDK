import type { Accessor, Document as GltfDocument, Primitive } from "@gltf-transform/core";

type PrimitiveMode = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export function writeTrianglePrimitive(
  target: GltfDocument,
  indices: Accessor,
  attributes: Record<string, Accessor>,
  mode: number,
): Primitive {
  const primitive = target.createPrimitive().setMode(mode as PrimitiveMode).setIndices(indices);
  primitive.setAttribute("POSITION", attributes.POSITION!);
  primitive.setAttribute("NORMAL", attributes.NORMAL!);
  primitive.setAttribute("TEXCOORD_0", attributes.TEXCOORD_0!);
  if (attributes.JOINTS_0) {
    primitive.setAttribute("JOINTS_0", attributes.JOINTS_0);
    primitive.setAttribute("WEIGHTS_0", attributes.WEIGHTS_0!);
  }
  return primitive;
}
