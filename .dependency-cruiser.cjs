/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-cross-package-circular",
      comment:
        "Workspace packages must not form cycles with each other. Intra-package file cycles are tracked separately and are not this gate.",
      severity: "error",
      from: { path: "^packages/([^/]+)/" },
      to: {
        circular: true,
        path: "^packages/",
        pathNot: "^packages/$1/",
      },
    },
    {
      name: "no-intra-package-circular",
      comment: "File-level cycles inside a package. Warn only; fix opportunistically.",
      severity: "warn",
      from: { path: "^packages/" },
      to: { circular: true, path: "^packages/" },
    },
    {
      name: "no-three-in-headless",
      comment:
        "Three.js is allowed only in @modeling-kit/three-adapter, host apps, and @modeling-kit/sdk/three.",
      severity: "error",
      from: {
        path: "^packages/(core|math|document|mesh|validation|scene|selection|history|materials|uv|paint|primitives|transform|snapping|input|tools|commands|formats|workers|rigging|animation|sdk)/",
        pathNot: "^packages/sdk/src/three\\.ts$",
      },
      to: { path: "(^|/)node_modules/three(/|$)|^three$" },
    },
    {
      name: "no-adapter-in-headless",
      comment: "Headless packages must not import @modeling-kit/three-adapter.",
      severity: "error",
      from: {
        path: "^packages/(core|math|document|mesh|validation|scene|selection|history|materials|uv|paint|primitives|transform|snapping|input|tools|commands|formats|workers|rigging|animation|sdk)/",
        pathNot: "^packages/sdk/src/three\\.ts$",
      },
      to: { path: "^packages/three-adapter/" },
    },
    {
      name: "core-no-higher-packages",
      comment: "@modeling-kit/core must not depend on other workspace packages.",
      severity: "error",
      from: { path: "^packages/core/src" },
      to: { path: "^packages/(?!core/)" },
    },
    {
      name: "math-no-workspace-or-three",
      comment: "@modeling-kit/math must stay free of other packages, Three.js, and DOM adapters.",
      severity: "error",
      from: { path: "^packages/math/src" },
      to: {
        path: "^packages/(?!math/)|(^|/)node_modules/three(/|$)|^three$|^packages/three-adapter/",
      },
    },
    {
      name: "mesh-no-editor-stack",
      comment:
        "@modeling-kit/mesh must not depend on tools, commands, document, scene, renderer, or DOM packages.",
      severity: "error",
      from: { path: "^packages/mesh/src" },
      to: {
        path: "^packages/(tools|commands|document|scene|three-adapter|sdk|input|history|selection)/",
      },
    },
    {
      name: "commands-no-three",
      comment: "@modeling-kit/commands must remain headless.",
      severity: "error",
      from: { path: "^packages/commands/src" },
      to: { path: "(^|/)node_modules/three(/|$)|^three$|^packages/three-adapter/" },
    },
    {
      name: "document-no-three",
      comment: "@modeling-kit/document must remain headless.",
      severity: "error",
      from: { path: "^packages/document/src" },
      to: { path: "(^|/)node_modules/three(/|$)|^three$|^packages/three-adapter/" },
    },
    {
      name: "history-headless",
      comment: "@modeling-kit/history must remain headless.",
      severity: "error",
      from: { path: "^packages/history/src" },
      to: { path: "(^|/)node_modules/three(/|$)|^three$|^packages/three-adapter/" },
    },
    {
      name: "tools-no-three",
      comment: "@modeling-kit/tools may use headless SDK packages only.",
      severity: "error",
      from: { path: "^packages/tools/src" },
      to: { path: "(^|/)node_modules/three(/|$)|^three$|^packages/three-adapter/" },
    },
    {
      name: "input-main-headless",
      comment:
        "The main @modeling-kit/input entry must stay headless. DOM event types belong in src/dom.ts.",
      severity: "error",
      from: {
        path: "^packages/input/src",
        pathNot: "^packages/input/src/dom\\.ts$",
      },
      to: { path: "(^|/)node_modules/three(/|$)|^three$|^packages/three-adapter/" },
    },
  ],
  options: {
    doNotFollow: {
      path: "node_modules",
    },
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: "tsconfig.json",
    },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default", "types"],
      extensions: [".ts", ".js", ".mjs", ".cjs"],
    },
    exclude: {
      path: "(^|/)(dist|coverage|generated|node_modules|apps)(/|$)|\\.d\\.ts$",
    },
    reporterOptions: {
      text: {
        highlightFocused: true,
      },
    },
  },
};
