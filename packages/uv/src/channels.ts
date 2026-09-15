import { brand, type UVChannelId } from "@modeling-kit/core";

export const DEFAULT_UV_CHANNEL: UVChannelId = brand("uv0");

export type UVChannelPurpose = "base-color" | "lightmap" | "detail" | "custom";

export interface UVChannel {
  readonly id: UVChannelId;
  readonly name: string;
  readonly index: number;
  readonly purpose: UVChannelPurpose;
}

export function createDefaultUvChannel(): UVChannel {
  return {
    id: DEFAULT_UV_CHANNEL,
    name: "UVMap",
    index: 0,
    purpose: "base-color",
  };
}

export function createUvChannel(
  index: number,
  options: {
    readonly id?: UVChannelId;
    readonly name?: string;
    readonly purpose?: UVChannelPurpose;
  } = {},
): UVChannel {
  return {
    id: options.id ?? brand(`uv${index}`),
    name: options.name ?? `UVMap.${index}`,
    index,
    purpose: options.purpose ?? "custom",
  };
}
