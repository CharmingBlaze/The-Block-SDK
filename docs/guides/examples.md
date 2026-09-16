# Example hosts

All apps under `apps/` are private Vite hosts. They are not published to npm. Build the packages first (`pnpm build`) or let Vite resolve workspace sources.

| App | Package name | What it demonstrates |
| --- | --- | --- |
| [Playground](../../apps/playground) | `@modeling-kit/playground` | Viewport, primitives, extrude, undo/redo, glTF export |
| [React](../../apps/example-react) | `@modeling-kit/example-react` | React 18 + `createThreeViewport` |
| [Vue](../../apps/example-vue) | `@modeling-kit/example-vue` | Vue 3 + adapter lifecycle |
| [Scratch host](../../apps/scratch-host) | `@modeling-kit/scratch-host` | Custom picking with `@modeling-kit/input` |
| [Geometry gallery](../../apps/geometry-gallery) | `@modeling-kit/geometry-gallery` | Canonical vs library primitives |
| [WebGL smoke](../../apps/webgl-smoke) | `@modeling-kit/webgl-smoke` | Playwright GPU picking fixture |

```bash
pnpm --filter @modeling-kit/playground dev
pnpm --filter @modeling-kit/example-react dev
pnpm --filter @modeling-kit/example-vue dev
pnpm --filter @modeling-kit/scratch-host dev
pnpm --filter @modeling-kit/geometry-gallery dev
pnpm --filter @modeling-kit/webgl-smoke dev
```

Typecheck every app:

```bash
pnpm examples:typecheck
```

WebGL smoke (Playwright) is `pnpm test:webgl`. See [`../verification/WEBGL-SMOKE.md`](../verification/WEBGL-SMOKE.md).
