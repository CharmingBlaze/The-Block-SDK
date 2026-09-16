import type { FaceId, MeshId } from "@modeling-kit/core";
import type { AutomaticUvUnwrapOptions, AutomaticUvUnwrapResult, UnwrapExecutionOptions } from "@modeling-kit/uv";
import { AutomaticUnwrapCommand } from "./automatic-unwrap";
import type { ModelingSession } from "./session";

export interface SessionAutomaticUnwrapParams {
  readonly meshId: MeshId;
  readonly faceIds?: readonly FaceId[];
  readonly uvChannel?: string;
  readonly options?: AutomaticUvUnwrapOptions;
}

export async function unwrapSessionMesh(
  session: ModelingSession,
  params: SessionAutomaticUnwrapParams,
  execution: UnwrapExecutionOptions = {},
): Promise<AutomaticUvUnwrapResult> {
  const mesh = session.meshes.get(params.meshId);
  if (!mesh) {
    throw new RangeError(`automaticUnwrap: missing mesh ${params.meshId}`);
  }
  const command = await AutomaticUnwrapCommand.prepare(
    mesh,
    {
      meshId: params.meshId,
      uvChannel: params.uvChannel ?? "uv0",
      ...(params.faceIds ? { faceIds: params.faceIds } : {}),
      ...(params.options ? { options: params.options } : {}),
    },
    execution,
  );
  return session.execute(command);
}
