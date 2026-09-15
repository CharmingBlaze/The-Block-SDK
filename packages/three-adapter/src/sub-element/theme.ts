import type {
  ColorOpacity,
  DeepPartial,
  EdgeVisualTheme,
  FaceVisualTheme,
  SubElementDisplayOptions,
  SubElementVisualTheme,
  VertexVisualTheme,
} from "./types";

const hidden: ColorOpacity = { color: 0x000000, opacity: 0 };

export const defaultSubElementTheme: SubElementVisualTheme = {
  vertices: {
    style: "cube",
    pixelSize: 8,
    minPixelSize: 5,
    maxPixelSize: 18,
    depthTest: true,
    xray: false,
    outline: true,
    pickPixelPadding: 6,
    states: {
      default: { color: 0xf2f4f8, opacity: 1, outlineColor: 0x1a1a24, outlineWidth: 1, scale: 1 },
      hovered: { color: 0x7ad4ff, opacity: 1, outlineColor: 0x0b3a52, outlineWidth: 1.5, scale: 1.15 },
      selected: { color: 0xffc14d, opacity: 1, outlineColor: 0x5a3a00, outlineWidth: 1.5, scale: 1.2 },
      active: { color: 0xff7a1a, opacity: 1, outlineColor: 0x4a2200, outlineWidth: 2, scale: 1.3 },
      disabled: { color: 0x8b8b98, opacity: 0.45, outlineColor: 0x33333c, scale: 0.9 },
      locked: { color: 0xb7a0ff, opacity: 0.7, outlineColor: 0x2d2150, scale: 1 },
      hidden: { color: 0x000000, opacity: 0, scale: 1 },
    },
  },
  edges: {
    style: "screen-space",
    width: 1.5,
    pickWidth: 8,
    depthTest: true,
    xray: false,
    roles: {
      interior: { color: 0x2a2a38, opacity: 0.85 },
      boundary: { color: 0x4aa3ff, opacity: 1 },
      seam: { color: 0xff5a7a, opacity: 1 },
      sharp: { color: 0xd4d8e0, opacity: 1 },
      crease: { color: 0x9d7cff, opacity: 1 },
    },
    states: {
      default: { color: 0x2a2a38, opacity: 0.9, width: 1.5 },
      hovered: { color: 0x7ad4ff, opacity: 1, width: 2.5 },
      selected: { color: 0xffc14d, opacity: 1, width: 2.75 },
      active: { color: 0xff7a1a, opacity: 1, width: 3.25 },
      disabled: { color: 0x6c6c78, opacity: 0.4, width: 1.25 },
      locked: { color: 0xb7a0ff, opacity: 0.65, width: 1.5 },
      hidden: { ...hidden, width: 0 },
    },
  },
  faces: {
    style: "fill-outline",
    depthTest: true,
    xray: false,
    frontFaceOnly: false,
    states: {
      default: { color: 0xffffff, opacity: 0, outlineColor: 0x000000, outlineWidth: 0 },
      hovered: { color: 0x5ec8ff, opacity: 0.18, outlineColor: 0x7ad4ff, outlineWidth: 1.5 },
      selected: { color: 0xffc14d, opacity: 0.28, outlineColor: 0xffdd88, outlineWidth: 1.75 },
      active: { color: 0xff7a1a, opacity: 0.38, outlineColor: 0xffaa55, outlineWidth: 2 },
      disabled: { color: 0x888899, opacity: 0.12, outlineColor: 0x666677, outlineWidth: 1 },
      locked: { color: 0xb7a0ff, opacity: 0.16, outlineColor: 0xcbb8ff, outlineWidth: 1 },
      hidden: { ...hidden, outlineColor: 0x000000, outlineWidth: 0 },
    },
  },
};

export const defaultSubElementDisplay: SubElementDisplayOptions = {
  enabled: true,
  editMode: false,
  showVertices: "domain",
  showEdges: "domain",
  showFaces: "states",
  lod: {
    maxVertices: 12_000,
    maxEdges: 18_000,
    maxFaces: 12_000,
    strategy: "stride",
  },
};

export function mergeSubElementTheme(
  base: SubElementVisualTheme,
  patch?: DeepPartial<SubElementVisualTheme>,
): SubElementVisualTheme {
  if (!patch) {
    return base;
  }
  return {
    vertices: mergeVertexTheme(base.vertices, patch.vertices),
    edges: mergeEdgeTheme(base.edges, patch.edges),
    faces: mergeFaceTheme(base.faces, patch.faces),
  };
}

export function mergeSubElementDisplay(
  base: SubElementDisplayOptions,
  patch?: DeepPartial<SubElementDisplayOptions>,
): SubElementDisplayOptions {
  if (!patch) {
    return base;
  }
  return {
    enabled: patch.enabled ?? base.enabled,
    editMode: patch.editMode ?? base.editMode,
    showVertices: patch.showVertices ?? base.showVertices,
    showEdges: patch.showEdges ?? base.showEdges,
    showFaces: patch.showFaces ?? base.showFaces,
    lod: { ...base.lod, ...patch.lod },
  };
}

function mergeVertexTheme(
  base: VertexVisualTheme,
  patch?: DeepPartial<VertexVisualTheme>,
): VertexVisualTheme {
  if (!patch) {
    return base;
  }
  return {
    ...base,
    ...patch,
    states: { ...base.states, ...patch.states } as VertexVisualTheme["states"],
  };
}

function mergeEdgeTheme(base: EdgeVisualTheme, patch?: DeepPartial<EdgeVisualTheme>): EdgeVisualTheme {
  if (!patch) {
    return base;
  }
  return {
    ...base,
    ...patch,
    roles: { ...base.roles, ...patch.roles } as EdgeVisualTheme["roles"],
    states: { ...base.states, ...patch.states } as EdgeVisualTheme["states"],
  };
}

function mergeFaceTheme(base: FaceVisualTheme, patch?: DeepPartial<FaceVisualTheme>): FaceVisualTheme {
  if (!patch) {
    return base;
  }
  return {
    ...base,
    ...patch,
    states: { ...base.states, ...patch.states } as FaceVisualTheme["states"],
  };
}
