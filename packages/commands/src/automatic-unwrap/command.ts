import type { Command, CommandContext } from "@modeling-kit/history";
import type { HalfEdgeMesh } from "@modeling-kit/mesh";
import {
  applyAutomaticUnwrapResult,
  prepareAutomaticUnwrap,
  type AutomaticUvUnwrapResult,
  type UnwrapExecutionOptions,
} from "@modeling-kit/uv";
import type { AutomaticUnwrapCommandParams, UvChannelEditPatch } from "./params";
import { applyUvChannelEdit, channelIdFromName } from "./apply";
import { snapshotUvChannelEdit } from "./snapshot";

export class AutomaticUnwrapCommand implements Command<AutomaticUvUnwrapResult> {
  readonly id = crypto.randomUUID();
  readonly label = "Automatic chart unwrap";
  private before: UvChannelEditPatch | null = null;
  private after: UvChannelEditPatch | null = null;
  private result: AutomaticUvUnwrapResult | null;

  constructor(
    readonly params: AutomaticUnwrapCommandParams,
    prepared?: AutomaticUvUnwrapResult,
  ) {
    this.result = prepared ?? null;
  }

  static async prepare(
    mesh: HalfEdgeMesh,
    params: AutomaticUnwrapCommandParams,
    execution: UnwrapExecutionOptions = {},
  ): Promise<AutomaticUnwrapCommand> {
    const result = await prepareAutomaticUnwrap(
      {
        mesh,
        ...(params.faceIds ? { faceIds: params.faceIds } : {}),
        uvChannel: params.uvChannel,
        ...(params.options ? { options: params.options } : {}),
      },
      { ...execution, apply: false },
    );
    return new AutomaticUnwrapCommand(params, result);
  }

  execute(context: CommandContext): AutomaticUvUnwrapResult {
    const mesh = context.meshes.get(this.params.meshId);
    if (!mesh) {
      throw new RangeError(`AutomaticUnwrapCommand: missing mesh ${this.params.meshId}`);
    }
    const channelId = channelIdFromName(this.params.uvChannel);
    if (this.after && this.result) {
      applyUvChannelEdit(mesh, channelId, this.after);
      this.sync(context);
      return this.result;
    }
    if (!this.result) {
      throw new RangeError("AutomaticUnwrapCommand.execute requires AutomaticUnwrapCommand.prepare");
    }
    this.before = snapshotUvChannelEdit(mesh, this.result.targetedFaceIds, channelId);
    try {
      applyAutomaticUnwrapResult(mesh, this.result);
    } catch (error) {
      applyUvChannelEdit(mesh, channelId, this.before);
      this.before = null;
      throw error;
    }
    this.after = snapshotUvChannelEdit(mesh, this.result.targetedFaceIds, channelId);
    this.sync(context);
    return this.result;
  }

  undo(context: CommandContext): void {
    if (!this.before) {
      return;
    }
    const mesh = context.meshes.get(this.params.meshId);
    if (!mesh) {
      return;
    }
    applyUvChannelEdit(mesh, channelIdFromName(this.params.uvChannel), this.before);
    this.sync(context);
  }

  redo(context: CommandContext): AutomaticUvUnwrapResult {
    return this.execute(context);
  }

  private sync(context: CommandContext): void {
    context.syncMesh(this.params.meshId);
    context.events.emit("mesh:changed", { meshIds: [this.params.meshId] });
  }
}
