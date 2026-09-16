/**
 * Consumer-facing interchange fidelity. Native JSON is the canonical document;
 * every other row is a derived dump or an unimplemented open standard.
 */
export const FORMAT_IDS = [
  "native-json",
  "gltf",
  "glb",
  "obj",
  "stl-ascii",
  "ppm",
  "ply",
] as const;

export type FormatId = (typeof FORMAT_IDS)[number];

export const FORMAT_ASPECTS = ["topology", "materials", "skins", "animation"] as const;

export type FormatAspect = (typeof FORMAT_ASPECTS)[number];

/**
 * - preserve: round-trips without intentional loss of that aspect
 * - approximate: kept in a reduced / format-native form (triangulated, PBR subset, …)
 * - lose: codec exists but drops the aspect
 * - none: no codec, or the format cannot carry the aspect
 */
export const FORMAT_FIDELITIES = ["preserve", "approximate", "lose", "none"] as const;

export type FormatFidelity = (typeof FORMAT_FIDELITIES)[number];

export interface FormatAspectCell {
  readonly fidelity: FormatFidelity;
  readonly summary: string;
}

export interface FormatCapabilityRow {
  readonly id: FormatId;
  readonly label: string;
  readonly package: "@modeling-kit/formats" | "@modeling-kit/commands" | null;
  readonly codec: "implemented" | "none";
  readonly aspects: Readonly<Record<FormatAspect, FormatAspectCell>>;
  readonly notes: string;
}
