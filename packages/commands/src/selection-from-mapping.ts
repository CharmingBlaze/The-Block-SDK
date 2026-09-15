import type { ObjectId } from "@modeling-kit/core";
import type { CommandContext } from "@modeling-kit/history";
import type { MeshOperationResult, SelectionSuggestion, TopologyMapping } from "@modeling-kit/mesh";
import type { SelectionManager, SelectionSnapshot } from "@modeling-kit/selection";

type MappingKind = "vertices" | "edges" | "faces" | "corners";

function mappingToRemap(mapping: TopologyMapping): {
  map: Map<string, string>;
  deleted: Set<string>;
} {
  const map = new Map<string, string>();
  const deleted = new Set<string>();
  const kinds: MappingKind[] = ["vertices", "edges", "faces", "corners"];
  for (const kind of kinds) {
    for (const id of mapping[kind].deleted) {
      deleted.add(id);
    }
    for (const [oldId, newIds] of mapping[kind].replacedBy) {
      const first = newIds[0];
      if (first) {
        map.set(oldId, first);
      }
    }
  }
  return { map, deleted };
}

export function applyTopologySelection(
  selection: SelectionManager,
  objectId: ObjectId,
  mapping: TopologyMapping,
  suggestion: SelectionSuggestion,
): void {
  const { map, deleted } = mappingToRemap(mapping);
  selection.applyRemap({ map, deleted });
  if (suggestion.elementIds.length === 0) {
    return;
  }
  const live = suggestion.elementIds.filter((id) => !deleted.has(id));
  selection.replace({
    domain: suggestion.domain,
    objectId,
    elementIds: live,
  });
}

export function applyOperationSelection(
  context: CommandContext,
  objectId: ObjectId,
  result: MeshOperationResult,
): void {
  applyTopologySelection(context.selection, objectId, result.mapping, result.selection);
  context.events.emit("selection:changed", {
    domain: context.selection.domain,
    ids: context.selection.elementIds,
  });
  context.events.emit("mesh:changed", { meshIds: [result.mesh.id], kind: "topology" });
  context.events.emit("document:changed", {
    aspect: "mesh",
    kind: "topology",
    entityIds: [result.mesh.id],
  });
}

export function restoreSelection(context: CommandContext, snapshot: SelectionSnapshot | null): void {
  if (!snapshot) {
    return;
  }
  context.selection.restore(snapshot);
  context.events.emit("selection:changed", {
    domain: snapshot.domain,
    ids: snapshot.elementIds,
  });
}
