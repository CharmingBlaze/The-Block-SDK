import { EXCLUSIVE_CONTEXTS, type AxisKeyBinding, type InputContext, type KeymapEntry } from "./types";

export const defaultAxisBindings: readonly AxisKeyBinding[] = [
  { axis: "nav.forward", positive: "KeyW", negative: "KeyS" },
  { axis: "nav.right", positive: "KeyD", negative: "KeyA" },
];

export const defaultModelingKeymap: readonly KeymapEntry[] = [
  {
    action: "edit.undo",
    contexts: ["app", "viewport.model"],
    chords: [{ keys: ["Control", "KeyZ"] }, { keys: ["Meta", "KeyZ"] }],
  },
  {
    action: "edit.redo",
    contexts: ["app", "viewport.model"],
    chords: [
      { keys: ["Control", "Shift", "KeyZ"] },
      { keys: ["Meta", "Shift", "KeyZ"] },
      { keys: ["Control", "KeyY"] },
      { keys: ["Meta", "KeyY"] },
    ],
  },
  {
    action: "tool.cancel",
    contexts: ["modal.transform", "modal.knife", "viewport.model"],
    chords: [{ keys: ["Escape"] }],
  },
  {
    action: "tool.confirm",
    contexts: ["modal.knife", "viewport.model"],
    chords: [{ keys: ["Enter"] }],
  },
  {
    action: "select.pick",
    contexts: ["viewport.model"],
    pointers: [{ when: "tap", button: "primary", kind: "any" }],
  },
  {
    action: "transform.slide",
    contexts: ["viewport.model"],
    pointers: [{ when: "drag", button: "primary", kind: "any", modifiers: { shift: true } }],
  },
];

export function contextsAllowBinding(
  stack: readonly InputContext[],
  entry: KeymapEntry,
): boolean {
  const exclusive = lastExclusive(stack);
  if (exclusive) {
    return entry.contexts.includes(exclusive);
  }
  return entry.contexts.some((context) => stack.includes(context));
}

export function lastExclusive(stack: readonly InputContext[]): InputContext | undefined {
  for (let i = stack.length - 1; i >= 0; i -= 1) {
    const context = stack[i];
    if (context && EXCLUSIVE_CONTEXTS.includes(context)) {
      return context;
    }
  }
  return undefined;
}
