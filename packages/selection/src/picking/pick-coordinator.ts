import { classifyPickSession, type PickSession } from "./pick-session";
import type { PointPickRequest } from "./pick-request";
import type { PointPickResult } from "./pick-result";
import type { ResolvedPickBackend } from "./pick-policy";

export interface PickResolver {
  resolve(request: PointPickRequest): Promise<PointPickResult | undefined>;
  backendFor(request: PointPickRequest): ResolvedPickBackend | "unavailable";
}

export interface ClickResolution {
  readonly result: PointPickResult | undefined;
  readonly reused: boolean;
  readonly cancelled: boolean;
}

/**
 * Pointer-up uses the stored click candidate unless the session is invalid.
 * Camera-only changes rerun the same request; scene changes cancel selection.
 */
export async function resolveClickFromSession(
  session: PickSession,
  sceneRevision: number,
  cameraRevision: number,
  resolver: PickResolver,
): Promise<ClickResolution> {
  const action = classifyPickSession(session, sceneRevision, cameraRevision);
  if (action === "cancel") {
    return { result: undefined, reused: false, cancelled: true };
  }
  if (action === "reuse") {
    return { result: session.result, reused: true, cancelled: false };
  }
  const backend = resolver.backendFor(session.request);
  if (session.backend !== "unavailable" && backend !== session.backend) {
    return { result: undefined, reused: false, cancelled: true };
  }
  const result = await resolver.resolve(session.request);
  return { result, reused: false, cancelled: false };
}
