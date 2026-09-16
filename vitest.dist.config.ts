import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@modeling-kit/core": path.resolve(__dirname, "packages/core/src/index.ts"),
      "@modeling-kit/math": path.resolve(__dirname, "packages/math/src/index.ts"),
      "@modeling-kit/mesh": path.resolve(__dirname, "packages/mesh/src/index.ts"),
      "@modeling-kit/validation": path.resolve(__dirname, "packages/validation/src/index.ts"),
      "@modeling-kit/uv": path.resolve(__dirname, "packages/uv/src/index.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["packages/workers/tests/workers.dist.spec.ts"],
  },
});
