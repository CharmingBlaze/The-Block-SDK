import type { FaceId, MeshId } from "@modeling-kit/core";
import type { AutomaticUvUnwrapOptions, AutomaticUvUnwrapResult } from "@modeling-kit/uv";
import { DEFAULT_UV_CHANNEL } from "@modeling-kit/uv";
import type { ModelingSession } from "./session";

export async function unwrapFluentSelection(
  session: ModelingSession,
  meshId: MeshId,
  options: AutomaticUvUnwrapOptions = {},
): Promise<AutomaticUvUnwrapResult> {
  const faceIds =
    session.selection.domain === "face" && session.selection.elementIds.length > 0
      ? (session.selection.elementIds as FaceId[])
      : undefined;
  return session.automaticUnwrap({
    meshId,
    uvChannel: DEFAULT_UV_CHANNEL,
    ...(faceIds ? { faceIds } : {}),
    ...(Object.keys(options).length > 0 ? { options } : {}),
  });
}
