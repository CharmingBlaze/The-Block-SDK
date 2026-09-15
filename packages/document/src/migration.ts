import { CURRENT_SCHEMA_VERSION } from "./types";

export interface Migration {
  readonly from: number;
  readonly to: number;
  migrate(input: Record<string, unknown>): Record<string, unknown>;
}

export const migrations: readonly Migration[] = [
  {
    from: 1,
    to: 2,
    migrate(input) {
      const scene = isRecord(input.scene) ? { ...input.scene } : {};
      const nodes = Array.isArray(scene.nodes) ? scene.nodes : [];
      const rootNodeId = typeof scene.rootNodeId === "string" ? scene.rootNodeId : undefined;
      const root = nodes.find((item) => isRecord(item) && item.id === rootNodeId);
      const rootIds = Array.isArray(scene.rootIds)
        ? scene.rootIds
        : isRecord(root) && Array.isArray(root.childIds)
          ? root.childIds
          : [];
      return {
        ...input,
        schemaVersion: 2,
        scene: { ...scene, rootIds },
        materialInstances: input.materialInstances ?? { revision: 0, items: [] },
        textureSets: input.textureSets ?? { revision: 0, items: [] },
        images: input.images ?? { revision: 0, items: [] },
      };
    },
  },
];

export function applyMigrations(
  raw: Record<string, unknown>,
  fromVersion: number,
): Record<string, unknown> {
  let current = raw;
  let version = fromVersion;
  while (version < CURRENT_SCHEMA_VERSION) {
    const step = migrations.find((item) => item.from === version && item.to > version);
    if (!step) {
      break;
    }
    current = step.migrate(current);
    version = step.to;
  }
  return current;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
