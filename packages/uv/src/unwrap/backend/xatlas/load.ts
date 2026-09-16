import { UvUnwrapError } from "../../errors";

export type WatlasModule = typeof import("watlas");
export type WatlasAtlas = InstanceType<WatlasModule["Atlas"]>;

export async function loadWatlas(): Promise<WatlasModule> {
  let watlas: WatlasModule;
  try {
    watlas = await import("watlas");
  } catch (error) {
    throw new UvUnwrapError(
      "backend-init-failed",
      error instanceof Error ? error.message : "Failed to import watlas",
    );
  }
  try {
    await watlas.Initialize();
  } catch (error) {
    throw new UvUnwrapError(
      "backend-init-failed",
      error instanceof Error ? error.message : "watlas.Initialize failed",
    );
  }
  return watlas;
}
