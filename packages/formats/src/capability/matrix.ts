import type { FormatAspectCell, FormatCapabilityRow } from "./types";

const preserve = (summary: string): FormatAspectCell => ({ fidelity: "preserve", summary });
const approximate = (summary: string): FormatAspectCell => ({ fidelity: "approximate", summary });
const lose = (summary: string): FormatAspectCell => ({ fidelity: "lose", summary });
const none = (summary: string): FormatAspectCell => ({ fidelity: "none", summary });

const GLTF_ASPECTS: FormatCapabilityRow["aspects"] = {
  topology: approximate(
    "TRIANGLES only; n-gons triangulated; branded half-edge IDs are not preserved",
  ),
  materials: approximate(
    "PBR metallic-roughness factors and standard texture slots; unsupported properties recorded as losses",
  ),
  skins: approximate(
    "Canonical skeletons and influences when importSkins/exportSkins are on; influences may truncate",
  ),
  animation: approximate(
    "Supported clips and channels when importAnimations/exportAnimations are on; unsupported tracks dropped",
  ),
};

export const FORMAT_CAPABILITY_MATRIX: readonly FormatCapabilityRow[] = [
  {
    id: "native-json",
    label: "Native JSON",
    package: "@modeling-kit/commands",
    codec: "implemented",
    aspects: {
      topology: preserve("Half-edge kernel, branded IDs, and n-gons in ModelDocument mesh records"),
      materials: preserve("PBR materials, instances, textures, and image documents"),
      skins: preserve("Skeletons and skin bindings on the document"),
      animation: preserve("Animation clips on the document"),
    },
    notes: "Canonical persistence via session.saveNativeJson / loadNativeJson. History and selection are session-only.",
  },
  {
    id: "gltf",
    label: "glTF",
    package: "@modeling-kit/formats",
    codec: "implemented",
    aspects: GLTF_ASPECTS,
    notes: "Derived interchange through glTF Transform. Do not treat as a second mesh kernel.",
  },
  {
    id: "glb",
    label: "GLB",
    package: "@modeling-kit/formats",
    codec: "implemented",
    aspects: GLTF_ASPECTS,
    notes: "Same pipeline as glTF; binary container only.",
  },
  {
    id: "obj",
    label: "Wavefront OBJ",
    package: "@modeling-kit/formats",
    codec: "implemented",
    aspects: {
      topology: approximate("Polygon vertex loops and shared positions; no branded IDs"),
      materials: lose("Geometry-only; no mtllib or PBR"),
      skins: lose("Not written or read"),
      animation: lose("Not written or read"),
    },
    notes: "Exports v / vn / f only. vt / UV import and export are not implemented.",
  },
  {
    id: "stl-ascii",
    label: "ASCII STL",
    package: "@modeling-kit/formats",
    codec: "implemented",
    aspects: {
      topology: lose("Triangle soup after tessellation; no shared vertices, UVs, or groups"),
      materials: lose("Facet normals only"),
      skins: lose("Not written or read"),
      animation: lose("Not written or read"),
    },
    notes: "Binary STL is rejected by design in Release 1.",
  },
  {
    id: "ppm",
    label: "PPM P3",
    package: "@modeling-kit/formats",
    codec: "implemented",
    aspects: {
      topology: none("Image codec, not a mesh format"),
      materials: none("RGB pixels only; alpha is forced to 255 on import"),
      skins: none("Image codec"),
      animation: none("Image codec"),
    },
    notes: "Tiled paint buffers. Native JSON keeps texture RGBA as pixelsBase64.",
  },
  {
    id: "ply",
    label: "PLY (ASCII)",
    package: "@modeling-kit/formats",
    codec: "implemented",
    aspects: {
      topology: approximate(
        "Vertex rows plus face index lists keep shared positions and n-gons; no branded half-edge IDs",
      ),
      materials: lose("Geometry-only; per-vertex colours and normals are dropped on import"),
      skins: lose("Not written or read"),
      animation: lose("Not written or read"),
    },
    notes: "ASCII only. Binary PLY is rejected by design, matching ASCII STL.",
  },
];
