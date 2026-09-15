import type { SelectionDomain } from "@modeling-kit/selection";

export type CapabilityId =
  | "edit.undo"
  | "edit.redo"
  | "mesh.extrude"
  | "mesh.inset"
  | "mesh.bevel"
  | "mesh.loopCut"
  | "transform.begin"
  | "paint.begin";

export interface CapabilityDenial {
  readonly code: string;
  readonly message: string;
}

export interface CapabilityResult {
  readonly ok: boolean;
  readonly reason?: CapabilityDenial;
}

export type CapabilityDecision = CapabilityResult;

export interface CapabilityContext {
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly selectionDomain: SelectionDomain | string;
  readonly selectedCount: number;
  readonly objectCount: number;
  readonly hasMesh: boolean;
  readonly isTransforming?: boolean;
}

function deny(code: string, message: string): CapabilityResult {
  return { ok: false, reason: { code, message } };
}

const ok: CapabilityResult = { ok: true };

export function canExecute(id: CapabilityId | string, ctx: CapabilityContext): CapabilityDecision {
  switch (id) {
    case "edit.undo":
      return ctx.canUndo ? ok : deny("NO_UNDO", "Nothing to undo");
    case "edit.redo":
      return ctx.canRedo ? ok : deny("NO_REDO", "Nothing to redo");
    case "mesh.extrude":
    case "mesh.inset":
      if (!ctx.hasMesh || ctx.objectCount === 0) {
        return deny("NO_OBJECT", "Select a mesh object");
      }
      if (ctx.selectionDomain !== "face" || ctx.selectedCount === 0) {
        return deny("NEED_FACES", "Select one or more faces");
      }
      return ok;
    case "mesh.bevel":
    case "mesh.loopCut":
      if (!ctx.hasMesh || ctx.objectCount === 0) {
        return deny("NO_OBJECT", "Select a mesh object");
      }
      if (ctx.selectionDomain !== "edge" || ctx.selectedCount === 0) {
        return deny("NEED_EDGES", "Select one or more edges");
      }
      return ok;
    case "transform.begin":
      if (ctx.selectedCount === 0 && ctx.objectCount === 0) {
        return deny("NO_SELECTION", "Select objects or elements to transform");
      }
      if (ctx.isTransforming) {
        return deny("TRANSFORM_ACTIVE", "A transform gesture is already active");
      }
      return ok;
    case "paint.begin":
      return deny("NO_TEXTURE", "Begin a paint stroke from a texture id");
    default:
      return deny("UNKNOWN", `Unknown capability '${id}'`);
  }
}

export class SessionCapabilities {
  constructor(private readonly getContext: () => CapabilityContext) {}

  canExecute(id: CapabilityId | string): CapabilityResult {
    return canExecute(id, this.getContext());
  }
}
