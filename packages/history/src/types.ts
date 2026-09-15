import type { Emitter, EditorEvents, IdFactory, MeshId, TextureId } from "@modeling-kit/core";
import type { ModelDocument } from "@modeling-kit/document";
import type { HalfEdgeMesh } from "@modeling-kit/mesh";
import type { SelectionManager } from "@modeling-kit/selection";

export interface PixelBuffer {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
}

export interface CommandContext {
  readonly document: ModelDocument;
  readonly ids: IdFactory;
  readonly selection: SelectionManager;
  readonly meshes: Map<MeshId, HalfEdgeMesh>;
  readonly textures: Map<TextureId, PixelBuffer>;
  readonly events: Emitter<EditorEvents>;
  syncMesh(meshId: MeshId): void;
}

export interface Command<TResult = unknown> {
  readonly id: string;
  readonly label: string;
  execute(context: CommandContext): TResult;
  undo(context: CommandContext): void;
  redo?(context: CommandContext): TResult;
  mergeWith?(next: Command): Command | null;
}

export interface CommandRecord {
  readonly id: string;
  readonly label: string;
}

export interface SerializedCommand {
  readonly type: string;
  readonly payload: unknown;
}
