export type ProfilePoint = readonly [number, number];

export type ProfileKind = "polygon" | "path";

export interface ProfileDefinition {
  readonly kind: ProfileKind;
  readonly outer: readonly ProfilePoint[];
  readonly holes?: readonly (readonly ProfilePoint[])[];
}

export interface ProfileExtrudeParameters {
  readonly profile: ProfileDefinition;
  readonly depth: number;
  readonly bevelSize?: number;
  readonly bevelSegments?: number;
  readonly caps?: boolean;
  readonly lineWidth?: number;
  readonly smoothSide?: boolean;
  readonly name?: string;
}
