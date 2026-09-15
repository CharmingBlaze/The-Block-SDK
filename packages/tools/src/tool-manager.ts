import { brand, type ToolId } from "@modeling-kit/core";
import type { ActionContext, GestureFrame } from "@modeling-kit/input";
import { InteractionCoordinator } from "./interaction-coordinator";
import type { ActionResult, EditorTool, InteractionClaim, ToolContext } from "./tool";

export class ToolManager {
  readonly coordinator = new InteractionCoordinator();
  private readonly tools = new Map<string, EditorTool>();
  private active: EditorTool | null = null;
  private disposed = false;

  get activeTool(): EditorTool | null {
    return this.active;
  }

  register(tool: EditorTool): void {
    this.assertOpen();
    this.tools.set(tool.id, tool);
  }

  activate(id: ToolId | string, context?: ToolContext): void {
    this.assertOpen();
    const tool = this.tools.get(id);
    if (!tool) {
      throw new RangeError(`Unknown tool ${id}`);
    }
    const ctx = context ?? { toolId: brand<string, "ToolId">(tool.id) };
    this.abortActive(ctx);
    this.active = tool;
    tool.activate(ctx);
  }

  dispatchAction(action: ActionContext, context?: ToolContext): ActionResult {
    if (!this.active?.action) {
      return { consumed: false };
    }
    const ctx = context ?? { toolId: this.active.id };
    return this.active.action(action, ctx);
  }

  beginGesture(gesture: GestureFrame, context?: ToolContext): InteractionClaim | null {
    if (!this.active?.gestureBegin) {
      return null;
    }
    const ctx = context ?? { toolId: this.active.id };
    const claim = this.active.gestureBegin(gesture, ctx);
    if (claim && !this.coordinator.claim(claim)) {
      return null;
    }
    return claim;
  }

  updateGesture(gesture: GestureFrame, context?: ToolContext): void {
    const ctx = this.toolContext(context);
    this.active?.gestureUpdate?.(gesture, ctx);
  }

  commitGesture(gesture: GestureFrame, context?: ToolContext): void {
    const ctx = this.toolContext(context);
    this.active?.gestureCommit?.(gesture, ctx);
    this.coordinator.release(this.active?.id ?? "");
  }

  cancelGesture(gesture: GestureFrame, context?: ToolContext): void {
    const ctx = this.toolContext(context);
    this.active?.gestureCancel?.(gesture, ctx);
    this.coordinator.release(this.active?.id ?? "");
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.abortActive({ toolId: this.active?.id ?? brand("none") });
    for (const tool of this.tools.values()) {
      tool.dispose?.();
    }
    this.tools.clear();
    this.active = null;
    this.coordinator.dispose();
  }

  private abortActive(ctx: ToolContext): void {
    const current = this.active;
    if (!current) {
      this.coordinator.dispose();
      return;
    }
    current.abort?.();
    current.deactivate(ctx);
    this.coordinator.release(current.id);
    this.coordinator.dispose();
  }

  private toolContext(context?: ToolContext): ToolContext {
    return context ?? (this.active ? { toolId: this.active.id } : { toolId: brand("none") });
  }

  private assertOpen(): void {
    if (this.disposed) {
      throw new RangeError("ToolManager is disposed");
    }
  }
}
