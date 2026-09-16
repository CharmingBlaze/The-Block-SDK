import type { PrimitiveGenerationContext, PrimitiveResult } from "../types";
import { generateProfileExtrude } from "./generate";
import type { ProfilePoint } from "./types";

export function generateFloor(
  outer: readonly ProfilePoint[],
  options: {
    readonly holes?: readonly (readonly ProfilePoint[])[];
    readonly thickness?: number;
    readonly name?: string;
  } = {},
  context: PrimitiveGenerationContext = {},
): PrimitiveResult {
  return generateProfileExtrude(
    {
      profile: {
        kind: "polygon",
        outer,
        ...(options.holes ? { holes: options.holes } : {}),
      },
      depth: options.thickness ?? 0.1,
      name: options.name ?? "Floor",
    },
    context,
  );
}

export function generateWallPath(
  outer: readonly ProfilePoint[],
  options: {
    readonly height?: number;
    readonly thickness?: number;
    readonly name?: string;
  } = {},
  context: PrimitiveGenerationContext = {},
): PrimitiveResult {
  return generateProfileExtrude(
    {
      profile: { kind: "path", outer },
      depth: options.height ?? 2,
      lineWidth: options.thickness ?? 0.2,
      name: options.name ?? "Wall",
    },
    context,
  );
}
