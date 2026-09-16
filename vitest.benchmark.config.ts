import { defineConfig } from "vitest/config";
import base from "./vitest.config.ts";

const aliases = base.resolve?.alias ?? {};

export default defineConfig({
  resolve: {
    alias: aliases as Record<string, string>,
  },
  test: {
    environment: "node",
    include: ["packages/*/tests/**/*.bench.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
  },
});
