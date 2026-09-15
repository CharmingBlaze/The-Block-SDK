import type { ToolId } from "@modeling-kit/core";
import type { ActionContext, GestureFrame } from "@modeling-kit/input";

export interface InteractionClaim {
  readonly owner: string;
  readonly pointerIds: readonly number[];
  readonly priority: number;
  readonly capturePointer: boolean;
  readonly preventDefault: boolean;
  readonly cursor?: string;
}

export interface ToolContext {
  readonly toolId: ToolId;
}

export type ActionResult = { readonly consumed: boolean };

export interface EditorTool {
  readonly id: ToolId;
  readonly label: string;
  activate(context: ToolContext): void;
  deactivate(context: ToolContext): void;
  /** Drop preview state and pointer claims without committing. */
  abort?(): void;
  dispose?(): void;
  action?(action: ActionContext, context: ToolContext): ActionResult;
  gestureBegin?(gesture: GestureFrame, context: ToolContext): InteractionClaim | null;
  gestureUpdate?(gesture: GestureFrame, context: ToolContext): void;
  gestureCommit?(gesture: GestureFrame, context: ToolContext): void;
  gestureCancel?(gesture: GestureFrame, context: ToolContext): void;
}
