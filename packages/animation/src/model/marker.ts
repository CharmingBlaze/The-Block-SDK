import type { TimelineMarker } from "@modeling-kit/document";

export function marker(time: number, name: string): TimelineMarker {
  return { time, name };
}
