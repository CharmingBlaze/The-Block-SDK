import { brand, type MeshId, type UVChannelId } from "@modeling-kit/core";
import type { Command, CommandContext } from "@modeling-kit/history";
import { setCornerUvs } from "@modeling-kit/uv";

export interface CornerUvSnapshot {
  readonly cornerId: string;
  readonly uv: readonly [number, number];
}

export interface SetCornerUvsParams {
  readonly meshId: MeshId;
  readonly channelId: UVChannelId;
  readonly before: readonly CornerUvSnapshot[];
  readonly after: readonly CornerUvSnapshot[];
}

export class SetCornerUvsCommand implements Command<void> {
  readonly id = crypto.randomUUID();
  readonly label = "Transform UVs";

  constructor(readonly params: SetCornerUvsParams) {}

  execute(context: CommandContext): void {
    this.apply(context, this.params.after);
  }

  undo(context: CommandContext): void {
    this.apply(context, this.params.before);
  }

  redo(context: CommandContext): void {
    this.execute(context);
  }

  private apply(context: CommandContext, snapshots: readonly CornerUvSnapshot[]): void {
    const mesh = context.meshes.get(this.params.meshId);
    if (!mesh) {
      return;
    }
    setCornerUvs(
      mesh,
      snapshots.map((item) => ({
        cornerId: brand(item.cornerId),
        uv: [item.uv[0], item.uv[1]] as const,
      })),
      this.params.channelId,
    );
    context.syncMesh(mesh.id);
    context.events.emit("mesh:changed", { meshIds: [mesh.id] });
  }
}
