# Real WebGL picking smoke

Node unit tests may use the software ID-buffer (`gpuPicking: "software"`). That is **not** release evidence for the WebGL pick pass.

## Command

```text
pnpm test:webgl
```

This starts `@modeling-kit/webgl-smoke` (Vite) and runs Playwright against Chromium. The harness creates a real `WebGLRenderer` / `getContext("webgl2"|"webgl")`. If no context exists, the page reports `WEBGL_UNAVAILABLE` and the Playwright test **fails**. There is no silent skip.

## CI

`.github/workflows/ci.yml` job `webgl-smoke` is separate from `pnpm check:release`. It installs Chromium with OS deps and runs `xvfb-run --auto-servernum pnpm test:webgl` so Mesa/llvmpipe can provide a WebGL implementation on `ubuntu-latest`.

Local runs need Playwright browsers once:

```text
pnpm exec playwright install chromium
pnpm test:webgl
```

## Coverage

Perspective and orthographic cameras, DPR 1 and 2, canvas offset, split-viewport pixel conversion, a half-width viewport pick, maximized size, resize, overlapping objects, object mode, face mode, quad triangles sharing a canonical `FaceId`, empty click, front-only miss on a back-facing quad, front-and-back hit, camera view-offset restore, and repeated clicks. Sample pixels are taken near face centers, not triangle borders.

## Not claimed

This job does not verify GPU hover, alpha cutouts, clipping-plane parity, `InstancedMesh`, or GPU skinning.
