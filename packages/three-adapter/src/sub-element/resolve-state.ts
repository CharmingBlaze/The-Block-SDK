import type { ElementIdSets, ElementVisualState } from "./types";

const PRIORITY: readonly ElementVisualState[] = [
  "hidden",
  "disabled",
  "locked",
  "active",
  "selected",
  "hovered",
  "default",
];

export function resolveElementVisualState(id: string, sets: ElementIdSets): ElementVisualState {
  if (sets.hidden.has(id)) {
    return "hidden";
  }
  if (sets.disabled.has(id)) {
    return "disabled";
  }
  if (sets.locked.has(id)) {
    return "locked";
  }
  if (sets.active === id) {
    return "active";
  }
  if (sets.selected.has(id)) {
    return "selected";
  }
  if (sets.hovered === id) {
    return "hovered";
  }
  return "default";
}

export function visualStatePriority(state: ElementVisualState): number {
  const index = PRIORITY.indexOf(state);
  return index < 0 ? PRIORITY.length : index;
}

export function emptyElementIdSets(): ElementIdSets {
  return {
    hovered: null,
    selected: new Set(),
    active: null,
    disabled: new Set(),
    locked: new Set(),
    hidden: new Set(),
  };
}
