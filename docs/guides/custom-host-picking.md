# Custom host picking

`createThreeViewport({ picking: false })` does not attach pointer handlers. The host owns modifiers, click-versus-drag, pointer capture, and tool consumption. Low-level methods stay on the viewport handle. Turnkey options: [`viewport.md`](viewport.md).

```ts
import { createModelingSession, CreatePrimitiveCommand } from "@modeling-kit/sdk";
import { createThreeViewport } from "@modeling-kit/three-adapter";
import type { PointPickRequest, SelectionIntent, ToolPickResponse } from "@modeling-kit/selection";

const session = createModelingSession();
session.execute(new CreatePrimitiveCommand("cube", { width: 2, height: 2, depth: 2 }));

const viewport = createThreeViewport({
  container,
  session,
  picking: false,
});

const CLICK_PX = 4;
const pointers = new Map<number, { x: number; y: number; request: PointPickRequest }>();

function intentFromEvent(event: PointerEvent): SelectionIntent {
  if (event.shiftKey) return "add";
  if (event.altKey) return "subtract";
  if (event.ctrlKey || event.metaKey) return "toggle";
  return "replace";
}

canvas.addEventListener("pointerdown", async (event) => {
  if (event.button !== 0) return;
  const request: PointPickRequest = {
    clientX: event.clientX,
    clientY: event.clientY,
    canvasRect: canvas.getBoundingClientRect(),
    domain: "face",
    purpose: "selection",
    requireSurfacePoint: false,
  };
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, request });
  const result = await viewport.resolvePointPick(request);
  const tool: ToolPickResponse = { consumed: false };
  if (tool.consumed) {
    pointers.delete(event.pointerId);
  }
  void result;
});

canvas.addEventListener("pointerup", async (event) => {
  const started = pointers.get(event.pointerId);
  pointers.delete(event.pointerId);
  if (!started) return;
  const dx = event.clientX - started.x;
  const dy = event.clientY - started.y;
  if (dx * dx + dy * dy > CLICK_PX * CLICK_PX) return;
  const result = await viewport.resolvePointPick(started.request);
  viewport.applyPointPick(result, intentFromEvent(event));
});
```

Notes:

- Reuse the pointer-down request at pointer-up. Do not call CPU `adapter.pick` on down and GPU `pickPoint` on up.
- Modifier keys are read at **pointerup** for click selection.
- `toMeshLocal` returns `undefined` for identity-only hits. Tools that need XYZ must set `requireSurfacePoint: true` or `purpose: "knife"` / `"placement"` / `"measurement"`.
- Hover stays on the CPU path (`adapter.pick` or `pickFromClient`) until GPU hover exists.
