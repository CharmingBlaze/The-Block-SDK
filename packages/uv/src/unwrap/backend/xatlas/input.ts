import { UvUnwrapError } from "../../errors";
import type { UvUnwrapBackendInput, UvUnwrapBackendOptions } from "../../types";
import type { WatlasAtlas } from "./load";

export function assertXAtlasInput(input: UvUnwrapBackendInput): void {
  if (input.positions.length === 0 || input.indices.length === 0) {
    throw new UvUnwrapError("empty-mesh", "xatlas input has no positions or indices");
  }
  if (input.positions.length % 3 !== 0) {
    throw new UvUnwrapError("invalid-indices", "xatlas position buffer length must be a multiple of 3");
  }
  if (input.indices.length % 3 !== 0) {
    throw new UvUnwrapError("invalid-indices", "xatlas index buffer length must be a multiple of 3");
  }
  const vertexCount = input.positions.length / 3;
  for (let i = 0; i < input.indices.length; i += 1) {
    const index = input.indices[i]!;
    if (!Number.isInteger(index) || index < 0 || index >= vertexCount) {
      throw new UvUnwrapError("invalid-indices", `xatlas index ${index} is outside 0..${vertexCount - 1}`);
    }
  }
  for (let i = 0; i < input.positions.length; i += 1) {
    if (!Number.isFinite(input.positions[i])) {
      throw new UvUnwrapError("non-finite-position", "xatlas input contains a non-finite position");
    }
  }
}

export function addPositionMesh(
  atlas: WatlasAtlas,
  input: UvUnwrapBackendInput,
  options: UvUnwrapBackendOptions,
): void {
  const decl: import("watlas").MeshDecl = {
    vertexPositionData: input.positions,
    vertexCount: input.positions.length / 3,
    vertexPositionStride: 12,
    indexData: input.indices,
    indexCount: input.indices.length,
  };
  if (options.useInputMeshUvs === true && input.inputUvs) {
    decl.vertexUvData = input.inputUvs;
    decl.vertexUvStride = 8;
  }
  atlas.addMesh(decl);
}

export function addUvMesh(atlas: WatlasAtlas, input: UvUnwrapBackendInput): void {
  if (!input.inputUvs) {
    throw new UvUnwrapError("invalid-indices", "packUvMesh requires inputUvs");
  }
  atlas.addUvMesh({
    vertexUvData: input.inputUvs,
    vertexCount: input.inputUvs.length / 2,
    vertexStride: 8,
    indexData: input.indices,
    indexCount: input.indices.length,
  });
}
