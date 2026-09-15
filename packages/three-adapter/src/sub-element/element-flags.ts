import type { ElementVisualState } from "./types";

export const enum ElementStateFlag {
  None = 0,
  Hovered = 1 << 0,
  Selected = 1 << 1,
  Active = 1 << 2,
  Locked = 1 << 3,
  Disabled = 1 << 4,
  Hidden = 1 << 5,
}

export function flagsToVisualState(flags: number): ElementVisualState {
  if (flags & ElementStateFlag.Hidden) {
    return "hidden";
  }
  if (flags & ElementStateFlag.Disabled) {
    return "disabled";
  }
  if (flags & ElementStateFlag.Locked) {
    return "locked";
  }
  if (flags & ElementStateFlag.Active) {
    return "active";
  }
  if (flags & ElementStateFlag.Selected) {
    return "selected";
  }
  if (flags & ElementStateFlag.Hovered) {
    return "hovered";
  }
  return "default";
}

export class CompactElementStates {
  flags = new Uint8Array(0);
  patchedIndices: number[] = [];

  resize(count: number): void {
    if (this.flags.length === count) {
      return;
    }
    const next = new Uint8Array(count);
    next.set(this.flags.subarray(0, Math.min(count, this.flags.length)));
    this.flags = next;
  }

  clearPatches(): void {
    this.patchedIndices.length = 0;
  }

  setFlag(index: number, flag: ElementStateFlag, on: boolean): boolean {
    if (index < 0 || index >= this.flags.length) {
      return false;
    }
    const previous = this.flags[index]!;
    const next = on ? previous | flag : previous & ~flag;
    if (next === previous) {
      return false;
    }
    this.flags[index] = next;
    this.patchedIndices.push(index);
    return true;
  }

  replaceHover(previousIndex: number | undefined, nextIndex: number | undefined): number {
    this.clearPatches();
    if (previousIndex !== undefined) {
      this.setFlag(previousIndex, ElementStateFlag.Hovered, false);
    }
    if (nextIndex !== undefined) {
      this.setFlag(nextIndex, ElementStateFlag.Hovered, true);
    }
    return this.patchedIndices.length;
  }

  replaceActive(previousIndex: number | undefined, nextIndex: number | undefined): number {
    this.clearPatches();
    if (previousIndex !== undefined) {
      this.setFlag(previousIndex, ElementStateFlag.Active, false);
    }
    if (nextIndex !== undefined) {
      this.setFlag(nextIndex, ElementStateFlag.Active, true);
    }
    return this.patchedIndices.length;
  }

  diffSelected(previous: ReadonlySet<number>, next: ReadonlySet<number>): number {
    this.clearPatches();
    for (const index of previous) {
      if (!next.has(index)) {
        this.setFlag(index, ElementStateFlag.Selected, false);
      }
    }
    for (const index of next) {
      if (!previous.has(index)) {
        this.setFlag(index, ElementStateFlag.Selected, true);
      }
    }
    return this.patchedIndices.length;
  }
}
