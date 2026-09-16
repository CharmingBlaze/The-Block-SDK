import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function pkg(name: string): string {
  return path.join(repoRoot, "packages", name, "src/index.ts");
}

export default defineConfig({
  server: { port: 4179, strictPort: true, host: "127.0.0.1" },
  resolve: {
    alias: {
      "@modeling-kit/animation": pkg("animation"),
      "@modeling-kit/commands": pkg("commands"),
      "@modeling-kit/core": pkg("core"),
      "@modeling-kit/document": pkg("document"),
      "@modeling-kit/history": pkg("history"),
      "@modeling-kit/input": pkg("input"),
      "@modeling-kit/materials": pkg("materials"),
      "@modeling-kit/math": pkg("math"),
      "@modeling-kit/mesh": pkg("mesh"),
      "@modeling-kit/rigging": pkg("rigging"),
      "@modeling-kit/scene": pkg("scene"),
      "@modeling-kit/sdk": pkg("sdk"),
      "@modeling-kit/selection": pkg("selection"),
      "@modeling-kit/three-adapter": pkg("three-adapter"),
      "@modeling-kit/tools": pkg("tools"),
      "@modeling-kit/transform": pkg("transform"),
      "@modeling-kit/uv": pkg("uv"),
    },
  },
});
