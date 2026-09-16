import { rmSync } from "node:fs";
import { defineConfig } from "tsup";

rmSync("dist", { recursive: true, force: true });

const shared = {
  format: ["esm"] as const,
  dts: true,
  clean: false,
  sourcemap: true,
  splitting: false,
};

export default defineConfig([
  {
    ...shared,
    entry: ["src/index.ts"],
  },
  {
    ...shared,
    entry: ["src/browser.ts", "src/browser-worker.ts"],
    tsconfig: "tsconfig.browser.json",
  },
  {
    ...shared,
    entry: ["src/node.ts", "src/node-worker.ts"],
    tsconfig: "tsconfig.node.json",
    external: ["node:worker_threads"],
  },
]);
