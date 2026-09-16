import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@modeling-kit/core": path.resolve(__dirname, "packages/core/src/index.ts"),
      "@modeling-kit/math": path.resolve(__dirname, "packages/math/src/index.ts"),
      "@modeling-kit/document": path.resolve(__dirname, "packages/document/src/index.ts"),
      "@modeling-kit/scene": path.resolve(__dirname, "packages/scene/src/index.ts"),
      "@modeling-kit/mesh": path.resolve(__dirname, "packages/mesh/src/index.ts"),
      "@modeling-kit/meshopt": path.resolve(__dirname, "packages/meshopt/src/index.ts"),
      "@modeling-kit/selection": path.resolve(__dirname, "packages/selection/src/index.ts"),
      "@modeling-kit/history": path.resolve(__dirname, "packages/history/src/index.ts"),
      "@modeling-kit/commands": path.resolve(__dirname, "packages/commands/src/index.ts"),
      "@modeling-kit/sdk": path.resolve(__dirname, "packages/sdk/src/index.ts"),
      "@modeling-kit/three-adapter": path.resolve(__dirname, "packages/three-adapter/src/index.ts"),
      "@modeling-kit/validation": path.resolve(__dirname, "packages/validation/src/index.ts"),
      "@modeling-kit/tools": path.resolve(__dirname, "packages/tools/src/index.ts"),
      "@modeling-kit/materials": path.resolve(__dirname, "packages/materials/src/index.ts"),
      "@modeling-kit/uv": path.resolve(__dirname, "packages/uv/src/index.ts"),
      "@modeling-kit/rigging": path.resolve(__dirname, "packages/rigging/src/index.ts"),
      "@modeling-kit/animation": path.resolve(__dirname, "packages/animation/src/index.ts"),
      "@modeling-kit/paint": path.resolve(__dirname, "packages/paint/src/index.ts"),
      "@modeling-kit/formats": path.resolve(__dirname, "packages/formats/src/index.ts"),
      "@modeling-kit/workers": path.resolve(__dirname, "packages/workers/src/index.ts"),
      "@modeling-kit/workers/browser": path.resolve(__dirname, "packages/workers/src/browser.ts"),
      "@modeling-kit/workers/node": path.resolve(__dirname, "packages/workers/src/node.ts"),
      "@modeling-kit/transform": path.resolve(__dirname, "packages/transform/src/index.ts"),
      "@modeling-kit/snapping": path.resolve(__dirname, "packages/snapping/src/index.ts"),
      "@modeling-kit/primitives": path.resolve(__dirname, "packages/primitives/src/index.ts"),
      "@modeling-kit/input": path.resolve(__dirname, "packages/input/src/index.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["packages/*/tests/**/*.test.ts"],
  },
});
