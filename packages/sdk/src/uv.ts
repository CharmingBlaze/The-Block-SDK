import { brand, type FaceId, type MeshId, type ObjectId, type UVChannelId } from "@modeling-kit/core";
import { SetCornerUvsCommand, type ModelingSession } from "@modeling-kit/commands";
import { createUvEditor, type CreateUvEditorOptions, type UVEditor } from "@modeling-kit/uv";

export interface CreateSessionUvEditorOptions extends Omit<CreateUvEditorOptions, "mesh" | "onCommit"> {
  readonly session: ModelingSession;
  readonly meshId: MeshId;
  readonly objectId?: ObjectId;
  readonly channelId?: UVChannelId;
}

export function createSessionUvEditor(options: CreateSessionUvEditorOptions): UVEditor {
  const mesh = options.session.meshes.get(options.meshId);
  if (!mesh) {
    throw new RangeError(`createUvEditor: missing mesh ${options.meshId}`);
  }
  const objectId =
    options.objectId ??
    ([...options.session.document.scene.nodes.values()].find((node) => node.payloadRef === options.meshId)
      ?.id as ObjectId | undefined);
  const sync = options.syncSelection !== false;
  const editor = createUvEditor({
    ...options,
    mesh,
    meshId: options.meshId,
    syncSelection: sync,
    onCommit: (patch) => {
      if (patch.before.length === 0) {
        return;
      }
      options.session.execute(
        new SetCornerUvsCommand({
          meshId: patch.meshId,
          channelId: patch.channelId,
          before: patch.before,
          after: patch.after,
        }),
      );
    },
    onFacesSelected: (faceIds, activeFaceId) => {
      if (!sync || !objectId) {
        return;
      }
      options.session.selection.replace({
        domain: "face",
        objectId,
        elementIds: faceIds,
        activeId: activeFaceId,
      });
    },
  });
  if (sync) {
    editor.addDisposable(
      options.session.selection.onChange((snapshot) => {
        if (editor.disposed || snapshot.domain !== "face") {
          return;
        }
        editor.selectFrom3DFaces(snapshot.elementIds as FaceId[]);
      }),
    );
  }
  editor.addDisposable(
    options.session.events.on("mesh:changed", (change) => {
      if (editor.disposed || editor.transform.active) {
        return;
      }
      if (change.meshIds.length > 0 && !change.meshIds.includes(options.meshId)) {
        return;
      }
      const next = options.session.meshes.get(options.meshId);
      if (!next) {
        return;
      }
      editor.setMesh(next);
    }),
  );
  return editor;
}

export const uv = {
  createEditor: createSessionUvEditor,
};

export { brand };
