import type { UVChannelId } from "@modeling-kit/core";
import type { AttributePropagationPolicy } from "../operations/contract";
import type { CornerRecord } from "../types";
import { lerpColor, lerpUv, lerpVec3 } from "./attribute-interpolation";

export interface CornerAttributes {
  uv?: [u: number, v: number];
  uvChannels?: Record<string, [u: number, v: number]>;
  pinnedUvChannels?: UVChannelId[];
  normal?: [nx: number, ny: number, nz: number];
  color?: [r: number, g: number, b: number, a: number];
}

export function cloneCornerAttributes(
  source: CornerAttributes | Pick<CornerRecord, "uv" | "uvChannels" | "pinnedUvChannels" | "normal" | "color"> | undefined,
): CornerAttributes {
  if (!source) {
    return {};
  }
  const attrs: CornerAttributes = {};
  if (source.uv) {
    attrs.uv = [source.uv[0], source.uv[1]];
  }
  if (source.uvChannels) {
    const channels: Record<string, [number, number]> = {};
    for (const [key, value] of Object.entries(source.uvChannels)) {
      channels[key] = [value[0], value[1]];
    }
    attrs.uvChannels = channels;
  }
  if (source.pinnedUvChannels) {
    attrs.pinnedUvChannels = [...source.pinnedUvChannels];
  }
  if (source.normal) {
    attrs.normal = [source.normal[0], source.normal[1], source.normal[2]];
  }
  if (source.color) {
    attrs.color = [source.color[0], source.color[1], source.color[2], source.color[3]];
  }
  return attrs;
}

export function interpolateCornerAttributes(
  a: CornerAttributes | Pick<CornerRecord, "uv" | "uvChannels" | "pinnedUvChannels" | "normal" | "color"> | undefined,
  b: CornerAttributes | Pick<CornerRecord, "uv" | "uvChannels" | "pinnedUvChannels" | "normal" | "color"> | undefined,
  t: number,
  policy: AttributePropagationPolicy,
): CornerAttributes {
  const left = cloneCornerAttributes(a);
  const right = cloneCornerAttributes(b);
  const result: CornerAttributes = {};

  if (policy.interpolateUvs) {
    if (left.uv && right.uv) {
      result.uv = lerpUv(left.uv, right.uv, t);
    } else if (left.uv) {
      result.uv = left.uv;
    } else if (right.uv) {
      result.uv = right.uv;
    }
    const channelKeys = new Set([
      ...Object.keys(left.uvChannels ?? {}),
      ...Object.keys(right.uvChannels ?? {}),
    ]);
    if (channelKeys.size > 0) {
      const channels: Record<string, [number, number]> = {};
      for (const key of channelKeys) {
        const ua = left.uvChannels?.[key];
        const ub = right.uvChannels?.[key];
        if (ua && ub) {
          channels[key] = lerpUv(ua, ub, t);
        } else if (ua) {
          channels[key] = ua;
        } else if (ub) {
          channels[key] = ub;
        }
      }
      result.uvChannels = channels;
    }
  } else if (left.uv) {
    result.uv = left.uv;
    if (left.uvChannels) {
      result.uvChannels = left.uvChannels;
    }
  }

  if (left.normal && right.normal) {
    result.normal = lerpVec3(left.normal, right.normal, t);
  } else if (left.normal) {
    result.normal = left.normal;
  } else if (right.normal) {
    result.normal = right.normal;
  }

  if (policy.interpolateColors) {
    if (left.color && right.color) {
      result.color = lerpColor(left.color, right.color, t);
    } else if (left.color) {
      result.color = left.color;
    } else if (right.color) {
      result.color = right.color;
    }
  } else if (left.color) {
    result.color = left.color;
  }

  if (left.pinnedUvChannels || right.pinnedUvChannels) {
    const pinned = new Set([...(left.pinnedUvChannels ?? []), ...(right.pinnedUvChannels ?? [])]);
    result.pinnedUvChannels = [...pinned];
  }
  return result;
}

export function averageCornerAttributes(
  corners: readonly CornerAttributes[],
  policy: AttributePropagationPolicy,
): CornerAttributes {
  if (corners.length === 0) {
    return {};
  }
  let acc = cloneCornerAttributes(corners[0]);
  for (let i = 1; i < corners.length; i += 1) {
    acc = interpolateCornerAttributes(acc, corners[i], 1 / (i + 1), policy);
  }
  return acc;
}

export function attributesToFaceOptions(corners: readonly CornerAttributes[]): {
  uvs?: [number, number][];
  normals?: [number, number, number][];
  colors?: [number, number, number, number][];
  uvChannels?: Record<string, [number, number]>[];
  pinnedUvChannels?: UVChannelId[][];
} {
  const uvs: [number, number][] = [];
  const normals: [number, number, number][] = [];
  const colors: [number, number, number, number][] = [];
  const uvChannels: Record<string, [number, number]>[] = [];
  const pinnedUvChannels: UVChannelId[][] = [];
  let hasUv = false;
  let hasNormal = false;
  let hasColor = false;
  let hasChannels = false;
  let hasPinned = false;
  for (const corner of corners) {
    if (corner.uv) {
      hasUv = true;
      uvs.push(corner.uv);
    } else {
      uvs.push([0, 0]);
    }
    if (corner.normal) {
      hasNormal = true;
      normals.push(corner.normal);
    } else {
      normals.push([0, 0, 1]);
    }
    if (corner.color) {
      hasColor = true;
      colors.push(corner.color);
    } else {
      colors.push([1, 1, 1, 1]);
    }
    if (corner.uvChannels) {
      hasChannels = true;
      uvChannels.push(corner.uvChannels);
    } else {
      uvChannels.push({});
    }
    if (corner.pinnedUvChannels && corner.pinnedUvChannels.length > 0) {
      hasPinned = true;
      pinnedUvChannels.push(corner.pinnedUvChannels);
    } else {
      pinnedUvChannels.push([]);
    }
  }
  return {
    ...(hasUv ? { uvs } : {}),
    ...(hasNormal ? { normals } : {}),
    ...(hasColor ? { colors } : {}),
    ...(hasChannels ? { uvChannels } : {}),
    ...(hasPinned ? { pinnedUvChannels } : {}),
  };
}
