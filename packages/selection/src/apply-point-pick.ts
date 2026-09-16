import type { SelectionManager } from "./manager";
import type { PointPickApplyMode } from "./picking/pick-policy";
import { pickSelectionTarget, type PointPickResult } from "./picking/pick-result";

/**
 * Applies a picker candidate to the selection manager.
 * Keyboard modifiers belong in the host; this function never inspects them.
 *
 * Empty replace clears. Empty add/toggle/subtract leave the selection unchanged.
 */
export function applyPointPickToSelection(
  selection: SelectionManager,
  result: PointPickResult | undefined,
  mode: PointPickApplyMode = "replace",
): void {
  if (!result) {
    if (mode === "replace") {
      selection.clear();
    }
    return;
  }

  const target = pickSelectionTarget(result);
  const domain = target.domain === "object" ? "object" : target.domain;

  if (mode === "replace" || selection.domain !== domain) {
    if (mode === "subtract" && selection.domain !== domain) {
      return;
    }
    if (domain === "object") {
      selection.replace({
        domain: "object",
        objectIds: [result.objectId],
        elementIds: [],
      });
      return;
    }
    selection.replace({
      domain,
      objectId: result.objectId,
      elementIds: [target.elementId],
    });
    return;
  }

  if (mode === "add") {
    selection.add([target.elementId]);
    if (domain !== "object" && !selection.objectIds.includes(result.objectId)) {
      selection.objectIds = [...selection.objectIds, result.objectId];
    }
    return;
  }
  if (mode === "toggle") {
    selection.toggle(target.elementId);
    return;
  }
  selection.remove([target.elementId]);
}
