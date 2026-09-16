import type { PointPickRequest } from "./pick-request";
import type { PointPickResult } from "./pick-result";
import type { ResolvedPickBackend } from "./pick-policy";

export interface ToolPickResponse {
  readonly consumed: boolean;
  readonly beginDrag?: boolean;
}

export type PickSessionStatus = "active" | "consumed" | "dragging" | "cancelled" | "committed";

export interface PickSession {
  readonly pointerId: number;
  readonly startedAt: number;
  readonly startClientX: number;
  readonly startClientY: number;
  readonly request: PointPickRequest;
  readonly result: PointPickResult | undefined;
  readonly backend: ResolvedPickBackend | "unavailable";
  readonly sceneRevision: number;
  readonly cameraRevision: number;
  status: PickSessionStatus;
  consumed: boolean;
}

export type PickSessionInvalidation = "reuse" | "rerun" | "cancel";

/**
 * Geometry/visibility changes cancel the click. Camera or viewport changes
 * rerun the same backend policy at pointer-up. Unchanged sessions reuse the
 * pointer-down result.
 */
export function classifyPickSession(
  session: PickSession,
  sceneRevision: number,
  cameraRevision: number,
): PickSessionInvalidation {
  if (session.status === "cancelled" || session.status === "committed") {
    return "cancel";
  }
  if (session.sceneRevision !== sceneRevision) {
    return "cancel";
  }
  if (session.cameraRevision !== cameraRevision) {
    return "rerun";
  }
  return "reuse";
}

export function createPickSession(input: {
  readonly pointerId: number;
  readonly clientX: number;
  readonly clientY: number;
  readonly request: PointPickRequest;
  readonly result: PointPickResult | undefined;
  readonly backend: ResolvedPickBackend | "unavailable";
  readonly sceneRevision: number;
  readonly cameraRevision: number;
  readonly now?: number;
}): PickSession {
  return {
    pointerId: input.pointerId,
    startedAt: input.now ?? Date.now(),
    startClientX: input.clientX,
    startClientY: input.clientY,
    request: input.request,
    result: input.result,
    backend: input.backend,
    sceneRevision: input.sceneRevision,
    cameraRevision: input.cameraRevision,
    status: "active",
    consumed: false,
  };
}

export class PointerPickSessionStore {
  private readonly sessions = new Map<number, PickSession>();

  begin(session: PickSession): PickSession {
    this.sessions.set(session.pointerId, session);
    return session;
  }

  get(pointerId: number): PickSession | undefined {
    return this.sessions.get(pointerId);
  }

  applyToolResponse(pointerId: number, response: ToolPickResponse): void {
    const session = this.sessions.get(pointerId);
    if (!session) {
      return;
    }
    session.consumed = response.consumed;
    if (response.beginDrag) {
      session.status = "dragging";
      return;
    }
    if (response.consumed) {
      session.status = "consumed";
    }
  }

  commit(pointerId: number): PickSession | undefined {
    const session = this.sessions.get(pointerId);
    if (session) {
      session.status = "committed";
      this.sessions.delete(pointerId);
    }
    return session;
  }

  cancel(pointerId: number): void {
    const session = this.sessions.get(pointerId);
    if (session) {
      session.status = "cancelled";
    }
    this.sessions.delete(pointerId);
  }

  clear(): void {
    this.sessions.clear();
  }
}
