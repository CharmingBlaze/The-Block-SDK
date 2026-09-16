import type { CornerId } from "@modeling-kit/core";
import type { UvUnwrapWarning } from "../../types";

export function pinIgnoredWarning(cornerIds: readonly CornerId[]): UvUnwrapWarning {
  return {
    code: "pins-ignored",
    message: "Pinned UV corners were moved because ignorePins was set",
    cornerIds,
  };
}
