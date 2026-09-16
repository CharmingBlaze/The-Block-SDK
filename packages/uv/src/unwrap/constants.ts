/** Canonical UV V increases upward (glTF / OpenGL). Hosts with top-left textures flip V for display only. */
export const UV_V_AXIS = "up" as const;

/** UV discontinuity used to mark canonical seams after automatic chart unwrap. */
export const UV_SEAM_TOLERANCE = 1e-6;

/** Maximum difference allowed when two triangles assign UVs to the same canonical corner. */
export const UV_CORNER_ASSIGNMENT_TOLERANCE = 1e-4;

export const DEFAULT_UNWRAP_RESOLUTION = 1024;
export const DEFAULT_UNWRAP_PADDING_TEXELS = 2;
