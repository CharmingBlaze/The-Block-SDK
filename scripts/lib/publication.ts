export const PACKAGE_LICENSE = "MIT";
export const REPO_URL = "https://github.com/CharmingBlaze/The-Block-SDK";
export const REPO_GIT = `${REPO_URL}.git`;
export const NODE_ENGINE = ">=22";

export const PACKAGE_DESCRIPTIONS: Record<string, string> = {
  "@modeling-kit/animation": "Canonical document animation clips and sampling for modeling-kit",
  "@modeling-kit/commands": "Undoable modeling commands and fluent editor for modeling-kit",
  "@modeling-kit/core": "Branded IDs, events, lifecycle, and shared utilities for modeling-kit",
  "@modeling-kit/document": "Canonical ModelDocument, hierarchy, and native serialization",
  "@modeling-kit/formats": "glTF, OBJ, STL, and PLY interchange for modeling-kit",
  "@modeling-kit/history": "Undo/redo stacks and command history for modeling-kit",
  "@modeling-kit/input": "Headless actions and gestures with an optional DOM bind",
  "@modeling-kit/materials": "PBR material definitions and slots for modeling-kit",
  "@modeling-kit/math": "Headless vectors, matrices, and geometric helpers",
  "@modeling-kit/mesh": "Half-edge mesh kernel, adjacency queries, and triangulation",
  "@modeling-kit/meshopt": "Optional meshoptimizer adapter for derived render and export triangles",
  "@modeling-kit/paint": "In-memory image and paint revision helpers",
  "@modeling-kit/primitives": "Procedural mesh generators for modeling-kit",
  "@modeling-kit/rigging": "Preview skeletons and skin weights for modeling-kit",
  "@modeling-kit/scene": "Document scene helpers for modeling-kit",
  "@modeling-kit/sdk": "Headless modeling-kit facade for host applications",
  "@modeling-kit/selection": "Branded-ID selection and topology grow/shrink",
  "@modeling-kit/snapping": "Snap queries and modeling tolerances",
  "@modeling-kit/three-adapter": "Derived Three.js viewport, picking, and overlays",
  "@modeling-kit/tools": "Interactive tool state machines for modeling-kit",
  "@modeling-kit/transform": "Object and component transforms for modeling-kit",
  "@modeling-kit/uv": "UV islands, projection, and packing helpers",
  "@modeling-kit/validation": "Topological and geometric invariant validation",
  "@modeling-kit/workers": "Asynchronous compute worker boundaries for heavy mesh operations",
};

export const PACKAGE_KEYWORDS: Record<string, readonly string[]> = {
  "@modeling-kit/animation": ["3d", "animation", "clips", "typescript"],
  "@modeling-kit/commands": ["3d", "modeling", "commands", "undo", "typescript"],
  "@modeling-kit/core": ["3d", "modeling", "ids", "typescript"],
  "@modeling-kit/document": ["3d", "modeling", "document", "scene-graph", "typescript"],
  "@modeling-kit/formats": ["3d", "gltf", "obj", "stl", "ply", "typescript"],
  "@modeling-kit/history": ["3d", "undo", "redo", "history", "typescript"],
  "@modeling-kit/input": ["3d", "input", "keymap", "typescript"],
  "@modeling-kit/materials": ["3d", "pbr", "materials", "typescript"],
  "@modeling-kit/math": ["3d", "math", "vector", "matrix", "typescript"],
  "@modeling-kit/mesh": ["3d", "mesh", "half-edge", "topology", "typescript"],
  "@modeling-kit/meshopt": ["3d", "meshoptimizer", "lod", "typescript"],
  "@modeling-kit/paint": ["3d", "paint", "texture", "typescript"],
  "@modeling-kit/primitives": ["3d", "primitives", "procedural", "typescript"],
  "@modeling-kit/rigging": ["3d", "rigging", "skinning", "typescript"],
  "@modeling-kit/scene": ["3d", "scene-graph", "typescript"],
  "@modeling-kit/sdk": ["3d", "modeling", "sdk", "typescript"],
  "@modeling-kit/selection": ["3d", "selection", "topology", "typescript"],
  "@modeling-kit/snapping": ["3d", "snapping", "modeling", "typescript"],
  "@modeling-kit/three-adapter": ["3d", "three", "viewport", "typescript"],
  "@modeling-kit/tools": ["3d", "modeling", "tools", "typescript"],
  "@modeling-kit/transform": ["3d", "transform", "gizmo", "typescript"],
  "@modeling-kit/uv": ["3d", "uv", "unwrap", "typescript"],
  "@modeling-kit/validation": ["3d", "mesh", "validation", "typescript"],
  "@modeling-kit/workers": ["3d", "workers", "mesh", "typescript"],
};

export function publicationFields(name: string, directory: string): Record<string, unknown> {
  return {
    description: PACKAGE_DESCRIPTIONS[name] ?? `${name} for modeling-kit`,
    license: PACKAGE_LICENSE,
    homepage: `${REPO_URL}/tree/main/${directory}`,
    bugs: { url: `${REPO_URL}/issues` },
    repository: {
      type: "git",
      url: `git+${REPO_GIT}`,
      directory,
    },
    keywords: [...(PACKAGE_KEYWORDS[name] ?? ["3d", "modeling", "typescript"])],
    engines: { node: NODE_ENGINE },
    publishConfig: { access: "public" },
  };
}
